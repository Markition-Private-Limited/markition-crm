import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'
import pg from 'pg'

// Direct pg connection for a real transaction — Supabase JS client has no transaction support.
const pgPool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
})

const VALID_STATUSES = ['first_contact', 'follow_up', 'discovery_call', 'closing', 'closed_won', 'failed']

type ContactDraft = {
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  title?: string
  is_primary?: boolean
}

type ProspectDraft = {
  notes?: string
  status?: string
  convertToLead?: boolean
  leadTitle?: string
}

// POST /api/companies/wizard
// Creates company + categories + contacts + prospects atomically.
// If anything fails, the entire transaction is rolled back — nothing is persisted.
export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const body = await request.json()
  const {
    name, industry, website, phone, address,
    category_ids = [] as string[],
    contacts = [] as ContactDraft[],
    prospects = [] as ProspectDraft[],
  } = body

  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 })

  let client: import('pg').PoolClient | null = null
  try {
    client = await pgPool.connect()
    await client.query('BEGIN')

    // ── 1. Company ──────────────────────────────────────────────────────────
    const { rows: [company] } = await client.query<{ id: string; name: string }>(
      `INSERT INTO public.companies (name, industry, website, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name`,
      [
        name.trim(),
        industry?.trim() || null,
        website?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
      ],
    )

    // ── 2. Service categories ───────────────────────────────────────────────
    for (const catId of category_ids) {
      await client.query(
        `INSERT INTO public.company_service_categories (company_id, service_category_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [company.id, catId],
      )
    }

    // ── 3. Contacts ─────────────────────────────────────────────────────────
    // Track if we've set a primary contact so we only set one
    let primarySet = false
    for (const c of contacts) {
      if (!c.first_name?.trim()) continue

      const isPrimary = !primarySet && !!c.is_primary
      if (isPrimary) primarySet = true

      await client.query(
        `INSERT INTO public.contacts
           (company_id, first_name, last_name, email, phone, title, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          company.id,
          c.first_name.trim(),
          c.last_name?.trim() || null,
          c.email?.trim() || null,
          c.phone?.trim() || null,
          c.title?.trim() || null,
          isPrimary,
        ],
      )
    }

    // ── 4. Prospects (+ optional lead conversion) ────────────────────────────
    for (const p of prospects) {
      if (!p.notes?.trim() && !p.convertToLead) continue

      const resolvedStatus = p.status && VALID_STATUSES.includes(p.status) ? p.status : 'first_contact'

      const { rows: [prospect] } = await client.query<{ id: string }>(
        `INSERT INTO public.prospects (company_id, notes, status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [company.id, p.notes?.trim() || null, resolvedStatus],
      )

      if (p.convertToLead) {
        const leadTitle = p.leadTitle?.trim() || `Lead from ${name.trim()}`
        await client.query(
          `INSERT INTO public.leads
             (company_id, source_prospect_id, title, notes, status)
           VALUES ($1, $2, $3, $4, 'first_contact')`,
          [company.id, prospect.id, leadTitle, p.notes?.trim() || null],
        )
        await client.query(
          `UPDATE public.prospects SET status = 'converted' WHERE id = $1`,
          [prospect.id],
        )
      }
    }

    await client.query('COMMIT')

    // Activity log is best-effort — don't roll back the transaction over it
    await logActivity({
      entityType: 'company', entityId: company.id,
      actorId: ctx.userId, action: 'created', newValue: company.name,
    }).catch(() => {})

    return Response.json({ id: company.id, name: company.name }, { status: 201 })
  } catch (err: unknown) {
    if (client) { try { await client.query('ROLLBACK') } catch { /* ignore */ } }
    const msg = err instanceof Error ? err.message : 'Wizard failed'
    return Response.json({ error: msg }, { status: 400 })
  } finally {
    if (client) client.release()
  }
}

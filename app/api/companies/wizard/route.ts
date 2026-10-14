import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'

const VALID_STATUSES = ['first_contact', 'follow_up', 'discovery_call', 'closing', 'closed_won', 'failed']

// POST /api/companies/wizard
// Creates company + categories + contacts + prospects.
// On any failure, deletes the company (DB cascades remove all related rows).
export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {}
  try { body = await request.json() } catch { /* empty body */ }

  const name: string = (body?.name ?? '').trim()
  const industry: string = (body?.industry ?? '').trim()
  const website: string = (body?.website ?? '').trim()
  const phone: string = (body?.phone ?? '').trim()
  const address: string = (body?.address ?? '').trim()
  const category_ids: string[] = Array.isArray(body?.category_ids) ? body.category_ids : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts: any[] = Array.isArray(body?.contacts) ? body.contacts : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prospects: any[] = Array.isArray(body?.prospects) ? body.prospects : []

  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`

  // Track company id so we can roll back on failure
  let companyId: string | null = null

  try {
    // 1. Company
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .insert({ name, slug, industry: industry || null, website: website || null, phone: phone || null, address: address || null })
      .select('id, name')
      .single()

    if (companyErr || !company) throw new Error(companyErr?.message ?? 'Failed to create company')
    companyId = company.id

    // 2. Service categories
    if (category_ids.length > 0) {
      const { error: catErr } = await adminClient
        .from('company_service_categories')
        .insert(category_ids.map((id) => ({ company_id: company.id, service_category_id: id })))
      if (catErr) throw new Error(catErr.message)
    }

    // 3. Contacts
    let primarySet = false
    for (const c of contacts) {
      if (!c.first_name?.trim()) continue
      const isPrimary = !primarySet && !!c.is_primary
      if (isPrimary) primarySet = true

      const insertData: Record<string, unknown> = {
        company_id: company.id,
        first_name: c.first_name.trim(),
        is_primary: isPrimary,
      }
      if (c.last_name?.trim()) insertData.last_name = c.last_name.trim()
      if (c.email?.trim()) insertData.email = c.email.trim()
      if (c.phone?.trim()) insertData.phone = c.phone.trim()
      if (c.title?.trim()) insertData.title = c.title.trim()

      const { error: contactErr } = await adminClient.from('contacts').insert(insertData)
      if (contactErr) throw new Error(contactErr.message)
    }

    // 4. Prospects
    for (const p of prospects) {
      if (!p.notes?.trim() && !p.convertToLead) continue

      const resolvedStatus = p.status && VALID_STATUSES.includes(p.status) ? p.status : 'first_contact'

      const { data: prospect, error: prospectErr } = await adminClient
        .from('prospects')
        .insert({ company_id: company.id, notes: p.notes?.trim() || null, status: resolvedStatus })
        .select('id')
        .single()

      if (prospectErr || !prospect) throw new Error(prospectErr?.message ?? 'Failed to create prospect')

      if (p.convertToLead) {
        const leadTitle = p.leadTitle?.trim() || `Lead from ${name}`
        const { error: leadErr } = await adminClient
          .from('leads')
          .insert({ company_id: company.id, source_prospect_id: prospect.id, title: leadTitle, notes: p.notes?.trim() || null, status: 'first_contact' })
        if (leadErr) throw new Error(leadErr.message)

        await adminClient.from('prospects').update({ status: 'converted' }).eq('id', prospect.id)
      }
    }

    await logActivity({
      entityType: 'company', entityId: company.id,
      actorId: ctx.userId, action: 'created', newValue: company.name,
    }).catch(() => {})

    return Response.json({ id: company.id, name: company.name }, { status: 201 })
  } catch (err: unknown) {
    // Compensating rollback: delete the company — FK cascades clean up categories, contacts, prospects
    if (companyId) {
      await adminClient.from('companies').delete().eq('id', companyId)
    }
    const msg = err instanceof Error ? err.message : 'Wizard failed'
    console.error('[wizard] error:', msg)
    return Response.json({ error: msg }, { status: 400 })
  }
}

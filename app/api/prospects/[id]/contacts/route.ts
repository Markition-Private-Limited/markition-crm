import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

/** GET /api/prospects/[id]/contacts */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('prospect_contacts')
    .select('*')
    .eq('prospect_id', id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data ?? [])
}

/** POST /api/prospects/[id]/contacts */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { name, job_title, email, phone, whatsapp, is_primary } = body

  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 })

  // Duplicate contact check (email/phone across all prospects)
  if (email || phone) {
    const duplicates: Array<{ id: string; prospect_code: string; company_name: string }> = []

    if (email) {
      const { data: byEmail } = await adminClient
        .from('prospect_contacts')
        .select('id, prospect_id, email')
        .ilike('email', email.trim())
        .limit(5)

      for (const c of (byEmail ?? [])) {
        const { data: pros } = await adminClient
          .from('prospects')
          .select('id, prospect_code, company_name')
          .eq('id', (c as { prospect_id: string }).prospect_id)
          .eq('is_archived', false)
          .neq('id', id)
          .single()
        if (pros) duplicates.push(pros as typeof duplicates[0])
      }
    }

    if (phone && !body.skip_duplicate_check) {
      const cleaned = phone.replace(/\D/g, '')
      const { data: byPhone } = await adminClient
        .from('prospect_contacts')
        .select('id, prospect_id, phone')
        .not('phone', 'is', null)
        .limit(20)

      for (const c of (byPhone ?? [])) {
        const cPhone = ((c as { phone?: string }).phone ?? '').replace(/\D/g, '')
        if (cPhone === cleaned) {
          const { data: pros } = await adminClient
            .from('prospects')
            .select('id, prospect_code, company_name')
            .eq('id', (c as { prospect_id: string }).prospect_id)
            .eq('is_archived', false)
            .neq('id', id)
            .single()
          if (pros && !duplicates.find((d) => d.id === (pros as { id: string }).id)) {
            duplicates.push(pros as typeof duplicates[0])
          }
        }
      }
    }

    if (!body.skip_duplicate_check && duplicates.length > 0) {
      return Response.json(
        { duplicate_warning: true, matches: duplicates },
        { status: 409 }
      )
    }
  }

  // If this is set as primary, clear existing primary flag
  if (is_primary) {
    await adminClient
      .from('prospect_contacts')
      .update({ is_primary: false })
      .eq('prospect_id', id)
      .eq('is_primary', true)
  }

  const { data, error: dbErr } = await adminClient
    .from('prospect_contacts')
    .insert({
      prospect_id: id,
      name:        name.trim(),
      job_title:   job_title   ?? null,
      email:       email?.trim() || null,
      phone:       phone       ?? null,
      whatsapp:    whatsapp    ?? null,
      is_primary:  Boolean(is_primary),
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

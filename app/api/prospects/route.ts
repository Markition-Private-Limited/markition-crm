import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'

const VALID_STATUSES = ['first_contact', 'follow_up', 'discovery_call', 'closing', 'closed_won', 'failed']

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const url = new URL(request.url)
  const companyId = url.searchParams.get('company_id')
  const status = url.searchParams.get('status')

  let query = adminClient
    .from('prospects')
    .select('*, companies(id, name)')
    .order('created_at', { ascending: false })

  if (companyId) query = query.eq('company_id', companyId)
  if (status) query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const body = await request.json()
  const { company_id, name, notes, source, owner_id, status } = body
  if (!company_id) return Response.json({ error: 'company_id is required' }, { status: 400 })

  const resolvedStatus = status && VALID_STATUSES.includes(status) ? status : 'first_contact'

  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', company_id)
    .single()

  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .insert({
      company_id,
      name: name || null,
      notes: notes || null,
      source: source || null,
      owner_id: owner_id || null,
      status: resolvedStatus,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  await logActivity({
    entityType: 'prospect',
    entityId: data.id,
    actorId: ctx.userId,
    action: 'created',
    newValue: name || company?.name || null,
  })
  return Response.json(data, { status: 201 })
}

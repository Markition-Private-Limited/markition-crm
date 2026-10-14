import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('clients')
    .select('*, companies(id, name), prospects:source_prospect_id(id, name, notes)')
    .eq('id', id)
    .single()

  if (dbErr || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!status) return Response.json({ error: 'status is required' }, { status: 400 })
  if (!['active', 'inactive'].includes(status))
    return Response.json({ error: 'status must be active or inactive' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('clients')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

  await logActivity({
    entityType: 'client',
    entityId: id,
    actorId: ctx.userId,
    action: 'status_changed',
    fieldName: 'status',
    newValue: status,
  })

  return Response.json(data)
}

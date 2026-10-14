import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logFieldChanges } from '@/lib/activity'

const VALID_STATUSES = ['first_contact', 'follow_up', 'discovery_call', 'closing', 'closed_won', 'failed']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .select('*, companies(id, name)')
    .eq('id', id)
    .single()

  if (dbErr || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)     update.name = body.name
  if (body.notes !== undefined)    update.notes = body.notes
  if (body.source !== undefined)   update.source = body.source
  if (body.owner_id !== undefined) update.owner_id = body.owner_id
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status))
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    update.status = body.status
  }

  const { data: before } = await adminClient
    .from('prospects')
    .select('name,notes,source,owner_id,status')
    .eq('id', id)
    .single()

  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

  if (before) {
    await logFieldChanges({
      entityType: 'prospect',
      entityId: id,
      actorId: ctx.userId,
      before,
      after: update,
    })
  }

  return Response.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const { id } = await params
  const { error: dbErr } = await adminClient.from('prospects').delete().eq('id', id)
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

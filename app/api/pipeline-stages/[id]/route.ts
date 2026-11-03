import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

/** PUT /api/pipeline-stages/[id] — update stage (admin only) */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin'])
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)                update.name = body.name.trim()
  if (body.display_order !== undefined)       update.display_order = Number(body.display_order)
  if (body.default_probability !== undefined) update.default_probability = Number(body.default_probability)
  if (body.is_won !== undefined)              update.is_won = Boolean(body.is_won)
  if (body.is_lost !== undefined)             update.is_lost = Boolean(body.is_lost)
  if (body.is_active !== undefined)           update.is_active = Boolean(body.is_active)

  if (Object.keys(update).length === 0)
    return Response.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('pipeline_stages')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data)  return Response.json({ error: 'Not found' },  { status: 404 })
  return Response.json(data)
}

/** DELETE /api/pipeline-stages/[id] — deactivate stage (admin only, soft) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin'])
  if (error) return error

  const { id } = await params

  // Check no active prospects are currently in this stage
  const { count } = await adminClient
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', id)
    .eq('is_archived', false)

  if (count && count > 0) {
    return Response.json(
      { error: `Cannot deactivate: ${count} active prospect(s) are in this stage. Move them first.` },
      { status: 409 }
    )
  }

  const { data, error: dbErr } = await adminClient
    .from('pipeline_stages')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data)  return Response.json({ error: 'Not found' },  { status: 404 })
  return Response.json(data)
}

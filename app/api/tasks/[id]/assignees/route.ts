import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logTaskChange } from '@/lib/tasks/changelog'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('task_assignees')
    .select('user_id, assigned_at, profiles(id, email, full_name)')
    .eq('task_id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { user_id } = body
  if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('task_assignees')
    .insert({ task_id: id, user_id })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  await logTaskChange(id, ctx.userId, 'assignee_added', null, user_id)

  return Response.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { user_id } = body
  if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 })

  const { error: dbErr } = await adminClient
    .from('task_assignees')
    .delete()
    .eq('task_id', id)
    .eq('user_id', user_id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  await logTaskChange(id, ctx.userId, 'assignee_removed', user_id, null)

  return new Response(null, { status: 204 })
}

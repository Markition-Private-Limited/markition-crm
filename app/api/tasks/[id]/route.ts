import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logTaskChange } from '@/lib/tasks/changelog'
import { logFieldChanges } from '@/lib/activity'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('tasks')
    .select('*, task_assignees(user_id), task_changelog(*), companies(id, name), clients(id, company_id, companies(id, name))')
    .eq('id', id)
    .single()

  if (dbErr || !data) return Response.json({ error: 'Not found' }, { status: 404 })

  // Enrich assignees with profile names
  const userIds: string[] = (data.task_assignees ?? []).map((a: { user_id: string }) => a.user_id)
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    for (const p of profiles ?? []) profileMap[p.id] = p.full_name
  }

  const enriched = {
    ...data,
    task_assignees: (data.task_assignees ?? []).map((a: { user_id: string }) => ({
      user_id: a.user_id,
      profiles: { full_name: profileMap[a.user_id] ?? null },
    })),
  }
  return Response.json(enriched)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const { data: existing } = await adminClient.from('tasks').select('*').eq('id', id).single()
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const editableFields = ['title', 'description', 'status', 'due_date', 'company_id', 'client_id'] as const

  const update: Record<string, unknown> = {}
  const changedFields: Array<{ field: string; old: string | null; new: string | null }> = []

  for (const field of editableFields) {
    if (body[field] !== undefined && body[field] !== existing[field]) {
      update[field] = body[field]
      changedFields.push({
        field,
        old: existing[field] != null ? String(existing[field]) : null,
        new: body[field] != null ? String(body[field]) : null,
      })
    }
  }

  // Validate exactly-one target after applying update
  const nextCompanyId = 'company_id' in update ? update.company_id : existing.company_id
  const nextClientId  = 'client_id'  in update ? update.client_id  : existing.client_id
  if (!nextCompanyId && !nextClientId)
    return Response.json({ error: 'Task must have either company_id or client_id' }, { status: 400 })
  if (nextCompanyId && nextClientId)
    return Response.json({ error: 'Task cannot have both company_id and client_id' }, { status: 400 })

  if (Object.keys(update).length > 0) {
    const { error: dbErr } = await adminClient.from('tasks').update(update).eq('id', id)
    if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

    for (const change of changedFields) {
      await logTaskChange(id, ctx.userId, change.field, change.old, change.new)
    }
    await logFieldChanges({ entityType: 'task', entityId: id, actorId: ctx.userId, before: existing, after: update })
  }

  const { data: updated } = await adminClient
    .from('tasks')
    .select('*, task_assignees(user_id), companies(id, name), clients(id, company_id, companies(id, name))')
    .eq('id', id)
    .single()

  return Response.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { error: dbErr } = await adminClient.from('tasks').delete().eq('id', id)
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logTaskChange } from '@/lib/tasks/changelog'
import { logActivity } from '@/lib/activity'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const url = new URL(request.url)
  const companyId = url.searchParams.get('company_id')
  const clientId = url.searchParams.get('client_id')
  const status = url.searchParams.get('status')

  let query = adminClient
    .from('tasks')
    .select('*, task_assignees(user_id), companies(id, name), clients(id, company_id, companies(id, name))')
    .order('created_at', { ascending: false })

  if (companyId) query = query.eq('company_id', companyId)
  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const body = await request.json()
  const { company_id, client_id, title, description, status, due_date, assignees } = body

  if (!title) return Response.json({ error: 'title is required' }, { status: 400 })

  const hasCompany = !!company_id
  const hasClient = !!client_id
  if (!hasCompany && !hasClient)
    return Response.json({ error: 'Either company_id or client_id is required' }, { status: 400 })
  if (hasCompany && hasClient)
    return Response.json({ error: 'Provide company_id or client_id, not both' }, { status: 400 })

  const { data: task, error: dbErr } = await adminClient
    .from('tasks')
    .insert({
      company_id: company_id ?? null,
      client_id: client_id ?? null,
      title,
      description,
      status: status || 'Open',
      due_date: due_date ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  if (Array.isArray(assignees) && assignees.length > 0) {
    const rows = assignees.map((uid: string) => ({ task_id: task.id, user_id: uid }))
    await adminClient.from('task_assignees').insert(rows)
  }

  await logTaskChange(task.id, ctx.userId, 'created', null, JSON.stringify({ title, status: task.status }))
  await logActivity({ entityType: 'task', entityId: task.id, actorId: ctx.userId, action: 'created', newValue: task.title })

  const { data: full } = await adminClient
    .from('tasks')
    .select('*, task_assignees(user_id), companies(id, name), clients(id, company_id)')
    .eq('id', task.id)
    .single()

  return Response.json(full, { status: 201 })
}

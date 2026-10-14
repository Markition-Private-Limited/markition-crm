import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logFieldChanges } from '@/lib/activity'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('companies')
    .select(`*, company_service_categories(service_category_id, service_categories(id, name)), contacts(count), prospects(count), tasks(count)`)
    .eq('id', id)
    .single()

  if (dbErr || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { name, industry, website, phone, address } = body

  const { data: before } = await adminClient.from('companies').select('name,industry,website,phone,address').eq('id', id).single()

  const { data, error: dbErr } = await adminClient
    .from('companies')
    .update({ name, industry, website, phone, address })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  if (before) await logFieldChanges({ entityType: 'company', entityId: id, actorId: ctx.userId, before, after: { name, industry, website, phone, address } })
  return Response.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  const { id } = await params
  const { error: dbErr } = await adminClient
    .from('companies')
    .delete()
    .eq('id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('company_service_categories')
    .select('service_category_id, service_categories(id, name, description)')
    .eq('company_id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { service_category_id } = body
  if (!service_category_id) return Response.json({ error: 'service_category_id is required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('company_service_categories')
    .insert({ company_id: id, service_category_id })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { service_category_id } = body
  if (!service_category_id) return Response.json({ error: 'service_category_id is required' }, { status: 400 })

  const { error: dbErr } = await adminClient
    .from('company_service_categories')
    .delete()
    .eq('company_id', id)
    .eq('service_category_id', service_category_id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

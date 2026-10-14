import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { name, description } = body

  const { data, error: dbErr } = await adminClient
    .from('service_categories')
    .update({ name, description })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
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
    .from('service_categories')
    .delete()
    .eq('id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

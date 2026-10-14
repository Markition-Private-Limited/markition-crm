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
    .from('contacts')
    .select('*')
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
  const { first_name, last_name, email, phone, title, is_primary, company_id } = body

  if (is_primary && company_id) {
    await adminClient
      .from('contacts')
      .update({ is_primary: false })
      .eq('company_id', company_id)
      .eq('is_primary', true)
      .neq('id', id)
  }

  const update: Record<string, unknown> = {}
  if (first_name !== undefined) update.first_name = first_name
  if (last_name !== undefined) update.last_name = last_name
  if (email !== undefined) update.email = email
  if (phone !== undefined) update.phone = phone
  if (title !== undefined) update.title = title
  if (is_primary !== undefined) update.is_primary = is_primary

  const { data, error: dbErr } = await adminClient
    .from('contacts')
    .update(update)
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
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const { id } = await params
  const { error: dbErr } = await adminClient.from('contacts').delete().eq('id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

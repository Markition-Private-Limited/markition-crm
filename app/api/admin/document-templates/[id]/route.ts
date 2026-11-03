import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/** PATCH /api/admin/document-templates/[id] */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, description, customer_type, jurisdiction, is_mandatory, is_active, sort_order } =
    body as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = (name as string).trim()
  if (description !== undefined) patch.description = description || null
  if (customer_type !== undefined) patch.customer_type = customer_type || null
  if (jurisdiction !== undefined) patch.jurisdiction = jurisdiction || null
  if (is_mandatory !== undefined) patch.is_mandatory = Boolean(is_mandatory)
  if (is_active !== undefined) patch.is_active = Boolean(is_active)
  if (sort_order !== undefined) patch.sort_order = Number(sort_order)

  const { data, error: dbErr } = await adminClient
    .from('document_requirement_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

/** DELETE /api/admin/document-templates/[id] — soft-delete (sets is_active=false) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data, error: dbErr } = await adminClient
    .from('document_requirement_templates')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return new Response(null, { status: 204 })
}

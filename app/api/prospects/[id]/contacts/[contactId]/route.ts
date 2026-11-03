import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

/** PUT /api/prospects/[id]/contacts/[contactId] */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive'])
  if (error) return error

  const { id, contactId } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.name      !== undefined) update.name      = body.name.trim()
  if (body.job_title !== undefined) update.job_title  = body.job_title
  if (body.email     !== undefined) update.email      = body.email?.trim() || null
  if (body.phone     !== undefined) update.phone      = body.phone
  if (body.whatsapp  !== undefined) update.whatsapp   = body.whatsapp

  // Setting as primary: clear existing primary first
  if (body.is_primary === true) {
    await adminClient
      .from('prospect_contacts')
      .update({ is_primary: false })
      .eq('prospect_id', id)
      .eq('is_primary', true)
    update.is_primary = true
  } else if (body.is_primary === false) {
    update.is_primary = false
  }

  if (Object.keys(update).length === 0)
    return Response.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('prospect_contacts')
    .update(update)
    .eq('id', contactId)
    .eq('prospect_id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data)  return Response.json({ error: 'Not found' },  { status: 404 })
  return Response.json(data)
}

/** DELETE /api/prospects/[id]/contacts/[contactId] */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive'])
  if (error) return error

  const { id, contactId } = await params
  const { error: dbErr } = await adminClient
    .from('prospect_contacts')
    .delete()
    .eq('id', contactId)
    .eq('prospect_id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

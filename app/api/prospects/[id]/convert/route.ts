import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireRole(request, ['admin', 'sales'])
  if (error) return error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { title, notes, assigned_to } = body

  const { data: prospect, error: fetchErr } = await adminClient
    .from('prospects')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !prospect) return Response.json({ error: 'Prospect not found' }, { status: 404 })
  if (prospect.status === 'converted')
    return Response.json({ error: 'Prospect already converted' }, { status: 409 })

  const { data: lead, error: leadErr } = await adminClient
    .from('leads')
    .insert({
      company_id: prospect.company_id,
      source_prospect_id: prospect.id,
      title: title || `Lead from prospect ${prospect.id.slice(0, 8)}`,
      notes: notes || prospect.notes,
      status: 'first_contact',
      assigned_to: assigned_to ?? null,
    })
    .select()
    .single()

  if (leadErr) return Response.json({ error: leadErr.message }, { status: 400 })

  await adminClient.from('prospects').update({ status: 'converted' }).eq('id', id)
  await logActivity({ entityType: 'prospect', entityId: id, actorId: ctx.userId, action: 'converted', newValue: lead.id })
  await logActivity({ entityType: 'lead', entityId: lead.id, actorId: ctx.userId, action: 'created', newValue: lead.title })

  return Response.json({ lead, prospect: { ...prospect, status: 'converted' } }, { status: 201 })
}

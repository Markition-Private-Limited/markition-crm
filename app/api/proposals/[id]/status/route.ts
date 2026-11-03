import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

const VALID_STATUSES = [
  'internal_review',
  'proposal_sent',
  'client_reviewing',
  'negotiation',
  'won',
  'lost',
] as const

/** POST /api/proposals/[id]/status */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status, note } = body

  if (!status || !VALID_STATUSES.includes(status)) {
    return Response.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: proposal, error: fetchErr } = await adminClient
    .from('proposals')
    .select('id, status, owner_id')
    .eq('id', id)
    .single()

  if (fetchErr || !proposal) return Response.json({ error: 'Not found' }, { status: 404 })

  const prop = proposal as Record<string, unknown>
  if (ctx.role === 'bd_executive' && prop.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fromStatus = prop.status as string

  const { data: updated, error: updateErr } = await adminClient
    .from('proposals')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 400 })

  await adminClient.from('proposal_status_history').insert({
    proposal_id: id,
    from_status: fromStatus,
    to_status:   status,
    changed_by:  ctx.userId,
    note:        note ?? null,
  })

  return Response.json(updated)
}

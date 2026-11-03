import { adminClient } from '@/lib/supabase/admin'
import { requireAuth, AuthContext } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'

function canAccess(ctx: AuthContext, proposal: Record<string, unknown>): boolean {
  if (ctx.role === 'super_admin' || ctx.role === 'admin') return true
  if (ctx.role === 'bd_executive') return proposal.owner_id === ctx.userId
  return true // bd_manager — server already scopes; fine to allow here
}

async function fetchProposal(id: string) {
  const { data, error } = await adminClient
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()
  return { proposal: data as Record<string, unknown> | null, error }
}

/** GET /api/proposals/[id] */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { proposal, error: dbErr } = await fetchProposal(id)
  if (dbErr || !proposal) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!canAccess(ctx, proposal)) return Response.json({ error: 'Forbidden' }, { status: 403 })
  return Response.json(proposal)
}

/** PATCH /api/proposals/[id]
 *  If amount, validity_days, or remarks change → create a new revision.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { proposal, error: fetchErr } = await fetchProposal(id)
  if (fetchErr || !proposal) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!canAccess(ctx, proposal)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, amount, currency, validity_days, expected_close_date, remarks } = body

  const termChanged =
    (amount !== undefined && Number(amount) !== Number(proposal.amount)) ||
    (validity_days !== undefined && Number(validity_days) !== Number(proposal.validity_days)) ||
    (remarks !== undefined && remarks !== proposal.remarks)

  const patch: Record<string, unknown> = {}
  if (title !== undefined)               patch.title               = title
  if (amount !== undefined)              patch.amount              = Number(amount)
  if (currency !== undefined)            patch.currency            = currency
  if (validity_days !== undefined)       patch.validity_days       = Number(validity_days)
  if (expected_close_date !== undefined) patch.expected_close_date = expected_close_date
  if (remarks !== undefined)             patch.remarks             = remarks

  const { data: updated, error: updateErr } = await adminClient
    .from('proposals')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 400 })

  if (termChanged) {
    // Get next revision number
    const { data: lastRev } = await adminClient
      .from('proposal_revisions')
      .select('revision_number')
      .eq('proposal_id', id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .single()

    const nextRev = ((lastRev as Record<string, unknown> | null)?.revision_number as number ?? 0) + 1
    const up = updated as Record<string, unknown>
    await adminClient.from('proposal_revisions').insert({
      proposal_id:     id,
      revision_number: nextRev,
      amount:          up.amount,
      currency:        up.currency,
      validity_days:   up.validity_days,
      notes:           up.remarks ?? null,
      created_by:      ctx.userId,
    })
  }

  return Response.json(updated)
}

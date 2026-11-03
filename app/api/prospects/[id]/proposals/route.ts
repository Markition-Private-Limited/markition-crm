import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'

/** GET /api/prospects/[id]/proposals */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId } = await params

  let query = adminClient
    .from('proposals')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })

  if (ctx.role === 'bd_executive') {
    query = query.eq('owner_id', ctx.userId)
  } else if (ctx.role === 'bd_manager') {
    const teamIds = await getTeamMemberIds(ctx.userId)
    query = query.in('owner_id', [ctx.userId, ...teamIds])
  }

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data ?? [])
}

/** POST /api/prospects/[id]/proposals */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId } = await params
  const body = await request.json()
  const { title, amount, currency, validity_days, submitted_at, expected_close_date, remarks } = body

  if (!title) return Response.json({ error: 'title is required' }, { status: 400 })
  if (amount === undefined || amount === null) return Response.json({ error: 'amount is required' }, { status: 400 })

  // Verify prospect exists
  const { data: prospect } = await adminClient
    .from('prospects')
    .select('id')
    .eq('id', prospectId)
    .single()
  if (!prospect) return Response.json({ error: 'Prospect not found' }, { status: 404 })

  const { data: proposal, error: dbErr } = await adminClient
    .from('proposals')
    .insert({
      prospect_id:          prospectId,
      owner_id:             ctx.userId,
      title,
      amount:               Number(amount),
      currency:             currency ?? 'USD',
      validity_days:        validity_days ?? 30,
      submitted_at:         submitted_at ?? new Date().toISOString(),
      expected_close_date:  expected_close_date ?? null,
      status:               'internal_review',
      approval_status:      'pending',
      remarks:              remarks ?? null,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  const prop = proposal as Record<string, unknown>

  // Create initial revision (revision 1)
  await adminClient.from('proposal_revisions').insert({
    proposal_id:     prop.id,
    revision_number: 1,
    amount:          prop.amount,
    currency:        prop.currency,
    validity_days:   prop.validity_days,
    notes:           remarks ?? null,
    created_by:      ctx.userId,
  })

  // Record initial status in history
  await adminClient.from('proposal_status_history').insert({
    proposal_id: prop.id,
    from_status: null,
    to_status:   'internal_review',
    changed_by:  ctx.userId,
    note:        'Proposal created',
  })

  return Response.json(prop, { status: 201 })
}

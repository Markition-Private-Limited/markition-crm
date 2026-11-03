import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'
import { computeActivityStatus } from '@/lib/activity-status'

async function enrichActivities(rows: Record<string, unknown>[]) {
  if (!rows.length) return []
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[]
  const { data: profiles } = ownerIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', ownerIds)
    : { data: [] }
  const profileById: Record<string, { full_name: string; email: string }> = {}
  for (const p of profiles ?? []) profileById[(p as { id: string }).id] = p as { full_name: string; email: string }
  return rows.map((r) => ({
    ...r,
    status: computeActivityStatus(r.follow_up_at as string | null, r.completed_at as string | null),
    owner: r.owner_id ? (profileById[r.owner_id as string] ?? null) : null,
  }))
}

/** GET /api/prospects/[id]/activities */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  let query = adminClient
    .from('prospect_activities')
    .select('*')
    .eq('prospect_id', id)
    .order('occurred_at', { ascending: false })

  if (ctx.role === 'bd_executive') {
    query = query.eq('owner_id', ctx.userId)
  } else if (ctx.role === 'bd_manager') {
    const teamIds = await getTeamMemberIds(ctx.userId)
    query = query.in('owner_id', [ctx.userId, ...teamIds])
  }

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  const enriched = await enrichActivities((data ?? []) as Record<string, unknown>[])
  return Response.json(enriched)
}

/** POST /api/prospects/[id]/activities */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { type, occurred_at, description, outcome, next_action, follow_up_at } = body

  if (!type) return Response.json({ error: 'type is required' }, { status: 400 })
  const VALID_TYPES = ['call', 'email', 'whatsapp', 'meeting', 'other']
  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }

  const { data, error: dbErr } = await adminClient
    .from('prospect_activities')
    .insert({
      prospect_id:  id,
      owner_id:     ctx.userId,
      type,
      occurred_at:  occurred_at ?? new Date().toISOString(),
      description:  description  ?? null,
      outcome:      outcome       ?? null,
      next_action:  next_action   ?? null,
      follow_up_at: follow_up_at  ?? null,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  const enriched = await enrichActivities([(data as unknown as Record<string, unknown>)])
  return Response.json(enriched[0], { status: 201 })
}

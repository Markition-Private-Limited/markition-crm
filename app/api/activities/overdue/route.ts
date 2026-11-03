import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'
import { computeActivityStatus } from '@/lib/activity-status'

/** GET /api/activities/overdue
 *  Returns activities that are Overdue or Due Today for the current user.
 *  BD Executive: own only. BD Manager: own + team. Admin/Super: all.
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  let query = adminClient
    .from('prospect_activities')
    .select(`
      id, prospect_id, owner_id, type, occurred_at, description, outcome,
      next_action, follow_up_at, completed_at, created_at,
      prospects(id, company_name, prospect_code)
    `)
    .lte('follow_up_at', now)         // follow_up is now or in the past
    .is('completed_at', null)         // not yet completed
    .not('follow_up_at', 'is', null)  // has a follow-up date
    .order('follow_up_at', { ascending: true })

  if (ctx.role === 'bd_executive') {
    query = query.eq('owner_id', ctx.userId)
  } else if (ctx.role === 'bd_manager') {
    const teamIds = await getTeamMemberIds(ctx.userId)
    query = query.in('owner_id', [ctx.userId, ...teamIds])
  }

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  const enriched = (data ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    status: computeActivityStatus(
      (r as Record<string, unknown>).follow_up_at as string | null,
      (r as Record<string, unknown>).completed_at as string | null,
    ),
  }))

  return Response.json(enriched)
}

import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { computeActivityStatus } from '@/lib/activity-status'

/** POST /api/prospects/[id]/activities/[activityId]/complete
 *  Marks the activity complete. Never deletes the original record.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId, activityId } = await params

  // Fetch the activity first to check ownership
  const { data: existing, error: fetchErr } = await adminClient
    .from('prospect_activities')
    .select('*')
    .eq('id', activityId)
    .eq('prospect_id', prospectId)
    .single()

  if (fetchErr || !existing) return Response.json({ error: 'Activity not found' }, { status: 404 })

  const act = existing as Record<string, unknown>

  // BD Executive can only complete their own activities
  if (ctx.role === 'bd_executive' && act.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (act.completed_at) {
    return Response.json({ error: 'Activity is already completed' }, { status: 409 })
  }

  const { data, error: updateErr } = await adminClient
    .from('prospect_activities')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', activityId)
    .select()
    .single()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  const updated = data as unknown as Record<string, unknown>
  return Response.json({
    ...updated,
    status: computeActivityStatus(updated.follow_up_at as string | null, updated.completed_at as string | null),
  })
}

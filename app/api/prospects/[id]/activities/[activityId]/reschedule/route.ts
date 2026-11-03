import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { computeActivityStatus } from '@/lib/activity-status'

/** POST /api/prospects/[id]/activities/[activityId]/reschedule
 *  Creates a NEW linked activity (referencing the original as parent).
 *  Never overwrites the original follow_up_at — preserves the full reschedule trail.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId, activityId } = await params
  const body = await request.json()
  const { follow_up_at, description, next_action } = body

  if (!follow_up_at) return Response.json({ error: 'follow_up_at is required' }, { status: 400 })

  // Fetch original to validate ownership and existence
  const { data: original, error: fetchErr } = await adminClient
    .from('prospect_activities')
    .select('*')
    .eq('id', activityId)
    .eq('prospect_id', prospectId)
    .single()

  if (fetchErr || !original) return Response.json({ error: 'Activity not found' }, { status: 404 })

  const orig = original as unknown as Record<string, unknown>

  if (ctx.role === 'bd_executive' && orig.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Create a new activity inheriting type and linking to the parent
  const { data: newAct, error: insertErr } = await adminClient
    .from('prospect_activities')
    .insert({
      prospect_id:        prospectId,
      owner_id:           ctx.userId,
      type:               orig.type,
      occurred_at:        new Date().toISOString(),
      description:        description  ?? orig.description ?? null,
      outcome:            null,
      next_action:        next_action  ?? orig.next_action ?? null,
      follow_up_at,
      parent_activity_id: activityId,
    })
    .select()
    .single()

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 400 })

  const created = newAct as unknown as Record<string, unknown>
  return Response.json({
    ...created,
    status: computeActivityStatus(created.follow_up_at as string | null, created.completed_at as string | null),
  }, { status: 201 })
}

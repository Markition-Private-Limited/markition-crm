import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

// Allow up to 10 minutes short of full shift and still mark as completed
const COMPLETION_GRACE_MINUTES = 10

function computeShiftCompleted(
  checkInAt: Date,
  checkOutAt: Date,
  startTime: string,
  endTime: string,
): boolean {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const shiftDurationMinutes = eh * 60 + em - (sh * 60 + sm)
  const workedMinutes = (checkOutAt.getTime() - checkInAt.getTime()) / 60_000
  return workedMinutes >= shiftDurationMinutes - COMPLETION_GRACE_MINUTES
}

// ── POST /api/attendance/check-out ────────────────────────────
// Employee checks out. Requires a prior check-in today.
// Returns 400 if no check-in, 409 if already checked out.
export async function POST(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // 1. Require an existing check-in today
  const { data: record, error: recErr } = await adminClient
    .from('attendance_records')
    .select('id, check_in_at, check_out_at')
    .eq('profile_id', ctx.userId)
    .eq('work_date', todayStr)
    .maybeSingle()

  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })
  if (!record?.check_in_at) {
    return Response.json({ error: 'You have not checked in today.' }, { status: 400 })
  }
  if (record.check_out_at) {
    return Response.json({ error: 'Already checked out today.' }, { status: 409 })
  }

  // 2. Fetch active shift to compute shift_completed
  const { data: shift, error: shiftErr } = await adminClient
    .from('attendance_shifts')
    .select('start_time, end_time')
    .eq('profile_id', ctx.userId)
    .is('effective_to', null)
    .maybeSingle()

  if (shiftErr) return Response.json({ error: shiftErr.message }, { status: 500 })

  const checkOutAt = now.toISOString()
  const shiftCompleted = shift
    ? computeShiftCompleted(new Date(record.check_in_at), now, shift.start_time, shift.end_time)
    : null

  // 3. Update with extra guard to prevent race conditions
  const { data: updated, error: updateErr } = await adminClient
    .from('attendance_records')
    .update({ check_out_at: checkOutAt, shift_completed: shiftCompleted })
    .eq('id', record.id)
    .is('check_out_at', null)
    .select()
    .maybeSingle()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  if (!updated) {
    return Response.json({ error: 'Already checked out today.' }, { status: 409 })
  }

  return Response.json(updated)
}

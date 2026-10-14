import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/today ─────────────────────────────────
// Returns the authenticated employee's attendance record for today
// plus their current active shift. Useful for the check-in/check-out UI.
//
// Response shape:
//   { record: AttendanceRecord | null, shift: Shift | null, state: "not_checked_in" | "checked_in" | "checked_out" }
export async function GET(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const todayStr = new Date().toISOString().split('T')[0]

  const [{ data: record, error: recErr }, { data: shift, error: shiftErr }] = await Promise.all([
    adminClient
      .from('attendance_records')
      .select('id, profile_id, work_date, status, check_in_at, check_out_at, punctuality, shift_completed, created_at, updated_at')
      .eq('profile_id', ctx.userId)
      .eq('work_date', todayStr)
      .maybeSingle(),
    adminClient
      .from('attendance_shifts')
      .select('id, start_time, end_time, effective_from')
      .eq('profile_id', ctx.userId)
      .is('effective_to', null)
      .maybeSingle(),
  ])

  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })
  if (shiftErr) return Response.json({ error: shiftErr.message }, { status: 500 })

  const state = !record?.check_in_at
    ? 'not_checked_in'
    : record.check_out_at
      ? 'checked_out'
      : 'checked_in'

  return Response.json({ record: record ?? null, shift: shift ?? null, state })
}

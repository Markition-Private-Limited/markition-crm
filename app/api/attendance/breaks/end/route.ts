import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

const ALLOWED_MINUTES: Record<string, number> = {
  long_break:  40,
  short_break: 10,
}

// ── POST /api/attendance/breaks/end ───────────────────────────
// Ends the employee's currently open break.
// Over-allowance breaks are allowed but flagged (not blocked).
// Errors: 400 if no active check-in or no open break.
export async function POST(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const todayStr = new Date().toISOString().split('T')[0]

  // 1. Get today's attendance record
  const { data: record, error: recErr } = await adminClient
    .from('attendance_records')
    .select('id, check_in_at')
    .eq('profile_id', ctx.userId)
    .eq('work_date', todayStr)
    .maybeSingle()

  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })
  if (!record?.check_in_at) {
    return Response.json({ error: 'No active check-in session found for today.' }, { status: 400 })
  }

  // 2. Find the open break
  const { data: openBreak, error: openErr } = await adminClient
    .from('attendance_breaks')
    .select('id, break_type, started_at')
    .eq('attendance_record_id', record.id)
    .is('ended_at', null)
    .maybeSingle()

  if (openErr) return Response.json({ error: openErr.message }, { status: 500 })
  if (!openBreak) {
    return Response.json({ error: 'No active break to end.' }, { status: 400 })
  }

  const now = new Date()
  const endedAt = now.toISOString()
  const actualMinutes = (now.getTime() - new Date(openBreak.started_at).getTime()) / 60_000
  const allowedMinutes = ALLOWED_MINUTES[openBreak.break_type] ?? Infinity
  const exceeded_allowance = actualMinutes > allowedMinutes

  // 3. Close the break (duration_minutes is GENERATED ALWAYS — do not include it)
  const { data: updated, error: updateErr } = await adminClient
    .from('attendance_breaks')
    .update({ ended_at: endedAt, exceeded_allowance })
    .eq('id', openBreak.id)
    .is('ended_at', null) // race-safe guard
    .select('id, attendance_record_id, break_type, started_at, ended_at, duration_minutes, exceeded_allowance')
    .maybeSingle()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  if (!updated) {
    return Response.json({ error: 'Break was already ended.' }, { status: 409 })
  }

  return Response.json({
    break: updated,
    exceeded_allowance,
    ...(exceeded_allowance && {
      warning: `Break exceeded the allowed ${allowedMinutes}-minute limit by ${Math.round(actualMinutes - allowedMinutes)} minute(s).`,
    }),
  })
}

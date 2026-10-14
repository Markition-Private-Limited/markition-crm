import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/breaks/today ──────────────────────────
// Returns the employee's break usage for today:
//   - all breaks taken (completed + open)
//   - per-type usage summary with remaining allowance
//   - whether a break is currently open
//
// Response shape:
//   {
//     breaks: Break[],
//     open_break: Break | null,
//     usage: {
//       long_break:  { used: number, limit: 1,  can_start: boolean },
//       short_break: { used: number, limit: 2, can_start: boolean },
//     }
//   }
export async function GET(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const todayStr = new Date().toISOString().split('T')[0]

  // Get today's attendance record
  const { data: record, error: recErr } = await adminClient
    .from('attendance_records')
    .select('id, check_in_at, check_out_at')
    .eq('profile_id', ctx.userId)
    .eq('work_date', todayStr)
    .maybeSingle()

  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })

  if (!record?.check_in_at) {
    return Response.json({
      breaks: [],
      open_break: null,
      usage: {
        long_break:  { used: 0, limit: 1, can_start: false },
        short_break: { used: 0, limit: 2, can_start: false },
      },
      note: 'Not checked in today.',
    })
  }

  const { data: breaks, error: breakErr } = await adminClient
    .from('attendance_breaks')
    .select('id, break_type, started_at, ended_at, duration_minutes, exceeded_allowance')
    .eq('attendance_record_id', record.id)
    .order('started_at', { ascending: true })

  if (breakErr) return Response.json({ error: breakErr.message }, { status: 500 })

  const all = breaks ?? []
  const openBreak = all.find((b) => !b.ended_at) ?? null
  const isSessionActive = !!record.check_in_at && !record.check_out_at

  // Count only completed breaks toward the cap
  const completedLong  = all.filter((b) => b.break_type === 'long_break'  && b.ended_at).length
  const completedShort = all.filter((b) => b.break_type === 'short_break' && b.ended_at).length

  return Response.json({
    breaks: all,
    open_break: openBreak,
    usage: {
      long_break: {
        used: completedLong,
        limit: 1,
        can_start: isSessionActive && !openBreak && completedLong < 1,
      },
      short_break: {
        used: completedShort,
        limit: 2,
        can_start: isSessionActive && !openBreak && completedShort < 2,
      },
    },
  })
}

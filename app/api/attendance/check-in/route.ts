import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

// Minutes before/after shift start that still counts as "on_time"
const GRACE_MINUTES = 5

function computePunctuality(
  checkInAt: Date,
  shiftStartTime: string,
): 'early' | 'on_time' | 'late' {
  const [h, m] = shiftStartTime.split(':').map(Number)
  const shiftStartMinutes = h * 60 + m
  const checkInMinutes = checkInAt.getUTCHours() * 60 + checkInAt.getUTCMinutes()
  const diff = checkInMinutes - shiftStartMinutes
  if (diff < -GRACE_MINUTES) return 'early'
  if (diff <= GRACE_MINUTES) return 'on_time'
  return 'late'
}

// ── POST /api/attendance/check-in ─────────────────────────────
// Employee checks in for today. Requires an active shift.
// Returns 400 if no shift assigned, 409 if already checked in.
export async function POST(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // 1. Require an active shift
  const { data: shift, error: shiftErr } = await adminClient
    .from('attendance_shifts')
    .select('id, start_time, end_time, effective_from')
    .eq('profile_id', ctx.userId)
    .is('effective_to', null)
    .maybeSingle()

  if (shiftErr) return Response.json({ error: shiftErr.message }, { status: 500 })
  if (!shift) {
    return Response.json(
      { error: 'No shift assigned. Please contact your admin to assign a shift before checking in.' },
      { status: 400 },
    )
  }

  // 2. Check for an existing record today
  const { data: existing, error: existErr } = await adminClient
    .from('attendance_records')
    .select('id, check_in_at, check_out_at')
    .eq('profile_id', ctx.userId)
    .eq('work_date', todayStr)
    .maybeSingle()

  if (existErr) return Response.json({ error: existErr.message }, { status: 500 })
  if (existing?.check_in_at) {
    return Response.json({ error: 'Already checked in today.' }, { status: 409 })
  }

  const punctuality = computePunctuality(now, shift.start_time)
  const checkInAt = now.toISOString()

  let record
  if (!existing) {
    // No record yet — insert
    const { data, error } = await adminClient
      .from('attendance_records')
      .insert({
        profile_id: ctx.userId,
        work_date: todayStr,
        status: 'present',
        check_in_at: checkInAt,
        punctuality,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: 'Already checked in today.' }, { status: 409 })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }
    record = data
  } else {
    // Record exists but no check_in_at — update (extra IS NULL guard prevents races)
    const { data, error } = await adminClient
      .from('attendance_records')
      .update({ check_in_at: checkInAt, punctuality, status: 'present' })
      .eq('id', existing.id)
      .is('check_in_at', null)
      .select()
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) {
      return Response.json({ error: 'Already checked in today.' }, { status: 409 })
    }
    record = data
  }

  return Response.json({ record, shift }, { status: 201 })
}

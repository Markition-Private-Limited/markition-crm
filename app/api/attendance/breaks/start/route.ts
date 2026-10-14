import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

const BREAK_LIMITS: Record<string, { max_count: number; max_minutes: number }> = {
  long_break:  { max_count: 1, max_minutes: 40 },
  short_break: { max_count: 2, max_minutes: 10 },
}

// ── POST /api/attendance/breaks/start ─────────────────────────
// Body: { break_type: "long_break" | "short_break" }
//
// Errors:
//   400  not checked in, already checked out, invalid break_type
//   409  already have an open break, or daily cap exhausted for this type
export async function POST(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const body = await request.json().catch(() => ({}))
  const { break_type } = body as { break_type?: string }

  if (!break_type || !BREAK_LIMITS[break_type]) {
    return Response.json(
      { error: 'break_type must be "long_break" or "short_break".' },
      { status: 400 },
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // 1. Require an active check-in session (checked in, NOT checked out)
  const { data: record, error: recErr } = await adminClient
    .from('attendance_records')
    .select('id, check_in_at, check_out_at')
    .eq('profile_id', ctx.userId)
    .eq('work_date', todayStr)
    .maybeSingle()

  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })
  if (!record?.check_in_at) {
    return Response.json({ error: 'You must be checked in before starting a break.' }, { status: 400 })
  }
  if (record.check_out_at) {
    return Response.json({ error: 'Cannot start a break after checking out.' }, { status: 400 })
  }

  // 2. Reject if there is already an open break (ended_at IS NULL)
  const { data: openBreak, error: openErr } = await adminClient
    .from('attendance_breaks')
    .select('id, break_type, started_at')
    .eq('attendance_record_id', record.id)
    .is('ended_at', null)
    .maybeSingle()

  if (openErr) return Response.json({ error: openErr.message }, { status: 500 })
  if (openBreak) {
    return Response.json(
      { error: `You already have an open ${openBreak.break_type.replace('_', ' ')} in progress.` },
      { status: 409 },
    )
  }

  // 3. Enforce daily cap for this break_type
  const { data: todayBreaks, error: capErr } = await adminClient
    .from('attendance_breaks')
    .select('id, break_type')
    .eq('attendance_record_id', record.id)
    .eq('break_type', break_type)
    .not('ended_at', 'is', null) // count only completed breaks against the cap

  if (capErr) return Response.json({ error: capErr.message }, { status: 500 })

  const used = todayBreaks?.length ?? 0
  const { max_count, max_minutes } = BREAK_LIMITS[break_type]

  if (used >= max_count) {
    const label = break_type === 'long_break' ? 'long break (40 min)' : 'short break (10 min)'
    const limitWord = max_count === 1 ? 'once' : `${max_count} times`
    return Response.json(
      { error: `Daily ${label} limit reached. You may only take it ${limitWord} per day.` },
      { status: 409 },
    )
  }

  // 4. Insert the break
  const { data: breakRecord, error: insertErr } = await adminClient
    .from('attendance_breaks')
    .insert({
      attendance_record_id: record.id,
      break_type,
      started_at: new Date().toISOString(),
    })
    .select('id, attendance_record_id, break_type, started_at, ended_at, exceeded_allowance')
    .single()

  if (insertErr) {
    // Unique partial index on (attendance_record_id) WHERE ended_at IS NULL
    if (insertErr.code === '23505') {
      return Response.json({ error: 'You already have an open break in progress.' }, { status: 409 })
    }
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  return Response.json(
    { break: breakRecord, remaining: max_count - used - 1, max_minutes },
    { status: 201 },
  )
}

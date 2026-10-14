import { adminClient } from '@/lib/supabase/admin'
import { requireRole, getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/shifts ────────────────────────────────
// Admin: list all profiles with their currently active shift.
// An employee with no shift has current_shift: null.
export async function GET(request: Request) {
  const { error } = await requireRole(request, ['admin'])
  if (error) return error

  const [{ data: profiles, error: pErr }, { data: staffProfiles, error: spErr }, { data: activeShifts, error: sErr }] =
    await Promise.all([
      adminClient.from('profiles').select('id, full_name, email').order('full_name'),
      adminClient.from('attendance_staff_profiles').select('profile_id, employee_code, is_wfh_eligible, attendance_enabled'),
      adminClient
        .from('attendance_shifts')
        .select('id, profile_id, start_time, end_time, effective_from, created_by, created_at')
        .is('effective_to', null),
    ])

  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })
  if (spErr) return Response.json({ error: spErr.message }, { status: 500 })
  if (sErr) return Response.json({ error: sErr.message }, { status: 500 })

  const staffMap = new Map((staffProfiles ?? []).map((s) => [s.profile_id, s]))
  const shiftMap = new Map((activeShifts ?? []).map((s) => [s.profile_id, s]))

  const result = (profiles ?? []).map((p) => ({
    ...p,
    staff_profile: staffMap.get(p.id) ?? null,
    current_shift: shiftMap.get(p.id) ?? null,
  }))

  return Response.json(result)
}

// ── POST /api/attendance/shifts ───────────────────────────────
// Admin: assign a new shift to an employee, or change their current one.
// When a current open shift exists, it is closed (effective_to set to
// effectiveFrom - 1 day) before the new one is inserted, preserving history.
export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  let body: { profile_id?: string; start_time?: string; end_time?: string; effective_from?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { profile_id, start_time, end_time, effective_from } = body

  if (!profile_id) return Response.json({ error: 'profile_id is required' }, { status: 400 })
  if (!start_time) return Response.json({ error: 'start_time is required' }, { status: 400 })
  if (!end_time) return Response.json({ error: 'end_time is required' }, { status: 400 })
  if (start_time === end_time) return Response.json({ error: 'start_time and end_time cannot be the same' }, { status: 400 })

  // Default effective_from to today if not provided
  const effectiveFrom = effective_from ?? new Date().toISOString().split('T')[0]

  // Validate the target profile exists
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', profile_id)
    .maybeSingle()
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })
  if (!profile) return Response.json({ error: 'Employee not found' }, { status: 404 })

  // Ensure attendance_staff_profiles row exists (create with defaults if missing)
  const { error: upsertErr } = await adminClient
    .from('attendance_staff_profiles')
    .upsert({ profile_id }, { onConflict: 'profile_id' })
  if (upsertErr) return Response.json({ error: upsertErr.message }, { status: 500 })

  // Find the current open-ended shift for this employee
  const { data: openShift, error: openErr } = await adminClient
    .from('attendance_shifts')
    .select('id, start_time, end_time, effective_from')
    .eq('profile_id', profile_id)
    .is('effective_to', null)
    .maybeSingle()
  if (openErr) return Response.json({ error: openErr.message }, { status: 500 })

  if (openShift) {
    // The new shift must start strictly after the current shift's start date so
    // the closing date (effectiveFrom - 1) doesn't precede the shift's own start.
    if (effectiveFrom <= openShift.effective_from) {
      return Response.json(
        {
          error: `New shift effective date (${effectiveFrom}) must be after the current shift's start date (${openShift.effective_from}). To replace a same-day shift, set effective_from to tomorrow or later.`,
        },
        { status: 400 },
      )
    }

    // Close the current shift: last day = day before new shift starts
    const closingDate = new Date(effectiveFrom)
    closingDate.setDate(closingDate.getDate() - 1)
    const closingDateStr = closingDate.toISOString().split('T')[0]

    const { error: closeErr } = await adminClient
      .from('attendance_shifts')
      .update({ effective_to: closingDateStr })
      .eq('id', openShift.id)
    if (closeErr) return Response.json({ error: closeErr.message }, { status: 500 })
  }

  // Insert the new shift — trigger will write changelog automatically
  const { data: newShift, error: insertErr } = await adminClient
    .from('attendance_shifts')
    .insert({
      profile_id,
      start_time,
      end_time,
      effective_from: effectiveFrom,
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (insertErr) {
    // Unique partial index violation: a second open shift snuck in (race condition)
    if (insertErr.code === '23505') {
      return Response.json(
        { error: 'An active shift already exists for this employee. Please refresh and try again.' },
        { status: 409 },
      )
    }
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  return Response.json(newShift, { status: 201 })
}

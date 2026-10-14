import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

// ── GET /api/attendance/calendar ──────────────────────────────
// Admin only. Returns per-employee, per-day attendance status
// assembled from attendance_records, attendance_breaks, and
// attendance_wfh_submissions in a single response.
//
// Query params:
//   date_from   YYYY-MM-DD  (required)
//   date_to     YYYY-MM-DD  (required)
//   profile_id  UUID        (optional — single employee)
//
// Response: EmployeeCalendar[]
// Each day status:
//   present      — has attendance_record with check_in_at
//   wfh          — attendance_record.status = 'wfh'
//   pending_wfh  — no record but has a pending wfh_submission
//   absent       — past date with no record and no approved/pending WFH
//   null         — future date (not yet known)
export async function GET(request: Request) {
  const { error: authErr } = await requireRole(request, ['admin'])
  if (authErr) return authErr

  const url = new URL(request.url)
  const dateFrom      = url.searchParams.get('date_from')
  const dateTo        = url.searchParams.get('date_to')
  const profileIdFilter = url.searchParams.get('profile_id')

  if (!dateFrom || !dateTo) {
    return Response.json({ error: 'date_from and date_to are required.' }, { status: 400 })
  }

  // 1. Fetch attendance-enabled employees
  let profileQuery = adminClient
    .from('profiles')
    .select(`
      id, full_name, email,
      attendance_staff_profiles ( employee_code, attendance_enabled )
    `)
    .order('full_name')

  if (profileIdFilter) profileQuery = profileQuery.eq('id', profileIdFilter)

  const { data: profiles, error: pErr } = await profileQuery
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  // Keep only profiles that have been onboarded into attendance
  const attendanceProfiles = (profiles ?? []).filter(
    (p) => Array.isArray(p.attendance_staff_profiles)
      ? p.attendance_staff_profiles.length > 0
      : p.attendance_staff_profiles != null,
  )

  if (!attendanceProfiles.length) return Response.json([])

  const profileIds = attendanceProfiles.map((p) => p.id)

  // 2. Bulk-fetch attendance records, wfh submissions in date range
  const [recordsRes, wfhRes] = await Promise.all([
    adminClient
      .from('attendance_records')
      .select('id, profile_id, work_date, status, check_in_at, check_out_at, punctuality, shift_completed')
      .in('profile_id', profileIds)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo),
    adminClient
      .from('attendance_wfh_submissions')
      .select('id, profile_id, work_date, status, submitted_at, submitted_late, proof_text, proof_file_path, review_note')
      .in('profile_id', profileIds)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo),
  ])

  if (recordsRes.error) return Response.json({ error: recordsRes.error.message }, { status: 500 })
  if (wfhRes.error)     return Response.json({ error: wfhRes.error.message },     { status: 500 })

  // 3. Fetch breaks for the fetched records
  const recordIds = (recordsRes.data ?? []).map((r) => r.id)
  const breaksRes = recordIds.length
    ? await adminClient
        .from('attendance_breaks')
        .select('id, attendance_record_id, break_type, started_at, ended_at, duration_minutes, exceeded_allowance')
        .in('attendance_record_id', recordIds)
        .order('started_at')
    : { data: [], error: null }

  if (breaksRes.error) return Response.json({ error: breaksRes.error.message }, { status: 500 })

  // 4. Build lookup maps
  // record: profile_id + date → record row
  const recordMap = new Map<string, (typeof recordsRes.data)[number]>()
  for (const r of recordsRes.data ?? []) recordMap.set(`${r.profile_id}|${r.work_date}`, r)

  // breaks: record_id → breaks[]
  const breakMap = new Map<string, (typeof breaksRes.data)[number][]>()
  for (const b of breaksRes.data ?? []) {
    const list = breakMap.get(b.attendance_record_id) ?? []
    list.push(b)
    breakMap.set(b.attendance_record_id, list)
  }

  // wfh: profile_id + date → submission row
  const wfhMap = new Map<string, (typeof wfhRes.data)[number]>()
  for (const w of wfhRes.data ?? []) wfhMap.set(`${w.profile_id}|${w.work_date}`, w)

  // 5. Generate date range array
  const dates: string[] = []
  const cursor = new Date(`${dateFrom}T00:00:00Z`)
  const end    = new Date(`${dateTo}T00:00:00Z`)
  const todayStr = new Date().toISOString().split('T')[0]
  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // 6. Assemble per-employee calendars
  const result = attendanceProfiles.map((profile) => {
    const staffProfile = Array.isArray(profile.attendance_staff_profiles)
      ? profile.attendance_staff_profiles[0]
      : profile.attendance_staff_profiles

    const days: Record<string, unknown> = {}

    for (const date of dates) {
      const key = `${profile.id}|${date}`
      const record = recordMap.get(key) ?? null
      const wfh    = wfhMap.get(key) ?? null
      const isFuture = date > todayStr

      // Derive display status
      let status: string
      if (record) {
        status = record.status === 'wfh' ? 'wfh' : record.check_in_at ? 'present' : 'absent'
      } else if (isFuture) {
        status = 'future'
      } else if (wfh?.status === 'pending') {
        status = 'pending_wfh'
      } else {
        status = 'absent'
      }

      days[date] = {
        status,
        punctuality:     record?.punctuality     ?? null,
        check_in_at:     record?.check_in_at     ?? null,
        check_out_at:    record?.check_out_at    ?? null,
        shift_completed: record?.shift_completed ?? null,
        breaks:          record ? (breakMap.get(record.id) ?? []) : [],
        wfh_submission:  wfh,
      }
    }

    return {
      profile_id:    profile.id,
      full_name:     profile.full_name,
      email:         profile.email,
      employee_code: staffProfile?.employee_code ?? null,
      days,
    }
  })

  return Response.json(result)
}

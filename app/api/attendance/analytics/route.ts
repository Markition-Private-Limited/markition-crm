import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

function isWeekend(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.getUTCDay() === 0 || d.getUTCDay() === 6
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

// ── GET /api/attendance/analytics ─────────────────────────────
// Admin only. Returns aggregated stats + chart data for a date range.
//
// Query params:
//   date_from  YYYY-MM-DD  (required)
//   date_to    YYYY-MM-DD  (required)
//   profile_id UUID        (optional – single employee, defaults to all)
//
// Response:
//   summary         — team-wide stat cards
//   employees       — per-employee breakdown table rows
//   trend           — daily present/wfh/absent counts for the trend chart
//   late_by_employee — late count per employee for the bar chart
export async function GET(request: Request) {
  const { error: authErr } = await requireRole(request, ['admin'])
  if (authErr) return authErr

  const url = new URL(request.url)
  const dateFrom = url.searchParams.get('date_from')
  const dateTo   = url.searchParams.get('date_to')
  const profileIdFilter = url.searchParams.get('profile_id')

  if (!dateFrom || !dateTo) {
    return Response.json({ error: 'date_from and date_to are required.' }, { status: 400 })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // 1. Fetch attendance-enabled employees
  let profileQuery = adminClient
    .from('profiles')
    .select('id, full_name, attendance_staff_profiles(employee_code, attendance_enabled)')
    .order('full_name')
  if (profileIdFilter) profileQuery = profileQuery.eq('id', profileIdFilter)

  const { data: profiles, error: pErr } = await profileQuery
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  const attendanceProfiles = (profiles ?? []).filter((p) =>
    Array.isArray(p.attendance_staff_profiles)
      ? p.attendance_staff_profiles.length > 0
      : p.attendance_staff_profiles != null,
  )
  if (!attendanceProfiles.length) {
    return Response.json({ summary: emptySum(), employees: [], trend: [], late_by_employee: [] })
  }
  const profileIds = attendanceProfiles.map((p) => p.id)

  // 2. Bulk fetch records + breaks + wfh in range
  const [recRes, wfhRes] = await Promise.all([
    adminClient
      .from('attendance_records')
      .select('id, profile_id, work_date, status, check_in_at, punctuality, shift_completed')
      .in('profile_id', profileIds)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo),
    adminClient
      .from('attendance_wfh_submissions')
      .select('id, profile_id, work_date, status')
      .in('profile_id', profileIds)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo),
  ])
  if (recRes.error)  return Response.json({ error: recRes.error.message },  { status: 500 })
  if (wfhRes.error)  return Response.json({ error: wfhRes.error.message },  { status: 500 })

  const recordIds = (recRes.data ?? []).map((r) => r.id)
  const breakRes = recordIds.length
    ? await adminClient
        .from('attendance_breaks')
        .select('id, attendance_record_id, break_type, duration_minutes, exceeded_allowance')
        .in('attendance_record_id', recordIds)
    : { data: [], error: null }
  if (breakRes.error) return Response.json({ error: breakRes.error.message }, { status: 500 })

  // 3. Build lookup maps
  // record key: profile_id|date → record
  const recMap = new Map<string, typeof recRes.data[number]>()
  for (const r of recRes.data ?? []) recMap.set(`${r.profile_id}|${r.work_date}`, r)

  // wfh key: profile_id|date → submission
  const wfhMap = new Map<string, typeof wfhRes.data[number]>()
  for (const w of wfhRes.data ?? []) wfhMap.set(`${w.profile_id}|${w.work_date}`, w)

  // breaks by record_id
  const breakMap = new Map<string, typeof breakRes.data[number][]>()
  for (const b of breakRes.data ?? []) {
    const list = breakMap.get(b.attendance_record_id) ?? []
    list.push(b)
    breakMap.set(b.attendance_record_id, list)
  }

  // 4. Enumerate past/present weekdays in range (not future)
  const allDates = dateRange(dateFrom, dateTo)
  const workDays = allDates.filter((d) => !isWeekend(d) && d <= todayStr)

  // 5. Per-employee aggregation
  type EmpRow = {
    profile_id: string; full_name: string
    days_present: number; days_late: number; days_wfh: number; days_absent: number
    total_break_minutes: number; break_violations: number
  }

  const empRows: EmpRow[] = attendanceProfiles.map((p) => {
    let present = 0, late = 0, wfh = 0, absent = 0, breakMins = 0, violations = 0
    for (const date of workDays) {
      const rec = recMap.get(`${p.id}|${date}`)
      const sub = wfhMap.get(`${p.id}|${date}`)
      if (rec) {
        if (rec.status === 'wfh') { wfh++ }
        else if (rec.check_in_at) {
          present++
          if (rec.punctuality === 'late') late++
        } else { absent++ }
        // break stats for this record
        for (const b of breakMap.get(rec.id) ?? []) {
          breakMins += b.duration_minutes ?? 0
          if (b.exceeded_allowance) violations++
        }
      } else if (sub?.status === 'approved') {
        wfh++
      } else {
        absent++
      }
    }
    return { profile_id: p.id, full_name: p.full_name, days_present: present, days_late: late, days_wfh: wfh, days_absent: absent, total_break_minutes: breakMins, break_violations: violations }
  })

  // 6. Summary cards (team-wide)
  const totalExpected = workDays.length * attendanceProfiles.length
  const totalPresent  = empRows.reduce((s, e) => s + e.days_present, 0)
  const totalWfh      = empRows.reduce((s, e) => s + e.days_wfh, 0)
  const totalAbsent   = empRows.reduce((s, e) => s + e.days_absent, 0)
  const totalLate     = empRows.reduce((s, e) => s + e.days_late, 0)
  const totalViolations = empRows.reduce((s, e) => s + e.break_violations, 0)
  const attendedDays  = totalPresent + totalWfh
  const attendanceRate = totalExpected > 0 ? Math.round((attendedDays / totalExpected) * 100) : 0

  // 7. Trend data — daily team-wide counts
  type TrendPoint = { date: string; present: number; wfh: number; absent: number }
  const trend: TrendPoint[] = workDays.map((date) => {
    let p = 0, w = 0, a = 0
    for (const emp of attendanceProfiles) {
      const rec = recMap.get(`${emp.id}|${date}`)
      const sub = wfhMap.get(`${emp.id}|${date}`)
      if (rec) {
        if (rec.status === 'wfh') { w++ }
        else if (rec.check_in_at) { p++ }
        else { a++ }
      } else if (sub?.status === 'approved') { w++ }
      else { a++ }
    }
    return { date, present: p, wfh: w, absent: a }
  })

  // 8. Late by employee (non-zero only)
  const lateByEmp = empRows
    .filter((e) => e.days_late > 0)
    .sort((a, b) => b.days_late - a.days_late)
    .map((e) => ({ profile_id: e.profile_id, full_name: e.full_name, late_count: e.days_late }))

  return Response.json({
    summary: { attendance_rate: attendanceRate, total_late: totalLate, total_wfh: totalWfh, break_violations: totalViolations, expected_days: totalExpected, present_days: totalPresent, absent_days: totalAbsent },
    employees: empRows.sort((a, b) => b.days_absent - a.days_absent), // sort by most absent first
    trend,
    late_by_employee: lateByEmp,
  })
}

function emptySum() {
  return { attendance_rate: 0, total_late: 0, total_wfh: 0, break_violations: 0, expected_days: 0, present_days: 0, absent_days: 0 }
}

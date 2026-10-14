import { adminClient } from '@/lib/supabase/admin'
import { requireRole, getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/breaks ────────────────────────────────
// Admin:    any employee's breaks by profile_id + date/range.
// Employee: own breaks only (profile_id param ignored).
//
// Query params:
//   profile_id  — (admin only) UUID; omit for all employees
//   date        — exact date YYYY-MM-DD
//   date_from   — range start
//   date_to     — range end
export async function GET(request: Request) {
  const url = new URL(request.url)
  const dateParam      = url.searchParams.get('date')
  const dateFrom       = url.searchParams.get('date_from')
  const dateTo         = url.searchParams.get('date_to')
  const profileIdParam = url.searchParams.get('profile_id')

  const { error: roleErr } = await requireRole(request, ['admin'])
  const isAdmin = !roleErr

  let targetProfileId: string | null = null

  if (isAdmin) {
    targetProfileId = profileIdParam ?? null
  } else {
    const ctx = await getAuthContext(request)
    if (!ctx) return unauthorized()
    targetProfileId = ctx.userId
  }

  // Build the date filter on attendance_records first, then pull breaks
  let recordQuery = adminClient
    .from('attendance_records')
    .select('id, profile_id, work_date, profiles:profile_id ( full_name, email )')

  if (targetProfileId) {
    recordQuery = recordQuery.eq('profile_id', targetProfileId)
  }

  if (dateParam) {
    recordQuery = recordQuery.eq('work_date', dateParam)
  } else {
    if (dateFrom) recordQuery = recordQuery.gte('work_date', dateFrom)
    if (dateTo)   recordQuery = recordQuery.lte('work_date', dateTo)
  }

  const { data: records, error: recErr } = await recordQuery
  if (recErr) return Response.json({ error: recErr.message }, { status: 500 })

  if (!records?.length) return Response.json([])

  const recordIds = records.map((r) => r.id)
  const recordMap = new Map(records.map((r) => [r.id, r]))

  const { data: breaks, error: breakErr } = await adminClient
    .from('attendance_breaks')
    .select('id, attendance_record_id, break_type, started_at, ended_at, duration_minutes, exceeded_allowance')
    .in('attendance_record_id', recordIds)
    .order('started_at', { ascending: true })

  if (breakErr) return Response.json({ error: breakErr.message }, { status: 500 })

  // Attach the parent record's date + employee info to each break row
  const result = (breaks ?? []).map((b) => {
    const rec = recordMap.get(b.attendance_record_id)
    return {
      ...b,
      work_date: rec?.work_date ?? null,
      profile_id: rec?.profile_id ?? null,
      employee: rec?.profiles ?? null,
    }
  })

  return Response.json(result)
}

import { adminClient } from '@/lib/supabase/admin'
import { requireRole, getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/records ───────────────────────────────
// Admin:    any employee's record(s) filtered by profile_id and date/range.
// Employee: own records only (profile_id param ignored if provided by non-admin).
//
// Query params:
//   profile_id  — (admin only) UUID of the employee; omit for all employees
//   date        — exact date YYYY-MM-DD (mutually exclusive with date_from/date_to)
//   date_from   — range start YYYY-MM-DD
//   date_to     — range end   YYYY-MM-DD
export async function GET(request: Request) {
  const url = new URL(request.url)
  const dateParam     = url.searchParams.get('date')
  const dateFrom      = url.searchParams.get('date_from')
  const dateTo        = url.searchParams.get('date_to')
  const profileIdParam = url.searchParams.get('profile_id')

  // Try admin first, fall back to any-authenticated employee
  const { error: roleErr, ctx: adminCtx } = await requireRole(request, ['admin'])
  const isAdmin = !roleErr

  let targetProfileId: string | null = null

  if (isAdmin) {
    // Admin may query any profile or all profiles
    targetProfileId = profileIdParam ?? null
  } else {
    // Non-admin must be authenticated and can only see own records
    const ctx = await getAuthContext(request)
    if (!ctx) return unauthorized()
    targetProfileId = ctx.userId
  }

  let query = adminClient
    .from('attendance_records')
    .select(`
      id,
      profile_id,
      work_date,
      status,
      check_in_at,
      check_out_at,
      punctuality,
      shift_completed,
      created_at,
      updated_at,
      profiles:profile_id ( full_name, email )
    `)
    .order('work_date', { ascending: false })

  if (targetProfileId) {
    query = query.eq('profile_id', targetProfileId)
  }

  if (dateParam) {
    query = query.eq('work_date', dateParam)
  } else {
    if (dateFrom) query = query.gte('work_date', dateFrom)
    if (dateTo)   query = query.lte('work_date', dateTo)
  }

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

// ── GET /api/attendance/shifts/me ─────────────────────────────
// Any authenticated user: returns their own currently active shift,
// or null if no shift has been assigned yet.
export async function GET(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const { data: shift, error } = await adminClient
    .from('attendance_shifts')
    .select('id, start_time, end_time, effective_from, created_at, attendance_staff_profiles(employee_code)')
    .eq('profile_id', ctx.userId)
    .is('effective_to', null)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(shift ?? null)
}

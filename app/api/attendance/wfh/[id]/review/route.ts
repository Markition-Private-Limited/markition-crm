import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

// ── POST /api/attendance/wfh/[id]/review ─────────────────────
// Admin approves or rejects a WFH submission.
// Body: { action: "approve" | "reject", note?: string }
//
// On approve: upserts attendance_records for that date with status = 'wfh'.
// On reject:  records the rejection; attendance_records is NOT touched.
// Both actions are blocked if the submission is not currently pending.
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { error: authErr, ctx } = await requireRole(request, ['admin'])
  if (authErr) return authErr

  const body = await request.json().catch(() => ({})) as { action?: string; note?: string }
  const { action, note } = body

  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: 'action must be "approve" or "reject".' }, { status: 400 })
  }

  const { id } = params

  // Fetch the submission
  const { data: submission, error: fetchErr } = await adminClient
    .from('attendance_wfh_submissions')
    .select('id, profile_id, work_date, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 })
  if (!submission) return Response.json({ error: 'Submission not found.' }, { status: 404 })
  if (submission.status !== 'pending') {
    return Response.json(
      { error: `Submission is already ${submission.status}.` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  // Update submission status
  const { data: updated, error: updateErr } = await adminClient
    .from('attendance_wfh_submissions')
    .update({
      status: newStatus,
      reviewed_by: ctx.userId,
      reviewed_at: now,
      review_note: note ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending') // race-safe
    .select()
    .maybeSingle()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  if (!updated) {
    return Response.json({ error: 'Submission was already reviewed by someone else.' }, { status: 409 })
  }

  // On approval: mark the attendance record as WFH
  if (action === 'approve') {
    // Try inserting; if unique conflict, just update status
    const { error: insertErr } = await adminClient
      .from('attendance_records')
      .insert({
        profile_id: submission.profile_id,
        work_date: submission.work_date,
        status: 'wfh',
      })

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Record already exists — update status only, preserve check_in/out data
        const { error: updateRecErr } = await adminClient
          .from('attendance_records')
          .update({ status: 'wfh' })
          .eq('profile_id', submission.profile_id)
          .eq('work_date', submission.work_date)

        if (updateRecErr) {
          return Response.json(
            { error: `Submission approved but failed to update attendance record: ${updateRecErr.message}` },
            { status: 500 },
          )
        }
      } else {
        return Response.json(
          { error: `Submission approved but failed to create attendance record: ${insertErr.message}` },
          { status: 500 },
        )
      }
    }
  }

  return Response.json({ submission: updated })
}

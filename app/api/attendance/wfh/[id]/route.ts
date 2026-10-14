import { adminClient } from '@/lib/supabase/admin'
import { getAuthContext, unauthorized } from '@/lib/auth/require-role'

function isLateSubmission(workDate: string, shiftEndTime: string | null): boolean {
  if (!shiftEndTime) return false
  const [h, m] = shiftEndTime.split(':').map(Number)
  const deadline = new Date(`${workDate}T00:00:00.000Z`)
  deadline.setUTCHours(h, m, 0, 0)
  return new Date() > deadline
}

// ── PATCH /api/attendance/wfh/[id] ───────────────────────────
// Employee updates their own pending WFH submission.
// Blocked once reviewed (approved or rejected).
// Body: multipart/form-data OR JSON
//   proof_text  string  (optional)
//   proof_file  File    (optional)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  const { id } = params

  // Fetch the submission and verify ownership
  const { data: submission, error: fetchErr } = await adminClient
    .from('attendance_wfh_submissions')
    .select('id, profile_id, work_date, status, proof_file_path')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 })
  if (!submission) return Response.json({ error: 'Submission not found.' }, { status: 404 })
  if (submission.profile_id !== ctx.userId) {
    return Response.json({ error: 'You can only edit your own submissions.' }, { status: 403 })
  }
  if (submission.status !== 'pending') {
    return Response.json(
      { error: `Cannot edit a submission that has already been ${submission.status}.` },
      { status: 409 },
    )
  }

  let proofText: string | null = null
  let proofFilePath: string | null = submission.proof_file_path

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    proofText = (form.get('proof_text') as string | null) || null

    const proofFile = form.get('proof_file') as File | null
    if (proofFile && proofFile.size > 0) {
      const ext = proofFile.name.split('.').pop() ?? 'bin'
      const storagePath = `${ctx.userId}/${submission.work_date}/${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(await proofFile.arrayBuffer())

      const { error: uploadErr } = await adminClient.storage
        .from('wfh-proof')
        .upload(storagePath, buffer, { contentType: proofFile.type, upsert: false })

      if (uploadErr) return Response.json({ error: `File upload failed: ${uploadErr.message}` }, { status: 500 })
      proofFilePath = storagePath
    }
  } else {
    const body = await request.json().catch(() => ({})) as Record<string, string>
    proofText = body.proof_text ?? null
  }

  if (!proofText && !proofFilePath) {
    return Response.json({ error: 'Provide at least proof_text or proof_file.' }, { status: 400 })
  }

  const { data: shift } = await adminClient
    .from('attendance_shifts')
    .select('end_time')
    .eq('profile_id', ctx.userId)
    .is('effective_to', null)
    .maybeSingle()

  const submittedLate = isLateSubmission(submission.work_date, shift?.end_time ?? null)

  const { data, error } = await adminClient
    .from('attendance_wfh_submissions')
    .update({
      proof_text: proofText,
      proof_file_path: proofFilePath,
      submitted_late: submittedLate,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending') // extra guard: reject if reviewed between fetch and update
    .select()
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) {
    return Response.json({ error: 'Submission was reviewed before your update could be saved.' }, { status: 409 })
  }

  return Response.json({ submission: data, submitted_late: submittedLate })
}

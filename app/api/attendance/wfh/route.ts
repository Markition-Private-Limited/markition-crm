import { adminClient } from '@/lib/supabase/admin'
import { requireRole, getAuthContext, unauthorized } from '@/lib/auth/require-role'

function isLateSubmission(workDate: string, shiftEndTime: string | null): boolean {
  if (!shiftEndTime) return false
  const [h, m] = shiftEndTime.split(':').map(Number)
  const deadline = new Date(`${workDate}T00:00:00.000Z`)
  deadline.setUTCHours(h, m, 0, 0)
  return new Date() > deadline
}

// ── POST /api/attendance/wfh ──────────────────────────────────
// Employee submits WFH proof for a specific date.
// Body: multipart/form-data
//   work_date   YYYY-MM-DD  (required)
//   proof_text  string      (optional, but one of text/file required)
//   proof_file  File        (optional)
//
// Resubmission while still pending: allowed (updates existing record).
// Resubmission after review: blocked with 409.
export async function POST(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()

  let workDate: string
  let proofText: string | null = null
  let proofFilePath: string | null = null

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    workDate = (form.get('work_date') as string | null) ?? ''
    proofText = (form.get('proof_text') as string | null) || null

    const proofFile = form.get('proof_file') as File | null
    if (proofFile && proofFile.size > 0) {
      const ext = proofFile.name.split('.').pop() ?? 'bin'
      const storagePath = `${ctx.userId}/${workDate}/${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(await proofFile.arrayBuffer())

      const { error: uploadErr } = await adminClient.storage
        .from('wfh-proof')
        .upload(storagePath, buffer, { contentType: proofFile.type, upsert: false })

      if (uploadErr) return Response.json({ error: `File upload failed: ${uploadErr.message}` }, { status: 500 })
      proofFilePath = storagePath
    }
  } else {
    const body = await request.json().catch(() => ({})) as Record<string, string>
    workDate = body.work_date ?? ''
    proofText = body.proof_text ?? null
  }

  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return Response.json({ error: 'work_date is required (YYYY-MM-DD).' }, { status: 400 })
  }
  if (!proofText && !proofFilePath) {
    return Response.json({ error: 'Provide at least proof_text or proof_file.' }, { status: 400 })
  }

  // Check for existing submission
  const { data: existing, error: existErr } = await adminClient
    .from('attendance_wfh_submissions')
    .select('id, status, proof_file_path')
    .eq('profile_id', ctx.userId)
    .eq('work_date', workDate)
    .maybeSingle()

  if (existErr) return Response.json({ error: existErr.message }, { status: 500 })

  if (existing) {
    if (existing.status !== 'pending') {
      return Response.json(
        { error: `Submission already ${existing.status}. You cannot modify a reviewed submission.` },
        { status: 409 },
      )
    }
    // Allow update while pending — fall through to upsert below
  }

  // Determine if submitted late vs the employee's active shift end time
  const { data: shift } = await adminClient
    .from('attendance_shifts')
    .select('end_time')
    .eq('profile_id', ctx.userId)
    .is('effective_to', null)
    .maybeSingle()

  const submittedLate = isLateSubmission(workDate, shift?.end_time ?? null)

  const payload = {
    profile_id: ctx.userId,
    work_date: workDate,
    proof_text: proofText,
    proof_file_path: proofFilePath ?? existing?.proof_file_path ?? null,
    status: 'pending' as const,
    submitted_late: submittedLate,
    submitted_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  }

  const { data, error } = await adminClient
    .from('attendance_wfh_submissions')
    .upsert(payload, { onConflict: 'profile_id,work_date' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ submission: data, submitted_late: submittedLate }, { status: existing ? 200 : 201 })
}

// ── GET /api/attendance/wfh ───────────────────────────────────
// Employee: own submissions, optional date filters.
// Admin: all submissions, optional profile_id + status + date filters.
//
// Query params:
//   profile_id  (admin only)
//   status      pending | approved | rejected
//   date        YYYY-MM-DD
//   date_from   YYYY-MM-DD
//   date_to     YYYY-MM-DD
export async function GET(request: Request) {
  const url = new URL(request.url)
  const statusFilter   = url.searchParams.get('status')
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

  let query = adminClient
    .from('attendance_wfh_submissions')
    .select(`
      id, profile_id, work_date, proof_text, proof_file_path,
      status, reviewed_by, reviewed_at, review_note,
      submitted_at, submitted_late, created_at, updated_at,
      profiles:profile_id ( full_name, email )
    `)
    .order('work_date', { ascending: false })

  if (targetProfileId) query = query.eq('profile_id', targetProfileId)
  if (statusFilter)    query = query.eq('status', statusFilter)
  if (dateParam)       query = query.eq('work_date', dateParam)
  else {
    if (dateFrom) query = query.gte('work_date', dateFrom)
    if (dateTo)   query = query.lte('work_date', dateTo)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

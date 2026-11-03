import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

const BUCKET = 'onboarding-docs'

async function ensureBucket() {
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await adminClient.storage.createBucket(BUCKET, { public: true })
  }
}

/** POST /api/onboarding/[id]/checklist/[itemId]/upload — upload a file to storage */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: caseId, itemId } = await params

  // Verify item belongs to this case and case is in_progress
  const { data: item } = await adminClient
    .from('onboarding_checklist_items')
    .select('id, case_id, status')
    .eq('id', itemId)
    .eq('case_id', caseId)
    .single()

  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: obc } = await adminClient
    .from('onboarding_cases')
    .select('id, owner_id, status')
    .eq('id', caseId)
    .single()

  if (!obc) return Response.json({ error: 'Case not found' }, { status: 404 })
  const obcCase = obc as Record<string, unknown>

  if (ctx.role === 'bd_executive' && obcCase.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (obcCase.status !== 'in_progress') {
    return Response.json({ error: 'Case is already finalized' }, { status: 422 })
  }
  const itemRec = item as Record<string, unknown>
  if (itemRec.status === 'approved') {
    return Response.json({ error: 'Document is already approved' }, { status: 422 })
  }

  // Parse multipart body
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const maxMb = 20
  if (file.size > maxMb * 1024 * 1024) {
    return Response.json({ error: `File too large (max ${maxMb} MB)` }, { status: 413 })
  }

  await ensureBucket()

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${caseId}/${itemId}/${Date.now()}.${ext}`

  const { error: storageErr } = await adminClient.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (storageErr) return Response.json({ error: storageErr.message }, { status: 500 })

  const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(path)
  const fileUrl = urlData.publicUrl

  const { data: updated, error: dbErr } = await adminClient
    .from('onboarding_checklist_items')
    .update({
      status: 'uploaded',
      file_url: fileUrl,
      file_name: file.name,
      uploaded_by: ctx.userId,
      uploaded_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      review_remark: null,
    })
    .eq('id', itemId)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(updated)
}

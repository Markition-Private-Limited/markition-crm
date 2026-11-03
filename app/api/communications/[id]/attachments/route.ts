import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

const BUCKET = 'communications'
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

/** POST /api/communications/[id]/attachments
 *  Accepts multipart/form-data with a single "file" field.
 *  Stored in the private "communications" Supabase Storage bucket.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: communicationId } = await params

  // Verify the communication exists (and optionally scope-check)
  const { data: comm, error: commErr } = await adminClient
    .from('communications')
    .select('id, logged_by')
    .eq('id', communicationId)
    .single()

  if (commErr || !comm) return Response.json({ error: 'Communication not found' }, { status: 404 })

  const commRecord = comm as { id: string; logged_by: string }
  if (ctx.role === 'bd_executive' && commRecord.logged_by !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  // Ensure bucket exists (creates it silently if it doesn't)
  const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, { public: false })
  if (bucketErr && !bucketErr.message.toLowerCase().includes('already exists')) {
    return Response.json({ error: `Storage setup failed: ${bucketErr.message}` }, { status: 500 })
  }

  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const storagePath = `${communicationId}/${Date.now()}${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadErr) return Response.json({ error: uploadErr.message }, { status: 500 })

  const { data: record, error: dbErr } = await adminClient
    .from('communication_attachments')
    .insert({
      communication_id: communicationId,
      file_name:        file.name,
      storage_path:     storagePath,
      file_size:        file.size,
      mime_type:        file.type || null,
      uploaded_by:      ctx.userId,
    })
    .select()
    .single()

  if (dbErr) {
    // Clean up orphaned upload
    await adminClient.storage.from(BUCKET).remove([storagePath])
    return Response.json({ error: dbErr.message }, { status: 500 })
  }

  // Generate a signed URL for immediate access
  const { data: signed } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  return Response.json({ ...record, signed_url: signed?.signedUrl ?? null }, { status: 201 })
}

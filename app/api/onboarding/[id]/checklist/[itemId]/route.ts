import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/**
 * PATCH /api/onboarding/[id]/checklist/[itemId]
 *
 * Body actions:
 *  { action: "upload",           file_url, file_name }  — bd_executive+
 *  { action: "mark_under_review" }                      — bd_manager+
 *  { action: "approve",          remark? }              — bd_manager+
 *  { action: "reject",           remark  }              — bd_manager+
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: caseId, itemId } = await params
  const body = await request.json()
  const { action, file_url, file_name, remark } = body as Record<string, unknown>

  // Verify item belongs to this case
  const { data: item } = await adminClient
    .from('onboarding_checklist_items')
    .select('id, case_id, status')
    .eq('id', itemId)
    .eq('case_id', caseId)
    .single()

  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  // Verify the case is visible + in_progress
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

  // Manager-only actions
  const managerActions = ['mark_under_review', 'approve', 'reject']
  if (managerActions.includes(action as string) && ctx.role === 'bd_executive') {
    return Response.json({ error: 'Forbidden — manager or above required for review actions' }, { status: 403 })
  }

  let patch: Record<string, unknown> = {}

  switch (action) {
    case 'upload':
      if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 })
      patch = {
        status: 'uploaded',
        file_url: file_url as string,
        file_name: (file_name as string | null) ?? null,
        uploaded_by: ctx.userId,
        uploaded_at: new Date().toISOString(),
        // Clear previous review data on re-upload
        reviewed_by: null,
        reviewed_at: null,
        review_remark: null,
      }
      break

    case 'mark_under_review': {
      const itemRec = item as Record<string, unknown>
      if (itemRec.status !== 'uploaded') {
        return Response.json({ error: 'Item must be in "uploaded" state first' }, { status: 422 })
      }
      patch = { status: 'under_review' }
      break
    }

    case 'approve':
      patch = {
        status: 'approved',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        review_remark: (remark as string | null) ?? null,
      }
      break

    case 'reject':
      if (!remark) return Response.json({ error: 'remark is required when rejecting' }, { status: 400 })
      patch = {
        status: 'rejected',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        review_remark: remark as string,
      }
      break

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: updated, error: dbErr } = await adminClient
    .from('onboarding_checklist_items')
    .update(patch)
    .eq('id', itemId)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(updated)
}

import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/** GET /api/onboarding/[id] — case detail with checklist items */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: obc } = await adminClient
    .from('onboarding_cases')
    .select('*')
    .eq('id', id)
    .single()

  if (!obc) return Response.json({ error: 'Not found' }, { status: 404 })
  const obcCase = obc as Record<string, unknown>

  // Role scope
  if (ctx.role === 'bd_executive' && obcCase.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Enrich with reviewer profile
  const reviewerIds = [obcCase.started_by, obcCase.final_reviewed_by].filter(Boolean) as string[]
  const { data: profiles } = reviewerIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', reviewerIds)
    : { data: [] }

  const byId: Record<string, unknown> = {}
  for (const p of profiles ?? []) byId[(p as { id: string }).id] = p

  // Load checklist items
  const { data: items, error: itemsErr } = await adminClient
    .from('onboarding_checklist_items')
    .select('*')
    .eq('case_id', id)
    .order('created_at', { ascending: true })

  if (itemsErr) return Response.json({ error: itemsErr.message }, { status: 500 })

  // Enrich items with reviewer profiles
  const allItems = (items ?? []) as Record<string, unknown>[]
  const itemUserIds = [
    ...new Set([
      ...allItems.map((i) => i.uploaded_by),
      ...allItems.map((i) => i.reviewed_by),
    ].filter(Boolean) as string[])
  ]
  const { data: itemProfiles } = itemUserIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', itemUserIds)
    : { data: [] }

  const itemById: Record<string, unknown> = {}
  for (const p of itemProfiles ?? []) itemById[(p as { id: string }).id] = p

  return Response.json({
    ...obcCase,
    started_by_profile: obcCase.started_by ? (byId[obcCase.started_by as string] ?? null) : null,
    final_reviewed_by_profile: obcCase.final_reviewed_by ? (byId[obcCase.final_reviewed_by as string] ?? null) : null,
    checklist: allItems.map((item) => ({
      ...item,
      uploaded_by_profile: item.uploaded_by ? (itemById[item.uploaded_by as string] ?? null) : null,
      reviewed_by_profile: item.reviewed_by ? (itemById[item.reviewed_by as string] ?? null) : null,
    })),
  })
}

/** DELETE /api/onboarding/[id] — delete an onboarding case (manager+ only) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'bd_executive' || ctx.role === 'viewer') {
    return Response.json({ error: 'Forbidden — manager or above required' }, { status: 403 })
  }

  const { id } = await params

  const { data: obc } = await adminClient
    .from('onboarding_cases')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (!obc) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error: dbErr } = await adminClient
    .from('onboarding_cases')
    .delete()
    .eq('id', id)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

/** PATCH /api/onboarding/[id] — final approve or reject the whole case */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  // Only bd_manager or above can give final approval
  if (ctx.role === 'bd_executive' || ctx.role === 'viewer') {
    return Response.json({ error: 'Forbidden — manager or above required' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { action, note } = body as { action?: string; note?: string }

  if (action !== 'approve' && action !== 'reject' && action !== 'refresh_checklist') {
    return Response.json({ error: 'action must be "approve", "reject", or "refresh_checklist"' }, { status: 400 })
  }

  // ── refresh_checklist: apply templates retroactively ──────────────────────
  if (action === 'refresh_checklist') {
    const { data: obc } = await adminClient
      .from('onboarding_cases')
      .select('id, status, customer_type_snapshot, jurisdiction_snapshot')
      .eq('id', id)
      .single()

    if (!obc) return Response.json({ error: 'Not found' }, { status: 404 })
    const obcRec = obc as Record<string, unknown>

    if (obcRec.status !== 'in_progress') {
      return Response.json({ error: 'Case is already finalized' }, { status: 422 })
    }

    // Load all active templates and filter in JS (NULL = match all)
    const { data: allTemplates } = await adminClient
      .from('document_requirement_templates')
      .select('id, name, is_mandatory, sort_order')
      .eq('is_active', true)

    const custType = (obcRec.customer_type_snapshot as string | null) ?? null
    const juris    = (obcRec.jurisdiction_snapshot as string | null) ?? null

    type Template = { id: string; name: string; is_mandatory: boolean; sort_order: number; customer_type?: string | null; jurisdiction?: string | null }

    // Re-fetch with filter fields
    const { data: allTemplatesFull } = await adminClient
      .from('document_requirement_templates')
      .select('id, name, is_mandatory, sort_order, customer_type, jurisdiction')
      .eq('is_active', true)

    const matching = ((allTemplatesFull ?? []) as Template[]).filter((t) => {
      const typeOk = !t.customer_type || t.customer_type === (custType ?? '')
      const jurOk  = !t.jurisdiction  || t.jurisdiction  === (juris   ?? '')
      return typeOk && jurOk
    })

    if (matching.length === 0) {
      return Response.json({ inserted: 0, message: 'No active templates match this case' })
    }

    // Get existing items to avoid duplicates
    const { data: existing } = await adminClient
      .from('onboarding_checklist_items')
      .select('template_id')
      .eq('case_id', id)

    const existingIds = new Set(
      ((existing ?? []) as { template_id: string | null }[])
        .map((i) => i.template_id)
        .filter(Boolean)
    )

    const toInsert = matching.filter((t) => !existingIds.has(t.id))

    if (toInsert.length > 0) {
      const { error: insertErr } = await adminClient.from('onboarding_checklist_items').insert(
        toInsert.map((t) => ({
          case_id:      id,
          template_id:  t.id,
          document_name: t.name,
          is_mandatory:  t.is_mandatory,
        }))
      )
      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

      await adminClient
        .from('onboarding_cases')
        .update({ no_matching_templates: false })
        .eq('id', id)
    }

    return Response.json({ inserted: toInsert.length })
  }

  const { data: obc } = await adminClient
    .from('onboarding_cases')
    .select('id, owner_id, status')
    .eq('id', id)
    .single()

  if (!obc) return Response.json({ error: 'Not found' }, { status: 404 })
  const obcCase = obc as Record<string, unknown>

  if (obcCase.status !== 'in_progress') {
    return Response.json({ error: 'Case is already finalized' }, { status: 422 })
  }

  // For approval, all mandatory checklist items must be approved
  if (action === 'approve') {
    const { data: items } = await adminClient
      .from('onboarding_checklist_items')
      .select('id, document_name, is_mandatory, status')
      .eq('case_id', id)

    const outstanding = ((items ?? []) as { is_mandatory: boolean; status: string; document_name: string }[])
      .filter((i) => i.is_mandatory && i.status !== 'approved')

    if (outstanding.length > 0) {
      return Response.json(
        {
          error: `Cannot approve: ${outstanding.length} mandatory document${outstanding.length !== 1 ? 's' : ''} not yet approved`,
          outstanding: outstanding.map((i) => i.document_name),
        },
        { status: 422 }
      )
    }
  }

  const { data: updated, error: dbErr } = await adminClient
    .from('onboarding_cases')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      final_reviewed_by: ctx.userId,
      final_reviewed_at: new Date().toISOString(),
      final_review_note: note ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(updated)
}

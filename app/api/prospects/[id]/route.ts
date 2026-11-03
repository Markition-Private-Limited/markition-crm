import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds, userHasPermission } from '@/lib/auth/team-scope'
import { logActivity } from '@/lib/activity'

const PROSPECT_SELECT = `
  id, prospect_code, company_id, company_name, industry, country, city, website,
  lead_source, name, notes, source, owner_id, priority, service_required,
  estimated_value, currency, stage_id, probability, expected_close_date,
  loss_reason, close_date, final_amount, is_archived, created_by, updated_by,
  status, created_at, updated_at,
  pipeline_stages(id, name, display_order, default_probability, is_won, is_lost),
  companies(id, name)
`.trim()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .select(PROSPECT_SELECT)
    .eq('id', id)
    .single()

  if (dbErr || !data) return Response.json({ error: 'Not found' }, { status: 404 })

  // Scope check: BD Executive can only see their own
  const prospect = data as { owner_id?: string }
  if (ctx.role === 'bd_executive' && prospect.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (ctx.role === 'bd_manager' && prospect.owner_id) {
    const teamIds = await getTeamMemberIds(ctx.userId)
    if (prospect.owner_id !== ctx.userId && !teamIds.includes(prospect.owner_id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return Response.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  // Fetch current record to compare
  const { data: current, error: fetchErr } = await adminClient
    .from('prospects')
    .select('*, pipeline_stages(id, is_won, is_lost)')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return Response.json({ error: 'Not found' }, { status: 404 })

  // Scope check: BD Executive can only edit their own; BD Manager their team's
  const currOwner = (current as { owner_id?: string }).owner_id
  if (ctx.role === 'bd_executive' && currOwner !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (ctx.role === 'bd_manager' && currOwner) {
    const teamIds = await getTeamMemberIds(ctx.userId)
    if (currOwner !== ctx.userId && !teamIds.includes(currOwner)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = { updated_by: ctx.userId }

  // Simple scalar fields
  const scalarFields = [
    'company_name', 'industry', 'country', 'city', 'website',
    'lead_source', 'name', 'notes', 'priority', 'service_required',
    'estimated_value', 'currency', 'probability', 'expected_close_date',
    'loss_reason', 'close_date', 'final_amount', 'remarks',
  ] as const

  for (const f of scalarFields) {
    if (body[f] !== undefined) update[f === 'remarks' ? 'notes' : f] = body[f]
  }

  // ── Stage change ─────────────────────────────────────────────────────────
  let newStage: { id: string; is_won: boolean; is_lost: boolean } | null = null
  if (body.stage_id !== undefined && body.stage_id !== (current as { stage_id: string }).stage_id) {
    const { data: stage } = await adminClient
      .from('pipeline_stages')
      .select('id, is_won, is_lost, default_probability')
      .eq('id', body.stage_id)
      .single()

    if (!stage) return Response.json({ error: 'Invalid stage_id' }, { status: 400 })
    newStage = stage as unknown as typeof newStage

    // ── Won/Lost validation ───────────────────────────────────────────────
    if ((stage as { is_lost: boolean }).is_lost) {
      const lossReason = body.loss_reason ?? (current as { loss_reason?: string }).loss_reason
      if (!lossReason?.trim()) {
        return Response.json(
          { error: 'loss_reason is required when marking a prospect as Lost' },
          { status: 400 }
        )
      }
      update.loss_reason = lossReason
    }

    if ((stage as { is_won: boolean }).is_won) {
      const closeDate   = body.close_date   ?? (current as { close_date?: string }).close_date
      const finalAmount = body.final_amount ?? (current as { final_amount?: number }).final_amount
      if (!closeDate) {
        return Response.json(
          { error: 'close_date is required when marking a prospect as Won' },
          { status: 400 }
        )
      }
      if (finalAmount == null) {
        return Response.json(
          { error: 'final_amount is required when marking a prospect as Won' },
          { status: 400 }
        )
      }
      update.close_date    = closeDate
      update.final_amount  = finalAmount
      // Also update legacy status for clients trigger
      update.status = 'closed_won'
    }

    if ((stage as { is_lost: boolean }).is_lost) {
      update.status = 'failed'
    }

    update.stage_id = body.stage_id
    // Auto-update probability if not explicitly provided
    if (body.probability === undefined) {
      update.probability = (stage as { default_probability: number }).default_probability
    }
  }

  // ── Owner reassignment ───────────────────────────────────────────────────
  const ownerChanged =
    body.owner_id !== undefined &&
    body.owner_id !== (current as { owner_id?: string }).owner_id

  if (body.owner_id !== undefined) update.owner_id = body.owner_id

  // ── Persist ──────────────────────────────────────────────────────────────
  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .update(update)
    .eq('id', id)
    .select(PROSPECT_SELECT)
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data)  return Response.json({ error: 'Not found' },  { status: 404 })

  // ── Post-update side effects ─────────────────────────────────────────────
  if (newStage) {
    await adminClient.from('prospect_stage_history').insert({
      prospect_id:   id,
      from_stage_id: (current as { stage_id?: string }).stage_id ?? null,
      to_stage_id:   body.stage_id,
      changed_by:    ctx.userId,
    })
  }

  if (ownerChanged) {
    await adminClient.from('prospect_ownership_history').insert({
      prospect_id: id,
      owner_id:    body.owner_id,
      assigned_by: ctx.userId,
    })
  }

  await logActivity({
    entityType: 'prospect',
    entityId:   id,
    actorId:    ctx.userId,
    action:     'updated',
    newValue:   (data as { company_name?: string }).company_name ?? null,
  })

  return Response.json(data)
}

/** PATCH /api/prospects/[id] — archive / unarchive */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer' || ctx.role === 'bd_executive') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  if (body.is_archived === undefined)
    return Response.json({ error: 'is_archived is required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .update({ is_archived: Boolean(body.is_archived), updated_by: ctx.userId })
    .eq('id', id)
    .select(PROSPECT_SELECT)
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  if (!data)  return Response.json({ error: 'Not found' },  { status: 404 })

  await logActivity({
    entityType: 'prospect',
    entityId:   id,
    actorId:    ctx.userId,
    action:     body.is_archived ? 'archived' : 'unarchived',
    newValue:   null,
  })

  return Response.json(data)
}

/** DELETE — hard delete; requires delete_prospects permission for admin, super_admin unrestricted */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error

  if (ctx.role === 'super_admin') {
    // full access
  } else if (ctx.role === 'admin') {
    const allowed = await userHasPermission(ctx.userId, 'delete_prospects')
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 })
  } else {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Hard delete only allowed for admin; uses soft-delete (archive) by default
  const { id } = await params
  const url = new URL(request.url)
  const hard = url.searchParams.get('hard') === 'true'

  if (!hard) {
    return Response.json(
      { error: 'Use PATCH with is_archived=true to archive a prospect. Pass ?hard=true for permanent deletion.' },
      { status: 400 }
    )
  }

  const { error: dbErr } = await adminClient.from('prospects').delete().eq('id', id)
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

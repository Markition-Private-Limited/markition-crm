import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'

/** GET /api/prospects/[id]/onboarding — list onboarding cases for this prospect */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId } = await params

  // Scope check — ensure prospect is visible to caller
  const { data: prospect } = await adminClient
    .from('prospects')
    .select('id, owner_id')
    .eq('id', prospectId)
    .single()

  if (!prospect) return Response.json({ error: 'Not found' }, { status: 404 })
  const p = prospect as Record<string, unknown>
  if (ctx.role === 'bd_executive' && p.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (ctx.role === 'bd_manager') {
    const memberIds = await getTeamMemberIds(ctx.userId)
    if (!memberIds.includes(p.owner_id as string) && p.owner_id !== ctx.userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data, error: dbErr } = await adminClient
    .from('onboarding_cases')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('started_at', { ascending: false })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data ?? [])
}

/** POST /api/prospects/[id]/onboarding — start onboarding from a won proposal */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: prospectId } = await params
  const body = await request.json()
  const { proposal_id } = body as { proposal_id?: string }

  if (!proposal_id) return Response.json({ error: 'proposal_id is required' }, { status: 400 })

  // Load prospect
  const { data: prospect } = await adminClient
    .from('prospects')
    .select('id, owner_id, customer_type, jurisdiction')
    .eq('id', prospectId)
    .single()

  if (!prospect) return Response.json({ error: 'Prospect not found' }, { status: 404 })
  const pros = prospect as Record<string, unknown>

  // Role scope check
  if (ctx.role === 'bd_executive' && pros.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (ctx.role === 'bd_manager') {
    const memberIds = await getTeamMemberIds(ctx.userId)
    if (!memberIds.includes(pros.owner_id as string) && pros.owner_id !== ctx.userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Verify proposal belongs to this prospect and is accepted (won)
  const { data: proposal } = await adminClient
    .from('proposals')
    .select('id, prospect_id, owner_id, is_accepted, status')
    .eq('id', proposal_id)
    .single()

  if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 })
  const prop = proposal as Record<string, unknown>

  if (prop.prospect_id !== prospectId) {
    return Response.json({ error: 'Proposal does not belong to this prospect' }, { status: 400 })
  }
  if (!prop.is_accepted || prop.status !== 'won') {
    return Response.json(
      { error: 'Onboarding can only start from a Won/Accepted proposal' },
      { status: 422 }
    )
  }

  // Check no existing case for this proposal
  const { data: existing } = await adminClient
    .from('onboarding_cases')
    .select('id')
    .eq('proposal_id', proposal_id)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'Onboarding already started for this proposal' }, { status: 409 })
  }

  // Load matching templates
  const customerType = pros.customer_type as string | null
  const jurisdiction = pros.jurisdiction as string | null

  const { data: templates } = await adminClient
    .from('document_requirement_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const allTemplates = (templates ?? []) as Record<string, unknown>[]
  const matching = allTemplates.filter((t) => {
    const typeMatch = !t.customer_type || t.customer_type === customerType
    const jurisMatch = !t.jurisdiction || t.jurisdiction === jurisdiction
    return typeMatch && jurisMatch
  })

  // Create onboarding case
  const { data: obc, error: obcErr } = await adminClient
    .from('onboarding_cases')
    .insert({
      prospect_id: prospectId,
      proposal_id,
      owner_id: prop.owner_id,
      customer_type_snapshot: customerType,
      jurisdiction_snapshot: jurisdiction,
      started_by: ctx.userId,
      no_matching_templates: matching.length === 0,
    })
    .select()
    .single()

  if (obcErr) return Response.json({ error: obcErr.message }, { status: 500 })
  const obcCase = obc as Record<string, unknown>

  // Generate checklist items from matching templates
  if (matching.length > 0) {
    const items = matching.map((t) => ({
      case_id: obcCase.id,
      template_id: t.id,
      document_name: t.name,
      is_mandatory: t.is_mandatory,
    }))

    const { error: itemsErr } = await adminClient
      .from('onboarding_checklist_items')
      .insert(items)

    if (itemsErr) return Response.json({ error: itemsErr.message }, { status: 500 })
  }

  return Response.json(obcCase, { status: 201 })
}

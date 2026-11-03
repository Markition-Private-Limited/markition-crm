import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds, getViewerFilter, userHasPermission } from '@/lib/auth/team-scope'
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

/** Normalise website to its bare domain for comparison */
function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url.toLowerCase().replace(/^www\./, '').split('/')[0]
  }
}

/** GET /api/prospects */
export async function GET(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error

  const url        = new URL(request.url)
  const stageId    = url.searchParams.get('stage_id')
  const archived   = url.searchParams.get('archived') === 'true'
  const ownerId    = url.searchParams.get('owner_id')
  const search     = url.searchParams.get('q')

  let query = adminClient
    .from('prospects')
    .select(PROSPECT_SELECT)
    .eq('is_archived', archived)
    .order('created_at', { ascending: false })

  // Role-based scoping
  if (ctx.role === 'bd_executive') {
    // BD Executive: only own prospects
    query = query.eq('owner_id', ctx.userId)
  } else if (ctx.role === 'bd_manager') {
    // BD Manager: own + team members' prospects
    const teamIds = await getTeamMemberIds(ctx.userId)
    const visibleOwners = [ctx.userId, ...teamIds]
    query = query.in('owner_id', visibleOwners)
  } else if (ctx.role === 'viewer') {
    // Viewer: apply saved filter (e.g. industry, country)
    const filter = await getViewerFilter(ctx.userId)
    if (filter) {
      if (filter.industry) query = query.eq('industry', filter.industry)
      if (filter.country)  query = query.eq('country', filter.country)
      if (filter.stage_id) query = query.eq('stage_id', filter.stage_id)
    }
  }
  // super_admin and admin: no scoping — see all

  // Caller-supplied filters (only apply if not overridden by role scoping)
  if (stageId) query = query.eq('stage_id', stageId)
  if (ownerId && (ctx.role === 'super_admin' || ctx.role === 'admin' || ctx.role === 'bd_manager')) {
    query = query.eq('owner_id', ownerId)
  }
  if (search)  query = query.ilike('company_name', `%${search}%`)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

/** POST /api/prospects */
export async function POST(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error

  // Viewer cannot create. BD Executive needs add_prospects permission.
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (ctx.role === 'bd_executive') {
    const allowed = await userHasPermission(ctx.userId, 'add_prospects')
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    company_id, company_name, industry, country, city, website,
    lead_source, name, notes, source, owner_id, priority,
    service_required, estimated_value, currency, stage_id, probability,
    expected_close_date, remarks,
    skip_duplicate_check,
  } = body

  const resolvedCompanyName = company_name?.trim() || null
  if (!resolvedCompanyName)
    return Response.json({ error: 'company_name is required' }, { status: 400 })

  // ── Duplicate detection ────────────────────────────────────────────────
  if (!skip_duplicate_check) {
    const duplicates: Array<{ id: string; prospect_code: string; company_name: string }> = []

    // Match on company name (case-insensitive)
    const { data: byName } = await adminClient
      .from('prospects')
      .select('id, prospect_code, company_name')
      .ilike('company_name', resolvedCompanyName)
      .eq('is_archived', false)
      .limit(5)
    if (byName?.length) duplicates.push(...byName as typeof duplicates)

    // Match on website domain
    const domain = extractDomain(website)
    if (domain) {
      const { data: byWebsite } = await adminClient
        .from('prospects')
        .select('id, prospect_code, company_name, website')
        .not('website', 'is', null)
        .eq('is_archived', false)
        .limit(20)
      for (const p of (byWebsite ?? [])) {
        const pDomain = extractDomain((p as { website?: string }).website)
        if (pDomain === domain && !duplicates.find((d) => d.id === (p as { id: string }).id)) {
          duplicates.push(p as typeof duplicates[0])
        }
      }
    }

    if (duplicates.length > 0) {
      return Response.json(
        { duplicate_warning: true, matches: duplicates },
        { status: 409 }
      )
    }
  }

  // ── Resolve stage ──────────────────────────────────────────────────────
  let resolvedStageId = stage_id ?? null
  let resolvedProbability = probability ?? null
  if (!resolvedStageId) {
    const { data: firstStage } = await adminClient
      .from('pipeline_stages')
      .select('id, default_probability')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .single()
    if (firstStage) {
      resolvedStageId = (firstStage as { id: string }).id
      if (resolvedProbability === null) {
        resolvedProbability = (firstStage as { default_probability: number }).default_probability
      }
    }
  }

  const { data, error: dbErr } = await adminClient
    .from('prospects')
    .insert({
      company_id:          company_id ?? null,
      company_name:        resolvedCompanyName,
      industry:            industry    ?? null,
      country:             country     ?? null,
      city:                city        ?? null,
      website:             website     ?? null,
      lead_source:         lead_source ?? null,
      name:                name?.trim() || null,
      notes:               notes ?? remarks ?? null,
      source:              source      ?? null,
      owner_id:            owner_id    ?? ctx.userId,
      priority:            priority    ?? 'medium',
      service_required:    service_required ?? null,
      estimated_value:     estimated_value  ?? null,
      currency:            currency ?? 'USD',
      stage_id:            resolvedStageId,
      probability:         resolvedProbability,
      expected_close_date: expected_close_date ?? null,
      is_archived:         false,
      created_by:          ctx.userId,
      updated_by:          ctx.userId,
    })
    .select(PROSPECT_SELECT)
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  const createdId = (data as unknown as { id: string }).id

  // Record initial ownership
  await adminClient.from('prospect_ownership_history').insert({
    prospect_id: createdId,
    owner_id:    owner_id ?? ctx.userId,
    assigned_by: ctx.userId,
  })

  // Record initial stage in history
  if (resolvedStageId) {
    await adminClient.from('prospect_stage_history').insert({
      prospect_id:   createdId,
      from_stage_id: null,
      to_stage_id:   resolvedStageId,
      changed_by:    ctx.userId,
    })
  }

  // Auto-create a contact entry if a contact person name was supplied
  const contactName = name?.trim()
  if (contactName) {
    await adminClient.from('prospect_contacts').insert({
      prospect_id: createdId,
      name:        contactName,
      is_primary:  true,
    })
  }

  await logActivity({
    entityType: 'prospect',
    entityId:   createdId,
    actorId:    ctx.userId,
    action:     'created',
    newValue:   resolvedCompanyName,
  })

  return Response.json(data, { status: 201 })
}

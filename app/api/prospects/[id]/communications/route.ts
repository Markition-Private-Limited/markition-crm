import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'
import { getTeamMemberIds } from '@/lib/auth/team-scope'

const SIGNED_URL_TTL = 3600 // 1 hour

async function enrichCommunications(rows: Record<string, unknown>[]) {
  if (!rows.length) return []

  const ids = rows.map((r) => r.id as string)
  const loggerIds = [...new Set(rows.map((r) => r.logged_by).filter(Boolean))] as string[]

  // Fetch attachments for all communications
  const { data: attachments } = ids.length
    ? await adminClient
        .from('communication_attachments')
        .select('*')
        .in('communication_id', ids)
    : { data: [] }

  // Generate signed URLs for each attachment
  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const att = a as Record<string, unknown>
      const { data: signed } = await adminClient.storage
        .from('communications')
        .createSignedUrl(att.storage_path as string, SIGNED_URL_TTL)
      return { ...att, signed_url: signed?.signedUrl ?? null } as Record<string, unknown>
    })
  )

  const attachsByCommId: Record<string, typeof attachmentsWithUrls> = {}
  for (const a of attachmentsWithUrls) {
    const cid = a.communication_id as string
    attachsByCommId[cid] ??= []
    attachsByCommId[cid].push(a)
  }

  // Fetch logger profiles
  const { data: profiles } = loggerIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', loggerIds)
    : { data: [] }
  const profileById: Record<string, { full_name: string; email: string }> = {}
  for (const p of profiles ?? []) profileById[(p as { id: string }).id] = p as { full_name: string; email: string }

  return rows.map((r) => ({
    ...r,
    logger: r.logged_by ? (profileById[r.logged_by as string] ?? null) : null,
    attachments: attachsByCommId[r.id as string] ?? [],
  }))
}

/** GET /api/prospects/[id]/communications */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  let query = adminClient
    .from('communications')
    .select('*')
    .eq('prospect_id', id)
    .order('occurred_at', { ascending: false })

  if (ctx.role === 'bd_executive') {
    query = query.eq('logged_by', ctx.userId)
  } else if (ctx.role === 'bd_manager') {
    const teamIds = await getTeamMemberIds(ctx.userId)
    query = query.in('logged_by', [ctx.userId, ...teamIds])
  }

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  const enriched = await enrichCommunications((data ?? []) as Record<string, unknown>[])
  return Response.json(enriched)
}

/** POST /api/prospects/[id]/communications */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { channel, direction, occurred_at, summary, next_action } = body

  if (!channel) return Response.json({ error: 'channel is required' }, { status: 400 })
  if (!direction) return Response.json({ error: 'direction is required' }, { status: 400 })

  const VALID_CHANNELS = ['call', 'email', 'whatsapp', 'meeting', 'other']
  const VALID_DIRECTIONS = ['inbound', 'outbound']
  if (!VALID_CHANNELS.includes(channel))
    return Response.json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 })
  if (!VALID_DIRECTIONS.includes(direction))
    return Response.json({ error: `direction must be inbound or outbound` }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('communications')
    .insert({
      prospect_id: id,
      logged_by:   ctx.userId,
      channel,
      direction,
      occurred_at: occurred_at ?? new Date().toISOString(),
      summary:     summary     ?? null,
      next_action: next_action ?? null,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })

  const enriched = await enrichCommunications([(data as unknown as Record<string, unknown>)])
  return Response.json(enriched[0], { status: 201 })
}

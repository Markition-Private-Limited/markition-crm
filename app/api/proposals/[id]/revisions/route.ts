import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/** GET /api/proposals/[id]/revisions */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Verify proposal exists and user can access it
  const { data: proposal } = await adminClient
    .from('proposals')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (!proposal) return Response.json({ error: 'Not found' }, { status: 404 })
  const prop = proposal as Record<string, unknown>
  if (ctx.role === 'bd_executive' && prop.owner_id !== ctx.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: revisions, error: dbErr } = await adminClient
    .from('proposal_revisions')
    .select('*')
    .eq('proposal_id', id)
    .order('revision_number', { ascending: true })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  // Enrich with creator profiles
  const rows = (revisions ?? []) as Record<string, unknown>[]
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[]
  const { data: profiles } = creatorIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', creatorIds)
    : { data: [] }

  const byId: Record<string, unknown> = {}
  for (const p of profiles ?? []) byId[(p as { id: string }).id] = p

  return Response.json(rows.map((r) => ({
    ...r,
    created_by_profile: r.created_by ? (byId[r.created_by as string] ?? null) : null,
  })))
}

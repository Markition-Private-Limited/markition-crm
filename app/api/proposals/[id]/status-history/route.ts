import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/** GET /api/proposals/[id]/status-history */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

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

  const { data: rows, error: dbErr } = await adminClient
    .from('proposal_status_history')
    .select('*')
    .eq('proposal_id', id)
    .order('changed_at', { ascending: true })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  const entries = (rows ?? []) as Record<string, unknown>[]
  const userIds = [...new Set(entries.map((r) => r.changed_by).filter(Boolean))] as string[]
  const { data: profiles } = userIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', userIds)
    : { data: [] }

  const byId: Record<string, unknown> = {}
  for (const p of profiles ?? []) byId[(p as { id: string }).id] = p

  return Response.json(entries.map((r) => ({
    ...r,
    changed_by_profile: r.changed_by ? (byId[r.changed_by as string] ?? null) : null,
  })))
}

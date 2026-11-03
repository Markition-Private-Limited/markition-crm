import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

/** GET /api/prospects/[id]/stage-history */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive'])
  if (error) return error

  const { id } = await params

  const { data, error: dbErr } = await adminClient
    .from('prospect_stage_history')
    .select(`
      id, changed_at, changed_by,
      from_stage:from_stage_id(id, name),
      to_stage:to_stage_id(id, name)
    `)
    .eq('prospect_id', id)
    .order('changed_at', { ascending: false })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  if (!data?.length) return Response.json([])

  // Enrich changed_by with display names from profiles (auth.users not exposed by PostgREST)
  const changerIds = [...new Set(data.map(r => r.changed_by).filter(Boolean))]
  const { data: profiles } = changerIds.length
    ? await adminClient.from('profiles').select('id, full_name, email').in('user_id', changerIds)
    : { data: [] }

  const profileById: Record<string, { full_name: string; email: string }> = {}
  for (const p of profiles ?? []) profileById[p.id] = p

  const enriched = data.map(r => ({
    ...r,
    changer: r.changed_by ? (profileById[r.changed_by] ?? { full_name: null, email: null }) : null,
  }))

  return Response.json(enriched)
}

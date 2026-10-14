import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const url = new URL(request.url)
  const entityType = url.searchParams.get('entity_type')
  const entityId = url.searchParams.get('entity_id')

  if (!entityType || !entityId)
    return Response.json({ error: 'entity_type and entity_id are required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('activity_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  // Resolve actor emails
  const actorIds = [...new Set((data ?? []).map((r: { actor_id: string | null }) => r.actor_id).filter(Boolean))] as string[]
  const emailById: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: { users } } = await adminClient.auth.admin.listUsers()
    for (const u of users) {
      if (actorIds.includes(u.id)) emailById[u.id] = u.email ?? u.id
    }
  }

  const enriched = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    actor_email: r.actor_id ? (emailById[r.actor_id as string] ?? null) : null,
  }))

  return Response.json(enriched)
}

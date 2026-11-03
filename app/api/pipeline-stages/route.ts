import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

/** GET /api/pipeline-stages â€” all stages, sorted by display_order */
export async function GET(request: Request) {
  const { error } = await requireRole(request, ['super_admin', 'admin', 'bd_manager', 'bd_executive', 'viewer'])
  if (error) return error

  const { data, error: dbErr } = await adminClient
    .from('pipeline_stages')
    .select('*')
    .order('display_order', { ascending: true })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

/** POST /api/pipeline-stages â€” create new stage (admin only) */
export async function POST(request: Request) {
  const { error } = await requireRole(request, ['super_admin', 'admin'])
  if (error) return error

  const body = await request.json()
  const { name, display_order, default_probability, is_won, is_lost } = body

  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 })
  if (display_order == null) return Response.json({ error: 'display_order is required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('pipeline_stages')
    .insert({
      name: name.trim(),
      display_order: Number(display_order),
      default_probability: Number(default_probability ?? 0),
      is_won: Boolean(is_won),
      is_lost: Boolean(is_lost),
      is_active: true,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

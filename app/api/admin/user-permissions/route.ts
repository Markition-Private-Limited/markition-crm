import { adminClient } from '@/lib/supabase/admin'
import { requireAuth, forbidden } from '@/lib/auth/require-role'

const VALID_PERMISSIONS = [
  'delete_prospects',
  'manage_users',
  'manage_settings',
  'view_audit_logs',
  'add_prospects',
] as const

/** GET /api/admin/user-permissions — list all grants (super_admin only) */
export async function GET(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'super_admin') return forbidden()

  const { data, error: dbErr } = await adminClient
    .from('user_permissions')
    .select('id, user_id, permission_name, granted_by, created_at')
    .order('created_at', { ascending: false })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

/** POST /api/admin/user-permissions — grant a permission (super_admin only) */
export async function POST(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'super_admin') return forbidden()

  const body = await request.json()
  const { user_id, permission_name } = body

  if (!user_id || !permission_name) {
    return Response.json({ error: 'user_id and permission_name are required' }, { status: 400 })
  }
  if (!(VALID_PERMISSIONS as readonly string[]).includes(permission_name)) {
    return Response.json(
      { error: `Invalid permission. Valid: ${VALID_PERMISSIONS.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error: dbErr } = await adminClient
    .from('user_permissions')
    .insert({ user_id, permission_name, granted_by: ctx.userId })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}

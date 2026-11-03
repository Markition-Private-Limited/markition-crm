import { adminClient } from '@/lib/supabase/admin'
import { requireAuth, forbidden } from '@/lib/auth/require-role'

/** GET /api/admin/user-permissions/[userId] — list permissions for one user */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'super_admin' && ctx.role !== 'admin') return forbidden()

  const { userId } = await params
  const { data, error: dbErr } = await adminClient
    .from('user_permissions')
    .select('id, permission_name, granted_by, created_at')
    .eq('user_id', userId)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

/** DELETE /api/admin/user-permissions/[userId]?permission=delete_prospects — revoke (super_admin only) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'super_admin') return forbidden()

  const { userId } = await params
  const url = new URL(request.url)
  const permission = url.searchParams.get('permission')

  if (!permission) {
    return Response.json({ error: '?permission=<name> is required' }, { status: 400 })
  }

  const { error: dbErr } = await adminClient
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('permission_name', permission)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return new Response(null, { status: 204 })
}

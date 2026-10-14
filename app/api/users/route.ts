import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const { data: userList, error: listErr } = await adminClient.auth.admin.listUsers()
  if (listErr) return Response.json({ error: listErr.message }, { status: 500 })

  const { data: userRoles } = await adminClient
    .from('user_roles')
    .select('user_id, app_roles(name)')

  const roleByUser: Record<string, string> = {}
  if (userRoles) {
    for (const row of (userRoles as unknown) as Array<{ user_id: string; app_roles: { name: string } | null }>) {
      if (row.app_roles) roleByUser[row.user_id] = row.app_roles.name
    }
  }

  const users = userList.users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    role: roleByUser[u.id] ?? null,
  }))

  // Sales can only see themselves
  if (ctx.role === 'sales') {
    return Response.json(users.filter((u) => u.id === ctx.userId))
  }

  return Response.json(users)
}

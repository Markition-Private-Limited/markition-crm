import { adminClient } from '@/lib/supabase/admin'

/** Returns the auth.uid() values of all BD Executives under a BD Manager. */
export async function getTeamMemberIds(managerId: string): Promise<string[]> {
  const { data, error } = await adminClient
    .from('team_members')
    .select('user_id, teams!inner(manager_id)')
    .eq('teams.manager_id', managerId)

  if (error || !data) return []
  return data.map((r: { user_id: string }) => r.user_id)
}

/** Returns the viewer_filters.filter_config for a Viewer user, or null if unset. */
export async function getViewerFilter(userId: string): Promise<Record<string, string> | null> {
  const { data, error } = await adminClient
    .from('viewer_filters')
    .select('filter_config')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return (data.filter_config as Record<string, string>) ?? null
}

/** Returns the set of permission names granted to a user. */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const { data, error } = await adminClient
    .from('user_permissions')
    .select('permission_name')
    .eq('user_id', userId)

  if (error || !data) return new Set()
  return new Set(data.map((r: { permission_name: string }) => r.permission_name))
}

/** Returns true if a specific permission has been granted to a user. */
export async function userHasPermission(userId: string, permission: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from('user_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('permission_name', permission)
    .maybeSingle()

  return !error && !!data
}

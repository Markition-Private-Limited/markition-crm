import { getAuthContext } from '@/lib/auth/require-role'
import { adminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the stored display name from profiles — fall back to email-derived name
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle()

  let displayName = profile?.full_name ?? ''
  if (!displayName) {
    const namePart = ctx.email?.split('@')[0] ?? 'User'
    displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._-]/g, ' ')
  }

  return Response.json({
    userId: ctx.userId,
    email: ctx.email,
    role: ctx.role,
    roleName: ctx.roleName,
    displayName,
  })
}

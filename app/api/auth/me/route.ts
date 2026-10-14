import { getAuthContext } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const namePart = ctx.email?.split('@')[0] ?? 'User'
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._-]/g, ' ')

  return Response.json({
    userId: ctx.userId,
    email: ctx.email,
    role: ctx.role,
    roleName: ctx.roleName,
    displayName,
  })
}

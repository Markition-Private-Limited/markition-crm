import { adminClient } from '@/lib/supabase/admin'

// Five BRD roles — matches app_roles.name in the DB
export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'bd_manager'
  | 'bd_executive'
  | 'viewer'

// Maps DB role names (lowercase) → AppRole enum value.
// Includes legacy names so any residual old-role users still resolve correctly.
const ROLE_MAP: Record<string, AppRole> = {
  // Current BRD roles
  'superadministrator': 'super_admin',
  'administrator':      'admin',
  'bd manager':         'bd_manager',
  'bd executive':       'bd_executive',
  'viewer':             'viewer',
  // Legacy fallbacks (kept until all rows are migrated)
  'super admin':        'super_admin',
  'admin':              'admin',
  'project manager':    'bd_manager',
  'sales manager':      'bd_manager',
  'sales executive':    'bd_executive',
  'sales':              'bd_executive',
  'employee':           'viewer',
  'accountant':         'viewer',
}

export interface AuthContext {
  userId: string
  email: string | undefined
  role: AppRole
  roleName: string
}

// Cache keyed by userId, TTL 60s
const ctxCache = new Map<string, { ctx: AuthContext; expiresAt: number }>()
const CTX_TTL_MS = 60_000

function decodeJwt(token: string): { sub?: string; exp?: number; email?: string } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return getAuthContextFromToken(authHeader.slice(7))
}

export async function getAuthContextFromToken(token: string): Promise<AuthContext | null> {
  const payload = decodeJwt(token)
  if (!payload?.sub) return null
  if (payload.exp && payload.exp * 1000 < Date.now()) return null

  const cached = ctxCache.get(payload.sub)
  if (cached && cached.expiresAt > Date.now()) return cached.ctx

  const [userRoleResult, { data: adminUser, error: adminErr }] = await Promise.all([
    adminClient
      .from('user_roles')
      .select('role_id')
      .eq('user_id', payload.sub)
      .limit(1)
      .single(),
    adminClient.auth.admin.getUserById(payload.sub),
  ])

  if (adminErr || !adminUser?.user) return null
  if (!userRoleResult.data) return null

  const user = adminUser.user

  const { data: roleRow } = await adminClient
    .from('app_roles')
    .select('name')
    .eq('id', userRoleResult.data.role_id)
    .single()

  const roleName = roleRow?.name as string | undefined
  if (!roleName) return null

  const appRole = ROLE_MAP[roleName.toLowerCase()]
  if (!appRole) return null

  const ctx: AuthContext = { userId: user.id, email: user.email, role: appRole, roleName }

  const tokenTtl = payload.exp ? payload.exp * 1000 - Date.now() : CTX_TTL_MS
  ctxCache.set(user.id, { ctx, expiresAt: Date.now() + Math.min(CTX_TTL_MS, tokenTtl) })

  return ctx
}

export function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function requireRole(
  request: Request,
  allowed: AppRole[]
): Promise<{ ctx: AuthContext; error?: never } | { ctx?: never; error: Response }> {
  const ctx = await getAuthContext(request)
  if (!ctx) return { error: unauthorized() }
  if (!allowed.includes(ctx.role)) return { error: forbidden() }
  return { ctx }
}

// Convenience — allow any authenticated user (still fails if no valid role)
export async function requireAuth(
  request: Request
): Promise<{ ctx: AuthContext; error?: never } | { ctx?: never; error: Response }> {
  const ctx = await getAuthContext(request)
  if (!ctx) return { error: unauthorized() }
  return { ctx }
}

// Invalidate cached context for a user (call after role changes)
export function invalidateAuthCache(userId: string) {
  ctxCache.delete(userId)
}

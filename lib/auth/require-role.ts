import { adminClient } from '@/lib/supabase/admin'

export type AppRole = 'admin' | 'project_manager' | 'sales'

const ROLE_MAP: Record<string, AppRole> = {
  'super admin': 'admin',
  'admin': 'admin',
  'project manager': 'project_manager',
  'sales manager': 'sales',
  'sales executive': 'sales',
  'sales': 'sales',
}

export interface AuthContext {
  userId: string
  email: string | undefined
  role: AppRole
  roleName: string
}

// Cache keyed by userId (stable across token refreshes), TTL 60s
const ctxCache = new Map<string, { ctx: AuthContext; expiresAt: number }>()
const CTX_TTL_MS = 60_000

// Decode JWT payload without verification — only used to get sub/exp for cache lookup.
// Actual signature verification still happens via adminClient.auth.getUser on cache miss.
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

// Shared by API routes (Bearer header) and proxy.ts (session cookie).
export async function getAuthContextFromToken(token: string): Promise<AuthContext | null> {
  // Decode locally — O(1), no network
  const payload = decodeJwt(token)
  if (!payload?.sub) return null

  // Reject expired tokens immediately without a network call
  if (payload.exp && payload.exp * 1000 < Date.now()) return null

  // Cache hit — keyed by userId so it survives access token refreshes
  const cached = ctxCache.get(payload.sub)
  if (cached && cached.expiresAt > Date.now()) return cached.ctx

  // Cache miss — verify signature AND fetch role_id in parallel (use JWT sub for role lookup)
  const [{ data: { user }, error }, userRoleResult] = await Promise.all([
    adminClient.auth.getUser(token),
    adminClient
      .from('user_roles')
      .select('role_id')
      .eq('user_id', payload.sub)
      .limit(1)
      .single(),
  ])

  if (error || !user) return null
  if (!userRoleResult.data) return null

  // Single PK lookup — fast
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

  // TTL is the lesser of CTX_TTL_MS and remaining token lifetime
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

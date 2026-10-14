// httpOnly cookie that carries the Supabase access token so proxy.ts can
// verify the session on the server. Set by POST /api/auth/session, cleared
// by DELETE /api/auth/session. The browser session itself stays in supabase-js.
export const SESSION_COOKIE = 'mk_session'

export function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
}

export function clearSessionCookie(): string {
  return buildSessionCookie('', 0)
}

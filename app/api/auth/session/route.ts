import { getAuthContextFromToken } from '@/lib/auth/require-role'
import { buildSessionCookie, clearSessionCookie } from '@/lib/auth/session-cookie'

// Sets the httpOnly session cookie after login and on token refresh.
// Only a token that resolves to a mapped app role gets a cookie.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const ctx = token ? await getAuthContextFromToken(token) : null

  if (!token || !ctx) {
    const res = Response.json({ error: 'Unauthorized' }, { status: 401 })
    res.headers.append('Set-Cookie', clearSessionCookie())
    return res
  }

  const exp = decodeExp(token)
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 3600

  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', buildSessionCookie(token, maxAge))
  return res
}

// Clears the cookie on sign-out. No auth needed: clearing is always safe.
export async function DELETE() {
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', clearSessionCookie())
  return res
}

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

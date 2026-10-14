// Client-side GET cache — 30s TTL, cleared on any mutation
// Only active in the browser; server-side imports skip caching entirely.
const _cache = typeof window !== "undefined"
  ? new Map<string, { data: unknown; expiresAt: number }>()
  : null
const CACHE_TTL = 30_000

async function apiFetch(method: string, path: string, token: string | null, body?: unknown) {
  const isGet = method === "GET"

  if (isGet && _cache) {
    const hit = _cache.get(path)
    if (hit && hit.expiresAt > Date.now()) return hit.data
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`)

  if (isGet && _cache) {
    _cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL })
  } else if (!isGet && _cache) {
    _cache.clear()
  }

  return data
}

export const apiGet    = (path: string, token: string | null) => apiFetch("GET",    path, token)
export const apiPost   = (path: string, token: string | null, body: unknown) => apiFetch("POST",   path, token, body)
export const apiPut    = (path: string, token: string | null, body: unknown) => apiFetch("PUT",    path, token, body)
export const apiPatch  = (path: string, token: string | null, body: unknown) => apiFetch("PATCH",  path, token, body)
export const apiDelete = (path: string, token: string | null, body?: unknown) => apiFetch("DELETE", path, token, body)

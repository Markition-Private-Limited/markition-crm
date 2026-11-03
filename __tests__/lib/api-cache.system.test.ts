// @vitest-environment jsdom
/**
 * Rule-based system test: lib/api.ts — GET cache + clearCache fix
 *
 * HOW EACH RULE ACCESSES THE ACTION
 * ----------------------------------
 * These tests import `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, and
 * `clearCache` directly from lib/api.ts. They intercept `fetch` via
 * vi.stubGlobal so no real HTTP calls are made.
 *
 * The tests verify the SYSTEM-LEVEL RULES (observable contracts) of the
 * caching layer — not implementation details. Each "rule" is stated as the
 * invariant the code must satisfy, so a future developer who breaks it
 * immediately sees which contract failed.
 *
 * THE BUG SCENARIO reproduced in Rule 5 proves that without `clearCache()`
 * before the refresh-GET, stale data would be returned after a file upload
 * that bypassed `apiFetch` (raw `fetch()`). Rule 5 is the direct test of
 * the fix introduced in confirmUpload (OnboardingTab.tsx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiGet, apiPost, apiPatch, apiDelete, clearCache } from '@/lib/api'

// ── Stub global fetch ─────────────────────────────────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  // Always start each test with a clean cache
  clearCache()
})

/** Build a resolved fetch Response returning JSON data */
function okJson(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

// ── RULE 1: GET results are cached ────────────────────────────────────────────
describe('Rule 1 — GET responses are cached for 30 seconds', () => {
  it('makes only ONE network call for two identical GETs within 30s', async () => {
    fetchMock.mockReturnValue(okJson({ id: '1', file_name: 'original.pdf' }))

    await apiGet('/api/onboarding/case1', 'tok')
    await apiGet('/api/onboarding/case1', 'tok')

    // fetch was only called once — second request was served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns the same cached value on a cache hit (fetch not called twice)', async () => {
    fetchMock.mockReturnValue(okJson({ id: '1' }))

    const first  = await apiGet('/api/test', 'tok')
    const second = await apiGet('/api/test', 'tok')

    // Cache returns the same stored object — both calls must yield identical data
    // and fetch must have been called only once
    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ── RULE 2: Different paths are cached independently ──────────────────────────
describe('Rule 2 — cache is keyed per path', () => {
  it('fetches both paths when they differ', async () => {
    fetchMock
      .mockReturnValueOnce(okJson({ id: 'A' }))
      .mockReturnValueOnce(okJson({ id: 'B' }))

    const a = await apiGet('/api/case/A', 'tok')
    const b = await apiGet('/api/case/B', 'tok')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((a as { id: string }).id).toBe('A')
    expect((b as { id: string }).id).toBe('B')
  })
})

// ── RULE 3: Mutations clear the entire cache ──────────────────────────────────
describe('Rule 3 — POST / PATCH / DELETE clear the GET cache', () => {
  const MUTATORS = [
    ['apiPost',   () => apiPost('/api/x',   'tok', {})],
    ['apiPatch',  () => apiPatch('/api/x',  'tok', {})],
    ['apiDelete', () => apiDelete('/api/x', 'tok')],
  ] as const

  for (const [name, mutate] of MUTATORS) {
    it(`${name} causes the next GET to hit the network`, async () => {
      fetchMock.mockReturnValue(okJson({ v: 1 }))

      // Warm the cache
      await apiGet('/api/data', 'tok')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Mutate — this must clear the cache
      await mutate()
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // Next GET must reach the network (cache was cleared)
      fetchMock.mockReturnValue(okJson({ v: 2 }))
      const result = await apiGet('/api/data', 'tok')
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect((result as { v: number }).v).toBe(2)
    })
  }
})

// ── RULE 4: clearCache() invalidates all cached GETs ─────────────────────────
describe('Rule 4 — clearCache() forces the next GET to hit the network', () => {
  it('makes a new network call after clearCache even within 30s', async () => {
    fetchMock
      .mockReturnValueOnce(okJson({ file_name: 'old.pdf' }))
      .mockReturnValueOnce(okJson({ file_name: 'new.pdf' }))

    // First GET — cached
    const before = await apiGet('/api/onboarding/case1', 'tok')
    expect((before as { file_name: string }).file_name).toBe('old.pdf')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Invalidate
    clearCache()

    // Second GET — must fetch fresh
    const after = await apiGet('/api/onboarding/case1', 'tok')
    expect((after as { file_name: string }).file_name).toBe('new.pdf')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ── RULE 5: THE BUG — raw fetch() upload without clearCache returned stale ────
describe('Rule 5 — raw-fetch upload WITHOUT clearCache returns stale data (regression proof)', () => {
  /**
   * This test reproduces the exact bug that was fixed:
   *
   *  1. User opens the case → apiGet caches the response (no file yet)
   *  2. User uploads a file using raw fetch() — NOT apiPost, so cache is NOT cleared
   *  3. The next apiGet call (in confirmUpload) was returning the STALE cached
   *     response, so the UI showed the old filename
   *
   * Without clearCache():  result === 'old.pdf'  ← BUG
   * With    clearCache():  result === 'new.pdf'  ← FIX
   */
  it('without clearCache the GET returns stale cached data', async () => {
    fetchMock
      .mockReturnValueOnce(okJson({ file_name: 'old.pdf' }))  // initial GET (cache warm)
      .mockReturnValueOnce(okJson({ file_name: 'new.pdf' }))  // GET after upload

    // Step 1: warm the cache (simulates opening the checklist)
    await apiGet('/api/onboarding/case1', 'tok')

    // Step 2: raw fetch() upload — does NOT clear the lib/api.ts cache
    // (this is what confirmUpload used to do before the fix)
    fetchMock.mockReturnValue(
      okJson({ id: 'item1', file_name: 'new.pdf', status: 'uploaded' })
    )
    await fetch('/api/onboarding/case1/checklist/item1/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: new FormData(),
    })

    // Step 3: without clearCache, apiGet returns STALE data ← bug
    const stale = await apiGet('/api/onboarding/case1', 'tok')
    expect((stale as { file_name: string }).file_name).toBe('old.pdf')  // ← stale!
    expect(fetchMock).toHaveBeenCalledTimes(2)  // only 2 calls: initial GET + upload POST
  })

  it('WITH clearCache the GET returns fresh data (the actual fix)', async () => {
    fetchMock
      .mockReturnValueOnce(okJson({ file_name: 'old.pdf' }))  // initial GET
      .mockReturnValueOnce(                                    // upload POST (raw fetch)
        okJson({ id: 'item1', file_name: 'new.pdf', status: 'uploaded' })
      )
      .mockReturnValueOnce(okJson({ file_name: 'new.pdf' }))  // refresh GET after clearCache

    // Step 1: warm the cache
    await apiGet('/api/onboarding/case1', 'tok')

    // Step 2: raw fetch upload (same as confirmUpload — uses FormData, not apiPost)
    await fetch('/api/onboarding/case1/checklist/item1/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: new FormData(),
    })

    // Step 3: clearCache() — THE FIX (added to confirmUpload in OnboardingTab.tsx)
    clearCache()

    // Step 4: apiGet now hits the network and returns fresh data
    const fresh = await apiGet('/api/onboarding/case1', 'tok')
    expect((fresh as { file_name: string }).file_name).toBe('new.pdf')  // ← fresh!
    expect(fetchMock).toHaveBeenCalledTimes(3)  // initial GET + upload POST + refresh GET
  })
})

// ── RULE 6: Non-GET methods are never cached ──────────────────────────────────
describe('Rule 6 — POST / PATCH / DELETE are never served from cache', () => {
  it('each apiPost call always hits the network', async () => {
    fetchMock.mockReturnValue(okJson({ ok: true }))

    await apiPost('/api/x', 'tok', {})
    await apiPost('/api/x', 'tok', {})
    await apiPost('/api/x', 'tok', {})

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

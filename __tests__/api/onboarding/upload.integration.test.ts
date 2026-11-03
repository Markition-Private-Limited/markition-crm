/**
 * Integration test: POST /api/onboarding/[id]/checklist/[itemId]/upload
 *
 * HOW EACH RULE ACCESSES THE ACTION
 * ----------------------------------
 * Every test creates a real Next.js Request with a multipart FormData body,
 * calls the actual route handler (POST) exported from the route file, and
 * asserts on the Response. Supabase is mocked so no real DB or Storage is
 * touched — the tests run fully offline.
 *
 * The mock chain works like this:
 *   requireAuth  →  returns a fake AuthContext  (role / userId)
 *   adminClient  →  .from(...).select/update/single  returns fake DB rows
 *                   .storage.from(...).upload / listBuckets / createBucket
 *                   .storage.from(...).getPublicUrl  returns a fake URL
 *
 * Each "rule" is one describe block: it wires the mocks for that scenario,
 * calls POST(), and checks status + body.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock requireAuth so tests can control role/userId without a real JWT
vi.mock('@/lib/auth/require-role', () => ({
  requireAuth: vi.fn(),
}))

// Mock adminClient so no real Supabase calls are made
vi.mock('@/lib/supabase/admin', () => ({
  adminClient: {
    from: vi.fn(),
    storage: {
      listBuckets: vi.fn(),
      createBucket: vi.fn(),
      from: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/onboarding/[id]/checklist/[itemId]/upload/route'
import { requireAuth } from '@/lib/auth/require-role'
import { adminClient } from '@/lib/supabase/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Next.js-compatible Request with a multipart body */
function makeUploadRequest(file: File, token = 'tok'): Request {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost/api/onboarding/case1/checklist/item1/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
}

/** Route params (Next.js 16 passes params as a Promise) */
const PARAMS = { params: Promise.resolve({ id: 'case1', itemId: 'item1' }) }

const mockAuth = requireAuth as ReturnType<typeof vi.fn>

/** Wire up happy-path mocks */
function setupHappyPath(role = 'admin', ownerId = 'user-1') {
  mockAuth.mockResolvedValue({
    ctx: { userId: 'user-1', role, email: 'admin@test.com' },
    error: null,
  })

  const mockFrom = adminClient.from as ReturnType<typeof vi.fn>

  // First .from call: checklist item lookup
  // Second .from call: onboarding case lookup
  // Third .from call: DB update
  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      // item lookup
      return {
        select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: { id: 'item1', case_id: 'case1', status: 'not_uploaded' } }) }) }) }),
      }
    }
    if (callCount === 2) {
      // case lookup
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'case1', owner_id: ownerId, status: 'in_progress' } }) }) }),
      }
    }
    // DB update
    return {
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: 'item1',
                case_id: 'case1',
                status: 'uploaded',
                file_name: 'test.pdf',
                file_url: 'https://storage.example.com/test.pdf',
                uploaded_at: '2026-11-04T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    }
  })

  // Storage mocks
  const storageMock = adminClient.storage as typeof adminClient.storage & {
    listBuckets: ReturnType<typeof vi.fn>
    createBucket: ReturnType<typeof vi.fn>
    from: ReturnType<typeof vi.fn>
  }
  storageMock.listBuckets.mockResolvedValue({ data: [{ name: 'onboarding-docs' }] })
  storageMock.from.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/test.pdf' } }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── RULE 1: Happy path ────────────────────────────────────────────────────────
describe('Rule 1 — successful upload returns 200 with updated item', () => {
  it('returns the updated checklist item as JSON', async () => {
    setupHappyPath()
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })
    const req = makeUploadRequest(file)

    const res = await POST(req, PARAMS)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('uploaded')
    expect(body.file_name).toBe('test.pdf')
    expect(body.file_url).toContain('storage.example.com')
  })
})

// ── RULE 2: Viewer is blocked ─────────────────────────────────────────────────
describe('Rule 2 — viewer role is forbidden', () => {
  it('returns 403 when role is viewer', async () => {
    mockAuth.mockResolvedValue({
      ctx: { userId: 'u2', role: 'viewer', email: 'viewer@test.com' },
      error: null,
    })

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeUploadRequest(file), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Forbidden')
  })
})

// ── RULE 3: Unauthenticated request ───────────────────────────────────────────
describe('Rule 3 — unauthenticated request is rejected', () => {
  it('returns the error Response from requireAuth', async () => {
    const fakeError = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockAuth.mockResolvedValue({ ctx: null, error: fakeError })

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeUploadRequest(file, ''), PARAMS)

    expect(res.status).toBe(401)
  })
})

// ── RULE 4: Approved items cannot be replaced ─────────────────────────────────
describe('Rule 4 — cannot upload to an already-approved item', () => {
  it('returns 422 when item.status is approved', async () => {
    mockAuth.mockResolvedValue({
      ctx: { userId: 'user-1', role: 'admin', email: 'admin@test.com' },
      error: null,
    })

    let call = 0
    ;(adminClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      call++
      if (call === 1) {
        // item with status=approved
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: { id: 'item1', case_id: 'case1', status: 'approved' } }) }) }) }),
        }
      }
      // case
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'case1', owner_id: 'user-1', status: 'in_progress' } }) }) }),
      }
    })

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeUploadRequest(file), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toMatch(/approved/i)
  })
})

// ── RULE 5: File size limit ────────────────────────────────────────────────────
describe('Rule 5 — files larger than 20 MB are rejected', () => {
  it('returns 413 for oversized files', async () => {
    setupHappyPath()

    // Create an actual 21 MB buffer so .size is genuinely > 20 MB
    const bigFile = new File([new Uint8Array(21 * 1024 * 1024)], 'huge.zip', { type: 'application/zip' })

    const res = await POST(makeUploadRequest(bigFile), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(413)
    expect(body.error).toMatch(/20 MB/i)
  })
})

// ── RULE 6: Case must be in_progress ──────────────────────────────────────────
describe('Rule 6 — cannot upload to a finalized case', () => {
  it('returns 422 when case.status is approved', async () => {
    mockAuth.mockResolvedValue({
      ctx: { userId: 'user-1', role: 'admin', email: 'admin@test.com' },
      error: null,
    })

    let call = 0
    ;(adminClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      call++
      if (call === 1) {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: { id: 'item1', case_id: 'case1', status: 'not_uploaded' } }) }) }) }),
        }
      }
      // case is approved (finalized)
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'case1', owner_id: 'user-1', status: 'approved' } }) }) }),
      }
    })

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeUploadRequest(file), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toMatch(/finalized/i)
  })
})

// ── RULE 7: bd_executive can only upload to their own cases ───────────────────
describe('Rule 7 — bd_executive cannot upload to someone else\'s case', () => {
  it('returns 403 when owner_id differs from userId', async () => {
    mockAuth.mockResolvedValue({
      ctx: { userId: 'exec-1', role: 'bd_executive', email: 'exec@test.com' },
      error: null,
    })

    let call = 0
    ;(adminClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      call++
      if (call === 1) {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: { id: 'item1', case_id: 'case1', status: 'not_uploaded' } }) }) }) }),
        }
      }
      // owner is different user
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'case1', owner_id: 'other-user', status: 'in_progress' } }) }) }),
      }
    })

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' })
    const res = await POST(makeUploadRequest(file), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(403)
  })
})

// ── RULE 8: Missing file field returns 400 ────────────────────────────────────
describe('Rule 8 — request missing the file field returns 400', () => {
  it('returns 400 when no file is appended', async () => {
    setupHappyPath()

    // Send FormData with no file field
    const emptyForm = new FormData()
    const req = new Request('http://localhost/api/onboarding/case1/checklist/item1/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: emptyForm,
    })

    const res = await POST(req, PARAMS)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no file/i)
  })
})

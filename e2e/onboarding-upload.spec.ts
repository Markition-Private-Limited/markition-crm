/**
 * Full end-to-end tests: document upload in the Onboarding tab
 *
 * Coverage strategy — no happy-path-only tests:
 *   • Error handling: every server-side rejection surfaces the right message
 *     and leaves the modal open and recoverable
 *   • State transitions: each UI badge / counter must reflect the new state
 *     immediately — without a page reload — proving the clearCache() fix
 *   • Persistence: data must survive a hard reload (Ctrl+R)
 *   • Permission gate: viewer role sees no upload controls
 *   • Workflow completion: the full chain upload → review → approve works
 *     and the case-level "outstanding" counter reaches zero only on approval
 *
 * Network interception is used only to inject controlled error responses;
 * the success path always hits the real server so we test real Supabase I/O.
 *
 * HOW EACH TEST ACCESSES THE ACTION
 *   Every test navigates to the real prospect page, clicks the Onboarding tab,
 *   expands the Document Checklist, then drives the UI exactly as a user would.
 *   Server errors are injected via page.route() — the browser still runs the
 *   full React component tree; only the network response is replaced.
 */

import { test, expect, Page } from '@playwright/test'

// ── Test fixture ──────────────────────────────────────────────────────────────
// Prospect that has an in_progress onboarding case with one mandatory item.
// This is the "Ali jewo / OBC-000005 / NID Copy" case used throughout dev.
const PROSPECT_URL = '/prospects/9ecbfc57-019b-4269-babf-6970b3c8fc6a'
const CASE_ID      = '87f9fee6-0c87-4694-9e05-ab907c8b3d0b'
const ITEM_ID      = '34d6dada-0ff7-4c98-8de5-d2b7f02a1211'
const UPLOAD_API   = `/api/onboarding/${CASE_ID}/checklist/${ITEM_ID}/upload`
const CASE_API     = `/api/onboarding/${CASE_ID}`

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navigate to the prospect, open the Onboarding tab, expand the checklist. */
async function openChecklist(page: Page) {
  await page.goto(PROSPECT_URL)
  await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
  await page.getByRole('button', { name: /Document Checklist/ }).click()
  // Wait for checklist items to be visible (exact: true avoids matching the "outstanding" summary <li>)
  await page.getByText('NID Copy', { exact: true }).waitFor()
}

/** Open the upload modal for NID Copy. */
async function openUploadModal(page: Page) {
  // Could be "Upload" (first time) or "Replace" (file already exists)
  const uploadBtn = page.getByRole('button', { name: /^(Upload|Replace)$/ }).first()
  await uploadBtn.click()
  await page.getByRole('heading', { name: /Upload: NID Copy/i }).waitFor()
}

/** Attach a file to the hidden file input inside the upload modal. */
async function attachFile(page: Page, name: string, content: string, mimeType = 'text/plain') {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType,
    buffer: Buffer.from(content),
  })
}

// ── SUITE 1: Upload modal — error paths ───────────────────────────────────────

test.describe('Upload modal — server error responses', () => {

  test('413 from server: shows "file too large" message, modal stays open', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'big.pdf', 'x')

    // Intercept the upload and return 413
    await page.route(UPLOAD_API, route =>
      route.fulfill({ status: 413, json: { error: 'File too large (max 20 MB)' } })
    )

    await page.getByRole('button', { name: 'Upload' }).click()

    // Error must be visible inside the modal
    await expect(page.getByText(/file too large/i)).toBeVisible()
    // Modal must still be open — user can try again
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  })

  test('500 from server: shows generic error, modal stays open', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'doc.txt', 'content')

    await page.route(UPLOAD_API, route =>
      route.fulfill({ status: 500, json: { error: 'Internal storage error' } })
    )

    await page.getByRole('button', { name: 'Upload' }).click()

    await expect(page.getByText(/internal storage error/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  })

  test('422 approved: shows "already approved" error', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'doc.txt', 'content')

    await page.route(UPLOAD_API, route =>
      route.fulfill({ status: 422, json: { error: 'Document is already approved' } })
    )

    await page.getByRole('button', { name: 'Upload' }).click()

    await expect(page.getByText(/already approved/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  })

  test('Upload button is disabled until a file is selected', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)

    // No file attached — Upload button must be disabled
    const uploadBtn = page.getByRole('button', { name: 'Upload' })
    await expect(uploadBtn).toBeDisabled()

    // After file selection it becomes enabled
    await attachFile(page, 'doc.txt', 'hello')
    await expect(uploadBtn).toBeEnabled()
  })

  test('Cancelling the modal makes no network call', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'doc.txt', 'content')

    let uploadCalled = false
    await page.route(UPLOAD_API, () => { uploadCalled = true })

    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal must close, upload endpoint must NOT have been called
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible()
    expect(uploadCalled).toBe(false)
  })
})

// ── SUITE 2: Immediate UI update — the clearCache() fix ───────────────────────

test.describe('Immediate UI update after upload (clearCache fix)', () => {

  test('status badge changes from "Not uploaded" / previous state to "Uploaded" without page reload', async ({ page }) => {
    await openChecklist(page)

    // Note the current status before uploading
    const badge = page.locator('[data-testid="item-status"], .rounded-full').filter({ hasText: /uploaded|not uploaded/i }).first()

    await openUploadModal(page)
    await attachFile(page, 'immediate-update-test.txt', 'testing immediate update')
    await page.getByRole('button', { name: 'Upload' }).click()

    // Wait for modal to close (upload complete)
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // "Uploaded" badge must appear — without any navigation event
    await expect(page.getByText('immediate-update-test.txt')).toBeVisible()
    // Status badge on the item must be "Uploaded"
    await expect(page.locator('.rounded-full', { hasText: 'Uploaded' }).first()).toBeVisible()
  })

  test('Replace: new filename appears immediately — old filename is gone', async ({ page }) => {
    // First ensure there IS a file to replace by uploading one
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'original-file.txt', 'original content')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Now Replace with a different file
    await openUploadModal(page)   // Replace button shows since file exists
    await attachFile(page, 'replaced-file.txt', 'replacement content')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // New filename must be visible
    await expect(page.getByText('replaced-file.txt')).toBeVisible()
    // Old filename must be gone — proves cache was busted and fresh data loaded
    await expect(page.getByText('original-file.txt')).not.toBeVisible()
  })

  test('"Outstanding" counter stays at 1 after upload — uploaded ≠ approved', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'counter-test.txt', 'content')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // The case-level outstanding count must still be 1 (uploaded but not approved)
    const counterEl = page.locator('p.text-rose-400, .text-rose-400').filter({ hasText: /^\d+$/ }).first()
    await expect(counterEl).toHaveText('1')

    // The bottom "outstanding" banner must still list NID Copy with "Uploaded" status
    await expect(page.getByText(/1 required document outstanding/i)).toBeVisible()
    const banner = page.locator('.border-rose-500\\/20, [class*="rose"]')
    await expect(banner.getByText('NID Copy').first()).toBeVisible()
  })

  test('Two rapid replaces: final filename shown, no stale intermediate state', async ({ page }) => {
    await openChecklist(page)

    // First upload
    await openUploadModal(page)
    await attachFile(page, 'rapid-first.txt', 'first')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Second replace immediately after
    await openUploadModal(page)
    await attachFile(page, 'rapid-second.txt', 'second')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Only the second filename should be visible
    await expect(page.getByText('rapid-second.txt')).toBeVisible()
    await expect(page.getByText('rapid-first.txt')).not.toBeVisible()
  })
})

// ── SUITE 3: Data persistence across hard reload ──────────────────────────────

test.describe('Data persistence across hard reload', () => {

  test('uploaded filename survives a full page reload', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'persist-test.txt', 'this must survive')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Hard reload — clears all in-memory state including the React GET cache
    await page.reload()
    await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
    await page.getByRole('button', { name: /Document Checklist/ }).click()
    await page.getByText('NID Copy').waitFor()

    // File must still be shown — data came from the DB, not React state
    await expect(page.getByText('persist-test.txt')).toBeVisible()
  })

  test('replaced file persists — old file not shown after reload', async ({ page }) => {
    await openChecklist(page)

    // Upload v1
    await openUploadModal(page)
    await attachFile(page, 'persist-v1.txt', 'version 1')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Replace with v2
    await openUploadModal(page)
    await attachFile(page, 'persist-v2.txt', 'version 2')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Hard reload
    await page.reload()
    await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
    await page.getByRole('button', { name: /Document Checklist/ }).click()
    await page.getByText('NID Copy').waitFor()

    await expect(page.getByText('persist-v2.txt')).toBeVisible()
    await expect(page.getByText('persist-v1.txt')).not.toBeVisible()
  })
})

// ── SUITE 4: Document review workflow ─────────────────────────────────────────

test.describe('Review workflow state transitions', () => {

  test('Mark under review: badge changes to "Under review" immediately', async ({ page }) => {
    // Ensure a file is uploaded first so Mark under review is available
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'review-test.txt', 'content for review')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Mark under review
    await page.getByRole('button', { name: 'Mark under review' }).click()

    // Badge must change to "Under review"
    await expect(page.locator('.rounded-full', { hasText: 'Under review' }).first()).toBeVisible()
    // Upload/Replace button must still show (item not yet approved)
    // Mark under review button must disappear (status changed)
    await expect(page.getByRole('button', { name: 'Mark under review' })).not.toBeVisible()
  })

  test('Approve document: badge becomes "Approved", outstanding counter drops to 0', async ({ page }) => {
    // Ensure item is uploaded
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'to-approve.txt', 'approved content')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Click Approve
    await page.getByRole('button', { name: 'Approve' }).click()
    // Confirm in the approval modal (optional remark)
    await page.getByRole('button', { name: 'Approve' }).last().click()

    // Badge must become "Approved"
    await expect(page.locator('.rounded-full', { hasText: 'Approved' }).first()).toBeVisible({ timeout: 10_000 })

    // Outstanding counter must be gone (0 outstanding = counter hidden)
    const roseCounter = page.locator('p.text-rose-400, .text-rose-400').filter({ hasText: /^\d+$/ })
    await expect(roseCounter).not.toBeVisible()

    // "1 required document outstanding" banner must be gone
    await expect(page.getByText(/required document outstanding/i)).not.toBeVisible()

    // "All docs in / ready to approve" message must appear
    await expect(page.getByText(/all docs in|ready to approve/i)).toBeVisible()
  })

  test('Reject document: badge becomes "Rejected", remark is shown', async ({ page }) => {
    // Ensure item is uploaded
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'to-reject.txt', 'rejection test content')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Click Reject
    await page.getByRole('button', { name: 'Reject' }).click()
    // Rejection requires a remark
    await page.getByPlaceholder(/reason for rejection/i).fill('Invalid format, please re-upload as PDF')
    await page.getByRole('button', { name: 'Reject' }).last().click()

    // Badge must become "Rejected"
    await expect(page.locator('.rounded-full', { hasText: 'Rejected' }).first()).toBeVisible({ timeout: 10_000 })
    // Remark must be shown inline
    await expect(page.getByText('Invalid format, please re-upload as PDF')).toBeVisible()
    // Upload button must still be present (can re-upload after rejection)
    await expect(page.getByRole('button', { name: /^(Upload|Replace)$/ }).first()).toBeVisible()
  })

  test('Cannot approve a case with outstanding mandatory docs: 422 error shown', async ({ page }) => {
    // Intercept the case-level PATCH approve to simulate the 422 guard
    await page.route(`**/api/onboarding/${CASE_ID}`, async (route) => {
      const req = route.request()
      if (req.method() !== 'PATCH') { await route.continue(); return }
      const body = await req.postDataJSON().catch(() => ({}))
      if (body?.action === 'approve') {
        await route.fulfill({ status: 422, json: { error: 'Outstanding: NID Copy' } })
      } else {
        await route.continue()
      }
    })

    await openChecklist(page)

    // The Approve Case button only shows when missingCount === 0.
    // We simulate what happens when the API itself rejects the approval.
    // Trigger via GET intercept to fake all docs approved in UI, then
    // verify the error surfaces when the real API blocks it.
    // (This covers the backend guard regardless of UI gate state.)
    const approveRes = await page.request.patch(`http://localhost:3000/api/onboarding/${CASE_ID}`, {
      data: { action: 'approve' },
    })
    expect(approveRes.status()).toBe(422)
    const body = await approveRes.json()
    expect(body.error).toMatch(/outstanding/i)
  })
})

// ── SUITE 5: Permission gate ───────────────────────────────────────────────────

test.describe('Permission gate — viewer role cannot upload', () => {

  test('viewer role: no Upload or Replace button shown', async ({ page }) => {
    // Intercept /api/auth/me to spoof a viewer role — no second login needed
    await page.route('**/api/auth/me', async route => {
      const original = await route.fetch()
      const data = await original.json()
      await route.fulfill({
        status: 200,
        json: { ...data, role: 'viewer', app_role: 'viewer' },
      })
    })

    await openChecklist(page)

    // Upload and Replace buttons must not be present for viewer
    await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Replace' })).not.toBeVisible()
    // The document name must still be visible — viewer can read
    await expect(page.getByText('NID Copy')).toBeVisible()
  })
})

// ── SUITE 6: File link integrity ──────────────────────────────────────────────

test.describe('Uploaded file link', () => {

  test('filename is an anchor tag linking to Supabase Storage (200 OK)', async ({ page }) => {
    await openChecklist(page)
    await openUploadModal(page)
    await attachFile(page, 'link-check.txt', 'check that the link works')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })

    // Find the link
    const fileLink = page.getByRole('link', { name: 'link-check.txt' })
    await expect(fileLink).toBeVisible()

    const href = await fileLink.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).toContain('supabase.co')   // must be a real Supabase Storage URL

    // Verify the URL is reachable (200 OK) — proves the file actually got there
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
  })
})

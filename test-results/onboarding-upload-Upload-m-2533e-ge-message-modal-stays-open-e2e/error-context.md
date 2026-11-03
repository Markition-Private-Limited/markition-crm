# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-upload.spec.ts >> Upload modal — server error responses >> 413 from server: shows "file too large" message, modal stays open
- Location: e2e\onboarding-upload.spec.ts:67:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Onboarding', exact: true })

```

# Page snapshot

```yaml
- paragraph [ref=e5]: Loading workspace…
```

# Test source

```ts
  1   | /**
  2   |  * Full end-to-end tests: document upload in the Onboarding tab
  3   |  *
  4   |  * Coverage strategy — no happy-path-only tests:
  5   |  *   • Error handling: every server-side rejection surfaces the right message
  6   |  *     and leaves the modal open and recoverable
  7   |  *   • State transitions: each UI badge / counter must reflect the new state
  8   |  *     immediately — without a page reload — proving the clearCache() fix
  9   |  *   • Persistence: data must survive a hard reload (Ctrl+R)
  10  |  *   • Permission gate: viewer role sees no upload controls
  11  |  *   • Workflow completion: the full chain upload → review → approve works
  12  |  *     and the case-level "outstanding" counter reaches zero only on approval
  13  |  *
  14  |  * Network interception is used only to inject controlled error responses;
  15  |  * the success path always hits the real server so we test real Supabase I/O.
  16  |  *
  17  |  * HOW EACH TEST ACCESSES THE ACTION
  18  |  *   Every test navigates to the real prospect page, clicks the Onboarding tab,
  19  |  *   expands the Document Checklist, then drives the UI exactly as a user would.
  20  |  *   Server errors are injected via page.route() — the browser still runs the
  21  |  *   full React component tree; only the network response is replaced.
  22  |  */
  23  | 
  24  | import { test, expect, Page } from '@playwright/test'
  25  | 
  26  | // ── Test fixture ──────────────────────────────────────────────────────────────
  27  | // Prospect that has an in_progress onboarding case with one mandatory item.
  28  | // This is the "Ali jewo / OBC-000005 / NID Copy" case used throughout dev.
  29  | const PROSPECT_URL = '/prospects/9ecbfc57-019b-4269-babf-6970b3c8fc6a'
  30  | const CASE_ID      = '87f9fee6-0c87-4694-9e05-ab907c8b3d0b'
  31  | const ITEM_ID      = '34d6dada-0ff7-4c98-8de5-d2b7f02a1211'
  32  | const UPLOAD_API   = `/api/onboarding/${CASE_ID}/checklist/${ITEM_ID}/upload`
  33  | const CASE_API     = `/api/onboarding/${CASE_ID}`
  34  | 
  35  | // ── Helpers ───────────────────────────────────────────────────────────────────
  36  | 
  37  | /** Navigate to the prospect, open the Onboarding tab, expand the checklist. */
  38  | async function openChecklist(page: Page) {
  39  |   await page.goto(PROSPECT_URL)
> 40  |   await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
      |                                                                       ^ Error: locator.click: Test timeout of 30000ms exceeded.
  41  |   await page.getByRole('button', { name: /Document Checklist/ }).click()
  42  |   // Wait for checklist items to be visible (exact: true avoids matching the "outstanding" summary <li>)
  43  |   await page.getByText('NID Copy', { exact: true }).waitFor()
  44  | }
  45  | 
  46  | /** Open the upload modal for NID Copy. */
  47  | async function openUploadModal(page: Page) {
  48  |   // Could be "Upload" (first time) or "Replace" (file already exists)
  49  |   const uploadBtn = page.getByRole('button', { name: /^(Upload|Replace)$/ }).first()
  50  |   await uploadBtn.click()
  51  |   await page.getByRole('heading', { name: /Upload: NID Copy/i }).waitFor()
  52  | }
  53  | 
  54  | /** Attach a file to the hidden file input inside the upload modal. */
  55  | async function attachFile(page: Page, name: string, content: string, mimeType = 'text/plain') {
  56  |   await page.locator('input[type="file"]').setInputFiles({
  57  |     name,
  58  |     mimeType,
  59  |     buffer: Buffer.from(content),
  60  |   })
  61  | }
  62  | 
  63  | // ── SUITE 1: Upload modal — error paths ───────────────────────────────────────
  64  | 
  65  | test.describe('Upload modal — server error responses', () => {
  66  | 
  67  |   test('413 from server: shows "file too large" message, modal stays open', async ({ page }) => {
  68  |     await openChecklist(page)
  69  |     await openUploadModal(page)
  70  |     await attachFile(page, 'big.pdf', 'x')
  71  | 
  72  |     // Intercept the upload and return 413
  73  |     await page.route(UPLOAD_API, route =>
  74  |       route.fulfill({ status: 413, json: { error: 'File too large (max 20 MB)' } })
  75  |     )
  76  | 
  77  |     await page.getByRole('button', { name: 'Upload' }).click()
  78  | 
  79  |     // Error must be visible inside the modal
  80  |     await expect(page.getByText(/file too large/i)).toBeVisible()
  81  |     // Modal must still be open — user can try again
  82  |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  83  |   })
  84  | 
  85  |   test('500 from server: shows generic error, modal stays open', async ({ page }) => {
  86  |     await openChecklist(page)
  87  |     await openUploadModal(page)
  88  |     await attachFile(page, 'doc.txt', 'content')
  89  | 
  90  |     await page.route(UPLOAD_API, route =>
  91  |       route.fulfill({ status: 500, json: { error: 'Internal storage error' } })
  92  |     )
  93  | 
  94  |     await page.getByRole('button', { name: 'Upload' }).click()
  95  | 
  96  |     await expect(page.getByText(/internal storage error/i)).toBeVisible()
  97  |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  98  |   })
  99  | 
  100 |   test('422 approved: shows "already approved" error', async ({ page }) => {
  101 |     await openChecklist(page)
  102 |     await openUploadModal(page)
  103 |     await attachFile(page, 'doc.txt', 'content')
  104 | 
  105 |     await page.route(UPLOAD_API, route =>
  106 |       route.fulfill({ status: 422, json: { error: 'Document is already approved' } })
  107 |     )
  108 | 
  109 |     await page.getByRole('button', { name: 'Upload' }).click()
  110 | 
  111 |     await expect(page.getByText(/already approved/i)).toBeVisible()
  112 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).toBeVisible()
  113 |   })
  114 | 
  115 |   test('Upload button is disabled until a file is selected', async ({ page }) => {
  116 |     await openChecklist(page)
  117 |     await openUploadModal(page)
  118 | 
  119 |     // No file attached — Upload button must be disabled
  120 |     const uploadBtn = page.getByRole('button', { name: 'Upload' })
  121 |     await expect(uploadBtn).toBeDisabled()
  122 | 
  123 |     // After file selection it becomes enabled
  124 |     await attachFile(page, 'doc.txt', 'hello')
  125 |     await expect(uploadBtn).toBeEnabled()
  126 |   })
  127 | 
  128 |   test('Cancelling the modal makes no network call', async ({ page }) => {
  129 |     await openChecklist(page)
  130 |     await openUploadModal(page)
  131 |     await attachFile(page, 'doc.txt', 'content')
  132 | 
  133 |     let uploadCalled = false
  134 |     await page.route(UPLOAD_API, () => { uploadCalled = true })
  135 | 
  136 |     await page.getByRole('button', { name: 'Cancel' }).click()
  137 | 
  138 |     // Modal must close, upload endpoint must NOT have been called
  139 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible()
  140 |     expect(uploadCalled).toBe(false)
```
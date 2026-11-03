# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-upload.spec.ts >> Review workflow state transitions >> Mark under review: badge changes to "Under review" immediately
- Location: e2e\onboarding-upload.spec.ts:276:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rounded-full').filter({ hasText: 'Under review' }).first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.rounded-full').filter({ hasText: 'Under review' }).first() with timeout 8000ms
  - waiting for locator('.rounded-full').filter({ hasText: 'Under review' }).first()

```

```yaml
- alert
- complementary:
  - text: M
  - paragraph: Markition
  - paragraph: CRM Workspace
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
    - link "Clients":
      - /url: /clients
    - link "Prospects":
      - /url: /prospects
    - link "Active Clients":
      - /url: /active-clients
    - link "Tasks":
      - /url: /tasks
    - paragraph: Admin
    - link "Employees":
      - /url: /admin/employees
    - link "Pipeline Stages":
      - /url: /admin/pipeline-stages
    - link "Document Templates":
      - /url: /admin/document-templates
    - paragraph: Attendance
    - link "Shifts":
      - /url: /admin/attendance/shifts
    - link "Calendar":
      - /url: /admin/attendance/calendar
    - link "Analytics":
      - /url: /admin/attendance/analytics
  - button "Collapse"
- banner:
  - textbox:
    - /placeholder: Search clients, leads, tasks...
  - button "Toggle theme"
  - button "Open notifications"
  - button "AU Admin User Admin"
- main:
  - button
  - heading "Ali jewo" [level=1]
  - text: high
  - paragraph: PRS-000003
  - button "Edit"
  - button "Archive"
  - paragraph: Pipeline Stage
  - text: Won
  - button "Contacted"
  - button "New Lead"
  - button "Initial Discussion"
  - button "Meeting Scheduled"
  - button "Meeting Completed"
  - button "Qualified Prospect"
  - button "Proposal Preparation"
  - button "Proposal Sent"
  - button "Pricing Negotiation"
  - button "Follow-up/Negotiation"
  - button "Onboarding/Documentation"
  - button "Won" [disabled]
  - button "On Hold"
  - button "Lost"
  - paragraph: "Probability: 100%"
  - button "Details"
  - button "Contacts (1)"
  - button "Stage History (4)"
  - button "Activity"
  - button "Proposals"
  - button "Onboarding"
  - heading "Onboarding" [level=3]
  - paragraph: Document collection for won deals
  - button "Start Onboarding"
  - text: OBC-000005 In Progress
  - button "Delete onboarding case"
  - paragraph: Started Nov 3, 2026
  - paragraph: "1"
  - paragraph: outstanding
  - button "Document Checklist (0/1 approved)"
  - text: Required NID Copy Uploaded
  - link "review-test.txt":
    - /url: https://cpvwkbpsekxttufzrzgk.supabase.co/storage/v1/object/public/onboarding-docs/87f9fee6-0c87-4694-9e05-ab907c8b3d0b/34d6dada-0ff7-4c98-8de5-d2b7f02a1211/1793735281820.txt
  - text: · Nov 4, 2026
  - button "Replace"
  - button "Mark under review"
  - button "Approve"
  - button "Reject"
  - paragraph: 1 required document outstanding
  - list:
    - listitem: Uploaded NID Copy
```

# Test source

```ts
  188 |     await openChecklist(page)
  189 |     await openUploadModal(page)
  190 |     await attachFile(page, 'counter-test.txt', 'content')
  191 |     await page.getByRole('button', { name: 'Upload' }).click()
  192 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  193 | 
  194 |     // The case-level outstanding count must still be 1 (uploaded but not approved)
  195 |     const counterEl = page.locator('p.text-rose-400, .text-rose-400').filter({ hasText: /^\d+$/ }).first()
  196 |     await expect(counterEl).toHaveText('1')
  197 | 
  198 |     // The bottom "outstanding" banner must still list NID Copy with "Uploaded" status
  199 |     await expect(page.getByText(/1 required document outstanding/i)).toBeVisible()
  200 |     const banner = page.locator('.border-rose-500\\/20, [class*="rose"]')
  201 |     await expect(banner.getByText('NID Copy').first()).toBeVisible()
  202 |   })
  203 | 
  204 |   test('Two rapid replaces: final filename shown, no stale intermediate state', async ({ page }) => {
  205 |     await openChecklist(page)
  206 | 
  207 |     // First upload
  208 |     await openUploadModal(page)
  209 |     await attachFile(page, 'rapid-first.txt', 'first')
  210 |     await page.getByRole('button', { name: 'Upload' }).click()
  211 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  212 | 
  213 |     // Second replace immediately after
  214 |     await openUploadModal(page)
  215 |     await attachFile(page, 'rapid-second.txt', 'second')
  216 |     await page.getByRole('button', { name: 'Upload' }).click()
  217 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  218 | 
  219 |     // Only the second filename should be visible
  220 |     await expect(page.getByText('rapid-second.txt')).toBeVisible()
  221 |     await expect(page.getByText('rapid-first.txt')).not.toBeVisible()
  222 |   })
  223 | })
  224 | 
  225 | // ── SUITE 3: Data persistence across hard reload ──────────────────────────────
  226 | 
  227 | test.describe('Data persistence across hard reload', () => {
  228 | 
  229 |   test('uploaded filename survives a full page reload', async ({ page }) => {
  230 |     await openChecklist(page)
  231 |     await openUploadModal(page)
  232 |     await attachFile(page, 'persist-test.txt', 'this must survive')
  233 |     await page.getByRole('button', { name: 'Upload' }).click()
  234 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  235 | 
  236 |     // Hard reload — clears all in-memory state including the React GET cache
  237 |     await page.reload()
  238 |     await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
  239 |     await page.getByRole('button', { name: /Document Checklist/ }).click()
  240 |     await page.getByText('NID Copy').waitFor()
  241 | 
  242 |     // File must still be shown — data came from the DB, not React state
  243 |     await expect(page.getByText('persist-test.txt')).toBeVisible()
  244 |   })
  245 | 
  246 |   test('replaced file persists — old file not shown after reload', async ({ page }) => {
  247 |     await openChecklist(page)
  248 | 
  249 |     // Upload v1
  250 |     await openUploadModal(page)
  251 |     await attachFile(page, 'persist-v1.txt', 'version 1')
  252 |     await page.getByRole('button', { name: 'Upload' }).click()
  253 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  254 | 
  255 |     // Replace with v2
  256 |     await openUploadModal(page)
  257 |     await attachFile(page, 'persist-v2.txt', 'version 2')
  258 |     await page.getByRole('button', { name: 'Upload' }).click()
  259 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  260 | 
  261 |     // Hard reload
  262 |     await page.reload()
  263 |     await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
  264 |     await page.getByRole('button', { name: /Document Checklist/ }).click()
  265 |     await page.getByText('NID Copy').waitFor()
  266 | 
  267 |     await expect(page.getByText('persist-v2.txt')).toBeVisible()
  268 |     await expect(page.getByText('persist-v1.txt')).not.toBeVisible()
  269 |   })
  270 | })
  271 | 
  272 | // ── SUITE 4: Document review workflow ─────────────────────────────────────────
  273 | 
  274 | test.describe('Review workflow state transitions', () => {
  275 | 
  276 |   test('Mark under review: badge changes to "Under review" immediately', async ({ page }) => {
  277 |     // Ensure a file is uploaded first so Mark under review is available
  278 |     await openChecklist(page)
  279 |     await openUploadModal(page)
  280 |     await attachFile(page, 'review-test.txt', 'content for review')
  281 |     await page.getByRole('button', { name: 'Upload' }).click()
  282 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  283 | 
  284 |     // Mark under review
  285 |     await page.getByRole('button', { name: 'Mark under review' }).click()
  286 | 
  287 |     // Badge must change to "Under review"
> 288 |     await expect(page.locator('.rounded-full', { hasText: 'Under review' }).first()).toBeVisible()
      |                                                                                      ^ Error: expect(locator).toBeVisible() failed
  289 |     // Upload/Replace button must still show (item not yet approved)
  290 |     // Mark under review button must disappear (status changed)
  291 |     await expect(page.getByRole('button', { name: 'Mark under review' })).not.toBeVisible()
  292 |   })
  293 | 
  294 |   test('Approve document: badge becomes "Approved", outstanding counter drops to 0', async ({ page }) => {
  295 |     // Ensure item is uploaded
  296 |     await openChecklist(page)
  297 |     await openUploadModal(page)
  298 |     await attachFile(page, 'to-approve.txt', 'approved content')
  299 |     await page.getByRole('button', { name: 'Upload' }).click()
  300 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  301 | 
  302 |     // Click Approve
  303 |     await page.getByRole('button', { name: 'Approve' }).click()
  304 |     // Confirm in the approval modal (optional remark)
  305 |     await page.getByRole('button', { name: 'Approve' }).last().click()
  306 | 
  307 |     // Badge must become "Approved"
  308 |     await expect(page.locator('.rounded-full', { hasText: 'Approved' }).first()).toBeVisible({ timeout: 10_000 })
  309 | 
  310 |     // Outstanding counter must be gone (0 outstanding = counter hidden)
  311 |     const roseCounter = page.locator('p.text-rose-400, .text-rose-400').filter({ hasText: /^\d+$/ })
  312 |     await expect(roseCounter).not.toBeVisible()
  313 | 
  314 |     // "1 required document outstanding" banner must be gone
  315 |     await expect(page.getByText(/required document outstanding/i)).not.toBeVisible()
  316 | 
  317 |     // "All docs in / ready to approve" message must appear
  318 |     await expect(page.getByText(/all docs in|ready to approve/i)).toBeVisible()
  319 |   })
  320 | 
  321 |   test('Reject document: badge becomes "Rejected", remark is shown', async ({ page }) => {
  322 |     // Ensure item is uploaded
  323 |     await openChecklist(page)
  324 |     await openUploadModal(page)
  325 |     await attachFile(page, 'to-reject.txt', 'rejection test content')
  326 |     await page.getByRole('button', { name: 'Upload' }).click()
  327 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  328 | 
  329 |     // Click Reject
  330 |     await page.getByRole('button', { name: 'Reject' }).click()
  331 |     // Rejection requires a remark
  332 |     await page.getByPlaceholder(/reason for rejection/i).fill('Invalid format, please re-upload as PDF')
  333 |     await page.getByRole('button', { name: 'Reject' }).last().click()
  334 | 
  335 |     // Badge must become "Rejected"
  336 |     await expect(page.locator('.rounded-full', { hasText: 'Rejected' }).first()).toBeVisible({ timeout: 10_000 })
  337 |     // Remark must be shown inline
  338 |     await expect(page.getByText('Invalid format, please re-upload as PDF')).toBeVisible()
  339 |     // Upload button must still be present (can re-upload after rejection)
  340 |     await expect(page.getByRole('button', { name: /^(Upload|Replace)$/ }).first()).toBeVisible()
  341 |   })
  342 | 
  343 |   test('Cannot approve a case with outstanding mandatory docs: 422 error shown', async ({ page }) => {
  344 |     // Intercept the case-level PATCH approve to simulate the 422 guard
  345 |     await page.route(`**/api/onboarding/${CASE_ID}`, async (route) => {
  346 |       const req = route.request()
  347 |       if (req.method() !== 'PATCH') { await route.continue(); return }
  348 |       const body = await req.postDataJSON().catch(() => ({}))
  349 |       if (body?.action === 'approve') {
  350 |         await route.fulfill({ status: 422, json: { error: 'Outstanding: NID Copy' } })
  351 |       } else {
  352 |         await route.continue()
  353 |       }
  354 |     })
  355 | 
  356 |     await openChecklist(page)
  357 | 
  358 |     // The Approve Case button only shows when missingCount === 0.
  359 |     // We simulate what happens when the API itself rejects the approval.
  360 |     // Trigger via GET intercept to fake all docs approved in UI, then
  361 |     // verify the error surfaces when the real API blocks it.
  362 |     // (This covers the backend guard regardless of UI gate state.)
  363 |     const approveRes = await page.request.patch(`http://localhost:3000/api/onboarding/${CASE_ID}`, {
  364 |       data: { action: 'approve' },
  365 |     })
  366 |     expect(approveRes.status()).toBe(422)
  367 |     const body = await approveRes.json()
  368 |     expect(body.error).toMatch(/outstanding/i)
  369 |   })
  370 | })
  371 | 
  372 | // ── SUITE 5: Permission gate ───────────────────────────────────────────────────
  373 | 
  374 | test.describe('Permission gate — viewer role cannot upload', () => {
  375 | 
  376 |   test('viewer role: no Upload or Replace button shown', async ({ page }) => {
  377 |     // Intercept /api/auth/me to spoof a viewer role — no second login needed
  378 |     await page.route('**/api/auth/me', async route => {
  379 |       const original = await route.fetch()
  380 |       const data = await original.json()
  381 |       await route.fulfill({
  382 |         status: 200,
  383 |         json: { ...data, role: 'viewer', app_role: 'viewer' },
  384 |       })
  385 |     })
  386 | 
  387 |     await openChecklist(page)
  388 | 
```
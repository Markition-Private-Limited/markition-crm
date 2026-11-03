# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-upload.spec.ts >> Review workflow state transitions >> Cannot approve a case with outstanding mandatory docs: 422 error shown
- Location: e2e\onboarding-upload.spec.ts:343:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 422
Received: 401
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - generic [ref=e13]:
    - complementary [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: M
        - generic [ref=e17]:
          - paragraph [ref=e18]: Markition
          - paragraph [ref=e19]: CRM Workspace
      - navigation [ref=e20]:
        - link "Dashboard" [ref=e21] [cursor=pointer]:
          - /url: /dashboard
        - link "Clients" [ref=e26] [cursor=pointer]:
          - /url: /clients
        - link "Prospects" [ref=e32] [cursor=pointer]:
          - /url: /prospects
        - link "Active Clients" [ref=e38] [cursor=pointer]:
          - /url: /active-clients
        - link "Tasks" [ref=e43] [cursor=pointer]:
          - /url: /tasks
        - generic [ref=e48]:
          - paragraph [ref=e49]: Admin
          - link "Employees" [ref=e50] [cursor=pointer]:
            - /url: /admin/employees
          - link "Pipeline Stages" [ref=e57] [cursor=pointer]:
            - /url: /admin/pipeline-stages
          - link "Document Templates" [ref=e63] [cursor=pointer]:
            - /url: /admin/document-templates
        - generic [ref=e68]:
          - paragraph [ref=e69]: Attendance
          - link "Shifts" [ref=e70] [cursor=pointer]:
            - /url: /admin/attendance/shifts
          - link "Calendar" [ref=e75] [cursor=pointer]:
            - /url: /admin/attendance/calendar
          - link "Analytics" [ref=e79] [cursor=pointer]:
            - /url: /admin/attendance/analytics
      - button "Collapse" [ref=e83]
    - generic [ref=e87]:
      - banner [ref=e88]:
        - generic [ref=e89]:
          - textbox [ref=e96]:
            - /placeholder: Search clients, leads, tasks...
          - generic [ref=e97]:
            - button "Toggle theme" [ref=e98]
            - button "Open notifications" [ref=e102]
            - button "AU Admin User Admin" [ref=e107]:
              - generic [ref=e108]: AU
              - generic [ref=e109]:
                - generic [ref=e110]: Admin User
                - generic [ref=e111]: Admin
      - main [ref=e114]:
        - generic [ref=e117]:
          - generic [ref=e118]:
            - generic [ref=e119]:
              - button [ref=e120]
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - heading "Ali jewo" [level=1] [ref=e125]
                  - generic [ref=e126]: high
                - paragraph [ref=e127]: PRS-000003
            - generic [ref=e128]:
              - button "Edit" [ref=e129]
              - button "Archive" [ref=e130]
          - generic [ref=e134]:
            - generic [ref=e135]:
              - paragraph [ref=e136]: Pipeline Stage
              - generic [ref=e137]: Won
            - generic [ref=e138]:
              - button "Contacted" [ref=e139] [cursor=pointer]
              - button "New Lead" [ref=e140] [cursor=pointer]
              - button "Initial Discussion" [ref=e141] [cursor=pointer]
              - button "Meeting Scheduled" [ref=e142] [cursor=pointer]
              - button "Meeting Completed" [ref=e143] [cursor=pointer]
              - button "Qualified Prospect" [ref=e144] [cursor=pointer]
              - button "Proposal Preparation" [ref=e145] [cursor=pointer]
              - button "Proposal Sent" [ref=e146] [cursor=pointer]
              - button "Pricing Negotiation" [ref=e147] [cursor=pointer]
              - button "Follow-up/Negotiation" [ref=e148] [cursor=pointer]
              - button "Onboarding/Documentation" [ref=e149] [cursor=pointer]
              - button "Won" [disabled] [ref=e150]
              - button "On Hold" [ref=e151] [cursor=pointer]
              - button "Lost" [ref=e152] [cursor=pointer]
            - paragraph [ref=e153]:
              - text: "Probability:"
              - generic [ref=e154]: 100%
          - generic [ref=e155]:
            - button "Details" [ref=e156]
            - button "Contacts (1)" [ref=e157]
            - button "Stage History (4)" [ref=e158]
            - button "Activity" [ref=e159]
            - button "Proposals" [ref=e160]
            - button "Onboarding" [ref=e161]
          - generic [ref=e163]:
            - generic [ref=e164]:
              - generic [ref=e165]:
                - heading "Onboarding" [level=3] [ref=e166]
                - paragraph [ref=e167]: Document collection for won deals
              - button "Start Onboarding" [ref=e168]
            - generic [ref=e171]:
              - generic [ref=e172]:
                - generic [ref=e173]: OBC-000005
                - generic [ref=e174]:
                  - generic [ref=e175]: In Progress
                  - button "Delete onboarding case" [ref=e176]
              - generic [ref=e180]:
                - paragraph [ref=e182]: Started Nov 3, 2026
                - generic [ref=e183]:
                  - paragraph [ref=e184]: "1"
                  - paragraph [ref=e185]: outstanding
              - button "Document Checklist (0/1 approved)" [active] [ref=e186]:
                - generic [ref=e187]:
                  - text: Document Checklist
                  - generic [ref=e190]: (0/1 approved)
              - generic [ref=e193]:
                - generic [ref=e195]:
                  - generic [ref=e196]:
                    - generic [ref=e197]:
                      - generic [ref=e198]: Required
                      - generic [ref=e199]: NID Copy
                    - generic [ref=e200]: Rejected
                  - generic [ref=e205]:
                    - link "to-reject.txt" [ref=e210] [cursor=pointer]:
                      - /url: https://cpvwkbpsekxttufzrzgk.supabase.co/storage/v1/object/public/onboarding-docs/87f9fee6-0c87-4694-9e05-ab907c8b3d0b/34d6dada-0ff7-4c98-8de5-d2b7f02a1211/1793735314643.txt
                    - generic [ref=e211]: · Nov 4, 2026
                  - paragraph [ref=e212]: Invalid format, please re-upload as PDF
                  - button "Replace" [ref=e214]
                - generic [ref=e218]:
                  - paragraph [ref=e219]: 1 required document outstanding
                  - list [ref=e222]:
                    - listitem [ref=e223]:
                      - generic [ref=e224]: Rejected
                      - text: NID Copy
```

# Test source

```ts
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
  288 |     await expect(page.locator('.rounded-full', { hasText: 'Under review' }).first()).toBeVisible()
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
> 366 |     expect(approveRes.status()).toBe(422)
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
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
  389 |     // Upload and Replace buttons must not be present for viewer
  390 |     await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible()
  391 |     await expect(page.getByRole('button', { name: 'Replace' })).not.toBeVisible()
  392 |     // The document name must still be visible — viewer can read
  393 |     await expect(page.getByText('NID Copy')).toBeVisible()
  394 |   })
  395 | })
  396 | 
  397 | // ── SUITE 6: File link integrity ──────────────────────────────────────────────
  398 | 
  399 | test.describe('Uploaded file link', () => {
  400 | 
  401 |   test('filename is an anchor tag linking to Supabase Storage (200 OK)', async ({ page }) => {
  402 |     await openChecklist(page)
  403 |     await openUploadModal(page)
  404 |     await attachFile(page, 'link-check.txt', 'check that the link works')
  405 |     await page.getByRole('button', { name: 'Upload' }).click()
  406 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  407 | 
  408 |     // Find the link
  409 |     const fileLink = page.getByRole('link', { name: 'link-check.txt' })
  410 |     await expect(fileLink).toBeVisible()
  411 | 
  412 |     const href = await fileLink.getAttribute('href')
  413 |     expect(href).toBeTruthy()
  414 |     expect(href).toContain('supabase.co')   // must be a real Supabase Storage URL
  415 | 
  416 |     // Verify the URL is reachable (200 OK) — proves the file actually got there
  417 |     const res = await page.request.get(href!)
  418 |     expect(res.status()).toBe(200)
  419 |   })
  420 | })
  421 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-upload.spec.ts >> Permission gate — viewer role cannot upload >> viewer role: no Upload or Replace button shown
- Location: e2e\onboarding-upload.spec.ts:376:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('NID Copy')
Expected: visible
Error: strict mode violation: getByText('NID Copy') resolved to 2 elements:
    1) <span class="font-medium text-sm text-foreground truncate">NID Copy</span> aka getByText('NID Copy', { exact: true })
    2) <li class="text-xs text-muted-foreground flex items-center gap-2">…</li> aka getByText('RejectedNID Copy')

Call log:
  - Expect "toBeVisible" getByText('NID Copy') with timeout 8000ms
  - waiting for getByText('NID Copy')

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
        - link "Prospects" [ref=e26] [cursor=pointer]:
          - /url: /prospects
      - button "Collapse" [ref=e33]
    - generic [ref=e37]:
      - banner [ref=e38]:
        - generic [ref=e39]:
          - textbox [ref=e46]:
            - /placeholder: Search clients, leads, tasks...
          - generic [ref=e47]:
            - button "Toggle theme" [ref=e48]
            - button "Open notifications" [ref=e52]
            - button "AU Admin User admin1@markition.com" [ref=e57]:
              - generic [ref=e58]: AU
              - generic [ref=e59]:
                - generic [ref=e60]: Admin User
                - generic [ref=e61]: admin1@markition.com
      - main [ref=e64]:
        - generic [ref=e67]:
          - generic [ref=e69]:
            - button [ref=e70]
            - generic [ref=e73]:
              - generic [ref=e74]:
                - heading "Ali jewo" [level=1] [ref=e75]
                - generic [ref=e76]: high
              - paragraph [ref=e77]: PRS-000003
          - generic [ref=e78]:
            - generic [ref=e79]:
              - paragraph [ref=e80]: Pipeline Stage
              - generic [ref=e81]: Won
            - generic [ref=e82]:
              - button "Contacted" [disabled] [ref=e83]
              - button "New Lead" [disabled] [ref=e84]
              - button "Initial Discussion" [disabled] [ref=e85]
              - button "Meeting Scheduled" [disabled] [ref=e86]
              - button "Meeting Completed" [disabled] [ref=e87]
              - button "Qualified Prospect" [disabled] [ref=e88]
              - button "Proposal Preparation" [disabled] [ref=e89]
              - button "Proposal Sent" [disabled] [ref=e90]
              - button "Pricing Negotiation" [disabled] [ref=e91]
              - button "Follow-up/Negotiation" [disabled] [ref=e92]
              - button "Onboarding/Documentation" [disabled] [ref=e93]
              - button "Won" [disabled] [ref=e94]
              - button "On Hold" [disabled] [ref=e95]
              - button "Lost" [disabled] [ref=e96]
            - paragraph [ref=e97]:
              - text: "Probability:"
              - generic [ref=e98]: 100%
          - generic [ref=e99]:
            - button "Details" [ref=e100]
            - button "Contacts (1)" [ref=e101]
            - button "Stage History (4)" [ref=e102]
            - button "Activity" [ref=e103]
            - button "Proposals" [ref=e104]
            - button "Onboarding" [ref=e105]
          - generic [ref=e107]:
            - generic [ref=e109]:
              - heading "Onboarding" [level=3] [ref=e110]
              - paragraph [ref=e111]: Document collection for won deals
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e115]: OBC-000005
                - generic [ref=e116]: In Progress
              - generic [ref=e118]:
                - paragraph [ref=e120]: Started Nov 3, 2026
                - generic [ref=e121]:
                  - paragraph [ref=e122]: "1"
                  - paragraph [ref=e123]: outstanding
              - button "Document Checklist (0/1 approved)" [active] [ref=e124]:
                - generic [ref=e125]:
                  - text: Document Checklist
                  - generic [ref=e128]: (0/1 approved)
              - generic [ref=e131]:
                - generic [ref=e133]:
                  - generic [ref=e134]:
                    - generic [ref=e135]:
                      - generic [ref=e136]: Required
                      - generic [ref=e137]: NID Copy
                    - generic [ref=e138]: Rejected
                  - generic [ref=e143]:
                    - link "to-reject.txt" [ref=e148] [cursor=pointer]:
                      - /url: https://cpvwkbpsekxttufzrzgk.supabase.co/storage/v1/object/public/onboarding-docs/87f9fee6-0c87-4694-9e05-ab907c8b3d0b/34d6dada-0ff7-4c98-8de5-d2b7f02a1211/1793735314643.txt
                    - generic [ref=e149]: · Nov 4, 2026
                  - paragraph [ref=e150]: Invalid format, please re-upload as PDF
                - generic [ref=e151]:
                  - paragraph [ref=e152]: 1 required document outstanding
                  - list [ref=e155]:
                    - listitem [ref=e156]:
                      - generic [ref=e157]: Rejected
                      - text: NID Copy
```

# Test source

```ts
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
  389 |     // Upload and Replace buttons must not be present for viewer
  390 |     await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible()
  391 |     await expect(page.getByRole('button', { name: 'Replace' })).not.toBeVisible()
  392 |     // The document name must still be visible — viewer can read
> 393 |     await expect(page.getByText('NID Copy')).toBeVisible()
      |                                              ^ Error: expect(locator).toBeVisible() failed
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
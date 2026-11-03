# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-upload.spec.ts >> Data persistence across hard reload >> uploaded filename survives a full page reload
- Location: e2e\onboarding-upload.spec.ts:229:7

# Error details

```
Error: locator.waitFor: Error: strict mode violation: getByText('NID Copy') resolved to 2 elements:
    1) <span class="font-medium text-sm text-foreground truncate">NID Copy</span> aka getByText('NID Copy', { exact: true })
    2) <li class="text-xs text-muted-foreground flex items-center gap-2">…</li> aka getByText('UploadedNID Copy')

Call log:
  - waiting for getByText('NID Copy') to be visible

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - button "Open Next.js Dev Tools" [ref=f1e7] [cursor=pointer]
  - alert [ref=f1e11]
  - generic [ref=f1e13]:
    - complementary [ref=f1e14]:
      - generic [ref=f1e15]:
        - generic [ref=f1e16]: M
        - generic [ref=f1e17]:
          - paragraph [ref=f1e18]: Markition
          - paragraph [ref=f1e19]: CRM Workspace
      - navigation [ref=f1e20]:
        - link "Dashboard" [ref=f1e21] [cursor=pointer]:
          - /url: /dashboard
        - link "Clients" [ref=f1e26] [cursor=pointer]:
          - /url: /clients
        - link "Prospects" [ref=f1e32] [cursor=pointer]:
          - /url: /prospects
        - link "Active Clients" [ref=f1e38] [cursor=pointer]:
          - /url: /active-clients
        - link "Tasks" [ref=f1e43] [cursor=pointer]:
          - /url: /tasks
        - generic [ref=f1e48]:
          - paragraph [ref=f1e49]: Admin
          - link "Employees" [ref=f1e50] [cursor=pointer]:
            - /url: /admin/employees
          - link "Pipeline Stages" [ref=f1e57] [cursor=pointer]:
            - /url: /admin/pipeline-stages
          - link "Document Templates" [ref=f1e63] [cursor=pointer]:
            - /url: /admin/document-templates
        - generic [ref=f1e68]:
          - paragraph [ref=f1e69]: Attendance
          - link "Shifts" [ref=f1e70] [cursor=pointer]:
            - /url: /admin/attendance/shifts
          - link "Calendar" [ref=f1e75] [cursor=pointer]:
            - /url: /admin/attendance/calendar
          - link "Analytics" [ref=f1e79] [cursor=pointer]:
            - /url: /admin/attendance/analytics
      - button "Collapse" [ref=f1e83]
    - generic [ref=f1e87]:
      - banner [ref=f1e88]:
        - generic [ref=f1e89]:
          - textbox [ref=f1e96]:
            - /placeholder: Search clients, leads, tasks...
          - generic [ref=f1e97]:
            - button "Toggle theme" [ref=f1e98]
            - button "Open notifications" [ref=f1e102]
            - button "AU Admin User Admin" [ref=f1e107]:
              - generic [ref=f1e108]: AU
              - generic [ref=f1e109]:
                - generic [ref=f1e110]: Admin User
                - generic [ref=f1e111]: Admin
      - main [ref=f1e114]:
        - generic [ref=f1e117]:
          - generic [ref=f1e118]:
            - generic [ref=f1e119]:
              - button [ref=f1e120]
              - generic [ref=f1e123]:
                - generic [ref=f1e124]:
                  - heading "Ali jewo" [level=1] [ref=f1e125]
                  - generic [ref=f1e126]: high
                - paragraph [ref=f1e127]: PRS-000003
            - generic [ref=f1e128]:
              - button "Edit" [ref=f1e129]
              - button "Archive" [ref=f1e130]
          - generic [ref=f1e134]:
            - generic [ref=f1e135]:
              - paragraph [ref=f1e136]: Pipeline Stage
              - generic [ref=f1e137]: Won
            - generic [ref=f1e138]:
              - button "Contacted" [ref=f1e139] [cursor=pointer]
              - button "New Lead" [ref=f1e140] [cursor=pointer]
              - button "Initial Discussion" [ref=f1e141] [cursor=pointer]
              - button "Meeting Scheduled" [ref=f1e142] [cursor=pointer]
              - button "Meeting Completed" [ref=f1e143] [cursor=pointer]
              - button "Qualified Prospect" [ref=f1e144] [cursor=pointer]
              - button "Proposal Preparation" [ref=f1e145] [cursor=pointer]
              - button "Proposal Sent" [ref=f1e146] [cursor=pointer]
              - button "Pricing Negotiation" [ref=f1e147] [cursor=pointer]
              - button "Follow-up/Negotiation" [ref=f1e148] [cursor=pointer]
              - button "Onboarding/Documentation" [ref=f1e149] [cursor=pointer]
              - button "Won" [disabled] [ref=f1e150]
              - button "On Hold" [ref=f1e151] [cursor=pointer]
              - button "Lost" [ref=f1e152] [cursor=pointer]
            - paragraph [ref=f1e153]:
              - text: "Probability:"
              - generic [ref=f1e154]: 100%
          - generic [ref=f1e155]:
            - button "Details" [ref=f1e156]
            - button "Contacts (1)" [ref=f1e157]
            - button "Stage History (4)" [ref=f1e158]
            - button "Activity" [ref=f1e159]
            - button "Proposals" [ref=f1e160]
            - button "Onboarding" [ref=f1e161]
          - generic [ref=f1e163]:
            - generic [ref=f1e164]:
              - generic [ref=f1e165]:
                - heading "Onboarding" [level=3] [ref=f1e166]
                - paragraph [ref=f1e167]: Document collection for won deals
              - button "Start Onboarding" [ref=f1e168]
            - generic [ref=f1e171]:
              - generic [ref=f1e172]:
                - generic [ref=f1e173]: OBC-000005
                - generic [ref=f1e174]:
                  - generic [ref=f1e175]: In Progress
                  - button "Delete onboarding case" [ref=f1e176]
              - generic [ref=f1e180]:
                - paragraph [ref=f1e182]: Started Nov 3, 2026
                - generic [ref=f1e183]:
                  - paragraph [ref=f1e184]: "1"
                  - paragraph [ref=f1e185]: outstanding
              - button "Document Checklist (0/1 approved)" [active] [ref=f1e186]:
                - generic [ref=f1e187]:
                  - text: Document Checklist
                  - generic [ref=f1e190]: (0/1 approved)
              - generic [ref=f1e193]:
                - generic [ref=f1e195]:
                  - generic [ref=f1e196]:
                    - generic [ref=f1e197]:
                      - generic [ref=f1e198]: Required
                      - generic [ref=f1e199]: NID Copy
                    - generic [ref=f1e200]: Uploaded
                  - generic [ref=f1e204]:
                    - link "persist-test.txt" [ref=f1e209] [cursor=pointer]:
                      - /url: https://cpvwkbpsekxttufzrzgk.supabase.co/storage/v1/object/public/onboarding-docs/87f9fee6-0c87-4694-9e05-ab907c8b3d0b/34d6dada-0ff7-4c98-8de5-d2b7f02a1211/1793735246845.txt
                    - generic [ref=f1e210]: · Nov 4, 2026
                  - generic [ref=f1e211]:
                    - button "Replace" [ref=f1e212]
                    - button "Mark under review" [ref=f1e216]
                    - button "Approve" [ref=f1e220]
                    - button "Reject" [ref=f1e224]
                - generic [ref=f1e229]:
                  - paragraph [ref=f1e230]: 1 required document outstanding
                  - list [ref=f1e233]:
                    - listitem [ref=f1e234]:
                      - generic [ref=f1e235]: Uploaded
                      - text: NID Copy
```

# Test source

```ts
  140 |     expect(uploadCalled).toBe(false)
  141 |   })
  142 | })
  143 | 
  144 | // ── SUITE 2: Immediate UI update — the clearCache() fix ───────────────────────
  145 | 
  146 | test.describe('Immediate UI update after upload (clearCache fix)', () => {
  147 | 
  148 |   test('status badge changes from "Not uploaded" / previous state to "Uploaded" without page reload', async ({ page }) => {
  149 |     await openChecklist(page)
  150 | 
  151 |     // Note the current status before uploading
  152 |     const badge = page.locator('[data-testid="item-status"], .rounded-full').filter({ hasText: /uploaded|not uploaded/i }).first()
  153 | 
  154 |     await openUploadModal(page)
  155 |     await attachFile(page, 'immediate-update-test.txt', 'testing immediate update')
  156 |     await page.getByRole('button', { name: 'Upload' }).click()
  157 | 
  158 |     // Wait for modal to close (upload complete)
  159 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  160 | 
  161 |     // "Uploaded" badge must appear — without any navigation event
  162 |     await expect(page.getByText('immediate-update-test.txt')).toBeVisible()
  163 |     // Status badge on the item must be "Uploaded"
  164 |     await expect(page.locator('.rounded-full', { hasText: 'Uploaded' }).first()).toBeVisible()
  165 |   })
  166 | 
  167 |   test('Replace: new filename appears immediately — old filename is gone', async ({ page }) => {
  168 |     // First ensure there IS a file to replace by uploading one
  169 |     await openChecklist(page)
  170 |     await openUploadModal(page)
  171 |     await attachFile(page, 'original-file.txt', 'original content')
  172 |     await page.getByRole('button', { name: 'Upload' }).click()
  173 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  174 | 
  175 |     // Now Replace with a different file
  176 |     await openUploadModal(page)   // Replace button shows since file exists
  177 |     await attachFile(page, 'replaced-file.txt', 'replacement content')
  178 |     await page.getByRole('button', { name: 'Upload' }).click()
  179 |     await expect(page.getByRole('heading', { name: /Upload: NID Copy/i })).not.toBeVisible({ timeout: 15_000 })
  180 | 
  181 |     // New filename must be visible
  182 |     await expect(page.getByText('replaced-file.txt')).toBeVisible()
  183 |     // Old filename must be gone — proves cache was busted and fresh data loaded
  184 |     await expect(page.getByText('original-file.txt')).not.toBeVisible()
  185 |   })
  186 | 
  187 |   test('"Outstanding" counter stays at 1 after upload — uploaded ≠ approved', async ({ page }) => {
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
> 240 |     await page.getByText('NID Copy').waitFor()
      |                                      ^ Error: locator.waitFor: Error: strict mode violation: getByText('NID Copy') resolved to 2 elements:
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
```
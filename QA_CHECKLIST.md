# Markition CRM — Manual QA Checklist

**Test accounts**

| Role            | Email                         | Password     |
|-----------------|-------------------------------|--------------|
| Admin           | admin1@markition.com          | Admin@123456                     |
| Project Manager | pm1@markition.com             | (set via Supabase Dashboard)     |
| Sales           | sales1@markition.com          | (set via Supabase Dashboard)     |

Run each section for every role unless noted. Open DevTools → Network to spot accidental direct Supabase calls (none should appear — all traffic should go to `/api/*`).

---

## 1. Authentication

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Navigate to `http://localhost:3000`. Not logged in. | Redirected to `/login` | |
| 1.2 | Submit login form with wrong password. | Red error message shown, no redirect | |
| 1.3 | Log in as **admin1**. | Redirected to `/dashboard`. Topbar shows "Admin1 / Admin". | |
| 1.4 | Click the avatar/sign-out in topbar. | Redirected back to `/login`. Session cleared. | |
| 1.5 | Log in as **pm1**. | Topbar shows role "Project Manager". | |
| 1.6 | Log in as **sales1**. | Topbar shows role "Sales". | |

---

## 2. Role-based Navigation (Sidebar)

Check which nav items appear for each role.

| Nav item   | Admin | PM | Sales |
|------------|-------|----|-------|
| Dashboard  | ✓     | ✓  | ✓     |
| Companies  | ✓     | ✓  | ✗     |
| Leads      | ✓     | ✗  | ✓     |
| Prospects  | ✓     | ✗  | ✓     |
| Tasks      | ✓     | ✓  | ✗     |

**Steps:**
- Log in as each role. Count the sidebar items and verify the table above.
- As **PM**, manually navigate to `/leads` → should get a 403 or empty/redirect (server enforces this).
- As **Sales**, manually navigate to `/companies` → should get a 403.
- As **Sales**, manually navigate to `/tasks` → should get a 403.

---

## 3. Companies — Admin & PM only

### 3.1 List page (`/companies`)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.1.1 | Log in as **admin**. Go to `/companies`. | Company list loads with name, industry, categories as pills. | |
| 3.1.2 | "New Company" button visible. | ✓ | |
| 3.1.3 | Log in as **PM**. Go to `/companies`. | Same list loads. "New Company" button visible. | |
| 3.1.4 | Log in as **Sales**. Try to go to `/companies`. | 403 or blocked by sidebar — sidebar has no Companies link. | |

### 3.2 Create Company — Step 1 (Info + Categories)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.2.1 | Click "New Company". | Step 1 of stepper opens: Company Info. | |
| 3.2.2 | Type in Company Name (required). Fill optional fields (industry, phone, website, address). | Fields accept input. | |
| 3.2.3 | Click "Service Categories" combobox, type a partial name of an existing category. | Matching categories appear in dropdown. | |
| 3.2.4 | Select a category. | It appears as a tag/pill. | |
| 3.2.5 | **Admin only:** Type a completely new category name (no match). | "+ Create 'XYZ'" option appears. Click it → category created and selected. | |
| 3.2.6 | **PM:** Type a new non-matching category name. | No "+ Create" option appears. Only existing categories shown. | |
| 3.2.7 | Click "Next: Add Contacts". | Moves to Step 2. Step indicator updates. | |

### 3.3 Create Company — Step 2 (Contacts)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.3.1 | First Name is marked required. | ✓ | |
| 3.3.2 | Fill in a contact (first name, last name, email, phone, title). Click "Add Contact". | Contact added to list below. | |
| 3.3.3 | Add a second contact. | Both appear in the list. | |
| 3.3.4 | Click "Skip" (or "Next" with no contacts). | Moves to Step 3 without error. | |

### 3.4 Create Company — Step 3 (Prospects)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.4.1 | Add a prospect with notes. Status defaults to "new". | Form accepts input. | |
| 3.4.2 | Click "Create Company". | Creates company (and categories, contacts, prospects). Redirected to `/companies/[id]`. | |
| 3.4.3 | Verify the new company appears in the list at `/companies`. | ✓ | |

### 3.5 Company Detail (`/companies/[id]`)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.5.1 | Open any company detail page. | 4 tabs: Info, Contacts, Prospects, Tasks. Info tab open by default. | |
| 3.5.2 | **Info tab:** Edit company name/industry inline. Save. | Values updated. PUT /api/companies/[id] called. | |
| 3.5.3 | **Contacts tab:** List shows existing contacts. Add a new contact via the form. | Contact appears in list after save. | |
| 3.5.4 | **Prospects tab:** List shows linked prospects with status badges. | ✓ | |
| 3.5.5 | **Tasks tab:** List shows tasks linked to this company. | ✓ | |

---

## 4. Prospects

### 4.1 List page (`/prospects`) — Admin & Sales only

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 4.1.1 | Log in as **admin**. Go to `/prospects`. | Prospects list with status filter pills (All, New, Contacted, Converted, Dropped). | |
| 4.1.2 | Filter by "New". | Only new prospects shown. | |
| 4.1.3 | "Convert to Lead" button visible on each row. | ✓ (admin/sales only) | |
| 4.1.4 | Click "Convert to Lead" on a prospect with status "new". | Prospect status changes to "converted". A new lead is created. | |
| 4.1.5 | Log in as **PM**. Try `/prospects`. | 403 or redirect — PM has no access. | |
| 4.1.6 | Log in as **Sales**. Go to `/prospects`. | List loads. "Convert to Lead" button visible. | |

---

## 5. Leads

### 5.1 List page (`/leads`) — Admin & Sales only

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 5.1.1 | Log in as **admin**. Go to `/leads`. | Leads list with pipeline stage filter pills. | |
| 5.1.2 | Click "New Lead". Fill title, optional notes. | Lead created. Appears in list. | |
| 5.1.3 | Filter by "first contact". | Only those leads shown. | |
| 5.1.4 | Log in as **PM**. Try `/leads`. | 403 — no access. | |
| 5.1.5 | Log in as **Sales**. Go to `/leads`. | List loads. "New Lead" button visible. | |

### 5.2 Lead Detail (`/leads/[id]`)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 5.2.1 | Open a lead. Pipeline stage buttons are displayed. | ✓ | |
| 5.2.2 | **Admin/Sales:** Click a stage button (e.g. "follow up"). | Stage updates. Button ring moves to new stage. | |
| 5.2.3 | **Admin/Sales:** Click "Edit". Change title and notes. Click "Save". | Fields update. | |
| 5.2.4 | **PM:** Navigate to a lead URL directly. Pipeline stage buttons are disabled/read-only. No Edit button shown. | ✓ | |
| 5.2.5 | **Admin/Sales:** Advance a won/failed lead. Stage buttons disabled once terminal. | ✓ | |

---

## 6. Tasks

### 6.1 List page (`/tasks`) — Admin & PM only

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 6.1.1 | Log in as **admin**. Go to `/tasks`. | Tasks list with status filter pills (All, Open, In Progress, Done, Cancelled). | |
| 6.1.2 | Click "New Task". Fill title (required), description, pick a company, set due date. | Task created. Appears in list. | |
| 6.1.3 | Filter by "Open". | Only open tasks shown. | |
| 6.1.4 | Log in as **PM**. Go to `/tasks`. | List loads. "New Task" button visible. | |
| 6.1.5 | Log in as **Sales**. Try `/tasks`. | 403 — no Tasks link in sidebar, direct nav blocked. | |

### 6.2 Task Detail (`/tasks/[id]`)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 6.2.1 | Open a task as **admin**. | Two-column layout: task details on left, activity log on right. | |
| 6.2.2 | Click "Edit". Change status, due date, description. Click "Save". | Fields updated. Activity log shows a new entry for each changed field. | |
| 6.2.3 | Open as **PM**. Edit button visible. | ✓ | |
| 6.2.4 | Verify changelog shows: actor, field changed, old → new value, timestamp. | ✓ | |
| 6.2.5 | If task was created by the test script, "Task created" entry appears in activity log. | ✓ | |

---

## 7. Cross-cutting / Security

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | Open DevTools Network tab (filter `supabase`). Log in, browse pages. | **Zero** direct calls to Supabase from the browser. All data goes through `/api/*`. | |
| 7.2 | Copy a valid JWT from a logged-in session. Try calling `/api/companies` without Authorization header via curl/Postman. | 401 Unauthorized. | |
| 7.3 | Log in as **PM**. Call `GET /api/leads` with PM's token. | 403 Forbidden. | |
| 7.4 | Log in as **Sales**. Call `GET /api/tasks` with Sales token. | 403 Forbidden. | |
| 7.5 | Log out. Navigate to `/companies`. | Redirected to `/login` by AuthGuard. | |
| 7.6 | Open a company in one tab. Log out in another. Refresh the first tab. | Redirected to `/login`. | |

---

## 8. Edge cases

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 8.1 | Create a company with NO contacts, NO prospects (skip both steps). | Company created successfully. | |
| 8.2 | Try to create a company without filling "Company Name". | "Next" button disabled or validation error shown. | |
| 8.3 | Create a lead via "Convert to Prospect" on a prospect. Go to that lead's detail. | `source_prospect_id` shown as reference. | |
| 8.4 | Open a task with no changelog entries. | "No activity yet." shown in activity log. | |
| 8.5 | Filter leads by a pipeline stage with no results. | Empty state shown, no JS error. | |
| 8.6 | Navigate to `/companies/nonexistent-id`. | Error message shown (not a crash). | |

---

*Generated after 21/21 backend tests passing. Frontend built on Next.js 16 App Router with Supabase auth + API routes for all data access.*

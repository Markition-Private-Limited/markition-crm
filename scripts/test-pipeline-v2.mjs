/**
 * test-pipeline-v2.mjs
 * End-to-end test for the pipeline v2 schema.
 *
 * Tests:
 *   - Prospect creation and full pipeline walk (→ closed_won)
 *   - Auto-client creation on closed_won (trigger)
 *   - No duplicate client on re-save of closed_won
 *   - Task against a client
 *   - Task against a company directly
 *   - Role restrictions: PM cannot touch prospects, Sales cannot touch tasks/client-write
 *
 * Usage:
 *   node scripts/test-pipeline-v2.mjs [BASE_URL]
 *   BASE_URL defaults to http://localhost:3000
 *
 * Requires dev server running and migration 20261013_crm_pipeline_v2.sql applied.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dir, '..')

function loadEnv(f) {
  const env = {}
  try {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* ignore */ }
  return env
}

const env = { ...loadEnv(path.join(root, '.env.local')), ...process.env }
const BASE         = process.argv[2] || 'http://localhost:3000'
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY

const USERS = {
  admin: { email: 'admin1@markition.com', id: '82bd8a27-65e7-4caa-ae00-6e1796dc9347', pass: 'Admin@123456', roleName: 'Admin' },
  pm:    { email: 'pm1@markition.com',    id: '0b03e30f-0000-0000-0000-000000000000', pass: 'PM@123456',    roleName: 'Project Manager' },
  sales: { email: 'sales1@markition.com', id: 'b908e088-0000-0000-0000-000000000000', pass: 'Sales@123456', roleName: 'Sales' },
}

const results = []
function pass(name) { results.push({ name, status: 'PASS' }); console.log(`  ✅  ${name}`) }
function fail(name, reason) { results.push({ name, status: 'FAIL', reason }); console.log(`  ❌  ${name}: ${reason}`) }

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
const adminSb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function getToken(user) {
  // Try to sign in; if fails, reset password and retry
  const { data, error } = await sb.auth.signInWithPassword({ email: user.email, password: user.pass })
  if (!error && data?.session) return data.session.access_token

  // Resolve actual user id from DB
  const { data: { users }, error: listErr } = await adminSb.auth.admin.listUsers()
  if (listErr) throw new Error(`listUsers: ${listErr.message}`)
  const found = users.find(u => u.email?.toLowerCase() === user.email.toLowerCase())
  if (!found) throw new Error(`User ${user.email} not found in auth.users`)

  await adminSb.auth.admin.updateUserById(found.id, { password: user.pass })

  const { data: data2, error: err2 } = await sb.auth.signInWithPassword({ email: user.email, password: user.pass })
  if (err2) throw new Error(`Cannot sign in as ${user.email}: ${err2.message}`)
  return data2.session.access_token
}

async function ensureRole(userEmail, roleName) {
  const { data: { users } } = await adminSb.auth.admin.listUsers()
  const u = users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase())
  if (!u) return

  const { data: roles } = await adminSb.from('app_roles').select('id').ilike('name', roleName).single()
  if (!roles) { console.log(`  ⚠️  Role "${roleName}" not found — skipping assignment`); return }

  await adminSb.from('user_roles').upsert({ user_id: u.id, role_id: roles.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true })
}

async function main() {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  Markition CRM — Pipeline v2 Test Suite')
  console.log(`  Base: ${BASE}`)
  console.log('══════════════════════════════════════════════════\n')

  // ── 1. Setup: tokens for all roles ────────────────────────────────────────
  console.log('── 1. Auth & role setup ────────────────────────────────────────────────')
  await ensureRole(USERS.pm.email, USERS.pm.roleName)
  await ensureRole(USERS.sales.email, USERS.sales.roleName)

  let adminToken, pmToken, salesToken
  try { adminToken = await getToken(USERS.admin); pass('admin login') }
  catch (e) { fail('admin login', e.message); process.exit(1) }
  try { pmToken = await getToken(USERS.pm); pass('pm login') }
  catch (e) { fail('pm login', e.message); pmToken = null }
  try { salesToken = await getToken(USERS.sales); pass('sales login') }
  catch (e) { fail('sales login', e.message); salesToken = null }

  // ── 2. Create company (admin) ─────────────────────────────────────────────
  console.log('\n── 2. Company ──────────────────────────────────────────────────────────')
  let companyId
  {
    const r = await api('POST', '/api/companies', {
      name: `Pipeline Test Co ${Date.now()}`, industry: 'Technology',
      website: 'https://pipelinetest.example.com', phone: '+1-555-0200',
    }, adminToken)
    if (r.status === 201 && r.data?.id) { companyId = r.data.id; pass('company POST') }
    else fail('company POST', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // ── 3. Prospect (admin/sales creates) ────────────────────────────────────
  console.log('\n── 3. Prospect ─────────────────────────────────────────────────────────')
  let prospectId
  if (companyId) {
    const r = await api('POST', '/api/prospects', {
      company_id: companyId,
      name: 'John Pipeline',
      notes: 'High-value prospect',
      source: 'cold outreach',
    }, adminToken)
    if (r.status === 201 && r.data?.id) {
      prospectId = r.data.id
      pass(`prospect POST (status=${r.data.status})`)
      if (r.data.status !== 'first_contact') fail('prospect default status', `got ${r.data.status}`)
      else pass('prospect default status = first_contact')
    } else fail('prospect POST', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // ── 4. Walk pipeline statuses ────────────────────────────────────────────
  console.log('\n── 4. Prospect pipeline walk ───────────────────────────────────────────')
  const stages = ['follow_up', 'discovery_call', 'closing', 'closed_won']
  if (prospectId) {
    for (const stage of stages) {
      const r = await api('PUT', `/api/prospects/${prospectId}`, { status: stage }, adminToken)
      if (r.status === 200 && r.data?.status === stage) pass(`prospect status → ${stage}`)
      else fail(`prospect status → ${stage}`, `${r.status} ${JSON.stringify(r.data)}`)
    }
  }

  // ── 5. Client auto-created on closed_won ─────────────────────────────────
  console.log('\n── 5. Auto-client creation ─────────────────────────────────────────────')
  let clientId
  if (prospectId) {
    // Give trigger a moment (should be immediate but be safe)
    await new Promise(r => setTimeout(r, 300))

    const r = await api('GET', `/api/clients?prospect_id=${prospectId}`, null, adminToken)
    if (r.status === 200 && Array.isArray(r.data) && r.data.length === 1) {
      clientId = r.data[0].id
      pass(`auto-client created (id=${clientId.slice(0,8)})`)
      if (r.data[0].company_id === companyId) pass('client.company_id matches prospect.company_id')
      else fail('client.company_id mismatch', `expected ${companyId}, got ${r.data[0].company_id}`)
    } else {
      fail('auto-client created', `${r.status} count=${r.data?.length} ${JSON.stringify(r.data)}`)
    }
  }

  // ── 6. No duplicate on re-save closed_won ────────────────────────────────
  console.log('\n── 6. No duplicate client ──────────────────────────────────────────────')
  if (prospectId) {
    await api('PUT', `/api/prospects/${prospectId}`, { status: 'closed_won' }, adminToken)
    await new Promise(r => setTimeout(r, 300))
    const r = await api('GET', `/api/clients?prospect_id=${prospectId}`, null, adminToken)
    if (r.status === 200 && Array.isArray(r.data) && r.data.length === 1)
      pass('no duplicate client on re-save closed_won')
    else fail('no duplicate client', `count=${r.data?.length}`)
  }

  // ── 7. Task against client ────────────────────────────────────────────────
  console.log('\n── 7. Task against client ──────────────────────────────────────────────')
  let clientTaskId
  if (clientId) {
    const r = await api('POST', '/api/tasks', {
      client_id: clientId, title: 'Onboard Pipeline Client', status: 'Open',
    }, adminToken)
    if (r.status === 201 && r.data?.id) {
      clientTaskId = r.data.id
      pass(`task POST against client (id=${clientTaskId.slice(0,8)})`)
      if (r.data.client_id === clientId) pass('task.client_id set correctly')
      else fail('task.client_id', `expected ${clientId}, got ${r.data.client_id}`)
    } else fail('task POST against client', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // ── 8. Task against company ───────────────────────────────────────────────
  console.log('\n── 8. Task against company ─────────────────────────────────────────────')
  let companyTaskId
  if (companyId) {
    const r = await api('POST', '/api/tasks', {
      company_id: companyId, title: 'Company Admin Task', status: 'Open',
    }, adminToken)
    if (r.status === 201 && r.data?.id) {
      companyTaskId = r.data.id
      pass(`task POST against company (id=${companyTaskId.slice(0,8)})`)
    } else fail('task POST against company', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // Task with neither → should fail 400
  {
    const r = await api('POST', '/api/tasks', { title: 'Orphan Task' }, adminToken)
    if (r.status === 400) pass('task POST without target → 400')
    else fail('task POST without target', `expected 400, got ${r.status}`)
  }

  // Task with both → should fail 400
  if (companyId && clientId) {
    const r = await api('POST', '/api/tasks', {
      company_id: companyId, client_id: clientId, title: 'Both targets',
    }, adminToken)
    if (r.status === 400) pass('task POST with both targets → 400')
    else fail('task POST with both targets', `expected 400, got ${r.status}`)
  }

  // ── 9. Role restrictions ──────────────────────────────────────────────────
  console.log('\n── 9. Role restrictions ────────────────────────────────────────────────')

  // PM cannot access prospects
  {
    const r = await api('GET', '/api/prospects', null, pmToken)
    if (r.status === 403) pass('PM GET /api/prospects → 403')
    else if (!pmToken) pass('PM GET /api/prospects → skipped (no token)')
    else fail('PM GET /api/prospects', `expected 403, got ${r.status}`)
  }
  {
    if (prospectId) {
      const r = await api('PUT', `/api/prospects/${prospectId}`, { status: 'follow_up' }, pmToken)
      if (r.status === 403) pass('PM PUT /api/prospects/[id] → 403')
      else if (!pmToken) pass('PM PUT /api/prospects/[id] → skipped (no token)')
      else fail('PM PUT /api/prospects/[id]', `expected 403, got ${r.status}`)
    }
  }

  // PM can access clients and tasks
  {
    const r = await api('GET', '/api/clients', null, pmToken)
    if (r.status === 200) pass('PM GET /api/clients → 200')
    else if (!pmToken) pass('PM GET /api/clients → skipped (no token)')
    else fail('PM GET /api/clients', `${r.status} ${JSON.stringify(r.data)}`)
  }
  {
    const r = await api('GET', '/api/tasks', null, pmToken)
    if (r.status === 200) pass('PM GET /api/tasks → 200')
    else if (!pmToken) pass('PM GET /api/tasks → skipped (no token)')
    else fail('PM GET /api/tasks', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // Sales can access prospects
  {
    const r = await api('GET', '/api/prospects', null, salesToken)
    if (r.status === 200) pass('Sales GET /api/prospects → 200')
    else if (!salesToken) pass('Sales GET /api/prospects → skipped (no token)')
    else fail('Sales GET /api/prospects', `${r.status} ${JSON.stringify(r.data)}`)
  }

  // Sales can read clients but not write
  {
    const r = await api('GET', '/api/clients', null, salesToken)
    if (r.status === 200) pass('Sales GET /api/clients → 200 (read-only ok)')
    else if (!salesToken) pass('Sales GET /api/clients → skipped (no token)')
    else fail('Sales GET /api/clients', `${r.status} ${JSON.stringify(r.data)}`)
  }
  {
    if (clientId) {
      const r = await api('PATCH', `/api/clients/${clientId}`, { status: 'inactive' }, salesToken)
      if (r.status === 403) pass('Sales PATCH /api/clients/[id] → 403')
      else if (!salesToken) pass('Sales PATCH /api/clients/[id] → skipped (no token)')
      else fail('Sales PATCH /api/clients/[id]', `expected 403, got ${r.status}`)
    }
  }

  // Sales cannot access tasks
  {
    const r = await api('GET', '/api/tasks', null, salesToken)
    if (r.status === 403) pass('Sales GET /api/tasks → 403')
    else if (!salesToken) pass('Sales GET /api/tasks → skipped (no token)')
    else fail('Sales GET /api/tasks', `expected 403, got ${r.status}`)
  }

  // No token → 401
  {
    const r = await api('GET', '/api/prospects', null, null)
    if (r.status === 401) pass('unauthenticated → 401')
    else fail('unauthenticated → 401', `got ${r.status}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  console.log(`  Results: ${passed} passed, ${failed} failed / ${results.length} total`)
  if (failed > 0) {
    console.log('\n  Failures:')
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ❌ ${r.name}: ${r.reason}`))
  }
  console.log('══════════════════════════════════════════════════\n')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

/**
 * run-crm-migration.mjs
 * Runs supabase/migrations/20261005_crm_core.sql against the live DB.
 * Requires SUPABASE_DB_PASSWORD in env (from Supabase Dashboard → Settings → Database).
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=yourpassword node scripts/run-crm-migration.mjs
 */

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://cpvwkbpsekxttufzrzgk.supabase.co'
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split('.')[0]
const DB_PASSWORD  = env.SUPABASE_DB_PASSWORD

const SQL = readFileSync(path.join(root, 'supabase/migrations/20261005_crm_core.sql'), 'utf8')

if (!DB_PASSWORD) {
  console.error(`
❌  SUPABASE_DB_PASSWORD not set.

To get it:
  1. Open: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database
  2. Find "Database password" (or reset it and copy)
  3. Re-run: SUPABASE_DB_PASSWORD=yourpassword node scripts/run-crm-migration.mjs

Alternatively, paste the migration SQL directly in the Supabase SQL editor:
  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new
`)
  process.exit(1)
}

let pg
try {
  pg = (await import('pg')).default
} catch {
  console.error('❌  pg package not found. Run: npm install pg --save-dev')
  process.exit(1)
}

const { Client } = pg

const configs = [
  // Direct connection
  {
    label: 'Direct (db.*.supabase.co:5432)',
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  },
  // Transaction pooler
  {
    label: 'Pooler (*.pooler.supabase.com:6543)',
    host: `aws-0-ap-southeast-1.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  },
]

async function tryRun(config) {
  const client = new Client(config)
  try {
    await client.connect()
    console.log(`✅  Connected via ${config.label}`)
    try {
      await client.query(SQL)
      console.log('✅  Migration applied successfully.')
      await client.end()
      return true
    } catch (sqlErr) {
      console.log(`❌  SQL error: ${sqlErr.message}`)
      console.log('    Hint:', sqlErr.hint || 'none')
      console.log('    Position:', sqlErr.position || 'none')
      try { await client.end() } catch { /* ignore */ }
      return false
    }
  } catch (e) {
    console.log(`❌  ${config.label}: ${e.message}`)
    try { await client.end() } catch { /* ignore */ }
    return false
  }
}

let ok = false
for (const config of configs) {
  if (await tryRun(config)) { ok = true; break }
}

if (!ok) {
  console.error(`
❌  Could not connect to DB with any method.

Fallback: paste the migration SQL manually:
  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new
  File: markition-crm/supabase/migrations/20261005_crm_core.sql
`)
  process.exit(1)
}

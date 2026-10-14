/**
 * Applies 20261012_attendance_checkin.sql to the live Supabase database.
 * Run from the markition-crm directory: node scripts/run-checkin-migration.mjs
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = resolve(__dir, '../.env.local')
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch { /* env vars may already be set */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD  = process.env.SUPABASE_DB_PASSWORD

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local')
  process.exit(1)
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const connectionString = `postgresql://postgres:${DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`

const sql = readFileSync(resolve(__dir, '../supabase/migrations/20261012_attendance_checkin.sql'), 'utf8')

const { default: { Client } } = await import('pg')
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  await client.query(sql)
  console.log('✓ Migration applied: 20261012_attendance_checkin.sql')

  // Verify
  const { rows } = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'attendance_records'
      AND column_name  IN ('punctuality', 'shift_completed')
    ORDER BY column_name;
  `)
  if (rows.length === 2) {
    console.log('✓ Columns confirmed:', rows.map(r => `${r.column_name} (${r.data_type})`).join(', '))
  } else {
    console.warn('⚠  Expected 2 new columns, found:', rows)
  }
} finally {
  await client.end()
}

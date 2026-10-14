import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch { /* already set */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB_PASSWORD  = process.env.SUPABASE_DB_PASSWORD

// 1. Apply SQL migration via direct DB connection
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const connectionString = `postgresql://postgres:${DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`
const sql = readFileSync(resolve(__dir, '../supabase/migrations/20261012_attendance_wfh.sql'), 'utf8')

const { default: { Client } } = await import('pg')
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('✓ Migration applied: 20261012_attendance_wfh.sql')

  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_wfh_submissions'
    ORDER BY ordinal_position
  `)
  console.log('attendance_wfh_submissions columns:', rows.map(r => r.column_name).join(', '))
} finally {
  await client.end()
}

// 2. Ensure storage bucket exists via Supabase admin client
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const { error: bucketErr } = await supabase.storage.createBucket('wfh-proof', {
  public: false,
  allowedMimeTypes: ['image/*', 'application/pdf', 'video/*', 'text/plain'],
  fileSizeLimit: 10 * 1024 * 1024, // 10 MB
})

if (!bucketErr || bucketErr.message?.includes('already exists')) {
  console.log('✓ Storage bucket "wfh-proof" ready')
} else {
  console.error('⚠  Storage bucket creation error (non-fatal):', bucketErr.message)
}

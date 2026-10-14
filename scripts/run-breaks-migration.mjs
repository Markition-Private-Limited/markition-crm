import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch { /* already set */ }

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`
const sql = readFileSync(resolve(__dir, '../supabase/migrations/20261012_attendance_breaks.sql'), 'utf8')

const { default: { Client } } = await import('pg')
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('✓ Migration applied: 20261012_attendance_breaks.sql')
  const { rows } = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_breaks'
    ORDER BY ordinal_position;
  `)
  console.log('attendance_breaks columns:', rows.map(r => r.column_name).join(', '))
} finally {
  await client.end()
}

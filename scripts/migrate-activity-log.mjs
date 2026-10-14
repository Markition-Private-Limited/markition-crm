// Run: node scripts/migrate-activity-log.mjs
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load env from .env.local
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=').map((s) => s.trim()))
)

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Probe — if table exists, done
const { error: probeErr } = await client.from('activity_log').select('id').limit(1)
if (!probeErr) {
  console.log('✅  activity_log table already exists — nothing to do.')
  process.exit(0)
}

// Table is missing — use the pg extension if available, otherwise print instructions
const DDL = `
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx
  ON public.activity_log (entity_type, entity_id, created_at DESC);
`

const { error: rpcErr } = await client.rpc('exec_sql', { query: DDL })
if (!rpcErr) {
  console.log('✅  Migration complete via RPC.')
  process.exit(0)
}

console.log('⚠️  Cannot run DDL through the JS client (expected — Supabase blocks it).')
console.log('   Please run the following SQL in Supabase Dashboard → SQL Editor:\n')
console.log(DDL)
process.exit(1)

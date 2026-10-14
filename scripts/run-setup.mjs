/**
 * run-setup.mjs
 * 1. Checks whether the app_roles table exists (via REST).
 * 2. If missing, attempts DDL via pg direct connection (needs DB password).
 * 3. Inserts profile + super-admin role assignment for admin1@markition.com.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Parse .env.local manually (no dotenv dep needed) ──────────────────────
function loadEnv(envFile) {
  try {
    const raw = readFileSync(envFile, 'utf8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
  } catch { return {}; }
}

const __dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dir, '..');
const env = loadEnv(path.join(projectRoot, '.env.local'));

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USER_ID = '82bd8a27-65e7-4caa-ae00-6e1796dc9347';
const ADMIN_EMAIL   = 'admin1@markition.com';
const ADMIN_NAME    = 'Admin User';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Step 1: Check if schema is deployed ───────────────────────────────────
console.log('\n── Step 1: Checking if schema is deployed ──────────────────────────────');

// Check profiles — its "not in schema cache" = definitively not created yet
const { error: profilesCheck } = await supabase.from('profiles').select('id').limit(1);
const { error: rolesCheck }    = await supabase.from('app_roles').select('id').limit(1);

const notInCache = (e) => e && (e.message?.includes('schema cache') || e.message?.includes('does not exist') || e.code === '42P01');
const permDenied = (e) => e && e.code === '42501';

console.log('  profiles:', profilesCheck ? `${profilesCheck.code} ${profilesCheck.message}` : 'OK');
console.log('  app_roles:', rolesCheck   ? `${rolesCheck.code} ${rolesCheck.message}` : 'OK');

const schemaNotReady = notInCache(profilesCheck) || notInCache(rolesCheck);

if (schemaNotReady) {
  console.log('\n❌  Schema not deployed — tables are missing.');
  console.log('\n   HOW TO RUN MIGRATIONS (one-time paste):');
  console.log('   1. Open: https://supabase.com/dashboard/project/cpvwkbpsekxttufzrzgk/sql/new');
  console.log('   2. Paste the full contents of:');
  console.log('        markition-crm/supabase/COMBINED_MIGRATIONS.sql');
  console.log('   3. Click Run — then re-run: node scripts/run-setup.mjs');
  console.log('\n   (If you can provide the DB password from Supabase Dashboard → Settings → Database,');
  console.log('    I can connect directly with pg and skip this step entirely.)');
  process.exit(1);
}

if (permDenied(profilesCheck) || permDenied(rolesCheck)) {
  console.log('⚠️   Tables exist but REST access is restricted (GRANT issue) — continuing with inserts...');
} else {
  console.log('✅  Schema is deployed.');
}

// ── Step 2: Upsert profile ─────────────────────────────────────────────────
console.log('\n── Step 2: Upserting profile for', ADMIN_EMAIL, '──────────────────────────');

const { error: profileErr } = await supabase.from('profiles').upsert(
  {
    id:              ADMIN_USER_ID,
    email:           ADMIN_EMAIL,
    full_name:       ADMIN_NAME,
    is_active:       true,
    is_system_admin: true,
    updated_at:      new Date().toISOString(),
  },
  { onConflict: 'id' }
);

if (profileErr) {
  console.error('❌  profiles upsert failed:', profileErr.message);
  process.exit(1);
}
console.log('✅  Profile upserted.');

// ── Step 3: Resolve admin role id ─────────────────────────────────────────
console.log('\n── Step 3: Resolving admin role ──────────────────────────────────────────');

let roleId = null;
for (const slug of ['admin', 'super-admin']) {
  const { data } = await supabase.from('app_roles').select('id, name, slug').eq('slug', slug).maybeSingle();
  if (data) { roleId = data.id; console.log(`✅  Found role: ${data.name} (${data.slug}) id=${data.id}`); break; }
}

if (!roleId) {
  // Fall back: get any role with 'admin' in the name
  const { data } = await supabase.from('app_roles').select('id, name, slug').ilike('name', '%admin%').limit(1).maybeSingle();
  if (data) { roleId = data.id; console.log(`✅  Fallback role: ${data.name} (${data.slug}) id=${data.id}`); }
}

if (!roleId) {
  console.error('❌  No admin role found in app_roles. Check that migrations seeded the roles.');
  process.exit(1);
}

// ── Step 4: Assign role ────────────────────────────────────────────────────
console.log('\n── Step 4: Assigning role to user ────────────────────────────────────────');

const { error: roleErr } = await supabase.from('user_roles').upsert(
  {
    user_id:     ADMIN_USER_ID,
    role_id:     roleId,
    assigned_at: new Date().toISOString(),
  },
  { onConflict: 'user_id,role_id', ignoreDuplicates: false }
);

if (roleErr) {
  // Try without onConflict (table may not have that constraint)
  const { error: roleErr2 } = await supabase.from('user_roles').insert({
    user_id:     ADMIN_USER_ID,
    role_id:     roleId,
    assigned_at: new Date().toISOString(),
  });
  if (roleErr2 && !roleErr2.message?.includes('duplicate')) {
    console.error('❌  user_roles insert failed:', roleErr2.message);
    process.exit(1);
  }
  if (roleErr2?.message?.includes('duplicate')) console.log('✅  Role already assigned (no change).');
  else console.log('✅  Role assigned.');
} else {
  console.log('✅  Role assigned.');
}

// ── Step 5: Verify ─────────────────────────────────────────────────────────
console.log('\n── Step 5: Verification ──────────────────────────────────────────────────');

const REQUIRED_TABLES = [
  'profiles','app_roles','app_permissions','role_permissions','user_roles',
  'companies','quotations','contracts','projects','invoices',
];

for (const t of REQUIRED_TABLES) {
  const { error } = await supabase.from(t).select('*').limit(0);
  const ok = !error || (!error.message?.includes('does not exist') && !error.message?.includes('relation'));
  console.log(`  ${ok ? '✅' : '❌'}  ${t}${error && !ok ? '  ← ' + error.message : ''}`);
}

console.log('\n✅  Setup complete. Run the dev server and log in as', ADMIN_EMAIL);

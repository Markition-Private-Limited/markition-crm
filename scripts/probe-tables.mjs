import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(f) {
  const env = {};
  for (const line of readFileSync(f,'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g,'');
  }
  return env;
}
const env = loadEnv('.env.local');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const tables = ['profiles','app_roles','app_permissions','role_permissions','user_roles',
  'companies','quotations','quotation_items','contracts','projects','invoices'];

for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(0);
  if (!error) {
    console.log('OK  ' + t);
  } else {
    console.log('ERR ' + t + '  -> ' + error.code + ': ' + error.message.substring(0,80));
  }
}

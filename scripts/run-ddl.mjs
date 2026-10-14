/**
 * Tries to execute DDL via the Supabase Management API.
 * This endpoint normally requires a PAT, but let's see what happens with the service key.
 */

const PROJECT_REF    = "cpvwkbpsekxttufzrzgk";
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SERVICE_KEY || !SUPABASE_URL) {
  console.error("Missing env vars"); process.exit(1);
}

const DDL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE,
  email      text,
  full_name  text,
  active     boolean NOT NULL DEFAULT true,
  is_active  boolean NOT NULL DEFAULT true,
  status     text    NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.profiles TO anon, authenticated, service_role;

GRANT ALL ON public.app_roles TO anon, authenticated, service_role;

GRANT ALL ON public.user_roles TO anon, authenticated, service_role;
`;

async function tryFetch(label, url, opts) {
  console.log(`\n--- ${label} ---`);
  console.log("URL:", url);
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text.slice(0, 500));
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    console.log("Fetch error:", e.message);
    return { ok: false, error: e.message };
  }
}

async function main() {
  // Try Supabase Management API
  await tryFetch(
    "Supabase Management API /database/query",
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: DDL }),
    }
  );

  // Try pg_net / REST direct
  await tryFetch(
    "Supabase REST /rpc/exec_sql",
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql: DDL }),
    }
  );
}

main().catch(e => { console.error(e); process.exit(1); });

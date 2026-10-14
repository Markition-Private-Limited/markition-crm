/**
 * Minimal auth schema check + admin seed using Supabase JS client.
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID   = "82bd8a27-65e7-4caa-ae00-6e1796dc9347";
const TARGET_EMAIL     = "admin1@markition.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function tableExists(table) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (!error) return true;
  const msg = String(error.message ?? "");
  if (msg.includes("does not exist") || error.code === "42P01" || error.code === "PGRST116") return false;
  console.warn(`  [warn] checking ${table}: code=${error.code} msg=${msg}`);
  return false;
}

async function main() {
  console.log("=== Step 1: Check which tables exist ===");
  const profExists  = await tableExists("profiles");
  const rolesExists = await tableExists("app_roles");
  const urExists    = await tableExists("user_roles");

  console.log("  profiles  :", profExists  ? "EXISTS" : "MISSING");
  console.log("  app_roles :", rolesExists ? "EXISTS" : "MISSING");
  console.log("  user_roles:", urExists    ? "EXISTS" : "MISSING");

  if (!profExists || !rolesExists || !urExists) {
    const missing = [
      !profExists  && "profiles",
      !rolesExists && "app_roles",
      !urExists    && "user_roles",
    ].filter(Boolean);
    console.error("\n⛔ Missing tables:", missing.join(", "));
    console.log("\nRun the SQL below in Supabase Dashboard → SQL Editor, then re-run this script:\n");
    console.log(`CREATE TABLE IF NOT EXISTS public.profiles (
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

CREATE TABLE IF NOT EXISTS public.app_roles (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.app_roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);`);
    process.exit(1);
  }

  console.log("\n=== Step 2: Ensure auth.users entry exists ===");
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error("List users: " + listErr.message);
  const existingUser = listData.users.find(u => u.id === TARGET_USER_ID || (u.email ?? "").toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (existingUser) {
    console.log("  Auth user already exists:", existingUser.id, existingUser.email);
    if (existingUser.id !== TARGET_USER_ID) {
      console.error("  ⚠  ID mismatch! Existing user has id", existingUser.id, "not", TARGET_USER_ID);
      console.error("  Update TARGET_USER_ID in the script to match, then re-run.");
      process.exit(1);
    }
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: "Admin@markition1",
      email_confirm: true,
      user_metadata: { full_name: "Admin User" },
    });
    if (createErr) throw new Error("Create auth user: " + createErr.message);
    console.log("  Created auth user:", created.user.id);
  }

  console.log("\n=== Step 3: Ensure 'admin' role exists ===");
  let roleId;
  const { data: existing, error: readErr } = await supabase
    .from("app_roles").select("id,name").ilike("name", "admin").limit(1);
  if (readErr) throw new Error("Read app_roles: " + readErr.message);

  if (existing?.length) {
    roleId = existing[0].id;
    console.log("  Found existing admin role:", roleId);
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("app_roles").insert({ name: "admin" }).select("id,name").single();
    if (insertErr) throw new Error("Insert app_roles: " + insertErr.message);
    roleId = inserted.id;
    console.log("  Created admin role:", roleId);
  }

  console.log("\n=== Step 4: Upsert profile ===");
  const { error: profErr } = await supabase.from("profiles").upsert(
    { id: TARGET_USER_ID, user_id: TARGET_USER_ID, email: TARGET_EMAIL,
      full_name: "Admin User", active: true, is_active: true, status: "active" },
    { onConflict: "id" }
  );
  if (profErr) throw new Error("Upsert profiles: " + profErr.message);
  console.log("  Profile upserted:", TARGET_USER_ID);

  console.log("\n=== Step 5: Assign admin role ===");
  const { error: urErr } = await supabase.from("user_roles").upsert(
    { user_id: TARGET_USER_ID, role_id: roleId },
    { onConflict: "user_id,role_id" }
  );
  if (urErr) throw new Error("Upsert user_roles: " + urErr.message);
  console.log("  user_roles entry set");

  console.log("\n✅ Done. admin1@markition.com / user_id", TARGET_USER_ID, "is admin.");
}

main().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });

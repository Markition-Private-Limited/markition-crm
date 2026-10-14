/**
 * Creates test accounts for every CRM role so you can QA the permission flow.
 * Run from the markition-crm directory:
 *   node scripts/seed-test-users.mjs
 *
 * Reads credentials from .env.local automatically.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local manually (no dotenv dependency needed)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {
  // .env.local might not be in parent; env vars may already be set
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Test users to create ────────────────────────────────────────────────────
const TEST_USERS = [
  { email: "admin1@markition.com",   password: "Admin@markition1",   full_name: "Admin User",           roleName: "Admin"           },
  { email: "pm1@markition.com",      password: "Test@markition1",    full_name: "Alice (PM)",            roleName: "Project Manager" },
  { email: "sales1@markition.com",   password: "Test@markition1",    full_name: "Bob (Sales Exec)",      roleName: "Sales Executive" },
  { email: "employee1@markition.com",password: "Test@markition1",    full_name: "Carol (Employee)",      roleName: "Employee"        },
  { email: "accountant@markition.com",password: "Test@markition1",   full_name: "David (Accountant)",    roleName: "Accountant"      },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function findRole(roleName) {
  const { data, error } = await supabase
    .from("app_roles")
    .select("id, name")
    .ilike("name", roleName)
    .limit(1);
  if (error || !data?.length) throw new Error(`Role not found: "${roleName}" — run migrations first`);
  return data[0];
}

async function upsertAuthUser(email, password, full_name) {
  // Check if user already exists
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    // Reset password so we know it
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return { id: existing.id, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) throw new Error(`Create user ${email}: ${error.message}`);
  return { id: data.user.id, created: true };
}

async function upsertProfile(userId, email, full_name) {
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, user_id: userId, email, full_name, active: true, is_active: true, status: "active" },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Profile upsert ${email}: ${error.message}`);
}

async function upsertPublicUser(userId, full_name) {
  const [first_name, ...rest] = (full_name ?? "").split(" ");
  const last_name = rest.join(" ") || null;
  const { error } = await supabase.from("users").upsert(
    { id: userId, first_name: first_name || null, last_name, display_name: full_name, active: true },
    { onConflict: "id" }
  );
  // Non-fatal: some setups may not have this table or it may auto-populate via trigger
  if (error) console.warn(`  ⚠  public.users upsert (non-fatal): ${error.message}`);
}

async function assignRole(userId, roleId) {
  const { error } = await supabase.from("user_roles").upsert(
    { user_id: userId, role_id: roleId },
    { onConflict: "user_id,role_id" }
  );
  if (error) throw new Error(`Role assign: ${error.message}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding test users...\n");
  const results = [];

  for (const user of TEST_USERS) {
    try {
      const role = await findRole(user.roleName);
      const { id, created } = await upsertAuthUser(user.email, user.password, user.full_name);
      await upsertPublicUser(id, user.full_name);
      await upsertProfile(id, user.email, user.full_name);
      await assignRole(id, role.id);

      results.push({ status: created ? "CREATED" : "UPDATED", email: user.email, password: user.password, role: user.roleName });
      console.log(`  ✓ [${created ? "created" : "updated"}]  ${user.email}  →  ${user.roleName}`);
    } catch (err) {
      results.push({ status: "ERROR", email: user.email, error: err.message });
      console.error(`  ✗ ${user.email}: ${err.message}`);
    }
  }

  console.log("\n─────────────────────────────────────────────────────");
  console.log("  TEST CREDENTIALS (all passwords use the value below)");
  console.log("─────────────────────────────────────────────────────");
  console.log("  Default password for PM / Sales / Employee / Accountant:");
  console.log("    Test@markition1");
  console.log("");
  for (const r of results) {
    if (r.status !== "ERROR") {
      console.log(`  ${r.email.padEnd(30)} ${r.role}`);
    }
  }
  console.log("─────────────────────────────────────────────────────\n");
}

main().catch(err => { console.error(err.message); process.exit(1); });

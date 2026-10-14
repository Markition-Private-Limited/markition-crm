import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@markitioncrm.local";
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "ChangeMe@123";
const adminName = process.env.DEFAULT_ADMIN_NAME || "Markition Administrator";
const adminRoleName = process.env.DEFAULT_ADMIN_ROLE || "admin";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalize(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

async function ensureRole(roleName) {
  const normalizedRole = normalize(roleName);

  const rolesRead = await supabase.from("roles").select("id,name").ilike("name", roleName).limit(1);
  if (!rolesRead.error && (rolesRead.data?.length ?? 0) > 0) {
    return { table: "roles", id: rolesRead.data[0].id, name: rolesRead.data[0].name };
  }

  const appRolesRead = await supabase.from("app_roles").select("id,name").ilike("name", roleName).limit(1);
  if (!appRolesRead.error && (appRolesRead.data?.length ?? 0) > 0) {
    return { table: "app_roles", id: appRolesRead.data[0].id, name: appRolesRead.data[0].name };
  }

  const rolesInsert = await supabase.from("roles").insert({ name: normalizedRole }).select("id,name").single();
  if (!rolesInsert.error && rolesInsert.data) {
    return { table: "roles", id: rolesInsert.data.id, name: rolesInsert.data.name };
  }

  const appRolesInsert = await supabase.from("app_roles").insert({ name: normalizedRole }).select("id,name").single();
  if (!appRolesInsert.error && appRolesInsert.data) {
    return { table: "app_roles", id: appRolesInsert.data.id, name: appRolesInsert.data.name };
  }

  throw new Error(
    `Unable to read or create role '${roleName}'. roles error: ${rolesInsert.error?.message || rolesRead.error?.message || "n/a"}; app_roles error: ${appRolesInsert.error?.message || appRolesRead.error?.message || "n/a"}`,
  );
}

async function ensureProfile(userId) {
  const profilePayload = {
    id: userId,
    user_id: userId,
    full_name: adminName,
    email: adminEmail,
    active: true,
    is_active: true,
    status: "active",
  };

  const profileUpsert = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("id")
    .single();

  if (profileUpsert.error) {
    throw new Error(`Failed to upsert profile: ${profileUpsert.error.message}`);
  }
}

async function ensureUserRole(userId, roleId) {
  const assignment = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role_id: roleId }, { onConflict: "user_id,role_id" });

  if (assignment.error) {
    throw new Error(`Failed to assign admin role: ${assignment.error.message}`);
  }
}

async function main() {
  const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) {
    throw new Error(`Failed to list users: ${existing.error.message}`);
  }

  const existingUser = existing.data.users.find((user) => normalize(user.email) === normalize(adminEmail));

  let userId = existingUser?.id;
  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    });

    if (created.error || !created.data.user) {
      throw new Error(`Failed to create admin user: ${created.error?.message || "unknown error"}`);
    }

    userId = created.data.user.id;
  }

  const role = await ensureRole(adminRoleName);
  await ensureProfile(userId);
  await ensureUserRole(userId, role.id);

  console.log(JSON.stringify({
    ok: true,
    adminEmail,
    adminPassword,
    adminName,
    roleTable: role.table,
    roleName: role.name,
    userId,
    note: "Change DEFAULT_ADMIN_PASSWORD after first login.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});

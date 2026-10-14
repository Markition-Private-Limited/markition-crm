import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_USER_ID = "82bd8a27-65e7-4caa-ae00-6e1796dc9347";

// Try to trigger the auth user update, which might fire a DB trigger to insert into public.users
const { data: updData, error: updErr } = await supabase.auth.admin.updateUserById(TARGET_USER_ID, {
  user_metadata: { setup_attempt: Date.now() }
});
console.log("auth update error:", updErr?.message);

// Check if that inserted into public.users
const { data: usersCheck, error: usersCheckErr } = await supabase.from("users").select("id").limit(5);
console.log("users after trigger:", JSON.stringify(usersCheck));
console.log("users check error:", usersCheckErr?.message ?? "none");

// Try inserting user_id into user_roles again
const { error: urErr } = await supabase.from("user_roles").upsert(
  { user_id: TARGET_USER_ID, role_id: "1c27235b-6ad9-44f8-a291-7f974b33e215" },
  { onConflict: "user_id,role_id" }
);
console.log("user_roles after trigger attempt:", urErr?.message ?? "SUCCESS");

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.admin.updateUserById("82bd8a27-65e7-4caa-ae00-6e1796dc9347", {
  password: "Admin@markition1",
  email_confirm: true,
});
console.log(error ? "ERROR: " + error.message : "Password reset OK for " + data.user.email);

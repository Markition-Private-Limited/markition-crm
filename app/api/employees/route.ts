import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import pg from 'pg'

// Roles admin can create — name must match app_roles.name exactly (case-insensitive lookup)
const ALLOWED_ROLE_NAMES = ['Sales', 'Project Manager', 'Employee', 'Accountant']

// Direct postgres pool — bypasses PostgREST so auth.users is visible in the same session.
// This avoids the FK cross-connection visibility issue when inserting into user_roles
// immediately after adminClient.auth.admin.createUser() via GoTrue.
const pgPool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
})

// ── GET /api/employees ────────────────────────────────────────
// Admin only: list all profiles with name, email, role, created_at
export async function GET(request: Request) {
  const { error } = await requireRole(request, ['admin'])
  if (error) return error

  const { data: profiles, error: pErr } = await adminClient
    .from('profiles')
    .select('id, full_name, email, created_at')
    .order('created_at', { ascending: false })

  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  const { data: userRoles, error: rErr } = await adminClient
    .from('user_roles')
    .select('user_id, app_roles(name)')

  if (rErr) return Response.json({ error: rErr.message }, { status: 500 })

  const roleByUser: Record<string, string> = {}
  for (const row of (userRoles ?? []) as unknown as Array<{ user_id: string; app_roles: { name: string } | null }>) {
    if (row.app_roles) roleByUser[row.user_id] = row.app_roles.name
  }

  const result = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: roleByUser[p.id] ?? null,
    created_at: p.created_at,
  }))

  return Response.json(result)
}

// ── POST /api/employees ───────────────────────────────────────
// Admin only: create a new employee (auth user + profile + role).
// Returns { id, email, full_name, role, temporary_password } on success.
// temporary_password is shown once; admin must share it with the new hire.
export async function POST(request: Request) {
  const { error } = await requireRole(request, ['admin'])
  if (error) return error

  let body: { full_name?: string; email?: string; role_name?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { full_name, email, role_name, password } = body

  if (!full_name?.trim()) return Response.json({ error: 'full_name is required' }, { status: 400 })
  if (!email?.trim()) return Response.json({ error: 'email is required' }, { status: 400 })
  if (!role_name) return Response.json({ error: 'role_name is required' }, { status: 400 })
  if (!password || password.length < 8) return Response.json({ error: 'password must be at least 8 characters' }, { status: 400 })

  // Validate role choice — only Sales and Project Manager are allowed here
  const normalised = ALLOWED_ROLE_NAMES.find((r) => r.toLowerCase() === role_name.toLowerCase())
  if (!normalised) {
    return Response.json(
      { error: `Invalid role. Allowed values: ${ALLOWED_ROLE_NAMES.join(', ')}` },
      { status: 400 },
    )
  }

  // Look up the role id from app_roles
  const { data: roleRow, error: roleErr } = await adminClient
    .from('app_roles')
    .select('id, name')
    .ilike('name', normalised)
    .maybeSingle()

  if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 })
  if (!roleRow) return Response.json({ error: `Role "${normalised}" not found in the database` }, { status: 500 })

  const normalEmail = email.trim().toLowerCase()
  const normalName = full_name.trim()

  // Create the Supabase auth user.
  // Pass full_name in user_metadata so the on_auth_user_created_profile trigger
  // creates the profile row with the correct name automatically.
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: normalEmail,
    password: password!,
    email_confirm: true,
    user_metadata: { full_name: normalName },
  })

  if (authErr) {
    if (authErr.message.toLowerCase().includes('already been registered') ||
        authErr.message.toLowerCase().includes('already exists') ||
        authErr.message.toLowerCase().includes('duplicate')) {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return Response.json({ error: authErr.message }, { status: 500 })
  }

  const userId = authData.user.id

  const cleanup = async () => {
    await adminClient.auth.admin.deleteUser(userId)
  }

  // Use a direct pg connection to insert in the same DB session where the newly-created
  // auth user is visible. PostgREST uses a separate connection and cannot always see a
  // user committed by GoTrue immediately, causing FK violations.
  // user_roles.user_id FK → public.users.id, so public.users must be populated first.
  const nameParts = normalName.split(' ')
  const firstName = nameParts[0] ?? normalName
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName

  const pgClient = await pgPool.connect()
  try {
    // public.users is required before user_roles insert (FK target)
    await pgClient.query(
      `INSERT INTO users (id, first_name, last_name, display_name, active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         first_name   = EXCLUDED.first_name,
         last_name    = EXCLUDED.last_name,
         display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         active       = true`,
      [userId, firstName, lastName, normalName],
    )
    await pgClient.query(
      `INSERT INTO profiles (id, user_id, full_name, email)
       VALUES ($1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         user_id   = EXCLUDED.user_id,
         full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
         email     = COALESCE(EXCLUDED.email, profiles.email)`,
      [userId, normalName, normalEmail],
    )
    await pgClient.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleRow.id],
    )
  } catch (pgErr) {
    pgClient.release()
    await cleanup()
    const msg = pgErr instanceof Error ? pgErr.message : String(pgErr)
    return Response.json({ error: `Failed to set up employee: ${msg}` }, { status: 500 })
  }
  pgClient.release()

  return Response.json(
    { id: userId, email: normalEmail, full_name: normalName, role: roleRow.name },
    { status: 201 },
  )
}

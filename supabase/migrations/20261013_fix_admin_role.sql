-- One-time fix: assign the Admin role to the existing admin user.
-- The admin user's user_roles row was never created due to the PostgREST FK
-- cross-connection visibility issue in the original seed script.
-- This migration inserts the row directly in the same DB session where auth.users is visible.

DO $$
DECLARE
  v_user_id   uuid;
  v_role_id   uuid;
BEGIN
  -- Look up the admin user
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@markitioncrm.local' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Admin user not found — skipping';
    RETURN;
  END IF;

  -- Look up the admin role
  SELECT id INTO v_role_id FROM public.app_roles WHERE lower(name) = 'admin' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE NOTICE 'Admin role not found in app_roles — skipping';
    RETURN;
  END IF;

  -- Upsert profile (in case it's also missing)
  INSERT INTO public.profiles (id, user_id, full_name, email)
  VALUES (v_user_id, v_user_id, 'Markition Administrator', 'admin@markitioncrm.local')
  ON CONFLICT (id) DO UPDATE SET
    user_id   = EXCLUDED.user_id,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    email     = COALESCE(EXCLUDED.email, public.profiles.email);

  -- Assign the role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Admin role assigned to user %', v_user_id;
END;
$$;

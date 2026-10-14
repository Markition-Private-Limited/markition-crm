-- Function called by the API to assign a role to a newly-created auth user.
-- Running inside the DB ensures auth.users is visible in the same session,
-- which avoids the FK violation that occurs when inserting via PostgREST
-- immediately after adminClient.auth.admin.createUser() via GoTrue.
-- public.users is also inserted here because user_roles.user_id → public.users.id.
CREATE OR REPLACE FUNCTION public.assign_new_employee_role(
  p_user_id    uuid,
  p_role_id    uuid,
  p_name       text,
  p_email      text,
  p_first_name text DEFAULT '',
  p_last_name  text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last  text;
BEGIN
  -- Derive first/last from full name when not provided
  v_first := NULLIF(trim(p_first_name), '');
  v_last  := NULLIF(trim(p_last_name), '');
  IF v_first IS NULL THEN
    v_first := split_part(trim(p_name), ' ', 1);
  END IF;
  IF v_last IS NULL THEN
    v_last := CASE
      WHEN strpos(trim(p_name), ' ') > 0
        THEN substr(trim(p_name), strpos(trim(p_name), ' ') + 1)
      ELSE v_first
    END;
  END IF;

  -- Insert into public.users (user_roles FK target)
  INSERT INTO public.users (id, first_name, last_name, display_name, active)
  VALUES (p_user_id, v_first, v_last, p_name, true)
  ON CONFLICT (id) DO UPDATE SET
    first_name   = EXCLUDED.first_name,
    last_name    = EXCLUDED.last_name,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    active       = true;

  -- Upsert profile (trigger may or may not have already created it)
  INSERT INTO public.profiles (id, user_id, full_name, email)
  VALUES (p_user_id, p_user_id, p_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    user_id   = EXCLUDED.user_id,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    email     = COALESCE(EXCLUDED.email, public.profiles.email);

  -- Assign role (ignore if already assigned)
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (p_user_id, p_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;

-- Only service_role (our server) can call this
REVOKE ALL ON FUNCTION public.assign_new_employee_role(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_new_employee_role(uuid, uuid, text, text, text, text) TO service_role;

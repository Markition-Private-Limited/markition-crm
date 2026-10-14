-- Minimal RLS read policies for auth snapshot role/permission resolution.
-- This migration preserves RLS and does not use service_role.

BEGIN;

-- Required table-level privileges for JWT role "authenticated".
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.app_roles TO authenticated;
GRANT SELECT ON TABLE public.role_permissions TO authenticated;
GRANT SELECT ON TABLE public.app_permissions TO authenticated;

-- user_roles: authenticated users can read only their own role assignments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles_select_own_assignments'
  ) THEN
    CREATE POLICY user_roles_select_own_assignments
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- app_roles: authenticated users can read only roles assigned to themselves.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_roles'
      AND policyname = 'app_roles_select_assigned_to_self'
  ) THEN
    CREATE POLICY app_roles_select_assigned_to_self
      ON public.app_roles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role_id = app_roles.id
        )
      );
  END IF;
END;
$$;

-- role_permissions: authenticated users can read permissions for roles assigned to themselves.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'role_permissions'
      AND policyname = 'role_permissions_select_assigned_to_self'
  ) THEN
    CREATE POLICY role_permissions_select_assigned_to_self
      ON public.role_permissions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role_id = role_permissions.role_id
        )
      );
  END IF;
END;
$$;

-- app_permissions: authenticated users can read permission rows reachable via their assigned roles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_permissions'
      AND policyname = 'app_permissions_select_assigned_to_self'
  ) THEN
    CREATE POLICY app_permissions_select_assigned_to_self
      ON public.app_permissions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          JOIN public.user_roles ur ON ur.role_id = rp.role_id
          WHERE ur.user_id = auth.uid()
            AND rp.permission_id = app_permissions.id
        )
      );
  END IF;
END;
$$;

COMMIT;

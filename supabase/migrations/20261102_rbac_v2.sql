-- =============================================================
-- MARKITION CRM — Roles, Permissions & RLS Fix (Priority 2)
-- 2026-11-02
--
-- Replaces 8-role legacy system with the 5 BRD roles:
--   SuperAdministrator, Administrator, BD Manager, BD Executive, Viewer
--
-- ROLE MIGRATION DECISIONS:
--   Super Admin          → SuperAdministrator   (direct)
--   Admin                → Administrator        (direct)
--   Project Manager      → BD Manager           (closest match — PMs managed
--                                                client pipeline/team like BD Manager)
--   Sales Manager        → BD Manager           (direct)
--   Sales Executive      → BD Executive         (direct)
--   Sales (generic)      → BD Executive         (individual contributor)
--   Employee             → Viewer               (internal read-only)
--   Accountant           → Viewer               (internal read-only)
--   (no role assigned)   → Viewer               (safe default for existing users)
--
-- TABLES CREATED:
--   teams, team_members, user_permissions, viewer_filters
--
-- RLS CHANGES:
--   prospects: replaces broad 'authenticated' policy with role-scoped policies
--   companies, contacts, tasks, projects, invoices, quotations: tightened
-- =============================================================

BEGIN;

-- ── 1. Insert the 5 BRD roles ─────────────────────────────────────────────────
-- Fixed UUIDs so migration is deterministic and idempotent

INSERT INTO public.app_roles (id, name, description) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'SuperAdministrator',
    'Full system access. Can grant/revoke permissions for Administrators.'),
  ('a0000001-0000-0000-0000-000000000002', 'Administrator',
    'Full operational access. Specific actions (delete, manage users/settings) require SuperAdmin grant.'),
  ('a0000001-0000-0000-0000-000000000003', 'BD Manager',
    'Manages BD Executives on their team. Sees and edits team prospects.'),
  ('a0000001-0000-0000-0000-000000000004', 'BD Executive',
    'Individual contributor. Sees and edits only their own assigned prospects.'),
  ('a0000001-0000-0000-0000-000000000005', 'Viewer',
    'Read-only access filtered by a saved filter set by an Administrator.')
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- ── 2. Teams ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  manager_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ── 3. Per-user permission grants ────────────────────────────────────────────
-- SuperAdmin can grant specific permissions to an Administrator user.
-- BD Executives can also receive 'add_prospects' here.

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_name text        NOT NULL,
  granted_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_name)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ── 4. Viewer saved filters ──────────────────────────────────────────────────
-- One row per Viewer; filter_config is e.g. {"industry":"Technology","country":"UAE"}

CREATE TABLE IF NOT EXISTS public.viewer_filters (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  filter_config jsonb       NOT NULL DEFAULT '{}',
  set_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.viewer_filters ENABLE ROW LEVEL SECURITY;

-- ── 5. Migrate user_roles to BRD roles ───────────────────────────────────────

DO $$
DECLARE
  r              RECORD;
  new_role_id    uuid;
  super_id       uuid;
  admin_id       uuid;
  bd_mgr_id      uuid;
  bd_exec_id     uuid;
  viewer_id      uuid;
BEGIN
  -- Cache the new role IDs
  SELECT id INTO super_id  FROM public.app_roles WHERE name = 'SuperAdministrator';
  SELECT id INTO admin_id  FROM public.app_roles WHERE name = 'Administrator';
  SELECT id INTO bd_mgr_id FROM public.app_roles WHERE name = 'BD Manager';
  SELECT id INTO bd_exec_id FROM public.app_roles WHERE name = 'BD Executive';
  SELECT id INTO viewer_id  FROM public.app_roles WHERE name = 'Viewer';

  -- For each user, pick the HIGHEST rank current role, map to new role
  FOR r IN
    SELECT DISTINCT ON (ur.user_id)
      ur.user_id,
      ar.name AS role_name
    FROM public.user_roles ur
    JOIN public.app_roles ar ON ar.id = ur.role_id
    ORDER BY ur.user_id,
      CASE ar.name
        WHEN 'Super Admin'      THEN 1
        WHEN 'Admin'            THEN 2
        WHEN 'Sales Manager'    THEN 3
        WHEN 'Project Manager'  THEN 3
        WHEN 'Sales Executive'  THEN 4
        WHEN 'Sales'            THEN 4
        WHEN 'Employee'         THEN 5
        WHEN 'Accountant'       THEN 5
        ELSE 6
      END ASC
  LOOP
    new_role_id := CASE r.role_name
      WHEN 'Super Admin'     THEN super_id
      WHEN 'Admin'           THEN admin_id
      WHEN 'Sales Manager'   THEN bd_mgr_id
      WHEN 'Project Manager' THEN bd_mgr_id
      WHEN 'Sales Executive' THEN bd_exec_id
      WHEN 'Sales'           THEN bd_exec_id
      ELSE viewer_id
    END;

    -- Remove ALL existing role assignments for this user, replace with single new role
    DELETE FROM public.user_roles WHERE user_id = r.user_id;
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (r.user_id, new_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END LOOP;

  -- Assign Viewer to any public.users entry that has no role yet.
  -- (auth.users without a matching public.users row cannot hold a role because
  -- user_roles.user_id FKs to public.users — those users must create a profile first.)
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT u.id, viewer_id
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
  )
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;

-- ── 6. DB helper functions for RLS ───────────────────────────────────────────

-- Returns the BRD role name for a given user ID (cached by role lookup)
CREATE OR REPLACE FUNCTION public.get_user_app_role(p_uid uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ar.name
  FROM public.user_roles ur
  JOIN public.app_roles ar ON ar.id = ur.role_id
  WHERE ur.user_id = p_uid
  LIMIT 1;
$$;

-- Returns the BRD role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.my_app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_app_role(auth.uid());
$$;

-- Returns true if the current user has a specific user-level permission
CREATE OR REPLACE FUNCTION public.my_has_permission(p_perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission_name = p_perm
  );
$$;

-- Returns true if a prospect is visible to the current user
-- Used in RLS SELECT policy
CREATE OR REPLACE FUNCTION public.prospect_visible_to_me(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.my_app_role()
    WHEN 'SuperAdministrator' THEN true
    WHEN 'Administrator'      THEN true
    WHEN 'BD Manager'         THEN (
      -- Own records, team members' records, or unassigned
      p_owner_id IS NULL
      OR p_owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE t.manager_id = auth.uid()
          AND tm.user_id = p_owner_id
      )
    )
    WHEN 'BD Executive' THEN (
      -- Only own records or unassigned
      p_owner_id IS NULL OR p_owner_id = auth.uid()
    )
    WHEN 'Viewer' THEN true  -- filter enforced at API level
    ELSE false
  END;
$$;

-- ── 7. Fix prospects RLS ──────────────────────────────────────────────────────

-- Drop the current open-door policy
DROP POLICY IF EXISTS prospects_authenticated ON public.prospects;
DROP POLICY IF EXISTS prospects_service_role  ON public.prospects;

-- service_role: full access (Next.js API layer)
CREATE POLICY prospects_service_role ON public.prospects
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SELECT: role-scoped
CREATE POLICY prospects_select ON public.prospects
  FOR SELECT
  TO authenticated
  USING (public.prospect_visible_to_me(owner_id));

-- INSERT: super_admin, admin, bd_manager always; bd_executive needs add_prospects permission
CREATE POLICY prospects_insert ON public.prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.my_app_role() IN ('SuperAdministrator', 'Administrator', 'BD Manager')
    OR (public.my_app_role() = 'BD Executive' AND public.my_has_permission('add_prospects'))
  );

-- UPDATE: super_admin, admin always; bd_manager on visible records; bd_executive own only
CREATE POLICY prospects_update ON public.prospects
  FOR UPDATE
  TO authenticated
  USING (public.prospect_visible_to_me(owner_id))
  WITH CHECK (public.prospect_visible_to_me(owner_id));

-- DELETE: super_admin always; admin needs delete_prospects permission; others never
CREATE POLICY prospects_delete ON public.prospects
  FOR DELETE
  TO authenticated
  USING (
    public.my_app_role() = 'SuperAdministrator'
    OR (public.my_app_role() = 'Administrator' AND public.my_has_permission('delete_prospects'))
  );

-- ── 8. Tighten RLS on other tables ───────────────────────────────────────────
-- Replace any "authenticated ALL" policies with role-aware ones.
-- Note: these tables are accessed by the API via service_role, so these
-- policies primarily protect direct PostgREST/client-side access.

-- companies: BD Manager and BD Executive can also view (they work with companies)
DROP POLICY IF EXISTS companies_admin_or_related ON public.companies;

CREATE POLICY companies_select ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    public.my_app_role() IN ('SuperAdministrator', 'Administrator', 'BD Manager', 'BD Executive')
  );

CREATE POLICY companies_write ON public.companies
  FOR ALL
  USING (public.my_app_role() IN ('SuperAdministrator', 'Administrator'))
  WITH CHECK (public.my_app_role() IN ('SuperAdministrator', 'Administrator'));

-- contacts: same scoping as companies
DROP POLICY IF EXISTS contacts_admin_or_related ON public.contacts;
DROP POLICY IF EXISTS contacts_service_role     ON public.contacts;

CREATE POLICY contacts_service_role ON public.contacts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY contacts_select ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    public.my_app_role() IN ('SuperAdministrator', 'Administrator', 'BD Manager', 'BD Executive')
  );

CREATE POLICY contacts_write ON public.contacts
  FOR ALL
  USING (public.my_app_role() IN ('SuperAdministrator', 'Administrator', 'BD Manager'))
  WITH CHECK (public.my_app_role() IN ('SuperAdministrator', 'Administrator', 'BD Manager'));

-- tasks: replace broad 'true' policy
DROP POLICY IF EXISTS tasks_authenticated_all ON public.tasks;

-- (tasks_role_based already exists — keep it, it checks owner/creator/project_manager via old roles)
-- Add a fallback for new roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks'
      AND policyname='tasks_new_roles'
  ) THEN
    CREATE POLICY tasks_new_roles ON public.tasks
      FOR ALL
      TO authenticated
      USING (
        auth.role() = 'service_role'
        OR public.my_app_role() IN ('SuperAdministrator', 'Administrator')
        OR (assigned_to = auth.uid())
        OR (created_by = auth.uid())
      );
  END IF;
END;
$$;

-- ── 9. RLS policies for new tables ───────────────────────────────────────────

-- teams: super_admin + admin can manage; bd_manager can read own team
CREATE POLICY teams_service_role ON public.teams FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY teams_admin_write ON public.teams
  FOR ALL TO authenticated
  USING (public.my_app_role() IN ('SuperAdministrator', 'Administrator'))
  WITH CHECK (public.my_app_role() IN ('SuperAdministrator', 'Administrator'));

CREATE POLICY teams_manager_read ON public.teams
  FOR SELECT TO authenticated
  USING (
    public.my_app_role() = 'BD Manager' AND manager_id = auth.uid()
  );

-- team_members: super_admin + admin manage; bd_manager reads own team's rows
CREATE POLICY team_members_service_role ON public.team_members FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY team_members_admin_write ON public.team_members
  FOR ALL TO authenticated
  USING (public.my_app_role() IN ('SuperAdministrator', 'Administrator'))
  WITH CHECK (public.my_app_role() IN ('SuperAdministrator', 'Administrator'));

CREATE POLICY team_members_manager_read ON public.team_members
  FOR SELECT TO authenticated
  USING (
    public.my_app_role() = 'BD Manager' AND
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid())
  );

-- user_permissions: only super_admin can write; target user can read own row
CREATE POLICY user_permissions_service_role ON public.user_permissions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY user_permissions_super_admin ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.my_app_role() = 'SuperAdministrator')
  WITH CHECK (public.my_app_role() = 'SuperAdministrator');

CREATE POLICY user_permissions_own_read ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- viewer_filters: admin can write; viewer can read own row
CREATE POLICY viewer_filters_service_role ON public.viewer_filters FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY viewer_filters_admin_write ON public.viewer_filters
  FOR ALL TO authenticated
  USING (public.my_app_role() IN ('SuperAdministrator', 'Administrator'))
  WITH CHECK (public.my_app_role() IN ('SuperAdministrator', 'Administrator'));

CREATE POLICY viewer_filters_own_read ON public.viewer_filters
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 10. GRANTs ────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewer_filters TO service_role;

GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT SELECT ON public.viewer_filters TO authenticated;

COMMIT;

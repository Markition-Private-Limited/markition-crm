-- =============================================================
-- MARKITION CRM â€” COMBINED MIGRATIONS
-- Generated: 2026-10-01
-- Paste the entire contents of this file into the Supabase
-- SQL Editor and click "Run". Safe to re-run (idempotent).
--
-- File order:
--   1. 20260703_auth_rbac_init.sql
--   2. 20260703_authz_snapshot_rls_select.sql
--   3. companies.sql
--   4. quotations.sql
--   5. contracts.sql
--   6. 20260706_projects_invoices.sql
--   7. workflows.sql
-- =============================================================


-- ============================================================
-- FILE: 20260703_auth_rbac_init.sql
-- ============================================================

-- 20260703_auth_rbac_init.sql
-- Upgrade-safe, idempotent RBAC/profile migration for mixed production schemas.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid,
  user_id uuid UNIQUE,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  department text,
  title text,
  active boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.profiles ALTER COLUMN active SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.profiles ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.profiles SET active = true WHERE active IS NULL;
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;
UPDATE public.profiles SET metadata = '{}'::jsonb WHERE metadata IS NULL;
UPDATE public.profiles SET created_at = timezone('utc', now()) WHERE created_at IS NULL;
UPDATE public.profiles SET updated_at = timezone('utc', now()) WHERE updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_pkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping profiles_id_fkey: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping profiles_user_id_fkey: %', SQLERRM;
  END;
END;
$$;

CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_system_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_roles_name_unique UNIQUE (name),
  CONSTRAINT app_roles_slug_unique UNIQUE (slug)
);

ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS is_system boolean;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS is_system_admin boolean;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.app_roles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.app_roles ALTER COLUMN is_system SET DEFAULT false;
ALTER TABLE public.app_roles ALTER COLUMN is_system_admin SET DEFAULT false;
ALTER TABLE public.app_roles ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.app_roles ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.app_roles SET is_system = false WHERE is_system IS NULL;
UPDATE public.app_roles SET is_system_admin = false WHERE is_system_admin IS NULL;
UPDATE public.app_roles SET created_at = timezone('utc', now()) WHERE created_at IS NULL;
UPDATE public.app_roles SET updated_at = timezone('utc', now()) WHERE updated_at IS NULL;

DO $$
DECLARE
  v_slug text;
  v_keep_id uuid;
BEGIN
  FOR v_slug, v_keep_id IN
    WITH ranked AS (
      SELECT
        slug,
        id,
        row_number() OVER (
          PARTITION BY slug
          ORDER BY created_at NULLS FIRST, id::text
        ) AS rn,
        count(*) OVER (PARTITION BY slug) AS cnt
      FROM public.app_roles
      WHERE slug IS NOT NULL
    )
    SELECT slug, id AS keep_id
    FROM ranked
    WHERE rn = 1
      AND cnt > 1
  LOOP
    IF to_regclass('public.user_roles') IS NOT NULL THEN
      UPDATE public.user_roles
      SET role_id = v_keep_id
      WHERE role_id IN (
        SELECT id FROM public.app_roles WHERE slug = v_slug AND id <> v_keep_id
      );
    END IF;

    IF to_regclass('public.role_permissions') IS NOT NULL THEN
      UPDATE public.role_permissions
      SET role_id = v_keep_id
      WHERE role_id IN (
        SELECT id FROM public.app_roles WHERE slug = v_slug AND id <> v_keep_id
      );
    END IF;

    DELETE FROM public.app_roles
    WHERE slug = v_slug
      AND id <> v_keep_id;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_roles_pkey' AND conrelid = 'public.app_roles'::regclass
  ) THEN
    ALTER TABLE public.app_roles ADD CONSTRAINT app_roles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_roles_name_unique' AND conrelid = 'public.app_roles'::regclass
  ) THEN
    ALTER TABLE public.app_roles ADD CONSTRAINT app_roles_name_unique UNIQUE (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_roles_slug_unique' AND conrelid = 'public.app_roles'::regclass
  ) THEN
    ALTER TABLE public.app_roles ADD CONSTRAINT app_roles_slug_unique UNIQUE (slug);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_permissions_name_unique UNIQUE (name),
  CONSTRAINT app_permissions_module_action_unique UNIQUE (module, action)
);

ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS is_system boolean;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.app_permissions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.app_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.app_permissions ALTER COLUMN is_system SET DEFAULT false;
ALTER TABLE public.app_permissions ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.app_permissions ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.app_permissions SET is_system = false WHERE is_system IS NULL;
UPDATE public.app_permissions SET created_at = timezone('utc', now()) WHERE created_at IS NULL;
UPDATE public.app_permissions SET updated_at = timezone('utc', now()) WHERE updated_at IS NULL;

DO $$
DECLARE
  v_name text;
  v_keep_id uuid;
BEGIN
  FOR v_name, v_keep_id IN
    WITH ranked AS (
      SELECT
        key,
        id,
        row_number() OVER (
          PARTITION BY name
          ORDER BY created_at NULLS FIRST, id::text
        ) AS rn,
        count(*) OVER (PARTITION BY name) AS cnt
      FROM public.app_permissions
      WHERE name IS NOT NULL
    )
    SELECT name, id AS keep_id
    FROM ranked
    WHERE rn = 1
      AND cnt > 1
  LOOP
    IF to_regclass('public.role_permissions') IS NOT NULL THEN
      UPDATE public.role_permissions
      SET permission_id = v_keep_id
      WHERE permission_id IN (
        SELECT id FROM public.app_permissions WHERE name = v_name AND id <> v_keep_id
      );
    END IF;

    DELETE FROM public.app_permissions
    WHERE name = v_name
      AND id <> v_keep_id;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_permissions_pkey' AND conrelid = 'public.app_permissions'::regclass
  ) THEN
    ALTER TABLE public.app_permissions ADD CONSTRAINT app_permissions_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_permissions_name_unique' AND conrelid = 'public.app_permissions'::regclass
  ) THEN
    ALTER TABLE public.app_permissions ADD CONSTRAINT app_permissions_name_unique UNIQUE (key);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_permissions_module_action_unique' AND conrelid = 'public.app_permissions'::regclass
  ) THEN
    ALTER TABLE public.app_permissions ADD CONSTRAINT app_permissions_module_action_unique UNIQUE (module, action);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT role_permissions_role_permission_unique UNIQUE (role_id, permission_id)
);

ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS role_id uuid;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS permission_id uuid;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.role_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.role_permissions ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
UPDATE public.role_permissions SET created_at = timezone('utc', now()) WHERE created_at IS NULL;

DELETE FROM public.role_permissions rp
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY role_id, permission_id
        ORDER BY created_at NULLS LAST, id
      ) AS rn
    FROM public.role_permissions
  ) t
  WHERE t.rn > 1
) d
WHERE rp.ctid = d.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_pkey' AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_role_permission_unique' AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_role_permission_unique UNIQUE (role_id, permission_id);
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.app_roles(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping role_permissions_role_id_fkey: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_permission_id_fkey
      FOREIGN KEY (permission_id) REFERENCES public.app_permissions(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping role_permissions_permission_id_fkey: %', SQLERRM;
  END;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role_id)
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.user_roles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.user_roles ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.user_roles SET created_at = timezone('utc', now()) WHERE created_at IS NULL;
UPDATE public.user_roles SET updated_at = timezone('utc', now()) WHERE updated_at IS NULL;

DELETE FROM public.user_roles ur
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY user_id, role_id
        ORDER BY created_at NULLS LAST, id
      ) AS rn
    FROM public.user_roles
  ) t
  WHERE t.rn > 1
) d
WHERE ur.ctid = d.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_pkey' AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_role_unique' AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role_id);
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping user_roles_user_id_fkey: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.app_roles(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Skipping user_roles_role_id_fkey: %', SQLERRM;
  END;
END;
$$;

-- =====================================================
-- Audit logs: do not recreate, do not lose data
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.audit_logs ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
UPDATE public.audit_logs SET created_at = timezone('utc', now()) WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_app_roles_slug ON public.app_roles(slug);
CREATE INDEX IF NOT EXISTS idx_app_permissions_module ON public.app_permissions(module);
CREATE INDEX IF NOT EXISTS idx_app_permissions_action ON public.app_permissions(action);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Audit actor index over whichever actor column exists.
DO $$
DECLARE
  actor_col text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    actor_col := 'actor_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_user_id'
  ) THEN
    actor_col := 'actor_user_id';
  ELSE
    actor_col := NULL;
  END IF;

  IF actor_col IS NOT NULL THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.audit_logs(%I)',
      'idx_audit_logs_' || actor_col,
      actor_col
    );
  END IF;
END;
$$;

-- =====================================================
-- Updated_at trigger helper
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_roles_updated_at ON public.app_roles;
CREATE TRIGGER set_app_roles_updated_at
BEFORE UPDATE ON public.app_roles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_permissions_updated_at ON public.app_permissions;
CREATE TRIGGER set_app_permissions_updated_at
BEFORE UPDATE ON public.app_permissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER set_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Roles + permissions seed
-- =====================================================

INSERT INTO public.app_roles (name, slug, description, is_system, is_system_admin)
SELECT DISTINCT ON (slug)
  name,
  slug,
  description,
  is_system,
  is_system_admin
FROM (
  VALUES
    ('Super Admin', 'super-admin', 'Full enterprise access across all modules and system operations.', true, true),
    ('Admin', 'admin', 'Operational administration across CRM modules.', true, true),
    ('Sales Manager', 'sales-manager', 'Sales leadership and pipeline oversight.', true, false),
    ('Sales Executive', 'sales-executive', 'Sales execution role for day-to-day activities.', true, false),
    ('Project Manager', 'project-manager', 'Owns project planning and delivery execution.', true, false),
    ('Finance', 'finance', 'Controls invoicing, approvals, and financial records.', true, false),
    ('HR', 'hr', 'Manages people operations and HR records.', true, false),
    ('Marketing', 'marketing', 'Handles campaigns, demand generation, and analytics.', true, false),
    ('Viewer', 'viewer', 'Read-only business visibility across permitted modules.', true, false)
) AS role_seed(name, slug, description, is_system, is_system_admin)
ORDER BY slug, is_system_admin DESC, name DESC
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  is_system_admin = EXCLUDED.is_system_admin,
  updated_at = timezone('utc', now());

WITH modules AS (
  SELECT unnest(ARRAY[
    'companies','contacts','leads','quotations','contracts','projects','tasks','invoices','payments',
    'employees','settings','dashboard','marketing','hr','reports','users','roles'
  ]) AS module
),
actions AS (
  SELECT unnest(ARRAY['view','create','update','delete']) AS action
),
base_permissions AS (
  SELECT
    module || '.' || action AS name,
    module,
    action,
    initcap(module) || ' ' || initcap(action) || ' permission' AS description,
    (module IN ('settings','users','roles')) AS is_system
  FROM modules
  CROSS JOIN actions
),
extra_permissions AS (
  SELECT * FROM (VALUES
    ('quotations.send', 'quotations', 'send', 'Send quotations to clients', false),
    ('contracts.sign', 'contracts', 'sign', 'Sign and finalize contracts', false),
    ('projects.manage', 'projects', 'manage', 'Full project lifecycle management', false),
    ('tasks.assign', 'tasks', 'assign', 'Assign tasks to teammates', false),
    ('invoices.approve', 'invoices', 'approve', 'Approve invoices for release', false),
    ('settings.manage', 'settings', 'manage', 'Manage business settings', true),
    ('settings.system.view', 'settings', 'system_view', 'View system-level settings', true),
    ('settings.system.manage', 'settings', 'system_manage', 'Manage system-level settings', true),
    ('dashboard.view', 'dashboard', 'view', 'View executive dashboard', false)
  ) AS x(name, module, action, description, is_system)
),
deduped_permissions AS (
  SELECT DISTINCT ON (name)
    name,
    module,
    action,
    description,
    is_system
  FROM (
    SELECT name, module, action, description, is_system, 1 AS priority FROM base_permissions
    UNION ALL
    SELECT name, module, action, description, is_system, 2 AS priority FROM extra_permissions
  ) s
  ORDER BY name, priority DESC
)
INSERT INTO public.app_permissions (name, module, action, description, is_system)
SELECT name, module, action, description, is_system
FROM deduped_permissions
ON CONFLICT (name)
DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  updated_at = timezone('utc', now());

-- =====================================================
-- Helper auth functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.app_roles r ON r.id = ur.role_id
    WHERE ur.user_id = check_user_id
      AND r.is_system_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_role(check_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.app_roles r ON r.id = ur.role_id
  WHERE ur.user_id = check_user_id
  ORDER BY r.is_system_admin DESC, r.name ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  check_permission text,
  check_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(check_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.app_permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = check_user_id
        AND lower(p.name) = lower(check_permission)
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text, uuid) TO authenticated, service_role;

-- =====================================================
-- Role permission assignment
-- =====================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
CROSS JOIN public.app_permissions p
WHERE r.slug = 'super-admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON true
WHERE r.slug = 'admin'
  AND p.key NOT LIKE 'settings.system.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'companies.view','companies.create','companies.update',
  'contacts.view','contacts.create','contacts.update','contacts.delete',
  'leads.view','leads.create','leads.update','leads.delete',
  'quotations.view','quotations.create','quotations.update','quotations.delete','quotations.send',
  'contracts.view',
  'tasks.view','tasks.assign',
  'reports.view'
])
WHERE r.slug = 'sales-manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'companies.view','companies.create','companies.update',
  'contacts.view','contacts.create','contacts.update',
  'leads.view','leads.create','leads.update',
  'quotations.view','quotations.create','quotations.update','quotations.send',
  'tasks.view'
])
WHERE r.slug = 'sales-executive'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'projects.view','projects.create','projects.update','projects.delete','projects.manage',
  'tasks.view','tasks.create','tasks.update','tasks.delete','tasks.assign',
  'contracts.view','contracts.update',
  'companies.view','contacts.view'
])
WHERE r.slug = 'project-manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'invoices.view','invoices.create','invoices.update','invoices.delete','invoices.approve',
  'payments.view','payments.create','payments.update','payments.delete',
  'contracts.view',
  'companies.view','contacts.view','reports.view'
])
WHERE r.slug = 'finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'employees.view','employees.create','employees.update','employees.delete',
  'hr.view','hr.create','hr.update','hr.delete',
  'reports.view'
])
WHERE r.slug = 'hr'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.name = ANY(ARRAY[
  'dashboard.view',
  'marketing.view','marketing.create','marketing.update','marketing.delete',
  'leads.view','leads.create','leads.update',
  'companies.view','contacts.view',
  'reports.view'
])
WHERE r.slug = 'marketing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.action = 'view'
WHERE r.slug = 'viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- Auth user profile bootstrap + super-admin seed
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_admin_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, user_id, email, full_name, active, is_active, status)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    true,
    true,
    'active'
  )
  ON CONFLICT (id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = timezone('utc', now());

  IF lower(COALESCE(NEW.email, '')) = 'shahrukh@markition.com' THEN
    SELECT id INTO super_admin_role_id FROM public.app_roles WHERE slug = 'super-admin' LIMIT 1;

    IF super_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, super_admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_profile();

INSERT INTO public.profiles (id, user_id, email, full_name, active, is_active, status)
SELECT
  u.id,
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  true,
  true,
  'active'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role_id)
SELECT DISTINCT u.id, r.id
FROM auth.users u
JOIN public.app_roles r ON r.slug = 'super-admin'
WHERE lower(u.email) = 'shahrukh@markition.com'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =====================================================
-- RLS + policies (dynamic audit actor-column support)
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_self_or_admin'
  ) THEN
    CREATE POLICY profiles_select_self_or_admin ON public.profiles
      FOR SELECT
      USING (id = auth.uid() OR user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_self_or_admin'
  ) THEN
    CREATE POLICY profiles_update_self_or_admin ON public.profiles
      FOR UPDATE
      USING (id = auth.uid() OR user_id = auth.uid() OR public.is_admin(auth.uid()))
      WITH CHECK (id = auth.uid() OR user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_self_or_admin'
  ) THEN
    CREATE POLICY profiles_insert_self_or_admin ON public.profiles
      FOR INSERT
      WITH CHECK (id = auth.uid() OR user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_roles' AND policyname = 'app_roles_select_authenticated'
  ) THEN
    CREATE POLICY app_roles_select_authenticated ON public.app_roles
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_roles' AND policyname = 'app_roles_manage_admin'
  ) THEN
    CREATE POLICY app_roles_manage_admin ON public.app_roles
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_permissions' AND policyname = 'app_permissions_select_authenticated'
  ) THEN
    CREATE POLICY app_permissions_select_authenticated ON public.app_permissions
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_permissions' AND policyname = 'app_permissions_manage_admin'
  ) THEN
    CREATE POLICY app_permissions_manage_admin ON public.app_permissions
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'role_permissions_select_authenticated'
  ) THEN
    CREATE POLICY role_permissions_select_authenticated ON public.role_permissions
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'role_permissions_manage_admin'
  ) THEN
    CREATE POLICY role_permissions_manage_admin ON public.role_permissions
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_select_self_or_admin'
  ) THEN
    CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
      FOR SELECT
      USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_manage_admin'
  ) THEN
    CREATE POLICY user_roles_manage_admin ON public.user_roles
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- Dynamic audit_logs policies: use actor_id if present; otherwise actor_user_id.
DO $$
DECLARE
  actor_col text;
  select_policy_exists boolean;
  insert_policy_exists boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    actor_col := 'actor_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_user_id'
  ) THEN
    actor_col := 'actor_user_id';
  ELSE
    actor_col := NULL;
  END IF;

  IF actor_col IS NULL THEN
    RAISE NOTICE 'audit_logs has neither actor_id nor actor_user_id; skipping actor-based audit policies.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'audit_logs_select_self_or_admin'
  ) INTO select_policy_exists;

  IF NOT select_policy_exists THEN
    EXECUTE format(
      'CREATE POLICY audit_logs_select_self_or_admin ON public.audit_logs FOR SELECT USING (%I = auth.uid() OR public.is_admin(auth.uid()))',
      actor_col
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'audit_logs_insert_authenticated'
  ) INTO insert_policy_exists;

  IF NOT insert_policy_exists THEN
    EXECUTE format(
      'CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = ''authenticated'' AND %I = auth.uid())',
      actor_col
    );
  END IF;
END;
$$;

-- =====================================================
-- Optional CRM table RLS (idempotent when tables exist)
-- =====================================================

DO $$
DECLARE
  table_name text;
  crud_action text;
  policy_name text;
  using_expr text;
  check_expr text;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY['companies','contacts','leads','quotations','contracts','projects','tasks','invoices'])
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

      FOR crud_action IN SELECT unnest(ARRAY['view','create','update','delete'])
      LOOP
        policy_name := table_name || '_' || crud_action || '_rbac';

        IF crud_action = 'view' THEN
          using_expr := format('public.user_has_permission(''%s.view'', auth.uid())', table_name);
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
              policy_name,
              table_name,
              using_expr
            );
          END IF;
        ELSIF crud_action = 'create' THEN
          check_expr := format('public.user_has_permission(''%s.create'', auth.uid())', table_name);
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
              policy_name,
              table_name,
              check_expr
            );
          END IF;
        ELSIF crud_action = 'update' THEN
          using_expr := format('public.user_has_permission(''%s.update'', auth.uid())', table_name);
          check_expr := using_expr;
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
              policy_name,
              table_name,
              using_expr,
              check_expr
            );
          END IF;
        ELSIF crud_action = 'delete' THEN
          using_expr := format('public.user_has_permission(''%s.delete'', auth.uid())', table_name);
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON public.%I FOR DELETE USING (%s)',
              policy_name,
              table_name,
              using_expr
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- Grants (RLS still enforces scope)
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.app_roles TO authenticated;
GRANT SELECT ON public.app_permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;

COMMIT;


-- ============================================================
-- FILE: 20260703_authz_snapshot_rls_select.sql
-- ============================================================

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


-- ============================================================
-- FILE: companies.sql
-- ============================================================

-- Supabase schema for the companies module
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  industry text,
  phone text,
  email text,
  address text,
  country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS 'Client companies managed by the CRM';
COMMENT ON COLUMN public.companies.name IS 'Company name';
COMMENT ON COLUMN public.companies.website IS 'Company website URL';
COMMENT ON COLUMN public.companies.industry IS 'Industry or sector';
COMMENT ON COLUMN public.companies.phone IS 'Contact phone number';
COMMENT ON COLUMN public.companies.email IS 'Contact email address';
COMMENT ON COLUMN public.companies.address IS 'Primary address';
COMMENT ON COLUMN public.companies.country IS 'Country';
COMMENT ON COLUMN public.companies.notes IS 'Internal notes and additional details';

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select, insert, update, and delete
CREATE POLICY "authenticated_crud" ON public.companies
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow service_role (via admin API) to bypass RLS
CREATE POLICY "service_role_bypass" ON public.companies
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- FILE: quotations.sql
-- ============================================================

-- Supabase schema for the quotations module
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  client_company_id uuid,
  contact_id uuid,
  sales_representative text,
  currency text NOT NULL DEFAULT 'USD',
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  reference_number text,
  status text NOT NULL DEFAULT 'Draft',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  internal_notes text,
  terms_and_conditions text,
  attachments text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quotations IS 'Quotation documents used to manage pricing proposals and approvals';
COMMENT ON COLUMN public.quotations.quotation_number IS 'Human-readable quotation reference';
COMMENT ON COLUMN public.quotations.client_company_id IS 'Client company related to the quotation';
COMMENT ON COLUMN public.quotations.contact_id IS 'Primary contact for the quotation';
COMMENT ON COLUMN public.quotations.sales_representative IS 'Internal sales representative owner';
COMMENT ON COLUMN public.quotations.currency IS 'Currency code used for pricing';
COMMENT ON COLUMN public.quotations.status IS 'Quotation lifecycle status';
COMMENT ON COLUMN public.quotations.line_items IS 'Itemized services and products';
COMMENT ON COLUMN public.quotations.attachments IS 'Attachment references or notes';

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud" ON public.quotations
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass" ON public.quotations
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- FILE: contracts.sql
-- ============================================================

-- Supabase schema for the contracts module
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  contract_name text NOT NULL,
  company_id uuid,
  contact_id uuid,
  related_quotation_id uuid,
  sales_representative text,
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL DEFAULT 'Monthly',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  renewal_option text,
  auto_renewal boolean NOT NULL DEFAULT false,
  renewal_reminder_date date,
  notice_period_days integer NOT NULL DEFAULT 30,
  terms text,
  payment_terms text,
  scope_of_work text,
  responsibilities text,
  cancellation_terms text,
  warranty text,
  confidentiality text,
  notes text,
  internal_notes text,
  attachments text,
  status text NOT NULL DEFAULT 'Draft',
  archived boolean NOT NULL DEFAULT false,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  renewal_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  version_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_copy_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contracts IS 'Signed agreements managed after quotation acceptance';
COMMENT ON COLUMN public.contracts.contract_number IS 'Human readable contract reference';
COMMENT ON COLUMN public.contracts.contract_name IS 'Agreement title';
COMMENT ON COLUMN public.contracts.company_id IS 'Client company tied to the contract';
COMMENT ON COLUMN public.contracts.contact_id IS 'Primary contract contact';
COMMENT ON COLUMN public.contracts.related_quotation_id IS 'Quotation that led to the contract';
COMMENT ON COLUMN public.contracts.billing_cycle IS 'Billing cadence for the contract';
COMMENT ON COLUMN public.contracts.auto_renewal IS 'Whether the contract auto renews';
COMMENT ON COLUMN public.contracts.renewal_reminder_date IS 'Reminder date for renewal workflow';
COMMENT ON COLUMN public.contracts.notice_period_days IS 'Notice period before renewal or termination';
COMMENT ON COLUMN public.contracts.timeline IS 'Lifecycle timeline entries';
COMMENT ON COLUMN public.contracts.activity_log IS 'Operational activity entries';
COMMENT ON COLUMN public.contracts.renewal_history IS 'Historical renewal records';
COMMENT ON COLUMN public.contracts.version_history IS 'Version change history';
COMMENT ON COLUMN public.contracts.comments IS 'Contract discussion notes';

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud" ON public.contracts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass" ON public.contracts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- FILE: 20260706_projects_invoices.sql
-- ============================================================

-- Supabase schema for projects and invoices modules

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_code text,
  company_id uuid,
  owner_name text,
  status text NOT NULL DEFAULT 'Planned',
  priority text NOT NULL DEFAULT 'Medium',
  start_date date,
  due_date date,
  end_date date,
  budget numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_company_id_idx ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON public.projects(created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'authenticated_crud_projects'
  ) THEN
    CREATE POLICY authenticated_crud_projects ON public.projects
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'service_role_bypass_projects'
  ) THEN
    CREATE POLICY service_role_bypass_projects ON public.projects
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_name text NOT NULL,
  company_id uuid,
  project_id uuid,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  line_items text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_company_id_idx ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS invoices_project_id_idx ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON public.invoices(created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'authenticated_crud_invoices'
  ) THEN
    CREATE POLICY authenticated_crud_invoices ON public.invoices
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'service_role_bypass_invoices'
  ) THEN
    CREATE POLICY service_role_bypass_invoices ON public.invoices
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;


-- ============================================================
-- FILE: workflows.sql
-- ============================================================

create table if not exists public.workflow_history (
  id uuid primary key,
  module text not null,
  entity_id text not null,
  field text not null,
  previous_status text not null,
  next_status text not null,
  actor_id text,
  actor_name text,
  actor_email text,
  reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_events (
  id uuid primary key,
  module text not null,
  entity_id text not null,
  label text not null,
  detail text,
  tone text not null default 'default',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_history enable row level security;
alter table public.workflow_events enable row level security;

drop policy if exists "workflow history select" on public.workflow_history;
drop policy if exists "workflow history insert" on public.workflow_history;
drop policy if exists "workflow events select" on public.workflow_events;
drop policy if exists "workflow events insert" on public.workflow_events;

create policy "workflow history select"
  on public.workflow_history
  for select
  to authenticated
  using (true);

create policy "workflow history insert"
  on public.workflow_history
  for insert
  to authenticated
  with check (true);

create policy "workflow events select"
  on public.workflow_events
  for select
  to authenticated
  using (true);

create policy "workflow events insert"
  on public.workflow_events
  for insert
  to authenticated
  with check (true);

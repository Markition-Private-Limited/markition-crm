-- =============================================================
-- MARKITION CRM — CRM Core Migration
-- 2026-10-05
-- Creates: service_categories, company_service_categories,
--          contacts (enhanced), prospects, leads, task_assignees,
--          task_changelog
-- Fixes:   GRANT service_role on existing tables
--          Adds company_id to tasks
-- =============================================================

BEGIN;

-- ── Ensure set_updated_at trigger function exists ───────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ── GRANT service_role on existing tables that are missing it ────────────────

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['companies','contacts','leads','tasks',
    'app_permissions','role_permissions','audit_logs',
    'quotations','contracts','projects','invoices',
    'workflow_history','workflow_events','project_members']
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END;
$$;

-- ── Ensure contacts has all required columns ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name       text,
  email      text,
  phone      text,
  title      text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS contacts_is_primary_idx ON public.contacts(company_id, is_primary) WHERE is_primary = true;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contacts' AND policyname='contacts_service_role') THEN
    CREATE POLICY contacts_service_role ON public.contacts FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO service_role, authenticated;

-- ── Ensure leads has all required columns ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  source_prospect_id uuid,
  title             text NOT NULL DEFAULT 'Untitled Lead',
  notes             text,
  status            text NOT NULL DEFAULT 'first_contact',
  assigned_to       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_prospect_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Untitled Lead';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'first_contact';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('first_contact','follow_up','discovery_call','closing','closed_won','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN RAISE NOTICE 'leads_status_check: %', SQLERRM; END $$;

CREATE INDEX IF NOT EXISTS leads_company_id_idx  ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx  ON public.leads(assigned_to);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='leads_service_role') THEN
    CREATE POLICY leads_service_role ON public.leads FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO service_role, authenticated;

-- ── service_categories ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_name_unique UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_categories' AND policyname='service_categories_service_role') THEN
    CREATE POLICY service_categories_service_role ON public.service_categories FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_categories' AND policyname='service_categories_authenticated_select') THEN
    CREATE POLICY service_categories_authenticated_select ON public.service_categories FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO service_role;
GRANT SELECT ON public.service_categories TO authenticated;

-- ── company_service_categories ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_service_categories (
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, service_category_id)
);

ALTER TABLE public.company_service_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_service_categories' AND policyname='csc_service_role') THEN
    CREATE POLICY csc_service_role ON public.company_service_categories FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_service_categories TO service_role, authenticated;

-- ── prospects ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notes      text,
  status     text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
    CHECK (status IN ('new','contacted','converted','dropped'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN RAISE NOTICE 'prospects_status_check: %', SQLERRM; END $$;

CREATE INDEX IF NOT EXISTS prospects_company_id_idx ON public.prospects(company_id);
CREATE INDEX IF NOT EXISTS prospects_status_idx     ON public.prospects(status);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prospects' AND policyname='prospects_service_role') THEN
    CREATE POLICY prospects_service_role ON public.prospects FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prospects' AND policyname='prospects_authenticated') THEN
    CREATE POLICY prospects_authenticated ON public.prospects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO service_role, authenticated;

-- ── Add source_prospect_id FK to leads (after prospects exists) ──────────────

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_source_prospect_id_fkey
    FOREIGN KEY (source_prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN RAISE NOTICE 'leads_source_prospect_id_fkey: %', SQLERRM; END $$;

-- ── tasks: add company_id ────────────────────────────────────────────────────

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON public.tasks(company_id);

-- ── task_assignees ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_assignees' AND policyname='ta_service_role') THEN
    CREATE POLICY ta_service_role ON public.task_assignees FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_assignees' AND policyname='ta_authenticated') THEN
    CREATE POLICY ta_authenticated ON public.task_assignees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO service_role, authenticated;

-- ── task_changelog ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_changelog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name  text NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_changelog_task_id_idx ON public.task_changelog(task_id);
CREATE INDEX IF NOT EXISTS task_changelog_actor_id_idx ON public.task_changelog(actor_id);

ALTER TABLE public.task_changelog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_changelog' AND policyname='tc_service_role') THEN
    CREATE POLICY tc_service_role ON public.task_changelog FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_changelog' AND policyname='tc_authenticated') THEN
    CREATE POLICY tc_authenticated ON public.task_changelog FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_changelog TO service_role, authenticated;

-- ── updated_at triggers for new tables ──────────────────────────────────────

DROP TRIGGER IF EXISTS set_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER set_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_prospects_updated_at ON public.prospects;
CREATE TRIGGER set_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed CRM roles (add sales role if missing) ───────────────────────────────

INSERT INTO public.app_roles (name, description)
VALUES ('Sales', 'Manages leads, prospects, and sales pipeline.')
ON CONFLICT (name) DO NOTHING;

-- ── Ensure admin1@markition.com has Admin role ───────────────────────────────

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u, public.app_roles r
WHERE lower(u.email) = 'admin1@markition.com'
  AND lower(r.name) = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;

-- =============================================================
-- MARKITION CRM — Pipeline v2 Migration
-- 2026-10-13
-- Changes:
--   1. ALTER prospects: add name/source/owner_id, replace old
--      status values with full pipeline stages
--   2. CREATE clients table (Active Clients)
--   3. TRIGGER: auto-create client row on prospects.status = 'closed_won'
--   4. ALTER tasks: add client_id FK
--   5. DROP leads table (merged into prospects)
-- =============================================================

BEGIN;

-- ── 1. ALTER prospects ────────────────────────────────────────────────────────

-- Drop old status check (was: new/contacted/converted/dropped)
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;

-- Migrate existing rows to new status values before adding the new constraint
UPDATE public.prospects SET status = 'first_contact' WHERE status = 'new';
UPDATE public.prospects SET status = 'follow_up'     WHERE status = 'contacted';
UPDATE public.prospects SET status = 'closed_won'    WHERE status = 'converted';
UPDATE public.prospects SET status = 'failed'        WHERE status = 'dropped';

-- Add new columns
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS name   text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Change default to match first pipeline stage
ALTER TABLE public.prospects ALTER COLUMN status SET DEFAULT 'first_contact';

-- New pipeline status check
DO $$ BEGIN
  ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
    CHECK (status IN ('first_contact','follow_up','discovery_call','closing','closed_won','failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS prospects_owner_id_idx ON public.prospects(owner_id);

-- ── 2. CREATE clients table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_prospect_id uuid UNIQUE REFERENCES public.prospects(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_status_check CHECK (status IN ('active','inactive'))
);

CREATE INDEX IF NOT EXISTS clients_company_id_idx          ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS clients_source_prospect_id_idx  ON public.clients(source_prospect_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients' AND policyname='clients_service_role'
  ) THEN
    CREATE POLICY clients_service_role ON public.clients
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO service_role, authenticated;

-- ── 3. TRIGGER: auto-create client on closed_won ─────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_create_client_on_closed_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'closed_won' AND (OLD.status IS DISTINCT FROM 'closed_won') THEN
    INSERT INTO public.clients (company_id, source_prospect_id, status)
    VALUES (NEW.company_id, NEW.id, 'active')
    ON CONFLICT (source_prospect_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_client ON public.prospects;
CREATE TRIGGER trg_auto_create_client
  AFTER UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_on_closed_won();

-- ── 4. ALTER tasks: add client_id ────────────────────────────────────────────

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks(client_id);

-- ── 5. DROP leads table ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.leads CASCADE;

COMMIT;

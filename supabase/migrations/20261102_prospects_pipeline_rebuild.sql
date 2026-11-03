-- =============================================================
-- MARKITION CRM — Prospects / Pipeline Core Rebuild
-- 2026-11-02
-- Creates: pipeline_stages (14 seeds), prospect_stage_history,
--          prospect_contacts, prospect_ownership_history
-- Alters:  prospects — add all BRD fields, make company_id nullable,
--          add company_name, auto-generate prospect_code
-- Updates: clients trigger to fire on is_won stage
-- =============================================================

BEGIN;

-- ── Ensure set_updated_at trigger function exists ──────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ── 1. pipeline_stages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  display_order       int         NOT NULL,
  default_probability int         NOT NULL DEFAULT 0
                                  CHECK (default_probability BETWEEN 0 AND 100),
  is_won              boolean     NOT NULL DEFAULT false,
  is_lost             boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_order_unique UNIQUE (display_order);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pipeline_stages' AND policyname='ps_service_role'
  ) THEN
    CREATE POLICY ps_service_role ON public.pipeline_stages
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pipeline_stages' AND policyname='ps_authenticated_select'
  ) THEN
    CREATE POLICY ps_authenticated_select ON public.pipeline_stages
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO service_role;
GRANT SELECT ON public.pipeline_stages TO authenticated;

DROP TRIGGER IF EXISTS set_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER set_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Seed 14 default stages ─────────────────────────────────────────────

INSERT INTO public.pipeline_stages
  (name, display_order, default_probability, is_won, is_lost, is_active)
VALUES
  ('New Lead',                 1,   5, false, false, true),
  ('Contacted',                2,  10, false, false, true),
  ('Initial Discussion',       3,  20, false, false, true),
  ('Meeting Scheduled',        4,  30, false, false, true),
  ('Meeting Completed',        5,  40, false, false, true),
  ('Qualified Prospect',       6,  50, false, false, true),
  ('Proposal Preparation',     7,  60, false, false, true),
  ('Proposal Sent',            8,  65, false, false, true),
  ('Pricing Negotiation',      9,  70, false, false, true),
  ('Follow-up/Negotiation',   10,  75, false, false, true),
  ('Onboarding/Documentation',11,  85, false, false, true),
  ('Won',                     12, 100, true,  false, true),
  ('Lost',                    13,   0, false, true,  true),
  ('On Hold',                 14,  50, false, false, true)
ON CONFLICT (display_order) DO NOTHING;

-- ── 3. prospect_code auto-generation ─────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.prospect_code_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_prospect_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prospect_code IS NULL THEN
    NEW.prospect_code :=
      'PRS-' || lpad(nextval('public.prospect_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_prospect_code ON public.prospects;
CREATE TRIGGER trg_assign_prospect_code
  BEFORE INSERT ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.assign_prospect_code();

-- ── 4. ALTER prospects: add BRD fields ───────────────────────────────────

-- Make company_id nullable so prospects can exist without a linked company record
ALTER TABLE public.prospects ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS prospect_code       text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS company_name        text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS industry            text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS country             text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS city                text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS website             text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS lead_source         text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS priority            text NOT NULL DEFAULT 'medium';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS service_required    text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS estimated_value     numeric(15,2);
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'USD';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS stage_id            uuid
  REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS probability         int
  CHECK (probability IS NULL OR probability BETWEEN 0 AND 100);
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS expected_close_date date;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS loss_reason         text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS close_date          date;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS final_amount        numeric(15,2);
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS is_archived         boolean NOT NULL DEFAULT false;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS created_by          uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS updated_by          uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.prospects
    ADD CONSTRAINT prospects_code_unique UNIQUE (prospect_code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.prospects
    ADD CONSTRAINT prospects_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS prospects_stage_id_idx      ON public.prospects(stage_id);
CREATE INDEX IF NOT EXISTS prospects_is_archived_idx   ON public.prospects(is_archived);
CREATE INDEX IF NOT EXISTS prospects_prospect_code_idx ON public.prospects(prospect_code);
CREATE INDEX IF NOT EXISTS prospects_created_by_idx    ON public.prospects(created_by);

-- ── 5. Back-fill company_name from linked companies ───────────────────────

UPDATE public.prospects p
SET    company_name = c.name
FROM   public.companies c
WHERE  p.company_id = c.id
  AND  p.company_name IS NULL;

-- ── 6. Migrate existing stage values → stage_id ──────────────────────────

UPDATE public.prospects p
SET    stage_id = s.id
FROM   public.pipeline_stages s
WHERE  p.stage_id IS NULL
  AND (
        (p.status = 'first_contact'  AND s.name = 'New Lead') OR
        (p.status = 'follow_up'      AND s.name = 'Contacted') OR
        (p.status = 'discovery_call' AND s.name = 'Initial Discussion') OR
        (p.status = 'closing'        AND s.name = 'Pricing Negotiation') OR
        (p.status = 'closed_won'     AND s.name = 'Won') OR
        (p.status = 'failed'         AND s.name = 'Lost')
      );

-- Any still-unmapped rows → New Lead
UPDATE public.prospects p
SET    stage_id = (
  SELECT id FROM public.pipeline_stages
  WHERE  name = 'New Lead' LIMIT 1
)
WHERE  p.stage_id IS NULL;

-- ── 7. prospect_stage_history ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospect_stage_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   uuid        NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  from_stage_id uuid
    REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id   uuid        NOT NULL
    REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  changed_by    uuid        NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS psh_prospect_id_idx ON public.prospect_stage_history(prospect_id);
CREATE INDEX IF NOT EXISTS psh_changed_at_idx  ON public.prospect_stage_history(changed_at);

ALTER TABLE public.prospect_stage_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_stage_history' AND policyname='psh_service_role'
  ) THEN
    CREATE POLICY psh_service_role ON public.prospect_stage_history
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_stage_history' AND policyname='psh_auth_select'
  ) THEN
    CREATE POLICY psh_auth_select ON public.prospect_stage_history
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  -- INSERT only for authenticated; no UPDATE/DELETE (immutable log)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_stage_history' AND policyname='psh_auth_insert'
  ) THEN
    CREATE POLICY psh_auth_insert ON public.prospect_stage_history
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT ON public.prospect_stage_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_stage_history TO service_role;

-- ── 8. prospect_contacts ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid        NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  job_title   text,
  email       text,
  phone       text,
  whatsapp    text,
  is_primary  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pc_prospect_id_idx ON public.prospect_contacts(prospect_id);

ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_contacts' AND policyname='pc_service_role'
  ) THEN
    CREATE POLICY pc_service_role ON public.prospect_contacts
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_contacts' AND policyname='pc_authenticated'
  ) THEN
    CREATE POLICY pc_authenticated ON public.prospect_contacts
      FOR ALL USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_contacts TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_prospect_contacts_updated_at ON public.prospect_contacts;
CREATE TRIGGER set_prospect_contacts_updated_at
  BEFORE UPDATE ON public.prospect_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 9. prospect_ownership_history ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospect_ownership_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid        NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  owner_id    uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poh_prospect_id_idx ON public.prospect_ownership_history(prospect_id);

ALTER TABLE public.prospect_ownership_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_ownership_history' AND policyname='poh_service_role'
  ) THEN
    CREATE POLICY poh_service_role ON public.prospect_ownership_history
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_ownership_history' AND policyname='poh_auth_select'
  ) THEN
    CREATE POLICY poh_auth_select ON public.prospect_ownership_history
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospect_ownership_history' AND policyname='poh_auth_insert'
  ) THEN
    CREATE POLICY poh_auth_insert ON public.prospect_ownership_history
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT ON public.prospect_ownership_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_ownership_history TO service_role;

-- ── 10. Update clients auto-create trigger ────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_create_client_on_won()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_won boolean;
BEGIN
  -- Fire when stage changes to a "won" stage
  IF NEW.stage_id IS NOT NULL
     AND (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
     AND NEW.company_id IS NOT NULL
  THEN
    SELECT ps.is_won INTO v_is_won
    FROM   public.pipeline_stages ps
    WHERE  ps.id = NEW.stage_id;

    IF v_is_won = true THEN
      INSERT INTO public.clients (company_id, source_prospect_id, status)
      VALUES (NEW.company_id, NEW.id, 'active')
      ON CONFLICT (source_prospect_id) DO NOTHING;
    END IF;
  END IF;

  -- Legacy: keep old closed_won status path working
  IF NEW.status = 'closed_won'
     AND (OLD.status IS DISTINCT FROM 'closed_won')
     AND NEW.company_id IS NOT NULL
  THEN
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
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_on_won();

COMMIT;

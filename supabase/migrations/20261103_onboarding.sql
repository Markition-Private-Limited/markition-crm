-- =============================================================
-- MARKITION CRM — Onboarding Module (Priority 5)
-- 2026-11-03
--
-- Adds:
--   prospects.customer_type, prospects.jurisdiction
--   document_requirement_templates  (admin-configurable checklist templates)
--   onboarding_cases                (one per won proposal)
--   onboarding_checklist_items      (generated from templates at start)
-- =============================================================

BEGIN;

-- ── 0. Extend prospects with customer_type / jurisdiction ─────────────────────

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS customer_type text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS jurisdiction  text;

-- ── 1. document_requirement_templates ────────────────────────────────────────
-- Admin-defined document names with optional customer_type/jurisdiction filters.
-- NULL filter value = "applies to all".

CREATE TABLE IF NOT EXISTS public.document_requirement_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  customer_type text,                        -- NULL = any customer type
  jurisdiction  text,                        -- NULL = any jurisdiction
  is_mandatory  boolean     NOT NULL DEFAULT true,
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drt_active_idx ON public.document_requirement_templates(is_active);

ALTER TABLE public.document_requirement_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='document_requirement_templates' AND policyname='drt_service_role'
  ) THEN
    CREATE POLICY drt_service_role ON public.document_requirement_templates FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='document_requirement_templates' AND policyname='drt_authenticated'
  ) THEN
    -- Read: all non-viewer roles; write: admin+ only
    CREATE POLICY drt_authenticated ON public.document_requirement_templates FOR ALL
      USING (
        CASE public.my_app_role()
          WHEN 'SuperAdministrator' THEN true
          WHEN 'Administrator'      THEN true
          WHEN 'BD Manager'         THEN true   -- read, checked per-op in API
          WHEN 'BD Executive'       THEN true   -- read, checked per-op in API
          ELSE false
        END
      )
      WITH CHECK (
        CASE public.my_app_role()
          WHEN 'SuperAdministrator' THEN true
          WHEN 'Administrator'      THEN true
          ELSE false
        END
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requirement_templates TO service_role;
GRANT SELECT ON public.document_requirement_templates TO authenticated;

DROP TRIGGER IF EXISTS set_drt_updated_at ON public.document_requirement_templates;
CREATE TRIGGER set_drt_updated_at
  BEFORE UPDATE ON public.document_requirement_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. onboarding_cases ───────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.onboarding_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.onboarding_cases (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_number         text        NOT NULL UNIQUE,
  prospect_id               uuid        NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
  proposal_id               uuid        NOT NULL REFERENCES public.proposals(id) ON DELETE RESTRICT,
  -- Ownership mirrors the proposal for RLS scoping
  owner_id                  uuid        NOT NULL REFERENCES public.users(id),
  -- Snapshots of the prospect at the time onboarding started
  customer_type_snapshot    text,
  jurisdiction_snapshot     text,
  -- Case status
  status                    text        NOT NULL DEFAULT 'in_progress'
                                        CHECK (status IN ('in_progress','approved','rejected')),
  -- True when no templates matched the customer_type/jurisdiction at start time
  no_matching_templates     boolean     NOT NULL DEFAULT false,
  started_by                uuid        NOT NULL REFERENCES public.users(id),
  started_at                timestamptz NOT NULL DEFAULT now(),
  -- Final review
  final_reviewed_by         uuid        REFERENCES public.users(id),
  final_reviewed_at         timestamptz,
  final_review_note         text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id)   -- one onboarding case per proposal
);

CREATE INDEX IF NOT EXISTS obc_prospect_id_idx ON public.onboarding_cases(prospect_id);
CREATE INDEX IF NOT EXISTS obc_owner_id_idx    ON public.onboarding_cases(owner_id);
CREATE INDEX IF NOT EXISTS obc_status_idx      ON public.onboarding_cases(status);

CREATE OR REPLACE FUNCTION public.set_onboarding_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.onboarding_number IS NULL OR NEW.onboarding_number = '' THEN
    NEW.onboarding_number := 'OBC-' || LPAD(nextval('public.onboarding_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_number ON public.onboarding_cases;
CREATE TRIGGER trg_onboarding_number
  BEFORE INSERT ON public.onboarding_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_number();

ALTER TABLE public.onboarding_cases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='onboarding_cases' AND policyname='obc_service_role'
  ) THEN
    CREATE POLICY obc_service_role ON public.onboarding_cases FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='onboarding_cases' AND policyname='obc_authenticated'
  ) THEN
    CREATE POLICY obc_authenticated ON public.onboarding_cases FOR ALL
      USING (
        CASE public.my_app_role()
          WHEN 'SuperAdministrator' THEN true
          WHEN 'Administrator'      THEN true
          WHEN 'BD Manager'         THEN public.prospect_visible_to_me(owner_id)
          WHEN 'BD Executive'       THEN owner_id = auth.uid()
          ELSE false
        END
      )
      WITH CHECK (
        CASE public.my_app_role()
          WHEN 'SuperAdministrator' THEN true
          WHEN 'Administrator'      THEN true
          WHEN 'BD Manager'         THEN public.prospect_visible_to_me(owner_id)
          WHEN 'BD Executive'       THEN owner_id = auth.uid()
          ELSE false
        END
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_cases TO service_role, authenticated;
GRANT USAGE ON SEQUENCE public.onboarding_number_seq TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_obc_updated_at ON public.onboarding_cases;
CREATE TRIGGER set_obc_updated_at
  BEFORE UPDATE ON public.onboarding_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. onboarding_checklist_items ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid        NOT NULL REFERENCES public.onboarding_cases(id) ON DELETE CASCADE,
  -- Nullable — template may be deleted after onboarding started
  template_id     uuid        REFERENCES public.document_requirement_templates(id) ON DELETE SET NULL,
  -- Snapshots from template (immutable after creation)
  document_name   text        NOT NULL,
  is_mandatory    boolean     NOT NULL DEFAULT true,
  -- Tracking
  status          text        NOT NULL DEFAULT 'not_uploaded'
                              CHECK (status IN ('not_uploaded','uploaded','under_review','approved','rejected')),
  file_url        text,
  file_name       text,
  uploaded_by     uuid        REFERENCES public.users(id),
  uploaded_at     timestamptz,
  reviewed_by     uuid        REFERENCES public.users(id),
  reviewed_at     timestamptz,
  review_remark   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oci_case_id_idx ON public.onboarding_checklist_items(case_id);

ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='onboarding_checklist_items' AND policyname='oci_service_role'
  ) THEN
    CREATE POLICY oci_service_role ON public.onboarding_checklist_items FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='onboarding_checklist_items' AND policyname='oci_authenticated'
  ) THEN
    CREATE POLICY oci_authenticated ON public.onboarding_checklist_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.onboarding_cases c
          WHERE c.id = case_id
            AND (
              CASE public.my_app_role()
                WHEN 'SuperAdministrator' THEN true
                WHEN 'Administrator'      THEN true
                WHEN 'BD Manager'         THEN public.prospect_visible_to_me(c.owner_id)
                WHEN 'BD Executive'       THEN c.owner_id = auth.uid()
                ELSE false
              END
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.onboarding_cases c
          WHERE c.id = case_id
            AND (
              CASE public.my_app_role()
                WHEN 'SuperAdministrator' THEN true
                WHEN 'Administrator'      THEN true
                WHEN 'BD Manager'         THEN public.prospect_visible_to_me(c.owner_id)
                WHEN 'BD Executive'       THEN c.owner_id = auth.uid()
                ELSE false
              END
            )
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_checklist_items TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_oci_updated_at ON public.onboarding_checklist_items;
CREATE TRIGGER set_oci_updated_at
  BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- =============================================================
-- MARKITION CRM — Proposals & Revisions (Priority 4)
-- 2026-11-03
-- =============================================================

BEGIN;

-- ── 1. proposals ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proposals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number     text        NOT NULL UNIQUE,
  prospect_id         uuid        NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
  owner_id            uuid        NOT NULL REFERENCES public.users(id),
  title               text        NOT NULL,
  -- Current terms (always mirror the latest revision)
  amount              numeric(15,2) NOT NULL DEFAULT 0,
  currency            text        NOT NULL DEFAULT 'USD',
  validity_days       integer     NOT NULL DEFAULT 30,
  valid_until         date,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  expected_close_date date,
  -- Status workflow
  status              text        NOT NULL DEFAULT 'internal_review'
                                  CHECK (status IN (
                                    'internal_review',
                                    'proposal_sent',
                                    'client_reviewing',
                                    'negotiation',
                                    'won',
                                    'lost'
                                  )),
  approval_status     text        NOT NULL DEFAULT 'pending'
                                  CHECK (approval_status IN ('pending','approved','rejected')),
  remarks             text,
  -- Flags for downstream modules (set by trigger on status change)
  is_accepted         boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prop_prospect_id_idx  ON public.proposals(prospect_id);
CREATE INDEX IF NOT EXISTS prop_owner_id_idx     ON public.proposals(owner_id);
CREATE INDEX IF NOT EXISTS prop_status_idx       ON public.proposals(status);
CREATE INDEX IF NOT EXISTS prop_valid_until_idx  ON public.proposals(valid_until)
  WHERE status NOT IN ('won','lost');

-- Auto-increment proposal_number: PRO-000001
CREATE SEQUENCE IF NOT EXISTS public.proposal_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_proposal_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.proposal_number IS NULL OR NEW.proposal_number = '' THEN
    NEW.proposal_number := 'PRO-' || LPAD(nextval('public.proposal_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_number ON public.proposals;
CREATE TRIGGER trg_proposal_number
  BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_proposal_number();

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (API layer uses adminClient)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposals' AND policyname='prop_service_role'
  ) THEN
    CREATE POLICY prop_service_role ON public.proposals FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Authenticated users: visibility scoped by my_app_role() helper from rbac_v2
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposals' AND policyname='prop_authenticated'
  ) THEN
    CREATE POLICY prop_authenticated ON public.proposals FOR ALL
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO service_role, authenticated;
GRANT USAGE ON SEQUENCE public.proposal_number_seq TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_proposals_updated_at ON public.proposals;
CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: sync valid_until and is_accepted on every write
CREATE OR REPLACE FUNCTION public.sync_proposal_computed()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.valid_until  := (NEW.submitted_at AT TIME ZONE 'UTC')::date + NEW.validity_days;
  NEW.is_accepted  := (NEW.status = 'won');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_computed ON public.proposals;
CREATE TRIGGER trg_proposal_computed
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.sync_proposal_computed();

-- ── 2. proposal_revisions ─────────────────────────────────────────────────────
-- Immutable record of each snapshot — never updated after insert.

CREATE TABLE IF NOT EXISTS public.proposal_revisions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid        NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  revision_number integer     NOT NULL,
  amount          numeric(15,2) NOT NULL,
  currency        text        NOT NULL,
  validity_days   integer     NOT NULL,
  notes           text,
  created_by      uuid        NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, revision_number)
);

CREATE INDEX IF NOT EXISTS pr_proposal_id_idx ON public.proposal_revisions(proposal_id);

ALTER TABLE public.proposal_revisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposal_revisions' AND policyname='pr_service_role'
  ) THEN
    CREATE POLICY pr_service_role ON public.proposal_revisions FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposal_revisions' AND policyname='pr_authenticated'
  ) THEN
    CREATE POLICY pr_authenticated ON public.proposal_revisions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.proposals p
          WHERE p.id = proposal_id
            AND (
              CASE public.my_app_role()
                WHEN 'SuperAdministrator' THEN true
                WHEN 'Administrator'      THEN true
                WHEN 'BD Manager'         THEN public.prospect_visible_to_me(p.owner_id)
                WHEN 'BD Executive'       THEN p.owner_id = auth.uid()
                ELSE false
              END
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.proposals p
          WHERE p.id = proposal_id
            AND (
              CASE public.my_app_role()
                WHEN 'SuperAdministrator' THEN true
                WHEN 'Administrator'      THEN true
                WHEN 'BD Manager'         THEN public.prospect_visible_to_me(p.owner_id)
                WHEN 'BD Executive'       THEN p.owner_id = auth.uid()
                ELSE false
              END
            )
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT ON public.proposal_revisions TO service_role, authenticated;

-- ── 3. proposal_status_history ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proposal_status_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid        NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  from_status   text,
  to_status     text        NOT NULL,
  changed_by    uuid        NOT NULL REFERENCES public.users(id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  note          text
);

CREATE INDEX IF NOT EXISTS psh_proposal_id_idx ON public.proposal_status_history(proposal_id);

ALTER TABLE public.proposal_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposal_status_history' AND policyname='psh_service_role'
  ) THEN
    CREATE POLICY psh_service_role ON public.proposal_status_history FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposal_status_history' AND policyname='psh_authenticated'
  ) THEN
    CREATE POLICY psh_authenticated ON public.proposal_status_history FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.proposals p
          WHERE p.id = proposal_id
            AND (
              CASE public.my_app_role()
                WHEN 'SuperAdministrator' THEN true
                WHEN 'Administrator'      THEN true
                WHEN 'BD Manager'         THEN public.prospect_visible_to_me(p.owner_id)
                WHEN 'BD Executive'       THEN p.owner_id = auth.uid()
                ELSE false
              END
            )
        )
      )
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT ON public.proposal_status_history TO service_role, authenticated;

COMMIT;

-- =============================================================
-- MARKITION CRM — Activities, Communications & Attachments
-- 2026-11-02
-- =============================================================

BEGIN;

-- ── 1. prospect_activities ─────────────────────────────────────────────────
-- Named prospect_activities to avoid clash with the existing activities (audit) table.

CREATE TABLE IF NOT EXISTS public.prospect_activities (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id         uuid        NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  owner_id            uuid        NOT NULL REFERENCES public.users(id),
  type                text        NOT NULL
                                  CHECK (type IN ('call','email','whatsapp','meeting','other')),
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  description         text,
  outcome             text,
  next_action         text,
  follow_up_at        timestamptz,
  completed_at        timestamptz,
  parent_activity_id  uuid        REFERENCES public.prospect_activities(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_prospect_id_idx ON public.prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS pa_owner_id_idx    ON public.prospect_activities(owner_id);
CREATE INDEX IF NOT EXISTS pa_follow_up_idx   ON public.prospect_activities(follow_up_at)
  WHERE follow_up_at IS NOT NULL AND completed_at IS NULL;

ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prospect_activities' AND policyname='pa_service_role'
  ) THEN
    CREATE POLICY pa_service_role ON public.prospect_activities FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prospect_activities' AND policyname='pa_authenticated'
  ) THEN
    CREATE POLICY pa_authenticated ON public.prospect_activities FOR ALL
      USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_activities TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_prospect_activities_updated_at ON public.prospect_activities;
CREATE TRIGGER set_prospect_activities_updated_at
  BEFORE UPDATE ON public.prospect_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. communications ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.communications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid        NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  logged_by       uuid        NOT NULL REFERENCES public.users(id),
  channel         text        NOT NULL
                              CHECK (channel IN ('call','email','whatsapp','meeting','other')),
  direction       text        NOT NULL
                              CHECK (direction IN ('inbound','outbound')),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  summary         text,
  next_action     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comm_prospect_id_idx ON public.communications(prospect_id);
CREATE INDEX IF NOT EXISTS comm_logged_by_idx   ON public.communications(logged_by);

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communications' AND policyname='comm_service_role'
  ) THEN
    CREATE POLICY comm_service_role ON public.communications FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communications' AND policyname='comm_authenticated'
  ) THEN
    CREATE POLICY comm_authenticated ON public.communications FOR ALL
      USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO service_role, authenticated;

DROP TRIGGER IF EXISTS set_communications_updated_at ON public.communications;
CREATE TRIGGER set_communications_updated_at
  BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. communication_attachments ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.communication_attachments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid        NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  file_name        text        NOT NULL,
  storage_path     text        NOT NULL,
  file_size        bigint,
  mime_type        text,
  uploaded_by      uuid        REFERENCES public.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ca_communication_id_idx ON public.communication_attachments(communication_id);

ALTER TABLE public.communication_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communication_attachments' AND policyname='ca_service_role'
  ) THEN
    CREATE POLICY ca_service_role ON public.communication_attachments FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communication_attachments' AND policyname='ca_authenticated'
  ) THEN
    CREATE POLICY ca_authenticated ON public.communication_attachments FOR ALL
      USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_attachments TO service_role, authenticated;

COMMIT;

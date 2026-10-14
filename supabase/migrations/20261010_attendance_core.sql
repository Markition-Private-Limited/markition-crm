-- =============================================================
-- MARKITION CRM — Attendance Core (schema, RLS, changelog)
-- 2026-10-10
--
-- Additive only. Does NOT alter profiles, app_roles, app_permissions,
-- user_roles, or any CRM table. Every object is attendance_* prefixed.
--
-- Access model
--   admin     = user_roles -> app_roles.name in ('Super Admin','Admin')
--               (same mapping as lib/auth/require-role.ts)
--   employee  = own rows only (profile_id = auth.uid())
--   anon      = no access
--
-- No blanket "any authenticated user" policies on any table here.
-- =============================================================

BEGIN;

-- ── Helpers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.attendance_is_admin(check_user_id uuid DEFAULT auth.uid())
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
      AND lower(r.name) IN ('super admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.attendance_can_access_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.attendance_is_admin() OR target_profile_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.attendance_is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attendance_can_access_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attendance_can_access_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attendance_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ── 1. Staff attendance profile (one-to-one with profiles) ───

CREATE TABLE IF NOT EXISTS public.attendance_staff_profiles (
  profile_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code      text UNIQUE,
  is_wfh_eligible    boolean NOT NULL DEFAULT false,
  attendance_enabled boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.attendance_staff_profiles IS 'Attendance-specific fields for a profile. One row per profile, optional.';

-- ── 2. Shifts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.attendance_staff_profiles(profile_id) ON DELETE CASCADE,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_shifts_times_check CHECK (start_time <> end_time),
  CONSTRAINT attendance_shifts_range_check CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- At most one open-ended shift per person. A shift change means closing the
-- current shift (set effective_to) before inserting the next one.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_shifts_one_open_idx
  ON public.attendance_shifts (profile_id) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS attendance_shifts_profile_idx
  ON public.attendance_shifts (profile_id, effective_from DESC);

-- ── 3. Daily attendance records (one per person per day) ─────

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.attendance_staff_profiles(profile_id) ON DELETE CASCADE,
  work_date     date NOT NULL,
  status        text NOT NULL DEFAULT 'present',
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_records_profile_date_key UNIQUE (profile_id, work_date),
  CONSTRAINT attendance_records_status_check CHECK (status IN ('present', 'wfh', 'absent')),
  CONSTRAINT attendance_records_times_check CHECK (
    check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at
  )
);

CREATE INDEX IF NOT EXISTS attendance_records_work_date_idx ON public.attendance_records (work_date);

-- ── 4. Breaks (child of a daily record) ──────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_breaks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id  uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  break_type            text NOT NULL,
  started_at            timestamptz NOT NULL,
  ended_at              timestamptz,
  duration_minutes      integer GENERATED ALWAYS AS (
                          CASE WHEN ended_at IS NOT NULL
                            THEN floor(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::integer
                          END
                        ) STORED,
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_breaks_type_check CHECK (break_type IN ('lunch', 'tea', 'prayer', 'personal', 'other')),
  CONSTRAINT attendance_breaks_range_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- At most one open break per record.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_breaks_one_open_idx
  ON public.attendance_breaks (attendance_record_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS attendance_breaks_record_idx
  ON public.attendance_breaks (attendance_record_id);

-- ── 5. WFH proof submissions (one per person per day) ────────

CREATE TABLE IF NOT EXISTS public.attendance_wfh_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid NOT NULL REFERENCES public.attendance_staff_profiles(profile_id) ON DELETE CASCADE,
  work_date        date NOT NULL,
  proof_text       text,
  -- Path inside a private storage bucket, not a public URL.
  proof_file_path  text,
  status           text NOT NULL DEFAULT 'pending',
  reviewed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  review_note      text,
  submitted_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_wfh_profile_date_key UNIQUE (profile_id, work_date),
  CONSTRAINT attendance_wfh_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT attendance_wfh_proof_check CHECK (proof_text IS NOT NULL OR proof_file_path IS NOT NULL),
  CONSTRAINT attendance_wfh_review_check CHECK (
    (status = 'pending'  AND reviewed_by IS NULL     AND reviewed_at IS NULL) OR
    (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS attendance_wfh_status_idx ON public.attendance_wfh_submissions (status);

-- ── 6. Changelog (append-only, written by triggers only) ─────

CREATE TABLE IF NOT EXISTS public.attendance_changelog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  -- The employee the entry is about. Drives RLS for employee read access.
  profile_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT attendance_changelog_action_check CHECK (action IN (
    'check_in', 'check_out', 'break_start', 'break_end',
    'wfh_submit', 'wfh_approve', 'wfh_reject',
    'shift_assign', 'shift_change'
  )),
  CONSTRAINT attendance_changelog_entity_check CHECK (entity_type IN (
    'record', 'break', 'wfh_submission', 'shift'
  ))
);

CREATE INDEX IF NOT EXISTS attendance_changelog_profile_idx
  ON public.attendance_changelog (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_changelog_entity_idx
  ON public.attendance_changelog (entity_type, entity_id);

-- ── updated_at triggers ──────────────────────────────────────

DROP TRIGGER IF EXISTS attendance_staff_profiles_touch ON public.attendance_staff_profiles;
CREATE TRIGGER attendance_staff_profiles_touch BEFORE UPDATE ON public.attendance_staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attendance_touch_updated_at();

DROP TRIGGER IF EXISTS attendance_shifts_touch ON public.attendance_shifts;
CREATE TRIGGER attendance_shifts_touch BEFORE UPDATE ON public.attendance_shifts
  FOR EACH ROW EXECUTE FUNCTION public.attendance_touch_updated_at();

DROP TRIGGER IF EXISTS attendance_records_touch ON public.attendance_records;
CREATE TRIGGER attendance_records_touch BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.attendance_touch_updated_at();

DROP TRIGGER IF EXISTS attendance_breaks_touch ON public.attendance_breaks;
CREATE TRIGGER attendance_breaks_touch BEFORE UPDATE ON public.attendance_breaks
  FOR EACH ROW EXECUTE FUNCTION public.attendance_touch_updated_at();

DROP TRIGGER IF EXISTS attendance_wfh_touch ON public.attendance_wfh_submissions;
CREATE TRIGGER attendance_wfh_touch BEFORE UPDATE ON public.attendance_wfh_submissions
  FOR EACH ROW EXECUTE FUNCTION public.attendance_touch_updated_at();

-- ── Changelog writers ────────────────────────────────────────
-- SECURITY DEFINER so employees never need INSERT on the changelog.
-- auth.uid() still reads the caller's JWT, so actor_id is the real user.

CREATE OR REPLACE FUNCTION public.attendance_log_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.check_in_at IS NOT NULL THEN
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'check_in', 'record', NEW.id, NEW.profile_id, NULL, to_jsonb(NEW));
    END IF;
    IF NEW.check_out_at IS NOT NULL THEN
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'check_out', 'record', NEW.id, NEW.profile_id, NULL, to_jsonb(NEW));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.check_in_at IS NULL AND NEW.check_in_at IS NOT NULL THEN
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'check_in', 'record', NEW.id, NEW.profile_id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    IF OLD.check_out_at IS NULL AND NEW.check_out_at IS NOT NULL THEN
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'check_out', 'record', NEW.id, NEW.profile_id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_log_breaks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT r.profile_id INTO v_profile_id
  FROM public.attendance_records r
  WHERE r.id = NEW.attendance_record_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
    VALUES (auth.uid(), 'break_start', 'break', NEW.id, v_profile_id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
    VALUES (auth.uid(), 'break_end', 'break', NEW.id, v_profile_id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_log_wfh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
    VALUES (auth.uid(), 'wfh_submit', 'wfh_submission', NEW.id, NEW.profile_id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
    VALUES (
      auth.uid(),
      CASE NEW.status WHEN 'approved' THEN 'wfh_approve' ELSE 'wfh_reject' END,
      'wfh_submission', NEW.id, NEW.profile_id, to_jsonb(OLD), to_jsonb(NEW)
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_log_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT to_jsonb(s) INTO v_prior
    FROM public.attendance_shifts s
    WHERE s.profile_id = NEW.profile_id AND s.id <> NEW.id
    ORDER BY s.effective_from DESC, s.created_at DESC
    LIMIT 1;

    IF v_prior IS NULL THEN
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'shift_assign', 'shift', NEW.id, NEW.profile_id, NULL, to_jsonb(NEW));
    ELSE
      INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
      VALUES (auth.uid(), 'shift_change', 'shift', NEW.id, NEW.profile_id, v_prior, to_jsonb(NEW));
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (
    OLD.start_time, OLD.end_time, OLD.effective_from, OLD.effective_to
  ) IS DISTINCT FROM (
    NEW.start_time, NEW.end_time, NEW.effective_from, NEW.effective_to
  ) THEN
    INSERT INTO public.attendance_changelog (actor_id, action, entity_type, entity_id, profile_id, before_data, after_data)
    VALUES (auth.uid(), 'shift_change', 'shift', NEW.id, NEW.profile_id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_log ON public.attendance_records;
CREATE TRIGGER attendance_records_log AFTER INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.attendance_log_records();

DROP TRIGGER IF EXISTS attendance_breaks_log ON public.attendance_breaks;
CREATE TRIGGER attendance_breaks_log AFTER INSERT OR UPDATE ON public.attendance_breaks
  FOR EACH ROW EXECUTE FUNCTION public.attendance_log_breaks();

DROP TRIGGER IF EXISTS attendance_wfh_log ON public.attendance_wfh_submissions;
CREATE TRIGGER attendance_wfh_log AFTER INSERT OR UPDATE ON public.attendance_wfh_submissions
  FOR EACH ROW EXECUTE FUNCTION public.attendance_log_wfh();

DROP TRIGGER IF EXISTS attendance_shifts_log ON public.attendance_shifts;
CREATE TRIGGER attendance_shifts_log AFTER INSERT OR UPDATE ON public.attendance_shifts
  FOR EACH ROW EXECUTE FUNCTION public.attendance_log_shifts();

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE public.attendance_staff_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_shifts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_breaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_wfh_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_changelog        ENABLE ROW LEVEL SECURITY;

-- attendance_staff_profiles: admin writes; admin or self reads.
DROP POLICY IF EXISTS attendance_staff_profiles_select ON public.attendance_staff_profiles;
CREATE POLICY attendance_staff_profiles_select ON public.attendance_staff_profiles
  FOR SELECT TO authenticated
  USING (public.attendance_can_access_profile(profile_id));

DROP POLICY IF EXISTS attendance_staff_profiles_admin_write ON public.attendance_staff_profiles;
CREATE POLICY attendance_staff_profiles_admin_write ON public.attendance_staff_profiles
  FOR ALL TO authenticated
  USING (public.attendance_is_admin())
  WITH CHECK (public.attendance_is_admin());

-- attendance_shifts: admin assigns and changes shifts; staff read their own.
DROP POLICY IF EXISTS attendance_shifts_select ON public.attendance_shifts;
CREATE POLICY attendance_shifts_select ON public.attendance_shifts
  FOR SELECT TO authenticated
  USING (public.attendance_can_access_profile(profile_id));

DROP POLICY IF EXISTS attendance_shifts_admin_write ON public.attendance_shifts;
CREATE POLICY attendance_shifts_admin_write ON public.attendance_shifts
  FOR ALL TO authenticated
  USING (public.attendance_is_admin())
  WITH CHECK (public.attendance_is_admin());

-- attendance_records: admin full access; staff read/write own rows, no delete.
DROP POLICY IF EXISTS attendance_records_admin_all ON public.attendance_records;
CREATE POLICY attendance_records_admin_all ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.attendance_is_admin())
  WITH CHECK (public.attendance_is_admin());

DROP POLICY IF EXISTS attendance_records_own_select ON public.attendance_records;
CREATE POLICY attendance_records_own_select ON public.attendance_records
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS attendance_records_own_insert ON public.attendance_records;
CREATE POLICY attendance_records_own_insert ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS attendance_records_own_update ON public.attendance_records;
CREATE POLICY attendance_records_own_update ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- attendance_breaks: scoped through the parent record's owner.
DROP POLICY IF EXISTS attendance_breaks_access ON public.attendance_breaks;
CREATE POLICY attendance_breaks_access ON public.attendance_breaks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attendance_records r
    WHERE r.id = attendance_record_id
      AND public.attendance_can_access_profile(r.profile_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.attendance_records r
    WHERE r.id = attendance_record_id
      AND public.attendance_can_access_profile(r.profile_id)
  ));

-- attendance_wfh_submissions: admin reviews all; staff submit and edit
-- their own while pending. Staff cannot set a review or status.
DROP POLICY IF EXISTS attendance_wfh_admin_all ON public.attendance_wfh_submissions;
CREATE POLICY attendance_wfh_admin_all ON public.attendance_wfh_submissions
  FOR ALL TO authenticated
  USING (public.attendance_is_admin())
  WITH CHECK (public.attendance_is_admin());

DROP POLICY IF EXISTS attendance_wfh_own_select ON public.attendance_wfh_submissions;
CREATE POLICY attendance_wfh_own_select ON public.attendance_wfh_submissions
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS attendance_wfh_own_insert ON public.attendance_wfh_submissions;
CREATE POLICY attendance_wfh_own_insert ON public.attendance_wfh_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS attendance_wfh_own_update ON public.attendance_wfh_submissions;
CREATE POLICY attendance_wfh_own_update ON public.attendance_wfh_submissions
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
  );

-- attendance_changelog: admin reads all; staff read entries about them.
-- No insert, update, or delete policies for any client role. Only the
-- SECURITY DEFINER triggers above write here.
DROP POLICY IF EXISTS attendance_changelog_select ON public.attendance_changelog;
CREATE POLICY attendance_changelog_select ON public.attendance_changelog
  FOR SELECT TO authenticated
  USING (public.attendance_can_access_profile(profile_id));

-- ── Grants ───────────────────────────────────────────────────
-- RLS is the real gate. Grants only make the tables reachable at all.

REVOKE ALL ON public.attendance_staff_profiles,
              public.attendance_shifts,
              public.attendance_records,
              public.attendance_breaks,
              public.attendance_wfh_submissions,
              public.attendance_changelog
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_staff_profiles,
                                        public.attendance_shifts,
                                        public.attendance_records,
                                        public.attendance_breaks,
                                        public.attendance_wfh_submissions
  TO authenticated;

GRANT SELECT ON public.attendance_changelog TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_staff_profiles,
                                        public.attendance_shifts,
                                        public.attendance_records,
                                        public.attendance_breaks,
                                        public.attendance_wfh_submissions,
                                        public.attendance_changelog
  TO service_role;

COMMIT;

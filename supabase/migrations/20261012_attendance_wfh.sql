-- Module 5: WFH Proof Submission + Admin Approval
-- Adds submitted_late flag to attendance_wfh_submissions.
-- True when the submission (or last update) arrived after the
-- employee's shift end time on the claimed work_date.

ALTER TABLE public.attendance_wfh_submissions
  ADD COLUMN IF NOT EXISTS submitted_late boolean NOT NULL DEFAULT false;

-- Ensure the wfh-proof storage bucket exists (idempotent via DO block).
-- Actual bucket creation is handled by the migration script via Supabase client.

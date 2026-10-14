-- Module 4: Break System
-- Adds exceeded_allowance flag to attendance_breaks.
-- Set to true at break-end time when the employee ran over the
-- allowed duration (40 min for long_break, 10 min for short_break).

ALTER TABLE public.attendance_breaks
  ADD COLUMN IF NOT EXISTS exceeded_allowance boolean NOT NULL DEFAULT false;

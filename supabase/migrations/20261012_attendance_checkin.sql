-- Module 3: Check-in / Check-out
-- Adds derived status columns to attendance_records.
-- punctuality: computed at check-in time vs shift start
-- shift_completed: computed at check-out time (hours worked vs shift duration)

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS punctuality     text    CHECK (punctuality IN ('early', 'on_time', 'late')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shift_completed boolean DEFAULT NULL;

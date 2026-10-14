-- Make contacts.email nullable (it was NOT NULL in the original Supabase schema).
-- The wizard allows contacts without an email, so this constraint is too strict.

ALTER TABLE public.contacts ALTER COLUMN email DROP NOT NULL;

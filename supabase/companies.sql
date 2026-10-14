-- Supabase schema for the companies module
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  industry text,
  phone text,
  email text,
  address text,
  country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS 'Client companies managed by the CRM';
COMMENT ON COLUMN public.companies.name IS 'Company name';
COMMENT ON COLUMN public.companies.website IS 'Company website URL';
COMMENT ON COLUMN public.companies.industry IS 'Industry or sector';
COMMENT ON COLUMN public.companies.phone IS 'Contact phone number';
COMMENT ON COLUMN public.companies.email IS 'Contact email address';
COMMENT ON COLUMN public.companies.address IS 'Primary address';
COMMENT ON COLUMN public.companies.country IS 'Country';
COMMENT ON COLUMN public.companies.notes IS 'Internal notes and additional details';

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select, insert, update, and delete
CREATE POLICY "authenticated_crud" ON public.companies
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow service_role (via admin API) to bypass RLS
CREATE POLICY "service_role_bypass" ON public.companies
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

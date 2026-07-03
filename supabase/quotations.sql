-- Supabase schema for the quotations module
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  client_company_id uuid,
  contact_id uuid,
  sales_representative text,
  currency text NOT NULL DEFAULT 'USD',
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  reference_number text,
  status text NOT NULL DEFAULT 'Draft',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  internal_notes text,
  terms_and_conditions text,
  attachments text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quotations IS 'Quotation documents used to manage pricing proposals and approvals';
COMMENT ON COLUMN public.quotations.quotation_number IS 'Human-readable quotation reference';
COMMENT ON COLUMN public.quotations.client_company_id IS 'Client company related to the quotation';
COMMENT ON COLUMN public.quotations.contact_id IS 'Primary contact for the quotation';
COMMENT ON COLUMN public.quotations.sales_representative IS 'Internal sales representative owner';
COMMENT ON COLUMN public.quotations.currency IS 'Currency code used for pricing';
COMMENT ON COLUMN public.quotations.status IS 'Quotation lifecycle status';
COMMENT ON COLUMN public.quotations.line_items IS 'Itemized services and products';
COMMENT ON COLUMN public.quotations.attachments IS 'Attachment references or notes';

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud" ON public.quotations
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass" ON public.quotations
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

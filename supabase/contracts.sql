-- Supabase schema for the contracts module
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  contract_name text NOT NULL,
  company_id uuid,
  contact_id uuid,
  related_quotation_id uuid,
  sales_representative text,
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL DEFAULT 'Monthly',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  renewal_option text,
  auto_renewal boolean NOT NULL DEFAULT false,
  renewal_reminder_date date,
  notice_period_days integer NOT NULL DEFAULT 30,
  terms text,
  payment_terms text,
  scope_of_work text,
  responsibilities text,
  cancellation_terms text,
  warranty text,
  confidentiality text,
  notes text,
  internal_notes text,
  attachments text,
  status text NOT NULL DEFAULT 'Draft',
  archived boolean NOT NULL DEFAULT false,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  renewal_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  version_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_copy_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contracts IS 'Signed agreements managed after quotation acceptance';
COMMENT ON COLUMN public.contracts.contract_number IS 'Human readable contract reference';
COMMENT ON COLUMN public.contracts.contract_name IS 'Agreement title';
COMMENT ON COLUMN public.contracts.company_id IS 'Client company tied to the contract';
COMMENT ON COLUMN public.contracts.contact_id IS 'Primary contract contact';
COMMENT ON COLUMN public.contracts.related_quotation_id IS 'Quotation that led to the contract';
COMMENT ON COLUMN public.contracts.billing_cycle IS 'Billing cadence for the contract';
COMMENT ON COLUMN public.contracts.auto_renewal IS 'Whether the contract auto renews';
COMMENT ON COLUMN public.contracts.renewal_reminder_date IS 'Reminder date for renewal workflow';
COMMENT ON COLUMN public.contracts.notice_period_days IS 'Notice period before renewal or termination';
COMMENT ON COLUMN public.contracts.timeline IS 'Lifecycle timeline entries';
COMMENT ON COLUMN public.contracts.activity_log IS 'Operational activity entries';
COMMENT ON COLUMN public.contracts.renewal_history IS 'Historical renewal records';
COMMENT ON COLUMN public.contracts.version_history IS 'Version change history';
COMMENT ON COLUMN public.contracts.comments IS 'Contract discussion notes';

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud" ON public.contracts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass" ON public.contracts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

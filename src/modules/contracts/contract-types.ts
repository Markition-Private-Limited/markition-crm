import { z } from "zod";

const trimEmptyToUndefined = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
};

const optionalString = (maxLength = 255) =>
  z.preprocess(trimEmptyToUndefined, z.string().max(maxLength).optional());

const optionalNumber = () =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().optional());

const optionalDate = () =>
  z.preprocess(trimEmptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").optional());

const contractStatusValues = ["Draft", "Under Review", "Pending Signature", "Active", "Completed", "Expired", "Terminated", "Renewed"] as const;
const billingCycleValues = ["Monthly", "Quarterly", "Yearly", "One Time"] as const;

export type ContractStatus = (typeof contractStatusValues)[number];
export type BillingCycle = (typeof billingCycleValues)[number];

export const CONTRACT_STATUSES = [...contractStatusValues] as const;
export const BILLING_CYCLES = [...billingCycleValues] as const;

export const contractSchema = z.object({
  contract_number: z.string().min(3, "Contract number is required").max(60, "Contract number is too long"),
  contract_name: z.string().min(2, "Contract name is required").max(160, "Contract name is too long"),
  company_id: optionalString(80),
  contact_id: optionalString(80),
  related_quotation_id: optionalString(80),
  sales_representative: optionalString(120),
  contract_value: optionalNumber().refine((value) => value === undefined || value >= 0, "Contract value must be 0 or greater"),
  currency: z.string().min(3, "Currency is required").max(10, "Currency is too long"),
  billing_cycle: z.enum(billingCycleValues),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  renewal_option: optionalString(120),
  auto_renewal: z.boolean(),
  renewal_reminder_date: optionalDate(),
  notice_period_days: z.coerce.number().min(0, "Notice period must be 0 or greater").max(3650, "Notice period is too large"),
  terms: optionalString(5000),
  payment_terms: optionalString(5000),
  scope_of_work: optionalString(5000),
  responsibilities: optionalString(5000),
  cancellation_terms: optionalString(5000),
  warranty: optionalString(5000),
  confidentiality: optionalString(5000),
  notes: optionalString(5000),
  internal_notes: optionalString(5000),
  attachments: optionalString(5000),
  status: z.enum(contractStatusValues),
});

export type ContractFormValues = z.infer<typeof contractSchema>;

export type ContractActivityEntry = {
  label: string;
  detail?: string;
  at: string;
  tone?: "default" | "success" | "warning" | "muted";
};

export type ContractCommentEntry = {
  author?: string;
  body: string;
  at: string;
};

export type ContractVersionEntry = {
  version: string;
  note?: string;
  at: string;
};

export type Contract = {
  id: string;
  contract_number?: string;
  contract_name?: string;
  company_id?: string;
  contact_id?: string;
  related_quotation_id?: string;
  sales_representative?: string;
  contract_value?: number;
  currency?: string;
  billing_cycle?: BillingCycle | string;
  effective_date?: string;
  start_date?: string;
  end_date?: string;
  renewal_option?: string;
  auto_renewal?: boolean;
  renewal_reminder_date?: string;
  notice_period_days?: number;
  terms?: string;
  payment_terms?: string;
  scope_of_work?: string;
  responsibilities?: string;
  cancellation_terms?: string;
  warranty?: string;
  confidentiality?: string;
  notes?: string;
  internal_notes?: string;
  attachments?: string | string[];
  status?: ContractStatus | string;
  archived?: boolean;
  timeline?: ContractActivityEntry[] | string;
  activity_log?: ContractActivityEntry[] | string;
  renewal_history?: ContractVersionEntry[] | string;
  version_history?: ContractVersionEntry[] | string;
  comments?: ContractCommentEntry[] | string;
  signed_copy_url?: string;
  created_at?: string;
  updated_at?: string;
};

export function generateContractNumber() {
  const stamp = new Date();
  const datePart = stamp.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `C-${datePart}-${randomPart}`;
}

export function emptyContractDraft(): ContractFormValues {
  const today = new Date();
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + 1);
  const reminder = new Date(end);
  reminder.setDate(reminder.getDate() - 30);

  const dateValue = (date: Date) => date.toISOString().slice(0, 10);

  return {
    contract_number: generateContractNumber(),
    contract_name: "",
    company_id: undefined,
    contact_id: undefined,
    related_quotation_id: undefined,
    sales_representative: undefined,
    contract_value: undefined,
    currency: "USD",
    billing_cycle: "Monthly",
    effective_date: dateValue(today),
    start_date: dateValue(today),
    end_date: dateValue(end),
    renewal_option: "Auto renew",
    auto_renewal: true,
    renewal_reminder_date: dateValue(reminder),
    notice_period_days: 30,
    terms: undefined,
    payment_terms: undefined,
    scope_of_work: undefined,
    responsibilities: undefined,
    cancellation_terms: undefined,
    warranty: undefined,
    confidentiality: undefined,
    notes: undefined,
    internal_notes: undefined,
    attachments: undefined,
    status: "Draft",
  };
}

export function contractToDraft(contract?: Contract, duplicate = false): ContractFormValues {
  if (!contract) {
    return emptyContractDraft();
  }

  return {
    contract_number: duplicate ? generateContractNumber() : contract.contract_number ?? generateContractNumber(),
    contract_name: contract.contract_name ?? "",
    company_id: contract.company_id,
    contact_id: contract.contact_id,
    related_quotation_id: contract.related_quotation_id,
    sales_representative: contract.sales_representative,
    contract_value: contract.contract_value,
    currency: contract.currency ?? "USD",
    billing_cycle: (contract.billing_cycle as BillingCycle) ?? "Monthly",
    effective_date: contract.effective_date ?? new Date().toISOString().slice(0, 10),
    start_date: contract.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: contract.end_date ?? new Date().toISOString().slice(0, 10),
    renewal_option: contract.renewal_option,
    auto_renewal: contract.auto_renewal ?? false,
    renewal_reminder_date: contract.renewal_reminder_date,
    notice_period_days: contract.notice_period_days ?? 30,
    terms: contract.terms,
    payment_terms: contract.payment_terms,
    scope_of_work: contract.scope_of_work,
    responsibilities: contract.responsibilities,
    cancellation_terms: contract.cancellation_terms,
    warranty: contract.warranty,
    confidentiality: contract.confidentiality,
    notes: contract.notes,
    internal_notes: contract.internal_notes,
    attachments: Array.isArray(contract.attachments) ? contract.attachments.join("\n") : contract.attachments,
    status: duplicate ? "Draft" : (contract.status as ContractStatus) ?? "Draft",
  };
}

export function parseTextList(value?: string | string[]) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatContractDate(value?: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function daysUntil(value?: string) {
  if (!value) {
    return null;
  }

  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return null;
  }
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

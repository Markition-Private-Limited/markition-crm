"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Copy, RefreshCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  BILLING_CYCLES,
  contractSchema,
  contractToDraft,
  emptyContractDraft,
  formatCurrency,
  generateContractNumber,
  parseTextList,
  type BillingCycle,
  type Contract,
  type ContractFormValues,
  type ContractStatus,
} from "@/src/modules/contracts/contract-types";
import { createContract, updateContract } from "@/src/modules/contracts/contract-client";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Quotation } from "@/src/modules/quotations/quotation-types";

interface ContractFormProps {
  contract?: Contract;
  companies: Company[];
  contacts: Contact[];
  quotations: Quotation[];
  mode?: "create" | "edit";
  draftKey?: string;
  onSaved?: (contract: Contract | null) => void;
  onError?: (message: string) => void;
}

type ContractDraftValues = {
  contract_number: string;
  contract_name: string;
  company_id?: string;
  contact_id?: string;
  related_quotation_id?: string;
  sales_representative?: string;
  contract_value?: string;
  currency: string;
  billing_cycle: BillingCycle;
  effective_date: string;
  start_date: string;
  end_date: string;
  renewal_option?: string;
  auto_renewal: boolean;
  renewal_reminder_date?: string;
  notice_period_days: string;
  terms?: string;
  payment_terms?: string;
  scope_of_work?: string;
  responsibilities?: string;
  cancellation_terms?: string;
  warranty?: string;
  confidentiality?: string;
  notes?: string;
  internal_notes?: string;
  attachments?: string;
  status: ContractStatus;
};

function toDraftValues(contract?: Contract, duplicate = false): ContractDraftValues {
  const source = contractToDraft(contract, duplicate);
  return {
    ...source,
    contract_value: source.contract_value !== undefined ? String(source.contract_value) : "",
    notice_period_days: String(source.notice_period_days ?? 30),
  };
}

function resolveInitialValues(contract?: Contract, draftKey?: string): ContractDraftValues {
  if (contract) {
    return toDraftValues(contract);
  }

  if (draftKey && typeof window !== "undefined") {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ContractDraftValues;
        return {
          ...toDraftValues(),
          ...parsed,
          contract_value: parsed.contract_value ?? "",
          notice_period_days: parsed.notice_period_days || "30",
        };
      } catch {
        // Ignore malformed draft data.
      }
    }
  }

  return toDraftValues();
}

export function ContractForm({
  contract,
  companies,
  contacts,
  quotations,
  mode = "create",
  draftKey,
  onSaved,
  onError,
}: ContractFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<ContractDraftValues>(() => resolveInitialValues(contract, draftKey));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [autosaveState, setAutosaveState] = React.useState<"idle" | "saved" | "loading">("idle");
  const hasLoadedDraft = React.useRef(false);

  React.useEffect(() => {
    if (contract) {
      setValues(toDraftValues(contract));
      return;
    }

    if (!draftKey || hasLoadedDraft.current) {
      return;
    }

    hasLoadedDraft.current = true;
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as ContractDraftValues;
      setValues({
        ...toDraftValues(),
        ...parsed,
        contract_value: parsed.contract_value ?? "",
        notice_period_days: parsed.notice_period_days || "30",
      });
      setAutosaveState("saved");
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [contract, draftKey]);

  React.useEffect(() => {
    if (!draftKey || contract) {
      return;
    }

    setAutosaveState("loading");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(values));
        setAutosaveState("saved");
      } catch {
        setAutosaveState("idle");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [contract, draftKey, values]);

  const updateField = (name: keyof ContractDraftValues, value: string | boolean) => {
    setValues((current) => ({
      ...current,
      [name]: value as never,
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const regenerateContractNumber = () => {
    setValues((current) => ({
      ...current,
      contract_number: generateContractNumber(),
    }));
  };

  const selectedCompanyContacts = contacts.filter((contact) => {
    if (!values.company_id) {
      return true;
    }
    return !contact.company_id || contact.company_id === values.company_id;
  });

  const acceptedQuotations = quotations.filter((quotation) => String(quotation.status ?? "") === "Accepted" && !quotation.archived);
  const selectedQuotation = quotations.find((quotation) => quotation.id === values.related_quotation_id);
  const textareaFields: Array<{ key: Exclude<keyof ContractDraftValues, "auto_renewal" | "contract_value" | "notice_period_days" | "billing_cycle" | "currency" | "status">; label: string }> = [
    { key: "terms", label: "Terms" },
    { key: "payment_terms", label: "Payment terms" },
    { key: "scope_of_work", label: "Scope of work" },
    { key: "responsibilities", label: "Responsibilities" },
    { key: "cancellation_terms", label: "Cancellation terms" },
    { key: "warranty", label: "Warranty" },
    { key: "confidentiality", label: "Confidentiality" },
    { key: "notes", label: "Notes" },
    { key: "internal_notes", label: "Internal notes" },
  ];

  React.useEffect(() => {
    if (!selectedQuotation) {
      return;
    }

    setValues((current) => {
      const next: ContractDraftValues = { ...current };
      if (!current.company_id && selectedQuotation.client_company_id) {
        next.company_id = selectedQuotation.client_company_id;
      }
      if (!current.contact_id && selectedQuotation.contact_id) {
        next.contact_id = selectedQuotation.contact_id;
      }
      if (!current.sales_representative && selectedQuotation.sales_representative) {
        next.sales_representative = selectedQuotation.sales_representative;
      }
      if (!current.currency && selectedQuotation.currency) {
        next.currency = selectedQuotation.currency;
      }
      if (!current.contract_value && selectedQuotation.grand_total !== undefined) {
        next.contract_value = String(selectedQuotation.grand_total);
      }
      return next;
    });
  }, [selectedQuotation]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = contractSchema.safeParse({
      ...values,
      contract_value: values.contract_value === "" ? undefined : values.contract_value,
      notice_period_days: values.notice_period_days === "" ? 30 : values.notice_period_days,
      attachments: values.attachments?.trim() || undefined,
      renewal_option: values.auto_renewal ? values.renewal_option || "Auto renew" : values.renewal_option,
    });

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errors).map(([key, value]) => [key, value?.[0] ?? ""]),
        ) as Record<string, string>,
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload: ContractFormValues = {
        ...result.data,
        contract_value: result.data.contract_value ?? 0,
        notice_period_days: Number(result.data.notice_period_days ?? 30),
        attachments: result.data.attachments?.trim() || undefined,
      };

      let saved: Contract | null = null;
      if (mode === "edit" && contract?.id) {
        const { data, error } = await updateContract(contract.id, payload);
        if (error) {
          const message = error.message;
          setFormError(message);
          onError?.(message);
          setIsSaving(false);
          return;
        }
        saved = data as Contract;
      } else {
        const { data, error } = await createContract(payload);
        if (error) {
          const message = error.message;
          setFormError(message);
          onError?.(message);
          setIsSaving(false);
          return;
        }
        saved = data as Contract;
      }

      if (draftKey) {
        window.localStorage.removeItem(draftKey);
      }

      onSaved?.(saved);
      if (saved?.id && !onSaved) {
        router.push(`/contracts/${saved.id}`);
      } else if (!saved?.id && !onSaved) {
        router.push("/contracts");
      }
    } catch (error) {
      const message = (error as Error).message ?? "Unable to save contract.";
      setFormError(message);
      onError?.(message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contract Builder</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">General Information</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Create a signed agreement record after the quotation has been accepted.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Autosave</p>
              <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                <Sparkles className="h-4 w-4 text-sky-500" />
                {autosaveState === "loading" ? "Saving draft..." : autosaveState === "saved" ? "Draft saved" : "Ready"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="flex items-end gap-3">
              <Input
                label="Contract number"
                value={values.contract_number}
                onChange={(event) => updateField("contract_number", event.target.value)}
                error={fieldErrors.contract_number}
                required
              />
              <Button type="button" variant="ghost" onClick={regenerateContractNumber} className="mb-1.5 shrink-0">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            <Input
              label="Contract name"
              value={values.contract_name}
              onChange={(event) => updateField("contract_name", event.target.value)}
              error={fieldErrors.contract_name}
              placeholder="Managed services agreement"
              required
            />

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Company</span>
              <select
                value={values.company_id ?? ""}
                onChange={(event) => updateField("company_id", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              {fieldErrors.company_id ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.company_id}</span> : null}
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Contact</span>
              <select
                value={values.contact_id ?? ""}
                onChange={(event) => updateField("contact_id", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select contact</option>
                {selectedCompanyContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name || contact.email || contact.id}</option>
                ))}
              </select>
              {fieldErrors.contact_id ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.contact_id}</span> : null}
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Related quotation</span>
              <select
                value={values.related_quotation_id ?? ""}
                onChange={(event) => updateField("related_quotation_id", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select accepted quotation</option>
                {acceptedQuotations.map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>{quotation.quotation_number || quotation.reference_number || quotation.id}</option>
                ))}
              </select>
              {fieldErrors.related_quotation_id ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.related_quotation_id}</span> : null}
            </label>

            <Input
              label="Sales representative"
              value={values.sales_representative ?? ""}
              onChange={(event) => updateField("sales_representative", event.target.value)}
              error={fieldErrors.sales_representative}
              placeholder="Jordan Smith"
            />

            <Input
              label="Contract value"
              type="number"
              min={0}
              step="0.01"
              value={values.contract_value ?? ""}
              onChange={(event) => updateField("contract_value", event.target.value)}
              error={fieldErrors.contract_value}
              placeholder="48000"
            />

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Currency</span>
              <select
                value={values.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {["USD", "EUR", "GBP", "CAD", "AUD", "AED"].map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
              {fieldErrors.currency ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.currency}</span> : null}
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Billing cycle</span>
              <select
                value={values.billing_cycle}
                onChange={(event) => updateField("billing_cycle", event.target.value as BillingCycle)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {BILLING_CYCLES.map((cycle) => (
                  <option key={cycle} value={cycle}>{cycle}</option>
                ))}
              </select>
              {fieldErrors.billing_cycle ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.billing_cycle}</span> : null}
            </label>

            <Input
              label="Effective date"
              type="date"
              value={values.effective_date}
              onChange={(event) => updateField("effective_date", event.target.value)}
              error={fieldErrors.effective_date}
              required
            />
            <Input
              label="Start date"
              type="date"
              value={values.start_date}
              onChange={(event) => updateField("start_date", event.target.value)}
              error={fieldErrors.start_date}
              required
            />
            <Input
              label="End date"
              type="date"
              value={values.end_date}
              onChange={(event) => updateField("end_date", event.target.value)}
              error={fieldErrors.end_date}
              required
            />
            <Input
              label="Renewal option"
              value={values.renewal_option ?? ""}
              onChange={(event) => updateField("renewal_option", event.target.value)}
              error={fieldErrors.renewal_option}
              placeholder="Auto renew"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contract preview</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{values.status}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Value</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {formatCurrency(Number(values.contract_value || 0), values.currency)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Renewal</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {values.auto_renewal ? "Auto renewal enabled" : "Manual renewal required"}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reminder: {values.renewal_reminder_date || "Not set"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Commercial note</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use this record to track the agreement lifecycle after the quote moves to signature and active service.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400"><BadgeCheck className="h-4 w-4" />Duration controls</div>
            <div className="mt-4 grid gap-4">
              <Input
                label="Renewal reminder"
                type="date"
                value={values.renewal_reminder_date ?? ""}
                onChange={(event) => updateField("renewal_reminder_date", event.target.value)}
                error={fieldErrors.renewal_reminder_date}
              />
              <Input
                label="Notice period (days)"
                type="number"
                min={0}
                value={values.notice_period_days}
                onChange={(event) => updateField("notice_period_days", event.target.value)}
                error={fieldErrors.notice_period_days}
              />
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={values.auto_renewal}
                  onChange={(event) => updateField("auto_renewal", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Auto renewal toggle
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {textareaFields.map(({ key, label }) => (
          <label key={key} className="flex w-full flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:shadow-none sm:p-6">
            <span>{label}</span>
            <textarea
              value={(values[key] as string | undefined) ?? ""}
              onChange={(event) => updateField(key, event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder={`${label} details`}
            />
          </label>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400"><Copy className="h-4 w-4" />Attachments</div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Add PDF, DOCX, or image references. Use one item per line or separate with commas.</p>
        <textarea
          value={values.attachments ?? ""}
          onChange={(event) => updateField("attachments", event.target.value)}
          rows={6}
          className="mt-4 w-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="signed-agreement.pdf\nmsa-redline.docx\nannex-b.jpg"
        />
      </section>

      {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : mode === "edit" ? "Save contract" : "Create contract"}
        </Button>
      </div>
    </Form>
  );
}

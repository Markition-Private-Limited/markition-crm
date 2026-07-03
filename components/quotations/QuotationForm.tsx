"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { QuotationLineItemsEditor } from "@/components/quotations/QuotationLineItemsEditor";
import {
  calculateQuotationSummary,
  emptyQuotationDraft,
  formatCurrency,
  generateQuotationNumber,
  parseTextList,
  quotationSchema,
  quotationToDraft,
  QUOTATION_STATUSES,
  type Quotation,
  type QuotationDraftValues,
  type QuotationFormValues,
} from "@/src/modules/quotations/quotation-types";
import { createQuotation, updateQuotation } from "@/src/modules/quotations/quotation-client";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import { BadgePercent, CalendarDays, RefreshCcw, Save, Sparkles } from "lucide-react";

interface QuotationFormProps {
  quotation?: Quotation;
  companies: Company[];
  contacts: Contact[];
  mode?: "create" | "edit";
  draftKey?: string;
  onSaved?: (quotation: Quotation | null) => void;
  onError?: (message: string) => void;
}

function createInitialValues(quotation?: Quotation, draftKey?: string) {
  if (quotation) {
    return quotationToDraft(quotation);
  }

  if (draftKey && typeof window !== "undefined") {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as QuotationDraftValues;
        return {
          ...emptyQuotationDraft(),
          ...parsed,
          line_items: parsed.line_items?.length ? parsed.line_items : emptyQuotationDraft().line_items,
        };
      } catch {
        // Ignore malformed draft data.
      }
    }
  }

  return emptyQuotationDraft();
}

export function QuotationForm({
  quotation,
  companies,
  contacts,
  mode = "create",
  draftKey,
  onSaved,
  onError,
}: QuotationFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<QuotationDraftValues>(() => createInitialValues(quotation, draftKey));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [autosaveState, setAutosaveState] = React.useState<"idle" | "saved" | "loading">("idle");
  const hasLoadedDraft = React.useRef(false);

  React.useEffect(() => {
    if (quotation) {
      setValues(quotationToDraft(quotation));
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
      const parsed = JSON.parse(saved) as QuotationDraftValues;
      setValues({
        ...emptyQuotationDraft(),
        ...parsed,
        line_items: parsed.line_items?.length ? parsed.line_items : emptyQuotationDraft().line_items,
      });
      setAutosaveState("saved");
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, quotation]);

  React.useEffect(() => {
    if (!draftKey || quotation) {
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
  }, [draftKey, quotation, values]);

  const updateField = (name: keyof QuotationDraftValues, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const updateLineItems = (line_items: QuotationDraftValues["line_items"]) => {
    setValues((current) => ({ ...current, line_items }));
    setFieldErrors((current) => ({ ...current, line_items: "" }));
  };

  const regenerateQuotationNumber = () => {
    setValues((current) => ({
      ...current,
      quotation_number: generateQuotationNumber(),
    }));
  };

  const selectedCompanyContacts = contacts.filter((contact) => {
    if (!values.client_company_id) {
      return true;
    }
    return !contact.company_id || contact.company_id === values.client_company_id;
  });

  const summary = calculateQuotationSummary(values.line_items);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = quotationSchema.safeParse(values);
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
      const payload: QuotationFormValues = {
        ...result.data,
        attachments: result.data.attachments?.trim() || undefined,
        line_items: result.data.line_items.map((item) => ({
          ...item,
          description: item.description?.trim() || undefined,
        })),
      };

      let saved: Quotation | null = null;
      if (mode === "edit" && quotation?.id) {
        const { data, error } = await updateQuotation(quotation.id, payload);
        if (error) {
          const message = error.message;
          setFormError(message);
          onError?.(message);
          setIsSaving(false);
          return;
        }
        saved = data as Quotation;
      } else {
        const { data, error } = await createQuotation(payload);
        if (error) {
          const message = error.message;
          setFormError(message);
          onError?.(message);
          setIsSaving(false);
          return;
        }
        saved = data as Quotation;
      }

      if (draftKey) {
        window.localStorage.removeItem(draftKey);
      }

      onSaved?.(saved);
      if (saved?.id && !onSaved) {
        router.push(`/quotations/${saved.id}`);
      } else if (!saved?.id && !onSaved) {
        router.push("/quotations");
      }
    } catch (error) {
      const message = (error as Error).message ?? "Unable to save quotation.";
      setFormError(message);
      onError?.(message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quotation Builder</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">General Information</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Set the client context, quotation timeline, and commercial owner before adding line items.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Draft status</p>
              <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                <Sparkles className="h-4 w-4 text-sky-500" />
                {autosaveState === "loading" ? "Autosaving..." : autosaveState === "saved" ? "Saved locally" : "Ready"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-end gap-3">
                <Input
                  label="Quotation number"
                  value={values.quotation_number}
                  onChange={(event) => updateField("quotation_number", event.target.value)}
                  error={fieldErrors.quotation_number}
                  required
                />
                <Button type="button" variant="ghost" onClick={regenerateQuotationNumber} className="mb-1.5 shrink-0">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Auto-generated number for every quotation draft.</p>
            </div>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Status</span>
              <select
                value={values.status}
                onChange={(event) => updateField("status", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {QUOTATION_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {fieldErrors.status ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.status}</span> : null}
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Client company</span>
              <select
                value={values.client_company_id ?? ""}
                onChange={(event) => updateField("client_company_id", event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              {fieldErrors.client_company_id ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.client_company_id}</span> : null}
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Contact person</span>
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

            <Input
              label="Sales representative"
              value={values.sales_representative ?? ""}
              onChange={(event) => updateField("sales_representative", event.target.value)}
              error={fieldErrors.sales_representative}
              placeholder="Jordan Smith"
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

            <Input
              label="Quotation date"
              type="date"
              value={values.quotation_date}
              onChange={(event) => updateField("quotation_date", event.target.value)}
              error={fieldErrors.quotation_date}
              required
            />

            <Input
              label="Expiry date"
              type="date"
              value={values.expiry_date ?? ""}
              onChange={(event) => updateField("expiry_date", event.target.value)}
              error={fieldErrors.expiry_date}
            />

            <Input
              label="Reference number"
              value={values.reference_number ?? ""}
              onChange={(event) => updateField("reference_number", event.target.value)}
              error={fieldErrors.reference_number}
              placeholder="PO-2026-0041"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Pricing summary</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-sm text-slate-600 dark:text-slate-300">Subtotal</span>
                <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.subtotal, values.currency)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-sm text-slate-600 dark:text-slate-300">Discount</span>
                <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.discountTotal, values.currency)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-sm text-slate-600 dark:text-slate-300">Tax</span>
                <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.taxTotal, values.currency)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950">
                <span className="text-sm font-medium">Grand total</span>
                <span className="text-lg font-semibold">{formatCurrency(summary.grandTotal, values.currency)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Commercial note</p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Use this worksheet to assemble a customer-ready quote with line-level pricing, taxes, discounts, and approval-ready terms.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
        <QuotationLineItemsEditor
          items={values.line_items}
          currency={values.currency}
          onChange={updateLineItems}
        />
        {fieldErrors.line_items ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{fieldErrors.line_items}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400"><CalendarDays className="h-4 w-4" />Additional sections</div>
          <div className="mt-5 grid gap-5">
            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Notes</span>
              <textarea
                value={values.notes ?? ""}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Client-facing notes or clarifications"
              />
            </label>
            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Internal notes</span>
              <textarea
                value={values.internal_notes ?? ""}
                onChange={(event) => updateField("internal_notes", event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Internal margin, approval, or escalation notes"
              />
            </label>
            <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Terms & conditions</span>
              <textarea
                value={values.terms_and_conditions ?? ""}
                onChange={(event) => updateField("terms_and_conditions", event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Payment schedule, revision policy, and service terms"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400"><BadgePercent className="h-4 w-4" />Attachments</div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">List supporting files, references, or proposal links. Use one item per line or separate with commas.</p>
          <textarea
            value={values.attachments ?? ""}
            onChange={(event) => updateField("attachments", event.target.value)}
            rows={10}
            className="mt-4 w-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Proposal deck.pdf\nSOW-redline.docx\nPricing appendix.xlsx"
          />
        </div>
      </section>

      {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : mode === "edit" ? "Save quotation" : "Create quotation"}
        </Button>
      </div>
    </Form>
  );
}

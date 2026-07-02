"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STAGES,
  leadSchema,
  type Lead,
  type LeadFormValues,
} from "@/src/modules/leads/lead-types";
import { createLead, updateLead } from "@/src/modules/leads/lead-client";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface LeadFormProps {
  lead?: Lead;
  companies: Company[];
  contacts: Contact[];
  mode?: "create" | "edit";
  onSaved?: () => void;
  onError?: (message: string) => void;
}

const emptyValues: LeadFormValues = {
  title: "",
  company_id: undefined,
  contact_id: undefined,
  assigned_salesperson: undefined,
  source: undefined,
  stage: "New",
  priority: "Medium",
  expected_revenue: undefined,
  probability: undefined,
  next_follow_up_date: undefined,
  notes: undefined,
  tags: undefined,
};

function normalizeLeadToValues(lead?: Lead): LeadFormValues {
  if (!lead) {
    return emptyValues;
  }

  return {
    title: lead.title ?? lead.name ?? "",
    company_id: lead.company_id,
    contact_id: lead.contact_id,
    assigned_salesperson: lead.assigned_salesperson,
    source: lead.source,
    stage: lead.stage,
    priority: lead.priority,
    expected_revenue: lead.expected_revenue,
    probability: lead.probability,
    next_follow_up_date: lead.next_follow_up_date,
    notes: lead.notes,
    tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : lead.tags,
  };
}

export function LeadForm({
  lead,
  companies,
  contacts,
  mode = "create",
  onSaved,
  onError,
}: LeadFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<LeadFormValues>(normalizeLeadToValues(lead));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const updateField = (name: keyof LeadFormValues, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value === "" ? undefined : value,
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = leadSchema.safeParse(values);
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
      const payload = result.data;
      if (mode === "edit" && lead?.id) {
        const { error } = await updateLead(lead.id, payload);
        if (error) {
          setFormError(error.message);
          onError?.(error.message);
          setIsSaving(false);
          return;
        }
      } else {
        const { error } = await createLead(payload);
        if (error) {
          setFormError(error.message);
          onError?.(error.message);
          setIsSaving(false);
          return;
        }
      }

      if (onSaved) {
        onSaved();
      } else if (lead?.id) {
        router.push(`/leads/${lead.id}`);
      } else {
        router.push("/leads");
      }
    } catch (error) {
      const message = (error as Error).message ?? "Unable to save lead.";
      setFormError(message);
      onError?.(message);
      setIsSaving(false);
    }
  };

  const contactOptions = contacts.filter((contact) => {
    if (!values.company_id) {
      return true;
    }
    return !contact.company_id || contact.company_id === values.company_id;
  });

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Lead title"
          name="title"
          value={values.title}
          error={fieldErrors.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Acme Corp - Q4 Campaign"
          required
        />

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Lead stage</span>
          <select
            value={values.stage ?? ""}
            onChange={(event) => updateField("stage", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select stage</option>
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          {fieldErrors.stage ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.stage}</span> : null}
        </label>

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Assign company</span>
          <select
            value={values.company_id ?? ""}
            onChange={(event) => updateField("company_id", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Unassigned</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          {fieldErrors.company_id ? (
            <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.company_id}</span>
          ) : null}
        </label>

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Assign contact</span>
          <select
            value={values.contact_id ?? ""}
            onChange={(event) => updateField("contact_id", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Unassigned</option>
            {contactOptions.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name || contact.email || contact.id}
              </option>
            ))}
          </select>
          {fieldErrors.contact_id ? (
            <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.contact_id}</span>
          ) : null}
        </label>

        <Input
          label="Assigned salesperson"
          name="assigned_salesperson"
          value={values.assigned_salesperson ?? ""}
          error={fieldErrors.assigned_salesperson}
          onChange={(event) => updateField("assigned_salesperson", event.target.value)}
          placeholder="Jordan Smith"
        />

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Lead source</span>
          <select
            value={values.source ?? ""}
            onChange={(event) => updateField("source", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select source</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          {fieldErrors.source ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.source}</span> : null}
        </label>

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Priority</span>
          <select
            value={values.priority ?? ""}
            onChange={(event) => updateField("priority", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select priority</option>
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          {fieldErrors.priority ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.priority}</span> : null}
        </label>

        <Input
          label="Expected revenue"
          name="expected_revenue"
          type="number"
          value={values.expected_revenue?.toString() ?? ""}
          error={fieldErrors.expected_revenue}
          onChange={(event) => updateField("expected_revenue", event.target.value)}
          placeholder="25000"
        />

        <Input
          label="Probability %"
          name="probability"
          type="number"
          min={0}
          max={100}
          value={values.probability?.toString() ?? ""}
          error={fieldErrors.probability}
          onChange={(event) => updateField("probability", event.target.value)}
          placeholder="70"
        />

        <Input
          label="Next follow-up date"
          name="next_follow_up_date"
          type="date"
          value={values.next_follow_up_date ?? ""}
          error={fieldErrors.next_follow_up_date}
          onChange={(event) => updateField("next_follow_up_date", event.target.value)}
        />

        <Input
          label="Tags"
          name="tags"
          value={values.tags ?? ""}
          error={fieldErrors.tags}
          onChange={(event) => updateField("tags", event.target.value)}
          placeholder="enterprise, warm, q4"
        />
      </div>

      <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>Notes</span>
        <textarea
          value={values.notes ?? ""}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Discovery summary, objections, next action items..."
        />
        {fieldErrors.notes ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.notes}</span> : null}
      </label>

      {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
          {isSaving ? "Saving..." : mode === "edit" ? "Save changes" : "Create lead"}
        </Button>
      </div>
    </Form>
  );
}

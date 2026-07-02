"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { contactSchema, type Contact, type ContactFormValues } from "@/src/modules/contacts/contact-types";
import { createContact, updateContact } from "@/src/modules/contacts/contact-client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Company } from "@/src/modules/companies/company-types";

interface ContactFormProps {
  contact?: Contact;
  companies: Company[];
  mode?: "create" | "edit";
  onSaved?: () => void;
  onError?: (message: string) => void;
}

const emptyValues: ContactFormValues = {
  name: "",
  email: undefined,
  phone: undefined,
  position: undefined,
  status: undefined,
  company_id: undefined,
  notes: undefined
};

export function ContactForm({ contact, companies, mode = "create", onSaved, onError }: ContactFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<ContactFormValues>(contact ? { ...contact } : emptyValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const updateField = (name: keyof ContactFormValues, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value === "" ? undefined : value
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = contactSchema.safeParse(values);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errors).map(([key, value]) => [key, value?.[0] ?? ""])
        ) as Record<string, string>
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = result.data;
      if (mode === "edit" && contact?.id) {
        const { error } = await updateContact(contact.id, payload);
        if (error) {
          setFormError(error.message);
          onError?.(error.message);
          setIsSaving(false);
          return;
        }
      } else {
        const { error } = await createContact(payload);
        if (error) {
          setFormError(error.message);
          onError?.(error.message);
          setIsSaving(false);
          return;
        }
      }

      if (onSaved) {
        onSaved();
      } else if (contact?.id) {
        router.push(`/contacts/${contact.id}`);
      } else {
        router.push("/contacts");
      }
    } catch (error) {
      const message = (error as Error).message ?? "Unable to save contact.";
      setFormError(message);
      onError?.(message);
      setIsSaving(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Contact name"
          name="name"
          value={values.name}
          error={fieldErrors.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Example: Ava Thompson"
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={values.email ?? ""}
          error={fieldErrors.email}
          onChange={(event) => updateField("email", event.target.value)}
          placeholder="ava@example.com"
        />

        <Input
          label="Phone"
          name="phone"
          value={values.phone ?? ""}
          error={fieldErrors.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          placeholder="+1 555 010 222"
        />

        <Input
          label="Position"
          name="position"
          value={values.position ?? ""}
          error={fieldErrors.position}
          onChange={(event) => updateField("position", event.target.value)}
          placeholder="Marketing Manager"
        />

        <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Contact status</span>
          <select
            value={values.status ?? ""}
            onChange={(event) => updateField("status", event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select status</option>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {fieldErrors.status ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.status}</span> : null}
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
          {fieldErrors.company_id ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.company_id}</span> : null}
        </label>
      </div>

      <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>Notes</span>
        <textarea
          value={values.notes ?? ""}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Internal notes, call outcomes, follow-up reminders..."
        />
        {fieldErrors.notes ? <span className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.notes}</span> : null}
      </label>

      {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
          {isSaving ? "Saving..." : mode === "edit" ? "Save changes" : "Create contact"}
        </Button>
      </div>
    </Form>
  );
}

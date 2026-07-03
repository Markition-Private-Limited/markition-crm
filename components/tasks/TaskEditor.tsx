"use client";

import * as React from "react";
import { Button, Input, Modal } from "@/components/ui";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Lead } from "@/src/modules/leads/lead-types";
import type { Quotation } from "@/src/modules/quotations/quotation-types";
import type { Contract } from "@/src/modules/contracts/contract-types";
import {
  DEFAULT_TASK_STATUS,
  parseTextList,
  TASK_PRIORITIES,
  type Task,
  type TaskFormValues,
} from "@/src/modules/tasks/task-types";
import { getStatusList } from "@/src/lib/workflows";

type TaskEditorProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  initialTask?: Task | null;
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  quotations: Quotation[];
  contracts: Contract[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
};

type FormState = {
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  followers: string;
  labels: string;
  due_date: string;
  start_date: string;
  estimated_hours: string;
  actual_hours: string;
  company_id: string;
  contact_id: string;
  lead_id: string;
  quotation_id: string;
  contract_id: string;
};

function toFormState(task?: Task | null): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? DEFAULT_TASK_STATUS,
    priority: task?.priority ?? "Medium",
    assignee: task?.assignee ?? "",
    reporter: task?.reporter ?? "",
    followers: (task?.followers ?? []).join(", "),
    labels: (task?.labels ?? []).join(", "),
    due_date: task?.due_date ?? "",
    start_date: task?.start_date ?? "",
    estimated_hours:
      task?.estimated_hours === undefined ? "" : String(task.estimated_hours),
    actual_hours: task?.actual_hours === undefined ? "" : String(task.actual_hours),
    company_id: task?.company_id ?? "",
    contact_id: task?.contact_id ?? "",
    lead_id: task?.lead_id ?? "",
    quotation_id: task?.quotation_id ?? "",
    contract_id: task?.contract_id ?? "",
  };
}

export function TaskEditor({
  open,
  title,
  submitLabel,
  initialTask,
  companies,
  contacts,
  leads,
  quotations,
  contracts,
  onClose,
  onSubmit,
}: TaskEditorProps) {
  const [form, setForm] = React.useState<FormState>(() => toFormState(initialTask));
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(toFormState(initialTask));
      setError(null);
      setIsSaving(false);
    }
  }, [initialTask, open]);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const statusOptions = getStatusList("tasks");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const estimated = form.estimated_hours ? Number(form.estimated_hours) : undefined;
      const actual = form.actual_hours ? Number(form.actual_hours) : undefined;

      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status || DEFAULT_TASK_STATUS,
        priority: (form.priority || "Medium") as TaskFormValues["priority"],
        assignee: form.assignee || undefined,
        reporter: form.reporter || undefined,
        followers: parseTextList(form.followers),
        labels: parseTextList(form.labels),
        due_date: form.due_date || undefined,
        start_date: form.start_date || undefined,
        estimated_hours: estimated,
        actual_hours: actual,
        time_tracking: {
          estimated: estimated ?? 0,
          tracked: actual ?? 0,
          remaining: Math.max((estimated ?? 0) - (actual ?? 0), 0),
          timer_placeholder: true,
        },
        company_id: form.company_id || undefined,
        contact_id: form.contact_id || undefined,
        lead_id: form.lead_id || undefined,
        quotation_id: form.quotation_id || undefined,
        contract_id: form.contract_id || undefined,
        checklist: initialTask?.checklist ?? [],
        comments: initialTask?.comments ?? [],
        attachments: initialTask?.attachments ?? [],
        dependencies: initialTask?.dependencies ?? [],
      });
      onClose();
    } catch (submitError) {
      setError((submitError as Error).message || "Failed to save task.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      description="Create structured work with dependencies, time expectations, and linked CRM records."
      onClose={onClose}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Title" value={form.title} onChange={(event) => update("title", event.target.value)} required />
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Status</span>
            <select
              className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              value={form.status}
              onChange={(event) => update("status", event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          <span>Description</span>
          <textarea
            className="min-h-28 rounded-[16px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Define scope, acceptance criteria, and context."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Priority</span>
            <select
              className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              value={form.priority}
              onChange={(event) => update("priority", event.target.value)}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <Input label="Assignee" value={form.assignee} onChange={(event) => update("assignee", event.target.value)} placeholder="You" />
          <Input label="Reporter" value={form.reporter} onChange={(event) => update("reporter", event.target.value)} placeholder="Sales Ops" />
          <Input label="Followers" value={form.followers} onChange={(event) => update("followers", event.target.value)} placeholder="comma separated" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Company</span>
            <select className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm" value={form.company_id} onChange={(event) => update("company_id", event.target.value)}>
              <option value="">None</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Contact</span>
            <select className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm" value={form.contact_id} onChange={(event) => update("contact_id", event.target.value)}>
              <option value="">None</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name || contact.email || contact.id}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Lead</span>
            <select className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm" value={form.lead_id} onChange={(event) => update("lead_id", event.target.value)}>
              <option value="">None</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.title || lead.name || lead.id}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Quotation</span>
            <select className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm" value={form.quotation_id} onChange={(event) => update("quotation_id", event.target.value)}>
              <option value="">None</option>
              {quotations.map((quotation) => (
                <option key={quotation.id} value={quotation.id}>{quotation.quotation_number || quotation.id}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Contract</span>
            <select className="h-10 rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm" value={form.contract_id} onChange={(event) => update("contract_id", event.target.value)}>
              <option value="">None</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>{contract.contract_number || contract.id}</option>
              ))}
            </select>
          </label>
          <Input label="Labels" value={form.labels} onChange={(event) => update("labels", event.target.value)} placeholder="ops, billing" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Input label="Start Date" type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
          <Input label="Due Date" type="date" value={form.due_date} onChange={(event) => update("due_date", event.target.value)} />
          <Input label="Estimated Hours" type="number" min={0} step={0.25} value={form.estimated_hours} onChange={(event) => update("estimated_hours", event.target.value)} />
          <Input label="Actual Hours" type="number" min={0} step={0.25} value={form.actual_hours} onChange={(event) => update("actual_hours", event.target.value)} />
        </div>

        {error ? <p className="rounded-[12px] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

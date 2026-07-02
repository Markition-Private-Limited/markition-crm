"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LeadForm } from "@/components/leads/LeadForm";
import { deleteLead } from "@/src/modules/leads/lead-client";
import type { Lead } from "@/src/modules/leads/lead-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";

interface LeadProfileProps {
  lead: Lead;
  companies: Company[];
  contacts: Contact[];
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function getStageBadge(stage?: string) {
  const value = stage ?? "Unknown";
  const normalized = value.toLowerCase();

  if (normalized.includes("won")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (normalized.includes("lost")) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  }
  if (normalized.includes("negotiation")) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  if (normalized.includes("proposal")) {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function LeadProfile({ lead, companies, contacts }: LeadProfileProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const router = useRouter();

  const company = companies.find((item) => item.id === lead.company_id);
  const contact = contacts.find((item) => item.id === lead.contact_id);

  const timeline = [
    {
      label: "Lead created",
      date: lead.created_at,
      detail: "Lead record entered into the pipeline",
    },
    {
      label: "Next follow-up",
      date: lead.next_follow_up_date,
      detail: lead.next_follow_up_date ? "Scheduled follow-up checkpoint" : "Not scheduled yet",
    },
    {
      label: "Last updated",
      date: lead.updated_at,
      detail: "Most recent lead update",
    },
  ];

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this lead? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    const { error } = await deleteLead(lead.id);
    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
      return;
    }

    router.push("/leads");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Lead profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{lead.title || lead.name || "Untitled lead"}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${getStageBadge(lead.stage)}`}>
              {lead.stage || "Unknown"}
            </span>
            {lead.priority ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {lead.priority}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? "Close editor" : "Edit lead"}
          </Button>
          <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete lead"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Lead details</p>
          <div className="space-y-2 text-slate-700 dark:text-slate-300">
            <p>Company: {company ? <Link href={`/companies/${company.id}`} className="text-sky-600 hover:underline dark:text-sky-400">{company.name}</Link> : "Unassigned"}</p>
            <p>Contact: {contact ? <Link href={`/contacts/${contact.id}`} className="text-sky-600 hover:underline dark:text-sky-400">{contact.name || contact.email || contact.id}</Link> : "Unassigned"}</p>
            <p>Salesperson: {lead.assigned_salesperson || "Unassigned"}</p>
            <p>Source: {lead.source || "—"}</p>
            <p>Expected revenue: {lead.expected_revenue ? `$${Number(lead.expected_revenue).toLocaleString()}` : "—"}</p>
            <p>Probability: {lead.probability !== undefined ? `${lead.probability}%` : "—"}</p>
            <p>Next follow-up: {formatDate(lead.next_follow_up_date)}</p>
            <p>Tags: {Array.isArray(lead.tags) ? lead.tags.join(", ") : lead.tags || "—"}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Activity timeline</p>
          <div className="space-y-4">
            {timeline.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.date)}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lead.notes ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:shadow-none">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notes</p>
          <p className="whitespace-pre-wrap">{lead.notes}</p>
        </div>
      ) : null}

      {errorMessage ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{errorMessage}</div> : null}

      {isEditing ? (
        <LeadForm
          lead={lead}
          companies={companies}
          contacts={contacts}
          mode="edit"
          onSaved={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

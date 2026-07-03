"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Building2, CalendarDays, Copy, Download, Edit3, FileText, Mail, Paperclip, Printer, Send, Trash2, Wand2, Clock3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { QuotationStatusBadge } from "@/components/quotations/QuotationStatusBadge";
import {
  archiveQuotation,
  createQuotation,
  deleteQuotation,
  updateQuotationStatus,
} from "@/src/modules/quotations/quotation-client";
import {
  calculateQuotationSummary,
  formatCurrency,
  formatQuotationDate,
  parseTextList,
  quotationSchema,
  quotationToDraft,
  type Quotation,
  type QuotationActivityEntry,
} from "@/src/modules/quotations/quotation-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";

interface QuotationProfileProps {
  quotation: Quotation;
  companies: Company[];
  contacts: Contact[];
}

type Toast = { id: number; title: string; description?: string; tone: "success" | "error" };

function resolveLineItems(quotation: Quotation) {
  if (Array.isArray(quotation.line_items)) {
    return quotation.line_items;
  }

  try {
    return JSON.parse(quotation.line_items ?? "[]") as NonNullable<Quotation["line_items"]>;
  } catch {
    return [];
  }
}

function resolveActivityLog(quotation: Quotation) {
  if (Array.isArray(quotation.activity_log)) {
    return quotation.activity_log;
  }

  try {
    return JSON.parse(quotation.activity_log ?? "[]") as QuotationActivityEntry[];
  } catch {
    return [];
  }
}

function resolveTimeline(quotation: Quotation) {
  if (Array.isArray(quotation.timeline)) {
    return quotation.timeline;
  }

  const entries: QuotationActivityEntry[] = [];
  if (quotation.created_at) {
    entries.push({ label: "Created", detail: "Quotation record opened", at: quotation.created_at });
  }
  if (quotation.status) {
    entries.push({ label: `Status: ${quotation.status}`, detail: "Document lifecycle update", at: quotation.updated_at || quotation.created_at || new Date().toISOString() });
  }
  if (quotation.expiry_date) {
    entries.push({ label: "Expiry date", detail: "Quote validity checkpoint", at: quotation.expiry_date });
  }
  return entries;
}

function getCompanyName(quotation: Quotation, companies: Company[]) {
  return companies.find((company) => company.id === quotation.client_company_id)?.name || "Unassigned";
}

function getContact(quotation: Quotation, contacts: Contact[]) {
  return contacts.find((contact) => contact.id === quotation.contact_id) ?? null;
}

function formatActionTone(quotation: Quotation) {
  if (quotation.archived) {
    return "Archived";
  }
  return String(quotation.status ?? "Draft");
}

export function QuotationProfile({ quotation, companies, contacts }: QuotationProfileProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const lineItems = resolveLineItems(quotation) as any[];
  const summary = calculateQuotationSummary(lineItems);
  const contact = getContact(quotation, contacts);
  const attachments = parseTextList(quotation.attachments);
  const activityLog = resolveActivityLog(quotation);
  const timeline = resolveTimeline(quotation);

  const handleDuplicate = async () => {
    setBusyAction("duplicate");
    const draft = quotationToDraft(quotation, true);
    const parsed = quotationSchema.safeParse(draft);
    if (!parsed.success) {
      addToast({ tone: "error", title: "Duplicate failed", description: "The quotation draft could not be cloned." });
      setBusyAction(null);
      return;
    }

    const { data, error } = await createQuotation(parsed.data);
    if (error) {
      addToast({ tone: "error", title: "Duplicate failed", description: error.message });
      setBusyAction(null);
      return;
    }

    addToast({ tone: "success", title: "Quotation duplicated", description: "A fresh draft has been created." });
    setBusyAction(null);
    if (data?.id) {
      router.push(`/quotations/${data.id}`);
    }
  };

  const handleSend = async () => {
    setBusyAction("send");
    const { error } = await updateQuotationStatus(quotation.id, "Sent");
    if (error) {
      addToast({ tone: "error", title: "Send failed", description: error.message });
    } else {
      addToast({ tone: "success", title: "Quotation sent", description: "The quote was marked as sent." });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleArchive = async () => {
    setBusyAction("archive");
    const { error } = await archiveQuotation(quotation.id, !quotation.archived);
    if (error) {
      addToast({ tone: "error", title: "Archive failed", description: error.message });
    } else {
      addToast({ tone: "success", title: quotation.archived ? "Quotation restored" : "Quotation archived" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this quotation? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setBusyAction("delete");
    const { error } = await deleteQuotation(quotation.id);
    if (error) {
      addToast({ tone: "error", title: "Delete failed", description: error.message });
      setBusyAction(null);
      return;
    }

    router.push("/quotations");
  };

  const handleDownloadPdf = () => {
    window.print();
    addToast({ tone: "success", title: "Print dialog opened", description: "Use your browser's PDF save option to download the quote." });
  };

  const handleConvertToContract = () => {
    addToast({ tone: "success", title: "Queued for contract handoff", description: "Contract creation remains in the contracts workflow." });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quotation detail</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{quotation.quotation_number || "Untitled quotation"}</h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Document style view for the commercial team, client stakeholders, and approval trail.</p>
            </div>
            <QuotationStatusBadge status={quotation.status} archived={quotation.archived} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Quotation date", formatQuotationDate(quotation.quotation_date)],
              ["Expiry date", formatQuotationDate(quotation.expiry_date)],
              ["Reference", quotation.reference_number || "—"],
              ["Sales rep", quotation.sales_representative || "Unassigned"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Building2 className="h-4 w-4" />Client company</div>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{getCompanyName(quotation, companies)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Mail className="h-4 w-4" />Contact person</div>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{contact?.name || contact?.email || "Unassigned"}</p>
              {contact?.email ? <a href={`mailto:${contact.email}`} className="mt-1 block text-sm text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-300">{contact.email}</a> : null}
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Actions</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
              <Edit3 className="h-4 w-4" />
              {isEditing ? "Close editor" : "Edit quotation"}
            </Button>
            <Button variant="secondary" onClick={handleDuplicate} disabled={busyAction === "duplicate"}>
              <Copy className="h-4 w-4" />
              {busyAction === "duplicate" ? "Duplicating..." : "Duplicate"}
            </Button>
            <Button variant="secondary" onClick={handleSend} disabled={busyAction === "send"}>
              <Send className="h-4 w-4" />
              {busyAction === "send" ? "Sending..." : "Email quote"}
            </Button>
            <Button variant="secondary" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" onClick={handleConvertToContract}>
              <Wand2 className="h-4 w-4" />
              Convert to contract
            </Button>
            <Button variant="ghost" onClick={handleArchive} disabled={busyAction === "archive"}>
              <Archive className="h-4 w-4" />
              {quotation.archived ? "Restore" : "Archive"}
            </Button>
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleDelete} disabled={busyAction === "delete"}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Clock3 className="h-4 w-4" />Lifecycle</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Current state: <span className="font-semibold text-slate-950 dark:text-slate-50">{formatActionTone(quotation)}</span></p>
              <p>Grand total: <span className="font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.grandTotal, quotation.currency || "USD")}</span></p>
              <p>Line items: <span className="font-semibold text-slate-950 dark:text-slate-50">{lineItems.length}</span></p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Document preview</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{quotation.quotation_number || "Quote"}</h2>
            </div>
            <p className="text-right text-sm text-slate-600 dark:text-slate-300">{quotation.currency || "USD"}</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Client information</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-950 dark:text-slate-50">{getCompanyName(quotation, companies)}</p>
                <p>{contact?.name || "No contact assigned"}</p>
                <p>{contact?.email || "No email available"}</p>
                <p>{contact?.phone || "No phone available"}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Company information</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-950 dark:text-slate-50">{quotation.sales_representative || "Unassigned rep"}</p>
                <p>{quotation.reference_number || "No reference number"}</p>
                <p>Issued on {formatQuotationDate(quotation.quotation_date)}</p>
                <p>Expires on {formatQuotationDate(quotation.expiry_date)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Item</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Qty</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Unit</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Discount</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Tax</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {lineItems.map((item, index) => (
                  <tr key={`${item.item_name}-${index}`}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-slate-950 dark:text-slate-50">{item.item_name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description || "No description"}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{item.quantity}</td>
                    <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatCurrency(item.unit_price, quotation.currency || "USD")}</td>
                    <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{item.discount}%</td>
                    <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{item.tax}%</td>
                    <td className="px-4 py-4 align-top font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(calculateQuotationSummary([item]).grandTotal, quotation.currency || "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Subtotal</p><p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.subtotal, quotation.currency || "USD")}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Discount</p><p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.discountTotal, quotation.currency || "USD")}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Tax</p><p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(summary.taxTotal, quotation.currency || "USD")}</p></div>
            <div className="rounded-2xl border border-slate-950 bg-slate-950 p-4 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"><p className="text-xs uppercase tracking-[0.16em] opacity-80">Grand total</p><p className="mt-2 text-lg font-semibold">{formatCurrency(summary.grandTotal, quotation.currency || "USD")}</p></div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Terms & conditions</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{quotation.terms_and_conditions || "No terms provided."}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{quotation.notes || "No client notes provided."}</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Timeline & files</h3>
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div key={`${entry.label}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{entry.label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail || formatQuotationDate(entry.at)}</p>
              </div>
            ))}
            {timeline.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Timeline entries will appear here as the quotation moves through review.</p> : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Paperclip className="h-4 w-4" />Files</div>
            <div className="mt-3 space-y-2">
              {attachments.length > 0 ? attachments.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">{item}</div>
              )) : <p className="text-sm text-slate-500 dark:text-slate-400">No attachment files listed.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><CheckCircle2 className="h-4 w-4" />Activity log</div>
            <div className="mt-3 space-y-2">
              {activityLog.length > 0 ? activityLog.map((entry) => (
                <div key={`${entry.label}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail || formatQuotationDate(entry.at)}</p>
                </div>
              )) : <p className="text-sm text-slate-500 dark:text-slate-400">No activity captured yet.</p>}
            </div>
          </div>
        </aside>
      </section>

      {isEditing ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <QuotationForm
            quotation={quotation}
            companies={companies}
            contacts={contacts}
            mode="edit"
            draftKey={`quotation-edit-${quotation.id}`}
            onSaved={() => {
              setIsEditing(false);
              router.refresh();
            }}
          />
        </section>
      ) : null}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-lg ${toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"}`}>
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

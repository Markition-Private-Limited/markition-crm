"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, Copy, Download, Edit3, FileSignature, Mail, Paperclip, Printer, RotateCcw, Send, ShieldAlert, Trash2, Upload, MessageSquareMore, Clock3, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractForm } from "@/components/contracts/ContractForm";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import {
  appendContractComment,
  archiveContract,
  createContract,
  deleteContract,
  renewContract,
  terminateContract,
  updateContractStatus,
} from "@/src/modules/contracts/contract-client";
import {
  contractSchema,
  contractToDraft,
  daysUntil,
  formatCurrency,
  formatContractDate,
  parseTextList,
  type Contract,
  type ContractActivityEntry,
  type ContractCommentEntry,
  type ContractVersionEntry,
} from "@/src/modules/contracts/contract-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Quotation } from "@/src/modules/quotations/quotation-types";

interface ContractProfileProps {
  contract: Contract;
  companies: Company[];
  contacts: Contact[];
  quotations: Quotation[];
}

type Toast = { id: number; title: string; description?: string; tone: "success" | "error" };

function resolveActivityLog(contract: Contract) {
  if (Array.isArray(contract.activity_log)) {
    return contract.activity_log;
  }
  try {
    return JSON.parse(contract.activity_log ?? "[]") as ContractActivityEntry[];
  } catch {
    return [];
  }
}

function resolveTimeline(contract: Contract) {
  if (Array.isArray(contract.timeline)) {
    return contract.timeline;
  }
  const entries: ContractActivityEntry[] = [];
  if (contract.created_at) {
    entries.push({ label: "Contract created", detail: "Record entered into agreement control room", at: contract.created_at });
  }
  if (contract.status) {
    entries.push({ label: `Status: ${contract.status}`, detail: "Workflow state updated", at: contract.updated_at || contract.created_at || new Date().toISOString() });
  }
  if (contract.end_date) {
    entries.push({ label: "End date", detail: "Renewal and expiry checkpoint", at: contract.end_date });
  }
  return entries;
}

function resolveRenewalHistory(contract: Contract) {
  if (Array.isArray(contract.renewal_history)) {
    return contract.renewal_history;
  }
  try {
    return JSON.parse(contract.renewal_history ?? "[]") as ContractVersionEntry[];
  } catch {
    return [];
  }
}

function resolveVersionHistory(contract: Contract) {
  if (Array.isArray(contract.version_history)) {
    return contract.version_history;
  }
  try {
    return JSON.parse(contract.version_history ?? "[]") as ContractVersionEntry[];
  } catch {
    return [];
  }
}

function resolveComments(contract: Contract) {
  if (Array.isArray(contract.comments)) {
    return contract.comments;
  }
  try {
    return JSON.parse(contract.comments ?? "[]") as ContractCommentEntry[];
  } catch {
    return [];
  }
}

function getCompanyName(contract: Contract, companies: Company[]) {
  return companies.find((company) => company.id === contract.company_id)?.name || "Unassigned";
}

function getContactName(contract: Contract, contacts: Contact[]) {
  return contacts.find((contact) => contact.id === contract.contact_id)?.name || "Unassigned";
}

function formatWorkflowState(contract: Contract) {
  if (contract.archived) {
    return "Archived";
  }
  return String(contract.status ?? "Draft");
}

export function ContractProfile({ contract, companies, contacts, quotations }: ContractProfileProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [commentBody, setCommentBody] = React.useState("");
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const activityLog = resolveActivityLog(contract);
  const timeline = resolveTimeline(contract);
  const renewalHistory = resolveRenewalHistory(contract);
  const versionHistory = resolveVersionHistory(contract);
  const comments = resolveComments(contract);
  const attachments = parseTextList(contract.attachments);
  const daysLeft = daysUntil(contract.end_date);

  const handleDuplicate = async () => {
    setBusyAction("duplicate");
    const draft = contractToDraft(contract, true);
    const parsed = contractSchema.safeParse(draft);
    if (!parsed.success) {
      addToast({ tone: "error", title: "Duplicate failed", description: "The contract draft could not be cloned." });
      setBusyAction(null);
      return;
    }

    const { data, error } = await createContract(parsed.data);
    if (error) {
      addToast({ tone: "error", title: "Duplicate failed", description: error.message });
      setBusyAction(null);
      return;
    }

    addToast({ tone: "success", title: "Contract duplicated", description: "A fresh draft has been created." });
    setBusyAction(null);
    if (data?.id) {
      router.push(`/contracts/${data.id}`);
    }
  };

  const handleSend = async () => {
    setBusyAction("send");
    const { error } = await updateContractStatus(contract.id, "Pending Signature");
    if (error) {
      addToast({ tone: "error", title: "Send failed", description: error.message });
    } else {
      addToast({ tone: "success", title: "Contract sent", description: "Moved to pending signature." });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleArchive = async () => {
    setBusyAction("archive");
    const { error } = await archiveContract(contract.id, !contract.archived);
    if (error) {
      addToast({ tone: "error", title: "Archive failed", description: error.message });
    } else {
      addToast({ tone: "success", title: contract.archived ? "Contract restored" : "Contract archived" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleTerminate = async () => {
    setBusyAction("terminate");
    const confirmed = window.confirm("Terminate this contract? This will mark the agreement as terminated.");
    if (!confirmed) {
      setBusyAction(null);
      return;
    }
    const { error } = await terminateContract(contract.id);
    if (error) {
      addToast({ tone: "error", title: "Terminate failed", description: error.message });
    } else {
      addToast({ tone: "success", title: "Contract terminated" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleRenew = async () => {
    setBusyAction("renew");
    const { error } = await renewContract(contract.id);
    if (error) {
      addToast({ tone: "error", title: "Renew failed", description: error.message });
    } else {
      addToast({ tone: "success", title: "Contract renewed" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this contract? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setBusyAction("delete");
    const { error } = await deleteContract(contract.id);
    if (error) {
      addToast({ tone: "error", title: "Delete failed", description: error.message });
      setBusyAction(null);
      return;
    }

    router.push("/contracts");
  };

  const handleGeneratePdf = () => {
    window.print();
    addToast({ tone: "success", title: "Print dialog opened", description: "Use the browser save flow to download a PDF." });
  };

  const handleDownload = () => {
    window.print();
    addToast({ tone: "success", title: "Download prepared", description: "Use print save-as-PDF to export the agreement." });
  };

  const handleUploadSignedCopy = () => {
    addToast({ tone: "success", title: "Signed copy upload queued", description: "Wire this action to your file storage provider if needed." });
  };

  const handleAddComment = async () => {
    const body = commentBody.trim();
    if (!body) {
      return;
    }

    setBusyAction("comment");
    const { error } = await appendContractComment(contract.id, {
      author: "Markition user",
      body,
      at: new Date().toISOString(),
    });

    if (error) {
      addToast({ tone: "error", title: "Comment failed", description: error.message });
    } else {
      addToast({ tone: "success", title: "Comment added" });
      setCommentBody("");
      router.refresh();
    }

    setBusyAction(null);
  };

  const selectedQuotation = quotations.find((quotation) => quotation.id === contract.related_quotation_id);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.6fr_360px] print:grid-cols-1">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contract detail</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{contract.contract_number || "Untitled contract"}</h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Professional document interface for the signed agreement lifecycle.</p>
            </div>
            <ContractStatusBadge status={contract.status} archived={contract.archived} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Contract value", formatCurrency(Number(contract.contract_value ?? 0), contract.currency || "USD")],
              ["Start date", formatContractDate(contract.start_date)],
              ["End date", formatContractDate(contract.end_date)],
              ["Renewal window", daysLeft === null ? "No end date" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
              <Edit3 className="h-4 w-4" />
              {isEditing ? "Close editor" : "Edit contract"}
            </Button>
            <Button variant="secondary" onClick={handleDuplicate} disabled={busyAction === "duplicate"}>
              <Copy className="h-4 w-4" />
              {busyAction === "duplicate" ? "Duplicating..." : "Duplicate"}
            </Button>
            <Button variant="secondary" onClick={handleSend} disabled={busyAction === "send"}>
              <Send className="h-4 w-4" />
              {busyAction === "send" ? "Sending..." : "Pending signature"}
            </Button>
            <Button variant="secondary" onClick={handleRenew} disabled={busyAction === "renew"}>
              <RotateCcw className="h-4 w-4" />
              Renew
            </Button>
            <Button variant="secondary" onClick={handleUploadSignedCopy}>
              <Upload className="h-4 w-4" />
              Upload signed copy
            </Button>
            <Button variant="ghost" onClick={handleGeneratePdf}>
              <Download className="h-4 w-4" />
              Generate PDF
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="ghost" onClick={handleArchive} disabled={busyAction === "archive"}>
              <Archive className="h-4 w-4" />
              {contract.archived ? "Restore" : "Archive"}
            </Button>
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleTerminate} disabled={busyAction === "terminate"}>
              <ShieldAlert className="h-4 w-4" />
              Terminate
            </Button>
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleDelete} disabled={busyAction === "delete"}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <aside className="sticky top-24 h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7 print:static">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Sticky contract sidebar</p>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Client</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{getCompanyName(contract, companies)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Contact</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{getContactName(contract, contacts)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Assigned manager</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{contract.sales_representative || "Unassigned"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Workflow</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{formatWorkflowState(contract)}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{contract.auto_renewal ? "Auto renewal enabled" : "Manual renewal review"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Related quotation</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{selectedQuotation?.quotation_number || "No quotation linked"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Renewal reminder</p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{formatContractDate(contract.renewal_reminder_date)}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr] print:grid-cols-1">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7 print:shadow-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"><ListChecks className="h-4 w-4" />Summary</div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Commercial summary</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{contract.scope_of_work || contract.notes || "No commercial summary available."}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Legal summary</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{contract.terms || contract.payment_terms || contract.confidentiality || "No legal summary available."}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Timeline</p>
              <div className="mt-3 space-y-2">
                {timeline.map((entry) => (
                  <div key={`${entry.label}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail || formatContractDate(entry.at)}</p>
                  </div>
                ))}
                {timeline.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Timeline will populate as the agreement progresses.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Activity</p>
              <div className="mt-3 space-y-2">
                {activityLog.slice(0, 5).map((entry) => (
                  <div key={`${entry.label}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail || formatContractDate(entry.at)}</p>
                  </div>
                ))}
                {activityLog.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Activity log will appear here as the contract is processed.</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Paperclip className="h-4 w-4" />Attached files</div>
              <div className="mt-3 space-y-2">
                {attachments.length > 0 ? attachments.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{item}</div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">No files attached.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><CalendarClock className="h-4 w-4" />Renewal history</div>
              <div className="mt-3 space-y-2">
                {renewalHistory.length > 0 ? renewalHistory.map((entry) => (
                  <div key={`${entry.version}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.version}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.note || formatContractDate(entry.at)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">No renewal history captured yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><Clock3 className="h-4 w-4" />Version history</div>
              <div className="mt-3 space-y-2">
                {versionHistory.length > 0 ? versionHistory.map((entry) => (
                  <div key={`${entry.version}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.version}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.note || formatContractDate(entry.at)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">Version history will appear here after revisions.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"><MessageSquareMore className="h-4 w-4" />Comments</div>
              <div className="mt-3 space-y-2">
                {comments.length > 0 ? comments.map((entry) => (
                  <div key={`${entry.at}-${entry.body.slice(0, 12)}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.author || "Team"}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{entry.body}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatContractDate(entry.at)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">No comments added yet.</p>}
              </div>
              <div className="mt-4 space-y-3">
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Add a new comment or approval note"
                />
                <Button onClick={handleAddComment} disabled={busyAction === "comment"}>
                  <MessageSquareMore className="h-4 w-4" />
                  Add comment
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Internal notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{contract.internal_notes || "No internal notes captured yet."}</p>
          </div>
        </div>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7 print:hidden">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Actions</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
              <Edit3 className="h-4 w-4" />
              {isEditing ? "Close editor" : "Edit contract"}
            </Button>
            <Button variant="secondary" onClick={handleDuplicate} disabled={busyAction === "duplicate"}>
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            <Button variant="secondary" onClick={handleSend} disabled={busyAction === "send"}>
              <Mail className="h-4 w-4" />
              Send for signature
            </Button>
            <Button variant="secondary" onClick={handleRenew} disabled={busyAction === "renew"}>
              <RotateCcw className="h-4 w-4" />
              Renew
            </Button>
            <Button variant="secondary" onClick={handleUploadSignedCopy}>
              <Upload className="h-4 w-4" />
              Upload signed copy
            </Button>
            <Button variant="ghost" onClick={handleGeneratePdf}>
              <Download className="h-4 w-4" />
              Generate PDF
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="ghost" onClick={handleArchive} disabled={busyAction === "archive"}>
              <Archive className="h-4 w-4" />
              {contract.archived ? "Restore" : "Archive"}
            </Button>
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleTerminate} disabled={busyAction === "terminate"}>
              <ShieldAlert className="h-4 w-4" />
              Terminate
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Status workflow</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Draft → Under Review → Pending Signature → Active</p>
              <p>Alternative end states: Completed, Expired, or Terminated.</p>
            </div>
          </div>
        </aside>
      </section>

      {isEditing ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6 print:hidden">
          <ContractForm
            contract={contract}
            companies={companies}
            contacts={contacts}
            quotations={quotations}
            mode="edit"
            draftKey={`contract-edit-${contract.id}`}
            onSaved={() => {
              setIsEditing(false);
              router.refresh();
            }}
          />
        </section>
      ) : null}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] space-y-2 print:hidden">
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

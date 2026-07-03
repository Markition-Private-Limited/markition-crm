"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Copy, Eye, FileText, Mail, Plus, Search, Send, Trash2, Printer, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationStatusBadge } from "@/components/quotations/QuotationStatusBadge";
import { archiveQuotation, bulkArchiveQuotations, bulkDeleteQuotations, bulkUpdateQuotationStatus, deleteQuotation } from "@/src/modules/quotations/quotation-client";
import { calculateQuotationSummary, formatCurrency, formatQuotationDate, parseTextList, quotationToDraft, type Quotation, type QuotationActivityEntry } from "@/src/modules/quotations/quotation-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";

const PAGE_SIZE = 8;

type SortMode = "newest" | "oldest" | "value-desc" | "value-asc" | "expiry";
type StatusFilter = "all" | "Draft" | "Sent" | "Viewed" | "Accepted" | "Rejected" | "Expired" | "open";

type Toast = { id: number; title: string; description?: string; tone: "success" | "error" };

interface QuotationModuleProps {
  initialQuotations: Quotation[];
  companies: Company[];
  contacts: Contact[];
  initialSearch?: string;
}

function toLower(value?: string | number | null) {
  return String(value ?? "").toLowerCase();
}

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

function resolveAttachments(quotation: Quotation) {
  return parseTextList(quotation.attachments);
}

function matchesStatusFilter(quotation: Quotation, filter: StatusFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "open") {
    return ["Draft", "Sent", "Viewed"].includes(String(quotation.status ?? "Draft"));
  }

  return String(quotation.status ?? "Draft") === filter;
}

function getQuotationValue(quotation: Quotation) {
  const lineItems = resolveLineItems(quotation) as any[];
  return calculateQuotationSummary(lineItems).grandTotal;
}

function getCompanyName(quotation: Quotation, companies: Company[]) {
  return companies.find((company) => company.id === quotation.client_company_id)?.name || "Unassigned";
}

function getContactName(quotation: Quotation, contacts: Contact[]) {
  return contacts.find((contact) => contact.id === quotation.contact_id)?.name || "Unassigned";
}

export function QuotationModule({ initialQuotations, companies, contacts, initialSearch = "" }: QuotationModuleProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("newest");
  const [page, setPage] = React.useState(1);
  const [selectedQuotationId, setSelectedQuotationId] = React.useState<string | null>(initialQuotations[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

  const companyMap = React.useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies]);
  const contactMap = React.useMemo(() => new Map(contacts.map((contact) => [contact.id, contact.name || contact.email || contact.id])), [contacts]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const filteredQuotations = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = initialQuotations.filter((quotation) => {
      const searchMatch =
        !term ||
        toLower(quotation.quotation_number).includes(term) ||
        toLower(quotation.reference_number).includes(term) ||
        toLower(quotation.sales_representative).includes(term) ||
        toLower(quotation.currency).includes(term) ||
        toLower(getCompanyName(quotation, companies)).includes(term) ||
        toLower(getContactName(quotation, contacts)).includes(term);

      return searchMatch && matchesStatusFilter(quotation, statusFilter) && !quotation.archived;
    });

    return matching.sort((left, right) => {
      const leftValue = getQuotationValue(left);
      const rightValue = getQuotationValue(right);
      const leftDate = new Date(left.quotation_date ?? left.created_at ?? 0).getTime();
      const rightDate = new Date(right.quotation_date ?? right.created_at ?? 0).getTime();
      const leftExpiry = new Date(left.expiry_date ?? 0).getTime();
      const rightExpiry = new Date(right.expiry_date ?? 0).getTime();

      switch (sortMode) {
        case "oldest":
          return leftDate - rightDate;
        case "value-desc":
          return rightValue - leftValue;
        case "value-asc":
          return leftValue - rightValue;
        case "expiry":
          return leftExpiry - rightExpiry;
        case "newest":
        default:
          return rightDate - leftDate;
      }
    });
  }, [companies, contacts, initialQuotations, search, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / PAGE_SIZE));

  React.useEffect(() => {
    if (!selectedQuotationId || !filteredQuotations.some((quotation) => quotation.id === selectedQuotationId)) {
      setSelectedQuotationId(filteredQuotations[0]?.id ?? null);
    }
  }, [filteredQuotations, selectedQuotationId]);

  React.useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortMode]);

  const pageItems = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredQuotations.slice(start, start + PAGE_SIZE);
  }, [filteredQuotations, page]);

  const selectedQuotation = filteredQuotations.find((quotation) => quotation.id === selectedQuotationId) ?? null;
  const visibleIds = new Set(pageItems.map((quotation) => quotation.id));

  const stats = React.useMemo(() => ({
    Draft: initialQuotations.filter((quotation) => String(quotation.status ?? "Draft") === "Draft" && !quotation.archived).length,
    Sent: initialQuotations.filter((quotation) => String(quotation.status ?? "Draft") === "Sent" && !quotation.archived).length,
    Accepted: initialQuotations.filter((quotation) => String(quotation.status ?? "Draft") === "Accepted" && !quotation.archived).length,
    Rejected: initialQuotations.filter((quotation) => String(quotation.status ?? "Draft") === "Rejected" && !quotation.archived).length,
    Expired: initialQuotations.filter((quotation) => String(quotation.status ?? "Draft") === "Expired" && !quotation.archived).length,
    TotalValue: initialQuotations.filter((quotation) => !quotation.archived).reduce((sum, quotation) => sum + getQuotationValue(quotation), 0),
  }), [initialQuotations]);

  const totalSelectedValue = React.useMemo(() => {
    return initialQuotations
      .filter((quotation) => selectedIds.includes(quotation.id))
      .reduce((sum, quotation) => sum + getQuotationValue(quotation), 0);
  }, [initialQuotations, selectedIds]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulk = async (action: "sent" | "archive" | "delete") => {
    if (selectedIds.length === 0) {
      return;
    }

    setBusyAction(action);
    try {
      if (action === "sent") {
        const { error } = await bulkUpdateQuotationStatus(selectedIds, "Sent");
        if (error) {
          throw error;
        }
        addToast({ tone: "success", title: "Quotes marked sent", description: `${selectedIds.length} quotation(s) updated.` });
      }

      if (action === "archive") {
        const { error } = await bulkArchiveQuotations(selectedIds, true);
        if (error) {
          throw error;
        }
        addToast({ tone: "success", title: "Quotations archived", description: `${selectedIds.length} quotation(s) moved to archive.` });
      }

      if (action === "delete") {
        const confirmed = window.confirm(`Delete ${selectedIds.length} quotation(s)? This action cannot be undone.`);
        if (!confirmed) {
          setBusyAction(null);
          return;
        }
        const { error } = await bulkDeleteQuotations(selectedIds);
        if (error) {
          throw error;
        }
        addToast({ tone: "success", title: "Quotations deleted", description: `${selectedIds.length} quotation(s) removed.` });
      }

      clearSelection();
      router.refresh();
    } catch (error) {
      addToast({ tone: "error", title: "Bulk action failed", description: (error as Error).message ?? "Try again." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveSelected = async (quotation: Quotation) => {
    setBusyAction(quotation.id);
    const { error } = await archiveQuotation(quotation.id, !quotation.archived);
    if (error) {
      addToast({ tone: "error", title: "Archive failed", description: error.message });
    } else {
      addToast({ tone: "success", title: quotation.archived ? "Restored quotation" : "Quotation archived" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const filterButtons: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All quotes" },
    { id: "open", label: "Open" },
    { id: "Draft", label: "Draft" },
    { id: "Sent", label: "Sent" },
    { id: "Viewed", label: "Viewed" },
    { id: "Accepted", label: "Accepted" },
    { id: "Rejected", label: "Rejected" },
    { id: "Expired", label: "Expired" },
  ];

  return (
    <>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quotations</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">Quotation register</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Assemble, send, and track customer quotations in a document-first workspace built for sales operations.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Draft", stats.Draft, "text-slate-950 dark:text-slate-50"],
                ["Sent", stats.Sent, "text-sky-600 dark:text-sky-300"],
                ["Accepted", stats.Accepted, "text-emerald-600 dark:text-emerald-300"],
                ["Rejected", stats.Rejected, "text-rose-600 dark:text-rose-300"],
                ["Expired", stats.Expired, "text-amber-600 dark:text-amber-300"],
                ["Total value", formatCurrency(stats.TotalValue), "text-slate-950 dark:text-slate-50"],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Actions</p>
            <div className="mt-4 space-y-3">
              <Link href="/quotations/new" className="inline-flex h-11 w-full items-center justify-start gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-100">
                <Plus className="h-4 w-4" />
                Create quotation
              </Link>
              <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("Sent")}>
                <Send className="h-4 w-4" />
                Review sent quotes
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("open")}>
                <FileText className="h-4 w-4" />
                Focus open work
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-5">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto] xl:items-center">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Search className="h-4.5 w-4.5 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                type="search"
                placeholder="Search quote number, client, contact, rep, or reference"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="bg-transparent text-sm outline-none">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="value-desc">Highest value</option>
                <option value="value-asc">Lowest value</option>
                <option value="expiry">Nearest expiry</option>
              </select>
            </label>
            <div className="text-sm text-slate-500 dark:text-slate-400">{filteredQuotations.length} quotations</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterButtons.map((button) => {
              const active = statusFilter === button.id;
              return (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => setStatusFilter(button.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                >
                  {button.label}
                </button>
              );
            })}
          </div>
        </section>

        {selectedIds.length > 0 ? (
          <section className="rounded-3xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">{selectedIds.length} selected</p>
                <p className="text-xs text-sky-700/80 dark:text-sky-300/80">Total selected value: {formatCurrency(totalSelectedValue)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => handleBulk("sent")} disabled={busyAction !== null}>
                  <Send className="h-4 w-4" />
                  Mark sent
                </Button>
                <Button variant="secondary" onClick={() => handleBulk("archive")} disabled={busyAction !== null}>
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
                <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => handleBulk("delete")} disabled={busyAction !== null}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Quotation table</h2>
            </div>

            {pageItems.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No quotations match this register view.</p>
                <Link href="/quotations/new" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white dark:bg-slate-50 dark:text-slate-950">Create quotation</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5"><input type="checkbox" checked={pageItems.every((quotation) => selectedIds.includes(quotation.id)) && pageItems.length > 0} onChange={() => setSelectedIds(pageItems.every((quotation) => selectedIds.includes(quotation.id)) ? selectedIds.filter((id) => !visibleIds.has(id)) : Array.from(new Set([...selectedIds, ...pageItems.map((quotation) => quotation.id)])))} /></th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Quotation</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Client</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Status</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Value</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Expiry</th>
                      <th className="px-4 py-3.5 text-right font-semibold uppercase tracking-[0.16em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {pageItems.map((quotation) => {
                      const lineItems = resolveLineItems(quotation) as any[];
                      const summary = calculateQuotationSummary(lineItems);
                      return (
                        <tr key={quotation.id} className={`transition hover:bg-slate-50 dark:hover:bg-slate-900/70 ${selectedQuotationId === quotation.id ? "bg-sky-50/50 dark:bg-sky-950/20" : ""}`}>
                          <td className="px-4 py-4 align-top"><input type="checkbox" checked={selectedIds.includes(quotation.id)} onChange={() => toggleSelected(quotation.id)} /></td>
                          <td className="px-4 py-4 align-top">
                            <Link href={`/quotations/${quotation.id}`} className="font-semibold text-slate-950 hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">{quotation.quotation_number || "Untitled quotation"}</Link>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{quotation.reference_number || "No reference"}</p>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-950 dark:text-slate-50">{getCompanyName(quotation, companies)}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getContactName(quotation, contacts)}</p>
                          </td>
                          <td className="px-4 py-4 align-top"><QuotationStatusBadge status={quotation.status} archived={quotation.archived} /></td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatCurrency(summary.grandTotal, quotation.currency || "USD")}</td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatQuotationDate(quotation.expiry_date)}</td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => setSelectedQuotationId(quotation.id)}><Eye className="h-4 w-4" />Preview</Button>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/quotations/${quotation.id}`)}><Copy className="h-4 w-4" />Open</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-300">Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredQuotations.length)} to {Math.min(page * PAGE_SIZE, filteredQuotations.length)} of {filteredQuotations.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="h-4 w-4" />Prev</Button>
                <span className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Page {page} of {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selected quotation</h3>
            {selectedQuotation ? (
              <div className="space-y-4">
                <div>
                  <Link href={`/quotations/${selectedQuotation.id}`} className="text-2xl font-semibold text-slate-950 hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">{selectedQuotation.quotation_number || "Untitled quotation"}</Link>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{getCompanyName(selectedQuotation, companies)}</p>
                </div>
                <QuotationStatusBadge status={selectedQuotation.status} archived={selectedQuotation.archived} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Currency</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{selectedQuotation.currency || "USD"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Sales rep</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{selectedQuotation.sales_representative || "Unassigned"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Date</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{formatQuotationDate(selectedQuotation.quotation_date)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Expiry</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{formatQuotationDate(selectedQuotation.expiry_date)}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Grand total</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(getQuotationValue(selectedQuotation), selectedQuotation.currency || "USD")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Client contact</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{getContactName(selectedQuotation, contacts)}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{contactMap.get(selectedQuotation.contact_id ?? "") ?? "No contact assigned"}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => router.push(`/quotations/${selectedQuotation.id}`)}><FileText className="h-4 w-4" />Open quote</Button>
                  <Button variant="secondary" onClick={() => toggleSelected(selectedQuotation.id)}><Copy className="h-4 w-4" />Select batch</Button>
                  <Button variant="ghost" onClick={() => setSearch(selectedQuotation.quotation_number || "")}><Search className="h-4 w-4" />Find number</Button>
                  <Button variant="ghost" onClick={() => handleArchiveSelected(selectedQuotation)} disabled={busyAction !== null}><Archive className="h-4 w-4" />{selectedQuotation.archived ? "Unarchive" : "Archive"}</Button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Preview notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selectedQuotation.notes || "No client-facing notes yet."}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Attachments</p>
                  <div className="mt-3 space-y-2">
                    {resolveAttachments(selectedQuotation).length > 0 ? resolveAttachments(selectedQuotation).map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{item}</div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-400">No files attached.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Recent activity</p>
                  <div className="mt-3 space-y-2">
                    {resolveActivityLog(selectedQuotation).slice(0, 3).map((entry) => (
                      <div key={`${entry.label}-${entry.at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="font-semibold text-slate-950 dark:text-slate-50">{entry.label}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail || formatQuotationDate(entry.at)}</p>
                      </div>
                    ))}
                    {resolveActivityLog(selectedQuotation).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Activity log will appear here as the quote moves through review.</p> : null}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-slate-600 dark:text-slate-300">Select a quotation to inspect the document summary.</p>}
          </aside>
        </section>
      </div>

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-lg ${toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"}`}>
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}

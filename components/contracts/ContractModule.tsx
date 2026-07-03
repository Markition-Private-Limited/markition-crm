"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Copy, FileSignature, Hourglass, Mail, Plus, Search, Send, ShieldCheck, SlidersHorizontal, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import {
  archiveContract,
  bulkArchiveContracts,
  bulkDeleteContracts,
  bulkUpdateContractStatus,
  deleteContract,
} from "@/src/modules/contracts/contract-client";
import {
  contractToDraft,
  daysUntil,
  formatCurrency,
  formatContractDate,
  parseTextList,
  type Contract,
} from "@/src/modules/contracts/contract-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";

const PAGE_SIZE = 8;

type SortMode = "newest" | "oldest" | "value-desc" | "value-asc" | "ending-soon";
type StatusFilter = "all" | "Draft" | "Under Review" | "Pending Signature" | "Active" | "Completed" | "Expired" | "Terminated" | "Renewed";

type Toast = { id: number; title: string; description?: string; tone: "success" | "error" };

interface ContractModuleProps {
  initialContracts: Contract[];
  companies: Company[];
  contacts: Contact[];
  initialSearch?: string;
}

function toLower(value?: string | number | null) {
  return String(value ?? "").toLowerCase();
}

function resolveContractValue(contract: Contract) {
  return Number(contract.contract_value ?? 0);
}

function getCompanyName(contract: Contract, companies: Company[]) {
  return companies.find((company) => company.id === contract.company_id)?.name || "Unassigned";
}

function getContactName(contract: Contract, contacts: Contact[]) {
  return contacts.find((contact) => contact.id === contract.contact_id)?.name || "Unassigned";
}

function matchesStatusFilter(contract: Contract, filter: StatusFilter) {
  if (filter === "all") {
    return true;
  }
  return String(contract.status ?? "Draft") === filter;
}

function getRenewalState(contract: Contract) {
  const days = daysUntil(contract.end_date);
  if (days === null) {
    return { tone: "muted", label: "No end date" } as const;
  }
  if (days < 0) {
    return { tone: "warning", label: "Expired" } as const;
  }
  if (days <= Number(contract.notice_period_days ?? 30)) {
    return { tone: "warning", label: `${days} day${days === 1 ? "" : "s"} left` } as const;
  }
  return { tone: "success", label: `${days} days remaining` } as const;
}

export function ContractModule({ initialContracts, companies, contacts, initialSearch = "" }: ContractModuleProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("newest");
  const [page, setPage] = React.useState(1);
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(initialContracts[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const companyMap = React.useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies]);
  const contactMap = React.useMemo(() => new Map(contacts.map((contact) => [contact.id, contact.name || contact.email || contact.id])), [contacts]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const filteredContracts = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = initialContracts.filter((contract) => {
      const searchMatch =
        !term ||
        toLower(contract.contract_number).includes(term) ||
        toLower(contract.contract_name).includes(term) ||
        toLower(getCompanyName(contract, companies)).includes(term) ||
        toLower(getContactName(contract, contacts)).includes(term) ||
        toLower(contract.sales_representative).includes(term);

      return searchMatch && matchesStatusFilter(contract, statusFilter);
    });

    return matching.sort((left, right) => {
      const leftValue = resolveContractValue(left);
      const rightValue = resolveContractValue(right);
      const leftDate = new Date(left.start_date ?? left.created_at ?? 0).getTime();
      const rightDate = new Date(right.start_date ?? right.created_at ?? 0).getTime();
      const leftEnd = new Date(left.end_date ?? 0).getTime();
      const rightEnd = new Date(right.end_date ?? 0).getTime();

      switch (sortMode) {
        case "oldest":
          return leftDate - rightDate;
        case "value-desc":
          return rightValue - leftValue;
        case "value-asc":
          return leftValue - rightValue;
        case "ending-soon":
          return leftEnd - rightEnd;
        case "newest":
        default:
          return rightDate - leftDate;
      }
    });
  }, [companies, contacts, initialContracts, search, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE));

  React.useEffect(() => {
    if (!selectedContractId || !filteredContracts.some((contract) => contract.id === selectedContractId)) {
      setSelectedContractId(filteredContracts[0]?.id ?? null);
    }
  }, [filteredContracts, selectedContractId]);

  React.useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortMode]);

  const pageItems = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredContracts.slice(start, start + PAGE_SIZE);
  }, [filteredContracts, page]);

  const selectedContract = filteredContracts.find((contract) => contract.id === selectedContractId) ?? null;
  const visibleIds = new Set(pageItems.map((contract) => contract.id));

  const stats = React.useMemo(() => ({
    Draft: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Draft" && !contract.archived).length,
    UnderReview: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Under Review" && !contract.archived).length,
    PendingSignature: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Pending Signature" && !contract.archived).length,
    Active: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Active" && !contract.archived).length,
    Expired: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Expired" && !contract.archived).length,
    Terminated: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Terminated" && !contract.archived).length,
    Renewed: initialContracts.filter((contract) => String(contract.status ?? "Draft") === "Renewed" && !contract.archived).length,
    TotalValue: initialContracts.filter((contract) => !contract.archived).reduce((sum, contract) => sum + resolveContractValue(contract), 0),
  }), [initialContracts]);

  const totalSelectedValue = React.useMemo(() => {
    return initialContracts
      .filter((contract) => selectedIds.includes(contract.id))
      .reduce((sum, contract) => sum + resolveContractValue(contract), 0);
  }, [initialContracts, selectedIds]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulk = async (action: "review" | "signature" | "active" | "archive" | "terminate" | "delete") => {
    if (selectedIds.length === 0) {
      return;
    }

    setBusyAction(action);
    try {
      if (action === "review") {
        const { error } = await bulkUpdateContractStatus(selectedIds, "Under Review");
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts moved to review", description: `${selectedIds.length} contract(s) updated.` });
      }

      if (action === "signature") {
        const { error } = await bulkUpdateContractStatus(selectedIds, "Pending Signature");
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts sent for signature", description: `${selectedIds.length} contract(s) updated.` });
      }

      if (action === "active") {
        const { error } = await bulkUpdateContractStatus(selectedIds, "Active");
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts activated", description: `${selectedIds.length} contract(s) updated.` });
      }

      if (action === "archive") {
        const { error } = await bulkArchiveContracts(selectedIds, true);
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts archived", description: `${selectedIds.length} contract(s) moved to archive.` });
      }

      if (action === "terminate") {
        const { error } = await bulkUpdateContractStatus(selectedIds, "Terminated");
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts terminated", description: `${selectedIds.length} contract(s) updated.` });
      }

      if (action === "delete") {
        const confirmed = window.confirm(`Delete ${selectedIds.length} contract(s)? This action cannot be undone.`);
        if (!confirmed) {
          setBusyAction(null);
          return;
        }
        const { error } = await bulkDeleteContracts(selectedIds);
        if (error) throw error;
        addToast({ tone: "success", title: "Contracts deleted", description: `${selectedIds.length} contract(s) removed.` });
      }

      clearSelection();
      router.refresh();
    } catch (error) {
      addToast({ tone: "error", title: "Bulk action failed", description: (error as Error).message ?? "Try again." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveRow = async (contract: Contract) => {
    setBusyAction(contract.id);
    const { error } = await archiveContract(contract.id, !contract.archived);
    if (error) {
      addToast({ tone: "error", title: "Archive failed", description: error.message });
    } else {
      addToast({ tone: "success", title: contract.archived ? "Contract restored" : "Contract archived" });
      router.refresh();
    }
    setBusyAction(null);
  };

  const handleDuplicate = (contract: Contract) => {
    window.localStorage.setItem("contract-create-draft", JSON.stringify(contractToDraft(contract, true)));
    router.push("/contracts/new");
  };

  const filterButtons: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All contracts" },
    { id: "Draft", label: "Draft" },
    { id: "Under Review", label: "Under Review" },
    { id: "Pending Signature", label: "Pending Signature" },
    { id: "Active", label: "Active" },
    { id: "Completed", label: "Completed" },
    { id: "Expired", label: "Expired" },
    { id: "Terminated", label: "Terminated" },
    { id: "Renewed", label: "Renewed" },
  ];

  return (
    <>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contracts</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">Agreement control room</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Track signed agreements through review, signature, renewal, and termination without flattening them into a quote-style workspace.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
              {[
                ["Draft", stats.Draft],
                ["Under Review", stats.UnderReview],
                ["Pending Signature", stats.PendingSignature],
                ["Active", stats.Active],
                ["Expired", stats.Expired],
                ["Terminated", stats.Terminated],
                ["Renewed", stats.Renewed],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{value}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:col-span-3 xl:col-span-1">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total value</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(stats.TotalValue)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Actions</p>
            <div className="mt-4 space-y-3">
              <Link href="/contracts/new" className="inline-flex h-11 w-full items-center justify-start gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-100">
                <Plus className="h-4 w-4" />
                Create contract
              </Link>
              <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("Pending Signature")}>
                <FileSignature className="h-4 w-4" />
                Focus signature queue
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("Active")}>
                <ShieldCheck className="h-4 w-4" />
                Review active agreements
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
                placeholder="Search contract number, title, company, manager, or contact"
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
                <option value="ending-soon">Ending soon</option>
              </select>
            </label>
            <div className="text-sm text-slate-500 dark:text-slate-400">{filteredContracts.length} contracts</div>
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
                <Button variant="secondary" onClick={() => handleBulk("review")} disabled={busyAction !== null}><Mail className="h-4 w-4" />Review</Button>
                <Button variant="secondary" onClick={() => handleBulk("signature")} disabled={busyAction !== null}><FileSignature className="h-4 w-4" />Pending signature</Button>
                <Button variant="secondary" onClick={() => handleBulk("active")} disabled={busyAction !== null}><ShieldCheck className="h-4 w-4" />Activate</Button>
                <Button variant="secondary" onClick={() => handleBulk("archive")} disabled={busyAction !== null}><Archive className="h-4 w-4" />Archive</Button>
                <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => handleBulk("terminate")} disabled={busyAction !== null}><TriangleAlert className="h-4 w-4" />Terminate</Button>
                <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => handleBulk("delete")} disabled={busyAction !== null}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Contract ledger</h2>
            </div>

            {pageItems.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <FileSignature className="h-7 w-7" />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No contracts match this control view.</p>
                <Link href="/contracts/new" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white dark:bg-slate-50 dark:text-slate-950">Create contract</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5"><input type="checkbox" checked={pageItems.every((contract) => selectedIds.includes(contract.id)) && pageItems.length > 0} onChange={() => setSelectedIds(pageItems.every((contract) => selectedIds.includes(contract.id)) ? selectedIds.filter((id) => !visibleIds.has(id)) : Array.from(new Set([...selectedIds, ...pageItems.map((contract) => contract.id)])))} /></th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Contract Number</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Company</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Contract Title</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Start Date</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">End Date</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Status</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Value</th>
                      <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Assigned Manager</th>
                      <th className="px-4 py-3.5 text-right font-semibold uppercase tracking-[0.16em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {pageItems.map((contract) => {
                      const renewal = getRenewalState(contract);
                      return (
                        <tr key={contract.id} className={`transition hover:bg-slate-50 dark:hover:bg-slate-900/70 ${selectedContractId === contract.id ? "bg-sky-50/50 dark:bg-sky-950/20" : ""}`}>
                          <td className="px-4 py-4 align-top"><input type="checkbox" checked={selectedIds.includes(contract.id)} onChange={() => toggleSelected(contract.id)} /></td>
                          <td className="px-4 py-4 align-top">
                            <Link href={`/contracts/${contract.id}`} className="font-semibold text-slate-950 hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">{contract.contract_number || "Untitled"}</Link>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{renewal.label}</p>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{getCompanyName(contract, companies)}</td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{contract.contract_name || "No title"}</td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatContractDate(contract.start_date)}</td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatContractDate(contract.end_date)}</td>
                          <td className="px-4 py-4 align-top"><ContractStatusBadge status={contract.status} archived={contract.archived} /></td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{formatCurrency(resolveContractValue(contract), contract.currency || "USD")}</td>
                          <td className="px-4 py-4 align-top text-slate-600 dark:text-slate-300">{contract.sales_representative || "Unassigned"}</td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => setSelectedContractId(contract.id)}><FileSignature className="h-4 w-4" />View</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDuplicate(contract)}><Copy className="h-4 w-4" />Duplicate</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleArchiveRow(contract)} disabled={busyAction !== null}><Archive className="h-4 w-4" />{contract.archived ? "Unarchive" : "Archive"}</Button>
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
              <p className="text-sm text-slate-600 dark:text-slate-300">Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredContracts.length)} to {Math.min(page * PAGE_SIZE, filteredContracts.length)} of {filteredContracts.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="h-4 w-4" />Prev</Button>
                <span className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Page {page} of {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Contract dossier</h3>
            {selectedContract ? (
              <div className="space-y-4">
                <div>
                  <Link href={`/contracts/${selectedContract.id}`} className="text-2xl font-semibold text-slate-950 hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">{selectedContract.contract_number || "Untitled contract"}</Link>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedContract.contract_name || "No title"}</p>
                </div>
                <ContractStatusBadge status={selectedContract.status} archived={selectedContract.archived} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Client</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{getCompanyName(selectedContract, companies)}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Contact</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{getContactName(selectedContract, contacts)}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Start</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{formatContractDate(selectedContract.start_date)}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">End</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{formatContractDate(selectedContract.end_date)}</p></div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Contract value</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(resolveContractValue(selectedContract), selectedContract.currency || "USD")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Renewal state</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{getRenewalState(selectedContract).label}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedContract.auto_renewal ? "Auto renewal enabled" : "Manual renewal tracking"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selectedContract.scope_of_work || selectedContract.notes || "No summary available."}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => router.push(`/contracts/${selectedContract.id}`)}><FileSignature className="h-4 w-4" />Open contract</Button>
                  <Button variant="ghost" onClick={() => setSearch(selectedContract.contract_number || "")}><Search className="h-4 w-4" />Find number</Button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Attachments</p>
                  <div className="mt-3 space-y-2">
                    {parseTextList(selectedContract.attachments).length > 0 ? parseTextList(selectedContract.attachments).map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{item}</div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-400">No files attached.</p>}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-slate-600 dark:text-slate-300">Select a contract to inspect the agreement dossier.</p>}
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

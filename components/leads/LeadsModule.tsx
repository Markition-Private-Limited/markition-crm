"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Plus, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadForm } from "@/components/leads/LeadForm";
import { deleteLead } from "@/src/modules/leads/lead-client";
import { LEAD_STAGES, type Lead } from "@/src/modules/leads/lead-types";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "error";
};

type LeadsModuleProps = {
  initialLeads: Lead[];
  companies: Company[];
  contacts: Contact[];
  initialSearch?: string;
};

const PAGE_SIZE = 10;

function getLeadTitle(lead: Lead) {
  return lead.title || lead.name || "Untitled lead";
}

function getStageClass(stage?: string) {
  const value = (stage ?? "").toLowerCase();
  if (value.includes("won")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (value.includes("lost")) return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  if (value.includes("negotiation")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  if (value.includes("proposal")) return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
  if (value.includes("qualified")) return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function LeadsModule({ initialLeads, companies, contacts, initialSearch = "" }: LeadsModuleProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [stageFilter, setStageFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = React.useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const companyMap = React.useMemo(() => {
    return new Map(companies.map((company) => [company.id, company.name]));
  }, [companies]);

  const contactMap = React.useMemo(() => {
    return new Map(contacts.map((contact) => [contact.id, contact.name || contact.email || contact.id]));
  }, [contacts]);

  const filteredLeads = React.useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return initialLeads.filter((lead) => {
      const title = getLeadTitle(lead);
      const stage = lead.stage ?? "";
      const priority = lead.priority ?? "";
      const companyName = companyMap.get(lead.company_id ?? "") ?? "";
      const contactName = contactMap.get(lead.contact_id ?? "") ?? "";

      const matchesStage = stageFilter === "all" || stage === stageFilter;
      const matchesPriority = priorityFilter === "all" || priority === priorityFilter;
      const matchesSearch =
        searchTerm.length === 0 ||
        title.toLowerCase().includes(searchTerm) ||
        companyName.toLowerCase().includes(searchTerm) ||
        contactName.toLowerCase().includes(searchTerm) ||
        (lead.assigned_salesperson ?? "").toLowerCase().includes(searchTerm) ||
        (lead.source ?? "").toLowerCase().includes(searchTerm) ||
        (lead.tags ?? "").toString().toLowerCase().includes(searchTerm);

      return matchesStage && matchesPriority && matchesSearch;
    });
  }, [companyMap, contactMap, initialLeads, priorityFilter, search, stageFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [search, stageFilter, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deletingLead) return;

    setIsDeleting(true);
    const { error } = await deleteLead(deletingLead.id);
    if (error) {
      addToast({ tone: "error", title: "Delete failed", description: error.message });
      setIsDeleting(false);
      return;
    }

    setDeletingLead(null);
    setIsDeleting(false);
    addToast({ tone: "success", title: "Lead deleted", description: "Lead removed from the pipeline." });
    router.refresh();
  };

  const resetFilters = () => {
    setSearch("");
    setStageFilter("all");
    setPriorityFilter("all");
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Leads</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">Pipeline opportunities</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Track each opportunity from first touch to close with stage, priority, value, and follow-up context.</p>
          </div>
          <Button className="w-full lg:w-auto" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create lead
          </Button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 md:col-span-2">
              <Search className="h-4.5 w-4.5 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                type="search"
                placeholder="Search by title, company, contact, salesperson, source, tag"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100"
              />
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <SlidersHorizontal className="h-4.5 w-4.5 text-slate-500" />
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.currentTarget.value)}
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="all">All stages</option>
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.currentTarget.value)}
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="all">All priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <p>{filteredLeads.length} matching leads</p>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-2.5 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
              Reset filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          {filteredLeads.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-950 dark:text-slate-50">No leads found</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create a lead or adjust filters to view opportunities.</p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => setIsCreateOpen(true)}>Create lead</Button>
                <Button variant="secondary" onClick={resetFilters}>Clear filters</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Lead</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Stage</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Priority</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Company</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Revenue</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Follow-up</th>
                      <th className="px-5 py-3.5 text-right font-semibold uppercase tracking-[0.2em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {paginatedLeads.map((lead) => (
                      <tr key={lead.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-900/70">
                        <td className="px-5 py-4 align-top">
                          <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-950 transition hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">
                            {getLeadTitle(lead)}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {lead.source || "Unknown source"} • {lead.assigned_salesperson || "Unassigned rep"}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${getStageClass(lead.stage)}`}>
                            {lead.stage || "Unknown"}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{lead.priority || "—"}</td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{companyMap.get(lead.company_id ?? "") || "Unassigned"}</td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">
                          {lead.expected_revenue !== undefined ? (
                            <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="h-4 w-4" />${Number(lead.expected_revenue).toLocaleString()}</span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setEditingLead(lead)}>Edit</Button>
                            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => setDeletingLead(lead)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row dark:border-slate-800">
                <p className="text-slate-500 dark:text-slate-400">Page {currentPage} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
                    const pageNumber = index + 1;
                    const isActive = pageNumber === currentPage;
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={`h-9 min-w-9 rounded-xl px-3 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" : "border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  <Button variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Create lead</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Capture a new opportunity in your sales pipeline.</p>
              </div>
              <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100" onClick={() => setIsCreateOpen(false)}>
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <LeadForm
              mode="create"
              companies={companies}
              contacts={contacts}
              onSaved={() => {
                setIsCreateOpen(false);
                addToast({ tone: "success", title: "Lead created", description: "New lead added to the pipeline." });
                router.refresh();
              }}
              onError={(message) => {
                addToast({ tone: "error", title: "Create failed", description: message });
              }}
            />
          </div>
        </div>
      ) : null}

      {editingLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Edit lead</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update details for {getLeadTitle(editingLead)}.</p>
              </div>
              <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100" onClick={() => setEditingLead(null)}>
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <LeadForm
              lead={editingLead}
              companies={companies}
              contacts={contacts}
              mode="edit"
              onSaved={() => {
                setEditingLead(null);
                addToast({ tone: "success", title: "Lead updated", description: "Lead details saved successfully." });
                router.refresh();
              }}
              onError={(message) => {
                addToast({ tone: "error", title: "Update failed", description: message });
              }}
            />
          </div>
        </div>
      ) : null}

      {deletingLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Delete lead</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Delete <span className="font-semibold">{getLeadTitle(deletingLead)}</span>? This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeletingLead(null)} disabled={isDeleting}>Cancel</Button>
              <Button onClick={handleDelete} disabled={isDeleting} className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700">
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-lg ${toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"}`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}

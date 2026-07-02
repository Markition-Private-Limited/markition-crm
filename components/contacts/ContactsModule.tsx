"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Plus, Search, SlidersHorizontal, Trash2, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/ContactForm";
import { deleteContact } from "@/src/modules/contacts/contact-client";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Company } from "@/src/modules/companies/company-types";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "error";
};

type ContactsModuleProps = {
  initialContacts: Contact[];
  companies: Company[];
  initialSearch?: string;
};

const PAGE_SIZE = 10;

function getStatus(contact: Contact) {
  return contact.status?.trim() || "unspecified";
}

export function ContactsModule({ initialContacts, companies, initialSearch = "" }: ContactsModuleProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [companyFilter, setCompanyFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = React.useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const statusOptions = React.useMemo(() => {
    const statuses = new Set<string>();
    for (const contact of initialContacts) {
      statuses.add(getStatus(contact));
    }
    return ["all", ...Array.from(statuses).sort((a, b) => a.localeCompare(b))];
  }, [initialContacts]);

  const companyMap = React.useMemo(() => {
    return new Map(companies.map((company) => [company.id, company.name]));
  }, [companies]);

  const filteredContacts = React.useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return initialContacts.filter((contact) => {
      const matchesStatus = statusFilter === "all" || getStatus(contact) === statusFilter;
      const matchesCompany = companyFilter === "all" || contact.company_id === companyFilter;
      const matchesSearch =
        searchTerm.length === 0 ||
        contact.name.toLowerCase().includes(searchTerm) ||
        (contact.email ?? "").toLowerCase().includes(searchTerm) ||
        (contact.phone ?? "").toLowerCase().includes(searchTerm) ||
        (contact.position ?? "").toLowerCase().includes(searchTerm) ||
        (companyMap.get(contact.company_id ?? "") ?? "").toLowerCase().includes(searchTerm);

      return matchesStatus && matchesCompany && matchesSearch;
    });
  }, [companyFilter, companyMap, initialContacts, search, statusFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, companyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedContacts = filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deletingContact) {
      return;
    }

    setIsDeleting(true);
    const { error } = await deleteContact(deletingContact.id);
    if (error) {
      addToast({
        tone: "error",
        title: "Delete failed",
        description: error.message
      });
      setIsDeleting(false);
      return;
    }

    setDeletingContact(null);
    setIsDeleting(false);
    addToast({
      tone: "success",
      title: "Contact deleted",
      description: "The contact was removed successfully."
    });
    router.refresh();
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCompanyFilter("all");
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contacts</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">People and stakeholders</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Manage all key contacts, assign companies, and keep relationship notes in one place.</p>
          </div>
          <Button className="w-full lg:w-auto" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create contact
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
                placeholder="Search by name, email, phone, position, or company"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100"
              />
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <SlidersHorizontal className="h-4.5 w-4.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.currentTarget.value)}
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="all">All statuses</option>
                {statusOptions
                  .filter((item) => item !== "all")
                  .map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.currentTarget.value)}
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <p>{filteredContacts.length} matching contacts</p>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-2.5 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
              Reset filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          {filteredContacts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-950 dark:text-slate-50">No contacts found</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try adjusting filters or create a new contact record.</p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => setIsCreateOpen(true)}>Create contact</Button>
                <Button variant="secondary" onClick={resetFilters}>Clear filters</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Contact</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Company</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Status</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Position</th>
                      <th className="px-5 py-3.5 font-semibold uppercase tracking-[0.2em]">Phone</th>
                      <th className="px-5 py-3.5 text-right font-semibold uppercase tracking-[0.2em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {paginatedContacts.map((contact) => (
                      <tr key={contact.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-900/70">
                        <td className="px-5 py-4 align-top">
                          <Link href={`/contacts/${contact.id}`} className="font-semibold text-slate-950 transition hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300">
                            {contact.name}
                          </Link>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            {contact.email || "No email"}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{companyMap.get(contact.company_id ?? "") || "Unassigned"}</td>
                        <td className="px-5 py-4 align-top">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {getStatus(contact)}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{contact.position || "—"}</td>
                        <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-300">{contact.phone || "—"}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setEditingContact(contact)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                              onClick={() => setDeletingContact(contact)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row dark:border-slate-800">
                <p className="text-slate-500 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
                    const pageNumber = index + 1;
                    const isActive = pageNumber === currentPage;
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={`h-9 min-w-9 rounded-xl px-3 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  <Button variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
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
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Create contact</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Capture key stakeholder details for your CRM pipeline.</p>
              </div>
              <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100" onClick={() => setIsCreateOpen(false)}>
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <ContactForm
              mode="create"
              companies={companies}
              onSaved={() => {
                setIsCreateOpen(false);
                addToast({
                  tone: "success",
                  title: "Contact created",
                  description: "New contact saved successfully."
                });
                router.refresh();
              }}
              onError={(message) => {
                addToast({
                  tone: "error",
                  title: "Create failed",
                  description: message
                });
              }}
            />
          </div>
        </div>
      ) : null}

      {editingContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Edit contact</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update details for {editingContact.name}.</p>
              </div>
              <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100" onClick={() => setEditingContact(null)}>
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <ContactForm
              contact={editingContact}
              companies={companies}
              mode="edit"
              onSaved={() => {
                setEditingContact(null);
                addToast({
                  tone: "success",
                  title: "Contact updated",
                  description: "Changes saved successfully."
                });
                router.refresh();
              }}
              onError={(message) => {
                addToast({
                  tone: "error",
                  title: "Update failed",
                  description: message
                });
              }}
            />
          </div>
        </div>
      ) : null}

      {deletingContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Delete contact</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Delete <span className="font-semibold">{deletingContact.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeletingContact(null)} disabled={isDeleting}>
                Cancel
              </Button>
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
            className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
            }`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}

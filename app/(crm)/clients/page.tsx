"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, Globe, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiDelete } from "@/lib/api";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  company_service_categories?: Array<{ service_categories: { name: string } | null }>;
};

export default function ClientsPage() {
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    apiGet(`/api/companies${qs}`, token)
      .then(setCompanies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, search]);

  const canCreate = appRole === "admin" || appRole === "project_manager";
  const canDelete = appRole === "admin";

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    setConfirmId(null);
    try {
      await apiDelete(`/api/companies/${id}`, token);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete client");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your clients and accounts.</p>
        </div>
        {canCreate && (
          <Button href="/clients/new">
            <Plus className="h-4 w-4" /> New Client
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="h-10 w-full rounded-[16px] border border-border bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[20px] bg-surface-muted" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">No clients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canCreate ? "Create your first client to get started." : "No clients have been added yet."}
            </p>
          </div>
          {canCreate && <Button href="/clients/new"><Plus className="h-4 w-4" /> New Client</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const cats = c.company_service_categories
              ?.map((csc) => csc.service_categories?.name)
              .filter(Boolean) ?? [];
            const isConfirming = confirmId === c.id;
            const isDeleting = deletingId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => { if (!isConfirming) router.push(`/clients/${c.id}`); }}
                className="relative flex cursor-pointer flex-col items-start gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 transition hover:border-accent/40 hover:bg-surface-elevated"
              >
                <div className="flex w-full items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-accent">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground leading-snug">{c.name}</p>
                    {c.industry && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.industry}</p>
                    )}
                  </div>
                  {canDelete && !isConfirming && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmId(c.id); }}
                      className="shrink-0 rounded-[10px] p-1.5 text-muted-foreground/50 transition hover:bg-danger/10 hover:text-danger"
                      title="Delete client"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[20px] bg-surface/95 backdrop-blur-sm px-5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm font-semibold text-foreground text-center">Delete <span className="text-danger">{c.name}</span>?</p>
                    <p className="text-xs text-muted-foreground text-center">This will permanently remove the client and all associated data.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-[12px] border border-border bg-surface-muted px-4 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(c.id)}
                        className="rounded-[12px] bg-danger px-4 py-1.5 text-xs font-medium text-white hover:bg-danger/90 transition disabled:opacity-60"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {c.website && (
                    <a
                      href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Globe className="h-3 w-3 shrink-0" />
                      Website
                    </a>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      {c.phone}
                    </span>
                  )}
                </div>
                {cats.length > 0 && (
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {cats.slice(0, 3).map((cat) => (
                      <span key={cat} className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {cat}
                      </span>
                    ))}
                    {cats.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{cats.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

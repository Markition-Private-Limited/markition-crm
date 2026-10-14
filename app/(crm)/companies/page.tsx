"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Plus, Search, Globe, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet } from "@/lib/api";

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

export default function CompaniesPage() {
  const { token, appRole } = useSessionProvider();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your clients and accounts.</p>
        </div>
        {canCreate && (
          <Button href="/companies/new">
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
          {canCreate && <Button href="/companies/new"><Plus className="h-4 w-4" /> New Client</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const cats = c.company_service_categories
              ?.map((csc) => csc.service_categories?.name)
              .filter(Boolean) ?? [];
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 transition hover:border-accent/40 hover:bg-surface-elevated"
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
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {c.website && (
                    <a
                      href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline"
                      onClick={(e) => e.stopPropagation()}
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

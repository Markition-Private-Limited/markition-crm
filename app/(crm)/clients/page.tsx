"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, Calendar } from "lucide-react";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet } from "@/lib/api";

type Client = {
  id: string;
  company_id: string;
  source_prospect_id: string | null;
  status: string;
  created_at: string;
  companies: { id: string; name: string } | null;
  prospects: { id: string; name: string | null; notes: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-surface-muted text-muted-foreground",
};

export default function ClientsPage() {
  const { token } = useSessionProvider();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    apiGet(`/api/clients${qs}`, token)
      .then((data) => setClients(data as Client[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Active Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients created automatically from won prospects.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "active", "inactive"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${statusFilter === s ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[20px] bg-surface-muted" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No active clients yet</p>
          <p className="text-sm text-muted-foreground">
            Clients are created automatically when a prospect reaches Closed Won.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 hover:border-foreground/20 hover:shadow-md transition-shadow"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="block truncate font-semibold text-foreground leading-snug">
                  {c.companies?.name ?? "Unknown Company"}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[c.status] ?? "bg-surface-muted text-muted-foreground"}`}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
              </div>
              {c.prospects?.name && (
                <p className="text-xs text-muted-foreground">Contact: {c.prospects.name}</p>
              )}
              <div className="mt-auto flex w-full items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(c.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

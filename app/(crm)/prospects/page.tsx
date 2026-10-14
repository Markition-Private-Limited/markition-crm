"use client";

import * as React from "react";
import Link from "next/link";
import { Target, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost } from "@/lib/api";

type Prospect = {
  id: string;
  company_id: string;
  name: string | null;
  notes: string | null;
  source: string | null;
  status: string;
  created_at: string;
  companies: { id: string; name: string } | null;
};

type Company = { id: string; name: string };

const PIPELINE_STATUSES = [
  "first_contact", "follow_up", "discovery_call", "closing", "closed_won", "failed",
] as const;

const STATUS_COLORS: Record<string, string> = {
  first_contact:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  follow_up:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  discovery_call: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  closing:        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  closed_won:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed:         "bg-surface-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  first_contact:  "First Contact",
  follow_up:      "Follow Up",
  discovery_call: "Discovery Call",
  closing:        "Closing",
  closed_won:     "Closed Won",
  failed:         "Failed",
};

export default function ProspectsPage() {
  const { token, appRole } = useSessionProvider();
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [showModal, setShowModal] = React.useState(false);
  const [newCompanyId, setNewCompanyId] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");
  const [newSource, setNewSource] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const canCreate = appRole === "admin" || appRole === "sales";

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    Promise.all([
      apiGet(`/api/prospects${qs}`, token),
      apiGet("/api/companies", token).catch(() => []),
    ])
      .then(([pros, cos]) => {
        setProspects(pros as Prospect[]);
        setCompanies(cos as Company[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  const createProspect = async () => {
    if (!token || !newCompanyId) return;
    setCreating(true);
    try {
      const created = await apiPost("/api/prospects", token, {
        company_id: newCompanyId,
        name: newName || undefined,
        notes: newNotes || undefined,
        source: newSource || undefined,
      });
      const company = companies.find((c) => c.id === newCompanyId) ?? null;
      setProspects((prev) => [{ ...(created as Prospect), companies: company }, ...prev]);
      setShowModal(false);
      setNewCompanyId(""); setNewName(""); setNewNotes(""); setNewSource("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create prospect");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your sales pipeline.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Prospect</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...PIPELINE_STATUSES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === s ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
          >
            {s === "all" ? "All" : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[20px] bg-surface-muted" />
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No prospects found</p>
          {canCreate && (
            <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Prospect</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prospects.map((p) => {
            const companyName = p.companies?.name ?? "Unknown Company";
            return (
              <Link
                key={p.id}
                href={`/prospects/${p.id}`}
                className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 hover:border-foreground/20 hover:shadow-md transition-shadow"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-foreground leading-snug">
                      {p.name ?? companyName}
                    </span>
                    {p.name && (
                      <span className="text-xs text-muted-foreground">{companyName}</span>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[p.status] ?? "bg-surface-muted text-muted-foreground"}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                {p.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.notes}</p>
                )}
                <div className="mt-auto flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  {p.source && <span className="truncate">{p.source}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={showModal} title="New Prospect" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Company <span className="text-danger">*</span></label>
            <select
              value={newCompanyId}
              onChange={(e) => setNewCompanyId(e.target.value)}
              className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">— Select company —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Contact Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Jane Smith"
              className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Source</label>
            <input
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="cold outreach, referral…"
              className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Initial context…"
              rows={3}
              className="w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm resize-none focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={createProspect} disabled={creating || !newCompanyId}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Target, Plus, Calendar, Search, Archive, AlertTriangle, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

type PipelineStage = {
  id: string;
  name: string;
  display_order: number;
  default_probability: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
};

type Prospect = {
  id: string;
  prospect_code: string;
  company_name: string | null;
  name: string | null;
  stage_id: string | null;
  priority: string;
  estimated_value: number | null;
  currency: string;
  expected_close_date: string | null;
  is_archived: boolean;
  created_at: string;
  pipeline_stages: PipelineStage | null;
  companies: { id: string; name: string } | null;
};

type DuplicateMatch = { id: string; prospect_code: string; company_name: string };
type ServiceCategory = { id: string; name: string };

function ServiceCategoryCombobox({
  value, categories, canCreate, onChange, onCreate, onDelete,
}: {
  value: string;
  categories: ServiceCategory[];
  canCreate: boolean;
  onChange: (name: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = categories.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()),
  );
  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.toLowerCase());

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!query.trim()) return;
    setCreating(true);
    await onCreate(query.trim());
    onChange(query.trim());
    setQuery("");
    setCreating(false);
    setOpen(false);
  };

  const handleSelect = (name: string) => {
    onChange(name);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => { onChange(""); setQuery(""); };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm text-foreground">
            {value}
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-danger">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={canCreate ? "Search or type to create…" : "Search categories…"}
          className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
        />
      )}
      {!value && open && (filtered.length > 0 || (canCreate && query && !exactMatch)) && (
        <div className="absolute z-10 mt-1 w-full rounded-[14px] border border-border bg-surface shadow-xl shadow-black/10">
          <div className="p-1">
            {filtered.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1 rounded-[10px] hover:bg-surface-muted">
                <button
                  type="button"
                  onClick={() => handleSelect(cat.name)}
                  className="flex-1 px-3 py-2 text-left text-sm text-foreground"
                >
                  {cat.name}
                </button>
                {canCreate && (
                  <button
                    type="button"
                    disabled={deletingId === cat.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setDeletingId(cat.id);
                      await onDelete(cat.id);
                      setDeletingId(null);
                    }}
                    className="mr-2 shrink-0 rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-40"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {canCreate && query && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {creating ? "Creating…" : `Create "${query}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-surface-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const LEAD_SOURCES = [
  "Cold Outreach", "Referral", "Website Inquiry", "LinkedIn", "Event/Conference",
  "Existing Client", "Partner", "Advertisement", "Other",
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "PKR", "INR"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

export default function ProspectsPage() {
  const { token, appRole } = useSessionProvider();

  // Data
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [stages, setStages] = React.useState<PipelineStage[]>([]);
  const [categories, setCategories] = React.useState<ServiceCategory[]>([]);

  // Filters
  const [stageFilter, setStageFilter] = React.useState("all");
  const [showArchived, setShowArchived] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // UI state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // Duplicate warning state
  const [duplicateMatches, setDuplicateMatches] = React.useState<DuplicateMatch[]>([]);
  const [pendingCreate, setPendingCreate] = React.useState<Record<string, unknown> | null>(null);

  // Form fields
  const [form, setForm] = React.useState({
    company_name: "",
    industry: "",
    country: "",
    city: "",
    website: "",
    lead_source: "",
    name: "",
    priority: "medium",
    service_required: "",
    estimated_value: "",
    currency: "USD",
    stage_id: "",
    expected_close_date: "",
    notes: "",
  });

  const canCreate = appRole === "admin" || appRole === "bd_executive";

  const load = React.useCallback(() => {
    if (!token) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (stageFilter !== "all") qs.set("stage_id", stageFilter);
    if (showArchived)          qs.set("archived", "true");
    if (searchQuery)           qs.set("q", searchQuery);

    Promise.all([
      apiGet(`/api/prospects?${qs}`, token),
      apiGet("/api/pipeline-stages", token).catch(() => []),
    ])
      .then(([pros, stgs]) => {
        setProspects(pros as Prospect[]);
        setStages((stgs as PipelineStage[]).filter((s) => s.is_active));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, stageFilter, showArchived, searchQuery]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!token) return;
    apiGet("/api/service-categories", token)
      .then((data) => setCategories(data as ServiceCategory[]))
      .catch(() => {});
  }, [token]);

  const resetForm = () =>
    setForm({
      company_name: "", industry: "", country: "", city: "", website: "",
      lead_source: "", name: "", priority: "medium", service_required: "",
      estimated_value: "", currency: "USD", stage_id: "", expected_close_date: "", notes: "",
    });

  const buildPayload = (skip = false): Record<string, unknown> => ({
    company_name:        form.company_name.trim(),
    industry:            form.industry    || undefined,
    country:             form.country     || undefined,
    city:                form.city        || undefined,
    website:             form.website     || undefined,
    lead_source:         form.lead_source || undefined,
    name:                form.name        || undefined,
    priority:            form.priority,
    service_required:    form.service_required || undefined,
    estimated_value:     form.estimated_value ? Number(form.estimated_value) : undefined,
    currency:            form.currency,
    stage_id:            form.stage_id    || undefined,
    expected_close_date: form.expected_close_date || undefined,
    notes:               form.notes       || undefined,
    skip_duplicate_check: skip,
  });

  const handleCreate = async (skip = false) => {
    if (!token || !form.company_name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const payload = buildPayload(skip);
      const created = await apiPost("/api/prospects", token, payload);
      setProspects((prev) => [created as Prospect, ...prev]);
      setShowModal(false);
      setDuplicateMatches([]);
      setPendingCreate(null);
      resetForm();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      // Parse 409 duplicate warning
      if (msg.startsWith("{") || (e as { status?: number })?.status === 409) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.duplicate_warning) {
            setDuplicateMatches(parsed.matches);
            setPendingCreate(buildPayload(false));
            return;
          }
        } catch { /* not JSON */ }
      }
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleForceCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const created = await apiPost("/api/prospects", token, { ...pendingCreate, skip_duplicate_check: true });
      setProspects((prev) => [created as Prospect, ...prev]);
      setShowModal(false);
      setDuplicateMatches([]);
      setPendingCreate(null);
      resetForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const setField = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCreateCategory = async (name: string) => {
    if (!token) return;
    try {
      const created = await apiPost("/api/service-categories", token, { name });
      setCategories((prev) => [...prev, created as ServiceCategory]);
    } catch { /* ignore */ }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!token) return;
    try {
      await apiDelete(`/api/service-categories/${id}`, token);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  const inputCls =
    "h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";
  const selectCls = inputCls;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your sales pipeline.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-4 w-4" /> New Prospect
          </Button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company…"
            className="h-9 w-56 rounded-[14px] border border-border bg-background pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        {/* Stage pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStageFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${stageFilter === "all" ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
          >
            All
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setStageFilter(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${stageFilter === s.id ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Archived toggle */}
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${showArchived ? "border-foreground bg-surface-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? "Archived" : "Show archived"}
        </button>
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Prospect grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-[20px] bg-surface-muted" />
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No prospects found</p>
          {canCreate && (
            <Button onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus className="h-4 w-4" /> New Prospect
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prospects.map((p) => {
            const stageName = p.pipeline_stages?.name ?? "—";
            const isWon  = p.pipeline_stages?.is_won;
            const isLost = p.pipeline_stages?.is_lost;
            return (
              <Link
                key={p.id}
                href={`/prospects/${p.id}`}
                className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 hover:border-foreground/20 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-foreground leading-snug">
                      {p.company_name ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {p.prospect_code}
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS.medium}`}>
                    {p.priority}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isWon ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : isLost ? "bg-surface-muted text-muted-foreground" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {stageName}
                  </span>
                  {p.estimated_value != null && (
                    <span className="ml-auto text-xs text-muted-foreground font-medium">
                      {p.currency} {p.estimated_value.toLocaleString()}
                    </span>
                  )}
                </div>

                {p.is_archived && (
                  <span className="text-xs text-muted-foreground italic">Archived</span>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {p.expected_close_date
                      ? new Date(p.expected_close_date).toLocaleDateString()
                      : new Date(p.created_at).toLocaleDateString()}
                  </span>
                  {p.name && <span className="truncate">{p.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Duplicate warning banner */}
      {duplicateMatches.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[24px] border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Possible duplicates found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The following existing prospects appear similar. Review them before proceeding.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {duplicateMatches.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{m.prospect_code}</span>
                      <Link href={`/prospects/${m.id}`} target="_blank" className="text-accent hover:underline">
                        {m.company_name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => { setDuplicateMatches([]); setPendingCreate(null); }}
                  >
                    Go back
                  </Button>
                  <Button onClick={handleForceCreate} disabled={creating}>
                    {creating ? "Creating…" : "Proceed anyway"}
                  </Button>
                </div>
              </div>
              <button onClick={() => { setDuplicateMatches([]); setPendingCreate(null); }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Prospect modal */}
      <Modal open={showModal} title="New Prospect" onClose={() => { setShowModal(false); resetForm(); }}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Company info */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Company</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-foreground">Company Name <span className="text-danger">*</span></label>
              <input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} placeholder="Acme Corp" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Industry</label>
              <input value={form.industry} onChange={(e) => setField("industry", e.target.value)} placeholder="Technology" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Country</label>
              <input value={form.country} onChange={(e) => setField("country", e.target.value)} placeholder="UAE" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">City</label>
              <input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Dubai" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Website</label>
              <input value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://example.com" className={inputCls} />
            </div>
          </div>

          {/* Deal info */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 pt-2">Deal</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Lead Source</label>
              <select value={form.lead_source} onChange={(e) => setField("lead_source", e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select value={form.priority} onChange={(e) => setField("priority", e.target.value)} className={selectCls}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Service Required</label>
              <ServiceCategoryCombobox
                value={form.service_required}
                categories={categories}
                canCreate={appRole === "admin"}
                onChange={(v) => setField("service_required", v)}
                onCreate={handleCreateCategory}
                onDelete={handleDeleteCategory}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Pipeline Stage</label>
              <select value={form.stage_id} onChange={(e) => setField("stage_id", e.target.value)} className={selectCls}>
                <option value="">— Default ({stages.length > 0 ? stages[0].name : 'first stage'}) —</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Estimated Value</label>
              <input type="number" value={form.estimated_value} onChange={(e) => setField("estimated_value", e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Currency</label>
              <select value={form.currency} onChange={(e) => setField("currency", e.target.value)} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-foreground">Expected Close Date</label>
              <input type="date" value={form.expected_close_date} onChange={(e) => setField("expected_close_date", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Contact person */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 pt-2">Contact Person (optional)</p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Contact Name</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Jane Smith" className={inputCls} />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Remarks</label>
            <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Initial context…" rows={3} className="w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm resize-none focus:border-accent focus:outline-none" />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => handleCreate(false)} disabled={creating || !form.company_name.trim()}>
              {creating ? "Creating…" : "Create Prospect"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Check, Plus, Trash2, Star, StarOff,
  Building2, Globe, MapPin, Briefcase, Calendar, Archive,
  AlertTriangle, X, UserPlus, History, Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { ActivityTab } from "@/components/prospects/ActivityTab";
import { ProposalTab } from "@/components/prospects/ProposalTab";
import { OnboardingTab } from "@/components/prospects/OnboardingTab";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api";

// ── Service Category Combobox (single-select, stores category name) ───────────

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

  const handleSelect = (name: string) => { onChange(name); setQuery(""); setOpen(false); };
  const handleClear = () => { onChange(""); setQuery(""); };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm text-foreground">
          {value}
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-danger">
            <X className="h-3 w-3" />
          </button>
        </span>
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
                <button type="button" onClick={() => handleSelect(cat.name)} className="flex-1 px-3 py-2 text-left text-sm text-foreground">
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

// ── Types ────────────────────────────────────────────────────────────────────

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
  company_id: string | null;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  lead_source: string | null;
  name: string | null;
  notes: string | null;
  owner_id: string | null;
  priority: string;
  service_required: string | null;
  estimated_value: number | null;
  currency: string;
  stage_id: string | null;
  probability: number | null;
  expected_close_date: string | null;
  loss_reason: string | null;
  close_date: string | null;
  final_amount: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  pipeline_stages: PipelineStage | null;
  companies: { id: string; name: string } | null;
};

type ProspectContact = {
  id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
};

type StageHistoryEntry = {
  id: string;
  changed_at: string;
  from_stage: { id: string; name: string } | null;
  to_stage: { id: string; name: string };
  changer: { id: string; email: string } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-surface-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "PKR", "INR"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const LEAD_SOURCES = [
  "Cold Outreach", "Referral", "Website Inquiry", "LinkedIn",
  "Event/Conference", "Existing Client", "Partner", "Advertisement", "Other",
];

const inputCls = "h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";
const selectCls = inputCls;

// ── Page component ────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { token, appRole } = useSessionProvider();

  const [prospect,   setProspect]   = React.useState<Prospect | null>(null);
  const [stages,     setStages]     = React.useState<PipelineStage[]>([]);
  const [contacts,   setContacts]   = React.useState<ProspectContact[]>([]);
  const [history,    setHistory]    = React.useState<StageHistoryEntry[]>([]);
  const [categories, setCategories] = React.useState<ServiceCategory[]>([]);

  const [loading,  setLoading]  = React.useState(true);
  const [error,    setError]    = React.useState<string | null>(null);
  const [saving,   setSaving]   = React.useState(false);
  const [actKey,   setActKey]   = React.useState(0);

  // Edit mode
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Partial<Prospect & { notes: string }>>({});

  // Stage change
  const [showStageModal, setShowStageModal] = React.useState(false);
  const [targetStage,    setTargetStage]    = React.useState<PipelineStage | null>(null);
  const [lossReason,     setLossReason]     = React.useState("");
  const [closeDate,      setCloseDate]      = React.useState("");
  const [finalAmount,    setFinalAmount]    = React.useState("");
  const [stageError,     setStageError]     = React.useState<string | null>(null);

  // Contact modal
  const [showContactModal, setShowContactModal] = React.useState(false);
  const [editingContact,   setEditingContact]   = React.useState<ProspectContact | null>(null);
  const [contactForm,      setContactForm]      = React.useState({
    name: "", job_title: "", email: "", phone: "", whatsapp: "", is_primary: false,
  });
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [savingContact, setSavingContact] = React.useState(false);
  const [contactDupes,  setContactDupes]  = React.useState<Array<{ id: string; prospect_code: string; company_name: string }>>([]);

  // Active tab
  const [tab, setTab] = React.useState<"details" | "contacts" | "history" | "activity" | "proposals" | "onboarding">("details");

  const canEdit = appRole === "super_admin" || appRole === "admin" || appRole === "bd_manager" || appRole === "bd_executive";

  // ── Load ────────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!token) return;
    apiGet("/api/service-categories", token)
      .then((data) => setCategories(data as ServiceCategory[]))
      .catch(() => {});
  }, [token]);

  React.useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      apiGet(`/api/prospects/${id}`, token),
      apiGet("/api/pipeline-stages", token).catch(() => []),
      apiGet(`/api/prospects/${id}/contacts`, token).catch(() => []),
      apiGet(`/api/prospects/${id}/stage-history`, token).catch(() => []),
    ])
      .then(([p, s, c, h]) => {
        setProspect(p as Prospect);
        setStages((s as PipelineStage[]).filter((st) => st.is_active));
        setContacts(c as ProspectContact[]);
        setHistory(h as StageHistoryEntry[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  // ── Edit prospect ────────────────────────────────────────────────────────────

  const startEdit = () => {
    if (!prospect) return;
    setEditForm({ ...prospect, notes: prospect.notes ?? "" });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!token || !prospect) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPut(`/api/prospects/${prospect.id}`, token, {
        company_name:        editForm.company_name,
        industry:            editForm.industry,
        country:             editForm.country,
        city:                editForm.city,
        website:             editForm.website,
        lead_source:         editForm.lead_source,
        name:                editForm.name,
        priority:            editForm.priority,
        service_required:    editForm.service_required,
        estimated_value:     editForm.estimated_value,
        currency:            editForm.currency,
        probability:         editForm.probability,
        expected_close_date: editForm.expected_close_date,
        notes:               (editForm as { notes?: string }).notes,
      });
      setProspect((prev) =>
        prev ? { ...prev, ...(updated as Prospect) } : (updated as Prospect)
      );
      setEditing(false);
      setActKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setEF = (k: string, v: unknown) => setEditForm((f) => ({ ...f, [k]: v }));

  const handleCreateCategory = async (name: string) => {
    if (!token) return;
    try {
      const created = await apiPost("/api/service-categories", token, { name });
      setCategories((prev) => [...prev, created as ServiceCategory]);
    } catch { /* ignore */ }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!token) return;
    try {
      await apiDelete(`/api/service-categories/${catId}`, token);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } catch { /* ignore */ }
  };

  // ── Stage change ─────────────────────────────────────────────────────────────

  const openStageModal = (stage: PipelineStage) => {
    setTargetStage(stage);
    setLossReason("");
    setCloseDate("");
    setFinalAmount("");
    setStageError(null);
    setShowStageModal(true);
  };

  const confirmStageChange = async () => {
    if (!token || !prospect || !targetStage) return;
    // Client-side validation before hitting the API
    if (targetStage.is_won && !closeDate) {
      setStageError("Please select a close date before marking as Won");
      return;
    }
    if (targetStage.is_lost && !lossReason.trim()) {
      setStageError("Please enter a loss reason before marking as Lost");
      return;
    }
    setSaving(true);
    setStageError(null);
    try {
      const payload: Record<string, unknown> = { stage_id: targetStage.id };
      if (targetStage.is_lost)  payload.loss_reason  = lossReason;
      if (targetStage.is_won)  { payload.close_date  = closeDate; payload.final_amount = Number(finalAmount); }
      const updated = await apiPut(`/api/prospects/${prospect.id}`, token, payload);
      setProspect((prev) => prev ? { ...prev, ...(updated as Prospect) } : (updated as Prospect));
      const newHistory = await apiGet(`/api/prospects/${id}/stage-history`, token);
      setHistory(newHistory as StageHistoryEntry[]);
      setShowStageModal(false);
      setActKey((k) => k + 1);
    } catch (e: unknown) {
      setStageError(e instanceof Error ? e.message : "Failed to change stage");
    } finally {
      setSaving(false);
    }
  };

  // ── Archive ──────────────────────────────────────────────────────────────────

  const toggleArchive = async () => {
    if (!token || !prospect) return;
    setSaving(true);
    try {
      const updated = await apiPatch(`/api/prospects/${prospect.id}`, token, {
        is_archived: !prospect.is_archived,
      });
      setProspect((prev) => prev ? { ...prev, ...(updated as Prospect) } : (updated as Prospect));
      setActKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Contacts ─────────────────────────────────────────────────────────────────

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm({ name: "", job_title: "", email: "", phone: "", whatsapp: "", is_primary: false });
    setContactError(null);
    setContactDupes([]);
    setShowContactModal(true);
  };

  const openEditContact = (c: ProspectContact) => {
    setEditingContact(c);
    setContactForm({
      name:       c.name,
      job_title:  c.job_title ?? "",
      email:      c.email    ?? "",
      phone:      c.phone    ?? "",
      whatsapp:   c.whatsapp ?? "",
      is_primary: c.is_primary,
    });
    setContactError(null);
    setContactDupes([]);
    setShowContactModal(true);
  };

  const saveContact = async (skip = false) => {
    if (!token || !prospect) return;
    if (!contactForm.name.trim()) { setContactError("Name is required"); return; }
    setSavingContact(true);
    setContactError(null);
    setContactDupes([]);
    try {
      const payload = { ...contactForm, skip_duplicate_check: skip };
      let result: unknown;
      if (editingContact) {
        result = await apiPut(
          `/api/prospects/${prospect.id}/contacts/${editingContact.id}`, token, payload
        );
        setContacts((prev) => prev.map((c) => c.id === editingContact.id ? result as ProspectContact : c));
      } else {
        result = await apiPost(`/api/prospects/${prospect.id}/contacts`, token, payload);
        setContacts((prev) => [...prev, result as ProspectContact]);
      }
      setShowContactModal(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      try {
        const parsed = JSON.parse(msg);
        if (parsed.duplicate_warning) { setContactDupes(parsed.matches); return; }
      } catch { /* not JSON */ }
      setContactError(msg);
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!token || !prospect) return;
    await apiDelete(`/api/prospects/${prospect.id}/contacts/${contactId}`, token);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  };

  const setPrimary = async (contact: ProspectContact) => {
    if (!token || !prospect) return;
    await apiPut(`/api/prospects/${prospect.id}/contacts/${contact.id}`, token, { is_primary: true });
    setContacts((prev) =>
      prev.map((c) => ({ ...c, is_primary: c.id === contact.id }))
    );
  };

  // ── Render guards ────────────────────────────────────────────────────────────

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  if (error && !prospect)
    return <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!prospect)
    return <p className="text-muted-foreground">Prospect not found.</p>;

  const currentStage = prospect.pipeline_stages;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/prospects")}
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {prospect.company_name ?? "Unnamed Prospect"}
              </h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[prospect.priority] ?? PRIORITY_COLORS.medium}`}>
                {prospect.priority}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground font-mono">{prospect.prospect_code}</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={saving}>
                  <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={startEdit}>Edit</Button>
                <Button
                  variant="secondary"
                  onClick={toggleArchive}
                  disabled={saving}
                  title={prospect.is_archived ? "Unarchive" : "Archive"}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {prospect.is_archived && (
        <div className="rounded-[16px] border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
          This prospect is archived and hidden from default views.
        </div>
      )}

      {/* Stage stepper */}
      <div className="rounded-[24px] border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Pipeline Stage</p>
          {currentStage && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${currentStage.is_won ? "bg-green-100 text-green-700" : currentStage.is_lost ? "bg-surface-muted text-muted-foreground" : "bg-blue-100 text-blue-700"}`}>
              {currentStage.name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {stages.map((s) => {
            const isCurrent = s.id === prospect.stage_id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!canEdit || isCurrent}
                onClick={() => canEdit && !isCurrent && openStageModal(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isCurrent
                    ? "border-foreground bg-foreground text-background"
                    : canEdit
                    ? "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground cursor-pointer"
                    : "border-border text-muted-foreground cursor-default"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>

        {prospect.probability != null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Probability: <span className="font-semibold text-foreground">{prospect.probability}%</span>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["details", "contacts", "history", "activity", "proposals", "onboarding"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "contacts" ? `Contacts (${contacts.length})` : t === "history" ? `Stage History (${history.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Details tab ─────────────────────────────────────────────────────── */}
      {tab === "details" && (
        <div className="rounded-[24px] border border-border bg-surface p-6 space-y-5">
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">Company Name</label>
                <input value={editForm.company_name ?? ""} onChange={(e) => setEF("company_name", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Industry</label>
                <input value={editForm.industry ?? ""} onChange={(e) => setEF("industry", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Country</label>
                <input value={editForm.country ?? ""} onChange={(e) => setEF("country", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">City</label>
                <input value={editForm.city ?? ""} onChange={(e) => setEF("city", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Website</label>
                <input value={editForm.website ?? ""} onChange={(e) => setEF("website", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Lead Source</label>
                <select value={editForm.lead_source ?? ""} onChange={(e) => setEF("lead_source", e.target.value)} className={selectCls}>
                  <option value="">—</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <select value={editForm.priority ?? "medium"} onChange={(e) => setEF("priority", e.target.value)} className={selectCls}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Service Required</label>
                <ServiceCategoryCombobox
                  value={editForm.service_required ?? ""}
                  categories={categories}
                  canCreate={appRole === "admin"}
                  onChange={(v) => setEF("service_required", v || null)}
                  onCreate={handleCreateCategory}
                  onDelete={handleDeleteCategory}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Estimated Value</label>
                <input type="number" value={editForm.estimated_value ?? ""} onChange={(e) => setEF("estimated_value", e.target.value ? Number(e.target.value) : null)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Currency</label>
                <select value={editForm.currency ?? "USD"} onChange={(e) => setEF("currency", e.target.value)} className={selectCls}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Probability (%)</label>
                <input type="number" min="0" max="100" value={editForm.probability ?? ""} onChange={(e) => setEF("probability", e.target.value ? Number(e.target.value) : null)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Expected Close Date</label>
                <input type="date" value={editForm.expected_close_date ?? ""} onChange={(e) => setEF("expected_close_date", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Contact Name</label>
                <input value={editForm.name ?? ""} onChange={(e) => setEF("name", e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">Remarks</label>
                <textarea value={(editForm as { notes?: string }).notes ?? ""} onChange={(e) => setEF("notes", e.target.value)} rows={3} className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none" />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <DetailRow label="Company" icon={<Building2 className="h-3.5 w-3.5" />} value={prospect.company_name} />
              <DetailRow label="Industry" value={prospect.industry} />
              <DetailRow label="Country" icon={<MapPin className="h-3.5 w-3.5" />} value={prospect.country} />
              <DetailRow label="City" value={prospect.city} />
              {prospect.website && (
                <div className="col-span-2">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5"><Globe className="h-3.5 w-3.5" /> Website</dt>
                  <dd><a href={prospect.website} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{prospect.website}</a></dd>
                </div>
              )}
              <DetailRow label="Lead Source" value={prospect.lead_source} />
              <DetailRow label="Service Required" icon={<Briefcase className="h-3.5 w-3.5" />} value={prospect.service_required} />
              {prospect.name && <DetailRow label="Contact Person" value={prospect.name} />}
              <DetailRow
                label="Estimated Value"
                value={prospect.estimated_value != null ? `${prospect.currency} ${prospect.estimated_value.toLocaleString()}` : null}
              />
              <DetailRow
                label="Expected Close"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={prospect.expected_close_date ? new Date(prospect.expected_close_date).toLocaleDateString() : null}
              />
              {currentStage?.is_won && prospect.close_date && (
                <>
                  <DetailRow label="Close Date" value={new Date(prospect.close_date).toLocaleDateString()} />
                  <DetailRow label="Final Amount" value={`${prospect.currency} ${prospect.final_amount?.toLocaleString()}`} />
                </>
              )}
              {currentStage?.is_lost && prospect.loss_reason && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Loss Reason</dt>
                  <dd className="text-foreground">{prospect.loss_reason}</dd>
                </div>
              )}
              {prospect.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Remarks</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{prospect.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* ── Contacts tab ────────────────────────────────────────────────────── */}
      {tab === "contacts" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={openNewContact}><UserPlus className="h-4 w-4" /> Add Contact</Button>
            </div>
          )}
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No contacts yet</p>
              {canEdit && <Button onClick={openNewContact}><Plus className="h-4 w-4" /> Add Contact</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-4 rounded-[18px] border border-border bg-surface p-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{c.name}</span>
                      {c.is_primary && (
                        <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">Primary</span>
                      )}
                    </div>
                    {c.job_title && <p className="text-xs text-muted-foreground">{c.job_title}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {c.email    && <span>{c.email}</span>}
                      {c.phone    && <span>{c.phone}</span>}
                      {c.whatsapp && <span>WA: {c.whatsapp}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      {!c.is_primary && (
                        <button title="Set as primary" onClick={() => setPrimary(c)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition">
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      {c.is_primary && (
                        <button title="Primary" className="rounded-lg p-1.5 text-yellow-500 cursor-default">
                          <StarOff className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => openEditContact(c)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteContact(c.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-danger hover:bg-surface-muted transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stage History tab ────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-10 text-center">
              <History className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No stage changes recorded yet</p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
              {history.map((h) => (
                <div key={h.id} className="relative mb-4">
                  <div className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full border-2 border-accent bg-background" />
                  <div className="rounded-[16px] border border-border bg-surface p-3">
                    <div className="flex items-center gap-2 text-sm">
                      {h.from_stage && (
                        <span className="text-muted-foreground">{h.from_stage.name}</span>
                      )}
                      {h.from_stage && <span className="text-muted-foreground">→</span>}
                      <span className="font-semibold text-foreground">{h.to_stage.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.changer?.email ?? "Unknown"} · {new Date(h.changed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity tab ─────────────────────────────────────────────────────── */}
      {tab === "activity" && (
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <ActivityTab
            prospectId={prospect.id}
            token={token}
            canEdit={canEdit}
            actKey={actKey}
          />
        </div>
      )}

      {/* ── Proposals tab ────────────────────────────────────────────────────── */}
      {tab === "proposals" && (
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <ProposalTab
            prospectId={prospect.id}
            token={token}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* ── Onboarding tab ───────────────────────────────────────────────────── */}
      {tab === "onboarding" && (
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <OnboardingTab
            prospectId={prospect.id}
            token={token}
            canEdit={canEdit}
            appRole={appRole ?? "viewer"}
          />
        </div>
      )}

      {/* ── Stage change modal ────────────────────────────────────────────────── */}
      <Modal
        open={showStageModal}
        title={`Move to: ${targetStage?.name ?? ""}`}
        onClose={() => setShowStageModal(false)}
      >
        <div className="space-y-4">
          {targetStage?.is_lost && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Loss Reason <span className="text-danger">*</span>
              </label>
              <textarea
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="Why was this deal lost?"
                rows={3}
                className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}
          {targetStage?.is_won && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Close Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => { setCloseDate(e.target.value); if (stageError) setStageError(null); }}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Final Amount ({prospect.currency}) <span className="text-danger">*</span>
                </label>
                <input type="number" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
            </>
          )}
          {!targetStage?.is_lost && !targetStage?.is_won && (
            <p className="text-sm text-muted-foreground">
              This will move the prospect to <strong>{targetStage?.name}</strong> and record the change in history.
            </p>
          )}
          {stageError && (
            <div className="flex items-center gap-2 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {stageError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowStageModal(false)}>Cancel</Button>
            <Button onClick={confirmStageChange} disabled={saving}>
              {saving ? "Moving…" : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Contact modal ────────────────────────────────────────────────────── */}
      <Modal
        open={showContactModal}
        title={editingContact ? "Edit Contact" : "Add Contact"}
        onClose={() => setShowContactModal(false)}
      >
        <div className="space-y-4">
          {contactDupes.length > 0 && (
            <div className="rounded-[14px] border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4" /> Duplicate contact detected
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">This email/phone appears in other prospects:</p>
              <ul className="space-y-1">
                {contactDupes.map((d) => (
                  <li key={d.id} className="text-xs">
                    <Link href={`/prospects/${d.id}`} target="_blank" className="text-accent hover:underline">
                      {d.prospect_code} — {d.company_name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => saveContact(true)}>Proceed anyway</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-foreground">Name <span className="text-danger">*</span></label>
              <input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Job Title</label>
              <input value={contactForm.job_title} onChange={(e) => setContactForm((f) => ({ ...f, job_title: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Business Email</label>
              <input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">WhatsApp</label>
              <input value={contactForm.whatsapp} onChange={(e) => setContactForm((f) => ({ ...f, whatsapp: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={contactForm.is_primary}
              onChange={(e) => setContactForm((f) => ({ ...f, is_primary: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Set as primary contact
          </label>
          {contactError && <p className="text-sm text-danger">{contactError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowContactModal(false)}>Cancel</Button>
            <Button onClick={() => saveContact(false)} disabled={savingContact}>
              {savingContact ? "Saving…" : editingContact ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────────

function DetailRow({
  label, value, icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon} {label}
      </dt>
      <dd className="text-sm text-foreground">
        {value ?? <span className="italic text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  FileText, Plus, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Clock, Send, Eye, Handshake, AlertCircle, History,
  ArrowRight, GitCommit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProposalStatus =
  | "internal_review"
  | "proposal_sent"
  | "client_reviewing"
  | "negotiation"
  | "won"
  | "lost";

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  amount: number;
  currency: string;
  validity_days: number;
  valid_until: string | null;
  submitted_at: string;
  expected_close_date: string | null;
  status: ProposalStatus;
  approval_status: "pending" | "approved" | "rejected";
  remarks: string | null;
  is_accepted: boolean;
  owner_id: string;
};

type Revision = {
  id: string;
  revision_number: number;
  amount: number;
  currency: string;
  validity_days: number;
  notes: string | null;
  created_at: string;
  created_by_profile: { full_name: string; email: string } | null;
};

type StatusEntry = {
  id: string;
  from_status: ProposalStatus | null;
  to_status: ProposalStatus;
  changed_at: string;
  note: string | null;
  changed_by_profile: { full_name: string; email: string } | null;
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProposalStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  internal_review:  { label: "Internal Review",  cls: "bg-blue-500/15 text-blue-400",   Icon: Clock },
  proposal_sent:    { label: "Proposal Sent",    cls: "bg-sky-500/15 text-sky-400",     Icon: Send },
  client_reviewing: { label: "Client Reviewing", cls: "bg-violet-500/15 text-violet-400", Icon: Eye },
  negotiation:      { label: "Negotiation",      cls: "bg-amber-500/15 text-amber-400", Icon: Handshake },
  won:              { label: "Won",              cls: "bg-emerald-500/15 text-emerald-400", Icon: CheckCircle2 },
  lost:             { label: "Lost",             cls: "bg-rose-500/15 text-rose-400",   Icon: XCircle },
};

const STATUS_FLOW: ProposalStatus[] = [
  "internal_review", "proposal_sent", "client_reviewing", "negotiation", "won", "lost",
];

const ACTIVE_STATUSES = new Set<ProposalStatus>([
  "internal_review", "proposal_sent", "client_reviewing", "negotiation",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(amount);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isNearExpiry(valid_until: string | null): boolean {
  if (!valid_until) return false;
  const days = Math.ceil((new Date(valid_until).getTime() - Date.now()) / 86_400_000);
  return days >= 0 && days <= 7;
}

function isExpired(valid_until: string | null): boolean {
  if (!valid_until) return false;
  return new Date(valid_until).getTime() < Date.now();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  prospectId: string;
  token: string | null;
  canEdit: boolean;
}

export function ProposalTab({ prospectId, token, canEdit }: Props) {
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [revisions, setRevisions] = React.useState<Record<string, Revision[]>>({});
  const [statusHistory, setStatusHistory] = React.useState<Record<string, StatusEntry[]>>({});
  const [revisionsLoading, setRevisionsLoading] = React.useState<Record<string, boolean>>({});

  // Modals
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Proposal | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<Proposal | null>(null);

  // Create form
  const [cTitle, setCTitle] = React.useState("");
  const [cAmount, setCAmount] = React.useState("");
  const [cCurrency, setCCurrency] = React.useState("USD");
  const [cValidity, setCValidity] = React.useState("30");
  const [cCloseDate, setCCloseDate] = React.useState("");
  const [cRemarks, setCRemarks] = React.useState("");
  const [cSaving, setCSaving] = React.useState(false);

  // Edit form
  const [eTitle, setETitle] = React.useState("");
  const [eAmount, setEAmount] = React.useState("");
  const [eValidity, setEValidity] = React.useState("");
  const [eCloseDate, setECloseDate] = React.useState("");
  const [eRemarks, setERemarks] = React.useState("");
  const [eSaving, setESaving] = React.useState(false);

  // Status form
  const [newStatus, setNewStatus] = React.useState<ProposalStatus>("proposal_sent");
  const [statusNote, setStatusNote] = React.useState("");
  const [sSaving, setSSaving] = React.useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    setLoading(true);
    apiGet(`/api/prospects/${prospectId}/proposals`, token)
      .then((data) => setProposals(Array.isArray(data) ? (data as Proposal[]) : []))
      .finally(() => setLoading(false));
  }, [prospectId, token]);

  // ── Revisions toggle ────────────────────────────────────────────────────────

  async function toggleRevisions(proposalId: string) {
    if (expandedId === proposalId) { setExpandedId(null); return; }
    setExpandedId(proposalId);
    if (revisions[proposalId]) return;
    setRevisionsLoading((prev) => ({ ...prev, [proposalId]: true }));
    try {
      const [revData, shData] = await Promise.all([
        apiGet(`/api/proposals/${proposalId}/revisions`, token),
        apiGet(`/api/proposals/${proposalId}/status-history`, token),
      ]);
      setRevisions((prev) => ({ ...prev, [proposalId]: Array.isArray(revData) ? (revData as Revision[]) : [] }));
      setStatusHistory((prev) => ({ ...prev, [proposalId]: Array.isArray(shData) ? (shData as StatusEntry[]) : [] }));
    } finally {
      setRevisionsLoading((prev) => ({ ...prev, [proposalId]: false }));
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async function createProposal() {
    if (!cTitle.trim() || !cAmount) return;
    setCSaving(true);
    try {
      const data = await apiPost(`/api/prospects/${prospectId}/proposals`, token, {
        title:               cTitle.trim(),
        amount:              parseFloat(cAmount),
        currency:            cCurrency,
        validity_days:       parseInt(cValidity, 10),
        expected_close_date: cCloseDate || null,
        remarks:             cRemarks || null,
      });
      setProposals((prev) => [data as Proposal, ...prev]);
      setCreateOpen(false);
      setCTitle(""); setCAmount(""); setCCurrency("USD"); setCValidity("30");
      setCCloseDate(""); setCRemarks("");
    } finally {
      setCSaving(false);
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(p: Proposal) {
    setEditTarget(p);
    setETitle(p.title);
    setEAmount(String(p.amount));
    setEValidity(String(p.validity_days));
    setECloseDate(p.expected_close_date ?? "");
    setERemarks(p.remarks ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setESaving(true);
    try {
      const data = await apiPatch(`/api/proposals/${editTarget.id}`, token, {
        title:               eTitle.trim(),
        amount:              parseFloat(eAmount),
        validity_days:       parseInt(eValidity, 10),
        expected_close_date: eCloseDate || null,
        remarks:             eRemarks || null,
      });
      setProposals((prev) => prev.map((p) => p.id === editTarget.id ? (data as Proposal) : p));
      // Invalidate cached revisions so next expand re-fetches
      setRevisions((prev) => { const n = { ...prev }; delete n[editTarget.id]; return n; });
      setEditOpen(false);
    } finally {
      setESaving(false);
    }
  }

  // ── Status change ────────────────────────────────────────────────────────────

  function openStatus(p: Proposal) {
    setStatusTarget(p);
    const cur = STATUS_FLOW.indexOf(p.status);
    const next = STATUS_FLOW[cur + 1] ?? p.status;
    setNewStatus(next);
    setStatusNote("");
    setStatusOpen(true);
  }

  async function saveStatus() {
    if (!statusTarget) return;
    setSSaving(true);
    try {
      const data = await apiPost(`/api/proposals/${statusTarget.id}/status`, token, {
        status: newStatus,
        note:   statusNote || null,
      });
      setProposals((prev) => prev.map((p) => p.id === statusTarget.id ? (data as Proposal) : p));
      // Invalidate so next expand re-fetches fresh history
      setStatusHistory((prev) => { const n = { ...prev }; delete n[statusTarget.id]; return n; });
      setRevisions((prev) => { const n = { ...prev }; delete n[statusTarget.id]; return n; });
      setStatusOpen(false);
    } finally {
      setSSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading proposals…</div>;
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Proposals</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {proposals.length} total · {proposals.filter((p) => ACTIVE_STATUSES.has(p.status)).length} active
          </p>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Proposal
          </Button>
        )}
      </div>

      {/* List */}
      {proposals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <FileText size={28} className="mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No proposals yet.</p>
          {canEdit && (
            <button type="button" onClick={() => setCreateOpen(true)}
              className="mt-2 text-xs text-accent hover:underline">
              Create the first proposal →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => {
            const cfg = STATUS_CONFIG[p.status];
            const StatusIcon = cfg.Icon;
            const expanded = expandedId === p.id;
            const expiry = isExpired(p.valid_until);
            const nearExpiry = !expiry && isNearExpiry(p.valid_until);

            return (
              <div key={p.id} className="rounded-2xl border border-border bg-surface-muted overflow-hidden">

                {/* ── Top bar: number + status badges ── */}
                <div className="flex items-center justify-between px-5 pt-5 pb-0 gap-3 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground tracking-wide">{p.proposal_number}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.cls}`}>
                      <StatusIcon size={11} /> {cfg.label}
                    </span>
                    {p.is_accepted && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 size={11} /> Accepted
                      </span>
                    )}
                    {nearExpiry && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400">
                        <AlertCircle size={11} /> Expiring soon
                      </span>
                    )}
                    {expiry && p.status !== "won" && p.status !== "lost" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-rose-500/15 text-rose-400">
                        <AlertCircle size={11} /> Expired
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Title + amount row ── */}
                <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-lg text-foreground leading-snug truncate">{p.title}</p>
                    <div className="mt-1.5 flex items-center gap-2.5 text-sm text-muted-foreground flex-wrap">
                      <span>Valid until <strong className="text-foreground">{fmtDate(p.valid_until)}</strong> ({p.validity_days}d)</span>
                      {p.expected_close_date && (
                        <><span>·</span><span>Close <strong className="text-foreground">{fmtDate(p.expected_close_date)}</strong></span></>
                      )}
                    </div>
                    {p.remarks && (
                      <p className="mt-2 text-sm text-muted-foreground/80 italic border-l-2 border-border pl-3 line-clamp-2">{p.remarks}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{fmtCurrency(p.amount, p.currency)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.currency}</p>
                  </div>
                </div>

                {/* ── Actions ── */}
                {canEdit && (
                  <div className="flex items-center gap-2 px-5 pb-4">
                    {p.status !== "won" && p.status !== "lost" && (
                      <button type="button" onClick={() => openStatus(p)}
                        className="inline-flex items-center rounded-xl bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5 text-sm font-medium transition-colors">
                        Change status
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(p)}
                      className="inline-flex items-center rounded-xl bg-surface border border-border hover:bg-surface-elevated px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Edit terms
                    </button>
                  </div>
                )}

                {/* ── History toggle ── */}
                <button
                  type="button"
                  onClick={() => toggleRevisions(p.id)}
                  className="w-full flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground hover:bg-surface transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <History size={14} /> History
                  </span>
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* History panel */}
                {expanded && (
                  <div className="border-t border-border bg-surface px-5 py-5 space-y-6">
                    {revisionsLoading[p.id] ? (
                      <p className="text-xs text-muted-foreground py-2">Loading…</p>
                    ) : (
                      <>
                        {/* ── Revision History (term changes only) ── */}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                            <GitCommit size={11} /> Revision History
                          </p>
                          {(revisions[p.id] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No term revisions.</p>
                          ) : (
                            <ol className="space-y-3">
                              {(revisions[p.id] ?? []).map((r, idx) => {
                                const prev = (revisions[p.id] ?? [])[idx - 1] ?? null;
                                const diffs: string[] = [];
                                if (prev) {
                                  if (Number(r.amount) !== Number(prev.amount))
                                    diffs.push(`Amount: ${fmtCurrency(prev.amount, prev.currency)} → ${fmtCurrency(r.amount, r.currency)}`);
                                  if (Number(r.validity_days) !== Number(prev.validity_days))
                                    diffs.push(`Validity: ${prev.validity_days}d → ${r.validity_days}d`);
                                  if ((r.notes ?? "") !== (prev.notes ?? ""))
                                    diffs.push(`Notes updated`);
                                }
                                return (
                                  <li key={r.id} className="flex items-start gap-3 text-sm">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-surface-muted border border-border flex items-center justify-center font-mono text-[11px] text-muted-foreground mt-0.5">
                                      {r.revision_number}
                                    </span>
                                    <div className="min-w-0">
                                      {idx === 0 ? (
                                        <span className="text-muted-foreground">
                                          Initial — {fmtCurrency(r.amount, r.currency)}, {r.validity_days}d validity
                                          {r.notes && <span className="italic ml-1">— {r.notes}</span>}
                                        </span>
                                      ) : diffs.length > 0 ? (
                                        <ul className="space-y-1">
                                          {diffs.map((d, i) => (
                                            <li key={i} className="flex items-center gap-1.5 text-foreground">
                                              <ArrowRight size={12} className="shrink-0 text-accent" />
                                              {d}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="text-muted-foreground">No term changes (notes only)</span>
                                      )}
                                      <div className="text-xs text-muted-foreground/70 mt-1">
                                        {fmtDate(r.created_at)} by {r.created_by_profile?.full_name ?? "—"}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </div>

                        {/* ── Status History ── */}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                            <GitCommit size={11} /> Status History
                          </p>
                          {(statusHistory[p.id] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No status changes recorded.</p>
                          ) : (
                            <ol className="space-y-3">
                              {(statusHistory[p.id] ?? []).map((s) => {
                                const fromCfg = s.from_status ? STATUS_CONFIG[s.from_status] : null;
                                const toCfg = STATUS_CONFIG[s.to_status];
                                return (
                                  <li key={s.id} className="flex items-start gap-3 text-sm">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-surface-muted border border-border flex items-center justify-center mt-0.5">
                                      <toCfg.Icon size={11} className="text-muted-foreground" />
                                    </span>
                                    <div className="min-w-0">
                                      <span className="text-foreground">
                                        {fromCfg ? (
                                          <><span className={`font-medium ${fromCfg.cls} rounded-full px-2 py-0.5`}>{fromCfg.label}</span>
                                          <ArrowRight size={12} className="inline mx-1.5 text-muted-foreground" />
                                          <span className={`font-medium ${toCfg.cls} rounded-full px-2 py-0.5`}>{toCfg.label}</span></>
                                        ) : (
                                          <span className={`font-medium ${toCfg.cls} rounded-full px-2 py-0.5`}>{toCfg.label}</span>
                                        )}
                                      </span>
                                      {s.note && <span className="ml-2 italic text-muted-foreground">— {s.note}</span>}
                                      <div className="text-xs text-muted-foreground/70 mt-1">
                                        {fmtDate(s.changed_at)} by {s.changed_by_profile?.full_name ?? "—"}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Proposal">
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input
              value={cTitle} onChange={(e) => setCTitle(e.target.value)}
              placeholder="e.g. Brand Management Package Q1"
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount *</label>
              <input
                type="number" min="0" step="0.01"
                value={cAmount} onChange={(e) => setCAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select
                value={cCurrency} onChange={(e) => setCCurrency(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {["USD","EUR","GBP","AED","PKR","INR"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Validity (days)</label>
              <input
                type="number" min="1"
                value={cValidity} onChange={(e) => setCValidity(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Close</label>
              <input
                type="date"
                value={cCloseDate} onChange={(e) => setCCloseDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Remarks</label>
            <textarea
              rows={3} value={cRemarks} onChange={(e) => setCRemarks(e.target.value)}
              placeholder="Any notes or context…"
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={createProposal}
              disabled={cSaving || !cTitle.trim() || !cAmount}>
              {cSaving ? "Creating…" : "Create Proposal"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Proposal Terms">
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Changing amount, validity, or remarks creates a new revision automatically.
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input
              value={eTitle} onChange={(e) => setETitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
              <input
                type="number" min="0" step="0.01"
                value={eAmount} onChange={(e) => setEAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Validity (days)</label>
              <input
                type="number" min="1"
                value={eValidity} onChange={(e) => setEValidity(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Close</label>
            <input
              type="date"
              value={eCloseDate} onChange={(e) => setECloseDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Remarks</label>
            <textarea
              rows={3} value={eRemarks} onChange={(e) => setERemarks(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={saveEdit} disabled={eSaving}>
              {eSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Status Modal ──────────────────────────────────────────────────────── */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change Proposal Status">
        <div className="space-y-4 p-4">
          {statusTarget && (
            <p className="text-xs text-muted-foreground">
              Current: <strong>{STATUS_CONFIG[statusTarget.status].label}</strong>
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New Status *</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ProposalStatus)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s} disabled={s === statusTarget?.status}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Note (optional)</label>
            <textarea
              rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Reason for status change…"
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={saveStatus}
              disabled={sSaving || newStatus === statusTarget?.status}>
              {sSaving ? "Updating…" : "Update Status"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

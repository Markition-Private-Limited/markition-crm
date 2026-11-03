"use client";

import * as React from "react";
import Link from "next/link";
import {
  Folder, FolderOpen, CheckCircle2, XCircle, Clock, AlertTriangle,
  Upload, ChevronDown, ChevronUp, Plus, ThumbsUp, ThumbsDown,
  FileCheck, AlertCircle, RefreshCw, Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPatch, apiDelete, clearCache } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type CaseStatus = "in_progress" | "approved" | "rejected";
type ItemStatus = "not_uploaded" | "uploaded" | "under_review" | "approved" | "rejected";

type Profile = { full_name: string | null; email: string | null } | null;

type ChecklistItem = {
  id: string;
  document_name: string;
  is_mandatory: boolean;
  status: ItemStatus;
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string | null;
  uploaded_by_profile: Profile;
  reviewed_at: string | null;
  reviewed_by_profile: Profile;
  review_remark: string | null;
};

type OnboardingCase = {
  id: string;
  onboarding_number: string;
  status: CaseStatus;
  customer_type_snapshot: string | null;
  jurisdiction_snapshot: string | null;
  no_matching_templates: boolean;
  started_at: string;
  started_by_profile: Profile;
  final_reviewed_at: string | null;
  final_reviewed_by_profile: Profile;
  final_review_note: string | null;
  checklist: ChecklistItem[];
};

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  is_accepted: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CASE_STATUS: Record<CaseStatus, { label: string; cls: string }> = {
  in_progress: { label: "In Progress", cls: "bg-blue-500/15 text-blue-400" },
  approved:    { label: "Approved",    cls: "bg-emerald-500/15 text-emerald-400" },
  rejected:    { label: "Rejected",    cls: "bg-rose-500/15 text-rose-400" },
};

const ITEM_STATUS: Record<ItemStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  not_uploaded:  { label: "Not uploaded",  cls: "bg-surface-muted text-muted-foreground", Icon: AlertCircle },
  uploaded:      { label: "Uploaded",      cls: "bg-sky-500/15 text-sky-400",             Icon: Upload },
  under_review:  { label: "Under review",  cls: "bg-amber-500/15 text-amber-400",         Icon: Clock },
  approved:      { label: "Approved",      cls: "bg-emerald-500/15 text-emerald-400",     Icon: CheckCircle2 },
  rejected:      { label: "Rejected",      cls: "bg-rose-500/15 text-rose-400",           Icon: XCircle },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

// ── Main Component ─────────────────────────────────────────────────────────────

export function OnboardingTab({
  prospectId,
  token,
  canEdit,
  appRole,
}: {
  prospectId: string;
  token: string | null;
  canEdit: boolean;
  appRole: string;
}) {
  const isManager = appRole === "bd_manager" || appRole === "admin" || appRole === "super_admin";

  const [cases, setCases] = React.useState<OnboardingCase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [caseDetails, setCaseDetails] = React.useState<Record<string, OnboardingCase>>({});

  // Modals
  const [showStart, setShowStart] = React.useState(false);
  const [allProposals, setAllProposals] = React.useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = React.useState(false);
  const [selectedProposal, setSelectedProposal] = React.useState("");
  const [starting, setStarting] = React.useState(false);
  const [startError, setStartError] = React.useState("");

  const [uploadModal, setUploadModal] = React.useState<{ caseId: string; item: ChecklistItem } | null>(null);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const [reviewModal, setReviewModal] = React.useState<{ caseId: string; item: ChecklistItem; action: "approve" | "reject" } | null>(null);
  const [reviewRemark, setReviewRemark] = React.useState("");
  const [reviewing, setReviewing] = React.useState(false);

  const [finalModal, setFinalModal] = React.useState<{ obc: OnboardingCase; action: "approve" | "reject" } | null>(null);
  const [finalNote, setFinalNote] = React.useState("");
  const [finalizing, setFinalizing] = React.useState(false);
  const [finalError, setFinalError] = React.useState("");

  const [refreshing, setRefreshing] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  const [deleteModal, setDeleteModal] = React.useState<OnboardingCase | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Load cases list
  const loadCases = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/prospects/${prospectId}/onboarding`, token);
      setCases((data as OnboardingCase[]) ?? []);
    } catch { /* handled below */ }
    setLoading(false);
  }, [prospectId, token]);

  React.useEffect(() => { loadCases(); }, [loadCases]);

  // Toggle a case open — fetch details incl. checklist
  const toggleCase = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (caseDetails[id]) return;
    try {
      const data = await apiGet(`/api/onboarding/${id}`, token);
      setCaseDetails((prev) => ({ ...prev, [id]: data as OnboardingCase }));
    } catch { /* ignore */ }
  };

  // Start onboarding modal — load all proposals, highlight won ones
  const openStart = async () => {
    setStartError("");
    setSelectedProposal("");
    setAllProposals([]);
    setShowStart(true);
    setProposalsLoading(true);
    try {
      const data = await apiGet(`/api/prospects/${prospectId}/proposals`, token);
      setAllProposals((data as Proposal[]) ?? []);
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : "Failed to load proposals — please try again");
    }
    setProposalsLoading(false);
  };

  const wonProposals = allProposals.filter((p) => p.is_accepted);

  const confirmStart = async () => {
    if (!selectedProposal) { setStartError("Select a proposal"); return; }
    setStarting(true);
    setStartError("");
    try {
      await apiPost(`/api/prospects/${prospectId}/onboarding`, token, { proposal_id: selectedProposal });
      setShowStart(false);
      await loadCases();
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : "Failed to start onboarding");
    }
    setStarting(false);
  };

  // Upload a document
  const openUpload = (caseId: string, item: ChecklistItem) => {
    setUploadFile(null);
    setUploadError(null);
    setUploadModal({ caseId, item });
  };

  const confirmUpload = async () => {
    if (!uploadModal || !uploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await fetch(
        `/api/onboarding/${uploadModal.caseId}/checklist/${uploadModal.item.id}/upload`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        setUploadError((err as { error?: string }).error ?? "Upload failed");
        setUploading(false);
        return;
      }
      clearCache();
      const updated = await apiGet(`/api/onboarding/${uploadModal.caseId}`, token);
      setCaseDetails((prev) => ({ ...prev, [uploadModal!.caseId]: updated as OnboardingCase }));
      setUploadModal(null);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
  };

  // Review actions
  const openReview = (caseId: string, item: ChecklistItem, action: "approve" | "reject") => {
    setReviewRemark("");
    setReviewModal({ caseId, item, action });
  };

  const confirmReview = async () => {
    if (!reviewModal) return;
    setReviewing(true);
    try {
      await apiPatch(
        `/api/onboarding/${reviewModal.caseId}/checklist/${reviewModal.item.id}`,
        token,
        { action: reviewModal.action, remark: reviewRemark || undefined }
      );
      const updated = await apiGet(`/api/onboarding/${reviewModal.caseId}`, token);
      setCaseDetails((prev) => ({ ...prev, [reviewModal.caseId]: updated as OnboardingCase }));
      setReviewModal(null);
    } catch { /* ignore */ }
    setReviewing(false);
  };

  // Apply templates retroactively to a no-match case
  const applyTemplates = async (caseId: string) => {
    setRefreshing(caseId);
    setRefreshError(null);
    try {
      const result = await apiPatch(`/api/onboarding/${caseId}`, token, { action: "refresh_checklist" }) as { inserted: number };
      if (result.inserted === 0) {
        setRefreshError("No active templates match this case. Make sure your Document Templates have no customer type / jurisdiction filter, or that they match this prospect.");
      } else {
        const updated = await apiGet(`/api/onboarding/${caseId}`, token);
        setCaseDetails((prev) => ({ ...prev, [caseId]: updated as OnboardingCase }));
        await loadCases();
      }
    } catch (e: unknown) {
      setRefreshError(e instanceof Error ? e.message : "Failed to apply templates");
    }
    setRefreshing(null);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/onboarding/${deleteModal.id}`, token);
      setDeleteModal(null);
      setCaseDetails((prev) => {
        const next = { ...prev };
        delete next[deleteModal.id];
        return next;
      });
      await loadCases();
    } catch { /* ignore */ }
    setDeleting(false);
  };

  // Final case approval
  const openFinal = (obc: OnboardingCase, action: "approve" | "reject") => {
    setFinalNote("");
    setFinalError("");
    setFinalModal({ obc, action });
  };

  const confirmFinal = async () => {
    if (!finalModal) return;
    setFinalizing(true);
    setFinalError("");
    try {
      await apiPatch(`/api/onboarding/${finalModal.obc.id}`, token, {
        action: finalModal.action,
        note: finalNote || undefined,
      });
      setFinalModal(null);
      await loadCases();
      setCaseDetails((prev) => {
        const next = { ...prev };
        delete next[finalModal.obc.id];
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to finalize";
      setFinalError(msg.replace(/^.*?:\s*/, ""));
    }
    setFinalizing(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Onboarding</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Document collection for won deals</p>
        </div>
        {canEdit && (
          <Button onClick={openStart}>
            <Plus className="h-4 w-4" /> Start Onboarding
          </Button>
        )}
      </div>

      {/* Cases list */}
      {cases.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-10 text-center">
          <Folder className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No onboarding cases yet</p>
          {canEdit && (
            <button type="button" onClick={openStart} className="mt-1 text-xs text-accent hover:underline">
              Start from a Won proposal →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((obc) => {
            const detail = caseDetails[obc.id] ?? null;
            const expanded = expandedId === obc.id;
            const caseCfg = CASE_STATUS[obc.status];

            // Compute missing/outstanding from detail
            const missingCount = detail
              ? detail.checklist.filter(
                  (i) => i.is_mandatory && i.status !== "approved"
                ).length
              : null;

            return (
              <div key={obc.id} className="rounded-2xl border border-border bg-surface-muted overflow-hidden">

                {/* ── Case top bar ── */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 gap-3 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground tracking-wide">
                    {obc.onboarding_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${caseCfg.cls}`}>
                      {caseCfg.label}
                    </span>
                    {obc.no_matching_templates && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400">
                        <AlertTriangle size={11} /> No templates matched
                      </span>
                    )}
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal(obc)}
                        className="inline-flex items-center justify-center rounded-xl p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        title="Delete onboarding case"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Snapshot info ── */}
                <div className="px-5 pb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      {obc.customer_type_snapshot && (
                        <span>Type: <strong className="text-foreground">{obc.customer_type_snapshot}</strong></span>
                      )}
                      {obc.jurisdiction_snapshot && (
                        <>
                          {obc.customer_type_snapshot && <span>·</span>}
                          <span>Jurisdiction: <strong className="text-foreground">{obc.jurisdiction_snapshot}</strong></span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started {fmtDate(obc.started_at)}
                    </p>
                    {obc.final_reviewed_at && (
                      <p className="text-xs text-muted-foreground">
                        {obc.status === "approved" ? "Approved" : "Rejected"} {fmtDate(obc.final_reviewed_at)}
                        {obc.final_review_note && ` — ${obc.final_review_note}`}
                      </p>
                    )}
                  </div>
                  {missingCount !== null && missingCount > 0 && (
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold text-rose-400 tabular-nums">{missingCount}</p>
                      <p className="text-xs text-muted-foreground">outstanding</p>
                    </div>
                  )}
                  {missingCount === 0 && detail && !detail.no_matching_templates && detail.checklist.length > 0 && obc.status === "in_progress" && (
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-emerald-400">All docs in</p>
                      <p className="text-xs text-muted-foreground">ready to approve</p>
                    </div>
                  )}
                </div>

                {/* ── Final-review actions ── */}
                {isManager && obc.status === "in_progress" && detail &&
                  !detail.no_matching_templates && detail.checklist.length > 0 && missingCount === 0 && (
                  <div className="flex items-center gap-2 px-5 pb-4">
                    <button
                      type="button"
                      onClick={() => openFinal(obc, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                      <ThumbsUp size={14} /> Approve case
                    </button>
                    <button
                      type="button"
                      onClick={() => openFinal(obc, "reject")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                      <ThumbsDown size={14} /> Reject case
                    </button>
                  </div>
                )}

                {/* ── Checklist toggle ── */}
                <button
                  type="button"
                  onClick={() => toggleCase(obc.id)}
                  className="w-full flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground hover:bg-surface transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                    Document Checklist
                    {detail && (
                      <span className="text-xs font-normal">
                        ({detail.checklist.filter((i) => i.status === "approved").length}/{detail.checklist.length} approved)
                      </span>
                    )}
                  </span>
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* ── Checklist panel ── */}
                {expanded && (
                  <div className="border-t border-border bg-surface px-5 py-5">
                    {!detail ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : detail.no_matching_templates ? (
                      <div className="flex items-start gap-3 rounded-[14px] bg-amber-500/10 border border-amber-500/20 p-4">
                        <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-amber-300">No document templates matched</p>
                          <p className="text-xs text-muted-foreground">
                            No active templates applied when this case was created.
                            Once an Administrator adds templates, click <strong className="text-foreground">Apply Templates</strong> below to populate this checklist without starting a new case.
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {isManager && obc.status === "in_progress" && (
                              <button
                                type="button"
                                onClick={() => applyTemplates(obc.id)}
                                disabled={refreshing === obc.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                <RefreshCw size={11} className={refreshing === obc.id ? "animate-spin" : ""} />
                                {refreshing === obc.id ? "Applying…" : "Apply Templates"}
                              </button>
                            )}
                            {isManager && (
                              <Link
                                href="/admin/document-templates"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                Go to Document Templates →
                              </Link>
                            )}
                          </div>
                          {refreshError && (
                            <p className="text-xs text-rose-400 mt-1">{refreshError}</p>
                          )}
                        </div>
                      </div>
                    ) : detail.checklist.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No checklist items.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.checklist.map((item) => {
                          const itemCfg = ITEM_STATUS[item.status];
                          const ItemIcon = itemCfg.Icon;
                          const canUpload = canEdit && item.status !== "approved";
                          const canReview = isManager && item.status === "uploaded";
                          const canMarkUnderReview = isManager && item.status === "uploaded";

                          return (
                            <div key={item.id} className="rounded-[14px] border border-border bg-surface-muted p-4 space-y-2">
                              {/* Item header */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.is_mandatory ? (
                                    <span className="shrink-0 text-[10px] font-bold uppercase text-rose-400">Required</span>
                                  ) : (
                                    <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">Optional</span>
                                  )}
                                  <span className="font-medium text-sm text-foreground truncate">{item.document_name}</span>
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${itemCfg.cls}`}>
                                  <ItemIcon size={10} /> {itemCfg.label}
                                </span>
                              </div>

                              {/* File info */}
                              {item.file_url && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <FileCheck size={12} className="shrink-0" />
                                  <a
                                    href={item.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-accent hover:underline truncate"
                                  >
                                    {item.file_name || item.file_url}
                                  </a>
                                  {item.uploaded_at && <span>· {fmtDate(item.uploaded_at)}</span>}
                                </div>
                              )}

                              {/* Review remark */}
                              {item.review_remark && (
                                <p className="text-xs italic text-muted-foreground border-l-2 border-border pl-3">
                                  {item.review_remark}
                                </p>
                              )}

                              {/* Actions */}
                              {obc.status === "in_progress" && (canUpload || canReview || canMarkUnderReview) && (
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  {canUpload && (
                                    <button
                                      type="button"
                                      onClick={() => openUpload(obc.id, item)}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 px-2.5 py-1 text-xs font-medium transition-colors"
                                    >
                                      <Upload size={11} /> {item.file_url ? "Replace" : "Upload"}
                                    </button>
                                  )}
                                  {canMarkUnderReview && item.status === "uploaded" && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await apiPatch(
                                          `/api/onboarding/${obc.id}/checklist/${item.id}`,
                                          token,
                                          { action: "mark_under_review" }
                                        );
                                        const updated = await apiGet(`/api/onboarding/${obc.id}`, token);
                                        setCaseDetails((prev) => ({ ...prev, [obc.id]: updated as OnboardingCase }));
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2.5 py-1 text-xs font-medium transition-colors"
                                    >
                                      <Clock size={11} /> Mark under review
                                    </button>
                                  )}
                                  {canReview && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openReview(obc.id, item, "approve")}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1 text-xs font-medium transition-colors"
                                      >
                                        <CheckCircle2 size={11} /> Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openReview(obc.id, item, "reject")}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-2.5 py-1 text-xs font-medium transition-colors"
                                      >
                                        <XCircle size={11} /> Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Missing documents summary */}
                    {detail && !detail.no_matching_templates && detail.checklist.length > 0 && (
                      (() => {
                        const missing = detail.checklist.filter(
                          (i) => i.is_mandatory && i.status !== "approved"
                        );
                        if (missing.length === 0) return null;
                        return (
                          <div className="mt-4 rounded-[14px] border border-rose-500/20 bg-rose-500/10 p-4">
                            <p className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                              <AlertTriangle size={14} /> {missing.length} required document{missing.length !== 1 ? "s" : ""} outstanding
                            </p>
                            <ul className="mt-2 space-y-1">
                              {missing.map((i) => (
                                <li key={i.id} className="text-xs text-muted-foreground flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${ITEM_STATUS[i.status].cls}`}>
                                    {ITEM_STATUS[i.status].label}
                                  </span>
                                  {i.document_name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Start Onboarding Modal ─────────────────────────────────────────────── */}
      <Modal open={showStart} title="Start Onboarding" onClose={() => setShowStart(false)}>
        <div className="space-y-4">
          {proposalsLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading proposals…</p>
          ) : allProposals.length === 0 && !startError ? (
            /* No proposals at all */
            <div className="rounded-[14px] border border-border bg-surface-muted p-4 space-y-1">
              <p className="text-sm font-medium text-foreground">No proposals found</p>
              <p className="text-xs text-muted-foreground">
                Create a proposal in the <strong>Proposals</strong> tab first, then mark it as Won to start onboarding.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Won proposals selector */}
              {wonProposals.length > 0 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Won Proposal <span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedProposal}
                    onChange={(e) => setSelectedProposal(e.target.value)}
                    className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="">Select a proposal…</option>
                    {wonProposals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.proposal_number} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Proposals exist but none are won */}
              {allProposals.length > 0 && wonProposals.length === 0 && (
                <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <AlertTriangle size={14} /> No won proposals yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You have {allProposals.length} proposal{allProposals.length !== 1 ? "s" : ""} but none have been marked as <strong className="text-foreground">Won</strong> yet.
                    Go to the <strong className="text-foreground">Proposals</strong> tab, open a proposal, click <strong className="text-foreground">Change status</strong> and select <strong className="text-foreground">Won</strong>.
                  </p>
                  <ul className="mt-1 space-y-1">
                    {allProposals.map((p) => (
                      <li key={p.id} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-mono">{p.proposal_number}</span>
                        <span className="truncate">{p.title}</span>
                        <span className="ml-auto shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {startError && (
            <div className="flex items-center gap-2 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {startError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowStart(false)}>Cancel</Button>
            <Button onClick={confirmStart} disabled={starting || wonProposals.length === 0 || !selectedProposal}>
              {starting ? "Starting…" : "Start Onboarding"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Upload Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!uploadModal}
        title={`Upload: ${uploadModal?.item.document_name ?? ""}`}
        onClose={() => !uploading && setUploadModal(null)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Choose file <span className="text-danger">*</span>
            </label>
            <label className={`flex flex-col items-center justify-center gap-2 w-full rounded-[14px] border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${uploadFile ? "border-accent bg-accent/5" : "border-border hover:border-accent/60 hover:bg-surface"}`}>
              <Upload size={24} className={uploadFile ? "text-accent" : "text-muted-foreground"} />
              {uploadFile ? (
                <span className="text-sm font-medium text-foreground text-center break-all">{uploadFile.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Click to select a file <span className="text-xs">(max 20 MB)</span></span>
              )}
              <input
                type="file"
                className="sr-only"
                onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploadError(null); }}
                disabled={uploading}
              />
            </label>
            {uploadFile && (
              <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
          {uploadError && (
            <p className="text-sm text-danger">{uploadError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadModal(null)} disabled={uploading}>Cancel</Button>
            <Button onClick={confirmUpload} disabled={uploading || !uploadFile}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Review Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!reviewModal}
        title={reviewModal?.action === "approve" ? "Approve Document" : "Reject Document"}
        onClose={() => setReviewModal(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {reviewModal?.action === "approve"
              ? `Approve "${reviewModal.item.document_name}"?`
              : `Reject "${reviewModal?.item.document_name}"?`}
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Remark {reviewModal?.action === "reject" && <span className="text-danger">*</span>}
            </label>
            <textarea
              value={reviewRemark}
              onChange={(e) => setReviewRemark(e.target.value)}
              placeholder={reviewModal?.action === "reject" ? "Reason for rejection…" : "Optional note…"}
              rows={3}
              className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button
              onClick={confirmReview}
              disabled={reviewing || (reviewModal?.action === "reject" && !reviewRemark.trim())}
            >
              {reviewing ? "Saving…" : reviewModal?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!deleteModal}
        title="Delete Onboarding Case"
        onClose={() => setDeleteModal(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Permanently delete <strong>{deleteModal?.onboarding_number}</strong>?
            All uploaded document links and checklist progress will be lost.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={deleting} className="bg-danger/15 text-danger hover:bg-danger/25 border-0">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Final Approval Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!finalModal}
        title={finalModal?.action === "approve" ? "Approve Onboarding Case" : "Reject Onboarding Case"}
        onClose={() => setFinalModal(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {finalModal?.action === "approve"
              ? "Give final approval for this onboarding case?"
              : "Reject this onboarding case? This will require restarting."}
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Note</label>
            <textarea
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
              placeholder="Optional note…"
              rows={2}
              className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          {finalError && (
            <div className="flex items-center gap-2 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {finalError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFinalModal(null)}>Cancel</Button>
            <Button onClick={confirmFinal} disabled={finalizing}>
              {finalizing ? "Saving…" : finalModal?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

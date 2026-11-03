"use client";

import * as React from "react";
import {
  Phone, Mail, MessageCircle, Users, FileText,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, CalendarClock,
  Plus, Paperclip, X, Clock, AlertCircle, CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { apiGet, apiPost } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityStatus = "completed" | "overdue" | "due_today" | "scheduled" | "no_followup";

type ProspectActivity = {
  id: string;
  type: "call" | "email" | "whatsapp" | "meeting" | "other";
  occurred_at: string;
  description: string | null;
  outcome: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  completed_at: string | null;
  parent_activity_id: string | null;
  status: ActivityStatus;
  owner: { full_name: string; email: string } | null;
};

type Attachment = {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  signed_url: string | null;
};

type Communication = {
  id: string;
  channel: "call" | "email" | "whatsapp" | "meeting" | "other";
  direction: "inbound" | "outbound";
  occurred_at: string;
  summary: string | null;
  next_action: string | null;
  logger: { full_name: string; email: string } | null;
  attachments: Attachment[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  call: Phone, email: Mail, whatsapp: MessageCircle, meeting: Users, other: FileText,
};

const CHANNEL_LABELS: Record<string, string> = {
  call: "Call", email: "Email", whatsapp: "WhatsApp", meeting: "Meeting", other: "Other",
};

const STATUS_ORDER: Record<ActivityStatus, number> = {
  overdue: 0, due_today: 1, scheduled: 2, no_followup: 3, completed: 4,
};

function sortActivities(acts: ProspectActivity[]): ProspectActivity[] {
  return [...acts].sort((a, b) => {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (diff !== 0) return diff;
    if (a.follow_up_at && b.follow_up_at) {
      return new Date(a.follow_up_at).getTime() - new Date(b.follow_up_at).getTime();
    }
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
  });
}

const STATUS_CONFIG: Record<ActivityStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  overdue:    { label: "Overdue",   cls: "bg-red-500/15 text-red-500",    Icon: AlertCircle    },
  due_today:  { label: "Due Today", cls: "bg-yellow-500/15 text-yellow-500", Icon: Clock       },
  scheduled:  { label: "Scheduled", cls: "bg-blue-500/15 text-blue-500",  Icon: CalendarCheck  },
  completed:  { label: "Completed", cls: "bg-green-500/15 text-green-500", Icon: CheckCircle2  },
  no_followup:{ label: "Logged",    cls: "bg-muted/60 text-muted-foreground", Icon: FileText   },
};

const RESCHEDULED_CONFIG = { label: "Rescheduled", cls: "bg-purple-500/15 text-purple-400", Icon: CalendarClock };

function getBadge(act: ProspectActivity) {
  // Overdue/due_today always take priority so the urgency is visible
  if (act.status === "overdue" || act.status === "due_today") return STATUS_CONFIG[act.status];
  // Rescheduled cards (have a parent) get their own badge
  if (act.parent_activity_id && act.status !== "completed") return RESCHEDULED_CONFIG;
  return STATUS_CONFIG[act.status];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputCls = "w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const selectCls = inputCls + " cursor-pointer";

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  prospectId: string;
  token: string | null;
  canEdit: boolean;
  actKey?: number;
}

export function ActivityTab({ prospectId, token, canEdit, actKey }: Props) {
  const [activities, setActivities] = React.useState<ProspectActivity[]>([]);
  const [comms, setComms] = React.useState<Communication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [completing, setCompleting] = React.useState<string | null>(null);

  // ── Log Activity modal state ───────────────────────────────────────────────
  const [showActModal, setShowActModal] = React.useState(false);
  const [actForm, setActForm] = React.useState({
    type: "call", occurred_at: "", description: "", outcome: "", next_action: "", follow_up_at: "",
  });
  const [actError, setActError] = React.useState<string | null>(null);
  const [savingAct, setSavingAct] = React.useState(false);

  // ── Reschedule modal state ────────────────────────────────────────────────
  const [reschedTarget, setReschedTarget] = React.useState<ProspectActivity | null>(null);
  const [reschedDate, setReschedDate] = React.useState("");
  const [reschedNote, setReschedNote] = React.useState("");
  const [savingResched, setSavingResched] = React.useState(false);
  const [reschedError, setReschedError] = React.useState<string | null>(null);

  // ── Log Communication modal state ─────────────────────────────────────────
  const [showCommModal, setShowCommModal] = React.useState(false);
  const [commForm, setCommForm] = React.useState({
    channel: "call", direction: "outbound", occurred_at: "", summary: "", next_action: "",
  });
  const [commFile, setCommFile] = React.useState<File | null>(null);
  const [commError, setCommError] = React.useState<string | null>(null);
  const [savingComm, setSavingComm] = React.useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiGet(`/api/prospects/${prospectId}/activities`, token).catch(() => []),
      apiGet(`/api/prospects/${prospectId}/communications`, token).catch(() => []),
    ]).then(([acts, cms]) => {
      setActivities(sortActivities((Array.isArray(acts) ? acts : []) as ProspectActivity[]));
      setComms((Array.isArray(cms) ? cms : []) as Communication[]);
    }).finally(() => setLoading(false));
  }, [token, prospectId]);

  // ── Log Activity ──────────────────────────────────────────────────────────
  const openActModal = () => {
    setActForm({ type: "call", occurred_at: "", description: "", outcome: "", next_action: "", follow_up_at: "" });
    setActError(null);
    setShowActModal(true);
  };

  const saveActivity = async () => {
    if (!token) return;
    setSavingAct(true);
    setActError(null);
    try {
      const payload = {
        type: actForm.type,
        occurred_at: actForm.occurred_at || undefined,
        description: actForm.description || undefined,
        outcome:     actForm.outcome     || undefined,
        next_action: actForm.next_action || undefined,
        follow_up_at: actForm.follow_up_at || undefined,
      };
      const created = await apiPost(`/api/prospects/${prospectId}/activities`, token, payload);
      setActivities((prev) => [created as ProspectActivity, ...prev]);
      setShowActModal(false);
    } catch (e: unknown) {
      setActError(e instanceof Error ? e.message : "Failed to log activity");
    } finally {
      setSavingAct(false);
    }
  };

  // ── Complete activity ─────────────────────────────────────────────────────
  const completeActivity = async (act: ProspectActivity) => {
    if (!token || completing) return;
    setCompleting(act.id);
    try {
      const updated = await apiPost(
        `/api/prospects/${prospectId}/activities/${act.id}/complete`,
        token, {}
      );
      setActivities((prev) => sortActivities(prev.map((a) => a.id === act.id ? updated as ProspectActivity : a)));
    } catch { /* ignore */ }
    finally { setCompleting(null); }
  };

  // ── Reschedule activity ───────────────────────────────────────────────────
  const openResched = (act: ProspectActivity) => {
    setReschedTarget(act);
    setReschedDate("");
    setReschedNote("");
    setReschedError(null);
  };

  const saveResched = async () => {
    if (!token || !reschedTarget) return;
    if (!reschedDate) { setReschedError("New follow-up date is required"); return; }
    setSavingResched(true);
    setReschedError(null);
    try {
      await apiPost(
        `/api/prospects/${prospectId}/activities/${reschedTarget.id}/reschedule`,
        token,
        { follow_up_at: reschedDate, description: reschedNote || undefined }
      );
      // Re-fetch full list so statuses for all activities are recomputed
      const refreshed = await apiGet(`/api/prospects/${prospectId}/activities`, token);
      setActivities(sortActivities((Array.isArray(refreshed) ? refreshed : []) as ProspectActivity[]));
      setReschedTarget(null);
    } catch (e: unknown) {
      setReschedError(e instanceof Error ? e.message : "Failed to reschedule");
    } finally {
      setSavingResched(false);
    }
  };

  // ── Log Communication ─────────────────────────────────────────────────────
  const openCommModal = () => {
    setCommForm({ channel: "call", direction: "outbound", occurred_at: "", summary: "", next_action: "" });
    setCommFile(null);
    setCommError(null);
    setShowCommModal(true);
  };

  const saveCommunication = async () => {
    if (!token) return;
    setSavingComm(true);
    setCommError(null);
    try {
      const payload = {
        channel:     commForm.channel,
        direction:   commForm.direction,
        occurred_at: commForm.occurred_at || undefined,
        summary:     commForm.summary     || undefined,
        next_action: commForm.next_action || undefined,
      };
      const created = await apiPost(`/api/prospects/${prospectId}/communications`, token, payload) as Communication;

      // Upload attachment if present
      if (commFile) {
        try {
          const fd = new FormData();
          fd.append("file", commFile);
          const res = await fetch(`/api/communications/${created.id}/attachments`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (res.ok) {
            const att = await res.json();
            created.attachments = [att];
          }
        } catch { /* attachment upload non-fatal */ }
      }

      setComms((prev) => [created, ...prev]);
      setShowCommModal(false);
    } catch (e: unknown) {
      setCommError(e instanceof Error ? e.message : "Failed to log communication");
    } finally {
      setSavingComm(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header buttons ── */}
      {canEdit && (
        <div className="flex gap-2">
          <Button type="button" onClick={openActModal} className="gap-1.5">
            <Phone className="h-4 w-4" /> Log Activity
          </Button>
          <Button type="button" variant="secondary" onClick={openCommModal} className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> Log Communication
          </Button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-[14px] bg-surface-muted animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* ── Activities ── */}
          {activities.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Activities
              </p>
              <div className="space-y-2">
                {activities.map((act) => {
                  const Icon = CHANNEL_ICONS[act.type] ?? FileText;
                  const sc = getBadge(act);
                  const StatusIcon = sc.Icon;
                  const isCompleting = completing === act.id;
                  return (
                    <div key={act.id} className="rounded-[16px] border border-border bg-background p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-foreground">
                              {CHANNEL_LABELS[act.type]}
                            </span>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{fmtDate(act.occurred_at)}</span>
                            {act.owner && (
                              <>
                                <span className="mx-1.5 text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {act.owner.full_name || act.owner.email}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${sc.cls}`}>
                          <StatusIcon className="h-3 w-3" />
                          {sc.label}
                        </span>
                      </div>

                      {act.description && (
                        <p className="text-sm text-foreground pl-10.5">{act.description}</p>
                      )}
                      {act.outcome && (
                        <p className="text-xs text-muted-foreground pl-10.5">
                          <span className="font-medium">Outcome:</span> {act.outcome}
                        </p>
                      )}
                      {act.next_action && (
                        <p className="text-xs text-muted-foreground pl-10.5">
                          <span className="font-medium">Next action:</span> {act.next_action}
                        </p>
                      )}
                      {act.follow_up_at && (
                        <p className="text-xs text-muted-foreground pl-10.5">
                          <span className="font-medium">Follow-up:</span> {fmt(act.follow_up_at)}
                        </p>
                      )}
                      {act.parent_activity_id && (
                        <p className="text-xs text-muted-foreground/60 pl-10.5 italic">Rescheduled from earlier activity</p>
                      )}

                      {/* Actions */}
                      {canEdit && act.status !== "completed" && !act.parent_activity_id && (
                        <div className="flex gap-2 pt-1 pl-10.5">
                          <button
                            type="button"
                            onClick={() => completeActivity(act)}
                            disabled={!!isCompleting}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {isCompleting ? "…" : "Complete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openResched(act)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                          >
                            <CalendarClock className="h-3 w-3" /> Reschedule
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Communications timeline ── */}
          {comms.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Communications
              </p>
              <ol className="relative space-y-0">
                {comms.map((comm, idx) => {
                  const CIcon = CHANNEL_ICONS[comm.channel] ?? FileText;
                  const isLast = idx === comms.length - 1;
                  const DirIcon = comm.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
                  const dirCls = comm.direction === "inbound"
                    ? "text-blue-500 bg-blue-500/10"
                    : "text-purple-500 bg-purple-500/10";
                  return (
                    <li key={comm.id} className="flex gap-3 pb-4 last:pb-0">
                      <div className="relative flex flex-col items-center">
                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                          <CIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {CHANNEL_LABELS[comm.channel]}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${dirCls}`}>
                            <DirIcon className="h-2.5 w-2.5" />
                            {comm.direction}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmtDate(comm.occurred_at)}</span>
                          {comm.logger && (
                            <span className="text-xs text-muted-foreground">
                              · {comm.logger.full_name || comm.logger.email}
                            </span>
                          )}
                        </div>
                        {comm.summary && (
                          <p className="mt-1 text-sm text-foreground">{comm.summary}</p>
                        )}
                        {comm.next_action && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">Next action:</span> {comm.next_action}
                          </p>
                        )}
                        {comm.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comm.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.signed_url ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs hover:bg-border transition"
                              >
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-[160px]">{att.file_name}</span>
                                {att.file_size && (
                                  <span className="text-muted-foreground shrink-0">{fileSize(att.file_size)}</span>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {activities.length === 0 && comms.length === 0 && (
            <p className="text-sm text-muted-foreground">No activities or communications logged yet.</p>
          )}
        </>
      )}

      {/* ── System audit log ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          System Log
        </p>
        <ActivityFeed key={actKey} entityType="prospect" entityId={prospectId} />
      </section>

      {/* ── Log Activity modal ── */}
      <Modal open={showActModal} title="Log Activity" onClose={() => setShowActModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Type</label>
              <select
                value={actForm.type}
                onChange={(e) => setActForm((f) => ({ ...f, type: e.target.value }))}
                className={selectCls}
              >
                {["call", "email", "whatsapp", "meeting", "other"].map((t) => (
                  <option key={t} value={t}>{CHANNEL_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">When</label>
              <input
                type="datetime-local"
                value={actForm.occurred_at}
                onChange={(e) => setActForm((f) => ({ ...f, occurred_at: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={actForm.description}
              onChange={(e) => setActForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What happened?"
              className="w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm resize-none focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Outcome</label>
            <input
              value={actForm.outcome}
              onChange={(e) => setActForm((f) => ({ ...f, outcome: e.target.value }))}
              placeholder="Result of the interaction"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Next Action</label>
            <input
              value={actForm.next_action}
              onChange={(e) => setActForm((f) => ({ ...f, next_action: e.target.value }))}
              placeholder="What needs to happen next?"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Follow-up Date (optional)</label>
            <input
              type="datetime-local"
              value={actForm.follow_up_at}
              onChange={(e) => setActForm((f) => ({ ...f, follow_up_at: e.target.value }))}
              className={inputCls}
            />
          </div>
          {actError && <p className="text-sm text-danger">{actError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowActModal(false)}>Cancel</Button>
            <Button type="button" onClick={saveActivity} disabled={savingAct}>
              {savingAct ? "Saving…" : "Log Activity"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Reschedule modal ── */}
      <Modal
        open={!!reschedTarget}
        title="Reschedule Follow-up"
        onClose={() => setReschedTarget(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A new activity will be created linked to this one. The original record is preserved.
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">New Follow-up Date & Time <span className="text-danger">*</span></label>
            <input
              type="datetime-local"
              value={reschedDate}
              onChange={(e) => setReschedDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Note (optional)</label>
            <input
              value={reschedNote}
              onChange={(e) => setReschedNote(e.target.value)}
              placeholder="Reason for rescheduling"
              className={inputCls}
            />
          </div>
          {reschedError && <p className="text-sm text-danger">{reschedError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setReschedTarget(null)}>Cancel</Button>
            <Button type="button" onClick={saveResched} disabled={savingResched}>
              {savingResched ? "Rescheduling…" : "Reschedule"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Log Communication modal ── */}
      <Modal open={showCommModal} title="Log Communication" onClose={() => setShowCommModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Channel</label>
              <select
                value={commForm.channel}
                onChange={(e) => setCommForm((f) => ({ ...f, channel: e.target.value }))}
                className={selectCls}
              >
                {["call", "email", "whatsapp", "meeting", "other"].map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Direction</label>
              <select
                value={commForm.direction}
                onChange={(e) => setCommForm((f) => ({ ...f, direction: e.target.value }))}
                className={selectCls}
              >
                <option value="outbound">Outbound (we contacted them)</option>
                <option value="inbound">Inbound (they contacted us)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">When</label>
            <input
              type="datetime-local"
              value={commForm.occurred_at}
              onChange={(e) => setCommForm((f) => ({ ...f, occurred_at: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Summary</label>
            <textarea
              value={commForm.summary}
              onChange={(e) => setCommForm((f) => ({ ...f, summary: e.target.value }))}
              rows={2}
              placeholder="What was discussed?"
              className="w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm resize-none focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Next Action</label>
            <input
              value={commForm.next_action}
              onChange={(e) => setCommForm((f) => ({ ...f, next_action: e.target.value }))}
              placeholder="What needs to happen next?"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Attachment (optional)</label>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-[14px] border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-accent hover:text-accent transition">
                <Paperclip className="h-4 w-4" />
                {commFile ? commFile.name : "Choose file…"}
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setCommFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {commFile && (
                <button type="button" onClick={() => setCommFile(null)} className="text-muted-foreground hover:text-danger">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {commError && <p className="text-sm text-danger">{commError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowCommModal(false)}>Cancel</Button>
            <Button type="button" onClick={saveCommunication} disabled={savingComm}>
              {savingComm ? "Saving…" : "Log Communication"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

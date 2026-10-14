"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, TrendingUp, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPut, apiPatch } from "@/lib/api";

type Lead = {
  id: string; title: string; notes: string | null; status: string;
  company_id: string | null; assigned_to: string | null;
  source_prospect_id: string | null; created_at: string; updated_at: string;
};

const PIPELINE_STAGES = ["first_contact", "follow_up", "discovery_call", "closing", "closed_won", "failed"] as const;
type PipelineStage = typeof PIPELINE_STAGES[number];

const STAGE_COLORS: Record<string, string> = {
  first_contact: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up: "bg-indigo-100 text-indigo-700 border-indigo-200",
  discovery_call: "bg-purple-100 text-purple-700 border-purple-200",
  closing: "bg-orange-100 text-orange-700 border-orange-200",
  closed_won: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-surface-muted text-muted-foreground border-border",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [lead, setLead] = React.useState<Lead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const canEdit = appRole === "admin" || appRole === "sales";

  React.useEffect(() => {
    if (!token || !id) return;
    apiGet(`/api/leads/${id}`, token)
      .then(setLead)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  const startEdit = () => {
    if (!lead) return;
    setEditTitle(lead.title);
    setEditNotes(lead.notes ?? "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!token || !lead || !editTitle.trim()) return;
    setSaving(true);
    try {
      const updated = await apiPut(`/api/leads/${lead.id}`, token, {
        title: editTitle, notes: editNotes || null,
      });
      setLead(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: PipelineStage) => {
    if (!token || !lead || !canEdit) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiPatch(`/api/leads/${lead.id}/status`, token, { status });
      setLead(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;
  if (error) return <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!lead) return <p className="text-muted-foreground">Lead not found.</p>;

  const currentStageIdx = PIPELINE_STAGES.indexOf(lead.status as PipelineStage);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => router.push("/leads")} className="mt-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            {editing ? (
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-2xl font-semibold bg-transparent border-b border-accent text-foreground outline-none w-full" />
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">{lead.title}</h1>
            )}
            <p className="mt-1 text-sm text-muted-foreground">Lead · Created {new Date(lead.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={saving || !editTitle.trim()}><Check className="h-4 w-4" />{saving ? "Saving…" : "Save"}</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={startEdit}>Edit</Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Pipeline stepper */}
      <div className="rounded-[24px] border border-border bg-surface p-6">
        <p className="mb-4 text-sm font-semibold text-foreground">Pipeline Stage</p>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCurrent = lead.status === stage;
            const isPast = currentStageIdx > idx && lead.status !== "failed";
            const colorClass = isCurrent ? STAGE_COLORS[stage] : isPast ? "bg-green-50 text-green-600 border-green-200" : "border-border text-muted-foreground";
            return (
              <button
                key={stage}
                type="button"
                disabled={!canEdit || updatingStatus || lead.status === "closed_won" || lead.status === "failed"}
                onClick={() => updateStatus(stage)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${colorClass} ${canEdit && !updatingStatus ? "hover:opacity-80 cursor-pointer" : "cursor-default"} ${isCurrent ? "ring-2 ring-offset-1 ring-accent/40" : ""}`}
              >
                {isPast && <Check className="h-3 w-3" />}
                {stage.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
        {!canEdit && (
          <p className="mt-3 text-xs text-muted-foreground">Only Admin and Sales can update the pipeline stage.</p>
        )}
      </div>

      {/* Details card */}
      <div className="rounded-[24px] border border-border bg-surface p-6 space-y-4">
        <p className="text-sm font-semibold text-foreground">Details</p>
        <div className="space-y-3">
          {lead.company_id && (
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Link href={`/companies/${lead.company_id}`} className="text-sm text-accent hover:underline">View linked company</Link>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            {editing ? (
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} className="w-full rounded-[14px] border border-border bg-background px-3 py-2 text-sm resize-none focus:border-accent focus:outline-none" />
            ) : lead.notes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes.</p>
            )}
          </div>
          {lead.source_prospect_id && (
            <p className="text-xs text-muted-foreground">Converted from prospect · {lead.source_prospect_id.slice(0, 8)}…</p>
          )}
        </div>

        {/* Activity Feed */}
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Activity</h2>
          <ActivityFeed entityType="lead" entityId={lead.id} />
        </div>
      </div>
    </div>
  );
}

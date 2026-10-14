"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Building2, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPut } from "@/lib/api";

type Prospect = {
  id: string;
  company_id: string;
  name: string | null;
  notes: string | null;
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  companies: { id: string; name: string } | null;
};

const PIPELINE_STATUSES = [
  "first_contact", "follow_up", "discovery_call", "closing", "closed_won", "failed",
] as const;
type PipelineStatus = typeof PIPELINE_STATUSES[number];

const STATUS_COLORS: Record<string, string> = {
  first_contact:  "bg-blue-100 text-blue-700 border-blue-200",
  follow_up:      "bg-indigo-100 text-indigo-700 border-indigo-200",
  discovery_call: "bg-purple-100 text-purple-700 border-purple-200",
  closing:        "bg-orange-100 text-orange-700 border-orange-200",
  closed_won:     "bg-green-100 text-green-700 border-green-200",
  failed:         "bg-surface-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  first_contact:  "First Contact",
  follow_up:      "Follow Up",
  discovery_call: "Discovery Call",
  closing:        "Closing",
  closed_won:     "Closed Won",
  failed:         "Failed",
};

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [prospect, setProspect] = React.useState<Prospect | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editSource, setEditSource] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<PipelineStatus>("first_contact");
  const [saving, setSaving] = React.useState(false);
  const [activityKey, setActivityKey] = React.useState(0);

  const canEdit = appRole === "admin" || appRole === "sales";

  React.useEffect(() => {
    if (!token || !id) return;
    apiGet(`/api/prospects/${id}`, token)
      .then(setProspect)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  const startEdit = () => {
    if (!prospect) return;
    setEditName(prospect.name ?? "");
    setEditNotes(prospect.notes ?? "");
    setEditSource(prospect.source ?? "");
    setEditStatus(prospect.status as PipelineStatus);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!token || !prospect) return;
    setSaving(true);
    try {
      const updated = await apiPut(`/api/prospects/${prospect.id}`, token, {
        name: editName || null,
        notes: editNotes || null,
        source: editSource || null,
        status: editStatus,
      });
      setProspect((prev) => prev ? { ...prev, ...updated, companies: prev.companies } : updated);
      setEditing(false);
      setActivityKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  if (error)
    return <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!prospect)
    return <p className="text-muted-foreground">Prospect not found.</p>;

  const companyName = prospect.companies?.name ?? "Unknown Company";
  const isTerminal = prospect.status === "closed_won" || prospect.status === "failed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
            <h1 className="text-2xl font-semibold text-foreground">
              {prospect.name ?? companyName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Prospect · Created {new Date(prospect.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={saving}>
                  <Check className="h-4 w-4" />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={startEdit}>Edit</Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Closed Won banner */}
      {prospect.status === "closed_won" && (
        <div className="flex items-center gap-3 rounded-[18px] border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-800 dark:text-green-300">
            An Active Client record was automatically created for this deal.{" "}
            <Link href={`/clients?prospect_id=${prospect.id}`} className="font-semibold underline">
              View Client
            </Link>
          </p>
        </div>
      )}

      {/* Pipeline status stepper */}
      <div className="rounded-[24px] border border-border bg-surface p-6">
        <p className="mb-4 text-sm font-semibold text-foreground">Pipeline Status</p>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STATUSES.map((s) => {
            const isCurrent = (editing ? editStatus : prospect.status) === s;
            const colorClass = isCurrent ? STATUS_COLORS[s] : "border-border text-muted-foreground";
            return (
              <button
                key={s}
                type="button"
                disabled={!editing || isTerminal}
                onClick={() => editing && setEditStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${colorClass} ${editing && !isTerminal ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${isCurrent ? "ring-2 ring-offset-1 ring-accent/40" : ""}`}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {!canEdit && (
          <p className="mt-3 text-xs text-muted-foreground">Only Admin and Sales can update the status.</p>
        )}
        {isTerminal && canEdit && (
          <p className="mt-3 text-xs text-muted-foreground">This status is final.</p>
        )}
      </div>

      {/* Details card */}
      <div className="rounded-[24px] border border-border bg-surface p-6 space-y-4">
        <p className="text-sm font-semibold text-foreground">Details</p>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Link href={`/companies/${prospect.company_id}`} className="text-sm text-accent hover:underline">
              {companyName}
            </Link>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Contact Name</p>
            {editing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Jane Smith"
                className="h-9 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              />
            ) : prospect.name ? (
              <p className="text-sm text-foreground">{prospect.name}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Not set.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Source</p>
            {editing ? (
              <input
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                placeholder="cold outreach, referral…"
                className="h-9 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              />
            ) : prospect.source ? (
              <p className="text-sm text-foreground">{prospect.source}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Not set.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Notes</p>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                placeholder="Add notes…"
                className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            ) : prospect.notes ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{prospect.notes}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No notes.</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-[20px] border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Activity</h2>
        <ActivityFeed key={activityKey} entityType="prospect" entityId={prospect.id} />
      </div>
    </div>
  );
}

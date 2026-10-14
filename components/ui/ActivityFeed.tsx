"use client";

import * as React from "react";
import { apiGet } from "@/lib/api";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { Plus, RefreshCw, ArrowRight, Pencil, Activity } from "lucide-react";

type ActivityEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (v: string | null) => v != null && UUID_RE.test(v.trim());

function entityLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function fieldLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAction(entry: ActivityEntry): React.ReactNode {
  const { action, entity_type, field_name, old_value, new_value } = entry;

  switch (action) {
    case "created": {
      const label = entityLabel(entity_type);
      const name = !isUUID(new_value) ? new_value : null;
      return name
        ? <><span className="font-medium">{label}</span> created for <span className="font-medium">{name}</span></>
        : <><span className="font-medium">{label}</span> created</>;
    }

    case "converted":
      return <><span className="font-medium">Converted</span> to lead</>;

    case "status_changed": {
      const val = !isUUID(new_value) ? new_value : null;
      return val
        ? <>Status changed to <span className="font-medium capitalize">{val}</span></>
        : <>Status updated</>;
    }

    case "updated": {
      if (!field_name) return <>Updated</>;
      const field = fieldLabel(field_name);
      const oldClean = !isUUID(old_value) ? old_value : null;
      const newClean = !isUUID(new_value) ? new_value : null;
      if (oldClean && newClean)
        return <><span className="font-medium">{field}</span> changed from <span className="font-medium">"{oldClean}"</span> to <span className="font-medium">"{newClean}"</span></>;
      if (newClean && !oldClean)
        return <><span className="font-medium">{field}</span> set to <span className="font-medium">"{newClean}"</span></>;
      if (oldClean && !newClean)
        return <><span className="font-medium">{field}</span> cleared</>;
      return <><span className="font-medium">{field}</span> updated</>;
    }

    default:
      return <>{action.replace(/_/g, " ")}</>;
  }
}

type ActionMeta = { icon: React.ElementType; bg: string; fg: string };

const ACTION_META: Record<string, ActionMeta> = {
  created:      { icon: Plus,       bg: "bg-green-500/10",  fg: "text-green-500"  },
  converted:    { icon: RefreshCw,  bg: "bg-blue-500/10",   fg: "text-blue-500"   },
  status_changed:{ icon: ArrowRight,bg: "bg-yellow-500/10", fg: "text-yellow-500" },
  updated:      { icon: Pencil,     bg: "bg-muted/60",      fg: "text-muted-foreground" },
};

function getActionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? { icon: Activity, bg: "bg-muted/60", fg: "text-muted-foreground" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface ActivityFeedProps {
  entityType: string;
  entityId: string;
}

export function ActivityFeed({ entityType, entityId }: ActivityFeedProps) {
  const { token } = useSessionProvider();
  const [entries, setEntries] = React.useState<ActivityEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token || !entityId) return;
    setLoading(true);
    setError(null);
    apiGet(
      `/api/activity?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
      token
    )
      .then(setEntries)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load activity")
      )
      .finally(() => setLoading(false));
  }, [token, entityType, entityId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-surface-muted animate-pulse" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <div className="h-3.5 w-2/3 rounded bg-surface-muted animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-surface-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-danger">{error}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, idx) => {
        const { icon: Icon, bg, fg } = getActionMeta(entry.action);
        const isLast = idx === entries.length - 1;
        const actorName = entry.actor_email?.split("@")[0] ?? "System";

        return (
          <li key={entry.id} className="flex gap-3 pb-4 last:pb-0">
            {/* Timeline line + icon */}
            <div className="relative flex flex-col items-center">
              <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
                <Icon className={`h-3.5 w-3.5 ${fg}`} />
              </div>
              {!isLast && (
                <div className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5 pb-1">
              <p className="text-sm text-foreground leading-snug">
                {formatAction(entry)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {timeAgo(entry.created_at)}
                <span className="mx-1">·</span>
                {actorName}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

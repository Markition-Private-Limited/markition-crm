"use client";

import type { WorkflowActivityEvent, WorkflowHistoryEntry } from "@/src/lib/workflows";

type TimelineEntry = Pick<WorkflowHistoryEntry, "id" | "at" | "module" | "from" | "to" | "reason" | "notes"> | WorkflowActivityEvent;

interface WorkflowTimelineProps {
  entries: TimelineEntry[];
  emptyLabel?: string;
}

function getTitle(entry: TimelineEntry) {
  if ("from" in entry) {
    return `${entry.from} → ${entry.to}`;
  }

  return entry.label;
}

function getDescription(entry: TimelineEntry) {
  if ("detail" in entry) {
    return entry.detail ?? undefined;
  }

  if ("reason" in entry) {
    return entry.reason ?? entry.notes;
  }

  return undefined;
}

export function WorkflowTimeline({ entries, emptyLabel = "No workflow history yet." }: WorkflowTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{getTitle(entry)}</p>
              {getDescription(entry) ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getDescription(entry)}</p> : null}
            </div>
            <time className="text-xs text-slate-400 dark:text-slate-500">{entry.at}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

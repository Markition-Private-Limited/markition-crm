"use client";

import { WorkflowTimeline } from "./WorkflowTimeline";
import type { WorkflowActivityEvent, WorkflowHistoryEntry } from "@/src/lib/workflows";

interface WorkflowHistoryPanelProps {
  history?: WorkflowHistoryEntry[];
  events?: WorkflowActivityEvent[];
  title?: string;
}

export function WorkflowHistoryPanel({ history = [], events = [], title = "Workflow history" }: WorkflowHistoryPanelProps) {
  const entries = history.length > 0 ? history : events;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
      <div className="mt-4">
        <WorkflowTimeline entries={entries} />
      </div>
    </section>
  );
}

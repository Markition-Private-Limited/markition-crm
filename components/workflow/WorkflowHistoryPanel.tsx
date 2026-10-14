"use client";
import { WorkflowTimeline } from "./WorkflowTimeline";
import type {
  WorkflowActivityEvent,
  WorkflowHistoryEntry,
} from "@/src/lib/workflows";
interface WorkflowHistoryPanelProps {
  history?: WorkflowHistoryEntry[];
  events?: WorkflowActivityEvent[];
  title?: string;
}
export function WorkflowHistoryPanel({
  history = [],
  events = [],
  title = "Workflow history",
}: WorkflowHistoryPanelProps) {
  const entries = history.length > 0 ? history : events;
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm shadow-black/5 ">
      {" "}
      <h2 className="text-lg font-semibold text-foreground ">{title}</h2>{" "}
      <div className="mt-4">
        {" "}
        <WorkflowTimeline entries={entries} />{" "}
      </div>{" "}
    </section>
  );
}

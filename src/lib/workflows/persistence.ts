import type { WorkflowActivityEvent, WorkflowHistoryEntry } from "./types";

export async function appendWorkflowHistory(_entry: WorkflowHistoryEntry) {
  return { saved: false, skipped: true };
}

export async function appendWorkflowActivity(_event: WorkflowActivityEvent) {
  return { saved: false, skipped: true };
}

export async function appendWorkflowTransition(_entry: WorkflowHistoryEntry, _event: WorkflowActivityEvent) {
  return {
    historyResult: { saved: false, skipped: true },
    activityResult: { saved: false, skipped: true },
  };
}

import { supabaseBrowser } from "@/lib/supabaseClient";
import { isTransientWorkflowErrorCode, type WorkflowActivityEvent, type WorkflowHistoryEntry } from "./types";

type WorkflowPersistenceResult = {
  saved: boolean;
  skipped: boolean;
};

async function safeInsert(table: string, payload: Record<string, unknown>): Promise<WorkflowPersistenceResult> {
  const { error } = await supabaseBrowser.from(table).insert(payload);

  if (error) {
    if (isTransientWorkflowErrorCode((error as any).code)) {
      return { saved: false, skipped: true };
    }

    throw error;
  }

  return { saved: true, skipped: false };
}

export async function appendWorkflowHistory(entry: WorkflowHistoryEntry) {
  return safeInsert("workflow_history", {
    id: entry.id,
    module: entry.module,
    entity_id: entry.entityId,
    field: entry.field,
    previous_status: entry.from,
    next_status: entry.to,
    actor_id: entry.actor?.id,
    actor_name: entry.actor?.name,
    actor_email: entry.actor?.email,
    reason: entry.reason,
    notes: entry.notes,
    metadata: entry.metadata ?? {},
    created_at: entry.at,
  });
}

export async function appendWorkflowActivity(event: WorkflowActivityEvent) {
  return safeInsert("workflow_events", {
    id: event.id,
    module: event.module,
    entity_id: event.entityId,
    label: event.label,
    detail: event.detail,
    tone: event.tone,
    metadata: event.metadata ?? {},
    created_at: event.at,
  });
}

export async function appendWorkflowTransition(entry: WorkflowHistoryEntry, event: WorkflowActivityEvent) {
  const [historyResult, activityResult] = await Promise.all([appendWorkflowHistory(entry), appendWorkflowActivity(event)]);

  return {
    historyResult,
    activityResult,
  };
}

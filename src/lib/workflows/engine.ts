import {
  canTransition,
  getWorkflow,
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
  isEditable,
  isFinalState,
  normalizeStatus,
} from "./registry";
import {
  createWorkflowId,
  type WorkflowActivityEvent,
  type WorkflowCommitContext,
  type WorkflowHistoryEntry,
  type WorkflowModule,
  type WorkflowTransitionContext,
  type WorkflowTransitionOptions,
  type WorkflowTransitionResult,
  WorkflowValidationError,
} from "./types";

function buildTransitionContext(module: WorkflowModule, entityId: string, from: string, to: string, options: WorkflowTransitionOptions): WorkflowTransitionContext {
  const workflow = getWorkflow(module);

  return {
    module,
    entityId,
    field: workflow.field,
    from,
    to,
    reason: options.reason,
    notes: options.notes,
    metadata: options.metadata,
    actor: options.actor,
    at: options.at ?? new Date().toISOString(),
  };
}

function buildHistoryEntry(context: WorkflowTransitionContext): WorkflowHistoryEntry {
  return {
    ...context,
    id: createWorkflowId(),
  };
}

function buildActivityEvent(context: WorkflowTransitionContext): WorkflowActivityEvent {
  const workflow = getWorkflow(context.module);
  const statusLabel = getWorkflowStatusLabel(context.module, context.to);

  return {
    id: createWorkflowId(),
    module: context.module,
    entityId: context.entityId,
    label: `${workflow.entityLabel} ${statusLabel}`,
    detail: context.reason ?? context.notes,
    tone: getWorkflowStatusTone(context.module, context.to),
    at: context.at,
    metadata: context.metadata,
  };
}

export async function transition(
  module: WorkflowModule,
  entityId: string,
  from: string,
  to: string,
  options: WorkflowTransitionOptions = {},
): Promise<WorkflowTransitionResult> {
  const workflow = getWorkflow(module);
  const normalizedEntityId = entityId.trim();
  const current = normalizeStatus(from);
  const next = normalizeStatus(to);

  if (!normalizedEntityId) {
    throw new WorkflowValidationError("A workflow entity ID is required.", "WORKFLOW_ENTITY_ID_REQUIRED");
  }

  if (!next) {
    throw new WorkflowValidationError("A target workflow status is required.", "WORKFLOW_TARGET_REQUIRED");
  }

  if (!canTransition(module, current, next)) {
    throw new WorkflowValidationError("That workflow transition is not allowed.", "WORKFLOW_TRANSITION_BLOCKED", {
      module,
      from: current ?? null,
      to: next,
      allowed: "open" in workflow && workflow.open ? [] : workflow.transitions[current ?? "Draft"] ?? [],
    });
  }

  const context = buildTransitionContext(module, normalizedEntityId, current ?? next, next, options);

  if (options.canUserTransition) {
    const allowed = await options.canUserTransition(context);
    if (!allowed) {
      throw new WorkflowValidationError("You do not have permission to perform this workflow transition.", "WORKFLOW_PERMISSION_DENIED");
    }
  }

  const history = buildHistoryEntry(context);
  const activity = buildActivityEvent(context);
  const warnings: string[] = [];

  if (options.commit) {
    await options.commit({ ...context, history, activity } as WorkflowCommitContext);
  }

  if (options.writeHistory) {
    try {
      await options.writeHistory(history);
    } catch (error) {
      warnings.push(`Workflow history was not saved: ${(error as Error).message}`);
    }
  }

  if (options.writeActivity) {
    try {
      await options.writeActivity(activity);
    } catch (error) {
      warnings.push(`Workflow activity was not saved: ${(error as Error).message}`);
    }
  }

  return {
    ok: true,
    context,
    history,
    activity,
    warnings,
  };
}

export function transitionLabel(module: WorkflowModule, status?: string | null) {
  return getWorkflowStatusLabel(module, status);
}

export { WorkflowValidationError, canTransition, getWorkflow, getWorkflowStatusLabel, getWorkflowStatusTone, isEditable, isFinalState };

export const WORKFLOW_MODULES = [
  "companies",
  "contacts",
  "leads",
  "quotations",
  "contracts",
  "projects",
  "tasks",
  "invoices",
  "support-tickets",
  "custom",
] as const;

export type WorkflowModule = (typeof WORKFLOW_MODULES)[number];
export type WorkflowField = "status" | "stage";
export type WorkflowTone = "default" | "success" | "warning" | "muted" | "danger" | "info" | "accent";

export type WorkflowStatusDefinition = {
  value: string;
  label?: string;
  tone?: WorkflowTone;
  final?: boolean;
  editable?: boolean;
};

export type WorkflowDefinition = {
  module: WorkflowModule;
  label: string;
  entityLabel: string;
  field: WorkflowField;
  statuses: readonly WorkflowStatusDefinition[];
  transitions: Record<string, readonly string[]>;
  open?: boolean;
};

export type WorkflowActor = {
  id?: string;
  name?: string;
  email?: string;
};

export type WorkflowTransitionContext = {
  module: WorkflowModule;
  entityId: string;
  field: WorkflowField;
  from: string;
  to: string;
  reason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  actor?: WorkflowActor;
  at: string;
};

export type WorkflowHistoryEntry = WorkflowTransitionContext & {
  id: string;
};

export type WorkflowActivityEvent = {
  id: string;
  module: WorkflowModule;
  entityId: string;
  label: string;
  detail?: string;
  tone: WorkflowTone;
  at: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowCommitContext = WorkflowTransitionContext & {
  history: WorkflowHistoryEntry;
  activity: WorkflowActivityEvent;
};

export type WorkflowTransitionOptions = {
  reason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  actor?: WorkflowActor;
  at?: string;
  canUserTransition?: (context: WorkflowTransitionContext) => boolean | Promise<boolean>;
  commit?: (context: WorkflowCommitContext) => Promise<void>;
  writeHistory?: (entry: WorkflowHistoryEntry) => Promise<void>;
  writeActivity?: (event: WorkflowActivityEvent) => Promise<void>;
};

export type WorkflowTransitionResult = {
  ok: true;
  context: WorkflowTransitionContext;
  history: WorkflowHistoryEntry;
  activity: WorkflowActivityEvent;
  warnings: string[];
};

export class WorkflowValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code = "WORKFLOW_VALIDATION_ERROR", details?: Record<string, unknown>) {
    super(message);
    this.name = "WorkflowValidationError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeWorkflowValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function createWorkflowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `wf_${stamp}_${random}`;
}

export function isTransientWorkflowErrorCode(code?: string | null) {
  return code === "42501" || code === "42P01" || code === "PGRST205";
}

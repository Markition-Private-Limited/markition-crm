import type { WorkflowDefinition, WorkflowModule, WorkflowStatusDefinition, WorkflowTone } from "./types";

function defineStatuses(statuses: readonly WorkflowStatusDefinition[]) {
  return statuses;
}

function defineTransitions(transitions: Record<string, readonly string[]>) {
  return transitions;
}

function openWorkflow(module: WorkflowModule, label: string, entityLabel: string): WorkflowDefinition {
  return {
    module,
    label,
    entityLabel,
    field: "status",
    statuses: defineStatuses([]),
    transitions: defineTransitions({}),
    open: true,
  };
}

export const WORKFLOW_REGISTRY = {
  companies: openWorkflow("companies", "Companies", "Company"),
  contacts: openWorkflow("contacts", "Contacts", "Contact"),
  leads: {
    module: "leads",
    label: "Leads",
    entityLabel: "Lead",
    field: "stage",
    statuses: defineStatuses([
      { value: "New", tone: "default" },
      { value: "Contacted", tone: "info" },
      { value: "Qualified", tone: "success" },
      { value: "Proposal Sent", tone: "accent" },
      { value: "Negotiation", tone: "warning" },
      { value: "Won", tone: "success", final: true },
      { value: "Lost", tone: "danger", final: true },
    ]),
    transitions: defineTransitions({
      New: ["Contacted"],
      Contacted: ["Qualified", "Negotiation", "Lost"],
      Qualified: ["Proposal Sent", "Negotiation", "Won", "Lost"],
      "Proposal Sent": ["Negotiation", "Won", "Lost"],
      Negotiation: ["Won", "Lost"],
      Won: [],
      Lost: [],
    }),
  },
  quotations: {
    module: "quotations",
    label: "Quotations",
    entityLabel: "Quotation",
    field: "status",
    statuses: defineStatuses([
      { value: "Draft", tone: "default" },
      { value: "Sent", tone: "info" },
      { value: "Viewed", tone: "accent" },
      { value: "Accepted", tone: "success", final: true },
      { value: "Rejected", tone: "danger", final: true },
      { value: "Expired", tone: "warning", final: true },
    ]),
    transitions: defineTransitions({
      Draft: ["Sent"],
      Sent: ["Viewed", "Accepted", "Rejected", "Expired"],
      Viewed: ["Accepted", "Rejected", "Expired"],
      Accepted: [],
      Rejected: [],
      Expired: [],
    }),
  },
  contracts: {
    module: "contracts",
    label: "Contracts",
    entityLabel: "Contract",
    field: "status",
    statuses: defineStatuses([
      { value: "Draft", tone: "default" },
      { value: "Under Review", tone: "info" },
      { value: "Pending Signature", tone: "accent" },
      { value: "Active", tone: "success" },
      { value: "Completed", tone: "success", final: true },
      { value: "Expired", tone: "warning", final: true },
      { value: "Terminated", tone: "danger", final: true },
      { value: "Renewed", tone: "accent" },
    ]),
    transitions: defineTransitions({
      Draft: ["Under Review", "Pending Signature"],
      "Under Review": ["Pending Signature", "Draft", "Terminated"],
      "Pending Signature": ["Active", "Terminated"],
      Active: ["Completed", "Expired", "Terminated", "Renewed"],
      Completed: [],
      Expired: [],
      Terminated: [],
      Renewed: ["Active", "Expired", "Terminated"],
    }),
  },
  projects: {
    module: "projects",
    label: "Projects",
    entityLabel: "Project",
    field: "status",
    statuses: defineStatuses([
      { value: "Planning", tone: "default" },
      { value: "Active", tone: "info" },
      { value: "On Hold", tone: "warning" },
      { value: "Completed", tone: "success", final: true },
      { value: "Cancelled", tone: "danger", final: true },
    ]),
    transitions: defineTransitions({
      Planning: ["Active", "Cancelled"],
      Active: ["On Hold", "Completed", "Cancelled"],
      "On Hold": ["Active", "Completed", "Cancelled"],
      Completed: [],
      Cancelled: [],
    }),
  },
  tasks: {
    module: "tasks",
    label: "Tasks",
    entityLabel: "Task",
    field: "status",
    statuses: defineStatuses([
      { value: "Open", tone: "default" },
      { value: "Planning", tone: "accent" },
      { value: "In Progress", tone: "info" },
      { value: "Review", tone: "warning" },
      { value: "Blocked", tone: "danger" },
      { value: "Waiting Client", tone: "warning" },
      { value: "Completed", tone: "success", final: true },
      { value: "Cancelled", tone: "muted", final: true },
      { value: "Archived", tone: "muted", final: true },
    ]),
    transitions: defineTransitions({
      Open: ["Planning", "In Progress", "Cancelled", "Archived"],
      Planning: ["In Progress", "Blocked", "Waiting Client", "Cancelled", "Archived"],
      "In Progress": ["Review", "Blocked", "Waiting Client", "Completed", "Cancelled", "Archived"],
      Review: ["In Progress", "Blocked", "Waiting Client", "Completed", "Cancelled", "Archived"],
      Blocked: ["Planning", "In Progress", "Waiting Client", "Cancelled", "Archived"],
      "Waiting Client": ["Planning", "In Progress", "Review", "Blocked", "Cancelled", "Archived"],
      Completed: [],
      Cancelled: [],
      Archived: [],
    }),
  },
  invoices: {
    module: "invoices",
    label: "Invoices",
    entityLabel: "Invoice",
    field: "status",
    statuses: defineStatuses([
      { value: "Draft", tone: "default" },
      { value: "Sent", tone: "info" },
      { value: "Paid", tone: "success", final: true },
      { value: "Partial", tone: "warning" },
      { value: "Overdue", tone: "danger" },
      { value: "Cancelled", tone: "muted", final: true },
    ]),
    transitions: defineTransitions({
      Draft: ["Sent", "Cancelled"],
      Sent: ["Partial", "Paid", "Overdue", "Cancelled"],
      Partial: ["Paid", "Overdue", "Cancelled"],
      Overdue: ["Paid", "Cancelled"],
      Paid: [],
      Cancelled: [],
    }),
  },
  "support-tickets": {
    module: "support-tickets",
    label: "Support Tickets",
    entityLabel: "Support Ticket",
    field: "status",
    statuses: defineStatuses([
      { value: "Open", tone: "default" },
      { value: "In Progress", tone: "info" },
      { value: "Waiting on Customer", tone: "warning" },
      { value: "Resolved", tone: "success" },
      { value: "Closed", tone: "muted", final: true },
      { value: "Reopened", tone: "accent" },
    ]),
    transitions: defineTransitions({
      Open: ["In Progress", "Waiting on Customer", "Closed"],
      "In Progress": ["Waiting on Customer", "Resolved", "Closed"],
      "Waiting on Customer": ["In Progress", "Resolved", "Reopened", "Closed"],
      Resolved: ["Closed", "Reopened"],
      Closed: [],
      Reopened: ["In Progress", "Waiting on Customer", "Resolved"],
    }),
  },
  custom: openWorkflow("custom", "Custom Modules", "Record"),
} as const satisfies Record<WorkflowModule, WorkflowDefinition>;

export function getWorkflow(module: WorkflowModule) {
  return WORKFLOW_REGISTRY[module];
}

export function getStatusList(module: WorkflowModule) {
  return getWorkflow(module).statuses.map((status) => status.value);
}

export function getStatusDefinition(module: WorkflowModule, status?: string | null) {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return undefined;
  }

  return getWorkflow(module).statuses.find((item) => item.value === normalized);
}

export function normalizeStatus(status?: string | null) {
  const trimmed = status?.trim();
  return trimmed ? trimmed : undefined;
}

export function canTransition(module: WorkflowModule, from?: string | null, to?: string | null) {
  const workflow = getWorkflow(module);
  const current = normalizeStatus(from);
  const next = normalizeStatus(to);

  if (!next) {
    return false;
  }

  if (current === next) {
    return false;
  }

  if ("open" in workflow && workflow.open) {
    return true;
  }

  if (!current) {
    return workflow.transitions.Draft?.includes(next) ?? workflow.statuses.some((status) => status.value === next);
  }

  const allowed = workflow.transitions[current] ?? [];
  return allowed.includes(next);
}

export function getNextStatuses(module: WorkflowModule, currentStatus?: string | null) {
  const workflow = getWorkflow(module);
  const current = normalizeStatus(currentStatus);

  if ("open" in workflow && workflow.open) {
    return [];
  }

  if (!current) {
    return workflow.transitions.Draft ? [...workflow.transitions.Draft] : getStatusList(module);
  }

  return [...(workflow.transitions[current] ?? [])];
}

export function isFinalState(module: WorkflowModule, status?: string | null) {
  const workflow = getWorkflow(module);
  const definition = getStatusDefinition(module, status);

  if ("open" in workflow && workflow.open) {
    return false;
  }

  return Boolean(definition?.final || getNextStatuses(module, status).length === 0);
}

export function isEditable(module: WorkflowModule, status?: string | null) {
  const definition = getStatusDefinition(module, status);

  if (definition?.editable === false) {
    return false;
  }

  return !isFinalState(module, status);
}

export function getWorkflowStatusLabel(module: WorkflowModule, status?: string | null) {
  return getStatusDefinition(module, status)?.label ?? normalizeStatus(status) ?? "Unknown";
}

export function getWorkflowStatusTone(module: WorkflowModule, status?: string | null): WorkflowTone {
  return getStatusDefinition(module, status)?.tone ?? "default";
}

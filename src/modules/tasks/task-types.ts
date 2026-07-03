import { z } from "zod";
import type { WorkflowActivityEvent, WorkflowHistoryEntry } from "@/src/lib/workflows";

const trimEmptyToUndefined = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
};

const optionalString = (maxLength = 500) =>
  z.preprocess(trimEmptyToUndefined, z.string().max(maxLength).optional());

const optionalDate = () =>
  z.preprocess(
    trimEmptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").optional(),
  );

const optionalNumber = () =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().nonnegative().optional());

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const taskSchema = z.object({
  title: z.string().min(2, "Task title is required").max(160, "Task title is too long"),
  description: optionalString(8000),
  status: optionalString(60),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: optionalString(160),
  reporter: optionalString(160),
  followers: z.array(z.string()).optional(),
  company_id: optionalString(80),
  contact_id: optionalString(80),
  lead_id: optionalString(80),
  project_id: optionalString(80),
  quotation_id: optionalString(80),
  contract_id: optionalString(80),
  labels: z.array(z.string()).optional(),
  due_date: optionalDate(),
  start_date: optionalDate(),
  estimated_hours: optionalNumber(),
  actual_hours: optionalNumber(),
  time_tracking: z
    .object({
      estimated: z.number().nonnegative().optional(),
      tracked: z.number().nonnegative().optional(),
      remaining: z.number().nonnegative().optional(),
      timer_placeholder: z.boolean().optional(),
    })
    .optional(),
  attachments: z.array(z.any()).optional(),
  comments: z.array(z.any()).optional(),
  checklist: z.array(z.any()).optional(),
  dependencies: z.array(z.any()).optional(),
});

export type TaskChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  children?: TaskChecklistItem[];
};

export type TaskAttachment = {
  id: string;
  name: string;
  url?: string;
  size_kb?: number;
  version?: number;
  uploaded_at?: string;
};

export type TaskComment = {
  id: string;
  author: string;
  body: string;
  mentions?: string[];
  attachments?: TaskAttachment[];
  created_at: string;
  updated_at?: string;
};

export type TaskDependency = {
  task_id: string;
  relation: "blocks" | "depends_on";
};

export type TaskTimeTracking = {
  estimated?: number;
  tracked?: number;
  remaining?: number;
  timer_placeholder?: boolean;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: TaskPriority;
  assignee?: string;
  reporter?: string;
  followers?: string[];
  company_id?: string;
  contact_id?: string;
  lead_id?: string;
  project_id?: string;
  quotation_id?: string;
  contract_id?: string;
  labels?: string[];
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  time_tracking?: TaskTimeTracking;
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  checklist?: TaskChecklistItem[];
  dependencies?: TaskDependency[];
  workflow_history?: WorkflowHistoryEntry[];
  workflow_events?: WorkflowActivityEvent[];
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TaskFormValues = z.infer<typeof taskSchema>;

export type TaskSortOption =
  | "newest"
  | "oldest"
  | "priority"
  | "due-date"
  | "updated"
  | "alphabetical";

export type TaskSmartView =
  | "my"
  | "team"
  | "today"
  | "upcoming"
  | "overdue"
  | "completed";

export type TaskDisplayView = "list" | "kanban" | "calendar";

export const DEFAULT_TASK_STATUS = "Open";

export function parseTextList(value?: string | string[] | null) {
  if (!value) {
    return [] as string[];
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatHours(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0h";
  }

  if (value >= 1) {
    return `${value.toFixed(1)}h`;
  }

  return `${Math.round(value * 60)}m`;
}

export function checklistProgress(checklist?: TaskChecklistItem[]) {
  const stack = [...(checklist ?? [])];
  let total = 0;
  let done = 0;

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) {
      continue;
    }
    total += 1;
    if (item.completed) {
      done += 1;
    }
    if (item.children?.length) {
      stack.push(...item.children);
    }
  }

  if (total === 0) {
    return 0;
  }

  return Math.round((done / total) * 100);
}

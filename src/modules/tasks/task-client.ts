import { DEFAULT_TASK_STATUS, type Task, type TaskFormValues } from "./task-types";

function generateId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeTask(data: Partial<Task> & { id: string }): Task {
  return {
    ...data,
    status: data.status ?? DEFAULT_TASK_STATUS,
    followers: Array.isArray(data.followers) ? data.followers : [],
    labels: Array.isArray(data.labels) ? data.labels : [],
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    comments: Array.isArray(data.comments) ? data.comments : [],
    dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    title: data.title ?? "",
  } as Task;
}

type ApiError = { message: string } | null;

export async function createTask(task: TaskFormValues) {
  const data = normalizeTask({ id: generateId(), ...task, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { data, error: null as ApiError };
}

export async function updateTask(id: string, task: Partial<TaskFormValues>, _auditChanges?: Record<string, { from: unknown; to: unknown }>) {
  const data = normalizeTask({ id, ...task, updated_at: new Date().toISOString() });
  return { data, error: null as ApiError };
}

export async function deleteTask(_id: string) {
  return { error: null as ApiError };
}

export async function bulkUpdateTasks(ids: string[], patch: Partial<TaskFormValues>) {
  const data = ids.map((id) => normalizeTask({ id, ...patch, updated_at: new Date().toISOString() }));
  return { data, error: null as ApiError };
}

export async function bulkDeleteTasks(_ids: string[]) {
  return { error: null as ApiError };
}

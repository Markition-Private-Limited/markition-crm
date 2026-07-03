import { supabaseBrowser } from "@/lib/supabaseClient";
import { DEFAULT_TASK_STATUS, type Task, type TaskFormValues } from "./task-types";

function normalizeTask(data: any): Task {
  return {
    ...data,
    status: data?.status ?? DEFAULT_TASK_STATUS,
    followers: Array.isArray(data?.followers) ? data.followers : [],
    labels: Array.isArray(data?.labels) ? data.labels : [],
    checklist: Array.isArray(data?.checklist) ? data.checklist : [],
    comments: Array.isArray(data?.comments) ? data.comments : [],
    dependencies: Array.isArray(data?.dependencies) ? data.dependencies : [],
    attachments: Array.isArray(data?.attachments) ? data.attachments : [],
  } as Task;
}

export async function createTask(task: TaskFormValues) {
  const { data, error } = await supabaseBrowser
    .from("tasks")
    .insert({
      ...task,
      status: task.status ?? DEFAULT_TASK_STATUS,
      time_tracking: task.time_tracking ?? {
        estimated: task.estimated_hours ?? 0,
        tracked: task.actual_hours ?? 0,
        remaining: Math.max((task.estimated_hours ?? 0) - (task.actual_hours ?? 0), 0),
        timer_placeholder: true,
      },
    })
    .select("*")
    .single();

  return { data: data ? normalizeTask(data) : null, error };
}

export async function updateTask(id: string, task: Partial<TaskFormValues>) {
  const { data, error } = await supabaseBrowser
    .from("tasks")
    .update({ ...task, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  return { data: data ? normalizeTask(data) : null, error };
}

export async function deleteTask(id: string) {
  const { error } = await supabaseBrowser.from("tasks").delete().eq("id", id);
  return { error };
}

export async function bulkUpdateTasks(ids: string[], patch: Partial<TaskFormValues>) {
  const { data, error } = await supabaseBrowser
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");

  return {
    data: ((data ?? []) as any[]).map(normalizeTask),
    error,
  };
}

export async function bulkDeleteTasks(ids: string[]) {
  const { error } = await supabaseBrowser.from("tasks").delete().in("id", ids);
  return { error };
}

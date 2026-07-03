import { createServerSupabase } from "@/lib/serverSupabase";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  DEFAULT_TASK_STATUS,
  type Task,
  type TaskComment,
  type TaskFormValues,
} from "./task-types";

function fallbackTasks(): Task[] {
  const now = new Date();
  const date = (offset: number) => {
    const next = new Date(now);
    next.setDate(now.getDate() + offset);
    return next.toISOString().slice(0, 10);
  };

  return [
    {
      id: "task-seed-1",
      title: "Prepare onboarding checklist",
      description: "Create initial onboarding sequence for new CRM accounts.",
      status: "Planning",
      priority: "High",
      assignee: "You",
      reporter: "Sales Ops",
      followers: ["Support Team"],
      labels: ["Onboarding", "Internal"],
      due_date: date(2),
      start_date: date(0),
      estimated_hours: 4,
      actual_hours: 1.5,
      time_tracking: { estimated: 4, tracked: 1.5, remaining: 2.5, timer_placeholder: true },
      checklist: [
        {
          id: "seed-check-1",
          title: "Draft checklist structure",
          completed: true,
          children: [{ id: "seed-check-1-1", title: "Include account setup", completed: true }],
        },
        { id: "seed-check-2", title: "Align with support handoff", completed: false },
      ],
      comments: [
        {
          id: "seed-comment-1",
          author: "Sales Ops",
          body: "Please include an escalation branch for blocked setup.",
          mentions: ["@you"],
          created_at: now.toISOString(),
        },
      ],
      dependencies: [],
      attachments: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: "task-seed-2",
      title: "Review contract renewal reminders",
      description: "Audit upcoming renewal triggers and update notification copy.",
      status: "Waiting Client",
      priority: "Medium",
      assignee: "Customer Success",
      reporter: "Legal",
      followers: ["You"],
      labels: ["Contracts"],
      due_date: date(5),
      estimated_hours: 3,
      actual_hours: 0,
      time_tracking: { estimated: 3, tracked: 0, remaining: 3, timer_placeholder: true },
      checklist: [],
      comments: [],
      dependencies: [{ task_id: "task-seed-1", relation: "depends_on" }],
      attachments: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
}

function mapTask(row: Record<string, any>): Task {
  return {
    ...row,
    followers: Array.isArray(row.followers) ? row.followers : [],
    labels: Array.isArray(row.labels) ? row.labels : [],
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    time_tracking:
      row.time_tracking && typeof row.time_tracking === "object"
        ? row.time_tracking
        : {
            estimated: row.estimated_hours,
            tracked: row.actual_hours,
            remaining: Math.max((row.estimated_hours ?? 0) - (row.actual_hours ?? 0), 0),
            timer_placeholder: true,
          },
    status: row.status ?? DEFAULT_TASK_STATUS,
  } as Task;
}

function isRecoverable(error: any) {
  const code = error?.code;
  return code === "42501" || code === "42P01" || code === "PGRST205";
}

export async function getTasks() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isRecoverable(error)) {
      return fallbackTasks();
    }
    throw error;
  }

  const rows = (data ?? []) as Record<string, any>[];
  if (rows.length === 0) {
    return fallbackTasks();
  }

  return rows.map(mapTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();

  if (error) {
    if (isRecoverable(error)) {
      return fallbackTasks().find((task) => task.id === id) ?? null;
    }
    if (error.details?.includes("No rows")) {
      return null;
    }
    throw error;
  }

  return mapTask(data as Record<string, any>);
}

export async function createTask(task: TaskFormValues) {
  const payload = {
    ...task,
    status: task.status ?? DEFAULT_TASK_STATUS,
    time_tracking: task.time_tracking ?? {
      estimated: task.estimated_hours ?? 0,
      tracked: task.actual_hours ?? 0,
      remaining: Math.max((task.estimated_hours ?? 0) - (task.actual_hours ?? 0), 0),
      timer_placeholder: true,
    },
  };

  const { data, error } = await supabaseBrowser.from("tasks").insert(payload).select("*").single();
  return { data: data ? mapTask(data as Record<string, any>) : null, error };
}

export async function updateTask(id: string, task: Partial<TaskFormValues>) {
  const { data, error } = await supabaseBrowser
    .from("tasks")
    .update({
      ...task,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  return { data: data ? mapTask(data as Record<string, any>) : null, error };
}

export async function deleteTask(id: string) {
  const { error } = await supabaseBrowser.from("tasks").delete().eq("id", id);
  return { error };
}

export async function bulkUpdateTasks(ids: string[], patch: Partial<TaskFormValues>) {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabaseBrowser
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");

  return {
    data: ((data ?? []) as Record<string, any>[]).map(mapTask),
    error,
  };
}

export async function bulkDeleteTasks(ids: string[]) {
  if (ids.length === 0) {
    return { error: null };
  }
  const { error } = await supabaseBrowser.from("tasks").delete().in("id", ids);
  return { error };
}

export async function appendTaskComment(task: Task, comment: TaskComment) {
  const comments = [...(task.comments ?? []), comment];
  return updateTask(task.id, {
    comments,
    actual_hours: task.actual_hours,
    estimated_hours: task.estimated_hours,
  });
}

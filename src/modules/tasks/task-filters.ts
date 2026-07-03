import {
  checklistProgress,
  type Task,
  type TaskPriority,
  type TaskSmartView,
  type TaskSortOption,
} from "./task-types";

export type TaskFilterState = {
  query: string;
  statuses: string[];
  priorities: TaskPriority[];
  assignee: string;
  companyId: string;
  leadId: string;
  dueBucket: "all" | "today" | "this-week" | "overdue" | "none";
  labels: string[];
  workflowStage: string;
};

const priorityWeight: Record<TaskPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function toDateOnly(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function includesQuery(task: Task, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    task.title,
    task.description,
    task.status,
    task.priority,
    task.assignee,
    task.reporter,
    ...(task.labels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function applySmartView(tasks: Task[], smartView: TaskSmartView, currentUser = "You") {
  const today = toDateOnly(new Date().toISOString().slice(0, 10));

  return tasks.filter((task) => {
    const due = toDateOnly(task.due_date);
    const status = (task.status ?? "").toLowerCase();
    const completed = status === "completed" || status === "archived";

    if (smartView === "my") {
      return (task.assignee ?? "").toLowerCase() === currentUser.toLowerCase();
    }

    if (smartView === "team") {
      return true;
    }

    if (smartView === "today") {
      return Boolean(due && today && due.getTime() === today.getTime() && !completed);
    }

    if (smartView === "upcoming") {
      return Boolean(due && today && due.getTime() > today.getTime() && !completed);
    }

    if (smartView === "overdue") {
      return Boolean(due && today && due.getTime() < today.getTime() && !completed);
    }

    return completed;
  });
}

export function applyTaskFilters(tasks: Task[], filters: TaskFilterState) {
  const today = toDateOnly(new Date().toISOString().slice(0, 10));

  return tasks.filter((task) => {
    if (!includesQuery(task, filters.query)) {
      return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status ?? "")) {
      return false;
    }

    if (filters.priorities.length > 0 && !filters.priorities.includes((task.priority ?? "Low") as TaskPriority)) {
      return false;
    }

    if (filters.assignee && task.assignee !== filters.assignee) {
      return false;
    }

    if (filters.companyId && task.company_id !== filters.companyId) {
      return false;
    }

    if (filters.leadId && task.lead_id !== filters.leadId) {
      return false;
    }

    if (filters.labels.length > 0) {
      const labels = task.labels ?? [];
      if (!filters.labels.every((label) => labels.includes(label))) {
        return false;
      }
    }

    if (filters.workflowStage && task.status !== filters.workflowStage) {
      return false;
    }

    if (filters.dueBucket !== "all") {
      const due = toDateOnly(task.due_date);
      if (filters.dueBucket === "none" && due) {
        return false;
      }
      if (filters.dueBucket === "today" && (!due || !today || due.getTime() !== today.getTime())) {
        return false;
      }
      if (filters.dueBucket === "overdue" && (!due || !today || due.getTime() >= today.getTime())) {
        return false;
      }
      if (filters.dueBucket === "this-week") {
        if (!due || !today) {
          return false;
        }
        const end = new Date(today);
        end.setDate(today.getDate() + 7);
        if (due.getTime() < today.getTime() || due.getTime() > end.getTime()) {
          return false;
        }
      }
    }

    return true;
  });
}

export function sortTasks(tasks: Task[], sortBy: TaskSortOption) {
  return [...tasks].sort((a, b) => {
    if (sortBy === "newest") {
      return (new Date(b.created_at ?? 0).getTime() || 0) - (new Date(a.created_at ?? 0).getTime() || 0);
    }

    if (sortBy === "oldest") {
      return (new Date(a.created_at ?? 0).getTime() || 0) - (new Date(b.created_at ?? 0).getTime() || 0);
    }

    if (sortBy === "priority") {
      return priorityWeight[(b.priority ?? "Low") as TaskPriority] - priorityWeight[(a.priority ?? "Low") as TaskPriority];
    }

    if (sortBy === "due-date") {
      return (new Date(a.due_date ?? "9999-12-31").getTime() || 0) - (new Date(b.due_date ?? "9999-12-31").getTime() || 0);
    }

    if (sortBy === "updated") {
      return (new Date(b.updated_at ?? 0).getTime() || 0) - (new Date(a.updated_at ?? 0).getTime() || 0);
    }

    return a.title.localeCompare(b.title);
  });
}

export function getTaskSummary(tasks: Task[]) {
  const today = toDateOnly(new Date().toISOString().slice(0, 10));

  const completed = tasks.filter((task) => ["completed", "archived"].includes((task.status ?? "").toLowerCase())).length;
  const overdue = tasks.filter((task) => {
    const due = toDateOnly(task.due_date);
    const done = ["completed", "archived"].includes((task.status ?? "").toLowerCase());
    return Boolean(due && today && due.getTime() < today.getTime() && !done);
  }).length;
  const todayCount = tasks.filter((task) => {
    const due = toDateOnly(task.due_date);
    const done = ["completed", "archived"].includes((task.status ?? "").toLowerCase());
    return Boolean(due && today && due.getTime() === today.getTime() && !done);
  }).length;

  const checklistAverage =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, task) => sum + checklistProgress(task.checklist), 0) / tasks.length)
      : 0;

  return {
    total: tasks.length,
    completed,
    overdue,
    today: todayCount,
    inProgress: tasks.filter((task) => ["in progress", "review"].includes((task.status ?? "").toLowerCase())).length,
    checklistAverage,
  };
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Pagination,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Toolbar,
} from "@/components/ui";
import { WorkflowStatusBadge } from "@/components/workflow";
import {
  bulkDeleteTasks as bulkDeleteTasksClient,
  bulkUpdateTasks as bulkUpdateTasksClient,
  createTask as createTaskClient,
  deleteTask as deleteTaskClient,
  updateTask as updateTaskClient,
} from "@/src/modules/tasks/task-client";
import {
  DEFAULT_TASK_STATUS,
  formatHours,
  type Task,
  type TaskDisplayView,
  type TaskFormValues,
  type TaskPriority,
  type TaskSortOption,
  type TaskSmartView,
} from "@/src/modules/tasks/task-types";
import {
  applySmartView,
  applyTaskFilters,
  getTaskSummary,
  sortTasks,
  type TaskFilterState,
} from "@/src/modules/tasks/task-filters";
import { getStatusList } from "@/src/lib/workflows";
import type { Company } from "@/src/modules/companies/company-types";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Lead } from "@/src/modules/leads/lead-types";
import type { Quotation } from "@/src/modules/quotations/quotation-types";
import type { Contract } from "@/src/modules/contracts/contract-types";
import { TaskEditor } from "./TaskEditor";

type Props = {
  initialTasks: Task[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  quotations: Quotation[];
  contracts: Contract[];
};

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "error";
};

const PAGE_SIZE = 12;

const baseFilters: TaskFilterState = {
  query: "",
  statuses: [],
  priorities: [] as TaskPriority[],
  assignee: "",
  companyId: "",
  leadId: "",
  dueBucket: "all",
  labels: [],
  workflowStage: "",
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString();
}

function priorityBadge(priority?: string) {
  const value = (priority ?? "Medium").toLowerCase();

  if (value === "critical") {
    return "border-danger/30 bg-danger/10 text-danger";
  }
  if (value === "high") {
    return "border-warning/30 bg-warning/10 text-warning";
  }
  if (value === "medium") {
    return "border-accent/30 bg-accent/10 text-accent";
  }

  return "border-border bg-surface-muted text-muted-foreground";
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarDays(activeMonth: Date) {
  const start = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
  const end = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0);
  const firstWeekday = start.getDay();
  const totalCells = Math.ceil((firstWeekday + end.getDate()) / 7) * 7;

  const days: Date[] = [];
  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(start);
    date.setDate(index - firstWeekday + 1);
    days.push(date);
  }

  return days;
}

export function TasksModule({ initialTasks, companies, contacts, leads, quotations, contracts }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [view, setView] = React.useState<TaskDisplayView>("list");
  const [smartView, setSmartView] = React.useState<TaskSmartView>("team");
  const [sortBy, setSortBy] = React.useState<TaskSortOption>("updated");
  const [filters, setFilters] = React.useState<TaskFilterState>(baseFilters);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [activeMonth, setActiveMonth] = React.useState(new Date());
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [isBusy, setIsBusy] = React.useState(false);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const statuses = getStatusList("tasks");

  const filteredTasks = React.useMemo(() => {
    const bySmartView = applySmartView(tasks, smartView, "You");
    const byFilters = applyTaskFilters(bySmartView, filters);
    return sortTasks(byFilters, sortBy);
  }, [filters, smartView, sortBy, tasks]);

  const summary = React.useMemo(() => getTaskSummary(filteredTasks), [filteredTasks]);

  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filters, smartView, sortBy, view]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const visiblePageItems = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const taskById = React.useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const labels = React.useMemo(() => {
    return Array.from(new Set(tasks.flatMap((task) => task.labels ?? []))).sort();
  }, [tasks]);

  const bulkApply = async (patch: Partial<TaskFormValues>, successMessage: string) => {
    if (selectedIds.length === 0) {
      return;
    }

    setIsBusy(true);
    const { data, error } = await bulkUpdateTasksClient(selectedIds, patch);
    if (error) {
      addToast({ tone: "error", title: "Bulk update failed", description: error.message });
      setIsBusy(false);
      return;
    }

    setTasks((current) =>
      current.map((task) => {
        const updated = data.find((item) => item.id === task.id);
        return updated ?? task;
      }),
    );
    setSelectedIds([]);
    setIsBusy(false);
    addToast({ tone: "success", title: successMessage });
  };

  const bulkRemove = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    setIsBusy(true);
    const { error } = await bulkDeleteTasksClient(selectedIds);
    if (error) {
      addToast({ tone: "error", title: "Delete failed", description: error.message });
      setIsBusy(false);
      return;
    }

    setTasks((current) => current.filter((task) => !selectedIds.includes(task.id)));
    setSelectedIds([]);
    setIsBusy(false);
    addToast({ tone: "success", title: "Tasks deleted" });
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    const { data, error } = await createTaskClient(values);
    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      setTasks((current) => [data, ...current]);
    }

    addToast({ tone: "success", title: "Task created" });
    router.refresh();
  };

  const handleUpdateTask = async (values: TaskFormValues) => {
    if (!editingTask) {
      return;
    }

    const { data, error } = await updateTaskClient(editingTask.id, values);
    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      setTasks((current) => current.map((task) => (task.id === data.id ? data : task)));
    }

    addToast({ tone: "success", title: "Task updated" });
    setEditingTask(null);
    router.refresh();
  };

  const toggleSelect = (taskId: string, selected: boolean) => {
    setSelectedIds((current) => {
      if (selected) {
        return Array.from(new Set([...current, taskId]));
      }
      return current.filter((id) => id !== taskId);
    });
  };

  const toggleSelectAllVisible = (selected: boolean) => {
    if (selected) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...visiblePageItems.map((task) => task.id)])),
      );
      return;
    }

    const visibleSet = new Set(visiblePageItems.map((task) => task.id));
    setSelectedIds((current) => current.filter((id) => !visibleSet.has(id)));
  };

  const calendarDays = React.useMemo(() => buildCalendarDays(activeMonth), [activeMonth]);

  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      if (!task.due_date) {
        return;
      }
      const key = task.due_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [filteredTasks]);

  const smartViewItems: Array<{ value: TaskSmartView; label: string }> = [
    { value: "my", label: "My Tasks" },
    { value: "team", label: "Team Tasks" },
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "overdue", label: "Overdue" },
    { value: "completed", label: "Completed" },
  ];

  const viewItems: Array<{ value: TaskDisplayView; label: string }> = [
    { value: "list", label: "List View" },
    { value: "kanban", label: "Kanban" },
    { value: "calendar", label: "Calendar" },
  ];

  const viewColumns = statuses.map((status) => ({
    status,
    tasks: filteredTasks.filter((task) => (task.status ?? DEFAULT_TASK_STATUS) === status),
  }));

  const allSelectedOnPage =
    visiblePageItems.length > 0 &&
    visiblePageItems.every((task) => selectedIds.includes(task.id));

  const renderList = () => {
    if (visiblePageItems.length === 0) {
      return (
        <EmptyState
          title="No tasks in this view"
          description="Adjust filters, switch views, or create a new task to start execution."
          actionHref="#"
          actionLabel="Create Task"
        />
      );
    }

    return (
      <Table>
        <TableHead>
          <tr>
            <TableHeader className="w-8">
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
            </TableHeader>
            <TableHeader>Task</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Priority</TableHeader>
            <TableHeader>Assignee</TableHeader>
            <TableHeader>Due</TableHeader>
            <TableHeader>Time</TableHeader>
            <TableHeader>Dependencies</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </tr>
        </TableHead>
        <TableBody>
          {visiblePageItems.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(task.id)}
                  onChange={(event) => toggleSelect(task.id, event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </TableCell>
              <TableCell>
                <Link href={`/tasks/${task.id}`} className="font-semibold text-foreground hover:text-accent">
                  {task.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description || "No description"}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(task.labels ?? []).map((label) => (
                    <Badge key={label} variant="outline">{label}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <WorkflowStatusBadge module="tasks" status={task.status} archived={task.archived} />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={priorityBadge(task.priority)}>{task.priority || "Medium"}</Badge>
              </TableCell>
              <TableCell>{task.assignee || "Unassigned"}</TableCell>
              <TableCell>{formatDate(task.due_date)}</TableCell>
              <TableCell>
                <p className="text-xs text-muted-foreground">Est {formatHours(task.estimated_hours)}</p>
                <p className="text-xs text-muted-foreground">Tracked {formatHours(task.actual_hours)}</p>
              </TableCell>
              <TableCell>{task.dependencies?.length ?? 0}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const { error } = await deleteTaskClient(task.id);
                      if (error) {
                        addToast({ tone: "error", title: "Delete failed", description: error.message });
                        return;
                      }
                      setTasks((current) => current.filter((item) => item.id !== task.id));
                      addToast({ tone: "success", title: "Task deleted" });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderKanban = () => {
    return (
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {viewColumns.map((column) => (
          <Card key={column.status} tone="subtle">
            <CardHeader>
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{column.status}</p>
                <Badge variant="outline">{column.tasks.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              {column.tasks.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-border bg-surface px-3 py-2 text-xs text-muted-foreground">No tasks</p>
              ) : (
                column.tasks.map((task) => (
                  <Link
                    href={`/tasks/${task.id}`}
                    key={task.id}
                    className="block rounded-[14px] border border-border bg-surface p-3 transition hover:bg-surface-muted"
                  >
                    <p className="text-sm font-semibold text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description || "No description"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.assignee || "Unassigned"}</span>
                      <span>{formatDate(task.due_date)}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    );
  };

  const renderCalendar = () => {
    const activeMonthLabel = activeMonth.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    return (
      <Card>
        <CardHeader>
          <div className="flex w-full items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">{activeMonthLabel}</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setActiveMonth((current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                  )
                }
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setActiveMonth((current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2 py-1">{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const tasksForDay = tasksByDate.get(key) ?? [];
              const inMonth = monthKey(day) === monthKey(activeMonth);

              return (
                <div
                  key={key}
                  className={`min-h-28 rounded-[14px] border p-2 ${
                    inMonth ? "border-border bg-surface" : "border-border/50 bg-surface-muted"
                  }`}
                >
                  <div className="text-xs font-semibold text-muted-foreground">{day.getDate()}</div>
                  <div className="mt-2 space-y-1">
                    {tasksForDay.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="block rounded-[10px] border border-border bg-surface-muted px-2 py-1 text-xs text-foreground"
                      >
                        {task.title}
                      </Link>
                    ))}
                    {tasksForDay.length > 3 ? (
                      <p className="text-[11px] text-muted-foreground">+{tasksForDay.length - 3} more</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Tasks"
          title="Execution Workspace"
          description="Run operational work in one place with workflow-aware boards, schedule visibility, dependencies, and collaboration."
          actions={<Button onClick={() => setCreateOpen(true)}>Create Task</Button>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardBody className="pt-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task Summary</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{summary.total}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Today&apos;s Tasks</p>
              <p className="mt-2 text-3xl font-semibold text-accent">{summary.today}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Overdue</p>
              <p className="mt-2 text-3xl font-semibold text-danger">{summary.overdue}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Upcoming / In Progress</p>
              <p className="mt-2 text-3xl font-semibold text-warning">{summary.inProgress}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recently Completed</p>
              <p className="mt-2 text-3xl font-semibold text-success">{summary.completed}</p>
            </CardBody>
          </Card>
        </div>

        <Toolbar>
          <Input
            className="min-w-56"
            placeholder="Search tasks"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          />

          <select
            className="h-10 rounded-[16px] border border-border bg-surface px-3 text-sm text-foreground"
            value={filters.workflowStage}
            onChange={(event) => setFilters((current) => ({ ...current, workflowStage: event.target.value }))}
          >
            <option value="">All stages</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            className="h-10 rounded-[16px] border border-border bg-surface px-3 text-sm text-foreground"
            value={filters.assignee}
            onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))}
          >
            <option value="">All assignees</option>
            {Array.from(new Set(tasks.map((task) => task.assignee).filter(Boolean))).map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>

          <select
            className="h-10 rounded-[16px] border border-border bg-surface px-3 text-sm text-foreground"
            value={filters.companyId}
            onChange={(event) => setFilters((current) => ({ ...current, companyId: event.target.value }))}
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>

          <select
            className="h-10 rounded-[16px] border border-border bg-surface px-3 text-sm text-foreground"
            value={filters.leadId}
            onChange={(event) => setFilters((current) => ({ ...current, leadId: event.target.value }))}
          >
            <option value="">All leads</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>{lead.title || lead.name || lead.id}</option>
            ))}
          </select>

          <select
            className="h-10 rounded-[16px] border border-border bg-surface px-3 text-sm text-foreground"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as TaskSortOption)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Priority</option>
            <option value="due-date">Due Date</option>
            <option value="updated">Recently Updated</option>
            <option value="alphabetical">Alphabetical</option>
          </select>

          <Button variant="ghost" onClick={() => setFilters(baseFilters)}>Reset Filters</Button>
        </Toolbar>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={smartViewItems.map((item) => ({ value: item.value, label: item.label }))}
            value={smartView}
            onChange={(value) => setSmartView(value as TaskSmartView)}
          />
          <Tabs
            items={viewItems.map((item) => ({ value: item.value, label: item.label }))}
            value={view}
            onChange={(value) => setView(value as TaskDisplayView)}
          />
        </div>

        {selectedIds.length > 0 ? (
          <Card tone="subtle">
            <CardBody className="flex flex-wrap items-center gap-2 pt-5">
              <Badge variant="outline">{selectedIds.length} selected</Badge>
              <Button size="sm" onClick={() => bulkApply({ assignee: "You" }, "Tasks assigned") } disabled={isBusy}>Assign to Me</Button>
              <Button size="sm" onClick={() => bulkApply({ status: "Completed" }, "Tasks completed") } disabled={isBusy}>Complete</Button>
              <Button size="sm" onClick={() => bulkApply({ status: "Archived" }, "Tasks archived") } disabled={isBusy}>Archive</Button>
              <Button size="sm" onClick={() => bulkApply({ status: "In Progress" }, "Status updated") } disabled={isBusy}>Move Status</Button>
              <Button size="sm" onClick={() => bulkApply({ priority: "High" }, "Priority updated") } disabled={isBusy}>Change Priority</Button>
              <Button size="sm" variant="ghost" onClick={bulkRemove} disabled={isBusy}>Delete</Button>
            </CardBody>
          </Card>
        ) : null}

        {view === "list" ? renderList() : null}
        {view === "kanban" ? renderKanban() : null}
        {view === "calendar" ? renderCalendar() : null}

        {view === "list" && filteredTasks.length > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        ) : null}
      </div>

      <TaskEditor
        open={createOpen}
        title="Create Task"
        submitLabel="Create Task"
        companies={companies}
        contacts={contacts}
        leads={leads}
        quotations={quotations}
        contracts={contracts}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateTask}
      />

      <TaskEditor
        open={Boolean(editingTask)}
        title="Edit Task"
        submitLabel="Save Task"
        initialTask={editingTask}
        companies={companies}
        contacts={contacts}
        leads={leads}
        quotations={quotations}
        contracts={contracts}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-80 rounded-[14px] border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            <p className="font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}

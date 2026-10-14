"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  Users,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/src/modules/projects/project-types";
import type { ProjectMember } from "@/src/modules/project-members/pm-types";
import {
  addProjectMemberById,
  createProjectTask,
  removeProjectMember,
} from "@/src/modules/project-members/pm-client";
import { MOCK_USERS } from "@/src/mock/data";
import { formatProjectDate, formatMoney } from "./project-detail-utils";

const TASK_PRIORITIES_LIST = ["Low", "Medium", "High", "Critical"] as const;

type SimpleTask = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  assignee?: string | null;
  created_by?: string | null;
};

type Toast = { id: number; tone: "success" | "error"; message: string };

interface ProjectDetailProps {
  project: Project & { owner_id?: string };
  members: ProjectMember[];
  tasks: SimpleTask[];
  currentUserId: string | null;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-sky-100 text-sky-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Done: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-600",
  Blocked: "bg-rose-100 text-rose-700",
};

function statusBadge(status?: string | null) {
  const s = status ?? "Open";
  const cls = STATUS_COLORS[s] ?? "bg-surface-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {s}
    </span>
  );
}

export function ProjectDetail({ project, members, tasks, currentUserId, canManage }: ProjectDetailProps) {
  const router = useRouter();
  const [localMembers, setLocalMembers] = React.useState<ProjectMember[]>(members);
  const [localTasks, setLocalTasks] = React.useState<SimpleTask[]>(tasks);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  // Add member modal
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const [addingMember, setAddingMember] = React.useState(false);
  const [memberError, setMemberError] = React.useState("");
  const [allProfiles, setAllProfiles] = React.useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [profilesLoading, setProfilesLoading] = React.useState(false);
  const [memberSearch, setMemberSearch] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState("");

  // Add task modal
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    priority: "Medium" as string,
    due_date: "",
    assigned_user_id: "",
  });
  const [addingTask, setAddingTask] = React.useState(false);
  const [taskError, setTaskError] = React.useState("");

  const toast = React.useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const openAddMember = React.useCallback(() => {
    setAddMemberOpen(true);
    setMemberSearch("");
    setSelectedUserId("");
    setMemberError("");
    setAllProfiles(MOCK_USERS.map((u) => ({ id: u.id, email: u.email, full_name: u.name })));
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError("");

    if (!selectedUserId) {
      setMemberError("Please select a user.");
      return;
    }

    setAddingMember(true);
    const { data, error } = await addProjectMemberById(project.id, selectedUserId);
    setAddingMember(false);

    if (error) {
      setMemberError(error);
      return;
    }

    if (data) {
      setLocalMembers((prev) => [...prev, data]);
      const added = allProfiles.find((p) => p.id === selectedUserId);
      toast("success", `${added?.full_name ?? added?.email ?? "User"} added to project.`);
      setAddMemberOpen(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    const name = member.profiles?.full_name ?? member.profiles?.email ?? "this member";
    if (!window.confirm(`Remove ${name} from the project?`)) return;

    const { error } = await removeProjectMember(member.id);
    if (error) {
      toast("error", error);
      return;
    }

    setLocalMembers((prev) => prev.filter((m) => m.id !== member.id));
    toast("success", `${name} removed from project.`);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError("");

    if (!taskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    if (localMembers.length === 0) {
      setTaskError("Add at least one project member before creating tasks.");
      return;
    }

    const assignedMember = taskForm.assigned_user_id
      ? localMembers.find((m) => m.user_id === taskForm.assigned_user_id)
      : localMembers[0];

    if (!assignedMember) {
      setTaskError("Select a member to assign this task to.");
      return;
    }

    setAddingTask(true);

    const assigneeName =
      assignedMember.profiles?.full_name ??
      assignedMember.profiles?.email ??
      assignedMember.user_id;

    const { data, error } = await createProjectTask({
      projectId: project.id,
      assignedUserId: assignedMember.user_id,
      assigneeName,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      priority: taskForm.priority,
      dueDate: taskForm.due_date || undefined,
    });

    setAddingTask(false);

    if (error) {
      setTaskError(error);
      return;
    }

    if (data) {
      setLocalTasks((prev) => [
        {
          id: data.id as string,
          title: data.title as string,
          status: "Open",
          priority: taskForm.priority,
          due_date: taskForm.due_date || null,
          assigned_to: assignedMember.user_id,
          assignee: assigneeName,
          created_by: currentUserId,
        },
        ...prev,
      ]);
      toast("success", "Task created.");
      setTaskForm({ title: "", description: "", priority: "Medium", due_date: "", assigned_user_id: "" });
      setAddTaskOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm shadow-black/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All projects
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{project.name}</h1>
            {project.description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-2xl border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground">
              {project.status ?? "Planned"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {project.start_date && (
            <div className="rounded-2xl border border-border bg-surface-muted p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatProjectDate(project.start_date)}</p>
            </div>
          )}
          {project.end_date && (
            <div className="rounded-2xl border border-border bg-surface-muted p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Due</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatProjectDate(project.end_date)}
              </p>
            </div>
          )}
          {project.budget != null && (
            <div className="rounded-2xl border border-border bg-surface-muted p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatMoney(project.budget)}</p>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-surface-muted p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tasks</p>
            <p className="mt-1 text-sm font-medium text-foreground">{localTasks.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Tasks panel */}
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm shadow-black/5">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Tasks ({localTasks.length})
              </h2>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setAddTaskOpen(true)}>
                <Plus className="h-4 w-4" /> Add task
              </Button>
            )}
          </div>

          {localTasks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">No tasks yet for this project.</p>
              {canManage && (
                <Button className="mt-3" size="sm" onClick={() => setAddTaskOpen(true)}>
                  Add first task
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/70 text-sm">
                <thead className="bg-surface-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.14em]">Title</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.14em]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.14em]">Priority</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.14em]">Assignee</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.14em]">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-surface">
                  {localTasks.map((task) => {
                    const assigneeMember = localMembers.find((m) => m.user_id === task.assigned_to);
                    const assigneeName =
                      assigneeMember?.profiles?.full_name ??
                      assigneeMember?.profiles?.email ??
                      task.assignee ??
                      "Unassigned";

                    return (
                      <tr key={task.id} className="transition hover:bg-surface-muted">
                        <td className="px-4 py-3">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {task.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{statusBadge(task.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{task.priority ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{assigneeName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.due_date ? formatProjectDate(task.due_date) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Members panel */}
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm shadow-black/5 self-start">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Members ({localMembers.length})
              </h2>
            </div>
            {canManage && (
              <button
                onClick={openAddMember}
                className="rounded-xl p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                title="Add member"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
          </div>

          {localMembers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No members yet.
              {canManage && (
                <button
                  onClick={openAddMember}
                  className="ml-1 text-foreground underline hover:no-underline"
                >
                  Add someone.
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {localMembers.map((member) => {
                const name = member.profiles?.full_name ?? member.profiles?.email ?? "Unknown";
                const email = member.profiles?.email ?? "";
                return (
                  <li key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      {email && email !== name && (
                        <p className="text-xs text-muted-foreground">{email}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{member.role_in_project}</p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="rounded-lg p-1 text-muted-foreground transition hover:bg-surface-muted hover:text-danger"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Add Member Modal */}
      <Modal
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        title="Add project member"
        description="Select a user from your team to add to this project."
      >
        <form className="space-y-4" onSubmit={handleAddMember}>
          {/* Search box */}
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => { setMemberSearch(e.target.value); setSelectedUserId(""); }}
            placeholder="Search by name or email…"
            className="w-full rounded-[16px] border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
          />

          {/* User list */}
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-border divide-y divide-border/70">
            {profilesLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading users…</p>
            ) : (() => {
              const alreadyIn = new Set(localMembers.map((m) => m.user_id));
              const q = memberSearch.toLowerCase().trim();
              const filtered = allProfiles.filter((p) => {
                if (alreadyIn.has(p.id)) return false;
                if (!q) return true;
                return (p.full_name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
              });
              if (filtered.length === 0) return (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
              );
              return filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedUserId(p.id); setMemberError(""); }}
                  className={`w-full px-4 py-3 text-left transition hover:bg-surface-muted ${selectedUserId === p.id ? "bg-surface-muted ring-2 ring-inset ring-accent" : ""}`}
                >
                  <p className="text-sm font-medium text-foreground">{p.full_name ?? p.email}</p>
                  {p.full_name && <p className="text-xs text-muted-foreground">{p.email}</p>}
                </button>
              ));
            })()}
          </div>

          {memberError && <p className="text-xs text-danger">{memberError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={addingMember || !selectedUserId}>
              {addingMember ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        open={addTaskOpen}
        onClose={() => { setAddTaskOpen(false); setTaskError(""); }}
        title="Add task"
        description="Create a task for this project and assign it to a team member."
      >
        <form className="space-y-4" onSubmit={handleAddTask}>
          <Input
            label="Task title"
            value={taskForm.title}
            onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
            required
            error={taskError}
          />

          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            <span>Description</span>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-[16px] border border-border bg-surface px-4 py-3 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              placeholder="What needs to be done?"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              <span>Assign to</span>
              <select
                value={taskForm.assigned_user_id}
                onChange={(e) => setTaskForm((f) => ({ ...f, assigned_user_id: e.target.value }))}
                className="h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Select member</option>
                {localMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              <span>Priority</span>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
                className="h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              >
                {TASK_PRIORITIES_LIST.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <Input
            label="Due date"
            type="date"
            value={taskForm.due_date}
            onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={addingTask}>
              {addingTask ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border px-4 py-2 text-sm shadow-lg ${t.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

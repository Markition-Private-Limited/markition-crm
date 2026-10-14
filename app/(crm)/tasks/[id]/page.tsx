"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Check, ClipboardList, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPut } from "@/lib/api";

type TaskClient = { id: string; company_id: string; companies: { id: string; name: string } | null };
type Task = {
  id: string; title: string; description: string | null; status: string;
  due_date: string | null; company_id: string | null; client_id: string | null;
  created_by: string | null; created_at: string; updated_at: string;
  companies: { id: string; name: string } | null;
  clients: TaskClient | null;
  task_assignees: Array<{ user_id: string; profiles: { full_name: string } | null }>;
};

const TASK_STATUSES = ["Open", "In Progress", "Done", "Cancelled"];

const STATUS_COLORS: Record<string, string> = {
  Open:          "bg-blue-100 text-blue-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Done:          "bg-green-100 text-green-700",
  Cancelled:     "bg-surface-muted text-muted-foreground",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [task, setTask] = React.useState<Task | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editStatus, setEditStatus] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const canEdit = appRole === "admin" || appRole === "project_manager";

  React.useEffect(() => {
    if (!token || !id) return;
    apiGet(`/api/tasks/${id}`, token)
      .then((data) => setTask(data as Task))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  const startEdit = () => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditStatus(task.status);
    setEditDueDate(task.due_date ? task.due_date.split("T")[0] : "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!token || !task || !editTitle.trim()) return;
    setSaving(true);
    try {
      await apiPut(`/api/tasks/${task.id}`, token, {
        title: editTitle, description: editDesc || null,
        status: editStatus, due_date: editDueDate || null,
      });
      const refreshed = await apiGet(`/api/tasks/${task.id}`, token);
      setTask(refreshed as Task);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  if (error)
    return <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!task)
    return <p className="text-muted-foreground">Task not found.</p>;

  const parentCompanyName = task.companies?.name ?? task.clients?.companies?.name ?? null;
  const parentIsClient = !!task.client_id;
  const parentId = task.company_id ?? task.client_id;
  const parentHref = parentIsClient
    ? `/clients/${task.client_id}`
    : task.company_id ? `/companies/${task.company_id}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => router.push("/tasks")} className="mt-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border-b border-accent bg-transparent text-2xl font-semibold text-foreground outline-none"
              />
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">{task.title}</h1>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[task.status] ?? "bg-surface-muted text-muted-foreground"}`}>
                {task.status}
              </span>
              {parentCompanyName && parentHref && (
                <Link href={parentHref} className="flex items-center gap-1 text-xs text-accent hover:underline">
                  {parentIsClient ? <Briefcase className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                  {parentCompanyName}
                </Link>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={saving || !editTitle.trim()}>
                  <Check className="h-4 w-4" />{saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={startEdit}>Edit</Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="space-y-6">
          <div className="rounded-[24px] border border-border bg-surface p-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">Task Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                {editing ? (
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="mt-1 h-9 rounded-[12px] border border-border bg-background px-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="mt-1 text-sm font-medium text-foreground">{task.status}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                {editing ? (
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="mt-1 h-9 rounded-[12px] border border-border bg-background px-2 text-sm focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Description</p>
              {editing ? (
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              ) : task.description ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No description.</p>
              )}
            </div>
            {task.task_assignees.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Assignees ({task.task_assignees.length})</p>
                <div className="flex flex-wrap gap-2">
                  {task.task_assignees.map((a) => (
                    <span key={a.user_id} className="rounded-full bg-surface-muted px-3 py-1 text-xs text-foreground">
                      {a.profiles?.full_name ?? a.user_id.slice(0, 8) + "…"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Log */}
        <div className="rounded-[24px] border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Activity Log</p>
          </div>
          <ActivityFeed entityType="task" entityId={task.id} />
        </div>
      </div>
    </div>
  );
}

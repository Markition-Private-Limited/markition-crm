"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Calendar, Users, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost } from "@/lib/api";

type TaskClient = { id: string; company_id: string; companies: { id: string; name: string } | null };
type Task = {
  id: string; title: string; description: string | null; status: string;
  due_date: string | null; created_at: string;
  company_id: string | null; client_id: string | null;
  companies: { id: string; name: string } | null;
  clients: TaskClient | null;
  task_assignees: Array<{ user_id: string }>;
};

type Company = { id: string; name: string };
type Client = { id: string; company_id: string; status: string; companies: { id: string; name: string } | null };
type CRMUser = { id: string; email: string; role: string | null };

const STATUS_COLORS: Record<string, string> = {
  Open:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "In Progress": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Done:        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Cancelled:   "bg-surface-muted text-muted-foreground",
};

const ALL_STATUSES = ["All", "Open", "In Progress", "Done", "Cancelled"];

export default function TasksPage() {
  const { token, appRole } = useSessionProvider();
  const router = useRouter();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [users, setUsers] = React.useState<CRMUser[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [showModal, setShowModal] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [parentType, setParentType] = React.useState<"company" | "client">("company");
  const [newCompanyId, setNewCompanyId] = React.useState("");
  const [newClientId, setNewClientId] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [newAssignees, setNewAssignees] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (appRole === "sales") router.replace("/dashboard");
  }, [appRole, router]);

  const canCreate = appRole === "admin" || appRole === "project_manager";

  React.useEffect(() => {
    if (!token || appRole === "sales") return;
    setLoading(true);
    const qs = statusFilter !== "All" ? `?status=${encodeURIComponent(statusFilter)}` : "";
    Promise.all([
      apiGet(`/api/tasks${qs}`, token),
      apiGet("/api/companies", token).catch(() => []),
      apiGet("/api/clients", token).catch(() => []),
      canCreate ? apiGet("/api/users", token).catch(() => []) : Promise.resolve([]),
    ])
      .then(([ts, cos, cls, us]) => {
        setTasks(ts as Task[]);
        setCompanies(cos as Company[]);
        setClients(cls as Client[]);
        setUsers(us as CRMUser[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter, canCreate, appRole]);

  const toggleAssignee = (uid: string) => {
    setNewAssignees((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const createTask = async () => {
    if (!token || !newTitle.trim()) return;
    const hasParent = parentType === "company" ? !!newCompanyId : !!newClientId;
    if (!hasParent) return;
    setCreating(true);
    try {
      const task = await apiPost("/api/tasks", token, {
        title: newTitle,
        description: newDesc || undefined,
        company_id: parentType === "company" ? newCompanyId : undefined,
        client_id: parentType === "client" ? newClientId : undefined,
        due_date: newDueDate || undefined,
        assignees: newAssignees.length > 0 ? newAssignees : undefined,
      });
      setTasks((prev) => [task as Task, ...prev]);
      setShowModal(false);
      setNewTitle(""); setNewDesc(""); setNewCompanyId(""); setNewClientId(""); setNewDueDate(""); setNewAssignees([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const getParentLabel = (t: Task) => {
    if (t.companies) return { label: t.companies.name, isClient: false };
    if (t.client_id) {
      const cl = clients.find((c) => c.id === t.client_id);
      return { label: cl?.companies?.name ? `${cl.companies.name}` : "Active Client", isClient: true };
    }
    return null;
  };

  const canSubmit = newTitle.trim() && (parentType === "company" ? !!newCompanyId : !!newClientId);

  if (appRole === "sales") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track and manage work items.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Task</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === s ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[20px] bg-surface-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No tasks found</p>
          {canCreate && (
            <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Task</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((t) => {
            const parent = getParentLabel(t);
            return (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5 transition hover:border-accent/40 hover:bg-surface-elevated"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <p className="font-semibold text-foreground leading-snug">{t.title}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[t.status] ?? "bg-surface-muted text-muted-foreground"}`}>
                    {t.status}
                  </span>
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                <div className="mt-auto flex w-full flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {parent && (
                    <span className="flex items-center gap-1 truncate">
                      {parent.isClient
                        ? <Briefcase className="h-3 w-3 shrink-0" />
                        : <Building2 className="h-3 w-3 shrink-0" />}
                      {parent.label}
                    </span>
                  )}
                  {t.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {t.task_assignees?.length > 0 && (
                    <span className="ml-auto flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {t.task_assignees.length}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={showModal} title="New Task" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Title <span className="text-danger">*</span></label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title…"
              className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Details…"
              rows={3}
              className="w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          {/* Parent toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Parent <span className="text-danger">*</span></label>
            <div className="flex gap-2">
              {(["company", "client"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setParentType(t)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${parentType === t ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
                >
                  {t === "company"
                    ? <><Building2 className="h-3.5 w-3.5" /> Company</>
                    : <><Briefcase className="h-3.5 w-3.5" /> Active Client</>}
                </button>
              ))}
            </div>
            {parentType === "company" ? (
              <select
                value={newCompanyId}
                onChange={(e) => setNewCompanyId(e.target.value)}
                className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">— Select company —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <select
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">— Select active client —</option>
                {clients.filter((c) => c.status === "active").map((c) => (
                  <option key={c.id} value={c.id}>{c.companies?.name ?? c.company_id}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Due Date</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          {users.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Assign to</label>
              <div className="max-h-36 divide-y divide-border overflow-y-auto rounded-[14px] border border-border">
                {users.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={newAssignees.includes(u.id)}
                      onChange={() => toggleAssignee(u.id)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{u.email}</p>
                      {u.role && <p className="text-xs capitalize text-muted-foreground">{u.role.replace(/_/g, " ")}</p>}
                    </div>
                  </label>
                ))}
              </div>
              {newAssignees.length > 0 && (
                <p className="text-xs text-muted-foreground">{newAssignees.length} assignee{newAssignees.length > 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={createTask} disabled={creating || !canSubmit}>
              {creating ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

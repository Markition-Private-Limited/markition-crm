"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Building2, Target, ClipboardList, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPatch } from "@/lib/api";

type Client = {
  id: string;
  company_id: string;
  source_prospect_id: string | null;
  status: string;
  created_at: string;
  companies: { id: string; name: string } | null;
  prospects: { id: string; name: string | null; notes: string | null } | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-surface-muted text-muted-foreground border-border",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [client, setClient] = React.useState<Client | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tasksLoading, setTasksLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [activityKey, setActivityKey] = React.useState(0);

  const canManage = appRole === "admin" || appRole === "project_manager";

  React.useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    apiGet(`/api/clients/${id}`, token)
      .then((data) => setClient(data as Client))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  // Load tasks for this client (admin/pm only — tasks are blocked for sales)
  React.useEffect(() => {
    if (!token || !id || !canManage) return;
    setTasksLoading(true);
    apiGet(`/api/tasks?client_id=${id}`, token)
      .then((data) => setTasks(data as Task[]))
      .catch(() => {})
      .finally(() => setTasksLoading(false));
  }, [token, id, canManage]);

  const toggleStatus = async () => {
    if (!token || !client) return;
    const next = client.status === "active" ? "inactive" : "active";
    setUpdatingStatus(true);
    try {
      const updated = await apiPatch(`/api/clients/${client.id}`, token, { status: next });
      setClient((prev) => prev ? { ...prev, status: (updated as Client).status } : prev);
      setActivityKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
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
  if (!client)
    return <p className="text-muted-foreground">Client not found.</p>;

  const companyName = client.companies?.name ?? "Unknown Company";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/active-clients")}
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{companyName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Active Client · Since {new Date(client.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_COLORS[client.status] ?? "bg-surface-muted text-muted-foreground border-border"}`}>
          {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
        </span>
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Info card */}
      <div className="rounded-[24px] border border-border bg-surface p-6 space-y-4">
        <p className="text-sm font-semibold text-foreground">Details</p>
        <div className="space-y-3">
          {/* Company link */}
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Link href={`/clients/${client.company_id}`} className="text-sm text-accent hover:underline">
              {companyName}
            </Link>
          </div>
          {/* Source prospect */}
          {client.source_prospect_id && (
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Source Prospect</p>
                <Link href={`/prospects/${client.source_prospect_id}`} className="text-sm text-accent hover:underline">
                  {client.prospects?.name ?? "View Prospect"}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Status toggle — admin/pm only */}
        {canManage && (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs text-muted-foreground">Status</p>
            <Button
              variant="secondary"
              disabled={updatingStatus}
              onClick={toggleStatus}
            >
              {updatingStatus
                ? "Updating…"
                : client.status === "active"
                ? "Mark as Inactive"
                : "Mark as Active"}
            </Button>
          </div>
        )}
      </div>

      {/* Tasks */}
      {canManage && (
        <div className="rounded-[24px] border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Tasks</p>
            </div>
            <Button size="sm" variant="secondary" href={`/tasks?client_id=${id}`}>
              View All
            </Button>
          </div>
          {tasksLoading ? (
            <div className="flex h-16 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckSquare className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tasks linked to this client.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 hover:border-accent/40 hover:bg-surface-elevated transition"
                >
                  <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(t.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity */}
      <div className="rounded-[20px] border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Activity</h2>
        <ActivityFeed key={activityKey} entityType="client" entityId={client.id} />
      </div>
    </div>
  );
}

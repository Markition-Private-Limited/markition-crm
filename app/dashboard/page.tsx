"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Target, Plus } from "lucide-react";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet } from "@/lib/api";

type Task = {
  id: string; title: string; status: string; due_date: string | null;
  companies: { id: string; name: string } | null;
  task_assignees: Array<{ user_id: string }>;
};

type Prospect = { id: string; status: string; created_at: string; companies: { name: string } | null };

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Done: "bg-green-100 text-green-700",
  Cancelled: "bg-surface-muted text-muted-foreground",
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { token, appRole, userId } = useSessionProvider();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token || !appRole) return;
    const fetches: Promise<unknown>[] = [
      apiGet("/api/tasks", token).catch(() => []),
      (appRole === "admin" || appRole === "sales") ? apiGet("/api/prospects", token).catch(() => []) : Promise.resolve([]),
    ];
    Promise.all(fetches)
      .then(([ts, ps]) => {
        setTasks(ts as Task[]);
        setProspects(ps as Prospect[]);
      })
      .finally(() => setLoading(false));
  }, [token, appRole]);

  const myTasks = tasks.filter((t) =>
    t.task_assignees?.some((a) => a.user_id === userId)
  );
  const openTasks = tasks.filter((t) => t.status === "Open" || t.status === "In Progress");
  const overdueTasks = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && !["Done", "Cancelled"].includes(t.status)
  );
  const newProspects = prospects.filter((p) => p.status === "first_contact");

  const displayTasks = appRole === "admin" || appRole === "project_manager"
    ? myTasks.length > 0 ? myTasks : openTasks.slice(0, 5)
    : myTasks.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-surface-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Markition CRM</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Dashboard</h1>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(appRole === "admin" || appRole === "project_manager") && (
          <>
            <StatCard label="Open Tasks" value={openTasks.length} sub="Across all assignees" />
            <StatCard label="My Tasks" value={myTasks.length} sub="Assigned to me" />
            <StatCard label="Overdue" value={overdueTasks.length} sub="Past due date" />
            <StatCard label="New Prospects" value={newProspects.length} sub="Awaiting contact" />
          </>
        )}
        {appRole === "sales" && (
          <>
            <StatCard label="My Tasks" value={myTasks.length} sub="Assigned to me" />
            <StatCard label="New Prospects" value={newProspects.length} sub="Awaiting contact" />
            <StatCard label="Total Prospects" value={prospects.length} sub="All time" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* My Tasks / Assigned Tasks */}
        <div className="rounded-[24px] border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {appRole === "admin" || appRole === "project_manager" ? "Tasks" : "My Tasks"}
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground">
                {appRole === "sales" ? "Assigned to me" : myTasks.length > 0 ? "Assigned to me" : "Open tasks"}
              </h2>
            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {displayTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-border py-10 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
              {(appRole === "admin" || appRole === "project_manager") && (
                <Link href="/tasks" className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  <Plus className="h-3 w-3" /> New Task
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {displayTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="flex items-center gap-4 rounded-[18px] border border-border bg-surface-muted/50 px-4 py-3 hover:border-accent/40 hover:bg-surface-elevated transition"
                >
                  <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        t.companies?.name,
                        t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : null,
                      ].filter(Boolean).join(" · ") || "No due date"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? "bg-surface-muted text-muted-foreground"}`}>
                    {t.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right panel — Leads for sales/admin, Quick actions for PM */}
        <div className="space-y-4">
          {(appRole === "admin" || appRole === "sales") && (
            <div className="rounded-[24px] border border-border bg-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Prospects</p>
                  <h2 className="mt-0.5 text-base font-semibold text-foreground">New Prospects</h2>
                </div>
                <Link href="/prospects" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {newProspects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No new prospects.</p>
              ) : (
                <div className="space-y-2">
                  {newProspects.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-[14px] border border-border px-3 py-2.5">
                      <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {p.companies?.name ?? "Unknown company"}
                      </p>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">new</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {appRole === "project_manager" && (
            <div className="rounded-[24px] border border-border bg-surface p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground mb-4">Quick Actions</p>
              <div className="space-y-2">
                <Link
                  href="/tasks"
                  className="flex items-center justify-between rounded-[18px] border border-border bg-surface-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-elevated transition"
                >
                  <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Task queue</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/companies"
                  className="flex items-center justify-between rounded-[18px] border border-border bg-surface-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-elevated transition"
                >
                  <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" /> Companies</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Search, FolderKanban, CalendarClock, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createProject, deleteProject, updateProject } from "@/src/modules/projects/project-client";
import {
  PROJECT_STATUSES,
  defaultProjectDraft,
  formatMoney,
  formatProjectDate,
  projectSchema,
  type Project,
  type ProjectFormValues,
} from "@/src/modules/projects/project-types";
import type { Company } from "@/src/modules/companies/company-types";

type Toast = { id: number; tone: "success" | "error"; message: string };

interface ProjectsModuleProps {
  initialProjects: Project[];
  companies: Company[];
}

export function ProjectsModule({ initialProjects, companies }: ProjectsModuleProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editProject, setEditProject] = React.useState<Project | null>(null);
  const [form, setForm] = React.useState<ProjectFormValues>(defaultProjectDraft());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const filteredProjects = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialProjects.filter((project) => {
      const matchesSearch = !term || String(project.name ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || String(project.status ?? "Planned") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialProjects, search, statusFilter]);

  const resetForm = React.useCallback(() => {
    setForm(defaultProjectDraft());
    setErrors({});
  }, []);

  const openCreateModal = () => {
    resetForm();
    setEditProject(null);
    setOpenCreate(true);
  };

  const openEditModal = (project: Project) => {
    setEditProject(project);
    setForm({
      name: project.name ?? "",
      company_id: project.company_id,
      status: (project.status as any) ?? "Planned",
      start_date: project.start_date,
      end_date: project.end_date,
      budget: project.budget,
      description: project.description,
    });
    setErrors({});
    setOpenCreate(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, value]) => [key, value?.[0] ?? ""])));
      return;
    }

    setIsSaving(true);
    try {
      if (editProject?.id) {
        const { error } = await updateProject(editProject.id, parsed.data);
        if (error) throw error;
        addToast("success", "Project updated successfully.");
      } else {
        const { error } = await createProject(parsed.data);
        if (error) throw error;
        addToast("success", "Project created successfully.");
      }
      setOpenCreate(false);
      resetForm();
      router.refresh();
    } catch (error) {
      addToast("error", (error as Error).message || "Unable to save project.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeProject = async (project: Project) => {
    const confirmed = window.confirm(`Delete project "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    const { error } = await deleteProject(project.id);
    if (error) {
      addToast("error", error.message || "Unable to delete project.");
      return;
    }
    addToast("success", "Project deleted.");
    router.refresh();
  };

  const statusCounts = React.useMemo(() => {
    return PROJECT_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = initialProjects.filter((item) => String(item.status ?? "Planned") === status).length;
      return acc;
    }, {});
  }, [initialProjects]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm shadow-black/5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Projects</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Delivery workspace</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Plan, monitor, and complete implementation projects from kickoff through closure.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {PROJECT_STATUSES.map((status) => (
              <div key={status} className="rounded-2xl border border-border bg-surface-muted p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{status}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{statusCounts[status] ?? 0}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm shadow-black/5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Actions</p>
          <div className="mt-4 space-y-3">
            <Button className="w-full justify-start" onClick={openCreateModal}>
              <Plus className="h-4 w-4" /> Add new project
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("In Progress")}>
              <FolderKanban className="h-4 w-4" /> Focus active projects
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => setStatusFilter("On Hold")}>
              <CalendarClock className="h-4 w-4" /> Review blocked projects
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm shadow-black/5 sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
            <Search className="h-4.5 w-4.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              type="search"
              placeholder="Search project name"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">All statuses</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm shadow-black/5">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Project ledger</h2>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-elevated text-muted-foreground">
              <FolderKanban className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">No projects match this view.</p>
            <Button className="mt-4" onClick={openCreateModal}>Add new project</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/70 text-left text-sm">
              <thead className="bg-surface-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Project</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Company</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Status</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Start</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Due</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.16em]">Budget</th>
                  <th className="px-4 py-3.5 text-right font-semibold uppercase tracking-[0.16em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 bg-surface">
                {filteredProjects.map((project) => {
                  const companyName = companies.find((c) => c.id === project.company_id)?.name ?? "—";
                  return (
                    <tr key={project.id} className="transition hover:bg-surface-muted">
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-foreground">{project.name}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{companyName}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{project.status || "Planned"}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{formatProjectDate(project.start_date)}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{formatProjectDate(project.end_date)}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{formatMoney(project.budget)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => router.push(`/projects/${project.id}`)}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openEditModal(project)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void removeProject(project)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit modal */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title={editProject ? "Edit project" : "Create project"}
        description="Capture core delivery details, dates, and ownership."
      >
        <form className="space-y-4" onSubmit={submit}>
          <Input
            label="Project name"
            value={form.name ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            error={errors.name}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex w-full flex-col gap-2 text-sm font-medium text-foreground">
              <span>Company</span>
              <select
                value={form.company_id ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value || undefined }))}
                className="h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>

            <label className="flex w-full flex-col gap-2 text-sm font-medium text-foreground">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectFormValues["status"] }))}
                className="h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="date"
              label="Start date"
              value={form.start_date ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value || undefined }))}
              error={errors.start_date}
            />
            <Input
              type="date"
              label="Due date"
              value={form.end_date ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value || undefined }))}
              error={errors.end_date}
            />
          </div>

          <Input
            type="number"
            label="Budget"
            value={form.budget ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value === "" ? undefined : Number(event.target.value) }))}
            error={errors.budget}
            min={0}
            step={0.01}
          />

          <label className="flex w-full flex-col gap-2 text-sm font-medium text-foreground">
            <span>Description</span>
            <textarea
              value={form.description ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || undefined }))}
              rows={4}
              className="w-full rounded-[16px] border border-border bg-surface px-4 py-3 text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20"
              placeholder="Scope, goals, and execution notes"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editProject ? "Update project" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-2 text-sm shadow-lg ${toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

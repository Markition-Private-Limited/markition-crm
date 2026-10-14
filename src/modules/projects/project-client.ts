import type { ProjectFormValues } from "./project-types";
import type { Project } from "./project-types";

function generateId() {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createProject(project: ProjectFormValues) {
  const data: Project = { id: generateId(), ...project, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  return { data, error: null };
}

export async function updateProject(id: string, project: Partial<ProjectFormValues>) {
  const data: Project = { id, name: project.name ?? "", ...project, updated_at: new Date().toISOString() };
  return { data, error: null };
}

export async function deleteProject(_id: string) {
  return { error: null as { message: string } | null };
}

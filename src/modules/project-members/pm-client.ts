import type { ProjectMember } from "./pm-types";
import { MOCK_USERS } from "@/src/mock/data";

function generateId() {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function addProjectMemberById(projectId: string, userId: string): Promise<{ data: ProjectMember | null; error: string | null }> {
  const user = MOCK_USERS.find((u) => u.id === userId);
  const data: ProjectMember = {
    id: generateId(),
    project_id: projectId,
    user_id: userId,
    role_in_project: "Member",
    created_at: new Date().toISOString(),
    profiles: user ? { id: user.id, email: user.email, full_name: user.name } : null,
  };
  return { data, error: null };
}

export async function addProjectMember(projectId: string, email: string): Promise<{ data: ProjectMember | null; error: string | null }> {
  const user = MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return { data: null, error: `No user found with email "${email}"` };
  return addProjectMemberById(projectId, user.id);
}

export async function removeProjectMember(_memberId: string): Promise<{ error: string | null }> {
  return { error: null };
}

export async function createProjectTask(payload: {
  projectId: string;
  assignedUserId: string;
  assigneeName: string;
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const data: Record<string, unknown> = {
    id: `task-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    project_id: payload.projectId,
    assigned_to: payload.assignedUserId,
    assignee: payload.assigneeName,
    priority: payload.priority,
    due_date: payload.dueDate ?? null,
    status: "Open",
    created_at: new Date().toISOString(),
  };
  return { data, error: null };
}

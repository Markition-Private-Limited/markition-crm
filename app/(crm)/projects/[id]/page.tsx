import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS } from "@/src/mock/data";
import type { ProjectMember } from "@/src/modules/project-members/pm-types";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const projectTasks = MOCK_TASKS.filter((t) => t.project_id === id).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status ?? null,
    priority: t.priority ?? null,
    due_date: t.due_date ?? null,
    assigned_to: null,
    assignee: t.assignee ?? null,
    created_by: null,
  }));

  const mockMembers: ProjectMember[] = MOCK_USERS.slice(0, 2).map((u, index) => ({
    id: `pm-mock-${index}`,
    project_id: id,
    user_id: u.id,
    role_in_project: index === 0 ? "Owner" : "Member",
    created_at: project.created_at ?? new Date().toISOString(),
    profiles: { id: u.id, email: u.email, full_name: u.name },
  }));

  return (
    <ProjectDetail
      project={project as any}
      members={mockMembers}
      tasks={projectTasks}
      currentUserId="u1"
      canManage={true}
    />
  );
}

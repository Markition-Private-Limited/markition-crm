import type { ProjectMember } from "./pm-types";
import { MOCK_USERS } from "@/src/mock/data";

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return MOCK_USERS.slice(0, 2).map((u, index) => ({
    id: `pm-${projectId}-${index}`,
    project_id: projectId,
    user_id: u.id,
    role_in_project: index === 0 ? "Owner" : "Member",
    created_at: new Date().toISOString(),
    profiles: { id: u.id, email: u.email, full_name: u.name },
  }));
}

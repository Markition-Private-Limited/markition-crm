export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: string;
  created_at: string;
  profiles?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
};

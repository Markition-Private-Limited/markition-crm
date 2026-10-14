import type { Project } from "@/src/modules/projects/project-types";
import type { Task } from "@/src/modules/tasks/task-types";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
};

export type ChangelogEntry = {
  id: string;
  actor: string;
  action: string;
  field?: string;
  from?: string;
  to?: string;
  note?: string;
  at: string;
};

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Ali Jawad", email: "ali@markition.com", role: "Admin" },
  { id: "u2", name: "Sara Ahmed", email: "sara@markition.com", role: "Manager" },
  { id: "u3", name: "Omar Sheikh", email: "omar@markition.com", role: "Developer" },
  { id: "u4", name: "Fatima Malik", email: "fatima@markition.com", role: "Designer" },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Markition CRM Rebuild",
    status: "In Progress",
    start_date: "2026-09-01",
    end_date: "2026-12-31",
    budget: 45000,
    description: "Full rebuild of the CRM platform with new schema and modern UI.",
    owner_id: "u1",
    created_at: "2026-09-01T08:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
  },
  {
    id: "proj-2",
    name: "Client Portal v2",
    status: "Planned",
    start_date: "2026-11-01",
    end_date: "2027-02-28",
    budget: 28000,
    description: "Next-generation client-facing portal with self-service features.",
    owner_id: "u2",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "proj-3",
    name: "Mobile App MVP",
    status: "On Hold",
    start_date: "2026-07-01",
    end_date: "2026-10-31",
    budget: 18000,
    description: "iOS/Android MVP app for field sales team.",
    owner_id: "u1",
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-09-15T14:00:00Z",
  },
  {
    id: "proj-4",
    name: "Analytics Dashboard",
    status: "Completed",
    start_date: "2026-05-01",
    end_date: "2026-08-31",
    budget: 12000,
    description: "Real-time reporting and analytics dashboard for leadership team.",
    owner_id: "u3",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-08-31T17:00:00Z",
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Design new DB schema for CRM",
    description: "Create an ERD covering entities: projects, tasks, users, clients, deals.",
    status: "In Progress",
    priority: "High",
    assignee: "Ali Jawad",
    project_id: "proj-1",
    due_date: "2026-10-15",
    estimated_hours: 8,
    actual_hours: 3,
    labels: ["schema", "backend"],
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
  },
  {
    id: "task-2",
    title: "Build authentication flow (new)",
    description: "Implement JWT-based auth with refresh tokens using the new backend.",
    status: "Planning",
    priority: "Critical",
    assignee: "Omar Sheikh",
    project_id: "proj-1",
    due_date: "2026-10-20",
    estimated_hours: 12,
    actual_hours: 0,
    labels: ["auth", "backend"],
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "task-3",
    title: "Create UI component library",
    description: "Build out the base component set: Button, Input, Modal, Table, Card, Badge.",
    status: "Completed",
    priority: "Medium",
    assignee: "Fatima Malik",
    project_id: "proj-1",
    due_date: "2026-09-30",
    estimated_hours: 20,
    actual_hours: 22,
    labels: ["ui", "frontend"],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-30T17:00:00Z",
  },
  {
    id: "task-4",
    title: "Write API specification docs",
    description: "Document all REST endpoints for the new backend API using OpenAPI 3.0.",
    status: "Open",
    priority: "Medium",
    assignee: "Sara Ahmed",
    project_id: "proj-1",
    due_date: "2026-10-25",
    estimated_hours: 6,
    actual_hours: 0,
    labels: ["docs"],
    created_at: "2026-10-02T08:00:00Z",
    updated_at: "2026-10-02T08:00:00Z",
  },
  {
    id: "task-5",
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for lint, test, build, and deploy to staging.",
    status: "In Progress",
    priority: "High",
    assignee: "Omar Sheikh",
    project_id: "proj-2",
    due_date: "2026-11-10",
    estimated_hours: 5,
    actual_hours: 2,
    labels: ["devops"],
    created_at: "2026-10-01T11:00:00Z",
    updated_at: "2026-10-02T09:00:00Z",
  },
  {
    id: "task-6",
    title: "Figma mockups for client portal",
    description: "Design wireframes and high-fidelity mockups for the client portal screens.",
    status: "Review",
    priority: "High",
    assignee: "Fatima Malik",
    project_id: "proj-2",
    due_date: "2026-11-05",
    estimated_hours: 16,
    actual_hours: 14,
    labels: ["design", "ui"],
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-02T11:00:00Z",
  },
];

export const MOCK_CHANGELOG: Record<string, ChangelogEntry[]> = {
  "task-1": [
    { id: "cl-1a", actor: "Ali Jawad", action: "created task", at: "2026-10-01T08:00:00Z" },
    { id: "cl-1b", actor: "Ali Jawad", action: "status changed", field: "status", from: "Open", to: "In Progress", at: "2026-10-02T10:00:00Z" },
  ],
  "task-2": [
    { id: "cl-2a", actor: "Sara Ahmed", action: "created task", at: "2026-10-01T09:00:00Z" },
    { id: "cl-2b", actor: "Ali Jawad", action: "assigned to", field: "assignee", to: "Omar Sheikh", at: "2026-10-01T09:30:00Z" },
  ],
  "task-3": [
    { id: "cl-3a", actor: "Fatima Malik", action: "created task", at: "2026-09-01T10:00:00Z" },
    { id: "cl-3b", actor: "Fatima Malik", action: "status changed", field: "status", from: "In Progress", to: "Completed", at: "2026-09-30T17:00:00Z" },
  ],
  "task-4": [
    { id: "cl-4a", actor: "Sara Ahmed", action: "created task", at: "2026-10-02T08:00:00Z" },
  ],
  "task-5": [
    { id: "cl-5a", actor: "Omar Sheikh", action: "created task", at: "2026-10-01T11:00:00Z" },
    { id: "cl-5b", actor: "Omar Sheikh", action: "status changed", field: "status", from: "Open", to: "In Progress", at: "2026-10-02T09:00:00Z" },
  ],
  "task-6": [
    { id: "cl-6a", actor: "Fatima Malik", action: "created task", at: "2026-10-01T12:00:00Z" },
    { id: "cl-6b", actor: "Ali Jawad", action: "status changed", field: "status", from: "In Progress", to: "Review", at: "2026-10-02T11:00:00Z" },
  ],
};

import { MOCK_PROJECTS } from "@/src/mock/data";
import type { Project } from "./project-types";

export async function getProjects(): Promise<Project[]> {
  return MOCK_PROJECTS;
}

export async function getProjectById(id: string): Promise<Project | null> {
  return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
}

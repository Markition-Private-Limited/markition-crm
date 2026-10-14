import { MOCK_TASKS } from "@/src/mock/data";
import type { Task } from "./task-types";

export async function getTasks(): Promise<Task[]> {
  return MOCK_TASKS;
}

export async function getTaskById(id: string): Promise<Task | null> {
  return MOCK_TASKS.find((t) => t.id === id) ?? null;
}

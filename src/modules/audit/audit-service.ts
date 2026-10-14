export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export async function getTaskAuditLogs(_taskId: string): Promise<AuditLogEntry[]> {
  return [];
}

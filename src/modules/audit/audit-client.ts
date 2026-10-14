export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export async function insertTaskAuditLog(
  _taskId: string,
  _action: "created" | "updated",
  _changes: AuditChanges | Record<string, unknown>,
): Promise<void> {}

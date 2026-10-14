import { adminClient } from '@/lib/supabase/admin'

export type EntityType = 'company' | 'prospect' | 'client' | 'task' | 'contact' | 'lead'

export async function logActivity({
  entityType,
  entityId,
  actorId,
  action,
  fieldName,
  oldValue,
  newValue,
}: {
  entityType: EntityType
  entityId: string
  actorId: string | null
  action: string
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
}) {
  await adminClient.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId ?? null,
    action,
    field_name: fieldName ?? null,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  })
}

export async function logFieldChanges({
  entityType,
  entityId,
  actorId,
  before,
  after,
}: {
  entityType: EntityType
  entityId: string
  actorId: string | null
  before: Record<string, unknown>
  after: Record<string, unknown>
}) {
  const entries = Object.keys(after)
    .filter((k) => after[k] !== undefined && String(after[k] ?? '') !== String(before[k] ?? ''))
    .map((k) => ({
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId ?? null,
      action: 'updated',
      field_name: k,
      old_value: before[k] != null ? String(before[k]) : null,
      new_value: after[k] != null ? String(after[k]) : null,
    }))

  if (entries.length > 0) {
    await adminClient.from('activity_log').insert(entries)
  }
}

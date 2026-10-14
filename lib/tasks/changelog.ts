import { adminClient } from '@/lib/supabase/admin'

export async function logTaskChange(
  taskId: string,
  actorId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null
) {
  await adminClient.from('task_changelog').insert({
    task_id: taskId,
    actor_id: actorId,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
  })
}

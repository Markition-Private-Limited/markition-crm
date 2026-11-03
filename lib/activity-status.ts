export type ActivityStatus = 'completed' | 'overdue' | 'due_today' | 'scheduled' | 'no_followup'

export function computeActivityStatus(
  follow_up_at: string | null,
  completed_at: string | null,
): ActivityStatus {
  if (completed_at) return 'completed'
  if (!follow_up_at) return 'no_followup'

  const now = new Date()
  const followUp = new Date(follow_up_at)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfFollowUp = new Date(followUp.getFullYear(), followUp.getMonth(), followUp.getDate())

  if (startOfFollowUp < startOfToday) return 'overdue'
  if (startOfFollowUp.getTime() === startOfToday.getTime()) return 'due_today'
  return 'scheduled'
}

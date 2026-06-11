export function computeWorkDurationMinutes(startedAt: string, completedAt: string): number {
  const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  return Math.round(diffMs / 60000)
}

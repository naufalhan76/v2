// Backward-compatible re-exports for types + runtime auth helpers.
// Types moved to src/types/reminders.ts; runtime helpers kept here.

export type {
  ActionResult,
  ReminderRuleInput,
  ReminderRulePatch,
  CustomerReminderFilters,
  ReminderRow,
  ReminderAcUnitRow,
  RawServicedAcUnitRow,
  ServicedAcStatusFilter,
  ServicedAcFilters,
  ServicedAcUnitRow,
  ReminderChannel,
  ReminderRule,
  CustomerReminder,
  ReminderStatus,
  ReminderTemplateContext,
} from '@/types/reminders'


// =============================================================================
// Auth helpers (runtime exports — not types)
// =============================================================================

export const WRITE_ROLES = ['SUPERADMIN', 'ADMIN'] as const
export const READ_ROLES = ['SUPERADMIN', 'ADMIN', 'FINANCE'] as const

export async function requireRoles(
  allowed: readonly string[]
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { getUser, getUserRole } = await import('@/lib/supabase-server')
  const user = await getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const role = await getUserRole()
  if (!role || !allowed.includes(role)) {
    return { ok: false, error: 'Forbidden: insufficient role' }
  }

  return { ok: true, userId: user.id }
}

export function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

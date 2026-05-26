// src/lib/order-status.ts
// Single source of truth for order status types, transitions, labels, and colors.
// UI layer speaks only these 8 canonical states.
// Legacy DB values are mapped at runtime via toCanonical().

/**
 * The 8 canonical order states for MSN ERP v2.
 */
export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED'

/**
 * Legacy status values that still exist in the database.
 * Will be removed in Phase 5 after data migration.
 */
export type LegacyOrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'EN ROUTE'
  | 'ARRIVED'
  | 'DONE'
  | 'CLOSED'
  | 'RESCHEDULE'
  | 'TO_WORKSHOP'
  | 'IN_WORKSHOP'
  | 'READY_TO_RETURN'
  | 'DELIVERED'

/**
 * All possible status values (canonical + legacy) that may appear at runtime.
 */
export type AnyOrderStatus = OrderStatus | LegacyOrderStatus

/**
 * Maps legacy DB status values to canonical states.
 * Canonical values map to themselves.
 */
const LEGACY_MAP: Record<string, OrderStatus> = {
  // Canonical (pass-through)
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  INVOICED: 'INVOICED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  // Legacy → Canonical
  NEW: 'PENDING',
  ACCEPTED: 'PENDING',
  'EN ROUTE': 'EN_ROUTE',
  ARRIVED: 'IN_PROGRESS',
  DONE: 'COMPLETED',
  CLOSED: 'PAID',
  RESCHEDULE: 'PENDING',
  TO_WORKSHOP: 'IN_PROGRESS',
  IN_WORKSHOP: 'IN_PROGRESS',
  READY_TO_RETURN: 'COMPLETED',
  DELIVERED: 'COMPLETED',
}

/**
 * Convert any status (legacy or canonical) to a canonical OrderStatus.
 * Returns 'PENDING' as fallback for unknown values.
 */
export function toCanonical(status: string | null | undefined): OrderStatus {
  if (!status) return 'PENDING'
  return LEGACY_MAP[status.toUpperCase()] ?? 'PENDING'
}

/**
 * User role for transition validation.
 */
export type TransitionRole = 'ADMIN' | 'SUPERADMIN' | 'TECHNICIAN' | 'FINANCE'

/**
 * Allowed next states per current state and role.
 */
const TRANSITION_RULES: Record<OrderStatus, Partial<Record<TransitionRole, OrderStatus[]>>> = {
  PENDING: {
    ADMIN: ['ASSIGNED', 'CANCELLED'],
    SUPERADMIN: ['ASSIGNED', 'CANCELLED'],
  },
  ASSIGNED: {
    ADMIN: ['PENDING', 'CANCELLED'],       // PENDING = reschedule
    SUPERADMIN: ['PENDING', 'CANCELLED'],
    TECHNICIAN: ['EN_ROUTE'],
  },
  EN_ROUTE: {
    ADMIN: ['PENDING', 'CANCELLED'],       // PENDING = reschedule
    SUPERADMIN: ['PENDING', 'CANCELLED'],
    TECHNICIAN: ['IN_PROGRESS'],
  },
  IN_PROGRESS: {
    ADMIN: ['CANCELLED'],
    SUPERADMIN: ['CANCELLED'],
    TECHNICIAN: ['COMPLETED'],
  },
  COMPLETED: {
    ADMIN: ['INVOICED'],
    SUPERADMIN: ['INVOICED'],
    FINANCE: ['INVOICED'],
  },
  INVOICED: {
    ADMIN: ['PAID', 'CANCELLED'],
    SUPERADMIN: ['PAID', 'CANCELLED'],
    FINANCE: ['PAID'],
  },
  PAID: {},       // Terminal state
  CANCELLED: {},  // Terminal state
}

/**
 * Get allowed next states for a given status and role.
 * Returns empty array for terminal states or unauthorized roles.
 */
export function getNextStates(status: string, role: TransitionRole): OrderStatus[] {
  const canonical = toCanonical(status)
  return TRANSITION_RULES[canonical]?.[role] ?? []
}

/**
 * Check if a transition is valid for the given role.
 */
export function canTransition(
  fromStatus: string,
  toStatus: OrderStatus,
  role: TransitionRole
): boolean {
  const allowed = getNextStates(fromStatus, role)
  return allowed.includes(toStatus)
}

/**
 * Human-readable labels for each status (Indonesian).
 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Menunggu',
  ASSIGNED: 'Ditugaskan',
  EN_ROUTE: 'Dalam Perjalanan',
  IN_PROGRESS: 'Sedang Dikerjakan',
  COMPLETED: 'Selesai',
  INVOICED: 'Ditagih',
  PAID: 'Lunas',
  CANCELLED: 'Dibatalkan',
}

/**
 * Get the human-readable label for a status.
 */
export function getStatusLabel(status: string): string {
  const canonical = toCanonical(status)
  return STATUS_LABELS[canonical]
}

/**
 * Color tokens for each status: Tailwind classes for bg, text, and border.
 * Used by StatusBadge component.
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  PENDING: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  ASSIGNED: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  EN_ROUTE: {
    bg: 'bg-indigo-100 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  IN_PROGRESS: {
    bg: 'bg-violet-100 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
  },
  COMPLETED: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  INVOICED: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  PAID: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  CANCELLED: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
}

/**
 * Check if a status is terminal (no further transitions possible).
 */
export function isTerminalState(status: string): boolean {
  const canonical = toCanonical(status)
  return canonical === 'PAID' || canonical === 'CANCELLED'
}

/**
 * All canonical statuses in workflow order.
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED',
]

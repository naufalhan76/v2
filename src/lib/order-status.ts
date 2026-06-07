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
    bg: 'bg-status-pending/12',
    text: 'text-status-pending',
    border: 'border-status-pending/30',
  },
  ASSIGNED: {
    bg: 'bg-status-assigned/12',
    text: 'text-status-assigned',
    border: 'border-status-assigned/30',
  },
  EN_ROUTE: {
    bg: 'bg-status-en-route/12',
    text: 'text-status-en-route',
    border: 'border-status-en-route/30',
  },
  IN_PROGRESS: {
    bg: 'bg-status-in-progress/12',
    text: 'text-status-in-progress',
    border: 'border-status-in-progress/30',
  },
  COMPLETED: {
    bg: 'bg-status-completed/12',
    text: 'text-status-completed',
    border: 'border-status-completed/30',
  },
  INVOICED: {
    bg: 'bg-status-invoiced/12',
    text: 'text-status-invoiced',
    border: 'border-status-invoiced/30',
  },
  PAID: {
    bg: 'bg-status-paid/12',
    text: 'text-status-paid',
    border: 'border-status-paid/30',
  },
  CANCELLED: {
    bg: 'bg-status-cancelled/12',
    text: 'text-status-cancelled',
    border: 'border-status-cancelled/30',
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

// src/lib/order-utils.ts
// Pure utility functions for order display logic.

import { toCanonical, isTerminalState, type OrderStatus } from '@/lib/order-status'

/**
 * Order shape we rely on across views. Only fields used by helpers.
 */
export interface OrderForDisplay {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  customers?: { customer_name?: string | null } | null
  order_items?: Array<{
    service_type?: string | null
    locations?: { full_address?: string | null; city?: string | null } | null
  }> | null
  order_technicians?: Array<{
    role?: string | null
    technicians?: { technician_name?: string | null } | null
  }> | null
}

export type Urgency = 'overdue' | 'today' | 'future' | 'terminal'

/**
 * Compute urgency level for color border on cards.
 * - terminal: PAID or CANCELLED (grey)
 * - overdue: scheduled date in the past
 * - today: scheduled date is today
 * - future: scheduled date is in the future or unknown
 */
export function getUrgencyLevel(order: OrderForDisplay): Urgency {
  if (isTerminalState(order.status ?? '')) return 'terminal'

  const dateStr = order.scheduled_visit_date ?? order.req_visit_date
  if (!dateStr) return 'future'

  const scheduled = new Date(dateStr)
  if (Number.isNaN(scheduled.getTime())) return 'future'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  scheduled.setHours(0, 0, 0, 0)

  const diff = scheduled.getTime() - today.getTime()
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'future'
}

/**
 * Tailwind border classes per urgency.
 */
export const URGENCY_BORDER: Record<Urgency, string> = {
  overdue: 'border-l-4 border-l-red-500',
  today: 'border-l-4 border-l-orange-500',
  future: 'border-l-4 border-l-green-500',
  terminal: 'border-l-4 border-l-muted-foreground/30',
}

/**
 * Board column ids — 6 columns. Note ACTIVE merges EN_ROUTE + IN_PROGRESS.
 */
export type BoardColumnId =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID'

export const BOARD_COLUMNS: Array<{
  id: BoardColumnId
  title: string
  /** Canonical states this column displays */
  states: OrderStatus[]
  /** Whether admin can drop cards into this column */
  acceptsDrops: boolean
}> = [
  { id: 'PENDING', title: 'Menunggu', states: ['PENDING'], acceptsDrops: true },
  { id: 'ASSIGNED', title: 'Ditugaskan', states: ['ASSIGNED'], acceptsDrops: true },
  { id: 'ACTIVE', title: 'Aktif', states: ['EN_ROUTE', 'IN_PROGRESS'], acceptsDrops: false },
  { id: 'COMPLETED', title: 'Selesai', states: ['COMPLETED'], acceptsDrops: true },
  { id: 'INVOICED', title: 'Ditagih', states: ['INVOICED'], acceptsDrops: true },
  { id: 'PAID', title: 'Lunas', states: ['PAID'], acceptsDrops: false },
]

export function getColumnForStatus(status: string | null): BoardColumnId | null {
  const canonical = toCanonical(status)
  if (canonical === 'CANCELLED') return null
  if (canonical === 'EN_ROUTE' || canonical === 'IN_PROGRESS') return 'ACTIVE'
  return canonical as BoardColumnId
}

/**
 * Group orders by board column id. Cancelled orders are excluded from the board.
 */
export function groupOrdersByStatus<T extends OrderForDisplay>(
  orders: T[]
): Record<BoardColumnId, T[]> {
  const groups: Record<BoardColumnId, T[]> = {
    PENDING: [],
    ASSIGNED: [],
    ACTIVE: [],
    COMPLETED: [],
    INVOICED: [],
    PAID: [],
  }
  for (const order of orders) {
    const col = getColumnForStatus(order.status)
    if (col) groups[col].push(order)
  }
  return groups
}

/**
 * Sort orders by urgency, then scheduled date asc.
 */
export function sortOrdersByUrgency<T extends OrderForDisplay>(orders: T[]): T[] {
  const rank: Record<Urgency, number> = { overdue: 0, today: 1, future: 2, terminal: 3 }
  return [...orders].sort((a, b) => {
    const ua = getUrgencyLevel(a)
    const ub = getUrgencyLevel(b)
    if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub]
    const da = a.scheduled_visit_date ?? a.req_visit_date ?? ''
    const db = b.scheduled_visit_date ?? b.req_visit_date ?? ''
    return da.localeCompare(db)
  })
}

/**
 * Filter spec used by both Board and List views.
 */
export interface OrderFilters {
  search?: string
  technicianId?: string
  serviceType?: string
  urgency?: Urgency
  dateFrom?: string
  dateTo?: string
  status?: string
}

/**
 * Apply client-side filters to an orders list.
 */
export function filterOrders<T extends OrderForDisplay>(orders: T[], filters: OrderFilters): T[] {
  return orders.filter((o) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const customerName = o.customers?.customer_name?.toLowerCase() ?? ''
      const orderId = o.order_id.toLowerCase()
      const address = o.order_items?.[0]?.locations?.full_address?.toLowerCase() ?? ''
      if (!customerName.includes(q) && !orderId.includes(q) && !address.includes(q)) {
        return false
      }
    }
    if (filters.technicianId) {
      const lead = o.order_technicians?.find((t) => t.role === 'lead')
      if (!lead || (lead as unknown as { technician_id?: string }).technician_id !== filters.technicianId) {
        return false
      }
    }
    if (filters.serviceType) {
      const types = o.order_items?.map((i) => i.service_type) ?? []
      if (!types.includes(filters.serviceType)) return false
    }
    if (filters.urgency) {
      if (getUrgencyLevel(o) !== filters.urgency) return false
    }
    if (filters.status) {
      if (toCanonical(o.status) !== toCanonical(filters.status)) return false
    }
    const dateStr = o.scheduled_visit_date ?? o.req_visit_date
    if (filters.dateFrom && dateStr) {
      if (dateStr < filters.dateFrom) return false
    }
    if (filters.dateTo && dateStr) {
      if (dateStr > filters.dateTo) return false
    }
    return true
  })
}

/**
 * Lookup helper: lead technician name from order_technicians.
 */
export function getLeadTechnicianName(order: OrderForDisplay): string | null {
  const lead = order.order_technicians?.find((t) => t.role === 'lead')
  return lead?.technicians?.technician_name ?? null
}

/**
 * Lookup helper: primary location address from order_items.
 */
export function getPrimaryLocation(order: OrderForDisplay): string | null {
  const first = order.order_items?.[0]?.locations
  if (!first) return null
  return [first.full_address, first.city].filter(Boolean).join(', ')
}

/**
 * Lookup helper: primary service type from order_items.
 */
export function getPrimaryServiceType(order: OrderForDisplay): string | null {
  return order.order_items?.[0]?.service_type ?? null
}

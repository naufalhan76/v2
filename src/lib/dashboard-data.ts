/**
 * Dashboard data types and adapters.
 * Maps server action return shapes to dashboard widget props.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DashboardKPI {
  label: string
  value: number
  delta: number
  status: 'positive' | 'negative' | 'neutral'
}

export interface OrderVolumeDataPoint {
  date: string
  formattedDate: string
  orders: number
  revenue: number
  estimatedRevenue: number
}

export interface StatusBreakdownItem {
  status: string
  count: number
  percentage: number
}

export interface TechnicianRankItem {
  id: string
  name: string
  completed: number
  total: number
  completionRate: number
}

export interface RecentOrderItem {
  order_id: string
  order_type: string
  status: string
  order_date: string
  created_at: string
  customer_name: string
  phone_number: string
}

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Adapt getDashboardKpis server action result to dashboard KPI widgets.
 */
export function adaptKpis(
  kpisResult: {
    success: boolean
    data?: {
      totalOrders: number
      pendingOrders: number
      completedOrders: number
      cancelledOrders: number
      totalCustomers: number
      totalTechnicians: number
      totalRevenue: number
      estimatedRevenue: number
      unpaidTransactions: number
      previous: {
        totalOrders: number
        pendingOrders: number
        completedOrders: number
        cancelledOrders: number
        totalCustomers: number
        totalTechnicians: number
        totalRevenue: number
        estimatedRevenue: number
        unpaidTransactions: number
      }
      windowDays: number
    }
    error?: string
  }
): DashboardKPI[] {
  if (!kpisResult.success || !kpisResult.data) {
    return []
  }

  const { data } = kpisResult
  const kpis: DashboardKPI[] = []

  // Total Orders
  const ordersDelta = data.previous.totalOrders > 0
    ? ((data.totalOrders - data.previous.totalOrders) / data.previous.totalOrders) * 100
    : 0
  kpis.push({
    label: 'Total Orders',
    value: data.totalOrders,
    delta: Math.round(ordersDelta),
    status: ordersDelta > 0 ? 'positive' : ordersDelta < 0 ? 'negative' : 'neutral',
  })

  // Pending Orders
  const pendingDelta = data.previous.pendingOrders > 0
    ? ((data.pendingOrders - data.previous.pendingOrders) / data.previous.pendingOrders) * 100
    : 0
  kpis.push({
    label: 'Pending Orders',
    value: data.pendingOrders,
    delta: Math.round(pendingDelta),
    status: pendingDelta < 0 ? 'positive' : pendingDelta > 0 ? 'negative' : 'neutral',
  })

  // Completed Orders
  const completedDelta = data.previous.completedOrders > 0
    ? ((data.completedOrders - data.previous.completedOrders) / data.previous.completedOrders) * 100
    : 0
  kpis.push({
    label: 'Completed Orders',
    value: data.completedOrders,
    delta: Math.round(completedDelta),
    status: completedDelta > 0 ? 'positive' : completedDelta < 0 ? 'negative' : 'neutral',
  })

  // Total Revenue
  const revenueDelta = data.previous.totalRevenue > 0
    ? ((data.totalRevenue - data.previous.totalRevenue) / data.previous.totalRevenue) * 100
    : 0
  kpis.push({
    label: 'Total Revenue',
    value: Math.round(data.totalRevenue),
    delta: Math.round(revenueDelta),
    status: revenueDelta > 0 ? 'positive' : revenueDelta < 0 ? 'negative' : 'neutral',
  })

  return kpis
}

/**
 * Adapt getChartData server action result to OrderVolumeDataPoint array.
 */
export function adaptChartData(
  chartResult: {
    success: boolean
    data?: Array<{
      date: string
      formattedDate: string
      orders: number
      revenue: number
      estimatedRevenue: number
    }>
    error?: string
  }
): OrderVolumeDataPoint[] {
  if (!chartResult.success || !chartResult.data) {
    return []
  }

  return chartResult.data.map((point) => ({
    date: point.date,
    formattedDate: point.formattedDate,
    orders: point.orders,
    revenue: point.revenue,
    estimatedRevenue: point.estimatedRevenue,
  }))
}

/**
 * Adapt getStatusBreakdown server action result to StatusBreakdownItem array.
 */
export function adaptStatusBreakdown(
  breakdownResult: {
    success: boolean
    data?: Record<string, number>
    error?: string
  }
): StatusBreakdownItem[] {
  if (!breakdownResult.success || !breakdownResult.data) {
    return []
  }

  const total = Object.values(breakdownResult.data).reduce((sum, count) => sum + count, 0)

  return Object.entries(breakdownResult.data).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }))
}

/**
 * Adapt getTopTechnicians server action result to TechnicianRankItem array.
 */
export function adaptTopTechnicians(
  techniciansResult: {
    success: boolean
    data?: Array<{
      id: string
      name: string
      completed: number
      total: number
    }>
    error?: string
  }
): TechnicianRankItem[] {
  if (!techniciansResult.success || !techniciansResult.data) {
    return []
  }

  return techniciansResult.data.map((tech) => ({
    id: tech.id,
    name: tech.name,
    completed: tech.completed,
    total: tech.total,
    completionRate: tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0,
  }))
}

/**
 * Adapt getRecentOrders server action result to RecentOrderItem array.
 */
export function adaptRecentOrders(
  ordersResult: {
    success: boolean
    data?: Array<{
      order_id: string
      order_type: string
      status: string
      order_date: string
      created_at: string
      customers?: {
        customer_name: string
        phone_number: string
      } | null
    }>
    error?: string
  }
): RecentOrderItem[] {
  if (!ordersResult.success || !ordersResult.data) {
    return []
  }

  return ordersResult.data.map((order) => ({
    order_id: order.order_id,
    order_type: order.order_type,
    status: order.status,
    order_date: order.order_date,
    created_at: order.created_at,
    customer_name: order.customers?.customer_name || 'Unknown',
    phone_number: order.customers?.phone_number || '—',
  }))
}

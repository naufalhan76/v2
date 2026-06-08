export const STATUS_GROUPS = {
  NON_ASSIGNED: ['PENDING'],
  ASSIGNED: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'],
  INVOICED: ['COMPLETED', 'INVOICED', 'PAID'],
} as const

export const ALL_ONGOING_STATUSES = [
  ...STATUS_GROUPS.NON_ASSIGNED,
  ...STATUS_GROUPS.ASSIGNED,
  ...STATUS_GROUPS.INVOICED,
] as const

type UnknownRecord = Record<string, unknown>

export interface LocationsSummary {
  text: string
  count: number
  locations: string[]
}

export interface ServicesGrouped {
  count: number
  types: Record<string, number>
}

export interface MonitoringOrderView extends Record<string, unknown> {
  order: unknown
  locationsSummary: LocationsSummary
  servicesInfo: ServicesGrouped
  uniqueServiceLabels: string[]
  leadTechnicianName: string | null
  helperTechnicianNames: string[]
}

export interface MonitoringOrderFilters {
  searchQuery: string
  statusFilter: string
  statusGroupFilter: string
  orderTypeFilter: string
  paymentStatusFilter: string
  multiLocationFilter: string
}

export function getLocationsSummary(orderItems: unknown[]): LocationsSummary {
  if (!orderItems || orderItems.length === 0) {
    return { text: 'No locations', count: 0, locations: [] }
  }

  const uniqueLocations = new Map<unknown, string>()
  for (const item of orderItems) {
    const it = item as UnknownRecord
    const location = it.locations as UnknownRecord | undefined
    const fullAddress = location?.full_address
    if (typeof fullAddress === 'string' && fullAddress) {
      uniqueLocations.set(it.location_id, fullAddress)
    }
  }

  const locations = Array.from(uniqueLocations.values())
  if (locations.length === 0) return { text: 'No locations', count: 0, locations: [] }
  if (locations.length === 1) return { text: locations[0], count: 1, locations }
  return {
    text: `${locations[0]} +${locations.length - 1}`,
    count: locations.length,
    locations,
  }
}

export function getServicesGrouped(orderItems: unknown[]): ServicesGrouped {
  if (!orderItems || orderItems.length === 0) return { count: 0, types: {} }

  const types: Record<string, number> = {}
  for (const item of orderItems) {
    const it = item as UnknownRecord
    const key = (it.msn_code as string) || (it.service_type as string)
    if (key) types[key] = (types[key] || 0) + 1
  }

  return { count: orderItems.length, types }
}

export function getServiceLabel(item: unknown): string {
  const it = item as UnknownRecord
  if (it.msn_code) {
    const parts = [it.msn_code as string]
    const unitTypes = it.unit_types as UnknownRecord | undefined
    const capacityRanges = it.capacity_ranges as UnknownRecord | undefined
    if (unitTypes?.name) parts.push(unitTypes.name as string)
    if (capacityRanges?.capacity_label) parts.push(capacityRanges.capacity_label as string)
    return parts.join(' • ')
  }
  return (it.service_type as string) || '-'
}

export function getUniqueServiceLabels(orderItems: unknown[]): string[] {
  if (!orderItems || orderItems.length === 0) return []

  const seen = new Set<string>()
  const labels: string[] = []
  for (const item of orderItems) {
    const label = getServiceLabel(item)
    if (!seen.has(label)) {
      seen.add(label)
      labels.push(label)
    }
  }

  return labels
}

export function summarizeTechnicians(orderTechnicians: unknown[] | undefined): {
  leadTechnicianName: string | null
  helperTechnicianNames: string[]
} {
  let leadTechnicianName: string | null = null
  const helperTechnicianNames: string[] = []

  for (const tech of orderTechnicians ?? []) {
    const t = tech as UnknownRecord
    const technician = t.technicians as UnknownRecord | undefined
    const technicianName = (technician?.technician_name as string | undefined) ?? null
    if (t.role === 'lead' && !leadTechnicianName) leadTechnicianName = technicianName
    if (t.role === 'helper' && technicianName) helperTechnicianNames.push(technicianName)
  }

  return { leadTechnicianName, helperTechnicianNames }
}

export function buildMonitoringOrderView(order: unknown): MonitoringOrderView {
  const o = order as UnknownRecord
  const orderItems = (o.order_items as unknown[]) || []
  const technicianSummary = summarizeTechnicians(o.order_technicians as unknown[] | undefined)

  return {
    ...(o as Record<string, unknown>),
    order,
    locationsSummary: getLocationsSummary(orderItems),
    servicesInfo: getServicesGrouped(orderItems),
    uniqueServiceLabels: getUniqueServiceLabels(orderItems),
    ...technicianSummary,
  }
}

export function getOrderDetailLocationGroups(orderItems: unknown[]): Array<{ location: unknown; items: unknown[] }> {
  const groupedByLocation = orderItems.reduce((acc: Record<string, { location: unknown; items: unknown[] }>, item: unknown) => {
    const it = item as UnknownRecord
    const locId = (it.location_id as string) || 'unknown'
    if (!acc[locId]) {
      acc[locId] = { location: it.locations, items: [] }
    }
    acc[locId].items.push(item)
    return acc
  }, {})

  return Object.values(groupedByLocation)
}

export function getOrderItemsEstimatedTotal(orderItems: unknown[]): number {
  return orderItems.reduce((sum: number, item: unknown) => {
    const it = item as UnknownRecord
    return sum + ((it.estimated_price as number) || 0) * ((it.quantity as number) || 1)
  }, 0)
}

export function selectMonitoringOrders(
  orders: unknown[],
  filters: MonitoringOrderFilters
): {
  ongoingOrderViews: MonitoringOrderView[]
  filteredOrderViews: MonitoringOrderView[]
  counts: { nonAssigned: number; assigned: number; invoiced: number }
} {
  const q = filters.searchQuery.trim().toLowerCase()
  const counts = { nonAssigned: 0, assigned: 0, invoiced: 0 }
  const ongoingOrderViews: MonitoringOrderView[] = []
  const filteredOrderViews: MonitoringOrderView[] = []

  for (const order of orders) {
    const o = order as UnknownRecord
    const status = o.status as string
    if (!ALL_ONGOING_STATUSES.includes(status as (typeof ALL_ONGOING_STATUSES)[number])) continue

    const view = buildMonitoringOrderView(order)
    ongoingOrderViews.push(view)

    if (STATUS_GROUPS.NON_ASSIGNED.includes(status as 'PENDING')) counts.nonAssigned++
    if (STATUS_GROUPS.ASSIGNED.includes(status as 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS')) counts.assigned++
    if (STATUS_GROUPS.INVOICED.includes(status as 'COMPLETED' | 'INVOICED' | 'PAID')) counts.invoiced++

    const customers = o.customers as UnknownRecord | undefined
    if (q) {
      const orderId = (o.order_id as string)?.toLowerCase() ?? ''
      const customerName = (customers?.customer_name as string)?.toLowerCase() ?? ''
      if (!orderId.includes(q) && !customerName.includes(q)) continue
    }

    if (
      filters.statusGroupFilter === 'NON_ASSIGNED' &&
      !STATUS_GROUPS.NON_ASSIGNED.includes(status as 'PENDING')
    ) continue
    if (
      filters.statusGroupFilter === 'ASSIGNED' &&
      !STATUS_GROUPS.ASSIGNED.includes(status as 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS')
    ) continue
    if (
      filters.statusGroupFilter === 'INVOICED' &&
      !STATUS_GROUPS.INVOICED.includes(status as 'COMPLETED' | 'INVOICED' | 'PAID')
    ) continue
    if (filters.statusFilter !== 'ALL' && status !== filters.statusFilter) continue
    if (filters.orderTypeFilter !== 'ALL' && o.order_type !== filters.orderTypeFilter) continue
    if (filters.paymentStatusFilter !== 'ALL' && o.payment_status !== filters.paymentStatusFilter) continue
    if (filters.multiLocationFilter === 'SINGLE' && view.locationsSummary.count !== 1) continue
    if (filters.multiLocationFilter === 'MULTI' && view.locationsSummary.count <= 1) continue

    filteredOrderViews.push(view)
  }

  return { ongoingOrderViews, filteredOrderViews, counts }
}

import { describe, expect, it } from 'vitest'

import {
  getLocationsSummary,
  getOrderDetailLocationGroups,
  getOrderItemsEstimatedTotal,
  getServicesGrouped,
  getUniqueServiceLabels,
  selectMonitoringOrders,
} from './monitoring-ongoing-utils'

const orderItems = [
  {
    location_id: 'loc-1',
    locations: { full_address: 'Jl. Merdeka' },
    msn_code: 'MSN-1',
    unit_types: { name: 'Split' },
    capacity_ranges: { capacity_label: '1 PK' },
  },
  {
    location_id: 'loc-1',
    locations: { full_address: 'Jl. Merdeka' },
    msn_code: 'MSN-1',
    unit_types: { name: 'Split' },
    capacity_ranges: { capacity_label: '1 PK' },
  },
  {
    location_id: 'loc-2',
    locations: { full_address: 'Jl. Sudirman' },
    service_type: 'CLEANING',
  },
]

describe('monitoring ongoing selectors', () => {
  it('summarizes locations and services with existing labels', () => {
    expect(getLocationsSummary(orderItems)).toEqual({
      text: 'Jl. Merdeka +1',
      count: 2,
      locations: ['Jl. Merdeka', 'Jl. Sudirman'],
    })
    expect(getServicesGrouped(orderItems)).toEqual({
      count: 3,
      types: { 'MSN-1': 2, CLEANING: 1 },
    })
    expect(getUniqueServiceLabels(orderItems)).toEqual([
      'MSN-1 • Split • 1 PK',
      'CLEANING',
    ])
  })

  it('filters ongoing orders and returns status counts in one pass', () => {
    const orders = [
      {
        order_id: 'ORD-1',
        status: 'PENDING',
        order_type: 'CLEANING',
        payment_status: 'PENDING',
        customers: { customer_name: 'PT Sejuk' },
        order_items: [orderItems[0]],
      },
      {
        order_id: 'ORD-2',
        status: 'IN_PROGRESS',
        order_type: 'REPAIR',
        payment_status: 'PARTIAL',
        customers: { customer_name: 'CV Dingin' },
        order_items: orderItems,
        order_technicians: [
          { role: 'lead', technicians: { technician_name: 'Budi' } },
          { role: 'helper', technicians: { technician_name: 'Sari' } },
        ],
      },
      { order_id: 'ORD-3', status: 'CANCELLED', customers: { customer_name: 'Hidden' } },
      { order_id: 'ORD-4', status: 'PAID', customers: { customer_name: 'PT Lunas' }, order_items: [] },
    ]

    const selected = selectMonitoringOrders(orders, {
      searchQuery: 'dingin',
      statusFilter: 'ALL',
      statusGroupFilter: 'ASSIGNED',
      orderTypeFilter: 'REPAIR',
      paymentStatusFilter: 'PARTIAL',
      multiLocationFilter: 'MULTI',
    })

    expect(selected.counts).toEqual({ nonAssigned: 1, assigned: 1, invoiced: 1 })
    expect(selected.ongoingOrderViews).toHaveLength(3)
    expect(selected.filteredOrderViews).toHaveLength(1)
    expect(selected.filteredOrderViews[0]).toMatchObject({
      leadTechnicianName: 'Budi',
      helperTechnicianNames: ['Sari'],
      locationsSummary: { count: 2 },
    })
  })

  it('summarizes order detail locations and estimated total for the modal', () => {
    const detailItems = [
      { location_id: 'loc-1', locations: { full_address: 'Jl. Merdeka' }, estimated_price: 100000, quantity: 2 },
      { location_id: 'loc-1', locations: { full_address: 'Jl. Merdeka' }, estimated_price: 50000, quantity: 1 },
      { location_id: 'loc-2', locations: { full_address: 'Jl. Sudirman' }, estimated_price: 75000 },
    ]

    expect(getOrderDetailLocationGroups(detailItems)).toEqual([
      { location: { full_address: 'Jl. Merdeka' }, items: [detailItems[0], detailItems[1]] },
      { location: { full_address: 'Jl. Sudirman' }, items: [detailItems[2]] },
    ])
    expect(getOrderItemsEstimatedTotal(detailItems)).toBe(325000)
  })
})

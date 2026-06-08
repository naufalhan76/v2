import { describe, expect, it } from 'vitest'
import {
  BOARD_COLUMNS,
  groupAndSortOrdersByStatus,
  type OrderForDisplay,
} from './order-utils'

describe('order board utilities', () => {
  it('groups canonical statuses into board columns, excludes cancelled, and sorts by urgency/date', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const isoDate = (date: Date) => date.toISOString().split('T')[0]
    const orders: OrderForDisplay[] = [
      { order_id: 'future-pending', status: 'PENDING', scheduled_visit_date: isoDate(tomorrow) },
      { order_id: 'overdue-pending', status: 'PENDING', scheduled_visit_date: isoDate(yesterday) },
      { order_id: 'today-pending', status: 'PENDING', scheduled_visit_date: isoDate(today) },
      { order_id: 'en-route', status: 'EN_ROUTE', scheduled_visit_date: isoDate(today) },
      { order_id: 'in-progress', status: 'IN_PROGRESS', scheduled_visit_date: isoDate(today) },
      { order_id: 'cancelled', status: 'CANCELLED', scheduled_visit_date: isoDate(today) },
      { order_id: 'paid', status: 'PAID', scheduled_visit_date: isoDate(yesterday) },
    ]

    const grouped = groupAndSortOrdersByStatus(orders)

    expect(Object.keys(grouped)).toEqual(BOARD_COLUMNS.map((column) => column.id))
    expect(grouped.PENDING.map((order) => order.order_id)).toEqual([
      'overdue-pending',
      'today-pending',
      'future-pending',
    ])
    expect(grouped.ACTIVE.map((order) => order.order_id)).toEqual(['en-route', 'in-progress'])
    expect(grouped.PAID.map((order) => order.order_id)).toEqual(['paid'])
    expect(Object.values(grouped).flat().map((order) => order.order_id)).not.toContain('cancelled')
  })
})

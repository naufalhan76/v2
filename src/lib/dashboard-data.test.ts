import { describe, it, expect } from 'vitest'
import {
  adaptKpis,
  adaptChartData,
  adaptStatusBreakdown,
  adaptTopTechnicians,
  adaptRecentOrders,
  type DashboardKPI,
  type OrderVolumeDataPoint,
  type StatusBreakdownItem,
  type TechnicianRankItem,
  type RecentOrderItem,
} from './dashboard-data'

describe('Dashboard Data Adapters', () => {
  describe('adaptKpis', () => {
    it('returns empty array on failure', () => {
      const result = adaptKpis({ success: false, error: 'Failed' })
      expect(result).toEqual([])
    })

    it('returns empty array when data is missing', () => {
      const result = adaptKpis({ success: true })
      expect(result).toEqual([])
    })

    it('adapts KPI data with positive delta', () => {
      const result = adaptKpis({
        success: true,
        data: {
          totalOrders: 100,
          pendingOrders: 20,
          completedOrders: 70,
          cancelledOrders: 10,
          totalCustomers: 50,
          totalTechnicians: 5,
          totalRevenue: 50000000,
          estimatedRevenue: 55000000,
          unpaidTransactions: 5,
          previous: {
            totalOrders: 80,
            pendingOrders: 25,
            completedOrders: 50,
            cancelledOrders: 5,
            totalCustomers: 45,
            totalTechnicians: 5,
            totalRevenue: 40000000,
            estimatedRevenue: 45000000,
            unpaidTransactions: 8,
          },
          windowDays: 30,
        },
      })

      expect(result).toHaveLength(4)
      expect(result[0]).toMatchObject({
        label: 'Total Orders',
        value: 100,
        delta: 25,
        status: 'positive',
      })
      expect(result[3]).toMatchObject({
        label: 'Total Revenue',
        value: 50000000,
        delta: 25,
        status: 'positive',
      })
    })

    it('adapts KPI data with negative delta', () => {
      const result = adaptKpis({
        success: true,
        data: {
          totalOrders: 60,
          pendingOrders: 15,
          completedOrders: 40,
          cancelledOrders: 5,
          totalCustomers: 50,
          totalTechnicians: 5,
          totalRevenue: 30000000,
          estimatedRevenue: 35000000,
          unpaidTransactions: 3,
          previous: {
            totalOrders: 80,
            pendingOrders: 25,
            completedOrders: 50,
            cancelledOrders: 5,
            totalCustomers: 45,
            totalTechnicians: 5,
            totalRevenue: 40000000,
            estimatedRevenue: 45000000,
            unpaidTransactions: 8,
          },
          windowDays: 30,
        },
      })

      expect(result[0]).toMatchObject({
        label: 'Total Orders',
        value: 60,
        delta: -25,
        status: 'negative',
      })
    })

    it('handles pending orders delta as negative=positive', () => {
      const result = adaptKpis({
        success: true,
        data: {
          totalOrders: 100,
          pendingOrders: 10,
          completedOrders: 70,
          cancelledOrders: 10,
          totalCustomers: 50,
          totalTechnicians: 5,
          totalRevenue: 50000000,
          estimatedRevenue: 55000000,
          unpaidTransactions: 5,
          previous: {
            totalOrders: 80,
            pendingOrders: 20,
            completedOrders: 50,
            cancelledOrders: 5,
            totalCustomers: 45,
            totalTechnicians: 5,
            totalRevenue: 40000000,
            estimatedRevenue: 45000000,
            unpaidTransactions: 8,
          },
          windowDays: 30,
        },
      })

      expect(result[1]).toMatchObject({
        label: 'Pending Orders',
        delta: -50,
        status: 'positive',
      })
    })
  })

  describe('adaptChartData', () => {
    it('returns empty array on failure', () => {
      const result = adaptChartData({ success: false, error: 'Failed' })
      expect(result).toEqual([])
    })

    it('adapts chart data points', () => {
      const result = adaptChartData({
        success: true,
        data: [
          {
            date: '2026-05-01',
            formattedDate: '01 May',
            orders: 5,
            revenue: 10000000,
            estimatedRevenue: 12000000,
          },
          {
            date: '2026-05-02',
            formattedDate: '02 May',
            orders: 8,
            revenue: 15000000,
            estimatedRevenue: 18000000,
          },
        ],
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        date: '2026-05-01',
        formattedDate: '01 May',
        orders: 5,
        revenue: 10000000,
        estimatedRevenue: 12000000,
      })
    })
  })

  describe('adaptStatusBreakdown', () => {
    it('returns empty array on failure', () => {
      const result = adaptStatusBreakdown({ success: false, error: 'Failed' })
      expect(result).toEqual([])
    })

    it('adapts status breakdown with percentages', () => {
      const result = adaptStatusBreakdown({
        success: true,
        data: {
          PENDING: 20,
          ASSIGNED: 30,
          COMPLETED: 50,
        },
      })

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        status: 'PENDING',
        count: 20,
        percentage: 20,
      })
      expect(result[1]).toMatchObject({
        status: 'ASSIGNED',
        count: 30,
        percentage: 30,
      })
      expect(result[2]).toMatchObject({
        status: 'COMPLETED',
        count: 50,
        percentage: 50,
      })
    })

    it('handles empty breakdown', () => {
      const result = adaptStatusBreakdown({
        success: true,
        data: {},
      })

      expect(result).toEqual([])
    })
  })

  describe('adaptTopTechnicians', () => {
    it('returns empty array on failure', () => {
      const result = adaptTopTechnicians({ success: false, error: 'Failed' })
      expect(result).toEqual([])
    })

    it('adapts technician data with completion rates', () => {
      const result = adaptTopTechnicians({
        success: true,
        data: [
          { id: 'tech1', name: 'Budi', completed: 8, total: 10 },
          { id: 'tech2', name: 'Andi', completed: 15, total: 20 },
        ],
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'tech1',
        name: 'Budi',
        completed: 8,
        total: 10,
        completionRate: 80,
      })
      expect(result[1]).toMatchObject({
        id: 'tech2',
        name: 'Andi',
        completed: 15,
        total: 20,
        completionRate: 75,
      })
    })

    it('handles zero total orders', () => {
      const result = adaptTopTechnicians({
        success: true,
        data: [{ id: 'tech1', name: 'Budi', completed: 0, total: 0 }],
      })

      expect(result[0]).toMatchObject({
        completionRate: 0,
      })
    })
  })

  describe('adaptRecentOrders', () => {
    it('returns empty array on failure', () => {
      const result = adaptRecentOrders({ success: false, error: 'Failed' })
      expect(result).toEqual([])
    })

    it('adapts recent orders with customer data', () => {
      const result = adaptRecentOrders({
        success: true,
        data: [
          {
            order_id: 'ORD001',
            order_type: 'MAINTENANCE',
            status: 'COMPLETED',
            order_date: '2026-05-01',
            created_at: '2026-05-01T10:00:00Z',
            customers: {
              customer_name: 'PT Maju Jaya',
              phone_number: '081234567890',
            },
          },
        ],
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        order_id: 'ORD001',
        order_type: 'MAINTENANCE',
        status: 'COMPLETED',
        order_date: '2026-05-01',
        created_at: '2026-05-01T10:00:00Z',
        customer_name: 'PT Maju Jaya',
        phone_number: '081234567890',
      })
    })

    it('handles missing customer data', () => {
      const result = adaptRecentOrders({
        success: true,
        data: [
          {
            order_id: 'ORD001',
            order_type: 'MAINTENANCE',
            status: 'COMPLETED',
            order_date: '2026-05-01',
            created_at: '2026-05-01T10:00:00Z',
            customers: null,
          },
        ],
      })

      expect(result[0]).toMatchObject({
        customer_name: 'Unknown',
        phone_number: '—',
      })
    })
  })
})

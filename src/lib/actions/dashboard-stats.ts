'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const DAY_MS = 24 * 60 * 60 * 1000

function getDateWindow(startDate?: string, endDate?: string) {
  const defaultEndDate = new Date().toISOString().split('T')[0]
  const defaultStartDate = new Date(Date.now() - 30 * DAY_MS).toISOString().split('T')[0]

  const currentStart = startDate || defaultStartDate
  const currentEnd = endDate || defaultEndDate
  const currentStartTime = new Date(`${currentStart}T00:00:00.000Z`).getTime()
  const currentEndTime = new Date(`${currentEnd}T00:00:00.000Z`).getTime()
  const windowDays = Math.max(1, Math.floor((currentEndTime - currentStartTime) / DAY_MS) + 1)
  const previousEndDate = new Date(currentStartTime - DAY_MS)
  const previousStartDate = new Date(previousEndDate.getTime() - (windowDays - 1) * DAY_MS)

  return {
    currentStart,
    currentEnd,
    previousStart: previousStartDate.toISOString().split('T')[0],
    previousEnd: previousEndDate.toISOString().split('T')[0],
    windowDays,
  }
}


export async function getDashboardKpis(startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient()
    const { currentStart, currentEnd, previousStart, previousEnd, windowDays } = getDateWindow(startDate, endDate)

    const [
      totalOrdersResult,
      pendingOrdersResult,
      completedOrdersResult,
      cancelledOrdersResult,
      customersResult,
      techniciansResult,
      paymentsResult,
      unpaidResult,
      estimatedRevenueResult,
      previousTotalOrdersResult,
      previousPendingOrdersResult,
      previousCompletedOrdersResult,
      previousCancelledOrdersResult,
      previousPaymentsResult,
      previousUnpaidResult,
      previousEstimatedRevenueResult,
    ] = await Promise.all([
      // Total orders count (with date range)
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', currentStart)
        .lte('order_date', currentEnd),
      
      // Pending orders count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'])
        .gte('order_date', currentStart)
        .lte('order_date', currentEnd),
      
      // Completed orders count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['COMPLETED', 'INVOICED', 'PAID'])
        .gte('order_date', currentStart)
        .lte('order_date', currentEnd),
      
      // Cancelled orders count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'CANCELLED')
        .gte('order_date', currentStart)
        .lte('order_date', currentEnd),
      
      // Total customers
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true }),
      
      // Total technicians
      supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true }),
      
      // Payments data (for revenue calculation)
      supabase
        .from('payment_records')
        .select('amount')
        .gte('payment_date', currentStart)
        .lte('payment_date', currentEnd),
      
      // Unpaid transactions count (invoices flagged unpaid)
      supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'UNPAID')
        .gte('invoice_date', currentStart)
        .lte('invoice_date', currentEnd),

      // Estimated revenue (sum of order_items prices for orders in range, exclude cancelled)
      supabase
        .from('order_items')
        .select('estimated_price, actual_price, orders!inner(order_date, status)')
        .gte('orders.order_date', currentStart)
        .lte('orders.order_date', currentEnd)
        .neq('orders.status', 'CANCELLED'),

      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', previousStart)
        .lte('order_date', previousEnd),

      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'])
        .gte('order_date', previousStart)
        .lte('order_date', previousEnd),

      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['COMPLETED', 'INVOICED', 'PAID'])
        .gte('order_date', previousStart)
        .lte('order_date', previousEnd),

      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'CANCELLED')
        .gte('order_date', previousStart)
        .lte('order_date', previousEnd),

      supabase
        .from('payment_records')
        .select('amount')
        .gte('payment_date', previousStart)
        .lte('payment_date', previousEnd),

      supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'UNPAID')
        .gte('invoice_date', previousStart)
        .lte('invoice_date', previousEnd),

      // Previous estimated revenue
      supabase
        .from('order_items')
        .select('estimated_price, actual_price, orders!inner(order_date, status)')
        .gte('orders.order_date', previousStart)
        .lte('orders.order_date', previousEnd)
        .neq('orders.status', 'CANCELLED'),
    ])
    
    
    // Check for errors in any query
    if (totalOrdersResult.error) throw totalOrdersResult.error
    if (pendingOrdersResult.error) throw pendingOrdersResult.error
    if (completedOrdersResult.error) throw completedOrdersResult.error
    if (cancelledOrdersResult.error) throw cancelledOrdersResult.error
    if (previousTotalOrdersResult.error) throw previousTotalOrdersResult.error
    if (previousPendingOrdersResult.error) throw previousPendingOrdersResult.error
    if (previousCompletedOrdersResult.error) throw previousCompletedOrdersResult.error
    if (previousCancelledOrdersResult.error) throw previousCancelledOrdersResult.error
    if (customersResult.error) throw customersResult.error
    if (techniciansResult.error) throw techniciansResult.error
    
    // Payments and unpaid are non-critical, log errors but don't throw
    if (paymentsResult.error) {
      logger.error('Payments query error:', paymentsResult.error)
    }
    if (unpaidResult.error) {
      logger.error('Unpaid query error:', unpaidResult.error)
    }
    if (previousPaymentsResult.error) {
      logger.error('Previous payments query error:', previousPaymentsResult.error)
    }
    if (previousUnpaidResult.error) {
      logger.error('Previous unpaid query error:', previousUnpaidResult.error)
    }
    if (estimatedRevenueResult.error) {
      logger.error('Estimated revenue query error:', estimatedRevenueResult.error)
    }
    if (previousEstimatedRevenueResult.error) {
      logger.error('Previous estimated revenue query error:', previousEstimatedRevenueResult.error)
    }
    
    // Calculate actual revenue (cash collected via payment_records)
    const totalRevenue = paymentsResult.data?.reduce((sum: number, payment: { amount?: number }) => {
      const paymentAmount = Number(payment.amount) || 0
      return sum + paymentAmount
    }, 0) || 0

    const previousTotalRevenue = previousPaymentsResult.data?.reduce((sum: number, payment: { amount?: number }) => {
      const paymentAmount = Number(payment.amount) || 0
      return sum + paymentAmount
    }, 0) || 0

    // Calculate estimated revenue (actual_price ?? estimated_price from order_items)
    const sumOrderItems = (rows: Array<{ estimated_price?: number | null; actual_price?: number | null }> | null | undefined) =>
      rows?.reduce((sum, row) => {
        const price = row.actual_price ?? row.estimated_price ?? 0
        return sum + (Number(price) || 0)
      }, 0) || 0

    const estimatedRevenue = sumOrderItems(estimatedRevenueResult.data as Array<{ estimated_price?: number | null; actual_price?: number | null }>)
    const previousEstimatedRevenue = sumOrderItems(previousEstimatedRevenueResult.data as Array<{ estimated_price?: number | null; actual_price?: number | null }>)

    const previous = {
      totalOrders: previousTotalOrdersResult.count || 0,
      pendingOrders: previousPendingOrdersResult.count || 0,
      completedOrders: previousCompletedOrdersResult.count || 0,
      cancelledOrders: previousCancelledOrdersResult.count || 0,
      totalCustomers: customersResult.count || 0,
      totalTechnicians: techniciansResult.count || 0,
      totalRevenue: previousTotalRevenue,
      estimatedRevenue: previousEstimatedRevenue,
      unpaidTransactions: previousUnpaidResult.count || 0,
    }
    
    const result = {
      totalOrders: totalOrdersResult.count || 0,
      pendingOrders: pendingOrdersResult.count || 0,
      completedOrders: completedOrdersResult.count || 0,
      cancelledOrders: cancelledOrdersResult.count || 0,
      totalCustomers: customersResult.count || 0,
      totalTechnicians: techniciansResult.count || 0,
      totalRevenue,
      estimatedRevenue,
      unpaidTransactions: unpaidResult.count || 0,
      previous,
      windowDays,
    }
    
    
    return {
      success: true,
      data: result,
    }
  } catch (error: unknown) {
    logger.error('Error fetching dashboard KPIs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
    }
  }
}

export async function getRecentOrders(limit: number = 5) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        order_id,
        order_type,
        status,
        order_date,
        created_at,
        customers (
          customer_name,
          phone_number
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    return {
      success: true,
      data: data || []
    }
  } catch (error: unknown) {
    logger.error('Error fetching recent orders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent orders',
    }
  }
}

'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getChartData(startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient()
    // Set default date range if not provided (30 days ago to today)
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate
    // Get daily orders count
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('order_date, order_id')
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
      .order('order_date')
    
    if (ordersError) throw ordersError
    
    // Get daily revenue data (actual cash collected)
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payment_records')
      .select('payment_date, amount')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd)
      .order('payment_date')
    
    if (paymentsError) throw paymentsError

    // Get daily estimated revenue (order_items joined with orders for date)
    const { data: estimatedData, error: estimatedError } = await supabase
      .from('order_items')
      .select('estimated_price, actual_price, orders!inner(order_date, status)')
      .gte('orders.order_date', dateStart)
      .lte('orders.order_date', dateEnd)
      .neq('orders.status', 'CANCELLED')

    if (estimatedError) throw estimatedError
    
    // Process data to create daily aggregates
    const dailyData = new Map()
    
    // Initialize all dates in range
    const currentDate = new Date(dateStart)
    const endDateObj = new Date(dateEnd)
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dailyData.set(dateStr, {
        date: dateStr,
        orders: 0,
        revenue: 0,
        estimatedRevenue: 0,
        formattedDate: new Date(dateStr).toLocaleDateString('id-ID', { 
          day: '2-digit', 
          month: 'short' 
        })
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Aggregate orders by date
    ordersData?.forEach(order => {
      const date = order.order_date
      if (dailyData.has(date)) {
        dailyData.get(date).orders += 1
      }
    })
    
    // Aggregate actual revenue by date
    paymentsData?.forEach(payment => {
      const date = payment.payment_date
      if (dailyData.has(date)) {
        dailyData.get(date).revenue += Number(payment.amount) || 0
      }
    })

    // Aggregate estimated revenue by order_date
    ;(estimatedData as Array<{
      estimated_price?: number | null
      actual_price?: number | null
      orders?: { order_date?: string } | { order_date?: string }[] | null
    }> | null | undefined)?.forEach(item => {
      const ord = Array.isArray(item.orders) ? item.orders[0] : item.orders
      const date = ord?.order_date
      if (date && dailyData.has(date)) {
        const price = item.actual_price ?? item.estimated_price ?? 0
        dailyData.get(date).estimatedRevenue += Number(price) || 0
      }
    })
    
    // Convert to array and sort by date
    const chartData = Array.from(dailyData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    
    return {
      success: true,
      data: chartData
    }
  } catch (error: unknown) {
    logger.error('❌ Error fetching chart data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch chart data',
      data: []
    }
  }
}

export async function getStatusBreakdown(startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient()
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate

    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)

    if (error) throw error

    const counts: Record<string, number> = {}
    data?.forEach((row: { status?: string | null }) => {
      const status = row.status || 'PENDING'
      counts[status] = (counts[status] || 0) + 1
    })

    return {
      success: true,
      data: counts,
    }
  } catch (error: unknown) {
    logger.error('Error fetching status breakdown:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch status breakdown',
      data: {} as Record<string, number>,
    }
  }
}

export async function getTopTechnicians(startDate?: string, endDate?: string, limit: number = 10) {
  try {
    const supabase = await createClient()
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate

    const { data, error } = await supabase
      .from('order_technicians')
      .select(`
        technician_id,
        technicians (
          technician_id,
          technician_name
        ),
        orders (
          status,
          order_date
        )
      `)
      .gte('orders.order_date', dateStart)
      .lte('orders.order_date', dateEnd)

    if (error) throw error

    type Row = {
      technician_id?: string | null
      technicians?: { technician_id?: string; technician_name?: string } | { technician_id?: string; technician_name?: string }[] | null
      orders?: { status?: string; order_date?: string } | { status?: string; order_date?: string }[] | null
    }

    const stats = new Map<string, { name: string; completed: number; total: number }>()

    ;(data as Row[] | null | undefined)?.forEach((row) => {
      const tech = Array.isArray(row.technicians) ? row.technicians[0] : row.technicians
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
      const techId = tech?.technician_id || row.technician_id
      const techName = tech?.technician_name || 'Teknisi'
      if (!techId) return

      const existing = stats.get(techId) || { name: techName, completed: 0, total: 0 }
      existing.total += 1
      if (order?.status && ['COMPLETED', 'INVOICED', 'PAID'].includes(order.status)) {
        existing.completed += 1
      }
      stats.set(techId, existing)
    })

    const top = Array.from(stats.entries())
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.completed - a.completed || b.total - a.total)
      .slice(0, limit)

    return {
      success: true,
      data: top,
    }
  } catch (error: unknown) {
    logger.error('Error fetching top technicians:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch top technicians',
      data: [],
    }
  }
}

export interface StatusByDayPoint {
  date: string
  formattedDate: string
  completed: number
  in_progress: number
  pending: number
  cancelled: number
}

export async function getStatusByDay(startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient()
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate

    const { data, error } = await supabase
      .from('orders')
      .select('order_date, status')
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
      .order('order_date')

    if (error) throw error

    const dailyData = new Map<string, StatusByDayPoint>()
    const currentDate = new Date(`${dateStart}T00:00:00.000Z`)
    const endDateObj = new Date(`${dateEnd}T00:00:00.000Z`)

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dailyData.set(dateStr, {
        date: dateStr,
        formattedDate: new Date(dateStr).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        completed: 0,
        in_progress: 0,
        pending: 0,
        cancelled: 0,
      })
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    ;(data as Array<{ order_date?: string | null; status?: string | null }> | null | undefined)?.forEach((row) => {
      const date = row.order_date
      if (!date || !dailyData.has(date)) return
      const bucket = dailyData.get(date)!
      const status = row.status || 'PENDING'
      if (['COMPLETED', 'INVOICED', 'PAID'].includes(status)) {
        bucket.completed += 1
      } else if (['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'].includes(status)) {
        bucket.in_progress += 1
      } else if (status === 'CANCELLED') {
        bucket.cancelled += 1
      } else {
        bucket.pending += 1
      }
    })

    const result = Array.from(dailyData.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    return {
      success: true,
      data: result,
    }
  } catch (error: unknown) {
    logger.error('Error fetching status by day:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch status by day',
      data: [] as StatusByDayPoint[],
    }
  }
}

'use server'

import { createClient } from '@/lib/supabase-server'

console.log('📦 Dashboard actions module loaded')

export async function getDashboardKpis(startDate?: string, endDate?: string) {
  try {
    console.log('🔍 getDashboardKpis: Starting...', { startDate, endDate })
    const supabase = await createClient()
    console.log('✅ Supabase client created')
    
    // Set default date range if not provided (30 days ago to today)
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate
    
    console.log('📅 Date range:', { dateStart, dateEnd })
    
    // Test basic connection first
    const { data: testData, error: testError } = await supabase
      .from('orders')
      .select('order_id')
      .limit(1)
    
    console.log('🧪 Test connection:', { testData, testError })
    
    // Get total orders count (with date range)
    console.log('📊 Fetching total orders...')
    const { count: totalOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
    
    console.log('📊 Total orders result:', { totalOrders, ordersError })
    if (ordersError) throw ordersError
    
    // Get pending orders count
    const { count: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['NEW', 'ACCEPTED', 'ASSIGNED', 'EN ROUTE', 'ARRIVED', 'IN_PROGRESS'])
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
    
    if (pendingError) throw pendingError
    
    // Get completed orders count
    const { count: completedOrders, error: completedError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['PAID', 'CLOSED'])
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
    
    if (completedError) throw completedError
    
    // Get cancelled orders count
    const { count: cancelledOrders, error: cancelledError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CANCELLED')
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
    
    if (cancelledError) throw cancelledError
    
    // Get total customers
    console.log('👥 Fetching customers...')
    const { count: totalCustomers, error: customersError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
    
    console.log('👥 Customers result:', { totalCustomers, customersError })
    if (customersError) throw customersError
    
    // Get total technicians
    console.log('🔧 Fetching technicians...')
    const { count: totalTechnicians, error: techniciansError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
    
    console.log('🔧 Technicians result:', { totalTechnicians, techniciansError })
    if (techniciansError) throw techniciansError
    
    // Get total revenue from payments table (amount_paid column) - PAID status with date range
    console.log('💰 Fetching payments revenue...')
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_paid')
      .eq('status', 'PAID')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd)
    
    console.log('💰 Payments result:', { paymentsData, paymentsError })
    
    if (paymentsError) {
      console.error('Payments query error:', paymentsError)
      // Don't throw error, just set revenue to 0
    }
    
    const totalRevenue = paymentsData?.reduce((sum: number, payment: any) => {
      const paymentAmount = payment.amount_paid || 0
      return sum + paymentAmount
    }, 0) || 0
    
    // Get UNPAID transactions count with date range
    console.log('❌ Fetching unpaid transactions...')
    const { count: unpaidTransactions, error: unpaidError } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'UNPAID')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd)
    
    console.log('❌ Unpaid result:', { unpaidTransactions, unpaidError })
    if (unpaidError) {
      console.error('Unpaid query error:', unpaidError)
    }
    
    const result = {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      completedOrders: completedOrders || 0,
      cancelledOrders: cancelledOrders || 0,
      totalCustomers: totalCustomers || 0,
      totalTechnicians: totalTechnicians || 0,
      totalRevenue,
      unpaidTransactions: unpaidTransactions || 0,
    }
    
    console.log('🎯 Final KPI result:', result)
    
    return {
      success: true,
      data: result,
    }
  } catch (error: any) {
    console.error('Error fetching dashboard KPIs:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch dashboard data',
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
        created_at,
        customers (
          name,
          phone
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    return {
      success: true,
      data: data || []
    }
  } catch (error: any) {
    console.error('Error fetching recent orders:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export async function getChartData(startDate?: string, endDate?: string) {
  try {
    console.log('📈 getChartData: Starting...', { startDate, endDate })
    const supabase = await createClient()
    
    // Set default date range if not provided (30 days ago to today)
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const dateStart = startDate || defaultStartDate
    const dateEnd = endDate || defaultEndDate
    
    console.log('📅 Chart date range:', { dateStart, dateEnd })
    
    // Get daily orders count
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('order_date, order_id')
      .gte('order_date', dateStart)
      .lte('order_date', dateEnd)
      .order('order_date')
    
    if (ordersError) throw ordersError
    
    // Get daily revenue data
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('payment_date, amount_paid')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd)
      .order('payment_date')
    
    if (paymentsError) throw paymentsError
    
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
    
    // Aggregate revenue by date
    paymentsData?.forEach(payment => {
      const date = payment.payment_date
      if (dailyData.has(date)) {
        dailyData.get(date).revenue += parseFloat(payment.amount_paid || 0)
      }
    })
    
    // Convert to array and sort by date
    const chartData = Array.from(dailyData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    console.log('📈 Chart data processed:', { totalPoints: chartData.length })
    
    return {
      success: true,
      data: chartData
    }
  } catch (error: any) {
    console.error('❌ Error fetching chart data:', error)
    return {
      success: false,
      error: error.message,
      data: []
    }
  }
}

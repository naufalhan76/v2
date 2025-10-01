'use client'

import { useEffect, useState } from 'react'
import { getDashboardKpis, getRecentOrders } from '@/lib/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  Banknote,
  CreditCard,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import Link from 'next/link'

interface KpiData {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalCustomers: number
  totalTechnicians: number
  totalRevenue: number
  unpaidTransactions: number
}

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<KpiData>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalCustomers: 0,
    totalTechnicians: 0,
    totalRevenue: 0,
    unpaidTransactions: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  
  // Date range state (default: 30 days ago to today)
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>(() => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    return {
      from: startDate,
      to: endDate
    }
  })
  
  const [tempDateRange, setTempDateRange] = useState(dateRange)

  // Handle date range selection
  const handleDateRangeSelect = (range: {from: Date | undefined, to: Date | undefined} | undefined) => {
    if (range) {
      setTempDateRange(range)
      // Auto-update when both dates are selected
      if (range.from && range.to) {
        setDateRange(range)
      }
    }
  }

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return "Pilih Tanggal"
    
    const fromFormatted = format(dateRange.from, 'dd/MM/yyyy', { locale: id })
    const toFormatted = format(dateRange.to, 'dd/MM/yyyy', { locale: id })
    
    return `${fromFormatted} - ${toFormatted}`
  }

  const fetchDashboardData = async () => {
    try {
      const startDateStr = dateRange.from?.toISOString().split('T')[0]
      const endDateStr = dateRange.to?.toISOString().split('T')[0]
      
      console.log('🚀 Dashboard: Starting data fetch with date range:', { startDateStr, endDateStr })
      const kpiResult = await getDashboardKpis(startDateStr, endDateStr)
      console.log('📊 Dashboard: KPI result received:', kpiResult)
      
      if (!kpiResult.success) {
        console.error('❌ Dashboard: KPI fetch failed:', kpiResult.error)
        throw new Error(kpiResult.error)
      }
      
      console.log('✅ Dashboard: Setting KPI data:', kpiResult.data)
      setKpiData(kpiResult.data!)
      
      const ordersResult = await getRecentOrders(5)
      
      if (ordersResult.success) {
        setRecentOrders(ordersResult.data)
      }
    } catch (error: any) {
      toast({
        title: "Error fetching dashboard data",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      fetchDashboardData()
    }
  }, [dateRange.from, dateRange.to, toast])

    const kpiCards = [
    {
      title: 'Total Orders',
      value: kpiData.totalOrders.toString(),
      description: 'All service orders',
      icon: ClipboardList,
      color: 'text-blue-600',
      href: '/orders',
    },
    {
      title: 'Pending Orders',
      value: kpiData.pendingOrders.toString(),
      description: 'Orders being processed',
      icon: AlertCircle,
      color: 'text-yellow-600',
      href: '/orders?status=pending',
    },
    {
      title: 'Completed Orders',
      value: kpiData.completedOrders.toString(),
      description: 'Successfully completed',
      icon: CheckCircle,
      color: 'text-green-600',
      href: '/orders?status=completed',
    },
    {
      title: 'Cancelled Orders',
      value: kpiData.cancelledOrders.toString(),
      description: 'Cancelled by customer',
      icon: XCircle,
      color: 'text-red-600',
      href: '/orders?status=cancelled',
    },
    {
      title: 'Total Customers',
      value: kpiData.totalCustomers.toString(),
      description: 'Registered customers',
      icon: Users,
      color: 'text-purple-600',
      href: '/dashboard/manajemen/user',
    },
    {
      title: 'Total Technicians',
      value: kpiData.totalTechnicians.toString(),
      description: 'Available technicians',
      icon: Users,
      color: 'text-indigo-600',
      href: '/dashboard/manajemen/teknisi',
    },
    {
      title: 'Total Revenue',
      value: new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(kpiData.totalRevenue),
      description: 'Total earnings',
      icon: Banknote,
      color: 'text-emerald-600',
      href: '/payments',
    },
    {
      title: 'Unpaid Transactions',
      value: kpiData.unpaidTransactions.toString(),
      description: 'Pending payments',
      icon: CreditCard,
      color: 'text-orange-600',
      href: '/payments?status=unpaid',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600">AC Service Management Overview</p>
          </div>
          
          {/* Date Range Picker - Right Side */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-sm font-medium text-slate-700">Filter Tanggal Transaksi:</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[220px] justify-start text-left font-normal bg-white text-sm",
                    (!dateRange.from || !dateRange.to) && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={tempDateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  locale={id}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon
            return (
              <Link key={index} href={kpi.href} className="block">
                <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {kpi.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {kpi.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest service orders</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders found</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order: any) => (
                  <div key={order.order_id} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">{order.customers?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.order_type} - {order.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{order.customers?.phone || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

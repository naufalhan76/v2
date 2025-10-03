'use client'

import { useEffect, useState } from 'react'
import { getDashboardKpis, getChartData } from '@/lib/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
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

interface ChartDataPoint {
  date: string
  orders: number
  revenue: number
  formattedDate: string
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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  
  // Date range state (default: 30 days ago to today)
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to?: Date | undefined}>(() => {
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
  const handleDateRangeSelect = (range: {from: Date | undefined, to?: Date | undefined} | undefined) => {
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
      
      // Fetch KPI data
      const kpiResult = await getDashboardKpis(startDateStr, endDateStr)
      console.log('📊 Dashboard: KPI result received:', kpiResult)
      
      if (!kpiResult.success) {
        console.error('❌ Dashboard: KPI fetch failed:', kpiResult.error)
        throw new Error(kpiResult.error)
      }
      
      console.log('✅ Dashboard: Setting KPI data:', kpiResult.data)
      setKpiData(kpiResult.data!)
      
      // Fetch chart data
      const chartResult = await getChartData(startDateStr, endDateStr)
      console.log('📈 Dashboard: Chart result received:', chartResult)
      
      if (chartResult.success) {
        setChartData(chartResult.data)
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
      href: '/dashboard/operasional/monitoring-ongoing',
    },
    {
      title: 'Pending Orders',
      value: kpiData.pendingOrders.toString(),
      description: 'Orders being processed',
      icon: AlertCircle,
      color: 'text-yellow-600',
      href: '/dashboard/operasional/accept-order',
    },
    {
      title: 'Completed Orders',
      value: kpiData.completedOrders.toString(),
      description: 'Successfully completed',
      icon: CheckCircle,
      color: 'text-green-600',
      href: '/dashboard/operasional/monitoring-history',
    },
    {
      title: 'Cancelled Orders',
      value: kpiData.cancelledOrders.toString(),
      description: 'Cancelled by customer',
      icon: XCircle,
      color: 'text-red-600',
      href: '/dashboard/operasional/monitoring-ongoing',
    },
    {
      title: 'Total Customers',
      value: kpiData.totalCustomers.toString(),
      description: 'Registered customers',
      icon: Users,
      color: 'text-purple-600',
      href: '/dashboard/manajemen/customer',
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
      href: '/dashboard/operasional/monitoring-ongoing',
    },
    {
      title: 'Unpaid Transactions',
      value: kpiData.unpaidTransactions.toString(),
      description: 'Pending payments',
      icon: CreditCard,
      color: 'text-orange-600',
      href: '/dashboard/operasional/monitoring-ongoing',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">AC Service Management Overview</p>
          </div>
          
          {/* Date Range Picker - Right Side */}
          <div className="flex flex-col items-end gap-3">
            <div className="text-sm font-medium mb-1">Filter Tanggal Transaksi:</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal text-sm px-3 py-2.5 h-auto shadow-sm",
                    (!dateRange.from || !dateRange.to) && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-3 h-4 w-4" />
                  <span className="flex-1">{formatDateRange()}</span>
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
            <CardTitle className="flex items-center gap-2">
              Revenue & Orders Overview
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                Last {Math.ceil((new Date(dateRange.to || new Date()).getTime() - new Date(dateRange.from || new Date()).getTime()) / (1000 * 60 * 60 * 24))} days
              </span>
            </CardTitle>
            <CardDescription>Showing total orders and revenue for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                orders: {
                  label: "Orders",
                  color: "hsl(217, 91%, 45%)", // Dark Blue - untuk emphasis
                },
                revenue: {
                  label: "Revenue", 
                  color: "hsl(217, 91%, 75%)", // Light Blue - same family, lighter shade
                },
              }}
              className="h-[400px] w-full"
            >
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  {/* Orders - Dark Blue with strong opacity */}
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 45%)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(217, 91%, 45%)" stopOpacity={0.1}/>
                  </linearGradient>
                  {/* Revenue - Light Blue with softer opacity */}
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 75%)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="hsl(217, 91%, 75%)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="formattedDate" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(215, 16%, 47%)' }}
                  className="text-xs"
                />
                <YAxis 
                  yAxisId="orders"
                  orientation="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(215, 16%, 47%)' }}
                  className="text-xs"
                />
                <YAxis 
                  yAxisId="revenue"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(215, 16%, 47%)' }}
                  tickFormatter={(value) => `Rp${(value / 1000000).toFixed(1)}M`}
                  className="text-xs"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => [
                        name === 'revenue' 
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value as number)
                          : value,
                        name === 'orders' ? 'Orders' : 'Revenue'
                      ]}
                      labelFormatter={(label) => label}
                    />
                  }
                />
                {/* Orders Area - Dark Blue for prominence */}
                <Area
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(217, 91%, 45%)"
                  fill="url(#colorOrders)"
                  strokeWidth={2.5}
                  name="orders"
                />
                {/* Revenue Area - Light Blue for background context */}
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(217, 91%, 75%)"
                  fill="url(#colorRevenue)"
                  strokeWidth={1.5}
                  name="revenue"
                />
              </AreaChart>
            </ChartContainer>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(217, 91%, 45%)' }}></div>
                <span className="text-muted-foreground font-medium">Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(217, 91%, 75%)' }}></div>
                <span className="text-muted-foreground">Revenue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

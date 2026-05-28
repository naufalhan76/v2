'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDashboardKpis, getChartData, getRecentOrders } from '@/lib/actions/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { KpiCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/skeleton'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, LineChart, ResponsiveContainer
} from 'recharts'
import {
  Plus, UserCheck, FileText,
  Calendar, ArrowUpRight, ArrowDownRight, ClipboardList,
  CheckCircle, AlertCircle, Banknote
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ResourceHints } from '@/components/ui/priority-components'
import { useToast } from '@/hooks/use-toast'
import { StatusBadge } from '@/components/orders/status-badge'

interface KpiData {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalCustomers: number
  totalTechnicians: number
  totalRevenue: number
  estimatedRevenue: number
  unpaidTransactions: number
  previous?: Omit<KpiData, 'previous' | 'windowDays'>
  windowDays?: number
}

interface ChartDataPoint {
  date: string
  orders: number
  revenue: number
  estimatedRevenue: number
  formattedDate: string
}

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<KpiData>({
    totalOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0,
    totalCustomers: 0, totalTechnicians: 0, totalRevenue: 0, estimatedRevenue: 0, unpaidTransactions: 0,
  })
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [recentOrders, setRecentOrders] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('there')
  const { toast } = useToast()

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>(() => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    return { from: startDate, to: endDate }
  })
  const [tempDateRange, setTempDateRange] = useState(dateRange)

  const handleDateRangeSelect = (range: { from: Date | undefined; to?: Date | undefined } | undefined) => {
    if (range) {
      setTempDateRange(range)
      if (range.from && range.to) setDateRange(range)
    }
  }

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return 'Pilih Tanggal'
    return `${format(dateRange.from, 'dd/MM/yyyy', { locale: id })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: id })}`
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: userData } = await supabase
            .from('user_management')
            .select('full_name')
            .eq('auth_user_id', session.user.id)
            .single()
          if (userData?.full_name) setUserName(userData.full_name.split(' ')[0])
        }
      } catch {}
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const startStr = dateRange.from!.toISOString().split('T')[0]
        const endStr = dateRange.to!.toISOString().split('T')[0]
        const [kpiResult, chartResult, ordersResult] = await Promise.all([
          getDashboardKpis(startStr, endStr),
          getChartData(startStr, endStr),
          getRecentOrders(7),
        ])
        if (kpiResult.success && kpiResult.data) setKpiData(kpiResult.data)
        if (chartResult.success) setChartData(chartResult.data || [])
        if (ordersResult.success) setRecentOrders(ordersResult.data || [])
      } catch (error: unknown) {
        toast({ title: 'Error loading dashboard', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [dateRange.from, dateRange.to]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive sparkline data (last 7 entries)
  const sparklineData = chartData.slice(-7)

  const kpiCards = [
    {
      title: 'Total Orders',
      value: kpiData.totalOrders,
      currentValue: kpiData.totalOrders,
      previousValue: kpiData.previous?.totalOrders ?? 0,
      icon: ClipboardList,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      sparkKey: 'orders' as const,
    },
    {
      title: 'Completed',
      value: kpiData.completedOrders,
      currentValue: kpiData.completedOrders,
      previousValue: kpiData.previous?.completedOrders ?? 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      sparkKey: 'orders' as const,
    },
    {
      title: 'Estimated Revenue',
      value: `Rp ${(kpiData.estimatedRevenue / 1000000).toFixed(1)}M`,
      currentValue: kpiData.estimatedRevenue,
      previousValue: kpiData.previous?.estimatedRevenue ?? 0,
      icon: ClipboardList,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      sparkKey: 'estimatedRevenue' as const,
    },
    {
      title: 'Actual Revenue',
      value: `Rp ${(kpiData.totalRevenue / 1000000).toFixed(1)}M`,
      currentValue: kpiData.totalRevenue,
      previousValue: kpiData.previous?.totalRevenue ?? 0,
      icon: Banknote,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      sparkKey: 'revenue' as const,
    },
    {
      title: 'Pending',
      value: kpiData.pendingOrders,
      currentValue: kpiData.pendingOrders,
      previousValue: kpiData.previous?.pendingOrders ?? 0,
      icon: AlertCircle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      sparkKey: 'orders' as const,
    },
  ]

  const donutData = [
    { name: 'Pending', value: kpiData.pendingOrders || 0, fill: 'hsl(var(--chart-4))' },
    { name: 'Completed', value: kpiData.completedOrders || 0, fill: 'hsl(var(--chart-3))' },
    { name: 'Cancelled', value: kpiData.cancelledOrders || 0, fill: 'hsl(var(--chart-5))' },
  ]

  if (isLoading) {
    return (
      <>
        <ResourceHints domains={['api.supabase.co']} />
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-full sm:w-48" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
          <ChartSkeleton height={300} />
        </div>
      </>
    )
  }

  return (
    <>
      <ResourceHints domains={['api.supabase.co']} />
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">

        {/* Section 1: Welcome + Date Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Welcome back, {userName}</h1>
            <p className="text-muted-foreground text-sm mt-1">Here&apos;s your AC service overview</p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground">Filter Tanggal</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full sm:w-[240px] justify-start text-left font-normal text-sm', (!dateRange.from || !dateRange.to) && 'text-muted-foreground')}>
                  <Calendar className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{formatDateRange()}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={tempDateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={1}
                  className="sm:hidden"
                  locale={id as never}
                />
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={tempDateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  className="hidden sm:block"
                  locale={id as never}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Section 2: KPI Cards with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon
            const sparkVals = sparklineData.map(d => ({ v: (d as unknown as Record<string, number>)[kpi.sparkKey] ?? 0 }))
            const pct = kpi.previousValue > 0 ? Math.round(((kpi.currentValue - kpi.previousValue) / kpi.previousValue) * 100) : 0
            const up = pct >= 0
            return (
              <div key={kpi.title} className="kpi-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-bold mt-1" data-testid="kpi-current">{kpi.value}</p>
                  </div>
                  <div className={cn('p-2 rounded-lg', kpi.bgColor)}>
                    <Icon className={cn('h-5 w-5', kpi.color)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span data-testid="kpi-delta" className={cn('flex items-center gap-1 text-xs font-medium', up ? 'text-green-600' : 'text-red-500')}>
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(pct)}% vs prev {kpiData.windowDays ?? 1}d
                  </span>
                  {sparkVals.length > 1 && (
                    <ResponsiveContainer width={60} height={30}>
                      <LineChart data={sparkVals}>
                        <Line type="monotone" dataKey="v" stroke={up ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))'} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Section 3: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Combo chart */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Revenue & Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  orders: { label: 'Orders', color: 'hsl(var(--chart-1))' },
                  estimatedRevenue: { label: 'Estimated', color: 'hsl(var(--chart-4))' },
                  revenue: { label: 'Actual', color: 'hsl(var(--chart-2))' },
                }}
                className="h-[220px] sm:h-[260px] w-full"
              >
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis yAxisId="rev" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={32} />
                  <YAxis yAxisId="ord" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="rev" dataKey="estimatedRevenue" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} opacity={0.6} name="estimatedRevenue" />
                  <Bar yAxisId="rev" dataKey="revenue" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} opacity={0.9} name="revenue" />
                  <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="orders" />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Donut chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative flex items-center justify-center">
                <PieChart width={180} height={180}>
                  <Pie data={donutData} cx={85} cy={85} innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
                <div className="absolute text-center pointer-events-none">
                  <p className="text-2xl font-bold">{kpiData.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 4: Quick Actions */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3">
          <Button variant="outline" asChild className="w-full sm:w-auto justify-start sm:justify-center">
            <Link href="/dashboard/orders/new"><Plus className="h-4 w-4 mr-2" />Create Order</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto justify-start sm:justify-center">
            <Link href="/dashboard/orders?view=board"><UserCheck className="h-4 w-4 mr-2" />Assign Order</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto justify-start sm:justify-center">
            <Link href="/dashboard/keuangan/invoices"><FileText className="h-4 w-4 mr-2" />View Invoices</Link>
          </Button>
        </div>

        {/* Section 5: Recent Orders */}
        <div className="data-table-container overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/50">
            <h2 className="text-base font-semibold">Recent Orders</h2>
            <Link href="/dashboard/orders?view=list" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="hidden md:table-cell text-xs font-medium text-muted-foreground">Order ID</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Customer</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs font-medium text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs font-medium text-muted-foreground">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => {
                    const o = order as Record<string, unknown> & {
                      customers?: { customer_name?: string; phone_number?: string }
                      order_date?: string
                      created_at?: string
                    }
                    const dateStr = o.order_date || o.created_at
                    return (
                    <TableRow key={o.order_id as string} className="border-0 hover:bg-muted/50">
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{(o.order_id as string)?.slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div>{o.customers?.customer_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground sm:hidden mt-0.5">
                          {(o.order_type as string) ?? '—'}
                          {dateStr && ` • ${format(new Date(dateStr), 'dd MMM', { locale: id })}`}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{(o.order_type as string) ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={o.status as string} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {dateStr ? format(new Date(dateStr), 'dd MMM yyyy', { locale: id }) : '—'}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}

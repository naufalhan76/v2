'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusByDay } from '@/lib/actions/dashboard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, UserCheck, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ResourceHints } from '@/components/ui/priority-components'
import {
  DashboardOnboarding,
  DateFilterTooltip,
  QuickActionsTooltip,
} from '@/components/dashboard/dashboard-onboarding'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { OrdersRevenueAreaChart } from '@/components/dashboard/orders-revenue-area-chart'
import { StatusBreakdownDonut } from '@/components/dashboard/status-breakdown-donut'
import { StatusByDayBar, type DailyStatusData } from '@/components/dashboard/status-by-day-bar'
import { RevenueTrendLine } from '@/components/dashboard/revenue-trend-line'
import { TopTechniciansList } from '@/components/dashboard/top-technicians-list'
import { RecentOrdersTable } from '@/components/dashboard/recent-orders-table'
import { OrdersActivityFeed } from '@/components/dashboard/orders-activity-feed'

export default function DashboardPage() {
  const [userName, setUserName] = useState('Admin')

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>(() => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    return { from: startDate, to: endDate }
  })
  const [tempDateRange, setTempDateRange] = useState(dateRange)

  const [statusByDay, setStatusByDay] = useState<DailyStatusData[]>([])
  const [statusByDayLoading, setStatusByDayLoading] = useState(true)

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

  const dateRangeStr = (() => {
    if (!dateRange.from || !dateRange.to) return { start: '', end: '' }
    return {
      start: dateRange.from.toISOString().split('T')[0],
      end: dateRange.to.toISOString().split('T')[0],
    }
  })()

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
      } catch (err) {
        console.warn('Failed to fetch user name for greeting:', err)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (!dateRangeStr.start || !dateRangeStr.end) return
    let cancelled = false
    setStatusByDayLoading(true)
    getStatusByDay(dateRangeStr.start, dateRangeStr.end).then((res) => {
      if (cancelled) return
      if (res.success && res.data) setStatusByDay(res.data as DailyStatusData[])
      setStatusByDayLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [dateRangeStr.start, dateRangeStr.end])

  return (
    <>
      <ResourceHints domains={['api.supabase.co']} />
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-enter {
          animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-enter {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
      <DashboardOnboarding>
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

          {/* Header: Welcome + Date Filter */}
          <div
            className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            style={{ animationDelay: '0ms' }}
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Selamat datang kembali, {userName}
              </h1>
              <p className="text-muted-foreground text-sm mt-1.5 font-semibold">
                Ringkasan operasional layanan AC hari ini
              </p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
              <div className="flex flex-col items-stretch sm:items-end gap-1">
                <span className="text-xs text-muted-foreground font-medium">Filter Tanggal</span>
                <DateFilterTooltip>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full sm:w-[240px] justify-start text-left font-normal text-sm shadow-sm', (!dateRange.from || !dateRange.to) && 'text-muted-foreground')}>
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
                </DateFilterTooltip>
              </div>
              <QuickActionsTooltip>
                <div className="flex gap-2">
                  <Button size="sm" asChild className="justify-center shadow-sm">
                    <Link href="/dashboard/orders/new"><Plus className="h-4 w-4 mr-1.5" />Buat Order</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="justify-center">
                    <Link href="/dashboard/orders?view=board"><UserCheck className="h-4 w-4 mr-1.5" />Tugaskan</Link>
                  </Button>
                </div>
              </QuickActionsTooltip>
            </div>
          </div>

          {/* Row 1: KPI Stats (full width) */}
          <div className="animate-enter" style={{ animationDelay: '60ms' }}>
            <StatsCards />
          </div>

          {/* Row 2: Orders & Revenue (2/3) + Status Breakdown Donut (1/3) */}
          <div
            className="animate-enter grid grid-cols-1 gap-4 lg:grid-cols-3"
            style={{ animationDelay: '120ms' }}
          >
            <div className="lg:col-span-2">
              <OrdersRevenueAreaChart />
            </div>
            <div>
              <StatusBreakdownDonut startDate={dateRangeStr.start} endDate={dateRangeStr.end} />
            </div>
          </div>

          {/* Row 3: Recent Orders (1/2) + Activity Feed (1/2) */}
          <div
            className="animate-enter grid grid-cols-1 gap-4 lg:grid-cols-2"
            style={{ animationDelay: '180ms' }}
          >
            <RecentOrdersTable limit={8} />
            <OrdersActivityFeed limit={10} />
          </div>

          {/* Row 4: Revenue Trend Line (1/2) + Top Technicians (1/2) */}
          <div
            className="animate-enter grid grid-cols-1 gap-4 lg:grid-cols-2"
            style={{ animationDelay: '240ms' }}
          >
            <RevenueTrendLine startDate={dateRangeStr.start} endDate={dateRangeStr.end} />
            <TopTechniciansList startDate={dateRangeStr.start} endDate={dateRangeStr.end} />
          </div>

          {/* Row 5: Status by Day Stacked Bar (full width) */}
          <div className="animate-enter" style={{ animationDelay: '300ms' }}>
            {statusByDayLoading ? (
              <Skeleton className="h-[380px] w-full rounded-xl" />
            ) : (
              <StatusByDayBar data={statusByDay} />
            )}
          </div>

        </div>
      </DashboardOnboarding>
    </>
  )
}

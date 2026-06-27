'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, CheckCircle2, Snowflake } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getServicedAcUnits,
  createManualReminder,
  type ServicedAcStatusFilter,
  type ServicedAcUnitRow,
} from '@/lib/actions/reminders'
import { updateAcUnitNextServiceDate } from '@/lib/actions/ac-units'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { MonitoringTable } from './monitoring-table'
import { MonitoringFilters } from './monitoring-filters'

function daysFromToday(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function MonitoringTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<ServicedAcStatusFilter>(() => {
    const v = searchParams.get('status') as ServicedAcStatusFilter | null
    return (v === 'overdue' || v === 'due_soon' || v === 'upcoming' || v === 'no_date' || v === 'all') ? v : 'all'
  })
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const v = searchParams.get('date_from'); return v ? new Date(`${v}T00:00:00`) : undefined
  })
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const v = searchParams.get('date_to'); return v ? new Date(`${v}T00:00:00`) : undefined
  })
  const [page, setPage] = useState(0)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [updatingDateId, setUpdatingDateId] = useState<string | null>(null)
  const PAGE_SIZE = 20
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)
    if (dateFrom) params.set('date_from', dateFrom.toISOString().slice(0, 10))
    if (dateTo) params.set('date_to', dateTo.toISOString().slice(0, 10))
    const existingTab = searchParams.get('tab')
    if (existingTab) params.set('tab', existingTab)
    const qs = params.toString()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 300)
  }, [statusFilter, search, dateFrom, dateTo, router, searchParams])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['serviced-ac-units'],
    queryFn: async () => {
      const result = await getServicedAcUnits({})
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat data AC')
      return ((result as { data?: ServicedAcUnitRow[] }).data ?? []) as ServicedAcUnitRow[]
    },
  })

  const units = useMemo(() => data ?? [], [data])

  const stats = useMemo(() => {
    let overdue = 0, dueThisWeek = 0, activeReminders = 0
    for (const u of units) {
      if (u.has_pending_reminder) activeReminders++
      const days = daysFromToday(u.next_service_due_date)
      if (days === null) continue
      if (days < 0) overdue++; else if (days <= 7) dueThisWeek++
    }
    return { total: units.length, overdue, dueThisWeek, activeReminders }
  }, [units])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromMs = dateFrom ? (() => { const d = new Date(dateFrom); d.setHours(0,0,0,0); return d.getTime() })() : null
    const toMs = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23,59,59,999); return d.getTime() })() : null
    return units.filter((u) => {
      if (statusFilter !== 'all') {
        const days = daysFromToday(u.next_service_due_date)
        if (statusFilter === 'no_date') { if (days !== null) return false }
        else if (days === null) return false
        else if (statusFilter === 'overdue' && days >= 0) return false
        else if (statusFilter === 'due_soon' && (days < 0 || days > 7)) return false
        else if (statusFilter === 'upcoming' && days <= 7) return false
      }
      if (fromMs !== null || toMs !== null) {
        if (!u.next_service_due_date) return false
        const dueMs = new Date(`${u.next_service_due_date}T00:00:00`).getTime()
        if (Number.isNaN(dueMs)) return false
        if (fromMs !== null && dueMs < fromMs) return false
        if (toMs !== null && dueMs > toMs) return false
      }
      if (q) {
        const name = u.customer_name?.toLowerCase() ?? ''
        const phone = u.customer_phone?.toLowerCase() ?? ''
        const brand = u.brand?.toLowerCase() ?? ''
        const model = u.model_number?.toLowerCase() ?? ''
        if (!name.includes(q) && !phone.includes(q) && !brand.includes(q) && !model.includes(q)) return false
      }
      return true
    })
  }, [units, statusFilter, search, dateFrom, dateTo])

  const hasFilters = statusFilter !== 'all' || !!search || !!dateFrom || !!dateTo
  function clearFilters() { setStatusFilter('all'); setSearch(''); setDateFrom(undefined); setDateTo(undefined); setPage(0) }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleCreateReminder = useCallback(async (acUnitId: string) => {
    setSendingId(acUnitId)
    try {
      const result = await createManualReminder(acUnitId)
      if (!result?.success) throw new Error(result?.error || 'Gagal membuat reminder')
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({ title: 'Reminder dibuat', description: 'Reminder masuk ke antrian dengan status Menunggu.' })
    } catch (error) {
      logger.error('createManualReminder failed:', error)
      toast({ title: 'Gagal membuat reminder', description: String(error), variant: 'destructive' })
    } finally { setSendingId(null) }
  }, [queryClient, toast])

  const handleUpdateDate = useCallback(async (acUnitId: string, newDate: string | null) => {
    setUpdatingDateId(acUnitId)
    try {
      const result = await updateAcUnitNextServiceDate(acUnitId, newDate)
      if (!result?.success) throw new Error(result?.error || 'Gagal update tanggal')
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({ title: 'Tanggal diperbarui' })
    } catch (error) {
      toast({ title: 'Gagal update tanggal', description: String(error), variant: 'destructive' })
    } finally { setUpdatingDateId(null) }
  }, [queryClient, toast])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Total AC Dimonitor" value={stats.total} icon={<Snowflake className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Overdue" value={stats.overdue} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} isLoading={isLoading} tone="danger" />
        <StatCard title="Jatuh Tempo Minggu Ini" value={stats.dueThisWeek} icon={<CalendarClock className="h-4 w-4 text-warning" />} isLoading={isLoading} tone="warning" />
        <StatCard title="Aktif Reminder" value={stats.activeReminders} icon={<CheckCircle2 className="h-4 w-4 text-warning" />} isLoading={isLoading} />
      </div>

      <MonitoringFilters
        search={search} onSearchChange={(v) => { setSearch(v); setPage(0) }}
        statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setPage(0) }}
        dateFrom={dateFrom} onDateFromChange={(d) => { setDateFrom(d); setPage(0) }}
        dateTo={dateTo} onDateToChange={(d) => { setDateTo(d); setPage(0) }}
        hasFilters={hasFilters} onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Service Records ({filtered.length})</CardTitle>
            <span className="text-xs text-muted-foreground hidden sm:block">Sorted by next service due date (nearest first)</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState icon={Snowflake} title="Tidak ada AC yang cocok" description="Coba ubah filter pencarian atau reset filter." action={{ label: 'Reset Filter', onClick: clearFilters, icon: Snowflake }} />
            ) : (
              <EmptyState icon={Snowflake} title="Belum ada AC yang pernah di-service" description="AC akan muncul di sini setelah teknisi menyelesaikan service report dan mengisi tanggal service berikutnya." />
            )
          ) : (
            <MonitoringTable
              units={filtered} isLoading={false} isFetching={isFetching} page={page} pageSize={PAGE_SIZE}
              onCreateReminder={handleCreateReminder} sendingId={sendingId}
              onUpdateDate={handleUpdateDate} updatingDateId={updatingDateId}
            />
          )}
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Menampilkan {Math.min((page + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length} unit AC
            {isFetching && ' • memuat ulang...'}
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="flex-1 sm:flex-none">Sebelumnya</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex-1 sm:flex-none">Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, isLoading, tone }: {
  title: string; value: number; icon: React.ReactNode; isLoading: boolean; tone?: 'default' | 'warning' | 'danger'
}) {
  const accent = tone === 'danger' ? 'text-destructive dark:text-destructive' : tone === 'warning' ? 'text-warning dark:text-warning' : ''
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-16" /> : <div className={cn('text-2xl font-bold', accent)}>{value}</div>}
      </CardContent>
    </Card>
  )
}

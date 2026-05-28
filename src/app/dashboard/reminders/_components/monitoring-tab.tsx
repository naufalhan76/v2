'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  AlertTriangle,
  CalendarIcon,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Search,
  Snowflake,
  Wrench,
  X,
} from 'lucide-react'

import {
  getServicedAcUnits,
  createManualReminder,
  type ServicedAcStatusFilter,
  type ServicedAcUnitRow,
} from '@/lib/actions/reminders'
import { updateAcUnitNextServiceDate } from '@/lib/actions/ac-units'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/orders/status-badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

function todayMs() {
  return startOfDay(new Date()).getTime()
}

function daysFromToday(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  return differenceInDays(due, startOfDay(new Date()))
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: localeId })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), 'd MMM HH:mm', { locale: localeId })
  } catch {
    return iso
  }
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function MonitoringTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<ServicedAcStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

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
    let overdue = 0
    let dueThisWeek = 0
    let activeReminders = 0
    for (const u of units) {
      if (u.has_pending_reminder) activeReminders++
      const days = daysFromToday(u.next_service_due_date)
      if (days === null) continue
      if (days < 0) overdue++
      else if (days <= 7) dueThisWeek++
    }
    return { total: units.length, overdue, dueThisWeek, activeReminders }
  }, [units])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromMs = dateFrom ? startOfDay(dateFrom).getTime() : null
    const toMs = dateTo ? endOfDay(dateTo).getTime() : null

    return units.filter((u) => {
      if (statusFilter !== 'all') {
        const days = daysFromToday(u.next_service_due_date)
        if (statusFilter === 'no_date') {
          if (days !== null) return false
        } else if (days === null) {
          return false
        } else if (statusFilter === 'overdue' && days >= 0) {
          return false
        } else if (statusFilter === 'due_soon' && (days < 0 || days > 7)) {
          return false
        } else if (statusFilter === 'upcoming' && days <= 7) {
          return false
        }
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

  function clearFilters() {
    setStatusFilter('all')
    setSearch('')
    setDateFrom(undefined)
    setDateTo(undefined)
    setPage(0)
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: async (acUnitId: string) => {
      const result = await createManualReminder(acUnitId)
      if (!result?.success) throw new Error(result?.error || 'Gagal membuat reminder')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({ title: 'Reminder dibuat', description: 'Reminder masuk ke antrian dengan status Menunggu.' })
    },
    onError: (error: Error) => {
      logger.error('createManualReminder failed:', error)
      toast({ title: 'Gagal membuat reminder', description: error.message, variant: 'destructive' })
    },
  })

  const dateMutation = useMutation({
    mutationFn: async ({ acUnitId, newDate }: { acUnitId: string; newDate: string | null }) => {
      const result = await updateAcUnitNextServiceDate(acUnitId, newDate)
      if (!result?.success) throw new Error(result?.error || 'Gagal update tanggal')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({ title: 'Tanggal diperbarui' })
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal update tanggal', description: error.message, variant: 'destructive' })
    },
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Total AC Dimonitor" value={stats.total} icon={<Snowflake className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Overdue" value={stats.overdue} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} isLoading={isLoading} tone="danger" />
        <StatCard title="Jatuh Tempo Minggu Ini" value={stats.dueThisWeek} icon={<CalendarClock className="h-4 w-4 text-orange-500" />} isLoading={isLoading} tone="warning" />
        <StatCard title="Aktif Reminder" value={stats.activeReminders} icon={<CheckCircle2 className="h-4 w-4 text-amber-500" />} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer, nomor, brand, model..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ServicedAcStatusFilter); setPage(0) }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_soon">Jatuh Tempo (7 hari)</SelectItem>
                  <SelectItem value="upcoming">Mendatang</SelectItem>
                  <SelectItem value="no_date">Belum ada jadwal</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!dateFrom && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'd MMM', { locale: localeId }) : 'Dari'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0) }} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!dateTo && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'd MMM', { locale: localeId }) : 'Sampai'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0) }} />
                </PopoverContent>
              </Popover>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 sm:col-span-1">
                  <X className="mr-1 h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState icon={Snowflake} title="Tidak ada AC yang cocok" description="Coba ubah filter pencarian atau reset filter." action={{ label: 'Reset Filter', onClick: clearFilters, icon: X }} />
            ) : (
              <EmptyState icon={Wrench} title="Belum ada AC yang pernah di-service" description="AC akan muncul di sini setelah teknisi menyelesaikan service report dan mengisi tanggal service berikutnya." />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>AC Unit</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Service</TableHead>
                    <TableHead>Next Service Due</TableHead>
                    <TableHead className="hidden md:table-cell">Service Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Reminder History</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="w-[48px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((u) => (
                    <ServiceRecordRow
                      key={u.ac_unit_id}
                      unit={u}
                      onSendReminder={() => createMutation.mutate(u.ac_unit_id)}
                      isSending={createMutation.isPending && createMutation.variables === u.ac_unit_id}
                      onUpdateDate={(newDate) => dateMutation.mutate({ acUnitId: u.ac_unit_id, newDate })}
                      isUpdatingDate={dateMutation.isPending && (dateMutation.variables as { acUnitId: string } | undefined)?.acUnitId === u.ac_unit_id}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="flex-1 sm:flex-none">
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex-1 sm:flex-none">
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  isLoading,
  tone,
}: {
  title: string
  value: number
  icon: React.ReactNode
  isLoading: boolean
  tone?: 'default' | 'warning' | 'danger'
}) {
  const accent =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warning'
        ? 'text-orange-600 dark:text-orange-400'
        : ''
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={cn('text-2xl font-bold', accent)}>{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

interface ServiceRecordRowProps {
  unit: ServicedAcUnitRow
  onSendReminder: () => void
  isSending: boolean
  onUpdateDate: (newDate: string | null) => void
  isUpdatingDate: boolean
}

function ServiceRecordRow({ unit: u, onSendReminder, isSending, onUpdateDate, isUpdatingDate }: ServiceRecordRowProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [pickedDate, setPickedDate] = useState<Date | undefined>(
    u.next_service_due_date ? new Date(`${u.next_service_due_date}T00:00:00`) : undefined
  )

  const days = daysFromToday(u.next_service_due_date)

  function handleDateSelect(d: Date | undefined) {
    setPickedDate(d)
    if (d) {
      const iso = format(d, 'yyyy-MM-dd')
      onUpdateDate(iso)
      setDatePickerOpen(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{u.customer_name ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{u.customer_phone ?? '—'}</div>
      </TableCell>

      <TableCell>
        <div className="font-medium text-sm">
          {[u.brand, u.model_number].filter(Boolean).join(' ') || '—'}
        </div>
        <div className="text-xs text-muted-foreground">
          {u.unit_type_name ?? u.ac_type ?? '—'}
        </div>
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        <span className="text-sm">{fmtDate(u.last_service_date)}</span>
      </TableCell>

      <TableCell>
        <div className="space-y-1">
          <div className="text-sm">{fmtDate(u.next_service_due_date)}</div>
          {days !== null && days < 0 && (
            <Badge variant="destructive" className="text-xs">
              Overdue ({Math.abs(days)} hari)
            </Badge>
          )}
          {days !== null && days >= 0 && days <= 7 && (
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 text-xs dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
              Jatuh tempo dalam {days} hari
            </Badge>
          )}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                disabled={isUpdatingDate}
              >
                <Pencil className="h-3 w-3" />
                {u.next_service_due_date ? 'Edit tanggal' : 'Set tanggal'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={pickedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {u.latest_service_type ? (
          <Badge variant="outline" className="text-xs">{u.latest_service_type}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        <div className="space-y-1">
          <Badge variant="secondary" className="rounded-full text-xs">
            {u.reminder_count} reminders
          </Badge>
          {u.last_reminder_sent_at && (
            <div className="text-xs text-muted-foreground">
              Last: {fmtDateTime(u.last_reminder_sent_at)}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {u.latest_order_status ? (
          <StatusBadge status={u.latest_order_status} size="sm" />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      <TableCell>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onSendReminder}
          disabled={isSending}
          title="Kirim reminder manual"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

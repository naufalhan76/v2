'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  AlertTriangle,
  BellPlus,
  CalendarIcon,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

// =============================================================================
// Helpers
// =============================================================================

function startOfDayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function daysBetween(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = startOfDayLocal()
  const ms = due.getTime() - today.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function formatDateOrDash(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: localeId })
  } catch {
    return iso
  }
}

function formatBtu(value: number | null): string {
  if (!value || value <= 0) return ''
  if (value >= 1000) return `${(value / 1000).toLocaleString('id-ID')}k BTU`
  return `${value} BTU`
}

interface RemainingDaysBadgeProps {
  days: number | null
}

function RemainingDaysBadge({ days }: RemainingDaysBadgeProps) {
  if (days === null) {
    return <span className="text-muted-foreground">—</span>
  }
  if (days < 0) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        Overdue {Math.abs(days)} hari
      </Badge>
    )
  }
  if (days <= 7) {
    return (
      <Badge
        variant="outline"
        className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
      >
        {days === 0 ? 'Hari ini' : `${days} hari lagi`}
      </Badge>
    )
  }
  if (days <= 30) {
    return (
      <Badge
        variant="outline"
        className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
      >
        {days} hari lagi
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
    >
      {days} hari lagi
    </Badge>
  )
}

// =============================================================================
// Component
// =============================================================================

export function MonitoringTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filters
  const [statusFilter, setStatusFilter] = useState<ServicedAcStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  // Table state — default sort: Sisa Hari ASC (overdue first, then closest)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'days_until', desc: false },
  ])

  // -- Data --------------------------------------------------------------------

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['serviced-ac-units'],
    queryFn: async () => {
      const result = await getServicedAcUnits({})
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal memuat data AC')
      }
      const payload = (result as { data?: ServicedAcUnitRow[] }).data
      return (payload ?? []) as ServicedAcUnitRow[]
    },
  })

  const units = useMemo(() => data ?? [], [data])

  // Stat cards — computed from full set
  const stats = useMemo(() => {
    let overdue = 0
    let dueThisWeek = 0
    let activeReminders = 0
    for (const u of units) {
      if (u.has_pending_reminder) activeReminders++
      const days = daysBetween(u.next_service_due_date)
      if (days === null) continue
      if (days < 0) overdue++
      else if (days <= 7) dueThisWeek++
    }
    return {
      total: units.length,
      overdue,
      dueThisWeek,
      activeReminders,
    }
  }, [units])

  // -- Filter (client-side) ----------------------------------------------------

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromMs = dateFrom ? startOfDay(dateFrom).getTime() : null
    const toMs = dateTo ? endOfDay(dateTo).getTime() : null

    return units.filter((u) => {
      // Status
      if (statusFilter !== 'all') {
        const days = daysBetween(u.next_service_due_date)
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

      // Date range on next_service_due_date
      if (fromMs !== null || toMs !== null) {
        if (!u.next_service_due_date) return false
        const dueMs = new Date(`${u.next_service_due_date}T00:00:00`).getTime()
        if (Number.isNaN(dueMs)) return false
        if (fromMs !== null && dueMs < fromMs) return false
        if (toMs !== null && dueMs > toMs) return false
      }

      // Search
      if (q) {
        const name = u.customer_name?.toLowerCase() ?? ''
        const addr = u.location_address?.toLowerCase() ?? ''
        const brand = u.brand?.toLowerCase() ?? ''
        const model = u.model_number?.toLowerCase() ?? ''
        if (
          !name.includes(q) &&
          !addr.includes(q) &&
          !brand.includes(q) &&
          !model.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [units, statusFilter, search, dateFrom, dateTo])

  const hasFilters =
    statusFilter !== 'all' || !!search || !!dateFrom || !!dateTo

  function clearFilters() {
    setStatusFilter('all')
    setSearch('')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  // -- Mutations ---------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (acUnitId: string) => {
      const result = await createManualReminder(acUnitId)
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal membuat reminder')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({
        title: 'Reminder dibuat',
        description: 'Reminder masuk ke antrian dengan status Menunggu.',
      })
    },
    onError: (error: Error) => {
      logger.error('createManualReminder failed:', error)
      toast({
        title: 'Gagal membuat reminder',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // -- Columns -----------------------------------------------------------------

  const columns: ColumnDef<ServicedAcUnitRow>[] = useMemo(
    () => [
      {
        id: 'customer',
        header: 'Customer',
        accessorFn: (row) => row.customer_name ?? '',
        cell: ({ row }) => (
          <div className="text-sm font-medium">
            {row.original.customer_name ?? '—'}
          </div>
        ),
      },
      {
        id: 'location',
        header: 'Lokasi',
        accessorFn: (row) => row.location_address ?? '',
        cell: ({ row }) => {
          const addr = row.original.location_address
          if (!addr) return <span className="text-muted-foreground">—</span>
          return (
            <div
              className="max-w-[260px] truncate text-sm text-muted-foreground"
              title={addr}
            >
              {addr}
            </div>
          )
        },
      },
      {
        id: 'ac',
        header: 'AC',
        accessorFn: (row) =>
          [row.brand, row.model_number].filter(Boolean).join(' '),
        cell: ({ row }) => {
          const u = row.original
          const brand = u.brand ?? '—'
          const btu = formatBtu(u.capacity_btu)
          return (
            <div className="text-sm">
              <div className="font-medium">{brand}</div>
              {(u.model_number || btu) && (
                <div className="text-xs text-muted-foreground">
                  {[u.model_number, btu].filter(Boolean).join(' • ')}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'last_service',
        header: 'Service Terakhir',
        accessorFn: (row) => row.last_service_date ?? '',
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDateOrDash(row.original.last_service_date)}
          </span>
        ),
      },
      {
        id: 'next_service',
        header: 'Service Berikutnya',
        accessorFn: (row) => row.next_service_due_date ?? '',
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDateOrDash(row.original.next_service_due_date)}
          </span>
        ),
      },
      {
        id: 'days_until',
        header: 'Sisa Hari',
        accessorFn: (row) => {
          const d = daysBetween(row.next_service_due_date)
          // Sort: nulls last, otherwise ascending (overdue first)
          return d ?? Number.POSITIVE_INFINITY
        },
        cell: ({ row }) => (
          <RemainingDaysBadge
            days={daysBetween(row.original.next_service_due_date)}
          />
        ),
      },
      {
        id: 'reminder_status',
        header: 'Status Reminder',
        accessorFn: (row) => (row.has_pending_reminder ? 1 : 0),
        cell: ({ row }) => {
          if (row.original.has_pending_reminder) {
            return (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              >
                Sudah ada antrian
              </Badge>
            )
          }
          return <span className="text-muted-foreground">—</span>
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original
          const isCreating =
            createMutation.isPending &&
            createMutation.variables === u.ac_unit_id
          return (
            <div className="flex justify-end gap-2">
              {!u.has_pending_reminder && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => createMutation.mutate(u.ac_unit_id)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <BellPlus className="mr-2 h-3 w-3" />
                  )}
                  Buat Reminder
                </Button>
              )}
              {u.customer_id && (
                <Button asChild size="sm" variant="ghost">
                  <Link
                    href={`/dashboard/manajemen/customer/${u.customer_id}?tab=ac-units`}
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Detail
                  </Link>
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [createMutation]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.ac_unit_id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  // -- Render ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total AC Dimonitor"
          value={stats.total}
          icon={<Snowflake className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          isLoading={isLoading}
          tone="danger"
        />
        <StatCard
          title="Jatuh Tempo Minggu Ini"
          value={stats.dueThisWeek}
          icon={<CalendarClock className="h-4 w-4 text-orange-500" />}
          isLoading={isLoading}
          tone="warning"
        />
        <StatCard
          title="Aktif Reminder"
          value={stats.activeReminders}
          icon={<CheckCircle2 className="h-4 w-4 text-amber-500" />}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer, lokasi, brand, atau model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as ServicedAcStatusFilter)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="due_soon">Jatuh Tempo (≤7 hari)</SelectItem>
                <SelectItem value="upcoming">Mendatang</SelectItem>
                <SelectItem value="no_date">Belum ada jadwal</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    !dateFrom && 'text-muted-foreground',
                    'min-w-[120px]'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom
                    ? format(dateFrom, 'd MMM', { locale: localeId })
                    : 'Dari'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    !dateTo && 'text-muted-foreground',
                    'min-w-[120px]'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo
                    ? format(dateTo, 'd MMM', { locale: localeId })
                    : 'Sampai'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={Snowflake}
                title="Tidak ada AC yang cocok"
                description="Coba ubah filter pencarian atau reset filter."
                action={{ label: 'Reset Filter', onClick: clearFilters, icon: X }}
              />
            ) : (
              <EmptyState
                icon={Wrench}
                title="Belum ada AC yang pernah di-service"
                description="AC akan muncul di sini setelah teknisi menyelesaikan service report dan mengisi tanggal service berikutnya."
              />
            )
          ) : (
            <div className="data-table-container overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id}>
                          {h.isPlaceholder
                            ? null
                            : flexRender(
                                h.column.columnDef.header,
                                h.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan {table.getRowModel().rows.length} dari {filtered.length}{' '}
            unit AC
            {isFetching && ' • memuat ulang...'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

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

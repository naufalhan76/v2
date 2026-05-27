'use client'

import { useMemo, useState } from 'react'
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
import { format, isToday, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  BellRing,
  CalendarIcon,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'

import {
  getCustomerReminders,
  markReminderSent,
  markReminderDismissed,
} from '@/lib/actions/reminders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
// Types
// =============================================================================

type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'DISMISSED'
type ReminderChannel = 'WHATSAPP' | 'EMAIL'

interface ReminderRow {
  reminder_id: string
  customer_id: string | null
  ac_unit_id: string | null
  service_report_id: string | null
  rule_id: string | null
  due_date: string
  channel: ReminderChannel
  recipient: string
  message: string
  status: ReminderStatus
  sent_at: string | null
  external_id: string | null
  error_message: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers?: {
    customer_id: string
    customer_name: string
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
  } | null
  ac_units?: {
    ac_unit_id: string
    brand?: string | null
    model_number?: string | null
    ac_brands?: { name: string } | null
  } | null
}

const STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu',
  SENT: 'Terkirim',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
  DISMISSED: 'Diabaikan',
}

const STATUS_VARIANT: Record<
  ReminderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  DISMISSED: 'outline',
}

interface QueueTabProps {
  /** Triggered when the queue's empty-state CTA is clicked. */
  onGenerate: () => void
  /** Whether a queue generation is currently running. */
  isGenerating: boolean
}

// =============================================================================
// Component
// =============================================================================

export function QueueTab({ onGenerate, isGenerating }: QueueTabProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | ReminderStatus>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  // -- Data --------------------------------------------------------------------

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customer-reminders'],
    queryFn: async () => {
      const result = await getCustomerReminders({ limit: 500 })
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal memuat reminder')
      }
      const payload = (result as { data?: { reminders?: ReminderRow[] } }).data
      return (payload?.reminders ?? []) as ReminderRow[]
    },
  })

  const reminders = useMemo(() => data ?? [], [data])

  // -- Stats -------------------------------------------------------------------

  const stats = useMemo(() => {
    let pending = 0
    let sentToday = 0
    let failed = 0
    for (const r of reminders) {
      if (r.status === 'PENDING') pending++
      if (r.status === 'FAILED') failed++
      if (r.status === 'SENT' && r.sent_at) {
        try {
          if (isToday(parseISO(r.sent_at))) sentToday++
        } catch {
          // ignore parse error
        }
      }
    }
    return { pending, sentToday, failed }
  }, [reminders])

  // -- Filtered rows -----------------------------------------------------------

  const filteredReminders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reminders.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false

      if (dateFrom) {
        if (new Date(r.due_date) < startOfDay(dateFrom)) return false
      }
      if (dateTo) {
        if (new Date(r.due_date) > endOfDay(dateTo)) return false
      }

      if (q) {
        const customerName = r.customers?.customer_name?.toLowerCase() ?? ''
        const contact = r.customers?.primary_contact_person?.toLowerCase() ?? ''
        const recipient = r.recipient?.toLowerCase() ?? ''
        if (
          !customerName.includes(q) &&
          !contact.includes(q) &&
          !recipient.includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [reminders, statusFilter, search, dateFrom, dateTo])

  const hasFilters =
    statusFilter !== 'all' || !!search || !!dateFrom || !!dateTo

  function clearFilters() {
    setStatusFilter('all')
    setSearch('')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  // -- Mutations ---------------------------------------------------------------

  const sendMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderSent(reminderId)
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal menandai reminder terkirim')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({
        title: 'Reminder ditandai terkirim',
        description:
          'Implementasi pengiriman WhatsApp/Email aktual akan ditambahkan kemudian.',
      })
    },
    onError: (error: Error) => {
      logger.error('markReminderSent failed:', error)
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderDismissed(reminderId)
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal mengabaikan reminder')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({ title: 'Reminder diabaikan' })
    },
    onError: (error: Error) => {
      logger.error('markReminderDismissed failed:', error)
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkSendMutation = useMutation({
    mutationFn: async (reminderIds: string[]) => {
      const results = await Promise.allSettled(
        reminderIds.map((id) => markReminderSent(id))
      )
      const ok = results.filter(
        (r) => r.status === 'fulfilled' && r.value?.success
      ).length
      const failed = reminderIds.length - ok
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      setRowSelection({})
      toast({
        title: `${ok} reminder ditandai terkirim`,
        description:
          failed > 0
            ? `${failed} gagal. Implementasi pengiriman aktual akan ditambahkan kemudian.`
            : 'Implementasi pengiriman WhatsApp/Email aktual akan ditambahkan kemudian.',
        variant: failed > 0 ? 'destructive' : 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // -- Table -------------------------------------------------------------------

  const columns: ColumnDef<ReminderRow>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Pilih semua"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Pilih baris"
            disabled={row.original.status !== 'PENDING'}
          />
        ),
        enableSorting: false,
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const c = row.original.customers
          return (
            <div className="text-sm">
              <div className="font-medium">{c?.customer_name ?? '-'}</div>
              {c?.primary_contact_person && (
                <div className="text-xs text-muted-foreground">
                  {c.primary_contact_person}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'ac_unit',
        header: 'Unit AC',
        cell: ({ row }) => {
          const u = row.original.ac_units
          if (!u) return <span className="text-muted-foreground">-</span>
          const brand = u.ac_brands?.name || u.brand
          return (
            <div className="text-sm">
              <div>{brand ?? '-'}</div>
              {u.model_number && (
                <div className="text-xs text-muted-foreground">
                  {u.model_number}
                </div>
              )}
            </div>
          )
        },
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'due_date',
        header: 'Jatuh Tempo',
        cell: ({ row }) => {
          const d = row.original.due_date
          if (!d) return '-'
          try {
            return (
              <span className="text-sm">
                {format(parseISO(d), 'd MMM yyyy', { locale: localeId })}
              </span>
            )
          } catch {
            return d
          }
        },
      },
      {
        accessorKey: 'channel',
        header: 'Channel',
        cell: ({ row }) => {
          const ch = row.original.channel
          return (
            <Badge variant="outline" className="gap-1">
              {ch === 'WHATSAPP' ? (
                <MessageCircle className="h-3 w-3" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              {ch === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
            </Badge>
          )
        },
        enableSorting: false,
        meta: { className: 'hidden md:table-cell' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          return (
            <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABELS[s]}</Badge>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const isSending =
            sendMutation.isPending && sendMutation.variables === r.reminder_id
          const isDismissing =
            dismissMutation.isPending &&
            dismissMutation.variables === r.reminder_id

          return (
            <div className="flex justify-end gap-1 sm:gap-2">
              {r.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => sendMutation.mutate(r.reminder_id)}
                  disabled={isSending}
                  className="min-h-[44px] sm:min-h-9"
                >
                  {isSending ? (
                    <Loader2 className="h-3 w-3 animate-spin sm:mr-2" />
                  ) : (
                    <Send className="h-3 w-3 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Kirim</span>
                </Button>
              )}
              {(r.status === 'PENDING' || r.status === 'FAILED') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissMutation.mutate(r.reminder_id)}
                  disabled={isDismissing}
                  className="min-h-[44px] sm:min-h-9"
                >
                  {isDismissing ? (
                    <Loader2 className="h-3 w-3 animate-spin sm:mr-2" />
                  ) : (
                    <X className="h-3 w-3 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Abaikan</span>
                </Button>
              )}
            </div>
          )
        },
        enableSorting: false,
      },
    ],
    [sendMutation, dismissMutation]
  )

  const table = useReactTable({
    data: filteredReminders,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.reminder_id,
    enableRowSelection: (row) => row.original.status === 'PENDING',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  // -- Render ------------------------------------------------------------------

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          title="Menunggu"
          value={stats.pending}
          icon={<BellRing className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Terkirim Hari Ini"
          value={stats.sentToday}
          icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Gagal"
          value={stats.failed}
          icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer, kontak, atau nomor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as 'all' | ReminderStatus)
                }
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="PENDING">Menunggu</SelectItem>
                  <SelectItem value="SENT">Terkirim</SelectItem>
                  <SelectItem value="FAILED">Gagal</SelectItem>
                  <SelectItem value="DISMISSED">Diabaikan</SelectItem>
                  <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      !dateFrom && 'text-muted-foreground',
                      'w-full sm:min-w-[120px]'
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
                      'w-full sm:min-w-[120px]'
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="col-span-2 sm:col-span-1"
                >
                  <X className="mr-1 h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar — sticky bottom on mobile */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:rounded-lg sm:border sm:bg-muted/40 sm:px-3 sm:py-2 sm:backdrop-blur-none">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} reminder dipilih
            </p>
            <Button
              size="sm"
              onClick={() => bulkSendMutation.mutate(selectedIds)}
              disabled={bulkSendMutation.isPending}
              className="min-h-[44px] sm:min-h-9"
            >
              {bulkSendMutation.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              Kirim Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredReminders.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title={
                hasFilters
                  ? 'Tidak ada reminder yang cocok'
                  : 'Belum ada reminder'
              }
              description={
                hasFilters
                  ? 'Coba ubah filter pencarian atau reset filter.'
                  : 'Klik "Generate Reminder" untuk membuat reminder dari jadwal service AC.'
              }
              action={
                hasFilters
                  ? { label: 'Reset Filter', onClick: clearFilters, icon: X }
                  : {
                      label: isGenerating ? 'Memproses...' : 'Generate Reminder',
                      onClick: onGenerate,
                      icon: Sparkles,
                    }
              }
            />
          ) : (
            <div className="data-table-container overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => {
                        const meta = h.column.columnDef.meta as
                          | { className?: string }
                          | undefined
                        return (
                          <TableHead key={h.id} className={meta?.className}>
                            {h.isPlaceholder
                              ? null
                              : flexRender(
                                  h.column.columnDef.header,
                                  h.getContext()
                                )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as
                          | { className?: string }
                          | undefined
                        return (
                          <TableCell key={cell.id} className={meta?.className}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredReminders.length > 0 && (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Menampilkan {table.getRowModel().rows.length} dari{' '}
            {filteredReminders.length} reminder
            {isFetching && ' • memuat ulang...'}
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex-1 sm:flex-none"
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex-1 sm:flex-none"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      {/* Spacer when sticky bulk bar is visible on mobile */}
      {selectedIds.length > 0 && <div className="h-16 sm:hidden" />}
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
}: {
  title: string
  value: number
  icon: React.ReactNode
  isLoading: boolean
}) {
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
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Helpers
// =============================================================================

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

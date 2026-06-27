'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type SortingState, type RowSelectionState } from '@tanstack/react-table'
import { isToday, parseISO } from 'date-fns'
import { BellRing, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react'

import { getCustomerReminders } from '@/lib/actions/reminders'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReminderRow } from '@/types/reminders'
import { QueueTable } from './queue-table'
import { QueueFilters } from './queue-filters'
import { useReminderQueueMutations } from './queue-actions'

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

function StatCard({ title, value, icon, isLoading }: { title: string; value: number; icon: React.ReactNode; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  )
}

interface QueueTabProps {
  onGenerate: () => void
  isGenerating: boolean
}

export function QueueTab({ onGenerate, isGenerating }: QueueTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ReminderRow['status']>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [page, setPage] = useState(0)

  useEffect(() => { setRowSelection({}) }, [statusFilter, search, dateFrom, dateTo, page])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customer-reminders'],
    queryFn: async () => {
      const result = await getCustomerReminders({ limit: 500 })
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat reminder')
      return ((result as { data?: { reminders?: ReminderRow[] } }).data?.reminders ?? []) as ReminderRow[]
    },
  })

  const reminders = useMemo(() => data ?? [], [data])

  const stats = useMemo(() => {
    let pending = 0, sentToday = 0, failed = 0
    for (const r of reminders) {
      if (r.status === 'PENDING') pending++
      if (r.status === 'FAILED') failed++
      if (r.status === 'SENT' && r.sent_at) {
        try { if (isToday(parseISO(r.sent_at))) sentToday++ } catch {}
      }
    }
    return { pending, sentToday, failed }
  }, [reminders])

  const filteredReminders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reminders.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (dateFrom && new Date(r.due_date) < startOfDay(dateFrom)) return false
      if (dateTo && new Date(r.due_date) > endOfDay(dateTo)) return false
      if (q) {
        const fields = [r.customers?.customer_name, r.customers?.primary_contact_person, r.recipient]
          .map((v) => v?.toLowerCase() ?? '')
        if (!fields.some((f) => f.includes(q))) return false
      }
      return true
    })
  }, [reminders, statusFilter, search, dateFrom, dateTo])

  const hasFilters = statusFilter !== 'all' || !!search || !!dateFrom || !!dateTo
  const clearFilters = () => { setStatusFilter('all'); setSearch(''); setDateFrom(undefined); setDateTo(undefined) }

  const { sendMutation, dismissMutation, bulkSendMutation } = useReminderQueueMutations({
    onBulkComplete: () => setRowSelection({}),
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="Menunggu" value={stats.pending} icon={<BellRing className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Terkirim Hari Ini" value={stats.sentToday} icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Gagal" value={stats.failed} icon={<XCircle className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent>
          <QueueFilters
            statusFilter={statusFilter} onStatusChange={setStatusFilter}
            search={search} onSearchChange={setSearch}
            dateFrom={dateFrom} onDateFromChange={setDateFrom}
            dateTo={dateTo} onDateToChange={setDateTo}
            hasFilters={hasFilters} onClearFilters={clearFilters}
          />
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 py-3 sm:static sm:rounded-lg sm:border sm:bg-muted/40 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{selectedIds.length} reminder dipilih</p>
            <Button size="sm" onClick={() => bulkSendMutation.mutate(selectedIds)} disabled={bulkSendMutation.isPending || selectedIds.length === 0} className="min-h-[44px] sm:min-h-9">
              {bulkSendMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
              Tandai Terkirim Terpilih ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      <QueueTable
        data={filteredReminders} sorting={sorting} onSortingChange={setSorting}
        rowSelection={rowSelection} onRowSelectionChange={setRowSelection}
        sendMutation={sendMutation} dismissMutation={dismissMutation}
        onSend={sendMutation.mutate} onDismiss={dismissMutation.mutate}
        isLoading={isLoading} isFetching={isFetching} filteredReminders={filteredReminders}
        hasFilters={hasFilters} clearFilters={clearFilters}
        onGenerate={onGenerate} isGenerating={isGenerating}
      />

      {selectedIds.length > 0 && <div className="h-16 sm:hidden" />}
    </div>
  )
}

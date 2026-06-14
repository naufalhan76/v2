'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'
import { getOrders } from '@/lib/actions/orders'
import { type OrderForDisplay } from '@/lib/order-utils'
import { datedCsvFilename, downloadCsv, type CsvColumn } from '@/lib/csv-export'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { OrderHistoryTable } from './_components/order-history-table'
import { OrderHistoryFilters } from './_components/order-history-filters'

const PAGE_SIZE = 20
const ORDER_HISTORY_CSV_COLUMNS: CsvColumn<OrderForDisplay>[] = [
  { header: 'Order ID', value: (order) => order.order_id },
  { header: 'Pelanggan', value: (order) => order.customers?.customer_name },
  { header: 'Layanan Utama', value: (order) => order.order_items?.[0]?.service_type ?? '' },
  { header: 'Status', value: (order) => order.status },
  { header: 'Teknisi Lead', value: (order) => '' },
  { header: 'Tanggal Kunjungan', value: (order) => order.scheduled_visit_date ?? order.req_visit_date },
  { header: 'Alamat', value: (order) => order.order_items?.[0]?.locations?.full_address ?? '' },
]

export default function OrderHistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState<string>(searchParams.get('dateTo') ?? '')
  const [page, setPage] = useState(1)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const statusFilter = searchParams.get('status') ?? 'all'
  const queryKey = ['orders', 'history', statusFilter, dateFrom, dateTo, page]

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const statuses = statusFilter === 'all' ? 'COMPLETED,INVOICED,PAID,CANCELLED' : statusFilter
      return getOrders({ statusIn: statuses, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit: PAGE_SIZE, withCount: true })
    },
    staleTime: 30 * 1000,
  })

  const orders = useMemo(() => (data?.data ?? []) as unknown as OrderForDisplay[], [data])
  const totalCount = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter((o: OrderForDisplay) => {
      const customer = typeof o.customers === 'object' && o.customers !== null ? (o.customers as { customer_name?: string | null }).customer_name ?? '' : ''
      const orderId = o.order_id ?? ''
      const address = o.order_items?.[0]?.locations?.full_address ?? ''
      const serviceType = o.order_items?.[0]?.service_type ?? ''
      return customer.toLowerCase().includes(q) || orderId.toLowerCase().includes(q) || address.toLowerCase().includes(q) || serviceType.toLowerCase().includes(q)
    })
  }, [orders, search])

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set('q', search); else params.delete('q')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [search, searchParams, router])

  const handleDateFromChange = (date: Date | undefined) => {
    const str = date ? format(date, 'yyyy-MM-dd') : ''
    setDateFrom(str)
    const params = new URLSearchParams(searchParams.toString())
    if (str) params.set('dateFrom', str); else params.delete('dateFrom')
    params.set('page', '1'); router.replace(`?${params.toString()}`, { scroll: false }); setPage(1)
  }

  const handleDateToChange = (date: Date | undefined) => {
    const str = date ? format(date, 'yyyy-MM-dd') : ''
    setDateTo(str)
    const params = new URLSearchParams(searchParams.toString())
    if (str) params.set('dateTo', str); else params.delete('dateTo')
    params.set('page', '1'); router.replace(`?${params.toString()}`, { scroll: false }); setPage(1)
  }

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === 'all') params.delete('status'); else params.set('status', status)
    params.set('page', '1'); router.replace(`?${params.toString()}`, { scroll: false }); setPage(1)
  }

  const handleExportCsv = () => {
    try {
      downloadCsv(datedCsvFilename('order-history'), filteredOrders, ORDER_HISTORY_CSV_COLUMNS)
      toast({ title: 'Export CSV berhasil', description: `${filteredOrders.length} order diexport.` })
    } catch { toast({ variant: 'destructive', title: 'Export CSV gagal' }) }
  }

  const statusOptions = [
    { value: 'all', label: 'Semua Status', count: totalCount },
    { value: 'COMPLETED', label: 'Selesai' },
    { value: 'INVOICED', label: 'Ditagih' },
    { value: 'PAID', label: 'Lunas' },
    { value: 'CANCELLED', label: 'Dibatalkan' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link href="/dashboard/orders"><ArrowLeft className="h-4 w-4 mr-1" />Orders</Link>
            </Button>
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">Order History</h1>
          <p className="text-sm text-muted-foreground">Semua order yang telah selesai, ditagih, lunas, atau dibatalkan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isLoading || filteredOrders.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPage(1); queryClient.invalidateQueries({ queryKey: ['orders', 'history'] }) }} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isFetching && 'animate-spin')} />Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((opt) => (
          <button key={opt.value} onClick={() => handleStatusChange(opt.value)} className={cn(
            'px-3 py-1.5 rounded-full text-xs font-bold transition-colors border',
            statusFilter === opt.value || (opt.value === 'all' && !statusFilter)
              ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}>
            {opt.label}{opt.count !== undefined && <span className="ml-1.5 tabular-nums">{opt.count}</span>}
          </button>
        ))}
      </div>

      <OrderHistoryFilters
        search={search} onSearchChange={setSearch} onSearchSubmit={handleSearch}
        onSearchClear={() => { setSearch(''); handleSearch() }}
        dateFrom={dateFrom} onDateFromChange={handleDateFromChange}
        dateTo={dateTo} onDateToChange={handleDateToChange}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Tidak ada order</h3>
          <p className="text-sm text-muted-foreground">Tidak ada order history yang sesuai dengan filter</p>
        </div>
      ) : (
        <OrderHistoryTable orders={filteredOrders} onRowClick={(id) => { setDetailOrderId(id); setDetailOpen(true) }} />
      )}

      {!isLoading && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages} ({totalCount} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Sebelumnya</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Selanjutnya</Button>
          </div>
        </div>
      )}

      <OrderDetailPanel orderId={detailOrderId} open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailOrderId(null) }} />
    </div>
  )
}

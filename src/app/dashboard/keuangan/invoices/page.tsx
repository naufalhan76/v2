'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Plus,
  ChevronDown,
  Eye,
  Receipt,
  FileText,
  Search,
  DollarSign,
  Clock,
  AlertCircle,
} from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { useToast } from '@/hooks/use-toast'
import { getInvoices, getInvoiceStats, type Invoice } from '@/lib/actions/invoices'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { logger } from '@/lib/logger'
import { formatPhone } from '@/lib/utils'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'

const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')

const getInvoiceSourceVariant = (source?: Invoice['source']) => (source === 'BLANK' ? 'secondary' : 'default')

export default function InvoicesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [invoicesBase, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    partialPaid: 0,
    paid: 0,
    overdue: 0,
    totalRevenue: 0,
    unpaidAmount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ORDER_LINKED' | 'BLANK'>('all')

  const handleStatusFilterChange = (value: string) => setStatusFilter(value)
  const handlePaymentFilterChange = (value: string) => setPaymentFilter(value)
  const handleSourceFilterChange = (value: string) => {
    if (value === 'all' || value === 'ORDER_LINKED' || value === 'BLANK') {
      setSourceFilter(value)
    }
  }

  const invoicesFiltered = useMemo(() => {
    if (sourceFilter === 'all') {
      return invoicesBase
    }

    return invoicesBase.filter((invoice) => {
      if (sourceFilter === 'BLANK') {
        return invoice.source === 'BLANK'
      }

      if (sourceFilter === 'ORDER_LINKED') {
        return invoice.source !== 'BLANK'
      }

      return true
    })
  }, [invoicesBase, sourceFilter])

  // Apply sorting
  const { sortedData: invoicesSorted, sortConfig, requestSort } = useSortableTable(invoicesFiltered as unknown as Record<string, unknown>[], {
    key: 'invoice_number',
    direction: 'desc'
  })
  const invoices = invoicesSorted as unknown as Invoice[]

  useEffect(() => {
    loadInvoices()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter])

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      const result = await getInvoices({
        status: statusFilter !== 'ALL' && statusFilter !== 'OVERDUE' ? statusFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        search: searchQuery || undefined,
      })
      const filteredInvoices = statusFilter === 'OVERDUE'
        ? result.data.filter(invoice => (invoice.computed_status ?? invoice.status) === 'OVERDUE')
        : result.data
      setInvoices(filteredInvoices)
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data invoice',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await getInvoiceStats()
      setStats(data)
    } catch (error) {
      logger.error('Error loading stats:', error)
    }
  }

  const handleSearch = () => {
    loadInvoices()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleCreateInvoice = (path: '/dashboard/keuangan/invoices/create' | '/dashboard/keuangan/invoices/create-blank') => {
    router.push(path)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice</h1>
          <p className="text-muted-foreground">Kelola dan monitor invoice pelanggan</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Buat Invoice
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={() => handleCreateInvoice('/dashboard/keuangan/invoices/create')}>
              Buat Invoice (Transaksi)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreateInvoice('/dashboard/keuangan/invoices/create-blank')}>
              Buat Invoice Kosong
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.draft} draft, <span data-testid="stats-terkirim">{stats.sent + stats.paid + stats.partialPaid + stats.overdue}</span> terkirim
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{stats.paid} invoice dibayar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Dibayar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.unpaidAmount)}</div>
            <p className="text-xs text-muted-foreground">Total piutang</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stats-overdue">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Invoice jatuh tempo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari invoice number atau customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              options={[
                { id: 'ALL', label: 'Semua Status' },
                { id: 'DRAFT', label: 'Draft' },
                { id: 'SENT', label: 'Terkirim' },
                { id: 'PARTIAL_PAID', label: 'Partial Paid' },
                { id: 'PAID', label: 'Dibayar' },
                { id: 'OVERDUE', label: 'Overdue' },
                { id: 'CANCELLED', label: 'Dibatalkan' },
              ]}
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
              placeholder="Status"
              searchPlaceholder="Cari status..."
              className="w-[180px]"
            />
            <SearchableSelect
              options={[
                { id: 'ALL', label: 'Semua Pembayaran' },
                { id: 'UNPAID', label: 'Belum Dibayar' },
                { id: 'PARTIAL', label: 'Dibayar Sebagian' },
                { id: 'PAID', label: 'Lunas' },
              ]}
              value={paymentFilter}
              onValueChange={handlePaymentFilterChange}
              placeholder="Pembayaran"
              searchPlaceholder="Cari pembayaran..."
              className="w-[180px]"
            />
            <Select value={sourceFilter} onValueChange={handleSourceFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sumber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sumber</SelectItem>
                <SelectItem value="ORDER_LINKED">Transaksi</SelectItem>
                <SelectItem value="BLANK">Kosong</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Cari</Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Invoice</CardTitle>
          <CardDescription>{invoices.length} invoice ditemukan</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} columns={10} />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada invoice"
              description="Invoice akan muncul di sini setelah dibuat dari order yang sudah selesai atau secara manual."
              action={{
                label: 'Buat Invoice',
                icon: Plus,
                onClick: () => handleCreateInvoice('/dashboard/keuangan/invoices/create-blank'),
              }}
            />
          ) : (
            <div className="data-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="invoice_number" currentSort={sortConfig} onSort={requestSort}>
                      Invoice Number
                    </SortableTableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Tipe</TableHead>
                    <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                      Customer
                    </SortableTableHead>
                    <SortableTableHead sortKey="invoice_date" currentSort={sortConfig} onSort={requestSort}>
                      Tanggal
                    </SortableTableHead>
                    <SortableTableHead sortKey="due_date" currentSort={sortConfig} onSort={requestSort}>
                      Jatuh Tempo
                    </SortableTableHead>
                    <SortableTableHead sortKey="total_amount" currentSort={sortConfig} onSort={requestSort}>
                      Total
                    </SortableTableHead>
                    <SortableTableHead sortKey="computed_status" currentSort={sortConfig} onSort={requestSort}>
                      Status
                    </SortableTableHead>
                    <SortableTableHead sortKey="payment_status" currentSort={sortConfig} onSort={requestSort}>
                      Pembayaran
                    </SortableTableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const displayStatus = invoice.computed_status ?? invoice.status

                    return (
                    <TableRow key={invoice.invoice_id}>
                      <TableCell className="font-mono font-semibold">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getInvoiceSourceVariant(invoice.source)}>
                          {getInvoiceSourceLabel(invoice.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>
                          {invoice.invoice_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invoice.customers?.customer_name ?? invoice.customer_name_override ?? '—'}
                          </div>
                          {(invoice.customers?.phone_number ?? invoice.customer_phone_override) ? (
                            <div className="text-sm text-muted-foreground">
                              {formatPhone(invoice.customers?.phone_number ?? invoice.customer_phone_override)}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy', {
                          locale: localeId,
                        })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.due_date), 'dd MMM yyyy', {
                          locale: localeId,
                        })}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={displayStatus} data-testid="invoice-status-badge" />
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.payment_status === 'PARTIAL' ? 'PARTIAL_PAID' : invoice.payment_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/keuangan/invoices/${invoice.invoice_id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

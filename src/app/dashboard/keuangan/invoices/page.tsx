'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ChevronDown, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getInvoices, getInvoiceStats } from '@/lib/actions/invoices'
import type { Invoice } from '@/types/invoices'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { InvoiceFilters } from './_components/invoice-filters'
import { InvoicesTable } from './_components/invoices-table'
import { StatsCards } from './_components/invoice-stats'
import { downloadCsv, exportInvoicesToCsv } from './_components/invoice-csv'

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

  const invoicesFiltered = useMemo(() => {
    if (sourceFilter === 'all') return invoicesBase
    return invoicesBase.filter((invoice) =>
      sourceFilter === 'BLANK' ? invoice.source === 'BLANK' : invoice.source !== 'BLANK'
    )
  }, [invoicesBase, sourceFilter])

  const { sortedData: invoicesSorted, sortConfig, requestSort } = useSortableTable(
    invoicesFiltered as unknown as Record<string, unknown>[],
    { key: 'invoice_number', direction: 'desc' }
  )
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
      setInvoices(
        statusFilter === 'OVERDUE'
          ? result.data.filter(invoice => (invoice.computed_status ?? invoice.status) === 'OVERDUE')
          : result.data
      )
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data invoice' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      setStats(await getInvoiceStats())
    } catch {
      // Stats are non-critical; fail silently
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const handleExportCsv = () => {
    try {
      const { filename, columns, data } = exportInvoicesToCsv(invoices)
      downloadCsv(filename, data, columns)
      toast({ title: 'Export CSV berhasil', description: `${invoices.length} invoice diexport.` })
    } catch {
      toast({ variant: 'destructive', title: 'Export CSV gagal' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoice</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Kelola dan monitor invoice pelanggan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={isLoading || invoices.length === 0} className="gap-2 w-full sm:w-auto min-h-[44px]">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto min-h-[44px]">
                <Plus className="h-4 w-4" />
                Buat Invoice
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => router.push('/dashboard/keuangan/invoices/create')}>
                Buat Invoice (Transaksi)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/keuangan/invoices/create-blank')}>
                Buat Invoice Kosong
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} formatCurrency={formatCurrency} />

      {/* Filters */}
      <Card>
        <InvoiceFilters
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={loadInvoices}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          paymentFilter={paymentFilter}
          onPaymentFilterChange={setPaymentFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={(value) => {
            if (value === 'all' || value === 'ORDER_LINKED' || value === 'BLANK') {
              setSourceFilter(value as 'all' | 'ORDER_LINKED' | 'BLANK')
            }
          }}
        />
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Invoice</CardTitle>
          <CardDescription>{invoices.length} invoice ditemukan</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable
            invoices={invoices}
            isLoading={isLoading}
            isEmpty={invoices.length === 0}
            sortConfig={sortConfig}
            requestSort={requestSort}
            formatCurrency={formatCurrency}
            onCreateBlank={() => router.push('/dashboard/keuangan/invoices/create-blank')}
          />
        </CardContent>
      </Card>
    </div>
  )
}

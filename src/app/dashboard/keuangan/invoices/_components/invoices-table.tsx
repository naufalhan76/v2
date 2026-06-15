'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Receipt, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import type { SortConfig } from '@/hooks/use-sortable-table'
import type { Invoice } from '@/types/invoices'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { formatPhone } from '@/lib/utils'

interface InvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
  isEmpty: boolean
  sortConfig: SortConfig
  requestSort: (key: string) => void
  formatCurrency: (amount: number) => string
  onCreateBlank: () => void
}

const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')

const getInvoiceSourceVariant = (source?: Invoice['source']) => (source === 'BLANK' ? 'secondary' : 'default')

export function InvoicesTable({
  invoices,
  isLoading,
  isEmpty,
  sortConfig,
  requestSort,
  formatCurrency,
  onCreateBlank,
}: InvoicesTableProps) {
  const router = useRouter()

  if (isLoading) {
    return <TableSkeleton rows={8} columns={10} />
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={Receipt}
        title="Belum ada invoice"
        description="Invoice akan muncul di sini setelah dibuat dari order yang sudah selesai atau secara manual."
        action={{
          label: 'Buat Invoice',
          icon: Receipt,
          onClick: onCreateBlank,
        }}
      />
    )
  }

  return (
    <>
      {/* Mobile card list (hidden on md+) */}
      <div className="md:hidden space-y-3">
        {invoices.map((invoice) => {
          const displayStatus = invoice.computed_status ?? invoice.status
          return (
            <button
              key={invoice.invoice_id}
              type="button"
              onClick={() =>
                router.push(`/dashboard/keuangan/invoices/${invoice.invoice_id}`)
              }
              className="w-full text-left rounded-lg border bg-card p-3 space-y-2 hover:bg-accent/50 transition-colors min-h-[44px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono font-semibold text-sm break-all">
                  {invoice.invoice_number}
                </div>
                <InvoiceStatusBadge
                  status={displayStatus}
                  size="sm"
                  data-testid="invoice-status-badge"
                />
              </div>
              <div className="text-sm font-medium">
                {invoice.customers?.customer_name ?? invoice.customer_name_override ?? '—'}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId })}
                </span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={getInvoiceSourceVariant(invoice.source)} className="text-[10px]">
                  {getInvoiceSourceLabel(invoice.source)}
                </Badge>
                <Badge
                  variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {invoice.invoice_type}
                </Badge>
                <InvoiceStatusBadge
                  status={invoice.payment_status}
                  size="sm"
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Tablet/desktop table */}
      <div className="hidden md:block data-table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="invoice_number" currentSort={sortConfig} onSort={requestSort}>
                Invoice Number
              </SortableTableHead>
              <TableHead className="hidden xl:table-cell">Sumber</TableHead>
              <TableHead className="hidden lg:table-cell">Tipe</TableHead>
              <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                Customer
              </SortableTableHead>
              <SortableTableHead sortKey="invoice_date" currentSort={sortConfig} onSort={requestSort} className="hidden lg:table-cell">
                Tanggal
              </SortableTableHead>
              <SortableTableHead sortKey="due_date" currentSort={sortConfig} onSort={requestSort} className="hidden xl:table-cell">
                Jatuh Tempo
              </SortableTableHead>
              <SortableTableHead sortKey="total_amount" currentSort={sortConfig} onSort={requestSort}>
                Total
              </SortableTableHead>
              <SortableTableHead sortKey="computed_status" currentSort={sortConfig} onSort={requestSort}>
                Status
              </SortableTableHead>
              <SortableTableHead sortKey="payment_status" currentSort={sortConfig} onSort={requestSort} className="hidden lg:table-cell">
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
                <TableCell className="hidden xl:table-cell">
                  <Badge variant={getInvoiceSourceVariant(invoice.source)}>
                    {getInvoiceSourceLabel(invoice.source)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
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
                <TableCell className="hidden lg:table-cell">
                  {format(new Date(invoice.invoice_date), 'dd MMM yyyy', {
                    locale: localeId,
                  })}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
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
                <TableCell className="hidden lg:table-cell">
                  <InvoiceStatusBadge status={invoice.payment_status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] min-w-[44px]"
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
    </>
  )
}

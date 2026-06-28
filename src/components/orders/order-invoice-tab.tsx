'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { getInvoicesByOrderId, type OrderInvoiceRow } from '@/lib/actions/invoices-queries'
import { toCanonical } from '@/lib/order-status'

interface OrderInvoiceTabProps {
  orderId: string
  orderStatus: string | null
  onCreateInvoice?: () => void
}

export function OrderInvoiceTab({ orderId, orderStatus, onCreateInvoice }: OrderInvoiceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-invoices', orderId],
    queryFn: () => getInvoicesByOrderId(orderId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const canonical = toCanonical(orderStatus)
  const canCreate = canonical === 'COMPLETED'

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada invoice"
        description={
          canCreate
            ? 'Order sudah selesai. Anda bisa membuat invoice sekarang.'
            : 'Invoice akan tersedia setelah order selesai dikerjakan teknisi.'
        }
        action={
          canCreate && onCreateInvoice
            ? { label: 'Buat Invoice', icon: Plus, onClick: onCreateInvoice }
            : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {data.map((inv) => (
        <Card key={inv.invoice_id} className="border-border">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xl font-bold text-foreground">{inv.invoice_number ?? inv.invoice_id}</p>
                <p className="text-base text-muted-foreground">
                  Total: Rp {Number(inv.total_amount).toLocaleString('id-ID')}
                </p>
                {inv.paid_amount != null && Number(inv.paid_amount) > 0 && (
                  <p className="text-base text-muted-foreground">
                    Dibayar: Rp {Number(inv.paid_amount).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <InvoiceStatusBadge status={inv.status} size="sm" />
                {inv.payment_status && (
                  <InvoiceStatusBadge
                    status={inv.payment_status}
                    size="sm"
                  />
                )}
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/keuangan/invoices/${inv.invoice_id}`}>
                <ExternalLink className="mr-2 h-3 w-3" />
                Buka Invoice
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

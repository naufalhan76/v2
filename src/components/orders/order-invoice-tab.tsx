'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { createClient } from '@/lib/supabase-browser'
import { toCanonical } from '@/lib/order-status'

interface OrderInvoiceTabProps {
  orderId: string
  orderStatus: string | null
  onCreateInvoice?: () => void
}

interface InvoiceRow {
  invoice_id: string
  invoice_number?: string | null
  status: string
  total_amount: number
  amount_paid?: number | null
  payment_status?: string | null
  due_date?: string | null
  created_at: string
}

export function OrderInvoiceTab({ orderId, orderStatus, onCreateInvoice }: OrderInvoiceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-invoices', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_id, invoice_number, status, total_amount, amount_paid, payment_status, due_date, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as InvoiceRow[]
    },
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
        <Card key={inv.invoice_id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{inv.invoice_number ?? inv.invoice_id}</p>
                <p className="text-xs text-muted-foreground">
                  Total: Rp {Number(inv.total_amount).toLocaleString('id-ID')}
                </p>
                {inv.amount_paid != null && Number(inv.amount_paid) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Dibayar: Rp {Number(inv.amount_paid).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <InvoiceStatusBadge status={inv.status} size="sm" />
                {inv.payment_status && (
                  <InvoiceStatusBadge
                    status={inv.payment_status === 'PARTIAL' ? 'PARTIAL_PAID' : inv.payment_status}
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

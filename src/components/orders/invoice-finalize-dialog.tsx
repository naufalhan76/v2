'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loader2, AlertTriangle, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatRupiah } from '@/lib/utils'
import { finalizeInvoiceFromOrder } from '@/lib/actions/invoices-order'
import type { OrderInvoiceStatusResponse } from '@/app/api/orders/[id]/invoice-status/route'

interface InvoiceFinalizeDialogProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function fetchInvoiceStatus(orderId: string): Promise<OrderInvoiceStatusResponse> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice-status`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Gagal memuat status invoice')
  return json.data as OrderInvoiceStatusResponse
}

export function InvoiceFinalizeDialog({
  orderId,
  open,
  onOpenChange,
}: InvoiceFinalizeDialogProps) {
  const { toast } = useToast()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['order-invoice-status', orderId],
    queryFn: () => (orderId ? fetchInvoiceStatus(orderId) : Promise.resolve(null)),
    enabled: !!orderId && open,
  })

  useEffect(() => {
    if (!data || !orderId) return
    if (!data.hasExistingInvoice) {
      window.location.href = `/dashboard/keuangan/invoices/create/from-order/${orderId}`
      return
    }
    if (data.invoiceType !== 'PROFORMA' && data.invoiceId) {
      window.location.href = `/dashboard/keuangan/invoices/${data.invoiceId}`
      return
    }
  }, [data, orderId])

  const finalize = useMutation({
    mutationFn: () => {
      if (!orderId) throw new Error('Order ID tidak ditemukan')
      return finalizeInvoiceFromOrder(orderId)
    },
    onSuccess: (result) => {
      toast({ title: 'Invoice berhasil difinalisasi' })
      window.location.href = `/dashboard/keuangan/invoices/${result.invoice_id}`
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Gagal finalisasi invoice',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
  })

  const showFinalize =
    data &&
    data.hasExistingInvoice &&
    data.invoiceType === 'PROFORMA' &&
    data.hasServiceReport &&
    data.materials.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)] p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            Proforma Invoice Tersedia
          </DialogTitle>
          <DialogDescription className="text-xs">
            Order ini sudah memiliki proforma invoice. Material dari laporan teknisi belum
            dimasukkan ke proforma tersebut.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
            {error instanceof Error ? error.message : 'Gagal memuat status invoice'}
          </div>
        )}

        {!isLoading && !isError && data && showFinalize && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Material Teknisi ({data.materials.length})
            </h4>
            <ul className="rounded-md border border-border divide-y divide-border max-h-[40vh] overflow-y-auto">
              {data.materials.map((material, index) => (
                <li key={index} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium truncate">{material.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {material.qty} x {formatRupiah(material.unit_price)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {formatRupiah(material.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLoading && !isError && data && !showFinalize && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-xs text-yellow-700 dark:text-yellow-400">
            Tidak ada material dari laporan teknisi yang perlu difinalisasi.
          </div>
        )}

        <DialogFooter className="flex-col gap-2 pt-2">
          {data?.invoiceId && (
            <Button
              variant="outline"
              asChild
              className="h-10 w-full text-sm"
            >
              <Link href={`/dashboard/keuangan/invoices/${data.invoiceId}`}>
                Buka PROFORMA
              </Link>
            </Button>
          )}
          <Button
            disabled={!showFinalize || finalize.isPending}
            onClick={() => finalize.mutate()}
            className="h-10 w-full text-sm bg-yellow-500 text-white hover:bg-yellow-600"
          >
            {finalize.isPending && <Loader2 className="mr-2 h-4 w-4" />}
            Finalisasi (Ganti PROFORMA)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

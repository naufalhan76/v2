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
  const res = await fetch(`/api/orders/${orderId}/invoice-status`)
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
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Proforma Invoice Tersedia
          </DialogTitle>
          <DialogDescription>
            Order ini sudah memiliki proforma invoice. Material dari laporan teknisi belum
            dimasukkan ke proforma tersebut.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Gagal memuat status invoice'}
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-4">
            {showFinalize && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Material dari Laporan Teknisi
                </h4>
                <ul className="rounded-md border border-border divide-y divide-border text-sm">
                  {data.materials.map((material, index) => (
                    <li key={index} className="flex items-center justify-between p-3">
                      <div className="min-w-0">
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

            {!showFinalize && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                Tidak ada material dari laporan teknisi yang perlu difinalisasi.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            Batal
          </Button>
          {data?.invoiceId && (
            <Button
              variant="outline"
              asChild
              className="h-11 w-full sm:h-9 sm:flex-1"
            >
              <Link href={`/dashboard/keuangan/invoices/${data.invoiceId}`}>
                Buka PROFORMA
              </Link>
            </Button>
          )}
          <Button
            disabled={!showFinalize || finalize.isPending}
            onClick={() => finalize.mutate()}
            className="h-11 w-full sm:h-9 sm:flex-1 bg-yellow-500 text-white hover:bg-yellow-600"
          >
            {finalize.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalisasi (Ganti PROFORMA)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

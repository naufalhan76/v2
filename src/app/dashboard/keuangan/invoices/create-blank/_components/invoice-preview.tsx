'use client'

import { CheckCircle2, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { InvoicePreviewProps } from './types'

export function InvoicePreview({
  createdInvoice,
  onOpenChange,
  onStay,
  onViewDetail,
  formatCurrency,
}: InvoicePreviewProps) {
  return (
    <Dialog open={Boolean(createdInvoice)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto border-0 shadow-2xl">
        {createdInvoice ? (
          <>
            <DialogHeader className="space-y-3 text-center sm:text-left">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-completed-bg text-success sm:mx-0">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Blank invoice berhasil dibuat</DialogTitle>
                <DialogDescription>
                  Ringkasan singkat invoice yang baru dibuat.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold">
                    {createdInvoice.invoice_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {createdInvoice.invoice_type} &bull; {createdInvoice.status}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-right font-medium">
                    {createdInvoice.customers?.customer_name ?? createdInvoice.customer_name_override ?? '\u2014'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Tanggal invoice</span>
                  <span className="font-medium">
                    {new Date(createdInvoice.invoice_date).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Jatuh tempo</span>
                  <span className="font-medium">
                    {new Date(createdInvoice.due_date).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between gap-4 text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(createdInvoice.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={onStay}>
                Tetap di form
              </Button>
              <Button onClick={() => onViewDetail(createdInvoice.invoice_id)} className="text-foreground">
                Lihat Detail Invoice
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

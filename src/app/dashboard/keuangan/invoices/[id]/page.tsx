'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, DollarSign, Trash2, Pencil, AlertCircle, FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { AddressPickerReadOnly } from '@/components/address/address-picker-readonly'
import { TableSkeleton } from '@/components/ui/skeleton'
import { RecordPaymentModal } from '@/components/invoices/record-payment-modal'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { exportInvoiceToPDF } from '@/lib/pdf-export'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { logger } from '@/lib/logger'
import { formatPhone } from '@/lib/utils'
import { useInvoiceDetail } from './_hooks/use-invoice-detail'
import { InvoiceHeader } from './_components/invoice-header'
import { InvoiceItemsTable } from './_components/invoice-items-table'
import { InvoiceActionsBar } from './_components/invoice-actions-bar'
import { InvoiceRevisionForm } from './_components/invoice-revision-form'
import { PaymentHistory } from './_components/payment-history'
import { CommunicationStatsBanner } from './_components/communication-stats-banner'
import { InvoiceSummary, InvoiceRevisionSummary } from './_components/invoice-summary'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><div className="h-7 w-48 rounded bg-muted animate-pulse" /><div className="h-4 w-32 rounded bg-muted animate-pulse" /></div>
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg border bg-card p-3">
            <div className="h-3 w-20 rounded bg-muted animate-pulse mb-2" />
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={4} columns={5} />
    </div>
  )
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    invoiceId, isPrefilledFromReport, invoice, items, payments, orderItemsDetailed,
    invoiceConfig, bankAccounts, communicationStats, isLoading,
    isPaymentDialogOpen, isDeleteDialogOpen, isProcessing,
    isRevisionMode, isSavingRevision, revisionDraft,
    setIsPaymentDialogOpen, setIsDeleteDialogOpen, setIsRevisionMode,
    loadInvoice, handleStatusChange, handleDelete,
    handleEnterRevisionMode, handleCancelRevision,
    updateRevisionField, updateRevisionItem,
    addRevisionItem, removeRevisionItem, handleSaveRevision,
    handleSendWhatsApp, handleSendEmail, formatCurrency,
  } = useInvoiceDetail()

  function handleBack() { if (window.history.length > 1) router.back(); else router.push('/dashboard/keuangan/invoices') }

  const handleExportPDF = async () => {
    if (!invoice) return
    try {
      exportInvoiceToPDF({ invoice, items, payments, invoiceConfig, orderItemsDetailed })
      toast({ title: 'Sukses', description: 'Invoice berhasil di-export ke PDF' })
    } catch (error: unknown) {
      logger.error('Export PDF error:', error)
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Gagal export PDF' })
    }
  }

  if (isLoading) return <LoadingSkeleton />
  if (!invoice) return <div className="text-center py-12"><h3 className="text-lg font-semibold">Invoice tidak ditemukan</h3><Button onClick={handleBack} className="mt-4">Kembali</Button></div>

  const remainingAmount = invoice.total_amount - invoice.paid_amount
  const isBlankInvoice = invoice.source === 'BLANK'
  const customerDisplayName = isBlankInvoice ? invoice.customer_name_override ?? invoice.customers?.customer_name ?? '—' : invoice.customers?.customer_name ?? invoice.customer_name_override ?? '—'
  const customerDisplayPhone = isBlankInvoice ? invoice.customer_phone_override ?? invoice.customers?.phone_number ?? '' : invoice.customers?.phone_number ?? invoice.customer_phone_override ?? ''
  const customerDisplayEmail = isBlankInvoice ? invoice.customer_email_override ?? invoice.customers?.email ?? '' : invoice.customers?.email ?? invoice.customer_email_override ?? ''
  const customerDisplayAddress = isBlankInvoice ? invoice.customer_address_override ?? invoice.customers?.billing_address ?? '' : invoice.customers?.billing_address ?? invoice.customer_address_override ?? ''
  
  const customerLat = isBlankInvoice ? (invoice.customer_lat_override ?? invoice.customers?.lat ?? null) : (invoice.customers?.lat ?? invoice.customer_lat_override ?? null)
  const customerLng = isBlankInvoice ? (invoice.customer_lng_override ?? invoice.customers?.lng ?? null) : (invoice.customers?.lng ?? invoice.customer_lng_override ?? null)

  const displayOrderId = invoice.order_id ?? '—'
  const displayStatus = invoice.computed_status ?? invoice.status
  const revisionHelpMessage = invoice.status === 'PAID' ? 'Invoice telah dibayar — tidak dapat direvisi' : invoice.status === 'OVERDUE' ? 'Invoice melewati jatuh tempo — tidak dapat direvisi' : invoice.status === 'CANCELLED' ? 'Invoice dibatalkan — tidak dapat direvisi' : ''

  return (
    <div className="space-y-6">
      <InvoiceHeader invoice={invoice} isRevisionMode={isRevisionMode} isProcessing={isProcessing} isSavingRevision={isSavingRevision} onBack={handleBack} onSendWhatsApp={handleSendWhatsApp} onSendEmail={handleSendEmail} onExportPDF={handleExportPDF} onEnterRevisionMode={handleEnterRevisionMode} onSaveRevision={handleSaveRevision} onCancelRevision={handleCancelRevision} onDeleteClick={() => setIsDeleteDialogOpen(true)} onStatusChange={handleStatusChange} revisionHelpMessage={revisionHelpMessage} />

      <CommunicationStatsBanner stats={communicationStats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isPrefilledFromReport && (
            <Card className="border-info/30 bg-status-assigned-bg"><CardContent className="pt-6"><div className="flex items-start gap-3"><FileText className="h-5 w-5 text-info mt-0.5" /><div className="space-y-1"><p className="font-semibold text-info">Invoice di-populate dari service report</p><p className="text-sm text-info">Item invoice diambil dari laporan teknisi. Klik <strong>Edit / Revisi</strong> untuk mengubah.</p></div></div></CardContent></Card>
          )}

          {isRevisionMode && (
            <Card className="border-warning/30 bg-status-pending-bg"><CardContent className="pt-6"><div className="flex items-start gap-3"><Pencil className="h-5 w-5 text-warning mt-0.5" /><div className="space-y-1"><p className="font-semibold text-warning">Mode Revisi Aktif</p><p className="text-sm text-warning">Anda sedang mengedit invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span>. Klik <strong>Simpan Revisi</strong> atau <strong>Batal</strong>.</p></div></div></CardContent></Card>
          )}

          {invoice.payment_status === 'PARTIAL_PAID' && remainingAmount > 0 && (
            <Card className="border-warning/30 bg-status-pending-bg"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><AlertCircle className="h-5 w-5 text-warning shrink-0" /><div><p className="text-xs uppercase tracking-wide text-warning">Sisa Tagihan</p><p className="text-xl sm:text-2xl font-bold text-warning">{formatCurrency(remainingAmount)}</p><p className="text-xs text-warning">Sudah dibayar {formatCurrency(invoice.paid_amount)} dari {formatCurrency(invoice.total_amount)}</p></div></div><Button onClick={() => setIsPaymentDialogOpen(true)} className="bg-warning hover:bg-warning/90 w-full sm:w-auto min-h-[44px]"><DollarSign className="mr-2 h-4 w-4" />Catat Pembayaran</Button></CardContent></Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle>Invoice Details</CardTitle><CardDescription>Created {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: localeId })}</CardDescription></div>
                <div className="flex flex-wrap gap-2"><InvoiceStatusBadge status={displayStatus} data-testid="invoice-status-badge" /><InvoiceStatusBadge status={invoice.payment_status} /></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRevisionMode && revisionDraft ? (
                <InvoiceRevisionForm revisionDraft={revisionDraft} invoiceCustomerId={invoice.customer_id} bankAccounts={bankAccounts} formatCurrency={formatCurrency} onUpdateField={updateRevisionField} />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-semibold">{customerDisplayName}</p>
                      <p className="text-sm text-muted-foreground">{customerDisplayPhone ? formatPhone(customerDisplayPhone) : '—'}</p>
                      <p className="mt-1 text-sm text-muted-foreground break-all">{customerDisplayEmail || '—'}</p>
                      <div className="mt-1">
                        <p className="text-sm text-muted-foreground">{customerDisplayAddress || '—'}</p>
                        <AddressPickerReadOnly lat={customerLat} lng={customerLng} />
                      </div>
                    </div>
                    <div><Label className="text-muted-foreground">Order ID</Label><p className="font-mono font-semibold break-all">{displayOrderId}</p></div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground">Invoice Date</Label><p>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId })}</p></div>
                    <div><Label className="text-muted-foreground">Due Date</Label><p>{format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: localeId })}</p></div>
                  </div>
                </div>
              )}
              <Separator className="my-4" />
              {isRevisionMode && revisionDraft ? <InvoiceRevisionSummary revisionDraft={revisionDraft} formatCurrency={formatCurrency} /> : <InvoiceSummary invoice={invoice} remainingAmount={remainingAmount} formatCurrency={formatCurrency} />}
            </CardContent>
          </Card>

          <InvoiceItemsTable items={items} orderItemsDetailed={orderItemsDetailed} isRevisionMode={isRevisionMode} revisionItems={revisionDraft?.items} formatCurrency={formatCurrency} onUpdateRevisionItem={updateRevisionItem} onAddRevisionItem={addRevisionItem} onRemoveRevisionItem={removeRevisionItem} />
          <PaymentHistory payments={payments} totalAmount={invoice.total_amount} formatCurrency={formatCurrency} />
        </div>

        <InvoiceActionsBar invoice={invoice} payments={payments} remainingAmount={remainingAmount} bankAccounts={bankAccounts} formatCurrency={formatCurrency} onStatusChange={handleStatusChange} onRecordPayment={() => setIsPaymentDialogOpen(true)} />
      </div>

      <RecordPaymentModal open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen} invoice={invoice} onSuccess={loadInvoice} />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Hapus Invoice</DialogTitle><DialogDescription>Apakah Anda yakin ingin menghapus invoice <strong>{invoice?.invoice_number}</strong>?<br /><span className="text-destructive font-medium mt-2 block">Tindakan ini tidak dapat dibatalkan.</span></DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isProcessing} className="min-h-[44px]">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isProcessing} className="min-h-[44px]">{isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menghapus...</> : <><Trash2 className="mr-2 h-4 w-4" />Ya, Hapus</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

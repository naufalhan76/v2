import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Invoice } from '@/types/invoices'
import { canReviseInvoice } from '@/lib/invoice-utils'

interface InvoiceHeaderProps {
  invoice: Invoice
  isRevisionMode: boolean
  isProcessing: boolean
  isSavingRevision: boolean
  onBack: () => void
  onSendWhatsApp: () => void
  onSendEmail: () => void
  onExportPDF: () => void
  onEnterRevisionMode: () => void
  onSaveRevision: () => void
  onCancelRevision: () => void
  onDeleteClick: () => void
  onStatusChange: (status: string) => void
  revisionHelpMessage: string
}

const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')
const getInvoiceSourceVariant = (source?: Invoice['source']) => (source === 'BLANK' ? 'secondary' : 'default')

export function InvoiceHeader({
  invoice,
  isRevisionMode,
  isProcessing,
  isSavingRevision,
  onBack,
  onSendWhatsApp,
  onSendEmail,
  onExportPDF,
  onEnterRevisionMode,
  onSaveRevision,
  onCancelRevision,
  onDeleteClick,
  onStatusChange,
  revisionHelpMessage,
}: InvoiceHeaderProps) {
  const displayStatus = invoice.computed_status ?? invoice.status
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        <Button variant="ghost" aria-label="Kembali" onClick={onBack} className="shrink-0 min-h-[44px] min-w-[44px]">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-all">{invoice.invoice_number}</h1>
            <Badge variant={getInvoiceSourceVariant(invoice.source)}>{getInvoiceSourceLabel(invoice.source)}</Badge>
            <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>{invoice.invoice_type}</Badge>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {invoice.invoice_type === 'PROFORMA' ? 'Invoice Proforma' : 'Invoice Final'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onSendWhatsApp}
          disabled={!invoice?.customers?.phone_number || isProcessing}
          className="bg-status-completed-bg hover:bg-status-completed-bg text-success border-success/30 flex-1 sm:flex-initial min-h-[44px]"
        >
          Send WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={onSendEmail}
          disabled={!invoice?.customers?.email || isProcessing}
          className="bg-status-assigned-bg hover:bg-status-assigned-bg text-info border-info/30 flex-1 sm:flex-initial min-h-[44px]"
        >
          {isProcessing ? 'Mengirim...' : 'Send Email'}
        </Button>
        <Button variant="outline" onClick={onExportPDF} disabled={isProcessing} className="flex-1 sm:flex-initial min-h-[44px]">
          Export PDF
        </Button>
        {!isRevisionMode && canReviseInvoice(invoice.status) && (
          <Button
            variant="outline"
            onClick={onEnterRevisionMode}
            disabled={isProcessing}
            className="border-warning/30 text-warning hover:bg-status-pending-bg flex-1 sm:flex-initial min-h-[44px]"
            data-testid="invoice-edit-revisi-button"
          >
            Edit / Revisi
          </Button>
        )}
        {!isRevisionMode && revisionHelpMessage && (
          <p className="w-full sm:w-auto sm:max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
            {revisionHelpMessage}
          </p>
        )}
        {isRevisionMode && (
          <>
            <Button
              onClick={onSaveRevision}
              disabled={isSavingRevision}
              data-testid="invoice-save-revision"
              className="flex-1 sm:flex-initial min-h-[44px]"
            >
              {isSavingRevision ? 'Menyimpan...' : 'Simpan Revisi'}
            </Button>
            <Button
              variant="outline"
              onClick={onCancelRevision}
              disabled={isSavingRevision}
              data-testid="invoice-cancel-revision"
              className="flex-1 sm:flex-initial min-h-[44px]"
            >
              Batal
            </Button>
          </>
        )}
        {!isRevisionMode && invoice.status === 'DRAFT' && (
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            disabled={isProcessing}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            Hapus
          </Button>
        )}
        {!isRevisionMode && invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && (
          <Button
            variant="outline"
            onClick={() => onStatusChange('CANCELLED')}
            disabled={isProcessing}
            className="border-warning/30 text-warning hover:bg-status-pending-bg flex-1 sm:flex-initial min-h-[44px]"
          >
            Cancel Invoice
          </Button>
        )}
      </div>
    </div>
  )
}

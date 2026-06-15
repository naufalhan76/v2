import { Separator } from '@/components/ui/separator'
import type { RevisionDraft } from './revision-utils'

interface InvoiceSummaryProps {
  invoice: { subtotal: number; discount_amount: number; tax_amount: number; tax_percentage: number; total_amount: number; paid_amount: number }
  remainingAmount: number
  formatCurrency: (n: number) => string
}

export function InvoiceSummary({ invoice, remainingAmount, formatCurrency }: InvoiceSummaryProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">{formatCurrency(invoice.subtotal)}</span></div>
      {invoice.discount_amount > 0 && <div className="flex justify-between"><span>Discount:</span><span className="font-semibold text-destructive">- {formatCurrency(invoice.discount_amount)}</span></div>}
      <div className="flex justify-between"><span>Tax ({invoice.tax_percentage}%):</span><span className="font-semibold">{formatCurrency(invoice.tax_amount)}</span></div>
      <Separator />
      <div className="flex justify-between text-lg"><span className="font-bold">Total:</span><span className="font-bold text-primary">{formatCurrency(invoice.total_amount)}</span></div>
      {invoice.paid_amount > 0 && (<>
        <div className="flex justify-between"><span className="text-success">Paid:</span><span className="font-semibold text-success">- {formatCurrency(invoice.paid_amount)}</span></div>
        <div className="flex justify-between text-lg"><span className="font-bold">Remaining:</span><span className="font-bold text-destructive">{formatCurrency(remainingAmount)}</span></div>
      </>)}
    </div>
  )
}

interface InvoiceRevisionSummaryProps {
  revisionDraft: RevisionDraft
  formatCurrency: (n: number) => string
}

export function InvoiceRevisionSummary({ revisionDraft, formatCurrency }: InvoiceRevisionSummaryProps) {
  const subtotal = revisionDraft.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  return (
    <div className="space-y-2">
      <div className="flex justify-between"><span>Estimasi Subtotal:</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
      {revisionDraft.discount_amount > 0 && <div className="flex justify-between"><span>Discount:</span><span className="font-semibold text-destructive">- {formatCurrency(revisionDraft.discount_amount)}</span></div>}
      <div className="flex justify-between"><span>Tax ({revisionDraft.tax_percentage}%):</span><span className="font-semibold">{formatCurrency(subtotal * revisionDraft.tax_percentage / 100)}</span></div>
      <Separator />
      <p className="text-xs text-muted-foreground">Total final akan dihitung ulang server setelah disimpan.</p>
    </div>
  )
}

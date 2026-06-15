import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Separator } from '@/components/ui/separator'
import { DollarSign } from 'lucide-react'
import type { Invoice, PaymentRecord } from '@/types/invoices'
import type { BankAccount } from '@/lib/bank-accounts'

interface InvoiceActionsBarProps {
  invoice: Invoice
  payments: PaymentRecord[]
  remainingAmount: number
  bankAccounts: BankAccount[]
  formatCurrency: (amount: number) => string
  onStatusChange: (status: string) => void
  onRecordPayment: () => void
}

export function InvoiceActionsBar({
  invoice,
  payments,
  remainingAmount,
  bankAccounts,
  formatCurrency,
  onStatusChange,
  onRecordPayment,
}: InvoiceActionsBarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <SearchableSelect
              options={[
                { id: 'DRAFT', label: 'Draft' },
                { id: 'SENT', label: 'Sent' },
                { id: 'PARTIAL_PAID', label: 'Partial Paid' },
                { id: 'PAID', label: 'Paid' },
                { id: 'OVERDUE', label: 'Overdue' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ]}
              value={invoice.status}
              onValueChange={onStatusChange}
              placeholder="Pilih status"
              searchPlaceholder="Cari status..."
            />
          </div>
          <Separator />
          {invoice.payment_status !== 'PAID' && (
            <Button className="w-full" onClick={onRecordPayment}>
              <DollarSign className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Total:</span>
            <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-success">Paid:</span>
            <span className="font-semibold text-success">{formatCurrency(invoice.paid_amount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-semibold">Remaining:</span>
            <span className="font-bold text-destructive">{formatCurrency(remainingAmount)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

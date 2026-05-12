export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

/**
 * Compute whether an invoice should display as OVERDUE based on due date + status.
 * Display-only: callers decide whether to persist or just coerce on render.
 */
export function isOverdue(inv: {
  due_date: string
  status: string
  payment_status: string
}): boolean {
  const today = new Date().toISOString().split('T')[0]

  return (
    inv.due_date < today &&
    inv.status !== 'PAID' &&
    inv.status !== 'CANCELLED' &&
    inv.payment_status !== 'PAID'
  )
}

/**
 * Human-readable label for invoice status badges across list, detail, PDF, and email.
 */
export function getInvoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SENT: 'Sent',
    PARTIAL_PAID: 'Partial Paid',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
    CANCELLED: 'Cancelled',
  }
  return labels[status] || status
}

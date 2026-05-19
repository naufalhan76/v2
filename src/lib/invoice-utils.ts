import type { InvoiceStatus } from '@/lib/invoice-status'

export type InvoiceSource = 'ORDER_LINKED' | 'BLANK'

export const REVISABLE_STATUSES = ['DRAFT', 'SENT'] as const satisfies readonly InvoiceStatus[]

export type RevisableInvoiceStatus = (typeof REVISABLE_STATUSES)[number]

export function canReviseInvoice(status: string): boolean {
  return REVISABLE_STATUSES.includes(status as RevisableInvoiceStatus)
}

export function getInvoiceSource(invoice: {
  order_id?: string | null
  source?: InvoiceSource | null
}): InvoiceSource {
  return invoice.source ?? (invoice.order_id ? 'ORDER_LINKED' : 'BLANK')
}

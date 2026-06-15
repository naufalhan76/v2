// Backward-compatible re-exports.
// All types moved to src/types/invoices.ts.

export type {
  InvoiceStatus,
  InvoiceSource,
  Invoice,
  InvoiceItem,
  PaymentRecord,
  CreateInvoiceInput,
  OrderItemForInvoice,
  InvoiceType,
  InvoiceOrder,
  ReviseInvoiceItemInput,
  InvoiceRevisionHeaderUpdates,
  CreateBlankInvoiceResult,
} from '@/types/invoices'

export { ALLOWED_REVISION_FIELDS } from '@/types/invoices'

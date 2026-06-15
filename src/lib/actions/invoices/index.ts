// Re-export types
export {
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
  type CreateInvoiceInput,
  type OrderItemForInvoice,
  type ReviseInvoiceItemInput,
  type InvoiceRevisionHeaderUpdates,
  type CreateBlankInvoiceResult,
  type InvoiceStatus,
  type InvoiceSource,
  ALLOWED_REVISION_FIELDS,
} from '../invoices-types'

// Re-export queries (detail functions)
export {
  generateInvoiceNumber,
  getInvoiceById,
  getOrderItemsForInvoice,
} from '../invoices-queries'

// Re-export listing
export {
  getInvoices,
  getInvoiceStats,
} from '../invoices-listing'

// Re-export create (createInvoice, createBlankInvoice)
export {
  createInvoice,
  createBlankInvoice,
} from '../invoices-create'

// Re-export order-level creates
export {
  createProformaInvoice,
  createInvoiceFromOrder,
} from '../invoices-order'

// Re-export revision
export {
  updateInvoice,
  reviseInvoiceItems,
  reviseInvoice,
  assertCustomerIsVisibleOrThrow,
  assertCustomerExistsForBlankInvoiceOrThrow,
} from '../invoices-revision'

// Re-export payments
export {
  recordPayment,
  deleteInvoice,
  updateInvoiceStatus,
} from '../invoices-payments'

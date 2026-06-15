import type { Invoice } from '@/types/invoices'
import { datedCsvFilename, downloadCsv, type CsvColumn } from '@/lib/csv-export'

export { downloadCsv } from '@/lib/csv-export'

export const getInvoiceSourceLabel = (source?: Invoice['source']) => (source === 'BLANK' ? 'Kosong' : 'Transaksi')

export const INVOICE_CSV_COLUMNS: CsvColumn<Invoice>[] = [
  { header: 'Nomor Invoice', value: (invoice) => invoice.invoice_number },
  { header: 'Sumber', value: (invoice) => getInvoiceSourceLabel(invoice.source) },
  { header: 'Tipe', value: (invoice) => invoice.invoice_type },
  { header: 'Pelanggan', value: (invoice) => invoice.customers?.customer_name ?? invoice.customer_name_override },
  { header: 'Telepon', value: (invoice) => invoice.customers?.phone_number ?? invoice.customer_phone_override },
  { header: 'Tanggal Invoice', value: (invoice) => invoice.invoice_date },
  { header: 'Jatuh Tempo', value: (invoice) => invoice.due_date },
  { header: 'Total', value: (invoice) => invoice.total_amount },
  { header: 'Status', value: (invoice) => invoice.computed_status ?? invoice.status },
  { header: 'Status Pembayaran', value: (invoice) => invoice.payment_status },
]

export function exportInvoicesToCsv(invoices: Invoice[]) {
  return { filename: datedCsvFilename('invoices'), columns: INVOICE_CSV_COLUMNS, data: invoices }
}

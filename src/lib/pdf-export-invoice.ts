import jsPDF from 'jspdf'
import { Invoice, InvoiceItem, PaymentRecord } from './actions/invoices'
import { InvoiceConfig } from './actions/invoice-config'
import { getInvoiceStatusLabel } from '@/lib/invoice-status'
import { getCompanyInfo } from './pdf-export-utils'
import { renderInvoiceHeader, renderInvoiceDetails } from './pdf-export-invoice-header'
import { renderItemsTable } from './pdf-export-invoice-items'
import { renderSummarySection, renderPaymentInfo, renderTermsAndConditions, renderInvoiceFooter } from './pdf-export-invoice-summary'

export interface PDFExportOptions {
  invoice: Invoice
  items: InvoiceItem[]
  payments: PaymentRecord[]
  invoiceConfig: InvoiceConfig | null
  orderItemsDetailed?: Record<string, unknown>[]
}

export function exportInvoiceToPDF({
  invoice,
  items,
  payments,
  invoiceConfig,
  orderItemsDetailed = [],
}: PDFExportOptions) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  const subtotal = invoice.subtotal
  const tax = invoice.tax_amount
  const totalAmount = invoice.total_amount
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const balanceDue = totalAmount - amountPaid
  const displayStatus = invoice.computed_status ?? invoice.status
  const displayStatusLabel = getInvoiceStatusLabel(displayStatus)
  const customerName = invoice.customers?.customer_name || invoice.customer_name_override || 'N/A'
  const customerPhone = invoice.customers?.phone_number || invoice.customer_phone_override || ''
  const customerEmail = invoice.customers?.email || invoice.customer_email_override || ''
  const company = getCompanyInfo(invoiceConfig)

  yPos = renderInvoiceHeader(pdf, yPos, company, pageWidth, margin)
  yPos = renderInvoiceDetails(
    pdf, yPos, customerName, customerPhone, customerEmail,
    invoice, displayStatus, displayStatusLabel, pageWidth, margin
  )
  yPos = renderItemsTable(
    pdf, yPos, items, orderItemsDetailed, pageWidth, pageHeight, margin
  )
  yPos = renderSummarySection(
    pdf, yPos, invoice, subtotal, tax, amountPaid, balanceDue, company, pageWidth, margin
  )
  yPos = renderPaymentInfo(pdf, yPos, balanceDue, company, pageWidth, margin)
  yPos = renderTermsAndConditions(pdf, yPos, company, pageWidth, pageHeight, margin)
  renderInvoiceFooter(pdf, company, pageWidth, pageHeight, margin)

  pdf.save(`Invoice_${invoice.invoice_number}.pdf`)
}

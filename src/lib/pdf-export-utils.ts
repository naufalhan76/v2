import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { getInvoiceStatusLabel, isOverdue } from './invoice-status'
import type { Invoice } from './actions/invoices'
import type { InvoiceConfig, BankAccount } from './actions/invoice-config'
import { parseBankAccounts } from './bank-accounts'

export type CompanyInfo = ReturnType<typeof getCompanyInfo>

export function getCompanyInfo(invoiceConfig: InvoiceConfig | null) {
  return {
    companyName: invoiceConfig?.company_name || 'AC Service Dashboard',
    companyAddress: invoiceConfig?.company_address || 'Jl. Service No. 123, Jakarta, Indonesia',
    companyPhone: invoiceConfig?.company_phone || '(021) 555-0100',
    companyEmail: invoiceConfig?.company_email || 'info@acservice.com',
    companyWebsite: invoiceConfig?.company_website || null,
    npwp: invoiceConfig?.npwp || null,
    termsTemplate: invoiceConfig?.terms_conditions_template || null,
    taxPercentage: invoiceConfig?.default_tax_percentage ?? 11,
    bankAccounts: parseBankAccounts(invoiceConfig?.bank_accounts) as BankAccount[],
  }
}

export function getInvoiceDisplayStatus(invoice: { status: string; due_date: string; payment_status: string }) {
  return isOverdue(invoice) ? 'OVERDUE' : invoice.status
}

export function getInvoiceDisplayStatusLabel(invoice: Invoice) {
  return getInvoiceStatusLabel(getInvoiceDisplayStatus(invoice))
}

export function formatInvoiceCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatInvoiceDate(date: string) {
  return format(new Date(date), 'dd MMM yyyy', { locale: localeId })
}

export function getInvoiceCustomerInfo(invoice: Invoice) {
  return {
    customerName: invoice.customers?.customer_name || invoice.customer_name_override || 'N/A',
    customerPhone: invoice.customers?.phone_number || invoice.customer_phone_override || '',
    customerEmail: invoice.customers?.email || invoice.customer_email_override || '',
  }
}

export function computeInvoiceTotals(invoice: Invoice, payments: { amount: number }[]) {
  const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  return {
    subtotal: invoice.subtotal,
    tax: invoice.tax_amount,
    totalAmount: invoice.total_amount,
    amountPaid,
    balanceDue: invoice.total_amount - amountPaid,
  }
}

export function validateSenderEmail(email: string): string {
  const invalidDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com']
  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (invalidDomains.includes(emailDomain)) {
    return 'noreply@yaleya.biz.id'
  }
  return email
}

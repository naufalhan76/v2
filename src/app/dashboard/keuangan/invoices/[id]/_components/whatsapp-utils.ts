import type { Invoice, InvoiceItem } from '@/types/invoices'
import type { InvoiceConfig } from '@/lib/actions/invoice-config'
import { parseBankAccounts } from '@/lib/bank-accounts'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const formatBankAccountLine = (account: { account_label: string; bank: string; account_number: string; account_name: string }) =>
  `${account.account_label} — ${account.bank} / ${account.account_number} / a/n ${account.account_name}`

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

interface WhatsAppMessageParams {
  invoice: Invoice
  items: InvoiceItem[]
  invoiceConfig: InvoiceConfig
}

export function generateWhatsAppMessage({ invoice, items, invoiceConfig }: WhatsAppMessageParams): string {
  const companyName = invoiceConfig.company_name || 'AC Service Dashboard'
  const customerName = invoice.customers?.customer_name || 'Customer'
  const invoiceNumber = invoice.invoice_number
  const invoiceDate = format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: localeId })
  const dueDate = format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: localeId })
  const totalAmount = formatCurrency(invoice.total_amount)
  const balanceDue = formatCurrency(invoice.total_amount - invoice.paid_amount)

  let message = `Halo ${customerName},\n\n`
  message += `Terima kasih telah menggunakan layanan *${companyName}*.\n\n`
  message += `Berikut adalah invoice untuk layanan yang telah kami berikan:\n\n`
  message += `📄 *INVOICE DETAILS*\n`
  message += `• No. Invoice: *${invoiceNumber}*\n`
  message += `• Tanggal: ${invoiceDate}\n`
  message += `• Jatuh Tempo: ${dueDate}\n`
  message += `• Total Tagihan: *${totalAmount}*\n`
  if (invoice.paid_amount > 0) {
    message += `• Sudah Dibayar: ${formatCurrency(invoice.paid_amount)}\n`
    message += `• Sisa Tagihan: *${balanceDue}*\n`
  }
  message += `\n📋 *RINCIAN LAYANAN*\n`
  items.slice(0, 5).forEach((item, index) => {
    message += `${index + 1}. ${item.description} (${item.quantity}x) - ${formatCurrency(item.total_price)}\n`
  })
  if (items.length > 5) message += `... dan ${items.length - 5} item lainnya\n`

  const accounts = parseBankAccounts(invoiceConfig.bank_accounts)
  if (accounts.length > 0) {
    message += `\n💳 *PEMBAYARAN*\n`
    message += `Silakan transfer ke salah satu rekening:\n\n`
    accounts.forEach((account, index: number) => {
      message += `${index + 1}. *${formatBankAccountLine(account)}*\n\n`
    })
    message += `_Mohon cantumkan No. Invoice (${invoiceNumber}) dalam keterangan transfer._\n`
  }
  message += `\n---\n`
  message += `Jika ada pertanyaan, silakan hubungi kami.\n\n`
  message += `Terima kasih! 🙏`
  return message
}

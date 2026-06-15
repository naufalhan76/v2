import { Resend } from 'resend'
import { escapeHtml } from '@/lib/utils/html'
import { formatPhone } from '@/lib/utils'
import type { BankAccount } from '@/lib/actions/invoice-config'
import { logger } from '@/lib/logger'

export interface EmailTemplateData {
  invoiceNumber: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerEmail: string
  invoiceDate: string
  dueDate: string
  displayStatusLabel: string
  displayStatus: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyWebsite: string
  bankAccounts: BankAccount[]
  termsConditions: string | null
  items: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>
  subtotal: number
  discountAmount: number
  taxPercentage: number
  taxAmount: number
  amountPaid: number
  balanceDue: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function buildInvoiceEmailHtml(data: EmailTemplateData): string {
  const safe = (v: string) => escapeHtml(v)
  const {
    invoiceNumber, customerName, customerAddress, customerPhone, customerEmail,
    invoiceDate, dueDate, displayStatusLabel, displayStatus, companyName,
    companyAddress, companyPhone, companyEmail, companyWebsite, bankAccounts,
    termsConditions, items, subtotal, discountAmount, taxPercentage, taxAmount,
    amountPaid, balanceDue,
  } = data

  const safeInvoiceNumber = safe(invoiceNumber)
  const safeCustomerName = safe(customerName)
  const safeCustomerAddress = safe(customerAddress)
  const safeCustomerEmail = safe(customerEmail)
  const safeCompanyName = safe(companyName)
  const safeCompanyAddress = safe(companyAddress)
  const safeCompanyPhone = safe(companyPhone)
  const safeCompanyEmail = safe(companyEmail)
  const safeCompanyWebsite = safe(companyWebsite)
  const safeDisplayStatusLabel = safe(displayStatusLabel)
  const safeTermsConditions = safe(termsConditions || '').replace(/\n/g, '<br>')

  const itemsHtml = items
    .map((item, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#fafaf8' : '#ffffff'}; border-bottom: 1px solid #e8e4dd;">
      <td style="padding: 12px; color: #292827; font-size: 14px;">${safe(item.description)}</td>
      <td style="padding: 12px; text-align: center; color: #292827; font-size: 14px;">${item.quantity}</td>
      <td style="padding: 12px; text-align: right; color: #292827; font-size: 14px;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px; text-align: right; color: #292827; font-size: 14px; font-weight: bold;">${formatCurrency(item.total_price)}</td>
    </tr>
  `).join('')

  const bankAccountsHtml = bankAccounts.map((account, index) => `
    <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 6px;">
      <p style="margin: 0 0 5px 0; color: #1b1938; font-size: 15px; font-weight: bold;">${index + 1}. ${safe(account.account_label)}</p>
      <p style="margin: 0 0 3px 0; color: #292827; font-size: 14px;">Bank: <strong>${safe(account.bank)}</strong></p>
      <p style="margin: 0 0 3px 0; color: #292827; font-size: 14px;">No. Rekening: <strong>${safe(account.account_number)}</strong></p>
      <p style="margin: 0; color: #292827; font-size: 14px;">Atas Nama: <strong>${safe(account.account_name)}</strong></p>
      <p style="margin: 4px 0 0 0; color: #292827; font-size: 12px;">PPN ${account.tax_percentage}%</p>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice ${safeInvoiceNumber}</title></head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #fafaf8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf8; padding: 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background-color: #1b1938; padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">INVOICE</h1>
          <p style="margin: 10px 0 0 0; color: #c8c5e0; font-size: 18px;">${safeCompanyName}</p>
        </td></tr>
        <tr><td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <p style="margin: 0 0 5px 0; color: #292827; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Tagihan Kepada</p>
                <p style="margin: 0 0 5px 0; color: #292827; font-size: 18px; font-weight: bold;">${safeCustomerName}</p>
                ${safeCustomerAddress ? `<p style="margin: 0 0 5px 0; color: #292827; font-size: 14px;">${safeCustomerAddress}</p>` : ''}
                ${customerPhone ? `<p style="margin: 0 0 5px 0; color: #292827; font-size: 14px;">${safe(formatPhone(customerPhone))}</p>` : ''}
                <p style="margin: 0; color: #292827; font-size: 14px;">${safeCustomerEmail}</p>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf8; border-radius: 6px; padding: 15px;">
                  <tr><td style="padding: 3px 0; color: #292827; font-size: 12px;">No. Invoice:</td><td style="padding: 3px 0; color: #292827; font-size: 14px; font-weight: bold; text-align: right;">${safeInvoiceNumber}</td></tr>
                  <tr><td style="padding: 3px 0; color: #292827; font-size: 12px;">Tanggal:</td><td style="padding: 3px 0; color: #292827; font-size: 14px; text-align: right;">${formatDate(invoiceDate)}</td></tr>
                  <tr><td style="padding: 3px 0; color: #292827; font-size: 12px;">Jatuh Tempo:</td><td style="padding: 3px 0; color: #b91c1c; font-size: 14px; font-weight: bold; text-align: right;">${formatDate(dueDate)}</td></tr>
                  <tr><td style="padding: 3px 0; color: #292827; font-size: 12px;">Status:</td><td style="padding: 3px 0; text-align: right;"><span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; ${displayStatus === 'PAID' ? 'background-color: #d1fae5; color: #065f46;' : displayStatus === 'SENT' ? 'background-color: #e0e7ff; color: #1b1938;' : displayStatus === 'OVERDUE' ? 'background-color: #fee2e2; color: #991b1b;' : 'background-color: #fafaf8; color: #292827;'}">${safeDisplayStatusLabel}</span></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding: 0 30px 30px 30px;">
          <h2 style="margin: 0 0 15px 0; color: #292827; font-size: 18px; font-weight: bold;">Rincian Layanan</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <thead><tr style="background-color: #1b1938;">
              <th style="padding: 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: bold;">Deskripsi</th>
              <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: bold; width: 60px;">Qty</th>
              <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: bold; width: 120px;">Harga Satuan</th>
              <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: bold; width: 120px;">Total</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </td></tr>
        <tr><td style="padding: 0 30px 30px 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf8; border-radius: 8px; padding: 20px;">
            <tr><td style="padding: 5px 0; color: #292827; font-size: 14px;">Subtotal:</td><td style="padding: 5px 0; text-align: right; color: #292827; font-size: 14px;">${formatCurrency(subtotal)}</td></tr>
            ${discountAmount > 0 ? `<tr><td style="padding: 5px 0; color: #292827; font-size: 14px;">Diskon:</td><td style="padding: 5px 0; text-align: right; color: #b91c1c; font-size: 14px;">-${formatCurrency(discountAmount)}</td></tr>` : ''}
            <tr><td style="padding: 5px 0; color: #292827; font-size: 14px;">Pajak (${taxPercentage}%):</td><td style="padding: 5px 0; text-align: right; color: #292827; font-size: 14px;">${formatCurrency(taxAmount)}</td></tr>
            ${amountPaid > 0 ? `<tr><td style="padding: 5px 0; color: #292827; font-size: 14px;">Jumlah Dibayar:</td><td style="padding: 5px 0; text-align: right; color: #065f46; font-size: 14px;">-${formatCurrency(amountPaid)}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0 5px 0;"><hr style="border: none; border-top: 2px solid #1b1938; margin: 0;"></td></tr>
            <tr><td style="padding: 5px 0; color: #292827; font-size: 18px; font-weight: bold;">${balanceDue > 0 ? 'Sisa Tagihan:' : 'LUNAS'}</td><td style="padding: 5px 0; text-align: right; color: ${balanceDue > 0 ? '#b91c1c' : '#065f46'}; font-size: 20px; font-weight: bold;">${formatCurrency(balanceDue)}</td></tr>
          </table>
        </td></tr>
        ${balanceDue > 0 && bankAccounts.length > 0 ? `
        <tr><td style="padding: 0 30px 30px 30px;">
          <div style="background-color: #f0eff7; border-left: 4px solid #1b1938; padding: 20px; border-radius: 6px;">
            <h3 style="margin: 0 0 15px 0; color: #1b1938; font-size: 16px; font-weight: bold;">Informasi Pembayaran</h3>
            <p style="margin: 0 0 15px 0; color: #292827; font-size: 13px; font-style: italic;">Silakan transfer ke salah satu rekening berikut dan cantumkan No. Invoice (${safeInvoiceNumber}) dalam keterangan transfer.</p>
            ${bankAccountsHtml}
          </div>
        </td></tr>` : ''}
        ${safeTermsConditions ? `
        <tr><td style="padding: 0 30px 30px 30px;">
          <h3 style="margin: 0 0 10px 0; color: #292827; font-size: 14px; font-weight: bold; text-transform: uppercase;">Syarat dan Ketentuan</h3>
          <p style="margin: 0; color: #292827; font-size: 13px; line-height: 1.6;">${safeTermsConditions}</p>
        </td></tr>` : ''}
        <tr><td style="background-color: #fafaf8; padding: 20px 30px; border-top: 1px solid #e8e4dd;">
          <p style="margin: 0 0 10px 0; color: #292827; font-size: 13px;">Jika ada pertanyaan, silakan hubungi kami:</p>
          ${safeCompanyAddress ? `<p style="margin: 0 0 5px 0; color: #292827; font-size: 13px;">${safeCompanyAddress}</p>` : ''}
          ${safeCompanyPhone ? `<p style="margin: 0 0 5px 0; color: #292827; font-size: 13px;">${safeCompanyPhone}</p>` : ''}
          ${safeCompanyEmail ? `<p style="margin: 0 0 5px 0; color: #292827; font-size: 13px;">${safeCompanyEmail}</p>` : ''}
          ${safeCompanyWebsite ? `<p style="margin: 0 0 15px 0; color: #1b1938; font-size: 13px;">${safeCompanyWebsite}</p>` : ''}
          <p style="margin: 0; color: #292827; font-size: 12px; font-style: italic;">Terima kasih atas kepercayaan Anda!</p>
        </td></tr>
      </table>
      <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
        <tr><td style="text-align: center; color: #292827; font-size: 12px;">
          <p style="margin: 0;">Invoice ini digenerate otomatis oleh sistem ${safeCompanyName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendInvoiceEmail(resend: Resend, from: string, to: string, subject: string, html: string) {
  return resend.emails.send({ from, to, subject, html })
}

export function validateSenderEmail(email: string): string {
  const invalidDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com']
  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (invalidDomains.includes(emailDomain)) {
    logger.warn(`Company email uses invalid domain (${emailDomain}), using fallback: noreply@yaleya.biz.id`)
    return 'noreply@yaleya.biz.id'
  }
  return email
}

import jsPDF from 'jspdf'
import { Invoice } from './actions/invoices'
import type { CompanyInfo } from './pdf-export-utils'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function renderSummarySection(
  pdf: jsPDF,
  yPos: number,
  invoice: Invoice,
  subtotal: number,
  tax: number,
  amountPaid: number,
  balanceDue: number,
  company: CompanyInfo,
  pageWidth: number,
  margin: number,
): number {
  yPos += 8
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(pageWidth - margin - 80, yPos, pageWidth - margin, yPos)

  yPos += 6
  const summaryX = pageWidth - margin - 70

  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Subtotal:', summaryX, yPos)
  pdf.setTextColor(15, 23, 42)
  pdf.text(formatCurrency(subtotal), pageWidth - margin - 2, yPos, { align: 'right' })

  if (invoice.discount_amount > 0) {
    yPos += 5
    pdf.setTextColor(71, 85, 105)
    pdf.text('Diskon:', summaryX, yPos)
    pdf.setTextColor(220, 38, 38)
    pdf.text(`-${formatCurrency(invoice.discount_amount)}`, pageWidth - margin - 2, yPos, {
      align: 'right',
    })
  }

  yPos += 5
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Pajak (${company.taxPercentage}%):`, summaryX, yPos)
  pdf.setTextColor(15, 23, 42)
  pdf.text(formatCurrency(tax), pageWidth - margin - 2, yPos, { align: 'right' })

  if (amountPaid > 0) {
    yPos += 5
    pdf.setTextColor(71, 85, 105)
    pdf.text('Jumlah Dibayar:', summaryX, yPos)
    pdf.setTextColor(22, 163, 74)
    pdf.text(`-${formatCurrency(amountPaid)}`, pageWidth - margin - 2, yPos, { align: 'right' })
  }

  yPos += 3
  pdf.setDrawColor(30, 58, 138)
  pdf.setLineWidth(0.5)
  pdf.line(summaryX - 2, yPos, pageWidth - margin, yPos)

  yPos += 7
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')

  if (balanceDue > 0) {
    pdf.setTextColor(220, 38, 38)
    pdf.text('Sisa Tagihan:', summaryX, yPos)
  } else {
    pdf.setTextColor(22, 163, 74)
    pdf.text('LUNAS', summaryX, yPos)
  }
  pdf.text(formatCurrency(balanceDue), pageWidth - margin - 2, yPos, { align: 'right' })

  return yPos
}

export function renderPaymentInfo(
  pdf: jsPDF,
  yPos: number,
  balanceDue: number,
  company: CompanyInfo,
  pageWidth: number,
  margin: number,
): number {
  if (balanceDue <= 0 || company.bankAccounts.length === 0) return yPos

  yPos += 12
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 58, 138)
  pdf.text('INFORMASI PEMBAYARAN', margin, yPos)

  yPos += 5
  pdf.setFillColor(239, 246, 255)
  const boxHeight = 7 + company.bankAccounts.length * 11
  pdf.rect(margin, yPos, pageWidth - margin * 2, boxHeight, 'F')

  yPos += 4
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    'Silakan lakukan pembayaran ke salah satu rekening berikut dan cantumkan No. Invoice dalam deskripsi.',
    margin + 3,
    yPos
  )

  yPos += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(8)

  company.bankAccounts.forEach((account, index) => {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${index + 1}. ${account.bank}`, margin + 3, yPos)
    pdf.setFont('helvetica', 'normal')
    yPos += 3.5
    pdf.text(
      `    No. Rek: ${account.account_number} - a/n ${account.account_name}`,
      margin + 3,
      yPos
    )
    yPos += 4
  })

  return yPos
}

export function renderTermsAndConditions(
  pdf: jsPDF,
  yPos: number,
  company: CompanyInfo,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): number {
  if (!company.termsTemplate) return yPos

  yPos += 10
  if (yPos > pageHeight - 35) {
    pdf.addPage()
    yPos = margin + 15
  }

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(71, 85, 105)
  pdf.text('SYARAT DAN KETENTUAN', margin, yPos)

  yPos += 4
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 116, 139)

  const termsLines = pdf.splitTextToSize(company.termsTemplate, pageWidth - margin * 2)
  termsLines.forEach((line: string) => {
    if (yPos > pageHeight - 18) {
      pdf.addPage()
      yPos = margin + 15
    }
    pdf.text(line, margin, yPos)
    yPos += 3.5
  })

  return yPos
}

export function renderInvoiceFooter(
  pdf: jsPDF,
  company: CompanyInfo,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): void {
  const footerY = pageHeight - 12
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4)

  pdf.setFontSize(7)
  pdf.setTextColor(148, 163, 184)
  pdf.setFont('helvetica', 'italic')
  pdf.text(
    `Invoice ini digenerate otomatis oleh sistem ${company.companyName}`,
    margin,
    footerY
  )
  pdf.text(`Halaman 1`, pageWidth - margin, footerY, { align: 'right' })
}

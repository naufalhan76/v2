import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Invoice } from './actions/invoices'
import { formatPhone } from '@/lib/utils'
import type { CompanyInfo } from './pdf-export-utils'

function formatDate(date: string) {
  return format(new Date(date), 'dd MMM yyyy', { locale: localeId })
}

export function renderInvoiceHeader(
  pdf: jsPDF, yPos: number, company: CompanyInfo, pageWidth: number, margin: number,
): number {
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 58, 138)
  pdf.text(company.companyName, margin, yPos)

  pdf.setFontSize(40)
  pdf.setTextColor(220, 38, 38)
  pdf.text('INVOICE', pageWidth - margin, yPos, { align: 'right' })

  pdf.setTextColor(71, 85, 105)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  yPos += 6

  const maxAddressWidth = pageWidth * 0.5
  const addressLines = pdf.splitTextToSize(company.companyAddress, maxAddressWidth)
  addressLines.forEach((line: string) => {
    pdf.text(line, margin, yPos)
    yPos += 3.5
  })

  yPos += 3.5
  pdf.text(company.companyPhone, margin, yPos)
  yPos += 3.5
  if (company.companyEmail) {
    pdf.text(company.companyEmail, margin, yPos)
    yPos += 3.5
  }

  if (company.companyWebsite || company.npwp) {
    yPos += 3.5
  }

  if (company.companyWebsite) {
    pdf.setTextColor(59, 130, 246)
    pdf.text(company.companyWebsite, margin, yPos)
    pdf.setTextColor(71, 85, 105)
    yPos += 3.5
  }

  if (company.npwp) {
    pdf.setFontSize(7)
    pdf.text(`NPWP: ${company.npwp}`, margin, yPos)
    yPos += 3.5
  }

  yPos += 4
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPos, pageWidth - margin, yPos)

  return yPos
}

export function renderInvoiceDetails(
  pdf: jsPDF, yPos: number, customerName: string, customerPhone: string,
  customerEmail: string, invoice: Invoice, displayStatus: string,
  displayStatusLabel: string, pageWidth: number, margin: number,
): number {
  yPos += 12

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(100, 116, 139)
  pdf.text('TAGIHAN KEPADA', margin, yPos)

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(11)
  yPos += 5
  pdf.text(customerName, margin, yPos)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  yPos += 4
  if (customerPhone) {
    pdf.text(`Tel: ${formatPhone(customerPhone)}`, margin, yPos)
    yPos += 4
  }
  if (customerEmail) {
    pdf.text(`Email: ${customerEmail}`, margin, yPos)
  }

  const rightX = pageWidth - margin - 70
  const boxStartY = yPos - 13
  pdf.setFillColor(248, 250, 252)
  pdf.rect(rightX - 3, boxStartY, 73, 36, 'F')

  let rightY = boxStartY + 5

  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('No. Invoice:', rightX, rightY)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  pdf.text(invoice.invoice_number, pageWidth - margin - 2, rightY, { align: 'right' })

  rightY += 7
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 116, 139)
  pdf.text('Tanggal Invoice:', rightX, rightY)
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(formatDate(invoice.invoice_date), pageWidth - margin - 2, rightY, { align: 'right' })

  rightY += 7
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('Jatuh Tempo:', rightX, rightY)
  pdf.setFontSize(8)
  pdf.setTextColor(220, 38, 38)
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatDate(invoice.due_date), pageWidth - margin - 2, rightY, { align: 'right' })

  rightY += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('Status:', rightX, rightY)

  let statusColor: [number, number, number] = [71, 85, 105]
  if (displayStatus === 'PAID') statusColor = [22, 163, 74]
  else if (displayStatus === 'OVERDUE') statusColor = [220, 38, 38]
  else if (displayStatus === 'SENT') statusColor = [59, 130, 246]

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...statusColor)
  pdf.text(displayStatusLabel, pageWidth - margin - 2, rightY, { align: 'right' })

  return yPos
}

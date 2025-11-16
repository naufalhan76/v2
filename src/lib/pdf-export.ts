import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Invoice, InvoiceItem, PaymentRecord } from './actions/invoices'
import { InvoiceConfig, BankAccount } from './actions/invoice-config'

export interface PDFExportOptions {
  invoice: Invoice
  items: InvoiceItem[]
  payments: PaymentRecord[]
  invoiceConfig: InvoiceConfig | null
  orderItemsDetailed?: any[]
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

  // Calculate totals
  const subtotal = invoice.subtotal
  const tax = invoice.tax_amount
  const totalAmount = invoice.total_amount
  const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const balanceDue = totalAmount - amountPaid

  // Get company data from config or use defaults
  const companyName = invoiceConfig?.company_name || 'AC Service Dashboard'
  const companyAddress = invoiceConfig?.company_address || 'Jl. Service No. 123, Jakarta, Indonesia'
  const companyPhone = invoiceConfig?.company_phone || '(021) 555-0100'
  const companyEmail = invoiceConfig?.company_email || 'info@acservice.com'
  const companyWebsite = invoiceConfig?.company_website || null
  const npwp = invoiceConfig?.npwp || null
  const taxPercentage = invoiceConfig?.default_tax_percentage || 11
  const termsTemplate = invoiceConfig?.terms_conditions_template || null

  // Parse bank accounts from JSON string
  let bankAccounts: BankAccount[] = []
  if (invoiceConfig?.bank_accounts) {
    try {
      bankAccounts = JSON.parse(invoiceConfig.bank_accounts)
    } catch (e) {
      console.error('Failed to parse bank accounts:', e)
    }
  }

  // Helper function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // ========================================
  // HEADER - Company Name & INVOICE
  // ========================================
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 58, 138) // blue-900
  pdf.text(companyName, margin, yPos)

  pdf.setFontSize(40)
  pdf.setTextColor(220, 38, 38) // red-600
  pdf.text('INVOICE', pageWidth - margin, yPos, { align: 'right' })

  // Company Details - Left side
  pdf.setTextColor(71, 85, 105) // slate-600
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  yPos += 6
  
  // Wrap address if too long
  const maxAddressWidth = pageWidth * 0.5 // Use only 50% of page width
  const addressLines = pdf.splitTextToSize(companyAddress, maxAddressWidth)
  addressLines.forEach((line: string, index: number) => {
    pdf.text(line, margin, yPos)
    yPos += 3.5 // Spacing antar baris alamat
  })

  // Add space after address
  yPos += 3.5

  // Contact info
  pdf.text(companyPhone, margin, yPos)
  yPos += 3.5
  if (companyEmail) {
    pdf.text(companyEmail, margin, yPos)
    yPos += 3.5
  }

  // Add space before website/npwp
  if (companyWebsite || npwp) {
    yPos += 3.5
  }

  if (companyWebsite) {
    pdf.setTextColor(59, 130, 246) // blue-500
    pdf.text(companyWebsite, margin, yPos)
    pdf.setTextColor(71, 85, 105)
    yPos += 3.5
  }

  if (npwp) {
    pdf.setFontSize(7)
    pdf.text(`NPWP: ${npwp}`, margin, yPos)
    yPos += 3.5
  }

  // Line separator
  yPos += 4
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPos, pageWidth - margin, yPos)

  // ========================================
  // CUSTOMER & INVOICE DETAILS
  // ========================================
  yPos += 12

  // Left side - Customer
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(100, 116, 139) // slate-500
  pdf.text('TAGIHAN KEPADA', margin, yPos)

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42) // slate-900
  pdf.setFontSize(11)
  yPos += 5
  pdf.text(invoice.customers?.customer_name || 'N/A', margin, yPos)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  yPos += 4
  if (invoice.customers?.phone_number) {
    pdf.text(`Tel: ${invoice.customers.phone_number}`, margin, yPos)
    yPos += 4
  }
  if (invoice.customers?.email) {
    pdf.text(`Email: ${invoice.customers.email}`, margin, yPos)
  }

  // Right side - Invoice Details Box
  const rightX = pageWidth - margin - 70
  const boxStartY = yPos - 13
  
  // Box background
  pdf.setFillColor(248, 250, 252) // slate-50
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
  pdf.text(format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: localeId }), pageWidth - margin - 2, rightY, { align: 'right' })

  rightY += 7
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('Jatuh Tempo:', rightX, rightY)
  pdf.setFontSize(8)
  pdf.setTextColor(220, 38, 38) // red-600 for due date
  pdf.setFont('helvetica', 'bold')
  pdf.text(format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: localeId }), pageWidth - margin - 2, rightY, { align: 'right' })

  rightY += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('Status:', rightX, rightY)

  // Status badge
  let statusColor: [number, number, number] = [71, 85, 105]
  if (invoice.status === 'PAID') statusColor = [22, 163, 74]
  else if (invoice.status === 'OVERDUE') statusColor = [220, 38, 38]
  else if (invoice.status === 'SENT') statusColor = [59, 130, 246]

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...statusColor)
  pdf.text(invoice.status, pageWidth - margin - 2, rightY, { align: 'right' })

  // ========================================
  // ITEMS TABLE
  // ========================================
  yPos += 15
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  pdf.text('RINCIAN LAYANAN', margin, yPos)

  yPos += 6

  // Table Header
  pdf.setFillColor(30, 58, 138) // blue-900
  pdf.rect(margin, yPos - 4, pageWidth - (margin * 2), 7, 'F')

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255) // white
  pdf.text('Deskripsi', margin + 3, yPos)
  pdf.text('Qty', pageWidth - 90, yPos, { align: 'center' })
  pdf.text('Harga Satuan', pageWidth - 60, yPos, { align: 'right' })
  pdf.text('Total', pageWidth - margin - 3, yPos, { align: 'right' })

  // Table Items - Per AC Breakdown if available
  yPos += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(8)

  if (orderItemsDetailed && orderItemsDetailed.length > 0) {
    // Group by location
    const groupedByLocation = orderItemsDetailed.reduce((acc: any, item: any) => {
      const locId = item.location_id || 'unknown'
      if (!acc[locId]) {
        acc[locId] = {
          location: item.locations,
          items: []
        }
      }
      acc[locId].items.push(item)
      return acc
    }, {})
    
    let itemIndex = 0
    Object.values(groupedByLocation).forEach((group: any) => {
      if (yPos > pageHeight - 70) {
        pdf.addPage()
        yPos = margin + 20
      }
      
      // Location Header
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(30, 58, 138) // blue-900
      const locationText = group.location ? 
        `${group.location.building_name} - Floor ${group.location.floor}, Room ${group.location.room_number}` :
        'Unknown Location'
      pdf.text(locationText, margin + 3, yPos)
      yPos += 6
      
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(15, 23, 42)
      
      // Items for this location
      group.items.forEach((item: any) => {
        if (yPos > pageHeight - 70) {
          pdf.addPage()
          yPos = margin + 20
        }
        
        // Zebra striping
        if (itemIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, yPos - 3, pageWidth - (margin * 2), 9, 'F')
        }
        
        // AC Unit description
        const acDesc = item.ac_units ? 
          `${item.ac_units.brand} ${item.ac_units.model_number} - ${item.service_type}` :
          `New AC Unit (${item.quantity}x) - ${item.service_type}`
        
        const descLines = pdf.splitTextToSize(acDesc, 85)
        pdf.text(descLines, margin + 5, yPos)
        
        const qty = item.quantity || 1
        const price = item.estimated_price || item.actual_price || 0
        const total = qty * price
        
        pdf.text(qty.toString(), pageWidth - 90, yPos, { align: 'center' })
        pdf.text(formatCurrency(price), pageWidth - 60, yPos, { align: 'right' })
        pdf.setFont('helvetica', 'bold')
        pdf.text(formatCurrency(total), pageWidth - margin - 3, yPos, { align: 'right' })
        pdf.setFont('helvetica', 'normal')
        
        yPos += Math.max((descLines.length * 4.5), 9)
        itemIndex++
      })
      
      yPos += 3 // Space between locations
    })
  } else {
    // Fallback to simple items
    items.forEach((item, index) => {
      if (yPos > pageHeight - 70) {
        pdf.addPage()
        yPos = margin + 20
      }

      // Zebra striping
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(margin, yPos - 3, pageWidth - (margin * 2), 9, 'F')
      }

      // Wrap long descriptions
      const descLines = pdf.splitTextToSize(item.description, 85)
      pdf.text(descLines, margin + 3, yPos)

      pdf.text(item.quantity.toString(), pageWidth - 90, yPos, { align: 'center' })
      pdf.text(formatCurrency(item.unit_price), pageWidth - 60, yPos, { align: 'right' })
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatCurrency(item.quantity * item.unit_price), pageWidth - margin - 3, yPos, { align: 'right' })
      pdf.setFont('helvetica', 'normal')

      yPos += Math.max((descLines.length * 4.5), 9)
    })
  }

  // ========================================
  // SUMMARY SECTION
  // ========================================
  yPos += 8
  
  // Draw line above summary
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
    pdf.text(`-${formatCurrency(invoice.discount_amount)}`, pageWidth - margin - 2, yPos, { align: 'right' })
  }

  yPos += 5
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Pajak (${taxPercentage}%):`, summaryX, yPos)
  pdf.setTextColor(15, 23, 42)
  pdf.text(formatCurrency(tax), pageWidth - margin - 2, yPos, { align: 'right' })

  if (amountPaid > 0) {
    yPos += 5
    pdf.setTextColor(71, 85, 105)
    pdf.text('Jumlah Dibayar:', summaryX, yPos)
    pdf.setTextColor(22, 163, 74) // green
    pdf.text(`-${formatCurrency(amountPaid)}`, pageWidth - margin - 2, yPos, { align: 'right' })
  }

  // Total line
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

  // ========================================
  // PAYMENT INFO (if balance due > 0 and bank accounts exist)
  // ========================================
  if (balanceDue > 0 && bankAccounts.length > 0) {
    yPos += 12
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 58, 138)
    pdf.text('INFORMASI PEMBAYARAN', margin, yPos)

    yPos += 5
    pdf.setFillColor(239, 246, 255) // blue-50
    const boxHeight = 7 + (bankAccounts.length * 11)
    pdf.rect(margin, yPos, pageWidth - (margin * 2), boxHeight, 'F')

    yPos += 4
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(71, 85, 105)
    pdf.text('Silakan lakukan pembayaran ke salah satu rekening berikut dan cantumkan No. Invoice dalam deskripsi.', margin + 3, yPos)

    yPos += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(15, 23, 42)
    pdf.setFontSize(8)

    bankAccounts.forEach((account, index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${index + 1}. ${account.bank}`, margin + 3, yPos)
      pdf.setFont('helvetica', 'normal')
      yPos += 3.5
      pdf.text(`    No. Rek: ${account.account_number} - a/n ${account.account_name}`, margin + 3, yPos)
      yPos += 4
    })
  }

  // ========================================
  // TERMS AND CONDITIONS
  // ========================================
  if (termsTemplate) {
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

    const termsLines = pdf.splitTextToSize(termsTemplate, pageWidth - (margin * 2))
    termsLines.forEach((line: string) => {
      if (yPos > pageHeight - 18) {
        pdf.addPage()
        yPos = margin + 15
      }
      pdf.text(line, margin, yPos)
      yPos += 3.5
    })
  }

  // ========================================
  // FOOTER
  // ========================================
  const footerY = pageHeight - 12
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4)

  pdf.setFontSize(7)
  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.setFont('helvetica', 'italic')
  pdf.text(`Invoice ini digenerate otomatis oleh sistem ${companyName}`, margin, footerY)
  pdf.text(`Halaman 1`, pageWidth - margin, footerY, { align: 'right' })

  // Save PDF
  pdf.save(`Invoice_${invoice.invoice_number}.pdf`)
}

import jsPDF from 'jspdf'
import { InvoiceItem } from './actions/invoices'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function renderItemsTable(
  pdf: jsPDF,
  yPos: number,
  items: InvoiceItem[],
  orderItemsDetailed: Record<string, unknown>[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
): number {
  yPos += 15
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  pdf.text('RINCIAN LAYANAN', margin, yPos)

  yPos += 6
  pdf.setFillColor(30, 58, 138)
  pdf.rect(margin, yPos - 4, pageWidth - (margin * 2), 7, 'F')

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Deskripsi', margin + 3, yPos)
  pdf.text('Qty', pageWidth - 90, yPos, { align: 'center' })
  pdf.text('Harga Satuan', pageWidth - 60, yPos, { align: 'right' })
  pdf.text('Total', pageWidth - margin - 3, yPos, { align: 'right' })

  yPos += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(8)

  if (orderItemsDetailed && orderItemsDetailed.length > 0) {
    const groupedByLocation = orderItemsDetailed.reduce(
      (acc: Record<string, { location: unknown; items: unknown[] }>, item: unknown) => {
        const i = item as Record<string, unknown>
        const locId = (i.location_id as string) || 'unknown'
        if (!acc[locId]) {
          acc[locId] = { location: i.locations, items: [] }
        }
        acc[locId].items.push(item)
        return acc
      },
      {}
    )

    let itemIndex = 0
    Object.values(groupedByLocation).forEach((group: unknown) => {
      const g = group as { location: Record<string, unknown>; items: unknown[] }
      if (yPos > pageHeight - 70) {
        pdf.addPage()
        yPos = margin + 20
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(30, 58, 138)
      const locationText = g.location
        ? `${g.location.full_address as string} - House ${g.location.house_number as string}, ${g.location.city as string}`
        : 'Unknown Location'
      pdf.text(locationText, margin + 3, yPos)
      yPos += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(15, 23, 42)

      g.items.forEach((item: unknown) => {
        const it = item as Record<string, unknown> & { ac_units?: Record<string, unknown> }
        if (yPos > pageHeight - 70) {
          pdf.addPage()
          yPos = margin + 20
        }

        if (itemIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, yPos - 3, pageWidth - (margin * 2), 9, 'F')
        }

        const acDesc = it.ac_units
          ? `${it.ac_units.brand as string} ${it.ac_units.model_number as string} - ${it.service_type as string}`
          : `New AC Unit (${it.quantity as number}x) - ${it.service_type as string}`
        const descLines = pdf.splitTextToSize(acDesc, 85)
        pdf.text(descLines, margin + 5, yPos)

        const qty = (it.quantity as number) || 1
        const price = (it.estimated_price as number) || (it.actual_price as number) || 0
        const total = qty * price

        pdf.text(qty.toString(), pageWidth - 90, yPos, { align: 'center' })
        pdf.text(formatCurrency(price), pageWidth - 60, yPos, { align: 'right' })
        pdf.setFont('helvetica', 'bold')
        pdf.text(formatCurrency(total), pageWidth - margin - 3, yPos, { align: 'right' })
        pdf.setFont('helvetica', 'normal')

        yPos += Math.max(descLines.length * 4.5, 9)
        itemIndex++
      })

      yPos += 3
    })
  } else {
    items.forEach((item, index) => {
      if (yPos > pageHeight - 70) {
        pdf.addPage()
        yPos = margin + 20
      }

      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(margin, yPos - 3, pageWidth - (margin * 2), 9, 'F')
      }

      const descLines = pdf.splitTextToSize(item.description, 85)
      pdf.text(descLines, margin + 3, yPos)

      pdf.text(item.quantity.toString(), pageWidth - 90, yPos, { align: 'center' })
      pdf.text(formatCurrency(item.unit_price), pageWidth - 60, yPos, { align: 'right' })
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatCurrency(item.quantity * item.unit_price), pageWidth - margin - 3, yPos, {
        align: 'right',
      })
      pdf.setFont('helvetica', 'normal')

      yPos += Math.max(descLines.length * 4.5, 9)
    })
  }

  return yPos
}

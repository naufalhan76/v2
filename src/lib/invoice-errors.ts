// src/lib/invoice-errors.ts
// Non-server-action exports for invoice flow.
// Lives outside src/lib/actions/ because Next.js requires 'use server' files
// to export only async functions.

export class ServiceReportMissingError extends Error {
  constructor(orderId: string) {
    super(`Service report belum ada untuk order ${orderId}`)
    this.name = 'ServiceReportMissingError'
  }
}

export interface CreateInvoiceFromOrderResult {
  invoice_id: string
  invoice_number: string
  total_amount: number
  source: 'SERVICE_REPORT'
}

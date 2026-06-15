/**
 * Service report PDF generation.
 *
 * Currently unused — the technician PWA submits reports via API and
 * the admin dashboard prints them through the browser's native print
 * dialog.  Keep this file as a placeholder for future PDF export.
 */

export interface ServiceReportPDFOptions {
  reportId: string
  orderId: string
  // Future fields will be added here when report PDF export is implemented.
}

export function exportServiceReportToPDF(_options: ServiceReportPDFOptions): void {
  throw new Error('Service report PDF export is not yet implemented')
}

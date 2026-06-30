// src/lib/status-colors.ts
// Color tokens for invoice statuses and service types.
// Consistent format: { bg, text, border } per entry.

/**
 * Invoice status values.
 */
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIAL_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

/**
 * Unified token classes for invoice statuses.
 * DRAFT maps to muted/border (no status equivalent).
 */
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string; border: string }> = {
  DRAFT: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: '',
  },
  SENT: {
    bg: 'bg-status-assigned',
    text: 'text-white',
    border: '',
  },
  PARTIAL_PAID: {
    bg: 'bg-status-pending',
    text: 'text-white',
    border: '',
  },
  PAID: {
    bg: 'bg-status-paid',
    text: 'text-white',
    border: '',
  },
  OVERDUE: {
    bg: 'bg-status-cancelled',
    text: 'text-white',
    border: '',
  },
  CANCELLED: {
    bg: 'bg-status-cancelled',
    text: 'text-white',
    border: '',
  },
}

/**
 * Human-readable labels for invoice statuses (Indonesian).
 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Terkirim',
  PARTIAL_PAID: 'Sebagian Dibayar',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh Tempo',
  CANCELLED: 'Dibatalkan',
}

/**
 * Service type values.
 * NOTE: MAINTENANCE is kept for backward compat — normalized to CHECKING
 * in src/lib/service-types.ts.
 */
export type ServiceType =
  | 'REFILL_FREON'
  | 'CLEANING'
  | 'REPAIR'
  | 'INSTALLATION'
  | 'INSPECTION'
  | 'CHECKING'
  | 'UNINSTALL'
  | 'MAINTENANCE'

/**
 * Token classes; service-type mappings reuse status tokens semantically.
 * See DESIGN.md.
 */
export const SERVICE_TYPE_COLORS: Record<ServiceType, { bg: string; text: string; border: string }> = {
  REFILL_FREON: {
    bg: 'bg-status-assigned',
    text: 'text-white',
    border: '',
  },
  CLEANING: {
    bg: 'bg-status-paid',
    text: 'text-white',
    border: '',
  },
  REPAIR: {
    bg: 'bg-status-pending',
    text: 'text-white',
    border: '',
  },
  INSTALLATION: {
    bg: 'bg-status-en-route',
    text: 'text-white',
    border: '',
  },
  INSPECTION: {
    bg: 'bg-status-invoiced',
    text: 'text-white',
    border: '',
  },
  CHECKING: {
    bg: 'bg-status-in-progress',
    text: 'text-white',
    border: '',
  },
  UNINSTALL: {
    bg: 'bg-status-cancelled',
    text: 'text-white',
    border: '',
  },
  MAINTENANCE: {
    bg: 'bg-status-in-progress',
    text: 'text-white',
    border: '',
  },
}

/**
 * Human-readable labels for service types.
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  REFILL_FREON: 'Refill Freon',
  CLEANING: 'Cleaning',
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
  INSPECTION: 'Inspection',
  CHECKING: 'Checking',
  UNINSTALL: 'Uninstall',
  MAINTENANCE: 'Maintenance',
}

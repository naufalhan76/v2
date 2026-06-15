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
    border: 'border-border',
  },
  SENT: {
    bg: 'bg-status-assigned-bg',
    text: 'text-status-assigned',
    border: 'border-status-assigned/30',
  },
  PARTIAL_PAID: {
    bg: 'bg-status-pending-bg',
    text: 'text-status-pending',
    border: 'border-status-pending/30',
  },
  PAID: {
    bg: 'bg-status-paid-bg',
    text: 'text-status-paid',
    border: 'border-status-paid/30',
  },
  OVERDUE: {
    bg: 'bg-status-cancelled-bg',
    text: 'text-status-cancelled',
    border: 'border-status-cancelled/30',
  },
  CANCELLED: {
    bg: 'bg-status-cancelled-bg',
    text: 'text-status-cancelled',
    border: 'border-status-cancelled/30',
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
    bg: 'bg-status-assigned-bg',
    text: 'text-status-assigned',
    border: 'border-status-assigned/30',
  },
  CLEANING: {
    bg: 'bg-status-paid-bg',
    text: 'text-status-paid',
    border: 'border-status-paid/30',
  },
  REPAIR: {
    bg: 'bg-status-pending-bg',
    text: 'text-status-pending',
    border: 'border-status-pending/30',
  },
  INSTALLATION: {
    bg: 'bg-status-en-route-bg',
    text: 'text-status-en-route',
    border: 'border-status-en-route/30',
  },
  INSPECTION: {
    bg: 'bg-status-invoiced-bg',
    text: 'text-status-invoiced',
    border: 'border-status-invoiced/30',
  },
  CHECKING: {
    bg: 'bg-status-in-progress-bg',
    text: 'text-status-in-progress',
    border: 'border-status-in-progress/30',
  },
  UNINSTALL: {
    bg: 'bg-status-cancelled-bg',
    text: 'text-status-cancelled',
    border: 'border-status-cancelled/30',
  },
  MAINTENANCE: {
    bg: 'bg-status-in-progress-bg',
    text: 'text-status-in-progress',
    border: 'border-status-in-progress/30',
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

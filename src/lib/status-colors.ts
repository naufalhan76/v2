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
 * Color tokens for invoice statuses.
 */
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string; border: string }> = {
  DRAFT: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
  SENT: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  PARTIAL_PAID: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  PAID: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  OVERDUE: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
  CANCELLED: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
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
 */
export type ServiceType =
  | 'REFILL_FREON'
  | 'CLEANING'
  | 'REPAIR'
  | 'INSTALLATION'
  | 'INSPECTION'
  | 'MAINTENANCE'

/**
 * Color tokens for service types.
 */
export const SERVICE_TYPE_COLORS: Record<ServiceType, { bg: string; text: string; border: string }> = {
  REFILL_FREON: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  CLEANING: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  REPAIR: {
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  INSTALLATION: {
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  INSPECTION: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  MAINTENANCE: {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
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
  MAINTENANCE: 'Maintenance',
}

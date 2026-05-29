/**
 * QA E2E shared types — wire contract for the QA suite.
 *
 * Every spec under tests/e2e/qa/ imports from here so renames stay coherent
 * across 18 specs. Do not import application code into this file (keep the
 * surface area testable in isolation).
 */

import type { OrderStatus } from '@/lib/order-status'

export type QaPrefix = `QA-E2E-${string}`

export type SeedScenario = {
  /** All ids carry the prefix to allow afterAll purge by LIKE match. */
  prefix: QaPrefix
  customerId: string
  locationId: string
  /** At least 2 by default; some scenarios seed more. */
  acUnitIds: string[]
  /** A service_catalog row keyed for predictable estimated_price. */
  catalogId: string | null
  /** Cleanup helper: removes every row created by this seed call. */
  cleanup: () => Promise<void>
}

export type SeedScenarioOpts = {
  /** Number of AC units to create. Default: 2. */
  acUnits?: number
  /** Customer name suffix for visual grep. Default: 'Default'. */
  label?: string
}

export type CreatedOrder = {
  orderId: string
  status: OrderStatus
  itemIds: string[]
  proformaInvoiceId: string | null
}

export type AssignmentResult = {
  orderId: string
  leadTechnicianId: string
  helperTechnicianIds: string[]
}

export type ServiceReportSnapshot = {
  reportId: string
  orderId: string
  technicianId: string
  photosBefore: string[]
  photosAfter: string[]
  acUnits: Array<Record<string, unknown>>
  actualTotalPrice: number
  customerSignatureUrl: string | null
  customerNameSigned: string | null
  nextServiceRecommendationDate: string | null
  idempotencyKey: string | null
}

export type InvoiceSnapshot = {
  invoiceId: string
  invoiceType: 'PROFORMA' | 'FINAL'
  status: string
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
  totalAmount: number
  paidAmount: number
}

export type StatusTransitionSnapshot = {
  transitionId: string
  fromStatus: string
  toStatus: string
  notes: string | null
  idempotencyKey: string | null
  lat: number | null
  lng: number | null
  gpsError: string | null
  transitionDate: string
}

export type FullOrderSnapshot = {
  order: { orderId: string; status: OrderStatus; updatedAt: string }
  transitions: StatusTransitionSnapshot[]
  reports: ServiceReportSnapshot[]
  invoices: InvoiceSnapshot[]
  payments: Array<{ paymentId: string; amount: number; method: string }>
}

export type QaRoleAccount = {
  email: string
  password: string
  /** Display label for evidence files. */
  label: string
}

export type QaAccounts = {
  admin: QaRoleAccount
  finance: QaRoleAccount
  technicianLead: QaRoleAccount
  technicianHelper: QaRoleAccount
}

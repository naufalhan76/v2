// Consolidated types for Invoices domain.

import type { InvoiceStatus } from '@/lib/invoice-status'
import type { InvoiceSource } from '@/lib/invoice-utils'

export type { InvoiceStatus, InvoiceSource }

export interface Invoice {
  invoice_id: string
  invoice_number: string
  invoice_type: 'PROFORMA' | 'FINAL'
  source?: InvoiceSource
  order_id: string | null
  customer_id: string | null
  customer_name_override?: string | null
  customer_phone_override?: string | null
  customer_email_override?: string | null
  customer_address_override?: string | null
  invoice_date: string
  due_date: string
  service_type: string | null
  service_name: string | null
  base_service_quantity: number
  base_service_price: number | null
  base_service_total: number | null
  addons_subtotal: number
  subtotal: number
  discount_amount: number
  discount_percentage: number
  tax_percentage: number
  tax_amount: number
  total_amount: number
  status: InvoiceStatus
  computed_status?: InvoiceStatus
  payment_status: string
  paid_amount: number
  notes: string | null
  terms_conditions: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  customers?: {
    customer_id: string
    customer_name: string
    phone_number: string
    email: string
    billing_address?: string | null
  }
  orders?: {
    order_id: string
    order_type: string
    status: string
  }
}

export interface InvoiceItem {
  item_id: string
  invoice_id: string
  item_type: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  service_type: string | null
  addon_id: string | null
  order_addon_id: string | null
  line_order: number
  created_at: string
}

export interface PaymentRecord {
  payment_id: string
  invoice_id: string
  payment_date: string
  payment_method: string
  amount: number
  reference_number: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export interface CreateInvoiceInput {
  order_id: string
  customer_id: string
  invoice_type: 'PROFORMA' | 'FINAL'
  due_date: string
  service_type: string
  service_name: string
  base_service_price: number
  items: Array<{
    item_type: 'BASE_SERVICE' | 'ADDON'
    description: string
    quantity: number
    unit_price: number
    service_type?: string
    addon_id?: string
    order_addon_id?: string
  }>
  discount_amount?: number
  discount_percentage?: number
  notes?: string
  payment_account_id?: string
  payment_account_label?: string
  payment_bank_name?: string
  payment_account_number?: string
  payment_account_name?: string
  tax_percentage?: number
}

export interface OrderItemForInvoice {
  serviceType: string
  serviceName: string
  msnCode?: string
  unitTypeName?: string
  capacityLabel?: string
  quantity: number
  estimatedPrice: number
}

export type InvoiceType = 'PROFORMA' | 'FINAL'

export interface InvoiceOrder {
  order_id: string
  customer_id: string
  status: string
  order_type: string
  customers?: {
    customer_name?: string | null
    phone_number?: string | null
  } | null
}

export interface ReviseInvoiceItemInput {
  item_id?: string
  item_type?: 'BASE_SERVICE' | 'ADDON'
  description: string
  quantity: number
  unit_price: number
  service_type?: string | null
  addon_id?: string | null
  order_addon_id?: string | null
  line_order?: number
}

export type InvoiceRevisionHeaderUpdates =
  Partial<InvoiceRevisionHeaderFieldValueMap> &
  Record<string, unknown>

export type CreateBlankInvoiceResult =
  | { success: true; data: Invoice }
  | { success: false; error: string }

interface InvoiceRevisionHeaderFieldValueMap {
  customer_id: string | null
  customer_name_override: string | null
  customer_phone_override: string | null
  customer_email_override: string | null
  customer_address_override: string | null
  due_date: string | null
  notes: string | null
  terms_conditions: string | null
  discount_amount: number | null
  discount_percentage: number | null
  tax_percentage: number | null
  payment_account_id: string | null
  payment_account_label: string | null
  payment_bank_name: string | null
  payment_account_number: string | null
  payment_account_name: string | null
}

const ALLOWED_REVISION_FIELDS = [
  'customer_id',
  'customer_name_override',
  'customer_phone_override',
  'customer_email_override',
  'customer_address_override',
  'due_date',
  'notes',
  'terms_conditions',
  'discount_amount',
  'discount_percentage',
  'tax_percentage',
  'payment_account_id',
  'payment_account_label',
  'payment_bank_name',
  'payment_account_number',
  'payment_account_name',
] as const

export { ALLOWED_REVISION_FIELDS }

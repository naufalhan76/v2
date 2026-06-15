// Consolidated types for Reminders domain.

import type {
  ReminderChannel,
  ReminderRule,
  CustomerReminder,
  ReminderStatus,
  ReminderTemplateContext,
} from '@/lib/reminder-utils'

export type { ReminderChannel, ReminderRule, CustomerReminder, ReminderStatus, ReminderTemplateContext }

export type ActionResult<T = void> =
  | { success: true; data: T; error?: undefined }
  | { success: true; error?: undefined }
  | { success: false; error: string; data?: undefined }

export interface ReminderRuleInput {
  name: string
  days_before_due: number
  channel: ReminderChannel
  message_template: string
  is_active?: boolean
  auto_send?: boolean
}

export type ReminderRulePatch = Partial<ReminderRuleInput>

export interface CustomerReminderFilters {
  status?: string
  customer_id?: string
  date_from?: string // ISO date — filters by due_date >= date_from
  date_to?: string // ISO date — filters by due_date <= date_to
  page?: number
  limit?: number
}

export interface ReminderRow {
  reminder_id: string
  customer_id: string | null
  ac_unit_id: string | null
  service_report_id: string | null
  rule_id: string | null
  due_date: string
  channel: ReminderChannel
  recipient: string
  message: string
  status: ReminderStatus
  sent_at: string | null
  external_id: string | null
  error_message: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers?: {
    customer_id: string
    customer_name: string
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
  } | null
  ac_units?: {
    ac_unit_id: string
    brand?: string | null
    model_number?: string | null
    ac_brands?: { name: string } | null
  } | null
}

export interface ReminderAcUnitRow {
  ac_unit_id: string
  brand: string | null
  model_number: string | null
  next_service_due_date: string | null
  locations: {
    location_id: string
    full_address: string | null
    city: string | null
    customers: {
      customer_id: string
      customer_name: string | null
      phone_number: string | null
      email: string | null
    } | null
  } | null
}

export interface RawServicedAcUnitRow {
  ac_unit_id: string
  brand: string | null
  model_number: string | null
  ac_type: string | null
  capacity_btu: number | null
  last_service_date: string | null
  next_service_due_date: string | null
  location_id: string | null
  ac_brands: { name: string } | null
  unit_types: { name: string } | null
  locations: {
    location_id: string
    full_address: string | null
    house_number: string | null
    city: string | null
    customers: {
      customer_id: string
      customer_name: string | null
      phone_number: string | null
    } | null
  } | null
}

export type ServicedAcStatusFilter =
  | 'all'
  | 'overdue'
  | 'due_soon'
  | 'upcoming'
  | 'no_date'

export interface ServicedAcFilters {
  status?: ServicedAcStatusFilter
  search?: string
  date_from?: string // ISO date — next_service_due_date >= date_from
  date_to?: string // ISO date — next_service_due_date <= date_to
  page?: number
  limit?: number
}

export interface ServicedAcUnitRow {
  ac_unit_id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  location_id: string | null
  location_address: string | null
  brand: string | null
  model_number: string | null
  ac_type: string | null
  unit_type_name: string | null
  capacity_btu: number | null
  last_service_date: string | null
  next_service_due_date: string | null
  has_pending_reminder: boolean
  reminder_count: number
  last_reminder_sent_at: string | null
  latest_order_status: string | null
  latest_service_type: string | null
}

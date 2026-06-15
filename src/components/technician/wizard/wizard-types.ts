import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import type { LocalJobSnapshot } from '@/lib/offline/snapshot'

export type JobSummary = {
  customerName: string
  address: string
  serviceType: string
}

export type JobContext = {
  order_id: string
  status: string
  canonical_status: string
  has_report: boolean
  report_id: string | null
  description?: string | null
  scheduled_visit_date?: string | null
  customers?: {
    customer_id?: string | null
    customer_name?: string | null
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
  } | null
  order_items?: Array<{
    order_item_id: string
    ac_unit_id?: string | null
    service_type?: string | null
    quantity?: number | null
    description?: string | null
    estimated_price?: number | null
    locations?: {
      location_id?: string | null
      full_address?: string | null
      house_number?: string | null
      city?: string | null
    } | null
    ac_units?: {
      ac_unit_id: string
      brand?: string | null
      brand_id?: string | null
      model_number?: string | null
      serial_number?: string | null
      installation_date?: string | null
      ac_type?: string | null
      unit_type_id?: string | null
      capacity_id?: string | null
      room_location?: string | null
      floor_level?: string | null
      position_detail?: string | null
      capacity_ranges?: {
        capacity_label?: string | null
      } | Array<{ capacity_label?: string | null }> | null
    } | null
  }>
  order_technicians?: Array<{
    id: string
    technician_id: string
    role: string
    assigned_at?: string | null
    technicians?: {
      technician_id: string
      technician_name?: string | null
      contact_number?: string | null
    } | null
  }>
}

export interface WizardOrchestratorProps {
  orderId: string
  snapshot?: LocalJobSnapshot
}

export type Phase = 'A' | 'B' | 'C' | 'done'

export type ExtractedAcUnit = AcUnitReportItem

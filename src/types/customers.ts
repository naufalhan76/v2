// Consolidated types for Customers domain.

export interface Customer {
  customer_id: string
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes?: string | null
  locations?: Array<{
    location_id: string
    full_address?: string | null
    house_number?: string | null
    city?: string | null
    landmarks?: string | null
    ac_units?: Array<{ ac_unit_id: string }>
  }>
}

export interface Location {
  location_id: string
  customer_id: string
  full_address: string
  house_number: string
  city: string
  landmarks?: string | null
}

export interface AcUnit {
  ac_unit_id: string
  location_id: string
  brand: string
  model_number: string
  serial_number: string
  ac_type?: string | null
  capacity_btu?: number | null
  installation_date?: string | null
  status: string
  last_service_date?: string | null
  next_service_due_date?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  brand_id?: string | null
  unit_types?: { name?: string | null } | null
  capacity_ranges?: { capacity_label?: string | null } | null
  ac_brands?: { name?: string | null } | null
}

export interface OrderRow {
  order_id: string
  status: string | null
  scheduled_visit_date?: string | null
  req_visit_date?: string | null
  created_at?: string | null
  order_items?: Array<{
    estimated_price?: number | null
    actual_price?: number | null
  }>
}

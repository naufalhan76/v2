'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/utils'

export async function getAcUnits(filters?: {
  search?: string
  locationId?: string
  status?: string
  page?: number
  limit?: number
}) {
  try {
    const supabase = await createClient()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    let query = supabase
      .from('ac_units')
      .select(`
        *,
        unit_types (unit_type_id, name),
        capacity_ranges (capacity_id, capacity_label),
        ac_brands (brand_id, name),
        locations (
          location_id, full_address, house_number, city,
          customers (customer_id, customer_name, primary_contact_person, phone_number)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    
    if (filters?.search) {
      const sanitized = sanitizeSearchTerm(filters.search)
      query = query.or(`brand.ilike.%${sanitized}%,model_number.ilike.%${sanitized}%,serial_number.ilike.%${sanitized}%`)
    }
    
    if (filters?.locationId) {
      query = query.eq('location_id', filters.locationId)
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return {
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: unknown) {
    logger.error('Error fetching AC units:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AC units',
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getAcUnitById(acUnitId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ac_units')
      .select(`
        *,
        ac_brands (brand_id, name),
        locations (
          location_id, full_address, house_number, city,
          customers (customer_id, customer_name, primary_contact_person, phone_number, email)
        ),
        service_records (
          service_id, order_id, service_date, service_type, cost,
          next_service_due, orders (status),
          technicians (technician_id, technician_name, contact_number)
        )
      `)
      .eq('ac_unit_id', acUnitId)
      .single()
    
    if (error) throw error
    
    const serviceRecords = Array.isArray(data?.service_records)
      ? data.service_records.map((record: Record<string, unknown>) => {
          const order = Array.isArray(record.orders) ? record.orders[0] : record.orders
          const { orders: _orders, ...rest } = record
          return {
            ...rest,
            status: order && typeof order === 'object' && 'status' in order
              ? (order as { status: unknown }).status ?? null
              : null,
          }
        })
      : data?.service_records

    return {
      success: true,
      data: data ? { ...data, service_records: serviceRecords } : data,
    }
  } catch (error: unknown) {
    logger.error('Error fetching AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AC unit',
    }
  }
}

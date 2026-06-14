'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getOrders(filters?: {
  status?: string
  statusIn?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  withCount?: boolean
}) {
  try {
    const supabase = await createClient()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number,
          email
        ),
        order_items (
          order_item_id,
          location_id,
          service_type,
          quantity,
          estimated_price,
          locations (
            location_id,
            full_address,
            house_number,
            city
          )
        ),
        order_technicians (
          id,
          technician_id,
          role,
          assigned_at,
          technicians (
            technician_id,
            technician_name,
            contact_number
          )
        )
      `, { count: filters?.withCount ? 'exact' : undefined })
      .order('created_at', { ascending: false })
      .is('deleted_at', null)
      .range(from, to)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.statusIn) {
      const statuses = filters.statusIn.split(',')
      query = query.in('status', statuses)
    }

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      success: true,
      data: data || [],
      pagination: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    }
  } catch (error: unknown) {
    logger.error('Supabase getOrders error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : JSON.stringify(error),
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getOrderById(orderId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number,
          email,
          billing_address
        ),
        order_items (
          order_item_id,
          location_id,
          ac_unit_id,
          service_type,
          quantity,
          description,
          estimated_price,
          actual_price,
          status,
          locations (
            location_id,
            full_address,
            house_number,
            city
          ),
          ac_units (
            ac_unit_id,
            brand,
            model_number,
            serial_number,
            installation_date
          )
        ),
        order_technicians (
          id,
          technician_id,
          role,
          assigned_at,
          technicians (
            technician_id,
            technician_name,
            contact_number
          )
        )
      `)
      .eq('order_id', orderId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: unknown) {
    logger.error('Error fetching order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order',
    }
  }
}

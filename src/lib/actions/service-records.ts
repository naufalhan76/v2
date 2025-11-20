'use server'

import { createClient } from '@/lib/supabase-server'

export async function getServiceRecords(filters?: {
  search?: string
  dateFrom?: string
  dateTo?: string
  sortByNextService?: boolean
  page?: number
  limit?: number
}) {
  try {
    const supabase = await createClient()
    const page = filters?.page || 1
    const limit = filters?.limit || 100
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    let query = supabase
      .from('service_records')
      .select(`
        *,
        ac_units (
          ac_unit_id,
          brand,
          model_number,
          serial_number,
          ac_type,
          capacity_btu,
          status,
          location_id,
          locations (
            location_id,
            customer_id,
            full_address,
            house_number,
            city,
            customers (
              customer_id,
              customer_name,
              primary_contact_person,
              phone_number,
              email,
              billing_address
            )
          )
        ),
        orders (
          order_id,
          order_type,
          status
        )
      `, { count: 'exact' })
      .range(from, to)
    
    // Sort by next_service_due (nearest first)
    if (filters?.sortByNextService !== false) {
      query = query.order('next_service_due', { ascending: true, nullsFirst: false })
    } else {
      query = query.order('service_date', { ascending: false })
    }
    
    // Date range filter on service_date
    if (filters?.dateFrom) {
      query = query.gte('service_date', filters.dateFrom)
    }
    
    if (filters?.dateTo) {
      query = query.lte('service_date', filters.dateTo)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('Error fetching service records:', error)
      throw error
    }
    
    // Apply search filter on client side (since we need to search nested data)
    let filteredData = data || []
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      filteredData = filteredData.filter((record: any) => {
        const customerName = record.ac_units?.locations?.customers?.customer_name?.toLowerCase() || ''
        const brand = record.ac_units?.brand?.toLowerCase() || ''
        const model = record.ac_units?.model_number?.toLowerCase() || ''
        const orderId = record.order_id?.toLowerCase() || ''
        
        return customerName.includes(searchLower) || 
               brand.includes(searchLower) || 
               model.includes(searchLower) ||
               orderId.includes(searchLower)
      })
    }
    
    return {
      success: true,
      data: filteredData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error('Error fetching service records:', error)
    return {
      success: false,
      error: error.message,
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getServiceRecordById(serviceId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('service_records')
      .select(`
        *,
        ac_units (
          ac_unit_id,
          brand,
          model_number,
          serial_number,
          ac_type,
          capacity_btu,
          installation_date,
          status,
          last_service_date,
          location_id,
          locations (
            location_id,
            customer_id,
            full_address,
            house_number,
            city,
            customers (
              customer_id,
              customer_name,
              primary_contact_person,
              phone_number,
              email,
              billing_address,
              notes
            )
          )
        ),
        orders (
          order_id,
          order_date,
          order_type,
          description,
          status
        )
      `)
      .eq('service_id', serviceId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching service record:', error)
    return {
      success: false,
      error: error.message,
      data: null,
    }
  }
}

export async function updateServiceRecord(
  serviceId: string,
  updates: {
    next_service_due?: string | null
    service_type?: string
    notes?: string
  }
) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('service_records')
      .update(updates)
      .eq('service_id', serviceId)
      .select()
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
      message: 'Service record updated successfully',
    }
  } catch (error: any) {
    console.error('Error updating service record:', error)
    return {
      success: false,
      error: error.message,
      data: null,
    }
  }
}

export async function trackReminder(serviceId: string, orderId: string, phoneNumber: string) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('service_reminders')
      .insert({
        service_id: serviceId,
        order_id: orderId,
        reminder_type: 'WHATSAPP',
        recipient_phone: phoneNumber,
        status: 'sent'
      })
    
    if (error) throw error
    
    return {
      success: true,
      message: 'Reminder logged successfully'
    }
  } catch (error: any) {
    console.error('Error tracking reminder:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

export async function getReminderStats(serviceId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('service_reminders')
      .select('reminder_id, sent_at')
      .eq('service_id', serviceId)
      .eq('reminder_type', 'WHATSAPP')
      .order('sent_at', { ascending: false })
    
    if (error) throw error
    
    const count = data?.length || 0
    const lastSentAt = data?.[0]?.sent_at || null
    
    return {
      success: true,
      count,
      lastSentAt
    }
  } catch (error: any) {
    console.error('Error fetching reminder stats:', error)
    return {
      success: false,
      count: 0,
      lastSentAt: null,
      error: error.message
    }
  }
}
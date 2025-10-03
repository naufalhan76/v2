'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getOrders(filters?: {
  status?: string
  statusIn?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
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
        locations (
          location_id,
          building_name,
          floor,
          room_number,
          description
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
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
      query = query.gte('created_at', filters.dateFrom)
    }
    
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo)
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
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch orders',
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
        locations (
          location_id,
          building_name,
          floor,
          room_number,
          description
        )
      `)
      .eq('order_id', orderId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching order:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch order',
    }
  }
}

export async function createOrder(orderData: {
  customer_id: string
  location_id: string
  order_type: string
  priority: string
  description?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...orderData,
        status: 'NEW',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error creating order:', error)
    return {
      success: false,
      error: error.message || 'Failed to create order',
    }
  }
}

export async function updateOrderStatus(orderId: string, newStatus: string, notes?: string) {
  try {
    const supabase = await createClient()
    
    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Update order status
    const { data, error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .select()
      .single()
    
    if (error) throw error
    
    // Record status transition
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: currentOrder.status,
      to_status: newStatus,
      notes,
      transition_date: new Date().toISOString(),
    })
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error updating order status:', error)
    return {
      success: false,
      error: error.message || 'Failed to update order status',
    }
  }
}

export async function assignOrdersToTechnician(data: {
  orderIds: string[]
  technicianId: string
  scheduledDate: string
}) {
  try {
    console.log('Assigning orders:', data)
    const supabase = await createClient()
    
    // Update all selected orders
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'ASSIGNED',
        assigned_technician_id: data.technicianId,
        scheduled_visit_date: data.scheduledDate,
        updated_at: new Date().toISOString()
      })
      .in('order_id', data.orderIds)
    
    if (orderError) {
      console.error('Order update error:', orderError)
      throw orderError
    }
    
    console.log('Orders assigned successfully')
    revalidatePath('/dashboard/operasional/assign-order')
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      message: `Successfully assigned ${data.orderIds.length} order(s) to technician`
    }
  } catch (error: any) {
    console.error('Error assigning orders:', error)
    return {
      success: false,
      error: error.message || 'Failed to assign orders',
    }
  }
}

export async function deleteOrder(orderId: string) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('order_id', orderId)
    
    if (error) throw error
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete order',
    }
  }
}

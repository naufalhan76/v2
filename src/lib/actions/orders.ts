'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  sendJobAssignedNotification,
  sendJobRescheduledNotification,
  sendJobReassignedAwayNotification,
} from '@/lib/server/push-sender'

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
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    }
    
    if (filters?.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
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
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: unknown) {
    logger.error('Error fetching orders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
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
        status: 'PENDING',
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
  } catch (error: unknown) {
    logger.error('Error creating order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    }
  }
}

export async function updateOrderStatus(orderId: string, newStatus: string, notes?: string, reqVisitDate?: string, useAdminClient = false) {
  try {
    // Use admin client if specified (for API routes that bypass RLS)
    const supabase = useAdminClient 
      ? (await import('@/lib/supabase-admin')).createAdminClient()
      : await createClient()
    
    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    // If status is RESCHEDULE, update req_visit_date and reset technician assignment
    if (newStatus === 'RESCHEDULE') {
      if (reqVisitDate) {
        updateData.req_visit_date = reqVisitDate
      }
      updateData.assigned_technician_id = null
      
      // Delete all technician assignments for this order
      const { error: deleteError } = await supabase
        .from('order_technicians')
        .delete()
        .eq('order_id', orderId)
      
      if (deleteError) {
        logger.error('Error deleting technician assignments:', deleteError)
        throw deleteError
      }
    }
    
    // Update order status (and potentially scheduled_visit_date)
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
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
  } catch (error: unknown) {
    logger.error('Error updating order status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order status',
    }
  }
}

export async function assignOrdersToTechnician(data: {
  orderIds: string[]
  technicianId: string
  helperTechnicianIds?: string[]
  scheduledDate: string
}) {
  try {
    logger.debug('Assigning orders:', data)
    const supabase = await createClient()

    // 1. Capture previous leads BEFORE mutating, so we can notify the OLD
    //    technicians that the job has moved away.
    const { data: prevLeads } = await supabase
      .from('order_technicians')
      .select('order_id, technician_id')
      .in('order_id', data.orderIds)
      .eq('role', 'lead')

    const previousLeadByOrder = new Map<string, string>()
    for (const row of prevLeads ?? []) {
      previousLeadByOrder.set(row.order_id, row.technician_id)
    }

    // 2. Update orders
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'ASSIGNED',
        assigned_technician_id: data.technicianId,
        scheduled_visit_date: data.scheduledDate,
        updated_at: new Date().toISOString(),
      })
      .in('order_id', data.orderIds)
    if (orderError) {
      logger.error('Order update error:', orderError)
      throw orderError
    }

    // 3. Replace technician assignments
    //    First, delete existing assignments for these orders
    const { error: deleteAssignError } = await supabase
      .from('order_technicians')
      .delete()
      .in('order_id', data.orderIds)
    if (deleteAssignError) {
      logger.error('Failed to clear existing assignments:', deleteAssignError)
      throw deleteAssignError
    }

    //    Then insert new lead + helpers
    const technicianAssignments: Array<{
      order_id: string
      technician_id: string
      role: 'lead' | 'helper'
      assigned_at: string
    }> = []
    for (const orderId of data.orderIds) {
      technicianAssignments.push({
        order_id: orderId,
        technician_id: data.technicianId,
        role: 'lead',
        assigned_at: new Date().toISOString(),
      })
      if (data.helperTechnicianIds && data.helperTechnicianIds.length > 0) {
        for (const helperId of data.helperTechnicianIds) {
          technicianAssignments.push({
            order_id: orderId,
            technician_id: helperId,
            role: 'helper',
            assigned_at: new Date().toISOString(),
          })
        }
      }
    }

    if (technicianAssignments.length > 0) {
      const { error: assignError } = await supabase
        .from('order_technicians')
        .insert(technicianAssignments)
      if (assignError) {
        logger.error('Technician assignment error:', assignError)
        throw assignError
      }
    }

    logger.debug('Orders assigned successfully')
    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/operasional/assign-order')
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    revalidatePath('/dashboard')

    // 4. Fire notifications — best effort, never throws.
    //    a. Notify NEW lead per order
    //    b. If a previous DIFFERENT lead existed, notify them they were
    //       reassigned away.
    void Promise.allSettled(
      data.orderIds.flatMap((orderId) => {
        const tasks = [sendJobAssignedNotification(orderId, data.technicianId)]
        const prev = previousLeadByOrder.get(orderId)
        if (prev && prev !== data.technicianId) {
          tasks.push(sendJobReassignedAwayNotification(orderId, prev))
        }
        return tasks
      })
    )

    return {
      success: true,
      message: `Successfully assigned ${data.orderIds.length} order(s) to technician`,
    }
  } catch (error: unknown) {
    logger.error('Error assigning orders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign orders',
    }
  }
}

export async function addHelperTechnician(orderId: string, helperTechnicianId: string) {
  try {
    const supabase = await createClient()
    
    // Insert helper technician
    const { error } = await supabase
      .from('order_technicians')
      .insert({
        order_id: orderId,
        technician_id: helperTechnicianId,
        role: 'helper',
        assigned_at: new Date().toISOString()
      })
    
    if (error) throw error
    
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      message: 'Helper technician added successfully'
    }
  } catch (error: unknown) {
    logger.error('Error adding helper technician:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add helper technician',
    }
  }
}

export async function removeHelperTechnician(orderId: string, helperTechnicianId: string) {
  try {
    const supabase = await createClient()
    
    // Delete helper technician
    const { error } = await supabase
      .from('order_technicians')
      .delete()
      .eq('order_id', orderId)
      .eq('technician_id', helperTechnicianId)
      .eq('role', 'helper')
    
    if (error) throw error
    
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      message: 'Helper technician removed successfully'
    }
  } catch (error: unknown) {
    logger.error('Error removing helper technician:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove helper technician',
    }
  }
}

export async function cancelOrder(orderId: string, reason?: string) {
  try {
    const supabase = await createClient()
    
    // Get current order status
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Get all AC units created from this order's items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('ac_unit_id')
      .eq('order_id', orderId)
      .not('ac_unit_id', 'is', null)
    
    if (itemsError) throw itemsError
    
    const acUnitIds = orderItems
      ?.map(item => item.ac_unit_id)
      .filter((id): id is string => id !== null) || []
    
    // Update AC units that are still pending to inactive
    if (acUnitIds.length > 0) {
      const { error: acUpdateError } = await supabase
        .from('ac_units')
        .update({ 
          status: 'INACTIVE',
          updated_at: new Date().toISOString()
        })
        .in('ac_unit_id', acUnitIds)
        .eq('status', 'ACTIVE') // Only deactivate currently active units
      
      if (acUpdateError) {
        logger.error('Error updating AC units status:', acUpdateError)
        // Don't throw, continue with order cancellation
      }
    }
    
    // Update order status to CANCELLED
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single()
    
    if (error) throw error
    
    // Record status transition
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: currentOrder.status,
      to_status: 'CANCELLED',
      notes: reason || 'Order cancelled',
      transition_date: new Date().toISOString(),
    })
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/operasional/accept-order')
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    
    return {
      success: true,
      data,
      message: 'Order cancelled successfully'
    }
  } catch (error: unknown) {
    logger.error('Error cancelling order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order',
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
  } catch (error: unknown) {
    logger.error('Error deleting order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete order',
    }
  }
}

export async function rescheduleOrder(params: {
  orderId: string
  reason: string
  newScheduledDate: string
}) {
  try {
    const supabase = await createClient()

    // 1. Capture current state (for transition log + previous lead)
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', params.orderId)
      .single()
    if (fetchError) throw fetchError

    const { data: prevLeadRow } = await supabase
      .from('order_technicians')
      .select('technician_id')
      .eq('order_id', params.orderId)
      .eq('role', 'lead')
      .maybeSingle()
    const previousLeadId = prevLeadRow?.technician_id ?? null

    // 2. Reset to PENDING + clear assignments + set new date
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'PENDING',
        assigned_technician_id: null,
        scheduled_visit_date: params.newScheduledDate,
        req_visit_date: params.newScheduledDate,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', params.orderId)
    if (updateError) throw updateError

    const { error: deleteError } = await supabase
      .from('order_technicians')
      .delete()
      .eq('order_id', params.orderId)
    if (deleteError) {
      logger.error('Error clearing technician assignments on reschedule:', deleteError)
      throw deleteError
    }

    // 3. Log transition
    await supabase.from('order_status_transitions').insert({
      order_id: params.orderId,
      from_status: currentOrder.status,
      to_status: 'PENDING',
      notes: `Reschedule: ${params.reason}`,
      transition_date: new Date().toISOString(),
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard')

    // 4. Notify previous lead (best effort) — they cared about this job
    if (previousLeadId) {
      void sendJobRescheduledNotification(
        params.orderId,
        previousLeadId,
        params.newScheduledDate
      ).catch(() => undefined)
    }

    return { success: true, message: 'Order rescheduled' }
  } catch (error: unknown) {
    logger.error('Error rescheduling order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule order',
    }
  }
}

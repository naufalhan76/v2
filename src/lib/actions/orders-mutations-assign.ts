'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  sendJobAssignedNotification,
  sendJobReassignedAwayNotification,
} from '@/lib/server/push-sender'

export async function assignOrdersToTechnician(data: {
  orderIds: string[]
  technicianId: string
  helperTechnicianIds?: string[]
  scheduledDate: string
}) {
  try {
    logger.debug('Assigning orders:', data)
    const supabase = await createClient()

    const { data: prevLeads } = await supabase
      .from('order_technicians')
      .select('order_id, technician_id')
      .in('order_id', data.orderIds)
      .eq('role', 'lead')

    const previousLeadByOrder = new Map<string, string>()
    for (const row of prevLeads ?? []) {
      previousLeadByOrder.set(row.order_id, row.technician_id)
    }

    const { data: prevOrders } = await supabase
      .from('orders')
      .select('order_id, status')
      .in('order_id', data.orderIds)

    const previousStatusByOrder = new Map<string, string>()
    for (const row of prevOrders ?? []) {
      previousStatusByOrder.set(row.order_id, row.status)
    }

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

    const transitionRows = data.orderIds
      .map((orderId) => {
        const fromStatus = previousStatusByOrder.get(orderId)
        if (!fromStatus || fromStatus === 'ASSIGNED') return null
        return {
          order_id: orderId,
          from_status: fromStatus,
          to_status: 'ASSIGNED' as const,
          notes:
            fromStatus === 'PENDING'
              ? 'Assigned to technician'
              : `Reassigned by admin (was ${fromStatus})`,
          transition_date: new Date().toISOString(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (transitionRows.length > 0) {
      const { error: transitionError } = await supabase
        .from('order_status_transitions')
        .insert(transitionRows)
      if (transitionError) {
        logger.warn('Failed to log assignment transitions:', transitionError)
      }
    }

    const { error: deleteAssignError } = await supabase
      .from('order_technicians')
      .delete()
      .in('order_id', data.orderIds)
    if (deleteAssignError) {
      logger.error('Failed to clear existing assignments:', deleteAssignError)
      throw deleteAssignError
    }

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
    
    return { success: true, message: 'Helper technician added successfully' }
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
    
    const { error } = await supabase
      .from('order_technicians')
      .delete()
      .eq('order_id', orderId)
      .eq('technician_id', helperTechnicianId)
      .eq('role', 'helper')
    
    if (error) throw error
    
    revalidatePath('/dashboard/operasional/monitoring-ongoing')
    revalidatePath('/dashboard')
    
    return { success: true, message: 'Helper technician removed successfully' }
  } catch (error: unknown) {
    logger.error('Error removing helper technician:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove helper technician',
    }
  }
}

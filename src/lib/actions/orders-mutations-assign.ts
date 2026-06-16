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

    const { error: rpcError } = await supabase.rpc('assign_order_to_technician', {
      p_order_ids: data.orderIds,
      p_lead_technician_id: data.technicianId,
      p_helper_ids: data.helperTechnicianIds || [],
      p_scheduled_date: data.scheduledDate,
    })

    if (rpcError) {
      logger.error('Assignment RPC error:', rpcError)
      throw new Error(rpcError.message)
    }

    logger.debug('Orders assigned successfully via RPC')
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

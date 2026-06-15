'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { canTransition, toCanonical, type TransitionRole } from '@/lib/order-status'
import { sendJobCancelledByAdminNotification } from '@/lib/server/push-sender'

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  notes?: string,
  reqVisitDate?: string,
  useAdminClient = false,
  callerRole?: TransitionRole
) {
  try {
    const supabase = useAdminClient 
      ? (await import('@/lib/supabase-admin')).createAdminClient()
      : await createClient()
    
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    
    if (fetchError) throw fetchError

    let resolvedRole = callerRole
    if (!resolvedRole) {
      const userClient = await createClient()
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) {
        return { success: false, error: 'Tidak terautentikasi' }
      }

      const { data: userMgmt } = await supabase
        .from('user_management')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

      resolvedRole = userMgmt?.role as TransitionRole | undefined
    }

    if (!resolvedRole) {
      return { success: false, error: 'Role pengguna tidak ditemukan' }
    }

    const canonicalNew = toCanonical(newStatus)

    if (!canTransition(currentOrder.status, canonicalNew, resolvedRole)) {
      return {
        success: false,
        error: `Transisi dari ${currentOrder.status} ke ${newStatus} tidak diizinkan untuk role ${resolvedRole}`,
      }
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    if (newStatus === 'RESCHEDULE') {
      if (reqVisitDate) {
        updateData.req_visit_date = reqVisitDate
      }
      updateData.assigned_technician_id = null
      
      const { error: deleteError } = await supabase
        .from('order_technicians')
        .delete()
        .eq('order_id', orderId)
      
      if (deleteError) {
        logger.error('Error deleting technician assignments:', deleteError)
        throw deleteError
      }
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_id', orderId)
      .select()
      .single()
    
    if (error) throw error
    
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: currentOrder.status,
      to_status: newStatus,
      notes,
      transition_date: new Date().toISOString(),
    })
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return { success: true, data }
  } catch (error: unknown) {
    logger.error('Error updating order status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order status',
    }
  }
}

export async function cancelOrder(orderId: string, reason?: string) {
  try {
    const supabase = await createClient()
    
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()
    
    if (fetchError) throw fetchError

    const terminalStatuses = ['PAID', 'CANCELLED']
    if (terminalStatuses.includes(currentOrder.status)) {
      return { success: false, error: `Order dengan status ${currentOrder.status} tidak dapat dibatalkan` }
    }

    const activeAssignmentStatuses = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS']
    let assignedTechnicianIds: string[] = []
    if (activeAssignmentStatuses.includes(currentOrder.status)) {
      const { data: assignments } = await supabase
        .from('order_technicians')
        .select('technician_id')
        .eq('order_id', orderId)
      assignedTechnicianIds = (assignments ?? []).map((a) => a.technician_id)
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('ac_unit_id')
      .eq('order_id', orderId)
      .not('ac_unit_id', 'is', null)
    
    if (itemsError) throw itemsError
    
    const acUnitIds = orderItems
      ?.map(item => item.ac_unit_id)
      .filter((id): id is string => id !== null) || []
    
    if (acUnitIds.length > 0) {
      const { error: acUpdateError } = await supabase
        .from('ac_units')
        .update({ 
          status: 'INACTIVE',
          updated_at: new Date().toISOString()
        })
        .in('ac_unit_id', acUnitIds)
        .eq('status', 'ACTIVE')
      
      if (acUpdateError) {
        logger.error('Error updating AC units status:', acUpdateError)
      }
    }
    
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
    
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: currentOrder.status,
      to_status: 'CANCELLED',
      notes: reason || 'Order cancelled',
      transition_date: new Date().toISOString(),
    })
    
    try {
      const { data: proformas } = await supabase
        .from('invoices')
        .select('invoice_id')
        .eq('order_id', orderId)
        .eq('invoice_type', 'PROFORMA')
        .neq('status', 'CANCELLED')

      if (proformas?.length) {
        await supabase
          .from('invoices')
          .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
          .in('invoice_id', proformas.map(p => p.invoice_id))
        logger.info(`cancelOrder cascaded ${proformas.length} PROFORMA invoices for ${orderId}`)
      }
    } catch (cascadeError) {
      logger.warn('cancelOrder: failed to cascade-cancel PROFORMA invoices:', cascadeError)
    }

    revalidatePath('/orders')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/operasional/accept-order')
    revalidatePath('/dashboard/operasional/monitoring-ongoing')

    if (assignedTechnicianIds.length > 0) {
      void Promise.allSettled(
        assignedTechnicianIds.map((tid) =>
          sendJobCancelledByAdminNotification(orderId, tid)
        )
      )
    }

    return { success: true, data, message: 'Order cancelled successfully' }
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
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
    
    if (error) throw error
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error: unknown) {
    logger.error('Error deleting order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete order',
    }
  }
}

'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { sendJobRescheduledNotification } from '@/lib/server/push-sender'

export async function createOrder(orderData: {
  customer_id: string
  location_id: string
  order_type: string
  priority: string
  description?: string
}) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({ ...orderData, status: 'PENDING', created_by: user.id })
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return { success: true, data }
  } catch (error: unknown) {
    logger.error('Error creating order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
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
      .is('removed_at', null)
      .maybeSingle()
    const previousLeadId = prevLeadRow?.technician_id ?? null

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

    await supabase.from('order_status_transitions').insert({
      order_id: params.orderId,
      from_status: currentOrder.status,
      to_status: 'PENDING',
      notes: `Reschedule: ${params.reason}`,
      transition_date: new Date().toISOString(),
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard')

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

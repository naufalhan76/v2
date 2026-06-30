'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { ADMIN_ROLES, type UserRole } from '@/lib/rbac'
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
    // ponytail: dedup orderIds to avoid inflated capacity counts and duplicate RPC work
    data.orderIds = [...new Set(data.orderIds)]

    logger.debug('Assigning orders:', data)
    const supabase = await createClient()

    const { data: prevLeads } = await supabase
      .from('order_technicians')
      .select('order_id, technician_id')
      .in('order_id', data.orderIds)
      .eq('role', 'lead')
      .is('removed_at', null)

    const previousLeadByOrder = new Map<string, string>()
    for (const row of prevLeads ?? []) {
      previousLeadByOrder.set(row.order_id, row.technician_id)
    }

    // Schedule conflict detection: check lead technician capacity for the scheduled date
    const maxPerDay = parseInt(process.env.MAX_ORDERS_PER_TECH_PER_DAY || '5', 10)

    const { data: existingAssignments } = await supabase
      .from('order_technicians')
      .select('order_id, orders!inner(scheduled_visit_date)')
      .eq('technician_id', data.technicianId)
      .eq('role', 'lead')
      .is('removed_at', null)
      .eq('orders.scheduled_visit_date', data.scheduledDate)

    const currentLeadCount = (existingAssignments ?? [])
      .filter(a => !data.orderIds.includes(a.order_id))
      .length

    const newTotal = currentLeadCount + data.orderIds.length
    if (newTotal > maxPerDay) {
      return {
        success: false,
        error: `Teknisi sudah memiliki ${currentLeadCount} order pada ${data.scheduledDate}. Maksimal ${maxPerDay} order per hari. Tidak bisa menambah ${data.orderIds.length} order lagi.`,
      }
    }

    // ponytail: filter lead tech out of helpers — ceiling: no server-side RPC guard yet
    const helperIds = (data.helperTechnicianIds || []).filter(id => id !== data.technicianId)

    // ponytail: reject past dates at app layer — ceiling: DB constraint would be stronger
    const today = new Date().toISOString().slice(0, 10)
    if (data.scheduledDate < today) {
      return { success: false, error: 'Tanggal tidak boleh di masa lalu' }
    }

    const { error: rpcError } = await supabase.rpc('assign_order_to_technician', {
      p_order_ids: data.orderIds,
      p_lead_technician_id: data.technicianId,
      p_helper_ids: helperIds,
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
    const msg = (error != null && typeof error === 'object' && 'message' in error)
      ? String((error as { message: unknown }).message)
      : 'Failed to assign orders'
    return {
      success: false,
      error: msg,
    }
  }
}

async function requireAdminRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { userId } = await auth()
  if (!userId) return { success: false as const, error: 'Unauthorized' }

  const { data: userMgmt, error: roleErr } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (roleErr || !userMgmt) {
    return { success: false as const, error: 'Role pengguna tidak ditemukan' }
  }

  if (!(ADMIN_ROLES as readonly string[]).includes(userMgmt.role)) {
    return { success: false as const, error: 'Unauthorized: ADMIN/SUPERADMIN role required' }
  }

  return { success: true as const }
}

export async function addHelperTechnician(orderId: string, helperTechnicianId: string) {
  try {
    const supabase = await createClient()

    const adminCheck = await requireAdminRole(supabase)
    if (!adminCheck.success) return adminCheck

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
      error: (error as { message?: string })?.message || 'Failed to add helper technician',
    }
  }
}

export async function removeHelperTechnician(orderId: string, helperTechnicianId: string) {
  try {
    const supabase = await createClient()

    const adminCheck = await requireAdminRole(supabase)
    if (!adminCheck.success) return adminCheck

    const { data: existing, error: selectErr } = await supabase
      .from('order_technicians')
      .select('technician_id')
      .eq('order_id', orderId)
      .eq('technician_id', helperTechnicianId)
      .eq('role', 'helper')
      .maybeSingle()

    if (selectErr) throw selectErr
    if (!existing) {
      return { success: false, error: 'Helper tidak ditemukan' }
    }

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
      error: (error as { message?: string })?.message || 'Failed to remove helper technician',
    }
  }
}

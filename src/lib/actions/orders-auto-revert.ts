'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { sendJobAutoRevertedNotification } from '@/lib/server/push-sender'

const log = logger.child('auto-revert-stale')

const STALE_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] as const

export interface AutoRevertResult {
  success: boolean
  reverted_count: number
  order_ids: string[]
  error?: string
}

export async function autoRevertStaleOrders(): Promise<AutoRevertResult> {
  try {
    const supabase = createAdminClient()
    // ponytail: hardcoded WIB (UTC+7) — use timezone-aware approach if deploying outside Indonesia
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

    const { data: staleOrders, error: fetchError } = await supabase
      .from('orders')
      .select('order_id, status, assigned_technician_id')
      .in('status', STALE_STATUSES as unknown as string[])
      .lt('scheduled_visit_date', today)
      .is('deleted_at', null)

    if (fetchError) {
      log.error('Failed to query stale orders', fetchError)
      return { success: false, reverted_count: 0, order_ids: [], error: fetchError.message }
    }

    if (!staleOrders || staleOrders.length === 0) {
      log.info('No stale orders found', { today })
      return { success: true, reverted_count: 0, order_ids: [] }
    }

    const orderIds = staleOrders.map((o) => o.order_id)
    log.info('Auto-reverting stale orders', { count: orderIds.length, today })

    const { data: assignments } = await supabase
      .from('order_technicians')
      .select('order_id, technician_id')
      .in('order_id', orderIds)
      .is('removed_at', null)

    const techsByOrder = new Map<string, string[]>()
    for (const row of assignments ?? []) {
      const list = techsByOrder.get(row.order_id) ?? []
      list.push(row.technician_id)
      techsByOrder.set(row.order_id, list)
    }

    const transitionRows = staleOrders.map((o) => ({
      order_id: o.order_id,
      from_status: o.status,
      to_status: 'PENDING' as const,
      notes: 'Auto-reverted: scheduled_visit_date passed without completion',
      transition_date: new Date().toISOString(),
    }))

    const revertedIds: string[] = []
    for (const order of staleOrders) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'PENDING',
          assigned_technician_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', order.order_id)
        .eq('status', order.status)

      if (updateError) {
        log.warn('Failed to revert order (may have been concurrently modified)', {
          orderId: order.order_id,
          fromStatus: order.status,
          error: updateError.message,
        })
        continue
      }
      revertedIds.push(order.order_id)
    }

    if (revertedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('order_technicians')
        .delete()
        .in('order_id', revertedIds)
      if (deleteError) {
        log.warn('Failed to clear order_technicians for reverted orders', {
          error: deleteError.message,
        })
      }

      const filteredTransitions = transitionRows.filter((r) =>
        revertedIds.includes(r.order_id)
      )
      const { error: transitionError } = await supabase
        .from('order_status_transitions')
        .insert(filteredTransitions)
      if (transitionError) {
        log.warn('Failed to insert transition log rows', { error: transitionError.message })
      }

      void Promise.allSettled(
        revertedIds.flatMap((orderId) => {
          const techs = techsByOrder.get(orderId) ?? []
          return techs.map((tid) => sendJobAutoRevertedNotification(orderId, tid))
        })
      )

      revalidatePath('/dashboard/orders')
      revalidatePath('/dashboard/operasional/accept-order')
      revalidatePath('/dashboard/operasional/assign-order')
      revalidatePath('/dashboard/operasional/monitoring-ongoing')
      revalidatePath('/dashboard')
    }

    log.info('Auto-revert complete', {
      attempted: orderIds.length,
      reverted: revertedIds.length,
    })

    return {
      success: true,
      reverted_count: revertedIds.length,
      order_ids: revertedIds,
    }
  } catch (error: unknown) {
    log.error('Unexpected error in autoRevertStaleOrders', error)
    return {
      success: false,
      reverted_count: 0,
      order_ids: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

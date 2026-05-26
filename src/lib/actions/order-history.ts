'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface OrderTransition {
  id: string
  order_id: string
  from_status: string | null
  to_status: string
  notes: string | null
  transition_date: string
}

export async function getOrderHistory(orderId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('order_status_transitions')
      .select('*')
      .eq('order_id', orderId)
      .order('transition_date', { ascending: false })

    if (error) throw error

    return { success: true, data: (data ?? []) as OrderTransition[] }
  } catch (error: unknown) {
    logger.error('Error fetching order history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order history',
      data: [] as OrderTransition[],
    }
  }
}

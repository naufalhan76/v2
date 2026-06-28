'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { OrderStatus } from '@/lib/order-status'

export interface CancelledNotificationRow {
  order_id: string
  status: OrderStatus
  updated_at: string
  scheduled_visit_date: string | null
  customer_name: string
}

interface RawNotificationRow {
  order_id: string
  status: OrderStatus
  updated_at: string
  scheduled_visit_date: string | null
  customers: { customer_name: string | null } | null
}

export async function getCancelledNotifications(
  sinceIso: string,
): Promise<CancelledNotificationRow[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      order_id,
      status,
      updated_at,
      scheduled_visit_date,
      customers (customer_name)
    `,
    )
    .in('status', ['CANCELLED'])
    .gte('updated_at', sinceIso)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    logger.error('getCancelledNotifications: query failed', error)
    return []
  }

  return ((data as unknown as RawNotificationRow[]) ?? []).map((row) => ({
    order_id: row.order_id,
    status: row.status,
    updated_at: row.updated_at,
    scheduled_visit_date: row.scheduled_visit_date,
    customer_name: row.customers?.customer_name ?? 'Unknown Customer',
  }))
}

export interface OrdersWithDateChangesRow {
  order_id: string
  customer_name: string | null
  scheduled_visit_date: string | null
  updated_at: string
}

interface RawOrderRow {
  order_id: string
  scheduled_visit_date: string | null
  updated_at: string
  customers: { customer_name: string | null } | null
}

export async function getOrdersUpdatedRecently(
  sinceIso: string,
): Promise<OrdersWithDateChangesRow[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      order_id,
      scheduled_visit_date,
      updated_at,
      customers (customer_name)
    `,
    )
    .gte('updated_at', sinceIso)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    logger.error('getOrdersUpdatedRecently: query failed', error)
    return []
  }

  return ((data as unknown as RawOrderRow[]) ?? []).map((row) => ({
    order_id: row.order_id,
    customer_name: row.customers?.customer_name ?? null,
    scheduled_visit_date: row.scheduled_visit_date,
    updated_at: row.updated_at,
  }))
}

import { getOrders } from '@/lib/actions/orders'
import { getOrderItemsForInvoice } from '@/lib/actions/invoices'
import { parseBankAccounts } from '@/lib/bank-accounts'
import { logger } from '@/lib/logger'

import type { InvoiceOrder } from './invoice-reducer'
import type { LineItem } from './line-items'

export const getInvoicedOrderIds = async (orderIds: string[]): Promise<Set<string>> => {
  if (orderIds.length === 0) return new Set<string>()
  try {
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('invoices')
      .select('order_id')
      .in('order_id', orderIds)
    if (error) throw error
    return new Set(
      (data || [])
        .map((row: { order_id: string | null }) => row.order_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  } catch (error) {
    logger.error('Error checking invoiced order ids:', error)
    return new Set<string>()
  }
}

export const fetchAvailableInvoiceOrders = async (): Promise<InvoiceOrder[]> => {
  const result = await getOrders({
    statusIn: 'ASSIGNED,EN_ROUTE,IN_PROGRESS,COMPLETED',
    limit: 200,
  })

  if (!result.success) {
    throw new Error(result.error || 'Gagal memuat data order')
  }

  const combinedOrders = (result.data || []) as InvoiceOrder[]
  const invoicedSet = await getInvoicedOrderIds(combinedOrders.map((o) => o.order_id))
  return combinedOrders.filter((order) => !invoicedSet.has(order.order_id))
}

export const fetchConfiguredBankAccounts = async () => {
  const { createClient } = await import('@/lib/supabase-browser')
  const supabase = createClient()
  const { data, error } = await supabase
    .from('invoice_configuration')
    .select('bank_accounts')
    .eq('is_active', true)
    .single()

  if (error) throw error

  return parseBankAccounts(data?.bank_accounts)
}

export const fetchBaseServiceLineItems = async (order: InvoiceOrder) => {
  const orderItems = await getOrderItemsForInvoice(order.order_id)

  if (orderItems.length > 0) {
    const lineItems: LineItem[] = orderItems.map((item) => {
      let desc = item.serviceName
      if (item.msnCode) {
        const unitInfo = [item.unitTypeName, item.capacityLabel].filter(Boolean).join(' ')
        desc = `[${item.msnCode}] ${item.serviceName}${unitInfo ? ` (${unitInfo})` : ''}`
      }
      if (item.quantity > 1) {
        desc += ` × ${item.quantity}`
      }
      return {
        type: 'BASE_SERVICE',
        description: desc,
        quantity: item.quantity,
        unitPrice: item.estimatedPrice,
        total: item.quantity * item.estimatedPrice,
      }
    })

    return {
      lineItems,
      serviceTypeForHeader: orderItems[0]?.serviceType ?? null,
      baseService: null,
    }
  }

  return {
    lineItems: [],
    serviceTypeForHeader: null,
    baseService: null,
  }
}

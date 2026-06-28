import { getOrders } from '@/lib/actions/orders'
import { getOrderItemsForInvoice, getInvoicedOrderIds } from '@/lib/actions/invoices-queries'
import { getInvoiceConfig } from '@/lib/actions/invoice-config'
import { parseBankAccounts } from '@/lib/bank-accounts'
import { logger } from '@/lib/logger'

import type { InvoiceOrder } from './invoice-reducer'
import type { LineItem } from './line-items'

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
  const config = await getInvoiceConfig()
  if (!config) throw new Error('Invoice configuration not found')
  return parseBankAccounts(config.bank_accounts)
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

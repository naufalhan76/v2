'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrderById, cancelOrder } from '@/lib/actions/orders'
import { acceptOrder } from '@/lib/actions/orders-mutations-status'
import { useToast } from '@/hooks/use-toast'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { logger } from '@/lib/logger'
import { PendingOrdersTable } from './_components/pending-orders-table'
import { OrderDialogs } from './_components/order-dialogs'

export default function AcceptOrderPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [actionOrderId, setActionOrderId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'cancel' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', 'NEW'],
    queryFn: () => getOrders({ status: 'NEW', limit: 100 })
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order', detailOrderId],
    queryFn: () => getOrderById(detailOrderId!),
    enabled: !!detailOrderId
  })

  const orders = ordersData?.data || []

  // Client-side search filter
  const filteredOrdersBase = orders.filter((order: unknown) => {
    const o = order as Record<string, unknown> & { customers?: { customer_name?: string } }
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const orderId = (o.order_id as string)?.toLowerCase() || ''
    const customerName = o.customers?.customer_name?.toLowerCase() || ''
    return orderId.includes(searchLower) || customerName.includes(searchLower)
  })

  // Apply sorting
  const { sortedData: filteredOrders, sortConfig, requestSort } = useSortableTable(filteredOrdersBase, {
    key: 'order_id',
    direction: 'desc'
  })

  const handleOrderAction = async (orderId: string, type: 'accept' | 'cancel') => {
    setIsProcessing(true)
    try {
      if (type === 'cancel') {
        const result = await cancelOrder(orderId, 'Order cancelled by admin')
        if (!result.success) throw new Error(result.error)
      } else {
        const result = await acceptOrder(orderId)
        if (!result.success) throw new Error(result.error)
      }
      toast({
        title: 'Success',
        description: `Order ${type === 'accept' ? 'accepted' : 'cancelled'} successfully`
      })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setActionOrderId(null)
      setActionType(null)
    } catch (error) {
      logger.error('Error updating order:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update order',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold mb-2'>Accept Order</h1>
        <p className='text-muted-foreground'>Review and accept or reject new incoming orders</p>
      </div>

      {/* Table + Stats + Search */}
      <PendingOrdersTable
        filteredOrders={filteredOrders}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortConfig={sortConfig}
        requestSort={requestSort}
        onDetailClick={setDetailOrderId}
        onAcceptClick={(orderId) => {
          setActionOrderId(orderId)
          setActionType('accept')
        }}
        onCancelClick={(orderId) => {
          setActionOrderId(orderId)
          setActionType('cancel')
        }}
      />

      {/* Order Detail + Confirmation Dialogs */}
      <OrderDialogs
        orderDetail={orderDetail}
        detailOrderId={detailOrderId}
        actionOrderId={actionOrderId}
        actionType={actionType}
        isProcessing={isProcessing}
        onDetailClose={() => setDetailOrderId(null)}
        onActionClose={() => setActionType(null)}
        onActionClick={handleOrderAction}
      />

    </div>
  )
}

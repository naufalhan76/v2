'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { updateOrderStatus, assignOrdersToTechnician, cancelOrder } from '@/lib/actions/orders'
import type { OrderStatus } from '@/lib/order-status'

/**
 * Hook for transitioning an order to a new status with optimistic updates.
 */
export function useTransitionOrder() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, newStatus, reason }: {
      orderId: string
      newStatus: OrderStatus
      reason?: string
    }) => {
      const result = await updateOrderStatus(orderId, newStatus, reason)
      if (!result.success) throw new Error(result.error || 'Failed to update status')
      return result
    },
    onMutate: async ({ orderId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      await queryClient.cancelQueries({ queryKey: ['order', orderId] })
      const previousOrders = queryClient.getQueryData(['orders'])
      const previousOrder = queryClient.getQueryData(['order', orderId])
      queryClient.setQueryData(['order', orderId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as Record<string, unknown>
        if (data.data && typeof data.data === 'object') {
          return { ...data, data: { ...(data.data as object), status: newStatus } }
        }
        return old
      })
      return { previousOrders, previousOrder }
    },
    onError: (err, { orderId }, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal update status',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: (_, { newStatus }) => {
      toast({
        title: 'Status diperbarui',
        description: `Order berhasil diubah ke ${newStatus}`,
      })
    },
    onSettled: (_, __, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}

/**
 * Hook for assigning a technician to orders.
 */
export function useAssignTechnician() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderIds, technicianId, helperIds, scheduledDate }: {
      orderIds: string[]
      technicianId: string
      helperIds?: string[]
      scheduledDate: string
    }) => {
      const result = await assignOrdersToTechnician({
        orderIds,
        technicianId,
        helperTechnicianIds: helperIds || [],
        scheduledDate,
      })
      if (!result.success) throw new Error(result.error || 'Failed to assign technician')
      return result
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Gagal assign teknisi',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: (_, { orderIds }) => {
      toast({
        title: 'Teknisi ditugaskan',
        description: `${orderIds.length} order berhasil di-assign`,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for rescheduling an order (transition back to PENDING with reason).
 */
export function useReschedule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, reason, newDate }: {
      orderId: string
      reason: string
      newDate?: string
    }) => {
      const result = await updateOrderStatus(orderId, 'PENDING', reason, newDate)
      if (!result.success) throw new Error(result.error || 'Failed to reschedule')
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      const previousOrders = queryClient.getQueryData(['orders'])
      return { previousOrders }
    },
    onError: (err, _, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal reschedule',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Order di-reschedule',
        description: 'Order dikembalikan ke status Menunggu',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for cancelling an order.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ orderId, reason }: {
      orderId: string
      reason?: string
    }) => {
      const result = await cancelOrder(orderId, reason)
      if (!result.success) throw new Error(result.error || 'Failed to cancel order')
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      await queryClient.cancelQueries({ queryKey: ['order', orderId] })
      const previousOrders = queryClient.getQueryData(['orders'])
      const previousOrder = queryClient.getQueryData(['order', orderId])
      return { previousOrders, previousOrder }
    },
    onError: (err, { orderId }, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders)
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal membatalkan order',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Order dibatalkan',
        description: 'Order berhasil dibatalkan',
      })
    },
    onSettled: (_, __, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}

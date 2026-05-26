'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { createInvoice, recordPayment } from '@/lib/actions/invoices'
import type { CreateInvoiceInput } from '@/lib/actions/invoices'

/**
 * Hook for creating an invoice from an order.
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: CreateInvoiceInput) => {
      const result = await createInvoice(params)
      return result
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Gagal membuat invoice',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Invoice dibuat',
        description: 'Invoice berhasil dibuat',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Hook for recording a payment against an invoice.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      invoiceId: string
      payment: {
        payment_date: string
        payment_method: string
        amount: number
        reference_number?: string
        notes?: string
      }
    }) => {
      const result = await recordPayment(params.invoiceId, params.payment)
      return result
    },
    onMutate: async ({ invoiceId }) => {
      await queryClient.cancelQueries({ queryKey: ['invoices'] })
      await queryClient.cancelQueries({ queryKey: ['invoice', invoiceId] })
      const previousInvoices = queryClient.getQueryData(['invoices'])
      const previousInvoice = queryClient.getQueryData(['invoice', invoiceId])
      return { previousInvoices, previousInvoice }
    },
    onError: (err, { invoiceId }, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(['invoices'], context.previousInvoices)
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData(['invoice', invoiceId], context.previousInvoice)
      }
      toast({
        variant: 'destructive',
        title: 'Gagal mencatat pembayaran',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Pembayaran dicatat',
        description: 'Pembayaran berhasil dicatat',
      })
    },
    onSettled: (_, __, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

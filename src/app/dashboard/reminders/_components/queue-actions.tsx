'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { markReminderSent, markReminderDismissed } from '@/lib/actions/reminders'

interface UseReminderQueueMutationsOptions {
  onBulkComplete?: () => void
}

export function useReminderQueueMutations(options?: UseReminderQueueMutationsOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderSent(reminderId)
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal menandai reminder terkirim')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({
        title: 'Reminder ditandai terkirim',
        description:
          'Implementasi pengiriman WhatsApp/Email aktual akan ditambahkan kemudian.',
      })
    },
    onError: (error: Error) => {
      logger.error('markReminderSent failed:', error)
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderDismissed(reminderId)
      if (!result?.success) {
        throw new Error(result?.error || 'Gagal mengabaikan reminder')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({ title: 'Reminder diabaikan' })
    },
    onError: (error: Error) => {
      logger.error('markReminderDismissed failed:', error)
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkSendMutation = useMutation({
    mutationFn: async (reminderIds: string[]) => {
      const results = await Promise.allSettled(
        reminderIds.map((id) => markReminderSent(id))
      )
      const ok = results.filter(
        (r) => r.status === 'fulfilled' && r.value?.success
      ).length
      const failed = reminderIds.length - ok
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      options?.onBulkComplete?.()
      toast({
        title: `${ok} reminder ditandai terkirim`,
        description:
          failed > 0
            ? `${failed} gagal. Implementasi pengiriman aktual akan ditambahkan kemudian.`
            : 'Implementasi pengiriman WhatsApp/Email aktual akan ditambahkan kemudian.',
        variant: failed > 0 ? 'destructive' : 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { sendMutation, dismissMutation, bulkSendMutation }
}

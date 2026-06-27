'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { markReminderSent, markRemindersSent, markReminderDismissed } from '@/lib/actions/reminders'

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
          'Pengiriman WhatsApp/Email belum diimplementasikan. Status dicatat manual.',
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
      const result = await markRemindersSent(reminderIds)
      if (!result?.success) throw new Error(result?.error || 'Gagal menandai terkirim')
      const data = (result as { success: true; data: { updated: string[]; skipped: string[] } }).data
      return { updated: data.updated, skipped: data.skipped }
    },
    onSuccess: ({ updated, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      options?.onBulkComplete?.()
      toast({
        title: `${updated.length} ditandai terkirim`,
        description:
          skipped.length > 0
            ? `${skipped.length} sudah terkirim (skip). Pengiriman WhatsApp/Email belum diimplementasikan.`
            : 'Pengiriman WhatsApp/Email belum diimplementasikan. Status dicatat manual.',
        variant: skipped.length > 0 ? 'destructive' : 'default',
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

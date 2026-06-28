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
        throw new Error(result?.error || 'Gagal mengirim reminder')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({
        title: 'Pesan terkirim',
        description: 'Reminder berhasil dikirim ke customer via WhatsApp/Email.',
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
      if (!result?.success) throw new Error(result?.error || 'Gagal mengirim reminder')
      const data = (result as { success: true; data: { updated: string[]; skipped: string[]; failed: string[] } }).data
      return { updated: data.updated, skipped: data.skipped, failed: data.failed }
    },
    onSuccess: ({ updated, skipped, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      options?.onBulkComplete?.()
      toast({
        title: `${updated.length} terkirim`,
        description:
          failed.length > 0
            ? `${failed.length} gagal terkirim. Periksa detail di tabel.`
            : skipped.length > 0
              ? `${skipped.length} sudah pernah dikirim (skip).`
              : 'Semua pesan terkirim ke customer via WhatsApp/Email.',
        variant: failed.length > 0 ? 'destructive' : 'default',
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

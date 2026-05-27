'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCancelOrder } from '@/hooks/use-order-mutation'

interface CancelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  onSuccess?: () => void
}

export function CancelModal({ open, onOpenChange, orderId, onSuccess }: CancelModalProps) {
  const mutation = useCancelOrder()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function handleConfirm() {
    if (!orderId) return
    await mutation.mutateAsync({ orderId, reason: reason || undefined })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan Order?</AlertDialogTitle>
          <AlertDialogDescription>
            Order akan diubah menjadi CANCELLED dan AC unit terkait (jika status PENDING)
            akan diset INACTIVE. Tindakan ini tidak bisa di-undo dari UI.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Alasan (opsional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Customer batal, salah input, dll."
            rows={3}
          />
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel
            disabled={mutation.isPending}
            className="h-11 sm:h-9 mt-0"
          >
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="h-11 sm:h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Batalkan Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

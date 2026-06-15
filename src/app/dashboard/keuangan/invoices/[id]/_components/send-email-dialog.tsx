'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SendEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isProcessing: boolean
  onSend: () => void
}

export function SendEmailDialog({ open, onOpenChange, isProcessing, onSend }: SendEmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kirim Email Invoice</DialogTitle>
          <DialogDescription>
            Invoice akan dikirim ke email customer melalui Resend.
            <br />
            <span className="text-muted-foreground mt-2 block">
              Status invoice akan otomatis berubah menjadi SENT.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing} className="min-h-[44px]">
            Batal
          </Button>
          <Button onClick={onSend} disabled={isProcessing} className="min-h-[44px]">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Kirim Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { AddonRequest } from '@/lib/actions/addon-requests'
import { formatCurrency, getCategoryLabel } from './addons-table'

interface ApproveRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: AddonRequest | null
  isApproving: boolean
  onApprove: (itemCode: string | null, finalPrice: number, initialStock: number, minStock: number) => Promise<{ success: boolean; error?: string }>
  onApproved: () => void
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  request,
  isApproving,
  onApprove,
  onApproved,
}: ApproveRequestDialogProps) {
  const [itemCode, setItemCode] = useState('')
  const [finalPrice, setFinalPrice] = useState('')

  const handleApprove = async () => {
    if (!request) return
    const price = parseFloat(finalPrice)
    if (isNaN(price) || price < 0) return
    const result = await onApprove(
      itemCode || null,
      price,
      0,
      0,
    )
    if (result.success) {
      onOpenChange(false)
      onApproved()
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (request) {
        setItemCode(request.item_name || '')
        setFinalPrice(request.proposed_unit_price?.toString() || '0')
      }
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-xl border border-border/50 shadow-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Setujui Permintaan Part</DialogTitle>
          <DialogDescription>Konfirmasi detail item sebelum menyetujui. Harga final dapat disesuaikan.</DialogDescription>
        </DialogHeader>
        {request && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm"><span className="font-medium">Item:</span> {request.item_name}</p>
              <p className="text-sm"><span className="font-medium">Kategori:</span> {getCategoryLabel(request.category)}</p>
              <p className="text-sm"><span className="font-medium">Harga Usulan:</span> {formatCurrency(request.proposed_unit_price ?? 0)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveItemCode" className="text-sm font-medium text-foreground">Kode Item (opsional)</Label>
              <Input id="approveItemCode" placeholder="CAP-10UF" value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveFinalPrice" className="text-sm font-medium text-foreground">Harga Final <span className="text-destructive">*</span></Label>
              <Input id="approveFinalPrice" placeholder="50000" type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} className="h-10" />
            </div>
          </div>
        )}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isApproving} className="w-full sm:w-auto">Batal</Button>
          <Button type="button" onClick={handleApprove} disabled={isApproving} className="w-full sm:w-auto">
            {isApproving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyetujui...</>) : 'Setujui & Tambahkan ke Katalog'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

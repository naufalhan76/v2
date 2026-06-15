'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAddonRequest } from '@/lib/actions/addon-requests'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES = ['PARTS', 'FREON', 'LABOR', 'TRANSPORTATION', 'OTHER'] as const
const UNITS = ['pcs', 'kg', 'hour', 'visit', 'meter', 'set', 'unit', 'liter'] as const

interface MaterialRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MaterialRequestDialog({ open, onOpenChange }: MaterialRequestDialogProps) {
  const { toast } = useToast()
  const [requestCategory, setRequestCategory] = useState<string>('PARTS')
  const [requestName, setRequestName] = useState('')
  const [requestUnit, setRequestUnit] = useState<string>('pcs')
  const [requestPrice, setRequestPrice] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)

  const handleRequestSubmit = async () => {
    if (!requestName.trim()) return
    setRequestSubmitting(true)
    try {
      const result = await createAddonRequest({
        category: requestCategory,
        item_name: requestName.trim(),
        unit_of_measure: requestUnit,
        proposed_unit_price: requestPrice ? Number(requestPrice) : null,
        description: requestDescription.trim() || null,
      })
      if (result.success) {
        toast({
          title: 'Berhasil',
          description: 'Permintaan part dikirim. Menunggu persetujuan admin.',
        })
        setRequestCategory('PARTS')
        setRequestName('')
        setRequestUnit('pcs')
        setRequestPrice('')
        setRequestDescription('')
        onOpenChange(false)
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal mengajukan part',
        })
      }
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan tidak terduga',
      })
    } finally {
      setRequestSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Part Baru</DialogTitle>
          <DialogDescription>
            Ajukan part yang belum ada di katalog untuk disetujui admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-category">Kategori</Label>
            <Select value={requestCategory} onValueChange={setRequestCategory}>
              <SelectTrigger id="req-category" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-name">Nama Item</Label>
            <Input
              id="req-name"
              placeholder="Nama part / material"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-unit">Satuan</Label>
            <Select value={requestUnit} onValueChange={setRequestUnit}>
              <SelectTrigger id="req-unit" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-price">Perkiraan Harga Satuan (opsional)</Label>
            <Input
              id="req-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="0"
              value={requestPrice}
              onChange={(e) => setRequestPrice(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="req-desc"
              placeholder="Spesifikasi atau catatan tambahan"
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Part yang diajukan akan masuk katalog setelah disetujui admin. Untuk sekarang kamu bisa memakai tombol &quot;Tambah Manual&quot; di form.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={requestSubmitting}
            className="h-9 text-sm"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRequestSubmit}
            disabled={requestSubmitting || !requestName.trim()}
            className="h-9 text-sm"
          >
            {requestSubmitting ? 'Mengirim...' : 'Kirim Permintaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

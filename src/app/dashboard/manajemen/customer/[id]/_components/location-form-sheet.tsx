'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { Plus } from 'lucide-react'
import { deleteLocation } from '@/lib/actions/locations'
import type { Location } from '@/types/customers'

interface LocationFormValues {
  full_address: string
  house_number: string
  city: string
  landmarks: string
}

interface LocationFormSheetProps {
  customerId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingLocation: Location | null
  form: LocationFormValues
  onFormChange: (values: LocationFormValues) => void
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  onOpenCreate: () => void
  deleteId: string | null
  onDeleteIdChange: (id: string | null) => void
  invalidate: () => void
}

export function LocationFormSheet({
  isOpen,
  onOpenChange,
  editingLocation,
  form,
  onFormChange,
  isSubmitting,
  onSubmit,
  onOpenCreate,
  deleteId,
  onDeleteIdChange,
  invalidate,
}: LocationFormSheetProps) {
  const { toast } = useToast()

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      const result = await deleteLocation(deleteId)
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Lokasi dihapus' })
        onDeleteIdChange(null)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menghapus lokasi',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat menghapus lokasi',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Button size="sm" onClick={onOpenCreate} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        Tambah Lokasi
      </Button>

      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi'}
            </SheetTitle>
            <SheetDescription>
              {editingLocation
                ? 'Perbarui informasi lokasi'
                : 'Tambahkan lokasi service baru untuk customer ini'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="loc_full_address">Alamat Lengkap *</Label>
              <Textarea
                id="loc_full_address"
                value={form.full_address}
                onChange={(e) => onFormChange({ ...form, full_address: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_house_number">No. Rumah *</Label>
              <Input
                id="loc_house_number"
                value={form.house_number}
                onChange={(e) => onFormChange({ ...form, house_number: e.target.value || '1' })}
                placeholder="contoh: 12, 12A"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_city">Kota *</Label>
              <Input
                id="loc_city"
                value={form.city}
                onChange={(e) => onFormChange({ ...form, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc_landmarks">Patokan</Label>
              <Input
                id="loc_landmarks"
                value={form.landmarks}
                onChange={(e) => onFormChange({ ...form, landmarks: e.target.value })}
                placeholder="contoh: dekat masjid, sebelah toko ABC"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && onDeleteIdChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lokasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Lokasi yang masih memiliki AC unit
              tidak dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

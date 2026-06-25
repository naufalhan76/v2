'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import type { Addon } from '@/lib/actions/addons'

const addonSchema = z.object({
  category: z.string().min(1, 'Kategori wajib diisi'),
  itemName: z.string().min(1, 'Nama item wajib diisi'),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Satuan wajib diisi'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format harga tidak valid'),
})

export type AddonFormData = z.infer<typeof addonSchema>

export const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-status-assigned-bg text-status-assigned' },
  { value: 'FREON', label: 'Freon', color: 'bg-status-invoiced text-foreground' },
  { value: 'LABOR', label: 'Labor', color: 'bg-status-pending-bg text-status-pending' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-primary text-primary-foreground' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-muted-foreground text-background' },
]

export const UNIT_OF_MEASURES = [
  'pcs',
  'kg',
  'hour',
  'visit',
  'meter',
  'set',
  'unit',
  'liter',
]

interface AddonFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingAddon: Addon | null
  isLoading: boolean
  categoryFilter: string
  onSubmit: (data: AddonFormData) => Promise<void>
}

export function AddonFormModal({
  open,
  onOpenChange,
  editingAddon,
  isLoading,
  categoryFilter,
  onSubmit,
}: AddonFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AddonFormData>({
    resolver: zodResolver(addonSchema),
  })

  const selectedCategory = watch('category')

  useEffect(() => {
    if (open) {
      if (editingAddon) {
        reset({
          category: editingAddon.category,
          itemName: editingAddon.item_name,
          itemCode: editingAddon.item_code || '',
          description: editingAddon.description || '',
          unitOfMeasure: editingAddon.unit_of_measure,
          unitPrice: editingAddon.unit_price.toString(),
        })
      } else {
        reset({
          category: categoryFilter !== 'ALL' ? categoryFilter : 'PARTS',
          itemName: '',
          itemCode: '',
          description: '',
          unitOfMeasure: 'pcs',
          unitPrice: '',
        })
      }
    }
  }, [open, editingAddon, categoryFilter, reset])

  const handleClose = () => {
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border border-border/50 shadow-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {editingAddon ? 'Edit Add-on' : 'Tambah Add-on'}
          </DialogTitle>
          <DialogDescription>
            Tambah atau edit item dalam katalog add-ons
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium text-foreground">
                Kategori <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={CATEGORIES.map(cat => ({ id: cat.value, label: cat.label }))}
                value={selectedCategory}
                onValueChange={(value) => setValue('category', value)}
                placeholder="Pilih kategori"
                searchPlaceholder="Cari kategori..."
              />
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemCode" className="text-sm font-medium text-foreground">Kode Item</Label>
              <Input
                id="itemCode"
                placeholder="CAP-10UF"
                className="h-10"
                {...register('itemCode')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemName" className="text-sm font-medium text-foreground">
              Nama Item <span className="text-destructive">*</span>
            </Label>
            <Input
              id="itemName"
              placeholder="Capacitor 10uF"
              className="h-10"
              {...register('itemName')}
            />
            {errors.itemName && (
              <p className="text-sm text-destructive">{errors.itemName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">Deskripsi</Label>
            <Textarea
              id="description"
              placeholder="Deskripsi item..."
              rows={2}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unitOfMeasure" className="text-sm font-medium text-foreground">
                Satuan <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={UNIT_OF_MEASURES.map(unit => ({ id: unit, label: unit }))}
                value={watch('unitOfMeasure') || ''}
                onValueChange={(value) => setValue('unitOfMeasure', value)}
                placeholder="Pilih satuan"
                searchPlaceholder="Cari satuan..."
              />
              {errors.unitOfMeasure && (
                <p className="text-sm text-destructive">
                  {errors.unitOfMeasure.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice" className="text-sm font-medium text-foreground">
                Harga Satuan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unitPrice"
                placeholder="50000"
                className="h-10"
                {...register('unitPrice')}
              />
              {errors.unitPrice && (
                <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createAddon, updateAddon, type Addon } from '@/lib/actions/addons'

const addonSchema = z.object({
  category: z.string().min(1, 'Kategori wajib diisi'),
  itemName: z.string().min(1, 'Nama item wajib diisi'),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Satuan wajib diisi'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format harga tidak valid'),
  stockQuantity: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format stok tidak valid').optional(),
  minimumStock: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format stok minimum tidak valid').optional(),
})

type AddonFormData = z.infer<typeof addonSchema>

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-status-assigned-bg0' },
  { value: 'FREON', label: 'Freon', color: 'bg-status-invoiced' },
  { value: 'LABOR', label: 'Labor', color: 'bg-status-pending-bg0' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-primary' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-muted-foreground' },
]

const UNIT_OF_MEASURES = [
  'pcs', 'kg', 'hour', 'visit', 'meter', 'set', 'unit', 'liter',
]

interface AddonsFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingAddon: Addon | null
  initialData: Omit<AddonFormData, 'itemCode' | 'description' | 'stockQuantity' | 'minimumStock'> & {
    itemCode?: string
    description?: string
    stockQuantity?: string
    minimumStock?: string
  } | null
  onSave: () => void
}

export function AddonsForm({ open, onOpenChange, editingAddon, initialData, onSave }: AddonsFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AddonFormData>({
    resolver: zodResolver(addonSchema),
    defaultValues: {
      category: 'PARTS',
      itemName: '',
      itemCode: '',
      description: '',
      unitOfMeasure: 'pcs',
      unitPrice: '',
      stockQuantity: '0',
      minimumStock: '0',
    },
  })

  useEffect(() => {
    if (open && initialData) {
      form.reset(initialData)
    } else if (open) {
      form.reset({
        category: 'PARTS',
        itemName: '',
        itemCode: '',
        description: '',
        unitOfMeasure: 'pcs',
        unitPrice: '',
        stockQuantity: '0',
        minimumStock: '0',
      })
    }
  }, [open, initialData, form])

  const handleClose = () => {
    onOpenChange(false)
  }

  const onSubmit = async (data: AddonFormData) => {
    try {
      setIsLoading(true)
      const input = {
        category: data.category,
        item_name: data.itemName,
        item_code: data.itemCode || null,
        description: data.description || null,
        unit_of_measure: data.unitOfMeasure,
        unit_price: parseFloat(data.unitPrice),
        stock_quantity: data.stockQuantity ? parseFloat(data.stockQuantity) : 0,
        minimum_stock: data.minimumStock ? parseFloat(data.minimumStock) : 0,
      }

      if (editingAddon) {
        await updateAddon(editingAddon.addon_id, input)
        toast({ title: 'Berhasil', description: 'Add-on berhasil diupdate' })
      } else {
        await createAddon(input)
        toast({ title: 'Berhasil', description: 'Add-on berhasil ditambahkan' })
      }

      handleClose()
      onSave()
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan add-on',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCategory = form.watch('category')
  const unitOfMeasure = form.watch('unitOfMeasure')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-xl border border-border/50 shadow-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {editingAddon ? 'Edit Add-on' : 'Tambah Add-on'}
          </DialogTitle>
          <DialogDescription>
            Tambah atau edit item dalam katalog add-ons
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Kategori <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={CATEGORIES.map(cat => ({ id: cat.value, label: cat.label }))}
                value={selectedCategory}
                onValueChange={(value) => form.setValue('category', value)}
                placeholder="Pilih kategori"
                searchPlaceholder="Cari kategori..."
              />
              {form.formState.errors.category && (
                <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Kode Item</Label>
              <Input placeholder="CAP-10UF" className="h-10" {...form.register('itemCode')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Nama Item <span className="text-destructive">*</span>
            </Label>
            <Input placeholder="Capacitor 10uF" className="h-10" {...form.register('itemName')} />
            {form.formState.errors.itemName && (
              <p className="text-sm text-destructive">{form.formState.errors.itemName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Deskripsi</Label>
            <Textarea placeholder="Deskripsi item..." rows={2} {...form.register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Satuan <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={UNIT_OF_MEASURES.map(unit => ({ id: unit, label: unit }))}
                value={unitOfMeasure || ''}
                onValueChange={(value) => form.setValue('unitOfMeasure', value)}
                placeholder="Pilih satuan"
                searchPlaceholder="Cari satuan..."
              />
              {form.formState.errors.unitOfMeasure && (
                <p className="text-sm text-destructive">{form.formState.errors.unitOfMeasure.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Harga Satuan <span className="text-destructive">*</span>
              </Label>
              <Input placeholder="50000" className="h-10" {...form.register('unitPrice')} />
              {form.formState.errors.unitPrice && (
                <p className="text-sm text-destructive">{form.formState.errors.unitPrice.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Stok</Label>
              <Input placeholder="0" type="number" className="h-10" {...form.register('stockQuantity')} />
              {form.formState.errors.stockQuantity && (
                <p className="text-sm text-destructive">{form.formState.errors.stockQuantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Stok Minimum</Label>
              <Input placeholder="0" type="number" className="h-10" {...form.register('minimumStock')} />
              {form.formState.errors.minimumStock && (
                <p className="text-sm text-destructive">{form.formState.errors.minimumStock.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>Batal</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

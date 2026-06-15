import { useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { type ServiceCatalogEntry } from '@/lib/actions/service-catalog'

export const catalogFormSchema = z.object({
  msn_code: z.string().min(1, 'MSN Code wajib diisi').max(64),
  service_name: z.string().min(1, 'Nama service wajib diisi'),
  unit_type_id: z.string().uuid('Pilih unit type'),
  capacity_id: z.string().uuid('Pilih kapasitas'),
  service_type_id: z.string().uuid('Pilih service type'),
  base_price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
  duration_minutes: z.coerce.number().int().min(0).optional().nullable(),
  includes_text: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type CatalogFormValues = z.infer<typeof catalogFormSchema>

export const defaultFormValues: CatalogFormValues = {
  msn_code: '', service_name: '', unit_type_id: '', capacity_id: '',
  service_type_id: '', base_price: 0, duration_minutes: null,
  includes_text: '', description: '', is_active: true,
}

type LookupsData = {
  unitTypes: Array<{ unit_type_id: string; name: string }>
  capacityRanges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  serviceTypes: Array<{ service_type_id: string; name: string }>
}

interface CatalogEditSheetProps {
  isOpen: boolean
  editingEntry: ServiceCatalogEntry | null
  form: UseFormReturn<CatalogFormValues>
  lookups: LookupsData | undefined
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CatalogFormValues) => void
}

export function CatalogEditSheet({ isOpen, form, lookups, isSubmitting, onClose, onSubmit }: CatalogEditSheetProps) {
  const watchedUnitTypeId = form.watch('unit_type_id')
  const formCapacities = useMemo(() => {
    if (!lookups) return []
    return lookups.capacityRanges.filter((c) => c.unit_type_id === watchedUnitTypeId)
  }, [lookups, watchedUnitTypeId])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle>Edit Catalog Entry</SheetTitle>
          <SheetDescription>Lengkapi detail layanan. MSN Code harus unik.</SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6" id="catalog-group-accordion-form">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>MSN Code *</Label>
              <Input {...form.register('msn_code')} placeholder="CARERA001" className="h-10 font-mono" />
              {form.formState.errors.msn_code && <p className="text-xs text-destructive">{form.formState.errors.msn_code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Base Price (IDR) *</Label>
              <Input type="number" min={0} step={1000} {...form.register('base_price')} placeholder="150000" className="h-10" />
              {form.formState.errors.base_price && <p className="text-xs text-destructive">{form.formState.errors.base_price.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nama Service *</Label>
            <Input {...form.register('service_name')} placeholder="Jasa Service Room Air (Checking)" className="h-10" />
            {form.formState.errors.service_name && <p className="text-xs text-destructive">{form.formState.errors.service_name.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Unit Type *</Label>
              <Select value={form.watch('unit_type_id')} onValueChange={(v) => { form.setValue('unit_type_id', v, { shouldValidate: true }); form.setValue('capacity_id', '') }}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{lookups?.unitTypes.map((u) => (<SelectItem key={u.unit_type_id} value={u.unit_type_id}>{u.name}</SelectItem>))}</SelectContent>
              </Select>
              {form.formState.errors.unit_type_id && <p className="text-xs text-destructive">{form.formState.errors.unit_type_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Kapasitas *</Label>
              <Select value={form.watch('capacity_id')} onValueChange={(v) => form.setValue('capacity_id', v, { shouldValidate: true })} disabled={!watchedUnitTypeId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{formCapacities.map((c) => (<SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>))}</SelectContent>
              </Select>
              {form.formState.errors.capacity_id && <p className="text-xs text-destructive">{form.formState.errors.capacity_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Service Type *</Label>
              <Select value={form.watch('service_type_id')} onValueChange={(v) => form.setValue('service_type_id', v, { shouldValidate: true })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{lookups?.serviceTypes.map((s) => (<SelectItem key={s.service_type_id} value={s.service_type_id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
              {form.formState.errors.service_type_id && <p className="text-xs text-destructive">{form.formState.errors.service_type_id.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Durasi (menit)</Label>
            <Input type="number" min={0} {...form.register('duration_minutes')} placeholder="60" className="h-10" />
          </div>

          <div className="space-y-2">
            <Label>Includes</Label>
            <Input {...form.register('includes_text')} placeholder="Cek freon, bersihkan filter, test kebocoran" className="h-10" />
            <p className="text-xs text-muted-foreground">Pisahkan dengan koma untuk multiple item.</p>
          </div>

          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea {...form.register('description')} placeholder="Keterangan tambahan..." rows={3} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Status Aktif</Label>
              <p className="text-xs text-muted-foreground">Catalog nonaktif tidak akan muncul saat membuat order baru.</p>
            </div>
            <Switch checked={form.watch('is_active')} onCheckedChange={(c) => form.setValue('is_active', c)} />
          </div>
        </form>

        <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">Batal</Button>
          <Button type="submit" form="catalog-group-accordion-form" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

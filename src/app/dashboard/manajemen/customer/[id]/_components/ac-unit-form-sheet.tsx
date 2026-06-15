'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Plus } from 'lucide-react'
import { deleteAcUnit } from '@/lib/actions/ac-units'
import type { AcUnit, Location } from '@/types/customers'

type AcUnitFormValues = {
  location_id: string; brand: string; model_number: string; serial_number: string
  ac_type: string; capacity_btu: number; installation_date: string; status: string
  unit_type_id: string; capacity_id: string; brand_id: string
}

type MasterData = {
  unitTypes: Array<{ unit_type_id: string; name: string }>
  capacityRanges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  brands: Array<{ brand_id: string; name: string }>
}

interface Props {
  locations: Location[]; masterData: MasterData; isOpen: boolean;
  onOpenChange: (open: boolean) => void; editingAcUnit: AcUnit | null;
  form: AcUnitFormValues; onFormChange: (v: AcUnitFormValues) => void;
  isSubmitting: boolean; onSubmit: (e: React.FormEvent) => void;
  onOpenCreate: () => void; deleteId: string | null;
  onDeleteIdChange: (id: string | null) => void; invalidate: () => void;
  customerId?: string; // kept for compat but not used internally
}

export function AcUnitFormSheet({
  locations, masterData, isOpen, onOpenChange, editingAcUnit,
  form, onFormChange, isSubmitting, onSubmit, onOpenCreate,
  deleteId, onDeleteIdChange, invalidate,
}: Props) {
  const { toast } = useToast()

  const filteredCapacities = form.unit_type_id
    ? masterData.capacityRanges.filter(c => c.unit_type_id === form.unit_type_id)
    : masterData.capacityRanges

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      const r = await deleteAcUnit(deleteId)
      if (r.success) { toast({ title: 'Berhasil', description: 'AC unit dihapus' }); onDeleteIdChange(null); invalidate() }
      else toast({ title: 'Gagal', description: r.error || 'Gagal menghapus AC unit', variant: 'destructive' })
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }) }
  }

  const u = (key: keyof AcUnitFormValues, value: string | number) => onFormChange({ ...form, [key]: value })

  return (
    <>
      <Button size="sm" onClick={onOpenCreate} disabled={locations.length === 0} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" /> Tambah AC
      </Button>

      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingAcUnit ? 'Edit AC Unit' : 'Tambah AC Unit'}</SheetTitle>
            <SheetDescription>{editingAcUnit ? 'Perbarui informasi AC unit' : 'Tambahkan AC unit baru untuk customer ini'}</SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Lokasi *</Label>
              <Select value={form.location_id} onValueChange={v => u('location_id', v)} disabled={!!editingAcUnit}>
                <SelectTrigger><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.location_id} value={l.location_id}>{l.full_address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Klasifikasi Unit</p>
            <div className="space-y-2">
              <Label>Unit Type</Label>
              <SearchableSelect options={[{ id: '', label: '— Tidak diisi —' }, ...masterData.unitTypes.map(t => ({ id: t.unit_type_id, label: t.name }))]} value={form.unit_type_id} onValueChange={v => onFormChange({ ...form, unit_type_id: v, capacity_id: '' })} placeholder="Pilih Unit Type" searchPlaceholder="Cari unit type..." />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <SearchableSelect options={[{ id: '', label: '— Tidak diisi —' }, ...filteredCapacities.map(c => ({ id: c.capacity_id, label: c.capacity_label }))]} value={form.capacity_id} onValueChange={v => u('capacity_id', v)} placeholder={form.unit_type_id ? 'Pilih Capacity' : 'Pilih Unit Type dulu'} searchPlaceholder="Cari capacity..." className={!form.unit_type_id ? 'pointer-events-none opacity-50' : ''} />
            </div>
            <div className="space-y-2">
              <Label>Merk AC</Label>
              <SearchableSelect options={[{ id: '', label: '— Tidak diisi —' }, ...masterData.brands.map(b => ({ id: b.brand_id, label: b.name }))]} value={form.brand_id} onValueChange={v => u('brand_id', v)} placeholder="Pilih Merk (opsional)" searchPlaceholder="Cari merk..." />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Informasi Unit</p>
            {(['brand', 'model_number', 'serial_number'] as const).map(k => (
              <div className="space-y-2" key={k}>
                <Label>{k === 'brand' ? 'Brand (teks) *' : k === 'model_number' ? 'Model Number *' : 'Serial Number *'}</Label>
                <Input value={form[k]} onChange={e => u(k, e.target.value)} required />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Tanggal Pemasangan</Label>
              <Input type="date" value={form.installation_date} onChange={e => u('installation_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <SearchableSelect options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }, { id: 'RETIRED', label: 'Retired' }]} value={form.status} onValueChange={v => u('status', v)} placeholder="Pilih status" searchPlaceholder="Cari status..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && onDeleteIdChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus AC Unit?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. AC unit dengan riwayat service tidak dapat dihapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isSubmitting ? 'Menghapus...' : 'Hapus'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

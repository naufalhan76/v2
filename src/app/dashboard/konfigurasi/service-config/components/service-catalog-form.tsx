'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  createServiceCatalogEntry,
  updateServiceCatalogEntry,
  deleteServiceCatalogEntry,
} from '@/lib/actions/service-config'
import type { ServiceCatalogItem } from './service-catalog-table'

interface ServiceCatalogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: ServiceCatalogItem | null
  unitTypes: { unit_type_id: string; name: string }[]
  capacityRanges: { capacity_id: string; unit_type_id: string; capacity_label: string }[]
  serviceTypes: { service_type_id: string; name: string }[]
  onSave: () => void
  deleteItem: ServiceCatalogItem | null
  onDeleteDialogOpen: boolean
  onDeleteDialogChange: (open: boolean) => void
  onDeleteConfirm: () => void
}

export function ServiceCatalogForm({
  open, onOpenChange, editingItem,
  unitTypes, capacityRanges, serviceTypes,
  onSave,
  deleteItem, onDeleteDialogOpen, onDeleteDialogChange, onDeleteConfirm,
}: ServiceCatalogFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [msnCode, setMsnCode] = useState('')
  const [unitTypeId, setUnitTypeId] = useState('')
  const [capacityId, setCapacityId] = useState('')
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      if (editingItem) {
        setMsnCode(editingItem.msn_code)
        setUnitTypeId(editingItem.unit_type_id || '')
        setCapacityId(editingItem.capacity_id || '')
        setServiceTypeId(editingItem.service_type_id || '')
        setServiceName(editingItem.service_name)
        setBasePrice(editingItem.base_price.toString())
        setDescription(editingItem.description || '')
      } else {
        setMsnCode(''); setUnitTypeId(''); setCapacityId(''); setServiceTypeId('')
        setServiceName(''); setBasePrice(''); setDescription('')
      }
    }
  }, [open, editingItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitTypeId || !capacityId || !serviceTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Silakan lengkapi pilihan Unit Type, Capacity, dan Tipe Service' })
      return
    }
    setIsLoading(true)
    const input = {
      msn_code: msnCode, unit_type_id: unitTypeId, capacity_id: capacityId,
      service_type_id: serviceTypeId, service_name: serviceName,
      base_price: parseFloat(basePrice) || 0, description: description || null, is_active: true,
    }
    let res
    if (editingItem) {
      res = await updateServiceCatalogEntry(editingItem.catalog_id, input)
    } else {
      res = await createServiceCatalogEntry(input)
    }
    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data disimpan.' })
      onOpenChange(false)
      onSave()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
    setIsLoading(false)
  }

  const renderSelect = <T extends { id: string; label: string }>(
    options: T[], value: string, onChange: (v: string) => void, placeholder: string, searchPlaceholder: string, disabled?: boolean,
  ) => {
    if (options.length > 3) {
      return (<SearchableSelect options={options} value={value} onValueChange={onChange} placeholder={placeholder} searchPlaceholder={searchPlaceholder} className={disabled ? 'pointer-events-none opacity-50' : ''} />)
    }
    return (<Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-10"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
    </Select>)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl rounded-xl border border-border/50 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">{editingItem ? 'Edit' : 'Tambah'} Service Catalog</DialogTitle>
            <DialogDescription>Input kombinasi service baru. Pastikan MSN Code unik.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">MSN Code *</Label>
                <Input value={msnCode} onChange={e => setMsnCode(e.target.value)} required placeholder="Misal: CARERA001" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Base Price *</Label>
                <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} required placeholder="Misal: 150000" className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Type AC *</Label>
                {renderSelect(unitTypes.map(ut => ({ id: ut.unit_type_id, label: ut.name })), unitTypeId, setUnitTypeId, 'Pilih type AC', 'Cari type AC...')}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Capacity *</Label>
                {renderSelect(
                  capacityRanges.filter(c => c.unit_type_id === unitTypeId).map(c => ({ id: c.capacity_id, label: c.capacity_label })),
                  capacityId, setCapacityId, 'Pilih capacity', 'Cari capacity...', !unitTypeId,
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Master Service Type *</Label>
                {renderSelect(serviceTypes.map(st => ({ id: st.service_type_id, label: st.name })), serviceTypeId, setServiceTypeId, 'Pilih service type', 'Cari service type...')}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Nama Service (di Invoice/Tampilan) *</Label>
              <Input value={serviceName} onChange={e => setServiceName(e.target.value)} required placeholder="Misal: Jasa Service Room Air (Checking)" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Keterangan Tambahan / Deskripsi</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opsional" className="h-10" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={onDeleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Data Harga?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

export interface MasterData {
  unitTypes: unknown[]
  capacityRanges: unknown[]
  acBrands: unknown[]
  serviceTypes: unknown[]
  serviceCatalog: unknown[]
}

interface ServiceSelectionModalProps {
  open: boolean
  onClose: () => void
  onAddService: (catalogEntry: unknown) => void
  masterData?: MasterData
  defaultUnitTypeId?: string
  defaultCapacityId?: string
  alreadySelectedCatalogIds?: string[]
}

export function ServiceSelectionModal({ open, onClose, onAddService, masterData, defaultUnitTypeId, defaultCapacityId, alreadySelectedCatalogIds = [] }: ServiceSelectionModalProps) {
  const [mode, setMode] = useState<'cascade' | 'search'>('cascade')
  
  // Whether the parent already locked in unit type & capacity
  const isLocked = !!(defaultUnitTypeId && defaultCapacityId)

  // Cascade state
  const [unitTypeId, setUnitTypeId] = useState<string>(defaultUnitTypeId || '')
  const [capacityId, setCapacityId] = useState<string>(defaultCapacityId || '')
  const [serviceTypeId, setServiceTypeId] = useState<string>('')
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Reset when opened
  if (!open) {
    setTimeout(() => {
      setUnitTypeId(defaultUnitTypeId || '')
      setCapacityId(defaultCapacityId || '')
      setServiceTypeId('')
      setSearchQuery('')
      setMode('cascade')
    }, 200)
  }

  // Derived state
  const capacities = useMemo(() => {
    if (!masterData) return []
    return masterData.capacityRanges.filter((c: unknown) => (c as Record<string, unknown>).unit_type_id === unitTypeId)
  }, [masterData, unitTypeId])

  const availableCatalogs = useMemo(() => {
    if (!masterData) return []
    let results: unknown[] = []
    if (mode === 'search') {
      if (!searchQuery || searchQuery.length < 2) return []
      results = masterData.serviceCatalog.filter((c: unknown) => {
        const item = c as Record<string, unknown>
        return (item.msn_code as string).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.service_name as string).toLowerCase().includes(searchQuery.toLowerCase())
      })
      // If locked, also filter search results to only matching unit type + capacity
      if (isLocked) {
        results = results.filter((c: unknown) => {
          const item = c as Record<string, unknown>
          return item.unit_type_id === unitTypeId && item.capacity_id === capacityId
        })
      }
    } else {
      if (!unitTypeId || !capacityId || !serviceTypeId) return []
      results = masterData.serviceCatalog.filter((c: unknown) => {
        const item = c as Record<string, unknown>
        return item.unit_type_id === unitTypeId &&
          item.capacity_id === capacityId &&
          item.service_type_id === serviceTypeId
      })
    }
    // Filter out already selected services
    return results.filter((c: unknown) => !alreadySelectedCatalogIds.includes((c as Record<string, unknown>).catalog_id as string))
  }, [masterData, unitTypeId, capacityId, serviceTypeId, mode, searchQuery, alreadySelectedCatalogIds, isLocked])

  const handleSelect = (catalogItem: unknown) => {
    onAddService(catalogItem)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih Jasa Service</DialogTitle>
          <DialogDescription>Pilih berdasarkan kriteria unit AC atau cari MSN kodenya.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-2">
          <Button variant={mode === 'cascade' ? 'default' : 'outline'} onClick={() => setMode('cascade')} className="flex-1">
            Berdasarkan Kriteria (Hierarki)
          </Button>
          <Button variant={mode === 'search' ? 'default' : 'outline'} onClick={() => setMode('search')} className="flex-1">
            Pencarian MSN
          </Button>
        </div>

        {mode === 'cascade' ? (
          <div className="pt-4 space-y-4">
            {isLocked ? (
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Unit Type</Label>
                  <div className="text-sm font-medium bg-muted px-3 py-2 rounded-md">
                    {masterData?.unitTypes.find((u: unknown) => (u as Record<string, unknown>).unit_type_id === unitTypeId) ? (masterData.unitTypes.find((u: unknown) => (u as Record<string, unknown>).unit_type_id === unitTypeId) as Record<string, unknown>).name as string : '-'}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Capacity</Label>
                  <div className="text-sm font-medium bg-muted px-3 py-2 rounded-md">
                    {masterData?.capacityRanges.find((c: unknown) => (c as Record<string, unknown>).capacity_id === capacityId) ? (masterData.capacityRanges.find((c: unknown) => (c as Record<string, unknown>).capacity_id === capacityId) as Record<string, unknown>).capacity_label as string : '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit Type (Tipe AC)</Label>
                  <Select value={unitTypeId} onValueChange={(val) => { setUnitTypeId(val); setCapacityId(''); setServiceTypeId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {masterData?.unitTypes.map((u: unknown) => {
                        const ut = u as Record<string, unknown>
                        return <SelectItem key={ut.unit_type_id as string} value={ut.unit_type_id as string}>{ut.name as string}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity (Kapasitas)</Label>
                  <Select value={capacityId} onValueChange={setCapacityId} disabled={!unitTypeId}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {capacities.map((c: unknown) => {
                        const cap = c as Record<string, unknown>
                        return <SelectItem key={cap.capacity_id as string} value={cap.capacity_id as string}>{cap.capacity_label as string}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Master Service Type</Label>
              <Select value={serviceTypeId} onValueChange={setServiceTypeId} disabled={!capacityId}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>
                  {masterData?.serviceTypes.map((s: unknown) => {
                    const st = s as Record<string, unknown>
                    return <SelectItem key={st.service_type_id as string} value={st.service_type_id as string}>{st.name as string}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            <Label>Cari MSN Code atau Nama Service</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                autoFocus
                placeholder="Ketik minimal 2 huruf..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-10"
              />
            </div>
          </div>
        )}

        <div className="mt-4 min-h-[200px] border rounded-md bg-muted/20 p-2 overflow-y-auto max-h-[300px]">
           {availableCatalogs.length > 0 ? (
             <div className="space-y-2">
               {availableCatalogs.map(catalogItem => {
                 const catalog = catalogItem as Record<string, unknown>
                 const unitTypes = catalog.unit_types as Record<string, unknown> | undefined
                 const capacityRanges = catalog.capacity_ranges as Record<string, unknown> | undefined
                 return (
                 <Card key={catalog.catalog_id as string} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelect(catalogItem)}>
                   <CardContent className="p-3 flex justify-between items-center">
                     <div>
                       <div className="font-mono text-sm font-bold text-primary">{catalog.msn_code as string}</div>
                       <div className="font-medium text-sm">{catalog.service_name as string}</div>
                       <div className="text-xs text-muted-foreground mt-1">
                         {unitTypes?.name as string} • {capacityRanges?.capacity_label as string}
                       </div>
                     </div>
                     <div className="text-right">
                       <span className="font-bold">Rp {(catalog.base_price as number).toLocaleString('id-ID')}</span>
                       <br />
                       <Button size="sm" variant="secondary" className="mt-2 h-7" onClick={(e) => { e.stopPropagation(); handleSelect(catalogItem); }}>
                         Pilih
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
                 )
               })}
             </div>
           ) : (
             <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-12">
               {mode === 'cascade' ? (
                 (!unitTypeId || !capacityId || !serviceTypeId) ? 'Lengkapi pilihan hirarki di atas untuk melihat tarif' : 'Tidak ada tarif yang tersedia untuk kombinasi tersebut'
               ) : (
                 searchQuery.length < 2 ? 'Ketik pencarian di atas' : 'Tidak ada kecocokan MSN atau nama ditemukan'
               )}
             </div>
           )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

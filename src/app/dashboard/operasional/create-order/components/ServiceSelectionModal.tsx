'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2 } from 'lucide-react'

export interface MasterData {
  unitTypes: any[]
  capacityRanges: any[]
  acBrands: any[]
  serviceTypes: any[]
  serviceCatalog: any[]
}

interface ServiceSelectionModalProps {
  open: boolean
  onClose: () => void
  onAddService: (catalogEntry: any) => void
  masterData?: MasterData
  defaultUnitTypeId?: string
  defaultCapacityId?: string
}

export function ServiceSelectionModal({ open, onClose, onAddService, masterData, defaultUnitTypeId, defaultCapacityId }: ServiceSelectionModalProps) {
  const [mode, setMode] = useState<'cascade' | 'search'>('cascade')
  
  // Cascade state
  const [unitTypeId, setUnitTypeId] = useState<string>(defaultUnitTypeId || '')
  const [capacityId, setCapacityId] = useState<string>(defaultCapacityId || '')
  const [serviceTypeId, setServiceTypeId] = useState<string>('')
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Reset when opened
  !open && setTimeout(() => {
    if (unitTypeId !== defaultUnitTypeId) setUnitTypeId(defaultUnitTypeId || '')
    if (capacityId !== defaultCapacityId) setCapacityId(defaultCapacityId || '')
    setServiceTypeId('')
    setSearchQuery('')
    setMode('cascade')
  }, 200)

  // Derived state
  const capacities = useMemo(() => {
    if (!masterData) return []
    return masterData.capacityRanges.filter((c: any) => c.unit_type_id === unitTypeId)
  }, [masterData, unitTypeId])

  const availableCatalogs = useMemo(() => {
    if (!masterData) return []
    if (mode === 'search') {
      if (!searchQuery || searchQuery.length < 2) return []
      return masterData.serviceCatalog.filter((c: any) => 
        c.msn_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.service_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    } else {
      if (!unitTypeId || !capacityId || !serviceTypeId) return []
      return masterData.serviceCatalog.filter((c: any) => 
        c.unit_type_id === unitTypeId &&
        c.capacity_id === capacityId &&
        c.service_type_id === serviceTypeId
      )
    }
  }, [masterData, unitTypeId, capacityId, serviceTypeId, mode, searchQuery])

  const handleSelect = (catalogItem: any) => {
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
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
              <Label>Unit Type (Tipe AC)</Label>
              <Select value={unitTypeId} onValueChange={(val) => { setUnitTypeId(val); setCapacityId(''); setServiceTypeId(''); }}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>
                  {masterData?.unitTypes.map((u: any) => (
                    <SelectItem key={u.unit_type_id} value={u.unit_type_id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity (Kapasitas)</Label>
              <Select value={capacityId} onValueChange={setCapacityId} disabled={!unitTypeId}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>
                  {capacities.map((c: any) => (
                    <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Master Service Type</Label>
              <Select value={serviceTypeId} onValueChange={setServiceTypeId} disabled={!capacityId}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>
                  {masterData?.serviceTypes.map((s: any) => (
                    <SelectItem key={s.service_type_id} value={s.service_type_id}>{s.name}</SelectItem>
                  ))}
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
               {availableCatalogs.map(catalog => (
                 <Card key={catalog.catalog_id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelect(catalog)}>
                   <CardContent className="p-3 flex justify-between items-center">
                     <div>
                       <div className="font-mono text-sm font-bold text-primary">{catalog.msn_code}</div>
                       <div className="font-medium text-sm">{catalog.service_name}</div>
                       <div className="text-xs text-muted-foreground mt-1">
                         {catalog.unit_types?.name} • {catalog.capacity_ranges?.capacity_label}
                       </div>
                     </div>
                     <div className="text-right">
                       <span className="font-bold">Rp {catalog.base_price.toLocaleString('id-ID')}</span>
                       <br />
                       <Button size="sm" variant="secondary" className="mt-2 h-7" onClick={(e) => { e.stopPropagation(); handleSelect(catalog); }}>
                         Pilih
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
               ))}
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

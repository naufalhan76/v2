'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { ServiceSelectionModal, MasterData } from './ServiceSelectionModal'
import { Package, ChevronDown, ChevronRight, Trash2, Plus, PenSquare } from 'lucide-react'
import type { LocationFormData } from '@/types/create-order'
import { normalizeOrderServiceType } from '@/lib/service-types'

export function LocationCard({
  location,
  index,
  isExpanded,
  onToggle,
  onRemove,
  onChange,
  masterData,
}: {
  location: LocationFormData
  index: number
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (location: LocationFormData) => void
  masterData: MasterData
}) {
  const isNewLocation = !location.location_id

  // Service Selection Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [activeAcType, setActiveAcType] = useState<'existing' | 'new' | null>(null)
  const [activeAcIndex, setActiveAcIndex] = useState<number>(-1)

  const handleOpenServiceModal = (type: 'existing' | 'new', acIndex: number) => {
    setActiveAcType(type)
    setActiveAcIndex(acIndex)
    setModalOpen(true)
  }

  const handleAddService = (catalogEntry: any) => {
    const updated = { ...location }
    const newService = {
      catalog_id: catalogEntry.catalog_id,
      msn_code: catalogEntry.msn_code,
      service_type: normalizeOrderServiceType(catalogEntry.service_types?.code),
      service_type_id: catalogEntry.service_type_id,
      price: catalogEntry.base_price,
      unit_type_id: catalogEntry.unit_type_id,
      capacity_id: catalogEntry.capacity_id,
      service_name: catalogEntry.service_name // for UI only
    }

    if (activeAcType === 'existing' && activeAcIndex >= 0) {
      if (!updated.existing_acs[activeAcIndex].selected_services) updated.existing_acs[activeAcIndex].selected_services = []
      // Don't add duplicate
      if (!updated.existing_acs[activeAcIndex].selected_services.find(s => s.catalog_id === newService.catalog_id)) {
        updated.existing_acs[activeAcIndex].selected_services.push(newService as any)
      }
    } else if (activeAcType === 'new' && activeAcIndex >= 0) {
      if (!updated.new_ac_units[activeAcIndex].selected_services) updated.new_ac_units[activeAcIndex].selected_services = []
      if (!updated.new_ac_units[activeAcIndex].selected_services.find(s => s.catalog_id === newService.catalog_id)) {
        updated.new_ac_units[activeAcIndex].selected_services.push(newService as any)
      }
    }
    onChange(updated)
  }

  const handleRemoveService = (type: 'existing' | 'new', acIndex: number, serviceIndex: number) => {
    const updated = { ...location }
    if (type === 'existing') {
      updated.existing_acs[acIndex].selected_services.splice(serviceIndex, 1)
    } else {
      updated.new_ac_units[acIndex].selected_services.splice(serviceIndex, 1)
    }
    onChange(updated)
  }

  // Pre-fill default UnitType/Capacity if editing new AC
  let selectedUnitType = '';
  let selectedCapacity = '';
  if (activeAcType === 'new' && activeAcIndex >= 0) {
    selectedUnitType = location.new_ac_units[activeAcIndex].unit_type_id || ''
    selectedCapacity = location.new_ac_units[activeAcIndex].capacity_id || ''
  } else if (activeAcType === 'existing' && activeAcIndex >= 0) {
    selectedUnitType = location.existing_acs[activeAcIndex].unit_type_id || ''
    selectedCapacity = location.existing_acs[activeAcIndex].capacity_id || ''
  }

  // Compute already selected catalog IDs for the active AC to prevent duplicates
  let alreadySelectedCatalogIds: string[] = []
  if (activeAcType === 'new' && activeAcIndex >= 0 && location.new_ac_units[activeAcIndex]) {
    alreadySelectedCatalogIds = (location.new_ac_units[activeAcIndex].selected_services || []).map((s: any) => s.catalog_id)
  } else if (activeAcType === 'existing' && activeAcIndex >= 0 && location.existing_acs[activeAcIndex]) {
    alreadySelectedCatalogIds = (location.existing_acs[activeAcIndex].selected_services || []).map((s: any) => s.catalog_id)
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onToggle} className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Package className="h-4 w-4" />
          <span className="font-semibold">
            Lokasi {index + 1} {location.full_address && `- ${location.full_address}`}
          </span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4 pl-6 pt-2">
          {/* Location Input */}
          {isNewLocation ? (
            <div className="space-y-3 bg-muted/50 p-3 rounded-lg">
              <div>
                <Label>Alamat Lengkap *</Label>
                <Input
                  placeholder="Contoh: Gedung A, Rumah Utama"
                  value={location.full_address || ''}
                  onChange={(e) => onChange({ ...location, full_address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nomor Rumah/Gedung</Label>
                  <Input
                    placeholder="Contoh: 12A, Blok B"
                    value={location.house_number || ''}
                    onChange={(e) => onChange({ ...location, house_number: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <Label>Kota</Label>
                  <Input
                    placeholder="Jakarta"
                    value={location.city || ''}
                    onChange={(e) => onChange({ ...location, city: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                <strong>{location.full_address}</strong> - No {location.house_number}, {location.city}
              </AlertDescription>
            </Alert>
          )}

          {/* Existing AC Selection */}
          <div className="space-y-3">
            <Label className="text-base text-blue-800 dark:text-blue-200">AC Existing (Telah Terdaftar)</Label>
            {location.existing_acs.length > 0 ? (
              <div className="space-y-3 border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-md">
                <MultiSelectDropdown
                  options={location.existing_acs.map(ac => ({
                    id: ac.ac_unit_id,
                    label: `${ac.brand} ${ac.model_number}`,
                    secondaryLabel: ac.serial_number || 'Tanpa SN',
                  }))}
                  selected={location.existing_acs.filter(ac => ac.is_selected).map(ac => ac.ac_unit_id)}
                  onSelectionChange={(selectedIds) => {
                    const updated = { ...location }
                    updated.existing_acs = updated.existing_acs.map(ac => ({
                      ...ac,
                      is_selected: selectedIds.includes(ac.ac_unit_id),
                      selected_services: selectedIds.includes(ac.ac_unit_id) ? ac.selected_services || [] : [] // Reset services if deselected
                    }))
                    onChange(updated)
                  }}
                  placeholder="Pilih AC yang akan diservice..."
                  searchPlaceholder="Cari dari merk, model, atau SN..."
                />

                {location.existing_acs.filter(ac => ac.is_selected).map((ac, acIndex) => {
                  if (!ac.is_selected) return null
                  const actualIndex = location.existing_acs.findIndex(a => a.ac_unit_id === ac.ac_unit_id)
                  return (
                    <div key={ac.ac_unit_id} className="border bg-white dark:bg-slate-900 rounded-md p-3 space-y-2 relative shadow-sm mt-3">
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">
                        {ac.brand} {ac.model_number} {ac.serial_number && `(SN: ${ac.serial_number})`}
                      </div>
                      
                      {/* List Selected Services */}
                      {ac.selected_services && ac.selected_services.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <Label className="text-xs text-muted-foreground">Jasa yang dipilih:</Label>
                          {ac.selected_services.map((svc: any, sIdx: number) => (
                            <div key={sIdx} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm group">
                              <div>
                                <span className="font-mono text-xs font-bold text-primary mr-2 bg-primary/10 px-1 py-0.5 rounded">{svc.msn_code}</span>
                                <span>{svc.service_name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>Rp {svc.price.toLocaleString('id-ID')}</span>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveService('existing', actualIndex, sIdx)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm" 
                        className="mt-2 w-full border border-dashed border-primary/50 text-primary"
                        onClick={() => handleOpenServiceModal('existing', actualIndex)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Tambah Service untuk AC ini
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Tidak ada AC existing di lokasi ini.</p>
            )}
          </div>

          <div className="my-4 border-t border-dashed" />

          {/* New AC Units */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base text-green-800 dark:text-green-300">Unit AC Baru / Belum Terdaftar</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = { ...location }
                  updated.new_ac_units.push({
                    temp_id: `new-ac-${Date.now()}`,
                    unit_type_id: '',
                    capacity_id: '',
                    brand_id: '',
                    selected_services: [],
                    notes: ''
                  })
                  onChange(updated)
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah AC Baru
              </Button>
            </div>

            {location.new_ac_units.length > 0 && (
              <div className="space-y-4">
                {location.new_ac_units.map((unit, unitIndex) => (
                  <div key={unit.temp_id} className="border border-green-200 dark:border-green-900 rounded-lg p-3 space-y-3 bg-green-50/30 dark:bg-green-950/20 shadow-sm relative pt-8">
                    <div className="absolute top-2 left-3 font-semibold text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded">AC Baru #{unitIndex + 1}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 hover:bg-destructive/10"
                      onClick={() => {
                        const updated = { ...location }
                        updated.new_ac_units = updated.new_ac_units.filter((_, i) => i !== unitIndex)
                        onChange(updated)
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <div className="space-y-1">
                          <Label className="text-xs">Merk AC *</Label>
                          <Select 
                            value={unit.brand_id} 
                            onValueChange={(val) => {
                              const updated = { ...location }
                              updated.new_ac_units[unitIndex].brand_id = val
                              onChange(updated)
                            }}
                          >
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                             <SelectContent>
                                {masterData.acBrands.map(b => (
                                   <SelectItem key={b.brand_id} value={b.brand_id}>{b.name}</SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-xs">Tipe Unit *</Label>
                          <Select 
                            value={unit.unit_type_id} 
                            onValueChange={(val) => {
                              const updated = { ...location }
                              updated.new_ac_units[unitIndex].unit_type_id = val
                              updated.new_ac_units[unitIndex].capacity_id = '' // reset capacity
                              updated.new_ac_units[unitIndex].selected_services = [] // reset services
                              onChange(updated)
                            }}
                          >
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                             <SelectContent>
                                {masterData.unitTypes.map(u => (
                                   <SelectItem key={u.unit_type_id} value={u.unit_type_id}>{u.name}</SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs">Kapasitas (HP/Btu) *</Label>
                         <Select 
                            value={unit.capacity_id} 
                            disabled={!unit.unit_type_id}
                            onValueChange={(val) => {
                              const updated = { ...location }
                              updated.new_ac_units[unitIndex].capacity_id = val
                              updated.new_ac_units[unitIndex].selected_services = [] // reset services on capacity change
                              onChange(updated)
                            }}
                          >
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                             <SelectContent>
                                {masterData.capacityRanges.filter((c:any) => c.unit_type_id === unit.unit_type_id).map(c => (
                                   <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="pt-2 border-t mt-2">
                       {/* List Selected Services */}
                       {unit.selected_services && unit.selected_services.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <Label className="text-xs text-muted-foreground">Jasa yang dipilih:</Label>
                            {unit.selected_services.map((svc: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-center justify-between bg-white dark:bg-slate-900 border p-2 rounded text-sm group">
                                <div>
                                  <span className="font-mono text-xs font-bold text-primary mr-2 bg-primary/10 px-1 py-0.5 rounded">{svc.msn_code}</span>
                                  <span>{svc.service_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span>Rp {svc.price.toLocaleString('id-ID')}</span>
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveService('new', unitIndex, sIdx)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                       <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          disabled={!unit.unit_type_id || !unit.capacity_id}
                          className="w-full border border-dashed border-green-500/50 text-green-700 dark:text-green-400 bg-white dark:bg-slate-900"
                          onClick={() => handleOpenServiceModal('new', unitIndex)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Tambah Service untuk AC Baru
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ServiceSelectionModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        masterData={masterData}
        onAddService={handleAddService}
        defaultUnitTypeId={selectedUnitType}
        defaultCapacityId={selectedCapacity}
        alreadySelectedCatalogIds={alreadySelectedCatalogIds}
      />
    </div>
  )
}

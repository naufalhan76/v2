'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Plus, MapPin, Wind, Pencil, Trash2 } from 'lucide-react'
import { logger } from '@/lib/logger'
import { getAcUnits, createAcUnit, updateAcUnit } from '@/lib/actions/ac-units'
import { getLocations } from '@/lib/actions/locations'
import { getUnitTypes, getCapacityRanges, getAcBrands } from '@/lib/actions/service-config'
import { getStatusBadge, formatDateOnly } from './helpers'
import { AcUnitFormSheet } from './ac-unit-form-sheet'
import type { AcUnit, Location } from '@/types/customers'

type AcUnitFormValues = {
  location_id: string; brand: string; model_number: string; serial_number: string;
  ac_type: string; capacity_btu: number; installation_date: string; status: string;
  unit_type_id: string; capacity_id: string; brand_id: string
}

export function AcUnitsTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const acUnitsKey = ['customer-ac-units', customerId] as const
  const locationsKey = ['customer-locations', customerId] as const

  const { data: locationsData } = useQuery({
    queryKey: locationsKey,
    queryFn: () => getLocations({ customerId, limit: 200 }),
  })
  const locations = useMemo<Location[]>(
    () => (locationsData?.success ? (locationsData.data as Location[]) : []) ?? [],
    [locationsData],
  )
  const locationIds = useMemo(() => locations.map((l) => l.location_id), [locations])

  const { data: acUnitsData, isLoading: isLoadingAcUnits } = useQuery({
    queryKey: [...acUnitsKey, locationIds],
    queryFn: async () => {
      const result = await getAcUnits({ limit: 1000 })
      if (!result.success) return result
      const filtered = (result.data as Array<AcUnit & { locations?: { location_id: string } }>)
        .filter((u) => u.locations?.location_id && locationIds.includes(u.locations.location_id))
      return { ...result, data: filtered }
    },
    enabled: locations.length > 0,
  })

  const acUnits = useMemo<AcUnit[]>(
    () => (acUnitsData?.success ? (acUnitsData.data as AcUnit[]) : []) ?? [],
    [acUnitsData],
  )

  const { data: masterData } = useQuery({
    queryKey: ['ac-master-data'],
    queryFn: async () => {
      const [unitTypesResult, capacityResult, brandsResult] = await Promise.all([
        getUnitTypes(), getCapacityRanges(), getAcBrands(),
      ])
      return {
        unitTypes: unitTypesResult.success ? unitTypesResult.data ?? [] : [],
        capacityRanges: capacityResult.success ? capacityResult.data ?? [] : [],
        brands: brandsResult.success ? brandsResult.data ?? [] : [],
      }
    },
  })

  const unitTypes = useMemo(() => masterData?.unitTypes ?? [], [masterData])
  const capacityRanges = useMemo(() => masterData?.capacityRanges ?? [], [masterData])
  const masterBrands = useMemo(() => masterData?.brands ?? [], [masterData])

  const initialForm: AcUnitFormValues = {
    location_id: '', brand: '', model_number: '', serial_number: '',
    ac_type: '', capacity_btu: 0, installation_date: '', status: 'ACTIVE',
    unit_type_id: '', capacity_id: '', brand_id: '',
  }

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAcUnit, setEditingAcUnit] = useState<AcUnit | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<AcUnitFormValues>(initialForm)

  const openCreate = () => {
    setEditingAcUnit(null)
    setForm({ ...initialForm, location_id: locations[0]?.location_id ?? '' })
    setIsFormOpen(true)
  }

  const openEdit = (unit: AcUnit) => {
    setEditingAcUnit(unit)
    setForm({
      location_id: unit.location_id ?? '', brand: unit.brand ?? '',
      model_number: unit.model_number ?? '', serial_number: unit.serial_number ?? '',
      ac_type: unit.ac_type ?? '', capacity_btu: unit.capacity_btu ?? 0,
      installation_date: unit.installation_date ?? '', status: unit.status ?? 'ACTIVE',
      unit_type_id: unit.unit_type_id ?? '', capacity_id: unit.capacity_id ?? '',
      brand_id: unit.brand_id ?? '',
    })
    setIsFormOpen(true)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: acUnitsKey })
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.location_id) {
      toast({ title: 'Validasi', description: 'Pilih lokasi terlebih dahulu', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        ...form, capacity_btu: Number(form.capacity_btu) || undefined,
        unit_type_id: form.unit_type_id || undefined, capacity_id: form.capacity_id || undefined,
        brand_id: form.brand_id || undefined, installation_date: form.installation_date || undefined,
      }
      const result = editingAcUnit
        ? await updateAcUnit(editingAcUnit.ac_unit_id, payload)
        : await createAcUnit({ ...payload, location_id: form.location_id })
      if (result.success) {
        toast({ title: 'Berhasil', description: editingAcUnit ? 'AC unit diperbarui' : 'AC unit berhasil ditambahkan' })
        setIsFormOpen(false)
        invalidate()
      } else {
        toast({ title: 'Gagal', description: result.error || 'Gagal menyimpan AC unit', variant: 'destructive' })
      }
    } catch (error) {
      logger.error('Error saving AC unit:', error)
      toast({ title: 'Error', description: 'Terjadi kesalahan saat menyimpan AC unit', variant: 'destructive' })
    } finally { setIsSubmitting(false) }
  }

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, AcUnit[]>()
    for (const unit of acUnits) {
      const arr = map.get(unit.location_id) ?? []
      arr.push(unit)
      map.set(unit.location_id, arr)
    }
    return map
  }, [acUnits])

  const masterDataReady = masterData ? { unitTypes, capacityRanges, brands: masterBrands } : undefined

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <CardTitle>AC Units ({acUnits.length})</CardTitle>
        {masterDataReady && (
          <AcUnitFormSheet
            customerId={customerId} locations={locations} masterData={masterDataReady}
            isOpen={isFormOpen} onOpenChange={setIsFormOpen}
            editingAcUnit={editingAcUnit} form={form} onFormChange={setForm}
            isSubmitting={isSubmitting} onSubmit={handleSubmit}
            onOpenCreate={openCreate} deleteId={deleteId} onDeleteIdChange={setDeleteId}
            invalidate={invalidate}
          />
        )}
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <EmptyState icon={MapPin} title="Belum ada lokasi" description="Tambahkan lokasi terlebih dahulu sebelum mencatat AC unit." />
        ) : isLoadingAcUnits ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ) : acUnits.length === 0 ? (
          <EmptyState icon={Wind} title="Belum ada AC unit" description="Tambahkan AC unit pertama untuk customer ini."
            action={{ label: 'Tambah AC', icon: Plus, onClick: openCreate }} />
        ) : (
          <div className="space-y-6">
            {locations.map((loc) => {
              const units = groupedByLocation.get(loc.location_id) ?? []
              if (units.length === 0) return null
              return (
                <div key={loc.location_id} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold border-b pb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{loc.full_address}</span>
                    <Badge variant="secondary" className="ml-auto flex-shrink-0">{units.length} unit</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {units.map((unit) => (
                      <div key={unit.ac_unit_id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{unit.ac_brands?.name || unit.brand || '-'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Model {unit.model_number || '-'}{unit.serial_number && ` · SN ${unit.serial_number}`}
                            </p>
                          </div>
                          {getStatusBadge(unit.status)}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {unit.unit_types?.name && <Badge variant="outline">{unit.unit_types.name}</Badge>}
                          {unit.capacity_ranges?.capacity_label && (
                            <Badge variant="outline" className="font-mono">{unit.capacity_ranges.capacity_label}</Badge>
                          )}
                          {!unit.capacity_ranges?.capacity_label && unit.capacity_btu ? (
                            <Badge variant="outline" className="font-mono">{unit.capacity_btu} BTU</Badge>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div><p className="text-muted-foreground">Service Terakhir</p><p>{formatDateOnly(unit.last_service_date)}</p></div>
                          <div><p className="text-muted-foreground">Service Berikutnya</p><p>{formatDateOnly(unit.next_service_due_date)}</p></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(unit)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Ubah</Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteId(unit.ac_unit_id)}><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

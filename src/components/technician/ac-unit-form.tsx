'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Snowflake, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import { MaterialInput, type MaterialItem } from '@/components/technician/material-input'
import { type AcUnitReportItem } from '@/app/api/schemas/technician'
import { cn } from '@/lib/utils'

export type AcUnitFormValue = AcUnitReportItem

export type AcUnitFormProps = {
  orderId: string
  initialUnits: AcUnitFormValue[]
  onChange: (units: AcUnitFormValue[]) => void
  /** Called with flat array of all photo IDs across all AC units */
  onPhotoIdsChange?: (photoIds: string[]) => void
}

type DimensionData = {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  ac_brands: Array<{ brand_id: string; name: string }>
}

export function AcUnitForm({ orderId, initialUnits, onChange, onPhotoIdsChange }: AcUnitFormProps) {
  const [dimensions, setDimensions] = useState<DimensionData>({
    unit_types: [],
    capacity_ranges: [],
    ac_brands: [],
  })

  // Fetch active dimensions on mount
  useEffect(() => {
    fetch('/api/technician/dimensions')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setDimensions(data.data)
        }
      })
      .catch((err) => console.error('Failed to load dimensions:', err))
  }, [])

  const { control, watch, setValue, register } = useForm<{ units: AcUnitFormValue[] }>({
    defaultValues: {
      units: initialUnits.length > 0 ? initialUnits : [],
    },
  })

  const { fields } = useFieldArray({
    control,
    name: 'units',
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track photoIds per AC unit per kind. Key: `${index}-before` or `${index}-after`
  const photoIdsRef = useRef<Record<string, string[]>>({})

  const notifyPhotoIds = () => {
    if (onPhotoIdsChange) {
      const allIds = Object.values(photoIdsRef.current).flat()
      onPhotoIdsChange(allIds)
    }
  }

  // Keep formValues for rendering (local re-renders only, does not call parent)
  const formValues = watch('units')

  // Debounced subscription — notifies parent at most once per 300 ms idle period,
  // preventing cascading re-renders through the entire form tree on every keystroke.
  useEffect(() => {
    const subscription = watch((value) => {
      const units = (value?.units ?? []) as AcUnitFormValue[]
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onChange(units), 300)
    })
    return () => {
      subscription.unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [watch, onChange])

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    fields.forEach((f, _i) => {
      init[f.id] = true
    })
    return init
  })

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // AC count is locked to the order. Tech cannot add or remove units.
  // See JobCompletionWizard for the count source of truth.

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const isExisting = !!field.ac_unit_id
        const initialUnit = initialUnits[index]
        const isSkipped = formValues[index]?.skipped ?? false
        const isExpanded = expandedCards[field.id] !== false
        const isExistingComplete = isExisting && !!(initialUnit?.brand_id && initialUnit?.unit_type_id && initialUnit?.capacity_id)
        const hasData = (key: keyof AcUnitFormValue) => isExisting && !!initialUnit?.[key]
        
        const selectedUnitTypeId = formValues[index]?.unit_type_id || undefined
        const filteredCapacities = dimensions.capacity_ranges.filter(
          (cap) => cap.unit_type_id === selectedUnitTypeId
        )

        return (
          <Card key={field.id} className="overflow-hidden shadow-sm">
            <CardHeader 
              className={cn(
                "p-4 flex flex-row items-center justify-between cursor-pointer transition-colors hover:bg-canvas-soft active:bg-canvas-soft",
                !isExpanded && "pb-4"
              )}
              onClick={() => toggleExpand(field.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Snowflake className="h-4 w-4" />
                </div>
                  <div>
                    <CardTitle className="text-base">
                      AC {index + 1}
                      {isExisting && <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Eksisting</span>}
                      {isSkipped && <span className="ml-2 text-xs font-normal text-destructive">(Tidak diservis)</span>}
                    </CardTitle>
                  <p className="text-xs text-ink-mute">
                    {formValues[index]?.brand || 'Merk belum diisi'} 
                    {formValues[index]?.capacity_label ? ` (${formValues[index]?.capacity_label})` : ''}
                    {formValues[index]?.room_location ? ` • ${formValues[index]?.room_location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-ink-mute" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-ink-mute" />
                )}
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-6">
                {isExisting && (
                  <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas-soft p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`skip-${index}`} className="text-sm font-medium cursor-pointer">
                        Tandai tidak diservis
                      </Label>
                      <Switch
                        id={`skip-${index}`}
                        checked={isSkipped}
                        onCheckedChange={(checked) => {
                          setValue(`units.${index}.skipped`, checked, { shouldValidate: true })
                          if (!checked) {
                            setValue(`units.${index}.skip_reason`, '')
                          }
                        }}
                      />
                    </div>
                    {isSkipped && (
                      <div className="pt-2">
                        <Label htmlFor={`skip-reason-${index}`} className="mb-1.5 block text-sm text-destructive">
                          Alasan tidak diservis *
                        </Label>
                        <Input
                          id={`skip-reason-${index}`}
                          placeholder="Mis: AC terkunci, tidak ada orang..."
                          className="h-11"
                          {...register(`units.${index}.skip_reason`)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {isExisting && !isExistingComplete && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-medium">Data AC eksisting tidak lengkap</p>
                    <p className="mt-0.5 text-amber-700">Lengkapi data identitas yang kosong untuk AC ini.</p>
                  </div>
                )}

                {!isSkipped && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`brand-${index}`}>Merk</Label>
                        <Select
                          value={formValues[index]?.brand_id || undefined}
                          onValueChange={(val) => {
                            const matched = dimensions.ac_brands.find((b) => b.brand_id === val)
                            setValue(`units.${index}.brand_id`, val)
                            setValue(`units.${index}.brand`, matched ? matched.name : null)
                          }}
                          disabled={hasData('brand_id')}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Pilih Merk AC..." />
                          </SelectTrigger>
                          <SelectContent>
                            {dimensions.ac_brands.map((b) => (
                              <SelectItem key={b.brand_id} value={b.brand_id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Jenis AC</Label>
                        <Select
                          value={formValues[index]?.unit_type_id || undefined}
                          onValueChange={(val) => {
                            const matched = dimensions.unit_types.find((ut) => ut.unit_type_id === val)
                            setValue(`units.${index}.unit_type_id`, val)
                            setValue(`units.${index}.ac_type`, matched ? matched.name : null)
                            // Reset capacity when unit type changes
                            setValue(`units.${index}.capacity_id`, null)
                            setValue(`units.${index}.capacity_label`, null)
                          }}
                          disabled={hasData('unit_type_id')}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Pilih Jenis AC..." />
                          </SelectTrigger>
                          <SelectContent>
                            {dimensions.unit_types.map((ut) => (
                              <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>
                                {ut.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Kapasitas</Label>
                        <Select
                          value={formValues[index]?.capacity_id || undefined}
                          disabled={hasData('capacity_id') || !selectedUnitTypeId}
                          onValueChange={(val) => {
                            const matched = dimensions.capacity_ranges.find((cap) => cap.capacity_id === val)
                            setValue(`units.${index}.capacity_id`, val)
                            setValue(`units.${index}.capacity_label`, matched ? matched.capacity_label : null)
                          }}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={selectedUnitTypeId ? "Pilih Kapasitas..." : "Pilih Jenis AC terlebih dahulu"} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredCapacities.map((cap) => (
                              <SelectItem key={cap.capacity_id} value={cap.capacity_id}>
                                {cap.capacity_label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`room-${index}`}>Lokasi Ruangan</Label>
                        <Input
                          id={`room-${index}`}
                          placeholder="Kamar Tidur Utama, Ruang Tamu..."
                          className={cn("h-11", hasData('room_location') && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                          readOnly={hasData('room_location')}
                          {...register(`units.${index}.room_location`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`floor-${index}`}>Lantai</Label>
                        <Input
                          id={`floor-${index}`}
                          placeholder="Lantai 1, Lantai 2..."
                          className={cn("h-11", hasData('floor_level') && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                          readOnly={hasData('floor_level')}
                          {...register(`units.${index}.floor_level`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`posdetail-${index}`}>Posisi Detail</Label>
                        <Input
                          id={`posdetail-${index}`}
                          placeholder="Dekat jendela, sebelah lemari..."
                          className={cn("h-11", hasData('position_detail') && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                          readOnly={hasData('position_detail')}
                          {...register(`units.${index}.position_detail`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`model-${index}`}>Nomor Model</Label>
                        <Input
                          id={`model-${index}`}
                          placeholder="Model number..."
                          className={cn("h-11", hasData('model_number') && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                          readOnly={hasData('model_number')}
                          {...register(`units.${index}.model_number`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`serial-${index}`}>Nomor Seri</Label>
                        <Input
                          id={`serial-${index}`}
                          placeholder="Serial number..."
                          className={cn("h-11", hasData('serial_number') && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                          readOnly={hasData('serial_number')}
                          {...register(`units.${index}.serial_number`)}
                        />
                      </div>
                    </div>

                    <div className="space-y-6 pt-2">
                      <PhotoUploadOffline
                        orderId={orderId}
                        acUnitIdx={index}
                        kind="before"
                        value={formValues[index]?.photos_before || []}
                        onChange={(urls, photoIds) => {
                          setValue(`units.${index}.photos_before`, urls)
                          photoIdsRef.current[`${index}-before`] = photoIds
                          notifyPhotoIds()
                        }}
                        min={1}
                        max={3}
                      />

                      <PhotoUploadOffline
                        orderId={orderId}
                        acUnitIdx={index}
                        kind="after"
                        value={formValues[index]?.photos_after || []}
                        onChange={(urls, photoIds) => {
                          setValue(`units.${index}.photos_after`, urls)
                          photoIdsRef.current[`${index}-after`] = photoIds
                          notifyPhotoIds()
                        }}
                        min={1}
                        max={3}
                      />

                      <MaterialInput
                        value={(formValues[index]?.materials_used as MaterialItem[]) || []}
                        onChange={(mats) => setValue(`units.${index}.materials_used`, mats)}
                      />

                      <div className="space-y-1.5">
                        <Label htmlFor={`notes-${index}`}>Catatan per AC</Label>
                        <Textarea
                          id={`notes-${index}`}
                          placeholder="Catatan spesifik untuk AC ini..."
                          className="min-h-[80px]"
                          {...register(`units.${index}.notes`)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-6 text-center text-sm text-ink-mute">
          Order ini tidak memiliki unit AC yang perlu diinspeksi.
        </div>
      )}
    </div>
  )
}

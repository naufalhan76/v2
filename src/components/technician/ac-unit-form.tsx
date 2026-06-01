'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Snowflake, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const AC_TYPES = [
  'Split',
  'Cassette',
  'Standing',
  'Window',
  'Floor',
  'Ceiling',
]

export function AcUnitForm({ orderId, initialUnits, onChange, onPhotoIdsChange }: AcUnitFormProps) {
  const { control, watch, setValue, register } = useForm<{ units: AcUnitFormValue[] }>({
    defaultValues: {
      units: initialUnits.length > 0 ? initialUnits : [],
    },
  })

  const { fields, append, remove } = useFieldArray({
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

  const handleAddAc = () => {
    append({
      ac_unit_id: null,
      brand: '',
      capacity_pk: '',
      room_location: '',
      model_number: '',
      serial_number: '',
      ac_type: '',
      skipped: false,
      skip_reason: '',
      photos_before: [],
      photos_after: [],
      notes: '',
      materials_used: [],
    })
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const isExisting = !!field.ac_unit_id
        const isSkipped = formValues[index]?.skipped ?? false
        const isExpanded = expandedCards[field.id] !== false

        return (
          <Card key={field.id} className="overflow-hidden">
            <CardHeader 
              className={cn(
                "p-4 flex flex-row items-center justify-between cursor-pointer transition-colors hover:bg-muted/50",
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
                    {isSkipped && <span className="ml-2 text-xs font-normal text-destructive">(Tidak diservis)</span>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {formValues[index]?.brand || 'Merk belum diisi'} 
                    {formValues[index]?.room_location ? ` • ${formValues[index]?.room_location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isExisting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(index)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-6">
                {isExisting && (
                  <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
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

                {!isSkipped && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`brand-${index}`}>Merk</Label>
                        <Input
                          id={`brand-${index}`}
                          placeholder="Daikin, Panasonic..."
                          className="h-11"
                          {...register(`units.${index}.brand`)}
                          disabled={isExisting && !!initialUnits[index]?.brand}
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor={`capacity-${index}`}>Kapasitas (PK)</Label>
                        <Input
                          id={`capacity-${index}`}
                          placeholder="1/2 PK, 1 PK..."
                          className="h-11"
                          {...register(`units.${index}.capacity_pk`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Tipe AC</Label>
                        <Select
                          value={formValues[index]?.ac_type || undefined}
                          onValueChange={(val) => setValue(`units.${index}.ac_type`, val)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Pilih tipe..." />
                          </SelectTrigger>
                          <SelectContent>
                            {AC_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                          className="h-11"
                          {...register(`units.${index}.room_location`)}
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor={`model-${index}`}>Nomor Model</Label>
                        <Input
                          id={`model-${index}`}
                          placeholder="Model number..."
                          className="h-11"
                          {...register(`units.${index}.model_number`)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`serial-${index}`}>Nomor Seri</Label>
                        <Input
                          id={`serial-${index}`}
                          placeholder="Serial number..."
                          className="h-11"
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
                        onChange={(mats) => setValue(`units.${index}.materials_used`, mats as any)}
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

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 border-dashed"
        onClick={handleAddAc}
      >
        <Plus className="mr-2 h-5 w-5" />
        Tambah AC Baru
      </Button>
    </div>
  )
}

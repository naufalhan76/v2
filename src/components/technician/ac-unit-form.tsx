'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, type UseFormSetValue, type UseFormRegister } from 'react-hook-form'
import { AcUnitCard } from './ac-unit-card'
import { type AcUnitReportItem } from '@/app/api/schemas/technician'

export type AcUnitFormValue = AcUnitReportItem

export type AcUnitFormProps = {
  orderId: string
  initialUnits: AcUnitFormValue[]
  formUnits?: AcUnitFormValue[]
  onChange: (units: AcUnitFormValue[]) => void
  /** Called with flat array of all photo IDs across all AC units */
  onPhotoIdsChange?: (photoIds: string[]) => void
}

type DimensionData = {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  ac_brands: Array<{ brand_id: string; name: string }>
}

type FormSchema = { units: AcUnitReportItem[] }

export function AcUnitForm({ orderId, initialUnits, formUnits, onChange, onPhotoIdsChange }: AcUnitFormProps) {
  const [dimensions, setDimensions] = useState<DimensionData>({
    unit_types: [],
    capacity_ranges: [],
    ac_brands: [],
  })

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

  const { control, watch, setValue, register } = useForm<FormSchema>({
    defaultValues: {
      units: (formUnits ?? initialUnits).length > 0 ? (formUnits ?? initialUnits) : [],
    },
  })

  const { fields } = useFieldArray({
    control,
    name: 'units',
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photoIdsRef = useRef<Record<string, string[]>>({})

  const notifyPhotoIds = () => {
    if (onPhotoIdsChange) {
      const allIds = Object.values(photoIdsRef.current).flat()
      onPhotoIdsChange(allIds)
    }
  }

  const formValues = watch('units')

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
    fields.forEach((f, _i) => { init[f.id] = true })
    return init
  })

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handlePhotoIdsChange = (kind: 'before' | 'after', photoIds: string[], _fieldId: string, index: number) => {
    photoIdsRef.current[`${index}-${kind}`] = photoIds
    notifyPhotoIds()
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const typedField = { ...field, ac_unit_id: (field as unknown as AcUnitReportItem).ac_unit_id }
        return (
          <AcUnitCard
            key={field.id}
            field={typedField}
            index={index}
            orderId={orderId}
            initialUnits={initialUnits}
            formValues={formValues}
            setValue={setValue as UseFormSetValue<FormSchema>}
            register={register as UseFormRegister<FormSchema>}
            dimensions={dimensions}
            isExpanded={expandedCards[field.id] !== false}
            onToggleExpand={() => toggleExpand(field.id)}
            onPhotoIdsChange={(kind, ids) => handlePhotoIdsChange(kind, ids, field.id, index)}
          />
        )
      })}

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-muted-foreground">
          Order ini tidak memiliki unit AC yang perlu diinspeksi.
        </div>
      )}
    </div>
  )
}

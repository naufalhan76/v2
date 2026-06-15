import { useEffect, useState } from 'react'

import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import { cn } from '@/lib/utils'
import { UnitCard } from './unit-card'
import type { AcIdentity } from './wizard-types'

export type { AcIdentity } from './wizard-types'

export type AcUnitData = AcUnitReportItem

export type PhaseADraft = {
  units: Array<{
    unitIndex: number
    photos: string[]
    identity?: AcIdentity
  }>
}

type DimensionData = {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  ac_brands: Array<{ brand_id: string; name: string }>
}

const emptyDimensions: DimensionData = {
  unit_types: [],
  capacity_ranges: [],
  ac_brands: [],
}

function valueOf(value: string | null | undefined): string {
  return value ?? ''
}

function identityFromUnit(unit: AcUnitReportItem): AcIdentity {
  return {
    ac_unit_id: valueOf(unit.ac_unit_id),
    brand: valueOf(unit.brand),
    brand_id: valueOf(unit.brand_id),
    ac_type: valueOf(unit.ac_type),
    unit_type_id: valueOf(unit.unit_type_id),
    capacity_id: valueOf(unit.capacity_id),
    capacity_label: valueOf(unit.capacity_label),
    model_number: valueOf(unit.model_number),
    room_location: valueOf(unit.room_location),
  }
}

type WizardPhaseAProps = {
  orderId: string
  acUnits: AcUnitReportItem[]
  onComplete: (draft: PhaseADraft) => void
}

export function WizardPhaseA({ orderId, acUnits, onComplete }: WizardPhaseAProps): React.JSX.Element {
  const [dimensions, setDimensions] = useState<DimensionData>(emptyDimensions)
  const [units, setUnits] = useState<AcUnitReportItem[]>(() => acUnits.map((unit) => ({ ...unit })))
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setUnits(acUnits.map((unit) => ({ ...unit })))
  }, [acUnits])

  useEffect(() => {
    let active = true

    fetch('/api/technician/dimensions')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && data.data) {
          setDimensions(data.data)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const draftKey = `msn-tech-wizard-draft-${orderId}`

  function updateUnit(index: number, patch: Partial<AcUnitReportItem>) {
    setUnits((current) => current.map((unit, idx) => (idx === index ? { ...unit, ...patch } : unit)))
  }

  function validate(): string[] {
    const nextErrors: string[] = []

    units.forEach((unit, index) => {
      if (unit.skipped) return

      const isExisting = !!unit.ac_unit_id
      const initial = acUnits[index] ?? unit

      if (!isExisting || !initial.brand_id) {
        if (!unit.brand_id) nextErrors.push(`AC ${index + 1}: merk wajib dipilih`)
      }
      if (!isExisting || !initial.unit_type_id) {
        if (!unit.unit_type_id) nextErrors.push(`AC ${index + 1}: jenis AC wajib dipilih`)
      }
      if (!isExisting || !initial.capacity_id) {
        if (!unit.capacity_id) nextErrors.push(`AC ${index + 1}: kapasitas wajib dipilih`)
      }
      if (!isExisting || !initial.room_location) {
        if (!unit.room_location || unit.room_location.trim().length === 0) {
          nextErrors.push(`AC ${index + 1}: lokasi ruangan wajib diisi`)
        }
      }
      if (!unit.photos_before || unit.photos_before.length === 0) {
        nextErrors.push(`AC ${index + 1}: minimal 1 foto sebelum wajib diunggah`)
      }
    })

    return nextErrors
  }

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()

    const nextErrors = validate()
    setErrors(nextErrors)
    if (nextErrors.length > 0) return

    const draft: PhaseADraft = {
      units: units.map((unit, index) => ({
        unitIndex: index,
        photos: unit.photos_before ?? [],
        identity: unit.skipped ? undefined : identityFromUnit(unit),
      })),
    }

    localStorage.setItem(draftKey, JSON.stringify(draft))
    onComplete(draft)
  }

  return (
    <form className="min-h-screen bg-background pb-8 dark:bg-background" onSubmit={handleSubmit}>
      <header className="bg-primary px-5 pt-8 pb-16 text-white rounded-b-[40px]">
        <p className="text-sm font-semibold text-white/80">Langkah 1 dari 3</p>
        <h1 className="mt-2 text-2xl font-bold">Foto & Detail AC</h1>
        <div className="mt-6 flex items-center" aria-label="Wizard stepper">
          {[1, 2, 3].map((step) => (
            <div key={step} className={cn('flex items-center', step < 3 ? 'flex-1' : 'flex-none')}>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step === 1
                    ? 'bg-white text-primary'
                    : 'border-2 border-primary text-brand-200'
                )}
              >
                {step}
              </span>
              {step < 3 && <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-500" />}
            </div>
          ))}
        </div>
      </header>

      <main className="-mt-10 space-y-5 px-5">
        {errors.length > 0 && (
          <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg dark:border-status-cancelled dark:bg-status-cancelled-bg p-4 text-sm text-status-cancelled dark:text-status-cancelled" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {units.map((unit, index) => (
          <UnitCard
            key={`${unit.ac_unit_id || 'new'}-${index}`}
            index={index}
            orderId={orderId}
            unit={unit}
            initialUnit={acUnits[index] ?? unit}
            dimensions={dimensions}
            onUpdate={(patch) => updateUnit(index, patch)}
          />
        ))}

        {units.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border dark:border-border bg-white dark:bg-surface-muted p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground">
            Order ini tidak memiliki unit AC.
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors active:scale-[0.98] dark:bg-primary-hover dark:hover:bg-primary-hover"
        >
          Lanjut ke Timer
        </button>
      </main>
    </form>
  )
}

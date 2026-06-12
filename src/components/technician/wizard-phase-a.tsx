import { useEffect, useMemo, useState } from 'react'
import { Snowflake } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import { cn } from '@/lib/utils'

export type AcUnitData = AcUnitReportItem

export type AcIdentity = {
  ac_unit_id?: string | null
  brand: string
  brand_id: string
  ac_type: string
  unit_type_id: string
  capacity_id: string
  capacity_label: string
  model_number: string
  room_location: string
}

export type PhaseADraft = {
  units: Array<{
    unitIndex: number
    photos: string[]
    identity?: AcIdentity
  }>
}

type WizardPhaseAProps = {
  orderId: string
  acUnits: AcUnitData[]
  onComplete: (draft: PhaseADraft) => void
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

function hasCompleteExistingIdentity(unit: AcUnitData): boolean {
  return !!(unit.ac_unit_id && unit.brand_id && unit.unit_type_id && unit.capacity_id && unit.room_location)
}

function identityFromUnit(unit: AcUnitData): AcIdentity {
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

export function WizardPhaseA({ orderId, acUnits, onComplete }: WizardPhaseAProps): React.JSX.Element {
  const [dimensions, setDimensions] = useState<DimensionData>(emptyDimensions)
  const [units, setUnits] = useState<AcUnitData[]>(() => acUnits.map((unit) => ({ ...unit })))
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

  function updateUnit(index: number, patch: Partial<AcUnitData>) {
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
    <form className="min-h-screen bg-[#F8FAFC] pb-8 dark:bg-[#0f1024]" onSubmit={handleSubmit}>
      <header className="bg-[#1A1C4E] px-5 pt-8 pb-16 text-white rounded-b-[40px]">
        <p className="text-sm font-semibold text-white/80">Langkah 1 dari 3</p>
        <h1 className="mt-2 text-2xl font-bold">Foto & Detail AC</h1>
        <div className="mt-6 flex items-center gap-3" aria-label="Wizard stepper">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex flex-1 items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                  step === 1
                    ? 'bg-white text-[#1A1C4E] ring-4 ring-white/30'
                    : 'border-2 border-white/50 text-white/70'
                )}
              >
                {step}
              </span>
              {step < 3 && <span className="ml-3 h-0.5 flex-1 rounded-full bg-white/30" />}
            </div>
          ))}
        </div>
      </header>

      <main className="-mt-10 space-y-5 px-5">
        {errors.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-300" role="alert">
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
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1833] p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Order ini tidak memiliki unit AC.
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-[#1A1C4E] dark:bg-[#2d2a75] py-4 font-bold text-white shadow-sm active:scale-[0.99]"
        >
          Lanjut ke Timer
        </button>
      </main>
    </form>
  )
}

type UnitCardProps = {
  index: number
  orderId: string
  unit: AcUnitData
  initialUnit: AcUnitData
  dimensions: DimensionData
  onUpdate: (patch: Partial<AcUnitData>) => void
}

function UnitCard({ index, orderId, unit, initialUnit, dimensions, onUpdate }: UnitCardProps) {
  const isExisting = !!unit.ac_unit_id
  const isCompleteExisting = hasCompleteExistingIdentity(initialUnit)
  const showFullForm = !isExisting
  const showMissingFields = isExisting && !isCompleteExisting

  const filteredCapacities = useMemo(
    () => dimensions.capacity_ranges.filter((capacity) => capacity.unit_type_id === valueOf(unit.unit_type_id)),
    [dimensions.capacity_ranges, unit.unit_type_id]
  )

  return (
    <section
      data-testid={`phase-a-unit-card-${index}`}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-[#1a1833]"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A1C4E]/10 text-[#1A1C4E]">
          <Snowflake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1A1C4E] dark:text-white">AC {index + 1}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{isExisting ? 'Unit terdaftar dari order' : 'Unit baru dari order'}</p>
        </div>
      </div>

      <div className="space-y-6">
        <PhotoUploadOffline
          orderId={orderId}
          acUnitIdx={index}
          kind="before"
          value={unit.photos_before ?? []}
          onChange={(urls) => onUpdate({ photos_before: urls })}
          min={1}
          max={3}
        />

        {isCompleteExisting && <ReadOnlyIdentity unit={unit} />}

        {showMissingFields && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-bold">Data AC eksisting belum lengkap</p>
              <p>Lengkapi field yang masih kosong sebelum lanjut.</p>
            </div>
            <ReadOnlyIdentity unit={unit} onlyPresent />
            <IdentityFields
              unit={unit}
              initialUnit={initialUnit}
              dimensions={dimensions}
              filteredCapacities={filteredCapacities}
              onUpdate={onUpdate}
            />
          </div>
        )}

        {showFullForm && (
          <IdentityFields
            unit={unit}
            initialUnit={initialUnit}
            dimensions={dimensions}
            filteredCapacities={filteredCapacities}
            onUpdate={onUpdate}
            forceAll
          />
        )}
      </div>
    </section>
  )
}

function ReadOnlyIdentity({ unit, onlyPresent = false }: { unit: AcUnitData; onlyPresent?: boolean }) {
  const items = [
    ['Merk', valueOf(unit.brand)],
    ['Jenis / Model', valueOf(unit.ac_type || unit.model_number)],
    ['Kapasitas', valueOf(unit.capacity_label)],
    ['Lokasi Ruangan', valueOf(unit.room_location)],
  ].filter(([, value]) => !onlyPresent || value)

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#252243] p-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{value || '-'}</p>
        </div>
      ))}
    </div>
  )
}

type IdentityFieldsProps = {
  unit: AcUnitData
  initialUnit: AcUnitData
  dimensions: DimensionData
  filteredCapacities: DimensionData['capacity_ranges']
  onUpdate: (patch: Partial<AcUnitData>) => void
  forceAll?: boolean
}

function IdentityFields({ unit, initialUnit, dimensions, filteredCapacities, onUpdate, forceAll = false }: IdentityFieldsProps) {
  const showBrand = forceAll || !initialUnit.brand_id
  const showType = forceAll || !initialUnit.unit_type_id
  const showCapacity = forceAll || !initialUnit.capacity_id
  const showRoom = forceAll || !initialUnit.room_location

  if (!showBrand && !showType && !showCapacity && !showRoom) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {showBrand && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-gray-800 dark:text-white">Merk</Label>
          <select
            aria-label="Merk"
            value={valueOf(unit.brand_id)}
            onChange={(event) => {
              const matched = dimensions.ac_brands.find((brand) => brand.brand_id === event.target.value)
              onUpdate({ brand_id: event.target.value, brand: matched?.name ?? '' })
            }}
            className="h-11 w-full rounded-xl border border-gray-300 dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
          >
            <option value="">Pilih Merk AC...</option>
            {dimensions.ac_brands.map((brand) => (
              <option key={brand.brand_id} value={brand.brand_id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showType && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-gray-800 dark:text-white">Jenis / Model</Label>
          <select
            aria-label="Jenis / Model"
            value={valueOf(unit.unit_type_id)}
            onChange={(event) => {
              const matched = dimensions.unit_types.find((type) => type.unit_type_id === event.target.value)
              onUpdate({
                unit_type_id: event.target.value,
                ac_type: matched?.name ?? '',
                capacity_id: '',
                capacity_label: '',
              })
            }}
            className="h-11 w-full rounded-xl border border-gray-300 dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
          >
            <option value="">Pilih Jenis AC...</option>
            {dimensions.unit_types.map((type) => (
              <option key={type.unit_type_id} value={type.unit_type_id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showCapacity && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-gray-800 dark:text-white">Kapasitas</Label>
          <select
            aria-label="Kapasitas"
            value={valueOf(unit.capacity_id)}
            disabled={!unit.unit_type_id}
            onChange={(event) => {
              const matched = dimensions.capacity_ranges.find((capacity) => capacity.capacity_id === event.target.value)
              onUpdate({
                capacity_id: event.target.value,
                capacity_label: matched?.capacity_label ?? '',
              })
            }}
            className="h-11 w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400 disabled:bg-gray-100 dark:disabled:bg-[#1a1833] disabled:text-gray-500 dark:disabled:text-gray-500"
          >
            <option value="">{unit.unit_type_id ? 'Pilih Kapasitas...' : 'Pilih Jenis AC terlebih dahulu'}</option>
            {filteredCapacities.map((capacity) => (
              <option key={capacity.capacity_id} value={capacity.capacity_id}>
                {capacity.capacity_label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showRoom && (
        <div className="space-y-1.5">
          <Label htmlFor={`phase-a-room-${unit.ac_unit_id || 'new'}`} className="text-sm font-bold text-gray-800 dark:text-white">
            Lokasi Ruangan
          </Label>
          <Input
            id={`phase-a-room-${unit.ac_unit_id || 'new'}`}
            aria-label="Lokasi Ruangan"
            value={valueOf(unit.room_location)}
            onChange={(event) => onUpdate({ room_location: event.target.value })}
            placeholder="Kamar Tidur Utama, Ruang Tamu..."
            className="h-11 rounded-xl border-gray-300 dark:border-gray-600 focus:border-[#1A1C4E] focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
          />
        </div>
      )}
    </div>
  )
}

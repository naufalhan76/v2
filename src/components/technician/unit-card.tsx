'use client'

import { useMemo } from 'react'
import { Snowflake } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import type { AcIdentity } from './wizard-types'

type DimensionData = {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  ac_brands: Array<{ brand_id: string; name: string }>
}

function valueOf(value: string | null | undefined): string {
  return value ?? ''
}

function hasCompleteExistingIdentity(unit: AcUnitReportItem): boolean {
  return !!(unit.ac_unit_id && unit.brand_id && unit.unit_type_id && unit.capacity_id && unit.room_location)
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

interface UnitCardProps {
  index: number
  orderId: string
  unit: AcUnitReportItem
  initialUnit: AcUnitReportItem
  dimensions: DimensionData
  onUpdate: (patch: Partial<AcUnitReportItem>) => void
}

export function UnitCard({ index, orderId, unit, initialUnit, dimensions, onUpdate }: UnitCardProps) {
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
      className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:bg-surface-muted"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-primary dark:bg-surface dark:text-brand-200">
          <Snowflake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-primary dark:text-foreground">AC {index + 1}</h2>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">{isExisting ? 'Unit terdaftar dari order' : 'Unit baru dari order'}</p>
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
            <div className="rounded-xl border border-status-pending/30 dark:border-status-pending bg-status-pending-bg dark:bg-status-pending-bg p-3 text-sm text-status-pending dark:text-status-pending">
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

function ReadOnlyIdentity({ unit, onlyPresent = false }: { unit: AcUnitReportItem; onlyPresent?: boolean }) {
  const items = [
    ['Merk', valueOf(unit.brand)],
    ['Jenis / Model', valueOf(unit.ac_type || unit.model_number)],
    ['Kapasitas', valueOf(unit.capacity_label)],
    ['Lokasi Ruangan', valueOf(unit.room_location)],
  ].filter(([, value]) => !onlyPresent || value)

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border dark:border-border bg-muted dark:bg-surface p-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">{label}</p>
          <p className="mt-1 font-semibold text-foreground dark:text-foreground">{value || '-'}</p>
        </div>
      ))}
    </div>
  )
}

interface IdentityFieldsProps {
  unit: AcUnitReportItem
  initialUnit: AcUnitReportItem
  dimensions: DimensionData
  filteredCapacities: DimensionData['capacity_ranges']
  onUpdate: (patch: Partial<AcUnitReportItem>) => void
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
          <Label className="text-sm font-bold text-foreground dark:text-foreground">Merk</Label>
          <select
            aria-label="Merk"
            value={valueOf(unit.brand_id)}
            onChange={(event) => {
              const matched = dimensions.ac_brands.find((brand) => brand.brand_id === event.target.value)
              onUpdate({ brand_id: event.target.value, brand: matched?.name ?? '' })
            }}
            className="h-11 w-full rounded-xl border border-border-strong dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
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
          <Label className="text-sm font-bold text-foreground dark:text-foreground">Jenis / Model</Label>
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
            className="h-11 w-full rounded-xl border border-border-strong dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
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
          <Label className="text-sm font-bold text-foreground dark:text-foreground">Kapasitas</Label>
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
            className="h-11 w-full rounded-xl border border-border-strong dark:border-border dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:ring-primary dark:focus:border-primary dark:focus:ring-primary disabled:bg-muted dark:disabled:bg-surface-muted disabled:text-muted-foreground dark:disabled:text-muted-foreground"
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
          <Label htmlFor={`phase-a-room-${unit.ac_unit_id || 'new'}`} className="text-sm font-bold text-foreground dark:text-foreground">
            Lokasi Ruangan
          </Label>
          <Input
            id={`phase-a-room-${unit.ac_unit_id || 'new'}`}
            aria-label="Lokasi Ruangan"
            value={valueOf(unit.room_location)}
            onChange={(event) => onUpdate({ room_location: event.target.value })}
            placeholder="Kamar Tidur Utama, Ruang Tamu..."
            className="h-11 rounded-xl border-border-strong dark:border-border focus:border-primary focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
          />
        </div>
      )}
    </div>
  )
}

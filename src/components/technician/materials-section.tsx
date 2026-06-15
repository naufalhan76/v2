'use client'

import { Snowflake } from 'lucide-react'
import { MaterialInput } from '@/components/technician/material-input'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import type { AcUnitReportItem } from '@/app/api/schemas/technician'
import type { PhaseADraft } from './wizard-phase-a'

type UnitState = {
  materials: AcUnitReportItem['materials_used']
  photosAfter: string[]
  photoIds: string[]
}

interface MaterialsSectionProps {
  unitDraft: PhaseADraft['units'][number]
  unitState: UnitState
  index: number
  orderId: string
  onUpdateState: (index: number, patch: Partial<UnitState>) => void
}

export function MaterialsSection({
  unitDraft,
  unitState,
  index,
  orderId,
  onUpdateState,
}: MaterialsSectionProps) {
  const identity = unitDraft.identity

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-border dark:bg-surface-muted">
      {/* Unit header */}
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-primary dark:bg-surface dark:text-brand-200">
          <Snowflake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-primary dark:text-foreground">
            AC {index + 1}
          </h2>
          {identity && (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {identity.brand} — {identity.room_location}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Addons / Materials */}
        <MaterialInput
          value={unitState.materials}
          onChange={(materials) => onUpdateState(index, { materials })}
        />

        {/* After photos */}
        <PhotoUploadOffline
          orderId={orderId}
          acUnitIdx={index}
          kind="after"
          value={unitState.photosAfter}
          onChange={(urls, photoIds) =>
            onUpdateState(index, { photosAfter: urls, photoIds })
          }
          min={1}
          max={5}
        />
      </div>
    </section>
  )
}

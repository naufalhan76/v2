'use client'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { SelectedAcLine } from '../_hooks/use-create-order-form'
import { ServiceItemRow } from './service-item-row'

const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

type Props = {
  uniqueUnitInstanceIds: string[]
  serviceLines: SelectedAcLine[]
  lineCatalogMissing: Record<string, boolean>
  masterData: Record<string, unknown> | undefined
  onPickService: (lineId: string, stId: string) => void
  onUpdateServiceLine: (lineId: string, patch: Partial<SelectedAcLine>) => void
  onUpdateServiceLineForGroup: (unitInstanceId: string, patch: Partial<SelectedAcLine>) => void
  onAddServiceLine: (unitInstanceId: string) => void
  onDeleteServiceLine: (lineId: string) => void
  getAvailableServiceTypes: (unitTypeId: string, capacityId: string) => Array<{ id: string; label: string }>
  totalEstimatedPrice: number
  isServicesFilled: boolean
  onNavigateNext: () => void
}

export function ServiceSelectionStep({
  uniqueUnitInstanceIds, serviceLines, lineCatalogMissing, masterData,
  onPickService, onUpdateServiceLine, onUpdateServiceLineForGroup,
  onAddServiceLine, onDeleteServiceLine, getAvailableServiceTypes,
  totalEstimatedPrice, isServicesFilled, onNavigateNext,
}: Props) {
  return (
    <div className="space-y-4 pt-2">
      {uniqueUnitInstanceIds.length === 0 ? (
        <Alert><AlertDescription>Pilih AC pada section sebelumnya terlebih dahulu.</AlertDescription></Alert>
      ) : uniqueUnitInstanceIds.map((unitInstanceId) => {
        const groupLines = serviceLines.filter((l) => l.unit_instance_id === unitInstanceId)
        const firstLine = groupLines[0]
        if (!firstLine) return null

        return (
          <div key={unitInstanceId} className="space-y-4 rounded-lg border p-4 shadow-sm bg-card/50">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <p className="font-semibold text-base text-primary">{firstLine.ac_label}</p>
                <p className="text-xs text-muted-foreground">{firstLine.location_label}</p>
              </div>
              {firstLine.ac_unit_id === '__new__' && (
                <span className="bg-info hover:bg-info/90 text-white border-none text-[10px] px-1.5 py-0.5 rounded">AC Baru</span>
              )}
            </div>

            <SpecSelectors firstLine={firstLine} onUpdateServiceLineForGroup={onUpdateServiceLineForGroup} unitInstanceId={unitInstanceId} masterData={masterData} />

            <div className="space-y-4 pt-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Items</Label>
              {groupLines.map((line, idx) => (
                <ServiceItemRow key={line.line_id} line={line} idx={idx} groupLength={groupLines.length} lineCatalogMissing={!!lineCatalogMissing[line.line_id]} getAvailableServiceTypes={getAvailableServiceTypes} onPickService={onPickService} onUpdateServiceLine={onUpdateServiceLine} onDeleteServiceLine={onDeleteServiceLine} />
              ))}
            </div>

            <div className="flex justify-start border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => onAddServiceLine(unitInstanceId)} className="h-8 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" />Tambah Service</Button>
            </div>
          </div>
        )
      })}

      {serviceLines.length > 0 && (
        <>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">Total Estimasi</span>
            <span className="text-base font-bold">{idrFmt(totalEstimatedPrice)}</span>
          </div>
          {isServicesFilled && (
            <div className="flex justify-end"><Button onClick={onNavigateNext} className="h-11 w-full sm:h-9 sm:w-auto">Lanjut ke Schedule</Button></div>
          )}
        </>
      )}
    </div>
  )
}

function SpecSelectors({ firstLine, onUpdateServiceLineForGroup, unitInstanceId, masterData }: {
  firstLine: SelectedAcLine
  onUpdateServiceLineForGroup: (id: string, patch: Partial<SelectedAcLine>) => void
  unitInstanceId: string
  masterData: Record<string, unknown> | undefined
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 bg-muted/20 p-3 rounded-md">
      <div>
        <Label className="text-xs font-semibold">Tipe Unit *</Label>
        <Select value={firstLine.unit_type_id || ''} onValueChange={(val) => onUpdateServiceLineForGroup(unitInstanceId, { unit_type_id: val, capacity_id: '', estimated_price: 0, catalog_id: '', msn_code: '', service_type_id: '' })}>
          <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Pilih tipe unit..." /></SelectTrigger>
          <SelectContent>
            {((masterData?.unitTypes || []) as Array<Record<string, unknown>>).map((ut) => (
              <SelectItem key={ut.unit_type_id as string} value={ut.unit_type_id as string}>{ut.name as string}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold">Kapasitas *</Label>
        <Select value={firstLine.capacity_id || ''} disabled={!firstLine.unit_type_id} onValueChange={(val) => onUpdateServiceLineForGroup(unitInstanceId, { capacity_id: val, estimated_price: 0, catalog_id: '', msn_code: '', service_type_id: '' })}>
          <SelectTrigger className="h-9 bg-background"><SelectValue placeholder={firstLine.unit_type_id ? "Pilih kapasitas..." : "Pilih tipe unit dulu"} /></SelectTrigger>
          <SelectContent>
            {((masterData?.capacityRanges || []) as Array<Record<string, unknown>>).flatMap((cr) => cr.unit_type_id === firstLine.unit_type_id ? [(<SelectItem key={cr.capacity_id as string} value={cr.capacity_id as string}>{cr.capacity_label as string}</SelectItem>)] : [])}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

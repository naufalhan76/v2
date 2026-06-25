'use client'

import { ChevronDown, ChevronUp, Snowflake } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import { MaterialInput, type MaterialItem } from '@/components/technician/material-input'
import { type AcUnitReportItem } from '@/app/api/schemas/technician'
import { cn } from '@/lib/utils'

type DimensionData = {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  ac_brands: Array<{ brand_id: string; name: string }>
}

const sv = (v: string | null | undefined) => v ?? ''

interface AcUnitCardProps {
  field: { id: string } & Partial<AcUnitReportItem>
  index: number
  orderId: string
  initialUnits: AcUnitReportItem[]
  formValues: AcUnitReportItem[]
  setValue: ReturnType<typeof useForm<{ units: AcUnitReportItem[] }>>['setValue']
  register: ReturnType<typeof useForm<{ units: AcUnitReportItem[] }>>['register']
  dimensions: DimensionData
  isExpanded: boolean
  onToggleExpand: () => void
  onPhotoIdsChange: (kind: 'before' | 'after', photoIds: string[]) => void
}

export function AcUnitCard({ field, index, orderId, initialUnits, formValues, setValue, register, dimensions, isExpanded, onToggleExpand, onPhotoIdsChange }: AcUnitCardProps) {
  const isExisting = !!field.ac_unit_id
  const initialUnit = initialUnits[index]
  const isSkipped = formValues[index]?.skipped ?? false
  const isExistingComplete = isExisting && !!(initialUnit?.brand_id && initialUnit?.unit_type_id && initialUnit?.capacity_id)
  const hasData = (key: keyof AcUnitReportItem) => isExisting && !!initialUnit?.[key]
  const selectedUnitTypeId = sv(formValues[index]?.unit_type_id)
  const filteredCapacities = dimensions.capacity_ranges.filter((cap) => cap.unit_type_id === selectedUnitTypeId)

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className={cn("p-4 flex flex-row items-center justify-between cursor-pointer transition-colors hover:bg-surface-muted active:bg-surface-muted", !isExpanded && "pb-4")} onClick={onToggleExpand}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-primary dark:bg-surface dark:text-brand-200"><Snowflake className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">AC {index + 1}
              {isExisting && <span className="ml-2 text-xs font-normal text-status-assigned bg-status-assigned-bg px-1.5 py-0.5 rounded">Eksisting</span>}
              {isSkipped && <span className="ml-2 text-xs font-normal text-destructive">(Tidak diservis)</span>}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{formValues[index]?.brand || 'Merk belum diisi'}{formValues[index]?.capacity_label ? ` (${formValues[index]?.capacity_label})` : ''}{formValues[index]?.room_location ? ` - ${formValues[index]?.room_location}` : ''}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 pt-0 space-y-6">
          {isExisting && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`skip-${index}`} className="text-sm font-medium cursor-pointer">Tandai tidak diservis</Label>
                <Switch id={`skip-${index}`} checked={isSkipped} onCheckedChange={(checked) => { setValue(`units.${index}.skipped`, checked, { shouldValidate: true }); if (!checked) setValue(`units.${index}.skip_reason`, '') }} />
              </div>
              {isSkipped && (
                <div className="pt-2">
                  <Label htmlFor={`skip-reason-${index}`} className="mb-1.5 block text-sm text-destructive">Alasan tidak diservis *</Label>
                  <Input id={`skip-reason-${index}`} placeholder="Mis: AC terkunci..." className="h-11" {...register(`units.${index}.skip_reason`)} />
                </div>
              )}
            </div>
          )}
          {isExisting && !isExistingComplete && (
            <div className="rounded-lg border border-status-pending/30 bg-status-pending-bg p-3 text-sm text-status-pending">
              <p className="font-medium">Data AC eksisting tidak lengkap</p>
              <p className="mt-0.5 text-status-pending">Lengkapi data identitas yang kosong untuk AC ini.</p>
            </div>
          )}
          {!isSkipped && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Merk</Label>
                  <Select value={sv(formValues[index]?.brand_id)} onValueChange={(val) => { const m = dimensions.ac_brands.find((b) => b.brand_id === val); setValue(`units.${index}.brand_id`, val); setValue(`units.${index}.brand`, m ? m.name : null) }} disabled={hasData('brand_id')}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Pilih Merk AC..." /></SelectTrigger>
                    <SelectContent>{dimensions.ac_brands.map((b) => <SelectItem key={b.brand_id} value={b.brand_id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Jenis AC</Label>
                  <Select value={selectedUnitTypeId} onValueChange={(val) => { const m = dimensions.unit_types.find((t) => t.unit_type_id === val); setValue(`units.${index}.unit_type_id`, val); setValue(`units.${index}.ac_type`, m ? m.name : null); setValue(`units.${index}.capacity_id`, ''); setValue(`units.${index}.capacity_label`, '') }} disabled={hasData('unit_type_id')}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Pilih Jenis AC..." /></SelectTrigger>
                    <SelectContent>{dimensions.unit_types.map((t) => <SelectItem key={t.unit_type_id} value={t.unit_type_id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kapasitas</Label>
                  <Select value={sv(formValues[index]?.capacity_id)} disabled={hasData('capacity_id') || !selectedUnitTypeId} onValueChange={(val) => { const m = dimensions.capacity_ranges.find((c) => c.capacity_id === val); setValue(`units.${index}.capacity_id`, val); setValue(`units.${index}.capacity_label`, m ? m.capacity_label : '') }}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={selectedUnitTypeId ? "Pilih Kapasitas..." : "Pilih Jenis AC terlebih dahulu"} /></SelectTrigger>
                    <SelectContent>{filteredCapacities.map((c) => <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lokasi Ruangan</Label>
                  <Input placeholder="Kamar Tidur Utama..." className={cn("h-11", hasData('room_location') && "bg-muted dark:bg-surface text-muted-foreground dark:text-muted-foreground cursor-not-allowed")} readOnly={hasData('room_location')} {...register(`units.${index}.room_location`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Lantai</Label>
                  <Input placeholder="Lantai 1..." className={cn("h-11", hasData('floor_level') && "bg-muted dark:bg-surface text-muted-foreground dark:text-muted-foreground cursor-not-allowed")} readOnly={hasData('floor_level')} {...register(`units.${index}.floor_level`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Posisi Detail</Label>
                  <Input placeholder="Dekat jendela..." className={cn("h-11", hasData('position_detail') && "bg-muted dark:bg-surface text-muted-foreground dark:text-muted-foreground cursor-not-allowed")} readOnly={hasData('position_detail')} {...register(`units.${index}.position_detail`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Model</Label>
                  <Input placeholder="Model number..." className={cn("h-11", hasData('model_number') && "bg-muted dark:bg-surface text-muted-foreground dark:text-muted-foreground cursor-not-allowed")} readOnly={hasData('model_number')} {...register(`units.${index}.model_number`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Seri</Label>
                  <Input placeholder="Serial number..." className={cn("h-11", hasData('serial_number') && "bg-muted dark:bg-surface text-muted-foreground dark:text-muted-foreground cursor-not-allowed")} readOnly={hasData('serial_number')} {...register(`units.${index}.serial_number`)} />
                </div>
              </div>
              <div className="space-y-6 pt-2">
                <PhotoUploadOffline orderId={orderId} acUnitIdx={index} kind="before" value={formValues[index]?.photos_before || []} onChange={(urls, photoIds) => { setValue(`units.${index}.photos_before`, urls); onPhotoIdsChange('before', photoIds) }} min={1} max={3} />
                <PhotoUploadOffline orderId={orderId} acUnitIdx={index} kind="after" value={formValues[index]?.photos_after || []} onChange={(urls, photoIds) => { setValue(`units.${index}.photos_after`, urls); onPhotoIdsChange('after', photoIds) }} min={1} max={3} />
                <MaterialInput value={(formValues[index]?.materials_used as MaterialItem[]) || []} onChange={(mats) => setValue(`units.${index}.materials_used`, mats)} />
                <div className="space-y-1.5">
                  <Label>Catatan per AC</Label>
                  <Textarea placeholder="Catatan spesifik untuk AC ini..." className="min-h-[80px]" {...register(`units.${index}.notes`)} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

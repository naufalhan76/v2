'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Building2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { createLocation as createLocationAction } from '@/lib/actions/create-order-mutations'
import type { CustomerSearchResult } from '@/types/orders'

type LocationLite = NonNullable<CustomerSearchResult['locations']>[number]
export type { LocationLite }

import { AddressPicker } from '@/components/address/address-picker'

const newLocationSchema = z.object({
  full_address: z.string().min(3, 'Alamat minimal 3 karakter'),
  house_number: z.string().optional(),
  city: z.string().optional(),
  landmarks: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
})
type NewLocationInput = z.infer<typeof newLocationSchema>

type Props = {
  customer: CustomerSearchResult | null
  selectedAcs: Record<string, string[]>
  serviceLines: Array<{ line_id: string; unit_instance_id: string; location_id: string; ac_unit_id: string; ac_label: string }>
  showNewLocationForm: boolean
  onShowNewLocationFormChange: (show: boolean) => void
  onToggleAc: (locationId: string, acUnitId: string) => void
  onAddNewAcLine: (locationId: string) => void
  onRemoveServiceLine: (lineId: string) => void
  onCustomerWithNewLocation: React.Dispatch<React.SetStateAction<CustomerSearchResult | null>>
  onNavigateNext: () => void
  isFilled: boolean
  formatLocationLabel: (loc: Pick<LocationLite, 'full_address' | 'house_number' | 'city'>) => string
}

export function LocationStep({
  customer, selectedAcs, serviceLines, showNewLocationForm, onShowNewLocationFormChange,
  onToggleAc, onAddNewAcLine, onRemoveServiceLine, onCustomerWithNewLocation, onNavigateNext, isFilled, formatLocationLabel,
}: Props) {
  const locations = customer?.locations || []

  return (
    <div className="space-y-4 pt-2">
      {locations.length === 0 && !showNewLocationForm && (
        <Alert><AlertDescription>Customer ini belum punya lokasi. Tambahkan lokasi terlebih dahulu.</AlertDescription></Alert>
      )}

      {locations.map((loc) => (
        <LocationCard key={loc.location_id} loc={loc} selectedAcs={selectedAcs} serviceLines={serviceLines} onToggleAc={onToggleAc} onAddNewAcLine={onAddNewAcLine} onRemoveServiceLine={onRemoveServiceLine} formatLocationLabel={formatLocationLabel} />
      ))}

      {showNewLocationForm && customer && (
        <NewLocationForm
          customerId={customer.customer_id}
          onCreated={(newLoc) => {
            onShowNewLocationFormChange(false)
            if (customer) onCustomerWithNewLocation({ ...customer, locations: [...(customer.locations || []), newLoc] })
          }}
          onCancel={() => onShowNewLocationFormChange(false)}
        />
      )}

      {!showNewLocationForm && (
        <Button type="button" variant="outline" className="w-full" onClick={() => onShowNewLocationFormChange(true)}><Plus className="mr-2 h-4 w-4" />Tambah Lokasi Baru</Button>
      )}

      {isFilled && (
        <div className="flex justify-end"><Button onClick={onNavigateNext} className="h-11 w-full sm:h-9 sm:w-auto">Lanjut ke Service Items</Button></div>
      )}
    </div>
  )
}

function LocationCard({ loc, selectedAcs, serviceLines, onToggleAc, onAddNewAcLine, onRemoveServiceLine, formatLocationLabel }: {
  loc: LocationLite
  selectedAcs: Record<string, string[]>
  serviceLines: Array<{ line_id: string; unit_instance_id: string; location_id: string; ac_unit_id: string; ac_label: string }>
  onToggleAc: (locId: string, acId: string) => void
  onAddNewAcLine: (locId: string) => void
  onRemoveServiceLine: (lineId: string) => void
  formatLocationLabel: (loc: Pick<LocationLite, 'full_address' | 'house_number' | 'city'>) => string
}) {
  const acUnits = loc.ac_units || []
  const selected = selectedAcs[loc.location_id] || []
  const newAcs = serviceLines.filter((l) => l.location_id === loc.location_id && l.ac_unit_id === '__new__')
  const uniqueNewAcs = [...new Map(newAcs.map((l) => [l.unit_instance_id, l])).values()]

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{formatLocationLabel(loc)}</p>{loc.landmarks && <p className="text-xs text-muted-foreground">{loc.landmarks}</p>}</div></div>
        {uniqueNewAcs.length > 0 && (<Badge variant="secondary" className="shrink-0 gap-1 bg-status-assigned-bg text-info dark:bg-status-assigned-bg dark:text-info border-info/30 dark:border-info/30"><Plus className="h-3 w-3" />{uniqueNewAcs.length} AC Baru</Badge>)}
      </div>

      {acUnits.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm italic text-muted-foreground">Belum ada AC terdaftar di lokasi ini.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => onAddNewAcLine(loc.location_id)} className="h-9 text-xs"><Plus className="mr-1.5 h-3.5 w-3.5" />Tambah AC Baru</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pilih unit AC yang akan diservice</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {acUnits.map((ac) => {
              const isSelected = selected.includes(ac.ac_unit_id)
              return (
                <button key={ac.ac_unit_id} type="button" onClick={() => onToggleAc(loc.location_id, ac.ac_unit_id)} aria-pressed={isSelected}
                  className={`group flex items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}>
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background group-hover:border-primary/60'}`} aria-hidden="true">
                    {isSelected && <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0 text-sm"><p className="font-medium truncate">{ac.brand} {ac.model_number}</p><p className="text-xs text-muted-foreground truncate">{ac.serial_number || 'Tanpa SN'}{ac.capacity_btu ? ` • ${ac.capacity_btu} BTU` : ''}</p></div>
                </button>
              )
            })}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onAddNewAcLine(loc.location_id)} className="h-9 text-xs mt-2"><Plus className="mr-1.5 h-3.5 w-3.5" />Tambah AC Baru</Button>
        </div>
      )}

      {uniqueNewAcs.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Label className="text-xs text-muted-foreground">AC Baru yang Ditambahkan:</Label>
          <div className="space-y-1.5">
            {uniqueNewAcs.map((line) => (
              <div key={line.unit_instance_id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="flex items-center gap-2"><span className="font-semibold text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">NEW</span><span>{line.ac_label}</span></div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onRemoveServiceLine(line.line_id) }}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NewLocationForm({ customerId, onCreated, onCancel }: { customerId: string; onCreated: (loc: LocationLite) => void; onCancel: () => void }) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<NewLocationInput>({
    resolver: zodResolver(newLocationSchema),
    defaultValues: { full_address: '', house_number: '', city: '', landmarks: '', lat: null, lng: null },
  })

  const onSubmit = async (values: NewLocationInput) => {
    setSubmitting(true)
    try {
      const res = await createLocationAction({ 
        customer_id: customerId, 
        full_address: values.full_address, 
        house_number: values.house_number || undefined, 
        city: values.city || undefined, 
        landmarks: values.landmarks || undefined,
        lat: values.lat ?? null,
        lng: values.lng ?? null,
      })
      if (!res.success || !res.data) { toast({ title: 'Gagal membuat lokasi', description: res.error || 'Terjadi kesalahan', variant: 'destructive' }); return }
      const newLoc: LocationLite = { 
        location_id: res.data.location_id, 
        full_address: values.full_address, 
        house_number: values.house_number || '', 
        city: values.city || '', 
        landmarks: values.landmarks || null, 
        lat: values.lat ?? null,
        lng: values.lng ?? null,
        ac_units: [] 
      }
      toast({ title: 'Lokasi baru tersimpan' }); onCreated(newLoc)
    } finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div><Label>Alamat Lengkap *</Label><Input {...form.register('full_address')} placeholder="Jl. Mawar No. 123" />{form.formState.errors.full_address && <p className="mt-1 text-xs text-destructive">{form.formState.errors.full_address.message}</p>}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><Label>Nomor / Blok</Label><Input {...form.register('house_number')} placeholder="12A / Blok B" /></div>
        <div><Label>Kota</Label><Input {...form.register('city')} placeholder="Jakarta" /></div>
      </div>
      <div><Label>Patokan</Label><Input {...form.register('landmarks')} placeholder="Dekat indomaret" /></div>
      <div>
        <Label>Titik Lokasi Peta (Opsional)</Label>
        <AddressPicker
          value={{ lat: form.watch('lat') ?? null, lng: form.watch('lng') ?? null }}
          onChange={(newVal) => {
            form.setValue('lat', newVal.lat, { shouldDirty: true });
            form.setValue('lng', newVal.lng, { shouldDirty: true });
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>Batal</Button>
        <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Lokasi</Button>
      </div>
    </form>
  )
}

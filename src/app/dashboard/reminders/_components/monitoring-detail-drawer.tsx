'use client'

import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

import type { ServicedAcUnitRow } from '@/lib/actions/reminders'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Pencil } from 'lucide-react'
import { StatusBadge } from '@/components/orders/status-badge'
import { useState } from 'react'

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: localeId }) } catch { return iso }
}

function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: localeId }) } catch { return iso }
}

interface Props {
  unit: ServicedAcUnitRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateDate: (acUnitId: string, newDate: string | null) => void
  isUpdatingDate: boolean
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children ?? '—'}</span>
    </div>
  )
}

export function MonitoringDetailDrawer({ unit: u, open, onOpenChange, onUpdateDate, isUpdatingDate }: Props) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [pickedDate, setPickedDate] = useState<Date | undefined>(
    u?.next_service_due_date ? new Date(`${u.next_service_due_date}T00:00:00`) : undefined
  )

  function handleDateSelect(d: Date | undefined) {
    setPickedDate(d)
    if (d && u) {
      onUpdateDate(u.ac_unit_id, format(d, 'yyyy-MM-dd'))
      setDatePickerOpen(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (v && u?.next_service_due_date) setPickedDate(new Date(`${u.next_service_due_date}T00:00:00`))
        onOpenChange(v)
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Detail AC</SheetTitle>
          <SheetDescription>Jadwal service, riwayat reminder, dan informasi unit.</SheetDescription>
        </SheetHeader>
        {u && (
          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Customer</h3>
              <Row label="Nama">{u.customer_name}</Row>
              <Row label="Telepon">{u.customer_phone}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">AC</h3>
              <Row label="Brand">{u.brand}</Row>
              <Row label="Model">{u.model_number}</Row>
              <Row label="Tipe">{u.unit_type_name ?? u.ac_type}</Row>
              <Row label="Kapasitas (BTU)">{u.capacity_btu ?? '—'}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Lokasi</h3>
              <Row label="Alamat">{u.location_address}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Jadwal Service</h3>
              <Row label="Service Terakhir">{fmt(u.last_service_date)}</Row>
              <Row label="Jadwal Berikutnya">
                <div className="flex items-center gap-2">
                  <span>{fmt(u.next_service_due_date)}</span>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" disabled={isUpdatingDate} onClick={(e) => e.stopPropagation()}>
                        <Pencil className="h-3 w-3" />Edit
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={pickedDate} onSelect={handleDateSelect} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Reminder</h3>
              <Row label="Pending">{u.has_pending_reminder ? <Badge variant="secondary">Ya</Badge> : <span className="text-sm">Tidak</span>}</Row>
              <Row label="Total Reminder">{u.reminder_count}</Row>
              <Row label="Reminder Terakhir">{fmtDT(u.last_reminder_sent_at)}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Terakhir Order</h3>
              <Row label="Status">{u.latest_order_status ? <StatusBadge status={u.latest_order_status} size="sm" /> : '—'}</Row>
              <Row label="Jenis Service">{u.latest_service_type ? <Badge variant="outline">{u.latest_service_type}</Badge> : '—'}</Row>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

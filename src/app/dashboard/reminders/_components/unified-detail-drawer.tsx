'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Mail, MessageCircle, Pencil } from 'lucide-react'

import type { UnifiedReminderRow, ReminderStatus } from '@/types/reminders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu', SENT: 'Terkirim', FAILED: 'Gagal', CANCELLED: 'Dibatalkan', DISMISSED: 'Diabaikan',
}
const STATUS_VARIANT: Record<ReminderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary', SENT: 'default', FAILED: 'destructive', CANCELLED: 'outline', DISMISSED: 'outline',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: localeId }) } catch { return iso }
}
function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: localeId }) } catch { return iso }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children ?? '—'}</span>
    </div>
  )
}

interface Props {
  row: UnifiedReminderRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateDate: (acUnitId: string, newDate: string | null) => void
  isUpdatingDate: boolean
}

export function UnifiedDetailDrawer({ row: u, open, onOpenChange, onUpdateDate, isUpdatingDate }: Props) {
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
          <SheetTitle>Detail AC &amp; Reminder</SheetTitle>
          <SheetDescription>Informasi unit AC, jadwal service, dan status reminder.</SheetDescription>
        </SheetHeader>
        {u && (
          <div className="mt-4 space-y-4">
            {/* Customer */}
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Customer</h3>
              <Row label="Nama">{u.customer_name}</Row>
              <Row label="Telepon">{u.customer_phone}</Row>
            </section>

            {/* AC */}
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">AC</h3>
              <Row label="Brand">{u.brand}</Row>
              <Row label="Model">{u.model_number}</Row>
              <Row label="Tipe">{u.unit_type_name ?? u.ac_type}</Row>
            </section>

            {/* Service Schedule */}
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Jadwal Service</h3>
              <Row label="Service Terakhir">{fmt(u.last_service_date)}</Row>
              <Row label="Jadwal Berikutnya">
                <div className="flex items-center gap-2">
                  <span>{fmt(u.next_service_due_date)}</span>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        disabled={isUpdatingDate}
                        onClick={(e) => e.stopPropagation()}
                      >
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

            {/* Reminder */}
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Reminder</h3>
              {u.reminder_id ? (
                <>
                  <Row label="Status">
                    <Badge variant={STATUS_VARIANT[u.reminder_status!]}>{STATUS_LABELS[u.reminder_status!]}</Badge>
                  </Row>
                  <Row label="Channel">
                    {u.reminder_channel === 'WHATSAPP'
                      ? <><MessageCircle className="inline h-3 w-3 mr-1" />WhatsApp</>
                      : u.reminder_channel === 'EMAIL'
                        ? <><Mail className="inline h-3 w-3 mr-1" />Email</>
                        : '—'}
                  </Row>
                  <Row label="Penerima">{u.reminder_recipient}</Row>
                  <Row label="Jatuh Tempo">{fmt(u.reminder_due_date)}</Row>
                  <Row label="Pesan">
                    <p className="whitespace-pre-wrap text-sm">{u.reminder_message}</p>
                  </Row>
                  {u.reminder_status === 'FAILED' && u.reminder_error_message && (
                    <Row label="Error">{u.reminder_error_message}</Row>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-1">
                  Belum ada reminder untuk AC ini. Klik &ldquo;Buat&rdquo; di tabel untuk membuat reminder manual.
                </p>
              )}
            </section>

            {/* Reminder History */}
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Riwayat</h3>
              <Row label="Total Reminder">{u.reminder_count}</Row>
              <Row label="Reminder Terakhir Dikirim">{fmtDT(u.last_reminder_sent_at)}</Row>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

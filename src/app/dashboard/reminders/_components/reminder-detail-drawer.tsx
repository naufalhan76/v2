'use client'

import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { BellRing, Mail, MessageCircle } from 'lucide-react'

import type { ReminderRow, ReminderStatus } from '@/types/reminders'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu', SENT: 'Terkirim', FAILED: 'Gagal', CANCELLED: 'Dibatalkan', DISMISSED: 'Diabaikan',
}
const STATUS_VARIANT: Record<ReminderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary', SENT: 'default', FAILED: 'destructive', CANCELLED: 'outline', DISMISSED: 'outline',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: localeId }) } catch { return iso }
}

interface Props {
  reminder: ReminderRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children ?? '—'}</span>
    </div>
  )
}

export function ReminderDetailDrawer({ reminder: r, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Detail Reminder</SheetTitle>
          <SheetDescription>Provenance lengkap untuk audit dan follow-up.</SheetDescription>
        </SheetHeader>
        {r && (
          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Customer</h3>
              <Row label="Nama">{r.customers?.customer_name}</Row>
              <Row label="Telepon">{r.customers?.phone_number}</Row>
              <Row label="Email">{r.customers?.email}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">AC</h3>
              <Row label="Brand">{r.ac_units?.ac_brands?.name ?? r.ac_units?.brand}</Row>
              <Row label="Model">{r.ac_units?.model_number}</Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Reminder</h3>
              <Row label="Jatuh Tempo">{fmt(r.due_date)}</Row>
              <Row label="Channel">
                {r.channel === 'WHATSAPP' ? <><MessageCircle className="inline h-3 w-3 mr-1" />WhatsApp</> : <><Mail className="inline h-3 w-3 mr-1" />Email</>}
              </Row>
              <Row label="Penerima">{r.recipient}</Row>
              <Row label="Rule">{r.reminder_rules?.name ?? '—'}</Row>
              <Row label="Hari Sebelum Jatuh Tempo">{r.reminder_rules?.days_before_due ?? '—'}</Row>
              <Row label="Pesan">
                <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              </Row>
              <Row label="Status"><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge></Row>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Riwayat Pengiriman</h3>
              <Row label="Terkirim Pada">{fmt(r.sent_at)}</Row>
              <Row label="Dikirim Oleh">{r.sent_by ?? '—'}</Row>
              <Row label="External ID">{r.external_id}</Row>
              <Row label="Error Message">{r.error_message ?? '—'}</Row>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

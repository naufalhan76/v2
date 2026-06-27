'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Pencil } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusBadge } from '@/components/orders/status-badge'
import type { ServicedAcUnitRow } from '@/lib/actions/reminders'

import { MonitoringDetailDrawer } from './monitoring-detail-drawer'

function daysFromToday(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: localeId }) }
  catch { return iso }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  try { return format(parseISO(iso), 'd MMM HH:mm', { locale: localeId }) }
  catch { return iso }
}

interface ServiceRecordRowProps {
  unit: ServicedAcUnitRow
  onSendReminder: () => void
  isSending: boolean
  onUpdateDate: (newDate: string | null) => void
  isUpdatingDate: boolean
  onRowClick: () => void
}

function ServiceRecordRow({ unit: u, onSendReminder, isSending, onUpdateDate, isUpdatingDate, onRowClick }: ServiceRecordRowProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [pickedDate, setPickedDate] = useState<Date | undefined>(
    u.next_service_due_date ? new Date(`${u.next_service_due_date}T00:00:00`) : undefined
  )
  const days = daysFromToday(u.next_service_due_date)

  function handleDateSelect(d: Date | undefined) {
    setPickedDate(d)
    if (d) {
      onUpdateDate(format(d, 'yyyy-MM-dd'))
      setDatePickerOpen(false)
    }
  }

  return (
    <TableRow className="cursor-pointer" onClick={onRowClick}>
      <TableCell>
        <div className="font-medium text-sm">{u.customer_name ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{u.customer_phone ?? '—'}</div>
      </TableCell>
      <TableCell>
        <div className="font-medium text-sm">{[u.brand, u.model_number].filter(Boolean).join(' ') || '—'}</div>
        <div className="text-xs text-muted-foreground">{u.unit_type_name ?? u.ac_type ?? '—'}</div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <span className="text-sm">{fmtDate(u.last_service_date)}</span>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="text-sm">{fmtDate(u.next_service_due_date)}</div>
          {days !== null && days < 0 && (
            <Badge variant="destructive" className="text-xs">Overdue ({Math.abs(days)} hari)</Badge>
          )}
          {days !== null && days >= 0 && days <= 7 && (
            <Badge variant="outline" className="border-warning/30 bg-status-pending-bg text-warning text-xs dark:border-warning/30 dark:bg-status-pending-bg dark:text-warning">
              Jatuh tempo dalam {days} hari
            </Badge>
          )}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" disabled={isUpdatingDate}>
                <Pencil className="h-3 w-3" /> {u.next_service_due_date ? 'Edit tanggal' : 'Set tanggal'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={pickedDate} onSelect={handleDateSelect} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {u.latest_service_type ? <Badge variant="outline" className="text-xs">{u.latest_service_type}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="space-y-1">
          <Badge variant="secondary" className="rounded-full text-xs">{u.reminder_count} reminders</Badge>
          {u.last_reminder_sent_at && <div className="text-xs text-muted-foreground">Last: {fmtDateTime(u.last_reminder_sent_at)}</div>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {u.latest_order_status ? <StatusBadge status={u.latest_order_status} size="sm" /> : <span className="text-muted-foreground text-sm">—</span>}
      </TableCell>
      <TableCell>
        <span onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onSendReminder} disabled={isSending} title="Buat reminder manual">
            Buat Reminder
          </Button>
        </span>
      </TableCell>
    </TableRow>
  )
}

interface MonitoringTableProps {
  units: ServicedAcUnitRow[]
  isLoading: boolean
  isFetching: boolean
  page: number
  pageSize: number
  onCreateReminder: (acUnitId: string) => void
  sendingId: string | null
  onUpdateDate: (acUnitId: string, newDate: string | null) => void
  updatingDateId: string | null
}

export function MonitoringTable({
  units, isLoading, isFetching, page, pageSize,
  onCreateReminder, sendingId, onUpdateDate, updatingDateId,
}: MonitoringTableProps) {
  const paginated = units.slice(page * pageSize, (page + 1) * pageSize)
  const [selectedUnit, setSelectedUnit] = useState<ServicedAcUnitRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>AC</TableHead>
            <TableHead className="hidden lg:table-cell">Service Terakhir</TableHead>
            <TableHead>Jadwal Berikutnya</TableHead>
            <TableHead className="hidden md:table-cell">Jenis Service</TableHead>
            <TableHead className="hidden lg:table-cell">Riwayat Reminder</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="w-[48px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((u) => (
            <ServiceRecordRow
              key={u.ac_unit_id}
              unit={u}
              onRowClick={() => { setSelectedUnit(u); setDrawerOpen(true) }}
              onSendReminder={() => onCreateReminder(u.ac_unit_id)}
              isSending={sendingId === u.ac_unit_id}
              onUpdateDate={(newDate) => onUpdateDate(u.ac_unit_id, newDate)}
              isUpdatingDate={updatingDateId === u.ac_unit_id}
            />
          ))}
        </TableBody>
      </Table>
    </div>
    <MonitoringDetailDrawer unit={selectedUnit} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdateDate={onUpdateDate} isUpdatingDate={!!updatingDateId} />
    </>
  )
}

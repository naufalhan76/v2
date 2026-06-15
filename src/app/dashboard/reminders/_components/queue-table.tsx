'use client'

import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { BellRing, Loader2, Mail, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'

import type { ReminderRow, ReminderStatus } from '@/types/reminders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu', SENT: 'Terkirim', FAILED: 'Gagal', CANCELLED: 'Dibatalkan', DISMISSED: 'Diabaikan',
}
const STATUS_VARIANT: Record<ReminderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary', SENT: 'default', FAILED: 'destructive', CANCELLED: 'outline', DISMISSED: 'outline',
}

interface QueueTableProps {
  data: ReminderRow[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  sendMutation: { isPending: boolean; variables: string | undefined }
  dismissMutation: { isPending: boolean; variables: string | undefined }
  onSend: (id: string) => void
  onDismiss: (id: string) => void
  isLoading: boolean
  isFetching: boolean
  filteredReminders: ReminderRow[]
  hasFilters: boolean
  clearFilters: () => void
  onGenerate: () => void
  isGenerating: boolean
}

function RowActions({ row, sendMutation, dismissMutation, onSend, onDismiss }: {
  row: ReminderRow
  sendMutation: { isPending: boolean; variables: string | undefined }
  dismissMutation: { isPending: boolean; variables: string | undefined }
  onSend: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const isSending = sendMutation.isPending && sendMutation.variables === row.reminder_id
  const isDismissing = dismissMutation.isPending && dismissMutation.variables === row.reminder_id
  return (
    <div className="flex justify-end gap-1 sm:gap-2">
      {row.status === 'PENDING' && (
        <Button size="sm" variant="default" onClick={() => onSend(row.reminder_id)} disabled={isSending} className="min-h-[44px] sm:min-h-9">
          {isSending ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <Send className="h-3 w-3 sm:mr-2" />}
          <span className="hidden sm:inline">Kirim</span>
        </Button>
      )}
      {(row.status === 'PENDING' || row.status === 'FAILED') && (
        <Button size="sm" variant="ghost" onClick={() => onDismiss(row.reminder_id)} disabled={isDismissing} className="min-h-[44px] sm:min-h-9">
          {isDismissing ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <X className="h-3 w-3 sm:mr-2" />}
          <span className="hidden sm:inline">Abaikan</span>
        </Button>
      )}
    </div>
  )
}

function createColumns(
  sendMutation: { isPending: boolean; variables: string | undefined },
  dismissMutation: { isPending: boolean; variables: string | undefined },
  onSend: (id: string) => void,
  onDismiss: (id: string) => void,
): ColumnDef<ReminderRow>[] {
  return [
    { id: 'select', header: ({ table }) => (
      <Checkbox checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} aria-label="Pilih semua" />
    ), cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Pilih baris" disabled={row.original.status !== 'PENDING'} />
    ), enableSorting: false },
    { id: 'customer', header: 'Customer', cell: ({ row }) => { const c = row.original.customers; return (
      <div className="text-sm"><div className="font-medium">{c?.customer_name ?? '-'}</div>{c?.primary_contact_person && <div className="text-xs text-muted-foreground">{c.primary_contact_person}</div>}</div>
    ) } },
    { id: 'ac_unit', header: 'Unit AC', cell: ({ row }) => { const u = row.original.ac_units; if (!u) return <span className="text-muted-foreground">-</span>; const brand = u.ac_brands?.name || u.brand; return (
      <div className="text-sm"><div>{brand ?? '-'}</div>{u.model_number && <div className="text-xs text-muted-foreground">{u.model_number}</div>}</div>
    ) }, meta: { className: 'hidden lg:table-cell' } },
    { accessorKey: 'due_date', header: 'Jatuh Tempo', cell: ({ row }) => { const d = row.original.due_date; if (!d) return '-'; try { return <span className="text-sm">{format(parseISO(d), 'd MMM yyyy', { locale: localeId })}</span> } catch { return d } } },
    { accessorKey: 'channel', header: 'Channel', cell: ({ row }) => { const ch = row.original.channel; return (
      <Badge variant="outline" className="gap-1">{ch === 'WHATSAPP' ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}{ch === 'WHATSAPP' ? 'WhatsApp' : 'Email'}</Badge>
    ) }, enableSorting: false, meta: { className: 'hidden md:table-cell' } },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => (<Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge>) },
    { id: 'actions', header: '', cell: ({ row }) => (<RowActions row={row.original} sendMutation={sendMutation} dismissMutation={dismissMutation} onSend={onSend} onDismiss={onDismiss} />), enableSorting: false },
  ]
}

export function QueueTable({ data, sorting, onSortingChange, rowSelection, onRowSelectionChange, sendMutation, dismissMutation, onSend, onDismiss, isLoading, isFetching, filteredReminders, hasFilters, clearFilters, onGenerate, isGenerating }: QueueTableProps) {
  const table = useReactTable({ data, columns: createColumns(sendMutation, dismissMutation, onSend, onDismiss), state: { sorting, rowSelection }, onSortingChange, onRowSelectionChange, getRowId: (row) => row.reminder_id, enableRowSelection: (row) => row.original.status === 'PENDING', getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 20 } } })

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</div>
          ) : filteredReminders.length === 0 ? (
            <EmptyState icon={BellRing} title={hasFilters ? 'Tidak ada reminder yang cocok' : 'Belum ada reminder'} description={hasFilters ? 'Coba ubah filter pencarian atau reset filter.' : 'Klik "Generate Reminder" untuk membuat reminder dari jadwal service AC.'} action={hasFilters ? { label: 'Reset Filter', onClick: clearFilters, icon: X } : { label: isGenerating ? 'Memproses...' : 'Generate Reminder', onClick: onGenerate, icon: Sparkles }} />
          ) : (
            <div className="data-table-container overflow-x-auto">
              <Table>
                <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => { const meta = h.column.columnDef.meta as { className?: string } | undefined; return (<TableHead key={h.id} className={meta?.className}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>) })}</TableRow>))}</TableHeader>
                <TableBody>{table.getRowModel().rows.map((row) => (<TableRow key={row.id}>{row.getVisibleCells().map((cell) => { const meta = cell.column.columnDef.meta as { className?: string } | undefined; return (<TableCell key={cell.id} className={meta?.className}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>) })}</TableRow>))}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {filteredReminders.length > 0 && (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground text-center sm:text-left">Menampilkan {table.getRowModel().rows.length} dari {filteredReminders.length} reminder{isFetching && ' • memuat ulang...'}</p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="flex-1 sm:flex-none">Sebelumnya</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="flex-1 sm:flex-none">Berikutnya</Button>
          </div>
        </div>
      )}
    </>
  )
}

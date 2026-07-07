'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { BellRing, Loader2, Mail, MessageCircle, Plus, Send, Sparkles, X } from 'lucide-react'
import {
  type ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, type OnChangeFn, type RowSelectionState,
  type SortingState, useReactTable,
} from '@tanstack/react-table'
import type { UnifiedReminderRow, ReminderStatus } from '@/types/reminders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: 'Menunggu', SENT: 'Terkirim', FAILED: 'Gagal', CANCELLED: 'Dibatalkan', DISMISSED: 'Diabaikan',
}
const STATUS_VARIANT: Record<ReminderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary', SENT: 'default', FAILED: 'destructive', CANCELLED: 'outline', DISMISSED: 'outline',
}

function daysFromToday(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DueDateCell({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-muted-foreground text-sm">—</span>
  const days = daysFromToday(dueDate)
  try {
    const formatted = format(parseISO(dueDate), 'd MMM yyyy', { locale: localeId })
    if (days !== null && days < 0) {
      return (
        <div className="space-y-0.5">
          <span className="text-sm">{formatted}</span>
          <Badge variant="destructive" className="text-xs">Overdue ({Math.abs(days)}h)</Badge>
        </div>
      )
    }
    if (days !== null && days >= 0 && days <= 7) {
      return (
        <div className="space-y-0.5">
          <span className="text-sm">{formatted}</span>
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-xs">{days} hari lagi</Badge>
        </div>
      )
    }
    return <span className="text-sm">{formatted}</span>
  } catch { return <span className="text-sm">{dueDate}</span> }
}

interface RowActionsProps {
  row: UnifiedReminderRow
  sendMutation: { isPending: boolean; variables: string | undefined }
  dismissMutation: { isPending: boolean; variables: string | undefined }
  onSend: (id: string) => void
  onDismiss: (id: string) => void
  onCreateReminder: (acUnitId: string) => void
  creatingId: string | null
}

function RowActions({ row, sendMutation, dismissMutation, onSend, onDismiss, onCreateReminder, creatingId }: RowActionsProps) {
  const isSending = sendMutation.isPending && sendMutation.variables === row.reminder_id
  const isDismissing = dismissMutation.isPending && dismissMutation.variables === row.reminder_id
  const isCreating = creatingId === row.ac_unit_id

  return (
    <div className="flex justify-end gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
      {/* PENDING → Kirim */}
      {row.reminder_status === 'PENDING' && row.reminder_id && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="default" onClick={() => onSend(row.reminder_id!)} disabled={isSending} className="min-h-[44px] sm:min-h-9">
              {isSending ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <Send className="h-3 w-3 sm:mr-2" />}
              <span className="hidden sm:inline">Kirim</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kirim reminder ke customer via {row.reminder_channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}</TooltipContent>
        </Tooltip>
      )}

      {/* FAILED → Retry */}
      {row.reminder_status === 'FAILED' && row.reminder_id && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="default" onClick={() => onSend(row.reminder_id!)} disabled={isSending} className="min-h-[44px] sm:min-h-9">
              {isSending ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <Send className="h-3 w-3 sm:mr-2" />}
              <span className="hidden sm:inline">Retry</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kirim ulang reminder yang gagal ke customer</TooltipContent>
        </Tooltip>
      )}

      {/* No reminder → Buat */}
      {!row.reminder_id && row.next_service_due_date && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => onCreateReminder(row.ac_unit_id)} disabled={isCreating} className="min-h-[44px] sm:min-h-9">
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <Plus className="h-3 w-3 sm:mr-2" />}
              <span className="hidden sm:inline">Buat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Buat reminder baru untuk AC ini (masuk ke antrian sebagai Menunggu)</TooltipContent>
        </Tooltip>
      )}

      {/* PENDING or FAILED → Abaikan */}
      {(row.reminder_status === 'PENDING' || row.reminder_status === 'FAILED') && row.reminder_id && (
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={isDismissing} className="min-h-[44px] sm:min-h-9">
                  {isDismissing ? <Loader2 className="h-3 w-3 animate-spin sm:mr-2" /> : <X className="h-3 w-3 sm:mr-2" />}
                  <span className="hidden sm:inline">Abaikan</span>
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Tandai reminder sebagai diabaikan (tidak dikirim, tetap tersimpan di riwayat)</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abaikan Reminder</AlertDialogTitle>
              <AlertDialogDescription>
                Reminder ini akan ditandai diabaikan dan tidak akan dikirim. Data reminder tetap tersimpan di riwayat. Lanjutkan?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDismiss(row.reminder_id!)}>
                Ya, Abaikan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function createColumns(
  sendMutation: RowActionsProps['sendMutation'],
  dismissMutation: RowActionsProps['dismissMutation'],
  onSend: (id: string) => void,
  onDismiss: (id: string) => void,
  onCreateReminder: (acUnitId: string) => void,
  creatingId: string | null,
): ColumnDef<UnifiedReminderRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Pilih semua"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Pilih baris"
            disabled={row.original.reminder_status !== 'PENDING' || !row.original.reminder_id}
          />
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.customer_name ?? '—'}</div>
          {row.original.customer_phone && <div className="text-xs text-muted-foreground">{row.original.customer_phone}</div>}
        </div>
      ),
    },
    {
      id: 'ac_unit',
      header: 'Unit AC',
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.brand ?? '—'}</div>
          {row.original.model_number && <div className="text-xs text-muted-foreground">{row.original.model_number}</div>}
        </div>
      ),
      meta: { className: 'hidden lg:table-cell' },
    },
    {
      accessorKey: 'next_service_due_date',
      header: 'Jatuh Tempo',
      cell: ({ row }) => <DueDateCell dueDate={row.original.next_service_due_date} />,
    },
    {
      id: 'reminder_channel',
      header: 'Channel',
      cell: ({ row }) => {
        if (!row.original.reminder_channel) return <span className="text-muted-foreground text-sm">—</span>
        const ch = row.original.reminder_channel
        return (
          <Badge variant="outline" className="gap-1">
            {ch === 'WHATSAPP' ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
            {ch === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
          </Badge>
        )
      },
      enableSorting: false,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      id: 'reminder_status',
      header: 'Reminder',
      cell: ({ row }) => {
        if (!row.original.reminder_id) return <span className="text-xs text-muted-foreground">Belum ada</span>
        return <Badge variant={STATUS_VARIANT[row.original.reminder_status!]}>{STATUS_LABELS[row.original.reminder_status!]}</Badge>
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          sendMutation={sendMutation}
          dismissMutation={dismissMutation}
          onSend={onSend}
          onDismiss={onDismiss}
          onCreateReminder={onCreateReminder}
          creatingId={creatingId}
        />
      ),
      enableSorting: false,
    },
  ]
}

interface UnifiedTableProps {
  data: UnifiedReminderRow[]
  isLoading: boolean
  hasFilters: boolean
  onClearFilters: () => void
  onGenerate: () => void
  isGenerating: boolean
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  sendMutation: { isPending: boolean; variables: string | undefined }
  dismissMutation: { isPending: boolean; variables: string | undefined }
  onSend: (id: string) => void
  onDismiss: (id: string) => void
  onCreateReminder: (acUnitId: string) => void
  creatingId: string | null
  onRowClick: (row: UnifiedReminderRow) => void
}

export function UnifiedTable({
  data, isLoading, hasFilters, onClearFilters, onGenerate, isGenerating,
  rowSelection, onRowSelectionChange, sendMutation, dismissMutation,
  onSend, onDismiss, onCreateReminder, creatingId, onRowClick,
}: UnifiedTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns: createColumns(sendMutation, dismissMutation, onSend, onDismiss, onCreateReminder, creatingId),
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange,
    getRowId: (row) => row.reminder_id ?? row.ac_unit_id,
    enableRowSelection: (row) => row.original.reminder_status === 'PENDING' && !!row.original.reminder_id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <TooltipProvider delayDuration={300}>
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={hasFilters ? 'Tidak ada data yang cocok' : 'Belum ada AC untuk dimonitor'}
            description={hasFilters ? 'Tidak ada data yang cocok dengan filter ini.' : 'AC akan muncul di sini setelah teknisi menyelesaikan service report dan mengisi tanggal service berikutnya.'}
            action={hasFilters
              ? { label: 'Reset Filter', onClick: onClearFilters, icon: X }
              : { label: isGenerating ? 'Memproses...' : 'Scan & Buat Antrian', onClick: onGenerate, icon: Sparkles }}
          />
        ) : (
          <div className="data-table-container overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => {
                      const meta = h.column.columnDef.meta as { className?: string } | undefined
                      return <TableHead key={h.id} className={meta?.className}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => onRowClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { className?: string } | undefined
                      return <TableCell key={cell.id} className={meta?.className}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {data.length > 0 && (
        <div className="flex flex-col items-stretch gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Menampilkan {table.getRowModel().rows.length} dari {data.length} AC
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="flex-1 sm:flex-none">Sebelumnya</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="flex-1 sm:flex-none">Berikutnya</Button>
          </div>
        </div>
      )}
    </Card>
    </TooltipProvider>
  )
}

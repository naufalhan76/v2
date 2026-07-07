'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isToday, parseISO } from 'date-fns'
import {
  AlertTriangle, BellRing, CalendarClock, CheckCircle2,
  Loader2, Send, Sparkles, Snowflake, XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import {
  getCustomerReminders,
  getServicedAcUnits,
  createManualReminder,
  type ServicedAcUnitRow,
} from '@/lib/actions/reminders'
import { updateAcUnitNextServiceDate } from '@/lib/actions/ac-units'
import { markReminderSent, markRemindersSent, markReminderDismissed } from '@/lib/actions/reminders'
import type { UnifiedReminderRow, UnifiedStatusFilter, ReminderRow } from '@/types/reminders'

import { UnifiedTable } from './_components/unified-table'
import { UnifiedDetailDrawer } from './_components/unified-detail-drawer'

// =============================================================================
// Helpers
// =============================================================================

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x }
function daysFromToday(dueIso: string | null): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** Merge AC units + reminders into unified rows. One row per AC unit. */
function mergeData(units: ServicedAcUnitRow[], reminders: ReminderRow[]): UnifiedReminderRow[] {
  // Build map: ac_unit_id → latest actionable reminder (PENDING > FAILED > others)
  const reminderByAc = new Map<string, ReminderRow>()
  for (const r of reminders) {
    if (!r.ac_unit_id) continue
    const existing = reminderByAc.get(r.ac_unit_id)
    if (!existing) { reminderByAc.set(r.ac_unit_id, r); continue }
    // PENDING takes priority, then FAILED, then most recent
    if (r.status === 'PENDING' && existing.status !== 'PENDING') { reminderByAc.set(r.ac_unit_id, r); continue }
    if (r.status === 'FAILED' && existing.status !== 'PENDING' && existing.status !== 'FAILED') { reminderByAc.set(r.ac_unit_id, r); continue }
  }

  return units.map((u): UnifiedReminderRow => {
    const r = reminderByAc.get(u.ac_unit_id) ?? null
    return {
      ac_unit_id: u.ac_unit_id,
      customer_id: u.customer_id,
      customer_name: u.customer_name,
      customer_phone: u.customer_phone,
      location_address: u.location_address,
      brand: u.brand,
      model_number: u.model_number,
      ac_type: u.ac_type,
      unit_type_name: u.unit_type_name,
      last_service_date: u.last_service_date,
      next_service_due_date: u.next_service_due_date,
      reminder_id: r?.reminder_id ?? null,
      reminder_status: r?.status ?? null,
      reminder_channel: r?.channel ?? null,
      reminder_recipient: r?.recipient ?? null,
      reminder_message: r?.message ?? null,
      reminder_due_date: r?.due_date ?? null,
      reminder_sent_at: r?.sent_at ?? null,
      reminder_error_message: r?.error_message ?? null,
      reminder_count: u.reminder_count,
      last_reminder_sent_at: u.last_reminder_sent_at,
    }
  })
}

// =============================================================================
// Stat card
// =============================================================================

function StatCard({ title, value, icon, isLoading, tone, isActive, onClick }: {
  title: string; value: number; icon: React.ReactNode; isLoading: boolean
  tone?: 'default' | 'warning' | 'danger' | 'info'
  isActive?: boolean; onClick?: () => void
}) {
  const accent = tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : tone === 'info' ? 'text-blue-500' : ''
  return (
    <Card
      className={cn('transition-colors', onClick && 'cursor-pointer hover:border-primary/50', isActive && 'border-primary bg-primary/5')}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {icon}
        </div>
        {isLoading ? <Skeleton className="h-7 w-12" /> : <div className={cn('text-2xl font-bold', accent)}>{value}</div>}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Page
// =============================================================================

export default function RemindersPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RemindersPageInner />
    </Suspense>
  )
}

function RemindersPageInner() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // --- Filter state (URL-synced) ---
  const [statusFilter, setStatusFilter] = useState<UnifiedStatusFilter>(() => {
    const v = searchParams.get('status') as UnifiedStatusFilter | null
    return v ?? 'all'
  })
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const v = searchParams.get('date_from'); return v ? new Date(`${v}T00:00:00`) : undefined
  })
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const v = searchParams.get('date_to'); return v ? new Date(`${v}T00:00:00`) : undefined
  })

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('q', search)
    if (dateFrom) params.set('date_from', dateFrom.toISOString().slice(0, 10))
    if (dateTo) params.set('date_to', dateTo.toISOString().slice(0, 10))
    const qs = params.toString()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      router.replace(qs ? `/dashboard/reminders?${qs}` : '/dashboard/reminders', { scroll: false })
    }, 300)
  }, [statusFilter, search, dateFrom, dateTo, router])

  // --- Queries: fetch both AC units + reminders ---
  const { data: acData, isLoading: acLoading } = useQuery({
    queryKey: ['serviced-ac-units'],
    queryFn: async () => {
      const result = await getServicedAcUnits({})
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat data AC')
      return ((result as { data?: ServicedAcUnitRow[] }).data ?? []) as ServicedAcUnitRow[]
    },
  })

  const { data: reminderData, isLoading: reminderLoading } = useQuery({
    queryKey: ['customer-reminders'],
    queryFn: async () => {
      const result = await getCustomerReminders({ limit: 500 })
      if (!result?.success) throw new Error(result?.error || 'Gagal memuat reminder')
      return ((result as { data?: { reminders?: ReminderRow[] } }).data?.reminders ?? []) as ReminderRow[]
    },
  })

  const isLoading = acLoading || reminderLoading

  // --- Merge data ---
  const unified = useMemo(
    () => mergeData(acData ?? [], reminderData ?? []),
    [acData, reminderData]
  )

  // --- Stats ---
  const stats = useMemo(() => {
    let overdue = 0, dueSoon = 0, pending = 0, failed = 0
    for (const r of unified) {
      const days = daysFromToday(r.next_service_due_date)
      if (days !== null) {
        if (days < 0) overdue++
        else if (days <= 7) dueSoon++
      }
      if (r.reminder_status === 'PENDING') pending++
      if (r.reminder_status === 'FAILED') failed++
    }
    return { overdue, dueSoon, pending, failed }
  }, [unified])

  // --- Filtering ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return unified.filter((row) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
          const d = daysFromToday(row.next_service_due_date)
          if (d === null || d >= 0) return false
        } else if (statusFilter === 'due_soon') {
          const d = daysFromToday(row.next_service_due_date)
          if (d === null || d < 0 || d > 7) return false
        } else if (statusFilter === 'upcoming') {
          const d = daysFromToday(row.next_service_due_date)
          if (d === null || d <= 7) return false
        } else if (statusFilter === 'no_date') {
          if (row.next_service_due_date) return false
        } else {
          // Reminder status filters
          if (row.reminder_status !== statusFilter) return false
        }
      }
      // Date range
      if (dateFrom && row.next_service_due_date && new Date(row.next_service_due_date) < startOfDay(dateFrom)) return false
      if (dateTo && row.next_service_due_date && new Date(row.next_service_due_date) > endOfDay(dateTo)) return false
      // Search
      if (q) {
        const fields = [row.customer_name, row.customer_phone, row.brand, row.model_number]
          .map((v) => v?.toLowerCase() ?? '')
        if (!fields.some((f) => f.includes(q))) return false
      }
      return true
    })
  }, [unified, statusFilter, search, dateFrom, dateTo])

  const hasFilters = statusFilter !== 'all' || !!search || !!dateFrom || !!dateTo
  function clearFilters() { setStatusFilter('all'); setSearch(''); setDateFrom(undefined); setDateTo(undefined) }

  // --- Generate mutation ---
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/reminders/run', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json()) as { success: boolean; data?: { generated_count: number; skipped_count: number }; error?: string }
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal generate reminder')
      return json.data ?? { generated_count: 0, skipped_count: 0 }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({
        title: 'Antrian reminder dibuat',
        description: `${data.generated_count} reminder baru masuk antrian, ${data.skipped_count} dilewati. Pilih reminder di tabel lalu klik "Kirim" untuk mengirim ke customer.`,
      })
    },
    onError: (error: Error) => {
      logger.error('generateReminders failed:', error)
      toast({ title: 'Gagal generate reminder', description: error.message, variant: 'destructive' })
    },
  })

  // --- Send single reminder ---
  const sendMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderSent(reminderId)
      if (!result?.success) throw new Error(result?.error || 'Gagal mengirim reminder')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({ title: 'Pesan terkirim', description: 'Reminder berhasil dikirim ke customer.' })
    },
    onError: (error: Error) => {
      logger.error('sendReminder failed:', error)
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // --- Dismiss reminder ---
  const dismissMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const result = await markReminderDismissed(reminderId)
      if (!result?.success) throw new Error(result?.error || 'Gagal mengabaikan reminder')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      toast({ title: 'Reminder diabaikan' })
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // --- Create manual reminder ---
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const handleCreateReminder = useCallback(async (acUnitId: string) => {
    setCreatingId(acUnitId)
    try {
      const result = await createManualReminder(acUnitId)
      if (!result?.success) throw new Error(result?.error || 'Gagal membuat reminder')
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({ title: 'Reminder dibuat', description: 'Reminder masuk ke antrian dengan status Menunggu.' })
    } catch (error) {
      logger.error('createManualReminder failed:', error)
      toast({ title: 'Gagal membuat reminder', description: String(error), variant: 'destructive' })
    } finally { setCreatingId(null) }
  }, [queryClient, toast])

  // --- Update next service date ---
  const [updatingDateId, setUpdatingDateId] = useState<string | null>(null)
  const handleUpdateDate = useCallback(async (acUnitId: string, newDate: string | null) => {
    setUpdatingDateId(acUnitId)
    try {
      const result = await updateAcUnitNextServiceDate(acUnitId, newDate)
      if (!result?.success) throw new Error(result?.error || 'Gagal update tanggal')
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({ title: 'Tanggal diperbarui' })
    } catch (error) {
      toast({ title: 'Gagal update tanggal', description: String(error), variant: 'destructive' })
    } finally { setUpdatingDateId(null) }
  }, [queryClient, toast])

  // --- Bulk send ---
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  useEffect(() => { setRowSelection({}) }, [statusFilter, search, dateFrom, dateTo])

  const bulkSendMutation = useMutation({
    mutationFn: async (reminderIds: string[]) => {
      const result = await markRemindersSent(reminderIds)
      if (!result?.success) throw new Error(result?.error || 'Gagal mengirim reminder')
      return (result as { data: { updated: string[]; skipped: string[]; failed: string[] } }).data
    },
    onSuccess: ({ updated, failed, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      setRowSelection({})
      toast({
        title: `${updated.length} terkirim`,
        description: failed.length > 0
          ? `${failed.length} gagal terkirim.`
          : skipped.length > 0 ? `${skipped.length} sudah pernah dikirim.` : 'Semua pesan terkirim ke customer.',
        variant: failed.length > 0 ? 'destructive' : 'default',
      })
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const selectedReminderIds = useMemo(
    () => Object.entries(rowSelection).filter(([, v]) => v).map(([k]) => k).filter((id) =>
      unified.some((u) => u.reminder_id === id && u.reminder_status === 'PENDING')),
    [rowSelection, unified]
  )

  // --- Detail drawer ---
  const [selectedRow, setSelectedRow] = useState<UnifiedReminderRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // --- Stat card click handler ---
  const handleStatClick = useCallback((filter: UnifiedStatusFilter) => {
    setStatusFilter((prev) => prev === filter ? 'all' : filter)
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Pengingat Service</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Kelola pengingat service rutin untuk pelanggan berdasarkan jadwal AC.
        </p>
      </div>

      {/* Step chips — visual guide */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> 1. Monitor AC
        </div>
        <span className="text-muted-foreground text-sm">→</span>
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> 2. Buat Antrian
        </div>
        <span className="text-muted-foreground text-sm">→</span>
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <Send className="h-3.5 w-3.5" /> 3. Kirim ke Customer
        </div>
      </div>

      {/* Stat cards — clickable */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard title="Overdue" value={stats.overdue} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} isLoading={isLoading} tone="danger"
          isActive={statusFilter === 'overdue'} onClick={() => handleStatClick('overdue')} />
        <StatCard title="Due 7 Hari" value={stats.dueSoon} icon={<CalendarClock className="h-4 w-4 text-warning" />} isLoading={isLoading} tone="warning"
          isActive={statusFilter === 'due_soon'} onClick={() => handleStatClick('due_soon')} />
        <StatCard title="Menunggu" value={stats.pending} icon={<BellRing className="h-4 w-4 text-blue-500" />} isLoading={isLoading} tone="info"
          isActive={statusFilter === 'PENDING'} onClick={() => handleStatClick('PENDING')} />
        <StatCard title="Gagal" value={stats.failed} icon={<XCircle className="h-4 w-4 text-destructive" />} isLoading={isLoading} tone="danger"
          isActive={statusFilter === 'FAILED'} onClick={() => handleStatClick('FAILED')} />
      </div>

      {/* Generate section — Option 1: description before button */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <p className="text-sm text-foreground mb-1.5 font-medium">
          Scan &amp; Buat Antrian Reminder
        </p>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Pindai semua AC yang jatuh tempo dan buat entry reminder dengan status &ldquo;Menunggu&rdquo; di antrian.
          <br />
          <strong className="font-medium text-foreground">Tidak mengirim apa pun ke customer otomatis.</strong> Setelah generate, pilih reminder di tabel lalu klik &ldquo;Kirim&rdquo; manual.
        </p>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          size="sm"
        >
          {generateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Scan &amp; Buat Antrian Reminder
        </Button>
      </div>

      {/* Filter bar */}
      <UnifiedFilters
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        search={search} onSearchChange={setSearch}
        dateFrom={dateFrom} onDateFromChange={setDateFrom}
        dateTo={dateTo} onDateToChange={setDateTo}
        hasFilters={hasFilters} onClearFilters={clearFilters}
      />

      {/* Bulk action bar */}
      {selectedReminderIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 py-3 sm:static sm:rounded-lg sm:border sm:bg-muted/40 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{selectedReminderIds.length} reminder dipilih</p>
            <Button size="sm" onClick={() => bulkSendMutation.mutate(selectedReminderIds)} disabled={bulkSendMutation.isPending} className="min-h-[44px] sm:min-h-9">
              {bulkSendMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
              Kirim Terpilih ({selectedReminderIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Unified table */}
      <UnifiedTable
        data={filtered}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        onGenerate={() => generateMutation.mutate()}
        isGenerating={generateMutation.isPending}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        sendMutation={sendMutation}
        dismissMutation={dismissMutation}
        onSend={sendMutation.mutate}
        onDismiss={dismissMutation.mutate}
        onCreateReminder={handleCreateReminder}
        creatingId={creatingId}
        onRowClick={(row) => { setSelectedRow(row); setDrawerOpen(true) }}
      />

      {selectedReminderIds.length > 0 && <div className="h-16 sm:hidden" />}

      {/* Detail drawer */}
      <UnifiedDetailDrawer
        row={selectedRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdateDate={handleUpdateDate}
        isUpdatingDate={!!updatingDateId}
      />
    </div>
  )
}

// =============================================================================
// UnifiedFilters — inline (small enough, avoids extra file)
// =============================================================================

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function UnifiedFilters({
  statusFilter, onStatusChange, search, onSearchChange,
  dateFrom, onDateFromChange, dateTo, onDateToChange,
  hasFilters, onClearFilters,
}: {
  statusFilter: UnifiedStatusFilter
  onStatusChange: (v: UnifiedStatusFilter) => void
  search: string
  onSearchChange: (v: string) => void
  dateFrom: Date | undefined
  onDateFromChange: (d: Date | undefined) => void
  dateTo: Date | undefined
  onDateToChange: (d: Date | undefined) => void
  hasFilters: boolean
  onClearFilters: () => void
}) {
  const STATUS_OPTIONS: { value: UnifiedStatusFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'due_soon', label: 'Jatuh Tempo (7 hari)' },
    { value: 'upcoming', label: 'Mendatang' },
    { value: 'no_date', label: 'Tanpa Jadwal' },
    { value: 'PENDING', label: 'Reminder: Menunggu' },
    { value: 'SENT', label: 'Reminder: Terkirim' },
    { value: 'FAILED', label: 'Reminder: Gagal' },
    { value: 'DISMISSED', label: 'Reminder: Diabaikan' },
  ]

  const chips: { key: string; label: string; onClear: () => void }[] = []
  if (statusFilter !== 'all') {
    const lbl = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter
    chips.push({ key: 'status', label: `Status: ${lbl}`, onClear: () => onStatusChange('all') })
  }
  if (dateFrom) chips.push({ key: 'from', label: `Dari: ${format(dateFrom, 'd MMM', { locale: localeId })}`, onClear: () => onDateFromChange(undefined) })
  if (dateTo) chips.push({ key: 'to', label: `Sampai: ${format(dateTo, 'd MMM', { locale: localeId })}`, onClear: () => onDateToChange(undefined) })
  if (search.trim()) chips.push({ key: 'q', label: `Cari: "${search.trim()}"`, onClear: () => onSearchChange('') })

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Filter</CardTitle></CardHeader>
      <CardContent>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
            <span className="text-muted-foreground">Sedang melihat:</span>
            {chips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5">
                {c.label}
                <button type="button" onClick={c.onClear} className="text-muted-foreground hover:text-foreground" aria-label={`Hapus ${c.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari customer, nomor, brand, model..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as UnifiedStatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateFrom && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, 'd MMM', { locale: localeId }) : 'Dari'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateTo && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, 'd MMM', { locale: localeId }) : 'Sampai'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={onDateToChange} /></PopoverContent>
            </Popover>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="col-span-2 sm:col-span-1">
                <X className="mr-1 h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

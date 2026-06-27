'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ServicedAcStatusFilter } from '@/lib/actions/reminders'

interface MonitoringFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: ServicedAcStatusFilter
  onStatusChange: (v: ServicedAcStatusFilter) => void
  dateFrom: Date | undefined
  onDateFromChange: (d: Date | undefined) => void
  dateTo: Date | undefined
  onDateToChange: (d: Date | undefined) => void
  hasFilters: boolean
  onClearFilters: () => void
}

export function MonitoringFilters({
  search, onSearchChange, statusFilter, onStatusChange,
  dateFrom, onDateFromChange, dateTo, onDateToChange,
  hasFilters, onClearFilters,
}: MonitoringFiltersProps) {
  const STATUS_LABELS: Record<ServicedAcStatusFilter, string> = { all: 'Semua', overdue: 'Overdue', due_soon: 'Jatuh Tempo', upcoming: 'Mendatang', no_date: 'Tanpa Jadwal' }
  const chips: { key: string; label: string; onClear: () => void }[] = []
  if (statusFilter !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[statusFilter]}`, onClear: () => onStatusChange('all') })
  if (dateFrom) chips.push({ key: 'from', label: `Dari: ${format(dateFrom, 'd MMM', { locale: localeId })}`, onClear: () => onDateFromChange(undefined) })
  if (dateTo) chips.push({ key: 'to', label: `Sampai: ${format(dateTo, 'd MMM', { locale: localeId })}`, onClear: () => onDateToChange(undefined) })
  if (search.trim()) chips.push({ key: 'search', label: `Cari: "${search.trim()}"`, onClear: () => onSearchChange('') })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filter</CardTitle>
      </CardHeader>
      <CardContent>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
            <span className="text-muted-foreground">Sedang melihat:</span>
            {chips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5">
                {c.label}
                <button type="button" onClick={c.onClear} className="text-muted-foreground hover:text-foreground" aria-label={`Hapus ${c.label}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari customer, nomor, brand, model..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ServicedAcStatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="due_soon">Jatuh Tempo (7 hari)</SelectItem>
                <SelectItem value="upcoming">Mendatang</SelectItem>
                <SelectItem value="no_date">Belum ada jadwal</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateFrom && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'd MMM', { locale: localeId }) : 'Dari'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!dateTo && 'text-muted-foreground', 'w-full sm:min-w-[120px]')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'd MMM', { locale: localeId }) : 'Sampai'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} />
              </PopoverContent>
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

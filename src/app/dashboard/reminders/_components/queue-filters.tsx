import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Search, X, Clock, AlertCircle, XOctagon, Hourglass } from 'lucide-react'
import { useState } from 'react'

import type { ReminderStatus } from '@/types/reminders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface QueueFiltersProps {
  statusFilter: 'all' | ReminderStatus
  onStatusChange: (value: 'all' | ReminderStatus) => void
  search: string
  onSearchChange: (value: string) => void
  dateFrom: Date | undefined
  onDateFromChange: (date: Date | undefined) => void
  dateTo: Date | undefined
  onDateToChange: (date: Date | undefined) => void
  hasFilters: boolean
  onClearFilters: () => void
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'SENT', label: 'Terkirim' },
  { value: 'FAILED', label: 'Gagal' },
  { value: 'DISMISSED', label: 'Diabaikan' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
] as const

export function QueueFilters({
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  hasFilters,
  onClearFilters,
}: QueueFiltersProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null)

  function applyPreset(preset: string) {
    setActivePreset(preset === activePreset ? null : preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    if (preset === activePreset) {
      onClearFilters()
      return
    }

    if (preset === 'today') {
      onDateFromChange(today); onDateToChange(today); onStatusChange('all')
    } else if (preset === 'overdue') {
      onDateToChange(yesterday); onDateFromChange(undefined); onStatusChange('PENDING')
    } else if (preset === 'failed') {
      onStatusChange('FAILED'); onDateFromChange(undefined); onDateToChange(undefined)
    } else if (preset === 'pending') {
      onStatusChange('PENDING'); onDateFromChange(undefined); onDateToChange(undefined)
    }
  }

  const presets = [
    { id: 'today', label: 'Hari Ini', icon: Clock },
    { id: 'overdue', label: 'Overdue', icon: AlertCircle },
    { id: 'failed', label: 'Gagal', icon: XOctagon },
    { id: 'pending', label: 'Menunggu', icon: Hourglass },
  ] as const

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
        {presets.map((p) => {
          const Icon = p.icon
          return (
            <Button
              key={p.id}
              size="sm"
              variant={activePreset === p.id ? 'default' : 'outline'}
              onClick={() => applyPreset(p.id)}
              className="gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </Button>
          )
        })}
      </div>
      <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari customer, kontak, atau nomor..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as 'all' | ReminderStatus)}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                !dateFrom && 'text-muted-foreground',
                'w-full sm:min-w-[120px]'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom
                ? format(dateFrom, 'd MMM', { locale: localeId })
                : 'Dari'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={onDateFromChange}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                !dateTo && 'text-muted-foreground',
                'w-full sm:min-w-[120px]'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo
                ? format(dateTo, 'd MMM', { locale: localeId })
                : 'Sampai'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={onDateToChange}
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="col-span-2 sm:col-span-1"
          >
            <X className="mr-1 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}

'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface OrderHistoryFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  onSearchSubmit: () => void
  onSearchClear: () => void
  dateFrom: string
  onDateFromChange: (date: Date | undefined) => void
  dateTo: string
  onDateToChange: (date: Date | undefined) => void
}

export function OrderHistoryFilters({
  search, onSearchChange, onSearchSubmit, onSearchClear,
  dateFrom, onDateFromChange, dateTo, onDateToChange,
}: OrderHistoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nama pelanggan, ID order, alamat..." value={search} onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()} className="pl-9" />
        </div>
        <Button variant="outline" onClick={onSearchSubmit}>Cari</Button>
        {search && <Button variant="ghost" size="icon" onClick={onSearchClear}><X className="h-4 w-4" /></Button>}
      </div>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(new Date(dateFrom), 'dd/MM/yyyy', { locale: localeId }) : 'Dari'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateFrom ? new Date(dateFrom) : undefined} onSelect={onDateFromChange} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(new Date(dateTo), 'dd/MM/yyyy', { locale: localeId }) : 'Sampai'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateTo ? new Date(dateTo) : undefined} onSelect={onDateToChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarIcon, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTechnicians } from '@/lib/actions/technicians'
import { type Urgency } from '@/lib/order-utils'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
] as const

const URGENCY_OPTIONS: Array<{ value: Urgency; label: string }> = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'future', label: 'Akan Datang' },
  { value: 'terminal', label: 'Selesai' },
]

export function OrderFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const technicianId = searchParams.get('technicianId') ?? 'all'
  const serviceType = searchParams.get('serviceType') ?? 'all'
  const urgency = searchParams.get('urgency') ?? 'all'
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''

  const { data: techResp } = useQuery({
    queryKey: ['technicians', 'all'],
    queryFn: () => getTechnicians({ limit: 200 }),
  })
  const technicians = (techResp?.data ?? []) as Array<{
    technician_id: string
    technician_name: string
  }>

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all' || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    const view = params.get('view')
    const next = new URLSearchParams()
    if (view) next.set('view', view)
    setSearch('')
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParam('q', search.trim() || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const hasFilters =
    !!search ||
    technicianId !== 'all' ||
    serviceType !== 'all' ||
    urgency !== 'all' ||
    !!dateFrom ||
    !!dateTo

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center bg-background border border-hairline rounded-lg p-3 sm:p-2">
      <div className="relative w-full sm:min-w-[240px] sm:flex-1 sm:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
        <Input
          placeholder="Cari order ID, customer, alamat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-9 sm:h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:contents">
        <Select value={technicianId} onValueChange={(v) => setParam('technicianId', v)}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[180px]">
            <SelectValue placeholder="Teknisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Teknisi</SelectItem>
            {technicians.map((t) => (
              <SelectItem key={t.technician_id} value={t.technician_id}>
                {t.technician_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={serviceType} onValueChange={(v) => setParam('serviceType', v)}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[160px]">
            <SelectValue placeholder="Service Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Service</SelectItem>
            {SERVICE_TYPES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={urgency} onValueChange={(v) => setParam('urgency', v)}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[140px]">
            <SelectValue placeholder="Urgensi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {URGENCY_OPTIONS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                !dateFrom && 'text-ink-mute',
                'h-11 w-full justify-start sm:h-9 sm:w-auto sm:min-w-[120px] sm:justify-center'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(new Date(dateFrom), 'd MMM') : 'Dari'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateFrom ? new Date(dateFrom) : undefined}
              onSelect={(d) => setParam('dateFrom', d ? format(d, 'yyyy-MM-dd') : null)}
              locale={localeId as unknown as Record<string, unknown>}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                !dateTo && 'text-ink-mute',
                'h-11 w-full justify-start sm:h-9 sm:w-auto sm:min-w-[120px] sm:justify-center'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(new Date(dateTo), 'd MMM') : 'Sampai'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateTo ? new Date(dateTo) : undefined}
              onSelect={(d) => setParam('dateTo', d ? format(d, 'yyyy-MM-dd') : null)}
              locale={localeId as unknown as Record<string, unknown>}
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAll}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          <X className="mr-1 h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  )
}

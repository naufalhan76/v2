import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CalendarIcon, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { ALL_ONGOING_STATUSES } from '../monitoring-ongoing-utils'

const SERVICE_TYPES = [
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'INSPECTION', label: 'Inspection' },
]

const PAYMENT_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

interface DateRangeState {
  from: Date | undefined
  to?: Date | undefined
}

interface MonitoringFiltersProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  statusGroupFilter: string
  orderTypeFilter: string
  setOrderTypeFilter: (v: string) => void
  paymentStatusFilter: string
  setPaymentStatusFilter: (v: string) => void
  multiLocationFilter: string
  setMultiLocationFilter: (v: string) => void
  dateRange: DateRangeState
  setDateRange: (range: DateRangeState) => void
  tempDateRange: DateRangeState
  setTempDateRange: (range: DateRangeState) => void
  filteredOrdersLength: number
  ongoingOrdersLength: number
}

export function MonitoringFilters({
  searchQuery, setSearchQuery,
  statusFilter, setStatusFilter,
  statusGroupFilter,
  orderTypeFilter, setOrderTypeFilter,
  paymentStatusFilter, setPaymentStatusFilter,
  multiLocationFilter, setMultiLocationFilter,
  dateRange, setDateRange,
  tempDateRange, setTempDateRange,
  filteredOrdersLength,
  ongoingOrdersLength,
}: MonitoringFiltersProps) {
  const dateFrom = dateRange.from || new Date()
  const dateTo = dateRange.to || new Date()

  const handleDateRangeSelect = (range: { from: Date | undefined; to?: Date | undefined } | undefined) => {
    if (range) {
      setTempDateRange(range)
      if (range.from && range.to) {
        setDateRange(range)
      }
    }
  }

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return "Pilih Tanggal"
    return `${format(dateRange.from, 'dd/MM/yyyy', { locale: id })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: id })}`
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'ALL' || statusGroupFilter !== 'ALL' ||
    orderTypeFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || multiLocationFilter !== 'ALL'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>Search and filter orders</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Order ID or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <SearchableSelect
            options={[
              { id: 'ALL', label: 'All Status' },
              ...ALL_ONGOING_STATUSES.map(status => ({ id: status, label: status })),
            ]}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="All Status"
            searchPlaceholder="Cari status..."
          />

          {/* Order Type Filter */}
          <SearchableSelect
            options={[
              { id: 'ALL', label: 'All Order Types' },
              ...SERVICE_TYPES.map(type => ({ id: type.value, label: type.label })),
            ]}
            value={orderTypeFilter}
            onValueChange={setOrderTypeFilter}
            placeholder="All Order Types"
            searchPlaceholder="Cari tipe..."
          />

          {/* Multi-Location Filter */}
          <Select value={multiLocationFilter} onValueChange={setMultiLocationFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Locations</SelectItem>
              <SelectItem value="SINGLE">Single Location</SelectItem>
              <SelectItem value="MULTI">Multi-Location</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Status Filter */}
          <SearchableSelect
            options={[
              { id: 'ALL', label: 'All Payment Status' },
              ...PAYMENT_STATUSES.map(status => ({ id: status.value, label: status.label })),
            ]}
            value={paymentStatusFilter}
            onValueChange={setPaymentStatusFilter}
            placeholder="All Payment Status"
            searchPlaceholder="Cari status pembayaran..."
          />
        </div>

        {/* Date Range Picker */}
        <div className="mt-4 flex items-center gap-3">
          <div className="text-sm font-medium">Filter Tanggal Order:</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal text-sm px-3 py-2.5 h-auto shadow-sm",
                  (!dateRange.from || !dateRange.to) && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-4 w-4" />
                <span className="flex-1">{formatDateRange()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={tempDateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={id as never}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredOrdersLength} of {ongoingOrdersLength} orders (tanggal order {format(dateFrom, 'dd MMM yyyy')} - {format(dateTo, 'dd MMM yyyy')})</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('ALL')
                setOrderTypeFilter('ALL')
                setPaymentStatusFilter('ALL')
                setMultiLocationFilter('ALL')
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

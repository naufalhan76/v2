import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface InvoiceFiltersProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch: () => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  paymentFilter: string
  onPaymentFilterChange: (value: string) => void
  sourceFilter: 'all' | 'ORDER_LINKED' | 'BLANK'
  onSourceFilterChange: (value: string) => void
}

export function InvoiceFilters({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  sourceFilter,
  onSourceFilterChange,
}: InvoiceFiltersProps) {
  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari invoice number atau customer..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="pl-10 min-h-[44px]"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-row lg:gap-4">
          <SearchableSelect
            options={[
              { id: 'ALL', label: 'Semua Status' },
              { id: 'DRAFT', label: 'Draft' },
              { id: 'SENT', label: 'Terkirim' },
              { id: 'PARTIAL_PAID', label: 'Partial Paid' },
              { id: 'PAID', label: 'Dibayar' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'CANCELLED', label: 'Dibatalkan' },
            ]}
            value={statusFilter}
            onValueChange={onStatusFilterChange}
            placeholder="Status"
            searchPlaceholder="Cari status..."
            className="w-full lg:w-[180px]"
          />
          <SearchableSelect
            options={[
              { id: 'ALL', label: 'Semua Pembayaran' },
              { id: 'UNPAID', label: 'Belum Dibayar' },
              { id: 'PARTIAL', label: 'Dibayar Sebagian' },
              { id: 'PAID', label: 'Lunas' },
            ]}
            value={paymentFilter}
            onValueChange={onPaymentFilterChange}
            placeholder="Pembayaran"
            searchPlaceholder="Cari pembayaran..."
            className="w-full lg:w-[180px]"
          />
          <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
            <SelectTrigger className="w-full lg:w-[180px] min-h-[44px]">
              <SelectValue placeholder="Sumber" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="ORDER_LINKED">Transaksi</SelectItem>
              <SelectItem value="BLANK">Kosong</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onSearch} className="w-full lg:w-auto min-h-[44px]">Cari</Button>
      </div>
    </div>
  )
}

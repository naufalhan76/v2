'use client'

import { useRouter } from 'next/navigation'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, MapPin, Building2, Users, ChevronRight } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { SortConfig } from '@/hooks/use-sortable-table'

/* ---- Location Popover (internal) ---- */
function LocationPopover({ locations }: { locations: Record<string, unknown>[] }) {
  const totalAcUnits = locations.reduce((sum, loc) =>
    sum + ((loc.ac_units as unknown[])?.length || 0), 0
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={(e) => e.stopPropagation()}>
          <MapPin className="w-4 h-4" />
          {locations.length} lokasi
          {totalAcUnits > 0 && <Badge variant="secondary" className="ml-1">{totalAcUnits} AC</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Lokasi Service ({locations.length})</h4>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {locations.map((loc, idx) => {
              const locAcUnits = loc.ac_units as unknown[] | undefined
              return (
                <div key={loc.location_id as string} className="p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{(loc.full_address as string) || (loc.house_number as string) || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {(loc.city as string) && `${loc.city as string}`}
                        {(loc.landmarks as string) && ` • ${loc.landmarks as string}`}
                      </div>
                      {(loc.description as string) && <div className="text-xs text-muted-foreground mt-1">{loc.description as string}</div>}
                      {locAcUnits && locAcUnits.length > 0 && (
                        <Badge variant="outline" className="mt-1 text-xs">{locAcUnits.length} AC unit{locAcUnits.length > 1 ? 's' : ''}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---- Table Header Row (internal) ---- */
function TableHeaderRow({ sortConfig, requestSort }: { sortConfig: SortConfig; requestSort: (key: string) => void }) {
  return (
    <TableRow>
      <SortableTableHead sortKey="customer_name" currentSort={sortConfig} onSort={requestSort}>Nama Customer</SortableTableHead>
      <SortableTableHead sortKey="primary_contact_person" currentSort={sortConfig} onSort={requestSort} className="hidden md:table-cell">Kontak Person</SortableTableHead>
      <SortableTableHead sortKey="phone_number" currentSort={sortConfig} onSort={requestSort}>Nomor Telepon</SortableTableHead>
      <SortableTableHead sortKey="email" currentSort={sortConfig} onSort={requestSort} className="hidden lg:table-cell">Email</SortableTableHead>
      <SortableTableHead sortKey="billing_address" currentSort={sortConfig} onSort={requestSort} className="hidden xl:table-cell">Alamat Billing</SortableTableHead>
      <TableHead className="hidden lg:table-cell">Lokasi Service</TableHead>
      <TableHead className="hidden xl:table-cell">Catatan</TableHead>
      <TableHead className="text-right">Aksi</TableHead>
    </TableRow>
  )
}

/* ---- Pagination (internal) ---- */
function TablePagination({ totalPages, currentPage, onPageChange }: { totalPages: number; currentPage: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex justify-center gap-2 mt-4">
      <Button variant="outline" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Previous</Button>
      <span className="flex items-center px-4">Page {currentPage} of {totalPages}</span>
      <Button variant="outline" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</Button>
    </div>
  )
}

/* ---- Action buttons (internal) ---- */
function ActionButtons({ customer, onEdit, onDelete, isDeleting, isUpdating, deletingId, editingId }: {
  customer: Record<string, unknown>
  onEdit: (c: Record<string, unknown>) => void
  onDelete: (id: string) => void
  isDeleting: boolean; isUpdating: boolean; deletingId: string | null; editingId: string | null
}) {
  return (
    <TableCell className="text-right w-[100px] sm:w-[180px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end gap-1 sm:gap-2">
        <LoadingOverlay isLoading={isUpdating && editingId === customer.customer_id}>
          <Button variant="outline" size="icon" aria-label="Edit"
            className="h-10 w-10 sm:h-9 sm:w-auto sm:px-2 sm:group sm:relative sm:overflow-hidden sm:transition-all sm:duration-300 sm:ease-in-out sm:hover:w-24 sm:flex sm:items-center sm:justify-start"
            onClick={() => onEdit(customer)} disabled={isDeleting}>
            <Pencil className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline ml-2 whitespace-nowrap opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">Ubah</span>
          </Button>
        </LoadingOverlay>
        <LoadingOverlay isLoading={isDeleting && deletingId === customer.customer_id}>
          <Button variant="destructive" size="icon" aria-label="Hapus"
            className="h-10 w-10 sm:h-9 sm:w-auto sm:px-2 sm:group sm:relative sm:overflow-hidden sm:transition-all sm:duration-300 sm:ease-in-out sm:hover:w-28 sm:flex sm:items-center sm:justify-start"
            onClick={() => onDelete(customer.customer_id as string)} disabled={isUpdating}>
            <Trash2 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline ml-2 whitespace-nowrap opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">Hapus</span>
          </Button>
        </LoadingOverlay>
      </div>
    </TableCell>
  )
}

/* ---- Public ---- */
interface CustomerTableProps {
  customers: Record<string, unknown>[]
  isLoading: boolean
  sortConfig: SortConfig
  requestSort: (key: string) => void
  deletingId: string | null
  isDeleting: boolean
  isUpdating: boolean
  editingId: string | null
  onEdit: (customer: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onAddClick: () => void
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
}

export function CustomerTable({
  customers, isLoading, sortConfig, requestSort,
  deletingId, isDeleting, isUpdating, editingId,
  onEdit, onDelete, onAddClick, totalPages, currentPage, onPageChange,
}: CustomerTableProps) {
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="data-table-container overflow-x-auto">
        <Table><TableHeader><TableHeaderRow sortConfig={sortConfig} requestSort={requestSort} /></TableHeader>
        <TableBody><TableSkeleton rows={5} columns={8} /></TableBody></Table>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="data-table-container overflow-x-auto">
        <Table><TableHeader><TableHeaderRow sortConfig={sortConfig} requestSort={requestSort} /></TableHeader>
        <TableBody>
          <TableRow><TableCell colSpan={8} className="p-0">
            <EmptyState icon={Users} title="Belum ada pelanggan" description="Tambahkan pelanggan pertama untuk mulai membuat order."
              action={{ label: 'Tambah Pelanggan', icon: Plus, onClick: onAddClick }} />
          </TableCell></TableRow>
        </TableBody></Table>
      </div>
    )
  }

  return (
    <div className="data-table-container overflow-x-auto">
      <Table>
        <TableHeader><TableHeaderRow sortConfig={sortConfig} requestSort={requestSort} /></TableHeader>
        <TableBody>
          {customers.map((c) => {
            const locations = (c.locations as Record<string, unknown>[]) || []
            const locationsCount = locations.length
            return (
              <TableRow key={c.customer_id as string}
                className={`cursor-pointer hover:bg-muted/50 ${deletingId === c.customer_id ? "opacity-50" : ""}`}
                onClick={() => router.push(`/dashboard/manajemen/customer/${c.customer_id as string}`)}>
                <TableCell className="font-medium"><span className="text-primary font-semibold underline hover:no-underline cursor-pointer inline-flex items-center gap-1">{c.customer_name as string}<ChevronRight className="w-3.5 h-3.5" /></span></TableCell>
                <TableCell className="hidden md:table-cell">{c.primary_contact_person as string}</TableCell>
                <TableCell data-testid="phone-cell">{formatPhone(c.phone_number as string | number | null | undefined)}</TableCell>
                <TableCell className="hidden lg:table-cell">{c.email as string}</TableCell>
                <TableCell className="hidden xl:table-cell">{c.billing_address as string}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {locationsCount === 0
                    ? <Badge variant="secondary" className="gap-1"><MapPin className="w-3 h-3" />0 lokasi</Badge>
                    : <LocationPopover locations={locations} />}
                </TableCell>
                <TableCell className="hidden xl:table-cell max-w-xs truncate">{(c.notes as string) || '-'}</TableCell>
                <ActionButtons customer={c} onEdit={onEdit} onDelete={onDelete}
                  isDeleting={isDeleting} isUpdating={isUpdating} deletingId={deletingId} editingId={editingId} />
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <TablePagination totalPages={totalPages} currentPage={currentPage} onPageChange={onPageChange} />
    </div>
  )
}

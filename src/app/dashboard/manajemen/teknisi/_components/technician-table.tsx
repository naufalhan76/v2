'use client'

import { Edit, Trash2, Wrench, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { SortConfig } from '@/hooks/use-sortable-table'

export interface Technician {
  technician_id: string
  technician_name: string
  contact_number: string
  email?: string
  company?: string
}

interface TechnicianTableProps {
  technicians: Technician[]
  loading: boolean
  sortConfig: SortConfig
  onRequestSort: (key: string) => void
  onEdit: (technician: Technician) => void
  onDelete: (technicianId: string) => void
  onAddClick: () => void
}

export function TechnicianTable({
  technicians,
  loading,
  sortConfig,
  onRequestSort,
  onEdit,
  onDelete,
  onAddClick,
}: TechnicianTableProps) {
  if (loading) {
    return <TableSkeleton rows={5} columns={5} />
  }

  if (technicians.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="Belum ada teknisi"
        description="Tambahkan teknisi untuk mulai menugaskan order."
        action={{
          label: 'Tambah Teknisi',
          icon: Plus,
          onClick: onAddClick,
        }}
      />
    )
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {technicians.map((technician) => (
          <div
            key={technician.technician_id}
            className="rounded-lg border p-3 space-y-2"
          >
            <div className="space-y-1">
              <h3 className="font-semibold">{technician.technician_name}</h3>
              <p className="text-sm text-muted-foreground" data-testid="phone-cell">
                {formatPhone(technician.contact_number)}
              </p>
              {technician.email && (
                <p className="text-sm text-muted-foreground break-all">
                  {technician.email}
                </p>
              )}
              {technician.company && (
                <p className="text-xs text-muted-foreground">
                  {technician.company}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => onEdit(technician)}
              >
                <Edit className="h-4 w-4 mr-1.5" />
                Ubah
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-10"
                onClick={() => onDelete(technician.technician_id)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block data-table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="technician_name" currentSort={sortConfig} onSort={onRequestSort}>
                Name
              </SortableTableHead>
              <SortableTableHead sortKey="contact_number" currentSort={sortConfig} onSort={onRequestSort}>
                Contact Number
              </SortableTableHead>
              <SortableTableHead sortKey="email" currentSort={sortConfig} onSort={onRequestSort} className="hidden lg:table-cell">
                Email
              </SortableTableHead>
              <SortableTableHead sortKey="company" currentSort={sortConfig} onSort={onRequestSort} className="hidden lg:table-cell">
                Company
              </SortableTableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.map((technician) => (
              <TableRow key={technician.technician_id}>
                <TableCell className="font-medium">{technician.technician_name}</TableCell>
                <TableCell data-testid="phone-cell">{formatPhone(technician.contact_number)}</TableCell>
                <TableCell className="hidden lg:table-cell">{technician.email || '-'}</TableCell>
                <TableCell className="hidden lg:table-cell">{technician.company || '-'}</TableCell>
                <TableCell className="text-right w-[180px]">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      aria-label="Edit"
                      className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                      onClick={() => onEdit(technician)}
                    >
                      <Edit className="h-4 w-4 flex-shrink-0" />
                      <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Ubah
                      </span>
                    </Button>
                    <Button
                      variant="destructive"
                      aria-label="Hapus"
                      className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                      onClick={() => onDelete(technician.technician_id)}
                    >
                      <Trash2 className="h-4 w-4 flex-shrink-0" />
                      <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Hapus
                      </span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

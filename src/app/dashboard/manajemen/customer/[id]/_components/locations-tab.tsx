'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pencil, Trash2, MapPin, Plus } from 'lucide-react'
import { logger } from '@/lib/logger'
import { getLocations, updateLocation, deleteLocation } from '@/lib/actions/locations'
import { createLocation } from '@/lib/actions/orders'
import { LocationFormSheet } from './location-form-sheet'
import { AddressPickerReadOnly } from '@/components/address/address-picker-readonly'
import type { Location } from '@/types/customers'

interface LocationsTabProps {
  customerId: string
}

interface LocationFormValues {
  full_address: string
  house_number: string
  city: string
  landmarks: string
  lat: number | null
  lng: number | null
}

const initialForm = (): LocationFormValues => ({
  full_address: '',
  house_number: '1',
  city: '',
  landmarks: '',
  lat: null,
  lng: null,
})

export function LocationsTab({ customerId }: LocationsTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const queryKey = ['customer-locations', customerId] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getLocations({ customerId, limit: 200 }),
  })

  const locations = (data?.success ? (data.data as Location[]) : []) ?? []

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<LocationFormValues>(initialForm())

  const openCreate = () => {
    setEditingLocation(null)
    setForm(initialForm())
    setIsFormOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditingLocation(loc)
    setForm({
      full_address: loc.full_address ?? '',
      house_number: loc.house_number ?? '1',
      city: loc.city ?? '',
      landmarks: loc.landmarks ?? '',
      lat: loc.lat ?? null,
      lng: loc.lng ?? null,
    })
    setIsFormOpen(true)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = editingLocation
        ? await updateLocation(editingLocation.location_id, form)
        : await createLocation({ customer_id: customerId, ...form })

      if (result.success) {
        toast({
          title: 'Berhasil',
          description: editingLocation
            ? 'Lokasi berhasil diperbarui'
            : 'Lokasi berhasil ditambahkan',
        })
        setIsFormOpen(false)
        invalidate()
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal menyimpan lokasi',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error saving location:', error)
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat menyimpan lokasi',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <CardTitle>Lokasi ({locations.length})</CardTitle>
        <LocationFormSheet
          customerId={customerId}
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          editingLocation={editingLocation}
          form={form}
          onFormChange={setForm}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onOpenCreate={openCreate}
          deleteId={deleteId}
          onDeleteIdChange={setDeleteId}
          invalidate={invalidate}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum ada lokasi"
            description="Tambahkan lokasi untuk mulai mencatat AC unit pada customer ini."
            action={{
              label: 'Tambah Lokasi',
              icon: Plus,
              onClick: openCreate,
            }}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {locations.map((loc) => (
                <div key={loc.location_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm break-words">{loc.full_address}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No. {loc.house_number} · {loc.city}
                      </p>
                      <AddressPickerReadOnly lat={loc.lat ?? null} lng={loc.lng ?? null} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(loc)}
                      className="h-10"
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Ubah
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(loc.location_id)}
                      className="h-10"
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
                    <TableHead>Alamat</TableHead>
                    <TableHead>No. Rumah</TableHead>
                    <TableHead>Kota</TableHead>
                    <TableHead>Patokan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.location_id}>
                      <TableCell className="font-medium align-top">
                        <div className="flex flex-col">
                          <span>{loc.full_address}</span>
                          <AddressPickerReadOnly lat={loc.lat ?? null} lng={loc.lng ?? null} />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{loc.house_number}</TableCell>
                      <TableCell className="align-top">{loc.city}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {loc.landmarks || '-'}
                      </TableCell>
                      <TableCell className="text-right w-[140px]">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(loc)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setDeleteId(loc.location_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

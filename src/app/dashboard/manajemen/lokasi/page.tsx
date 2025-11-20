'use client'

import { useState, useEffect } from 'react'
import { getLocations, updateLocation, deleteLocation } from '@/lib/actions/locations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { Edit, Trash2, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Location {
  location_id: string
  customer_id: string
  full_address: string
  house_number: number
  city: string
  landmarks?: string
  customers?: {
    customer_id: string
    customer_name: string
    phone_number: string
    primary_contact_person?: string
    email?: string
  }
}

export default function LocationsPage() {
  const { toast } = useToast()
  const [locationsBase, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Apply sorting
  const { sortedData: locations, sortConfig, requestSort } = useSortableTable(locationsBase, {
    key: 'customers.customer_name',
    direction: 'asc'
  })

  const [formData, setFormData] = useState({
    full_address: '',
    house_number: 1,
    city: '',
    landmarks: '',
  })

  useEffect(() => {
    fetchLocations()
  }, [searchQuery])

  const fetchLocations = async () => {
    setLoading(true)
    try {
      const result = await getLocations({
        search: searchQuery,
        limit: 100,
      })
      if (result.success) {
        setLocations(result.data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch locations',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (location: Location) => {
    setSelectedLocation(location)
    setFormData({
      full_address: location.full_address,
      house_number: location.house_number,
      city: location.city,
      landmarks: location.landmarks || '',
    })
    setIsEditOpen(true)
  }

  const handleDelete = (locationId: string) => {
    setDeleteId(locationId)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteId) return

    setIsSubmitting(true)
    try {
      const result = await deleteLocation(deleteId)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Location deleted successfully',
        })
        setIsDeleteOpen(false)
        setDeleteId(null)
        fetchLocations()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete location',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting location:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete location',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation) return

    setIsSubmitting(true)
    try {
      const result = await updateLocation(selectedLocation.location_id, formData)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Location updated successfully',
        })
        setIsEditOpen(false)
        setSelectedLocation(null)
        fetchLocations()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update location',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating location:', error)
      toast({
        title: 'Error',
        description: 'Failed to update location',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Locations</h1>
        <p className="text-muted-foreground">Manage customer locations (Read, Update, Delete only)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by building name, room number, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="customers.customer_name" currentSort={sortConfig} onSort={requestSort}>
                      Customer
                    </SortableTableHead>
                    <SortableTableHead sortKey="full_address" currentSort={sortConfig} onSort={requestSort}>
                      Full Address
                    </SortableTableHead>
                    <SortableTableHead sortKey="house_number" currentSort={sortConfig} onSort={requestSort}>
                      House Number
                    </SortableTableHead>
                    <SortableTableHead sortKey="city" currentSort={sortConfig} onSort={requestSort}>
                      City
                    </SortableTableHead>
                    <TableHead>Landmarks</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No locations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((location) => (
                      <TableRow key={location.location_id}>
                        <TableCell className="font-medium">
                          {location.customers ? (
                            <div className="text-sm">
                              <div className="font-medium">{location.customers.customer_name}</div>
                              {location.customers.primary_contact_person && (
                                <div className="text-muted-foreground">PIC: {location.customers.primary_contact_person}</div>
                              )}
                              {location.customers.email && (
                                <div className="text-muted-foreground text-xs">{location.customers.email}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-sm">No customer assigned</div>
                          )}
                        </TableCell>
                        <TableCell>{location.full_address}</TableCell>
                        <TableCell>{location.house_number}</TableCell>
                        <TableCell>{location.city}</TableCell>
                        <TableCell className="text-sm">{location.landmarks || '-'}</TableCell>
                        <TableCell>
                          {location.customers?.phone_number ? (
                            <div className="text-sm font-mono">{location.customers.phone_number}</div>
                          ) : (
                            <div className="text-muted-foreground text-sm">-</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right w-[180px]">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                              onClick={() => handleEdit(location)}
                            >
                              <Edit className="h-4 w-4 flex-shrink-0" />
                              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Ubah
                              </span>
                            </Button>
                            <Button
                              variant="destructive"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                              onClick={() => handleDelete(location.location_id)}
                            >
                              <Trash2 className="h-4 w-4 flex-shrink-0" />
                              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Hapus
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Location</SheetTitle>
            <SheetDescription>
              Update location information
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="full_address">Full Address *</Label>
              <Input
                id="full_address"
                value={formData.full_address}
                onChange={(e) => setFormData({ ...formData, full_address: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="house_number">House Number *</Label>
              <Input
                id="house_number"
                type="number"
                value={formData.house_number}
                onChange={(e) => setFormData({ ...formData, house_number: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmarks">Landmarks / Notes</Label>
              <Input
                id="landmarks"
                value={formData.landmarks || ''}
                onChange={(e) => setFormData({ ...formData, landmarks: e.target.value })}
                placeholder="e.g., Near the mall, opposite the park"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Updating...' : 'Update Location'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

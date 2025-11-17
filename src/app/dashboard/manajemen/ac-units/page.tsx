'use client'

import { useState, useEffect } from 'react'
import { getAcUnits, updateAcUnit, deleteAcUnit } from '@/lib/actions/ac-units'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { Edit, Trash2, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AcUnit {
  ac_unit_id: string
  location_id: string
  brand: string
  model_number: string
  serial_number: string
  ac_type?: string
  capacity_btu?: number
  installation_date?: string
  status: string
  last_service_date?: string
  locations?: {
    location_id: string
    building_name: string
    floor: number
    room_number: string
    customers?: {
      customer_id: string
      customer_name: string
      phone_number: string
      primary_contact_person?: string
    }
  }
}

export default function AcUnitsPage() {
  const { toast } = useToast()
  const [acUnitsBase, setAcUnits] = useState<AcUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedAcUnit, setSelectedAcUnit] = useState<AcUnit | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Apply sorting
  const { sortedData: acUnits, sortConfig, requestSort } = useSortableTable(acUnitsBase, {
    key: 'brand',
    direction: 'asc'
  })

  const [formData, setFormData] = useState({
    brand: '',
    model_number: '',
    serial_number: '',
    ac_type: '',
    capacity_btu: 0,
    installation_date: '',
    status: 'ACTIVE',
  })

  useEffect(() => {
    fetchAcUnits()
  }, [searchQuery])

  const fetchAcUnits = async () => {
    setLoading(true)
    try {
      const result = await getAcUnits({
        search: searchQuery,
        limit: 100,
      })
      if (result.success) {
        setAcUnits(result.data)
      }
    } catch (error) {
      console.error('Error fetching AC units:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch AC units',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (acUnit: AcUnit) => {
    setSelectedAcUnit(acUnit)
    setFormData({
      brand: acUnit.brand || '',
      model_number: acUnit.model_number || '',
      serial_number: acUnit.serial_number || '',
      ac_type: acUnit.ac_type || '',
      capacity_btu: acUnit.capacity_btu || 0,
      installation_date: acUnit.installation_date || '',
      status: acUnit.status || 'ACTIVE',
    })
    setIsEditOpen(true)
  }

  const handleDelete = (acUnitId: string) => {
    setDeleteId(acUnitId)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteId) return

    setIsSubmitting(true)
    try {
      const result = await deleteAcUnit(deleteId)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'AC unit deleted successfully',
        })
        setIsDeleteOpen(false)
        setDeleteId(null)
        fetchAcUnits()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete AC unit',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting AC unit:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete AC unit',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAcUnit) return

    setIsSubmitting(true)
    try {
      const result = await updateAcUnit(selectedAcUnit.ac_unit_id, formData)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'AC unit updated successfully',
        })
        setIsEditOpen(false)
        setSelectedAcUnit(null)
        fetchAcUnits()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update AC unit',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating AC unit:', error)
      toast({
        title: 'Error',
        description: 'Failed to update AC unit',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
      ACTIVE: 'default',
      MAINTENANCE: 'secondary',
      INACTIVE: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AC Units</h1>
        <p className="text-muted-foreground">Manage AC units data (Read, Update, Delete only)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AC Units List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by brand, model, or serial number..."
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
                    <SortableTableHead sortKey="brand" currentSort={sortConfig} onSort={requestSort}>
                      Brand
                    </SortableTableHead>
                    <SortableTableHead sortKey="model_number" currentSort={sortConfig} onSort={requestSort}>
                      Model Number
                    </SortableTableHead>
                    <SortableTableHead sortKey="serial_number" currentSort={sortConfig} onSort={requestSort}>
                      Serial Number
                    </SortableTableHead>
                    <SortableTableHead sortKey="ac_type" currentSort={sortConfig} onSort={requestSort}>
                      AC Type
                    </SortableTableHead>
                    <SortableTableHead sortKey="capacity_btu" currentSort={sortConfig} onSort={requestSort}>
                      Capacity (BTU)
                    </SortableTableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Customer</TableHead>
                    <SortableTableHead sortKey="status" currentSort={sortConfig} onSort={requestSort}>
                      Status
                    </SortableTableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acUnits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No AC units found
                      </TableCell>
                    </TableRow>
                  ) : (
                    acUnits.map((acUnit) => (
                      <TableRow key={acUnit.ac_unit_id}>
                        <TableCell className="font-medium">{acUnit.brand}</TableCell>
                        <TableCell>{acUnit.model_number}</TableCell>
                        <TableCell>{acUnit.serial_number}</TableCell>
                        <TableCell>{acUnit.ac_type || '-'}</TableCell>
                        <TableCell>{acUnit.capacity_btu || '-'}</TableCell>
                        <TableCell>
                          {acUnit.locations ? (
                            <div className="text-sm">
                              <div>{acUnit.locations.building_name} - Floor {acUnit.locations.floor}</div>
                              <div className="text-muted-foreground">{acUnit.locations.room_number}</div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {acUnit.locations?.customers ? (
                            <div className="text-sm">
                              <div className="font-medium">{acUnit.locations.customers.customer_name}</div>
                              <div className="text-muted-foreground">{acUnit.locations.customers.phone_number}</div>
                              {acUnit.locations.customers.primary_contact_person && (
                                <div className="text-xs text-muted-foreground">PIC: {acUnit.locations.customers.primary_contact_person}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-sm">No customer assigned</div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(acUnit.status)}</TableCell>
                        <TableCell className="text-right w-[180px]">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-24 flex items-center justify-start px-2"
                              onClick={() => handleEdit(acUnit)}
                            >
                              <Edit className="h-4 w-4 flex-shrink-0" />
                              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Ubah
                              </span>
                            </Button>
                            <Button
                              variant="destructive"
                              className="group relative overflow-hidden transition-all duration-300 ease-in-out w-10 hover:w-28 flex items-center justify-start px-2"
                              onClick={() => handleDelete(acUnit.ac_unit_id)}
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
            <SheetTitle>Edit AC Unit</SheetTitle>
            <SheetDescription>
              Update AC unit information
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model_number">Model Number *</Label>
              <Input
                id="model_number"
                value={formData.model_number}
                onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_type">AC Type</Label>
              <Input
                id="ac_type"
                value={formData.ac_type}
                onChange={(e) => setFormData({ ...formData, ac_type: e.target.value })}
                placeholder="e.g., Window, Cassette, Split"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity_btu">Capacity (BTU)</Label>
              <Input
                id="capacity_btu"
                type="number"
                value={formData.capacity_btu}
                onChange={(e) => setFormData({ ...formData, capacity_btu: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 18000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installation_date">Installation Date</Label>
              <Input
                id="installation_date"
                type="date"
                value={formData.installation_date}
                onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="WORKSHOP">Workshop</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Updating...' : 'Update AC Unit'}
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
              This action cannot be undone. This will permanently delete the AC unit
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

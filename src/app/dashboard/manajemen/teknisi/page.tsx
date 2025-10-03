'use client'

import { useState, useEffect } from 'react'
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from '@/lib/actions/technicians'
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
import { Edit, Trash2, Search, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Technician {
  technician_id: string
  technician_name: string
  contact_number: string
  email?: string
  company?: string
}

export default function TechniciansPage() {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    technician_name: '',
    contact_number: '',
    email: '',
    company: '',
  })

  useEffect(() => {
    fetchTechnicians()
  }, [searchQuery])

  const fetchTechnicians = async () => {
    setLoading(true)
    try {
      const result = await getTechnicians({
        search: searchQuery,
        limit: 100,
      })
      if (result.success) {
        setTechnicians(result.data)
      }
    } catch (error) {
      console.error('Error fetching technicians:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch technicians',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setFormData({
      technician_name: '',
      contact_number: '',
      email: '',
      company: '',
    })
    setIsCreateOpen(true)
  }

  const handleEdit = (technician: Technician) => {
    setSelectedTechnician(technician)
    setFormData({
      technician_name: technician.technician_name,
      contact_number: technician.contact_number,
      email: technician.email || '',
      company: technician.company || '',
    })
    setIsEditOpen(true)
  }

  const handleDelete = (technicianId: string) => {
    setDeleteId(technicianId)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteId) return

    setIsSubmitting(true)
    try {
      const result = await deleteTechnician(deleteId)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Technician deleted successfully',
        })
        setIsDeleteOpen(false)
        setDeleteId(null)
        fetchTechnicians()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete technician',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting technician:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete technician',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await createTechnician(formData)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Technician created successfully',
        })
        setIsCreateOpen(false)
        fetchTechnicians()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create technician',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating technician:', error)
      toast({
        title: 'Error',
        description: 'Failed to create technician',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTechnician) return

    setIsSubmitting(true)
    try {
      const result = await updateTechnician(selectedTechnician.technician_id, formData)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Technician updated successfully',
        })
        setIsEditOpen(false)
        setSelectedTechnician(null)
        fetchTechnicians()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update technician',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating technician:', error)
      toast({
        title: 'Error',
        description: 'Failed to update technician',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Technicians</h1>
          <p className="text-muted-foreground">Manage technicians data (Full CRUD)</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Technician
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Technicians List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by name, phone, email, or company..."
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
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        No technicians found
                      </TableCell>
                    </TableRow>
                  ) : (
                    technicians.map((technician) => (
                      <TableRow key={technician.technician_id}>
                        <TableCell className="font-medium">{technician.technician_name}</TableCell>
                        <TableCell>{technician.contact_number}</TableCell>
                        <TableCell>{technician.email || '-'}</TableCell>
                        <TableCell>{technician.company || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(technician)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(technician.technician_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create Sheet */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Technician</SheetTitle>
            <SheetDescription>
              Create a new technician profile
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={formData.technician_name}
                onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Contact Number *</Label>
              <Input
                id="create-phone"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-company">Company</Label>
              <Input
                id="create-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., CoolAir, ACindo"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Technician'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Technician</SheetTitle>
            <SheetDescription>
              Update technician information
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.technician_name}
                onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Contact Number *</Label>
              <Input
                id="edit-phone"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., CoolAir, ACindo"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Updating...' : 'Update Technician'}
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
              This action cannot be undone. This will permanently delete the technician
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

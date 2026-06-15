'use client'

import { useState, useEffect } from 'react'
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from '@/lib/actions/technicians'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { useSortableTable } from '@/hooks/use-sortable-table'
import { TechnicianTable, type Technician } from './_components/technician-table'
import { TechnicianFilters } from './_components/technician-filters'
import { TechnicianFormModal } from './_components/technician-form-modal'

interface TechnicianFormData {
  technician_name: string; contact_number: string; email: string; password: string; company: string
}

const emptyFormData: TechnicianFormData = { technician_name: '', contact_number: '', email: '', password: '', company: '' }

export default function TechniciansPage() {
  const { toast } = useToast()
  const [techniciansBase, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<TechnicianFormData>(emptyFormData)

  const { sortedData: techniciansSorted, sortConfig, requestSort } = useSortableTable(techniciansBase as unknown as Record<string, unknown>[], {
    key: 'technician_name',
    direction: 'asc'
  })
  const technicians = techniciansSorted as unknown as Technician[]

  useEffect(() => {
    fetchTechnicians()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const fetchTechnicians = async () => {
    setLoading(true)
    try {
      const result = await getTechnicians({ search: searchQuery, limit: 100 })
      if (result.success) setTechnicians(result.data)
    } catch (error) {
      logger.error('Error fetching technicians:', error)
      toast({ title: 'Error', description: 'Failed to fetch technicians', variant: 'destructive' })
    } finally { setLoading(false) }
  }

  const handleCreate = () => { setFormData(emptyFormData); setIsCreateOpen(true) }

  const handleEdit = (technician: Technician) => {
    setSelectedTechnician(technician)
    setFormData({ technician_name: technician.technician_name, contact_number: technician.contact_number, email: technician.email || '', password: '', company: technician.company || '' })
    setIsEditOpen(true)
  }

  const handleDelete = (technicianId: string) => { setDeleteId(technicianId); setIsDeleteOpen(true) }

  const confirmDelete = async () => {
    if (!deleteId) return
    setIsSubmitting(true)
    try {
      const result = await deleteTechnician(deleteId)
      if (result.success) {
        toast({ title: 'Success', description: 'Technician deleted successfully' })
        setIsDeleteOpen(false)
        setDeleteId(null)
        fetchTechnicians()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to delete technician', variant: 'destructive' })
      }
    } catch (error) {
      logger.error('Error deleting technician:', error)
      toast({ title: 'Error', description: 'Failed to delete technician', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent, mode: 'create' | 'edit') => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = mode === 'create'
        ? await createTechnician(formData)
        : selectedTechnician
          ? await updateTechnician(selectedTechnician.technician_id, {
              technician_name: formData.technician_name,
              contact_number: formData.contact_number,
              email: formData.email,
              company: formData.company,
            })
          : { success: false, error: 'No technician selected' }

      if (result.success) {
        toast({ title: 'Success', description: mode === 'create' ? 'Technician created successfully' : 'Technician updated successfully' })
        if (mode === 'create') setIsCreateOpen(false)
        else { setIsEditOpen(false); setSelectedTechnician(null) }
        fetchTechnicians()
      } else {
        toast({ title: 'Error', description: result.error || `Failed to ${mode} technician`, variant: 'destructive' })
      }
    } catch (error) {
      logger.error(`Error ${mode === 'create' ? 'creating' : 'updating'} technician:`, error)
      toast({ title: 'Error', description: `Failed to ${mode} technician`, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Technicians</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage technicians data (Full CRUD)</p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Technician
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Technicians List</CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicianFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <TechnicianTable
            technicians={technicians}
            loading={loading}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddClick={() => setIsCreateOpen(true)}
          />
        </CardContent>
      </Card>

      <TechnicianFormModal
        mode="create"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        technician={null}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={(e) => handleFormSubmit(e, 'create')}
        isSubmitting={isSubmitting}
      />

      <TechnicianFormModal
        mode="edit"
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        technician={selectedTechnician}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={(e) => handleFormSubmit(e, 'edit')}
        isSubmitting={isSubmitting}
      />

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

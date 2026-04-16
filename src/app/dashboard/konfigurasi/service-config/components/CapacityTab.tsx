'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { getCapacityRanges, createCapacityRange, updateCapacityRange, deleteCapacityRange, getUnitTypes, bulkImportCapacityRanges } from '@/lib/actions/service-config'
import { BulkImportDialog } from './BulkImportDialog'
import { UploadCloud } from 'lucide-react'

export function CapacityTab() {
  const [items, setItems] = useState<any[]>([])
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [filterUnitTypeId, setFilterUnitTypeId] = useState<string>('ALL')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  
  const [unitTypeId, setUnitTypeId] = useState('')
  const [capacityLabel, setCapacityLabel] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Bulk import state
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)

  const { toast } = useToast()

  useEffect(() => { loadUnitTypes() }, [])
  useEffect(() => { loadData() }, [filterUnitTypeId])

  const loadUnitTypes = async () => {
    const res = await getUnitTypes()
    if (res.success) setUnitTypes(res.data || [])
  }

  const loadData = async () => {
    setIsFetching(true)
    const res = await getCapacityRanges(filterUnitTypeId === 'ALL' ? undefined : filterUnitTypeId)
    if (res.success) setItems(res.data || [])
    setIsFetching(false)
  }

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setUnitTypeId(item.unit_type_id)
      setCapacityLabel(item.capacity_label)
      setIsActive(item.is_active)
    } else {
      setEditingItem(null)
      setUnitTypeId(filterUnitTypeId !== 'ALL' ? filterUnitTypeId : '')
      setCapacityLabel('')
      setIsActive(true)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Silakan pilih Unit Type' })
      return
    }

    setIsLoading(true)
    const input = {
      unit_type_id: unitTypeId,
      capacity_label: capacityLabel,
      is_active: isActive
    }

    let res;
    if (editingItem) {
      res = await updateCapacityRange(editingItem.capacity_id, input)
    } else {
      res = await createCapacityRange(input)
    }

    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data disimpan.' })
      setIsDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    setIsLoading(true)
    const res = await deleteCapacityRange(deletingItem.capacity_id)
    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data dihapus.' })
      setIsDeleteDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
    setIsLoading(false)
  }

  const handleBulkImport = async (csvText: string) => {
    setIsLoading(true)
    const res = await bulkImportCapacityRanges(csvText)
    if (res.success) {
      toast({ title: 'Import Berhasil', description: res.message })
      setIsBulkDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Import Gagal', description: res.error })
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Capacity Ranges</CardTitle>
            <CardDescription>Kelola kapasitas AC (contoh: 0.5 - 1.5 HP, Kg) per Unit Type</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsBulkDialogOpen(true)} variant="outline" className="gap-2">
              <UploadCloud className="h-4 w-4" /> Bulk Import
            </Button>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4 items-end">
            <div className="w-[300px] space-y-2">
              <Label>Filter berdasarkan Unit Type</Label>
              <Select value={filterUnitTypeId} onValueChange={setFilterUnitTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih unit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Unit Type</SelectItem>
                  {unitTypes.map(ut => (
                    <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>{ut.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFetching ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Type</TableHead>
                  <TableHead>Capacity Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.capacity_id}>
                    <TableCell>{item.unit_types?.name}</TableCell>
                    <TableCell className="font-medium">{item.capacity_label}</TableCell>
                    <TableCell>
                      {item.is_active ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-gray-400" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Tidak ada data capacity range.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Capacity Range</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Unit Type *</Label>
                  <Select value={unitTypeId} onValueChange={setUnitTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitTypes.map(ut => (
                        <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>{ut.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity Label *</Label>
                  <Input value={capacityLabel} onChange={e => setCapacityLabel(e.target.value)} required placeholder="Misal: 0.5 - 1.5 HP" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Hapus Capacity Range?</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <BulkImportDialog 
            open={isBulkDialogOpen}
            onOpenChange={setIsBulkDialogOpen}
            title="Bulk Import Capacity Ranges (CSV)"
            description={<span>Paste data CSV dari Excel atau Drop File di atas. Sesuai format: <code>Type AC, Capacity</code></span>}
            placeholder={"Type AC,Capacity\nRoom Air,0.5 - 1.5 HP\nStanding Floor,5 PK"}
            onImport={handleBulkImport}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}

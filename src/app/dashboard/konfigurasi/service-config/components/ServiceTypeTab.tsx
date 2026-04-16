'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { getServiceTypes, createServiceType, updateServiceType, deleteServiceType } from '@/lib/actions/service-config'

export function ServiceTypeTab() {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)

  const { toast } = useToast()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsFetching(true)
    const res = await getServiceTypes()
    if (res.success) setItems(res.data || [])
    setIsFetching(false)
  }

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setCode(item.code)
      setName(item.name)
      setDescription(item.description || '')
      setDisplayOrder(item.display_order?.toString() || '0')
      setIsActive(item.is_active)
    } else {
      setEditingItem(null)
      setCode('')
      setName('')
      setDescription('')
      setDisplayOrder('0')
      setIsActive(true)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const input = {
      code,
      name,
      description: description || null,
      display_order: parseInt(displayOrder) || 0,
      is_active: isActive
    }

    let res;
    if (editingItem) {
      res = await updateServiceType(editingItem.service_type_id, input)
    } else {
      res = await createServiceType(input)
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
    const res = await deleteServiceType(deletingItem.service_type_id)
    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data dihapus.' })
      setIsDeleteDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Master Data Service Types</CardTitle>
          <CardDescription>Kelola kategori tipe service (Checking, Cleaning, Repair, dll)</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nama Service</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.service_type_id}>
                  <TableCell className="font-medium font-mono">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.description || '-'}</TableCell>
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
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Service Type</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Code (Unik) *</Label>
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} required placeholder="Misal: CHECKING" />
              </div>
              <div className="space-y-2">
                <Label>Nama Tipe Service *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Misal: Jasa Layanan Pengecekan" />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Urutan Display</Label>
                <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
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
            <AlertDialogHeader><AlertDialogTitle>Hapus Service Type?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

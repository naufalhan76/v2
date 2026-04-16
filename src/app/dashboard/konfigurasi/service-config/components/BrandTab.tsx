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
import { getAcBrands, createAcBrand, updateAcBrand, deleteAcBrand, bulkImportAcBrands } from '@/lib/actions/service-config'
import { BulkImportDialog } from './BulkImportDialog'
import { UploadCloud } from 'lucide-react'

export function BrandTab() {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Bulk import state
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)

  const { toast } = useToast()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsFetching(true)
    const res = await getAcBrands()
    if (res.success) setItems(res.data || [])
    setIsFetching(false)
  }

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setName(item.name)
      setIsActive(item.is_active)
    } else {
      setEditingItem(null)
      setName('')
      setIsActive(true)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const input = { name, is_active: isActive }

    let res;
    if (editingItem) {
      res = await updateAcBrand(editingItem.brand_id, input)
    } else {
      res = await createAcBrand(input)
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
    const res = await deleteAcBrand(deletingItem.brand_id)
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
    const res = await bulkImportAcBrands(csvText)
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Merk AC (Brands)</CardTitle>
          <CardDescription>Kelola master data merk AC</CardDescription>
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
        {isFetching ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Merk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.brand_id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
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
              <DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Merk AC</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Merk *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Misal: Daikin" />
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
            <AlertDialogHeader><AlertDialogTitle>Hapus Merk AC?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BulkImportDialog 
          open={isBulkDialogOpen}
          onOpenChange={setIsBulkDialogOpen}
          title="Bulk Import Merk AC (CSV)"
          description={<span>Paste data CSV dari Excel atau Drop File di atas. Sesuai format: <code>Nama Merk</code></span>}
          placeholder={"Nama Merk\nDaikin\nPanasonic\nLG"}
          onImport={handleBulkImport}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  )
}

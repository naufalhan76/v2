'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, UploadCloud } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { 
  getServiceCatalog, 
  createServiceCatalogEntry, 
  updateServiceCatalogEntry, 
  deleteServiceCatalogEntry, 
  bulkImportServiceCatalog,
  getUnitTypes,
  getCapacityRanges,
  getServiceTypes
} from '@/lib/actions/service-config'
import { Textarea } from '@/components/ui/textarea'

export function ServiceCatalogTab() {
  const [items, setItems] = useState<any[]>([])
  
  // Master data
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [capacityRanges, setCapacityRanges] = useState<any[]>([])
  const [serviceTypes, setServiceTypes] = useState<any[]>([])
  
  // Filters
  const [filterUnitTypeId, setFilterUnitTypeId] = useState<string>('ALL')
  const [filterCapacityId, setFilterCapacityId] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // UI State
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  
  // Form State
  const [msnCode, setMsnCode] = useState('')
  const [unitTypeId, setUnitTypeId] = useState('')
  const [capacityId, setCapacityId] = useState('')
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Bulk State
  const [csvText, setCsvText] = useState('')

  const { toast } = useToast()

  useEffect(() => { loadMasterData() }, [])
  useEffect(() => { loadData() }, [filterUnitTypeId, filterCapacityId, searchQuery])

  const loadMasterData = async () => {
    const [uRes, cRes, sRes] = await Promise.all([
      getUnitTypes(),
      getCapacityRanges(),
      getServiceTypes()
    ])
    if (uRes.success) setUnitTypes(uRes.data || [])
    if (cRes.success) setCapacityRanges(cRes.data || [])
    if (sRes.success) setServiceTypes(sRes.data || [])
  }

  const loadData = async () => {
    setIsFetching(true)
    const res = await getServiceCatalog({
      unitTypeId: filterUnitTypeId !== 'ALL' ? filterUnitTypeId : undefined,
      capacityId: filterCapacityId !== 'ALL' ? filterCapacityId : undefined,
      search: searchQuery || undefined
    })
    if (res.success) setItems(res.data || [])
    setIsFetching(false)
  }

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setMsnCode(item.msn_code)
      setUnitTypeId(item.unit_type_id)
      setCapacityId(item.capacity_id)
      setServiceTypeId(item.service_type_id)
      setServiceName(item.service_name)
      setBasePrice(item.base_price.toString())
      setDescription(item.description || '')
      setIsActive(item.is_active)
    } else {
      setEditingItem(null)
      setMsnCode('')
      setUnitTypeId(filterUnitTypeId !== 'ALL' ? filterUnitTypeId : '')
      setCapacityId(filterCapacityId !== 'ALL' ? filterCapacityId : '')
      setServiceTypeId('')
      setServiceName('')
      setBasePrice('')
      setDescription('')
      setIsActive(true)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitTypeId || !capacityId || !serviceTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Silakan lengkapi pilihan Unit Type, Capacity, dan Tipe Service' })
      return
    }

    setIsLoading(true)
    const input = {
      msn_code: msnCode,
      unit_type_id: unitTypeId,
      capacity_id: capacityId,
      service_type_id: serviceTypeId,
      service_name: serviceName,
      base_price: parseFloat(basePrice) || 0,
      description: description || null,
      is_active: isActive
    }

    let res;
    if (editingItem) {
      res = await updateServiceCatalogEntry(editingItem.catalog_id, input)
    } else {
      res = await createServiceCatalogEntry(input)
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
    const res = await deleteServiceCatalogEntry(deletingItem.catalog_id)
    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data dihapus.' })
      setIsDeleteDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
    setIsLoading(false)
  }

  const handleBulkImport = async () => {
    if (!csvText.trim()) {
       toast({ variant: 'destructive', title: 'Error', description: 'CSV kosong' })
       return;
    }
    setIsLoading(true)
    const res = await bulkImportServiceCatalog(csvText)
    if (res.success) {
       toast({ title: 'Import Berhasil', description: res.message })
       setIsBulkDialogOpen(false)
       setCsvText('')
       loadMasterData()
       loadData()
    } else {
       toast({ variant: 'destructive', title: 'Import Gagal', description: res.error })
    }
    setIsLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  }

  const availableCapacities = capacityRanges.filter(c => c.unit_type_id === (editingItem ? unitTypeId : filterUnitTypeId === 'ALL' ? unitTypeId : filterUnitTypeId || unitTypeId));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-[200px] space-y-2">
              <Label>Filter Type AC</Label>
              <Select value={filterUnitTypeId} onValueChange={setFilterUnitTypeId}>
                <SelectTrigger><SelectValue placeholder="Semua Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Type AC</SelectItem>
                  {unitTypes.map(ut => <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>{ut.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px] space-y-2">
              <Label>Filter Capacity</Label>
              <Select value={filterCapacityId} onValueChange={setFilterCapacityId} disabled={filterUnitTypeId === 'ALL'}>
                <SelectTrigger><SelectValue placeholder="Semua Capacity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Capacity</SelectItem>
                  {capacityRanges.filter(c => c.unit_type_id === filterUnitTypeId).map(c => 
                    <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Cari (MSN / Nama)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsBulkDialogOpen(true)} variant="outline" className="gap-2">
                 <UploadCloud className="h-4 w-4" /> Bulk Import
              </Button>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Tambah
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Harga & Service Catalog</CardTitle>
          <CardDescription>Master data harga berdasarkan MSN code, Unit Type, dan Capacity</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MSN Code</TableHead>
                  <TableHead>Type AC</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Service Group</TableHead>
                  <TableHead>Deskripsi Service</TableHead>
                  <TableHead>Harga Base</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.catalog_id}>
                    <TableCell className="font-mono font-bold text-primary">{item.msn_code}</TableCell>
                    <TableCell>{item.unit_types?.name}</TableCell>
                    <TableCell>{item.capacity_ranges?.capacity_label}</TableCell>
                    <TableCell><span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs">{item.service_types?.name}</span></TableCell>
                    <TableCell className="font-medium">{item.service_name}</TableCell>
                    <TableCell>{formatCurrency(item.base_price)}</TableCell>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Tidak ada data catalog.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Service Catalog</DialogTitle>
                <DialogDescription>Input kombinasi service baru. Pastikan MSN Code unik.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>MSN Code *</Label>
                     <Input value={msnCode} onChange={e => setMsnCode(e.target.value)} required placeholder="Misal: CARERA001" />
                   </div>
                   <div className="space-y-2">
                     <Label>Base Price *</Label>
                     <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} required placeholder="Misal: 150000" />
                   </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type AC *</Label>
                    <Select value={unitTypeId} onValueChange={setUnitTypeId}>
                      <SelectTrigger><SelectValue placeholder="Pilih type AC" /></SelectTrigger>
                      <SelectContent>
                        {unitTypes.map(ut => <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>{ut.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacity *</Label>
                    <Select value={capacityId} onValueChange={setCapacityId} disabled={!unitTypeId}>
                      <SelectTrigger><SelectValue placeholder="Pilih capacity" /></SelectTrigger>
                      <SelectContent>
                        {capacityRanges.filter(c => c.unit_type_id === unitTypeId).map(c => 
                          <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Master Service Type *</Label>
                    <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                      <SelectTrigger><SelectValue placeholder="Pilih service type" /></SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map(st => <SelectItem key={st.service_type_id} value={st.service_type_id}>{st.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nama Service (di Invoice/Tampilan) *</Label>
                  <Input value={serviceName} onChange={e => setServiceName(e.target.value)} required placeholder="Misal: Jasa Service Room Air (Checking)" />
                </div>
                
                <div className="space-y-2">
                  <Label>Keterangan Tambahan / Deskripsi</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opsional" />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
             <DialogContent className="max-w-3xl">
                <DialogHeader>
                   <DialogTitle>Bulk Import Service Catalog (CSV)</DialogTitle>
                   <DialogDescription>Paste data CSV dari Excel di bawah ini. Sesuai format: <code>MSN Code, Type AC, Capacity, Tipe Service, Price</code></DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                   <Textarea 
                      placeholder={"MSN Code,Type AC,Capacity,Tipe Service,Price\nCARERA001P,Room Air,0.5 - 1.5 HP,Jasa Service Room Air (Checking),100000"} 
                      className="min-h-[300px] font-mono text-xs whitespace-pre" 
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                   />
                </div>
                <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                   Pastikan header CSV ada di baris pertama dan menggunakan pemisah koma (,) atau TAB.
                </div>
                <DialogFooter className="mt-4">
                   <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Batal</Button>
                   <Button onClick={handleBulkImport} disabled={isLoading || !csvText}>{isLoading ? 'Importing...' : 'Start Import'}</Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Hapus Data Harga?</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Search, UploadCloud, Download } from 'lucide-react'
import {
  getServiceCatalog,
  getUnitTypes,
  getCapacityRanges,
  getServiceTypes,
  bulkImportServiceCatalog,
  bulkUpdateServiceCatalog,
} from '@/lib/actions/service-config'
import { BulkImportDialog } from './BulkImportDialog'
import { ServiceCatalogTable, type ServiceCatalogItem } from './service-catalog-table'
import { ServiceCatalogForm } from './service-catalog-form'

export function ServiceCatalogTab() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([])
  const [unitTypes, setUnitTypes] = useState<{ unit_type_id: string; name: string }[]>([])
  const [capacityRanges, setCapacityRanges] = useState<{ capacity_id: string; unit_type_id: string; capacity_label: string }[]>([])
  const [serviceTypes, setServiceTypes] = useState<{ service_type_id: string; name: string }[]>([])
  const [filterUnitTypeId, setFilterUnitTypeId] = useState<string>('ALL')
  const [filterCapacityId, setFilterCapacityId] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<ServiceCatalogItem | null>(null)
  const { toast } = useToast()

  useEffect(() => { loadMasterData() }, [])
  useEffect(() => { loadData() }, [filterUnitTypeId, filterCapacityId, searchQuery])

  const loadMasterData = async () => {
    const [uRes, cRes, sRes] = await Promise.all([getUnitTypes(), getCapacityRanges(), getServiceTypes()])
    if (uRes.success) setUnitTypes(uRes.data || [])
    if (cRes.success) setCapacityRanges(cRes.data || [])
    if (sRes.success) setServiceTypes(sRes.data || [])
  }

  const loadData = async () => {
    setIsFetching(true)
    const res = await getServiceCatalog({
      unitTypeId: filterUnitTypeId !== 'ALL' ? filterUnitTypeId : undefined,
      capacityId: filterCapacityId !== 'ALL' ? filterCapacityId : undefined,
      search: searchQuery || undefined,
    })
    if (res.success) setItems(res.data || [])
    setIsFetching(false)
  }

  const handleOpenDialog = (item?: ServiceCatalogItem) => {
    setEditingItem(item || null)
    setIsDialogOpen(true)
  }

  const handleDeleteItem = (item: ServiceCatalogItem) => {
    setDeletingItem(item)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return
    const { deleteServiceCatalogEntry } = await import('@/lib/actions/service-config')
    const res = await deleteServiceCatalogEntry(deletingItem.catalog_id)
    if (res.success) {
      toast({ title: 'Berhasil', description: 'Data dihapus.' })
      setIsDeleteDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error })
    }
  }

  const handleBulkImport = async (csvText: string) => {
    const res = await bulkImportServiceCatalog(csvText)
    if (res.success) {
      toast({ title: 'Import Berhasil', description: res.message })
      setIsBulkDialogOpen(false)
      loadMasterData()
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Import Gagal', description: res.error })
    }
  }

  const handleBulkUpdate = async (csvText: string) => {
    const res = await bulkUpdateServiceCatalog(csvText)
    if (res.success) {
      toast({ title: 'Update Berhasil', description: res.message })
      setIsBulkUpdateDialogOpen(false)
      loadData()
    } else {
      toast({ variant: 'destructive', title: 'Update Gagal', description: res.error })
    }
  }

  const downloadTemplate = () => {
    const headers = ['catalog_id', 'msn_code', 'service_name', 'base_price', 'description', 'is_active']
    const rows = items.map(item => [item.catalog_id, item.msn_code, item.service_name, item.base_price, item.description || '', item.is_active ? 'TRUE' : 'FALSE'])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'service-catalog-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filteredCapacities = capacityRanges.filter(c => c.unit_type_id === filterUnitTypeId)
  const capacityDisabled = filterUnitTypeId === 'ALL'

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-[200px] space-y-2">
              <Label className="text-sm font-medium text-foreground">Filter Type AC</Label>
              {unitTypes.length > 3 ? (
                <SearchableSelect options={[{ id: 'ALL', label: 'Semua Type AC' }, ...unitTypes.map(ut => ({ id: ut.unit_type_id, label: ut.name }))]}
                  value={filterUnitTypeId} onValueChange={setFilterUnitTypeId} placeholder="Semua Type" searchPlaceholder="Cari type AC..." />
              ) : (
                <Select value={filterUnitTypeId} onValueChange={setFilterUnitTypeId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Semua Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Type AC</SelectItem>
                    {unitTypes.map(ut => <SelectItem key={ut.unit_type_id} value={ut.unit_type_id}>{ut.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="w-[200px] space-y-2">
              <Label className="text-sm font-medium text-foreground">Filter Capacity</Label>
              {filteredCapacities.length > 3 ? (
                <SearchableSelect options={[{ id: 'ALL', label: 'Semua Capacity' }, ...filteredCapacities.map(c => ({ id: c.capacity_id, label: c.capacity_label }))]}
                  value={filterCapacityId} onValueChange={setFilterCapacityId} placeholder="Semua Capacity" searchPlaceholder="Cari capacity..."
                  className={capacityDisabled ? 'pointer-events-none opacity-50' : ''} />
              ) : (
                <Select value={filterCapacityId} onValueChange={setFilterCapacityId} disabled={capacityDisabled}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Semua Capacity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Capacity</SelectItem>
                    {filteredCapacities.map(c => <SelectItem key={c.capacity_id} value={c.capacity_id}>{c.capacity_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium text-foreground">Cari (MSN / Nama)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 pl-10" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadTemplate} variant="outline" className="gap-2"><Download className="h-4 w-4" /> Download Template</Button>
              <Button onClick={() => setIsBulkUpdateDialogOpen(true)} variant="outline" className="gap-2"><UploadCloud className="h-4 w-4" /> Bulk Update</Button>
              <Button onClick={() => setIsBulkDialogOpen(true)} variant="outline" className="gap-2"><UploadCloud className="h-4 w-4" /> Bulk Import</Button>
              <Button onClick={() => handleOpenDialog()} className="gap-2"><Plus className="h-4 w-4" /> Tambah</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Daftar Harga & Service Catalog</CardTitle>
          <CardDescription>Master data harga berdasarkan MSN code, Unit Type, dan Capacity</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceCatalogTable items={items} isFetching={isFetching} onEdit={handleOpenDialog} onDelete={handleDeleteItem} />
        </CardContent>
      </Card>

      <ServiceCatalogForm
        open={isDialogOpen} onOpenChange={setIsDialogOpen} editingItem={editingItem}
        unitTypes={unitTypes} capacityRanges={capacityRanges} serviceTypes={serviceTypes}
        onSave={loadData} deleteItem={deletingItem} onDeleteDialogOpen={isDeleteDialogOpen}
        onDeleteDialogChange={setIsDeleteDialogOpen} onDeleteConfirm={handleDeleteConfirm}
      />

      <BulkImportDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}
        title="Bulk Import Service Catalog (CSV)"
        description={<span>Paste data CSV dari Excel atau Drop File di atas. Sesuai format: <code>MSN Code, Type AC, Capacity, Tipe Service, Price</code></span>}
        placeholder={"MSN Code,Type AC,Capacity,Tipe Service,Price\nCARERA001P,Room Air,0.5 - 1.5 HP,Jasa Service Room Air (Checking),100000"}
        onImport={handleBulkImport} isLoading={false} />

      <BulkImportDialog open={isBulkUpdateDialogOpen} onOpenChange={setIsBulkUpdateDialogOpen}
        title="Bulk Update Service Catalog (CSV)"
        description={<span>Update data catalog yang sudah ada. Format: <code>catalog_id, msn_code, service_name, base_price, description, is_active</code></span>}
        placeholder={"catalog_id,msn_code,service_name,base_price,description,is_active\n123e4567,CARERA001,Jasa Service Room Air,100000,Checking AC,TRUE"}
        onImport={handleBulkUpdate} isLoading={false} />
    </div>
  )
}

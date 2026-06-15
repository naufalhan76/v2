'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, AlertTriangle, UploadCloud, Download } from 'lucide-react'
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
  getAddons,
  getLowStockAddons,
  bulkUpdateAddons,
  type Addon,
} from '@/lib/actions/addons'
import { BulkImportDialog } from './BulkImportDialog'
import { AddonsTable } from './addons-table'
import { AddonsForm } from './addons-form'
import { AddonsFilters } from './addons-filters'

type AddonFormData = {
  category: string
  itemName: string
  itemCode?: string
  description?: string
  unitOfMeasure: string
  unitPrice: string
  stockQuantity?: string
  minimumStock?: string
}

export function AddonsTab() {
  const [addons, setAddons] = useState<Addon[]>([])
  const [lowStockAddons, setLowStockAddons] = useState<Addon[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [deletingAddon, setDeletingAddon] = useState<Addon | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const { toast } = useToast()

  useEffect(() => {
    loadAddons()
    loadLowStockAddons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, searchQuery])

  const loadAddons = async () => {
    try {
      setIsFetching(true)
      const result = await getAddons({
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        search: searchQuery || undefined,
        isActive: true,
      })
      setAddons(result.data)
    } catch (_error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data add-ons' })
    } finally {
      setIsFetching(false)
    }
  }

  const loadLowStockAddons = async () => {
    try {
      const data = await getLowStockAddons()
      setLowStockAddons(data)
    } catch (_error) { /* silent */ }
  }

  const handleSave = () => {
    loadAddons()
    loadLowStockAddons()
  }

  const handleOpenDialog = (addon?: Addon) => {
    if (addon) setEditingAddon(addon)
    else setEditingAddon(null)
    setIsDialogOpen(true)
  }

  const getInitialData = (): AddonFormData | null => {
    if (editingAddon) {
      return {
        category: editingAddon.category,
        itemName: editingAddon.item_name,
        itemCode: editingAddon.item_code || '',
        description: editingAddon.description || '',
        unitOfMeasure: editingAddon.unit_of_measure,
        unitPrice: editingAddon.unit_price.toString(),
        stockQuantity: editingAddon.stock_quantity.toString(),
        minimumStock: editingAddon.minimum_stock.toString(),
      }
    }
    return {
      category: categoryFilter !== 'ALL' ? categoryFilter : 'PARTS',
      itemName: '',
      itemCode: '',
      description: '',
      unitOfMeasure: 'pcs',
      unitPrice: '',
      stockQuantity: '0',
      minimumStock: '0',
    }
  }

  const handleDelete = async () => {
    if (!deletingAddon) return
    try {
      const { deleteAddon } = await import('@/lib/actions/addons')
      await deleteAddon(deletingAddon.addon_id)
      toast({ title: 'Berhasil', description: 'Add-on berhasil dihapus' })
      setIsDeleteDialogOpen(false)
      setDeletingAddon(null)
      loadAddons()
      loadLowStockAddons()
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menghapus add-on',
      })
    }
  }

  const handleBulkUpdate = async (csvText: string) => {
    const res = await bulkUpdateAddons(csvText)
    if (res.success) {
      toast({ title: 'Update Berhasil', description: res.message })
      setIsBulkUpdateDialogOpen(false)
      loadAddons()
      loadLowStockAddons()
    } else {
      toast({ variant: 'destructive', title: 'Update Gagal', description: res.error })
    }
  }

  const downloadTemplate = () => {
    const headers = ['addon_id','item_code','item_name','category','unit_price','unit_of_measure','stock_quantity','minimum_stock','description','is_active']
    const rows = addons.map(a => [a.addon_id, a.item_code||'', a.item_name, a.category, a.unit_price, a.unit_of_measure, a.stock_quantity, a.minimum_stock, a.description||'', a.is_active?'TRUE':'FALSE'])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'addons-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <Button onClick={() => setIsBulkUpdateDialogOpen(true)} variant="outline" className="gap-2">
            <UploadCloud className="h-4 w-4" /> Bulk Update
          </Button>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" /> Tambah Add-on
          </Button>
        </div>
      </div>

      <AddonsForm
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingAddon={editingAddon}
        initialData={getInitialData()}
        onSave={handleSave}
      />

      {lowStockAddons.length > 0 && (
        <Card className="rounded-xl border border-border/50 shadow-sm bg-status-pending-bg dark:bg-status-pending-bg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-warning dark:text-warning">
              <AlertTriangle className="h-5 w-5" /> Stok Rendah
            </CardTitle>
            <CardDescription>{lowStockAddons.length} item memiliki stok di bawah minimum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockAddons.slice(0, 3).map((addon) => (
                <div key={addon.addon_id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{addon.item_name}</span>
                  <span className="text-muted-foreground">
                    Stok: {addon.stock_quantity} / Min: {addon.minimum_stock}
                  </span>
                </div>
              ))}
              {lowStockAddons.length > 3 && (
                <p className="text-sm text-muted-foreground">+{lowStockAddons.length - 3} item lainnya</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AddonsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Daftar Add-ons</CardTitle>
          <CardDescription>{addons.length} item dalam katalog</CardDescription>
        </CardHeader>
        <CardContent>
          <AddonsTable
            addons={addons}
            isFetching={isFetching}
            onEdit={handleOpenDialog}
            onDelete={(addon) => { setDeletingAddon(addon); setIsDeleteDialogOpen(true) }}
          />
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Add-on</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deletingAddon?.item_name}</strong>?
              Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkImportDialog
        open={isBulkUpdateDialogOpen}
        onOpenChange={setIsBulkUpdateDialogOpen}
        title="Bulk Update Add-ons (CSV)"
        description={<span>Update data add-ons yang sudah ada. Format: <code>addon_id, item_code, item_name, category, unit_price, unit_of_measure, stock_quantity, minimum_stock, description, is_active</code></span>}
        placeholder={"addon_id,item_code,item_name,category,unit_price,unit_of_measure,stock_quantity,minimum_stock,description,is_active\n123e4567,CAP-001,Capacitor 10uF,PARTS,50000,pcs,10,5,Electrolytic capacitor,TRUE"}
        onImport={handleBulkUpdate}
        isLoading={false}
      />
    </div>
  )
}

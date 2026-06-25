'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
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
import { getAddons, createAddon, updateAddon, deleteAddon, getLowStockAddons, type Addon } from '@/lib/actions/addons'
import { getAddonRequests, getPendingAddonRequestCount, approveAddonRequest, rejectAddonRequest, type AddonRequest } from '@/lib/actions/addon-requests'
import { AddonsTable } from './_components/addons-table'
import { AddonFormModal, type AddonFormData } from './_components/addon-form-modal'
import { AddonRequestCard } from './_components/addon-request-panel'
import { AddonFilters } from './_components/addon-filters'
import { LowStockAlert } from './_components/low-stock-alert'

export default function AddonsCatalogPage() {
  const [addons, setAddons] = useState<Addon[]>([])
  const [lowStockAddons, setLowStockAddons] = useState<Addon[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [deletingAddon, setDeletingAddon] = useState<Addon | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const { toast } = useToast()

  useEffect(() => { loadAddons(); loadLowStockAddons() }, [categoryFilter, searchQuery])
  useEffect(() => { loadRequests() }, [])

  const loadAddons = async () => {
    try {
      setIsFetching(true)
      const result = await getAddons({ category: categoryFilter !== 'ALL' ? categoryFilter : undefined, search: searchQuery || undefined, isActive: true })
      setAddons(result.data)
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data add-ons' }) }
    finally { setIsFetching(false) }
  }

  const loadLowStockAddons = async () => {
    try { setLowStockAddons(await getLowStockAddons()) } catch { /* silent */ }
  }

  const loadRequests = async () => {
    try {
      setIsLoadingRequests(true)
      const [r, c] = await Promise.all([getAddonRequests('PENDING'), getPendingAddonRequestCount()])
      if (r.success) setRequests(r.data)
      if (c.success) setPendingCount(c.count)
    } catch { /* silent */ }
    finally { setIsLoadingRequests(false) }
  }

  const handleOpenDialog = (addon?: Addon) => { setEditingAddon(addon || null); setIsDialogOpen(true) }

  const onSubmit = async (data: AddonFormData) => {
    try {
      setIsLoading(true)
      const input = { category: data.category, item_name: data.itemName, item_code: data.itemCode || null, description: data.description || null, unit_of_measure: data.unitOfMeasure, unit_price: parseFloat(data.unitPrice), stock_quantity: data.stockQuantity ? parseFloat(data.stockQuantity) : 0, minimum_stock: data.minimumStock ? parseFloat(data.minimumStock) : 0 }
      if (editingAddon) { await updateAddon(editingAddon.addon_id, input); toast({ title: 'Berhasil', description: 'Add-on berhasil diupdate' }) }
      else { await createAddon(input); toast({ title: 'Berhasil', description: 'Add-on berhasil ditambahkan' }) }
      setIsDialogOpen(false); setEditingAddon(null); loadAddons(); loadLowStockAddons()
    } catch (error: unknown) { toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Gagal menyimpan add-on' }) }
    finally { setIsLoading(false) }
  }

  const handleDelete = async () => {
    if (!deletingAddon) return
    try {
      setIsLoading(true)
      await deleteAddon(deletingAddon.addon_id)
      toast({ title: 'Berhasil', description: 'Add-on berhasil dihapus' })
      setIsDeleteDialogOpen(false); setDeletingAddon(null); loadAddons(); loadLowStockAddons()
    } catch (error: unknown) { toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Gagal menghapus add-on' }) }
    finally { setIsLoading(false) }
  }

  const handleApproveRequest = async (requestId: string, itemCode: string | null, finalPrice: number) =>
    approveAddonRequest({ request_id: requestId, item_code: itemCode, final_unit_price: finalPrice })

  const handleRejectRequest = async (requestId: string, notes?: string) => rejectAddonRequest(requestId, notes)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Katalog Add-ons</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Kelola katalog parts, freon, labor, dan add-ons lainnya</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" />Tambah Add-on</Button>
          </DialogTrigger>
          <AddonFormModal open={isDialogOpen} onOpenChange={setIsDialogOpen} editingAddon={editingAddon} isLoading={isLoading} categoryFilter={categoryFilter} onSubmit={onSubmit} />
        </Dialog>
      </div>

      <LowStockAlert addons={lowStockAddons} />

      <AddonRequestCard requests={requests} isLoadingRequests={isLoadingRequests} pendingCount={pendingCount} onApprove={handleApproveRequest} onReject={handleRejectRequest} onRequestsLoaded={() => { loadRequests(); loadAddons(); loadLowStockAddons() }} />

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <AddonFilters searchQuery={searchQuery} categoryFilter={categoryFilter} onSearchChange={setSearchQuery} onCategoryChange={setCategoryFilter} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Daftar Add-ons</CardTitle>
          <CardDescription>{addons.length} item dalam katalog</CardDescription>
        </CardHeader>
        <CardContent>
          <AddonsTable addons={addons} isFetching={isFetching} onEdit={(addon) => handleOpenDialog(addon)} onDelete={(addon) => { setDeletingAddon(addon); setIsDeleteDialogOpen(true) }} onAddNew={() => handleOpenDialog()} />
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Add-on</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin menghapus <strong>{deletingAddon?.item_name}</strong>? Aksi ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

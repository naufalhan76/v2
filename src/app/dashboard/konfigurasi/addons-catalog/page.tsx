'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  AlertTriangle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  createAddon,
  updateAddon,
  deleteAddon,
  getLowStockAddons,
  type Addon,
} from '@/lib/actions/addons'
import { logger } from '@/lib/logger'

const addonSchema = z.object({
  category: z.string().min(1, 'Kategori wajib diisi'),
  itemName: z.string().min(1, 'Nama item wajib diisi'),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Satuan wajib diisi'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format harga tidak valid'),
  stockQuantity: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format stok tidak valid').optional(),
  minimumStock: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format stok minimum tidak valid').optional(),
})

type AddonFormData = z.infer<typeof addonSchema>

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-blue-500' },
  { value: 'FREON', label: 'Freon', color: 'bg-cyan-500' },
  { value: 'LABOR', label: 'Labor', color: 'bg-amber-500' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-purple-500' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-gray-500' },
]

const UNIT_OF_MEASURES = [
  'pcs',
  'kg',
  'hour',
  'visit',
  'meter',
  'set',
  'unit',
  'liter',
]

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
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AddonFormData>({
    resolver: zodResolver(addonSchema),
  })

  const selectedCategory = watch('category')

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data add-ons',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const loadLowStockAddons = async () => {
    try {
      const data = await getLowStockAddons()
      setLowStockAddons(data)
    } catch (error) {
      logger.error('Error loading low stock add-ons:', error)
    }
  }

  const handleOpenDialog = (addon?: Addon) => {
    if (addon) {
      setEditingAddon(addon)
      reset({
        category: addon.category,
        itemName: addon.item_name,
        itemCode: addon.item_code || '',
        description: addon.description || '',
        unitOfMeasure: addon.unit_of_measure,
        unitPrice: addon.unit_price.toString(),
        stockQuantity: addon.stock_quantity.toString(),
        minimumStock: addon.minimum_stock.toString(),
      })
    } else {
      setEditingAddon(null)
      reset({
        category: categoryFilter !== 'ALL' ? categoryFilter : 'PARTS',
        itemName: '',
        itemCode: '',
        description: '',
        unitOfMeasure: 'pcs',
        unitPrice: '',
        stockQuantity: '0',
        minimumStock: '0',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingAddon(null)
    reset()
  }

  const onSubmit = async (data: AddonFormData) => {
    try {
      setIsLoading(true)

      const input = {
        category: data.category,
        item_name: data.itemName,
        item_code: data.itemCode || null,
        description: data.description || null,
        unit_of_measure: data.unitOfMeasure,
        unit_price: parseFloat(data.unitPrice),
        stock_quantity: data.stockQuantity ? parseFloat(data.stockQuantity) : 0,
        minimum_stock: data.minimumStock ? parseFloat(data.minimumStock) : 0,
      }

      if (editingAddon) {
        await updateAddon(editingAddon.addon_id, input)
        toast({
          title: 'Berhasil',
          description: 'Add-on berhasil diupdate',
        })
      } else {
        await createAddon(input)
        toast({
          title: 'Berhasil',
          description: 'Add-on berhasil ditambahkan',
        })
      }

      handleCloseDialog()
      loadAddons()
      loadLowStockAddons()
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan add-on',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAddon) return

    try {
      setIsLoading(true)
      await deleteAddon(deletingAddon.addon_id)
      toast({
        title: 'Berhasil',
        description: 'Add-on berhasil dihapus',
      })
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
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getCategoryColor = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.color || 'bg-gray-500'
  }

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category
  }

  const isLowStock = (addon: Addon) => {
    return addon.stock_quantity < addon.minimum_stock
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Katalog Add-ons</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Kelola katalog parts, freon, labor, dan add-ons lainnya
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Tambah Add-on
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border border-border/50 shadow-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {editingAddon ? 'Edit Add-on' : 'Tambah Add-on'}
              </DialogTitle>
              <DialogDescription>
                Tambah atau edit item dalam katalog add-ons
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-foreground">
                    Kategori <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    options={CATEGORIES.map(cat => ({ id: cat.value, label: cat.label }))}
                    value={selectedCategory}
                    onValueChange={(value) => setValue('category', value)}
                    placeholder="Pilih kategori"
                    searchPlaceholder="Cari kategori..."
                  />
                  {errors.category && (
                    <p className="text-sm text-destructive">{errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemCode" className="text-sm font-medium text-foreground">Kode Item</Label>
                  <Input
                    id="itemCode"
                    placeholder="CAP-10UF"
                    className="h-10"
                    {...register('itemCode')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemName" className="text-sm font-medium text-foreground">
                  Nama Item <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="itemName"
                  placeholder="Capacitor 10uF"
                  className="h-10"
                  {...register('itemName')}
                />
                {errors.itemName && (
                  <p className="text-sm text-destructive">{errors.itemName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-foreground">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi item..."
                  rows={2}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure" className="text-sm font-medium text-foreground">
                    Satuan <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    options={UNIT_OF_MEASURES.map(unit => ({ id: unit, label: unit }))}
                    value={watch('unitOfMeasure') || ''}
                    onValueChange={(value) => setValue('unitOfMeasure', value)}
                    placeholder="Pilih satuan"
                    searchPlaceholder="Cari satuan..."
                  />
                  {errors.unitOfMeasure && (
                    <p className="text-sm text-destructive">
                      {errors.unitOfMeasure.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitPrice" className="text-sm font-medium text-foreground">
                    Harga Satuan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unitPrice"
                    placeholder="50000"
                    className="h-10"
                    {...register('unitPrice')}
                  />
                  {errors.unitPrice && (
                    <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity" className="text-sm font-medium text-foreground">Stok</Label>
                  <Input
                    id="stockQuantity"
                    placeholder="0"
                    type="number"
                    className="h-10"
                    {...register('stockQuantity')}
                  />
                  {errors.stockQuantity && (
                    <p className="text-sm text-destructive">
                      {errors.stockQuantity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumStock" className="text-sm font-medium text-foreground">Stok Minimum</Label>
                  <Input
                    id="minimumStock"
                    placeholder="0"
                    type="number"
                    className="h-10"
                    {...register('minimumStock')}
                  />
                  {errors.minimumStock && (
                    <p className="text-sm text-destructive">
                      {errors.minimumStock.message}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Stock Alert */}
      {lowStockAddons.length > 0 && (
          <Card className="rounded-xl border border-border/50 shadow-sm bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-amber-700 dark:text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Stok Rendah
            </CardTitle>
            <CardDescription>
              {lowStockAddons.length} item memiliki stok di bawah minimum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockAddons.slice(0, 3).map((addon) => (
                <div
                  key={addon.addon_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{addon.item_name}</span>
                  <span className="text-muted-foreground">
                    Stok: {addon.stock_quantity} / Min: {addon.minimum_stock}
                  </span>
                </div>
              ))}
              {lowStockAddons.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  +{lowStockAddons.length - 3} item lainnya
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan nama atau kode item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:w-auto">
              <Tabs
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                className="w-auto"
              >
                <TabsList className="inline-flex w-auto">
                  <TabsTrigger value="ALL">Semua</TabsTrigger>
                  {CATEGORIES.map((cat) => (
                    <TabsTrigger key={cat.value} value={cat.value}>
                      {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add-ons Table */}
      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Daftar Add-ons</CardTitle>
          <CardDescription>
            {addons.length} item dalam katalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <TableSkeleton rows={6} columns={7} />
          ) : addons.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Belum ada add-ons"
              description="Tambahkan item pertama ke katalog untuk mulai menggunakan add-ons di order."
              action={{
                label: 'Tambah Item',
                icon: Plus,
                onClick: () => handleOpenDialog(),
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm bg-card">
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0">
                    <TableHead className="hidden sm:table-cell">Kategori</TableHead>
                    <TableHead className="hidden lg:table-cell">Kode</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead className="hidden md:table-cell">Satuan</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.map((addon) => (
                    <TableRow key={addon.addon_id} className="border-0 hover:bg-muted/50">
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={getCategoryColor(addon.category)}>
                          {getCategoryLabel(addon.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs">
                        {addon.item_code || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{addon.item_name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1 sm:hidden">
                          <Badge className={getCategoryColor(addon.category)}>
                            {getCategoryLabel(addon.category)}
                          </Badge>
                          {addon.item_code && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {addon.item_code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(addon.unit_price)}</TableCell>
                      <TableCell className="hidden md:table-cell">{addon.unit_of_measure}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isLowStock(addon)
                                ? 'text-amber-600 font-semibold'
                                : ''
                            }
                          >
                            {addon.stock_quantity}
                          </span>
                          {isLowStock(addon) && (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(addon)}
                            className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingAddon(addon)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
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
            <AlertDialogCancel disabled={isLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

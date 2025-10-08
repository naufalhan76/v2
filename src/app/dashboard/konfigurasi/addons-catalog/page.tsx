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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    } catch (error) {
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
      console.error('Error loading low stock add-ons:', error)
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal menyimpan add-on',
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal menghapus add-on',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Katalog Add-ons</h1>
          <p className="text-muted-foreground">
            Kelola katalog parts, freon, labor, dan add-ons lainnya
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Add-on
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingAddon ? 'Edit Add-on' : 'Tambah Add-on'}
              </DialogTitle>
              <DialogDescription>
                Tambah atau edit item dalam katalog add-ons
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Kategori <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => setValue('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-destructive">{errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemCode">Kode Item</Label>
                  <Input
                    id="itemCode"
                    placeholder="CAP-10UF"
                    {...register('itemCode')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemName">
                  Nama Item <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="itemName"
                  placeholder="Capacitor 10uF"
                  {...register('itemName')}
                />
                {errors.itemName && (
                  <p className="text-sm text-destructive">{errors.itemName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi item..."
                  rows={2}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure">
                    Satuan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch('unitOfMeasure')}
                    onValueChange={(value) => setValue('unitOfMeasure', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OF_MEASURES.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unitOfMeasure && (
                    <p className="text-sm text-destructive">
                      {errors.unitOfMeasure.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitPrice">
                    Harga Satuan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unitPrice"
                    placeholder="50000"
                    {...register('unitPrice')}
                  />
                  {errors.unitPrice && (
                    <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Stok</Label>
                  <Input
                    id="stockQuantity"
                    placeholder="0"
                    type="number"
                    {...register('stockQuantity')}
                  />
                  {errors.stockQuantity && (
                    <p className="text-sm text-destructive">
                      {errors.stockQuantity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumStock">Stok Minimum</Label>
                  <Input
                    id="minimumStock"
                    placeholder="0"
                    type="number"
                    {...register('minimumStock')}
                  />
                  {errors.minimumStock && (
                    <p className="text-sm text-destructive">
                      {errors.minimumStock.message}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
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
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
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
            <Tabs
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="ALL">Semua</TabsTrigger>
                {CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value}>
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Add-ons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Add-ons</CardTitle>
          <CardDescription>
            {addons.length} item dalam katalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : addons.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Belum ada add-ons</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Mulai dengan menambahkan item pertama ke katalog
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.map((addon) => (
                    <TableRow key={addon.addon_id}>
                      <TableCell>
                        <Badge className={getCategoryColor(addon.category)}>
                          {getCategoryLabel(addon.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {addon.item_code || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {addon.item_name}
                      </TableCell>
                      <TableCell>{formatCurrency(addon.unit_price)}</TableCell>
                      <TableCell>{addon.unit_of_measure}</TableCell>
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
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(addon)}
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

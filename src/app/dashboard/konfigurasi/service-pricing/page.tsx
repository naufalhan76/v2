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
  DollarSign,
  Clock,
  ListChecks,
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  getServicePricing,
  createServicePricing,
  updateServicePricing,
  deleteServicePricing,
  type ServicePricing,
} from '@/lib/actions/service-pricing'

const servicePricingSchema = z.object({
  serviceType: z.string().min(1, 'Jenis service wajib diisi'),
  serviceName: z.string().min(1, 'Nama service wajib diisi'),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format harga tidak valid'),
  includes: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.string().regex(/^\d+$/, 'Durasi harus berupa angka').optional(),
})

type ServicePricingFormData = z.infer<typeof servicePricingSchema>

const SERVICE_TYPES = [
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Instalasi' },
  { value: 'INSPECTION', label: 'Inspeksi' },
]

export default function ServicePricingPage() {
  const [services, setServices] = useState<ServicePricing[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServicePricing | null>(null)
  const [deletingService, setDeletingService] = useState<ServicePricing | null>(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ServicePricingFormData>({
    resolver: zodResolver(servicePricingSchema),
  })

  const selectedServiceType = watch('serviceType')

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      setIsFetching(true)
      const data = await getServicePricing()
      console.log('Raw data from API:', data)
      
      // Ensure includes is properly parsed as array
      const normalizedData = data.map(service => {
        let includes = service.includes
        console.log('Processing service:', service.service_type, 'includes:', includes, 'type:', typeof includes)
        
        // If includes is a string, try to parse it
        if (includes && typeof includes === 'string') {
          try {
            includes = JSON.parse(includes)
            console.log('Parsed includes:', includes)
          } catch (e) {
            console.error('Failed to parse includes:', e)
            includes = null
          }
        }
        
        // Ensure it's an array or null
        if (includes && !Array.isArray(includes)) {
          console.log('includes is not an array, setting to null')
          includes = null
        }
        
        return {
          ...service,
          includes
        }
      })
      console.log('Normalized data:', normalizedData)
      setServices(normalizedData)
    } catch (error) {
      console.error('Error loading services:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data harga service',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const handleOpenDialog = (service?: ServicePricing) => {
    if (service) {
      setEditingService(service)
      const includesArray = getIncludesArray(service.includes)
      reset({
        serviceType: service.service_type,
        serviceName: service.service_name,
        basePrice: service.base_price.toString(),
        includes: includesArray.join(', '),
        description: service.description || '',
        durationMinutes: service.duration_minutes?.toString() || '',
      })
    } else {
      setEditingService(null)
      reset({
        serviceType: '',
        serviceName: '',
        basePrice: '',
        includes: '',
        description: '',
        durationMinutes: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingService(null)
    reset()
  }

  const onSubmit = async (data: ServicePricingFormData) => {
    try {
      setIsLoading(true)

      const includesArray = data.includes
        ? data.includes.split(',').map((item) => item.trim()).filter(Boolean)
        : []

      const input = {
        service_type: data.serviceType,
        service_name: data.serviceName,
        base_price: parseFloat(data.basePrice),
        includes: includesArray.length > 0 ? includesArray : null,
        description: data.description || null,
        duration_minutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
      }

      if (editingService) {
        await updateServicePricing(editingService.pricing_id, input)
        toast({
          title: 'Berhasil',
          description: 'Harga service berhasil diupdate',
        })
      } else {
        await createServicePricing(input)
        toast({
          title: 'Berhasil',
          description: 'Harga service berhasil ditambahkan',
        })
      }

      handleCloseDialog()
      loadServices()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal menyimpan harga service',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingService) return

    try {
      setIsLoading(true)
      await deleteServicePricing(deletingService.pricing_id)
      toast({
        title: 'Berhasil',
        description: 'Harga service berhasil dihapus',
      })
      setIsDeleteDialogOpen(false)
      setDeletingService(null)
      loadServices()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal menghapus harga service',
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

  const getIncludesArray = (includes: any): string[] => {
    console.log('getIncludesArray input:', includes, 'type:', typeof includes, 'isArray:', Array.isArray(includes))
    
    // Always return a NEW array, never the original reference
    if (!includes) return []
    
    if (Array.isArray(includes)) {
      // Return a NEW array copy to ensure it has all array methods
      return [...includes]
    }
    
    if (typeof includes === 'string') {
      try {
        const parsed = JSON.parse(includes)
        console.log('Parsed includes:', parsed, 'isArray:', Array.isArray(parsed))
        if (Array.isArray(parsed)) {
          // Return a NEW array copy
          return [...parsed]
        }
        return []
      } catch (e) {
        console.error('Failed to parse includes:', e)
        return []
      }
    }
    
    console.log('Includes is neither array nor string, returning empty')
    return []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Harga Service</h1>
          <p className="text-muted-foreground">
            Kelola harga dasar untuk setiap jenis service
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Harga Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Edit Harga Service' : 'Tambah Harga Service'}
              </DialogTitle>
              <DialogDescription>
                Atur harga dasar untuk jenis service tertentu
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">
                  Jenis Service <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedServiceType}
                  onValueChange={(value) => setValue('serviceType', value)}
                  disabled={!!editingService}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.serviceType && (
                  <p className="text-sm text-destructive">{errors.serviceType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceName">
                  Nama Service <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="serviceName"
                  placeholder="Contoh: AC Cleaning Service"
                  {...register('serviceName')}
                />
                {errors.serviceName && (
                  <p className="text-sm text-destructive">{errors.serviceName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="basePrice">
                  Harga Dasar <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="basePrice"
                  placeholder="100000"
                  {...register('basePrice')}
                />
                {errors.basePrice && (
                  <p className="text-sm text-destructive">{errors.basePrice.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="includes">Termasuk</Label>
                <Input
                  id="includes"
                  placeholder="Cek kondisi, Pembersihan filter, Pengecekan freon"
                  {...register('includes')}
                />
                <p className="text-sm text-muted-foreground">
                  Pisahkan dengan koma untuk beberapa item
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Durasi (menit)</Label>
                <Input
                  id="durationMinutes"
                  placeholder="60"
                  type="number"
                  {...register('durationMinutes')}
                />
                {errors.durationMinutes && (
                  <p className="text-sm text-destructive">{errors.durationMinutes.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi service..."
                  rows={3}
                  {...register('description')}
                />
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

      <Card>
        <CardHeader>
          <CardTitle>Daftar Harga Service</CardTitle>
          <CardDescription>
            Harga dasar yang akan digunakan sebagai acuan dalam pembuatan invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Belum ada harga service</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Mulai dengan menambahkan harga service pertama
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis Service</TableHead>
                    <TableHead>Nama Service</TableHead>
                    <TableHead>Harga Dasar</TableHead>
                    <TableHead>Termasuk</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.pricing_id}>
                      <TableCell>
                        <Badge variant="outline">
                          {SERVICE_TYPES.find((t) => t.value === service.service_type)?.label ||
                            service.service_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>{formatCurrency(service.base_price)}</TableCell>
                      <TableCell>
                        {(() => {
                          try {
                            const includesArray = getIncludesArray(service.includes)
                            console.log('About to render includes. Array:', includesArray, 'isArray:', Array.isArray(includesArray), 'length:', includesArray?.length)
                            
                            // Triple-check it's an array with methods
                            if (!includesArray || !Array.isArray(includesArray) || typeof includesArray.slice !== 'function') {
                              console.error('includesArray is not a proper array!', includesArray)
                              return <span className="text-muted-foreground text-sm">-</span>
                            }
                            
                            if (includesArray.length === 0) {
                              return <span className="text-muted-foreground text-sm">-</span>
                            }
                            
                            // Safely slice and map
                            const displayItems = includesArray.slice(0, 2)
                            const remaining = includesArray.length - 2
                            
                            return (
                              <div className="flex flex-wrap gap-1">
                                {displayItems.map((item: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {item}
                                  </Badge>
                                ))}
                                {remaining > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{remaining}
                                  </Badge>
                                )}
                              </div>
                            )
                          } catch (error) {
                            console.error('Error rendering includes:', error, service)
                            return <span className="text-muted-foreground text-sm">Error</span>
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        {service.duration_minutes ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {service.duration_minutes} menit
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                          {service.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingService(service)
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Harga Service</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus harga service untuk{' '}
              <strong>
                {deletingService &&
                  (SERVICE_TYPES.find((t) => t.value === deletingService.service_type)?.label ||
                    deletingService.service_type)}
              </strong>
              ? Aksi ini tidak dapat dibatalkan.
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

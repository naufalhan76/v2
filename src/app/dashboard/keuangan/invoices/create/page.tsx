'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { getOrders } from '@/lib/actions/orders'
import { getServicePricingByType } from '@/lib/actions/service-pricing'
import { getActiveAddons, type Addon } from '@/lib/actions/addons'
import { createInvoice } from '@/lib/actions/invoices'

const invoiceSchema = z.object({
  orderId: z.string().min(1, 'Order wajib dipilih'),
  dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'),
  discountAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  notes: z.string().optional(),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface LineItem {
  type: 'BASE_SERVICE' | 'ADDON'
  description: string
  quantity: number
  unitPrice: number
  total: number
  addonId?: string
}

export default function CreateInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [baseService, setBaseService] = useState<any>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [selectedAddon, setSelectedAddon] = useState<string>('')
  const [addonQuantity, setAddonQuantity] = useState<number>(1)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      discountAmount: '0',
      discountPercentage: '0',
    },
  })

  useEffect(() => {
    loadCompletedOrders()
    loadAddons()
  }, [])

  useEffect(() => {
    if (selectedOrder) {
      loadServicePricing()
    }
  }, [selectedOrder])

  const loadCompletedOrders = async () => {
    try {
      const result = await getOrders({ status: 'DONE', limit: 100 })
      setOrders(result.data || [])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data order',
      })
    }
  }

  const loadAddons = async () => {
    try {
      const data = await getActiveAddons()
      setAddons(data)
    } catch (error) {
      console.error('Error loading addons:', error)
    }
  }

  const loadServicePricing = async () => {
    try {
      const pricing = await getServicePricingByType(selectedOrder.order_type)
      if (pricing) {
        setBaseService(pricing)
        setLineItems([
          {
            type: 'BASE_SERVICE',
            description: `${pricing.service_type} Service - ${pricing.description || ''}`,
            quantity: 1,
            unitPrice: pricing.base_price,
            total: pricing.base_price,
          },
        ])
      }
    } catch (error) {
      console.error('Error loading service pricing:', error)
    }
  }

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find((o) => o.order_id === orderId)
    setSelectedOrder(order)
    setValue('orderId', orderId)
  }

  const handleAddAddon = () => {
    const addon = addons.find((a) => a.addon_id === selectedAddon)
    if (!addon) return

    const newItem: LineItem = {
      type: 'ADDON',
      description: addon.item_name,
      quantity: addonQuantity,
      unitPrice: addon.unit_price,
      total: addon.unit_price * addonQuantity,
      addonId: addon.addon_id,
    }

    setLineItems([...lineItems, newItem])
    setSelectedAddon('')
    setAddonQuantity(1)
  }

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updatedItems = [...lineItems]
    updatedItems[index].quantity = quantity
    updatedItems[index].total = updatedItems[index].unitPrice * quantity
    setLineItems(updatedItems)
  }

  const handleUpdatePrice = (index: number, price: number) => {
    const updatedItems = [...lineItems]
    updatedItems[index].unitPrice = price
    updatedItems[index].total = updatedItems[index].quantity * price
    setLineItems(updatedItems)
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
    const discountAmount = parseFloat(watch('discountAmount') || '0')
    const discountPercentage = parseFloat(watch('discountPercentage') || '0')
    const discountTotal = discountAmount + (subtotal * discountPercentage) / 100
    const taxPercentage = 11
    const taxAmount = ((subtotal - discountTotal) * taxPercentage) / 100
    const total = subtotal - discountTotal + taxAmount

    return {
      subtotal,
      discountAmount: discountTotal,
      taxAmount,
      total,
    }
  }

  const onSubmit = async (data: InvoiceFormData) => {
    if (!selectedOrder || !baseService) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Order atau service pricing tidak valid',
      })
      return
    }

    try {
      setIsLoading(true)

      const invoiceItems = lineItems.map((item) => ({
        item_type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        service_type: item.type === 'BASE_SERVICE' ? selectedOrder.order_type : undefined,
        addon_id: item.addonId,
      }))

      await createInvoice({
        order_id: data.orderId,
        customer_id: selectedOrder.customer_id,
        due_date: data.dueDate,
        service_type: selectedOrder.order_type,
        service_name: baseService.service_type,
        base_service_price: baseService.base_price,
        items: invoiceItems,
        discount_amount: parseFloat(data.discountAmount || '0'),
        discount_percentage: parseFloat(data.discountPercentage || '0'),
        notes: data.notes,
      })

      toast({
        title: 'Berhasil',
        description: 'Invoice berhasil dibuat',
      })

      router.push('/dashboard/keuangan/invoices')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal membuat invoice',
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

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buat Invoice</h1>
          <p className="text-muted-foreground">Wizard pembuatan invoice baru</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                currentStep === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep > step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground text-muted-foreground'
              }`}
            >
              {currentStep > step ? <Check className="h-5 w-5" /> : step}
            </div>
            {step < 4 && <div className="h-0.5 w-12 bg-muted-foreground" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Select Order */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Pilih Order</CardTitle>
              <CardDescription>
                Pilih order yang sudah selesai untuk dibuatkan invoice
                <Badge variant="outline" className="ml-2">Status: DONE</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Tidak ada order dengan status DONE</p>
                  <p className="text-sm mt-2">Pastikan order sudah diselesaikan terlebih dahulu</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Select value={watch('orderId')} onValueChange={handleOrderSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih order" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((order) => (
                          <SelectItem key={order.order_id} value={order.order_id}>
                            {order.order_id} - {order.customers?.customer_name} ({order.order_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.orderId && (
                      <p className="text-sm text-destructive">{errors.orderId.message}</p>
                    )}
                  </div>
                </>
              )}

              {selectedOrder && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Customer:</span>
                    <span className="text-sm">{selectedOrder.customers?.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Phone:</span>
                    <span className="text-sm">{selectedOrder.customers?.phone_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Service Type:</span>
                    <Badge>{selectedOrder.order_type}</Badge>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedOrder}
                >
                  Lanjut <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Confirm Base Service */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Base Service</CardTitle>
              <CardDescription>Konfirmasi harga base service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {baseService && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-2">
                    <h3 className="font-semibold">{baseService.service_type} Service</h3>
                    <p className="text-sm text-muted-foreground">{baseService.description}</p>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Harga Base Service:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(baseService.base_price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={lineItems[0]?.quantity || 1}
                        onChange={(e) => handleUpdateQuantity(0, parseInt(e.target.value))}
                        min="1"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Harga Satuan (Edit jika perlu)</Label>
                      <Input
                        type="number"
                        value={lineItems[0]?.unitPrice || 0}
                        onChange={(e) => handleUpdatePrice(0, parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Total</Label>
                      <Input value={formatCurrency(lineItems[0]?.total || 0)} disabled />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="button" onClick={() => setCurrentStep(3)}>
                  Lanjut <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add Add-ons */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Tambah Add-ons</CardTitle>
              <CardDescription>Tambahkan parts, freon, atau add-ons lainnya</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Add-on</Label>
                  <Select value={selectedAddon} onValueChange={setSelectedAddon}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih add-on" />
                    </SelectTrigger>
                    <SelectContent>
                      {addons.map((addon) => (
                        <SelectItem key={addon.addon_id} value={addon.addon_id}>
                          {addon.item_name} - {formatCurrency(addon.unit_price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={addonQuantity}
                    onChange={(e) => setAddonQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleAddAddon}
                    disabled={!selectedAddon}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {lineItems.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Harga</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell>
                            {item.type === 'ADDON' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="button" onClick={() => setCurrentStep(4)}>
                  Lanjut <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review & Finalize */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Review & Finalize</CardTitle>
              <CardDescription>Review invoice dan finalisasi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tanggal Jatuh Tempo</Label>
                  <Input type="date" {...register('dueDate')} />
                  {errors.dueDate && (
                    <p className="text-sm text-destructive">{errors.dueDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Diskon (Rp)</Label>
                  <Input type="number" {...register('discountAmount')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea {...register('notes')} rows={3} />
              </div>

              <Separator />

              {/* Summary */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diskon:</span>
                  <span className="font-semibold text-red-600">
                    - {formatCurrency(totals.discountAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PPN (11%):</span>
                  <span className="font-semibold">{formatCurrency(totals.taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Membuat Invoice...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Buat Invoice
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}

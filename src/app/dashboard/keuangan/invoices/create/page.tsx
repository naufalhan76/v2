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
import { SearchableSelect } from '@/components/ui/searchable-select'
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
import { createInvoice, getOrderItemsForInvoice } from '@/lib/actions/invoices'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import { logger } from '@/lib/logger'
import { formatPhone } from '@/lib/utils'

const invoiceSchema = z.object({
  orderId: z.string().min(1, 'Order wajib dipilih'),
  paymentAccountId: z.string().min(1, 'Payment account wajib dipilih'),
  dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'),
  discountAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  notes: z.string().optional(),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

type InvoiceType = 'PROFORMA' | 'FINAL'

interface InvoiceOrder {
  order_id: string
  customer_id: string
  status: string
  order_type: string
  customers?: {
    customer_name?: string | null
    phone_number?: string | null
  } | null
}

const isInvoiceType = (value: string | null): value is InvoiceType => {
  return value === 'PROFORMA' || value === 'FINAL'
}

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
  const [orders, setOrders] = useState<InvoiceOrder[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedOrder, setSelectedOrder] = useState<InvoiceOrder | null>(null)
  const [baseService, setBaseService] = useState<unknown>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [selectedAddon, setSelectedAddon] = useState<string>('')
  const [addonQuantity, setAddonQuantity] = useState<number>(1)
  const [requestedInvoiceType, setRequestedInvoiceType] = useState<InvoiceType | null>(null)
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null)

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
    const loadInitialData = async () => {
      const availableOrders = await loadCompletedOrders()
      const params = new URLSearchParams(window.location.search)
      const orderId = params.get('order_id') || params.get('orderId')
      const invoiceType = params.get('type')

      if (isInvoiceType(invoiceType)) {
        setRequestedInvoiceType(invoiceType)
      }

      if (!orderId) return

      const isSelected = selectOrder(orderId, availableOrders)
      if (isSelected) {
        setPrefillMessage('Order and invoice type were prefilled from the create-order flow.')
      } else {
        setPrefillMessage('The order from the URL is not available for invoice creation or already has an invoice.')
      }
    }

    loadInitialData()
    loadAddons()
    loadBankAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedOrder) {
      loadServicePricing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder])

  const loadCompletedOrders = async (): Promise<InvoiceOrder[]> => {
    try {
      // Single roundtrip via statusIn (replaces 5 parallel getOrders).
      // PROFORMA: ASSIGNED / EN_ROUTE / IN_PROGRESS
      // FINAL: COMPLETED
      const result = await getOrders({
        statusIn: 'ASSIGNED,EN_ROUTE,IN_PROGRESS,COMPLETED',
        limit: 200,
      })

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data order')
      }

      const combinedOrders = (result.data || []) as InvoiceOrder[]

      // Batch-check invoiced order_ids in a single query (avoids N+1 HTTP fetches)
      const invoicedSet = await getInvoicedOrderIds(
        combinedOrders.map((o) => o.order_id)
      )
      const availableOrders = combinedOrders.filter(
        (order) => !invoicedSet.has(order.order_id)
      )
      setOrders(availableOrders)
      return availableOrders
    } catch (error) {
      logger.error('Error loading completed orders:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data order',
      })
      return []
    }
  }

  // Batch-check invoiced order ids using a single Supabase query.
  // Replaces previous N+1 fetch loop (one HTTP roundtrip per order).
  const getInvoicedOrderIds = async (orderIds: string[]): Promise<Set<string>> => {
    if (orderIds.length === 0) return new Set<string>()
    try {
      const { createClient } = await import('@/lib/supabase-browser')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('order_id')
        .in('order_id', orderIds)
      if (error) throw error
      return new Set(
        (data || [])
          .map((row: { order_id: string | null }) => row.order_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    } catch (error) {
      logger.error('Error checking invoiced order ids:', error)
      return new Set<string>()
    }
  }

  const loadAddons = async () => {
    try {
      const data = await getActiveAddons()
      setAddons(data)
    } catch (error) {
      logger.error('Error loading addons:', error)
    }
  }

  const loadBankAccounts = async () => {
    try {
      const { createClient } = await import('@/lib/supabase-browser')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoice_configuration')
        .select('bank_accounts')
        .eq('is_active', true)
        .single()
      
      if (error) throw error
      
      setBankAccounts(parseBankAccounts(data?.bank_accounts))
    } catch (error) {
      logger.error('Error loading bank accounts:', error)
      toast({
        variant: 'destructive',
        title: 'Warning',
        description: 'Gagal memuat daftar payment accounts. Silakan config payment account terlebih dahulu.',
      })
    }
  }

  const loadServicePricing = async () => {
    if (!selectedOrder) return

    try {
      // Try to fetch order_items first (for new multi-service orders)
      const orderItems = await getOrderItemsForInvoice(selectedOrder.order_id)

      if (orderItems.length > 0) {
        // NEW ORDERS: Create line items from order_items with MSN code + unit info
        const newLineItems = orderItems.map(item => {
          // Build rich description: [MSN] Service Name (Unit Type Capacity) — qty x
          let desc = item.serviceName
          if (item.msnCode) {
            const unitInfo = [item.unitTypeName, item.capacityLabel].filter(Boolean).join(' ')
            desc = `[${item.msnCode}] ${item.serviceName}${unitInfo ? ` (${unitInfo})` : ''}`
          }
          if (item.quantity > 1) {
            desc += ` × ${item.quantity}`
          }
          return {
            type: 'BASE_SERVICE' as const,
            description: desc,
            quantity: item.quantity,
            unitPrice: item.estimatedPrice,
            total: item.quantity * item.estimatedPrice
          }
        })
        // Render line items immediately so the user sees all base-service rows
        // without waiting for the (Step 2 header-only) baseService lookup.
        setLineItems(newLineItems)

        // Fire-and-forget: load reference pricing for Step 2 header without
        // blocking dependent sections from rendering.
        if (orderItems[0]?.serviceType) {
          getServicePricingByType(orderItems[0].serviceType)
            .then((firstPricing) => {
              if (firstPricing) setBaseService(firstPricing)
            })
            .catch(() => {
              /* header is best-effort; line items already rendered */
            })
        }

      } else {
        // OLD ORDERS: Fallback to order_type (backward compatibility)
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
      }
    } catch (error) {
      logger.error('Error loading service pricing:', error)
    }
  }

  const selectOrder = (orderId: string, orderList: InvoiceOrder[] = orders): boolean => {
    const order = orderList.find((o) => o.order_id === orderId)
    if (!order) return false

    setSelectedOrder(order)
    setValue('orderId', orderId)
    return true
  }

  const handleOrderSelect = (orderId: string) => {
    selectOrder(orderId)
    setPrefillMessage(null)
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
    
    // Get tax from selected payment account
    const selectedAccountId = watch('paymentAccountId')
    const selectedAccount = bankAccounts.find(acc => acc.id === selectedAccountId)
    const taxPercentage = typeof selectedAccount?.tax_percentage === 'number' ? selectedAccount.tax_percentage : 11
    
    const taxAmount = ((subtotal - discountTotal) * taxPercentage) / 100
    const total = subtotal - discountTotal + taxAmount

    return {
      subtotal,
      discountAmount: discountTotal,
      taxAmount,
      taxPercentage,
      total,
    }
  }

  const onSubmit = async (data: InvoiceFormData) => {
    if (!selectedOrder) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Order tidak valid',
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
        service_type: item.type === 'BASE_SERVICE' ? undefined : undefined,
        addon_id: item.addonId,
      }))
      
      // Calculate total from all BASE_SERVICE items
      const baseServiceTotal = lineItems
        .filter(item => item.type === 'BASE_SERVICE')
        .reduce((sum, item) => sum + item.total, 0)
      
      // Get all unique service names from BASE_SERVICE items
      const baseServiceNames = lineItems
        .filter(item => item.type === 'BASE_SERVICE')
        .map(item => item.description.split(' (')[0]) // Extract service name before quantity
      
      const serviceName = baseServiceNames.length > 1 
        ? 'Multiple Services' 
        : ((baseService as Record<string, unknown>)?.service_name as string || baseServiceNames[0] || 'Service')

      // Determine invoice type strictly from order status — ignore URL param on submit
      // to prevent a crafted URL from forcing FINAL on a non-COMPLETED order.
      const invoiceType: InvoiceType = selectedOrder.status === 'COMPLETED' ? 'FINAL' : 'PROFORMA'

      // Get selected bank account details
      const selectedBankAccount = bankAccounts.find(acc => acc.id === data.paymentAccountId)
      if (!selectedBankAccount) {
        throw new Error('Payment account tidak ditemukan')
      }

      await createInvoice({
        order_id: data.orderId,
        customer_id: selectedOrder.customer_id,
        invoice_type: invoiceType,
        due_date: data.dueDate,
        service_type: selectedOrder.order_type, // Keep for DB constraint
        service_name: serviceName,
        base_service_price: baseServiceTotal,
        items: invoiceItems,
        discount_amount: parseFloat(data.discountAmount || '0'),
        discount_percentage: parseFloat(data.discountPercentage || '0'),
        notes: data.notes,
        payment_account_id: selectedBankAccount.id,
        payment_account_label: selectedBankAccount.account_label,
        payment_bank_name: selectedBankAccount.bank,
        payment_account_number: selectedBankAccount.account_number,
        payment_account_name: selectedBankAccount.account_name,
        tax_percentage: selectedBankAccount.tax_percentage, // Use tax from selected account
      })

      toast({
        title: 'Berhasil',
        description: `Invoice ${invoiceType === 'PROFORMA' ? 'Proforma' : 'Final'} berhasil dibuat`,
      })

      router.push('/dashboard/keuangan/invoices')
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal membuat invoice',
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
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" onClick={() => router.back()} className="shrink-0 min-h-[44px] min-w-[44px]">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Buat Invoice</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Wizard pembuatan invoice baru</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 overflow-x-auto">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                currentStep === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep > step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground text-muted-foreground'
              }`}
            >
              {currentStep > step ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : step}
            </div>
            {step < 4 && <div className="h-0.5 w-6 sm:w-12 bg-muted-foreground" />}
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
                Pilih order untuk dibuatkan invoice (Proforma atau Final)
                <Badge variant="outline" className="ml-2">ONGOING = Proforma</Badge>
                <Badge variant="outline" className="ml-2">COMPLETED = Final</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {prefillMessage && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  {prefillMessage}
                </div>
              )}

              {orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Tidak ada order yang tersedia</p>
                  <p className="text-sm mt-2">Order harus sudah di-assign atau selesai</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    {orders.length > 3 ? (
                      <SearchableSelect
                        options={orders.map((order) => ({
                          id: order.order_id,
                          label: `${order.order_id} — ${order.customers?.customer_name ?? '-'}`,
                          secondaryLabel: `${order.order_type} · ${order.status}`,
                        }))}
                        value={watch('orderId') || ''}
                        onValueChange={handleOrderSelect}
                        placeholder="Pilih order"
                        searchPlaceholder="Cari order / customer..."
                      />
                    ) : (
                      <Select value={watch('orderId')} onValueChange={handleOrderSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih order" />
                        </SelectTrigger>
                        <SelectContent>
                          {orders.map((order) => (
                            <SelectItem key={order.order_id} value={order.order_id}>
                              {order.order_id} - {order.customers?.customer_name} ({order.order_type}) - 
                              <Badge className="ml-2" variant={order.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {errors.orderId && (
                      <p className="text-sm text-destructive">{errors.orderId.message}</p>
                    )}
                  </div>
                </>
              )}

              {selectedOrder && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Invoice Type:</span>
                    <Badge variant={(requestedInvoiceType || (selectedOrder.status === 'COMPLETED' ? 'FINAL' : 'PROFORMA')) === 'FINAL' ? 'default' : 'secondary'}>
                      {(requestedInvoiceType || (selectedOrder.status === 'COMPLETED' ? 'FINAL' : 'PROFORMA')) === 'FINAL' ? 'FINAL INVOICE' : 'PROFORMA INVOICE'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Customer:</span>
                    <span className="text-sm">{selectedOrder.customers?.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Phone:</span>
                    <span className="text-sm">{formatPhone(selectedOrder.customers?.phone_number)}</span>
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
                  className="w-full sm:w-auto min-h-[44px]"
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
              {(() => {
                const bs = baseService as Record<string, unknown> | null
                const baseServiceItems = lineItems
                  .map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.type === 'BASE_SERVICE')

                if (!bs && baseServiceItems.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground italic">
                      Memuat base service...
                    </div>
                  )
                }

                return (
                <div className="space-y-4">
                  {bs && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <h3 className="font-semibold">{bs.service_type as string} Service</h3>
                      <p className="text-sm text-muted-foreground">{bs.description as string}</p>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Harga Base Service:</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(bs.base_price as number)}
                        </span>
                      </div>
                    </div>
                  )}

                  {baseServiceItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                      Tidak ada base service item.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {baseServiceItems.map(({ item, index }) => (
                        <div key={index} className="rounded-lg border p-3 space-y-2">
                          <div className="text-sm font-medium">{item.description}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateQuantity(index, parseInt(e.target.value) || 1)
                                }
                                min="1"
                              />
                            </div>
                            <div>
                              <Label>Harga Satuan (Edit jika perlu)</Label>
                              <Input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdatePrice(index, parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                            <div>
                              <Label>Total</Label>
                              <Input value={formatCurrency(item.total)} disabled />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )
              })()}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="min-h-[44px]">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="button" onClick={() => setCurrentStep(3)} className="min-h-[44px]">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex-1">
                  <Label>Add-on</Label>
                  {addons.length > 3 ? (
                    <SearchableSelect
                      options={addons.map((addon) => ({
                        id: addon.addon_id,
                        label: addon.item_name,
                        secondaryLabel: formatCurrency(addon.unit_price),
                      }))}
                      value={selectedAddon}
                      onValueChange={setSelectedAddon}
                      placeholder="Pilih add-on"
                      searchPlaceholder="Cari add-on..."
                    />
                  ) : (
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
                  )}
                </div>
                <div className="flex gap-2 sm:gap-4 sm:items-end">
                  <div className="flex-1 sm:w-32">
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
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {lineItems.length > 0 && (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={index} className="rounded-lg border p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm flex-1 min-w-0 break-words">
                            {item.description}
                          </div>
                          {item.type === 'ADDON' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              className="shrink-0 min-h-[44px] min-w-[44px]"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block data-table-container">
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
                            <TableCell className="whitespace-nowrap">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="font-semibold whitespace-nowrap">
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
                </>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="min-h-[44px]">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="button" onClick={() => setCurrentStep(4)} className="min-h-[44px]">
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
                  <Label>Payment Account *</Label>
                  {bankAccounts.length > 3 ? (
                    <SearchableSelect
                      options={bankAccounts.map((account) => ({
                        id: account.id,
                        label: account.account_label,
                        secondaryLabel: `${account.bank} - ${account.account_number} (PPN ${account.tax_percentage}%)`,
                      }))}
                      value={watch('paymentAccountId') || ''}
                      onValueChange={(value) => setValue('paymentAccountId', value)}
                      placeholder="Pilih payment account"
                      searchPlaceholder="Cari rekening..."
                    />
                  ) : (
                    <Select
                      value={watch('paymentAccountId')}
                      onValueChange={(value) => setValue('paymentAccountId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih payment account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex flex-col">
                              <span className="font-semibold">{account.account_label}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.bank} - {account.account_number} (PPN {account.tax_percentage}%)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.paymentAccountId && (
                    <p className="text-sm text-destructive">{errors.paymentAccountId.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Jatuh Tempo *</Label>
                  <Input type="date" {...register('dueDate')} />
                  {errors.dueDate && (
                    <p className="text-sm text-destructive">{errors.dueDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                  <span>PPN ({totals.taxPercentage}%):</span>
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

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(3)} className="min-h-[44px]">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button type="submit" disabled={isLoading} className="min-h-[44px]">
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

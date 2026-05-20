'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Plus, Trash2, Check } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import {
  CreateBlankInvoiceSchema,
  type CreateBlankInvoiceInput,
} from '@/app/api/schemas'
import { createBlankInvoice } from '@/lib/actions/invoices'
import { getCustomers } from '@/lib/actions/customers'
import { parseBankAccounts, type BankAccount } from '@/lib/bank-accounts'
import { calculateDiscount, calculateTax } from '@/lib/utils/money'

interface CustomerOption {
  customer_id: string
  customer_name: string
  phone_number?: string | null
  email?: string | null
  billing_address?: string | null
}

const todayISO = () => new Date().toISOString().split('T')[0]

const defaultDueISO = () => {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
}

export default function CreateBlankInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateBlankInvoiceInput>({
    resolver: zodResolver(CreateBlankInvoiceSchema),
    defaultValues: {
      invoice_type: 'FINAL',
      customer_id: undefined,
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      invoice_date: todayISO(),
      due_date: defaultDueISO(),
      items: [
        { item_type: 'BASE_SERVICE', description: '', quantity: 1, unit_price: 0 },
      ],
      discount_amount: 0,
      discount_percentage: 0,
      tax_percentage: 11,
      notes: '',
      terms_conditions: '',
      payment_account_id: undefined,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  // Load customers (for optional dropdown)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await getCustomers({ limit: 200 })
        if (cancelled) return
        if (result.success && Array.isArray(result.data)) {
          setCustomers(
            result.data.map((c: Record<string, unknown>) => ({
              customer_id: c.customer_id as string,
              customer_name: c.customer_name as string,
              phone_number: (c.phone_number as string | null) ?? null,
              email: (c.email as string | null) ?? null,
              billing_address: (c.billing_address as string | null) ?? null,
            }))
          )
        }
      } catch (error) {
        logger.error('Error loading customers:', error)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load bank accounts (payment account dropdown)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data, error } = await supabase
          .from('invoice_configuration')
          .select('bank_accounts')
          .eq('is_active', true)
          .single()
        if (cancelled) return
        if (error) throw error
        setBankAccounts(parseBankAccounts(data?.bank_accounts))
      } catch (error) {
        logger.error('Error loading bank accounts:', error)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Watch fields for live totals
  const watchedItems = watch('items')
  const watchedDiscountAmount = watch('discount_amount')
  const watchedDiscountPercentage = watch('discount_percentage')
  const watchedTaxPercentage = watch('tax_percentage')
  const watchedCustomerId = watch('customer_id')
  const watchedPaymentAccountId = watch('payment_account_id')

  // Pre-fill customer fields when an existing customer is chosen.
  useEffect(() => {
    if (!watchedCustomerId) return
    const found = customers.find((c) => c.customer_id === watchedCustomerId)
    if (!found) return
    setValue('customer_name', found.customer_name || '')
    setValue('customer_phone', found.phone_number || '')
    setValue('customer_email', found.email || '')
    setValue('customer_address', found.billing_address || '')
  }, [watchedCustomerId, customers, setValue])

  // When a payment account is selected, snapshot label/bank/number/name + tax %
  useEffect(() => {
    if (!watchedPaymentAccountId) {
      setValue('payment_account_label', undefined)
      setValue('payment_bank_name', undefined)
      setValue('payment_account_number', undefined)
      setValue('payment_account_name', undefined)
      return
    }
    const acc = bankAccounts.find((b) => b.id === watchedPaymentAccountId)
    if (!acc) return
    setValue('payment_account_label', acc.account_label)
    setValue('payment_bank_name', acc.bank)
    setValue('payment_account_number', acc.account_number)
    setValue('payment_account_name', acc.account_name)
    if (typeof acc.tax_percentage === 'number') {
      setValue('tax_percentage', acc.tax_percentage)
    }
  }, [watchedPaymentAccountId, bankAccounts, setValue])

  const totals = useMemo(() => {
    const items = watchedItems || []
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item?.quantity) || 0
      const price = Number(item?.unit_price) || 0
      return sum + qty * price
    }, 0)
    const discountAmount = Number(watchedDiscountAmount) || 0
    const discountPercentage = Number(watchedDiscountPercentage) || 0
    const hasFixedDiscount = discountAmount > 0
    const totalDiscount = calculateDiscount(
      subtotal,
      hasFixedDiscount ? 'FIXED' : 'PERCENTAGE',
      hasFixedDiscount ? discountAmount : discountPercentage
    )
    const taxPercentage = Number(watchedTaxPercentage) || 0
    const taxableBase = Math.max(0, subtotal - totalDiscount)
    const taxAmount = calculateTax(taxableBase, taxPercentage)
    const total = taxableBase + taxAmount
    return {
      subtotal,
      totalDiscount,
      taxPercentage,
      taxAmount,
      total,
    }
  }, [watchedItems, watchedDiscountAmount, watchedDiscountPercentage, watchedTaxPercentage])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)

  const onInvalid = (formErrors: typeof errors) => {
    logger.warn('Blank invoice form validation failed:', formErrors)

    // Surface the first concrete error to the user. RHF tracks errors per
    // field path; flatten nested objects (items[i].description, etc.) and
    // pick the first message.
    const firstMessage = (() => {
      const visit = (node: unknown): string | null => {
        if (!node || typeof node !== 'object') return null
        const obj = node as Record<string, unknown>
        if (typeof obj.message === 'string' && obj.message.length > 0) {
          return obj.message
        }
        for (const key of Object.keys(obj)) {
          const found = visit(obj[key])
          if (found) return found
        }
        return null
      }
      return visit(formErrors) ?? 'Periksa kembali isian form'
    })()

    toast({
      variant: 'destructive',
      title: 'Form belum valid',
      description: firstMessage,
    })
  }

  const onSubmit = async (data: CreateBlankInvoiceInput) => {
    setIsSubmitting(true)
    try {
      // Strip empty optional strings to undefined so Zod's optional() accepts.
      const cleaned: CreateBlankInvoiceInput = {
        ...data,
        customer_id: data.customer_id || undefined,
        customer_phone: data.customer_phone?.trim() || undefined,
        customer_email: data.customer_email?.trim() || undefined,
        customer_address: data.customer_address?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        terms_conditions: data.terms_conditions?.trim() || undefined,
      }

      const result = await createBlankInvoice(cleaned)
      if (!result.success) {
        throw new Error(result.error)
      }

      const created = result.data
      toast({
        title: 'Berhasil',
        description: `Invoice ${created.invoice_number} berhasil dibuat`,
      })
      router.push(`/dashboard/keuangan/invoices/${created.invoice_id}`)
    } catch (error: unknown) {
      logger.error('Error creating blank invoice:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Gagal membuat invoice',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buat Invoice Kosong</h1>
          <p className="text-muted-foreground">
            Buat invoice manual tanpa menautkan ke transaksi/order
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 pb-6">
        {/* Customer */}
        <Card>
          <CardHeader>
            <CardTitle>Pelanggan</CardTitle>
            <CardDescription>
              Pilih pelanggan terdaftar atau isi data pelanggan secara manual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pelanggan Terdaftar (Opsional)</Label>
              <SearchableSelect
                options={[
                  { id: 'none', label: '— Tanpa Pelanggan Terdaftar —' },
                  ...customers.map((c) => ({
                    id: c.customer_id,
                    label: c.customer_name,
                    secondaryLabel: c.phone_number || undefined,
                  })),
                ]}
                value={watchedCustomerId || 'none'}
                onValueChange={(value) =>
                  setValue('customer_id', value === 'none' ? undefined : value, {
                    shouldValidate: true,
                  })
                }
                placeholder="Pilih pelanggan terdaftar (opsional)"
                searchPlaceholder="Cari pelanggan..."
              />
              <p className="text-xs text-muted-foreground">
                Memilih pelanggan akan mengisi otomatis kolom di bawah. Jika tidak dipilih,
                isi manual.
              </p>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">
                  Nama Pelanggan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customer_name"
                  placeholder="Nama pelanggan"
                  {...register('customer_name')}
                />
                {errors.customer_name && (
                  <p className="text-sm text-destructive">{errors.customer_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">No. Telepon</Label>
                <Input
                  id="customer_phone"
                  placeholder="08xxxxxxxxxx"
                  {...register('customer_phone')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  placeholder="email@domain.com"
                  {...register('customer_email')}
                />
                {errors.customer_email && (
                  <p className="text-sm text-destructive">{errors.customer_email.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="customer_address">Alamat</Label>
                <Textarea
                  id="customer_address"
                  rows={2}
                  placeholder="Alamat penagihan"
                  {...register('customer_address')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice meta */}
        <Card>
          <CardHeader>
            <CardTitle>Detail Invoice</CardTitle>
            <CardDescription>Tipe, tanggal, dan nomor invoice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nomor Invoice</Label>
                <Input value="(akan dibuat otomatis)" readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label>Tipe Invoice</Label>
                <Select
                  value={watch('invoice_type')}
                  onValueChange={(value: 'FINAL' | 'PROFORMA') =>
                    setValue('invoice_type', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FINAL">FINAL</SelectItem>
                    <SelectItem value="PROFORMA">PROFORMA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_date">Tanggal Invoice</Label>
                <Input id="invoice_date" type="date" {...register('invoice_date')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">
                  Jatuh Tempo <span className="text-destructive">*</span>
                </Label>
                <Input id="due_date" type="date" {...register('due_date')} />
                {errors.due_date && (
                  <p className="text-sm text-destructive">{errors.due_date.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Item Invoice</CardTitle>
                <CardDescription>Tambahkan minimal satu item</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    item_type: 'BASE_SERVICE',
                    description: '',
                    quantity: 1,
                    unit_price: 0,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Belum ada item. Klik &quot;Tambah Item&quot;.
              </p>
            )}

            {fields.map((field, index) => {
              const qty = Number(watchedItems?.[index]?.quantity) || 0
              const price = Number(watchedItems?.[index]?.unit_price) || 0
              const lineTotal = qty * price

              return (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border p-4 md:grid-cols-12"
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Tipe</Label>
                    <Select
                      value={watch(`items.${index}.item_type`)}
                      onValueChange={(value: 'BASE_SERVICE' | 'ADDON') =>
                        setValue(`items.${index}.item_type`, value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASE_SERVICE">Layanan</SelectItem>
                        <SelectItem value="ADDON">Add-on</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 md:col-span-5">
                    <Label className="text-xs">Deskripsi</Label>
                    <Input
                      placeholder="Deskripsi item"
                      {...register(`items.${index}.description` as const)}
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-xs text-destructive">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      {...register(`items.${index}.quantity` as const, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-xs text-destructive">
                        {errors.items[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Harga Satuan</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...register(`items.${index}.unit_price` as const, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.items?.[index]?.unit_price && (
                      <p className="text-xs text-destructive">
                        {errors.items[index]?.unit_price?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-xs">Subtotal</Label>
                    <div className="flex h-9 items-center text-sm font-medium">
                      {formatCurrency(lineTotal)}
                    </div>
                  </div>

                  <div className="flex items-end md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {errors.items && typeof errors.items.message === 'string' && (
              <p className="text-sm text-destructive">{errors.items.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Adjustments + payment + summary */}
        <Card>
          <CardHeader>
            <CardTitle>Penyesuaian & Pembayaran</CardTitle>
            <CardDescription>Diskon, pajak, dan rekening pembayaran</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Diskon Nominal (Rp)</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  min="0"
                  step="1"
                  {...register('discount_amount', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_percentage">Diskon Persen (%)</Label>
                <Input
                  id="discount_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...register('discount_percentage', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_percentage">PPN (%)</Label>
                <Input
                  id="tax_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...register('tax_percentage', { valueAsNumber: true })}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Rekening Pembayaran (Opsional)</Label>
              {bankAccounts.length > 3 ? (
                <SearchableSelect
                  options={[
                    { id: 'none', label: '— Tanpa Rekening —' },
                    ...bankAccounts.map((acc) => ({
                      id: acc.id,
                      label: acc.account_label,
                      secondaryLabel: `${acc.bank} ${acc.account_number}`,
                    })),
                  ]}
                  value={watchedPaymentAccountId || 'none'}
                  onValueChange={(value) =>
                    setValue(
                      'payment_account_id',
                      value === 'none' ? undefined : value,
                      { shouldValidate: true }
                    )
                  }
                  placeholder="Pilih rekening (opsional)"
                  searchPlaceholder="Cari rekening..."
                />
              ) : (
                <Select
                  value={watchedPaymentAccountId || 'none'}
                  onValueChange={(value) =>
                    setValue(
                      'payment_account_id',
                      value === 'none' ? undefined : value,
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih rekening (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tanpa Rekening —</SelectItem>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_label} · {acc.bank} {acc.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea id="notes" rows={3} placeholder="Catatan tambahan" {...register('notes')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_conditions">Syarat & Ketentuan</Label>
              <Textarea
                id="terms_conditions"
                rows={3}
                placeholder="Kosongkan untuk memakai template default"
                {...register('terms_conditions')}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Diskon</span>
                <span className="font-semibold text-red-600">
                  - {formatCurrency(totals.totalDiscount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>PPN ({totals.taxPercentage}%)</span>
                <span className="font-semibold">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
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
      </form>
    </div>
  )
}

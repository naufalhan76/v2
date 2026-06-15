'use client'

import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-state'

import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { CreateBlankInvoiceSchema, type CreateBlankInvoiceInput } from '@/app/api/schemas'
import { createBlankInvoice } from '@/lib/actions/invoices'
import { calculateDiscount, calculateTax } from '@/lib/utils/money'
import type { Invoice } from '@/types/invoices'
import type { InvoiceTotals } from './_components/types'
import { useBlankInvoiceData } from './_components/use-blank-invoice-data'
import { CustomerSelector } from './_components/customer-selector'
import { LineItemsEditor } from './_components/line-items-editor'
import { BlankInvoiceForm } from './_components/blank-invoice-form'
import { InvoicePreview } from './_components/invoice-preview'
import { InvoiceMeta } from './_components/invoice-meta'
import { FormActions } from './_components/form-actions'
import { PageHeader } from './_components/page-header'

export default function CreateBlankInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null)
  const { customers, bankAccounts } = useBlankInvoiceData()

  const getTodayISO = () => new Date().toISOString().split('T')[0]
  const getDefaultDueISO = () => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  }

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } =
    useForm<CreateBlankInvoiceInput>({
      resolver: zodResolver(CreateBlankInvoiceSchema),
      defaultValues: {
        invoice_type: 'FINAL' as const, customer_id: undefined, customer_name: '',
        customer_phone: '', customer_email: '', customer_address: '', invoice_date: '',
        due_date: '', items: [{ item_type: 'BASE_SERVICE' as const, description: '', quantity: 1, unit_price: 0 }],
        discount_amount: 0, discount_percentage: 0, tax_percentage: 11,
        notes: '', terms_conditions: '', payment_account_id: undefined,
      },
    })

  useEffect(() => { setValue('invoice_date', getTodayISO()); setValue('due_date', getDefaultDueISO()) }, [setValue])

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchedItems = watch('items')
  const watchedDiscountAmount = watch('discount_amount')
  const watchedDiscountPercentage = watch('discount_percentage')
  const watchedTaxPercentage = watch('tax_percentage')
  const watchedCustomerId = watch('customer_id')
  const watchedPaymentAccountId = watch('payment_account_id')

  useEffect(() => {
    if (!watchedCustomerId) return
    const found = customers.find((c) => c.customer_id === watchedCustomerId)
    if (!found) return
    setValue('customer_name', found.customer_name || '')
    setValue('customer_phone', found.phone_number || '')
    setValue('customer_email', found.email || '')
    setValue('customer_address', found.billing_address || '')
  }, [watchedCustomerId, customers, setValue])

  useEffect(() => {
    if (!watchedPaymentAccountId) {
      setValue('payment_account_label', undefined); setValue('payment_bank_name', undefined)
      setValue('payment_account_number', undefined); setValue('payment_account_name', undefined)
      return
    }
    const acc = bankAccounts.find((b) => b.id === watchedPaymentAccountId)
    if (!acc) return
    setValue('payment_account_label', acc.account_label); setValue('payment_bank_name', acc.bank)
    setValue('payment_account_number', acc.account_number); setValue('payment_account_name', acc.account_name)
    if (typeof acc.tax_percentage === 'number') setValue('tax_percentage', acc.tax_percentage)
  }, [watchedPaymentAccountId, bankAccounts, setValue])

  const totals: InvoiceTotals = useMemo(() => {
    const items = watchedItems || []
    const subtotal = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0), 0)
    const discountAmount = Number(watchedDiscountAmount) || 0
    const discountPercentage = Number(watchedDiscountPercentage) || 0
    const hasFixedDiscount = discountAmount > 0
    const totalDiscount = calculateDiscount(subtotal, hasFixedDiscount ? 'FIXED' : 'PERCENTAGE', hasFixedDiscount ? discountAmount : discountPercentage)
    const taxPercentage = Number(watchedTaxPercentage) || 0
    const taxableBase = Math.max(0, subtotal - totalDiscount)
    return { subtotal, totalDiscount, taxPercentage, taxAmount: calculateTax(taxableBase, taxPercentage), total: taxableBase + calculateTax(taxableBase, taxPercentage) }
  }, [watchedItems, watchedDiscountAmount, watchedDiscountPercentage, watchedTaxPercentage])

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const onInvalid = (formErrors: typeof errors) => {
    logger.warn('Blank invoice form validation failed:', formErrors)
    const visit = (node: unknown): string | null => {
      if (!node || typeof node !== 'object') return null
      const obj = node as Record<string, unknown>
      if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message
      for (const key of Object.keys(obj)) { const found = visit(obj[key]); if (found) return found }
      return null
    }
    toast({ variant: 'destructive', title: 'Form belum valid', description: visit(formErrors) ?? 'Periksa kembali isian form' })
  }

  const onSubmit = async (data: CreateBlankInvoiceInput) => {
    setIsSubmitting(true)
    try {
      const cleaned: CreateBlankInvoiceInput = {
        ...data, customer_id: data.customer_id || undefined,
        customer_phone: data.customer_phone?.trim() || undefined,
        customer_email: data.customer_email?.trim() || undefined,
        customer_address: data.customer_address?.trim() || undefined,
        notes: data.notes?.trim() || undefined, terms_conditions: data.terms_conditions?.trim() || undefined,
      }
      const result = await createBlankInvoice(cleaned)
      if (!result.success) throw new Error(result.error)
      toast({ title: 'Berhasil', description: `Invoice ${result.data.invoice_number} berhasil dibuat` })
      setCreatedInvoice(result.data)
    } catch (error: unknown) {
      logger.error('Error creating blank invoice:', error)
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Gagal membuat invoice' })
    } finally { setIsSubmitting(false) }
  }

  return (
    <LoadingOverlay isLoading={isSubmitting} message="Membuat blank invoice..." fullscreen autoFocus>
      <div className="space-y-6">
        <PageHeader onBack={() => router.back()} />

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 pb-6">
          <Card>
            <CardHeader><CardTitle>Pelanggan</CardTitle><CardDescription>Pilih pelanggan terdaftar atau isi data pelanggan secara manual</CardDescription></CardHeader>
            <CardContent>
              <CustomerSelector customers={customers} watchedCustomerId={watchedCustomerId} errors={errors} register={register} setValue={setValue} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detail Invoice</CardTitle><CardDescription>Tipe, tanggal, dan nomor invoice</CardDescription></CardHeader>
            <CardContent><InvoiceMeta register={register} setValue={setValue} watch={watch} errors={errors} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle>Item Invoice</CardTitle><CardDescription>Tambahkan minimal satu item</CardDescription></div>
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]" onClick={() => append({ item_type: 'BASE_SERVICE', description: '', quantity: 1, unit_price: 0 })}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <LineItemsEditor fields={fields} watchedItems={watchedItems} errors={errors} register={register} setValue={setValue} watch={watch} append={append} remove={remove} formatCurrency={formatCurrency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Penyesuaian & Pembayaran</CardTitle><CardDescription>Diskon, pajak, dan rekening pembayaran</CardDescription></CardHeader>
            <CardContent className="pt-6">
              <BlankInvoiceForm watchedPaymentAccountId={watchedPaymentAccountId} bankAccounts={bankAccounts} totals={totals} register={register} setValue={setValue} formatCurrency={formatCurrency} />
            </CardContent>
          </Card>

          <FormActions isSubmitting={isSubmitting} onCancel={() => router.back()} />
        </form>

        <InvoicePreview createdInvoice={createdInvoice} onOpenChange={(open) => { if (!open) setCreatedInvoice(null) }} onStay={() => setCreatedInvoice(null)} onViewDetail={(id) => router.push(`/dashboard/keuangan/invoices/${id}`)} formatCurrency={formatCurrency} />
      </div>
    </LoadingOverlay>
  )
}

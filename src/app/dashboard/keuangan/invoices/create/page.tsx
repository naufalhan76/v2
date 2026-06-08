'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useToast } from '@/hooks/use-toast'
import { getServicePricingByType } from '@/lib/actions/service-pricing'
import { getActiveAddons, type Addon } from '@/lib/actions/addons'
import { createInvoice } from '@/lib/actions/invoices'
import type { BankAccount } from '@/lib/bank-accounts'
import { logger } from '@/lib/logger'
import type { LineItem } from './line-items'
import { useInvoiceForm } from './use-invoice-form'
import type { InvoiceOrder, InvoiceType } from './invoice-reducer'
import { fetchAvailableInvoiceOrders, fetchBaseServiceLineItems, fetchConfiguredBankAccounts } from './invoice-data'
import { buildCreateInvoicePayload, calculateInvoiceTotals } from './invoice-submit'
import { InvoiceFormShell } from './_components/invoice-form-shell'
import { OrderSelectionStep } from './_components/order-selection-step'
import { BaseServiceStep } from './_components/base-service-step'
import { AddOnsStep } from './_components/add-ons-step'
import { ReviewSubmitStep } from './_components/review-submit-step'
import type { InvoiceFormData } from './_components/types'

const invoiceSchema = z.object({ orderId: z.string().min(1, 'Order wajib dipilih'), paymentAccountId: z.string().min(1, 'Payment account wajib dipilih'), dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'), discountAmount: z.string().optional(), discountPercentage: z.string().optional(), notes: z.string().optional() })

type InvoiceSchemaData = z.infer<typeof invoiceSchema>

const _invoiceFormDataCheck: InvoiceSchemaData extends InvoiceFormData ? true : never = true

const isInvoiceType = (value: string | null): value is InvoiceType => value === 'PROFORMA' || value === 'FINAL'

export default function CreateInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    state: {
      step: currentStep,
      selectedOrder,
      baseService,
      lineItems,
      prefillDefaults: { requestedInvoiceType, message: prefillMessage },
    },
    actions: invoiceActions,
    selectedAddon,
    addonQuantity,
  } = useInvoiceForm()
  const [isLoading, setIsLoading] = useState(false)
  const { data: orders = [] } = useQuery<InvoiceOrder[]>({
    queryKey: ['create-invoice', 'orders'],
    queryFn: fetchAvailableInvoiceOrders,
  })
  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ['create-invoice', 'addons'],
    queryFn: getActiveAddons,
  })
  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['create-invoice', 'bank-accounts'],
    queryFn: fetchConfiguredBankAccounts,
  })

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { discountAmount: '0', discountPercentage: '0' },
  })

  const selectOrder = useCallback((orderId: string, orderList: InvoiceOrder[] = orders): boolean => {
    const order = orderList.find((o) => o.order_id === orderId)
    if (!order) return false

    invoiceActions.selectOrder(order)
    setValue('orderId', orderId)
    return true
  }, [invoiceActions, orders, setValue])

  const loadServicePricing = useCallback(async () => {
    if (!selectedOrder) return

    try {
      const pricing = await fetchBaseServiceLineItems(selectedOrder)
      invoiceActions.setLineItems(pricing.lineItems)
      if (pricing.baseService) invoiceActions.setBaseService(pricing.baseService)
      if (pricing.serviceTypeForHeader) {
        getServicePricingByType(pricing.serviceTypeForHeader)
          .then((firstPricing) => {
            if (firstPricing) invoiceActions.setBaseService(firstPricing)
          })
          .catch(() => {
            /* header is best-effort; line items already rendered */
          })
      }
    } catch (error) {
      logger.error('Error loading service pricing:', error)
    }
  }, [invoiceActions, selectedOrder])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order_id') || params.get('orderId')
    const invoiceType = params.get('type')

    if (isInvoiceType(invoiceType)) invoiceActions.prefillFromOrder(null, invoiceType, null)

    if (!orderId) return

    const isSelected = selectOrder(orderId, orders)
    if (isSelected) {
      invoiceActions.prefillFromOrder(
        orders.find((order) => order.order_id === orderId) ?? null,
        isInvoiceType(invoiceType) ? invoiceType : null,
        'Order and invoice type were prefilled from the create-order flow.'
      )
    } else {
      invoiceActions.prefillFromOrder(
        null,
        isInvoiceType(invoiceType) ? invoiceType : null,
        'The order from the URL is not available for invoice creation or already has an invoice.'
      )
    }
  }, [invoiceActions, orders, selectOrder])

  useEffect(() => {
    if (selectedOrder) loadServicePricing()
  }, [loadServicePricing, selectedOrder])

  const handleOrderSelect = (orderId: string) => selectOrder(orderId)

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

    invoiceActions.addLineItem(newItem, true)
  }

  const handleRemoveItem = (index: number) => invoiceActions.removeLineItem(index)

  const handleUpdateQuantity = (index: number, quantity: number) => invoiceActions.updateLineItem(index, { quantity })

  const handleUpdatePrice = (index: number, price: number) => invoiceActions.updateLineItem(index, { unitPrice: price })

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

      const selectedBankAccount = bankAccounts.find(acc => acc.id === data.paymentAccountId)
      if (!selectedBankAccount) {
        throw new Error('Payment account tidak ditemukan')
      }

      const { payload, invoiceType } = buildCreateInvoicePayload({
        data,
        selectedOrder,
        lineItems,
        baseService,
        selectedBankAccount,
      })

      await createInvoice(payload)

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

  const paymentAccountId = watch('paymentAccountId') || ''
  const totals = calculateInvoiceTotals({
    lineItems,
    discountAmount: watch('discountAmount') || '0',
    discountPercentage: watch('discountPercentage') || '0',
    selectedBankAccount: bankAccounts.find((acc) => acc.id === paymentAccountId),
  })

  return <InvoiceFormShell currentStep={currentStep} onBack={() => router.back()}>
    <form onSubmit={handleSubmit(onSubmit)}>
      {currentStep === 1 && <OrderSelectionStep
        orders={orders}
        selectedOrder={selectedOrder}
        requestedInvoiceType={requestedInvoiceType}
        prefillMessage={prefillMessage}
        orderId={watch('orderId') || ''}
        orderError={errors.orderId?.message}
        onOrderSelect={handleOrderSelect}
        onNext={invoiceActions.nextStep}
      />}
      {currentStep === 2 && <BaseServiceStep
        baseService={baseService}
        lineItems={lineItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdatePrice={handleUpdatePrice}
        onPrevious={invoiceActions.prevStep}
        onNext={invoiceActions.nextStep}
      />}
      {currentStep === 3 && <AddOnsStep
        addons={addons}
        selectedAddon={selectedAddon}
        addonQuantity={addonQuantity}
        lineItems={lineItems}
        onSelectedAddonChange={invoiceActions.setSelectedAddon}
        onAddonQuantityChange={invoiceActions.setSelectedAddonQuantity}
        onAddAddon={handleAddAddon}
        onRemoveItem={handleRemoveItem}
        onPrevious={invoiceActions.prevStep}
        onNext={invoiceActions.nextStep}
      />}
      {currentStep === 4 && <ReviewSubmitStep
        bankAccounts={bankAccounts}
        paymentAccountId={paymentAccountId}
        totals={totals}
        errors={errors}
        register={register}
        setValue={setValue}
        isLoading={isLoading}
        onPrevious={invoiceActions.prevStep}
      />}
    </form>
  </InvoiceFormShell>
}

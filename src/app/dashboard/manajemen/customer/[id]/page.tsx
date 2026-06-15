'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

import { useToast } from '@/hooks/use-toast'

import { getCustomerById } from '@/lib/actions/customers'
import { OrderDetailPanel } from '@/components/orders/order-detail-panel'

import { useCustomerDetail } from './_hooks/use-customer-detail'
import { CustomerInfoCard, DetailTab } from './_components/customer-info-card'
import { LocationsTab } from './_components/locations-tab'
import { AcUnitsTab } from './_components/ac-units-tab'
import { OrdersTab } from './_components/orders-tab'
import { CustomerEditSheet } from './_components/customer-edit-sheet'
import type { Customer } from '@/types/customers'

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const customerId = params.id

  const customerQueryKey = ['customer-detail', customerId] as const

  const {
    data: customerResult,
    isLoading: isLoadingCustomer,
    isError: isCustomerError,
  } = useQuery({
    queryKey: customerQueryKey,
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId,
  })

  const customer = (customerResult?.success ? (customerResult.data as Customer) : null)

  const {
    customerForm,
    setCustomerForm,
    isEditCustomerOpen,
    isSavingCustomer,
    selectedOrderId,
    orderPanelOpen,
    handleOpenEditCustomer,
    setIsEditCustomerOpen,
    handleSaveCustomer,
    setSelectedOrderId,
    setOrderPanelOpen,
  } = useCustomerDetail(customerId)

  if (isLoadingCustomer) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full sm:w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isCustomerError || !customer) {
    return (
      <div className="p-4 sm:p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <EmptyState
          icon={User}
          title="Customer tidak ditemukan"
          description="Customer yang dicari tidak tersedia atau telah dihapus."
        />
      </div>
    )
  }

  return (
    <>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mt-1 flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{customer.customer_name}</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">Detail customer & riwayat layanan</p>
            </div>
          </div>
          <Button onClick={() => handleOpenEditCustomer(customer)} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>

        {/* Summary Card */}
        <CustomerInfoCard customer={customer} onEdit={() => handleOpenEditCustomer(customer)} />

        {/* Tabs */}
        <Tabs defaultValue="detail" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <TabsList className="inline-flex w-auto sm:grid sm:w-full sm:grid-cols-4 sm:max-w-2xl">
              <TabsTrigger value="detail">Detail</TabsTrigger>
              <TabsTrigger value="lokasi">Lokasi</TabsTrigger>
              <TabsTrigger value="ac-units">AC Units</TabsTrigger>
              <TabsTrigger value="orders">Riwayat Order</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="detail">
            <DetailTab customer={customer} onEdit={() => handleOpenEditCustomer(customer)} />
          </TabsContent>
          <TabsContent value="lokasi">
            <LocationsTab customerId={customerId} />
          </TabsContent>
          <TabsContent value="ac-units">
            <AcUnitsTab customerId={customerId} />
          </TabsContent>
          <TabsContent value="orders">
            <OrdersTab
              customerId={customerId}
              onOpenOrder={(orderId) => {
                setSelectedOrderId(orderId)
                setOrderPanelOpen(true)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <CustomerEditSheet
        customerId={customerId}
        open={isEditCustomerOpen}
        onOpenChange={setIsEditCustomerOpen}
        form={customerForm}
        onFormChange={setCustomerForm}
        isSaving={isSavingCustomer}
        onSave={(e) => handleSaveCustomer(e, customerId, customerForm, customerQueryKey)}
      />

      <OrderDetailPanel
        orderId={selectedOrderId}
        open={orderPanelOpen}
        onOpenChange={(open) => {
          setOrderPanelOpen(open)
          if (!open) setSelectedOrderId(null)
        }}
      />
    </>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/orders/status-badge'
import { OrderDetailTab, type OrderDetailData } from '@/components/orders/order-detail-tab'
import { OrderReportTab } from '@/components/orders/order-report-tab'
import { OrderInvoiceTab } from '@/components/orders/order-invoice-tab'
import { OrderHistoryTab } from '@/components/orders/order-history-tab'
import { AssignModal } from '@/components/orders/assign-modal'
import { RescheduleModal } from '@/components/orders/reschedule-modal'
import { CancelModal } from '@/components/orders/cancel-modal'
import { getOrderById } from '@/lib/actions/orders'
import { toCanonical } from '@/lib/order-status'

interface OrderDetailPanelProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailPanel({ orderId, open, onOpenChange }: OrderDetailPanelProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => (orderId ? getOrderById(orderId) : Promise.resolve(null)),
    enabled: !!orderId && open,
  })

  const order = (data?.data ?? null) as OrderDetailData | null
  const canonical = order ? toCanonical(order.status) : null

  const currentLeadFromTechnicians =
    order?.order_technicians?.find((ot) => ot.role === 'lead')?.technician_id ?? null
  const currentTechnicianId =
    order?.assigned_technician_id ?? currentLeadFromTechnicians ?? null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto flex flex-col">
          {isLoading || !order ? (
            <>
              <SheetHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </SheetHeader>
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="space-y-1">
                    <SheetTitle className="text-base">{order.order_id}</SheetTitle>
                    <SheetDescription>
                      {order.customers?.customer_name ?? 'Customer'}
                    </SheetDescription>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </SheetHeader>

              <Tabs defaultValue="detail" className="flex-1 flex flex-col mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="detail">Detail</TabsTrigger>
                  <TabsTrigger value="report">Report</TabsTrigger>
                  <TabsTrigger value="invoice">Invoice</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <div className="flex-1 mt-4 overflow-y-auto">
                  <TabsContent value="detail" className="mt-0">
                    <OrderDetailTab order={order} />
                  </TabsContent>
                  <TabsContent value="report" className="mt-0">
                    <OrderReportTab orderId={order.order_id} />
                  </TabsContent>
                  <TabsContent value="invoice" className="mt-0">
                    <OrderInvoiceTab
                      orderId={order.order_id}
                      orderStatus={order.status}
                      onCreateInvoice={() => {
                        window.location.href = `/dashboard/keuangan/invoices/create/from-order/${order.order_id}`
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="history" className="mt-0">
                    <OrderHistoryTab orderId={order.order_id} />
                  </TabsContent>
                </div>
              </Tabs>

              <SheetFooter className="flex-row gap-2 border-t pt-4 mt-2">
                {canonical === 'PENDING' && (
                  <>
                    <Button onClick={() => setAssignOpen(true)} className="flex-1">
                      Assign Teknisi
                    </Button>
                    <Button variant="outline" onClick={() => setCancelOpen(true)}>
                      Batalkan
                    </Button>
                  </>
                )}
                {canonical === 'ASSIGNED' && (
                  <>
                    <Button onClick={() => setAssignOpen(true)} variant="outline" className="flex-1">
                      Reassign
                    </Button>
                    <Button onClick={() => setRescheduleOpen(true)} variant="outline">
                      Reschedule
                    </Button>
                    <Button onClick={() => setCancelOpen(true)} variant="ghost">
                      Batalkan
                    </Button>
                  </>
                )}
                {(canonical === 'EN_ROUTE' || canonical === 'IN_PROGRESS') && (
                  <Button variant="outline" disabled className="flex-1">
                    Sedang dikerjakan teknisi
                  </Button>
                )}
                {canonical === 'COMPLETED' && (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices/create/from-order/${order.order_id}`}>
                      Buat Invoice
                    </Link>
                  </Button>
                )}
                {canonical === 'INVOICED' && (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices?orderId=${order.order_id}`}>
                      Catat Pembayaran
                    </Link>
                  </Button>
                )}
                {canonical === 'PAID' && (
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/dashboard/keuangan/invoices?orderId=${order.order_id}`}>
                      Lihat Invoice
                    </Link>
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AssignModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        orderIds={orderId ? [orderId] : []}
        defaultDate={order?.scheduled_visit_date}
        currentTechnicianId={canonical === 'ASSIGNED' ? currentTechnicianId : null}
      />
      <RescheduleModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        orderId={orderId}
        defaultDate={order?.scheduled_visit_date}
      />
      <CancelModal open={cancelOpen} onOpenChange={setCancelOpen} orderId={orderId} />
    </>
  )
}

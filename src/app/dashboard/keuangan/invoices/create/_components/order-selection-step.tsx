'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatPhone } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

import type { OrderSelectionStepProps } from './types'

export function OrderSelectionStep({
  orders,
  selectedOrder,
  requestedInvoiceType,
  prefillMessage,
  orderId,
  orderError,
  onOrderSelect,
  onNext,
}: OrderSelectionStepProps) {
  return (
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
          <div className="space-y-2">
            <Label>Order</Label>
            {orders.length > 3 ? (
              <SearchableSelect
                options={orders.map((order) => ({
                  id: order.order_id,
                  label: `${order.order_id} — ${order.customers?.customer_name ?? '-'}`,
                  secondaryLabel: `${order.order_type} · ${order.status}`,
                }))}
                value={orderId}
                onValueChange={onOrderSelect}
                placeholder="Pilih order"
                searchPlaceholder="Cari order / customer..."
              />
            ) : (
              <Select value={orderId} onValueChange={onOrderSelect}>
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
            {orderError && <p className="text-sm text-destructive">{orderError}</p>}
          </div>
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
            onClick={onNext}
            disabled={!selectedOrder}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Lanjut <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

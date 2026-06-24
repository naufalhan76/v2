import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, ClipboardList, Eye } from 'lucide-react'
import { getOrders } from '@/lib/actions/orders'
import { StatusBadge } from '@/components/orders/status-badge'
import { formatDateOnly, orderTotal } from './helpers'
import { formatCurrency } from '@/lib/format'
import type { OrderRow } from '@/types/customers'

interface OrdersTabProps {
  customerId: string
  onOpenOrder: (orderId: string) => void
}

export function OrdersTab({ customerId, onOpenOrder }: OrdersTabProps) {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => getOrders({ customerId, limit: 100 }),
  })

  const orders = (data?.success ? (data.data as OrderRow[]) : []) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Order ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada order"
            description="Customer ini belum memiliki order. Order akan muncul di sini setelah dibuat."
            action={{
              label: 'Buat Order',
              icon: Plus,
              onClick: () => {
                router.push(`/dashboard/orders/new?customerId=${customerId}`)
              },
            }}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => {
                const dateStr = order.scheduled_visit_date ?? order.req_visit_date ?? order.created_at
                return (
                  <div
                    key={order.order_id}
                    className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => onOpenOrder(order.order_id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs break-all">{order.order_id}</p>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatDateOnly(dateStr)}</span>
                      <span className="font-mono font-medium">{formatCurrency(orderTotal(order))}</span>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenOrder(order.order_id)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        Lihat Detail
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block data-table-container overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Total Estimasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const dateStr = order.scheduled_visit_date ?? order.req_visit_date ?? order.created_at
                    return (
                      <TableRow
                        key={order.order_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onOpenOrder(order.order_id)}
                      >
                        <TableCell className="font-mono text-xs">{order.order_id}</TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell>{formatDateOnly(dateStr)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(orderTotal(order))}
                        </TableCell>
                        <TableCell className="text-right w-[100px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenOrder(order.order_id)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

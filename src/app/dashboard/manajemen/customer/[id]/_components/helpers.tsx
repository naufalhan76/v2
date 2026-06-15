import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { OrderRow } from '@/types/customers'

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return format(d, 'd MMM yyyy', { locale: localeId })
}

export function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ACTIVE: 'default',
    RETIRED: 'secondary',
    INACTIVE: 'destructive',
  }
  return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
}

export function orderTotal(order: OrderRow): number {
  return (order.order_items ?? []).reduce((sum, item) => {
    return sum + (item.actual_price ?? item.estimated_price ?? 0)
  }, 0)
}

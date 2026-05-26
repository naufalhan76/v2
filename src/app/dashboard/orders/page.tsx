import { Suspense } from 'react'
import { OrdersPageClient } from '@/components/orders/orders-page-client'

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageClient />
    </Suspense>
  )
}

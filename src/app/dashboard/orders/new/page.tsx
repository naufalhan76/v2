'use client'

import { CreateOrderPage } from '@/app/dashboard/operasional/create-order/page'

/**
 * Phase 1: thin re-export of the existing create-order flow under the new /dashboard/orders/new
 * URL. Phase 3 will replace this with a fully refactored single-page accordion form.
 */
export default function NewOrderPage() {
  return <CreateOrderPage />
}

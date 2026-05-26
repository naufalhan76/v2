import { redirect } from 'next/navigation'

/**
 * Phase 1 placeholder: /dashboard/orders/new redirects to the existing
 * create-order flow at /dashboard/operasional/create-order.
 *
 * Phase 3 will replace this with a fully refactored single-page accordion form
 * inlined here. For staging, the redirect keeps both URLs working.
 */
export default function NewOrderPage() {
  redirect('/dashboard/operasional/create-order')
}

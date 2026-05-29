import { type Page } from '@playwright/test'

/**
 * Finds the first assigned order for the authenticated technician by calling
 * GET /api/technician/jobs/today. Returns the order_id string or null when
 * no orders are available (endpoint error, empty list, or unexpected shape).
 *
 * Used by api-contract.spec.ts to skip idempotency tests gracefully when
 * there is no real order to exercise the transition path against.
 */
export async function findAssignedOrder(page: Page): Promise<string | null> {
  try {
    const response = await page.request.get('/api/technician/jobs/today')
    if (!response.ok()) return null

    const body = await response.json()

    // Handle { success: true, data: [...] } or a bare array
    const orders: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : []

    if (orders.length === 0) return null

    const first = orders[0] as Record<string, unknown>
    const id = first.order_id ?? first.id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

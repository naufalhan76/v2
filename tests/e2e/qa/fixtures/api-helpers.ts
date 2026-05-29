/**
 * Direct API helpers — short-circuit setup steps so specs can focus on the
 * scenario under test. Each helper uses an authenticated Playwright page's
 * cookie context (request fixture) to call the route as a real user.
 */

import type { APIRequestContext, Page } from '@playwright/test'
import type { OrderStatus } from '@/lib/order-status'

export async function adminAssignOrder(
  request: APIRequestContext,
  orderId: string,
  leadTechnicianId: string
): Promise<void> {
  const res = await request.patch(`/api/orders/${orderId}`, {
    data: { status: 'ASSIGNED', assigned_technician_id: leadTechnicianId },
  })
  if (!res.ok()) {
    throw new Error(
      `[qa] adminAssignOrder failed: ${res.status()} ${await res.text()}`
    )
  }
}

export async function adminCancelOrder(
  request: APIRequestContext,
  orderId: string,
  reason = 'QA test'
): Promise<void> {
  const res = await request.patch(`/api/orders/${orderId}`, {
    data: { status: 'CANCELLED', cancellation_reason: reason },
  })
  if (!res.ok()) {
    throw new Error(
      `[qa] adminCancelOrder failed: ${res.status()} ${await res.text()}`
    )
  }
}

export async function technicianTransition(
  request: APIRequestContext,
  orderId: string,
  toStatus: OrderStatus,
  options: {
    idempotencyKey?: string
    gps?: {
      lat?: number | null
      lng?: number | null
      accuracy_m?: number | null
      captured_at?: string | null
      gps_error?: string | null
    } | null
  } = {}
): Promise<{ status: number; body: unknown }> {
  const res = await request.post(
    `/api/technician/jobs/${orderId}/transition`,
    {
      data: {
        to_status: toStatus,
        idempotency_key:
          options.idempotencyKey ?? crypto.randomUUID(),
        gps: options.gps ?? null,
      },
    }
  )
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}

export async function technicianSubmitReport(
  request: APIRequestContext,
  orderId: string,
  payload: {
    idempotencyKey: string
    photosBefore: string[]
    photosAfter: string[]
    customerSignatureUrl: string
    customerNameSigned: string
    actualTotalPrice: number
    materials?: Array<{
      addon_id?: string | null
      name: string
      qty: number
      unit_price: number
      total: number
    }>
    acUnits?: Array<Record<string, unknown>>
    notes?: string
    nextServiceRecommendationDate?: string | null
  }
): Promise<{ status: number; body: unknown }> {
  const res = await request.post(`/api/technician/jobs/${orderId}/report`, {
    data: {
      idempotency_key: payload.idempotencyKey,
      photos_before: payload.photosBefore,
      photos_after: payload.photosAfter,
      customer_signature_url: payload.customerSignatureUrl,
      customer_name_signed: payload.customerNameSigned,
      actual_total_price: payload.actualTotalPrice,
      materials: payload.materials ?? [],
      ac_units: payload.acUnits ?? [],
      notes: payload.notes ?? '',
      next_service_recommendation_date:
        payload.nextServiceRecommendationDate ?? null,
    },
  })
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}

export async function getJobsToday(
  page: Page
): Promise<Array<{ order_id: string; status: string }>> {
  const res = await page.request.get('/api/technician/jobs/today')
  if (!res.ok()) return []
  const body = await res.json().catch(() => ({}))
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { getSupabaseAdmin } from './fixtures/env'
import { toCanonical } from '@/lib/order-status'

type Violation = {
  invariant: string
  orderId: string
  detail: string
}

const KNOWN_STATUSES = new Set([
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED',
  'NEW',
  'ACCEPTED',
  'EN ROUTE',
  'ARRIVED',
  'DONE',
  'CLOSED',
  'RESCHEDULE',
  'TO_WORKSHOP',
  'IN_WORKSHOP',
  'READY_TO_RETURN',
  'DELIVERED',
])

function groupBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T
): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const row of rows) {
    const k = String(row[key])
    if (!out[k]) out[k] = []
    out[k].push(row)
  }
  return out
}

test('R-cross — DB invariants across all QA-E2E-* orders', async ({}, testInfo) => {
  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (err) {
    testInfo.skip(true, `Supabase env missing: ${(err as Error).message}`)
    return
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: orders } = await supabase
    .from('orders')
    .select('order_id, status, created_at')
    .ilike('order_id', '%QA-E2E-%')
    .lt('created_at', oneHourAgo)

  if (!orders || orders.length === 0) {
    testInfo.annotations.push({
      type: 'no-data',
      description: 'Zero QA-E2E-* orders older than 1h — nothing to audit',
    })
    testInfo.skip(true, 'no orders to audit')
    return
  }

  const orderIds = orders.map((o) => o.order_id)
  const [
    { data: transitions },
    { data: reports },
    { data: invoices },
    { data: orderItems },
    { data: orderTechs },
  ] = await Promise.all([
    supabase
      .from('order_status_transitions')
      .select('order_id, from_status, to_status')
      .in('order_id', orderIds),
    supabase
      .from('service_reports')
      .select('report_id, order_id, photos_before, photos_after, ac_units, actual_total_price')
      .in('order_id', orderIds)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('invoice_id, order_id, invoice_type, payment_status, total_amount, paid_amount')
      .in('order_id', orderIds),
    supabase.from('order_items').select('order_item_id, order_id').in('order_id', orderIds),
    supabase
      .from('order_technicians')
      .select('order_id, technician_id, role')
      .in('order_id', orderIds),
  ])

  const invoiceIds = (invoices ?? []).map((i) => i.invoice_id)
  const { data: payments } =
    invoiceIds.length > 0
      ? await supabase
          .from('payment_records')
          .select('invoice_id, amount')
          .in('invoice_id', invoiceIds)
      : { data: [] }

  const trByOrder = groupBy((transitions ?? []) as Array<Record<string, unknown>>, 'order_id')
  const repByOrder = groupBy((reports ?? []) as Array<Record<string, unknown>>, 'order_id')
  const invByOrder = groupBy((invoices ?? []) as Array<Record<string, unknown>>, 'order_id')
  const itByOrder = groupBy((orderItems ?? []) as Array<Record<string, unknown>>, 'order_id')
  const tcByOrder = groupBy((orderTechs ?? []) as Array<Record<string, unknown>>, 'order_id')
  const payByInvoice = groupBy((payments ?? []) as Array<Record<string, unknown>>, 'invoice_id')

  const violations: Violation[] = []

  for (const order of orders) {
    const orderId = order.order_id
    const ots = trByOrder[orderId] ?? []
    const ors = repByOrder[orderId] ?? []
    const ois = invByOrder[orderId] ?? []
    const itms = itByOrder[orderId] ?? []
    const tcs = tcByOrder[orderId] ?? []
    const finals = ois.filter((i) => (i as { invoice_type?: string }).invoice_type === 'FINAL')

    // 1. terminal state
    const can = toCanonical(order.status)
    if (can !== 'PAID' && can !== 'CANCELLED') {
      violations.push({
        invariant: '1: terminal state',
        orderId,
        detail: `status="${order.status}" canonical="${can}"`,
      })
    }

    // 2. transition statuses known
    for (const t of ots as Array<{ from_status?: string; to_status?: string }>) {
      if (t.from_status && !KNOWN_STATUSES.has(t.from_status.toUpperCase())) {
        violations.push({
          invariant: '2: transition statuses known',
          orderId,
          detail: `from_status="${t.from_status}"`,
        })
      }
      if (t.to_status && !KNOWN_STATUSES.has(t.to_status.toUpperCase())) {
        violations.push({
          invariant: '2: transition statuses known',
          orderId,
          detail: `to_status="${t.to_status}"`,
        })
      }
    }

    // 3. report photos >= 1 each
    for (const r of ors as Array<{
      report_id: string
      photos_before?: unknown
      photos_after?: unknown
    }>) {
      const before = Array.isArray(r.photos_before) ? r.photos_before : []
      const after = Array.isArray(r.photos_after) ? r.photos_after : []
      if (before.length < 1)
        violations.push({
          invariant: '3: report photos_before >= 1',
          orderId,
          detail: `report ${r.report_id} has 0 photos_before`,
        })
      if (after.length < 1)
        violations.push({
          invariant: '3: report photos_after >= 1',
          orderId,
          detail: `report ${r.report_id} has 0 photos_after`,
        })
    }

    // 4. FINAL invoice total == report actual_total_price sum
    if (finals.length > 0 && ors.length > 0) {
      const repTotal = (ors as Array<{ actual_total_price?: number }>).reduce(
        (s, r) => s + Number(r.actual_total_price ?? 0),
        0
      )
      for (const inv of finals as Array<{ invoice_id: string; total_amount?: number }>) {
        const invTotal = Number(inv.total_amount ?? 0)
        if (Math.abs(invTotal - repTotal) > 0.01) {
          violations.push({
            invariant: '4: invoice total matches report total',
            orderId,
            detail: `invoice ${inv.invoice_id} total=${invTotal} reportSum=${repTotal}`,
          })
        }
      }
    }

    // 6. payment_records sum == paid_amount
    for (const inv of ois as Array<{
      invoice_id: string
      paid_amount?: number
    }>) {
      const ps = payByInvoice[inv.invoice_id] ?? []
      const paySum = (ps as Array<{ amount?: number }>).reduce(
        (s, p) => s + Number(p.amount ?? 0),
        0
      )
      const paid = Number(inv.paid_amount ?? 0)
      if (Math.abs(paySum - paid) > 0.01) {
        violations.push({
          invariant: '6: payment sum equals invoice paid_amount',
          orderId,
          detail: `invoice ${inv.invoice_id} paid_amount=${paid} payments=${paySum}`,
        })
      }
    }

    // 7. exactly one lead per order (only if any technician rows exist)
    if (tcs.length > 0) {
      const leads = (tcs as Array<{ role?: string }>).filter((t) => t.role === 'lead')
      if (leads.length !== 1) {
        violations.push({
          invariant: '7: exactly one lead technician',
          orderId,
          detail: `${leads.length} leads (expected 1)`,
        })
      }
    }

    // 8. paid FINAL invoice => order PAID
    for (const inv of finals as Array<{ invoice_id: string; payment_status?: string }>) {
      if (inv.payment_status === 'PAID' && can !== 'PAID') {
        violations.push({
          invariant: '8: paid invoice implies paid order',
          orderId,
          detail: `invoice ${inv.invoice_id} payment_status=PAID but order status=${order.status}`,
        })
      }
    }

    // 9. order has at least one item
    if (itms.length === 0) {
      violations.push({
        invariant: '9: at least one order_items row',
        orderId,
        detail: '0 order_items',
      })
    }

    // 10. service_reports.ac_units length >= order_items length
    for (const r of ors as Array<{ report_id: string; ac_units?: unknown }>) {
      const acs = Array.isArray(r.ac_units) ? r.ac_units : []
      if (acs.length > 0 && acs.length < itms.length) {
        violations.push({
          invariant: '10: ac_units covers all order_items',
          orderId,
          detail: `report ${r.report_id} ac_units=${acs.length} items=${itms.length}`,
        })
      }
    }
  }

  const dir = resolve(process.cwd(), '.omo/evidence/qa/r-cross')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, 'orders-checked.json'),
    JSON.stringify({ count: orders.length, orderIds }, null, 2)
  )
  writeFileSync(resolve(dir, 'violations.json'), JSON.stringify(violations, null, 2))

  expect(
    violations,
    `cross-audit found ${violations.length} violations:\n${JSON.stringify(violations, null, 2)}`
  ).toHaveLength(0)
})

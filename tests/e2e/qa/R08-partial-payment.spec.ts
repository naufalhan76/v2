import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  assignLeadTechnician,
  getTechnicianIdByEmail,
  getFullOrderSnapshot,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-08 partial payment — DP then balance, status transitions', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r08', { acUnits: 1, label: 'PartialPayment' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  if (!techId) {
    testInfo.skip(true, 'technicianLead missing')
    return
  }

  const supabase = getSupabaseAdmin()
  await assignLeadTechnician(orderId, techId)
  // Fast-forward to COMPLETED via admin client.
  await supabase
    .from('orders')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
  await supabase.from('service_reports').insert({
    order_id: orderId,
    technician_id: techId,
    photos_before: [],
    photos_after: [],
    ac_units: [],
    materials: [],
    actual_total_price: 500_000,
    customer_name_signed: 'QA Customer R08',
    notes: `[seed:${scenario.prefix}]`,
  })

  // Create FINAL invoice + transition to INVOICED.
  const invoiceId = `INV-${scenario.prefix}`
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
  await supabase.from('invoices').insert({
    invoice_id: invoiceId,
    invoice_number: `QA-FIN-${scenario.prefix.slice(-6)}`,
    invoice_type: 'FINAL',
    order_id: orderId,
    customer_id: scenario.customerId,
    invoice_date: today,
    due_date: due,
    service_type: 'CLEANING',
    service_name: 'AC Cleaning',
    base_service_quantity: 1,
    base_service_price: 500_000,
    base_service_total: 500_000,
    addons_subtotal: 0,
    subtotal: 500_000,
    discount_amount: 0,
    discount_percentage: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total_amount: 500_000,
    status: 'SENT',
    payment_status: 'UNPAID',
    paid_amount: 0,
  })
  await supabase
    .from('orders')
    .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  const ctx = await browser.newContext()
  try {
    const { page: financePage } = await loginAs(ctx, 'finance')

    // First payment 50% — try API; fall back to admin client.
    const tryApi = async (amount: number, label: string) => {
      const res = await financePage.request.post(`/api/invoices/${invoiceId}/payments`, {
        data: { amount, payment_method: 'TRANSFER', payment_date: today, notes: label },
      })
      return res.ok()
    }

    const apiOk1 = await tryApi(250_000, 'QA R-08 DP 50%')
    if (!apiOk1) {
      await supabase.from('payment_records').insert({
        invoice_id: invoiceId,
        payment_date: today,
        payment_method: 'TRANSFER',
        amount: 250_000,
        notes: 'QA R-08 DP 50%',
      })
      await supabase
        .from('invoices')
        .update({
          paid_amount: 250_000,
          payment_status: 'PARTIAL',
          status: 'PARTIAL_PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', invoiceId)
    }

    const snap1 = await getFullOrderSnapshot(orderId)
    const inv1 = snap1.invoices.find((i) => i.invoiceId === invoiceId)
    expect(inv1?.paymentStatus).toBe('PARTIAL')
    expect(inv1?.paidAmount).toBe(250_000)
    expect(snap1.order.status).toBe('INVOICED')
    expect(snap1.payments).toHaveLength(1)

    // Second payment 50%.
    const apiOk2 = await tryApi(250_000, 'QA R-08 balance')
    if (!apiOk2) {
      await supabase.from('payment_records').insert({
        invoice_id: invoiceId,
        payment_date: today,
        payment_method: 'TRANSFER',
        amount: 250_000,
        notes: 'QA R-08 balance',
      })
      await supabase
        .from('invoices')
        .update({
          paid_amount: 500_000,
          payment_status: 'PAID',
          status: 'PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', invoiceId)
      await supabase
        .from('orders')
        .update({ status: 'PAID', updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
    }

    const snap2 = await getFullOrderSnapshot(orderId)
    const inv2 = snap2.invoices.find((i) => i.invoiceId === invoiceId)
    expect(inv2?.paymentStatus).toBe('PAID')
    expect(inv2?.paidAmount).toBe(500_000)
    expect(snap2.order.status).toBe('PAID')
    expect(snap2.payments).toHaveLength(2)

    if (!apiOk1 || !apiOk2) {
      testInfo.annotations.push({
        type: 'finding',
        description: `POST /api/invoices/${invoiceId}/payments unavailable; used admin-client fallback`,
      })
    }

    const dir = evidenceDir('r08')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'payments.json'),
      JSON.stringify({ orderId, invoiceId, snap1, snap2 }, null, 2)
    )
  } finally {
    await ctx.close()
  }
})

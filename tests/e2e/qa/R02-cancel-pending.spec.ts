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
  adminCancelOrder,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-02 cancel at PENDING — proforma cascade documented', async ({ context, qaAccounts: _qa }) => {
  scenario = await seedFullScenario('r02', { acUnits: 2, label: 'CancelPending' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const supabase = getSupabaseAdmin()
  const proformaId = `INV-PRO-${scenario.prefix}`
  await supabase.from('invoices').insert({
    invoice_id: proformaId,
    invoice_number: `QA-PRO-${scenario.prefix.slice(-6)}`,
    invoice_type: 'PROFORMA',
    order_id: orderId,
    customer_id: scenario.customerId,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    service_type: 'CLEANING',
    service_name: 'AC Cleaning',
    base_service_quantity: 2,
    base_service_price: 300_000,
    base_service_total: 300_000,
    addons_subtotal: 0,
    subtotal: 300_000,
    discount_amount: 0,
    discount_percentage: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total_amount: 300_000,
    status: 'DRAFT',
    payment_status: 'UNPAID',
    paid_amount: 0,
  })

  const before = await getFullOrderSnapshot(orderId)
  expect(before.order.status).toBe('PENDING')
  expect(before.invoices.find((i) => i.invoiceType === 'PROFORMA')).toBeDefined()

  const { page: adminPage } = await loginAs(context, 'admin')

  await adminCancelOrder(adminPage.request, orderId, 'QA R-02 test')

  const after = await getFullOrderSnapshot(orderId)
  expect(after.order.status).toBe('CANCELLED')

  const proformaAfter = after.invoices.find((i) => i.invoiceType === 'PROFORMA')
  // F3-A1 guarantees PROFORMA cascade-cancel. Assert directly so a regression
  // surfaces as a hard failure instead of a silent annotation.
  expect(proformaAfter, 'PROFORMA invoice still exists after order cancel').toBeDefined()
  expect(
    proformaAfter!.status,
    'PROFORMA invoice must cascade to CANCELLED when order is cancelled (F3-A1)'
  ).toBe('CANCELLED')

  const cancelTransition = after.transitions.find(
    (t) => t.toStatus === 'CANCELLED'
  )
  expect(cancelTransition).toBeDefined()

  const dir = evidenceDir('r02')
  mkdirSync(dir, { recursive: true })
  await adminPage.screenshot({ path: resolve(dir, 'admin-after-cancel.png') }).catch(() => {})
  writeFileSync(
    resolve(dir, 'result.json'),
    JSON.stringify(
      {
        orderId,
        proformaId,
        before,
        after,
        cancelTransition,
      },
      null,
      2
    )
  )
})

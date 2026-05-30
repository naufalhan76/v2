/**
 * G01 — Order-create UI spec
 * Drive the real Create Order form at /dashboard/orders/new as ADMIN.
 *
 * Happy:  customer → location → AC → service type (catalog price autofill) →
 *         schedule (skip assignment) → submit → redirect /dashboard/orders → DB PENDING.
 * Negative (no AC):      toast "Belum ada AC yang dipilih", no DB write.
 * Negative (no service): toast "Pilih jenis service untuk semua AC", no DB write.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type Page } from '@playwright/test'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  getOrderStatus,
  scenarioPrefix,
  assertStagingHost,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null
let customerName = ''
let catalogBasePrice = 275_000
let _seededServiceTypeId = ''
let seededServiceTypeName = ''

qaTest.beforeAll(async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? ''
  assertStagingHost(baseURL)

  const prefix = scenarioPrefix('G01')
  scenario = await seedFullScenario('G01', { acUnits: 1, label: 'OrderCreateUI' })
  customerName = `QA OrderCreateUI ${scenario.prefix.slice(-6)}`

  const supabase = getSupabaseAdmin()

  // ── Ensure master data exists for catalog price autofill ──
  let unitTypeId: string
  let capacityId: string
  let serviceTypeId: string

  const { data: existingUnitType } = await supabase
    .from('unit_types')
    .select('unit_type_id')
    .eq('name', 'Split Wall')
    .maybeSingle()
  if (existingUnitType?.unit_type_id) {
    unitTypeId = existingUnitType.unit_type_id
  } else {
    const { data: created } = await supabase
      .from('unit_types')
      .insert({ name: 'Split Wall', description: '[seed:G01]', is_active: true })
      .select('unit_type_id')
      .single()
    unitTypeId = created!.unit_type_id
  }

  const { data: existingCapacity } = await supabase
    .from('capacity_ranges')
    .select('capacity_id')
    .eq('unit_type_id', unitTypeId)
    .eq('capacity_label', '0.5 – 1 PK')
    .maybeSingle()
  if (existingCapacity?.capacity_id) {
    capacityId = existingCapacity.capacity_id
  } else {
    const { data: created } = await supabase
      .from('capacity_ranges')
      .insert({ unit_type_id: unitTypeId, capacity_label: '0.5 – 1 PK', is_active: true })
      .select('capacity_id')
      .single()
    capacityId = created!.capacity_id
  }

  const { data: existingServiceType } = await supabase
    .from('service_types')
    .select('service_type_id, name')
    .eq('code', 'CLEANING')
    .maybeSingle()
  if (existingServiceType?.service_type_id) {
    serviceTypeId = existingServiceType.service_type_id
    seededServiceTypeName = existingServiceType.name
  } else {
    const { data: created } = await supabase
      .from('service_types')
      .insert({ code: 'CLEANING', name: 'AC Cleaning', is_active: true })
      .select('service_type_id, name')
      .single()
    serviceTypeId = created!.service_type_id
    seededServiceTypeName = created!.name
  }
  _seededServiceTypeId = serviceTypeId

  // Update the seeded AC unit so catalog matching works.
  await supabase
    .from('ac_units')
    .update({ unit_type_id: unitTypeId, capacity_id: capacityId })
    .eq('ac_unit_id', scenario.acUnitIds[0])

  // Seed a matching service_catalog row.
  const { data: existingCatalog } = await supabase
    .from('service_catalog')
    .select('catalog_id, base_price')
    .eq('unit_type_id', unitTypeId)
    .eq('capacity_id', capacityId)
    .eq('service_type_id', serviceTypeId)
    .maybeSingle()

  if (existingCatalog) {
    catalogBasePrice = Number(existingCatalog.base_price)
  } else {
    await supabase.from('service_catalog').insert({
      msn_code: `CATALOG-G01-${prefix.slice(-8)}`,
      unit_type_id: unitTypeId,
      capacity_id: capacityId,
      service_type_id: serviceTypeId,
      service_name: seededServiceTypeName,
      base_price: catalogBasePrice,
      is_active: true,
    })
  }
})

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest.setTimeout(120_000)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function openForm(page: Page) {
  await page.goto('/dashboard/orders/new')
  await page.waitForURL('/dashboard/orders/new', { timeout: 15_000 })
  await page.getByRole('heading', { name: 'Buat Order Baru' }).first().waitFor({ state: 'visible', timeout: 15_000 })
}

async function selectCustomer(page: Page, name: string) {
  // G01: The Order Create form uses a cmdk-based combobox.
  // We type the full prefix to trigger the server-side search, wait for the
  // suggestion list to populate, then click the matching entry.
  const searchInput = page.locator('input[placeholder="Ketik minimal 2 karakter..."]').last()
  await searchInput.waitFor({ state: 'visible', timeout: 10_000 })
  await searchInput.click()
  await searchInput.fill(name.slice(0, 16))
  await page.waitForTimeout(1200)

  // The suggestion list is rendered inside a [cmdk-list] container.
  const suggestion = page.locator('[cmdk-item]').filter({ hasText: name }).first()
  try {
    await suggestion.waitFor({ state: 'visible', timeout: 15_000 })
    await suggestion.click()
  } catch {
    // Fallback: if cmdk-item not rendered, try role="option" inside select
    const option = page.locator('[role="option"]').filter({ hasText: name }).first()
    await option.waitFor({ state: 'visible', timeout: 10_000 })
    await option.click()
  }

  await page.getByText(name).first().waitFor({ state: 'visible', timeout: 10_000 })
}

async function toggleAcUnit(page: Page, brand: string) {
  const locSection = page.locator('text=Lokasi & Unit AC').first()
  await locSection.click()

  const acButton = page.locator('button').filter({ hasText: brand }).first()
  await acButton.waitFor({ timeout: 10_000 })
  await acButton.click()
}

async function selectServiceType(page: Page, serviceName: string) {
  const svcSection = page.locator('text=Service Items').first()
  await svcSection.click()

  const selectTrigger = page.locator('text=Pilih jenis service...').first()
  await selectTrigger.waitFor({ timeout: 10_000 })
  await selectTrigger.click()

  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('[role="option"]').filter({ hasText: serviceName }).first().click()
}

async function fillScheduleAndSkipAssignment(page: Page) {
  const schedSection = page.locator('text=Jadwal & Penugasan').first()
  await schedSection.click()

  // Open date picker and click first enabled day
  const dateTrigger = page.locator('button:has-text("Pilih tanggal")').first()
  await dateTrigger.click()
  const enabledDay = page.locator('[role="gridcell"]:not([data-disabled]):not([aria-disabled="true"])').first()
  await enabledDay.waitFor({ state: 'visible', timeout: 10_000 })
  await enabledDay.click()

  // Skip assignment
  const skipLabel = page.locator('label:has-text("Skip — assign teknisi nanti")').first()
  await skipLabel.click()
}

async function clickSubmit(page: Page) {
  const reviewSection = page.locator('text=Review & Submit').first()
  await reviewSection.click()

  const submitBtn = page.locator('button:has-text("Buat Order")').first()
  await submitBtn.waitFor({ timeout: 10_000 })
  await submitBtn.click()
}

async function assertToast(page: Page, text: string) {
  await page.getByText(text).waitFor({ state: 'visible', timeout: 10_000 })
  await expect(page.getByText(text).first()).toBeVisible()
}

async function writeEvidence(name: string, data: unknown, page: Page) {
  const evDir = evidenceDir('G01')
  mkdirSync(evDir, { recursive: true })
  writeFileSync(resolve(evDir, `${name}.json`), JSON.stringify(data, null, 2))
  await page.screenshot({ path: resolve(evDir, `${name}.png`) }).catch(() => {})
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

qaTest.describe.serial('G01 — Order creation via UI', () => {
  qaTest('happy path — create order via UI', async ({ browser }) => {
    if (!scenario) throw new Error('Scenario not seeded')

    const { page } = await loginAs(await browser.newContext(), 'admin')

    await openForm(page)
    await selectCustomer(page, customerName)
    await toggleAcUnit(page, 'Daikin')
    await selectServiceType(page, seededServiceTypeName)

    // Assert catalog price autofill
    const priceInput = page
      .locator('div')
      .filter({ hasText: 'Estimasi Harga (Rp)' })
      .locator('input[type="number"]')
      .first()
    await expect(priceInput).toHaveValue(String(catalogBasePrice))

    await fillScheduleAndSkipAssignment(page)
    await clickSubmit(page)

    // Assert redirect to orders list
    await page.waitForURL('/dashboard/orders', { timeout: 20_000 })

    // Assert DB order exists and is PENDING
    const supabase = getSupabaseAdmin()
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id, status')
      .eq('customer_id', scenario.customerId)
      .order('created_at', { ascending: false })

    expect(orders).toHaveLength(1)
    const orderId = orders![0].order_id
    const status = await getOrderStatus(orderId)
    expect(status).toBe('PENDING')

    await writeEvidence('happy', { orderId, status, catalogBasePrice, scenario: scenario.prefix }, page)
  })

  qaTest('negative — no AC selected', async ({ browser }) => {
    if (!scenario) throw new Error('Scenario not seeded')

    const { page } = await loginAs(await browser.newContext(), 'admin')

    await openForm(page)
    await selectCustomer(page, customerName)
    // Do NOT select any AC
    await fillScheduleAndSkipAssignment(page)
    await clickSubmit(page)

    await assertToast(page, 'Belum ada AC yang dipilih')

    // Assert no order created for this customer
    const supabase = getSupabaseAdmin()
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id')
      .eq('customer_id', scenario.customerId)

    expect(orders).toHaveLength(1) // only the happy-path order

    await writeEvidence('negative-no-ac', { customerId: scenario.customerId, assertion: 'no-new-order' }, page)
  })

  qaTest('negative — no service type selected', async ({ browser }) => {
    if (!scenario) throw new Error('Scenario not seeded')

    const { page } = await loginAs(await browser.newContext(), 'admin')

    await openForm(page)
    await selectCustomer(page, customerName)
    await toggleAcUnit(page, 'Daikin')
    // Do NOT select service type
    await fillScheduleAndSkipAssignment(page)
    await clickSubmit(page)

    await assertToast(page, 'Pilih jenis service untuk semua AC')

    // Assert no additional order created
    const supabase = getSupabaseAdmin()
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id')
      .eq('customer_id', scenario.customerId)

    expect(orders).toHaveLength(1) // only the happy-path order

    await writeEvidence('negative-no-service-type', { customerId: scenario.customerId, assertion: 'no-new-order' }, page)
  })
})

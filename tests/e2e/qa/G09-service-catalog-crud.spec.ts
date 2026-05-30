/**
 * G09 — Service-catalog CRUD + price feed to order form
 * Drive the real Service Catalog page as ADMIN.
 *
 * Happy:  create catalog entry (unit_type+capacity+service_type+msn_code+base_price)
 *         → DB row → toggle active → edit base_price → cross-link to order form price autofill.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type Page } from '@playwright/test'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  scenarioPrefix,
  assertStagingHost,
  purgeByPrefix,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null
let catalogEntryId = ''
const catalogBasePrice = 275_000
const catalogEditPrice = 300_000
let msnCode = ''
let unitTypeId = ''
let capacityId = ''
let serviceTypeName = ''
let unitTypeName = ''
let capacityLabel = ''

qaTest.beforeAll(async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? ''
  assertStagingHost(baseURL)

  const prefix = scenarioPrefix('G09')
  scenario = await seedFullScenario('G09', { acUnits: 1, label: 'CatalogPriceFeed' })

  const supabase = getSupabaseAdmin()

  // ── Ensure master data exists for catalog matching ──
  const { data: existingUnitType } = await supabase
    .from('unit_types')
    .select('unit_type_id, name')
    .eq('name', 'Split Wall')
    .maybeSingle()
  if (existingUnitType?.unit_type_id) {
    unitTypeId = existingUnitType.unit_type_id
    unitTypeName = existingUnitType.name
  } else {
    const { data: created } = await supabase
      .from('unit_types')
      .insert({ name: 'Split Wall', description: '[seed:G09]', is_active: true })
      .select('unit_type_id, name')
      .single()
    unitTypeId = created!.unit_type_id
    unitTypeName = created!.name
  }

  const { data: existingCapacity } = await supabase
    .from('capacity_ranges')
    .select('capacity_id, capacity_label')
    .eq('unit_type_id', unitTypeId)
    .eq('capacity_label', '0.5 – 1 PK')
    .maybeSingle()
  if (existingCapacity?.capacity_id) {
    capacityId = existingCapacity.capacity_id
    capacityLabel = existingCapacity.capacity_label
  } else {
    const { data: created } = await supabase
      .from('capacity_ranges')
      .insert({ unit_type_id: unitTypeId, capacity_label: '0.5 – 1 PK', is_active: true })
      .select('capacity_id, capacity_label')
      .single()
    capacityId = created!.capacity_id
    capacityLabel = created!.capacity_label
  }

  const { data: existingServiceType } = await supabase
    .from('service_types')
    .select('service_type_id, name')
    .eq('code', 'CLEANING')
    .maybeSingle()
  if (existingServiceType?.service_type_id) {
    serviceTypeName = existingServiceType.name
  } else {
    const { data: created } = await supabase
      .from('service_types')
      .insert({ code: 'CLEANING', name: 'AC Cleaning', is_active: true })
      .select('service_type_id, name')
      .single()
    serviceTypeName = created!.name
  }

  // Update the seeded AC unit so catalog matching works.
  await supabase
    .from('ac_units')
    .update({ unit_type_id: unitTypeId, capacity_id: capacityId })
    .eq('ac_unit_id', scenario.acUnitIds[0])

  msnCode = `CATALOG-G09-${prefix.slice(-8)}`
})

qaTest.afterAll(async () => {
  const supabase = getSupabaseAdmin()
  // Purge catalog entry explicitly (not covered by prefix purge).
  if (catalogEntryId) {
    await supabase.from('service_catalog').delete().eq('catalog_id', catalogEntryId)
  }
  if (scenario) await purgeByPrefix(scenario.prefix)
})

qaTest.setTimeout(120_000)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function openCatalogPage(page: Page) {
  await page.goto('/dashboard/settings/service-catalog')
  await page.waitForURL('/dashboard/settings/service-catalog', { timeout: 15_000 })
  // The heading is rendered by the dashboard layout but may take a moment.
  // Wait for the table body or the "Tambah" button instead.
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  // Wait for either the table or the empty-state message to appear
  await Promise.race([
    page.locator('table').first().waitFor({ state: 'visible', timeout: 15_000 }),
    page.locator('text=Tidak ada data').first().waitFor({ state: 'visible', timeout: 15_000 }),
    page.locator('button:has-text("Tambah Catalog")').first().waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function openCreateSheet(page: Page) {
  await page.locator('button:has-text("Tambah Catalog Entry")').first().click()
  await page.locator('text=Tambah Catalog Entry').first().waitFor({ timeout: 10_000 })
}

async function fillCatalogForm(page: Page, opts: {
  msn_code: string
  service_name: string
  base_price: number
  unit_type_name: string
  capacity_label: string
  service_type_name: string
}) {
  await page.locator('input[name="msn_code"]').fill(opts.msn_code)
  await page.locator('input[name="base_price"]').fill(String(opts.base_price))
  await page.locator('input[name="service_name"]').fill(opts.service_name)

  // Unit Type select
  await page.locator('text=Unit Type').first().click()
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('[role="option"]').filter({ hasText: opts.unit_type_name }).first().click()

  // Capacity select (depends on unit type)
  await page.locator('text=Kapasitas').first().click()
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('[role="option"]').filter({ hasText: opts.capacity_label }).first().click()

  // Service Type select
  await page.locator('text=Service Type').first().click()
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('[role="option"]').filter({ hasText: opts.service_type_name }).first().click()
}

async function submitSheet(page: Page) {
  await page.locator('button[type="submit"]:has-text("Tambah")').first().click()
  // Wait for sheet to close (success toast or table refresh)
  await page.waitForTimeout(800)
}

async function submitEditSheet(page: Page) {
  await page.locator('button[type="submit"]:has-text("Simpan Perubahan")').first().click()
  await page.waitForTimeout(800)
}

async function findCatalogRow(page: Page, msn: string) {
  // Search for the MSN code in the table
  const searchInput = page.locator('input[placeholder*="Ketik untuk mencari"]').first()
  await searchInput.fill(msn)
  await searchInput.press('Enter')
  await page.waitForTimeout(600)

  const row = page.locator('tr').filter({ hasText: msn }).first()
  await row.waitFor({ timeout: 10_000 })
  return row
}

async function toggleCatalogRow(page: Page, row: Awaited<ReturnType<typeof findCatalogRow>>) {
  const toggle = row.locator('button[role="switch"], .switch, [aria-label="Toggle aktif"]').first()
  await toggle.click()
  await page.waitForTimeout(600)
}

async function openEditForRow(page: Page, row: Awaited<ReturnType<typeof findCatalogRow>>) {
  const editBtn = row.locator('button[aria-label="Edit"]').first()
  await editBtn.click()
  await page.locator('text=Edit Catalog Entry').first().waitFor({ timeout: 10_000 })
}

async function writeEvidence(name: string, data: unknown, page: Page) {
  const evDir = evidenceDir('G09')
  mkdirSync(evDir, { recursive: true })
  writeFileSync(resolve(evDir, `${name}.json`), JSON.stringify(data, null, 2))
  await page.screenshot({ path: resolve(evDir, `${name}.png`) }).catch(() => {})
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

qaTest.describe.serial('G09 — Service catalog CRUD + price feed', () => {
  qaTest('create catalog entry and verify DB + price feed', async ({ browser }) => {
    const { page } = await loginAs(await browser.newContext(), 'admin')

    // ── Step 1: Create catalog entry via UI ──
    await openCatalogPage(page)
    await openCreateSheet(page)
    await fillCatalogForm(page, {
      msn_code: msnCode,
      service_name: 'AC Cleaning G09',
      base_price: catalogBasePrice,
      unit_type_name: unitTypeName,
      capacity_label: capacityLabel,
      service_type_name: serviceTypeName,
    })
    await submitSheet(page)

    // ── Step 2: Assert DB row exists ──
    const supabase = getSupabaseAdmin()
    const { data: catalogRow, error } = await supabase
      .from('service_catalog')
      .select('catalog_id, msn_code, base_price, is_active, unit_type_id, capacity_id, service_type_id')
      .eq('msn_code', msnCode)
      .single()

    expect(error).toBeNull()
    expect(catalogRow).not.toBeNull()
    expect(catalogRow!.msn_code).toBe(msnCode)
    expect(Number(catalogRow!.base_price)).toBe(catalogBasePrice)
    expect(catalogRow!.is_active).toBe(true)
    catalogEntryId = catalogRow!.catalog_id

    await writeEvidence('catalog-create-feed', {
      catalogId: catalogEntryId,
      msnCode,
      basePrice: catalogBasePrice,
      isActive: true,
    }, page)

    // ── Step 3: Cross-link — order form price autofill ──
    if (!scenario) throw new Error('Scenario not seeded')

    await page.goto('/dashboard/orders/new')
    await page.waitForURL('/dashboard/orders/new', { timeout: 15_000 })
    await page.locator('text=Buat Order Baru').first().waitFor({ timeout: 15_000 })

    // Select customer
    const customerTrigger = page.locator('[data-value="section-customer"] >> .. >> .accordion-trigger, .AccordionTrigger:has-text("Customer")').first()
    if (await customerTrigger.isVisible().catch(() => false)) {
      await customerTrigger.click()
    }
    const searchInput = page.locator('input[placeholder*="Ketik minimal 2 karakter"]').first()
    await searchInput.fill(scenario.customerId.slice(0, 10))
    await page.waitForTimeout(400)
    await page.locator('text=' + scenario.customerId).first().waitFor({ timeout: 10_000 })
    await page.locator('text=' + scenario.customerId).first().click()

    // Toggle AC unit
    const locTrigger = page.locator('text=Lokasi & Unit AC').first()
    await locTrigger.click()
    const acButton = page.locator('button').filter({ hasText: 'Daikin' }).first()
    await acButton.waitFor({ timeout: 10_000 })
    await acButton.click()

    // Select service type
    const svcTrigger = page.locator('text=Service Items').first()
    await svcTrigger.click()
    const selectTrigger = page.locator('text=Pilih jenis service...').first()
    await selectTrigger.waitFor({ timeout: 10_000 })
    await selectTrigger.click()
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[role="option"]').filter({ hasText: serviceTypeName }).first().click()

    // Assert estimated price autofilled from catalog
    const priceInput = page
      .locator('div')
      .filter({ hasText: 'Estimasi Harga (Rp)' })
      .locator('input[type="number"]')
      .first()
    await expect(priceInput).toHaveValue(String(catalogBasePrice))

    await writeEvidence('catalog-create-feed', {
      catalogId: catalogEntryId,
      msnCode,
      basePrice: catalogBasePrice,
      orderPriceAutofill: catalogBasePrice,
      scenario: scenario.prefix,
    }, page)
  })

  qaTest('toggle active + edit base_price', async ({ browser }) => {
    if (!catalogEntryId) throw new Error('Catalog entry not created in previous test')

    const { page } = await loginAs(await browser.newContext(), 'admin')
    const supabase = getSupabaseAdmin()

    // ── Step 1: Toggle inactive ──
    await openCatalogPage(page)
    const row = await findCatalogRow(page, msnCode)
    await toggleCatalogRow(page, row)

    // Assert DB is_active=false
    const { data: afterToggle } = await supabase
      .from('service_catalog')
      .select('is_active')
      .eq('catalog_id', catalogEntryId)
      .single()
    expect(afterToggle!.is_active).toBe(false)

    // ── Step 2: Edit base_price ──
    const row2 = await findCatalogRow(page, msnCode)
    await openEditForRow(page, row2)
    await page.locator('input[name="base_price"]').fill(String(catalogEditPrice))
    await submitEditSheet(page)

    // Assert DB reflects new price
    const { data: afterEdit } = await supabase
      .from('service_catalog')
      .select('base_price, is_active')
      .eq('catalog_id', catalogEntryId)
      .single()
    expect(Number(afterEdit!.base_price)).toBe(catalogEditPrice)
    // is_active should remain false (we didn't toggle it back)
    expect(afterEdit!.is_active).toBe(false)

    await writeEvidence('catalog-toggle-edit', {
      catalogId: catalogEntryId,
      msnCode,
      afterToggle: { is_active: false },
      afterEdit: { base_price: catalogEditPrice, is_active: false },
    }, page)
  })
})

/**
 * G03 — Master-data CRUD via real UI.
 *
 * Exercises customer / location / AC unit create+edit+delete through the
 * dashboard UI and verifies DB state via the admin client.
 */
import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  getSupabaseAdmin,
  assertStagingHost,
  scenarioPrefix,
} from './fixtures'

const EVIDENCE_DIR = resolve(process.cwd(), '.omo/evidence/qa/G03')

function saveEvidence(name: string, data: unknown): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(
    resolve(EVIDENCE_DIR, `${name}.json`),
    JSON.stringify(data, null, 2),
    'utf-8'
  )
}

// Track every row created through the UI so afterAll can purge them.
const created = {
  customers: [] as string[],
  locations: [] as string[],
  acUnits: [] as string[],
}

test.describe.serial('G03 — Master-data CRUD', () => {
  test.beforeAll(() => {
    assertStagingHost(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000')
  })

  test.afterAll(async () => {
    const supabase = getSupabaseAdmin()
    // Reverse dependency order: AC → location → customer
    for (const acId of created.acUnits) {
      await supabase.from('ac_units').delete().eq('ac_unit_id', acId)
    }
    for (const locId of created.locations) {
      await supabase.from('locations').delete().eq('location_id', locId)
    }
    for (const custId of created.customers) {
      const { data: orders } = await supabase
        .from('orders')
        .select('order_id')
        .eq('customer_id', custId)
      for (const o of orders ?? []) {
        await supabase.from('order_items').delete().eq('order_id', o.order_id)
        await supabase.from('orders').delete().eq('order_id', o.order_id)
      }
      await supabase.from('customers').delete().eq('customer_id', custId)
    }

    // Final sanity: zero residual rows for our prefixes
    const prefixes = ['QA-E2E-g03']
    for (const p of prefixes) {
      const { data: custs } = await supabase
        .from('customers')
        .select('customer_id')
        .ilike('customer_id', `%${p}%`)
      const { data: locs } = await supabase
        .from('locations')
        .select('location_id')
        .ilike('location_id', `%${p}%`)
      const { data: acs } = await supabase
        .from('ac_units')
        .select('ac_unit_id')
        .ilike('ac_unit_id', `%${p}%`)
      if ((custs?.length ?? 0) + (locs?.length ?? 0) + (acs?.length ?? 0) > 0) {
        throw new Error(`[G03] residual rows found for prefix ${p}`)
      }
    }
  })

  qaTest('Customer create + edit + delete via UI', async ({ context }, testInfo) => {
    const { page } = await loginAs(context, 'admin')
    const prefix = scenarioPrefix('g03')
    const supabase = getSupabaseAdmin()
    const evDir = EVIDENCE_DIR
    mkdirSync(evDir, { recursive: true })

    const customerName = `QA-E2E Customer ${prefix}`
    const editedName = `QA-E2E Customer Edited ${prefix}`
    const evidence: Record<string, unknown> = { prefix }

    // ── CREATE ──
    await page.goto('/dashboard/manajemen/customer')
    await page.getByRole('button', { name: /tambah customer/i }).click()
    await page.locator('#customer_name').fill(customerName)
    await page.locator('#primary_contact_person').fill('QA Tester')
    await page.locator('#phone_number').fill('+62811000001')
    await page.locator('#email').fill(`qa-${prefix.slice(-6).toLowerCase()}@example.com`)
    await page.locator('#billing_address').fill('Jl. QA No. 1')
    await page.locator('#notes').fill(`[qa:${prefix}]`)
    await page.getByRole('button', { name: /^simpan$/i }).click()

    await expect(page.locator('text=Customer berhasil ditambahkan').first()).toBeVisible({ timeout: 15_000 })

    const row = page.locator('table tbody tr', { hasText: customerName })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.locator('td:first-child span').click()
    await page.waitForURL(/\/dashboard\/manajemen\/customer\/CS-/, { timeout: 15_000 })

    const customerId = page.url().split('/').pop()!
    created.customers.push(customerId)

    const { data: dbCustomer } = await supabase.from('customers').select('*').eq('customer_id', customerId).single()
    expect(dbCustomer).not.toBeNull()
    expect(dbCustomer!.customer_name).toBe(customerName)

    evidence.create = { customerId, dbCustomer }
    await page.screenshot({ path: resolve(evDir, 'customer-create.png') }).catch(() => {})

    // ── EDIT ──
    await page.goto('/dashboard/manajemen/customer')
    const editRow = page.locator('table tbody tr', { hasText: customerName })
    await expect(editRow).toBeVisible({ timeout: 10_000 })
    await editRow.locator('button[aria-label="Edit"]').click()

    await page.locator('#edit_customer_name').fill(editedName)
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Customer berhasil diupdate')).toBeVisible({ timeout: 15_000 })

    const { data: editedCustomer } = await supabase.from('customers').select('customer_name').eq('customer_id', customerId).single()
    expect(editedCustomer!.customer_name).toBe(editedName)

    evidence.edit = { customerId, editedCustomer }
    await page.screenshot({ path: resolve(evDir, 'customer-edit.png') }).catch(() => {})

    // ── DELETE ──
    await page.goto('/dashboard/manajemen/customer')
    const delRow = page.locator('table tbody tr', { hasText: editedName })
    await expect(delRow).toBeVisible({ timeout: 10_000 })
    await delRow.locator('button[aria-label="Hapus"]').click()

    await page.getByRole('alertdialog').getByRole('button', { name: /^hapus$/i }).click()
    await expect(page.locator('text=Customer berhasil dihapus')).toBeVisible({ timeout: 15_000 })

    const { data: deletedCustomer } = await supabase.from('customers').select('*').eq('customer_id', customerId).maybeSingle()
    expect(deletedCustomer).toBeNull()

    created.customers = created.customers.filter((id) => id !== customerId)

    evidence.delete = { customerId, hardDeleted: true }
    await page.screenshot({ path: resolve(evDir, 'customer-delete.png') }).catch(() => {})

    saveEvidence('customer-crud', evidence)
    testInfo.annotations.push({
      type: 'finding',
      description: 'Customer DELETE performs hard delete; customers table has no deleted_at column.',
    })
  })

  qaTest('Location create + edit + delete under customer', async ({ context }) => {
    const { page } = await loginAs(context, 'admin')
    const prefix = scenarioPrefix('g03-loc')
    const supabase = getSupabaseAdmin()
    const evDir = EVIDENCE_DIR

    // Precondition: create a customer via UI
    await page.goto('/dashboard/manajemen/customer')
    await page.getByRole('button', { name: /tambah customer/i }).click()
    const custName = `QA-E2E LocCustomer ${prefix}`
    await page.locator('#customer_name').fill(custName)
    await page.locator('#primary_contact_person').fill('QA Tester')
    await page.locator('#phone_number').fill('+62811000002')
    await page.locator('#email').fill(`qa-loc-${prefix.slice(-6).toLowerCase()}@example.com`)
    await page.locator('#billing_address').fill('Jl. QA No. 2')
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Customer berhasil ditambahkan').first()).toBeVisible({ timeout: 15_000 })

    const row = page.locator('table tbody tr', { hasText: custName })
    await row.locator('td:first-child span').click()
    await page.waitForURL(/\/dashboard\/manajemen\/customer\/CS-/, { timeout: 15_000 })
    const customerId = page.url().split('/').pop()!
    created.customers.push(customerId)

    // ── CREATE LOCATION ──
    await page.getByRole('tab', { name: /lokasi/i }).click()
    await page.getByRole('button', { name: /tambah lokasi/i }).click()
    const locAddress = `Jl. QA Lokasi ${prefix}`
    const locEvidence: Record<string, unknown> = { prefix, customerId }
    await page.locator('#loc_full_address').fill(locAddress)
    await page.locator('#loc_house_number').fill('42')
    await page.locator('#loc_city').fill('Jakarta')
    await page.locator('#loc_landmarks').fill('Dekat masjid')
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Lokasi berhasil ditambahkan')).toBeVisible({ timeout: 15_000 })

    const locRow = page.locator('table tbody tr', { hasText: locAddress })
    await expect(locRow).toBeVisible({ timeout: 10_000 })

    const { data: dbLoc } = await supabase.from('locations').select('*').eq('full_address', locAddress).maybeSingle()
    expect(dbLoc).not.toBeNull()
    expect(dbLoc!.customer_id).toBe(customerId)
    const locationId = dbLoc!.location_id
    created.locations.push(locationId)

    locEvidence.create = { locationId, dbLoc }
    await page.screenshot({ path: resolve(evDir, 'location-create.png') }).catch(() => {})

    // ── EDIT LOCATION ──
    await locRow.locator('button[aria-label="Edit"]').click()
    const editedAddress = `Jl. QA Lokasi Edited ${prefix}`
    await page.locator('#loc_full_address').fill(editedAddress)
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Lokasi berhasil diperbarui')).toBeVisible({ timeout: 15_000 })

    const { data: editedLoc } = await supabase.from('locations').select('full_address').eq('location_id', locationId).single()
    expect(editedLoc!.full_address).toBe(editedAddress)

    locEvidence.edit = { locationId, editedLoc }
    await page.screenshot({ path: resolve(evDir, 'location-edit.png') }).catch(() => {})

    // ── DELETE LOCATION ──
    const delRow = page.locator('table tbody tr', { hasText: editedAddress })
    await delRow.locator('button[aria-label="Hapus"]').click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^hapus$/i }).click()
    await expect(page.locator('text=Lokasi dihapus')).toBeVisible({ timeout: 15_000 })

    const { data: deletedLoc } = await supabase.from('locations').select('*').eq('location_id', locationId).maybeSingle()
    expect(deletedLoc).toBeNull()

    created.locations = created.locations.filter((id) => id !== locationId)

    locEvidence.delete = { locationId, hardDeleted: true }
    await page.screenshot({ path: resolve(evDir, 'location-delete.png') }).catch(() => {})
    saveEvidence('location-crud', locEvidence)
  })

  qaTest('AC unit create + edit + delete under location', async ({ context }) => {
    const { page } = await loginAs(context, 'admin')
    const prefix = scenarioPrefix('g03-ac')
    const supabase = getSupabaseAdmin()
    const evDir = EVIDENCE_DIR

    // Precondition: customer + location
    await page.goto('/dashboard/manajemen/customer')
    await page.getByRole('button', { name: /tambah customer/i }).click()
    const custName = `QA-E2E AcCustomer ${prefix}`
    await page.locator('#customer_name').fill(custName)
    await page.locator('#primary_contact_person').fill('QA Tester')
    await page.locator('#phone_number').fill('+62811000003')
    await page.locator('#email').fill(`qa-ac-${prefix.slice(-6).toLowerCase()}@example.com`)
    await page.locator('#billing_address').fill('Jl. QA No. 3')
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Customer berhasil ditambahkan').first()).toBeVisible({ timeout: 15_000 })

    const row = page.locator('table tbody tr', { hasText: custName })
    await row.locator('td:first-child span').click()
    await page.waitForURL(/\/dashboard\/manajemen\/customer\/CS-/, { timeout: 15_000 })
    const customerId = page.url().split('/').pop()!
    created.customers.push(customerId)

    await page.getByRole('tab', { name: /lokasi/i }).click()
    await page.getByRole('button', { name: /tambah lokasi/i }).click()
    const locAddress = `Jl. QA AC Lokasi ${prefix}`
    await page.locator('#loc_full_address').fill(locAddress)
    await page.locator('#loc_house_number').fill('99')
    await page.locator('#loc_city').fill('Bandung')
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Lokasi berhasil ditambahkan')).toBeVisible({ timeout: 15_000 })

    const { data: dbLoc } = await supabase.from('locations').select('location_id').eq('full_address', locAddress).maybeSingle()
    expect(dbLoc).not.toBeNull()
    const locationId = dbLoc!.location_id
    created.locations.push(locationId)

    // ── CREATE AC UNIT ──
    await page.getByRole('tab', { name: /ac units/i }).click()
    await page.getByRole('button', { name: /tambah ac/i }).click()

    const acBrand = 'Daikin'
    const acModel = `QA-MODEL-${prefix}`
    const acSerial = `QA-SN-${prefix}`
    const acEvidence: Record<string, unknown> = { prefix, customerId, locationId }
    await page.locator('#ac_brand').fill(acBrand)
    await page.locator('#ac_model').fill(acModel)
    await page.locator('#ac_serial').fill(acSerial)
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=AC unit berhasil ditambahkan')).toBeVisible({ timeout: 15_000 })

    await expect(page.locator(`text=${acBrand}`)).toBeVisible()
    await expect(page.locator(`text=${acModel}`)).toBeVisible()

    const { data: dbAc } = await supabase.from('ac_units').select('*').eq('serial_number', acSerial).maybeSingle()
    expect(dbAc).not.toBeNull()
    expect(dbAc!.location_id).toBe(locationId)
    const acUnitId = dbAc!.ac_unit_id
    created.acUnits.push(acUnitId)

    acEvidence.create = { acUnitId, dbAc }
    await page.screenshot({ path: resolve(evDir, 'ac-create.png') }).catch(() => {})

    // ── EDIT AC UNIT ──
    const acCard = page.locator('.rounded-lg.border', { hasText: acModel })
    await acCard.locator('button', { hasText: /ubah/i }).click()
    const editedModel = `QA-MODEL-EDITED-${prefix}`
    await page.locator('#ac_model').fill(editedModel)
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=AC unit diperbarui')).toBeVisible({ timeout: 15_000 })

    const { data: editedAc } = await supabase.from('ac_units').select('model_number').eq('ac_unit_id', acUnitId).single()
    expect(editedAc!.model_number).toBe(editedModel)

    acEvidence.edit = { acUnitId, editedAc }
    await page.screenshot({ path: resolve(evDir, 'ac-edit.png') }).catch(() => {})

    // ── DELETE AC UNIT ──
    const delCard = page.locator('.rounded-lg.border', { hasText: editedModel })
    await delCard.locator('button', { hasText: /hapus/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^hapus$/i }).click()
    await expect(page.locator('text=AC unit dihapus')).toBeVisible({ timeout: 15_000 })

    const { data: deletedAc } = await supabase.from('ac_units').select('*').eq('ac_unit_id', acUnitId).maybeSingle()
    expect(deletedAc).toBeNull()

    created.acUnits = created.acUnits.filter((id) => id !== acUnitId)

    acEvidence.delete = { acUnitId, hardDeleted: true }
    await page.screenshot({ path: resolve(evDir, 'ac-delete.png') }).catch(() => {})
    saveEvidence('ac-crud', acEvidence)
  })

  qaTest('AC-add blocked when customer has zero locations', async ({ context }) => {
    const { page } = await loginAs(context, 'admin')
    const prefix = scenarioPrefix('g03-neg')
    const evDir = EVIDENCE_DIR

    // Create customer with NO locations
    await page.goto('/dashboard/manajemen/customer')
    await page.getByRole('button', { name: /tambah customer/i }).click()
    const custName = `QA-E2E NoLoc ${prefix}`
    await page.locator('#customer_name').fill(custName)
    await page.locator('#primary_contact_person').fill('QA Tester')
    await page.locator('#phone_number').fill('+62811000004')
    await page.locator('#email').fill(`qa-noloc-${prefix.slice(-6).toLowerCase()}@example.com`)
    await page.locator('#billing_address').fill('Jl. QA No. 4')
    await page.getByRole('button', { name: /^simpan$/i }).click()
    await expect(page.locator('text=Customer berhasil ditambahkan').first()).toBeVisible({ timeout: 15_000 })

    const row = page.locator('table tbody tr', { hasText: custName })
    await row.locator('td:first-child span').click()
    await page.waitForURL(/\/dashboard\/manajemen\/customer\/CS-/, { timeout: 15_000 })
    const customerId = page.url().split('/').pop()!
    created.customers.push(customerId)

    // Navigate to AC Units tab
    await page.getByRole('tab', { name: /ac units/i }).click()

    // Assert: "Tambah AC" button is disabled
    const addButton = page.getByRole('button', { name: /tambah ac/i })
    await expect(addButton).toBeDisabled()

    // Assert: empty state guides user to add location first
    await expect(page.locator('text=Belum ada lokasi')).toBeVisible()
    await expect(page.locator('text=Tambahkan lokasi terlebih dahulu sebelum mencatat AC unit.')).toBeVisible()

    saveEvidence('ac-needs-location', { customerId, blocked: true, addButtonDisabled: true })
    await page.screenshot({ path: resolve(evDir, 'ac-needs-location.png') }).catch(() => {})
  })
})

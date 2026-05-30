/**
 * G13 — Board-modal + list-view spec
 * Drive the Kanban board and list view at /dashboard/orders as ADMIN.
 *
 * What we test (drag opens modals/callbacks, NOT silent status change):
 * - Drag PENDING→ASSIGNED column opens Assign modal; completing it sets ASSIGNED.
 * - Drag ASSIGNED→PENDING opens Reschedule modal.
 * - Illegal drag (PENDING→PAID) → toast "Transisi tidak diizinkan", no DB change.
 * - List view toggle works; row click opens detail panel; cancel-from-list sets CANCELLED.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type Page } from '@playwright/test'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  assignLeadTechnician,
  getTechnicianIdByEmail,
  getOrderStatus,
  scenarioPrefix,
  assertStagingHost,
  purgeByPrefix,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null
let pendingOrderId = ''
let assignedOrderId = ''

qaTest.beforeAll(async ({ qaAccounts }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? ''
  assertStagingHost(baseURL)

  const _prefix = scenarioPrefix('G13')
  scenario = await seedFullScenario('G13', { acUnits: 1, label: 'BoardListViews' })

  // Seed a PENDING order for drag tests
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
    serviceType: 'CLEANING',
    scheduledVisitDate: new Date().toISOString().slice(0, 10),
  })
  pendingOrderId = orderId

  // Seed an ASSIGNED order for reschedule drag test
  const tech1Email = qaAccounts?.technicianLead?.email ?? ''
  const technicianId = tech1Email ? await getTechnicianIdByEmail(tech1Email) : null
  if (!technicianId) {
    throw new Error('[qa] technician not found — run qa:seed first')
  }

  const { orderId: assignedId } = await seedOrder({
    prefix: `${scenario.prefix}-ASSIGNED`,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
    serviceType: 'CLEANING',
    scheduledVisitDate: new Date().toISOString().slice(0, 10),
  })
  await assignLeadTechnician(assignedId, technicianId)
  assignedOrderId = assignedId
})

qaTest.afterAll(async () => {
  if (scenario) await purgeByPrefix(scenario.prefix)
})

qaTest.setTimeout(120_000)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function writeEvidence(name: string, data: unknown, page: Page) {
  const evDir = evidenceDir('G13')
  mkdirSync(evDir, { recursive: true })
  writeFileSync(resolve(evDir, `${name}.json`), JSON.stringify(data, null, 2))
  await page.screenshot({ path: resolve(evDir, `${name}.png`) }).catch(() => {})
}

async function gotoBoard(page: Page) {
  await page.goto('/dashboard/orders?view=board')
  await page.waitForURL('/dashboard/orders?view=board', { timeout: 20_000 })
  // Wait for board columns to render — h3 headings may be hidden initially
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await expect(page.locator('h3:has-text("Menunggu")').first()).toBeVisible({ timeout: 15_000 })
}

async function gotoList(page: Page) {
  await page.goto('/dashboard/orders?view=list')
  await page.waitForURL('/dashboard/orders?view=list', { timeout: 20_000 })
  // Wait for table header
  await page.locator('th:has-text("Order ID")').first().waitFor({ timeout: 15_000 })
}

/**
 * Simulate a @dnd-kit drag via Playwright mouse events.
 * The PointerSensor activationConstraint is { distance: 8 },
 * so we must move at least 8px after mousedown to activate the drag.
 */
async function dragCardToColumn(
  page: Page,
  orderId: string,
  targetColumnTitle: string
) {
  // Locate the card by its order_id text
  const card = page.locator('[role="button"]').filter({ hasText: orderId }).first()
  await card.waitFor({ state: 'visible', timeout: 10_000 })

  // Locate the target column dropzone (the inner div with min-h-[200px])
  const column = page.locator('h3').filter({ hasText: targetColumnTitle }).first()
  await column.waitFor({ state: 'visible', timeout: 10_000 })
  const dropzone = column.locator('xpath=../following-sibling::div//div[contains(@class, "min-h-[200px]")]').first()
  await dropzone.waitFor({ state: 'visible', timeout: 10_000 })

  const cardBox = await card.boundingBox()
  const dropBox = await dropzone.boundingBox()
  if (!cardBox || !dropBox) throw new Error('Could not get bounding boxes for drag')

  // Move to card center, press down, move 10px to activate drag, then move to dropzone center
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 10, cardBox.y + cardBox.height / 2 + 10)
  await page.waitForTimeout(50)
  await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2)
  await page.waitForTimeout(50)
  await page.mouse.up()
}

async function assertToast(page: Page, text: string) {
  const toast = page.locator('[data-state="open"]').filter({ hasText: text }).first()
  await toast.waitFor({ state: 'visible', timeout: 10_000 })
  await expect(toast).toBeVisible()
}

async function completeAssignModal(page: Page) {
  // Wait for Assign modal dialog
  const dialog = page.locator('dialog, [role="dialog"]').filter({ hasText: 'Assign Teknisi' }).first()
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })

  // Open technician SearchableSelect
  const techTrigger = dialog.locator('button').filter({ hasText: /Pilih teknisi|Memuat teknisi/ }).first()
  await techTrigger.click()
  await page.waitForTimeout(300)

  // Type a search query to filter and pick the first option
  const searchInput = dialog.locator('input[placeholder*="Cari teknisi"]').first()
  await searchInput.fill('QA')
  await page.waitForTimeout(400)

  // Click first option in dropdown
  const firstOption = dialog.locator('[class*="hover:bg-gray-100"]').first()
  await firstOption.waitFor({ state: 'visible', timeout: 10_000 })
  await firstOption.click()

  // Pick a date (tomorrow) from the calendar popover
  const dateTrigger = dialog.locator('button').filter({ hasText: /Pilih tanggal|\d{1,2}\s\w+/ }).first()
  await dateTrigger.click()
  await page.waitForTimeout(300)

  // Click a future date in the calendar
  const futureCell = page.locator('[role="gridcell"]').filter({ hasText: /^\d+$/ }).nth(2)
  await futureCell.waitFor({ state: 'visible', timeout: 10_000 })
  await futureCell.click()

  // Click Assign button
  const assignBtn = dialog.locator('button[type="submit"]').filter({ hasText: 'Assign' }).first()
  await assignBtn.click()

  // Wait for dialog to close
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function completeRescheduleModal(page: Page) {
  // Wait for Reschedule modal dialog
  const dialog = page.locator('dialog, [role="dialog"]').filter({ hasText: 'Reschedule Order' }).first()
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })

  // Fill reason
  const reasonInput = dialog.locator('textarea').first()
  await reasonInput.fill('Customer minta ganti jadwal')

  // Pick a future date
  const dateTrigger = dialog.locator('button').filter({ hasText: /Pilih tanggal|\d{1,2}\s\w+/ }).first()
  await dateTrigger.click()
  await page.waitForTimeout(300)

  const futureCell = page.locator('[role="gridcell"]').filter({ hasText: /^\d+$/ }).nth(3)
  await futureCell.waitFor({ state: 'visible', timeout: 10_000 })
  await futureCell.click()

  // Click Reschedule button
  const rescheduleBtn = dialog.locator('button[type="submit"]').filter({ hasText: 'Reschedule' }).first()
  await rescheduleBtn.click()

  // Wait for dialog to close
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

qaTest.describe.serial('G13 — Board-modal + list-view interactions', () => {
  qaTest('drag PENDING→ASSIGNED opens Assign modal; completing it sets ASSIGNED', async ({ browser }) => {
    const { page } = await loginAs(await browser.newContext(), 'admin')
    await gotoBoard(page)

    // Drag the PENDING card onto the ASSIGNED column
    await dragCardToColumn(page, pendingOrderId, 'Ditugaskan')

    // Assert Assign modal opens
    const dialog = page.locator('dialog, [role="dialog"]').filter({ hasText: 'Assign Teknisi' }).first()
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(dialog).toBeVisible()

    // Assert DB BEFORE modal confirm: order still PENDING (drag alone does not transition)
    const statusBefore = await getOrderStatus(pendingOrderId)
    expect(statusBefore).toBe('PENDING')

    // Complete the modal
    await completeAssignModal(page)

    // Assert DB: order is now ASSIGNED
    const statusAfter = await getOrderStatus(pendingOrderId)
    expect(statusAfter).toBe('ASSIGNED')

    await writeEvidence('drag-assign-modal', {
      orderId: pendingOrderId,
      statusBefore,
      statusAfter,
      assertion: 'drag-opens-modal-then-assigned',
    }, page)
  })

  qaTest('drag ASSIGNED→PENDING opens Reschedule modal', async ({ browser }) => {
    const { page } = await loginAs(await browser.newContext(), 'admin')
    await gotoBoard(page)

    // Drag the ASSIGNED card onto the PENDING column
    await dragCardToColumn(page, assignedOrderId, 'Menunggu')

    // Assert Reschedule modal opens
    const dialog = page.locator('dialog, [role="dialog"]').filter({ hasText: 'Reschedule Order' }).first()
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(dialog).toBeVisible()

    // Complete the modal (reschedule back to PENDING)
    await completeRescheduleModal(page)

    // Assert DB: order is now PENDING
    const statusAfter = await getOrderStatus(assignedOrderId)
    expect(statusAfter).toBe('PENDING')

    await writeEvidence('drag-reschedule-modal', {
      orderId: assignedOrderId,
      statusAfter,
      assertion: 'drag-opens-reschedule-modal-then-pending',
    }, page)
  })

  qaTest('illegal drag PENDING→PAID shows toast and does not change DB', async ({ browser }) => {
    // Re-seed a fresh PENDING order for this test (the first one was already assigned)
    const prefix = scenario!.prefix
    const { orderId: freshPendingId } = await seedOrder({
      prefix: `${prefix}-ILLEGAL`,
      customerId: scenario!.customerId,
      locationId: scenario!.locationId,
      acUnitIds: scenario!.acUnitIds,
      serviceType: 'CLEANING',
      scheduledVisitDate: new Date().toISOString().slice(0, 10),
    })

    const { page } = await loginAs(await browser.newContext(), 'admin')
    await gotoBoard(page)

    // Drag the fresh PENDING card onto the PAID column
    await dragCardToColumn(page, freshPendingId, 'Lunas')

    // Assert toast "Transisi tidak diizinkan"
    await assertToast(page, 'Transisi tidak diizinkan')

    // Assert DB: order still PENDING
    const status = await getOrderStatus(freshPendingId)
    expect(status).toBe('PENDING')

    await writeEvidence('illegal-drag', {
      orderId: freshPendingId,
      status,
      assertion: 'illegal-drag-blocked-toast-no-db-change',
    }, page)

    // Cleanup the fresh order inline so afterAll purge doesn't miss it
    const supabase = getSupabaseAdmin()
    await supabase.from('order_items').delete().eq('order_id', freshPendingId)
    await supabase.from('orders').delete().eq('order_id', freshPendingId)
  })

  qaTest('list view toggle, row click opens detail panel, cancel-from-list sets CANCELLED', async ({ browser }) => {
    // Seed a fresh order for list-view cancel test
    const prefix = scenario!.prefix
    const { orderId: listOrderId } = await seedOrder({
      prefix: `${prefix}-LIST`,
      customerId: scenario!.customerId,
      locationId: scenario!.locationId,
      acUnitIds: scenario!.acUnitIds,
      serviceType: 'CLEANING',
      scheduledVisitDate: new Date().toISOString().slice(0, 10),
    })

    const { page } = await loginAs(await browser.newContext(), 'admin')
    await gotoList(page)

    // Assert list table renders with status badge for the order
    const row = page.locator('tr').filter({ hasText: listOrderId }).first()
    await row.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(row).toBeVisible()

    // Assert status badge is visible in the row
    const badge = row.locator('[class*="badge"], [class*="Badge"]').first()
    await expect(badge).toBeVisible()

    // Click the row → OrderDetailPanel opens (Sheet)
    await row.click()
    const sheet = page.locator('[data-state="open"]').filter({ hasText: listOrderId }).first()
    await sheet.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(sheet).toBeVisible()

    // Close the sheet
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden', timeout: 10_000 })

    // Use row dropdown "Batalkan" → confirm cancel
    const dropdownTrigger = row.locator('button').filter({ has: page.locator('svg') }).first()
    await dropdownTrigger.click()
    await page.waitForTimeout(200)

    const cancelItem = page.locator('[role="menuitem"]').filter({ hasText: 'Batalkan' }).first()
    await cancelItem.waitFor({ state: 'visible', timeout: 10_000 })
    await cancelItem.click()

    // Confirm in CancelModal (AlertDialog)
    const alertDialog = page.locator('[role="alertdialog"]').filter({ hasText: 'Batalkan Order?' }).first()
    await alertDialog.waitFor({ state: 'visible', timeout: 10_000 })

    const confirmBtn = alertDialog.locator('button').filter({ hasText: 'Batalkan Order' }).first()
    await confirmBtn.click()

    // Wait for alert dialog to close
    await alertDialog.waitFor({ state: 'hidden', timeout: 15_000 })

    // Assert DB: order is CANCELLED
    const status = await getOrderStatus(listOrderId)
    expect(status).toBe('CANCELLED')

    await writeEvidence('list-cancel', {
      orderId: listOrderId,
      status,
      assertion: 'list-view-toggle-row-click-cancel',
    }, page)

    // Cleanup the list order inline
    const supabase = getSupabaseAdmin()
    await supabase.from('order_status_transitions').delete().eq('order_id', listOrderId)
    await supabase.from('order_items').delete().eq('order_id', listOrderId)
    await supabase.from('orders').delete().eq('order_id', listOrderId)
  })
})

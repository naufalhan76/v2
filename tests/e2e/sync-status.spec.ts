import { test, expect } from '@playwright/test'

test.describe('Sync Status Badge', () => {
  test('displays correct states and updates on events', async ({ page }) => {
    // 1. Visit harness
    await page.goto('/test/sync-status')
    
    // Check initial state
    const badge = page.locator('.inline-flex.items-center.rounded-md').first()
    await expect(badge).toBeVisible()
    
    // Initially should be Online or Tersinkron
    await expect(badge).toContainText(/Online|Tersinkron/)
    
    // 2. Click "Toggle online" -> assert "Offline" appears
    await page.click('#btn-toggle-online')
    await expect(badge).toContainText('Offline')
    
    // 3. Click "Add 1 pending report" -> assert "1" counter visible
    await page.click('#btn-add-pending')
    // Wait for the counter to show up (it's inside a span that is rounded-full)
    const counter = page.locator('span.rounded-full:not(.h-2)').first()
    await expect(counter).toContainText('1')
    
    // 4. Screenshot
    await page.screenshot({ path: '.omo/evidence/task-10-sync-status.png', fullPage: true })
  })
})

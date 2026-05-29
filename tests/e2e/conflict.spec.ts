import { test, expect } from '@playwright/test'

test.describe('Conflict Resolution', () => {
  test('displays conflict cards and allows discarding', async ({ page }) => {
    // Navigate to the test harness
    page.on("console", msg => console.log("BROWSER:", msg.text()))
    await page.goto('/__test/conflict')

    // Click seed to populate conflicts and open modal
    await page.click('#seed-btn')

    // Verify modal is open and has 3 cards
    await expect(page.locator('text=Order Berubah Saat Offline')).toBeVisible()
    
    // There should be 3 cards
    const cards = page.locator('h3:has-text("ORD-TEST-")')
    await expect(cards).toHaveCount(3)

    // Wait for a small moment to ensure rendering is stable for screenshot
    await page.waitForTimeout(500)

    // Take screenshot of the conflict modal
    await page.screenshot({ path: '.omo/evidence/task-9-conflict.png' })

    // Find the first "Buang" button and click it
    // The first one is ORD-TEST-1
    await page.getByRole('button', { name: 'Buang' }).first().click()

    // Assert there are now 2 cards
    await expect(cards).toHaveCount(2)
  })
})

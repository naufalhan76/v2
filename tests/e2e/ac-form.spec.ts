import { test, expect } from '@playwright/test'
import * as path from 'path'

test.describe('AcUnitForm', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('multi-ac form behavior', async ({ page }) => {
    // Navigate to harness
    await page.goto('/__test/ac-form')

    // Wait for the page to load and cards to be visible
    await page.waitForSelector('text=AC Unit Form Test Harness')

    // Check existing cards are rendered
    await expect(page.locator('text=AC 1')).toBeVisible()
    await expect(page.locator('text=Daikin')).toBeVisible()
    
    await expect(page.locator('text=AC 2')).toBeVisible()
    await expect(page.locator('text=Panasonic')).toBeVisible()

    // Add new AC
    await page.click('text=Tambah AC Baru')

    // Check new card is rendered (AC 3)
    await expect(page.locator('text=AC 3')).toBeVisible()

    // Fill new AC brand
    // Find the input for the new AC's brand. It has id brand-2 (0-indexed).
    await page.fill('#brand-2', 'Sharp')

    // Wait for the debounced onChange to flush (300 ms debounce + margin)
    await page.waitForFunction(
      () => Array.isArray(window.__acFormValue) &&
            window.__acFormValue.length === 3 &&
            window.__acFormValue[2]?.brand === 'Sharp',
      { timeout: 2000 }
    )

    // Evaluate window.__acFormValue
    const formValue = await page.evaluate(() => window.__acFormValue)
    
    expect(formValue).toBeDefined()
    expect(formValue.length).toBe(3)
    
    // Check existing units
    expect(formValue[0].ac_unit_id).toBe('AC0001')
    expect(formValue[0].brand).toBe('Daikin')
    
    expect(formValue[1].ac_unit_id).toBe('AC0002')
    expect(formValue[1].brand).toBe('Panasonic')

    // Check the newly added unit
    expect(formValue[2].ac_unit_id).toBeNull()
    expect(formValue[2].brand).toBe('Sharp')

    // Take a screenshot
    await page.screenshot({ path: '.omo/evidence/task-5-multi-ac.png' })
  })
})

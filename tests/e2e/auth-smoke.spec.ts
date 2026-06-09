import { expect, test } from '@playwright/test'

test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, 'Supabase not configured')

test.describe('Auth smoke', () => {
  test('redirects unauthenticated dashboard visits to login', async ({ page }) => {
    await page.goto('/dashboard')

    expect(page.url()).toContain('/login')
  })

  test('renders forgot password page', async ({ page }) => {
    await page.goto('/forgot-password')

    await expect(page.getByText(/Lupa Kata Sandi|Lupa kata sandi/i).first()).toBeVisible()
  })

  test('renders login page email input', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first()).toBeVisible()
  })
})

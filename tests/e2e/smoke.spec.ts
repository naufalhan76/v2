import { test, expect } from './fixtures';

test.describe('Smoke - technician login', () => {
  test('renders job list without console errors', async ({
    technicianPage: page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/technician');
    await expect(page).toHaveURL(/\/technician/);
    // Either jobs render, or an empty-state is shown — both acceptable.
    await expect(
      page.getByText(/job|tugas|tidak ada|belum ada|order/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: '.omo/evidence/task-0-smoke.png',
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

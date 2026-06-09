const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Screenshot /forgot-password
  await page.goto('http://localhost:3000/forgot-password');
  // Fill invalid email
  await page.fill('#email', 'invalid-email');
  await page.click('button[type="submit"]');
  // Wait for error state
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.omo/evidence/task-7-forgot-copy.png' });

  // Screenshot /login invalid form submission
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'invalid');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.omo/evidence/task-7-auth-error-states.png' });

  await browser.close();
})();

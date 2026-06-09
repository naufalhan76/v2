import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function main() {
  console.log('Starting dev server...');
  const server = spawn('bun', ['run', 'dev'], { stdio: 'pipe' });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('Server started, launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login with invalid inputs
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000); // wait for validation message
    await page.screenshot({ path: '.omo/evidence/task-7-auth-error-states.png' });

    // 2. Forgot password success state
    console.log('Navigating to forgot password...');
    await page.goto('http://localhost:3000/forgot-password');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    // wait for success state
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '.omo/evidence/task-7-forgot-copy.png' });

    console.log('Screenshots taken successfully.');
  } catch (e) {
    console.error('Error taking screenshots:', e);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
}

main();
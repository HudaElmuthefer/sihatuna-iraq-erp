// e2e/tests/login.spec.js
const { test, expect } = require('@playwright/test');
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require('./helpers');

test.describe('Login', () => {
  test('rejects an invalid password and stays on the login screen', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill(ADMIN_USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill('definitely-wrong-password');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in with valid credentials and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill(ADMIN_USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});

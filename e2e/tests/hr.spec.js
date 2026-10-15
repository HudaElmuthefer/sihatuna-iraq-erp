// e2e/tests/hr.spec.js -- HR module: add and remove an employee.
const { test, expect } = require('@playwright/test');
const { login, field } = require('./helpers');

test.describe('HR module', () => {
  test('adds and deletes an employee', async ({ page }) => {
    const employeeName = `E2E Employee ${Date.now()}`;

    await login(page);
    await page.goto('/hr?tab=employees');

    await page.getByRole('button', { name: /Add Employee/i }).click();
    const modal = page.locator('.modal-overlay .modal');
    await expect(modal).toBeVisible();

    await field(modal, 'Full Name').fill(employeeName);
    await field(modal, 'Job Title').fill('E2E Tester');
    await modal.locator('.modal-footer >> text=Save').click();

    await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });
    const row = page.locator('table tbody tr', { hasText: employeeName });
    await expect(row).toBeVisible({ timeout: 10000 });

    // The row's delete button is an unstyled icon button (no .btn-danger
    // class here, unlike the Patients page) -- select it by its emoji text.
    await row.getByRole('button', { name: '🗑️' }).click();
    await page.locator('.modal-overlay .btn-danger').click();
    await expect(page.locator('table tbody tr', { hasText: employeeName })).toHaveCount(0, { timeout: 10000 });
  });
});

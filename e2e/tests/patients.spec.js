// e2e/tests/patients.spec.js -- patient management: create, edit, delete.
const { test, expect } = require('@playwright/test');
const { login, field } = require('./helpers');

test.describe('Patient management', () => {
  test('creates, edits, and deletes a patient', async ({ page }) => {
    const patientName = `E2E Patient ${Date.now()}`;
    const updatedPhone = '07701112233';

    await login(page);
    await page.goto('/patients');

    await page.getByRole('button', { name: /Add Patient/i }).click();
    const addModal = page.locator('.modal-overlay .modal');
    await expect(addModal).toBeVisible();

    await field(addModal, 'Arabic Name').fill(patientName);
    await field(addModal, 'Phone *').fill('07700000000');
    await addModal.locator('.modal-footer >> text=Save').click();

    await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });
    const row = page.locator('table.table tbody tr', { hasText: patientName });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Edit: open the row's edit button (purple pencil icon, second action button).
    await row.locator('button').nth(1).click();
    const editModal = page.locator('.modal-overlay .modal');
    await expect(editModal).toBeVisible();
    await field(editModal, 'Phone *').fill(updatedPhone);
    await editModal.locator('.modal-footer >> text=Save').click();
    await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });

    // Delete.
    const updatedRow = page.locator('table.table tbody tr', { hasText: patientName });
    await updatedRow.locator('button.btn-danger').click();
    await page.locator('.modal-overlay .btn-danger').click();
    await expect(page.locator('table.table tbody tr', { hasText: patientName })).toHaveCount(0, { timeout: 10000 });
  });
});

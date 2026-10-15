// e2e/tests/hospital-scoping.spec.js -- multi-hospital switching/isolation.
//
// The header "Currently viewing" dropdown on this build only filters a
// handful of pages client-side (Patients is not one of them -- see the
// Phase 4 report) so this test instead verifies the real boundary: the
// backend's hospital-scoped query filter (pgCrud hospitalScoped:true).
// A global admin creates two facilities and one patient in each; a
// Hospital-Admin account tied to facility A must see only facility A's
// patient when it logs in -- the actual security property "switching
// hospitals" is meant to guarantee.
const { test, expect } = require('@playwright/test');
const { login, field, ensureMultiHospitalEnabled } = require('./helpers');

test.describe('Hospital switching / data isolation', () => {
  test('a hospital-scoped admin only sees their own facility\'s patients', async ({ page, browser }) => {
    // This flow walks through two facilities, two patients, one new user,
    // and a second login -- comfortably over the suite's default 30s.
    test.setTimeout(90000);
    const ts = Date.now();
    const hospA = `E2E Hospital A ${ts}`;
    const hospB = `E2E Hospital B ${ts}`;
    const patientA = `E2E Patient A ${ts}`;
    const patientB = `E2E Patient B ${ts}`;
    const scopedUsername = `e2ehospadmin${ts}`;
    const scopedPassword = 'E2eHospAdmin123!';

    await login(page);

    // 1) Enable multi-hospital mode (seed.js starts it off, but another spec
    // in the same run may have already turned it on -- see ensureMultiHospitalEnabled).
    await page.goto('/settings?tab=hospitals');
    await ensureMultiHospitalEnabled(page);

    for (const [nameAr, nameEn] of [[hospA, hospA], [hospB, hospB]]) {
      await page.getByRole('button', { name: /Add Facility/i }).click();
      // This particular modal (SettingsPage's hospital add/edit form) isn't
      // built from the app's usual `.modal-overlay`/`.modal` classes -- it's
      // a plain fixed-position div wrapping a `.card` -- so locate it by its
      // own heading instead.
      const hospModal = page.locator('h3', { hasText: 'Add Facility' }).locator('xpath=ancestor::div[contains(@class,"card")][1]');
      await expect(hospModal).toBeVisible();
      await field(hospModal, 'Name (Arabic)').fill(nameAr);
      await field(hospModal, 'Name (English)').fill(nameEn);
      await hospModal.getByRole('button', { name: /Save/i }).click();
      await expect(hospModal).toBeHidden({ timeout: 10000 });
    }
    await expect(page.getByText(hospA, { exact: false })).toBeVisible();
    await expect(page.getByText(hospB, { exact: false })).toBeVisible();

    // 2) Create one patient tagged to each facility.
    await page.goto('/patients');
    for (const [name, hosp] of [[patientA, hospA], [patientB, hospB]]) {
      await page.getByRole('button', { name: /Add Patient/i }).click();
      const modal = page.locator('.modal-overlay .modal');
      await expect(modal).toBeVisible();
      await field(modal, 'Arabic Name').fill(name);
      await field(modal, 'Phone *').fill('07700001111');
      await field(modal, 'Facility').selectOption({ label: hosp });
      await modal.locator('.modal-footer >> text=Save').click();
      await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });
    }

    // 3) Create a Hospital Admin account scoped to facility A.
    await page.goto('/settings?tab=users');
    await page.getByRole('button', { name: /Add New User/i }).click();
    const userModal = page.locator('.modal-overlay .modal');
    await expect(userModal).toBeVisible();
    await field(userModal, 'Full Name').fill('E2E Hospital Admin');
    await field(userModal, 'Username').fill(scopedUsername);
    await field(userModal, 'Password').fill(scopedPassword);
    await field(userModal, 'Role').selectOption({ label: 'Hospital Admin' });
    await field(userModal, 'Facility').selectOption({ label: hospA });
    await userModal.getByRole('button', { name: /Save/i }).click();
    await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });

    // 4) Log in as the scoped admin in a fresh, isolated browser context and
    // confirm the isolation: facility A's patient visible, B's is not.
    const scopedContext = await browser.newContext();
    const scopedPage = await scopedContext.newPage();
    await login(scopedPage, scopedUsername, scopedPassword);
    await scopedPage.goto('/patients');
    await expect(scopedPage.locator('table.table tbody tr', { hasText: patientA })).toBeVisible({ timeout: 10000 });
    await expect(scopedPage.locator('table.table tbody tr', { hasText: patientB })).toHaveCount(0);
    await scopedContext.close();

    // Sanity check: the global admin (unscoped) still sees both.
    await page.goto('/patients');
    await expect(page.locator('table.table tbody tr', { hasText: patientA })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.table tbody tr', { hasText: patientB })).toBeVisible({ timeout: 10000 });
  });
});

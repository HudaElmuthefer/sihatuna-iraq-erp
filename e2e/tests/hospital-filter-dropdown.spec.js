// e2e/tests/hospital-filter-dropdown.spec.js
//
// The header's "Currently viewing" dropdown (components/HeaderSelectDropdown.js,
// wired in components/Layout.js) is a ministry-level admin's view-only filter
// on top of the mandatory server-side isolation covered by
// backend/tests/hospital-scoping.test.js and e2e/tests/hospital-scoping.spec.js.
// This verifies the dropdown itself actually filters the Patients and HR
// Employees tables, and that it never even appears for a hospital-scoped user.
const { test, expect } = require('@playwright/test');
const { login, field, ensureMultiHospitalEnabled, API_BASE_URL } = require('./helpers');

test.describe('Hospital filter dropdown (Patients and HR Employees)', () => {
  test('filters both pages by the selected facility, and is absent for a restricted user', async ({ page, browser }) => {
    test.setTimeout(90000);
    const ts = Date.now();
    const hospA = `E2E Dropdown Hospital A ${ts}`;
    const hospB = `E2E Dropdown Hospital B ${ts}`;
    const patientA = `E2E Dropdown Patient A ${ts}`;
    const patientB = `E2E Dropdown Patient B ${ts}`;
    const employeeA = `E2E Dropdown Employee A ${ts}`;
    const employeeB = `E2E Dropdown Employee B ${ts}`;
    const scopedUsername = `e2edropdownadmin${ts}`;
    const scopedPassword = 'E2eDropdownAdmin123!';

    await login(page);

    // 1) Enable multi-hospital mode (another spec in the same run may have
    // already turned it on -- see ensureMultiHospitalEnabled) and create two facilities.
    await page.goto('/settings?tab=hospitals');
    await ensureMultiHospitalEnabled(page);

    for (const name of [hospA, hospB]) {
      await page.getByRole('button', { name: /Add Facility/i }).click();
      const hospModal = page.locator('h3', { hasText: 'Add Facility' }).locator('xpath=ancestor::div[contains(@class,"card")][1]');
      await expect(hospModal).toBeVisible();
      await field(hospModal, 'Name (Arabic)').fill(name);
      await field(hospModal, 'Name (English)').fill(name);
      await hospModal.getByRole('button', { name: /Save/i }).click();
      await expect(hospModal).toBeHidden({ timeout: 10000 });
    }

    // 2) One patient and one employee per facility.
    await page.goto('/patients');
    for (const [name, hosp] of [[patientA, hospA], [patientB, hospB]]) {
      await page.getByRole('button', { name: /Add Patient/i }).click();
      const modal = page.locator('.modal-overlay .modal');
      await field(modal, 'Arabic Name').fill(name);
      await field(modal, 'Phone *').fill('07700002222');
      await field(modal, 'Facility').selectOption({ label: hosp });
      await modal.locator('.modal-footer >> text=Save').click();
      await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });
    }

    await page.goto('/hr?tab=employees');
    for (const [name, hosp] of [[employeeA, hospA], [employeeB, hospB]]) {
      await page.getByRole('button', { name: /Add Employee/i }).click();
      const modal = page.locator('.modal-overlay .modal');
      await field(modal, 'Full Name').fill(name);
      await field(modal, 'Job Title').fill('E2E Tester');
      await field(modal, 'Facility').selectOption({ label: hosp });
      await modal.locator('.modal-footer >> text=Save').click();
      await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });
    }

    // 3) The dropdown filters the Patients table.
    const viewingDropdown = page.locator('button[title="Currently viewing:"]');

    await page.goto('/patients');
    await viewingDropdown.click();
    await page.getByRole('option', { name: hospA }).click();
    await expect(page.locator('table.table tbody tr', { hasText: patientA })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.table tbody tr', { hasText: patientB })).toHaveCount(0);

    await viewingDropdown.click();
    await page.getByRole('option', { name: hospB }).click();
    await expect(page.locator('table.table tbody tr', { hasText: patientB })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.table tbody tr', { hasText: patientA })).toHaveCount(0);

    await viewingDropdown.click();
    await page.getByRole('option', { name: /All facilities/i }).click();
    await expect(page.locator('table.table tbody tr', { hasText: patientA })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.table tbody tr', { hasText: patientB })).toBeVisible({ timeout: 10000 });

    // 4) The same dropdown filters the HR Employees table.
    await page.goto('/hr?tab=employees');
    await viewingDropdown.click();
    await page.getByRole('option', { name: hospA }).click();
    await expect(page.locator('table tbody tr', { hasText: employeeA })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table tbody tr', { hasText: employeeB })).toHaveCount(0);

    await viewingDropdown.click();
    await page.getByRole('option', { name: hospB }).click();
    await expect(page.locator('table tbody tr', { hasText: employeeB })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table tbody tr', { hasText: employeeA })).toHaveCount(0);

    // 5) Create a facility-A-scoped admin and confirm the dropdown is
    // simply absent for them -- not disabled, not showing other options,
    // not present at all (Layout.js renders a static facility badge instead).
    await page.goto('/settings?tab=users');
    await page.getByRole('button', { name: /Add New User/i }).click();
    const userModal = page.locator('.modal-overlay .modal');
    await field(userModal, 'Full Name').fill('E2E Dropdown Hospital Admin');
    await field(userModal, 'Username').fill(scopedUsername);
    await field(userModal, 'Password').fill(scopedPassword);
    await field(userModal, 'Role').selectOption({ label: 'Hospital Admin' });
    await field(userModal, 'Facility').selectOption({ label: hospA });
    await userModal.getByRole('button', { name: /Save/i }).click();
    await expect(page.locator('.toast-success, .toast-warning').last()).toBeVisible({ timeout: 10000 });

    const scopedContext = await browser.newContext();
    const scopedPage = await scopedContext.newPage();
    await login(scopedPage, scopedUsername, scopedPassword);
    await expect(scopedPage.locator('button[title="Currently viewing:"]')).toHaveCount(0);
    // Their own facility's data is still there, unfiltered by anything --
    // the mandatory server-side isolation (not this dropdown) is what's doing it.
    await scopedPage.goto('/patients');
    await expect(scopedPage.locator('table.table tbody tr', { hasText: patientA })).toBeVisible({ timeout: 10000 });
    await scopedContext.close();
  });

  test('switching the facility filter resets the Patients table back to page 1', async ({ page }) => {
    test.setTimeout(60000);
    const ts = Date.now();
    const hospC = `E2E Pagination Hospital C ${ts}`;
    const hospD = `E2E Pagination Hospital D ${ts}`;

    await login(page);
    await page.goto('/settings?tab=hospitals');
    await ensureMultiHospitalEnabled(page);

    // Created through the UI so a Save confirms each facility actually
    // exists, but the id itself (needed below to tag the bulk-created
    // patients) is read back from the API rather than parsed out of the
    // DOM -- there is no stable selector for it on this page.
    for (const name of [hospC, hospD]) {
      await page.getByRole('button', { name: /Add Facility/i }).click();
      const hospModal = page.locator('h3', { hasText: 'Add Facility' }).locator('xpath=ancestor::div[contains(@class,"card")][1]');
      await expect(hospModal).toBeVisible();
      await field(hospModal, 'Name (Arabic)').fill(name);
      await field(hospModal, 'Name (English)').fill(name);
      await hospModal.getByRole('button', { name: /Save/i }).click();
      await expect(hospModal).toBeHidden({ timeout: 10000 });
    }

    const hospitals = await page.evaluate(async (apiBaseUrl) => {
      const res = await fetch(`${apiBaseUrl}/hospitals`, { credentials: 'include' });
      return res.json();
    }, API_BASE_URL);
    const hospCId = hospitals.find((h) => h.name_en === hospC || h.name_ar === hospC)?.id;
    const hospDId = hospitals.find((h) => h.name_en === hospD || h.name_ar === hospD)?.id;
    expect(hospCId).toBeTruthy();
    expect(hospDId).toBeTruthy();

    // 51 patients in facility C (one more than the table's fixed 50-per-page
    // size, see useServerPagination's pageSize in PatientsPage.js) -- created
    // directly through the API in the browser's own authenticated session
    // (same pattern as ensureMultiHospitalEnabled in helpers.js), since
    // clicking "Add Patient" 51 times would make this test far too slow.
    // One patient in facility D to switch into afterward.
    await page.evaluate(async ({ apiBaseUrl, hospCId, hospDId, ts }) => {
      for (let i = 0; i < 51; i++) {
        await fetch(`${apiBaseUrl}/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: `E2E Pagination Patient C${i} ${ts}`, phone: '07700003333', hospitalId: hospCId }),
        });
      }
      await fetch(`${apiBaseUrl}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: `E2E Pagination Patient D ${ts}`, phone: '07700004444', hospitalId: hospDId }),
      });
    }, { apiBaseUrl: API_BASE_URL, hospCId, hospDId, ts });

    const viewingDropdown = page.locator('button[title="Currently viewing:"]');
    const prevButton = page.getByRole('button', { name: 'Prev' });

    await page.goto('/patients');
    await viewingDropdown.click();
    await page.getByRole('option', { name: hospC }).click();
    // 51 > 50-per-page -- the Prev button renders disabled on page 1.
    await expect(prevButton).toBeVisible({ timeout: 10000 });
    await expect(prevButton).toBeDisabled();

    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(prevButton).toBeEnabled({ timeout: 10000 });

    // Switching facilities while on page 2 must not leave the table stuck
    // requesting a page 2 that facility D (only 1 patient) doesn't have.
    await viewingDropdown.click();
    await page.getByRole('option', { name: hospD }).click();
    await expect(page.locator('table.table tbody tr', { hasText: `E2E Pagination Patient D ${ts}` })).toBeVisible({ timeout: 10000 });
    await expect(prevButton).toHaveCount(0); // a single result fits on one page -- Pagination hides itself entirely
  });
});

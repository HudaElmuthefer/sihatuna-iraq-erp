// e2e/tests/helpers.js
//
// Shared helpers. The app has no data-testid attributes anywhere, so these
// lean on the one structural pattern used consistently across every form in
// the codebase: `<div class="form-group"><label>Label text</label><input/></div>`.
const ADMIN_USERNAME = 'e2eadmin';
const ADMIN_PASSWORD = 'E2eAdminPass123!';

// The app defaults to Arabic/RTL (localStorage 'lang'). Forcing English
// keeps every selector in this suite plain ASCII and avoids RTL-specific
// layout quirks being mistaken for app bugs.
async function forceEnglish(page) {
  await page.addInitScript(() => { try { localStorage.setItem('lang', 'en'); } catch { /* ignore */ } });
}

async function login(page, username = ADMIN_USERNAME, password = ADMIN_PASSWORD) {
  await forceEnglish(page);
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';

// Several specs need multi-hospital mode on. It's a shared system_settings
// row (seed.js resets it to false once at the start of a full suite run),
// so whichever spec file runs first leaves it on for every spec after it in
// the same run -- unconditionally clicking the UI toggle in each spec would
// flip it back off the second time around. Reading the real value through
// the authenticated page itself (same cookie the app already uses) and only
// clicking when it's actually off keeps every spec correct regardless of
// run order or how many of them need it.
async function ensureMultiHospitalEnabled(page) {
  const isOn = await page.evaluate(async (apiBaseUrl) => {
    const res = await fetch(`${apiBaseUrl}/system-settings/multi_hospital_enabled`, { credentials: 'include' });
    const body = await res.json();
    return body?.value === true;
  }, API_BASE_URL);
  if (isOn) return;
  await page.locator('h3', { hasText: 'Multi-Hospital Mode' }).locator('xpath=../..').locator('button').first().click();
  await page.waitForTimeout(500); // toggle animation + system_settings PUT round-trip
}

// Finds the input/select/textarea next to the `.form-label` whose text
// contains `labelText`, scoped to `root` (a modal, a card...) so same-named
// labels elsewhere on the page don't collide. Not every label's wrapper div
// has a `.form-group` class (EmployeesTab's doesn't, PatientsPage's does),
// so this keys off the label itself and walks up to its parent -- the one
// structural piece every one of these forms has in common -- rather than
// the wrapper's class.
function field(root, labelText) {
  return root.locator('.form-label', { hasText: labelText }).first()
    .locator('xpath=..').locator('input, select, textarea').first();
}

module.exports = { login, field, forceEnglish, ensureMultiHospitalEnabled, ADMIN_USERNAME, ADMIN_PASSWORD };

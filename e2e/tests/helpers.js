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

module.exports = { login, field, forceEnglish, ADMIN_USERNAME, ADMIN_PASSWORD };

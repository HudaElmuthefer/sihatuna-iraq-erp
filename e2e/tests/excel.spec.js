// e2e/tests/excel.spec.js -- Excel import/export, on the Patients page.
//
// Rather than hardcoding the template's column headers (which would silently
// go stale the moment someone edits the template in modules.js), this test
// downloads the real template, reads its header + example row with the
// `xlsx` package, and builds a new row from them -- so it stays correct
// regardless of how the template's columns change.
const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Excel import/export', () => {
  test('exports patients to Excel', async ({ page }) => {
    await login(page);
    await page.goto('/patients');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export Excel/i }).click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('imports a patient from a filled-in template', async ({ page }) => {
    const importedName = `E2E Excel Import ${Date.now()}`;

    await login(page);
    await page.goto('/patients');
    await page.getByRole('button', { name: /Import from Excel/i }).click();
    const modal = page.locator('.modal-overlay .modal');
    await expect(modal).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Template/i }).click(),
    ]);
    const templatePath = await download.path();
    expect(templatePath).toBeTruthy();

    const wb = XLSX.readFile(templatePath);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = rows[0];
    const exampleRow = rows[1] || [];

    const newRow = headers.map((header, i) => {
      const h = String(header).toLowerCase();
      if (h.includes('name') || h.includes('اسم')) return importedName;
      if (h.includes('phone') || h.includes('هاتف')) return '07709998877';
      return exampleRow[i] ?? '';
    });

    const outWb = XLSX.utils.book_new();
    const outSheet = XLSX.utils.aoa_to_sheet([headers, newRow]);
    XLSX.utils.book_append_sheet(outWb, outSheet, sheetName);
    const outPath = path.join(os.tmpdir(), `sihatuna-e2e-import-${Date.now()}.xlsx`);
    XLSX.writeFile(outWb, outPath);

    await modal.locator('input[type="file"]').setInputFiles(outPath);
    await modal.getByRole('button', { name: /^Import$/i }).click();

    await expect(modal.getByText(/imported/i)).toBeVisible({ timeout: 15000 });
    await modal.getByRole('button', { name: /Close/i }).click();

    // Not `getByPlaceholder(/search/i)` -- that also matches the global
    // header search box and is ambiguous (strict-mode violation).
    await page.locator('.search-input-wrapper input').fill(importedName);
    await expect(page.locator('table.table tbody tr', { hasText: importedName })).toBeVisible({ timeout: 10000 });

    fs.unlinkSync(outPath);
  });
});

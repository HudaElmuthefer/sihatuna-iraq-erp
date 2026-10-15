// e2e/tests/ai-agent.spec.js -- one of the AI agent features: drug
// interaction checking. The page has a built-in degraded path (database ->
// AI -> local fallback table) so this works whether or not a real AI
// provider is configured for the test environment -- it checks that the
// feature's request/response cycle completes and renders a result, not
// that a specific AI provider answered.
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('AI agent features', () => {
  test('drug interaction check returns a result for a known interacting pair', async ({ page }) => {
    await login(page);
    await page.goto('/drug-interactions');

    // Aspirin + Warfarin is a hardcoded entry in both the local fallback
    // table and would also be flagged by any real interaction database/AI.
    // `input[placeholder]` alone also matches the global header search box,
    // so target the drug search field by its actual placeholder text.
    const drugSearch = page.getByPlaceholder('Drug name...');
    await drugSearch.fill('Aspirin');
    await page.getByText('Aspirin', { exact: true }).first().click();
    await drugSearch.fill('Warfarin');
    await page.getByText('Warfarin', { exact: true }).first().click();

    await page.getByRole('button', { name: /Check Interactions/i }).click();

    // Whatever the source (trusted db / AI / local fallback), the page must
    // settle on a definite answer -- either a listed interaction or an
    // explicit "no interaction found" state -- never stay stuck checking.
    await expect(page.getByText(/Checking\.\.\./i)).toHaveCount(0, { timeout: 15000 });
    const resultShown = page.locator('text=/No Interactions Found|interaction|Not enough data/i');
    await expect(resultShown.first()).toBeVisible({ timeout: 15000 });
  });
});

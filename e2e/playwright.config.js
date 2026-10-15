// e2e/playwright.config.js
//
// The frontend and backend are started manually (see README.md) against the
// isolated sihatuna_iraq_test database before running `npx playwright test`
// -- there is no webServer block here, because this suite is run twice on
// purpose: once against the dev server (react-scripts start) and once
// against the static production build (serve -s build), to compare the two
// (Phase 4 of the verification plan). BASE_URL lets the runner point at
// whichever one is currently up without editing this file.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

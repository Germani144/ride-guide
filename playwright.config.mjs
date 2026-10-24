// Browser tests: the real app in mobile-emulated Chromium (dev only).
//   npx playwright install chromium   # once
//   npm run test:browser
// Set PW_CHROMIUM to use an already installed Chromium instead of Playwright's download.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4391; // an unusual port, so the tests never run against some other server

export default defineConfig({
  testDir: 'test/browser',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${PORT}/ride-guide/`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `node test/browser/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/ride-guide/`,
    reuseExistingServer: false,
  },
});

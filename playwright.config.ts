import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,       // tests share real DB — run serially
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Reuse the auth state saved by the global setup
    storageState: 'e2e/.auth/admin.json',
  },

  projects: [
    // Step 1: log in and save cookies/localStorage to e2e/.auth/admin.json
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'], storageState: undefined },
    },
    // Step 2: run every spec with the saved auth state
    {
      name: 'e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Dev server must already be running (npm run dev); Playwright does not start it.
  webServer: {
    command: 'echo "dev server expected to be already running"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})

/**
 * Global auth setup — runs once before the E2E suite.
 * Logs in as admin, saves cookies + localStorage to e2e/.auth/admin.json
 * so every test starts already authenticated.
 *
 * Credentials come from env vars; defaults match the seed-test-users.mjs values.
 * Run `npm run seed:users` if the account doesn't exist yet.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json')

const EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? 'admin1@markition.com'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin@markition1'

setup('authenticate as admin', async ({ page }) => {
  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  await page.goto('/login')

  // Fill credentials
  await page.getByPlaceholder('you@markition.com').fill(EMAIL)
  await page.getByPlaceholder('Enter your password').fill(PASSWORD)
  await page.getByRole('button', { name: /Sign In/i }).click()

  // Wait for redirect to dashboard — confirms auth succeeded
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  expect(page.url()).toContain('/dashboard')

  // Persist auth state
  await page.context().storageState({ path: AUTH_FILE })
})

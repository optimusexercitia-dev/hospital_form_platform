import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Load .env.local (and friends) into process.env for the test-runner process,
// exactly as Next.js loads them for the app. Specs read secrets such as
// SUPABASE_SERVICE_ROLE_KEY from the environment (NEVER hardcoded — committing a
// key trips GitHub push protection and is bad hygiene even for a local key). The
// dev server booted by `webServer` loads env on its own via Next.
loadEnvConfig(process.cwd())

// E2E suite. Boots the Next.js dev server automatically and targets a seeded
// local Supabase. Specs are owned by the `tester` teammate and live in `e2e/`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

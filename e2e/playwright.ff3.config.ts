import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

/**
 * FF-3 fix-loop runner — NOT the gate.
 *
 * The root `playwright.config.ts` targets `:3000` and boots `npm run dev`. During
 * FF-3 that is the WRONG target: `:3000` is served by the primary checkout, which
 * sits on `main` and contains no FF-3 at all, so a run there would be a green that
 * proves nothing. This config points at an already-running **prod-standalone**
 * server (`node .next/standalone/server.js`) built from THIS worktree, on `:3100`,
 * and boots nothing itself.
 *
 * The spec never hardcodes a port — it navigates through `baseURL` only — so the
 * same file runs unchanged under the root config in `npm run e2e:prod`.
 *
 * Usage:
 *   PORT=3100 node .next/standalone/server.js      # from this worktree
 *   npx playwright test --config e2e/playwright.ff3.config.ts
 */
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: '.',
  // Scoped to FF-3 by default. `SPECS` overrides it for the adjacent-spec
  // regression checks the fix loop needs (e.g. SPECS='ff{1,2,3}-*.spec.ts').
  testMatch: process.env.SPECS ?? 'ff3-validations.spec.ts',
  // Serialized: every test owns spec-tagged fixtures and the suite shares one
  // local Postgres, so parallel workers would race the purge in beforeAll.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

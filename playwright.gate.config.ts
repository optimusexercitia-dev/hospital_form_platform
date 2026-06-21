import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Gate-run config: serves the pre-built standalone bundle instead of `next dev`,
// uses JSON + list reporters for deterministic summary capture, and sets
// `reuseExistingServer: false` so it always manages the lifecycle.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 2,
  reporter: [
    ['json', { outputFile: 'test-results/gate-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Serve the pre-built standalone bundle — faster and stable for Server Actions.
    // reuseExistingServer: true so CI/local can pre-start the server and pass it in;
    // reduces peak-memory crashes on Windows (formerly 178 failures from OOM crash).
    command: 'node .next/standalone/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
    },
  },
})

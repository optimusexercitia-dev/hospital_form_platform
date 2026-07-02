import { describe, expect, it } from 'vitest'

import vectors from './__fixtures__/status-vectors.json'
import { deriveUserStatus, type UserStatus } from './types'

/**
 * Status-derivation vectors for `deriveUserStatus` — the 4-way DISPLAY status
 * (`pending`/`active`/`suspended`/`deactivated`) shown in the org directory.
 *
 * This derivation is TS-ONLY: there is no SQL twin. The DB does not compute a
 * 4-way status; its access-control concern is the separate boolean `app.is_active()`
 * (`is_active AND (suspended_until IS NULL OR now() >= suspended_until)`), which
 * INTENTIONALLY differs from TS `'active'` on the `email_confirmed_at` dimension —
 * a `pending` (unconfirmed) user is app-ACTIVE for RLS but display-"pending". So
 * this is not a SQL↔TS parity test (unlike the condition evaluator); it fixes the
 * TS display derivation against a table of cases. `app.is_active()` is exercised
 * separately in pgTAP (`180_user_registration.sql`).
 */
describe('deriveUserStatus parity vectors', () => {
  const now = new Date(vectors.now)

  for (const c of vectors.cases) {
    it(c.name, () => {
      const status = deriveUserStatus(
        c.is_active,
        c.suspended_until,
        c.email_confirmed_at,
        now,
      )
      expect(status).toBe(c.expected as UserStatus)
    })
  }
})

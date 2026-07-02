import 'server-only'

/**
 * Auth onboarding feature flag — email-verification gate.
 *
 * The platform has no production domain yet, so SMTP cannot deliver mail. The
 * invite/email onboarding flow (`inviteUserByEmail` → `/auth/confirm` →
 * `/convite` first-password) therefore leaves every registered user stuck
 * `pending` (they never receive the link, never set a password, never log in).
 *
 * This flag decides which onboarding path `registerUser` takes:
 *   - OFF (default) — the org admin sets an INITIAL PASSWORD at registration and
 *     the account is created ACTIVE (`email_confirm: true`, no verification). The
 *     credential is relayed to the user out-of-band; the user can change it later.
 *   - ON — the historical invite/email flow: the user sets their own password via
 *     the emailed activation link.
 *
 * DEFAULT OFF. It reads `true` ONLY when `AUTH_EMAIL_VERIFICATION` is exactly
 * `'on'` or `'true'` (case-insensitive, trimmed); anything else — unset, empty,
 * `'off'`, `'false'`, or garbage — reads `false`.
 *
 * Flip `AUTH_EMAIL_VERIFICATION=on` (once a domain + working SMTP exist) to
 * restore the invite/email flow with no code change.
 *
 * SERVER-ONLY: no `NEXT_PUBLIC_` prefix — this must never reach the client
 * bundle. Guarded by the `server-only` import above.
 */
export function isEmailVerificationEnabled(): boolean {
  const raw = process.env.AUTH_EMAIL_VERIFICATION?.trim().toLowerCase()
  return raw === 'on' || raw === 'true'
}

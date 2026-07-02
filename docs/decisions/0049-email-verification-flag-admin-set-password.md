# 0049 — Email-verification flag & admin-set initial password

Status: Accepted — 2026-07-02

## Context

The platform has no production domain yet, so SMTP cannot deliver Auth mail. The
existing onboarding (`inviteUserByEmail` → `/auth/confirm` → `/convite`
first-password) leaves every registered user stuck `pending`: they never receive
the link, never set a password, never log in (status derives from
`profiles.email_confirmed_at IS NULL`).

## Decision

- Default email verification **OFF** behind a server-only flag
  `AUTH_EMAIL_VERIFICATION` (`isEmailVerificationEnabled()`, `src/lib/config/auth.ts`);
  reads `true` only when the value is exactly `on`/`true` (case-insensitive).
- With the flag OFF, `registerUser` takes an admin-supplied initial `password`
  (min 8) and creates the account via `admin.auth.admin.createUser({ …,
  email_confirm: true })`. `email_confirm: true` stamps
  `auth.users.email_confirmed_at`; the existing denorm trigger propagates it to
  `profiles` so status derives to `active` immediately. The credential is relayed
  to the user out-of-band; the user can change it later.
- With the flag ON, the historical `inviteUserByEmail` path is unchanged.
- No migration/RLS change: `handle_new_user` reads `full_name` +
  `home_organization_id` from user_metadata identically for both admin calls.

## Consequences

- Users are usable on day one without a domain. Flip `AUTH_EMAIL_VERIFICATION=on`
  (once SMTP delivers) to restore the invite flow with no code change.
- The admin briefly knows the initial password; users are expected to rotate it.
- The success message differs per branch (active-with-password vs. email-sent).

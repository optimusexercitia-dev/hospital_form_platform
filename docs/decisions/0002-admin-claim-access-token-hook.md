# ADR 0002 — Admin claim via custom access token hook

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 1

## Context

Global admin (`profiles.is_admin`) must be cheap to check inside RLS policies
on every request. Two options: (a) mirror the flag into `auth.users.app_metadata`
and read it from the JWT; (b) a custom access token hook that injects the claim
at token-issue time by reading `profiles` live.

## Decision

Use a **custom access token hook** (`public.custom_access_token_hook`) that
reads `profiles.is_admin` and writes an `is_admin` claim into the JWT. Enabled in
`config.toml` under `[auth.hook.custom_access_token]`. The RLS helper
`app.is_admin()` reads the claim from `request.jwt.claims` but **falls back to a
`profiles` lookup** when the claim is absent (service-role calls, tests, or
before a token refresh).

## Rationale

- The DB row stays the single source of truth; no second copy in `app_metadata`
  to keep in sync. Revoking admin takes effect on the next token refresh with no
  extra write.
- `app_metadata` writes require the service role and an explicit update path on
  every admin change — easy to forget, and stale until rewritten.
- The fallback means correctness never depends on the hook being configured; the
  hook is a performance optimization (avoids a `profiles` read per policy
  evaluation once the claim is present).

## Consequences

- Enabling the hook is a `config.toml` change, so it needs `supabase stop/start`
  (or a fresh `supabase start`) locally and the equivalent setting in Supabase
  Cloud for production (Phase 8 checklist).
- The hook function is granted to `supabase_auth_admin` only.
- Per-commission roles are NOT put in the JWT; they are read via the
  `is_member_of` / `is_staff_admin_of` helpers, keeping the token small and
  role changes effective immediately.

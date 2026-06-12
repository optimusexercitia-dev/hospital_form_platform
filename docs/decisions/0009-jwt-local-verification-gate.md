# ADR 0009 — Local JWT verification for the auth gate & identity

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 2

## Context

The middleware auth gate and the identity reads in `getSessionContext()` /
`getCommissionAccess()` established identity with `supabase.auth.getUser()`,
which makes a GoTrue `/user` network round trip on EVERY request to re-validate
the session. Under concurrent load (Playwright `--workers=5`, `next dev`) this
round trip intermittently raced/failed on the first post-login navigation: the
auth cookie was demonstrably PRESENT on the request, yet `@supabase/ssr` treated
the session as unauthenticated, and the gate bounced the user to
`/login?redirect=…`. Measured ~40% of landing-test executions failed this way —
a phase-blocking violation of "each persona logs in and lands on the correct
area." Reducing the post-login redirect chain from two hops to one (ADR-adjacent
fix in `signIn`) helped but did not eliminate it; the per-request `/user` call
was the root cause.

## Decision

Verify the JWT LOCALLY on the request hot path instead of calling GoTrue:

- `updateSession()` keeps the `@supabase/ssr` cookie getAll/setAll refresh dance,
  then calls `getSession()` (drives refresh-if-expired — the only path that may
  touch GoTrue `/token`, and only when the token is genuinely expired) followed
  by `getClaims()`, which verifies the JWT SIGNATURE against the cached JWKS
  (the stack signs with ES256) and validates `exp`. It returns the verified
  `claims` (or null).
- `middleware.ts` gates on `claims` presence.
- `getSessionContext()` derives `userId` (`sub`), `email`, and `is_admin` from
  the verified claims (`is_admin` is injected by the custom access token hook,
  ADR 0002). The TS-layer `is_admin` DB fallback is DROPPED, so admin UI fails
  CLOSED (treated as non-admin) if the hook is ever absent. `full_name` and
  memberships remain RLS-scoped DB reads — PostgREST validates the JWT locally
  too, so no GoTrue call remains on the hot path.

The SQL `app.is_admin()` helper KEEPS its DB fallback as defense-in-depth at the
RLS layer (the data authority), so the asymmetry is intentional: the UI/identity
layer trusts the claim; the data layer stays robust even if a claim is missing.

## Rationale

- Removes the per-request GoTrue round trip — the actual race source — so a
  valid, signed, unexpired session is never spuriously rejected under load.
- The security posture is the one the architecture already accepts: `is_admin`
  takes effect at next token issue (ADR 0002), and RLS/PostgREST already trust
  locally-validated JWTs rather than calling the auth server per request. This
  is the Supabase-recommended pattern for a gate.
- Refresh still happens (via `getSession()`) exactly when a token is expired, so
  long-lived sessions keep working; only the redundant validation call is gone.

## Consequences

- **Revocation latency ≤ token expiry (~1h) for the gate/identity.** A session
  revoked mid-token still passes the gate until expiry; the DB remains the data
  authority via RLS, which limits blast radius. Acceptable for v1.
- The custom access token hook is now a hard dependency for admin UI access in
  production (already on the Phase 8 deploy checklist — "Register the custom
  access token hook in production", ADR 0002).
- `getClaims()` requires asymmetric signing keys + a JWKS endpoint to verify
  without a network call; confirmed present locally (ES256 + `/.well-known/jwks.json`)
  and the production checklist must ensure the same.
- `getSession()` is used ONLY to drive refresh, never as the identity authority,
  so the `@supabase/ssr` "insecure session" warning does not apply to our usage
  (documented inline at both call sites).

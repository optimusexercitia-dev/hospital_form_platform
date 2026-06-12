# ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 2

## Context

PHASES Phase 2 calls for "`middleware.ts` session refresh + role-aware redirects
(admin → `/admin`, others → their commission, multi-commission users → a
picker)". Resolving the role-aware landing requires reading the user's profile
and memberships — a DB round trip. Doing that inside `middleware.ts` would put a
per-request role lookup on the edge for every navigation, against a
Server-Components-first design.

## Decision

`src/middleware.ts` is a **coarse auth gate + session refresh only**: it runs
`updateSession()` (`@supabase/ssr` cookie refresh) and enforces the
authenticated/unauthenticated boundary — unauthenticated requests to a protected
path are redirected to `/login?redirect=<path>`; authenticated requests to
`/login` or `/recuperar-senha` are bounced to `/`. It performs **no DB or role
reads**.

The **role-aware landing** is resolved in the root `/` Server Component, which
calls `getSessionContext()` (`src/lib/queries/session.ts`) and redirects:
admin → `/admin`, single membership → `/c/[slug]`, multiple → the `/c` picker,
none → a friendly no-access screen.

## Rationale

- Keeps a per-request DB/role read off the edge; the membership lookup happens
  once, in a Server Component, only when landing on `/`.
- Server-Components-first: routing logic that needs data lives where data access
  belongs (`src/lib/queries/`), not in middleware.
- Identity in middleware comes from `getUser()` (Auth-server-validated), so the
  auth boundary remains trustworthy without trusting unverified cookie claims.
- Satisfies PHASES' "role-aware redirects" intent: middleware owns the auth
  boundary; the root `/` Server Component owns the role landing.

## Consequences

- `/` is a protected path: unauthenticated → `/login`; authenticated → the root
  landing (never a stale placeholder once F5 lands).
- Per-commission access control is NOT in middleware. A foreign/unknown
  commission is handled by `getCommissionAccess()` returning `null` →
  `notFound()` (404), relying on RLS so existence is never leaked.
- v1 extension point: should an authenticated landing ever need to be faster than
  a Server-Component redirect, the role could be cached in the session — but the
  membership read stays out of middleware deliberately, so per-commission role
  changes take effect immediately.

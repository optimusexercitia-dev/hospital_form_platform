# ADR 0006 — Supabase API key scheme vs. env var naming

**Date:** 2026-06-12 · **Status:** accepted · **Owner:** lead

## Context

The pinned Supabase CLI (≥ v2.105) issues the new-style API keys
(`sb_publishable_...` / `sb_secret_...`) instead of the legacy `anon` /
`service_role` JWTs. Our env vars are named `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` (CLAUDE.md §8, `.env.example`).

## Decision

Keep the legacy env var NAMES while storing whichever key format the target
environment provides. `@supabase/ssr` and PostgREST accept the publishable key
wherever the anon key is expected (verified locally: REST and Auth return 200),
and the secret key wherever the service-role key is expected.

## Consequences

- No renaming churn across code, docs, or deploy assets; `.env.example`
  remains the single shape reference.
- The semantic contract is unchanged: the `ANON`-named var is the only
  client-shippable key; the `SERVICE_ROLE`-named var is server-only and
  bypasses RLS.
- Production (Supabase Cloud) may still issue legacy JWT keys depending on
  project settings — either format works under these names. Revisit only if
  Supabase deprecates one format.

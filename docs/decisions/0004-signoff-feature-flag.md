# ADR 0004 — Sign-off enforcement feature flag

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 1 (flag consumed), Phase 6 (flag flipped on)

## Context

`submit_response` must, from Phase 6, reject submission when a visible
`requires_signoff` section has no sign-off row. In Phases 1–5 the wizard treats
sign-off sections as ordinary sections and the check must be OFF, but the RPC
code that performs the check should already exist (avoid a behavioural fork
between phases).

## Decision

A tiny `app.feature_flags(key, enabled, description)` table seeded with
`('signoff_enforcement', false, ...)`. `submit_response` calls
`app.feature_enabled('signoff_enforcement')` and only runs the sign-off check
when it returns true. A one-line Phase 6 migration flips the row to `true`.

Both the table and the reader live in the `app` schema; `app.feature_enabled`
is `SECURITY DEFINER` so the check is unaffected by RLS and the flags table is
not exposed through the data API.

## Rationale

- The enforcement code path is written and tested once; Phase 6 is a data flip,
  not a code change to the RPC.
- A table (vs a hard-coded constant or a GUC) is introspectable, overridable in
  tests (a test can flip it within its transaction to assert the enforced
  behaviour), and a natural home for future flags.

## Consequences

- Phase 1 tests assert BOTH states: default-off (sign-off missing still submits)
  and forced-on within a test transaction (submission rejected with SQLSTATE
  `P0012`).
- The Phase 6 migration is `update app.feature_flags set enabled = true where
  key = 'signoff_enforcement';`.

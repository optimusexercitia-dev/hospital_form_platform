# ADR 0003 — pgTAP for database tests

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 1

## Context

Phase 1 requires proving RLS isolation, immutability triggers, the
`submit_response` RPC behaviour, and the condition evaluator at the database
level. The choices were plain SQL assertion scripts vs pgTAP.

## Decision

Use **pgTAP** (`1.3.3`, available in the local image). Tests live in
`supabase/tests/*.sql` and run via `npx supabase test db`, which installs the
extension into a throwaway test run, executes each file inside a rolled-back
transaction, and reports TAP.

## Rationale

- Native first-class support in the Supabase CLI (`supabase test db`) — one
  repeatable command, no bespoke runner.
- Rich assertions (`throws_ok`, `lives_ok`, `results_eq`, `is`, `ok`) make
  RLS-denial and trigger-rejection tests read clearly and fail with useful
  diagnostics.
- Role switching (`set local role`, `set local request.jwt.claims`) lets one
  test file exercise multiple personas against real policies.
- Each file runs in its own transaction and rolls back, so tests are isolated
  and do not depend on or mutate the seed.

## Consequences

- Tests assume pgTAP is present in the test database; the CLI handles this.
- Personas/fixtures needed by a test are created within that test's transaction
  (not relying on `seed.sql`), keeping tests hermetic.
- A separate Vitest covers the TypeScript condition-evaluator mirror against the
  shared vector file; the SQL evaluator is covered here. Both consume
  `src/lib/queries/__fixtures__/condition-vectors.json`.

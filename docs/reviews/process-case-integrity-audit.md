# Process / Case / Phase / Narrative — database integrity audit

- **Date:** 2026-08-04 · **Branch:** `db/process-case-integrity` · **ADR:** [0095](../decisions/0095-process-case-integrity-audit-remediation.md)
- **Method:** live catalog only (`pg_constraint`, `pg_policy`, `pg_trigger`, `pg_proc` incl.
  `prosecdef`, `information_schema.role_table_grants`). Migration text was never treated as
  truth (ADR 0078 A28).

## Verdict

The cluster's **snapshot discipline is genuinely good** — pinned `form_version_id`, frozen
custom-field definitions, denormalized `type_label`, a frozen per-case result set. Historical
cases survive catalog churn. The defects were not in the model; they were in the **substrate's
willingness to enforce it**. Every RPC door checked; the tables behind them did not.

## Findings and disposition

| # | Finding | Disposition |
|---|---|---|
| H1 | `case_phases` INSERT unguarded — a client could POST a phase born `completed`, bypassing the transition matrix; `recompute_case_status_trg` then fed it into the case status | **Fixed** (`…000100`) |
| H1-b | `app.in_case_rpc` forced `off` by an AFTER-trigger helper, silently closing its caller's window | **Fixed** (`…001100`) |
| H2 | Rule 11 breach: phase INSERTs and case DELETEs unaudited; four child tables had no triggers at all | **Fixed** (`…000200`) |
| H3 | Cross-commission integrity enforced only at the doors, for 8 columns | **Fixed** (`…000300`) |
| H4 | A deleted result left a dangling uuid in `result_ruleset` jsonb; `create_case_from_template` re-derived it and raised 23503, bricking every creation from that template | **Fixed** — *remedy corrected*, see below (`…000400`) |
| M1 | Templates mutable-while-active and unversioned; `template_id ON DELETE SET NULL` erases provenance | **Deferred** — phase-sized (ADR 0095 §3a) |
| M2 | `blocks[]` integrity arms present on the template side, absent on the case side | **Fixed** (`…001000`); join-table remodel deferred |
| M3 | `case_phase_offered_results` is case-grained despite its name | **Rename deferred**; "derive it" recommendation **withdrawn** |
| M4 | No way to express "this version belongs to this form" | **Fixed** (`…000500`) |
| M5 | `TRUNCATE`/`TRIGGER`/`REFERENCES` granted to `authenticated`/`anon`; **RLS does not gate TRUNCATE** | **Fixed** for the 18 cluster tables (`…000600`); platform-wide sweep left scoped out, query in the migration header |
| M6 | 18 unindexed FK columns | **Fixed** (`…000700`) |
| M7 | Bare `auth.uid()` in 15 child policies vs the initplan form in `cases_select` | **Fixed** (`…000800`) |
| M8/L1 | Ordering-constraint asymmetries; no narrative status/stamp pairing | **Fixed** (`…000900`) |

## Three audit recommendations the system disproved

The most reusable output. Each was implemented, then refuted by the existing suite or seed —
none by review.

1. **"Derive `case_phase_offered_results` as a view."** It is a deliberate frozen guard that
   `app.compute_case_phase_result` reads. Deriving it destroys the freeze and makes the guard
   circular.
2. **"Forbid deleting a referenced `phase_results` row."** `210_phase_result_junctions.sql`
   asserts the opposite as designed behaviour. The real defect was the derivation, not the
   delete. Note what that keystone measures: four *junction* tables — never the jsonb, which
   is exactly where the brick lived.
3. **"`blocks[]` is unvalidated."** True only for the case side; the template side already had
   both arms.

## What only the gates caught

Recorded because each was invisible to reading, review, and an incremental `migration up`:

- **The H1 guard was INERT as first written.** It tested `current_user in ('authenticated',
  'anon')` inside a `SECURITY DEFINER` function, where `current_user` is the *owner* — false
  for everyone, including a real client. It read correctly, applied cleanly, broke no test,
  and defended nothing. The pgTAP keystone caught it (`caught: no exception`). Fixed via
  `app.is_client_role()`, which reads the `role` GUC.
- **`db reset` caught two more** that `supabase migration up` did not: the seed's documented
  right to insert a `completed` phase under the RPC flag, and the GUC-clobbering that would
  have broken `create_case_from_template` for any template with ≥2 phases.
- **`177_processless_cases.sql` caught a layering error** — BEFORE triggers pre-empted the RLS
  denial the test pins by name. Moving every coherence guard to AFTER preserves Rule 1's
  ordering (RLS denies first; integrity guards catch what RLS permits).

The principle that emerged and is worth keeping: **invariants bind every role; door mirrors
bind the client boundary.** Blurring the two is what makes substrate guards break seeds and
suites.

## Verification

| Gate | Result |
|---|---|
| `supabase db reset --local` | clean, seed applies |
| `npm run test:db` | **157 files / 4819 tests — PASS** (was 156 / 4796) |
| Neutralization proof | `app.is_client_role` → t1 red; 3 guards neutralized → exactly t6/t19/t20 red, nothing else |
| `npm run test` (Vitest) | 54 files / 901 tests pass |
| `npm run lint` · `npm run typecheck` | pass |
| `ARM=floor` invariant | **INVARIANT HOLDS** |
| Diff-scoped door sweep | **0 BLIND**, 2 COVERED, 1 pre-existing harness ERROR |
| `npm run gen:types` | diff is *only* the composite FK — confirms `…000500` changed nothing else |

**E2E has not been run on this branch** — it is the remaining gate before merge.

## Open items

- `cases.cases_staff_admin_write` returns harness `ERROR` (`run-shape!=baseline`) in the door
  sweep. Reproduced with the new test file removed ⇒ pre-existing, not a regression. Per
  CLAUDE.md §6 an ERROR is not a pass; it needs its own keystone.
- `app.compute_case_phase_result` and `public.sync_case_phase_on_submit` still force
  `app.in_case_rpc` to `'off'` instead of restoring it — the same latent class as H1-b.
- The `TRUNCATE`/`TRIGGER`/`REFERENCES` over-grant almost certainly holds across the rest of
  the schema; only the 18 audited tables were revoked.

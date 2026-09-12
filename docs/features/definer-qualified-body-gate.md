---
id: DEFINER-QUALIFIED-BODY-GATE
title: "ADR 0208 D4's schema-qualified-body clause gets its gate: pgTAP 421 reads every empty-path DEFINER body, one arm per language"
status: in_progress
kind: fup-fix
program: AUTHZ
phase: "pre-AE5 remediation — ADR 0208 D4 second clause (PO ruled option (a) on 2026-09-11)"
branch: definer-qualified-body-gate   # cut from main @ 6fd0bfdb
plan: ../plans/authz-evolution.md
progress: ../progress/definer-qualified-body-gate.md
reviews: []
adrs: ["0208"]
handoff: ~
fup: FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED
---

# DEFINER-QUALIFIED-BODY-GATE — the second clause of D4 gets a gate

Closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` (its *Closes when* was
**PO to rule**; the PO ruled **option (a) — a catalog gate, pgTAP 421** on 2026-09-11). ADR 0208 D4 is
two clauses: `set search_path = ''` AND schema-qualified object references. pgTAP `419` + gate 18 hold
the PATH clause; nothing reads a function BODY. This unit adds the body half. No new ADR: D4's verbatim
ruling already states the convention; this builds its missing enforcer.

## Current state

**Updated:** 2026-09-12

### Objective
pgTAP `421_definer_qualified_body.sql`: every `prosecdef` function in `app`/`public`/`authz` whose
`proconfig` is `search_path=""` has a body that resolves under the empty path — measured by Postgres,
never by a hand parser. Two arms keyed on `pg_language`: **plpgsql** via `plpgsql_check_function_tb`
(honours `proconfig`), **sql** via re-executing `pg_get_functiondef(oid)` in a rolled-back savepoint
(`ALTER … SET search_path` never re-validates a body — the hole). Findings: `42P01` + `42883`;
exclusion: a `42P01` on a relation the SAME body creates by `create temp table`; residual held:
`execute` bodies = 0. Planted positive controls per arm; extension created INSIDE the test transaction.

### Done since start
- Lead spike (rolled back): both arms discriminate; population 29 = 18 plpgsql + 11 sql; 0 `execute`.
- `backend`: `421` built, `plan(16)`, RUN SHAPE `Files=2, Tests=17`; both arms green over the live
  population (`18 examined` / `11 visited | 0 findings`); five controls discriminating; mutation proof
  on copies (blinded exclusion → 2 red, dead sql arm → 1 red, dead plpgsql arm → 6 red). Results leave
  savepoints by `setval` on a temp sequence (temp-table rows do not survive a savepoint rollback).
- Five carriers re-worded from "UNGATED" to "gated by 421 + the `execute` bound"; `419` comment-only;
  rule file 2043/2048 bytes.
- **Gate step 1 closed (lead, 2026-09-12):** fresh reset → `npm run test:db` `Files=270, Tests=9062`
  PASS (re-earned on the final code); `npm run lint` rc 0 (18 gates); door sweep exit **3**
  NOT-APPLICABLE, `SCOPE: 0 file(s) — 0 committed (6fd0bfdb..HEAD), 0 worktree, 0 untracked`
  (zero migrations); authz arms census · hat · floor · `FROMFINDINGS=1` wrapper all rc 0.
- AC-1's no-splice deviation RULED accepted (record entry 2026-09-12). Three follow-ups filed.

### In progress
- Nothing; awaiting the PO's ruling on step 2.

### Next
- Step 2 (tester): PO to rule whether `npm run e2e:prod` is owed for a diff with no runtime surface
  (no migration, no `src/`, no policy) → step 3 QA review → step 4 PO approval → step 5 record.

### Blockers
- None.

## Acceptance criteria

- [x] **AC-1 — the file.** `supabase/tests/421_definer_qualified_body.sql`; domain = the empty-path
  DEFINER population. ⚠ RULED 2026-09-12 (lead): NOT a splice of `419 § 0` — gate 18 owns that text
  byte-for-byte, so 421 writes its own predicate and asserts the partition the splice was for:
  `§ 0c` pins `890 = 861 non-empty (419) + 29 empty (421) + 0 undeclared` as one string.
- [x] **AC-2 — the plpgsql arm.** `plpgsql_check_function_tb(oid, relid, fatal_errors => false)`,
  trigger functions given a `tgrelid` from `pg_trigger`; findings = `sqlstate in ('42P01','42883')`
  minus the in-body temp-table exclusion; expected 0 over the live population.
- [x] **AC-3 — the sql arm.** `execute pg_get_functiondef(oid)` per member inside a savepoint that is
  always rolled back; a raised `42P01`/`42883` is a finding; expected 0 over the live population.
- [x] **AC-4 — controls, both arms.** A planted plpgsql DEFINER and a planted sql DEFINER on `''` naming
  `profiles` unqualified each red in THEIR arm; a plant that creates temp `_x` and reads `profiles`
  unqualified still reds (the exclusion does not blind); a qualified twin passes. ⛔ A control that
  cannot red voids the arm.
- [x] **AC-5 — the residual is stated and held.** `count(*) where prosrc ~* '\mexecute\M' = 0` over the
  population, with the header saying WHY (dynamic SQL is opaque to both arms).
- [x] **AC-6 — the extension.** `create extension if not exists plpgsql_check with schema extensions`
  inside the file's transaction, rolled back with it; `pg_available_extensions` absent ⇒ a failing
  assertion, never a skip. ⛔ No migration installs it; the catalog is not touched.
- [x] **AC-7 — the carriers.** The five texts that say the body half is UNGATED are re-worded to name
  421 as its gate and the `execute` residual as the stated bound: `.claude/rules/migrations-forward-only.md:38-39`
  (stay ≤ 2048 bytes), `scripts/gen-definer-search-path-freeze.mjs` header, `419`'s header,
  `docs/backend-state/authorization-and-audit.md` seam bullet (`## Current state`) + a new dated slice,
  `docs/lint-gates.md` gate 18 paragraph. ⛔ `419` and `420` assertions unchanged.
- [x] **AC-8 — the gates.** `npm run test:db` on a fresh `supabase db reset` green with 421 in the run
  shape; `npm run lint` rc 0; door sweep over the diff RULED (exit 3 NOT-APPLICABLE: no migration).

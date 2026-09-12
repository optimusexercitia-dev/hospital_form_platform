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

**Updated:** 2026-09-11

### Objective
pgTAP `421_definer_qualified_body.sql`: every `prosecdef` function in `app`/`public`/`authz` whose
`proconfig` is `search_path=""` has a body that resolves under the empty path — measured by Postgres,
never by a hand parser. Two arms keyed on `pg_language`: **plpgsql** via `plpgsql_check_function_tb`
(honours `proconfig`; measured 2026-09-11), **sql** via re-executing `pg_get_functiondef(oid)` in a
rolled-back savepoint (the validator re-runs under the declared path; `ALTER … SET search_path` never
re-validates, which is the hole). Findings counted: `42P01` + `42883` only. Exclusion: a `42P01` whose
relation the SAME `prosrc` creates by `create temp[orary] table`. Residual held: bodies containing
`execute` must number 0 (dynamic SQL is invisible to both arms). Each arm carries a planted positive
control that MUST red, and a temp-vs-persistent discrimination plant. Extension created INSIDE the test
transaction; unavailable ⇒ red, never skip.

### Done since start
- Lead spike on the live catalog (rolled back): both arms discriminate; live population 29 = 18 plpgsql +
  11 sql, 0 findings outside the four temp-table bodies, 0 `execute`. Witnesses in the record.
- `backend`: **`supabase/tests/421_definer_qualified_body.sql` built**, `plan(16)`, RUN SHAPE
  `Files=2, Tests=17` (measured, not recalled). Both arms green over the live population
  (`18 examined` / `11 visited | 0 findings`), five planted controls all discriminating, the `execute`
  residual `0 of 29` stated as a bound. Extension created inside the transaction and gone after it.
- ⭐ **The brief's savepoint capture was unimplementable and was replaced, not worked around**: a
  `rollback to savepoint` discards temp-table rows written inside it, so the two mutating arms carry their
  result out by `setval` on a temp sequence (non-transactional, measured), seeded `0 = never ran`. Every
  assertion sits OUTSIDE every savepoint.
- **Mutation proof, three mutations on mutated COPIES** (the tracked file was never edited to red): the
  requested one — exclusion matches everything — reds `§ 3d` and `§ 3a` while `§ 1c` stays GREEN, i.e. only
  the controls can see a blinded exclusion; a dead sql arm reds `§ 2a` on `0 visited`; a dead plpgsql arm
  reds six.
- **The five carriers re-worded** from "UNGATED" to "gated by 421 + the `execute` bound", the follow-up
  cited as *closed by 421* rather than deleted. `419` is **comment-only** in the diff (its assertions and
  `§ 0` splice byte-unchanged); the rule file is 2043 bytes of its 2048 cap.
- **Gates:** fresh `supabase db reset --local` then `npm run test:db` → **`Files=270, Tests=9062` PASS**;
  `npm run lint` **rc 0** (18 gates).

### In progress
- Nothing. The build is complete and handed back to the lead.

### Next
- Gate step 1's remaining arms, which `backend` did NOT run: the authz arms (`census`, `hat`, `floor`,
  `FROMFINDINGS=1 wrapper`) and the diff-scoped door sweep over the diff — expect exit 1 NO DOORS, ruled
  option (a): a test file alters no door → tester → QA → PO approval → record.

### Blockers
- None.

## Acceptance criteria

- [x] **AC-1 — the file.** `supabase/tests/421_definer_qualified_body.sql`; domain = the empty-path
  DEFINER population, spliced from the same predicate `419 § 0` uses (an empty-path member is the
  complement of the frozen set within `414`'s population; the three must partition 890).
  ⚠ **Satisfied in intent, NOT by a splice, and the lead/QA should rule on that.** `419 § 0`'s block is
  compared byte-for-byte with `scripts/definer-search-path-census.sql` by gate 18, so copying it into 421
  would bind this file to a text the generator owns. 421 writes its OWN equivalent predicate and asserts
  the property the splice was for: `§ 0c` pins `890 = 861 non-empty (419) + 29 empty (421)` as one string,
  so a member acquiring a third form falls out of both gates and reds.
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
- [ ] **AC-8 — the gates.** `npm run test:db` on a fresh `supabase db reset` green with 421 in the run
  shape; `npm run lint` rc 0; door sweep over the diff RULED (a test file alters no door).

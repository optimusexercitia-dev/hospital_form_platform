---
id: DEFINER-QUALIFIED-BODY-GATE
title: "ADR 0208 D4's schema-qualified-body clause gets its gate: pgTAP 421 reads every empty-path DEFINER body, one arm per language"
status: complete
kind: fup-fix
program: AUTHZ
phase: "pre-AE5 remediation — ADR 0208 D4 second clause (PO ruled option (a) on 2026-09-11)"
branch: definer-qualified-body-gate   # cut from main @ 6fd0bfdb
plan: ../plans/authz-evolution.md
progress: ../progress/definer-qualified-body-gate.md
reviews: ["../reviews/definer-qualified-body-gate-review.md"]
adrs: ["0208"]
handoff: ~
fup: FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED
---

# DEFINER-QUALIFIED-BODY-GATE — the second clause of D4 gets a gate

Closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` (its *Closes when* was
**PO to rule**; the PO ruled **option (a) — a catalog gate, pgTAP 421** on 2026-09-11). ADR 0208 D4 is
two clauses: `set search_path = ''` AND schema-qualified object references. pgTAP `419` + gate 18 hold
the PATH clause; nothing read a function BODY. This unit added the body half. No new ADR: D4's verbatim
ruling already states the convention; this built its missing enforcer.

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
  cannot red voids the arm. (QA r1 added: a prefix plant `_xy`/`_x` and a comment/string plant, `§ 3f`/`§ 3g`.)
- [x] **AC-5 — the residual is stated and held.** `count(*) where prosrc ~* '\mexecute\M' = 0` over the
  population, with the header saying WHY (dynamic SQL is opaque to both arms).
- [x] **AC-6 — the extension.** `create extension if not exists plpgsql_check with schema extensions`
  inside the file's transaction, rolled back with it; `pg_available_extensions` absent ⇒ a failing
  assertion, never a skip. ⛔ No migration installs it; the catalog is not touched.
- [x] **AC-7 — the carriers.** The five texts that said the body half is UNGATED re-worded to name
  421 as its gate and TWO bounds (the `execute` residual; the temp-table exclusion, which does not scrub
  dollar-quoted text): `.claude/rules/migrations-forward-only.md` (2043/2048 bytes),
  `scripts/gen-definer-search-path-freeze.mjs` header, `419`'s header (comment-only),
  `docs/backend-state/authorization-and-audit.md` seam bullet + a dated slice, `docs/lint-gates.md` gate 18.
- [x] **AC-8 — the gates.** Fresh `supabase db reset` → `npm run test:db` `Files=270, Tests=9064` PASS;
  `npm run lint` rc 0; door sweep exit 3 NOT-APPLICABLE (no migration); census · hat · floor · wrapper rc 0.

**Complete 2026-09-12** — PO approved (*"Approved"*); step 2 ruled N/A by the PO (no runtime surface);
QA r1 + r2 APPROVED; ledger row in `docs/progress/phase-ledger.md`; detail in the
[record](../progress/definer-qualified-body-gate.md).

---
id: VITEST-ROLE-SET-PIN
title: "The two catalog-driven vitest suites pin the membership role SET to the manifest — one derived expected set, two independent live reads, set equality never a count"
status: in_progress
kind: fup-fix
fup: FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT
program: AUTHZ
phase: "post-AE5-ROLE-CATALOG-COMPAT — applies the manifest pin (gate 19 + pgTAP 411) to the two unit suites that generate their cases from the live memberships_role_check (test-only)"
branch: vitest-role-set-pin   # cut from main @ 297d6ba2
plan: ~
progress: ../progress/vitest-role-set-pin.md
reviews: ["../reviews/vitest-role-set-pin-review.md"]
adrs: ["0207"]
handoff: ~
---

# VITEST-ROLE-SET-PIN — the role SET, pinned in both catalog-driven suites

Closes `FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT` on its clause as **RE-CLAUSED 2026-09-13** (PO ruling
on the lead's recommendation, after `AE5-ROLE-CATALOG-COMPAT`). Two unit suites read
`public.memberships_role_check` from the LIVE database at import and generate one test per role
returned (`session-grants.test.ts` — one `it.each`; `nav-scope-exclusivity.test.ts` — two), so a
read taken inside a `db reset`'s transient window shrinks coverage and reports green. pgTAP `292`
pins the vocabulary durably but structurally cannot see that window. This unit pins the SET each
read must equal, derived from `ROLE_MANIFEST` (every entry whose `scopeKind` is not `none`), which
gate 19 + pgTAP `411` already bind to `authz.roles` — so no new hand-typed literal exists. ⛔ Not
folded into `AE4-D-SHAPE-ASSERTION` (different subject, different close condition). Test-only: no
migration, no `src/` behaviour change, no policy.

## Acceptance criteria

- [x] **AC-1 — one exported FUNCTION, never a module-scope `const`.** A shared module exports
      `expectedMembershipRoleVocabulary()` deriving the sorted expected set from `ROLE_MANIFEST`
      (`scopeKind !== "none"`); each read is explicit at its call site, so the read count never
      depends on Vitest's `pool` / `isolate` defaults (unpinned in `vitest.config.mts`).
- [x] **AC-2 — two independent live reads KEPT; SET equality asserted in each.** Both suites keep
      their own catalog read (top-level in `session-grants`, `describe`-scope in
      `nav-scope-exclusivity`, as before) and assert `[...read].sort()` `toEqual` the derived set —
      never `.length`. Two reads pinned to one constant are the instrument that observes a catalog
      change between them; they are not collapsed.
- [x] **AC-3 — one reader definition, two call sites.** The two copy-pasted
      `readRoleVocabularyFromCatalog` regexes collapse into the shared module; the fail-closed throws
      (stack down; zero roles) are preserved and still name the calling guard.
- [x] **AC-4 — red-first witness.** The new assertion observed RED in each suite against a planted
      short read (one role filtered out of the live read), then green on the real read; both
      outputs quoted in the record.
- [x] **AC-5 — gates.** Fresh `supabase db reset --local` with the stack up → `npm run test` PASS;
      `npm run lint` rc 0 (0 errors, 0 warnings); `npm run typecheck` rc 0. `test:db`, the authz
      arms, the door sweep and `e2e:prod` are NOT owed (no migration, no `src/` behaviour change)
      and the record says so.
- [ ] **AC-6 — QA review APPROVED, PO approval, Record step** — entry moved verbatim to the archive
      with the body folded inline, body file deleted, ledger row, hub to `complete`, `main`
      fast-forwarded, ⛔ not pushed.

## Current state

**Updated:** 2026-09-13

### Objective
Pin the membership role SET in both catalog-driven suites against one manifest-derived function, on the
follow-up's re-claused condition (a)–(d), test-only.

### Done since start
Peers cleared; branch cut from `main @ 297d6ba2`. Built (`a8aeeb25`): one `.test-support.ts` module with
two exported functions and no module-scope value; both suites keep their own read and pin it to the derived
set. Red-first witnessed twice (short read: 37 → 34 tests, both pins red; substitution: count unchanged, pin
red). Gates on a fresh reset: `npm run test` 154 files / 2094 PASS, `npm run lint` rc 0 (19 gates),
`npm run typecheck` rc 0. `test:db`, authz arms, door sweep, `e2e:prod` NOT owed (test-only).

QA r1 **APPROVED** (0 BLOCK / 0 MAJOR / 1 MINOR — record's `main..HEAD` range, corrected in place / 4 NOTE);
QA re-ran both red-first plants itself and the full vitest (2094).

### In progress
Presented for PO approval (step 4).

### Next
On approval, the Record step (entry to the archive with the body folded, body file deleted, ledger row, hub
to complete, fast-forward `main`, no push).

### Blockers
None.

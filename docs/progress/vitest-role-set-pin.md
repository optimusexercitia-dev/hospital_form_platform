# VITEST-ROLE-SET-PIN — progress record

> Hub: [vitest-role-set-pin.md](../features/vitest-role-set-pin.md) · branch `vitest-role-set-pin`,
> cut from `main @ 297d6ba2` · closes `FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT` on its clause as
> **RE-CLAUSED 2026-09-13** (owner: backend + frontend). Test-only: no migration, no `src/`
> behaviour change, no policy.

## Session log

### 2026-09-13 — unit opened; peers cleared; hub + record written; branch cut

**Tree at open.** `main @ 297d6ba2`, clean (the second documentation pass after
`AE4-D-SHAPE-ASSERTION`). `git worktree list` shows the primary checkout only. `ListAgents` shows no
other session on this checkout — the eleven peers are two `scheduler-platform` sessions (a different
repo) and nine offline Remote Control sessions. `AE4-D-SHAPE-ASSERTION`, which the brief warned
might be running in a separate session on this checkout, is already **complete** (hub status,
ledger row, phase commit `a3a2a71d`, branch deleted) — so the shared-HEAD / shared-DB hazard
(`docs/worktrees.md` §1) does not apply at open. `pg_stat_activity` on
`supabase_db_azkbbhskturikxpgmafq` (client backends): PostgREST, `supabase_mt_realtime` ×5,
`cluster_node_realtime` ×2 and this probe — no `psql`, no pgTAP, no reset in flight. Re-checked
before the reset at gate step 1.

**The subject, measured before anything was written.** The live `memberships_role_check`
vocabulary, read exactly as the two suites read it (`docker exec … psql -tAc` over
`pg_get_constraintdef` + `regexp_matches`): `org_admin`, `nsp_org_admin`, `hospital_admin`,
`nsp_coordinator`, `staff_admin`, `staff`, `pqs_member`, `technical_director`,
`technical_director_deputy`, `quality_reviewer` — ten. `ROLE_MANIFEST` in
`src/lib/role/role-catalog.ts` carries eleven entries; the one with `scopeKind: "none"` is
`platform_admin` (lives in `profiles.is_admin`, holds no `memberships` row). ⇒ *"every entry whose
scope kind is not `none`"* is exactly the live CHECK's set today, which is what the clause predicts
and what the set-equality assertion will measure on every run.

**Where the reads and the generated blocks are today** (the follow-up body's table, re-verified on
`297d6ba2`): `session-grants.test.ts` — reader at `:71`, top-level `const CATALOG_ROLES` at `:202`,
one `it.each` at `:233` (plus three `for` loops inside single tests, which change what an assertion
iterates, not how many tests exist); `nav-scope-exclusivity.test.ts` — reader at `:74`, `const ROLES`
inside the `describe` at `:237`, `it.each(ROLES)` at `:262` and `:289`. The two reader bodies differ
only in the guard name inside their error messages (`FUP-QO-2 guard:` vs `ACT S4 nav-scope guard:`)
and in line-wrapping.

**Design fixed at open.** One new test-support module, `src/lib/role/membership-role-vocabulary.test-support.ts`
— ⚠ the `.test-support.ts` suffix is deliberate: `vitest.config.mts` includes only
`src/**/*.{test,spec}.{ts,tsx}`, so the module is never collected as a suite, and it stays under
`src/` so the `@/` alias and eslint's first-party scope both reach it. It exports two FUNCTIONS and
no module-scope value: `expectedMembershipRoleVocabulary()` (the manifest filter, sorted) and
`readRoleVocabularyFromCatalog(guardName)` (the one reader; the guard name keeps each suite's
fail-closed message naming its own caller). Each suite keeps its own top-level read and gains one
`it` asserting `[...read].sort()` `toEqual` the derived set. ⛔ Nothing in `role-catalog.ts` changes —
adding an export there would be a `src/` production edit for a test-only consumer, and gate 19 parses
that file as text.

**What is NOT owed, and why.** No migration and no `src/` behaviour change ⇒ `npm run test:db`, the
four authz arms, the diff-scoped door sweep and `npm run e2e:prod` are not claimed — the same ruling
`AE4-D-SHAPE-ASSERTION` and `DEFINER-QUALIFIED-BODY-GATE` carried for their test-only diffs. What IS
owed: `npm run test` on a fresh `supabase db reset --local` with the stack up (the two suites need the
live catalog), `npm run lint` 0/0, `npm run typecheck`.

**No ADR.** Nothing here is a decision: the follow-up's re-claused clause names the shape, ADR 0207 D4
supplies the manifest and its pin. Highest ADR on any branch: 0210, untouched.

### 2026-09-13 — built; red-first witnessed both ways; the three owed gates green (lead, solo — test-only unit)

**Delegation.** Run solo by the lead as a test-only unit of three files: no schema, no RLS, no
`src/` behaviour, no UI — none of the four teammate scopes is engaged beyond `qa`, which is spawned
for step 3. (CLAUDE.md §4's lead-does-not-write-feature-code rule is about feature code; this diff
moves two test helpers into one and adds two assertions.)

**What landed** (`a8aeeb25`, on top of the open commit `3b48f9d0`; `git diff --stat main..HEAD`:
6 files, +303 / −135 including the three docs):

- `src/lib/role/membership-role-vocabulary.test-support.ts` — NEW. Exports exactly two functions
  and no module-scope value: `expectedMembershipRoleVocabulary()` (=
  `ROLE_MANIFEST.filter(scopeKind !== 'none').map(code).sort()`) and
  `readRoleVocabularyFromCatalog(guardName)` (the one reader — the `docker exec … psql -tAc` over
  `pg_get_constraintdef` + `regexp_matches`, byte-for-byte the SQL both suites carried; the two
  fail-closed throws — stack down, zero roles — kept, prefixed with the caller's guard name).
  `grep -c "^const\|^export const\|^let " …test-support.ts` → **0**. ⚠ `REPO_ROOT` is computed
  INSIDE the reader, not at module scope, for the same reason.
- `src/lib/queries/session-grants.test.ts` — the copy-pasted reader (66 lines) and its three
  `node:` imports removed; `const CATALOG_ROLES = readRoleVocabularyFromCatalog('FUP-QO-2 guard')`
  stays at top level (its OWN read); one new `it` first in the `describe`:
  `expect([...CATALOG_ROLES].sort()).toEqual(expectedMembershipRoleVocabulary())`.
- `src/components/shell/nav-scope-exclusivity.test.ts` — same removal (54 lines); `const ROLES =
  readRoleVocabularyFromCatalog('ACT S4 nav-scope guard')` stays inside the `describe` (its OWN
  read); one new `it` after the `beforeEach`, same assertion over `ROLES`.
- ⛔ `src/lib/role/role-catalog.ts` untouched (gate 19 parses it as text; `lint:role-manifest`
  reports *"in sync (11 roles)"* unchanged).

**Clause (a)–(d) mapped to the diff.** (a) `expectedMembershipRoleVocabulary` — a FUNCTION, from
`ROLE_MANIFEST`, `scopeKind !== 'none'`, no literal anywhere in the diff names a role. (b) two reads
kept — `CATALOG_ROLES` and `ROLES` are each their own call of the reader; each file asserts SET
equality, `[...read].sort()` `toEqual` the derived set; ⛔ neither file asserts `.length` against
the set (`session-grants`' pre-existing `toBeGreaterThan(0)` non-triviality check stays — it is a
different, weaker claim and was never the pin). (c) one definition of the reader, two call sites;
fail-closed messages preserved. (d) below.

**Red-first witness — the short read (the clause's plant).** Each suite's read planted with one role
filtered out (`.filter((r) => r !== 'staff')` in `session-grants`, `… !== 'quality_reviewer'` in
`nav-scope-exclusivity`), same run:

```
 × the live memberships_role_check vocabulary IS the manifest-derived role set   (nav-scope-exclusivity)
 × the live memberships_role_check vocabulary IS the manifest-derived role set   (session-grants)
AssertionError: expected [ 'hospital_admin', …(8) ] to deeply equal [ 'hospital_admin', …(9) ]
-   "quality_reviewer"          (nav-scope-exclusivity)
-   "staff"                     (session-grants)
 Test Files  2 failed (2)
      Tests  2 failed | 32 passed (34)          ← 37 on the real read: 3 generated cases GONE (1 + 2 blocks)
```

The shrunk run — **37 → 34**, exactly one case per generated block per missing role — is the
follow-up's observed failure reproduced on purpose, and the two pins are what red on it.

**Red-first witness — the substitution (the case `.length` cannot see).** `session-grants`' read
planted with `.map((r) => (r === 'staff' ? 'stafx' : r))`: the count stays **10 = 10**, the pin
reds (`- "staff" / + "stafx"`), and the generated case *"a principal holding only `stafx` lands
somewhere"* reds too (FUP-QO-2's own detector, correctly, on a role that is not real). Un-planted
(`grep -c PLANT` → 0 in both files), re-run: **2 files, 37 passed**.

**Gates, on the committed bytes (`a8aeeb25`).**

| gate | result |
| --- | --- |
| `pg_stat_activity` before the reset | 1 client backend outside the stack's own (the idle `SELECT pg_backend_pid()` session seen at open — not a `psql`, not pgTAP, not a reset) |
| `supabase db reset --local` | rc 0 — *"Finished supabase db reset on branch vitest-role-set-pin"* |
| `npm run test` (full vitest, stack up, fresh reset) | rc 0 — **Test Files 154 passed, Tests 2094 passed** (⚠ the count is stated as a witness of the run shape, 2092 + 2 new, ⛔ never as gate evidence — the follow-up body's own rule) |
| `npm run lint` | rc 0 — 19 gates; the only `warning|error` grep hit is the chain's echo of `--max-warnings=0` |
| `npm run typecheck` | rc 0 |
| `npx eslint --max-warnings=0` on the three files | rc 0 |

**NOT owed, and not claimed:** `npm run test:db`, the four authz arms (`census`, `hat`, `floor`,
`FROMFINDINGS=1 wrapper`), the diff-scoped door sweep, `npm run e2e:prod` — no migration, no
policy, no `src/` behaviour change (`git diff main..HEAD --stat -- supabase/ e2e/` is empty; the
only non-test `src/` file is the new `.test-support.ts`, imported by nothing in the application).
`docs/backend-state/`: no slice — the backend surface is untouched and nothing was RULED on a seam's
subject.

**Line endings.** `.gitattributes` normalises to LF (`i/lf w/crlf`); the two edited suites were
CRLF in the working tree and are LF in the index, as before; the new module is LF both sides.

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

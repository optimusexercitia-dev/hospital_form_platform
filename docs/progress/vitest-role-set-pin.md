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

**What landed** (`a8aeeb25`, on top of the open commit `3b48f9d0`; `git diff --stat main..a8aeeb25`:
6 files, +303 / −135 including the three docs — ⚠ first written as `main..HEAD`, which is true only at
`a8aeeb25` and reads +387 / −135 from the commit this record lives on; QA r1 MINOR-1, corrected in
place in this session's own draft):

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

### 2026-09-13 — QA r1 APPROVED; MINOR-1 corrected in place; NOTE-4 filed as a follow-up; presented for PO approval (lead)

**QA r1** (`qa`, read-only, [review](../reviews/vitest-role-set-pin-review.md)): **APPROVED — 0 BLOCK / 0
MAJOR / 1 MINOR / 4 NOTE**. QA re-planted BOTH red-first witnesses itself (short read → `2 failed | 32
passed (34)`, both pins red on the filtered role; substitution → count held at 37, pin red), re-ran the
full vitest (**2094**), `npm run lint` rc 0 read bare (19 gates), `npm run typecheck` rc 0,
`check-docs-registers` rc 0, `npx vitest list` showing `.test-support.ts` NOT collected, and measured the
not-owed claim (empty `supabase/` + `e2e/` diff, zero app importers) rather than accepting it.

- **MINOR-1** — the record's *"`git diff --stat main..HEAD`: +303 / −135"* is true only at `a8aeeb25`
  (+387 / −135 from the commit the record lives on). Corrected in place as `main..a8aeeb25` with a dated
  marker — this session's own draft, not a historical record.
- **NOTE-1** — QA's own `git checkout --` reverts rewrote both suites to LF in ITS working tree, so the
  record's *"CRLF in the working tree"* sentence is no longer falsifiable there; committed bytes are LF
  regardless. Left as written (it described the lead's tree at the time).
- **NOTE-2** — the record's own `grep -c "^const\|^export const\|^let "` cannot see `var` / `export let` /
  indented bindings; QA's wider `^(export )?(const|let|var) ` also reads **0**. Claim true, instrument
  narrower than the claim — noted, not re-measured into the earlier entry.
- **NOTE-3** — hub AC-2 said *"own top-level catalog read"* for both suites; `nav-scope-exclusivity`'s
  is `describe`-scope (unchanged from before). Hub wording corrected.
- **NOTE-4** — containment widened: an unexported test-local became an exported `docker exec` reader in a
  non-test `src/` module, kept out of app code by prose. Filed as
  `FUP-VITEST-ROLE-SET-PIN-TEST-SUPPORT-MODULE-IS-APP-IMPORTABLE` (🟢 low, `PO to rule`).
- **In the unit's favour** (QA): `memberships_role_scope_kind_fkey` is `(role, scope_kind) →
  authz.roles(code, allowed_scope_kind) MATCH FULL`, so a `scopeKind: none` role structurally cannot
  hold a `memberships` row — the derivation's `!== 'none'` filter is catalog-enforced, not merely true
  today.

**Presented for PO approval** (step 4) with: built · gates (test on a fresh reset, lint, typecheck) ·
QA APPROVED · open risks = NOTE-4 (filed). Waiting.

### 2026-09-13 — documentation sweep on the PO's instruction: every carrier of the old shape found and corrected beside the original (lead)

**Instrument.** An Explore sweep over `docs/**`, the root trackers, `.claude/rules` + `agents`, pgTAP headers,
script headers and `src/` comments for: both suite paths, `readRoleVocabularyFromCatalog`, the follow-up id,
`FUP-QO-2` as the reader, `docker exec` beside vitest, `.test-support`, and `memberships_role_check` beside
"generated"/"3N". Verdict per hit: STALE / INCOMPLETE / OK.

**Corrected (appended, dated — frozen text never rewritten):**
- `docs/plans/case-referral-usability-batch.md` § *The mechanism, demonstrated* — said the partial-CHECK window
  *"PASSES with fewer tests"* and that `session-grants.test.ts` shells `docker exec` itself: STALE on both. A dated
  blockquote under the paragraph names the pin, the shared module and the 37 → 34 witness; the operational rule
  (one owner of the stack at gate time) is kept — the pin makes the window LOUD, not absent.
- `docs/progress/ae5-role-catalog-compat.md` — its last word on the follow-up was *"RE-CLAUSED, stays open"*: a
  dated sub-bullet beneath it names this unit and that the entry moves at the Record step.
- `docs/backend-state/authorization-and-audit.md` — the unrouted-role guard bullet (frozen § QO·FUP) predates the
  shared reader and the pin: `⚠ Superseded` marker under it naming the new slice; a new frozen slice appended
  (test-only, ⛔ no migration); ONE new Invariants bullet in `## Current state` (folded to one line — the block was at
  99 of the 100-line ratchet, [G]) and the slice added to § Where the detail lives. Gate 16 rc 0 after the fold;
  file 185 KB, under the 200 KB warn line.

**Left as-is, with the reason:** the register entry (moves at the Record step on approval — the one statement the
tree still contradicts); the follow-up body (archived verbatim); seven dated review/record sentences quoting
21/21 · 14/14 · 35-test counts for the two suites (true at their date; now 22 · 15 · 37 — frozen reviews, and the
follow-up's own rule is that a vitest count is never gate evidence); `.claude/claude-md-review-queue.md:90`
(gitignored, per-clone; triaged at `/review-claude-md`). Generated registries: none need a re-run —
`gen-data-access-surface.mjs` walks `src/lib/queries/*.ts` + `*actions.ts` only, gate 19 keys on
`role-catalog.ts` alone, and `check-memberships-door.mjs` (which walks all of `src/`) stays green.

### 2026-09-13 — step 4 human approval; step 5 Record (lead)

**Approval.** PO: *"Approved"* (2026-09-13), on the presentation: built · gates (fresh reset + `test`, `lint`,
`typecheck`) · QA APPROVED · open risk = the filed NOTE-4 follow-up. Scope of the approval as written: the
unit as presented plus the documentation sweep committed at `38bf496e`; nothing wider.

**Record step, in the gate's order.** (1) The archive appended FIRST: heading verbatim + ` — ✅ RESOLVED
2026-09-13`, a `> **RESOLVED …**` note (vehicle, record, commits, the clause closed on, the bound not
reached, the follow-up filed), then the entry block VERBATIM — `Filed` / `Closes when` / `Status: open` at
column 0 — with its one `Body:` pointer reworded to say the file is folded in (gate 13 reds on the literal
token), then the body with every heading demoted three levels (`#` → `####` naming the same id; `##` →
`#####`), 105 lines. Verified by substring containment of the entry block and the body at the destination
BEFORE cutting the source (the script throws otherwise). (2) The seven source lines cut;
`grep -c FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT follow-ups-open.md` → **0**. (3) The body file deleted. (4)
`check-docs-registers` rc 0 after the move (retired-citation scan included). ⚠ The QA review's header link to
the body file now dangles; a dated note beside it says where the text went — the review is QA's artifact and
is not rewritten. (5) Ledger row appended (commit cell `_pending_` until the phase commit exists — filled by a
follow-on docs commit, the shape every recent row uses). (6) Hub → `complete`: `## Current state` cut (into
this record, as gate 13 requires), AC-6 ticked, `branch: ~` with the fast-forward noted, the Complete line.
(7) `npm run features:index`; `lint:registers` + `lint:progress` + the full `npm run lint` bare. (8) Commit
`phase(VITEST-ROLE-SET-PIN): complete — …`; `main` fast-forwarded; branch deleted; ⛔ not pushed.

**`docs/backend-state/`** — already extended at the sweep commit `38bf496e` (slice + current-state
invariant + marker); nothing further at the Record step. **No ADR** ⇒ no `adr:index`. **Review queue**
(`.claude/claude-md-review-queue.md`, gitignored): carries this session's opening prompt as an entry pointing
at the now-archived register heading — for `/review-claude-md`, not this unit.

**Rulings taken vs landed (playbook §4 item 8).** One ruling: the PO's approval, landed in the ledger row's
Human ✓ cell, the hub's Complete line and the archive's closure note. The NOTE-4 disposition is a filed
follow-up with `PO to rule`, not a ruling.

**Phase commit `136501e8`** — `main` fast-forwarded to it 2026-09-13 (no merge commit), branch `vitest-role-set-pin` deleted, ⛔ not pushed; the ledger row's commit cell filled by the sha-fill commit that follows.

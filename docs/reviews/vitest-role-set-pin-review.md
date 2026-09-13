# VITEST-ROLE-SET-PIN — QA review

> Unit hub: [vitest-role-set-pin.md](../features/vitest-role-set-pin.md) ·
> record: [vitest-role-set-pin.md](../progress/vitest-role-set-pin.md) ·
> follow-up: [FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT.md](../followups/FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT.md)
> (⚠ 2026-09-13, lead, at the Record step: that body file is now folded into `../followups/follow-ups-archive.md` under the entry's heading and deleted — link kept as written)
> (binding close condition = its last section, **RE-CLAUSED 2026-09-13**, clauses (a)–(d)) ·
> branch `vitest-role-set-pin`, base `main @ 297d6ba2`, reviewed range `297d6ba2..037f0f0d`
> (3 commits: `3b48f9d0` open · `a8aeeb25` code · `037f0f0d` docs), 6 files / +387 / −135.
> Test-only: no migration, no policy, no `src/` behaviour change.
> Reviewer: `qa`, 2026-09-13. Read-only on everything but this report.

**Verdict: APPROVED**

Counts — **BLOCK 0 · MAJOR 0 · MINOR 1 · NOTE 4**.

Every clause (a)–(d) of the re-claused close condition is met, and I re-derived the load-bearing
claims myself rather than reading them off the record: I re-planted **both** red-first witnesses
(short read and substitution), observed the pins red with the exact shrink the record quotes
(37 → 34) and the exact count-blind case the record quotes (37 → 37, pin still red), reverted both
plants and confirmed the tree byte-identical to `HEAD`. The single MINOR is a command/figure
mismatch inside the record — the quoted `git diff --stat main..HEAD` figure is the one from
`a8aeeb25`, not from the commit the record itself lives on. Nothing about the code, the pin, or
the gates is affected.

---

## 1. What I measured myself (not read off the record or hub)

| Claim | How I checked it | Result |
|---|---|---|
| No migration / no `e2e` in the diff (the basis for not owing `test:db`, the four authz arms, the door sweep, `e2e:prod`) | `git diff main..HEAD --stat -- supabase/ e2e/` | ✅ **empty** |
| The only non-test `src/` file is the new module | `git diff main..HEAD --stat` | ✅ 6 files: the new `.test-support.ts`, the two `*.test.ts` suites, hub, record, `docs/features/INDEX.md` |
| …and nothing in the application imports it | `grep -rn "membership-role-vocabulary" src/ e2e/ scripts/` | ✅ 4 hits, all inside the two test suites (2 imports + 2 prose mentions); zero app importers |
| AC-1 — **no module-scope value binding** in the new module | `grep -nE "^(export )?(const\|let\|var) " src/lib/role/membership-role-vocabulary.test-support.ts` **and** reading the file end-to-end | ✅ **0 matches**; the file contains exactly two `export function` declarations (`:61`, `:81`) and nothing else at module scope. `REPO_ROOT` is gone — `const repoRoot` is computed **inside** the reader (`:82`) |
| AC-1 — the derivation is the manifest filter, sorted | read `:61-65` | ✅ `ROLE_MANIFEST.filter((entry) => entry.scopeKind !== 'none').map((entry) => entry.code).sort()` — filters a copy, never mutates `ROLE_MANIFEST` |
| **No new hand-typed role literal anywhere in the diff** | `git diff main..HEAD -- src/ \| grep -E "^\+" \| grep -oE "'(platform_admin\|org_admin\|hospital_admin\|staff_admin\|staff\|nsp_org_admin\|nsp_coordinator\|pqs_member\|technical_director\|technical_director_deputy\|quality_reviewer)'"` | ✅ **zero hits** on added lines |
| AC-3 — **one** reader definition, **two** call sites | `grep -rn "readRoleVocabularyFromCatalog" src/` | ✅ 1 definition (`membership-role-vocabulary.test-support.ts:81`) + 2 imports + **2 calls**: `session-grants.test.ts:138` (`'FUP-QO-2 guard'`), `nav-scope-exclusivity.test.ts:185` (`'ACT S4 nav-scope guard'`) |
| AC-2 — SET equality, not `.length`, in **each** file | `grep -rn "expectedMembershipRoleVocabulary" src/` + reading both assertions | ✅ `session-grants.test.ts:172` `expect([...CATALOG_ROLES].sort()).toEqual(expectedMembershipRoleVocabulary())`; `nav-scope-exclusivity.test.ts:202` same over `ROLES`. Both sort a **copy**, so `it.each`'s iteration order is untouched |
| The reader's SQL survived the move byte-for-byte | `git show 297d6ba2:src/lib/queries/session-grants.test.ts` `:81-84` vs new module `:91-94` | ✅ identical text (same `regexp_matches` over `pg_get_constraintdef`, same `conrelid`/`conname` predicates) |
| Both fail-closed throws preserved, each still naming its caller | diffed the removed bodies (`297d6ba2` blobs of both suites) against the new module `:87-89`, `:103-110`, `:117-123` | ✅ all three throws kept (`no project_id`, `could not read … must never silently skip`, `yielded ZERO roles … vacuous`), with `${guardName}` substituted for the two hardcoded guard names — so each message still says WHICH guard could not read |
| The `.test-support.ts` suffix is outside vitest's include glob | `cat vitest.config.mts` (`include: ['src/**/*.{test,spec}.{ts,tsx}']`) **and** `npx vitest list --filesOnly \| grep -i test-support` | ✅ include glob cannot match `.test-support.ts`; collection listing does **not** contain the file (grep rc 1) |
| The live vocabulary today | `docker exec supabase_db_azkbbhskturikxpgmafq psql -tAc …` (the suites' own SQL) | ✅ **10** roles: `hospital_admin`, `nsp_coordinator`, `nsp_org_admin`, `org_admin`, `pqs_member`, `quality_reviewer`, `staff`, `staff_admin`, `technical_director`, `technical_director_deputy` |
| …equals the manifest projection | `grep -n scopeKind src/lib/role/role-catalog.ts` | ✅ 11 entries, exactly one `scopeKind: "none"` (`platform_admin`) ⇒ derived set = 10, identical to the live CHECK |
| …and the premise is **structural**, not merely empirical | `\d authz.roles` | ✅ `memberships_role_scope_kind_fkey` is `(role, scope_kind) → authz.roles(code, allowed_scope_kind) MATCH FULL` — a role whose `allowed_scope_kind` is `none` can hold no `memberships` row at all. `authz.roles` today: 11 rows, one `none` (`platform_admin`, `system_managed = t`) |
| **The two suites green, unplanted** | `npx vitest run src/lib/queries/session-grants.test.ts src/components/shell/nav-scope-exclusivity.test.ts` | ✅ **Test Files 2 passed (2) · Tests 37 passed (37)** |
| AC-4 — **red-first witness A, short read, re-planted by me** | appended `.filter((r) => r !== 'staff')` to `session-grants`' read and `.filter((r) => r !== 'quality_reviewer')` to `nav-scope`'s, re-ran both files | ✅ **both pins red**; `AssertionError: expected [ 'hospital_admin', …(8) ] to deeply equal [ 'hospital_admin', …(9) ]`, `- "staff"` / `- "quality_reviewer"`; **Tests 2 failed \| 32 passed (34)** — the run shrank 37 → 34, exactly one generated case per block per missing role. Reproduces the record verbatim |
| AC-4 — **red-first witness B, substitution, re-planted by me** (the case `.length` cannot see) | appended `.map((r) => (r === 'staff' ? 'stafx' : r))` to `session-grants`' read, re-ran | ✅ count **unchanged at 37**, pin red (`+ "stafx"`), and FUP-QO-2's own generated case *"a principal holding only `stafx` lands somewhere"* red too. **Tests 2 failed \| 35 passed (37)** — a `.length` assertion would have been green here |
| Both plants reverted; tree restored | `git checkout -- <files>`; `grep -c PLANT`/`PLANT2`; `git diff HEAD --stat`; `git status --porcelain`; `git stash list` | ✅ 0 plant markers, **empty diff vs `HEAD`**, **clean status**, no stash. `HEAD` = `037f0f0d` |
| `npm run lint` — **bare exit code**, not through a pipe | `npm run lint > file 2>&1; echo $?` | ✅ **rc 0** |
| …19 gates, as the record says | `node -e` over `package.json`'s `lint` script, split on `&&` | ✅ **19** (`eslint --max-warnings=0` + 18 `lint:*`) |
| …and the record's "only `warning\|error` hit is the chain's echo" | `grep -niE "warning\|error"` over the captured output | ✅ exactly **1** hit — line 3, npm's echo of the chain itself |
| `lint:role-manifest` unchanged | inside the same run | ✅ *"in sync (11 roles; artifact == ROLE_MANIFEST on code/scope_kind/session_selectable)"* |
| `npm run typecheck` — bare exit code | `npm run typecheck > file 2>&1; echo $?` | ✅ **rc 0** |
| `npx eslint --max-warnings=0` on the three changed code files | direct invocation | ✅ **rc 0** |
| Full vitest count the record quotes | `npm run test` (stack up) | ✅ **rc 0 — Test Files 154 passed (154) · Tests 2094 passed (2094)** — exactly the record's figure, and 2092 + 2 against the `AE4-D-SHAPE-ASSERTION` ledger row's 2092 |
| `node scripts/check-docs-registers.mjs` | direct invocation | ✅ **rc 0** — 34 hubs, 32 records, 106 ledger rows, every ratchet at or under its cap |
| `docs/features/INDEX.md` counts add up | read the diff | ✅ **34 hubs** = in progress 1 + gated 3 + planned 2 + parked 0 + complete 28; the new row is sorted first, as ADR 0186 D1–D2 requires |
| The record's cited base-blob line numbers | `git show 297d6ba2:<file> \| grep -nE …` | ✅ all exact — `session-grants`: reader `:71`, `const CATALOG_ROLES` `:202`, `it.each` `:233`; `nav-scope`: reader `:74`, `const ROLES` `:237`, `it.each` `:262` **and** `:289` |
| The record's "highest ADR on any branch: 0210" | `git ls-tree -r --name-only <branch> -- docs/decisions/` over all 5 local branches | ✅ max **0210** (on `definer-undeclared-class-remedy` and `main`); no ADR added by this unit, so no numbering hazard |
| The record's claim that `AE4-D-SHAPE-ASSERTION` was complete at open | `git branch -a`; ledger row `:160` | ✅ branch absent, ledger row `✅ complete 2026-09-13`, phase commit `a3a2a71d` — as stated |
| No `PROGRESS.md` row is owed | read `PROGRESS.md` § Phase Status | ✅ the section carries only not-yet-started phases + DLB; in-flight units live in `docs/features/INDEX.md`. Consistent with `AE4-D-SHAPE-ASSERTION`, whose row appeared only in the ledger at its Record step |
| The record's `git diff --stat main..HEAD` figure | `git diff main..a8aeeb25 --stat` vs `git diff main..HEAD --stat` | ⚠ **+303 / −135 at `a8aeeb25`** (matches) but **+387 / −135 at `HEAD`** — see MINOR-1 |

---

## 2. Clause (a)–(d) of the binding close condition

**(a) ONE shared exported FUNCTION, never a module-scope `const` — MET.**
`src/lib/role/membership-role-vocabulary.test-support.ts` exports `expectedMembershipRoleVocabulary()`
and `readRoleVocabularyFromCatalog(guardName)` and holds **no** module-scope value binding at all —
measured with a wider pattern than the record's own grep (`^(export )?(const|let|var) ` → 0) and by
reading the whole file. The derivation is `ROLE_MANIFEST.filter(scopeKind !== 'none').map(code).sort()`,
i.e. a projection of the manifest that lint gate 19 + pgTAP `411` already bind to `authz.roles`;
**zero** role literals appear on any added line of the diff. The prohibition the follow-up exists for
is honoured in the strongest available form: even `REPO_ROOT`, which *was* a module-scope `const` in
both originals, moved inside the function.

**(b) Two independent live reads KEPT, SET equality in each — MET.**
`session-grants.test.ts:138` and `nav-scope-exclusivity.test.ts:185` each call the reader themselves;
neither delegates to the other, and neither imports the other's array. Each file asserts
`expect([...X].sort()).toEqual(expectedMembershipRoleVocabulary())` — array-of-string `toEqual` against
two sorted sequences, which is **stricter** than set semantics (a duplicated role would red on length)
and **bidirectional** (a role the CHECK gained but the manifest lacks reds just as loudly as one it
lost). `.length` is asserted nowhere against the derived set; `session-grants`' pre-existing
`expect(CATALOG_ROLES.length).toBeGreaterThan(0)` non-triviality check is untouched and is not the pin,
which is correct — it is a weaker, different claim.

**(c) The two copy-pasted regexes collapse to one definition, fail-closed preserved — MET.**
Both 66-line / 54-line copies are deleted (the diff shows them as pure `-` hunks) and replaced by one
import. I diffed the removed bodies against the surviving one: the SQL is byte-identical, and all three
throws are preserved with the guard name parameterised, so `"FUP-QO-2 guard: could not read
memberships_role_check from the live catalog … this guard reads the catalog on purpose and must never
silently skip."` still renders per-caller. The credit line the follow-up asks to preserve — *the helper
fails CLOSED with the stack down* — survives the refactor intact.

**(d) A red-first witness — MET, and re-measured by me rather than accepted.**
Both witnesses reproduce exactly. The short read gives **37 → 34** with both pins red, which is the
follow-up's originally-observed failure reconstructed on purpose. The substitution gives **37 → 37**
with the pin still red, which is the case the follow-up says a count cannot see — so the witness pair
demonstrates not just that the assertion can go red, but that it goes red on the *specific* mutation
class the chosen matcher was picked for. That is the discrimination half a negative control needs, and
it is present.

---

## 3. AC-by-AC (hub)

- **AC-1 — MET.** See clause (a). The rationale is also written into the module header where the next
  reader will hit it, including the reason the trap "looks exactly like tidying".
- **AC-2 — MET** (with a wording NOTE, below). Two reads kept, set equality in each.
- **AC-3 — MET.** See clause (c).
- **AC-4 — MET.** See clause (d); both witnesses independently re-run by me and reverted.
- **AC-5 — MET, with one bound I state explicitly.** `npm run lint` **rc 0** (19 gates, read bare),
  `npm run typecheck` **rc 0**, `npm run test` **rc 0 / 154 files / 2094 tests** — all three
  reproduced by me on the committed bytes. I did **not** re-run `supabase db reset --local` (the lead
  holds the local stack and my brief forbids it), so the "on a **fresh** reset" half of AC-5 is
  accepted from the record; what I can say is that the suites and the full vitest run are green on the
  stack **as it stands now**, which is the weaker but still meaningful claim. The "not owed" list
  (`test:db`, the four authz arms, the diff-scoped door sweep, `e2e:prod`) is **correct and
  independently verified**: `git diff main..HEAD --stat -- supabase/ e2e/` is empty, the only non-test
  `src/` file is imported by nothing in the application, and no policy, function, or migration is in
  the range. Nothing in this diff can move a door, so no door-sweep case list exists to derive.
- **AC-6 — open by design** (QA review + PO approval + Record step). This report is its first half.
  The lead still owes: this report linked from the hub's `reviews:` frontmatter, the follow-up closed
  and archived with its body folded, the ledger row, hub → `complete`, `main` fast-forwarded, not pushed.

---

## 4. Findings

### MINOR-1 — the record quotes a command that does not reproduce the figure beside it

`docs/progress/vitest-role-set-pin.md` §"What landed" writes:

> **What landed** (`a8aeeb25`, on top of the open commit `3b48f9d0`; `git diff --stat main..HEAD`:
> 6 files, +303 / −135 including the three docs)

Measured: `git diff --stat main..a8aeeb25` → **6 files, 303 insertions, 135 deletions** ✅, but
`git diff --stat main..HEAD` — the command as literally written, run from the commit the record
itself lives on (`037f0f0d`) — → **6 files, 387 insertions, 135 deletions**. The parenthetical names
`a8aeeb25` so the intent is recoverable, but the quoted invocation is not the one that yields the
quoted number, and a later reader re-running it will get a different answer with no marker saying
why. This is the same shape as the register's own lesson *"a cited line number rots when its artifact
is overwritten"*: a self-referencing `HEAD` in a record inevitably rots by the commit that records it.

**Requested (non-blocking, may be folded into the Record step):** change the quoted command to
`git diff --stat main..a8aeeb25`, or restate the figure as "+387 / −135 at `037f0f0d`, of which the
code commit is +303 / −135". No verdict, gate, or acceptance criterion depends on either number.

### NOTE-1 — the line-endings paragraph is now unverifiable, and I am the reason

The record's last paragraph states *"the two edited suites were CRLF in the working tree and are LF in
the index, as before; the new module is LF both sides."* I can confirm the second half
(`git ls-files --eol` → `i/lf w/lf` for `membership-role-vocabulary.test-support.ts`) but **not** the
first: my AC-4 re-measurement ran `git checkout --` on both suites, and with `.gitattributes`'
`text=auto eol=lf` that rewrites the working-tree copies as LF. `git ls-files --eol` now reports
`i/lf w/lf` for both. I am disclosing this rather than reporting it as a record error — the committed
bytes are LF either way, `git status` is clean, and the claim was plausibly true when written. It is
simply no longer falsifiable from this tree.

### NOTE-2 — the record's own "no module-scope value" instrument is narrower than its claim

The record offers `grep -c "^const\|^export const\|^let " …test-support.ts` → **0** as the witness for
AC-1. I reproduced that exact command (0 ✅), but the pattern cannot see `var`, `export let`,
`export var`, or any indented module-scope binding. I re-measured with
`grep -nE "^(export )?(const|let|var) "` (0) and read the file end-to-end, so **the claim is true** —
but the quoted instrument would not have caught two of the four ways to break it. Worth a wider
pattern if this witness is ever re-used.

### NOTE-3 — "top-level" in AC-2 is loose for one of the two files

Hub AC-2 reads *"Both suites keep their own **top-level** catalog read."* In `session-grants.test.ts`
the read is at module top level (`:138`); in `nav-scope-exclusivity.test.ts` it is at `describe` scope
(`:185`), which the **record** states precisely and the hub does not. The property the follow-up
actually requires — an explicit, independent call site per file, not a shared collapsed read — is met
in both, and a `describe`-scope call is evaluated at collection exactly as a module-scope one is, so
nothing behavioural turns on it. Only the hub's phrasing is imprecise.

### NOTE-4 — the new module's containment rests on prose, and no gate can see a violation

The module header says *"Nothing in the application imports it; it shells out to Docker and must never
be reachable from app code."* The first clause is **true today** (verified: zero app importers). The
second is a norm with no enforcer. This unit strictly widens the surface: before, the reader was an
**unexported** local function inside two `*.test.ts` files; now it is an **exported** function in a
non-test `src/` module that calls `execFileSync('docker', …)`. `lint:client-server-imports` keys on
`server-only` value-imports and would not see `import { readRoleVocabularyFromCatalog } from
'@/lib/role/membership-role-vocabulary.test-support'` in an app module; a Client Component doing so
would abort `next build` (loud), but a **Server** Component doing so would compile and shell out to
Docker at runtime (quiet until it fails in production).

I am **not** requesting a change for this unit: the exported-function shape is exactly what the PO's
re-claused clause (a) ordered, the `src/` placement is reasoned in the record (the `@/` alias and
eslint's first-party scope both need it), and the repo's own lesson *"prose in a comment is not a
guard"* is quoted two files away. But by that same lesson, this is a candidate follow-up — a one-line
addition to an existing text gate (`src/**` non-test files may not import `*.test-support`) would
convert the norm into an enforcer.

---

## 5. Security, code quality, hygiene

- **RLS / authorization — not engaged, and verified not engaged.** No migration, no policy, no
  function, no `SECURITY DEFINER` body, no grant in the range (`git diff main..HEAD --stat --
  supabase/` empty). The `prosecdef`-beside-`pg_policies` discipline has no door to apply to here.
  The only database contact the diff adds is a **read** (`pg_get_constraintdef` over `pg_constraint`)
  executed by a test helper against the local container.
- **No service-role key, no secret, no `NEXT_PUBLIC_` change.** The reader authenticates as
  `postgres` **inside the local Docker container** via `docker exec` — no credential is read,
  written, or embedded, and nothing in the path is reachable from a browser bundle.
- **TypeScript `strict`** — `tsc --noEmit` rc 0; no `any` anywhere in the new module; both exports
  carry explicit return types.
- **Rule 8 / Rule 9** — no generated types touched, no supabase-js call added, no query module added
  or changed; `lint:data-access` reports its four generated registries still agreeing with `src/`.
- **Rule 10 / a11y** — no user-facing string, no UI, no component rendered. Not engaged.
- **ADR hygiene** — no ADR owed, and the record says why (the shape was ordered by the follow-up's PO
  ruling; ADR 0207 D4 supplies the manifest and its pin). No `Supersedes:`/`Amends:` label question
  arises. Highest ADR on any branch is 0210, untouched — verified.
- **Register hygiene** — `check-docs-registers.mjs` rc 0; `docs/features/INDEX.md` regenerated and
  internally consistent; no `PROGRESS.md` row owed at this stage.

## 6. Bounds of this review

1. **I did not run `supabase db reset --local`** (forbidden by my brief; the lead holds the stack). The
   "fresh reset" half of AC-5 is accepted from the record. Everything else in AC-5 I re-ran myself.
2. **I did not run `npm run test:db`, the authz arms, the door sweep, or `e2e:prod`** — I verified they
   are **not owed** rather than skipping them silently: the diff contains no `supabase/`, no `e2e/`,
   no policy, no function, and no reachable `src/` behaviour.
3. **I mutated the working tree twice**, under the explicit authorisation in my brief, to re-derive the
   AC-4 witnesses; both plants were reverted with `git checkout --` and the tree verified byte-identical
   to `HEAD` (`git diff HEAD` empty, `git status --porcelain` empty, no stash). The one side effect is
   NOTE-1.
4. **The pin's premise is stronger than the record claims, and I checked it.** The record justifies
   `scopeKind !== 'none'` as the manifest's statement of which roles hold `memberships` rows. It is in
   fact enforced in the catalog: `memberships_role_scope_kind_fkey` is
   `(role, scope_kind) → authz.roles(code, allowed_scope_kind) MATCH FULL`, so a role whose allowed
   scope kind is `none` cannot have a membership row at all. The derivation is therefore structurally
   backed, not merely empirically true today — which makes the pin's forward risk (a legitimate future
   divergence redding the suites) low, and loud if it ever happens.

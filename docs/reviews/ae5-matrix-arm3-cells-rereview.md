# QA Re-review (round 2) — AE5-MATRIX-ARM3-CELLS (pre-AE5 remediation successor; program AUTHZ)

**Reviewed:** branch `authz-ae5-matrix-arm3-cells`, tip `00846736` (the fix commit answering round 1).
Base `main` @ `ad9ffb21`. Round 1: `docs/reviews/ae5-matrix-arm3-cells-review.md`, tip `eaf1757a`,
**CHANGES REQUESTED** — 6 findings + 1 observation, all docs-only.
**Reviewer:** qa. **Date:** 2026-09-11.

**Verdict: APPROVED**

All six round-1 findings are discharged **at their locations**, each re-opened with `sed -n`/`git
show` and each *truth claim* re-derived against the live catalog or the vector rather than read off
the fix table. Two new MINOR items — both introduced by the fix commit itself, both in docs, neither
blocking — are listed below and belong in the Record step, **not** in a third loop.

## Scope and method

⛔ I did **not** trust the record's per-finding fix table. For every finding I opened the location the
round-1 report named and re-measured the claim the fix asserts.

Read: `git show --stat 00846736` and the full per-file diff; the record's last entry
(`docs/progress/ae5-matrix-arm3-cells.md` § *QA review round 1*, incl. its answers to round 1's
could-not-verify list); the hub `docs/features/ae5-matrix-arm3-cells.md` (frontmatter +
`## Current state` in full); `docs/backend-state/authorization-and-audit.md` (`## Current state` :55-62
and the last `##` slice :1430-1445); `docs/decisions/0175-…:142-152`; `docs/reviews/authz-ae4-review.md:99-105`;
`docs/plans/pre-ae5-remediation.md:612-622` + §2 row 10 (`:71`); the new follow-up (register entry +
body) against `docs/followups/follow-ups-open.md:1962-1968`; `docs/bugs/BUGS.md:206`;
`supabase/tests/vectors/authz-enforcement-manifest.json` (the `org.professionals.read` qualifier,
diffed);`.claude/rules/prosrc-is-not-the-whole-function.md`.

Queried the **live catalog** (`docker exec supabase_db_azkbbhskturikxpgmafq psql`), never migration
text, per ADR 0078 — no `supabase db reset`, no mutation of any kind:

- `prosrc` of `app._case_caps` in full: the arm-3 reach set is **S1…S8** — S1 `is_staff_admin_of_for`,
  S2 `is_tenancy_admin_of_for`, S3 `case_access_grants`, S4 case assignment (`case_phases.assigned_to`
  / `case_narratives.assigned_to`), S5 `is_member_of_for`, S6 `is_pqs_operator_of_for`, S7
  `is_quality_reviewer_of_for`, S8 `member_can_for`.
- **S3 and S4 carry no role lookup** — S3 keys on `g.principal_id = p_uid` (+ `revoked_at`/`expires_at`),
  S4 on `assigned_to = p_uid`. Nothing else. ⇒ the S3/S4 bound the fix restored is **TRUE**.
- The other six all reach a role lookup: S1 → `authz.holds_role`; S2 → `app.has_role` ×2; S5 →
  `app.has_role_any`; **S6 → `is_nsp_coordinator_of_for` / `is_pqs_member_of_for` → `app.has_role`**
  (this closes round-1 could-not-verify item 5, which the record left open); S7 → `app.has_role`;
  S8 → `member_can_for` → `is_member_of_for` → `has_role_any`.
- The whole arm-3 chain, `prosecdef` beside the bodies (ADR 0079 / LESSONS): `can_read_professional_profile`
  → `can_read_case_committee` → `can_read_case` **and** `is_oversight_only_reader` → `has_case_capability`
  → `_case_caps` are **all `prosecdef = t`**, all `search_path=app, public, pg_catalog`, ACL
  `{postgres,authenticated,service_role}` — **no PUBLIC**. The DEFINER gate replaces RLS here, so an
  oracle over the body remains the right instrument and `pg_policies` alone would still see nothing.
- `prosrc` of `app.can_read_professional_profile`, arm-3 comment read verbatim — see finding 2.

Re-derived in Python from `supabase/tests/vectors/authz_differential_cells.psql` (parsed, not eyeballed):
1728 rows × 14 columns; `org.professionals.read` rep = **864**; `case_reach` = 216 each over
`none`/`unreachable`/`role_keyed`/`grant_keyed`; the `grant_keyed` column partitions as
**108 blocked + 30 masking + 36 not-a-holder + 32 cross-org + 10 defective = 216**; approved-divergent
over the whole rep = **56 cross-org + 36 not-a-holder = 92**; defective over the whole rep = **10**.

Ran myself, **every exit code read bare, never through a pipe**:

| command | bare rc | output quoted |
| --- | --- | --- |
| `npx supabase test db --local 00_setup.sql 403_… 410_…` | **0** | `Files=3, Tests=72` · `Result: PASS` · `All tests successful.` · **0** `^not ok` |
| `npm run lint:authz-vectors` | **0** | all self-test arms `caught` with the **firing arm named**, then `clean on the real spec (discrimination control)` · `in sync (1728 cells, 10272 skipped, sha c3cbbdbdea94)` |
| `node scripts/check-docs-registers.mjs` (gate 13, half 1) | **0** | `OK (self-test + 23 hubs, 21 records, …, 449 md files scanned)` · `longHeadings=97/97` |
| `node scripts/build-features-index.mjs --check` (gate 13, half 2) | **0** | `OK (23 hubs; index in sync)` |
| `node scripts/check-backend-state.mjs` (gate 16) | **0** | `OK — 15 seam file(s) + README.md … largest authorization-and-audit.md at 160.3 KB (warn 160 / cap 200)` — the filed `[D]` warn · `authorization-and-audit.md (97, 3 left)` |
| `node scripts/build-adr-index.mjs --check` | **0** | `OK (201 ADRs indexed, next free 0206)` |

⛔ `npm run lint` was **not** run by me — the lead is running it concurrently at `00846736`.

## Findings — round 1, item by item

### ✅ Round-1 MAJOR 1 (the S3/S4 bound) — DISCHARGED at all four locations, and the bound is TRUE

| location | now reads | verified |
| --- | --- | --- |
| seam `## Current state` `:61` | *"the case-committee arm (no org term; **role-free at its S3/S4 case-grant sources only**, so it survives an absent hat; `pending` reachable)"* | ✅ |
| seam last slice, bullet 1 (`:1436`) | *"is role-free at its two case-grant sources S3 (`case_access_grants`) and S4 (case assignment) … so it survives an absent hat (⚠ QA-corrected 2026-09-11: an earlier wording here said *no role lookup* bare)"* | ✅ (see MINOR A) |
| hub § Done since start | *"role-free at S3/S4 only, so it survives an absent hat"* | ✅ |
| manifest qualifier | *"no role lookup at its S3/S4 case-grant sources — the other `_case_caps` sources do route through role lookups"* | ✅ |

The **truth** of the bound, not just its presence, is measured above from `_case_caps`'s live `prosrc`:
S3 and S4 contain no role term; the remaining sources do. The bare *"no role lookup"* that round 1
found survives nowhere — I grepped all four homes.

### ✅ Round-1 MAJOR 2 (the door's own stale comment) — FILED, correctly, and the quote is verbatim

`FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION` exists as a register
entry (`follow-ups-open.md:1963-1968`) **and** a body file. Checked:

- **The two `Closes when` clauses are consistent** — same trigger (the next migration that legitimately
  touches `app.can_read_professional_profile`), same required content (the parenthetical corrected:
  §7.3/§7.3b oracling with a PO value per class, the hat-substitution class pinned by §7.4), same
  prohibition (⛔ never a standalone comment-only migration), same named carrier (the filed bug's fix).
  **No inversion, no drift, no tightening in one and not the other.**
- **The quoted line is verbatim.** Live `prosrc` carries
  `-- term at all and its cells are exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3).`
  — the body's fenced quote is that line, byte-for-byte, and the body correctly labels it a fragment of
  the four-line comment above the arm-3 `return exists`.
- Both citations in the body **resolve**: `.claude/rules/migrations-forward-only.md` exists, and
  `FUP-ADMIN-ARM-IS-ACTIVE-CAN-CREATE-PROFESSIONAL-COMMENT-NAMES-A-REMOVED-ARM` exists as body **and**
  register entry (`:1928`) — the precedent is real, not remembered.
- The body keeps the two correct qualifiers: it is a **comment, not an arm** (behaviour unaffected) and
  the *no org term* clause in the same comment is **still true**. That is the right disposition: not
  rewriting someone else's migration body inside a no-migration unit.

### ✅ Round-1 MAJOR 3 (a citation to a commit not on the branch) — DISCHARGED, and the replacement is the right commit

- `git merge-base --is-ancestor cdb6fae3 HEAD` → **rc 0**. `81fa1770` → **rc 1** (unchanged; still only
  on `remotes/origin/authz-ae5-matrix-arm3-cells`, the stale pre-rebase ref).
- `git show --stat cdb6fae3` carries `supabase/tests/403_ae45_differential_oracle.sql | 400 ++-` —
  i.e. **it is the commit that replaced §7.3**; its message is `feat(403): oracle arm 3 — section 7.3
  replaced, the defect pinned, the class-4 guard mutation-proven`. The retarget points at the work, not
  merely at a reachable sha.
- Both homes now read *"`cdb6fae3` … `81fa1770` **pre-rebase, no longer on any local branch**"* — and
  that qualifier is **exactly right**: `81fa1770` is on a *remote* ref, not a local branch. The wording
  does not overclaim.

### ✅ Round-1 MINOR 4 (the `grant_keyed` grain) — DISCHARGED, and the numbers reconcile exactly

Re-derived from the vector, not read:

- ADR 0175 § Consequences now: *"of the **216 `grant_keyed`** cells at the representative: 36 + 32
  approved as designed reach, 10 ruled a bug — over the representative's **864** cells that is **92**
  approved-divergent."* ✅ Every figure matches my parse.
- Hub: *"a partition of the **216 `grant_keyed`** cells at the rep (the rep holds **864**): 108 · 30 ·
  36 + 32 + 10 (over the rep's 864: **92** approved-divergent, **10** defective)."* ✅ Including the
  non-obvious half — all 36 `not-a-holder` cells are `grant_keyed`, all 10 defective cells are
  `grant_keyed`, and `cross-org` splits 32 `grant_keyed` / 24 `role_keyed`, which is what makes the
  whole-rep figure 92 and not 68.
- The partition still **sums**: 108 + 30 + 36 + 32 + 10 = 216 at `grant_keyed`; the whole rep's nine
  labels sum to 864. No cell in two classes, none in none.

### ✅ Round-1 MINOR 5 (no recorded green `lint`) — DISCHARGED for `eaf1757a`; see MINOR B for the current tip

The record entry the two forward pointers promised **exists** (`docs/progress/ae5-matrix-arm3-cells.md:673-681`,
commit `0d06ec80`): *"`lint` re-run BARE at tip `eaf1757a` … **rc 0**; 17 of 17 gates reached; eslint 0
errors / 0 warnings; the only WARN match is gate 16's `[D]` 160.0 KB"*. The hub no longer forward-points
— it states *"re-run bare at `eaf1757a`: **17/17, rc 0**"* directly. Both round-1 dangling pointers are gone.

### ✅ Round-1 MINOR 6 (the door-harness locator) — DISCHARGED and the new locator is correct

`selftest-door.log` lines **13, 14, 15** are exactly
`ok shape MOVED + FAIL -> NOTICED` · `ok shape MOVED + PASS -> ERROR` · `ok Dubious only + FAIL -> NOTICED`
(line 10 is the `classify()` header; the log's true last rows are the `CASES` set-ness block ending
`SELFTEST TOTAL: 33/33 ok, 0 failed`). The gate row now cites `selftest-door.log:13-15` and says in
parenthesis that these are **not** the log's last rows. Locator measured, ✅.

### ✅ Round-1 Observation (plan `:618`) — DISCHARGED and consistent with §2 row 10

`:618` now reads *"⛔ NOT pushed — the standing instruction — ✅ **superseded: PUSHED 2026-09-10** on the
PO's instruction, the fifth one-push override, §2 row 10; found contradicting that row by QA at
`AE5-MATRIX-ARM3-CELLS`, 2026-09-11"*. §2 row 10 (`:71`) reads *"✅ **PUSHED 2026-09-10** (`b87eac1e..44f69ff6`,
27 commits, a FIFTH one-push override …)"*. **One file, one answer.** The superseded text is kept, not
deleted — the correct shape.

### ✅ Manifest regeneration — exactly one sha line each, and the fixture still passes

`git show 00846736 -- authz-matrix-coverage.json authz_enforcement_manifest.psql` is **one changed line
in each** (`manifestSha256` / `-- sourceSha256:`, `15748c51…` → `a73e6740…`). Nothing else moved — which
is itself the proof of the manifest's own claim that `qualifier` and `openArms` are **narrative-only and
never emitted into pgTAP**. `lint:authz-vectors` bare **0**; `00_setup + 403 + 410` bare **0**,
`Files=3, Tests=72, PASS, 0 not ok` — the record's figure reproduced independently.

### ✅ Lead-playbook §4 step 8 (rulings outside the log) — still satisfied

Unchanged by the fix commit, and re-confirmed: **R1** lives in `authz-matrix-axes.json`
`axes.caseReach._source`, the generated vector header and ADR 0175's D3 marker; **R2** lives in the
vector's 14th column *as values*, in `expected_legacy()`'s docstring, in `403` §7.3/§7.4/§7.5 messages,
in the manifest qualifier, in the `BUGS.md` row and body, and in ADR 0175 D3 + § Consequences.
**Neither ruling lives only in the record.**

## New items introduced by the fix commit (MINOR, for the Record step — not a third loop)

### MINOR A — the seam slice turned a correct NAMED set into a census that does not sum

**Location:** `docs/backend-state/authorization-and-audit.md`, last slice, bullet 1 (`:1436`):
*"is role-free at its two case-grant sources S3 … and S4 … — **the other five `_case_caps` sources** DO
route through role lookups"*.

**Measured:** `app._case_caps` has **eight** labelled sources (S1…S8). Other than S3/S4 there are
**six**, and all six are role-keyed (traced above, S6 included). `2 + 5 = 7`, not 8 — S2
(`is_tenancy_admin_of_for`, the org/hospital-admin arm) falls out of the census.

**Why it happened:** the record (`:236-239`) does not give a count — it **names** the set,
*"S1/S5/S6/S7/S8"*, which is the set of sources that can actually reach **this door** (S2 confers
`manage_case_access` only and never contributes a read bit, and S7 alone is excluded by
`is_oversight_only_reader`). Correct as a named list; the slice re-expressed it as *"the other five
`_case_caps` sources"*, which is a different and false proposition. This is the
census-whose-parts-don't-sum shape, one compression later than round-1 MAJOR 1.

**Not blocking:** the load-bearing bound (S3/S4 role-free ⇒ survives an absent hat) is correct in all
four homes, and the miscount errs *toward* role-keyed — nothing dangerous follows from it.
**Fix (one line):** name them as the record does — *"the other read-conferring sources (S1/S5/S6/S7/S8)
DO route through role lookups; S2 confers `manage_case_access` only and never reaches this door"*.

### MINOR B — the hub's live `## Current state` says the review is "not yet written", in the commit that wrote it

**Location:** `docs/features/ae5-matrix-arm3-cells.md` § *In progress*: *"Phase Gate step 3 — the QA
review (`docs/reviews/ae5-matrix-arm3-cells-review.md`), **not yet written**."* — while `00846736`
**adds that exact file** (388 lines) and answers it. The same commit edited the hub twice (§ Done since
start, the lint line) and left the one sentence it falsified. Related: § Next still says the E2E ruling
is *"for QA to confirm"* (round 1 confirmed it, and so does this review), `status: in_progress` and
`reviews: []` in the frontmatter still carry no link to either review.

**Why it matters:** the hub's `## Current state` is the unit's **summary** (CLAUDE.md §7); at this tip it
hides that a CHANGES-REQUESTED round happened at all. The record has it; the hub is what a fresh session
reads first.

**Not blocking:** the Record step replaces this block wholesale and adds the `reviews:` links.
**Fix:** at the Record step, `reviews:` gains both reports, and the block states *round 1 CHANGES
REQUESTED → six fixed → round 2 APPROVED*, rather than being silently overwritten.

## Verified-facts list

Each measured at the location named, at tip `00846736`.

- **The S3/S4 bound is true of the live catalog**, not merely present in the docs — `_case_caps` S3
  keys on `principal_id`, S4 on `assigned_to`, and the other six sources each terminate in
  `has_role`/`has_role_any`/`holds_role`. Round-1 could-not-verify item 5 (`is_pqs_operator_of_for`) is
  **closed**: it delegates to `is_nsp_coordinator_of_for` / `is_pqs_member_of_for`, both `app.has_role`.
- **The arm-3 chain is DEFINER end to end** (`can_read_professional_profile` → `can_read_case_committee`
  → `can_read_case`/`is_oversight_only_reader` → `has_case_capability` → `_case_caps`), all
  `prosecdef = t`, all with a pinned `search_path`, **none granting PUBLIC**. The gate body is the
  boundary; a `pg_policies`-shaped audit is structurally blind here — which is why this unit's
  instrument (an oracle over the body) is the right one.
- **The vector partition re-derived independently**: 1728 × 14; rep 864; four reaches 216 each;
  `grant_keyed` = 108 + 30 + 36 + 32 + 10; whole-rep approved-divergent 92, defective 10. Every figure
  the fix commit added to ADR 0175 and the hub matches this parse.
- **`403` + `410` pass on the regenerated fixture** at this tip: `Files=3, Tests=72, PASS`, 0 `not ok`,
  bare rc 0 — reproduced, not quoted.
- **The generator's vacuity discipline is intact after the regen**: `--self-test` still reports the
  **identity of the arm that fired** for every mutant (arm1b/5/6/7/8/9/10) and still ends with
  `clean on the real spec (discrimination control)`; `--check` still `in sync (1728 cells, sha c3cbbdbdea94)`.
- **The regeneration touched only the two sha lines** — which independently corroborates the manifest's
  own claim that `qualifier`/`openArms` never reach pgTAP.
- **The E2E ruling still holds.** `git diff --name-only main..HEAD` is now **26** files (was 24); the two
  new ones are `docs/followups/FUP-…-READ-DOOR-COMMENT…md` and `docs/reviews/ae5-matrix-arm3-cells-review.md`.
  The grep for `^src/|^supabase/migrations/|^e2e/|seed\.sql` returns **0**. `npm run e2e:prod` remains
  **not owed**; the app is byte-identical to the one Batch 10 gated at 38/38.
- **No security surface moved.** No migration, no policy, no RPC, no `src/**`, no service-role usage, no
  `NEXT_PUBLIC_` change. Rules 1–13 are untouched by this diff; the one authorization *finding*
  (`BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE`) is still **open/high** in
  `BUGS.md:206`, still pinned by §7.4 and guarded by §7.5, and was **not** quietly closed by the fix commit.
  Its row states the grain correctly (*"10 of the 216 … ⚠ at `case_reach = grant_keyed`"*) and its own
  S3/S4 sentence was already right — the fix did not disturb it.
- **ADR hygiene:** `build-adr-index --check` bare 0 (201 ADRs, next free 0206); ADR 0175's header carries
  `**Amended:**`, and the round-1 retarget did not edit decision text in place — the diff is confined to
  the dated marker sentence.
- **Register hygiene:** gate 13 bare 0 with `longHeadings=97/97` — the record's account of one ratchet red
  (98 → shortened) is consistent with the ratchet now sitting exactly at cap. Gate 16 bare 0 with the
  already-filed `[D]` 160.3 KB warn and the seam block at `97/100` lines.
- **The round-1 report was committed intact.** `docs/reviews/ae5-matrix-arm3-cells-review.md` as committed
  in `00846736` is the round-1 text, verdict line included — no finding softened, none removed.

## Could not verify — a work item for the lead, not a clearance

1. **`npm run lint` at `00846736`.** The lead's run was in flight; nothing in the corpus records it, and
   the round-1 entry's closing line (*"re-run bare at the commit that carries this entry (next entry)"*)
   has no referent yet. I ran, bare and green, every gate that the diff since `eaf1757a` could move —
   gate 13 (both halves), gate 16, `adr:index --check`, `lint:authz-vectors` — and eslint's scope
   (`src/`, `e2e/`, `*.test.*`) is untouched by the diff, so my expectation is rc 0; **that is an
   expectation, not a measurement.** The Record step must carry the bare rc into the record.
2. **The three scratch-copy mutation proofs** (an org check inside arm 3 · the grant row removed · a
   role-keyed hat check). Unchanged from round 1: scratch copies leave no artefact, and my brief forbids
   mutating outside a rolled-back transaction. The record now says so explicitly, which is the right
   disposition — but the claim still rests on the record alone. The committed `403` is untouched by the
   mutants (it runs green as committed, which I re-confirmed).
3. **The pre-unit `test:db` baseline `267 files / 9019 tests`.** The record points at Batch 10's gate
   table; I did not open it. The post state (267 / 9023) and `403`'s `plan(23) → plan(27)` are
   self-consistent.
4. **The live unmasked arm-3 grant "reproduced on the untouched seed"** (subject `fb00…00e1`, caller
   `chefe.ccih@test.local`). Corroborated indirectly by §7.3b/§7.4 passing on the 403 fixture and by the
   `_case_caps` body I read; I did not re-run the seed probe.
5. **The full `main..HEAD` content of the earlier increments.** This round re-reviewed the *fix commit*
   against round 1's findings; round 1's own re-derivations (byte-identity of the 1080 base coordinates,
   `expected_granted` unmoved on 0 of 1080, the §7.x reading, the gate-record reconciliation) are carried
   forward, not repeated.

## Overall assessment

The fix commit does what a good remediation does and very little else: **six locations, six
measurements, no scope creep** — and, notably, it did not fix any finding by deleting the sentence that
carried the debt. The stale door comment was **filed**, not rewritten inside a no-migration unit, with
Batch 10's precedent named and both citations resolving. The dangling sha was retargeted to the commit
that actually carries the §7.3 replacement, with the pre-rebase sha kept beside it and bounded correctly
(*"no longer on any **local** branch"* — true, and precise about the remote). The grain correction is
stated in both homes and reconciles against a parse of the vector to the cell. The manifest change moved
exactly two sha lines, which is itself evidence for the narrative-only claim the qualifier makes about
itself.

The one thing round 1 could not close — whether the S3/S4 bound was *true* as well as *present* — is now
closed against the live catalog: S3 keys on `principal_id`, S4 on `assigned_to`, nothing else, and every
one of the other six sources terminates in a role lookup. That also closes round 1's could-not-verify
item 5. The security posture is unchanged and correct: DEFINER end to end with pinned `search_path` and
no PUBLIC grant, no migration, no policy, no `src/**`, and the filed authorization defect still open,
still pinned, still deliberately unfixed.

What is left is two MINOR docs items the fix commit itself created, both of a piece with the unit's one
recurring weakness — **a precise sentence loses precision each time it is re-expressed**. The record
*names* five reaching sources; the slice *counts* them as "the other five `_case_caps` sources", and the
census stops summing. The hub is edited twice in the commit that falsifies its third sentence. Neither
is a defect in the build, neither is blocking, and both land in blocks the Record step rewrites anyway —
so they belong there, named, rather than in a third review loop.

**Verdict: APPROVED**

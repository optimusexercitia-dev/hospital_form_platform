# QA Review — AE5-MATRIX-ARM3-CELLS (pre-AE5 remediation successor; program AUTHZ)

**Reviewed:** branch `authz-ae5-matrix-arm3-cells`, tip `eaf1757a` (tip gate ruled by the lead at
`29422327`; the two commits after it are docs-only — the gate record entry `a6765c0f` and the hub
block `eaf1757a`). Base `main` @ `ad9ffb21`.
**Reviewer:** qa. **Date:** 2026-09-11.

**Verdict: CHANGES REQUESTED**

⚠ Every item below is **docs-level and small**. The four acceptance criteria are each discharged by
an artefact I read and re-derived myself, the build is sound, and there is **no security finding** —
this branch touches no migration, no policy, no `src/**`. What is requested is the removal of three
false-or-dangling sentences the unit left in **permanent homes** (one of them in the live catalog's
own comment, one in the exact block whose paraphrase rule this review is the only check on), plus a
recorded green for the one gate that has never been green at a tip of this branch.

## Scope and method

Read: the hub `docs/features/ae5-matrix-arm3-cells.md` (acceptance criteria + `## Current state`);
the full record `docs/progress/ae5-matrix-arm3-cells.md` § Session log (all five dated entries);
`docs/learning/LESSONS.md` header + admission rule before any authz claim; `git log`/`git diff
--stat`/`--name-only main..HEAD`; the lead's tip-gate driver output
(`tipgate-29422327/*.rc`, `*.log`, `deriver-*.out`, `status-before/after.txt`, `bash-version.txt`,
`tip.txt`, `driver.log`).

Re-derived rather than accepted, each at a location opened with `sed -n`/`grep`:
`supabase/tests/vectors/authz_differential_cells.psql` (header + all 1728 cell rows, parsed);
`scripts/gen-authz-differential-cells.py` (`REACH_PROPERTIES`, `arm3_divergence`, `expected_legacy`,
`CONDITIONAL_EXCLUSIONS`, arms 7/9/10); `supabase/tests/vectors/authz-matrix-axes.json`
(`axes.caseReach._source` + its four values); `supabase/tests/403_ae45_differential_oracle.sql`
(§4.1, §4.1b, §7.1–§7.5, the cleanup ordering); `supabase/tests/vectors/authz-enforcement-manifest.json`
(parsed as JSON, qualifier and `residualArms.population` diffed against `29422327^`);
ADR 0175 and ADR 0201 diffs; `docs/backend-state/authorization-and-audit.md` (both edits);
`docs/followups/follow-ups-open.md:1956-1961` against the body file; `docs/bugs/BUGS.md`;
`docs/plans/pre-ae5-remediation.md` (§2 row 10 and the 2026-09-11 marker at `:404-411`).

Ran myself, **every exit code read bare, never through a pipe**:

| command | bare rc | output quoted |
| --- | --- | --- |
| `npx supabase test db --local supabase/tests/00_setup.sql supabase/tests/403_ae45_differential_oracle.sql` | **0** | `Files=2, Tests=28` · `Result: PASS` · `All tests successful.` |
| `python scripts/gen-authz-differential-cells.py --self-test` | **0** | 4 arm7 · 4 arm9 · 3 arm10 fixtures all `caught`, then `clean on the real spec (discrimination control)` |
| `python scripts/gen-authz-differential-cells.py --check` | **0** | `in sync (1728 cells, 10272 skipped, sha c3cbbdbdea94)` |
| `node scripts/check-backend-state.mjs` (gate 16) | **0** | `WARN — [D] … authorization-and-audit.md — 160.0 KB is over the 160 KB warn line (cap 200 KB)` · `authorization-and-audit.md (97, 3 left)` |
| `node scripts/check-docs-registers.mjs` (gate 13, half 1) | **0** | `OK (self-test + 23 hubs, 21 records, …, 103 lessons, 1 handoffs, 448 md files scanned)` |
| `node scripts/build-features-index.mjs --check` (gate 13, half 2) | **0** | `OK (23 hubs; index in sync)` |

⛔ `npm run lint` was **not** run by me — the lead is running it concurrently at `eaf1757a`. The two
gates above are the ones this unit's own tip-gate red and warn landed on; both are bare rc 0 now.

Queried the **live catalog** (`docker exec supabase_db_azkbbhskturikxpgmafq psql`), never migration
text, per ADR 0078 — no `supabase db reset`, no mutation of any kind:

- `prosecdef` **beside** the bodies, not instead of `pg_policies`: `app.can_read_professional_profile`,
  `app.can_read_case_committee`, `app._case_caps`, `app.is_active`, `app.is_admin_for`,
  `app.can_manage_professional` are **all `prosecdef = t`**. Arm 3 is a DEFINER traversal over base
  tables — RLS is bypassed by design (ADR 0064 R6), so the gate body **is** the boundary and an
  oracle over it is exactly the right instrument. This is why a policy-shaped audit would have seen
  nothing here.
- `prosrc` of `can_read_professional_profile`: **four grant terms in three arms** —
  `app.is_admin_for(p_uid)` · (`app.can_manage_professional(v_org,p_uid)` **or**
  `authz.has_permission(p_uid,'organization',v_org,'org.professionals.read')`) · the
  `professional_participants` → `case_participants(removed_at is null)` →
  `app.can_read_case_committee` traversal. **Arm 3 carries no org term** — ADR 0175 D3 CONFIRMED
  against the catalog, not read off the record.
- `prosrc` of `app.is_active`: reads `profiles.is_active` and `suspended_until` **only** — no
  `email_confirmed_at` ⇒ the unit's "`pending` stays reachable through arm 3" is correct.
- `prosrc` of `app._case_caps` STEP 2 = `if not app.is_active(p_uid) then return 0` ⇒ the 432
  `arm3:blocked:principal-state` cells are structurally unreachable, as labelled.
- Traced the role-keyed sub-arms one and two hops: `is_staff_admin_of_for` → `holds_role`;
  `is_member_of_for` → `has_role_any`; `is_quality_reviewer_of_for` → `has_role`;
  `is_tenancy_admin_of_for` → `has_role`; `member_can_for` → `is_member_of_for` → `has_role_any`.
  (This is what produces MAJOR 1 below.)

Parsed both vector generations and compared them row-by-row in Python rather than by eye:
`main` holds **1080** cells at **11** columns, `HEAD` **1728** at **14**; the **1080 base
coordinates are the identical key set**, and **`expected_granted` changed on 0 of 1080**. The claim
"`expected_granted` moved by EXACTLY ZERO cells" is therefore measured, not argued.

## Findings

### MAJOR 1 — the seam's replaceable block states, without qualifier, something the live catalog refutes

**Location:** `docs/backend-state/authorization-and-audit.md` `## Current state` (the invariant
bullet, `:61`): *"On the professional-profile READ door the case-committee arm (**no org term, no
role lookup**, `pending` reachable) is **ORACLED** by `403` …"*; and one grade weaker in the frozen
slice `§ Arm 3 … ORACLED` bullet 1: *"**no role lookup** (it survives an absent ACT hat)"*.

**Requirement violated:** `docs/backend-state/README.md` § *The four rules a gate CANNOT enforce* —
a `## Current state` sentence may not drop or invert a qualifier of the frozen/record sentence it
paraphrases. (Also LEARN-048 / the compression-cuts-the-bound shape.)

**Why it is false.** The record is precise at `docs/progress/ae5-matrix-arm3-cells.md:237-239`:
*"S1/S5/S6/S7/S8 route through `has_role`/`has_role_any`/`holds_role` … ⛔ **S3 (`case_access_grants`)
and S4 (case assignment) contain no role lookup at all**"*. The bound is **S3/S4**, not the arm.
Measured live: arm 3's S1 sub-arm calls `app.is_staff_admin_of_for` → `authz.holds_role`; S5 calls
`app.is_member_of_for` → `app.has_role_any`; S7 → `app.has_role`; S8 → `member_can_for` →
`is_member_of_for` → `has_role_any`. Arm 3 contains **five** role lookups. The true claim — the one
the axis file, the generator's `REACH_PROPERTIES` and `403` §7.3b all encode correctly — is that
arm 3 can **grant without** one. Three homes deep the qualifier survives; by the fourth it is gone,
and the bare sentence is the one a future session reads first.

**Fix:** in the block, *"reaches without any role lookup (S3/S4)"* or *"can grant with no role
lookup at all"*; in the slice, scope the head clause to S3/S4 as the record does.

### MAJOR 2 — the door's own `prosrc` comment now asserts the opposite of this unit's thesis, and nothing filed it

**Location:** live catalog, `app.can_read_professional_profile` body, the comment immediately above
the arm-3 `return exists (…)`:

> `-- … PRESERVED VERBATIM — this arm grants with NO org term at all and its cells are`
> `-- exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3).`

**Requirement violated:** Architecture Rule/authority order (*live catalog > code > ADRs >
trackers*) + LEARN-002 (*stale text hides in `prosrc` comments*) and LEARN-057. The unit's entire
deliverable is *"arm 3 stops being exercised-but-not-oracled"* and *"§7.3 was REPLACED"*. The
highest-authority text in the corpus now says both halves are still false, and it names the exact
section that was replaced.

**Aggravating:** the unit **quoted this very sentence** as supporting evidence at
`docs/progress/ae5-matrix-arm3-cells.md:147-148` on 2026-09-10, then falsified it on 2026-09-11 and
did not return to it. This is not a discovery I made outside the unit's field of view.

**Why it is not a BLOCK:** the unit is correctly ruled *no migration*, and Batch 10 set the
precedent that a stale comment in someone else's migration body is **filed, not rewritten inside a
passing unit** (`app.can_create_professional`'s comment, already an open follow-up on this same
seam). **Fix:** file it — one register entry + one body file, same shape as the three this unit
already filed — or fold it into the existing `can_create_professional` comment follow-up as a second
named site. ⛔ Do not fix it by editing a migration here.

### MAJOR 3 — two permanent documents cite a commit that is not on the branch

**Location:** `docs/decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md:145`
(*"NARROWED 2026-09-11 … (`81fa1770`)"*) and `docs/reviews/authz-ae4-review.md:102`
(*"DISCHARGED FOR ARM 3 ON 2026-09-11 — unit `AE5-MATRIX-ARM3-CELLS` (`81fa1770`)"*).

**Measured:** `git merge-base --is-ancestor 81fa1770 HEAD` → **rc 1**. `git branch -a --contains
81fa1770` → **`remotes/origin/authz-ae5-matrix-arm3-cells` only** — the stale pre-rebase ref. The
post-rebase twin of that commit is **`cdb6fae3`** (same subject, `feat(403): oracle arm 3 …`). The
citation resolves today only because the dangling object survives in this clone's ODB; it dies at
the next force-push, prune or fresh clone.

**Requirement violated:** an ADR is a permanent record and its citations must resolve from `main`.
The program has paid for this exact shape before — §2 row 10's own sibling row 9 carries
*"⛔ **REBASED, then ff-merged** — so the sha the record and the three reviews cite (`773a18d7`) is
**NOT on any branch**"*. The session rebased this branch on 2026-09-11 and did not re-key the two
documents it had already written against the pre-rebase history.

**Fix:** retarget both citations to `cdb6fae3`, or drop the sha and cite the unit + date (the record
and hub already carry the ancestry).

### MINOR 4 — the divergence figures are quoted at the `grant_keyed` grain in two homes that do not say so

**Locations:** `docs/decisions/0175-…:144-147` (*"36 + 32 approved as designed reach, 10 ruled a
bug"*) and the hub `## Current state` (*"Population = a **partition of 216** at the rep: 108 blocked
· 30 masking · 36 + 32 + 10 divergent"*).

**Measured:** the rep holds **864** cells, not 216; 216 is the **`grant_keyed` column alone**
(108 + 30 + 32 + 36 + 10 = 216 ✓, cross-tabbed from the vector). The approved-divergent set over the
whole rep is **92** (`cross-org` 56 = 32 grant_keyed + 24 role_keyed, plus `not-a-holder` 36) —
which is the figure `403` §4.1/§4.1b and the vector header both use. "36 + 32 approved" understates
the approved set by the 24 role-keyed cross-org cells.

**Not wrong, under-bounded** — and the corpus already contains the correct form: the bug row states
it explicitly (*"10 of the 216 … ⚠ at `case_reach = grant_keyed` — ⛔ not 10 of the 1728-cell vector
and not 10 of that rep's 864"*). It simply was not carried into the ADR or the hub. **Fix:** add
*"at `case_reach = grant_keyed`"* to both.

### MINOR 5 — no tip of this branch carries a recorded green `npm run lint`, and the forward pointer has no referent

The gate entry closes with *"`lint` re-run bare at the tip that carries this entry and the reworded
line: **see the next entry's first line**"*, and the hub with *"re-run bare at the tip that carries
this block (**record, next entry**)"*. **There is no next entry** — the record ends at line 671 with
the gate entry itself. The only tip-measured value for gate 1 on this branch is **rc 1**
(`tipgate-29422327/lint.rc`), and the one green (`17 of 17 gates reached, bare rc 0`) was taken at a
**working tree** before the follow-up was filed and before the record entry that caused the red.

I confirmed the rewording works — the red was
`[HANDOFFS] docs/handoffs/pre-ae5-successors-2026-09-10.md — cited from
docs/progress/ae5-matrix-arm3-cells.md:556`, and `:556` now names the directory with no path, with
`check-docs-registers.mjs` bare **rc 0**. But gate 1 of the Phase Gate is *the chain*, and it is not
yet in the corpus. **Fix:** append the record entry the two forward pointers promise, carrying the
lead's concurrent bare rc.

### MINOR 6 — a quoted witness is not where the record says it is

The gate table's door-harness row cites *"its own control table all `ok`, **last rows** `shape MOVED
+ FAIL -> NOTICED` · `shape MOVED + PASS -> ERROR` · `Dubious only + FAIL -> NOTICED`"*. Those three
rows are at `selftest-door.log:13-15`; the **last** rows are the `CASES` set-ness block ending
`SELFTEST TOTAL: 33/33 ok, 0 failed`. The quotes are verbatim and the run is green — only the
locator is wrong, and a locator is what the record exists to make checkable.

### Observation (not this unit's edit, reported for the lead)

`docs/plans/pre-ae5-remediation.md:618` still reads *"Batch 10 … ff-merged 2026-09-10 @ `ef2625f2`,
⛔ **NOT pushed** — the standing instruction"*, while §2 row 10 — the cell this branch's rebase
conflict was deliberately resolved to `main`'s side — reads *"✅ **PUSHED 2026-09-10**"*. One file,
two answers, both on `main` before this branch. The resolution itself is correct; the sibling
sentence was never swept.

## Verified-facts list

Each of these I measured at the location named, not read off the record.

**Acceptance criterion 1 — the divergence enumerated, derived, stated as a set.** ✅
`authz_differential_cells.psql` carries a `case_reach` axis (12th column) and an `arm3_divergence`
label (13th) on **all 1728** cells; the `org.professionals.read` rep holds **864** (216 base
coordinates × 4 reaches) and every one carries a label — `grep -c` over the rep by label sums to
**864 exactly**, so the labelling is a **partition** with no cell in two classes and none in none.
The axis is declared in `authz-matrix-axes.json` with a `_source` that states the predicate reduced
boolean-wise from the live catalog and marks `unreachable` **mandatory** ("without this value every
arm-3 deny is satisfied by the EMPTY JOIN of `none`"). `arm3_divergence()` dispatches in precedence
order, each branch naming its catalog fact, and is **exhaustive by `raise`, not by `else`** — a new
deny class reaching arm 3 aborts generation rather than being defaulted into "approved". The
gate-scoping rule is a **named** `CONDITIONAL_EXCLUSIONS` entry with its full reason inlined into
the generated header, and `arm7` refuses it if the reason is ever blanked or the rule widens enough
to drop a reach value from the whole population.

**Criterion 2 — a PO value per CLASS, and where the ruling lands.** ✅ R2's approved GRANT lands in
the **14th column `expected_legacy_granted`**, never in `expected_granted` — and the reason is a
fact, not a preference: `authz.candidate_has_permission` is a role/permission resolver with no case
arm, so flipping `expected_granted` would have reddened §5.1 on every divergent cell **and been
wrong**. I verified the consequence independently: `expected_granted` is unchanged on **0 of 1080**
base coordinates. `403` §4.1's carve-out is paid for by **§4.1b** asserting `legacy ==
expected_legacy_granted` by value on every non-defect cell, so nothing is merely subtracted.

**Criterion 3 — arm 3 stops being "OPEN AND MASKING", conditioned on a checked consumer.** ✅ The
manifest qualifier now leads `✅ RETIRED FOR ARM 3` and names its consumers section by section; I
opened every one. §7.3 is **replaced, not renumbered** — the old sentinel string `ARM 3 CANNOT GRANT
IN THIS FIXTURE` occurs **0 times** in the file — and now asserts the whole `grant_keyed` column
partitioned with each partition's approved legacy answer. §7.3b measures all four reaches live at
one coordinate where **arm1/arm2a/arm2b are asserted false in the expected string**, and
`unreachable` vs `grant_keyed` differ by exactly one `case_access_grants` row, so the deny polarity
is a differential and not an empty join. §7.4 pins the filed defect head-on (10 cells, `reaches=
grant_keyed`, `contexts=other_role`, all self-checks, approved answer denies on 10) and pins the
**shape** as well as the count. §7.5 guards the class-4 approved reach in **both** cross-org
directions with the **matching** hat, so it survives the intended fix and reds on the accidental org
check. §7.2 still bounds **arm 1** by fixture — and the qualifier says so, in the scope paragraph
(*"⛔ SCOPE OF THIS RETIREMENT: ARM 3 ONLY. ARM 1 … REMAINS EXERCISED BUT NOT ORACLED"*), which I
checked is true of the file. **History kept verbatim:** I parsed both JSON generations and compared
the `HISTORY:` quote to `29422327^`'s qualifier string byte-for-byte — **identical**, including the
escaped inner quotes and the 2026-09-10 `openArms` correction. The `residualArms.population` field
two entries above carries the same dated note, correctly reasoned (*"the arm is not retired, its
BLINDNESS is"*) — necessary, because a reader of `residualArms` never reaches `legacyEquivalence`.
`arm9`'s premise is real: exactly **1 of 43** permissions carries an `openArms` list, and the
self-test proves arm9 fires on all four ways that premise can break.

**Criterion 4 — the forward promise closed at its source.** ✅ ADR 0175 gains an `**Amended:**`
header line, a dated enumeration correction under D3 (three-arm picture → four live grant terms), a
dated `✅ DELIVERED 2026-09-11` marker under D3, and a `Delivered` note on the D3 Consequences
bullet. **Diffed: no decision text is edited in place** — every original sentence survives; the D3
marker is a mid-paragraph insertion that leaves both halves intact. The marker explicitly says *"this
marker says nothing about arm 1"*, and the load-bearing Consequence is **narrowed, not closed**.
`npm run adr:index` state is consistent (gate 13's index halves both bare rc 0).

**Vacuity discipline.** The generator's `--self-test` is keyed to the **identity** of the arm that
fires, not to the existence of a failure (LEARN-103, added by this unit with a real enforcer), and
ends with a **discrimination control** (`clean on the real spec`). `403`'s cleanup runs **last** and
the file says why — an earlier placement made §6's two fail-proofs fire for the teardown instead of
their own mutations. §7.4 is written to **red when the bug is fixed**, deliberately, rather than
tracking the door.

**Gate record reconciliation.** Every rc in the record's table matches its `.rc` file exactly
(`lint 1` · typecheck/unit/reset×2/testdb/census/hat/floor/wrapper/selftest×2/setvalued **0** ·
deriver read+write **3**). Every quoted figure is in a log: `Test Files 154 passed (154)` ·
`Files=267, Tests=9023` + `Result: PASS` + **0** `^not ok` · `gates carrying a verdict: 608` +
`INVARIANT HOLDS` · `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` · floor and
wrapper `INVARIANT HOLDS` · `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` with all three groups ·
`ARM-DOMAIN setvalued=3/3` + `RESULT: CLEAN`. `tip.txt` = `29422327bca7…` ✓.
`bash-version.txt` = `GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)` ✓ (quoted because the
SELFTEST verdict is shell-dependent — Batch 9 R14). `status-before.txt` and `status-after.txt` are
both **0 bytes** ✓. The deriver's `SCOPE:` line is verbatim on both arms and both `.out` files are
**0 bytes** ✓ — and the door sweep is **ruled not run by the deriver's own exit 3**, never by eye,
which is the correct form of the "no gate changed" claim.

**E2E ruling — CONFIRMED.** I re-derived `git diff --name-only main..HEAD` myself: 24 files, of
which **none** is under `src/`, `supabase/migrations/`, `e2e/`, and none is `seed.sql`. The only
non-docs paths are `scripts/gen-authz-differential-cells.py` and `supabase/tests/**` — the first is
a vector generator the prod build never loads, the second is pgTAP, which **did** run green in the
gate. The app the prod build would exercise is byte-identical to the one Batch 10 gated at 38/38.
`npm run e2e:prod` is **not owed**.

**Rebase.** `docs/plans/pre-ae5-remediation.md` carries **no conflict markers**; §2 row 10 holds
`main`'s cell (*"✅ PUSHED 2026-09-10 … a FIFTH one-push override"*) whole; and the branch's own
later edit to that file — the 2026-09-11 `SPENT` marker at `:404-411` — **survived**, carrying the
correct post-unit figures (1728 / 864) rather than the pre-unit 216 / 0.

**Follow-up shape (lead-playbook §4 step 9).** `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-
WARN-LINE`: the register entry's and the body's `**Closes when:**` clauses name the **same five
conditions** in the same order (PO names the noun · a docs-only or next-backend unit lands the split
· new routed seam file with a scaffolded `## Current state` · README router updated · gate 16 exit 0
with no `[D]` on this file · moved slices' relative links checked by a run), and both carry the
cap/ratchet prohibition — the entry as *"⛔ Neither the cap nor the ratchet may be raised"*, the body
as *"may only be LOWERED"*. **No inversion, no drift.** The gate 16 figures the body quotes are the
ones my own run printed (160.0 KB, 97 lines, 3 left), and the body tells the reader to re-derive
rather than quote them.

**Rulings landed in a non-log artefact (lead-playbook §4 step 8).** **R1** (the axis is a
generator-side seam) is carried by `authz-matrix-axes.json` `axes.caseReach._source` — *"Added under
PO ruling R1 (2026-09-10)"* — and restated in the generated vector header; it also appears in ADR
0175's D3 delivery marker. **R2** (one value per class; classes 3+4 approved, class 5 a bug) is
carried by the vector's 14th column **as values**, by `expected_legacy()`'s docstring which quotes
the ruling's words, by `403` §7.3/§7.4/§7.5 assertion messages, by the manifest qualifier, by the
`BUGS.md` row and its body file, and by ADR 0175 D3 + § Consequences. **Neither ruling lives only in
the record.** `grep "R[0-9]\+" docs/decisions/0175-…` returns matches, so the cheap smell test is
clean.

## Could not verify — a work item for the lead, not a clearance

1. **`npm run lint` at `eaf1757a`.** The lead's re-run was still in flight when I finished; nothing
   in the corpus records it. I verified the two gates that were red/warning at the tip gate — gate 13
   (`check-docs-registers.mjs` **0**, `build-features-index.mjs --check` **0**) and gate 16
   (**0**, with the filed `[D]` warn) — but not the 17-gate chain, and not eslint at 0/0.
   (This is MINOR 5.)
2. **The three mutation proofs.** The manifest, the seam slice and the record all claim an org check
   inside arm 3, the grant row removed, and a role-keyed hat check were each applied **on scratch
   copies** and reddened a named section set (the last one reddening §7.4 + §4.1b while leaving §7.5
   green — the finding that *widened* the PO's caveat). Scratch copies leave no artefact; I did not
   reconstruct them, and my brief forbids mutating outside a rolled-back transaction. The committed
   `403` is untouched by the mutants, which I did confirm (it runs green as committed).
3. **The pre-unit `test:db` baseline `267 files / 9019 tests`.** I confirmed the post state
   (267 / 9023) and that `403` moved `plan(23) → plan(27)`, so the `+4` is self-consistent; the 9019
   itself is a historical figure I did not re-measure.
4. **The live unmasked arm-3 grant "reproduced on the untouched seed"** (2026-09-10 entry, subject
   `fb00…00e1`, caller `chefe.ccih@test.local`). Corroborated indirectly — §7.3b and §7.4 assert the
   same mechanism on the 403 fixture and pass — but I did not re-run the seed probe itself.
5. **`app.is_pqs_operator_of_for` (S6).** The axes `_source` says every role-keyed sub-arm resolves
   through `has_role`/`has_role_any`/`holds_role`. I traced four of six to that call directly and S8
   at one further hop; S6 delegates to `is_nsp_coordinator_of_for` / `is_pqs_member_of_for`, which I
   did not open. Nothing in the oracle rests on it (`403` builds `role_keyed` through S1), so this is
   a completeness gap in a doc sentence, not in a gate.

## Overall assessment

This is high-quality, adversarially-built work and it clears its own hardest bar: the thing it
changes is **what the suite asserts**, and it changes it in the direction that makes green harder to
get. Four properties stand out as better than the acceptance criteria demanded.

First, **the divergence was not allowed to become an exemption.** The obvious way to make §4.1 green
over 92 disagreeing cells is to skip them. This unit instead pays for the carve-out twice — §4.1b
asserts the legacy answer **by value** on every skipped cell, and generator `arm10` refuses at
generation time to record a divergence with no label to attribute it to. The one set of cells that
*is* excused from both (the ten filed-defect cells) is asserted head-on in §7.4 in the form *"this is
what it does, and it is wrong"*, with a comment stating that the day the bug is fixed the section
reds **on purpose**. That is the opposite of an oracle tracking its subject.

Second, **the fixture's own vacuity was measured and removed.** The `unreachable` axis value exists
for no reason except that without it every arm-3 deny in the population would be satisfied by an
empty join — a keystone that could not fail. §7.3b then proves the distinction live: participation=0
vs participation=1 with the same `door=false`, and `unreachable` vs `grant_keyed` one
`case_access_grants` row apart with the same hat, same case, same participant. The deny polarity is
therefore attributable, not coincident.

Third, **the saving is gate-scoped by a rule that cannot quietly widen.** Dropping 2592 duplicate
cells is the kind of decision that reads as a cost optimisation and later turns out to be a coverage
loss. Here the rule is named, its reason is inlined into the generated file, `arm7` refuses it if the
reason is blanked or if it widens far enough to drop a reach value from the population, and `arm9`
re-reads the **enforcement manifest** — not a static name in the generator — on every run to confirm
the premise still holds. The self-test proves arm9 fires on all four ways that premise can break,
and the runner asserts **which** arm fired, which is the lesson this unit paid for and wrote down
(LEARN-103).

Fourth, **the closure is at the source and it is narrow.** ADR 0175 D3 is closed by a dated marker
that also corrects the ADR's own stale three-arm enumeration, and the load-bearing Consequence is
**narrowed to arm 1**, not deleted — with the Gate-AE4 qualifier explicitly still owed. The manifest
retirement says the same thing in the same words, with the superseded text quoted verbatim (which I
verified byte-for-byte). Nothing here was closed by deleting the sentence that recorded the debt.

The security posture is unchanged and correct. No migration, no policy, no `src/**`, no service-role
surface. The one authorization *finding* the unit produced —
`BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE` — is filed, pinned by a
test, deliberately not fixed, and comes with a two-way constraint on its fix that is **wider than
the PO's own wording** because a mutation measured it so. That is the right disposition.

What holds the verdict back is small and uniform in shape: **the unit retired one false sentence and
left three.** Its central claim is contradicted by the door's own `prosrc` comment (MAJOR 2) — a
sentence the unit had already quoted and then falsified. Its seam summary states a property of arm 3
that the live catalog refutes, because a qualifier survived three compressions and not the fourth
(MAJOR 1). And two permanent documents cite a commit the session's own rebase destroyed (MAJOR 3),
which is the failure this programme has already paid for once. None of the three is a defect in the
build; all three are defects in the **record of** the build, which is the artefact AE5 increment 1
is going to read.

All six items are docs-only and none requires re-running the gate suite. Fix them, append the record
entry the two forward pointers already promise with the lead's bare `lint` rc, and this is an
approval.

**Verdict: CHANGES REQUESTED**

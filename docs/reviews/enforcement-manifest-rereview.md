# ENFORCEMENT-MANIFEST — QA RE-REVIEW (round 2, after fix-loop iteration 1)

## Verdict: **CHANGES REQUESTED**

**Reviewer:** `qa` · **Date:** 2026-09-07 · **Subject:** unit `ENFORCEMENT-MANIFEST`, branch
`authz-enforcement-manifest`, tree at **`5a64520f`** (**18** commits over `main` = `23ec1fa5`;
measured `git rev-list --count main..HEAD` — see **N-2**). Local stack
`supabase_db_azkbbhskturikxpgmafq`, catalog head `20261003007350`. Read-only throughout except one
bounded, fingerprint-verified mutation of `public.set_item_validations` (§ 1.2 below, restored and
re-verified); I wrote exactly one file: this report.

Round 1: [`enforcement-manifest-review.md`](./enforcement-manifest-review.md) — 2 blocking, 1 major,
3 minor, 2 recommendations.

---

## 0. Headline

**Seven of the eight round-1 findings are fixed, and five of them are fixed *better* than the
finding asked for.** I re-derived every load-bearing number myself and every one reproduced to the
digit. F-BLOCK-2's discharge is the strongest single artifact this unit has produced: I ran the
mutation independently and the suite reds on **exactly one** assertion, and it is the behavioural
authority assertion, not a text pin. F-MAJOR-1's portability rewrite is not merely "it passes now" —
I obtained GNU diffutils 3.8 (the `supabase_realtime` container) and proved the awk reconstruction
**byte-identical to the old GNU group-format implementation on 75 of 75 inputs**, including the two
classes the fixtures do not cover, with the only divergence in a class the pipeline cannot produce.

It is `CHANGES REQUESTED` for **one** blocking reason, and it is the round-1 finding's own failure
mode one step further along:

> **F-BLOCK-1 fixed § 6.7 step 4 and left the same stale constant standing in three other places in
> the same section — including § 6.1's pre-flight provenance table, which now says the exact opposite
> of what § 6.7 says.** The fix *discovered* that `a115005b6106573c70d98a6aceb8a4fe` is unreachable
> by this revert; it corrected the one occurrence the finding cited and none of the other three.

The remaining items are three minors and two recommendations. Nothing touches `src/`, `e2e/`, a
policy, a grant or a migration; **the security axis is unchanged from round 1 and still clean.**

---

## 1. What I re-measured, and what it returned

Everything in this section I ran myself at `5a64520f`. Bare exit codes, no pipes.

### 1.1 F-BLOCK-1 — every figure in the rewritten § 6.7 step 4 reproduces

`387`'s `ae15_hot_subset()` / `ae15_unwrap()` re-typed verbatim from
`supabase/tests/387_initplan_wrap_and_profiles_arm_identity.sql:98-135` into a read-only session:

```
c1_live  = f2a0693be216cfe08eb6cf0283565e7c        ✅ matches the runbook and 387:361
c2_count = 99                                      ✅ the cardinality control
hot-subset membership of the six re-keyed policies:
  form_items=true · form_sections=true · form_versions=true
  forms=false · form_item_options=false · form_item_validations=false     ✅ "three of your six"
```

Then § 6.2's **six** `alter policy` statements applied verbatim in a transaction and rolled back:

```
c1_after_revert = c227d64eb11909e94400b7ba6bcaab0b   ✅ exactly the value step 4 now commits
c2_after        = 99
c1_restored     = f2a0693be216cfe08eb6cf0283565e7c   ✅ verified restore
```

**`a115005b…` really is unreachable by this revert**, and the reason the runbook gives is the right
one, independently confirmed: `professional_profiles_select` is in the hot subset and its `qual` is
the post-`20261003007320` `CASE … app.current_professional_read_organizations()` shape. The only
migrations after `…7300` that could move C1 are `…7320` (a policy) and `…7340` (two policies I
measured **outside** the subset), so the four-value table is **exhaustive**, not merely plausible.

**§ 6.9's attribution correction is right**, and it is checkable from git rather than from prose:
`git log -S` on the two constants puts `3901715193753db33f980f939c6467de` into `387` at `69561819`
(which carries migration `20261003007300`) and replaces it with `f2a0693…` at `9f7fa68d` (which
carries migration `20261003007320`). So `3901715…` = "D6 applied, `professional_profiles_select`
pre-`7320`" — exactly the reading step 4 assigns it. `20261003007340` could not have moved C1.

**Ruling on "five stale figures + a sixth named separately".** The wording is **honest** — the sixth
is named in the same breath, in the closure entry, the record *and* the hub, with its measurement —
and I do not require it renumbered. But the taxonomy is inconsistent with clause 5's own treatment of
the **fourth** figure ("stale for a different reason than the others: a *different* migration added a
carrier"), which is the same reason the sixth is stale. ⚠ **The count question is moot anyway**: the
sixth figure is only **one-quarter fixed** — see **N-1**, which is the blocking item.

### 1.2 F-BLOCK-2 — the targeted case is real, and I reproduced its RED independently

I read `supabase/tests/mutation/authz-command-door-targeted-cases.sh` for vacuity first. Its
controls are the right ones and they are in the right order: anchor **uniqueness** asserted before
mutating (`:118-119`), fingerprint **moved** asserted after (`:141`), the authorizer name asserted
**gone** from the mutated body (`:142-143`), restore asserted **byte-equal** on the md5 (`:152-153`),
and the suite asserted **GREEN again** after restore (`:155`). The `psql -f - < "$SENTINEL"` note at
`:149-150` and the single-quote refusal at `:127` are both real traps closed.

Then I ran the mutation myself, outside the harness:

```
fingerprint before : 3c244fa6a08a510aa4708b87516e1be2
fingerprint mutated: bdcccfe0aa7ddab5ac3c2e8ce98fb094   (authorizer absent from the body: t)
409 under mutation : FAIL — "Looks like you failed 1 test of 75"
                     Failed test 32: "2.10e ⭐⭐ THE GATE LINE AT THE DEFINER DOOR …"
                       caught: no exception   wanted: 42501
fingerprint restored: 3c244fa6a08a510aa4708b87516e1be2   (matches before)
409 after restore  : PASS (75/75)
```

⭐ **This is a stronger result than the record claims.** The RED is not "the suite went red"; it is
**one** assertion, and it is the *behavioural* one — the door stopped raising `42501` because the
authority gate stopped firing. It is **not** § 2.10c, the text pin, which stays green under the
mutation (the mutant removes `can_edit_commission_forms`, not `is_staff_admin_of`, so `moved/no-code`
is unchanged) — i.e. the case is not measuring the same thing twice. The mutant genuinely changes the
answer, and the answer is the one the migration exists to move.

The DOMAIN line names both excluding arms and both reasons are properties I confirmed on the catalog:
`pg_get_function_result` = `void` with `prosecdef = t` (outside `p0-authz-door-audit.sh`'s boolean
`PRED_DOMAIN`), and C2's worklist joins `c2n.tier1` (closure reaches a PHI-marked relation), which
`form_item_validations` cannot satisfy. I also **reproduced the C2 refusal**, bare rc **2**:

```
=== DONE — swept 0 of 171 derived enforcer(s) ===   COVERED=0 BLIND=0 ERROR=0 (skipped by CASES: 171)
*** ABORT: swept ZERO enforcers. This is NOT a pass.   committed baseline VERIFIED unchanged (cksum)
```

`409` § 2.6f / § 2.10e is named beside it as a **different instrument** (a grant differential), in the
script header `:34-41`, in the record and in the hub — never as the discharge. **F-BLOCK-2 is closed.**

### 1.3 F-MAJOR-1 — the portable rewrite is provably equivalent, measured against GNU diffutils

`SELFTEST=1 bash scripts/door-sweep-cases.sh` → bare rc **0**, `SELF-TEST: PASS 34 · FAIL 0 ·
SKIPPED 0`, working tree clean after. (16 deriver scenarios + **18** merge scenarios — see **N-4**.)

The record's equivalence evidence is the fixtures. I did not accept that, because **`merge(b,b)` on
five fixtures and four real baselines is structurally unable to discriminate the two
implementations**: identical inputs make `diff` emit nothing, so both implementations emit the same
all-`U` stream by construction. So I measured it directly. GNU diffutils **3.8** is present in
`supabase_realtime_azkbbhskturikxpgmafq` (the `supabase_db` container is BusyBox; there is no `gdiff`
on this host). I ran the old implementation (`git show 7b9b1eb7:scripts/lib/merge-findings-baseline.sh`
lines 447-451) in that container against the new awk block, on:

| corpus | result |
| --- | --- |
| 15 hand-built edge cases — multi-line `c` hunk, change at line 1, `c` spanning to EOF, **empty generated file**, empty baseline, both empty, insert-at-start (`0a1,N`), delete-at-end, identical files, content lines that *look* like hunk headers (`12,15c20,23`, `< a`, `> b`, `---`, `\ hm`), blank lines | **13 SAME**, 2 differ (`c11`/`c12` only) |
| the four **real** committed findings baselines, each vs a perturbed copy (delete/change/insert every 37th/23rd/53rd line) | **4 / 4 byte-identical** (1219 / 189 / 97 / 154 tagged lines) |
| 40 realistic random pairs drawn from `authz-door-audit-findings.md` | **0 / 40 divergences** |
| 60 adversarial random pairs over a 14-symbol duplicate-heavy alphabet | 10 / 60 divergences — **all of them diff-binary alignment, not reconstruction** (see N-REC-2) |
| **the reconstruction in isolation**: GNU's *normal* diff output fed to the new awk, compared to GNU's *group-format* output, over all 75 pairs | **73 / 75 byte-identical** |

The two exceptions are `c11`/`c12`, both **no trailing newline at EOF**: GNU's `%L` emits the line
without its newline, so its output degenerates to `ObNc` on one line — which the step-3 consumer
(`:503-529`, which dispatches on `substr($0,1,1)`) would **misparse**. The awk `print` always
terminates. So in that class the new implementation is *more* correct, and the class is unreachable
in production anyway: `g_norm`/`b_norm` are written by `split_file`'s awk `print` (`:357-386`) and are
always newline-terminated or empty. **F-MAJOR-1 is closed**, and closed on measurement rather than on
the fixtures alone.

### 1.4 F-MINOR-1 / -2 / -3 and F-REC-1 / -2 — all met

| finding | verified |
| --- | --- |
| F-MINOR-1 | `authz-rollback-runbook.md:235` now reads *"EXPIRED AT HEAD `20261003007340`, MEASURED DEAD ON 2026-09-07"*, with the misreading kept as a dated note (LEARN-088 form). ✅ |
| F-MINOR-2 | `410:1082-1087` now reads **"12 OF THE 13"** and states the two-populations rule with the mechanism (`current_professional_read_organizations` composes `authz.authorized_scope_ids`, never calls the authorizer; 12 + 1 + 1 = 14) and the LEARN-079 pointer. ✅ Caption text only — `Files=262, Tests=8882` unchanged, confirmed below. |
| F-MINOR-3 | The query is pasted beside the figure and **I ran it**: `2564 \| 867`, exactly. The definition ("distinct `(caller, callee)` pair") is what my two round-1 reconstructions were missing; the row now meets `backend-state.md`'s own standard. ✅ |
| F-REC-1 | Record row 8 and ADR 0193 D8 both now carry the predicate (`… like '%is_staff_admin_of(app.commission_of_version%'` = the **pre-cutover** shape) and both state that the bare shape is still carried by 4 live policies. ✅ |
| F-REC-2 | Recorded in the record as a **lesson candidate for the lead**, with the rule stated in operational form. ✅ Its home (`LESSONS.md`) is the lead's Record-step call, correctly deferred. |

### 1.5 The lead's gate entry — reproduced, and the ruling is sound

| claim | my measurement |
| --- | --- |
| `SCOPE:` line | reproduced **verbatim**: `SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked \| filter: none \| derivation: catalog` |
| deriver exit + result, all three arms | default rc **1**, `ARM=read` rc **1**, `ARM=write` rc **1**, each `=== RESULT: FINDING (1) — DOORS IDENTIFIED: 1.  SWEEPABLE BY THIS ARM: 0. ===` |
| `SELFTEST=1 door-sweep-cases.sh` | rc **0**, `PASS 34 · FAIL 0 · SKIPPED 0` |
| `npm run test:db` on this head | `Files=262, Tests=8882, Result: PASS`, rc 0 |
| `npm run lint` | rc **0**, 13 gates, 0 errors / 0 warnings; `gen-authz-matrix-cells: in sync … manifest 43 rows, sha 493370f994a5`; `build-features-index: OK` |
| C2 neutralizer refusal | rc **2**, `swept 0 of 171`, committed baseline verified unchanged |
| no app-code / migration change in the fix loop | `git diff --stat 7b9b1eb7..5a64520f` touches only `docs/`, `scripts/lib/`, `supabase/tests/` — no `src/`, no `e2e/`, no `supabase/migrations/` |

**The exit-1 ruling is sound.** The deriver's own text names exactly two discharges; the record takes
the first (a targeted mutation case, now verified), explicitly refuses the `CASES=` escape hatch that
ADR 0079 hazard 4 forbids, refuses to substitute `409` for it, and quotes the `SCOPE:` **and**
`RESULT:` lines rather than the bare exit code (ADR 0190). "**No gate in the read or write arm's
domain changed** — that is the `SCOPE:` line's claim and the FINDING names the only exception" is
exactly the right shape: it is bounded by the instrument, not asserted about the world.

**Prose claims beside measurements that a gate cannot contradict — I looked for these specifically.**
The gate entry is unusually clean on this axis: every row is a bare rc plus quoted harness output, the
two lead errors are recorded rather than tidied, and "Tier 2's 190 doors stay deferred by ADR 0171 and
are NOT cleared" is the required disclosure. The **one** uncontradictable claim in it is its own
header count — and it is wrong (**N-2**).

### 1.6 `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` — register shape and falsifiability: ✅

Register line carries the emoji severity, owner, filed date, `Closes when`, `Status`, `Body`; gate 13
green (`204 follow-ups, 156 follow-up bodies`). The `Closes when` is **falsifiable and mechanical** —
three named conditions, two of them at file:line, one of them a required self-test scenario — and it
names two non-closures (a hand-check note; making the deriver print on FINDING). I verified all six
cited line numbers on the live scripts: `p0-authz-door-audit.sh:128` (`if [ -n "$CASES" ]`) and
`:1097` (`[ -z "$CASES" ] && return 0`); `p0-authz-writepath-audit.sh:201`/`:1064` and `:315`. All
exact. `scripts/door-sweep-selftest.sh` exists. The "deliberately not fixed here — Part 2 is Batch 3's
and edits the same two files" ruling is the right call under the file-ownership rule.

---

## 2. Findings

### N-1 (BLOCKING) — the fix corrected one of four occurrences of `a115005b…`, and § 6.1 now contradicts § 6.7 inside the same section

**Where:** `docs/deployment/authz-rollback-runbook.md` — **`:180`**, **`:236`**, **`:833`**, **`:839`**.
Compare `:770` (the line the fix wrote).

**What the fix established** (`:770`, and I reproduced it in § 1.1):

> `a115005b6106573c70d98a6aceb8a4fe` — ⛔ **NOT REACHABLE BY THIS REVERT** … Landing here means you
> reverted **`20261003007320` as well**, which is **not** part of this rollback

**What the same section still says, unchanged by `main...HEAD`:**

| line | text | status |
| --- | --- | --- |
| `:236` | § 6.1's **pre-flight provenance table**, row `form_versions_staff_admin_write`: *"pgTAP `387` C1 records the pre-D6 md5 `a115005b6106573c70d98a6aceb8a4fe` … **Get this policy's text right — arm order included, § 6.2 — and C1 returns to that constant exactly**"* | ⛔ **false**. Measured: it returns `c227d64eb11909e94400b7ba6bcaab0b` |
| `:839` | *"you are *performing* the inversion, so **C1 returning to `a115005b…` is not a chore — it is the best single verification in this whole section**"* | ⛔ **false**, and it is an instruction |
| `:833` | § 6.9's `387` row: *"…**reverting toward** `a115005b6106573c70d98a6aceb8a4fe`"* — in the very cell whose attribution note this change corrects | ⛔ **false** |
| `:180` | the derived-expectations paragraph: *"every **post-revert** number here — the `63`, the `1`-row code census, **the `a115005b…` md5**, …"* | ⛔ **false**, and it is now also under-stated: the post-revert C1 is no longer a derived expectation, it was **derived by inversion and measured** |

**Why it is blocking, and why it is worse than the round-1 finding it descends from.**

1. **It is a self-contradiction inside one 03:00 procedure.** § 6.2's own rationale for deleting the
   interim banner is quoted in this diff: *"an operator at 03:00 reading a banner and a body that
   disagree has to decide which one is current, which is the cost the banner was meant to avoid."*
   § 6.1 and § 6.9 are now that banner.
2. **The failure direction is the harmful one.** An operator who follows § 6.1 `:236` / § 6.9 `:839`,
   reverts correctly, and lands on `c227d64e…` is told by those lines that the best verification in
   the section failed. The two repairs the text makes available are (a) edit the pin — which `387`'s
   own comment forbids in words this runbook quotes twice — or (b) keep reverting until C1 reaches
   `a115005b…`, which requires **also reverting `20261003007320`**, an out-of-scope change to
   `professional_profiles_select` that this rollback never mentions. § 6.7 says so explicitly. The
   runbook therefore contains, simultaneously, the instruction to do it and the warning that it is
   not part of this rollback.
3. **It is the closed follow-up's own lesson, unlearned at the next radius.** The record states it:
   *"a figure inside a section you are re-measuring is not re-measured by being nearby."* Four
   occurrences of one constant; one was cited by QA; one was fixed.

**Remedy (text only, no re-measurement — every value below is already derived and committed at
`:770`).**
1. `:236` — replace *"C1 returns to that constant exactly"* with the measured post-revert value
   **`c227d64eb11909e94400b7ba6bcaab0b`** and a pointer to § 6.7 step 4's four-value table; keep
   `a115005b…` only as what `387`'s **comment** records as the pre-D6 value, with the dated note that
   it is no longer reachable by this revert.
2. `:839` — same substitution; the sentence's claim ("the best single verification in this section")
   survives intact once the constant is right.
3. `:833` — *"reverting toward `c227d64eb11909e94400b7ba6bcaab0b`"*, with the existing dated
   attribution note kept.
4. `:180` — replace `a115005b…` with `c227d64e…` and move it out of the "derived expectation, not a
   measurement" list: it **was** measured, by inversion in a rolled-back transaction, and saying so is
   an upgrade to that paragraph's own honesty ledger.
5. One line in the record and the hub recording that the sixth figure was stale in **four** places and
   is now corrected in all four — so the next reader does not have to re-derive which ones.

⛔ **Not a remedy:** a banner at the top of § 6 saying "some constants below are stale". That is the
artifact § 6.2 deleted on purpose.

---

### N-2 (MINOR) — the gate entry identifies its own tip by a commit count that is wrong, and the commit that existed to fix the counts fixed one of two

**Measured** (`git rev-list --count main..<ref>`, `main` = `23ec1fa5`):

```
7b9b1eb7 -> 10     bd289466 -> 16     e5796940 -> 17     5a64520f (HEAD) -> 18
```

| where | says | measured |
| --- | --- | --- |
| `docs/progress/enforcement-manifest.md:436` (the lead's gate entry header) | *"Tip `e5796940` (**16** commits over `main` @ `23ec1fa5`)"* | **17** |
| `docs/features/enforcement-manifest.md:89` | *"iteration 1 closed all eight (**5 commits** over `7b9b1eb7`…)"* | **6** — and the record at `:275` lists all six by sha |
| `docs/features/enforcement-manifest.md:111` | *"(16 over `main`)"* | 16 was right at `bd289466`; it is 18 at HEAD (a snapshot, acceptable if dated) |

Commit `e5796940`'s message is *"correct the commit count in the hub and record (16 over main, not
12)"*; it changed hub `:111` only, left hub `:89` at five against the record's six, and the gate entry
written after it introduced a fresh off-by-one. Nothing reads these numbers — but this unit's standing
rule is that a number in a record is re-derivable, and `git rev-list --count` is the deriver.

**Remedy:** hub `:89` → **six**; record `:436` → **17**, or drop the count and keep the sha (the sha is
the identifier; the count is the decoration that goes stale).

---

### N-3 (MINOR) — the hub's `## Current state` is behind the record, and `reviews:` is still `[]`

**Where:** `docs/features/enforcement-manifest.md` frontmatter (`reviews: []`) and `:110-118`.

- **`### Next`** still reads *"QA re-review …, **then the lead's tip gate (§E)**"* — but the tip gate
  ran, at `5a64520f`, and its 12-row table is in the record. **`### In progress`** reads *"Nothing.
  Iteration 1 is complete"*, which was true at `bd289466` and is now silent about the gate.
- **`reviews: []`** while `docs/reviews/enforcement-manifest-review.md` has been committed since
  `bd289466`. A reader who opens the hub — the designated **summary** (CLAUDE.md § 7) — cannot reach
  either review.

Gate 7/13 cannot catch this: they enforce presence and shape, never truth. This is the lead's
Record-step surface, and it is exactly the "hub ≠ reality" case § 7 exists to prevent.

**Remedy:** replace the hub's `### Next` / `### In progress` to reflect the gate having run (state
words only; the witnesses stay in the record), and add both review paths to `reviews:` before Record.

---

### N-4 (MINOR) — the new comment in `merge-findings-baseline.sh` miscounts its own evidence

**Where:** `scripts/lib/merge-findings-baseline.sh:465-466` — *"The equivalence is asserted by the
**17** committed merge scenarios (including `merge(b,b) == b` byte-for-byte on all five baselines)"*.

**Measured** from `SELFTEST=1 bash scripts/door-sweep-cases.sh`: 16 deriver scenarios + **18** merge
scenarios = 34. The record says 18 and is right; the file the fix wrote says 17. A comment whose whole
job is to stop someone reverting the block should not miscount the thing that licenses it.

**Remedy:** 17 → 18 in that comment.

---

### N-REC-1 — the targeted case does not pin *which* assertion reds, so a flake could read as COVERED

`authz-command-door-targeted-cases.sh:145` decides `COVERED` from `run_suite` returning non-zero, i.e.
from `409` not printing `^Result: PASS`. Any red in that 75-assertion file — an unrelated flake, a
fixture collision, a future assertion — reads as "a keystone noticed". The post-restore GREEN check at
`:155` is a decent backstop (a structurally broken `run_suite` would fail there too), but a *transient*
red under mutation plus a green after restore is indistinguishable from a genuine COVERED.

I measured the real answer, and it is a single assertion: **`409` test 32, § 2.10e**, `caught: no
exception / wanted: 42501`. This program's own idiom is already the fix — § 2.10e itself is keyed on
`42501` *specifically* rather than a bare `throws_ok`, and says why in its caption.

**Remedy (one line):** assert the mutated run's failure set is exactly `{32}` (or grep the captured
output for `Failed test 32`), and fail as `ERROR` otherwise. Cheap, and it converts "the suite noticed"
into "the assertion that measures this door noticed".

---

### N-REC-2 — the merge is now portable, and therefore its *alignment* is now the host's; say so

The rewrite reconstructs whatever edit script `diff` hands it, faithfully (73/75, and the 2 are
strictly better — § 1.3). But **Apple `diff` and GNU `diff` do not always choose the same minimal edit
script**, and the merge's only alignment-sensitive step is the CHG-group "same shape once digits are
removed" drop rule at `:517-519`. Measured example (`fz/1`):

```
Apple : 5c3,4  +  7d5          →  CHG{O "> g"}{N…} ; U "0" ; DEL{O "0"}
GNU   : 5,6c3,4                →  CHG{O "> g", O "0"}{N…}
```

Both are valid minimal scripts; they group differently, so a baseline line that GNU would drop as a
regenerated statistic Apple may preserve. Rate: **10 / 60** on a duplicate-heavy adversarial alphabet,
**0 / 40** on realistic findings-baseline content, **0 / 4** on the real committed baselines. So the
practical risk is small — but this program deliberately runs Batch 3 and Batch 4 **on different
machines**, both of which merge the same committed artifact.

**Remedy (a dated note, not code):** in the `:447` comment block, qualify *"the SAME tagged stream"*
with *"given the same `diff` alignment"*, record that alignment is now the host's, and record that
`merge(b,b)` — the strongest-sounding fixture evidence — **cannot discriminate the two
implementations**, since identical inputs emit no hunks. If the lead wants the risk removed rather than
disclosed, the follow-up shape is: assert `merge(g,b)` is byte-stable across machines for one real
baseline pair at the Batch-3 rebase.

---

## 3. Axes with nothing to report

| axis | verdict |
| --- | --- |
| **Security / RLS** | ✅ Unchanged from round 1, and I re-confirmed the change surface: `git diff --stat 7b9b1eb7..5a64520f` touches no migration, no policy, no grant, no `src/`. `public.set_item_validations` is `prosecdef = t`, returns `void`, `search_path` untouched; the one mutation I performed was restored and verified byte-identical on md5, then `test:db` re-ran clean at `Files=262, Tests=8882`. **`prosecdef` was read beside `pg_policies` throughout** — the door in this diff is *only* visible that way, which is the whole point of § 8.7 and of the targeted case. |
| **Code quality** | ✅ No `src/` or `e2e/` change. The new shell case follows the two established targeted homes' shape; the awk block is portable POSIX (verified on macOS BSD awk) and adds no dependency. File ownership respected — one agent, backend-owned paths. |
| **UX & a11y** | n/a — no user-facing surface. |
| **Hygiene** | ✅ ADR 0193 D8 amended in place with a dated `(QA F-REC-1)` qualifier rather than a rewrite; `**Amends:** 0176, 0178` header and generated back-pointers unchanged and still present. `npm run lint` 13 gates 0/0, `lint:registers` OK, `build-features-index` in sync. `PROGRESS.md` untouched (correct — this is a unit). The one hygiene gap is **N-3**. |
| **Vacuity** | ✅ The two arms I could break, I tried to break: the targeted case's RED is attributable to the mutation and to the *behavioural* assertion (§ 1.2), and the merge equivalence is measured against the implementation it replaced rather than asserted (§ 1.3). |

---

## 4. What must happen before this is `APPROVED`

1. **N-1** — the three remaining `a115005b…` occurrences (`:236`, `:833`, `:839`) and the
   derived-expectations list (`:180`) corrected to `c227d64eb11909e94400b7ba6bcaab0b`, with one line in
   the record/hub saying the sixth figure was stale in four places and is fixed in all four.
   *(text only; every value is already committed at `:770` — no re-measurement, no re-run)*
2. **N-2** — hub `:89` five → six; record `:436` sixteen → seventeen (or drop the count).
3. **N-3** — hub `## Current state` brought level with the record's tip-gate entry, and `reviews:`
   populated.
4. **N-4** — one digit in `merge-findings-baseline.sh:466`.
5. **N-REC-1 / N-REC-2** — at the lead's discretion; N-REC-1 is one line and closes a real (if narrow)
   false-COVERED path.

None of these requires re-running `test:db`, the arms, the deriver, or the targeted case. **On the
substance — the re-key, the fixed point, the two new axes, the class sweep, the closures, the
portability rewrite and the deriver's discharge — this unit is approved on the merits, and its
fix-loop iteration 1 is the best-measured remediation round I have reviewed on this program.** What
stands between it and `APPROVED` is one constant, four times, in the document where being wrong costs
the most.

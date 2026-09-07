# ENFORCEMENT-MANIFEST — QA RE-REVIEW (round 3, after fix-loop iteration 2)

## Verdict: **APPROVED**

**Reviewer:** `qa` · **Date:** 2026-09-07 · **Subject:** unit `ENFORCEMENT-MANIFEST`, branch
`authz-enforcement-manifest`, tree at **`dcecd939`** (**23** commits over `main` = `23ec1fa5`;
measured `git rev-list --count main..HEAD`). Local stack `supabase_db_azkbbhskturikxpgmafq`, catalog
head `20261003007350`, freshly reset. Read-only throughout except the one bounded, self-restoring
mutation the targeted case performs on `public.set_item_validations` (§ 1.5, restored and verified);
I wrote exactly one file: this report.

Scope: **only** the six round-2 findings — N-1 (blocking), N-2, N-3, N-4, N-REC-1, N-REC-2 — as
addressed by `git diff 5a64520f..dcecd939` and the record's `QA fix loop, iteration 2` entry, plus a
sweep for **new** prose claims the fix introduced beside its measurements. Round 2:
[`enforcement-manifest-rereview.md`](./enforcement-manifest-rereview.md) · Round 1:
[`enforcement-manifest-review.md`](./enforcement-manifest-review.md).

---

## 0. Headline

**All six findings are closed, and I re-derived every load-bearing figure myself; every one
reproduced.** N-1 — the blocking one — is closed *better* than the remedy asked for: rather than four
scattered dated corrections, the fix corrects all four sites and dates the explanation **once**, at
the § 6 header, which is the artifact § 6.2 deliberately does *not* become (it is an explanation of a
completed correction, not a "some constants below are stale" banner over uncorrected text — I checked
each of the five surviving occurrences in context). N-REC-1's pin is stronger than the one line I
suggested: it is keyed on the assertion's **description text** as well as its number, so a
renumbering of `409` fails loudly as `ERROR` instead of quietly reading `COVERED`.

The change surface is `git diff --name-only 5a64520f..dcecd939` = four docs + one shell library + one
mutation case. **No migration, no policy, no grant, no `src/`, no `e2e/`. The security axis is
unchanged from rounds 1 and 2 and still clean**, and I re-confirmed the door this unit exists to move
is intact and DEFINER at the tip.

Three items remain, all **non-blocking**: one MINOR transcription slip inside the record's own
`Observed` block for N-1 (**R3-1**), and two recommendations (**R3-REC-1**, **R3-REC-2**). None is a
requirement violation, none touches security, and none needs a re-run of anything.

---

## 1. What I re-measured, and what it returned

Bare exit codes, no pipes, at `dcecd939`.

### 1.1 N-1 (was BLOCKING) — closed. All four stale occurrences corrected; nothing left claiming C1 returns to `a115005b…`

`rg -n "a115005b" docs/deployment/authz-rollback-runbook.md` → **5 hits**, and I read every one in
context:

| line | what it now says | ruling |
| --- | --- | --- |
| `:167`, `:169`, `:171` | the **new dated § 6 header note**: names the four wrong sites, states `a115005b…` is `387`'s **pre-D6** value, moved out of reach by `20261003007320`, and that the measured landing value is `c227d64eb11909e94400b7ba6bcaab0b` | ✅ correct, and correctly framed as *pre-D6*, never as a landing value |
| `:251` | § 6.1's pre-flight provenance row: *"pgTAP `387` C1 records the pre-D6 md5 `a115005b…` (that value is unreachable by this revert alone — § 6.7 step 4). Get this policy's text right … and C1 returns to **`c227d64eb11909e94400b7ba6bcaab0b`**"* | ✅ the contradiction with § 6.7 is gone; the "re-derived by inverting the change" attribution now sits on the value that *was* derived by inversion |
| `:785` | § 6.7 step 4's four-value landing table, the ⛔ **NOT REACHABLE BY THIS REVERT** row — **unmodified** | ✅ already correct since F-BLOCK-1 |

And the two round-2 sites that carried the constant as an *instruction* are gone: `:848` (§ 6.9's
`387` row) now reads *"reverting toward `c227d64eb11909e94400b7ba6bcaab0b`"*, and `:854`'s "best
single verification in this whole section" sentence now names `c227d64e…`. **The claim I was asked to
falsify — that some sentence still tells an operator C1 returns to `a115005b…` — is false. There is
no such sentence.**

The derived-expectations paragraph (`:189`, was `:180`) does more than the remedy asked: rather than
swapping the constant inside the "derived expectation, not a measurement" list, it **removes the C1
md5 from that list** and says why — it is the one figure there that *was* measured, by inversion in a
rolled-back transaction. That is an upgrade to the paragraph's own honesty ledger, which is what I
asked for in remedy 4.

**The header note's own count is checkable, and it checks out.** `git show
5a64520f:…/authz-rollback-runbook.md | grep -n a115005b` → **5** occurrences at `:180`, `:236`,
`:770`, `:833`, `:839`; `:770` was the already-correct one. So "four places below … all four were
wrong" is exact.

⛔ **The thing I most wanted to catch here, I could not.** The note is not the artifact § 6.2 deleted:
it does not leave a stale body under a warning banner — every body it refers to was corrected in the
same commit, and I verified each one individually rather than trusting the note. Remedy item 5 (a
line in the record and the hub saying the sixth figure was stale in four places and is fixed in all
four) is present in both.

### 1.2 N-2 (MINOR) — closed on the hub; the record's stale figure is corrected in-entry, not in-place, and that is defensible

`git rev-list --count main..<ref>`, `main` = `23ec1fa5`:

```
7b9b1eb7 -> 10   bd289466 -> 16   e5796940 -> 17   5a64520f -> 18
65e7ed04 -> 19   b7c901b7 -> 20   cd2ef7eb -> 21   926f4066 -> 22   dcecd939 (HEAD) -> 23
```

Every count claimed in the fix reproduces to the digit:

| where | says | measured |
| --- | --- | --- |
| hub `:79` | iteration 1 = **"six commits over `7b9b1eb7`"** (was "5") | ✅ 16 − 10 = 6 |
| hub `:90` | iteration 2 = **"four commits over `5a64520f`"** | ✅ 22 − 18 = 4, and the four shas are listed in the record |
| hub `:102` | `git rev-list --count main..HEAD` = **22** as of `926f4066`, *"(before this doc commit)"* | ✅ 22, and the parenthetical is what makes it stay true at 23 |
| record `:483` | **22**, *"measured at `926f4066` immediately before this entry's own commit"* | ✅ |
| record `:526-529` | the four-line derivation table | ✅ all four exact |

The lead's gate-entry header at `:436` still reads *"16 commits over `main`"* against a measured 17.
The fix did **not** edit it; it records the discrepancy with its measurement in the new entry
(`:517`), on the lead's ruling that the concrete edit was scoped to the hub. **I accept this.** A
record is append-only by CLAUDE.md § 7 ("one dated entry per session, appended"), and I found no
precedent in this file for editing a prior entry in place (the one `⚠ CORRECTED` marker at `:227` is
a *quotation* of a correction made in `410`, inside its own entry, not an edit to an earlier one). The
figure is decoration beside a sha that is the actual identifier, the correction is in the same file
with the deriving command named, and unlike N-1 nobody executes a record at 03:00. See **R3-REC-1**
for the one-token option if the lead wants it visible at the point of use.

### 1.3 N-3 (MINOR) — closed

- `reviews:` frontmatter now reads
  `["../reviews/enforcement-manifest-rereview.md", "../reviews/enforcement-manifest-review.md"]` —
  both reviews reachable from the hub, which is the designated summary surface.
- `### Next` no longer names the tip gate as pending; it now reads *"QA re-review round 3 … or Record
  at the lead's discretion"*, followed by the real remaining sequence (PO → Batch 3 → rebase → Record,
  ADR 0193 → `accepted`). `### In progress` reads *"Nothing. Iteration 2 is complete"* with the
  measured count and its `as of <sha>` qualifier. `### Done since start` gained a bullet for the tip
  gate and one for this iteration.
- Shape gates green on the rewritten section: `check-docs-registers: OK (self-test + 10 hubs …)` and
  `build-features-index: OK (10 hubs; index in sync)`.

Every state word in the new `Current state` is a state word; the witnesses stayed in the record. That
is the § 7 split, correctly applied.

### 1.4 N-4 (MINOR) — closed, and the 18 is now derivable rather than asserted

I reproduced the derivation from the fixture directory, which is what the finding asked:

```
SELFTEST=1 bash scripts/door-sweep-cases.sh                      -> bare rc 0
  SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0        (34 PASS lines counted)
  merge-scenario PASS lines (A-E cases + idempotent: + MERGE_FAULT) -> 18   ✅
ls scripts/fixtures/door-sweep/merge/*.baseline.md | wc -l        -> 5      ✅
grep -c '^merge_scenario ' scripts/door-sweep-selftest.sh         -> 14  = 13 call sites + the
                                                                     function definition          ✅
13 + 5 = 18                                                                                        ✅
```

`git status --porcelain` empty after the run. The comment at `merge-findings-baseline.sh:472-479` now
says 18 and names both re-derivations. The record's `Observed` block for N-4 is exact, including the
`14 = 13 + definition` gloss.

### 1.5 N-REC-1 — the pin is real, it is on description text, and an absent `Result: PASS` alone can no longer read COVERED

I read the classifier before running anything. `supabase/tests/mutation/authz-command-door-targeted-cases.sh`:

- `:160-181` — after the mutated `run_suite`, `NOTOK="$(grep -c '^# Failed test ' "$MUTLOG")"` must be
  **exactly `1`**, and that line must match `^# Failed test 32: ".*2\.10e .* THE GATE LINE AT THE
  DEFINER DOOR`. **Anything else sets `VERDICT=ERROR`** — 0 failures, >1 failure, a renumber, a
  reword. So the round-2 hole (any red anywhere in a 75-assertion file reading as "a keystone
  noticed") is closed in both directions.
- `:211` — `[ "$COVERED" = "$SELECTED" ] || { echo "⛔ BLIND/ERROR is a finding, not a pass."; exit 1; }`.
  `ERROR` reaches the existing exit contract; it is **not** a pass. The `VERDICTS` header block
  (`:51-59`) was updated to say so, and names the N-REC-1 provenance.
- The `MUTLOG` hoist (`:85-90`) is correct and its comment states the real constraint: the log is read
  **after** the mutated call and **before** the restore call overwrites it, which is the order CASE 1
  already runs in. `$$` is the top-level shell's PID (the assignment is at top level, and `run_suite`
  is called from an `if` condition, not a subshell), so the two calls share one path by design.
- The restore is **unconditional** — it runs after the verdict block regardless of `COVERED`/`ERROR`
  (`:188-193`), so the new ERROR path cannot leave the database mutated. I checked this specifically,
  because a new early-exit there would have been a real regression.

Then I reproduced the real run, bare rc from the command itself:

```
bash supabase/tests/mutation/authz-command-door-targeted-cases.sh   -> rc 0
  fingerprint before : 3c244fa6a08a510aa4708b87516e1be2
  fingerprint mutated: bdcccfe0aa7ddab5ac3c2e8ce98fb094
  pin verified: # Failed test 32: "2.10e ⭐⭐ THE GATE LINE AT THE DEFINER DOOR — the assertion…
  409 under mutation: RED (good, pinned)
  fingerprint restored: 3c244fa6a08a510aa4708b87516e1be2  (matches before)
  409 after restore: GREEN
  CASE 1 VERDICT: COVERED   ·   === RESULT: 1 of 1 case(s) COVERED. ===
```

⭐ **The real run is itself the format proof.** Reaching `pin verified` requires `NOTOK == "1"` and the
description match, so the run empirically confirms the comment's measured claim that `npx supabase
test db` runs `pg_prove` non-verbose and surfaces failures as `# Failed test N: "<desc>"` rather than
raw TAP `not ok`. That claim is not on trust. The fingerprint restored to `3c244fa6…` — identical to
the value round 2 measured independently — and I confirmed on the catalog afterwards that
`public.set_item_validations` is `prosecdef = t`, returns `void`, md5 `3c244fa6a08a510aa4708b87516e1be2`,
with the in-flight sentinel removed.

The record's negative control (a scratch copy with `PIN='9\.99z DELIBERATELY WRONG PIN TEXT'` → rc 1,
`VERDICT: ERROR`, `0 of 1 COVERED`) is consistent with the classifier I read, and its stated reason
for needing no manual restore — the copy is self-restoring because the restore step runs regardless of
verdict — is a property I verified in the code rather than accepting from the prose.

### 1.6 N-REC-2 — the qualifier's figures and its consequence are correct

`merge-findings-baseline.sh:452-453` now qualifies *"the SAME tagged stream"* with **"GIVEN THE SAME
`diff` ALIGNMENT"**, and `:462-475` is the dated qualifier. Checked figure by figure against what I
actually measured in round 2 § 1.3:

| the comment says | round-2 measurement | ✓ |
| --- | --- | --- |
| 73/75 byte-identical vs GNU diffutils 3.8 group-format, the 2 exceptions strictly more correct | 73/75; the 2 are the no-trailing-newline class GNU misparses | ✅ |
| 10/60 divergent on a duplicate-heavy adversarial corpus | 10/60 | ✅ |
| 0/40 on realistic findings-baseline content | 0/40 | ✅ |
| 0/4 on the real committed baselines | 4/4 byte-identical | ✅ |
| `merge(b,b)` **cannot** discriminate the two implementations — identical inputs emit no hunks, so only the pass-through path runs, never the alignment-sensitive CHG "same shape once digits are removed" drop rule | exactly the reason I gave for not accepting the fixtures as the equivalence evidence | ✅ |
| consequence: Batch 3 and Batch 4 run on **different machines** and both merge this same committed baseline — it is the merge's input *and* output | confirmed independently: `23ec1fa5 docs(plans): Batch 4 runs on a separate machine in parallel with Batch 3` | ✅ |

It also states its own residual-risk ruling in the open (*"disclosed rather than fixed because the
measured risk on real content is 0/4 and 0/40"*), which is the right shape for a discretionary
recommendation. One clause goes a step past the measurements — see **R3-REC-2**.

### 1.7 Gates and change surface at the tip

| step | bare rc | observed |
| --- | --- | --- |
| `npm run lint` | **0** | 13 gates, 0 errors / 0 warnings; `gen-authz-matrix-cells: in sync (2002 cells … manifest 43 rows, sha 493370f994a5)`; `gen-authz-differential-cells: in sync (864 cells)`; `check-docs-registers: OK`; `build-features-index: OK (10 hubs; index in sync)` |
| `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `PASS 34 · FAIL 0 · SKIPPED 0`, tree clean after |
| targeted command-door case | **0** | `1 of 1 COVERED`, pin verified, fingerprint restored |
| change surface | — | `git diff --name-only 5a64520f..dcecd939` = 4 docs + `scripts/lib/merge-findings-baseline.sh` + `supabase/tests/mutation/authz-command-door-targeted-cases.sh`. **No `supabase/migrations/`, no `src/`, no `e2e/`.** |

**The "arms not re-run" ruling is sound and correctly bounded.** The record states it as a claim about
the *instrument's domain* ("nothing under `supabase/migrations/` moved, so no gate in their domain
changed"), backed by the quoted `--stat`, not as a claim about the world — which is the ADR 0190 shape
the round-2 gate entry established. I verified the premise myself; it holds.

---

## 2. Findings

### R3-1 (MINOR) — the record's `Observed` block for N-1 presents a line number that is not what `rg` printed

**Where:** `docs/progress/enforcement-manifest.md:503-511`.

The block is introduced as *"`rg -n "a115005b" docs/deployment/authz-rollback-runbook.md` → 5 hits,
all correct as they stand"* and then lists them: `:167,169,171`, `:251`, **`:782`**. Four are exact.
The fifth is not:

```
awk 'NR==782 || NR==785' docs/deployment/authz-rollback-runbook.md
  782: | --- | --- |                                    <- the table's separator row
  785: | **`a115005b6106573c70d98a6aceb8a4fe`** | ⛔ **NOT REACHABLE BY THIS REVERT, …
```

The **conclusion is true** — 5 hits, all correct, no occurrence left claiming C1 returns to
`a115005b…`; I verified that independently in § 1.1 and it is the reason this round is APPROVED. But
the block is offered as literal instrument output for the finding that blocked the last round, and one
of its five figures does not re-derive from the command it names. That is this program's own
"text is not truth" class at its smallest radius: a line number transcribed rather than re-read.

Related and even smaller, in the same fix: the runbook's header note (`:169`) describes the two § 6.9
sites as *"two **cells** in § 6.9's expected-red inventory"*, but only `:848` is a table cell; `:854`
is the prose paragraph below the table. The record's own N-1 entry describes them correctly ("§ 6.9's
row and prose paragraph"), so the runbook is the one that drifted.

**Remedy (text only, no re-measurement):** `:782` → `:785` in the record's `Observed` block, and
*"two cells"* → *"a row and the prose paragraph below it"* in the runbook's header note. Cheap enough
to fold into the Record commit.

---

### R3-REC-1 — the gate entry's `16` is corrected 80 lines later and nowhere at the point of use

Non-blocking, and I explicitly accept the append-only reasoning in § 1.2. But if the lead reads
CLAUDE.md § 7's append-only rule as barring only the *rewriting* of a prior entry's claim — not a
dated pointer beside it — then the minimal, precedent-compatible form is one bracket at `:436`:

> Tip `e5796940` (16 — ⚠ **17**, corrected in the 2026-09-07 iteration-2 entry — commits over `main` …)

This is the lead's call about the lead's own entry, which is why it is a recommendation and not a
finding. Either way the sha, which is the actual identifier, is right.

---

### R3-REC-2 — two clauses in the new merge comment are reasoned rather than measured; label them

The dated qualifier is accurate on every figure (§ 1.6). Two of its sentences are *arguments*, and the
comment does not distinguish them from the measurements they sit beside:

1. *"A divergent alignment on that merge would surface as a diff AT REBASE, not as a false PASS here,
   **which is where it is caught**."* The first half follows from the merge writing the committed
   baseline. The second half assumes a human reading a rebase diff recognises an alignment artifact as
   one — plausible, unmeasured, and no gate can contradict it. If the lead wants it stronger, the
   round-2 follow-up shape still stands: assert `merge(g,b)` byte-stable across machines for one real
   baseline pair at the Batch-3 rebase.
2. The re-derivation gloss *"one `idempotent: <name>` per baseline fixture file … `ls
   scripts/fixtures/door-sweep/merge/*.baseline.md | wc -l` **for the fixture-driven half**"*. It is
   true today (I measured 5 = 5), but the loop at `scripts/door-sweep-selftest.sh:420-425` iterates a
   **hardcoded list of five names**, not the glob. A sixth fixture would make the stated derivation
   read 19 while the harness still runs 18 — the count would stop being re-derivable by the command
   the comment names. Either derive the loop from the glob (`for mb in $(ls "$MFIX"/*.baseline.md …)`)
   or say "five names hardcoded in the § 24 loop, currently one per fixture file".

Both are one-line dispositions and neither blocks.

---

## 3. Axes with nothing to report

| axis | verdict |
| --- | --- |
| **Requirements** | ✅ In scope for this round: all six round-2 findings closed, each re-derived above. The unit's own acceptance list is unchanged by this iteration (its two open boxes are the lead's gate/rebase and ADR 0193 → `accepted` at Record, both correctly still open). |
| **Security / RLS** | ✅ Unchanged from rounds 1 and 2, and re-confirmed at this tip: the diff touches no migration, policy, grant, RPC or `src/`. **`prosecdef` read beside the catalog, not inferred:** `public.set_item_validations` is `prosecdef = t`, returns `void`, md5 `3c244fa6a08a510aa4708b87516e1be2` after my run — identical to before it — and the in-flight sentinel file is gone. The DEFINER door this unit re-keyed is intact, and the instrument that proves it is *now strictly harder to fool* than it was in round 2. |
| **Code quality** | ✅ No `src/`/`e2e/` change. The new shell block is POSIX, uses the existing `fail`/verdict idiom, adds no dependency, and both scripts run clean. File ownership respected — backend-owned paths only. |
| **UX & a11y** | n/a — no user-facing surface. |
| **Hygiene** | ✅ `lint` 13 gates 0/0; `check-docs-registers` and `build-features-index` green on the rewritten hub; `reviews:` populated; ADR headers untouched this iteration (0193 still `proposed` with `**Amends:** 0176, 0178`, correctly flipped to `accepted` only at Record); `PROGRESS.md` untouched, correct for a unit. The one gap is **R3-1**. |
| **Vacuity** | ✅ I tried to break both new instruments rather than reading them. The pin: I read the classifier for the "absent `Result: PASS` alone" path *before* running, confirmed `ERROR` reaches `exit 1`, and confirmed the restore runs on the ERROR path so the new branch cannot strand a mutated door. The 18: derived from the fixture directory and the call sites, not read off the tally line. The N-1 closure: five occurrences read in context, and the header note's own count re-derived from `git show 5a64520f`. |

---

## 4. Ruling

**APPROVED.** Every round-2 finding is closed on measurement I reproduced independently, two of them
(N-1's single dated note, N-REC-1's description-keyed pin) closed better than the remedy asked. **R3-1
is a one-token record correction and R3-REC-1 / R3-REC-2 are dispositions at the lead's discretion;
none of the three is a condition of this approval**, and none requires re-running `test:db`, the authz
arms, the deriver, the door sweep or the targeted case. R3-1 is cheap enough that the Record commit is
its natural home.

On the substance across three rounds — the re-key, the falsifiable `hardDenyClasses`, the transitive
§ 6.2, the class sweep, the five follow-up closures, the portable merge, the deriver's discharge by a
real targeted mutation, and now a mutation case whose COVERED verdict is pinned to the one assertion
that measures the door — this unit is approved. It is ready for the human, the PO step, and the Batch-3
rebase (with both arms and the `SCOPE:` line re-quoted there, as its own acceptance list already
requires).

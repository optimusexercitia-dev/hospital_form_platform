# ❌ VERDICT: CHANGES REQUESTED

**Unit:** DOOR-SWEEP-DERIVER (pre-AE5 remediation, Batch 1)
**Reviewed tree:** `authz-door-sweep-deriver` @ `de955981` (11 commits `53001454..de955981` on `main` @ `76d87a4f`)
**Reviewer:** `qa` · 2026-09-05 · read-only on all code; this file is the only artifact written
**Standard applied:** `docs/reviews/harness-crash-safety-review.md` + `-rereview.md` (Batch 0)

Every claim below is labelled **MEASURED** (I ran it in this review) or **INFERRED** (read from
code/records without executing). Exit codes were read **bare**, never through a pipe.

---

## Summary

The **deriver** (`scripts/door-sweep-cases.sh`) is good work and I could not break its central
claim. The `PRED_DOMAIN` lift is real, the tier split is real, the ABORT fires, the marker read
is genuinely unconditional, and every load-bearing witness in the record reproduced **exactly**
on my machine. If the unit were only the deriver I would approve it.

It is not. The unit also ships `scripts/lib/merge-findings-baseline.sh`, wired into all four
mutation harnesses on the path that **writes the committed findings baselines**. That helper
does not hold the property it exists to hold. I destroyed hand-authored material from two of the
four committed baselines with it, in three distinct shapes, and in every case the helper exited
**0** and reported that it had preserved everything.

That is the same defect the follow-up it closes describes — `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-
HAND-MERGED-ANNOTATIONS` — reproduced one layer out, which is the exact framing the helper's own
header uses at `scripts/lib/merge-findings-baseline.sh:56-57`:

> "A merge that loses a block must fail loudly; a merge that silently drops one is the defect
> this file exists to prevent, one layer out."

Because Batch 2–3 are explicitly the **full re-baseline runs**, this is not latent. It fires on
the next full sweep.

---

## F-BLOCK-1 — the merge helper silently destroys hand-authored material in the committed baselines

**Root cause, one place:** `scripts/lib/merge-findings-baseline.sh:102-104`

```awk
if ($0 ~ /^\| / && $0 !~ /^\|---/ && $0 !~ /gate . policy/) {
  n = split($0, c, "|")
  key = trim(c[2]); v = (n >= 5 ? trim(c[5]) : ""); note5 = (n >= 6 ? trim(c[6]) : "")
```

`split_file` classifies **every** line beginning with `| ` as a five-column verdict row and reads
the note as `c[6]`. Two consequences, and the self-verification is structurally blind to both,
because `scripts/lib/merge-findings-baseline.sh:224` builds the set of prose that must survive as

```sh
grep -vE '^\| ' "$BASELINE" | grep -vE '^[[:space:]]*$' | sort -u > "$T/b_prose"
```

— i.e. **every `| `-leading line is excluded from the material step 5 protects**. The only other
check (`:260-264`) asserts that every *generated* key reaches the output; it never asserts that
baseline-only content survives. So a loss inside a `| ` line, or of a whole `| ` line, cannot be
seen by the verifier. This is the shape LESSONS calls *"a detector that finds nothing must be
proven able to find something"* — the verifier is not blind because it is weak, it is blind
because its input set excludes the region where the loss happens.

### Witness A — hand analysis after an embedded `|` is truncated. **MEASURED.**

Baseline: a byte copy of the committed `docs/reviews/authz-door-audit-findings.md`. Generated: the
same file with the two hand-annotated rows' note column reduced to the generator-produced file
list (the realistic shape of a re-baseline).

| row | baseline bytes | merged bytes | lost |
|---|---|---|---|
| `app.is_signoff_deferral_open(p_response_id uuid)` (`:293`) | 727 | 579 | **148** |
| `app.can_manage_professional(p_org uuid, p_uid uuid)` (`:355`) | 1106 | 570 | **536** |

Bare rc **0**. Reported: `PRESERVED 0 hand-authored prose line(s) and 2 hand suffix(es)`.

The merged `is_signoff_deferral_open` row now ends mid-sentence:

> `… because this arm's domain is a NAME REGEX (\`^(is_\ |`

Everything after the first markdown-escaped `\|` is gone — including the sentence that records
*why* the gate was renamed rather than backlogged. On `can_manage_professional` the loss takes the
entire closing analysis (`⚠ Recorded because it is the one direction the ERROR-class note below
does not predict: that class is escapable, and the escape is scope, not tooling`).

Mechanism: `c[6]` is truncated at the first `|` inside the note, so both the prefix test
(`:133`) and the row rebuild (`:136-141`) operate on a fragment.

**This is not confined to the suffix path.** Re-run with the verdict changed so the row takes the
CARRIED branch (`:145-149`): bare rc **0**, `CARRIED 1 note(s)`, and the same tail is absent from
the output entirely — the carried note is the same truncated fragment.

### Witness B — a hand-authored table is deleted whole, with no carry. **MEASURED.**

`docs/reviews/authz-invoker-audit-findings.md:158-161` holds a hand-written three-column analysis
table inside a hand-written section:

```
| gate | evidence | reading |
| --- | --- | --- |
| `public.close_case(p_case_id uuid)` | 3 keystones failed by name, incl. `11.11 ⭐ WALL (M7): …
| `public.reconcile_item_options(p_item_id uuid, p_options jsonb)` | `Result: FAIL`, a file …
```

Merging that file (baseline) against a generated file that does not produce those four lines:

- baseline 165 lines → merged **161 lines**
- bare rc **0**, `PRESERVED 0 hand-authored prose line(s) and 0 hand suffix(es); CARRIED 0 note(s)`
- **no CARRIED block was emitted at all**
- `| gate | evidence | reading |` — **LOST**
- `WALL (M7): close_case refuses the tenancy admin on AUTHORITY` — **LOST**
- surrounding hand prose (`The classifier cannot tell …`) — PRESENT (control)

The table's header and delimiter rows become "rows" with an empty note (`n < 6` → `note5 = ""`),
and the END block at `:152` carries a baseline-only row **only if `b5[key] != ""`** — so they are
dropped with no carry, no warning, and a clean exit.

### Witness C — a correctly-shaped hand row with an empty note is dropped. **MEASURED.**

Five-column synthetic: a hand row with a note is carried; a hand row **without** one
(`| app.handrow(uuid) | predicate | positive | COVERED |  |`) vanishes — not in the table, not in
CARRIED, rc **0**.

This directly contradicts the property the file states at `:15-16`:

> "HAND-AUTHORED = any line of the committed baseline THIS RUN'S GENERATOR DID NOT PRODUCE."

### Why this blocks

`emit_report` in all four harnesses passes `OUT = $FINDINGS`, which on a full run **is**
`$FINDINGS_COMMITTED` (`supabase/tests/mutation/p0-authz-door-audit.sh:101-109`, `:790-802`;
identical in the other three). The next full sweep of the door or invoker arm writes these losses
over the committed file. The door baseline's `can_manage_professional` note is precisely the kind
of material the repo has decided must not be re-derived from memory.

**What I need to see:** the row path must stop being a naive `split` on `|` (mask escaped/quoted
pipes, or cap the split at the known column count and treat the remainder as the note), the
baseline-only carry must not be gated on a non-empty note, and — most importantly — **step 5 must
protect `| `-leading baseline lines too**, so a future variant of this cannot pass the verifier.

---

## F-MAJOR-1 — the `SCOPE:` line cannot distinguish a catalog-backed derivation from a provisional one

**MEASURED.** Same range, same filter, two runs:

```
catalog reachable   : 18 cases   (tier 1 = 39 doors, tier 2 = 18)
DOOR_SWEEP_DB=<none>: 39 cases   (text heuristics, PROVISIONAL)
```

Both printed the **byte-identical** line:

```
SCOPE: 14 file(s) — 14 committed (731abda0^..HEAD), 0 worktree, 0 untracked | filter: none
```

`scope_line()` (`scripts/door-sweep-cases.sh:332-338`) reports file counts and the filter and
nothing about `CATALOG_OK`. The script instructs the operator at `:1179` to *"Quote it; do not
paraphrase it"* — so a gate record that follows the instruction exactly records an 18-case
property-derived selection and a 39-case text-heuristic selection in the same words. The banner
that *does* say `NO LIVE CATALOG — PROVISIONAL DERIVATION` is fifty lines away in stderr and is
not what the record is told to quote.

The builder flagged this. I agree with the builder and rank it MAJOR rather than minor: making a
provisional derivation indistinguishable from a measured one, **in the one artifact the gate
record carries forward**, is the class of defect this unit was opened to remove. The fix is one
token in `scope_line`.

## F-MAJOR-2 — the `SCOPE:` line is still missing on both exit-1 paths (and every exit-2 path)

**MEASURED.** `scope_line` is called at exactly two sites — `scripts/door-sweep-cases.sh:348`
(exit 3) and `:1183` (exit 0). Neither exit-1 path calls it: `:731` (rewrite targets unreadable)
and `:1163` (all three FINDING sub-cases). No exit-2 path calls it.

Reproduced live: `BASE=9a4bbd22^ TIP=9a4bbd22` → bare rc **1**, full DOORS-IDENTIFIED block
printed, **no `SCOPE:` line anywhere in the output**.

The record itself found and fixed exactly this gap for exit 3 (`docs/progress/door-sweep-deriver.md:447-452`):

> "That run found a gap in the new output and it is fixed in commit 10. The exit-3 path printed
> **no `SCOPE:` line at all**, so the one line the gate record is told to quote verbatim did not
> exist for the outcome a no-migration branch produces."

That sentence is true word-for-word of exit 1, and exit 1 is the outcome where the operator is
*required* to write a claim into the gate record ("state that these migrations contain no RLS
policy and no `prosecdef` gate") — the claim that most needs its scope attached. The fix was
applied at the site that was measured, not to the class. LESSONS: *"a partial fix reads as a
complete one"* / *"a fix correct at MOST sites hides that it is wrong."*

## F-MAJOR-3 — a continuation line bearing a bare schema prefix ends the declaration silently, and the parse error advertised for it is unreachable

**MEASURED**, on a `cmp`-verified copy of the deriver in a throwaway repo:

```sql
-- door-sweep-targets: app.is_admin(),
--                     app.
--                     is_commission_admin_of(uuid),
--                     app.can_sign_section(uuid)
```

Result: bare rc **0**, `CASES` = `is_admin`, tier 1 = **1**, `PARSE ERROR` occurrences = **0**.
`is_commission_admin_of` and `can_sign_section` were dropped with no signal, and the output reads
as a clean, complete derivation.

Two things are wrong at `scripts/door-sweep-cases.sh:558-568`:

1. The `app.` line yields `harvest(rest) == 0`, so it is treated as a token-free `--` line and
   **terminates the declaration** — taking every subsequent, well-formed continuation with it.
2. The `complain(NR, "schema prefix with no function name")` at `:563` sits **inside** the
   `if (harvest(rest) > 0)` branch, so it can only fire on a line that *also* contains a valid
   token. For the purest instance of the error it names — a line whose only content is a bare
   schema prefix — it is dead code.

The closed follow-up `FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` required the deriver to
"either consume continuation lines, **or reject them loudly** — a named parse error, not
silence." The archive discloses one deviation (a token-free bare `--` must stay silent, because
two committed migrations depend on it, `20261003007180:9` and `20261003007190:6`). That
disclosure is fair and I accept it. **This is a second instance the disclosure does not cover**,
and it is not a bare separator — `app.` is unmistakably an attempted target.

**Bounding it honestly:** all 11 marker-bearing migrations in the tree parse correctly today
(record `:396-400`, and I confirmed `20261003007250`'s four targets derive from the declaration
path alone). This is latent under-selection, not an active hole. But under-selection is the side
of the asymmetry the script's own header calls unacceptable (`:89-90`: "under-selection is a gate
nobody looked at").

## F-MAJOR-4 — nothing tests the merge helper, and `MERGE_FAULT` is not gated

**MEASURED.** `scripts/door-sweep-selftest.sh` contains **0** occurrences of `merge`; its 15
scenarios exercise the deriver only. Repo-wide, the only files referencing
`merge-findings-baseline` are the helper itself and the four harnesses that call it. No `npm`
script runs it. So the component that writes the committed baselines — the one F-BLOCK-1 shows to
be broken in three ways — has no committed test at all, and the "proven able to fail" claim rests
on a manual `MERGE_FAULT` invocation that nothing re-runs.

Two further points:

- **`MERGE_FAULT` is not gated to the self-test.** It is read at `:70` as `${MERGE_FAULT:-}` and
  no harness scrubs it before `bash "$MERGE_LIB"`. An operator with the variable exported inherits
  fault injection into a run that writes the committed baseline. *Mitigating (MEASURED by
  reading `:241-283`): the injection happens before the verifier and the verifier is computed from
  the inputs, so the realistic outcome is a loud abort with the baseline untouched — fail-safe.*
  It should still be `[ "${SELFTEST:-0}" = 1 ]`-gated.
- **The knob silently no-ops when there is nothing to inject.** `MERGE_FAULT=drop-hand-block`
  against the real door baseline exited **0** and wrote output (MEASURED), because
  `$T/hand_prose` was empty for that input pair and the guard at `:241` was false. A fault
  injector that reports success having injected nothing is the shape of *"a mutation that did not
  fully apply reports GREEN."* It should abort when asked to inject and unable to.

## F-MAJOR-5 — a merge abort does not reach the harness exit code, and is indistinguishable from "nothing changed"

**MEASURED by reading**, `supabase/tests/mutation/p0-authz-door-audit.sh:790-806` and the
identical blocks in the other three: a non-zero merge sets `MERGE_FAILED=1`, prints a banner, and
**falls through** — no `exit`, no `return`. The graded verdict (`:973-987`) is computed from
BLIND/ERROR counts and never reads `MERGE_FAILED`.

The banner is loud, so this is not silent. But the hazard text the deriver itself prints
(`scripts/door-sweep-cases.sh:1253-1256`) tells the operator to verify the baseline with
`git diff --stat -- <findings>` and reads an **empty diff** as "the baseline was left alone". After
an aborted merge on a full run the diff is *also* empty — and on a full run an empty diff is
otherwise a perfectly normal "no verdicts changed". The documented check cannot separate the two;
only the banner can. Either make the abort non-zero, or change the hazard text to say that an
empty diff on a **full** run must be read together with the merge banner.

*(Pre-existing, out of this unit's scope, noted for the PO: `p0-authz-rowdoor-audit.sh` and
`p0-authz-invoker-audit.sh` have no graded `RESULT:`/exit-code block at all — their exit status is
whatever the last `echo` returned. Not introduced here; not this unit's to fix.)*

## F-MAJOR-6 — ADR 0190:63-64 carries a number that contradicts its own sentence

**MEASURED.** `docs/decisions/0190-…​.md:63-64`:

> "**P3 — the deriver already OVER-selected into UNPROVEN** … On `731abda0^..HEAD`: **42**
> tokens derived, of which **3** resolve to no catalog object at all, **1** is an INVOKER
> (another harness's class) and **21** are `prosecdef` functions outside `PRED_DOMAIN`."

3 + 1 + 21 = 25, and the remaining 17 are unaccounted; the sentence's own total of 42 does not
survive it. The correct figure is **18**, and it is written correctly in the two other places the
same measurement appears:

- `scripts/door-sweep-cases.sh:751` — "…1 is an INVOKER … and **18** are `prosecdef` functions
  outside `PRED_DOMAIN`."
- `docs/progress/door-sweep-deriver.md:85-91` — the F2 class table: 7 + 13 + **18** + 1 + 3 = **42**. ✅

The likely origin is a transposition of the *post-fix* figure (41 tier-1 doors − 20 tier-2 cases
= 21) into the *pre-fix* paragraph — two different measurements of two different things, one
number. This is the register-quality bar Batch 0 set, and an accepted ADR is the document that
outlives the branch: fix the number, or the next reader re-derives P3 from a premise that does
not add up. One-character fix; ranked MAJOR only because it is in the ADR rather than a comment.

---

## Recommendations (non-blocking)

- **F-REC-1 — measurements cited against a moving `HEAD` do not reproduce.**
  `scripts/door-sweep-cases.sh:751-752` and `:599-601`, and record `:130`/`:155`, cite
  `731abda0^..HEAD`: "42 tokens derived, of which 3 resolve to no catalog object at all, 1 is an
  INVOKER and 18 are `prosecdef` functions outside `PRED_DOMAIN`". MEASURED today on the same
  written range: 18 CASES + 21 outside-domain + 1 invoker + **2** unresolved = 42. The total holds;
  the breakdown has moved because `HEAD` moved. Pin the tip commit in the citation.
- **F-REC-2 — off-by-one in a printed count.** `:318` prints `PRED_DOMAIN lifted whole (8 line(s))`
  for the 9-line block at `p0-authz-door-audit.sh:497-505` (`wc -l` on a value with no trailing
  newline). MEASURED. Cosmetic, but it is a number an operator may quote.
- **F-REC-3 — `eval` on the lift-validation loop.** `:184` uses `eval "val=\$$v"`. It is safe
  (assignment RHS is not re-parsed) and it is not the `PRED_DOMAIN` path the header forbids — but
  `val="${!v}"` says the same thing with no `eval` in a file whose thesis is "never `eval` it".
- **F-REC-4 — the self-test is run by nobody.** `door-sweep-selftest.sh:7-9` says it "belongs in
  Phase Gate step 1 beside the four authz arms", and `CLAUDE.md` / `docs/lead-playbook.md` /
  `.claude/rules/**` are untouched by this branch (MEASURED: the three-path `git diff --name-only`
  is empty — correctly, the lead owns those edits at the Record step). Until that edit lands, a
  15-scenario suite exists that no gate invokes. ADR 0079's own lesson applies: a paragraph cannot
  red.
- **F-REC-5 — one all-negative scenario.** Self-test scenario 5 (`alter function OWNER TO ->
  nothing`, `:170-173`) asserts only rc 1, empty stdout, and an absent block. It is discriminated
  by scenario 4 rather than by itself. Adding one positive stderr assertion would make it
  self-standing.
- **F-REC-6 — the same count, written twice, differently.** MEASURED:
  `scripts/lib/merge-findings-baseline.sh:19` says "**37** table rows with hand prose in column
  5"; `docs/progress/door-sweep-deriver.md:117` says "**39** table rows carrying hand prose in
  column 5". Same file described (`docs/reviews/authz-door-audit-findings.md`), same category,
  same date. One is stale. LESSONS: *"the same control described wrong by three writers running."*
- **F-REC-7 — a paraphrase inside a code fence, in the unit that forbids paraphrase.**
  `docs/progress/door-sweep-deriver.md:440-445` presents the commit-10 witness in a fenced block
  implying a terminal capture, but its line order is inverted against the script's actual `say()`
  sequence (`scripts/door-sweep-cases.sh:340-352` prints `=== RESULT: NOT-APPLICABLE (3) ===`
  **first**, then three explanatory lines, then `scope_line()`, then the "0 case(s)" lines), and
  the three explanatory lines are dropped with no ellipsis. MEASURED by reading both. Substance
  unchanged — but this is the witness for the very commit that created the line ADR 0190:197
  tells operators to *"Quote it; do not paraphrase it."* Re-paste the real output.
- **F-REC-8 — no fixture `09`.** `scripts/fixtures/door-sweep/` runs 01–08, 10–13 (12 files,
  all committed — MEASURED via `git ls-files`). The gap is harmless but reads as a deleted fixture.

---

## What I measured, question by question

| # | question | result |
|---|---|---|
| 1 | `PRED_DOMAIN` lift verbatim, 3 vars by substitution, ABORT on residual `$` | **PASS, MEASURED.** `lift_block` (`:163-178`) reads all 9 lines of `p0-authz-door-audit.sh:497-505`. Substitution is `${VAR//…}` parameter expansion (`:213-215`), never `eval`. On a `cmp`-verified copy: a **pure rename** of `PRED_IDENTITY_RE` → rc **2** at the `:181` guard, stdout **0 bytes**; the domain **growing a 4th variable** (all three known ones intact) → rc **2** on the residual-`$` path with the unresolved domain printed, stdout **0 bytes**. |
| 1b | remaining hand-copy of domain logic | **YES, and it is correctly demoted.** `:459-463` still hardcodes `security definer`, `returns boolean`, `^is_valid_`. Under `CATALOG_OK=1` these feed only `cand_fn` (`:769`) — a candidate floor, with `fn_excl` included, so nothing text-excluded is dropped and the catalog decides `CASES`. They are load-bearing **for selection only when the stack is down** (`:884`), which the output declares. Acceptable as built; the residual copy is the reason F-MAJOR-1 matters. |
| 2 | tier 1 / tier 2 re-derived; both load-bearing witnesses | **PASS, MEASURED.** Tier 1 = catalog-resolved policy ∪ `prosecdef=t` function (`:836`); tier 2 = tier 1 ∧ `PRED_DOMAIN` evaluated **in SQL** (`:785`). Tier 1 **cannot** admit `prosecdef=false` — those go to `fn_invoker` (`:817-818`) and are excluded from `tier1`. A **set-returning door CAN reach `CASES`** if `PRED_DOMAIN` admits it (`setof bool`); that is the arm's own domain, so it is consistent, not a deriver defect. Planted `assert_not_case_excluded … returns void … security definer` → derives into `CASES` (self-test scenario 1, fixture `01`, PASS). `BASE=9a4bbd22^ TIP=9a4bbd22` → rc **1**, `DOORS IDENTIFIED: 1`, `current_professional_read_organizations (prosecdef, returns setof uuid — outside PRED_DOMAIN)` — reproduced verbatim. |
| 2b | no-catalog fallback: over-selection into UNPROVEN still possible? | **YES, MEASURED** — 39 provisional tokens vs 18 catalog-resolved on the same range. The output **does** say the tier split did not run (`:1043-1047`) and names it PROVISIONAL. But the `SCOPE:` line does not → **F-MAJOR-1**. |
| 3 | `ALTER FUNCTION` requires `security definer`; 449 must match 0 | **PASS, MEASURED.** `20260620000000_baseline.sql` carries exactly **449** `ALTER FUNCTION … OWNER TO` lines (and 449 `ALTER FUNCTION` lines total); the `:636` regex matches **0** of them. The tree's one real instance (`20261003004300:42`) is identified and excluded with the printed reason `returns trigger — outside PRED_DOMAIN` (self-test scenarios 3/4/5, PASS). |
| 4 | marker read unconditional; two-state grammar; consume-or-stop | **PASS with a gap.** `20261003007250` contains `pg_get_functiondef` **0** times (MEASURED) — the old guard genuinely never ran for it. With all four `create or replace function` lines stripped in a `cmp`-verified fake repo: rc **0**, tier 1 = **4**, all four declared targets derive, `has_permission` → `CASES`. Consume-or-stop discrimination holds (fixture 07: `app.is_active` in prose after a bare `--` is **not** derived). The gap is the bare-schema-prefix case → **F-MAJOR-3**. Marker DELTA: the record's `42 → 20 → 20` is a `HEAD`-relative citation → **F-REC-1**; today's re-measure is 42 tokens → 18 CASES, consistent with the recorded `20 → 18` per-file array-gate drop. |
| 5 | provenance + `SCOPE`/`PATHS`; SCOPE on all exit paths | **PARTIAL.** Provenance block and per-case file attribution work (self-test scenario 10, PASS). `SCOPE:` on exit 0 ✅ and exit 3 ✅; **absent on exit 1 (both) and exit 2** → **F-MAJOR-2**. Does not disclose CATALOG vs PROVISIONAL → **F-MAJOR-1**. |
| 6 | the merge | **FAIL** → **F-BLOCK-1**. (a) partition is `^\| ` vs everything else, and a hand row **is** misclassified — see F-BLOCK-1 B/C. (b) all four row cases traced in code (`:128`/`:129`/`:133`/`:145`/`:152`); the fourth is where B and C fail. (c) the builder's diagnosis is **correct**: the verifier is keyed on the two **inputs** (`:224-234`), so deleting a hand block from the input removes it from the expectation set and cannot fire — and, contrary to the concern, the knob is a **fair** proxy for a real step-3 loss, since it mutates the output at exactly the boundary a real loss would. Real-loss scenarios that *do* fire without a knob exist (the record's own 5-row duplicate-key collision, caught by `:260-264`). The knob is nonetheless insufficient — it proves the *prose* path only, and the prose path is not where this unit's losses are. (d) idempotence: `merge(b,b) == b` byte-identical, twice, MEASURED. (e) full-run-only wiring confirmed at all four call sites (`SUBSET_RUN` guard, `:101-109` + `:790-802`); subset runs write to `$WORK/*.SUBSET.md` and never open the committed file for write. (f) `git diff --stat main...de955981 -- docs/reviews/` is **empty** — the committed baselines are untouched by this branch. MEASURED. All merge runs in this review were on copies under the scratch dir. |
| 7 | self-test | **PASS.** `SELFTEST=1` → `PASS 15 · FAIL 0 · SKIPPED 0`, bare rc **0**, catalog REACHABLE. All 12 fixtures are **committed** files (`git ls-files`), plus a README; the drift fixture is generated from the real audit script at run time with a `cmp` guard that **fails loudly** if the `sed` changed nothing (`:229-232`) — good design. Four scenarios pin pre-fix behaviour as ABSENT (2, 5, 7, 9), so a revert flips them without touching an assertion. The SKIPPED count is printed and made loud at `:261-266`. No scenario is vacuous: every empty-stdout assertion is paired with an exact bare rc and, except scenario 5, a positive stderr assertion (→ F-REC-5). **Nothing exercises the merge helper** (→ F-MAJOR-4). |
| 8 | exit-code contract | **PASS, MEASURED.** 0/1/3 unchanged; 2 gains only the lift-drift trigger. The three exit-1 sub-cases are named at `:1122`/`:1136`/`:1148`. The only executable caller in the repo is `door-sweep-selftest.sh:112-114`, which compares the bare rc numerically against a per-scenario expectation and exercises all four of 0/1/2/3. No caller treats it as boolean; no `case` is stale. |
| 9 | registers & ADR | **PASS on hygiene; one false sentence in the ADR (F-MAJOR-6) and two fidelity slips (F-REC-6/7).** ADR 0190's header carries `**Status:** accepted`, `**Area:**`, and `**Amends:** ADR 0173 · ADR 0079` with both numbers and links; `docs/decisions/INDEX.md` back-pointers were regenerated (0079's amended-by list gained 0190; 0173 gained its first back-pointer block, +10 lines — it had never been amended before), and the count line moved `187 ADRs · next free 0190` → `188 · next free 0191`. MEASURED. Otherwise: Five follow-ups rotated from committed files: bodies and register blocks byte-identical to `main` except the single pointer-line rewording the archive banner discloses. The NAME-FILTER amendment keeps the original condition **struck through and visible** with a dated paragraph and an explicit Batch-2 hand-off — in both the register block and the body. The three `PO to rule` disclosures are present and each checks out against `main`'s register. Both new entries have bodies, measurable close conditions and conventional codes. `npm run lint:registers` → bare rc **0**; ratchets **lowered, never raised** (`closesWhenPoToRule=137/147`, `severityPerEmoji=128/135`, `longHeadings=91/97`), and `scripts/check-docs-registers.mjs` is unmodified by this branch. *Note 1:* the sixth closure (`FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN`) was **filed and closed in the same commit** and never existed in the open register, so 2 of the claimed 12 `cmp` comparisons have no prior committed state to compare against — the archive banner's "everything else is byte-identical, `cmp`-checked" reads as uniform across all six and is verifiable for five. Self-disclosed in the entry itself; worth a PO eye, not a blocker. *Note 2:* the `MARKER-BLIND-TO-CONTINUATION-LINES` closure narrows its own filed condition, disclosed — and F-MAJOR-3 is a second instance the disclosure does not cover. |
| 10 | scope | **PASS, MEASURED.** `git diff --name-only main...de955981 -- supabase/migrations supabase/seed.sql src` → **empty**. `.claude/rules/**`, `docs/lead-playbook.md`, `CLAUDE.md` → **empty**. |
| 11 | gate evidence quality | **PASS with a bounded gap.** The record states the green run was on a **fresh `supabase db reset --local` (rc 0)** with `git status --short` empty (`:404-405`), and discloses both REDs with their causes: the parked `FUP-PGTAP-WORKER-DEADLOCK` (`Tests=8761`, 115 assertions lost while `Files=262` held — a shape comparison the record explains was necessary because the summary line alone would not have shown it), and the builder's own run against a DB the aborted run left truncated. Provenance is clean and the disclosure is exemplary. Four arms all `INVARIANT HOLDS` with quoted lines (`:412-415`). **The gap:** the gate table is dated at `62829c79`; commit 10 (`de955981`) changed `door-sweep-cases.sh` afterwards. The record re-ran the self-test (PASS 15/0/0) but not lint/typecheck/`test:db`/the arms. I re-ran `npm run lint` at `de955981` myself: bare rc **0**, eslint 0/0, all 13 gates. Commit 10 touches one shell script — no `.sql`, no `src/` — so the delta argument is sound, but it is an argument, not a run. |
| 12 | did any proof rest on a run that did not execute? | **No zero-byte proof found.** Partition of the record's witnesses: **(a) output quoted** — the majority, and I independently reproduced three of the load-bearing ones *exactly*: the rc-2 lift ABORT with 0-byte stdout (`:132`), the rc-1 `9a4bbd22` DOORS block with 0-byte stdout (`:146`), and the declaration-path-alone run with tier 1 = 4 (`:186`). Note these three are 0-byte **stdout by design** (stdout is the case list; a non-zero exit correctly emits none) and each is paired with a quoted stderr banner — a 0-byte stdout here is the assertion, not an absent run. **(b) number without quoted output** — the token-census figures at `:88-89` and `:155`, which no longer reproduce because the cited range ends at a moving `HEAD` (→ F-REC-1); the totals still sum to 42. **(c) a run that did not execute** — one, and the record names it itself (`:396-400`): a whole-history derivation was killed at ~50 minutes and **was not used as evidence**; the parse-safety question was answered instead by deriving over all 11 marker-bearing migrations, which is complete for that question. That is the correct handling. **Two further self-catches, in the record's favour:** it discloses that the self-test "failed twice for real while being written" including an `rc 127` self-dispatch bug (`:319-325`), and it names its own first ADR-0173 pin as **vacuous** — *"Its fixture wrote the literal as `'and app.is_active(p_uid)'`, where the quote does not immediately precede `app.`, so the array fallback's regex never matched it and the pin passed on the OLD deriver too"* (`:327-331`). A suite that catches its own vacuity and writes it down is the standard, not the exception. |

---

## Could not verify — each is a work item, not a pass

1. **`npm run test:db` and the four authz arms at `de955981`.** I am not permitted to run them and did not. The record's green run is at `62829c79`; the delta is one shell script. **Someone must re-read the four arms at the tip before the Record step**, or the lead must accept the delta argument in writing.
2. **The merge helper against a real generator's output.** Every merge I ran used a *simulated* generated file derived from the committed baseline. F-BLOCK-1 Witness B does not depend on that (those keys are simply not generated at all, in any run); Witness A assumes the generator emits the file list as a prefix of the baseline note, which is the documented shape but which I could not confirm by running a harness. **A single full door-arm run against a copied baseline would settle it** — and should be done as part of the fix, not after it.
3. **Rotation fidelity for the sixth closure.** No prior committed state exists to `cmp` against; 10 of the claimed 12 comparisons reproduce, 2 cannot.
4. **`MERGE_FAULT`'s abort proof on realistic inputs.** It did not fire on the real door baseline in my run (empty `hand_prose` for that input pair). I could not construct a run in which it demonstrably aborted on committed data.
5. **Whether `20261003004300`'s `alter function` derivation is exercised end-to-end on the real migration.** I confirmed the regex, the 449→0 negative control, and the fixture scenarios; I did not run the deriver over that migration's own commit range.

---

## Disposition for the PO

**Not ready for approval or the Record step.** One blocking finding.

- **What must change before re-review:** F-BLOCK-1 only. F-MAJOR-1, F-MAJOR-2 and F-MAJOR-6 are
  two-line, one-line and one-character changes respectively and I would expect them in the same
  pass; F-MAJOR-3/5 can be ruled on separately, but F-MAJOR-4 (a test for the merge helper) is
  what stops F-BLOCK-1 from recurring and I would not accept the fix without it.
- **⛔ Batch 2–3's full re-baseline runs are NOT safe for the committed baselines' hand-authored
  material.** This is the sharpest practical consequence. Until F-BLOCK-1 is fixed, any full run
  of the door or invoker arm will quietly truncate or delete hand-authored content and report
  success. If a full run must happen first, commit the baseline, run, and `git diff` the findings
  file **by hand** — the merge's own report line cannot be trusted for this.
- **What the unit explicitly does not prove.** No full sweep was run in this review or, on the
  evidence, in the unit. `PRED_DOMAIN` was **not** widened — that is Batch 2, correctly out of
  scope — so the door `9a4bbd22` added (`app.current_professional_read_organizations`,
  `prosecdef=t`, `setof uuid`) still owes a **targeted mutation case**, and 21 further
  outside-domain doors are printed as owing one on the current range. The 25 historical
  catalog-query rewrite migrations remain structurally unreachable by any text deriver (the
  script's own ceiling at `:486-492`, honestly stated). And the self-test is not yet wired into
  Phase Gate step 1 — the lead's edit at the Record step, but until it lands the suite runs only
  when someone remembers.
- **Credit where it is due.** The deriver half of this unit is the best-instrumented script in
  the tree: the lift ABORTs rather than guessing, the tier split refuses to put an unsweepable
  token in `CASES`, the vacuity pins flip on a revert without touching an assertion, and the
  record discloses its own two RED runs, its own killed run, and its own bug found in commit 10.
  The blocking finding is in the other half, and it is a genuine one — but it sits beside work
  that made it findable.

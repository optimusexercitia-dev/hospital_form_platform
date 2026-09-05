# ✅ VERDICT: APPROVED

**Unit:** DOOR-SWEEP-DERIVER (pre-AE5 remediation, Batch 1) — **re-review, iteration 1**
**Reviewed tree:** `authz-door-sweep-deriver` @ `7e1f0d62` (clean; `7df0bd9b..7e1f0d62` = my first
review + four fix-loop commits)
⚠ **This file carries TWO later sections, and the LAST one holds the verdict above:**
[§ Delta check at `ee037fa3`](#delta-check-at-ee037fa3--2026-09-05) (iterations 2–3, CHANGES
REQUESTED on **F3-BLOCK-1**) → [§ Sign-off at `8a6fe699`](#sign-off-at-8a6fe699--2026-09-05)
(iteration 4, **APPROVED**). Every verdict line inside those sections is pinned to its own commit
and none of them is the current one except the last.
**First review:** [`door-sweep-deriver-review.md`](./door-sweep-deriver-review.md) @ `de955981`
— CHANGES REQUESTED, 1 BLOCK / 6 MAJOR / 8 REC / 5 could-not-verify. That file keeps its header
as history; this one supersedes its verdict.
**Reviewer:** `qa` · 2026-09-05 · read-only on all code; this file is the only artifact written.
Every merge run was on **copies under the scratch dir**; every exit code below was read **bare**.

Claims are labelled **MEASURED** (I ran it in this review) or **INFERRED** (read, not executed).

---

## Summary

**F-BLOCK-1 is genuinely fixed, and the fix is proven able to fail by something better than a
knob.** I reproduced all three of my own witnesses against the new helper: 0 bytes of
hand-authored prose lost, 0 lines lost, and the material that used to vanish now either survives
in place or is carried verbatim. More importantly, the three outputs the **pre-fix helper
actually wrote** are committed as fixtures, and I confirmed by `cmp` against
`git show de955981:scripts/lib/merge-findings-baseline.sh` that they are genuine historical
artefacts — then watched the current verifier reject all three at **rc 2** while accepting its
own output at **rc 0**. That is a real discrimination control on real losses, not a simulation.

All six MAJORs and all eight RECs are fixed, and I re-measured each one rather than reading the
record. The four could-not-verify items that were answerable were answered **by measurement**,
and one of them (#2) **refuted the assumption the splice rule rested on** — the builder found
this and changed the rule rather than defending it.

**What blocks is what the fix loop did not re-read.** Commits `6474a625` and `4d5c6bd9` rewrote
the merge helper from scratch and changed the marker parser's discriminator. Commit `3139b49a`
then edited ADR 0190 in **six hunks** — and **D8 and D9, the two sections that describe the
component that was rewritten, are not among them** (MEASURED: `git diff de955981..7e1f0d62 --`
on the ADR touches `@@ -59`, `-114`, `-168`, `-188`, `-197`, `-333`). ADR 0190 as committed
therefore describes a merge helper that no longer exists — including, verbatim, the clause whose
implementation *was* the blocking defect — and D5's body plus the archived closure still state
the superseded parser rule. This is the unit's own thesis failing inside the unit: *"text is not
truth"*, *"a paraphrase can invert the sentence it summarizes"*, *"only the amending document
knows about the amendment"*.

It is **documentation-only**: no code change, no gate re-run, no new measurement — every fact
needed is already in the record. I am keeping it in the review loop rather than handing it to the
Record step because this loop has already produced one unreviewed doc edit that went the wrong
way (the record's own disclosure: the first pass of F-REC-6 "reconciled" 37 vs 39 by taking 39
**without measuring**).

---

## Disposition — every first-review finding

| # | finding | disposition | the measurement |
|---|---|---|---|
| **F-BLOCK-1** | merge helper silently destroys hand-authored material | ✅ **FIXED** | **MEASURED, all three witnesses rebuilt from the committed baselines, not from fixtures.** **A** (door baseline vs. a generated file with the two hand rows' notes reduced): bare rc **0**, `can_manage_professional` **1106 → 1106 B, byte-identical**; `is_signoff_deferral_open` 727 → **726 B**, the 1 byte being a hand-added space *inside the generator's own file list*, with the 580-byte hand suffix byte-exact (see F2-REC-1). 924 → **924** lines. **A′** (verdict flipped so the row takes CARRY): rc 0, the whole 1105-byte baseline row present verbatim in the CARRIED block, closing sentence intact. **B** (invoker baseline, generated file with `:158-161` removed): rc 0, 165 → **165** lines, output `cmp`-**identical to the baseline**, all four hand-table lines present, reported as `PRESERVED 4 hand-authored prose line(s)`. **C** (empty-note hand row): rc 0, carried verbatim, and so is its sibling. Classification re-derived from code: `grammar_from_generated` (`:220-233`) emits H/V/K **from `$GENERATED`**; `grep -nE 'COVERED\|BLIND\|ERROR\|app\.'` over the helper's non-comment lines returns **0** — nothing hand-listed. Step 5's protected set is `grep -v "^\001ROW\001" "$T/b_norm"` (`:414`), i.e. the complement over the **whole** baseline — proven by witness B, whose lost items print as `PROSE: \| gate \| evidence \| reading \|`. |
| | *— can a hand row mimicking the generator's shape be misclassified?* | ⚠ **YES, and it costs placement, never bytes** | **MEASURED.** I appended to the `D-real-generator` baseline a hand section holding two rows in the generator's exact 5-column shape, using a real key (`app.is_signoff_deferral_open`) and a real verdict token. Both were classified as rows and **relocated into the CARRIED block** — present verbatim, rc 0, nothing lost. The ordinal keying is what saves it: a third occurrence of a key cannot collide with the generator's first two. Acceptable; noted as F2-REC-2. |
| | *— discrimination* | ✅ **PROVEN, on real historical losses** | **MEASURED.** `git show de955981:…merge-findings-baseline.sh` run over the three committed pairs produces output **`cmp`-byte-identical** to the committed `*.prefix-output.md` fixtures — they are genuine artefacts, not hand-written. Fed to the current verifier via `MERGE_VERIFY`: **rc 2 ×3**, naming `SUFFIX: ⭐ **THIS ROW WAS \`ERROR \| run-shape!=baseline\`…`, `PROSE: \| gate \| evidence \| reading \|`, `CARRIED ROW: \| app.handrow_empty_note…`. Positive control — the new helper's own output on all **five** pairs → **rc 0**. |
| | *— is `MERGE_VERIFY` the same verifier path?* | ✅ **THE SAME, not a parallel one** | **MEASURED by reading.** `VERIFY_ONLY` copies the candidate over `$T/merged` at `:465`, **after** the expectation sets (`hand_prose`, `suffixes`, `carried_rows`) are computed from the two inputs at `:414-428` and **before** the single `: > "$T/lost"` block at `:469-507`. There is exactly one verification block in the file; steps 1–4 still run and are discarded. The row-key check (`:476-479`) runs on the candidate too. |
| **F-MAJOR-1** | `SCOPE:` cannot distinguish catalog from provisional | ✅ **FIXED, and better than asked** | **MEASURED**, same range `731abda0^..4d5c6bd9`, same filter, both bare rc 0: catalog → **18** cases, `… \| derivation: catalog`; `DOOR_SWEEP_DB=nonexistent…` → **39** cases, `… \| derivation: PROVISIONAL (no catalog — text heuristics; the tier split did NOT run)`. **Three** states, not two — the builder found on his own that a two-state version put a PROVISIONAL badge on a run that never probed; the NOT-APPLICABLE path prints `derivation: NOT REACHED (this run ended before the catalog was probed)`, which I reproduced. |
| **F-MAJOR-2** | `SCOPE:` missing on exit 1 and exit 2 | ✅ **FIXED STRUCTURALLY** | **MEASURED.** `finish <rc>` is the only way out (`:150-153`), **18** call sites. Reproduced, one `SCOPE:` line each: `BASE=9a4bbd22^ TIP=9a4bbd22` → rc **1**, `SCOPE: 1 file(s) — 1 committed (9a4bbd22^..9a4bbd22) … derivation: catalog`; `ARM=bogus` → rc **2**, `SCOPE: (none — this run ABORTED before the file set was built) \| filter: n/a \| derivation: NONE`; `BASE=7df0bd9b^ TIP=7df0bd9b` → rc **3**, `0 file(s) … derivation: NOT REACHED`. `grep -n 'exit [0-9]'` → **9** hits: 8 prose + the awk `END { if (!found) exit 9 }` at `:231`. Property holds; the record's count is off by one (F2-REC-3). |
| **F-MAJOR-3** | bare schema prefix ends the declaration silently; the parse error is dead code | ✅ **FIXED** | **MEASURED on my own four-line example**, in a throwaway `git init` repo with a `cmp`-verified deriver copy: bare rc **0**, `CASES = can_sign_section is_admin`, stderr carries `… PARSE ERROR(S) — named, and the run continues:` / `…f09.sql:2: schema prefix with no function name` and `UNRESOLVED … - is_commission_admin_of (no pg_proc row in app/public/authz)`. **The UNRESOLVED landing is the RIGHT outcome and I verified the premise rather than accepting it:** `select … from pg_proc where proname ~ 'commission_admin'` on `supabase_db_azkbbhskturikxpgmafq` returns **0 rows**, so that token cannot reach `CASES` by any correct path — UNRESOLVED is the only branch that can witness the parser read past the break. **LOUD:** file:line, a named reason, and the token itself, in two separate stderr blocks. ⚠ The exit code is unchanged at 0 (F2-REC-4). |
| | *— regression on the committed tree* | ✅ **NONE** | **MEASURED.** All 11 marker-bearing migrations in one commit of a throwaway repo, run by the tip deriver and by `de955981`'s (both `cmp`-verified copies): both bare rc **0**, both **17** cases, case lists **byte-identical** by `diff`, **0** parse errors on both. The two bare-`--` migrations (`…007180`, `…007190`) still parse. |
| **F-MAJOR-4** | nothing tests the merge helper; `MERGE_FAULT` ungated | ✅ **FIXED, and the negative control is the strongest thing in the unit** | **MEASURED.** `SELFTEST=1 bash scripts/door-sweep-cases.sh` → bare rc **0**, `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`, catalog **REACHABLE** (`supabase_db_azkbbhskturikxpgmafq`) — 16 deriver + 18 merge scenarios, all fixtures committed (`git ls-files` shows 13 `.sql` + README + 13 `merge/*.md`). **Negative control reproduced independently:** a mirror ROOT under the scratch dir holding `cmp`-verified copies of the tip deriver, the tip selftest and the tip fixtures, with **only** the helper replaced by a `cmp`-verified `git show de955981:` copy → bare rc **1**, **PASS 21 · FAIL 13**, exactly the record's claim. The 5 idempotence scenarios pass on both, which is correct: the pre-fix helper was idempotent, just lossy. **Gating:** `MERGE_VERIFY` and `MERGE_FAULT` without `SELFTEST=1` → bare rc **2**, `MERGE_FAULT/MERGE_VERIFY are SELF-TEST knobs and SELFTEST is not 1. Refusing to run…`. **Nothing-to-inject:** aborts (`inject_fail`, `:435`/`:448`). **Injection proven landed:** `cmp -s "$T/merged.pre" "$T/merged" && inject_fail "…the victim was never found in it"` (`:457`), and the victim now travels through `ENVIRON` — the record discloses that the first attempt used `awk -v`, which decodes `\|`, matched nothing, and printed `FAULT INJECTED` anyway. The suite caught it; the pre-fix run of that scenario reproduces the catch for me (`FAIL … the injection must be cmp-verified as landed`). |
| **F-MAJOR-5** | a merge abort does not reach the exit code | ✅ **FIXED** | **MEASURED by tracing every exit.** `door` and `writepath`: `MERGE_FAILED` is the **first** branch of the graded block (`door:977-982`, `writepath:1411-1416`) → `=== RESULT: ERROR — the findings MERGE ABORTED…`, **exit 2**, ahead of the verdict counts, which still print. `rowdoor:468-475` and `invoker:600-607` get minimal propagation → exit 2, else exit 0. **No path where an aborted merge ends 0:** every `exit` between the merge call and the graded block is an `exit 2` contamination abort (`door:865/877/917/928`, `writepath:1228/1240/1333/1345/1351`, `rowdoor:428`, `invoker:560`); `invoker:489`'s `exit 0` is the **DRY RUN**, which never reaches `emit_report` (`record()` guards it with `[ "$DRYRUN" = "1" ] \|\| emit_report`); every `exit 3`/`exit 1` sits **before** the merge call. The EXIT traps end on `verify_baseline_untouched \|\| exit 2`, which preserves the status when it returns 0. Hazard text updated (`door-sweep-cases.sh:1253-1256` region). |
| **F-MAJOR-6** | ADR 0190 `:63-64` — 3+1+21 ≠ 42 | ✅ **FIXED, re-measured not patched** | **MEASURED independently.** The ADR now reads 18 + 21 + 1 + 2 = **42**, with a visible dated correction block naming the transposition. My own run on `731abda0^..4d5c6bd9`: **18** CASES on stdout, `grep -c 'outside PRED_DOMAIN'` = **21**, INVOKER = **1** (`save_section_answers`), UNRESOLVED = **2** (`form_item_options`, `form_item_validations`). Sum **42**. |
| **F-REC-1** | citations against a moving `HEAD` | ✅ **FIXED where scoped** | **MEASURED.** ADR 0190 and `door-sweep-cases.sh` (`:691`, `:842`) now pin `731abda0^..4d5c6bd9`; the ADR line 227 quotes the SCOPE line **byte-identical** to my own run. The record's earlier dated session-log entries keep `..HEAD` — correct (append-only history) and disclosed at `:669`, which also flags five more in the archive as out of scope. |
| **F-REC-2** | `8 line(s)` for a 9-line block | ✅ **FIXED** | **MEASURED:** my rc-3 run prints `PRED_DOMAIN lifted whole (9 line(s)), 3 sub-vars expanded, no residual $`. |
| **F-REC-3** | `eval` on the lift-validation loop | ✅ **FIXED** | `:244` is `val="${!v}"`; the only remaining `eval` tokens are a comment and a warning string. |
| **F-REC-4** | the self-test is run by nobody | ⏳ **CORRECTLY DEFERRED** | `git diff --name-only main...7e1f0d62 -- .claude/rules docs/lead-playbook.md CLAUDE.md` → **empty** (MEASURED). This is the lead's edit at the Record step. Until it lands, 34 scenarios exist that no gate invokes. |
| **F-REC-5** | one all-negative scenario | ✅ **FIXED** | Scenario 5 now also asserts the fixture was SCANNED (`05_alter_function_owner_to` in stderr) and that the run reached `NO DOORS AT ALL`. |
| **F-REC-6** | 37 vs 39, same file same day | ✅ **FIXED BY MEASUREMENT** | **I re-measured the file myself, three ways.** Counting column 5 of the committed door baseline for any of `⭐ ⚠ ⛔ ** [merged`: **37** under a capped escape-aware split, **37** naive, **37** symbols-only. The helper's 37 was right; the record's 39 was stale — and the record discloses that the first pass of this fix took 39 *without measuring*. ⚠ The accompanying "399 verdict rows" does not reproduce (F2-REC-5). |
| **F-REC-7** | a paraphrase inside a code fence | ✅ **FIXED** | **MEASURED:** the record's replacement block (`:447-460`) is structurally byte-identical to my own rc-3 run's stderr tail — `migrations : 0 file(s) touched` → rule → `=== RESULT: NOT-APPLICABLE (3) …` → the four explanatory lines → blank → `SCOPE:` → the two `0 case(s)` lines → rule. Same order as `say()`. |
| **F-REC-8** | no fixture `09` | ✅ **FIXED** | `09-marker-dangling-prefix.sql` is committed and holds my own four-line example verbatim; numbering is contiguous `01`–`13`; the README explains the slot was closed rather than left to read as a deletion. |

---

## My five could-not-verify items — answered

1. **`test:db` and the four arms at the tip.** ✅ **SETTLED by the builder, and it is the right
   kind of settling — re-run, not argued.** The iteration-1 gate table (record `:677-687`) is on a
   fresh `supabase db reset --local` (bare rc 0) with `git status --short` empty, every code bare:
   lint **0**, typecheck **0**, `test:db` **0** with `Files=262, Tests=8876, PASS` (byte-for-byte
   the `62829c79` shape, compared as a **shape** because the parked `FUP-PGTAP-WORKER-DEADLOCK`
   keeps `Files` while losing assertions), census **0** with the domain enumerated
   (`live authz gates (catalog): 581`, `gates carrying a verdict: 625`), hat **0** (`7/7 OK`),
   floor **0** (`63` never-called doors, all allowlisted), wrapper **0** (`BLIND set size: 41`).
   **Evidence quality: good and improved** — the earlier table gave verdict strings only; this one
   gives the enumerated domain beside each verdict, which is §7.17's own rule. **INFERRED** (I am
   not permitted to run them). ⚠ One asymmetry: the hat row quotes `self-test: 7/7 OK`, which is
   the arm's *instrument control*, not what it enumerated — the earlier table's
   `4 finding(s), all reasoned-allowlisted` was the domain half and was dropped (F2-REC-6).
   **The wrong-stack disclosure:** the record admits a post-run catalog check first hit
   `supabase_db_escalume` because `docker ps | grep supabase_db | head -1` chose it, and states the
   re-run against `supabase_db_azkbbhskturikxpgmafq`. **I re-ran it myself, MEASURED:** degenerate
   non-SELECT policies (`qual='true' or with_check='true'`) → **0 rows, enumerated not counted**;
   `%INFLIGHT%` functions → **0**. And the disclosure checks out: both stacks are running, and
   `supabase_db_escalume` has **1** of `{app, authz}` where this project has **2** — its "0" was
   indeed a claim about another database.
2. **The merge against a REAL generator's output.** ✅ **SETTLED, and it REFUTED my premise.** My
   witness A assumed the generator emits the file list as a byte prefix of the committed note. It
   does not: **0 of 2**. I verified the committed `D-real-generator` fixture against the committed
   baseline myself — `cmp` puts the first divergence at **char 21** for
   `is_signoff_deferral_open` (the record's 0-based "byte 20": a hand-added space after a comma)
   and **char 423** for `can_manage_professional` (real content spliced into the list). **The
   fixture is evidence of a real run, not a construction:** its generated row names
   `413_ae4_authorized_scope_ids.sql`, which appears **0** times in the committed baseline and
   **does** exist in `supabase/tests/` — it could not have been derived from the baseline. The
   splice is now whitespace-tolerant (`wsprefix`, `:190-204`), which recovers the first row's
   580-byte note; the second correctly carries whole. **Consequence — I measured the bound rather
   than accepting "most":** of the **37** hand-annotated column-5 rows in the door baseline,
   **2** carry unconditionally (a `.sql` token sits inside/after the annotation, so the list is
   interrupted), **24** splice **iff** the generator's list for that gate is still a
   whitespace-prefix — any file the suite has added since forces a carry — and **11** have no file
   list at all, so the generated note is empty, the whole note becomes the suffix and it splices.
   So the door baseline's realistic CARRIED block is bounded by **2 ≤ n ≤ 26** hand-annotated
   rows, plus every gate absent from the run's domain. The builder's "most will be CARRIED" is
   **INFERRED** but the mechanism is named and sound (the suite grew from `Files=156`/`218` in
   those notes to `262`). **Yes, the PO should be told before Batches 2–3** — see the disposition.
3. **Rotation fidelity for the sixth closure.** ⏳ **UNCHANGED, and correctly left as a PO eye.**
   The sixth follow-up was filed and closed in the same commit, so 2 of the 12 claimed `cmp`
   comparisons still have no prior committed state. Self-disclosed in the entry. Not a blocker.
4. **`MERGE_FAULT`'s abort proof on realistic inputs.** ✅ **SETTLED, and superseded by something
   stronger.** All three knobs are now self-test scenarios over committed inputs — including
   `drop-suffix` against the **real door rows** — and each aborts at bare rc **2**. The knob is no
   longer the proof: the three committed pre-fix outputs are, and they are historical losses.
5. **`20261003004300`'s `alter function` derivation, end to end.** ✅ **SETTLED — I ran it.**
   `BASE=89793d43^ TIP=89793d43` → bare rc **1**, stdout **0 bytes**,
   `⚠ ALTERED BY 'alter function … security definer' — ruling 3's logic, one branch over:` with
   `assert_hospital_affiliation_has_org`, `tier 1 DOORS IDENTIFIED : 1`, and the exclusion printed
   as `assert_hospital_affiliation_has_org (prosecdef, returns trigger — outside PRED_DOMAIN)`.

---

## F2-BLOCK-1 — ADR 0190 D8/D9 (and D5's body, option E, and the archived closure) describe mechanisms this fix loop replaced

**This is the only blocking item, it is documentation-only, and it needs no re-measurement.**

The fix loop rewrote `scripts/lib/merge-findings-baseline.sh` and changed the marker parser's
discriminator, then edited ADR 0190 in six hunks — **none of them D8 or D9**. MEASURED:
`git diff de955981..7e1f0d62 -- docs/decisions/0190-*.md` touches `@@ -59`, `-114`, `-168`,
`-188`, `-197`, `-333` only.

### (a) D8's decision table describes the pre-fix helper — including the defect

`docs/decisions/0190-…-a-full-run-merges.md:272-278`, checked clause by clause against
`scripts/lib/merge-findings-baseline.sh`:

- *"column 5 identical | nothing hand-authored — emitted"* — the code tests the **whole row**
  (`if (brow[key] == grow)`, `:301`). With column 5 identical but a hand edit in columns 1–4 it
  does **not** emit; it carries.
- *"verdict UNCHANGED and the baseline note **starts with** the generated note → spliced back
  byte-for-byte"* — the code additionally requires **columns 1–4 identical** (`same14`, `:309-311`)
  and "starts with" is now **up to whitespace** (`wsprefix`). That is not a detail: my
  could-not-verify #2 measured **0 of 2** rows as byte-exact prefixes, so the ADR's predicate,
  read literally, would evict a 580-byte hand note from the table over one space.
- *"verdict CHANGED … the note is **CARRIED** with `old -> new`"* — the code carries the
  **whole baseline row** verbatim (`carry_row(…, brow[key])`), and this branch also fires for a
  hand-edited column 1–4, which the ADR does not mention.
- ⛔ *"key only in the baseline | the row is removed and **the note carried**"* — **this is the
  defect.** Gating the carry on the note is exactly what made witness C vanish. The code now
  carries the whole row and says so in a `⛔ NOT gated on a non-empty note` comment (`:326-328`).
  A closure (`FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS`) that points at D8 as its
  design is pointing at the bug.
- D8 records **none** of the three rules the fix turns on: unescaped-and-capped column splitting;
  the grammar **derived from the generated file**; and the protected set as the complement over
  the **whole** baseline. The section is titled *"The property is the COMPLEMENT, not a pattern
  list"* — and at the time it was written the complement was **not** computed over `| `-leading
  lines. That is now true, and unrecorded.

### (b) D9's "proven able to fail" omits what actually proves it

`:287-298` lists `MERGE_FAULT=drop-hand-block / drop-suffix (self-test only)` — there are now
**three** knobs (`drop-carried-row`), "self-test only" is now **enforced** rather than
aspirational (that was F-MAJOR-4), and `MERGE_VERIFY` plus the three committed pre-fix outputs —
the primary discrimination control, and the best thing in this iteration — appear **nowhere** in
the ADR. D9 also omits carried rows from the survival set it enumerates.

### (c) D5's body still states the superseded parser rule, and option E states a false one

`:182-186`: *"A `--` line carrying ≥1 `(app|public|authz).name` token is a continuation … a `--`
line with **no** such token ends the declaration silently."* The amendment appended immediately
below (`:193+`) says the opposite and is correct — *"a continuation if it carries a SCHEMA
PREFIX, not if its tokens parse"* — but the body sentence it contradicts was left standing rather
than re-measured the way P3 was, so D5 states both rules. And `:367-368`, in Considered options
E: *"the loud case is narrowed to a token that fails to parse"* — **false**: the loud case now
includes a bare schema prefix, which is not a token at all. `scripts/door-sweep-cases.sh:581`
gets it right (`CONSUME-OR-STOP, PREFIX-BEARING`); the ADR has one of each.

### (d) The archived closure describes the superseded rule as the adopted one

`docs/followups/follow-ups-archive.md:9128-9130` and `:9137` — *"a `--` line carrying at least one
`(app|public|authz).name` token is a continuation … a `--` line with none ends the declaration"*
and *"the rule adopted is **consume-or-stop, token-bearing**"*. Both are now wrong; the
discriminator is the prefix. This closure is dated **today**, on an unmerged branch — it is not
yet history, and correcting it now is cheap.

**Why this blocks rather than waits for the Record step.** The mitigations are real — fixture 09
and self-test scenarios C and D would red on anyone who re-implemented from the stale text — and
I weighed them. What tips it is that the fix loop was *specifically re-reading this document*
when it missed the two sections describing the thing it had just rewritten; that the missed
clause is the one whose implementation was the blocking bug; and that this loop has already
produced one unreviewed documentation edit that went backwards. **Required:** correct D8's table
and add the three rules, correct D9's knob list and name `MERGE_VERIFY` + the committed pre-fix
outputs, re-measure D5's body sentence and option E, and amend the archive clause with a dated
line (do not rewrite it silently). No code, no gate.

---

## New recommendations (non-blocking)

- **F2-REC-1 — the splice normalises hand whitespace inside the generator's own region.**
  MEASURED: witness A's `is_signoff_deferral_open` row comes back **726 B** against 727 — the lost
  byte is a hand-added space in `10_immutability.sql, 367_…` that the generator writes without
  one. The 580-byte hand suffix is byte-exact. This is the deliberate, measured trade-off
  documented at `:180-189`, and it is the right one; it is also the one thing in the unit that is
  *not* byte-for-byte preservation, and the header's own headline property
  (`HAND-AUTHORED = any line … the generator did not produce`) does not admit it. One sentence in
  the header would close the gap between the property as stated and the property as built.
- **F2-REC-2 — a hand row that mimics the generator's shape is relocated, not preserved in place.**
  MEASURED (above). Nothing is lost and the verifier enforces that, but a hand-written analysis
  line using a real gate key and a real verdict token leaves its section and lands in CARRIED. The
  CARRIED comment tells the reader to re-file, so the outcome is recoverable; worth one line in
  the header so it is a documented consequence rather than a surprise.
- **F2-REC-3 — the record's structural-assertion count is off by one.** `docs/progress/…:564`
  says `grep -n 'exit [0-9]'` returns **8** hits (7 prose + one awk). MEASURED: **9** — 8 prose
  + `:231`. Also 9 at `4d5c6bd9`, so it is not commit drift. The *property* holds and the script's
  own header states it without a number; only the record carries the wrong count.
- **F2-REC-4 — a named parse error does not change the exit code.** MEASURED: fixture 09 derives
  at bare rc **0** with one named `PARSE ERROR`. Correct for a comment-level defect, and the
  self-test pins it deliberately — but a caller that reads only the bare code cannot see that a
  declaration was malformed. Worth one line in the exit-code contract saying so explicitly.
- **F2-REC-5 — "399 verdict rows" does not reproduce.** `merge-findings-baseline.sh:27` and record
  `:613`. MEASURED on the committed door baseline: **401** well-shaped `| ` rows (400 with 6
  unescaped separators, 1 with 7), **0** with an empty column 1. The load-bearing **37**
  reproduces three ways; the row total does not. It is the same sentence that was just corrected.
- **F2-REC-6 — the hat arm's gate row quotes its self-test, not its domain.** Record `:683` gives
  `self-test: 7/7 OK`; the `62829c79` table gave `4 finding(s), all reasoned-allowlisted`. §7.17's
  rule is the domain beside the verdict — census, floor and wrapper rows do that, hat does not.
- **F2-REC-7 — the hub's `adrs:` frontmatter omits 0190.** `docs/features/door-sweep-deriver.md:12`
  lists `["0079","0148","0153","0173","0182"]` — not the unit's own ADR. No gate catches it
  (`lint:registers` bare rc 0). One-token fix at the Record step.

---

## Could not verify — each is a work item, not a pass

1. **`npm run test:db` and the four authz arms at `7e1f0d62`.** Not permitted, not run. I accept
   the iteration-1 table as evidence — it is a real re-run at the tip on a fresh reset with bare
   codes and enumerated domains, which is what I asked for — but it is the builder's measurement,
   not mine. What I did re-run at the tip myself: `npm run lint` → bare rc **0** (eslint 0/0, all
   13 gates), `npm run lint:registers` → bare rc **0** with ratchets unchanged
   (`closesWhenPoToRule=137/147`, `severityPerEmoji=128/135`, `longHeadings=91/97` — **lowered or
   equal, never raised**), and the two read-only catalog checks above.
2. **The merge against a FULL generator's output.** Still open, and now precisely bounded rather
   than open-ended. The `D-real-generator` fixture settles the **2-row** case with real bytes; the
   401-row case is unmeasured, and my 2/24/11 split of the 37 hand rows is a *structural* bound,
   not a run. The first full re-baseline is where the CARRIED block's true size is learned.
3. **Rotation fidelity for the sixth closure** — unchanged from my first review; 2 of 12 `cmp`
   comparisons have no prior committed state. A PO eye.
4. **Whether the `MERGE_FAILED → exit 2` blocks in `rowdoor`/`invoker` have ever fired.** They are
   correct by reading and by the door/writepath twins, but no scenario exercises a harness tail —
   the self-test covers the helper, not its four callers. The new follow-up's close condition
   explicitly refuses "read the code off a clean run", which is the right standard; that standard
   is not yet met for the two minimal blocks this unit added.
5. **That no *other* accepted ADR was made false by this unit.** I checked 0190 in full and the
   one archived closure the contract named. ADRs 0079 / 0153 / 0173 are amended-by-0190 and I read
   the amendment labels (present, with numbers), but I did not re-read those three end to end
   against the new code.

---

## Disposition for the PO

**Not ready for the Record step — but one documentation-only iteration away from it, and the code
half is done.**

- **What must change:** F2-BLOCK-1 only — ADR 0190 D8, D9, D5's body sentence, Considered option
  E, and the archived MARKER closure's clauses 1–2. No code, no migration, no gate re-run, no new
  measurement: every fact is already in the record. I would expect F2-REC-1/2/3/5/7 in the same
  pass (each is one line). **Iteration 2 of ≤5.**
- **Are Batch 2–3's full re-baselines safe for the committed baselines' hand-authored material?**
  ✅ **Yes — this is the sharpest reversal from my first review.** All three destruction modes are
  fixed and the fix is proven able to fail on the real historical losses; an abort now writes
  nothing, says so, and **exits 2** in all four harnesses. Two things the PO should hold in mind
  anyway: the merge writes the committed file, so **commit before the run** and read the exit code
  bare; and an empty `git diff` on a full run is no longer self-explanatory — the deriver's hazard
  text now says to read it together with the merge banner and the exit code.
- **What the PO should EXPECT from the first full re-baseline: a large CARRIED block, and it is
  the safe direction.** MEASURED on the door baseline: of its **37** hand-annotated rows, **2**
  carry unconditionally, **24** carry unless the generator's file list for that gate is unchanged
  (and the suite has grown from `Files=156`/`218` to `262` since those notes were written), and
  **11** splice. Add every gate absent from the run's domain, which also carries whole. Nothing is
  lost and everything is flagged with `old -> new`, but **someone must re-file that block by
  hand**, and that work should be budgeted into Batch 2 rather than discovered during it.
- **What the unit explicitly does not prove.** No full sweep was run — not in the unit, not in
  either review. `PRED_DOMAIN` was **not** widened (correctly, that is Batch 2), so `9a4bbd22`'s
  door `app.current_professional_read_organizations` (`prosecdef=t`, `setof uuid`) still owes a
  **targeted case**, and **21** further outside-domain doors are printed as owing one on the
  pinned range. The 25 historical catalog-query rewrite migrations remain structurally unreachable
  by any text deriver — the script's own stated ceiling. The 34-scenario self-test is **not yet in
  Phase Gate step 1**: that is the lead's playbook edit at the Record step, and until it lands the
  suite runs only when someone remembers.
- **Credit.** The fix loop did the two things that are hard to do under review pressure: it
  **reproduced my witnesses on the pre-fix code before touching anything**, and when a measurement
  refuted the assumption its own splice rule rested on, it changed the rule and wrote the
  refutation down. It also caught two defects in its own fix — an `awk -v` that decoded away the
  fault it was injecting, and a scenario going green on the wrong cause — and recorded both. The
  negative control (13 FAIL on the pre-fix helper, reproduced here) is the strongest evidence any
  unit in this program has shipped. What is left is that the document explaining all of it was not
  re-read beside the code it explains.

---

## Delta check at `ee037fa3` — 2026-09-05

**Scope.** Iterations 2 (`be26568c`) and 3 (`ee037fa3`) since my re-review at `7e1f0d62`
(`ebce7dc0` is that review). Reviewed as a **commit**, not a tree: `git show ee037fa3:<path>`
throughout, `HEAD` = `ee037fa3` and `git status --porcelain` empty at the start and end of this
check. A concurrent `backend` turn is re-running the four authz arms; nothing below reads their
result. Claims are **MEASURED** (I ran it) or **INFERRED** (read, not executed).

### 1. F2-BLOCK-1 — D8 / D9 / D5 / option E re-derived against the code

Every clause I was asked to re-derive holds. MEASURED against `ee037fa3`'s
`scripts/lib/merge-findings-baseline.sh` and `scripts/door-sweep-cases.sh`:

| ADR statement | code | verdict |
|---|---|---|
| D8 — "what counts as a generated row is DERIVED FROM THE GENERATED FILE": three sets H / V / K, any one enough | `── 1a.` awk emits `H` for a line above a delimiter in `$GENERATED`, `V` for every `trim(C[4])`, `K` for every `trim(C[1])`; `split_file` tests `(inregion \|\| (v in verdicts) \|\| (key in keys))` | ✅ exact |
| D8 — shape is "≥ 5 columns and a non-empty column 1" | `nc >= 5 && trim(C[1]) != ""` (1a) and `nc >= 5 … key != ""` (`split_file`) | ✅ exact |
| D8 — "columns split at UNESCAPED `\|` and CAPPED at five; column 5 is everything between the 5th separator and the LAST one" | `seps()` skips `\\\|`; `rowsplit()` `if (ns >= 6) cols[5] = substr(s, sep[5]+1, sep[ns]-sep[5]-1)` | ✅ exact |
| D8 — splice iff verdict unchanged **and** columns 1–4 identical **and** whitespace-tolerant prefix | `same14` loop over `B[i] != G[i]`, `cut = same14 ? wsprefix(...) : 0`, `if (cut > 0 && bv[key] == gv)` | ✅ exact |
| D8 — baseline-only row "CARRIED verbatim … ⛔ never gated on a non-empty note" | `END { for (k in seen) if (!(k in done_g)) carry_row(...) }` — no note test anywhere on that path | ✅ exact |
| D8 — protected set is "the COMPLEMENT … OVER THE WHOLE BASELINE — `\| `-leading lines included" | step 5 builds `b_prose` from `$T/b_norm` (the classifier's own prose half) with `grep -v "^${SOH}ROW${SOH}"`; no `^\| ` exclusion survives | ✅ exact |
| D8 — the `2 ≤ CARRIED ≤ 26` bound is labelled structural | *"(A STRUCTURAL bound over the committed file, not a run: no full re-baseline has been executed by this unit or either review.)"* | ✅ present, and 2+24+11 = 37 sums |
| D9 — `MERGE_VERIFY` is one `VERIFY_ONLY` copy, after the expectation sets, before the single verification block, writes nothing | `cp "$VERIFY_ONLY" "$T/merged"` sits between the `hand_prose`/`NSUFF`/`NCROW` computation and `: > "$T/lost"`; the `VERIFY_ONLY` branch `exit 0`s ahead of `cp "$T/merged" "$OUT"` | ✅ exact — one code path |
| D9 — `MERGE_FAULT` refused unless `SELFTEST=1`, aborts when it cannot inject, `cmp`s its victim, victim travels through `ENVIRON` | the `SELFTEST` guard at `:161-169`; `inject_fail`; `cmp -s "$T/merged.pre" "$T/merged" && inject_fail`; `ENVIRON["MERGE_VICTIM"]` | ✅ exact |
| D9 — `MERGE_FAILED` → `RESULT: ERROR`, **exit 2**, in all four harnesses | door `:977`, invoker `:600`, rowdoor `:468`, writepath `:1411` — all four print the same banner and `exit 2` | ✅ the load-bearing half holds (wording: F3-REC-3) |
| D5 + option E — a `--` line is a continuation **if it carries a SCHEMA PREFIX, not if its tokens parse**; a named parse error does not end the declaration | `if (probe ~ /(app\|public\|authz)\./) { harvest(rest); carry = diagnose(probe, NR); next }`, and `complain()` never clears `inmark` | ✅ exact |
| D5 — a dangling `app.` at end-of-line carries to the next line | `diagnose()` returns the matched prefix; `if (carry != "") { rest = carry rest; carry = "" }` | ✅ exact |
| D8/D9/D5/E — old text kept visibly with dated corrections | four `> ⚠ **Corrected 2026-09-05** ` blocks, each quoting the superseded text verbatim before refuting it | ✅ |

**Re-measured, not read:** `D-real-generator` merge on copies, `TMPDIR` under the scratch dir —
bare rc **0**; `app.is_signoff_deferral_open` **727 → 726 B** (`wc -c`), the merged column 5 starts
with the generator's bytes and ends with the hand suffix verbatim; `app.can_manage_professional`
takes the CARRY branch. The **converse** F2-REC-2 documents is real and I reproduced it: a hand row
in the 5-column shape carrying a real verdict token (`| app.a_hand_note(uuid) | prose | n/a |
COVERED | … |`) appended under its own `## Hand section` merges at rc **0**, the heading is
`PRESERVED 1 hand-authored prose line(s)` **in place**, and the row is relocated **verbatim** into
the CARRIED block as `COVERED -> (absent from this run)`. Placement moves; bytes do not.

**F2-BLOCK-1 is CLOSED.** ✅

### 2. Archived closures, and D11's disclosed gap — which I closed by running it

The MARKER closure (`follow-ups-archive.md:9137-9157`) and the ANNOTATIONS closure (`:9410-9461`)
both carry their dated correction **beside** the original clauses, which are still readable in
full. No silent rewrite. ✅

D11's honest gap — *"the pre-unit-**deriver** negative control has NOT been re-run since scenario
16 was added"* — is cheap, so I ran it. **MEASURED, read-only, in a scratch mirror**
(`$TMPDIR/negctl`): the current `door-sweep-selftest.sh`, the current merge helper, the two audit
harnesses and the fixtures copied in `cmp`-identical (verified: `diff -r` on the fixtures clean,
`cmp -s` clean on the selftest and the helper), with **only** `scripts/door-sweep-cases.sh`
replaced by `git show 53001454:scripts/door-sweep-cases.sh` (blob `db25c20a`, byte-identical to
`76d87a4f`'s — 46 946 B vs the tip's 90 578 B):

```
SELF-TEST: PASS 20 · FAIL 14 · SKIPPED 0     bare rc 1     catalog REACHABLE
```

The 18 merge scenarios pass (only the deriver was swapped), so the **deriver half is 2 PASS / 14
FAIL of 16**. The two survivors are `no migration in the diff -> rc 3` and `bad ARM -> rc 2`; every
other deriver scenario flips. D11 may now state this instead of declining to. ⭐ Note the direction:
the old figure was **3** PASS of 15 and the re-run is **2** of 16 — the suite got *more*
discriminating, not less, which is the opposite of what an adopted-rather-than-measured number
would have said.

### 3. The grep census — the instrument, and what a wider pattern still finds

The dead-instrument disclosure is correct and correctly handled: `grep -rniF` aborting at rc 134
under msys while `2>/dev/null` swallows the abort is a false "none found", and re-running under
ripgrep was the right move.

**Is the ripgrep census proven able to find something?** MEASURED, and yes. Run at `ebce7dc0` —
before iteration 2 — the same patterns hit exactly the sentences iteration 2 then corrected:
ADR `:276` / `:278` (D8's old decision table), `:368` (option E's *"narrowed to a token that fails
to parse"*), archive `:9137` (*"consume-or-stop, token-bearing"*) and `:9410-9414` (*"at all four
call sites"* as the proof of *proven able to fail*). A census that finds the known defect before
the fix and none of it after is a live instrument.

**I re-ran it myself** at `ee037fa3` over `docs/**/*.md` plus the three script headers with the
wider pattern `byte-prefix|prefix of|token-bearing|note carried|harvest|starts with|
consume-or-stop|399|401` — **247** doc hits and **20** script hits, which decompose as
`401`×151, `399`×60, `starts with`×21, `consume-or-stop`×13, `harvest`×12, `prefix of`×10,
`token-bearing`×7, `note carried`×7, `byte-prefix`×1. Classified:

- **Out of subject (the large majority)** — `401_ae4_authz_catalog.sql` / `400_…` migration
  filenames, HTTP `401`, `## D2 — Harvest AFF4's rulings` (ADR 0155), `authz-ae3-review.md:37`'s
  *"token-bearing line"* about a different arm, `authz-ae2.md:823` / `authz-door-audit-findings.md:799`
  *"note carried the domain matrix"* (a different sense of "note"), a dozen `starts with` in phase
  reviews and ETH docs. ✅ none of them a claim about this unit's mechanisms.
- **In subject and correct at the tip** — ADR `:198-210` (describes the old rule *as* old),
  `:303`, `:313`, `:504`, `:514`; the four dated correction blocks; record `:191`, `:662`,
  `:740-758`; hub `:43`; both script headers. ✅
- **In subject and still wrong** — three, all numeric, and the reason the numeric patterns earned
  their place in the pattern list. They are F3-BLOCK-1 and F3-REC-5 below.

### 4. F2-REC-5 — the builder refused my 401 and wrote 400. **Both of us are wrong; the record's original 399 was right.**

This is the one blocking item, and it is worth stating precisely because the fix loop overrode a
**correct** number with a confident wrong one.

MEASURED on `git show ee037fa3:docs/reviews/authz-door-audit-findings.md` (924 lines):

- `grep -c '^| '` = **401**. That is my number and it is a count of `| `-leading LINES. Agreed —
  it was never a count of verdict rows.
- The builder's derivation is *"Exactly ONE of them is the table HEADER (`:112`) … so the VERDICT
  ROWS are 400"*. **That premise is false.** `emit_body` in `p0-authz-door-audit.sh` emits **two**
  distinct table headers — `:761` `| gate / policy | arm | direction | verdict | note |` and
  `:767` `| gate / policy | arm | direction | verdict | failing files / note |` — and the
  committed baseline carries both: `:112` and **`:262`**, directly under `## COVERED
  (asserted-through) + ERROR (harness bug)` at `:260`.
- Three independent measurements agree:
  - `grep -n '^| gate / policy' docs/reviews/authz-door-audit-findings.md` → **2** hits, `:112`
    and `:262`.
  - the census arm's own idiom — `grep -E '^\| ' | grep -vE '^\|[[:space:]]*:?-' | sed -E 's/^\| *//; s/ *\|.*$//'` —
    extracts 401 keys, of which the literal label `gate / policy` occurs **twice**.
  - selecting `| `-lines whose column 1 contains neither `.` nor `(` returns exactly `:112` and
    `:262`.
- Therefore **verdict rows = 401 − 2 = 399**, and the separator histogram over them is **398 with
  6 unescaped separators, 1 with 7** (`:355`), **0 with an empty column 1** — not 399/1/0.

The rejected rule fails for the reason the builder gives, and still lands on the right total: "the
line immediately above a delimiter" picks `:112` and `:282`, which mis-identifies *which* line is
the second header (`:282` is a genuine `COVERED` verdict row stranded above the delimiter at
`:283`) but happens to count the right *number* of them. ⛔ **The direction of the correction was
right and the magnitude was not re-derived** — the exact shape this unit has been correcting all
week.

⭐ **The same file already contradicts the new number.** `merge-findings-baseline.sh:35-36` says the
door baseline carries *"20 rows stranded ABOVE the COVERED table's delimiter"*. I measure **21**
`| `-lines between `:260` and `:283` — and exactly **20** if `:262` is a header. That figure is
right, and it is only right under the two-header reading that `:50` denies. A header comment that
asserts both is self-refuting on its own evidence.

And for the record: **my 401 was wrong too**, and my re-review says so at `:233` (*"401 well-shaped
`| ` rows"*) and `:256` (*"the 401-row case"*). Those two sentences are superseded by this section.

**F3-BLOCK-1 — correct the denominator to 399 wherever the fix loop wrote 400.** Docs- and
comment-only; nothing computes on it; no `test:db` and no authz arm is owed. Four sites:

1. `scripts/lib/merge-findings-baseline.sh:44-56` — the `⚠ The DENOMINATOR was wrong, in BOTH
   directions` block. It must name the **second header at `:262`**, keep 401 as the line count,
   and land on 399 / (398 + 1) / 0. Its neighbour at `:35-36` ("20 rows stranded") then becomes
   consistent rather than contradictory.
2. `docs/features/door-sweep-deriver.md:85-87` — the hub's `## Current state` currently reads
   *"the verdict-row denominator is **400**, not the record's 399 and not QA's 401"*. The hub is
   the summary every future session reads; it is the worst place for this to stand.
3. `docs/progress/door-sweep-deriver.md:624-628` and the F2-REC-5 row at `:804` — the record must
   say the **original 399 was correct** and why the re-derivation missed the second header, not
   just carry a new figure.
4. `docs/decisions/0190-…md` — D8's `37` is untouched (it is a count over column 5, not a share of
   the denominator, exactly as the helper says), so the ADR needs no change **unless** the fix
   loop wants to record the second-header fact there; I would not require it.

⛔ Whatever number lands, it must be written as **derived from the generator's own two headers**,
not from a hand rule about delimiters — that is the property this unit exists to install.

### 5. F2-REC-6 — the hat arm's uncaptured domain half

**Correct discipline, and I would not have accepted the alternative.** Copying `62829c79`'s
*"4 finding(s), all reasoned-allowlisted"* onto the iteration-1 row would have been a claim about a
different run wearing this run's date — the unit's own register lesson, and mine. Marking the cell
`⛔ DOMAIN HALF NOT CAPTURED` and owing a hat re-run is the right shape: §7.17's whole point is
that a verdict without its domain beside it is not a reading. ✅ The concurrent `backend` turn's
re-run at `ee037fa3` will land after this check; the record will carry it. ⚠ When it does, the row
must carry the **enumeration**, not `self-test: 7/7 OK` again — that string is the arm's instrument
control, not its domain.

### 6. The other F2-RECs

| item | verdict | measurement |
|---|---|---|
| **F2-REC-1** — the splice's whitespace exception stated in the header | ✅ **accurate in mechanism**, one wrong figure (F3-REC-2) | `727 → 726 B` reproduced exactly; the merged column 5 = generator bytes + baseline remainder |
| **F2-REC-2** — "the converse is REAL" | ✅ **accurate and reproduced** | the mimicking-row experiment above: rc 0, relocated verbatim to CARRIED, section heading preserved in place |
| **F2-REC-3** — `exit [0-9]` census | ✅ **9**, bare | `grep -c 'exit [0-9]' scripts/door-sweep-cases.sh` = **9** (`:20 :122 :239 :406 :864 :953 :1140 :1234 :1262`) |
| **F2-REC-4** — a named PARSE ERROR moves no code | ✅ **accurate** | `say () { printf '%s\n' "$*" >&2; }` (`:105`) — the block is on **stderr**; the self-test asserts scenario 09 at expected rc **0** with `has_err 'PARSE ERROR'` and `has_err 'schema prefix with no function name'` |
| **F2-REC-5** — the denominator | ❌ **F3-BLOCK-1**, §4 above | |
| **F2-REC-6** — the hat arm | ✅ correct discipline, §5 above | |
| **F2-REC-7** — the hub's `adrs:` | ✅ | `adrs: ["0079", "0148", "0153", "0173", "0182", "0190"]` |

### 7. Gate and scope, every code read bare

| check | OBSERVED |
|---|---|
| `SELFTEST=1 bash scripts/door-sweep-cases.sh` | bare rc **0** — `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`, catalog **REACHABLE**; **16** deriver + **18** merge scenarios, counted off the transcript |
| pre-unit-deriver negative control (§2) | bare rc **1** — `PASS 20 · FAIL 14 · SKIPPED 0` |
| `npm run lint` | bare rc **0**; all chained gates named in the transcript, `build-features-index: OK (8 hubs; index in sync)` |
| `npm run lint:registers` | bare rc **0**; ratchets `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=91/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52` — **identical** to my reading at `7e1f0d62`; none raised |
| `git diff --name-only main...ee037fa3 -- supabase/migrations supabase/seed.sql src` | **empty** |
| `git diff --name-only main...ee037fa3 -- docs/reviews` | exactly `door-sweep-deriver-review.md` + `door-sweep-deriver-rereview.md` |
| four baselines vs `main` | `cmp` **identical** — door, invoker, rowdoor, writepath |
| iteration 2 + 3 script diffs are comment-only | reproduced: `git diff -U0 7e1f0d62..be26568c -- scripts/` and `git diff -U0 be26568c..ee037fa3 -- scripts/`, each piped through `grep -E '^[+-]' \| grep -vE '^(\+\+\+\|---)' \| grep -vE '^[+-][[:space:]]*#'` → **no output**, filter rc 1 in both |
| door baseline hand-block census | reproduced independently: 924 lines, `<!--`×**1**, `## Note`×**7**, `> ⚠ **HAND-MERGED`×**8**, bare `---`×**2**, hand-annotated column-5 rows×**37** |

### 8. Recommendations (non-blocking)

- **F3-REC-1** — fix `merge-findings-baseline.sh:35-36` ("20 rows stranded") **together with**
  `:44-56`, and say *why* 20 is right: `:262` is the COVERED table's header, so `:263-282` are the
  stranded rows. Two sentences that only agree under different header rules are worse than one
  wrong sentence.
- **F3-REC-2** — the **580-byte hand SUFFIX** does not reproduce. MEASURED on the pinned
  `D-real-generator` pair (whose `is_signoff_deferral_open` row is `cmp`-identical to the committed
  baseline's `:293`): the spliced suffix is **579 characters / 587 bytes UTF-8**. The 580 is mine
  originally — it is in my re-review at `:214` — and iteration 3 adopted it in good faith into
  `merge-findings-baseline.sh:24-25`, `:214` and ADR `:316`, `:352`. Correct it to *579 characters
  (587 bytes)*, or drop the figure; the mechanism it illustrates is unaffected.
- **F3-REC-3** — ADR D9: *"`MERGE_FAILED=1` is the **first** branch of the graded block in each"*.
  True of door and writepath. `p0-authz-invoker-audit.sh` and `p0-authz-rowdoor-audit.sh` have **no
  graded block at all** — their own comments say so (*"this harness has NO graded RESULT: verdict
  at all, so a run with BLINDs still exits 0"*) and that gap is filed as
  `FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT`. Say *"the first graded branch where
  there is one, and the only exit-code branch in the other two"* so the ADR does not read as
  claiming a grading those two harnesses do not have.
- **F3-REC-4** — `merge-findings-baseline.sh:74` points the reader at *"see `grammar_from_generated`"*.
  There is no such identifier in the file (nor anywhere in `scripts/`); the thing meant is the
  `── 1a. DERIVE the generator grammar from the generated file itself` banner. Either name the
  block or cite the banner. (The name is mine too — my re-review at `:55` uses it.)
- **F3-REC-5** — `docs/progress/door-sweep-deriver.md:214` and `follow-ups-archive.md:9461-9462`
  say *"401 generated rows into 401 merged"* / *"rows generated **401** → merged **401**"*. Those
  401s are the helper's own `grep -c '^| '` output, which the helper prints honestly as
  **`row line(s)`**. Two of them are headers. The invariance claim is untouched; call them row
  *lines* so the corrected grain holds everywhere.
- **F3-REC-6** — for the Record step: the hub's `reviews:` frontmatter is still `[]`. Both review
  files and this delta need to be linked there.

### 9. Disposition for the PO

**Not ready for the Record step — one blocking item, and it is four sentences.** F3-BLOCK-1 is
docs- and comment-only: no behaviour changes, nothing under `supabase/`, `src/` or `scripts/`
except comment text, so **no `test:db` and no authz arm is owed** by the fix. Everything else in
iterations 2 and 3 lands: F2-BLOCK-1 is closed against the code clause by clause, the six F2-RECs
other than the denominator are correct, and the two gaps the unit disclosed rather than papered
over (the hat arm's domain half, D11's pre-unit control) were both the right call — I closed the
second one myself and it reads **20/14, rc 1**.

**What the unit proves.** The five follow-up closures hold as measured. The merge helper preserves
the hand-authored material under a property derived from the generator rather than a pattern list,
and it is proven able to fail on three **real historical losses**, not a knob. The deriver selects
by catalog property, reads the whole declaration notation with the schema prefix as the
discriminator, scopes what it swept, and its 16 deriver scenarios are 14/16 discriminating against
the pre-unit code.

**What it does not prove, unchanged from my re-review.** ⛔ **No full sweep was run** — not in the
unit, not in any review; the merge is proven on copies and the four committed baselines are
`cmp`-identical to `main`. `PRED_DOMAIN` was **not** widened, correctly (Batch 2), so `9a4bbd22`'s
`app.current_professional_read_organizations` still owes a **targeted case**. The 34-scenario
self-test is **still in no gate** until the lead's playbook edit (F-REC-4). The **CARRIED block a
real re-baseline will produce is large** — structurally `2 ≤ CARRIED ≤ 26` of the 37
hand-annotated rows plus every out-of-domain gate — and someone must re-file it by hand; budget it
into Batch 2 rather than discovering it inside one.

**Verdict at `ee037fa3`: CHANGES REQUESTED**

---

## Sign-off at `8a6fe699` — 2026-09-05

**Reviewed tree:** `authz-door-sweep-deriver` @ `8a6fe699` (clean; `ee037fa3..8a6fe699` = the
`b3cd933e` gate re-read, my delta check `a6b33abf`, and iteration 4's `8a6fe699`).
**Scope of this pass:** F3-BLOCK-1, F3-REC-2..6, the D11 and F2-REC-6 follow-throughs, the hub
trim, the gate, and one last adversarial sweep. The fix loop is capped here.
Every figure below is **MEASURED in this pass** unless marked INFERRED; every exit code read
**bare**; every merge run on **copies under the scratch dir**; nothing outside this file written.

### 1. F3-BLOCK-1 — CLOSED. The denominator is 399, and I re-derived it before reading theirs

| measurement | command | OBSERVED |
|---|---|---|
| `\| `-leading lines | `grep -c '^\| ' docs/reviews/authz-door-audit-findings.md` | **401** (file 924 lines) |
| headers, by the generator's own two texts | `grep -n '^\| gate / policy' …findings.md` | **2** — `:112` and `:262` |
| headers, by an independent filter | column 1 containing neither `.` nor `(`, over all 401 | **exactly** `:112` and `:262` — no verdict row mistaken for a header, no header missed |
| delimiters | `grep -nE '^\\\|[[:space:]]*:?-'` | `:113`, `:283` — neither is a `\| `-line, so neither is in the 401 |
| **verdict rows** | 401 − 2 | **399** |
| empty column 1 | escape-aware split | **0** |

**399 at every site, and iteration 3's wrong correction kept, dated and visible.** `rg '\b400\b'`
over the helper, hub, record, ADR and archive returns **no live 400**: the survivors are
`merge-findings-baseline.sh:51` and `:66` and record `:632`, `:641`, `:1035`, `:1070`, `:1072`,
`:831` — every one of them *inside* a quoted `[⛔ CORRECTED 2026-09-05, iteration 4]` block that
names what the sentence used to say before refuting it. That is the shape I asked for: a
correction of a correction that does not erase its own history. ✅

**The "20 rows stranded" / "21 lines" reconciliation now reads correctly, and I checked the
arithmetic rather than the sentence.** `:259` blank · `:260` `## COVERED …` heading · `:261` blank
· `:262` the second header · `:263-282` rows · `:283` the delimiter. MEASURED over `261..282`:
**21** non-blank lines, **21** of which are `\| `-leading → 1 header + **20** rows, 22 lines
counting the blank. The helper's `:47-52` states exactly that and draws the right inference — the
sentence is now *evidence for* the two-header reading instead of contradicting its neighbour. ✅
F3-REC-1 is closed by the same edit.

### 2. …but the histogram inside that correction is measured with a MISLABELLED instrument

I ruled, as asked, and I ruled **against the fix loop**. Both numbers are reproducible; they are
answers to two different questions, and the sentence asks one and answers the other.

| instrument | `:293` | `:355` | histogram |
|---|---|---|---|
| **unescaped separators** (what the sentence SAYS it counts) | **6** | 7 | **398 / 1 / 0** |
| raw `\|` including `\\\|` (what it actually counted) | 9 | 7 | 397 / 1 / 1 |

`:293`'s three extra pipes are `\|`-**escaped** — the sentence's own parenthetical prints them:
``:293, whose note carries `^(is_\|can_\|has_\|…)` ``. An escaped pipe is not a separator, and this
file says so itself **ten lines above**, in the helper's own rule 2 at `:113`: *"Columns are split
at UNESCAPED `|` only"*. So under the artefact's own definition, `:293` carries six separators and
the histogram is **398/1/0** — my delta-check number, which the paragraph explicitly overrides:
*"⚠ The histogram is 397/1/1, NOT the 398/1/0 the fix-loop brief predicted"*. That clause is
wrong, at `merge-findings-baseline.sh:76-80`, `docs/progress/door-sweep-deriver.md:648-650` and
`:1017-1022`.

⚠ And the mislabel **erases a real distinction**: `:355` is genuinely malformed (an unescaped `|`
inside `` `ERROR | run-shape!=baseline` ``, which only the cap-at-five rule keeps from becoming a
sixth column), while `:293` is correctly escaped. Bucketing them together as "two over-piped rows"
says the correct row and the broken row are the same kind of thing. They are not, and it is the
`:355` kind that breaks a naive consumer.

⛔ **Why this is NOT blocking.** The histogram is one of three corroborating measurements, and the
other two are exact. It sums to **399 under both instruments**, so the denominator — the only
figure anything downstream keys on, and the whole content of F3-BLOCK-1 — is untouched. No number
moves. **F4-REC-1** below is a one-clause fix.

### 3. The classifier — checked by reading AND by running, and it is not defective

**By reading.** Step 1a (`merge-findings-baseline.sh:290-303`) marks a generated line `H` when
`delim[FNR+1] && !delim[FNR]`, then `next`s — so a header contributes **no** `V` and **no** `K`.
`emit_body` emits two header+delimiter pairs, so both header texts land in `H`. `split_file`
(`:315-341`) then sets `isheader = (line in hdr)` on **exact full-line text** and the row branch
is guarded `if (!isheader && …)`. `:262` can therefore never be read back as a row, and `:282`
— iteration 3's claimed casualty — is a genuine row correctly classified, because nothing in the
baseline pass keys on delimiter adjacency at all. ✅

**By running**, on a copy, with a synthetic two-header generated emit (both `emit_body` header
texts verbatim, one row each) against the committed door baseline:

```
bare rc 0
MERGE: … 5 row line(s); PRESERVED 447 hand-authored prose line(s), 0 hand suffix(es); CARRIED 398 whole row(s).
```

- the `:262` header text occurs **exactly once** in the output, **in place**, under its own
  `## COVERED …` heading and above its own delimiter (`out:195-199`);
- **no** CARRIED entry names `gate / policy` — the header manufactured nothing;
- and the property itself: all **399** baseline verdict rows are present **verbatim** in the
  output (`comm -23` of the sorted baseline rows against the whitespace-stripped output rows →
  **0** absent). 403 output rows = 399 baseline + 2 generated + 2 headers, which balances exactly.

⭐ One thing worth recording for whoever runs the real re-baseline: **398** of the 399 were carried
and **one** (`authz.holds_role`, baseline `:608`) was preserved *in place* instead — because my
synthetic generator emitted no `ERROR` verdict, so that row matched no `V`, no `K` and no region.
That is the **fail-safe branch behaving correctly**: an unrecognised `\| `-line is preserved as
prose, never destroyed. It is an artefact of my instrument, not of the helper.

### 4. F3-REC-2..6, D11 and F2-REC-6 — each re-measured, not read

| item | verdict | measurement |
|---|---|---|
| **F3-REC-2** — the "580-byte" suffix | ✅ **FIXED, and exact** | Re-measured independently by applying `wsprefix`'s rule to column 5 of `…findings.md:293` with an escape-aware capped split: column 5 = **630 chars / 638 bytes**; the generator's region `10_immutability.sql, 367_deferred_staff_signoff.sql` (51 chars) is a prefix; remainder = **579 characters / 587 bytes**. The corrected text states **both units** and says why (the note is multi-byte). Corrected at helper `:24-30`, `:214`, ADR `:316`, `:352` |
| **F3-REC-3** — D9's "first branch of the graded block" | ✅ **FIXED, verified against both harnesses** | ADR `:382-397` now splits by harness shape. `supabase/tests/mutation/p0-authz-{rowdoor,invoker}-audit.sh` both end **exactly** `if [ "${MERGE_FAILED:-0}" = "1" ]; then … exit 2; fi` then `exit 0`, with `grep -n MERGE_FAILED` showing no graded block; door `:977` / writepath `:1411` keep theirs. The dated correction quotes the false clause and names `FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` |
| **F3-REC-4** — a pointer to a name that does not exist | ✅ **FIXED as asked** | I grepped **every** function name the header cites against the file. Shell: `die`, `note`, `split_file`, `inject_fail`, `rowkeys` — `grep -nE '^[a-z_]+ *\(\) *\{'` returns exactly those five. Awk: `trim`, `seps`, `rowsplit`, `is_delim`, `wsprefix` — all present. `grammar_from_generated` survives **only** inside the dated correction that names it as the phantom. ⚠ One over-broad universal remains: **F4-REC-2** |
| **F3-REC-5** — "rows" → "row line(s)" | ✅ **FIXED at both sites** | record `:214` now reads **row LINES** with the reason at `:219-221`; `follow-ups-archive.md:9464-9470` leaves the archived closure text **standing** and puts the dated correction beside it, stating that the 401→401 identity is unaffected. Correct archive discipline. The helper's own note line prints `row line(s)` (`:546`), reproduced in my run above |
| **F3-REC-6** — `reviews:` frontmatter | ✅ **FIXED** | hub `:10` = `reviews: ["../reviews/door-sweep-deriver-rereview.md", "../reviews/door-sweep-deriver-review.md"]`, current verdict first; `build-features-index: OK (8 hubs; index in sync)` |
| **F2-REC-6** — the `hat` arm's domain half | ✅ **CLOSED the right way** | The pointer **resolves** (record `:860` → `:907` `#### The `hat` arm's DOMAIN half — quoted, at the tip`), and the target holds the verbatim stdout, the **4 named findings** and a population **measured against the live catalog in the same session** (1091 functions in `app`+`public`+`authz` with `prokind='f'`, 283 RLS policies) — enumeration, not `self-test: 7/7 OK` again. The iteration-1 row is deliberately **not** back-filled |
| **D11's control** | ⚠ **landed in the record and the hub, NOT in the ADR** | record `:777` and `:1103-1109` and hub `:73-75` all carry my `PASS 20 · FAIL 14 · SKIPPED 0`, bare rc 1, deriver half **2/16**, attributed to the delta check at `ee037fa3` and explicitly **not re-run**. But `git diff ee037fa3..8a6fe699 -- docs/decisions/0190-*.md` has **three** hunks (F3-REC-2 ×2, F3-REC-3) and **none in D11** — see **F4-REC-3** |

### 5. The hub's `## Current state` — trimmed without stripping a qualifier

`git show ee037fa3:docs/features/door-sweep-deriver.md` vs HEAD, Current-state block only: **51 →
60 lines** (the "74" was an intra-iteration draft; the gate's cap is 60 and it is met). I diffed
the block and located **every** cut sentence in the record before accepting the trim:

| cut from the hub | where it lives now |
|---|---|
| *"including verbatim the clause whose implementation \*was\* the blocking defect"* | record `:760` |
| the parenthetical *"(F-REC-4 is the lead's playbook edit)"* | still in the hub's own item (4), same block |
| *"plus dated corrections beside two archived closures, each with the superseded text kept visible"* | record `:715`, `:1098`, and the archive entries themselves |
| the iteration-3 per-REC enumeration | record, and the hub says so: *"Per-site old → new detail is in the record"* |
| `bash -n` **0** on both scripts | record `:847` and `:1151` |

No surviving claim lost a qualifier. Two gains, both correct: item (3) is struck as **CLOSED** with
its enumeration rather than deleted, and the gate paragraph now measures the **tip** (`ee037fa3`,
fresh reset) instead of arguing from `7e1f0d62`. ✅

### 6. Gate and scope — every code read BARE

| check | command | OBSERVED |
|---|---|---|
| self-test | `SELFTEST=1 bash scripts/door-sweep-cases.sh` | bare rc **0** — `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`, `catalog : REACHABLE (supabase_db_azkbbhskturikxpgmafq)` — the project's stack, not a sibling |
| lint chain | `npm run lint` | bare rc **0** |
| registers | inside the chain | ratchets `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=91/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52` — **byte-identical** to my readings at `7e1f0d62` and `ee037fa3`; **none raised** |
| app-code scope | `git diff --name-only main...8a6fe699 -- supabase/migrations supabase/seed.sql src` | **empty** |
| review scope | `git diff --name-only main...8a6fe699 -- docs/reviews` | exactly `door-sweep-deriver-rereview.md` + `door-sweep-deriver-review.md` |
| the four baselines | `cmp` against `git show main:…` | door · invoker · rowdoor · writepath — **all IDENTICAL** |
| iteration 4 is comment-only in `scripts/` | `git diff -U0 ee037fa3..8a6fe699 -- scripts/ \| grep -E '^[+-][^+#-]'` | **no output**, filter rc **1** |

So: no migration, no policy, no `prosecdef` gate, no grant, no RPC, no seed, no `src/`. **No
`test:db` and no authz arm is owed by iteration 4**, and none is claimed — `test:db` and the four
arms stand on the `ee037fa3` tip re-read (INFERRED: I am not permitted to run them).

### 7. The last sweep — three false sentences survive, all documentation, none load-bearing

⭐ These are the finding of this pass, and the pattern is worth naming: **iteration 4's content was
correcting false sentences, and it shipped three new ones.** Each is a *narrower* error than the
one it replaced — which is the register-rot signature: the false clause errs tighter, so it reads
as care.

- **F4-REC-1 — the mislabelled histogram** (§2). `merge-findings-baseline.sh:76-80`, record
  `:648-650` and `:1017-1022`. Either relabel the counts as **raw `|`, escapes included**, or
  restate them escape-aware as **398 / 1 / 0**; do not leave "6 unescaped separators" attached to
  a count that includes `\|`, ten lines below the rule that defines a separator as unescaped.
  Say which of `:293` and `:355` is *correctly escaped* and which is *malformed* — they are not
  the same finding.
- **F4-REC-2 — a false universal in the F3-REC-4 fix.** `merge-findings-baseline.sh:108-109`:
  *"the only awk functions are `trim`, `seps`, `rowsplit`, `is_delim`, `wsprefix`"*. MEASURED:
  `grep -nE 'function [a-z_]+ *\('` returns **nine** — those five plus `carry_row` (`:360`),
  `shape` (`:419`), `emit_row` (`:420`) and `flush` (`:428`). The five named are the shared
  `AWKLIB` ones; the other four are local to later blocks. Every name **cited** exists, so
  F3-REC-4's actual requirement is met — it is the quantifier that is wrong. Say *"the shared
  `AWKLIB` functions are …"*.
- **F4-REC-3 — ADR 0190 D11 now contradicts the record and the hub.** D11's correction block
  (`:470-478`) still reads *"the pre-unit-**deriver** negative control has NOT been re-run since
  scenario 16 was added, so its post-fix figure is unmeasured and is deliberately not restated
  here as a number"*. That was true at `ee037fa3`; at `8a6fe699` it is **false** — I ran it, and
  the record `:777` / `:1103` and hub `:73-75` all say the caveat is **DISCHARGED**. The record's
  own sentence *"The D11 row's caveat … is replaced with QA's measurement"* is true of the
  record's tracking row and **not** of the ADR, which was not touched. ⛔ This is the F2-BLOCK-1
  shape — an ADR describing a state the loop has moved past — and I say plainly why I am **not**
  blocking on it: F2-BLOCK-1 had the ADR misdescribing a **shipped mechanism**, where a reader who
  trusts it builds the wrong thing; D11 merely **declines to state a figure that now exists**. A
  conservative-wrong caveat costs at most a duplicated 30-second run; it cannot propagate a
  defect. Fold the two sentences into the Record commit: `PASS 20 · FAIL 14 · SKIPPED 0`, bare
  rc 1, deriver half **2/16**, attributed to QA at `ee037fa3`, **not re-run by the ADR's author**.

Everything else I swept is clean. The seven follow-up bodies this unit closed are **deleted** from
`docs/followups/` and their text lives in `follow-ups-archive.md` with the dated corrections
standing **beside** the original clauses, not over them (MARKER closure `:9137-9157`, ANNOTATIONS
closure `:9410-9470`); the two that stay open (`…MARKER-DECLARES-POLICIES-TOO`,
`…ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT`) carry no stale number from this unit
(`grep -nE '\b(399|400|401|580|first branch|graded block)\b'` → **no hits** in either).

### 8. Disposition for the PO — final

**Ready for approval and the Record step.** The one blocking item is closed and I re-derived it
from the generator's own two headers before reading the fix; all five F3-RECs are closed and
individually re-measured; the D11 and F2-REC-6 follow-throughs landed as *measurement*, not as
back-filled numbers — which is the discipline this unit exists to install. The three residual
items are one-clause documentation edits (F4-REC-1..3); **none touches code, schema, RLS,
`prosecdef`, a gate or a security boundary**, and none changes a number anything computes on.
They can ride the Record commit.

**What the unit proves.** The deriver selects doors by **catalog property** (`prosecdef`), not by
a name regex; it reads the whole declaration notation with the schema prefix as the discriminator,
names its parse errors loudly on stderr, and prints a `SCOPE:` line on **every** exit path with a
three-state derivation badge (catalog / PROVISIONAL / NOT REACHED). The merge helper preserves
hand-authored material under a property **derived from the generator's own output**, not a pattern
list, and is **proven able to fail on three real historical losses** — the committed pre-fix
outputs, rejected at rc 2 ×3 while the current output passes at rc 0. 34 self-test scenarios, 14
of 16 deriver scenarios discriminating against the pre-unit deriver (2/16 survive), all fixtures
committed. Five follow-up closures hold as measured.

**What it does not prove — unchanged, and the PO should budget all five.**
1. ⛔ **No full sweep was run** — not in the unit, not in any of my three passes. The merge is
   proven on **copies**; the four committed baselines are `cmp`-identical to `main`.
2. `PRED_DOMAIN` was **not** widened (correctly — Batch 2), so `9a4bbd22`'s
   `app.current_professional_read_organizations` still owes a **targeted case**.
3. The 34-scenario self-test is **in no gate** until the lead's playbook edit (F-REC-4). Until it
   lands, 34 scenarios exist that nothing invokes.
4. The **CARRIED block a real re-baseline will produce is large** — structurally
   **2 ≤ n ≤ 26** of the door baseline's 37 hand-annotated rows, plus every gate absent from the
   run's domain. Nothing is lost and everything is flagged, but a human must **re-file it by
   hand**; budget it into Batch 2 rather than discovering it inside one.
5. Three of the six follow-up closures rest on the follow-up **body's** condition because the
   register field read `PO to rule`. That field is the PO's, and no gate can decide it.

**Verdict at `8a6fe699`: APPROVED**

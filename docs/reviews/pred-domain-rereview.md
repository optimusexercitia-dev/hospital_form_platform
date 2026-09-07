# PRED-DOMAIN — QA RE-review (fix-loop iteration 1 + the lead's gate re-read)

# ✅ VERDICT: APPROVED

**Reviewer:** `qa` · **Date:** 2026-09-07 · **Subject:** unit `PRED-DOMAIN`, branch
`authz-pred-domain`, tree at **`c73131fe`** (`c73131fe67b548914913ffabd39581c90b8e76ae`, the tip;
`git log --oneline -6` reproduced below). Working tree **clean** at entry and at exit — I wrote
exactly one file, this report.

```
c73131fe docs(pred-domain): the four arms re-read at the tip by the lead — reset, test:db 262/8876, …
4ace3bfb docs(pred-domain): F-BLOCK-1 corrected by measurement; F-MAJOR-2/3/5/6/8
8c352ecb fix(harness): DOMAIN-STATEMENT — a true measured witness, the ADR 0187 D1 sentence verbatim, …
714bfc3d fix(authz-findings): the three set-valued resolvers' verdicts as census-readable rows; …
efbaa25f docs(reviews): QA review of PRED-DOMAIN at 6f94a634 — CHANGES REQUESTED, 3 BLOCK / 9 MAJOR
376d5717 docs(lead-playbook): section 4 — the set-valued targeted home's schedule and the NOTICED class
```

First review: `docs/reviews/pred-domain-review.md` at `6f94a634` (CHANGES REQUESTED; F-BLOCK-1..3,
F-MAJOR-0..8, F-REC-1..14, an 8-item could-not-verify list).

---

## 0. Headline

**All three blocking findings and all nine major findings are fixed, and every one of them was
fixed by RE-MEASUREMENT rather than by re-wording my report.** I re-derived each correction
independently; in every case the loop's figure and mine agree, and in several cases the loop's
figure is byte-identical to an artefact I produced without reading theirs.

Two things raise this above a routine pass:

1. **The corrections are dated and sit BESIDE the sentences they correct, which are left
   unedited** — in the record, the follow-up register, the hub, ADR 0191 (four separate dated
   corrections) and the archive. Nothing was tidied away.
2. **The one new instrument (`SELFTEST` ARM 4) is proven able to fail twice, and I reproduced both
   plants.** The paraphrase mutant reds `rc 1, 2/3` against a `rc 0, 3/3` control run in the same
   isolated root; the dead-extractor plant reds `rc 1, 1/3` and demonstrates that the
   instrument-alive row is load-bearing rather than decorative (without it, `grep -qF ""` makes the
   byte-exact row green against nothing — I watched that happen).

⛔ **Scope is clean and there is no security surface here.** `git diff --name-only main...c73131fe
-- supabase/migrations supabase/seed.sql src` is **EMPTY**; the diff-scoped deriver returns bare
**3** with `SCOPE: 0 file(s) … derivation: NOT REACHED`; the four sibling findings baselines and
both blind allowlists are **byte-identical to `main`**; no policy, no `prosecdef` gate, no RLS
predicate changed. Nothing in this unit touches an authorization boundary.

Seven new observations are recorded in §5. None blocks; three are worth a line at the Record step.

---

## 1. Method — what I measured, and how

Read-only on application code, migrations, specs and queries throughout.

| what | how |
| --- | --- |
| the three set-valued keys | read from the live catalog (`supabase_db_azkbbhskturikxpgmafq`) with `census_proc_domain`'s own `pg_get_function_identity_arguments` expression, `diff`ed against column 1 of the filed rows |
| `verdicts_from_findings` 356 → 359 | function re-implemented from `p0-authz-invariant.sh:140-143`, run over `git show 6f94a634:` and the tree |
| **the whole `ARM=census` accounting** | `census_proc_domain`'s three queries + the policy query re-typed against the live catalog, and `accounted` rebuilt from the four findings files + `skipped_from_findings` + the three `allow_body` files — then `diff`ed against the arm's OWN `/tmp/authz-audit/census_live.txt` and `census_accounted.txt` from the lead's 04:40 run |
| the 24 offenders and their composition | `blind_from_findings` + `allow_body` re-implemented in python (pipe-split by index, never a regex over the row), run over `git show main:` and the tree; the arm was NOT run |
| the `DOMAIN-STATEMENT` | `domain_statement ()` extracted verbatim, sourced with the four derived values set, and its output `diff`ed byte-for-byte against the committed findings header |
| the ADR 0187 D1 sentence | the SELFTEST's own extractor re-run by hand over the ADR; `grep -nF` for the sentence and for the one-token perturbation over the emitter and the report |
| SELFTEST ARM 4's ability to fail | two plants applied to COPIES in an isolated fake root (`docs/decisions` + `docs/reviews` copied beside a `supabase/tests/mutation/` holding the script), each plant verified landed before the run, with an unmutated control in the same root |
| the new `MALFORMED` assertion | the shipped `merge-findings-baseline.sh` run in `MERGE_VERIFY` mode on copies, pre- and post-repair; and the predicate re-implemented over every column-5 cell of all five committed findings reports |
| the merge's treatment of the six hand-filed rows | the merge run on copies with a synthesized generator-only `GENERATED`; output inspected for indentation and re-read with `verdicts_from_findings` |
| the historical witness | `121_interviews.sql:297` / `:565` read; `guard_interview_status` read from `pg_proc`/`pg_trigger`; the C2 verdict tally recomputed from `c2-command-door-findings.md`; `app.print_source_series`'s `prosrc` scanned for DML |
| the lead's gate | `rc.txt`, `runner.sh`, `reset.log`, `testdb.log`, four arm logs and two selftest logs read directly |

**Bare exit codes I observed myself, at `c73131fe`:**

```
SELFTEST=1 bash scripts/door-sweep-cases.sh                      -> 0   SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0
SELFTEST=1 bash supabase/tests/mutation/p0-authz-door-audit.sh   -> 0   TOTAL: 23/23 ok, 0 failed
                                                                       (classify 6/6 · resets_enabled 6/6
                                                                        · emit_result 8/8 · domain-statement 3/3)
                                                                       committed baseline VERIFIED unchanged (cksum)
npm run lint                                                     -> 0   eslint 0/0; check-docs-registers: OK
bash scripts/door-sweep-cases.sh main                            -> 3   SCOPE: 0 file(s) … derivation: NOT REACHED
git diff --name-only main...c73131fe -- supabase/migrations supabase/seed.sql src   -> EMPTY
git diff --name-only main...c73131fe -- .claude CLAUDE.md                            -> EMPTY
git status --porcelain                                           -> EMPTY (before and after my run)
```

Ratchets, read from my own `npm run lint`:

```
closesWhenPoToRule=137/147  severityPerEmoji=128/135  severityUnrated=29/29  revisitWhenPoToRule=38/38
longHeadings=90/97  bugsUntriaged=10/10  bugsUnrated=40/40  lessonsProseOnly=52/52
```

**Identical to the figures in my first review** — three `LEARN-` rows were added and
`lessonsProseOnly` did not move, which is the checkable form of "every new lesson carries a
repo-path enforcer". Ratchets not raised. `scripts/check-docs-registers.mjs` unmodified.

---

## 2. Disposition of every first-review finding

### Blocking

| # | disposition | the measurement |
| --- | --- | --- |
| **F-BLOCK-1** — "0 of the 24 offenders is false" | ✅ **FIXED** | I re-derived the offender set at the tip: BLIND union **78**, allowlist **59**, offenders **24**; of those **12 carry `BLIND` in column 4** and **12 carry `COVERED`** — and my 12-name COVERED list is byte-identical to the list now enumerated in the record. The supporting arithmetic reproduces too: the `## BLIND` section holds **78** rows of which **38** are non-BLIND phantoms, **26 allowlisted / 12 not**; the 12 genuine offenders are the 11 mirror flips + `referral_requested_actions.referral_requested_actions_write_admin (ALL)`. Corrections are dated and land in all three places I named — record (`§ the ARM=policy disclosure`, original left unedited), the follow-up register (re-rated **medium → high**, heading emoji raised to 🟠 with it), and the hub's `## Blockers`. All 12 enumerated. ⛔ None allowlisted — `authz-blind-allowlist.txt` is byte-identical to `main`. The record states plainly that the arm's red "is not readable" until the follow-up's fix lands, which is the honest consequence |
| **F-BLOCK-2** — the three set-valued verdicts exist nowhere a census can read | ✅ **FIXED** | Three rows filed in `docs/reviews/authz-door-audit-findings.md` (§ The three set-valued scope resolvers, `:1007`). **Column 1 is byte-identical to the catalog**: I ran `census_proc_domain`'s own expression and `diff`ed — rc 0 on all three, including the empty-argument `app.current_professional_read_organizations()` and the two four-token `authz.*` identity-argument forms. `verdicts_from_findings` **356 → 359, 359 unique** (re-implemented, both trees). The backlog key line is **deleted** (`allow_body` sees it gone). ⭐ **Deletion was RIGHT, and I verified the builder's proof rather than its conclusion:** `run_arm_census` builds `accounted` as `{…} \| sort -u`, so an entry in both files collapses to one line — keeping it could not double-count, and what it *would* create is the stale entry `FUP-AUTHZ-UNSWEPT-BACKLOG-STALE-ENTRY-HAS-NO-ARM` predicts. MEASURED corroboration: `backlog ∩ verdicted` at the tip is still exactly **2** (`process_template_versions.*`), unchanged — the deletion did not add a third. `authz-unswept-backlog.txt` is consumed by `p0-authz-invariant.sh` and by no other script (grepped). `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` filed with **both defects verified against the harness**: it prints the shorthand label (`authz-setvalued-targeted-cases.sh:392-396`, `run_case "authz.authorized_scope_ids(uuid,text,text)"`) and a generator-shaped header with a bare token (`:433`). Its `**Closes when:**` names an artefact and an observable transition and carries two ⛔ bars; the code is registered in the open register |
| **F-BLOCK-3** — the `DOMAIN-STATEMENT`'s only "Measured witness:" is false | ✅ **FIXED** | The witness is now a dated **BLIND-and-its-discharge**, and I measured every sub-claim independently: `121_interviews.sql:297` is `'HC038', null` (code-only pin) ✓; `:565` is the `reopen_interview` keystone pinning the door's own message `'apenas entrevistas concluídas podem ser reabertas'` on an `awaiting_follow_up` fixture ✓; `app.guard_interview_status` is `prosecdef=t`, returns `trigger`, wired as `guard_interview_status_trg` on `case_interviews` (catalog) ✓; C2 stands at **170 COVERED / 1 BLIND / 0 ERROR** (recomputed from column 4 of `c2-command-door-findings.md`) ✓; the one BLIND, `app.print_source_series`, contains **0** DML statements in its `prosrc`, so no trigger can be in its path ✓. **Population 4 is now honestly labelled**: "So population 4 is currently ASSERTED — bounded by the two DERIVED counts above — and witnessed only historically." That is exactly the disposition my Q8 condition 2 required, and it is stated rather than implied. ADR 0191 `:63-77` carries the same correction as a dated block beside the original paragraph, left unedited |

### Major

| # | disposition | the measurement |
| --- | --- | --- |
| **F-MAJOR-0** — the classifier header asserts the superseded rule | ✅ **FIXED** | `p0-authz-door-audit.sh:419-433`: the old sentence is **quoted** under `⛔ SUPERSEDED 2026-09-07`, the shipped rule stated beside it, and the reader is pointed at `emit_result()`. Quoted rather than deleted, which is this program's convention |
| **F-MAJOR-1** — population 1 paraphrases a sentence ADR 0187 D1 requires verbatim | ✅ **FIXED** | I ran the extractor myself over ADR 0187: it yields `Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared` (64 chars). `grep -nF` finds it **once** in the emitter (`:1015`) and **once** in the committed report (`:45`); the one-token perturbation is found **0** times. ⭐ **The expectation is EXTRACTED, never re-typed** (`:634-637` reads the ADR file and greps `${BASH_SOURCE[0]}`), with an instrument-alive row and a discrimination half — and I proved both are load-bearing (see §3) |
| **F-MAJOR-2** — one corrupted note, and the verifier was blind to a malformed join | ✅ **FIXED** | The `40_rls.sql` seam is repaired; I re-implemented the shipped predicate (`.sql` followed by a letter, over every column-5 cell) and measured **1 hit on the pre-repair file — the exact row — and 0 hits across all five committed findings reports today**. I then ran the shipped assertion itself on copies: `SELFTEST=1 MERGE_VERIFY=<pre-repair>` → **rc 2**, `MERGE-ABORT: the merge produced MALFORMED hand-authored material. 1 item(s): … commissions.commissions_select_member_or_admin (SELECT)`; on the repaired file the MALFORMED block does not appear at all. ⭐ **The disclosed dead end is the more valuable half and it checks out**: deriving the token alphabet from the artefact under test blinds the detector to `ERROR`, which is precisely the token this file's column 4 no longer contains. Blind spots that remain are named in §5 (N2) — non-blocking |
| **F-MAJOR-3** — ruling: keep the re-attach, date it, repair it | ✅ **FIXED as ruled** | The row now carries `40_rls.sql. ⚠ **HAND-MERGED, re-attached 2026-09-07** (QA F-MAJOR-2/F-MAJOR-3)`, the restoration source is named (run 2's generated row + the carried baseline row), and the historical clause is era-marked `**[pre-2026-09-05 — the WHOLE-POLICY neutralization (`using` AND `with check`), retired by the mirror fix; this clause is HISTORY, not a contradiction of column 4]**`. Both halves of my ruling executed |
| **F-MAJOR-4** — the write arm's description of the read arm is false | ✅ **FIXED** | Both sentences corrected in place at `p0-authz-writepath-audit.sh:81-99`, each stating what it used to say and why it changed. Comment-only change; nothing executable in that file moved |
| **F-MAJOR-5** — "23/23 strict superset" is 21/23 | ✅ **FIXED** | Dated correction beside the unedited original; both exceptions named (`app.is_oversight_only_reader`, `cases.cases_staff_admin_write (ALL)`); the claim the ruling actually needs — `reddened:` non-empty — restated as 23/23 and re-measured |
| **F-MAJOR-6** — two generalizable lessons, none registered | ✅ **FIXED** | `LEARN-086` (never hand-derive a restore path; believe a restore only on a catalog re-read), `LEARN-087` (a fix correct at MOST of its sites reads as a complete one), `LEARN-088` (a prose claim ABOUT a measurement is a second artefact, and only the measurement has an owner). Register 85 → 88 rows; **every one carries a repo-path enforcer and `lessonsProseOnly` stays 52/52** — I re-ran `npm run lint` and read the ratchet myself. One observation on LEARN-087's enforcer in §5 (N7) |
| **F-MAJOR-7** — "derived … never literal" while four of five populations are literals | ✅ **FIXED** | Provenance is now **per figure**: `[literal — ADR 0171 via ADR 0187 D1, as of 2026-09-04]`, `[literal — ADR 0184 pt 4, as of 2026-09-04]` (twice), two `[literal, and SELF-EVIDENCING — …]` labels for the 2 writers and the 3 resolvers, and `DERIVED this run` on the trigger counts, `$PRED_OUT` and `$SETVALUED_N`. I re-derived the three catalog figures: **174 / 268 / 5** — matching. ⭐⭐ **And the committed report header is byte-identical to what the emitter produces**: I extracted `domain_statement ()`, sourced it with the four derived values, and `diff`ed its 79 lines against the committed block — **rc 0**. There is no hand-copy drift between the script and the report |
| **F-MAJOR-8** — ADR 0191 D8's four contradicted figures | ✅ **FIXED** | Four dated corrections, each beside an unedited original: a three-row table correcting the 274-cases / 79-cases / 23-vs-24 figures (`:395-408`), and a `⭐ SETTLED` note recording that run 2 measured the read-half work-list at **11**, not "5 to 21" (`:479-486`). The last one even names its own shape: *"an amendment recorded only in the new document … here inside ONE document"* |

### Recommendations

| # | disposition |
| --- | --- |
| F-REC-1 | ⬜ **open** — `act-hat-blind-sweep.sh:22` still cites `:195`; the query is at `:202` (measured) |
| F-REC-2 | ⬜ **open** — 7 mentions of `b59d4bbf` in the archive, of which the five `**RESOLVED … commit `b59d4bbf`**` lines are the mis-attributions (the closures are in `6f94a634`) |
| F-REC-3 | ⬜ **open, widened** — four register entries now carry no body file and no `**Body:**` pointer (the new `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` joins the three). `lint:registers` passes, so this is judgement, not a gate breach |
| **F-REC-4** | ✅ **FIXED** — a dated clause at `authz-door-audit-findings.md:1000-1003` disambiguates `15 + 15 + 1 = 31` |
| F-REC-5 | ⬜ **open** — `TRIG_SECDEF` still bounds to `('app','public')` at `:999`; still measured inert |
| F-REC-6 | ⬜ **open** — `FUP-DOOR-DEGENERATE-PREDICATE-TWO-HAND-COPIES` still names only `DEGENERATE_PREDICATE`; the `resets_enabled`/`periodic_reset` pair is unnamed (grep: 0 hits) |
| F-REC-7 | ⬜ **open** — two `## COVERED …` headings, `:288` and `:366` |
| F-REC-8 | ⬜ **open** — the `FUP-C2-TIER1-VALUE-ASSERTIONS-…` register line is unchanged vs `main` while its body carries the 23-row work-list |
| F-REC-9 | ⬜ **open by design** — the lead closes `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` at the Record step; its close condition is satisfied at `376d5717` |
| F-REC-10 | ⬜ **open** — ADR `:136-137` ends "…in §7.17b and in the `DOMAIN-STATEMENT`"; the emitter (`:1061`) ends "…in §7.17b and in this statement" |
| F-REC-11 | — withdrawn at the first review |
| F-REC-12 | ⬜ **open** — ADR `:230` still says "four constructed strings"; six ship |
| F-REC-13 | ⬜ **open** — ADR `:267-268` still says "23 aborting-file signatures"; the body carries 15 distinct signatures over 23 rows, and the four weak rows live in a separate follow-up |
| F-REC-14 | ⬜ **open** — ADR `:515` still lists the playbook scheduling line as an open consequence; `376d5717` satisfied it |

⚠ **None of the eleven open RECs should block.** Each is a one-clause text fix; four of them
(F-REC-10, -12, -13, -14) are inside ADR 0191, which is `**Status:** proposed` and will be revisited
when the PO accepts it — that is the natural moment to land them together.

---

## 3. Items the task asked me to judge, ruled

**(a) `verdicts_from_findings` at 359 and the filed keys.** MEASURED, byte-for-byte. The three
keys the catalog emits and the three the file carries are identical, including the exact spacing of
`(p_principal uuid, p_resolution_kind text, p_permission_code text)`. ⭐ The row set's own ⛔ note —
*"'Filed here' means readable by the census, not swept by this arm"* — is the right claim, and the
`⛔ Only ONE of the three is in ARM=census's domain today` paragraph is measured true (`authenticated`
EXECUTE = `t` for the `app.` wrapper, `f` for both `authz.*` resolvers).

**(b) The deletion of the backlog entry: RIGHT.** Ruled above. The residual risk that deletion
creates — that the filed row is now the *only* thing accounting for a live, in-domain,
`authenticated`-reachable `prosecdef` set-returning door — **fails LOUD, not silent**: if the row
were ever lost, `ARM=census` reds naming the gate. That is the correct direction, and it is why the
two-step order (file the row, then delete the line, in one commit) matters.

**(c) The `SELFTEST` ARM 4 mutation proof — REPRODUCED, both plants.** In an isolated fake root
(the script beside copies of `docs/decisions` and `docs/reviews`, the repo untouched):

```
control  (unmutated)                  -> rc 0   domain-statement 3/3, TOTAL 23/23
plant 1  emitter reverted to the pre-fix paraphrase
                                      -> rc 1   domain-statement 2/3  (byte-exact row NOT OK)
plant 2  D1_ADR pointed at a missing ADR
                                      -> rc 1   domain-statement 1/3  (alive + control rows NOT OK)
```

⭐ Plant 2 is the interesting one, and it earns its place: with the ADR unreadable the expectation
is the empty string, `grep -qF ""` matches everything, and **the byte-exact row prints `ok` against
nothing at all**. The instrument-alive row is what turns that into a red. That is a real
discrimination half, not a decoration.

**(d) The `MALFORMED` predicate's blind spots — judged.** It matches `.sql` followed by a
**letter**, in **column 5**, on an **un-indented** `| ` row. It would therefore still miss:

- a suffix whose first character is not an ASCII letter — a digit, `(`, `[`, `*`, `_`, `-`, or any
  of this tree's `⚠ ⛔ ⭐`. ⚠ Note that the **repaired** suffix now begins `. ⚠ **HAND-MERGED`, so a
  future re-attach following the repaired row as its model would land in the blind spot;
- a **comma**-joined suffix (`…,40_rls.sql,ERROR at whole-policy…`), which reads as a filename and
  is the most likely next corruption now that "add a separator" is the stated remedy;
- a seam after a token that is not `.sql` (a `.md`, a bare policy name, an extensionless file);
- a malformed join inside a **CARRIED** row, since carried rows are indented and `^\| ` skips them.

That the shipped instance was caught at all depends on the damaging suffix beginning with `E`.
Non-blocking — the assertion is strictly better than what preceded it and the alphabet dead end is
disclosed — but see N2 for the part that is worth a follow-up.

**(e) The lead's playbook §4 lines vs the record and the harness.** The **NOTICED** definition is
consistent across all three renderings — I read `emit_result()`'s five branches and the playbook's
`BLIND (blocks) · NOTICED (disclosed, non-blocking) · ERROR (not a pass)` reproduces the DIRTY
line's own wording, while `0 BLIND ∧ 0 ERROR ∧ >0 NOTICED → rc 0 with the disclosure printed`
reproduces `RESULT: CLEAN WITH DISCLOSURE … return 0`, which the SELFTEST asserts 8/8. **No
contradiction between the three.** The scheduling sentence is *not* byte-verbatim from the record —
see N4.

---

## 4. Gate evidence at the tip — provenance assessed

The lead's run is at `4ace3bfb`; `git diff --name-only 4ace3bfb..c73131fe` is
**`docs/progress/pred-domain.md` alone** (the gate-record entry itself), so every subject the arms
measure is byte-identical at the tip.

| property | assessment |
| --- | --- |
| **fresh reset stated?** | ⭐ **Better than stated — executed by the same script, first.** `runner.sh` runs `supabase db reset --local` as step 1 and appends `RESET_RC=$?` before anything else. `reset.log` ends `Finished supabase db reset on branch authz-pred-domain`. The reset is not a claim about a separate session |
| **codes bare?** | ✅ Every code is `echo "X_RC=$?"` immediately after a plain redirect — no pipe anywhere in the chain, so no exit code is destroyed and none is merely *read* without being recorded |
| **figures enumerated?** | ✅ `Files=262, Tests=8876 / Result: PASS`; census `581 / 604`; hat `7/7` self-test + 4 reasoned-allowlisted findings; floor `63` zero-call doors, both OK lines; wrapper `BLIND set size: 41`, OK line |
| **`test:db`** | Corroborated from the log itself: `All tests successful.`, **0** lines matching `^not ok` or `# Looks like you failed`. Not re-executed by me |
| **census 581 / 604** | ⭐⭐ **INDEPENDENTLY RE-DERIVED AND BYTE-IDENTICAL.** I rebuilt both sets from the catalog and the committed files without reading the arm's output, then `diff`ed against `/tmp/authz-audit/census_live.txt` and `census_accounted.txt`: **rc 0 on both**, live **581**, accounted **604**, `comm -23 live accounted` = **0 uncovered**. This is the block my first review flagged as unre-derived by any second party; it is now derived twice |
| **604 reconciled** | ⚠ The `596` figure in my task brief does not hold. My reconstruction, at three trees: `main` **625** → `6f94a634` **602** → tip **604**, which matches the record's own `625 → 602` (`pred-domain.md:2346`) and the lead's `604`. The tip delta is exactly **+2** — `authz.authorized_scope_ids` and `authz.candidate_authorized_scope_ids` — **not +3**, because `app.current_professional_read_organizations()` moved from the backlog to the findings file inside a `sort -u` union. The record says this correctly ("602 → 604 after the re-files' bookkeeping — re-derived, not summed") |
| **ratchets not raised** | ✅ identical to my first review's line; `check-docs-registers.mjs` unmodified |
| **scope diffs empty** | ✅ `supabase/migrations`, `supabase/seed.sql`, `src`, `.claude`, `CLAUDE.md` — all empty vs `main` |
| **sibling baselines** | ✅ `authz-writepath-audit-findings.md`, `authz-rowdoor-audit-findings.md`, `authz-invoker-audit-findings.md`, `c2-command-door-findings.md`, `authz-blind-allowlist.txt`, `authz-invoker-blind-allowlist.txt` — all **byte-identical to `main`** |

Two weaknesses in how the run is *quoted*, not in the run: N5 and N6 below.

---

## 5. New observations (none blocking)

**N1 — the two hand tables lose their HEADER at the next merge, and two documents say otherwise.**
MEASURED on copies, with the shipped `merge-findings-baseline.sh` and a generator-only `GENERATED`
(the committed file truncated at its first `## Note`): the merge exits **0**, all **six** hand-filed
rows survive **in place, un-indented**, and `verdicts_from_findings` reads all six — ⭐ so the
load-bearing property holds and no verdict is at risk. But **both hand table header lines are
relocated into the `CARRIED` block, indented**, leaving each section with a `|---|---|---|---|---|`
delimiter and no header. `authz-door-audit-findings.md:1028` and ADR 0191 `:373-375` both say the
merge "keeps them as prose, in place"; that is true of the **rows** and false of the **header**, and
the merge helper's own documented exception 2 covers hand *rows*, not hand *headers*. Cosmetic for
the census, wrong for a reader, and it is a claim about a measurement — this unit's own subject.
⚠ My `GENERATED` is a synthesis, so N1 belongs on the could-not-verify list until a real full run
confirms it.

⛔ **A related hazard worth a line somewhere durable, surfaced by my first (deliberately
contaminated) run of the same test:** the merge derives its verdict-row grammar (H/V/K) from the
generated file. If a future generator ever emits the header text `verdict (earned elsewhere)` or the
token `COVERED (targeted mutation)`, all six hand-filed rows are reclassified and relocated, and
they leave `verdicts_from_findings`. Neither string appears in the harness today (grep: 0, 0), and
**nothing asserts that they never will**. The failure is loud (census reds) rather than silent,
which is why this is an observation and not a finding.

**N2 — the new `MALFORMED` assertion has no standing self-test case.**
`scripts/door-sweep-selftest.sh` is **unchanged** by this loop and contains **0** occurrences of
`MALFORMED`; its total is `PASS 34` before and after. The assertion's ability to fire is proven by
one ad-hoc pre/post run — which I reproduced today, so it is real — but nothing re-proves it on the
next change. That is "a detector that finds nothing must be proven able to find something" one level
up, and it is the same gap the door harness itself had to close with `emit_result()`. Suggest a
`FUP` or a case in the standing self-test, together with the blind spots in §3(d).

**N3 — the hub's `adrs:` frontmatter omits `0191`.** `docs/features/pred-domain.md:12` reads
`adrs: ["0079", "0153", "0173", "0182", "0184", "0187", "0190"]` — the ADR this unit authored is
absent, so `docs/features/INDEX.md` does not link a reader from the unit to its own decision.
⚠ Pre-existing at `6f94a634` and **my miss at the first review**, not a regression. No gate catches
it (`build-features-index: OK`). One-token fix at the Record step.

**N4 — `376d5717`'s commit message says the scheduling sentence was "pasted verbatim from the
PRED-DOMAIN record"; measured, it is not.** After normalising whitespace and the blockquote prefix,
the two strings differ in exactly one place: the playbook adds `; ADR 0079 hazard 4` after
`(ADR 0191 D3`. The addition is a **correct strengthening** — that hazard is the reason the family
is out of domain — so the substance is better than the record's draft. Only the word "verbatim" is
false, and it lives in a commit message no gate reads. Recorded because I was asked to check it and
because it is, one more time, a claim about a measurement written beside a correct one.

**N5 — one self-test run is quoted as two gates.** Both the record's gate table (`:2686-2690`) and
the hub's `### In progress` list `deriver SELFTEST 34/0` and `merge helper SELFTEST 34/0` as
separate rows. `scripts/door-sweep-cases.sh:171` is `exec bash "$HERE/door-sweep-selftest.sh" "$@"` —
they are **the same run**, one script covering both areas (20 deriver cases + 32 merge references).
Three named green witnesses are two.

**N6 — the lead's record entry quotes the door self-test by its last matched line, not its
verdict.** The entry carries `ok shape MOVED + PASS -> ERROR (files=262 tests=8712)`, which is a
`classify` row, where the readable witness is `--- SELFTEST TOTAL: 23/23 ok, 0 failed ---` (present
in the lead's own `selftest-door.log`, and reproduced by me). The `ARM=hat` quote is also truncated
mid-word (`… authz.holds_role an`). Both are quoting defects, not measurement defects.

**N7 — `LEARN-087`'s enforcer is the remediated SITE, not an instrument.** The row names
`supabase/tests/mutation/p0-authz-door-audit.sh` — the second site that received the fix — where the
lesson is *enumerate the sites the mechanism has*. Nothing there would detect the next partial fix.
`LEARN-086`'s and `LEARN-088`'s enforcers are better aimed (the two neutralizers; the door harness's
new ADR-extraction arm). Gate 13 only asserts the field is not `prose only`, so this is judgement.

---

## 6. The first review's could-not-verify list, answered

| # | first review | now |
| --- | --- | --- |
| 1 | the four §6 arms' rc 0 and their figures — nobody but the builder had run them | ✅ **DISCHARGED, twice.** The lead ran all four on a fresh reset at `4ace3bfb`, bare codes in `rc.txt`, logs kept. ⭐ And I **re-derived `ARM=census`'s entire accounting from the catalog and the committed files** and got a byte-identical `census_live.txt` (581) and `census_accounted.txt` (604), 0 uncovered. `hat` 7/7, `floor` 63 + both OK lines, `wrapper` BLIND 41 ⊆ allowlist: read from the lead's logs, **not re-executed by me** |
| 2 | `npm run test:db` at `Files=262, Tests=8876` on a fresh reset | ✅ **DISCHARGED by the lead**; corroborated by me from `testdb.log` (`All tests successful.`, 0 `not ok`). Not re-executed by me |
| 3 | `ARM=census`'s non-vacuity control (delete 5 rows → red naming all five) | ⬜ **still open** — not re-run by anyone at this tree. Mitigated: the accounting it protects is now second-party-derived |
| 4 | the 23 NOTICED rows' attributability | ⬜ **still open, correctly work-listed** — unchanged and honestly so |
| 5 | whether any of the 242 deleted CARRIED rows was live, in domain and unaccounted | ⭐ **materially strengthened** — I measured `comm -23 live accounted` = **0** at the tip myself, so no live in-domain gate is unaccounted today. I still did not enumerate the 242 individually |
| 6 | the targeted home's three verdicts cannot be re-derived from any committed artefact | ✅ **DISCHARGED** — they are filed as census-readable rows with catalog-derived keys (F-BLOCK-2) |
| 7 | two ADR 0191 claims with no artefact (`:165-166`, `:216`) | ⬜ **still open** — unchanged, still unfalsifiable as written, still not load-bearing for any verdict |
| 8 | run 2 itself, the 9 `periodic_reset` trials, the two-row mutant | ⬜ **still open** — read from logs and the record, not re-executed |

## 7. New could-not-verify list (each is a work item, not a clearance)

1. **N1's merge behaviour at a REAL full run.** My `GENERATED` was synthesized. What must be
   confirmed the first time the door sweep runs to completion after this branch lands: the six
   hand-filed rows are still un-indented and still read by `verdicts_from_findings`, and whether the
   two hand table headers survive.
2. **`ARM=hat`, `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper`** — rc 0 read from the lead's logs; I
   re-derived only `census`.
3. **`supabase db reset --local` and `npm run test:db`** — not re-executed by me (out of my
   permissions for this review); read from `rc.txt` and `testdb.log`.
4. **`authz-setvalued-targeted-cases.sh` still has no `SELFTEST`**, and its three verdicts rest on
   the 2026-09-05 run, not re-executed here. ⚠ Corroborating, not proving: the suite shape those
   verdicts were earned at (`Files=262, Tests=8876`) is the shape the lead re-measured today.
   `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS`'s successor should carry "add a no-DB SELFTEST arm".
5. **The `MALFORMED` assertion's standing coverage** (N2) — proven able to fire once, by hand,
   today. Nothing re-proves it.
6. **Run 2, the `periodic_reset` trials, the census non-vacuity control, ADR 0191 `:165-166` and
   `:216`** — carried forward unchanged from the first review.

---

## 8. Disposition for the PO

**Ready for approval and for the §5 Record step.**

Nothing found in this loop touches an RLS boundary, a migration, `seed.sql`, `src/`, a policy or a
`prosecdef` gate — measured, not asserted: the scope diffs are empty, the diff-scoped deriver
returns bare **3** with `SCOPE: 0 file(s)`, and the four sibling findings baselines and both blind
allowlists are byte-identical to `main`. There is no security surface in this unit.

### What the unit PROVES

- The door arm's domain admits `authz.candidate_has_permission` and `authz.scope_reaches` and
  **nothing else** (125 → 127, `PRED_OUT` 37 → 35, reverse delta 0).
- The read arm's `FOR ALL` verdicts are **read-half claims**; the cost is exactly **11** `(ALL)`
  `COVERED → BLIND` flips and **zero** non-`(ALL)` flips, enumerated with each policy's `using` qual.
- **`NOTICED` exists, fires, cannot become COVERED, and its exit semantics are tested offline** —
  now 23/23 including an arm that asserts a required sentence against the ADR that requires it.
- The **tail drift is diagnosed, not patched**; ADR 0189 D6's design is ported with two justified
  adaptations, and the C2 hazard it exposes is filed rather than silently fixed.
- The findings baseline is **re-earned through the merge**, hand material intact, duplicate keys
  eliminated, `verdicts_from_findings` clean at **359/359**.
- The **three set-valued resolvers' verdicts are census-readable**, keyed exactly as the census
  emits them — and `ARM=census` closes at **581 live / 604 accounted / 0 uncovered**, re-derived by
  a second party.

### What the unit does NOT prove, and must be carried forward

- **`NOTICED` is evidence, not a verdict** — **23** gates carry no usable verdict, work-listed in
  `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` (23 rows in its body), with the four
  weakest split into `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`.
- **11 `(ALL)` read-half BLINDs** are disclosed, never relabelled, and keystoning them is its own
  increment (`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`).
- **`FROMFINDINGS=1 ARM=policy` is RED, was red at `main` (16 offenders), and 12 of its 24 offenders
  are section-stale rows this re-baseline created.** Its red is **not readable** until
  `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` (now 🟠 high) is fixed. ⛔ The twelve
  must not be allowlisted. It is not one of §6 step 1's four arms.
- **The set-valued targeted home emits an un-filable shape** — filed as
  `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS`; today's three rows were hand-corrected on both axes.
- **The C2 captured-OID hazard is filed, not fixed**
  (`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET`).
- **Population 4 of the `DOMAIN-STATEMENT` is ASSERTED, not witnessed** — bounded by its two derived
  counts and witnessed only historically, which the block now says in those words. Populations 1, 2,
  3 and 5 are labelled `[literal]` with their source and as-of date.
- **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.**

### At the Record step (lead)

1. Close `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` — satisfied at `376d5717` (F-REC-9).
2. Add `"0191"` to the hub's `adrs:` frontmatter and re-run `npm run features:index` (N3).
3. Link this report from the hub's `reviews:` frontmatter.
4. Optional, cheap, and worth doing while the context is warm: F-REC-1, -2, -7, -8 (four one-clause
   fixes), and the four ADR-0191 RECs (-10, -12, -13, -14) when the PO accepts the ADR.
5. Consider a follow-up for N1 + N2 (the merge's treatment of hand table headers; a standing case
   for the `MALFORMED` assertion and its named blind spots).

⭐ **A closing note on the loop itself.** My first review named a pattern — *a claim about a
measurement, written beside a correct measurement, that no gate can contradict* — and observed it
five times. The loop's response was to re-measure every one of the twelve rather than re-word them,
to date each correction beside the sentence it corrects, to register the pattern as `LEARN-088`,
and, in the one place where a gate could exist, to **build** it: the `DOMAIN-STATEMENT` now asserts
its required sentence against the ADR that requires it, extracted rather than re-typed, with an
alive row and a discrimination half. That is the right answer to the finding, and it is why this is
an approval rather than a second loop.

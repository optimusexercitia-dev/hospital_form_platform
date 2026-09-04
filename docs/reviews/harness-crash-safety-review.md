# ✅ VERDICT: APPROVED

**Unit:** HARNESS-CRASH-SAFETY (pre-AE5 remediation, Batch 0)
**Reviewed commit:** `6b6aee64` on `authz-harness-crash-safety` (8 commits `9c934039..6b6aee64`)
**Reviewer:** `qa` · **Date:** 2026-09-04
**Disposition:** APPROVED with **4 MAJOR** and **4 RECOMMENDED** findings, none blocking. No
finding touches a production function, policy, grant or migration; none leaves an authorization
gate reachable. Every MAJOR is a bounded instrument gap or a disclosure gap, and each carries a
measured fix.

---

## 0. Method, and one methodological correction I owe the reader

Every claim below is labelled **MEASURED** (with the command or the quoted line) or **INFERRED**.
Exit codes were read bare (`$?` on the next line), never through a pipe.

⚠ **A correction against myself, recorded because it is the exact failure this project keeps
finding.** Partway through the review I read `docs/features/harness-crash-safety.md` from the
**working tree** and found it asserting `FUP-AUTHZ-HARNESS-TRANSACTIONAL` **CLOSED BY PO RULING**
while ADR 0189 `:145` and the record `:350` both said it **stays open** — an apparent three-way
contradiction inside one commit. It was not. `git status` showed six **uncommitted** files: the
concurrent `backend` turn was mid-edit. Re-derived with `git show 6b6aee64:…`, the committed hub
reads `- [ ] ⏸ FUP-AUTHZ-HARNESS-TRANSACTIONAL 🔴 — **STAYS OPEN**, awaiting the PO ruling on Q2`
and is fully consistent with the ADR and the record. **The contradiction is retracted.** A claim
about "the docs" is a claim about a **commit**; every doc finding below was re-derived from
`git show 6b6aee64:` rather than from the tree. (Memory: *an always-loaded file is read from YOUR
tree, not the one under review*.)

---

## 1. What I MEASURED — the checks that passed

| # | Check | Command / line | Result |
|---|---|---|---|
| M1 | **Scope discipline (Q9)** | `git diff --name-only main...6b6aee64 -- supabase/migrations supabase/seed.sql src` | **empty** — MEASURED. No production function, policy, grant, migration or seed changed. Re-run against the mid-edit tree: also empty. The diff-scoped door sweep is genuinely **not owed**. |
| M2 | **Verified restore reads the CATALOG (Q1)** | C2 `:148` `live="$(psql_c -c "select md5(pg_get_functiondef($oid::oid));")"` | MEASURED. The probe is a live catalog read. The comparand `$INFLIGHT.md5` is written at `:428` by `snapshot()` from the **catalog**, before the mutation — never a hash of `$INFLIGHT.body`. |
| M3 | **Clear-only-on-both-conditions (Q1)** | C2 `:149` `if [ "$rc" = "0" ] && [ -n "$want" ] && [ "$live" = "$want" ]; then` | MEASURED. Missing sidecar ⇒ `want=""` ⇒ **refuses** (`:154`, `return 2`). Unreadable catalog ⇒ `live=""` ⇒ refuses. "Cannot verify" resolves to "do not clear", as D1 states. |
| M4 | **Same shape in both siblings (Q1)** | `p0-authz-door-audit.sh` / `p0-authz-writepath-audit.sh`, `arm_inflight`/`restore_inflight` | MEASURED from the diff. Probe is catalog SQL (`md5(pg_get_functiondef($oid))`; for policies `md5(coalesce(pg_get_expr(polqual,…))||'|'||…)` from `pg_policy`). `RECOVER=1` refuses with an explicit `<no probe sidecar: this sentinel predates the verified-restore protocol>` when it cannot verify. |
| M5 | **`ON_ERROR_STOP=1` on every `psql_f` in C2 (Q1)** | C2 `:87` | MEASURED. C2 has exactly **one** `psql_f` (`:73–88`) and one `psql_c` (`:72`); grep confirms no third psql path. |
| M6 | **The header's cross-file line-number claims (`:81–82`)** | grep `ON_ERROR_STOP` in all four siblings | MEASURED and **all four exact**: door `:187`, writepath `:281`, invoker `:200`, rowdoor `:146`. A line-number claim that actually resolves. |
| M7 | **Arm 4a clean-tree counts (Q3)** | read-only catalog query, exact predicate from `:351–352` | MEASURED, **reproduces exactly**: arm 4a `= 0`; shape alone `= 3`; public+app functions `= 1081`. The script's three stated numbers are correct. |
| M8 | **`mutate()` is all-or-nothing (Q3, D3)** | C2 `:489–491` | MEASURED: `if v_before = 0 then raise …; end if; if v_after <> 0 then raise …; end if; execute v_new;` — one `DO` block, one implicit transaction, so a raise aborts before `execute`. D3's claim holds. |
| M9 | **Arm 4b cannot be masked by a simultaneous entrant (Q4)** | C2 `:387–395` | MEASURED from the awk: the loop is `for (k in b)` over **baseline** keys, testing each independently for `LEFT THE POPULATION` / `BELOW ITS BASELINE`. A new entrant is tallied separately (`:405–409`) and cannot cancel a departure. |
| M10 | **Arm 4b's committed-findings fallback actually parses** | the `sed` at C2 `:375–376` against `docs/reviews/c2-command-door-findings.md` | MEASURED: **171 rows** parsed, correct `name<TAB>nraise` pairs. The arm is armed on a normal checkout, not silently `NOT RUN`. |
| M11 | **`NOT RUN` branch exists and fails to NOT-RUN, never to "clean" (Q4)** | C2 `:382–385` | MEASURED (code path). If `$WLBASE` is absent **and** the `sed` yields nothing, `WLSRC=""` and the branch prints `arm 4b: NOT RUN … ⛔ This is NOT 'clean'`. Not exercised — see §4. |
| M12 | **Tail-drift interlock ordering (Q5)** | C2 `:622–626` then `:629` | MEASURED: the `[ -s "$INFLIGHT" ]` refusal is step 1, **before** `( cd "$ROOT" && npx supabase db reset --local )`. `cd "$ROOT"` present at `:629`. Both preflight arms re-run at `:633–634`; worklist re-derived and diffed at `:638–645` with abort on change; baseline re-captured at `:647` with abort if not green. |
| M13 | **Subset semantics under `SUITE=` (Q6)** | C2 `:96–102`, `:529`, `:104–110` | MEASURED: `SUITE` joins the SUBSET condition; `emit` writes only `$FINDINGS`; the committed file is opened **read-only** at `:373–377`; `verify_baseline_untouched` cksums it on the EXIT trap. |
| M14 | **Narrowed-domain verdict polarity (Q6)** | C2 `:712` vs `:715–723` | MEASURED: `COVERED` stays a verdict under a narrowed domain; a mutated-run `PASS` under `SUITE=` records `ERROR — NARROWED DOMAIN`. Correctly **not** applied to `CASES=`, which narrows the worklist, not the domain. |
| M15 | **Retired rule moved VERBATIM (Q7)** | `diff` of `git show main:.claude/rules/c2-neutralizer-has-no-crash-safety.md` against the fenced block in `docs/progress/rules-archive.md` | MEASURED: **23 lines vs 23 lines, diff empty, rc 0.** Byte-identical. |
| M16 | **Gate 8 byte cap (Q7)** | `wc -c .claude/rules/mutation-harnesses-are-not-killable.md` | MEASURED: **2032 bytes**, cap 2048. My own `npm run lint` run confirms `check-rules-staleness: OK (10 rule file(s), anchors + globs resolve)`. |
| M17 | **Every sentence of the corrected rule is true of the code (Q7)** | rule text vs C2 `:139–166`, `:173–200`; sibling diffs | MEASURED, clause by clause. `"C2 + p0-authz-{door,writepath}-audit.sh; ⛔ NOT p0-authz-{invoker,rowdoor}-audit.sh"` — correct. `"A failed restore KEEPS the sentinel; the next run REFUSES, exit 2"` — `:154–163` + `:189–199`. `"without ON_ERROR_STOP=1 psql returns 0 on a SQL ERROR"` — corroborated by the plant-C witness. `"~10 are true BY DESIGN … discriminator is cmd <> 'SELECT'"` — consistent with the sibling rule. **No false sentence found.** |
| M18 | **The F1 amendment is visible AS an amendment (Q8)** | committed `follow-ups-archive.md`, sentinel entry | MEASURED: original close-condition 2 retained **verbatim**, followed by a nested `> **Amended 2026-09-04 (F1)**` block that opens *"the sentence above is kept **verbatim** because it is what was filed; it is **not** what closes this item"*. Body-file diff is a **pure insertion**, zero deletions. Exemplary. |
| M19 | **The other two bodies moved byte-identically (Q8)** | `diff` of each `main:` body against its archived copy | MEASURED: `FUP-AUTHZ-HARNESS-PRECONDITIONS` and `FUP-C2-NEUTRALIZER-TAIL-DRIFT…` both **rc 0, byte-identical**. |
| M20 | **The new follow-up is filed with a body and a measurable close condition (Q8)** | `FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL.md` + its row in `follow-ups-open.md` | MEASURED: 54-line body with the five-harness measurement table; all six register fields present; close condition is a three-part protocol **plus** "proven able to fire by a corrupted-restore plant" — measurable, not aspirational. |
| M21 | **LEARN-084/085 enforcer paths resolve (Q8)** | `docs/learning/LESSONS.md:107–108` | MEASURED: both name `supabase/tests/mutation/c2-command-door-neutralizer.sh`, which exists. LEARN-082's enforcer correctly repointed from the retired rule to the harness. Consistent with LEARN-081's existing practice. |
| M22 | **ADR hygiene** | ADR 0189 header; `0153`/`0171` back-pointers; `INDEX.md`; `proposed-review.json` | MEASURED: `**Amends:** ADR 0171 · ADR 0153` **with numbers**, so the generated back-pointers landed in both amended ADRs; INDEX row added; `proposed-review.json` updated to include `0189`, keeping gate 9's drift check green. |
| M23 | **Lint gate re-run** | `npm run lint`, exit code read bare | MEASURED: **rc 0**. `check-docs-registers: OK`; ratchets `closesWhenPoToRule=140/147 severityPerEmoji=131/135 longHeadings=93/97 lessonsProseOnly=52/52` — all at or **below** the record's figures (ratchets may only be lowered). |
| M24 | **Proofs are of PRODUCTION text, not a copy (Q2)** | C2 `:563–593`; the record's cited `sed -n '/^arm_inflight () {/,/^}$/p'` | MEASURED. C2's SELFTEST arms call the **in-file** `snapshot`/`mutate`/`restore_inflight`/`hash_of` directly — the strongest form, no copy at all. For the siblings I ran the record's own extraction: it yields the complete function, `bash -n` rc 0. The `eval`'d proofs genuinely exercised shipped text. |

**Proof-of-fire integrity (Q2) — assessed, and it is the strongest part of this unit.** Every
detector the unit claims carries an **observed exit code and message** from a planted strand,
each paired with a clean-tree negative control in the same session: restore refusal (`rc=2`,
`RESTORE FAILED (psql rc=3, body hash live=c787e3dd… want=1636bd89…)`, sentinel intact — the
assertion that *could not have passed* pre-fix); `RECOVER=1`; arm 4a (`cancel_event`, exit 2,
before any suite run); arm 4b (`LEFT THE POPULATION`, exit 2, with arm 4a *correctly silent* —
that silence is the discrimination half a negative control cannot supply); NARROWED DOMAIN
(the same enforcer under two domains, exit 0 vs exit 1); the reset interlock (exit 2, sentinel
byte-unchanged 10→10); the retry net (a verdict *recovered*); both sibling restores, function
probe and policy probe, each with its own plant. ⭐ The record also discloses, unprompted, that
the policy-plant matcher was **wrong first time** and read exactly like a live defect
(`docs/progress/harness-crash-safety.md:302–309`) — a disclosure that raises my confidence in the
rest, not lowers it.

---

## 2. Findings — MAJOR

### F-MAJOR-1 — Arm 4a is blind to a strand of `app.assert_patient_required_fields`, which is inside the swept 171 (comment-preceded raise)

**MEASURED**, by simulating `mutate()` read-only over all 1081 `public`+`app` functions and asking
arm 4a's own predicate of the result:

```
would_be_fully_stranded = 439 | VISIBLE_to_arm4a = 438 | INVISIBLE_to_arm4a = 1
                                          -> app.assert_patient_required_fields (oid 26675)
```

**Mechanism, MEASURED** from `prosrc`. Arm 4a's first conjunct is
`c2-command-door-neutralizer.sh:351` — `p.prosrc ~ '(then|else|begin|loop|;)\s*null\s*;'`. In this
function the anchored raise is preceded by a three-line `--` comment block, so after the rewrite
the text reads `-- … this door wrote.\n  null;` and the token before `null;` is comment text, not
one of `then|else|begin|loop|;`. The predicate does not match.

**Why it matters:** this is not a hypothetical function. It is row 161 of the committed baseline —
`| app.assert_patient_required_fields(p_mode text, …) | 5 | 1 | **COVERED** |` — i.e. **in the
swept 171, guarding 5 Tier-1 PHI doors.**

**MEASURED fix, using the file's own idiom.** `derive_worklist` already strips comments at `:233`
and `:296` (`regexp_replace(p.prosrc,'--[^\n]*','','g')`); arm 4a does not. Applying the same strip:

```
strandable=439  still_invisible=0        <- closes the hole completely
clean-tree count with the stripped predicate = 0   <- and reds nothing that is clean today
```

**Bound / mitigation — INFERRED, and it is why this is MAJOR not BLOCK.** The script states the
bound honestly at `:336–337` (*"A `null;` reachable by no other statement boundary is arm 4b's
job"*), and arm 4b **does** cover this case: a full strand removes the function's only anchor-class
errcode, so it drops out of `c2n.gatefn` (`:279–282`) and arm 4b reds `LEFT THE POPULATION` —
provided a baseline source exists, which M10 shows it does on a normal checkout. The sentinel and
the startup refusal are the first line in any case. So this is a hole in the **third** layer.

**What is missing is the number.** The bound is stated abstractly and never quantified; "1 of 439,
and it is one of the 171, and the mechanism is a preceding comment" is one query away. *An
absence's mechanism is measured, not read off the gate.*

**Action:** strip comments in arm 4a's first conjunct, and record the measured 1→0 in the record.

---

### F-MAJOR-2 — `RESET_EVERY` **does** fire on a `SUITE=` subset: 8 destructive `supabase db reset --local` in a run type the ADR says never resets

**MEASURED**, from the loop at `c2-command-door-neutralizer.sh:738–746`. `DONE` counts enforcers
that survive the `CASES` filter (`:740` `continue`s **before** `:741` `DONE=$((DONE+1))`). A
`SUITE=` run narrows only the **domain** — the worklist is untouched, so all 171 enforcers are
swept — and `[ $(( (DONE - 1) % RESET_EVERY )) -eq 0 ]` fires at `DONE` = 21, 41, … 161: **eight
resets**, each running `npx supabase db reset --local`.

Three documents assert otherwise:

- ADR 0189 Consequences `:172–173` — *"Subsets never reset — the counter cannot fire on a worklist shorter than N."*
- C2 header `:614` — *"⚠ RESET_EVERY cannot fire on a worklist shorter than N, so `CASES=` subsets never reset."*
- the archived TAIL-DRIFT closure — *"⚠ It cannot fire on a worklist shorter than N, so `CASES=` subsets never reset."*

The parenthetical mechanism is right; the generalisation is wrong. D5 of the **same ADR** defines
a `SUITE=` run as a subset, and `SUITE=` is advertised at `:35` as the quick one-file option.
Secondarily, a `CASES=` list of ≥ 21 tokens also resets.

**Why it matters — INFERRED.** `supabase db reset --local` is destructive and this machine
routinely has a second stack up (**MEASURED**: `supabase_db_escalume` and
`supabase_db_azkbbhskturikxpgmafq` both running during this review, which is exactly why `cd
"$ROOT"` at `:629` is load-bearing). An operator running a quick `SUITE=` spike, told in three
places that subsets never reset, gets eight unannounced DB resets. That is the shared-local-stack
collision hazard, arriving from a documented promise of the opposite.

**Action:** either gate the reset on `[ "$SUBSET" != "1" ]`, or correct all three sentences to
*"cannot fire on a **swept set** shorter than N — a `SUITE=` run still sweeps all 171 and does
reset"*. Correcting the text alone is acceptable; the silent-promise-violation is the finding.

---

### F-MAJOR-3 — `BASE_S_OVERRIDE` is ungated production surface: it can falsify the baseline of a **full** run and that run still writes the committed baseline

**MEASURED**, `c2-command-door-neutralizer.sh:545–548`:

```bash
if [ -n "${BASE_S_OVERRIDE:-}" ]; then
  echo "    ⛔ BASE_S_OVERRIDE set — baseline shape FORCED to '$BASE_S_OVERRIDE'. SELF-TEST ONLY."
  BASE_S="$BASE_S_OVERRIDE"
fi
```

Three measured facts:

1. It is **not** gated on `SELFTEST=1` (the SELFTEST block is separate, `:559`). The block runs on
   any invocation where the variable is set.
2. It does **not** join the SUBSET condition at `:98`
   (`[ -n "$CASES" ] || [ -n "$SUITE" ] || [ "$SELFTEST" = "1" ]`). So a run with no `CASES`, no
   `SUITE` and no `SELFTEST` but with `BASE_S_OVERRIDE` set has `SUBSET=0` and `FINDINGS` pointing
   at the **committed** `docs/reviews/c2-command-door-findings.md`, which `emit` (`:529`) rewrites
   after every enforcer.
3. `BASE_S_OVERRIDE` appears **nowhere in ADR 0189** (`grep -c` = **0**). It is documented only in
   the script header `:44–47` and the record `:265–267`.

This is the harness's own ADR 0153 principle turned against it: `:91–94` says *"Narrowing either
axis makes a run a subset"*, and **falsifying** the baseline axis is a stronger corruption than
narrowing either — yet it is the one axis that does not make a run a subset.

**Mitigations, MEASURED and real:** it prints a loud `⛔ … SELF-TEST ONLY` line, and the damage is
self-limiting — `periodic_reset` re-captures the true `BASE_S` at `:647` without re-applying the
override, so after the first reset the run behaves normally. The record discloses it as
*"new production surface added for testability"*. Nothing here is hidden; it is simply guarded by
a printed warning rather than by an interlock, in a file whose entire thesis is that a warning is
not a guard.

**Action:** add `|| [ -n "${BASE_S_OVERRIDE:-}" ]` to the SUBSET condition at `:98` (one-line, and
strictly the safe direction), or gate the knob on `SELFTEST=1`. Either way, name it in ADR 0189 —
a production knob that can falsify a verdict's stated precondition belongs in the decision record,
not only in a header comment.

---

### F-MAJOR-4 — Two close-condition divergences were satisfied by something better and **not disclosed**, while a sibling divergence in the same unit was disclosed exemplarily

The unit's contract is the hub's own sentence (`docs/features/harness-crash-safety.md`, committed):
*"each on its own `Closes when` clause — quoted there, not paraphrased here. **Nothing else counts
as closure.**"* Two clauses were met by different, better mechanisms without saying so.

**(a) The sentinel FUP's close condition 1 — MEASURED, verbatim from the committed archive:**

> 1. `restore_inflight` verifies the restore before clearing the sentinel — check `psql_f`'s exit
>    status, and re-verify the function's **body hash against `$INFLIGHT.body`** — and leaves
>    `$INFLIGHT` **intact** on any failure so the next run replays it.

What was built compares `md5(pg_get_functiondef(oid))` read **from the catalog** against
`$INFLIGHT.md5` (also captured from the catalog). It never hashes `$INFLIGHT.body` — and ADR 0189
D1 `:80–81` explains exactly why not: *"The probe never hashes the local restore file: that file is
what we are trying to apply, so comparing it against itself proves nothing about the database."*
So the author **recognised** that the filed wording names the vacuous form, rejected it in the
ADR, and left the clause unstruck and ticked `[x]`. Close condition 2 of the *same sentence* got a
full dated `**Amended 2026-09-04 (F1)**` block; clause 1 got one on its exit-status half (the
`ON_ERROR_STOP` vacuity) but nothing on its body-hash half.

**(b) `Closes when: PO to rule` — MEASURED** from `git diff main...6b6aee64 -- docs/followups/follow-ups-open.md`.
The register rows for `FUP-AUTHZ-HARNESS-PRECONDITIONS` and
`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` both read literally
`**Closes when:** PO to rule`, and neither closure note records a PO ruling. The substantive
conditions the unit actually satisfied came from the **body files** (*"The fix (filed, NOT built)…"*,
*"What would close it…"*), and those it satisfied with strong, measured evidence.

**Judgement — INFERRED.** `PO to rule` is a documented legal placeholder (CLAUDE.md §7: *"`PO to
rule` is a legal value"*) left by a bulk consolidation — both rows also carry the consolidation
signature *"Severity: … — per emoji at consolidation"*. Reading it as "the PO must personally rule"
would be over-literal, and substituting the body's real condition was the right call. **The gap is
disclosure, not substance.** Because the unit closed the *fourth* follow-up explicitly on a quoted
PO ruling, a reader comparing the four will reasonably infer all four `Closes when` clauses were
substantive. Two were placeholders.

**Action:** strike the `$INFLIGHT.body` phrase with a one-sentence dated note pointing at D1, the
way clause 2 was handled; and add one line to each of the two closure notes saying the register
field was the `PO to rule` placeholder and the body's condition was used instead.

---

## 3. Findings — RECOMMENDED

**F-REC-1 — The two preflight arms fail OPEN where the restore fails CLOSED.** MEASURED: `psql_c`
(`:72`) carries **no** `ON_ERROR_STOP`, and `preflight_degenerate` (`:210–221`) assigns
`d="$(psql_c …)"` then tests `[ "${d:-0}" != "0" ]` — a query that errors yields `d=""`, defaults
to `0`, and the arm **returns 0 (pass)**. `preflight_residue` (`:347–353`) has the same shape:
empty output prints `arm 4a: 0 residue shapes`. This is precisely the asymmetry D1 forbids for the
restore (*"an escape hatch for the unmeasurable would also silence the measured"*), applied in the
opposite direction two functions away. Practical exposure is low — a total DB failure aborts at
`derive_worklist` (`:298`) anyway — but the arms would print a reassuring zero first. Fix: assert
the output is a non-empty integer, or put `ON_ERROR_STOP` on `psql_c` too.

**F-REC-2 — A load-bearing suite-shape figure disagrees with itself inside this unit.** MEASURED:
C2 header `:52` records *"measured 2026-09-04: 11 suite runs in 19m05s wall, Files=262
**Tests=8764**"*, while the record's own gate table `:334` and every proof banner read
`Files=262, **Tests=8876**` — same date, same `Files`, and the record `:334` states *"⭐ The shape
did not move … no `.sql` was added under `supabase/tests/`"*, so both cannot describe this tree.
Repo-wide, `Tests=8764` appears in `c2-tier1.md` / `c2-suite-abort-diagnosis.md` / this script;
`Tests=8876` in `harness-crash-safety.md` / `follow-ups-archive.md` / `c2-tier1-closure-review.md`.
⚠ I **could not determine** which is correct without running `test:db`. The irony is worth fixing:
the stale figure sits inside the paragraph warning that this figure *"has been stale twice"*. The
timing conclusion (~100 s/run, ~9.5 h) derives from wall time and is unaffected.

**F-REC-3 — A report note that can be false by the time it is read.** MEASURED: when
`restore_inflight` fails inside `sweep_one`, the row records *"the gate is left OPEN and the
sentinel is KEPT"* (`:688`) and the run `exit 2`s (`:752`) — which fires the EXIT trap (`:165`),
calling `restore_inflight` a **second** time. A transient first failure that succeeds on retry
legitimately clears the sentinel, leaving the committed row asserting a state that no longer
holds. The retry itself is desirable; only the note goes stale. Suggest the note say *"kept unless
the exit-trap retry verifies"*.

**F-REC-4 — The register entry (and with it the `Closes when:` field) is deleted rather than
archived.** MEASURED: `follow-ups-open.md:85–86` says *"**Resolved** → move the whole entry — and
its body file, if it has one — **verbatim**"*. All three closures moved the **body** verbatim
(M18/M19) but deleted the entry block, so the `Closes when:` field the hub names as the audit
contract survives only in git history. ⚠ **Not attributable to this unit**: the whole 8807-line
committed archive contains just **3** register-style `**Closes when:**` lines across hundreds of
closures, so this is longstanding practice. Raised as a register-procedure follow-up, not a
defect of this unit.

---

## 4. Could not verify — this is a work item, not a footnote

1. **`npm run test:db` — not re-run** (write access to the local stack is out of my scope). The
   record's evidence is high quality: `Files=262, Tests=8876, Result: PASS`, 87 s wall, on a fresh
   reset, with the shape explicitly compared to the pre-change baseline. **Unresolved:** F-REC-2's
   `8764`/`8876` conflict. One `npm run test:db` settles it.
2. **`supabase db reset --local` and the four authz arms — not re-run.** The record names what each
   arm **enumerated**, not merely that it exited 0 (census 581 gates/625 verdicts; hat 7/7 + 4
   allowlisted; floor 63; wrapper BLIND 41) — which is the discipline
   `.claude/rules/authz-gate-results-need-a-current-baseline.md` demands. Evidence quality: high.
   ⚠ I cannot confirm the arms ran on a **fresh** reset relative to the plants; the record says the
   gate reset preceded the suite.
3. **No harness was run** (prohibited, and correctly so). Every harness behaviour above is derived
   from the script text plus read-only catalog queries.
4. **Arm 4b's `NOT RUN` branch remains unproven** — the unit says so itself (record `:352–355`,
   hub Blockers). I confirmed the code path exists (M11) and reasoned it fails to `NOT RUN` rather
   than to "clean". It is two `echo` lines. **INFERRED, not measured.** Note it *is* provable
   without touching the repo: run with `C2_WORKLIST_BASELINE` and a `WORK` pointing at empty
   scratch **and** `C2_FINDINGS`-equivalent redirection — but the committed path is hard-coded at
   `:97`, so today it genuinely requires a source change. Worth a one-line
   `C2_FINDINGS_COMMITTED="${…:-$ROOT/docs/reviews/…}"` override to make it testable.
5. **The full 171-enforcer sweep was never run** (record `:356`). All proofs are `CASES=`- or
   `SUITE=`-narrowed. So the *end-to-end* behaviour of `RESET_EVERY=20` across 8 real resets and
   ~9.5 h is **projected, not measured** — the ≈ +28 min / +5 % figure is arithmetic over measured
   components (49 s reset + 60 s derivation + 100 s baseline), which is sound, but F-MAJOR-2 is a
   direct consequence of nobody having watched a long run.
6. **The concurrent `backend` commit had not landed** at review time — see §5.

---

## 5. To re-check after the in-flight `backend` commit lands

At `6b6aee64` the working tree already carried **uncommitted** modifications to six files
(`git status`: `M` on ADR 0189, the hub, the record, both follow-up registers; `D` on
`FUP-AUTHZ-HARNESS-TRANSACTIONAL.md`). Nothing in §1–§3 depends on them — all doc findings were
re-derived with `git show 6b6aee64:`. Re-check, in order:

1. **The three-way status consistency** I retracted in §0: hub, ADR 0189 D7 and the record must
   all read the same way on `FUP-AUTHZ-HARNESS-TRANSACTIONAL` once the commit lands. At `6b6aee64`
   they consistently say **open**; the in-flight tree says **closed by PO ruling**. Verify D7's
   text is rewritten, not merely appended beside its "stays open" sentence.
2. **No id in two registers.** The archive header says *"⛔ no id may sit in both files at once,
   and `lint:progress` reds if one does."* The in-flight tree has `FUP-AUTHZ-HARNESS-TRANSACTIONAL`
   in **both** `follow-ups-open.md` (as an expanded `Status: open` row) and
   `follow-ups-archive.md` (as RESOLVED). This must resolve to one. **Re-run `npm run lint` bare
   after the commit** — my rc 0 was measured against `6b6aee64`, not against that tree.
3. **The PO ruling is quoted verbatim**, with its stated re-open trigger (*"a harness ever run
   against a database with more than one owner"*) carried on the archived entry — the standard the
   unit itself set.
4. **The cost figure.** The in-flight ADR reportedly replaces the +40 min/7 % estimate with the
   measured ≈ +28 min/+5 %. Confirm the ADR and the C2 header agree with the record, and that
   F-REC-2's `Tests=` conflict was not propagated.
5. **The hub's amendment**, if it lands: the in-flight hub adds a `~~strikethrough~~` plus an
   amendment paragraph for close condition 2. **F-MAJOR-4(a) still stands after it** — I read that
   version and its `body hash against $INFLIGHT.body` clause remains unstruck.
6. **`adrs:` frontmatter** lists `"0184"`, which ADR 0189's header does not reference and the
   record's `Decisions:` line omits. Cosmetic; confirm it is intentional.
7. **Ratchets may only go down.** Mine measured `140/147, 131/135, 93/97, 52/52`.

---

## 6. Disposition for the PO

**What this unit proves.** A killed mutation harness can no longer leave an authorization gate open
*silently*. In all three sentinel-bearing harnesses a restore is believed only when the **catalog
agrees** — psql `rc=0` **and** a live `md5(pg_get_functiondef)` / policy-expression probe equal to
a value captured from the catalog *before* the mutation — and any other outcome, including "the
sidecars are missing so I cannot check", **keeps** the sentinel and returns 2; the next run then
refuses to start. That chain is real only because `ON_ERROR_STOP=1` was added first, which the unit
found and proved with a bare exit code (`select 1/0;` → 0 before, 3 after). The preflight gained an
arm for this harness's own residue shape, chosen against a measured clean-tree population rather
than assumed, with an allowlist explicitly rejected. Every detector was fired on a planted strand
with the exit code and message recorded and a clean-tree negative control beside it — including
against the incident's actual signal, a job-tree SIGTERM. And it did all of this **without touching
one line of production code**: `git diff main...6b6aee64 -- supabase/migrations supabase/seed.sql
src` is empty, measured twice. The documentation discipline is the best I have reviewed on this
project — the amended close condition is kept verbatim with a dated amendment beside it, the retired
rule is byte-identical in the archive, and the record volunteers its own dead ends, including a
matcher bug that *read exactly like a live defect*.

**What it explicitly does not prove.** Nothing here makes a harness **self-healing**: process death
can still leave a gate open, and the guarantee is only that it cannot do so unnoticed —
`FUP-AUTHZ-HARNESS-TRANSACTIONAL`'s residual is a PO decision, not a built mechanism.
`p0-authz-invoker-audit.sh` and `p0-authz-rowdoor-audit.sh` have **no sentinel at all** and are
untouched — correctly scoped out and filed, but a kill during either of those still leaves an open
gate with no record anywhere. Arm 4b's `NOT RUN` branch is two unexercised `echo` lines. **No full
sweep was ever run**, so the long-run behaviour is projected from measured parts. And I add one
the unit did not know: arm 4a is blind to exactly one of the 439 strandable functions, and it is
one of the 171 (F-MAJOR-1).

**Is it safe to run the full sweeps Batches 1–3 need?** **Yes** — that is precisely what it makes
safe, and the residual risk is now recorded rather than silent. Two conditions I would attach, both
cheap: fix **F-MAJOR-1** (a one-expression change, measured to take the blind spot 1→0 with no
clean-tree false positive) so the third layer is whole before a 9.5-hour unattended run, and settle
**F-MAJOR-2** before anyone runs a `SUITE=` spike expecting no database reset — eight unannounced
`supabase db reset --local` calls on a machine that measurably has a second stack up is the
shared-local-stack collision this project has already been bitten by. **F-MAJOR-3** and
**F-MAJOR-4** are hygiene: fix them at the Record step, not before the sweeps. None of the four
blocks approval, and none is an RLS, immutability or PHI-isolation hole — there is no production
surface in this unit to hold one.

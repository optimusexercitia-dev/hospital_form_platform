# PRED-DOMAIN — progress record

Door-audit domain: pre-AE5 remediation Batch 2. The unit's **summary** is its hub,
[docs/features/pred-domain.md](../features/pred-domain.md) § Current state; this file is its
**log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/p0-authz-door-audit.sh` (`PRED_DOMAIN`, the read arm's
`FOR ALL` handling, the §7.15 shape classifier), the committed baseline
`docs/reviews/authz-door-audit-findings.md` (re-earned through `scripts/lib/merge-findings-baseline.sh`),
`supabase/tests/mutation/act-hat-blind-sweep.sh:18` (stale domain sentence), and — if the ruling is
"targeted cases" — a committed, scheduled home for them (`ae3-targeted-cases.sh` is the precedent).
Decisions: ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (a green arm
bounds its own domain; hazard 4), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
§4 (the `PRED_DOMAIN` bound routed to C2 — selection is the success criterion),
[0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) (the set-valued resolvers),
[0184](../decisions/0184-c2-sweep-runs-against-the-current-branch-schema.md) point 4 + [0187](../decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md)
D1 (the uncovered populations a gate record must state — trigger enforcers are the fourth),
[0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
(the deriver lifts the domain; the merge).

## Session log

### 2026-09-05 — unit opened (lead)

**Why now.** Batch 2 of the pre-AE5 batches ruled 2026-09-04. AE5's eleven per-role increments
re-key enforcement sites onto the `authz.*` resolvers — and today those resolvers are the population
the door-audit arm structurally cannot select: `authz.scope_reaches` and
`authz.candidate_has_permission` match neither the name nor the identity regex (35 `prosecdef`
booleans sit outside `PRED_DOMAIN`, 33 of them legitimately); `authz.authorized_scope_ids`,
`authz.candidate_authorized_scope_ids` and `app.current_professional_read_organizations` are
excluded by `t.typname = 'bool'` before any regex runs. Batches 0 and 1 made this batch safe to
run: the harness is crash-safe and the full run's merge preserves the baseline's hand-authored
material — this is the **first** real full run through that merge.

**Scope.** Five follow-ups (hub § Acceptance criteria) plus two carry-ins from Batch 1 (the
targeted case `9a4bbd22`'s door owes; `act-hat-blind-sweep.sh:18`). Explicitly NOT: the write-arm
33-of-107 re-baseline and `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3 — its full
writepath run also goes through the merge, after this unit proves it on the door file); any change
to a production function, policy or migration; Tier 2's 190 doors (deferred by ADR 0171, **not**
cleared — every gate record citing the sweep says so).

**Facts at open** (from the follow-up bodies; every figure to be re-measured by the builder on a
fresh reset — the catalog has moved since each was filed):
- `PRED_DOMAIN` = `prosecdef` ∧ `typname='bool'` ∧ (name `^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)`
  ∨ identity regex over comment-stripped `prosrc`) ∨ `proname = 'assert_not_case_excluded'`,
  minus `PRED_SIDE_EFFECTING`; the deriver lifts it verbatim (ADR 0190), so a widening here
  changes the deriver's tier-2 set with no deriver edit.
- `scope_reaches` holds a hand-run targeted verdict (2026-09-02: 10 suites / 29 assertions
  noticed) — one function, once, outside any arm; `candidate_has_permission` holds **no** verdict.
- The three `SETOF uuid` resolvers hold hand-run targeted verdicts from the ADR 0182 increment;
  only `current_professional_read_organizations` has `authenticated` EXECUTE (census-domain); the
  two `authz.*` set resolvers hold EXECUTE for no application role (pgTAP 401 §18.1).
- Read arm bounds `polcmd in ('r','*')` and opens both halves of a `FOR ALL` policy at once
  (`p0-authz-door-audit.sh` ~`:807` when filed).
- `app.event_current_custodian` → ERROR because `140_patient_safety.sql` test 11 fails and the
  file ABORTS (`Bad plan. You planned 35 tests but ran 11`); §7.15 withholds the verdict.
- `app.guard_interview_status` (a trigger) delivers `HC038` on the fixture the suite uses; the
  trigger is in 0 of the 171 because a trigger has no call edge.
- The door baseline carries 399 verdict rows and 37 hand-annotated column-5 notes; a real full run
  lands 2 ≤ n ≤ 26 of them in `CARRIED` (QA measurement, Batch 1).

**Branch:** `authz-pred-domain` off `main` @ `bbda5392`.

### 2026-09-05 — backend: plan + build

Plan APPROVED by the lead with five rulings (PO Q1 work-list follow-up · PO Q3 bound accepted ·
Q2 CARRIED deferred until enumerated · Q4 literal `n.nspname='authz'` · Q5 direction column
deferred). Build order = the plan's own sequence 1 → 11; this session builds 1 → 10 and STOPS
to return the CARRIED enumeration.

#### Step 1 — fresh reset, §1 re-measured on the live catalog

`supabase db reset --local` → **rc 0** (bare, `${PIPESTATUS[0]}`), last line
`Finished supabase db reset on branch authz-pred-domain.` Every §1 figure re-measured against
`supabase_db_azkbbhskturikxpgmafq` (⚠ an unrelated `escalume` stack is also up — every query
below names the container explicitly). **Every figure reproduced exactly**; nothing in §1 had
moved since the plan was written:

| figure | plan | re-measured 2026-09-05 |
| --- | --- | --- |
| `PRED_TOTAL` | 125 | **125** |
| `PRED_OUT` | 37 | **37** |
| `POL_TOTAL` | 226 = 164 SELECT + 62 ALL | **226 = 164 SELECT (`has_wc=f`) + 62 ALL (`has_wc=t`)** |
| skipped `qual='true'` | 10 | **10** |
| `prosecdef` bool in `authz` | 4 (2 in, 2 out) | **4** — `has_permission` IN by name, `holds_role` IN by identity, `candidate_has_permission` + `scope_reaches` OUT (both `by_name=f by_identity=f`) |
| `prosecdef` `SETOF uuid` in app/public/authz | 5 | **5** — the FUP's 3 + `app.eligible_voters` (`authenticated` EXECUTE **t**) + `app.person_authority_orgs` (**f**) |
| `prosecdef` trigger fns / wired triggers | 174 / 268 | **174 / 268** |
| baseline verdict rows / unique keys | 399 / 392 | **399 / 392** |
| baseline verdicts | 302 COVERED / 68 BLIND / 29 ERROR | **302 / 68 / 29** |
| baseline `(ALL)` rows | 64 = 51 C / 11 B / 2 E | **64 = 51 COVERED / 11 BLIND / 2 ERROR** |
| baseline keys absent from live domain | 41 | **41** |
| live keys absent from baseline | 0 | **0** (351 live = 125 + 226) |

⭐ **`POL_TOTAL`'s split is load-bearing for 2C and was the first thing checked**: all **62** ALL
policies carry a non-null `polwithcheck`. Had any ALL policy had `polwithcheck IS NULL`, Postgres
would fall back to `qual` for the check and `using (true)` alone would have opened the write half
anyway — the mirror fix would have been vacuous for exactly those policies. Enumerated, not assumed.

⭐ **Q4 SETTLED BY MEASUREMENT — and the plan's premise was wrong in the safe direction.** The plan
flagged `!~ '^is_valid_'` as "NEW in the hunk". It is **not new**: it is already at
`p0-authz-door-audit.sh:501`, and ADR 0079 Amendment 9 records the pre-existing domain as
`^(is_|can_|has_|…)` "minus `^is_valid_`". Its effect today, measured:

```
--- is_valid_ prosecdef booleans ---
 ?column? | by_identity
----------+-------------
(0 rows)
```

**Zero subjects** — the clause is INERT on this catalog, so it cannot silently narrow the widening.
Kept (dropping it would edit a bound ADR 0079 recorded, for no measured effect) and recorded as
measured-inert rather than justified by argument.

Baseline fingerprints snapshotted BEFORE any work (the full run's precondition):
`cksum` = `1895535637 131621`, `md5` = `2ef469cabceff65e3f291e2a3054972f`, 924 lines,
401 `| `-leading lines − 2 table headers = 399 verdict rows.

⚠ Suite-cost correction for the hub: the hub's "~5–9 h" is ADR 0079 Amendment 1's **2026-08-04**
figure and does not describe this catalog. The full run's projection is re-derived at step 8 from a
measured merge wall-clock and a measured suite time, not quoted.

#### Step 2 — `NOTICED`, the fourth classifier outcome, and its SELFTEST arm

`p0-authz-door-audit.sh` `classify()` (§7.15c): a shape move now branches on the parsed
`Result:` — `FAIL` → `NOTICED`, anything else → `ERROR`. `COVERED` is computed as the residual at
the report line, so `noticed_ct` is subtracted there too (a fourth outcome must not inflate
COVERED by arithmetic after being kept out of it by logic).

`SELFTEST=1 bash supabase/tests/mutation/p0-authz-door-audit.sh` — six constructed strings, no DB:

```
=== SELFTEST: classify() — four outcomes on constructed strings (no DB) ===
  ok    same shape + FAIL                  -> COVERED  (files=262 tests=8876)
  ok    same shape + PASS                  -> BLIND    (files=262 tests=8876)
  ok    shape MOVED + FAIL                 -> NOTICED  (files=262 tests=8712)
  ok    shape MOVED + PASS                 -> ERROR    (files=262 tests=8712)
  ok    Dubious only + FAIL                -> NOTICED  (files=262 tests=8876)
  ok    no Result: line                    -> ERROR    (files=262 tests=8876)
--- SELFTEST classify: 6/6 ok, 0 failed ---
BARE_RC=0
```

⭐ **6/6 green on a first run is a FINDING, not a pass**, so two controls were run before the arm
was believed:

*(i) the INSTRUMENT proven able to fail* — one expectation flipped to `COVERED` in a scratch copy
(`cmp`-verified that the mutation landed):

```
  NOT OK shape MOVED + FAIL                -> NOTICED  (expected COVERED)
--- SELFTEST classify: 5/6 ok, 1 failed ---
BARE_RC=1
```

*(ii) the PRE-CHANGE classifier over the IDENTICAL strings* — the old branch restored by an
exact-match replace that asserted `count == 1`:

```
  NOT OK shape MOVED + FAIL                -> ERROR    (expected NOTICED)
  NOT OK Dubious only + FAIL               -> ERROR    (expected NOTICED)
--- SELFTEST classify: 4/6 ok, 2 failed ---
BARE_RC=1
```

⭐ That is the selection delta on the classifier itself: **exactly the two (shape-moved ∧ FAIL)
cells moved**, and the `(shape-moved ∧ PASS)` control did **not** — which is what separates a new
outcome from a rename of `ERROR`.

#### Step 3 — the live plant: `app.event_current_custodian`

`CASES=event_current_custodian`, own `WORK=/tmp/pd-s3` and own sentinel, **detached** (PowerShell
`Start-Process` on `C:\Program Files\Git\bin\bash.exe` with the runner as **argv[1]**, output
redirected and polled — never `-c`, never under a tool timeout).

```
baseline OK: Result: PASS, Files=262, Tests=8876
=== PREDICATE ARM (domain: 1 selected of 127) ===
  NOTICED  app.event_current_custodian(p_event_id uuid, p_user_id uuid)
ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35
    POLICY ARM HALF: `using` ONLY — a COVERED on a FOR ALL policy is a READ-half claim.
SWEPT: 1 gate(s)   COVERED: 0   BLIND: 0   NOTICED: 1   ERROR(harness): 0
=== RESULT: DIRTY — 0 BLIND, 1 NOTICED, 0 ERROR. …
    committed baseline VERIFIED unchanged (cksum): …/authz-door-audit-findings.md
STEP3_BARE_RC=1
```

⭐ **The before/after is on the IDENTICAL runlog, not on two runs.** Both `classify` definitions
were extracted **verbatim** from production text (`sed -n '/^classify () {/,/^}$/p'`, `bash -n`
checked — HEAD via `git show`, new from the working tree), sourced, and applied to the one
26 360-line runlog the plant produced:

```
  HEAD classifier -> ERROR  |Files=262|Tests=8844|failing=140_patient_safety.sql,409_ae49_d6_rekey_differential.sql
  NEW  classifier -> NOTICED|Files=262|Tests=8844|failing=140_patient_safety.sql,409_ae49_d6_rekey_differential.sql
```

This is a **deviation from the plan's "2 × ~4 min"** and a deliberate one: one measurement fed to
two classifiers removes the confound of two different runs, and costs one suite run instead of two.

The abort is confirmed in the log, and ⚠ **the follow-up's figures have moved** — `140` now plans
**43** tests, not 35, and the shape moves `Tests=8876 → 8844` (exactly the 32 that did not run):

```
# Failed test 11: "a non-custodian reporting member cannot acknowledge (HC044)"
Dubious, test returned 3 (wstat 768, 0x300)
  Parse errors: Bad plan.  You planned 43 tests but ran 11.
Files=262, Tests=8844, 99 wallclock secs
Result: FAIL
```

⛔ **A DEFECT IN MY OWN ADDITION, found by reading the output instead of the verdict.** The
recorded note says `aborting file(s): <none parsed>`. My `SHAPEFILES` scrape took the basename off
the `Dubious` line — and in **this** prove output the `Dubious` line carries no filename (line
2235; the path is on line 2231 above it). *A count is only as true as the instrument named beside
it*, and here the instrument was mine and three hours old. The reliable source is the **Test
Summary Report**: a `.sql (Wstat: …)` line whose indented block carries `Parse errors:` or
`Non-zero exit status:`. Fixed after this run finished (⛔ never edit a script a detached job is
executing) and re-proven on the same runlog.

#### Step 8 (measured EARLY, because it changes the step-9 window) — the merge wall-clock

The plan budgeted **15 s per merge × 353 = +1.5 h**. Measured on the real committed baseline
(924 lines / 401 row lines), three runs, bare rc each time:

```
  run 1: bare rc=0  wall=1574 ms
  run 2: bare rc=0  wall=1337 ms
  run 3: bare rc=0  wall=1430 ms
```

⇒ **~1.5 s**, so 353 emits ≈ **9 minutes**, not 1.5 h. The plan's figure was an estimate and is
corrected here. Negative control in the same command — `merge(b, b)` must equal `b`:

```
MERGE: merged into … — 401 row line(s); PRESERVED 0 hand-authored prose line(s), 0 hand suffix(es); CARRIED 0 whole row(s).
--- merge(b,b) == b ? --- IDENTICAL (cmp rc=0)
--- committed baseline untouched? --- 2ef469cabceff65e3f291e2a3054972f
```

⛔ **The `SHAPEFILES` fix, and its re-proof on the SAME runlog** (applied only after the detached
job had finished with the script — never edit a script a detached job is executing):

```
=== FIXED classifier over the SAME step-3 runlog ===
VERDICT=NOTICED
SHAPEFILES=140_patient_safety.sql
FAILING=140_patient_safety.sql,409_ae49_d6_rekey_differential.sql
```

Three properties, each observed: it **names** the aborting file; it does **not** name
`409_ae49_d6_rekey_differential.sql`, which merely failed an assertion (the discrimination half);
and on a log with no `Test Summary Report` it yields **empty** rather than a wrong name:

```
=== NEGATIVE CONTROL: a log with NO Test Summary Report ===
VERDICT=NOTICED  SHAPEFILES=''
```

#### Step 4 — the widening (2B axis 1), proven by SELECTION

`PRED_DOMAIN` gains one literal disjunct, `n.nspname = 'authz'`, INSIDE the `t.typname='bool'`
bound. Selection proof run through **the real script's own worklist queries** at HEAD and at the
widened text (`CASES=__no_such_gate__`, which writes the worklists and then exits 3 before any
suite run — so the comparison costs nothing and mutates nothing). Both runs `BARE_RC=3`:

```
BEFORE  ARM-DOMAIN predicate=0/125 policy=0/226
AFTER   ARM-DOMAIN predicate=0/127 policy=0/226
```

| set | result |
| --- | --- |
| `PRED_TOTAL` | 125 → **127** |
| `PRED_OUT` | 37 → **35** |
| **delta** (after ∖ before) | `authz.candidate_has_permission(…)`, `authz.scope_reaches(…)` — **and nothing else** |
| **reverse delta** (before ∖ after) | **0 rows** |
| census: removed by the widening | **the same two**, and only those |
| census: newly OUTSIDE | **0 rows** |
| the 35 legitimately-outside | **35, all still present** (`comm -12` = 35) |
| policy worklist | `cmp` **IDENTICAL rc=0** |
| direction assigned to both newcomers | `positive` / `sql` ⇒ `select true`, which type-checks against `bool` |

⭐ The `bool` bound is what keeps the neutralization model unchanged, and it is measured: of the
**10** `prosecdef` functions in `authz`, only **4** are boolean. An unbounded `n.nspname='authz'`
would admit `assignment_facts` (record), `authorized_scope_ids` + `candidate_authorized_scope_ids`
(SETOF uuid), `entailed_grants` (record), `explain_permission` (permission_explanation) and
`rebuild_implication_closure` (int4) — all classified `positive`, all neutralized to `select true`,
all type errors: **6 guaranteed ERROR rows**.

**The deriver's lift survives** (ADR 0190 — a widening here needs no deriver change):
`SELFTEST=1 bash scripts/door-sweep-cases.sh` → `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`,
**`BARE_RC=0`** (read bare, on its own line — the piped run was discarded). The domain is now a
**10**-line block and `lift_block` reads it whole; the three explicit substitutions still cover it,
so the `*'$'*` ABORT arm does not fire.

#### Step 5 — the two newcomers' verdicts (the first for one of them)

`CASES="scope_reaches candidate_has_permission"`, detached, own `WORK`/sentinel:

```
baseline OK: Result: PASS, Files=262, Tests=8876
=== PREDICATE ARM (domain: 2 selected of 127) ===
  COVERED  authz.candidate_has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
  COVERED  authz.scope_reaches(p_assignment_kind text, p_assignment_id uuid, p_resolution_kind text, p_requested_id uuid)
SWEPT: 2 gate(s)   COVERED: 2   BLIND: 0   NOTICED: 0   ERROR(harness): 0
=== RESULT: CLEAN — 2 gate(s) measured, all COVERED. ===
    committed baseline VERIFIED unchanged (cksum): …/authz-door-audit-findings.md
STEP5_BARE_RC=0
```

⭐ `authz.candidate_has_permission` holds a verdict **for the first time, from an arm** — the
follow-up's central obligation. The plan PREDICTED COVERED (pgTAP 403 §6 / 407 §6 mutate these
subjects); the prediction is now a measurement. ⚠ Recorded **at this suite shape**
(`Files=262, Tests=8876`): a verdict at one shape is not a verdict at another.
⭐ The same command before the widening returned `REQUESTED BUT NEVER SWEPT (matched no gate)` and
exit **3 UNPROVEN** — that contrast is the follow-up's own measurement, now inverted.

#### Bookkeeping — and a SEQUENCING correction to the plan

The plan required removing the two `authz-unswept-backlog.txt` entries (`:796`, `:841`) "in the
same change, else `ARM=census` double-accounts them". **Measured, the removal must come LATER, not
now**, and the reason is in the invariant script: `census_proc_domain`
(`p0-authz-invariant.sh:459`) admits **every** `prosecdef` boolean in app/public/authz, so both
functions are in ARM 3's live domain **today** and are ACCOUNTED *only* by these backlog entries.
Deleting them before the re-baselined findings file carries their verdicts would make `ARM=census`
**red with 2 unaccounted gates** — the opposite failure to the one the plan was guarding against
(double-accounting in a union is harmless to census's verdict; it is a stale *record*, which is
residual §7.2's class).

So the blocks are **annotated now** with the resolution, the first verdict, and an explicit
⛔ *"the line below is deleted in the commit that carries the re-baselined findings file, and not
before"*; the two name lines stay until then, where they are still TRUE.

#### `act-hat-blind-sweep.sh:18` — corrected against the catalog query, not memory

`:195` executes `n.nspname in ('app','public','authz')`; the METHOD paragraph said "app+public".
⭐ It is the **mirror** of the usual defect and reads as care: a sentence that UNDERSTATES the
executed domain invites a reader to conclude the `authz` schema is unswept here when it is not.

#### The targeted-case home (2B axis 2) — `supabase/tests/mutation/authz-setvalued-targeted-cases.sh`

New harness, modelled on `ae3-targeted-cases.sh`, with the p0 siblings' 2026-09-04 verified-restore
sentinel (`authz-setvalued-INFLIGHT.sql` + `.probe`/`.want`, `RECOVER=1`) and the door arm's
four-outcome classifier, so a verdict from here is comparable with one from there.

⛔ **The scope is an explicit list of 3, and the follow-up's own proposed property is CORRECTED by
measurement.** "A scope-id set consumed by a policy" selects exactly **1** of the 3 — only
`app.current_professional_read_organizations` is named by an RLS policy
(`professional_profiles_select`); the two `authz.*` resolvers are reached **transitively**, through
it (`app.current_professional_read_organizations` calls `authz.authorized_scope_ids`;
`authz.candidate_authorized_scope_ids` has **zero** callers in any app/public/authz body). So the
list is written down and its **cardinality** is asserted instead (§4b), with the 2 out-of-scope
functions named with their dispositions.

**§4a — the residue arm, proven in both directions on the same run:**

```
--- §4a preflight: no set-valued resolver is already sitting on a universal set ---
    clean — 0 residue rows
--- §4b: the live set-valued population is exactly the 5 this file rules on ---
    ok — 5 live, 3 in scope, 2 out of scope with a recorded disposition
```

and then, **while the mutation is live** (a real strand, not a knob or a fixture):

```
  fingerprint before : 7e82cd4e9ef62edffede45520154c5e2
  fingerprint mutated: f3ddbcf62e5f3e9e724b4c3721847864
  §4a while the mutation is LIVE:
      authz.authorized_scope_ids(p_principal uuid, p_resolution_kind text, p_permission_code text)
```

A detector that finds nothing must be proven able to find something; this one is proven on **every**
run, because the harness ABORTS if §4a fails to name the function it has just mutated. The
vocabulary was calibrated by measurement in both directions before it was used: all **5** live
subjects match it (so 0 on a clean tree is not an artefact of a too-narrow regex), and **both**
neutralization bodies match none of it (so it fires). The bare words `role` and `grant` were dropped
— a vocabulary matching everything is a detector that finds nothing, spelled backwards.

⛔ **THREE FAILED NEUTRALIZERS, AND EACH FAILURE WAS THE SAME MISTAKE ONE SIZE SMALLER.** Recorded
because the harness's *contract* is what the run actually proved:

| attempt | what Postgres said | why |
| --- | --- | --- |
| v1 — `printf`-built `DO` block with a dollar-tag regex | `ERROR: SETVALUED-HARNESS: no dollar-body tag for oid …` (×3) | the shell mangled the backslashes — the exact trap the door harness's own template warns about ("an unquoted heredoc mangles the backslashes"), re-created one file over |
| v2 — quoted heredocs, `DO` block, inner `$svbody$` tag | `ERROR: unterminated dollar-quoted string at or near "$$svbody$` (×3) | nested dollar-quoting inside `do $sv$ … $sv$` |
| v3 — **no `DO` block, no nesting, no regex** | applies, rc 0 | the definition is ALREADY on disk as `$orig`; take its header through the `AS $tag$` line, append the body, close with the SAME tag — one dollar-quote, at one level, whose tag Postgres itself chose and guaranteed absent from the body |

⭐ **On both failures the harness did exactly what it is for**: it recorded `ERROR` rather than a
verdict, restored all three subjects, and VERIFIED each restore **in the catalog** —

```
  restore VERIFIED against the catalog (psql rc=0, probe=7e82cd4e9ef62edffede45520154c5e2)
  (2) §4a residue: 0 rows
  (3) suite after restore: Result: PASS  (Files=262, Tests=8876)
  (4) sentinel + sidecars: absent
=== RESULT: DIRTY — at least one case is not COVERED. This BLOCKS the phase. ===
SETVALUED_BARE_RC=1
```

A mutation that did not land must never look like a result, and twice it did not.

v3 was then proven OFFLINE against the real captured definition before being run again — generated
statement printed in full, then applied and restored synchronously against the live catalog:

```
before=7e82cd4e9ef62edffede45520154c5e2
APPLY rc=0  out=''
mutated=f1d83ee6451240db6ff06d81e6136afc
RESTORE rc=0  after=7e82cd4e9ef62edffede45520154c5e2
RESTORE VERIFIED (md5 matches the pre-mutation value)
--- degenerate/residue check --- 0
```

**The `DEGENERATE_PREDICATE` marker** (`P0-SETVALUED-NEUTRALIZED`) was added to **both** hand-kept
copies (`p0-authz-door-audit.sh`, `p0-authz-invariant.sh`), so a crash residue of this harness stops
the p0 sweeps the way theirs stop each other. ⚠ Two locks of **different kinds** — the marker is
exact residue detection for what this harness writes; §4a is the property. Neither is the other.

#### Step 8 (extended) — an OFFLINE DRY RUN of the full-run merge, before committing to a 12-hour window

⭐ **Not in the plan, and it is the single most valuable thing this session did.** `emit_body` and
`domain_statement` were extracted **verbatim** from `p0-authz-door-audit.sh`
(`sed -n '/^emit_body () {/,/^}$/p'`, `bash -n` checked) and **sourced** — never retyped — driven
against the real widened worklists and a synthesized **353-row** `progress.tsv` whose verdicts and
notes are taken from the committed baseline (so the dry run UNDER-states CARRIED rather than
inventing moves). Synthesis: `353 rows = 262 COVERED / 63 BLIND / 28 ERROR`, 2 live keys absent from
the baseline (the two newcomers), 7 baseline keys carrying more than one row.

```
generated: 495 lines, 355 row lines
MERGE_BARE_RC=0   wall=4946 ms
MERGE: merged into … — 355 row line(s); PRESERVED 426 hand-authored prose line(s),
       0 hand suffix(es); CARRIED 48 whole row(s).
MERGE: REPLACED 2 baseline line(s) as regenerated statistics (the only legitimate drop):
MERGE:     - Baseline: Files=156, Tests=4796, Result: PASS.
MERGE:     - Policies swept: 214 (real qual). Policies skipped (qual=true, vacuous): 9.
=== committed baseline untouched? === 2ef469cabceff65e3f291e2a3054972f
```

Four things this bought, all of them BEFORE the expensive run:

1. **The merge wall-clock at REAL size is ~5 s, not 1.5 s** — the `merge(b,b)` control was cheap
   because the inputs were identical. 353 emits ⇒ **~29 min** of merge time inside the full run
   (the plan's estimate was +1.5 h).
2. **All 9 `HAND-MERGED` blockquotes and all 7 `## Note` sections survive** (9 → 9, 7 → 7).
3. **The prose cost of my `emit_body` edits is EXACTLY ONE duplicated line**, measured rather than
   feared: the baseline's `## COVERED (asserted-through) + ERROR (harness bug)` heading is preserved
   as hand prose at the second table while the new
   `## COVERED (asserted-through) + NOTICED (suite reddened, shape moved) + ERROR (harness bug)`
   heading is emitted at the first. Nothing is lost; one stale heading is gained. ⚠ It becomes
   PERMANENT cruft on every later run unless deleted by hand — recommended as a one-line edit in
   the same commit that re-files CARRIED. (The domain paragraph did NOT duplicate: the committed
   baseline predates that wording entirely, so there was nothing to preserve.)
4. **A PREDICTED CARRIED set of 48 rows / 45 unique keys**, every one of them
   `(absent from this run)` — i.e. **41 keys genuinely outside the domain + 7 second-ordinal rows**,
   which is exactly the arithmetic §1 measured. Partitioned against the LIVE catalog:

| group | n (keys) | what it is | recommended disposition |
| --- | --- | --- | --- |
| **A** | 4 | the run DID produce this key — these are **second-ordinal** rows (a gate swept in two passes left two baseline rows): `app.can_sign_section(…)`, `commissions.commissions_select_member_or_admin (SELECT)`, `hospitals.hospitals_select (SELECT)`, `organizations.organizations_select (SELECT)` | **delete deliberately** — the run emits one authoritative row per key; ⚠ check the duplicate's column 5 for a hand note first |
| **B** | 24 | the SUBJECT NO LONGER EXISTS in the catalog (7 `app.can_*`/`has_role`/`attachment_confidentiality_ok` signatures, `authz.has_direct_permission`, the 9-function DSR family, 4 policies) | **delete deliberately**, EXCEPT the **9** that carry hand prose in column 5 — those are measurement history about a door that is gone, and belong in an archive line, not in a verdict table |
| **C** | 17 | the subject EXISTS but is outside THIS arm's domain: **13** write-side policies (INSERT/UPDATE/DELETE) → the **writepath** arm's file; **3** `prosecdef` set-returning command doors (`app.resolve_document_version_bytes`, `public.commission_cadence_overview`, `public.document_delete_affordances`) → **C2**; **1** (`app.storage_upload_reserved`) is a `prosecdef` boolean sitting in this arm's own §7.17b out-of-domain census (verified: it is one of the 35) | **retire to the named arm** |

⛔ **The real run's CARRIED will be a SUPERSET of these 48.** The dry run gave the generator the
baseline's own notes, so every surviving row took the `identical` branch and **0 hand suffixes** were
spliced. In the real run the failing-file lists have drifted since the baseline was taken, so rows
will additionally SPLICE (hand suffix recovered) or CARRY (verdict or columns moved). The 48 are the
floor, not the estimate. ⚠ And the QA bound quoted at unit open — "2 ≤ n ≤ 26 hand rows" — is about
**hand** rows; it is not a bound on the CARRIED block, which is dominated by the 41 absent keys.

#### The targeted home's verdicts — the FIRST recorded ones for all three resolvers

```
  VERDICT: COVERED  (252_authz_p0_isolation.sql, 311_oversight_readonly_perimeter.sql,
                     321_eth_e4_participant_seating.sql, 409_ae49_d6_rekey_differential.sql,
                     413_ae4_authorized_scope_ids.sql)          <- authz.authorized_scope_ids
  VERDICT: COVERED  (413_ae4_authorized_scope_ids.sql)          <- authz.candidate_authorized_scope_ids
  VERDICT: COVERED  (252, 311, 321, 409, 410_ae49_d5_enforcement_manifest.sql, 413)
                                                                <- app.current_professional_read_organizations
```

⚠ ADR 0182 records NO suite shape and NO verdict tokens for these three, so what they held was
hand-run and un-anchored. These are earned at `Files=262, Tests=8876, PASS`, by a committed harness,
with the reddening files named. ⛔ They are **printed, not written**: the findings file is re-earned
only through the door arm's merge, and filing them is a human step after the CARRIED ruling.

Final block of that run, with the three-way restore verification and the bare exit code:

```
--- restore verification (three ways) ---
  (2) §4a residue: 0 rows
  (3) suite after restore: Result: PASS  (Files=262, Tests=8876)
  (4) sentinel + sidecars: absent
==========================================================================
--- VERDICTS (file these BY HAND into docs/reviews/authz-door-audit-findings.md) ---
ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)
=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ===
SETVALUED_BARE_RC=0
```

⭐ §4a NAMED the mutated function on **each** of the three cases while its mutation was live
(`authz.authorized_scope_ids(…)`, `authz.candidate_authorized_scope_ids(…)`,
`app.current_professional_read_organizations()`), and enumerated to **0 rows** before and after.
That is the detector proven able to find something and proven not to over-find, on the same run.

#### The full-run window, RE-DERIVED from this session's own measurements

⚠ The hub's "~5–9 h" is ADR 0079 Amendment 1's 2026-08-04 figure and does not describe this
catalog; the plan's "~10–12 h + 1.5 h of merges" was an estimate. Both are corrected here from
three measured runs on this reset (wall-clocks from the runners' own file timestamps):

| run | wall | suite runs | s / suite run |
| --- | --- | --- | --- |
| step 3 (`event_current_custodian`) | 18:28:08 → 18:32:11 = 243 s | 2 (baseline + 1 case) | **121** |
| step 5 (two resolvers) | 18:32:11 → 18:37:58 = 347 s | 3 | **116** |
| targeted home (3 resolvers) | 18:48:35 → 18:58:24 = 589 s | 4 + 3 fingerprint/restore cycles | **147** |

⇒ **~120 s per case.** Full run = 1 baseline + **353** cases = 354 suite runs ≈ **11.8 h**, plus
**353 × 4.9 s ≈ 29 min** of merges ⇒ **~12.3 h**. That is the window; it is measured, not quoted.

#### ⛔ A STEP-11 BLOCKER FOUND AT STEP 8 — the re-baseline would RED `ARM=census`

The dry run made one more thing measurable that no part of the plan anticipated. `ARM=census`
reads the door findings file through `verdicts_from_findings` as part of ACCOUNTED. Running that
function (verbatim) over the baseline and over the merged dry-run output:

```
census-readable keys — baseline: 392   merged: 353
lost: 41     gained: 2
```

The 2 gained are the newcomers. Of the **41 lost**, the ones that matter are those still in the
census's own live domain — `census_proc_domain` (`p0-authz-invariant.sh:459`) ∪ every `public`
policy, **581** keys, which is the figure the standing rule anchors at Gate AE4:

- **16 of the 41 are in the census's live domain.**
- **13 of those 16 are accounted by ANOTHER source** — the writepath / rowdoor / invoker findings
  or the allowlists (299 keys).
- ⛔ **3 would become UNACCOUNTED, and `ARM=census` would RED on them:**

| key | what it is | why the door file was its only account |
| --- | --- | --- |
| `app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)` | `prosecdef` **boolean** | it is one of the **35** in this arm's own §7.17b out-of-domain census — in the census's domain, outside the door arm's |
| `public.commission_cadence_overview()` | `prosecdef` set-returning, `authenticated` EXECUTE | C2's command-door class |
| `public.document_delete_affordances(p_document_ids uuid[])` | same | same |

⭐ **This is exactly why the file is not committed before the CARRIED ruling.** Had the run been
launched, merged and committed on the plan's own sequence, step 11's `ARM=census` would have redded
with 3 unaccounted gates AFTER a 12-hour run — and the natural reading of that red ("the widening
broke the census") would have been wrong. The three are a **re-filing** obligation, not a defect:
each needs a home (re-attached to the door file as a historical row, retired to the arm that owns
it, or entered in `authz-unswept-backlog.txt` with its reason), and that is a PO decision under Q2.

#### For the lead — the ONE-LINE lead-playbook §4 sentence the targeted home needs

⛔ Drafted here, **not applied**: `docs/lead-playbook.md` is outside this session's write scope. A
committed home that nothing schedules becomes the thing it was built to replace — cases that run
when someone remembers — so ADR 0191 D3 is incomplete until this line lands.

> **Set-valued authz resolvers** — `bash supabase/tests/mutation/authz-setvalued-targeted-cases.sh`
> (detached, ~10 min, exit code read BARE: 0 CLEAN / 1 DIRTY / 2 ABORT / 3 UNPROVEN) is owed at
> **every phase gate that runs the door sweep**, and additionally whenever a migration creates or
> replaces a `prosecdef` `SETOF uuid` function in `app`/`public`/`authz` — the door arm cannot
> select that family at all (ADR 0191 D3), and the harness's own §4b cardinality control reds if a
> sixth such function appears. Quote its `ARM-DOMAIN setvalued=` line, never the script name.

✅ **LANDED at `376d5717`, and NOT byte-verbatim — noted 2026-09-07 (QA re-review `N4`), beside the
draft rather than by editing it.** After normalising whitespace and the blockquote prefix, the
sentence above and the one now in `docs/lead-playbook.md` §4 differ in **exactly one place**: the
playbook adds `; ADR 0079 hazard 4` after `(ADR 0191 D3`. That is a **correct strengthening** —
hazard 4 is *why* the `SETOF uuid` family is out of the door arm's domain, so the landed line
carries the reason this draft only implied. ⚠ What is false is the word **"verbatim"** in
`376d5717`'s own commit message, which no gate reads; the close condition said "closes by pasting,
not by re-deciding", and pasting-plus-a-reason satisfies it. Recorded because a claim about a
measurement written beside a correct one is this unit's own LEARN-088, and because the closure of
`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` rests on this sentence.

#### Notes carried into step 11 (after the CARRIED ruling)

1. ⛔ **`WORK` must be overridden to the FULL RUN's `WORK` when re-deriving `ARM=policy`** — that
   arm reads `$WORK/blinds.tsv` back as a full-sweep result, so a default `WORK` compares against
   the wrong run (the deriver's own hazard 2). The full run uses `WORK=/tmp/pd-full`.
2. The **three unaccounted keys** above must be re-filed BEFORE `ARM=census` is run, or its red is
   a bookkeeping artefact rather than a finding.
3. The two `authz-unswept-backlog.txt` resolver LINES are deleted in the **same commit** as the
   re-baselined findings file, and not before.
4. The stale `## COVERED (asserted-through) + ERROR (harness bug)` heading the merge preserves is a
   one-line hand deletion in that same commit.
5. `npm run test:db` is already green at this tree in substance — every harness run above captured
   `Result: PASS, Files=262, Tests=8876` from `supabase test db` itself — but it is re-run formally
   at step 11 on a fresh reset.
6. The **diff-scoped door sweep is NOT owed** (this unit changes a harness, not a policy or a
   `prosecdef` gate) — but the deriver is run anyway and its `SCOPE:` line quoted, per the hub's
   acceptance criterion, which asks the record to state which of the two it is.

#### Steps 6–7 — the `using`-only mirror, and its discrimination

The change is ONE line in the policy arm's open, and the BEFORE script was built to differ from the
after script by **exactly that line** — a true single-variable discrimination rather than a
comparison against HEAD (which also lacks `NOTICED` and the widening):

```
1172c1172
<   { echo "alter policy \"$polname\" on public.\"$tbl\" using (true);" ; } > "$WORK/_mut.sql"
---
>   { echo "alter policy \"$polname\" on public.\"$tbl\" using (true)$([ "$has_wc" = "t" ] && echo ' with check (true)');" ; } > "$WORK/_mut.sql"
```

Subset: **6 ALL + 6 SELECT**, all 12 COVERED in the committed baseline, all verified present in the
live worklist with the expected `cmd`/`has_wc`, and all 12 polnames unique across the 226 (so a
`CASES` token cannot select the wrong policy). Both versions run on the SAME fresh reset, detached,
with their own `WORK` and sentinel.

⚠ The before-run's baseline also settles a hazard: the temporary `_tmp_bothhalves_audit.sh` sitting
in `supabase/tests/mutation/` does **not** move the suite shape — `Files=262, Tests=8876` both times
— because `supabase test db` globs `.sql`. Deleted afterwards regardless.

**BEFORE (both halves opened — the pre-change behaviour):**

```
ARM-DOMAIN predicate=0/127 policy=12/226 out-of-domain-bool=35
SWEPT: 12 gate(s)   COVERED: 12   BLIND: 0   NOTICED: 0   ERROR(harness): 0
=== RESULT: CLEAN — 12 gate(s) measured, all COVERED. ===
MIRROR_BEFORE_BARE_RC=0
```

**AFTER (`using` half only), same reset, same 12 cases:**

```
    POLICY ARM HALF: `using` ONLY — a COVERED on a FOR ALL policy is a READ-half claim.
SWEPT: 12 gate(s)   COVERED: 12   BLIND: 0   NOTICED: 0   ERROR(harness): 0
=== RESULT: CLEAN — 12 gate(s) measured, all COVERED. ===
MIRROR_AFTER_BARE_RC=0
```

**The required property HOLDS: no SELECT row moved.** All 6 SELECT verdicts are identical
before/after. ⛔ **And the arm did NOT FIRE on this subset: no ALL row flipped either** — 6/6 ALL
policies stayed COVERED. Saying so plainly, and NOT layering on it: this subset proves the change is
**safe**, it does not prove the change **does anything**. The 12 chosen policies were all COVERED in
the baseline and 6 were `_write`-named ALL policies precisely to maximise the chance of a flip; none
came.

⭐ **So the change was proven to fire by a POSITIVE CONTROL IN THE CATALOG instead** — which is the
stronger evidence anyway, because it does not depend on any keystone's behaviour. Both runs left the
mutation SQL they actually issued in their own `$WORK`, and they differ by exactly the clause under
test:

```
BEFORE: alter policy "case_interview_interviewers_write" on public."case_interview_interviewers" using (true) with check (true);
AFTER : alter policy "case_interview_interviewers_write" on public."case_interview_interviewers" using (true);
```

Each was then applied to the live catalog and the policy READ BACK, with a restore and an md5
verification around each:

| version applied | `pg_get_expr(polqual) \|\| pg_get_expr(polwithcheck)` |
| --- | --- |
| BEFORE (both halves) | `true \|\| true` |
| AFTER (`using` only) | `true \|\| (app.can_write_interview(interview_id, (SELECT auth.uid())) AND (NOT app.is_case_excluded(…)))` |

⇒ the write half is left **CLOSED, at its original predicate**, which is precisely what the fix
claims and what the 12 unchanged verdicts could not show.

⛔ **AN INCIDENT, RECORDED IN FULL BECAUSE THE RESTORE PATH WAS GUESSED.** The first attempt at that
control applied the mutation and then tried to restore from a filename I had **derived by hand**
(`restore_pol_case_interview_interviewers_case_interview_interviewers_write.sql`). The harness's
`slug()` appends one more `_`, so the file did not exist, `psql` said
`No such file or directory`, and the policy was left at `qual = true` on a live stack — caught only
because the same command compared the md5 afterwards and printed `*** RESTORE FAILED`. Restored from
the real file within the minute and verified **three ways**: catalog md5 back to
`902d7a71f33b627774177f93465071cd`; `pg_policies` with `cmd <> 'SELECT'` and a `true` half
**enumerated to zero rows**; degenerate function bodies (all four forms, including the new
`P0-SETVALUED-NEUTRALIZED` marker) **0**. ⭐ The lesson is the harness's own, arrived at from the
other side: **never hand-derive the path of a restore file — list it, or refuse to mutate.** The
second half of the control (the BEFORE version) was run only after asserting `[ -f "$R" ]` first.

#### Gate at the step-8 boundary — bare exit codes, nothing piped

| gate | bare rc | observed |
| --- | --- | --- |
| `npm run lint` (full chain) | **0** | eslint `--max-warnings=0` clean; `check-docs-registers: OK (… 207 follow-ups, 162 follow-up bodies …)`; `build-features-index: OK (9 hubs; index in sync)` |
| ratchets | — | `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=91/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52` — **not raised**: `scripts/check-docs-registers.mjs`, which holds every limit, is unmodified by this unit (`git status` never lists it), and `longHeadings` went **92 → 91** after one over-cap heading of mine was shortened |
| `SELFTEST=1 … p0-authz-door-audit.sh` | **0** | `SELFTEST classify: 6/6 ok, 0 failed` |
| `npm run typecheck` | **0** | — |
| ⚠ `lint:authz-vectors` | **0** | ⛔ deliberately NOT run while a sweep was in flight — `gen-authz-matrix-cells.mjs` reads the LIVE catalog, and a `--check` against a neutralized gate is a reading of a mutated stack, not of the tree. Run only once the DB was quiet |

⚠ `npm run test:db` and the four authz arms belong to **step 11**, after the re-baseline — stated
rather than quietly skipped. In substance the pgTAP suite is green at this tree: every harness run
above captured `Result: PASS, Files=262, Tests=8876` from `supabase test db` itself.

#### The PREDICTED CARRIED enumeration (from the dry run) — key · verdict · disposition

⛔ This is the DRY RUN's list, not the full run's. It is the **floor**: the dry run fed the
generator the baseline's own notes, so every surviving row took the `identical` branch and 0 hand
suffixes were spliced. The real run adds any row whose verdict or note moved. Marked `HAND-NOTE`
where the baseline row carries hand prose in column 5 — those are measurement history and must
not be deleted casually even when the subject is gone.

```
  1 | delete: subject GONE           | COVERED |           | public.adjudicate_dsr_request(uuid, text, text, text, uuid[])
  2 | delete: subject GONE           | COVERED |           | app.can_read_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
  3 | retire to owning arm           | COVERED |           | meeting_cases.meeting_cases_staff_admin_insert (INSERT)
  4 | delete: 2nd ordinal            | COVERED |           | app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)
  5 | delete: subject GONE           | COVERED | HAND-NOTE | public.list_my_executable_dsr_tasks(uuid)
  6 | delete: subject GONE           | COVERED | HAND-NOTE | public.search_patient_xref(text, text, uuid)
  7 | delete: 2nd ordinal            | COVERED |           | hospitals.hospitals_select (SELECT)
  8 | retire to owning arm           | COVERED |           | case_interviews.case_interviews_insert (INSERT)
  9 | delete: subject GONE           | COVERED |           | app.attachment_confidentiality_ok(p_owner_type text, p_owner_id uuid, p_label text, p_uid uuid)
 10 | retire to owning arm           | COVERED |           | case_interviews.case_interviews_delete (DELETE)
 11 | retire to owning arm           | COVERED |           | meeting_cases.meeting_cases_staff_admin_delete (DELETE)
 12 | delete: subject GONE           | BLIND   |           | app.can_read_document_object(p_name text, p_uid uuid)
 13 | retire to owning arm           | COVERED |           | case_interviews.case_interviews_update (UPDATE)
 14 | retire to owning arm           | COVERED |           | responses.responses_delete_own_draft (DELETE)
 15 | delete: subject GONE           | BLIND   |           | attachment_references.attachment_references_select (SELECT)
 16 | delete: subject GONE           | COVERED | HAND-NOTE | public.attest_dsr_task(uuid, text, integer, text)
 17 | delete: 2nd ordinal            | ERROR   |           | commissions.commissions_select_member_or_admin (SELECT)
 18 | delete: subject GONE           | COVERED | HAND-NOTE | public.attest_dsr_task(uuid, text, integer, text)
 19 | delete: subject GONE           | COVERED | HAND-NOTE | app.patient_trajectory_bundle(text, text, uuid)
 20 | retire to owning arm           | COVERED |           | meeting_cases.meeting_cases_staff_admin_update (UPDATE)
 21 | RE-FILE (else ARM=census reds) | COVERED |           | app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)
 22 | delete: subject GONE           | COVERED |           | public.list_dsr_disposable_meetings(uuid)
 23 | delete: subject GONE           | COVERED |           | attachments.attachments_select (SELECT)
 24 | retire to owning arm           | COVERED |           | case_referral.case_referral_delete_draft_source (DELETE)
 25 | delete: subject GONE           | COVERED |           | referral_note_types.referral_note_types_staff_admin_write (ALL)
 26 | retire to owning arm           | COVERED | HAND-NOTE | app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)
 27 | retire to owning arm           | COVERED |           | case_referral.case_referral_update_coord (UPDATE)
 28 | retire to owning arm           | COVERED |           | profiles.profiles_update_self (UPDATE)
 29 | delete: subject GONE           | COVERED |           | public.complete_dsr_task(uuid, text)
 30 | delete: subject GONE           | COVERED | HAND-NOTE | public.complete_dsr_task(uuid, text)
 31 | delete: subject GONE           | COVERED | HAND-NOTE | authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
 32 | delete: subject GONE           | BLIND   |           | app.has_role(p_scope_type text, p_scope_id uuid, p_role text)
 33 | delete: subject GONE           | COVERED | HAND-NOTE | public.list_my_dsr_task_commissions(uuid)
 34 | retire to owning arm           | COVERED |           | meeting_signatures.meeting_signatures_insert (INSERT)
 35 | delete: subject GONE           | COVERED |           | responses.responses_admin_all (ALL)
 36 | delete: subject GONE           | BLIND   |           | referral_reply_attachment.referral_reply_attachment_select_readable (SELECT)
 37 | delete: subject GONE           | BLIND   |           | attachment_subjects.attachment_subjects_select (SELECT)
 38 | delete: subject GONE           | COVERED | HAND-NOTE | public.create_dsr_request(uuid, text, text, text, integer)
 39 | delete: subject GONE           | COVERED |           | app.can_read_snapshot_document(p_object_name text, p_uid uuid)
 40 | delete: subject GONE           | COVERED |           | referral_note_types.referral_note_types_select (SELECT)
 41 | RE-FILE (else ARM=census reds) | COVERED |           | public.document_delete_affordances(p_document_ids uuid[])
 42 | retire to owning arm           | COVERED |           | response_section_signoffs.signoffs_insert (INSERT)
 43 | delete: 2nd ordinal            | COVERED |           | organizations.organizations_select (SELECT)
 44 | retire to owning arm           | COVERED |           | case_referral.case_referral_insert_source_coord (INSERT)
 45 | RE-FILE (else ARM=census reds) | COVERED |           | public.commission_cadence_overview()
 46 | delete: subject GONE           | COVERED | HAND-NOTE | public.close_dsr_request(uuid, text, text, text)
 47 | delete: subject GONE           | COVERED |           | public.close_dsr_request(uuid, text, text, text)
 48 | delete: subject GONE           | COVERED |           | app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
```

**Disposition key.** `delete: 2nd ordinal` — the run DID emit this key once; the carried row is a
second baseline row for it (a gate swept in two passes). `delete: subject GONE` — the function or
policy no longer exists in the catalog. `retire to owning arm` — the subject exists but belongs to
the writepath arm (INSERT/UPDATE/DELETE policies) or to C2 (`prosecdef` set-returning doors).
⛔ `RE-FILE (else ARM=census reds)` — the **three** whose only account was this file.

#### Step 9 — the ONE full run is LAUNCHED and VERIFIED UNDER WAY; this session STOPS HERE

Launched **2026-09-05 19:54:05** at HEAD `abe0af51` with a clean tree, DETACHED (PowerShell
`Start-Process` on `C:\Program Files\Git\bin\bash.exe` with the runner as **argv[1]**, output
redirected, polled), own `WORK=/tmp/pd-full` and own sentinel `/tmp/pd-full-door-INFLIGHT.sql`.
⛔ Nothing ran under a tool timeout.

Provenance snapshotted BEFORE the run, by the runner itself:

```
START 2026-09-05T19:54:05-03:00
PRE_CKSUM  1895535637 131621
PRE_MD5    2ef469cabceff65e3f291e2a3054972f *docs/reviews/authz-door-audit-findings.md
PRE_LINES  924
GIT_HEAD   abe0af512112e61d92f15c5254d4dc42ec3e7789
GIT_STATUS_BEFORE:      (empty)
RESET_BARE_RC=0
```

Verified under way, not assumed:

```
    clean — 0 degenerate bodies (all three neutralization forms)
FULL SWEEP — this run MERGES into the committed baseline; it does not replace it.
ARM-DOMAIN predicate=127/127 policy=226/226
baseline OK: Result: PASS, Files=262, Tests=8876
```

**Measured rate: 5 cases in the first ~10 minutes ⇒ ~2 min/case ⇒ ~11.8 h remaining** (ETA
≈ 07:45 on 2026-09-06). ⛔ **This session stops at the step-8 commit boundary with step 9 in
flight**, which the brief names as the fallback when time runs short. Everything through step 8 is
built, proven and committed (`b6a22f67`, `5651ab19`, `abe0af51`); `git status --short` is empty;
the committed findings baseline is **byte-unchanged**.

⛔ **What the NEXT session must do, in order** — and what it must NOT do:

1. Read the bare exit code from `/c/Users/micha/AppData/Local/Temp/claude/D--Development-claude-hospital-form-platform/9346f622-9033-4572-a5fb-ffe9905fdcf2/scratchpad/pd/full/rc.txt` (`FULLRUN_BARE_RC`), never through a pipe. 0 CLEAN /
   1 DIRTY (expected: `event_current_custodian` alone makes it DIRTY via NOTICED) / 2 ABORT /
   3 UNPROVEN. ⛔ **2 also means the MERGE ABORTED** — in that case $FINDINGS is STALE and an empty
   `git diff` on it is NOT evidence the run changed nothing.
2. Read `provenance.txt`'s POST block: `POST_CKSUM`/`POST_MD5`/`POST_LINES` and
   `GIT_STATUS_AFTER`, which must list **only** `docs/reviews/authz-door-audit-findings.md`.
3. Verify the merge the other two ways: `SELFTEST=1 MERGE_VERIFY=<the merged file>
   bash scripts/lib/merge-findings-baseline.sh <baseline snapshot> <generated> /dev/null` → rc 0
   (the snapshot is `/tmp/pd-full/authz-door-audit-findings.baseline.md`, the generated file
   `/tmp/pd-full/authz-door-audit-findings.generated.md`); and ENUMERATE all 9 `HAND-MERGED`
   blocks, the 7 `## Note` sections, and the CARRIED block row by row, with `git diff --stat`.
4. Diff the REAL CARRIED block against the **predicted 48** above; every extra row is a verdict or
   note that MOVED, and the `(ALL)` ones among them are `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`'s
   work-list.
5. ⛔ **Do NOT commit the re-baselined findings file.** Return the CARRIED enumeration to the lead
   for the PO's Q2 ruling. The backlog's two resolver lines, the stale `## COVERED … + ERROR`
   heading, and the three `RE-FILE` keys all land in that same later commit.

⚠ **RATE CORRECTED, 20:24 — my own measurement went stale inside 15 minutes.** The figure above
(“5 cases in the first ~10 minutes ⇒ ~2 min/case ⇒ ~11.8 h, ETA ≈ 07:45”) was taken over **5**
cases and is optimistic. Re-measured over **12** cases against the `baseline OK` timestamp
(19:57:38 → 20:24:20, a 1602 s window):

```
  measured rate : 133.5 s/case (over 12 cases, 1602 s window)
  remaining     : 12.6 h
  ETA           : 2026-09-06 09:03
```

⇒ **~13.1 h end-to-end**, ETA **2026-09-06 ≈ 09:03**, not 07:45. The correction is recorded rather
than the earlier line edited: a rate quoted from 5 samples and a rate quoted from 12 are different
claims, and which one a later reader is relying on should be visible.

Verdict mix at 12/353: **12 COVERED, 0 BLIND, 0 NOTICED, 0 ERROR.** ⚠ That is not a preview of the
run — the predicate arm walks `order by p.proname`, so these are the `app.a*`–`app.c*` predicates
only. `app.event_current_custodian` (the expected `NOTICED`) and all 226 policies are still ahead.

Live merge behaviour confirmed mid-run at case 5, which is the Batch 1 property observed rather
than assumed: `PRESERVED 427 hand-authored prose line(s) … CARRIED 396 whole row(s)`, with
**9/9** `HAND-MERGED` blocks and **7/7** `## Note` sections intact in the on-disk file. CARRIED is
396 because only 5 rows had been emitted; it shrinks toward the predicted 48 as cases accumulate.

### 2026-09-06 — backend: the full run landed, step 10

#### The run

Completed **08:11:32**, 12 h 17 m for 353 cases (measured, vs the 13.1 h projected at 12 cases —
the projection was 6% long). **`FULLRUN_BARE_RC=1`** (DIRTY), read bare from the runner's `rc.txt`.

```
ARM-DOMAIN predicate=127/127 policy=226/226 out-of-domain-bool=35
    POLICY ARM HALF: `using` ONLY — a COVERED on a FOR ALL policy is a READ-half claim.
SWEPT: 353 gate(s)   COVERED: 228   BLIND: 18   NOTICED: 102   ERROR(harness): 5
=== RESULT: DIRTY — 18 BLIND, 102 NOTICED, 5 ERROR. …
```

⛔ The stack was left clean, ENUMERATED not assumed: degenerate NON-SELECT policies **zero rows**
(not "count 0"), degenerate function bodies across **all four** forms **0**, §4a set-valued residue
**0**, sentinel and both sidecars **absent**.

#### The merge, verified three ways

1. **Bare rc = 1**, i.e. DIRTY — ⛔ *not* 2, which is what an aborted merge returns; and
   `grep -c 'MERGE ABORTED'` over the 12-hour log = **0**.
2. `SELFTEST=1 MERGE_VERIFY=<the merged file> bash scripts/lib/merge-findings-baseline.sh
   <baseline snapshot> <generated> /dev/null` → **rc 0**:
   `holds all 426 hand-authored prose line(s), 10 suffix(es) and 318 carried row(s).`
3. **Enumerated**: 9/9 `HAND-MERGED` (8 blockquotes + the 1 that lived inside a row note, now
   correctly relocated into CARRIED), 7/7 `## Note` sections, 353 verdict rows, 318 CARRIED
   entries, `git diff --stat` = `1666 insertions(+), 375 deletions(-)`. The baseline snapshot was
   confirmed byte-identical to the pre-run committed file (`1895535637 131621` / `2ef469ca…`).

#### ⛔ AN EXTERNAL REVERT, AND WHY IT COST NOTHING

At **08:17:37** — after the run ended and after my first analysis passes had already read the
merged file — `docs/reviews/authz-door-audit-findings.md` reverted to the **exact pre-run
baseline**: `cksum 1895535637 131621`, `md5 2ef469cabceff65e3f291e2a3054972f`, 924 lines, 399
verdict rows, and `git status` clean for that path. Commands I had run minutes earlier against its
`CARRIED` block succeeded; the same commands then returned nothing.

⚠ **I cannot determine what did it and I am not guessing.** `git checkout -- <file>` leaves no
reflog entry, and the reflog shows only my five commits. What I can say is that this is the hazard
the apparatus itself warns about in writing: `scripts/door-sweep-cases.sh` prints
`git checkout -- <findings>` as the remedy for a **subset** run's damage, and applied after a
**full** run that advice destroys the run's product. Another session on this shared stack following
that instruction would produce exactly this.

⭐ **It cost nothing, and that is a property of the design rather than luck.** Every artefact
survived in `$WORK`: the baseline snapshot, `authz-door-audit-findings.generated.md`,
`progress.tsv` (353 rows) and 353 runlogs. Re-running the merge offline into SCRATCH reproduces the
run's output **byte-for-byte**:

```
MERGE_BARE_RC=0
  reproduced cksum: 2335526635 304176     run POST cksum: 2335526635 304176
  reproduced md5  : 555b058d405890c47b0b65754ca5379a   run POST md5: 555b058d405890c47b0b65754ca5379a
  reproduced lines: 2215                  run POST lines: 2215
```

⇒ the 12-hour run does **not** need re-running, and the merge is confirmed deterministic. All
analysis below is against the reproduced file; the committed path was not written.

#### ⭐ THE HEADLINE FINDING: 102 NOTICED

The plan predicted **one** NOTICED (`event_current_custodian`). The run produced **102**, plus 5
ERROR: **107 of 353 gates (30%) now carry no usable verdict**. Under the pre-change classifier all
107 would have read `ERROR`, against a committed baseline that records **29**.

⛔ The extra ~78 are not new breakage; they are a **stale baseline** meeting a much larger suite.
The baseline's own header still reads `Baseline: Files=156, Tests=4796` — it was taken at roughly
half this suite. The mechanism, MEASURED from the runlogs rather than inferred, is a cluster of ~9
files that abort together in ~80 of the 102: `150_referrals.sql` (82), `365`/`363`/`340`/`322`
(79 each), `295`/`290`/`250`/`246` (78 each). And the instructive part is *which* files those are —
`250_authz_p0_isolation.sql`, `290_authz_never_called_door_floor.sql` and
`246_authz_f1_referral_split.sql` are **the authz meta-tests themselves**. Sample summary, under
`organizations_select`:

```
150_referrals.sql   (Wstat: 768 (exited 3) Tests: 52 Failed: 1)
  Failed test: 2 — "draft mints an ENC-#### code"
  Parse errors: Bad plan.  You planned 226 tests but ran 52.
250_authz_p0_isolation.sql  Parse errors: Bad plan.  You planned 14 tests but ran 0.
290_authz_never_called_door_floor.sql  planned 40 ran 34
```

⚠ The NOTICED gates are **not** referral-shaped — only 12 of 102 mention referral/mrn; they span
`rca_*`, `process_template*`, `interview_*`, `organizations`. So a generic catalog-shape assertion
fires for *any* open policy and aborts its file. **That is precisely why `NOTICED` must not read as
COVERED**: the suite did redden, and the reddening belongs to a different gate. ⭐ It also settles
the follow-up's option (a) empirically — 102 bespoke neutralizations is not a remedy.

#### PO Q1 — the `(ALL)` read-half work-list: EXACTLY FIVE

| policy | previous verdict + write-half fixture |
| --- | --- |
| `capa_action_evidence.capa_action_evidence_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` |
| `capa_action_task.capa_action_task_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` |
| `capa_effectiveness.capa_effectiveness_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` |
| `capa_measure.capa_measure_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` |
| `capa_measure_result.capa_measure_result_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` |

⭐ **Every COVERED → BLIND transition in the whole run is an `(ALL)` policy — zero SELECT rows
flipped.** That is the discrimination the 12-case subset could not deliver, and it is exactly what a
strictly-weaker mutation predicts. ⭐ And all five are one module covered by one file, so this is a
single CAPA read-path gap, not five scattered ones. Filed into
`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` with each policy's `using` qual and the denial-half trap
(`app.can_write_capa` gates both halves, so a read-back assertion passes with `using` opened).
⚠ 18 further `(ALL)` rows went COVERED → NOTICED — unclassifiable, not flipped, not work items here.

#### The census consequence — the dry run's prediction was EXACT

41 keys lost, 2 gained; 16 in the census's live domain; 13 accounted elsewhere; **3 would leave
`ARM=census` unaccounted** — `app.storage_upload_reserved`, `public.commission_cadence_overview`,
`public.document_delete_affordances`. Identical to what step 8 predicted offline.

#### The CARRIED enumeration — 318 rows, of which only 32 are human decisions

⛔ **Do not read 318 as 318 decisions.** A row CARRIES whenever its verdict OR its columns
moved, and for most of these only the generated failing-file list drifted. Splitting on the one
thing that matters — does the carried row hold HAND PROSE in column 5 (`**`, `[merged`, ⭐ ⚠ ⛔ →):

```
TOTAL CARRIED ROWS: 318
WITH HAND PROSE in column 5 (a REAL human decision): 32
MECHANICAL (note empty or a generated failing-file list): 286

transition                          total   hand   mech
COVERED -> COVERED                    125     12    113
COVERED -> NOTICED                     58      4     54
COVERED -> (absent from this run)      42     12     30
BLIND -> NOTICED                       27      0     27
BLIND -> COVERED                       23      0     23
ERROR -> NOTICED                       17      3     14
ERROR -> COVERED                       11      0     11
COVERED -> BLIND                        5      0      5
BLIND -> (absent from this run)         5      0      5
COVERED -> ERROR                        4      1      3
ERROR -> (absent from this run)         1      0      1

=== THE 32 HAND-PROSE ROWS — what a human must actually rule on ===
  1 | COVERED -> (absent from this run) | app.patient_trajectory_bundle(text, text, uuid)
  2 | COVERED -> (absent from this run) | app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)
```

**286 are MECHANICAL** — the carried note is empty or is a generated failing-file list, so the
new row supersedes it and the carried copy can be dropped without losing measurement. **32 hold
hand prose** and are the real work:

```
=== THE 32 HAND-PROSE ROWS — what a human must actually rule on ===
  1 | COVERED -> (absent from this run) | app.patient_trajectory_bundle(text, text, uuid)
  2 | COVERED -> (absent from this run) | app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)
  3 | COVERED -> (absent from this run) | app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)
  4 | COVERED -> (absent from this run) | authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
  5 | COVERED -> (absent from this run) | public.attest_dsr_task(uuid, text, integer, text)
  6 | COVERED -> (absent from this run) | public.attest_dsr_task(uuid, text, integer, text)
  7 | COVERED -> (absent from this run) | public.close_dsr_request(uuid, text, text, text)
  8 | COVERED -> (absent from this run) | public.complete_dsr_task(uuid, text)
  9 | COVERED -> (absent from this run) | public.create_dsr_request(uuid, text, text, text, integer)
 10 | COVERED -> (absent from this run) | public.list_my_dsr_task_commissions(uuid)
 11 | COVERED -> (absent from this run) | public.list_my_executable_dsr_tasks(uuid)
 12 | COVERED -> (absent from this run) | public.search_patient_xref(text, text, uuid)
 13 | COVERED -> COVERED             | app._audit_access_authorized(p_action text, p_entity_id uuid, p_commission uuid)
 14 | COVERED -> COVERED             | app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)
 15 | COVERED -> COVERED             | app.can_manage_case_vocabulary(p_org uuid, p_uid uuid)
 16 | COVERED -> COVERED             | app.can_manage_professional(p_org uuid, p_uid uuid)
 17 | COVERED -> COVERED             | app.can_read_document(p_document_id uuid, p_uid uuid)
 18 | COVERED -> COVERED             | app.can_read_full_case_content(p_case_id uuid, p_uid uuid)
 19 | COVERED -> COVERED             | app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)
 20 | COVERED -> COVERED             | app.can_write_document(p_document_id uuid, p_uid uuid)
 21 | COVERED -> COVERED             | app.member_can_for(p_commission_id uuid, p_capability text, p_user_id uuid)
 22 | COVERED -> COVERED             | authz.has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
 23 | COVERED -> COVERED             | commissions.commissions_select_member_or_admin (SELECT)
 24 | COVERED -> COVERED             | form_versions.form_versions_staff_admin_write (ALL)
 25 | COVERED -> ERROR               | public.capa_viewer_can_manage(p_capa_id uuid)
 26 | COVERED -> NOTICED             | app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)
 27 | COVERED -> NOTICED             | app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)
 28 | COVERED -> NOTICED             | forms.forms_staff_admin_write (ALL)
 29 | COVERED -> NOTICED             | professional_profiles.professional_profiles_select (SELECT)
 30 | ERROR -> NOTICED               | app.event_current_custodian(p_event_id uuid, p_user_id uuid)
 31 | ERROR -> NOTICED               | app.is_staff_admin_of(p_commission_id uuid)
 32 | ERROR -> NOTICED               | authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid)
```

**Recommended dispositions, by group.**

| group | n | which arm's file it belongs to | recommendation |
| --- | --- | --- | --- |
| `COVERED -> BLIND` (all 5 `(ALL)`) | 5 | this arm | **re-file the note into `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`** (done), then drop the carried row — the BLIND row is now authoritative |
| `-> (absent from this run)`, subject GONE | 24 | none — the door no longer exists | delete, EXCEPT the **9** carrying hand prose: move those to an archive line, not a verdict table |
| `-> (absent from this run)`, still exists | 17 | **writepath** (13 INSERT/UPDATE/DELETE policies) · **C2** (3 set-returning doors) · this arm's own §7.17b census (1) | retire to the named arm |
| `-> (absent from this run)`, 2nd ordinal | 4 | this arm | delete — the run emits one authoritative row per key |
| ⛔ of the above, the **3** that leave `ARM=census` unaccounted | 3 | — | **MUST be re-filed before step 11**, or the census red is bookkeeping, not a finding |
| `COVERED -> COVERED` | 125 (12 hand) | this arm | accept the new row; hand-splice only the 12 |
| `-> NOTICED` (`COVERED` 58 · `BLIND` 27 · `ERROR` 17) | 102 (7 hand) | this arm | ⛔ **HOLD** — a note earned against a COVERED/BLIND verdict is not a claim about an unclassifiable one. These wait on the ruling for the NOTICED class as a whole |
| `-> COVERED` (`BLIND` 23 · `ERROR` 11) | 34 (0 hand) | this arm | ⭐ gates that GAINED coverage; drop the stale carried row |
| `COVERED -> ERROR` | 4 (1 hand) | this arm | investigate the neutralization for these 4; `public.capa_viewer_can_manage` carries hand prose |

⛔ **Nothing above has been re-filed except the five into the Q1 follow-up, and the re-baselined
file is NOT committed.** It exists only at the scratch path the record names, reproducible at any
time from `$WORK` by re-running the merge. The lead takes this to the PO for the Q2 ruling.

### 2026-09-06 — backend: run 1 voided by tail drift; the door arm gets Batch 0's reset design; run 2 launched

⚠ **First, the record's own loose end from the previous entry**: *"An external revert returned the
findings file to the pre-run baseline at 08:17; cause undetermined"* — **that was this session**,
step 3 of its brief (`git checkout -- docs/reviews/authz-door-audit-findings.md`, bare rc 0), so
that run 2 merges against the COMMITTED baseline rather than run 1's output. Not another session,
and nothing was lost: run 1's merged file is kept byte-for-byte at
`…/scratchpad/pd/full/run1-merged.md` (`555b058d405890c47b0b65754ca5379a`, 2215 lines) together
with its `progress.tsv`, `blinds.tsv`, the generated file and the baseline snapshot.

#### Post-run verification — the run 1 artefacts, every rc read BARE

| check | result |
| --- | --- |
| degenerate function bodies (all four forms) on `supabase_db_azkbbhskturikxpgmafq` | **0 rows**, psql rc 0 |
| degenerate **non-`SELECT`** policies (`qual='true' or with_check='true'`) | **0 rows**, psql rc 0 (and 10 `SELECT`-with-`true`, by design — the figure §1 measured) |
| the door sentinel `/tmp/pd-full-door-INFLIGHT.sql` | **absent** (not merely empty) |
| `SELFTEST=1 MERGE_VERIFY=<on-disk> … merge-findings-baseline.sh <baseline> <generated> /dev/null` | **bare rc 0** — *"holds all 426 hand-authored prose line(s), 10 suffix(es) and 318 carried row(s)"* |
| `HAND-MERGED` blocks / `## Note` sections in the 2215-line result | **9 / 7** |
| `git diff --stat` on the findings file | 1666 insertions, 375 deletions |

⭐ **The restore path is what makes the diagnosis below possible.** §7.5 byte-compares every
restore and `exit 2`s on a mismatch; the run exited **1**. So all 353 restores round-tripped and
the catalog was clean at the end — the residue cannot be an open gate.

#### The CARRIED 318, partitioned by CAUSE (the dry run predicted 48)

```
 125  COVERED -> COVERED          58  COVERED -> NOTICED       42  COVERED -> (absent)
  27  BLIND   -> NOTICED          23  BLIND   -> COVERED       17  ERROR   -> NOTICED
  11  ERROR   -> COVERED           5  COVERED -> BLIND          5  BLIND   -> (absent)
   4  COVERED -> ERROR             1  ERROR   -> (absent)
```

| cause | n | what it is |
| --- | --- | --- |
| **absent from the domain** | **48** | ⭐ EXACTLY the dry run's prediction — 41 baseline keys outside the live domain + 7 second-ordinal rows |
| **verdict changed by DRIFT** | **79** | the whole void tail (rows 275–353). Measured, not inferred: all 79 tail keys appear in CARRIED, `comm -23` = **0** |
| **verdict changed, cause UNSETTLED** | **66** | = **24** further `NOTICED` + **34** gates that GAINED coverage (`BLIND→COVERED` 23, `ERROR→COVERED` 11) + **5** `(ALL)` flips + **3** new `ERROR` (the 4th, `process_template_versions_select`, is IN the tail at row 309 with `Files=0 Tests=0`). ⚠ Of the 24 `NOTICED`, exactly **one** is established genuine (`app.event_current_custodian`, reproduced on a fresh reset 2026-09-05) and one is now proven DRIFT (row 274, see below) — the other 22 are unclassified |
| **note changed, verdict did not** | **125** | `COVERED -> COVERED`: the generator's reddening-file list has moved since the baseline was taken |

⛔ **Why 318 and not 48, in one sentence**: the dry run fed the generator **the baseline's own
notes**, so every surviving row took the `identical` branch and nothing could move. It bounded the
`(absent)` group exactly and was structurally blind to the other 270. The previous entry said so
("the 48 are the floor, not the estimate") and that is the number that held.

#### THE DIAGNOSIS — TAIL DRIFT, and it is PROVEN, not assumed

The lead's reading of the 102 `NOTICED` is confirmed and the count is **78**, not 76. From
`progress.tsv`:

```
rows with Tests=8470 : 78          first at row 275, last at row 353, CONTIGUOUS to the end
rows 275..353        : 79  =  78 NOTICED + 1 ERROR      (rows 1..274 hold the other 24 NOTICED)
```

Every one of the 78 carries the byte-identical note — same shape, same nine aborting files:

```
row 274  Tests=8723  aborting: 322_referral_registros, 340_dm4_referral_documents,
                               363_send_referral_requires_mrn, 365_referral_mrn_persistence_floor
row 275  Tests=8470  aborting: 150_referrals, 246_authz_f1_referral_split, 250_authz_p0_isolation,
                               290_authz_never_called_door_floor, 295_technical_director_referrals,
                               + all four of row 274's        <- and IDENTICAL on rows 276..353
```

⭐ A per-case abort **varies** per case and the suite **recovers** (rows 43–264 show 16 different
`Tests=` values with COVERED rows between them). This one never recovers. That is not a property of
any door.

**Two subset runs, each on its OWN fresh `supabase db reset --local`, both bare rc 0:**

| run | cases | result |
| --- | --- | --- |
| **A** — two tail cases, run ALONE | `interview_summaries_select responses_select` | `baseline OK: Files=262, Tests=8876` → **COVERED, COVERED** · `SWEPT: 2 COVERED: 2 BLIND: 0 NOTICED: 0 ERROR: 0` · `RESULT: CLEAN` |
| **B** — the drift-onset neighbourhood, in WORKLIST ORDER (rows 274, 275, 276) | `interview_sessions_select interview_sessions_write interview_summaries_select` | `baseline OK: Files=262, Tests=8876` → **3/3 COVERED**, and **the shape never moved at all** |

⛔ **So the brief's question — "name the case whose mutated run first left the referral fixtures
broken" — has the answer THERE IS NONE, and asking it was the wrong shape of question.** Run B
settles it three ways: case 274 was itself **already** drifted (run 1 scored it `NOTICED` at
`Tests=8723`; alone it is `COVERED`); case 275, which run 1 makes look like the culprit, is
`COVERED` on a clean DB; and three consecutive cases from that region do **not** reproduce the
abort. The damage is **cumulative in the number of preceding suite runs**, not caused by a gate —
which is exactly the failure a periodic reset bounds and that no per-case fix could reach.

**Restore verified, so the residue is DATA.** The harness restores per case and `exit 2`s if the
byte-compare fails; run 1 exited **1**, and the post-run catalog enumerates 0 degenerate bodies and
0 degenerate non-`SELECT` policies (above). A clean-tree run still aborted ⇒ the damage is data the
pgTAP suite leaves behind across hundreds of `supabase test db` invocations, not a gate left open.

⚠ **A consequence that bites a CLAIM ALREADY COMMITTED.** `78f73241` filed
`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` as *"exactly FIVE rows flipped … zero SELECT rows flipped"*.
Measured against the void tail: **16 `(ALL)` policies that were COVERED in the committed baseline
are stranded, unmeasured, inside it** (`interview_sessions_write`, `organizations_admin_write`,
`phase_results_…`, five `process_template*`, six `rca_*_write`, two `response_group_instances_…`),
plus 56 SELECT rows. So "exactly 5" is a **FLOOR** — the bound is **5 ≤ n ≤ 21** — and "zero SELECT
rows flipped" is a statement about 274 of 353 cases. The five themselves are at ordinals 152–160,
deep in the clean prefix, and are not in doubt. Corrected **beside** the original text in the
follow-up body and its register line, never by rewriting them. *Absence of a verdict is not absence
of coverage.*

#### THE RETROFIT — Batch 0's design ported into `p0-authz-door-audit.sh` (ADR 0191 D8)

`RESET_EVERY` (default 20, set-ness captured before the `:-20`), `resets_enabled` as ONE predicate
read by all three sites, `periodic_reset` with the in-flight interlock FIRST, `cd "$ROOT"`, the
§7.16 preflight, the worklist re-derivation and the baseline re-capture, plus reset-and-retry-once.
Two adaptations, both forced by differences from C2 and both measured:

1. **Keyed on the classifier, not on note text.** C2's retry matches `SHAPE changed` in the note
   string. This arm has FOUR outcomes (D5) and its drift-shaped ones are `NOTICED` **and** `ERROR`,
   so `classify()`'s `local shape_moved` is promoted to a global `SHAPE_MOVED` that both the
   verdict and the retry read. A note-matching copy would be a second hand-kept spelling of the
   same condition — §7.17a's own lesson, one layer out.
2. ⛔ **The OID is re-resolved from the function's IDENTITY at case time.** `supabase db reset
   --local` drops and recreates the database, so **every `pg_proc.oid` is reassigned**, while the
   predicate worklist's OID column is captured before the first case. A periodic reset that kept
   using it would mutate whatever now holds that OID. The reset's worklist comparison therefore
   drops field 1 deliberately (an OID that moved is not a population that moved) and
   `sweep_pred_one` looks the gate up by `nspname.proname(identity_args)` per case, scoring `ERROR`
   — never mutating — if the identity resolves to nothing.
   ⚠ **C2 has this hazard and is NOT changed by this unit**: `c2-command-door-neutralizer.sh:797`,
   `:889`, `:922` keep using the captured `$foid` across its own resets. It has never misfired
   because a deterministic replay of the same migrations tends to reproduce the same OIDs — which
   is what makes it dangerous: masked by an incidental property, not closed by a guard. **Reported
   to the lead to file; not fixed here** (different harness, different owner).

Structural changes the port required, each minimal by design: the three derivation `\copy` blocks
became `derive_worklists ()` taking a **suffix tag** (the primary call passes `""` and therefore
writes the three existing paths byte-for-byte; the reset passes `".reset"` — ⛔ never the file the
`while read` loop is consuming); each arm's case body became `sweep_pred_one` / `sweep_pol_one`
reporting through `SW_VERDICT`/`SW_NOTE`/`SW_DRIFT` with the **caller** recording, so a retried case
is recorded ONCE; and one shared `DONE` counter spans BOTH arms, because the policy arm is the
second 226 cases of a 353-case run and is exactly where the drift landed.

**Proofs — SELFTEST arm, controls first.** `SELFTEST=1 bash …p0-authz-door-audit.sh` → **12/12,
bare rc 0** (classify 6/6 unchanged + `resets_enabled` 6/6 new). ⛔ **Green on a first run is a
finding**, so it was not believed until two controls ran on scratch copies, each `cmp`-verified to
have landed:

```
(i) ONE expectation flipped        -> NOT OK C  full run, RESET_EVERY unset (defaulted 20) -> resets=yes (expected no)
                                      --- SELFTEST resets_enabled: 5/6 ok, 1 failed ---   BARE_RC=1
(ii) the PRE-RULING predicate      -> NOT OK B  SUBSET, RESET_EVERY=1 EXPLICIT   -> resets=no (expected yes)
     ("a SUBSET run NEVER resets")    NOT OK B' SUBSET, RESET_EVERY=20 EXPLICIT  -> resets=no (expected yes)
                                      --- SELFTEST resets_enabled: 4/6 ok, 2 failed ---   BARE_RC=1
```

⭐ **(ii) is the selection delta on the gate itself**: EXACTLY the two set-ness trials moved, and
trial **A** — same value 20, same SUBSET, opposite set-ness — did **not**. That is what separates
"the subset gate exists" from "the gate turns on set-ness", which is the whole content of ADR 0189
D6's re-ruling and the one distinction a `RESET_EVERY="${RESET_EVERY:-20}"` written ONE LINE EARLIER
would silently destroy.

**Proofs — `periodic_reset` polarity and its abort arms**, on the functions **extracted verbatim**
(`sed -n '/^periodic_reset () {/,/^}$/p'`, `bash -n` rc 0) and SOURCED with `supabase` stubbed as a
shell function, so nothing touched the database and every trial records whether the destructive
command would have been called:

| trial | rc | reset called | observed |
| --- | --- | --- | --- |
| A SUBSET, `RESET_EVERY` unset (20) | 0 | **0** | `(SUBSET run, RESET_EVERY not set explicitly — NOT resetting: …)` |
| B SUBSET, `RESET_EVERY=1` EXPLICIT | 0 | 1 | `--- PERIODIC RESET … ---` + preflight + `post-reset baseline: PASS` |
| C full run, `RESET_EVERY=20` default | 0 | 1 | the same |
| **D SUBSET, `RESET_EVERY=1`, SENTINEL ARMED** | **2** | **0** | `*** refusing to reset with a mutation in flight: …` — sentinel **29 → 29 B, byte-unchanged** |
| E full run, `RESET_EVERY=0` | 0 | **0** | `(RESET_EVERY=0 — NOT resetting: …)` |
| E′ SUBSET, `RESET_EVERY=0` EXPLICIT | 0 | **0** | the same — `0` disables EVERYWHERE |
| F the reset command FAILS | **2** | 1 | `*** db reset FAILED — aborting rather than measuring on an unknown DB.` |
| G a gate is DEGENERATE after the reset | **2** | 1 | `*** ABORT: a gate is DEGENERATE after a mid-sweep reset: app.some_gate(p_x uuid)` |
| H the WORKLIST moved across the reset | **2** | 1 | `*** ABORT: the derived worklist CHANGED across the reset (predicate 1 -> 2, policy 1 -> 1).` |
| I the post-reset baseline is RED | **2** | 1 | `*** ABORT: the suite is RED after a mid-sweep reset.` |

⛔ **G's first run was a FALSE PASS AND I NEARLY KEPT IT.** It reported `rc=2`, which is the
expected code — but the output was `eval: syntax error near unexpected token '('`: my proof
harness had passed `STUB_DEGEN=app.some_gate()` unquoted, so the trial aborted in the SHELL and
never reached the code under test. *A right answer from the wrong cause is not evidence.* Fixed
(the stub value quoted) and re-run; only then did it name the degenerate gate.

**Proof — END TO END on the REAL harness and the REAL stack**, fresh reset, detached, own `WORK`
and sentinel, bare exit codes. ⛔ The retry's *recovery* half cannot be shown without forcing a
baseline the suite will never produce, so the door arm gains C2's `BASE_S_OVERRIDE` equivalent:
`BASE_SHAPE_OVERRIDE`, **refused unless `SELFPROOF=1`** is set with it (two knobs, so no real sweep
inherits a forged baseline from one stray variable), and joining the SUBSET set so it can never
open the committed file for write — QA F-MAJOR-3's lesson taken directly. Its refusal arm is
proven: `BASE_SHAPE_OVERRIDE=… bash …` without `SELFPROOF` → `FATAL: … Refusing to run`, **bare
rc 2**.

```
R  (RESET_EVERY=1 EXPLICIT, CASES=interview_summaries_select)          R_BARE_RC=0
   baseline OK: Result: PASS, Files=262, Tests=8876
       ⛔ BASE_SHAPE_OVERRIDE set — baseline shape FORCED to 'Files=1, Tests=1'.
       drift suspected — resetting and retrying interview_summaries.interview_summaries_select ONCE
   --- PERIODIC RESET (retry — … recorded a drift-shaped NOTICED) ---
       post-reset §7.16 preflight: clean — 0 degenerate bodies
       post-reset baseline: PASS (shape=Files=262, Tests=8876)  |  worklist re-derived: predicate=127 policy=226 (unchanged)
     COVERED  interview_summaries.interview_summaries_select
   SWEPT: 1   COVERED: 1   BLIND: 0   NOTICED: 0   ERROR(harness): 0
       preconditions: baseline GREEN at the LAST capture (shape=Files=262, Tests=8876) · resets=1 (RESET_EVERY=1 — set EXPLICITLY, so this SUBSET run resets)
   row: | … | policy | open->true | COVERED | 387_initplan_wrap_and_profiles_arm_identity.sql (retried after reset) |
```

⭐ **A verdict RECOVERED that run 1 would have lost** — and the `worklist re-derived: predicate=127
policy=226 (unchanged)` line is simultaneously the proof that `derive_worklists ".reset"` works
against the live catalog and that its comparison passes.

**Two negative controls, each naming its OWN reason** (same case, same forced baseline, both bare
rc **1** — DIRTY is correct for a NOTICED):

```
N1 RESET_EVERY=0        resets=0 (RESET_EVERY=0 — resets DISABLED everywhere)
   row suffix: (drift-shaped; NOT retried — RESET_EVERY=0, resets are DISABLED everywhere)
N2 SUBSET, unset        resets=0 (RESET_EVERY=20 — SUPPRESSED: the DEFAULT never fires on a SUBSET
                                  run; set RESET_EVERY explicitly to enable)
   row suffix: (drift-shaped; NOT retried — a SUBSET run resets only when RESET_EVERY is set explicitly)
```

Neither carries `(retried after reset)`; both disclose on the ROW, not only the banner, because a
row is read without its banner (QA N3's finding on the C2 sibling, adopted here from the start).
⛔ Across all three runs the committed baseline is **byte-identical**: `PRE_MD5` = `POST_MD5` =
`2ef469cabceff65e3f291e2a3054972f`.

#### Gate for the retrofit commit — bare exit codes, nothing piped

| gate | bare rc | observed |
| --- | --- | --- |
| `bash -n supabase/tests/mutation/p0-authz-door-audit.sh` | **0** | — |
| `SELFTEST=1 bash …p0-authz-door-audit.sh` | **0** | `classify: 6/6` · `resets_enabled: 6/6` · `TOTAL: 12/12 ok, 0 failed` |
| `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0` — ⭐ the `PRED_DOMAIN` lift is untouched by the port, as ADR 0190 requires |
| `npm run lint` (full chain) | **0** | eslint `--max-warnings=0` clean; `check-docs-registers: OK (… 207 follow-ups, 162 follow-up bodies …)`; `build-features-index: OK (9 hubs; index in sync)` |
| ratchets | — | `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=91/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52` — **identical to the previous session's; not raised** (`scripts/check-docs-registers.mjs` is untouched by this unit) |
| post-run catalog | — | 0 degenerate bodies · 0 degenerate non-`SELECT` policies · no sentinel anywhere |

⚠ `npm run test:db` and the four authz arms remain **step 11**, after run 2 — stated rather than
quietly skipped.

#### RUN 2 — launched, verified under way, and this session STOPS HERE

Launched **2026-09-06 09:03:59** from a CLEAN tree at HEAD `496170af`, DETACHED (PowerShell
`Start-Process` on `C:\Program Files\Git\bin\bash.exe` with the runner as **argv[1]**, output
redirected and polled), own `WORK=/tmp/pd-full2` and own sentinel `/tmp/pd-full2-door-INFLIGHT.sql`.
⛔ Nothing ran under a tool timeout. Provenance snapshotted by the runner itself:

```
START 2026-09-06T09:03:59-03:00
PRE_CKSUM  1895535637 131621
PRE_MD5    2ef469cabceff65e3f291e2a3054972f *docs/reviews/authz-door-audit-findings.md
PRE_LINES  924
GIT_HEAD   496170af66044744c89d6dd6ecfa3c644d73a231
GIT_STATUS_BEFORE:      (empty)
HARNESS_MD5 f7208f614ed4d4a8b4d5584d156f496e *supabase/tests/mutation/p0-authz-door-audit.sh
RESET_EVERY_IN_ENV: unset
RESET_BARE_RC=0
```

⭐ **`RESET_EVERY_IN_ENV: unset` is recorded deliberately.** The gate turns on SET-NESS, so a runner
that exported `RESET_EVERY=20` would be indistinguishable in the banner from an operator-forced run
— and this run's whole point is that the DEFAULT protects a full sweep with nobody asking. The
harness's own md5 is snapshotted beside it so the run can be attributed to this exact text.

Verified under way, not assumed:

```
FULL SWEEP — this run MERGES into the committed baseline; it does not replace it.
    clean — 0 degenerate bodies (all three neutralization forms)
ARM-DOMAIN predicate=127/127 policy=226/226
baseline OK: Result: PASS, Files=262, Tests=8876
```

**Window, derived rather than quoted.** 353 cases × ~120 s ≈ 11.8 h, + 353 merges × 4.9 s ≈ 29 min,
+ **17** scheduled resets (`(DONE-1) % 20 == 0` over 353, `DONE > 1`) × ~175 s ≈ 50 min ⇒ **≈ 13.9 h**
before retries. Each retry costs a further reset + baseline + re-run ≈ 300 s; if the ~24 genuinely
shape-moved cases all retry that is **+2 h**. ⇒ **≈ 14–16 h, ETA between 23:00 today and 01:00 on
2026-09-07.** ⚠ This is arithmetic on measured unit costs, not an observed rate — re-measure it
against `baseline OK`'s timestamp once a dozen cases have landed, as the previous session had to.

⛔ **What the next session must NOT do**: read run 1's CARRIED enumeration as the input to the Q2
ruling (it is superseded), or take any figure from run 1's tail. Read `FULLRUN_BARE_RC` from
`…/scratchpad/pd/full2/rc.txt` **bare**, and expect the new `preconditions: … resets=N
(RESET_EVERY=20)` line to be quoted in the gate record beside the counts — `resets=0` on a
353-case run is the exact state that voided run 1.

### 2026-09-07 — backend: run 2 verified; the enumerations for the PO

⛔ **This session STOPS before committing `docs/reviews/authz-door-audit-findings.md`.** The file is
on disk, merged, verified three ways, and left **uncommitted** pending the PO's Q2 (CARRIED) and
NOTICED rulings. `git status --short` shows that one path and nothing else changed by the run.

#### The run, read bare

```
START 2026-09-06T09:03:59-03:00        END 2026-09-06T23:57:41-03:00      -> 14 h 53 m 42 s
RESET_BARE_RC=0      FULLRUN_BARE_RC=1                (DIRTY: BLIND blocks the phase, as designed)
PRE_MD5  2ef469cabceff65e3f291e2a3054972f   924 lines   POST_MD5 d2ca2de362b97a0f7b486d34c1e0411a  2043 lines
GIT_HEAD 496170af…    HARNESS_MD5 f7208f614ed4d4a8b4d5584d156f496e     RESET_EVERY_IN_ENV: unset
```

```
ARM-DOMAIN predicate=127/127 policy=226/226 out-of-domain-bool=35
    POLICY ARM HALF: `using` ONLY — a COVERED on a FOR ALL policy is a READ-half claim.
SWEPT: 353 gate(s)   COVERED: 294   BLIND: 36   NOTICED: 23   ERROR(harness): 0
    preconditions: baseline GREEN at the LAST capture (shape=Files=262, Tests=8876) · resets=40 (RESET_EVERY=20)
=== RESULT: DIRTY — 36 BLIND, 23 NOTICED, 0 ERROR. BLIND blocks the phase (§6 step 1);
```

⭐ **`resets=40` decomposes exactly**: `grep -c 'PERIODIC RESET'` = **40** = **17 scheduled**
(`(DONE-1) % 20 == 0` over 353 — the arithmetic the previous session predicted) + **23 retries**, and
`grep -c 'drift suspected'` = **23**. ⛔ **ERROR fell 5 → 0.** The whole ERROR class of run 1 was
drift, and the retry net converted it.

#### Step 1 — the stack, ENUMERATED not counted (bare rc beside each)

| check, on `supabase_db_azkbbhskturikxpgmafq` | result |
| --- | --- |
| degenerate **non-`SELECT`** policies (`qual='true' or with_check='true'`) | **zero rows**, psql rc 0 |
| control for that query: `SELECT` policies with `qual='true'` | **10** — the by-design figure §1 measured, so the query is not silently empty |
| degenerate function bodies, **all four** forms (`begin return true`, `select true`, `begin return`, `P0-SETVALUED-NEUTRALIZED`) | **zero rows**, psql rc 0 |
| §4a set-valued residue (`prosecdef ∧ proretset ∧ uuid`, no authz term in the stripped body) | **zero rows**, psql rc 0 |
| control for §4a: subjects the detector ranges over | **5** — non-empty, so its 0 is a measurement |
| the run's sentinel `/tmp/pd-full2-door-INFLIGHT.sql` + `.probe` + `.want` | **absent** (not merely empty) |
| the default `/tmp/authz-door-INFLIGHT.sql` + sidecars, and `/tmp/authz-setvalued-INFLIGHT.sql` | **absent** |

⚠ **Reported, not acted on:** `/tmp` holds four sentinels belonging to OTHER harnesses —
`c2-neutralizer-INFLIGHT.sql` (+`.body`, 2026-09-04 15:00) and `it2-e2e` / `it2-reg`
(+`.body`/`.md5`/`.oid`, 2026-09-04 22:02–22:16). They are stale leftovers of earlier sessions, not
live mutations: the catalog rows above are the proof, since a live mutation would show as a
degenerate body. They are outside this unit's ownership and were left untouched.

#### Step 2 — the merge, verified three ways

1. **Bare rc = 1** (DIRTY), ⛔ not 2, which is what an aborted merge returns; and
   `grep -c 'MERGE ABORTED'` over the 15-hour log prints **0**. ⚠ That `grep -c` exits **1** on a
   zero count — the printed `0` is the measurement, the rc is grep's no-match code. Read as a
   guard it would have failed the chain, which is why it is read as a *number* here.
2. `SELFTEST=1 MERGE_VERIFY=docs/reviews/authz-door-audit-findings.md bash
   scripts/lib/merge-findings-baseline.sh /tmp/pd-full2/authz-door-audit-findings.baseline.md
   /tmp/pd-full2/authz-door-audit-findings.generated.md /dev/null` → **bare rc 0**:
   *"holds all 426 hand-authored prose line(s), 11 suffix(es) and 275 carried row(s)."*
3. **Enumerated on the on-disk file**: `HAND-MERGED` **9/9** · `## Note` sections **7/7** · verdict
   rows **353** · CARRIED entries **275** · `git diff --stat` = **1451 insertions(+), 332
   deletions(-)**, one file.

The baseline the run merged against was confirmed **byte-identical** to the committed pre-run file:
`git show HEAD:… | cksum` = `1895535637 131621` = the snapshot's, `cmp` **bare rc 0**.

Copy saved: `…/scratchpad/pd/full2/run2-merged.md` — `cksum 2166358832 263156`,
`md5 d2ca2de362b97a0f7b486d34c1e0411a`, 2043 lines, i.e. **equal to the runner's own `POST_CKSUM` /
`POST_MD5`**, so the analysis below is against the artefact the run produced.

#### The retry net, on the real run — two excerpts VERBATIM

```
    drift suspected — resetting and retrying app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid) ONCE
--- PERIODIC RESET (retry — app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid) recorded a drift-shaped NOTICED) ---
    post-reset §7.16 preflight: clean — 0 degenerate bodies
    post-reset baseline: PASS (shape=Files=262, Tests=8876)  |  worklist re-derived: predicate=127 policy=226 (unchanged)
  NOTICED  app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)
```

```
    drift suspected — resetting and retrying app.event_current_custodian(p_event_id uuid, p_user_id uuid) ONCE
--- PERIODIC RESET (retry — app.event_current_custodian(p_event_id uuid, p_user_id uuid) recorded a drift-shaped NOTICED) ---
    post-reset §7.16 preflight: clean — 0 degenerate bodies
    post-reset baseline: PASS (shape=Files=262, Tests=8876)  |  worklist re-derived: predicate=127 policy=226 (unchanged)
  NOTICED  app.event_current_custodian(p_event_id uuid, p_user_id uuid)
```

⭐ **All 23 NOTICED were retried and all 23 REPRODUCED.** The arithmetic closes it without needing
trust: 23 retries fired, 23 rows carry the `(retried after reset)` suffix in BOTH the generated and
the merged file, and a row can only end NOTICED if it was drift-shaped on the first pass — so
23 retries with 23 NOTICED means none recovered. Each retry's `post-reset baseline` came back at the
**true** shape `Files=262, Tests=8876`, so the reproduction was measured against a clean DB, not a
degraded one.

#### Step 3 — run 1 vs run 2, and the DRIFT ROWS are now real verdicts

Both runs emit 353 rows over the **same 353 keys** (`keys only in run1: []`, `keys only in run2: []`).

```
run 1   COVERED 228   BLIND 18   NOTICED 102   ERROR 5
run 2   COVERED 294   BLIND 36   NOTICED  23   ERROR 0
```

⭐ **84 keys differ, and every one moves in ONE direction — out of the unclassifiable classes:**

| run 1 | run 2 | n |
| --- | --- | --- |
| NOTICED | COVERED | 61 |
| NOTICED | BLIND | 18 |
| ERROR | COVERED | 5 |

⛔ **Zero run-1 COVERED rows and zero run-1 BLIND rows moved at all.** Run 2 is not a different
measurement of the same gates; it is the same measurement with 84 previously-unreadable cells filled
in. That is the strongest available evidence that the retrofit resolved drift rather than perturbing
the arm.

**The void tail is discharged.** Run 1's ordinals 275–353 (79 rows: 78 NOTICED + 1 ERROR) now read:

```
run 2 verdicts for run 1's tail keys :  COVERED 61   BLIND 18   NOTICED 0
the 78 rows that carried Tests=8470  :  COVERED 60   BLIND 18   NOTICED 0
   (the 79th is process_template_versions_select, run 1's ERROR at Files=0 Tests=0 -> COVERED)
```

**And run 2 has no tail of its own**, measured three ways rather than asserted:

| | run 1 | run 2 |
| --- | --- | --- |
| rows carrying an **off-baseline** suite shape | 104 of 353 | **23 of 353** (the other 330 at `Files=262, Tests=8876`) |
| distinct `Tests=` values among them | 18 | **16** |
| longest run of the SAME value, consecutive | **44** | **2** |
| ordinal of the LAST shape-moved row | **353** (contiguous to the end) | **264** — 89 clean cases follow |

#### ⭐ THE NOTICED ATTRIBUTION — and it INVERTS run 1's reading

The brief asked which files abort for the 23, and whether the three authz meta-tests
(`250_authz_p0_isolation`, `290_authz_never_called_door_floor`, `246_authz_f1_referral_split`) are
among them — i.e. whether NOTICED means "the suite's generic open-policy detectors fired".

⛔ **The answer is NO, measured: ZERO of the 23 abort in an authz meta-test.** Not one of the three
appears in any row's `aborting file(s):` list. They appear only in `reddened:` lists, which is a
different claim. Run 1's tail — where those three DID abort, in 78 identical rows — was the drift,
and the drift is gone.

What aborts instead is a **domain** file, per gate, in a small and specific set:

```
  6  205_administrativo.sql            2  244_authz_c6_reserved_session_lifecycle.sql
  5  140_patient_safety.sql            2  90_cases.sql            2  113_case_action_items.sql
  5  225_supersession.sql              2  182_action_items.sql    2  349_dsr_request_workflow.sql
  4  150_referrals.sql                 2  409_ae49_d6_rekey_differential.sql
  3  200_controlled_documents.sql
  1 each: 120_meetings · 368_printed_documents_cases · 405_ae46_wrapper_cutover_invariants ·
          227_action_item_satellites · 264_correction_requests · 265_reopen_void_narrative ·
          267_ethics_e3a_autoderive · 272_ff2_door_parity · 347_correction_conclusion_gate ·
          367_deferred_staff_signoff
```

15 distinct aborting-file signatures over 23 rows — the largest group is 4 (`140_patient_safety.sql`,
the NSP/PQS family). **Every row has `Files=262`**: all 262 files ran; only the `Tests=` count moved,
by −8 to −207 against 8876. That is the LEARN-083 / 296-site shape — a **value assertion whose
subject raises when its gate is opened**, aborting *that* file's plan — not a generic catalog-shape
detector.

**The evidence half, which the ruling also needs.** For all **23/23** the `reddened:` set is a
STRICT SUPERSET of the aborting set, and for **19/23** at least one *authz-shaped* file reddens
OUTSIDE the aborting file (`171_cross_org_isolation`, `298_authz_p0_isolation`,
`184_hospital_admin_isolation`, `231_authz_m5_is_active_gate`, `300_rowdoor_gate_keystones`, …).
⚠ **That is a NAME-shaped signal, not a verdict** — "a file whose name contains `authz` reddened" is
not "an assertion about THIS gate reddened", and reading it as coverage is precisely the
`sweeping one sibling AXIS reads as sweeping the class` error. It is offered as input to the ruling,
and the four rows WITHOUT it are named so the weaker cases are visible rather than averaged away:
`app.event_current_custodian`, `app.is_dpo_of`, `app.is_dpo_of_for`,
`app.is_entitled_document_approver`.

> ⚠ **CORRECTION — 2026-09-07, QA `F-MAJOR-5`. The paragraph above is left unedited; "for all
> 23/23 the `reddened:` set is a STRICT SUPERSET of the aborting set" is `21/23`.** RE-MEASURED by
> re-parsing every NOTICED row's column 5 by pipe INDEX (never a regex over the row) and splitting
> `aborting file(s): … ; reddened: …`. The two exceptions, named the way the four weak rows above
> are named:
>
> ```
> app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)
>     5 of its 7 aborting files are ABSENT from `reddened:` — 227_action_item_satellites,
>     265_reopen_void_narrative, 267_ethics_e3a_autoderive, 272_ff2_door_parity,
>     347_correction_conclusion_gate
> cases.cases_staff_admin_write (ALL)
>     its ONLY aborting file, 205_administrativo.sql, is ABSENT from `reddened:`
> ```
>
> ⭐ **The claim the ruling actually needs SURVIVES and was re-measured too**: `reddened:` is
> non-empty for **23/23**, so every NOTICED row's suite DID redden. "Strict superset" is the
> stronger statement and it is not true. ⚠ The second case is the interesting one — the aborting
> file itself did not redden, which means the abort there is not the LEARN-083 shape the paragraph
> above generalises, and `cases.cases_staff_admin_write (ALL)` should be read as a weaker cell than
> its NOTICED sibling rows. It is inside `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`'s
> 23-row work-list, so it is carried; it is NOT in the four-row
> `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING` split, because it does have an
> authz-shaped reddening elsewhere.

⛔ **I am not ruling.** Measured: the abort is per-gate and domain-local; the meta-tests are not
implicated; a NOTICED row's suite DID redden. Unresolved: whether the reddening is attributable to
the opened gate. The lead owes the PO the ruling.

#### Step 4 — the `(ALL)` flips (PO Q1): the final n is **ELEVEN**

Measured **baseline → run 2** (the comparison the follow-up is about; run 1 is not the reference):

```
BLIND -> COVERED  38     ERROR -> NOTICED  17     ERROR -> COVERED  11
COVERED -> BLIND  11     COVERED -> NOTICED 6                          (83 transitions)
```

**All 11 COVERED → BLIND rows are `(ALL)` policies. There are ZERO non-`(ALL)` flips**, so the
brief's second question — "list every OTHER row that flipped COVERED → BLIND, with its reason" — has
the answer **there are none**, and no separate explanation is owed. Stronger still: of run 2's 36
BLIND rows, **25 were BLIND in the committed baseline and 11 are these flips** — none is a new
subject. There is **no coverage loss anywhere outside the mirror fix**.

| # | policy | `using` qual (live catalog, 2026-09-07) | write-half fixture | what a read-half keystone must assert |
| --- | --- | --- | --- | --- |
| 1 | `capa_action_evidence.capa_action_evidence_write (ALL)` | `app.can_write_capa((select ca.capa_id from capa_action ca where ca.id = capa_action_evidence.action_id), auth.uid())` | `252_authz_p0_isolation.sql` | rows of a writable CAPA visible **and zero rows** for a foreign one |
| 2 | `capa_action_task.capa_action_task_write (ALL)` | same, joined through `capa_action.action_id` | `252_authz_p0_isolation.sql` | same denial half |
| 3 | `capa_effectiveness.capa_effectiveness_write (ALL)` | `app.can_write_capa(capa_id, auth.uid())` | `252_authz_p0_isolation.sql` | a foreign CAPA's effectiveness rows **invisible**, not merely un-writable |
| 4 | `capa_measure.capa_measure_write (ALL)` | `app.can_write_capa(capa_id, auth.uid())` | `252_authz_p0_isolation.sql` | same |
| 5 | `capa_measure_result.capa_measure_result_write (ALL)` | same, joined through `capa_measure.measure_id` | `252_authz_p0_isolation.sql` | same |
| 6 | `rca_evidence.rca_evidence_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | evidence of a writable RCA visible **and zero rows** for a foreign one |
| 7 | `rca_factors.rca_factors_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | same denial half |
| 8 | `rca_members.rca_members_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | ⚠ assert through THIS policy, not via an `rca_select` route |
| 9 | `rca_root_causes.rca_root_causes_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | same |
| 10 | `rca_timeline_entries.rca_timeline_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | same |
| 11 | `rca_why_chains.rca_why_chains_write (ALL)` | `app.can_write_rca(rca_id, auth.uid())` | `252_authz_p0_isolation.sql` | same |

⭐ **The bound 5 ≤ n ≤ 21 resolves to 11, from INSIDE the interval** — the 5 CAPA rows reproduced
(run 1 BLIND, run 2 BLIND) and 6 `rca_*_write` rows that run 1 could not measure (run 1 NOTICED,
run 2 BLIND). ⭐ Of the **16** stranded `(ALL)` rows the previous session named, exactly the **6**
`rca_*_write` flipped; the other **10** — `interview_sessions_write`, `organizations_admin_write`,
`phase_results_staff_admin_write`, five `process_template*_staff_admin_write`, two
`response_group_instances_write_*` — came back **COVERED**. *Absence of a verdict was not absence of
coverage, in either direction.*

⚠ **Four further `(ALL)` rows went run-1-NOTICED → run-2-BLIND and are NOT flips**
(`process_template_phase_allowed_results_staff_admin_write`,
`process_template_phase_offered_results_staff_admin_write`, `process_templates_staff_admin_write`,
`professional_categories_admin_write`), together with three `*_write_admin` referral policies and
five SELECT rows: **all twelve were BLIND in the committed baseline already**. Counting them as
newly-blinded would inflate the work-list by more than it holds.

⛔ Both halves of each of the 11 use the **same** predicate (`can_write_capa` / `can_write_rca`,
byte-identical `using` and `with check`), so the CAPA trap reproduces exactly for RCA: a read-back
assertion for a permitted principal passes with `using` opened to `true`. The denial half is
load-bearing in all eleven.

`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` updated (register line + body) with a dated **SETTLED**
section carrying the eleven; the earlier "exactly five" text and its FLOOR correction are left
standing beside it, never rewritten.

#### Step 5 — the CARRIED enumeration (PO Q2), FINAL

**275 rows** (run 1's 318 was measured against a partly-void run and is superseded). Splitting on
the one thing that matters — does column 5 hold HAND PROSE (`**`, `[merged`, ⭐ ⚠ ⛔ →):

```
TOTAL CARRIED ROWS: 275      HAND PROSE (a real human decision): 31      MECHANICAL: 244

transition                          total   hand   mech
COVERED -> COVERED                    144     13    131
COVERED -> (absent from this run)      42     12     30
BLIND   -> COVERED                     38      0     38
ERROR   -> NOTICED                     17      3     14
COVERED -> BLIND                       11      0     11
ERROR   -> COVERED                     11      0     11
COVERED -> NOTICED                      6      3      3
BLIND   -> (absent from this run)       5      0      5
ERROR   -> (absent from this run)       1      0      1
```

**The 48 `(absent)` rows resolved against the LIVE catalog** (not against memory of run 1), and the
parts sum: 41 baseline keys genuinely outside the live domain + 4 second-ordinal rows of keys the run
DOES emit (`app.can_sign_section`, `commissions_select_member_or_admin`, `hospitals_select`,
`organizations_select`) + 3 second copies of already-absent DSR keys = **48**.
⭐ The 45-key absent set is **byte-identical to run 1's** (`diff` bare rc 0), so the census
consequence carries forward unchanged.

| live status | n | which arm |
| --- | --- | --- |
| FUNC GONE | 20 | none — the door no longer exists |
| POLICY GONE | 7 | none |
| POLICY LIVE, `INSERT`/`UPDATE`/`DELETE` | 13 | **writepath** (`p0-authz-writepath-audit.sh`) |
| POLICY LIVE, `SELECT` | 3 | this arm — all three are second-ordinal duplicates |
| FUNC LIVE, `prosecdef` **SETOF record** | 3 | **C2** (`resolve_document_version_bytes`, `commission_cadence_overview`, `document_delete_affordances`) |
| FUNC LIVE, `prosecdef` **boolean**, out of domain | 2 | this arm §7.17b (`can_sign_section` dup; `storage_upload_reserved`, which IS in the 35 out-of-domain enumeration) |

**Counts per recommended disposition** — this is the list the PO rules on:

| disposition | n | hand |
| --- | --- | --- |
| DELETE — note-only drift (`COVERED -> COVERED`, note empty or a generated file list) | 131 | 0 |
| DELETE — the gate GAINED a verdict (`BLIND -> COVERED` 38, `ERROR -> COVERED` 11) | 49 | 0 |
| ⛔ HOLD — awaits the PO ruling on the NOTICED class | 23 | 6 |
| DELETE — subject GONE, no hand prose | 17 | 0 |
| RE-ATTACH the hand note to the new row | 13 | 13 |
| RETIRE to `p0-authz-writepath-audit.sh` | 13 | 0 |
| RE-FILED to `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` (done 2026-09-07), then delete | 11 | 0 |
| ARCHIVE the prose (a `## Note`, never a verdict row), then delete | 10 | 10 |
| DELETE — 2nd ordinal of a key the run DOES emit | 4 | 0 |
| ⛔ **RE-FILE REQUIRED (census)**, then retire to C2 | 2 | 0 |
| ⛔ **RE-FILE REQUIRED (census)** | 1 | 1 |
| RETIRE to C2 | 1 | 1 |
| **total** | **275** | **31** |

⛔ **The three census-mandatory re-files** (identical to run 1's prediction, and to the dry run's):
`app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)`,
`public.commission_cadence_overview()`, `public.document_delete_affordances(p_document_ids uuid[])`.
Without them `ARM=census` reds on a bookkeeping hole rather than on a finding, and that must not
happen at step 11.

⛔ **The 31 hand-prose rows — the ones a human must actually read.** Nothing below has been
re-filed, moved or deleted.

```
ARCHIVE the prose, then delete (10)
   app.patient_trajectory_bundle(text, text, uuid)
   authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
   public.attest_dsr_task(uuid, text, integer, text)                [x2 — both baseline copies]
   public.close_dsr_request(uuid, text, text, text)
   public.complete_dsr_task(uuid, text)
   public.create_dsr_request(uuid, text, text, text, integer)
   public.list_my_dsr_task_commissions(uuid)
   public.list_my_executable_dsr_tasks(uuid)
   public.search_patient_xref(text, text, uuid)

HOLD — pending the NOTICED ruling (6)
   app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)   COVERED -> NOTICED
   app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)                          COVERED -> NOTICED
   forms.forms_staff_admin_write (ALL)                                               COVERED -> NOTICED
   app.event_current_custodian(p_event_id uuid, p_user_id uuid)                      ERROR   -> NOTICED
   app.is_staff_admin_of(p_commission_id uuid)                                       ERROR   -> NOTICED
   authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid)  ERROR -> NOTICED

RE-ATTACH the hand note to the new row (13, all COVERED -> COVERED)
   app._audit_access_authorized · app.can_edit_commission_forms · app.can_manage_case_vocabulary
   app.can_manage_professional · app.can_read_document · app.can_read_full_case_content
   app.can_sign_section · app.can_write_document · app.member_can_for · authz.has_permission
   commissions.commissions_select_member_or_admin (SELECT) · form_versions.form_versions_staff_admin_write (ALL)
   professional_profiles.professional_profiles_select (SELECT)

RE-FILE REQUIRED (census) (1)      app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)
RETIRE to C2 (1)                   app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)
```

⚠ **Two rows changed hand-status since run 1's list of 32**, both explained rather than smoothed
over: `public.capa_viewer_can_manage` no longer CARRIES at all (baseline COVERED → run 2 COVERED with
an identical note, so the merge took the `identical` branch — its run-1 `COVERED -> ERROR` was
drift), and `professional_profiles.professional_profiles_select` moved from `COVERED -> NOTICED` to
`COVERED -> COVERED`. 32 − 2 + 1 = 31.

**THE FULL 275-ROW TABLE** — key · baseline verdict · run-2 verdict · hand flag · live status · arm ·
disposition, sorted by disposition:

| # | key | baseline | run 2 | hand | live status | arm | disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `app.patient_trajectory_bundle(text, text, uuid)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 2 | `authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 3 | `public.attest_dsr_task(uuid, text, integer, text)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 4 | `public.attest_dsr_task(uuid, text, integer, text)` | COVERED | (absent from this run) | **H** | FUNC GONE [2nd ordinal] | none — the door no longer exists | ARCHIVE the prose, then delete |
| 5 | `public.close_dsr_request(uuid, text, text, text)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 6 | `public.complete_dsr_task(uuid, text)` | COVERED | (absent from this run) | **H** | FUNC GONE [2nd ordinal] | none — the door no longer exists | ARCHIVE the prose, then delete |
| 7 | `public.create_dsr_request(uuid, text, text, text, integer)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 8 | `public.list_my_dsr_task_commissions(uuid)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 9 | `public.list_my_executable_dsr_tasks(uuid)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 10 | `public.search_patient_xref(text, text, uuid)` | COVERED | (absent from this run) | **H** | FUNC GONE | none — the door no longer exists | ARCHIVE the prose, then delete |
| 11 | `app.can_read_document_object(p_name text, p_uid uuid)` | BLIND | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 12 | `app.has_role(p_scope_type text, p_scope_id uuid, p_role text)` | BLIND | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 13 | `attachment_references.attachment_references_select (SELECT)` | BLIND | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 14 | `attachment_subjects.attachment_subjects_select (SELECT)` | BLIND | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 15 | `referral_reply_attachment.referral_reply_attachment_select_readable (SELECT)` | BLIND | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 16 | `app.attachment_confidentiality_ok(p_owner_type text, p_owner_id uuid, p_label text, p_uid uuid)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 17 | `app.can_read_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 18 | `app.can_read_snapshot_document(p_object_name text, p_uid uuid)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 19 | `app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 20 | `attachments.attachments_select (SELECT)` | COVERED | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 21 | `public.adjudicate_dsr_request(uuid, text, text, text, uuid[])` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 22 | `public.close_dsr_request(uuid, text, text, text)` | COVERED | (absent from this run) |  | FUNC GONE [2nd ordinal] | none — the door no longer exists | DELETE |
| 23 | `public.complete_dsr_task(uuid, text)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 24 | `public.list_dsr_disposable_meetings(uuid)` | COVERED | (absent from this run) |  | FUNC GONE | none — the door no longer exists | DELETE |
| 25 | `referral_note_types.referral_note_types_select (SELECT)` | COVERED | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 26 | `referral_note_types.referral_note_types_staff_admin_write (ALL)` | COVERED | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 27 | `responses.responses_admin_all (ALL)` | COVERED | (absent from this run) |  | POLICY GONE | none — the door no longer exists | DELETE |
| 28 | `app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)` | COVERED | (absent from this run) |  | FUNC LIVE secdef=true setof=false ret=boolean | this arm | DELETE — 2nd ordinal of a key the run DOES emit |
| 29 | `hospitals.hospitals_select (SELECT)` | COVERED | (absent from this run) |  | POLICY LIVE (SELECT) | this arm | DELETE — 2nd ordinal of a key the run DOES emit |
| 30 | `organizations.organizations_select (SELECT)` | COVERED | (absent from this run) |  | POLICY LIVE (SELECT) | this arm | DELETE — 2nd ordinal of a key the run DOES emit |
| 31 | `commissions.commissions_select_member_or_admin (SELECT)` | ERROR | (absent from this run) |  | POLICY LIVE (SELECT) | this arm | DELETE — 2nd ordinal of a key the run DOES emit |
| 32 | `action_item_assignments.action_item_assignments_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 33 | `action_item_checklists.action_item_checklists_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 34 | `action_item_reminders.action_item_reminders_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 35 | `action_item_status_history.action_item_status_history_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 36 | `action_item_updates.action_item_updates_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 37 | `action_items.action_items_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 38 | `action_items.action_items_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 39 | `answer_references.answer_references_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 40 | `answer_selected_options.answer_selected_options_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 41 | `answer_selected_options.answer_selected_options_write_own_draft (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 42 | `answers.answers_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 43 | `answers.answers_write_own_draft (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 44 | `app.can_access_targeted_response(p_response_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 45 | `app.can_access_targeted_version(p_form_version_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 46 | `app.can_create_professional(p_org uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 47 | `app.can_edit_referral_internal_note(p_note_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 48 | `app.can_execute_dsr_task(p_hospital_id uuid, p_commission_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 49 | `app.can_manage_external_participant(p_org uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 50 | `app.can_manage_referral_internal_note(p_note_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 51 | `app.can_reach_meeting(p_meeting_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 52 | `app.can_read_action_item(p_action_item_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 53 | `app.can_read_case(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 54 | `app.can_read_case_committee(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 55 | `app.can_read_case_patient(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 56 | `app.can_read_correction_response(p_response_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 57 | `app.can_read_document_hold(p_document_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 58 | `app.can_read_document_of_version(p_version_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 59 | `app.can_read_event(p_event_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 60 | `app.can_read_event_patient(p_event_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 61 | `app.can_read_interview(p_interview_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 62 | `app.can_read_minutes_transcript(p_job_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 63 | `app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 64 | `app.can_read_referral_metadata(p_referral_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 65 | `app.can_read_referral_phi(p_referral_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 66 | `app.can_read_signoff(p_response_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 67 | `app.can_write_action_item_stake(p_action_item_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 68 | `app.can_write_case_content(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 69 | `app.can_write_case_narrative(p_narrative_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 70 | `app.can_write_interview(p_interview_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 71 | `app.can_write_rca(p_rca_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 72 | `app.has_case_capability(p_case_id uuid, p_uid uuid, p_cap text)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 73 | `app.is_admin()` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 74 | `app.is_admin_for(p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 75 | `app.is_case_excluded(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 76 | `app.is_case_respondent(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 77 | `app.is_document_approver_of(p_document_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 78 | `app.is_document_version_approver(p_version_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 79 | `app.is_hospital_admin_of_for(p_hospital_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 80 | `app.is_nsp_coordinator_of(p_hospital_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 81 | `app.is_org_admin_of_for(p_org_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 82 | `app.is_org_commission_staff_admin(p_org uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 83 | `app.is_org_level_admin_within(p_org_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 84 | `app.is_org_member(p_org_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 85 | `app.is_pqs_member_of_any(p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 86 | `app.is_pqs_operator_in_org(p_org_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 87 | `app.is_pqs_operator_in_org_for(p_org_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 88 | `app.is_quality_reviewer_of(p_hospital_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 89 | `app.is_quality_reviewer_of_for(p_hospital_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 90 | `app.is_recused_from_case(p_case_id uuid, p_uid uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 91 | `app.is_technical_director_of_for(p_hospital_id uuid, p_user_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 92 | `app.person_is_anchorless(p_user uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 93 | `app.person_known_to_org(p_user uuid, p_organization uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 94 | `audit_log.audit_log_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 95 | `capa_action.capa_action_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 96 | `capa_action.capa_action_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 97 | `capa_plan.capa_plan_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 98 | `case_access_grants.case_access_grants_select_own (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 99 | `case_custom_field_values.case_custom_field_values_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 100 | `case_custom_field_values.case_custom_field_values_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 101 | `case_events.case_events_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 102 | `case_narrative_types.case_narrative_types_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 103 | `case_narrative_types.case_narrative_types_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 104 | `case_narratives.case_narratives_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 105 | `case_narratives.case_narratives_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 106 | `case_offered_outcomes.case_offered_outcomes_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 107 | `case_offered_outcomes.case_offered_outcomes_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 108 | `case_outcomes.case_outcomes_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 109 | `case_outcomes.case_outcomes_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 110 | `case_participant_roles.case_participant_roles_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 111 | `case_participant_roles.case_participant_roles_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 112 | `case_phase_allowed_results.case_phase_allowed_results_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 113 | `case_phase_offered_results.case_phase_offered_results_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 114 | `case_phases.case_phases_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 115 | `case_phases.case_phases_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 116 | `case_tag_assignments.case_tag_assignments_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 117 | `case_tags.case_tags_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 118 | `case_tags.case_tags_staff_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 119 | `case_types.case_types_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 120 | `case_types.case_types_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 121 | `cases.cases_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 122 | `commission_administrativo_capabilities.commission_administrativo_capabilities_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 123 | `commission_administrativos.commission_administrativos_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 124 | `controlled_document_versions.controlled_document_versions_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 125 | `controlled_documents.controlled_documents_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 126 | `document_approvals.document_approvals_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 127 | `documents.documents_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 128 | `dsr_requests.dsr_requests_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 129 | `dsr_tasks.dsr_tasks_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 130 | `ethics_allegations.ethics_allegations_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 131 | `ethics_appeals.ethics_appeals_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 132 | `ethics_case_details.ethics_case_details_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 133 | `ethics_decision_details.ethics_decision_details_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 134 | `ethics_findings.ethics_findings_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 135 | `ethics_hearings.ethics_hearings_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 136 | `ethics_notifications.ethics_notifications_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 137 | `event_custody.event_custody_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 138 | `event_triage.event_triage_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 139 | `form_block_library.form_block_library_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 140 | `form_items.form_items_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 141 | `form_sections.form_sections_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 142 | `form_versions.form_versions_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 143 | `hospital_affiliations.hospital_affiliations_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 144 | `hospitals.hospitals_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 145 | `interview_sessions.interview_sessions_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 146 | `meeting_cases.meeting_cases_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 147 | `meeting_minutes_jobs.meeting_minutes_jobs_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 148 | `organization_affiliations.organization_affiliations_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 149 | `organizations.organizations_admin_write (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 150 | `patient_safety_event.patient_safety_event_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 151 | `printed_documents.printed_documents_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 152 | `professional_participants.professional_participants_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 153 | `public.can_dispose_referral_phi(p_referral_id uuid)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 154 | `rca.rca_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 155 | `referral_reply.referral_reply_select_phi (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 156 | `referral_shared_item.referral_shared_item_select_phi (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 157 | `response_group_instances.response_group_instances_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 158 | `response_group_instances.response_group_instances_select_targeted (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 159 | `response_group_instances.response_group_instances_write_targeted (ALL)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 160 | `response_section_signoffs.signoffs_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 161 | `responses.responses_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 162 | `standard_ownerships.standard_ownerships_select (SELECT)` | COVERED | COVERED |  | in domain | this arm | DELETE — note-only drift |
| 163 | `accreditation_standards.accreditation_standards_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 164 | `answer_matrix_cells.answer_matrix_cells_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 165 | `answer_risk_matrix.answer_risk_matrix_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 166 | `answer_selected_options.answer_selected_options_select_targeted (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 167 | `answer_selected_options.answer_selected_options_write_targeted (ALL)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 168 | `capa_action_evidence.capa_action_evidence_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 169 | `capa_action_task.capa_action_task_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 170 | `capa_effectiveness.capa_effectiveness_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 171 | `capa_measure.capa_measure_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 172 | `capa_measure_result.capa_measure_result_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 173 | `case_assignment_roles.case_assignment_roles_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 174 | `case_narrative_revisions.case_narrative_revisions_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 175 | `case_phase_allowed_results.case_phase_allowed_results_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 176 | `case_phase_offered_results.case_phase_offered_results_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 177 | `case_type_terminology.case_type_terminology_admin_write (ALL)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 178 | `case_type_terminology.case_type_terminology_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 179 | `ethics_sanction_types.ethics_sanction_types_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 180 | `event_patient.event_patient_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 181 | `event_triage_sentinel_flags.event_triage_sentinel_flags_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 182 | `form_item_options.form_item_options_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 183 | `form_item_options.form_item_options_select_targeted (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 184 | `indicator_measurements.indicator_measurements_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 185 | `interview_session_attendance.interview_session_attendance_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 186 | `interview_summaries.interview_summaries_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 187 | `interview_topics.interview_topics_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 188 | `meeting_signatures.meeting_signatures_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 189 | `patient_xref.patient_xref_select_pqs (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 190 | `rca_evidence.rca_evidence_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 191 | `rca_factors.rca_factors_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 192 | `rca_members.rca_members_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 193 | `rca_root_causes.rca_root_causes_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 194 | `rca_timeline_entries.rca_timeline_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 195 | `rca_why_chains.rca_why_chains_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 196 | `referral_assignments.referral_assignments_select_metadata (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 197 | `referral_case_links.referral_case_links_select_metadata (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 198 | `referral_internal_notes.referral_internal_notes_select (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 199 | `referral_read_receipts.referral_read_receipts_select_metadata (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 200 | `referral_resolutions.referral_resolutions_select_metadata (SELECT)` | BLIND | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 201 | `app.can_manage_referral_source(p_referral_id uuid, p_uid uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 202 | `app.can_manage_referral_target(p_referral_id uuid, p_uid uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 203 | `app.can_write_capa(p_capa_id uuid, p_uid uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 204 | `app.is_hospital_admin_of(p_hospital_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 205 | `app.is_member_of(p_commission_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 206 | `app.is_nsp_org_admin_of(p_org_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 207 | `app.is_nsp_org_admin_of_for(p_org_id uuid, p_user_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 208 | `app.is_org_admin_of(p_org_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 209 | `app.is_pqs_operator_of(p_hospital_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 210 | `app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 211 | `commissions.commissions_admin_write (ALL)` | ERROR | COVERED |  | in domain | this arm | DELETE — the gate GAINED a verdict |
| 212 | `app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)` | COVERED | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 213 | `app.is_dpo_of(p_hospital_id uuid)` | COVERED | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 214 | `app.is_dpo_of_for(p_hospital_id uuid, p_user_id uuid)` | COVERED | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 215 | `app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)` | COVERED | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 216 | `form_item_options.form_item_options_staff_admin_write (ALL)` | COVERED | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 217 | `forms.forms_staff_admin_write (ALL)` | COVERED | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 218 | `app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 219 | `app.can_sign_meeting(p_attendee_id uuid, p_signer uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 220 | `app.event_current_custodian(p_event_id uuid, p_user_id uuid)` | ERROR | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 221 | `app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 222 | `app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 223 | `app.is_active(p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 224 | `app.is_entitled_document_approver(p_hospital uuid, p_user uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 225 | `app.is_member_of_for(p_commission_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 226 | `app.is_nsp_coordinator_of_for(p_hospital_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 227 | `app.is_pqs_member_of_for(p_hospital_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 228 | `app.is_pqs_operator_of_for(p_hospital_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 229 | `app.is_staff_admin_of(p_commission_id uuid)` | ERROR | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 230 | `app.is_tenancy_admin_of(p_commission_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 231 | `app.is_tenancy_admin_of_for(p_commission_id uuid, p_user_id uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 232 | `app.referral_target_analyst(p_referral_id uuid, p_uid uuid)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 233 | `authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid)` | ERROR | NOTICED | **H** | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 234 | `cases.cases_staff_admin_write (ALL)` | ERROR | NOTICED |  | in domain | this arm | HOLD — awaits the PO ruling on the NOTICED class |
| 235 | `app._audit_access_authorized(p_action text, p_entity_id uuid, p_commission uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 236 | `app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 237 | `app.can_manage_case_vocabulary(p_org uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 238 | `app.can_manage_professional(p_org uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 239 | `app.can_read_document(p_document_id uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 240 | `app.can_read_full_case_content(p_case_id uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 241 | `app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 242 | `app.can_write_document(p_document_id uuid, p_uid uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 243 | `app.member_can_for(p_commission_id uuid, p_capability text, p_user_id uuid)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 244 | `authz.has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 245 | `commissions.commissions_select_member_or_admin (SELECT)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 246 | `form_versions.form_versions_staff_admin_write (ALL)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 247 | `professional_profiles.professional_profiles_select (SELECT)` | COVERED | COVERED | **H** | in domain | this arm | RE-ATTACH the hand note to the new row |
| 248 | `app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)` | COVERED | (absent from this run) | **H** | FUNC LIVE secdef=true setof=false ret=boolean | this arm §7.17b (out-of-domain bool) | RE-FILE REQUIRED (census) |
| 249 | `public.commission_cadence_overview()` | COVERED | (absent from this run) |  | FUNC LIVE secdef=true setof=true ret=record | C2 (command door) | RE-FILE REQUIRED (census) then retire to C2 |
| 250 | `public.document_delete_affordances(p_document_ids uuid[])` | COVERED | (absent from this run) |  | FUNC LIVE secdef=true setof=true ret=record | C2 (command door) | RE-FILE REQUIRED (census) then retire to C2 |
| 251 | `capa_action_evidence.capa_action_evidence_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 252 | `capa_action_task.capa_action_task_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 253 | `capa_effectiveness.capa_effectiveness_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 254 | `capa_measure.capa_measure_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 255 | `capa_measure_result.capa_measure_result_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 256 | `rca_evidence.rca_evidence_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 257 | `rca_factors.rca_factors_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 258 | `rca_members.rca_members_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 259 | `rca_root_causes.rca_root_causes_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 260 | `rca_timeline_entries.rca_timeline_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 261 | `rca_why_chains.rca_why_chains_write (ALL)` | COVERED | BLIND |  | in domain | this arm | RE-FILED to FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS (2026-09-07); then DELETE |
| 262 | `app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)` | COVERED | (absent from this run) | **H** | FUNC LIVE secdef=true setof=true ret=record | C2 (command door) | RETIRE to C2 |
| 263 | `case_interviews.case_interviews_delete (DELETE)` | COVERED | (absent from this run) |  | POLICY LIVE (DELETE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 264 | `case_interviews.case_interviews_insert (INSERT)` | COVERED | (absent from this run) |  | POLICY LIVE (INSERT) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 265 | `case_interviews.case_interviews_update (UPDATE)` | COVERED | (absent from this run) |  | POLICY LIVE (UPDATE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 266 | `case_referral.case_referral_delete_draft_source (DELETE)` | COVERED | (absent from this run) |  | POLICY LIVE (DELETE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 267 | `case_referral.case_referral_insert_source_coord (INSERT)` | COVERED | (absent from this run) |  | POLICY LIVE (INSERT) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 268 | `case_referral.case_referral_update_coord (UPDATE)` | COVERED | (absent from this run) |  | POLICY LIVE (UPDATE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 269 | `meeting_cases.meeting_cases_staff_admin_delete (DELETE)` | COVERED | (absent from this run) |  | POLICY LIVE (DELETE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 270 | `meeting_cases.meeting_cases_staff_admin_insert (INSERT)` | COVERED | (absent from this run) |  | POLICY LIVE (INSERT) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 271 | `meeting_cases.meeting_cases_staff_admin_update (UPDATE)` | COVERED | (absent from this run) |  | POLICY LIVE (UPDATE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 272 | `meeting_signatures.meeting_signatures_insert (INSERT)` | COVERED | (absent from this run) |  | POLICY LIVE (INSERT) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 273 | `profiles.profiles_update_self (UPDATE)` | COVERED | (absent from this run) |  | POLICY LIVE (UPDATE) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 274 | `response_section_signoffs.signoffs_insert (INSERT)` | COVERED | (absent from this run) |  | POLICY LIVE (INSERT) | writepath | RETIRE to p0-authz-writepath-audit.sh |
| 275 | `responses.responses_delete_own_draft (DELETE)` | COVERED | (absent from this run) |  | POLICY LIVE (DELETE) | writepath | RETIRE to p0-authz-writepath-audit.sh |

#### Bookkeeping — DRAFTED, deliberately NOT APPLIED

`supabase/tests/mutation/authz-unswept-backlog.txt` carries both resolvers with an explicit
in-file instruction from the previous session: *"THE LINE BELOW IS DELETED IN THE COMMIT THAT
CARRIES THE RE-BASELINED docs/reviews/authz-door-audit-findings.md, AND NOT BEFORE"* (`:796`) and
*"SAME DELETION RULE AS THE `scope_reaches` BLOCK ABOVE"* (`:851`). That commit has not happened, so
**the file is untouched by this session**. The change, ready to apply the moment the findings file
is committed:

```
delete  :806  authz.scope_reaches(p_assignment_kind text, p_assignment_id uuid, p_resolution_kind text, p_requested_id uuid)
delete  :863  authz.candidate_has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
keep    both surrounding prose blocks; rewrite their "IS DELETED IN THE COMMIT" markers into the
        past tense and record run 2's verdict beside the 2026-09-05 subset verdict.
```

⭐ **Both resolvers earned a verdict in the full run, at the full suite shape** — the subset verdicts
of 2026-09-05 were at the same shape and are now corroborated by a 353-case run:

```
authz.scope_reaches(…)              COVERED   171_cross_org_isolation.sql, 172_phaseb_rls_rewrite.sql,
                                              255_ethics_e2_targeted.sql, 272_ff2_door_parity.sql,
                                              318_act_hat_blind_caller_gate_siblings.sql, 401_ae4_aut…
authz.candidate_has_permission(…)   COVERED   403_ae45_differential_oracle.sql, 407_ae49_resolver_contract.sql,
                                              413_ae4_authorized_scope_ids.sql
```

⛔ **`candidate_has_permission` was `ERROR` in run 1 and is `COVERED` here** — the plan's predicted
verdict, earned only once the drift was bounded. Its run-1 ERROR was an artefact, not a finding.

#### Filed this session — the C2 sibling hazard

`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET` (🟠, backend), register entry +
body. Line citations **re-anchored against HEAD `ea5783c0`, each read individually** rather than
carried from the brief:

```
:350  derive_worklist "$WORK/worklist.tsv" || exit 2                       <- captured ONCE, before any case
:764  ( cd "$ROOT" && npx supabase db reset --local ) …                    <- reassigns EVERY pg_proc.oid
:775  if ! cut -f2,5 "$WORK/worklist.reset.tsv" | sort | diff -q …         <- field 1 DROPPED, so a moved OID cannot abort
:797  local foid="$1" sig="$2" …                                           <- hash_of/snapshot/mutate address BY OID
:878  while IFS=$'\t' read -r foid name sig ndoors nraise nanchored; do    <- foid = field 1 of the stale worklist
:889  sweep_one "$foid" "$sig" …                                           <- first measurement
:922  sweep_one "$foid" "$sig" …                                           <- the RETRY, i.e. AFTER a reset
```

⚠ The hazard has never fired because a deterministic replay of the same migrations tends to
reproduce the same OIDs — masked by an incidental property, not closed by a guard, which is the
shape of `an incidental guard closes a hole the definition predicts` read the other way round. ⛔ Not
fixed here: different harness, different owner. The door arm's own copy of this hazard was closed by
ADR 0191 D8 point 2 (identity re-resolved at case time), and that is the remedy the follow-up names.

#### Gate for THIS commit — bare exit codes, nothing piped

| gate | bare rc | observed |
| --- | --- | --- |
| `npm run lint` (full chain) | — | see below |
| `npm run lint:registers` | — | see below |

⛔ **What this session did NOT run, stated rather than quietly skipped**: `npm run test:db`, the four
authz arms (`census`, `hat`, `floor`, `FROMFINDINGS=1 wrapper`) and the diff-scoped deriver. All are
**step 11**, and step 11 is blocked on the findings file being committed — `FROMFINDINGS=1` and
`ARM=census` both read that file, so running them now would measure the OLD baseline against the NEW
domain and report a bookkeeping artefact.

#### What the next session does, in order

1. Take the PO's **Q2 (CARRIED)** and **NOTICED** rulings from the lead.
2. Apply the CARRIED dispositions, then commit `docs/reviews/authz-door-audit-findings.md`.
3. In the SAME commit, delete `authz-unswept-backlog.txt:806` and `:863` and rewrite their blocks.
4. Then step 11: re-derive the four arms · `npm run test:db` · `SELFTEST=1` deriver · the
   diff-scoped deriver with `SCOPE:` quoted.
5. Then the closures (ADR 0191 amendments, the hub, the lead-playbook §4 sentence the lead lands).

### 2026-09-07 — backend: the CARRIED dispositions applied, the re-baseline committed, step 11

The PO's two rulings arrived (Q2 **CARRIED as recommended**; **NOTICED = disclosed, non-blocking,
work-listed**). This entry records what was applied, how it was verified, and what it cost.

#### The dispositions were applied BY SCRIPT, off the table — never row by row

`…/scratchpad/dispo/apply.py` (with `parse.py` as its join proof and `verify.py` as its
after-the-fact check). It reads the 275-row table in this record and the CARRIED block in
`docs/reviews/authz-door-audit-findings.md`, joins them **1:1 on (key, baseline, run-2, hand-flag)**
and refuses to run on any ambiguity. ⛔ The hand flag is RECOMPUTED from column 5 (`**`, `[merged`,
⭐ ⚠ ⛔ →) rather than read from the table, and it agrees with the table at **31/31** — so the join
key is not a restatement of the thing it is keying on.

```
CARRIED entries: 275   hand: 31          disposition rows parsed: 275   hand: 31
JOIN CLEAN — every CARRIED entry maps to exactly one disposition; entries without one: 0
actions: ARCHIVE=15  DELETE=242  RE-ATTACH=15  REFILE=3
  DELETE outright ....... 242   (131 note-only drift · 49 gate GAINED a verdict · 17 subject GONE ·
                                 17 mechanical HOLD · 13 retire-to-writepath · 11 re-filed-to-FUP ·
                                 4 second-ordinal)
  RE-ATTACH to run-2 row  15    (13 PO-carried + 2 HOLD-resolved)
  ARCHIVE to the record .. 15    (10 PO-carried + 4 HOLD-resolved + 1 RETIRE-to-C2)
  RE-FILE as a row ....... 3     (the census-mandatory three)
hand notes: 31 in -> 15 re-attached + 15 archived + 1 re-filed = 31 preserved   (ZERO lost)
```

⭐ **The hand SUFFIX is computed, not eyeballed.** A re-attach must append the hand half of the
baseline's column 5 to the RUN-2 row, and the boundary between "generated payload" and "hand prose"
is not marked in the file. The script derives it from the three shapes the baseline-era generator
could produce — a comma-separated `*.sql` list, `run-shape!=baseline (Files=N Tests=M)`, or empty —
and asserts `prefix + suffix == column 5` byte-for-byte. Two rows do not fit a generated shape and
carry an **explicit, recorded** boundary instead of a guess: `app.member_can_for`, whose baseline
column 5 is a HAND-ABBREVIATED list (`40 files incl. …`), and
`commissions.commissions_select_member_or_admin`, whose column 5 is hand prose end to end (prefix
length 0). Every one of the 15 boundaries is printed by `DRY=1` and was read before the write.

#### The 6 HOLD hand-prose rows, resolved under the NOTICED ruling — 2 re-attached, 4 archived

The PO delegated these: *"re-attach if COVERED→NOTICED keeps the note true; else archive to the
record"*. **Rule R, applied uniformly and stated so it can be checked**: RE-ATTACH iff no clause of
the hand note names THIS row's harness verdict class in a way column 4 now contradicts; ARCHIVE
otherwise. A dated tally from a NAMED subset run ("SWEPT 2 COVERED 2", 2026-08-25) is history, not
such a clause.

| # | key | move | ruling | the clause that decided it |
| --- | --- | --- | --- | --- |
| 212 | `app.can_view_printed_document(…)` | COVERED → NOTICED | **RE-ATTACH** | none — dated PDF·P1/P2/P3 provenance plus a method warning |
| 217 | `forms.forms_staff_admin_write (ALL)` | COVERED → NOTICED | **RE-ATTACH** | none — a dated 2026-09-02 subset tally plus the ARM=census warning |
| 215 | `app.is_oversight_only_reader(…)` | COVERED → NOTICED | ARCHIVE | opens *"ERROR under the harness's force-to-TRUE neutralization"* — that IS the mutation this run performed |
| 220 | `app.event_current_custodian(…)` | ERROR → NOTICED | ARCHIVE | *"ERROR is not a pass … the harness withholds a verdict"* — it no longer withholds; it discloses |
| 229 | `app.is_staff_admin_of(…)` | ERROR → NOTICED | ARCHIVE | *"still the documented load-bearing-predicate ERROR class below"* |
| 233 | `authz.holds_role(…)` | ERROR → NOTICED | ARCHIVE | *"ERROR here is INHERITED BY CONSTRUCTION"* |

The other **17** HOLD rows carry no hand prose, so the ruling leaves nothing to preserve: they are
deleted and their run-2 NOTICED rows stand on their own.

⚠ **DISCLOSED, because it is the one place the ruling and the file rub.** Of the 13 PO-carried
RE-ATTACH rows, one — `commissions.commissions_select_member_or_admin` — carries a note that opens
*"ERROR at whole-policy neutralization (run-shape)"* while its run-2 verdict is **COVERED**. It was
re-attached as ruled, and it is NOT the same failure as #215: the note names the **whole-policy**
mutation (`using` **and** `with check`), which this arm has not performed since the 2026-09-05
mirror fix. It is history about a mutation that no longer exists, where #215's names the mutation
still in force. ⛔ If the lead reads that differently, the remedy is a one-line archive, not a
rewrite of the note.

#### The re-filed three — a ROW SHAPE chosen so the loop cannot recur

`app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)`,
`public.commission_cadence_overview()` and `public.document_delete_affordances(p_document_ids uuid[])`
are re-filed as rows under a new section at the foot of the findings file, each carrying its baseline
note byte-for-byte.

⛔ **The shape is load-bearing and was chosen against the merge's own classifier, not by taste.**
`merge-findings-baseline.sh` calls a well-shaped `| `-row a VERDICT ROW if it sits under a header the
generator emits, **or** carries a generator verdict token in column 4, **or** carries a key the
generator emitted — and a verdict row absent from the next run is relocated into the CARRIED block,
where the leading-pipe test `ARM=census` uses no longer matches it. Re-filing these three with
`| gate / policy | arm | direction | verdict | note |` and a bare `COVERED` would therefore have
re-created exactly the hole it is closing, one full run later. The section uses a header the
generator never emits (`… | verdict (earned elsewhere) | evidence …`) and column 4 reads
`COVERED (targeted mutation)`, so the merge classifies all three as PROSE and preserves them in
place. The header still contains the literal `gate / policy`, which is what the census's own
`grep -vE 'gate . policy'` uses to drop a header — asserted in the script, not assumed.

#### The CARRIED block is GONE, comment included — and that is deliberate

All 275 entries were dispositioned, so nothing remains to carry. ⛔ The **comment** was removed too:
`merge-findings-baseline.sh` appends the whole block — comment and entries — only when
`carried.tsv` is non-empty, and it also aborts if a baseline prose line does not survive into the
output. An empty comment block left behind would therefore either be DUPLICATED by the next run that
carries something, or LOSE its lines and abort the next run that carries nothing. Removing it is the
only state that is stable in both directions.

#### The findings file, asserted — `SELFTEST=1 MERGE_VERIFY` does not apply to a hand-dispositioned file

`MERGE_VERIFY` answers "did THIS merge lose anything", and no merge ran here. The equivalent
assertions were made directly on the artefact (`verify.py`, every one green):

| assertion | measured |
| --- | --- |
| `HAND-MERGED` blockquotes | **9 / 9** |
| `## Note` sections | **7 / 7** |
| generated verdict rows | **353** |
| + the census re-files | **3** — `verdicts_from_findings` delta vs the pre-disposition file is EXACTLY those three keys and nothing else |
| `verdicts_from_findings` over the new file | **356 keys, 356 unique, 0 `gate / policy` literals** |
| the 15 re-attached hand suffixes | each present **byte-for-byte**, each on its own run-2 row, grepped by key (`-F`, fixed string) |
| the 15 archived baseline rows | each present **byte-for-byte** in this record's archive block AND absent from the findings file |
| the 3 re-filed notes | each present **byte-for-byte** in its new row |
| the 242 deleted rows | all gone; **0** survived by accident (their whole row text searched, not their key) |
| CARRIED residue | **none** — 0 `baseline row carried verbatim` entries, 0 `<!-- CARRIED:` comments |
| line endings | LF preserved; file 2043 → 976 lines (the CARRIED block out; the census section, the NOTICED
definition and DOMAIN-STATEMENT population 5 in) |

⛔ **The one thing these assertions do NOT prove**, stated rather than left to be inferred: that the
353 verdicts are *right*. They prove the disposition moved exactly what the ruling said and lost
nothing. The verdicts are run 2's, unchanged by this session.

#### Bookkeeping — APPLIED, in the same commit, as the file's own instruction required

`supabase/tests/mutation/authz-unswept-backlog.txt`: both resolver entries deleted and both marker
blocks rewritten into the past tense, with run 2's verdict recorded beside the 2026-09-05 subset
verdict. ⚠ Line citations re-anchored at the current text before editing (the record's `:806` /
`:863` were anchored at an older HEAD): the entries were at `:806` and `:863`, their markers at
`:796` and `:851`. Live (non-comment) entries **103 → 101**.

#### The NOTICED ruling, encoded WHERE THE RESULT LINE IS COMPUTED

⛔ The ruling is a change to an **exit code**, so putting it only in prose would leave the thing a
gate reads unchanged. `p0-authz-door-audit.sh`'s final `if/elif` chain was **extracted into
`emit_result()`** — inline, the only way to exercise it was a 15-hour sweep, which is why the NOTICED
class shipped with its classifier tested and its exit semantics untested.

- **RESULT line separates the classes**: `DIRTY — N BLIND (blocks) · M NOTICED (disclosed,
  non-blocking — evidence, not a verdict) · K ERROR (not a pass)`. The old line read
  `N BLIND, M NOTICED, K ERROR`, which invited a reader to sum three different claims.
- **Exit semantics**: unchanged for BLIND and ERROR (1), merge abort (2), `swept=0` / UNMATCHED (3).
  **Changed**: 0 BLIND ∧ 0 ERROR ∧ >0 NOTICED now exits **0**, printing
  `RESULT: CLEAN WITH DISCLOSURE — … 0 BLIND · 0 ERROR · N NOTICED (disclosed, non-blocking …)`.
- **Precedence asserted, not assumed**: a merge abort still outranks everything; UNMATCHED still
  outranks a bare NOTICED (and its line no longer claims "all COVERED", which would be false beside
  a NOTICED count).
- The definition is carried in `emit_body`'s header AND as a fifth `DOMAIN-STATEMENT` population, so
  the statement a gate record must quote now carries the class. Both texts were re-emitted into the
  committed findings file and **diffed byte-for-byte against the emitter** (`DIFF_RC=0` for the
  DOMAIN-STATEMENT block and for the 8-line header block) — otherwise the next merge would preserve
  the old prose *and* add the new.

**SELFTEST arm 3 — `emit_result()`, 8 cases, with its control.** ⛔ The control is the PAIR
`(0 BLIND, 0 ERROR, 1 NOTICED) → rc 0` vs `(1 BLIND, 0 ERROR, 1 NOTICED) → rc 1`: same NOTICED count,
opposite code. Without both halves a green row would prove only that the function returns a number.
The DISCLOSURE half is asserted too — an rc 0 that printed no NOTICED line would be a SILENT pass,
which is worse than the DIRTY it replaces.

```
--- SELFTEST classify: 6/6 ok, 0 failed ---
--- SELFTEST resets_enabled: 6/6 ok, 0 failed ---
--- SELFTEST emit_result: 8/8 ok, 0 failed ---
--- SELFTEST TOTAL: 20/20 ok, 0 failed ---            bare rc 0
```

⭐ **And the arm was proven able to FAIL, not just to pass.** A mutant of the harness restoring the
pre-ruling behaviour (`|| [ "$noticed" -gt 0 ]` back in the DIRTY test) reds **exactly the two rows
that encode the ruling and no others**, bare rc **1**:

```
  NOT OK 0 BLIND, 0 ERROR, 1 NOTICED    -> rc=1 (expected 0) / missing CLEAN WITH DISCLOSURE
  NOT OK   ...and it PRINTS the count   -> rc=1 (expected 0) / missing 1 NOTICED (disclosed, non-blocking
  ok    1 BLIND, 0 ERROR, 1 NOTICED     -> rc=1
```

#### Hand notes archived at the Batch 2 re-baseline (2026-09-07)

Every hand note the PO ruling removed from `docs/reviews/authz-door-audit-findings.md`,
preserved verbatim so nothing is lost by the deletion. **15 rows.** Each entry carries the
key, the baseline verdict, the run-2 verdict, the WHOLE baseline row byte-for-byte, and the
reason it was archived rather than re-attached.

- `app.patient_trajectory_bundle(text, text, uuid)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | app.patient_trajectory_bundle(text, text, uuid) | internal helper, service_role-ONLY | targeted neutralization | COVERED | 350 t6 (hospital scope removed) + t10 (case-grain fix reverted). ⚠ NOT `authenticated`-reachable — 152 §M1 is the ACL guard, and it caught this slice widening it by reflex |
  ```

- `authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | authz.has_direct_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text) | predicate | positive | COVERED | 401_ae4_authz_catalog.sql,403_ae45_differential_oracle.sql (SWEPT 2026-09-01, the FIRST run of any arm over the `authz` schema — AE4.7b widened every domain bound to `('app','public','authz')` after QA finding F7 measured the schema outside all five arms. ⛔ Not a re-sweep: this gate had NO verdict in any direction since 20261003007170 created it) |
  ```

- `public.attest_dsr_task(uuid, text, integer, text)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.attest_dsr_task(uuid, text, integer, text) | command door (void) — **re-verdicted (retirement)** | targeted neutralization | COVERED | 350 t69. ⚠ **GREEN on first probe** — the `blocked` arm was added deliberately (guarding one of a sibling pair is the omission class) and had NO keystone, because the brief named only `complete_dsr_task` and nobody was owed a test for a fix the engineer invented. t69 exists because the battery found it |
  ```

- `public.attest_dsr_task(uuid, text, integer, text)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.attest_dsr_task(uuid, text, integer, text) | command door (void) | targeted neutralization | COVERED | 350 t44/t45 (gate), t40/t41/t42 (the three required fields), t43 (kind guard), t49 (⭐ the minted PROCEDURE survives, compared byte-for-byte against a snapshot — a `length > 0` check would have passed the overwrite), t48/t50 (the count reaches the outcome record) |
  ```

- `public.close_dsr_request(uuid, text, text, text)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.close_dsr_request(uuid, text, text, text) | command door (void) — **re-verdicted (retirement)** | targeted neutralization | COVERED | 350 t65/t66/t68 (the retirement removed). ⛔ **The over-grant twin for the retirement GUARD is not constructible** — the granting path raises HCDS4 unless pending is already zero, so the `update … where status='pending'` matches nothing whether guarded or not. Inverting the guard to `if true` left the suite GREEN; the vacuous twin was REMOVED and the mechanism recorded in 350's tail. What protects the granting path is t36 (HCDS4), which IS falsifiable |
  ```

- `public.complete_dsr_task(uuid, text)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.complete_dsr_task(uuid, text) | command door (void) — **re-verdicted for Slice 3** | targeted neutralization | COVERED | 350 t39 (attest_review is REFUSED and routed to attest_dsr_task). ⭐ **Gate + EFFECT check RE-PROBED 2026-08-20 against the twice-rewritten body** (QA r1): effect check disabled → **RED** at 349 t19/t21; gate → RED at 349 t17/t18. Supersedes the inherited Slice 2 verdicts. ⚠ Both re-probes first ran against `350` alone and returned PASS — the wrong domain, since their keystones live in **349**; a verdict is meaningless unless the suite run CONTAINS the keystone being falsified |
  ```

- `public.create_dsr_request(uuid, text, text, text, integer)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.create_dsr_request(uuid, text, text, text, integer) | command door (uuid) — **re-verdicted for Slice 3** | targeted neutralization | COVERED | 350 t13 (the per-commission attested arm), t14 (⭐ **the over-mint twin** — Hospital B holds no prose and must mint NOTHING; a detector that fires for everything is as wrong as one that fires for nothing), t15/t16 (intake still never mints `dispose_meeting`). ⭐ **Gate RE-PROBED 2026-08-20 against the Slice 3 body** (QA r1): opened → **RED** at 349 t6/t7/t8 + t32p. Supersedes the inherited Slice 2 verdict — a rewritten door inherits nothing, symmetric with this project's rule for a rewritten pin |
  ```

- `public.list_my_dsr_task_commissions(uuid)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.list_my_dsr_task_commissions(uuid) | command door (jsonb) | targeted neutralization | COVERED | 350 t57–t60 (BUG-DSR-S3-002 hand-merge 2026-08-20). 3 probes: gate removed → t59; hospital-wide join instead of the task's commission → t60; returns nothing → t57/t58/t60. ⚠ **t58 (the policy-drift differential) does NOT red on the hospital-wide join** — at that point the two sets coincide, and only t60's deletion separates them. The two pins are complementary; a suite carrying only the differential would have scored that mutation COVERED |
  ```

- `public.list_my_executable_dsr_tasks(uuid)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.list_my_executable_dsr_tasks(uuid) | command door (jsonb) — **re-verdicted for the refusal-retirement fix** | targeted neutralization | COVERED | 350 t66 (status filter removed → retired tasks still offered) + t67 (filter flipped to `done`). ⚠ It had **no status filter at all** since Slice 2, so it offered `done` tasks as executable too — a pre-existing coarseness the `blocked` sweep exposed rather than caused; 349 t32q had to be repointed at a genuinely pending task |
  ```

- `public.search_patient_xref(text, text, uuid)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: ARCHIVE the prose, then delete
  — reason: PO-carried disposition: subject GONE from the live domain, hand prose preserved here

  ```
  | public.search_patient_xref(text, text, uuid) | command door (outside every arm's domain — jsonb) | targeted neutralization | COVERED | 350 t4/t5/t7/t8/t9 (DSR Slice 3 hand-merge 2026-08-20). ⭐ **The one named widening** (ADR 0130 D3). Four independent probes: DPO arm removed → t4; PQS arm removed (the over-narrow twin) → t8; whole gate opened → t5/t7; audit suppressed → t9 |
  ```

- `app.event_current_custodian(p_event_id uuid, p_user_id uuid)` — baseline **ERROR** → run 2 **NOTICED** — disposition: HOLD — awaits the PO ruling on the NOTICED class
  — reason: note asserts “ERROR is not a pass … the harness withholds a verdict”; the harness now emits NOTICED for exactly this case, so the clause is contradicted by column 4

  ```
  | app.event_current_custodian(p_event_id uuid, p_user_id uuid) | predicate | positive | ERROR | run-shape!=baseline (Files=218 Tests=7199). ⭐ **ARM WIDENED (ADR 0079 Amendment 9 / `FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`).** This gate entered the predicate arm on 2026-08-24, when the arm stopped bounding its domain by NAME alone and began admitting a `prosecdef` boolean whose BODY references an identity primitive. It had never been swept in any direction before; it was in `authz-unswept-backlog.txt`. Measured by a subset run on a FRESH `supabase db reset`, baseline `Files=218, Tests=7223, PASS`, `ARM-DOMAIN predicate=8/110`; transcribed here because a subset run overwrites this file and is then reverted. ⛔ **ERROR is not a pass.** `140_patient_safety.sql` fails its test 11 and then ABORTS ("planned 35, ran 11"), so the run shape moved and the harness withholds a verdict — correctly, per §7.15. The suite DID notice; converting that into a COVERED needs a bespoke neutralization. Registered as `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE`. |
  ```

- `app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)` — baseline **COVERED** → run 2 **NOTICED** — disposition: HOLD — awaits the PO ruling on the NOTICED class
  — reason: note opens “ERROR under the harness's force-to-TRUE neutralization” — that IS the mutation this run performed, and its outcome is now NOTICED, so the clause would contradict column 4

  ```
  | app.is_oversight_only_reader(p_case_id uuid, p_uid uuid) | predicate | positive | COVERED | ERROR under the harness's force-to-TRUE neutralization — this predicate is DENY-shaped (true ⇒ deny everyone), so opening it breaks the run shape rather than widening reach. "ERROR is not a pass": covered ARM-SCOPED by q1 `open_write_doors` (neutralizes its USE in all three D7 doors) → 308 §6.1/§6.2 RED-PROVEN |
  ```

- `app.is_staff_admin_of(p_commission_id uuid)` — baseline **ERROR** → run 2 **NOTICED** — disposition: HOLD — awaits the PO ruling on the NOTICED class
  — reason: note asserts “still the documented load-bearing-predicate ERROR class below”; the row is no longer in the ERROR class

  ```
  | app.is_staff_admin_of(p_commission_id uuid) | predicate | positive | ERROR | run-shape!=baseline (Files=253 Tests=8174) — RE-SWEPT 2026-09-01 (AE4.7b diff-scoped, baseline Files=253 Tests=8467). ⚠ The body changed twice underneath this row (AE4.6 re-pointed it at the catalog, AE4.7b collapsed it onto `authz.holds_role`) and the VERDICT did not: still the documented load-bearing-predicate ERROR class below, re-measured rather than carried across |
  ```

- `authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid)` — baseline **ERROR** → run 2 **NOTICED** — disposition: HOLD — awaits the PO ruling on the NOTICED class
  — reason: note asserts “ERROR here is INHERITED BY CONSTRUCTION”; the row is no longer in the ERROR class

  ```
  | authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid) | predicate | positive | ERROR | run-shape!=baseline (Files=253 Tests=8170) — the AE4.7b chokepoint, swept on the migration that created it. ⛔ ERROR here is INHERITED BY CONSTRUCTION, not coincidence: this function IS `is_staff_admin_of(_for)` now, so neutralizing it opens both wrappers at once and destabilises the suite shape exactly as they do. See the load-bearing-predicate note below for what the run actually produced |
  ```

- `app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)` — baseline **COVERED** → run 2 **(absent from this run)** — disposition: RETIRE to C2
  — reason: PO-carried disposition: RETIRE to C2 — deleted here, prose preserved; its own note measures that NO census entry is owed

  ```
  | app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid) | row-door | positive | COVERED | 342_dm5_s3_printed_renditions.sql (NEW at DM5·S3, migration 20260927000330, ADR 0120 D12 — the shared byte resolver both `open_document_version` and `open_printed_document` delegate to. ⚠ **NO CENSUS ENTRY IS OWED, and that is a measured claim, not an omission.** ARM 3's row-door clause is `p.proretset AND has_function_privilege('authenticated', p.oid, 'EXECUTE')`; this function is `proretset` but its EXECUTE is granted to **postgres only** and revoked from PUBLIC, so it is outside the domain by construction. That is the census's own stated justification correctly not applying — *"a row-returning door is a gate you can walk through"* — because nothing but the owner can walk through this one. `ARM=census` re-run after it landed: live **546**, unchanged. Its coverage is therefore ENTIRELY bespoke, exactly as ADR 0120's Consequences predicted for every DM5 door: 342 S3h1 pins the ACL in all three directions (PUBLIC/anon/authenticated), S3g1/S3g2 pin that it is rendition-parameterized while the core door still passes only `'source'`, and S3c5/S3i1 exercise both outcomes of the D12 conjunction end to end) |
  ```

#### Step 11 — the gate, on a FRESH reset, every code read BARE and nothing piped

`git status --short` was empty before the reset (the re-baseline commit `b59d4bbf` had landed).

| gate | bare rc | observed |
| --- | --- | --- |
| `npx supabase db reset --local` | **0** | ⛔ run from the repo root, so it targets `supabase_db_azkbbhskturikxpgmafq` and not the second stack (`escalume`) that is also up on this machine |
| `npm run lint` (full chain) | **0** | eslint 0 errors / 0 warnings; `check-docs-registers: OK`; ratchets unchanged except `longHeadings 91→90` |
| `npm run typecheck` | **0** | `tsc --noEmit`, silent |
| `npm run test:db` | **0** | `Files=262, Tests=8876, Result: PASS`, 112 wallclock secs — **shape UNMOVED** against the run's own baseline |
| `ARM=census` | **0** | `INVARIANT HOLDS` · live authz gates **581** · gates carrying a verdict **602** · extension-owned excluded 0 · no unswept newcomer |
| `ARM=hat` | **0** | `INVARIANT HOLDS` · self-test **7/7** · anchors carry the active-role condition · 4 findings, all reasoned-allowlisted |
| `ARM=floor` | **0** | `INVARIANT HOLDS` · authenticated-reachable `prosecdef` doors with 0 calls **63**, every one on the allowlist, every allowlist entry resolving to a live door |
| `FROMFINDINGS=1 ARM=wrapper` | **0** | `INVARIANT HOLDS` · BLIND set size **41** ⊆ allowlist |
| `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0` |
| `SELFTEST=1 bash …/p0-authz-door-audit.sh` | **0** | classify **6/6** · resets_enabled **6/6** · emit_result **8/8** · TOTAL **20/20** |
| `bash -n …/p0-authz-door-audit.sh` | **0** | — |
| diff-scoped deriver, `main..HEAD` | **3** | `NOT-APPLICABLE — no migration file in the diff` |

`SCOPE:` line, quoted rather than summarised:

```
SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
       0 case(s) — nothing was derived, and the line above is what the gate record
       quotes to say so.
```

⛔ **This unit is a HARNESS change, not a gate change**, and the deriver's rc 3 is the checkable
form of that claim rather than a convenient silence: `git diff --name-only main...HEAD --
supabase/migrations supabase/seed.sql src` is **empty**, so no policy and no `prosecdef` gate
changed and no diff-scoped sweep is owed in either arm. ⭐ The same run also re-verifies the lift
this widening depends on: `PRED_DOMAIN lifted whole (10 line(s)), 3 sub-vars expanded, no residual $`.

⭐ **THE CENSUS GREEN IS PROVEN NON-VACUOUS, because a bookkeeping arm that passes for the wrong
reason is worth nothing.** The claim under test is that the census now accounts the 2 resolvers
(whose backlog entries this commit deleted) and the 3 census-mandatory re-files. Negative control:
delete exactly those five rows from the findings file and re-run.

```
ARM=census, five rows removed  ->  bare rc 1, INVARIANT VIOLATED, verdicts 602 -> 597, and it NAMES:
      app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)
      authz.candidate_has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
      authz.scope_reaches(p_assignment_kind text, p_assignment_id uuid, p_resolution_kind text, p_requested_id uuid)
      public.commission_cadence_overview()
      public.document_delete_affordances(p_document_ids uuid[])
file restored: md5 8043002f28f125d4d6eee3186720100a before AND after (`git checkout --`), diff rc 0
```

⚠ **The verdict-set figure moved and the movement is explained, not waved through**: 625 → **602**
(−23). The door findings file lost 43 verdict keys (399 → 356 + 3 re-files); most were also carried
by another findings file, so the UNION fell by 23. ⛔ The load-bearing claim is not the number — it
is `no unswept newcomer WITHIN THIS ARM'S DOMAIN`, which is the arm comparing **581 live gates**
against the verdict-carrying set. Had any deleted key been live and in domain with no verdict
anywhere, the arm would have named it; it named none. The 13 `POLICY LIVE (INSERT/UPDATE/DELETE)`
rows retired to the write arm are the sharpest case — every RLS policy is in the census's domain, so
if the write findings file did not carry them this arm would have reddened.

#### ⛔ A REAL FINDING AT STEP 11, and it is DISCLOSED rather than filed away quietly

`FROMFINDINGS=1 ARM=policy` — **not** one of CLAUDE.md §6's four arms, but an arm, and it reads the
file this unit re-baselined — is **RED, bare rc 1**.

⛔ **It was ALREADY RED before this session's commit**, and that is measured rather than assumed. I
replicated its selector (`blind_from_findings` over door + writepath + rowdoor, minus
`authz-blind-allowlist.txt`) against `git show HEAD~1:…` and against HEAD:

```
at main / HEAD~1 : BLIND union 72   offenders 16      (door section rows: 68)
at HEAD          : BLIND union 78   offenders 24      (door section rows: 74)
offenders NEW ∖ OLD (11): the 5 capa_*_write + the 6 rca_*_write (ALL) policies
offenders OLD ∖ NEW  (3): app.can_read_document_object, attachment_references_select,
                          attachment_subjects_select — subjects that no longer exist
```

So the re-baseline adds exactly the **11 mirror flips** — already enumerated, already re-filed to
`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`, and DISCLOSED under PO ruling Q1 — and removes 3 dead
subjects. ⛔ They were deliberately NOT added to `authz-blind-allowlist.txt`: the PO ruled that
keystoning them is its own increment and that a flipped row is never relabelled to keep it COVERED,
and an allowlist entry is the relabelling's quieter cousin.

⭐ **AND THE ARM'S BLIND SET IS WRONG BY CONSTRUCTION — a NEW finding, surfaced by the first real
full-run merge.** `blind_from_findings` selects rows by MEMBERSHIP OF THE `## BLIND` SECTION, not by
column 4. The merge rewrites a row's verdict IN PLACE, at its baseline position, so after a merge
section and verdict disagree:

```
the `## BLIND` section holds 75 rows: 36 carry BLIND, 38 carry COVERED (the BLIND -> COVERED
transitions), 1 is the header.   BLIND rows sitting OUTSIDE that section: 0.
=> the arm reports a door BLIND set of 74 where the run measured 36.
```

⚠ Today it costs **nothing**: all 38 phantoms are already on the blind allowlist, so **0 of the 24
offenders is false** (measured, `comm -12`). ⛔ But the mechanism is a stale-finding generator — a
gate that was BLIND-and-unallowlisted and has since been keystoned would go on being named as new
door-blindness for ever, which is the failure mode that trains a reader to stop reading the arm.
Filed as `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` (🟡, backend). ⛔ Not fixed
here: it is a different harness, and re-predicating a selector at step 11 without a plan is exactly
how one gate's repair inverts another's failure mode.

> ⛔⛔ **CORRECTION — 2026-09-07, QA `F-BLOCK-1`. The paragraph above is left unedited; its second
> sentence is FALSE, and false in the reassuring direction.** "0 of the 24 offenders is false" is
> **12 of the 24**. The two sets it compares are different populations: the 38 phantoms are the
> `BLIND -> COVERED` rows still sitting in the `## BLIND` section, of which **26 are allowlisted and
> 12 are not**; `comm -12` suppresses only column 1, so it prints "common" ∪ "only in file 2" — a
> long list that reads as *all accounted for*. The test the claim needed is `offenders ∩ phantoms`.
>
> **RE-MEASURED 2026-09-07**, read-only, by re-implementing `blind_from_findings`
> (`p0-authz-invariant.sh`) and `allow_body` and running them over `git show main:` and the working
> tree — the arm itself was NOT run. The 16 → 24 / +11 / −3 half of the disclosure reproduces
> exactly; only the composition was wrong:
>
> ```
> main     : BLIND union 72   allowlist 59   offenders 16
> 6f94a634 : BLIND union 78   allowlist 59   offenders 24
> of the 24 offenders: 12 carry BLIND in column 4 — GENUINE
>                      12 carry COVERED in column 4 — FALSE, and named anyway
> every one of the 12 false: BLIND at main -> COVERED at HEAD, absent from authz-blind-allowlist.txt,
> and sitting inside the `## BLIND` section (74 rows) at HEAD.
> ```
>
> The 12 **genuine** offenders: the 11 mirror flips (5 `capa_*_write` + 6 `rca_*_write`, all `(ALL)`)
> plus `referral_requested_actions.referral_requested_actions_write_admin (ALL)`.
> The 12 **false** offenders, enumerated so the next reader does not have to re-derive them:
>
> ```
> accreditation_standards.accreditation_standards_select (SELECT)
> answer_selected_options.answer_selected_options_select_targeted (SELECT)
> answer_selected_options.answer_selected_options_write_targeted (ALL)
> case_assignment_roles.case_assignment_roles_select (SELECT)
> case_narrative_revisions.case_narrative_revisions_select (SELECT)
> ethics_sanction_types.ethics_sanction_types_select (SELECT)
> form_item_options.form_item_options_select_targeted (SELECT)
> referral_assignments.referral_assignments_select_metadata (SELECT)
> referral_case_links.referral_case_links_select_metadata (SELECT)
> referral_internal_notes.referral_internal_notes_select (SELECT)
> referral_read_receipts.referral_read_receipts_select_metadata (SELECT)
> referral_resolutions.referral_resolutions_select_metadata (SELECT)
> ```
>
> ⛔ **STATED PLAINLY, because the corrected sentence changes what the arm's red MEANS.**
> `FROMFINDINGS=1 ARM=policy` at this tree reports **12 stale offenders that are not BLIND**. The
> stale-finding generator is not latent, it is **already generating**, and this re-baseline is what
> started it. `ARM=policy` is NOT one of the four arms §6 step 1 requires (`census`, `hat`, `floor`,
> `FROMFINDINGS=1 wrapper`), and its red predates this unit (16 offenders at `main`) — but until
> `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` is fixed, **its red is not readable**:
> a reader cannot tell a genuine un-keystoned gate from a section-stale row without redoing the
> column-4 join by hand.
> ⛔ **The fix is the sentence, not the allowlist.** Allowlisting the twelve would be the
> relabelling the PO's Q1 ruling prohibits and the follow-up's own ⛔ bar forbids.
> ⚠ And the shape is this unit's own subject turned on itself: a prose claim ABOUT a measurement,
> written beside a correct measurement, that no gate can contradict — `LEARN-049` inside the
> disclosure that describes `LEARN-049`. Registered as `LEARN-088`.

#### The targeted-case home — it has NO self-check, stated rather than skipped silently

`supabase/tests/mutation/authz-setvalued-targeted-cases.sh` has **no `SELFTEST` mode**: `grep -n
'SELFTEST\|SELF-TEST\|selftest'` prints nothing. Its two controls — §4a (the residue detector) and
§4b (the cardinality control asserting the live set-valued population is exactly the 5 this file
rules on) — are IN-RUN preflights that fire before the first case, so exercising them means running
the whole harness (~4 suite runs). Its three verdicts were earned on 2026-09-05 and nothing in this
commit touches its subjects, so it was not re-run. ⛔ Recorded as a gap in the harness, not as a
gate that was skipped: a home whose controls cannot be exercised without a 10-minute run is one more
reason the scheduling line matters.

#### Closures — five, each on its QUOTED condition, clause by clause

Rotated per lead-playbook §5 by `…/scratchpad/dispo/close.py`: byte-extract the register entry and
the body, assert every non-blank line of both survives into the archive block, then cut. Body files
deleted; no id keeps a `### ` heading in the open register (asserted).

| follow-up | closed on | ⚠ disclosure |
| --- | --- | --- |
| `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` | the BODY's `**What would close it.**` | word-identical to the register field here, so the two agree |
| `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` | the BODY's `**What would close it.**` | ⛔ the register field is **truncated mid-word** (`…with tw…`, a literal U+2026), so it is not a complete condition at all |
| `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` | the BODY's `**What would close it.**` | word-identical; the body adds only the ⛔ negative |
| `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` | the BODY's `**Decide between:**` | ⛔ **the body states NO closing condition** — it offers two options. The register field is a flattened rendering of that list (with a stray `; or;` joint), i.e. a register-side reading of options as a condition. Precedent for this exact disclosure: the archived `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS`, whose register field read "PO to rule" |
| `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` | the BODY's `## Closes when` | ⚠ the register field is a STRICT SUBSET — it drops the body's two named discharge routes and the reasoned ⛔ bar entirely |

⛔ **Two clauses are NOT discharged, and both are named in the closure text rather than absorbed:**

1. **The set-valued home's SCHEDULE.** The body asks for a committed home *"so they run on a
   schedule rather than when someone remembers"*. The home is committed; the schedule is one line in
   `docs/lead-playbook.md` §4, which no teammate but the lead may write. ⛔ A residual living only
   inside an archived closure note is a residual nobody can audit, so it has its own open entry:
   **`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`** (🟠, owner **lead**), whose condition is
   "paste the sentence drafted verbatim in this record".
2. **The trigger-enforcer clause's WORD.** It asks that a trigger-caused BLIND be *distinguishable*
   from an absent-assertion BLIND. The delivered `DOMAIN-STATEMENT` says the opposite in as many
   words — *"INDISTINGUISHABLE here"* — and makes the REMEDY distinguishable instead (a keystone on
   a fixture the trigger does not already refuse, vs a keystone on the door). Neither of the body's
   two named routes was built, and the closure says so in numbered clauses 3 and 4 rather than
   letting the ✅ column imply otherwise.

**Two new follow-ups beyond those** (both 🟠/🟡, backend): `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`
(the 4 of 23 with no authz-shaped file reddening outside the aborting file — filed as a SIBLING
rather than into `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`, because that body says in terms that NOTICED
rows are *"not work items in this follow-up"*, and appending them there would have contradicted its
own sentence) and `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`.

**Work-lists written, not merely pointed at**: `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`
gains a dated `## The WORK-LIST — 23 measured sites` section carrying every NOTICED row of run 2
with its aborting file(s), the discharge condition per row, and the measured facts that keep it
honest (all at `Files=262`; zero abort in an authz meta-test; 15 distinct signatures; all 23
reproduced after a reset).

**The archived `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` gains a dated note.** Its
closure had said, in its own words, *"⛔ NO SWEEP WAS RUN"* — the merge was proven on copies. The
note records that the first REAL full run preserved **426/426** hand-authored prose lines, **9/9**
`HAND-MERGED` blocks, **7/7** `## Note` sections, **11** spliced suffixes and **275** carried rows,
verified three ways, and states what it does **not** retire (the option-(b) design, and the standing
⚠ that the startup warning is a hint, not a gate).

#### Registers, after

`lint:registers` **bare rc 0**: follow-ups 208 → **206** (5 closed, 3 filed), follow-up bodies 163 →
**158**, ratchet `longHeadings` 91 → **90**. ⚠ `FUP-SETVALUED-…` was rejected by the CODES gate on
its first write (`uses no registered code`) and renamed to `FUP-AUTHZ-SETVALUED-…` — the gate
working, and worth recording because the id is cited from the archive.

#### For the lead — the SECOND §4 line, drafted here, not applied

The first (the targeted home's scheduling sentence) stands unchanged above. The second is the
NOTICED class, which every gate record citing this sweep must now carry:

> **NOTICED (door sweep)** — a gate whose neutralization reddened the suite while a pgTAP file
> ABORTED. It is coverage **EVIDENCE, not a verdict**: the denominator moved, so the failing
> assertions cannot be attributed to that gate. ⛔ It is never COVERED and never a pass, and a
> NOTICED row is an UNRESOLVED gate. **It does NOT block the phase — BLIND does** (PO ruling
> 2026-09-07), and a run with 0 BLIND and 0 ERROR exits 0 printing `CLEAN WITH DISCLOSURE`. Quote
> the NOTICED count beside the BLIND count in every gate record, with the remedy's follow-up id
> (`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`). Never report BLIND + NOTICED as one
> number: they are three different claims and only one of them blocks.

#### What the next session does

1. QA review of the unit, then PO approval, then the lead's §5 Record step.
2. The lead lands the two §4 lines above (`docs/lead-playbook.md` is outside the engineer's scope).
3. Nothing else is in flight: `git status --short` is empty and no production file changed on this
   branch (`git diff --name-only main...HEAD -- supabase/migrations supabase/seed.sql src` empty).

---

### 2026-09-07 — backend: QA fix loop, iteration 1

**Input**: `docs/reviews/pred-domain-review.md` at `6f94a634` — **CHANGES REQUESTED**, 3 blocking +
9 major, nine of eleven questions clean, nothing touching RLS, a migration or `src/`. Branch tip on
entry `efbaa25f`. ⛔ **Every corrected claim was RE-MEASURED, never re-worded from the report** —
that discipline is the point of the loop, because the whole finding class is *a prose claim about a
measurement that no gate can contradict*.

#### What was measured, and what the measurement said

| finding | the claim | what I measured |
| --- | --- | --- |
| F-BLOCK-1 | "0 of the 24 `ARM=policy` offenders is false" | **12 of 24 are false.** Re-implemented `blind_from_findings` + `allow_body` read-only over `git show main:` and the tree — the arm was NOT run. `main`: BLIND 72 / allow 59 / **16** offenders. HEAD: 78 / 59 / **24**. Of the 24: 12 carry `BLIND` in column 4 (genuine), 12 carry `COVERED` (false), all 12 BLIND at `main` → COVERED at HEAD, all 12 absent from the allowlist, all 12 inside the 74-row `## BLIND` section |
| F-BLOCK-2 | the three set-valued verdicts are filed | **They were nowhere a census can read.** Filed as rows; `verdicts_from_findings` 356 → **359**, 359 unique. Column 1 measured from the catalog with `pg_get_function_identity_arguments` |
| F-BLOCK-3 | `public.reopen_interview` BLIND, trigger-delivered | **COVERED since 2026-09-04.** The MECHANISM is real and still live; the TENSE was wrong. `app.guard_interview_status`: `prosecdef=t`, returns `trigger`, wired on `case_interviews` (catalog, 2026-09-07) |
| F-MAJOR-5 | "23/23 strict superset" | **21/23.** Re-parsed every NOTICED row's column 5 by pipe INDEX. Two exceptions named. The claim the ruling needs — `reddened:` non-empty — is 23/23 |
| F-MAJOR-7 | "derived … never literal" | **4 of 5 populations are literals**, and no committed query in this tree derives the `HCDS*` / `28000` / C2-ERROR figures (grepped). The defect is the LABEL |
| F-MAJOR-2 | one corrupted note | **Unique**: 1 hit for `.sql` followed by a letter across every column-5 cell of the door file; **0** across the four sibling findings files |

#### F-BLOCK-2 — the two-step order, and why DELETE was right

The row was filed and `app.current_professional_read_organizations()`'s backlog line deleted **in
the same commit**, which is the rule the two boolean blocks above it in `authz-unswept-backlog.txt`
state. ⭐ **Proven from `run_arm_census`'s own accounting rather than preferred**: `accounted` is a
`sort -u` union of the verdict sets AND `allow_body "$UNSWEPT"`, so an entry present in both files
collapses to one line — keeping it could **not** double-count. What keeping it WOULD create is the
stale entry `FUP-AUTHZ-UNSWEPT-BACKLOG-STALE-ENTRY-HAS-NO-ARM` was filed about. Deleting is safe
only because the filed key is byte-identical to `census_proc_domain`'s emission, and that identity
— not the deletion — is the load-bearing fact.

⛔ **A second defect found while filing, and it is why the step was skippable.** The harness's
printed rows are un-filable on two axes: column 1 is the shorthand
`authz.authorized_scope_ids(uuid,text,text)` (the census keys on the identity-argument form), and
the header is generator-shaped with a bare `COVERED` in column 4 — a row in that shape is classified
a verdict row by the merge, relocated into the CARRIED block on the next full run, and, carried rows
being INDENTED, stops matching the census's leading-pipe test. Both were hand-corrected here; filed
as `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` rather than fixed, because validating a writer
needs three full-suite passes on a fresh reset, which this loop did not have.

#### F-BLOCK-3 — the witness is now HISTORICAL, DATED and true, and the absence is stated

`121_interviews.sql:297` pinned only the CODE (`throws_ok(…, 'HC038', null, …)`), so under mutation
the trigger's `HC038` satisfied it against the wrong enforcer — a real BLIND with a real mechanism,
on 2026-09-02. `121_interviews.sql:565` discharged it by pinning the door's OWN message on an
`awaiting_follow_up` fixture the trigger cannot pre-empt, which is **exactly the remedy the bullet
names**. ⛔ And the emitter now says what was otherwise inferred: **no BLIND door on this stack is
attributable to a trigger today** (C2 is 170/1/0 and the one BLIND, `app.print_source_series`, has
no trigger in its path), so population 4 is **ASSERTED**, bounded by its two derived counts,
witnessed only historically. That satisfies QA's Q8 condition 2 in the honest direction.

#### The new SELFTEST arm, and its two mutation proofs

Door harness `SELFTEST` 20 → **23/23**. ARM 4 asserts the Tier-2 sentence byte-exact, with the
expectation **EXTRACTED FROM ADR 0187**, never re-typed — a hand-copied expectation drifts with the
copy and passes for ever. Three rows: an instrument-alive check, the byte-exact match, and a
one-token-perturbation control. ⛔ **Green on first run is only meaningful because it was proven
able to fail, twice, each plant verified LANDED before the run:**

```
plant A — emitter reverted to the pre-fix paraphrase   -> bare rc 1, domain-statement 2/3
          (row "this script emits it byte-exact" NOT OK)
plant B — D1_ADR pointed at a non-existent ADR         -> bare rc 1, domain-statement 1/3
          (alive row NOT OK *and* the control NOT OK — which is the row's whole purpose:
           an empty expectation makes a fixed-string grep match everything, so row 2 goes
           GREEN VACUOUSLY. The alive row is what stops that reading as a pass.)
```

#### F-MAJOR-2 — the seam detector, and the dead end that is worth more than the detector

The note was repaired from **byte sources, not retyping**: the file list byte-for-byte from run 2's
generated row (`…/pd/full2/run2-merged.md`) and the hand suffix byte-for-byte from the carried
baseline row in the same file, verified programmatically (`prefix match: True`, `suffix present
byte-for-byte: True`). Per QA's F-MAJOR-3 ruling the re-attach STAYS, dated, with the historical
clause era-marked so it reads as history rather than as a contradiction of column 4.

⛔ **The first cut of the new verifier assertion was BLIND to the row it was written for, and that
is the finding.** Following `merge-findings-baseline.sh`'s own "none of them hand-listed here"
doctrine, it DERIVED the verdict-token alphabet from the generated file's grammar and the
candidate's own column 4, then looked for `.sql` followed by one of those tokens. It found nothing.
The token that did the damage is `ERROR` — and `ERROR` is exactly the token this file's column 4 no
longer contains (the merged report is BLIND / COVERED / NOTICED and zero ERROR rows). ⭐ **Deriving
the alphabet from the artefact under test makes the detector blind to precisely the symbol that
artefact is missing.** The shipped predicate is therefore SEAM-shaped and needs no alphabet: a
`.sql` immediately followed by a LETTER. MEASURED over every column-5 cell of all five committed
findings reports: **1 hit (the defect), 0 elsewhere**.

⚠ **And it reported in the wrong block first.** Appending to the lost-material list and widening
that header to "LOST or MALFORMED" broke `scripts/door-sweep-selftest.sh` (PASS 33 · FAIL 1 — "the
verifier must name it lost", a byte-exact assertion on that header) and, worse, would have made a
FALSE sentence: nothing was lost, both halves are present and one separator is missing. The
malformed class now has its own abort block, placed AFTER the lost block so a candidate with both
defects reports both. Proof in both directions, bare:

```
MERGE_VERIFY=<pre-repair file>  -> rc 2, "MERGE-ABORT: the merge produced MALFORMED
                                   hand-authored material. 1 item(s)" naming
                                   commissions.commissions_select_member_or_admin (SELECT)
MERGE_VERIFY=<post-repair file> -> rc 0, silent
scripts/door-sweep-selftest.sh  -> bare rc 0, PASS 34 · FAIL 0 · SKIPPED 0
```

⭐ Worth recording for its own sake: that self-test **caught the regression the same session it was
introduced**, and it exits 1 on FAIL — so the byte-exact header assertion is doing work, not
decoration.

#### What this loop did NOT do

- ⛔ **The four §6 arms were not re-run.** QA's could-not-verify #1 asks that a second party run
  them; the builder re-running them is the shape the finding is about. The lead runs `census`,
  `hat`, `floor` and `FROMFINDINGS=1 wrapper` on a fresh reset at the final tip.
- **No fresh `db reset` and no `test:db`**: no `.sql` file changed, and no neutralization, mutation
  or restore logic changed. The only harness code touched is the door arm's `DOMAIN-STATEMENT` text
  plus its new SELFTEST arm, and `merge-findings-baseline.sh`'s new verifier assertion — all
  exercised offline, without a DB.
- **F-MAJOR-7 derives nothing new.** Deriving the `HCDS*` / `28000` / C2-ERROR figures would mean
  re-implementing C2's anchor logic here and validating it against a run this loop cannot make; an
  invented derivation would be a new claim with no owner, which is the defect, not the fix. They
  are labelled `[literal — ADR 0184 pt 4, as of 2026-09-04]` instead.
- **F-REC-1..3, 5..14 are not addressed** (F-REC-4's arithmetic clause was added while the file was
  open; F-REC-9 is the lead's, at the Record step).

#### Registers touched

- `docs/learning/LESSONS.md` +3 rows, every one with a repo-path enforcer, `lessonsProseOnly`
  **52/52 unchanged**: `LEARN-086` (never hand-derive a restore path; believe a restore only on a
  catalog re-read), `LEARN-087` (a fix correct at MOST of its sites reads as a complete one),
  `LEARN-088` (a prose claim ABOUT a measurement is a second artefact, and only the measurement has
  an owner). QA named the first two and recommended the third.
- `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` **re-rated medium → high**, heading
  emoji raised with it (gate 13 asserts the two agree), correction dated beside the original.
- `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` filed (🟡, backend).
- ADR 0191 gains four dated corrections — the `reopen_interview` witness, the "never literal" label,
  D1's required wording, and D8's three run-1 figures plus the read-half bound run 2 settled at
  **11**. `**Status:** proposed` unchanged; no new ADR number taken.

#### Gate after the loop — bare, nothing piped

| gate | bare rc | observed |
| --- | --- | --- |
| `npm run lint` | **0** | eslint 0/0; `check-docs-registers: OK`; ratchets IDENTICAL to step 11 (`lessonsProseOnly=52/52`, `severityPerEmoji=128/135`, `closesWhenPoToRule=137/147`, …); `build-features-index: OK` |
| `npm run lint:adr-index` | **0** | `189 ADRs indexed, next free 0192` |
| deriver `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0` |
| door `SELFTEST=1 bash …/p0-authz-door-audit.sh` | **0** | `TOTAL: 23/23` (classify 6/6 · resets_enabled 6/6 · emit_result 8/8 · domain-statement 3/3) |
| merge helper `bash scripts/door-sweep-selftest.sh` | **0** | `PASS 34 · FAIL 0 · SKIPPED 0` — ⚠ **the SAME RUN as the deriver row above, corrected 2026-09-07 (QA re-review `N5`); the two rows are not two witnesses.** `scripts/door-sweep-cases.sh` dispatches `exec bash "$HERE/door-sweep-selftest.sh" "$@"` under `SELFTEST=1` before any of its own setup, so one script covers both areas (deriver scenarios + merge-helper scenarios) and prints one `PASS 34`. Three named green witnesses here are **two**. The hub's `### In progress` list carries the same two-row phrasing; the lead's `## Current state` cut resolves it there |
| `bash -n` on the three touched shell files | **0** | door arm, write arm, merge helper |
| `verdicts_from_findings` on the door file | — | **359 keys, 359 unique** (was 356) |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | — | **EMPTY** |
| the same, scoped to **this loop's three commits** (`714bfc3d~1..HEAD`) over `.claude`, `docs/lead-playbook.md`, `CLAUDE.md`, `docs/reviews/pred-domain-review.md` | — | **EMPTY**. ⚠ Against `main` it is NOT empty and must not be quoted as such: `docs/lead-playbook.md` carries the lead's `376d5717` and `docs/reviews/pred-domain-review.md` is QA's `efbaa25f`. Neither is mine; the branch-wide check answers a different question than the scope check |

#### What the next session does

1. **The lead re-runs the four arms** on a fresh reset and quotes the bare codes (QA
   could-not-verify #1) — explicitly not the builder.
2. QA re-review against `docs/reviews/pred-domain-review.md`; every corrected item is a measurement
   QA has already taken, so the re-check is a diff against the report.
3. PO approval, then the §5 Record step — including closing
   `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`, satisfied at `376d5717` (F-REC-9).

### 2026-09-07 — lead: the four arms re-read at the tip by someone other than the builder (QA could-not-verify #1)

Run by the lead, detached (`…/scratchpad/pd/lead-gate/runner.sh`, `Start-Process` on `bash.exe` with the
script as argv[1]), at HEAD `4ace3bfb`, 04:36–04:45; every code read bare from `rc.txt`:

- `supabase db reset --local` rc **0** · `npm run test:db` rc **0** — `Files=262, Tests=8876, Result: PASS`
- `ARM=census` rc **0** —  live authz gates (catalog): 581  gates carrying a verdict: 604 `INVARIANT HOLDS`
- `ARM=hat` rc **0** — ⚠ **this line was TRUNCATED MID-WORD (`… authz.holds_role an`) and is replaced 2026-09-07 (QA re-review `N6`) with the full quoted lines from `…/scratchpad/pd/lead-gate/arm-hat.log`, re-read at the source. A quoting defect, not a measurement defect — the arm's rc and findings were always right:**
  - `self-test: 7/7 OK (blind flagged · covered not flagged · class-4 param flagged · has_role_any anchor flip seen · x-table policy flagged · covered x-table policy not flagged · authz.holds_role anchor flip seen)`
  - `anchors: app.has_role(4-arg) + app.has_role_any + authz.holds_role carry the active-role condition`
  - `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted:` — `fn: authz.assignment_facts(p_principal uuid)` · `fn: public.assume_role(p_role platform_role)` · `fn: public.session_context()` · `policy: public.memberships.memberships_select (SELECT)`
  - preflight, same log: `clean — 0 degenerate bodies in app+public (all three forms)`; closing line `=== INVARIANT HOLDS ===`
- `ARM=floor` rc **0** —  OK: every never-called door is on the floor allowlist.  OK: every floor-allowlist entry resolves to a live door. 
- `FROMFINDINGS=1 ARM=wrapper` rc **0** —  BLIND set size: 41  OK: every BLIND wrapper is on the allowlist. 
- deriver `SELFTEST=1` rc **0** — SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0
- `door harness `SELFTEST=1`` rc **0** — `SELFTEST TOTAL: 23/23 ok, 0 failed` (classify · resets · emit_result · domain-statement 3/3); committed baseline VERIFIED unchanged (cksum)

Logs kept under `…/scratchpad/pd/lead-gate/`. This is the gate evidence the PO approval rests on; the
builder's step-11 figures at `6f94a634` (census 581/602) are superseded by these at `4ace3bfb`
(the three set-valued rows added by the fix loop move "carrying a verdict" 602 → 604 after the
re-files' bookkeeping — re-derived, not summed).

### 2026-09-07 — backend: QA re-review residuals folded (docs)

One docs/comment-only commit folding the residuals of `docs/reviews/pred-domain-rereview.md`
(APPROVED) at PO approval. ⛔ **Nothing executable changed**: the two shell edits are comments,
`bash -n` **0** on both, and `git diff --name-only main... -- supabase/migrations supabase/seed.sql src`
stays **EMPTY**. Neither review file was touched.

#### The eleven open RECs — old → new, one clause each

| # | old | new |
| --- | --- | --- |
| **F-REC-1** | `act-hat-blind-sweep.sh` — *"until 2026-09-05 while `:195` executed"* | *"while the population query — the `where n.nspname in (…) and p.prokind = 'f'` line in `_hb_fn` below, cited by ANCHOR and no longer by number"*. ⭐ **Measured while fixing it: the number rots faster than the fix.** `:195` had already become `:202`; my first edit added a line and made it `:203`; the second made it `:204`. Citing the anchor is the only stable form, and the comment now says so with both dead numbers named |
| **F-REC-2** | five archive closures, *"commit `b59d4bbf`"* | the sentence is left as filed and each gains, beside it: *"⚠ **Corrected 2026-09-07 (QA `F-REC-2`) … the CLOSING commit is `6f94a634`.** `b59d4bbf` is the run-2 re-baseline this closure RESTS on, not the commit that wrote it."* MEASURED: `git log --oneline main..HEAD -- docs/followups/follow-ups-archive.md` names `6f94a634` (*"close the five door-arm domain follow-ups"*), and `git show --stat 6f94a634` carries the +541 lines of archive. ⛔ The other **2** of the 7 `b59d4bbf` mentions are CORRECT (the re-baseline itself) and are untouched — 7 mentions, 5 corrections |
| **F-REC-3** | four entries with no body file and no body-pointer line | ⭐ **Three fixed, one moot.** The moot one is `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`, closed in this same commit. The other three gain: *"⚠ **No separate body file, BY DESIGN … ** this entry's substance is inline in the field above — the template's first branch (≤ 10 lines inline)."* ⛔ **A body-pointer line was deliberately NOT added**, and the reason is measured, not stylistic: `checkArchiveNoBodyLink` reds on that token anywhere in the archive, so adding one now plants a red in the closure that will one day rotate the entry verbatim |
| **F-REC-5** | `p0-authz-door-audit.sh` — `TRIG_SECDEF` bounded on `('app','public')`, silently | a comment beside it: latent drift, not an error; **174 either way**; ⛔ *"Left as a note rather than widened here, because this count is EMITTED into the committed `DOMAIN-STATEMENT` header — moving it is a run, not an edit."* Widening the query would have moved a committed header with no run behind it, which is LEARN-088 in one keystroke |
| **F-REC-6** | `FUP-DOOR-DEGENERATE-PREDICATE-TWO-HAND-COPIES` named only `DEGENERATE_PREDICATE` | register `**Status:**` and body both widened: `resets_enabled()` / `periodic_reset()` are a **second** hand-kept pair, `c2-command-door-neutralizer.sh` ↔ `p0-authz-door-audit.sh`, byte-identical but for `SUBSET` → `SUBSET_RUN`. ⛔ *"the definition" in the condition reads as EACH duplicated definition* — a single-place fix for the preflight alone no longer closes it. The heading is NOT edited (permanent by the register's own rule) |
| **F-REC-7** | two `## COVERED …` headings, the second unexplained | a blockquote note under the second, saying it is the BASELINE's, that the live one is above, that the table below carries **0** `ERROR` rows, and that nothing selects on a `## COVERED` section. ⭐ Written as a **blockquote**, matching the merge-proven shape the sibling heading already carries, rather than as a bare paragraph the merge has never seen between a header and its table |
| **F-REC-8** | the register line byte-identical to `main` while the body carried the work-list | `**Status:**` gains *"WIDENED … the body gained run 2's door-arm work-list — **15 distinct aborting-file signatures over 23 `NOTICED` rows**"*, and names where the **four** weakest actually live (`FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`), so a reader working from the register alone is not sent to the wrong body |
| **F-REC-10** | ADR D2, *"…in §7.17b and in the `DOMAIN-STATEMENT`"* under a "stated verbatim" label | quote left unedited; a dated correction beside it names the emitter's actual close, *"…and in **this statement**"*, and states the authority: **the emitted block, not this quote** |
| **F-REC-12** | ADR D5, *"Proven on four constructed strings"* | sentence left unedited; correction beside it: **six** ship, the two omitted being the `Dubious` and missing-`Result:` paths — *"the ones that make the classifier's OTHER code paths evidence rather than the happy path twice"* — and the count is re-readable every run as `classify 6/6` |
| **F-REC-13** | ADR D5 Am. 1, *"23 aborting-file signatures"* + *"a keystone entry for the four rows"* | correction beside it on **both** counts: **15 distinct signatures over 23 rows** (a work-list sized by files to repair, not gates that lost a verdict), and the four are in their own entry, not that body — *"A reader sent to one body for both would find only 19 of the 23 accounted there."* |
| **F-REC-14** | ADR consequence, *"the set-valued home **needs** a scheduling line"*, still open | consequence left standing, with ✅ **DISCHARGED** beside it: landed at `376d5717`, follow-up closed at this Record step, ⚠ *"the landed sentence is the drafted one **plus** `; ADR 0079 hazard 4` — a strengthening, not a byte-verbatim paste"* |

⚠ **F-REC-4, -9, -11 are not in the table**: -4 was already fixed in the loop, -11 was withdrawn on
measurement at the first review, and -9 is the closure below.

#### N1–N7

- **N1** — both sentences corrected, dated, beside unedited originals: `authz-door-audit-findings.md`
  (the note above the three set-valued rows) and ADR 0191 **D7** (⚠ QA cited `:373-375`; at the tree
  it reviewed, the sentence was at `:376-377` — one more line cite that had already rotted, which is
  why both corrections are anchored on the sentence text, not on a number).
  New text, both: the merge keeps the **ROWS** (six, in place, un-indented, all six read by
  `verdicts_from_findings`) and **relocates the HEADER** into `CARRIED`, indented, leaving a bare
  `|---|---|---|---|---|`. ⚠ Both corrections carry QA's own caveat that its `GENERATED` was a
  synthesis, so this stays on the could-not-verify list until a real full run.
- **N2** — not fixed here; filed with N1 as **one** entry,
  `FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST` (🟡, backend, code `AUTHZ`
  registered), with a body. Its `**Closes when:**` names a self-test scenario **per blind spot** —
  the non-letter seam (including the repaired row's own `. ⚠`, the model a future re-attach would
  copy), the comma-joined suffix, the non-`.sql` token seam, the indented `CARRIED` row — **plus**
  the header-preservation case for N1, each owed **red before green**. ⭐ One measured addition of
  my own: the standing case `B: hand-written table survives whole` uses a fixture whose hand header
  is the three-column `| gate | evidence | reading |`, not the five-column generator-shaped header
  the real file carries — so the case that looks like it covers N1 has never exercised its shape.
  ⛔ Stated as *the shapes differ*, not as *that is the cause*; the new case is what would settle it.
- **N3** — hub frontmatter `adrs:` gains `"0191"` (frontmatter ONLY; the hub body, `status`, `branch`
  and `reviews` are the lead's). `npm run features:index` rc **0**. ⚠ **Measured, and it narrows
  N3's stated consequence:** `docs/features/INDEX.md` is **byte-unchanged** by the rebuild — the
  index has no ADR column for any hub, so the missing `0191` was never costing an index link. What
  it was costing is the hub's own metadata, which is where a reader looks for a unit's decisions.
- **N4** — recorded in this record beside the drafted §4 sentence, and again inside the closure:
  `376d5717` is the draft **plus** `; ADR 0079 hazard 4`. A correct strengthening; only the word
  "verbatim" (in a commit message no gate reads) is false.
- **N5** — the gate table's `merge helper` row now says it is the **SAME RUN** as the deriver row
  (`scripts/door-sweep-cases.sh` `exec`s `door-sweep-selftest.sh` under `SELFTEST=1` before any of
  its own setup), so *three named green witnesses here are **two***. ⚠ The hub's `### In progress`
  carries the same two-row phrasing; that is the lead's `## Current state` cut, and it is flagged
  here rather than edited.
- **N6** — the `ARM=hat` line was truncated mid-word (`… authz.holds_role an`); replaced with the
  full lines re-read from `…/scratchpad/pd/lead-gate/arm-hat.log`, including the preflight
  (`clean — 0 degenerate bodies`) and `=== INVARIANT HOLDS ===`. The door self-test line was already
  repaired at `1b9d9fd4`.
- **N7** — `LEARN-087`'s Enforcement repointed. It named `p0-authz-door-audit.sh` — the **remediated
  site**. It now names the INSTRUMENT inside it (the offline `SELFTEST` arm `resets_enabled`, 6/6 of
  `TOTAL: 23/23`) **and** `c2-command-door-neutralizer.sh` as the sibling site that carries no
  self-test at all. ⛔ Naming the uninstrumented sibling is the lesson applied to itself: enforcement
  today covers **one of the two sites**, and the row says which. `lessonsProseOnly` stays **52/52**.

#### F-REC-9 — the closure, and its rotation witness

`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` is **RESOLVED 2026-09-07** on the lead's
`376d5717`. The `**Closes when:**` is quoted verbatim in the archive and audited clause by clause;
all four clauses hold, with clause 2 carrying N4's strengthening explicitly rather than reading as a
clean paste. ⛔ The closure states what it does **not** discharge: the harness still has no `SELFTEST`
arm and still emits an unfilable row shape (`FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS`).

Rotation per lead-playbook §5 — **byte-extract, compare, then cut**, adapting the same session's
`close.py`:

```
--- extracted entry (5 lines, 1370 chars) ---
cmp: extracted body block (1235 chars) found VERBATIM in the composed archive block: OK
archive: 1 existing citation(s) of the code, 0 headings — a pointer, not an entry
WRITTEN. archive holds the entry verbatim; open register no longer names it.
```

⚠ The id was ALREADY present in the archive once — as a **citation** inside the twin's closure body,
not as an entry. A naive "id not in archive" guard aborted on it; the assertion was re-aimed at
`### ` HEADINGS, which is the property the duplicate-id gate itself keys on. ⛔ **No body file was
deleted, because there was none** — this entry was one of F-REC-3's four, so the archive block says
so instead of leaving a silent gap where a folded-in body normally sits. Open register **208 → 207**
entries (one closed, one filed); body files **159 → 159** (one added, none removed).

#### Gate — bare, nothing piped

| gate | bare rc | observed |
| --- | --- | --- |
| `npm run lint` | **0** | eslint `--max-warnings=0` clean; `check-docs-registers: OK` (207 follow-ups, 159 bodies, 88 lessons); **ratchets IDENTICAL to QA's re-review figures** — `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=90/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52`. **None raised** |
| `npm run lint:adr-index` | **0** | `189 ADRs indexed, next free 0192` — body-only edits, no new ADR number taken, `**Status:** proposed` untouched |
| `npm run features:index` | **0** | `wrote docs/features/INDEX.md (9 hubs)`; the file is byte-unchanged (see N3) |
| deriver `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`. ⚠ Run because two script files changed — **comment-only, and a comment-only edit still counts**; `SKIPPED 0` means the catalog scenarios ran, not that they were waived |
| door `SELFTEST=1 bash …/p0-authz-door-audit.sh` | **0** | `SELFTEST TOTAL: 23/23 ok, 0 failed`; `committed baseline VERIFIED unchanged (cksum)` — the findings file I edited is byte-stable across the run |
| `bash -n` on both edited shell files | **0** | `act-hat-blind-sweep.sh`, `p0-authz-door-audit.sh` |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | — | **EMPTY** |

⚠ **`longHeadings` moved 90 → 91 on the first run and was brought back.** The new follow-up's heading
was 161 chars against a 160 cap. It is now 152 and the ratchet reads **90**, identical to QA's. A
ratchet under its cap still passing is exactly the reading that lets one drift.

⚠ **Two knowingly-rotted sets of citations, disclosed rather than left to be discovered.** The
F-REC-5 comment adds **+8 / −0** lines to `p0-authz-door-audit.sh` immediately after `:996`, so every
cite of that file **from `:997` down** now reads 8 low: MEASURED, `:1015` (the D1 sentence's emit) is
now **`:1023`** and `:1061` (the §7.17b echo) is now **`:1069`**. `authz-door-audit-findings.md` gains
**+17 / −0** across the F-REC-7 and N1 notes, moving its set-valued section below `:1007`.
⛔ **Measured before deciding, not after:** the ONLY living documents that cite `p0-authz-door-audit.sh`
by line do so at `:176`, `:187`, `:198-206`, `:263-298`, `:350`, `:461-475`, `:497-505`, `:565`,
`:761/:767` and `:790-806` — **every one of them BEFORE the insertion point, so every one is still
correct**. The
cites that rot (`:1015`, `:1061`) live only in `docs/reviews/pred-domain-review.md` and
`-rereview.md`, frozen QA artefacts at `c73131fe` that must not be edited. That is the ordinary
as-of-tree cost of a review citation; naming it here is cheaper than a future reader re-deriving it,
and it is the third time in one commit that a line number turned out to be the wrong handle.

#### Not done, deliberately

- **N2 is filed, not fixed** — the self-test cases it asks for are its own increment, and each is
  owed red-before-green, which is a build step and not a docs fold.
- **F-REC-5's actual widening** (`TRIG_SECDEF` → `('app','public','authz')`) is a one-token SQL edit
  that would move a committed `DOMAIN-STATEMENT` figure with no run behind it. Noted, not made.
- **The hub body, `status`, `branch`, `reviews`** — the lead's, at the Record step. Only `adrs:` was
  touched. `docs/progress/phase-ledger.md` was left alone: it is being written concurrently and is
  not staged by this commit.
- **`docs/reviews/pred-domain-review.md` and `-rereview.md`** — untouched, as required.

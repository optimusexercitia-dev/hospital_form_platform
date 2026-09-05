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

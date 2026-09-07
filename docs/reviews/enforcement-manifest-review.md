# ENFORCEMENT-MANIFEST — QA review (pre-AE5 remediation Batch 4, with Batch 5 riding along)

# ❌ VERDICT: CHANGES REQUESTED

**Verdict: CHANGES REQUESTED**

**Reviewer:** `qa` · **Date:** 2026-09-07 · **Subject:** unit `ENFORCEMENT-MANIFEST`, branch
`authz-enforcement-manifest`, tree at **`7b9b1eb7`** (10 commits over `main` = `23ec1fa5`).
Local stack `supabase_db_azkbbhskturikxpgmafq`, reset to head `20261003007350` by the lead's
tip-gate chain. Read-only throughout; I wrote exactly one file: this report.

---

## 0. Headline

The core of this unit is the best vacuity work on the program to date, and I could not break it.
`410` §6.2 is now a **committed claim against a live derivation**, and I re-derived the live side
independently on the catalog: the fixed point returns exactly what the manifest commits, closure
sizes and all. The generator opens no database connection (`node:crypto`/`fs`/`path`/`url` only),
so the asymmetry LEARN-084 demands is real. The migration is one line, byte-identical to the live
definition, and its behavioural equivalence verifies on `authz.role_permissions`. `test:db` is
`Files=262, Tests=8882, PASS` at the tip with **zero** `not ok`. Four of the five follow-ups close
cleanly on their own quoted clauses, and the two clauses that were *not* met literally are
disclosed in the closure text rather than glossed — which is the behaviour this register was
designed to produce.

It is `CHANGES REQUESTED` for two reasons, both of them the unit's own failure mode turned on
itself, and both text/record corrections rather than redesign:

1. **A fifth stale figure survived in the very section Batch 5 exists to re-measure**, and it is
   the actively misleading kind: § 6.7 step 4 of the rollback runbook still counts **four**
   reverted policies and still names `3901715193753db33f980f939c6467de` as the post-cutover md5 —
   the exact constant the same diff corrects sixty lines later to `f2a0693be216cfe08eb6cf0283565e7c`.
   An operator following step 4 at 03:00 is told that landing on `3901715…` means "the `alter
   policy` statements did not apply at all"; today, before any revert, the catalog lands on
   `f2a0693…`, and `3901715…` would in fact mean a **partial** revert. The record and hub assert
   "§ 6 re-measured at the tip, all eight items" and "four stale figures, not three".
2. **The diff-scoped sweep is a FINDING, not a pass, on all three arms**, and the discharge it
   names is owed and unwritten. It resolves `public.set_item_validations` as a door in this diff
   that no arm's `PRED_DOMAIN` can select and says so in its own words: *"This is NOT 'the
   migration changed no gate' … obligation (b) below is therefore PROVABLY FALSE for this diff."*

Nothing touches `src/`, `e2e/`, an RLS policy, or a grant. The security axis is clean.

---

## 1. Method — what I measured, and how

| what | how |
| --- | --- |
| the migration body | `pg_get_functiondef('public.set_item_validations(uuid,jsonb)'::regprocedure)` on the live catalog, `diff`ed against the migration's `CREATE OR REPLACE` block |
| the pre-migration body | `git show` of `20260901000100_ff3_validations_door_parity.sql` — used only to bound the change, never as truth (ADR 0078) |
| the behavioural equivalence | `authz.role_permissions`, `authz.roles.state`, and the live bodies of `has_permission` / `entailed_grants` / `holds_role` / `is_staff_admin_of` / `is_tenancy_admin_of{,_for}` |
| `410` § 6.2's derivation | `pg_temp.policy_body` / `fn_body` / `hard_deny_closure` **re-typed verbatim** into a read-only session and run over the 13 declared sites + 3 authorizers |
| § 6.2b / § 6.2c | the same instrument handed the planted synthetic root and the bare root, and both real rows |
| § 8.5 / § 8.6 / § 8.7 / § 8.8 domains | sites counted from the manifest JSON; policies, carriers, DEFINER writers and authorizer consumers counted on the live catalog |
| the `_staff_admin_write` class | `pg_policies` by name and by shape; `information_schema.table_privileges` for reachability |
| every runbook figure in § 6.1 / § 6.2 / § 6.7 | re-run with the runbook's own queries, `\y…\y` anchors included |
| the generator | source read for any DB import; `--check` and `--self-test` run, bare exit codes |
| the gate chain | the lead's `rc.txt` and per-step logs read, never re-run |

Bare exit codes I observed myself at `7b9b1eb7`, working tree clean:

```
node scripts/gen-authz-matrix-cells.mjs --check      -> 0   in sync … manifest 43 rows, sha 493370f994a5
node scripts/gen-authz-matrix-cells.mjs --self-test  -> 0   44 caught · 2 "not caught, as required" · 1 real-spec control
git status --porcelain                               -> (empty)  no plant residue in the real tree
```

From the lead's chain (`…/scratchpad/gate/`):

```
arm-census rc=0   arm-hat rc=0   arm-floor rc=0   arm-wrapper rc=0
selftest-deriver rc=1            setvalued rc=2
deriver-all rc=1  deriver-read rc=1  deriver-write rc=1
npm run lint  -> 0 (13 gates, 0/0)          npm run test:db -> Files=262, Tests=8882, Result: PASS, 0 "not ok"
SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
```

⚠ **One methodological note that cost me a false finding, recorded so the next reviewer does not
repeat it.** Reading the live catalog *while the lead's mutation sweep is running* returns mutants.
At 07:5x I measured `app._audit_access_authorized` as `begin return true; end` and was about to
report `410` § 8.8's reverse arm as vacuous; it was a live door-sweep mutation mid-flight. Every
figure below was **re-measured after the sweep restored it** and is stable across two reads. A
read-only reviewer on a machine running a mutation harness must re-read before believing.

---

## 2. What I verified — the claims that hold

Everything in this section I re-derived myself. It is here because a review that only lists faults
misrepresents the change.

### 2.1 The migration (`20261003007350`)

| claim | measured |
| --- | --- |
| body regenerated from live `pg_get_functiondef`, not retyped | ✅ the migration's `CREATE OR REPLACE` block is **byte-identical** to the current live definition (only psql's trailing newline differs). The 2026-09-01 migration text says `is_commission_admin_of`; the record's quoted pre-state says `is_tenancy_admin_of` — a hand-retype would have carried the stale name, so the regeneration is *proven*, not asserted |
| exactly one line changed | ✅ `diff` against the last migration that defined the function shows the gate line and nothing else (plus `pg_get_functiondef`'s header casing and `$function$` tag) |
| `SECURITY DEFINER`, `search_path`, signature unchanged | ✅ `prosecdef = t`, `proconfig = {search_path=app, public, pg_catalog}` |
| no new grant | ✅ no `GRANT`/`REVOKE`/`DROP`/`CREATE POLICY`/`ALTER POLICY` statement anywhere in the file; ACL post-reset `authenticated=t`, `anon=f`, unchanged by `create or replace` |
| `has_permission(uid,'commission',cid,'commission.forms.edit') ≡ is_staff_admin_of(cid)` | ✅ **verified on the live catalog.** `authz.role_permissions` grants `commission.forms.edit` to exactly one role, `staff_admin`; `staff_admin` is the **only** row with `authz.roles.state = 'authoritative'` (the other 11 are `legacy`). `has_permission`'s state gate kills every implication path through a legacy role; `staff_admin`'s `allowed_scope_kind` is `commission`, so `scope_reaches` collapses to identity; and the hat clause is **textually the same predicate** in `entailed_grants` and `holds_role`. The tenancy arm is preserved verbatim inside the authorizer (`is_tenancy_admin_of(x)` *is* `is_tenancy_admin_of_for(x, auth.uid())`, from the live body) |

### 2.2 `410` § 6.2 — the transitive fixed point (D4, both directions)

I re-typed `hard_deny_closure` / `hard_deny_roots` / `hard_deny_derived` into my own session and ran
them over the 13 declared sites and the 3 authorizers:

```
commission.forms.edit    | closure 10 | principal_inactive
org.professionals.create | closure 21 | principal_inactive
org.professionals.read   | closure 59 | principal_inactive,respondent_exclusion
6.2b planted root        |            | recusal_exclusion,respondent_exclusion
6.2b bare root           |            | (none)
```

This is **exactly** the manifest's committed `hardDenyClasses` and exactly the record's `10 / 21 / 59`.
The arm is not vacuous and cannot be satisfied by a self-comparison:

- the `have` side reads `pg_proc`/`pg_policies` at run time; the `want` side is hand-written JSON
  emitted by a generator that **imports no database driver** (`node:crypto`, `node:fs`, `node:path`,
  `node:url` are its entire import list — LEARN-084 confirmed by reading, not by trusting D1);
- it is a **set equality on both sides as strings**, so D4(a) (drop a class) and D4(b) (add a class)
  both red by construction — I confirmed the derived side does not match either perturbation;
- § 6.2b's `respondent_exclusion` really is **2 hops** from the planted root
  (`is_case_excluded → is_recused_from_case → is_case_respondent`), so a depth-1 search would return
  `recusal_exclusion` alone and red. Transitivity is proven *by selection*, as the acceptance
  criterion requires;
- § 6.2c's two real rows genuinely differ (`read` reaches `app.is_case_respondent`, `create` does not);
- `recusal_exclusion` is reached by **no** real row at any depth — the honest zero, kept `[]`.

The M7 arms are proven able to fire at arm level: `--self-test` reports 44 `caught —` scenarios
(five for M7, seven for M13 among them), **two** `not caught, as required` discrimination halves,
and the pre-existing "caught nothing on the real spec" control. All 44 + 2 + 1 observed by me, exit 0.

### 2.3 The plants left no residue

`--check` exits **0** at manifest sha **`493370f994a5`** — the sha the record names — and
`git status --porcelain` is empty. Every plant was in a container-side copy or a fake tree, as claimed.

### 2.4 § 8.5 / § 8.6 / § 8.7 / § 8.8 and the class enumeration

| claim | measured |
| --- | --- |
| § 8.6 triple `13 / 8 / 4` | ✅ 13 declared sites on re-keyed rows (6+3+4 in the manifest); 8 policies reach a re-keyed code (6 form + 2 professional); **4** literal carriers, enumerated by name on the catalog |
| the 14 authorizer consumers | ✅ 6 functions + 8 policies = **14**, and the partition is exactly 12 sites + `public.set_item_validations` + `app._audit_access_authorized` |
| `_staff_admin_write`: 30 by name / 49 over 37 tables by shape | ✅ both, exactly |
| 6 of the 30 re-keyed | ✅ |
| `cases` partial — no `DELETE` for `authenticated` | ✅ `INSERT, SELECT, UPDATE` only |
| `form_block_library` SELECT-only, not a member | ✅ one `SELECT` policy, `SELECT` grant only |
| `409` § 5.2 `179 → 178` | ✅ 178 on the live catalog |
| no `410` assertion deleted | ✅ 40 → 44 `select is/ok(...)` statements; § 8.5's `is()` is intact and only its expected element text flipped |

### 2.5 The runbook figures that *were* re-measured (Batch 5)

| runbook line | claim | measured |
| --- | --- | --- |
| `:600` | `EXPECT 6 rows`, six-table `tablename` list | ✅ the six policies exist and the census returns exactly six rows |
| `:612` | the `pg_proc` query a policy census is blind to | ✅ returns `STILL RE-KEYED` today, `reverted` after the revert — the seventh artifact is real and correctly stated |
| `:617` | `EXPECT 63`; post-cutover **57**, six policies each add one | ✅ `\yis_staff_admin_of\y` over `pg_policies` = **57**; 57 + 6 = 63 |
| `:643-651` | carrier census **4 rows now**, **2 rows** after a full revert | ✅ four rows, name-for-name as written |
| `:235` | the `commission_of_version` live twin is **dead** | ✅ the runbook's own query returns **0 rows**. ⚠ The *record's* one-line summary ("live twins = 0 rows") is only true of the pre-cutover shape the runbook spells out; the bare shape `app.commission_of_version(form_version_id)` in both halves is still carried by **4** policies. The runbook is right; the record's shorthand is not re-derivable on its own |
| `:255-266` | the `can_manage_case_vocabulary` twin **still holds** | ✅ and the extractor (md5 over comment-stripped `prosrc`, never `pg_get_functiondef`) is written out beside it, which is the right fix |

### 2.6 Requirements, clause by clause

Each follow-up audited against its **own quoted `Closes when`**, with the archive entry beside the
verbatim register line and body (ADR 0185 D5). All five bodies deleted, all five register lines
removed, `FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR` filed with a real closure condition,
the ⭐⭐ Critical list untouched, gate 13 green.

| follow-up | verdict |
| --- | --- |
| `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` | ✅ **met, and exceeded.** Both halves ("populate" *and* "an assertion that can fail on the empty case") in **one commit** `eea8f48a`; the discrimination control is § 6.2b; the search is transitive with **no depth bound**, which is stronger than the clause's "transitive, comment-stripped" and stronger than the body's "depth-bounded". ⛔ "Not one hop" is honoured — proven by selection at 2 hops on the plant and at depths 2/3/4/5 on the real rows |
| `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` | ✅ **met.** Re-keyed, not described. ⛔ "Pointing at the re-keyed policy does not close it" — not done; the proof is `409` § 2.6f/§ 2.10e, a two-polarity behavioural differential whose mutated half was observed **RED before the migration file existed**. The hub's added clause — "the whole `_staff_admin_write` class enumerated from the live catalog … each member dispositioned" — is met, both populations reported, and the reachability cross-check against `information_schema.column_privileges` caught three column-grant tables a table-level read would have miscounted |
| `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` | ✅ **met — and the builder is being harder on itself than the evidence warrants.** The closure discloses that "the by-name pin is deleted in the same change" was not done literally. I measured what the pin *was*: on `main` there is **no name exception in § 8.5's predicate** — every carrier is classified — and the "pin" is the expected string's fourth element, `… [UNDECLARED]`. `main`'s own § 8.5 caption prescribes precisely what shipped: *"the second red is the gap being CLOSED and the string is then updated, never widened to absorb a third."* The `[UNDECLARED]` element is gone; no hand-maintained exception remains; the arm that notices a fifth carrier survives. **The clause is satisfied on its intent and on its author's stated closure route.** The disclosure is correct to exist and should stay |
| `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` | ✅ **met.** ⛔ Not in `enforcementSites` — verified in the manifest and now structurally refused (M13 rejects a name on both lists; § 8.8 closes the partition both ways). The clause's presupposition really was false: no per-authorizer consumer list existed anywhere, so creating one in the manifest with a pointer from `backend-state.md` is the right reading of a clause that offered a choice of homes |
| `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` | ⚠ **substantially met, one clause defeated** — see **F-BLOCK-1**. § 6.2 is re-measured, rewritten for six, the banner is deleted, § 6.1 row 2's dead twin is corrected and § 6.1's surviving twin re-measured with its extractor. But the clause the closure quotes as ✅ — *"⛔ every figure re-derived on the tip catalog, and four of them had moved"* — is false: a **fifth** figure in the same § 6 was not re-derived and is now wrong |

### 2.7 The builder's four solo decisions — all four **SOUND**

1. **`set_item_validations` on `definerSurface`, not `enforcementSites` (§ 8.6 stays `13 / 8 / 4`).**
   ✅ Sound. § 8.4's closure is policy-only and says so *in its own caption on `main`*, so adding a
   function to the site axis of that row would put an object into a set one arm cannot see and
   another arm counts — the exact asymmetry § 8.6 exists to catch. The three-way partition in § 8.8
   is the correct consequence and is asserted in both directions.
2. **§ 8.7's forward arm bounded to write-capable policy sites (`cmd in ('ALL','INSERT','UPDATE','DELETE')`).**
   ✅ Sound, and correctly *derived* rather than hand-listed. A DEFINER **writer** cannot be a
   backstop for a `SELECT` policy; without the bound the arm reports a category error as a finding,
   and a hand-shrunk list would have been the vacuity. Reading the bound from `pg_policies` means an
   AE5 policy that gains a write command widens the arm automatically.
3. **`definerSurface` + `nonEnforcementConsumers` required on all 43 rows.**
   ✅ Sound — verified: both keys present on **43/43**, `[]` on the 40 pending, and both are in
   `requiredPermissionKeys`. Neither list can be acquired by silence, which is the only property
   that makes § 8.7/§ 8.8's reverse arms mean anything. The paired choice (4) to leave
   `hardDenyClassesEmptyReason` **optional** is also right and I confirmed **zero** rows carry it —
   the escape hatch has not become the default.
4. **D1's discrimination half proven at `--self-test` level only.**
   ✅ Sound, and the disclosure is accurate: at `--check` level, adding the reason changes the JSON
   and the run reds on DRIFT instead, so `--check` structurally cannot express that half. The
   self-test feeds the mutated manifest to the validator directly, which is the only level at which
   the arm is isolated. ⚠ Residual, stated for the record: a self-test scenario is authored data, so
   what is proven is validator behaviour, not that a real-tree edit escapes — which is why running
   both (`lint:authz-vectors` does) is load-bearing.

---

## 3. Findings

### F-BLOCK-1 — a fifth stale figure survives in § 6.7 step 4, and it mis-instructs the operator in the reassuring direction

**Where:** `docs/deployment/authz-rollback-runbook.md:728-744` (§ 6.7 step 4, "The 128-bit check on
site 1"). Untouched by `main...HEAD` — confirmed against the diff.

**What it says now:**

```
:734  -- run 387's C1 aggregate; three of the four reverted policies are in the hot subset
:738  -- Measured post-cutover:    3901715193753db33f980f939c6467de
:742  A 128-bit return says your four `alter policy` statements restored exactly the pre-D6 text
:744  if it lands on `3901715…`, the `alter policy` statements did not apply at all.
```

**What I measured.** `supabase/tests/387_initplan_wrap_and_profiles_arm_identity.sql:361` pins C1 at
**`f2a0693be216cfe08eb6cf0283565e7c`**, and `387` is green in the tip `test:db` run. The same diff
corrects this exact constant sixty lines further down — `docs/deployment/authz-rollback-runbook.md:798`:
*"now `f2a0693be216cfe08eb6cf0283565e7c` (⚠ this cell said `3901715193753db33f980f939c6467de`;
`20261003007340` moved it again)"*. The revert is six policies, not four, per § 6.2's own rewrite.

**Why it is blocking.** This is the failure mode the closed follow-up names in its own severity
line — *"it is the 03:00 revert procedure, and it fails **silently green**"* — reproduced one step
along. An operator who runs step 4 **before** reverting lands on `f2a0693…`, which the text does not
list at all; one who lands on `3901715…` is told the statements "did not apply at all" when in fact
that constant is now reachable only by a **partial** revert (the two `…7340` policies restored, the
four D6 ones not) — the precise silent-green outcome the follow-up was filed to remove. And the
closure asserts the opposite as a discharged clause: *"⛔ What must NOT be done: edit `EXPECT 4` to
`EXPECT 6` without re-measuring the pre-state — ✅ every figure re-derived on the tip catalog, and
**four** of them had moved."* The hub says *"Runbook § 6 re-measured at the tip (Batch 5, all eight
items). Four stale figures, not three."* Both sentences are contradicted by a measurement inside the
same diff.

**Remedy (text only).**
1. `:734` — replace "three of the four reverted policies" with the measured subset of the **six**:
   `387`'s hot subset holds `form_versions_staff_admin_write`, `form_sections_staff_admin_write`,
   `form_items_staff_admin_write`; `forms`, `form_item_options` and `form_item_validations` are not
   in it — which is what the diff already says at `:193-196`, so this is an alignment, not a new
   measurement.
2. `:738` — `Measured post-cutover: f2a0693be216cfe08eb6cf0283565e7c`, with the prior value kept as
   a dated note (LEARN-088), as `:798` already does.
3. `:742/:744` — "your **six** `alter policy` statements", and replace the "did not apply at all"
   diagnosis with the three-value reading: `a115005b…` = full revert landed; `f2a0693…` = nothing
   applied; `3901715…` = **partial** revert, the `…7340` pair restored and the D6 four not.
4. Correct the closure entry's clause 5 and the hub/record sentences from "four stale figures" to
   **five**, so the count and the text agree.

---

### F-BLOCK-2 — the diff-scoped sweep returns FINDING (1) on all three arms; the discharge it demands is owed and unwritten

**Where:** the lead's chain — `deriver-all rc=1`, `deriver-read rc=1`, `deriver-write rc=1`, each
ending:

```
=== RESULT: FINDING (1) — DOORS IDENTIFIED: 1.  SWEEPABLE BY THIS ARM: 0. ===
    ⛔ This is NOT 'the migration changed no gate'. The live catalog resolved
       1 door(s) in this diff … obligation (b) below is therefore PROVABLY FALSE
       for this diff. Do not write it.
SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
```

**What it means.** `public.set_item_validations` is `prosecdef` and returns `void`, so it falls
outside every arm's `PRED_DOMAIN`. The deriver's exit **1 here is not the "no gate changed" reading**
— it says so explicitly — and it names the only two acceptable discharges: *"a TARGETED mutation case
for each door above, named in the record; or the ruling that a listed object is not an authorization
decision — as a claim someone can check against the same catalog."* Neither exists. The record's
"What is NOT proven, stated" section defers the whole tip gate to the lead and does not anticipate
this outcome, and the hub's gate box is still `[ ]`.

**Why it is blocking.** This unit's own acceptance criterion is *"the diff-scoped sweep, both arms,
derived over `main...HEAD` with its `SCOPE:` line quoted — owed because any re-key is a migration."*
The sweep ran and returned a finding whose discharge is a **record obligation**, and ADR 0079's
hazard 4 forbids the cheap escape (`CASES=` by hand) explicitly. Writing "the sweep is green" or
"no gate changed" from these exit codes would be the false claim the deriver was built to prevent.

**Remedy.** Before the gate record is written, one of:
- **(preferred, and I believe it is already earned)** name `409` § 2.6f / § 2.10e as the **targeted
  discharge** for `public.set_item_validations`, in the record and in the gate record, with what it
  does and does not cover said plainly: it is a *grant*-mutation differential (delete the
  `staff_admin → commission.forms.edit` row, the door raises `42501`; grant present, the same call
  succeeds), observed **red-first** on the un-migrated catalog. That is a stronger discharge than a
  body-neutralization case for this door, but it is a **different** instrument and the record must
  say so rather than let a reader assume the sweep covered it; **or**
- add a targeted mutation case for the door to the set-valued/targeted home and name it; **or**
- record the ruling that it is not an authorization decision — which on this catalog it plainly is,
  so this option is not available.

Either way, the gate record must quote the `SCOPE:` line **and** the `RESULT: FINDING (1)` line, not
the bare exit code (ADR 0190).

---

### F-MAJOR-1 — `SELFTEST=1 scripts/door-sweep-cases.sh` is RED on this machine: `scripts/lib/merge-findings-baseline.sh:447` uses a GNU-only `diff` option

**Where:** `scripts/lib/merge-findings-baseline.sh:447-455`.

**Observed:** `selftest-deriver rc=1`, `SELF-TEST: PASS 17 · FAIL 17 · SKIPPED 0`. The **16
deriver-proper** scenarios all PASS; every failure is in the **merge helper** block, each with
`MERGE-ABORT: diff failed with rc=2 while aligning …/scripts/fixtures/door-sweep/m…`.

**Root cause, measured:**

```
$ diff --version           →  Apple diff (based on FreeBSD diff)
$ diff --unchanged-line-format='U%L' … f1 f2
  diff: unrecognized option `--unchanged-line-format=U%L'   rc=2
```

`:447` passes GNU diffutils' `--unchanged-line-format` / `--old-group-format` family; Apple's diff
rejects them and returns 2, which `:455` correctly turns into a hard abort. The
`docs/reviews/pred-domain-review.md` precedent records `SELFTEST=1 … -> 0, PASS 34 · FAIL 0` on the
other machine, so **this is a portability defect, not a regression from this unit's diff** — GNU
diffutils is evidently on `PATH` there and not here.

**Why it matters anyway.** (a) The hub's gate line requires `SELFTEST=1` (deriver + door harness) to
hold, and it does not hold at this tip on this machine; a red self-test cannot certify the sweep runs
beside it. (b) ADR 0190's findings-baseline **merge is impossible on this machine** — any full run
that needs to merge will abort — which the lead needs before planning the post-Batch-3 rebase and
re-run. (c) It is the same class as the macOS gate-13 bug this unit found and fixed in one line on
this branch (`--format=%(refname:short)` unquoted for `/bin/sh`); fixing one and leaving its twin red
in the self-test the same gate requires is the inconsistency worth naming.

**Remedy — any one, but it must be *recorded*, not left as a red nobody explains:**
- install GNU diffutils on this machine and re-run, recording that the harness has an undeclared
  `gdiff` dependency; **and/or**
- one line in `merge-findings-baseline.sh`: resolve `DIFF=$(command -v gdiff || command -v diff)`,
  and fail loudly with a named prerequisite when the chosen binary rejects the format options —
  a silent rc=2 abort reads as a corrupted baseline, not a missing tool;
- file the follow-up either way (`Closes when`: the merge helper runs green on a stock macOS `diff`,
  or the GNU-diffutils prerequisite is declared where the harness is invoked and checked at entry).

⛔ Not a remedy: skipping the merge block in the self-test. That converts a missing tool into a
missing arm.

---

### F-MINOR-1 — a migration id read as a calendar date, in the 03:00 procedure

**Where:** `docs/deployment/authz-rollback-runbook.md:235` — *"THIS ROW'S ✅ **EXPIRED ON 2026-10-03**
AND WAS MEASURED DEAD ON 2026-09-07."*

`2026-10-03` is the leading digits of migration id `20261003007340`, not a date; today is 2026-09-07,
so as written the runbook claims a control expired **four weeks in the future** and was measured dead
four weeks before that. Everything else in the row is correct.

**Remedy:** "expired at head `20261003007340`, measured dead 2026-09-07".

---

### F-MINOR-2 — § 8.8 says "12 declared sites" beside § 8.6's "13", with no LEARN-079 sentence

**Where:** `supabase/tests/410_ae49_d5_enforcement_manifest.sql:1082` (§ 8.8's caption) vs `:905`
(§ 8.6's `13 / 8 / 4`).

Both are right and I verified both: the 13th declared site,
`app.current_professional_read_organizations`, composes `authz.authorized_scope_ids` and does **not**
call the authorizer, so it is a site without being a consumer — 12 + 1 + 1 = 14. But this file goes
out of its way to state the two-populations rule for 8-vs-22 and does not state it for 12-vs-13,
where both numbers live in the same § 8 and the reader has just been told
"13 declared sites".

**Remedy:** one clause in § 8.8's caption — "12 **of the 13** declared sites (the thirteenth,
`app.current_professional_read_organizations`, is a site that composes `authz.authorized_scope_ids`
rather than the authorizer, so it is not a consumer — LEARN-079)".

---

### F-MINOR-3 — the one measurement in the record I could not reproduce, because the query is not beside it

**Where:** `docs/progress/enforcement-manifest.md:160` — *"global call-edge table: **2564 edges / 867
callers**"*, with the −2/+1 delta attributed to this migration.

Two faithful reconstructions of a "call-edge table" over comment-stripped `prosrc` give **2560 / 866**
(edges restricted to `app|authz|public` callers) and **2584 / 872** (all callers). Neither is 2564,
and the record gives no query, so the figure is not re-derivable. Nothing reads it — no gate, no
assertion — but `docs/backend-state.md`'s own standard for this program is *"Measured on a fresh
reset, **with the query so it is re-run rather than quoted**"*, and every other row of that
measurement table met it.

**Remedy:** paste the query beside row 1 (or drop the absolute figure and keep only the attributed
delta, which is what the row is actually for).

---

### F-REC-1 — the record's "live twins = 0 rows" shorthand should carry its predicate

`docs/progress/enforcement-manifest.md` (measurement row 8) and ADR 0193 D8 both say "zero live
policies carry that shape". The runbook is precise (`like '%is_staff_admin_of(app.commission_of_version%'`
→ 0); the summaries are not, and the bare shape `app.commission_of_version(form_version_id)` in both
halves **is** carried by 4 live policies. A reader checking the summary alone measures 4 and concludes
the claim is false. One inserted phrase — "zero carry the **pre-cutover** shape" — fixes both.

### F-REC-2 — for the gate record: note the mutation-window hazard

The lead's chain mutates live function bodies while other sessions may read the catalog. Worth one
line in the gate record (or `docs/learning/LESSONS.md`, if it recurs): a catalog read taken during a
sweep can return a mutant, and I hit it — `app._audit_access_authorized` read as `begin return true;
end` mid-run and restored minutes later. This is the reviewer-side twin of the "verified restore"
protocol in ADR 0189.

---

## 4. Axes with nothing to report

| axis | verdict |
| --- | --- |
| **Security / RLS** | ✅ No policy created, altered or dropped. No `GRANT`/`REVOKE` anywhere in the migration; the ACL on `public.set_item_validations` is unchanged (`authenticated=t`, `anon=f`) because `create or replace` preserves it. `prosecdef` and `search_path` unchanged and re-verified on the catalog. No new `public.*` RPC, so no `REVOKE ALL FROM PUBLIC` is owed. **`prosecdef` was checked beside `pg_policies` throughout** — indeed § 8.7 exists precisely to close the DEFINER axis a policy-shaped audit is blind to, which is this program's own standing lesson built into a gate. No service-role key anywhere; no client-reachable surface touched |
| **Code quality** | ✅ No `src/` or `e2e/` change, so `strict`/`any`/queries/Server-Components do not arise. The generator's new code is in the existing style, adds no dependency, and opens no connection. File ownership respected: one agent, backend-owned paths only, plus a one-line gate-script fix (`scripts/check-docs-registers.mjs:1179`) that is correct — quoting `'%(refname:short)'` stops `/bin/sh` on macOS rejecting the parentheses and silently emptying the branch list |
| **UX & a11y** | n/a — no user-facing surface |
| **Hygiene** | ✅ ADR **0193** exists, `**Amends:** 0176, 0178` in the header, generated back-pointers present on both amended ADRs, `INDEX.md` regenerated (190 ADRs, next free 0194, 0192 recorded as a known gap), added to `proposed-review.json` — the same registration 0191's status class implies. D6/D7 are written as settled, not contingent, which matches the PO rulings. `npm run lint` 0/0 across 13 gates; `features/INDEX.md` regenerated; `PROGRESS.md` untouched and correct (this is a unit, not a phase row) |
| **Vacuity** | ✅ See § 2.2. The only arm whose discrimination half is not provable at its own level is D1's, and that is disclosed and covered at self-test level — ruled sound in § 2.7 |

---

## 5. What must happen before this is `APPROVED`

1. **F-BLOCK-1** — § 6.7 step 4 re-measured and the "four stale figures" count corrected to five in
   the closure entry, the record and the hub. *(text only; no re-run needed)*
2. **F-BLOCK-2** — the diff-scoped sweep's `FINDING (1)` discharged in the record by naming
   `409` § 2.6f/§ 2.10e as the targeted case for `public.set_item_validations` (or by adding one),
   and the gate record quoting the `SCOPE:` **and** `RESULT:` lines rather than the exit code.
3. **F-MAJOR-1** — the deriver self-test's merge-helper red resolved or explicitly ruled, and the
   `gdiff` prerequisite recorded, before the post-Batch-3 rebase re-run is planned.
4. **F-MINOR-1/2/3** — three one-line text corrections.

None of these requires re-running `test:db`, re-measuring the manifest, or touching the migration.
On the substance — the fixed point, the re-key, the two new axes, the class sweep and the closures —
this unit is **approved on the merits**; what is outstanding is the record catching up with what was
actually measured, which is the standard this unit itself set.

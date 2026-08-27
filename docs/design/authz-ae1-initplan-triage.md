# AE1.5 — RLS initplan / permissive-policy triage

**Phase:** AE1 · **Branch:** `authz-ae1-hardening` · **Authority:** ADR 0155;
[docs/plans/authz-evolution.md](../plans/authz-evolution.md) § AE1.5 (F8).
**Inputs:** [authz-evolution-parity-ae0.md](authz-evolution-parity-ae0.md) §§ 3.2 / 3.4 ·
[authz-evolution-baselines-ae0.md](authz-evolution-baselines-ae0.md) (AE0.2 plan baselines —
read, never edited by this phase) · [authz-evolution-ae0-findings.md](authz-evolution-ae0-findings.md) § H.

**Status:** built; gate evidence in § 7 (door sweeps pending at time of writing).

**What shipped:** one migration, `20261003004710` — `auth.uid()` hoisted to an `InitPlan` across
**52 policies** on 29 tables. Advisor-flagged `auth_rls_initplan` policies **113 → 61**; inlined
per-row `auth.uid()` expansions in the captured plans **39 → 0**; `pg_policies` row count
**unchanged at 278**; every persona's visible `profiles.id` set **bit-identical**.

**What did not ship, and why it is the more useful record:** a second migration removing four
verbatim-duplicated arms from `profiles_admin_select` was written, applied, measured and
**withdrawn** (§ 4). It was provably identity — and the measurement showed its benefit was
**zero** (the duplicate SubPlans read `never executed`), while it destroyed a named
half-applied-migration detector in `371_offboarded_person_visibility.sql`. Two lessons came out
of it that outlive this phase: **a plan node that exists is not a plan node that runs**, and
**an edit can be perfectly behaviour-preserving and still destroy the instrument that proves
behaviour was preserved**.

---

## 0. What this document is, and what counts as evidence in it

AE1.5's acceptance evidence is the **before/after plan diff on the touched tables**, *not* the
advisor's warning count. A dropped warning count with an unchanged plan proves nothing, and this
document is written so that claim can be checked rather than believed.

Three constraints bound every measurement below. They are AE0's, restated because each one is a
way this document could have been wrong:

1. ⛔ **This database has no planner statistics** (`reltuples = -1`, `last_analyze` null
   everywhere — AE0 F-AE0-7). **`ANALYZE` was never run.** Running it would re-plan against real
   statistics and make every AE0 baseline incomparable, permanently, in both directions. The
   consequence for this document: **a cost-only diff is autovacuum noise, not a finding. Only
   SHAPE diffs are findings.** Every plan capture here is therefore taken twice — once as
   `EXPLAIN (ANALYZE, BUFFERS)` for comparability with AE0.2's recorded baselines, and once as
   `EXPLAIN (COSTS OFF)`, which strips the estimates so the text diff *is* the shape diff.
2. ⛔ **Arm-matching.** `cases_staff_admin_write` is `FOR ALL` and therefore a read policy too,
   short-circuiting the coordinator before `_case_caps` is reached (F-AE0-8). Every capture below
   fixes **one persona per table** and uses that same persona in the before and the after run, so
   arm-matching holds by construction rather than by care.
3. ⛔ **A plan captured as `postgres` is worthless** — RLS is not applied to a superuser. Every
   capture runs under a real `authenticated` session context minted the way AE0.2's harness mints
   it, and **section 1 of the capture script is a positive control that must discriminate before
   any plan in this document is trusted.**

---

## 1. Re-deriving the advisor's list locally — and one correction to AE0's caveat

AE0 § 4.2 records that the lead's hand-reproduction of Supabase's advisor aggregation returned
**81 and 18** against the remote's **113 and 101**, declared that a bad reproduction rather than a
divergence, and concluded that *"the exact aggregation algorithm behind 113 and 101 is not
reproduced or understood locally"*.

⭐ **That caveat holds for `multiple_permissive_policies`. It does NOT hold for
`auth_rls_initplan`, which is exactly reproducible locally.** `auth_rls_initplan` emits **one
warning per policy** carrying an unwrapped `auth.*()` call — there is no role fan-out and no
`cmd = ALL` expansion, which is what the hand-reproduction was modelling and what made it
undercount. A single `pg_policies` predicate reproduces it:

```sql
-- The local instrument for auth_rls_initplan.  Returns 113 rows, and that set is
-- byte-identical to the advisor's enumerated list (parity doc § 3.2).
with p as (
  select tablename, policyname,
         coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
    from pg_policies
   where schemaname = 'public'
)
select 'public.' || tablename || ' | ' || policyname
  from p
 where expr ~ '(?<!SELECT )auth\.(uid|jwt|role|email)\(\)'
 order by tablename, policyname;
```

**Verification, measured not eyeballed.** The 113 rows this returns were written to a file, the
parity doc's enumerated table (§ 3.2, lines 781–897) was extracted to a second file, and the two
were `diff`ed. **The diff is empty.** Per-table counts agreeing would have been an eyeball; a
`diff` is a measurement, and the distinction is the one AE0's own methodology finding turns on.

**Why this matters to AE1.5 and after:** the phase now has a **re-runnable local instrument** for
this rule. The before/after warning delta can be measured on the local stack in one query, without
a linked-project advisor round trip — and, more importantly, the *same* query is what the pgTAP
keystone asserts, so a future policy that reintroduces an unwrapped call reds a test.

⚠ Stated bound: this reproduces `auth_rls_initplan` only. `multiple_permissive_policies`
remains locally unreproduced (a naive local grouping returns 18 groups against the advisor's 101,
because the advisor fans `roles = {public}` out across six concrete roles on the six
`process_template_*` tables and expands `cmd = ALL` into four actions). **This document therefore
never quotes a `multiple_permissive_policies` count as evidence of anything.**

---

## 2. Ranking the 113 — and the instrument that could NOT be used

### 2.1 ⛔ `pg_stat_user_tables` is not the instrument here

The obvious ranking instrument is cumulative scan counts. It does not work on this stack and the
reason is worth recording, because the numbers it returns *look* usable:

| relname | seq_scan | idx_scan | n_live_tup |
| --- | ---: | ---: | ---: |
| `professional_credentials` | 0 | 36 | **0** |
| `memberships` | 31 | 0 | **0** |
| `hospital_affiliations` | 29 | 0 | **0** |
| `commissions` | 1 | 15 | **0** |
| `cases` | 1 | 0 | **0** |
| every other public table | 0 | 0 | **0** |

`n_live_tup = 0` on **every** public table and `pg_stat_database.stats_reset` is null. The
double-digit entries are not application traffic — they are **this session's own catalog and
census queries, issued minutes earlier**, plus the sibling AE1 agents'. Ranking by them would have
ranked the tables *this triage happened to look at first*.

⚠ The general shape: **an instrument that creates what it counts.** A scan counter is a
measurement of the observer as much as of the workload when the workload is zero.

### 2.2 The instrument that was used

Read frequency is taken from the **application read layer** — `.from('<table>')` references across
`src/lib` and `src/app`. It is a static proxy for how often a table is read in production, it is
reproducible, and it is not contaminated by the observer:

```bash
grep -rhoE "\.from\(['\"][a-z_]+['\"]" src/lib src/app \
  | sed -E "s/\.from\(['\"]//; s/['\"]//" | sort | uniq -c | sort -rn
```

| rank | table | `.from()` refs | initplan-flagged policies |
| ---: | --- | ---: | ---: |
| 1 | `profiles` | 25 | 1 |
| 2 | `commissions` | 23 | **0** |
| 3 | `memberships` | 15 | **0** |
| 4 | `hospitals` | 13 | **0** |
| 5 | `form_items` | 13 | 1 |
| 6 | `cases` | 13 | **0** |
| 7 | `responses` | 11 | 3 |
| 8 | `form_versions` | 10 | 1 |
| 9 | `meetings` | 9 | **0** |
| 10 | `professional_credentials` | 8 | 1 |
| 11 | `form_sections` | 8 | 1 |
| 12 | `case_referral` | 8 | 4 |
| 13 | `patient_safety_event` | 7 | 1 |
| 14 | `action_items` | 7 | 1 |
| 15 | `case_events` | 6 | 7 |
| 16 | `hospital_affiliations` | 5 | **0** |
| 17 | `rca` | 4 | 3 |
| 18 | `case_interviews` | 4 | 4 |
| 19 | `capa_plan` | 4 | 3 |

### 2.3 ⭐ The finding that reshapes the phase: the four headline hot tables carry ZERO warnings

`cases`, `commissions`, `memberships`, `meetings` — the four tables the plan names first, and four
of the top nine by application read frequency — **do not appear in the 113 at all.**

That is not an oversight in their policies; it is the correct outcome. Their predicates are built
from `app.is_*_of(<column>)` — `app.is_member_of(commission_id)`,
`app.is_org_admin_of(organization_id)`, `app.is_hospital_admin_of(hospital_id)`. Those calls take
a **`Var` argument**, so they are genuinely row-dependent and **must not be hoisted**: wrapping
one as `(select app.is_member_of(commission_id))` does not produce an `InitPlan`, it produces a
*correlated* `SubPlan` evaluated once per row anyway — no gain, and a plan-shape change for
nothing. This is precisely the plan's *"a caller-dependent function must not be hoisted across a
lateral boundary — when in doubt, leave it"*, and here it is not in doubt: it is structural.

⚠ **Consequence for how this phase should be read:** the initplan work cannot speed up the hot
paths the plan names first, because those paths have no initplan defect. What *does* reach them is
§ 4's duplicate-arm removal on `profiles`. The two workstreams are separate and only one of them
touches the measured-hot read paths.

### 2.4 Shape inventory of the 113 — why the fix is narrow

Every unwrapped occurrence was extracted with 45 characters of leading context and grouped. The
distribution:

| shape | approx. count | wrappable? |
| --- | ---: | --- |
| `app.can_*(<row column>, auth.uid())` — the inner argument | ~95 | ✅ **the argument only** |
| `<column> = auth.uid()` (`created_by`, `user_id`, `signed_by`, `signer_id`, `approver_id`, `id`) | ~12 | ✅ the whole term |
| `app.can_*(app.<derive>(<row column>), auth.uid())` | ~6 | ✅ the argument only |

⭐ The dominant shape is the first: **the outer `app.can_*` call is row-dependent and must not be
touched; its second argument is `Var`-free and wrapping it is unconditionally identity.** So the
transform this phase applies is a single, mechanical, provably-identity substitution —
`auth.uid()` → `(select auth.uid())` — and nothing else. No predicate is restructured, no arm is
added or removed, no function call is hoisted out of a row-dependent position.

**Why the substitution is unconditionally safe**, stated so it can be challenged rather than
assumed: `auth.uid()` is `STABLE`, reads only the `request.jwt.claims` GUC, takes no arguments and
references no `Var`. `(select auth.uid())` is therefore an **uncorrelated** subquery, which the
planner turns into an `InitPlan` evaluated exactly once per statement. It cannot become a
correlated `SubPlan`, it is unaffected by `SET ROLE` inside a `SECURITY DEFINER` body (it reads a
GUC, not the current role), and it is constant within a statement by definition of `STABLE`. The
value it returns is identical; only the number of times it is computed changes.

---

## 3. The hot subset taken this phase — 52 of 113

**Migration:** `supabase/migrations/20261003004710_ae15_initplan_wrap_hot_subset.sql`.

The cut is **the plan's own six named groups**, so the boundary is plan-derived rather than
author-chosen, and it is expressed as a **property over the catalog**, never a hand-list
(`[[enumeration-boundary-is-a-syntax-not-a-property]]`):

| group | tables | policies rewritten |
| --- | --- | ---: |
| G1 `case_*` | `case_events` 7, `case_referral` 4, `case_interviews` 4, `case_interview_{links,subjects,interviewers}` 2 each, `case_tag_assignments` 2, and `case_{participants,decisions,votes,recusals,reopenings,conflict_declarations,correction_requests}` 1 each | **30** |
| G2 responses family | `responses` 3, `answers` 3, `response_group_instances` 2, `response_section_signoffs` 1 | **9** |
| G3 meetings family | `meeting_cases` 3, `meeting_signatures` 1 | **4** |
| G4 person roster | `profiles` 1, `professional_credentials` 1, `professional_profiles` 1, `professional_participants` 1 | **4** |
| G5 targeted-read form path | `form_items` 1, `form_sections` 1, `form_versions` 1 | **3** |
| G6 `memberships`-adjacent | `commission_administrativos` 1, `commission_administrativo_capabilities` 1 | **2** |
| | | **52** |

### 3.1 The transform, and why it is unconditionally identity

One substitution and nothing else: `auth.uid()` → `( select auth.uid() )`, applied **only** to
`Var`-free occurrences. No predicate is restructured, no arm added or removed, no row-dependent
call hoisted.

**Counted in the committed migration text: 77 occurrences of `auth.uid()` across the 52
statements, 77 of them wrapped, 0 left bare, 0 double-wrapped** (a naive global replace would
turn an already-wrapped `( SELECT auth.uid() AS uid)` into `( SELECT ( select auth.uid() ) AS
uid)`; the generator's pattern excludes anything already preceded by `SELECT `, and the result is
asserted rather than assumed).

§ 2.4 gives the argument; it was also **verified against the planner before the migration was
written**, on a real query under a real `authenticated` context:

```
unwrapped:  Filter: app.can_read_case(case_id,
                      (COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                                (NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb
                                  ->> 'sub'))::uuid)
wrapped:    Filter: app.can_read_case(case_id, (InitPlan 1).col1)
            InitPlan 1
              ->  Result
```

⭐ Note what the unwrapped form actually costs: `auth.uid()` is a SQL function, so the planner
**inlines its whole body** into the filter — two `current_setting()` lookups, a `jsonb` parse and
a cast, **per row**. This is not a cosmetic advisor warning.

### 3.2 Two safety properties of the migration itself, stated so they can be checked

1. **`ALTER POLICY` is used throughout, never `DROP` + `CREATE`.** `ALTER POLICY` is *incapable*
   of changing `cmd`, `permissive` or `roles` — so the migration is structurally unable to change
   which command a policy gates or which roles it applies to. A `DROP` + `CREATE` could silently
   change all three and a reviewer would have to notice. Test 387 § D4 asserts it anyway.
2. **The file is static text, generated once at authoring time.** ⛔ It is *not* a runtime
   rewriter. This repo already carries migrations that mutate function bodies during apply via
   `pg_get_functiondef()` + `replace()` + `execute`, which is exactly why *"migration file text is
   stale by design"* is a standing rule here (ADR 0078 METHODOLOGY FINDING). Adding another such
   migration would make that rule truer. The generator lives in the phase's scratch, the artifact
   is literal SQL, and **this file's text is what it sets**.

---

## 4. ⛔ `profiles` — the verbatim-duplicated arms: PROPOSED, MEASURED, **WITHDRAWN**

**Migration `20261003004700` was written, applied, measured, and deleted.** It is not in the
tree. This section is kept — at greater length than the shipped work — because the measurement
that withdrew it is the most useful thing this phase produced.

**Status:** withdrawn 2026-08-27, PO-ruled, on the author's own recommendation after measurement
contradicted the finding that motivated it.

⚠ **Read § 4.4 before proposing this edit again.** The identity argument in § 4.1–4.2 is
*correct*, and correctness was never the problem.

### 4.1 The measurement, and a correction to F-AE0-6's magnitude

`profiles` carries **two** permissive `SELECT` policies for `{authenticated}`. Permissive policies
OR together, so the effective read predicate is their exact disjunction — confirmed in the live
`EXPLAIN` filter, which shows **all eleven arms**:

```
Filter: ((id = (InitPlan 1).col1)
      OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
      OR EXISTS(SubPlan 3)
      OR (app.is_active((InitPlan 6).col1) AND EXISTS(SubPlan 8))
      OR EXISTS(SubPlan 16)
      OR EXISTS(SubPlan 24)
      OR app.is_admin()                                                    <- profiles_admin_select
      OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))  <- dup
      OR EXISTS(SubPlan 28)   <- duplicate of SubPlan 3
      OR EXISTS(SubPlan 36)   <- duplicate of SubPlan 16
      OR EXISTS(SubPlan 44))  <- duplicate of SubPlan 24
```

⚠ **AE0 findings § H F-AE0-6 said "five arms are literal repeats". The measured number is FOUR** —
and the finding's own parenthetical listed four (`SubPlan 3≡28`, `16≡36`, `24≡44`, plus
`is_org_admin_of` twice). The number and the list disagreed, and the number was the wrong half.
*(Corrected in the AE0 findings doc at the same ruling, 2026-08-27.)*

**11 arms as written, 7 distinct.** Exactly one arm of `profiles_admin_select` — `app.is_admin()`
— is absent from the sibling. So

```
A  OR  B   ==   {app.is_admin()}  OR  B
```

bit for bit, because `A \ {is_admin} ⊆ B`. ⭐ **That subset relation is what makes the edit
identity rather than merely plausible**, and it is why this clears AE1.5's own bar
("consolidate ONLY where provably equivalent-intent") without judgement.

### 4.2 The minimal edit (as proposed)

`profiles_admin_select.qual` narrowed from five arms to `app.is_admin()`, with the surviving arm
hoisted to `( select app.is_admin() )`. **No policy dropped, nothing merged.** Both policies
survive, both stay `PERMISSIVE` / `SELECT` / `{authenticated}`.

⚠ **What makes it identity is that BOTH policies are `SELECT`** — the disjunction is closed within
one command, so narrowing one cannot reach another command. The superficially identical
duplicates elsewhere are *not* this shape; see § 5.2.

**And it was identity.** Applied, the per-persona visible-`profiles.id` md5 was **bit-identical**
for all nine control arms. That claim was never in doubt and is not why it was withdrawn.

### 4.3 ⭐ Why it was withdrawn, reason 1: the benefit does not exist

F-AE0-6 records the duplication as *"Live per-row invocation, **~4× cost, today**"*. Measured:

| `hospital_admin` arm (AE0.2 P5b) | with duplicates | with them removed |
| --- | ---: | ---: |
| top-level filter arms | **11** | **7** |
| SubPlans in the plan | **9** | **5** |
| cost estimate | 3644.73 | 1919.65 |
| **buffers** | **652** | **650** |
| execution time, 3 reps (ms) | 18.1 / 17.2 / 17.9 | 21.7 / 17.4 / 17.0 |
| **SubPlans actually EXECUTED** | 3 (`loops=14`), 8 (`=1`), 16 (`=1`) | **identical** |

⛔ **`SubPlan 28`, `36` and `44` — the three duplicates — read `never executed` in the plan.**
They are short-circuited by earlier arms in the OR. The executed work is the same on both sides.

The 4× gap between arms is real (652 buffers against `org_admin`'s 157) but it is caused by
**`SubPlan 3` at `loops=14`** — arm 3, **not** a duplicate, which survives any de-duplication.
AE0's own figure says so: SubPlan 3 = **457 of 533** buffers, quoted in the same finding that
attributed the cost to the duplication.

⭐ **The transferable lesson: a plan node that EXISTS is not a plan node that RUNS.** The
duplication was measured *structurally* (11 arms, 9 SubPlans — all true) and the cost was then
attached to it *by adjacency*. `never executed` is the discriminator and it was printed in the
same `EXPLAIN` the 4× was read from.

⚠ Bounded honestly the other way: `never executed` is measured at seed size, on the warm rep, for
this persona. Short-circuit is data-dependent. This says the saving is **not demonstrable here**,
not that it is provably zero everywhere.

### 4.4 ⭐⭐ Why it was withdrawn, reason 2: the duplication was load-bearing — for DETECTION

`371_offboarded_person_visibility.sql` § 5 asserts, **per policy and by name**, that *each* of the
two `profiles` SELECT policies still carries a `hospital_affiliations` leg. Its header says why:

> ⚠ BOTH PROFILES POLICIES ARE PERMISSIVE AND OR'D TOGETHER, so widening EITHER ONE alone makes
> every ALLOW arm below pass. **§5 is therefore not decoration: it is the only thing that can tell
> a fully-applied migration from a half-applied one. Per-policy, by name.**

⭐ **That is this section's own premise pointed the other way.** § 4.1 reasons: *permissive
policies OR together, so the duplicate arms are redundant and removing them is identity.* A prior
author reasoned: *permissive policies OR together, so widening either alone makes every ALLOW arm
pass — therefore the check must be per-policy*, and built the tripwire. **Both are true.** The
duplication is redundant *for authorization* and load-bearing *for half-applied-migration
detection*.

Removing the leg from `profiles_admin_select` made § 5.1 structurally unsatisfiable. The suite
caught it: `371` test 25 went red the moment `20261003004700` applied.

⛔ **The lesson, which is bigger than this edit: an edit can be perfectly behaviour-preserving and
still destroy the instrument that proves behaviour was preserved.** The six identical md5s in
§ 6.2 are exactly why this was not caught by reasoning — they were all green.

⚠ And the near-miss worth naming: the cheap way out was to rewrite § 5.1 to assert the leg across
the *disjunction*. That would have deleted a named, reasoned detector so that a plan-text
improvement with no measurable runtime benefit could ship, **in a hardening phase**. Editing a
test to accommodate a semantically-identical rewrite is legitimate (see § 7.4); editing one to
accommodate a behaviour-relocating change is the thing this project bans.

---

## 5. Deliberately left alone, with reasons

### 5.1 The 61 remaining initplan warnings — mechanical follow-up, named so nobody re-derives them

`rca_*` 15 · `capa_*` 15 · `ethics_*` 7 · `action_item*` 6 · `referral_*` 5 · `event_*` 4 ·
`interview_*` 4 · `controlled_document{s,_versions}` 2 · `document_approvals` 1 ·
`patient_safety_event` 1 · `patient_xref` 1 = **61**.

Same transform, same identity argument, no judgement required. They are outside the plan's named
hot set and were left only to honour AE1.5's *"fix only the measured-hot subset this phase"*. The
local instrument in § 1 re-derives the list in one query.

### 5.2 ⛔ `commissions`, `commission_meeting_types` — and 24 more tables — NOT consolidated

These carry verbatim-duplicated arms too, but across a **`FOR ALL`** policy and a **`FOR SELECT`**
policy. A `FOR ALL` permissive policy *is* a read policy (the F-AE0-8 shape), so the only
identity-preserving direction is to strip the arms from the **SELECT** policy — which would leave
`org_admin` / `hospital_admin` / tenancy-admin **read** access depending on a policy named
`…_write` continuing to exist. A later, entirely reasonable narrowing of a *write* policy would
then silently revoke *reads*, with no test naming the link.

**Escalated rather than decided; PO-ruled 2026-08-27: leave all of them, restructure as its own
decision.** Filed as **`FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY`**.

⚠ **The class is 26 tables, not 2** — measured as a property, not estimated from the advisor list
(the query is in the FUP body). `commissions`, `hospital_departments` and `hospitals` carry **two**
duplicated arms each; 23 more carry one, mostly `app.is_tenancy_admin_of(...)` on the
commission-scoped vocabulary tables. ⚠ **`organizations` and `hospitals` matter most** — top of the
tenancy tree, touched by every tenant-scoped read, and on `organizations` the duplicated arm is
`app.is_admin()`, a `SECURITY DEFINER` call evaluated **twice per row** inside an eight-term OR.

⚠ `form_items` and `form_sections` appear in **both** that census and § 3's hot subset. AE1.5
wrapped their `auth.uid()` and did **not** touch their duplicated arm. Do not read § 3's table
list as coverage of the FUP.

### 5.3 `app.can_*(<row column>, …)` — not hoisted, and this is structural

The outer call takes a `Var`. Wrapping it produces a *correlated* `SubPlan` evaluated once per row
regardless: no gain, and a plan-shape change for nothing. This is the plan's *"a caller-dependent
function must not be hoisted across a lateral boundary"* — not a judgement call here, a structural
fact.

### 5.4 `app.is_admin()` and the other zero-argument `app.*` predicates — filed, not done

The advisor's rule flags **only** `auth.*()`, so this whole class is invisible to it, to every
advisor run, and to every gate. The calls are nonetheless hoistable on exactly the argument
AE1.5's own fix rests on: `app.is_admin()` is `STABLE`, zero-argument and `Var`-free, so
`( select app.is_admin() )` is a valid `InitPlan`. Inside an `OR` it is evaluated **per row**, and
on `organizations` **twice per row** inside an eight-term disjunction — a `SECURITY DEFINER`
plpgsql function that reads the claims GUC and, on its fallback branch, queries `public.profiles`.

A hoist of `app.is_admin()` *was* briefly in scope, for the single case where migration
`20261003004700` collapsed `profiles_admin_select` to that one call. **It reverted with that
migration** (§ 4): the justification was "the policy is now nothing but this call", and that
premise is gone.

**Filed as `FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED`**, with the criterion stated as a property
(`pronargs = 0` and `provolatile in ('s','i')` and no `Var`) so the population is derived rather
than hand-listed, and with § 4.3's result attached as the expectation-setter: **measure `loops=`
and `never executed`, not arm counts.** AE1.5's own experience is that a structurally smaller plan
can deliver no measurable runtime change at seed size.

## 6. Before/after plan diffs — the acceptance evidence

### 6.0 How the two runs are made comparable

Both runs use the same scripts, the same personas, and the same explicit hats. Three properties
make the comparison admissible rather than merely repeated:

1. **Attribution.** Each run prints the migration head and the `pg_policies` fingerprint. The
   BEFORE run read `278 | f42d879a6f7142e034b8c7b4cdf9953b` — **byte-identical to AE0's recorded
   fingerprint**, so the policy set being measured is provably the one AE0.2 baselined, not a
   drifted descendant.
2. **A positive control that must discriminate.** Section 1 of the capture takes the visible
   `profiles` id-set under nine arms and **raises** if fewer than four differ. BEFORE:
   **8 distinct id-sets across 8 authenticated arms.**
3. **One reset between BEFORE and AFTER, with only AE1.5's migrations added.** BEFORE is
   re-captured at the start of the reset window, so whatever else has landed on the branch is
   present in *both* captures and the single delta is this phase's.

⚠ **Two fixture defects the control caught, both of which would have passed vacuously.** Recorded
because each is a reusable trap, not an AE1.5 detail:

- **`platform_admin` was measuring the wrong arm.** The hand-minted payload
  `{"sub": …b0, "is_admin": true}` omits `active_role`. `app.is_admin()` ends
  `and app.active_role() is not distinct from 'platform_admin'` (ADR 0106 D11, ACT), so it
  returned **false** and the principal fell through to the self-only arm: **1 profile instead of
  36**. Pinning that would have "proved" platform_admin identity while measuring a policy path
  that never ran — and `app.is_admin()` is the one arm § 4 *keeps*. The capture now carries a
  deliberate control row showing both readings side by side.
- ⚠ **`claims_for`'s derived hat is a fixture that changes silently.**
  `test_helpers.claims_for(user, is_admin)` mints `active_role` only when the principal holds
  **exactly one** live role. `orgadmin.b@test.local` already holds `{org_admin, staff_admin}`, so
  `claims_for('…b2', false)` mints **no hat at all** — the assertion would have measured a
  hat-less principal and still passed. **Every persona in test 387 now passes its hat
  explicitly.** This is not specific to AE1.5: any suite deriving a hat inherits a fixture whose
  arm moves when seed memberships move, with nothing able to notice.

### 6.1 `profiles` — BEFORE, and one number that does NOT reproduce

Two BEFORE captures were taken, and the difference between them is worth recording:

| capture | head | `hospital_admin` buffers | `org_admin` buffers |
| --- | --- | ---: | ---: |
| provisional (discarded) | `20261003004400` | **533** (`SubPlan 3` = 457) | **135** |
| **definitive** (post-reset, AE1.3 applied) | `20261003004620` | **652** | **163** |
| AE0.2's recorded baseline | `20261003004300` | **533** (`SubPlan 3` = 457) | **135** |

⭐ **The provisional capture reproduced AE0's buffer counts exactly** — 533 / 457 / 135, to the
buffer. That is strong evidence the harness and the session-context mechanism are faithful: two
independent operators, same numbers.

⚠ **The definitive capture does not, and the cause is NOT established.** Between the two, a full
`db reset` re-seeded the database *and* AE1.3's three migrations landed. Both are plausible
causes (a reseed changes physical layout; `case_referral` ids are seed literals but `case_events`
ids are not — see § 7.5) and **nothing here distinguishes them.** Recorded as an open observation
rather than attributed by adjacency — which is the exact error § 4.3 documents in F-AE0-6.

⛔ **It does not affect this phase's verdict**, and the two-reset protocol is why: BEFORE and
AFTER were both captured at head `…004620`+/-AE1.5 only, so the single delta between them is
AE1.5's own migration. The 533-vs-652 gap is *between AE0's stack and this one*, and no claim in
§ 6.2 crosses it.

⚠ For anyone re-running AE0.2's baselines later: **expect 652/163, not 533/135**, and do not read
the difference as an AE1.5 regression.

**BEFORE shape — the 11-arm filter, with the four duplicates marked:** quoted in § 4.1.

### 6.0a ⚖ RULED 2026-08-27 (PO) — the `costs off` SHAPE DIFF **is** AE1.5's acceptance evidence

Plan §AE1.5 step 3 mandates re-running **AE0.2's** baselines, and AE0.2 is defined as
`EXPLAIN (ANALYZE, BUFFERS)`, three repetitions. **That was not what AE1.5 produced** (QA finding
M4), and rather than manufacture it after the fact the PO ruled the substitution explicitly:

✅ **The 29-table `explain (costs off)` shape diff is the acceptance evidence.** The reason is not
convenience — it is that the mandated instrument cannot mean here what its name suggests. This
database has **no planner statistics** (`reltuples = -1`), and AE0.2's own header says the
baselines detect **plan-shape regressions** (index → seq scan, InitPlan → per-row), **not**
production latency, because the data is seed-sized. A `costs off` diff detects exactly that class,
and it does so *without* printing cost and buffer numbers that a later reader would inevitably
read as performance evidence they cannot be.

⚠ **What the substitution gives up, stated:** buffers, rows-removed and loop counts, which can
catch a regression that leaves plan shape intact. Nothing here covers that class. If it is ever
wanted, the re-run must be on a **statistics-free** reset to match AE0's condition — ⛔ and never
by `ANALYZE`-ing the AE0 comparison DB, which would destroy the baseline it is being compared to.

⛔ **And one headline metric is withdrawn.** §6.2 led with *"advisor-flagged policies 113 → 61"*.
The plan names the advisor's warning count as **explicitly not** the acceptance evidence, so it is
demoted to a corroborating observation. The surviving headline is the plan-text count — inlined
`current_setting` expansions **39 → 0** — which is a property of the plans themselves.

### 6.2 AFTER — and ⭐ a correction to F-AE0-6's MAGNITUDE

Captured in the reset window, head `20261003004710`, stack verified
(`auth.users` 36 · `commissions` 6 · `cases` 8 · `organization_affiliations` 35).
Positive control: 8 distinct id-sets across 8 authenticated arms, as before.

**Identity — the primary claim, and it holds exactly.** A `diff` of the nine-arm persona
control table BEFORE against AFTER is **empty**: every persona sees a bit-identical set of
`profiles.id`. `pg_policies` still holds **278** rows — no policy added, dropped, or moved
command.

**The wrap (52 policies) — the shape change is real and complete:**

| metric, over the 29 captured tables | BEFORE | AFTER |
| --- | ---: | ---: |
| inlined per-row `current_setting('request.jwt.claim.sub'…)` expansions | **39** | **0** |
| advisor-flagged policies, whole schema — ⚠ **corroborating only, NOT acceptance evidence** (§6.0a) | 113 | 61 |

Per table, the transform is visible directly — e.g. `case_decisions`:

```
BEFORE  Filter: app.can_read_case_committee(case_id,
                  (COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                            (NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb
                              ->> 'sub'))::uuid)
AFTER   Filter: app.can_read_case_committee(case_id, (InitPlan 1).col1)
        InitPlan 1
```

⛔⛔ **THE TABLE BELOW IS NOT PART OF AE1.5's AFTER EVIDENCE, AND ITS COLUMN HEADERS SAID IT WAS.**
Corrected 2026-08-27 at the QA gate (finding B4). It is §4.3's table, unchanged, and §4.3 measures
migration `20261003004700` — **the `profiles` duplicate-arm removal that was written, applied,
measured, and then WITHDRAWN and DELETED. It is not in the tree.** Under the heading *"AFTER —
head `20261003004710`"*, with columns relabelled `BEFORE | AFTER`, the same numbers read as the
measured effect of a migration that shipped. **The right-hand column describes a state that has
never existed.**

Measured against the live catalog at head `20261003005300`: `profiles_admin_select`'s `qual` is
**771 characters with 4 top-level OR arms** — the left-hand column's shape, not the right's.

⭐ **Nothing here was fabricated and no number is wrong.** §4.3's honest headers are *"with
duplicates | with them removed"* — a **counterfactual**, correctly labelled where it sits. Copying
the table under a BEFORE/AFTER heading converted a counterfactual into a claim about the tree, by
relabelling alone. *A measurement's meaning is carried by its column headers, and a table survives
being moved while its headers stop being true* — the same voice inversion the ADR index gate
exists for (`**Amends:**` vs `**Amended:**`).

⚠ **It propagated before it was caught**: the session handoff's § Dead ends quoted *"652 → 650
buffers"* from this table as established fact about the landed increment, and the lead repeated it.

**Retained below as §4.3's counterfactual, which is what it is** — the withdrawn migration's
`hospital_admin` arm, and the evidence for **why it was withdrawn** (removing the duplicates buys
~0, because the three duplicate SubPlans read `never executed`):

| `hospital_admin` arm (AE0.2 P5b) — ⛔ WITHDRAWN migration `…004700`, counterfactual | with duplicates (= the live tree) | with them removed (never shipped) |
| --- | ---: | ---: |
| top-level filter arms | **11** | **7** |
| SubPlans in the plan | **9** | **5** |
| cost estimate | 3644.73 | 1919.65 |
| **buffers** | **652** | **650** |
| execution time, 3 reps (ms) | 18.1 / 17.2 / 17.9 | 21.7 / 17.4 / 17.0 |
| **SubPlans actually EXECUTED** | 3 (`loops=14`), 8 (`=1`), 16 (`=1`) | **3 (`loops=14`), 8 (`=1`), 16 (`=1`)** |

⛔ **F-AE0-6 records the duplication as *"Live per-row invocation, ~4× cost, today"*. The
measured effect of removing it is ~0, and the reason is in the BEFORE plan itself: `SubPlan 28`,
`36` and `44` — the three duplicates — read `never executed`.** They are short-circuited by
earlier arms in the OR. The executed work is *identical* on both sides of the change.

The 4× gap between the arms is real (652 buffers for `hospital_admin` against 157 for
`org_admin`) but it is caused by **`SubPlan 3` at `loops=14`** — which is arm 3, **not** a
duplicate, and survives any de-duplication. AE0's own figure says so: SubPlan 3 accounted for
**457 of 533** buffers. The finding attached a real 4× to the wrong cause.

⚠ **The general shape, worth more than the digit:** the duplication was measured *structurally*
(11 arms, 9 SubPlans — true) and the cost was then attributed to it *by adjacency*. A plan node
that exists is not a plan node that runs. `never executed` is the discriminator, and it is
printed right there in the same `EXPLAIN` the 4× was read from.

⚠ **Bounded honestly in the other direction:** `never executed` is measured at **seed size, on
the warm rep, for this persona**. Short-circuit is data-dependent — a principal and row
combination where arms 1–7 all fail would reach the duplicates. This says the saving is *not
demonstrable here*, not that it is provably zero everywhere.

### 6.2.1 ⛔ A self-erasing instrument, caught before it reported success

The first AFTER table capture selected its subject tables by *"currently carries an unwrapped
`auth.uid()`"* — **the very property the migration removes**. BEFORE selected 29 tables; AFTER
selected **zero**, and `diff <full file> <empty file>` reads exactly like a clean sweep. It was
caught only because "0 InitPlans in the AFTER run" made no sense.

**The fix is to normalize before selecting**: un-wrap `( SELECT auth.uid() AS uid)` back to
`auth.uid()` *first*, then test. That predicate picks the same subjects on both sides of the
change. ⚠ The general rule: **a detector whose domain is defined by the defect it fixes finds
nothing after the fix, and the emptiness reads as success.**

*(A side effect of the corrected selector, verified rather than assumed: it also picks up 8
`case_*` tables whose `auth.uid()` was **already** wrapped before AE1.5 — `case_narratives`,
`case_phases`, `case_access_grants`, `case_custom_field_values`, … None is touched by
`…004710`; confirmed against the migration text and the catalog. So the wrapped form was already
established practice in this codebase, which is corroboration for the identity argument rather
than a novelty introduced here.)*

### 6.2.2 Does the AFTER capture stay representative at `…005300`? Yes — and the overlap is one policy

**Answered 2026-08-27** (QA finding m5), because "nobody has ruled either way" was itself the gap:
the capture is at head `…004710` and three migrations have landed since, so the question is real.

Measured rather than assumed: of `…005100` (an index on `commission_administrativos`), `…005200`
(the `TO public` normalization) and `…005300` (`ALTER DEFAULT PRIVILEGES`), **only `…005200` touches
any of the 29 captured tables** — and it touches **`case_referral`**, which is not merely one of the
29 but carries **`case_referral_delete_draft_source`, one of the 52 policies `…004710` wrapped**. So
the overlap is at the *same policy*, not merely the same table.

Two facts bound it, both catalog-measured:

1. `ALTER POLICY … TO authenticated` changes `polroles` and **cannot change `qual`** — and the
   policy still carries AE1.5's wrap today (`qual ~ '\( SELECT auth.uid\(\)'` → **true**,
   `roles = {authenticated}`, `cmd = DELETE`).
2. It is a **DELETE** policy, so it was already in §6.3's no-read-plan class: there is no read plan
   for it to move.

⇒ **No plan-shape movement is expected, and the other 28 tables are untouched by `…005200`/`…005300`.**
⚠ Stated as what it is: an **inference from two measured facts**, not a re-capture. Plan §AE1.5
step 3 makes the plan diff *"the acceptance evidence"*, so if a re-capture is ever wanted this is the
one table that would need it.

### 6.3 Hot-subset tables — shape capture

`explain (costs off)` over all **29** hot-subset tables under one fixed persona
(`chefe.ccih` / hat `staff_admin`, passed explicitly), so a plain `diff` of the two runs is the
shape diff with the cost noise removed at the source. Positive control inside the same
transaction confirms `app.is_member_of(CCIH) = true` before any plan is emitted.

⚠ **Stated rather than faked:** for the policies whose only edit is in `with_check` (INSERT
policies — `answers_insert_targeted`, `case_events_writer_insert`, `meeting_signatures_insert`,
`signoffs_insert`, …), **there is no read plan to diff.** A `WITH CHECK` predicate is evaluated
against a proposed row on write; capturing it would mean executing writes against the shared
stack. For those, the acceptance evidence is the catalog identity assertion (test 387 § C) plus
the red-first fix detector — **not** a plan diff. A missing baseline is honest; a mislabelled one
poisons every later comparison.

⚠ **AND THE CARVE-OUT WAS UNDER-SCOPED — extended 2026-08-27 (QA finding M4).** The clause above
names only the `with_check`-only INSERT class. There is a second class with no read plan to diff:
a table whose **edited** policies are all non-SELECT, even though the table itself has a SELECT
policy. Two of the 29:

| table | what `…004710` actually edited | why no read plan shows it |
| --- | --- | --- |
| `meeting_cases` | `meeting_cases_staff_admin_update` (UPDATE, `USING` + `WITH CHECK`) | its `meeting_cases_select` was **not** edited |
| `profiles` | `profiles_update_self` (UPDATE, `USING` + `WITH CHECK`) | its `profiles_select_self_or_admin` was **not** edited |

⛔ **The catalog alone gets this WRONG, and did on the first pass.** Both SELECT policies *do*
carry `( SELECT auth.uid() )` today — so a catalog read says "the SELECT policy is wrapped, a read
plan will show the change". It will not: those two were **already written that way** before AE1.5.
Attribution needs the phase's own change list, and `20261003004710_ae15_initplan_wrap_hot_subset.sql`
names `meeting_cases_staff_admin_update` and `profiles_update_self` and **not** the two SELECT
policies. ⭐ *The catalog tells you the current state, never who caused it* — the one question for
which the migration file is the right instrument, because "what did this phase intend to edit" is
exactly what it records.

⇒ So §6.2's `profiles` material was never going to be a plan diff of AE1.5's own change, which is
the vacuum B4's withdrawn-migration table had filled.

---

## 7. Gate evidence

### 7.1 Red-first observation, then green

Red-first was observed **twice** — once for the original suite, and again after § 4's withdrawal
forced `387` to be re-scoped. The second observation is the one that counts, taken on a fresh
reset at head `20261003004620` with `…004710` held aside:

```
Files=235, Tests=7793, Result: FAIL          (exit code 1, captured directly)
387_initplan_wrap_and_profiles_arm_identity.sql  (Tests: 25 Failed: 3)
  Failed tests:  1-2, 20
    A1  have: 52                    want: 0
    A2  have: (id = auth.uid())     want: (id = ( SELECT auth.uid() AS uid))
    D2  have: 113                   want: 61
```

**387 was the only failing file.** The three reds are exactly the three fix detectors; the 22
greens are the regression invariants and the vacuity controls — including **D1a, which passes
*before* the migration**, proving the § B md5 instrument moves when the visible row set moves
rather than being a constant.

**After applying `…004710`:** `Files=235, Tests=7793, Result: PASS, exit 0` — the whole suite,
including `387` (25/25), `270` (55/55) and `371` (35/35).

⚠ **One suite figure to disregard, recorded so nobody re-derives it:** a `Files=235, Tests=7444,
FAIL` reading was produced mid-window by a *concurrent* `npm run test:db` from a sibling agent.
Eight files aborted at `test_helpers.bootstrap()` on `deadlock detected` over
`truncate public.organizations cascade`, with **zero assertion failures**. Contention, not a
defect. **The same collision aborted this phase's first door-sweep attempt at preflight**, which
reported *"baseline is NOT green"* — see § 7.2. ⭐ Worth knowing generally: **the door sweep's
preflight runs the full pgTAP suite as its baseline, so the sweep is a suite runner as well as a
catalog mutator**, and it collides with a concurrent `test:db` exactly the way two `test:db` runs
collide — but the failure surfaces as "dirty baseline", which reads like a defect in the tree.

### 7.2 Diff-scoped door sweep

Cases derived with `scripts/door-sweep-cases.sh` — **never by hand**. Exit code **0 (DERIVED)**,
**54 cases**.

⚠ **The derivation spans two agents' work.** The working tree also held `ae1-doors-build`'s three
untracked migrations, so the raw list includes **`can_administer_person_for`, which is not
AE1.5's**. Verified by inspection of the *intent* (their three files contain **zero**
`create`/`alter`/`drop policy` statements — file text is the right source for what an unapplied
migration intends, the catalog for what is): **no policy overlap.** AE1.5 owns the **53 policy
cases**; the function case belongs to AE1.3 and is called out rather than silently dropped —
excluding it quietly is how a gate falls between two owners.

⚠ **Ruling 3 fires on 31 of them**: an `ALTER POLICY` keeps the gate's *name* and changes its
*predicate*, so an existing `COVERED` was earned against a question that no longer exists and
**must not be inherited**. `ARM=census` does not backstop this — the gate is not a newcomer.

⛔ **The sweep is run, not reasoned past.** It is tempting to argue that ruling 3's premise fails
for the 52 wrap cases — the predicate is provably identity, so the verdict *is* about the same
question. That argument is probably correct **and it is not a licence**: the script deliberately
carries no `ACK=1` escape hatch, because an escape hatch for the unmeasurable also silences the
measured.

⭐ **And this phase supplies the counter-example that settles it.** § 4's withdrawn migration was
bit-for-bit identity on every persona md5 **and** it destroyed pgTAP 371's per-policy
half-applied-migration detector. **Identity-of-behaviour does not imply
identity-of-observability** — which is precisely the inference the shortcut asks for. Thirty gates
cost ~30 minutes; being wrong costs a silent hole with no arm behind it.

### 7.2.1 ⛔ A gap in the diff-scoped recipe: it derives for two arms and points at one

The first sweep printed **"REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM"** for **22 of the
52** — exactly the **non-SELECT** policies (`answers_insert_targeted`, every
`case_events_{staff_admin,writer}_{insert,update,delete}`, `case_interviews_{insert,update,delete}`,
`case_referral_{insert,update,delete}*`, `meeting_cases_staff_admin_*`, `meeting_signatures_insert`,
`profiles_update_self`, `responses_delete_own_draft`, `responses_update_targeted`,
`signoffs_insert`).

The cause is in the harness headers, not inferred:

- `p0-authz-door-audit.sh` audits **the READ layer** — *"boolean predicates + SELECT/ALL read
  policies"*.
- `p0-authz-writepath-audit.sh` audits **the WRITE layer** — *"the value-returning authz
  RAISE-GUARDS **and the INSERT/UPDATE/DELETE policies**"* — and its own header says a `CASES=`
  run is *"the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE"*.

⛔ **`scripts/door-sweep-cases.sh` derives every altered policy — read and write — but the
paste-able command it prints names only the READ harness.** An operator following the deriver's
own output therefore sweeps the read half, and the write half goes unmeasured with nothing
saying so. It surfaced here only because the read harness reports its unmatched cases and
**refuses to end CLEAN** when part of what was asked for was not measured — the right behaviour,
and the only reason this was visible at all.

**AE1.5 runs both arms** with the same 52-case list, each selecting its own domain.

### 7.2.2 `ARM=policy` — verdicts

```
ARM-DOMAIN predicate=0/112 policy=30/226 out-of-domain-bool=35
SWEPT: 30 gate(s)   COVERED: 30   BLIND: 0   ERROR(harness): 0
=== RESULT: UNPROVEN (PARTIAL) ===                      exit code 3
```

All **30** altered read policies measured **COVERED** — each re-measured against its
**post-`ALTER`** predicate, none inherited. The 30:

`answers_select_targeted` · `case_conflict_declarations_select` · `case_correction_requests_select` ·
`case_decisions_select` · `case_events_select` ·
`case_interview_{interviewers,links,subjects}_{select,write}` · `case_interviews_select` ·
`case_participants_select` · `case_recusals_select` · `case_referral_select_readable` ·
`case_reopenings_select` · `case_tag_assignments_{select,staff_admin_write}` · `case_votes_select` ·
`commission_administrativo{s,_capabilities}_select` · `form_{items,sections,versions}_select_targeted` ·
`professional_{credentials,participants,profiles}_select` ·
`response_group_instances_{select,write_own_draft}` · `responses_select_targeted`.

⚠ **`case_correction_requests_select` previously carried `BLIND` in the committed findings and
now measures `COVERED`.** A verdict change on a gate whose old row ruling 3 invalidated — it moves
in the good direction, and a merge that simply preserved the old row would understate coverage.

⭐ **`ARM=predicate` reported `EMPTY DOMAIN — it did not hold; it did not run.`** It is counted as
nothing. `out-of-domain-bool=35` is the size of the **unclassified** set, never a defect count.

⛔ **The run's verdict is `UNPROVEN`, and this document does not call it a pass.** The harness's
own words: *"A clean verdict over a subset of what was asked for is the finding this gate exists
to prevent."* The missing 22 are the write-layer cases of § 7.2.1, swept by the other arm.

**Baseline integrity, measured rather than remembered** (the hazard the recipe attaches to this
command): `git diff --stat -- docs/reviews/authz-door-audit-findings.md` → **empty**, and the
harness independently printed *"committed baseline VERIFIED unchanged (cksum)"*. The subset
report is a scratch file under `$WORK`; nothing was merged into the baseline here — per ADR 0079
Amendment 1 that is a **merge of the changed rows, never a copy** of the subset over it.

⚠ **Two attempts, one aborted, stated rather than smoothed over.** The first run aborted at
preflight with *"baseline is NOT green"*. It was **not** retried blind: the DB was re-measured
(unchanged) and the suite re-run (`PASS`, exit 0) first, which localised the cause to a sibling
agent's concurrent `npm run test:db`. See § 7.1.

### 7.2.3 `ARM=writepath` — ⛔ measured NOTHING, and reported exit 0

```
BLIND: 0   ERROR(harness): 13   SKIPPED(vacuous): 0   (COVERED = the rest)
WRITEPATH EXITCODE=0
```

**What the summary line does not say, established by cross-checking the 22 write cases against
the harness's embedded worklist:**

| of AE1.5's 22 write-layer cases | count | outcome |
| --- | ---: | --- |
| present in the worklist, hit the drift tripwire | **13** | `ERROR` — **not swept** |
| absent from the worklist entirely | **9** | never selected — **not swept** |
| **COVERED** | **0** | — |

`p0-authz-writepath-audit.sh` embeds a 33-policy worklist with each policy's exact
`qual`/`with_check`, plus a **§7.2 drift tripwire**: *"the live catalog must match the embedded
snapshot, else the worklist is stale and neutralizing is unsafe. ERROR (not a result), do not
open."* AE1.5's wrap changed the text of 13 of them, so it correctly refused to neutralize. **The
tripwire behaved exactly right.** What follows it did not:

⛔ **`(COVERED = the rest)` computes a residual over an empty set, and the harness exits 0 having
measured nothing.** Its sibling `p0-authz-door-audit.sh` handles the identical situation
correctly — exit **3, `UNPROVEN (PARTIAL)`**, with *"A clean verdict over a subset of what was
asked for is the finding this gate exists to prevent. NOT a pass."* **Two harnesses meant to be
halves of one gate, same class of shortfall, opposite handling.** A reader going by exit codes
records this phase clean.

The 9 absent ones — `answers_{insert,update}_targeted`, the six
`case_events_{staff_admin,writer}_{insert,update,delete}`, `responses_update_targeted` — are in
**neither arm's domain**. Pre-existing, not caused by AE1.5, and invisible until a phase happened
to alter them.

### 7.2.4 ⚖ AE1.5's gate position — the line, in words, never an exit code

> **52 altered · 43 measured · 9 UNMEASURED BY EITHER ARM · proven on the read half, PARTIAL on
> the write half.**

⛔ **Never record this as "all arms green", and never as an exit code.** Both harnesses exit in
ways that would mislead: the read arm exits **3** having measured everything it could, and the
write arm exits **0** while silently dropping cases (§ 7.2.3).

**How the number 43 is known — provenance matters more than the number here.** It comes from a
**cross-check of the requested cases against `p0-authz-writepath-audit.sh`'s embedded 33-policy
worklist**, performed by hand:

```
of AE1.5's 22 write-layer cases:  13 present in the worklist   ->  measured
                                   9 absent from the worklist  ->  never selected, never mentioned
```

⭐ **It does NOT come from the harness's report. The harness would have said 52** — it prints no
"requested but never swept" line, so its `COVERED` count reads as coverage of everything handed
to it. A number taken from that output would have been wrong in the safe-sounding direction.

**THE 9, NAMED INDIVIDUALLY** — never as a count, because a count is what let them hide, and
never in brace shorthand, because a future reader greps for a policy name:

1. `answers_insert_targeted` 2. `answers_update_targeted`
3. `case_events_staff_admin_insert` 4. `case_events_staff_admin_update`
5. `case_events_staff_admin_delete` 6. `case_events_writer_insert`
7. `case_events_writer_update` 8. `case_events_writer_delete`
9. `responses_update_targeted`

**PO-visible disposition (lead ruling, 2026-08-27):** the 9 sit outside **both** arms' domains —
a **pre-existing apparatus gap**, same family as `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2). AE1.5 did
not create it; it **revealed** it by altering policies that fall in the hole. Blocking on it would
mean blocking on machinery that does not exist, for a defect this phase found rather than caused —
and that would make surfacing an apparatus gap more expensive than not looking. Accepted as
**PARTIAL**, filed as `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`, and flagged to the PO rather than
inherited by them.

### 7.2.4a ⛔ INCIDENT — a killed mutation harness left an RLS policy WIDE OPEN

**Recorded in full because the failure was the operator's, and because the recovery turned on a
detail that would normally be skipped.**

During the write-path re-run a sibling agent added `supabase/tests/388_service_rpc_acls_and_minutes_latch.sql`
to the tree. The harness caught it exactly as designed —
`ERROR | run-shape!=baseline (Files=236 Tests=7855)` against its baseline of `235/7793` — and
**every subsequent gate was going to `ERROR`**, because the baseline is captured once at run start
and cannot re-sync. To avoid spending ~15 minutes generating invalid verdicts, the run was killed.

⛔ **The kill landed between "open the gate" and "restore it". The harness's `trap … EXIT` restore
did not run, and `meeting_cases.meeting_cases_staff_admin_update` was left `qual=true wc=true` — a
`FOR UPDATE` policy on `meeting_cases`, fully open to `authenticated`, on the shared local stack.**

⭐ **How it was found, and the near-miss inside it.** The check for degenerate policies returned
**11**. Ten of those are `qual = true` **by design** — vocabulary/lookup `SELECT` policies
(`action_item_statuses`, `referral_types`, `reply_outcomes`, `professional_categories`, `pqs_*`,
`document_retention`, …). **Asking "is the count zero?" would have returned 11, looked like a
pre-existing baseline, and passed.** Only enumerating them showed the eleventh was an `UPDATE`
policy with `wc = true`, which no lookup table has. *A count is what lets a thing hide* — the same
lesson as § 7.2.4's nine, one layer down and with a live security consequence.

**Recovery: `supabase db reset`, not a hand-written `ALTER POLICY`.** A reset rebuilds from
migrations, so there is no opportunity to restore a subtly wrong predicate and it repairs anything
else the kill may have left. Verified after: degenerate back to **10**,
`meeting_cases_staff_admin_update` carrying its real predicate, **278** policies, **61** flagged.

⚠ **Two standing lessons:**

1. **`p0-authz-{door,writepath}-audit.sh` are NOT safe to kill.** They mutate live policies and
   rely on an EXIT trap. A killed run can leave a gate open with nothing anywhere reporting it.
   When a run is contaminated, let it finish and discard the verdicts — or add a documented
   recovery step. Filed against `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`.
2. ⛔ **The contamination surface of a sweep is the WORKING TREE, not the database.** This phase
   requested "DB silence" from its siblings; that request was **insufficient and wrong**. The
   harness's baseline is the *suite's shape* (`Files=`/`Tests=`), so **adding a test file
   invalidates a sweep exactly as effectively as touching the DB** — and nothing about doing so
   looks like database activity to the person doing it.

⚠ **Not claimed as evidence:** the killed run produced **6 `COVERED`** before contamination
(`case_interviews_{delete,insert,update}`, `case_referral_{delete_draft_source,insert_source_coord,update_coord}`).
They are good indirect evidence that the § 7.2.3 snapshot fix works — the rows swept instead of
drifting — but they are **not recorded as verdicts**: they come from a run whose later gates are
known invalid, and **a partially-contaminated run is not a source of partial truth.**

### 7.2.5 Findings-baseline merge

**Condition (revised by the lead 2026-08-27):** the original *"merge only once the combined run is
not-PARTIAL"* was **unmeetable** — the 9 are unmeasurable by either arm today. Revised to: **merge
the verdicts that were actually MEASURED, changed rows only, never a copy** (ADR 0079 Amendment 1).

⛔ **The 9 get NO rows — not even a placeholder.** A findings file with no row for a case is the
honest representation of "not measured"; a placeholder row would assert something about a case
nothing measured. The partial-ness lives entirely in the rows that do not exist.

⚠ **`case_correction_requests_select` flips `BLIND` → `COVERED`** and is called out individually
at merge, not folded into a count. A verdict flip is the one kind of row a reader must see on its
own — and this direction is the one a later reader would be tempted to assume rather than verify.

### 7.3 ⚠ D11 re-sweep for stranded predicate references

AE1.5 re-keys no column and renames nothing, so the D11 class (a policy naming a dropped column,
which fails at parse only when *evaluated*) has no vector here. Asserted anyway rather than
argued: test 387 § C un-wraps every predicate on the hot tables and compares to a pre-migration
pin, and every policy is exercised by a live read in § B or by the sweep in § 7.2 — a stranded
reference would fail at evaluation, not pass quietly.

### 7.4 Two existing text pins broken by the wrap — blast radius MEASURED, not guessed

A wrap that rewrites 52 predicates will break anything that pins predicate **text**.

⚠ **This section first said "the full pgTAP suite found exactly two, which is the measurement".
That was wrong, and the way it was wrong is the point: there are THREE sites, and the third is
not in any suite.** `npm run test:db` cannot see a pin that lives in a **mutation harness**, and
`p0-authz-writepath-audit.sh` embeds a 33-policy worklist carrying each write policy's exact
`qual`/`with_check` text as a drift tripwire. It fired on **13** of them (§ 7.2.3).

⭐ **The lesson, which generalises well past this phase: a blast-radius claim inherits the domain
of the instrument that produced it.** `npm run test:db` bounded the search to **suites**, and pins
also live in **harnesses**. *"The full suite found exactly two"* sounded exhaustive precisely
because the suite **is** exhaustive — over suites. The claim was true about its instrument and
false about the world, and nothing in the sentence marked the boundary.

The three sites:

| pin | what broke | disposition |
| --- | --- | --- |
| `270_ff1_repeating_groups.sql` J1c | `~ 'created_by = auth\.uid\(\)'` no longer matches `created_by = ( SELECT auth.uid() AS uid)` | **matcher widened** (PO-approved) |
| `371_offboarded_person_visibility.sql` § 5.1 | `profiles_admin_select` lost its affiliation leg | ⛔ **migration withdrawn** — see § 4.4 |
| `p0-authz-writepath-audit.sh` embedded worklist | 13 policies' exact text no longer matches the snapshot | **13 gates left UNMEASURED** — § 7.2.3 |

⭐ **The two were handled oppositely, and the distinction is the whole rule.** `270`'s pin is
broken by a change of **representation** — same predicate, same value, same behaviour — so
updating the matcher preserves the pin's intent. `371`'s pin is broken by a change of **which
policy supplies a guarantee**, so updating it would delete the guarantee's only witness. *Editing
a test to accommodate a semantically-identical rewrite is legitimate; editing one to accommodate
a behaviour-relocating change is not.*

⚠ **A widened matcher must be proven still able to fail** — "accept both forms" decays into
"accept anything" one alternation at a time. `270` gained two vacuity controls that exercise the
*same* function the pin uses, against strings it must reject: the term **deleted** (the original
`fup_qob1_drop_created_by` mutation, in its hoisted spelling) and the term present on the
**wrong column** (which a lazier `~ 'auth\.uid'` would have accepted). Plan count 53 → 55.

### 7.5 ⛔ A pin defect caught by the two-reset protocol: seed ids are not all stable

Four secondary behaviour pins were originally written as id-set md5s. Re-capturing them after
reset #1 showed three had **changed while their row counts held**:

| pin | ids | md5 across two resets | row count |
| --- | --- | --- | ---: |
| `profiles` (B1–B6) | seed **literals**, 36 of 36 | **identical** | 10 / 23 / 29 / 36 / 5 |
| `case_events`, `responses`, `answers` | `gen_random_uuid()` at seed time | **moved** | 1 / 7 / 26, unchanged |
| `case_referral` | literals (`efa00000-…`) | **identical** | 3 |

An id-md5 pin on the middle row would have **red on every `db reset`, forever, looking exactly
like a real regression.** Those three now pin counts; `case_referral` keeps the stronger set
form. ⚠ And because a bare count is consistent with RLS filtering *nothing*, B11 asserts the
RLS-bypassed totals (**1 / 13 / 50 / 4**) so the differentials are visible as data: B8 is 7 of 13,
B9 is 26 of 50, B10 is 3 of 4 — and **B7 is 1 of 1, which is demonstrably not a differential at
all.** The weakness is measured in the suite rather than left unstated.

### 7.5a ⚠ Carried correction: ADR 0162 **PA-F15** is half right — the remedy is ONE index, not two

Not AE1.5's work and not AE1.5's to fix; recorded here because an uncorrected count propagates.
PA-F15 states that AE1.1's two FKs on `commission_administrativos` lack supporting indexes.
**Measured:** the table has one index, the PK on `(commission_id, user_id)`.

- `commission_id` is the **leading** column, so **that FK is already supported** — a btree on
  `(a, b)` serves lookups on `a`.
- `user_id` is **trailing**, so the same index does **not** serve lookup by `user_id` alone; a
  cascade from `profiles` would seq-scan.

**One index is owed, not two.** ⭐ The general shape is the one § 4.3 documents in F-AE0-6: the
*direction* of the finding is right and its *magnitude* is not, and a magnitude is the part that
gets quoted onward without re-derivation.

### 7.5b ⭐ Regenerating from the catalog is NOT sufficient — the regeneration needs its own differential

The 13 drifted worklist rows in `p0-authz-writepath-audit.sh` were regenerated **from the live
catalog**, never hand-typed, which is the standing rule and which everyone would call correct.
**It was not enough.** The generator's `polcmd` mapping was wrong — `a → ALL`, `r → INSERT` — when
in `pg_policy` **`a` is INSERT and `r` is SELECT** (measured on `public`: `a`=14, `r`=174, `w`=17,
`d`=11, `*`=62).

It would have rewritten **five INSERT rows as `ALL`**. Since a `FOR ALL` policy **is** a read
policy, the harness would have quietly begun auditing something other than what its worklist
claimed — and **nothing downstream would have reported it**: the drift tripwire compares
`qual`/`with_check`, not `cmd`, so the corrupted rows would have swept clean and returned
confident verdicts about the wrong question.

**What caught it was a pre-apply differential, not review:**

```
un-wrap the regenerated lines  ->  diff against the lines they replace
                               ->  the ONLY permitted delta is the auth.uid() hoist
```

⭐ **The reusable rule: "regenerated from the catalog" describes the *source*, not the
*transformation*. A generator can read a correct catalog and still emit a wrong row.** Any
mechanical rewrite of a pinned artifact needs a differential against what it replaces, with the
permitted delta stated in advance — otherwise the authority of the source launders the error in
the mapping.

⚠ Note the shape it shares with § 6.2.1's self-erasing instrument and with the `271`/`371`
distinction: in all three, the artefact was *derived correctly from a real source* and was still
wrong, because the derivation's **domain or mapping** was unexamined.

### 7.6 The fixture defects, and why they belong in a gate record

Both were caught by controls, not by review, and both would have produced a **passing** assertion:

1. **The `platform_admin` arm measured the wrong policy path.** A hand-minted
   `{"is_admin": true}` with no `active_role` makes `app.is_admin()` return **false** (ADR 0106
   D11, ACT), so the principal falls to the self-only arm — **1 profile instead of 36**. The
   capture keeps a deliberate control row showing both readings side by side.
2. **`claims_for`'s derived hat is a fixture that changes silently.** It mints `active_role` only
   when the principal holds exactly **one** live role; `orgadmin.b@test.local` already holds two,
   so `claims_for('…b2', false)` mints **no hat**. Every persona in `387` now passes its hat
   explicitly. ⚠ Not specific to AE1.5 — any suite deriving a hat inherits this.

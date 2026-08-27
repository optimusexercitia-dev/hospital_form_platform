# AE0.2 — `EXPLAIN (ANALYZE, BUFFERS)` baselines for the authorization hot paths

**Task:** AE0.2 of phase AE0, [docs/plans/authz-evolution.md](../plans/authz-evolution.md).
**Authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md).
**Measured:** 2026-08-26 · **Author:** `backend` · **Branch:** `authz-ae0-baseline`.

| | |
| --- | --- |
| Stack | local Supabase (Docker), container `supabase_db_azkbbhskturikxpgmafq` |
| PostgreSQL | 17.6 |
| Migration head | `20261003004300` |
| Migrations registered | 475 (= file count; verified) |
| Seed state | fresh `supabase db reset --local`, no E2E, no pgTAP run against it |
| Harness | [`scripts/authz-explain-baselines-ae0.sql`](../../scripts/authz-explain-baselines-ae0.sql) |

**Reproduce, exactly:**

```bash
# From the repo root, on a FRESH `supabase db reset --local` and a quiet stack.
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -f - \
  < scripts/authz-explain-baselines-ae0.sql

# Optional Pass B — nested body plans for the shape-opaque DEFINER doors:
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -v NESTED=1 -f - \
  < scripts/authz-explain-baselines-ae0.sql
```

---

## ⚠ What these baselines are, and what they are not

**They detect PLAN-SHAPE REGRESSIONS — index scan degrading to seq scan, an InitPlan
(evaluated once) becoming a per-row invocation, a hoisted predicate un-hoisting. They are
NOT production latency figures.** Every number here comes from local, seed-sized data:
8 cases, 3 meetings, 36 profiles, 43 memberships, 6 commissions, 35 organization
affiliations. A sequential scan is the *correct* plan at 8 rows and the wrong one at
8 000, so where a plan below shows a seq scan that would be an index scan at scale, the
row says so explicitly rather than presenting it as a clean baseline.

**⛔ A second reproducibility bound, measured, that bites harder than the row counts:
this database has no planner statistics.**

```
relname                    reltuples   last_analyze   last_autoanalyze
cases                             -1   (null)         (null)
commissions                       -1   (null)         (null)
meetings                          -1   (null)         (null)
hospital_affiliations             -1   (null)         (null)
organization_affiliations         -1   (null)         (null)
memberships                       43   (null)         (null)   -- reltuples from autovacuum only
profiles                          36   (null)         (null)   -- reltuples from autovacuum only
```

`reltuples = -1` means "never analyzed". Every cost estimate below is therefore a
default-estimate guess, and the estimates are wildly off the actuals — `rows=72` on an
8-row `cases`, `rows=384` on a 6-row `commissions`, `rows=373` on a 43-row `memberships`.
Consequences that bind on any later comparison:

1. **Compare only against a run taken under the same never-`ANALYZE`d condition.** ⛔ Do not
   `ANALYZE` before re-running — it would change the plans and, worse, change them for
   every other session sharing this stack.
2. `memberships` and `profiles` picked up `reltuples` from an **autovacuum** that fired
   after the reset. Autovacuum timing is not deterministic, so a re-run may plan those two
   tables slightly differently through no change of yours. Treat a diff confined to those
   two tables' cost estimates as noise until shown otherwise.
3. **Production will have real statistics and may legitimately choose different shapes.**
   These plans are the local floor for detecting *our* regressions, not a prediction of
   production. AE7's entry condition 2 explicitly requires `EXPLAIN (ANALYZE, BUFFERS)` on
   **real data**; this file is the comparison floor it is measured against, not a substitute.

---

## 1. Path inventory — all seven named paths accounted for

The plan names: *session-context RPC; case list (`cases` under `_case_caps`); meeting list;
commission dashboard aggregates; person roster (`listOrgUsers` / `listHospitalUsers`
predicates); one grant + one revoke door.*

| # | Named path | Status | Statement measured |
| --- | --- | --- | --- |
| **P1** | session-context RPC | **BASELINED** | `select public.session_context()` |
| **P2a** | case list — `cases` under `_case_caps`, **member** arm | **BASELINED** | `select * from public.cases` |
| **P2b** | case list — `cases` under `_case_caps`, **coordinator** arm | **BASELINED** | `select * from public.cases` |
| **P2c** | case list — the product surface | **BASELINED** | `select * from public.list_cases_board('<CCIH>', 200)` |
| **P3** | meeting list | **BASELINED** | `meetings` keyset first page, `MEETING_LIST_COLUMNS`, `limit 26` |
| **P4a** | commission dashboard aggregates — form picker | **BASELINED** | `select * from public.dashboard_form_totals('<CCIH>', null, null)` |
| **P4b** | commission dashboard aggregates — largest of the seven form RPCs | **BASELINED** | `select * from public.dashboard_distributions('<form>', null, null)` |
| **P4c** | *org* panel overview (adjacent, labelled separately — see below) | **BASELINED** | `select * from public.commission_overview()` |
| **P5a** | person roster — `listOrgUsers` predicates | **BASELINED** | 3 statements: affiliation scope read · profiles page read · `countByStatus` head-count |
| **P5b** | person roster — `listHospitalUsers` predicates | **BASELINED** | 4 statements: commissions · hospital affiliations · memberships · profiles page read |
| **P6** | grant door | **BASELINED** | `select public.grant_role('commission','<CCIH>','staff','<staff1.farm>')` |
| **P7** | revoke door | **BASELINED** | `select public.revoke_role('commission','<CCIH>','staff','<staff3.ccih>')` |

**Nothing is NOT BASELINED.** Two labelling notes, so no later reader mistakes a neighbour
for the named path:

- **P4c is not "the commission dashboard".** `commission_overview()` is org-admin-scoped
  (its body filters `memberships … role = 'org_admin' and m.role is not distinct from
  app.active_role()`) and backs `/o/[org]/manage/painel`, not
  `/o/[org]/c/[commission]/dashboard`. It is recorded under its own row and its own
  principal. The commission dashboard is P4a + P4b.
- **P5a/P5b do not call `list_org_people`.** ADR 0154 deliberately kept the roster off that
  RPC (it emits a `person.cpf_lookup` audit row per call). `listOrgUsers` /
  `listHospitalUsers` are two-step reads: resolve an id scope from the affiliation /
  membership tables, then read `profiles` with `.in('id', …)`. Both steps are baselined,
  because the RLS cost lives in step 2 and the scope predicate lives in step 1.
  `public.list_org_people` is a different surface (the add-a-person CPF search) and is **not**
  baselined here — recording it under the roster label would have been the mislabelling the
  task forbids.

---

## 2. Principals — one per path, named

⛔ **No seeded persona holds a membership or affiliation outside its home org; there is no
cross-org persona.** Nothing below claims one. `orgadmin.b` is used only as a
*different-org* control arm (§3), never as a "cross-org actor".

| Path | Principal | uuid | `active_role` claim | Why this one |
| --- | --- | --- | --- | --- |
| P1 | `multi@test.local` | `…0008` | `staff` | Richest grants payload in the seed — staff of **two** commissions, both Rede A. The RPC is hat-blind by design (ADR 0106 D9), so the hat does not gate it; it is set because `claims_for` would resolve it. |
| P2a | `staff1.ccih@test.local` | `…0003` | `staff` | The arm that actually pays `app.can_read_case` per row. |
| P2b | `chefe.ccih@test.local` | `…0002` | `staff_admin` | The coordinator arm, which short-circuits on the permissive sibling policy. |
| P2c | `chefe.ccih@test.local` | `…0002` | `staff_admin` | The board's real caller. |
| P3 | `chefe.ccih@test.local` | `…0002` | `staff_admin` | Commission with the only Rede-A meeting. |
| P4a, P4b | `chefe.ccih@test.local` | `…0002` | `staff_admin` | The dashboard authority arm (`app.is_staff_admin_of`). |
| P4c | `orgadmin.a@test.local` | `…00b1` | `org_admin` | The only role the function's own predicate admits. |
| P5a | `orgadmin.a@test.local` | `…00b1` | `org_admin` | `listOrgUsers`' caller. |
| P5b | `hospitaladmin.a1@test.local` | `…00e1` | `hospital_admin` | `listHospitalUsers`' caller; also the principal whose `profiles` filter falls through — see finding F2. |
| P6, P7 | `chefe.ccih@test.local` (actor) | `…0002` | `staff_admin` | Holds `is_staff_admin_of_for` over CCIH, so both doors take their authorised arm rather than raising 42501. |

**Grant/revoke targets.** P6 grants `staff` in CCIH to `staff1.farm@test.local` (`…0006`) —
a Rede A person who holds **no** CCIH membership, so all three reps take
`grant_role_impl`'s INSERT arm rather than its `ON CONFLICT DO UPDATE` arm. P7 revokes
`staff3.ccih@test.local` (`…0009`).

**How the session context is established.** The pgTAP suites use
`test_helpers.claims_for(uuid, boolean, text)` + `set local role authenticated`
(`supabase/tests/00_setup.sql:392-428`). That schema is created by `00_setup.sql` when
`pg_prove` runs and **does not exist on a bare `db reset`** — creating it would leave a
committed schema behind. The harness therefore inlines the payload `claims_for` mints, key
for key:

```json
{"sub": "<uuid>", "role": "authenticated", "is_admin": false, "active_role": "<role>"}
```

`active_role` is load-bearing, not decoration: `app.has_role` / `app.has_role_any` end in
`and (p_user_id is distinct from auth.uid() or m.role is not distinct from
app.active_role())`, so for a self-query every `app.is_*_of()` returns FALSE without it.
§3 proves this empirically rather than asserting it.

---

## 3. Positive control — the session context IS being applied

Recorded by the harness before any baseline runs; it raises and aborts if fewer than four
of the five arms give distinct readings.

```
                     arm                     | cases | meetings | profiles | memberships | is_member_ccih
---------------------------------------------+-------+----------+----------+-------------+----------------
 1a chefe.ccih / hat=staff_admin (INTENDED)  |     6 |        1 |       10 |          10 | t
 1b orgadmin.b / hat=org_admin (FOREIGN ORG) |     1 |        0 |        5 |           7 | f
 1c chefe.ccih / NO active_role claim        |     2 |        0 |        1 |           1 | f
 1d authenticated / NO claims                |     0 |        0 |        0 |           0 | f
 1e postgres / RLS BYPASSED (the trap)       |     8 |        3 |       36 |          43 | (null)
```

**Verdict: 5 distinct readings across 5 arms — control PASSES.** Read it arm by arm:

- **1a vs 1b** — the intended principal and a principal that must see (almost) nothing of
  Rede A differ on every column. Rede B's admin sees 1 case and 0 meetings: her own
  tenant's, not CCIH's. Row-level isolation is live.
- **1c is the sharp one.** Same `sub`, same role, `active_role` key removed: cases
  6 → 2, meetings 1 → 0, profiles 10 → 1, `app.is_member_of(CCIH)` t → f. The GUC is
  reaching `app.active_role()` and the hat condition is doing real work. Had 1c equalled
  1a, the claims would not have been applied and every plan below would be a plan of a
  query nobody runs. (The 2 residual cases are reached by a non-membership arm of
  `app.can_read_case` — participation/grant — which is exactly why the hat control needs a
  *second* control beside it.)
- **1d** — authenticated, no claims: everything zero. Fail-closed confirmed.
- **1e is the trap, made visible.** `postgres` bypasses RLS: 8 / 3 / 36 / 43. Those are the
  numbers a naive baseline would have recorded, and **not one of them matches any real
  principal's**. Every plan in this file was taken under an arm that is not 1e.

---

## 4. Method

**Instrument.** Explicit `EXPLAIN (ANALYZE, BUFFERS)`, three repetitions per statement, in a
fixed order, all reps of a read-only path inside one transaction (so rep 1 is cold and reps
2–3 warm) and each rep of a mutating door in **its own** transaction (so all three start
from an identical state — a shared transaction would make rep 1 an INSERT and reps 2–3 an
`ON CONFLICT DO UPDATE`, i.e. three reps of three different statements).

**Shape-opaque paths, stated rather than worked around.** A `SECURITY DEFINER` function is
never inlined, so `EXPLAIN` of a call to one yields a bare `Result` / `Function Scan` node.
Its execution time, row count and **accumulated** buffers are real (nested SPI buffer usage
does roll up into the calling node), but the body's plan shape is invisible. That affects
**P1, P2c, P4a, P4b, P4c, P6, P7**. Their rows below carry the top-level plan verbatim, and
the harness's Pass B (`-v NESTED=1`, `auto_explain` with `log_nested_statements = on`)
re-runs the *same statement* to print the body plans — the same statement instrumented
deeper, never a substituted query. Pass B is opt-in because for a per-row predicate it
explodes: `list_cases_board` emits ~4 200 nested log lines and a plain `select * from
public.cases` ~5 400. **P2c is therefore shape-opaque in practice**, and that is recorded as
a limit, not papered over.

**Rep-to-rep shape comparison.** All three reps are reported. The canonical plan recorded in
§6 is **rep 3** (warm, steady state); rep 1 additionally carries a `Planning: Buffers:` line
that disappears once the catalog is warm, which is a caching artefact and not a plan-shape
change. Shape agreement was verified mechanically by normalising each plan (drop the
`Planning:` block and `Query Identifier:`; replace every `(cost=…)`, `(actual…)`,
`Buffers:`, `Planning Time:`, `Execution Time:`, `Sort Method:`, `Heap Blocks:`,
`Buckets:`, `Memory Usage:`, and every `rows=N` / `loops=N`) and byte-comparing reps.

> **Result: every one of the 17 measured statements is SHAPE-IDENTICAL across all three
> reps. No path's rep 1 differs in shape from reps 2–3.** Only timing and cold-cache buffer
> counts move.

**The comparator was proven able to fail**, because a detector that finds nothing has to be
shown capable of finding something:

| Control | Expected | Observed |
| --- | --- | --- |
| `Seq Scan on cases` vs `Index Scan using cases_pkey on cases`, identical numbers | must read **DIFFERS** | DIFFERS ✅ |
| Same node, different cost / actual-time / buffer numbers | must read **IDENTICAL** | IDENTICAL ✅ |

Without the first control an all-IDENTICAL verdict would be indistinguishable from a
normaliser that erases everything; without the second it would be indistinguishable from a
comparator that fires on pure timing noise.

**Reproducibility, checked rather than assumed.** The whole file is worth nothing if a
second run of the same harness on the same database produces different plans. Pass A was
run **twice**, end to end, on this stack: both runs exited 0, both passed the positive
control at 5/5 distinct arms, both passed the unmutated-census assertion, and **the two runs
agree on all 17 shape verdicts**. Timings and cold-cache buffer counts move between runs, as
expected; §5 records run 1.

---

## 5. Measurements — all three repetitions

`buffers` = shared hits at the top plan node. Rep 1 is cold; the drop from rep 1 to rep 2 is
catalog/plan-cache warming, not a shape change.

| Path | rows | rep 1 exec / buffers | rep 2 exec / buffers | rep 3 exec / buffers | shape across reps |
| --- | ---: | --- | --- | --- | --- |
| P1 `session_context()` | 1 | 1.262 ms / 175 | 1.055 ms / 12 | 0.991 ms / 12 | IDENTICAL |
| P2a `cases`, member | 2 of 8 | 12.033 ms / 384 | 11.102 ms / 383 | 10.277 ms / 383 | IDENTICAL |
| P2b `cases`, coordinator | 6 of 8 | 5.758 ms / 153 | 5.342 ms / 152 | 5.882 ms / 152 | IDENTICAL |
| P2c `list_cases_board` | 6 | 9.585 ms / 716 | 7.991 ms / 325 | 7.837 ms / 325 | IDENTICAL |
| P3 meetings first page | 1 | 0.689 ms / 12 | 0.510 ms / 12 | 0.481 ms / 12 | IDENTICAL |
| P4a `dashboard_form_totals` | 1 | 1.782 ms / 399 | 0.621 ms / 84 | 0.546 ms / 84 | IDENTICAL |
| P4b `dashboard_distributions` | 10 | 4.134 ms / 1245 | 1.970 ms / 235 | 1.918 ms / 235 | IDENTICAL |
| P4c `commission_overview` | 4 | 0.994 ms / 68 | 0.177 ms / 44 | 0.200 ms / 44 | IDENTICAL |
| P5a (i) affiliation scope | 29 | 3.823 ms / 114 | 4.121 ms / 114 | 4.228 ms / 114 | IDENTICAL |
| P5a (ii) profiles page | 20 | 4.298 ms / 135 | 4.424 ms / 135 | 3.886 ms / 135 | IDENTICAL |
| P5a (iii) status head-count | 1 (26 scanned) | 3.731 ms / 111 | 4.481 ms / 111 | 3.438 ms / 111 | IDENTICAL |
| P5b (i) commissions of hospital | 2 | 1.511 ms / 24 | 1.100 ms / 24 | 1.050 ms / 24 | IDENTICAL |
| P5b (ii) hospital affiliations | 3 | 0.705 ms / 16 | 0.730 ms / 16 | 0.629 ms / 16 | IDENTICAL |
| P5b (iii) memberships of those commissions | 14 | 6.458 ms / 210 | 6.945 ms / 210 | 6.396 ms / 210 | IDENTICAL |
| P5b (iv) profiles page | 15 | 17.162 ms / 533 | 15.687 ms / 533 | 16.549 ms / 533 | IDENTICAL |
| P6 `grant_role` | 1 | 3.765 ms / 435 | 1.272 ms / 69 | 1.046 ms / 68 | IDENTICAL |
| P7 `revoke_role` | 1 | 1.179 ms / 53 | 0.851 ms / 42 | 0.928 ms / 42 | IDENTICAL |

---

## 6. Findings — plan shapes that already look wrong today (AE1.5 input)

These are observations from the baseline, not defects filed. Each names what it is and what
would change it.

### F1 — `cases` is a Seq Scan with a per-row authorization call. **SEQ-SCAN-AT-SEED-SIZE.**

```
Seq Scan on cases  (cost=0.07..124.06 rows=72 width=485) (actual … rows=2 loops=1)
  Filter: ((app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(id, (InitPlan 1).col1)))
           OR app.can_read_case(id, (InitPlan 2).col1))
```

At 8 rows a seq scan is right; the shape fact is that **the authorization predicate is
evaluated per surviving row and there is no index-usable term at all** — the filter is
entirely function calls, so no plan at any table size can avoid a full scan. The two
`InitPlan` nodes are the hoisted `(select auth.uid())`, which is correct and is exactly the
hoisting AE1.5 wants to preserve. The member arm costs **2.3× the coordinator arm** (10.3 ms
vs 5.9 ms) while returning **fewer** rows, because `cases_staff_admin_write` (a `FOR ALL`
PERMISSIVE sibling) short-circuits the coordinator before `app.can_read_case` →
`app._case_caps` is ever reached — visible in the plan as `InitPlan 1 → never executed` for
the member and executed for the coordinator. ⚠ Any later comparison must compare **member
against member**; a coordinator-only baseline measures a different query.

### F2 — `profiles` carries an 11-arm OR filter built from **two permissive policies whose arms are duplicated verbatim**, and for a `hospital_admin` the correlated SubPlans **execute per row**.

`profiles` has two permissive SELECT policies (`profiles_admin_select` and
`profiles_select_self_or_admin`); Postgres ORs them, and the resulting filter contains the
same work twice:

```
Filter: ((id = (InitPlan 1).col1)
      OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))   -- arm A
      OR EXISTS(SubPlan 3)                                                                    -- tenancy-admin-of-commission
      OR (app.is_active((InitPlan 6).col1) AND EXISTS(SubPlan 8))
      OR EXISTS(SubPlan 16)                                                                   -- hospital_admin via affiliation
      OR EXISTS(SubPlan 24)                                                                   -- hospital_admin via membership
      OR app.is_admin()
      OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))   -- arm A AGAIN
      OR EXISTS(SubPlan 28)                                                                   -- = SubPlan 3
      OR EXISTS(SubPlan 36)                                                                   -- = SubPlan 16
      OR EXISTS(SubPlan 44))                                                                  -- = SubPlan 24
```

Five of the eleven arms are literal repeats. For **`orgadmin.a`** this is free: arm A matches
first and every SubPlan reads `never executed` (3.9 ms / 135 buffers, 20 rows). For
**`hospitaladmin.a1`** arm A misses and the plan falls through:

```
SubPlan 3
  ->  Nested Loop  (cost=4.34..34.54 rows=1 width=0) (actual time=1.005..1.005 rows=1 loops=14)
        ->  Bitmap Heap Scan on memberships cm  … (actual time=0.394..0.394 rows=1 loops=14)
        ->  Index Scan using commissions_pkey on commissions c … (actual time=0.657..0.657 rows=1 loops=13)
```

`loops=14` / `loops=13` is the **per-row invocation pattern** these baselines exist to
watch, and it is live today: **16.5 ms / 533 buffers for 15 rows vs 3.9 ms / 135 buffers for
20 rows** — the hospital-admin roster costs ~4× the org-admin roster for fewer people, and
the cost is in the fall-through, not in the data. Nothing here is a correctness problem; it
is the measured case for AE1.5's permissive-policy consolidation, and it is also the
strongest reason to re-run this baseline after any `profiles` policy edit.
⚠ AE1.5 rule 2 still applies: permissive policies OR together, so a merge is
semantics-preserving **only** if the merged predicate is the exact disjunction.

### F3 — the nested SubPlans plan against `Seq Scan on commissions (rows=384)` and `Seq Scan on memberships (rows=373)`

Inside `profiles`' un-taken arms the planner chose sequential scans sized by *default
estimates* on tables that hold 6 and 43 rows. Those nodes read `never executed` for the
org-admin principal, so they cost nothing today — but they are the shape that would execute
the moment an arm is reordered or a principal falls through, and their estimates are
fiction because nothing has ever `ANALYZE`d these tables (see the header caveat).
**Do not read "never executed" as "cheap"; read it as "not exercised by this principal".**

### F4 — `commissions` is filtered by a **nine-term OR of function calls, two of them duplicated**, on every read

```
Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id)
      OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id)
      OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text))
      OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
```

`app.is_org_admin_of` and `app.is_hospital_admin_of` each appear **twice** — again two
permissive policies ORed. It shows up in P5b (i) as 1.05 ms to return 2 rows from a 6-row
table, and again nested inside P5b (iii)'s `loops=2`. Same class as F2, different table.

### F5 — the doors are cheap; the roster is not

`grant_role` (1.05 ms / 68 buffers) and `revoke_role` (0.93 ms / 42) are the least expensive
paths measured, despite being the ones that write. The expensive paths are all **reads
through multi-arm permissive policies**: P5b (iv) 16.5 ms, P2a 10.3 ms, P2c 7.8 ms,
P5b (iii) 6.4 ms. If AE4's resolver substitution is going to cost anything, it will be
visible in those four rows first.

### F6 — `session_context()` is already index-backed and hoisted

Pass B shows the body using `Bitmap Index Scan on memberships_principal_idx` under a
`CTE me` that evaluates `auth.uid()` once. 12 buffers warm. **This is the shape to preserve**;
an AE4 resolver that turns this into a per-grant lookup would be visible immediately as a
buffer-count jump on P1.

---

## 7. Stack unmutated — before / after evidence

`EXPLAIN ANALYZE` executes the statement, so P6 and P7 performed real `memberships` writes
plus `audit_log` rows. Each rep ran in its own transaction and each was rolled back. The
harness proves the writes **landed** before trusting the baseline — a door that silently
no-opped would `EXPLAIN` just as cheaply and the baseline would be of nothing:

```
 P6 landed (expect 1) | 1      -- staff1.farm gained the CCIH membership inside the txn
 P7 landed (expect 0) | 0      -- staff3.ccih lost the CCIH membership inside the txn
```

Census taken by the harness before section 1 and again after section 9, in the same run:

```
             t             | before | after | unchanged
---------------------------+--------+-------+-----------
 audit_log                 |    264 |   264 | t
 cases                     |      8 |     8 | t
 commissions               |      6 |     6 | t
 hospital_affiliations     |      5 |     5 | t
 meetings                  |      3 |     3 | t
 memberships               |     43 |    43 | t
 organization_affiliations |     35 |    35 | t
 profiles                  |     36 |    36 | t
 responses                 |     13 |    13 | t
 schema_migrations         |    475 |   475 | t

NOTICE:  AE0.2 stack unmutated: all 10 census rows identical before and after
```

The harness `raise exception`s on any mismatch, so a green run is a positive assertion, not
an absence of complaint. Both passes (A and B) exited 0 with that notice.

**Residual, stated:** a rolled-back insert still consumes sequence values, and `EXPLAIN
ANALYZE` still touches the buffer cache and can trigger autovacuum. Neither changes a row,
and the census covers rows. No `ANALYZE`, no `db reset`, no dev server and no E2E were run.

---

## 8. The plans, verbatim

Rep 3 (warm, steady state) is the canonical plan for each path; §5 carries all three reps'
measurements and §4 records that every path is shape-identical across reps. `<CCIH>` =
`a0000000-0000-0000-0000-0000000000a1`, `<HOSP_A1>` =
`05000000-0000-0000-0000-00000000000a`, `<ORG_A>` = `0c000000-0000-0000-0000-00000000000a`,
`<form>` = `f0000000-0000-0000-0000-00000000a001`.

> psql's `QUERY PLAN` column header and its underline rule are omitted (they carry no
> information and are 200+ characters wide). **Every plan line below is otherwise
> byte-verbatim from the harness output**, including the trailing `(N rows)` count — a
> summarised plan cannot detect an InitPlan → per-row regression, which is the whole point
> of this file.

### P1 — `select public.session_context()` · principal `multi@test.local`, hat `staff`

*Shape-opaque: `session_context` is `SECURITY DEFINER` and is not inlined. Body plan below.*

```
 Result  (cost=0.00..0.26 rows=1 width=32) (actual time=0.979..0.979 rows=1 loops=1)
   Output: session_context()
   Buffers: shared hit=12
 Query Identifier: -2209405159310249166
 Planning Time: 0.009 ms
 Execution Time: 0.991 ms
(6 rows)
```

**Body (Pass B, `auto_explain` nested):**

`auto_explain` prints `log_timing = off`, so body nodes carry `(actual rows=…)` without
per-node times; the statement's own duration is in the `LOG: duration:` line (0.991 ms).

```
Result  (cost=13.95..13.97 rows=1 width=32) (actual rows=1 loops=1)
  Buffers: shared hit=12
  CTE me
    ->  Result  (cost=0.03..0.04 rows=1 width=16) (actual rows=1 loops=1)
          InitPlan 1
            ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual rows=1 loops=1)
  InitPlan 3
    ->  Hash Join  (cost=0.03..2.54 rows=1 width=32) (actual rows=1 loops=1)
          Hash Cond: (p.id = me.uid)
          Buffers: shared hit=2
          ->  Seq Scan on profiles p  (cost=0.00..2.36 rows=36 width=51) (actual rows=36 loops=1)
                Buffers: shared hit=2
          ->  Hash  (cost=0.02..0.02 rows=1 width=16) (actual rows=1 loops=1)
                Buckets: 1024  Batches: 1  Memory Usage: 9kB
                ->  CTE Scan on me  (cost=0.00..0.02 rows=1 width=16) (actual rows=1 loops=1)
  InitPlan 4
    ->  Aggregate  (cost=11.36..11.37 rows=1 width=32) (actual rows=1 loops=1)
          Buffers: shared hit=10
          ->  Sort  (cost=11.34..11.34 rows=1 width=384) (actual rows=2 loops=1)
                Sort Key: m.role, (COALESCE(c.name, h.name, o.name)), m.id
                Sort Method: quicksort  Memory: 25kB
                Buffers: shared hit=10
                ->  Nested Loop Left Join  (cost=4.76..11.33 rows=1 width=384) (actual rows=2 loops=1)
                      Buffers: shared hit=10
                      ->  Nested Loop Left Join  (cost=4.61..11.04 rows=1 width=320) (actual rows=2 loops=1)
                            Buffers: shared hit=6
                            ->  Nested Loop Left Join  (cost=4.46..10.54 rows=1 width=240) (actual rows=2 loops=1)
                                  Buffers: shared hit=2
                                  ->  Nested Loop Left Join  (cost=4.31..10.04 rows=1 width=160) (actual rows=2 loops=1)
                                        Buffers: shared hit=2
                                        ->  Nested Loop  (cost=4.16..9.54 rows=1 width=96) (actual rows=2 loops=1)
                                              Buffers: shared hit=2
                                              ->  CTE Scan on me me_1  (cost=0.00..0.02 rows=1 width=16) (actual rows=1 loops=1)
                                              ->  Bitmap Heap Scan on memberships m  (cost=4.16..9.51 rows=1 width=112) (actual rows=2 loops=1)
                                                    Recheck Cond: (me_1.uid = principal_id)
                                                    Filter: ((expires_at IS NULL) OR (expires_at > now()))
                                                    Heap Blocks: exact=1
                                                    Buffers: shared hit=2
                                                    ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (actual rows=2 loops=1)
                                                          Index Cond: (principal_id = me_1.uid)
                                                          Buffers: shared hit=1
                                        ->  Index Scan using organizations_pkey on organizations o  (cost=0.15..0.50 rows=1 width=80) (actual rows=0 loops=2)
                                              Index Cond: (id = m.organization_id)
                                  ->  Index Scan using hospitals_id_org_uq on hospitals h  (cost=0.15..0.50 rows=1 width=96) (actual rows=0 loops=2)
                                        Index Cond: (id = m.hospital_id)
                            ->  Index Scan using commissions_pkey on commissions c  (cost=0.15..0.50 rows=1 width=96) (actual rows=1 loops=2)
                                  Index Cond: (id = m.commission_id)
                                  Buffers: shared hit=4
                      ->  Index Scan using organizations_pkey on organizations co  (cost=0.15..0.29 rows=1 width=80) (actual rows=1 loops=2)
                            Index Cond: (id = c.organization_id)
                            Buffers: shared hit=4
```

`actual rows=2` from `memberships` is `multi@test.local`'s two commission grants, so the
plan demonstrably ran under the named principal. **Note the door is hat-blind by
construction** — no `app.active_role()` term appears anywhere in the body — which is ADR
0106 D9's deliberate design (the role picker needs the hats there are to switch *to*), not
an omission to "fix".

### P2a — `select * from public.cases` · principal `staff1.ccih`, hat `staff` (MEMBER arm)

```
 Seq Scan on cases  (cost=0.07..124.06 rows=72 width=485) (actual time=1.714..10.258 rows=2 loops=1)
   Filter: ((app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(id, (InitPlan 1).col1))) OR app.can_read_case(id, (InitPlan 2).col1))
   Rows Removed by Filter: 6
   Buffers: shared hit=383
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
   InitPlan 2
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.003..0.003 rows=1 loops=1)
 Planning Time: 0.097 ms
 Execution Time: 10.277 ms
(10 rows)
```

### P2b — `select * from public.cases` · principal `chefe.ccih`, hat `staff_admin` (COORDINATOR arm)

```
 Seq Scan on cases  (cost=0.07..124.06 rows=72 width=485) (actual time=0.542..5.864 rows=6 loops=1)
   Filter: ((app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(id, (InitPlan 1).col1))) OR app.can_read_case(id, (InitPlan 2).col1))
   Rows Removed by Filter: 2
   Buffers: shared hit=152
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.002..0.002 rows=1 loops=1)
   InitPlan 2
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.002..0.002 rows=1 loops=1)
 Planning Time: 0.080 ms
 Execution Time: 5.882 ms
(10 rows)
```

### P2c — `select * from public.list_cases_board('<CCIH>', 200)` · principal `chefe.ccih`, hat `staff_admin`

*Shape-opaque, and **Pass B is impractical here** (~4 200 nested log lines from the per-row
resolver). Recorded on cost, not shape: a jump in `Buffers` or `Execution Time` on this row
is the available signal.*

```
 Function Scan on list_cases_board  (cost=0.25..10.25 rows=1000 width=184) (actual time=7.826..7.827 rows=6 loops=1)
   Buffers: shared hit=325
 Planning Time: 0.013 ms
 Execution Time: 7.837 ms
(4 rows)
```

### P3 — meetings first page · principal `chefe.ccih`, hat `staff_admin`

```
 Limit  (cost=0.29..26.10 rows=1 width=325) (actual time=0.452..0.454 rows=1 loops=1)
   Buffers: shared hit=12
   ->  Nested Loop Left Join  (cost=0.29..26.10 rows=1 width=325) (actual time=0.452..0.453 rows=1 loops=1)
         Buffers: shared hit=12
         ->  Index Scan using meetings_commission_scheduled_keyset_idx on meetings m  (cost=0.14..16.89 rows=1 width=261) (actual time=0.254..0.255 rows=1 loops=1)
               Index Cond: (commission_id = 'a0000000-0000-0000-0000-0000000000a1'::uuid)
               Filter: (app.is_member_of(commission_id) AND ((visibility_policy = 'commission_default'::text) OR (ANY (id = (hashed SubPlan 6).col1))))
               Buffers: shared hit=6
               SubPlan 6
                 ->  Bitmap Heap Scan on meeting_attendees a  (cost=4.23..10.07 rows=1 width=16) (never executed)
                       Recheck Cond: (user_id = (InitPlan 4).col1)
                       Filter: app.can_reach_meeting(meeting_id, (InitPlan 5).col1)
                       InitPlan 4
                         ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                       InitPlan 5
                         ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                       ->  Bitmap Index Scan on meeting_attendees_user_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                             Index Cond: (user_id = (InitPlan 4).col1)
         ->  Index Scan using commission_meeting_types_pkey on commission_meeting_types mt  (cost=0.15..9.17 rows=1 width=80) (actual time=0.196..0.197 rows=1 loops=1)
               Index Cond: (id = m.meeting_type_id)
               Filter: (app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id) OR app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))
               Buffers: shared hit=6
 Planning Time: 0.222 ms
 Execution Time: 0.481 ms
(24 rows)
```

**This is the healthiest plan in the set** and the one to protect: the keyset index
`meetings_commission_scheduled_keyset_idx` is used, the attendee `SubPlan` is *hashed* (not
per-row) and never executed under the default `commission_default` visibility, and both
`auth.uid()` reads are hoisted into InitPlans. ⚠ Note `app.is_tenancy_admin_of` appears
**twice** in the `commission_meeting_types` filter — the F4 duplicate-arm class again, on a
third table.

### P4a — `dashboard_form_totals('<CCIH>', null, null)` · principal `chefe.ccih`, hat `staff_admin`

*Shape-opaque.*

```
 Function Scan on dashboard_form_totals  (cost=0.25..10.25 rows=1000 width=64) (actual time=0.539..0.540 rows=1 loops=1)
   Buffers: shared hit=84
 Planning Time: 0.009 ms
 Execution Time: 0.546 ms
(4 rows)
```

### P4b — `dashboard_distributions('<form>', null, null)` · principal `chefe.ccih`, hat `staff_admin`

*Shape-opaque. The heaviest cold read in the set (1 245 buffers on rep 1), because the body
fans out over `app.submitted_form_responses`.*

```
 Function Scan on dashboard_distributions  (cost=0.25..10.25 rows=1000 width=224) (actual time=1.909..1.909 rows=10 loops=1)
   Buffers: shared hit=235
 Planning Time: 0.012 ms
 Execution Time: 1.918 ms
(4 rows)
```

### P4c — `commission_overview()` · principal `orgadmin.a`, hat `org_admin` (ORG panel, **not** the commission dashboard)

*Shape-opaque.*

```
 Function Scan on commission_overview  (cost=0.25..10.25 rows=1000 width=104) (actual time=0.192..0.192 rows=4 loops=1)
   Buffers: shared hit=44
 Planning Time: 0.011 ms
 Execution Time: 0.200 ms
(4 rows)
```

### P5a — `listOrgUsers` · principal `orgadmin.a`, hat `org_admin`

#### step (i) — the `organization_affiliations` id-scope read

```
 Index Scan using organization_affiliations_org_active_idx on organization_affiliations  (cost=0.18..8.45 rows=1 width=20) (actual time=0.265..4.213 rows=29 loops=1)
   Index Cond: (organization_id = '0c000000-0000-0000-0000-00000000000a'::uuid)
   Filter: ((principal_id = (InitPlan 1).col1) OR app.is_org_admin_of(organization_id))
   Buffers: shared hit=114
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.005..0.006 rows=1 loops=1)
 Planning Time: 0.068 ms
 Execution Time: 4.228 ms
(8 rows)
```

Index-backed, two-arm filter, `auth.uid()` hoisted. Healthy; protect this shape.

#### step (ii) — the `profiles` page read (`= ANY (array)`, `order by full_name`, `limit 20`)

The id array is the 29 ids step (i) returned, materialised by the harness with `\gset` so
the statement carries the same `= ANY (array literal)` shape PostgREST sends while the file
stays reset-stable.

```
 Limit  (cost=7003.37..7003.42 rows=20 width=143) (actual time=3.711..3.727 rows=20 loops=1)
   Buffers: shared hit=135
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.006..0.007 rows=1 loops=1)
   InitPlan 6
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
   ->  Sort  (cost=7003.31..7003.38 rows=29 width=143) (actual time=3.710..3.725 rows=20 loops=1)
         Sort Key: pr.full_name
         Sort Method: quicksort  Memory: 29kB
         Buffers: shared hit=135
         ->  Nested Loop Left Join  (cost=0.29..7002.60 rows=29 width=143) (actual time=0.264..3.698 rows=29 loops=1)
               Buffers: shared hit=135
               ->  Index Scan using profiles_pkey on profiles pr  (cost=0.14..6949.81 rows=29 width=111) (actual time=0.262..3.675 rows=29 loops=1)
                     Index Cond: (id = ANY ('{…29 uuids…}'::uuid[]))
                     Filter: ((id = (InitPlan 1).col1) OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id)) OR (ANY (id = (hashed SubPlan 5).col1)) OR (app.is_active((InitPlan 6).col1) AND EXISTS(SubPlan 8)) OR EXISTS(SubPlan 16) OR (ANY (id = (hashed SubPlan 26).col1)) OR app.is_admin() OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id)) OR (ANY (id = (hashed SubPlan 30).col1)) OR EXISTS(SubPlan 36) OR (ANY (id = (hashed SubPlan 46).col1)))
                     Buffers: shared hit=123
                     SubPlan 5
                       ->  Nested Loop  (cost=0.18..1537.27 rows=119 width=16) (never executed)
                             InitPlan 4
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Seq Scan on commissions c  (cost=0.00..1015.00 rows=128 width=16) (never executed)
                                   Filter: ((app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id)) AND app.is_tenancy_admin_of(id))
                             ->  Index Scan using memberships_commission_idx on memberships cm  (cost=0.14..4.06 rows=2 width=32) (never executed)
                                   Index Cond: (commission_id = c.id)
                                   Filter: ((principal_id = (InitPlan 4).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                     SubPlan 8
                       ->  Bitmap Heap Scan on memberships them  (cost=4.19..13.54 rows=1 width=0) (never executed)
                             Recheck Cond: ((principal_id = pr.id) AND (commission_id IS NOT NULL))
                             Filter: (((principal_id = (InitPlan 7).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id)))) AND app.is_member_of(commission_id))
                             InitPlan 7
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Bitmap Index Scan on memberships_one_commission_role_uq  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                   Index Cond: (principal_id = pr.id)
                     SubPlan 16
                       ->  Index Scan using hospital_affiliations_principal_idx on hospital_affiliations ha  (cost=0.18..43.34 rows=1 width=0) (never executed)
                             Index Cond: (principal_id = pr.id)
                             Filter: ((voided_at IS NULL) AND ((principal_id = (InitPlan 11).col1) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR EXISTS(SubPlan 13)) AND app.is_hospital_admin_of(hospital_id))
                             InitPlan 11
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             SubPlan 13
                               ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                                     Filter: ((COALESCE(m.hospital_id, c_1.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(m.hospital_id, c_1.hospital_id)))
                                     InitPlan 12
                                       ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                                     ->  Bitmap Heap Scan on memberships m  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                           Recheck Cond: (principal_id = ha.principal_id)
                                           Filter: ((principal_id = (InitPlan 12).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                           ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                                 Index Cond: (principal_id = ha.principal_id)
                                     ->  Index Scan using commissions_pkey on commissions c_1  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                           Index Cond: (id = m.commission_id)
                                           Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 26
                       ->  Hash Left Join  (cost=919.83..1688.95 rows=124 width=16) (never executed)
                             Hash Cond: (hm.commission_id = hc.id)
                             Filter: ((COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))
                             InitPlan 25
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Seq Scan on memberships hm  (cost=0.00..767.88 rows=373 width=48) (never executed)
                                   Filter: ((principal_id = (InitPlan 25).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                             ->  Hash  (cost=915.00..915.00 rows=384 width=32) (never executed)
                                   ->  Seq Scan on commissions hc  (cost=0.00..915.00 rows=384 width=32) (never executed)
                                         Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 30
                       ->  Nested Loop  (cost=0.18..1537.27 rows=119 width=16) (never executed)
                             InitPlan 29
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Seq Scan on commissions c_2  (cost=0.00..1015.00 rows=128 width=16) (never executed)
                                   Filter: ((app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id)) AND app.is_tenancy_admin_of(id))
                             ->  Index Scan using memberships_commission_idx on memberships cm_1  (cost=0.14..4.06 rows=2 width=32) (never executed)
                                   Index Cond: (commission_id = c_2.id)
                                   Filter: ((principal_id = (InitPlan 29).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                     SubPlan 36
                       ->  Index Scan using hospital_affiliations_principal_idx on hospital_affiliations ha_1  (cost=0.18..43.34 rows=1 width=0) (never executed)
                             Index Cond: (principal_id = pr.id)
                             Filter: ((voided_at IS NULL) AND ((principal_id = (InitPlan 31).col1) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR EXISTS(SubPlan 33)) AND app.is_hospital_admin_of(hospital_id))
                             InitPlan 31
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             SubPlan 33
                               ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                                     Filter: ((COALESCE(m_1.hospital_id, c_3.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(m_1.hospital_id, c_3.hospital_id)))
                                     InitPlan 32
                                       ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                                     ->  Bitmap Heap Scan on memberships m_1  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                           Recheck Cond: (principal_id = ha_1.principal_id)
                                           Filter: ((principal_id = (InitPlan 32).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                           ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                                 Index Cond: (principal_id = ha_1.principal_id)
                                     ->  Index Scan using commissions_pkey on commissions c_3  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                           Index Cond: (id = m_1.commission_id)
                                           Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 46
                       ->  Hash Left Join  (cost=919.83..1688.95 rows=124 width=16) (never executed)
                             Hash Cond: (hm_1.commission_id = hc_1.id)
                             Filter: ((COALESCE(hm_1.hospital_id, hc_1.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm_1.hospital_id, hc_1.hospital_id)))
                             InitPlan 45
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Seq Scan on memberships hm_1  (cost=0.00..767.88 rows=373 width=48) (never executed)
                                   Filter: ((principal_id = (InitPlan 45).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                             ->  Hash  (cost=915.00..915.00 rows=384 width=32) (never executed)
                                   ->  Seq Scan on commissions hc_1  (cost=0.00..915.00 rows=384 width=32) (never executed)
                                         Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
               ->  Index Scan using professional_categories_pkey on professional_categories pc  (cost=0.15..1.82 rows=1 width=48) (actual time=0.000..0.000 rows=0 loops=29)
                     Index Cond: (id = pr.professional_category_id)
                     Buffers: shared hit=12
 Planning Time: 1.700 ms
 Execution Time: 3.886 ms
(107 rows)
```

> The 29-element uuid array in `Index Cond` is elided as `'{…29 uuids…}'` — it is the seed's
> Rede-A affiliation set and is regenerated by the harness's own `\gset`, so no information
> is lost. That array (here and in step (iii)) is the **only content elided anywhere in this
> file**; every other character of every plan is verbatim.

**Read this against P5b step (iv).** Here every `SubPlan` is `never executed` because arm A
(`app.is_org_admin_of(home_organization_id)`) matches first. Same policy, different
principal, and the fall-through is 4× the cost — see finding F2.

#### step (iii) — `countByStatus` head-count, bucket `active` — **ABRIDGED, deliberately**

⚠ **This one entry is abridged and here is exactly why and how to un-abridge it.** Its
`Index Scan on profiles` filter is **byte-identical** to step (ii)'s (same two policies,
same eleven arms, same eight SubPlans, all `never executed` for this principal); only the
outer node and the added status predicate differ. Recording the identical 90-line subtree a
second time would add no discriminating power and would make the file harder to diff.
Regenerate it in full with:

```bash
docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -X -f - \
  < scripts/authz-explain-baselines-ae0.sql \
  | awk '/^--- P5a step \(iii\) rep 3 ---/,/^\(99 rows\)/'
```

The nodes that are *not* shared with step (ii):

```
 Aggregate  (cost=6950.09..6950.10 rows=1 width=8) (actual time=3.277..3.281 rows=1 loops=1)
   Buffers: shared hit=111
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.007..0.008 rows=1 loops=1)
   InitPlan 6
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
   ->  Index Scan using profiles_pkey on profiles pr  (cost=0.14..6949.96 rows=27 width=0) (actual time=0.269..3.276 rows=26 loops=1)
         Index Cond: (id = ANY ('{…29 uuids…}'::uuid[]))
         [ … Filter and SubPlans 5/8/16/26/30/36/46 identical to step (ii) … ]
 Planning Time: 1.673 ms
 Execution Time: 3.438 ms
(99 rows)
```

⚠ The page (`/o/[org]/manage/usuarios`) issues **three** of these head-counts per render
(buckets `active`, `attention`, `deactivated`) on top of the page read — so the roster costs
roughly 4× what a single row of §5 suggests. Only one bucket is baselined.

### P5b — `listHospitalUsers` · principal `hospitaladmin.a1`, hat `hospital_admin`

#### step (i) — commissions of the hospital

```
 Bitmap Heap Scan on commissions  (cost=4.16..14.01 rows=2 width=16) (actual time=0.663..1.037 rows=2 loops=1)
   Recheck Cond: (hospital_id = '05000000-0000-0000-0000-00000000000a'::uuid)
   Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
   Heap Blocks: exact=1
   Buffers: shared hit=24
   ->  Bitmap Index Scan on commissions_hospital_idx  (cost=0.00..4.16 rows=2 width=0) (actual time=0.002..0.002 rows=3 loops=1)
         Index Cond: (hospital_id = '05000000-0000-0000-0000-00000000000a'::uuid)
         Buffers: shared hit=1
 Planning Time: 0.030 ms
 Execution Time: 1.050 ms
(10 rows)
```

Finding F4 in situ: nine OR-terms, of which `app.is_org_admin_of` and
`app.is_hospital_admin_of` each appear **twice**.

#### step (ii) — active `hospital_affiliations` of the hospital

```
 Index Scan using hospital_affiliations_active_uq on hospital_affiliations  (cost=0.18..43.09 rows=1 width=16) (actual time=0.358..0.604 rows=3 loops=1)
   Index Cond: (hospital_id = '05000000-0000-0000-0000-00000000000a'::uuid)
   Filter: ((principal_id = (InitPlan 1).col1) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR EXISTS(SubPlan 3))
   Buffers: shared hit=16
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.004..0.004 rows=1 loops=1)
   SubPlan 3
     ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
           Filter: ((COALESCE(m.hospital_id, c.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(m.hospital_id, c.hospital_id)))
           InitPlan 2
             ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
           ->  Bitmap Heap Scan on memberships m  (cost=4.16..13.01 rows=2 width=32) (never executed)
                 Recheck Cond: (principal_id = hospital_affiliations.principal_id)
                 Filter: ((principal_id = (InitPlan 2).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                 ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                       Index Cond: (principal_id = hospital_affiliations.principal_id)
           ->  Index Scan using commissions_pkey on commissions c  (cost=0.15..10.42 rows=1 width=32) (never executed)
                 Index Cond: (id = m.commission_id)
                 Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
 Planning Time: 0.227 ms
 Execution Time: 0.629 ms
(21 rows)
```

#### step (iii) — memberships of those commissions

```
 Nested Loop  (cost=8.36..40.10 rows=2 width=16) (actual time=1.071..6.371 rows=14 loops=1)
   Buffers: shared hit=210
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.002..0.002 rows=1 loops=1)
   ->  Bitmap Heap Scan on commissions  (cost=4.16..14.01 rows=2 width=16) (actual time=0.605..0.957 rows=2 loops=1)
         Recheck Cond: (hospital_id = '05000000-0000-0000-0000-00000000000a'::uuid)
         Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
         Heap Blocks: exact=1
         Buffers: shared hit=24
         ->  Bitmap Index Scan on commissions_hospital_idx  (cost=0.00..4.16 rows=2 width=0) (actual time=0.003..0.003 rows=3 loops=1)
               Index Cond: (hospital_id = '05000000-0000-0000-0000-00000000000a'::uuid)
               Buffers: shared hit=1
   ->  Bitmap Heap Scan on memberships  (cost=4.16..13.01 rows=2 width=32) (actual time=0.412..2.704 rows=7 loops=2)
         Recheck Cond: (commission_id = commissions.id)
         Filter: ((principal_id = (InitPlan 1).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
         Heap Blocks: exact=2
         Buffers: shared hit=186
         ->  Bitmap Index Scan on memberships_commission_idx  (cost=0.00..4.16 rows=2 width=0) (actual time=0.002..0.002 rows=8 loops=2)
               Index Cond: (commission_id = commissions.id)
               Buffers: shared hit=2
 Planning Time: 0.148 ms
 Execution Time: 6.396 ms
(22 rows)
```

`loops=2` on the memberships side is the correlated inner of the nested loop — correct here
(2 commissions), but it is the node that would scale with commission count.

#### step (iv) — the `profiles` page read · **the most expensive path measured, and the per-row-invocation exemplar**

```
 Limit  (cost=3644.73..3644.77 rows=15 width=143) (actual time=16.375..16.384 rows=15 loops=1)
   Buffers: shared hit=533
   InitPlan 1
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.008..0.008 rows=1 loops=1)
   InitPlan 6
     ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.002..0.002 rows=1 loops=1)
   ->  Sort  (cost=3644.67..3644.71 rows=15 width=143) (actual time=16.375..16.381 rows=15 loops=1)
         Sort Key: pr.full_name
         Sort Method: quicksort  Memory: 27kB
         Buffers: shared hit=533
         ->  Nested Loop Left Join  (cost=0.29..3644.37 rows=15 width=143) (actual time=2.796..16.361 rows=15 loops=1)
               Buffers: shared hit=533
               ->  Index Scan using profiles_pkey on profiles pr  (cost=0.14..3597.89 rows=15 width=111) (actual time=2.793..16.341 rows=15 loops=1)
                     Index Cond: (id = ANY ('{00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003,00000000-0000-0000-0000-000000000004,00000000-0000-0000-0000-000000000005,00000000-0000-0000-0000-000000000006,00000000-0000-0000-0000-000000000007,00000000-0000-0000-0000-000000000008,00000000-0000-0000-0000-000000000009,00000000-0000-0000-0000-00000000000a,00000000-0000-0000-0000-0000000000a1,00000000-0000-0000-0000-0000000000c7,00000000-0000-0000-0000-0000000000d1,00000000-0000-0000-0000-0000000000d2,00000000-0000-0000-0000-0000000000d3,00000000-0000-0000-0000-0000000000e1}'::uuid[]))
                     Filter: ((id = (InitPlan 1).col1) OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id)) OR EXISTS(SubPlan 3) OR (app.is_active((InitPlan 6).col1) AND EXISTS(SubPlan 8)) OR EXISTS(SubPlan 16) OR EXISTS(SubPlan 24) OR app.is_admin() OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id)) OR EXISTS(SubPlan 28) OR EXISTS(SubPlan 36) OR EXISTS(SubPlan 44))
                     Buffers: shared hit=525
                     SubPlan 3
                       ->  Nested Loop  (cost=4.34..34.54 rows=1 width=0) (actual time=1.005..1.005 rows=1 loops=14)
                             Buffers: shared hit=457
                             InitPlan 2
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.004..0.004 rows=1 loops=1)
                             ->  Bitmap Heap Scan on memberships cm  (cost=4.16..13.01 rows=2 width=16) (actual time=0.394..0.394 rows=1 loops=14)
                                   Recheck Cond: ((principal_id = pr.id) AND (commission_id IS NOT NULL))
                                   Filter: ((principal_id = (InitPlan 2).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                   Heap Blocks: exact=14
                                   Buffers: shared hit=197
                                   ->  Bitmap Index Scan on memberships_one_commission_role_uq  (cost=0.00..4.16 rows=2 width=0) (actual time=0.001..0.001 rows=1 loops=14)
                                         Index Cond: (principal_id = pr.id)
                                         Buffers: shared hit=14
                             ->  Index Scan using commissions_pkey on commissions c  (cost=0.15..10.67 rows=1 width=16) (actual time=0.657..0.657 rows=1 loops=13)
                                   Index Cond: (id = cm.commission_id)
                                   Filter: ((app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id)) AND app.is_tenancy_admin_of(id))
                                   Buffers: shared hit=260
                     SubPlan 8
                       ->  Bitmap Heap Scan on memberships them  (cost=4.19..13.54 rows=1 width=0) (actual time=0.002..0.002 rows=0 loops=1)
                             Recheck Cond: ((principal_id = pr.id) AND (commission_id IS NOT NULL))
                             Filter: (((principal_id = (InitPlan 7).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id)))) AND app.is_member_of(commission_id))
                             Heap Blocks: exact=1
                             Buffers: shared hit=2
                             InitPlan 7
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Bitmap Index Scan on memberships_one_commission_role_uq  (cost=0.00..4.16 rows=2 width=0) (actual time=0.001..0.001 rows=1 loops=1)
                                   Index Cond: (principal_id = pr.id)
                                   Buffers: shared hit=1
                     SubPlan 16
                       ->  Index Scan using hospital_affiliations_principal_idx on hospital_affiliations ha  (cost=0.18..43.34 rows=1 width=0) (actual time=0.460..0.461 rows=1 loops=1)
                             Index Cond: (principal_id = pr.id)
                             Filter: ((voided_at IS NULL) AND ((principal_id = (InitPlan 11).col1) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR EXISTS(SubPlan 13)) AND app.is_hospital_admin_of(hospital_id))
                             Buffers: shared hit=13
                             InitPlan 11
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (actual time=0.002..0.002 rows=1 loops=1)
                             SubPlan 13
                               ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                                     Filter: ((COALESCE(m.hospital_id, c_1.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(m.hospital_id, c_1.hospital_id)))
                                     InitPlan 12
                                       ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                                     ->  Bitmap Heap Scan on memberships m  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                           Recheck Cond: (principal_id = ha.principal_id)
                                           Filter: ((principal_id = (InitPlan 12).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                           ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                                 Index Cond: (principal_id = ha.principal_id)
                                     ->  Index Scan using commissions_pkey on commissions c_1  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                           Index Cond: (id = m.commission_id)
                                           Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 24
                       ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                             Filter: ((COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))
                             InitPlan 23
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Bitmap Heap Scan on memberships hm  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                   Recheck Cond: (principal_id = pr.id)
                                   Filter: ((principal_id = (InitPlan 23).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                   ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                         Index Cond: (principal_id = pr.id)
                             ->  Index Scan using commissions_pkey on commissions hc  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                   Index Cond: (id = hm.commission_id)
                                   Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 28
                       ->  Nested Loop  (cost=4.34..34.54 rows=1 width=0) (never executed)
                             InitPlan 27
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Bitmap Heap Scan on memberships cm_1  (cost=4.16..13.01 rows=2 width=16) (never executed)
                                   Recheck Cond: ((principal_id = pr.id) AND (commission_id IS NOT NULL))
                                   Filter: ((principal_id = (InitPlan 27).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                   ->  Bitmap Index Scan on memberships_one_commission_role_uq  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                         Index Cond: (principal_id = pr.id)
                             ->  Index Scan using commissions_pkey on commissions c_2  (cost=0.15..10.67 rows=1 width=16) (never executed)
                                   Index Cond: (id = cm_1.commission_id)
                                   Filter: ((app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id)) AND app.is_tenancy_admin_of(id))
                     SubPlan 36
                       ->  Index Scan using hospital_affiliations_principal_idx on hospital_affiliations ha_1  (cost=0.18..43.34 rows=1 width=0) (never executed)
                             Index Cond: (principal_id = pr.id)
                             Filter: ((voided_at IS NULL) AND ((principal_id = (InitPlan 31).col1) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR EXISTS(SubPlan 33)) AND app.is_hospital_admin_of(hospital_id))
                             InitPlan 31
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             SubPlan 33
                               ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                                     Filter: ((COALESCE(m_1.hospital_id, c_3.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(m_1.hospital_id, c_3.hospital_id)))
                                     InitPlan 32
                                       ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                                     ->  Bitmap Heap Scan on memberships m_1  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                           Recheck Cond: (principal_id = ha_1.principal_id)
                                           Filter: ((principal_id = (InitPlan 32).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                           ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                                 Index Cond: (principal_id = ha_1.principal_id)
                                     ->  Index Scan using commissions_pkey on commissions c_3  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                           Index Cond: (id = m_1.commission_id)
                                           Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
                     SubPlan 44
                       ->  Nested Loop Left Join  (cost=4.34..34.40 rows=1 width=0) (never executed)
                             Filter: ((COALESCE(hm_1.hospital_id, hc_1.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm_1.hospital_id, hc_1.hospital_id)))
                             InitPlan 43
                               ->  Result  (cost=0.00..0.03 rows=1 width=16) (never executed)
                             ->  Bitmap Heap Scan on memberships hm_1  (cost=4.16..13.01 rows=2 width=32) (never executed)
                                   Recheck Cond: (principal_id = pr.id)
                                   Filter: ((principal_id = (InitPlan 43).col1) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id))))
                                   ->  Bitmap Index Scan on memberships_principal_idx  (cost=0.00..4.16 rows=2 width=0) (never executed)
                                         Index Cond: (principal_id = pr.id)
                             ->  Index Scan using commissions_pkey on commissions hc_1  (cost=0.15..10.42 rows=1 width=32) (never executed)
                                   Index Cond: (id = hm_1.commission_id)
                                   Filter: (app.is_member_of(id) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text)) OR app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id))
               ->  Index Scan using professional_categories_pkey on professional_categories pc  (cost=0.15..3.10 rows=1 width=48) (actual time=0.001..0.001 rows=0 loops=15)
                     Index Cond: (id = pr.professional_category_id)
                     Buffers: shared hit=8
 Planning Time: 1.952 ms
 Execution Time: 16.549 ms
(126 rows)
```

**`SubPlan 3 … loops=14`** and its inner `commissions_pkey` scan at `loops=13`, together
consuming 457 of the statement's 533 buffers, are the per-row invocation this baseline
exists to watch. Compare P5a step (ii): same policy, same projection, **more** rows returned
(20 vs 15), every SubPlan `never executed`, 135 buffers, 3.9 ms. The whole 4× difference is
the `profiles` filter's arm order versus the caller's role.

### P6 — `grant_role('commission','<CCIH>','staff','<staff1.farm>')` · actor `chefe.ccih`, hat `staff_admin`

*Shape-opaque (`plpgsql` DEFINER → `app.grant_role_impl`). Executed for real and rolled back;
the write is proven to have landed in §7.*

```
 Result  (cost=0.00..0.26 rows=1 width=4) (actual time=1.038..1.038 rows=1 loops=1)
   Buffers: shared hit=68
 Planning Time: 0.021 ms
 Execution Time: 1.046 ms
(4 rows)
```

### P7 — `revoke_role('commission','<CCIH>','staff','<staff3.ccih>')` · actor `chefe.ccih`, hat `staff_admin`

*Shape-opaque (`plpgsql` DEFINER → `app.revoke_role_impl`). Executed for real and rolled
back; the delete is proven to have landed in §7.*

```
 Result  (cost=0.00..0.26 rows=1 width=4) (actual time=0.919..0.920 rows=1 loops=1)
   Buffers: shared hit=42
 Planning Time: 0.009 ms
 Execution Time: 0.928 ms
(4 rows)
```

---

## 9. How a later phase compares against this file

1. `supabase db reset --local` on a **quiet** stack (rule 7 of the plan: one owner at a
   time). Do not `ANALYZE`.
2. Re-run the harness exactly as in the header. Confirm the migration head has moved only
   by your own phase's migrations.
3. **Read the positive control first.** If fewer than four arms give distinct readings, stop
   — the comparison is void, not "unchanged".
4. Diff plan **shapes** (per §4's normalisation), not timings. Local timings on this data
   vary 10–30 % run to run; buffer counts on warm reps are stable to ±1.
5. A shape change on P3, P5a (i) or P1's body is a **regression** — those three are the
   healthy, index-backed shapes. A shape change on P2a/P5b (iv) may be an **improvement**;
   check it is not an improvement bought with a widened predicate.
6. Anything shape-opaque (P1 top-level, P2c, P4a/b/c, P6, P7) can only be compared on
   buffers + rows + time. For those, run Pass B for the ones where it is tractable
   (everything but P2c) and diff the body plans instead.

---
branch: authz-ae4-catalog
task: AE4 — the authz catalog, and staff_admin substituted end-to-end (ADR 0155 D7)
adrs: [0155, 0162, 0169, 0170, 0172, 0173, 0079]
base_sha: 0412bef7e59476635ddb024c63fdce182a7a6466
created: 2026-09-01
updated: 2026-09-01
status: live
---

# Handoff — AE4, paused after the cutover

## ▶ RESUME HERE

1. `git log --oneline 0412bef7..HEAD` and `git status` — confirm the tree still matches.
2. `supabase db reset --local` — mandatory; every figure below assumes a fresh reset.
3. `npm run test:db` — expect **RED on exactly two suites** (§ Gates). Any other red is drift, not this handoff's state.
4. Read **PROGRESS.md § Now** and § Decisions. This file is not status truth.

⛔ Re-measure before relying on anything below — see § Trust.

## Trust

Written **cold at session end, not incrementally** — the least reliable mode, so the
partition matters more than usual. **VERIFIED** = the lead ran the command shown, this
session. **BELIEVED** = `backend` reported it and the lead did not re-measure.
**UNKNOWN** = named, not covered.

Six premises were measured false during this phase; four were the lead's own. Treat
BELIEVED rows accordingly.

## Goal and scope boundary

AE4 makes the `authz` catalog exist, migration-managed, with **exactly one role —
`staff_admin`** running on it, proven by a differential oracle.

**Explicitly NOT in scope, and each was ruled, not overlooked:**
- Other roles. Eleven remain `legacy`; AE5 substitutes them one at a time.
- Retiring `memberships_role_check` / `memberships_scope_shape`. Both stand until
  AE5-complete. ⛔ The phrase *"the catalog is the authority"* may not appear in a gate
  record before then — it is **authority-elect**.
- Widening `PRED_DOMAIN` (the door-sweep harness's `bool` bound). Routed to C2.
- Fixing the three filed follow-ups (§ Open questions).
- `seed.sql`. Untouched by ruling — it is a contract with ~900 tests.

## State

### Done — VERIFIED

| What | Witness | When |
| --- | --- | --- |
| `authz` schema: 4 tables, 5 functions, 0 policies | `select … from pg_tables/pg_proc/pg_policies where schemaname='authz'` | 09-01 |
| All 5 `authz` functions `prosecdef=true`, `search_path=""` | `select proname, prosecdef, proconfig from pg_proc join pg_namespace … nspname='authz'` | 09-01 |
| No app role holds USAGE on `authz` | `has_schema_privilege(r,'authz','USAGE')` for anon/authenticated/service_role → all false | 09-01 |
| Catalog seeded 42 permissions / 42 grants / 0 implications | `select count(*) from authz.permissions / role_permissions / permission_implications` | 09-01 |
| Distribution: 33 commission-none, **5 commission-phi**, 2 org-class2, 2 org-none | `select resolution_scope_kind, sensitivity_ceiling, count(*) from authz.permissions group by 1,2` | 09-01 |
| **Post-cutover: 1 `authoritative`, 11 `legacy`** | `select state, count(*) from authz.roles group by state` | 09-01 |
| Both legacy CHECKs still on `memberships` | `select count(*) from pg_constraint where conrelid='public.memberships'::regclass and conname in ('memberships_role_check','memberships_scope_shape')` → 2 | 09-01 |
| Wrappers delegate: `has_role=false`, `assignment_facts=true`, `active_role=true` on both | `select proname, prosrc ~ … from pg_proc … proname in ('is_staff_admin_of','is_staff_admin_of_for')` | 09-01 |
| `memberships` FK is `MATCH FULL ON UPDATE RESTRICT ON DELETE RESTRICT` | `pg_get_constraintdef` on `memberships_role_scope_kind_fkey` | 09-01 |
| `memberships.scope_kind` is `GENERATED ALWAYS`, **nullable** | `information_schema.columns` | 09-01 |
| **BUG-PROF-INACTIVE-001 fixed**: active true / deactivated false / suspended false | rolled-back txn flipping `profiles.is_active` + `suspended_until`, calling `app.can_manage_professional` | 09-01 |
| That bug was a **singleton** — only `app.can_manage_professional` called `has_role` without `is_active` | `select … from pg_proc where nspname in ('app','public') and prosrc ~ '\mhas_role\M' and prosrc !~ 'is_active'` → 1 row | 09-01 |
| All 13 doors gated on `can_manage_professional` hold `authenticated` EXECUTE | `has_function_privilege('authenticated', oid, 'EXECUTE')` → 13/13 | 09-01 |
| Amended deriver selects D2's four functions | `BASE=731abda0~1 TIP=731abda0 bash scripts/door-sweep-cases.sh` → 4 names, exit 0 | 09-01 |
| Amended deriver **exits 1 FINDING** on an unreadable rewrite migration | same, over `20260816000500`'s commit → exit 1 | 09-01 |
| ACL asymmetry: `is_staff_admin_of` carries `=X/postgres` (**PUBLIC**), `is_staff_admin_of_for` does not | `select proacl from pg_proc …` | 09-01 |
| `assignment_facts` carries **3** gates, not 4 — active-role lives in `has_direct_permission` | `prosrc ~ 'active_role'` → false / true respectively | 09-01 |

### Written but UNVERIFIED (BELIEVED — backend's reports, not re-measured)

- 403's cell set is **657** (from 873 after 216 unconstructible exclusions), 15/15 passing.
- The AE4.5 coverage arms (7) each fire on their own message after arm1b was isolated.
- The direct-call census is 13 literal sites, 1 replaced, 12 allowlisted with per-site reasons.
- pgTAP 401 is 112/112; 402 and 404 green.
- Six driver defects were found and fixed inside 403's harness.

### Not started

**AE4.7** and **AE4.8**. See § Next task.

### Tree

`base_sha` **0412bef7**, 46 commits ahead of `main`, working tree **clean** except two
pre-existing untracked items that predate this branch and are not this work's:
`docs/learning/`, `scripts/progress-cleanup-2026-08-26.mjs`.

⛔ **Nothing merged, nothing pushed.** PO ruled the whole phase merges once, at Gate AE4.
The schema-first push rule (`.claude/rules/push-schema-before-code.md`) is **armed but
not owed** — it fires at that merge.

11 migrations added, `20261003007100` … `20261003007200`. Suites 401–404 added; 357 edited.

## Gates

At `0412bef7`, on a fresh reset:

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run lint` (**12** gates — gate 12 `lint:authz-vectors` added this phase) | green | 0 |
| `npm run typecheck` | green | 0 |
| `npm run test` (vitest) | 2021 tests | 0 |
| `npm run test:db` | ⛔ **RED — see below** | — |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` | all HOLD | 0 |
| diff-scoped door sweep | DERIVED cases, findings baseline untouched | 0 |

⛔ **`test:db` is RED on exactly two suites, and this is the phase's open dependency:**
`315_act_stage3_hat_condition` and `319_act_case_caps_arm_divergence`. Both mutate
`app.has_role` and assert propagation into `is_staff_admin_of[_for]`. **The cutover moved
that chokepoint**, so the mutations no longer reach the wrappers and both twins fail.
They are **orphaned, not wrong**. AE4.7 owes the re-point.

⚠ They failed **loudly**. Had the mutation left their assertions satisfied they would have
gone silently vacuous — a hat control no longer testing the hat, green forever.

**Did NOT run:** `npm run e2e:prod` since Increment 1 (it was green then, after a batch
re-run). ⚠ **C2's reachable command doors remain outside every ARM's domain** — state that
qualifier beside any "all arms green" claim (plan rule 2).

## Dead ends

- **Delegating the wrappers to the permission resolver.** Three shapes were considered and
  all fail. A **sentinel permission** couples a role check to one arbitrary grant. **"Holds
  any staff_admin-granted permission at this scope"** is correct only while
  `role_permissions` holds one role — the moment AE5 grants `staff` any permission
  `staff_admin` also holds, `is_staff_admin_of` returns **true for a plain staff member**.
  A **marker permission** would spend a PO amendment describing what the adapter already
  models. Resolution: delegate to `authz.assignment_facts`, which answers role questions.
- **Delegating to `assignment_facts` alone.** It carries expiry, scope and `is_active` —
  **not** the active-role filter, which lives in `has_direct_permission`. A wrapper
  delegating to the adapter alone drops the hat gate for the ~151 self-check sites. Both
  wrappers now carry the filter in `has_role`'s shape.
- **Asserting "ACLs unchanged" by comparing the two wrappers to each other.** They are not
  symmetric (§ VERIFIED). Snapshot each function's own ACL before/after.
- **A text-based door-sweep deriver.** It matches `create function` in migration text; the
  house `pg_get_functiondef` + `replace` + `execute` pattern contains none. 33 migrations
  were invisible. Amending it reaches **8 of 33** — the other 25 select targets by catalog
  query whose predicate matched *what the migration removed*, so it returns zero today and
  is unrecoverable without a historical snapshot.
- **Expecting the sweep to verdict D2's four functions.** Even once *selected* they fall
  outside `PRED_DOMAIN`'s `typname='bool'` bound. Sweep result is **UNPROVEN (exit 3)**,
  discharged behaviourally under plan rule 4's compensating-controls clause.
- **Asserting `absent` active-context for a single-role principal.** `claims_for(uid,false,null)`
  *derives* the single role — correct behaviour. 216 cells excluded with that reason.

## Decisions made in flight

**Ruled by the PO:**
- Matrix **approved at 42 rows** — the regression oracle from cutover. A 43rd row is a new
  amendment needing its own approval. ⛔ Recorded as *what was approved*, never a current count.
- Deny-class effect table approved (9 rows). `pending` denies at the **auth** layer, not the
  resolver — the axes file is cross-referenced, not contradicted.
- `staff_admin` **loses `org.professionals.manage`** — its own gated increment **before**
  AE4.6's successor work. ⛔ The gate must be **split first** (rows 30/31/32); a naive
  one-arm removal also strips external-participant minting and case vocabularies.
- Whole phase merges once, at Gate AE4. Hold everything on the branch.
- BUG-PROF-INACTIVE-001 → fix first, then finish 403.
- Deriver amended now, inside AE4; historical scoping limited to the cheap lookup.

**Ruled by the lead:**
- Delegation shape (§ Dead ends). AE4.7 owns the twin re-point, not AE4.6.
- Deriver over-selection (6-for-1 baseline) **recorded with a trigger, not fixed** —
  restructuring a gate's input assembly to correct a benign over-count risks more than it buys.

**Provisional — needs the PO:**
- `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM`. Reachability measured; disposition owed.

## Open questions / blockers

| Item | Who/what answers it |
| --- | --- |
| `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` — `is_admin()` is a self-check inside a `p_uid`-parameterised function. **13 callers, 12 self, 1 third-party** (`can_read_professional_profile`), whose own 4 consumers all pass `auth.uid()`. No reachable third-party path **today**; correctness is a property of the callers, not the function. One consumer gates **audit-writes**, not a read. | PO |
| `FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE` — a PUBLIC EXECUTE grant on an authz predicate. AE1.2's global revoke governs only newly-created functions. | PO |
| `FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER` — `novato.pendente` is the **only** account whose `profiles.email_confirmed_at` and `auth.users.email_confirmed_at` disagree, so it authenticates and cannot exercise the layer it models. ⛔ Do not fix `seed.sql` opportunistically. | PO |
| PROGRESS.md is ~86 KB against an 82 KB target. Rotation deferred by PO ruling to the Record step. ⚠ The AE3 § Now bullet **cannot rotate wholesale** — it is the only witness to two operator obligations. | PO / Record step |
| **UNKNOWN:** whether `e2e:prod` still passes after the cutover. Not run since Increment 1. | run it |
| **UNKNOWN:** whether the 25 unreachable rewrite migrations' doors hold periodic-sweep verdicts. The 8 measurable ones gave 16 COVERED / 10 ERROR / **0 BLIND** / 29 absent — and every absent one is outside `PRED_DOMAIN` by shape, converging on the **known C2 population**, not a new one. | a historical-snapshot audit, if ever authorised |

## Next task — AE4.7

**First command:** `supabase db reset --local && npm run test:db` to reproduce the two reds.

1. **Re-point the orphaned twins.** Mutate the wrapper's active-role conjunct
   (`… af.role_code is not distinct from app.active_role()`) instead of `has_role`'s
   disjunct — same property, new chokepoint. ⛔ These are delicate hat controls; a
   re-pointed mutation twin that passes **vacuously** is worse than the orphaned red,
   because the red is loud and a vacuous pass is silent forever. Prove each still fires.
2. Re-derive the census/hat/floor/wrapper **domains** so the delegating wrappers stay in-domain.
3. Add the **catalog-completeness arm** (every non-`legacy` role has an approved matrix and
   a differential suite) and the **wrapper-coverage arm** (the AE4.6 census re-run).
4. Point mutation arms at the resolver. ⭐ 403 §6.3 already demonstrates this works —
   neutralising `authz.scope_reaches` reds the suite.

Then **AE4.8** (frontend seam collapse, parallel track under file ownership), then Gate AE4:
full §6 + `e2e:prod` + QA review + PO approval.

## Re-derivation appendix

`DB=supabase_db_azkbbhskturikxpgmafq`; there is **no `psql` on PATH** — use
`docker exec "$DB" psql -U postgres -d postgres -At -c "…"`.

- Catalog state: `select state, count(*) from authz.roles group by state;`
- Permission shape: `select resolution_scope_kind, sensitivity_ceiling, count(*) from authz.permissions group by 1,2;`
- Wrapper delegation: `select proname, prosrc ~ 'assignment_facts', prosrc ~ '\mhas_role\M', prosrc ~ 'active_role' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname like 'is_staff_admin_of%';`
- ACL snapshot: `select proname, proacl from pg_proc … proname like 'is_staff_admin_of%';`
- Sweep derivation: `BASE=<sha>~1 TIP=<sha> bash scripts/door-sweep-cases.sh`
- ⛔ For any SQL/RLS/RPC/authz claim the **live catalog is the sole truth** — never a
  migration file, never graphify (CLAUDE.md's binding exception).

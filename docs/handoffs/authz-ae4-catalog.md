---
branch: authz-ae4-catalog
task: AE4 — the authz catalog, and staff_admin substituted end-to-end (ADR 0155 D7)
adrs: [0155, 0162, 0169, 0170, 0172, 0173, 0079]
base_sha: 0412bef7e59476635ddb024c63fdce182a7a6466
created: 2026-09-01
updated: 2026-09-01
status: live   # AE4.7a landed; AE4.7b + the PO batch are next
---

# Handoff — AE4, paused after the cutover

## ▶ RESUME HERE

1. `git log --oneline 0412bef7..HEAD` and `git status` — confirm the tree still matches.
2. `supabase db reset --local` — mandatory; every figure below assumes a fresh reset.
3. `npm run test:db` — expect **253 files / 8452 tests, RED on exactly two suites** (§ Gates):
   315 test 14 and 319 test 5. Any other red is drift, not this handoff's state.
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
- `staff_admin` **loses `org.professionals.manage`**. ⛔ **THIS SENTENCE WAS WRONG** — it read
  "before AE4.6's successor work"; PROGRESS.md § Decisions said **before AE4.6**, and PROGRESS.md is
  status truth. AE4.6 shipped without it. **RULED 2026-09-01: re-timed to AE4.7c, after AE4.7b**,
  and the **revoke half is BLOCKED** — *org-admin-only* is not implementable (matrix § 12.8). ⛔ The gate must be **split first** (rows 30/31/32); a naive
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

## Next task — AE4.7b   (⛔ AE4.7a is DONE — see § AE4.7a at the end of this file;
## the QA section's step 1 is discharged, and its item 4 plank "403 §6.3 already demonstrates
## this works" is now actually demonstrated rather than assumed)

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

## QA review — 2026-09-01, independent session at `6da8a772`

Unforgiving pass over the phase as built. Every § State VERIFIED row re-measured
against the live catalog on a fresh reset; three read-only reviewers fanned out over
migrations, suites, and harness; every contested claim settled by a live probe.
**Everything below is VERIFIED by this session** unless marked otherwise.

### Re-measurement — the handoff largely reproduces

- All catalog VERIFIED rows reproduce (functions, ACLs, FK, generated column, role
  states, permission distribution, CHECKs, wrapper delegation) — with ONE stale row:
  **`authz` has 5 tables, not 4** (`permission_implication_closure` is the fifth;
  42 rows, all reflexive). ⚠ A VERIFIED row whose witness, re-run, answers
  differently — § Trust demonstrated on its own table.
- `npm run test:db`: RED on exactly 315 (test 14 = REVERT-TWIN) and 319 (test 5 =
  A5); 252 files / 8434 tests otherwise green. "Orphaned, not wrong" CONFIRMED at
  assertion grain; the BELIEVED 401 = 112/112, 402/404-green rows hold.
- `lint` (12 gates), `typecheck`, vitest 2021/2021 all green; ARM=census/hat/floor +
  `FROMFINDINGS=1 ARM=wrapper` all HOLD with directly-read exit 0; both deriver
  witnesses reproduce (4 names / exit 0; exit 1 FINDING on `20260816000500`).
- The direct-call census CONFIRMED live: 0 functions in app/public contain both
  `has_role` and `staff_admin` (comment-stripped); `can_manage_professional`
  delegates to `is_staff_admin_of_for`. (The "13 sites" carry the *literal*, not
  calls — only 1 ever called `has_role` directly.)
- The cutover did NOT change NULL-hat behaviour: `has_role` itself uses
  `is not distinct from app.active_role()` (BUG-ACT-NULLHAT-1) and the wrappers
  mirror it. `is_active`/`active_role` are STABLE; `memberships_principal_idx` exists.

### 🔴 e2e:prod — the UNKNOWN is measured: NOT green as-run

Full run, fresh reset: **1198 passed · 1 failed · 19 infra-unproven · 3 flaky ·
37 did-not-run** (batches b2, b9). The 1 real failure
(`meeting-audio-minutes.spec.ts:565`, the apply-ata toast; `apply_minutes_review`
routes through the rewritten wrapper) **passes solo on a fresh reset** (10/10) —
batch-state or host pressure, NOT a reproducible cutover regression. ⛔ Gate AE4
still owes a green declaration: re-run b2 + b9 per the gate's own instruction;
never transcribe this run as green.

### Findings — ranked

**F1 🔴 403's two fail-proofs (§6.1/§6.3) are VACUOUS — measured, not inferred.**
The fixture-membership cleanup (403:270-273) sits ABOVE §6, and `disagreements()`
re-evaluates all 657 cells — so the deleted `sib_holder`/`xorg_holder` principals
already disagree on their expected-granted cells before any deliberate mutation.
Probe: a temporary `cmp_ok(pg_temp.disagreements(), '=', 0)` inserted before §6's
first mutation → **failed with 48**. Both `> 0` fail-proofs therefore pass with
their mutations deleted; the suite has not been shown able to fail, and § Next task
item 4's plank ("403 §6.3 already demonstrates this works") is **undemonstrated**.
Fix: move the membership delete below §6 beside the deactivation cleanup (the
in-file comment at 334-339 already fixed this exact shape for the OTHER cleanup),
re-prove both fire, and add
`is((select count(*) from r403), (select count(*) from authz_differential_cells))`
— today nothing proves the 657 ran.

**F2 🔴 Record conflict on a PO ruling — and the shipped order violates the stricter
record.** PROGRESS.md § Decisions (2026-09-01) records the `can_manage_professional`
split as its "own gated increment **before AE4.6**". AE4.6 shipped without it, and
this handoff's § Decisions softened the ruling to "before AE4.6's **successor
work**". One record is wrong; PROGRESS.md is status truth. Meanwhile 007150/007160
seed + grant `org.professionals.manage` to `staff_admin`, so the oracle pins as
expected the capability the PO removed (matrix row 30 "approved as *today* only").
Needs PO adjudication before Gate AE4: land the split first, or record an explicit
deferral in BOTH places.

**F3 🔴 The differential's third legacy-equivalence class is never called.** 403's
driver `else`-substitutes `can_manage_professional` for
`can_read_professional_profile` (403:186-191). Live catalog: that door is a 3-arm
disjunction — `is_admin()` · `can_manage_professional` · a case-committee traversal
that grants independently of org scope. Arms 1 and 3 are outside the differential
entirely; §2.3 asserts the *label* column, not the door. Fix: call the real door for
class 3. Where arm 3 legitimately grants beyond `org.professionals.read`, that is a
FINDING for the AE5 matrix — record the divergent cells with their own expected
values, never substitute the subject.

**F4 🔴 An approved axis value is silently dropped — and the arm built to catch it
cannot fire.** `gen-authz-differential-cells.py:22` hardcodes 4 principal states;
the axes file declares 5 — `offboarded`, explicitly RULED an "ORDINARY FILLABLE
COORDINATE" (its `unfillable` rule is RETIRED in the same file). No skip rule, no
counter: invisible to every arm. And **arm7 is dead code** —
`sum(skipped.values()) > 0 and not skipped` is tautologically false, and it is
absent from `--self-test` (7 checks, 8 arms). The generator hardcodes every axis in
Python while sha-stamping a JSON it never reads. Fix: derive the axes FROM the JSON,
resurrect arm7 as "axes declared − axes enumerated = ∅", and route the offboarded
cells' expected values through their own PO approval (the matrix is approved at 42
rows; this is new approval surface, not a silent extension).

**F5 🟠 The oracle's expected-value file has NO drift gate, and its generator runs
on exactly one machine.** `lint:authz-vectors` guards `authz_matrix_cells.psql`
(the `.mjs` generator — verified solid: `--check` in sync, 5/5 self-test negative
controls + discrimination control). Its sibling `authz_differential_cells.psql` —
the file with the EXPECTED VALUES in it — has no `--check`, no gate, no hash
assertion; a hand-flipped `expected_granted` is undetectable by anything. The `.py`
generator hardcodes `ROOT = 'D:/Development/...'` (dies in CI and worktrees, or
silently regenerates the primary checkout's file) and stamps its own header
"Generator: ….mjs" — the wrong name. Fix: `--check` mode folded into gate 12 (same
gate, count unchanged — the narrow CLAUDE.md authorization is respected), ROOT from
`__file__`, header corrected.

**F6 🟠 pgTAP 405 does not exist — and 007200 cites it twice as its compensating
control** ("Both polarities are asserted in pgTAP 405"; "405 greps the
COMMENT-STRIPPED prosrc of both wrappers"). Tests run 400–404. The wrappers' own hat
conjunct is asserted NOWHERE post-cutover (401 §16 tests the resolver, not the
wrappers). Write 405 as described or amend the header — a named control that does
not exist is prose rot at its most dangerous.

**F7 🟠 The `authz` schema is outside EVERY arm's domain, and the harness's own
expiry has passed.** All five arms bound `nspname in ('app','public')`; the AE4
harness diff is **+35 comment lines, zero executable change**, and the comment block
itself says the exemption stops being correct at AE4.6 — which landed in the same
branch. "All arms HOLD" is true of a domain excluding the five DEFINER functions now
on the live staff_admin enforcement path. ⛔ Until AE4.7 lands, that qualifier
belongs in § Gates beside the C2 one. Fix = the specced AE4.7 step 2: widen harness
AND deriver to `('app','public','authz')`, then re-derive domains and the census
baseline (`PRED_DOMAIN`'s bool bound stays routed to C2 — do not widen it here).

**F8 🟠 This handoff's BELIEVED arithmetic is wrong in detail.** The cell set is
1080 → 657 with **423** skipped by FOUR rules (the psql header says so); "873 → 657
after 216" silently pre-applies the three anonymous rules. Effective measurement is
~168 distinct driver inputs — the deny-class collapse the sibling generator
implements and this one does not; 657 is the inflated figure the axes file itself
warns against. Also: `anonymous` maps to an authenticated JWT (no cell ever runs
unauthenticated — the 9 `deny-class:unauthenticated` cells prove nothing about
anonymity), and **108 cells labelled third-party have caller == principal**
(`unprivileged`'s caller is `f.nobody`, which IS its principal).

**F9 Design debts AE5 will multiply by 11** (detail in the reviewer transcripts):
- ⭐ **The hat conjunct is hand-copied in 4 phrasings across both wrappers,
  `has_direct_permission`, and `explain_direct_permission`.** This duplication is
  also WHY 315/319 are orphaned: the cutover removed the `has_role` chokepoint
  without naming a successor. One helper —
  `authz.holds_role(p_principal, p_role, p_scope_kind, p_scope_id)` carrying facts +
  expiry + `is_active` + the self-check hat — makes every wrapper a one-liner, gives
  mutation twins ONE chokepoint forever, and turns each AE5 cutover into a 2-line
  body swap.
- **`authz.roles.state` is inert** — nothing reads it; flipping it changes nothing.
  Make `holds_role` require `state = 'authoritative'`: a premature AE5 delegation
  then fails closed and loudly, and the flip becomes the atomic cutover the design
  claims it is.
- **Nothing guards the closure**: writes to `permission_implications` without
  `rebuild_implication_closure` fail CLOSED silently. A statement-level trigger on
  the catalog tables (migration-only writes — the anti-trigger argument was about
  `memberships`' hot path) or a 401 assertion `closure ⊇ reflexive(permissions)`.
- **`has_direct_permission`** ignores its `p_scope_kind` parameter (return false on
  mismatch or drop it), is named "direct" while joining the implication closure
  (rename to `authz.has_permission` NOW, while callers = 0), and `explain_`'s
  `denied_reason` is `text` beside the `authz.denial_reason` domain created two
  screens up — with the commonest denial (not granted at all) mislabelled
  `scope_unreachable`.
- **The rewrite migrations dropped the house `v_hits = 1` exactly-once guard**
  (`20261003001900:1053` has it; 007180/007190/007200 assert only `position() > 0`
  while `replace()` is global — and `role = 'staff_admin'` is a proper substring of
  `signoff_role = 'staff_admin'`, a collision live in `save_section_answers` until
  M15 removed it). Restore the idiom; add 007200's missing already-applied guard;
  add 007180's missing `door-sweep-targets:` marker (its siblings carry it).
- **Perf (provisional — MEASURE before AE5):** `assignment_facts` is a non-inlinable
  DEFINER SRF evaluated per row inside ~63 policies' predicate, scanning `profiles`
  for the platform_admin arm on every role-specific call. `holds_role` as a single
  indexed EXISTS dissolves the question.
- Minor: wrappers re-declare `search_path = app, public, pg_catalog` where every
  `authz.*` function uses `''` (two qualifications away); `is_staff_admin_of` still
  carries PUBLIC EXECUTE (live-confirmed); no format CHECK on
  `permissions.code`/`roles.code`; 403's RUN SHAPE comment says Tests: 12 against
  `plan(15)`; 315:9-12 / 319:15 headers still describe the pre-cutover wrapper.

**What holds up under attack** (credit where measured): the two-assertion oracle
shape (§4 legacy==catalog AND §5 catalog==approved) is right and EARNED its keep —
§4.1 was red on a real defect before 007190; **401 is strong** (no vacuous keystone
found; §18's grant/revoke vacuity control and §8's scratch-table MATCH FULL
differential are the correct shapes; §1 counts RLS tables BY PROPERTY, which is
exactly why the 5th table inherited the assertion automatically); 357's edit is
correct and complete; the deriver amendment's exit-code semantics are sane and both
witnesses reproduce; Rule 13 holds structurally (no authz object can reach an
affiliation table); the "authority-elect" language is respected everywhere.

### The difficulties, analysed

**1. The orphaned twins (315/319).** The root cause is not the twins — the cutover
moved enforcement off the single chokepoint onto inline conjuncts with no named
successor. ⛔ § Next task step 1 as written (mutate the wrapper's conjunct text) is
WEAKER than it looks, three ways: (a) `has_role` loses its only revert-twins while
still live for 11 roles + ~151 self-check sites — ADR 0106 Stage 3's gate sentence
("goes RED when the condition is removed from **has_role**") would be satisfied by
nothing; (b) the caller-only asymmetry is unobservable at `is_staff_admin_of` (no
`p_user_id`); (c) 319's A5 also proved WHAT `_case_caps`' S1 arm routes through —
provenance nothing would assert after a naive re-point. Do instead:
1. Build `authz.holds_role` (F9) and re-point BOTH wrappers through it — the new
   chokepoint, one mutation site.
2. Keep the `has_role` mutations alive for the legacy population: re-point **315's
   PROBE** to a policy still routing through `has_role` for a legacy role, and
   change **319 A5's OBSERVABLE** (under the staff_admin hat the mutation leaks
   S2's bit: 111 → 175) — same subject, same fixture.
3. ADD wrapper twins on `holds_role`'s hat conjunct, both polarities — the 405 that
   was cited but never written (F6).
4. Prove every twin fires loudly before trusting it — F1 is this branch's own
   demonstration of why.

**2. "All arms HOLD" vs the unswept authz schema (F7).** A DOMAIN change, not a
re-derivation chore: widen the bound + the deriver regex, re-run census (the new
functions surfacing as unswept newcomers is the arm WORKING), sweep them into the
findings baseline, and only then re-claim the arms in a gate record.

**3. The three FUPs.**
- PUBLIC EXECUTE on `is_staff_admin_of`: revoke in AE4.7 — anon resolves
  `auth.uid()` → null → false today, so the exposure is least-privilege + domain
  noise, not a live hole. Snapshot each function's OWN ACL before/after (§ Dead ends
  already learned the sibling-comparison trap).
- `can_manage_professional` self-check arm: fold into F3's class-3 work (same door
  family) — make the `is_admin()` arm principal-keyed or assert caller == p_uid in
  the arm; the 13-caller reachability question then dissolves.
- `novato.pendente`: stays a PO question. Note the deny-class ruling (row 5: pending
  denies at AUTH) means a persona that authenticates cannot exercise that layer BY
  DESIGN — the fix is a seed change, and `seed.sql` is a ~900-test contract: its own
  gated change, never opportunistic.

**4. e2e:prod** — settled above: no reproducible cutover regression; b2/b9 owe
re-runs before any green declaration.

**5. The 25 unrecoverable rewrite migrations** — already correctly converged on the
C2 population (PROGRESS § Now cross-reference). Nothing new owed inside AE4; do not
authorise a historical-snapshot audit from this phase.

### Recommended order for the remainder of the phase

1. **AE4.7a — evidence repair, before any new construction:** F1 (cleanup below §6 +
   cell-count assertion, re-prove §6.1/§6.3 fire), F5 (`--check` + ROOT + header),
   F4 (generator reads the axes JSON; arm7 resurrected; offboarded cells → PO), F6
   (write 405 or amend 007200), F8's corrections recorded.
2. **AE4.7b — the chokepoint:** `authz.holds_role` + wrapper re-point + the 4-step
   twin plan above + F7's domain widening + domain/census re-derivation + the
   already-specced catalog-completeness and wrapper-coverage arms. Fold the
   PUBLIC-EXECUTE revoke in here.
3. **PO batch, one sitting:** F2 (the split-before-cutover conflict — the blocking
   one), F4's offboarded expected values, F3's arm-3 divergence disposition, the two
   remaining FUPs.
4. **AE4.8** unchanged, then Gate AE4 = §6 + e2e:prod re-run to an actual green +
   QA review + PO approval.

⛔ Steps 1–2 are prerequisites for trusting the oracle the gate record will cite;
run them before AE4.8 starts leaning on "the differential is green".

*(QA 2026-09-01, independent session: three read-only reviewer agents + live-catalog
probes; the temporary 403 probe was reverted and the working tree left clean apart
from this section; PROGRESS.md deliberately untouched — the lead owns it, and this
section is the QA artifact it should cite.)*

## AE4.7a — evidence repair, 2026-09-01 (lead session, after the QA pass above)

Scope was the QA § "Recommended order" step 1 **exactly**: F1, F5, F4, F6, F8. F2/F3 are the PO
batch; **F7 and the `holds_role` chokepoint are AE4.7b and were not started.**

⛔ **Everything here is VERIFIED** — every claim below was produced by a command run this session
on a fresh `db reset`. Where a QA figure was re-measured and differed, the measurement is stated,
not the QA figure.

### F1 — 403's fail-proofs were vacuous. Repaired, and each PROVEN to fire.

QA was right and the mechanism reproduces: the fixture-membership cleanup sat **above** §6, so
`sib_holder` / `xorg_holder` already disagreed on every expected-granted cell, and both `> 0`
fail-proofs passed on pre-existing disagreements rather than on their own mutations.

- The cleanup now runs **last**, beside the deactivation, with the reason recorded at both ends.
- **`6.0` is the new baseline** — `cmp_ok(disagreements(), '=', 0)` before §6's first mutation.
  That is what turns 6.1 / 6.3 from "some disagreement exists somewhere" into differentials.
- **`6.2b`** is 6.3's own baseline: 6.0 established zero before 6.1's mutation, and 6.2 is
  deliberately targeted at one coordinate, so nothing showed the sweep back at zero before 6.3.
- **`3.0`** asserts `count(r403) == count(authz_differential_cells)` — nothing proved the 657 ran.
- `plan(15)` → `plan(18)`; the RUN SHAPE comment claimed `Tests=12` against `plan(15)` and now
  reads `Files=2, Tests=19`, which is what the runner prints.

**Three probes, each restored afterwards** (the suite is 19/19 green as committed):

| Probe | Mutation deleted / restored | Verdict |
| --- | --- | --- |
| A | §6.1's `delete from authz.role_permissions` removed | **6.1 REDS** (test 15) |
| B | §6.3's resolver neutralisation removed | **6.3 REDS** (test 18), and *only* 6.3 — 1/18 |
| C | the cleanup put back **above** §6, as shipped | **6.0 and 6.2b RED** — and ⛔ **6.1 / 6.3 still PASS**, which is F1 reproduced live |

Probe C is the one worth keeping: it shows the new baselines are precisely the arms that would
have caught the defect, and that the old fail-proofs are silent about it.

### F6 — pgTAP 405 now exists. It was cited twice and had never been written.

`20261003007200` names "pgTAP 405" as its compensating control for the hat gate's **both
polarities** and for the comment-stripped `prosrc` grep. Tests ran 400–404. Post-cutover the
wrappers' **hand-copied** active-role conjunct was asserted nowhere (401 §16 tests the *resolver*,
which the wrappers do not call). `405_ae46_wrapper_cutover_invariants.sql`, 15 assertions:
§2 the self-check wrapper's hat gate both ways, plus scope · §3 the `_for` asymmetry, with a
non-holder differential so 3.3's TRUE is attributable · §4 the prosrc greps **with an instrument
control** (the strip removes what is behind `--` and keeps what is not) and a **positive control**
(both bodies *do* contain `assignment_facts` — an absence measured by an instrument that finds
nothing is not evidence) · §5 `prosecdef` plus the PUBLIC-EXECUTE asymmetry **pinned as a recorded
defect**, with the expected value AE4.7b must invert written into its own message.

⛔ **007200's header now needs no amendment — its two claims became true.** Do not "tidy" them.

**Five mutations, each proven to red the right assertion:**

| Mutation | Reds |
| --- | --- |
| `is_staff_admin_of` delegates to the adapter **alone** (the drop-the-hat-gate bug 007200 warns of) | 2.2, 4.4, 4.5 |
| `_for` applies the filter **uniformly** (the "looks like a tightening" bug) | 3.3 |
| `legacy OR new` survives in `_for` | **4.2 only** — every behavioural assertion stayed green, which is exactly why the structural grep earns its keep |
| `is_staff_admin_of` stops comparing `scope_id` | 2.3 |
| the NULL-hat `is not distinct from` "simplified" to `=` | 4.5 |

⚠ **The `legacy OR new` probe first reported GREEN because it never applied.** `app.has_role` is
`(text, uuid, text, uuid)` — role first — and the probe passed `(uuid, text, …)`, so the
`create or replace` errored and the run looked clean. Re-run with the right signature **plus an
assertion that the edit landed**, it reds 4.2. A mutation that did not apply reports green.

### F4 + F5 — the generator reads its axes, and the expected-value file finally has a gate.

`scripts/gen-authz-differential-cells.py`:

- **ROOT from `__file__`**, not a hardcoded `D:/Development/...` — it no longer dies outside this
  checkout, nor silently regenerates the primary checkout's file from a worktree. Verified by
  running it from another drive root.
- The header said `Generator: ….mjs`. It now says `.py`, which is what it is.
- ⭐ **Axis values are read from the JSON it sha-stamps.** Hard-coding them silently dropped **two**
  declared values, not one: `principalState.offboarded` (QA F4) **and `scope.zero_scope`**, which
  QA did not name.
- **arm7 resurrected.** Its predecessor read `sum(skipped.values()) > 0 and not skipped` —
  tautologically false, so it had never refused anything and *could* not: it was keyed on the skip
  dict, and a value that never enters the loop is not in it. It is now keyed on the **declared
  axes**, in three shapes (a declared value in no cell and no named exclusion · an axis with no
  disposition · an exclusion with no reason), all three exercised by `--self-test`, which is now
  **10 checks plus the discrimination control**, every one caught.
- **Every skip counter counts CELLS at one grain**, and `len(cells) + sum(skipped) == the declared
  grid` is asserted (657 + 1143 == 1800). The first draft of this fix short-circuited excluded axis
  values at their own loop level, so those counters counted loop *prefixes* while the inner rules
  counted cells — a census whose parts cannot sum, and the header total a number of nothing.
- **`--check` chained into gate 12.** `lint:authz-vectors` now guards
  `authz_differential_cells.psql`, **the file with the expected values in it**, which had no
  `--check`, no hash assertion and no gate at all. Gate count unchanged at 12, so the narrow
  CLAUDE.md authorization is respected.

**Controls run on all of it:**

- The 657 emitted rows are **byte-identical** before and after the rewrite — only header comment
  lines moved. That is the control that makes a generator rewrite safe to trust.
- `--check` **fires**: hand-flipping one `expected_granted` reds it, and reds `npm run lint` as a
  whole; restoring greens both.
- ⚠ **That first firing exposed a defect in the fix itself.** The DRIFT message died with a
  `UnicodeEncodeError` under the cp1252 gate pipe. The exit code was still 1, so the gate failed
  correctly — but the operator saw *"the generator is broken"* instead of *"the oracle's expected
  values drifted"*, which points the fix at the wrong file. It surfaced only under test because the
  **success** message is pure ASCII: the positive control could not reach the failing state. Both
  streams are now reconfigured to UTF-8 with `errors='replace'`.

⛔ **`offboarded` is a NAMED, COUNTED exclusion, not a filled cell — deliberately.** Neither
approved source covers it (the matrix is approved **at 42 rows**, and its only "offboard" mention
is prose about a different subject; the deny-class table's 9 rows have none), so emitting those
cells means **inventing** expected values — the PA-F8 trap the two-source rule exists to stop. The
exclusion's reason says so, and deleting it without an approved value is how a defect gets approved
into the oracle. **→ PO batch.**

### F8 — the arithmetic, re-measured rather than transcribed

QA's corrections mostly hold; one figure differs, and one is now superseded.

| Claim | Measured |
| --- | --- |
| "873 → 657 after 216 exclusions" (this handoff's own BELIEVED row) | **WRONG** — it pre-applied three anonymous rules. It was 1080 → 657 / 423 by four rules; it is **now 1800 → 657 / 1143 by six**, and the census is asserted to sum. |
| "~168 distinct driver inputs" | **438**, on the stated definition (persona, context, scope, **resolution-scope-kind**, state, self_check): 219 per rep × 3 reps = 657, and the two ORG-scoped reps are driver-identical, so 219 cells re-run a coordinate an earlier rep already measured. QA's 168 uses a different, unstated collapse. **The honest sentence is "657 cells over 438 distinct coordinates", never "657 measurements".** |
| "`anonymous` maps to an authenticated JWT" | **CONFIRMED.** The driver maps both `unprivileged` and `anonymous` to `f.nobody`. The 9 `deny-class:unauthenticated` cells prove exactly what `matrix-row:not-a-holder` proves, and nothing about anonymity. ⭐ **The approved deny-class table already says so** — row 8's own note records that an anonymous caller cannot reach the resolver at all (no application role holds USAGE on `authz`). The table was right; the generator emitted cells for the row anyway, and the **label** is what reads as coverage. |
| "108 third-party cells have caller == principal" | **CONFIRMED, exactly 108, all `unprivileged`** — whose principal *is* `f.nobody`, the driver's third-party caller, so for that persona the substitution recreates the defect it was written to avoid. The asymmetry's real evidence is the **26** `wrong_active_context:third-party` cells, not the 108. |

All four are recorded **in 403's header**, beside the two limitations it already carries — that
block is where a gate record will look, and a correction living only in a handoff is already lost.

### Gates at the end of AE4.7a — fresh `supabase db reset --local`

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **253 files / 8452 tests** — ⛔ RED on the same two orphaned twins (315 t14, 319 t5), **no new red**. The +1 file / +18 tests is exactly 405 (15) + 403 (3), which accounts for the delta | — |
| `npm run lint` (12 gates) | green — gate 12 now covers **both** vector files | 0 |
| `npm run typecheck` | green | 0 |
| `npm run test` (vitest) | 149 files / 2021 tests | 0 |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` | all **HOLD**, exit codes read **directly**, not through a pipe | 0 |
| diff-scoped door sweep | **NOT-APPLICABLE (exit 3)** — **0 migrations touched**, which is the checkable claim, not a pass | 3 |

⚠ **Two qualifiers belong beside any "all arms green" claim, and both are load-bearing:** QA's F7
— all five arms bound `nspname in ('app','public')`, so the **`authz` schema is outside every arm's
domain**, including the five DEFINER functions now on the live `staff_admin` enforcement path — and
C2's reachable command doors, likewise outside. **Neither is fixed here; F7 is AE4.7b step 2.**

**Did NOT run:** `e2e:prod`. AE4.7a touched no application code (a Python generator, two pgTAP
suites, one `package.json` script), so it cannot have moved it. ⛔ The gate still owes exactly what
the QA section says it owes: a b2 + b9 re-run to an actual green. Never transcribe the QA run as
green.

### What AE4.7a did NOT do

- **F2** — ✅ **RULED 2026-09-01, and the ruling changed shape on measurement.** Recorded in
  PROGRESS.md § Decisions (5 rows) and matrix § 12.8.
  - **Timing:** the gate split runs **after AE4.7b, as AE4.7c**, inside AE4 — AE4.7b re-points this
    same family onto `holds_role`, so splitting first rewrites overlapping bodies twice.
  - **The record conflict is closed:** the original ruling said *before AE4.6*, AE4.6 shipped
    without it, so that instruction is **spent, not pending**. Both records now say so.
  - ⛔⛔ **The REVOKE is BLOCKED, and this is new.** *"It becomes org-admin-only"* is **not
    implementable**: `canOpenCaseManagement` (`src/lib/queries/cases.ts:791`) admits only commission
    `staff_admin` / `administrativo` / a per-case write grant — ADR 0100 D12 deleted the
    tenancy-admin coercion **on purpose** — and `case-manage-entry-gate.spec.ts` asserts
    `assertManageDenied` for `orgadmin.a` and `hospitaladmin.a1`, each with a positive control.
    There is no professionals surface under `/o/[org]/manage/` at all. **Door ∩ surface = ∅**: the
    revoke strands the feature for everyone rather than moving it to `org_admin`. **PO owes: who
    holds the capability afterwards.** Three candidate answers, materially different work — build an
    org-admin surface; **narrow** instead of revoking (bound the gate to the caller's own commission
    reach, which closes the measured harm and strands nothing); or reverse the ADR 0100 D12 wall.
  - ⚠ **And the split is NOT the no-op I first called it.** `320:112` pins **exactly 12** RPCs on
    this gate with an explicit *"do not just bump the number"* instruction, so the split reds it
    **by design**. Answer-preserving, not test-neutral — re-derive that census, never bump.
- **F3** — the third legacy-equivalence class calls `can_manage_professional`, not the real
  `can_read_professional_profile` door. PO batch: its arm-3 divergence is new matrix surface.
- **F7** and the whole `authz.holds_role` chokepoint — **AE4.7b**, unchanged from the QA plan.
- The two open FUPs (PUBLIC EXECUTE; the self-check arm). 405 §5.2 **pins** the PUBLIC grant with
  the post-revoke expectation written into its message, so AE4.7b's revoke reds it loudly.

### Next — the QA § "Recommended order", minus its step 1

2. **AE4.7b** — `authz.holds_role`, both wrappers re-pointed through it, the 4-step twin plan,
   F7's domain widening, domain / census re-derivation, the catalog-completeness and
   wrapper-coverage arms, and the PUBLIC-EXECUTE revoke (405 §5.2 must flip to `array[false, false]`).
3. **PO batch, one sitting** — F2 (blocking), F4's `offboarded` expected values, F3's arm-3
   disposition, the 9 mislabelled `unauthenticated` cells, and the two remaining FUPs.
4. **AE4.8**, then Gate AE4 = §6 + `e2e:prod` re-run to an actual green + QA review + PO approval.

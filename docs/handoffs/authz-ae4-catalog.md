---
branch: authz-ae4-catalog
task: AE4 — the authz catalog, and staff_admin substituted end-to-end (ADR 0155 D7)
adrs: [0155, 0162, 0169, 0170, 0172, 0173, 0174, 0079, 0106]
base_sha: 0412bef7e59476635ddb024c63fdce182a7a6466
created: 2026-09-01
updated: 2026-09-01
status: live   # AE4.7a/b/c + the PO batch landed (254f/8504 GREEN); AE4.8 next
---

# Handoff — AE4, paused after AE4.7c

## ▶ RESUME HERE

1. `git log --oneline 0412bef7..HEAD` and `git status` — confirm the tree still matches.
2. `supabase db reset --local` — mandatory; every figure below assumes a fresh reset.
3. `npm run test:db` — expect **254 files / 8504 tests, GREEN** (⚠ changed: 8498 — the PO batch
   added 3 in 401 §20 and 3 in 403 §7). ⭐ CHANGED BY AE4.7b: the
   branch's long-standing two reds (315 t14, 319 t5) are the ORPHANED TWINS and they are
   REPAIRED. A red on either now is drift, not this handoff's state — and a red anywhere
   else was never this handoff's state.
4. Read **PROGRESS.md § Now** and § Decisions. This file is not status truth.

⛔ Re-measure before relying on anything below — see § Trust.

⚠ **Two documents carry what this file deliberately does not** — read them for the *why*
behind any figure below rather than re-deriving it:
- [`authz-ae4.md`](../progress/authz-ae4.md) — the **increment record**: AE4.7a (evidence
  repair), AE4.7b (the `holds_role` chokepoint), AE4.7c (the gate split), each with its own
  gate table and its own "what this did NOT do".
- [`authz-ae4-review.md`](../reviews/authz-ae4-review.md) — the **mid-phase QA review** whose
  ranked findings F1–F9 drove all three.

⛔ Nothing may cite this file — promote it to one of those two instead, and leave a pointer.

## Trust

**Mixed, and the mix matters.** The AE4.1–AE4.6 half was written **cold at session end** — the
least reliable mode. The AE4.7a/b/c half was written **incrementally**, and § State was
**re-measured wholesale at `43684b16` on 2026-09-01** rather than carried forward. A later pass
at **`b37a2a5b`** re-confirmed five load-bearing catalog rows and corrected § Tree and § Next
task, which had gone false in the four commits between.

⛔ **EIGHT ROWS OF THE OLD VERIFIED TABLE HAD GONE FALSE** by AE4.7c — the catalog grew, the
wrappers stopped naming the adapter, a PUBLIC grant was revoked, and a 13-door gate became
four. They are corrected in place and marked **⚠ changed**, because an uncorrected handoff
re-teaches its error to the next reader. ⚠ Every one of them had been true when written, and
every one still read as careful.

**Ten premises were measured false during this phase**, six of them the lead's own; § Dead ends
carries the AE4.7b/c ones with their mechanisms. Treat BELIEVED rows accordingly.

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

⛔ **RE-MEASURED 2026-09-01 AT `43684b16`, ON A FRESH `supabase db reset --local`** (§ Trust
for what that replaced). Each row carries the query that produced it; ⚠ rows marked **changed**
are where a successor trusting the previous table would have been wrong.

⭐ **Spot-checked again at `b37a2a5b`** — rows 1, 4, 5, 6 and the wrapper/chokepoint rows all
re-returned the same values. ⚠ **That check ran against the local stack as it stood (container
up 36 min), NOT a verified-fresh reset** — it is a consistency check, not a re-issue of the
fresh-reset witness. The other rows were not re-asked.

| What | Witness | When |
| --- | --- | --- |
| `authz`: **5 tables, 6 functions, 0 policies** (⚠ changed: 4/5/0) | `select count(*) from pg_tables / pg_proc / pg_policies where schemaname='authz'` | 09-01 |
| All **6** `authz` functions `prosecdef=true`, `proconfig = search_path=""` | `select proname, prosecdef, proconfig from pg_proc join pg_namespace … nspname='authz'` | 09-01 |
| No app role holds USAGE on `authz` | `has_schema_privilege(r,'authz','USAGE')` for anon/authenticated/service_role → all false | 09-01 |
| Catalog: **43 permissions / 42 grants / 0 implications / 43 closure rows** (⚠ changed: 42/42/0) | `select count(*) from authz.permissions / role_permissions / permission_implications / permission_implication_closure` | 09-01 |
| ⭐ The ONE code `staff_admin` does not hold is **`org.professionals.manage`** — AE4.7c's revoke, named rather than counted | `select code from authz.permissions pm where not exists (… role_permissions rp where rp.role_code='staff_admin' …)` | 09-01 |
| **1 `authoritative`, 11 `legacy`** | `select state, count(*) from authz.roles group by state` | 09-01 |
| Both legacy CHECKs still on `memberships` → 2 | `select count(*) from pg_constraint where conrelid='public.memberships'::regclass and conname in ('memberships_role_check','memberships_scope_shape')` | 09-01 |
| ⚠ **changed** — wrappers now delegate to the CHOKEPOINT: `holds_role=true`, `has_role=false`, `assignment_facts=false`, `active_role=false` **on both** | `select proname, prosrc ~ … from pg_proc … proname like 'is_staff_admin_of%'` | 09-01 |
| `authz.holds_role` carries all four legacy gates **plus** `state='authoritative'`, and compares the null hat with `is not distinct from` | `select prosrc ~ 'assignment_facts' / 'active_role' / 'authoritative' / 'is not distinct from' … proname='holds_role'` → t/t/t/t | 09-01 |
| ⚠ **changed** — `anon` EXECUTE is **false on both** wrappers; `authenticated` true on both. The `=X/postgres` PUBLIC grant is gone | `has_function_privilege('anon'/'authenticated', p.oid, 'EXECUTE')` | 09-01 |
| ⚠ **changed** — the 13-door gate is now FOUR: `can_manage_professional` **3** public doors, `can_create_professional` **3**, `can_manage_external_participant` **1**, `can_manage_case_vocabulary` **6**. ⛔ 3+3+1+6=13 counts `set_professional_link_state` twice BY DESIGN (it names two gates); **12 distinct** | `select count(*) … nspname='public' and comment-stripped prosrc like '%<gate>%'` | 09-01 |
| `memberships` FK is `MATCH FULL ON UPDATE RESTRICT ON DELETE RESTRICT` | `pg_get_constraintdef` on `memberships_role_scope_kind_fkey` | 09-01 |
| `memberships.scope_kind` is `GENERATED ALWAYS`, **nullable** | `information_schema.columns` | 09-01 |
| `assignment_facts` carries **3** gates, not 4 — the hat lives in its consumers | `prosrc ~ 'active_role'` → false | 09-01 |
| Amended deriver selects rewrite-migration targets; **exits 1 FINDING** on an unreadable one | `BASE=…~1 TIP=… bash scripts/door-sweep-cases.sh` | 09-01 |

### Written but UNVERIFIED (BELIEVED — not re-measured at `43684b16`)

- ✅ **NO LONGER BELIEVED — settled 2026-09-01 during the PO batch.** `--self-test` exits 0 with
  **10 arms each caught on their own message** and the discrimination control clean on the real spec.
- Six driver defects were found and fixed inside 403's harness (AE4.5's own report).
- ⛔ **BUG-PROF-INACTIVE-001's behavioural proof has MOVED and was not re-run by hand.** It was
  verified against `app.can_manage_professional`; AE4.7c moved that arm to
  `app.can_create_professional` → `app.is_org_commission_staff_admin`. pgTAP **404** now asserts
  both polarities there and is green, so the property holds — but the witness is a suite, not a
  hand probe. Settled by reading 404's run.

### Not started

**AE4.8** only — § Next task. AE4.7a/b/c are complete, measured in the increment record.
⛔ **`docs/backend-state.md` has NO `authz` section yet** — deliberate: the surface map is a
Record-step artifact and AE4 merges once, at Gate AE4. Owed there, not here.

### Tree

⚠ **`base_sha` in the frontmatter (`0412bef7`) is the sha this handoff was FIRST written
against and is deliberately unchanged** — it is what a successor diffs from to see the whole
phase. The tree it now describes is **`b37a2a5b`** (⚠ changed: `43684b16`).

**62 commits ahead of `main`** (⚠ changed: 58), working tree **clean** except two pre-existing
untracked items that predate this branch and are not this work's: `docs/learning/`,
`scripts/progress-cleanup-2026-08-26.mjs`.

⭐ **`43684b16..b37a2a5b` is DOCS-ONLY** — `git diff --name-only` over it returns nothing outside
`docs/` and `PROGRESS.md`. That is *why* the VERIFIED table's DB rows survived a tree move: no
migration, no suite, no `src/` file changed. The TREE rows did not survive it — the commit count
and PROGRESS.md's size both moved. ⛔ Docs-only is a reason to re-check the FILE claims, not a
reason to skip them.

⛔ **Nothing merged, nothing pushed.** PO ruled the whole phase merges once, at Gate AE4.
The schema-first push rule (`.claude/rules/push-schema-before-code.md`) is **armed but
not owed** — it fires at that merge.

**14 migrations** added, `20261003007100` … `20261003007230`. Suites **401–406** added; 315,
319, 320, 321, 228, 229, 257, 290, 318, 357, 403, 404 edited.

## Gates

At **`43684b16`**, on a fresh `supabase db reset --local`:

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **254 files / 8498 tests — PASS** | — |
| `npm run lint` (**12** gates — gate 12 `lint:authz-vectors` added this phase) | green | 0 |
| `npm run typecheck` | green | 0 |
| `npm run test` (vitest) | 149 files / 2021 tests | 0 |
| `ARM=census` (578 live / 618 with a verdict) | HOLDS | 0 |
| `ARM=hat` (self-test **7/7**, 4 reasoned-allowlisted findings) | HOLDS | 0 |
| `ARM=floor` (72 never-called doors, all allowlisted) | HOLDS | 0 |
| `FROMFINDINGS=1 ARM=wrapper` (BLIND set 41) | HOLDS | 0 |
| **`ARM=catalog`** (AE4.7b) — 1 non-legacy role, both artifacts | HOLDS | 0 |
| **`ARM=sites`** (AE4.7b) — 14 sites: 2 wrapper-family + 12 allowlisted | HOLDS | 0 |

⭐ **The two orphaned twins (315 t14, 319 t5) are CLOSED** — the phase's open dependency from
AE4.6 to AE4.7b (consequence in ▶ RESUME HERE step 3).

**Diff-scoped sweeps**, most recent run (AE4.7c, both arms, exit codes read DIRECTLY):
read arm **6/6 predicates COVERED**, write arm **4/4 guards COVERED** — 0 BLIND, 0 ERROR after
two `neutralize failed` ERRORs were fixed. ⛔ **Both exit 3 UNPROVEN (PARTIAL)**: six vocabulary
RPCs matched no gate on either arm (`uuid`/`void` returns — the C2 class), named per door in
`docs/reviews/authz-writepath-audit-findings.md`. A clean verdict over a subset of what was
asked for is not a pass.

**Did NOT run:** `npm run e2e:prod` since Increment 1. ⚠ The QA review measured it **NOT green
as-run** and it owes a b2 + b9 re-run before any green declaration — never transcribe a prior
run. ⚠ **C2's reachable command doors remain outside every ARM's domain**, and so do three of
the six `authz` functions (`assignment_facts`, `explain_direct_permission`,
`rebuild_implication_closure`) — state both qualifiers beside any "all arms green" claim.

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
  delegating to the adapter alone drops the hat gate for the ~151 self-check sites.
  ⚠ **CORRECTED:** this bullet ended *"both wrappers now carry the filter in `has_role`'s
  shape"*, which AE4.7b made false — that hand-copying was the defect, and the filter now
  lives once, in `authz.holds_role`.
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

⭐ **Added in AE4.7b/c — four wrong turns a successor would otherwise repeat.** Each was
caught by a red, and each looked correct while being written.

- **Re-pointing 319's A5 twin to the staff_admin hat, expecting `111 → 175`.** Measured
  **111**. S1's mask ALREADY CONTAINS S2's bit 64, so the mutation's whole effect landed
  inside bits another arm legitimately set and the twin observed nothing while looking
  exactly like a twin. ⛔ **The general rule:** when the observable is a UNION, a mutation
  opening arm B is invisible if arm A is open and already supplies B's bits. Read it where
  NO arm is legitimately open — A5 now wears a hat the principal does not hold, `0 → 64`.
- **Giving `ARM=sites` a negative control only.** `psql` does **not** interpolate `-v`
  variables inside `-c`; both lookups died with a syntax error, every set difference was
  empty, and the arm printed `OK: staff_admin — 0 site(s)` beside `vacuity control: OK`.
  ⛔ A dead instrument satisfies an "X − Y is empty" check AND its synthetic-input control at
  the same time. The control needs a DISCRIMINATION half: a live input must match something.
- **Neutralizing only the first conjunct of 406's `link_state` bound.** Cutting
  `v_current_link is distinct from 'unknown' and ` leaves `if not can_manage_professional(…)
  then raise` — a **stricter** door. The twin would have failed and read as working, while
  measuring the opposite direction from the one a fail-OPEN twin exists for. Cut the whole
  `if` block.
- **Re-coding an expectation whose error code drifted.** AE4.7c put a `42501` authority
  refusal in front of older guards, so 229's `HC0F2` freeze twin and 257's `HC0J7` bar
  assertions started failing with the new code — and 257's collided with its own `42501`
  control. ⛔ Re-coding greens the test and leaves the guard it was written for asserted by
  NOTHING. Change the **caller** to one who passes the new guard and reaches the old one;
  the assertion splits into two, and authority and freeze stop being conflated.

## Decisions made in flight

**Ruled by the PO:**
- Matrix **approved at 42 rows** — the regression oracle from cutover. A 43rd row is a new
  amendment needing its own approval. ⛔ Recorded as *what was approved*, never a current count.
- Deny-class effect table approved (9 rows). `pending` denies at the **auth** layer, not the
  resolver — the axes file is cross-referenced, not contradicted.
- `staff_admin` **loses `org.professionals.manage`** — ✅ **BUILT in AE4.7c** (`317d48dd`),
  after two reversals each forced by a measurement. Final: **split by OPERATION** — it keeps a
  new row 43 `org.professionals.create` and loses row 30. The full trail, and why
  *org-admin-only* was not implementable, is matrix § 12.8.5; ⛔ **no ADR, by PO ruling — that
  section is the decision's home.** The split-first order (family → operation → grant) was the
  safety property and was honoured.

- Whole phase merges once, at Gate AE4. Hold everything on the branch.
- BUG-PROF-INACTIVE-001 → fix first, then finish 403.
- Deriver amended now, inside AE4; historical scoping limited to the cheap lookup.

**Ruled by the lead:**
- Delegation shape (§ Dead ends). AE4.7 owns the twin re-point, not AE4.6.
- Deriver over-selection (6-for-1 baseline) **recorded with a trigger, not fixed** —
  restructuring a gate's input assembly to correct a benign over-count risks more than it buys.

**Ruled by the PO, 2026-09-01 (ADR 0175, one sitting):** `offboarded` is not a deny class —
⭐ **re-ruled before any code**, from 91 cells to a structural proof, because the cells measured
UNCONSTRUCTIBLE; the nine `unauthenticated` cells deleted rather than relabelled; 403 calls the
real door now with arm 3's divergence deferred to AE5; both FUPs documented/downgraded.
⛔ Nothing is left provisional in this file.

## Open questions / blockers

| Item | Who/what answers it |
| --- | --- |
| ✅ **BOTH FUPs DISPOSITIONED 2026-09-01 (ADR 0175 D4) — DOCUMENTED / DOWNGRADED, NOT CLOSED.** `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM`: the mixed grain is now recorded on `can_create_professional` itself (migration `20261003007240`, comment-only) — ⚠ the ruling named `can_manage_professional`, which **already** carried the comment; the caller was the undocumented one. `FUP-SEED-PENDING-PERSONA`: `seed.sql` untouched; the auth **setting itself was never read** (no MCP auth-config endpoint), so the evidence is circumstantial and the item stays open. | — |
| ⛔ **PROGRESS.md — the 81,920 B target is NOT met and NOT reachable by rotation.** Every sanctioned category is empty and the OPEN follow-up index alone is ~**50%** of the file, which the contract forbids rotating. ⛔ Do not trim qualifiers off open entries. Options are a PO decision — raise the target, or give the register its own file — filed as `FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT`. ⚠ The AE3 § Now bullet **cannot rotate wholesale**: sole witness to two operator obligations. | PO |
| ⛔ **MEASURED, NOT UNKNOWN — and NOT green as-run.** The QA review ran `e2e:prod` at `6da8a772`: no reproducible cutover regression, but batches **b2** and **b9** owe re-runs before any green declaration. ⚠ This row said *"UNKNOWN … not run since Increment 1"* until 2026-09-01; the review had already settled the first half. AE4.7a/b/c touched no application code beyond one TypeScript doc comment, so none of them can have moved it. Detail: [`docs/reviews/authz-ae4-review.md`](../reviews/authz-ae4-review.md). | run it, at AE4.8 |
| **UNKNOWN:** whether the 25 unreachable rewrite migrations' doors hold periodic-sweep verdicts. The 8 measurable ones gave 16 COVERED / 10 ERROR / **0 BLIND** / 29 absent — and every absent one is outside `PRED_DOMAIN` by shape, converging on the **known C2 population**, not a new one. | a historical-snapshot audit, if ever authorised |

## Next task — AE4.8

⛔ **AE4.7a, AE4.7b AND AE4.7c are ALL DONE** — the QA review's § "Recommended order" steps 1–3
are discharged, each recorded in the increment record with what it MEASURED, not what it intended.

**First command:** `supabase db reset --local && npm run test:db` — expect **GREEN, 254f/8498**;
a red is drift (▶ RESUME HERE step 3).

**AE4.8 — the app-side seam collapse** (frontend, parallel track under file ownership; plan
[§ AE4.8](../plans/authz-evolution.md)). Mechanical and behaviour-preserving:

1. `role-catalog.ts` becomes the **single** role manifest — the six label maps collapse into
   `ROLE_LABELS` re-exports; `landingRouteForRole` and `page.tsx`'s precedence chain are
   re-derived from one ordered manifest, so a future role crosses **one** seam, not two.
2. The session partition keys off the same manifest's scope declarations.
3. **The TS manifest is BOUND to the DB catalog [PA-F1]** — role codes and scope declarations
   generated from, or gate-checked against, `authz.roles`, in the lint/vitest gate, not review.
4. G4: `assume_role`'s validity check reads `authz.roles.session_selectable` via a typed query
   instead of the TS enum list. ⚠ The `platform_role` **DB enum stays** (AE5-complete territory).

⚠ **AE4.8 is the first AE4 increment that touches `src/` for real**, so it is the first that
owes `e2e:prod` — and the gate already owed a b2 + b9 re-run from before AE4.7a.

⚠ **The pre-AE4.8 rotation is DONE** (`bc9242c1`, 98 → 87 KB; **89.7 KB** after this batch), so
AE4.8 fits under the hard cap. ⛔ Still over target, and that gap is **not closable by rotation**
— § Open questions. ⛔ Do not open AE4.8 by trimming qualifiers off open follow-ups.

✅ **The PO batch is DONE (`6ae81b21`, ADR 0175)** — this said *"then the PO batch"* until then.
Figures + what it did NOT do: [`authz-ae4.md § AE4 PO batch`](../progress/authz-ae4.md).
⛔ **TWO QUALIFIERS IT LEFT OWED TO THE GATE RECORD, and both read as smaller than they are:**
401 §20 is **ONE HOP**, not the transitive closure; and `can_read_professional_profile`'s arms 1
and 3 are **EXERCISED BUT NOT ORACLED** (403 §7.2/§7.3 assert they cannot grant in this fixture,
so the bound is a test, not a promise). *"The differential is green"* may not be written without
both. ⚠ Two follow-ups are **documented / downgraded, NOT closed**.

Then Gate AE4: full §6 + `e2e:prod` to an actual green + QA review + PO approval.

## Re-derivation appendix

`DB=supabase_db_azkbbhskturikxpgmafq`; there is **no `psql` on PATH** — use
`docker exec "$DB" psql -U postgres -d postgres -At -c "…"`.

- Catalog state: `select state, count(*) from authz.roles group by state;`
- Permission shape: `select resolution_scope_kind, sensitivity_ceiling, count(*) from authz.permissions group by 1,2;`
- ⭐ **The code `staff_admin` does NOT hold** (AE4.7c's revoke, the one figure a count hides):
  `select code from authz.permissions pm where not exists (select 1 from authz.role_permissions rp where rp.role_code='staff_admin' and rp.permission_code=pm.code);`
- Wrapper delegation — ⚠ **the terms changed in AE4.7b**; asking the old ones returns false and
  reads as a broken cutover: `select proname, prosrc ~ '\mholds_role\M', prosrc ~ '\mhas_role\M', prosrc ~ 'assignment_facts', prosrc ~ 'active_role' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname like 'is_staff_admin_of%';`
- The chokepoint's five gates: `select prosrc ~ 'assignment_facts', prosrc ~ 'active_role', prosrc ~ 'authoritative', prosrc ~ 'is not distinct from' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='authz' and proname='holds_role';`
- ACL, by EFFECTIVE PRIVILEGE never `proacl` text (a NULL `proacl` includes PUBLIC):
  `select proname, has_function_privilege('anon',p.oid,'EXECUTE'), has_function_privilege('authenticated',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname like 'is_staff_admin_of%';`
- The four professional/vocabulary gates' door counts: `select g, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and regexp_replace(p.prosrc,'--[^'||chr(10)||']*','','g') like '%'||g||'%') from unnest(array['can_manage_professional','can_create_professional','can_manage_external_participant','can_manage_case_vocabulary']) g;`
- Sweep derivation: `BASE=<sha>~1 TIP=<sha> bash scripts/door-sweep-cases.sh` — ⛔ it prints
  **TWO** commands (read arm + write arm); running only one leaves the other half unmeasured.
- Arms: `ARM=census|hat|floor|catalog|sites bash supabase/tests/mutation/p0-authz-invariant.sh`
  and `FROMFINDINGS=1 ARM=wrapper …`. ⛔ Read each exit code DIRECTLY — a trailing `echo` or a
  pipe erases it.
- ⛔ For any SQL/RLS/RPC/authz claim the **live catalog is the sole truth** — never a
  migration file, never graphify (CLAUDE.md's binding exception).

# NSP-per-org sub-phase A — Security / RLS Review

**Reviewer:** `qa` · **Date:** 2026-06-25 · **Branch:** `feat/nsp-per-org` ·
**Scope:** backend security core only (schema + predicates + doors + RPCs + seed +
pgTAP). Read-only on migrations/app/seed/tests — no edits made.
**Artifacts audited:** `supabase/migrations/20260630000000_nsp_per_org.sql`,
`supabase/seed.sql`, `supabase/tests/{173_nsp_per_org_isolation,145_pqs_membership,150_referrals}.sql`,
ADR 0042, `docs/progress/nsp-per-org-design.md`, `docs/backend-state.md`.

## Verdict: **APPROVED** (iteration 3 — `5f4baf5` final re-review)

> **This closes the NSP-per-org sub-phase A backend security core.** Every iteration-1/2 finding is
> resolved and independently re-verified live; my own catalog sweep for the "body-not-scoped"
> aggregate-door class confirms it is **empty, not just asserted empty**. pgTAP green 1073/1073
> (incl. the permanent `175` dropped-symbol catalog invariant + the new `143 §M3` result-scope guard).
>
> **Iteration history:** iter-1 → CHANGES (M1/M2/I1). iter-2 (`19bb30a`) → CHANGES (M3:
> `capa_kpis` global cross-org counts — gate fixed, result not org-scoped). iter-3 (`5f4baf5`) →
> **APPROVED**: M3 resolved (result set org-scoped, incl. the `overdue_actions` subquery and a
> `can_write_capa`-aligned non-event fallback), and an independent DEFINER-door sweep finds no other
> unscoped aggregate over the PHI tables.

### Iteration-3 closure — M3 resolved + independent class sweep

**M3 (`capa_kpis`) RESOLVED ✓ — body-scoped, not just gate-scoped (read the live body + proved it).**
The fix replaces the non-correlated gate with a per-org **result scope**: `v_orgs := array(select
organization_id from pqs_members where user_id = auth.uid())`; an `in_scope` CTE keeps a `capa_plan`
iff `app.org_of_event(app.event_of_capa(p.id)) = any(v_orgs)` **OR** it is non-event-sourced
(event-org NULL → included for any-org members). All four metrics read from `in_scope`, and crucially
the **`overdue_actions` subquery now `join in_scope isp on isp.id = a.capa_id`** (the iter-2 leak was
its unscoped action count).
- **Proven live (the iter-2 1→2 is now 1→1):** pqs.a (rede-a only) baseline `open=1 overdue=0`; after
  injecting a rede-b event-sourced `capa_plan` **and** a rede-b overdue `capa_action` → pqs.a **still
  `open=1 overdue=0`** (both the plan and its overdue action excluded). pqs.b (enrolled rede-b) sees
  `open=1 overdue=1` (own-org). A plain non-PQS staffer → all zeros.
- **Non-event fallback is NOT a new leak — confirmed aligned with `can_write_capa`:** injected a
  `manual` plan (`event_of_capa` = NULL); it is counted by pqs.a AND pqs.b, and `can_write_capa(manual)`
  = `true` for both, `false` for a non-PQS staffer. Counted ⇔ writable. No such plans exist in the seed
  today (indicator is Phase 15); the two treatments are deliberately kept in lockstep.
- **`143 §M3` guard reviewed (mutation-proof):** M3a asserts a rede-a-only PQS member's `open_count`
  **and** `overdue_actions` are **unchanged** by a cross-org event-sourced plan + overdue action
  (`is(after, before)` — fails on any `before+1` regression); M3b asserts the 2nd-org PQS member **does**
  count them (`>= 1`, prevents a vacuous all-zero pass). Result-scope analog of the `175` reference-scope
  invariant.

**Independent "body-not-scoped" class sweep (my own catalog enumeration — did not trust the self-audit).**
Enumerated every `SECURITY DEFINER` function returning a `TABLE`/`SETOF`/`jsonb` whose body reads
`capa_plan` / `capa_action` / `patient_safety_event` / `case_referral` / `patient_xref` (+ a broadened
pass over indirect readers of `event_triage`/`rca`/`referral_reply`/`event_custody`/`referral_shared_item`).
**9 doors total; each org-filtered or entity-keyed; the broadened pass found 0 additional doors:**

| DEFINER door | ret | scoping | body check |
|---|---|---|---|
| `capa_kpis` | SET | **org-filter** (`= any(v_orgs)`, incl. overdue subquery) | ✓ (M3) |
| `pqs_inbox` | SET | **org-filter** (`rc.organization_id in (caller's orgs)`) | reviewed iter-1 |
| `get_patient_trajectory_for_entity` | jsonb | **org-filter** (entity→org, gate `is_pqs_member_of`) | reviewed iter-1 |
| `patient_access_audit` | jsonb | **org-filter** (`audit_log.organization_id = p_org_id` + xref org) | reviewed iter-1 |
| `get_event_patient` | jsonb | **entity-keyed** (gate `can_read_event_patient`; only `event_patient where event_id = arg`) | ✓ **spot-checked** — single keyed read, no second aggregate |
| `get_referral_patient` | jsonb | **entity-keyed** (gate `can_read_referral_phi`; single `referral_patient where referral_id = arg`) | ✓ **spot-checked** — single keyed read |
| `triage_disposition` | SET | **entity-keyed** (gate `can_read_event`; `event_triage where event_id = arg`; `pqs_department where organization_id = org_of_event(arg)`) | ✓ **spot-checked** — single-row, entity-pinned |
| `get_referral_detail` | jsonb | **entity-keyed** (gate `can_read_referral`/`_phi`) | reviewed iter-1 (BUG-NSP-002 guard) |
| `patient_trajectory_bundle` | jsonb | internal helper, **no own gate → `service_role`-only** (M1) | reviewed iter-1/2 |

`capa_kpis` was the sole offender in this class, and it is fixed. The class is empty.

### Iteration-2 delta verdict (all resolved at iter-3)

| Item | iter-1 | iter-2 status | Evidence |
|---|---|---|---|
| **M1** `patient_trajectory_bundle` over-grant | MAJOR | **RESOLVED** ✓ | grants now `postgres`+`service_role` only; `authenticated` EXECUTE = `f`; direct call by a plain staffer → `permission denied`; the 3 DEFINER doors still work (`search_patient_xref` as pqs.b = matchCount 2). `152 §M1` guards it. |
| **M2a** `capa_viewer_can_manage` | MAJOR | **RESOLVED** ✓ | rebound to `can_read_capa AND can_write_capa` — **per-entity, org-correct**: pqs.a (org-a capa) = `true`, pqs.b (cross-org) = `false`. |
| **M2b/M3** `capa_kpis` (sweep-found) | (not in iter-1) | **RESOLVED** ✓ at iter-3 (`5f4baf5`) | iter-2 gate fixed but result global → M3; **iter-3 result set org-scoped** (`in_scope` CTE incl. overdue subquery; non-event fallback aligned with `can_write_capa`). Proven 1→1; `143 §M3` guard. |
| **I1** `dispose_case_phi` bare `is_admin()` | INFO (deferred) | **RESOLVED** ✓ (folded in per human) | rewrite → `is_staff_admin_of OR is_org_admin_of_commission(commission_of_case(...))`. Persona-verified: platform_admin **DENIED**, cross-org org_admin.b **DENIED**, case-org org_admin.a **ALLOWED**. `151 §I1` guards it. |

### M3 (was MAJOR, NEW in iter-2 → **RESOLVED at iter-3**) — `capa_kpis()` returned GLOBAL cross-org counts (gate fixed, result set was not org-scoped). *Full closure detail in the iteration-3 section above; original finding retained below for the record.*
- **Where:** `supabase/migrations/20260630000000_nsp_per_org.sql` (the M2 fix block, `capa_kpis`
  re-creation). Consumed by `src/lib/queries/capa.ts:448` (`getCapaKpis()` — the NSP-dashboard headline).
- **What:** the fix swapped the dropped `app.is_pqs_member(auth.uid())` for `app.is_pqs_member_of_any(auth.uid())`,
  but that clause is a **non-correlated boolean gate**, not a result filter:
  `… from public.capa_plan p where app.is_pqs_member_of_any(auth.uid())` lets **every** row through
  for any-org PQS member, and the `overdue_actions` subquery counts `public.capa_action` with **no
  org filter at all**. There is no `org_of_event(event_of_capa(p.id)) = <caller's org(s)>` predicate
  anywhere. So a rede-a PQS member's CAPA KPIs include **rede-b's** plans/actions.
- **Impact (proven live — the seed hides it, the body leaks it):** the seed has only one (org-a)
  CAPA plan, so the headline reads `open_count = 1` and looks fine. Injecting one **rede-b**
  event-sourced `capa_plan` (status `em_execucao`) in a rolled-back txn makes `pqs.a`'s
  `capa_kpis().open_count` rise **1 → 2** — pqs.a is now counting rede-b's CAPA workload. Cross-org
  aggregate info-leak.
- **Severity rationale (MAJOR):** PHI-free (counts only), so not a BLOCKER. But it violates the
  exact org-isolation posture multi-tenancy established when it re-scoped `commission_overview` +
  the 6 `dashboard_*` RPCs platform→org (`…626000`). A cross-org aggregate is still a tenant-isolation
  breach (one customer inferring another's CAPA volume/overdue load). And it is a **regression of
  this fix**: pre-fix the function errored (dead/unreachable); post-fix it is reachable AND global.
- **Why the green suite missed it:** `175_dropped_symbol_sweep` (the new permanent invariant) asserts
  only that **no body references a dropped symbol** — `capa_kpis` now references the valid
  `is_pqs_member_of_any`, so `175` is correctly green. **No test asserts the `capa_kpis` *result set*
  is org-scoped.** This is precisely the gate-fixed ≠ body-scoped gap.
- **Fix (engineer/lead choice — either closes it):**
  1. **Caller's-orgs scope (keep the no-arg signature):** filter the plan count to
     `app.org_of_event(app.event_of_capa(p.id)) = any(array(select organization_id from public.pqs_members where user_id = auth.uid()))`,
     and the `overdue_actions` subquery likewise via its action→capa→event→org. **Must** add an
     explicit any-org branch for **non-event-sourced** plans (indicator/audit/meeting/manual →
     `event_of_capa` NULL → org NULL), mirroring `can_write_capa`'s polymorphic branch, or those
     plans silently drop out of the headline.
  2. **Explicit `p_org_id` (sub-phase-B treatment):** add an org param like
     `search_patient_xref`/`patient_access_audit` did, gate on `is_pqs_member_of(p_org_id)`, scope
     the count to that org. Aligns with the per-org NSP console sub-phase B will build (and
     `getCapaKpis()` would take the route's org). **Recommended** if the dashboard is going per-org
     anyway — but then `getCapaKpis()` (`capa.ts:448`) must pass the org.
- **Add a pgTAP guard** (the missing assertion class): with a rede-a and a rede-b CAPA plan present,
  `capa_kpis()` as a rede-a-only PQS member must **not** count the rede-b plan. This is the result-scope
  analog of the `175` reference-scope invariant.

---

## Findings (iteration 1 — context; M1/M2a/I1 now resolved per the table above)

### BLOCKER
*(none)*

### MAJOR

#### M1 — `patient_trajectory_bundle` newly GRANTed to `authenticated` is an un-gated cross-org PHI-linkage door (regression introduced by this phase)
- **Where:** `supabase/migrations/20260630000000_nsp_per_org.sql:2089-2104` (the `DO $g$` grant loop
  lists `'app.patient_trajectory_bundle(text, text, uuid)'` → `GRANT ALL … TO authenticated`).
  Function body: same migration `:1802-1876`.
- **What:** `app.patient_trajectory_bundle(p_patient_key, p_encounter_key, p_org_id)` has **no
  authorization check of its own** — it trusts its three public callers
  (`search_patient_xref` / `get_patient_trajectory_for_entity` / `patient_access_audit`), which
  each gate on `is_pqs_member_of(<org>)` *before* calling it. This phase changed the helper's arity
  (2-arg → 3-arg) and, in doing so, **granted the new 3-arg helper to `authenticated`**. The
  original 2-arg helper (`…019000:991-992`) was deliberately `REVOKE ALL FROM PUBLIC; GRANT … TO
  service_role` **only** — never `authenticated`.
- **Impact (proven live):** any authenticated user who holds a `patient_key` can call the helper
  **directly**, bypassing the enrollment gate, for **any** org:
  - as `pqs.a` (enrolled rede-a only) → `patient_trajectory_bundle(<rede-b key>, null, rede-b)` returns `matchCount = 2` (cross-org).
  - as `staff1.ccih` (a plain rede-a staffer, **not PQS anywhere**) → same call returns `matchCount = 2`, `entries = EV-0001, ENC-0003` (the rede-b event + referral codes, their commission names, disposed flags, match basis).
  This is precisely the enrollment gate the phase exists to enforce, made bypassable by exposing the
  helper the gated doors delegate to.
- **Severity rationale (why MAJOR, not BLOCKER):** the leaked payload is **key-only linkage
  metadata** (entity codes / commission names / counts), not identifiers — `patient_xref` is by
  design "NOT a PHI store" (Rule 12; `…019000` table comment). The input `patient_key` is a
  non-reversible SHA-256 hash, and `app.derive_patient_key(text)` is **NOT** callable by
  `authenticated` (verified `has_function_privilege = f`), so a key cannot be trivially forged from
  a guessed MRN through the DB. The attacker must already hold the hash. Still a deliberate
  QPS-gated, org-scoped surface reachable by any authenticated user → MAJOR.
- **Fix:** remove `'app.patient_trajectory_bundle(text, text, uuid)'` from the `authenticated`
  (and `service_role` is sufficient) grant block — restore the `…019000` posture
  (`GRANT … TO service_role` only; no `authenticated`). **Verified safe:** the 3 public callers are
  `SECURITY DEFINER OWNER postgres`, so they invoke the helper as `postgres` regardless of the
  invoker's grant. I revoked the grant in a transaction and confirmed (a) `search_patient_xref` as
  `pqs.b` still returns `matchCount = 2`, and (b) the direct call by `staff1.ccih` then fails
  `permission denied for function patient_trajectory_bundle`. One-line change; no door regresses.
- **Also add a pgTAP guard** (the class `173`/`152` miss): a non-enrolled `authenticated` user
  calling `app.patient_trajectory_bundle(<key>, null, <org>)` directly must be denied — the
  bundle-delegation analog of the `150`/`145` metadata-reader guards.

#### M2 — `capa_viewer_can_manage` still calls the dropped global `app.is_pqs_writer()` → broken function + per-org NSP writer loses the manage signal (off-inventory; unrebound)
- **Where:** function defined in `…009000:1697`; this phase **drops** `app.is_pqs_writer()` at
  `…630000:2216` but **never re-creates `capa_viewer_can_manage`**. Live body (unchanged):
  `select app.can_read_capa(p_capa_id, auth.uid()) and app.is_pqs_writer();`
- **What:** `app.is_pqs_writer()` no longer exists, so the function **errors at call time**:
  `ERROR: function app.is_pqs_writer() does not exist`. It is **off the §A.2 write-gate inventory**
  (which lists the 8 `*_write` policies, `assert_capa_writable`, `advance_capa_action_core`,
  `open_capa_plan` — but not this one) and absent from the migration and every pgTAP file.
- **Impact (proven live + reachable):** it is wired into the query layer — `src/lib/queries/capa.ts:145`
  does `supabase.rpc('capa_viewer_can_manage', …)`. That caller destructures `{ data }` only and
  ignores `error`, so the raw error is swallowed and `viewerCanManage` silently computes **`false`
  for everyone**. Net effect: (a) a per-org NSP writer who legitimately *can* manage a CAPA plan
  has the manage affordance incorrectly hidden — a functional regression that contradicts the
  phase's intent; (b) a broken function returning a raw Postgres error on the `error` channel is a
  latent landmine for any future/other caller that *does* check `error`.
- **Fix:** `CREATE OR REPLACE` `public.capa_viewer_can_manage(p_capa_id uuid)` with the per-org
  writer term, consistent with the `can_write_capa` consolidation this phase introduced:
  `select app.can_read_capa(p_capa_id, auth.uid()) and app.can_write_capa(p_capa_id, auth.uid());`
  (`can_write_capa` already handles the event/rca per-org vs non-event any-org branch). Add a pgTAP
  assertion: an enrolled per-org writer gets `true`, a cross-org NSP member gets `false`.

### MINOR
*(none)*

### INFO

#### I1 — `dispose_case_phi` carries a bare `is_admin()` cross-tenant PHI-erasure arm (pre-existing; out of this phase's two-module scope — flagged for the pending scope decision)
- **Where:** live `public.dispose_case_phi(uuid,text)` gate is
  `if not (app.is_staff_admin_of(v_case.commission_id) or app.is_admin())` (origin `…019000:845`;
  also re-created during the multi-tenancy `…626000` rewrite, which left the `is_admin()` arm).
- **Reachability:** the **case_patient** module flag is **ON** in the canonical seeded DB
  (`…624130000` flips all flags `true`, overriding the module's "ships OFF" intent), and the RPC is
  reachable from `src/lib/cases/actions.ts:673`. The sole `is_admin` holder is the vendor
  `platform@test.local`, which holds **zero** commission/org memberships — so the `is_admin()` arm
  IS its only tenant reach. Net: the vendor `platform_admin` can erase **any org's** case PHI,
  contradicting ADR 0042 dec. 5 / ADR 0041's vendor-walling.
- **Why INFO, not a blocker on this phase:** NSP-per-org's declared scope is the **two PHI
  modules it owns** (patient-safety/NSP + referrals). It correctly walled its own
  `dispose_event_phi` (now `is_org_admin_of_commission OR is_pqs_member_of(org)`, no bare
  `is_admin` — verified). `dispose_case_phi` belongs to the **case_patient** module (ADR 0038),
  which is not in this phase's brief. The mandate asked me to confirm whether this is a live
  cross-tenant path: **it is** (write/erase, reachable, flag ON). Recommend the lead either pull it
  into this phase or open a tracked follow-up to re-scope it to
  `is_org_admin_of_commission` (mirroring the `dispose_event_phi` fix). `set_case_patient` (the PHI
  *write*) is clean — `is_staff_admin_of` only, no `is_admin`.

#### I2 — `patient_xref_select_pqs` RLS / `can_read_xref_row` are dead for `authenticated` (defense-in-depth only); design §D item 7 is untestable as written
- `patient_xref` has `REVOKE ALL … FROM authenticated` (`…019000:977`); the live grants show only
  `postgres`/`service_role` hold table SELECT. The RLS `SELECT` policy this phase rebinds
  (`can_read_xref_row`) therefore never filters a real `authenticated` read — all reads go through
  the DEFINER doors. This is intended belt-and-suspenders, not a defect, and the rebind is faithful.
  But design `§D` keystone 7 ("direct `patient_xref` SELECT as `pqs_a` returns only rede-a rows") is
  **not achievable** (the grant is revoked) and `173` correctly does not attempt it — the design doc
  overstates what is testable here. No code change; note for doc accuracy.

#### I3 — `is_admin` sweep summary (every live occurrence, classified)

| Occurrence (live function) | `is_admin` role | Classification | Severity |
|---|---|---|---|
| `app.is_admin()` / `app.is_admin_for(uid)` | the predicate itself | platform-mgmt primitive | n/a |
| `app.audit_write(…)` | internal system/null-actor handling | legitimate (audit infra) | INFO |
| `public.verify_audit_chain(comm, org)` | **platform-tier** branch only (`comm` NULL + `org` NULL ⇒ global chain); commission/org tiers use `is_staff_admin_of`/`is_org_admin_of` | legitimate platform-management | INFO |
| `public.get_referral_detail(referral)` | **comment only** — explicitly documents NOT folding `is_admin()` into the originator exemption; live gate clean | correct (no live `is_admin`) | ✓ |
| `public.list_referral_target_commissions(comm)` | **comment only** — notes `…626000` dropped the `is_admin()` arm; live gate is `is_staff_admin_of` + same-org filter | correct (no live `is_admin`) | ✓ |
| `public.dispose_event_phi(event, reason)` | **none** — rebound to `is_org_admin_of_commission OR is_pqs_member_of(org)` | correct (vendor-walled, org-scoped) | ✓ |
| `public.dispose_case_phi(case, reason)` | **live gate** `is_staff_admin_of OR is_admin()` | **cross-tenant PHI erase** (case_patient module) | **I1** |
| `public.set_case_patient(…)` | **none** — `is_staff_admin_of` only | correct | ✓ |
| `public.get_case_patient(…)` | **none** — `can_read_case_patient` | correct | ✓ |

Conclusion of the sweep: the **only** bare-`is_admin` tenant/PHI path is `dispose_case_phi` (I1),
and it is pre-existing + out of this phase's module scope. No `is_admin` leak was introduced by, or
left within, the two modules this phase owns.

---

## What I verified is correct (the security core holds)

1. **Residual-term sweep — ZERO survivors.** Live DB: `app.is_multi_org()`, `app.is_pqs_member(uuid)`,
   `app.is_pqs_writer()` all **dropped** (0 each). No RLS policy references them. The **only**
   surviving body reference to any dropped predicate is `capa_viewer_can_manage` (→ M2).
2. **Read-door rebinding — complete & cross-org-isolating** (probed live as the seeded personas,
   incl. doors `173` does not exercise):
   - `can_read_event` / `can_read_event_patient` / `event_current_custodian` / `can_write_rca` /
     `can_read_capa` / `can_write_capa` — pqs.a true on org-a, **false** cross-org; symmetric for pqs.b.
   - `get_patient_trajectory_for_entity` (entity-pivot; **not in 173**): pqs.a own A-event = 3 entries,
     B-event/B-referral = 0; pqs.b own B-event = 2, A-event = 0.
   - `patient_xref_count` (**not in 173**): pqs.a A-referral = 2, B-referral = 0; pqs.b B-referral = 1.
   - `get_referral_detail` cross-org (the BUG-NSP-002 surface): pqs.a on rede-B referral **raises**
     "encaminhamento não encontrado" (broad gate denies). PHI bodies remain `can_read_referral_phi`-gated
     (the `150` regression guard confirms all three bodies).
3. **Org resolvers fail CLOSED:** `org_of_event/referral/commission(<unknown>)` = NULL ⇒
   `is_pqs_member_of_for(NULL, …)` = **false** (deny). No fail-open path. The `can_write_capa`
   `event_of_capa IS NULL` → `is_pqs_member_of_any` fallback only fires for PHI-free
   indicator/audit/meeting/manual plans (none event-linked; the only seeded plan is rca-sourced).
4. **Duty separation (three-way) enforced:** org_admin.a **direct** `pqs_members` INSERT →
   RLS-denied ("violates row-level security policy"); coordinator-only RPC gate (42501 for
   org_admin/cross-org coordinator/plain member — `145`/`173`); coordinator NOT a reader until
   enrolled (`173` §9). `dispose_event_phi` fully vendor-walled.
5. **Cross-org referrals FORBIDDEN (live):** rede-a coordinator referring a rede-a case to a rede-b
   commission → raises "o encaminhamento deve permanecer dentro da mesma organização";
   `list_referral_target_commissions` for CCIH returns no rede-b commission.
6. **Single-org byte-identical collapse:** 140/141/142/143/151/152 fully green under the seeded
   bootstrap (one-org ⇒ per-org term = "is enrolled").
7. **Storage:** all 4 `nsp-evidence`/`capa-evidence` object policies carry **no** `is_admin` and ride
   the rebound predicates; `capa_evidence_obj_insert_writable` rebound to
   `is_pqs_writer_of(org_of_event(seg[1]))`.
8. **PHI write doors org-correct:** `set_event_patient` gates on `event_current_custodian` (rebound);
   `set_referral_patient` on `can_read_referral_phi` (rebound) — both deny cross-org.
9. **The 3 prior fixes hold:** BUG-NSP-001 (cross-org referral forbid) live-confirmed; BUG-NSP-002
   (`get_referral_detail` 3-body gating) guarded by `150` and live-confirmed; BUG-NSP-003 region
   covered by the `145 §H` event PHI-door matrix (broad-non-PHI reader → NULL from `get_event_patient`,
   exactly one audit row).

---

## Independent verification (probes I ran)

Local stack reset clean through `…630000` + seed. pgTAP run via the project's `00_setup.sql`
(`pgtap` installed into `public`) inside the `supabase_db_*` container.

- **pgTAP:** 173 (53/53), 145 (34/34), 150 (44/44); single-org 140 (35), 141 (44), 142 (32),
  143 (31), 151 (35), 152 (39) — all green, 0 failures.
- **Dropped-predicate existence + body/policy reference sweep** (live `pg_proc`/`pg_policies`):
  found exactly one survivor → M2.
- **`is_admin` body sweep** over `app`/`public`/`storage` plain functions → the I3 table.
- **Cross-org door probes** as fixed-UUID personas (`set local role authenticated` +
  `request.jwt.claims`), incl. the four doors absent from `173`.
- **Org-resolver NULL fail-closed** checks.
- **`patient_trajectory_bundle` direct-call bypass** (M1): reproduced the leak as `pqs.a` and as a
  plain non-PQS staffer; then proved the one-line revoke closes it while the DEFINER doors keep
  working.
- **Duty-separation + cross-org-referral-forbid** live repro.
- Confirmed the sole `is_admin` holder (`platform@test.local`) carries zero commission/org rows
  (so `dispose_case_phi`'s `is_admin()` arm is a genuine cross-tenant reach).

### Iteration-2 independent verification (`19bb30a`; `db reset --local` clean)
- **pgTAP (live):** 151 (38/38, +3 §I1), 152 (43/43, +4 §M1), **175 (4/4 catalog invariant)**,
  173 (53/53), 145 (34/34), 143 (34/34, +3) — all green. Matches the tester's 1069/1069 (+14).
- **`175` read & assessed:** correctly guards the *dropped-symbol-reference* class permanently
  (calibrated bare-vs-`_of` regex; test 4 prevents vacuous pass). It does **not** assert
  result-scoping — which is why M3 passes it. Good invariant; just not the one M3 needs.
- **M1 resolved:** `app.patient_trajectory_bundle` grants = `postgres`/`service_role` only,
  `authenticated` EXECUTE = `f`; direct call by `staff1.ccih` → `permission denied`; `search_patient_xref`
  as pqs.b still = matchCount 2 (DEFINER path intact).
- **M2a resolved (per-entity, org-correct):** `capa_viewer_can_manage('ca…a3')` = `true` for pqs.a,
  `false` for pqs.b.
- **M3 (NEW) proven:** read the live `capa_kpis` body — `where app.is_pqs_member_of_any(auth.uid())`
  is a non-correlated gate; injected one rede-b event-sourced `capa_plan` → pqs.a `open_count` 1 → 2.
- **I1 resolved:** persona matrix on `dispose_case_phi` — platform_admin DENIED / cross-org
  org_admin.b DENIED / case-org org_admin.a ALLOWED.

### Iteration-3 independent verification (`5f4baf5`; `db reset --local` clean)
- **pgTAP (live):** 143 (38/38, incl. §M2 + §M3 result-scope guards), 173 (53/53), 145 (34/34),
  151 (38/38), 152 (43/43), 175 (4/4) — all green. Matches the tester's 1073/1073 (+4).
- **M3 body read + proven:** live `capa_kpis` body org-scopes via the `in_scope` CTE incl. the
  `overdue_actions` `join in_scope`; pqs.a stays `open=1 overdue=0` after a rede-b plan+overdue-action
  injection (was 1→2); pqs.b sees own-org; non-PQS = all zeros.
- **Non-event fallback ⇔ `can_write_capa`:** a `manual` plan is counted-by ⇔ writable-by the same
  any-org members; no new any-org leak.
- **Independent class sweep:** 9 DEFINER set/jsonb doors over the 5 PHI tables — each org-filtered or
  entity-keyed; spot-checked `get_event_patient` / `get_referral_patient` / `triage_disposition` bodies
  (single keyed reads, no hidden aggregate); broadened pass over indirect readers → 0 additional doors.

## Required changes
**None.** All iteration-1/2 findings (M1, M2, M3, I1) are resolved and independently re-verified.
APPROVED — sub-phase A backend security core is closed.

### Resolution log
- ~~**M1**~~ (iter-2) `patient_trajectory_bundle` locked to `service_role`-only; bypass closed; `152 §M1`. ✓
- ~~**M2** (`capa_viewer_can_manage`)~~ (iter-2) rebound to `can_write_capa`; per-entity org-correct. ✓
- ~~**M3** (`capa_kpis`)~~ (iter-3, `5f4baf5`) result set org-scoped incl. overdue subquery; non-event
  fallback aligned with `can_write_capa`; proven 1→1; `143 §M3` result-scope guard. ✓
- ~~**I1**~~ (iter-2) `dispose_case_phi` walled (`is_admin()` → `is_org_admin_of_commission(commission_of_case)`);
  persona-verified; `151 §I1`. ✓

### Note for the lead (not blocking)
`docs/backend-state.md` still reads pgTAP "1029" — stale; actual is **1073**. (Lead is reconciling at
the Record step — flagged here only so it isn't lost.)

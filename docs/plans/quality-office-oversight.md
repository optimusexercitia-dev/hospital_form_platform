# Quality-Office Oversight Program — Implementation Plan

**Decision record:** ADR [0100](../decisions/0100-quality-office-oversight.md) (read it
first — decisions D1–D14 are PO-ratified, do not re-litigate). **Status:** planned,
implementation NOT started. **Written:** 2026-08-06, by the lead session that ran the
PO interview. **Audience:** the lead session that executes this, and its teammates.

> ⚠ **Binding methodology (CLAUDE.md graphify exception / ADR 0078):** every quoted
> function body below was read from the LIVE catalog on 2026-08-06
> (`docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres`).
> **Re-read each body from `pg_get_functiondef` at authoring time** — migration file
> text is stale by design, and migrations land between now and then. Markers:
> **[V-CAT]** verified against live catalog · **[V-SRC]** verified in source/tests ·
> **[INF]** inferred, confirm at build time.

---

## Phase A — classification + `quality_reviewer` + UI (pilot-blocking)

### A.1 Migrations (7, sequenced after the highest registered version at build time; was `20260910000400` on 2026-08-06)

**M1 — `quality_reviewer_role.sql`.** [V-CAT] `memberships_role_check` is a 9-role
ANY-array; `memberships_scope_shape` is a CASE-per-role (nsp_coordinator arm: org+hosp
NOT NULL, commission NULL). Drop/re-add both with `'quality_reviewer'` + a mirrored
scope arm. Add `app.is_quality_reviewer_of(uuid)` / `_of_for(uuid,uuid)` mirroring
`is_nsp_coordinator_of/_for`: `app.is_active(u) AND app.has_role('hospital', h,
'quality_reviewer', u)` — `has_role`/`has_role_any` already filter `expires_at` [V-CAT].

**M2 — `commission_quality_oversight.sql`.** [V-CAT] `commissions` has no such column
today. Add `quality_oversight text NOT NULL DEFAULT 'excluded' CHECK (quality_oversight
IN ('visible','excluded'))`. Door `public.set_commission_oversight(p_commission_id,
p_oversight)` SECURITY DEFINER — copy the `set_case_visibility` discipline exactly
[V-CAT]: authority FIRST (`app.is_hospital_admin_of(c.hospital_id) OR
app.is_org_admin_of(c.organization_id)` → 42501/HC0F5-class), then validation, GUC
bracket (new `app.in_commission_rpc`), explicit `app.audit_write(
'commission.oversight_changed', 'commission', …)` (PHI-free metadata), `REVOKE … FROM
PUBLIC` before `GRANT authenticated, service_role`. Guard trigger
`app.guard_commission_oversight()` `BEFORE UPDATE OF quality_oversight ON commissions`
testing `new IS DISTINCT FROM old AND NOT v_in_rpc` (copy `guard_case_visibility`'s
is-distinct-from discipline verbatim — an unchanged-value UPDATE must not trap).

**M3 — `role_doors_quality_arm.sql`.** [V-CAT] `app.grant_role_impl` /
`app.revoke_role_impl` are per-(scope,role) arm chains ending `else raise … HC0G0` — so
`quality_reviewer` is **rejected today (fail-closed, RED-provable before the change)**.
Insert `elsif p_scope_type = 'hospital' and p_role = 'quality_reviewer'` in BOTH impls,
authority = the technical_director shape [V-CAT]: `app.is_org_admin_of_for(v_org,
p_actor) OR app.is_hospital_admin_of_for(p_scope_id, p_actor)` — deliberately **no
`is_admin_for`** (D9), minus DT's physician/one-titular checks. Self-grant denial is on
every existing path — preserve it. **Also (D9/Flag-3): add `p_expires_at timestamptz
DEFAULT NULL`** plumbed `grant_role → grant_role_for → grant_role_impl` (default keeps
existing PostgREST callers valid). Enforcement is already universal
(`has_role_any`, `session_context`, `end_affiliation_impl` [V-CAT]) but **no door sets
`expires_at` today** — only these impls + `assign_member_title` write `memberships`
[V-CAT]. Phase C's break-glass (D14) rides this seam. **Re-emit both impls from LIVE
`pg_get_functiondef`, diff old-vs-new to prove only-intended edits** (the Stage-B
discipline; a REBUILD silently loses properties — check ACLs survive).

**M4 — `case_caps_quality_arm.sql`.** [V-CAT as of 2026-08-06 — MUST re-read
`pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure)` at authoring; the body
diverges heavily from migration text]: STEP 2 `if not app.is_active(p_uid) then return
0`; STEP 4 hard-denies `is_case_respondent` then `is_recused_from_case` before every
arm (note: `app.is_case_excluded` = exactly that disjunction [V-CAT], so the new arm
inherits the exclusion + is_active + fail-closed-unknown-case by construction); `v_eg
:= (v_policy = 'explicit_grants_only')`; arms S6/S1/S2/S5/S3/S4. **Add S7 after S5:**

```sql
if not v_eg
   and app.is_quality_reviewer_of_for(app.hospital_of_commission(v_commission), p_uid)
   and (select quality_oversight from public.commissions where id = v_commission) = 'visible' then
  v_caps := v_caps | app._cap_bit('read_case_content') | app._cap_bit('view_case_overview');
end if;
```

No deliberation/PHI/write bits (D4/D5/D7). Confirm `app.hospital_of_commission` exists
[INF] — else inline the `commissions.hospital_id` read. Propagation is automatic:
`cases_select` = `app.can_read_case(id, auth.uid())` → `has_case_capability(…,
'read_case_content')` [V-CAT]. **Update the in-body S3 comment** claiming
`view_case_overview` is "RESERVED … coordinator-only" — D3 deliberately widens it; pin
with a keystone.

**M5 — `dashboard_quality_arm.sql`.** [V-CAT] There are **NINE** `dashboard_*` DEFINER
doors (not the six of ADR 0041-era prose), all gated `is_staff_admin_of OR
is_commission_admin_of` (`dashboard_form_totals` takes `p_commission_id`; the rest
derive it from `p_form_id`). Return shapes split them: **six aggregates** get the arm —
`distributions`, `entity_references`, `form_totals`, `matrix_cells`, `risk_scores`,
`submissions_over_time`; **three row-level stay closed** — `export_rows`, `free_text`,
`completion_by_member` (D11). One helper `app.can_read_quality_dashboards(
p_commission_id)` = `is_quality_reviewer_of(hospital_of_commission(cid)) AND
quality_oversight = 'visible'`, OR-ed into exactly the six. ⚠ **pgTAP
`supabase/tests/270_authz_dashboard_gate_uniformity.sql` self-enumerates dashboard
doors from `pg_proc` and asserts ONE uniform gate [V-SRC] — rewrite it to the
two-class contract in the SAME wave or it goes red by design (never revert the arm to
appease it).**

**M6 — `tenancy_policies_quality_arm.sql`.** [V-CAT] Reviewer is invisible to the org
shell today: `commissions_select_member_or_admin` (member/org_admin/hospital_admin/
pqs_operator/nsp_org_admin arms only), `hospitals_select` (admin arms only),
`organizations_select` (relies on commission-join `is_org_member`). Add:
commissions += `OR (app.is_quality_reviewer_of(hospital_id) AND quality_oversight =
'visible')`; hospitals += `OR app.is_quality_reviewer_of(id)`; organizations += new
`app.is_quality_reviewer_in_org(id)`. **Do NOT widen `is_org_level_admin_within`** —
its explicit role list feeds admin surfaces [V-CAT].

**M7 — `quality_board_door.sql`.** New `public.quality_board_summary(
p_organization_id)` SECURITY DEFINER: per oversight-visible commission of hospitals
the caller reviews → commission ref, readable-case counts, and the **PHI-free locked
count** (`visibility_policy = 'explicit_grants_only'` rows are RLS-invisible to the
reviewer, so only a DEFINER door can count them — D6). Gate: ≥1 unexpired
quality_reviewer membership in the org, else 42501. Board rows reuse
`public.list_cases_board(p_commission_id, p_limit)` — per-row `app.can_read_case`
filter with an explicit "never re-add a short-circuit" contract [V-CAT]; reviewer rows
appear automatically once M4 lands.

**Then:** `npm run gen:types` (Rule 8).

### A.2 Threading surface (the "new arm must inherit every sibling" list)

**Must change:** `grant_role_impl` / `revoke_role_impl` · `_case_caps` · the six
aggregate dashboard doors + new helper · `commissions_select_member_or_admin` /
`hospitals_select` / `organizations_select` · pgTAP 270's contract.
**⛔ THE MISSING AXIS (added 2026-08-07 — this list was INCOMPLETE BY CONSTRUCTION).**
Everything below enumerates arms that must CHANGE. It has no axis for **who already
CONSUMES the bit being conferred** — and conferring `read_case_content` on S7 enrolled
the reviewer into every existing consumer of that bit. That leaked three times (M8
bytes · M9 `open_attachment` · M10 three write doors + five read families). Before
conferring a bit, derive its consumer set from the live catalog by PROPERTY (transitive
closure over comment-stripped `prosrc` AND `pg_policies`) and classify PER DOOR — 11 of
14 DML doors in that closure were safe for per-door reasons a blanket predicate would
have broken. Standing rule recorded in ADR 0100.

**Must NOT change (verify no accidental inclusion):** `is_org_level_admin_within`
[V-CAT] · `eligible_voters` (commission-scoped; reviewer rows have commission NULL —
confirm body [INF]) · `memberships_select` (hospital arm already exposes reviewer rows
to admins for roster UIs [V-CAT]) · `session_context()` (role-generic, flows through
with zero SQL change [V-CAT]) · the three row-level dashboard doors.
**Silent-ignore watchlist:** TS `CommissionRole = 'staff' | 'staff_admin'` unions
([session.ts](../../src/lib/queries/session.ts) ~L33,
[members.ts](../../src/lib/queries/members.ts) ~L16) — the reviewer must be a **flag**,
never a member role, or `role === 'staff_admin'` write gates open [V-SRC] ·
`casos/[caseId]/page.tsx` ~L72 `if (!access || access.role === null) notFound()`
[V-SRC] — without the viewer branch the reviewer 404s despite DB access ·
`list_org_people` / roster UIs need a pt-BR label for the new role string ·
`trg_audit_memberships` is role-generic [INF — confirm].

### A.3 Frontend (~16–18 files; precedent: the NSP console)

- [session.ts](../../src/lib/queries/session.ts): `SessionContext` += a
  `qualityReviewerOf` filter block (the file documents "adding a role means adding a
  FILTER here" [V-SRC]); new cached `getQualidadeAccessByOrg(orgSlug)` mirroring
  `getNspAccessByOrg`; `getCommissionAccessByOrgUncached` gains the viewer branch —
  member/commission-admin checks unchanged, else if reviewer of
  `commissionRow.hospital_id` → `{ role: null, isQualityViewer: true }` (new field on
  `CommissionAccess`). Precedent is the org_admin→'staff_admin' mapping ~L458–474, but
  **the viewer must NOT map to an existing role**.
- Case pages: widen the `!access` gate in
  `src/app/o/[org]/c/[commission]/casos/[caseId]/page.tsx` (and
  `narrativa/[narrativeId]/page.tsx` [INF]) to accept `isQualityViewer`; write
  affordances flow from the DB capability descriptor — verify each write control
  renders disabled/absent for the viewer.
- New route group `src/app/o/[org]/qualidade/`: `layout.tsx` (server gate →
  `notFound()`, hospital switcher as `?hospital=` filter — mirror
  [nsp/layout.tsx](../../src/app/o/%5Borg%5D/nsp/layout.tsx) [V-SRC]), `page.tsx`
  (cross-committee board + locked-count chips), `dashboards/page.tsx`,
  loading/error/not-found.
- New `src/lib/queries/quality.ts` (Rule 9): `quality_board_summary` wrapper,
  `list_cases_board` fan-out, reuse `src/lib/queries/dashboard.ts` for aggregates.
- New `src/components/quality/*` (reuse commission dashboard chart components) + nav:
  `qualidadeHref()` in [routing.ts](../../src/lib/routing.ts) (mirror `nspHref` ~L73),
  sidebar entries, and the oversight toggle in `/o/[org]/manage/comissoes`
  (`src/components/org/org-commission-list.tsx`) calling `set_commission_oversight`.
- pt-BR user-facing text (Rule 10); **invoke the `frontend-design` skill before new
  screens**.

### A.4 Seed (`supabase/seed.sql`)

Personas (password `Test1234!`, direct membership inserts like siblings, update the
header roster comment): `quality.a@test.local` (reviewer, Hospital Central A / Rede A) ·
`quality.a2@test.local` (second-hospital scoping fixture) · `quality.b@test.local`
(Rede B — cross-org isolation fixture). Oversight fixtures: CCIH → `'visible'` inside a
`set_config('app.in_commission_rpc','on',true)` bracket (mirror the seed's
`app.in_case_rpc` usage ~L852 [V-SRC]); Farmácia B stays `'excluded'` (denial fixture);
the seeded ethics `explicit_grants_only` case is the locked-case fixture.

### A.5 Verification (Phase Gate §6)

- **pgTAP** (next free numbers; were 306–310 on 2026-08-06): membership shapes +
  grant/revoke arm positives AND negatives (nsp_org_admin / staff_admin / foreign-admin
  / self-grant / HC0G0) + expiry · oversight door authority/validation/guard-trigger
  raw-write block (+ unchanged-value non-trap) + audit row + M6 policy arms · the
  exact-bitmask keystone for S7 + **ZERO** on excluded-commission / locked /
  expired / deactivated / respondent / recused / cross-org + `can_read_case_patient`
  stays false · dashboard two-class contract (six positives, three still-42501) ·
  board door gate + locked-count correctness + PHI-free shape. ~120–160 assertions.
- **Mutation audit** `q1-quality-mutation-audit.sh` (mirror
  `w4-technical-director-mutation-audit.sh`), 6 RED-proven cases: strip S7 → positives
  red · force `is_quality_reviewer_of_for` true → negatives red · neutralize door
  authority → red · no-op the guard trigger → raw-write keystone red · force
  `can_read_quality_dashboards` true → negatives red · neutralize the grant arm →
  negatives red. Restore + byte-compare per the p0 harness discipline.
- **ARM gates** (ADR 0079): new DEFINER doors enter `ARM=census` automatically (the
  arm that catches a gate you just added); keystones keep `ARM=floor` green; **never**
  add the new gates to the authz allowlists; per Amendment 5 the write-path sweep is a
  frozen list — scope `set_commission_oversight` in explicitly. **Diff-scoped door
  sweep** over the changed/new set: `set_commission_oversight
  is_quality_reviewer_of(_for) is_quality_reviewer_in_org can_read_quality_dashboards
  quality_board_summary grant_role_impl revoke_role_impl _case_caps` + the six
  dashboard doors + the three M6 policies.
- **E2E** `e2e/quality-oversight.spec.ts` (`cachedSignIn`; reach-not-row-count
  discipline per `e2e/cases-board-access.spec.ts` [V-SRC]): board renders for
  quality.a with locked-count chip · case opens read-only on the commission case page
  (assert specific write affordances ABSENT and specific content PRESENT) · excluded
  commission absent + its case URL 404s · locked case URL 404s · quality.b reaches
  nothing in Rede A · admin toggles oversight and the board updates. Keyboard-only
  flow per house rule.
- **Perf (A5-style):** S7 costs one indexed memberships probe + one commissions PK
  read per non-matching row, placed after the cheap short-circuits. Measure
  `list_cases_board` (in-body baseline note: ~44 ms @ p_limit=100 / 205 cases [V-CAT])
  and a `cases_select` scan before/after on the seeded fixture; record in the gate.

## Phase B — org_admin content wall (before pilot data accumulates)

A4 is the template (ADR 0078 / authz-handoff §5): ① catalog-driven inventory of every
org_admin AND hospital_admin row-level content arm (policies + DEFINER doors;
`responses_admin_all` is the headline) — **per-policy content-vs-configuration
judgement, no text-filter population** · ② **PO ratifies the classification list
before any migration** · ③ subtractive migration(s), re-emitting bodies from live
`pg_get_functiondef` · ④ A/B equivalence matrix over a reachability population (LOST =
only the intended cells, GAINED = 0) · ⑤ mutation audits + sibling pgTAP relocations ·
⑥ aggregates (dashboard doors) and admin nouns are explicitly KEPT.

## Phase C — lifecycle + break-glass (before commercial sale)

- **Lifecycle (D13):** `memberships.status` + `status_reason`; filter added ONCE in
  `has_role`/`has_role_any` (+ catalog sweep of the ~5 direct `memberships`-reading
  functions [V-CAT count as of 2026-08-06: 18 total, 13 already expiry-aware]);
  `suspend_role`/`reinstate_role` doors, mandatory reason, audited; revocation stays
  delete.
- **Break-glass (D14):** `break_glass_requests` table (requester, org scope, reason,
  approval, expiry, status) + notifications; the access itself is a customer-granted
  membership/case-grant with `expires_at` via the M3 seam. No new predicate arms.

## Process

- Execution via the agent-team process (backend/frontend/tester/qa) under the
  CLAUDE.md §6 phase gate; this plan + ADR 0100 feed the teammates' briefs.
- PROGRESS.md: add the program section when execution starts (lead-owned).
- Local-first. Remote lands with explicit user approval — note the already-owed
  AFF+MIN `db push` precedes or accompanies it.
- Sizing: 7 migrations (+ types regen) · 5 new pgTAP suites + 1 rewritten (270) · 1
  mutation script + sweeps · 1–2 E2E specs · ~16–18 FE files.

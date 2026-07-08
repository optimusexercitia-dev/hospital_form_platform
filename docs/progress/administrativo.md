# Administrativo delegated-capability role — task detail (archived)

Feature: a coordinator (`staff_admin`/`admin`) may appoint any staff member of their
commission as an **"Administrativo"** and grant a curated, finite capability menu
(`schedule_meetings`, `create_cases`, `assign_case_phases`, `view_signoffs`) without
handing out full `staff_admin` authority. No new role enum — authority is fully
decoupled from the display-only "Secretário" title. Ships behind the OFF-by-default
`administrativo` feature flag.

- **ADR:** [0061](../decisions/0061-administrativo-delegated-role.md).
- **Plan/handoff:** [administrativo-delegated-role.md](../plans/administrativo-delegated-role.md).
- **QA review:** [administrativo-review.md](../reviews/administrativo-review.md) —
  **APPROVED** (0 BLOCKER · 0 MAJOR · 0 MINOR · 3 INFO), 2026-07-08.
- **Completed / merged:** 2026-07-08. Branch `feat/administrativo-role` →
  `feat(roles): add Administrativo delegated-capability role (ADR 0061)` (`75c903f`) +
  `fix(cases): phase assignment grants case READ, not write (revert ADR 0061 auto-grant)`
  (`3956b32`) → merged to `main` (`1010f07`).

## Backend

- **New objects:** `commission_administrativos` + `commission_administrativo_capabilities`
  (SELECT-only DEFINER-door tables, audited appoint/grant/revoke); helpers
  `app.member_can` (flag-aware kill switch), `app.assert_administrativo_enabled`,
  `app._grant_case_access_unchecked`.
- **RPCs:** `appoint_administrativo(p_commission_id, p_user_id)`,
  `revoke_administrativo(…)`, `grant_member_capability(p_commission_id, p_user_id, p_capability)`,
  `revoke_member_capability(…)`, `update_case_meta(p_case_id, p_label, p_department_id, p_department_other)`.
- **Query helpers:** `listAdministrativos(commissionId)`, `listMemberCapabilities(commissionId)`
  (`src/lib/queries/members.ts`); `administrativo` added to `FeatureFlags`.
- **Widened surfaces** (each gated by the specific capability, never OR'd into the
  coordinator-only `FOR ALL` write policies): `create_case`/`create_case_from_template`
  (`create_cases`), `create_meeting` (`schedule_meetings`), `activate_phase`/`reassign_phase`
  (`assign_case_phases`), `list_signoff_queue`/`get_response_for_signoff` (`view_signoffs`),
  `list_cases_board` (any capability, filtered to `can_read_case`).
- **Escalation closed by construction:** appoint/grant gated
  `is_staff_admin_of OR is_commission_admin_of` + `app._deny_self_grant` — a holder can
  never appoint/grant; stays plain `staff`.
- **Migrations** `20260714000000`–`…000300`:
  1. `administrativo_capabilities` — core tables/helpers/RPCs, flag seeded OFF.
  2. `administrativo_cases_board` — widens `list_cases_board` (was coordinator-only)
     to any caller's `can_read_case` rows.
  3. `create_case_grant_creator` — closes the creator-visibility gap: `create_case`/
     `create_case_from_template` self-grant the non-coordinator creator a `case_access`
     row (originally `write`, **later revised to `read`** — see design revert below).
  4. `signoff_read_view_capability` — widens `get_response_for_signoff` gate 2 to admit
     `view_signoffs` holders (was staff_admin-only; the queue list was already widened
     in migration 1 but drill-in 404'd until this fix). Read-only; `sign_section`/
     `can_sign_section` untouched.
- **Design revert (product-owner decision, 2026-07-08 — final shipped model):** phase
  assignment (`activate_phase`/`reassign_phase`) NO LONGER auto-grants `case_access`
  **write** to the assignee. Final model: assignment gives phase-form write
  (`assigned_to`) + case **READ** (`can_read_case` assignee arm) only; a non-coordinator
  case creator also gets **READ** (was write). The coordinator's explicit
  `grant_case_access` stays the sole case-content-write path. `_grant_case_access_unchecked`
  retained (used by `grant_case_access` + the creator read-grant).
- **pgTAP** `supabase/tests/205_administrativo.sql` → **50/50** (final). Covers: 4-cap
  appoint/grant/revoke; flag-aware dormancy (§K, kill-switch proof); creator
  read-not-write; assignee read-not-write, no `case_access` row on activate/reassign;
  `view_signoffs` queue + drill-in read-only, no sign; NEG boundaries (conclude/cancel/
  set-outcome/appoint/grant all rejected for a holder).
- Remote `db push` deferred — all 4 migrations were local-only as of the phase gate
  (consistent with the "merge-first, deploy-at-pilot" pattern used across this batch of
  pre-pilot features).

## Frontend

- **Manager UI:** 4 server actions in `src/lib/members/actions.ts` (appoint/revoke/grant/
  revoke-capability, mirroring `authorizeStaffOps` + revalidate); `member-administrativo-controls.tsx`
  (appoint toggle + 4-capability checklist + PHI note on `create_cases`) wired into
  `member-list.tsx` (Administrativo badge; `staff_admin` "coordenador já possui" note) +
  `manage/members/page.tsx`.
- **Edit-meta (single audited door):** `updateCaseMeta` action (`src/lib/cases/actions.ts`)
  → `update_case_meta` RPC, no client pre-gate (RPC self-gates all 3 arms). New
  `edit-case-meta-dialog.tsx` (label + `CaseDepartmentField`, prefillable). Rendered in
  both the coordinator `(detail)/layout.tsx` header and the staff-route
  `case-detail-view.tsx` header, gated `canInCommission(access,'create_cases')`.
- **Affordance gating** (all via `canInCommission`): meetings `NewMeetingButton` →
  `schedule_meetings`; `manage/cases` route + `CreateCaseDialog` → `create_cases`;
  `coordinator-phase-actions.tsx` split — activate/reassign → `assign_case_phases`
  (skip + "Ver respostas" stay coordinator-only) via `canAssignPhases`; `assinaturas`
  queue + review screen admit `view_signoffs` read-only (sign stays `staff_admin`-gated).
  Board links per caller standing: `CasesView`/`CasesTable`/`CasesKanban` take a plain
  `staffCaseRoute` boolean so a non-coordinator Administrativo's board rows link to the
  staff route `casos/[id]` while coordinators keep `/manage/cases/[id]`.
- `getCommissionAccessByOrg` (`src/lib/queries/session.ts`) returns
  `capabilities: MemberCapability[]` + `isAdministrativo: boolean` + exports
  `canInCommission(access, cap)` + `CommissionAccess`.

## Bugs found + fixed (see archived Bug Log)

- **BUG-ADM-001 (MAJOR, RESOLVED 2026-07-07):** `activatePhase`/`reassignPhase`/
  `createCase`/`createCaseFromTemplate` (+ the same-class shadow in `createMeeting`)
  still pre-gated on the coordinator-only `authorizeCommission`, shadowing the widened
  DEFINER RPCs before they were reached. Fixed by dropping the pre-gate (mirroring
  `updateCaseMeta`'s already-correct pattern) and letting the RPC's `member_can` gate be
  the sole authority; a rejection maps to `mapCaseError`/`mapMeetingError` → clean pt-BR
  "forbidden". `skipPhase`/`addAdHocPhase` keep their pre-gate (never widened, coordinator-only
  by design).

## Gate

- Build complete — tsc 0 · eslint 0 (new errors) on both backend and frontend.
- Test pass — `e2e/administrativo.spec.ts` (10 tests, all 4 capabilities + boundaries +
  manager UI + keyboard) + updated `cases-meetings-minor.spec.ts` A1 — **10/10 + 1/1**,
  0 failures, on a fresh `next build` (standalone) + `supabase db reset --local`. pgTAP
  205 → 50/50. Full run history (incl. the BUG-ADM-001 repro run and the post-design-revert
  re-run) → `docs/progress/test-run-archive.md`.
- QA — **APPROVED** 2026-07-08, 0 BLOCKER/MAJOR/MINOR, 3 INFO (internal-helper open
  EXECUTE — app-schema, safe; creator self-grant fires for global admin too — harmless;
  reassign leaves the previous assignee's grant — documented deferral, see follow-ups
  below).
- Human approval — 2026-07-08 (merged to `main` via `1010f07`).

## Deferred (non-blocking, carried forward)

- **Reassign leaves the previous assignee's `case_access` grant in place** (QA INFO,
  documented in the ADR §9 deferral). Not a security issue (grant is read-only under the
  final model) — revisit only if stale-access hygiene becomes a real complaint.

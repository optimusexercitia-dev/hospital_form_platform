# QA Review — "Administrativo" delegated-capability role (ADR 0061)

**Reviewer:** qa · **Date:** 2026-07-08 · **Branch:** `feat/administrativo-role`
**Verdict:** ✅ **APPROVED** — 0 BLOCKER · 0 MAJOR · 0 MINOR · 3 INFO

Scope: the 4 new migrations (`20260714000000`–`…000300`), `seed.sql`, the frontend
delegation surface + affordance gating, and the two new server-action/query modules.
Read-only audit against the ADR-0061 handoff (`docs/plans/administrativo-delegated-role.md`
§2 locked decisions + §5 leak guardrails) and Architecture Rules 1/10/11/12.

---

## 1. Requirements (§2 locked decisions) — all delivered

| Locked decision | Status | Evidence |
|---|---|---|
| Curated finite menu, per-member | ✅ | `commission_administrativo_capabilities.capability` CHECK = the 4 keys; DB CHECK mirrored in `grant_member_capability` and in the TS `CAPABILITIES` const (`members/actions.ts` L54, `member-administrativo-controls.tsx` L28). |
| Explicit appointment (may hold 0 caps) | ✅ | `commission_administrativos` is a standalone appointment row; capabilities are a child FK table. `isAdministrativo` is appointment-row presence, independent of `capabilities`. |
| Capabilities layered on `staff` (no new enum) | ✅ | `appoint_administrativo` requires `role='staff'` (`…000000` L300-306); no `commission_members.role` change. |
| The 4 keys | ✅ | `schedule_meetings`, `create_cases`, `assign_case_phases`, `view_signoffs` everywhere. |
| Meetings = manage all (create-only shipped, detail deferred, DB supports it) | ✅ | `create_meeting` gate widened + `meetings_staff_admin_write` broadened (USING+WITH CHECK) — the policy already admits detail management; deferral documented in PROGRESS/handoff. |
| Cases: create + edit-meta, NEVER conclude/cancel/outcome | ✅ | `create_case*` gate widened; new `update_case_meta` touches only label/department; `close_case`/`cancel_case` explicit coordinator-only gate, no `member_can`; `set_case_outcome` untouched. |
| Phase assignment auto-grants assignee `case_access` write | ✅ | `activate_phase`/`reassign_phase` call `app._grant_case_access_unchecked(…, 'write')` (flag-gated on `case_access`). |
| view_signoffs read-only | ✅ | `list_signoff_queue` + `get_response_for_signoff` read arms widened; `sign_section`/`can_sign_section` untouched. |
| Off-by-default flag | ✅ | `administrativo` seeded `false` by the migration; `member_can` flag-aware. |

## 2. Security / RLS — all 10 guardrails honored

1. **`member_can` NOT OR'd into `cases_staff_admin_write` / `case_phases_staff_admin_write`** — verified: grep over all four `2026071400*` migrations finds no reference to either policy except an explanatory comment. Both `FOR ALL` policies are left untouched.
2. **`close_case`/`cancel_case` explicit coordinator gate, no `member_can`** — `…000000` G7/G8: `is_staff_admin_of(v_commission) OR is_commission_admin_of(v_commission)` only, resolved via `app.commission_of_case`; INVOKER retained.
3. **`can_write_case_content` NOT taught "assignee ⇒ writer"** — untouched; the auto-grant is an explicit, auditable, revocable `case_access` ACL row via `_grant_case_access_unchecked`.
4. **`sign_section`/`can_sign_section` UNTOUCHED** — confirmed absent from all migrations (only a comment). Signing stays coordinator-only.
5. **All new gates use `is_commission_admin_of`** (org_admin OR hospital_admin) — every new/edited gate uses it; the narrower `is_org_admin_of_commission` appears nowhere in the new migrations.
6. **Escalation guard** — appoint/grant/revoke RPCs gate `is_staff_admin_of OR is_commission_admin_of`; `appoint_administrativo` also calls `_deny_self_grant`. A capability holder is a plain `staff` member → fails both arms → can never appoint/grant. Self-grant on `grant_member_capability` is additionally impossible (the appointment-first FK requires a `role='staff'` appointment, which a coordinator cannot hold). Frontend `authorizeStaffOps` mirrors the gate as defense-in-depth.
7. **DEFINER-only-door tables + PHI-free audit** — both tables: RLS enabled, SELECT policy only (`is_staff_admin_of OR is_commission_admin_of OR user_id=auth.uid()`), `revoke insert/update/delete/truncate from authenticated`, SELECT-only grant; the guarded RPCs are the sole write path. `trg_audit_administrativo(_capabilities)` fire AFTER INSERT/DELETE and copy only user_id/commission_id/capability — no answer/PHI payload (Rule 11).
8. **`update_case_meta`** updates ONLY `label`/`department_*`; never status/outcome/closed/PHI; blocks terminal cases (HC025) before the write; re-validates department shape + hospital ownership. `guard_case_status` permits this non-status update on a non-terminal case, and `audit_cases_trg` (AFTER INSERT OR UPDATE on `cases`) audits it (Rule 11).
9. **`member_can` flag-aware kill switch** — checks `app.feature_enabled('administrativo')` first; seed leaves the flag OFF, so the seeded `staff2.ccih` persona is dormant. pgTAP §K explicitly proves the holder is blocked with the flag off while the coordinator arm stays live.
10. **`list_cases_board` widen + creator self-grant add no read authority** — board non-coordinator arm filters to `app.can_read_case(c.id, v_uid)` (existing read boundary, no new arm); creator self-grant is gated `not (is_staff_admin_of OR is_commission_admin_of)` AND `feature_enabled('case_access')`, routed through the auditable ACL rather than a new `can_read_case` creator arm.

## 3. Code quality

- **pt-BR error mapping / no raw Postgres leak:** `members/actions.ts` maps every RPC error to a fixed `MESSAGES.generic`; `cases/actions.ts::updateCaseMeta` routes through `mapCaseError`. No raw error surfaces.
- **No service-role in client / RPC path:** the delegation actions use the RLS-scoped cookie client (`createClient`) so `auth.uid()` is the caller; the service-role `createAdminClient` is confined to `addStaff` (unchanged, appropriately gated). No `NEXT_PUBLIC_` service key.
- **`canInCommission` matches RPC authority:** `role === 'staff_admin' || capabilities.includes(cap)` mirrors the DB `is_staff_admin_of OR member_can` gate as defense-in-depth, not the boundary (page-level `notFound()`/RLS remain authoritative).
- **TS strict:** `MemberCapability` typed throughout; no unjustified `any` in the new modules.
- **Affordance split correct:** `coordinator-phase-actions.tsx` splits `canManageLifecycle` (coordinator-only skip + coordinator answer deep-link) from `canAssignPhases` (activate/reassign), so an assign-only Administrativo never gets the phase-settling "Não necessária".

## 4. PHI (Rule 12)

- No new PHI table or module; the enumerated PHI-module set is unchanged.
- `create_cases` PHI implication is recorded in ADR 0061 Consequences and surfaced in the manager UI: `member-administrativo-controls.tsx` L177-183 renders a pt-BR minimum-necessary/LGPD notice under `create_cases`, gated on `showPhiNotice` which the page derives from `casePatientEnabled()`.

## 5. Hygiene

- ADR 0061 present with full alternatives + consequences; handoff plan present.
- `member_can` and both tables carry explanatory `comment on`; leak guardrails restated in-migration.
- Seed persona documented as dormant-while-dark; PROGRESS.md reflects the out-of-phase build state.

## INFO (non-blocking observations)

- **INFO-1:** `_grant_case_access_unchecked` grants EXECUTE to `authenticated` with no authority gate of its own. Safe because it lives in the `app` schema (not PostgREST-exposed) and every caller gates first; consistent with the codebase's internal-helper convention and documented in its comment.
- **INFO-2:** The creator self-grant (`…000200`) also fires for a global `is_admin()` creator (they reach `create_case` as a non-coordinator). Harmless — a platform admin already has broad read — only a negligible audit-noise row; not worth gating tighter.
- **INFO-3:** `reassign_phase` intentionally leaves the previous assignee's auto-granted `case_access` write in place (handoff §9 least-privilege open item). Documented deferral, revisit if strict least-privilege is required.

## Gate inputs relied upon (spot-checked, not re-run)

pgTAP `205_administrativo.sql` 45/45 (positive + escalation negatives + kill-switch §K + board scoping + signoff read parity); full E2E 574 passed with 24 pre-existing BUG-AIF-001 Windows-standalone-prod artifacts (no Administrativo regressions); `administrativo.spec.ts` 10/10 green. I independently verified the leak guardrails, the DEFINER-door posture, the update-case-meta audit path, and the frontend gating against source.

# Plan / Handoff — "Administrativo" delegated-capability role (per commission)

> **Status:** DESIGNED, not started. This is a machine-to-machine handoff — everything
> needed to implement is here; no re-exploration required. Feature ships behind an
> **OFF-by-default** flag (`administrativo`). Not yet gated by the Phase process; treat as
> a self-contained feature phase. **ADR:
> [0061](../decisions/0061-administrativo-delegated-role.md)** (proposed — advance to
> accepted/implemented at the phase gate).
>
> **How to resume:** read §1–§3 for the *what/why*, §4 (Ground-truth object map) for the
> exact code locations, then execute §5 (backend) → §6 (frontend) → §7 (tests) in the order
> given. §8 is end-to-end verification.

---

## 1. Context & rationale

Committees need a helper for bureaucracy — scheduling meetings, opening cases, assigning
case phases to members, tracking signatures — **without** the full authority of the
committee coordinator (`staff_admin`). Today authority is a fixed two-tier enum
(`staff` / `staff_admin`); there is no way to delegate a *subset* of coordinator powers.

This adds an **"Administrativo"** appointment: a coordinator may appoint any `staff`
member of their commission as an Administrativo and grant them a **curated, finite** set of
capabilities from a fixed menu.

**Deliberately independent of member `title`.** `title` (Presidente, Vice-Presidente,
**Secretário(a)**, …) stays a pure display label with *zero* authority — it is NOT touched
by this feature. Rationale from the product owner: in real committees the "secretary" is
frequently the coordinator themselves, so the *title* "Secretário" and the *authority* to
do administrative work must be fully decoupled. "Secretário" remains nothing more than a
title, exactly as today. The delegated **authority** is the separate "Administrativo"
concept. A coordinator already holds every capability implicitly, so Administrativo only
means anything on a **non-coordinator `staff` member**.

Positioning note: `create_cases` on a PHI-bearing commission lets an Administrativo enter
and read patient context (via the case creator/assignee read arms). Minimum-necessary
(Rule 12) is satisfied by this being an *explicit, per-member, coordinator-granted*
capability behind an off-by-default flag — but the manager UI must state this plainly, and
the ADR must record it.

## 2. Decisions locked in (from the design interview)

| Decision | Choice |
|---|---|
| Configurability | **Curated finite menu, per-member** (not a fixed bundle, not an open ACL). |
| Representation | **Explicit appointment** — a member is Administrativo because they were *appointed* (a distinct row); may hold **zero** capabilities. NOT "derived from ≥1 cap". |
| Relationship to role/title | **Capabilities layered on a `staff` member**; no new role enum value; label comes from the new appointment, **never** from the title system. |
| Capability menu (the 4 keys) | `schedule_meetings`, `create_cases`, `assign_case_phases`, `view_signoffs`. |
| Meetings scope | Manage **all** the commission's meetings (no created-by restriction). |
| Cases scope | **Create + edit meta, but NEVER conclude or cancel** (and never set outcome). |
| Phase assignment → access | Assigning a phase grants the assignee the access to work it, **for every assignment (coordinators included)** — a deliberate behavior change (today assignment gives read-only). |
| Signatures | **View** the pending-signoff queue only; **never sign**. Real reminders depend on Phase-20 notifications; for now it is visibility only. |
| Rollout | OFF-by-default feature flag `administrativo`; ADR required. |

## 3. Governing principle — why this is not "just add a role"

`cases_staff_admin_write` and `case_phases_staff_admin_write` are `FOR ALL` policies that
govern **dangerous verbs** (case conclude/cancel/terminal-status; phase skip/complete)
right next to safe ones, and **`close_case` / `cancel_case` carry no internal authority
gate** — the table policy *is* their whole authority. So we **must not** OR a capability
check into those two policies. Instead we admit Administrativo only through **guarded
SECURITY DEFINER RPCs** whose bodies expose exactly the safe columns/verbs. This is the
established "guarded-DEFINER-door" pattern (see `20260713001300_assign_member_title_definer.sql`
and the DEFINER-only-door table posture in `20260711000000_membership_write_lockdown.sql`).
Only `meetings_staff_admin_write` (no PHI, no terminal transition) is safe to broaden directly.

---

## 4. Ground-truth object map (verified — do not re-explore)

**Role model & helpers** (all SECURITY DEFINER, `search_path` pinned):
- `commission_members` DDL + `role` CHECK (`staff`|`staff_admin`) — `supabase/migrations/20260620000000_baseline.sql` L18103–18110; `UNIQUE (commission_id, user_id)` L18851; `title_id` FK added in `20260709000100_commission_titles.sql` L51.
- `app.is_staff_admin_of(commission_id)` — baseline L3302; `..._for(commission_id,user_id)` L3318.
- `app.is_commission_admin_of(commission_id)` = **org_admin OR hospital_admin** — `20260709000200_commission_admin_predicate.sql` L69; `..._for` L89. **Use this** in every new gate (NOT the narrower `is_org_admin_of_commission` that some old policies still use).
- `app.is_member_of_for(commission_id,user_id)` — baseline L3129. `app.is_active(user_id)`, `app.feature_enabled(key)` L2064, `app.audit_write(...)` L1015.
- `app._deny_self_grant(...)` + blanket-audit + DEFINER-door table template — `20260711000000_membership_write_lockdown.sql` (audit trigger template L273–318).

**Title system (leave untouched):** `commission_member_titles` — `20260709000100_commission_titles.sql` L19–27; title is display-only, seeded `Presidente/Vice-Presidente/Secretário(a)`; `assign_member_title` RPC hardened to DEFINER in `20260713001300_assign_member_title_definer.sql` (the canonical guarded-DEFINER + t19 grant-hygiene template).

**Cases / phases / access** (baseline unless noted):
- `create_case` L8944 (gate `is_staff_admin_of OR is_admin`); `create_case_from_template` L9028.
- `close_case` L8198 (SECURITY **INVOKER**, **no internal gate** — relies on table RLS; conclusion gates inside: all phases settled L8222, outcome selected if offered L8231, no in-flight referrals L8240); `cancel_case` L7600 (same posture).
- `set_case_outcome` L14907 (INVOKER; carries its OWN `is_staff_admin_of OR is_org_admin_of_commission` gate). **No dedicated update-case RPC exists** — label/department edits currently ride the `cases_staff_admin_write` policy.
- `case_phases` table L5559 (`assigned_to` nullable, `status` pendente|ativa|concluida|nao_necessaria); `activate_phase(p_case_phase_id,p_assigned_to,p_due_date)` L5618 (INVOKER; checks `is_member_of_for(commission,assignee)`); `reassign_phase` L12595 (blocks when a response exists — HC019); `start_or_resume_phase` L15805 (gate literally `assigned_to = auth.uid()`).
- `case_access` table `20260620000000_baseline.sql` L17972 (PK `(case_id,user_id)`, `level` read|write; `expires_at`/`reason` added `20260708000000_case_access_expiry.sql`). `grant_case_access(case,user,level)` L11206 / repointed L474 in the expiry migration (gate `is_staff_admin_of OR is_org_admin_of_commission`; upsert on PK); `revoke_case_access` L14308.
- Access helpers (`20260708000000_case_access_expiry.sql`): `can_read_case` L61 (assignee ⇒ READ via `case_phases` EXISTS arm), `can_read_case_patient` L114 (assignee ⇒ PHI READ), `can_write_case_content` L165 (**does NOT include assignees** — governs documents/events/action-items/unassigned-narratives). **Key insight:** filling a phase's own form needs NO `case_access` grant (governed by `assigned_to = auth.uid()` + `answers_write_own_draft` L21258, `created_by = auth.uid()`); the access currently *missing* for an assignee is only case-level **content write** (`can_write_case_content`).

**Policies to be aware of** (baseline): `cases_staff_admin_write` L21593 (**FOR ALL**, uses `is_org_admin_of_commission`), `case_phases_staff_admin_write` L21541, `meetings_staff_admin_write` L21828, `answers_write_own_draft` L21258.

**Meetings & signoffs:** `create_meeting` RPC L9363 (gate `is_staff_admin_of OR is_org_admin_of_commission`); `list_signoff_queue(commission_id)` L11906 (DEFINER, gate `is_staff_admin_of`, returns `[]` otherwise); `response_section_signoffs` table L15623; `sign_section` RPC L15636 + `app.can_sign_section` (leave both untouched).

**Feature-flag plumbing:** `app.feature_flags` table baseline L17869; `app.feature_enabled` L2064; assert pattern e.g. `app.assert_quality_indicators_enabled()` in `20260712000000_indicators_core.sql`. Frontend: `src/lib/queries/feature-flags.ts` (hand-maintained `FeatureFlags` interface — add the new key).

**Frontend surfaces:**
- Access helper `getCommissionAccessByOrg()` — `src/lib/queries/session.ts` L349–427; returns `{ role: 'staff'|'staff_admin'|null, commission, organization, context }`. Consumers throw on `access.role !== 'staff_admin'`.
- Member management: `src/app/o/[org]/c/[commission]/manage/members/page.tsx` (gated L31–36) → `src/components/members/member-list.tsx` (role badge L85, title control L77–84, remove L86–95). Actions: `src/lib/members/actions.ts` — `addStaff` L98, `removeStaff` L167, `authorizeStaffOps` L59 (staff_admin of commission OR org_admin).
- Affordances to capability-gate: `NewMeetingButton` in `.../meetings/page.tsx` (rendered `{isCoordinator && …}` L73–80); `CreateCaseDialog` in `.../manage/cases/page.tsx` (L99,115); `src/components/cases/coordinator-phase-actions.tsx` (`canManageLifecycle` prop, `return null` L89–91; activate L124, reassign L174); signature queue page `.../manage/assinaturas/page.tsx` (gated L31–37) → `listSignoffQueue` (`src/lib/queries/signoffs.ts` L144–168).

**Query-layer conventions:** `src/lib/queries/{meetings,cases,members}.ts` — server client, `if (error || !data) return []`/`null`, PostgREST embeds under RLS, soft best-effort audit. `listAddableMembers` uses a DEFINER RPC because staff_admin has no blanket `profiles` SELECT.

**pgTAP:** `supabase/tests/00_setup.sql` (`test_helpers.bootstrap()` → JSONB of known IDs); `supabase/tests/40_rls.sql` (persona switch via `test_helpers.claims_for(uuid,false)` + `set local role authenticated`; `throws_ok(…, '42501', …)` for escalation; `144_case_access.sql`, `151_case_patient.sql` as feature-test examples). New file: `NNN_administrativo.sql`.

---

## 5. Backend — new migration `supabase/migrations/20260714000000_administrativo_capabilities.sql`

Execute in this order:

**A. Flag + assert.** `insert into app.feature_flags (key,enabled,description) values ('administrativo', false, …)`; `create function app.assert_administrativo_enabled() returns void` raising `check_violation` when disabled (shape of `assert_cases_enabled`).

**B. Tables (DEFINER-only-door: RLS SELECT policy only; no write policy; `revoke insert,update,delete,truncate … from authenticated`).**
- `public.commission_administrativos` — `commission_id`, `user_id`, `appointed_by`, `appointed_at timestamptz not null default now()`; `PRIMARY KEY (commission_id,user_id)`; composite FK `(commission_id,user_id) → commission_members(commission_id,user_id) ON DELETE CASCADE`; `appointed_by → profiles(id)`. SELECT policy `is_staff_admin_of(commission_id) OR is_commission_admin_of(commission_id) OR user_id = auth.uid()`.
- `public.commission_administrativo_capabilities` — `commission_id`, `user_id`, `capability text CHECK (capability IN ('schedule_meetings','create_cases','assign_case_phases','view_signoffs'))`, `granted_by`, `granted_at`; `PRIMARY KEY (commission_id,user_id,capability)`; FK `(commission_id,user_id) → commission_administrativos(commission_id,user_id) ON DELETE CASCADE` (a capability cannot exist without an appointment; un-appointing cascades). Same SELECT-only posture. (Name is `administrativo_*` to avoid confusion with the existing *case-access* "capabilities" concept.)

**C. Audit triggers** `app.trg_audit_administrativo()` + `app.trg_audit_administrativo_capabilities()` (AFTER INSERT/DELETE, DEFINER) emitting `administrativo.appointed`/`.revoked` and `administrativo_capability.granted`/`.revoked` via `app.audit_write(...)`; entity_id = `user_id` (no surrogate `id`), model on `trg_audit_commission_members` / `trg_audit_pqs_members`.

**D. Helper** `app.member_can(p_commission_id uuid, p_capability text) returns boolean` — STABLE, DEFINER, `search_path` pinned:
`select app.is_active(auth.uid()) and exists (select 1 from public.commission_administrativo_capabilities c where c.commission_id = p_commission_id and c.user_id = auth.uid() and c.capability = p_capability);`
t19 hygiene: `revoke all … from public; grant execute … to authenticated, service_role;`

**E. Internal** `app._grant_case_access_unchecked(case,user,level)` — DEFINER, **no** authority gate; extract the upsert body of `grant_case_access` and re-point `grant_case_access` to call it *after* its existing gate (external gate unchanged). Lets the phase RPCs grant access without tripping `grant_case_access`'s own caller gate.

**F. Appointment + capability RPCs** (guarded DEFINER; escalation guard = `is_staff_admin_of OR is_commission_admin_of`, so a holder can NEVER appoint/grant; `owner to postgres`; t19 hygiene):
- `appoint_administrativo(commission_id,user_id)` — assert flag; gate; require target `is_member_of_for(c,user)` AND `role='staff'` (never a leader); `_deny_self_grant(user)`; insert appointment.
- `revoke_administrativo(commission_id,user_id)` — same gate; delete (cascades capabilities).
- `grant_member_capability(commission_id,user_id,capability)` / `revoke_member_capability(...)` — same gate; validate capability against the finite list; upsert `on conflict do nothing` / delete (idempotent). FK guarantees appointment-first.

**G. ALTER existing objects** (body unchanged except the gate line; re-assert grant hygiene since `CREATE OR REPLACE` resets the ACL):

| Object | New authorization |
|---|---|
| `create_meeting` | `is_staff_admin_of(c) OR is_commission_admin_of(c) OR app.member_can(c,'schedule_meetings')` |
| `meetings_staff_admin_write` (policy) | `… OR app.member_can(commission_id,'schedule_meetings')` in USING **and** WITH CHECK |
| `create_case`, `create_case_from_template` | `… OR app.member_can(commission,'create_cases')` |
| **NEW** `update_case_meta(p_case_id,p_label,p_department_id,p_department_other)` | DEFINER; `assert_administrativo_enabled` when reached via cap arm; gate `is_staff_admin_of OR is_commission_admin_of OR app.member_can(c,'create_cases')`; block terminal status (HC025); update **only** `label`/`department_*` — never `status`, `outcome_id`, `closed_*`, or any PHI column; re-validate department shape like `create_case`. |
| `activate_phase` | **flip to SECURITY DEFINER**; gate `… OR app.member_can(c,'assign_case_phases')`; after the assignee UPDATE call `app._grant_case_access_unchecked(case, assignee, 'write')` |
| `reassign_phase` | **flip to SECURITY DEFINER**; same gate; grant new assignee `write` (see Open item on downgrading the previous assignee) |
| `close_case`, `cancel_case` | add explicit `is_staff_admin_of(v_commission) OR is_commission_admin_of(v_commission)` gate (resolve `v_commission` via `app.commission_of_case`), **no** `member_can` — defense-in-depth; keep INVOKER |
| `list_signoff_queue` | internal gate `is_staff_admin_of(c) OR app.member_can(c,'view_signoffs')` (empty set otherwise) |
| `set_case_outcome` | **UNCHANGED** (outcome is conclude-adjacent → coordinator-only) |
| `sign_section` / `app.can_sign_section` | **UNCHANGED** (signing stays coordinator-only) |

**H.** Broaden `meetings_staff_admin_write` per the table above (the one policy safe to open).

### Guardrails — do NOT do these (each leaks authority)
1. Never OR `member_can` into **`cases_staff_admin_write`** → grants `status`/`closed_*` UPDATE = conclude/cancel bypass (the RPCs have no other gate).
2. Never OR into **`case_phases_staff_admin_write`** → grants raw phase skip/complete, letting an Administrativo settle phases and unblock `close_case`'s gate-1.
3. Do **not** teach `can_write_case_content` "assignee ⇒ writer" — use the explicit, auditable, revocable `case_access` grant instead.
4. Never add `member_can` to `sign_section`/`can_sign_section` — `view_signoffs` is read-only by construction.
5. All new gates use `is_commission_admin_of` (org_admin OR hospital_admin), not `is_org_admin_of_commission`.

After the migration: `supabase gen types typescript --linked > src/lib/types/database.ts`.

## 6. Frontend

- **Manager UI** (coordinator-only; page already gated) in `manage/members/page.tsx` + `member-list.tsx`: per `staff` row, an appoint control ("Tornar Administrativo") + a capability checklist (the 4 keys); an **"Administrativo" badge** on appointed members; for `staff_admin` rows show a note ("coordenador já possui estas permissões") instead of the checklist. New server actions in `src/lib/members/actions.ts`: `appointAdministrativo`, `revokeAdministrativo`, `grantMemberCapability`, `revokeMemberCapability` (mirror `authorizeStaffOps`). All user-facing text pt-BR.
- **Extend `getCommissionAccessByOrg()`** (`src/lib/queries/session.ts`) to also return `capabilities: string[]` and `isAdministrativo: boolean`; add `canInCommission(access, cap) = role === 'staff_admin' || capabilities.includes(cap)`.
- **Affordance gating** — swap coordinator-only conditions for `canInCommission(access, <key>)`: `NewMeetingButton`→`schedule_meetings`; `CreateCaseDialog`→`create_cases`; `coordinator-phase-actions.tsx` **split `canManageLifecycle`** so activate/reassign is admitted by `assign_case_phases` while conclude/cancel stays coordinator-only; `manage/assinaturas` page admits `view_signoffs` holders read-only (no sign action for them).
- **Queries**: `listAdministrativos(commissionId)` / `listMemberCapabilities(commissionId)` for the manager UI (RLS-scoped, follow `members.ts`). Add `administrativo` to `FeatureFlags` in `src/lib/queries/feature-flags.ts`.

## 7. Tests

- **pgTAP** `supabase/tests/NNN_administrativo.sql` (persona switching per `40_rls.sql`):
  - Positive: coordinator appoints a `staff` member + grants each capability; the holder can create a meeting, create + edit-meta a case, activate/reassign a phase (assignee then gains `case_access` write), read the signoff queue.
  - Negative (escalation/boundary): a `staff`/holder cannot appoint or grant to self or others (`throws_ok … '42501'`); an Administrativo **cannot** `close_case`/`cancel_case`, cannot `update cases set status='concluido'` directly, cannot `sign_section`, cannot `set_case_outcome`, cannot grant a capability to an unappointed member.
- **E2E** (`e2e/`): an Administrativo persona performs the 4 actions and is blocked from conclude/sign. **Add the persona to `supabase/seed.sql`.** Update existing case/phase E2E for the assignment-grants-access behavior change.
- Gate: lint, typecheck, unit, then full E2E (`--workers=1`, fresh `supabase db reset`).

## 8. Verification (end-to-end)
1. `supabase db reset --linked` (migration + seeded Administrativo persona); regenerate types.
2. `supabase test db` — new pgTAP green (positive + every escalation negative).
3. `npm run lint && npm run typecheck && npm run test`.
4. Flip `administrativo` ON locally; `npm run dev`; as the Administrativo persona confirm: schedule a meeting, create + edit (not conclude) a case, assign a phase (assignee then has write), view the signoff queue; and conclude/cancel/sign affordances are absent and their RPCs reject with a pt-BR error.
5. Full `npx playwright test` (regression + new) green, `--workers=1`, fresh reset.

## 9. Open / deferred (minor)
- **Reassignment least-privilege**: whether `reassign_phase` downgrades the *previous* assignee's auto-granted `case_access` to `read` (strict) or leaves it (simple). Default: leave as-is; revisit if least-privilege is required.
- **Signature reminders**: real "nudge" depends on Phase-20 notifications; `view_signoffs` is visibility-only for now.
- **PHI/governance note for the ADR**: `create_cases` lets an Administrativo enter/read patient context on PHI-bearing commissions; minimum-necessary is satisfied by the explicit per-member grant, but the manager UI must state it.

## 10. Suggested task split (contract-first)
Backend posts RPC + query-fn signatures first, then implements: flag+assert → tables → audit → `member_can` → `_grant_case_access_unchecked` refactor → appoint/grant RPCs → close/cancel hardening → create/activate/reassign/list gate edits → meetings policy broaden → pgTAP. Frontend builds against the posted types (access-helper extension, manager UI, affordance gating). Then tester, then QA. The RPC gate changes + the two "leak" guardrails warrant a **full plan review** (new RLS shape + guarded-DEFINER doors). Flag stays OFF until frontend ships.

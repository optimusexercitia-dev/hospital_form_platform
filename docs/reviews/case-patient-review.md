# QA Review — `case_patient` (Third PHI Module; ADR 0038)

**Reviewer:** `qa` teammate  
**Date:** 2026-06-22  
**Commit audited:** `2accca7` (branch `feat/case-patient`)  
**Spec/plan:** `~/.claude/plans/option-b-considering-what-stateless-emerson.md`  
**ADR:** `docs/decisions/0038-case-patient-identifiers.md`  
**Migration:** `supabase/migrations/20260620017000_case_patient.sql`  
**pgTAP:** `supabase/tests/151_case_patient.sql` (35/35)  
**E2E:** `e2e/case-patient.spec.ts` (15/15, prod build)  
**Out-of-scope (not blockers):** `dispose_referral_phi` parity gap (pre-existing, tracked in ADR 0038); CN-APP-AC4 narrative-save revalidation bug (pre-existing on `main`).

---

## Verdict

**APPROVED** — 0 blockers, 0 majors, 2 INFO-only observations.

---

## 1. Requirements Audit — the 8 Locked Decisions

### Decision 1: Fixed 8-field identifier catalog, no custom-field engine

PASS. `public.case_patient` carries exactly `name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending` — the same 8 fields as `event_patient` / `referral_patient`. No custom-field machinery was added. Migration lines 117-130; `CasePatient` interface in `src/lib/cases/types.ts` mirrors field-for-field.

### Decision 2: `case_patient` 0..1 satellite — DML revoked, DEFINER writer, audited single read door

PASS.

- Table PK = `case_id` (0..1 enforced structurally). FK `→ cases(id) ON DELETE CASCADE`.
- `REVOKE ALL PRIVILEGES ON TABLE "public"."case_patient" FROM "authenticated"` at migration line 740. `authenticated` retains zero DML. `service_role` retains full access for administrative operations.
- RLS enabled (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`); SELECT policy `case_patient_select` on `can_read_case_patient` for defense-in-depth. No INSERT/UPDATE/DELETE policy means authenticated can never write even if the REVOKE were somehow bypassed.
- All writes go through `public.set_case_patient` (SECURITY DEFINER); `get_case_patient` is the single read door (SECURITY DEFINER, emits `case_patient.read` on a real entitled read, returns NULL on out-of-scope or absent record with no audit row).
- Audit trigger `trg_audit_case_patient_aiu` (AFTER INSERT OR UPDATE) emits `case_patient.updated` with `'{}'::jsonb` metadata — no identifier copied. pgTAP test 19 (metadata = `'{}'`) confirms this.
- Denormalized `has_patient bool NOT NULL DEFAULT false` on `cases`; flipped by `set_case_patient`, cleared by `dispose_case_phi`.

### Decision 3: Read predicate = broad `can_read_case` — deliberate divergence, documented

PASS. `app.can_read_case_patient(p_case_id, p_uid)` is a one-liner `SECURITY DEFINER` that calls `app.can_read_case(p_case_id, p_uid)` — the live QPS-term version defined in `20260620014000_referrals_rpcs.sql:48`. The divergence from the staff_admin+PQS predicates of the other two modules is commented in the migration header, in the table COMMENT, and in ADR 0038 §Decision 3. Architecture Rule 12 was updated to record it. pgTAP tests 15-19 assert the exact truth table: coordinator=TRUE, phase assignee=TRUE, admin=TRUE, unrelated commission member=FALSE, foreign coordinator=FALSE.

### Decision 4: Writes = coordinators only; editable; name-or-MRN floor in action layer

PASS.

- `set_case_patient` gates on `app.is_staff_admin_of(v_case.commission_id) OR app.is_admin()`. Assignees and case-write grantees are explicitly excluded. pgTAP test AC-3a-rpc proves assignee gets `42501`.
- Editable: upsert (`ON CONFLICT (case_id) DO UPDATE …`) with no terminal-status freeze block. The post-disposal check (`phi_disposed_at IS NOT NULL`) correctly blocks writes after LGPD disposal but not for any other case state.
- Name-or-MRN floor at `src/lib/cases/actions.ts:530-532`: `if (!input.name?.trim() && !input.mrn?.trim()) return { ok: false, error: MESSAGES.patientNameOrMrnRequired }`. The floor is action-layer only (the DB RPC has no floor), matching the documented pattern. The floor error message is pt-BR and user-readable. The distinction is documented inline.

### Decision 5: Per-template `collects_patient` toggle — draft-only, default OFF, snapshotted to `cases.patient_enabled`

PASS.

- `process_templates.collects_patient BOOL NOT NULL DEFAULT false` added at migration line 91.
- `set_template_collects_patient` DEFINER gates `status='draft'` (raises `check_violation` otherwise).
- `create_case_from_template` (CREATE OR REPLACE) reads `collects_patient` and snapshots it as `patient_enabled = coalesce(v_collects, false)` in the INSERT. `has_patient` stays `false` at creation. Migration lines 426-455.
- Feature flag ships OFF (`INSERT … ON CONFLICT DO NOTHING`). pgTAP tests 20-23 assert snapshot true/false and non-enabled write guard.
- E2E AC-1a/1b/8b cover the builder toggle and dialog conditional rendering.

### Decision 6: Reveal-on-demand detail header — audit fires on click, not on case open

PASS.

- `CasePatientPanel` (`src/components/cases/case-patient-panel.tsx`) renders a protected state with an "Exibir identificação" button. The `onReveal` prop (bound via `.bind(null, c.id)` in `case-detail-view.tsx:170`) is only called inside the `reveal()` click handler — never on mount, never on page load.
- `case-detail-view.tsx` does NOT call `revealCasePatient` at render time. Server Components render `has_patient` and `patient_enabled` (booleans; not PHI) but never the identifiers themselves.
- E2E AC-2a proves: opening the case detail page emits zero new `case_patient.read` rows and the PHI values are absent from the page HTML. AC-2b proves exactly one row is emitted on reveal click, metadata contains no PHI.

### Decision 7: Snapshot-copy prefill — case_patient preferred, event fallback; value copy

PASS.

- `getCaseSafetyEventPatientPrefill` in `src/lib/queries/referrals.ts:632-693` implements the precedence logic: (1) try `getCasePatient(caseId)` — emits `case_patient.read` via the audited door; (2) if null, fall back to the linked event's `getEventPatient` — emits `event_patient.read` via that door. Returns `{ source: 'case' | 'event', eventId, patient }`. Each module's isolation and disposal remain independent (value copy, no FK link).
- `loadCaseSafetyPrefill` bridge (`src/lib/referrals/actions.ts:419-424`) is a thin `'use server'` wrapper around `getCaseSafetyEventPatientPrefill`.
- `loadCasePatientForNotify` in `src/lib/cases/actions.ts:577-582` is a separate bridge for the NSP notify dialog — thin wrapper around `getCasePatient`. The notify dialog (`src/components/safety/notify-event-dialog.tsx:38`) accepts `onLoadPatientPrefill?: () => Promise<CasePatient | null>`, threaded from `case-detail-view.tsx:240-244` only when `showPatientPanel` (i.e., `casePatientEnabled && c.patientEnabled`).
- The `CaseSafetyPrefill` interface is a structural superset of the wizard's prior shape (`source` added; `eventId` kept non-nullable); existing wizard code compiles unchanged.

### Decision 8: `dispose_case_phi` — LGPD Art. 18 erasure, built now

PASS.

- Deletes `case_patient` row; NULLs `case_narratives.body_md` (nullable); REDACTs `case_events.body` to `'[PHI removido]'` sentinel (NOT NULL column). Migration lines 362-375.
- Stamps `has_patient=false`, `phi_disposed_at`, `phi_disposed_by`, `phi_disposed_reason` on `cases`. Migration lines 379-385.
- One-shot (`HC056`): `phi_disposed_at IS NOT NULL` check at line 352. Second call raises `HC056`.
- Constrained reason enum: `phi_disposed_reason` CHECK (`retention_expired | subject_request | entered_in_error | duplicate | other`). The RPC validates the reason before any DML (lines 346-349).
- Gate: `is_staff_admin_of(commission_id) OR is_admin()`.
- Audit emission: `app.audit_write('case_patient.disposed', …, jsonb_build_object('reason', p_reason))` — reason enum only, no PHI. Lines 388-392.
- Uses `set_config('app.in_case_rpc', 'on', true)` AND `app.in_narrative_rpc` to bypass status-freeze and narrative-freeze guards on terminal cases. Lines 359-361; reset at lines 394-395.
- pgTAP 151 tests 25-35 cover: non-coordinator `42501`, bad reason `check_violation`, happy path (row deleted, narrative NULLed, events redacted, stamps correct, has_patient false, audit metadata = reason-only), second call `HC056`.
- E2E AC-6a/b/c cover the same flows via RPC.

---

## 2. Security / RLS / PHI Review

### `case_patient` table isolation

The isolation posture is byte-identical to `event_patient` / `referral_patient`:

- `REVOKE ALL PRIVILEGES … FROM "authenticated"` is present and unambiguous (migration line 740, before any GRANT).
- RLS enabled; one SELECT policy on `can_read_case_patient`; no INSERT/UPDATE/DELETE policy (double defense).
- `service_role` granted SELECT/INSERT/UPDATE/DELETE for administrative operations.
- DEFINER trigger function `trg_audit_case_patient` is REVOKED from PUBLIC (defense-in-depth; trigger cannot be called directly).

All confirmed in pgTAP tests 1-2 (has_table_privilege authenticated=false for SELECT and INSERT).

### Read asymmetry

`get_case_patient` (the read door) gates on `app.can_read_case_patient` = `app.can_read_case` (broad). `set_case_patient`, `dispose_case_phi`, and `set_template_collects_patient` gate on `is_staff_admin_of OR is_admin` (coordinator-only). The asymmetry is intentional and documented (ADR 0038 Decision 3/4). A phase assignee CAN read (confirmed pgTAP + E2E AC-3a) but CANNOT write (pgTAP test 6 + E2E AC-3a-rpc).

### `log_audit_access` allow-list carry-forward

The replace in migration `20260620017000_case_patient.sql` carries forward all 11 verbs from the baseline (`20260620008000_audit.sql`) and the Phase-22 referral replace (`20260620014000_referrals_rpcs.sql`), then appends `case_patient.read`. Full enumeration verified:

Base (9): `response.opened_foreign`, `response.exported`, `audit.exported`, `event_patient.read`, `case.opened`, `safety_event.viewed`, `triage.viewed`, `rca.viewed`, `capa.viewed`, `meeting.viewed`, `interview.viewed`.  
Phase-22 addition (2): `referral_patient.read`, `referral.viewed`.  
This increment (+1): `case_patient.read`.  
Total: 12 verbs. No verb was dropped.

### `can_read_case_patient` wraps the live `can_read_case`

Confirmed: `app.can_read_case_patient` calls `app.can_read_case(p_case_id, p_uid)`. The called function is the QPS-term version (defined in `20260620014000_referrals_rpcs.sql:48`), which includes the `case_referrals`-flagged QPS early-return, the `case_access`-flagged assignee/grantee/narrative-attribution terms, and the pre-flag member fallback. The wrapper does NOT call a stale pre-referral definition.

### `get_case_patient` null-with-no-audit behavior

Verified at migration lines 288-298: case not found → return null (no audit); entitled but no row → return null (no audit); out-of-scope → return null at line 293 (no audit). Audit emitted only on an entitled read of an existing row. pgTAP tests 20-26 confirm the exact audit-row counts for each scenario.

### `dispose_case_phi` PHI safety

Audit row carries `{'reason': <enum>}` only. The `case_number` is embedded in the summary string (`'Dados do paciente do caso ' || v_case.case_number || ' descartados'`) — this is governance metadata (a sequential number, not a PHI identifier) consistent with how all other disposal audit rows work and consistent with ADR 0036's classification of `cases.case_number` as non-PHI governance data. PHI values are never in the audit metadata.

### `create_case_from_template` and `get_case_detail` replace regressions

Both are CREATE OR REPLACE over `20260620005000_cases.sql`. Audited against the plan's "only change" specification:

- `create_case_from_template`: the only delta is `collects_patient` read + `patient_enabled = coalesce(v_collects, false)` in the INSERT. The `case_access` re-gate (`can_read_case`), the `case.opened` audit log call in `get_case_detail`, the narratives/phases projections, the `case_access` flag branch at `get_case_detail` line 569-577, and the `viewer_capabilities` descriptor are all verbatim from the prior version. No regression introduced.
- `get_case_detail`: the only delta is `'has_patient', v_case.has_patient, 'patient_enabled', v_case.patient_enabled` added to the `jsonb_build_object`. The `case.opened` audit call at lines 582-586, the `can_read_case` re-gate at lines 569-577, and all projections (phases, narratives, offered_outcomes, viewer_capabilities) are verbatim.

### Flag-OFF posture

`set_case_patient`, `dispose_case_phi`, and `set_template_collects_patient` all call `app.assert_case_patient_enabled()` as their first line. `casePatientEnabled()` probe fails closed (returns `false` on any error). `showPatientPanel = casePatientEnabled && c.patientEnabled` means the panel is not rendered when the flag is off. E2E AC-8a/8b confirm no PHI block or panel renders with flag OFF. pgTAP flag-OFF tests confirm writers raise `check_violation`.

### PHI never copied into audit log

Confirmed at:
- Trigger `trg_audit_case_patient`: metadata = `'{}'::jsonb`. No field from `case_patient` table.
- `get_case_patient`: `log_audit_access(…, '{}'::jsonb)`. No identifier in metadata.
- `dispose_case_phi`: metadata = `jsonb_build_object('reason', p_reason)`. Reason enum only.

Rule 11 satisfied.

### No service-role key client-side

`SUPABASE_SERVICE_ROLE_KEY` in the E2E spec is used only in `beforeAll`/`afterAll` test infrastructure (PostgREST direct calls for seeding). It is read from `process.env` (loaded by `@next/env` via `.env.local`), never from `NEXT_PUBLIC_*`. Application code uses `createClient()` (cookie-session, RLS-scoped). No service-role key in any `src/` file.

### `case_patient` not selected on list/board/dashboard paths

`has_patient` (boolean, not PHI) and `patient_enabled` (boolean) are on `cases` and correctly included in board/detail queries. The actual identifier columns are on `case_patient`, which is never SELECTed inline — it is accessible only via `get_case_patient`. Confirmed: `listCasesBoard` at `src/lib/queries/cases.ts:799` selects `has_patient, patient_enabled` but not any join to `case_patient`. The `getCasePatient` function is explicitly documented as the only read path.

---

## 3. Code Quality

### TypeScript strict

No unjustified `any` in new files. The `as unknown as CasePatientJson` cast at `src/lib/queries/cases.ts:717` is the same JSONB-RPC narrowing pattern used throughout the file (e.g., lines 564, 627, 981) — a structural necessity because PostgREST returns untyped JSONB from RPCs. No `any` appears without this established justification.

### Rule 9 — data access through `src/lib/queries/`

`CasePatientPanel` and `CasePatientEditDialog` are "use client" components that import no server-only module. The reveal and save doors are injected as props via `.bind(null, c.id)` in `case-detail-view.tsx` (a Server Component), keeping the client bundle clean. `getCasePatient` lives in `src/lib/queries/cases.ts` (server-only); the only client exposure is through the `'use server'` action wrappers `revealCasePatient` and `loadCasePatientForNotify`.

`src/lib/cases/types.ts` has zero imports — the purity contract is maintained.

### Server Components by default

All host pages (`manage/cases/page.tsx`, `manage/cases/[caseId]/(detail)/page.tsx`, `casos/[caseId]/page.tsx`, `manage/process-templates/[templateId]/page.tsx`) are Server Components. The `'use client'` boundary is correctly placed at `CasePatientPanel`, `CasePatientEditDialog`, `CreateCaseDialog` (interaction-required), and `CollectsPatientPicker` (checkbox with optimistic toggle).

### pt-BR user-facing strings

All MESSAGES constants in `src/lib/cases/actions.ts` are pt-BR. UI copy in the panel, edit dialog, and builder toggle is pt-BR. No raw Supabase/Postgres error reaches the UI: `mapCasePatientError` prefers `error.message` (the RPC's own pt-BR text) and falls back to the generic pt-BR `MESSAGES.generic`.

### Accessibility

`CasePatientPanel`: section has `aria-labelledby`; the reveal button has accessible text; `Eye` icon is `aria-hidden="true"`. `CasePatientEditDialog`: uses `DialogHeader`/`DialogTitle`/`DialogDescription` (Radix pattern); form fields use the reused `PatientFields` component (which has labels and `aria-describedby`). `CollectsPatientPicker`: `<label>` wraps the checkbox with text; section has `aria-labelledby`; description text is wired via `aria-describedby`. E2E AC-7 proves the reveal button is keyboard-focusable and activatable, the edit dialog opens and closes via keyboard, and all controls have visible labels.

### Reuse over duplication

- `PatientFields` from `src/components/safety/patient-fields.tsx` is reused in: the create dialog, the coordinator edit dialog, and (via import) the NSP notify form. Not duplicated.
- `CasePatientPanel` is a near-copy of `referral-patient-panel.tsx` — justified because the panels serve different scopes and the copy avoids coupling two PHI modules. The delta (softened "denied" copy for the broad read scope, `CasePatient` types) is material and appropriate.
- `getCaseSafetyEventPatientPrefill` generalizes the existing event→referral prefill path rather than adding a parallel function.

### ADR exists for non-trivial choices

`docs/decisions/0038-case-patient-identifiers.md` records all 8 decisions including the deliberate divergence in read scope. Architecture Rule 12 updated ("two → three"). ADR 0033 Q13 reversal noted.

---

## 4. UX and Accessibility

- "Identificação do paciente" section heading is always visually and semantically present when `patientEnabled`.
- Protected state before reveal clearly warns "Os dados do paciente estão protegidos. Ao exibir, o acesso será registrado em seu nome." (audit awareness messaging).
- "Dados sensíveis" badge in the revealed state.
- "Acesso registrado em trilha de auditoria. Use apenas para o trabalho do caso (mínimo necessário)." — data minimization reminder.
- The "denied" state for rare out-of-scope readers ("Você não tem acesso à identificação do paciente deste caso.") is calm and informative, not a raw error.
- The label warning in the create dialog correctly distinguishes between the prohibited free-text label and the sanctioned PHI block: "Não inclua dados de paciente no rótulo (nome, prontuário, data de nascimento ou qualquer identificador). O caso é identificado pelo seu número." This no longer contradicts the structured PHI block below it.

---

## 5. Hygiene

- `PROGRESS.md` task table reflects reality (BE-1, BE-2, FE-1, FE-2, FE-3 all marked complete with supporting evidence).
- `feature_flags` row ships OFF (`INSERT … ON CONFLICT DO NOTHING`).
- No editing of prior migration files; forward-only additive `CREATE OR REPLACE` for cross-cutting functions.
- Types regenerated after migration (confirmed: `database.ts` carries `has_patient`, `patient_enabled`, `phi_disposed_at/by/reason` on `cases`; `collects_patient` on `process_templates`; `case_patient` table).

---

## INFO Observations (not blockers)

**INFO-1:** The `dispose_case_phi` summary string embeds `v_case.case_number` (e.g., `'Dados do paciente do caso 42 descartados'`). Case numbers are non-PHI governance metadata (classified non-PHI in ADR 0036; consistent with the `case.opened` audit summary pattern). This is correct per the established classification. No action required.

**INFO-2:** `set_case_patient` has no explicit flag-OFF check on the direct DB path when called through the audited-door test (`supabase.rpc('set_case_patient', …)`) in the E2E beforeAll — the flag is flipped ON first in `beforeAll`. The flag-OFF guard (`assert_case_patient_enabled()`) IS present as the RPC's first line and is pgTAP-verified. The E2E setup order is correct. No security implication; noting for completeness.

---

## Summary

All 8 locked decisions from ADR 0038 are implemented. The security posture is identical to the two prior PHI modules: isolated satellite table, authenticated DML revoked, DEFINER-only writes, single audited read door, PHI never copied into the audit log, disposal built. The deliberate broad-read divergence is documented and correctly implemented (read predicate = live `can_read_case`; write predicate = coordinator only). The `log_audit_access` allow-list carries all prior verbs forward without dropping any. The `create_case_from_template` and `get_case_detail` REPLACE functions are additive-only with no regressions. Code quality, accessibility, and pt-BR UX requirements are satisfied.

**Verdict: APPROVED**

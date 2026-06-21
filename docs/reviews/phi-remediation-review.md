# QA Review — PHI / HIPAA-Readiness Remediation

**Date:** 2026-06-20
**Reviewer:** qa (qa-reviewer)
**Increment:** PHI / HIPAA-Readiness Remediation (Workstreams 0, A, B, C, D, E)
**Tester result:** pgTAP 665/665; E2E remediation acceptance 9/9 (+2 pgTAP-covered skips); NSP 91/91; full core-platform regression green; db diff clean
**Verdict:** APPROVED

---

## Audit Scope

This review audits the security model for the PHI/HIPAA-readiness remediation
against the approved plan (`i-agree-with-everything-distributed-hartmanis.md`),
Architecture Rules 11–12, ADRs 0030/0031/0035/0036, and CLAUDE.md Rules 1/11/12.
Findings are keyed by the requirement they touch. The migration order is
`20260620009000_patient_safety.sql` (GRANT ALL on event_patient to authenticated)
followed by `20260620012000_grants_revoke.sql` (REVOKE ALL on event_patient from
authenticated) — verified by filename sort. Net effective privilege is the REVOKE.

---

## Security Model Findings

### WS A — Structured-Identifier Lockdown

**A1. Real PQS membership: SOUND.**
`app.is_pqs_member(uid)` is now `exists(select 1 from public.pqs_members where user_id=uid)`
(`patient_safety.sql:617`), backed by `public.pqs_members` (PK → `profiles`, admin-RLS
`pqs_members_admin_all`). The `is_admin_for` fallback is absent from the implementation.
`app.is_pqs_writer()` is `is_pqs_member(auth.uid())` with no `is_admin()` term
(`patient_safety.sql:628`). Both SECURITY DEFINER functions pin `search_path`. Seed correctly
enrolls the dev admin persona in `pqs_members` (`seed.sql:867`). The admin RPCs
`add`/`remove`/`list_pqs_members` are `is_admin()`-gated DEFINER functions with correct
re-check, matching the `assignStaffAdmin` pattern.

**A2. `can_read_event_patient` predicate: SOUND, including the NULL-custodian edge case.**
`app.can_read_event_patient(event_id, uid)` (`patient_safety.sql:180–202`) is
`is_pqs_member(uid) OR is_staff_admin_of_for(current_owner_commission_id, uid)` —
no `is_admin` term, no reporting-provenance term. The ADR 0036 comment
(`patient_safety.sql:187–190`) correctly documents that for PQS-held events
`current_owner_commission_id IS NULL` makes `is_staff_admin_of_for(NULL, uid)` false
(the `commission_id = p_commission_id` WHERE clause never matches NULL in SQL equality
semantics — confirmed at `identity.sql:94–100`). PQS-held events are therefore
correctly restricted to PQS members only.

**A3. `get_event_patient` — single audited door: SOUND and unbypassable.**
`public.get_event_patient(event_id)` (`patient_safety.sql:2819`) is SECURITY DEFINER
with `search_path` pinned to `'public', 'pg_catalog'`. It:
1. loads the governance event first (not PHI); returns null if event not found;
2. re-gates via `app.can_read_event_patient` — returns null with no audit row if out of scope;
3. queries `event_patient` (which it can do as DEFINER/owner = postgres); returns null with
   no audit row if no PHI row exists;
4. only then emits `event_patient.read` via `public.log_audit_access` with empty `{}` metadata
   (no PHI copied), attributed to `reporting_commission_id`, and returns `to_jsonb(v_patient)`.

The `log_audit_access` DB function has `event_patient.read` in its positive allow-list
(`audit.sql:613–618`). The TypeScript layer (`safety-events.ts:290–314`) calls
`.rpc('get_event_patient', ...)` — there is no app-layer `logAuditAccess` call at this
site (correctly removed: the audit now lives inside the RPC and cannot be skipped).

**A4. Direct authenticated DML on `event_patient`: REVOKED.**
`grants_revoke.sql:51` issues `REVOKE ALL PRIVILEGES ON TABLE public.event_patient FROM authenticated`.
This file runs after `patient_safety.sql` (filename sort: `012000` > `009000`), so the
GRANT ALL at `patient_safety.sql:4689` is superseded by the REVOKE. Net effective
privilege for `authenticated` = zero DML on `event_patient`. The RLS policy
`event_patient_select` (`patient_safety.sql:4258`) is labeled "defense-in-depth" for
future roles and keeps the TIGHT `can_read_event_patient` predicate — correct posture.

**A5. Admin severed from NSP PHI SELECT policies: COMPLETE.**
A grep over `patient_safety.sql` for `is_admin()` in SELECT RLS policies yields zero
matches in any NSP PHI policy body. The only `is_admin()` references in the migration are:
- `pqs_members_admin_all` (line 31) — correct: admin manages the PQS roster;
- `notify_safety_event` RPC body (line 2069) — governance event creation (non-PHI);
- `dispose_event_phi` RPC body (line 2881) — intentional admin-or-PQS exception, documented;
- `add`/`remove`/`list_pqs_members` function bodies (lines 3007/3026/3043) — admin roster
  management, correct.

ADR 0036 states 19 NSP PHI SELECT policies and 7 `rca_*_write` policies were stripped. The
implemented RLS policies for all NSP PHI tables (`patient_safety_event`, `event_custody`,
`event_triage`, `event_triage_sentinel_flags`, `rca`, `rca_*`, `capa_plan`, `capa_*`) use
`can_read_event`/`can_read_capa`/`can_write_rca`/`is_pqs_writer()` predicates with no
`is_admin()` term in any of them (confirmed by exhaustive grep).

### WS B — Audited Free-Text / PHI Classification

**B1. Six `.viewed` verbs in the DB allow-list: PRESENT.**
`log_audit_access` (`audit.sql:613–618`) includes all six:
`safety_event.viewed`, `triage.viewed`, `rca.viewed`, `capa.viewed`, `meeting.viewed`,
`interview.viewed`.

**B2. Six `.viewed` emit calls in the query layer: ALL PRESENT.**
- `getSafetyEvent` (`safety-events.ts:237`) → `logAuditAccess({action: 'safety_event.viewed', ...})`
- `getEventTriage` (`triage.ts:166`) → `auditClinicalView({action: 'triage.viewed', ...})`
- `getRca`/`getRcaById` (`rca.ts:163`) → `auditClinicalView({action: 'rca.viewed', ...})`
- `getCapaPlan` (`capa.ts:182`) → `auditClinicalView({action: 'capa.viewed', ...})`
- `getMeetingDetail` (`meetings.ts:467`) → `logAuditAccess({action: 'meeting.viewed', ...})`
- `getInterviewDetail` (`interviews.ts:388`) → `logAuditAccess({action: 'interview.viewed', ...})`

The `case_narratives.body_md`/`case_events.body` coverage note is correct: those are covered
by `case.opened` in `get_case_detail`; no duplication needed.

**B3. TS audit unions updated: COMPLETE.**
`AuditAction` and `AuditAccessAction` in `audit.ts`/`access.ts` include all six `.viewed`
verbs plus `event_patient.disposed`. `AUDIT_ACTION_LABELS` has pt-BR labels for all of them.
`AuditEntityType` is consistent with what the writers emit.

**B4. PHI classification (SQL COMMENTs): NOTED as present.**
The Decisions log confirms 22 free-text PHI-bearing columns were labeled by SQL column
COMMENTs. This audit does not re-read every column comment (too many tables); the pgTAP
suite (665/665) and the tester's acceptance specs are the verification record.

**B5. Residual bypass documented: ACCURATE.**
ADR 0036 §3 and ARCHITECTURE.md Rule 12 accurately describe the two-tier model and the
accepted residual that the `.viewed` audit is app-layer and bypassable by a direct PostgREST
caller. This is the locked decision and is faithfully documented.

### WS C — PHI Disposal

**C1. `dispose_event_phi` gate: CORRECT.**
`public.dispose_event_phi` (`patient_safety.sql:2868`) is SECURITY DEFINER, `search_path`
pinned to `'app', 'public', 'pg_catalog'`. The gate is `is_admin() OR is_pqs_member(auth.uid())`
(admin-or-PQS) — the one intentional admin exception, documented in ADR 0036 §4 and CLAUDE.md.

**C2. One-shot constraint: ENFORCED.**
HC056 check at `patient_safety.sql:2897–2901` raises if `phi_disposed_at IS NOT NULL`.

**C3. PHI deletion/nulling/redaction scope: COVERS stated columns.**
The RPC deletes `event_patient`, nulls `patient_safety_event.description_md`,
`event_triage.disposition_notes_md`, `rca.{what,expected,summary}_md`, `rca.impact`, `rca.scope`,
`capa_plan.lessons_learned_md`, `capa_effectiveness.method_md`, `capa_measure_result.note`.
It redacts (NOT-NULL sentinel `'[PHI removido]'`) `rca_factors.text`,
`rca_root_causes.text`, `rca_timeline_entries.description`, `capa_action_task.description`.
CAPA scope is correctly bounded to plans with `source_event_id = p_event_id OR source_rca_id
= v_rca_id`.

**C4. Governance skeleton preserved: VERIFIED by design.**
The RPC does not touch `code`, `status`, `current_owner_*`, `reporting_commission_id`,
`event_custody` rows, or the `audit_log`. The final UPDATE (step 6) stamps only
`has_patient`, `phi_disposed_at`, `phi_disposed_by`, `phi_disposed_reason`, `updated_at`.

**C5. Audit safety of the disposal: SOUND.**
The disposal emits one explicit `event_patient.disposed` row via `app.audit_write` with
`metadata = {"reason": <enum>}` only — no PHI in the metadata. The mutation triggers on
tables updated during disposal do NOT emit PHI-containing rows:
- `audit_event_patient_trg` fires on INSERT OR UPDATE — not DELETE — so the `DELETE FROM
  event_patient` step emits no trigger row;
- `audit_safety_event_trg` fires on the `description_md = null` UPDATE and the final
  `phi_disposed_at/by/reason` UPDATE but only emits when `status IS DISTINCT FROM old.status`
  — which is false in both cases. No spurious audit row is written;
- `rca`, `capa_plan`, and child table triggers audit only `status` changes (their `v_cols`
  allow-lists exclude every free-text/PHI column).

The ADR 0036 §4 claim "the triggers' column allow-lists exclude every PHI column" is
confirmed correct.

**C6. `phi_disposed_reason` is a constrained category: CORRECT.**
CHECK constraint at the migration level and the RPC-level enumeration check both enforce
`retention_expired|subject_request|entered_in_error|duplicate|other`. No free text.

### WS D — Documentation Accuracy

**D1. H1 correction (encryption claim strike): PRESENT.**
ARCHITECTURE.md Rule 12 states "Column-/application-level encryption (pgcrypto) was
considered and declined" with the rationale. ADR 0030 §3 and ADR 0031 §3 each carry a
pointer to ADR 0035. No residual "encryption-ready" or "optional column encryption" claim
remains in ARCHITECTURE.md or the updated ADRs.

**D2. H5 correction (regulatory posture): PRESENT.**
ADR 0035 is complete and accurate: LGPD Art. 11 legal basis, Art. 18 erasure reconciled
with CFM 20-year retention, ANPD breach notification as a deployment gate, HIPAA/BAA
re-framed as the infrastructure layer. CLAUDE.md §1 ("binding regulatory regime is LGPD +
ANVISA/RDC + CFM 1821/2007") is consistent.

**D3. ADR 0036 content vs implementation: CONSISTENT.**
Every claim in ADR 0036 maps to a verifiable migration or code artifact:
- "19 NSP PHI SELECT policies stripped of `OR app.is_admin()`" — confirmed by grep;
- "7 `rca_*_write` policies severed" — confirmed (rca update/delete + rca_evidence/factors/
  members/root_causes/timeline/why_chains write policies all use `can_write_rca`);
- "REVOKE ALL on `event_patient` from `authenticated`" — confirmed in `grants_revoke.sql`;
- "get_event_patient re-gates + emits exactly one audit row" — confirmed in the RPC;
- "dispose_event_phi one-shot HC056, audit-PHI-safe" — confirmed above.

**D4. ARCHITECTURE.md Rule 11 / Rule 12: ACCURATE.**
Rule 11 correctly describes the two-tier audit model (unbypassable `event_patient.read`
inside the DEFINER RPC; app-layer `.viewed` as accepted residual). Rule 12 enumerates
all implemented controls including the disposal RPC.

### WS E — Efficiency

**E1. M3 index verification: DONE** (no missing indexes; documented in Decisions log).
**E2. M4 `capa_plan.source` note: DONE** (comment added).
**E3. M2 shared vocab helpers: CORRECTLY DEFERRED** with documented rationale.

---

## Additional Checks

**Service-role key client-side exposure: NONE FOUND.**
`access.ts` carries `import 'server-only'`. `logAuditAccess` and `auditClinicalView` use
`createClient()` (server cookie client). No `NEXT_PUBLIC_` service-role key exists.

**Data access via `src/lib/queries/`: RESPECTED.**
`getEventPatient` calls `.rpc('get_event_patient')` — no inline table select on `event_patient`.
All six `.viewed` emit calls are in the query layer, not in components. Architecture Rule 9
is satisfied for the remediation-touched paths.

**TypeScript strict / `any` usage: ACCEPTABLE.**
`safety-events.ts:300` casts `data as unknown as EventPatientRow` — this is the PostgREST
jsonb-typed RPC return, which has no better type without generated overloads. The double-cast
pattern is standard for DEFINER RPC jsonb returns in this codebase.

**pt-BR user-facing strings: PRESENT.**
All RAISE messages in the migration are in Portuguese. `AUDIT_ACTION_LABELS` has pt-BR
labels for all new verbs. The TS error messages in `messages.ts` for HC056 are pt-BR.

**Sanitized Markdown: UNCHANGED.**
The disposal RPC sets free-text columns to `null` (nullable) or `'[PHI removido]'` (NOT-NULL
sentinel). Neither path introduces new Markdown rendering. The Rule 7 constraint is untouched.

---

## Open Informational Notes (Non-blocking)

**INFO-1 (frontend backlog, already logged):** The `pqs_members` management UI, the
NSP-route "não autorizado" gate for non-PQS members, and the "Descartar dados do
paciente" disposal UI are frontend follow-ups listed in PROGRESS.md. These do not gate
this increment — the backend enforcement is complete.

**INFO-2 (Phase 19 flag):** ADR 0036 and ARCHITECTURE.md Rule 12 correctly flag that Phase-19
surveyor/evidence export must treat all 22 classified free-text columns as PHI. This should be
carried as a hard acceptance criterion for Phase 19, not just documentation.

**INFO-3 (meeting/interview `.viewed` commission attribution):** `getMeetingDetail` and
`getInterviewDetail` attribute the `.viewed` audit row to their own `commission_id`, not to a
patient-safety event's `reporting_commission_id`. This is correct — meetings and interviews are
commission-scoped entities, not event-scoped. No issue.

---

## Verdict: APPROVED

All workstream requirements are met:
- WS A: `event_patient` lockdown is complete and sound at every layer (DB predicate,
  DB REVOKE, DEFINER single-door, TS query layer);
- WS B: 6 `.viewed` verbs are in the DB allow-list and emitted by all 6 detail-read sites;
  the accepted residual is accurately documented;
- WS C: `dispose_event_phi` is gated, one-shot, PHI-safe in every audit path, and preserves
  the governance skeleton;
- WS D: the documentation accurately reflects the implemented controls (no residual
  encryption claims; LGPD/ANVISA/CFM correctly framed);
- WS E: opportunistic items resolved or correctly deferred;
- Architecture Rules 1, 9, 11, 12 and CLAUDE.md §8 quality bar are satisfied.
- No blocking or major findings.

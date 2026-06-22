# Phase 23 QA Review — Patient Identity & Cross-Committee Linkage (`patient_index`)

**Reviewer:** qa  
**Date:** 2026-06-22  
**Verdict:** APPROVED  
**Blockers:** 0  **Majors:** 0  **Minors:** 1 (INFO: noted below)

---

## Scope

Single migration `20260620019000_patient_index.sql`; `src/lib/patient-index/{types,actions}.ts`;
`src/lib/queries/patient-index.ts`; `src/lib/queries/audit.ts` (extended);
`src/app/admin/nsp/pacientes/{page,loading,error}.tsx`;
`src/components/patient-index/{patient-search-view,trajectory-table,trajectory-result,access-audit-table,format}.tsx`;
`src/components/referrals/referral-patient-panel.tsx` (extended);
`src/app/c/[slug]/encaminhamentos/[referralId]/page.tsx` (extended);
`supabase/tests/152_patient_index.sql`; `e2e/patient-index.spec.ts`; ADR 0039.

---

## Requirements Coverage

The three binding requirements are met:

**Req 1 — MRN + encounter in all three PHI modules (derive keys from them):** `patient_key`/`encounter_key` columns added to `event_patient`, `referral_patient`, `case_patient` (migration §3). The ALWAYS-ON BEFORE trigger `trg_derive_patient_keys` fires on INSERT and UPDATE on all three tables, deriving keys from `mrn`/`encounter_ref` via `app.derive_patient_key` (HMAC-SHA256 under `app.app_secrets['mrn_pepper']`). Keys are derived independently of the flag. pgTAP 152 §T8–T13 proves derivation fires with `patient_index` OFF and produces a shared `patient_key` for `' prt-9 '` and `'PRT-9'`. E2E AC-1 and AC-2 confirm cross-committee matches hit the three seeded modules.

**Req 2 — Non-identifying transmission on referrals + count-only hint:** `referral_patient.patient_key` carries the key to the referral naturally (the existing isolated row participates in the always-on index). The B-side detail page calls `patientXrefCount('referral', detail.id)` server-side (gated on `can_read_referral_phi`) and threads `appearsInCount` to `ReferralPatientPanel`, which renders "Este paciente aparece em N outro(s) registro(s)" only when `> 0`. The count reveals no identity, no list, no commission names. E2E AC-3 exercises the RPC path; pgTAP §T30–T31 verifies the count (2) and denial (0).

**Req 3 — QPS visualize AND audit cross-committee interactions:** `search_patient_xref` assembles a PHI-free trajectory (entity codes + commission names + dates + disposed flag); `patient_access_audit` returns the full cross-committee access history from `audit_log` for every entity sharing the patient's key, bypassing per-commission audit RLS by design (QPS-only). Both are behind the `is_pqs_member` gate in the DEFINER RPCs. The QPS page at `/admin/nsp/pacientes` is admin-gated + flag-gated; a non-PQS admin can reach it but gets empty results (duty separation). E2E AC-1,2,4,5,9 cover trajectory; AC-4a,4b,5 cover audit emission.

---

## Security / RLS

### `patient_xref` isolation

`ENABLE ROW LEVEL SECURITY` is set. The only DML policy is `patient_xref_select_pqs FOR SELECT TO authenticated USING (app.is_pqs_member(auth.uid()))`. `REVOKE ALL PRIVILEGES ON TABLE patient_xref FROM authenticated` is present. `anon` has no explicit GRANT; RLS + no GRANT means anon is denied at both levels (consistent with the existing PHI-table pattern for `case_patient`, `event_patient`, `referral_patient`, which also only REVOKE from `authenticated`). `service_role` is GRANTED SELECT,INSERT,UPDATE,DELETE. No INSERT/UPDATE/DELETE policies exist for `authenticated` or `anon` — direct DML is impossible for data-API callers; maintenance goes through DEFINER triggers. pgTAP §T16 (`has_table_privilege('authenticated','public.patient_xref','SELECT') = false`) and §T17 (flag-off RPC raises 23514) confirm both layers.

### `app.app_secrets` lock-down

`REVOKE ALL ON TABLE app.app_secrets FROM authenticated, anon` (both roles explicitly). `GRANT SELECT TO service_role` only. The table is in the `app` schema (not `public`) and therefore not PostgREST-exposed. `app.derive_patient_key` reads it as DEFINER owner. Hard-fails (raises `check_violation`) if the row is absent or blank — no silent empty-pepper key. pgTAP §T1–T2 confirms the pepper row exists and `authenticated` has no SELECT.

### DEFINER door grants / re-gating

All five `public.*` RPCs + the two `dispose_*_phi` replacements are in the DO-loop that REVOKEs from PUBLIC and GRANTs EXECUTE to `authenticated` and `service_role`. Each RPC re-gates at its first line:

- `search_patient_xref`: `assert_patient_index_enabled()` then `is_pqs_member(auth.uid())` — empty bundle for non-PQS; no trajectory.
- `get_patient_trajectory_for_entity`: same guard order.
- `patient_access_audit`: same guard order; returns `'[]'::jsonb` for non-PQS; does NOT re-audit the read.
- `patient_xref_count`: `assert_patient_index_enabled()` then `can_read_referral_phi(p_entity_id, auth.uid())` — returns `0` for other modules (explicit deny branch) and `0` for non-entitled callers. The "other modules → return 0" branch is correct — no entitlement path exists for event or case count hints yet.

The helper internals (`app.derive_patient_key`, `app.normalize_identifier`, `app.patient_trajectory_bundle`, etc.) are REVOKED from PUBLIC and GRANTED only to `service_role`, so they cannot be called directly by `authenticated`.

### Rule 11 audit compliance — keys only, never raw MRN

`patient.searched` and `patient.viewed` route through `app.audit_write(…, p_commission => null, …)` on the GLOBAL chain (not `log_audit_access` — correct, because `log_audit_access` is commission-scoped and the audit labels are registered in `src/lib/queries/audit.ts`, not `access.ts`). Metadata: `{patient_key: left(v_audit_key,12)||'…', matches: n}` — 12-char truncated key prefix + count only. The raw MRN is never passed to `audit_write`. Zero-match searches emit nothing (`v_count >= 1` guard). pgTAP §T24–T28 asserts: exactly one `patient.searched` on match; `commission_id IS NULL`; truncated key in metadata; raw MRN absent from metadata; zero rows on zero-match. `patient_access_audit` does not call `audit_write` — reading the access audit is not itself re-audited (documented ADR 0039 Decision 5 and design intent).

`patient_access_audit` selects from `audit_log`: `id`, `occurred_at`, `actor_id`, `actor_name` (joined from profiles), `action`, `entity_type`, `entity_id`, `commission_id`, `commission_name` — no `metadata`, no `summary`, no free text. Rule 11 data-minimization is satisfied.

### Rule 12 PHI invariant — no fourth PHI store

`patient_xref` carries `patient_key`, `encounter_key`, `commission_id`, `created_at`, `disposed_at`, `disposed_reason` — non-reversible hashes and governance metadata only. No `name`, `mrn`, `encounter_ref`, `date_of_birth`, or any other identifier column exists. The COMMENT ON TABLE confirms this explicitly. The trajectory bundle assembles entity codes and commission names from the PHI-free governance columns of `patient_safety_event`, `case_referral`, and `cases` — it does not JOIN to any PHI table. Confirmed: `patient_trajectory_bundle` reads `patient_safety_event.code`, `case_referral.code`, `cases.case_number` — all governance metadata.

### Disposal correctness

`dispose_event_phi` and `dispose_case_phi` are forward-only CREATE OR REPLACE replacements verified to differ from their originals by exactly one line: `perform set_config('app.phi_dispose_reason', p_reason, true)` inserted between the bypass `set_config` call(s) and the `DELETE FROM *_patient` statement. The AFTER-DELETE `trg_xref_maintain` trigger reads `current_setting('app.phi_dispose_reason', true)` and stamps the retained xref row with the real reason (not the `'other'` fallback). The xref row is RETAINED (UPDATE, not DELETE) with `disposed_at = coalesce(disposed_at, now())` — idempotent, no double-stamp. pgTAP §T32–T36 verifies: coordinator disposes case_x; `case_patient` row deleted; xref row retained; `disposed_reason = 'subject_request'`; `disposed_at IS NOT NULL`; count drops from 2 to 1.

### Derivation trigger correctness

The BEFORE INSERT/UPDATE trigger `trg_derive_patient_keys` accesses `OLD` on INSERT: in PL/pgSQL, `OLD` is a NULL record on INSERT; `TG_OP = 'INSERT'` is TRUE and short-circuits the `OR`, so `OLD.mrn` is never dereferenced. Safe. On UPDATE, `OLD` is populated correctly. The `TG_ARGV`-free generic entity resolution in `trg_xref_maintain` dispatches via `TG_TABLE_NAME` to the correct `v_id_col` string then extracts the UUID via `(to_jsonb(coalesce(new,old)) ->> v_id_col)::uuid` — correct for all three PHI tables.

### `patient_xref_count` scope fidelity

The function reads `patient_xref WHERE module = p_module AND entity_id = p_entity_id` to get `v_patient_key`, then counts OTHER rows `WHERE x.patient_key = v_patient_key AND x.disposed_at IS NULL AND NOT (x.module = p_module AND x.entity_id = p_entity_id)`. Disposed rows are excluded (correct — a disposed entity's key is still in the index but shouldn't inflate the active count). Self is excluded. The count excludes encounter-only matches (only patient_key is used for the count, not encounter_key) — this is consistent with the referral hint's intent ("same patient, not just same encounter").

---

## Code Quality

### Rule 9 — data access through `src/lib/queries/`

All RPC calls go through `src/lib/queries/patient-index.ts`. The `"use client"` search form calls `searchPatientAction` (a `"use server"` action in `src/lib/patient-index/actions.ts`), which calls `searchPatient` from the queries module. The referral detail page calls `patientXrefCount` from the queries module server-side. No inline `supabase-js` in components.

The `"use server"` module (`actions.ts`) imports only from `src/lib/queries/patient-index` and `src/lib/patient-index/types` — the latter has zero imports (client-safe). No `next/headers`, no `@/lib/supabase/server` in the client-safe types module. The client-bundle boundary is sound.

### TypeScript strict / `any`

No `: any` or `as any` usage. The three `as unknown as PatientSearchJson` / `as unknown as PatientAccessAuditJson[]` casts in `src/lib/queries/patient-index.ts` (lines 183, 212, 241) are justified: the DEFINER RPCs return `Json` (not typed jsonb structure) in the generated types (`search_patient_xref: { Returns: Json }` at `src/lib/types/database.ts:6945`), and a double-cast through `unknown` is the canonical pattern for untyped jsonb in supabase-js. Types were regenerated (`src/lib/types/database.ts` contains `search_patient_xref`, `get_patient_trajectory_for_entity`, `patient_access_audit`, `patient_xref_count`, `patient_index_enabled` at lines 6118–6943). Typecheck/lint both reported 0 errors.

### Rule 8 — generated types

Present in `src/lib/types/database.ts`; all five new RPCs (`search_patient_xref`, `get_patient_trajectory_for_entity`, `patient_access_audit`, `patient_xref_count`, `patient_index_enabled`) appear. `patient_key`/`encounter_key` columns on the three PHI tables are also present.

### Server Components default

`src/app/admin/nsp/pacientes/page.tsx` is a Server Component (no `"use client"`). `PatientSearchView` is `"use client"` (owns the search form state and transition). `TrajectoryTable`, `TrajectoryResult` are presentational Server-safe (no directive). `AccessAuditTable` is `"use client"` (lazy on-demand load pattern). `ReferralPatientPanel` is pre-existing `"use client"`. All server data fetches (`patientIndexEnabled`, `getPatientTrajectoryForEntity`, `patientXrefCount`) are performed in Server Components or server actions.

### Rule 10 — pt-BR

All user-facing strings are pt-BR: "Pesquisar paciente", "Prontuário", "Atendimento", "Informe o prontuário e/ou o número de atendimento para pesquisar.", "Este paciente aparece em N outro(s) registro(s)", "PHI descartado", "Histórico de acesso", etc. Error messages are pt-BR and wrapped (no raw Postgres errors reach the UI — non-PQS callers and flag-off paths return `'Não foi possível realizar a pesquisa de paciente no momento.'`). E2E AC-11a confirms empty-search validation returns pt-BR.

### ADR

ADR 0039 is present at `docs/decisions/0039-patient-identity-cross-committee-linkage.md` and correctly records all nine decisions (linkage key, pepper store, xref, triggers, DEFINER doors, referral transmission, audit routing, disposal, bootstrap). The rejected alternatives (Vault, GUC, reversible mapping, governance-row key storage) are documented with rationale.

---

## UX & Accessibility

The search form is a real `<form>` with `onSubmit` (Enter submits). Both inputs are labeled via `<FieldLabel htmlFor={…}>` wired to the control's id through `useFieldIds`. Field description and error ids are wired via `aria-describedby` through `mrnIds.controlProps`. The results section carries `aria-live="polite"` and `aria-labelledby`. The access audit section has `aria-labelledby`. The trajectory table has a `<caption className="sr-only">`. Focus rings use `focus-visible:ring-*`. E2E AC-10 drives keyboard-only flow (Tab→fill→Enter→results). AC-11a confirms pt-BR labels and error messages.

The QPS page header link uses `focus-visible:ring-*` and the trajectory table link uses the same pattern. All interactive elements are keyboard-reachable.

---

## Hygiene

`PROGRESS.md` reflects reality accurately: BE-1/BE-2/BE-3 and FE-1/FE-2 all marked ✅; lead notes document the two design corrections (GUC→table, static→generic trigger), the regression caught and fixed in `dispose_event_phi`, and the accepted follow-ups. Test run summary records 15/15 E2E, 10/10 pgTAP suite sweep, 39/39 pgTAP unit assertions, and 30 pre-existing full-suite failures with triage notes consistent with the Phase-22 baseline.

Secrets: the dev pepper in the migration is a labelled non-secret (`'dev-only-mrn-pepper-hospital-form-platform-20260622'`), inserted `ON CONFLICT DO NOTHING` so it never clobbers a prod value. The production override path is documented in the migration and in ADR 0039 §2. No service-role key is client-accessible; `NEXT_PUBLIC_*` vars are unchanged.

---

## Accepted Follow-ups (non-blocking; record at §6 Record step)

These are explicitly listed in the spawn prompt and PROGRESS.md lead notes. This review does not fail the gate on them:

1. `dispose_referral_phi` — referral xref disposal is cascade-only today; the generic mechanism (GUC + stamp-don't-delete) is built and ready. Pre-existing Phase-22 gap.
2. Pepper rotation strategy for `app.app_secrets['mrn_pepper']` — documented residual in ADR 0039 Consequences.
3. "Ver trajetória do paciente" links on the CASE and REFERRAL detail pages — deferred by FE because those `/c/[slug]/…` pages have only `isAdmin` in scope, not a public PQS boolean; adding them cleanly requires backend to export `isPqsMemberSelf()` as a public helper. The NSP event-detail link shipped.
4. Access audit on the deep-link entry point (currently search-only; the deep-link holds no identifier to pass to `patient_access_audit`). Documented in the page comment.
5. SPEC-P22-001 — `phase22-referrals` Flow 1c spec defect (PostgREST `text/plain` for P-class SQLSTATE); not a Phase-23 regression; pre-existing behavior.

---

## MINOR Finding

**INFO-1 — `patient_access_audit` does not surface `patient.searched`/`patient.viewed` rows in the access audit.**

`patient.searched` and `patient.viewed` audit rows have `entity_id = patient_key_to_uuid(v_audit_key)` (a deterministic UUID derived from the hash). `patient_xref` entity_ids are the module-native `event_id`/`referral_id`/`case_id` UUIDs. Since the key-derived UUID does not appear in `patient_xref.entity_id`, `patient_access_audit`'s inner subquery `WHERE x.entity_id IN (xref entity_ids)` does not match those rows — QPS trajectory-view events (who searched for this patient) are not visible in the access audit.

The ADR 0039 design explicitly says `patient_access_audit` returns "audit_log rows for `entity_id IN (SELECT entity_id FROM patient_xref WHERE patient_key = …)`" and this is the documented scope. The absence of search/view rows in the access audit is consistent with the design intent (the access audit shows who accessed the underlying patient records, not who performed QPS lookups; the QPS search trail exists in the audit log under `patient.searched`/`patient.viewed` but is accessible separately). This is an accepted design trade-off, not a missing requirement. No action required — document in the follow-up list for Phase 25+ if QPS access audit expansion is desired.

---

## Summary

All three binding requirements are met. The security posture is sound:

- `patient_xref` is QPS-only (REVOKE + single SELECT policy); no direct DML for `authenticated`.
- `app.app_secrets` is locked to `service_role` SELECT + DEFINER owner reads; both `authenticated` and `anon` are explicitly REVOKED.
- All five DEFINER doors re-gate on `is_pqs_member` (or `can_read_referral_phi` for the count hint) as the first substantive check after the flag assert.
- The audit log never receives a raw MRN or patient name — only a 12-char truncated key prefix + match count on the global chain.
- Both `dispose_*_phi` replacements are machine-verified one-line additions to the originals; the AFTER-DELETE trigger stamps the retained xref row with the real disposal reason.
- The TS layer uses `as unknown as` casts only for untyped jsonb RPC returns (justified inline); no unjustified `any`.
- Generated types include all five new RPCs; typecheck and lint report 0 errors.
- pgTAP 39/39; E2E 15/15 (all 11 ACs); 10/10 regression suite sweep (including the caught-and-fixed `dispose_event_phi` regression).

**Verdict: APPROVED — 0 blockers, 0 majors, 1 INFO.**

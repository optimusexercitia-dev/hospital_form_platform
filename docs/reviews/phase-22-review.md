# Phase 22 — Inter-Committee Case Referrals: QA Review

**Verdict: APPROVED**

Reviewer: qa (QA Reviewer agent)
Date: 2026-06-21
Test baseline: pgTAP 705/705 · E2E 29/29 · full regression 276/326 (26 pre-existing; 0 Phase-22 regressions)
Audit contract: ADR 0037 (2026-06-21) · plan file `a-feature-must-be-streamed-quill.md` · `PHASES.md` accreditation track · Architecture Rules 1/6/7/9/10/11/12

---

## Summary

Phase 22 delivers a PHI-bearing Inter-Committee Case Referral channel under NSP-grade safeguards identical to those established for `event_patient` in Phase 14 / the PHI Remediation. The feature flag (`case_referrals`) ships OFF. All 16 design decisions in the plan file are implemented. All 8 acceptance-flow groups have dedicated E2E coverage. The RLS/PHI surface — the primary audit concern — holds at every layer: DB predicates, column-level REVOKE, DEFINER single-door RPCs, the TS data-access layer, and the UI boundary. No blocking or major findings were identified.

One INFO-level ADR prose omission is noted below; it has no security implication.

---

## Audit Trail

### 1. Requirements Coverage

All 16 locked decisions from the plan file are accounted for:

| Decision | Implemented | Evidence |
|----------|------------|---------|
| D1 Snapshot on assemble (no live access post-send) | Yes | `assemble_referral` freezes `frozen_body_md`/`frozen_storage_path` into `referral_shared_item`; guard HC073 blocks post-assembly edits |
| D2 `response_expected` blocks `close_case` HC076 | Yes | `20260620014000` `close_case` gate; pgTAP §F; E2E Flow 4 |
| D3 PHI isolated to `referral_patient` + audited single door | Yes | `20260620013000` REVOKE; `get_referral_patient` DEFINER; pgTAP §C assertions |
| D4 `can_read_referral_phi` excludes `is_admin` | Yes | `20260620013000` lines 385-402; pgTAP column-lockdown assertions |
| D5 QPS macro view via `is_pqs_member` early-return in `can_read_case` | Yes | `20260620014000`; pgTAP §D; E2E Flow 3 |
| D6 No target-commission leg on `can_read_case` QPS term | Yes | predicate verified — QPS can read source cases via the referral channel only; B cannot read A's live case |
| D7 Snapshot-doc download RLS-consistent (no service-role) | Yes | `getReferralDocumentUrl` uses cookie client; `can_read_snapshot_document` DEFINER; Flow 2 E2E |
| D8 Free-text PHI (`frozen_body_md`/`result_md`) gated by `can_read_referral_phi` | Yes | `20260620015000` SELECT policy swap + `get_referral_detail` body-gate |
| D9 `description_md`/`decline_note` column-REVOKED from `authenticated` | Yes | `20260620016000` explicit REVOKE + 25-column GRANT |
| D10 `referral.viewed` fires only on PHI-body serve to non-source-coordinator | Yes | `20260620015000` `get_referral_detail` audit condition; pgTAP §B |
| D11 All 6 Phase-22 audit verbs on `log_audit_access` allow-list | Yes | `20260620014000` CREATE OR REPLACE; pgTAP §E |
| D12 QPS list/metrics gated on `isPqsMemberSelf()` in TS layer | Yes | `src/lib/queries/referrals.ts` `listAllReferrals` + `referralFlowMetrics` |
| D13 List/hub/dashboard never select PHI columns | Yes | `REFERRAL_LIST_SELECT` constant; `hasReply` from `status === 'concluida'` |
| D14 `referral_target_analyst` requires linked `target_case_id` (NULL → false) | Yes | predicate definition confirmed; analyst PHI access gate verified |
| D15 HC076 excludes `rascunho` and `response_expected=false` | Yes | gate condition verified; pgTAP `close with response_expected=false succeeds` |
| D16 Feature flag ships OFF | Yes | `20260620013000` insert into `app.feature_flags` with `enabled=false` |

### 2. Security / RLS / PHI

This is the core audit for a second PHI-bearing module reversing Architecture Rule 12.

**2.1 `referral_patient` isolation**

`REVOKE ALL PRIVILEGES ON TABLE "public"."referral_patient" FROM "authenticated"` confirmed in `20260620013000`. No INSERT/UPDATE/DELETE policy on the table (write is DEFINER-only). The audited `get_referral_patient` DEFINER re-gates via `can_read_referral_phi`, returns NULL with no audit row when out-of-scope, and emits `referral_patient.read` only on an entitled read. Verified in pgTAP: 4 assertions covering the REVOKE, audited door, null-on-unentitled, and read-audit-row count.

**2.2 `can_read_referral_phi` — no `is_admin` term**

The predicate at `20260620013000` lines 385-402 contains exactly three disjuncts: source-commission `is_staff_admin_of`, `referral_target_analyst`, and `is_pqs_member`. There is no `is_admin()` term. A global admin who is not a PQS member and is not a coordinator on either committee cannot read PHI. Duty separation is intact and mirrors the `event_patient` lockdown established during PHI Remediation.

**2.3 Free-text PHI lockdown (three-layer)**

Layer 1 (`20260620015000`): `referral_shared_item` and `referral_reply` SELECT policies swapped from `can_read_referral` to `can_read_referral_phi`.

Layer 2 (`20260620016000`): column-level REVOKE on `case_referral.description_md` and `decline_note` (full table SELECT revoked, 25 PHI-free columns re-granted individually).

Layer 3: `get_referral_detail` (final version in `20260620016000`) gates all four PHI free-text columns (`description_md`, `decline_note`, `frozen_body_md`, `result_md`) behind `v_can_phi`. The function is a DEFINER with `SET search_path TO 'public', 'pg_catalog'`; all `app.` predicate calls use explicit schema qualification. The `search_path` pattern is intentional and consistent with `get_event_patient`.

**2.4 `can_read_case` QPS extension**

The extension in `20260620014000` is flag-gated (`case_referrals_enabled()`), appears before the `case_access` fallback in the predicate, and contains only two commission-membership disjuncts: `is_staff_admin_of(source_commission_id)` and `is_staff_admin_of(target_commission_id)` — no term granting B access to A's live case. A QPS member reaches both via the `is_pqs_member` early-return at the top of `can_read_case`, not through a commission-membership leg. Verified in pgTAP §D (3 assertions).

**2.5 HC076 gate**

`close_case` blocks when `response_expected = true` AND status is in `('enviada', 'recebida', 'aceita', 'em_analise')`. `rascunho` is not in the blocking set (a draft never blocks). `response_expected = false` is tested separately — closes cleanly. `concluida`/`recusada`/`retirada` are not in the blocking set. Gate logic correct; pgTAP §F + E2E Flow 4 both cover this.

**2.6 Snapshot-doc download — no service-role path**

`getReferralDocumentUrl` and `getReferralAttachmentUrl` in `src/lib/queries/referrals.ts` use the cookie client (server-side session), not the service-role client. The `can_read_snapshot_document` DEFINER is used to resolve the RLS recursion (a snapshot doc needs `case_referral` access to gate, but is under the `case-documents` bucket which has its own policy); the DEFINER re-gates via `can_read_referral_phi`. The signed URL is generated by the session-authed client and expires. No service-role key appears in any download path.

**2.7 Audit allow-list**

`log_audit_access` positive allow-list in `20260620014000` is extended via `CREATE OR REPLACE` to add: `referral_patient.read`, `referral.viewed`, `referral.sent`, `referral.received`, `referral.decided`, `referral.concluded`. All 6 Phase-22 verbs confirmed. Forged-verb rejection is covered in pgTAP §E. Audit metadata carries no PHI identifiers (consistent with Rule 11).

**2.8 QPS dashboard duty separation**

`listAllReferrals` and `referralFlowMetrics` both call `isPqsMemberSelf()` before executing their queries. The page at `src/app/admin/nsp/encaminhamentos/page.tsx` also checks `context.isAdmin`, but that gate is a route-level guard; the data queries enforce `is_pqs_member` independently. A non-PQS admin reaching the URL gets empty data from the queries, not an error or unauthorized PHI.

**2.9 Architecture Rule compliance summary**

| Rule | Status |
|------|--------|
| Rule 1 (RLS is the boundary) | Satisfied — explicit policies on all 7 new tables; no UI-only control |
| Rule 6 (storage immutability) | Satisfied — `referral-attachments` bucket immutable; snapshot copies reference only |
| Rule 7 (sanitized Markdown) | Satisfied — `frozen_body_md`/`description_md`/`result_md` are sanitized Markdown; stored-XSS guard unchanged |
| Rule 9 (data access via `src/lib/queries/`) | Satisfied — `src/lib/queries/referrals.ts` is the only data-access file; no inline supabase-js in components |
| Rule 10 (pt-BR user-facing) | Satisfied — `REFERRAL_MESSAGES` catalog, `mapReferralError`, all labels pt-BR |
| Rule 11 (audit trail) | Satisfied — all PHI-bearing mutations/reads emit audit rows via `log_audit_access`; no PHI copied into log |
| Rule 12 (PHI handling) | Satisfied — second module under identical isolated-table + audited-single-door + REVOKE safeguards as `event_patient`; ADR 0037 records the amendment |

### 3. Code Quality

**TypeScript strict**: no unexplained `any` casts found. `src/lib/referrals/types.ts` is a zero-import client-safe module (no server-only types). `src/lib/referrals/actions.ts` carries `"use server"` and imports from `src/lib/queries/referrals.ts` (server-only); no `"use server"` data-loader lives in `src/components/`. The temp bridge component (`src/components/referrals/use-server-bridge.ts` or equivalent) was confirmed deleted per P22-011 task notes.

**Server Components default**: all listing and detail pages are Server Components. `"use client"` is used only where interaction is required (`referral-patient-panel.tsx` for the lazy reveal, wizard steps, filter forms). The PHI panel (`referral-patient-panel.tsx`) correctly receives `onReveal` as a prop bound server-side to the `revealReferralPatient` server action — no server import leaks into the client component.

**Error mapping**: `mapReferralError` covers all HC070–HC07A codes plus Postgres standard codes (`42501`, `23505`, `no_data_found`). No raw Postgres error message can reach the UI through the action layer.

**pt-BR/English boundary**: user-facing strings are pt-BR throughout. Code, comments, and commits are in English.

### 4. Accessibility

`referral-patient-panel.tsx` uses `aria-labelledby` on `<section>` elements and semantic HTML. Keyboard accessibility (Flow 8 in E2E: 3 tests covering wizard step navigation, hub table navigation, and PHI-reveal keyboard trigger) is present.

### 5. Migration hygiene

Four forward-only migrations (`20260620013000`–`20260620016000`). No prior migration is edited. All `CREATE OR REPLACE FUNCTION` overrides are within the Phase-22 migration sequence. FKs, CHECKs, and indexes are present and appropriate (partial unique indexes for in-flight referral deduplication; coverage indexes on commission FKs). The feature flag inserts with `enabled = false`. SQLSTATE block HC070–HC07A (11 codes) is correctly reserved and documented.

### 6. pgTAP coverage

40 assertions in `supabase/tests/150_referrals.sql` cover the security-critical paths:

- `can_read_referral` vs `can_read_referral_phi` scoping (8 assertions): source member YES/NO; target member YES/NO; QPS YES/NO; source coordinator PHI YES; admin-not-PQS-not-coordinator PHI NO.
- Direct SELECT denied on `referral_patient`, `frozen_body_md`, `result_md` (2 assertions).
- Column-level lockdown: `has_column_privilege` negative for `description_md`/`decline_note` (2 assertions).
- `get_referral_detail` body-gating + `referral.viewed` audit (4 assertions).
- `referral_patient` REVOKE + audited door + null-on-unentitled + read-audit-row count (4 assertions).
- `can_read_case` QPS term (3 assertions).
- HC076 gate + `response_expected=false` succeeds (2 assertions).
- HC070/HC073 immutability guards (2 assertions).
- `referral_patient.updated` metadata empty / no PHI in audit row (2 assertions).

Full pgTAP suite 705/705 green.

### 7. E2E coverage

8 acceptance flows, 29 tests, all green:

- Flow 1 (Isolation): A's internal case content not visible to B members (3 tests)
- Flow 2 (Snapshot decoupling): edits to source after assembly don't reach B; RLS-consistent doc download (4 tests)
- Flow 3 (QPS macro view): coordinator sees own commission only; QPS sees all commissions (4 tests)
- Flow 4 (HC076 gate): disposable-case fixture; reply-expecting blocks close; withdraw unblocks; `response_expected=false` never blocks (3 tests)
- Flow 5 (PHI auditing): PHI reveal fires audit row; PHI-free list/dashboard/timeline don't (4 tests)
- Flow 6 (Immutability): HC073 snapshot lock; HC070 reply lock (2 tests)
- Flow 7 (Authority): B cannot transition A's source referral (3 tests)
- Flow 8 (Keyboard a11y): wizard nav, hub table nav, PHI reveal keyboard (3 tests)

The Flow 4 isolation fix (disposable case in `beforeAll`, no seeded-fixture mutation) was verified green in the 2026-06-21 rerun.

---

## Findings

### INFO-1: ADR 0037 HC078 description omits `referral_target_analyst` from `set_referral_patient` entitlement

The RPCs section of ADR 0037 describes the HC078 error for `set_referral_patient` as raised when the caller "is not entitled or the referral is concluded," without naming `referral_target_analyst` as an entitled party. The actual implementation uses `can_read_referral_phi` as the gate, which includes `referral_target_analyst`. The TypeScript action `revealReferralPatient` docstring correctly states "source-coordinator / QPS / target-analyst." This is a prose omission in the ADR only — the DB predicate, the DEFINER function, and the TS layer are consistent with each other and with the design intent. No security implication; the ADR should be updated to name the three entitled parties explicitly.

No action required before approval. The ADR update can be folded into the §6 Record step prose-doc reconciliation.

---

## Verdict

**APPROVED**

All 16 plan decisions are implemented. All 8 acceptance flows have deterministic E2E coverage. The PHI/RLS surface — the primary audit concern for this second Rule-12 module — is sound at every layer: DB predicates, column-level REVOKE, DEFINER single-door RPCs, the TS query layer, and the UI boundary. Architecture Rules 1/6/7/9/10/11/12 are satisfied. The feature flag ships OFF. One INFO-level ADR prose note is carried forward to the §6 Record step; it is non-blocking.

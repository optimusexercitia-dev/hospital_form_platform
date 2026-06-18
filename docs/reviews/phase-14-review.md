# Phase 14b–14d QA Review — Patient-Safety / NSP (Triage, RCA & CAPA)

**Reviewer:** qa  
**Date:** 2026-06-18  
**Scope:** Sub-phases 14b (Triage & Disposition), 14c (RCA Workspace), 14d (CAPA & Closure)  
**Baseline:** Phase 14a (NSP Foundation) — already APPROVED  
**Audit contract:** `docs/phases/accreditation-track.md` Phase 14b–14d sections; ADR 0030; Architecture Rules 1, 6, 7, 9, 10, 11, 12  
**Test state at spawn:** 65/65 E2E (14a:16, 14b:13, 14c:17, 14d:19) green on prod build; 511/511 pgTAP; typecheck/lint/unit green  
**Re-verification date:** 2026-06-18 — both findings resolved; pgTAP 516/516 PASS  

---

## Verdict

**APPROVED** (re-verified 2026-06-18)

Initial verdict was CHANGES REQUESTED (2 findings: 1 BLOCKING, 1 MINOR). Both findings are now confirmed resolved:

- **BLOCKER-1 resolved:** `triage_disposition` line 392 now reads `where event_triage.event_id = p_event_id` — table-qualified, no ambiguity. pgTAP `141_event_triage` strengthened to plan 44 (+5 assertions that call `triage_disposition` directly and assert its return values: row count, `is_sentinel`, `verdict`, `review_pathway`, `rca_due_date`). All 44 assertions pass. The authoritative SQL path for 14b-AC4 now executes correctly and is covered by pgTAP.
- **MINOR-1 resolved:** `set_pqs_rca_due_window` now emits `app.audit_write('pqs_config.rca_due_window_changed', 'pqs_department', v_id, ...)` with a descriptive message and old/new value diff. The audit row accurately identifies the `pqs_department` singleton being mutated. Architecture Rule 11 satisfied.

Full pgTAP suite: 516/516 PASS (Files=25; up from 511/511 pre-fix, reflecting the +5 triage_disposition assertions).

---

## Findings

### BLOCKER-1: `triage_disposition` RPC raises SQLSTATE 42702 at runtime — RESOLVED

**Requirement violated:** Phase 14b Acceptance Criterion — "disposition computes RCA mandated with a 45-day due date (assert the values)"; Architecture Rule 3 (SQL is the submission authority; the SQL and TS condition evaluators must agree).

**File:** `supabase/migrations/20260618121102_triage_rpcs.sql`, lines 355–421

**Root cause:** The function is declared as:

```sql
create function public.triage_disposition(p_event_id uuid)
returns table (
  event_id uuid,   -- output column: shadows the table column
  ...
)
```

Inside the body (line 390):

```sql
select * into v_t from public.event_triage where event_id = p_event_id;
```

The bare `event_id` in the WHERE clause is ambiguous between the `event_triage` table column and the `RETURNS TABLE` output column `event_id`. PostgreSQL resolves this as ambiguous and raises SQLSTATE 42702: `column reference "event_id" is ambiguous`.

**Impact:** The RPC is completely non-functional. The `getTriageDisposition` query layer (`src/lib/queries/triage.ts`) catches the error and returns `null`. The `disposition-rail.tsx` component falls back to the local TypeScript mirror `deriveVerdict(draft)`. While the UI degrades gracefully, the acceptance criterion requires asserting the *values returned by the RPC* (the 45-day `rca_due_by` date, the `verdict`, the `sentinel_score`). That assertion cannot be made against the failing RPC. The E2E spec T1 explicitly documents this by asserting DB state (`event_triage.review_pathway`, `rca.due_date`) rather than calling the RPC — the spec's own comment marks this as a workaround for this bug.

**Fix applied (2026-06-18):** Line 392 now reads `where event_triage.event_id = p_event_id` — table-qualified. The backend confirmed no other bare `event_id` references exist inside the function body (other output column names are `is_pse`/`reached`/`severe`/`is_sentinel`/`verdict`/`review_pathway`/`rca_due_date`, all locally distinct; other lookups key on `id`). pgTAP 141 plan expanded to 44 with 5 new assertions calling `triage_disposition` directly and asserting its return values (row count, `is_sentinel=true`, `verdict='rca'`, `review_pathway='rca'`, `rca_due_date=current_date+45`). All 44 pass.

---

### MINOR-1: `set_pqs_rca_due_window` emits a mislabeled audit row — RESOLVED

**Requirement violated:** Architecture Rule 11 — "an append-only, tamper-evident audit trail; every mutation emits an audit row" — the audit row must accurately identify what was mutated; a mislabeled row undermines the tamper-evident value of the log.

**File:** `supabase/migrations/20260618121102_triage_rpcs.sql`, line 693

**Root cause:** The `set_pqs_rca_due_window` RPC updates `pqs_department.default_rca_due_days`. Its audit emission is:

```sql
perform app.audit_write('triage.saved', 'event_triage', v_id, null, ...);
```

`v_id` is the `pqs_department.id`, not an `event_triage` row id. The `entity_type='event_triage'` is wrong — no `event_triage` row was mutated. The `action='triage.saved'` is misleading — this is a PQS configuration change, not a triage worksheet save. An auditor following the log would find a `triage.saved` row pointing to an `event_triage` entity that was never touched, while the actual `pqs_department` mutation goes uncaptured as the source.

**Fix applied (2026-06-18):** Line 698 now reads:

```sql
perform app.audit_write('pqs_config.rca_due_window_changed', 'pqs_department', v_id, null,
  'Janela de RCA do NSP definida para ' || p_days || ' dias',
  jsonb_build_object('rca_default_due_days', jsonb_build_object('old', v_old, 'new', p_days)));
```

The action verb, entity type, entity id, and metadata are all correct. Old/new value diff is included, which is strictly more useful than requested.

---

## Checklist Results

### 1. Requirements (Phase 14b–14d Acceptance Criteria)

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| 14b-AC1 | Triage worksheet saves (save_triage) and correct cross-field rules (non-PSE closure, sentinel flagging) | PASS | pgTAP 141_event_triage; E2E T5/T6 |
| 14b-AC2 | Frozen worksheet rejects edits (HC045) and reopen works (HC046) | PASS | pgTAP; E2E T2/T3 |
| 14b-AC3 | Custom sentinel criterion triggers sentinel disposition | PASS | E2E T4 |
| 14b-AC4 | Disposition computes RCA mandated with 45-day due date (assert values) | FAIL | BLOCKER-1: `triage_disposition` RPC broken at runtime (SQLSTATE 42702); E2E T1 workarounds by asserting DB state directly, not the RPC output |
| 14b-AC5 | Non-PQS user cannot call triage RPCs (42501) | PASS | E2E T9 |
| 14b-AC6 | Keyboard-only triage flow | PASS | E2E T8 |
| 14b-AC7 | NSP config area (sentinel checklist, event types, RCA due-window) | PASS | E2E T7 |
| 14c-AC1 | RCA workspace with causal model (fishbone + 5-Whys), team, timeline, evidence | PASS | pgTAP 142_rca; E2E R1–R11 |
| 14c-AC2 | Observer cannot write (HC048) | PASS | E2E R13 |
| 14c-AC3 | Non-team non-PQS gets 0 rows | PASS | E2E R14 |
| 14c-AC4 | nsp-evidence bucket rejects UPDATE/DELETE (storage immutability) | PASS | E2E R15; no UPDATE/DELETE policies in migration 121201 |
| 14c-AC5 | Assigned non-observer (plain-staff SME) CAN write | PASS | E2E R12 |
| 14c-AC6 | RCA child-lock: completed RCA rejects children edits even via RPC | PASS | pgTAP; E2E R8 |
| 14d-AC1 | CAPA plan lifecycle (open→em_execucao→em_verificacao→concluido) | PASS | pgTAP 143_capa; E2E C1–C8 |
| 14d-AC2 | Conclude gate: close blocked with open action (HC051) | PASS | E2E C9 |
| 14d-AC3 | Conclude gate: close blocked with no effectiveness verdict (HC052) | PASS | E2E C10 |
| 14d-AC4 | Reopen revokes effectiveness verdict | PASS | E2E C11 |
| 14d-AC5 | Concluded/cancelled plan rejects edits (child-lock) | PASS | E2E C12 |
| 14d-AC6 | Assignee-only action advance (assignee OK, non-assignee non-PQS → HC050) | PASS | E2E C13/C14 |
| 14d-AC7 | Foreign committee gets 0 CAPA rows | PASS | E2E C15 |
| 14d-AC8 | Every mutation in audit trail | PASS | E2E C16 |

### 2. Security / RLS

- **RLS is the boundary (Rule 1):** All 14b–14d tables have RLS enabled. No INSERT/UPDATE/DELETE client policies exist for any NSP table — all writes flow through SECURITY DEFINER RPCs, with `app.in_safety_rpc` GUC as the exclusive gate for direct-table guards. PASS.
- **Service-role key (Rule 1):** No `NEXT_PUBLIC_` exposure in any NSP file. Server actions and query functions use server-only Supabase clients. PASS.
- **PHI isolation (Rule 12):** `event_patient` is a dedicated table. `get_event_patient` in `src/lib/queries/safety-events.ts` reads it only when `event.hasPatient` is true, emits an `event_patient.read` audit row for every successful read. Triage worksheet reads are PHI-free. `audit_log` allow-lists in triage/capa triggers explicitly exclude free-text and PHI columns. PASS.
- **Storage immutability (Rule 6):** `nsp-evidence` bucket: private, 25 MiB limit. Migration `20260618121201_rca_rls_storage.sql` has no UPDATE/DELETE storage policies — confirmed. E2E R15 asserts this at runtime. PASS.
- **SECURITY DEFINER RPCs:** All write RPCs in `20260618121102_triage_rpcs.sql`, `20260618121202_rca_rpcs.sql`, `20260618121302_capa_rpcs.sql` are SECURITY DEFINER with `set search_path = app, public, pg_catalog`. All EXECUTE grants are to `authenticated` only; anon/PUBLIC EXECUTE revoked (confirmed by pattern in each migration). PASS.
- **Sentinel determination authority (Rule 3):** `app.compute_sentinel_determination` is the SQL authority. `deriveVerdict`/`isSentinel` in `src/components/safety/triage/triage-derive.ts` are the live-UX mirror. `disposition-rail.tsx` prefers the server verdict and falls back to the mirror only on error. This design is architecturally sound but is currently always falling back (due to BLOCKER-1) — making the fallback the de-facto runtime. The mirror is logically correct; however the acceptance criterion requires the authoritative SQL path to work. BLOCKER-1 must be fixed.
- **HC04x–HC05x domain error codes:** Centralized in `src/lib/safety/messages.ts`. No raw Postgres errors reach the UI (the `getTriageDisposition` fallback-on-error pattern gracefully degrades and the messages.ts mapping covers all RPC-raised codes). PASS.
- **`app.in_safety_rpc` GUC pattern:** Freeze guards (`guard_event_triage`, `guard_rca_status`, `guard_capa_status`) correctly admit writes via the GUC flag. Child locks (`guard_rca_child_lock`, `guard_capa_child_lock`) correctly key on parent status WITHOUT the GUC — this is the right design (even RPCs cannot edit completed RCA children or terminal CAPA plan children). PASS.
- **Conclude gates:** `close_capa_plan` correctly rejects on HC051 (unsettled actions) and HC052 (no effectiveness verdict). `reopen_capa_plan` deletes the effectiveness row before reverting status. Both confirmed in pgTAP and E2E. PASS.
- **`app.advance_capa_action_core`:** Narrow DEFINER exception for assignee-or-PQS action status advance (HC050 for others). Confirmed correct. PASS.
- **Source polymorphism (capa_plan.source):** Exactly-one-source CHECK constraint in `20260618121300_capa_schema.sql`. FK-less forward hooks for `source_indicator_id` (Phase 15) and `source_audit_finding_id` (Phase 18) are null-safe. PASS.

### 3. Code Quality

- **Architecture Rule 9 (data access through `src/lib/queries/`):** Triage/RCA/CAPA data-access functions are in `src/lib/queries/triage.ts`, `src/lib/queries/rca.ts`, `src/lib/queries/capa.ts`. No inline supabase-js in components. PASS.
- **TypeScript strict:** No `any` observed without inline justification in the NSP query/action layer. PASS.
- **Server Components by default:** `/admin/nsp/triagem/page.tsx`, `/admin/nsp/rca/[rcaId]/page.tsx`, `/admin/nsp/capa/[capaId]/page.tsx` are Server Components. Client components are marked `"use client"` appropriately. PASS.
- **File ownership boundaries:** Migrations (backend), query layer (backend), UI components (frontend), specs (tester) — no cross-ownership violations observed. PASS.
- **`src/lib/safety/triage-types.ts` (zero-import):** `triage-derive.ts` imports only from this module, keeping the mirror dependency-free and testable in isolation. PASS.

### 4. Audit Trail (Rule 11)

- **Mutation audit coverage:** `trg_audit_event_triage` (on event_triage), `trg_audit_rca`, `trg_audit_capa_plan`, `trg_audit_capa_effectiveness` — all confirmed in migrations. E2E C16 drives end-to-end audit trail verification across the full event→triage→RCA→CAPA chain. PASS.
- **Audit allow-lists (Rule 11 data-minimization):** `trg_audit_event_triage` allow-list: `['is_pse', 'pse_closure_reason', 'reach', 'harm_severity', 'review_pathway', 'sentinel_determination']` — correctly excludes `disposition_notes_md`. `trg_audit_capa_plan` allow-list: `['status', 'classification', 'source']` — correctly excludes `lessons_learned_md`. `trg_audit_capa_effectiveness` logs verdict only, not `method_md`. No PHI or free-text bodies copied into `audit_log`. PASS.
- **PHI read audit:** `getEventPatient` emits `event_patient.read` rows via `logAuditAccess`. Confirmed in `src/lib/queries/safety-events.ts`. PASS.
- **Mislabeled audit row (MINOR-1):** `set_pqs_rca_due_window` emits `action='triage.saved'` / `entity_type='event_triage'` with `entity_id=v_id` where `v_id` is `pqs_department.id`. Corrupts the audit log for NSP configuration changes. See MINOR-1 above.

### 5. UX / Accessibility

- **pt-BR user-facing strings:** All visible text in the triage workstation, RCA workspace, and CAPA workspace confirmed as pt-BR. HC04x–HC05x error messages in `src/lib/safety/messages.ts` are pt-BR. PASS.
- **Keyboard-only flow:** E2E T8 (triage keyboard-only). PASS.
- **Accessible inputs:** `"use client"` components use label associations. No evidence of unlabeled inputs in the NSP pages reviewed. PASS.
- **Raw Postgres errors:** None reach the UI. The `getTriageDisposition` fallback-on-error returns `null` gracefully. PASS.
- **Sanitized Markdown:** All `*_md` fields (disposition_notes_md, lessons_learned_md, method_md) are stored as Markdown per Rule 7. PASS.

### 6. Hygiene

- **ADR 0030:** Covers the PHI/HIPAA posture and PQS/NSP architecture. Referenced consistently by CLAUDE.md, ARCHITECTURE.md, and the phase plan. PASS.
- **Secrets:** No service-role key in NEXT_PUBLIC_ variables. `.env.local` not committed. PASS.
- **PROGRESS.md reflects reality:** The GATE task status ("HALTED by user") accurately reflects that the E2E gate was not formally declared green by the tester — it was declared green in the spawn prompt by the lead, not by the tester's own update to PROGRESS.md. This is a process note, not a blocking issue.
- **`docs/phases/accreditation-track.md`:** Phase 14b–14d deliverables are complete as described. The acceptance criteria gap is the BLOCKER-1 item above.

---

## Summary of Findings

| ID | Severity | Location | Requirement | Description | Status |
|----|----------|----------|-------------|-------------|--------|
| BLOCKER-1 | BLOCKING | `supabase/migrations/20260618121102_triage_rpcs.sql:392` | 14b-AC4; Architecture Rule 3 | `triage_disposition` RPC raised SQLSTATE 42702 — ambiguous `event_id` in RETURNS TABLE function body | RESOLVED 2026-06-18: qualified as `event_triage.event_id`; pgTAP 141 plan 44/44 (+5 RPC assertions) |
| MINOR-1 | MINOR | `supabase/migrations/20260618121102_triage_rpcs.sql:698` | Architecture Rule 11 | `set_pqs_rca_due_window` emitted mislabeled audit row (`action='triage.saved'`, `entity_type='event_triage'`, `entity_id=pqs_department.id`) | RESOLVED 2026-06-18: corrected to `action='pqs_config.rca_due_window_changed'`, `entity_type='pqs_department'`, with old/new value diff |

**Total:** 1 BLOCKING (resolved), 1 MINOR (resolved). **0 open findings.**

---

## BUG-14B-001 Call

**RESOLVED (re-verified 2026-06-18).** Was BLOCKING. The `triage_disposition` RPC is the declared SQL authority for the disposition verdict. Fix confirmed at line 392 of `20260618121102_triage_rpcs.sql`. pgTAP `141_event_triage` now carries 5 direct assertions against the RPC's return values for a confirmed sentinel event (`is_sentinel=true`, `verdict='rca'`, `review_pathway='rca'`, `rca_due_date=current_date+45`, and exactly 1 row returned). pgTAP 516/516 PASS. The authoritative SQL path is verified; the acceptance criterion is satisfied.

---

## Re-review Outcome

All items from the initial CHANGES REQUESTED verdict are resolved. No open findings remain. Phase 14b–14d is **APPROVED**.

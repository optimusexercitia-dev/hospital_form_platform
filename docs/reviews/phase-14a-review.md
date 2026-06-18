# QA Review — Phase 14a: NSP Foundation, Event Intake & Hand-off

**Reviewer:** `qa` (QA Reviewer)
**Date:** 2026-06-18
**Commit audited:** `1d26999`
**Test baseline:** E2E spec `e2e/phase14a-safety-events.spec.ts` 16/16 green; pgTAP `140_patient_safety.sql` 32/32 / full pgTAP 406/406; lead full-suite 211/211 green.

---

## Verdict

**CHANGES REQUESTED**

One MAJOR finding (missing RLS SELECT policy on `pqs_department`, resulting in a deny-by-default lockout for all authenticated users who might read the table). All other security-crux items pass.

---

## Findings

### MAJOR — M1: `pqs_department` has RLS enabled but zero SELECT policies

**File:** `supabase/migrations/20260618121000_patient_safety_core.sql` lines 56–59
**Requirement:** Architecture Rule 1 — "Every table has Row Level Security enabled with **explicit policies**."
**Evidence (live DB probe):**
```
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'pqs_department';
-- returns 0 rows
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'pqs_department';
-- rowsecurity = true
```

The migration creates `public.pqs_department`, enables RLS, but defines **no SELECT (or other) policy**. With RLS on and no policy, Postgres denies all access to non-owner roles by default — the only role that can read this table is the superuser/service role. This means:

- The 14b triage phase (which reads `rca_default_due_days` from this table) will fail for any authenticated RPC that selects from it directly.
- Any future UI or DEFINER path that reads `pqs_department` will silently get no rows.

**Impact today (14a):** `pqs_department` is not queried by any 14a TypeScript code (confirmed: only `src/lib/types/database.ts` references it). So no 14a runtime breakage occurs. However, the schema is non-compliant with Rule 1, and any 14b code that reads this table will encounter an RLS deny with no diagnostic.

**Required fix:** Add a minimal SELECT policy, mirroring the other singleton-config tables. Appropriate scope: any authenticated member (the PQS config name and RCA default window are not sensitive governance metadata). A one-line additive migration:

```sql
create policy pqs_department_select on public.pqs_department
  for select to authenticated using (true);
```

Or, if NSP-config reads should be restricted to PQS/admin:

```sql
create policy pqs_department_select on public.pqs_department
  for select to authenticated using (app.is_pqs_member(auth.uid()) or app.is_admin());
```

Either is acceptable; the point is that an explicit policy is required so Rule 1 is satisfied and 14b does not silently fail.

---

### MINOR — N1: `notifySafetyEvent` action returns success text in the `error` field

**File:** `src/lib/safety/actions.ts` line 98–101
**Observation:**
```typescript
return {
  ok: true,
  error: SAFETY_MESSAGES.eventNotified,   // "error" carries the success message
  eventId: data.id,
  code: data.code,
}
```
`ActionState.error` is semantically the error message. Using it as the success confirmation string is an overloaded field name. In the notify form, `onSuccess(result)` is called and the success feedback is managed client-side by `StandaloneNotify` / `NotifyEventDialog` navigating away, so no incorrect error banner is shown. However, if any consumer reads `result.error` to decide whether to display an error, it would incorrectly display "Evento notificado ao NSP." as an error.

The `NotifyEventState` type should carry a separate `successMessage` or `message` field for success text, consistent with the `ActionState` contract where `ok: true` means no error. This is a minor type-safety smell, not a functional bug in 14a.

**Fix:** Add a `message?: string` field to `ActionState` (or `NotifyEventState`) for success feedback, and stop reusing `error` for it.

---

### INFO — I1: `guard_event_custody` is SECURITY INVOKER (expected, confirmed correct)

The trigger function `app.guard_event_custody` (prosecdef=false) is SECURITY INVOKER. This is correct: trigger functions do not need DEFINER as they run in the context of the triggering statement's role, and the function body only inspects OLD/NEW row values plus the GUC flag. No security deficiency.

### INFO — I2: `success` message in `acknowledgeEvent` uses `error` field

Same pattern as N1: `actions.ts` line 113, `return { ok: true, error: SAFETY_MESSAGES.eventAcknowledged }`. Same minor concern; same fix applies.

### INFO — I3: `EventsList` rows are not links (design choice, not a bug)

`src/components/safety/events-list.tsx`: event cards in the committee read-back are not clickable links to the event detail. The code comment explains this is intentional: "in 14a the committee has read-back status only; the working detail lives in the access-audited NSP workspace." This is correct per the 14a spec which limits committee-side to read-back list + status. The 14b UI will expose the triage workstation. Noted as informational.

### INFO — I4: `pqsInbox` filter bar receives `statusOptions` from label maps re-exported through `@/lib/queries/safety-events`

`src/app/admin/nsp/page.tsx` line 15–16: imports `EVENT_STATUS_LABELS` and `SUSPECTED_HARM_LABELS` from `@/lib/queries/safety-events` (the re-export path). This works — the re-export is confirmed correct — but it is a server-only module imported in a Server Component. No client bundle issue; noted only because the canonical import is `@/lib/safety/types` per the P14a-002 fix.

---

## Security Crux Assessment

### 1. PHI isolation (Rule 12)

**PASS.**

- `event_patient` is a dedicated 0..1 satellite; `patient_safety_event` has no identifier columns (confirmed: `information_schema.columns` probe finds zero identifier columns on the event table, matching pgTAP test 27).
- `pqs_inbox` RPC output columns: no `name`, `mrn`, `date_of_birth`, `encounter_ref`, `attending`, `sex`, `age_years` in `proargnames` (pgTAP test 28).
- `listCommissionEvents` selects: `id, code, title, status, suspected_harm_level, case_id, current_owner_kind, reported_at` — zero identifiers.
- `getCaseTimeline` safety event select: `id, code, title, status, current_owner_kind, reported_at, discovered_at` — zero identifiers, no `event_patient` join on the timeline path.
- Live audit log probe: zero rows with `name`, `mrn`, `description_md`, or `attending` keys in safety entity metadata.

### 2. Access-follows-custody RLS

**PASS.**

- `app.can_read_event(event_id, uid)` is the single predicate on all three tables. It is SECURITY DEFINER, uid-pure (pgTAP-assertable), and searches: `is_member_of_for(current_owner_commission_id)` OR `is_member_of_for(reporting_commission_id)` OR `is_pqs_member(uid)`.
- pgTAP tests 8–10 prove: reporting-committee member reads a PQS-held event (provenance), admin reads, foreign committee reads 0.
- pgTAP tests 16–19 prove: after `NSP → comm_x` transfer, new custodian gains, provenance keeps, foreign still reads 0.
- Live: `patient_safety_event_select`, `event_custody_select`, `event_patient_select` policies all correctly reference `can_read_event`.
- Route gating: `/admin/nsp*` gated by `requireUser().isAdmin + patientSafetyEnabled()`; `/c/[slug]/eventos*` gated by `getCommissionAccess()` + flag.

### 3. Custody ledger append-only

**PASS.**

- `app.guard_event_custody` BEFORE UPDATE OR DELETE: DELETE → always HC043; UPDATE outside flag → HC043; UPDATE on already-closed interval → HC043; UPDATE to set `held_until = null` → HC043; any column other than `held_until` changed → HC043.
- Partial unique index `event_custody_open_interval_key` on `(event_id) where held_until is null` enforces at most one open interval per event.
- pgTAP tests 20–22 assert all three prohibited operations: closed-interval alter, open-interval non-held_until edit, DELETE all raise HC043.
- Live: no INSERT/UPDATE/DELETE policy on `event_custody` — writes only via DEFINER RPCs.

### 4. PHI `.read` auditing

**PASS.**

- `getEventPatient` (`src/lib/queries/safety-events.ts:275–324`) is the ONLY query that selects from `event_patient`.
- It calls `logAuditAccess({ action: 'event_patient.read', ... })` only when `data !== null` (a successful, in-scope read).
- When RLS denies (foreign caller) or no PHI record exists, `data = null` → no audit row. This is the correct P14a-003 fix (the `hasPatient` guard).
- `log_audit_access` allow-list (migration `...121004`) contains exactly `'event_patient.read'` as the new entry; the DB-side CHECK prevents forging mutation rows.
- `logAuditAccess` uses `import 'server-only'` (`src/lib/audit/access.ts:1`); it is never reachable from a client bundle.
- `metadata` passed is `{}` — no PHI, no free text, just "that it was read + who" (auth.uid() attributed by `app.audit_write`).
- Live audit log: 4 `event_patient.read` rows present, all with `metadata = {}`.
- `pqs_inbox` does not call `getEventPatient` or `logAuditAccess` — confirmed by reading both files.
- `listCommissionEvents` does not call `getEventPatient` — confirmed.

### 5. Audit data-minimization (Rule 11)

**PASS.**

- `trg_audit_safety_event`: allow-list `['status', 'suspected_harm_level', 'current_owner_kind', 'current_owner_commission_id']` — excludes `description_md`, `title`, `location`, and all identifiers.
- `trg_audit_event_custody`: allow-list `['owner_kind', 'owner_commission_id', 'held_until']`.
- `trg_audit_event_patient`: metadata `'{}'::jsonb` — zero columns audited (only actor and action).
- Live DB probe across all safety-entity audit rows: no `description_md`, `name`, `mrn`, `encounter_ref`, or `attending` keys present in any row's metadata.
- pgTAP test 30: `metadata::text ilike '%Fulano%' or metadata::text ilike '%MRN-12345%'` returns zero rows.

### 6. State machine + DEFINER RPCs + search_path

**PASS.**

- All six public RPCs + `pqs_inbox` are `SECURITY DEFINER` (confirmed via `pg_proc.prosecdef`).
- All have `set search_path = app, public, pg_catalog` (confirmed).
- All revoke EXECUTE from `public, anon`; grant to `authenticated, service_role` only.
- `app.guard_event_status` enforces the state machine under `app.in_safety_rpc`; direct UPDATE without the flag → HC043 (pgTAP test 14).
- `app.assert_patient_safety_enabled()` is called at the top of every RPC. Flag-gate pgTAP test 31 confirms HC (23514) when flag is OFF.
- HC043 / HC044 mapped to pt-BR in `src/lib/safety/messages.ts`; `mapSafetyError` prevents raw Postgres strings from reaching the UI.

### 7. Client/server boundary (P14a-002)

**PASS.**

- `src/lib/safety/types.ts` has zero imports (confirmed by reading the file). It exports only type literals, label maps, and interfaces.
- `src/lib/audit/access.ts` carries `import 'server-only'` at line 1.
- `src/lib/queries/safety-events.ts` and `src/lib/queries/pqs.ts` import from `@/lib/supabase/server` (server-only path).
- All `"use client"` components (`event-notify-form.tsx`, `patient-fields.tsx`, `events-list.tsx`, `acknowledge-button.tsx`, `safety-motion.tsx`, `standalone-notify.tsx`) import their types from `@/lib/safety/types` — confirmed.
- `NEXT_PUBLIC_*` env vars contain only Supabase URL and anon key; service-role key is never `NEXT_PUBLIC_*`.

### 8. Flag-gating + just-culture

**PASS.**

- Every public RPC gates `app.assert_patient_safety_enabled()` at entry.
- Every route page calls `patientSafetyEnabled()` before rendering; returns `notFound()` when false.
- `notify_safety_event` authorizes `app.is_member_of(p_reporting_commission_id) OR app.is_admin()` — any member of the reporting commission, not a role gate. A non-member gets 42501.
- pgTAP test 3 confirms a plain `staff` member (st_x) successfully files (just-culture).

---

## Acceptance Criteria Coverage Map (Phase 14a)

| AC | Description | Status |
|----|-------------|--------|
| AC-1 | Committee member files event from a case → lands in NSP inbox + case timeline | PASS — `notify_safety_event` writes `case_events` row + `pqs_inbox` surfaces it; `getCaseTimeline` composes `safety_event` rows |
| AC-2a | NSP acknowledges (records who/when) | PASS — `acknowledge_event` stamps `acknowledged_by/at`; pgTAP test 12 |
| AC-2b | Reporting committee sees status read-back | PASS — `listCommissionEvents` scoped to reporting OR holding |
| AC-2c | Foreign committee sees nothing | PASS — RLS `can_read_event` provenance-aware; pgTAP test 9; Farmácia reads 0 CCIH events |
| AC-3 | Custody transfer grants new holder, keeps provenance, revokes no prior provenance | PASS — `transfer_event_custody` closes prior interval, appends new, updates denormalized owner; pgTAP tests 16–19 |
| AC-4 | Isolated `event_patient` PHI reads only within scope | PASS — same `can_read_event` scope; pgTAP tests 24–25 |
| AC-4b | Every PHI read writes a `.read` audit row | PASS — `getEventPatient` wired to `logAuditAccess`; live audit log has 4 rows with `{}` metadata |
| AC-5 | Stand-alone (case-less) event works | PASS — `/c/[slug]/eventos/novo` + `StandaloneNotify`; pgTAP test 7 (stand-alone notify) |
| AC-6 | One keyboard-only pass | PASS — F5 accessibility pass: `<label>` wrapping + `htmlFor`, `<fieldset>/<legend>` for PHI, `aria-invalid`+`role=alert`, visible focus rings, reduced-motion guard |
| pgTAP | Event-number minting; state-machine+freeze; access-follows-custody; custody append-only; PHI isolation; flag-gate | PASS — 32/32 |

---

## Code Quality Assessment

**Architecture Rule 9 (queries layer):** All data access goes through `src/lib/queries/safety-events.ts` and `src/lib/queries/pqs.ts`. No inline supabase-js in components. PASS.

**Architecture Rule 7 (sanitized Markdown):** `description_md` is rendered via `MarkdownRenderer` in the event detail (`src/app/admin/nsp/[eventId]/page.tsx:149`). The notify form uses `SectionTextEditor` for Markdown input. PASS.

**Architecture Rule 10 (pt-BR):** All user-facing strings are pt-BR. Label maps in `src/lib/safety/types.ts` cover all domain unions. Error messages in `src/lib/safety/messages.ts` are pt-BR. The `mapSafetyError` function prevents raw Postgres errors reaching the UI. PASS.

**TypeScript strict:** `src/lib/safety/types.ts` has zero `any` usage. `src/lib/queries/safety-events.ts` uses explicit typed row interfaces with `.returns<T>()` for all queries. `src/lib/safety/actions.ts` has no `any`. PASS.

**Server Components by default:** All page components are async Server Components. Client directives `"use client"` only where required (interactive form, motion, button hooks). PASS.

**ADR coverage:** ADR 0030 (umbrella PHI posture) and ADR 0031 (custody-ledger + PHI isolation) both exist, are complete, and the implementation matches the decisions as documented. PASS.

**`PROGRESS.md` accuracy:** The B1–B6 / F1–F5 / T1 task table is complete and reflects the actual implementation including bug fixes P14a-002 and P14a-003. PASS.

---

## Summary

One MAJOR finding blocks approval: `public.pqs_department` has RLS enabled but no SELECT policy, violating Architecture Rule 1. While no 14a code reads this table at runtime, the gap will cause silent failures in Phase 14b when triage RPCs read `rca_default_due_days`. The fix is a one-line additive migration.

One MINOR finding (reuse of the `error` field for success messages in `ActionState`) does not affect correctness in 14a but is a type-safety smell.

All eight security-crux items — PHI isolation, access-follows-custody RLS, custody append-only, PHI read auditing, audit data-minimization, state machine integrity, client/server boundary, and flag-gating — **pass**. The PHI/HIPAA foundation is correctly implemented: the platform's first PHI is isolated, minimum-necessary, access-follows-custody, and every access is audited with empty metadata.

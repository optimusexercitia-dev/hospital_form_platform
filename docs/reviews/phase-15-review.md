# Phase 15 — Quality Indicators (Indicadores de Qualidade) — QA Review

**Reviewer:** `qa` · **Date:** 2026-07-06 · **Branch:** `feat/phase-15-indicators`
**Spec:** `docs/phases/accreditation-track.md` § Phase 15 (L284–381) ·
**Decisions:** ADR [0057](../decisions/0057-indicators-doc-control-replan.md),
[0058](../decisions/0058-derived-measurement-compute.md) · **Backend plan:**
`docs/plans/phase-15-indicators-backend.md`

## Verdict: ✅ **APPROVED**

0 BLOCKER · 0 MAJOR · 3 MINOR · 4 INFO.

Phase 15 is a clean, well-executed phase. The three lead-locked decisions (DEFINER-only
write posture, PHI-free rollup gate, manual-`taxa` allowed) all shipped exactly as
specified, and every acceptance clause is met. The load-bearing security invariants and
the derived-compute parity lock were **independently re-verified live** against the running
local DB with RLS-simulated seeded personas (not just tests-green). The three MINORs are
polish/robustness nits that do not block the gate; none is a security hole.

---

## 1 · Requirements coverage

| Acceptance clause (spec L362–380) | Delivered? | Evidence |
| --- | --- | --- |
| Manual indicator (meta ≥ 90%) → trend + exact on/off classification | ✅ | `record_indicator_measurement` computes value + `indicator_classify`; E2E AC-1; live manual-taxa `3.0/na_meta` |
| Derived indicator by option `code` **==** Phase-8 dashboard aggregate (assert equality) | ✅ | **Parity verified LIVE**: IND-0002 compute → num=2/den=6, `dashboard_distributions` → 2/6 (identical). pgTAP parity lock (110_indicators.sql #1–3); E2E AC-2 |
| `tempo_medio` == avg of seeded `value_number` | ✅ | compute avg(value_number); pgTAP #4 (25 == avg(10,20,30,40)); E2E AC-3 |
| Hybrid `taxa` one-step (derived num + typed denom) + preserve-on-recompute | ✅ | `compute_derived_measurement` §3.4 preserve rule + HC088; pgTAP #5; E2E AC-4 |
| Off-target → "Abrir CAPA" to PQS operator; plan carries `source_indicator_id` + derived `hospital_id`; commission members read it | ✅ | `open_capa_plan` indicator arm (live: hospital derived from commission); `can_read_capa` indicator arm; E2E AC-5b; pgTAP #12 |
| Only the action-item fallback to a non-operator staff_admin | ✅ | `CapaAffordance` capability-gates on `isPqsOperator`; non-operator → `ActionItemFallbackDialog` → `createManualActionItem`; E2E AC-5a; live non-operator 42501 |
| Loop closes across Phases 14+15 (CAPA measure cites indicator + later measurement) | ✅ | `capa_measure.indicator_id` real FK resolves; E2E AC-6; pgTAP #11 |
| Editing a measurement writes an audit row (Phase 13) | ✅ | **Verified LIVE**: record → `indicator_measurement.recorded`, edit same (indicator,period) → `.updated` |
| `staff` cannot edit indicators | ✅ | **Verified LIVE**: RPC → 42501; direct INSERT → permission denied |
| Foreign-commission user gets no read | ✅ | **Verified LIVE**: hospital-B staff_admin reads 0 CCIH indicators |
| `hospital_admin` sees rollup across its commissions; foreign hospital_admin sees nothing | ✅ | **Verified LIVE**: hosp-A admin sees per-commission counts; plain staff → 0 rows |
| One keyboard-only pass | ✅ | E2E AC-9 (record via dialog, keyboard-only) |
| pgTAP: parity lock, unknown-code rejected at save, hybrid denom-required + preserve, RLS scoping + rollup PHI-free SELECT-list, off-target both directions, KPI counts, FKs resolve | ✅ | 110_indicators.sql (26 assertions), all clauses present + acceptance-mapped |

---

## 2 · Security / RLS (Architecture Rule 1) — the priority

All findings below were verified **live** against the running local DB (RLS-simulated per
seeded persona), corroborating the pgTAP keystones.

- **Member-read scoping ✅** — `indicators_select` / `indicator_measurements_select` use the
  live combined predicate `is_member_of(commission_id) OR is_commission_admin_of(commission_id)`
  (measurements resolve the commission via the parent indicator). A plain **staff** of CCIH
  reads all 4 CCIH indicators; a **foreign-commission** staff_admin (hospital B) reads **0**.
- **DEFINER-only write posture (decision 1) ✅** — Both tables have RLS enabled and **only a
  SELECT policy** (`polcmd = r`); **no** INSERT/UPDATE/DELETE policy. `authenticated` holds
  **only SELECT** (verified via `information_schema.role_table_grants`); the migration's
  belt-`revoke insert,update,delete` is effective. A staff member's direct INSERT →
  *"permission denied for table indicators"*. Every write flows through a `SECURITY DEFINER`
  RPC that enforces `is_staff_admin_of OR is_commission_admin_of` and computes `value`/`status`.
  This is coherent and strictly least-privilege.
  - **Defense-in-depth bonus:** the internal `app.reclassify_indicator_measurements` is
    `SECURITY INVOKER` and directly executable by `authenticated`, but a direct call **fails**
    ("permission denied … indicator_measurements") because posture (b) revokes UPDATE — the
    only path that can mutate a measurement is the DEFINER RPCs. No write leak.
- **`can_write_capa` UNTOUCHED ✅** — Live body is byte-for-byte the WS-3c posture:
  `is_pqs_operator_of_for(capa.hospital_id, uid)` only. Phase 15 did **not** widen CAPA
  authoring. `open_capa_plan`'s authority check (`is_pqs_operator_of(v_hospital)` → 42501) is
  unchanged; only the `v_hospital` CASE gained the `indicator` arm (derives from the
  indicator's commission).
- **`can_read_capa` indicator arm ✅** — Adds exactly one OR term exposing an
  `source='indicator'` plan to the indicator's commission members via
  `is_member_of_for(i.commission_id, uid)` (uid-pure, correct for a DEFINER predicate). The
  first two arms are unchanged. A foreign member cannot read (pgTAP #12).
- **Rollup DEFINER PHI-free + correctly scoped (decision 2) ✅** — Gate is
  `is_admin() OR is_hospital_admin_of(p_hospital) OR is_org_admin_of(org_of_hospital(p_hospital))`.
  The `RETURNS TABLE` SELECT-list is exactly `commission_id, commission_name, total, na_meta,
  fora_da_meta, sem_dados` — counts + names only, **no** indicator name/definition/value/
  `description_md` (asserted by pgTAP #10's `proargmodes` column-name check). Live: hospital-A
  admin sees per-commission counts; a non-admin of the hospital sees **0 rows**.
- **`derived_config` option-code validation at save ✅** — `validate_indicator_derived_config`
  checks shape-per-kind and every referenced option `code` (+ denominator `question_key`)
  against `latest_published_version` via `version_has_option_code`; unknown → **HC084** at
  save time (pgTAP #6). `tempo_medio` requires a `number` item (a valid item type in the
  post-normalization schema).
- **SQLSTATEs `HC084`–`HC088` ✅** — Correctly allocated (not the stale HC054/HC058). HC084
  (config), HC085 (compute on manual), HC086 (record on derived), HC087 (zero denom), HC088
  (hybrid denom required). Verified live: HC085 raised when a manual taxa is routed to
  `compute_derived_measurement`.
- **Manual `taxa` (decision 3) ✅** — Table CHECKs are two one-way implications
  (`hibrido⇒taxa`, `derivado⇒non-taxa`), not a biconditional. Live: a `taxa`+`manual`
  indicator is insertable and routes through `record_indicator_measurement`
  (`num/den×1000`); the `compute`/`record` split keys on `data_source`, not `kind`.
- **Two-tier CAPA needs `patient_safety` (INFO-1)** — `open_capa_plan` opens with
  `assert_patient_safety_enabled()`, so the indicator→CAPA escalation requires the NSP module
  flag ON. This is correct by design (CAPA remains an NSP instrument) but worth noting for
  deployment sequencing: on a hospital with `quality_indicators` ON but `patient_safety` OFF,
  the PQS-operator "Abrir CAPA" path is unavailable and only the action-item fallback works.

---

## 3 · Rule compliance

- **Rule 8 (types) ✅** — `src/lib/types/database.ts` regenerated (20 references to the new
  tables/RPCs); TS imports types only from `@/lib/types` / `@/lib/indicators/types`.
- **Rule 9 (data access) ✅** — All reads go through `src/lib/queries/indicators.ts`; no
  inline supabase-js in components. `listCapaPlansForIndicator` selects scalar `capa_plan`
  columns only (no `indicators(...)` embed) — avoids the PGRST201 ambiguous-embed risk the new
  FKs introduce.
- **Rule 10 (pt-BR) ✅** — User-facing strings and RPC exceptions are pt-BR; labels centralized
  in `@/lib/indicators/types` (`INDICATOR_KIND_LABELS`, `DATA_SOURCE_LABELS`, …). Code /
  comments / commits in English.
- **Rule 11 (audit) ✅** — AFTER INSERT/UPDATE/DELETE triggers on both tables via
  `audit_write` + `audit_diff` over a **constant non-sensitive allow-list**; `indicators`
  excludes `description_md` + `derived_config`, `indicator_measurements` excludes `note`.
  **Verified live**: a free-text note ("SEGREDO…") does **not** appear in the audit `metadata`
  or `summary`.
- **Rule 12 (PHI-free) ✅** — Indicators are aggregate process metrics; no patient columns.
  Grep of Phase-15 client code found no `service_role`/secret references. The rollup SELECT-list
  is PHI-free (§2).
- **HC0xx class ✅** — Custom SQLSTATEs continue the platform's `HC0xx` class.

---

## 4 · Code quality

- **TS `strict` ✅** — `npm run typecheck` clean. **No `any`** in any Phase-15 TS/TSX
  (grep-verified).
- **Server Components by default ✅** — List/panel/scorecard/format are Server Components;
  `"use client"` only on interactive surfaces (dialogs, builder, run chart, buttons).
- **RSC server→client boundary ✅** — `CapaAffordance` / `MeasurementGrid` receive
  `openCapaFromIndicator` / `createManualActionItem` / `recordIndicatorMeasurement` /
  `computeDerivedMeasurement` as props, but these are **top-level imported Server Actions**
  (serializable references), which is the supported RSC pattern — NOT the BUG-QI-001
  anti-pattern (non-action closures / href-builders). Confirmed: `nspHref`/`commissionHref`
  are called *inside* components, never passed as props. No serialization hazard.
- **pt-BR error mapping ✅** — `mapIndicatorError` maps HC084–HC088 + 42501 + 23514 to pt-BR
  strings; no raw Postgres error text reaches the UI (see MINOR-2 for a narrow edge).
- **Accessibility ✅** — Measurement grid: `<table>` + `<caption class="sr-only">`,
  `scope="col"`/`scope="row"`, `Field`/`FieldLabel`/`FieldError` (`htmlFor`/`id`),
  `aria-invalid`, `role="alert"` errors; Radix Dialog focus trap + keyboard. E2E AC-9 exercises
  a keyboard-only record flow.
- **Derived-compute correctness ✅** — `compute_derived_measurement` re-uses the same submitted
  spine (`submitted_form_responses`), the same option-`code` join chain, and the same
  `submitted_at::date` window as `dashboard_distributions`, so parity holds **by construction**
  (verified live). The hybrid preserve-on-recompute re-derives only the numerator and reuses the
  stored denominator; `sem_dados` stays the only empty state.

---

## 5 · Itemized findings (non-blocking)

### MINOR-1 — Fully-derived compute UI does not pass a period window
`ComputeDerivedDialog` (`src/components/indicators/measurement-grid.tsx` L335–410) submits only
`periodLabel` for a `derivado` indicator — no `periodStart`/`periodEnd`. With null bounds,
`compute_derived_measurement` skips the `submitted_at::date` window and aggregates **all-time**
submitted responses, regardless of the period label. This is internally consistent with the
parity lock (which also compares all-time) and the pgTAP tests, so acceptance passes — but a
measurement labeled `2026-06` on a derived indicator counts every period's submissions, which
may surprise a user expecting a monthly bucket. The RPC *accepts* the window params; only this
dialog doesn't surface them. **Recommend** (fast-follow): let the derived dialog optionally
capture the period window (as the manual/hybrid paths can), or document that a derived value is
cumulative-to-date. Not a security or correctness bug against the stated acceptance.

### MINOR-2 — `error.message` returned verbatim for HC084 and 23514
`mapIndicatorError` (`src/lib/indicators/actions.ts` L94, L106) returns `error.message` directly
for `HC084` and `check_violation (23514)`. For HC084 the RPC's message is a deliberate pt-BR
string (`'código de opção desconhecido: %'`) — fine. For 23514 the message is usually the RPC's
own `'indicador não encontrado'`, but a raw table CHECK-constraint violation (e.g. a
`data_source`/`kind` coherence CHECK reached before the validator) would surface an English
constraint name to the UI, brushing against §8 ("raw Postgres errors never reach the UI").
Low likelihood (the RPCs validate before insert), but **recommend** falling back to
`MESSAGES.generic` unless the message is known-pt-BR.

### MINOR-3 — Unused `_measurementId` parameter (lint warning)
`openCapaFromIndicator(indicatorId, _measurementId)` (`actions.ts` L414–416) leaves
`_measurementId` unused (the plan links to the indicator, not a measurement). ESLint emits one
`no-unused-vars` warning (0 errors). It's underscore-prefixed and JSDoc-documented as
intentional. Cosmetic; drop the param or keep as-is.

### INFO-1 — Indicator→CAPA escalation is gated on `patient_safety`
See §2. Correct by design (CAPA is NSP-owned); flagged for deployment sequencing awareness.

### INFO-2 — Derived denominator section resolved from latest published version
For a `{question_key}` derived denominator, `compute_derived_measurement` resolves the
denominator question's section from `latest_published_version`, whereas `dashboard_distributions`
derives it from the answered version's `sel`. Identical for single-version data (the parity
case). If the denominator question moves sections across a re-publish, the two could diverge for
mixed-version windows — an edge outside the current acceptance surface. Noted for future
cross-version work.

### INFO-3 — Extra migration `…000250_indicators_reads.sql`
The read RPCs landed in a separate `…000250` migration (plan filed them under B5 in `…000100`).
Additive, forward-only, correctly ordered. No issue.

### INFO-4 — pgTAP re-run requires the full ordered `supabase test db`
Per the standing gotcha, the indicators pgTAP suite is not independently runnable (pgtap +
`test_helpers` exist only in the ephemeral test DB). I did not re-run the full 1670-assertion
suite (established by the tester); instead I live-verified the load-bearing invariants directly
against the running DB (§2). The single-file run against the dev DB is expected to fail on
`plan()` — not a regression.

---

## 6 · What I verified live (summary)

Flag `quality_indicators = true` · RLS enabled + SELECT-only grant on both tables · member-read
works (staff sees own commission) · foreign-commission read = 0 · staff RPC-write = 42501 ·
staff direct-INSERT = permission denied · manual `taxa` insertable + records via `record_*` ·
compute-on-manual = HC085 · **parity: compute 2/6 == dashboard 2/6** · measurement edit audited
(`.recorded`→`.updated`) · note not leaked into audit · rollup scoped (hosp-admin sees counts,
foreigner sees 0) + PHI-free SELECT-list · KPI foreign-commission = empty · both CAPA FKs
resolve to `public.indicators` (ON DELETE SET NULL) · `can_write_capa` untouched · `can_read_capa`
indicator arm present · reclassify defense-in-depth (invoker UPDATE denied) · `tsc` clean ·
eslint 0 errors / 1 warning · no `any` / no service-role in client code.

**Gate recommendation: APPROVED — proceed to human approval.** The three MINORs are suitable
fast-follows and none blocks the phase.

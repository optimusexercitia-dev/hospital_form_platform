# Phase 15 — Quality Indicators (Indicadores de Qualidade)

**Status:** ✅ COMPLETE — 2026-07-06. Build order **15 → 17 → 16** (ADR
[0057](../decisions/0057-indicators-doc-control-replan.md)); pilot after Phase 16.
Branch `feat/phase-15-indicators` → merged to `main` (local; `origin/main` not pushed).
Flag `quality_indicators` seeded **ON**. Migrations `20260712000000`–`20260712000300`.
New SQLSTATEs **HC084–HC088**.

- **Spec:** [accreditation-track.md § Phase 15](../phases/accreditation-track.md)
- **Decisions:** ADR [0057](../decisions/0057-indicators-doc-control-replan.md) (re-plan) ·
  ADR [0058](../decisions/0058-derived-measurement-compute.md) (derived-compute parity)
- **QA review:** [phase-15-review.md](../reviews/phase-15-review.md) — ✅ APPROVED
  (0 BLOCKER · 0 MAJOR · 3 MINOR · 4 INFO), all 3 MINOR fixed pre-merge.
- **Backend surface:** [backend-state.md](../backend-state.md) § Quality Indicators.

## What shipped

A managed quality-indicator module: numerator/denominator metric with target +
comparator, frequency, direction; measured period-by-period and classified
`na meta` / `fora da meta` / `sem dados`. Three data sources:

- **manual** — coordinator enters numerator/denominator per period (incl. hand-entered `taxa`).
- **derivado** — value computed from submitted-form aggregates via option `code`s
  (`percentual`/`contagem`) or `answers.value_number` (`tempo_medio`); **equals the
  Phase-8 dashboard aggregate for the same window by construction** (parity lock).
- **híbrido** — derived numerator + manually-supplied denominator, one-step compute;
  recompute preserves the stored denominator when not re-passed.

Off-target → **two-tier CAPA escalation** (ADR 0057): PQS operators get "Abrir plano de
ação (CAPA)" (routes `open_capa_plan` `p_source='indicator'`, hospital derived from the
indicator's commission); non-operator staff_admins get the shared Action-Items Hub
fallback ("Criar item de ação"). `can_write_capa` **untouched** (WS-3c posture).

Hospital-admin **scorecard** rollup (`hospital_indicator_rollup`, PHI-free counts),
commission-dashboard **Indicadores** KPI panel, Recharts run-chart with target line +
warning band + accessible data table. PHI-free by design (Rule 12 N/A).

## Task ledger

| ID | Owner | Task | Result |
| -- | ----- | ---- | ------ |
| B1 | backend | Verify live CAPA hook surface (post-WS-3c/NSP-per-hospital) + post typed contract stubs (`queries/indicators.ts`, `indicators/actions.ts`); migration/RLS/RPC + derived-compute plan + ADR. | ✅ plan + ADR 0058 **APPROVED**; 3 lead decisions folded in (see below). |
| B2 | backend | Migration `indicators` + `indicator_measurements`; per-commission `code` mint; flag seed **OFF**; RLS **(b) DEFINER-only writes** (member-read SELECT + grant; no direct write grant); audit AFTER-triggers (non-sensitive allow-list). **manual `taxa` allowed** (2 one-way CHECKs, not a biconditional). | ✅ `20260712000000` |
| B3 | backend | CRUD + measurement RPCs (`create/update/archive_indicator`, `set_indicator_target`, `record_indicator_measurement`); both-direction off-target; HC084+. | ✅ `20260712000100` |
| B4 | backend | **Derived compute** `compute_derived_measurement(indicator, period, p_denominator := null)` DEFINER — percentual/contagem via option `code`s, tempo_medio via `value_number`, hybrid one-step; **parity lock vs `dashboard_distributions`**. | ✅ `20260712000200` (parity live-verified num=2/den=6) |
| B5 | backend | Read RPCs `indicator_series`, `indicator_kpis` (`is_staff_admin_of OR is_commission_admin_of`), `hospital_indicator_rollup` (PHI-free, hospital-admin/org-admin gated); query-layer readers. | ✅ `20260712000250` |
| B6 | backend | Two-tier CAPA hook: FKs `capa_plan.source_indicator_id` + `capa_measure.indicator_id`; `open_capa_plan` indicator arm (hospital from commission); `can_read_capa` indicator arm; flag flip **ON**; pgTAP. | ✅ `20260712000300` (`can_write_capa` untouched; pgTAP 110_indicators 26 assn + 143 fix) |
| B7 | backend | F5-driven contract adds (no schema change): `createManualActionItem` (manual-source hub action, non-operator fallback) + `hospitalId` on `Indicator`/`getIndicator`/`listIndicators` for F5 button-gating; flag wiring + `qualityIndicatorsEnabled()`. | ✅ `4736e02` |
| F1 | frontend | `manage/indicadores/**` list + builder (definition, target/comparator, frequency, data source). New route group. | ✅ 5 routes + org scorecard; derived-config picker |
| F2 | frontend | "Criar a partir de modelo" — in-app pt-BR template catalog (ANVISA/NSP + CCIH/quality) prefilling the builder. | ✅ 12-template catalog (3 categories) |
| F3 | frontend | Measurement entry grid + hybrid compute dialog (shows derived numerator, asks denominator). | ✅ manual/derived/hybrid dialogs; preserve-on-recompute; HC084–088 surfaced |
| F4 | frontend | Indicator detail run chart / trend-vs-target (Recharts) + warning bands + status chip. | ✅ run chart + target line + warning band + accessible table |
| F5 | frontend | Off-target → two-tier CAPA affordance (operator "Abrir CAPA" + non-operator fallback). | ✅ both arms; gated on `indicator.hospitalId` ∈ NSP grants; `listCapaPlansForIndicator` display |
| F6 | frontend | Indicadores dashboard panel + hospital scorecard on the hospital-admin surface. | ✅ KPI panel (`getIndicatorKpis`) + org scorecard (`getHospitalIndicatorRollup`) + nav |

## Lead decisions (B1 approval, 2026-07-05)

1. **RLS write posture → DEFINER-RPC-only (option b),** not the spec's literal
   "staff_admin-write policy." Greenfield table, no PHI → least-privilege realization
   (member-read SELECT + grant; no unused direct-write grant), which also guarantees
   `value`/`status` are always RPC-computed. Write authority stays
   `is_staff_admin_of OR is_commission_admin_of` inside the RPC.
2. **Rollup gate** = `is_admin() OR is_hospital_admin_of OR is_org_admin_of(org_of_hospital)`.
3. **Manual `taxa` restored.** Backend's biconditional `(kind='taxa')=(hibrido)` wrongly
   banned a hand-entered rate (a common CCIH case) → replaced by `hibrido⇒taxa` +
   `derivado⇒non-taxa`; HC085/HC086 route on `data_source`. Parity-by-construction lock
   (ADR 0058): derived == dashboard because `compute_derived_measurement` replicates the
   `dashboard_distributions` mechanics (submitted spine, option-`code` grouping, window).

## Test gate — fix loop

- **Build-complete gate PASSED (lead-verified):** tsc 0 · lint 0 err · Vitest 206/206 ·
  `next build` 0 · full local pgTAP 67 files / 1670 tests PASS (26 Phase-15 keystones incl.
  parity lock, hybrid preserve/HC088, both-direction off-target, RLS posture-(b)
  direct-INSERT-denied, PHI-free rollup SELECT-list, two-tier CAPA).
- **Iteration 1 — BUG-QI-001 (BLOCKER, frontend):** every indicator detail page crashed to
  the `error.tsx` boundary on the prod (standalone) build — a **server closure passed as a
  prop to a client component** (`capaHref` → `<CapaAffordance>`), an RSC-serialization error
  NOT caught by `next build`/tsc. Fixed by sweeping ALL function/closure props across the
  server→client boundary (`CapaAffordance`/`IndicatorBuilder`/`IndicatorList` take plain
  strings + build hrefs internally via the pure `routing.ts`). A **second** bug found while
  verifying: F4 run-chart `next/dynamic({ ssr:false })` left the skeleton stuck on the
  standalone prod server → removed `ssr:false` (Recharts SSRs cleanly). Re-run **GREEN:
  full Phase-15 spec 12/12** on standalone prod.
- **Full-regression triage:** the monolith full run collapses on Windows/Next-16.2.9
  prod-standalone (listen-backlog exhaustion under Playwright bursts, same family as
  AIF-001) — NOT a code crash (a single server served 600 rapid `curl`s alive, 0 refused).
  Verdict via **chunked batches** (fresh server + db-reset each): **no Phase-15 regression** —
  Batch A (touched CAPA/NSP/audit surfaces) 76/76 clean; `phase8-dashboard` alone 24/24
  (F6 panel doesn't degrade the dashboard); all batch failures = env conn-refused /
  AIF-001 baseline / db-502 contamination. See memory `e2e-prod-build-flaky-baseline`.

## QA MINORs — all fixed pre-merge (2026-07-06)

- **MINOR-1 (frontend + backend-verify)** — fully-derived/hybrid compute dialogs submitted
  only `periodLabel` → derived value aggregated **all-time** (flat trend). Fix: a shared
  `PeriodWindowFields` component (new `src/components/indicators/period-window-fields.tsx`)
  adds `periodStart`/`periodEnd` (`type="date"`, `required`) to the manual, derived, and
  hybrid dialogs, auto-derived from the monthly label (`YYYY-MM` → 1st/last day, leap-safe)
  so the common case is one-click, both editable. FormData names match the actions'
  reads exactly (`periodStart`/`periodEnd` → `p_period_start`/`p_period_end`);
  `computeDerivedMeasurement` already forwarded the window (parity lock unaffected — the RPC
  is called with explicit args). Browser + DB verified period-scoped persist.
- **MINOR-2 (backend)** — `mapIndicatorError` no longer echoes raw `error.message`: HC084
  returns the message only if it matches a known pt-BR allow-list or the dynamic
  `código de opção desconhecido:` prefix; **23514 CHECK violations always** fall back to the
  generic pt-BR string. No raw-Postgres leak (§8, Rule 10).
- **MINOR-3 (backend)** — cleared the unused `_measurementId` lint warning (kept the param —
  it's the posted F5 contract — with a targeted disable + justification).

### Spec realignment for MINOR-1 (tester-owned)

Adding the two `required` window fields legitimately broke two of the phase's own specs;
the tester (not engineers) realigned `e2e/phase15-indicators.spec.ts`:

- **AC-4 (hybrid)** — `getByLabel(/período/i)` matched 3 labels ("Período" + "Início/Fim do
  período") → strict-mode violation → anchored to `getByLabel('Período', { exact: true })`.
  Also: with the window now honored, the old far-future throwaway period `2098-07` legitimately
  derives numerator **0** (seeded `'nao'` responses are `now()`-relative) → retargeted the
  throwaway period to the **current month**, computed dynamically (correct on any gate date).
- **AC-9 (keyboard)** — the tab order is now Período → Início → Fim → Numerador; the single
  `Tab` landed on `periodStart`. Fixed by `.focus()`-ing the numerator directly (native
  `type="date"` internal segments make tab-count crossing flaky) — matches the spec's existing
  `.focus()` style; still fully keyboard-driven.

**Authoritative merge gate (lead, prod standalone rebuild):** full
`phase15-indicators.spec.ts` **12/12 passed, 0 conn-refused, 0 failures**. Blast radius of
the minors confirmed contained — `period-window-fields.tsx` is imported only by the two
indicator dialogs, so this spec is the only one the minors could affect; the rest of the
suite was already triaged no-regression pre-approval.

## Follow-up notes

- AC-4's throwaway period is now current-month-dependent for a non-zero derived/hybrid
  numerator (self-consistent — the seed's `'nao'` responses are `now()`-relative, so they
  move together). Only matters if a future spec hard-pins a far-future period for a
  derived/hybrid compute expecting non-zero. AC-2 is safe (drives compute via the RPC with an
  explicit `p_period_label`, asserts the all-time-equivalent seed value).
- Frontend-audit follow-up (external consultant 2026-07-05, 10 items) remains OPEN in
  PROGRESS Follow-ups — independent of Phase 15.
- Remote deploy (`supabase db push` / `reset --linked`) **deliberately deferred** to the
  pilot (post-Phase-16, ADR 0057) — a separate user-authorized gate step. Local `main` merge
  only; `origin/main` not pushed.

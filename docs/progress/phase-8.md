# Phase 8 — Dashboards & Submissions Browser (archived task detail)

**Status:** ✅ complete — Build ✅ · Tests ✅ 106/106 · QA ✅ APPROVED · Human ✓ 2026-06-14.
Design: ADR [0020](../decisions/0020-dashboard-countable-responses.md). Review:
[docs/reviews/phase-8-review.md](../reviews/phase-8-review.md). Backend surface map updated in
[docs/backend-state.md](../backend-state/README.md). The cross-phase logs (Bug Log, Test Run Summary,
QA Verdicts, Decisions, Follow-ups) remain in `PROGRESS.md`.

Migrations `…090011`–`…090015`; query modules `src/lib/queries/{dashboard,submissions}.ts`;
CSV route `src/app/c/[slug]/dashboard/export/route.ts`; UI under
`src/app/c/[slug]/dashboard/**` + `src/app/admin/painel/**` + `src/components/dashboard/**`;
spec `e2e/phase8-dashboard.spec.ts` (24 tests). Commits `ae2acd7`→`49ed2dc` on the phase branch.

## Backend (`backend`)

| ID | Task | Outcome |
| -- | ---- | ------- |
| B1 | Contract-first typed query signatures FE depends on. | ✅ stubs committed (`dashboard.ts` + `submissions.ts`); types posted to lead, FE built against them. |
| B2 | Dashboard aggregation **definer** RPCs (mirror ADR 0016): submitted-only via canonical helper, checkbox unnest, per-section denominator, keyed by `question_key`. | ✅ migration `…090011` (5 definer RPCs + `app.submitted_form_responses`/`app.latest_published_version`, `is_staff_admin_of OR is_admin`-gated, `search_path` pinned); `dashboard.ts` pivots; pgTAP `100_dashboard.sql` incl. conditional-denominator=2, checkbox unnest, case-phase exclusion. |
| B3 | Submissions browser queries: list submitted (member/form/date) + opt-in in_progress metadata-only; version-faithful detail. | ✅ **NO new RLS/migration** — existing `responses_select`/`answers_select` already grant staff_admin the submitted cross-member read AND deny in_progress. `listSubmissions` (answers-free, `isCasePhase` badge), `getSubmissionDetail` (version-faithful tree + answers + signoffs; foreign in_progress → null/404), filter-option lists. |
| B4 | CSV export of raw submitted responses (one column per `question_key` + per-signed-section sign-off-status column). | ✅ `dashboard_export_rows` definer RPC (`…090013`, standalone-only) + `getFormExport()` + route `dashboard/export/route.ts` (staff_admin/admin-gated, pt-BR headers, UTF-8 BOM, RFC-4180). Date-aware after MINOR-1 (`…090015`). |
| B5 | Admin cross-commission overview query. | ✅ `commission_overview()` definer RPC (`is_admin`-gated, case-phase-excluded counts) folded into `…090011`; `getCommissionOverview()`. |
| B6 | Hardening: revoke anon DML/EXECUTE (P1 INFO-1); `archive_process_template` HC023 guard (P7 MINOR-2); HC017 pgTAP (P7 MINOR-1). | ✅ `…090012` revokes anon **AND PUBLIC** DML/EXECUTE on `public` (anon inherited EXECUTE via PUBLIC). HC023 guard + HC017 pgTAP found ALREADY PRESENT — added missing HC023 assertion. **Follow-up `…090014`:** closed a re-leak (`dashboard_export_rows` re-inherited PUBLIC EXECUTE after the revoke) + durable `alter default privileges … revoke execute on functions from public`; generic "zero anon-executable public functions" pgTAP guard. |

## Frontend (`frontend`)

| ID | Task | Outcome |
| -- | ---- | ------- |
| F1 | `frontend-design` skill; `/c/[slug]/dashboard` route group + shell + staff_admin gating + loading/error. | ✅ `dashboard/{page,loading,error}.tsx` + `dashboard-forms.tsx` (URL-driven form picker); nav "Painel" flipped `null`→`dashboard`. Gating verified (staff_admin→200, plain staff→in-shell 404, nav scoped). |
| F2 | Recharts charts: bar/pie for choice, trend line for volume; grouped by section; per-distribution denominator caption. | ✅ `{distribution-chart,volume-trend,free-text-samples,dashboard-charts,use-reduced-motion}.tsx`. Bar default; pie only ≤4-opt single-select; checkbox always bar. EVERY chart paired with a real `<table>` (SVG `aria-hidden`); `n de N` caption per distribution; reduced-motion-gated; `--color-chart-*` tokens. |
| F3 | Date-range filter + CSV export button. | ✅ `dashboard-filters.tsx`: labeled native date inputs, URL-driven, "Limpar período"; CSV `<a download>` → backend export route (`?form=&from=&to=`). |
| F4 | Submissions browser list + member/form/date filters + opt-in "em andamento" (metadata-only). | ✅ `dashboard/submissions/{page,loading}.tsx` + `{submissions-filters,submission-row}.tsx`. Submitted rows link to detail; in_progress rows **non-link metadata-only** + "Em andamento" badge; case-phase rows "Fase de caso" badge. |
| F5 | Version-faithful read-only detail; "não aplicável"; sign-off metadata; foreign id → 404. | ✅ `dashboard/submissions/[responseId]/{page,loading}.tsx` + `submission-detail-view.tsx`. Composes `read-only-blocks` + wizard `AnswerSummary`; "não aplicável" via `evalCondition` over `answersByKey` (SQL↔TS parity); sign-off metadata per section; foreign/other-commission/missing id → friendly in-shell 404 + commission-match double-check. |
| F6 | Admin cross-commission overview UI. | ✅ `admin/painel/page.tsx` + `commission-overview.tsx` (B5). Per-commission volume bar chart + canonical data table linking to each dashboard; "Comissões"/"Painel" nav added to `admin/layout.tsx`. |

## Lead notes — Phase 8 (verbatim, archived)

- **Contract-first (CLAUDE.md §4):** backend posted B1 signatures BEFORE B2/B3 implementations so frontend built against real types in parallel. F1 (design + shell) ran alongside B1.
- **Seeded dataset for acceptance:** Form A = **6 submitted** (`i=1..6`: `dispensador_disponivel` → Sim×2/Não×2/Parcialmente×2; `epis_observados` checkbox unnested → Luvas×6, Máscara×3, Touca×3, Avental×3) **+ 1 case-phase submitted** sharing Form A's version (excluded from the dashboard, included badged in submissions). Form B = **4 submitted** (2 conditional-branch, 2 hidden) + **2 in_progress** (`e1` submit-ready). Conditional `temperatura_*` denominator = **2, not 4** — the explicit acceptance case.
- **DECISION FLAG — RESOLVED (lead):** case-phase response EXCLUDED from the standalone form dashboard (`case_phase_id IS NULL`), INCLUDED badged in the submissions browser. Backend's recommended split, approved over the lead's "default yes". → ADR 0020; filter single-sourced in `app.submitted_form_responses` + `isDashboardCountable`.
- **RLS crux (B3):** confirmed — existing `responses_select`/`answers_select` already grant staff_admin the submitted cross-member read while denying in_progress; no new policy. The in_progress invariant held at every Phase-8 path (list/detail/export/dashboard).
- **Carry-forwards folded in:** P1 INFO-1 anon-grant revoke (B6), P7 MINOR-1 HC017 pgTAP (already present + asserted), P7 MINOR-2 HC023 archive guard (already present + asserted), P7 INFO-1 stale spec comment (tester). Prod-asymmetric-JWT remains a **Phase 9** deploy item.
- **Lead verification beyond the teammates' reports:** independently audited the post-revoke grants in the live DB — confirmed `authenticated` retains EXECUTE on every app RPC (`anon` stripped), preventing a false "app broken by revoke". The generic anon-EXECUTE pgTAP guard subsequently caught **two** further PUBLIC re-leaks (`dashboard_export_rows`, then `dashboard_form_totals`) before they shipped.
- **QA MINORs cleared in-phase** (per "clear cheap MINORs before record"): MINOR-1 (CSV export now date-bounds on `?from/?to`) + MINOR-2 (form-picker tab totals respect the active window) via migration `…090015` (backend) + a one-line page change (frontend); re-verified green (106/106).

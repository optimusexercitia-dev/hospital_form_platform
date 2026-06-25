# Feature — `case_phase_results` (per-phase categorical result + manual override)

> Archived from PROGRESS.md "Current Phase Tasks" at the NSP-per-org kickoff (2026-06-25).
> **Status: ✅ complete** — QA **APPROVED** 2026-06-23 ([phase-results-review.md](../reviews/phase-results-review.md),
> 0/0); tester pgTAP **45/45** + E2E **7/7**; the `case-phase-result.spec.ts` passed inside
> the full-suite **292/0** run during the Multi-Tenancy gate (2026-06-25 fix-loop fixed all 5
> originally-failing specs). Flag `case_phase_results` ships **ON** (migration `20260624130000`).

Per-phase categorical result for multi-phase cases, computed from the phase's own answers
against an ordered ruleset (reusing the UNCHANGED condition evaluator) with a manual override
at the end of the fill wizard. Record-&-surface only (no routing / gating). Plan APPROVED
(Part B); branch `feat/case-phase-results`.

## Backend (`backend`)
| # | Task | Status |
| - | ---- | ------ |
| 1 | Contract-first typed stubs (`conditions.ts` `ResultRule`/`ResultRuleset`/`walkResultRuleset`; NEW `phase-results.ts`; `cases.ts` + `process-templates.ts` + wizard `types.ts` extensions; `submitCasePhaseResponse` + NEW `result-actions.ts` stubs) | ✅ complete — typecheck + lint clean; committed `1993209`. Stubs posted to lead. |
| 2 | Migration `20260620020000_phase_results.sql` — tables (`phase_results`, `case_phase_offered_results`), `case_phases`/`process_template_phases` columns + CHECKs, flag (OFF) + assert + probe, vocab CRUD, snapshot inserts in `create_case_from_template`, audit allow-list, DROP of superseded add/update_template_phase overloads | ✅ complete — clean `db reset`; computed + override + post-conclusion paths smoke-verified in SQL |
| 3 | SQL functions — `compute_case_phase_result`, `set_case_phase_result_override` (DUAL entry: ativa assignee/staff_admin + post-conclusion staff_admin-only non-terminal w/ in-txn recompute), `validate_template_result_ruleset` + publish/add/update hooks, conclude-hook edit, explicit override audit row (no reason) | ✅ complete — paths + negatives (HC057/HC058/HC060/42501) verified in SQL |
| 4 | TS impls — `walkResultRuleset`, `listPhaseResults`/`phaseResultsEnabled`, board/detail/fill projections (`getCasePhaseForFill` result ctx), `submitCasePhaseResponse`, `result-actions.ts` CRUD + `overrideCasePhaseResult`, ruleset persistence in `process-templates/actions.ts`, timeline `result` payload; regenerated `database.ts`; Vitest `result-ruleset.test.ts` (23) | ✅ complete — whole-tree typecheck + lint green; vitest 57/57; `condition-vectors.json` byte-unchanged |

## Frontend (`frontend`)
| # | Task | Status |
| - | ---- | ------ |
| 5 | Result vocabulary manager — NEW `result-vocab-manager.tsx` + `result-def-dialog.tsx` (mirror `outcome-manager`/`outcome-def-dialog`, NO `requiresActionPlan`) + `use-result-action.ts`; NEW settings route `manage/settings/resultados/page.tsx` + "Resultados" tab in `settings-tabs.tsx` (gated on `phaseResultsEnabled`, threaded through desfechos/etiquetas/narrativas pages) | ✅ local-green — lint 0/typecheck 0/vitest 34/34. `frontend-design` applied |
| 6 | Per-phase result-ruleset editor — NEW `result-ruleset-editor.tsx` (mirror `recommend-when-editor`; THIS phase's own choice questions, ordered rule rows = question+op+value+result picker, default picker, live `walkResultRuleset` preview); wired into `phase-slot-dialog.tsx` (hidden `resultRuleset`/`clearResultRuleset` fields like `recommendWhen`) + `phase-slot-card` + `template-builder-shell` + builder page (targets now resolved for ALL publishable forms; `listPhaseResults` threaded) | ✅ local-green. Backend wired `resultRuleset`/`clearResultRuleset` FormData → `p_result_ruleset`/`p_clear_result_ruleset` in add/update template-phase actions (`67e1d4f`) — persistence path complete |
| 7 | Result badge — NEW `phase-result-badge.tsx` (mirror `phase-status-pill`; "manual" + "adverso" markers by icon+text); rendered on concluded phases in `case-phase-article.tsx` (covers case detail via `CasePhaseList`) | ✅ local-green. Timeline badge → task #11 |
| 8 | End-of-wizard override panel — NEW `phase-result-panel.tsx` (live `walkResultRuleset` preview + override picker + reason), rendered in `review-screen.tsx` as a sign-off-block sibling, gated on `WizardData.phaseResult`; `wizard-client` owns override state, `wizard-runner` routes case-phase submits to `submitCasePhaseResponse` (vs `submitResponse`); `prepare.toWizardData` + responder page thread `getCasePhaseForFill.result` | ✅ local-green |
| 10 | Staff-admin post-conclusion correction — NEW `phase-result-override-dialog.tsx` + `phase-result-correct-button.tsx` (client island) + `phase-result-options.ts` mapper; "Corrigir resultado" on `concluida` phases in `case-phase-article.tsx`, gated `phaseResultsEnabled` + staff_admin + non-terminal case; threaded through `case-phase-list` → `case-detail-view` → both detail pages (staff route staff_admin-restricted) | ✅ local-green — backend `overrideCasePhaseResult(casePhaseId, resultId, reason)` landed mid-session; dialog wired to the REAL action (temporary forwarder deleted). Signature matched exactly |
| 11 | Timeline result badge — `PhaseResultBadge` rendered on timeline phase events carrying `result` (backend's `67e1d4f` added `result: TimelinePhaseResult \| null` on `CaseTimelineEvent`): inline in the Feed cards (`timeline-feed.tsx`) + a "Resultado" row in the event detail sheet (`timeline-event-sheet.tsx`, which both Feed AND Gantt open on click). NEW `timelineResultToResolved` adapter in `phase-result-options.ts` | ✅ local-green — lint 0/typecheck 0/vitest 34/34. `frontend-design` applied |

## Tester (`tester`)
| # | Task | Status |
| - | ---- | ------ |
| 9 | pgTAP `160_phase_results.sql` (45 tests) + E2E `e2e/case-phase-result.spec.ts` (7 tests — AC-1 through AC-6 and AC-K keyboard-only) | ✅ complete — pgTAP **45/45** PASS. E2E **7/7 PASS** (chromium, --workers=1, fresh reset). Spec rewritten hermetic (own commission-scoped form + version + items). BUG-CPR-001 closed (lead fixed `100_dashboard.sql` stale signature). |

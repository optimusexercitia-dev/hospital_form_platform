# Phase 7 — Multi-Phase Cases (archived task detail)

> Archived from `PROGRESS.md` at the §6 Record step. Cross-phase logs (Bug Log,
> Test Run Summary, QA Verdicts, Decisions, Follow-ups) remain in `PROGRESS.md`.
> Completed 2026-06-13. Design: ADR
> [0017](../decisions/0017-multi-phase-cases.md) (+ [0018](../decisions/0018-custom-sqlstate-class.md));
> acceptance criteria: [PHASES.md](../../PHASES.md) §Phase 7; review:
> [phase-7-review.md](../reviews/phase-7-review.md).

A **case** groups responses into ordered **phases**; each phase reuses the existing
response/wizard/sign-off machinery. No patient data (case number + non-identifying label).
Inserted before Dashboards (**Dashboards → Phase 8, Deployment → Phase 9**).

> **Lead notes.** Backend surface map: [docs/backend-state.md](../backend-state.md).
> Contract-first: `backend` posted the typed query/action signatures (B5) BEFORE
> implementing, so `frontend` built against real types in parallel. The migration (B1)
> + RLS (B4) + the definer board/cross-member read path (B3) got a **full plan review**
> (novel RLS shape, two new DEFINER reads, a definer cross-member answer read — preserve
> the Phase-7 in_progress-answers invariant from ADR 0016). Reuse over rebuild: the
> condition evaluator + its TS mirror + `condition-vectors.json` stayed **unchanged**;
> `submit_response`/the wizard reused verbatim. Two MAJOR bugs surfaced + fixed in the
> test gate: **P7-001** (phase-start hang under client-side nav → click-driven
> `StartPhaseButton`) and **P7-002** (PostgREST 14 dropped custom `P0xxx` codes on
> accented messages → remapped `P0010–P0022 → HC0xx`, ADR 0018, which also restored the
> specific error messages on Phases 5/6).

| ID | Owner | Task | Depends on | Status |
| -- | ----- | ---- | ---------- | ------ |
| B1 | backend | Migration `20260613090004`: 4 new tables (`process_templates`, `process_template_phases`, `cases`, `case_phases`) + `responses.case_phase_id` + reworked unique indexes + case-number minting trigger + case/phase state-machine guard triggers **[gate]** | – | ✅ Migration applies clean from `db reset`; types regenerated; typecheck green. Tables/bridge/indexes/triggers verified; flag `cases_multi_phase` OFF. |
| B2 | backend | RPCs: template lifecycle (`create`/`publish`/`archive`) + phase-slot CRUD/reorder; `validate_template_recommend_when` | B1 | ✅ Migration `20260613090005`. RPCs invoker (RLS authority); `assert_cases_enabled` gate; `validate_template_recommend_when` + `published_version_of_form`/`version_has_input_key` helpers. Applies clean. |
| B3 | backend | RPCs: `create_case_from_template` (definer, snapshot), `activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`start_or_resume_phase`, `close_case`/`cancel_case`, `sync_case_phase_on_submit` trigger, `recompute_recommendations` + `case_phase_answer_map` (definer, **submitted-only**), definer board reads `list_cases_board`/`get_case_detail` **[gate]** | B1 | ✅ Migration `20260613090006`. `case_phase_answer_map` submitted-only (commented); `sync_case_phase_on_submit` sets its OWN `app.in_case_rpc`; `start_or_resume_phase` skips published-only backstop (uses pin); `create_case_from_template` definer self-gated + bounded unique-violation retry. Applies clean. |
| B4 | backend | RLS policies for all 4 new tables + `commission_of_template`/`commission_of_case` helpers; `cases_multi_phase` feature flag **[gate]** | B1 | ✅ Migration `20260613090007`. Members read / staff_admin write on all 4 tables (mirror `forms`); NO responses/answers policy change (Phase-7 invariant preserved). E2E functional smoke green: full pipeline; P0018 sequential guard; cross-commission definer self-gate blocks; `answer_map` `{}`-for-in-progress / populated-for-submitted; `get_case_detail` submitted-only `response_id`. |
| B5 | backend | **CONTRACT-FIRST:** typed query/action signatures (stubs) then implementations + regenerate `database.ts` | B1–B4 | ✅ Stubs posted early (frontend unblocked), then bodies. `queries/{process-templates,cases}.ts` + `{process-templates,cases}/actions.ts` (full lifecycle, SQLSTATE→pt-BR, server authz re-check, revalidate) + additive `RecommendWhen` in `conditions.ts`. `database.ts` regenerated. typecheck + lint green. |
| B6 | backend | pgTAP tests + multi-phase seed | B1–B5 | ✅ `supabase/tests/90_cases.sql` — **29 tests** (flag gate, recommend_when, publish, snapshot/minting per-commission + cross-commission independence, HC018/HC019/HC021/HC022 guards, one-response-per-phase, **the `{}`-for-in-progress invariant**, submit-trigger→concluida + recompute, terminal-state guards, HC020, RLS read boundary, **+ QA fold-ins: HC017 snapshot guard, `get_case_detail` isolation**). Full pgTAP 167/167. Seed `Caso 0001` (phase 1 concluida+submitted, phase 2 pendente+recommended). Evaluator/mirror/vectors untouched. |
| B7 | backend | Flag-flip migration: enable `cases_multi_phase` | B1–B6 | ✅ Migration `20260613090008` — one-line flip (separate; B1's OFF default untouched). RPC pipeline runs end-to-end ON with no manual flip; pgTAP gate-OFF assertion (test 0) flips txn-locally, unaffected. |
| B8 | backend | Two RLS-scoped query helpers frontend found missing (NO migration) | B5 | ✅ `phaseConditionTargets(formId)` (choice-type questions of the form's published version for the recommend value-picker; free_text excluded; `[]` if none) + `listMyAssignedPhases(commissionId)` (caller's `ativa` phases — member-scoped "my work" read). Both RLS-scoped; existing policies suffice. |
| P7-002 fix | backend | Custom SQLSTATE class remap (ADR 0018) | — | ✅ Migration `20260613090009` `CREATE OR REPLACE`s Phase 5/6 fns with `HC010–HC015`; Phase-7 migrations carry `HC016–HC023`; action constants + all pgTAP `throws_ok` + docs moved together. Verified specific pt-BR over the real HTTP path. |
| F1 | frontend | Process-template builder: list + builder | B5 | ✅ List + builder (staff_admin-gated). `process-template-card`, `template-status-badge`, `create-process-template-{dialog,form}`, `template-builder-shell`, `phase-slot-card`, `phase-slot-dialog`, `publish-template-button`, `archive-template-button`, `use-template-action`. |
| F2 | frontend | `recommend_when` editor previewed via `evalCondition` | B5, F1 | ✅ `recommend-when-editor` (earlier-phase + question + op + discrete value) in `phase-slot-dialog`. Live `evalCondition` preview (from_phase stripped); warns on ALL `not_equals` (skippable footgun, non-blocking). Targets via `phaseConditionTargets` threaded as `PhaseWithTargets`. |
| F3 | frontend | Cases board + per-case detail | B5 | ✅ Board (`manage/cases`) + detail (`/[caseId]`), staff_admin-gated, status-only board. `phase-status-pill` (icon+text+shape, `RecommendedChip`), `case-status-badge`, `case-board-card`, `case-phase-list`. |
| F4 | frontend | Coordinator case actions UI | B5, F3 | ✅ `create-case-dialog` (PII `role=note` warning), `activate-phase-dialog` (activate+reassign), `add-ad-hoc-phase-dialog`, `case-lifecycle-actions`, `coordinator-phase-actions`, `use-case-action`. Wired to `cases/actions.ts`. |
| F5 | frontend | Phase filler + assignee entry | B5 | ✅ **Click-driven** `StartPhaseButton` (P7-001 fix) → `startOrResumePhase` → `router.push` to filler; filler reuses `WizardRunner` UNCHANGED, path-tamper guard. `minhas-fases` (both roles) via `listMyAssignedPhases` + `MyPhaseCard`. NavMenu: "Processos"/"Casos" (staff_admin) + "Minhas fases". Completed-phase read-only via `getResponseForFill`→`PhaseAnswersReadonly` reusing `AnswerSummary` (decision ii). |
| F6 | frontend | `frontend-design` pass + a11y + pt-BR | F1–F5 | ✅ Skill invoked before building; all screens conform (Fraunces, petrol accent reserved, status by icon+text+shape, calm empty/loading/error, rise-in staggers, reduced-motion-safe). a11y: wrapping labels, fieldset/legend, PII `role=note`, focus rings. pt-BR throughout. Manually verified end-to-end, zero console errors. |
| T1 | tester | Phase 7 E2E + regression **[gate]** | B6, F6 | ✅ **81/81 GREEN (restored assertions)** — chromium, workers=1, fresh seed, migration 090009 applied. 11 Phase 7 + 70 regression. P7-001 + P7-002 RESOLVED; narrowed assertions restored; unused helpers removed. |
| Q1 | qa | Requirements + code/RLS review **[gate]** | T1 | ✅ APPROVED 2026-06-13 — 0 blockers, 0 majors, 2 minors, 3 infos. Security invariant sound at all layers. [phase-7-review.md](../reviews/phase-7-review.md). Cheap findings cleared: MINOR-2 (archive guard → HC023), MINOR-1 (pgTAP HC017), INFO-2 (pgTAP isolation). pgTAP 167/167. |

**Deferred to Phase 8/9 (carry-forwards):** revoke anon DML/EXECUTE grants; production
asymmetric JWT signing keys; (Phase 8 test-hardening) the ad-hoc-phase dialog could gain a
`recommend_when` editor (the action already accepts it). The `HC0xx` remap is
version-agnostic (no prod config pinning).

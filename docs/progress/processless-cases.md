# "Sem processo" — process-less case creation (`processless_cases`)

> ✅ **COMPLETE 2026-06-30.** Flag `processless_cases` (ON). ADR
> [0044](../decisions/0044-processless-cases.md). QA
> [APPROVED](../reviews/processless-cases-review.md). Branch `feat/processless-cases`
> (feature `cdf26d0`). Rotated out of the live PROGRESS.md at the §6 Record step.

Coordinator can open a template-less case (`cases.template_id` NULL, zero phases; ad-hoc
phases grown later) with an OPTIONAL hand-picked offered-outcome set + OPTIONAL patient
identifiers. Two coordinator-gated DEFINER RPCs (`create_case`, `set_case_offered_outcomes`);
no new RLS shape; one intentional ADR-0024-D15 divergence (process-less offered sets mutable
while non-terminal; templated cases stay frozen). Migration
`20260630000006_processless_cases.sql`.

## Backend (`backend`)

| # | Task | Status |
| - | ---- | ------ |
| BE1 | Migration `20260630000006_processless_cases.sql` — flag `processless_cases` (ON) + `assert_processless_cases_enabled()`/`processless_cases_enabled()` probe + two DEFINER WRITE RPCs: `create_case(commission, label, patient_enabled, outcome_ids[])` (template-less minter, mirrors latest `create_case_from_template` sans template machinery; HC030 same-commission/non-archived outcome validation; bounded mint retry; NO phases/narratives/recompute; no creation audit) and `set_case_offered_outcomes(case, outcome_ids[])` (coordinator-only, non-terminal editor; HC025 terminal, HC029 can't-drop-assigned, HC030 mismatch; one PHI-free `case.offered_outcomes_set` audit). Self-contained grant block; no new RLS shape (mirrors approved patterns). Applied LOCAL + types regenerated. | ✅ done |
| BE2 | Server actions + probes (the FE contract): `createCase(_prev, formData)` in `actions.ts` (hidden fields `commissionId`/`label`/`emitsOutcome`/`outcomeIds`(repeated)/`patientEnabled`; reuses `authorizeCommission` + atomic `patientInputFromForm`→`writeCasePatient` PHI fold; HC030→`commissionMismatch`); `setCaseOfferedOutcomes(caseId, outcomeIds[])` in `outcomes-actions.ts` (reuses `commissionOfCase`/`authorizeCommission`/`mapOutcomeError`/`revalidateCaseOutcome`); `processlessCasesEnabled()` + `casesExtrasEnabled()` probes in `queries/cases.ts` (fail-closed). `lint`+`typecheck` green; DB smoke test confirmed all paths incl. zero-phase `close_case` (HC031+HC028) + HC025/HC029/HC030. | ✅ done |

## Frontend (`frontend`)

| # | Task | Status |
| - | ---- | ------ |
| FE1 | New `OutcomeMultiselect` (`src/components/cases/outcome-multiselect.tsx`) — PURELY-LOCAL, parent-owned selection over the commission vocabulary, reusing the `ProcessOutcomesPicker` affordances (badge `TOKEN_STYLES`, "Plano de ação"/"Adverso" markers, inline "Criar novo desfecho" → `OutcomeDefDialog` + `router.refresh()`). Shared by the create dialog + the detail editor (DRY). | ✅ done |
| FE2 | `create-case-dialog.tsx` — new props (`commissionId`, `processlessEnabled`, `casesExtrasEnabled`, `outcomes`); top sentinel `<option value="__processless__">Sem processo</option>` (flag-gated); second `useActionState(createCase)` chosen by `isProcessless`; two-step wizard (Step 1 select+label+PII warning + `casesExtrasEnabled`-gated "emite desfecho?" multiselect (repeated hidden `outcomeIds`) + `casePatientEnabled`-gated "registra paciente?" toggle (hidden `patientEnabled`); PHI ON → "Próximo" → Step 2 PatientFields + hidden mirrors + prominent PHI warning + "Voltar"; PHI OFF → Step 1 submits "Criar caso"). Templated branch unchanged. | ✅ done |
| FE3 | `manage/cases/page.tsx` — `Promise.all` += `processlessCasesEnabled()`/`casesExtrasEnabled()`/`listCaseOutcomes()`; new props to BOTH dialog instances; create-button + empty-state gating now `processlessOn ‖ activeTemplates.length > 0`. | ✅ done |
| FE4 | Detail offered-outcomes editor (`case-offered-outcomes-editor.tsx`) — coordinator-only dialog seeded from the case's offered set, calls `setCaseOfferedOutcomes` + `router.refresh()`, surfaces HC029/HC025/HC030 inline. Mounted in `case-detail-view.tsx` beside `CaseOutcomeSelector`, gated `isOpen && canManageLifecycle && templateId === null && casesExtrasEnabled`. `outcomes`/`casesExtrasEnabled` threaded from the coordinator `(detail)/page.tsx` (loaded only when process-less + extras on); staff route uses the `[]`/`false` defaults (editor never shows). | ✅ done |
| FE5 | "Sem processo" muted badge (`CaseStatusBadge colorToken="muted"`, `templateId === null`) in the coordinator header (`(detail)/layout.tsx`) + the staff header (`case-detail-view.tsx`). | ✅ done |
| FE6 | `npm run lint` (0 errors; 43 pre-existing `e2e/` warnings, none in FE files) + `npm run typecheck` GREEN across the whole project. | ✅ done |

## Tester (`tester`) — gate

| # | Task | Status |
| - | ---- | ------ |
| T1 `[gate]` | pgTAP `177_processless_cases.sql` + E2E `e2e/processless-cases.spec.ts` (S1 create+badge+zero-phases · S2 emite-desfecho+inline-create+HC028 · S3/S4 PHI wizard step-2+reveal · S5 offered-outcomes editor HC029 · S6 ad-hoc phase+conclude · S7 staff→notFound · S-K keyboard). | ✅ **GREEN** — pgTAP **1153/1153** (42 files, +31 new, 0 regressions). E2E **8/8** stable across 2 consecutive fresh-reset prod-build serial runs (`--workers=1`). |

## Lead gate record (2026-06-29)

Test gate GREEN. **pgTAP 1153/1153** (full suite, fresh `db reset`). **Feature E2E 8/8**
(`--workers=1`, 2 consecutive clean runs). `typecheck`+`lint` green project-wide. **One real
app bug found & fixed — BUG-PL-001:** "Próximo" submitted the create form (React reconciled
the footer ternary button and flipped its `type` to `submit` mid-click) → PHI step-2
unreachable; fixed with distinct button `key`s (`advance`/`submit`, `back`/`cancel`) in
`create-case-dialog.tsx` (FE). Three initial E2E reds were **spec-locator false-failures**
(app correct, snapshot-confirmed): S2 (`/Novo desfecho/i` dialog filter also matched the
outer "Novo caso" dialog's "Criar **novo desfecho**" button → scope by inner heading) and S5
(`filter({has})` → name-anchored checkbox role locator) — both fixed by tester; S6 was
transient prod-build latency.

## Lead gate record UPDATE (2026-06-30) — gate closed

**Test gate fully GREEN — full E2E regression declared on the DEV server: 439 passed / 0
failed / 4 known skips (443/443 ran, no truncation), `--workers=1`, fresh `db reset`.** 439 =
the 431 result-rec baseline + the 8 new processless specs (S1–S7 + S-K), all passing → **zero
regressions**. **QA APPROVED** (0 BLOCKER · 0 MAJOR · 1 informational MINOR;
[report](../reviews/processless-cases-review.md)).

**Triage note (kept for the catalog):** the first full-suite pass ran on a PROD build and
showed 18–21 deterministic failures — every flow asserting a post-mutation `[role="status"]`
toast or an AlertDialog/upload dialog closing (phase3 commission-create, phase10 meetings,
phase11 interviews, cases-extras AC-Docs/Tags/ActionItems, phase7 case-activate). These are
**feature-unrelated** modules and reproduced **in isolation on a fresh reset**, so NOT
contamination and NOT a regression. Proven prod-build-specific: `phase3-admin-members` alone,
fresh reset, all containers healthy = **4 failed on prod / 14 passed (0 failed) on dev**. This
is the project's known prod-build toast quirk; **full-suite green is always declared on the
DEV server** (memory `e2e-gate-run-mechanics`, updated 2026-06-30).

**Human approved 2026-06-30.** Remaining deploy step: remote `supabase db push` (human-run) —
migration `20260630000006_processless_cases.sql` was LOCAL-only at record time.

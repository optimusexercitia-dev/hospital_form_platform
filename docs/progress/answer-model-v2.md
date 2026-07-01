# Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)

> Rotated out of the live `PROGRESS.md` at the §6 Record step (CLAUDE.md §7). Branch
> `feat/answer-model-v2`. Plan [docs/plans/answer-model-v2.md](../plans/answer-model-v2.md);
> ADRs [0045](../decisions/0045-answer-model-v2.md) · [0046](../decisions/0046-forward-compat-form-capabilities.md);
> QA review [docs/reviews/answer-model-v2-review.md](../reviews/answer-model-v2-review.md).
> Machine-switch handoff (historical): [answer-model-v2-handoff.md](answer-model-v2-handoff.md).

## Summary

Pre-launch schema-shape hardening (no users, no backfill). **Uniform answer row** (every
answered input — incl. choice — gets a parent `answers` row; `answer_selected_options`
re-keyed to `answer_id`), **typed scalar shadow columns** (`value_number/value_date/value_time`,
trigger-derived; `answers.value` stays the canonical evaluator input), an **instance-ready
answer key** (`answers.group_instance_id` + `response_group_instances` + `form_items.parent_item_id`)
as **scaffolding only — NO repeating-group / new-block UX**, `answered_at` + reserved
`confidentiality_level`, and question **default values**. Evaluator byte-for-byte unchanged
(Rule 3). Additive forward-only migrations, no feature flag; migrations then re-squashed 2→1
into the single clean baseline.

## Backend (`backend`) — all ✅ done

| # | Task |
| - | ---- |
| BE-0 | **Contract-first** typed stubs (posted for `frontend`). `Item` += `defaultValue: Json \| null` + `parentItemId: string \| null`; `responses.ts` += exported `AnswerRecord` with `answeredAt`; `forms/actions.ts` `addItem`/`updateItem` parse+shape-validate a new `defaultValue` FormData field (`parseDefaultValue`). `saveSection` shape UNCHANGED. |
| BE-1 | Definition migration `20260701000000_answer_model_v2_definition.sql`: `form_items.parent_item_id` (self-FK cascade) + `default_value jsonb` + display-null CHECK; `response_group_instances` table + RLS (member-read / creator-write-in_progress, mirroring the inline `answers` predicate verbatim) + submitted-immutability trigger. |
| BE-2 | Answer migration `20260701000010_answer_model_v2_answers.sql`: `answers` += `group_instance_id`/`value_number`/`value_date`/`value_time`/`answered_at`/`confidentiality_level`; two partial-unique indexes (top/instance); `answer_selected_options` re-keyed to `answer_id` (PK + RLS rewritten); `app.sync_answer_typed_values` (exception-guarded casts — never fails a save, value jsonb stays canonical); `app.guard_submitted_selections` twin; `reject_invalid_selection` re-keyed. |
| BE-3 | `answer_map`/`answer_map_by_item`/`case_phase_answer_map` re-source selections via `answer_id` — **golden parity BYTE-FOR-BYTE** (pgTAP `60`); `save_section_answers` upserts a parent answer per answered item then replaces selections by `answer_id`; `submit_response` + `response_required_complete` re-keyed; hidden-cleanup deletes answers (selections cascade) + `response_group_instances`. HC013 + in_progress guards preserved. |
| BE-4 | `dashboard_distributions`/`dashboard_export_rows` join → `answer_id` (aggregates identical); `clone_form_version` copies `default_value` + remaps `parent_item_id`; `publish_form_version` default-value validation → **HC080** (`o valor padrão da pergunta "%" é inválido`). |
| BE-5 | Regen `database.ts`; `getResponseForFill`/`getSubmissionDetail` embed `answers!inner(item_id,response_id)` to recover item_id, flatten to the twin's UNCHANGED `{item_id,option_id}` input; `VERSION_TREE_SELECT` + `addItem`/`updateItem` carry `default_value`/`parent_item_id`. |

## Frontend (`frontend`) — all ✅ done

| # | Task |
| - | ---- |
| FE-1 | Builder "Valor padrão" control (new `src/components/forms/default-value-editor.tsx`; wired into `item-editor-dialog.tsx`): scalar input for free_text/short_text/number/date/time; single option-picker (multiple_choice/dropdown, by code) or multi-select checkbox-set (checkbox, by code[]); none for display items. Submits via the existing `defaultValue` FormData field; a derived prune drops a default option code removed from `options` in the same editing session. |
| FE-2 | Wizard default prefill (`use-wizard.ts`'s `withDefaults`): seeds the initial answer state from each VISIBLE, unanswered item's `defaultValue`, once at mount; never touches hidden items; a kept default saves as an ordinary answer; user can freely change/clear it. 6 new Vitest cases. |

## Tester (`tester`) — §6.2 gate

`e2e/answer-model-v2.spec.ts` (DV-1 scalar defaults, DV-2 choice defaults, DV-3 hidden-item
never seeded, DV-4 kept-default → ordinary answer + dashboard, DV-5 keyboard-only, DV-6 HC080
publish rejection). **First run (2026-07-01):** DV-1/3/5/6 pass; DV-2/DV-4 FAIL → BUG-AMV2-002
(BLOCKER) filed; BUG-AMV2-001 (MINOR) triaged confirmed. **Re-run after fixes: 6/6 PASS**
(full-file serial, dev, chromium, `--workers=1`, fresh reset). Scoped regression GREEN: builder
`phase4-builder`+`phase4-builder-smoke`+`form-builder-enhancements` **24/24**; wizard
`phase5-wizard` **12/12**; dashboard `phase8-dashboard` **24/24**.

**Spec-only fixes landed (all `e2e/**`, no app code — test assertions lagging the schema change):**
`enterWizardByTitle` locator scope + `button|link` affordance; DV-4 dead PostgREST subselect
removed; DV-5 `Control+A`→`Home`+`Shift+End` (portable select-all); DV-4 radio `exact:true`;
`form-builder-enhancements` AC-10 + `phase5-wizard` AC-6 + `form-model-normalization` selection
queries rewritten to resolve via the parent `answers` row / delete by `answer_id` (the re-keyed
`answer_selected_options` dropped `response_id`/`item_id`); `form-builder-enhancements` AC-15
`input[id$="-value"]` → `:not(#default-value)`; `phase8-dashboard` AC-4 anchor +`case_phase_id=is.null`.

## Full E2E suite (lead-owned)

Background run, dev server, chromium, `--workers=1`, fresh `db reset --local` + GoTrue poll:
**456 passed / 7 failed / 4 skipped**. All 7 failures are the known cross-spec seed/count
**contamination** class (`phase5-wizard` AC7 + "Minhas respostas"; `phase8-dashboard` AC-7a/b/c
counts, AC-10a, AC-12) of the known-RED serial baseline (`main` ~17–19); **0 regressions** —
confirmed by re-running both files each on a fresh reset: `phase5-wizard` 12/12 +
`phase8-dashboard` 24/24 (100% green in isolation).

## Bugs (this gate) — both RESOLVED

- **BUG-AMV2-002 (BLOCKER)** — a choice-type "Valor padrão" set while ADDING a brand-new item
  persisted as `""` / `["","",""]` (new option rows carried `code: ""`, minted server-side only
  at insert), so publish always failed. **Fixed** by minting the option `code` client-side:
  backend `5b53a51` extracted a client-safe `generateOptionCode` into `src/lib/forms/option-code.ts`
  (single generator, server + client); frontend `d29c03f` mints it in `OptionsEditor.updateLabelAt`
  once a row's label is non-empty, so `DefaultValueEditor` + hidden `optionCode`/`defaultValue`
  carry a real code. DB-verified: `default_value` holds `"tarde"` / `["luvas","mascara"]`.
- **BUG-AMV2-001 (MINOR)** — `publishVersion` only mapped Postgres `23514`, not the `HC080`
  errcode, so the friendly pt-BR message never surfaced. **Fixed** (`5b53a51`): now maps
  `HC080` as well. UI-unreachable today (builder prunes/coerces invalid defaults before publish);
  latent-gap fix, no live repro.

## Gate result

- **Build:** pgTAP **1205/1205**, Vitest **176/176**, typecheck clean, lint 0 errors, clean `db reset --local`.
- **Tests:** feature 6/6 + scoped regression 60/60 + full suite 456p/7-contamination (0 regressions).
- **QA:** ✅ **APPROVED** ([review](../reviews/answer-model-v2-review.md)) — evaluator-parity keystone holds
  (golden `60` intact, no evaluator/twin change); RLS/immutability/typed-trigger verified. 3 MINORs:
  MINOR-1 (co-locate immutability cases in `10_immutability.sql`) **cleared** (`f338eff`, +3 → 1205);
  MINOR-2 (defensive-only PGRST201 hint) no action; MINOR-3 (doc-sync) done at Record.
- **Record:** ARCHITECTURE.md Rule 2 + `docs/backend-state.md` updated; migrations re-squashed 2→1
  into the single baseline `20260620000000_baseline.sql` (empty sorted pre/post pg_dump diff). ⚠
  **Remote `db push` / re-baseline is human-run — PENDING** (everything validated local-only).

## Commits (branch `feat/answer-model-v2`)

`91922c1` kickoff · `71a1fb0` BE-0 · `ca7d4ea` FE-1 · `e5d30de` FE-2 · `e5eaf55` FE docs ·
`e13b2dc` BE-1..BE-5 · `9dbaf63` machine-switch pause · `066e700` spec fixes ·
`44b2163` bug filing · `5b53a51` option-code util + HC080 map · `d29c03f` client-side code mint ·
`0acee50` spec re-key migration · `b2ee9f3` T-1 green · `8528ccb` full-suite green ·
`f338eff` QA MINOR-1 · plus the re-squash + `phase(answer-model-v2): complete` commit.

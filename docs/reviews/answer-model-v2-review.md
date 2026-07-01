# QA Review — answer-model-v2 mini-phase

- **Reviewer:** `qa` (qa-reviewer)
- **Date:** 2026-07-01
- **Branch:** `feat/answer-model-v2` (head at review time `b2ee9f3`)
- **Verdict:** **APPROVED**
- **Gate context:** Build ✅ · Tester ✅ green (feature 6/6 + scoped regression 60/60 + full suite 456p / 7 pre-existing-contamination, 0 regressions).

Audited against CLAUDE.md §3 + ARCHITECTURE.md Rules 1/2/3/5/8/9/10/11/12, ADRs
[0045](../decisions/0045-answer-model-v2.md) / [0046](../decisions/0046-forward-compat-form-capabilities.md),
the plan [docs/plans/answer-model-v2.md](../plans/answer-model-v2.md), and the handoff.
All claims were verified against the actual code, not PROGRESS.

---

## Keystone invariant — evaluator parity (Rule 3): HOLDS ✅

- Neither migration redefines `app.eval_condition` / `app.eval_visibility`
  (`grep` over both `20260701000000_*.sql` and `20260701000010_*.sql` returns
  nothing). Only the three rehydration functions (`app.answer_map`,
  `app.answer_map_by_item`, `app.case_phase_answer_map`) change, and only in how
  they *source* selections (`answer_selected_options.answer_id → answers`), never
  in output shape (single→`to_jsonb(min(code))`, checkbox→`jsonb_agg(... order by
  position)`, scalars→`answers.value`).
- No TS evaluator twin (`conditions.ts` / `effective-visibility.ts`) appears in
  the branch diff (`git diff --name-only main...HEAD`).
- `supabase/tests/60_answer_map_golden.sql` still guards `app.answer_map` /
  `answer_map_by_item` / `case_phase_answer_map` byte-for-byte against literals
  frozen from the pre-change baseline (checkbox out-of-position ordering,
  observation-only NULL row, empty checkbox), plus an `eval_condition` `in` check
  over the golden map. The fixture correctly builds the new uniform-answer shape
  (parent `answers` rows + selections by `answer_id`). **If `60_answer_map_golden`
  fails, that is phase-blocking — it currently guards the invariant faithfully.**

## RLS on new/changed surfaces (Rule 1): CORRECT ✅

- **`response_group_instances`** — RLS enabled; SELECT mirrors `answers_select`
  *verbatim* (creator OR `is_org_admin_of_commission` OR submitted +
  `is_staff_admin_of`), WRITE mirrors `answers_write_own_draft` verbatim (creator
  while `in_progress`). This is a real mirror of the inline `answers` predicate,
  not a stub — confirmed the answers policies inline the same `responses` join and
  no `app.commission_of_response` helper exists (the handoff's note is accurate).
  Table-wide `grant all ... to authenticated/service_role` present (Supabase
  grants are table-wide; new table needs its own).
  pgTAP `61_answer_model_v2.sql` proves non-creator member cannot read
  (`count = 0`) and creator can (`count = 1`).
- **Re-keyed `answer_selected_options`** — old `response_id`-based policies dropped
  before the column drop; recreated via `answer_id → answers → responses` with the
  identical predicate one hop further out. Index `answer_selected_options_answer_idx`
  on the new FK created; stale `answer_selected_options_response_idx` dropped.
  Grants re-asserted idempotently.
- No surface left world-readable or writable outside `in_progress`.

## Immutability (Rule 5): CORRECT ✅

- `answers`' new columns (`value_number/date/time`, `answered_at`,
  `confidentiality_level`, `group_instance_id`) ride the pre-existing whole-row
  `guard_submitted_answers_trg` (fires on any INSERT/UPDATE/DELETE) — no trigger
  work needed, and 61's `throws_ok` proves an `UPDATE ... answered_at` on a
  submitted response is blocked (23514).
- `form_items.parent_item_id` / `default_value` ride the pre-existing whole-row
  `guard_published_items_trg` (published/archived structure freeze).
- `answer_selected_options` lost `response_id`, so the baseline
  `guard_submitted_children` (which reads `NEW/OLD.response_id`) would no longer
  resolve; correctly replaced by the dedicated `app.guard_submitted_selections`
  twin that resolves the response via `answer_id → answers`. The old trigger is
  dropped and the twin installed. 61 proves a submitted-response DELETE via
  `answer_id` is blocked.
- `response_group_instances` covered by `guard_submitted_group_instances_trg`
  (row has `response_id` directly, reuses `guard_submitted_children`); 61 proves a
  submitted-response INSERT is blocked.

## Typed-value trigger `app.sync_answer_typed_values`: CORRECT ✅

- `BEFORE INSERT/UPDATE`; every cast wrapped in `begin ... exception when others
  then <col> := null; end;`, so a malformed scalar leaves the typed column NULL
  and **never fails the save** — `value` jsonb stays canonical. `search_path`
  pinned (`public, pg_catalog`); owner postgres; `revoke from public` +
  grants. Guards on `jsonb_typeof` before casting (number-item value must be a
  JSON number, date/time a string). 61 asserts derivation for 12.5 / date / time
  and `lives_ok` for `'not-a-date'` on a date item (row still saves; column NULL).

## HC080 default-value validation + BUG-AMV2-002 fix: COHERENT ✅

- `publish_form_version` validates each non-null `default_value` by item type:
  choice→string code that `app.version_has_option_code` confirms; checkbox→array
  of existing string codes; number→JSON number; date/time/short_text/free_text→
  JSON string; anything else→invalid. Raises `HC080` with pt-BR
  `o valor padrão da pergunta "%" é inválido`. Display items are additionally
  blocked from carrying a default by the `form_items_default_value_display_null`
  CHECK. 61 covers both the bad-code `throws_ok('HC080')` and a valid `lives_ok`.
- **Single option-code generator:** `src/lib/forms/option-code.ts` is a plain,
  client-safe module (`generateOptionCode` / `slugifyLabel` / `shortSuffix`,
  no `'use server'`, no server-only imports). Imported by BOTH `actions.ts`
  (`insertOptionRows` / `reconcileOptionRows`) AND the client `options-editor.tsx`
  (`updateLabelAt`). No double-mint: the client mints only when `code === "" &&
  label non-empty`, and the server preserves a submitted non-empty code
  (`o.code.trim() || generateOptionCode(...)`) — a client-minted code is passed
  through untouched. Code stays stable across a later rename (only re-minted while
  still `""`). Server retains its own fallback if a row arrives with `""`.
  `item-editor-dialog.tsx`'s `effectiveDefaultValue` prunes (during render, no
  setState-in-effect) any default code removed in the same session, which is why
  the invalid-choice-default HC080 path is UI-unreachable — substantiating the
  BUG-AMV2-001 triage.

## BUG-AMV2-001 fix: CORRECT ✅

- `publishVersion` (`src/lib/forms/actions.ts:1352`) surfaces `error.message` for
  `error.code === PG_CHECK_VIOLATION || error.code === 'HC080'`. HC080 is a custom
  SQLSTATE (not 23514), so the added branch is required and correct; the DB message
  is always user-facing pt-BR here.

## save_section_answers / submit_response / required-complete: CORRECT ✅

- `save_section_answers` upserts the parent `answers` row for every answered item
  (scalar and choice) targeting the top-level partial unique
  (`on conflict (response_id, item_id) where group_instance_id is null`), then
  replaces selections by `answer_id`; `answered_at = now()` refreshed on change;
  orphan-clear deletes `answers` rows (selections cascade via the `answer_id` FK).
  HC013 cross-version + code-existence + `in_progress` guards preserved.
- `submit_response` / `response_required_complete` keep identical "answered"
  semantics (scalar non-null-and-not-`'null'` OR ≥1 selection via
  `answer_id → answers`); hidden-cleanup deletes `answers` rows (cascade) AND
  `response_group_instances` of hidden items/sections; evaluator walk unchanged.

## Types / query layer / strict / pt-BR (Rules 8/9/10): CLEAN ✅

- `src/lib/types/database.ts` regenerated: `answers` new columns present in
  Row/Insert/Update; `answer_selected_options` keyed by `answer_id` (+ FK);
  `response_group_instances` table + FKs; `form_items.default_value` /
  `parent_item_id` present. `VERSION_TREE_SELECT` selects `default_value,
  parent_item_id`; `toItem` maps both (safe `?? null`). `queries/responses.ts`
  exposes `answeredAt`.
- No `any` in the touched TS (`option-code.ts`, `actions.ts`,
  `default-value-editor.tsx`, `options-editor.tsx`, `use-wizard.ts`); the one
  `as unknown as Json` in `reconcileOptionRows` is pre-existing and boundary-safe.
- All new user-facing strings pt-BR (`Valor padrão`, `Nenhum`, the HC080 message,
  `defaultValueInvalid`). `DefaultValueEditor` inputs are labelled + carry
  `aria-describedby`; the checkbox set uses `<fieldset>/<legend>` with a described
  group. Wizard `withDefaults` seeds only VISIBLE unanswered input items and drops
  hidden keys as it walks (verified against `computeEffectiveVisibility`), so a
  default never auto-writes a hidden item or leaks into a controlling answer.

## Scaffolding is inert as designed (ADR 0045/0046): CONFIRMED ✅

- `confidentiality_level` reserved + unenforced (no RLS predicate keys on it).
- `parent_item_id` always NULL (no group `item_type`, no builder/wizard path
  writes it); `clone_form_version` copies `default_value` verbatim and remaps
  `parent_item_id` old→new (inert while NULL, but correct).
- `response_group_instances` is never written by any app path; `save`/`submit`
  only *delete* from it during hidden-cleanup. No repeating-group UX shipped.

---

## Findings

### Blocking
None.

### Minor / non-blocking (informational — no change required to approve)

- **MINOR-1 (test-org hygiene).** New-surface submitted-immutability +
  RLS assertions live in the feature file `supabase/tests/61_answer_model_v2.sql`
  rather than the general `10_immutability.sql` (still `plan(14)`, untouched).
  Coverage is complete and correct; consider back-porting the three new-surface
  `throws_ok` cases into `10_immutability.sql` at a future consolidation so the
  general immutability file stays the one-stop index. Cosmetic.

- **MINOR-2 (stale hint, harmless).** The `VERSION_TREE_SELECT` PGRST201
  disambiguation hint `form_item_options!form_item_options_item_id_fkey` in
  `src/lib/queries/forms.ts:499` was introduced (BUG-FMN-001) because
  `answer_selected_options` created a second inferred M2M path between
  `form_items` and `form_item_options`. That second path no longer exists after
  the re-key (`answer_selected_options` no longer references `form_items`), so the
  explicit hint is now defensive rather than required. Leaving it is correct and
  costs nothing; no action needed.

- **MINOR-3 (doc-sync deferred, already tracked).** ARCHITECTURE.md Rule 2
  canonical schema and `docs/backend-state.md` intentionally have NOT yet been
  updated for the new columns / re-keyed selections / `response_group_instances`.
  Per the plan + handoff this is deliberately deferred to the §6 Record step;
  flagging only so it is not forgotten at Record. Not a code defect.

None of the above blocks the phase.

## Conclusion

The mini-phase meets every deliverable and acceptance bullet in the plan and both
ADRs. The Rule-3 evaluator-parity keystone is intact and golden-guarded; RLS,
immutability, the typed trigger, HC080 validation, and the BUG-AMV2-001/002 fixes
are all correct and coherent; types are regenerated; the scaffolding is genuinely
inert. **APPROVED.**

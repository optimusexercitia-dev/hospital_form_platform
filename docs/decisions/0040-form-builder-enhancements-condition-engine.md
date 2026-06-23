# 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema

Status: accepted
Date: 2026-06-23
Context: mini-phase `feat/form-builder-enhancements` (plan `docs/plans/form-builder-enhancements.md`)

## Context

The form builder gains four input types (`short_text`/`number`/`date`/`time`),
per-option colours, per-question conditional appearance, and per-answer
observations — all additive, no feature flag, no data migration (ADR-level
decisions are in the plan). This ADR records the *backend* design choices.

## Decisions

1. **Single evaluator + thin group wrapper (no drift).** `app.eval_condition`
   stays the one authority over ONE condition; it only gains the ordered ops
   `gt/gte/lt/lte` (both operands JSON numbers → numeric compare, else text — so
   ISO `YYYY-MM-DD` / `HH:mm` sort correctly). A new `app.eval_visibility(rule,
   answers)` wraps the AND/OR group (`{match: all|any, conditions[]}`),
   delegating per sub-condition; the legacy single shape evaluates unchanged.
   The TS twins (`evalCondition`/`evalVisibility`) mirror this exactly; two
   shared vector files (`condition-vectors.json`, `visibility-vectors.json`)
   are exercised by both `conditions.test.ts` and `20_conditions.sql`. Drift is
   phase-blocking. `walkResultRuleset`/`RecommendWhen`/`ResultRule` keep using
   single-shape `eval_condition` untouched (they gain the ops for free, never
   author groups).

2. **Visibility shape validation centralized + relaxed CHECKs are supersets.**
   `app.is_valid_visibility(jsonb)` (null | single | non-empty group) backs the
   `visible_when` CHECK on BOTH `form_sections` and `form_items`;
   `app.is_valid_options(jsonb)` accepts a bare string OR `{label, color}` so
   option colours live inside the existing `options` jsonb (clone copies them for
   free). Every relaxed CHECK is a strict SUPERSET of the one it replaced — proven
   by a full `supabase db reset` (the seed's existing rows re-validate). The new
   columns (`form_items.config`, `form_items.visible_when`, `answers.observation`)
   and the new constraints apply to columns that are NULL on all existing rows.

3. **Conditional question is never required — enforced in the DB.** A CHECK
   (`form_items_conditional_not_required`: `visible_when IS NULL OR required =
   false`) plus the action clearing `required` when a condition is present.

4. **Publish-time validation walks BOTH sections and items, group-aware.**
   `validate_visible_when` normalizes single|group into a flat sub-condition set
   (`app.visibility_conditions`) and validates: SECTION conditions must reference
   an input in a strictly-EARLIER section (and not on the first section); ITEM
   conditions must reference an input strictly earlier in DOCUMENT ORDER (earlier
   section OR earlier item in the same section — rejects self/forward refs).
   Operator↔target-type is enforced for both (`in` ⇒ choice + array value;
   `gt/gte/lt/lte` ⇒ number/date/time) via `app.assert_condition_op_target`.

5. **Submission: single forward pass over an effective answer map.**
   `submit_response` maintains `v_eff` (question_key → value, seeded from the
   saved answers) while walking sections then items in document order. A hidden
   section/item has its answers stray-cleared AND its keys dropped from `v_eff`,
   so downstream conditions see them absent; because all references are
   strictly-earlier, one forward pass resolves cascades and matches the wizard's
   client-side recompute. Required + number/date min/max (`config`) are enforced
   only on VISIBLE items; min/max only when an answer is PRESENT (a blank
   non-required field is owned by the required check). A bound violation raises
   the new SQLSTATE **HC061** with a parameterized pt-BR message.

6. **`save_section_answers` gains `p_observations` (DROP+CREATE).** The 4-arg
   signature is dropped and a 5-arg one created (avoids an ambiguous overload);
   grants re-applied. The observation upsert touches ONLY `answers.observation`
   and the value upsert only `value`. Observations never enter `answer_map`
   (it reads `value`), so they never affect conditions; per Architecture Rule 11
   the audit log never copies observation text (same as answer values).

## conditionTargets widening (supersedes a prior decision)

The query helper `conditionTargets` (and `ConditionTarget`) is widened beyond
choice-only to include `number`/`date`/`time` inputs and to carry the target's
`type`, so the shared condition builder can filter operators and pick the right
value control. This intentionally supersedes the earlier "conditionTargets is
choice-types only" rule, which was a UI value-picker contract, not a schema
rule. `free_text`/`short_text` remain excluded (no discrete or ordered value).

## Consequences

- One additive, forward-only migration `20260623120000_form_builder_enhancements.sql`;
  remote `db push` deferred to a human-gated step after the gate.
- No new RLS/grants — additive columns inherit each table's policies; the
  SECURITY-DEFINER RPCs own their writes.
- Dashboard aggregation / coloured charts for the new types are explicitly
  deferred to a follow-up.

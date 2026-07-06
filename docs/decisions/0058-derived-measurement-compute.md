# 0058 — Derived quality-indicator measurement compute (the parity lock)

**Date:** 2026-07-05 · **Status:** proposed (Phase 15 / task B4) · **Implements:** ADR
[0057](./0057-indicators-doc-control-replan.md) dec. 3 · **Per-phase compute ADR required by** ADR
[0028](./0028-accreditation-governance-roadmap.md). **Touches:** the Phase-8 dashboard spine
(`app.submitted_form_responses`, `public.dashboard_distributions`, `app.version_has_option_code`,
`app.latest_published_version`) and the answer-model-v2 typed column `answers.value_number`.

## Context

Phase 15 indicators can be **derived** from submitted-form aggregates instead of hand-entered. The
binding requirement (spec acceptance + ADR 0057 dec. 3) is a **parity lock**: a derived value MUST
equal the Phase-8 dashboard aggregate for the same form + window, asserted by pgTAP. The classic
per-1000 `taxa` is a **hybrid** — a derived numerator with a manually supplied denominator, computed
in **one step** with no partial-measurement state. Derived config references the immutable option
`code` (the normalized cross-version identity), never labels or option-row ids.

We must decide HOW the derived numbers are produced so they coincide with the dashboard **by
construction**, not by a fragile "keep two queries in sync" convention.

## Decision

1. **Re-use the dashboard's aggregate mechanics; do not call the dashboard RPC.**
   `dashboard_distributions` gates on `is_staff_admin_of OR is_admin` and emits per-option rows —
   wrong authority tier and wrong shape for a commission_admin computing an indicator. Instead
   `compute_derived_measurement` (SECURITY DEFINER, gated `is_staff_admin_of OR is_commission_admin_of`
   of the indicator's commission) replicates the SAME canonical inputs so the numbers are identical:
   - the same submitted spine `app.submitted_form_responses(form_id)`
     (`status='submitted' AND case_phase_id IS NULL`);
   - the same window predicate `submitted_at::date` between `p_from`/`p_to`
     (period bounds, or the measurement's `period_start`/`period_end`);
   - the same option-`code` join chain `answer_selected_options → answers → form_items →
     form_item_options`, filtered to choice `item_type ∈ {multiple_choice, dropdown, checkbox}`.

2. **Numerator = the dashboard `tally` restricted to the config's codes.** For
   `percentual`/`contagem`/`hibrido`, the numerator is `sum(option_count)` over
   `numerator.option_codes` for `numerator.question_key` — exactly the `tally` CTE of
   `dashboard_distributions` summed across the selected codes. Checkbox multi-select contributes one
   count **per selection row**, matching the dashboard (parity by construction).

3. **Denominator mirrors the dashboard `denom` (or `respondentes`).** For a `percentual`/`contagem`
   `{question_key}` denominator, use the dashboard's per-key `denom` = distinct responses that
   answered ANY question in that key's SECTION (the section-answered distinct-response count —
   identical CTE). For `'respondentes'`, use `count(*)` of the windowed
   `submitted_form_responses`. `contagem` reports the raw numerator (denominator stored for
   provenance only).

4. **`tempo_medio` = mean of the typed answer.** `value := avg(answers.value_number)` over the
   windowed submitted responses where `question_key = value.question_key` and `value_number is not
   null` (the answer-model-v2 typed shadow column, which the evaluator does NOT depend on — Rule 3
   untouched). `denominator` = the n averaged; `value = numerator = round(avg, 4)`.

5. **Hybrid taxa is ONE-STEP and born complete.**
   `compute_derived_measurement(p_indicator, p_period_label, p_denominator := null, …)`:
   - derive the numerator (§2);
   - **denominator preserve rule:** use `p_denominator` if supplied; else reuse the stored
     denominator of an existing `(indicator, period)` row (recompute re-derives ONLY the numerator);
     else raise **HC088** — no partial row is ever written;
   - `value := numerator/denominator*1000`; classify; **upsert** `source='derivado'`.
   `sem_dados` remains the ONLY empty state.

   **A `taxa` may also be fully MANUAL** (LEAD FIX 2026-07-05 — the biconditional forcing every
   `taxa` to be hybrid was dropped; a hand-tabulated rate is common). A manual `taxa`
   (`data_source='manual'`) routes through `record_indicator_measurement` (hand-entered numerator +
   denominator; the same `num/den×1000` value), NOT this compute path. The `compute_*` /`record_*`
   split keys on **`data_source`** (HC085/HC086), not on `kind`, so manual/hibrido taxa each reach
   the right RPC. `hibrido` is reserved for taxa; `derivado` is reserved for non-taxa (two one-way
   table CHECKs).

6. **`derived_config` is validated at SAVE, against the latest published version.**
   `app.validate_indicator_derived_config` checks shape-per-kind and that every referenced option
   `code` (and the denominator `question_key`) exists in `app.latest_published_version(form_id)` via
   `app.version_has_option_code` — unknown → **HC084** at save time. Labels drift across versions;
   `code` is the stable identity, so a derived indicator keeps aggregating correctly across
   re-published versions (the whole point of the option-`code` spine).

7. **Classification is comparator-driven, direction-agnostic for the on/off decision.**
   `app.classify_measurement(value, target, comparator, direction)` evaluates `value <comparator>
   target`; `direction` drives only the warning-band side and the chart. This classifies correctly
   for both `maior_melhor/>=` and `menor_melhor/<=` without special-casing.

## Consequences

- **Parity is structural, not conventional** — the derived path and the dashboard read the same
  spine, join, and window, so a pgTAP assertion `derived == dashboard_distributions(...)` for a
  seeded form locks them together; a future change to the dashboard aggregate that isn't mirrored
  here fails that lock loudly.
- Derived indicators inherit the Phase-8 submitted-only semantics (standalone submitted responses,
  case-phase answers excluded) — the correct denominator universe for a quality metric.
- No new evaluator surface and no change to `eval_condition` / the condition vectors (Rule 3): the
  compute path reads aggregates and typed answers, never the evaluator.
- SQLSTATEs `HC084`–`HC088` are allocated here (detail in
  `docs/plans/phase-15-indicators-backend.md` §5).

## Alternatives rejected

- **Call `dashboard_distributions` from the compute RPC** — wrong authority gate (excludes a
  commission_admin who is not staff_admin), per-option row shape, and a hidden coupling to that
  RPC's viewer check. Replicating the CTEs under the indicator's own DEFINER gate is cleaner and
  keeps parity explicit + test-locked.
- **A two-step hybrid** (derive numerator, persist a partial row, then attach the denominator) —
  rejected: introduces a partial-measurement state and a second status beyond `sem_dados`. One-step,
  born-complete keeps the state machine minimal (ADR 0057 dec. 3).
- **Store the numerator config as option-row ids or labels** — rejected: neither survives a version
  re-publish. Option `code` is the immutable cross-version identity (form-model normalization).

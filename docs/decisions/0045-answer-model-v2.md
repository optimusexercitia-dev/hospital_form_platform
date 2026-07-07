# 0045 — Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys)

- **Status:** accepted — **implemented & shipped 2026-07-01** (baseline
  `20260620000000`; remote re-baselined 2026-07-01). Record:
  [../progress/answer-model-v2.md](../progress/answer-model-v2.md); Phase-Status row
  `answer-model-v2` in [../../PROGRESS.md](../../PROGRESS.md). Referenced as landed reality
  by ADR [0057](0057-indicators-doc-control-replan.md) and ADR
  [0060](0060-flexible-forms-foundation.md).
- **Extends:** ADR [0040](0040-form-builder-enhancements-condition-engine.md)
  (number/date/time item types, `config`, per-item `visible_when`) and the
  `form-model-normalization` work (`form_item_options` + `answer_selected_options`;
  `app.answer_map` as the evaluator's single rehydration layer —
  [../progress/form-model-normalization.md](../progress/form-model-normalization.md)).
- **Pairs with:** ADR [0046](0046-forward-compat-form-capabilities.md) (the forward-compat
  contract; it explains *why* the instance hooks below exist).
- **Binding rules:** Architecture Rule 3 (one evaluator, mirrored SQL↔TS, no drift), Rule 5
  (published immutability), Rule 1 (RLS), Rule 8 (regenerated types).

## Context

After `form-model-normalization` the answer model is **split by item kind**:

- **scalars** (`free_text`/`short_text`/`number`/`date`/`time`) → one `answers` row, value in a
  single `value jsonb`;
- **choices** (`multiple_choice`/`dropdown`/`checkbox`) → rows in
  `answer_selected_options(response_id, item_id, option_id)`, with **no** `answers` row unless
  the item happens to carry an `observation` (verified in `save_section_answers`).

Two structural limits follow — both cheap to fix **now** (pre-launch: no users, no data) and
expensive later:

1. **No uniform home for per-answer metadata.** A choice answer has no parent row, so there is
   nowhere consistent to record answered-at, validation state, or a per-field confidentiality
   flag.
2. **The answer key is `(response_id, item_id)`** — it hard-codes "one answer per item per
   response," foreclosing **repeating groups** (N instances of a block) without a later, painful
   re-key + backfill across every answer, plus a rewrite of `answer_map`, `save_section_answers`,
   `submit_response`, dashboards, export and the immutability triggers.

number/date/time (ADR 0040) also still land in `value jsonb`, which is awkward for the Phase-15
quality-indicator analytics (numeric aggregation, run/control charts, range filters) that want
real typed columns.

## Decision

Adopt **one uniform answer entity** and make the answer key **instance-ready** — **without
building repeating groups** (their definition + UX ship later; ADR 0046).

### Uniform answer row
Every answered item — scalar **or** choice — gets exactly one `answers` row per
`(response, item, instance)`. Choice rows carry `value = NULL`; their selections hang off the row.
This is the home for `answered_at` and a reserved `confidentiality_level`.

### Selections reference the answer
`answer_selected_options` becomes
`(answer_id → answers ON DELETE CASCADE, option_id → form_item_options ON DELETE CASCADE,
PRIMARY KEY (answer_id, option_id))`. Response, item and instance are inherited via `answer_id`
— one clean PK, **no nullable-key trap**.

### Instance-ready key (scaffold only — no repeating-group build)
- `answers.group_instance_id uuid NULL → response_group_instances(id) ON DELETE CASCADE`
  (NULL = top-level; the only value written until repeating groups ship).
- New `response_group_instances(id, response_id, group_item_id → form_items,
  parent_instance_id NULL → self, position, created_at)` — created, RLS'd and immutability-guarded
  now; **inert/unused** until repeating groups exist (its purpose is ADR 0046).
- Uniqueness (replacing `unique(response_id, item_id)`) via **two partial unique indexes** —
  because a plain `unique(response_id, item_id, group_instance_id)` treats NULLs as *distinct* and
  would silently permit duplicate top-level answers:
  - `unique (response_id, item_id) where group_instance_id is null`
  - `unique (response_id, item_id, group_instance_id) where group_instance_id is not null`

### Typed scalar columns
Add `value_number numeric`, `value_date date`, `value_time time` to `answers`, **derived** from
`(value, item_type)` by a `BEFORE INSERT/UPDATE` trigger `app.sync_answer_typed_values`.
`value jsonb` stays the **canonical** value the evaluator reads; the typed columns are a
denormalization for analytics/indexing only. (No `value_text` — free_text is sampled, not
aggregated; deferred.)

### Per-answer metadata
`answered_at timestamptz not null default now()` (contemporaneous; ALCOA+). `confidentiality_level
text not null default 'standard'` — **reserved and unenforced** (the hook for future field-level
confidentiality; ADR 0046). `answered_by` intentionally omitted (a response is single-author via
`created_by`; add later only if multi-author answering appears).

### Evaluator parity — the hard invariant (Rule 3)
`app.eval_condition` / `app.eval_visibility` and their TS twins are **untouched**. Only
`answer_map` / `answer_map_by_item` / `case_phase_answer_map` change *how they source* data
(selections via `answer_id → answers`; scalars from `answers.value`); their `question_key→value`
output stays **byte-for-byte identical** (single→scalar code, checkbox→ordered code array,
scalars→raw). Guarded by the existing shared vector fixtures **plus a new golden-output test** over
a representative response. Drift is phase-blocking.

### Immutability & RLS
- `guard_submitted_children_trg` extends to `response_group_instances`; the
  `answer_selected_options` guard reaches the response via `answer_id → answers`.
- New RLS on `response_group_instances` mirrors `answers` (member read via
  `commission_of_response`; creator writes only while `in_progress`).
- `answer_selected_options` policies re-derive response/commission through `answer_id`
  (was direct `response_id`); add an index on `answer_id`.

### Delivery
Additive, forward-only migrations on the existing baseline (do **not** edit the pushed baseline →
history-block). **No feature flag** (transparent refactor; matches the normalization /
form-builder-enhancements precedent). Regenerate `database.ts`. Validate via `db reset --local`;
the human runs `supabase db push` (background agents can't authorize a remote deploy). Optional
end-of-package re-squash to a fresh single baseline (as the normalization did). Pre-launch → **no
data backfill**. Shipped alongside: `form_items.default_value` (minor; ADR 0046 + plan). Run as a
**mini-phase** per CLAUDE.md §6 (it touches the answer model + immutability + the evaluator's
inputs) → a **full plan review** on the answer migrations.

## Consequences

- `+` One uniform answer entity; per-answer metadata has a home; the answer key can address
  instances → **repeating groups become a normal additive feature later** (no re-key, no backfill).
- `+` Real numeric/date/time columns for the Phase-15 indicator track; evaluator untouched.
- `+` Cleaner selection identity (`(answer_id, option_id)` PK) — the nullable-key trap is avoided
  by construction.
- `−` Blast radius equal to the normalization: `answer_map` (+twins), `save_section_answers`,
  `submit_response`, `response_required_complete`, dashboards, export, `clone_form_version`, RLS
  and immutability are all touched → gated on golden-parity + immutability + RLS pgTAP.
- `−` A reserved, unenforced `confidentiality_level` column (and the inert `response_group_instances`
  table) exist ahead of their features (documented, cheap).

## Alternatives rejected

- **Keep the split model; add `group_instance_id` only to `answer_selected_options`.** Needs a
  surrogate PK + the same partial-index dance and still leaves choice answers metadata-less; the
  uniform row is both cleaner and required by the P1.3 goal.
- **Generated typed columns** (`value_number generated always as ((value #>> '{}')::numeric)`).
  A single generation expression can't branch on `item_type`; a text row's `value` would fail the
  numeric cast. Trigger-derived instead.
- **`unique(response_id, item_id, group_instance_id)` with `NULLS NOT DISTINCT`.** Works on PG15+,
  but the two partial indexes express intent explicitly and are version-agnostic.
- **Full typed columns + per-answer snapshots per the other-team model** (`value_string`/`boolean`/
  `datetime`/… + label/color/score snapshots). Snapshots are redundant here (published versions +
  option `code` are trigger-immutable; dashboards resolve current labels by code); add only the
  typed columns the domain needs now.

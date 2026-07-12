# F3 — `question_key` → aggregation contract for the new field types

**Status:** ratified (lead, 2026-07-11) · **Owner:** `backend` · **Phase:** F3 (Flexible-Forms
Foundation) · **Source:** ADR [0060](../decisions/0060-flexible-forms-foundation.md) §4 (Rec A) +
ADR [0065](../decisions/0065-pre-pilot-foundations-conventions.md) §6/§7 (freeze principle, reference
bridge) + the [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md) §3 (F3 scope).

## Why this note exists

The platform's Phase-8 dashboards and the Phase-15 derived-indicator engine both aggregate submitted
answers by a **stable scalar `question_key`** across form versions (ADR 0058 makes the derived-indicator
aggregate *identical to* the dashboard aggregate — one keyed on option `code` / `answers.value_number`).
Every field type F3 reserves breaks the "one `question_key` → one scalar answer" assumption:

- **repeating_group** — N instances per key;
- **matrix / risk_matrix** — addressed by (row × col) / (severity × likelihood), not one key;
- **reference** — the aggregatable value is a foreign id, not a display label.

ADR 0060 §4 makes settling this a **prerequisite** for landing the inert answer-shape tables
(`form_matrix_rows`/`_columns`, `answer_matrix_cells`, `answer_risk_matrix`, `answer_references`): each
table is authored *against* this contract, not retrofitted against real data (the same cost logic that
justified Answer-Model v2). It is **not** a blocker on the enum/column widen (which freezes no complex
answer shape). Snapshots (ADR 0060 Gap 40) stay rejected — aggregation resolves against the **immutable
published version** (Rule 5), never an answer-row snapshot.

## Cross-cutting invariant (applies to all four types)

**Aggregate on clone-stable identity, resolve labels late.** Matrix rows/columns carry a hidden,
immutable, clone-verbatim `code` (exactly like `form_item_options.code`); references carry the
registry `participant_id`. Aggregation keys on those stable identities; the human-readable label is
resolved at read time from the current version. This is the platform's existing philosophy
(conditions + dashboards key on `option.code`, never the renameable label) extended to the new types,
so a label edit or a clone never fractures a historical aggregate.

## Per-type contract

### 1. `repeating_group` — **explode by child `question_key`** (do not collapse)

- The repeating group's own item is a **container** (it collects no direct scalar answer). Its
  **child input items** carry the `question_key`s that aggregate.
- Each instance's child answer is a **distinct data point** under that child's `question_key`. The
  `answers.group_instance_id` distinguishes rows but is **NOT** part of the aggregation key — so N
  instances contribute N values to the same key. The existing dashboard `GROUP BY option.code /
  value_number` simply sees more rows; **no evaluator or aggregation-shape change** is required when
  repeating groups activate (FF-1).
- **Instance count** is available as an *optional derived scalar* via a reserved synthetic key (the
  `__total_score__` / `__flagged_count__` precedent in `src/lib/queries/conditions.ts`), never the
  primary aggregation.
- **Rejected:** "latest-only" (committees want every instance — e.g. every device checked, every
  medication reconciled) and "count-only" (loses the child measurements).
- **Storage:** already exists (`response_group_instances` + `answers.group_instance_id`, ADR 0045/0046).
  F3 adds only **position-uniqueness within a parent**; write RPCs → FF-1.

### 2. `matrix` — **the cell is the unit; address `(question_key, row_code, col_code)`**

- A matrix item's bare `question_key` is **not** a scalar aggregation key — it maps to a grid.
- The aggregatable unit is the **cell**, addressed by the composite `(question_key, row_code,
  col_code)`, where `row_code` / `col_code` are the clone-stable codes on `form_matrix_rows` /
  `form_matrix_columns`. `answer_matrix_cells.value` is the per-cell scalar.
- An indicator/dashboard that targets a matrix **must** pick a (row, col) to reduce the grid to a
  series; the picker UX is FF-2. F3 only freezes the storage so this addressing is possible.

### 3. `risk_matrix` — **derived scalar by `question_key` + severity/likelihood distributions**

- Unlike a plain matrix, a risk matrix **does** expose a scalar: the derived `risk_score` per answer
  (`answer_risk_matrix.risk_score`), which aggregates by the item's `question_key` **exactly like a
  `number` answer**.
- The `(severity_code, likelihood_code)` pair is separately addressable for distribution charts
  (`(question_key, severity_code)` / `(question_key, likelihood_code)`).
- Severity levels are `form_matrix_rows`; likelihood levels are `form_matrix_columns` (risk matrices
  reuse the matrix axis tables). The score derivation (weight formula) is FF-2's writer concern; F3
  freezes the storage columns only.

### 4. `reference` — **aggregate on `participant_id`, never the label**

- The aggregatable value is the **foreign id** (`answer_references.participant_id → participants(id)`),
  which is already stable across versions (the participants registry, ADR 0064). The display label
  resolves late from the registry.
- "Count responses referencing entity X" groups on `answer_references.participant_id` under the
  reference item's `question_key`, i.e. addressed by `(question_key, participant_id)`.
- The `reference_kind` discriminator (F3: `'participant'` only) reserves the A/C bridge (ADR 0065 §7).
  Internal-platform-entity lanes (department / committee / user selectors as first-class targets) are
  **deferred-but-additive** — FF-5 widens the `reference_kind` CHECK and adds its own nullable target
  column(s); labels still never aggregate.

## Consequence for the F3 inert tables (built against this note)

| Table | Aggregation key it must support | F3 shape decision |
|---|---|---|
| `form_matrix_rows` / `form_matrix_columns` | clone-stable `code` per axis entry | `code` (hidden, immutable) + version-scoped, mirroring `form_item_options` |
| `answer_matrix_cells` | `(question_key, row_code, col_code)` | FK `row_id`/`col_id` → the axis rows (`option_id` precedent); `code` resolved via the row |
| `answer_risk_matrix` | `question_key` → `risk_score`; `(…, severity/likelihood)` | one row per answer; `risk_score numeric` + severity/likelihood axis FKs |
| `answer_references` | `(question_key, participant_id)` | `participant_id → participants(id)` + `reference_kind` |

**Completeness / countability boundary (F3 correctness invariant).** The five new item types must not
leak into `app.response_required_complete` (keyed `required = true AND question_key IS NOT NULL`, no
item-type filter) nor into any dashboard-countable enumeration, because their answers live in the new
tables, not in `answers.value` / `answer_selected_options`. F3 enforces this **by construction**: the
`form_items_input_vs_display` shape CHECK forces `required = false` for all five new types, so a
required (and therefore unsatisfiable) matrix/reference/group can never be authored until its FF phase
co-designs the completeness path and relaxes the CHECK. Dashboards are unaffected structurally (they
read `answers` / `answer_selected_options`, which the new answer tables do not populate).

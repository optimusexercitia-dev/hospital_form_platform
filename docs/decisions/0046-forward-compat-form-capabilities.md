# 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values

- **Status:** accepted — **implemented & shipped 2026-07-01** (the forward-compat hooks are
  in baseline `20260620000000`; `default_value` is live). Record:
  [../progress/answer-model-v2.md](../progress/answer-model-v2.md); Phase-Status row
  `answer-model-v2` in [../../PROGRESS.md](../../PROGRESS.md). The deferred capabilities in
  this ADR's "left for later" contract are dispositioned in ADR
  [0060](0060-flexible-forms-foundation.md).
- **Pairs with:** ADR [0045](0045-answer-model-v2.md) (Answer-Model v2 — lands the *answer-side*
  hooks: `group_instance_id`, `response_group_instances`, the uniform `answers.id`, the reserved
  `confidentiality_level`).
- **Extends:** ADR [0040](0040-form-builder-enhancements-condition-engine.md).
- **Binding rules:** Rule 5 (published immutability), Rule 3 (evaluator), Rule 1 (RLS).

## Context

The platform's form engine is deliberately narrower than a generic builder (see the 2026-07-01
forms data-model review). We keep that focus but **lock in the schema hooks that are expensive to
retrofit after real data exists**, so repeating groups and richer answer blocks become *ordinary
additive features* later. We are **not** building those features now — only their structural
affordances — plus one small builder feature (**default values**) that rides the same surfaces.

## Decision

Establish now the minimum structure that makes the deferred capabilities additive-only later, and
record the intended extension path and the explicit deferrals.

### Definition-side additions (in this package)
- **`form_items.parent_item_id uuid NULL → form_items(id) ON DELETE CASCADE`** — the self-reference
  a future `repeating_group`/`group` container will use to own child items. **Always NULL now**
  (all forms flat); no group `item_type`, no position-within-parent semantics yet.
  `clone_form_version` copies/remaps it.
- **`form_items.default_value jsonb NULL`** — **shipped now** (P2.4): a per-input default value.
  Display items must keep it NULL (CHECK). Choice defaults store the option **code(s)** (mirroring
  the `answer_map` shape); scalar defaults store the scalar. `clone_form_version` copies it;
  `publish_form_version` validates it (type matches the item; choice codes exist via
  `app.version_has_option_code`) → a new `HC0xx`. The wizard pre-fills unanswered **visible** items;
  a saved answer is an ordinary answer (defaults never auto-write hidden items). Detail in the plan.

### The forward-compat contract — what each future feature will use, and what's left

| Future capability | Hook established now (ADR 0045/0046) | Deliberately left for later (additive, **no data backfill**) |
|---|---|---|
| **Repeating groups** | `answers.group_instance_id`; `response_group_instances` (+ nesting via `parent_instance_id`); `form_items.parent_item_id` | `repeating_group` item_type; `config` min/max-items; builder + add/remove-instance wizard UX; **position-uniqueness within a parent**; group rendering; `save_section_answers` instance arg |
| **File / signature / matrix / rating answers** | the **uniform `answers.id` parent row** is the FK anchor these need | new child tables (`answer_files` / `answer_signatures` / `answer_matrix_cells`) → `answers(id)`; widen the `item_type` CHECK; renderers/validators |
| **Field-level confidentiality** | reserved `answers.confidentiality_level` | an RLS predicate keyed on the column + a builder toggle, when a form needs peer-review-privileged fields |
| **rich_text / rating / slider / datetime / decimal / %** | the typed-column pattern (`value_number` already covers decimal/%/rating scales) | widen the `item_type` CHECK; add `value_datetime` / `value_text` if ever needed |

Because published versions are **immutable**, none of the "left for later" items touch historical
data — each is an ordinary additive migration exercised only by new draft versions.

### Explicitly NOT in scope (and why)
- **Repeating-group and new-block UX / item types** — per the review and this request: **structure
  only, no build.**
- **`form_item_validations` table** (P2.5) — `config` min/max covers today; add when forms need
  multiple named rules with custom pt-BR messages/severities.
- **A generic form logic→actions engine** — the platform already realizes assignment / notification
  / task / RCA / CAPA as first-class modules (cases + `recommend_when`, action items, meetings, NSP);
  `visible_when` stays **visibility-only**. A generic engine would fragment hardened workflow logic.
- **Per-answer snapshots** (label/color/score/position) — redundant given DB-immutable published
  versions + immutable option `code`; dashboards already resolve current labels by code.
- **RBAC/ABAC role-bindings** — the fixed-role + org-scoped RLS + audit + PHI-isolation core is
  coherent and hardened; borrow only the field-confidentiality *idea*, additively, via the reserved
  column.

## Consequences

- `+` Repeating groups and file/signature/matrix answers become additive features (no re-key, no
  backfill) whenever the domain needs them.
- `+` Default values ship now; the builder is more expressive with zero answer-model impact.
- `−` A nullable `parent_item_id` and an inert `response_group_instances` table exist ahead of their
  feature (documented, cheap).

## Alternatives rejected

- **Defer the answer-side instance key too.** That key is the single expensive-to-retrofit piece
  (ADR 0045); deferring it defeats the purpose of doing anything now.
- **Build repeating groups now.** Out of scope by request; also a large builder/wizard effort.
- **A data-driven `question_types` catalog.** Attractive for adding types as data, but every new
  type needs renderer/validator code regardless; the `item_type` CHECK is simpler and widens
  cheaply. Optional, not now.

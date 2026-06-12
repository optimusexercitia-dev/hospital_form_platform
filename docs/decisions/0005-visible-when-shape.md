# ADR 0005 — `visible_when` condition shape (v1)

**Date:** 2026-06-12
**Status:** Accepted
**Phase:** 1

## Context

A `form_sections.visible_when` controls whether a section is shown based on an
earlier answer. We need a shape that the SQL evaluator, the TypeScript mirror,
and the (Phase 4) builder all agree on, without over-building.

## Decision

v1 is a **single condition, no AND/OR trees**:

```json
{ "question_key": "<key>", "op": "equals" | "not_equals" | "in", "value": <jsonb> }
```

- `equals` / `not_equals`: compare the answer to `value`. For a checkbox answer
  (a JSON array), "equals" means `value` is among the selected options.
- `in`: `value` is an array; true if the answer (or any selected checkbox
  option) is one of its elements.
- A missing/null answer ⇒ `equals` false, `not_equals` true, `in` false.
- `null` `visible_when` ⇒ always visible (the default section is always null).

A CHECK constraint enforces this shape at write time; `validate_visible_when`
enforces the structural rules (no condition on the first section; referenced key
belongs to an input item in a strictly-earlier section) at publish time.

## Extension point

To add AND/OR later without breaking stored rows: introduce a discriminated
shape, e.g. `{ "all": [<cond>, ...] }` / `{ "any": [<cond>, ...] }`, and have
the evaluator recurse, treating the current object shape as a single leaf. The
CHECK constraint and both evaluator implementations would branch on the presence
of `all`/`any` vs a leaf. Stored v1 leaves remain valid leaves.

## Rationale

Single conditions cover the real commission-form use cases (show section B when
question X = "Sim"), keep the builder UI simple (one earlier question + op +
value), and keep the SQL↔TS mirror small enough to verify exhaustively with the
shared vector file. The extension point is cheap to honour because conditions
reference `question_key` (stable across version clones), not item ids.

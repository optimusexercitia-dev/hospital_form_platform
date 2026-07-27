# 0089 — FF-2 Matrix & Risk Matrix: cell contract, risk derivation, required semantics, axis codes

**Date:** 2026-07-27 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Phase:** FF-2, the second of the five feature phases ADR
[0086](0086-flexible-forms-pre-pilot.md) pulled pre-pilot. **Flag:** `matrix_fields` (seeded
OFF; flipped by its own enable migration at the FF-2 gate).
**Implements:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-2.
**Builds on:** ADR [0060](0060-flexible-forms-foundation.md) (F3 substrate) · ADR
[0087](0087-ff1-repeating-groups.md) (FF-1 instance engine — FF-2 answers *inside* its
instances) · ADR [0065](0065-pre-pilot-foundations-conventions.md) (conventions) · ADR
[0079](0079-authz-door-blindness-standing-invariant.md) (keystone discipline) · the ratified
[question_key aggregation contract](../design/f3-question-key-aggregation.md).

> **ADR number.** The FF-2 session-handoff block in PROGRESS.md says "author ADR 0088". That
> number was taken on 2026-07-27 by [0088](0088-case-type-assignment-channel.md) (case-type
> assignment), authored in a parallel session. FF-2 is **0089**.

## Context

F3 froze the matrix bones on 2026-07-12 and nothing has written to them since:
`form_matrix_rows` / `form_matrix_columns` (per-item, per-version axes with `position`, `code`,
`label`), `answer_matrix_cells` (`answer_id`, `row_id`, `col_id`, `value jsonb`, unique on the
triple) and `answer_risk_matrix` (`answer_id` unique, `severity_row_id`, `likelihood_col_id`,
`risk_score numeric`). All four carry a SELECT policy only — the K9 reader-non-writer posture.
FF-2 is the phase that makes them live.

A live-catalog audit at phase start — 200/200 migrations registered, max version
`20260829000100` matching the last file on disk; read from `pg_proc` / `pg_policies` /
`pg_constraint`, never from migration text (CLAUDE.md §graphify exception) — confirms the plan's
§3 FF-2 scope and adds **one hazard the plan does not record**. See §Substrate.

The four questions below are the ones the plan left to the PO because each changes the writer
signatures, not just the UI. They were settled in the 2026-07-27 interview.

## Decision

### 1. The cell contract is a radio grid — columns are the options

A `matrix` item is a grid in which **each row takes exactly one column**. The cell row *is* the
selection: `answer_matrix_cells.value = 'true'::jsonb`, carrying no payload of its own. Rows are
the criteria being assessed; columns are the shared scale (`Conforme` / `Não conforme` / `N/A`).

*Enforced in the schema*, not only in the writer: a `UNIQUE (answer_id, row_id)` constraint on
`answer_matrix_cells`, alongside the existing `UNIQUE (answer_id, row_id, col_id)`. The writer is
a DEFINER RPC and direct DML stays denied (K9), so this is belt-and-braces — but it makes the
invariant true of the *table*, which is what a later phase's fixture, seed, or
`insert_block_from_library` will actually collide with.

*Why:* this is the shape hospital commission checklists actually take, and it is the only one of
the three candidates that needs no new type vocabulary. Typed cells (uniform or per-column) would
introduce a `value`-shape allowlist that FF-3's validation engine must then cover, and a
per-column input type would fork the aggregation rule by column — both on the phase the program
plan already sequences before the validator exists. The `value` column stays jsonb and the
`(answer_id, row_id, col_id)` uniqueness stays, so admitting typed cells later is a constraint
drop plus a `cellType` config key: **no migration to the answer table, no change to the
aggregation contract.**

*Aggregation:* the cell unit is `(question_key, row_code, col_code)`, counted. It resolves through
`code`, never through `row_id`/`col_id` — axis ids are per-version, codes are not (ruling 4).

### 2. Risk weights live on the axes; `risk_score` is derived server-side

Add nullable `weight numeric` to **both** `form_matrix_rows` and `form_matrix_columns`. For a
`risk_matrix` item the severity rows and likelihood columns each carry a weight, and

```
risk_score = severity_row.weight * likelihood_col.weight
```

is computed **by the answer writer**, never accepted from the client. Score→band mapping is an
ordered threshold list in `form_items.config.riskBands`; the band is derived for display and is
not stored (the score is the durable fact, the band is a presentation of it).

Weights are nullable because a plain `matrix` item has no use for them. A `risk_matrix` item
requires a weight on every axis entry — enforced in `upsert_matrix_axes` and re-checked at
publish, since a cross-row invariant is not expressible as a CHECK.

*Why:* `position` is rejected as the weight because it locks institutions to a 1..N ladder (real
ONA/NBR matrices use 1/3/9/27-style scales) and because reordering an axis in a clone would
silently change what a code means. A config-held score lookup table is rejected because it must
be kept coherent with the axes on every add/remove — a second source of truth for the same fact,
and exactly the coupling INFO-4 asks us to close, not open. Note `form_item_options.risk_weight`
already exists from F3; it belongs to the *options* lane and is **not** what a `risk_matrix`
reads — the two are unrelated despite the shared name.

### 3. `required = true` on a matrix means every row is answered

Row-complete. A required matrix blocks submit until each of its rows has a cell. This relaxes the
`form_items_input_vs_display` arm that currently forces `required = false` for `matrix` /
`risk_matrix`, and adds a matrix arm to `app.response_required_complete` — in **both** its flat
and per-instance loops, because a matrix may sit inside a repeating group.

Axis rows carry no visibility conditions, so "every visible row" reduces to every row. **Item
visibility still wins**: a hidden matrix requires nothing, and a matrix inside a hidden section or
a hidden group requires nothing — the deadlock-negative rule FF-1 settled by precedent (ADR 0087
ruling 3), restated here because it must be re-proven per arm, not inherited.

A `risk_matrix` is required-complete when its single `answer_risk_matrix` row exists.

*Why:* the weaker "at least one cell anywhere" reading makes a required matrix guarantee almost
nothing — a 20-row checklist would satisfy it with one tick. A configurable `requiredMode` triples
the completeness arms and every mode needs its own deadlock-negative proof, on no evidence that
authors want the other two.

### 4. Axis codes are immutable once they exist

`form_matrix_rows.code` and `form_matrix_columns.code` may never be updated. An author editing a
cloned draft may **relabel, reorder, add and remove** axis entries; re-keying an existing one is
refused. Enforced by a `BEFORE UPDATE` trigger on both tables, not by builder convention.

This is deliberately stricter than "immutable *once published*": the trigger does not consult
version status. An author who mistypes a code deletes that axis entry and adds the correct one
while the draft is unpublished, which costs one extra click and buys a rule with no state in it.

*Why:* codes are the cross-version aggregation key, exactly as `question_key` is for items, and
Rule 5 already trains authors on that discipline for `question_key`. Re-keying breaks the one
join the dashboard aggregates on, and it breaks it silently and retroactively. Explicit retirement
of removed axes (so historical series keep rendering) was considered and deferred: it adds a
`retired` flag, a filter on every read path, and builder UI, and the dashboard already handles a
code that stops appearing in later versions.

## Substrate — what the live catalog says, and one hazard the plan misses

### A. 🔴 `app.instance_is_empty` is blind to the matrix tables — new finding

`app.instance_is_empty` decides presence by exactly two facts: a non-null `answers.value`, or an
`answer_selected_options` row. It looks at neither matrix table. `submit_response` **deletes**
instances it judges empty, and `app.response_required_complete` skips them.

A matrix answer's payload lives in `answer_matrix_cells` / `answer_risk_matrix` with
`answers.value` **null**. So the moment FF-2 ships writers, a repeating-group instance whose only
content is a filled matrix is judged empty and **pruned on submit — silently destroying the
answer**, with the cells following it through `ON DELETE CASCADE`.

This is the same class of defect as FF-1's P0-1 and is not recorded in the program plan. FF-2
**must** widen `app.instance_is_empty` to a third and fourth arm, and the widening needs a
mutation-proven keystone: revert the arm and the keystone must go red (ADR 0079). The identical
blindness will apply to `answer_references` in FF-5 — recorded there too.

### B. 🔴 The correction-copy obligation, inherited from FF-1's P0-1

Confirmed live: **neither** `supersede_response` **nor** `start_correction_draft` copies
`answer_matrix_cells` or `answer_risk_matrix`. Both are correct only while those tables are
write-inert. FF-2 adds a copy block for each, to both RPCs — four blocks.

Each block must resolve old→new **through the instance rows** on the preserved
`(group_item_id, position)` identity, exactly as the shipped `answer_selected_options` block does.
A correction gives the successor its **own** `response_group_instances` rows (ADR 0087 Amendment
1.3), so any join matching `new.group_instance_id` to `old.group_instance_id` is unsatisfiable by
construction — that exact bug shipped in FF-1 as a P0, proven live 2 selections → 0.

Two simplifications hold here and should be stated so nobody over-builds: a correction reuses the
**same `form_version_id`**, so `row_id` / `col_id` need no remap — only the answer→answer
resolution. And `risk_score` is copied verbatim rather than recomputed, because the axes it was
derived from are the same immutable rows.

**FF-1's K4 covers selections only.** Nothing existing will catch a repeat.

### C. `clone_form_version` does not copy the axes — INFO-1, matrix half

Confirmed live: the clone copies sections, items, the parent-item remap and
`form_item_options` (including F3's `is_exclusive` / `risk_weight`). It copies **neither**
`form_matrix_rows` nor `form_matrix_columns`. Publishing a matrix and editing it today would
produce a draft whose grid has silently vanished.

FF-2 closes the matrix half by **extracting the shared deep-copy helper** the program plan
schedules here (INFO-1), rather than pasting a fifth copy block — FF-3 (validations) and FF-4
(library insert) are both queued behind that extraction.

### D. What FF-2 must relax, precisely

- `form_items_input_vs_display` — the `matrix | risk_matrix | reference` arm forces
  `required = false`. FF-2 relaxes it for `matrix` and `risk_matrix` only; `reference` stays
  pinned until FF-5.
- `app.response_required_complete` — flat arm **and** per-instance arm, per ruling 3.
- `app.instance_is_empty` — per §A.

### E. What FF-2 must not touch

K9 stands: the four matrix tables keep SELECT-only policies for `authenticated`, all writes go
through DEFINER RPCs, and direct DML stays denied **after** the writers ship. The gate re-proves
this rather than assuming it — a writer landing is exactly when a reader-non-writer posture
quietly becomes a writer posture.

## Consequences

- **New:** `weight` on both axis tables · `UNIQUE (answer_id, row_id)` on `answer_matrix_cells` ·
  code-immutability triggers on both axis tables · `upsert_matrix_axes` + the answer writers ·
  the extracted deep-copy helper · the `matrix_fields` flag (seeded OFF).
- **Migration window: `20260830000000+`.** `20260829…` is taken by ADR 0088's case-type work.
- **Engine:** cell-unit aggregation `(question_key, row_code, col_code)` and `risk_score`-as-number
  in `dashboard.ts`, each with its own supersession-tolerant predicate.
- **Reversible by design:** typed cells become a constraint drop plus a config key (ruling 1);
  nothing here migrates the answer tables again.

### Gate keystones

| Keystone | Proves |
|---|---|
| `k9_matrix_writers_live_dml_denied` | all four tables: RPC writes succeed, direct DML still denied |
| `matrix_one_col_per_row` | a second column on the same row is rejected |
| `matrix_cell_coherence` | a row/col not belonging to the answer's item is rejected (INFO-4) |
| `clone_copies_matrix_axes` | publish → clone → axes deep-copied, codes preserved, source immutable |
| `axis_code_immutable` | UPDATE of a `code` raises, on draft and published alike |
| `risk_score_server_derived` | client-supplied score ignored; product of the two weights stored |
| `completeness_matrix_all_rows` | one empty row blocks submit; all rows filled passes |
| `completeness_deadlock_negative_matrix` | hidden matrix / hidden section / hidden group never blocks |
| **`instance_not_empty_with_matrix_only`** | §A — an instance holding only a matrix answer survives submit |
| **`correction_copies_matrix_answers`** | §B — matrix and risk answers survive a correction **by value, on the correct instance** |
| `supersession_matrix_excluded` | superseded revisions drop out of cell + score aggregation |
| E2E | author axes → fill grid → submit → dashboard cell/score golden |

The two bold keystones are the ones that must be **mutation-proven**: revert the fix, require the
keystone to go red (ADR 0079). Both guard defects that passed every green bar in FF-1.

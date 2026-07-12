# Phase F3 — Flexible-Forms Foundation · QA Review

**Reviewer:** `qa` · **Date:** 2026-07-12 · **Branch:** `feat/f3-flexible-forms`
(merge-base `main` `1807859`, changes uncommitted in the working tree) ·
**Spec:** ADR [0060](../decisions/0060-flexible-forms-foundation.md) +
ADR [0065](../decisions/0065-pre-pilot-foundations-conventions.md) +
[pre-pilot-foundations-program](../plans/pre-pilot-foundations-program.md) §3/§6/§7 +
[f3-question-key-aggregation](../design/f3-question-key-aggregation.md).

## Verdict: ✅ **APPROVED**

**0 BLOCKER · 0 MAJOR · 0 MINOR · 4 INFO (forward-notes for the FF phases).**

F3 lands exactly the create-now bones, the frozen inert answer-shape set, and the one
live feature (dual-evaluator operators) — nothing more, nothing less. The two hardest
invariants of the phase (Rule 3 SQL↔TS evaluator parity, and the K9 scoped-read +
write-inert RLS posture) were verified **live against the running local DB**, not just
read. The one pre-existing authority F3 rewrote (`clone_form_version`) is a faithful
forward-only re-creation with zero column-carry regression. All four INFO items are
forward-notes for the deferred FF phases, already substantially acknowledged in the
migration comments; none blocks the gate.

Scope of this review: the F3 diff surface only (3 migrations, pgTAP `209`, the evaluator
+ its vectors, the 3 `OP_LABELS` maps, the doc reconciliations, types regen). Read-only
on app code.

---

## 1. Security / RLS — PASS (live-verified)

### 1.1 Inert-table RLS: scoped-read + write-inert (Rule 1 · F2 "K9" precedent)
All six new tables (`form_matrix_rows`, `form_matrix_columns`, `answer_matrix_cells`,
`answer_risk_matrix`, `answer_references`, `form_item_validations`) enable RLS **from
creation** with a scoped `to authenticated` SELECT policy **paired with a matching
`GRANT SELECT`**, and **no** write policy / **no** write grant. Live check against the
running DB (`has_table_privilege` + `pg_policies` + `pg_class.relrowsecurity`):

| table | rls_on | SELECT grant | INSERT/UPDATE/DELETE grant | SELECT policy | write policy |
|---|---|---|---|---|---|
| all six | `t` | `t` | `f` / `f` / `f` | 1 | 0 |

So every authenticated write fails `42501` (the grant gate precedes RLS). This is the
correct application of the F1 blocking lesson (a policy without a grant is inert) and its
inverse (no write grant ⇒ writes denied). The definition-table policies mirror
`form_item_options` (`is_member_of` / `is_commission_admin_of` over
`commission_of_version`, `…000000` L170-174, `…000100` L139-149); the answer-table
policies mirror the `answers` read predicate (creator / commission-admin / submitted +
staff-admin, `…000100` L153-190).

- pgTAP `209` C1-C20 (`supabase/tests/209_flexible_forms.sql:114-166`) assert exactly this
  posture per table — SELECT-grant present, INSERT-grant **absent**, SELECT-policy present,
  plus a representative UPDATE/DELETE grant-absence — a real write-inertness assertion, not a
  mere existence check. Because the `not has_table_privilege(... 'INSERT')` assertions would
  also catch an accidental broad/default-privilege grant, they are robust.

### 1.2 No new PHI surface (Rule 12)
`answer_references.participant_id → participants(id)` (`…000100` L108-119) stores an **id
only** — no name, label, or payload column; aggregation is defined on `participant_id`,
never the label (`f3-question-key-aggregation.md` §4). `answer_references_participant_shape`
(live-verified) forces a `participant_id` when `reference_kind='participant'`. With
`answer_files` dropped and no `form_items.phi_policy`, F3 adds **no** PHI-bearing column.
The table is inert (no reader/writer) this phase, so no PHI read path is opened. Rule 12's
enumerated PHI-module set is unchanged. (See INFO-2 for the FF-5 activation obligation.)

### 1.3 Stale-symbol trap closed
No `is_org_admin_of_commission` anywhere in the F3 migrations (the ADR-0051 rename to
`is_commission_admin_of` that F2 tripped). All three helper symbols used
(`is_commission_admin_of`, `is_staff_admin_of`, `is_member_of`,
`commission_of_version`) are the current names, and the clean `supabase db reset --local`
(pgTAP 2023 PASS) proves they resolve.

---

## 2. Rule 3 — evaluator parity + non-authorability — PASS (live-verified)

### 2.1 Byte-for-byte SQL↔TS mirror for the 4 new ops
`app.eval_condition` (`…000200` L84-144) and `evalCondition`
(`src/lib/queries/conditions.ts:544-573`) implement `contains`/`not_contains` and
`is_empty`/`is_not_empty` identically:
- **contains** = array-membership (`answer @> [target]` ⇔ `answer.some(jsonEquals)`, the
  same relation as array-aware `equals`) **OR** text-substring (`strpos>0` ⇔
  `String.includes`, case-sensitive); every other value type → false; **no number→text
  coercion**. `not_contains` = negation.
- **is_empty** (unary, `value` ignored) = absent-key / JSON null / `''` / `[]`; number `0`
  and `[null]` are non-empty; no trimming. `is_not_empty` = negation.

I called `app.eval_condition` directly on the running DB for the trickiest vectors; **all
match the golden expected AND the TS side** (Vitest `conditions.test.ts` **81/81**
independently re-run here):

```
contains "2" on 12         → false   (no coercion)      is_empty on 0        → false
contains "grave" on str    → true    (substring)        is_empty on []       → true
contains "luvas" on [..]   → true    (array membership) is_empty on ""       → true
contains "2026" on ISOdate → true    (text substring)   is_not_empty on 0    → true
not_contains "leve"        → true                       is_empty on {}       → true (missing)
```

`app.eval_condition` stays `IMMUTABLE` + `search_path 'pg_catalog'` (`…000200` L32-33), a
forward-only `CREATE OR REPLACE` of the baseline authority. `is_true`/`is_false` are **not**
added (no boolean answer type). The TS `default` branch keeps its `never` exhaustiveness
guard (`conditions.ts:574-578`).

### 2.2 The ops are non-authorable (live-verified)
The storage gate `app.is_valid_condition` keeps its op allow-list
`['equals','not_equals','in','gt','gte','lt','lte']` (baseline L3344-3346) — **F3 does not
touch it**, nor `is_valid_visibility` / `assert_condition_op_target` / `validate_visible_when`.
Live check:

```
is_valid_visibility({op:'contains'})  → false   (rejected at the form_items/sections CHECK)
is_valid_visibility({op:'is_empty'})  → false
is_valid_visibility({op:'equals'})    → true
```

So a stored `visible_when` carrying a new op is rejected by the
`form_{items,sections}_visible_when_shape` CHECK — the ops are evaluator-only vocabulary,
exercised solely by the golden vectors. The builder pickers are unchanged: the diffs to
`condition-builder.tsx`, `describe-visibility.ts`, and `result-ruleset-editor.tsx` add
**only** the four pt-BR `OP_LABELS` entries required by the widened `Record<ConditionOp>`
(register-matched: "contém"/"contiver", "está vazio"/"estiver vazio"); `CHOICE_OPS` /
`ORDERED_OPS` / `AGGREGATE_OPS` are untouched. `visible_when` stays visibility-only.

### 2.3 Golden vectors cover operator × value_type
26 new vectors added to **both** `condition-vectors.json` and the inline set in
`supabase/tests/20_conditions.sql:49-73`, name-for-name and input-for-input identical
(the byte-for-byte mirror), spanning string / checkbox-array / number / date / missing /
null / empty-string / empty-array — including the two trap cases (`contains` no-coercion,
`is_empty` 0-vs-empty). Two wrapper vectors added to `visibility-vectors.json` +
`20_conditions.sql` confirm the ops pass through `eval_visibility` unchanged. The SQL
`plan()` is row-count-driven, so added vectors can't silently under-run the plan. (See
INFO-3 on the manual cross-file sync.)

---

## 3. Requirements / scope conformance — PASS (live-verified)

- **`item_type` widened on BOTH constraints** (the "two constraints" trap): live
  `form_items_item_type_check` = 15 values; `form_items_input_vs_display` gains an
  answerable arm (`matrix`/`risk_matrix`/`reference`: `question_key`+`label`, `content
  NULL`, **`required=false`**), a container arm (`group`/`repeating_group`: `content NULL`,
  `required=false`), and keeps `ELSE false` (D6-flip). pgTAP `209` A1-A6/B1-B2 lock accept +
  garbage-reject + `required=true` rejection.
- **Flag-5 completeness invariant BY CONSTRUCTION.** `app.response_required_complete`
  (baseline L3959-3981; **not** redefined by F3 — the `20260714000000` reference is a call
  site only) counts `required=true AND question_key IS NOT NULL AND visible`, satisfied
  only via `answers.value` / `answer_selected_options`, with **no item-type filter**. A
  `required` new-type item (whose answer lives in the new tables) would therefore deadlock
  submission — and the shape CHECK forcing `required=false` on all five types is exactly
  what forecloses it. New types also cannot leak into dashboards (answers never land in
  `answers`/`answer_selected_options`) and have **no builder authoring path**
  (`add-block-menu.tsx` / `item-editor-dialog.tsx` untouched → the inert types are not
  offered in the UI).
- **Cheap columns + carry:** `form_item_options.is_exclusive`(default false)/`risk_weight`;
  `form_versions.behavior_config` jsonb (+ object-or-null CHECK, live-verified).
  `clone_form_version` (`…000000` L184-299) carries all three forward — diffed against the
  prior authority (`20260713000800` L192-305): **every** prior column-carry preserved
  (sections, items incl. `parent_item_id` remap, options incl. `flagged`/`is_other`), with
  exactly the three F3 additions and **zero regression** (Rule 5 / Rule 6-clone).
- **Repeating-group shape only:** `response_group_instances` position-uniqueness
  `UNIQUE NULLS NOT DISTINCT (response_id, group_item_id, parent_instance_id, position)`
  (live-verified); write RPCs correctly deferred to FF-1.
- **Frozen inert answer set** authored against the Rec-A contract; **no `*_snapshot`
  columns** (aggregation resolves against the immutable published version, Rule 5). The
  design doc maps each type's `question_key` aggregation (explode-by-child / cell-address /
  derived-score / participant-id) and states the completeness/countability boundary.
- **Exclusions honored:** no file/upload `item_type`; no `form_items.phi_policy`;
  `responses.supersedes_id` is a forward-note only (**not** a column — confirmed absent),
  with the correct ARCHITECTURE §2 coupling note that the future correction engine must add
  the column **and** retrofit dashboard/derived-indicator aggregation atomically.

---

## 4. Lead flag rulings — PASS
`group`/`repeating_group` shaped as containers (not forced `question_key`);
`matrix`/`risk_matrix`/`reference` answerable; `form_item_validations` minimal-inert with
open `rule_type text`; ARCHITECTURE §2 reconciled (item types 10→15, option/version cols,
`visible_when` authorable-vs-evaluator split); ADR 0045/0046 headers already accepted
(no-op). `docs/backend-state.md` F3 surface + migration table reconciled; types regen'd
(+288, new tables/cols present). PROGRESS.md reflects reality.

---

## 5. INFO — forward-notes (non-blocking)

- **INFO-1 · `clone_form_version` does not yet copy the version-scoped inert definition
  tables** (`form_matrix_rows`/`form_matrix_columns`, `form_item_validations`), which carry
  `form_version_id` and whose comments describe them as "cloned/frozen with the version."
  This is **vacuously correct in F3** (all write-inert/empty — nothing to clone) but is a
  latent Rule-5 gap: **FF-2/FF-3 must extend `clone_form_version` to copy these when they
  add their writers**, or editing a published version silently drops its matrix/validation
  definitions. F3's deliberate re-creation of the clone (to carry `behavior_config` + the
  option cols) shows the carry-on-clone concern is understood; call this out so FF-2/FF-3
  don't miss it.
- **INFO-2 · `answer_references` PHI-read audit at FF-5 activation.** A reference may resolve
  to a Class-1 patient participant (PHI) or Class-2 professional. Inert in F3 (no reader ⇒
  Rule 11/12 not engaged), but the current answer-table-default SELECT policy
  (creator/admin/staff-admin) is **not** a PHI single door. When FF-5 builds the reference
  reader it must decide whether reads of a patient-participant reference require
  audited-single-door / PHI-read logging. Partly flagged already (the `on delete restrict`
  disposal note, `…000100` L126).
- **INFO-3 · Golden-vector cross-file parity is a manual discipline.** `20_conditions.sql`
  (inline) and `condition-vectors.json` must stay byte-for-byte identical for the parity
  guarantee to hold; both are currently identical + green, but no automated check diffs the
  two sources, so a future one-file-only edit could weaken the cross-evaluator guarantee
  without failing either suite. Pre-existing convention (predates F3); a tiny
  "vectors identical" assertion would harden it.
- **INFO-4 · `answer_matrix_cells` cross-item coherence deferred.** That a cell's
  `row_id`/`col_id` belong to the answer's own item is left to the FF-2 writer/trigger (the
  `reject_invalid_selection` precedent), correctly noted in-code (`…000100` L83-88); no
  enforcement now because the table is write-inert.

---

## 6. Verification performed
- Read all three F3 migrations, `209_flexible_forms.sql`, both evaluators, the design doc,
  both vector fixtures + SQL test diff, the 3 `OP_LABELS` diffs, ARCHITECTURE §2 +
  backend-state diffs, PROGRESS F3 section; diffed `clone_form_version` vs the prior authority.
- **Live (running local DB, non-destructive):** direct `app.eval_condition` parity
  spot-check (9 trickiest vectors, all match); `is_valid_visibility` authorability check
  (new ops rejected, `equals` accepted); `has_table_privilege`/`pg_policies`/`relrowsecurity`
  matrix on all six inert tables (write-inert confirmed); `pg_get_constraintdef` on the two
  widened `item_type` constraints + position-uniqueness + `behavior_config` +
  `answer_references` shape.
- **Independent re-run:** Vitest `conditions.test.ts` **81/81** (TS side of the parity lock).
- Relied on the reported green build for the full ordered pgTAP suite (2023, incl. `209`
  38/38) and the tester's E2E GREEN verdict; the SQL pgTAP suite was **audited statically +
  spot-checked live**, not re-executed end-to-end here.

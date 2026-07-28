# 0090 — FF-3 Validation Engine: rule vocabulary, coverage, enforcement topology, `required_if`

**Date:** 2026-07-28 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Phase:** FF-3, the third of the five feature phases ADR
[0086](0086-flexible-forms-pre-pilot.md) pulled pre-pilot. **Flag:** `item_validations` (seeded
OFF; flipped by its own enable migration at the FF-3 gate).
**Implements:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-3.
**Builds on:** ADR [0060](0060-flexible-forms-foundation.md) (F3 substrate) · ADR
[0087](0087-ff1-repeating-groups.md) (FF-1 instance engine + the dispatch refactor) · ADR
[0089](0089-ff2-matrix-risk-matrix.md) (FF-2 — `app.item_required_satisfied`, the shared deep-copy
helper, and the **door-parity rule** this phase inherits) · ADR
[0065](0065-pre-pilot-foundations-conventions.md) (conventions) · ADR
[0079](0079-authz-door-blindness-standing-invariant.md) (keystone discipline).

## Context

F3 froze `form_item_validations` on 2026-07-12 and nothing has written to it since. A
live-catalog audit at phase start — **216/216 migrations registered**, max version
`20260830001500` matching the last file on disk; read from `pg_proc` / `pg_policies` /
`pg_constraint`, never from migration text (CLAUDE.md §graphify exception) — establishes the
substrate below and corrects the plan on one point (§Substrate, ruling 1).

The three questions the plan left to the PO were settled in the 2026-07-28 interview. Each
changes the writer signatures and the completeness authority, not just the UI.

## Substrate (live catalog, 2026-07-28)

`form_item_validations` — `id`, `item_id → form_items`, `form_version_id → form_versions`,
`position int not null default 0`, `rule_type text not null` (**unconstrained beyond
not-blank**), `config jsonb` (object-or-null CHECK), `severity text not null default 'error'`
(`error|warn` CHECK), `message text`, `created_at`. One policy only:
`form_item_validations_select` = `is_member_of(commission_of_version) OR
is_commission_admin_of(commission_of_version)`.

Predicates and helpers FF-3 composes over, all `app`-schema and all shipped:

- `app.response_required_complete(uuid)` — the dispatch (FF-1), with a **flat arm** (top-level +
  plain-`group` children) and a **group arm** (per repeating group: `minInstances` over non-empty
  instances, then per-instance children).
- `app.item_required_satisfied(response, item, item_type, instance)` — FF-2's single
  required-presence predicate for every item type platform-wide.
- `app.instance_answer_map(response, instance)` / `app.overlay_answer_map(base, overlay)` —
  FF-1's instance-aware resolution (top-level ⊕ instance, instance wins, an unanswered sibling
  stays **absent**).
- `app.eval_condition(visible_when, answers)` / `app.eval_visibility(rule, answers)` — the
  evaluator, `prosecdef = false`.
- `app.is_valid_condition(jsonb)` — the **authorability** gate, currently allowing
  `equals, not_equals, in, gt, gte, lt, lte`.
- `app.copy_version_children(source, target)` — FF-2's extracted deep-copy helper, called by
  `clone_form_version`.
- `app.item_cardinality(config, key)` — FF-1's cardinality reader.

Two facts that shape the rulings:

1. **`form_items` has no `required_if` column.** FF-3 adds it.
2. **Group cardinality is already shipped.** `minInstances` is enforced in
   `response_required_complete`'s group arm; `maxInstances` is enforced in
   `add_group_instance` (the only `prosrc` in the catalog mentioning it). Both read
   `form_items.config` via `app.item_cardinality`. The plan's candidate list names "group
   cardinality" as an FF-3 `rule_type` — **it is not one**, see ruling 1.

## Decision

### 1. Rule vocabulary v1 is **six** rule types, pinned by an allowlist

The PO chose "the plan's 7". Six of them are new; the seventh — group cardinality — is
**already live from FF-1** and re-implementing it as a `rule_type` would create a second source
of truth for the same bound, with two ways to disagree. FF-3 therefore ships:

| `rule_type` | applies to | `config` | semantics |
|---|---|---|---|
| `number_range` | `number` | `{min?: number, max?: number}` | inclusive; at least one bound required |
| `text_length` | `short_text`, `free_text` | `{min?: int, max?: int}` | `char_length`, inclusive |
| `regex` | `short_text`, `free_text` | `{pattern: string, caseInsensitive?: bool}` | POSIX `~` / `~*`; pattern ≤ 200 chars |
| `date_range` | `date`, `time` | `{min?: string, max?: string}` | ISO literal bounds, inclusive |
| `datetime_order` | `date`, `time` | `{op: 'before'\|'after'\|'not_before'\|'not_after', question_key: string}` | compares to a sibling **resolved through the instance-aware map** |
| `unique_within_group` | any scalar child of a `repeating_group` | `{}` | the child's value is distinct across all **non-empty** instances of its group |

`rule_type` gets an **allowlist CHECK**, matching how every other vocabulary in this schema is
pinned (`severity`, `item_type`). Unknown rule types become unstorable rather than silently
inert — the F3 free-text column is the exact shape that lets a typo evaluate to "no rule".

`datetime_order` is the **only** cross-field rule. A general compare-any-two-keys rule was
rejected: it is a second expression language beside `eval_condition`, with its own parity
surface and its own deadlock matrix, on the phase whose test space the program plan already
flags as the largest (risk 2).

*Consequence to record:* `regex` accepts an author-supplied pattern, evaluated by Postgres at
submit and by JS in the wizard. Both are ReDoS-capable. The pattern length cap plus
`statement_timeout` bound it, and the author is a `staff_admin` acting inside their own
commission, so the blast radius is their own fillers — accepted, not eliminated.

### 2. Coverage v1 — scalars and repeating-group children, per instance

Rules attach to **flat scalar items** and to **scalar children of a repeating group**, evaluated
once per non-empty instance against `app.instance_answer_map`. Containers (`group`,
`repeating_group`), display items (`section_text`, `image`), `matrix`, `risk_matrix` and
`reference` **cannot carry rules** — enforced by the writer and by a CHECK-backed
`item_type` allowlist derived from the table above.

Matrix cells stay out of v1 deliberately: FF-2 already gave matrices their own row-complete
required semantics (`item_required_satisfied`), so nothing is stranded, and a cell-shaped arm
would double the deadlock matrix in both evaluators.

### 3. Enforcement topology — `error` blocks **submit only**, server-side

- `severity = 'error'` is enforced in **`submit_response`** (the Rule 3 authority) and raises
  `HC0P9`. `warn` never blocks, anywhere.
- **`save_section_answers` never rejects on a validation rule.** A draft must always be
  saveable and resumable mid-edit; a partially-typed value that fails to persist on navigation
  would break the wizard's resume contract (Rule 3).
- The wizard renders inline feedback from the **TS twin**, live. This is UX, not the boundary —
  the server is the authority (Rule 1), and a client that skips validation still cannot submit.
- **Error-surface contract:** a new read path
  `public.get_response_validation_errors(p_response_id uuid)` returns the set
  `(item_id, group_instance_id, rule_id, rule_type, severity, message)` so the wizard can place
  each message on the right field **in the right instance**. `submit_response` calls the same
  underlying `app` predicate, so the list the user sees and the gate that blocks them cannot
  disagree.

### 4. `required_if` — a new column, composed over the dispatch, **visibility wins**

Add `form_items.required_if jsonb` (nullable), validated by `app.is_valid_condition` and
extended into `form_items_input_vs_display` so containers and display items cannot carry one.

An item is required when `required = true` **OR** `required_if` evaluates true against the map
in scope — top-level for the flat arm, `instance_answer_map` for the group arm, so per-instance
`required_if` works by construction (ADR 0086 ruling 8).

**Visibility wins, unconditionally.** A hidden item is never required, whatever `required_if`
says. Both arms of `response_required_complete` already apply `eval_visibility` before the
required test; `required_if` composes *after* that filter, never around it. This is the
deadlock-negative property, and it gets keystones in both arms.

### 5. Operator authorability — widen `is_valid_condition` to the four F3 operators

`eval_condition` already implements `contains`, `not_contains`, `is_empty`, `is_not_empty`;
`is_valid_condition` refuses to store them. FF-3 widens the gate and adds the pickers to
`condition-builder.tsx`. Stored published conditions are unaffected — this only widens what is
**authorable**. `is_empty` / `is_not_empty` take no `value`, so the gate's `p ? 'value'`
requirement is relaxed for exactly those two.

### 6. Door parity is discharged as a **table**, not an assertion

FF-2 handed this phase two obligations and both come due the moment a writer exists. Against
the live catalog, `form_item_validations` today carries **one** policy where its siblings carry
three. FF-3 lands the missing arms:

| policy shape | `form_item_options` | `form_matrix_rows`/`_columns` | `form_item_validations` (today) | FF-3 |
|---|---|---|---|---|
| base member/admin SELECT | ✅ | ✅ | ✅ | keep |
| `can_access_targeted_version` SELECT | ✅ (own policy) | ✅ (OR-arm) | ❌ **missing** | **add** |
| `staff_admin` FOR-ALL write | ✅ | ❌ **none** — see correction | ❌ **missing** | **add** |

> **Correction (2026-07-28, verified against `pg_policies` during the build).** This table as
> first written claimed the matrix axis tables carry a `staff_admin` FOR-ALL write policy "via
> writer + policy". **They do not** — `form_item_options` is the only one of the three siblings
> with a write policy; the matrix tables' boundary is a SELECT-only grant plus the DEFINER door.
> FF-3 added **both** arms as the table directs, but deliberately kept the **stricter grant
> posture** of the matrix tables (`authenticated` holds `r` only, so direct DML is denied at the
> grant, not merely at the policy). `form_item_options`, by contrast, grants `authenticated`
> full `arwdDxtm`. Keystone `C5` pins both facts. This is the door-parity rule working as
> intended: the parity table is checked against the catalog, and where the siblings disagree the
> tighter posture wins.

The writer `set_item_validations` lands as a **DEFINER door** (K9: direct DML stays denied), and
`app.copy_version_children` gains a `form_item_validations` block **in the same migration wave**
— the Rule 5 clone gap opens the instant the definition table has rows (INFO-1 remainder).

## Consequences

- `app.response_required_complete` gains a `required_if` predicate layer in **both** arms; every
  prior arm's pgTAP is re-run (the plan's §2 serialization).
- A second dual-evaluator pair (`app.eval_validation` + its TS twin) joins `eval_condition` under
  the Rule 3 mirror discipline. Golden vectors are **phase-blocking**.
- `form_item_validations` becomes clone-copied, correction-visible and targeted-readable —
  discharging the FF-2 hand-forward and INFO-1's remainder.
- FF-5 inherits the same two obligations for `answer_references`, unchanged.
- Migration window `20260901000000`+. SQLSTATEs allocate from **`HC0P9`** (live high-water is
  `HC0P8`). pgTAP files **274+** (highest today is `273`).

## Gate keystones (all mutation-proven — revert the guard, the keystone must go red)

1. `validation_parity_vectors` — SQL↔TS golden over all six rule types × value shapes.
2. `submit_blocked_error_not_warn` — an `error` rule blocks `submit_response` (`HC0P9`); a `warn`
   rule with the identical violation does not.
3. `save_never_blocks_on_validation` — `save_section_answers` persists a value that violates an
   `error` rule (the resume contract).
4. `required_if_completeness` — true→blocks, false→passes, **hidden+required_if→never blocks**,
   and the per-instance arm, each proven in both arms of the dispatch.
5. `rls_validations_reader_non_writer` + `validations_door_parity` — direct DML denied; the
   parity table above asserted against `pg_policies`, not asserted in prose.
6. `clone_copies_validations` — publish → clone → validations deep-copied, source immutable
   (INFO-1 closed).
7. `operators_authorable` — the four F3 operators store and round-trip; `is_empty` stores without
   a `value`; a bogus operator is still refused.
8. `unique_within_group_instances` — a duplicate across two non-empty instances violates; the
   same value in an emptied instance does not.
9. E2E: author a rule → inline pt-BR message → submit gated → fix → submit passes; one
   keyboard-only flow.

## Amendment 1 — the legacy config-bound lane joins the error surface (2026-07-28)

**Lead-approved during the build, beyond this ADR's letter.** Ruling 3's error-surface contract
promises that the list the wizard shows and the gate that blocks the user cannot disagree. The
pre-existing `assert_item_bounds` lane — the `form_items.config` min/max bounds that predate
FF-3 — raises on submit but was *not* part of the new error surface, so a submit could be
refused while `get_response_validation_errors` returned an **empty list**: blocked, with nothing
shown. That breaks the contract in its worst direction.

FF-3 therefore folds that lane into the shared walker (migration `20260901000400`). Behaviour is
unchanged — same SQLSTATE, same messages, same order — and the pre-existing pgTAP over
`assert_item_bounds` is the net that proves it. Keystones `J1`/`J2` cover the lane; `J3` is green
under the same mutation, which is what proves `J1`/`J2` are the ones testing it.

## Open questions (deferred, not blocking)

- **O-1** — should a `warn` require acknowledgement before submit? v1: no, badge only.
- **O-2** — `regex` pattern linting in the builder (catastrophic-backtracking detection) is a
  builder affordance, not a boundary; deferred.
- **O-3** — cross-instance rules other than `unique_within_group` (e.g. "sum of a child across
  instances ≤ N") are out of v1; they are closer to `form_calculations`, which ADR 0086 ruling 6
  keeps post-pilot.

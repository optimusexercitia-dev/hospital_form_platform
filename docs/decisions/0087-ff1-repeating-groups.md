# 0087 — FF-1 Repeating Groups: instance engine, condition scoping, required semantics

**Date:** 2026-07-27 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Phase:** FF-1, the first of the five feature phases ADR
[0086](0086-flexible-forms-pre-pilot.md) pulled pre-pilot. **Flag:** `repeating_groups` (seeded
OFF; flipped by its own enable migration at the FF-1 gate).
**Implements:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-1.
**Builds on:** ADR [0060](0060-flexible-forms-foundation.md) (F3 substrate) · ADR
[0065](0065-pre-pilot-foundations-conventions.md) (conventions) · ADR
[0079](0079-authz-door-blindness-standing-invariant.md) (keystone discipline) · the ratified
[question_key aggregation contract](../design/f3-question-key-aggregation.md).

## Context

F3 shipped the bones (2026-07-12): `response_group_instances`, `answers.group_instance_id`,
`form_items.parent_item_id`, the widened `item_type` CHECK admitting `group` / `repeating_group`,
and both partial unique indexes on `answers`. Nothing in the application uses any of it —
`parentItemId` is carried into the domain type in `src/lib/queries/forms.ts` and read by nothing
else. FF-1 is greenfield above a substrate that is more complete than the program plan records.

A live-catalog audit at phase start (188/188 migrations registered; `pg_proc` / `pg_policies` /
ACLs, never migration text — CLAUDE.md §graphify exception) found **six** places where the plan's
prose does not match the shipped database. Those corrections are §Substrate below; two of them
change what FF-1 builds, and one reverses a gate keystone. Recording them here is the point:
the plan's §3 FF-1 text should be read through this ADR, not the other way round.

## Decision

Six PO rulings (2026-07-27 grilling interview):

### 1. Nesting is capped at depth 1, enforced in the schema

A `group` or `repeating_group` may not contain another container. The cap is a database
constraint, not a builder convention, so it holds against the RPCs, seeds, fixtures, and FF-4's
future `insert_block_from_library`.

*Why:* the substrate supports nesting (`parent_instance_id` self-FK; positions already scoped per
parent instance by `UNIQUE NULLS NOT DISTINCT (response_id, group_item_id, parent_instance_id,
position)`), so this is scope, not capability. Nesting would take the instance map from 2 tiers to
an N-tier ancestor chain — combinatorial growth in a golden-vector matrix that is phase-blocking
under Rule 3 — plus recursive completeness and a nested wizard tree, on what the program plan
already calls the fattest phase (§7 risk 1). Un-capping later is a constraint drop plus additive
vectors: no migration to the instance table, no change to the aggregation contract.

### 2. Condition scoping — inside-out resolves, outside-in is forbidden at publish

**Inside-out (permitted).** Evaluating an item inside instance *I*, the answer map is top-level
answers overlaid with instance-*I* answers: a same-instance sibling wins; if *I* has not answered
that key, it is **absent**. No fallback to another instance, ever. Two tiers, deterministic.

**Outside-in (rejected).** A condition on an item outside a repeating group may not reference a
`question_key` belonging to a child of that repeating group. Enforced in
`public.validate_visible_when` (the publish-time gate called by `publish_form_version` — it is
already structure-aware and raises pt-BR `check_violation`s), alongside the existing "pergunta
anterior" rules.

*Why:* with N instances there is no single value, and every candidate — any/all/first/absent — is
defensible and surprising in a different way. Decisively, **forbidding is the reversible
direction**: relaxing later is a validator change plus additive vectors, whereas shipping
existential semantics and later restricting them would break published, immutable versions
(Rule 5). Back-compat cost today is zero — no form in existence contains a group. FF-3's
`required_if` inherits the boundary for free.

The boundary is the **repeating** group specifically. A plain `group`'s children store answers at
top level (ruling 6), so their keys are unambiguous and remain legal condition targets.

### 3. A fully-empty instance is not incomplete — it is not there

Completeness skips instances with zero answers. `submit_response` **prunes** them before
evaluating, so submitted data carries no phantom rows. `min_instances` is enforced **after**
pruning. Emptiness reuses the exact test `app.response_required_complete` already applies: no
`answers` row with a non-null, non-`'null'::jsonb` value and no `answer_selected_options` row.

*Why:* strict enforcement produces the worst available error state — submit blocked by "campo
obrigatório" pointing into a blank row the user never meant to create, whose actual fix (remove
the row) is not what the message says. Pruning first also upgrades the message to an accurate
"adicione ao menos N", and keeps phantom rows out of FF-1's explode-by-child-key aggregation,
where each one would become an empty row in every dashboard built on that form. There is no data
loss: an empty instance has no data.

Settled by precedent, not contested: a hidden group requires nothing (visibility wins —
`app.response_required_complete` already does this for sections and items); unmet `min_instances`
on a visible group blocks; a filled instance with a blank required child blocks.

### 4. FF-1 drops `form_items_conditional_not_required` globally

The CHECK `(visible_when IS NULL OR required = false)` forbids any item being both conditionally
visible and required, platform-wide. FF-1 drops it — for all items, not only group children.

*Why:* `app.response_required_complete` **already contains** the branch that handles it ("A
per-item visibility condition can hide a required item; honour it"), and that branch is currently
**unreachable dead code** because the CHECK makes the combination unconstructible — it has never
been proven to work. FF-1 must prove exactly that path for group children regardless ("se tipo =
medicação, nome do medicamento é obrigatório" is the ordinary authoring case). Proving it only for
children would ship a builder that offers *obrigatório* beside a condition in one place and
refuses it in another, for no reason an author could infer.

This is a **widening**, so per ADR 0079 it lands with deadlock-negative keystones that are
**mutation-proven**: restore the CHECK, or break visibility-wins, and the keystone must go red.
A keystone that cannot fail is not a keystone.

Distinct from FF-3's `required_if`, which stays FF-3's: that is a separate rule object ("required
when condition C") whose deadlock space (`required_if` × per-instance × warn/error) is what
program-plan §7 risk 2 budgets for.

### 5. Instance writers are INVOKER RPCs — correctness doors, not security doors

`add_group_instance` / `remove_group_instance` / `reorder_group_instances` ship as **INVOKER**
functions mirroring `save_section_answers`. Grants and the existing `FOR ALL` own-draft policy on
`response_group_instances` stay untouched. **RLS remains the security boundary (Rule 1).**

*Why:* the program plan's "all writers are DEFINER doors by construction" is a **K9 §C rule about
the six write-inert tables** (`answer_matrix_cells`, `answer_risk_matrix`, `answer_references`,
`form_matrix_rows`, `form_matrix_columns`, `form_item_validations` — all `authenticated=r`). It was
never the fill path's rule. The fill path is deliberately the opposite: `answers` carries
`authenticated=arwdDxtm` under RLS, `save_section_answers` is INVOKER, and there is **no
per-answer audit trigger** — Rule 11 is satisfied for filling at the *response* level via
`audit_responses_trg`. `response_group_instances` was built to match that convention exactly
(direct DML, own-draft `FOR ALL`, `guard_submitted_group_instances_trg` for post-submit
immutability). DEFINER-gating the container while its contents stay direct-DML locks the box and
leaves the lid off.

The ADR-0079 reader-non-writer test does not bite here either: the `FOR ALL` qual
(`created_by = auth.uid() AND status = 'in_progress'`) is strictly **narrower** than the SELECT
qual, so it over-grants neither reads nor writes. The plan's
`rls_group_instances_reader_non_writer` keystone is therefore recorded **not-applicable, with this
reasoning**, and replaced by the keystones that do bite (§Gate).

The RPCs exist for **atomicity**: the unique constraint is non-deferrable, so a client reorder
rewriting positions 0,1,2 → 1,0,2 collides mid-statement; `add` needs `max(position)+1` atomically
together with `max_instances` enforcement.

**Follow-up (post-pilot, tracked):** revisit DEFINER + per-mutation audit for the **whole** fill
path — `answers`, `answer_selected_options`, `response_group_instances` together — as one coherent
change, rather than hardening one table piecemeal.

### 6. Both container types ship; `group` is a pure visual container

`repeating_group` gets the instance engine. A plain `group` is a nested sub-section: **no instance
rows**, children store answers top-level (`group_instance_id IS NULL`), the instance-aware map
never engages. Cost beyond builder/wizard rendering is near zero.

*Why:* `form_sections` already provides top-level grouping, so `group` is the sub-section
affordance and nothing more. It also sharpens rulings 1 and 2 — the depth cap reads uniformly as
"no container inside a container", and the condition boundary is precisely the *repeating* group.

## Substrate — six corrections to the program plan (live catalog, 2026-07-27)

1. **`behavior_config` is on `form_versions`, not `form_items`.** Per-item configuration lives in
   **`form_items.config`** (jsonb, guarded by `form_items_config_shape`). `min_instances` /
   `max_instances` go there. The plan's FF-1 and FF-5 text names the wrong column.
2. **`response_group_instances` is not write-inert.** ACL `authenticated=arwdDxtm` plus a `FOR ALL`
   own-draft policy. The K9 "direct DML denied" keystone covers the **six** read-only tables; this
   is a seventh, deliberately writable. Drives ruling 5.
3. **A second CHECK blocks conditional+required.** `form_items_conditional_not_required` is
   independent of `form_items_input_vs_display` and unmentioned in the plan. Drives ruling 4.
4. **`form_items.section_id` is NOT NULL for group children.** They already sit in
   `app.response_required_complete`'s section-level scan, inert only because the CHECK forces
   `required = false`. The dispatch-by-`item_type` refactor must therefore scope the flat arm —
   see Amendment 1 for the correct predicate.
5. **`app.answer_map` collides across instances.** It aggregates by `question_key` alone;
   `jsonb_object_agg` silently last-wins for scalars, and the `group by question_key` CTEs merge
   checkbox codes from different instances into one array. This is the concrete defect ruling 2's
   overlay map fixes.
6. **`save_section_answers` has no instance arm.** It mentions `group_instance_id` only as
   hardcoded `null` literals with `on conflict … where group_instance_id is null`. Latent bug to
   fix in the same pass: **`p_clear_item_ids` deletes by `item_id` unscoped by instance**, so the
   first clear wipes that item across every instance.

Also confirmed, and *not* work FF-1 needs: both partial unique indexes already exist
(`answers_uq_top`, `answers_uq_inst`) — the instance arm uses
`on conflict (response_id, item_id, group_instance_id) where group_instance_id is not null`.

**Implementation notes (not PO rulings).** `form_items.position` is `UNIQUE (section_id, position)`
— section-scoped, not parent-scoped — so `validate_visible_when`'s ordinal "earlier question"
comparison keeps working, but children must sit **contiguously immediately after their parent** in
that flat space; FF-1 enforces this. `app.is_valid_condition` admits only 7 operators
(`equals, not_equals, in, gt, gte, lt, lte`) — the 4 F3 operators stay unauthorable until FF-3, as
planned. SQLSTATE high-water — see Amendment 1.

## Amendment 1 (2026-07-27, same day) — three corrections found at plan review

Recorded rather than silently edited, because this ADR was already committed and referenced.

1. **SQLSTATE allocation was wrong.** This ADR said high-water `HC098` → allocate `HC099+`.
   The live high-water is **`HC0M9`**: the `HC09x` digit lane was exhausted and the convention moved
   to letter lanes `HC0A0…HC0M9` (`L` skipped). `HC099` is unused but *below* the water line and
   off-convention. **FF-1 allocates `HC0N0`+.** Root cause worth keeping: the phase-start probe used
   the regex `HC([0-9]{3})`, which was **structurally incapable** of matching a letter-lane code —
   it could only ever have confirmed the answer it found. `docs/backend-state.md` records `HC098`
   for the same reason and should be corrected at the Record step.
2. **Substrate correction 4's predicate was too broad.** Ruling 6 makes a plain `group`'s children
   *top-level*, so excluding all of `parent_item_id IS NOT NULL` from the flat completeness arm
   would stop enforcing `required` on plain-`group` children entirely — a silent under-enforcement
   no keystone in §Gate would have caught. The correct predicate is **"has no `repeating_group`
   ancestor"**, which under the depth-1 cap (ruling 1) is
   `parent_item_id IS NULL OR parent.item_type = 'group'`. Gate gains
   `plain_group_child_required_blocks`.
3. **Two latent bugs FF-1 activates**, absent from the original text. `start_correction_draft` and
   `supersede_response` copy `answers.group_instance_id` **verbatim** from the predecessor and never
   copy `response_group_instances` — so a corrected response's answers would point at the
   predecessor's instances, which are frozen by `guard_submitted_group_instances_trg` and
   cascade-deleted with the predecessor. Inert today (zero instance rows), phase-blocking the moment
   the instance RPCs ship. Separately, `app.assert_item_bounds` selects by `(response_id, item_id)`
   unscoped, so with instances it bounds-checks one arbitrary instance. Both are FF-1's to fix;
   Gate gains `correction_copies_group_instances`.

Also confirmed at plan review: `response_group_instances`'s column is **`group_item_id`** (the
ARCHITECTURE.md §2 line naming it `item_id` is stale) · `form_items_section_id_position_key` is
already **DEFERRABLE**, the precedent FF-1 reuses for collision-free reorder ·
`submit_response` **inlines its own completeness check** rather than calling
`app.response_required_complete`, so the two authorities must be refactored together and their
agreement is itself a keystone.

## Gate keystones (all mutation-proven — revert the guard, the keystone must go red)

- `nesting_depth_capped` — a container inside a container is rejected by the database.
- `condition_outside_in_rejected` — publish fails, in pt-BR, when a top-level condition targets a
  repeating-group child; the plain-`group` equivalent still publishes.
- `condition_parity_vectors_instances` — SQL ↔ TS golden parity on the instance dimension,
  including same-instance-wins and sibling-absent.
- `completeness_deadlock_negative_groups` — a hidden group with required children never blocks;
  unmet `min_instances` on a visible group does.
- `empty_instance_pruned_at_submit` — a zero-answer instance is gone after submit;
  `min_instances` is evaluated on what remains.
- `conditional_required_honoured` — a required item hidden by its condition does not block
  (the branch ruling 4 un-deadens), at top level **and** per-instance.
- `group_instances_post_submit_immutable` + `group_instances_cross_user_denied` — replacing the
  not-applicable `reader_non_writer` keystone.
- `plain_group_child_required_blocks` — a required child of a *plain* `group` still blocks
  (guards Amendment 1.2's under-enforcement).
- `correction_copies_group_instances` — a correction draft gets its **own** instance rows, with the
  copied answers remapped to them (guards Amendment 1.3).
- `completeness_authorities_agree` — `submit_response`'s inlined check and
  `app.response_required_complete` reach the same verdict; they are separate implementations today.
- `supersession_group_answers_excluded` — the explode read predicate is supersession-tolerant.
- E2E: wizard instance add/remove/reorder → resume → submit → explode aggregation, plus one
  keyboard-only pass over the instance controls.

## Consequences

- FF-1 is wider than the plan's §3 by ruling 4 (a global CHECK drop) and narrower by ruling 1
  (no nesting). Net scope is close to as-budgeted; the riskiest surface remains the evaluator.
- The plan's `rls_group_instances_reader_non_writer` gate keystone is **retired** as
  not-applicable; §Gate above supersedes program-plan §3 FF-1's keystone list.
- Program-plan §3 FF-1 / FF-5 references to `behavior_config` should be read as `form_items.config`.
- One tracked post-pilot follow-up: coherent fill-path hardening (ruling 5).
- No change to the Phase Gate, to Rules 1–12, or to the ratified aggregation contract —
  `group_instance_id` stays out of the aggregation key; instances explode by child `question_key`.

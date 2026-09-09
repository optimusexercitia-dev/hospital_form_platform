# Backend State — forms, items and responses

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **The canonical spine** (Architecture Rule 2) — `forms` → `form_versions` (`status ∈ draft |
  published | archived`, plus the reserved per-version bag `behavior_config`) → `form_sections`
  (`position`, `visible_when`, `requires_signoff`, `signoff_role ∈ respondent | staff_admin`) →
  `form_items` (`item_type`; input items carry `question_key`, `label`, `required`, display items
  `content`) · `form_item_options` · `responses` · `answers` · `answer_selected_options` ·
  `response_group_instances` · `response_section_signoffs`.
- **Matrix** — `form_matrix_rows` / `form_matrix_columns` (per item, per version; `code`, `label`,
  `weight`) + `answer_matrix_cells` / `answer_risk_matrix`. `matrix` is a radio grid — one column per
  row, `value='true'`, no payload; `risk_matrix` derives `risk_score` server-side as
  `severity.weight * likelihood.weight`, and a client-sent score is never read.
- **Entity reference** — `answer_references` in three lanes (participant / commission / profile), all
  three target FKs `on delete restrict`, a kind↔target XOR CHECK, `unique (answer_id)`.
- **Validation** — `form_item_validations` over six allowlisted rule types (`number_range`,
  `text_length`, `regex`, `date_range`, `datetime_order`, `unique_within_group`) + `required_if` on
  `form_items`: a **single** condition, not the `{match, conditions[]}` group shape `visible_when` takes.
- **Power authoring** — `form_block_library` (commission-scoped jsonb snapshot of one item subtree,
  denormalized provenance, **no FK**) + `form_items.default_source`, XOR'd against `default_value`.
- **Doors** — signatures, `prosecdef`, volatility, EXECUTE grants:
  [`generated-rpc-surface.md`](generated-rpc-surface.md) · [`generated-helper-surface.md`](generated-helper-surface.md);
  the module owning a query (Rule 9): [`generated-query-modules.md`](generated-query-modules.md).

### Invariants

- **Rule 2 — extend, never contradict.** `form_items.item_type` stays a **CHECK enum widened per
  feature**, never a data-driven catalog, and both constraints move together: the value enum and the
  shape CHECK `form_items_input_vs_display`.
- **Rule 3 — one draft, one door.** `unique (form_version_id, created_by) where status =
  'in_progress'` gives one resumable draft per user per version, editable only by `created_by`.
  `submit_response` is the sole lifecycle door: it evaluates section visibility server-side, verifies
  every required input of every VISIBLE section and a sign-off row on every visible
  `requires_signoff` section, deletes stray answers of finally-hidden sections, flips
  `status → submitted`. Wizard validation is UX only; the RPC is the authority.
- **Rule 3 — the condition evaluator exists exactly once per side**, `app.eval_condition` ↔
  `evalCondition` (`src/lib/queries/conditions.ts`), held in agreement by a shared golden-vector
  fixture; drift is phase-blocking. `contains`/`not_contains`/`is_empty`/`is_not_empty` stayed
  evaluator-only until the storage gate **and both publish assertions** were widened in one change.
- **Rule 4 — a sign-off is per `(response, section)`**, `unique (response_id, section_id)`;
  `signoff_role` decides who signs — `respondent` (the response's `created_by`) or `staff_admin`
  (any `staff_admin` of the commission) — and RLS, not the UI, enforces it. The window is while the
  response is `in_progress` **and the section is visible**. ⚠ One carve-out: a `staff_admin` section
  of a CASE-PHASE response is signed AFTER the response freezes, in the single window
  `app.is_signoff_deferral_open` defines for `app.can_sign_section` (the `signoffs_insert`
  `WITH CHECK`), `guard_submitted_signoffs` and `sign_section`. A STANDALONE response keeps the
  `in_progress`-only rule; `responses.status` is unchanged — attestation lives on the PHASE.
- **Rule 5 — a published version is IMMUTABLE**, enforced in the database on `form_versions`, their
  `form_sections` AND their `form_items`, not only in the UI. Editing never mutates: cloning creates
  a new draft and copies sections (with their conditions and sign-off settings) and items, remapping
  ids, and `visible_when` references `question_key` rather than an item id **precisely so conditions
  survive cloning unchanged**. `clone_form_version` stays INVOKER — its RLS-gated `form_versions`
  INSERT is the authority proof — and delegates to `app.copy_version_children`, whose insert list
  **is** the authoritative child enumeration.
- **`question_key` is stable by construction** — no rename door exists anywhere in the platform and
  none ever has: the editor pins the key, a new item mints `slug(label)` plus a random suffix. That
  is what lets a dashboard aggregate one question across versions; matrix series key on the axis
  `code`, held immutable by a `BEFORE UPDATE` trigger that does not consult version status.
- **One arm, one place.** `app.item_required_satisfied` is the single required-presence predicate for
  every item type and `app.copy_response_answers` the single correction-copy surface; a new answerable
  shape owes an arm to each, plus one to `app.instance_is_empty` — without which `submit_response`
  prunes an instance holding only that shape and cascades it away.

### Rollout

- Flags `matrix_fields`, `entity_refs`, `item_validations`, `power_authoring`,
  `deferred_staff_signoff`. ⛔ Resolve each flag's VALUE and its readers from
  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the
  remote is a claim about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- The matrix definition tables carry **no published-structure freeze trigger** — the Rule 5 guard
  `form_item_options` already had and that was reused to give `form_item_validations` the same freeze.
- `form_items_default_source_type_check` is **tighter** than the shipped
  `form_items_default_value_display_null`, which still permits a `default_value` on a matrix nothing
  can apply; narrowing a shipped CHECK against existing rows is its own migration.
- `answer_references` holds one target per item (multi-target is a constraint DROP; writer,
  completeness arm and aggregation are already cardinality-agnostic); `form_block_library` is
  commission-visible only, an org-visible arm being additive and deferred; `form_calculations` stays
  reserved, not built; `app.pending_staff_signoffs` is **UNSUPPORTED** by the row-door sweep.

### Where the detail lives

- The frozen slices below, in order: **§ F3 — Flexible-Forms Foundation** · **§ FF-2 — Matrix & Risk
  Matrix** (which also carries the DOOR-PARITY RULE and the policy-arms diff table) · **§ FF-5 —
  Entity Reference** · **§ FF-3 — Validation Engine** · **§ FF-4 — Power Authoring** · **§ DSS —
  Deferred `staff_admin` sign-off**.
- ADR [0060](../decisions/0060-flexible-forms-foundation.md) · [0065](../decisions/0065-pre-pilot-foundations-conventions.md) · [0086](../decisions/0086-flexible-forms-pre-pilot.md)
  · [0087](../decisions/0087-ff1-repeating-groups.md) · [0089](../decisions/0089-ff2-matrix-risk-matrix.md) · [0090](../decisions/0090-ff3-validation-engine.md)
  · [0091](../decisions/0091-ff5-entity-reference.md) · [0092](../decisions/0092-ff4-power-authoring.md) · [0045](../decisions/0045-answer-model-v2.md)
  · [0136](../decisions/0136-deferred-staff-admin-signoff-attests-frozen-content.md).

## F3 — Flexible-Forms Foundation (2026-07-11; ADR 0060/0065; migrations `20260718000000`–`…000200`; NO flag, structural)

The pre-pilot form-engine bones for the four committed field types + the one live feature (dual-evaluator
operators). **Structural, no feature flag** (D6/§6.3 metadata-catalog CANCELLED — `item_type` stays a
CHECK enum widened per feature, ADR 0065 §5). Reset-OK, forward-only, additive. **The FF-1…FF-5 feature
phases that activate these bones were re-sequenced PRE-pilot 2026-07-27 (ADR
[0086](../decisions/0086-flexible-forms-pre-pilot.md); order FF-1→FF-2→FF-3→FF-5→FF-4; all gate the pilot
deploy) — FF references below now mean pre-pilot phases.** **Local validation:** full
ordered `supabase test db` **78 files / 2023 PASS** (new `209_flexible_forms.sql` 38/38 + extended
`20_conditions.sql` operator×value_type matrix); tsc 0; Vitest `conditions.test.ts` 81/81 (golden
dual-evaluator parity). **Remote deploy DEFERRED to the pilot reset.**

- **`item_type` widened 10→15** — BOTH constraints: the value enum `form_items_item_type_check` AND the
  shape CHECK `form_items_input_vs_display` gain arms for `group`/`repeating_group` (containers:
  `content NULL`, `required=false`) and `matrix`/`risk_matrix`/`reference` (answerable: `question_key`+
  `label`, `content NULL`, **`required=false`** — the Flag-5 completeness invariant: their answers live in
  the F3 answer tables, not `answers.value`, so a `required` one would deadlock
  `app.response_required_complete`). Garbage still rejected (D6-flip `ELSE false`).
  WARNING - **SUPERSEDED:** `group`/`repeating_group` went live at FF-1 and `matrix`/`risk_matrix`
  at FF-2, which DROPPED their `required=false` pin (see the FF-2 section, ruling 3). **`reference`
  is the only one still inert and the only one still pinned**; FF-5 relaxes it.
- **Cheap columns** — `form_item_options.is_exclusive` (bool, default false) + `risk_weight` (numeric);
  `form_versions.behavior_config jsonb` (reserved staging bag, object|null; shape CHECK). No writer/UX yet.
  `clone_form_version` carries all three forward (Rule 5 / Flag 4).
- **Repeating-group** — `response_group_instances` gains position-uniqueness within a parent
  (`UNIQUE NULLS NOT DISTINCT (response_id, group_item_id, parent_instance_id, position)`); write RPCs → FF-1.
- **Frozen inert answer-shape set** (freeze principle, ADR 0065 §6; authored against
  `docs/design/f3-question-key-aggregation.md`): `form_matrix_rows`/`form_matrix_columns` (definition,
  version-scoped, clone-stable `code`) + `answer_matrix_cells`/`answer_risk_matrix`/`answer_references`
  (answer rows off `answer_id → answers`; disposing a case-phase answer auto-cleans them via FK cascade).
  `answer_references.participant_id → participants(id)` is the A/C bridge (`reference_kind='participant'`;
  FF-5 widens). Reserved `form_item_validations` (open `rule_type text`; FF-3). **All six RLS-from-creation:
  scoped `to authenticated` SELECT + matching GRANT (K9), NO write policy / NO write grant (write-inert;
  the DEFINER writer lands with each FF phase).** WARNING - **per-table status now lives in the FF-2
  section**: the four matrix tables are LIVE (K9 preserved - still SELECT-only, writers are DEFINER);
  `answer_references` (FF-5) and `form_item_validations` (FF-3) remain inert **and carry an inherited
  policy-arm obligation** recorded there. No `*_snapshot` cols (rely on published-version immutability).
- **THE one live feature — dual-evaluator operators** `contains`/`not_contains`/`is_empty`/`is_not_empty`
  in BOTH `app.eval_condition` (migration `…000200`, `CREATE OR REPLACE`, stays IMMUTABLE + `search_path`
  pinned) AND `evalCondition` (`src/lib/queries/conditions.ts`), golden-vector-locked (Rule 3, drift =
  phase-blocking). Semantics (ADR 0060 Rec D): `contains` = array-membership | text-substring, else false
  (no number→text coercion); `is_empty` = absent/null/`''`/`[]`, unary. **NOT authorable** — the storage
  validators (`assert_condition_op_target`/`is_valid_visibility`/`validate_visible_when`) + the builder
  picker (`CHOICE_OPS`/`ORDERED_OPS`/`AGGREGATE_OPS`) are UNTOUCHED; the ops are evaluator-only vocabulary.
  `visible_when` stays visibility-only. `OP_LABELS` in the 3 `Record<ConditionOp>` maps gained pt-BR labels
  (compile lock only, no picker change).
- **SQLSTATEs:** none new. ⚠ This line read "HC high-water stays **HC098**" until 2026-07-27; that
  was the high-water of the **digit lane only**. The live `pg_proc` high-water is **`HC0M9`** — the
  `HC09x` lane was exhausted and the convention moved to letter lanes `HC0A0`…`HC0M9` (`L` skipped).
  The probe that produced the stale figure used the regex `HC([0-9]{3})`, which was structurally
  incapable of matching a letter-lane code (ADR 0087 Amendment 1). **Resolve the high-water from the
  catalog, never from this file.** **No new RPCs / helpers / flags.**
- **Supersession forward-note:** `responses.supersedes_id` deliberately NOT added (additive-anytime,
  freeze principle §6); the post-pilot correction ADR adds it + the dashboard/derived-indicator
  aggregation-exclusion retrofit **atomically** (ARCHITECTURE §2 / ADR 0065 §8).

## FF-2 - Matrix & Risk Matrix (2026-07-27; ADR 0089; migrations `20260830000000`-`...001500`; flag `matrix_fields` **ON** via `...001200`)

Activates F3's matrix bones. **K9 preserved throughout**: all four matrix tables stay `authenticated`
SELECT-only; every write is a DEFINER RPC.

- **Schema** - `weight numeric` (nullable) on `form_matrix_rows`/`form_matrix_columns`; `UNIQUE
  (answer_id, row_id)` on `answer_matrix_cells` **alongside** the original triple-unique (kept so typed
  cells later = a constraint drop + a config key, no answer-table migration); `form_items_input_vs_display`
  relaxed so `matrix`/`risk_matrix` may be `required` (**`reference` still pinned** -> FF-5).
- **Triggers** - `app.guard_matrix_axis_code_immutable` (BEFORE UPDATE on both axis tables; **does not
  consult version status** - ruling 4, `HC0P0`) * `app.guard_matrix_cell_coherent` /
  `app.guard_risk_matrix_coherent` (row/col must belong to the answer's item, `HC0P1`) *
  `app.guard_submitted_selections` **reused** for both matrix answer tables (it was never
  selection-specific - it is answer_id-keyed submitted-immutability).
- **Rulings** - (1) radio grid: one column per row, `value='true'`, no payload; (2) `risk_score =
  severity.weight * likelihood.weight` **derived server-side**, a client-sent score is never read, bands
  are display-only in `config.riskBands`; (3) `required` = **row-complete**, in BOTH the flat and the
  per-instance loop; (4) axis `code` **immutable** - the cross-version aggregation key.
- **`app.item_required_satisfied(response, item, item_type, instance)`** - **the single
  required-presence predicate for EVERY item type platform-wide.** It replaced four inlined copies (flat +
  per-instance in `submit_response` AND in `app.response_required_complete`). *Any* new answerable type
  adds its arm HERE and nowhere else; a regression here silently breaks required-ness for scalar, choice,
  group-child and matrix at once. `app.instance_is_empty` likewise gained matrix arms - without them
  `submit_response` **prunes an instance holding only a matrix and cascades its cells away** (ADR 0089 A).
- **`app.copy_version_children(source, target)`** - the **extracted shared deep-copy helper**
  (sections * items * container remap * options * **matrix axes**). `clone_form_version` stays INVOKER
  (its RLS-gated `form_versions` INSERT is the authority proof) and delegates. **FF-3 (validations) and
  FF-4 (library insert) are queued behind this extraction - extend it, do not paste a fifth copy block.**
- **Correction copies** - `answer_matrix_cells` + `answer_risk_matrix` in **both** `supersede_response`
  and `start_correction_draft` (four blocks). Old->new resolves **through the instance rows** on the
  preserved `(group_item_id, position)`; matching `new.group_instance_id` to `old.` is unsatisfiable by
  construction (ADR 0087 Amdt 1.3) and fails **silently**. `risk_score` copied verbatim; ids need no remap
  (same `form_version_id`).
- **Reads** - `dashboard_matrix_cells` / `dashboard_risk_scores` (**DEFINER**, `is_staff_admin_of` OR
  `is_admin`, both built on `app.submitted_form_responses` so supersession-tolerance cannot drift).
  Aggregate through **`code`, never `row_id`/`col_id`** - ids are per-version; keying on them splits every
  series at each new version. `get_response_for_signoff` + `getSubmissionDetail` project the grids (a
  signer attesting to a blank grid was FUP-FF2-1).
- **RPCs added** - `upsert_matrix_axes(item, rows, columns)` **DEFINER** (draft-only, staff_admin,
  audited, REPLACE keyed on client-minted `code`); `save_section_answers` gains `p_matrix_cells` /
  `p_risk_matrix` (+ the same two keys per instance entry) delegating to the DEFINER
  `app.save_matrix_answers` / `app.save_risk_matrix_answers` behind `app.assert_matrix_answer_writable`;
  `app.validate_matrix_axes` wired into `publish_form_version`.

### DOOR-PARITY RULE - read before adding ANY door or policy

**A new door or policy must carry every arm its sibling surface carries - neither weaker NOR stronger -
and that must be proven as a table, not asserted.** This cost **four defects in one phase**, each in a
different direction: `copy_version_children` was *stricter* than the RLS it displaced (broke no-JWT owner
callers); the matrix write door was *narrower* than the `answers` policies (a targeted respondent could
not save a cell); the matrix SELECT policies were *narrower* than `answer_selected_options` (a corrector
read 0 cells); and the axis tables lacked the targeted arm the rest of the form-definition chain carries
(a respondent could write a cell and not render the grid). Keystone: **`272_ff2_door_parity.sql`**.

Two traps it also taught: **a `FOR ALL` policy's `USING` grants SELECT too**, so a dedicated `_select_`
policy can look redundant while actually covering the post-submit window (`can_write_targeted_response`
requires `in_progress`; `can_access_targeted_response` does not); and **a mutation that reverts only part
of a fix proves nothing** - revert each arm separately.

### Policy arms - diff any new answer/definition table against this

| Table | base | `can_read_correction_response` | `can_access_targeted_*` | write |
| ----- | ---- | --- | --- | ----- |
| `answers` / `responses` | yes | yes | yes (`_select_targeted`) | own-draft + targeted |
| `answer_selected_options` | yes | yes | yes (ETH `...001500`) | own-draft + targeted (**FOR ALL** - REPLACE needs DELETE) |
| `answer_matrix_cells` / `answer_risk_matrix` | yes | yes | yes | **none** (K9 - DEFINER only) |
| `form_items` / `form_sections` / `form_versions` | yes | n/a | yes (`_select_targeted`) | staff_admin |
| `form_item_options` | yes | n/a | yes (ETH `...001500`) | staff_admin |
| `form_matrix_rows` / `form_matrix_columns` | yes | n/a | yes (`...001400`) | **none** (K9) |
| `response_group_instances` | yes | **no** | yes (ETH `...001500`) | own-draft + targeted |
| **`answer_references`** (FF-5, inert) | yes | **no** | **no** | none |
| `form_item_validations` | yes | **no** | **yes** (FF-3 `20260901000100`) | **none** (K9 - DEFINER door; policy present, GRANT withheld) |

> **INHERITED OBLIGATION - FF-3 DISCHARGED, FF-5 OUTSTANDING.** A row missing arms is only safe while its
> table is write-inert (0 rows). **A phase's writer landing is exactly when that stops being true** and must
> add the arms in the same change. FF-1 handed FF-2 its P0-1 obligation this way and it is the only reason
> FF-2 caught it; FF-2 handed FF-3 the two `form_item_validations` arms, and FF-3 landed them in
> `20260901000100` **together with** its writer and its `copy_version_children` block.
>
> **`answer_references` is now the ONLY row still owing**, and FF-5 inherits the full set: the targeted
> arm, the `can_read_correction_response` arm, the correction-copy blocks in BOTH RPCs with the instance
> remap, and an `app.instance_is_empty` arm (without which `submit_response` prunes an instance holding only
> a reference and cascades it away - FF-2 ADR 0089 section A, identical shape). FF-5 also inherits the
> `required = false` pin on `reference` in `form_items_input_vs_display` **and** the `required_if is null`
> pin FF-3 added beside it - relaxing one without the other reopens the Flag-5 deadlock by the other door.

### Out-of-phase fixes carried in this window

- **BUG-FF1-006** (app layer) - `saveSection` dropped FF-1's `HC0N2` into the generic retry copy.
- **BUG-FF1-007** (`...001100`) - `get_response_for_signoff`'s per-instance filters compared against a
  four-quote literal, i.e. a string containing ONE apostrophe, so EMPTY-string observations passed the
  filter. Sweep: the only other `prosrc` match is
  `storage.list_multipart_uploads_with_delimiter`, where that form is **correct** double-escaping inside
  dynamic SQL passed to EXECUTE - do not "fix" it.
- **ETH-E2 targeted choice lane** (`...001500`) - `form_item_options`, `answer_selected_options` and
  `response_group_instances` lacked the targeted arms, so a targeted respondent saw choice questions with
  **no options**, could not persist a selection, and could not fill a repeating group.
  `app.assert_group_writable` also carried its own creator-only check (`HC0N2`), so widening the policies
  alone would have done nothing - it now takes the union. Keystone `273_eth_targeted_choice_lane.sql`.

## FF-5 - Entity Reference (2026-07-28; ADR 0091 + Amendments 1-2; migrations `20260902000000`-`...000900`; flag `entity_refs` **ON** via `...000600`)

Activates F3's frozen one-lane `answer_references` (write-inert since 2026-07-12) into three lanes.
**K9 preserved**: `authenticated` keeps **SELECT only** - no write policy, no write grant - so every
write is a DEFINER RPC and a direct INSERT/UPDATE/DELETE fails 42501 (276 §A probes all three verbs;
the denied party DELETING what it can read is its own exclusion shape).

- **Schema** - `commission_id` + `profile_id` added, all three target FKs **`on delete restrict`** (what
  makes ruling 4's live-join labelling safe: a dangling reference is impossible) * `answer_references_
  kind_target_xor` replaces F3's ONE-SIDED participant CHECK, which permitted zero targets and two
  targets * `unique (answer_id)` (one target per item in v1; multi-target is a constraint DROP - the
  writer's REPLACE semantics, the completeness arm and the aggregation are all already cardinality-
  agnostic) * `form_items_input_vs_display`'s `reference` arm **released** for `required`/`required_if`
  (209 §B1c/B3c flipped from `throws_ok` to `lives_ok` - flipped, not deleted, so the release is on the
  record).
- **SELECT door parity** - three arms matching `answer_selected_options` arm-for-arm: base (creator /
  commission-admin / submitted+staff_admin) + `can_read_correction_response` + `can_access_targeted_
  response` (its own policy). F3 shipped the base arm ONLY - verbatim FF-2 QA r1 B-2.
- **Doors** - `app.assert_reference_answer_writable` (DEFINER; arm ORDER is load-bearing - the targeted
  arm is tested FIRST because a targeted respondent is not the creator, the inversion that was FF-2 r1
  B-1) * **`app.guard_reference_coherent` (TRIGGER, not a door check)** - tenant containment on all three
  lanes + the ruling-2 patient case-scoping, enforced on **EVERY path into the table**, so a hand-rolled
  RPC call cannot bypass what the picker filters (Rule 1: the picker is a convenience, the trigger is the
  boundary) * `app.save_reference_answers` (DEFINER; REPLACE per item, `null` clears).
- **⚠ `public.reference_candidates` is INVOKER-RIGHTS BY DESIGN — do not "harden" it to DEFINER.**
  ADR 0091 **ruling 3**. Running as the caller means `participants_select` /
  `commissions_select_member_or_admin` / `profiles_select_self_or_admin` apply verbatim and it **cannot
  widen them**; a DEFINER search would *replace* all three (ADR 0078 A28 / 0079) and re-derive three
  perimeters by hand. The ruling-2 patient narrowing is an ADDITIONAL `exists`, never a substitute.
  Pinned by pgTAP **`276 §G4`**, which asserts the search DOES reach `professional_profiles` through the
  `responses_select` authorization path - so converting it to DEFINER reds a test instead of silently
  changing the security property. (`…000800` revoked its PUBLIC EXECUTE; see below.)
- **`app.ensure_answer_rows(response, item_ids, instance)`** - extracted from
  `app.ensure_matrix_answer_rows`, which now delegates. Upserts the parent `answers` row at a scope.
- **`app.copy_response_answers(src, dst)` - THE single correction-copy surface.** Instances -> answers ->
  **all four** child shapes, with the old->new instance-resolving join written **ONCE**. It replaced
  **six hand-written copies** (2 RPCs x 3 child tables); `supersede_response` and `start_correction_draft`
  both delegate. **Any future answer shape adds ONE insert here and nowhere else - FF-4 will need this.**
  Resolves through the preserved `(group_item_id, position)` identity because ADR 0087 Amdt 1.3 gives the
  successor its OWN instance rows, making a direct `group_instance_id` comparison unsatisfiable by
  construction and **silently** copy-nothing (FF-1 P0-1). QA r2 cleared the extraction: 8/14 columns
  copied, the other six are defaults or BEFORE-INSERT-derived, and `form_items_no_nested_container` makes
  `parent_instance_id` provably always NULL, so the map is bijective and fails **loud** (23505).
- **Completeness** - `app.item_required_satisfied` + `app.instance_is_empty` gain `reference` arms.
  Without the second, `submit_response` prunes an instance whose only content is a reference and the
  `on delete cascade` takes the answer with it - **silent data loss at submit**, which FF-2 had already
  flagged in-code by name.
- **Reads** - `app.references_by_item(response, instance)` (scope-parameterised like
  `matrix_cells_by_item`) * `dashboard_entity_references` (**DEFINER**, `is_staff_admin_of` OR
  `is_admin`, on `app.submitted_form_responses`) - aggregates on the **target id, NEVER the label**
  (ruling 4): labels are resolved by live join, so grouping by one forks every series on a rename.
- **Rule 10** - `app.participant_type_label()` is the SQL authority for participant-type display text;
  its TS mirror is `PARTICIPANT_TYPE_LABELS`. Both are pinned to the SAME seven literals (`276 §L` +
  `participant-type-labels.test.ts`), so changing one alone REDS. Three sites emitted the raw English
  identifier before this; the sign-off projection was one of them and no render-layer patch could reach it.
- **`get_response_for_signoff`** - gains `references_by_item` at BOTH scopes, plus (`…000900`) the
  **top-level `other_text_by_item`** it never had, and a fix to the top-level `observations_by_item`
  block, which had **no `group_instance_id` filter** and folded INSTANCE observations into the top-level
  map (ADR 0087 substrate correction 5 recurring inside this door).
  **⚠ STANDING OBLIGATION: every new answer shape owes this projection AT BOTH SCOPES.** This surface has
  now lost a shape four times - FF-1 `instances`, FF-2 the grids, FF-5 `references_by_item`,
  `other_text_by_item` - each found AFTER shipping. A sign-off is an attestation; a field the screen never
  showed is the sharp end. `276 §N` asserts the projection **KEY SET** at both scopes, not one key,
  because a single-key test would have passed for all three earlier misses.
- **`…000800`** - revoked PUBLIC EXECUTE from `reference_candidates` **and `save_section_answers`**. The
  latter was a REGRESSION: `…000200` added an 11th parameter (DROP+CREATE) and faithfully restored the
  grants read from `proacl` - but **`proacl` shows what is GRANTED, never what was REVOKED**, and CREATE
  hands PUBLIC the default back. Caught by the standing `100_dashboard` anon-executable keystone.
  **Restoring an ACL means restoring the revokes.**
- **Keystones** - `276_ff5_references.sql` (73 assertions). Ruling 2's case-scoping is proven with real
  case-bound fixtures in BOTH directions (another case's patient is invisible; **this** case's patient IS
  a candidate) - the second is what makes an always-deny mechanism detectable, and its absence was QA r2
  B-1. `§O` pins ruling 1's surrogate premise **behaviourally**: a real name crosses
  `set_participant_patient` and `display_name` stays `'Paciente'`.
- **PHI** - **no new PHI surface, no Rule 12 amendment, no audit door** (ruling 1). The participant lane
  reads only `participants.display_name`, a surrogate by construction. See Amendment 1 for the one place
  the original keystone wording was too absolute.

## FF-3 - Validation Engine (2026-07-28; ADR 0090 + Amendment 1; migrations `20260901000000`-`...000800`; flag `item_validations` **ON** via `...000800`)

**EIGHT migrations** (`...000000` schema * `...000100` door+writer+clone * `...000200` evaluator *
`...000300` `required_if` in the dispatch * `...000400` the error surface + the `HC0P9` gate *
`...000500` operator authorability * `...000600` publish-validates-`required_if` * `...000700`
unary-ops-publishable). *I twice reported "seven" in-phase - the count drifted when `...000700`
landed as a defect fix. Count the files, not the prose.*

Activates F3's `form_item_validations` bones, write-inert since 2026-07-12, and adds
`form_items.required_if`. **K9 preserved**: `form_item_validations` stays `authenticated` SELECT-only and
`set_item_validations` is the only door.

- **Vocabulary (ruling 1)** - SIX rule types, pinned by an allowlist CHECK: `number_range`,
  `text_length`, `regex`, `date_range`, `datetime_order`, `unique_within_group`. **Group cardinality is
  NOT one** - `minInstances`/`maxInstances` shipped in FF-1 and a second spelling would be a second source
  of truth for one bound. The column was `not blank` and nothing more, which is the shape that lets a TYPO
  (`number_rang`) store and evaluate to "no rule".
- **Coverage (ruling 2) is a TRIGGER, not a CHECK** - `app.guard_item_validation_row`. A CHECK cannot
  subquery, and coverage is a statement about the JOINED `form_items` row (`item_type`, and for
  `unique_within_group` the PARENT's type). It also enforces version coherence and test-compiles a `regex`
  pattern at write time (an uncompilable pattern would otherwise raise raw inside `submit_response`, after
  publish). `message` is **required non-blank** by CHECK - which is also what keeps a generated pt-BR
  string out of the SQL/TS parity surface.
- **Triggers** - `app.guard_item_validation_row` (BEFORE INSERT/UPDATE: coverage + version
  coherence + the `regex` compile probe; `HC0Q1`/`HC0Q2`) * **`guard_published_structure` REUSED**
  as `guard_published_validations_trg`, giving the table the Rule 5 freeze its `form_item_options`
  sibling already had and the matrix tables still lack * `app.guard_item_type_vs_validations`
  (BEFORE UPDATE OF `item_type`, `parent_item_id` on **`form_items`**) - the other direction:
  `authenticated` holds full DML on `form_items` (unlike `form_item_validations`), so a staff_admin
  could re-type an item through PostgREST and orphan a rule into a pair the coverage trigger would
  have refused.
- **`required_if` (ruling 4)** - a **SINGLE** condition (`app.is_valid_condition`), NOT the
  `{match, conditions[]}` group shape `visible_when` accepts. `form_items_input_vs_display` forbids it on
  containers, display items **and `reference`** (which pins `required = false` until FF-5 - `required_if`
  would be a back door around that pin). Composed into **both** arms of the dispatch via
  `app.item_is_required(required, required_if, answers)`: top-level map in the flat arm,
  `app.instance_answer_map` in the group arm, so per-instance requirement works by construction.
  **VISIBILITY WINS STRUCTURALLY** - both arms already FILTER by `app.eval_visibility` before the
  requirement test, and `required_if` composes as another conjunct INSIDE that filter, never around it.
- **Enforcement topology (ruling 3)** - `severity='error'` blocks **`submit_response` only** (`HC0P9`);
  `warn` never blocks anywhere; **`save_section_answers` never rejects on a validation rule** (a draft must
  stay saveable mid-edit - the Rule 3 resume contract).
- **`app.eval_validation(rule_type, config, value, answers, peer_values)`** - the phase's second dual
  evaluator, IMMUTABLE and **pure**: `unique_within_group` receives its cross-instance peers as an argument
  rather than reaching into the DB, which is what lets one fixture drive both engines. `p_value` is the
  value **from the answer map in scope**, never `answers.value` (a choice item keeps its payload in
  `answer_selected_options` and only resolves to a code in the map). An **empty value always satisfies** -
  presence belongs to `required`/`required_if`, and "empty" is the same notion `eval_condition`'s
  `is_empty` uses, so the platform has one definition of it.
- **`app.response_validation_errors(response)`** - **THE predicate.**
  `public.get_response_validation_errors` reads it and `submit_response` gates on it, which is what makes
  ADR 0090 section 3's "the list the user sees and the gate that blocks them cannot disagree" true rather
  than aspirational. **Amendment 1**: the legacy `app.assert_item_bounds` config-bound lane (`min`/`max` on
  number+date, `minLength`/`maxLength` on the two text types) was extracted into
  `app.item_bound_violations` and folded into this walker with `rule_id = null`, because that lane is a
  SECOND validation surface over the same fields and left alone it breaks the contract in the worst
  direction - **a submit refused with an EMPTY error list.** `HC061` still raises FIRST, from inside the
  item loop, so no behaviour moved.
- **Operator authorability (ruling 5)** - `app.is_valid_condition` widened to `contains`,
  `not_contains`, `is_empty`, `is_not_empty` (implemented by `eval_condition` since F3, refused by the
  storage gate). The `value` requirement is relaxed for the two unary ops **BY NAME**, not by making
  `value` optional - the latter would also admit an `equals` with no value.
- **RPCs added** - `set_item_validations(item, rules)` **DEFINER** (flag `HC0Q0`; authority FIRST
  `42501`; draft-only `HC0P4`; coverage `HC0Q1`; config `HC0Q2`; audited; **REPLACE semantics** - the
  payload is the item's complete rule list, so an omitted rule is DELETED) *
  `get_response_validation_errors(response)` **INVOKER**, gated by an RLS-evaluated probe on `responses`,
  returning `(item_id, group_instance_id, rule_id, rule_type, severity, message)`.
- **`app.copy_version_children`** gains the `form_item_validations` block **and** copies `required_if` -
  landed in the SAME wave as the writer, because the Rule 5 clone gap opens the instant the definition
  table has rows. The block runs LAST, after the `parent_item_id` re-link, since the coverage trigger
  resolves the new item's PARENT to validate `unique_within_group`.
- **Publish** - `public.validate_visible_when`'s item loop generalised over
  (`visible_when`, `required_if`), so `required_if` inherits existence, earlier-question and FF-1's
  outside-in ban. Without it a `required_if` pointing into a repeating group resolves against a map where
  the key is absent, so the item is **silently never required** - fail-open, and invisible to any test that
  only asks "does an unmet `required_if` block".

### FF-3 door parity - DISCHARGED, and it CORRECTS ADR 0090 section 6

Measured against `pg_policies`, not asserted. `form_item_validations` gained the two missing arms
(`_select_targeted` and `_staff_admin_write`), closing the FF-2 hand-forward. **The ADR's parity table was
wrong on one cell**: it recorded the matrix tables as carrying a write policy. They do not - they carry ONE
policy each, and their write boundary is the SELECT-only GRANT plus the DEFINER door. `form_item_options` is
the outlier that misled it: it holds a full `arwdDxtm` grant, so for *that* table the `FOR ALL` policy IS
the boundary.

**FF-3 took the stricter shape**: both policy arms added per the ADR, **grant left SELECT-only**, so K9
holds by privilege and the writer is the only door. The `FOR ALL` policy is documented intent plus
defence-in-depth, **not** today's boundary. Keystone `274` section C pins both facts, including a computed
sibling diff (`form_item_validations` carries no FEWER arms than `form_item_options`) so a future arm added
to one shows up as missing on the other. The lead's rule from this: **where siblings disagree, the tighter
posture wins.**

### Four fail-open defects, none catchable by tsc/lint/unit/build

1. **`app.validation_rule_allowed` returned NULL, not false**, for a top-level item
   (`p_parent_item_type = NULL` gives `NULL and true` = NULL). Every caller wrote `if not allowed(...)`,
   and `not NULL` is NULL, so the `if` never fired and a forbidden pair was **accepted**. A coverage
   predicate must be TOTAL - fixed with an outer `coalesce(..., false)`, and `eval_validation`'s regex arm
   plus `item_is_required` hardened the same way. Same family as FF-2 defect 1: a three-valued predicate
   read as if it were two-valued.
2. **`validate_visible_when` never validated `required_if`** (above) - fixed in `...000600`.
3. **`HC061` has TWO unrelated raise sites** - `app.assert_item_bounds` (a field bound) and
   `app.compute_case_phase_result` (a MANUAL phase with no result) - and `submitResponse` mapped it to
   *"Selecione o resultado da fase"*. Reachable by ORDINARY USE: type two characters into a `minLength: 5`
   field and be told about a phase result. Both raise sites produce good pt-BR, so the mapping now prefers
   the DB message. **A third site exists** (`public.approve_correction` re-raises it) and is separately
   mapped in `corrections/actions.ts`.
4. **The unary operators were STORABLE but UNPUBLISHABLE** (`...000700`). `is_valid_condition` was
   widened; the two publish-time assertions were not. `is_empty` on a NUMBER target raised "exige um valor
   numerico"; on a CHOICE target it raised `referencia a opcao "nula"` - naming an option the author never
   wrote. The author could SAVE the draft and then fail publish with a nonsense message.
   **`app.assert_condition_value_codes` gained a REQUIRED `p_op`**; requiredness is the point, since a
   defaulted parameter lets a caller silently keep the old behaviour. All FOUR call sites wired in the same
   transaction.

> **The complete gate set for a `visible_when`/`required_if` operator, from `pg_proc` - check ALL of these
> when widening the vocabulary.** `app.is_valid_condition` (storage CHECK) * `app.is_valid_visibility`
> (group wrapper - **delegates**, so it inherits any widening) * `app.assert_condition_op_target`
> (publish) * `app.assert_condition_value_codes` (publish). There is no fifth. Two ADJACENT lanes keep
> their own **narrower** allowlists and are deliberately untouched: `app.is_valid_recommend_cond`
> (`equals`/`not_equals`/`in`) and `app.is_valid_flagged_when` - different columns, different vocabularies.

### Two lessons worth more than the code

- **`validate_visible_when` calls the same helper TWICE** (a section loop and an item loop) and the two
  call sites do not share a call text. A re-signature that rewrote only one applied cleanly - plpgsql
  resolves calls at EXECUTION time - and then broke publish with a raw `42883` for any form carrying a
  SECTION condition, a path shipped long before FF-3. The migration's own belt missed it because it counted
  caller **functions** (found the expected 3) while one of them called **twice**. It now counts call
  **SITES** and inspects each site's arguments. Sweep call SITES, never callers.
- **Mutate BEFORE writing a keystone, not after.** Two guards in this phase could not fail and were
  caught by something other than review. The one that held was pre-checked: the narrowings `frontend`
  feared were already covered (E4, I2/I5), and the *actual* uncovered case was a MIXED severity set from
  ONE call - no fixture had ever held both. `274` section M pins it, and its comment block records the
  **OBSERVED** mutation output because two of three predictions were wrong.

### Verified catalog shape (2026-07-28, post-`db reset`; re-derive, do not trust this text)

`set_item_validations(uuid,jsonb)` **prosecdef=true** * `get_response_validation_errors(uuid)`
**prosecdef=false** (INVOKER - the RLS-evaluated probe on `responses` is the read gate, so it is
exactly as strong as the `responses` SELECT policy, neither weaker nor stronger) *
`app.response_validation_errors` DEFINER/STABLE * `app.assert_condition_value_codes` DEFINER/STABLE,
**6 arguments** * IMMUTABLE and pure: `eval_validation`, `item_is_required`,
`validation_rule_allowed`, `is_valid_validation_config`, `validation_value_is_empty`,
`item_bound_violations`, `is_valid_condition`, `is_valid_visibility`,
`assert_condition_op_target` * `form_item_validations`: **3 policies**, `authenticated` SELECT=true
INSERT=**false** * 3 triggers as listed above. Plans: `274` 81, `209` 44, `272` 30.

### pgTAP

`274_ff3_validations.sql` - **81 assertions**, every ADR 0090 keystone, each mutation-proven. The
artifact is not a mutation COUNT (I cannot defend a precise one) but the **observed red output
recorded per section**, naming the exact revert and which assertions went red - so `qa` can re-run
any proof from the note alone. Re-pins: `209` section B **+4** (the `required_if` half of the
Flag-5 freeze, with a POSITIVE twin so the three negatives cannot pass vacuously) and `272` **section S
+3** (a TARGETED respondent READS validation ROWS - `274` section C can only prove the policy EXISTS,
which ETH-E1 established is a different claim).

## FF-4 - Power Authoring (2026-08-03; ADR 0092 + Amendments 1-2; migrations `20260903000000`-`...000600`; flag `power_authoring` **ON** via `...000600`)

The **last** of the five phases ADR 0086 ruling 2 put in front of the pilot deploy. A commission-scoped
reusable **block library** (jsonb snapshot of one item subtree) + **dynamic defaults**. No
`form_calculations` - it stays ADR-0060-reserved (ADR 0086 ruling 6).

- **`form_block_library`** - `commission_id NOT NULL`, `name`, `description`, `snapshot jsonb`, and
  provenance as **denormalized `saved_by_id` / `saved_by_name` / source form title + version number with
  NO FK** (ruling 2, deliberate: an FK forces a CASCADE-vs-RESTRICT call on a table meant to outlive its
  source, and *any FK present will eventually be joined*, which is how a "snapshot" quietly becomes a
  live link). **K9 preserved**: RLS enabled, **ONE** permissive SELECT policy
  (`is_staff_admin_of OR is_tenancy_admin_of`), `authenticated` holds **SELECT only** - no write
  policy, no write grant - so the four DEFINER doors are the only writers. Commission-only by PO ruling;
  an org-visible arm is additive (one boolean + one `OR`) and deliberately deferred.
- **Four DEFINER doors**, all `revoke execute … from public, anon` **at creation** (ADR 0091 Amendment 2
  applied at birth, not patched): `save_block_to_library` * `insert_block_from_library` *
  `update_block_library_entry` * `delete_block_library_entry`. Each enforces the commission perimeter
  **itself** - there is no RLS behind a DEFINER body.
- **⚠ RULING 3 - A SNAPSHOT IS CLOSED UNDER ITS OWN CONDITIONS.** `visible_when`/`required_if` are written
  over `question_key`s. `save_block_to_library` **refuses** (`HC0Q6`, naming the keys) a subtree whose
  condition references a key OUTSIDE it; `insert_block_from_library` applies the collision rename map to
  the **conditions as well as the keys** via `app.rewrite_condition_keys` (handles both the single-condition
  and `{match, conditions[]}` shapes). Renaming keys without rewriting conditions passes every structural
  test and surfaces only as a question that never appears.
- **⚠ `app._insert_block_child_rows` inserts `form_item_validations` LAST**, after the `parent_item_id`
  re-link - `app.guard_item_validation_row` resolves the new item's **parent type** for
  `unique_within_group`, so a pre-re-link copy sees NULL and refuses the row. Inherited verbatim from
  `app.copy_version_children`, whose insert list **is** the authoritative child enumeration
  (`form_items` recursive * `form_item_options` * `form_matrix_rows`/`_columns` * `form_item_validations`).
  FF-5 reference config rides in `form_items.config`; there is no sixth child table.
- **`form_items.default_source`** (text, nullable) + two CHECKs: `form_items_default_source_xor`
  (literal `default_value` XOR dynamic `default_source`) and `form_items_default_source_type_check`
  (`today`→`date`, `now`→`time`, `current_user_name`/`current_user_email`/`commission_name`→
  `short_text`/`free_text`). ⚠ This type CHECK is **TIGHTER than the shipped
  `form_items_default_value_display_null`**, which still permits a `default_value` on a matrix that nothing
  can apply. FF-4 did **not** inherit that looseness and did **not** retro-tighten it - narrowing a shipped
  CHECK against existing rows is its own migration (ADR 0092 open question).
- **`app.seed_default_answers` / `app.resolve_default_source`** - INVOKER, flag-gated, wired into
  **`start_or_resume_response`'s CREATE branch only** (body re-declared from live `pg_get_functiondef`,
  the FF-2 `publish_form_version` precedent). **Idempotent by contract**: seeds only an unanswered item,
  never overwrites an edited or cleared answer. Only `submitted` responses reach `question_key`
  aggregates, so draft seeding does not perturb dashboards/indicators.
- **⚠ `buildAnswerMaps` (TS, `src/lib/queries/responses.ts`) now DELIBERATELY DIVERGES** and it is not a
  bug to "fix": `answersByItemId` keeps null-valued (cleared) scalar rows, `answersByKey` excludes them.
  `answersByKey` is the **Rule 3 parity mirror** of `app.answer_map_scoped`'s
  `jsonb_object_agg … and a.value is not null`; `answersByItemId` is the wizard's per-item state, where
  "cleared" and "never answered" are different states (`withDefaults`' `item.id in initialAnswers`
  presence check). Collapsing them was **BUG-FF4-001** - a cleared default silently re-seeded on resume -
  and it was a **pre-existing answer-model-v2 bug** (literal `defaultValue` shares the same gate), not an
  FF-4 regression. A mutation-proven Vitest PARITY GUARD pins the exclusion.
- **Amendment 1** - there is **no `question_key` rename door anywhere in the platform**, and never has
  been (`updateItem` pins the key stable so dashboards aggregate across versions; `addItem` mints
  `slug(label) + shortSuffix()`). The rename-review list is therefore **read-only**. Because every key
  already carries a random suffix, the only collision `insert_block_from_library` can hit is inserting the
  same block into one version **twice**.
- **SQLSTATE**: allocates **`HC0Q6`** (ruling-3 closure refusal) **plus `HC0Q7` and `HC0Q8`**
  (`insert_block_from_library` / `delete_block_library_entry` / `update_block_library_entry` /
  `save_block_to_library`). High-water moves `HC0Q5` → **`HC0Q8`**. *(This row said "→ `HC0Q6`"
  until 2026-08-03; Phase 16's Wave 0 catalog check caught it — ADR 0092's prose understates
  FF-4's real consumption too. Verify against `pg_proc`, not this line.)*
- **pgTAP** `277_ff4_power_authoring.sql` - 61 assertions, 12 keystones, each mutation-proven, incl.
  `library_metadata_door_cannot_touch_snapshot` (which makes ruling 2's immutability a proven invariant
  rather than a convention that held because nothing could write) and `library_rls_tenant_scoped` with its
  over-grant twin.

## DSS — Deferred `staff_admin` sign-off (2026-08-24; ADR 0136 + Amendment 1; migrations `20261003001900` + `20261003002000` + `20261003002100`; flag `deferred_staff_signoff` **ON** — flipped at the gate by `…2100`)

✅ **COMPLETE — QA APPROVED + human-approved 2026-08-24; flag flipped ON by `20261003002100`.**
✅ **PUSHED 2026-08-25** — a flag flip changes production only when its migration reaches the linked
project. Read ADR 0136 § Amendment 1 before anything below — the ADR's own § Size table and
Consequences were wrong in **eight** places, every one in the reassuring direction.

⚠ A THIRD migration joined this section after the follow-up round: `20261003002000` fixes
`start_or_resume_response`, whose resume query was lane-blind while the unique index it defers to
was not — so a member holding an `in_progress` CASE-PHASE draft was handed it back on the
STANDALONE route. The route now refuses a case-phase response outright; the deferral is what made
the pre-existing bug visible rather than what caused it.

**The shape.** `case_phases.status` gains a sixth value, `awaiting_signoff`, between `active` and
`completed`. `submit_response` stops blocking on an unsigned `signoff_role = 'staff_admin'` section
**of a case-phase response**; the phase parks; the last signature completes it and only then computes
the phase result. `responses.status` is UNCHANGED (two values) — attestation state lives on the PHASE.
A STANDALONE response keeps today's HC012 (D2), which is why `80_signoffs.sql` needed no edit at all.

**New routines** (all four `SECURITY DEFINER`, all four `revoke all … from public`):

| routine | what it answers | note |
| --- | --- | --- |
| `app.pending_staff_signoffs(uuid)` | "which visible sections still owe a `staff_admin` signature?" | THE single definition — it replaced **six** independent copies, five of which used `app.eval_condition` and therefore RAISED on a group-shaped section condition (**BUG-SIGNOFF-GROUPCOND-001**). Row-door sweep: **UNSUPPORTED** (no identity guard) → `authz-unswept-backlog.txt`. |
| `app.is_signoff_deferral_open(uuid)` | "is this frozen response still open for its deferred attestation?" | THE single definition of the window, shared by `can_sign_section` (an RLS `WITH CHECK`), `guard_submitted_signoffs` and `sign_section`. ⚠ The `is_` prefix is **load-bearing**: the door sweep's predicate arm bounds its domain with `^(is_\|can_\|has_\|…)`. Sweep: **COVERED**. |
| `app.assert_phase_result_ready(uuid)` | the HC061 precondition, extracted from `compute_case_phase_result` | D5 moves the COMPUTATION onto the signature; the PRECONDITION stays on the submit, or the raise lands on a coordinator who cannot fix it. |
| `app.trg_complete_phase_on_signoff()` | D5's completion | `AFTER INSERT` on `response_section_signoffs`. Keys on `case_phases.current_response_id`, so signing a **superseded** response never completes the phase. |

**`public.guard_submitted_signoffs()` is NEW and separate.** `guard_submitted_signoffs_trg` no longer
runs `guard_submitted_children` — that shared body still backs `answers` **and**
`response_group_instances`, so branching it would have touched three tables. The carve-out is
INSERT-only and STRUCTURAL (it asks whether the phase still awaits attestation, never who is asking);
authority stays with the `signoffs_insert` policy.

**`public.list_signoff_queue` changed SIGNATURE** — `returns table (…, case_phase_id uuid)`, so it was
DROPped and recreated and its grants re-issued. Non-null marks the FROZEN lane; the queue now mixes
two lanes behind one button and the UI must say which.

**Widened, and each for a stated reason:** `submit_response` (D1 role split — the section cursor had
to gain `s.signoff_role`) · `sync_case_phase_on_submit` (D3) · `app.can_sign_section` (a LIVE authz
change — it is the `signoffs_insert` `WITH CHECK`) · `sign_section` (**a third `in_progress` gate the
ADR never names**) · `get_response_for_signoff` · `compute_due_notifications` (or the reminder ladder
dies at submit) · `save_section_answers` · `close_case` (gate **and** sweep — the same line twice) ·
`cancel_case` · `app.recompute_case_status` (first `bool_or` only) · `file_correction_request`
(**D7's decline path did not otherwise exist**) · `approve_correction` (impact snapshot) ·
`get_case_detail` · `app.guard_case_phase_status` (+3 transitions).

⛔ **DELIBERATELY UNCHANGED, and each absence is load-bearing:** `activate_phase` —
`awaiting_signoff` is **absent** from its settled set, which IS D3's whole mechanism (pgTAP 367 §3.4
asserts the absence) · `set_case_phase_result_override` (HC057 — the result is settled before the
freeze) · `start_or_resume_phase` / `skip_phase` (HC019) · `app.case_phase_answer_map` /
`case_phase_option_aggregates` (an unattested phase must not feed indicators) ·
`guard_submitted_children`.

**Tests.** pgTAP `367_deferred_staff_signoff.sql` (**79**) — 15 neutralizations RED-proved; E2E
`deferred-staff-signoff.spec.ts` (5), which caught the one thing pgTAP structurally cannot: the
**wizard's own submit gate** kept the button `disabled` while the database allowed the submit.

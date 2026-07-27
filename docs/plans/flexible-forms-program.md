# Flexible-Forms Program — FF-1…FF-5 pre-pilot (one sequenced, collision-free build)

**Status:** PLANNED (sequencing + scope accepted 2026-07-27; per-phase ADRs to author; not
implemented). **Date:** 2026-07-27 · **Owner:** platform lead → `backend` + `frontend` per phase.
**Implements:** ADR [0086](../decisions/0086-flexible-forms-pre-pilot.md) (re-sequencing of ADR
[0060](../decisions/0060-flexible-forms-foundation.md) §3).
**Posture:** pre-pilot, **reset-OK** (memory `prelaunch-db-reset-ok`); every phase lands
additively, forward-only, **dark behind its flag**, folded into the single pilot deploy that
follows FF-4's gate. No back-compat migrations.
**Binding rules:** Rule 1 (RLS is the boundary) · Rule 2 (extend, never contradict) · **Rule 3
(one evaluator, mirrored SQL↔TS — drift is phase-blocking)** · Rule 5/6 (published + storage
immutability) · Rule 8 (regen types) · Rule 9 (queries layer) · Rule 10 (pt-BR UI) · Rule 11
(audit) · Rule 12 (PHI — FF-5's participant lane touches it).
**Conventions inherited:** ADR [0065](../decisions/0065-pre-pilot-foundations-conventions.md)
(freeze principle §6 · reference→participants bridge §7 · supersession §8) · the K9 write-inert
pattern (pgTAP 209 §C — **writers must land as DEFINER doors**) · the ratified aggregation
contract [f3-question-key-aggregation.md](../design/f3-question-key-aggregation.md) · the
two-migration flag pattern (schema seeds OFF → `…_enable_<flag>.sql` at the gate).

This program does **not** re-design ADR 0060's dispositions — it sequences the five committed
feature phases onto the shipped F3 bones, resolves the shared-surface collisions (§2), and gives
each phase its Scope / Dependencies / ADR questions / Gate (§3). Deep design happens in each
phase's own ADR at its start (contract-first, backend before frontend).

**The PO rulings this program encodes (ADR 0086):** all five phases pre-pilot · all gate the
pilot deploy · order **FF-1 → FF-2 → FF-3 → FF-5 → FF-4** · required-capable per phase ·
instance-aware evaluation in FF-1 · `required_if` in FF-3 · FF-5 = 3 lanes · FF-4 trimmed
(no calculated fields).

---

## 0. Scope

**In scope (five gated phases, in build order):**

1. **FF-1 Repeating Groups** (`repeating_groups`) — instance write RPCs + resume plumbing +
   builder/wizard UX + **instance-aware condition evaluation** + group completeness.
2. **FF-2 Matrix & Risk Matrix** (`matrix_fields`) — axes/cell/risk writers + authoring +
   filling + cell-unit aggregation; discharges INFO-1 (matrix half) + INFO-4.
3. **FF-3 Validation Engine** (`item_validations`) — rule vocabulary + paired validation
   evaluators + `required_if` in the completeness authority + operator authorability; discharges
   INFO-1 remainder.
4. **FF-5 Entity Reference** (`entity_refs`) — participant + commission + user lanes; discharges
   INFO-2 (PHI-read audit door).
5. **FF-4 Power Authoring** (`power_authoring`) — reusable block/question library + dynamic
   defaults.

**Out of scope / stays post-pilot:** calculated fields (`form_calculations` — ADR-reserved, ADR
0086 ruling 6) · hospital/org reference lanes · nested condition groups, logic→actions,
rich_text, signature-as-answer, file-upload answers, i18n, offline (all DROPPED by ADR 0060 —
unchanged) · persisted form-lint + materialized section-completion (RESERVE — unchanged).

**Not this program's:** Phase 16 (deferred, needs replanning; blocks ETH·E3b) · the
BUG-AIF-001/FUP-AI-1 workstream · the pilot deploy itself (follows FF-4's gate; user-authorized).

---

## 1. Sequencing & dependencies

```
FF-1 repeating groups ──► FF-2 matrix/risk ──► FF-3 validation ──► FF-5 reference ──► FF-4 authoring ──► pilot deploy
(instance engine +          (axes writers +      (rules + required_if   (3 lanes +          (library +
 completeness dispatch)      clone deep-copy)     + operators)           PHI door)           defaults)
```

**Why this order (ADR 0086 ruling 3):** field types precede the validation engine that targets
them (FF-3's `unique_within_group`/cardinality need FF-1; per-instance `required_if` needs FF-1's
instance-aware map); the two riskiest surfaces — FF-1's wizard/resume + instance engine and
FF-3's submit-authority touch — land earliest and bake longest before the pilot; FF-4 is last
**structurally** (the library must snapshot every shipped item shape: options, matrix axes,
validations, reference config).

| Phase | Hard deps | Soft deps |
|---|---|---|
| FF-1 | F3 substrate only (`response_group_instances`, `answers.group_instance_id`, `parent_item_id`) | — |
| FF-2 | F3 frozen tables | FF-1's completeness dispatch + save-payload shape (serialization, not function) |
| FF-3 | FF-1 (group rules + per-instance `required_if`); FF-2's cell contract only if matrix cells are validatable v1 (ADR may scope out) | FF-2's shared deep-copy helper |
| FF-5 | F1 participants (shipped); authz door patterns (shipped) | FF-3 only if reference items get validations |
| FF-4 | **All four prior** (library snapshots every shape) | — |

Matrix-inside-group and reference-inside-group work **by construction** (answer children hang off
`answers`, which carries `group_instance_id`) — each later phase tests the composition, never
builds it.

---

## 2. Collision matrix — shared surfaces, serialized ownership

Strictly sequential phases (one gate each) make these serializations, not co-edits. The rule per
surface: **one phase establishes the extensible shape; later phases add arms only.**

- **`app.response_required_complete` + `submit_response`** — edited by four phases (heaviest
  contention). **FF-1 lands a dispatch-by-`item_type` refactor** (group arm first); FF-2/FF-3/
  FF-5 add arms + regression pgTAP over all prior arms. `required_if` (FF-3) composes as a
  predicate layer over the dispatch, with visibility-wins deadlock precedence.
- **F3 `form_items_input_vs_display` CHECK + pgTAP 209 §B (never-required freeze)** — each
  field-type phase relaxes exactly its own arm and re-pins 209 §B for the rest; the freeze
  assertion is replaced by that phase's completeness-deadlock-negative keystones.
- **`clone_form_version` deep-copy (INFO-1)** — **FF-2 extracts a shared copy helper** when it
  adds `form_matrix_rows`/`_columns` copying; FF-3 reuses it for `form_item_validations`; FF-4's
  `insert_block_from_library` reuses it again. The copy block must land **in the same migration
  wave as the first writer** (the Rule-5 gap opens the moment a definition table has rows).
- **`conditions.ts` + `app.eval_condition` + golden vectors** (`condition-vectors.json` /
  `20_conditions.sql`) — FF-1 owns the instance-aware answer map (both evaluators + a new vector
  dimension); **FF-3 owns operator authorability** (widen `app.is_valid_condition` to
  `contains`/`not_contains`/`is_empty`/`is_not_empty` + `condition-builder.tsx` pickers +
  vectors). Every phase adding a value shape re-extends the operator × value_type matrix.
- **`save_section_answers`** — payload arms in phase order: FF-1 (instance-scoped answers) →
  FF-2 (cells/risk) → FF-5 (references). Each arm additive; prior arms' pgTAP re-run.
- **`src/lib/queries/dashboard.ts`** — the shipped supersession latest-in-chain exclusion covers
  only `answers`/`answer_selected_options` rollups; **each new answer table ships its own
  supersession-tolerant read predicate in its owning phase** (FF-1 group explode, FF-2 cells +
  risk score, FF-5 references).
- **Shared UI seams** (every phase; serialized by phase order): builder —
  `src/components/forms/item-editor-dialog.tsx`, `add-block-menu.tsx`, `item-type-meta.tsx`;
  wizard — `src/components/responses/wizard/input-item.tsx`, `block-renderer.tsx`,
  `use-wizard.ts`, `prepare.ts`, `review-screen.tsx`, `answer-summary.tsx`.
- **`supabase/tests/209_flexible_forms.sql`** — §B/§C re-pinned by every phase; §C's K9 keystone
  (direct DML denied on the six tables) must stay green — **all writers are DEFINER doors by
  construction**.

---

## 3. Phased sequence

All phases: backend-owned migrations, forward-only, sequential timestamp windows; contract-first
(backend posts typed stubs before frontend starts); new SQLSTATEs allocate above the live HC
high-water at authoring time; flag seeded OFF in the schema migration, flipped by its own enable
migration at the gate; types regenerated; one Phase Gate each (build → tester → qa → human →
Record).

### FF-1 — Repeating Groups (`repeating_groups`)

- **Scope (DB):** DEFINER writer RPCs `add_group_instance` / `remove_group_instance` /
  `reorder_group_instances` over `response_group_instances` (draft-only, creator-gated, audited;
  position integrity under the `UNIQUE NULLS NOT DISTINCT` shape); `save_section_answers` gains
  the instance-scoped answer arm; relax the `group`/`repeating_group` CHECK arms +
  **dispatch-by-`item_type` refactor of `app.response_required_complete`** with the group arm
  (min-instances; per-instance child required-ness).
- **Scope (engine):** **instance-aware answer map in BOTH evaluators** (ADR 0086 ruling 8) —
  same-instance sibling resolution, top-level fallback; new golden-vector dimension in
  `condition-vectors.json` + `20_conditions.sql`; explode-by-child-key aggregation in
  `dashboard.ts` (supersession-tolerant), instance count only via the reserved synthetic-key
  precedent.
- **Scope (UI):** builder — enable the container types, child authoring + min/max in
  `behavior_config`; wizard — instance add/remove/reorder, per-instance rendering, resume,
  grouped review/summary.
- **ADR questions:** required semantics precedence (group min-instances vs per-instance children
  vs visibility); save-path shape (one payload vs per-instance round-trips; concurrency on
  positions); nesting depth v1 (`parent_instance_id` supports nesting — allow or cap at 1?);
  instance-map fallback semantics (sibling missing in instance → absent or top-level?).
- **Gate keystones:** `rls_group_instances_reader_non_writer` (direct DML denied, RPC path
  audits) · `completeness_deadlock_negative_groups` (hidden group with required children never
  blocks; unmet min-instances does) · `condition_parity_vectors_instances` (SQL↔TS on the
  instance dimension) · `supersession_group_answers_excluded` · E2E wizard group lifecycle →
  submit → explode aggregation.

### FF-2 — Matrix & Risk Matrix (`matrix_fields`)

- **Scope (DB):** builder writer `upsert_matrix_axes` (rows+cols, clone-stable `code`s); answer
  writers for `answer_matrix_cells` + `answer_risk_matrix` (server-side `risk_score` derivation);
  **INFO-1 matrix half** — `clone_form_version` copies axes via the **extracted shared deep-copy
  helper** (same wave as the writer); **INFO-4** cross-item coherence trigger (cell's row/col
  must belong to the answer's item); relax matrix/risk CHECK arms + completeness arms.
- **Scope (engine):** cell-unit aggregation `(question_key, row_code, col_code)` + risk_score-as-
  number in `dashboard.ts`, each with its own supersession-tolerant predicate; operator ×
  value_type matrix re-extended for the cell shape; the indicator/dashboard (row, col) picker UX.
- **Scope (UI):** builder — axes editor + risk config (severity/likelihood + weights); wizard —
  grid input + severity×likelihood picker with computed score; grid review/summary.
- **ADR questions:** cell value contract (which shapes in `value` jsonb; where the cell input
  type is declared); risk-score formula + where weights live (`risk_weight` vs axis rows/cols) +
  score→band mapping; matrix required-ness semantics (all rows? all cells? configurable?);
  axis-code edit rules on cloned drafts (codes are the aggregation key).
- **Gate keystones:** K9 preserved (writers live, direct DML still denied on all 4 tables) ·
  `clone_copies_matrix_axes` (publish → clone → deep-copied, source immutable) ·
  `matrix_cell_coherence` (foreign row/col rejected) · `completeness_deadlock_negative_matrix` ·
  `supersession_matrix_excluded` · E2E author axes → fill → dashboard cell/score golden.

### FF-3 — Validation Engine (`item_validations`)

- **Scope (DB):** writer `set_item_validations` (draft-only, audited); pin the `rule_type`
  vocabulary (allowlist CHECK or validator); **INFO-1 remainder** — clone copies validations via
  the shared helper; **`required_if` in `app.response_required_complete`/`submit_response`**
  (evaluated via `app.eval_condition`, incl. per-instance via FF-1's map; **visibility wins** —
  a hidden item is never required); severity contract: `error` blocks submit server-side, `warn`
  never blocks.
- **Scope (engine):** paired validation evaluators — `app.eval_validation` (SQL) + TS twin (new
  module under `src/lib/queries/`), golden vectors per the `eval_condition` parity pattern;
  **operator authorability** — widen `app.is_valid_condition` + `condition-builder.tsx` pickers
  for the 4 F3 operators (+ vectors; stored published conditions unaffected).
- **Scope (UI):** builder — rules editor (type/config/severity/pt-BR message) +
  `required_if` authoring via the condition builder; wizard — inline error/warn, submit blocked
  on error, warn badges in review.
- **ADR questions:** rule_type vocabulary v1 (min/max, length, regex, date bounds,
  `datetime_order`, `unique_within_group`, group cardinality — cross-field rules in or out?);
  enforcement topology (save vs submit vs client-only per severity; the error-surface contract
  returned to the wizard); coverage v1 (scalar items only, or group children per-instance and
  matrix cells too?).
- **Gate keystones:** `validation_parity_vectors` (SQL↔TS golden) ·
  `submit_blocked_error_not_warn` · `required_if_completeness` (true-missing blocks; false
  passes; hidden+required_if deadlock-negative; per-instance arm) ·
  `rls_validations_reader_non_writer` + `clone_copies_validations` (INFO-1 closed) ·
  `operators_authorable` · E2E author rule → inline pt-BR message → submit gating.

### FF-5 — Entity Reference (`entity_refs`)

- **Scope (DB):** widen `answer_references.reference_kind` CHECK to
  `participant | commission | user`; add nullable `commission_id → commissions`,
  `profile_id → profiles` (ON DELETE RESTRICT) + kind↔target XOR CHECK; answer writer arm (K9
  posture preserved); **INFO-2** — PHI-read **audit door** for participant-lane reads (the F3
  SELECT policy is the generic answer-table default, not a PHI door); tenant-scoped candidate
  search for the picker; relax the reference CHECK arm + completeness arm.
- **Scope (engine):** aggregate on target id, never label (`dashboard.ts` + supersession-tolerant
  predicate); Rule 12 module enumeration updated — the participant lane is a PHI read surface.
- **Scope (UI):** builder — reference config (kind + scope filter into `behavior_config`);
  wizard — typeahead picker (PHI-safe display), label resolution in review/summary.
- **ADR questions:** **picker exposure** (what may the participant typeahead show
  pre-selection; does search itself pass the audit door, and how without per-keystroke audit
  spam — this is the phase's hardest authz design, not a widget); label snapshot vs live join
  (RESTRICT makes live join safe; snapshot avoids read-time PHI joins); candidate-set scoping
  enforcement point (RLS on the source vs DEFINER search RPC); conditions on reference answers
  (equals/in on target id) — v1 or deferred.
- **Gate keystones:** `rls_answer_references_reader_non_writer` + XOR/kind negatives +
  RESTRICT-delete negative · `info2_phi_door` (participant read without the door denied; door
  read audited) · `cross_tenant_reference_negative` (no reference outside the org perimeter) ·
  `completeness_reference_arm` (+ deadlock-negative) · E2E pick → submit → aggregate-by-id,
  superseded excluded.

### FF-4 — Power Authoring (`power_authoring`)

- **Scope (DB):** library table(s) (org/commission-scoped; jsonb **snapshot** of the item
  subtree incl. options, matrix axes, validations, reference config) + DEFINER RPCs
  `save_block_to_library` / `insert_block_from_library` — insert **materializes copies** (no
  live links; Rule 5 and clone untouched) via the shared deep-copy helper; dynamic defaults —
  `default_source` config resolved server-side at draft start (idempotent: never overwrites an
  existing answer). **No `form_calculations`** (stays reserved, ADR 0086 ruling 6).
- **Scope (engine):** `question_key` remap on insert (uniqueness within the version) with an
  explicit collision policy; default-resolution vocabulary.
- **Scope (UI):** builder — library browser + save-to-library; dynamic sources in
  `default-value-editor.tsx`; wizard — prefill in `prepare.ts`/`use-wizard.ts`.
- **ADR questions:** library scope + provenance (org vs commission; snapshot immutability;
  origin tracking without live coupling); `question_key` collision policy (auto-suffix vs
  prompt) + its aggregation-continuity consequences; dynamic-default vocabulary v1 (now(),
  current user, case/participant context?) + resolution timing.
- **Gate keystones:** `library_insert_deep_copy` (options + axes + validations + reference
  config intact) · `library_rls_tenant_scoped` (cross-org denied) ·
  `default_prefill_idempotent` (never overwrites; resume stable) · E2E save rich block → insert
  → publish → fill → submit.

---

## 4. Feature-flag plan

| Phase | Flag (ADR 0060 §3 reserved names) | Seeded | Flipped |
|---|---|---|---|
| FF-1 | `repeating_groups` | OFF in the schema migration | `…_enable_repeating_groups.sql` at the FF-1 gate |
| FF-2 | `matrix_fields` | OFF | at the FF-2 gate |
| FF-3 | `item_validations` | OFF | at the FF-3 gate |
| FF-5 | `entity_refs` | OFF | at the FF-5 gate |
| FF-4 | `power_authoring` | OFF | at the FF-4 gate |

`seed.sql` flips each ON for local/E2E once its phase is under test (existing convention).
Builder enablement (`add-block-menu.tsx`/`item-type-meta.tsx`) and RPC guards both check the
flag — dark until the gate, per the m2-gate precedent.

---

## 5. Migration ownership & docs

- One timestamp window per phase (sequential; backend-owned; no two teammates touch one file per
  phase — CLAUDE.md §4). Regen `database.ts` after every migration (with pgTAP dropped — memory
  `gen-types-pgtap-pollution`).
- Doc surfaces per phase at Record: `docs/backend-state.md` (new writers/doors/flags),
  ARCHITECTURE.md §2 only when a phase changes the canonical forms/response shape
  (required-capability relaxations qualify), Rule 12 module list at **FF-5** (participant-lane
  read surface), PROGRESS.md rotation per §7.
- Remote is data-bearing (case-corrections pushed 2026-07-24) and one migration
  (`20260826000100`) is still push-pending — the **pilot deploy step reconciles the local/remote
  migration high-water** (likely one final `db reset --linked`, user-authorized; memory
  `remote-db-push-needs-user-auth`).

## 6. Testing & gates

- pgTAP is the lock: full ordered `supabase test db` on a fresh reset per phase; 209 §B/§C
  re-pinned per phase; **keystones mutation-proven** (revert the guard → the keystone must go
  red — the ADR-0079 discipline; a keystone that cannot fail is not a keystone).
- Dual-evaluator golden parity (`conditions` + the new `validation` pair) is **phase-blocking**;
  the operator × value_type matrix re-extends with every new value shape.
- E2E per phase: happy path + negative/security + one keyboard-only flow (wizard instance
  controls, matrix grid, typeahead are all keyboard-relevant); the full `npm run e2e:prod` gate
  declares green (lead-run, batched — memory `subagent-cannot-run-full-e2e`).
- Each phase is one Phase Gate: build → tester → qa review → human approval → Record
  (PROGRESS + backend-state + `graphify update .`).

## 7. Risks & open decisions

1. **FF-1 is now the fattest phase** (instance-aware evaluation ≈ half its engine work — PO
   chose this knowingly, ruling 8). Watch for scope creep into nesting depth; the ADR may cap
   nesting at 1 without violating any ruling.
2. **FF-3's deadlock test space is large** (hidden × required_if × per-instance × warn/error);
   every wrong cell is pilot-blocking. Budget tester time accordingly.
3. **FF-5's picker/door tension** (audit-spam vs PHI exposure) is an authz design problem —
   settle it in the ADR before any UI work; consult the 0078 handoff lessons (§7).
4. **FF-4 release valve:** if the program runs long, FF-4 is the only phase whose deferral
   would not strand another phase's work — flag to the PO before invoking; it re-opens ADR 0086
   ruling 2 (pilot gating).
5. Suite-health baseline (~flaky reds on `e2e:prod`) predates this program — triage against the
   baseline before calling regression (memory `e2e-prod-build-flaky-baseline`).

---

**Bottom line:** five sequential gated phases on the shipped F3 bones — engine-first (FF-1),
types before validators (FF-2 → FF-3), the PHI-touching selector next (FF-5), authoring reuse
last (FF-4) — every writer a DEFINER door, every evaluator change parity-locked, everything dark
behind its flag until its gate, and one pilot deploy after the last gate.

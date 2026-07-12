# F3 — Flexible-Forms Foundation (ADR 0060) — durable record

**Status:** ✅ COMPLETE — human-approved 2026-07-12. Branch `feat/f3-flexible-forms` → merged `main`.
Phase of the [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md)
(F0 → F1 → F2 → ~~16 (deferred)~~ → **F3** → F-cleanup → pilot). Structural, **no feature flag**,
reset-OK, forward-only. **Backend-led** (no frontend teammate). ADRs
[0060](../decisions/0060-flexible-forms-foundation.md) + [0065](../decisions/0065-pre-pilot-foundations-conventions.md).

## Sequencing note
The PO **deferred Phase 16** (Standards Crosswalk — needs replanning) on 2026-07-11 and elected to run F3
now. Sanctioned by the program (§3/§8: *"F3 may move earlier — no dependency forces it after 16"*); F3
depends only on F0 + F1 (the `answer_references.participant_id → participants` bridge). Phase 16 stays 🔜.

## What shipped (create-now bones + frozen inert answer set + the one live feature)
Migrations `20260718000000_flexible_forms_bones.sql` / `…000100_flexible_forms_answer_shapes.sql` /
`…000200_flexible_forms_operators.sql`:

- **item_type widen 10 → 15** — `group` / `repeating_group` / `matrix` / `risk_matrix` / `reference`, inert.
  On **BOTH** constraints (`form_items_item_type_check` value-enum + `form_items_input_vs_display` shape:
  answerable arm for `matrix`/`risk_matrix`/`reference` [`question_key NOT NULL`], container arm for
  `group`/`repeating_group`; `required=false` forced ⇒ **Flag-5 by construction**; `ELSE false` still
  rejects garbage).
- `form_item_options.is_exclusive` (default false) + `risk_weight` (nullable).
- `form_versions.behavior_config` jsonb (+ object-shape CHECK); **`clone_form_version` carries it** + the
  two option cols (Rule 5 — QA-verified no-regression vs the prior authority).
- `response_group_instances` `UNIQUE NULLS NOT DISTINCT (response_id, group_item_id, parent_instance_id,
  position)` (position-uniqueness shape only; write RPCs → FF-1).
- Inert `form_item_validations` (minimal shell, open `rule_type text`; freeze-principle note for FF-3).
- **5 frozen inert answer tables** — `form_matrix_rows` / `_columns` (version-scoped, clone-stable `code`),
  `answer_matrix_cells` / `answer_risk_matrix` / `answer_references` (off `answer_id`;
  `answer_references.participant_id → participants` **id-only** + `reference_kind` CHECK). **RLS from
  creation, scoped-read + write-inert (K9)**, no `*_snapshot` cols.
- **The one live feature — 4 evaluator operators** `contains` / `not_contains` / `is_empty` /
  `is_not_empty` in `app.eval_condition` (SQL) + `evalCondition` (TS), byte-for-byte mirror. Semantics
  (Rec D): `contains` = array-membership OR text-substring (case-sensitive), else false, no number→text
  coercion; `is_empty` = unary, empty iff absent / null / `''` / `[]`. **Non-authorable** (storage
  validators + builder pickers UNCHANGED; only the 3 `OP_LABELS` maps gained labels). `is_true`/`is_false`
  NOT added. `app.eval_condition` stays IMMUTABLE + `search_path` pinned.
- Rec-A `question_key`→aggregation contract → `docs/design/f3-question-key-aggregation.md` (explode
  repeating-groups by child key; cell = `(key, row_code, col_code)`; risk_matrix derived scalar +
  severity/likelihood; reference aggregates on `participant_id` never label; all on clone-stable codes/ids).
- Docs: ARCHITECTURE §2 (item types 10→15 etc.) + `docs/backend-state.md` reconciled; ADR 0045/0046 headers
  already accepted (no-op). `responses.supersedes_id` = **forward-note only** (not a column; coupling
  pinned: the future correction ADR must land the column **and** the dashboard aggregation-exclusion
  retrofit atomically).

## Green bar
tsc **0** · Vitest **356** (parity `conditions.test.ts` 81/81) · full ordered pgTAP **2023** (78 files; new
`209_flexible_forms` **38/38** + extended `20_conditions.sql`) · real `next build` ✅ · F3 files lint clean.

## Test verdict (tester) — E2E GREEN, 0 F3 regressions
Full prod-standalone gate (local, `node .next/standalone/server.js`, workers=1): **632p / 6f / 4s / 31dnr**
(22.5 min). All 6 failures triaged (3 targeted fresh-reset re-runs), none on F3's surface:
- case-access AC-2 · ui-batch S1 · views-labels AC-4 (=9 members isolated) · perf-sweep P2-b →
  **contamination/flake**, pass in isolation.
- nsp-per-hospital AC-1b / AC-5 → **pre-existing `networkidle` spec-fragility** (route untouched by F3;
  30/32 nsp pass).
- The 31 did-not-run = serial-`describe` siblings that pass once the blocker clears.
Bugs filed (OPEN, non-blocking, NOT F3): **BUG-F3E2E-001** (nsp networkidle), **BUG-F3E2E-002**
(contamination + Windows monolith backlog-collapse).

## QA verdict — ✅ APPROVED (0 B / 0 M / 0 m / 4 INFO)
[phase-F3-review.md](../reviews/phase-F3-review.md). QA **live-verified**: evaluator parity on the 9
trickiest vectors; `is_valid_visibility('contains'/'is_empty')` = false (non-authorable); the K9 write-inert
`has_table_privilege` matrix on all 6 inert tables; `clone_form_version` no-regression; both item_type
constraints widened.

### 4 INFO forward-notes (hand to backend when the FF phases start — NOT this gate)
- **INFO-1 (FF-2/FF-3):** extend `clone_form_version` to copy the version-scoped inert definition tables
  (`form_matrix_rows`/`_columns`, `form_item_validations`) once they add writers — vacuous now
  (inert/empty), latent Rule-5 gap later.
- **INFO-2 (FF-5):** wire PHI-read auditing when activating the `answer_references` reader (a reference can
  resolve to a patient participant; today's SELECT policy is the answer-table default, not a PHI door).
- **INFO-3:** SQL↔JSON golden-vector parity is a manual byte-for-byte discipline with no automated
  cross-file diff (pre-existing convention; both currently identical + green).
- **INFO-4:** `answer_matrix_cells` cross-item coherence deferred to the FF-2 writer/trigger (correct,
  write-inert).

## Gotchas / notes
- **`is_org_admin_of_commission` → `is_commission_admin_of`** trap hit + fixed (F2 tripped it too) — memory
  `rls-helper-is-commission-admin-of`.
- **Pre-existing broken lint gate** (`npm run lint` = bare `eslint` whole-repo → 6224 errors, all
  `e2e/`+tests; F3 files clean) — NOT F3; chipped for separate work.
- **Remote deploy DEFERRED** to the pilot reset (F3's `answer_references` FK needs F1's `participants`; all
  foundations land as one remote `db reset --linked` at pilot — same posture as F1/F2).
- Verified-fact deltas: SQLSTATE high-water HC098; F3 migration window `20260718000000+`.

## Deferred (post-pilot FF roadmap — each its own ADR + flag + gate)
FF-1 repeating groups (write RPCs + resume) · FF-2 matrix & risk matrix · FF-3 validation engine · FF-4
power authoring · FF-5 entity reference (+ the INFO-1/INFO-2 wiring). The correction/`reopen` engine
(Gap 38), calculations, and i18n remain forward-notes (freeze principle).

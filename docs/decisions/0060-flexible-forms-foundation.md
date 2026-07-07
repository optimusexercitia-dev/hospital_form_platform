# 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)

**Date:** 2026-07-07 · **Status:** accepted · **Extends:** ADR
[0045](0045-answer-model-v2.md) (Answer-Model v2), ADR
[0046](0046-forward-compat-form-capabilities.md) (forward-compat contract), ADR
[0040](0040-form-builder-enhancements-condition-engine.md) (condition engine).
**Binding rules:** Rule 3 (one evaluator, mirrored SQL↔TS, no drift), Rule 5/6
(published + storage immutability), Rule 1 (RLS), Rule 10 (pt-BR), Rule 11 (audit),
Rule 12 (PHI isolation).

## Context

A partner group circulated a very general Supabase forms/answers data model. A
feature-gap review enumerated **45 capabilities their model allows that ours does not
(fully)**. The question this ADR settles is **not "reach parity"** — it is *which* of the
45 are worth adopting, and how to keep the database **prepared to grow** into the valuable
ones without a painful retrofit, while preserving the platform's deliberate strengths
(typed integrity, a hardened mirrored SQL↔TS evaluator, immutable published versions,
minimum-necessary PHI).

Two facts frame the decision:

- **The hooks already exist.** ADR 0045/0046 (built 2026-07-01) already landed the
  uniform `answers` row keyed `(response, item, instance)`, `answer_selected_options`
  on `answer_id`, the inert `response_group_instances` + `answers.group_instance_id`,
  `form_items.parent_item_id`, typed `value_number/date/time`, a reserved
  `answers.confidentiality_level`, and normalized `form_item_options`. ADR 0046 shipped an
  explicit *"hook now / build later"* contract. Most partner ideas therefore land on
  existing bones.
- **Pre-pilot, no live users.** Only Phase 16 remains before the pilot; additive/
  structural schema is cheap now and expensive after real data exists (the exact logic
  that justified Answer-Model v2). "Prepare now, build later" is nearly free here.

Decisions were taken in a structured interview with the product owner (2026-07-07).

## Decision

### 1. Disposition of all 45 gaps

Legend — **NOW**: lands in the pre-pilot Flexible-Forms Foundation phase · **LATER**:
committed post-pilot UX phase, DB prepared now · **RESERVE**: design/hook only, no
committed phase · **DROP**: not adopting · **HAVE**: already shipped.

| # | Feature | Verdict |
|--|--|--|
| 1 | data-driven `question_types` catalog | DROP — keep the CHECK enum, widen per feature |
| 2 | semver major/minor/patch | DROP |
| 3 | `in_review`/`deprecated` version status | DROP — no publish-approval gate for forms |
| 4 | scheduled publication (`effective_*`) | DROP |
| 5 | layout mode (classic/wizard/conversational) | DROP |
| 6 | per-version `theme_config` | DROP — design system is global |
| 7 | per-version `behavior_config` | **NOW** — reserve `form_versions.behavior_config` jsonb |
| 8–10 | section collapsible / color / icon / columns | DROP — cosmetic |
| 11 | block width / responsive grid | DROP |
| 12 | block kinds `divider`/`media` | DROP — `section_text`/`image` cover |
| 13 | nested blocks / groups | LATER — rides with repeating groups (`parent_item_id` exists) |
| 14 | **repeating groups** | LATER (FF-1) — storage SHAPE + position-uniqueness constraint NOW; write RPCs + resume + builder/wizard in FF-1 (Rec C) |
| 15 | file upload | DROP — PHI-attachment surface not adopted (see Alternatives rejected) |
| 16 | signature answer | DROP — existing meeting/document e-sign covers medicolegal |
| 17 | **matrix / grid** | LATER (FF-2) |
| 18 | **risk matrix** | LATER (FF-2) |
| 19 | **entity reference** | LATER (FF-5) — but dept/committee/user selectors are high-frequency + high-analytics-value; may warrant earlier sequencing (Rec) |
| 20 | `rich_text` answer | DROP — plain `free_text` stays |
| 21 | per-item validation table | LATER (FF-3) — table landed NOW inert |
| 22 | regex / pattern validation | LATER (FF-3) |
| 23 | file_type / file_size validation | DROP — depended on file upload (dropped) |
| 24 | min/max items (group cardinality) | LATER (FF-1) |
| 25 | unique_within_group / datetime_order | LATER (FF-3) |
| 26 | validation severity levels + messages | LATER (FF-3) — incl. warn-don't-block |
| 27 | `required_if` | LATER (FF-3) — **touches the `submit_response` completeness authority (Rule 3), not just validation**: relaxing the conditional-not-required CHECK must be co-designed with the evaluator + submit RPC (a hidden-but-required item must stay skipped, never deadlock submission) |
| 28 | dynamic defaults | LATER (FF-4) |
| 29 | default-value priority chains | LATER (FF-4) |
| 30 | multi-condition AND/OR | HAVE (flat `{match, conditions}`) · nested = DROP |
| 31 | generic logic→actions engine | DROP — ADR 0046 stance holds |
| 32 | operators `contains`/`is_empty`/… | **NOW** — dual-evaluator expansion |
| 33 | calculated fields | LATER (FF-4) |
| 34 | option `is_exclusive` + `risk_weight` | **NOW** — cheap columns on `form_item_options` |
| 35 | i18n / translations | DROP — Rule 10, pt-BR only |
| 36 | reusable block/question library | LATER (FF-4) — but its value is accreditation *standardization* (cross-committee stable keys → coherent aggregate analytics + ONA/JCI evidence), higher than "power authoring" implies; reconsider elevating (Rec) |
| 37 | persisted form-lint results | RESERVE — builder quality gate, low priority |
| 38 | submission review workflow states | DROP — case phases + sign-offs cover it · **but see Open gap note** (standalone-submission correction) |
| 39 | per-answer revision history | DROP — before/after answer diffs would re-ingest PHI/free-text into a *second* store (contradicts Rule 11 payload-minimization + the PHI-disposal model); audit-that-it-changed suffices |
| 40 | answer-time snapshots | DROP — ADR 0045 already rejected these |
| 41 | materialized section-completion state | RESERVE — add only if long forms need the perf |
| 42 | draft snapshots (offline) | DROP — no offline roadmap |
| 43 | offline idempotency (`client_generated_id`) | DROP — no offline roadmap |
| 44 | generic submission context links | DROP — `case_phase_id` stays the only link |
| 45 | extra typed answer columns | HAVE (`value_number/date/time`) · boolean/datetime + materialized display = DROP |

### 2. The pre-pilot phase (`flexible-forms`, structural, no feature flag)

Lands **before the pilot reset** so the pilot DB carries the bones; independent of Phase
16 (does not gate it). **Sequencing (confirmed 2026-07-07):** built **after Phase 16,
before the pilot reset** — ADR 0057's committed pre-pilot order (Phase 16 next) stands;
this additive foundation slots cleanly after it. Additive/forward-only migrations;
pre-launch reset-OK (design the correct schema, no back-compat migrations). **Create-now**
scope:

- **Type space:** widen the `form_items.item_type` CHECK to reserve `group`,
  `repeating_group`, `matrix`, `risk_matrix`, `reference` (inert per type until
  its Layer-2 phase). Keep the **CHECK-enum** approach — no data-driven catalog.
- **Cheap columns:** `form_item_options.is_exclusive` (server-enforced clear-others) +
  `risk_weight`; `form_versions.behavior_config` jsonb (reserved — a staging area, **not** a
  permanent untyped bag: anything promoted OUT of it later earns a typed column/contract, Rec F).
- **Evaluator operators (the one live feature):** add `contains`, `not_contains`,
  `is_empty`, `is_not_empty` to `app.eval_condition` **and** `evalCondition`, with extended
  shared vectors + golden/parity test. **Pin the polymorphic semantics (Rec D):** `contains`
  is substring-on-text vs membership-on-choice-array (distinct from `equals`); `is_empty`
  fixes null / absent-key / `''` / `[]` identically SQL↔TS. Parity vectors must cover **each
  operator × each answer value_type**, not each operator once — and **every future field type
  (FF-1/FF-2/FF-5) that adds a value shape must re-extend the operator × value_type matrix**,
  or it silently reintroduces drift. Condition vocabulary only — `visible_when` stays
  **visibility-only** (no action vocabulary).
- **Repeating-group schema shape only (Rec C — RPCs deferred):** the durable bones already
  exist from ADR 0045/0046 (`response_group_instances`, `answers.group_instance_id`,
  `form_items.parent_item_id`, RLS + immutability). Land **only** the cheap schema piece that
  is expensive to add post-data — **position-uniqueness within a parent**. The behavioral
  `add/remove/reorder_group_instance` RPCs + `save_section_answers`/resume plumbing **move to
  FF-1**, where the wizard co-designs and E2E-exercises them; they gain nothing from shipping
  now with no consumer and no test path (this codebase repeatedly ships such code
  green-then-broken). Flat-form `answer_map` stays byte-identical throughout (Rule 3).
- **Reserve-now inert table:** `form_item_validations` (unread until FF-3).

**Calibration:** *create-now* only where landing pre-pilot buys real value (a stabilizing
enum, a cheap column on a live table, a high-value low-risk evaluator feature, or a
security surface far cheaper to design + QA on an empty DB). Everything else is
**ADR-reserved** and built additively in its own phase — exactly ADR 0046's model.
ADR-reserved: `form_matrix_rows`/`columns` + `answer_matrix_cells`, `answer_risk_matrix`,
`answer_references`, `form_calculations`, `block_library_items`/`options`, dynamic-default
rules.

### 3. Deferred UX roadmap (post-pilot, each its own gated, feature-flagged phase)

FF-1 Repeating Groups (`repeating_groups`) — incl. the group-instance write RPCs + resume
plumbing moved here from create-now (Rec C) · FF-2 Matrix & Risk Matrix (`matrix_fields`) ·
FF-3 Validation Engine (`item_validations`) · FF-4 Power Authoring — reusable library +
dynamic defaults + calculated fields (`power_authoring`) · FF-5 Entity Reference
(`entity_refs`). Sequenced by domain value; each gets its own ADR (0061+). *(File-upload
answers were considered and dropped — see Alternatives rejected.)*

### 4. Cross-cutting design invariant (Rec A) — `question_key` aggregation for the new field types

The platform's dashboards + Phase-15 derived indicators aggregate by a **stable scalar
`question_key`** across versions. Every committed field type breaks the "one key → one scalar
answer" assumption and needs an explicit aggregation/addressing convention **before its
answer-storage lands**:

- **repeating group** — N instances per key (counted? exploded? latest-only?);
- **matrix / risk matrix** — addressed by (row × col) / (severity × likelihood), not one key;
- **entity reference** — the aggregatable value is a foreign id, not the label.

This is a **prerequisite design deliverable** for FF-1/FF-2/FF-5 and for finalizing the
ADR-reserved shapes (`answer_matrix_cells`, `answer_risk_matrix`, `answer_references`): each
type's answer table must not be created until its `question_key` aggregation is settled and
checked against the indicator/dashboard engine. It is **not** a blocker on the pre-pilot
enum/column migration (which freezes no complex answer shape), but it **is** the highest-value
open design question and must precede the reserved-shape work rather than being retrofitted
against real data — the same cost logic that justified Answer-Model v2. Snapshots (Gap 40)
stay rejected; the aggregation model resolves against the immutable version instead.

## Alternatives rejected

- **Data-driven `question_types` registry** — conflicts with the platform's typed
  integrity and the hardened evaluator/immutability invariants; the "flexibility" goal is
  already met by the existing anchor + scaffolding, not a dynamic catalog.
- **Generic logic→actions engine** (`set_value`/`jump_to`/`calculate`/`block_submission`)
  — reaffirms ADR 0046: would fragment hardened workflow logic. `visible_when` stays
  visibility-only.
- **Signature-as-answer** and **rich_text** — the meeting/document e-sign already gives
  medicolegal signatures; `free_text` is sufficient. Not worth the surface.
- **File-upload / PHI-attachment answers (`answer_files`)** — dropped entirely. A file
  field on *any* form is a broad PHI ingress that would turn the whole form engine into a
  potential PHI store, drifting the Rule 12 invariant that PHI lives only in a fixed,
  enumerated set of tightly-scoped modules, and it needs a minimum-necessary policy the
  generic form engine cannot express. Committee evidence attaches through the
  controlled-document / evidence-link layer instead.
- **`is_true` / `is_false` operators** — dropped from the NOW operator set: the platform
  has no boolean answer type, so they would have no well-defined operand (yes/no is a
  single-option choice, matched by `equals`).
- **Submission review-workflow states, per-answer amendment trail, answer-time snapshots,
  offline snapshots/idempotency, i18n/translations, nested condition groups, field-level
  confidentiality activation** — each dropped or left reserved (see the table) as not
  earning its cost for this deployment.

## Consequences

- The 45-gap question is settled and the DB is prepared for the four committed field
  types (repeating groups, matrix, risk matrix, entity reference) without further
  pre-pilot churn.
- With `answer_files` removed, the Flexible-Forms Foundation introduces **no new PHI
  surface** — Rule 12's enumerated PHI-module set is unchanged.
- Pre-pilot scope is schema-shape-only for repeating groups (Rec C: write RPCs → FF-1), and
  the `question_key` aggregation model (Rec A) is a prerequisite for each field-type FF phase —
  neither is built against real data, keeping the guarded surfaces (evaluator, submit
  authority) untouched until co-designed with a real consumer.
- ADR 0045 and 0046 status headers are corrected to **accepted/implemented (2026-07-01)**;
  ARCHITECTURE.md §2 is reconciled with shipped reality (10 item types, `visible_when`
  AND/OR shape, `form_item_options.flagged`/`is_other`, length bounds, flagged/aggregate
  result criteria).
- The evaluator remains the single most guarded surface: operator work is gated by the
  golden parity test; drift is phase-blocking.

## Open gap (deferred) — standalone-submission correction

The Gap 38 DROP ("case phases + sign-offs cover it") holds for case-wrapped forms, but
**standalone submissions** (`case_phase_id IS NULL` — routine audits, checklists,
self-assessments) have **no controlled correction path**. A submitted response is
hard-immutable (`guard_submitted_response`/`_children`/`_selections` block UPDATE + DELETE)
and there is **no `reopen_response`**, even though the platform ships governed `reopen_*`
flows for six other object types (meeting, interview, rca, capa_plan, triage, narrative).
The only recourse — refill — creates a *new* `submitted` row indistinguishable from a
legitimate new-period submission (multiple submitted rows per version/user are allowed by
design; only in-progress drafts are unique). Dashboards + Phase-15 derived indicators
aggregate submitted answers by `question_key`, so a wrong figure and its "correction"
**both count**, corrupting the metric with no in-system remedy.

This is separable from the Gap 39 DROP (per-answer revision history stays dropped — it would
re-ingest PHI/free-text): a governed correction needs only a controlled *state transition*
(who/when/reason), not answer-level diffs. It's also an ALCOA+ nuance — immutability is not
the same as *controlled correctability*, which accreditation expects.

**Not adopting the partner's 6-state review FSM.** The minimal fix, deferred to its own
small ADR/phase: either **(a)** a `reopen_response` RPC (staff_admin/coordinator-authorized,
standalone-only, audit-logged with a reason, `submitted → in_progress`) mirroring the
existing `reopen_*` pattern, or **(b)** an explicit `supersedes` link with
supersession-aware aggregation. Flagged here so it is not mistaken as covered; **tackle
post-note.**

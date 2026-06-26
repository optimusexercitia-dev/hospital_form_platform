# 0043 — Result-based phase recommendation (combinable `recommend_when`)

- **Status:** Accepted (2026-06-26)
- **Supersedes/extends:** ADR [0017](0017-multi-phase-cases.md) (`recommend_when`),
  building on the `case_phase_results` feature (per-phase result + manual mode) and
  ADR [0040](0040-form-builder-enhancements-condition-engine.md)'s AND/OR group shape.

## Context

A template phase can already be **auto-recommended** from an EARLIER phase's
**answer**: a single `recommend_when = { from_phase, question_key, op, value }`,
evaluated by `recompute_recommendations` via the shared `app.eval_condition`,
flipping the pending case-phase's `recommended` flag (a *suggestion* —
coordination still activates). Separately, a phase may **emit a result** (a
per-commission `phase_results` option, `emits_result` + `allowed_result_ids`,
landing in `case_phases.result_id` at conclude time).

We want a phase to also be recommendable from an EARLIER phase's **result**.

## Decision

`recommend_when` becomes a **combinable group** of conditions; each condition
reads either an answer (as today) or a prior phase's result. Recommendation
stays a pure suggestion (only the `recommended` flag; no auto-activate, no
gating).

### Contract (`recommend_when`)

Stored on `process_template_phases.recommend_when`; snapshotted verbatim onto
`case_phases.recommend_when` at case creation (unchanged mechanism).

- **Legacy single (answer)** — still valid, read as `source:'answer'` (no data
  migration): `{ from_phase, question_key, op, value }`.
- **Group** (what the editor emits, even for one row):
  `{ match: 'all' | 'any', conditions: [ Cond, … ] }` (non-empty).
- **Cond** is one of:
  - Answer: `{ source?: 'answer', from_phase, question_key, op, value }` — ops/value
    exactly as today (choice + ordered).
  - Result, specific: `{ source: 'result', from_phase, op, value }` —
    `op ∈ equals | not_equals | in`; `value` = a `phase_results` **id** (string)
    or ids (string[]).
  - Result, adverse: `{ source: 'result', from_phase, adverse: true | false }`.

All new expressiveness lives **inside groups**; the top-level single shape stays
answer-only (minimizes the CHECK surface). Result `value`s are option **ids**
(uuids — stable across renames/archival). Answer- and result-conditions may be
**mixed freely** in one group.

### Evaluation — zero evaluator drift (Architecture Rule 3)

`recompute_recommendations` is generalized to walk a group: per condition,
resolve `from_phase` → source case-phase, then evaluate via the **UNCHANGED**
`app.eval_condition`:

- **answer** → over the source's submitted answer map (as today);
- **result-specific** → over a synthetic map `{ <key>: result_id }` (key **absent**
  when no result), condition `{ question_key:<key>, op, value }`;
- **result-adverse** → `equals` over `{ <key>: <is_adverse bool> }` (absent when no
  result).

Fold with `all`→AND / `any`→OR. `app.eval_condition` / `evalCondition` and the
shared vector fixtures stay untouched; a TS mirror (`evalRecommendation`) drives
the editor preview.

**No-result semantics** (source not concluded, skipped `nao_necessaria`, or
concluded without landing on a result) = identical to answers: `equals`/`in`/
`adverse:true` → false; `not_equals` → true (the warned footgun); `adverse:false`
→ false until a real non-adverse result exists.

### Triggers

Recompute already runs on conclude/submit, activate, skip, create. **Added:**
`set_case_phase_result_override` re-runs `recompute_recommendations(case_id)` after
it changes/clears a concluded phase's effective result (closes a staleness gap the
feature introduces).

### Validation (`validate_template_recommend_when`, now group-aware)

Normalize single|group → flat conditions; per condition: `from_phase` earlier
(`< position`) and exists; answer → key exists in source's published version
(existing); result → source slot has `emits_result = true` AND every referenced id
∈ that slot's `allowed_result_ids` (non-archived, in-commission). Enforced at
add/update/publish. New HC0xx SQLSTATE(s) for result-condition violations.

### Flag & scope

`case_phase_results` off → the editor hides the result-source option; the backend
**tolerates** result-conditions (they no-op, since `result_id` stays null). No hard
rejection. Suggestion-only contract is unchanged.

### Delivery

One **additive, forward-only** migration: widen
`process_template_phases_recommend_when_shape` and `case_phases_recommend_when_shape`
to a superset (like `visible_when_shape`), `CREATE OR REPLACE`
`validate_template_recommend_when`, `recompute_recommendations`, and
`set_case_phase_result_override`; regen `database.ts`. Apply locally via
`supabase migration up`; the human runs `supabase db push` to remote. pgTAP +
evaluator coverage + E2E.

## Consequences

- `+` Expressive cross-phase routing ("recommend remediation when Phase 3 = adverse,
  or Phase 2 answer = Reincidente") with no change to the shared evaluator.
- `+` No data migration: legacy single rows + existing snapshots remain valid.
- `−` `recommend_when` CHECK grows to a superset; the editor is rebuilt from a
  single-condition form into a group builder (mirrors `condition-builder.tsx`).
- `−` `not_equals` over a missing result keeps the documented footgun (warned).

## Alternatives rejected

- **One source per phase (answer XOR result)** — simpler, but loses cross-source
  combinations, the main reason to combine.
- **Severity ordering of results (gt/lt by `position`)** — deferred; id-keyed
  vocabulary makes ordered semantics fragile under reorder/archival.
- **Treat result-conditions as "undecided until concluded"** — diverges from the
  established answer-condition missing-value semantics and muddies OR groups.

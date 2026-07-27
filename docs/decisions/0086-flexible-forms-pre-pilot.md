# 0086 — Flexible-Forms feature phases FF-1…FF-5 pulled pre-pilot

**Date:** 2026-07-27 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Scope: re-sequencing + bounded scope deltas** — no new feature design. Each FF phase keeps its
own just-in-time ADR (numbered at authoring time, 0087+ expected), feature flag, and Phase Gate
(CLAUDE.md §6). This ADR supersedes the **timing** of ADR
[0060](0060-flexible-forms-foundation.md) §3 ("Deferred UX roadmap (post-pilot…)") and the
"FF-1…FF-5 stays post-pilot" out-of-scope line in the ADR-0071
[release plan](../plans/pre-pilot-release-scope-expansion.md) §0.
**Implemented by:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md).

## Context

ADR 0060 (2026-07-07) settled the 45-gap partner forms-model review as "bones now, feature UX
post-pilot"; phase F3 shipped the bones 2026-07-12 (widened `item_type` enum, the frozen K9
write-inert answer/definition tables, `behavior_config`, the 4 dual-evaluator operators, the
ratified `question_key` aggregation contract). With S0–S5 of the ADR-0071 release program complete
(ETH·E3a closed 2026-07-27), the pilot deploy was the only remaining pre-pilot item. The PO has
now decided (2026-07-27, grilling interview) that the forms feature UX ships **before** the pilot.

## Decision

All **five** FF phases build pre-pilot, in this order, each its own gated + flagged phase:

| Order | Phase | Flag | Scope vs ADR 0060 §3 |
|---|---|---|---|
| 1 | **FF-1 Repeating Groups** | `repeating_groups` | As committed (write RPCs + resume plumbing + builder/wizard) **plus** instance-aware condition evaluation (ruling 8 below) |
| 2 | **FF-2 Matrix & Risk Matrix** | `matrix_fields` | As committed; discharges INFO-1 (matrix half) + INFO-4 |
| 3 | **FF-3 Validation Engine** | `item_validations` | As committed **incl. `required_if`** (Gap 27); also owns making the 4 F3 operators authorable; discharges INFO-1 remainder |
| 4 | **FF-5 Entity Reference** | `entity_refs` | **Widened**: 3 lanes — participant (+ INFO-2 PHI-read audit door) + commission + user/profile |
| 5 | **FF-4 Power Authoring** | `power_authoring` | **Trimmed**: reusable block/question library + dynamic defaults only; **calculated fields stay post-pilot** (`form_calculations` stays ADR-reserved) |

The PO rulings (2026-07-27 interview):

1. **FF-1 is included** — not only the four phases first named.
2. **All five gate the pilot deploy** — one remote deploy (origin push + Coolify + remote
   `db push`/reset) after the last (FF-4) gate; the pre-launch **reset-OK window stays open** for
   the whole program.
3. **Order FF-1 → FF-2 → FF-3 → FF-5 → FF-4** — field types before the validators that target
   them; the two riskiest surfaces (wizard/resume, submit authority) land earliest and bake
   longest; FF-4 last so the library can contain every shipped type.
4. **Required-capable per phase** — FF-1/FF-2/FF-5 each relax their arm of the F3
   `form_items_input_vs_display` CHECK (`required = false` by construction today) and extend
   `app.response_required_complete` for their type. Supersedes F3's "never-required" freeze
   (pgTAP 209 §B is re-pinned per phase; the deadlock-negative keystones replace it).
5. **FF-5 ships participant + commission + user lanes** (widens `reference_kind` + adds per-lane
   target columns); hospital/org lanes stay deferred.
6. **FF-4 trim** — calculated fields are the one ADR-0060 §3 commitment that stays post-pilot.
7. **`required_if` confirmed in FF-3** — co-designed with the evaluator + `submit_response`
   completeness authority (Rule 3), per ADR 0060 Gap 27's warning.
8. **Instance-aware condition evaluation builds in FF-1** — a condition inside a repeating group
   may reference a same-instance sibling answer; both evaluators gain an instance-aware answer
   map + golden vectors. This does **not** alter the ratified aggregation contract (explode by
   child `question_key`; `group_instance_id` stays out of the aggregation key) — it adds
   condition-evaluation capability only. FF-3's `required_if` inherits per-instance semantics.

## Sequencing & dependencies (lead schedules; detail in the program plan)

Strictly sequential, one Phase Gate each; FF-1 lands the dispatch-by-`item_type` refactor of
`app.response_required_complete` so later phases add arms only; FF-2 extracts the shared
deep-copy helper from `clone_form_version` (INFO-1) that FF-3/FF-4 reuse. Phase 16 (deferred),
ETH·E3b, and the BUG-AIF-001/FUP-AI-1 workstream are independent of this program and keep their
own standing.

## Consequences

- The pilot ships materially later — after FF-4's gate + the pilot deploy. PROGRESS.md
  "Remaining pre-pilot work" is re-baselined accordingly.
- Five per-phase ADRs are still to author (just-in-time at each phase start); the flags above are
  the ADR-0060 §3 reserved names, seeded OFF per the two-migration convention.
- The F3 QA forward-notes INFO-1/INFO-2/INFO-4 become in-scope obligations of FF-2/FF-3/FF-5.
- Every phase that adds a value shape re-extends the operator × value_type golden-parity matrix
  (ADR 0060 §2 — drift is phase-blocking).
- No change to the Phase Gate, to Rules 1–12, or to any shipped surface's design.

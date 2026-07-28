# 0091 — FF-5 Entity Reference: three lanes, hybrid participant scoping, and why INFO-2 needs no PHI door

**Date:** 2026-07-28 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Phase:** FF-5, the fourth of the five feature phases ADR
[0086](0086-flexible-forms-pre-pilot.md) pulled pre-pilot. **Flag:** `entity_refs` (seeded OFF;
flipped by its own enable migration at the FF-5 gate).
**Implements:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-5.
**Builds on:** ADR [0060](0060-flexible-forms-foundation.md) (F3 substrate — the frozen
`answer_references` table) · ADR [0064](0064-case-subject-generalization-participants.md) /
[0065](0065-pre-pilot-foundations-conventions.md) (F1 — the participants registry, the **Q4
surrogate ruling** this ADR turns on, and the §7 reference→participants bridge) · ADR
[0087](0087-ff1-repeating-groups.md) (instance engine + the **P0-1 correction-copy trap**) · ADR
[0089](0089-ff2-matrix-risk-matrix.md) (**door-parity rule**; the shared deep-copy helper) · ADR
[0090](0090-ff3-validation-engine.md) (`required_if`; the completeness authority) · ADR
[0078](0078-authorization-capability-model.md) / [0079](0079-authz-door-blindness-standing-invariant.md)
(a DEFINER gate *replaces* RLS; keystone discipline).

## Context

F3 froze `answer_references` on 2026-07-12 as a one-lane (`participant`), write-inert table and
left FF-5 two obligations: widen it to the three lanes ADR 0086 ruling 5 committed to, and
resolve **INFO-2** — the F3 QA forward-note asking whether reference reads need PHI-read logging.

A live-catalog audit at phase start — **225/225 migrations registered**, max version
`20260901000800` matching the last file on disk; read from `pg_proc` / `pg_policies` /
`pg_constraint` / `information_schema.role_table_grants`, never from migration text (CLAUDE.md
§graphify exception) — establishes the substrate below and **corrects the program plan on its
central premise for this phase** (ruling 1).

## Substrate (live catalog, 2026-07-28)

`answer_references` — `id`, `answer_id → answers on delete cascade`, `reference_kind text not
null default 'participant'` CHECK`(in ('participant'))`, `participant_id → participants on delete
restrict`, `created_at`; one CHECK `answer_references_participant_shape`. One policy,
`answer_references_select`, carrying **only the base arm** (creator / commission-admin /
submitted+staff_admin) — it is missing the `can_read_correction_response` and
`can_access_targeted_response` arms its siblings `answer_selected_options` and
`answer_matrix_cells` carry. That is verbatim FF-2's QA r1 **B-2**; FF-5 lands the parity in the
same wave as its writer rather than discovering it at review.

The three lanes' candidate sources and their **existing** read perimeters:

| Lane | Source table | Live policy | Perimeter |
|---|---|---|---|
| `participant` | `participants` | `participants_select` | `is_org_member(organization_id) OR is_admin()` |
| `commission` | `commissions` | `commissions_select_member_or_admin` | member, org/hospital admin, PQS operator, NSP org admin |
| `user` | `profiles` | `profiles_select_self_or_admin` | self, org/hospital admin, commission admin, **and co-members of any shared commission** |

`authenticated` holds **SELECT only** on all three. `form_items_input_vs_display`'s `reference`
arm currently pins `required = false AND required_if IS NULL` — FF-5 relaxes exactly that arm
(ADR 0086 ruling 4). SQLSTATE high-water is **HC0Q2**; FF-5 allocates from HC0Q3.

### The finding that reframes INFO-2

`participants.display_name` is **non-PHI by construction**, and this is enforced, not merely
documented:

- `set_participant_patient` — the **only** door that creates a `patient` participant — writes the
  literal `'Paciente'`. It never accepts a caller-supplied label.
- An exhaustive `pg_proc` sweep for writers of `participants` returns exactly two functions
  (`set_participant_patient`, `dispose_case_phi`), both SECURITY DEFINER.
- `information_schema.role_table_grants` gives `authenticated` **SELECT only**. There is no path
  by which an app caller sets a patient's `display_name`.
- Raw name / MRN / DOB live solely in `patient_identifiers`, which has **zero RLS policies** —
  fully locked, reachable only through the audited single door. FF-5 never reads it.

Reading a participant reference's label therefore reads **no PHI**. This is the F1 Q4 ruling
working exactly as designed, and it is the premise the program plan got wrong when it wrote
"INFO-2 — PHI-read **audit door** for participant-lane reads" and "Rule 12 module enumeration
updated — the participant lane is a PHI read surface."

The same finding produces a *practical* problem the plan did not anticipate: because every
patient's label is the identical string `'Paciente'`, an org-wide patient typeahead renders as N
indistinguishable rows — useless to the filler, and an enumeration of the org's entire
patient-participant population for no gain.

## Decision

**1. INFO-2 is discharged by analysis, not by a door. FF-5 adds no PHI read surface, and Rule 12
stays at exactly three modules.** The participant lane resolves labels from
`participants.display_name`, which the substrate section proves is a surrogate for patients and
an already-org-readable name for professionals. Building an "audited PHI door" over a non-PHI
read would be security theatre: it would spam the audit chain on every keystroke, train reviewers
to ignore PHI-read entries, and *widen* nothing it claims to narrow. The obligation FF-5 does
carry is the opposite one — **prove** the lane cannot reach PHI, which is a keystone
(`references_never_read_phi`), not a door. This decision **corrects** the program plan §3 FF-5
"Scope (DB)/(engine)" lines and §7 risk 3; ARCHITECTURE.md Rule 12 is **not** amended.

**2. Hybrid participant scoping (PO ruling, 2026-07-28).** The candidate set is scoped per
participant type, not per form:

- `participant_type = 'patient'` → **case-scoped**: candidates come only from the
  `case_participants` of the case owning this response (`responses.case_phase_id → case_phases →
  cases`). Disambiguated by the participant's `case_participant_roles.display_name`. A standalone
  (non-case) response yields an **empty** patient candidate set, and the builder says so.
- every other `participant_type` (`professional`, `external_person`, `department`, `institution`,
  `regulatory_body`, `other`) → **org-scoped**, inheriting `participants_select` unchanged.

Rationale: it is the minimum-necessary reading (Rule 12's own principle) exactly where
minimum-necessary matters, and full-reach everywhere it does not. It also makes the patient lane
*usable*, which org-scoping does not.

**3. Candidate search is INVOKER-rights, never a DEFINER door.** The three lanes' perimeters
already exist and are correct (table above). An invoker-rights search inherits them exactly and
**cannot widen them**. A DEFINER search RPC would *replace* RLS (ADR 0078 A28 / 0079) and would
have to re-derive three perimeters by hand — strictly more surface, strictly more ways to be
wrong, for no capability. The case-scoping in ruling 2 is an additional `exists` **narrowing**
composed on top of the inherited policy, never a substitute for it.

**4. Labels are resolved by live join, never snapshotted.** `on delete restrict` on all three
target FKs (kept from F3, extended to the two new columns) makes a dangling reference impossible,
which is what made snapshotting attractive elsewhere. A snapshot would additionally freeze a
patient surrogate or a renamed commission into an answer row, and — the deciding argument — a
`*_snapshot` column is exactly what the ratified aggregation contract
([f3-question-key-aggregation.md](../design/f3-question-key-aggregation.md), ADR 0060 Gap 40)
rejects. Aggregation keys on the **target id**; the label is presentation.

**5. Conditions on reference answers are deferred to post-pilot.** `equals`/`in` on a target id
is expressible, but it would add a fourth value shape to the operator × value_type matrix and a
new golden-vector dimension in the same phase that adds a lane to four traversals. The lane's
value is capture and aggregation, not branching. Reference answers therefore do **not** enter
`app.answer_map` / `app.instance_answer_map`, and `app.is_valid_condition` is untouched — which
also means Rule 3 parity is *structurally* unaffected by this phase.

**6. `required` is relaxed for `reference`; `required_if` comes with it.** Per ADR 0086 ruling 4,
the `reference` arm of `form_items_input_vs_display` drops `required = false AND required_if IS
NULL`. `app.item_required_satisfied` gains a `reference` arm (satisfied = at least one
`answer_references` row for that answer), and `app.instance_is_empty` gains the matching arm —
without the second, `submit_response` prunes an instance whose only content is a reference and
cascades the reference away. That blindness is structural and was flagged in-code by FF-2.

**7. The correction-copy obligation is discharged with the instance remap.** `answer_references`
hangs off `answer_id` and is copied by **neither** `supersede_response` nor
`start_correction_draft`. FF-5 adds both copy blocks resolving old→new **through the instance
rows** on the preserved `(group_item_id, position)` identity — never by comparing
`group_instance_id` directly, which is unsatisfiable by construction because Amendment 1.3 gives
the successor its own instance rows. This is FF-1's P0-1 verbatim; FF-1's K4 covers selections
only, so nothing existing would have caught a repeat.

**8. Kind↔target is a XOR CHECK, and cross-tenant is a trigger.** Exactly one of
`participant_id` / `commission_id` / `profile_id` is non-null and it must match `reference_kind`.
Tenant containment (the target belongs to the response's own organization) cannot be a CHECK — it
spans tables — so it is a coherence trigger on the writer path, the `reject_invalid_selection` /
`guard_matrix_cell_coherent` precedent.

**9. One target per reference item in v1.** `answer_references` gains `unique (answer_id)`,
mirroring `answer_risk_matrix` rather than `answer_selected_options`' multi-row shape. Multi-target
is a strictly additive widening later: dropping the constraint changes neither the writer's
REPLACE semantics, nor the completeness arm (already "at least one row"), nor the aggregation
(already grouped by target id). Shipping single-target first keeps the picker a typeahead rather
than a multi-select with its own selection-set editing surface, in the phase that is already
adding a lane to four traversals.

## Consequences

- FF-5 is the first FF phase that **shrinks** against its plan entry: no PHI door, no Rule 12
  amendment, no `dashboard.ts` PHI-read note. The plan's §5 "Rule 12 module list at **FF-5**" doc
  obligation is retired by ruling 1 and replaced by the `references_never_read_phi` keystone.
- The patient lane is inert on standalone forms by design. If a commission wants a patient
  reference on a standalone checklist, the answer is to make it a case phase — not to widen
  ruling 2.
- Deferring ruling 5 keeps FF-4's library snapshot simpler: reference config is
  `behavior_config`, with no condition surface to snapshot.

## Gate keystones (all mutation-proven — revert the guard, the keystone must go red)

- `rls_answer_references_reader_non_writer` — direct DML denied for `authenticated` on all three
  lanes; the RPC path writes and audits (K9 preserved).
- `answer_references_door_parity` — the SELECT policy set matches `answer_selected_options`
  arm-for-arm (base + corrector + targeted); a designated corrector and a targeted respondent each
  read their reference.
- `reference_kind_xor_negative` — every off-diagonal (kind vs populated column) rejected; zero and
  two targets rejected.
- `reference_restrict_delete_negative` — deleting a referenced participant / commission / profile
  raises, never cascades an answer away.
- `cross_tenant_reference_negative` — a target outside the response's organization is refused by
  the coherence trigger, on all three lanes.
- `patient_candidates_case_scoped` — a patient participant of *another* case is not a candidate;
  the same participant *is* one from its own case's response. Standalone response ⇒ zero patient
  candidates.
- `references_never_read_phi` — the candidate search and the label resolver touch neither
  `patient_identifiers` nor `professional_profiles` (asserted structurally, over `pg_depend` /
  the resolved query plan, not by grepping the body).
- `completeness_reference_arm` — a required reference blocks submit until answered; **hidden +
  required never blocks** (deadlock-negative), per-instance arm included.
- `instance_not_empty_by_reference` — an instance whose only content is a reference survives
  submit with its reference intact.
- `correction_copies_reference_answers` — a reference survives a correction **by value, on the
  correct instance** (the ruling-7 trap).
- `supersession_references_excluded` — superseded responses drop out of the reference rollup.

## Open questions (deferred, not blocking)

- Conditions on reference answers (ruling 5) — revisit post-pilot with the operator matrix.
- Multi-target reference items (ruling 9) — additive; drop `answer_references_one_target_per_answer`
  and widen the picker. Nothing downstream assumes single-target.
- Hospital / org reference lanes — ADR 0086 ruling 5 defers them; nothing here forecloses them
  (the XOR CHECK and the trigger both extend by one arm).
- Whether a patient reference should be creatable *from* the wizard (it cannot today — the
  participant must already be linked to the case). Deliberately out of scope: creating a patient
  participant is `set_participant_patient`'s coordinator-gated job, not a filler's.

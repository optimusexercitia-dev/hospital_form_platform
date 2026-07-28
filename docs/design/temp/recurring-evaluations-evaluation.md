# Recurring Evaluations — feasibility evaluation + ADR 0086 impact

**Date:** 2026-07-27 · **Author:** platform lead · **Status:** advisory (no decision taken)
**Evaluates:** [recurring_evaluations_database_gpt.md](recurring_evaluations_database_gpt.md)
**Decides on:** whether ADR [0086](../../decisions/0086-flexible-forms-pre-pilot.md) needs adjustment
before FF-1 starts.
**Method:** claims checked against the **live catalog** (remote `azkbbhskturikxpgmafq`), not against
migration files or doc prose (CLAUDE.md §9 binding exception; memory `migration-file-text-stale`).

---

## 1. Verdict

**The feature is a good fit for this platform, and ADR 0086 needs no change to its scope, order, or
five phases.** Recurring evaluations are a *new operational domain* layered above the form engine —
not a re-scoping of flexible forms. They are correctly post-pilot, and they need their own program
and ADR.

**But six forward-constraints should be recorded in ADR 0086 before FF-1 starts.** ADR 0086's own
design is that each phase gets a **just-in-time ADR** where the real decisions are made. Four of
those five ADRs will settle a question that silently forecloses (or cheaply preserves) the
recurring-evaluations design. Recording the constraints now costs a paragraph each; discovering
them at FF-4 costs a redesign of `submit_response` — the single most contended surface in the
program (four phases already edit it).

The proposed model itself is **architecturally sound but schema-fictional**: essentially every
table and column it names does not exist under that name, and three of its recommendations would
violate binding rules if implemented literally.

---

## 2. What the proposal gets right

Credit where due — these are the decisions a naive implementation gets wrong, and it gets all of
them right:

- **§2 — refuses to model daily evaluations as `Case`s.** Correct, and it matches the platform's
  own domain split. A `Case` here carries phases, participants, recusals, decisions, and a
  correction lifecycle; a bed round carries none of that.
- **§16 — separates target generation / occupancy / observation disposition / answer / denominator
  eligibility into five dimensions.** This is the single most valuable idea in the document. The
  "bed 2: no patient" requirement is *not* an answer option, and the doc is right that collapsing
  it into one is what destroys the indicator later.
- **§11.3 — rejects `target_table`/`target_id` generic polymorphism** in favour of typed nullable
  FKs + a shape CHECK. It lands on **ARCHITECTURE.md Appendix A dialect 1** (named-FK + shape
  CHECK) without knowing the platform had already sanctioned exactly that. No new ADR needed for
  the polymorphism.
- **§15.5 — carry-forward is a one-time initialization, never a live re-read.** Correct, and it is
  the reason yesterday's correction cannot silently rewrite today's record.
- **§10/§13 — generation-time snapshot kept distinct from observation-time context.** Correct.
- **§17.2 — refuses a separate "checklist answer" table for the matrix UI.** Correct, and it
  matches the platform's existing philosophy (one answer model, specialized renderers).
- **§14 — stable semantic keys per logical question.** Already shipped: this is `question_key`,
  ratified in [f3-question-key-aggregation.md](f3-question-key-aggregation.md). See §3 below —
  the doc proposes *adding* it, which would be a regression.

---

## 3. Schema collisions (checked against the live catalog)

The document is written against an invented schema. Handed to an engineer verbatim it would
produce migrations against tables that do not exist.

| Doc names | Actually exists as | Note |
|---|---|---|
| `form_definitions` | `forms` | |
| `form_versions` | `form_versions` | ✅ correct |
| `form_instances` | `responses` | |
| `form_answers` | `answers` | |
| `form_question_definitions` | `form_items` | |
| `patients` | `participants` + `patient_participants` + `patient_identifiers` | dialect-3 registry (F1/ADR 0064) |
| `users` | `profiles` | |
| `committees` | `commissions` | |
| `risks` | **nothing** | closest is `capa_plan` / `ethics_findings` |
| `action_items` | `action_items` | ✅ correct |
| `cases` | `cases` | ✅ correct |

Three collisions are more than renaming:

**(a) `hospital_departments` already exists** — and the doc's §6.1 `create table` would collide
with it. Live shape is minimal: `(id, hospital_id, name, position, archived, created_at,
updated_at)` — no `code`, no `department_type`, no effective dating. It is a **label catalog**, and
it is already FK'd: `cases.department_id → hospital_departments(id) ON DELETE SET NULL`. This is
good news (departments are already tenant-anchored to hospital and are the natural root of the
location tree) but the table must be **extended**, not created, and `cases.department_id`'s
semantics must survive the extension.

**(b) `stable_key` already exists as `question_key`.** §15.1 proposes
`alter table form_question_definitions add column stable_key`. The platform has had `question_key`
since Phase 2; it is unique per *version*, preserved across clones by construction (Rule 5), and it
is the **ratified aggregation key** for dashboards and the Phase-15 derived-indicator engine.
Adding a second stable key would fork the aggregation contract. §14 is already satisfied — this is
a **delete-this-section** finding, not an implement-it one.

**(c) `answers` has no revision history.** §3.1 lists "answer revision history" as an existing form
engine responsibility and §25.2 builds a correction model on it. Neither exists. Submitted
responses, their answers, and their sign-offs are **IMMUTABLE, trigger-enforced** (Rule 3).
Correction is by **supersession** — `responses.supersedes_id` (live: index
`responses_one_successor_per_superseded`; flag `response_correction` **ON**). §25.2 should be
restated as supersession-of-response, which the platform already ships, rather than
revision-of-answer, which it deliberately does not.

---

## 4. Rule 12 (PHI) — two hard violations

The proposal would create a **fourth PHI store** and put PHI on a list path. Both are blocked by
Architecture Rule 12.

- **`evaluation_cycle_bed_snapshots.patient_identifier_snapshot jsonb` is the more serious one.**
  That table *is* the bed-matrix read path — the list/grid every evaluator loads. Rule 12 requires
  PHI to be isolated into dedicated tables behind the tightest RLS, **never selected on
  list/aggregate paths**, and readable only through an audited single door. A denormalized
  identifier blob on the grid row is the exact inverse.
- **`patient_encounters → patients(id)`** would be a fourth patient-PHI store alongside
  `event_patient` / `referral_patient` / `patient_identifiers`. Rule 12 enumerates exactly three.

**The platform already has the answer, and it is better than the proposal's.** Flag `patient_index`
(ADR 0039, **ON**) derives `patient_key` / `encounter_key` — deterministic non-reversible HMAC-SHA256
under the `app.app_secrets` pepper, by trigger, on the three isolated PHI tables — and explicitly
*"adds no fourth PHI store"*. `patient_identifiers` already carries `patient_key`, `encounter_key`,
`encounter_ref`, and `unit`; `public.patient_xref(module, entity_id, commission_id, patient_key,
encounter_key, disposed_at)` is the cross-module linkage registry, with disposal built in.

So the proposal's §11.2 `continuity_key` for the `patient` / `patient_encounter` target types
**should be `patient_key` / `encounter_key`** — which are PHI-free by construction, already
disposal-aware (LGPD Art. 18), and already prove the doc's own invariant #7 ("encounter
carry-forward never crosses admissions") without a new table. Caveat: `patient_xref` reads are
**QPS/PQS-only** today, so an infection-control committee running daily surveillance would need
either a widened read scope or a parallel derivation — a real design question, but a much smaller
one than a new PHI module.

---

## 5. Rule 3 (response lifecycle) — solvable, already precedented

A daily bed round means one evaluator holds **N concurrent `in_progress` responses on the same form
version**. Rule 3 as written in ARCHITECTURE.md says one draft per user per version — which reads
like a blocker.

It is not, because **the platform already carved this exact axis once.** Live index:

```
responses_one_draft_per_user_idx
  UNIQUE (form_version_id, created_by)
  WHERE status = 'in_progress' AND case_phase_id IS NULL
```

plus `responses_one_open_draft_per_phase_idx` (one open draft per case phase). A case-phase
response is exempt from the per-user rule and constrained per-phase instead. A recurring evaluation
would add the third arm on the same pattern — exempt when `evaluation_record_id IS NOT NULL`,
constrained one-open-draft-per-target instead.

⚠ **ARCHITECTURE.md Rule 3 is stale on this** — it states the index without the
`AND case_phase_id IS NULL` clause and omits both case-phase indexes. Likewise §2's supersession
forward-note ("the column is deliberately NOT added pre-pilot") is stale: `supersedes_id` shipped
pre-pilot with the SUP phase. See amendment **A6**.

---

## 6. Metrics — do not fork the indicator engine

§23 proposes `daily_evaluation_indicator_facts` (a materialized view) and an
`EvaluationMetricsService`. The platform already ships the authority: `indicators` +
`indicator_measurements`, with `compute_derived_measurement` **parity-locked to
`dashboard_distributions`** by construction (ADR 0058), `derived_config jsonb`, `data_source ∈
{manual, derivado, hibrido}`, direction, target, comparator, and warn bands. Flag
`quality_indicators` **ON**.

Forking a second numerator/denominator path gives the platform two metrics authorities that will
disagree — and the accreditation posture (ONA/JCI) depends on one auditable number. The genuinely
new requirement is **eligibility-filtered denominators** (§16), which is an additive extension of
`derived_config`, not a new engine.

The doc is right, though, that a percentage without numerator/denominator/exclusions/missingness is
unauditable — and the current engine has no `denominator_eligible` concept. That gap is real; it
just belongs inside the existing engine.

---

## 7. Unbudgeted costs the proposal does not name

- **Per-unit authorization does not exist.** §24.1 assumes "unit authorization". `memberships` has
  exactly three scopes — org / hospital / commission — with a CHECK enforcing scope exclusivity per
  role. There is no unit scope. Adding one touches the ADR-0078 capability model and every RLS
  predicate; the cheaper path is a per-program grant table on the `case_access_grants` precedent.
  Either way it is a real authz project, not a column.
- **Audit volume + anchoring.** `audit_log` is append-only and **hash-chained per commission**;
  the proposal's `evaluation_programs.owner_committee_id` is *nullable*, so the chain would have no
  anchor. It must be NOT NULL. Separately, §25's "audit **every** carried-forward answer" at
  40 beds × 15 questions × 365 days is ~219k chained rows per unit per year. Rule 11 records *that*
  something happened and *who* — **one row per initialization**, not per copied answer, is the
  correct granularity (the provenance columns carry the per-answer detail).
- **No scheduler exists.** Cycle generation needs one. The nearest precedent is
  `compute_due_notifications` (a scan RPC, no pg_cron/queue). §31 defers this; it is a genuine
  infra gap, not a detail.
- **Internal inconsistency:** §11.1 includes `patient_device_id` in the shape CHECK while §11.1's
  own closing note says not to create the column.

---

## 8. Impact on ADR 0086 — six recommended amendments

None of these change what FF-1…FF-5 build. All six are constraints on the **just-in-time per-phase
ADRs**, which is where these decisions actually get made.

### A1 — FF-4: fix the `default_source` vocabulary's extensibility (highest value)

**Carry-forward is structurally a dynamic default whose source is a prior response.** FF-4 already
ships "dynamic defaults — `default_source` config resolved server-side at draft start (idempotent:
never overwrites an existing answer)", and its ADR question list already asks "dynamic-default
vocabulary v1 (now(), current user, case/participant context?) + resolution timing".

The trap: **that vocabulary gets authored into published form versions, which are immutable
(Rule 5).** A vocabulary shipped as a closed context-only set cannot later admit a prior-response
source without migrating published definitions. The engine is additive anytime; the *config
vocabulary* is not.

**Recommend:** FF-4's ADR must (i) design `default_source` as an explicitly **extensible,
versioned** discriminator rather than a closed CHECK over context sources, and (ii) state
prior-response resolution as **deliberately out of scope for FF-4**, so a post-pilot carry-forward
adds a source *kind* rather than a second engine.

*Explicitly NOT recommended:* landing carry-forward provenance columns (`answer_origin`,
`copied_from_answer_id`, confirmation state) inert now. They are nullable adds with a correct
default (`'manual'` is true of every pre-existing answer), so they are cheap **later** — the freeze
principle (ADR 0065 §6) does not bite here, and pre-landing them for an unapproved feature is
speculative.

### A2 — FF-2: record that matrix axes are version-frozen, not data-driven

§17 of the proposal shows a bed matrix that looks exactly like the `matrix` item type. It is not
one, and it must not become one: `form_matrix_rows.code` is the **aggregation key** and must be
clone-stable, whereas beds are operational resources with their own lifecycle. Binding axes to a
live registry would fracture the ratified aggregation contract.

**Recommend:** one sentence in FF-2's ADR recording axes as authored, version-frozen definitions,
with data-driven axes explicitly rejected and the reason. Cost: a sentence. Without it, FF-2 gets
re-litigated the first time someone sees the bed-matrix mockup.

### A3 — FF-3: keep the completeness predicate layer open to non-value predicates

Carry-forward's "confirm before submit" (§15.6) is a **provenance-state predicate, not a value
predicate** — it blocks completion based on where an answer came from, not what it contains. FF-3
pins both the `rule_type` vocabulary and the `required_if` predicate layer over FF-1's
dispatch-by-`item_type` refactor of `app.response_required_complete`.

**Recommend:** FF-3's ADR states whether its predicate layer can admit an answer-state predicate.
Build nothing; just do not choose a shape that structurally excludes it. `submit_response` is
already edited by four phases — a fifth re-opening post-pilot is the expensive outcome.

### A4 — FF-5: document the lane-addition recipe (keep ruling 5 as-is)

Ruling 5 defers hospital/org lanes; that should stand. Note only that the lane recurring
evaluations would need first is **location** (`hospital_departments`), which already has a shipped
target table and an existing FK from `cases.department_id`.

**Recommend:** FF-5's ADR documents the mechanical recipe for lanes 4..N (new nullable target
column + widened `reference_kind` CHECK + XOR arm + **per-lane audit-door classification**). The
last item is the one that is not mechanical: `participant` is a PHI read surface and
`commission`/`user` are not, so INFO-2's door must be **lane-dispatched from the start**, not a
blanket policy retrofitted when lane 4 arrives.

### A5 — ADR 0086 Consequences: name recurring evaluations as out of scope

ADR 0086 is framed as "re-sequencing + bounded scope deltas — no new feature design". With the PO
now actively interested in recurring evaluations, there is a live risk of scope leaking into FF-1
(instances-as-beds) and FF-4 (defaults-as-carry-forward) during the just-in-time ADRs.

**Recommend:** add one Consequences bullet — the FF program covers form *capabilities* only;
recurring/sequential evaluations, the bed registry, and answer carry-forward are a separate
post-pilot domain with its own ADR and program. This is what keeps the five phases shippable.

### A6 — Correct the stale ARCHITECTURE.md text before FF-1 starts

Not strictly an ADR-0086 amendment, but every FF phase touches this surface and the repo has been
bitten by exactly this failure mode before (memory `migration-file-text-stale`):

1. **Rule 3's one-draft index** omits the live `AND case_phase_id IS NULL` clause and both
   case-phase indexes (`responses_one_open_draft_per_phase_idx`,
   `responses_one_root_per_case_phase_idx`).
2. **§2's supersession forward-note** says `responses.supersedes_id` is "deliberately NOT added
   pre-pilot". It exists, with `responses_one_successor_per_superseded`, and flag
   `response_correction` is ON.

---

## 9. Recommended next step

1. **Proceed with ADR 0086 as decided** — FF-1 → FF-2 → FF-3 → FF-5 → FF-4, unchanged.
2. Apply **A1–A5** as a short amendment block to ADR 0086 (PO call), and **A6** as a doc-hygiene
   fix before FF-1's ADR is authored.
3. Treat recurring evaluations as a **post-pilot program of its own** (~15 new tables, a scheduler,
   an authz scope extension, and an indicator-engine extension — comparable in size to a full
   accreditation-track phase). It needs its own grilling interview: the proposal's §31 "deferred
   decisions" are mostly PO decisions, not engineering ones.
4. When that program is written, the proposal is a good **skeleton** — but it must be rewritten
   against the real schema, with §14 deleted (already shipped as `question_key`), §7 rebuilt on
   `patient_key`/`encounter_key`, §23 folded into the Phase-15 indicator engine, and §25.2
   restated as supersession.

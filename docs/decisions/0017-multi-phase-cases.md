# ADR 0017 — Multi-Phase Cases

**Status:** Accepted (2026-06-13) · **Phase:** 7 · **Supersedes/relates:** [0005](0005-visible-when-shape.md) (condition shape), [0015](0015-response-fill-rpcs.md) (fill RPCs), [0016](0016-signoff-definer-read-path.md) (definer board pattern + Phase-7 in_progress invariant)

## Context

Some commissions (e.g. **Mortality & Morbidity**) evaluate one event across **more than
one phase**: a form is filled and concluded, the committee debates it, and depending on
the discussion a second form — up to a fourth, each a different form — may be needed. The
coordinator needs a board: `Caso 0042 — Fase 1: concluída · Fase 2: pendente`.

The platform's unit of work is a single **response** (one user fills one `form_version`
once, `in_progress → submitted`). Nothing sits above it. We need a **case** that groups
responses into an ordered sequence of **phases**, each phase reusing the existing
response / answer / sign-off / wizard machinery unchanged.

**Hard constraint (CLAUDE.md §1):** no patient-identifiable data. A case is NOT a patient
record — it is a system-minted per-commission **case number** + an optional
**non-identifying label**.

## Decision

Introduce four tables — `process_templates` + `process_template_phases` (a per-commission
blueprint) and `cases` + `case_phases` (the authority) — and bridge `responses` with a
nullable `case_phase_id`. A phase IS a response, so the wizard/answers/sign-off layers are
reused verbatim. Resolved design (the decision tree from the design interview):

1. **Hybrid template** — a per-commission blueprint defines ordered phase-slots, each bound to a form.
2. **Distinct form per phase-slot.**
3. **Snapshot at case creation** — phase defs are materialized into `case_phases`, pinning each form's currently-*published* `form_version_id`. Editing/archiving a template never touches in-flight cases. ⇒ templates need only a plain `draft → active → archived` status, **no `form_versions`-style cloning/immutability**.
4. **The case owns its phases** — `case_phases` is authoritative; the coordinator may **append** an ad-hoc extra phase to one case (append-only ⇒ no renumber, no broken references).
5. **Coordinator assigns** each phase to a member (`assigned_to`); the assignee is that phase's `responses.created_by`. Different phases → different people.
6. **Strict sequential, skippable** — phase N+1 activates only after phase N is `concluida` *or* `nao_necessaria`.
7. **Condition recommends + human confirms** — a phase-slot may carry `recommend_when` referencing an answer in **any earlier phase**, qualified by `from_phase`; when true the phase is flagged `recommended`, but a coordinator still confirms activation.
8. **Manual close** — case `aberto → concluido`, plus `cancelado`; the coordinator closes when the committee is done.
9. **v1 analytics = board + per-case detail only**; cross-case aggregate stats deferred to the Dashboards phase (now Phase 8).

## Key technical choices & rationale

- **Reuse the condition evaluator; do NOT touch the mirror.** `recommend_when` is evaluated
  by feeding the *existing* `app.eval_condition` a different answer-map source — a new
  `app.case_phase_answer_map(case_phase_id)` (`security definer`, **submitted-only**) — after
  stripping the `from_phase` qualifier. So `app.eval_condition` (SQL), `evalCondition`
  (`src/lib/queries/conditions.ts`), and `condition-vectors.json` are **unchanged**, removing
  drift risk on the phase-blocking mirror. The `from_phase` qualifier also solves
  question_key collisions across different phase-forms (we never build a case-wide flat map).
- **Case-number minting** — `BEFORE INSERT` trigger, `coalesce(max(case_number),0)+1` per
  commission, serialized with `pg_advisory_xact_lock(hashtextextended(commission_id))` and
  backstopped by `unique(commission_id, case_number)` + a one-shot unique-violation retry. A
  per-commission counter (not a global sequence) avoids leaking global case volume and keeps
  "Caso 0042" meaningful per commission.
- **Phase-7 in_progress invariant preserved** (the [0016](0016-signoff-definer-read-path.md)
  rule that a staff_admin cannot read another member's in-progress answers). `case_phases`
  carries **status + assignee + recommended only — never answers.** The coordinator's board
  reads status from `case_phases` / a `list_cases_board` definer RPC. Answers reach a
  coordinator only via a **submitted** response under the *unchanged* `responses_select`, or
  the gated `get_case_detail` definer envelope (submitted phases only).
  `case_phase_answer_map` / `recompute_recommendations` are the single cross-member read
  surface and stay submitted-only (commented + tested with a `'{}'`-for-in-progress vector).
- **Submission reuses `submit_response` unchanged**; an `AFTER UPDATE` trigger
  `sync_case_phase_on_submit` flips the phase to `concluida` and recomputes recommendations.
- **Draft-uniqueness reworked** so an assignee can hold many phase-drafts at once: the
  existing one-draft index is scoped to `case_phase_id IS NULL`; a new
  `unique(case_phase_id) where case_phase_id is not null` gives exactly one response per phase.

New SQLSTATEs `P0016`–`P0022` (invalid template/recommend_when; no published version; not
sequential; phase wrong state; case not open; assignee not a member; not the assignee).

## Consequences

- Net-new surface across backend (one migration `20260613090004_cases_multi_phase.sql`) and
  frontend (template builder, cases board, phase filler — heavy component reuse). Inserted as
  **Phase 7**; Dashboards → 8 (now also consumes case/phase data), Deployment → 9.
- Templates can be edited freely; only *new* cases see the change (snapshot). A case may
  diverge from its template via ad-hoc phases — accepted (the case is the authority).
- `recommend_when` over a *skipped* source phase evaluates against an empty answer map
  (`equals`/`in` false, `not_equals` true) — a safe default; the builder should flag
  `not_equals`-over-skippable as a footgun.
- A case may be closed with phases still open; `close_case` flips remaining phases to
  `nao_necessaria` and any stranded in-progress draft is inert.
- A separate `reassign_phase` RPC covers an assignee removed from the commission (allowed
  only before an in-progress response exists).

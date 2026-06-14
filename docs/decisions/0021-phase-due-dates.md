# ADR 0021 — Due dates for case phases

**Status:** Accepted · **Date:** 2026-06-14 · **Phase:** post-Phase-8 feature addition

## Context

Coordinators need to track when a case phase is expected to be completed. Two
inputs are required:

1. An OPTIONAL DEFAULT number of days authored on a TEMPLATE phase-slot when it
   is defined ("Nova fase") — a planning hint.
2. An OPTIONAL DUE DATE set/edited/removed when a phase is activated ("Ativar e
   atribuir fase"), pre-filled in the UI from the slot's default.

## Decision

- `process_template_phases.default_due_days integer` (nonneg CHECK) — the
  template-slot planning hint.
- `case_phases.default_due_days integer` (nonneg CHECK) — a **snapshot copy** of
  the slot default, taken at case creation, plus `case_phases.due_date date` —
  the actual due date, null at creation, set on activation.

**Snapshot isolation (mirrors ADR 0017).** `create_case_from_template` COPIES
`default_due_days` from the slot into the materialized `case_phases` row, so a
later template edit never reaches a live case. The pre-fill the activation dialog
shows comes from the case's own copy, not the live template.

**RPC threading (additive, follows the Phase-7 pattern).**
- `add_template_phase` / `update_template_phase` gain `default_due_days` handling.
  `update_template_phase` mirrors `recommend_when`'s clear/replace/keep branch
  exactly, with a dedicated `p_clear_default_due_days` flag (SQL cannot
  distinguish "omit" from "set null").
- `activate_phase` gains `p_due_date date` and sets it in the same UPDATE that
  flips the phase to `ativa`. That UPDATE already runs under `app.in_case_rpc`, so
  `guard_case_phase_status` permits the new column write unchanged.
- `list_cases_board` exposes `due_date`; `get_case_detail` exposes both
  `due_date` and `default_due_days`.
- `add_ad_hoc_phase` is intentionally LEFT UNCHANGED (an ad-hoc phase carries no
  default; its due date, if any, is set via a later activation flow).

New params are APPENDED at the end of each signature. Because `CREATE OR REPLACE`
with a changed argument list creates a NEW overload, the prior signatures of
`add_template_phase` / `update_template_phase` / `activate_phase` are dropped
first so no stale overload lingers.

## Consequences

- No new RLS, no new SQLSTATE, the condition evaluator is untouched — these are
  display/planning data, not part of visibility or recommendation logic.
- A `due_date` in the past on an open phase renders as overdue (frontend
  concern); the DB applies no state coupling to the date.
- Migration `20260614091000_phase_due_dates.sql`; types regenerated.

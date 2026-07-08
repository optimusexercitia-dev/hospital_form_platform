# 0062 — Meeting actual-occurrence time (`held_at` / `held_end`)

**Date:** 2026-07-08 · **Status:** accepted / not yet implemented.
**Relates:** the Phase-10 Meetings feature (`meetings` table + lifecycle state machine
`agendada → realizada → em_assinatura → assinada → distribuida`, baseline migration
`20260620000000`). **Binding rules:** Rule 10 (pt-BR UI), Rule 11 (audit).

> **Numbering note:** ADR [0060](0060-flexible-forms-foundation.md) loosely reserved "0061+"
> for the deferred Flexible-Forms (FF-1…FF-5) phases, and ADR
> [0061](0061-administrativo-delegated-role.md) already claimed 0061. This unrelated feature
> claims 0062; the FF-phase ADRs become **0063+**.

## Context

A coordinator very commonly fills in a meeting's record **after** it has taken place, and the
meeting frequently occurs at a **different date/time than scheduled** (moved a day, started
late, ran long). Today `meetings` stores only the *plan* — `scheduled_start` / `scheduled_end`
— plus `concluded_at`, which is stamped at the `→ em_assinatura` transition and means "minutes
sent to signature," **not** "the meeting was held." There is no field for when the meeting
*actually* occurred, and the `agendada → realizada` transition (`mark_meeting_held`, and the
one-step `conclude_meeting` from `agendada`) collects no data — its UI is a bare confirm
dialog (`meeting-lifecycle-actions.tsx`).

Two options were considered: (1) an always-editable date/time card on the detail page,
pre-filled from the schedule; (2) a date/time picker inside the "Marcar como realizada" /
"Concluir" dialog. The trap in option 1 as first framed was **overwriting `scheduled_start`**,
which destroys the plan-vs-actual distinction that accreditation cadence/punctuality reporting
(ONA/JCI committee-meeting cadence) depends on.

## Decision

1. **Add a dedicated occurrence time, separate from the schedule.** New nullable columns
   `held_at timestamptz` and `held_end timestamptz` on `meetings`. `scheduled_start` /
   `scheduled_end` remain untouched (the plan is never overwritten). `held_*` is null until
   the meeting is realized. `held_end` enables optional real-duration stats for committees
   that want them.
2. **Capture at the transition (option 2).** `mark_meeting_held` and `conclude_meeting` gain
   `p_held_at` (and `p_held_end`) parameters; the "Marcar como realizada" / "Concluir" dialogs
   present a `DateTimePicker` **defaulted to `scheduled_start`** (end defaulted to
   `scheduled_end`), labelled as the time the meeting *actually* occurred.
3. **Correct on the detail page (option 1, scoped).** The meeting header displays `held_at`
   (and the window) alongside the schedule (e.g. *"Agendada: … · Realizada em: …"*), and the
   coordinator may edit `held_*` while status is `realizada` / `em_assinatura` — covering the
   fill-in-later and retroactively-created cases. This edit path writes **only** `held_*`,
   never the schedule.
4. **Validation.** `held_end >= held_at`; `held_at` must **not be in the future** (contrast:
   `scheduled_start` may be future). A large divergence from `scheduled_start` **warns, not
   blocks**.
5. **Audit (Rule 11).** Setting or changing `held_*` emits an audit row
   (`meeting.held_changed`, old→new summary). The values are plain timestamps, not PHI, so
   they may appear in the diff — this also closes the existing gap where schedule edits via
   `update_meeting` emit no audit row (for the `held_*` fields at least).
6. **Backfill.** Existing meetings already past `realizada` keep `held_at` **null** (=
   "not recorded"); we do **not** backfill from `scheduled_start`, so reports never invent
   punctuality data from the plan.

## Consequences

- Dashboards/cadence reports read `held_at` as the true occurrence date, falling back to
  `scheduled_start` only where explicitly desired (null = unknown, not "on time").
- `runLifecycle()` in `src/lib/meetings/actions.ts` currently passes a uniform
  `{ p_meeting_id }` to every lifecycle RPC; `mark_meeting_held` / `conclude_meeting` now need
  extra params, so those two calls stop going through the shared runner unchanged.
- pt-BR labels and messages throughout (Rule 10). Coordinator-only, gated by the same
  `isEditableStatus` + `isCoordinator` checks the schedule editor uses.

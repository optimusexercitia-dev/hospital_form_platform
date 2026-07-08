# Handoff — Meeting actual-occurrence time (`held_at` / `held_end`)

**Branch:** `feat/meeting-held-time` · **ADR:** [0062](../decisions/0062-meeting-actual-occurrence-time.md)
(already on `main`) · **Status:** not started — design locked, ready to build.
**Feature area:** Phase-10 Meetings.

This is a self-contained pickup doc so work can resume from a fresh machine / fresh
teammate context. Read ADR 0062 first for the *why*; this doc is the *how* and *where*.

---

## Problem (one paragraph)

Coordinators very commonly record a meeting **after** it happened, and it frequently occurs
at a **different date/time than scheduled**. Today `meetings` stores only the plan
(`scheduled_start` / `scheduled_end`) plus `concluded_at` (which means "ata sent to
signature," not "meeting was held"). We add a dedicated, nullable **actual-occurrence**
window — `held_at` / `held_end` — captured at the `→ realizada` transition and correctable
afterward, **without ever overwriting the schedule**.

## Design decisions (locked — see ADR 0062)

1. New nullable `held_at` / `held_end timestamptz` on `meetings`. Null = "not recorded"
   (never backfilled from the schedule). Schedule columns untouched.
2. **Capture at the transition:** `mark_meeting_held` and `conclude_meeting` take
   `p_held_at` / `p_held_end`; the confirm dialogs gain a `DateTimePicker` defaulted to
   `scheduled_start` / `scheduled_end`.
3. **Correct on the detail page:** header shows *"Agendada: … · Realizada em: …"*; coordinator
   can edit `held_*` while `realizada` / `em_assinatura`, writing **only** `held_*`.
4. **Validation:** `held_end >= held_at`; `held_at` **not in the future** (schedule may be
   future). Large divergence from `scheduled_start` **warns, not blocks** (frontend-only hint).
5. **Audit (Rule 11):** set/change of `held_*` emits `meeting.held_changed` (old→new summary;
   plain timestamps, safe in the diff). Also closes the current gap where schedule edits emit
   no audit row — for `held_*` at least.
6. **Backfill:** none. Existing `realizada`+ meetings keep `held_at` null.

---

## Backend tasks (owner: `backend`)

Files: `supabase/migrations/` (new file), `src/lib/queries/meetings.ts`,
`src/lib/types/database.ts` (regen). **Migration + RPC change → plan approval required.**

- [ ] **B1 — Migration: columns.** New migration adds `held_at timestamptz` and
  `held_end timestamptz` (nullable) to `public.meetings`. Local dev: `supabase migration up`;
  remote deploy (`supabase db push`) is user-authorized only — see the "remote db push needs
  user auth" gotcha.
- [ ] **B2 — Migration: RPC signatures.** Extend `mark_meeting_held` (baseline
  `20260620000000_baseline.sql:12009`) and `conclude_meeting` (`:8535`) with
  `p_held_at timestamptz` and `p_held_end timestamptz`. Set `held_at` / `held_end` in the same
  UPDATE that flips status. Keep the existing `set_config('app.in_meeting_rpc', ...)` guard
  wrapping. `conclude_meeting` already stamps `concluded_at = now()` — **leave that as-is**;
  `held_at` is a distinct concept and comes from the parameter.
- [ ] **B3 — Migration: validation.** In both RPCs: raise (new `HC0xx` errcodes, pt-BR
  messages) if `p_held_end < p_held_at` or `p_held_at > now()`. `p_held_at` may be null (RPC
  still allowed to proceed; e.g. one-step conclude where the coordinator skipped it) — decide
  during plan review whether `realizada` should *require* a non-null `held_at`. Recommended:
  allow null, since it's correctable later.
- [ ] **B4 — Migration: edit path.** Allow editing `held_*` while `realizada` / `em_assinatura`.
  Prefer a **small dedicated RPC** `set_meeting_held_window(p_meeting_id, p_held_at, p_held_end)`
  (staff_admin-gated, same validation as B3) over widening `update_meeting` (`:16900`), because
  `update_meeting` only permits `agendada`/`realizada` and does not currently audit. Writes
  **only** `held_*`.
- [ ] **B5 — Migration: audit trigger.** Extend `app.trg_audit_meetings()` (baseline `:4721`)
  so an UPDATE where `held_at`/`held_end` changed emits `meeting.held_changed` (summary
  `old → new`, diff the two fields). Today the UPDATE branch only fires on status change
  (`:4730`).
- [ ] **B6 — Query layer + types.** Add `heldAt` / `heldEnd` to `MeetingDetail`
  (`src/lib/queries/meetings.ts:113`, next to `concludedAt` at `:125`); add `held_at, held_end`
  to the detail `select` (`:619`) and map them in the row mapper (`:643`). Regenerate
  `src/lib/types/database.ts`. Consider exposing on `MeetingListItem` too if cadence lists
  need it (defer unless a consumer asks).
- [ ] **B7 — pgTAP.** Cover: columns exist nullable; `mark_meeting_held`/`conclude_meeting`
  persist `held_*`; future-`held_at` and `held_end < held_at` rejected; `set_meeting_held_window`
  authz (staff_admin only) + status gate; audit row emitted on change.

## Frontend tasks (owner: `frontend`)

Files: `src/components/meetings/meeting-lifecycle-actions.tsx`,
`src/components/meetings/meeting-header.tsx`, `src/lib/meetings/actions.ts`,
maybe a new small dialog/edit component, `src/components/meetings/format.ts` (reuse).
Use the `frontend-design` skill. **No new route group → one-line plan + ack is fine.**

- [ ] **F1 — Action wrappers.** `markMeetingHeld` / `concludeMeeting`
  (`src/lib/meetings/actions.ts:264` / `:278`) currently funnel through `runLifecycle()`
  (`:229`), which passes a **uniform `{ p_meeting_id }`** to every RPC. These two must now
  pass `p_held_at` / `p_held_end`, so **break them out of the shared runner** (or parametrize
  it). Add a `setMeetingHeldWindow` action → RPC `set_meeting_held_window` for B4.
- [ ] **F2 — Transition dialog.** In `meeting-lifecycle-actions.tsx`, the "Marcar como
  realizada" (`:98`) and "Concluir" (`:113`) buttons are today a bare confirm
  (`ConfirmActionButton`, `:196`). Add a `DateTimePicker` (reuse the one from
  `meeting-form-dialog.tsx:252`) defaulted to `scheduled_start` / `scheduled_end`. pt-BR label,
  e.g. *"Data e hora em que a reunião efetivamente ocorreu."* Optional end field.
- [ ] **F3 — Header display + edit.** In `meeting-header.tsx` (schedule rendered via
  `formatSchedule` at `:74`) add *"Realizada em: …"* using `formatSchedule(heldAt, heldEnd)`.
  Provide an inline edit affordance (coordinator only, while `realizada`/`em_assinatura`) that
  calls `setMeetingHeldWindow`. Reuse `format.ts` helpers (`formatSchedule` `:44`,
  `toDateTimeLocalValue` `:74`).
- [ ] **F4 — Divergence warning.** Non-blocking hint when the chosen `held_at` differs from
  `scheduled_start` by more than, say, a day (pure UX; server does not block on this).
- [ ] **F5 — a11y + pt-BR.** Labelled date/time inputs, keyboard-navigable, visible focus
  (§8). All copy pt-BR.

## Tester / QA

- [ ] **T1 (tester, after build).** E2E: schedule a meeting → "Marcar como realizada" with a
  changed date → assert `held_at` persisted and shown in header; edit `held_*` afterward; assert
  future-date rejection surfaces a pt-BR error; keyboard-only pass on the dialog. Run against a
  standalone prod build (see the E2E gotchas in memory / `docs/progress`).
- [ ] **QA (after green).** RLS/authz on `set_meeting_held_window`, audit-row assertion,
  no-schedule-overwrite invariant, backfill = null.

---

## Gotchas / must-read before building

- **`runLifecycle()` uniformity** (`actions.ts:229`) — the single biggest structural change;
  two RPCs stop sharing the runner's `{ p_meeting_id }` call. See F1.
- **`concluded_at` ≠ `held_at`** — do not repurpose `concluded_at`; it stays "sent to
  signature." B2.
- **Remote deploy is user-gated** — `supabase db push` from a background agent is auto-denied;
  the user runs the remote deploy. Local uses `supabase migration up` (app reads local).
- **Meeting state machine** — `app.guard_meeting_status()` (baseline `:2712`) freezes meetings
  `≥ em_assinatura` against direct edits and requires the `app.in_meeting_rpc` flag; the B4 edit
  RPC must set that flag and is allowed only for `realizada`/`em_assinatura`.
- **`minutes_md` is PHI** — unrelated to this work, but do not touch it; `held_*` are plain
  timestamps and are **not** PHI.

## Open questions for the product owner (decide at plan review)

1. Should entering `realizada` **require** a non-null `held_at`, or allow null-and-fill-later?
   (Doc recommends allow-null.)
2. Do cadence lists / dashboards need `held_at` on `MeetingListItem` now, or defer until a
   consumer needs it?

# Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)

Archived from PROGRESS.md at the §6 Record step. Feature branch `feat/meeting-held-time`.
ADR [0062](../decisions/0062-meeting-actual-occurrence-time.md) · plan
[meeting-held-time.md](../plans/meeting-held-time.md) · QA review
[meeting-held-time-review.md](../reviews/meeting-held-time-review.md).

## Outcome

✅ **COMPLETE 2026-07-08** — gate passed and committed (`bfce6e8`).
pgTAP **21/21** · meeting E2E **33 pass** · QA **APPROVED** (0 BLOCKER · 0 MAJOR · 2 MINOR,
one cleared as HC084, one accepted) · human-approved. **Remote `supabase db push` DEFERRED to
the user** (migration `20260715000100` is local-only). Housekeeping committed separately (`e427612`).

**Product-owner decisions:** allow-null `held_at` (fill-later); edit gate `realizada`-ONLY (reopen to
edit after conclusion); future-schedule → **blank** occurrence default (extends ADR 0062, consistent
with allow-null); `MeetingListItem` deferred (decision 3).

**Final errcode list:** HC081 (`held_end < held_at`) · HC082 (`held_at` in future) · HC083 (edit RPC
off `realizada`) · HC084 (`held_end` without `held_at`).

## Backend — B1–B7 + QA MINOR (HC084) DONE (local; awaiting remote push)

Migration `supabase/migrations/20260715000100_meeting_held_time.sql` (applied locally via `db reset`;
**not** on remote — lead/user owns `db push`). **RPC signatures (final):**
- `public.mark_meeting_held(p_meeting_id uuid, p_held_at timestamptz default null, p_held_end timestamptz default null)`
- `public.conclude_meeting(p_meeting_id uuid, p_held_at … default null, p_held_end … default null)`
- new `public.set_meeting_held_window(p_meeting_id uuid, p_held_at timestamptz, p_held_end timestamptz default null)`

DROP-then-recreate on the two widened RPCs (no ambiguous overload — verified exactly 1 function each);
`REVOKE ALL FROM PUBLIC` + `GRANT authenticated/service_role` re-applied. `set_meeting_held_window`
gated `realizada`-ONLY (HC083), staff_admin via `assert_meeting_staff_admin`, sets `app.in_meeting_rpc`,
writes ONLY `held_*`. Validation HC081/HC082 in all three; **null `held_at` allowed** at the transition.
**QA MINOR (defense-in-depth, Rule 1):** HC084 rejects `p_held_end` non-null while `p_held_at` is null
(an end with no start) in all three RPCs, pt-BR *"informe o início da realização antes do término da
reunião"* — amended the SAME migration in place (local-only, un-pushed).

**B5:** `app.trg_audit_meetings()` NON-EXCLUSIVE branches → a transition that also sets held emits BOTH
`meeting.status_changed` and `meeting.held_changed` (distinctness guards prevent spurious rows; `held_*`
are plain timestamps, not PHI). **B6:** `MeetingDetail.heldAt`/`heldEnd` + detail select/mapper
(`src/lib/queries/meetings.ts`); types regenerated (`src/lib/types/database.ts`, local). `MeetingListItem`
untouched. **B7:** `supabase/tests/206_meeting_held_time.sql` **21/21**; 120 (32) + 204 green on fresh reset.

**Caught + fixed while building:** the stale baseline body of `conclude_meeting` referenced the DEAD
`app.is_org_admin_of_commission` (renamed to `app.is_commission_admin_of` by ADR-0051 migration
`20260709000200`) — swapped to the live predicate.

## Frontend — F1–F5 built (components + actions), lint+typecheck green

Lead serialized `src/lib/meetings/actions.ts` to frontend (backend froze its stubs). **F1:** broke
`markMeetingHeld`/`concludeMeeting` out of `runLifecycle` into a new `runHeldTransition` passing
`p_held_at`/`p_held_end`; wired `setMeetingHeldWindow` → `set_meeting_held_window`. A cleared picker
forwards SQL `null` via a single contained `heldArgs` cast + one inline cast (generated Args model held
params as non-nullable `string`; RPC accepts NULL at runtime; justification comments, no `any`). **F2:**
`HeldTransitionButton` in `meeting-lifecycle-actions.tsx` — the "Marcar como realizada"/"Concluir" dialogs
embed a clearable start + optional end `DateTimePicker` defaulted to the schedule, label "Data e hora em
que a reunião efetivamente ocorreu." **F3:** header shows "Agendada: …" + "Realizada em: …"; inline
correction affordance (`meeting-held-edit.tsx`, `setMeetingHeldWindow`) shown ONLY when `isCoordinator`
AND status===`realizada`; concluded meetings render a read-only "Realizada em" line, no edit button.
**F4:** non-blocking divergence hint (>~1 day from `scheduledStart`) in `held-window-fields.tsx`. **F5:**
labelled/`useId`-wired inputs, `aria-describedby` on start, keyboard-operable, visible focus; pt-BR.
New files: `held-window-fields.tsx`, `meeting-held-edit.tsx`.

## Tester T1 — `e2e/meeting-held-time.spec.ts` 5/5 (chromium, `--workers=1`, fresh reset)

4 initial failures were **spec-side defects, NOT app bugs** (feature verified-correct by the lead
in-browser). Two classes, both fixed test-side: **(1) picker selectors** — helpers scoped the DatePicker
button & "Hora" TimeField as DESCENDANTS of the `<label>`, but `<label htmlFor={id}>` and the picker are
SIBLINGS → new `fieldContainer()` (label's parent via `xpath=..`) in `e2e/helpers/date-pickers.ts`;
header edit-button locators rewritten to the outer `<span>`. **(2) future-date test data** — T1.1/T1.2
picked a current-month day that was in the future → correct HC082 rejection → added `monthsBack` to
`pickDate`/`setDateTimeField` to pick the same day in the prior month. No app code touched.

## Lead — full-suite gate run + two REAL bugs caught & fixed

Full E2E (`--workers=1`, fresh reset): 586 passed; 20 failures = (a) **known local-GoTrue auth
exhaustion** late in the 31-min serialized run (proven — `phase5-wizard` failed in-suite but passed
**12/12 in isolation**), plus (b) **3 REAL meeting-transition bugs** the gate correctly caught
(`phase10-meetings:200`, `cases-meetings-minor:223/267`). **Root cause:** the transition dialog
pre-filled `held_at = scheduled_start`; future-scheduled meetings → server correctly rejects (HC082),
and the UI showed only the GENERIC error. **Two FE fixes:** (1) `useHeldWindowState` defaults the picker
to BLANK when `scheduledStart` is in the future (→ `held_at=null`, fill-later); keeps `scheduledStart`
for past meetings; (2) `mapMeetingError` now maps HC081/82/83 → the RPC's specific pt-BR reason.
**Re-verified:** meeting-held-time + phase10-meetings + cases-meetings-minor = **33 passed, 0 failed**,
with NO spec edits needed (the transition stopped erroring by default).

## Out of scope (pre-existing branch failures — NOT this feature)

Spun off to a separate task: 4 E2E (`administrativo:680`, `case-access:297`, `case-phase-result:707`,
`hospital-departments:252`) + 2 pgTAP (`90_cases` t33, `184_hospital_admin_isolation` t15) fail on the
branch in isolation with the held_at changes stashed out, and none touch meetings — pre-existing, likely
from the administrativo-role track (branch cut from main after the administrativo merge).

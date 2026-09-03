---
id: BUG-CASEEVT-KIND-001
status: open
severity: critical
area: cases
opened: 2026-08-23
closed: ~
feature: CASEEVT
related_adrs: [0137]
---

## Symptom

_Verbatim from the Bug Log section of PROGRESS.md (retired 2026-09-03, ADR 0185), filed 2026-08-23:_

🔴 **BUG-CASEEVT-KIND-001 — a case writer can DELETE, or silently RE-KIND, a procedural `case_events`
row: the UPDATE/DELETE policies carry no `kind` gate.** Filed 2026-08-23 (lead). Surfaced by ADR 0137
D12's `CaseEvent.kind` widening, **not caused by it. Measured from the live catalog:**

## Expected behavior

_Not yet recorded._

## Actual behavior

`case_events_writer_update` / `…_staff_admin_update` hold `app.is_manual_case_event_kind(kind)` in
**`WITH CHECK` only** — that constrains the **new** kind, never **which rows may be touched**; their
`USING` is `app.can_write_case_content(case_id, auth.uid())` alone. `case_events_writer_delete` /
`…_staff_admin_delete` have **no kind gate at all**. So `decision_issued → note` satisfies both clauses
and the row is silently re-kinded, and any procedural row can simply be deleted. ⛔ **No second lock — and this line's EVIDENCE was corrected 2026-08-25 (QA N-5): it said "zero
non-internal triggers on `case_events`", which was true when filed and is now FALSE.** P3/D15 added
`bump_case_print_revision` (AFTER ROW I/D/U) — tamper-**evidence**, not a lock, and it writes no
audit row. **No** routine references both `case_events` and `audit_log`, and writes go
**direct-table** over PostgREST — so the deletion is still **unaudited** (a Rule 11 gap). ⭐ P3 also
**raised the stakes**: it seals these rows into a hash-verified artifact with a public verification
URL, so a silent re-kind before a mint yields an *authentically signed* dossier that misrepresents a
procedural decision. ⚠ **The only control today is the UI suppression D12 added, which Rule 1
forbids counting as one.** ⛔ **Deliberately NOT fixed in this batch:** changing two RLS policies is a
live authz change owing its own keystone + diff-scoped door sweep. **Bounded:** requires
`can_write_case_content` on that case — in-case records integrity, **not** a tenant-isolation break.
⭐ The review lesson: three real filters were cited as refusing this write; all three gate the **new**
kind, so **none** of them bounds the claim they were cited for.

## Reproduction

_Not yet recorded._

## Impact

_Not yet recorded._

## Investigation

⭕ **SECOND AXIS, added 2026-08-24 (QA r2, re-measured from `pg_policies` by the lead): the writer
policies carry no VISIBILITY conjunct either — write is reachable where READ is not.**
`case_events_select` is `can_read_case(…) AND (visibility = 'case_readers' OR is_staff_admin_of(…))`,
but `case_events_writer_delete` / `…_writer_update` are `can_write_case_content(case_id, auth.uid())`
**alone**. So a plain writer who is not a `staff_admin` can **DELETE or EDIT a `coordinator_only` row
they cannot SELECT** — unauditedly, per the no-second-lock finding above. ⚠ The `…_staff_admin_*`
variants at least carry `NOT app.is_case_excluded(…)`; the writer pair carries nothing.
⛔ This is a **distinct property from the `kind` gate** — fixing `kind` alone leaves it standing, so
the eventual fix owes **two** keystones, not one.

## Root cause

_Not yet recorded._

## Fix

_Not yet recorded._

## Regression protection

_Not yet recorded._

## Related code

_Not yet recorded._

## Lesson

_Not yet recorded._

## Resolution

_Not yet recorded._

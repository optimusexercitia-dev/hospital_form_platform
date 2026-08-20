# ADR 0129 — A narrow disposal flag through the meeting child lock

**Status:** Proposed (design PO-ratified 2026-08-19 in the DSR design session; ⛔ **nothing
may be built until the implementation session is opened** — PO instruction) · **Date:**
2026-08-19 · **Feature:** fix for `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` (🔴, blocks
Critical FUP C1a/C1b) · **Relates:** ADR
[0056](./0056-phi-disposal-closure-narrowed-claim.md) (the door), ADR
[0126](./0126-print-series-and-derived-currency.md) §E/§F (the guard's load-bearing
refusal + the disposal registration conjunct), ADR
[0130](./0130-dsr-subject-request-workflow.md) (the workflow this unblocks), Rule 12.

## Context

`public.dispose_meeting_minutes` — the LGPD-erasure door for meeting minutes (ADR 0056 §2)
— **cannot complete on any locked meeting that has agenda items**, i.e. exactly the
population that carries PHI. Measured from the live catalog (never the migration text):

- The door sets `app.in_meeting_rpc` with the comment *"bypass the meeting freeze guards"*.
- **`app.guard_meeting_child_lock` does not read that flag** — its body contains no
  reference to `app.in_meeting_rpc` at all. It raises unconditionally when the parent
  meeting is `in_signature` / `signed` / `distributed` / `cancelled`, on all four child
  tables (`meeting_agenda_items`, `meeting_attendees`, `meeting_cases`,
  `meeting_closed_sessions`).
- So the door nulls `minutes_md` (the parent honours the flag), then raises on the
  `meeting_agenda_items` UPDATE, and the whole transaction rolls back. Constructed with
  three probes: locked-with-agenda ⛔ raises · locked-agenda-less ✅ disposes.

The comment asserts a bypass the guard it names does not implement — the
guards-that-read-right-but-fail-open family, except here it fails **closed** against a
legal obligation. Three fix shapes were on the table (FUP body,
`docs/progress/follow-ups.md`); the PO ruled in the 2026-08-19 design session (Q11).

## Decision

**Shape 2 — a new, narrow flag.** Rejected: shape 1 (teach the guard to honour
`app.in_meeting_rpc`) is a widening — every meeting RPC would gain child-write power over
locked meetings, and ADR 0126 §E leans on the guard's refusal *inside* RPCs as the reason
agenda/attendee/closed-session content is not a currency exposure. A widening cannot be
wrong-and-safe. Rejected: shape 3 (a DEFINER path around the trigger) duplicates redaction
outside the door that audits it.

1. New transaction-local GUC **`app.in_disposal_rpc`** — **set only** by
   `dispose_meeting_minutes` (immediately before its child UPDATE, reset after), **read
   only** by `app.guard_meeting_child_lock`, which stands aside iff the flag is `'on'`.
   No other guard reads it; no other door sets it.
2. The false comment in `dispose_meeting_minutes` is corrected in the same migration. The
   `app.in_meeting_rpc` set/reset pair stays (the parent-table guards do honour it).
3. **ADR 0126 §E is amended in the same change** — its positively-stated bound
   (*"`guard_meeting_child_lock` … reads **no** RPC flag at all, so it refuses even inside
   RPCs"*) becomes *"reads exactly one flag, `app.in_disposal_rpc`, settable only by the
   disposal door"*. Leaving §E as written would plant the next stale-comment defect in the
   ADR that documented this one.

## Obligations (each blocks the phase that ships this)

- **pgTAP, with the fixture the FUP demands**: a **locked meeting WITH agenda items** —
  (a) disposal succeeds end-to-end (`minutes_md` null, agenda columns `[PHI removido]`,
  `phi_disposed_at` stamped, status unchanged); (b) **differential**: with the flag absent,
  a direct child UPDATE on the same fixture still raises (the guard still refuses
  everything else — the over-grant twin, or the test passes by construction); (c) a
  sibling meeting RPC (e.g. `sign_meeting`) still **cannot** write children of a locked
  meeting — shape 1's widening is pinned out.
- **Diff-scoped door sweep** over exactly `guard_meeting_child_lock` +
  `dispose_meeting_minutes` (ADR 0079 Amendment 1 recipe); `ARM=census` + `ARM=wrapper`
  (`FROMFINDINGS=1`) — a changed DEFINER body re-enters both domains.
- **ADR 0126 §F re-check**: the meeting **registration** predicate (`status ∈
  registering ∧ phi_disposed_at is null`) is untouched by this change — disposal already
  un-registers. Assert the watermark tandem rule is not tripped (no lock-predicate
  refinement occurs; record that this was checked, not assumed).
- The C1a §3 disposal rehearsal (blocked on this) **must use the with-agenda fixture** —
  a green over agenda-less meetings proves nothing about the case this ADR exists for.

## Consequences

- PHI erasure becomes possible for the population that carries PHI; Critical FUP C1a/C1b
  unblock; the DSR workflow (ADR 0130) gains a working meeting lane.
- The guard's refusal stays load-bearing for every non-disposal writer — the §E bound
  narrows by exactly one named, audited door.
- `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` moves to "fix ruled, awaiting build"; it
  closes only on the pgTAP + sweep evidence above, never on this text.

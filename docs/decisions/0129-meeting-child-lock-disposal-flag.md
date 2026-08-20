# ADR 0129 — A narrow disposal flag through the meeting child lock

**Status:** **Accepted — BUILT 2026-08-19** (design PO-ratified the same day in the DSR
design session; implemented as DSR plan **Slice 1**, migration
`20260930000100_disposal_flag_through_meeting_child_lock.sql`, suite
`supabase/tests/348_disposal_flag_meeting_child_lock.sql`) · **Date:**
2026-08-19 · **Feature:** fix for `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` (🔴; ⛔ its
recorded "blocks Critical FUP C1a/C1b" was **wrong in grain** — Consequences) · **Relates:** ADR
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

## Build record (2026-08-19) — what the obligations actually returned

All on a **fresh `supabase db reset`**. Suite `348` is 15 tests; the four gates below are
CLAUDE.md §6 step 1.

| Obligation | Evidence |
|---|---|
| (a) locked **WITH agenda items** disposes end-to-end | `348` t9 + t10–t13: `minutes_md` null, both agenda rows `[PHI removido]` in all three columns, `phi_disposed_at` stamped with the reason, **status unchanged**. ⚠ The seed has **no** such meeting — its only meeting with children is `held` — so `348` **constructs** the population rather than searching for it |
| (b) the no-flag differential | `348` t5. Verified by **neutralization**, not by reading: with the stand-aside removed, t9 dies `23514 … está bloqueado` and t5/t6/t8/t15 stay green — the fix is red-without / green-with, in both directions |
| (c) a sibling RPC still cannot write children | `348` t6 (the `app.in_meeting_rpc` flag all **26** sibling doors set) and t8 (`update_meeting_agenda_item`, past its own gate). Shape 1's widening is pinned out |
| ADR 0126 §E amended in the same change | Done — §E now reads "exactly one flag"; §F's "not fixed here" note is marked resolved |
| Diff-scoped door sweep | ADR 0079 Amdt 1's recipe filters the diff to `^(is_\|can_\|has_)` + RLS policies, and by that **syntax** this diff's case list is **empty** (a trigger function and a plain `if not (...)` inside a door). Swept by the **property** instead — see the finding below |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` | All four **HOLD**. No new census subject: both objects already existed |
| ADR 0126 §F re-check | Checked, not assumed: the registration predicate (`status ∈ registering ∧ phi_disposed_at is null`) is untouched, no lock-predicate refinement occurs, so the watermark tandem rule is not tripped. t13 pins that disposal leaves `status` alone |

⭐ **The sweep found something the obligations did not ask for.** Rewriting
`dispose_meeting_minutes`'s authorization gate to `if false then` — so **any** caller
passes — left the full **6548-test** suite **GREEN**. The gate was correct; nothing would
have noticed its removal. That is door-blindness (ADR 0079) on a PHI-erasure door, and it
had been that way since ADR 0056. `348` **t7** is the missing keystone: a plain commission
member is refused `42501`, and it goes RED under exactly that mutation. The lesson is the
recipe's: **a syntax-derived case list is not the property** — this door matched no filter
and was blind anyway.

## Consequences

- PHI erasure becomes possible for the population that carries PHI, and the DSR workflow
  (ADR 0130) gains a working meeting lane.
- ⛔ **CORRECTION — this does NOT unblock Critical FUP C1a/C1b.** The FUP, this ADR's Context,
  and four other documents recorded the defect as *blocking* C1a/C1b. Measured 2026-08-19 at
  build time, that link does not hold: **C1a is a run of
  [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md)**, which is the
  **`file_objects` / Storage-bytes** completion mechanism (its § 0 says so: it exists because
  `complete_document_disposal` has no automated caller). The paths are **disjoint in the
  catalog** — `dispose_meeting_minutes` writes no `file_objects` row and never sets
  `disposal_pending`; `complete_document_disposal` never touches meetings; the runbook contains
  **zero** occurrences of "meeting", "minutes_md", or `dispose_meeting_minutes`. ⭐ **A real
  defect was cited for a conclusion it did not bound** — [[a-predicate-quoted-at-the-wrong-grain]]
  — and it failed in the *reassuring* direction, making C1a read as blocked-then-released instead
  of never started. C1a's status is unchanged by this build.
- ⭐ **The correction exposed a larger gap, filed as `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`:**
  the disposal runbook covers **one of the two PHI-disposal substrates**. All four `dispose_*`
  doors erase PHI **in columns**, and no operational procedure covers them at all.
- The guard's refusal stays load-bearing for every non-disposal writer — the §E bound
  narrows by exactly one named, audited door.
- ✅ `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` is **RESOLVED 2026-08-19** on the build
  record above — the pgTAP + sweep evidence, not this text.
- ⚠ **Two residues found while building, filed rather than fixed** (neither is this ADR's
  subject, and Decision 1 binds the migration to amend nothing else):
  `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` (the door redacts three of
  `meeting_agenda_items`' four text columns — `title` survives, as do
  `meeting_attendees.{note,external_name}` and `meeting_closed_sessions.label`; ADR 0056 §2
  declares that scope, so the defect is the *claim*, not a regression) and
  `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`.
- ⭐ **The sibling question was measured rather than filed as a question**, and the answer was
  not the reassuring one: opening each disposal door's gate in turn shows `dispose_case_phi`
  (151, 314) and `dispose_referral_phi` (189) are **covered**, while **`dispose_event_phi` is
  BLIND** — its gate opened alone leaves the full suite **PASS**. So **2 of the 4** PHI-disposal
  doors were door-blind; this build closes one and files the other with its evidence. Neither is
  *vulnerable* — every gate is present and correct — but neither would have gone red if a
  refactor dropped it.

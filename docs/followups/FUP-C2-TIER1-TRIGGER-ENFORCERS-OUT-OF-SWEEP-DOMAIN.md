# FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN

**Filed:** 2026-09-04 (C2 Phase A, while resolving `public.reopen_interview`'s contradiction)
**Owner:** lead + backend
**Severity:** high — a measurement-domain gap in a standing gate's instrument, not a demonstrated
live hole. It cannot produce a false COVERED; it produces a **correct BLIND that is not actionable
as a BLIND**, which is a different and more misleading thing.

## The finding

`public.reopen_interview` came back BLIND from the full sweep. `121_interviews.sql:292-294` pins
`HC038` on the door itself with a `throws_ok`, and `HC038` is the door's **only** anchored raise, in
its **own** body — so by the harness's own mutation semantics (all anchored raises in the target's
body are neutralized at once) that assertion should have gone red and the verdict should have been
COVERED. It did not.

Measured 2026-09-04, with the mutation actually landed: `121` returns `Files=1, Tests=60, PASS`.
The `HC038` the test observes is **not the door's**. It comes from **`app.guard_interview_status`, a
trigger on `case_interviews`** — `cancelled → in_progress` is not in its allowlist, and
`reopen_interview` sets `app.in_interview_rpc='on'`, so execution reaches the trigger. The door's own
`HC038` never fires on that fixture.

⭐ **`app.guard_interview_status` is in 0 of the 171.** The C2 worklist is built from a call-edge
closure (`c2n.edges` → `c2n.clo_full`), and **a trigger function has no call edge from the door that
causes it to fire** — Postgres invokes it from the table, not from the function body. So no trigger
enforcer can ever enter this sweep's population, however load-bearing it is.

## Why this is worth an entry rather than a footnote

The sweep's BLIND verdict here is **correct** — nothing in the suite would notice
`reopen_interview`'s own guard vanish. But the reason is not the usual one. The usual BLIND says
*"this door's refusal is unasserted."* This one says *"this door's refusal is delivered by a
different enforcer, which this instrument cannot see."* Those two require different remedies, and the
findings file cannot tell them apart:

- the usual BLIND is discharged by a keystone on the door;
- **this** BLIND is discharged only by a keystone that constructs a fixture the *trigger* does not
  already refuse — otherwise the new assertion passes for the trigger's reason and the verdict does
  not move, which reads as a failed keystone rather than as a misdiagnosis.

It also means a **defence-in-depth pair can look like a gap**: door guard plus trigger guard, with
the trigger doing the work on the fixture the suite happens to use.

## What it already cost, and what it prevented

Two Phase B specs changed on this reading:

- `public.reopen_interview`'s keystone must use a **`scheduled` / `awaiting_follow_up`** fixture plus
  a message pin, not the `cancelled` one the existing arm uses.
- `public.cancel_interview` needs **no** ADR 0187 D3-style "unreachable raise" ruling — its `HC038`
  *is* reachable — but its keystone must use an **already-`cancelled`** interview, because a
  `completed` one is satisfied by the trigger rather than by the door.

Without the catalog read, the first would have been written against a fixture the trigger already
refuses, and the second would have been written off as dead code.

## Closes when

The sweep's domain statement names trigger enforcers as **out of domain**, so a BLIND caused by a
trigger is distinguishable from a BLIND caused by an absent assertion — either by extending the
worklist derivation to attribute trigger enforcement to the doors that reach the table, or by a
recorded ruling that trigger guards are covered by a different arm and naming which. ⛔ An allowlist
entry does **not** close it: the door is not never-called, and its verdict is not wrong — the
*domain* is unstated, which is precisely the ADR 0079 failure this program exists to prevent
("a gate record names the arm and its domain, never the script").

## Related

- ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) — a verdict is meaningless
  without its domain.
- ADR [0184](../decisions/0184-c2-sweep-runs-against-the-current-branch-schema.md) point 4 — the
  three uncovered populations a gate record must state. **This is a fourth**, discovered after that
  ADR was written, and it should be stated alongside them.
- `docs/reviews/c2-suite-abort-diagnosis.md` — the measurement.
- `docs/design/authz-c2-blind-keystone-specs.md` §6.4 — the contradiction that led here.

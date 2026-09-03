# FUP-VACUOUS-COVERAGE-1 — two PHI-remediation tests that **NEVER RUN**, and `lint:vacuous` is structurally unable to catch them (owner: tester + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status parked

> ### ⛔ BODY WRITTEN 2026-08-17 — this item had **NO body in this file** for its entire life
>
> Until now its single line in PROGRESS.md's head list *was* the whole record, and that line carried
> its own warning: *"THIS LINE IS THE ONLY RECORD — do not compress or cut it believing a body
> exists."* ⭐ **It was found exactly the way that warning anticipated** — by a pre-rotation check that
> asked, for all 54 head entries, *"does this have a body?"* rather than assuming the head list was a
> summary of something. **53 did. This one did not.** A rotation that compressed the head list without
> that check would have deleted the item outright while looking like tidying.
> → [[enumeration-boundary-is-a-syntax-not-a-property]]
>
> ⚠ Context also survives in `docs/reviews/vacuous-assertion-audit.md` and
> `docs/bugs/archive.md`, but neither is the follow-up register, so neither would have
> kept the item *open* — they record it as history, not as work.

**The finding.** `e2e/phi-remediation.spec.ts` **REM-8** and **REM-9** skip on **every** run: there is
no seeded RCA for `EV-0001`, and the only CAPA has a `NULL source_event_id` (both catalog-verified).

⛔ **Why the lint gate can never help here — this is the point of the item.** They are *honest*
`test.skip()`s, not silent greens. `lint:vacuous` (`scripts/check-vacuous-assertions.mjs`) exists to
catch **a test that goes GREEN having asserted nothing**; a test that never runs is **outside that
property**. So the gate is working as designed and the coverage hole is invisible to it —
**two different failures that both end in "the suite is green and the behaviour is untested."**
⭐ Filed *because* the audit that produced the gate noticed the gate's own boundary.

**Why it is its own item and not a drive-by.** Closing it means new fixture work against `seed.sql`,
which is **a contract with ~900 tests** — the shared-fixture hazard in
[[shared-fixture-cannot-satisfy-two-specs]]. Adding a seeded RCA for `EV-0001` and a CAPA with a real
`source_event_id` changes counts other specs assert on.

⚠ **Whoever closes this must show the two tests RUN and can FAIL** — un-skipping them and observing
green proves nothing on its own, which is the same class the parent audit was about.

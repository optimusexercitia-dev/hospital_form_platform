# FUP-DM5-SUPERSEDE-SERVING-COLLISION — ✅ **RULED 2026-08-18: the marking trigger moves to RETENTION EXPIRY; the serving gate is untouched.** Implementation gated on Critical FUP C1 (owner: **backend**; the PO half is discharged)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

> ### ✅ PO RULING 2026-08-18 — **RESOLVED AS (b): the marking TRIGGER moves to RETENTION EXPIRY. The serving gate is NOT touched.**
>
> ⭕ **The PO half of this item is DISCHARGED; what remains under this id is backend implementation
> work, not a decision.** Severity 🔴 → 🟠, owner PO → backend.
>
> **The ruling.** Option **(b)** — amend ADR 0121 D3/D5 so supersession does **not** mark bytes at
> supersession time; the `disposal_pending` marking moves to **retention expiry**, the same clock that
> governs every other version. Option **(a)** — widening `app.resolve_document_version_bytes` to pass
> `disposal_pending` bytes whose reason is `superseded` — was **declined**, on this item's own
> argument: *a narrowing can be wrong and stay safe; a widening cannot.*
>
> ⭐ **What makes (b) more than a scheduling preference: the collision does not get adjudicated, it
> stops occurring.** The two ratified decisions were only ever in contact at the supersession
> *instant*. Move the trigger and `resolve_document_version_bytes` needs no change at all — its refusal
> on *any* non-`none` state becomes correct for **every** reason value that can reach it, because
> nothing marks a version still meant to be servable. **No PHI byte-serving gate is widened, so no
> diff-scoped door sweep and no new keystone is owed against that gate.**
>
> **What survives of D3/D5** (recorded in ADR 0121 **Amendment 2**, not restated here): D3's
> **vocabulary** stands — the `duplicate` trap it was written against (its exemption lane needs a live
> same-`sha256` sibling on the **same** `documents` row, which ADR 0120 D13 guarantees a superseded
> print never has) is untouched. D5's **principle** stands; only its evaluation point moves.
>
> ⚠ **One build-time detail is deliberately OPEN and must not be settled silently:** at retention
> expiry, does the row record `disposal_reason_category = 'superseded'` or `'retention_expired'`? Both
> are true and they mean different things to a regulator. **The implementing slice decides it
> explicitly and records the choice in ADR 0121.**
>
> ⛔ **THE REBUILD IS STILL GATED — by ADR 0121 D1, no longer by an open decision.** *Inflow and
> outflow ship together or neither ships.* The outflow is now the **manual runbook** (ADR 0121
> Amendment 3), so **D11 may be built once the runbook has been rehearsed end-to-end — Critical FUP
> C1 — and not before.** Building the inflow first would convert silent retention into a growing pile
> of `disposal_pending` rows nothing has ever been shown to clear, while the D11 claim reads as
> honoured: exactly the "reads better than it behaves" failure D1 exists to prevent.
>
> ⚠ **The reverted tree stays reverted until that gate opens.** `5b40d62b` is still the state; this
> ruling authorizes a *different* build, not the restoration of the old one.
>
> <details><summary>Superseded — the 2026-08-17 deferral, kept because its reasoning shaped the ruling</summary>
>
> > ### ⏸ PO RULING 2026-08-17 — **DECIDE LATER; the inflow STAYS REVERTED.** The item remains 🔴 OPEN.
> >
> > Both offered resolutions were **declined for now**: neither widen `app.resolve_document_version_bytes`
> > to pass `disposal_pending` bytes whose reason is `superseded`, nor reinterpret ADR 0121 **D3/D5**'s
> > ratified *"superseding marks bytes"*. The tree stays as `5b40d62b` left it.
> >
> > ⭐ **Why deferring is a real position here and not a punt.** The reverted state is *coherent*: no
> > inflow without an outflow (ADR 0121 **D1** satisfied), no unservable superseded prints, and nothing
> > in production depends on D11. The two open options are **not symmetric** — widening a PHI
> > byte-serving gate cannot be un-shipped safely, while the cost of waiting is a `disposal_state` that
> > stays `none` on superseded prints, which harms nobody today.
> > → [[keystone-measured-what-i-built-not-what-breaks]]: *a narrowing can be wrong and safe; a widening
> > cannot.*
> >
> > ⛔ **A DEFERRAL IS NOT A CLOSURE, and three things follow from that.**
> > 1. **This item stays 🔴 and S6 may NOT close over it.** It is not discharged by DM5 completing.
> > 2. **D11 cannot be rebuilt until this is decided** — it is the blocker, and ADR 0121 D3/D5 are
> >    ratified text currently **not implemented**, which the ADR must keep saying out loud.
> > 3. ⚠ **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side** —
> >    superseded print bytes still never retire. Do not read that item as independently open work.
> >
> > ⚠ **The condition that would force this decision:** anything that makes superseded prints accumulate
> > at volume, or a retention/erasure obligation landing on them. Re-put it to the PO then, not on a
> > schedule.
>
> </details>
>
> ⚠ **Two claims above went stale on 2026-08-18 and are corrected here rather than deleted, because
> both are the kind a later reader would otherwise quote as current.** *"D11 cannot be rebuilt until
> this is decided"* — it is decided; the blocker is now **D1's outflow gate** (Critical FUP C1).
> *"`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side"* — still
> true, and the two now move together toward a **build**, not toward a decision.

Filed 2026-08-17 (lead), **found by the Phase Gate, not by review**, after the D11 inflow was
built, keystoned, red-proven and committed. `312` t38 — *"a revoked document still SERVES"* —
died with `documento descartado`. The inflow was reverted (`5b40d62b`); this item is the
decision that has to be made before it can be rebuilt.

**Mechanism, catalog-read.** `app.resolve_document_version_bytes:72` refuses on
`disposal_state <> 'none'` — **any** non-`none` state, not just `disposed`. So marking a
superseded print `disposal_pending` means **the previous PDF stops opening the instant a
document is re-issued.** ADR 0120 **D6/D8** rules the opposite: a print's states change what
the overlay **stamps**, never its **reachability**.

**⭐ The collision is exactly one value wide, and both sides are right.** Refusing to serve
`disposal_pending` bytes is CORRECT for `subject_request` and `retention_expired` — a subject
asked for erasure, so serving stops before the bytes are destroyed. It is WRONG for
`superseded`, where an auditor must still be able to open what was previously issued. The
whole disagreement lives at `disposal_reason_category = 'superseded'`.

**The decision, stated so it can be taken:** either
**(a)** widen `app.resolve_document_version_bytes` to pass `disposal_pending` bytes whose
reason is `superseded` — a change to a **PHI byte-serving gate**, needing its own keystone and
a diff-scoped door sweep; or
**(b)** amend ADR 0121 D3/D5 so supersession does not mark bytes at supersession time (e.g.
marking on retention expiry instead), leaving the serving gate untouched.
⛔ **Not lead-decidable.** (a) widens a PHI serving gate; (b) reinterprets a PO-ratified
decision. A narrowing can be wrong and stay safe; a widening cannot — which is why this
reverted rather than patched.

⚠ **What the D11 keystones did NOT catch, and this generalises.** `342`'s S3p block was
mutation-proven in both directions and green throughout — because it asserted **the inflow**
(bytes get marked) and never asked whether anything **downstream** still worked. The blast
radius was one join away and no assertion in the slice looked there.
[[a-predicate-quoted-at-the-wrong-grain]]: the check ran, it just was not checking the thing.
**When a change writes a new value into an existing state column, sweep every READER of that
column before believing the keystone.**

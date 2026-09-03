# FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES — D11's "superseded bytes retire via `disposal_state`" is **not performed, and nothing can perform it** (owner: PO decision, then backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

> **PO 2026-08-16: DECIDE LATER.** Asked directly at S4 authorization; the PO chose to leave the inline
> `⏳ CONTESTED` pointer in ADR 0120 D11 and keep this open. Nothing in S4 depended on it. **Still owed
> before DM5's phase QA at S6** — build it or strike it; do not let S6 close over it silently.
>
> ### ⏸ RE-RULED 2026-08-17 — still DECIDE LATER, but the reason has CHANGED and that matters
>
> ⛔ **This is no longer "not yet built." It was BUILT (`6181557e`), and the build FAILED THE GATE.**
> The inflow was reverted at `5b40d62b` because marking a superseded print `disposal_pending` made
> **every superseded print unservable** — `app.resolve_document_version_bytes:72` refuses on **any**
> non-`none` `disposal_state`. So the blocker is no longer effort or scheduling; it is a **head-on
> collision between two ratified ADRs** (0121 D3/D5 vs 0120 D6/D8) at exactly one value,
> `disposal_reason_category = 'superseded'`.
>
> ⭐ **Read this item and `FUP-DM5-SUPERSEDE-SERVING-COLLISION` as ONE deferral seen from two sides** —
> this is the missing **inflow**, that is the **decision** gating it, and `FUP-DM5-DISPOSAL-JOB` is the
> missing **outflow**. ⛔ **Do not resolve any of the three alone**: ADR 0121's own argument is that
> fixing the inflow alone *"would make things look better and destroy nothing"* — a growing pile of
> `disposal_pending` rows no code path can clear, while D11 reads as honoured.
>
> ⚠ **What the D11 keystones did NOT catch, kept because it is the transferable part.** `342`'s S3p
> block was red-proven **both ways** and stayed GREEN — it asserted the **inflow** (bytes get marked)
> and never asked whether any **reader** still worked. The blast radius was one join away and no
> assertion in the slice looked there. → [[a-predicate-quoted-at-the-wrong-grain]] — the check ran, it
> just was not checking the thing.
>
> ### ✅ DECIDED 2026-08-18 — **BUILD IT, at retention expiry. The item is now WORK, not a question.**
>
> The PO ruled the collision as **(b)** (ADR 0121 **Amendment 2**): supersession does not mark bytes;
> the marking moves to the **retention clock**. So D11's clause — *"retires superseded bytes through
> `file_objects.disposal_state`"* — **stands and gets built**; only its trigger changes. The serving
> gate is untouched, which is what makes the build cheap and un-scary.
>
> ⛔ **Still not startable, and the reason has changed AGAIN — track this, because it is the third
> distinct blocker this item has had.** Not "unbuilt" (2026-08-16), not "an undecided collision"
> (2026-08-17), but **ADR 0121 D1**: inflow and outflow ship together or neither ships. The outflow is
> now the **manual runbook** (0121 Amdt 3), so the gate is its **end-to-end rehearsal — Critical FUP
> C1**. ⭐ *A stale blocker reads exactly like a live one*, so state which one is current whenever this
> item is quoted.
>
> ⚠ **Two things below are now stale and are corrected, not deleted:** *"the PO picks"* between the two
> resolutions — picked, build it; and the framing of this as a **decision** — it is an implementation
> item, and its owner is **backend**.

Filed 2026-08-14 (lead) from `qa`'s DM5·S3 review MINOR-4. **Not an S3 bug — an ADR-0120 D11 claim that the
implementation cannot honour**, so it must be either built or struck from D11.

**Measured:** re-minting supersedes the prior print (`status='superseded'`, `superseded_at` set), but **both
the old and new `file_objects.disposal_state` stay `none`**. Nothing schedules retirement, and retirement is
operator-initiated — so a superseded print's bytes persist indefinitely. The **SUBSTITUÍDO overlay** on
download depends on that lifecycle, and ADR 0114 **O1** is the same open question one layer up.

**Why it matters beyond tidiness:** this is a **20-year-retention, LGPD/ANVISA** system where "the superseded
copy is retired" is the kind of sentence an auditor reads as a control. An ADR asserting a control that no code
performs is worse than an ADR that admits the gap. Two honest resolutions, and the PO picks:
**(a)** implement retirement (scheduler or an explicit operator action) — then D11 is true; or **(b)** amend
D11 to say superseded bytes are **retained** and the overlay is the only distinction — then the record is true.
⛔ Do **not** resolve it by adding a comment saying retirement "should" happen.

# FUP-DM5-SIBLING-GUARD-DIFF — **no authz arm can see a door that OMITS a check its sibling doors all make** (owner: lead + backend; a gate-coverage gap, not a defect)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

> ## ⭕ FOLDED INTO CRITICAL FUP C2 TIER 1 — 2026-08-18 (DM-FUP TRIAGE #5)
>
> This wants a transitive catalog guard-set diff over `prosecdef` doors. So does C2's Tier-1 door sweep
> sweep, and so does `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`'s re-pointed arm
> (`app.resolve_document_version_bytes`). **One piece of door-mutation machinery, three consumers** —
> building it three times was declined.
>
> ⚠ **Absorption is not closure.** This item keeps its own index line, its own severity, and needs its
> own recorded verdict; it closes when the diff exists **with a positive control**, not when Tier 1 ships.

Filed 2026-08-14 (lead) on confirming **BUG-DM5-S3-INACTIVE-PRINT-1** (PROGRESS.md).

**The gap.** ADR 0079's standing gate has five arms and **none of them can detect this class**:
`floor` asks *is the door called*; diff-scoped `policy` asks *does anything notice when a gate is
opened*; `census` asks *has anything ever asked*; `hat` asks *does it read `memberships` without
the caller's hat*; `wrapper` covers the `prosecdef = f` half. **Every arm tests a gate that is
there.** A *missing* term is invisible to all five, because neutralizing nothing changes nothing —
and it is invisible to review too, since the door reads perfectly sensibly on its own.

**The specimen.** `app.can_read_document` guards `app.is_active(p_uid)` **above** its type dispatch;
`app.can_view_printed_document` has no effective `is_active` term, because its `form_response` arm's
first disjunct is the bare column comparison `v_resp.created_by = p_uid`, behind an `or`. Confirmed
by probe, not by reading. Latent only because `document_printing` ships OFF.

**Proposed check** (cheap, and it is a *comparison*, not a new mutation arm): for each family of
doors guarding one resource class, diff their guard sets from the catalog — `is_active`, tenancy,
flag assert, PHI gate, disposal, status — and require every asymmetry to be either fixed or
**recorded as deliberate**. Two design constraints learned the hard way:
1. Resolve each term **transitively**, and treat a term reached only through an `or` as **absent** —
   a callee cannot rescue a disjunction. (Bare structural `prosrc ~ 'is_active'` would have called
   `is_staff_admin_of_for` sufficient and **cleared this door**.)
2. It must carry a **positive control**: assert the door returns `true` for an *active* principal
   before flipping the bit, or the `false` afterwards proves nothing.

⚠ **Do not fold this into `p0-authz-invariant.sh` as a sixth arm without sizing it** — the four
phase-step arms are 2 s / 10 s / 1 min / 2 s precisely because they are cheap; a full-closure guard
diff over every door family is a periodic audit, like `ARM=wrapper`'s ~100 min sweep. Decide which
it is *before* writing it, and if it lands as periodic, say so in §6 rather than calling it standing —
"standing in prose alone" is what let three weeks pass before a sweep that then found 15 BLIND gates.

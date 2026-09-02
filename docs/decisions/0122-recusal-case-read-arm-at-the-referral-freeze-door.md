# ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL)

- **Status:** ACCEPTED — PO-ruled 2026-08-17, **overturning** the PO's own 2026-08-14
  deferral of this item to the Phase 19 access plane.
- **Context:** `FUP-DM4-RECUSAL`, found by `qa` at DM4 r1 (MAJOR-3) and demonstrated live
  in a rolled-back transaction. Touches ADR **0119** D4 (which reasoned about this seam
  for the D15 *clearance* plane) and ADR **0114** Amdt 1 D16 (the access plane the item
  was deferred into). Body: [follow-ups-open.md](../progress/follow-ups-open.md).

## Decisions

**D1 — Fix now, not in Phase 19.** The deferral was legitimate only while
`documents_wave_c` ships OFF, and this item's deadline was always the **flag-on date**,
not Phase 19's delivery date. ⛔ QA's standing caveat is the binding reason: **a plane
that only WIDENS cannot close an under-inclusive gate**, so "Phase 19 delivered an access
plane" could never have discharged it. Shipping the flags with this open ships a known
PHI hole.

**D2 — The guard is `app.can_read_case`, and it sits ABOVE the `p_kind` dispatch.**
Not inside the document arm where the item was filed. Reading the live body for the fix
showed the **`narrative` arm has the same omission** — it freezes `case_narratives.body_md`
from the source case with no case-read check either. A guard placed in the reported arm
would have closed the reported instance and left its sibling open: the exact shape that
cost BUG-DM5-S3-INACTIVE-PRINT-1 and is filed as `FUP-DM5-SIBLING-GUARD-DIFF`. Above the
dispatch, no present or future arm can omit it — mirroring how `app.can_read_document`
guards `app.is_active` above its own type dispatch.

**D3 — `can_read_case`, NOT `can_read_document`.** `can_read_case` is the term the ADR-0072
/ ETH·E1 exclusion perimeter is actually expressed in, so it is what closes the
demonstrated hole. A second, tighter `can_read_document` narrowing has unmeasured blast
radius, and this program has already **rejected** once an authorization change driven by
testability rather than by a demonstrated gap (ADR 0120 D12's commission-membership arm).
If it is wanted, it needs its own evidence.

**D4 — A discriminating errcode: `HC0DM`.** Free across `app` + `public`. Reusing the
door's generic `HC077` would have made the refusal indistinguishable from "not found" —
and this program has already paid for an ambiguous code being ambiguous **to the test
too** (`HC0D8` for both absence and unreadability).

## Evidence — why the refusal proves what it claims

⚠ **The fixture is the trap** (pgTAP `236` §7.1 #3): a refusal proves nothing unless the
refused principal still holds the *other* authority. Measured on the live catalog:

| fact | measured |
| --- | --- |
| `can_read_case(case, coordinator)` after recusal | **false** |
| `can_manage_referral_source(referral, coordinator)` after recusal | ⭐ **true** |

Source authority reduces to `app.is_staff_admin_of_for(source_commission_id, uid)` — a
purely **commission**-scoped term with **no case arm** — which is precisely why the two
planes diverge. That divergence is the vulnerability, and it is pinned by `340` **R4**.

**Red-first, against the pre-migration catalog:** R1–R4 green, **R5/R6 red** with
`caught: HC077 / wanted: HC0DM`. ⭐ That `HC077` *is* the finding — the recused
coordinator reached past every gate into the arm's **own content lookup** ("narrativa não
encontrada"), i.e. the door was saying *"I would have frozen it, but that id does not
exist."* With a real document id it would have succeeded. Post-migration: **82/82 green**,
with the pre-existing C1a/C3/C4 freeze assertions unaffected (`can_read_case` is `true`
for their non-recused coordinator, verified before the change).

## Consequences

- `FUP-DM4-RECUSAL` closes against a **narrowing arm proven by a negative twin**, which is
  the only closure QA's caveat admits. It is **not** absorbed into a batch narrative.
- ⚠ The follow-up's own text says the door *"checks `can_manage_referral_source`"*. It does
  not — the live gate is `app.assert_referral_draft_writable`, which calls it. The
  substance held; the paraphrase was recorded as a quotation. *A door's guard set is read
  from the catalog, never from a description of it.*
- Phase 19's D16 access plane no longer inherits this obligation. It should still be
  reviewed for the **narrowing** direction generally — this fix closes one seam, not the
  class.

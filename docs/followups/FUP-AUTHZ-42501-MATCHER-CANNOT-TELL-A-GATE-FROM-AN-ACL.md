# FUP-AUTHZ-42501-MATCHER-CANNOT-TELL-A-GATE-FROM-AN-ACL — `398`'s negative arms pass identically whether the door refuses or the grant is gone

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-08 · status open

**Found while doing something else** — pre-AE5 Batch 7 Track C, probing
`public.recover_orphan_person_to_org` for the reachability analysis the PO ordered in ruling R25. The
probe revoked the function's `authenticated` grant (rolled back) to see which arms of
`supabase/tests/398_adr0168_three_doors.sql` would notice. **Only the `lives_ok` reded.**

**The mechanism.** `398`'s negative assertions are `throws_ok(…, '42501')`. SQLSTATE `42501` is
`insufficient_privilege`, and **both** of these raise it:

| what happened | who raised it | SQLSTATE |
|---|---|---|
| the door's own authorization gate refused the caller | `…_impl`, deliberately, in pt-BR (`sem permissão`) | **42501** |
| the caller no longer holds EXECUTE on the door at all | PostgreSQL's ACL check, before the body runs | **42501** |

⇒ The matcher **cannot tell the two apart**. A revoke turns "the gate refused you" into "you cannot
call it", the assertion stays green, and what the test *measures* has silently changed from
*the door enforces its rule* to *something, somewhere, said no*.

⛔ **This is not a defect today.** The grant is in place, the gate is what fires, and `398` is
green for the right reason. It is filed because **the reason is not the one the assertion checks**,
and a scheduled piece of work is going to change it.

**Why it is filed now rather than left for whoever hits it.** Batch 7's ruling R1 deferred execution
of AE1's 233 classified revokes to its own later unit. That unit's whole job is moving EXECUTE
grants. If it touches anything `398` covers, `398` reports success while measuring a different
property — and the unit would have no reason to look, because a green suite is exactly what it
expects. ⭐ *A green gate can mean the fixture cannot reach the failing state.* Here it is narrower
and worse: the fixture reaches a **different** failing state and cannot tell.

**What would close it.** Make the negative arms distinguish the two sources of `42501`, then **prove
the distinction discriminates**:

1. Match on something only the door produces — the message text (`sem permissão`, not
   `permission denied for function`) — or assert `has_function_privilege('authenticated', …)` is
   **true** immediately beside the throw, so the arm states *the caller could have called it and was
   refused on the merits*.
2. ⛔ **Prove it red.** In a rolled-back probe, revoke the grant and observe the repaired negative arm
   **fail**. Without that, the repair is a claim about a matcher, and a matcher is exactly the thing
   that was wrong.
3. Sweep the sibling arms in the same file for the same shape rather than fixing the one arm the
   probe happened to land on — ⭐ *naming the instance found instead of the class* is this repo's
   most-repeated framing error, and a `throws_ok(…, '42501')` is a syntax, not a property.

⛔ **What must NOT be mistaken for closing it.** ⛔ A comment in `398` warning future readers — a
comment is an assertion that goes stale silently and no gate reads it. ⛔ "The revoke unit will
notice at the time" — it will not; that is the finding. ⛔ Repairing only
`recover_orphan_person_to_org`'s arms, which are merely where the probe landed.

**Bound on this entry.** The probe measured **one** function's arms. Whether other pgTAP files carry
`throws_ok(…, '42501')` over an authorization gate was **not enumerated** — that enumeration is part
of item 3, not a claim being made here. ⚠ Stated so the next reader does not read this as a
completed census of the class.

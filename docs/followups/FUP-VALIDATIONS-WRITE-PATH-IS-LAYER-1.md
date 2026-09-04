# FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1 — the re-keyed `form_item_validations` policy is an unreachable backstop, and its real writer is not re-keyed

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

`form_item_validations_staff_admin_write` was re-keyed onto `app.can_edit_commission_forms` by migration
`20261003007340`, closing `BUG-AE49-D6-REKEY-INCOMPLETE`. That re-key is **conformance, and it cannot
widen anything — because the policy gates nothing a client can reach.** `authenticated` holds **SELECT
only** on the table (table *and* column grants, catalog-measured), so no PostgREST write ever reaches the
policy. The real write path is the DEFINER `public.set_item_validations`, which still gates on
`is_staff_admin_of` — **layer 1, not re-keyed**.

So for this table the permission `commission.forms.edit` is load-bearing on a door **nothing opens**, while
the door that is actually used answers to the legacy role check.

**How it was found — and the instrument nearly lied.** The probe was written behaviourally first: a
`lives_ok` baseline plus a `throws_ok('42501')` mutated twin. The baseline **died `42501 permission denied
for table`** — and the mutated twin **PASSED**. Had only the twin been read, it would have reported the
gate flipping while measuring a grant that never moved. ⭐ This is the tree's standing class: *a green
assertion can mean the fixture cannot reach the failing state*, and the negative control passed for the
wrong reason.

**What would close it.** Either re-key `public.set_item_validations` onto the permission — which is the
real door and the only change that makes the permission load-bearing for this table — or record the split
deliberately: the policy is a backstop, the DEFINER is the enforcement site, and the manifest row says so.
⛔ Closing it by pointing at the re-keyed policy is precisely the error: the policy is the half that does
not matter.

⛔ **What must NOT be mistaken for closing it.** A green pgTAP `409`/`410`: both now assert the *policy* is
re-keyed, which is true and is not the question. Nor does the six-site closure in
`FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE` cover it — that arm asks whether declared sites are re-keyed,
not whether a re-keyed site is **reachable**.

⚠ **Suspected class, not yet swept.** `form_block_library` was found the same way (SELECT-only grants, all
writes through DEFINER doors). Two instances in one permission row suggests the reachability question is
worth asking of every `_staff_admin_write` policy in the tree, not just these two.

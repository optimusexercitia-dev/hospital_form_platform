# 0177 — AE4.9 D4/D7 as built: the candidate's state set, the denial precedence, and the state gate's reach into seeded grants

**Status:** Accepted · 2026-09-02 (backend, implementing ADR 0176 D4 + D7 on `authz-ae4-catalog`)
**Implements:** [0176](./0176-authz-permission-layer-made-real.md) D4 (the resolver's corrected
contract) and D7 (`assume_role` enforces `session_selectable`). 0176 ruled *what*; four questions it
did not settle had to be answered to build it, and one consequence was discovered by the build.
**Relates:** [0174](./0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md) D2 (the
state gate this extends to layer 2) · [0175](./0175-ae45-differential-oracle-scope-and-f3-discharge.md)
(the differential this repoints) · [0172](./0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
(the deferred classification columns — untouched) ·
[0079](./0079-authz-door-blindness-standing-invariant.md) (the arms below) ·
[plan § AE4.9](../plans/authz-evolution.md)

## Context

`20261003007250` and `20261003007260` land 0176's two "do now" items. The zero-caller premise was
measured on the live catalog **before** (`pg_proc.prosrc ~ 'has_direct_permission|explain_direct_permission'`
→ zero rows) and **after** (`has_permission`, `candidate_has_permission` and `explain_permission`
each have zero callers). The five defects 0176 D4 names were each reproduced first, in a rolled-back
transaction at head `20261003007240`: scope kind `hospital` — and `banana`, and NULL — granted; the
resolver granted while `holds_role` denied under `legacy`; a deleted grant and a foreign-org
commission both explained `scope_unreachable`.

## Decision

**D1 — The candidate evaluator sees `test_validation` AND `authoritative`, and NOT `legacy`.**
0176 D4 says the candidate "may see roles in `test_validation`" and does not name the third state.
A `legacy` role's catalog mapping has not been ratified, so an oracle that read it would be
differentialling an unapproved mapping and reporting the result as agreement. The pre-cutover
sequence is `legacy → test_validation → authoritative`; the oracle joins at the middle state, which
is also the *only* state where candidate and runtime disagree — and therefore the only state in
which the split is observable at all rather than being a rename. pgTAP `407` §3 asserts all three
states against both evaluators.

**D2 — One shared join, with the gates returned as COLUMNS.** `authz.entailed_grants` is the single
copy of the five-way entailment join; it applies no state gate and no hat, returning `role_state`
and `hat_ok` so each of the three consumers applies what its own contract requires. Three hand-kept
copies of that join would drift, and only a gates-as-columns shape lets the explanation say *which*
gate blocked. ⛔ It is therefore **not an authorization answer** and must never be called by a
policy, a door or a product path. It is `SECURITY DEFINER` with a pinned empty `search_path` and no
application-role EXECUTE — deliberately the same shape as its `authz` siblings, so it inherits
exactly their arm memberships and introduces no new door shape.

**D3 — The denial precedence is stated, and it is a total order.** `explain_permission` walks:
1 `unknown_permission` · 2 `scope_kind_mismatch` (NULL kind included — fail closed) ·
3 `principal_inactive_or_unassigned` · 4 `scope_unreachable`, **computed with no permission join at
all** · G `granted` · 5 `wrong_active_role` (an authoritative path exists; the hat blocks) ·
6 `role_not_authoritative` (a path exists; the state blocks) · 7 `permission_not_granted`. Exactly
one fires. 5 outranks 6 because the hat is the caller's own immediate, fixable context while the
state is a property of the deployment; 4 sits above G so that reachability is answered
independently rather than falling out of the granting query, which is defect (5)'s actual cause.
The **granting path** is the lowest `role_code`, then the lowest `granting_permission_code`, both
under the `C` collation — byte order, so it does not move with the database's collation.

**D4 — Two migrations, not one.** D4 and D7 are independent decisions over disjoint objects
(`authz.*` resolver family vs `public.assume_role`), they carry different `door-sweep-targets`, and
either can be reverted without the other. `20261003007250` uses DROP + CREATE (a rename would leave
the AE4.4b body in place under a truer name, and the composite's attribute type cannot change while
a function returns it); `20261003007260` uses the house `pg_get_functiondef` + `replace` idiom so a
body that has drifted fails LOUDLY instead of being silently reverted.

**D5 — The AE4.5 differential (pgTAP `403`) is repointed at the CANDIDATE evaluator.** 0176's own
Consequences name the differential's halves as *candidate vs matrix*. A suite pointed at the runtime
evaluator would report "the catalog denies everything" for every AE5 role increment, because a role
under differential is by definition not yet `authoritative`. `403` §3.2b asserts the bound that makes
this cost-free today — zero roles are in `test_validation`, so the two evaluators are
indistinguishable over this fixture — and states that the day it reds, this suite stops being
evidence about the runtime path, which is correct and must be recorded rather than repointed away.

**D6 — Discovered, not decided: a role's `authz.role_permissions` rows are INERT until its state
flips.** pgTAP `401` §16.10 (the many-to-many hat translation) went RED on its first run after the
migration, because its second granting role is `staff` — `legacy`. The gate is correct and the
fixture was wrong; §16.9b now pins the fact as its own assertion. ⛔ **Consequence for AE5, recorded
here because it is a trap and not a footnote: seeding a role's grants is not cutting it over.** An
increment that seeds `authz.role_permissions` and forgets the state flip is observationally
identical to one whose grants were never seeded. No production answer moves today — `staff_admin` is
the only role with grants and it is already `authoritative`.

**D7 — `assume_role`'s fail-closed branch is reachable only for `platform_admin`, and that is
asserted rather than argued.** `memberships_role_scope_kind_fkey` is `MATCH FULL … ON DELETE
RESTRICT`, so a membership cannot exist for a role the catalog does not carry and the catalog row
cannot be deleted while one does — the no-row branch is unconstructible for every
membership-derived role. `platform_admin` is the exception because its arm of `assume_role` reads
`profiles.is_admin` and touches no membership, so pgTAP `408` §4 constructs the state and proves the
denial. The FK retires at AE5-complete (0162 §2); this gate is what stands behind it afterwards.

## Consequences

- **Every new behaviour is proven on both polarities, and the "before" half is frozen INSIDE the
  suite.** `407` §§2 and 4 carry hand-frozen copies of the dropped AE4.4b bodies and assert they
  still answer the old, wrong way — so the corrections stay anchored on a measured defect long after
  the pre-change catalog is unreachable. ⚠ Those copies are legitimate only because their subjects
  were DROPPED and can never drift; a frozen copy of a LIVE body would be the usual hazard.
- **The suites were shown able to RED.** With the corrections reverted in place on a live stack,
  `407` fails 13 of 54 and `408` fails 3 of 17, each on exactly the assertions the change owns; the
  discrimination halves (`408` §3.2/§3.3) correctly stay green in both worlds.
- **`ARM=census` did its job and the four new objects split four ways.** Only
  `authz.has_permission` is in the door sweep's predicate domain (**COVERED**);
  `candidate_has_permission` is boolean but excluded **by NAME**
  (`FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`), `explain_permission` is scalar non-bool and
  `entailed_grants` is set-returning-and-unreachable — the C2 / row-door classes. ⛔ Same domain
  exclusion, **four different reasons**; they may not be recorded as one class, and absence of a
  verdict is absence of coverage.
- **`public.assume_role` kept its NAME and changed its BODY**, which `ARM=census` cannot see by
  construction. `scripts/door-sweep-cases.sh` is what surfaced it — not recall.
- **No product answer moves.** No policy, wrapper, door or ACL changed; `npm run gen:types` produced
  an empty diff (`authz` is not an exposed schema and `assume_role`'s signature is unchanged); and
  the `session_selectable` gate denies nothing on seeded data, which is precisely why its proof is a
  mutation.
- ⛔ **What this does NOT do:** it re-keys no enforcement site (0176 D6's three representatives), it
  builds no enforcement manifest (0176 D5), it does not touch `platform_role` (0176 D8), and it
  measures no performance (0176 Consequences — that comes after the seam, on the final path).

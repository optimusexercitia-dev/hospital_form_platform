# 0167 — commission `staff_admin` has ONE authority, on both sides

**Status:** Accepted · 2026-08-28
**Amends:** 0078 (A35's noun rule is applied to a case it did not name: `platform_admin` could
**seat** a commission coordinator, which is commission content.)
**Amends:** 0051 (the TS gate for coordinator management is widened to the hospital tier the layout
already admits, closing a rendered-but-refused surface.)

## Context — a grid measured on a fresh reset, not read from migration text

| actor | comments at `admin/actions.ts:238`/`:307` | TS gate | `grant_role` | `revoke_role` |
| --- | --- | --- | --- | --- |
| `platform_admin` | claims allowed | ⛔ **REFUSED** | ✅ **ALLOWED** | ⛔ **REFUSED** |
| `org_admin` of the org | claims allowed | allowed | allowed | allowed |
| `hospital_admin` of the commission's hospital | not mentioned | ⛔ **REFUSED** | ✅ **ALLOWED** | ✅ ALLOWED |

Three independent defects, each verified in `pg_proc` and the app source:

1. ⛔ **A one-way door.** `grant_role_impl`'s commission arm reads
   `app.is_admin_for(p_actor) or app.is_tenancy_admin_of_for(...)`; `revoke_role_impl`'s reads
   `app.is_tenancy_admin_of_for(...)` **alone**, under a comment calling the asymmetry
   *"INTENTIONAL … (QA m1)"*. So a platform admin may **seat** a commission coordinator and may
   **not remove one** — escalation with no matching de-escalation by the same actor. ⚠ Whatever is
   decided, that cannot be the answer.
2. ⛔ **A live user-facing gap.** `app.is_tenancy_admin_of_for` admits `hospital_admin`, but
   `authorizeStaffAdminOps` requires a non-empty `orgAdminOf` and **never reads `hospitalAdminOf`**.
   The manage layout admits `hospital_admin` by design (ADR 0051) and the commission page adds no
   `isOrgAdmin` gate — so a hospital admin **sees the coordinator form and is refused on every
   click**, while the door beneath would have said yes.
3. ⚠ **A stale premise.** The security docstring excludes `platform_admin` because *"assignStaffAdmin
   runs on the SERVICE-ROLE client … so this TS check is the ONLY control on that path."* False since
   ADR 0094 W3/T3.3: the membership write moved to the cookie client and the kernel re-derives
   authority; the admin client survives only for `resolveOrInviteUser`. **The conclusion still holds;
   the argument for it does not.**

## Decision

**`app.is_tenancy_admin_of_for` is the single authority for commission `staff_admin`, on both sides,
and TypeScript mirrors it.**

1. **Drop `app.is_admin_for(p_actor)` from `grant_role_impl`'s commission/`staff_admin` arm** — closing
   the one-way door by aligning **grant down to revoke**.
2. **Widen `authorizeStaffAdminOps` to `org_admin` OR `hospital_admin` of the commission's hospital**,
   by **reusing `isCommissionAdmin`** (`src/lib/auth/access.ts`), which already has exactly that
   shape. ⛔ Do not re-derive the predicate a second time — a third copy is how this repo's
   sibling-axis defects keep recurring.
3. Correct the two false comments and replace the docstring's reason with *"the kernel is now the
   control, and the kernel excludes `platform_admin`"*. The same docstring's route is also stale:
   `StaffAdminManager` moved to `/o/[org]/manage/comissoes/[commissionSlug]`.

**Why close rather than open.** The same kernel already rules this way twice, verified in `pg_proc`:
`technical_director`/`technical_director_deputy` and `quality_reviewer` both gate on
`is_org_admin_of_for … or` the hospital tier with **no `is_admin_for` arm at all**. A `staff_admin`
builds forms and manages the commission roster — it reaches committee content at least as directly as
either. ⭐ And the commission arm's `is_admin_for` is the odd one out in a second way: the hospital
arm's identical clause cites AFF T2.5 / ADR 0097 D17 / BLOCKER-1 **by name**; this one cites nothing.

**Bootstrap, checked not assumed:** `grant_role`'s `organization`/`org_admin` arm **keeps** its
`is_admin_for`, so `platform_admin → org_admin → staff_admin` is intact and no commission is left
unseatable.

## Consequences

- ⚠ **Clause 1 is a NARROWING** — a `platform_admin` loses the ability to seat a commission
  coordinator directly through `public.grant_role`. It must be enumerated and mutation-proven, and
  ⛔ **a red in any pgTAP or E2E fixture that seats a `staff_admin` AS a platform admin is a real
  reachability finding, not a test to patch.**
- ⚠ **Clause 2 is a WIDENING** — a `hospital_admin` gains a capability in TypeScript. It is not a new
  authority: the DB door has admitted them all along, so this closes a gap between the rendered
  surface and the kernel rather than opening one.
- ✅ **The QA m1 "INTENTIONAL asymmetry" note is RETIRED.** It described a real asymmetry and judged it
  deliberate; the asymmetry is real and is a defect. Both sides now read the same predicate, so the
  note has no subject.
- ⚠ It changes a `prosecdef` gate, so it takes `ARM=census` plus a diff-scoped sweep derived by
  `scripts/door-sweep-cases.sh` (never by hand).
- ⛔ **This ADR settles the commission `staff_admin` arm only.** The other `grant_role_impl` arms
  keep their own actor grids; nothing here rules on them.

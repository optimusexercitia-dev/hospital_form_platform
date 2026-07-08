# 0061 — "Administrativo" delegated-capability role (per commission)

**Date:** 2026-07-07 · **Status:** accepted / implemented *(2026-07-08 — built behind
the off-by-default `administrativo` flag; pgTAP 45/45, Administrativo E2E 10/10, full
regression clean, QA APPROVED — see
[docs/reviews/administrativo-review.md](../reviews/administrativo-review.md) and the
implementation handoff at
[docs/plans/administrativo-delegated-role.md](../plans/administrativo-delegated-role.md))*.
**Relates:** ADR [0033](0033-case-access-control.md) (per-case access ACL — reused for the
assignment→access grant); the membership write-path lockdown + guarded-DEFINER-door posture
(migrations `20260711000000`, `20260713001300`). **Binding rules:** Rule 1 (RLS is the
security boundary), Rule 10 (pt-BR UI), Rule 11 (audit), Rule 12 (PHI minimum-necessary).

> **Numbering note:** ADR [0060](0060-flexible-forms-foundation.md) loosely reserved
> "0061+" for the deferred Flexible-Forms (FF-1…FF-5) phases. This unrelated feature claims
> 0061; the FF-phase ADRs become **0062+**.

## Context

Committees need a helper for bureaucracy — scheduling meetings, opening cases, assigning
case phases to members, tracking signatures — **without** the full authority of the
committee coordinator (`staff_admin`). The platform's authority model is a fixed two-tier
per-commission enum (`staff` / `staff_admin`) checked through `app.is_staff_admin_of()` /
`app.is_commission_admin_of()`; there is no mechanism to delegate a *subset* of coordinator
powers.

A key real-world constraint from the product owner: the committee "secretary" is
**frequently the coordinator themselves**, so the *title* "Secretário(a)" and the
*authority* to do administrative work must be **fully decoupled**. The member `title`
system (`commission_member_titles`) is deliberately display-only (zero authority) and stays
exactly as-is; this feature does not touch it. The delegated authority is a **separate**
concept, named **"Administrativo"**.

Decisions were taken in a structured design interview with the product owner (2026-07-07).

## Decision

1. **Introduce an "Administrativo" appointment + a curated, finite capability menu**, granted
   per-member by a coordinator, layered on a normal `staff` member. **No new role enum
   value**; the label comes from the appointment, never from a title. Because a coordinator
   already holds every capability implicitly, Administrativo only means anything on a
   non-coordinator `staff` member.
2. **Explicit appointment, two tables** (a member may be Administrativo with zero
   capabilities): `commission_administrativos` (the appointment) + a child
   `commission_administrativo_capabilities` (FK-cascade on un-appointment). Capability keys
   (finite, CHECK-constrained): `schedule_meetings`, `create_cases`, `assign_case_phases`,
   `view_signoffs`.
3. **Authorization via guarded SECURITY DEFINER doors, not policy-broadening.** A helper
   `app.member_can(commission, capability)` is OR-composed into the *specific* RPCs for each
   capability. The `cases`/`case_phases` `FOR ALL` write policies are **left untouched** —
   they govern dangerous verbs (conclude/cancel/terminal-status, phase settle) that
   `close_case`/`cancel_case` gate on nothing else, so broadening them would leak conclusion.
   Only `meetings_staff_admin_write` (no PHI, no terminal transition) is opened directly.
4. **Cases: create + edit meta, never conclude/cancel.** Create rides the existing `create_case*`
   RPCs (gate widened); edit rides a **new narrow `update_case_meta` RPC** exposing only
   label/department (never status/outcome/PHI); `close_case`/`cancel_case` gain an explicit
   coordinator-only gate (defense-in-depth). `set_case_outcome` stays coordinator-only.
5. **Phase assignment grants the assignee the access to work the phase — for every assignment,
   coordinators included** (a deliberate behavior change; today assignment gives read-only).
   Implemented by `activate_phase`/`reassign_phase` calling an unchecked `case_access` write
   grant (reusing ADR 0033's ACL — auditable, revocable), **not** by teaching
   `can_write_case_content` "assignee ⇒ writer".
6. **Signatures: view-only.** `view_signoffs` opens the `list_signoff_queue` read; the signing
   path (`sign_section` / `can_sign_section`) is never touched.
7. **Escalation guard + audit + flag.** Appoint/grant RPCs are gated `is_staff_admin_of OR
   is_commission_admin_of` (a holder can never appoint or grant — including to themselves);
   both tables are append/delete-audited; the whole surface ships behind an **off-by-default**
   `administrativo` feature flag.

Full object-by-object wiring, the leak-guardrail list, frontend surfaces, tests, and
end-to-end verification live in the handoff doc referenced above.

## Alternatives rejected

- **A new `secretary`/`administrativo` role in the `commission_members` enum** — large blast
  radius (a new `is_*_of` predicate wired through ~40 policies), collides with the display-only
  "Secretário" title, and conflates authority with a label the coordinator often also wears.
- **A fixed capability bundle** (every Administrativo identical) — fails the "coordinator picks"
  requirement. **An open per-action ACL** — combinatorial RLS, easy to misconfigure; the
  curated finite menu is the safety feature (each key maps to a known, audited surface).
- **Coupling capabilities to the "Secretário" title** — breaks the title-is-display-only
  invariant and the coordinator-is-often-the-secretary reality; authority stays orthogonal.
- **OR-ing `member_can` into `cases_staff_admin_write` / `case_phases_staff_admin_write`** —
  would hand an Administrativo raw `status`/`closed_*` UPDATE (conclude/cancel bypass) and raw
  phase skip/complete (settling phases to unblock closure). Route through guarded DEFINER RPCs.
- **Extending `can_write_case_content` to treat any phase assignee as a writer** — silently
  widens write on every case with an assigned phase, is unauditable and hard to revoke; the
  explicit `case_access` grant is preferred.

## Consequences

- Committees can delegate bureaucracy to a non-coordinator **without** introducing a new role
  tier; the RLS blast radius is confined to ~8 guarded RPCs + 1 broadened policy + 4 new SQL
  objects, all behind a flag.
- **Behavior change:** every phase assignment (coordinator or Administrativo) now auto-grants
  the assignee `case_access` write. Existing case/phase E2E must be updated.
- **PHI note (Rule 12):** granting `create_cases` lets an Administrativo enter and read patient
  context on PHI-bearing commissions (via the case creator/assignee read arms). Minimum-necessary
  is satisfied by the explicit, per-member, coordinator-granted, flag-gated nature of the grant —
  the manager UI must state this plainly. No new PHI table or module is introduced; the enumerated
  PHI-module set is unchanged.
- **Title system is untouched** — "Secretário(a)" remains a pure descriptor with zero authority.
- Status advances to **accepted/implemented** once the feature is built and passes the phase gate;
  until then this ADR records the committed design.

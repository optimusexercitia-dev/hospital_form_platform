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
5. **Phase assignment preserves the prior model — case READ + phase-form write, NO case-content
   write auto-grant** (revised 2026-07-08, product-owner design change). Assigning a phase grants
   the assignee phase-form write (already via `assigned_to` + `answers_write_own_draft`) and READ
   of the rest of the case (already via `can_read_case`'s assignee arm); it does **not**
   auto-grant `case_access` write. `activate_phase`/`reassign_phase` keep the `SECURITY DEFINER`
   flip + the `assign_case_phases` gate (so an Administrativo may assign — the update bypasses
   `case_phases_staff_admin_write`, so the internal gate is the authority), but the earlier
   `_grant_case_access_unchecked(..., 'write')` calls are removed. A non-coordinator case
   **creator** gets `case_access` **READ** (not write) — just enough to see the case they opened.
   The coordinator's explicit `grant_case_access`/`revoke_case_access` (read or write) stays the
   **sole** path to case-content write.
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
- **Behavior change (revised 2026-07-08):** phase assignment no longer grants case-content
  write; it preserves the prior model (case READ via the `can_read_case` assignee arm +
  phase-form write via `assigned_to`). A non-coordinator case creator receives `case_access`
  **read** (visibility of the case they opened). Case-content write remains the coordinator's
  explicit `grant_case_access`. The earlier "assignment ⇒ `case_access` write" behavior was
  reverted before merge; no E2E depended on it in a shipped state.
- **PHI note (Rule 12):** granting `create_cases` lets an Administrativo enter and read patient
  context on PHI-bearing commissions (via the case creator/assignee read arms). Minimum-necessary
  is satisfied by the explicit, per-member, coordinator-granted, flag-gated nature of the grant —
  the manager UI must state this plainly. No new PHI table or module is introduced; the enumerated
  PHI-module set is unchanged.
- **Title system is untouched** — "Secretário(a)" remains a pure descriptor with zero authority.
- Status advances to **accepted/implemented** once the feature is built and passes the phase gate;
  until then this ADR records the committed design.

## Amendment 1 — a fifth capability, `read_cases`, and a management surface

**2026-08-21 design PO-ratified · ⚙ BUILD RECORD OPENED 2026-08-22 on
`feat/case-surface-split-2`** (ADR [0134](./0134-case-surface-split-and-administrativo-case-read.md)
Increment 2; local only — **no remote `db push`, not merged**). The design paragraph below is kept
verbatim as the record of what was ratified; ⛔ **three of its clauses were changed by measurement
during the build and are corrected underneath it — read both.**

> The curated menu grows from four capabilities to **five**: `read_cases` (default-checked in
> the appoint dialog) keys a new `app._case_caps` arm conferring commission-wide
> `read_case_content` — read only; content authorship stays per-case grant-gated and
> `close_case`/`cancel_case` stay coordinator-only. Rationale: the four existing capabilities
> were exercisable only on cases the appointee could already read (grant/assignment/creator),
> so the delegation added a per-case grant step instead of removing coordinator load.
> Additionally, the appointee's surface changes: `manage/cases/[caseId]` admits administrativos
> (0134 D3) and `multiplos` re-gates on the `create_cases` capability instead of the
> `staff_admin` role — the "board rows → staff `casos/[id]` route" frontend note above becomes
> historical once 0134 Increment 1 lands.

### What has LANDED (verify against the catalog, not this list)

- **The vocabulary is five.** `read_cases` added to the two enforcing places — the CHECK constraint
  and `public.grant_member_capability`'s whitelist — plus the non-enforcing `app.feature_flags`
  description, which enumerated the four in prose. ⚠ Measured during the build: `capability` is plain
  `text`, so `npm run gen:types` is **blind** here (`database.ts` types it `string`) and a clean
  regeneration is **not** confirmation. The vocabulary also lives in **four TypeScript hand-lists**
  and a fifth in `seed.sql`; none is derived from the DB.
- **The appoint dialog offers it**, labelled *"Visualizar os casos da comissão"*, with the ceiling in
  its hint (see the correction to clause 1 below), and the component gained its first unit coverage.

### Three corrections to the ratified paragraph, each measured

1. ⛔ **"default-checked in the appoint dialog" was not implementable as written** — that dialog has
   **no defaults**; its checkboxes render server state, and a new appointee held zero capabilities.
   **PO-ruled 2026-08-22 (ADR 0134 Amendment 5): the appointment GRANTS `read_cases`.**
   `public.appoint_administrativo` now inserts the capability row, attributed to the appointing
   coordinator, on a **new appointment only** — existing appointees are **not** backfilled (Amdt 1
   §A1.1 still governs them), and re-appointing an existing appointee grants nothing while
   re-appointing **after a revoke** does. The rejected third reading — tick the box client-side with
   no grant behind it — is a mirror wider than its door and must never be implemented.
2. ⛔ **"keys a new `app._case_caps` arm" understated the bound.** The arm is bounded by `not v_eg`
   (ADR 0134 Amendment 4): a case whose access policy is `explicit_grants_only` is **invisible** to
   it, exactly as for the committee-member and quality-reviewer arms. Reach there rides an explicit
   per-case grant or nothing. The capability's ceiling is therefore *commission-wide across ordinary
   cases, stopping at the same wall every other non-granted reader stops at* — which is what the
   dialog's hint now says.
3. ⛔ **"`multiplos` re-gates … becomes historical once 0134 Increment 1 lands" is FALSE.** Increment 1
   deliberately did the **narrowing half only** (it dropped the `context.isAdmin` bypass and left the
   role gate), because `public.bulk_create_cases` was measured to admit **only** `is_staff_admin_of` —
   re-gating the route on a capability the door refuses builds a reachable door that always answers
   `42501`. The route may re-gate **only after** the door admits it, which is Increment 2 work and is
   **not yet landed**.

### Still PENDING in this build record (do not read the above as completion)

The S8 `_case_caps` arm itself · the `member_can('create_cases')` widening of `bulk_create_cases` and
the deliberate inversion of the keystone that pins today's refusal · the `multiplos` re-gate and its
board link · the creation-scoped PHI write (ADR 0134 Amendment 2, option D — the platform's first PHI
write path not held by a coordinator) · and **this ADR's own PHI note**, whose claim that `create_cases`
lets an administrativo *"enter and read patient context"* is **measurably false today in both halves**
and becomes half-true only when option D lands. ⛔ That correction ships in the **same commit** as the
door, never before it — a record that out-runs its door is the same defect as a route that does.


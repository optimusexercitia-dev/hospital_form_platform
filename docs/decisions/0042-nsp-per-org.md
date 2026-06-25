# ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors

**Status:** Accepted (phase gate passed — pgTAP 1102/1102, full E2E 421/0, QA APPROVED A-core + whole-phase B, human-approved 2026-06-25) ·
**Date:** 2026-06-25 · **Feature:** NSP-per-org — bind the PQS/NSP roster and **every PHI
read door** of the two PHI modules (patient-safety/NSP and inter-committee referrals) to an
**organization**, lifting ADR [0041](./0041-multi-tenancy-organizations-hospitals.md)
amendment 10's interim multi-org PHI guard. Builds directly on ADR 0041; extends the PQS
duty-separation posture of ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md) /
[0035](./0035-lgpd-anvisa-regulatory-posture.md) / [0037](./0037-inter-committee-case-referrals.md)
to the org tier. Architecture Rule 12.

## Context

Multi-tenancy (ADR 0041) walled vendor `platform_admin` off all tenant data and re-scoped the
~60 `is_admin()` OR-terms to `is_org_admin_of_commission`. But the two **PHI** modules authorize
PHI through a **single global roster** `public.pqs_members` via `app.is_pqs_member(uid)`, which
has **no org bound** — in a pooled multi-org DB, an org-A NSP member would read org-B PHI through
that global term. The leak is in the *roster*, not the admin term the 0041 rewrite touched. ADR
0041 amendment 10 closed it as an **interim** measure: `app.is_pqs_member` returns false whenever
`app.is_multi_org()` (>1 organization), plus defense-in-depth guards and `patient_safety_enabled()`
/ `referrals_enabled()` going dark in multi-org. Consequence: with the 2-org seed both PHI modules
are **inert platform-wide** and 124 E2E specs are quarantined. Amendment 13 named the lift — this
ADR — as its own gated phase.

A fourth surface was found during design: the Phase-23 cross-committee **patient index**
(`patient_xref` + its QPS doors) aggregates across **all** commissions with **no org filter** and
never had an `is_multi_org()` guard — it is safe today *only* because the global roster is inert.
It must be org-scoped in the same change.

## Decision

**Core mechanism.** Every PHI door already resolves *entity → commission*; we make it go one hop
further to *commission → `organization_id`* (denormalized on `commissions`) and replace the global
`app.is_pqs_member(uid)` term with `app.is_pqs_member_of(<that org>, uid)`. The
`app.is_multi_org()` chokepoint and every `and not is_multi_org()` guard are **deleted**.
**Single-org behavior is byte-identical** (one org ⇒ the per-org term collapses to "is enrolled"),
so the entire existing PQS pgTAP suite stays valid.

1. **Per-org roster + NSP config.** `pqs_department` (singleton today) and `pqs_members`
   (PK `user_id` today) gain `organization_id`; `pqs_members` PK becomes
   `(organization_id, user_id)`. One NSP per org; `rca_default_due_days`/`name` are per-org config.
   New predicates `app.is_pqs_member_of(org)`/`_for`, `is_pqs_writer_of(org)`, `is_pqs_member_of_any(uid)`
   mirror `is_org_admin_of`; org-resolution helpers `org_of_event`/`org_of_referral`/`org_of_commission`/`org_of_capa_action`.

2. **Dedicated per-org `nsp_coordinator` grant** curates the roster — implemented on ADR 0041
   decision 2's stated "widening seam": `organization_members.role` CHECK widens from `{org_admin}`
   to `{org_admin, nsp_coordinator}`. **Three-way duty separation:** `org_admin` *appoints* the
   coordinator (manages `organization_members`); the coordinator *curates* `pqs_members`; enrollment
   in `pqs_members` is what grants PHI **read**. A coordinator is **not** implicitly a reader
   (explicit enrollment) so "can curate but cannot read until enrolled" is provable. The roster
   curation RPCs (`add/remove/list_pqs_members`, `set_pqs_rca_due_window`) move from
   platform-admin+global to `nsp_coordinator`+per-org.

3. **Org-bound PHI doors.** All read predicates (`can_read_event[_patient]`, `can_read_referral[_phi]`,
   `can_read_capa`, `can_write_rca` read arm, `event_current_custodian`, the QPS macro-term in
   `can_read_case[_patient]`), every `is_pqs_writer` write gate (the 8 CAPA `*_write` policies via a
   `can_write_capa` consolidation, the NSP lifecycle RPCs, the one storage writer policy), the DEFINER
   doors (`pqs_inbox` result-scoped to the caller's org(s); `get_event_patient`/`get_referral_*`
   delegating to the rebound predicates), and the **patient_index** doors (`search_patient_xref`/
   `get_patient_trajectory_for_entity`/`patient_access_audit`/`patient_xref_count` + the `patient_xref`
   RLS) become org-scoped.

4. **Forbid cross-org referrals.** A referral carries PHI between commissions; allowing it to span
   orgs would be a cross-*customer* PHI channel contradicting the ADR 0041 isolation posture, and
   `can_read_referral_phi` (org-resolved from `source_commission_id`) would grant the source org NSP
   read of a referral whose target lives in another org. `create_referral_draft` raises if
   source/target orgs differ; `list_referral_target_commissions` is filtered to the source's org.
   Cross-**hospital**, same-org referrals stay valid (hospital is not an isolation boundary).

5. **Vendor stays walled off, including from erasure.** `dispose_event_phi`'s platform-`is_admin`
   arm (left global by amendment 10) is re-scoped to `is_org_admin_of_commission` + the org's PQS,
   so LGPD erasure stays within the event's org. No platform-admin break-glass into PHI (deferred
   per ADR 0041).

6. **Per-org `EV-%04d` event numbering; `ENC-%04d` stays a global sequence.** Per-org EV avoids one
   org inferring another's event volume from gaps; ENC stays a single sequence (per-org partitioning
   isn't worth it, and referrals are now intra-org).

7. **Greenfield reseed; structural, no feature flag.** The `pqs_members` PK change is non-additive;
   like ADR 0041 this is a pre-production greenfield reseed (both demo orgs get a full NSP world —
   roster, coordinator, events + referrals + `patient_xref`, with deliberately different per-org
   config — so cross-org PHI isolation is pgTAP- and E2E-testable). The per-module flags
   (`patient_safety`, `case_referrals`, `patient_index`) keep working, now org-scoped instead of
   globally inert.

8. **Delivery split, backend-core first.** (A) backend security core — schema + predicates + doors +
   RPCs + seed + pgTAP — must pass its own gate (cross-org PHI isolation proven in SQL, keystone:
   org-A NSP member gets zero/null/false on org-B PHI across **every** door) before (B) the frontend
   route-move (`/admin/nsp/**` → per-org `/o/[org]/nsp/**`) + per-org roster UI + un-quarantine of
   the 124 E2E specs. Mirrors the Phase-14 (14a–14d) split.

## Alternatives rejected

- **Keep the interim global-roster guard (amendment 10).** Rejected as the steady state — it leaves
  both PHI modules permanently inert in every multi-org deployment; it was always labeled interim.
- **A global roster with an org filter applied only at the doors (no `organization_id` on
  `pqs_members`).** Rejected — membership *is* the org-scoped fact; without the column the roster
  can't express "PQS of org A but not org B," and every door would re-derive org from an unrelated
  join. The column is the single source of truth, mirroring how `commission_members` scopes commissions.
- **`org_admin` curates the roster directly.** Rejected — collapses the NSP duty separation (the
  customer's IT/governance admin is not necessarily the Núcleo de Segurança do Paciente). A dedicated
  `nsp_coordinator` grant models the real hospital separation; org_admin only *appoints* it.
- **Coordinator is implicitly a PHI reader.** Rejected — couples curation authority to read
  entitlement and makes "curate ≠ read" unprovable; explicit enrollment keeps the chokepoint one table.
- **Allow cross-org referrals with a two-org PHI rule.** Rejected — a deliberate cross-customer PHI
  channel that contradicts the whole isolation posture and makes the predicate ambiguous.
- **Defer `patient_index` org-scoping** (its UI ships OFF). Rejected — the SQL leak is real the moment
  per-org membership is un-inerted; UI-off is not a security control.

## Consequences

- **Security-critical mechanical edit.** A single un-rebound PQS term is a silent cross-org PHI leak,
  so the per-door inventory (`docs/progress/nsp-per-org-design.md` §A) is the spec and the post-change
  assertion; the cross-org isolation pgTAP (`173_nsp_per_org_isolation`) asserts zero/null/false on a
  foreign org across every door, plus the three-way duty separation. Full plan-review task (CLAUDE.md §4).
- **`app.is_multi_org()` and the global `is_pqs_member`/`is_pqs_writer` are dropped** after a TS-callsite
  grep (none found; `is_pqs_member_self()` survives as the no-arg "member of any org" nav probe).
- **Per-org numbering asymmetry** (EV per-org, ENC global) is deliberate and documented.
- **Forward-compatible:** the `organization_members.role` CHECK remains the seam for future org roles;
  the dedicated-Supabase-project escape hatch (ADR 0041) still applies unchanged.
- **Supersedes ADR 0041 amendment 10** (the interim guard) on acceptance; amendment 13 is fulfilled.

## Implementation notes (sub-phase A, backend — discovered during build)

Three details the design did not anticipate, resolved during A2/A3 (migration
`20260630000000_nsp_per_org.sql`):

1. **Per-org EV needs the `code` unique scoped down.** `patient_safety_event` had a
   GLOBAL `UNIQUE(code)`, so per-org EV (two orgs both reaching `EV-0001`) would be
   rejected. The event has no `organization_id` column (org is derived via
   `reporting_commission_id`), and `app.org_of_commission` is STABLE (not indexable),
   so the constraint became `UNIQUE(reporting_commission_id, code)` — a backstop for
   the common single-commission case; true per-org uniqueness is guaranteed at MINT
   time by the per-org advisory lock + per-org `max(suffix)+1`.

2. **`can_write_capa` must fall back to any-org for non-event-sourced plans.**
   `capa_plan` is source-polymorphic; `event_of_capa` is NULL for
   indicator/audit_finding/meeting/manual sources, so a pure per-org gate
   (`is_pqs_member_of(org_of_event(NULL))` → false) would make those plans unwritable
   by anyone — a regression from the old global `is_pqs_writer()`. The consolidation
   branches: event/rca-sourced → per-org; otherwise → `is_pqs_member_of_any` (those
   plans carry no event PHI). Same branch in `open_capa_plan`'s create gate.

3. **`DROP FUNCTION … (integer)` must use UNQUOTED `integer`.** Quoting it as
   `"integer"` makes Postgres look up a type named `integer` (a SQL keyword, not a
   quotable identifier), which fails silently → the old overload survives. `"uuid"`
   /`"text"` quote fine; `integer` does not. (Caught when the regenerated types showed
   a stale 1-arg `set_pqs_rca_due_window` overload.)

**pgTAP fixture scope for the A6 tester.** The cross-org behavior is correct (proven
by a DB-level probe), but more single-org suites than just `173` reference the changed
schema directly and need fixture/signature updates: `145_pqs_membership` (rewrite — it
tests the old global roster), plus a one-line `organization_id` addition to the
`pqs_members` insert (+ a per-org `pqs_department` row) in `140/141/142/143/150/151/152`,
and signature updates in `141` (`set_pqs_rca_due_window`), `145`
(`add_pqs_member`/`is_pqs_member`), `152` (`search_patient_xref`). None are behavior
regressions.

## Sub-phase A — QA fix-loop addenda (M1/M2/I1)

The QA security review (`docs/reviews/nsp-per-org-a-review.md`) surfaced two "missed
door" defects + one approved scope fold-in, all resolved in the migration:

- **M2 — the catalog sweep is the real safeguard, not a file grep.** Two functions
  from `…009000` that this migration never re-created still called the dropped global
  predicates (`capa_viewer_can_manage` → `is_pqs_writer()`; `capa_kpis` →
  `is_pqs_member()`), so they errored at call time. A *file grep* over the migration
  could not find them (they live in a different file); only a **live `pg_proc` /
  `pg_policies` sweep** for residual references to the dropped symbols catches this
  class. The standing rule for any migration that DROPs a widely-called predicate:
  after `db reset`, assert ZERO catalog references survive (precise `\m<name>\(`
  word-boundary regex so `_of`/`_of_for` rebinds aren't false-positives), and rebind
  every dangling caller. Rebinds: `capa_viewer_can_manage` → `can_write_capa`;
  `capa_kpis` → `is_pqs_member_of_any` (no-arg cross-org PHI-free counts).

- **M1 — an arity change must not silently widen a grant.** `patient_trajectory_bundle`
  is an internal helper with no authorization of its own (its three DEFINER callers
  gate first); its original 2-arg was `service_role`-ONLY. The 3-arg arity change
  routed it through a grant loop that granted `authenticated`, making the enrollment
  gate bypassable by a direct call. Fix: `service_role`-only, matching `…019000`. When
  changing a helper's arity, carry forward its EXACT grant posture, not the loop's
  default.

- **I1 (folded in, human-approved) — `dispose_case_phi` walled.** The third PHI module
  (`case_patient`, ADR 0038) is outside this phase's two-module brief, but its
  `dispose_case_phi` carried a bare `is_admin()` arm = a live cross-tenant PHI-erase
  path (flag ON in the seed; vendor `platform_admin` holds no memberships, so
  `is_admin()` was its only tenant reach). Rewritten identically to `dispose_event_phi`
  — `is_admin()` → `is_org_admin_of_commission(commission_of_case(...))`, keeping the
  `is_staff_admin_of` arm. This brings all THREE PHI modules' disposal doors under the
  same vendor-walled, org-scoped posture. `set_case_patient` was already clean.

### M3 — "gate-fixed but body-not-scoped" (the second QA fix-loop class)

`capa_kpis`'s M2 rebind fixed the GATE (`is_pqs_member()` → `is_pqs_member_of_any`)
but the gate is a non-correlated boolean — the aggregate body still scanned every
org's `capa_plan` (+ an org-blind `overdue_actions` subquery). A rede-a PQS member
counted rede-b's CAPA volume. Lesson: **rebinding the gate of an aggregate/list door
is NOT enough — the RESULT SET must be org-scoped too.** Fix kept the door no-arg
(`capa_kpis()`, hermetic) by scoping to the *union of the caller's enrolled orgs* (the
`pqs_inbox` pattern), with non-event-sourced plans included via the same any-org
fallback as `can_write_capa` (kept aligned on purpose). The standing check for this
class: every SECURITY DEFINER door returning a SET/TABLE/jsonb over a tenant/PHI table
must, in its BODY, either filter by org (or the caller's org-union) or be keyed to a
single entity that resolves org — confirmed by an exhaustive catalog sweep (all 9
PHI/CAPA aggregate doors pass; `capa_kpis` was the sole offender). A strict
single-org `p_org_id` shape, if the per-org console wants it, is a sub-phase-B FE
concern, not this phase.

### BUG-NSP-004 — the non-event CAPA fallback must be applied to EVERY org-gate, uniformly

A `capa_plan` is source-polymorphic; only `event`/`rca` sources resolve to an event
(hence an org). For `manual`/`indicator`/`audit_finding`/`meeting` sources
`event_of_capa` is NULL, so `is_pqs_member_of(org_of_event(...))` = false — these PHI-
free plans have NO org to scope to and must stay writable/advanceable by ANY-org NSP
members (the `is_pqs_member_of_any` fallback). The fallback was added to `can_write_capa`
in sub-phase A but NOT to `advance_capa_action_core`, so manual-source CAPA actions
became unadvanceable by a non-assignee PQS member (BUG-NSP-004; 4 fails in
`phase14d-capa`). Same class as M3 — a per-org gate applied without the non-event
escape. **Resolution + standing rule:** every CAPA authority that resolves org via
`event_of_capa` MUST handle the NULL-event case identically. The cleanest way to
guarantee that is to route them ALL through the single `can_write_capa` consolidation
(which owns the branch) rather than re-implementing `org_of_event(event_of_capa(...))`
inline — `advance_capa_action_core` now does. Verified by enumerating the full CAPA
gate set (`advance_capa_action_core`, `can_write_capa`, `assert_capa_writable`, the 8
`capa_*_write` policies, `open_capa_plan`, `capa_kpis`) and confirming each handles
the non-event case — none re-implements the org resolution in a way that could drift.

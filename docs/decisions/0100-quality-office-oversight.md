# 0100 — Quality-office oversight: `quality_reviewer` role, commission oversight classification, org_admin content wall, membership lifecycle, break-glass

**Date:** 2026-08-06 · **Status:** 🟢 **ACCEPTED (design)** — ratified with the PO in a
14-question interview, 2026-08-06; **implementation NOT started; no migration authored.**
**Owner:** platform lead → `backend` / `frontend` at execution.
**Plan:** [docs/plans/quality-office-oversight.md](../plans/quality-office-oversight.md)
(carries the catalog-verified Phase A implementation detail — read it before building).
**Source:** audit of the partner's second RBAC handoff
([`docs/design/temp/supabase-user-roles-rls-handoff-2026-08-06.md`](../design/temp/supabase-user-roles-rls-handoff-2026-08-06.md),
successor to the July handoff ADR [0078](./0078-authorization-capability-model.md)
ratified), compared against the as-built model. The handoff's **runtime-mutable
permission catalog is REJECTED** (see Alternatives); its genuine gaps — oversight tier,
admin-duty separation, lifecycle, break-glass — are adopted in house form.

**Relates:** ADR 0041 (tenancy/roles; D8 hospital-never-routed; break-glass deferred
there, landed here) · 0051/0052 (hospital tier, NSP-per-hospital) · 0061
(administrativo) · 0072 (ethics spine — its lockdown beats the new arm) · 0075
(memberships collapse; grant/revoke doors) · 0078 (capability resolver; the RESERVED
`view_case_overview` bit gains its first consumer) · 0079 (ARM gates bind every new
door) · 0094 (technical_director — the authority-shape precedent) · 0097 (affiliation).

## Context

The pilot customer is one organization with multiple hospitals, **each with its own
in-house quality office (Escritório da Qualidade) — the pilot's primary daily user.**
The as-built model gives that office no first-class way to do its core job: reviewing
cases and compliance dashboards across the clinical committees of its hospital. Today
this requires committee memberships (over-grant) or per-case grants (per-case
friction). Separately, three items become prohibitively expensive to retrofit once live
tenants exist: the `org_admin` narrowing (a subtractive change against live customer
workflows), membership lifecycle semantics, and a designed vendor-support path.

Governing philosophy: every new authority is a **catalog-verifiable predicate arm**,
enumerable in `pg_proc`/`pg_policies` and RED-provable under the existing
mutation/ARM/door-sweep gates — never rows in a runtime-editable permission table.

## Decision

**D1 — Role.** New hospital-scoped `quality_reviewer` in the `memberships` role CHECK
(scope shape: organization_id + hospital_id NOT NULL, commission_id NULL — mirrors
`nsp_coordinator`). Multi-hospital coverage = one row per hospital. No org-scoped
oversight tier in this program.

**D2 — Phasing.** One program, three gated phases: **A** (pilot-blocking): classification
+ role + resolver/dashboard arms + UI. **B** (before pilot data accumulates): org_admin
content wall. **C** (before commercial sale; may trail pilot start): membership
lifecycle + break-glass.

**D3 — Read depth.** The arm confers `read_case_content` + `view_case_overview` (full
case content). `view_case_overview`'s in-body "coordinator-only RESERVED" contract is
deliberately widened — update the comment and pin with a keystone.

**D4 — Deliberation EXCLUDED.** No `read_case_deliberation`; the
`read_meeting_case_section` route stays closed. Exceptions ride
`case_access_grants.read_case_deliberation`.

**D5 — PHI NONE.** Zero PHI bits on the arm; exceptions ride
`case_access_grants.read_standard_phi` (expiring, reason-coded, PHI-read-audited).
The reviewer never enters the Rule 12 modules.

**D6 — Lockdown beats the arm.** `visibility_policy = 'explicit_grants_only'` cases are
fully invisible to the arm (no board row); oversight awareness of the locked population
is PHI-free aggregate counts only.

**D7 — Strictly read-only (Phase A).** No write capability, no new write doors — the
exclusion-perimeter family stays closed. Oversight write actions are designed
post-pilot from observed need.

**D8 — Classification.** `commissions.quality_oversight text CHECK IN
('visible','excluded') NOT NULL DEFAULT 'excluded'` — fails closed; onboarding opts
each clinical committee in; Ética is simply never opted in.

**D9 — Classification governance.** Changed ONLY via a guarded, audited DEFINER door
`set_commission_oversight` gated `is_hospital_admin_of OR is_org_admin_of`, plus a
BEFORE UPDATE trigger blocking raw column writes (the `set_case_visibility`/M6
pattern; new GUC `app.in_commission_rpc`). The committee cannot opt itself out;
platform_admin stays out (noun rule). The role itself is granted/revoked by
hospital_admin + org_admin through the existing `grant_role`/`revoke_role` doors,
authority shape mirroring technical_director (no `is_admin_for` arm); `p_expires_at`
gains a setter param on the grant path (enforcement is already universal; no door sets
it today — and D14 needs it).

**D10 — UI.** New org-level area `/o/[org]/qualidade` (hospital is a data filter, never
a URL segment — ADR 0041 D8): cross-committee case board over oversight-visible
commissions + aggregates incl. locked-case counts. Opening a case routes to the
EXISTING commission case page via a `quality_reviewer → viewer` branch in
`getCommissionAccess` (precedent: the org_admin branch). The reviewer is a **flag** on
`CommissionAccess`, never mapped to a member role — the `role === 'staff_admin'` write
gates must not open. Write affordances hidden by role; the DB arm is the boundary.

**D11 — Forms plane.** Aggregate dashboards YES — a reviewer arm on exactly the **six
aggregate** `dashboard_*` doors (`distributions`, `entity_references`, `form_totals`,
`matrix_cells`, `risk_scores`, `submissions_over_time`). Row-level doors
(`export_rows`, `free_text`, `completion_by_member`) stay closed. ⚠ The live catalog
has NINE dashboard doors, not the six ADR 0041-era prose implies; pgTAP
`270_authz_dashboard_gate_uniformity` self-enumerates them and must be rewritten to
the two-class contract in the same wave.

**D12 — Phase B: org_admin FULL CONTENT WALL, A4-style.** org_admin keeps
administration (org/hospital/commission/user management) + PHI-free aggregates; loses
ALL row-level content (responses — incl. `responses_admin_all` —, meeting content,
document content) unless also holding a functional role. Catalog-driven inventory;
**the PO ratifies the content-vs-configuration classification list before any
migration**; A/B equivalence matrix (LOST = only the intended cells) + mutation
audits. The same wall is evaluated for hospital_admin during the inventory.

**D13 — Phase C: membership lifecycle.** `memberships.status ∈
{'active','suspended'}` + `status_reason`, filtered ONCE at the central
`has_role`/`has_role_any` chokepoint (catalog-verified: it already filters
`expires_at`; sweep the ~5 direct `memberships` readers), mutated only via new
`suspend_role`/`reinstate_role` doors with mandatory reason, audited. Revocation stays
delete + hash-chained audit history (no soft-revoke rows on memberships).

**D14 — Phase C: break-glass = customer-granted, time-boxed membership** through the
existing doors (expires_at centrally enforced; blanket audit trigger; roster-visible)
plus a `break_glass_requests` record (reason/scope/approval/expiry) and notifications.
**NO new predicate arms** — the platform_admin noun-rule wall stays intact
(account-lockout emergencies are already within platform_admin's identity nouns).

## Standing rule (added 2026-08-07 after QO·A; the most transferable thing this program produced)

**Conferring a capability bit requires enumerating its CONSUMERS, not just its producers.**

The plan's threading list (§A.2) enumerated the arms that had to CHANGE. It had **no axis
for who already consumes the bit being conferred.** Granting S7 `read_case_content`
silently enrolled the oversight reviewer into every existing consumer of that bit,
wherever it lived — and that leaked **three times in one phase**: attachment bytes (M8),
the `open_attachment` DEFINER door whose action signs with the service role (M9), and
three write doors plus five read families (M10).

**Method that works** (all three were found this way, none by reading the plan): derive
the consumer set from the LIVE catalog by PROPERTY — a transitive closure over
comment-stripped `prosrc` **and** `pg_policies`, seeded from the predicate and the
capability literals — then classify **per door**. The per-door pass is not optional: 11
of the 14 authenticated DML doors in QO·A's closure were safe for reasons visible only
individually, so a blanket predicate over the closure would have broken eleven working
doors.

⚠ **Phase B (the org_admin content wall) is a far larger instance of exactly this** — it
subtracts a bit from a principal who is consumed by more surfaces than S7 ever was. Run
the consumer enumeration BEFORE writing its migrations, not after QA finds the misses.

**Third instance (QA r2 R1, 2026-08-07) — and the sharpest, because the guard could not catch it.**
M10 §B2 wrote *"7 tables route `can_read_interview`"*. Accurate, and that was the bug: it defined
the family as **things that call a particular helper** when the family is **things OWNED BY an
interview**. Two members reached the same data through raw `can_read_case` — `case_interview_links`
(carrying `external_url`: where the interview audio lives, and not a storage object, so the M8/M9
bytes cut never governed it) and `can_read_attachment`'s `'interview'` arm. This was written down
one section *after* M10 documented catching the identical shape on `action_items_select`.

**Corollary, now binding: a guard whose boundary is a literal list cannot close a family.**
`311` §5.1 counted a hardcoded table list against a literal — a member never in the list can never
red it. Replaced by a DERIVATION over the catalog (every policy reaching an interview anchor must
not route the widened predicate), with a non-vacuity twin proving the population is non-empty.
**Prefer: derive the set, assert over the derivation, and twin it against the empty set.**

## Alternatives rejected

- **The handoff's runtime-mutable permission catalog** (`role_definitions` /
  `role_permissions` / `role_grant_rules` as data): a seeding difference would change
  authorization with zero migration diff, no door to sweep, no mutation target —
  dismantling the ADR 0079 verification estate. Rejected wholesale.
- **Case-level `case_domain` column** (handoff §6/§15.4): the commission already IS the
  domain here; a per-case writable classification is a second authorization input to
  defend (the M6 lesson). Commission-level `quality_oversight` carries the value.
- **Org-scoped oversight tier now**: no corporate quality team exists at the pilot
  customer; N hospital-scoped rows cover it.
- **Summary-only read tier**: forces a grant request per case — friction that defeats
  the pilot's core value. Graduation comes from D6/D8, not a summary wall.
- **PHI in the arm / deliberation in the arm**: minimum-necessary + learning-culture
  protection; both remain per-case grant exceptions.
- **Proposal-style platform break-glass elevation**: punches a vendor-shaped hole
  through the noun rule for a scenario a governance tool can barely construct.
- **Soft-revoke rows on `memberships`**: rewrites the uniqueness model and every
  conflict clause (the untargeted-ON-CONFLICT trap class); the audit chain already
  carries history.
- **default 'visible' classification**: a forgotten setting on a sensitive committee
  would fail open. Deny-by-default.

## Consequences

- A tenth membership role must be threaded through every sibling surface — the
  documented "new arm" failure class. The plan enumerates the catalog-derived
  threading set (grant/revoke impls, `_case_caps` S7, six dashboard doors, three shell
  SELECT policies) and the must-NOT-change set (`is_org_level_admin_within`,
  row-level dashboard doors, member-role TS unions).
- New gates enter `ARM=census` automatically; every new/changed gate gets the
  diff-scoped door sweep; the new arm must be RED-provable (strip S7 → keystones red).
- `_case_caps` gains one arm → A5-style before/after perf measurement is a phase-gate
  item (baseline: `list_cases_board` in-body note).
- Seed gains reviewer personas + oversight fixtures; `database.ts` regenerates (Rule 8).
- ADR 0041's deferred break-glass is discharged by D14 without new predicate surface.

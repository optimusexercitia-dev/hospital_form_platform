# Design — hospital_admin, nsp_org_admin, per-hospital NSP & committee titles

**Date:** 2026-07-03 · **Status:** Locked via /grilling interview (16 questions, all resolved) ·
**Builds on:** ADR [0041](../decisions/0041-multi-tenancy-organizations-hospitals.md) (multi-tenancy),
ADR [0042](../decisions/0042-nsp-per-org.md) (NSP-per-org — partially superseded by this design).
Pre-launch: greenfield reseed acceptable (standing decision).

## Context

Brazilian reality: an Organization may own many Hospitals, but hospitals are most frequently
independent and decentralized. The platform needs (1) a `hospital_admin` — an admin local to one
hospital; (2) an `nsp_org_admin` — an org-level NSP administrator; (3) customizable per-committee
member titles ("Presidente", "Vice-Presidente", "Secretário"…). The interview surfaced that (2)
implies the NSP itself moves from per-org to **per-hospital** (RDC 36/2013: each facility
constitutes its own Núcleo de Segurança do Paciente).

## Locked decisions

### Role model (`organization_members`)

1. **Role set widens** to `{org_admin, nsp_org_admin, hospital_admin, nsp_coordinator}`.
   New nullable `hospital_id` column (FK → hospitals). CHECK: `hospital_id IS NOT NULL` iff
   `role IN ('hospital_admin','nsp_coordinator')` (org-level roles carry NULL).
2. **Cardinality:** `UNIQUE(organization_id, user_id)` is replaced by
   `UNIQUE NULLS NOT DISTINCT (organization_id, user_id, role, hospital_id)` (PG17).
   One user may hold multiple roles, and hospital-bound roles over multiple hospitals.
3. **Appointment chain:** org_admin appoints hospital_admins and the nsp_org_admin (no
   self-delegation). nsp_org_admin appoints per-hospital nsp_coordinators. **hospital_admin has
   no NSP appointment power** — the NSP chain stays independent of hospital administration.

### hospital_admin (Phase A)

4. **Authority = org_admin mirrored, hospital-scoped.** Everywhere the org_admin OR-term grants
   commission-scoped access, hospital_admin gets the same for commissions whose `hospital_id`
   matches. Org-level surfaces (create/edit hospitals, appoint org roles, org audit chain) stay
   org_admin-only.
5. **PHI edges confirmed explicitly:** full mirror **including** the LGPD disposal arms
   (`dispose_event_phi` / `dispose_case_phi` / — Phase B — `dispose_referral_phi`), hospital-scoped;
   and hospital-wide response/answer reads. PHI-module *reads* stay NSP-enrollment-only — the role
   grants none (same as org_admin).
6. **Predicate wiring:** new `app.is_commission_admin_of(commission)` (+ `_for`) =
   `is_org_admin_of(org)` OR `is_hospital_admin_of(hospital-of-commission)`; mechanically swap the
   ~60 `is_org_admin_of_commission` OR-term sites once. Single-hop both ways (`commissions` carries
   both keys). Future admin tiers edit one function body. Org-level-only sites keep
   `is_org_admin_of`. The grep inventory + **live `pg_proc`/`pg_policies` catalog sweep** is the
   spec and the post-change assertion (ADR 0042 lessons M2/M3). Service-role TS actions gated by
   `is_org_admin_of` (e.g. `src/lib/users/actions.ts`) are widened the same way — per ADR 0041
   amendment 11, the TS gate is the only control on those paths.
7. **Management scope:** hospital_admin does everything *inside* its hospital — create/rename
   commissions, invite users, assign staff/staff_admin. It cannot touch the hospitals registry,
   org roles, other hospitals, or other hospital_admins.

### Audit — 4-tier hash chain (Phase A)

8. **Chain key becomes `(organization_id, hospital_id, commission_id)`** with four shapes:
   platform / org / hospital / commission. Commission-tier rows gain a **trigger-derived
   `hospital_id`** included in the hashed tuple (a row still chains to exactly one predecessor —
   "rollup" means hospital-level read/reporting over its commissions' rows, not double-chaining).
9. **Hospital chain carries hospital-level events:** hospital record edits, hospital_admin
   grant/revoke, commission lifecycle (create/rename) for that hospital's commissions. Emitters of
   hospital-level events pass the hospital explicitly (audit_write signature extension); everyday
   commission-scoped emitters are unchanged (hospital derived from the commission).
10. **Read access:** hospital_admin reads its hospital chain + the commission chains of its
    hospital; org_admin reads the org chain (and, as today via management predicates, below);
    platform_admin platform-chain only. `audit_canonical` + `audit_write` + `verify_audit_chain`
    change **in lockstep, one migration**, with per-tier verification pgTAP.

### NSP-per-hospital (Phase B — partially supersedes ADR 0042)

11. **The NSP re-keys org → hospital:** `pqs_department` one row per **hospital**; `pqs_members`
    PK `(hospital_id, user_id)`; predicates become `is_pqs_member_of(hospital)` / `is_pqs_writer_of(hospital)`
    / `is_pqs_member_of_any`; resolution helpers `org_of_*` → `hospital_of_event/referral/commission/capa_action`.
    Every PHI door resolves entity → commission → **hospital**. An NSP member of Hospital A gets
    zero/null/false on Hospital B's PHI even within the same org.
12. **nsp_coordinator = the local hospital NSP head with full access:** implicit PHI read AND the
    NSP write gates for their hospital (predicates return true for coordinator OR enrollment), plus
    curation of their own hospital's roster and config. This deliberately relocates — not reverses —
    ADR 0042's duty separation: curate≠read now holds at the **org** level (decision 13), while the
    local coordinator is a full operator.
13. **nsp_org_admin = org-level NSP administration, zero PHI:** appoints/revokes any hospital's
    coordinator, curates any hospital's roster, edits per-hospital NSP config (name, RCA
    due-window), sees rosters and org-wide **PHI-free** aggregates (event counts, triage/CAPA
    status rollups — no patient identity, no narratives/free text). No PHI read, no NSP workflow
    write. pgTAP keystone: nsp_org_admin gets zero PHI on every door.
14. **Cross-hospital, same-org referrals stay legal; both endpoint NSPs read.**
    `can_read_referral_phi` (and the `patient_xref` doors for referral rows) resolve BOTH the
    source and target commissions' hospitals. Cross-org referrals remain forbidden (ADR 0042 §4).
15. **Non-event-sourced CAPA fallback** re-keys to "member of any hospital NSP"
    (`is_pqs_member_of_any`), still routed exclusively through the `can_write_capa` consolidation
    (standing rule from BUG-NSP-004). Per-hospital `EV-%04d` numbering follows the same argument
    as ADR 0042 §6 (scope the unique + advisory lock to hospital).

### Committee titles (Phase A)

16. **Model:** new `commission_member_titles (id, commission_id, name, position, timestamps)` —
    fifth per-commission vocabulary, copying the existing pattern (`commission_meeting_types` et
    al.) — plus nullable `title_id` on `commission_members` (FK, ON DELETE SET NULL, same-commission
    integrity check). **Display-only: zero RLS semantics.**
17. **Cardinality:** one title per member; no uniqueness per title (co-held titles and transitions
    stay a human matter, not a constraint fight).
18. **UX:** the commission's staff_admin manages the list and assigns titles (admins inherit via
    the mirror). New commissions auto-seed "Presidente", "Vice-Presidente", "Secretário(a)"
    (editable/deletable). Rendered on: member-management page, member overview, meeting attendee
    lists, and meeting signature blocks / exported atas.

### Routing & UI

19. **Hospital stays un-routed** (ADR 0041 decision 8 upheld). `/o/[org]/manage` and
    `/o/[org]/nsp` render hospital-scoped content from the user's grants with a **hospital
    switcher** when they hold several; `?hospital=` search param for deep links. No route
    migration; commission URLs unchanged.

## Phasing (each under the §6 gate)

- **Phase A — Hospital-admin tier, 4-tier audit, committee titles.**
  Backend core first: constraint relaxation + `hospital_id` column, `is_hospital_admin_of` /
  `is_commission_admin_of` predicates, the ~60-site swap, audit chain rewrite (one migration,
  lockstep), titles schema, seed + pgTAP (keystones: hospital-A admin sees zero rows of hospital-B
  commissions; chain verification per tier). Then frontend: manage-area hospital scoping +
  switcher, appointment UI, titles settings/badges, audit viewer tier.
- **Phase B — NSP-per-hospital + nsp_org_admin.**
  Backend core first: `pqs_department`/`pqs_members` re-key, predicate/door re-bind (per-door
  inventory doc = spec, catalog sweep = assertion), dual-hospital referral rule, nsp_org_admin
  gates + PHI-free aggregate doors, seed + pgTAP (keystones: hospital-A NSP member zero/null/false
  on hospital-B PHI across **every** door; nsp_org_admin zero PHI; duty separation at org level).
  Then frontend: NSP hospital switcher, coordinator appointment UI, org NSP-admin console,
  un-quarantine/realign affected E2E specs.
- Both phases: **greenfield reseed** — org A gains a second hospital so per-hospital isolation is
  pgTAP/E2E-testable; new personas (`hospitaladmin.a1@`, `nsporg.a@`, per-hospital coordinators);
  existing commission UUIDs preserved for fixtures.
- **New ADRs:** one per phase (hospital-admin tier + hospital audit tier + titles; NSP-per-hospital),
  each recording what it supersedes in ADR 0042.

## Open items folded in / adjacent

- `dispose_referral_phi` (open follow-up) should land in Phase B with the same
  commission-admin + NSP posture as the other two disposal doors (decision 5).
- Answer-Model v2 (ADR 0045/0046) is orthogonal — no interaction beyond migration ordering.

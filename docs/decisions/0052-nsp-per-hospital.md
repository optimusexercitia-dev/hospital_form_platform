# ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`

**Status:** Accepted (planned) · **Date:** 2026-07-03 · **Feature:** Phase B —
NSP-per-hospital. Re-key the PQS/NSP roster and **every PHI door** of the two PHI modules
(patient-safety/NSP and inter-committee referrals) from an **organization** to a **hospital**;
add an org-level, **zero-PHI** `nsp_org_admin`; make the per-hospital `nsp_coordinator` a full
local operator; allow dual-hospital (same-org) referral reads; land `dispose_referral_phi`.
**Partially supersedes** ADR [0042](./0042-nsp-per-org.md) (NSP-per-org) — the org tier of the
PQS roster/doors becomes the hospital tier. Builds on ADR
[0041](./0041-multi-tenancy-organizations-hospitals.md) (multi-tenancy) and ADR
[0051](./0051-hospital-admin-tier-and-hospital-audit-tier.md) (hospital-admin tier + hospital
audit tier). Extends the PQS duty-separation posture of ADR
[0030](./0030-patient-safety-phi-and-pqs-architecture.md) /
[0035](./0035-lgpd-anvisa-regulatory-posture.md) /
[0037](./0037-inter-committee-case-referrals.md). Design source:
[hospital-roles-nsp-titles-design.md](../progress/hospital-roles-nsp-titles-design.md) (locked
decisions 11–15, via /grilling interview). Architecture Rule 12.

## Context

**Regulatory driver (RDC 36/2013):** each health facility constitutes its **own** Núcleo de
Segurança do Paciente. An Organization may own many Hospitals, but hospitals are most often
independent and decentralized. ADR 0042 bound the PQS roster + every PHI read door to an
**organization** — correct for the single-hospital-per-org world it shipped in, but it makes
an org-A NSP member a reader of **every** hospital's PHI in that org. Phase A (ADR 0051) added
the `hospital_admin` tier and a 4-tier audit chain, and put `nsp_org_admin` in the
`organization_members.role` CHECK but left it **inert**. Phase B activates the NSP re-key.

The mechanism is identical to ADR 0042, one hop further: every PHI door already resolves
*entity → commission → organization*; Phase B makes it resolve *entity → commission →
**hospital*** (via the existing `commissions.hospital_id`) and replaces the per-org term
`app.is_pqs_member_of(<org>)` with `app.is_pqs_member_of(<hospital>)`. Roster + NSP config move
from per-org to per-hospital. Because Phase A's live seed still has **one hospital per org**,
single-hospital behavior is **byte-identical** (one hospital per org ⇒ the per-hospital term
collapses to the per-org term), so the existing PQS pgTAP suite stays valid; the greenfield
reseed adds a **second hospital to org-A** so per-hospital isolation is provable.

## Decision

Locked decisions 11–15 from the design doc, plus `dispose_referral_phi`:

1. **Re-key roster + config org → hospital (decision 11).** `pqs_department` becomes one row
   per **hospital** (`UNIQUE(hospital_id)`, per-hospital `name` + `rca_default_due_days`);
   `pqs_members` PK becomes `(hospital_id, user_id)`. Predicate primitives re-bind:
   `is_pqs_member_of(hospital)` / `_for`, `is_pqs_writer_of(hospital)`,
   `is_pqs_member_of_any(uid)`, `is_nsp_coordinator_of(hospital)` / `_for`. Resolution helpers
   re-key `org_of_event/referral/commission/capa_action` → **`hospital_of_*`** (one hop:
   `hospital_of_commission(c) = commissions.hospital_id`; `hospital_of_event`,
   `hospital_of_referral`, `hospital_of_capa_action` chain through their commission). Every PHI
   door resolves entity → commission → **hospital**. **An NSP member of Hospital A gets
   zero/null/false on Hospital B's PHI even within the same org.**

2. **`nsp_coordinator` = the local hospital NSP head, full operator (decision 12).** The
   per-hospital coordinator has **implicit PHI read AND the NSP write gates** for their hospital
   (every PHI/write predicate returns true for `is_nsp_coordinator_of(hospital) OR
   is_pqs_member_of(hospital)`), plus curation of their own hospital's roster and config. This
   **relocates, not reverses,** ADR 0042's duty separation: *curate ≠ read* now holds at the
   **org** level (the `nsp_org_admin`, decision 13); the local coordinator is a full operator.
   `nsp_coordinator` is `hospital_id IS NOT NULL` (Phase A CHECK), appointed by `nsp_org_admin`.

3. **`nsp_org_admin` = org-level NSP administration, ZERO PHI (decision 13).** Appoints/revokes
   any hospital's `nsp_coordinator`, curates any hospital's roster (add/remove `pqs_members`),
   edits any hospital's NSP config (name, RCA due-window), and reads rosters + org-wide
   **PHI-free aggregates** (event counts, triage/CAPA status rollups — **no** patient identity,
   **no** narratives/free text). It has **no PHI read** and **no NSP workflow write**. It is
   org-level (`hospital_id IS NULL`, Phase A CHECK), appointed by `org_admin` (no
   self-delegation). **pgTAP keystone: `nsp_org_admin` gets zero PHI on every door.** The
   PHI-free aggregate doors are new SECURITY DEFINER surfaces gated on
   `is_nsp_org_admin_of(org)`, returning only counts/status rollups keyed by hospital, never a
   PHI column.

4. **Dual-hospital, same-org referrals stay legal; both endpoint NSPs read (decision 14).**
   `can_read_referral_phi` (and the `patient_xref` doors for referral rows) resolve **both** the
   source and target commissions' hospitals, so either endpoint hospital's NSP reads the
   referral. **Cross-org referrals remain forbidden** (ADR 0042 §4, unchanged) — the
   `create_referral_draft` same-org guard stays; only the PHI-read resolution widens to the two
   hospitals.

5. **Non-event-sourced CAPA fallback re-keys to "member of any hospital NSP" (decision 15).**
   `is_pqs_member_of_any` (now "enrolled in *any* hospital's roster") stays the fallback for
   source-polymorphic `capa_plan`s whose `event_of_capa` is NULL
   (indicator/audit_finding/meeting/manual), still routed exclusively through the
   `can_write_capa` consolidation (standing rule from BUG-NSP-004). Per-hospital `EV-%04d`
   numbering follows the ADR 0042 §6 argument (scope the unique backstop + advisory lock to
   hospital). `ENC-%04d` stays a single global sequence (referrals are intra-org).

6. **`dispose_referral_phi` lands here (design "open items folded in").** The referral module's
   LGPD-erasure door, mirroring `dispose_event_phi` / `dispose_case_phi`: gated on the
   **commission-admin** arm (`is_commission_admin_of` of the referral's source commission — the
   Phase-A hospital-scoped mirror) **plus the operator of *either* endpoint hospital's NSP**
   (`is_pqs_operator_of(hospital_of_commission(source))` OR `…(target)`), `is_admin` kept only as
   the ADR-documented platform erasure exception. Same vendor-walled, hospital-scoped posture as
   the other two disposal doors.

   **Amendment (build, 2026-07-03) — dual-hospital dispose (lead-accepted deviation from the
   original source-only wording).** The referral shares a **single** frozen PHI snapshot between
   the source and target hospital NSPs, and decision 14 makes it **readable by both**. LGPD
   erasure follows custody: either custodian hospital must be able to honor a valid erasure
   request over PHI in its custody, so the disposal gate is symmetric with the read (either
   endpoint's operator), not source-only. This is low-risk because the door **erases only the PHI
   graph** (deletes `referral_patient` + nulls the referral/reply/shared-item free-text PHI
   columns) while **preserving the non-PHI referral record** (ENC code, structural fields, audit)
   — so CFM 20-yr retention of the referral *event* is intact; only the LGPD-erasable patient
   snapshot is removed, and every disposal is audited at the hospital tier. Cross-**org** referrals
   remain forbidden, so "either endpoint" is always within one org.

**Delivery split, backend-core first (mirrors Phase 14 / ADR 0042).** **(Core)** backend
security core — schema re-key + predicate/door re-bind + `nsp_org_admin` gates + PHI-free
aggregate doors + dual-referral resolution + `dispose_referral_phi` + seed + pgTAP — must pass
its own gate (per-hospital PHI isolation proven in SQL; keystones below) **before**
**(Frontend)** the NSP hospital switcher + coordinator-appointment UI + org NSP-admin console +
un-quarantine/realign of affected E2E specs.

**Keystones (pgTAP):** (a) a Hospital-A NSP member gets zero/null/false on Hospital-B PHI across
**every** door, even within the same org; (b) `nsp_org_admin` gets zero PHI on every door but
can curate every hospital's roster + read PHI-free aggregates; (c) duty separation at the org
level (`nsp_org_admin` curates but cannot read; local coordinator curates AND reads); (d)
per-hospital EV sequences independent; (e) dual-hospital same-org referral read by both
endpoints; cross-org still forbidden.

## Alternatives rejected

- **Keep the roster per-org (ADR 0042 steady state).** Rejected — RDC 36/2013 makes the NSP a
  per-facility body; a per-org roster leaks every hospital's PHI to any org NSP member. ADR 0042
  was always the single-hospital-per-org shape; the design interview surfaced the re-key.
- **`nsp_org_admin` is implicitly a PHI reader (org-wide break-glass).** Rejected — collapses the
  relocated duty separation and re-introduces the exact org-wide PHI reach the re-key removes.
  Org-level NSP administration is a **curation + PHI-free-reporting** role by construction; PHI
  read stays per-hospital enrollment only.
- **`hospital_admin` gains NSP appointment power.** Rejected (decision 3, Phase A) — the NSP
  appointment chain (`org_admin` → `nsp_org_admin` → per-hospital `nsp_coordinator`) stays
  **independent** of hospital administration. `hospital_admin` runs the hospital's committees; it
  is not the hospital's patient-safety nucleus.
- **Allow cross-org referrals now that resolution is two-hospital.** Rejected — unchanged from
  ADR 0042 §4; a cross-org referral is a cross-**customer** PHI channel. Dual-**hospital**,
  same-org is the only widening.
- **Coordinator curates but does not read (keep ADR 0042's local posture).** Rejected for the
  local tier — the real hospital NSP head both curates and reads; *curate ≠ read* is preserved by
  moving it up to the org `nsp_org_admin`, not by crippling the local operator.

## Consequences

- **Security-critical mechanical re-key.** A single un-rebound PQS term is a silent
  cross-**hospital** PHI leak. Per ADR 0042's M2/M3 lessons, the **live `pg_proc` / `pg_policies`
  catalog sweep** for residual references to the dropped per-org symbols is the spec and the
  post-change assertion — a file grep is insufficient (M2). Every SECURITY DEFINER door
  returning a SET/TABLE/jsonb over a PHI/tenant table must scope its **result set** to the
  caller's hospital(s), not just its gate (M3). Full plan-review task (CLAUDE.md §4).
- **The per-door inventory** ([nsp-per-hospital-design.md](../progress/nsp-per-hospital-design.md))
  re-keys ADR 0042's proven inventory one hop (`org_of_* → hospital_of_*`); the backend teammate
  re-derives it against the **live** catalog (line numbers shifted after the per-org migration +
  Phase A) as its plan, and the catalog sweep asserts zero residual per-org PQS terms.
- **`is_pqs_member_of_any` semantics widen** from "member of any org" to "member of any
  hospital roster"; `is_pqs_member_self()` (no-arg nav probe) is kept. TS callsites in
  `src/lib/queries/**` re-checked before any DROP (ADR 0042 §E4 lesson).
- **Single-hospital-per-org byte-identical** — the existing 14a–d / referral / patient-index
  suites stay green on the one-hospital bootstrap; the reseed adds org-A's second hospital only
  to make isolation testable.
- **Greenfield reseed** (pre-launch standing decision) — non-additive PK change on `pqs_members`;
  org-A gains a second hospital + per-hospital coordinators/rosters + a second-hospital event +
  an intra-org **cross-hospital** referral, so isolation is pgTAP- and E2E-testable. New
  personas per the seed spec.
- **Supersedes ADR 0042's org tier** for the PQS roster + PHI doors; ADR 0042's non-tier
  decisions (forbid cross-org referrals, global ENC numbering, vendor walled from erasure)
  carry forward unchanged.

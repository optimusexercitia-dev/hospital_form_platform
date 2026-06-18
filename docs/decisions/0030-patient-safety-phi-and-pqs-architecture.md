# ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)

**Status:** Accepted · **Date:** 2026-06-18 · **Phase:** 14 (planning) ·
**Supersedes:** the "no-patient-data" stance of CLAUDE.md §1 and ADR
[0028](./0028-accreditation-governance-roadmap.md) (its rejection of a
"minimal-identifiers" module).

## Context

Phases 0–13 were built under an absolute platform rule (CLAUDE.md §1): **no
patient data, ever**; HIPAA/LGPD-health compliance explicitly out of scope. ADR
0028 reaffirmed it and *rejected* a "minimal-identifiers" alternative, scoping
Phase 14 as a commission-scoped CAPA in which root-cause analysis was a small
JSONB field inside a `capa_plan`.

The platform owner (a physician) has redirected Phase 14 to a full,
Joint-Commission-aligned **patient-safety programme**: a committee detects an
**event** during case analysis and notifies a central **Patient Quality & Safety
department** — in Brazil the **Núcleo de Segurança do Paciente (NSP)**, RDC
36/2013 — which **acknowledges**, **triages** (patient-safety-event? → reach →
harm severity → sentinel screen), determines a **review pathway**, and where
warranted runs a **Root Cause Analysis** and a closed **PDCA/CAPA** loop through
to effectiveness verification and closure with lessons learned. That domain is
**inherently about patients**; a de-identified shadow of it would degrade the
clinical analysis an RCA depends on.

To enable it, the owner has decided to run the platform on **Supabase's
HIPAA-compliant offering under an executed BAA**, removing the no-patient-data
restriction. This ADR records that reversal, the safeguards it brings, the
rejected de-identified alternative, and the PQS/NSP module architecture (settled
through a design interview, 2026-06-18).

## Decision

1. **PHI is in scope, platform-wide.** The platform runs on HIPAA-eligible
   Supabase infrastructure under an executed **BAA**. The "no patient data,
   ever" rule and 0028's rejection of identifiers are **superseded**. PHI is
   permitted wherever the clinical-governance domain genuinely requires it.

2. **Minimum-necessary by design.** Modules that don't need patient identity —
   committee operations (0–12), indicators (15), standards crosswalk (16),
   controlled documents (17), audit rounds (18), surveyor access (19),
   notifications (20), charters (21) — stay **process/measurement-focused and
   PHI-free**, now by *design discipline* rather than prohibition. PHI is
   **concentrated in the patient-safety/NSP module (Phase 14) and isolated
   within it**.

3. **HIPAA safeguards become binding** (new ARCHITECTURE.md **Rule 12**):
   - RLS-enforced **minimum-necessary** access; PHI **isolated** into dedicated
     tables (`event_patient`) with the tightest scope, so common paths (queues,
     triage, aggregates) never load identifiers;
   - **PHI-access auditing** — who viewed which PHI, when. This **inverts** the
     Phase-13 posture from "never log PHI access" to "PHI access **must** be
     logged" (an explicit `.read` audit row on the isolated PHI table and the
     patient panels), while the audit log still never *copies* PHI/clinical
     free-text bodies into itself;
   - **encryption at rest** (Supabase platform) with optional column-level
     encryption (pgcrypto is already available) for the most sensitive
     identifiers;
   - an **executed Supabase BAA + HIPAA-eligible project tier + breach-response
     posture** are **Phase-9 deployment-gating** items.

4. **PQS/NSP module architecture** (the locked design):
   - **Dedicated PQS entity.** A singleton `pqs_department` + an access helper
     `app.is_pqs_member(uid)` that returns `is_admin()` today and later ORs in a
     real `pqs_members` table — so the data model is "prepared for the elaborate
     module" the owner anticipates. PQS workspaces live under `/admin/nsp`;
     committee-side reporting + read-back live under `c/[slug]`.
   - **Two tiers with an escalation bridge.** Committees keep their existing
     **lightweight action-tasks** (`case_action_items` / `meeting_action_items`)
     unchanged; when a problem needs more, they **escalate to PQS**, which runs
     the heavyweight **event → triage → RCA → CAPA → effectiveness → closure**
     framework. RCA + effectiveness-verified CAPA + closure live **only** in the
     PQS tier.
   - **Event backbone.** `patient_safety_event` (governance metadata; required
     `reporting_commission_id`, optional `case_id`; raised by **any committee
     member** — a just-culture exception to the staff_admin-write default) +
     isolated 0..1 `event_patient` (PHI) + an append-only `event_custody` ledger
     so **access follows custody** (current holder + reporting committee for
     provenance + admin/PQS) and the full hand-off history is trackable. Coarse
     5-state lifecycle `reported → acknowledged → triaged → closed` (+
     `cancelled`) with an explicit **acknowledge** step and **freeze-at-triaged**
     (audited reopen) so "what was decided at triage is viewable forever."
   - **Triage.** Structured 4-step worksheet (PSE gate → reach → harm severity →
     sentinel screen). Reach (5) and harm (6) scales are **fixed** JC/NCC-MERP
     standard; the sentinel **always-review checklist** and the **event-type**
     vocabulary are **PQS-configurable** (JC/NSP defaults seeded). Pathway ∈
     {RCA, peer review, M&M, FMEA, tracking-only} is **fixed**; a sentinel
     determination auto-mandates a 45-day RCA. **Only the RCA pathway is built
     out** this phase; the other four are recorded dispositions tracked to
     closure. A CAPA can spring from **any** pathway.
   - **RCA.** 1:1 with the event; team of 6 fixed roles (Lead, Facilitator, SME,
     Reviewer, Executive Sponsor, Observer) with an `app.can_write_rca`
     participant-write grant (Observers read-only) mirroring `can_write_interview`;
     incident timeline; evidence as a reuse-by-citation collection + a PQS
     document bucket; **structured** fishbone (6 categories) + 5-Whys + root
     causes (FK'd by CAPA actions); findings = root causes + a summary narrative;
     lifecycle + freeze.
   - **CAPA.** `capa_plan` (reusable primitive; nullable `source` ∈ {rca, event,
     indicator, audit_finding, meeting, manual}) → `capa_action` (fixed 3-tier JC
     **action strength**) → `capa_action_task` + implementation evidence →
     `capa_measure` → `capa_measure_result`; `capa_effectiveness` verdict;
     closure + lessons-learned behind a conclude gate (settled actions +
     recorded effectiveness required; reopen revokes). The `source_indicator_id`
     hook stays nullable for the Phase-15 loop close.

5. **Phasing.** Phase 14 expands into **14a–14d**, each individually §6-gated and
   E2E-testable; the 15–21 numbering is **preserved** (every downstream hook —
   Phase-15 indicator link, Phase-16 `evidence_links.artifact_kind='capa_plan'`,
   Phase-18 finding→CAPA, Phase-20 overdue-CAPA-actions — keeps resolving). A
   single umbrella feature flag **`patient_safety`** (superseding the reserved
   `capa`) is inserted OFF and flipped ON in 14a.

## Consequences

- **Binding docs updated in lock-step with this ADR:** CLAUDE.md §1 (positioning
  + the no-patient-data rule → HIPAA posture) and §3/§5 (Rule-12 brief + Phase-14
  rename + NSP domain concepts); ARCHITECTURE.md **Rule 1** (PHI/minimum-necessary
  note), **Rule 11** (PHI-access logging), and **new Rule 12** (PHI/HIPAA
  handling); quality-track-context §2; PHASES.md / PROGRESS.md Phase-14 rename;
  and the Phase-14 rewrite + preamble in
  [accreditation-track.md](../phases/accreditation-track.md).
- **Phase 13 (in flight) gains an additive follow-up**, not a blocker: PHI-access
  `.read` instrumentation on the new PHI tables (the hash-chain / append-only
  core is unchanged). Tracked as a 14a integration item.
- **Rejected alternative (kept for the record): the de-identified-only model** —
  structured non-identifying classification + a de-identified free-text
  narrative, no structured identifiers. Rejected because the owner adopted HIPAA
  infrastructure, which makes real, far cleaner patient context available for a
  JC-aligned safety programme; de-identification would blunt the very analysis
  RCAs exist to perform and would re-create 0028's awkward "how does an RCA touch
  no patient data?" tension.
- **Per-sub-phase backend ADRs still required** for the novel/security-sensitive
  shapes as 14a–14d are implemented (the custody-ledger access model + PHI
  isolation; the triage state machine + configurable sentinel screen; the RCA
  participant-write grant + structured causal model; the CAPA conclude-gate state
  machine). This ADR is the umbrella; it does not pre-empt them.
- **SQLSTATE allocation** continues the `HC0xx` class from **`HC043`** (Phase 13
  took `HC042`); Phase 14 consumes `HC043–HC053` across its sub-phases and the
  15–21 start-points shift to follow.

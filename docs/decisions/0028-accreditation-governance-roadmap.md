# ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)

**Status:** Accepted — its **no-patient-data stance is superseded by ADR
[0030](./0030-patient-safety-phi-and-pqs-architecture.md)** (2026-06-18); the 9-phase
track structure and sequencing below still stand. · **Date:** 2026-06-17 ·
**Phases:** 13–21 (planning)

## Context

The platform's target buyers are hospitals that must satisfy — or want to
*prepare for* — accreditation: **ONA** (Brazil's dominant national body, three
levels culminating in Nível 3 "excellence"), **JCI / Joint Commission**
internationally, against the **ANVISA/RDC** regulatory backdrop (CCIH —
Portaria 2616/98; NSP — RDC 36/2013; mortality/chart review; CFT; hemovigilance).

Phases 0–12 make the platform an excellent **committee-operations system**:
versioned immutable forms, the wizard, multi-phase cases, meetings with
quorum/atas/e-signatures, interviews, action items, and a case timeline. A
critical review against accreditation requirements found that the three things
surveyors actually score are absent or only partial:

1. a **tamper-evident audit trail** (data integrity / ALCOA+; JCI `MOI`, ONA);
2. a **closed PDCA / CAPA loop** — problem → root cause → action →
   *verification of effectiveness* (JCI `QPS`, ONA Nível 3);
3. **managed quality indicators** tracked vs target over time (JCI `QPS`, ONA N3);

and, above all, nothing in the system maps committee output to a **specific
accreditation standard** — the feature that converts "we run committees" into
"we are prepared for the survey" and that most directly *facilitates*
accreditation for hospitals that don't yet hold it.

## Decision

Add a nine-phase **Accreditation & Quality-Governance Track (Phases 13–21)**,
specified in PHASES.md, each phase feature-flagged, individually testable, and
gated by CLAUDE.md §6.

- **13 Audit Trail** · **14 PDCA/CAPA Closure** · 15 Quality Indicators ·
  16 Standards Crosswalk & Readiness/Gap Engine · 17 Controlled-Document
  Lifecycle · 18 Self-Assessment / Internal Audit / Mock Tracer ·
  19 Surveyor Access & Evidence Export · 20 Notifications & Escalation ·
  21 Committee Charters & Meeting Cadence.

- **Positioning is fixed: a governance / quality LAYER. No patient data.** The
  platform documents committee *process, measurement, and improvement* and sits
  beside the EHR — it does not duplicate the clinical record. The CLAUDE.md §1
  no-patient-data rule is reaffirmed for every phase here. We considered and
  **rejected** a "minimal-identifiers" alternative (a separately-secured
  identifiable-case module to make M&M/incident review self-contained): it
  reopens the LGPD/HIPAA scope we deliberately closed, adds a second
  high-sensitivity RLS domain, and dilutes the differentiator. If a future
  customer forces the question, it gets its own ADR — it is not assumed here.

- **Ordering (and why 13 then 14 first, per the human's direction):**
  - **Audit trail first.** It is the cheapest-now / most-expensive-later table
    in the system, and it is a *cross-cutting contract* every later phase
    honors (Architecture **Rule 11**: every mutation emits an audit row). Build
    it before the data it must capture accumulates.
  - **CAPA second.** It delivers the highest-visibility accreditation
    capability (closed-loop improvement) and builds on the existing action-item
    patterns. It is scoped to **not hard-depend on indicators** — its
    `source_indicator_id` / `measured_value` are **nullable forward hooks**;
    the indicator picker renders disabled until Phase 15 wires it. Phase 15
    then closes the loop (off-target measurement → CAPA → re-measure proves
    effectiveness).
  - 16 (Standards) consumes the artifacts 13–15 (+10–12) produce, so it follows
    them. 17–21 are P1 "excellence-level" capabilities layered on top. 19 is the
    most security-sensitive (external read-only access) and takes a **full plan
    + dedicated security/RLS review** at its gate.

- **Cross-cutting contracts inherited by every track phase** (so they aren't
  re-litigated per phase): feature-flag inserted OFF / flipped ON in-phase
  (mirror `meetings`/`interviews`); custom SQLSTATEs continue the **`HC0xx`**
  class from **`HC042`** upward; RLS is the authority with narrow documented
  `SECURITY DEFINER` exceptions; sanitized Markdown only (Rule 7); pt-BR
  user-facing text; types regenerated after every migration; one keyboard-only
  flow per phase; **every mutation audited** once Phase 13 lands (Rule 11).
  Built ahead of Phase 9 (Deployment), which remains pending.

## Consequences

- **CLAUDE.md** gains the governance-layer positioning + new domain concepts
  (§1), Architecture **Rule 11 — Auditability** (§3, detailed in ARCHITECTURE.md),
  and the reconciled §5 phase table (10–12 backfilled, 13–21 added). **PROGRESS.md**
  gains 🔜 rows for 13–21.
- **Schema grows substantially** but additively: an `audit_log` + chain; CAPA
  (`capa_plans` + RCA + actions + effectiveness); `indicators` +
  `indicator_measurements`; `accreditation_frameworks`/`_standards` +
  `evidence_links` + `standard_assessments`; controlled documents + approvals;
  audit rounds + findings; `surveyor_grants`; `notifications` +
  `notification_preferences`; `commission_charters`. Each lands behind its flag.
- **Reuse over reinvention:** indicators reuse the Phase-8 aggregation spine and
  stable `question_key`; CAPA reuses the action-item lifecycle; controlled-doc
  approvals + surveyor reads reuse the meetings e-signature + DEFINER-read
  patterns; notifications reuse the Phase-3 Mailpit harness; the readiness engine
  reuses the multi-commission model (per-commission slice → admin hospital-wide
  rollup).
- **Per-phase ADRs still required** for the novel/security-sensitive shapes as
  each phase is implemented — notably the audit hash-chain + writer (13), the
  CAPA effectiveness-gate state machine (14), the derived-measurement compute
  path (15), and the external surveyor access model (19). This ADR is the
  umbrella; it does not pre-empt them.
- **Deployment (Phase 9): pilot after Phase 16.** Decided 2026-06-17. The platform
  is *not* deployed first — the build-ahead convention (10–12) continues through the
  **P0 accreditation core (13–16: audit, CAPA, indicators, standards crosswalk)**,
  then a **pilot deployment** goes out so a hospital sees the differentiating features
  rather than a bare committee tool, and so real-user feedback informs Phases 17–21
  (which are sequenced *after* the pilot). Phase 9 is also where the **known prod-auth
  gap is validated** (ADR 0009 — production needs asymmetric JWT signing keys; the
  local JWT-verification middleware path has never run against Supabase Cloud), de-risking
  it *before* the security-sensitive surveyor (19) and email-auth notification (20)
  phases. Doing it first was considered and rejected: deploying a pre-accreditation-feature
  build would undersell the product, and there is no production audit history to lose
  while the system is local-only.

# Legacy codes

A **code** is the short prefix in a `BUG-<CODE>-…`/`FUP-<CODE>-…` id (e.g. `BUG-MT-005`) — a
shorthand for the feature, program or phase an item came from. A new id must use either a hub id
(`docs/features/<id>.md`) or a code listed below; an unrecognized code is a register defect, not
a new namespace. **Hand-written** (ADR 0185 D1) — nothing regenerates this file; edit it directly.
Rows are ordered by measured BUG-/FUP- id frequency under `docs/progress/`, most frequent first.

| Code | Meaning | Record |
|---|---|---|
| DM5 | Document Model Redesign — Wave D/S5: retention, disposal, PHI closure | [dm5-po-decisions.md](../progress/dm5-po-decisions.md), [dm5-s5-operational-closure.md](../progress/dm5-s5-operational-closure.md), [dm5-wave-d-retirement.md](../progress/dm5-wave-d-retirement.md) (ADR 0114/0120/0121) |
| E2E | The Playwright end-to-end suite and its gate (generic — the harness, not one feature) | [e2e-prod-build-gate.md](../testing/e2e-prod-build-gate.md); `scripts/e2e-prod-gate.sh` |
| ACT | "Act as" — role assumption as a binding constraint (impersonation) | [0106-act-as-role-assumption.md](../decisions/0106-act-as-role-assumption.md) |
| DSR | "Direitos do Titular" — the LGPD data-subject-request workflow | [dsr-program.md](../progress/dsr-program.md) (ADR 0130/0131) |
| AUTHZ | The authorization-evolution program (authz catalog, roles, permissions, AE0–AE5) | [authz-evolution.md](../plans/authz-evolution.md) (ADR 0155) |
| QO | Quality-Office oversight (container-level cross-commission visibility) | [quality-office-oversight.md](../progress/quality-office-oversight.md) (ADR 0100) |
| 0137 | The ADR 0137 batch — MRN as erasure key; case/referral usability (D1–D14) | [adr-0137-batch.md](../progress/adr-0137-batch.md) |
| P16 | Phase 16 — Standards Crosswalk & Readiness/Gap Engine (accreditation) | PHASES.md; [phase-16-standards-crosswalk.md](../progress/phase-16-standards-crosswalk.md) |
| FBE | Form-Builder Enhancements (ad-hoc, out-of-phase adjustment batches) | [form-builder-enhancements.md](../progress/form-builder-enhancements.md), [adjustments-batch.md](../progress/adjustments-batch.md) |
| DOOR | Generic authz jargon for an authorization gate / RLS policy / DEFINER-function checkpoint — not one feature | [0079-authz-door-blindness-standing-invariant.md](../decisions/0079-authz-door-blindness-standing-invariant.md) |
| AE2 | Authz-evolution Phase AE2 — affiliation/person-tenancy split completion | [authz-ae2.md](../progress/authz-ae2.md) (ADR 0155) |
| DDR | `document-detail-redesign` — the document viewer/wizard UI rework | [document-control-redesign.md](../progress/document-control-redesign.md) |
| CASE | The Case module / case-surface split | [case-surface-split-increment-1.md](../progress/case-surface-split-increment-1.md), [-increment-2.md](../progress/case-surface-split-increment-2.md) (ADR 0134) |
| MT | Multi-Tenancy — organizations → hospitals → commissions | [0041-multi-tenancy-organizations-hospitals.md](../decisions/0041-multi-tenancy-organizations-hospitals.md); phase-ledger.md row `MT` |
| AFF2 | Affiliation-scoped administration + user-management redesign | [aff2.md](../progress/aff2.md) (ADR 0097/0133) |
| ETH | The Ethics module tracks (E1 access spine … E4 participant seating) | [eth-e1-access-spine.md](../progress/eth-e1-access-spine.md) .. [eth-e4-participant-seating.md](../progress/eth-e4-participant-seating.md) |
| NSP | Núcleo de Segurança do Paciente — patient-safety event → triage → RCA → CAPA | CLAUDE.md §1; [nsp-per-org.md](../progress/nsp-per-org.md), [nsp-per-hospital.md](../progress/nsp-per-hospital.md) |
| AE4 | Authz-evolution Phase AE4 — catalog cutover, `staff_admin` substituted | [ae4.md](../features/ae4.md) hub; [authz-ae4.md](../progress/authz-ae4.md) (ADR 0155) |
| DISPOSE | The four column-erasing PHI disposal doors (`dispose_case_phi` et al.) | [phi-column-disposal-procedure.md](../deployment/phi-column-disposal-procedure.md) |
| PDF | PDF document printing (forms, meetings, reconciliation) | [pdf-p1-forms-skeleton.md](../progress/pdf-p1-forms-skeleton.md), [pdf-p2-meetings.md](../progress/pdf-p2-meetings.md), [pdf-p3.md](../progress/pdf-p3.md) |
| DSS | Deferred Staff-admin Signoff — attests frozen content | [0136-deferred-staff-admin-signoff-attests-frozen-content.md](../decisions/0136-deferred-staff-admin-signoff-attests-frozen-content.md) |
| DISPOSAL | The Storage-bytes PHI-disposal queue/pipeline (`file_objects` `disposal_pending` → `disposed`) | [c1b-disposal.md](../features/c1b-disposal.md) hub; [phi-disposal-runbook.md](../deployment/phi-disposal-runbook.md) |
| DM2 | Document Model Redesign — orchestration + Wave A | [dm2-orchestration-wave-a.md](../progress/dm2-orchestration-wave-a.md) |
| DM4 | Document Model Redesign — Wave C: referrals | [dm4-referrals.md](../progress/dm4-referrals.md) |
| DM1 | Document Model Redesign — substrate cutover | [dm1-substrate-cutover.md](../progress/dm1-substrate-cutover.md) |
| E2EISO | E2E test isolation (teardown/`purge()` cross-contamination between specs) | [archive.md](../bugs/archive.md) § `BUG-E2EISO-002` |
| P22 | Phase 22 — Inter-Committee Case Referrals | PHASES.md; [0037-inter-committee-case-referrals.md](../decisions/0037-inter-committee-case-referrals.md) |
| AE1 | Authz-evolution Phase AE1 — integrity and privilege hardening | [authz-ae1.md](../progress/authz-ae1.md) (ADR 0155 D9) |
| AFF4 | Organization affiliation, per-hospital staff data | [aff4.md](../progress/aff4.md) |
| BOOTSTRAP | The manual first-`platform_admin` bootstrap procedure (no in-app path) | coolify.md § 2.5 (`docs/deployment/coolify.md`) |
| ENV | Developer environment and toolchain — nvm/Node pin, `python3`, worktrees, stale branches (added 2026-09-03 when the retired Now section's environment bullets became register entries) | [worktrees.md](../worktrees.md); [lint-gates.md](../lint-gates.md) |

# ADR Index

> ⚙ **GENERATED FILE — do not edit by hand.** Every column is derived from each
> ADR's own header block. Rebuild with `npm run adr:index`; `npm run lint:adr-index`
> (gate 9 of `npm run lint`) reds when this file is out of date, when two ADRs share
> a number, or when an ADR cites a number that has no file.
>
> **Writing a new ADR?** Take the *next free number* below, write the file, then run
> `npm run adr:index`. Declare what it changes in the header block with a
> `**Supersedes:**` / `**Amends:**` label — that label is the ONLY input to the
> `⚠ Changed by` column, which is the one thing an ADR cannot record about itself.
>
> Edges are **advisory** and over-inclusive by design; the ADR text is truth.

**144 ADRs** · next free number: **0147** · 38 carry an inbound supersedes/amends edge

## ⚠ Anomalies

- **Missing numbers:** 0034, 0077 — a gap is not automatically a defect (0077 was withdrawn by the PO and its subject re-filed as 0078; 0034 was never used), but a gap nobody can explain usually means a lost file.
- **No parseable `Status:`:** none
- **Still proposed / draft / deferred (7):** 0022, 0031, 0033, 0058, 0094, 0108, 0115 — an ADR's status is the author's claim on the day it was written, and nothing updates it when the code ships. The last review of this list is stamped in `proposed-review.json`; gate 9 reds when that review is more than 30 days old or this set has drifted from it.

## Index

| # | ADR | Status | Date | Changes | ⚠ Changed by |
| --- | --- | --- | --- | --- | --- |
| 0001 | [Scaffolding & toolchain bootstrap](0001-scaffolding-and-toolchain.md) | accepted | 2026-06-11 | – | – |
| 0002 | [Admin claim via custom access token hook](0002-admin-claim-access-token-hook.md) | accepted | 2026-06-12 | – | – |
| 0003 | [pgTAP for database tests](0003-pgtap-for-db-tests.md) | accepted | 2026-06-12 | – | – |
| 0004 | [Sign-off enforcement feature flag](0004-signoff-feature-flag.md) | accepted | 2026-06-12 | – | ⚠ amended by 0136 |
| 0005 | [`visible_when` condition shape (v1)](0005-visible-when-shape.md) | accepted | 2026-06-12 | – | ⛔ superseded by 0017 |
| 0006 | [Supabase API key scheme vs. env var naming](0006-supabase-api-key-naming.md) | accepted | 2026-06-12 | – | – |
| 0007 | [Middleware as a coarse auth gate; role landing in root `/`](0007-middleware-coarse-gate-root-landing.md) | accepted | 2026-06-12 | – | – |
| 0008 | [GSAP as the animation dependency](0008-gsap-animation-dependency.md) | accepted | 2026-06-12 | – | – |
| 0009 | [Local JWT verification for the auth gate & identity](0009-jwt-local-verification-gate.md) | accepted | 2026-06-12 | – | – |
| 0010 | [Denormalize email onto public.profiles](0010-denormalize-email-on-profiles.md) | accepted | 2026-06-12 | – | – |
| 0011 | [Position reorder via deferrable constraints + SQL swap RPCs](0011-position-reorder-deferrable-swap.md) | accepted | 2026-06-12 | – | – |
| 0012 | [clone_form_version returns the existing draft (one draft per form)](0012-clone-returns-existing-draft.md) | accepted | 2026-06-12 | – | – |
| 0013 | [Fix form_versions INSERT RLS self-reference](0013-form-versions-insert-rls-fix.md) | accepted | 2026-06-12 | – | – |
| 0014 | [Sanitizing Markdown renderer](0014-markdown-renderer.md) | accepted | 2026-06-12 | – | ⚠ amended by 0145 |
| 0015 | [Response-fill RPCs (atomic section save + get-or-resume)](0015-response-fill-rpcs.md) | accepted | 2026-06-12 | – | ⛔ superseded by 0017 |
| 0016 | [SECURITY DEFINER read path for staff_admin sign-off](0016-signoff-definer-read-path.md) | accepted | 2026-06-13 | – | ⛔ superseded by 0017 · ⚠ amended by 0136 |
| 0017 | [Multi-Phase Cases](0017-multi-phase-cases.md) | accepted | 2026-06-13 | supersedes 0005, 0015, 0016 | ⛔ superseded by 0043 · ⚠ amended by 0136 |
| 0018 | [Custom SQLSTATE class `HC0xx` (was `P00xx`)](0018-custom-sqlstate-class.md) | accepted | 2026-06-13 | – | – |
| 0019 | [The default (anchor) section may carry a title](0019-default-section-may-carry-title.md) | accepted | 2026-06-13 | – | – |
| 0020 | [Dashboard-countable responses: case-phase exclusion](0020-dashboard-countable-responses.md) | accepted | 2026-06-13 | – | – |
| 0021 | [Due dates for case phases](0021-phase-due-dates.md) | accepted | 2026-06-14 | – | – |
| 0022 | [Cross-committee case referrals (linked cases)](0022-cross-committee-referrals.md) | ⚠ proposed | 2026-06-14 | – | ⛔ superseded by 0037 |
| 0023 | [Configurable per-committee case status](0023-configurable-case-status.md) | accepted | 2026-06-14 | – | ⛔ superseded by 0024 |
| 0024 | [Case model adjustments: fixed statuses, phase blocking, outcomes](0024-case-model-adjustments.md) | accepted | 2026-06-14 | supersedes 0023 | – |
| 0025 | [Meetings (scheduling, minutes/ata registry, internal e-signatures)](0025-meetings.md) | accepted | 2026-06-15 | – | – |
| 0026 | [Interviews (case-scoped, participant-write RLS)](0026-interviews.md) | accepted | 2026-06-15 | – | – |
| 0027 | [Case Timeline (read-only event aggregation, two layouts)](0027-case-timeline.md) | accepted | 2026-06-16 | – | – |
| 0028 | [Accreditation & Quality-Governance Roadmap (Phases 13–21)](0028-accreditation-governance-roadmap.md) | accepted | 2026-06-17 | – | ⛔ superseded by 0030 |
| 0029 | [Audit Trail: Hash-Chained, Trigger-Captured, Append-Only](0029-audit-trail-hash-chain.md) | accepted | 2026-06-17 | – | – |
| 0030 | [Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)](0030-patient-safety-phi-and-pqs-architecture.md) | accepted | 2026-06-18 | supersedes 0028 | ⚠ amended by 0037, 0038 |
| 0031 | [Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)](0031-event-custody-ledger-and-phi-isolation.md) | ⚠ draft | 2026-06-18 | – | – |
| 0032 | [Case Narratives (per-case prose interleaved with phases)](0032-case-narratives.md) | accepted | 2026-06-19 | – | ⚠ amended by 0047 |
| 0033 | [Case Access Control (per-case read/write grants, attribution-driven access & "Meus Caso…](0033-case-access-control.md) | ⚠ proposed | 2026-06-19 | – | ⚠ amended by 0038, 0072, 0078, 0134 · ⛔ superseded by 0072, 0078 |
| 0035 | [Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision](0035-lgpd-anvisa-regulatory-posture.md) | accepted | 2026-06-20 | – | – |
| 0036 | [PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classifica…](0036-phi-access-hardening.md) | accepted | 2026-06-20 | – | ⚠ amended by 0037, 0038 |
| 0037 | [Inter-Committee Case Referrals & the referral PHI posture](0037-inter-committee-case-referrals.md) | accepted | 2026-06-21 | supersedes 0022 · amends 0030, 0036 | ⛔ superseded by 0078 · ⚠ amended by 0078, 0137 |
| 0038 | [Case patient identifiers (`case_patient`, the third PHI module)](0038-case-patient-identifiers.md) | accepted | 2026-06-21 | amends 0030, 0033, 0036 | ⛔ superseded by 0064 · ⚠ amended by 0064, 0137 |
| 0039 | [Patient identity & cross-committee linkage (`patient_index`)](0039-patient-identity-cross-committee-linkage.md) | accepted | 2026-06-22 | – | – |
| 0040 | [Form Builder Enhancements: condition engine, per-item visibility, additive schema](0040-form-builder-enhancements-condition-engine.md) | accepted | 2026-06-23 | – | ⛔ superseded by 0043 |
| 0041 | [Multi-Tenancy: organizations + hospitals above commissions](0041-multi-tenancy-organizations-hospitals.md) | accepted | 2026-06-24 | – | – |
| 0042 | [NSP-per-org: per-org PQS roster + org-bound PHI doors](0042-nsp-per-org.md) | accepted | 2026-06-25 | – | ⛔ superseded by 0052 |
| 0043 | [Result-based phase recommendation (combinable `recommend_when`)](0043-phase-result-based-recommendation.md) | accepted | 2026-06-26 | supersedes 0017, 0040 | – |
| 0044 | [Process-less cases ("Sem processo")](0044-processless-cases.md) | accepted | 2026-06-29 | – | – |
| 0045 | [Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys)](0045-answer-model-v2.md) | accepted | 2026-07-01 | – | – |
| 0046 | [Forward-compatible form capabilities (repeating groups, answer blocks, field confidenti…](0046-forward-compat-form-capabilities.md) | accepted | 2026-07-01 | – | – |
| 0047 | [Ad-hoc Case Narratives (per-case narrative add on an open case)](0047-ad-hoc-case-narratives.md) | accepted | 2026-07-01 | amends 0032 | – |
| 0048 | [User Registration & Identity Management](0048-user-registration-identity.md) | accepted | 2026-07-01 | – | ⚠ amended by 0133 |
| 0049 | [Email-verification flag & admin-set initial password](0049-email-verification-flag-admin-set-password.md) | accepted | 2026-07-02 | – | – |
| 0050 | [Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry](0050-action-items-fold-visibility-scope-case-access-expiry.md) | accepted | 2026-07-02 | – | – |
| 0051 | [Hospital-admin tier, 4-tier audit chain & committee member titles](0051-hospital-admin-tier-and-hospital-audit-tier.md) | accepted | 2026-07-03 | – | – |
| 0052 | [NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_a…](0052-nsp-per-hospital.md) | accepted | 2026-07-03 | supersedes 0042 | – |
| 0053 | [Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not…](0053-audit-access-entitlement-guard.md) | accepted | 2026-07-04 | – | – |
| 0054 | [Tenant-hierarchy composite FK: a commission's org must match its hospital's org](0054-tenant-composite-fk.md) | accepted | 2026-07-05 | – | – |
| 0055 | [CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole](0055-capa-tenant-anchor.md) | accepted | 2026-07-05 | – | – |
| 0056 | [PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained)](0056-phi-disposal-closure-narrowed-claim.md) | accepted | 2026-07-05 | – | – |
| 0057 | [Phase 15/17 revision & pre-pilot re-sequencing (15 → 17 → 16)](0057-indicators-doc-control-replan.md) | accepted | 2026-07-05 | – | ⛔ superseded by 0093 |
| 0058 | [Derived quality-indicator measurement compute (the parity lock)](0058-derived-measurement-compute.md) | ⚠ proposed | 2026-07-05 | – | – |
| 0059 | [Coolify as the pre-Phase-9 dev/staging deployment target](0059-coolify-deployment-target.md) | accepted | 2026-07-06 | – | – |
| 0060 | [Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)](0060-flexible-forms-foundation.md) | accepted | 2026-07-07 | – | – |
| 0061 | ["Administrativo" delegated-capability role (per commission)](0061-administrativo-delegated-role.md) | accepted | 2026-07-07 | – | ⚠ amended by 0134 |
| 0062 | [Meeting actual-occurrence time (`held_at` / `held_end`)](0062-meeting-actual-occurrence-time.md) | accepted | 2026-07-08 | – | – |
| 0063 | [Centralized attachments substrate: which DMS-handoff seams we adopt](0063-centralized-attachments-substrate.md) | accepted | 2026-07-09 | – | ⛔ superseded by 0114 · ⚠ amended by 0114 |
| 0064 | [Case subject generalization: participants, roles, professional registry & case types](0064-case-subject-generalization-participants.md) | accepted | 2026-07-09 | supersedes 0038 · amends 0038 | ⛔ superseded by 0072 · ⚠ amended by 0072 |
| 0065 | [Pre-Pilot Foundations conventions (polymorphism · identity · Rule-12 taxonomy · freeze)](0065-pre-pilot-foundations-conventions.md) | accepted | 2026-07-10 | – | ⛔ superseded by 0114 · ⚠ amended by 0114 |
| 0066 | [patient_xref case-module grain re-keyed to the patient participant](0066-patient-xref-participant-rekey.md) | accepted | 2026-07-10 | – | – |
| 0067 | [Lint gate scope & policy (restore a meaningful `npm run lint`)](0067-lint-gate-scope-and-policy.md) | accepted | 2026-07-12 | – | – |
| 0068 | [Case-phase result engine: jsonb/array → FK-backed junctions (D3)](0068-result-engine-fk-junctions.md) | accepted | 2026-07-12 | – | – |
| 0069 | [Anglicize status-enum internal keys (D11)](0069-status-key-anglicization.md) | accepted | 2026-07-12 | – | – |
| 0070 | [Interview data-model v2: sessions + reporting / confidentiality columns](0070-interview-data-model-v2-sessions.md) | accepted | 2026-07-12 | – | – |
| 0071 | [Pre-pilot release scope expansion](0071-pre-pilot-release-scope-expansion.md) | accepted | 2026-07-12 | – | – |
| 0072 | [Ethics access spine: confidentiality, respondent-exclusion, recusal/COI & the m2 gate r…](0072-ethics-access-spine.md) | accepted | 2026-07-13 | supersedes 0033, 0064 · amends 0033, 0064 | ⚠ amended by 0073, 0078 · ⛔ superseded by 0078 |
| 0073 | [Ethics procedure model: admissibility → notice → allegations/findings → hearing → vote…](0073-ethics-procedure-model.md) | accepted | 2026-07-13 | amends 0072 | – |
| 0074 | [Supersession correction model (contract + UX finalization)](0074-supersession-correction-model.md) | accepted | 2026-07-13 | – | – |
| 0075 | [Memberships collapse: service-role vs RLS-scoped write-path split](0075-memberships-collapse-write-path-split.md) | accepted | 2026-07-13 | – | – |
| 0076 | [Notifications (S1·N): pilot scope — prove one vertical deep](0076-notifications-pilot-scope.md) | accepted | 2026-07-13 | – | – |
| 0078 | [Authorization capability model: case capabilities, granular grants, meeting boundary &…](0078-authorization-capability-model.md) | accepted | 2026-07-15 | supersedes 0033, 0037, 0072 · amends 0033, 0037, 0072 | ⛔ superseded by 0079 · ⚠ amended by 0134 |
| 0079 | [AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule](0079-authz-door-blindness-standing-invariant.md) | accepted | 2026-07-18 | supersedes 0078 | ⚠ amended by 0134 |
| 0080 | [Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc life…](0080-committee-charters-cadence-model.md) | accepted | 2026-07-20 | – | – |
| 0081 | [Controlled-Document Redesign + Reviewer Notifications](0081-controlled-document-redesign.md) | accepted | 2026-07-21 | – | ⚠ amended by 0082 |
| 0082 | [Controlled-Document `changes_requested` Status + In-Place Revision](0082-document-changes-requested-status.md) | accepted | 2026-07-22 | amends 0081 | – |
| 0083 | [Case Custom Fields (Template-Defined Administrative Descriptors)](0083-case-custom-fields.md) | accepted | 2026-07-23 | – | – |
| 0084 | [Bulk Case Creation ("Múltiplos casos")](0084-bulk-case-creation.md) | accepted | 2026-07-23 | – | – |
| 0085 | [Case Correction Lifecycle (phases + narratives)](0085-case-correction-lifecycle.md) | accepted | 2026-07-24 | – | – |
| 0086 | [Flexible-Forms feature phases FF-1…FF-5 pulled pre-pilot](0086-flexible-forms-pre-pilot.md) | accepted | 2026-07-27 | – | ⛔ superseded by 0093 |
| 0087 | [FF-1 Repeating Groups: instance engine, condition scoping, required semantics](0087-ff1-repeating-groups.md) | accepted | 2026-07-27 | – | – |
| 0088 | [Case-type assignment: resolving ETH·E3a's Open decision O-1](0088-case-type-assignment-channel.md) | accepted | 2026-07-27 | – | – |
| 0089 | [FF-2 Matrix & Risk Matrix: cell contract, risk derivation, required semantics, axis cod…](0089-ff2-matrix-risk-matrix.md) | accepted | 2026-07-27 | – | – |
| 0090 | [FF-3 Validation Engine: rule vocabulary, coverage, enforcement topology, `required_if`](0090-ff3-validation-engine.md) | accepted | 2026-07-28 | – | – |
| 0091 | [FF-5 Entity Reference: three lanes, hybrid participant scoping, and why INFO-2 needs no…](0091-ff5-entity-reference.md) | accepted | 2026-07-28 | – | – |
| 0092 | [FF-4 Power Authoring: a commission-owned block library, condition-closed snapshots, and…](0092-ff4-power-authoring.md) | accepted | 2026-08-03 | – | – |
| 0093 | [Phase 16 replan: Standards Crosswalk & Readiness/Gap Engine v2](0093-phase-16-standards-crosswalk-replan.md) | accepted | 2026-08-03 | supersedes 0057, 0086 | – |
| 0094 | [Membership-model hardening + Diretor Técnico (technical director) backend](0094-membership-hardening-and-technical-director.md) | ⚠ proposed | 2026-08-04 | – | – |
| 0095 | [Process/case integrity audit: remediation scope, corrections, and deferred remodels](0095-process-case-integrity-audit-remediation.md) | accepted | 2026-08-04 | – | ⛔ superseded by 0096 |
| 0096 | [Process-template versioning (audit M1, full remodel)](0096-process-template-versioning.md) | accepted | 2026-08-04 | supersedes 0095 | – |
| 0097 | [Hospital affiliation, person identity (CPF) and the org-scoped people directory](0097-hospital-affiliation-person-identity.md) | accepted | 2026-08-05 | – | ⚠ amended by 0133 |
| 0098 | [AFF substrate & doors: the shape decisions ADR 0097 left open](0098-aff-w1-substrate-shape-decisions.md) | accepted | 2026-08-06 | – | ⚠ amended by 0133 |
| 0099 | [Meeting audio → generated ata (minute_generator integration)](0099-meeting-audio-minutes.md) | accepted | 2026-08-06 | – | – |
| 0100 | [Quality-office oversight: `quality_reviewer` role, commission oversight classification,…](0100-quality-office-oversight.md) | accepted | 2026-08-06 | – | ⚠ amended by 0102, 0134 |
| 0101 | [The role→landing guard is catalog-derived, not remembered](0101-role-landing-guard.md) | accepted | 2026-08-07 | – | – |
| 0102 | [`p_expires_at` is a real setter on both grant paths (extend-on-regrant)](0102-extend-on-regrant-expiry-seam.md) | accepted | 2026-08-07 | amends 0100 | – |
| 0103 | [On the case-access door, a NULL expiry means PERMANENT (and that is intended)](0103-case-access-null-expiry-is-permanent.md) | accepted | 2026-08-07 | – | – |
| 0104 | [PDF document printing module: record-semantics minting, single registry, template pipel…](0104-pdf-document-printing-module.md) | accepted | 2026-08-07 | – | ⚠ amended by 0125, 0144 |
| 0105 | [Rename `is_commission_admin_of` → `is_tenancy_admin_of`](0105-rename-is-tenancy-admin-of.md) | accepted | 2026-08-08 | – | – |
| 0106 | ["Act as": role assumption as a binding constraint](0106-act-as-role-assumption.md) | accepted | 2026-08-09 | – | – |
| 0107 | [ACT S4: hat-blindness gets its own allowlist artifact + a self-testing standing sweep](0107-act-s4-hat-blind-sweep-and-allowlist.md) | accepted | 2026-08-10 | – | – |
| 0108 | [ETH·E4: seating case participants, and the doors the lane never got](0108-eth-e4-participant-seating.md) | ⚠ proposed | 2026-08-11 | – | – |
| 0109 | [Referral "Registros internos" + the case-access summary door](0109-referral-registros-and-case-access-summary.md) | accepted | 2026-08-11 | – | ⛔ superseded by 0110 |
| 0110 | [One Registro vocabulary for cases and referrals](0110-shared-registro-kind-vocabulary.md) | accepted | 2026-08-12 | supersedes 0109 | – |
| 0111 | [Printed-document doors return the granted-column composite (FUP-PDF-3)](0111-printed-document-door-return-shape.md) | accepted | 2026-08-12 | – | – |
| 0112 | [`case_events.kind` write authority belongs in the policy layer](0112-case-event-kind-write-authority.md) | accepted | 2026-08-12 | – | – |
| 0113 | [Referral-module door RETURN shape: the class, not the instance](0113-referral-door-return-shape.md) | accepted | 2026-08-12 | – | – |
| 0114 | [Document model redesign: documents, versions, file objects, securable resources](0114-document-model-redesign.md) | accepted | 2026-08-12 | supersedes 0063, 0065 · amends 0063, 0065 | – |
| 0115 | [Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the d…](0115-deliberation-and-voting-model.md) | ⚠ proposed | 2026-08-12 | – | – |
| 0116 | [DM1 substrate-cutover decisions (executes ADR 0114 D3/D4/D5/D7)](0116-dm1-substrate-cutover-decisions.md) | accepted | 2026-08-12 | – | – |
| 0117 | [DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`](0117-dm2-s1-confidentiality-ceiling-decisions.md) | accepted | 2026-08-13 | – | – |
| 0118 | [DM2·S2 build decisions: the document command layer](0118-dm2-s2-command-layer-decisions.md) | accepted | 2026-08-13 | – | – |
| 0119 | [DM4 (Wave C): referral documents on the core document model](0119-dm4-referral-document-substrate-decisions.md) | accepted | 2026-08-14 | – | – |
| 0120 | [DM5 (Wave D + retirement) decisions](0120-dm5-wave-d-retirement-decisions.md) | accepted | 2026-08-14 | – | ⚠ amended by 0128 |
| 0121 | [Disposal lifecycle: inflow, outflow, and what `disposed` asserts](0121-disposal-lifecycle-inflow-outflow-and-evidence.md) | accepted | 2026-08-17 | – | – |
| 0122 | [A case-read arm at the referral freeze door (FUP-DM4-RECUSAL)](0122-recusal-case-read-arm-at-the-referral-freeze-door.md) | accepted | 2026-08-17 | – | – |
| 0123 | [Discarding a draft that has emitted documents](0123-discarding-a-draft-that-has-emitted-documents.md) | accepted | 2026-08-18 | – | – |
| 0124 | [PROGRESS.md live-state contract, machine-enforced](0124-progress-live-state-contract.md) | accepted | 2026-08-18 | – | ⚠ amended by 0139, 0140 |
| 0125 | [`Imprimir prévia` (ephemeral) vs `Emitir documento` (registered)](0125-previa-ephemeral-and-emission-registered.md) | accepted | 2026-08-18 | amends 0104 | – |
| 0126 | [A print belongs to a SERIES, and currency is DERIVED](0126-print-series-and-derived-currency.md) | accepted | 2026-08-18 | – | – |
| 0127 | [standing rules get a path-scoped home, and a staleness gate](0127-standing-rules-home-and-staleness-gate.md) | accepted | 2026-08-19 | – | – |
| 0128 | ["I could not look" gets its own exit code, its own name, and its own acknowledgement](0128-unproven-is-not-clean-capture-outcome-classes.md) | accepted | 2026-08-19 | amends 0120 | – |
| 0129 | [A narrow disposal flag through the meeting child lock](0129-meeting-child-lock-disposal-flag.md) | accepted | 2026-08-19 | – | – |
| 0130 | [DSR workflow: data-subject requests as adjudicated cases, not an erase button](0130-dsr-subject-request-workflow.md) | accepted | 2026-08-19 | – | – |
| 0131 | [PHI erasure reach is bounded to DESIGNATED PHI fields; free text is out of scope for th…](0131-phi-erasure-reach-bounded-to-designated-fields.md) | accepted | 2026-08-20 | – | – |
| 0132 | [An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not…](0132-ethics-proceedings-carry-no-erasure-entitlement.md) | accepted | 2026-08-21 | – | – |
| 0133 | [AFF2: affiliation-scoped administration, mandatory-CPF registration & the user-manageme…](0133-aff2-affiliation-scoped-administration-um-redesign.md) | accepted | 2026-08-20 | amends 0048, 0097, 0098 | – |
| 0134 | [The case split is read vs manage: one management surface, and administrativo can read t…](0134-case-surface-split-and-administrativo-case-read.md) | accepted | 2026-08-21 | amends 0033, 0061, 0078, 0079, 0100 | ⚠ amended by 0137 |
| 0135 | [Authored refusals get their own SQLSTATE; `42501` stays reserved](0135-authored-refusals-get-their-own-sqlstate.md) | accepted | 2026-08-22 | – | – |
| 0136 | [Deferred `staff_admin` sign-off: attest a FROZEN response, block the PHASE not the SUBM…](0136-deferred-staff-admin-signoff-attests-frozen-content.md) | accepted | 2026-08-23 | amends 0004, 0016, 0017 | – |
| 0137 | [MRN as the LGPD erasure key; the case/referral usability batch](0137-mrn-erasure-key-and-case-referral-usability-batch.md) | accepted | 2026-08-23 | amends 0037, 0038, 0134 | ⚠ amended by 0142 |
| 0138 | [Unified (non-PHI) action_items hub](0138-unified-action-items.md) | accepted | 2026-07-02 | – | – |
| 0139 | [Quarterly home for concluded § Now rotations](0139-quarterly-home-for-concluded-now-rotations.md) | accepted | 2026-08-24 | amends 0124 | – |
| 0140 | [Tracking-apparatus hardening batch (labels, caps, residue, cadence, sweep)](0140-tracking-apparatus-hardening-batch.md) | accepted | 2026-08-24 | amends 0124 | – |
| 0141 | [Cases board (`manage/cases`) filter redesign: actionable KPIs, saved views, advanced pa…](0141-cases-board-filter-redesign.md) | accepted | 2026-08-24 | – | – |
| 0142 | [One PHI dialog layout; the Atividade composer removed; the Process rail reordered](0142-phi-dialog-layout-atividade-composer-removal-process-rail.md) | accepted | 2026-08-24 | amends 0137 | – |
| 0143 | [A gate for double-encoded UTF-8 (mojibake) in tracked text](0143-mojibake-gate-double-encoded-utf8.md) | accepted | 2026-08-25 | – | – |
| 0144 | [Printing Cases (ADR 0104 P3): the dossier, its lock point, and the PHI fork](0144-case-printing-dossier-lock-and-phi-fork.md) | accepted | 2026-08-25 | amends 0104 | – |
| 0145 | [The print path's Markdown is stricter than the screen's: no `<img>` inside Gotenberg](0145-print-path-markdown-is-stricter-than-screen.md) | accepted | 2026-08-25 | amends 0014 | – |
| 0146 | [The E2E gate harness must not report green while blind](0146-e2e-gate-harness-must-not-report-green-while-blind.md) | accepted | 2026-08-25 | – | – |

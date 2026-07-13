# Graph Report - hospital_form_platform  (2026-07-13)

## Corpus Check
- 1326 files · ~1,730,889 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 9698 nodes · 20094 edges · 1477 communities (589 shown, 888 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b44d202`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Case Lifecycle Actions
- Admin & Auth Pages
- Shared UI & Phase Dialogs
- Error & Not-Found Boundaries
- Condition & Result Rule Editor
- Phase Answers & Assignments
- Triage Disposition & Pathways
- Case Documents
- RCA Problem Stage
- Form Builder Actions
- Submission Detail (Answer Model)
- Section Visibility & Blocks
- CAPA Badges
- NSP Event Pages
- RCA Analysis Stage
- Case Department Field
- Referral Detail & Formatting
- Staff Case Detail
- Org Overview Dashboard
- Quality Indicators
- NSP Patient Registry
- Form Builder Page
- CAPA Actions & Closure
- My Cases List
- Auth Callback & Meeting Settings
- Referral Actions & Reply
- NSP Referrals Dashboard
- Case & Phase Actions
- Meeting Detail & Agenda
- NSP CAPA/RCA Pages
- CAPA Evidence & Cards
- Case Narrative Editor
- Form Item Editor & Tests
- Submission Detail Blocks
- Phase Responder & Submissions
- Case Narrative Cards
- Phase Result Actions
- Admin Layout & Claims
- Interview & Agenda Forms
- Forms & Process Templates
- Derived Indicator Config
- Meeting Attendees & Quorum
- Hospital Detail Pages
- Narrative Templates
- Event Notification & Triage
- Page
- Page
- Layout
- Page
- IsTerminalMeetingStatus
- Page
- UserLifecycleActions
- Page
- Page
- Section signoff fields
- ListMeetings
- Page
- TitleAssignControl
- Condition builder
- Interview badges
- Page
- CaseActionItemForm
- VersionWithUrl
- UploadDialog
- Layout
- Page
- Case tags panel
- Event type manager
- Page
- Page
- Phase result badge
- Wizard runner
- Case timeline
- ADR 0022 — Cross committee case referrals (linked cases)
- Page
- Actions
- Components.json
- Page
- Interim multi org PHI guard (is multi org)
- Dependencies
- Loading
- Route
- ActionItemRow
- CaseActionItemsPanel
- Case document delete
- Gantt axis
- Tsconfig.json
- Active Cases Table
- DevDependencies
- Page
- Recommend when editor
- ADR 0043 phase result based recommendation
- Page
- Page
- Page
- Page
- ActionItemForm
- Referral patient fields
- ClampCalloutCenter
- Actions
- Access Follows Custody Ledger
- Broad can read case read predicate
- ADR 0061: Administrativo Delegated Role
- ADR 0053
- Page
- Outcomes actions
- ADR 0016 — SECURITY DEFINER read path for staff admin sign off
- Audit motion
- CaseTagsPanel
- DepartmentDefDialog
- ADR 0050
- ADR 0028 — Accreditation & Quality Governance Roadmap (Phases 13 21)
- 45 Gap Partner Model Disposition
- Compute derived measurement (parity lock vs dashboard)
- Page
- Audit feed
- Browser
- Answer map golden parity pgTAP (60 answer map golden)
- QA Verdicts Archive
- AdminAuditPage
- Page
- Page
- BlockConditionNote
- ConfirmDeleteButton
- Format
- Rule 11 — Auditability (append only hash chained audit log)
- ADR 0028
- Fold case action items into hub (source type=case)
- Corrective Action (PDCA tracked)
- JWT local verification gate (ADR 0009)
- Dispose referral phi RPC
- App.can sign meeting DEFINER bypass guard (HC036)
- Committee titles (5th per commission vocabulary)
- ADR 0035 — LGPD/ANVISA/CFM Regulatory Posture
- Scripts
- Form builder condition engine enhancements
- App.eval condition single evaluator
- ADR 0048 user registration identity
- Meeting form dialog.test
- ADR 0017 — Multi Phase Cases
- Case access expiry (expires at + reason)
- ADR 0052 NSP per hospital
- Architecture Rule 12 — PHI/HIPAA isolated + audited single door
- Sign own row RLS + can sign meeting DEFINER re check
- Case phase results Feature Review (Per Phase Categorical Result)
- Page
- Page
- Title badge
- Options editor
- Titles
- Architecture Rules (binding)
- Condition evaluator (SQL + TS mirror)
- Forbid cross org referrals
- Capa plan reusable primitive (JC strength)
- Condition evaluator + submit response RPC
- ADR 0048 — User Registration & Identity
- Page
- Page
- OrgAuditPage
- Rule 9 — Data access via src/lib/queries
- ADR 0015 — Response fill RPCs
- Case outcomes vocabulary + per case snapshot (case offered outcomes)
- Dual Evaluator Operator Expansion (contains/is empty)
- Action Items Data Model Handoff
- Indicator→CAPA two tier hook
- Phase 0 — Scaffolding & Environment
- ADR 0044 process less cases
- ADR 0017 — Multi Phase Cases
- Pre pilot DB hardening program
- Rca window form
- Agent Team protocol (lead + teammates)
- Flagged + aggregate result criteria (synthetic keys)
- Case Timeline read only viz (ADR 0027)
- Answers.form version id + composite FK (C 5)
- Cursor injection fix (decodeCursor schema validate)
- Add ad hoc narrative RPC
- ADR 0013 — form versions INSERT RLS Fix
- Page
- Phase result options
- Document editor
- Always on derivation + xref maintain triggers
- Add ad hoc phase
- Kanban HTML Mockup
- C 4 audit entitlement guard (not a revoke)
- WS 4 PHI disposal completion (C 6)
- Multi Tenancy organizations→hospitals→commissions (ADR 0041)
- Phase 15 — Quality Indicators (Indicadores)
- ADR 0056 narrowed erasure claim
- Architecture Rule 11 — Auditability (append only, tamper evident)
- Architecture Rule 1 — RLS is the security boundary
- Fixed case status (configurable status removed)
- Answer selected options table (normalized selections)
- Raw amber classes bypass   warning token (5 files)
- Multi org PHI guard (is pqs member chokepoint)
- M3: capa kpis cross org aggregate leak (RESOLVED)
- Submit response as Submission Authority
- Layout
- Layout
- AttachmentLinkForm
- Rule 7 — Sanitized Markdown, never raw HTML
- ADR 0023 — Configurable per committee case status
- ADR 0062: Meeting Actual Occurrence Time
- Architecture Rule 12 (PHI/HIPAA handling)
- Held at / held end occurrence window
- BLOCKER 1: triage disposition 42702 ambiguous event id (RESOLVED)
- Case / Case Phase State Machine Guards
- ADR 0020 — Dashboard Countable Source
- AuditFeed
- InterviewLifecycleActions
- Avatar stack
- Rule 5 — Published versions immutable
- App.member can (flag aware capability kill switch)
- Can write capa consolidation + non event fallback
- Bug Log Archive (resolved/closed bugs)
- Per answer observations (answers.observation)
- App.app secrets pepper store (service role only)
- Single Condition Evaluator (eval condition SQL / evalCondition TS)
- .prettierrc.json
- Audit icon
- Title assign control
- Answer model v2 (uniform answer row + typed shadow cols)
- CaseEvent Data Model
- Committee Case Generalization Design (ChatGPT)
- Case action items fold + visibility scope (ADR 0050)
- Production asymmetric JWT keys deploy requirement
- Email Denormalization on Profiles (M9)
- Action item Audit Coverage (Rule 11 Win)
- Package.json
- Page
- ADR 0019 — The default (anchor) section may carry a title
- ADR 0027 — Case Timeline (read only event aggregation, two layouts)
- Tenant hierarchy composite FK guard (D2)
- Coolify pre Phase 9 dev/staging deployment
- Get member overview RPC (five member count cards)
- Event model.ts purity (zero imports)
- Layout adjustments batch (2026 07 02)
- Eslint.config.mjs
- Next.config
- Postcss.config.mjs
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Loading
- Per commission case number minting (advisory lock trigger)
- Free text classified as PHI; two tier detail open audit
- Commission member titles vocabulary (display only)
- ADR 0054
- Phase 0 QA Review — Scaffolding & Environment
- README (Next.js bootstrap)
- phase17-documents.spec.ts
- Deploying to DigitalOcean + Coolify (test environment)
- Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis
- recommend-result.spec.ts
- Phase 11 — Interviews QA Review
- Membership Write-Path Lockdown (minimum-viable §6.1)
- Phase 2 Re-review — P2-002 auth hot-path fix
- indicator-format.tsx
- markdown-renderer.tsx
- Answer-Model v2 & Form-Definition Forward-Compatibility
- 2. Security / RLS
- QA Review — Phase A: Hospital-admin tier, 4-tier audit & committee titles
- referrals-list.tsx
- Decision
- Uploaded Documents Data Model Handoff
- 1. Workstreams
- §A — Door / policy / RPC inventory
- Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail)
- Checklist Results
- NSP-per-org sub-phase B — whole-phase QA Review
- flagged-aggregate-result.spec.ts
- 5. Re-render Optimization
- phase7-cases.spec.ts
- Question Editor Dialog — Layout Refactor Spec
- 3. Design
- Per-Area Findings
- Checklist Results
- QA Review — User Registration & Identity Management
- case-phase-result.spec.ts
- form-model-normalization.spec.ts
- PHASES.md — Hospital Commission Forms Platform
- result-actions.ts
- 7. JavaScript Performance
- Quick Reference
- CLAUDE.md — Hospital Commission Forms Platform
- phase11-interviews.spec.ts
- Decision — the locked design
- Action Items Data Model Handoff
- README.md
- Action Items Data Model Handoff
- Why this track exists
- Frontend Audit — External Consultant Review (2026-07-05)
- Phase 0 QA Review
- 5 · Itemized findings (non-blocking)
- case-narratives.spec.ts
- dashboard-charts.tsx
- Increment Plan — Case Access Control & "Meus Casos"
- What was verified live (evidence)
- QA Review — answer-model-v2 mini-phase
- Evaluation of the External DB Audit (2026-07)
- QA Review — Form data-model normalization
- 2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite)
- form-builder-enhancements.spec.ts
- page.tsx
- Attachments core — revised schema draft (Phase 14e + ADR 0063)
- Form Builder Enhancements
- Answer-Model v2 — machine-switch handoff (2026-07-01)
- QA Review — Form-Builder Enhancements batch (ad-hoc, out-of-phase)
- Risks / gaps (ordered by severity)
- Findings by focus area
- Detailed Findings
- Audit Trail
- 6. Rendering Performance
- 0063-centralized-attachments-substrate.md
- 6.2 Participant Subtype Tables
- Plan / Handoff — "Administrativo" delegated-capability role (per commission)
- Checklist
- QA Review — PHI / HIPAA-Readiness Remediation
- QA Review — Pre-Pilot DB Hardening, Wave 2 (WS-6 Performance Sweep)
- case-access.spec.ts
- 3. Server-Side Performance
- ADR 0020 — Dashboard-countable responses: case-phase exclusion
- 0027-case-timeline.md
- Decision
- 30. Type-Specific Extension Tables
- Locked decisions
- NSP-per-hospital — Backend security-core spec (Phase B, backend core)
- Focused Analysis — Audit §4 (Efficiency & Performance) and §5 (Data Model & Extensibility)
- Focus-area findings
- QA Review — Pre-Pilot DB Hardening, Wave 1
- QA Review — "Sem processo" (process-less cases) · flag `processless_cases`
- Audit findings
- QA Review — Option A: Shared (non-PHI) `action_items` table
- React Best Practices
- Sections
- Frontend Design — "Clinical Calm"
- backend-state.md — Living Backend Capability Map
- 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)
- 3.2 `forms.form_versions`
- QA Review — Form Builder Enhancements (mini-phase)
- ad-hoc-narratives.spec.ts
- administrativo.spec.ts
- member-action-items-overview.spec.ts
- phase13-audit.spec.ts
- wizard-others-ux.spec.ts
- PROGRESS.md — Project Status Tracker
- ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors
- 7. Lookup Values and Enums
- Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)
- Increment Archive — Case Access Control & "Meus Casos"
- Phase 10 — Meetings (archived task detail)
- Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)
- Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)
- Findings
- Phase 17 — Controlled-Document Lifecycle · QA Review
- case-patient.spec.ts
- cases-extras.spec.ts
- cases-meetings-minor.spec.ts
- patient-index.spec.ts
- phase14a-safety-events.spec.ts
- phase22-referrals.spec.ts
- phase8-dashboard.spec.ts
- route.ts
- 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values
- Decision
- 18. Relationships Summary
- 20. Migration Strategy From Patient-Centered Cases
- 11. Final Design Principles
- 3.5 `forms.form_blocks`
- 32. RLS Strategy
- 45. Testing Checklist
- 4. Core Architectural Decisions
- Handoff — Meeting actual-occurrence time (`held_at` / `held_end`)
- Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07
- Phase 15 — Quality Indicators (Indicadores de Qualidade)
- Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)
- QA Review — "Administrativo" delegated-capability role (ADR 0061)
- CLAUDE.md optimization — evaluation & change-map
- QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`
- phase14b-triage.spec.ts
- processless-cases.spec.ts
- ui-batch-2026-07.spec.ts
- commission-overview.tsx
- interviewers-panel.tsx
- referral-flow-charts.tsx
- rca-header.tsx
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- 29. Important Implementation Guidance
- 3. Design Principles
- 29. Important Implementation Guidance
- 3. Design Principles
- 5.2 `case_type_terminology`
- 3.3 `forms.form_sections`
- 3.7 `forms.form_block_validations`
- 4.1 `form_responses.form_submissions`
- 4.2 `form_responses.form_answers`
- 43. Anti-Patterns to Avoid
- Lead Playbook — orchestration protocol (lead only)
- Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)
- Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)
- UI/layout fixes batch (frontend + backend)
- Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)
- cases-outcomes-blockers.spec.ts
- nsp-per-hospital.spec.ts
- phase14c-rca.spec.ts
- phase14d-capa.spec.ts
- phase15-indicators.spec.ts
- phase3-admin-members.spec.ts
- phi-remediation.spec.ts
- React Best Practices
- backend-engineer.md
- ADR 0002 — Admin claim via custom access token hook
- ADR 0003 — pgTAP for database tests
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- ADR 0008 — GSAP as the animation dependency
- 0011 — Position reorder via deferrable constraints + SQL swap RPCs
- 0013 — Fix form_versions INSERT RLS self-reference
- ADR 0014 — Sanitizing Markdown renderer
- ADR 0022 — Cross-committee case referrals (linked cases)
- ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture
- ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)
- ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions
- 0050 — Unified (non-PHI) action_items hub
- ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke
- Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)
- 18. Custom Fields
- 7. Status Model
- 10.1 `case_timeline_events`
- 12.1 `case_decisions`
- 19.2 Ethics Complaint Against Doctor
- 21. Supabase / PostgreSQL Implementation Notes
- 2. Core Design Principles
- 5.5 `case_workflow_stages`
- 6.4 `case_participant_roles`
- 9.1 `case_documents`
- 3.10 `forms.form_logic_conditions`
- 3.11 `forms.form_logic_actions`
- 3.12 `forms.form_calculations`
- 3.13 `forms.form_translations`
- 3. Form Definition Layer
- 3.1 `forms.form_templates`
- 3.4 `forms.question_types`
- 3.6 `forms.form_block_options`
- 4. Answer Storage Layer
- 34. Permission Resolution Algorithm
- ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision
- Lead notes
- phase-22.md
- "Sem processo" — process-less case creation (`processless_cases`)
- Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)
- user-registration.spec.ts
- 8. Advanced Patterns
- frontend-engineer.md
- qa-reviewer.md
- qa-tester.md
- ADR 0001 — Scaffolding & toolchain bootstrap
- ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole
- 0012 — clone_form_version returns the existing draft (one draft per form)
- ADR 0019 — The default (anchor) section may carry a title
- ADR 0021 — Due dates for case phases
- ADR 0023 — Configurable per-committee case status
- ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)
- ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")
- 21. Recommended Dashboard Views
- ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry
- 27. Example: Simple Action Item
- ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`
- case-narratives.md
- case-patient.md
- layout-adjustments-2026-07.md
- loading.tsx
- loading.tsx
- loading.tsx
- 19. Templates
- 24. Row-Level Security Considerations
- 25. MVP Implementation Recommendation
- 9. Assignments: `action_item_assignments`
- 13.1 Recommended additions to `action_items`
- 15.1 `audit_events`
- 17.2 `ethics_case_allegations`
- 17.4 `ethics_decision_details`
- 19.1 M&M Patient Case
- 5.1 `case_types`
- 5.3 `committee_cases`
- 6.5 `case_participants`
- 8.2 Recommended additions to `form_responses`
- 3.14 `forms.block_library_items`
- 3.15 `forms.block_library_options`
- 3.17 `forms.form_matrix_rows`
- 3.18 `forms.form_matrix_columns`
- 3.8 `forms.form_block_default_values`
- 3.9 `forms.form_logic_rules`
- 4.10 `form_responses.form_answer_revisions`
- 4.11 `form_responses.form_submission_section_states`
- 4.3 `form_responses.form_answer_options`
- 4.4 `form_responses.form_repeating_group_instances`
- 4.5 `form_responses.form_answer_files`
- 4.6 `form_responses.form_answer_signatures`
- 4.7 `form_responses.form_answer_matrix_cells`
- 4.8 `form_responses.form_answer_risk_matrix`
- 4.9 `form_responses.form_answer_references`
- 10. Table: `documents`
- 14. Table: `document_version_assets`
- 40. Example Scenarios
- 8. Table: `app_resources`
- 9. Table: `document_kinds`
- loading.tsx
- Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA
- hospital-admin-tier.spec.ts
- Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA
- async-cheap-condition-before-await.md
- Prefer Statically Analyzable Paths
- server-hoist-static-io.md
- loading.tsx
- 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)
- 0069 — Anglicize status-enum internal keys (D11)
- Phase 8 — Dashboards & Submissions Browser (archived task detail)
- loading.tsx
- loading.tsx
- 21. Recommended Dashboard Views
- 27. Example: Simple Action Item
- 21. Recommended Dashboard Views
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- 10. Related Records: `action_item_related_records`
- 11. Updates: `action_item_updates`
- 12. Status History: `action_item_status_history`
- 13. Follow-Ups: `action_item_follow_ups`
- 14. Evidence: `action_item_evidence`
- 15. Reviews: `action_item_reviews`
- 16. Checklist Items: `action_item_checklist_items`
- 17. Dependencies: `action_item_dependencies`
- 23. Status Transition Handling
- 26. Recommended User Interface Mapping
- 6. Core Table: `action_items`
- 8. Urgency Model
- 11.1 `committee_meetings`
- 11.2 `meeting_agenda_items`
- 11.3 `meeting_case_discussions`
- 11.4 `case_votes`
- 14.1 `case_access_grants`
- 14.2 `case_conflict_declarations`
- 14.3 `case_recusals`
- 16.1 `mm_case_details`
- 16.2 `mm_contributing_factors`
- 16.3 `mm_preventability_assessments`
- 17.1 `ethics_case_details`
- 17.3 `ethics_case_findings`
- 17.5 `ethics_case_notifications`
- 17.6 `ethics_hearings`
- 17.7 `ethics_appeals`
- 26. Suggested Naming Convention
- 5.4 `case_workflow_templates`
- 5.6 `case_status_history`
- 6.1 `participants`
- 6.3 `professional_profiles`
- 7.1 `case_assignments`
- 8.1 `form_template_case_types`
- 9.2 `case_document_access_grants`
- 11. Table: `document_sensitive_metadata`
- 12. Table: `document_versions`
- 13. Table: `file_assets`
- 15. Table: `document_pages`
- 16. Table: `document_ocr_extractions`
- 17. Table: `document_redactions`
- 18. Table: `document_resource_links`
- 19. Table: `document_subjects`
- 21. Table: `security_groups`
- 22. Table: `security_group_members`
- 23. Table: `document_access_grants`
- 24. Table: `document_effective_permissions`
- 25. Table: `document_access_requests`
- 26. Table: `document_upload_sessions`
- 27. Table: `document_ingestion_jobs`
- 28. Table: `document_access_audit_events`
- 29. Retention and Lifecycle Tables
- 2. Design Goals
- 33. Storage Strategy
- 36. Integration With Forms
- 37. Integration With Cases
- 42. Minimal Viable Implementation Plan
- loading.tsx
- loading.tsx
- loading.tsx
- 12.2 `interview_transcript_segments`
- 2. Architectural Goals
- 9.2 `interview_form_assignments`
- F-cleanup — residual DB-hardening (durable record)
- phase-multitenancy.spec.ts
- advanced-effect-event-deps.md
- advanced-event-handler-refs.md
- advanced-init-once.md
- advanced-use-latest.md
- async-api-routes.md
- async-dependencies.md
- async-parallel.md
- async-suspense-boundaries.md
- bundle-barrel-imports.md
- bundle-conditional.md
- bundle-defer-third-party.md
- bundle-dynamic-imports.md
- bundle-preload.md
- client-event-listeners.md
- client-localstorage-schema.md
- client-passive-event-listeners.md
- client-swr-dedup.md
- js-batch-dom-css.md
- js-cache-function-results.md
- js-cache-property-access.md
- js-cache-storage.md
- js-combine-iterations.md
- js-early-exit.md
- js-flatmap-filter.md
- js-hoist-regexp.md
- js-index-maps.md
- js-length-check-first.md
- js-min-max-loop.md
- js-request-idle-callback.md
- js-set-map-lookups.md
- js-tosorted-immutable.md
- rendering-activity.md
- rendering-animate-svg-wrapper.md
- rendering-conditional-render.md
- rendering-content-visibility.md
- rendering-hoist-jsx.md
- rendering-hydration-no-flicker.md
- rendering-hydration-suppress-warning.md
- rendering-resource-hints.md
- rendering-script-defer-async.md
- rendering-svg-precision.md
- rendering-usetransition-loading.md
- rerender-defer-reads.md
- rerender-dependencies.md
- rerender-derived-state.md
- rerender-derived-state-no-effect.md
- rerender-functional-setstate.md
- rerender-lazy-state-init.md
- rerender-memo.md
- rerender-memo-with-default-value.md
- rerender-move-effect-to-event.md
- rerender-no-inline-components.md
- rerender-simple-expression-in-memo.md
- rerender-split-combined-hooks.md
- rerender-transitions.md
- rerender-use-deferred-value.md
- rerender-use-ref-transient-values.md
- server-after-nonblocking.md
- server-auth-actions.md
- server-cache-lru.md
- server-dedup-props.md
- server-parallel-fetching.md
- server-parallel-nested-fetching.md
- server-serialization.md
- _template.md
- KPI Table HTML Mockup
- decisions-log.md
- phase-0.md
- phase-1.md
- phase-2.md
- phase-3.md
- phase-4.md
- phase-5.md
- phase-6.md
- Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)
- 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema
- 0058 — Derived quality-indicator measurement compute (the parity lock)
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- 0071 — Pre-pilot release scope expansion
- 5.4 `referral_assignments`
- 10.1 `interview_consents`
- 11.1 `interview_notes`
- Feature — `case_phase_results` (per-phase categorical result + manual override)
- 17.1 `interview_external_access_links`
- Rule 2 — Canonical DB schema
- event_patient (isolated PHI satellite)
- form_item_options (normalized choice options)
- Rule 8 — Generated types
- Rule 12 — PHI / HIPAA handling
- Rule 10 — pt-BR user text, English code
- Rule 3 — Response lifecycle & resume + condition evaluator
- Rule 1 — RLS is the security boundary
- Rule 4 — Section sign-offs
- Rule 6 — Storage immutability
- submit_response RPC (submission authority)
- visible_when condition shape
- Commission (organizational unit)
- Form items (input vs display)
- Form versioning (draft→published→archived)
- Governance & accreditation concepts
- Phase Gate (5-step mandatory)
- Hospital Commission Forms Platform (overview)
- Roles (admin / staff_admin / staff)
- Sections (first-class, default section, conditional)
- Tech stack (Next.js/Supabase/Playwright/Vitest)
- Wizard filling with resume
- app.answer_map (evaluator input rebuild)
- backend-state.md — Backend Capability Map
- dispose_event_phi / dispose_case_phi / dispose_referral_phi (LGPD erasure)
- app.feature_flags + get_feature_flags
- app.is_commission_admin_of (combined predicate)
- Migrations catalog (forward-only additive)
- ADR 0005 — visible_when condition shape (v1)
- ADR 0006 — Supabase API key scheme vs env var naming
- ADR 0007 — Middleware coarse auth gate; role landing in /
- ADR 0009 — Local JWT verification for the auth gate
- ADR 0010 — Denormalize email onto public.profiles
- ADR 0011 — Position reorder via deferrable constraints
- ADR 0012 — clone_form_version returns existing draft
- ADR 0013 — Fix form_versions INSERT RLS self-reference
- Atomic section save (RPC over N client upserts)
- Cross-version answer-write guard
- save_section_answers RPC
- start_or_resume_response RPC
- unique_violation-catch resume for double-click races
- in_progress-answer invariant (staff_admin cannot read another member's draft answers)
- list_signoff_queue DEFINER RPC
- Narrow purpose-limited DEFINER read exception instead of broadening RLS
- v1 limitation: no answer-lock between sign-off and submission
- process_templates + process_template_phases (per-commission blueprint)
- recommend_when (condition recommends + human confirms, from_phase qualifier)
- Reuse the condition evaluator; do not touch the mirror
- Snapshot at case creation (pin published form_version_id)
- ADR 0018 — Custom SQLSTATE class HC0xx (was P00xx)
- HC0xx custom SQLSTATE class
- PostgREST 14 maps P0002-P0999 to HTTP 500 and drops non-ASCII JSON body (bug P7-002)
- form_sections_default_shape CHECK relaxation
- Standalone dashboards exclude case-phase responses
- app.submitted_form_responses (single-source countable filter)
- default_due_days / due_date with snapshot isolation
- Linked cases / referrals, not multi-commission shared ownership
- Liveness sweep (case_status_is_terminal replaces = 'aberto')
- Fixed 5-value auto-computed case status (recompute_case_status)
- Phase blocking dependency graph (blocks integer[])
- guard_meeting_child_lock (ignores in_meeting_rpc)
- Meeting 6-state lifecycle + guard_meeting_status
- meeting_signatures (provider-ready schema, content_hash)
- sign_meeting DEFINER re-asserts eligibility explicitly (can_sign_meeting)
- can_write_interview participant-write grant (new RLS shape)
- Conclusion writes case registry via case_events kind='interview'
- case_interviews (case-scoped sibling of meetings)
- getCaseTimeline aggregation in query layer (no migration)
- Meeting-conclusion case_events echo dedup
- No-patient-data / governance-layer positioning (later superseded)
- ONA / JCI / ANVISA-RDC accreditation regimes
- Nine-phase Accreditation & Quality-Governance Track
- ALCOA+ data-integrity principle
- public.audit_log (append-only hash-chained)
- Non-sensitive column allow-list boundary (no PHI/free-text in metadata)
- row_hash = sha256(prev_hash || canonical(row))
- Trigger-based path-independent capture (app.audit_write)
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture
- Rejected de-identified-only model
- patient_safety_event backbone + event_patient + event_custody
- PHI is in scope under HIPAA-compliant Supabase BAA (posture reversal)
- PQS/NSP module (Núcleo de Segurança do Paciente)
- ARCHITECTURE.md Rule 12 (PHI/HIPAA handling safeguards)
- Event → triage → RCA → CAPA → effectiveness closure framework
- Access-follows-custody RLS shape
- ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation
- event_custody append-only ledger drives access
- event_patient PHI isolation + audited read
- case_narratives (per-case snapshot + content, two-table split)
- Separate display_position (not reused position)
- RPC-guaranteed interleave (reorder_case_layout_template)
- ADR 0033 — Case Access Control (per-case read/write grants)
- app.can_read_case / can_write_case_content predicates
- case_access ACL table (attribution-derived read computed)
- Meus Casos unified capability-gated list
- Binding regime is LGPD + ANVISA/RDC + CFM 1821/2007; HIPAA is infrastructure
- Column-level encryption declined; platform at-rest encryption is the posture
- Retention (CFM 20-yr) vs erasure (LGPD Art. 18) reconciliation via dispose_event_phi
- ADR 0036 — PHI Access Hardening
- dispose_event_phi controlled disposal (LGPD erasure)
- pqs_members real membership (admin severed from NSP unless enrolled)
- Single audited door get_event_patient (can_read_event_patient)
- can_read_referral / can_read_referral_phi predicates
- case_referral frozen-snapshot channel (Phase 22)
- QPS macro end-to-end visibility across committees
- referral_patient isolated PHI + get_referral_patient door
- Second PHI-bearing module outside NSP (reverses Rule 12 confinement)
- case_patient (third PHI module)
- process_templates.collects_patient toggle
- dispose_case_phi
- Fixed 8-field identifier catalog
- Reveal-on-demand PHI panel
- app.app_secrets pepper store
- Exact-match-only linkage (no fuzzy matching)
- HMAC-SHA256 keyed linkage hash (patient_key/encounter_key)
- patient_index (cross-committee linkage)
- patient_xref key-only QPS-only index
- search_patient_xref DEFINER door
- Form-builder condition engine enhancements
- conditionTargets widening (number/date/time)
- app.eval_visibility AND/OR group wrapper
- New input types (short_text/number/date/time)
- Multi-tenancy: organizations to hospitals to commissions
- app.is_org_admin_of_commission predicate
- /o/[org]/c/[commission] URL scheme
- Pooled single-database silo-by-exception
- platform_admin vs org_admin role split
- Scope the is_admin() OR-term, don't rewrite every policy
- 3-tier audit hash chain
- Live pg_proc/pg_policies catalog sweep rule (M2/M3)
- Forbid cross-org referrals
- app.is_pqs_member_of(org) predicate
- nsp_coordinator per-org grant
- NSP-per-org: per-org PQS roster + org-bound PHI doors
- Result-based combinable recommend_when
- recompute_recommendations group walker
- Zero evaluator drift (reuse eval_condition)
- create_case template-less minter RPC
- Process-less case (Sem processo)
- set_case_offered_outcomes mutable offered set
- app.answer_map rehydration layer
- Answer-Model v2 (uniform answer entity)
- Evaluator parity invariant (Rule 3)
- Instance-ready key (group_instance_id)
- form_items.default_value
- Forward-compatible form-capability hooks
- form_items.parent_item_id self-reference
- Repeating groups (deferred capability)
- add_ad_hoc_narrative RPC
- Atomic in-RPC create-or-reuse narrative type
- case_narratives.is_ad_hoc provenance
- Activation-link TokenHash email-template fix (BUG-UREG-002)
- deriveUserStatus (derived status, single SQL/TS authority)
- home_organization_id org anchor (deferred constraint trigger)
- app.is_active(uid) folded into membership helpers
- professional_credentials table
- User Registration & Identity Management
- app.can_read_action_item predicate
- case_access grant expiry + reason
- action_items visibility_scope
- Unified non-PHI action_items hub
- CAPA stays isolated (PHI, Rule 12)
- committee_* SECURITY DEFINER RPCs
- Hub-and-spoke shape, redrawn boundary (Option A)
- 4th HOSPITAL audit-chain tier
- hospital_admin tier (org_admin mirrored, hospital-scoped)
- app.is_commission_admin_of combined predicate
- organization_members.role CHECK widening seam
- dispose_referral_phi (dual-hospital LGPD erasure)
- Dual-hospital same-org referral reads
- nsp_org_admin (org-level NSP admin, zero PHI)
- NSP-per-hospital re-key (org to hospital)
- RDC 36/2013 per-facility NSP requirement
- Dispatch to entity's own read predicate
- Audit-access entitlement guard (C-4)
- public.log_audit_access wrapper
- Who-read-what forgery vector
- guard_hospital_org_repoint (HC082)
- Silent tenant-hierarchy org desync
- can_write_capa collapse to hospital-scoped predicate
- CAPA tenant anchor (capa_plan.hospital_id)
- Cross-hospital CAPA write hole (H-8)
- mint_capa_code per-hospital (P8)
- dispose_meeting_minutes RPC
- Narrowed erasure claim (DB PHI erased, Storage retained)
- PHI-disposal closure (C-6) across all three graphs
- Derived quality indicators from option codes
- Controlled-document approvers + e-sign
- Phase 15/17 revision + re-sequencing (15 to 17 to 16)
- Off-target to CAPA two-tier escalation
- compute_derived_measurement (parity lock)
- dashboard_distributions aggregate spine
- Structural dashboard parity (reuse aggregate mechanics)
- Hybrid taxa one-step born-complete
- Coolify Dockerfile app type (no compose/Caddy)
- ADR 0009 prod-auth gap (JWKS/HS256 fallback)
- ADR 0060: Flexible-Forms Foundation
- Prepare-Now/Build-Later Pre-Pilot Schema Strategy
- question_key Aggregation Invariant (Rec A)
- Standalone-Submission Correction Gap (reopen_response)
- Administrativo Curated Capability Menu
- Guarded-DEFINER-Door Authorization Pattern
- Title-vs-Authority Decoupling
- held_at / held_end Occurrence Columns
- Plan-vs-Actual Distinction Rationale
- Custom access-token hook (JWT is_admin claim)
- 25. Recommended Database Triggers and Functions
- 27. Example: Simple Action Item
- F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE
- F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE
- Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)
- hospital-departments.spec.ts
- Conteudo/Comportamento Two-Column Grouping
- ItemEditorDialog Component
- OptionsEditor Table Redesign
- Question Editor Dialog Layout-Refactor Spec
- Clinical Calm Color Theme
- Design Language & Screens Spec (Overview + Kanban)
- AuditEntityType
- 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)
- 0069 — Anglicize status-enum internal keys (D11)
- 13.1 `interview_statements`
- 19. Status History and Audit
- Locked Severity Color (patient-safety)
- Shared UI Components (Status Pill, KPI Card, Sidebar)
- 22. Retention, Deletion, and Legal Hold
- 23. Encryption and Sensitive Data
- 31. Performance Considerations
- 32. Implementation Phases
- 21. Recommended Dashboard Views
- 28. Example: Complex Action Item
- Action Item ChatGPT Draft (partner reference)
- Generic committee_cases Abstraction
- Ethics Committee Extension Tables
- Participants + Case-Type + Role Abstraction
- Single form_blocks Abstraction
- Immutable Form-Version Principle
- Forms & Answers Data Model (ChatGPT)
- Hybrid Typed-Column + JSONB Answer Storage
- capa_plan Reusable Primitive
- Governance/Quality-Layer Positioning
- Phase 13 — Audit Trail (hash-chained)
- Phase 14 — Patient-Safety Events/Triage/RCA/CAPA (NSP)
- Phase 15 — Quality Indicators
- Phase 16 — Standards Crosswalk & Readiness/Gap Engine
- Phase 17 — Controlled-Document Lifecycle
- Phase 18 — Self-Assessment/Internal Audit/Mock Tracer
- Phase 19 — Surveyor Access & Evidence Export
- Phase 20 — Notifications & Escalation
- Phase 21 — Committee Charters & Meeting Cadence
- Accreditation & Quality-Governance Track (Phases 13-21)
- can_read_case / can_write_case_content Predicates
- case_access Per-Case ACL Table
- Contract-First Typed-Stub Sequencing
- Meus Casos View (attribution-driven)
- Case Access Control & Meus Casos Increment Plan
- Phase 14e — Attachment PHI Classification
- Audited Single-Door File Open (JIT signed URL)
- contains_phi Default-Sensitive Column
- Default-Sensitive Classification Rationale
- commission_administrativos + capabilities Tables
- Administrativo Delegated Role Handoff
- app.member_can Capability Helper
- update_case_meta Narrow RPC
- answer_map Byte-for-Byte Evaluator Parity
- Answer-Model v2 & Forward-Compat Plan
- response_group_instances (inert scaffolding)
- Derived Typed Answer Columns (value_number/date/time)
- Uniform (response,item,instance) Answer Row
- Reusable ConditionBuilder Component
- Single Evaluator + evalVisibility Group Wrapper
- New Input Item Types (short_text/number/date/time)
- Per-Option Colors + Observation Field
- Form Builder Enhancements Plan
- Meeting held_at/held_end Handoff
- runLifecycle Uniform-Call Break-Out
- set_meeting_held_window RPC
- Blanket Membership Audit Triggers (H-6)
- DEFINER-Only Write-Door (REVOKE + drop write policy)
- app._deny_self_grant Self-Exclusion Helper
- Membership Write-Path Lockdown Plan
- Self-Escalation to PHI Vulnerabilities (C-3a/C-3b)
- Derived-value dashboard parity lock
- DEFINER-RPC-only write posture (posture b)
- Derived-measurement compute (ADR 0058)
- hospital_indicator_rollup DEFINER (PHI-free)
- public.indicator_measurements table
- public.indicators table
- Quality Indicators Module (Phase 15)
- C-5 answers form_version_id FK
- Pre-Pilot DB Hardening Program
- Pre-launch reset-OK posture
- WS-1 Membership write-path lockdown (C-3)
- WS-2 Grant hardening (C-1/C-2/C-4)
- WS-3 Data-model integrity (C-5/D1-D9)
- WS-5 Performance cheap wins (P1/P7/P9/P10)
- app.can_read_action_item scope predicate
- Meus itens de acao page + Visao Geral overview
- Shared Action-Items Hub (Option A)
- Ad-hoc Case Narratives (ADR 0047)
- add_ad_hoc_narrative DEFINER RPC
- Form-Builder Enhancements batch (ad-hoc)
- Hospital Departments feature
- next build standalone required as green-bar
- Others open option answer model (__other__)
- Segmented TimeField vs masked textbox (a11y)
- Administrativo delegated-capability role (ADR 0061)
- app.member_can flag-aware capability helper
- Phase assignment grants case READ not write
- Answer-Model v2 (ADR 0045/0046)
- Evaluator byte-for-byte unchanged invariant (Rule 3)
- Answer-Model v2 machine-switch handoff
- Typed scalar shadow columns (value_number/date/time)
- Uniform answer row (answer_selected_options re-keyed)
- RSC closure-to-client-component serialization bug (P11-001/P10-LATENT-001)
- Sign-off RLS pre-check block bug (P6-001)
- Cross-spec shared-seed contamination class (P13-004)
- can_read_case / can_write_case_content predicates
- Case Access Control & Meus Casos (ADR 0033)
- Narrative attribution + aberta→concluida lifecycle
- Case Narratives increment (ADR 0032)
- case_patient module (third PHI module, ADR 0038)
- dispose_event_phi controlled disposal RPC
- get_event_patient single audited door
- PHI / HIPAA-Readiness Remediation (ADR 0035/0036)
- pqs_members real-membership lockdown (drop is_admin fallback)
- case_phase_results (per-phase categorical result, ADR)
- compute_case_phase_result + override RPC
- Custom SQLSTATE class P00xx→HC0xx (ADR 0018)
- Decisions Log Archive (verbose ADR history)
- Meetings 6-state lifecycle (ADR 0025)
- Migration squash to domain-partitioned baseline
- Multi-phase cases (ADR 0017)
- RCA-write severance of standalone is_admin
- Prod asymmetric JWT signing key requirement
- dispose_referral_phi LGPD-erasure parity gap
- Follow-ups / Deferred Items Archive
- NSP-per-org guard-lift phase (ADR 0042)
- Prod-build E2E harness debt (reducedMotion + DB isolation)
- ConditionBuilder (ALL/ANY groups + gt/gte/lt/lte)
- Form Builder Enhancements mini-phase (ADR 0040)
- New input types short_text/number/date/time
- Number-condition JSON-number value guard (MAJOR-1)
- app.answer_map rewrite (question_key→code parity)
- form_item_options + answer_selected_options tables
- Form data-model normalization
- PGRST201 embed disambiguation hint
- reconcile_item_options single-txn RPC (MAJOR-1 fix)
- Squash to single 20260620000000 baseline
- Stable option code preserved across edits (optionCode)
- Live-catalog predicate-swap sweep assertion
- Committee member titles vocabulary
- 4-tier audit hash chain (platform/org/hospital/commission)
- Phase A Hospital-admin tier (ADR 0051)
- is_commission_admin_of / is_hospital_admin_of predicates
- Hospital roles / NSP / titles design
- nsp_coordinator local hospital NSP head
- nsp_org_admin org-level zero-PHI NSP admin
- organization_members role-set widen + hospital_id
- list_addable_commission_members RPC (registered-users-only add)
- Future-schedule → blank occurrence default
- Meeting held_at/held_end actual-occurrence time (ADR 0062)
- set_meeting_held_window RPC
- Door inventory is the spec and the assertion
- Dual-hospital referral PHI read (both endpoints)
- is_pqs_operator_of(hospital) helper (coordinator OR member)
- nsp_org_admin PHI-free aggregate doors
- NSP-per-hospital backend security-core (Phase B, ADR 0052)
- org→hospital PHI-door re-key transform (§T)
- Dual-hospital same-org referral read/dispose
- NSP hospital switcher + local console
- nsp_org_admin role (org-level PHI-free aggregates)
- NSP-per-hospital re-key (org→hospital)
- app.is_pqs_member_of(org) predicate primitive
- patient_index fourth PHI surface
- Per-org EV code mint (global ENC)
- PHI door / policy / RPC inventory
- NSP-per-org backend security-core spec
- getNspAccessByOrg seam
- Standalone /o/[org]/nsp console
- NSP-per-org phase record
- Per-org PQS roster curation (coordinator-gated)
- Supabase client factories (browser/server)
- Meeting lifecycle state machine (agendada→distribuida)
- Phase 10 — Meetings (Reuniões)
- sign_meeting electronic signature (auto-flip)
- can_write_interview participant-write grant
- Phase 11 — Interviews (Entrevistas)
- Phase 12 — Case Timeline (Linha do tempo)
- CaseTimelineEvent pure event-model
- (detail) route group (avoids header-doubling)
- Architecture Rule 11 (Auditability)
- Phase 13 — Audit Trail (Trilha de Auditoria)
- app.audit_write hash-chain DEFINER writer
- verify_audit_chain integrity check
- app.can_read_event single-door predicate
- event_custody access-follows-custody ledger
- event_patient PHI isolation satellite
- Phase 14a — NSP Foundation & Event Intake
- event_triage & disposition (sentinel screen)
- Immutable nsp-evidence Storage bucket
- RCA workspace (Fishbone / 5-Whys)
- Phase 14b–14d — Triage, RCA & CAPA (NSP)
- DEFINER-RPC-only write posture (option b)
- Two-tier off-target CAPA escalation
- Named-approver e-signature workflow (signature_hash)
- Phase 17 — Controlled-Document Lifecycle
- Document lifecycle rascunho→vigente→obsoleto
- version-select shared helper (in-force vs actionable)
- Admin claim via custom access token hook
- RLS policy set + is_member_of/is_staff_admin_of helpers
- Phase 1 — Database Schema, Auth & RLS
- Phase 22 — Inter-Committee Case Referrals
- close_case HC076 outstanding-reply block
- Frozen point-in-time snapshot channel
- QPS (is_pqs_member) full-trajectory macro view
- referral_patient isolated PHI (second PHI module)
- app.app_secrets MRN pepper table
- HMAC patient_key/encounter_key matching key
- Phase 23 — Patient Identity & Cross-Committee Linkage
- QPS-only key-only patient_xref
- Phase 2 — Authentication & App Shell
- Calm clinical precision design system
- getSessionContext / getCommissionAccess queries
- Middleware session refresh + route gating
- Phase 3 — Admin Area & User Management
- Assign/invite staff_admin & staff by email
- profiles.email denormalized citext
- Service-role server client (createAdminClient)
- clone_form_version RPC (question_key preservation)
- Deferrable-unique position reorder strategy
- Immutable form-assets Storage bucket
- Phase 4 — Form Builder & Versioning
- Sanitizing Markdown renderer (Rule 7)
- publish_form_version (condition validation + archive)
- evalCondition TS mirror (single show/skip authority)
- save_section_answers atomic upsert + orphan-clear
- Phase 5 — Wizard Filling, Conditional Sections & Resume
- Warn-and-clear orphaned-answer flow
- sign_section RPC (respondent + staff_admin)
- signoff_enforcement flag flip (P0012 gate)
- Narrow DEFINER sign-off queue read path
- Phase 6 — Section Sign-offs & Submission Lifecycle
- HC0xx custom SQLSTATE class remap (ADR 0018)
- in_progress-answers cross-member invariant
- Phase 7 — Multi-Phase Cases
- process_templates + case_phases model
- recommend_when phase-recommendation condition
- Anon/PUBLIC DML/EXECUTE revoke hardening
- Case-phase response dashboard exclusion (ADR 0020)
- CSV export of raw submitted responses
- Dashboard aggregation DEFINER RPCs (submitted-only)
- Phase 8 — Dashboards & Submissions Browser
- dispose_referral_phi (dual-hospital)
- GoTrue auth rate-limit (E2E env flakiness)
- nsp_org_admin role
- NSP-per-hospital (Phase B)
- Org-to-hospital re-key (B0-B5)
- FIX-2 test-isolation leak (staff1 hospital_admin)
- ADR 0055
- audit_log REVOKE + TRUNCATE guard (C-1)
- capa_plan.hospital_id + scoped can_write_capa (D4/H-8)
- Default-privilege revoke-and-grant-per-object (C-2)
- Pre-Pilot DB Hardening Wave 1
- log_audit_access entitlement guard (C-4)
- Membership write-path lockdown (C-3/WS-1)
- PHI disposal closure (C-6)
- count_open_cases_for_board (badge parity)
- CursorPagination component
- get_feature_flags() cached (P4)
- Pre-Pilot DB Hardening Wave 2 (perf sweep WS-6)
- Keyset pagination (Page<T>/cursor)
- BUG-PL-001 (Proximo submits form, button type flip)
- create_case (template-less minter RPC)
- OutcomeMultiselect component
- Process-less cases (Sem processo)
- set_case_offered_outcomes RPC
- Multi-org PHI guard (is_pqs_member chokepoint)
- Multi-Tenancy (organizations/hospitals/org-admin)
- RecommendGroup + evalRecommendation mirror
- recommend-when-editor group builder
- Result-based phase recommendation (recommend_when)
- BUG-P2-002 post-login race
- BUG-P6-001 signSection queue read
- Prod-build toast/dialog quirk (declare green on dev)
- Test Run Summary Archive (Phases 0-MT)
- BUG-UREG-004 (M4 Go html/template GoTrue 500)
- app.is_active() enforcement boundary
- professional_categories + professional_credentials
- token_hash pt-BR invite/recovery email templates
- User Registration & Identity Management
- Data-coupling map (quality rides committee track)
- Feature-flag index (accreditation track)
- Quality-Track Context (Phases 13–21 orientation)
- ADR 0050 action-items fold
- BUG-AIF-001 (mutation dialogs don't close on prod build)
- case_access grant expiry (six-consulter lockout)
- Existence leak closed (case_restricted invisibility)
- QA Review: Action-Items Fold + visibility_scope + Case-Access Expiry
- visibility_scope scope-aware RLS
- ADR 0032 case narratives
- ADR 0047 ad-hoc case narratives
- QA Review: Ad-hoc Narratives
- Flagged + aggregate result criteria (__total_score__/__flagged_count__)
- getLatestSnapshot ref-mirror (use-wizard)
- hospital_departments table + reorder_departments RPC
- Others open option (__other__ / answers.other_text)
- QA Review: Form-Builder Enhancements batch (adjustments)
- Administrativo delegated-capability role
- ADR 0061 Administrativo role
- Escalation guard (_deny_self_grant, no self-appoint)
- member_can flag-aware capability gate
- QA Review: Administrativo delegated-capability role
- update_case_meta RPC (label/department only)
- ADR 0045 answer-model-v2
- ADR 0046 forward-compat form capabilities
- Answer model v2 (uniform answers + typed values)
- Evaluator parity keystone (Rule 3, SQL-TS)
- HC080 default-value validation
- option-code.ts single generator (client-safe)
- response_group_instances (inert scaffolding)
- QA Review: answer-model-v2 mini-phase
- ADR 0033 case-access-control
- Case Access Control (can_read_case predicate spine)
- case_access per-case ACL table
- Meus Casos (list_my_cases unified list)
- Narrative assign/conclude/reopen lifecycle
- QA Review: Case Access Control & Meus Casos
- Case outcome vocabulary + conclude gate (HC028/HC031)
- Phase blocking graph (blocks array, parallel phases)
- QA Review: Case Data-Model Adjustments (D1-D15)
- BLOCK-1 narrative-type-dialog form.set id bug
- Case Narratives increment
- guard_case_narrative_frozen (HC054 freeze-on-close)
- QA Review: Case Narratives (CHANGES REQUESTED)
- ADR 0038 case-patient identifiers
- can_read_case_patient (wraps broad can_read_case)
- case_patient PHI satellite table
- dispose_case_phi (LGPD Art.18 erasure)
- get_case_patient audited single read door
- QA Review: case_patient (Third PHI Module)
- ADR 0022 deferred referrals
- app.apply_case_status DEFINER core (in_case_rpc chokepoint)
- case_documents + immutable storage bucket
- case_tags + case_tag_assignments (HC026 guard)
- QA Review: Cases-Extras Batch (R1-R5)
- C-3 PHI self-escalation via membership tables
- C-4 log_audit_access forgeable read-audit rows
- C-6 PHI disposal incomplete (erasure false claim)
- AIF_BISECT_NO_SUPABASE auth-bypass hook (must never merge)
- Reachability-based triage (act by reachability not label)
- External Database Audit (2026-07)
- Focused Analysis Audit S4 Perf & S5 Data Model
- D6 item_type ELSE NULL footgun
- Hospital-scoped patient master (S6.2)
- S6.4 Storage parity for PHI (signed URLs, audited)
- S6.1 unified memberships table + grant_role RPC
- ADR 0040 form-builder enhancements
- ConditionBuilder (shared, gt/gte/lt/lte)
- New input types (short_text/number/date/time + per-option colours)
- MAJOR-1 number-target condition string mis-evaluation
- Observations on non-free-text inputs
- QA Review: Form Builder Enhancements
- Dashboards group by stable code (rename-safe analytics)
- Evaluator non-drift (SQL and TS byte-identical)
- form_item_options table (version-scoped, frozen)
- MAJOR-1: existing-option reorder duplicate-key failure
- Option code auto-slug, immutable, copied-on-clone
- reconcile_item_options RPC (single-txn INVOKER reorder)
- QA Review — Form Data-Model Normalization
- Frontend Audit — External Consultant Review (2026-07)
- Sequential-await waterfalls in ~16 pages
- No root/global error boundary (HIGH)
- Four duplicated GSAP rise-in motion wrappers
- key={index} on reorderable options list
- No streaming/Suspense + no filter pending feedback
- server-only installed but never imported
- 4-tier audit chain (commission/hospital/org/platform)
- hospital_admin role (org_admin mirrored, hospital-scoped)
- is_commission_admin_of combined predicate swap
- MAJOR-1: hospital-tier integrity check disabled in UI
- MAJOR-2: removeCommittee cross-hospital destructive write
- QA Review — Hospital-Admin Tier & Committee Titles
- QA Review — Meeting Actual-Occurrence Time (held_at/held_end)
- set_meeting_held_window RPC (realizada-only gate HC083)
- list_my_action_items RPC (self-scoped union)
- QA Review — Member Overview & My Action Items
- Audit 3-tier redesign (org_id in hashed tuple)
- org-admin predicate family (is_org_admin_of*)
- Organizations/Hospitals/organization_members hierarchy
- Platform-admin wall (zero tenant-data access)
- RLS rewrite (is_admin → is_org_admin_of_commission swap)
- dispose_referral_phi dual-hospital gate + probe
- is_pqs_member_of(hospital) hospital-scoped roster
- nsp_org_admin (org-level, provably PHI-free)
- QA-B-1: pgTAP 189 disposal keystone (RESOLVED)
- QA Review — NSP-per-hospital & nsp_org_admin
- Body-not-scoped DEFINER-door class sweep
- I1: dispose_case_phi bare is_admin cross-tenant arm (RESOLVED)
- QA Review — NSP-per-org sub-phase A (security core)
- M1: patient_trajectory_bundle over-grant (RESOLVED)
- Three-way duty separation (appoint/curate/read)
- getNspAccessByOrg console admission gate
- QA Review — NSP-per-org sub-phase B (per-org console)
- Meeting 6-state lifecycle state machine
- MINOR-2: quorum present_count includes guests
- Phase 10 QA Review — Meetings
- Participant-write RLS (can_write_interview DEFINER)
- Phase 11 QA Review — Interviews
- getCaseTimeline (read-only composition over RLS reads)
- Phase 12 QA Review — Case Timeline
- Append-only guard HC042 (no bypass, fires for service_role)
- Audit hash chain (audit_canonical over semantic columns)
- log_audit_access allow-listed sensitive-read RPC
- Metadata allow-lists (data-minimization, Rule 11)
- Phase 13 QA Review — Audit Trail
- verify_audit_chain integrity RPC
- CAPA plan lifecycle + conclude gates (HC051/HC052)
- app.in_safety_rpc GUC + freeze/child-lock guards
- Phase 14b-14d QA Review — Triage, RCA & CAPA (NSP)
- triage_disposition RPC (sentinel/RCA verdict authority)
- Access-follows-custody RLS (can_read_event)
- Custody ledger append-only (guard_event_custody HC043)
- event_patient PHI isolation + .read auditing
- M1: pqs_department RLS-on with zero SELECT policy
- Phase 14a QA Review — NSP Foundation & Event Intake
- DEFINER-only write posture (SELECT-only policy)
- Derived measurement parity with dashboard aggregate
- Indicator→CAPA off-target escalation (open_capa_plan arm)
- Phase 15 QA Review — Quality Indicators
- Version-scoped approver-read arm (recursion-safe DEFINER)
- Controlled-document 3-table model + version status
- Named-approver e-sign, all-must-approve, frozen set (HC090/HC093)
- Phase 17 QA Review — Controlled-Document Lifecycle
- Shared version-select helper (in-force vs actionable)
- Condition evaluator SQL↔TS shared-vector mirror
- MAJOR-1: staff_admin UPDATE USING gap (RESOLVED)
- Three-tier immutability (RLS + trigger + RPC guard)
- can_read_referral_phi (no is_admin, three disjuncts)
- QPS macro view via is_pqs_member early-return in can_read_case
- referral_patient PHI isolation + audited single door
- Phase 22 QA Review — Inter-Committee Case Referrals
- Snapshot-on-assemble freeze (no live post-send access)
- derive_patient_key (HMAC-SHA256 under mrn_pepper)
- patient_xref (QPS-only, non-reversible hash keys)
- Phase 23 QA Review — Patient Identity & Cross-Committee Linkage
- search_patient_xref + patient_access_audit DEFINER doors
- getClaims() local JWT verification (asymmetric ES256)
- Middleware coarse-gate + root role-landing design
- Email Denormalization on Profiles (M9)
- revalidateCommissionPages Helper
- ADR 0013 — form_versions INSERT RLS Fix
- clone_form_version RPC
- MarkdownRenderer (react-markdown + rehype-sanitize)
- Storage Immutability (form-assets)
- Two-Level Builder (Sections + Blocks)
- Response Fill RPCs (start_or_resume_response, save_section_answers)
- Warn-and-Clear Orphaned Answers
- ADR 0016 — Sign-offs Design
- app.can_sign_section (SECURITY DEFINER)
- Phase 6 QA Review — Section Sign-offs & Submission Lifecycle
- signoff_enforcement Feature Flag (P0012 check)
- signoffs_insert/signoffs_select RLS Rewrite
- Form-Version Snapshot Pin at Case Creation
- HC0xx SQLSTATE Class (ADR 0018)
- In-Progress Answers Invariant
- app.mint_case_number (Per-Commission Advisory Lock)
- Anon/PUBLIC EXECUTE Revoke (B6)
- CSV Export Date-Filter Gap (MINOR-1)
- Dashboard DEFINER RPC Gating
- app.submitted_form_responses Aggregation Helper
- app.compute_case_phase_result
- app.in_case_rpc GUC (Transaction-Local Guard Bypass)
- result_ruleset Snapshot on case_phases
- set_case_phase_result_override (Manual Override)
- walkResultRuleset TS Evaluator
- ADR 0036 — NSP PHI Lockdown
- dispose_event_phi (One-Shot PHI Disposal)
- get_event_patient — Single Audited PHI Door
- Real PQS Membership (is_pqs_member / pqs_members)
- Six .viewed PHI-Classification Audit Verbs
- Audit-Access Entitlement Guard (C-4)
- audit_log DML/TRUNCATE Lockdown (C-1)
- Answers Composite FK to form_items (C-5)
- Default GRANT ALL Revoke Forward (C-2)
- dispose_case_phi (Case-Graph PHI Disposal)
- Membership Write-Path Lockdown (C-3)
- count_open_cases_for_board (Gate-Parity RPC)
- Cursor .or() Interpolation Gap (MAJOR)
- InitPlan (select auth.uid()) Policy Wrap
- Keyset (Cursor) Pagination
- QA Review — Pre-Pilot DB Hardening, Wave 2 (Performance Sweep)
- ADR 0044 — Process-less Cases
- create_case RPC (Template-less Case Mint)
- QA Review — Sem Processo (Process-less Cases)
- set_case_offered_outcomes RPC
- Three-Way Flag Gating (processless_cases / cases_extras / case_patient)
- ADR 0043 — Result-Based Recommendation
- recommend_when Superset CHECK (Legacy Backward-Compat)
- recompute_recommendations (Suggestion-Only)
- QA Review — Result-Based Phase Recommendation (ADR 0043)
- Synthetic-Map Evaluator Reuse (Zero Drift)
- Shared action_items Hub Table
- committee_* Action-Item DEFINER RPCs
- QA Review — Shared (non-PHI) action_items Table
- ADR 0048 — User Registration & Identity
- deriveUserStatus (TS-Only Derived Status)
- Loop-Free Inactive-User Gate
- app.is_active() Fold into Membership Helpers
- profiles_select_self_or_admin Peer-Branch is_active Gap (B1)
- registerUser Atomic Action + Collision Block
- Accreditation & Quality-Governance Track (13–21)
- Flexible-Forms Foundation
- Multi-Tenancy structural phase (MT)
- NSP-per-hospital structural phase
- Phased Development Plan (0–12 + accreditation track)
- Administrativo delegated-capability role
- BUG-AIF-001 (prod-standalone RSC truncation)
- Meeting actual-occurrence time (held_at/held_end)
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- Lead Playbook — orchestration protocol (lead only)
- Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)
- rca-team-panel.tsx
- Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record
- mem-memberships-collapse.spec.ts
- avatar.tsx
- 14.1 `interview_findings`
- Pre-Pilot DB Hardening — Wave 1 (archived task detail)
- case-meetings-panel.spec.ts

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 515 edges
2. `cn()` - 346 edges
3. `Button()` - 235 edges
4. `commissionHref()` - 155 edges
5. `getCommissionAccessByOrg` - 112 edges
6. `Page` - 102 edges
7. `getSessionContext` - 101 edges
8. `FormBanner()` - 96 edges
9. `NativeSelect()` - 69 edges
10. `DialogContent()` - 62 edges

## Surprising Connections (you probably didn't know these)
- `signInAs()` --references--> `Page`  [EXTRACTED]
  e2e/ad-hoc-narratives.spec.ts → src/lib/types/pagination.ts
- `addWithNewType()` --references--> `Page`  [EXTRACTED]
  e2e/ad-hoc-narratives.spec.ts → src/lib/types/pagination.ts
- `signInAs()` --references--> `Page`  [EXTRACTED]
  e2e/administrativo.spec.ts → src/lib/types/pagination.ts
- `signOut()` --references--> `Page`  [EXTRACTED]
  e2e/administrativo.spec.ts → src/lib/types/pagination.ts
- `signInAs()` --references--> `Page`  [EXTRACTED]
  e2e/answer-model-v2.spec.ts → src/lib/types/pagination.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Case triage classification badges (harm, preventability, status, sentinel)** — docs_design_dashboard_kpi_harm_badge, docs_design_dashboard_kpi_preventability_badge, docs_design_dashboard_kpi_status_badge, docs_design_dashboard_kpi_sentinel_flag [INFERRED 0.85]
- **M&M committee KPI overview metrics** — docs_design_dashboard_kpi_kpi_awaiting_screening, docs_design_dashboard_kpi_kpi_on_next_agenda, docs_design_dashboard_kpi_kpi_under_review, docs_design_dashboard_kpi_kpi_overdue_review, docs_design_dashboard_kpi_kpi_closed_ytd, docs_design_dashboard_kpi_kpi_preventable_rate [EXTRACTED 1.00]

## Communities (1477 total, 888 thin omitted)

### Community 0 - "Case Lifecycle Actions"
Cohesion: 0.14
Nodes (32): ADR-0033, ConfirmDeleteButton(), CoordinatorPhaseActions(), DetailPhase, ADR-0033, ADR-0061, ArchiveOutcomeButton(), OutcomeManager() (+24 more)

### Community 1 - "Admin & Auth Pages"
Cohesion: 0.04
Nodes (89): AdminOrganizationsPage(), metadata, metadata, metadata, metadata, CommissionEditForm(), StaffAdminManager(), LoginForm() (+81 more)

### Community 2 - "Shared UI & Phase Dialogs"
Cohesion: 0.07
Nodes (72): BannerTone, FormBanner(), toneStyles, ActivatePhaseDialog(), defaultDueDateValue(), AddAdHocNarrativeDialog(), AddAdHocPhaseDialog(), ACCEPT (+64 more)

### Community 3 - "Error & Not-Found Boundaries"
Cohesion: 0.02
Nodes (8): metadata, ADR-0051, PhaseResultCorrectButton(), PhaseResultOverrideDialog(), RcaWindowForm(), ADR-0052, UserDirectorySearch(), UserPagination()

### Community 4 - "Condition & Result Rule Editor"
Cohesion: 0.06
Nodes (51): ADR-0005, AGGREGATE_OPS, aggregateKeyFor(), AllowedResultsPicker(), AutomaticEditor(), Criterion, criterionForKey(), DraftRule (+43 more)

### Community 5 - "Phase Answers & Assignments"
Cohesion: 0.08
Nodes (47): AssigneeAvatar(), GrantExpiry(), activePhases(), CaseStatusColumn, currentPhase(), groupByFixedStatus(), hasRecommendedPending(), hasUnassignedWork() (+39 more)

### Community 6 - "Triage Disposition & Pathways"
Cohesion: 0.07
Nodes (57): DispositionRail(), NON_RCA_PATHWAYS, Pill(), VerdictBlock(), HARM_DEFINITIONS, HarmScale(), ChoiceCard(), CLOSURE_DESCRIPTIONS (+49 more)

### Community 7 - "Case Documents"
Cohesion: 0.08
Nodes (50): AnalysisStage(), SubView, Tab(), CatBlock(), Fishbone(), RcaStatusChip(), RootCauseTypePill(), STATUS_CLASS (+42 more)

### Community 8 - "RCA Problem Stage"
Cohesion: 0.13
Nodes (18): CaseNarrativesBuilderPage(), metadata, ADR-0032, CasePhaseList(), mergeTemplateLayout(), CaseLayoutItem, CaseNarrativeTypeRow, expectedEmptyNarratives() (+10 more)

### Community 9 - "Form Builder Actions"
Cohesion: 0.08
Nodes (54): ADR-0011, addItem(), addSection(), ALL_ITEM_TYPES, ALLOWED_IMAGE_MIME, authorizeCommission(), CHOICE_TYPES, COLOR_OPTION_TYPES (+46 more)

### Community 10 - "Submission Detail (Answer Model)"
Cohesion: 0.10
Nodes (31): metadata, PhaseResponderPage(), metadata, ResponderPage(), ConfirmationScreen(), resolveImageUrls(), inputItem(), response() (+23 more)

### Community 11 - "Section Visibility & Blocks"
Cohesion: 0.06
Nodes (34): 0. Scope, 1. Sequencing & dependency stages, 2. Collision matrix — where two tracks touch one schema surface, 3.1 SQLSTATE block allocation (above the live high-water **HC098**; Referrals holds **HC0A0–HC0A9**), 3.2 Feature-flag plan (mechanism: hand-maintained `FeatureFlags` interface + `get_feature_flags()` RPC), 3.3 Cross-cutting conventions (recorded once), 3.4 Specs still to author at S0 (ADR 0071 §Consequences), 3. Design spine — ratified at the S0 gate (+26 more)

### Community 12 - "CAPA Badges"
Cohesion: 0.07
Nodes (44): metadata, NarrativeEditorPage(), ADR-0033, metadata, PhaseAnswersPage(), FormsListPage(), metadata, metadata (+36 more)

### Community 13 - "NSP Event Pages"
Cohesion: 0.07
Nodes (50): metadata, ADR-0042, EventStatusChip(), OwnerChip(), STATUS_ICON, SuspectedHarmChip(), SortDir, SortKey (+42 more)

### Community 14 - "RCA Analysis Stage"
Cohesion: 0.08
Nodes (33): CaseDetailLayout(), ADR-0032, ADR-0033, ADR-0038, ADR-0061, ManageMembersPage(), metadata, ADR-0061 (+25 more)

### Community 15 - "Case Department Field"
Cohesion: 0.09
Nodes (28): metadata, OrgAdministratorsPage(), ADR-0051, ADR-0052, metadata, OrgDocumentsPage(), HospitalDetailPage(), metadata (+20 more)

### Community 16 - "Referral Detail & Formatting"
Cohesion: 0.15
Nodes (23): metadata, ReferralDetailPage(), formatCaseNumber(), formatDate(), formatDateTime(), formatFileSize(), formatReferralCode(), ADR-0037 (+15 more)

### Community 17 - "Staff Case Detail"
Cohesion: 0.05
Nodes (29): openQuestionDialog(), signInAs(), signInAs(), signInAs(), ADR-0042, freshOpenCaseId(), getChefeToken(), goToCaseDetail() (+21 more)

### Community 18 - "Org Overview Dashboard"
Cohesion: 0.18
Nodes (20): metadata, PrimeiroAcessoPage(), ActionState, APPOINT_MESSAGES, assignHospitalAdmin(), assignNspCoordinator(), assignNspOrgAdmin(), authorizeNspOrgAdmin() (+12 more)

### Community 19 - "Quality Indicators"
Cohesion: 0.12
Nodes (20): DerivedConfigPicker(), BuilderFields(), COMPARATORS, ControlledState, CreateAction, DIRECTIONS, FREQUENCIES, KINDS (+12 more)

### Community 20 - "NSP Patient Registry"
Cohesion: 0.08
Nodes (42): metadata, parseEntityParam(), ADR-0039, ADR-0052, VALID_MODULES, AccessAuditTable(), formatDate(), formatDateTime() (+34 more)

### Community 21 - "Form Builder Page"
Cohesion: 0.11
Nodes (27): formatDateTime(), metadata, resolveImageUrls(), SubmissionDetailPage(), BuilderPage(), metadata, resolveImageUrls(), DATE_FMT (+19 more)

### Community 22 - "CAPA Actions & Closure"
Cohesion: 0.06
Nodes (31): App-layer ripple, App-layer ripple, App-layer ripple, App-layer ripple: **none.**  ### Review flag: 🟢. **Open decision → D8-Q1 (skip vs COMMENT migration).**, Current state, Current state, Current state (full sweep), Current state — structural findings (+23 more)

### Community 23 - "My Cases List"
Cohesion: 0.06
Nodes (48): metadata, MyCasesPage(), ADR-0033, OutcomeBreakdownRow, MyCaseCard(), FilterChip(), hasOpenAssignment(), isOpenCase() (+40 more)

### Community 24 - "Auth Callback & Meeting Settings"
Cohesion: 0.11
Nodes (62): GET(), SUCCESS_REDIRECT, LegacyMeetingsSettingsPage(), AgendaRow(), UploadDialog(), AttendeeRow(), MeetingLifecycleActions(), addMeetingAttendee() (+54 more)

### Community 25 - "Referral Actions & Reply"
Cohesion: 0.12
Nodes (33): ReferralActions(), getReferralPatient(), acceptReferral(), addReferralReplyAttachment(), concludeReferral(), createReferralDraft(), declineReferral(), disposeReferralPhi() (+25 more)

### Community 26 - "NSP Referrals Dashboard"
Cohesion: 0.07
Nodes (39): deriveFlowMetrics(), metadata, ADR-0042, DashboardCommissionOption, DashboardOption, ReferralDashboardFilters(), AGING_BUCKETS, CHART_COLORS (+31 more)

### Community 27 - "Case & Phase Actions"
Cohesion: 0.11
Nodes (41): CancelCaseButton(), CreateCaseDialog(), ActionState, activatePhase(), addAdHocPhase(), AddAdHocPhaseState, authorizeCommission(), cancelCase() (+33 more)

### Community 28 - "Meeting Detail & Agenda"
Cohesion: 0.06
Nodes (50): CaseMeetingsPanel(), ActionItemForm(), AssigneeOption, ActionItemRow(), ActionItemsPanel(), isItemOverdue(), STATUS_ORDER, formatDueDate() (+42 more)

### Community 29 - "NSP CAPA/RCA Pages"
Cohesion: 0.06
Nodes (54): CapaActionStatusChip(), CapaClassificationChip(), CapaSourceBadge(), CapaStatusChip(), CapaStrengthPill(), CapaVerdictChip(), STATUS_ICON, STRENGTH_ICON (+46 more)

### Community 30 - "CAPA Evidence & Cards"
Cohesion: 0.15
Nodes (31): CapaActionCard(), CapaEvidenceLinkForm(), CapaEvidenceUpload(), CapaEvidenceList(), CapaTaskList(), RcaConfirmDelete(), addCapaAction(), addCapaActionEvidence() (+23 more)

### Community 31 - "Case Narrative Editor"
Cohesion: 0.08
Nodes (56): metadata, roleFromCapabilities(), StaffCaseDetailPage(), ADR-0033, ADR-0061, CaseDetailPage(), metadata, ADR-0033 (+48 more)

### Community 32 - "Form Item Editor & Tests"
Cohesion: 0.09
Nodes (29): CasePatientEditDialog(), CasePatientPanel(), ADR-0038, TemplateOption, ADR-0038, OutcomeMultiselect(), casePatientToDraft(), EventNotifyForm() (+21 more)

### Community 33 - "Submission Detail Blocks"
Cohesion: 0.19
Nodes (7): formatDateTime(), SectionBody(), SignoffMeta(), ITEM_TYPE_META, ItemTypeMeta, ImageContentRenderer(), SectionTextRenderer()

### Community 34 - "Phase Responder & Submissions"
Cohesion: 0.17
Nodes (31): UploadDialog(), InterviewLifecycleActions(), addInterviewInterviewer(), addInterviewLink(), addInterviewSubject(), ALLOWED_ATTACHMENT_MIME, ATTACHMENT_KINDS, authorizeStaffAdmin() (+23 more)

### Community 35 - "Case Narrative Cards"
Cohesion: 0.15
Nodes (38): CaseNarrativeCard(), NarrativeAssignMenu(), ADR-0032, ADR-0033, ConcludeNarrativeButton(), caseAccessEnabled(), addAdHocNarrative(), addTemplateNarrative() (+30 more)

### Community 36 - "Phase Result Actions"
Cohesion: 0.27
Nodes (21): ActionState, AddPhaseState, addTemplatePhase(), archiveProcessTemplate(), authorizeCommission(), commissionOfTemplate(), contextOfPhase(), createProcessTemplate() (+13 more)

### Community 37 - "Admin Layout & Claims"
Cohesion: 0.08
Nodes (28): DetailPhase, ADR-0033, ADR-0061, CaseStatusBadgeFixed(), MyCaseItemAction(), MyCaseItemRow(), ADR-0033, NarrativeEditor() (+20 more)

### Community 38 - "Interview & Agenda Forms"
Cohesion: 0.12
Nodes (17): 5.11 `referral_resolutions`, 5.2 `referral_context_versions`, 5.6 `referral_internal_notes`, 5.8 `referral_message_documents`, 5. Table Definitions, Columns, Columns, Columns (+9 more)

### Community 39 - "Forms & Process Templates"
Cohesion: 0.14
Nodes (20): OrgUsersPage(), UserDirectoryList(), STATUS_LABEL, STATUS_STYLES, UserStatusBadge(), listHospitalUsers(), listOrgUsers(), ProfileRow (+12 more)

### Community 40 - "Derived Indicator Config"
Cohesion: 0.13
Nodes (32): CapaActionsSection(), CapaClosurePanel(), GateRow(), activePdcaStage(), allActionsSettled(), allMeasuresHaveResults(), canAdvanceAction(), concludeGate (+24 more)

### Community 41 - "Meeting Attendees & Quorum"
Cohesion: 0.11
Nodes (26): CasesBoardPage(), metadata, ADR-0038, ADR-0061, ACTIVE_OR_PENDING, blockedBy(), BoardPhase, CaseKpis (+18 more)

### Community 42 - "Hospital Detail Pages"
Cohesion: 0.07
Nodes (27): 0. Conflicts named (plan wins) + verified-fact corrections, A.1 `public.attachments` — core (single authorizing owner + six ADR-0063 seams), A.2 `public.attachment_references` — non-authorizing "also appears here" (ADR-0063 §1), A.3 `public.attachment_subjects` — descriptive, PHI-safe, **participant-keyed (C-β)**, A.4 `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), A. Table / column DDL plan (attachments + companions), Appendix — verified F1/baseline build surface (symbols F2 depends on), B.1 `app.commission_of_attachment(owner_type text, owner_id uuid) returns uuid` (+19 more)

### Community 43 - "Narrative Templates"
Cohesion: 0.06
Nodes (77): PhaseResultBadge(), timelineResultToResolved(), AvatarStack(), CaseTimeline(), DAY_MONTH, DERIVED_PILL, durationSuffix(), formatEventDate() (+69 more)

### Community 44 - "Event Notification & Triage"
Cohesion: 0.16
Nodes (16): SubmissionsFiltersAsync(), SubmissionsFilters(), ResponseStatus, SelectionRow, SignoffRecord, DetailAnswerRow, DetailResponseRow, listSubmissionFilterForms() (+8 more)

### Community 45 - "Page"
Cohesion: 0.08
Nodes (24): 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema, conditionTargets widening (supersedes a prior decision), Consequences, Context, Decisions, 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values, Alternatives rejected, Consequences (+16 more)

### Community 46 - "Page"
Cohesion: 0.12
Nodes (16): 12. Transactional Outbox and Notifications, 13. Audit and Retention, 15.1 Optimistic concurrency, 15.2 Pessimistic locking for commands, 15.3 Idempotency keys, 15. Concurrency Control, 16. Suggested Application-Layer Domain Model, 18.1 Referral inbox (+8 more)

### Community 47 - "Layout"
Cohesion: 0.09
Nodes (24): PendingApprovalsLayout(), OrgCommissionDetailError(), OrgManageLayout(), ADR-0051, OrgNspAdminLayout(), ADR-0052, metadata, OrgPickerPage() (+16 more)

### Community 48 - "Page"
Cohesion: 0.03
Nodes (93): CHOICE_OPS, CHOICE_TARGET_TYPES, ConditionBuilder(), DraftRow, isChoiceTarget(), isGroup(), nextUid(), OP_LABELS (+85 more)

### Community 49 - "IsTerminalMeetingStatus"
Cohesion: 0.11
Nodes (26): metadata, OrgCommissionsPage(), ADR-0051, AREAS, ManageArea, metadata, OrgManageHomePage(), ADR-0051 (+18 more)

### Community 50 - "Page"
Cohesion: 0.09
Nodes (27): ArchiveResultButton(), ResultVocabManager(), useResultAction(), BlockCard(), BlockConditionNote(), BlockPreview(), formatScore(), BlockList() (+19 more)

### Community 51 - "UserLifecycleActions"
Cohesion: 0.15
Nodes (30): UserLifecycleActions(), createAdminClient(), ActionState, appOrigin(), assignCommitteeRole(), authorizeForCommission(), authorizeForUser(), authorizeHospitalOps() (+22 more)

### Community 52 - "Page"
Cohesion: 0.14
Nodes (19): ActionItemSourceBadge(), ActionItemStatusBadge(), SOURCE_META, STATUS_META, ActionItemsTable(), compareItems(), Filters(), ItemRow() (+11 more)

### Community 53 - "Page"
Cohesion: 0.15
Nodes (13): metadata, Home(), ADR-0051, ADR-0052, appOrigin(), AuthState, MESSAGES, requestPasswordReset() (+5 more)

### Community 54 - "Section signoff fields"
Cohesion: 0.09
Nodes (44): item(), BlockRenderer(), CHOICE_TYPES, computeEffectiveVisibility(), EffectiveVisibility, INPUT_ITEM_TYPES, INPUT_TYPES, isChoiceItem() (+36 more)

### Community 55 - "ListMeetings"
Cohesion: 0.33
Nodes (6): Backend (`backend`), Frontend (`frontend`), Lead gate record (2026-06-29), Lead gate record UPDATE (2026-06-30) — gate closed, "Sem processo" — process-less case creation (`processless_cases`), Tester (`tester`) — gate

### Community 56 - "Page"
Cohesion: 0.10
Nodes (19): 15.1 `interview_summaries`, 15. Summaries, 16.1 `interview_documents`, 16. Document Integration, 1. Domain Overview, 24. Indexing Strategy, 27. Frontend Implications, 29. Enum Implementation Strategy (+11 more)

### Community 57 - "TitleAssignControl"
Cohesion: 0.09
Nodes (33): ConfirmRemoveButton(), TitleAssignControl(), ADR-0051, CAPABILITIES, MemberAdministrativoControls(), ADR-0061, ADR-0051, ADR-0061 (+25 more)

### Community 58 - "Condition builder"
Cohesion: 0.08
Nodes (30): commissionInitials(), CommissionPickerPage(), metadata, ROLE_LABEL, slugifyHeading(), metadata, NewCommissionEventPage(), metadata (+22 more)

### Community 59 - "Interview badges"
Cohesion: 0.13
Nodes (13): readHiddenDateValue(), buildPublishedDoc(), commissionDocHref(), cookieJar, loginFresh(), ownerTokenCache, pdfPayload, pickApprover() (+5 more)

### Community 60 - "Page"
Cohesion: 0.10
Nodes (22): PhaseAnswersReadonly(), AnswerSummary(), formatIsoDate(), OptionChip(), renderValue(), ItemHandlers, isEmptyValue(), WizardActions (+14 more)

### Community 61 - "CaseActionItemForm"
Cohesion: 0.10
Nodes (26): metadata, ProcessTemplatesListPage(), CreateProcessTemplateDialog(), ProcessTemplateCard(), STATUS_LABEL, STATUS_STYLES, TemplateStatusBadge(), ProcessTemplateNarrative (+18 more)

### Community 62 - "VersionWithUrl"
Cohesion: 0.10
Nodes (34): asDocStatus(), asDocType(), DOC_STATUSES, DOC_TYPES, DocumentsPage(), metadata, VersionWithUrl, APPROVAL_DECISION_LABELS (+26 more)

### Community 63 - "UploadDialog"
Cohesion: 0.12
Nodes (23): InterviewDetailPage(), metadata, isEditableInterviewStatus(), InterviewSummaryEditor(), SubjectForm(), SubjectMemberOption, SubjectRow(), SubjectsPanel() (+15 more)

### Community 64 - "Layout"
Cohesion: 0.05
Nodes (42): 10. Findings, 1.1 `case_phases` carries status/assignee/recommended only — never answers, 1.2 Coordinator board reads (`list_cases_board` / `get_case_detail`), 1.3 `case_phase_answer_map` is submitted-only, 1.4 `recompute_recommendations` is submitted-only end-to-end, 1.5 `responses_select` / `answers_select` not broadened, 1.6 RLS check in the E2E suite, 1.7 Service-role key not reachable client-side (+34 more)

### Community 65 - "Page"
Cohesion: 0.09
Nodes (32): metadata, resolveImageUrls(), ReviewAndSignPage(), ADR-0061, RespondentSignoff(), signoffRecordsToMap(), toClientResponseForSignoff(), toSectionSignoff() (+24 more)

### Community 66 - "Case tags panel"
Cohesion: 0.20
Nodes (20): ActionItemRow(), isItemOverdue(), ACTION_ITEM_STATUSES, ActionState, advanceActionItem(), authorizeCommission(), commissionOfCase(), completeActionItem() (+12 more)

### Community 67 - "Event type manager"
Cohesion: 0.19
Nodes (10): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), signInAs(), slug(), startResponse() (+2 more)

### Community 68 - "Page"
Cohesion: 0.08
Nodes (47): AdminAuditPage(), metadata, AdminLayout(), ADR-0042, csvField(), GET(), toCsv(), ADR-0029 (+39 more)

### Community 69 - "Page"
Cohesion: 0.13
Nodes (15): 0. Why, 1. The three-bucket disposition (summary — full rationale in the evaluation doc), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 5. Avoided items (recorded so builders don't reintroduce them), 6. Testing & gates, 7. Risks & open decisions for the product owner (+7 more)

### Community 70 - "Phase result badge"
Cohesion: 0.05
Nodes (40): 1. Requirements Audit (PHASES.md §Phase 5), 2. Security / RLS Audit (Architecture Rule 1 + Rule 3), 3. Code Quality (Architecture Rule 9 + CLAUDE.md §8), 4. UX & Accessibility (CLAUDE.md §8, Architecture Rule 7), 5. Hygiene, 6. Findings, 7. Scope Deferrals Confirmed (Not Findings), 8. RLS Verification Summary (+32 more)

### Community 71 - "Wizard runner"
Cohesion: 0.18
Nodes (20): saveAndExit, saveSection, signSection, submitCasePhaseResponse, submitResponse, WizardRunner(), ActionState, authorizeMember() (+12 more)

### Community 72 - "Case timeline"
Cohesion: 0.08
Nodes (24): 0. Scope, 1. Collision matrix — the four initiatives against each other, 2. The design spine (D-remainder folded in) — conventions ratified at F0, 3. Phased sequence, 4. Rule 12 / Rule 2 amendment plan (who writes what, when), 5. Disposition of every hardening Wave-3/4 item (initiative D), 6. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 7. Testing & gates (+16 more)

### Community 74 - "Page"
Cohesion: 0.07
Nodes (38): CommissionEventsPage(), metadata, metadata, OrgNspCoordinationPage(), ADR-0052, metadata, NspTriagePage(), EventsList() (+30 more)

### Community 75 - "Actions"
Cohesion: 0.06
Nodes (35): 1. Requirements Audit — the 8 Locked Decisions, 2. Security / RLS / PHI Review, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, Accessibility, ADR exists for non-trivial choices, `can_read_case_patient` wraps the live `can_read_case` (+27 more)

### Community 76 - "Components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 77 - "Page"
Cohesion: 0.07
Nodes (39): metadata, OrgOverviewPage(), CHART_COLORS, CommissionOverview(), DashboardCharts(), groupBySection(), SectionEntry, SectionGroupData (+31 more)

### Community 79 - "Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, class-variance-authority, clsx, date-fns, gsap, lucide-react, next, radix-ui (+13 more)

### Community 81 - "Loading"
Cohesion: 0.09
Nodes (22): 1. Data model (shared by both layouts), 2. Design token mapping, 3.1 Geometry constants (recommended; adapt to your scale), 3.2 Axis header, 3.3 Background layers (behind events), 3.4 Phase bars (width = duration), 3.5 Single-day pins, 3.6 Event states (visual) (+14 more)

### Community 82 - "Route"
Cohesion: 0.17
Nodes (24): metadata, AddVersionForm(), ApprovalSignForm(), ObsoleteDocumentButton(), PublishDocumentDialog(), SubmitForApprovalForm(), SupersedeDocumentButton(), addDocumentVersion() (+16 more)

### Community 83 - "ActionItemRow"
Cohesion: 0.13
Nodes (18): metadata, OrgNspCoordinatorsPage(), metadata, OrgNspOverviewPage(), personLabel(), ADR-0052, NspOrgHospitalManager(), NspOrgRollups() (+10 more)

### Community 84 - "CaseActionItemsPanel"
Cohesion: 0.25
Nodes (20): EventTypeManager(), SentinelCriterionManager(), TriageWorkstation(), VocabActions, mapTriageError(), archiveEventType(), archiveSentinelCriterion(), confirmTriage() (+12 more)

### Community 85 - "Case document delete"
Cohesion: 0.06
Nodes (29): ADR-0026, fieldContainer(), fillTimeField(), pickDate(), pickDateKeyboard(), setDateTimeField(), setDateTimeFieldKeyboard(), callRPC() (+21 more)

### Community 86 - "Gantt axis"
Cohesion: 0.14
Nodes (13): Area findings, D10 — `updated_at` triggers  🟢 — SOUND, D11 — status-key anglicization (G1–G6)  🔴 scope — SOUND, D3 — result-engine junctions  🔴 (the crux) — SOUND, D8 — forward-FK lock  🟢 — SOUND, F-cleanup — QA Review (D3 · D10 · D8 · D11), Findings (ranked), Recommendation (+5 more)

### Community 87 - "Tsconfig.json"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 88 - "Active Cases Table"
Cohesion: 0.13
Nodes (20): Active Cases Table, Case Review Lifecycle (screening → agenda → review → action items → closed), Case Row (MM-2026-xxxx, patient, event, service, harm, preventability, lead, status), Harm Severity Badge (Death / Permanent / Temporary / Near miss), KPI: Awaiting screening (7), KPI Card Row (top metrics strip), KPI: Closed YTD (38), KPI: On next agenda (4) (+12 more)

### Community 89 - "DevDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, prettier, prettier-plugin-tailwindcss, supabase (+12 more)

### Community 90 - "Page"
Cohesion: 0.06
Nodes (31): 1. Requirements / Deliverables, 2. Security / RLS, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, ADR coverage, Baseline security fix, Commission picker (`/c/page.tsx`) (+23 more)

### Community 91 - "Recommend when editor"
Cohesion: 0.06
Nodes (31): 22. Key Design Decisions and Justifications, Decision, Decision 10 — Audit both reads and writes for sensitive cases, Decision 1 — Replace patient-centered case ownership with generic committee cases, Decision 2 — Add `case_types`, Decision, Decision, Decision (+23 more)

### Community 93 - "Page"
Cohesion: 0.08
Nodes (42): metadata, NspConfigPage(), ADR-0052, NspReferralsDashboardPage(), metadata, NspRosterPage(), ADR-0052, metadata (+34 more)

### Community 94 - "Page"
Cohesion: 0.07
Nodes (29): 0 · CAPA-surface confirmation (B1 (a) — closes the pre-WS-3c-baseline risk), 1.1 `public.indicators`, 1.2 `public.indicator_measurements`, 1.3 `app.mint_indicator_code()` — per-commission (reuses the `mint_meeting_number` pattern), 1.4 Flag seed — **OFF**, 1.5 RLS (Rule 1) — **posture (b): DEFINER-RPC-only writes (LEAD DECISION 2026-07-05)**, 1.6 Audit AFTER-triggers (Rule 11 — non-sensitive allow-list, **never `description_md`**), 1 · Migration set (B2 — `20260712000000_indicators_core.sql`) (+21 more)

### Community 95 - "Page"
Cohesion: 0.07
Nodes (24): ADR 0009 — Local JWT verification for the auth gate & identity, Consequences, Context, Decision, Rationale, 0010 — Denormalize email onto public.profiles, Consequences, Context (+16 more)

### Community 96 - "Page"
Cohesion: 0.18
Nodes (20): metadata, NspCapaPage(), metadata, NspRcaPage(), getCapaEffectiveness(), getCapaPlan(), listCapaActionEvidence(), listCapaActions() (+12 more)

### Community 97 - "ActionItemForm"
Cohesion: 0.07
Nodes (29): 1. Requirements Coverage, 2.1 The three predicates, 2.2 Flag-OFF fallback — no ON-path gap, 2.3 Anon / PUBLIC EXECUTE, 2.4 `case_access` SELECT policy scoping, 2.5 Additive `case_documents` / `case_events` WRITE policies, 2.6 Submitted-only invariant (Phase-7), 2.7 PHI isolation (Architecture Rule 12) (+21 more)

### Community 98 - "Referral patient fields"
Cohesion: 0.22
Nodes (11): formatDate(), generateMetadata(), OrgCommissionDetailPage(), AdminCommissionDetail, AdminCommissionListItem, CommissionRow, getCommissionForAdmin(), listCommissionsForAdmin() (+3 more)

### Community 99 - "ClampCalloutCenter"
Cohesion: 0.07
Nodes (28): 1. Requirements Audit, 2. Security / RLS Audit, 2a. Definer RPC gating, 2b. in_progress-answers invariant (the crux), 2c. B6 anon/PUBLIC EXECUTE revoke, 2d. Export route — no service-role key, 2e. Client-side form filter in `listSubmissions`, 3. Code Quality Audit (+20 more)

### Community 100 - "Actions"
Cohesion: 0.12
Nodes (24): CapaStage(), OpenCapaButton(), RcaMemberRoleBadge(), countDone(), deriveDone(), deriveKeyFactors(), groupFactorsByCategory(), RCA_STAGE_META (+16 more)

### Community 105 - "Page"
Cohesion: 0.13
Nodes (19): EMPTY_REFERRAL_PATIENT_DRAFT, ReferralPatientDraft, referralPatientDraftHasData(), referralPatientDraftToInput(), ReferralPatientFields(), SEX_ORDER, ADR-0037, NOTE: removal is a hub-draft affordance in v1; here we only ADD. Toggling (+11 more)

### Community 106 - "Outcomes actions"
Cohesion: 0.18
Nodes (13): appOrigin(), assignStaffAdmin(), authorizeStaffAdminOps(), createCommission(), MESSAGES, removeStaffAdmin(), requireAdmin(), revalidateCommissionPages() (+5 more)

### Community 108 - "Audit motion"
Cohesion: 0.30
Nodes (11): formatCaseNumber(), formatInterviewNumber(), interviewTitle(), InterviewModalityChip(), InterviewStatusBadge(), InterviewPhaseOption, NewInterviewButton(), InterviewHeader() (+3 more)

### Community 109 - "CaseTagsPanel"
Cohesion: 0.07
Nodes (30): CaseActionItemsPanel(), DEPARTMENTS, CaseReferralsModule, ADR-0032, ADR-0038, ADR-0061, CaseDocumentUpload(), ADR-0033 (+22 more)

### Community 110 - "DepartmentDefDialog"
Cohesion: 0.10
Nodes (39): CauseCard(), ProblemCard(), ProblemStage(), TimelineRow(), RootCard(), mapRcaError(), addRcaEvidence(), addRcaFactor() (+31 more)

### Community 111 - "ADR 0050"
Cohesion: 0.09
Nodes (22): 1.1 The triage worksheet (one per event), 1.2 Reach & harm spectrum — `ReachId` (ordered, escalating), 1.3 Harm severity — `HarmId` (NCC MERP / JC tiers), 1.4 Sentinel designated categories (JC "always review"), 1.5 Not-a-PSE closure reasons — `ReasonId`, 1.6 Reporting committees (intake sources), 1.7 Intake event, 1.8 Seed events (de-identified reference) (+14 more)

### Community 115 - "Page"
Cohesion: 0.11
Nodes (20): InterviewerRoleBadge(), ATTACHMENT_KIND_LABEL, ATTACHMENT_KIND_ORDER, INTERVIEW_STATUS_LABEL, INTERVIEW_STATUS_ORDER, INTERVIEW_STATUS_STYLE, INTERVIEWER_ROLE_LABEL, INTERVIEWER_ROLE_ORDER (+12 more)

### Community 116 - "Audit feed"
Cohesion: 0.20
Nodes (18): AuditFeed(), AuditRow(), actionLabel(), AuditLabelMap, DATE_TIME, displayValue(), entityLabel(), formatAbsolute() (+10 more)

### Community 117 - "Browser"
Cohesion: 0.09
Nodes (27): HospitalIndicatorScorecard(), IndicatorsPanelAsync(), IndicatorsPanel(), RunChart, RunChartLoader(), DerivedConfig, DerivedDenominatorRef, DerivedNumeratorRef (+19 more)

### Community 120 - "AdminAuditPage"
Cohesion: 0.17
Nodes (12): 1. Executive Summary, 2.1 A referral does not transfer case ownership, 2.2 A referral has one source and one target committee, 2.3 Shared information must be explicit, 2.4 Shared messages and internal notes are different security domains, 2.5 A response is not the same as resolution, 2.6 Important records are append-only, 2. Core Domain Principles (+4 more)

### Community 121 - "Page"
Cohesion: 0.05
Nodes (61): ADR-0025, MeetingDetailPage(), metadata, TitleBadge(), ADR-0051, AgendaItemForm(), AgendaPanel(), AttendeeForm() (+53 more)

### Community 122 - "Page"
Cohesion: 0.18
Nodes (11): 19.10 Copying PHI into notification payloads, 19.1 Storing the conversation as JSONB, 19.2 Automatically granting target committee access to the entire case, 19.3 Combining shared messages and internal notes, 19.4 One referral with multiple target committees, 19.5 Resolving automatically when a response is sent, 19.6 Using assignments as permissions, 19.7 Hard-deleting communication (+3 more)

### Community 123 - "BlockConditionNote"
Cohesion: 0.07
Nodes (24): ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target, Consequences, Context, Decision, 0. What you're pointing at, 1.1 Push pending migrations, 1.2 Verify asymmetric JWT signing keys (known gap — ADR 0009), 1.3 Register the custom access-token hook (+16 more)

### Community 124 - "ConfirmDeleteButton"
Cohesion: 0.09
Nodes (23): InterviewFormDialog(), ConfirmDeleteButton(), toDateTimeLocalValue(), HeldWindowFields(), isFuture(), localToIso(), ADR-0062, useHeldWindowState() (+15 more)

### Community 125 - "Format"
Cohesion: 0.18
Nodes (5): openAccessDialog(), signInAs(), signOut(), ADR-0033, ADR-0050

### Community 127 - "ADR 0028"
Cohesion: 0.24
Nodes (9): ADR-0028, AuditIntegrityCheck(), ADR-0051, ADR-0051, verifyAuditChainAction(), VerifyChainState, AUDIT_MESSAGES, AuditChainResult (+1 more)

### Community 129 - "Corrective Action (PDCA tracked)"
Cohesion: 0.10
Nodes (20): 10. Component inventory, 11. Acceptance checklist, 1.1 Fishbone categories (clinical Ishikawa — the six ribs), 1.2 Root-cause classification, 1.3 PDCA stages (the wheel), 1.4 Seed data (de-identified reference — case "MM-2026-0142"), 1.5 Derived values (single source of truth), 1. Data model (single shared analysis object) (+12 more)

### Community 135 - "Scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:link, db:push, db:reset:linked, dev, e2e, e2e:prod (+10 more)

### Community 136 - "Form builder condition engine enhancements"
Cohesion: 0.15
Nodes (13): 0045 — Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys), Alternatives rejected, Consequences, Context, Decision, Delivery, Evaluator parity — the hard invariant (Rule 3), Immutability & RLS (+5 more)

### Community 139 - "Meeting form dialog.test"
Cohesion: 0.20
Nodes (10): 14.1 Target committee inbox, 14.2 Source committee inbox, 14.3 Case referral history, 14.4 Deadlines, 14.5 Message ordering, 14.6 Message timeline, 14.7 Active participation, 14.8 Active assignments (+2 more)

### Community 146 - "Page"
Cohesion: 0.15
Nodes (16): EditIndicatorPage(), metadata, metadata, NewIndicatorPage(), ArchiveIndicatorButton(), CHOICE_TYPES, getDerivedPickerForms(), questionKindOf() (+8 more)

### Community 147 - "Page"
Cohesion: 0.19
Nodes (11): auditRows(), clickAndCapturePopup(), clickExpectingMintFailure(), escapeRegExp(), NOTE: the seeded fixture has NO backing storage bytes (seed.sql's documented, setAttachmentsFlag(), signInAs(), sql() (+3 more)

### Community 148 - "Title badge"
Cohesion: 0.07
Nodes (26): 10. Timeline, 11. Meetings, 12. Decisions, 13. Action Items, 14.4 Recommended RLS Logic, 14. Access Control and Confidentiality, 15. Audit Logging, 16. Morbidity & Mortality Extension Tables (+18 more)

### Community 149 - "Options editor"
Cohesion: 0.20
Nodes (10): 1. The core difference in one paragraph, 2. Feature-by-feature comparison, 3. ESSENTIAL — adopt now (closes the tested back-and-forth gap), 4. DEFER — valuable, sequence after the dialogue loop, 5. AVOID — do not adopt as specified, 6. Protect these when adopting (what the external model lacks — don't regress), 7. Adoption constraints (non-negotiable) + next step, E1. A shared message thread (`referral_messages`) (+2 more)

### Community 150 - "Titles"
Cohesion: 0.25
Nodes (7): Findings, MAJOR, MINOR (cheap — clear before Record per standing preference), Non-issues verified (called out to show they were checked), QA Review — Ad-hoc Narratives (add a narrative to an OPEN case), Re-review checklist for the fix loop, Summary of the audit

### Community 151 - "Architecture Rules (binding)"
Cohesion: 0.05
Nodes (45): ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14), Consequences, Context, Decision, ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a), Alternatives considered, Consequences, Context (+37 more)

### Community 156 - "ADR 0048 — User Registration & Identity"
Cohesion: 1.00
Nodes (3): /auth/confirm Server-Side Handler (verifyOtp token_hash + type), Invite Email Template (pt-BR), Password-Recovery Email Template (pt-BR)

### Community 157 - "Page"
Cohesion: 0.24
Nodes (5): enterWizard(), insertOptionsWithOther(), signInAs(), slug(), svcInsert()

### Community 158 - "Page"
Cohesion: 0.19
Nodes (10): buildCards(), CommissionHomePage(), formatNextMeeting(), metadata, OverviewCardData, StatCount(), getMemberOverview(), MemberOverview (+2 more)

### Community 159 - "OrgAuditPage"
Cohesion: 0.25
Nodes (8): ADR 0016 — SECURITY DEFINER read path for staff_admin sign-off, Consequences, Context, Decision, Known v1 limitation: no answer-lock between sign-off and submission, Queue predicate: also require submit-readiness, RLS policy fix surfaced this phase (signoffs_insert / signoffs_select), The write path stays under RLS

### Community 164 - "Action Items Data Model Handoff"
Cohesion: 0.14
Nodes (14): 0065 — Pre-Pilot Foundations conventions (polymorphism · identity · Rule-12 taxonomy · freeze), 1. Three sanctioned polymorphism dialects (closes D12), 2. Identity/subject convention, 3. One Rule-12 sensitivity taxonomy (drafted here, applied per-phase), 4. Disposal composition order, 5. Catalog-table vs CHECK-enum convention, 6. Freeze principle, 7. Reference → participants bridge (+6 more)

### Community 170 - "Rca window form"
Cohesion: 0.08
Nodes (24): Accepted Follow-ups (non-blocking; record at §6 Record step), ADR, `app.app_secrets` lock-down, Code Quality, DEFINER door grants / re-gating, Derivation trigger correctness, Disposal correctness, Hygiene (+16 more)

### Community 177 - "ADR 0013 — form versions INSERT RLS Fix"
Cohesion: 0.10
Nodes (20): ADR 0013 — form_versions INSERT RLS fix, Builder mutation authorization (server-side re-check), Checklist Summary, Code Quality Audit, Detailed Findings, Hygiene Audit, MAJOR-1 — No keyboard-only E2E flow in Phase 4 specs, Markdown / XSS surface (Architecture Rule 7) (+12 more)

### Community 178 - "Page"
Cohesion: 0.08
Nodes (24): 1. Requirements Coverage, 2.1 RLS on `phase_results` — SOUND, 2.2 RLS on `case_phase_offered_results` — SOUND, 2.3 SECURITY DEFINER RPCs — SOUND, 2.4 `app.in_case_rpc` GUC Usage — SOUND, 2.5 HC057/HC058/HC060 Error Code Mapping — SOUND, 2.6 Rule 5 (Immutability) — SOUND, 2.7 Rule 11 (Audit) — SOUND (+16 more)

### Community 179 - "Phase result options"
Cohesion: 0.14
Nodes (15): ConditionRow(), condToRow(), DraftRow, emptyRow(), initialToRows(), isLegacySingle(), nextUid(), RecommendWhenEditor() (+7 more)

### Community 180 - "Document editor"
Cohesion: 0.13
Nodes (14): 1. Purpose, 20. Reminder Rules, 22. Recommended Indexes, 28. Example: Complex Action Item, 2. Core Architectural Decision, 30. Final Architecture Summary, 4. Domain Overview, 5. Entity Relationship Diagram (+6 more)

### Community 198 - "Layout"
Cohesion: 0.29
Nodes (5): ibmPlexMono, ibmPlexSans, ibmPlexSerif, metadata, viewport

### Community 199 - "AttachmentLinkForm"
Cohesion: 0.04
Nodes (35): ADR 0017 — Multi-Phase Cases, Consequences, Context, Decision, Key technical choices & rationale, ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes, Consequences, Context (+27 more)

### Community 208 - "AuditFeed"
Cohesion: 0.22
Nodes (9): 8.1 `draft → submitted`, 8.2 `submitted → accepted`, 8.3 `submitted → declined`, 8.4 `under_review → awaiting_information`, 8.5 `awaiting_information → under_review`, 8.6 `under_review → answered`, 8.7 `answered → resolved`, 8.8 `resolved → under_review` (+1 more)

### Community 209 - "InterviewLifecycleActions"
Cohesion: 0.09
Nodes (22): BLOCKER, Findings (iteration 1 — context; M1/M2a/I1 now resolved per the table above), I1 — `dispose_case_phi` carries a bare `is_admin()` cross-tenant PHI-erasure arm (pre-existing; out of this phase's two-module scope — flagged for the pending scope decision), I2 — `patient_xref_select_pqs` RLS / `can_read_xref_row` are dead for `authenticated` (defense-in-depth only); design §D item 7 is untestable as written, I3 — `is_admin` sweep summary (every live occurrence, classified), Independent verification (probes I ran), INFO, Iteration-2 delta verdict (all resolved at iter-3) (+14 more)

### Community 210 - "Avatar stack"
Cohesion: 0.15
Nodes (22): CaseActionItemForm(), PhaseOption, STATUS_ORDER, ADR-0033, ADR-0033, AddBlockMenu(), DISPLAY_TYPES, INPUT_TYPES (+14 more)

### Community 218 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 219 - "Audit icon"
Cohesion: 0.21
Nodes (18): CaseDocumentDelete(), UploadDialog(), ActionState, ALLOWED_DOC_MIME, authorizeCommission(), commissionOfCase(), createCaseEvent(), deleteCaseDocument() (+10 more)

### Community 220 - "Title assign control"
Cohesion: 0.10
Nodes (21): 1. Executive summary, 2. Must-fix before pilot (the critical set), 3. Permission model — adequacy assessment, 4. Efficiency & performance, 5. Data model & extensibility, 6.1 Collapse the role stack into one audited `memberships` table, 6.2 Introduce a hospital-scoped patient master, 6.3 Metadata-drive the form builder (+13 more)

### Community 222 - "CaseEvent Data Model"
Cohesion: 0.10
Nodes (20): 0073 — Ethics procedure model: admissibility → notice → allegations/findings → hearing → vote → decision → appeal, Consequences, Context, D0 — One generalized engine, ethics as an extension layer (never a fork), D10 — `responses.target_case_participant_id` + assignment-role vocabulary, D11 — SQLSTATE block `HC0F0–HC0F9` (S0 §B) + audit verbs, D12 — E2 owns the `ethics` feature flag, D1 — Admissibility & intake: `ethics_case_details` (1:1) (+12 more)

### Community 226 - "Email Denormalization on Profiles (M9)"
Cohesion: 0.11
Nodes (17): Authorization server-side and commission-scoped, Checklist Summary, Code Quality Audit, Detailed Findings, Hygiene Audit, INFO-1 — AC1 E2E does not assert the "Coordenação" role badge renders, Migration M9 / ADR 0010 (email denormalization), MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` did not revalidate the detail page (+9 more)

### Community 228 - "Package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 229 - "Page"
Cohesion: 0.19
Nodes (14): CaseOutboundReferralsCard(), referralStatusChipClass(), referralTypeChipClass(), ReferralDirectionChip(), ReferralStatusChip(), ReferralTypeChip(), ResponseExpectedChip(), STATUS_ICON (+6 more)

### Community 241 - "Loading"
Cohesion: 0.08
Nodes (23): ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos"), Alternatives rejected, Consequences, Context, Decision, ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry, Alternatives rejected, Consequences (+15 more)

### Community 242 - "Loading"
Cohesion: 0.40
Nodes (4): ADR 0006 — Supabase API key scheme vs. env var naming, Consequences, Context, Decision

### Community 243 - "Loading"
Cohesion: 0.09
Nodes (21): 1. PHI isolation (Rule 12), 2. Access-follows-custody RLS, 3. Custody ledger append-only, 4. PHI `.read` auditing, 5. Audit data-minimization (Rule 11), 6. State machine + DEFINER RPCs + search_path, 7. Client/server boundary (P14a-002), 8. Flag-gating + just-culture (+13 more)

### Community 244 - "Loading"
Cohesion: 0.19
Nodes (11): createFreshCase(), getCaseNarratives(), getCaseRow(), getMandMTemplateId(), getNarrativeTypes(), NOTE: the display_position ordering has a seed collision (phase2 and Resumo, signInAs(), skipAllOpenPhases() (+3 more)

### Community 245 - "Loading"
Cohesion: 0.19
Nodes (17): AcknowledgeButton(), acknowledgeEvent(), cancelEvent(), disposeEventPhi(), notifySafetyEvent(), revalidateSafety(), setEventPatient(), transferEventCustody() (+9 more)

### Community 246 - "Loading"
Cohesion: 0.16
Nodes (19): metadata, PendingApprovalsPage(), ApprovalDecisionBadge(), ApprovalsPanel(), DocumentStatusChip(), DocumentTypeBadge(), ReviewOverdueChip(), STATUS_CLASSES (+11 more)

### Community 247 - "Loading"
Cohesion: 0.25
Nodes (8): BLOCKER — RESOLVED, Code quality / hygiene, Non-blocking observations (address opportunistically), QA-B-1 — pgTAP `189` disposal keystone (was 2 red; now green) — RESOLVED (`693ea60`), QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`, Requirements coverage — ADR 0052 deliverables, Security / RLS findings, Verdict: **APPROVED** (2026-07-03; was CHANGES REQUESTED, cleared same day)

### Community 248 - "Loading"
Cohesion: 0.22
Nodes (9): ADR-0066, caseIdFromUrl(), openProcesslessDialog(), patientIdentifiersForCase(), NOTE: this is the regression coverage for BUG-PL-001 — "Próximo" currently, NOTE: also blocked by BUG-PL-001 — reaching step 2 to press "Criar caso", NOTE: the step-2 assertion is also the keyboard regression for BUG-PL-001 —, restGet() (+1 more)

### Community 249 - "Loading"
Cohesion: 0.25
Nodes (8): INFO (no action required), MINOR, MINOR-1 — `getMeetingAttachmentDownloadUrl` is dead, tier-unaware, and contradicts the door model, MINOR-2 — the deliberate interview-arm case-scoping is asserted by no test in the regime where it bites, MINOR-3 — pgTAP K2 exercises only the `committee` action-item scope, Phase F2 — Centralized Attachments (ADR 0063) — QA Review, Verdict rationale, What I verified (held up)

### Community 250 - "Loading"
Cohesion: 0.29
Nodes (7): 29.1 Do Not Store Everything in JSONB, 29.2 Do Not Store `overdue` Directly, 29.3 Do Not Delete Records Hardly by Default, 29.4 Use Database Functions for Critical Transitions, 29.5 Keep the UI Progressive, 29.6 Treat Action Items as Audit-Relevant Records, 29. Important Implementation Guidance

### Community 251 - "Loading"
Cohesion: 0.29
Nodes (7): 3.1 Simple Action Items Must Stay Simple, 3.2 Complex Action Items Must Be Supported Without Rebuilding the Schema, 3.3 Auditability Is Mandatory, 3.4 `Overdue` Should Be Derived, Not Stored, 3.5 Current State and History Are Different Things, 3.6 Assignments Are Not the Same as Ownership, 3. Design Principles

### Community 252 - "Loading"
Cohesion: 0.10
Nodes (20): 10. Recommended V1.5 / V2 Tables, 12. Compact ER Diagram, 13. Bottom-Line Recommendation, 1. Architectural Overview, 2. Recommended Schemas, 5. Multiple-Choice Answer Storage, 6. Repeating Group Answer Storage, 7.1 Form Definition Relationships (+12 more)

### Community 253 - "Loading"
Cohesion: 0.10
Nodes (20): 1. Requirements coverage, 2. Security / RLS, 3. Code quality, 4. XSS / Rule 7, 5. pt-BR and a11y, 6. No patient data / §1 compliance, 7. Hygiene, Audit Details (+12 more)

### Community 254 - "Loading"
Cohesion: 0.26
Nodes (18): archiveIndicator(), computeDerivedMeasurement(), createIndicator(), KNOWN_PT_BR_HC084, mapIndicatorError(), MESSAGES, openCapaFromIndicator(), parseDate() (+10 more)

### Community 255 - "Loading"
Cohesion: 0.20
Nodes (10): Coupled-group execution order (migrations `20260719000300…`, after D3=`…0000` / D10=`…0200`), Execution rules (the failure mode is a missed literal), Execution status (backend, 2026-07-12), F-cleanup D11 — anglicize Portuguese status-enum internal keys (FULL, 12 enums), FRONTEND / TESTER work list (per enum) — derive authoritatively, then hand off, Locked translation dictionary — ✅ CONFIRMED (backend, 2026-07-12), Open confirmations before G1, PROVEN METHOD (use for G3–G6 — each step earned by a G1/G2 failure) (+2 more)

### Community 256 - "Loading"
Cohesion: 0.33
Nodes (6): 18. Custom Fields, Example Field Value, Example Select Field Config, Field Definition Table, Field Value Table, Responsibility

### Community 257 - "Loading"
Cohesion: 0.33
Nodes (6): 7. Status Model, Example Mapping, Normalized Status Categories, Responsibility, Suggested Schema, Why Not Use a Fixed Enum?

### Community 258 - "Loading"
Cohesion: 0.31
Nodes (6): DashboardPage(), metadata, TagReportCardAsync(), TagReportCard(), getCaseTagReport(), listDashboardForms()

### Community 259 - "Loading"
Cohesion: 0.19
Nodes (13): IndicatorsPage(), metadata, formatTarget(), IndicatorKindBadge(), MeasurementStatusChip(), STATUS_STYLES, IndicatorList(), ChartDataTable() (+5 more)

### Community 260 - "Loading"
Cohesion: 0.40
Nodes (5): 19. Templates, Responsibility, Template Checklist Items, Template Follow-Ups, Template Table

### Community 261 - "Loading"
Cohesion: 0.40
Nodes (5): 24. Row-Level Security Considerations, Access Rules to Consider, Example Read Policy, Example Update Policy, Recommended Helper Functions

### Community 262 - "Loading"
Cohesion: 0.40
Nodes (5): 25. MVP Implementation Recommendation, Phase 1: Minimum Useful Action Item System, Phase 2: Follow-Up and Evidence, Phase 3: Advanced Workflow, Phase 4: Customization and Automation

### Community 263 - "Loading"
Cohesion: 0.40
Nodes (5): 9. Assignments: `action_item_assignments`, Enforcing One Active Owner, Responsibility, Suggested Schema, Supported Roles

### Community 274 - "phase17-documents.spec.ts"
Cohesion: 0.20
Nodes (9): Findings, INFO, MAJOR, MINOR, QA Review — Form Builder Enhancements (mini-phase), Re-review checklist — all items RESOLVED, Re-review Summary (2026-06-23), Verdict: APPROVED (+1 more)

### Community 275 - "Deploying to DigitalOcean + Coolify (test environment)"
Cohesion: 0.10
Nodes (18): 2.1 — Auth → URL Configuration, 2.2 — JWT signing keys: migrate to asymmetric (the ADR 0009 "prod-auth gap"), 2.3 — Enable the custom access-token hook (the `is_admin` claim), 2.4 — SMTP + email verification (optional at first), Architecture, Deploying to DigitalOcean + Coolify (test environment), Known risks & gotchas, Local vs remote — the day-to-day workflow (+10 more)

### Community 276 - "Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis"
Cohesion: 0.11
Nodes (19): 1. TL;DR, 2. What our platform already is (the corrected baseline), 3.1 Core case engine, 3.2 Participants & identity — **the core gap**, 3.3 Assignments, forms, meetings, documents, timeline, action items, 3.4 Decisions & the ethics procedure — mostly **Absent**, 3.5 Access, confidentiality, conflicts — **the security-sensitive gap**, 3.6 Committee-specific extension tables (M&M etc.) (+11 more)

### Community 277 - "recommend-result.spec.ts"
Cohesion: 0.16
Nodes (12): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), setManualResult(), signInAs(), slug() (+4 more)

### Community 278 - "Phase 11 — Interviews QA Review"
Cohesion: 0.11
Nodes (16): ADR 0026 — Interviews (case-scoped, participant-write RLS), Consequences, Context, Decision, New SQLSTATEs (continue after HC037; HC021 reused), Deferred follow-up, Lead notes, Phase 11 — Interviews (task detail) (+8 more)

### Community 279 - "Membership Write-Path Lockdown (minimum-viable §6.1)"
Cohesion: 0.11
Nodes (19): 1 · Close direct writes, 2 · Shared self-exclusion helper, 3 · New `assign_org_admin` / `revoke_org_admin`, 4 · Patch existing RPCs, 5 · Blanket audit (H-6), Acceptance criteria, Change set (one migration + tests), Context (+11 more)

### Community 280 - "Phase 2 Re-review — P2-002 auth hot-path fix"
Cohesion: 0.11
Nodes (18): Additional finding during re-review, Checklist Pass / Fail, Detailed Findings, Follow-up note for Phase 8 deploy checklist, INFO-1 — No ADR for the middleware coarse-gate + root Server Component role-landing design, INFO-2 — No ADR for the GSAP dependency addition, MAJOR-1 — Bad-credentials test locates `[role="alert"]` but the error renders as `[role="status"]`, Phase 2 QA Review — Authentication & App Shell (+10 more)

### Community 281 - "indicator-format.tsx"
Cohesion: 0.14
Nodes (14): 1.1 Inert-table RLS: scoped-read + write-inert (Rule 1 · F2 "K9" precedent), 1.2 No new PHI surface (Rule 12), 1.3 Stale-symbol trap closed, 1. Security / RLS — PASS (live-verified), 2.1 Byte-for-byte SQL↔TS mirror for the 4 new ops, 2.2 The ops are non-authorable (live-verified), 2.3 Golden vectors cover operator × value_type, 2. Rule 3 — evaluator parity + non-authorability — PASS (live-verified) (+6 more)

### Community 282 - "markdown-renderer.tsx"
Cohesion: 0.31
Nodes (8): csvField(), GET(), toCsv(), ADR-0020, ADR-0029, RFC-4180, getFormExport(), answerableItems()

### Community 283 - "Answer-Model v2 & Form-Definition Forward-Compatibility"
Cohesion: 0.11
Nodes (18): Answer-Model v2 & Form-Definition Forward-Compatibility, Backend work (owner: `backend`; owns `supabase/**`, `src/lib/{queries,forms,responses,types}`), BE-0 — contracts (post as typed stubs), BE-1 — migration: definition-side (additive), BE-2 — migration: answer-side (the core; **full plan review**), BE-3 — rehydration + write RPCs (keep OUTPUT identical), BE-4 — dashboards / export / clone / publish, BE-5 — types + query layer (+10 more)

### Community 284 - "2. Security / RLS"
Cohesion: 0.11
Nodes (17): 1. Requirements audit (D1–D15, A1–A7), 2.1 New table RLS policies, 2.2 HC030 same-commission guard, 2.3 Status trigger and guard correctness, 2.4 Dropped-helper landmine: CLEAR, 2.5 Phase-7 in_progress-answers invariant, 2.6 Anon/PUBLIC EXECUTE, 2.7 No service-role key in client code (+9 more)

### Community 285 - "QA Review — Phase A: Hospital-admin tier, 4-tier audit & committee titles"
Cohesion: 0.11
Nodes (18): 4-tier audit lockstep (A3) ✅, Audit-integrity KNOWN-GAP adjudication (security focus #5), CLAUDE.md / hygiene compliance, MAJOR-1 — Hospital-tier "Verificar integridade" is disabled in the UI despite the full backend being wired & tested, MAJOR-2 — `removeCommittee` lacks the commission-scope check, permitting a cross-hospital destructive write (same org), MAJOR findings, MINOR-1 — `updateUserProfile` writes a client-supplied `home_hospital_id` unvalidated (amendment-11 hard-set not applied on the update path), MINOR-2 — Stale KNOWN-GAP documentation left in code & PROGRESS (+10 more)

### Community 286 - "referrals-list.tsx"
Cohesion: 0.12
Nodes (17): 3.1 Separate a person from a platform user, 3.2 Separate the logical Interview from Interview Sessions, 3.3 Model participants separately from their roles, 3.4 Store contextual relationships on the Interview association, 3.5 Separate testimony, notes, findings, and summaries, 3.6 Reuse the Forms subsystem for structured questionnaires, 3.7 Reuse the Document subsystem for files, 3.8 Allow Interview permissions to be stricter than Case permissions (+9 more)

### Community 287 - "Decision"
Cohesion: 0.11
Nodes (19): 0064 — Case subject generalization: participants, roles, professional registry & case types, As-built (F1 E0, 2026-07-10), Backend findings, Consequences, Context, Decision, Decision 1 — Full generic participant model (not a one-off satellite), Decision 2 — Professional identity is its **own audited sensitivity class** (+11 more)

### Community 288 - "Uploaded Documents Data Model Handoff"
Cohesion: 0.11
Nodes (17): 1. Executive Summary, 20. Security Groups, 31. Recommended Indexes, 35.1 Recommended workflow, 35.2 Why not activate immediately?, 35. Document Upload Workflow, 38. Integration With Ethics / Physician-Centered Cases, 39. Integration With RCA and Quality Workflows (+9 more)

### Community 289 - "1. Workstreams"
Cohesion: 0.12
Nodes (17): 0. What this covers (and what it doesn't), 1. Workstreams, 2. Sequencing — waves, 3. Migration batching & ownership, 4. Testing strategy, 5. Rollout & gates, 6. Corrections carried from the analysis (so implementers don't re-introduce them), 7. Effort & risk (+9 more)

### Community 290 - "§A — Door / policy / RPC inventory"
Cohesion: 0.12
Nodes (17): §0 — The FOURTH PHI surface (do not miss): `patient_index`, §A.1 Read predicates — rebind PQS term, delete the `is_multi_org` wrapper, §A.2 Write gates / policies (every `is_pqs_writer` site), §A.3 DEFINER doors / RPCs, §A.4 Flag / assert reversions (the point of the phase), §A.5 Numbering, §A.6 Roster curation RPCs (platform-admin+global → coordinator+per-org), §A.7 Storage + patient_index (+9 more)

### Community 291 - "Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail)"
Cohesion: 0.12
Nodes (15): Cross-phase follow-ups (carried, NOT part of Phase 13), Lead notes, Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail), Tasks, Test-isolation saga (gate step 2), 1. Requirements — acceptance criteria, 2. Security review (the crux), 3. Code quality (§8) (+7 more)

### Community 292 - "Checklist Results"
Cohesion: 0.12
Nodes (16): 1. RLS on All Three New Tables, 2. Audit — body_md / title / instructions Exclusion, 3. PHI Posture (Rule 12 / ADR 0030), 4. Freeze-on-Close and Backfill Guard, 5. Advisory-Only Close, 6. Immutability / Regression on CREATE OR REPLACE, 7. display_position Integrity, 8. Conventions (+8 more)

### Community 293 - "NSP-per-org sub-phase B — whole-phase QA Review"
Cohesion: 0.12
Nodes (16): 1. Post-A migration deltas (security-critical) — all correct, 1a. The two additive RLS broadenings (`organizations_select` + `commissions_select`) — VERIFIED minimal + cross-org-denied + non-widening, 1b. The appoint flow + duty separation — airtight, 1c. BUG-NSP-004 / BUG-NSP-005 / the I1 fold-in, 1d. The 7 TS query/action bodies, 2. Sub-phase B FE gating — no PHI reachable by a non-PQS user, 3. A-core isolation STILL holds against the B deltas (re-probed, not just read), 4. Coverage adequacy — adequate + adversarial (+8 more)

### Community 294 - "flagged-aggregate-result.spec.ts"
Cohesion: 0.18
Nodes (10): activate(), createCase(), createResult(), insertOptions(), rpc(), saveAndSubmit(), signInAs(), slug() (+2 more)

### Community 295 - "5. Re-render Optimization"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 296 - "phase7-cases.spec.ts"
Cohesion: 0.14
Nodes (7): ADR-0021, createFreshCaseRemote(), getCasePhasesWithDueDates(), getOwnerTokenRemote(), signInAs(), signOut(), ADR-0018

### Community 297 - "Question Editor Dialog — Layout Refactor Spec"
Cohesion: 0.12
Nodes (15): 0. What must NOT change (preserve exactly), 1. Dialog shell, 2. Two-column body, 3.1 Progressive disclosure of score + code, 3.2 Row layout (CSS grid), 3.3 Colour (COLOR_OPTION_TYPES only), 3.4 Row actions, 3.5 Add (+7 more)

### Community 298 - "3. Design"
Cohesion: 0.12
Nodes (16): 1. Context (why this change), 2. Decisions locked (D1–D14), 3.1 Core `public.attachments`, 3.2 Triggers, 3.3 Dispatchers (schema `app`, DEFINER), 3.4 Storage, 3.5 RPCs (`public`, DEFINER), 3.6 Fold-in rewire (clean forward migration; DROP the three tables) (+8 more)

### Community 299 - "Per-Area Findings"
Cohesion: 0.08
Nodes (23): Bugs caught & fixed during the build (0 escaped to the test gate), Contract-first sequencing, Gate results, Open notes / risks, Phase 10 — Meetings (archived task detail), Summary, Tasks, 1. RLS & Security (+15 more)

### Community 300 - "Checklist Results"
Cohesion: 0.12
Nodes (15): 1. Requirements (Phase 14b–14d Acceptance Criteria), 2. Security / RLS, 3. Code Quality, 4. Audit Trail (Rule 11), 5. UX / Accessibility, 6. Hygiene, BLOCKER-1: `triage_disposition` RPC raises SQLSTATE 42702 at runtime — RESOLVED, BUG-14B-001 Call (+7 more)

### Community 301 - "QA Review — User Registration & Identity Management"
Cohesion: 0.12
Nodes (16): B1 — `profiles_select_self_or_admin`'s shared-commission peer-visibility branch bypasses the `app.is_active()` fold entirely, BLOCKER, Bug Log cross-check, M1 — No test coverage for the explicitly-designed `nsp_coordinator` exclusion from the org directory, M2 — `180_user_registration.sql`'s "SQL status derivation" claim is inaccurate; no such function exists, M3 — Credential/category collisions surface only the generic error, not a field-specific one, M4 — Invite/resend email copy hardcodes "expira em uma hora" outside the config that governs it, MAJOR (+8 more)

### Community 302 - "case-phase-result.spec.ts"
Cohesion: 0.18
Nodes (14): OpenAttachmentButton(), ADR-0063, CaseDocumentsPanel(), AttachmentLinkForm(), AttachmentUpload(), AttachmentsPanel(), ADR-0063, AttachmentUpload() (+6 more)

### Community 303 - "form-model-normalization.spec.ts"
Cohesion: 0.16
Nodes (12): analyticsInput(), createForm(), ensureRowOptionsExpanded(), openAddBlock(), OptRow, publishForm(), purge(), rpcAs() (+4 more)

### Community 304 - "PHASES.md — Hospital Commission Forms Platform"
Cohesion: 0.12
Nodes (16): Accreditation & Quality-Governance Track (Phases 13–21), Phase 0 — Scaffolding & Environment, Phase 10 — Meetings, Phase 11 — Interviews, Phase 12 — Case Timeline, Phase 1 — Database Schema, Auth & RLS, Phase 2 — Authentication & App Shell, Phase 3 — Admin Area & User Management (+8 more)

### Community 305 - "result-actions.ts"
Cohesion: 0.28
Nodes (15): archivePhaseResult(), authorizeCommission(), commissionOfCasePhase(), commissionOfResult(), createPhaseResult(), mapOverrideError(), mapVocabError(), MESSAGES (+7 more)

### Community 306 - "7. JavaScript Performance"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 307 - "Quick Reference"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 308 - "CLAUDE.md — Hospital Commission Forms Platform"
Cohesion: 0.13
Nodes (15): 1. Project Overview, 2. Tech Stack (do not deviate without human approval), 3. Architecture Rules (index), 4. Agent Team, 5. Phased Development Plan, 6. Phase Gate (mandatory, in order), 7. Progress Tracking, 8. Conventions & Quality Bar (+7 more)

### Community 309 - "phase11-interviews.spec.ts"
Cohesion: 0.40
Nodes (4): ADR 0019 — The default (anchor) section may carry a title, Consequences, Context, Decision

### Community 310 - "Decision — the locked design"
Cohesion: 0.13
Nodes (15): 1. Linkage key — deterministic, non-reversible keyed hash, 2. Pepper store — a locked-down secrets TABLE `app.app_secrets` (NOT a GUC, NOT Vault), 3. `patient_xref` — a key-only, QPS-only index, 4. Derivation + xref maintenance — ALWAYS-ON triggers (cover RPC writes AND seed inserts), 5. DEFINER doors (each asserts the flag first line), 6. Referral transmission + receiver hint (additive), 7. Audit routing — GLOBAL chain, key-only metadata, 8. Disposal — retain, mark disposed (referrals cascade-only) (+7 more)

### Community 311 - "Action Items Data Model Handoff"
Cohesion: 0.50
Nodes (4): 10. Related Records: `action_item_related_records`, Example, Responsibility, Suggested Schema

### Community 312 - "README.md"
Cohesion: 0.13
Nodes (14): 1. Tech assumptions, 2. Typography, 3.1 Theme — "Clinical Calm" (the palette used on both screens), 3.3 Review-status accents (stable), 3. Color tokens, 4. Spacing, radii, shape, 6. Shared components, 7. Screen A — Overview (KPI + Table) (+6 more)

### Community 313 - "Action Items Data Model Handoff"
Cohesion: 0.13
Nodes (14): 1. Purpose, 20. Reminder Rules, 21.1 Open Action Items View, 21.2 Action Item Dashboard View, 21. Recommended Dashboard Views, 22. Recommended Indexes, 2. Core Architectural Decision, 30. Final Architecture Summary (+6 more)

### Community 314 - "Why this track exists"
Cohesion: 0.13
Nodes (15): Accreditation & Quality-Governance Track — Phases 13–21, Phase 13 — Audit Trail (Trilha de Auditoria), Phase 14 — Patient-Safety Events, Triage, RCA & CAPA (Eventos de Segurança do Paciente, Triagem, RCA & PDCA/CAPA), Phase 14a — NSP Foundation, Event Intake & Hand-off (req. event detection → notification), Phase 14b — Triage & Disposition (req. acknowledge → safety-event? → reach → harm → sentinel → pathway), Phase 14c — RCA Workspace (req. RCA team & roles · timeline · evidence · findings · fishbone & 5-Whys), Phase 14d — Corrective Action Plan, Effectiveness & Closure (req. actions+strength · tasks+evidence · measures→results · effectiveness · closure), Phase 15 — Quality Indicators (Indicadores de Qualidade) (+7 more)

### Community 315 - "Frontend Audit — External Consultant Review (2026-07-05)"
Cohesion: 0.13
Nodes (14): 10. Wizard `InputItem` re-renders per keystroke — **LOW**, 1. No root or global error boundary — **HIGH**, 2. No streaming anywhere + filters give no pending feedback — **MEDIUM-HIGH**, 3. Sequential-await waterfalls in ~16 pages — **MEDIUM**, 4. `server-only` is a dependency but never imported — **MEDIUM**, 5. Four copies of the same GSAP rise-in wrapper — **MEDIUM-LOW**, 6. Oversized client components — **MEDIUM-LOW**, 7. Raw amber classes bypass the `--warning` token — **LOW** (+6 more)

### Community 316 - "Phase 0 QA Review"
Cohesion: 0.13
Nodes (14): Acceptance Criteria Audit, Client Factories (`src/lib/supabase/`), Code Quality Review, `database.ts`, Findings, INFORMATIONAL — ADR 0001 records a superseded decision, MINOR-1 — `layout.tsx` declares `lang="en"` instead of `lang="pt-BR"`, MINOR-2 — PROGRESS.md "Follow-ups" has a stale open item (+6 more)

### Community 317 - "5 · Itemized findings (non-blocking)"
Cohesion: 0.13
Nodes (15): 1 · Requirements coverage, 2 · Security / RLS (Architecture Rule 1) — the priority, 3 · Rule compliance, 4 · Code quality, 5 · Itemized findings (non-blocking), 6 · What I verified live (summary), INFO-1 — Indicator→CAPA escalation is gated on `patient_safety`, INFO-2 — Derived denominator section resolved from latest published version (+7 more)

### Community 318 - "case-narratives.spec.ts"
Cohesion: 0.12
Nodes (32): ALLOWED_MIME, createAttachment(), DISPOSAL_REASONS, disposeAttachmentPhi(), MESSAGES, OWNER_TYPES, reclassifyAttachment(), softDeleteAttachment() (+24 more)

### Community 319 - "dashboard-charts.tsx"
Cohesion: 0.22
Nodes (9): 4 INFO forward-notes (hand to backend when the FF phases start — NOT this gate), Deferred (post-pilot FF roadmap — each its own ADR + flag + gate), F3 — Flexible-Forms Foundation (ADR 0060) — durable record, Gotchas / notes, Green bar, QA verdict — ✅ APPROVED (0 B / 0 M / 0 m / 4 INFO), Sequencing note, Test verdict (tester) — E2E GREEN, 0 F3 regressions (+1 more)

### Community 320 - "Increment Plan — Case Access Control & "Meus Casos""
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive), 2.2 Predicates / helpers (`app` schema, DEFINER, uid-pure — mirror `can_read_event`), 2.3 RPCs (all gate `case_access`; DEFINER unless noted), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Backend tasks (`backend`) (+6 more)

### Community 321 - "What was verified live (evidence)"
Cohesion: 0.20
Nodes (10): 1. Scope-aware RLS matrix — PASS (the headline result), 2. Guard invariant (Q3/Q4) — PASS, 3. Case-source RPC authority — ADR-0033-D4 **holds** (PASS), 4. Six-consulter expiry (Rule 12 critical) — PASS, 5. Audit (Rule 11) — PASS, 6. Drop completeness — PASS, 7. Frontend (`case-access-panel.tsx`) — PASS, 8. Backend's two beyond-spec decisions — both VALID (PASS) (+2 more)

### Community 322 - "QA Review — answer-model-v2 mini-phase"
Cohesion: 0.14
Nodes (14): Blocking, BUG-AMV2-001 fix: CORRECT ✅, Conclusion, Findings, HC080 default-value validation + BUG-AMV2-002 fix: COHERENT ✅, Immutability (Rule 5): CORRECT ✅, Keystone invariant — evaluator parity (Rule 3): HOLDS ✅, Minor / non-blocking (informational — no change required to approve) (+6 more)

### Community 323 - "Evaluation of the External DB Audit (2026-07)"
Cohesion: 0.14
Nodes (14): 1. Headline verdict, 2. The six Criticals — per-finding verdict, 3. The Highs — per-finding verdict, 4. Mediums / Lows — condensed, 5. Where the audit is wrong or overstated (correct these before acting), 6. Strategic recommendations (§6) & opportunities (§7), 7. Recommended pre-pilot action list (my triage, not the audit's), C-1 · `audit_log` destructible by TRUNCATE — **AGREE, but latent (not reachable via the app)** (+6 more)

### Community 324 - "QA Review — Form data-model normalization"
Cohesion: 0.14
Nodes (13): 1. Requirements audit — PASS (wishlist delivered), 2. Security / RLS — PASS, 3. Evaluator non-drift — PASS (verified byte-for-byte), 4. Code quality — PASS (one MAJOR bug, itemized below), Findings, INFO-1 — Constraint deferrability is a latent footgun, INFO-2 — `dashboard_distributions` / `dashboard_export_rows` remain `SECURITY DEFINER` with an internal `is_staff_admin_of`/`is_admin` gate, MAJOR-1 — ✅ RESOLVED (`e13081f` + `e158e91`, verified 2026-07-01) — Reordering an **existing** choice item's options fails with a duplicate-key error (silent data loss of the reorder) (+5 more)

### Community 325 - "2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite)"
Cohesion: 0.14
Nodes (13): 1. Requirements Audit (per Acceptance Criterion), 2.1 Signer-role rule is byte-equivalent (no broadening of WHO may sign), 2.2 `signoffs_select` exposes metadata only, not answers, 2.3 SECURITY DEFINER hygiene, 2.4 `sign_section` constraint completeness, 2.5 The P6-001 fix did not weaken authz, 2.6 Submission authority & single-sourcing, 2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite) (+5 more)

### Community 326 - "form-builder-enhancements.spec.ts"
Cohesion: 0.19
Nodes (9): getToken(), insertItem(), openAddBlock(), OptionSpec, rpc(), signInAs(), slug(), startFillResponse() (+1 more)

### Community 327 - "page.tsx"
Cohesion: 0.50
Nodes (4): 11. Updates: `action_item_updates`, Example Timeline, Responsibility, Suggested Schema

### Community 328 - "Attachments core — revised schema draft (Phase 14e + ADR 0063)"
Cohesion: 0.15
Nodes (13): 1. Core table `public.attachments`, 2. 🆕 `public.attachment_references` — non-authorizing "also appears here" pointers (ADR-0063 §1), 3. 🆕 `public.attachment_subjects` — descriptive, PHI-safe "what it's about" (ADR-0063 §2), 4. `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), 5.1 Immutability guard ⚙ (clone of `app.guard_case_narrative_frozen`), 5.2 Audit trigger ⚙ (`app.audit_write` + `app.audit_diff` — allow-list excludes PHI columns), 5.3 Dispatchers (schema `app`, DEFINER — CASE to existing domain predicates), 5.4 RPCs (`public`, DEFINER) + feature flag (+5 more)

### Community 329 - "Form Builder Enhancements"
Cohesion: 0.15
Nodes (12): Architecture decisions (decided during research — not user-facing), Backend contract-first signatures (post BEFORE implementing), Builder UI (frontend), Condition engine (backend SQL + shared TS), Context, Data model — migration (backend), Fill UI (frontend), Form Builder Enhancements (+4 more)

### Community 330 - "Answer-Model v2 — machine-switch handoff (2026-07-01)"
Cohesion: 0.15
Nodes (12): 1. Finish the tester gate (spawn `tester`, qa-tester), 2. Triage BUG-AMV2-001 (see PROGRESS.md bug table), 3. QA review (spawn `qa`, qa-reviewer, after tester green), 4. Human approval → 5. Record (lead), Answer-Model v2 — machine-switch handoff (2026-07-01), Confirmed kickoff decisions (human, 2026-07-01) — do not re-litigate, Migrations (forward-only additive on `20260620000000_baseline.sql`; baseline NOT edited), RESUME — do these in order (+4 more)

### Community 331 - "QA Review — Form-Builder Enhancements batch (ad-hoc, out-of-phase)"
Cohesion: 0.15
Nodes (13): BLOCKER — none., Code quality, Findings, INFO / observations (no action required to pass the gate), Keep-vs-simplify: the `use-wizard.ts` `getLatestSnapshot` ref-mirror, MAJOR — none., MINOR — none., QA Review — Form-Builder Enhancements batch (ad-hoc, out-of-phase) (+5 more)

### Community 332 - "Risks / gaps (ordered by severity)"
Cohesion: 0.17
Nodes (12): Backend review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Lower-severity / omissions, R1 — MAJOR: the multi-org PHI guard silently disables the participant-keyed patient door, R2 — MAJOR: tenancy-key mismatch — participants anchor to `organization_id`, but `cases`/`case_patient` anchor to *commission*, R3 — MAJOR: the re-key breaks `patient_index` (ADR 0039, the 4th PHI surface) — unaddressed, R4 — MEDIUM: "N-per-case" collides with the `patient_enabled` snapshot + write-tight invariant, R5 — MEDIUM: integrity gap — nothing prevents a `professional` participant from getting a patient satellite (or vice-versa), R6 — MEDIUM: `can_read_case` recursion risk when participants become a read input (E1), not E0 (+4 more)

### Community 333 - "Findings by focus area"
Cohesion: 0.15
Nodes (13): 1. Authz / RLS on `set_meeting_held_window` — PASS, 2. `SECURITY DEFINER` hygiene — PASS (live-verified), 3. Validation — PASS, 4. Audit (Rule 11) — PASS, 5. Error surfacing (Rule 10 / §8) — PASS, 6. Immutability — PASS, Cross-checks / hygiene, Findings by focus area (+5 more)

### Community 334 - "Detailed Findings"
Cohesion: 0.15
Nodes (12): Checklist Against PHASES.md Phase 1 Acceptance Criteria, Detailed Findings, INFO-1 — `anon` role has full DML grants on all public tables, MAJOR-1 — `commission_members_staff_admin_update` USING clause does not restrict to staff-only rows, MAJOR-2 — `response_section_signoffs` immutability after submission is not tested, MINOR-1 — `app.eval_condition` has no `search_path` set, MINOR-2 — `profiles_admin_all` policy allows admin to DELETE profiles, MINOR-3 — `responses_insert_own` does not validate `form_version_id` matches `commission_id` (+4 more)

### Community 335 - "Audit Trail"
Cohesion: 0.15
Nodes (13): 1. Requirements Coverage, 2. Security / RLS / PHI, 3. Code Quality, 4. Accessibility, 5. Migration hygiene, 6. pgTAP coverage, 7. E2E coverage, Audit Trail (+5 more)

### Community 336 - "6. Rendering Performance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 337 - "0063-centralized-attachments-substrate.md"
Cohesion: 0.22
Nodes (9): 0063 — Centralized attachments substrate: which DMS-handoff seams we adopt, Adopt into the 14e core now — three cheap bolt-ons (no shape change), Adopt into the 14e core now — three shape changes (expensive to retrofit), Consequences, Context, Decision, Reconciliation note — Pre-Pilot Foundations Program (2026-07-10), Reject (with reasons) (+1 more)

### Community 338 - "6.2 Participant Subtype Tables"
Cohesion: 0.17
Nodes (12): 6.2.1 `patient_participants`, 6.2.2 `professional_participants`, 6.2.3 `external_person_participants`, 6.2.4 `department_participants`, 6.2.5 `institution_participants`, 6.2 Participant Subtype Tables, Justification, Justification (+4 more)

### Community 339 - "Plan / Handoff — "Administrativo" delegated-capability role (per commission)"
Cohesion: 0.17
Nodes (12): 10. Suggested task split (contract-first), 1. Context & rationale, 2. Decisions locked in (from the design interview), 3. Governing principle — why this is not "just add a role", 4. Ground-truth object map (verified — do not re-explore), 5. Backend — new migration `supabase/migrations/20260714000000_administrativo_capabilities.sql`, 6. Frontend, 7. Tests (+4 more)

### Community 340 - "Checklist"
Cohesion: 0.17
Nodes (12): 1. Requirements — plan acceptance criteria, 2. Security / RLS (Architecture Rules 1, 9), 3. event-model.ts purity (Architecture Rule 9), 4. Code quality (§8), 5. UX & Accessibility, Checklist, Findings, INFO-1 — ADR 0027 was present pre-review (no action) (+4 more)

### Community 341 - "QA Review — PHI / HIPAA-Readiness Remediation"
Cohesion: 0.17
Nodes (11): Additional Checks, Audit Scope, Open Informational Notes (Non-blocking), QA Review — PHI / HIPAA-Readiness Remediation, Security Model Findings, Verdict: APPROVED, WS A — Structured-Identifier Lockdown, WS B — Audited Free-Text / PHI Classification (+3 more)

### Community 342 - "QA Review — Pre-Pilot DB Hardening, Wave 2 (WS-6 Performance Sweep)"
Cohesion: 0.18
Nodes (11): 1. The two DEFINER RPCs' gate parity (the point of this review) — VERIFIED LIVE, 2. P2 INVOKER + RLS — VERIFIED LIVE, 3. `get_feature_flags()` DEFINER — reviewed, no PHI/per-tenant exposure, 4. Cursor safety — MAJOR finding (bounded blast radius, not a BLOCKER), 5. Rule compliance, 6. Grants / new-column trap, 7. Other observations (INFO, non-blocking), 8. Test-pass corroboration (+3 more)

### Community 343 - "case-access.spec.ts"
Cohesion: 0.20
Nodes (10): INFO (no action required), MAJOR, MAJOR-1 — Seven new non-PHI tables have RLS SELECT policies but no `GRANT` to `authenticated` (Rule 1: inert boundary), MINOR, MINOR-1 — `case_participants_write` (and the catalog `_admin_write` policies) are dead until their write grants land, MINOR-2 — `set_case_patient` compat resolver silently depends on an identifiers row existing, Original review (CHANGES REQUESTED, 2026-07-10), Phase F1 — Case-Participants E0 — QA Review (+2 more)

### Community 344 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 345 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.12
Nodes (17): 0072 — Ethics access spine: confidentiality, respondent-exclusion, recusal/COI & the m2 gate release, 7. M2 posture — professional-identity erasure vs CFM-1821/2007 retention (RECOMMENDATION for human sign-off), Consequences, Context, D10 — Release the m2 gate LAST: `case_participants` + `case_types` ON, D1 — One confidentiality taxonomy: `cases.confidentiality_level`, snapshot at create (X-δ), D2 — `can_read_case` gains four terms, **all computed inside the DEFINER over base tables** (R6), D3 — `can_write_case_content` also honours recusal + respondent-exclusion (+9 more)

### Community 346 - "0027-case-timeline.md"
Cohesion: 0.14
Nodes (14): 0. Why, 1. Three-bucket disposition (summary — full rationale in ADR 0070 / the handoff), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Lifecycle state machine (the load-bearing contract), 5. Deferred (E1) & Avoided — recorded for builders, 6. Risks & open items, I0 — Design & contract gate  *(design; no migration)* (+6 more)

### Community 347 - "Decision"
Cohesion: 0.18
Nodes (11): 0043 — Result-based phase recommendation (combinable `recommend_when`), Alternatives rejected, Consequences, Context, Contract (`recommend_when`), Decision, Delivery, Evaluation — zero evaluator drift (Architecture Rule 3) (+3 more)

### Community 348 - "30. Type-Specific Extension Tables"
Cohesion: 0.18
Nodes (11): 30.1 Table: `evidence_document_details`, 30.2 Table: `form_document_details`, 30.3 Table: `complaint_document_details`, 30.4 Table: `meeting_document_details`, 30.5 Table: `generated_report_document_details`, 30. Type-Specific Extension Tables, Rationale, Rationale (+3 more)

### Community 349 - "Locked decisions"
Cohesion: 0.18
Nodes (11): Audit — 4-tier hash chain (Phase A), Committee titles (Phase A), Context, Design — hospital_admin, nsp_org_admin, per-hospital NSP & committee titles, hospital_admin (Phase A), Locked decisions, NSP-per-hospital (Phase B — partially supersedes ADR 0042), Open items folded in / adjacent (+3 more)

### Community 350 - "NSP-per-hospital — Backend security-core spec (Phase B, backend core)"
Cohesion: 0.18
Nodes (11): Backend plan-first deliverable (A0), §C — Seed (`supabase/seed.sql`), §D — pgTAP (`supabase/tests/`), §N.1 `nsp_org_admin` predicate + PHI-free aggregate doors (decision 13), §N.2 Appointment + roster/config RPCs — three-tier chain (decisions 3, 12, 13), §N.3 `dispose_referral_phi` (decision 5 / ADR 0052 §6), §N — Net-new surfaces (NOT in the per-org inventory), NSP-per-hospital — Backend security-core spec (Phase B, backend core) (+3 more)

### Community 351 - "Focused Analysis — Audit §4 (Efficiency & Performance) and §5 (Data Model & Extensibility)"
Cohesion: 0.18
Nodes (11): 0. Headline, 1. §4 · Efficiency & Performance — per-finding, 2. §5 · Data Model & Extensibility — per-finding, 3. Where §4 / §5 overstate or misattribute (correct before acting), 4. Comparison table — suggestion vs. current platform vs. recommendation, §4 · Efficiency & Performance, §5 · Data Model & Extensibility, 5. Sequenced recommendation (what to actually do, in order) (+3 more)

### Community 352 - "Focus-area findings"
Cohesion: 0.18
Nodes (10): 1. RLS / leak audit of the two RPCs (most important) — PASS, 2. Count 1 correctness (`casesNotConcluded`) — PASS, 3. Flag handling — PASS, 4. Frontend correctness — PASS, 5. Standards (pt-BR, a11y, errors, TS strict) — PASS, Focus-area findings, Hygiene, Non-blocking observations (MINOR / informational — no change required) (+2 more)

### Community 353 - "QA Review — Pre-Pilot DB Hardening, Wave 1"
Cohesion: 0.12
Nodes (14): Gate record, Pre-Pilot DB Hardening — Wave 1 (archived task detail), QA findings (all non-blocking; tracked in PROGRESS Follow-ups), Task detail (W1-T1 … W1-T7 + gate), Dimension 1 — Requirements audit (C-1…C-6 + H-8 closed as scoped?), Dimension 2 — RLS / privilege security, Dimension 3 — PHI (Rule 12) + C-6 narrowed claim, Dimension 4 — Integrity invariants (+6 more)

### Community 354 - "QA Review — "Sem processo" (process-less cases) · flag `processless_cases`"
Cohesion: 0.18
Nodes (11): 1. Security / RLS (highest priority) — PASS, 2. PHI handling (Rule 12) — PASS, 3. Requirements audit vs ADR 0044 — PASS, 4. Code quality — PASS, 5. Accessibility — PASS, 6. pt-BR / English split — PASS, Findings, MINOR-1 — `create_case` action declares an HC029 constant it can never receive (+3 more)

### Community 355 - "Audit findings"
Cohesion: 0.18
Nodes (11): 1. Requirements (ADR 0043 acceptance bullets), 2. Architecture Rule 3 — zero evaluator drift, 3. RLS / Security, 4. Code quality, 5. Test coverage adequacy, 6. Open risk (non-blocking), 7. Informational observations (not blocking), Audit findings (+3 more)

### Community 356 - "QA Review — Option A: Shared (non-PHI) `action_items` table"
Cohesion: 0.18
Nodes (10): Context accepted without re-litigation (per the task brief), Dimension 1 — RLS coverage & correctness (SECURITY) — PASS, Dimension 2 — RPC grants & authority (SECURITY, t19) — PASS, Dimension 3 — Audit (Rule 11) — PASS, Dimension 4 — Data-access discipline (Rule 9) — PASS, Dimension 5 — Requirements audit vs the plan — PASS, Dimension 6 — Best-practice guardrails — PASS, Non-blocking findings (+2 more)

### Community 357 - "React Best Practices"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 358 - "Sections"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 359 - "Frontend Design — "Clinical Calm""
Cohesion: 0.20
Nodes (9): 1. Before you build (checklist), 2. Color — semantic tokens (never raw values), 3. Typography, 4. Spacing, radius, layout, 5. Motion system (shared — do not freelance durations/easings), 6. Accessibility (non-negotiable — CLAUDE.md §8), 7. Content & component conventions, 8. Do / Don't (+1 more)

### Community 360 - "backend-state.md — Living Backend Capability Map"
Cohesion: 0.14
Nodes (14): ADR index (decisions that shape the backend), backend-state.md — Living Backend Capability Map, Data-access & action modules (Rule 9 — no inline supabase-js in UI), F0 — Pre-Pilot Foundations conventions (2026-07-10; ADR 0065, no migration), F1 — Case-Participants E0 (2026-07-10; ADR 0064/0066; migrations `20260716000000`–`…000200`; flags OFF), F2 — Centralized Attachments (2026-07-11; ADR 0063/0065, formerly phase-14e; migrations `20260717000000`–`…000500`; flag `attachments` OFF), F3 — Flexible-Forms Foundation (2026-07-11; ADR 0060/0065; migrations `20260718000000`–`…000200`; NO flag, structural), Feature flags (`app.feature_flags`) (+6 more)

### Community 361 - "0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)"
Cohesion: 0.18
Nodes (11): 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones), 1. Disposition of all 45 gaps, 2. The pre-pilot phase (`flexible-forms`, structural, no feature flag), 3. Deferred UX roadmap (post-pilot, each its own gated, feature-flagged phase), 4. Cross-cutting design invariant (Rec A) — `question_key` aggregation for the new field types, Alternatives rejected, Consequences, Context (+3 more)

### Community 362 - "3.2 `forms.form_versions`"
Cohesion: 0.20
Nodes (10): 3.2 `forms.form_versions`, Design Reasoning, Example `behavior_config`, Example `theme_config`, Important Columns, Purpose, Related Types, Relationships (+2 more)

### Community 363 - "QA Review — Form Builder Enhancements (mini-phase)"
Cohesion: 0.33
Nodes (6): 10.1 Referral read access, 10.2 Message insertion, 10.3 Internal notes, 10.4 Documents, 10.5 Linked cases, 10. Row-Level Security Strategy

### Community 364 - "ad-hoc-narratives.spec.ts"
Cohesion: 0.29
Nodes (8): addWithNewType(), createProcesslessCase(), getCaseNarratives(), getCasePhases(), restGet(), serviceHeaders(), signInAs(), ADR-0032

### Community 365 - "administrativo.spec.ts"
Cohesion: 0.22
Nodes (5): createCaseAs(), rpcAs(), signInAs(), signOut(), ADR-0061

### Community 366 - "member-action-items-overview.spec.ts"
Cohesion: 0.22
Nodes (4): signInAs(), signOut(), svcDelete(), teardownFixtures()

### Community 367 - "phase13-audit.spec.ts"
Cohesion: 0.20
Nodes (6): AuditRow, auditRowsFor(), restGet(), signInAs(), ADR-0029, ADR-0075

### Community 368 - "wizard-others-ux.spec.ts"
Cohesion: 0.09
Nodes (23): 0. What already shipped (read before building — do not re-derive), 1. Goal, 2.1 Shared shape across all three tables, 2.2 `action_item_reminders`, 2.3 `action_item_updates`, 2.4 `action_item_checklists`, 2.5 SQLSTATE allocation (block `HC0I0–HC0I9`), 2. AI·sat — the three satellites (and the explicit non-set) (+15 more)

### Community 369 - "PROGRESS.md — Project Status Tracker"
Cohesion: 0.15
Nodes (13): 🏗️ ACTIVE — S1 · Substrate (Pre-Pilot Release Scope Expansion, ADR 0071), Ad-hoc (out-of-phase) — Case "Reuniões" panel · ✅ complete — merged to `main` `fbe215f` (2026-07-12), Bug Log, Completed work (archived to docs/progress/), Current Phase Tasks, Decisions, Follow-ups / Deferred Items, No active phase — F-cleanup ✅ complete (2026-07-12; on branch `f-cleanup`, awaiting human merge) (+5 more)

### Community 370 - "ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors"
Cohesion: 0.22
Nodes (9): ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors, Alternatives rejected, BUG-NSP-004 — the non-event CAPA fallback must be applied to EVERY org-gate, uniformly, Consequences, Context, Decision, Implementation notes (sub-phase A, backend — discovered during build), M3 — "gate-fixed but body-not-scoped" (the second QA fix-loop class) (+1 more)

### Community 371 - "7. Lookup Values and Enums"
Cohesion: 0.22
Nodes (9): 7.1 Document lifecycle status, 7.2 Document version status, 7.3 Confidentiality labels, 7.4 Asset roles, 7.5 Document permissions, 7.6 Principal types, 7.7 Relationship types, 7.8 Access inheritance modes (+1 more)

### Community 372 - "Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)"
Cohesion: 0.33
Nodes (5): ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`, Consequences, Context, Decision, Rationale

### Community 374 - "Phase 10 — Meetings (archived task detail)"
Cohesion: 0.50
Nodes (4): 12. Status History: `action_item_status_history`, Questions This Enables, Responsibility, Suggested Schema

### Community 375 - "Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)"
Cohesion: 0.33
Nodes (6): 5.1 `case_referrals`, Columns, Design rationale, Important constraints, Recommended priority values, Recommended status values

### Community 376 - "Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)"
Cohesion: 0.20
Nodes (9): 1. Tester: finish the 3 E2E-spec fixes (specs only — never app code), 2. Lead: definitive FULL regression (green declaration), 3. QA review → 4. Human approval → 5. §6 Record, DONE + committed, Key facts for resume, Open decision for the human (non-blocking), PENDING — resume here (in order), Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03) (+1 more)

### Community 377 - "Findings"
Cohesion: 0.22
Nodes (8): BLOCKER, Completeness / premature-closure assessment, Findings, INFO, MAJOR, MINOR, QA Review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Requirements & product-owner-decision fidelity

### Community 378 - "Phase 17 — Controlled-Document Lifecycle · QA Review"
Cohesion: 0.29
Nodes (9): ADR-0009, updateSession(), AUTHED_REDIRECT_AWAY, config, isPublicPath(), proxy(), PUBLIC_PATHS, redirectPreservingCookies() (+1 more)

### Community 379 - "case-patient.spec.ts"
Cohesion: 0.20
Nodes (6): auditRowsFor(), restGet(), signInAs(), ADR-0038, ADR-0042, ADR-0064

### Community 380 - "cases-extras.spec.ts"
Cohesion: 0.20
Nodes (4): signInAs(), signOut(), ADR-0033, ADR-0063

### Community 381 - "cases-meetings-minor.spec.ts"
Cohesion: 0.28
Nodes (5): callRPC(), createRealizadaMeeting(), firstMeetingTypeId(), pickAnyDate(), signInAs()

### Community 382 - "patient-index.spec.ts"
Cohesion: 0.20
Nodes (6): auditRowsForAction(), restGet(), signInAs(), ADR-0042, ADR-0052, ADR-0064

### Community 383 - "phase14a-safety-events.spec.ts"
Cohesion: 0.31
Nodes (6): auditRowsFor(), commissionEvents(), pqsInbox(), restGet(), signInAs(), ADR-0042

### Community 384 - "phase22-referrals.spec.ts"
Cohesion: 0.29
Nodes (4): auditRowsFor(), restGet(), signInAs(), ADR-0042

### Community 385 - "phase8-dashboard.spec.ts"
Cohesion: 0.25
Nodes (6): openDashboard(), IMPORTANT: exclude case-phase responses (`case_phase_id=is.null`). The, seedOnlyTo(), signInAs(), ADR-0018, ADR-0020

### Community 386 - "route.ts"
Cohesion: 0.50
Nodes (4): 13. Follow-Ups: `action_item_follow_ups`, Example, Responsibility, Suggested Schema

### Community 387 - "0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values"
Cohesion: 0.50
Nodes (4): 14. Evidence: `action_item_evidence`, Implementation Note, Responsibility, Suggested Schema

### Community 388 - "Decision"
Cohesion: 0.25
Nodes (8): 1 · Complete DB-side PHI disposal in every graph, 2 · `dispose_meeting_minutes(meeting, reason)` — new, standalone, per-meeting, 3 · §6.4 leak, 4 · Storage retained — the NARROWED claim (the load-bearing decision), ADR 0056 — PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained), Consequences, Context, Decision

### Community 389 - "18. Relationships Summary"
Cohesion: 0.25
Nodes (8): 18. Relationships Summary, Core Relationships, Ethics Relationships, Forms Relationships, M&M Relationships, Meetings Relationships, Participant Relationships, Workflow Relationships

### Community 390 - "20. Migration Strategy From Patient-Centered Cases"
Cohesion: 0.25
Nodes (8): 20. Migration Strategy From Patient-Centered Cases, Phase 1 — Introduce the generic case type system, Phase 2 — Rename or wrap patient cases, Phase 3 — Add participant abstraction, Phase 4 — Move patient-specific fields to extension table, Phase 5 — Make form templates case-type aware, Phase 6 — Add ethics extension tables, Phase 7 — Harden RLS before production ethics usage

### Community 391 - "11. Final Design Principles"
Cohesion: 0.25
Nodes (8): 11.1 Use form versions aggressively, 11.2 Use relational structure for queryable concepts, 11.3 Use JSONB selectively, 11.4 Store one answer per question, 11.5 Store snapshots, 11.6 Design for RLS from the beginning, 11.7 Keep workflow outside the form engine, 11. Final Design Principles

### Community 392 - "3.5 `forms.form_blocks`"
Cohesion: 0.25
Nodes (8): 3.5 `forms.form_blocks`, Design Reasoning, Important Columns, Purpose, Relationships, Repeating Group Behavior, Suggested Table, Suggested Types

### Community 393 - "32. RLS Strategy"
Cohesion: 0.25
Nodes (8): 32.1 General rule, 32.2 Helper function, 32.3 RLS for `documents`, 32.4 RLS for `document_sensitive_metadata`, 32.5 RLS for `document_versions`, 32.6 RLS for `file_assets`, 32.7 Important RLS warning, 32. RLS Strategy

### Community 394 - "45. Testing Checklist"
Cohesion: 0.25
Nodes (8): 45.1 Basic access, 45.2 Case-linked document, 45.3 Redacted document, 45.4 Ethics complaint, 45.5 Form upload, 45.6 Expiring access, 45.7 Audit, 45. Testing Checklist

### Community 395 - "4. Core Architectural Decisions"
Cohesion: 0.25
Nodes (8): 4.1 Documents are first-class secured resources, 4.2 Logical document and physical file are separated, 4.3 Domain links and permissions are separated, 4.4 Sensitive metadata is separated from non-PHI metadata, 4.5 OCR text is sensitive data, 4.6 Use explicit access grants for sensitive documents, 4.7 Use materialized effective permissions for RLS, 4. Core Architectural Decisions

### Community 396 - "Handoff — Meeting actual-occurrence time (`held_at` / `held_end`)"
Cohesion: 0.09
Nodes (19): 0062 — Meeting actual-occurrence time (`held_at` / `held_end`), Consequences, Context, Decision, Backend tasks (owner: `backend`), Design decisions (locked — see ADR 0062), Frontend tasks (owner: `frontend`), Gotchas / must-read before building (+11 more)

### Community 397 - "Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07"
Cohesion: 0.33
Nodes (6): 5.3 `referral_participants`, Columns, Constraints, Design rationale, Suggested access levels, Suggested participant roles

### Community 398 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.22
Nodes (9): 1. `repeating_group` — **explode by child `question_key`** (do not collapse), 2. `matrix` — **the cell is the unit; address `(question_key, row_code, col_code)`**, 3. `risk_matrix` — **derived scalar by `question_key` + severity/likelihood distributions**, 4. `reference` — **aggregate on `participant_id`, never the label**, Consequence for the F3 inert tables (built against this note), Cross-cutting invariant (applies to all four types), F3 — `question_key` → aggregation contract for the new field types, Per-type contract (+1 more)

### Community 399 - "Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)"
Cohesion: 0.25
Nodes (6): Backend (`backend`), Follow-ups (non-blocking — see PROGRESS Follow-ups), Frontend (`frontend`), Gate exec (lead, 2026-06-22), Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`), Summary

### Community 400 - "QA Review — "Administrativo" delegated-capability role (ADR 0061)"
Cohesion: 0.10
Nodes (19): 0061 — "Administrativo" delegated-capability role (per commission), Alternatives rejected, Consequences, Context, Decision, Administrativo delegated-capability role — task detail (archived), Backend, Bugs found + fixed (see archived Bug Log) (+11 more)

### Community 401 - "CLAUDE.md optimization — evaluation & change-map"
Cohesion: 0.25
Nodes (7): Binding-rule preservation — verified ✓, Change-map (section by section), CLAUDE.md optimization — evaluation & change-map, How to adopt (two steps, when you're satisfied), Out of scope this pass — recommended follow-ups, TL;DR, What the audit found

### Community 402 - "QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`"
Cohesion: 0.04
Nodes (82): react, TOKEN_COLOR_VAR, TOKEN_STYLES, ColorTokenPicker(), TOKEN_NAME, TOKENS, OutcomeDefDialog(), ResultDefDialog() (+74 more)

### Community 403 - "phase14b-triage.spec.ts"
Cohesion: 0.29
Nodes (5): auditRowsFor(), restGet(), signInAs(), ADR-0042, ADR-0052

### Community 404 - "processless-cases.spec.ts"
Cohesion: 0.50
Nodes (4): 15. Reviews: `action_item_reviews`, Example Workflow, Responsibility, Suggested Schema

### Community 405 - "ui-batch-2026-07.spec.ts"
Cohesion: 0.33
Nodes (6): 5.5 `referral_messages`, Columns, Constraints, Design rationale, Sequence assignment, Suggested message types

### Community 406 - "commission-overview.tsx"
Cohesion: 0.50
Nodes (4): 16. Checklist Items: `action_item_checklist_items`, Example, Responsibility, Suggested Schema

### Community 407 - "interviewers-panel.tsx"
Cohesion: 0.50
Nodes (4): 17. Dependencies: `action_item_dependencies`, Example, Responsibility, Suggested Schema

### Community 408 - "referral-flow-charts.tsx"
Cohesion: 0.50
Nodes (4): 23. Status Transition Handling, Function Responsibilities, Recommended Function, Why RPC Is Preferred

### Community 409 - "rca-header.tsx"
Cohesion: 0.50
Nodes (4): 26. Recommended User Interface Mapping, Action Item Detail Page, Basic Creation Form, Suggested UI Sections

### Community 410 - "1. Eliminating Waterfalls"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 411 - "2. Bundle Size Optimization"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 412 - "29. Important Implementation Guidance"
Cohesion: 0.50
Nodes (4): 6. Core Table: `action_items`, Important Notes, Responsibility, Suggested Schema

### Community 413 - "3. Design Principles"
Cohesion: 0.50
Nodes (4): 8. Urgency Model, Example Urgency Levels, Responsibility, Suggested Schema

### Community 414 - "29. Important Implementation Guidance"
Cohesion: 0.29
Nodes (7): 29.1 Do Not Store Everything in JSONB, 29.2 Do Not Store `overdue` Directly, 29.3 Do Not Delete Records Hardly by Default, 29.4 Use Database Functions for Critical Transitions, 29.5 Keep the UI Progressive, 29.6 Treat Action Items as Audit-Relevant Records, 29. Important Implementation Guidance

### Community 415 - "3. Design Principles"
Cohesion: 0.29
Nodes (7): 3.1 Simple Action Items Must Stay Simple, 3.2 Complex Action Items Must Be Supported Without Rebuilding the Schema, 3.3 Auditability Is Mandatory, 3.4 `Overdue` Should Be Derived, Not Stored, 3.5 Current State and History Are Different Things, 3.6 Assignments Are Not the Same as Ownership, 3. Design Principles

### Community 416 - "5.2 `case_type_terminology`"
Cohesion: 0.29
Nodes (7): 5.2 `case_type_terminology`, Design Justification, Ethics Complaint Case Type, Example Rows, M&M Case Type, Purpose, Suggested Schema

### Community 417 - "3.3 `forms.form_sections`"
Cohesion: 0.29
Nodes (7): 3.3 `forms.form_sections`, Design Reasoning, Example `layout_config`, Important Columns, Purpose, Relationships, Suggested Table

### Community 418 - "3.7 `forms.form_block_validations`"
Cohesion: 0.29
Nodes (7): 3.7 `forms.form_block_validations`, Design Reasoning, Example Config, Example Validation Types, Purpose, Relationships, Suggested Table

### Community 419 - "4.1 `form_responses.form_submissions`"
Cohesion: 0.29
Nodes (7): 4.1 `form_responses.form_submissions`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 420 - "4.2 `form_responses.form_answers`"
Cohesion: 0.29
Nodes (7): 4.2 `form_responses.form_answers`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 421 - "43. Anti-Patterns to Avoid"
Cohesion: 0.29
Nodes (7): 43.1 File URLs in domain tables, 43.2 One giant attachments table, 43.3 Assuming case access equals document access, 43.4 Public buckets with obscure URLs, 43.5 Treating OCR as harmless, 43.6 Storing PHI in filenames or object paths, 43. Anti-Patterns to Avoid

### Community 422 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.25
Nodes (7): BUG-AIF-001 — Linux repro CONFIRMED; root-cause handoff, Prime suspect + next steps, Reproducible harness (rebuild in ~10 min), Residual confound to close FIRST in the new session, Ruled out (prior session + this one — each by experiment), Temp artifacts from this session, The decisive experiment (what settled it)

### Community 423 - "Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)"
Cohesion: 0.43
Nodes (5): free_port(), e2e-prod-gate.sh script, start_server(), stop_server(), wait_gotrue()

### Community 424 - "Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)"
Cohesion: 0.13
Nodes (15): 0. Source anchors (what already exists — E3 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Seed (E3a — backend, `supabase/seed.sql`), 2.3 TS layer (`backend`-owned) — the terminology read (first-ever consumer), 2.4 RLS, 2.5 Terminology-wiring touch-list (frontend, off the frozen §2 contract), 2. E3a canonical contract (BACKEND posts these typed stubs FIRST) (+7 more)

### Community 425 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.29
Nodes (6): Backend rows, Base-branch failure triage (2026-07-08, lead), E2E (scoped pass, NOT a formal gate), Frontend rows, UI/layout fixes batch + base-branch triage — 2026-07-08, UI/layout fixes batch (frontend + backend)

### Community 426 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.22
Nodes (9): Backend (migrations `20260713000000`–`…000400`), Bugs found + fixed (5, all tester-verified; DB-proven each), Deferred / carried, Frontend (F1–F7), Locked decisions (ADR 0057), Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados), QA MINORs (all cleared before Record), Test gate (+1 more)

### Community 428 - "nsp-per-hospital.spec.ts"
Cohesion: 0.33
Nodes (4): bodyText(), expectAccessDenied(), signInAs(), ADR-0052

### Community 429 - "phase14c-rca.spec.ts"
Cohesion: 0.33
Nodes (4): auditRowsFor(), restGet(), signInAs(), ADR-0042

### Community 430 - "phase14d-capa.spec.ts"
Cohesion: 0.33
Nodes (4): auditRowsFor(), restGet(), signInAs(), ADR-0042

### Community 432 - "phase3-admin-members.spec.ts"
Cohesion: 0.50
Nodes (3): IMPORTANT: this test relies on chefe.farm NOT being a member of ccih., registerActiveOrgUser(), signInAs()

### Community 433 - "phi-remediation.spec.ts"
Cohesion: 0.33
Nodes (4): auditRows(), signInAs(), svcGet(), ADR-0042

### Community 434 - "React Best Practices"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 435 - "backend-engineer.md"
Cohesion: 0.33
Nodes (5): Binding rules (see ARCHITECTURE.md for the authoritative form), Process discipline, Scope you must NOT touch, Scope you own, Skills to consult

### Community 436 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.33
Nodes (5): ADR 0002 — Admin claim via custom access token hook, Consequences, Context, Decision, Rationale

### Community 437 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.33
Nodes (5): ADR 0003 — pgTAP for database tests, Consequences, Context, Decision, Rationale

### Community 438 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.26
Nodes (12): DepartmentDefDialog(), ArchiveDepartmentButton(), DepartmentsManager(), useDepartmentAction(), archiveDepartment(), createDepartment(), DepartmentActionState, mapDepartmentError() (+4 more)

### Community 439 - "ADR 0008 — GSAP as the animation dependency"
Cohesion: 0.33
Nodes (5): ADR 0008 — GSAP as the animation dependency, Consequences, Context, Decision, Rationale

### Community 440 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.33
Nodes (5): 0011 — Position reorder via deferrable constraints + SQL swap RPCs, Consequences, Context, Decision, Options considered

### Community 441 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.50
Nodes (4): ADR 0020 — Dashboard-countable responses: case-phase exclusion, Consequences, Context, Decision

### Community 442 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.33
Nodes (5): ADR 0014 — Sanitizing Markdown renderer, Consequences, Context, Decision, Rationale

### Community 443 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.33
Nodes (5): ADR 0022 — Cross-committee case referrals (linked cases), Consequences, Context, Decision, Future shape (when built — not now)

### Community 444 - "ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture"
Cohesion: 0.18
Nodes (11): ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture, Amendment 1 (2026-07-12) — Referrals v2: dialogue + governance expansion (pre-pilot), Consequences, Context, Context, Decision — the 16 locked design decisions, Decision — the three-bucket disposition, Decisions amended (+3 more)

### Community 445 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.18
Nodes (11): 18.1 Permission hierarchy, 18.2 `interview_access_grants`, 18.3 Authorization helper functions, 18.4 Example RLS policies, 18.5 Storage authorization, 18. Access Control, Grant semantics, Interviews (+3 more)

### Community 446 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.27
Nodes (10): AuditMotion(), CaseDetailMotion(), FALLBACK_MS, getMotionDurations(), Gsap, MOTION_EASE, readDurationMs(), RiseInGroup() (+2 more)

### Community 447 - "0050 — Unified (non-PHI) action_items hub"
Cohesion: 0.33
Nodes (5): 0050 — Unified (non-PHI) action_items hub, Alternatives, Consequences, Context, Decision

### Community 448 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.33
Nodes (6): ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke, Consequences, Context, Decision, Residual (accepted; not blocking pre-pilot), Two rejected fixes

### Community 449 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.24
Nodes (13): EditDocumentPage(), metadata, DocumentDetailPage(), ApproverDocumentPage(), metadata, findMyApprovalForVersion(), selectSignableVersion(), selectWorkingDraft() (+5 more)

### Community 450 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.36
Nodes (7): ActionState, CreateActionItemState, createManualActionItem(), mapItemError(), MESSAGES, parseDate(), ADR-0057

### Community 451 - "18. Custom Fields"
Cohesion: 0.33
Nodes (6): 18. Custom Fields, Example Field Value, Example Select Field Config, Field Definition Table, Field Value Table, Responsibility

### Community 452 - "7. Status Model"
Cohesion: 0.33
Nodes (6): 7. Status Model, Example Mapping, Normalized Status Categories, Responsibility, Suggested Schema, Why Not Use a Fixed Enum?

### Community 453 - "10.1 `case_timeline_events`"
Cohesion: 0.33
Nodes (6): 10.1 `case_timeline_events`, Design Justification, Example Ethics Timeline Events, Example M&M Timeline Events, Purpose, Suggested Schema

### Community 454 - "12.1 `case_decisions`"
Cohesion: 0.33
Nodes (6): 12.1 `case_decisions`, Design Justification, Example Ethics Decision Types, Example M&M Decision Types, Purpose, Suggested Schema

### Community 455 - "19.2 Ethics Complaint Against Doctor"
Cohesion: 0.33
Nodes (6): 19.2 Ethics Complaint Against Doctor, Allegations, Base Case, Extension Details, Forms, Participants

### Community 456 - "21. Supabase / PostgreSQL Implementation Notes"
Cohesion: 0.33
Nodes (6): 21.1 Avoid unsafe polymorphic foreign keys, 21.2 Use soft deletes for sensitive entities, 21.3 Use `jsonb` only for metadata, not core relational concepts, 21.4 Use indexes aggressively on access and case navigation, 21.5 Consider rank-based access levels, 21. Supabase / PostgreSQL Implementation Notes

### Community 457 - "2. Core Design Principles"
Cohesion: 0.33
Nodes (6): 2.1 A case is a committee matter, not necessarily a patient case, 2.2 Participants are attached to cases through roles, 2.3 Committee-specific depth belongs in extension tables, 2.4 The form engine should remain shared, 2.5 Permissions must be case-type aware, 2. Core Design Principles

### Community 458 - "5.5 `case_workflow_stages`"
Cohesion: 0.33
Nodes (6): 5.5 `case_workflow_stages`, Design Justification, Example Ethics Stages, Example M&M Stages, Purpose, Suggested Schema

### Community 459 - "6.4 `case_participant_roles`"
Cohesion: 0.33
Nodes (6): 6.4 `case_participant_roles`, Design Justification, Example Ethics Roles, Example M&M Roles, Purpose, Suggested Schema

### Community 460 - "9.1 `case_documents`"
Cohesion: 0.33
Nodes (6): 9.1 `case_documents`, Design Justification, Example Ethics Document Types, Example M&M Document Types, Purpose, Suggested Schema

### Community 461 - "3.10 `forms.form_logic_conditions`"
Cohesion: 0.33
Nodes (6): 3.10 `forms.form_logic_conditions`, Design Reasoning, Purpose, Relationships, Suggested Table, Supported Operators

### Community 462 - "3.11 `forms.form_logic_actions`"
Cohesion: 0.33
Nodes (6): 3.11 `forms.form_logic_actions`, Design Reasoning, Purpose, Relationships, Suggested Table, Supported Actions

### Community 463 - "3.12 `forms.form_calculations`"
Cohesion: 0.33
Nodes (6): 3.12 `forms.form_calculations`, Design Reasoning, Example Expression, Purpose, Relationships, Suggested Table

### Community 464 - "3.13 `forms.form_translations`"
Cohesion: 0.33
Nodes (6): 3.13 `forms.form_translations`, Design Reasoning, Implementation Note, Purpose, Relationships, Suggested Table

### Community 465 - "3. Form Definition Layer"
Cohesion: 0.33
Nodes (6): 3.16 `forms.form_lint_results`, 3. Form Definition Layer, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 466 - "3.1 `forms.form_templates`"
Cohesion: 0.33
Nodes (6): 3.1 `forms.form_templates`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 467 - "3.4 `forms.question_types`"
Cohesion: 0.14
Nodes (14): 0. Source anchors (what already exists — E1 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables), 2.3 RPCs (all: assert flag · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0E·`), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST) (+6 more)

### Community 468 - "3.6 `forms.form_block_options`"
Cohesion: 0.33
Nodes (6): 3.6 `forms.form_block_options`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 469 - "4. Answer Storage Layer"
Cohesion: 0.40
Nodes (5): 4.12 `form_responses.form_submission_draft_snapshots`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 470 - "34. Permission Resolution Algorithm"
Cohesion: 0.33
Nodes (6): 34.1 Input sources, 34.2 Output, 34.3 Expiration, 34.4 Suggested pseudo-code, 34.5 Events that should trigger recomputation, 34. Permission Resolution Algorithm

### Community 471 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.18
Nodes (11): 8.1 `interview_sessions`, 8.2 Optional `interview_session_schedule_history`, 8.3 `interview_session_attendance`, 8. Interview Sessions, Design rationale, Recommended constraints, Rescheduling, Suggested delivery modes (+3 more)

### Community 472 - "Lead notes"
Cohesion: 0.33
Nodes (6): Build detail, Gate + fix-loop summary, Lead notes, NOT in Phase A (→ Phase B), Phase A — Hospital-admin tier, 4-tier audit & committee titles, Task table

### Community 473 - "phase-22.md"
Cohesion: 0.33
Nodes (6): 5.7 `referral_document_links`, Columns, Design rationale, Permission requirement, Suggested access modes, Suggested audiences

### Community 474 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.29
Nodes (7): ADRs, Data-access & action modules, Deferred (carried as a follow-up, not gate-blocking), Migrations, Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail), Tests / Gate, What shipped

### Community 475 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.18
Nodes (8): ADR 0027 — Case Timeline (read-only event aggregation, two layouts), Consequences, Context, Decision, Gate, Lead notes, Phase 12 — Case Timeline (archived task detail), Tasks

### Community 477 - "8. Advanced Patterns"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 478 - "frontend-engineer.md"
Cohesion: 0.40
Nodes (4): How you work, Process discipline, Scope you must NOT touch, Scope you own

### Community 479 - "qa-reviewer.md"
Cohesion: 0.40
Nodes (4): Audit checklist (per phase), Hard boundary, Posture, What you produce

### Community 480 - "qa-tester.md"
Cohesion: 0.40
Nodes (4): Hard boundary, How you work, Reporting, Scope you own

### Community 481 - "ADR 0001 — Scaffolding & toolchain bootstrap"
Cohesion: 0.33
Nodes (5): 0013 — Fix form_versions INSERT RLS self-reference, Consequences, Context, Decision, Options considered

### Community 482 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.14
Nodes (14): 0. Source anchors (what already exists — E2 extends/consumes, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables), 2.3 RPCs (all: `assert ethics flag` · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0F·`), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST) (+6 more)

### Community 483 - "0012 — clone_form_version returns the existing draft (one draft per form)"
Cohesion: 0.09
Nodes (24): NarrativeTypeDialog(), ArchiveNarrativeTypeButton(), NarrativeTypeManager(), ADR-0032, useNarrativeAction(), ArchiveTemplateButton(), NarrativeSlotCard(), ADR-0032 (+16 more)

### Community 484 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.22
Nodes (9): Backend tasks (`backend`), Follow-on refinement — case-access dialog + narrative-card attribution (2026-06-19, frontend-only), Follow-ups (carried to PROGRESS.md), Frontend tasks (`frontend`), Gate (§6), Increment Archive — Case Access Control & "Meus Casos", Refinement: Case-access dialog + narrative-card attribution (frontend-only) — ✅ FE DONE 2026-06-19, Seed personas (Caso 0001 "Óbito UTI leito 7", commission CCIH; password `Test1234!`) (+1 more)

### Community 485 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.40
Nodes (4): ADR 0021 — Due dates for case phases, Consequences, Context, Decision

### Community 486 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.25
Nodes (7): E2E gating on a prod standalone build, Recommendations, References, The batched gate runner — `npm run e2e:prod` (server restart per batch), The recipe (what actually works here), TL;DR, Worked example — the 2026-07-11 run

### Community 487 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.20
Nodes (10): 21.1 Typical Interview lifecycle, 21.2 Recommended transition rules, 21. Lifecycle Model, `completed → closed`, `draft → requested`, `in_progress → awaiting_follow_up`, `in_progress → completed`, `inviting_participants → scheduled` (+2 more)

### Community 488 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.33
Nodes (6): ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module), Consequences, Context, Decision — the 8 locked design decisions, Supersession & amendments, The concrete surface as built (for QA to audit against)

### Community 489 - "21. Recommended Dashboard Views"
Cohesion: 0.40
Nodes (4): ADR 0023 — Configurable per-committee case status, Consequences, Context, Decision

### Community 490 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.11
Nodes (18): 0. Goal & posture, 10. Rollout, 1. Current state (verified 2026-07-13 — the three tables being collapsed), 2.1 Data model — `public.memberships` (dialect-1: column-per-scope + discriminated shape CHECK), 2.2 Predicate family (`app` schema, DEFINER, `search_path`-pinned, owner=postgres), 2.3 Write door (one pair; `SECURITY DEFINER`; the SOLE write path — mirrors WS-1), 2.4 Audit (blanket trigger on `memberships` — WS-1 H-6 carried verbatim), 2.5 TS layer (`backend`-owned — the frozen stubs `frontend` builds against) (+10 more)

### Community 491 - "27. Example: Simple Action Item"
Cohesion: 0.40
Nodes (4): 0012 — clone_form_version returns the existing draft (one draft per form), Consequences, Context, Decision

### Community 492 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.33
Nodes (4): Lead notes, Phase 22 — Inter-Committee Case Referrals (`case_referrals`), Summary, Tasks

### Community 493 - "case-narratives.md"
Cohesion: 0.40
Nodes (4): 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`), Consequences, Context, Decision

### Community 494 - "case-patient.md"
Cohesion: 0.18
Nodes (13): ADR-0033, CaseAccessPanel(), ExpiryPreset, GrantDialog(), isoDaysFromNow(), isoTomorrow(), LevelOption(), ADR-0033 (+5 more)

### Community 495 - "layout-adjustments-2026-07.md"
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive — SUP core, `20260720000000_supersession_core.sql`), 2.2 Predicates / helpers (`app` schema), 2.3 RPC (DEFINER; SQLSTATE `HC0H·`; t19 grant hygiene), 2.4 Data-access + action stubs (`src/lib/**` — posted first), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Aggregation retrofit (LOAD-BEARING — the full-review item), 4. Audit (+6 more)

### Community 496 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 11.1 Submit referral transaction, 11.2 Send message transaction, 11.3 Resolve referral transaction, 11.4 Reopen referral transaction, 11. Domain Services and Transaction Boundaries

### Community 497 - "loading.tsx"
Cohesion: 0.29
Nodes (15): CaseTagsPanel(), ActionState, archiveCaseTag(), assignCaseTag(), authorizeCommission(), commissionOfCase(), commissionOfTag(), createCaseTag() (+7 more)

### Community 498 - "loading.tsx"
Cohesion: 0.13
Nodes (15): 10. Frontend-owned `audit-icon.tsx` touch — ✅ CORRECT / MINIMAL, 1. No direct write path on `memberships` — ✅ VERIFIED (catalog + runtime), 2. Door authority = incumbent verbatim; no privilege widening — ✅ VERIFIED, 3. Shape CHECK exhaustive — ✅ VERIFIED (runtime), 4. Predicate wrappers behavior-preserving; no missed predicate — ✅ VERIFIED, 5. Unified `membership.*` audit; PHI-free; legacy hard-cut — ✅ VERIFIED, 6. ADR 0075 write-path split — ✅ SOUND, 7. CASCADE fix (`20260720000500`) — ✅ VERIFIED (+7 more)

### Community 499 - "19. Templates"
Cohesion: 0.40
Nodes (5): 19. Templates, Responsibility, Template Checklist Items, Template Follow-Ups, Template Table

### Community 500 - "24. Row-Level Security Considerations"
Cohesion: 0.40
Nodes (5): 24. Row-Level Security Considerations, Access Rules to Consider, Example Read Policy, Example Update Policy, Recommended Helper Functions

### Community 501 - "25. MVP Implementation Recommendation"
Cohesion: 0.40
Nodes (5): 25. MVP Implementation Recommendation, Phase 1: Minimum Useful Action Item System, Phase 2: Follow-Up and Evidence, Phase 3: Advanced Workflow, Phase 4: Customization and Automation

### Community 502 - "9. Assignments: `action_item_assignments`"
Cohesion: 0.40
Nodes (5): 9. Assignments: `action_item_assignments`, Enforcing One Active Owner, Responsibility, Suggested Schema, Supported Roles

### Community 503 - "13.1 Recommended additions to `action_items`"
Cohesion: 0.40
Nodes (5): 13.1 Recommended additions to `action_items`, Design Justification, Example Ethics Action Items, Example M&M Action Items, Suggested Core Schema

### Community 504 - "15.1 `audit_events`"
Cohesion: 0.40
Nodes (5): 15.1 `audit_events`, Design Justification, Events to Log, Purpose, Suggested Schema

### Community 505 - "17.2 `ethics_case_allegations`"
Cohesion: 0.40
Nodes (5): 17.2 `ethics_case_allegations`, Design Justification, Example Allegation Categories, Purpose, Suggested Schema

### Community 506 - "17.4 `ethics_decision_details`"
Cohesion: 0.40
Nodes (5): 17.4 `ethics_decision_details`, Design Justification, Example Sanction Types, Purpose, Suggested Schema

### Community 507 - "19.1 M&M Patient Case"
Cohesion: 0.40
Nodes (5): 19.1 M&M Patient Case, Base Case, Extension Details, Forms, Participants

### Community 508 - "5.1 `case_types`"
Cohesion: 0.40
Nodes (5): 5.1 `case_types`, Design Justification, Important Columns, Purpose, Suggested Schema

### Community 509 - "5.3 `committee_cases`"
Cohesion: 0.40
Nodes (5): 5.3 `committee_cases`, Design Justification, Important Columns, Purpose, Suggested Schema

### Community 510 - "6.5 `case_participants`"
Cohesion: 0.40
Nodes (5): 6.5 `case_participants`, Design Justification, Purpose, Recommended Partial Index, Suggested Schema

### Community 511 - "8.2 Recommended additions to `form_responses`"
Cohesion: 0.40
Nodes (5): 8.2 Recommended additions to `form_responses`, Design Justification, Example Uses, Purpose, Suggested Columns to Add

### Community 512 - "3.14 `forms.block_library_items`"
Cohesion: 0.19
Nodes (13): IndicatorDetailPage(), metadata, CapaAffordance(), isPqsOperatorOfIndicatorHospital(), ADR-0057, DATA_SOURCE_LABELS, INDICATOR_DIRECTION_LABELS, INDICATOR_FREQUENCY_LABELS (+5 more)

### Community 513 - "3.15 `forms.block_library_options`"
Cohesion: 0.40
Nodes (5): 3.15 `forms.block_library_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 514 - "3.17 `forms.form_matrix_rows`"
Cohesion: 0.40
Nodes (5): 3.17 `forms.form_matrix_rows`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 515 - "3.18 `forms.form_matrix_columns`"
Cohesion: 0.40
Nodes (5): 3.18 `forms.form_matrix_columns`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 516 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.40
Nodes (5): 3.8 `forms.form_block_default_values`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 517 - "3.9 `forms.form_logic_rules`"
Cohesion: 0.40
Nodes (5): 3.9 `forms.form_logic_rules`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 518 - "4.10 `form_responses.form_answer_revisions`"
Cohesion: 0.17
Nodes (8): createForm(), enterWizardByTitle(), openAddBlock(), publishForm(), purge(), signInAs(), sql(), ADR-0045

### Community 519 - "4.11 `form_responses.form_submission_section_states`"
Cohesion: 0.40
Nodes (5): 4.11 `form_responses.form_submission_section_states`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 520 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.40
Nodes (5): 4.3 `form_responses.form_answer_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 521 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.20
Nodes (10): CommissionReferralsPage(), metadata, ReferralsHubSections(), SortDir, SortHeader(), SortKey, STATUS_FILTER_ORDER, STATUS_RANK (+2 more)

### Community 522 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.40
Nodes (5): 4.5 `form_responses.form_answer_files`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 523 - "4.6 `form_responses.form_answer_signatures`"
Cohesion: 0.40
Nodes (5): 4.6 `form_responses.form_answer_signatures`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 524 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.40
Nodes (5): 4.7 `form_responses.form_answer_matrix_cells`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 525 - "4.8 `form_responses.form_answer_risk_matrix`"
Cohesion: 0.40
Nodes (5): 4.8 `form_responses.form_answer_risk_matrix`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 526 - "4.9 `form_responses.form_answer_references`"
Cohesion: 0.40
Nodes (4): Batch context, Gate outcome (§6), Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA, Tasks

### Community 527 - "10. Table: `documents`"
Cohesion: 0.40
Nodes (5): 10. Table: `documents`, DDL, Delayed foreign key for `current_version_id`, Design rationale, Purpose

### Community 528 - "14. Table: `document_version_assets`"
Cohesion: 0.40
Nodes (5): 14. Table: `document_version_assets`, DDL, Design rationale, Optional uniqueness rule, Purpose

### Community 529 - "40. Example Scenarios"
Cohesion: 0.40
Nodes (5): 40.1 M&M evidence document, 40.2 Form attachment, 40.3 Ethics complaint document, 40.4 Institutional policy document, 40. Example Scenarios

### Community 530 - "8. Table: `app_resources`"
Cohesion: 0.40
Nodes (5): 8. Table: `app_resources`, DDL, Design rationale, Important notes, Purpose

### Community 531 - "9. Table: `document_kinds`"
Cohesion: 0.40
Nodes (5): 9. Table: `document_kinds`, DDL, Design rationale, Example rows, Purpose

### Community 533 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.20
Nodes (10): 6.1 `interviews`, 6. Core Interview Aggregate, Recommended invariants, Status semantics, Suggested confidentiality values, Suggested Interview categories, Suggested priority values, Suggested recording policies (+2 more)

### Community 535 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.18
Nodes (11): AppSidebar(), CountKey, NAV_GROUPS, NavGroup, NavItem, SidebarCounts, ADR-0033, CommissionSwitcher() (+3 more)

### Community 537 - "Prefer Statically Analyzable Paths"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 539 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 17. Suggested Repository and Service Boundaries, Application layer, Domain layer, Infrastructure layer, Presentation layer

### Community 540 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.31
Nodes (6): TitleDefDialog(), DeleteTitleButton(), TitlesManager(), ADR-0051, ADR-0051, useTitleAction()

### Community 541 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.50
Nodes (4): 5.10 `referral_status_events`, Columns, Design rationale, Suggested event types

### Community 542 - "Phase 8 — Dashboards & Submissions Browser (archived task detail)"
Cohesion: 0.50
Nodes (4): 5.12 `referral_read_receipts`, Columns, Design rationale, Primary key

### Community 543 - "loading.tsx"
Cohesion: 0.06
Nodes (47): ADR-0002, CommissionLayout(), ADR-0033, metadata, SignoffQueuePage(), ADR-0061, DocumentsLayout(), IndicatorsLayout() (+39 more)

### Community 544 - "loading.tsx"
Cohesion: 0.24
Nodes (7): FormsListPage(), metadata, DiscardDraftButton(), FillableFormCard(), StartFillButton(), FillableForm, listFillableForms()

### Community 545 - "21. Recommended Dashboard Views"
Cohesion: 0.22
Nodes (9): 26. API and Service-Layer Boundaries, Design rationale, `InterviewAccessService`, `InterviewConsentService`, `InterviewContentService`, `InterviewParticipantService`, `InterviewService`, `InterviewSessionService` (+1 more)

### Community 546 - "27. Example: Simple Action Item"
Cohesion: 0.50
Nodes (4): 5.9 `referral_case_links`, Columns, Design rationale, Suggested relationship types

### Community 547 - "21. Recommended Dashboard Views"
Cohesion: 0.40
Nodes (4): ADR 0001 — Scaffolding & toolchain bootstrap, Consequences, Context, Decisions

### Community 548 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 0074 — Supersession correction model (contract + UX finalization), 1. Schema — one nullable self-FK + two integrity constraints, 2. RPC — `supersede_response(p_response_id, p_reason)` — standalone-only, DEFINER, 3. Aggregation retrofit — latest-in-chain, at the single choke-point (LOAD-BEARING), 4. Audit — `response.superseded` via the MUTATION emitter (not the read allow-list), 5. Feature flag — `response_correction`, 6. UX — "corrigir envio" affordance + status badges, Consequences (+3 more)

### Community 549 - "loading.tsx"
Cohesion: 0.18
Nodes (7): ALLOW_OTHER_TYPES, BOUNDED_TYPES, FLAGGED_WHEN_OPS, FLAGGED_WHEN_TYPES, MESSAGES, ParseConfigResult, TEXT_LENGTH_TYPES

### Community 550 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 7.1 `interview_participants`, 7.2 `interview_participant_roles`, 7. Interview Participants, Design rationale, Primary interviewee constraint, Recommended uniqueness, Removal behavior, Suggested participation statuses (+1 more)

### Community 551 - "loading.tsx"
Cohesion: 0.23
Nodes (9): CancelButton(), ReopenButton(), RcaTimelinePanel(), VocabDefDialog(), VocabEntry, ArchiveVocabButton(), ManagedVocabEntry, VocabManager() (+1 more)

### Community 552 - "loading.tsx"
Cohesion: 0.12
Nodes (19): NspOrgAdminManager(), personLabel(), ADR-0051, CoordinatorSection(), NspOrgHospitalCuration, personLabel(), RosterSection(), ADR-0052 (+11 more)

### Community 553 - "loading.tsx"
Cohesion: 0.32
Nodes (5): metadata, SubmissionsPage(), CursorPagination(), listSubmissions(), SubmissionFilters

### Community 554 - "loading.tsx"
Cohesion: 0.33
Nodes (6): ADR 0004 — Sign-off enforcement feature flag, Consequences, Context, Decision, Rationale, Update — flag flipped (Phase 6, 2026-06-13)

### Community 555 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 28. Validation Rules, Consent rules, Finding and summary rules, Interview rules, Participant rules, Session rules, Statement rules, Transcript rules

### Community 556 - "loading.tsx"
Cohesion: 0.25
Nodes (8): Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07, Gate bugs found + fixed (all tester-verified), Migrations (6, pushed to remote 2026-07-07), Notes / follow-ups, Test gate result, Test reconciliation (test-side only; app was sound), The 10 tasks (all delivered), Time-field: masked → segmented (human decision 2026-07-07)

### Community 558 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 20.1 `interview_finding_case_issues`, 20.2 `interview_finding_risks`, 20.3 `interview_finding_action_items`, 20.4 `interview_timeline_event_links`, 20.5 `interview_referral_links`, 20. Integration Tables, Design rationale

### Community 559 - "loading.tsx"
Cohesion: 0.33
Nodes (5): Addendum — CASCADE collateral (fixed in 20260720000500), ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split, Consequences, Context, Decision

### Community 560 - "10. Related Records: `action_item_related_records`"
Cohesion: 0.50
Nodes (4): 10. Related Records: `action_item_related_records`, Example, Responsibility, Suggested Schema

### Community 561 - "11. Updates: `action_item_updates`"
Cohesion: 0.50
Nodes (4): 11. Updates: `action_item_updates`, Example Timeline, Responsibility, Suggested Schema

### Community 562 - "12. Status History: `action_item_status_history`"
Cohesion: 0.50
Nodes (4): 12. Status History: `action_item_status_history`, Questions This Enables, Responsibility, Suggested Schema

### Community 563 - "13. Follow-Ups: `action_item_follow_ups`"
Cohesion: 0.50
Nodes (4): 13. Follow-Ups: `action_item_follow_ups`, Example, Responsibility, Suggested Schema

### Community 564 - "14. Evidence: `action_item_evidence`"
Cohesion: 0.50
Nodes (4): 14. Evidence: `action_item_evidence`, Implementation Note, Responsibility, Suggested Schema

### Community 565 - "15. Reviews: `action_item_reviews`"
Cohesion: 0.50
Nodes (4): 15. Reviews: `action_item_reviews`, Example Workflow, Responsibility, Suggested Schema

### Community 566 - "16. Checklist Items: `action_item_checklist_items`"
Cohesion: 0.50
Nodes (4): 16. Checklist Items: `action_item_checklist_items`, Example, Responsibility, Suggested Schema

### Community 567 - "17. Dependencies: `action_item_dependencies`"
Cohesion: 0.50
Nodes (4): 17. Dependencies: `action_item_dependencies`, Example, Responsibility, Suggested Schema

### Community 568 - "23. Status Transition Handling"
Cohesion: 0.50
Nodes (4): 23. Status Transition Handling, Function Responsibilities, Recommended Function, Why RPC Is Preferred

### Community 569 - "26. Recommended User Interface Mapping"
Cohesion: 0.50
Nodes (4): 26. Recommended User Interface Mapping, Action Item Detail Page, Basic Creation Form, Suggested UI Sections

### Community 570 - "6. Core Table: `action_items`"
Cohesion: 0.50
Nodes (4): 6. Core Table: `action_items`, Important Notes, Responsibility, Suggested Schema

### Community 571 - "8. Urgency Model"
Cohesion: 0.50
Nodes (4): 8. Urgency Model, Example Urgency Levels, Responsibility, Suggested Schema

### Community 572 - "11.1 `committee_meetings`"
Cohesion: 0.50
Nodes (4): 11.1 `committee_meetings`, Design Justification, Purpose, Suggested Schema

### Community 573 - "11.2 `meeting_agenda_items`"
Cohesion: 0.50
Nodes (4): 11.2 `meeting_agenda_items`, Design Justification, Purpose, Suggested Schema

### Community 574 - "11.3 `meeting_case_discussions`"
Cohesion: 0.50
Nodes (4): 11.3 `meeting_case_discussions`, Design Justification, Purpose, Suggested Schema

### Community 575 - "11.4 `case_votes`"
Cohesion: 0.50
Nodes (4): 11.4 `case_votes`, Design Justification, Purpose, Suggested Schema

### Community 576 - "14.1 `case_access_grants`"
Cohesion: 0.50
Nodes (4): 14.1 `case_access_grants`, Design Justification, Purpose, Suggested Schema

### Community 577 - "14.2 `case_conflict_declarations`"
Cohesion: 0.50
Nodes (4): 14.2 `case_conflict_declarations`, Design Justification, Purpose, Suggested Schema

### Community 578 - "14.3 `case_recusals`"
Cohesion: 0.50
Nodes (4): 14.3 `case_recusals`, Design Justification, Purpose, Suggested Schema

### Community 579 - "16.1 `mm_case_details`"
Cohesion: 0.50
Nodes (4): 16.1 `mm_case_details`, Design Justification, Purpose, Suggested Schema

### Community 580 - "16.2 `mm_contributing_factors`"
Cohesion: 0.50
Nodes (4): 16.2 `mm_contributing_factors`, Design Justification, Purpose, Suggested Schema

### Community 581 - "16.3 `mm_preventability_assessments`"
Cohesion: 0.50
Nodes (4): 16.3 `mm_preventability_assessments`, Design Justification, Purpose, Suggested Schema

### Community 582 - "17.1 `ethics_case_details`"
Cohesion: 0.50
Nodes (4): 17.1 `ethics_case_details`, Design Justification, Purpose, Suggested Schema

### Community 583 - "17.3 `ethics_case_findings`"
Cohesion: 0.50
Nodes (4): 17.3 `ethics_case_findings`, Design Justification, Purpose, Suggested Schema

### Community 584 - "17.5 `ethics_case_notifications`"
Cohesion: 0.50
Nodes (4): 17.5 `ethics_case_notifications`, Design Justification, Purpose, Suggested Schema

### Community 585 - "17.6 `ethics_hearings`"
Cohesion: 0.50
Nodes (4): 17.6 `ethics_hearings`, Design Justification, Purpose, Suggested Schema

### Community 586 - "17.7 `ethics_appeals`"
Cohesion: 0.50
Nodes (4): 17.7 `ethics_appeals`, Design Justification, Purpose, Suggested Schema

### Community 587 - "26. Suggested Naming Convention"
Cohesion: 0.50
Nodes (4): 26. Suggested Naming Convention, Application Code, Backend / Database, UI

### Community 588 - "5.4 `case_workflow_templates`"
Cohesion: 0.50
Nodes (4): 5.4 `case_workflow_templates`, Design Justification, Purpose, Suggested Schema

### Community 589 - "5.6 `case_status_history`"
Cohesion: 0.50
Nodes (4): 5.6 `case_status_history`, Design Justification, Purpose, Suggested Schema

### Community 590 - "6.1 `participants`"
Cohesion: 0.50
Nodes (4): 6.1 `participants`, Design Justification, Purpose, Suggested Schema

### Community 591 - "6.3 `professional_profiles`"
Cohesion: 0.50
Nodes (4): 6.3 `professional_profiles`, Design Justification, Purpose, Suggested Schema

### Community 592 - "7.1 `case_assignments`"
Cohesion: 0.50
Nodes (4): 7.1 `case_assignments`, Design Justification, Purpose, Suggested Schema

### Community 593 - "8.1 `form_template_case_types`"
Cohesion: 0.50
Nodes (4): 8.1 `form_template_case_types`, Design Justification, Purpose, Suggested Schema

### Community 594 - "9.2 `case_document_access_grants`"
Cohesion: 0.50
Nodes (4): 9.2 `case_document_access_grants`, Design Justification, Purpose, Suggested Schema

### Community 595 - "11. Table: `document_sensitive_metadata`"
Cohesion: 0.50
Nodes (4): 11. Table: `document_sensitive_metadata`, DDL, Design rationale, Purpose

### Community 596 - "12. Table: `document_versions`"
Cohesion: 0.50
Nodes (4): 12. Table: `document_versions`, DDL, Design rationale, Purpose

### Community 597 - "13. Table: `file_assets`"
Cohesion: 0.50
Nodes (4): 13. Table: `file_assets`, DDL, Design rationale, Purpose

### Community 598 - "15. Table: `document_pages`"
Cohesion: 0.50
Nodes (4): 15. Table: `document_pages`, DDL, Design rationale, Purpose

### Community 599 - "16. Table: `document_ocr_extractions`"
Cohesion: 0.50
Nodes (4): 16. Table: `document_ocr_extractions`, DDL, Design rationale, Purpose

### Community 600 - "17. Table: `document_redactions`"
Cohesion: 0.50
Nodes (4): 17. Table: `document_redactions`, DDL, Design rationale, Purpose

### Community 601 - "18. Table: `document_resource_links`"
Cohesion: 0.50
Nodes (4): 18. Table: `document_resource_links`, DDL, Design rationale, Purpose

### Community 602 - "19. Table: `document_subjects`"
Cohesion: 0.50
Nodes (4): 19. Table: `document_subjects`, DDL, Design rationale, Purpose

### Community 603 - "21. Table: `security_groups`"
Cohesion: 0.50
Nodes (4): 21. Table: `security_groups`, DDL, Design rationale, Purpose

### Community 604 - "22. Table: `security_group_members`"
Cohesion: 0.50
Nodes (4): 22. Table: `security_group_members`, DDL, Design rationale, Purpose

### Community 605 - "23. Table: `document_access_grants`"
Cohesion: 0.50
Nodes (4): 23. Table: `document_access_grants`, DDL, Design rationale, Purpose

### Community 606 - "24. Table: `document_effective_permissions`"
Cohesion: 0.50
Nodes (4): 24. Table: `document_effective_permissions`, DDL, Design rationale, Purpose

### Community 607 - "25. Table: `document_access_requests`"
Cohesion: 0.50
Nodes (4): 25. Table: `document_access_requests`, DDL, Design rationale, Purpose

### Community 608 - "26. Table: `document_upload_sessions`"
Cohesion: 0.50
Nodes (4): 26. Table: `document_upload_sessions`, DDL, Design rationale, Purpose

### Community 609 - "27. Table: `document_ingestion_jobs`"
Cohesion: 0.50
Nodes (4): 27. Table: `document_ingestion_jobs`, DDL, Design rationale, Purpose

### Community 610 - "28. Table: `document_access_audit_events`"
Cohesion: 0.50
Nodes (4): 28. Table: `document_access_audit_events`, DDL, Design rationale, Purpose

### Community 611 - "29. Retention and Lifecycle Tables"
Cohesion: 0.50
Nodes (4): 29.1 Table: `document_retention_policies`, 29.2 Table: `document_lifecycle_events`, 29. Retention and Lifecycle Tables, Design rationale

### Community 612 - "2. Design Goals"
Cohesion: 0.50
Nodes (4): 2.1 Functional goals, 2.2 Security goals, 2.3 Product goals, 2. Design Goals

### Community 613 - "33. Storage Strategy"
Cohesion: 0.50
Nodes (4): 33.1 Bucket policy, 33.2 Object path format, 33.3 Signed URL access flow, 33. Storage Strategy

### Community 614 - "36. Integration With Forms"
Cohesion: 0.50
Nodes (4): 36.1 File upload questions, 36.2 Recommended relationships, 36.3 Design rationale, 36. Integration With Forms

### Community 615 - "37. Integration With Cases"
Cohesion: 0.50
Nodes (4): 37.1 Case-linked documents, 37.2 Case access versus document access, 37.3 Design rationale, 37. Integration With Cases

### Community 616 - "42. Minimal Viable Implementation Plan"
Cohesion: 0.50
Nodes (4): 42. Minimal Viable Implementation Plan, Phase 1: Core secure document storage, Phase 2: Scanned document processing, Phase 3: Advanced compliance

### Community 618 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 35. Rejected Simplifications, Case permission automatically grants all Interview content, Every participant must be a user, Interview as a calendar event, One table containing the entire Interview, Store all content in a generic notes table, Store recordings in PostgreSQL

### Community 619 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 3.4 `forms.question_types`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 620 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 5.1 `people`, 5.2 `person_professional_credentials`, 5. Shared Person Model, Design rationale, Recommended constraints, Suggested `person_type` values, User linkage

### Community 621 - "12.2 `interview_transcript_segments`"
Cohesion: 0.33
Nodes (6): 12.1 `interview_transcripts`, 12.2 `interview_transcript_segments`, 12. Transcripts and Recordings, Search implications, Speaker validation, Transcript storage strategy

### Community 622 - "2. Architectural Goals"
Cohesion: 0.33
Nodes (6): 2.1 Support any committee type, 2.2 Support registered and unregistered participants, 2.3 Preserve evidentiary integrity, 2.4 Enforce strict confidentiality, 2.5 Integrate with existing platform modules, 2. Architectural Goals

### Community 623 - "9.2 `interview_form_assignments`"
Cohesion: 0.33
Nodes (6): 9.1 `interview_topics`, 9.2 `interview_form_assignments`, 9. Interview Preparation, Design rationale, Design rationale, Recommended constraints

### Community 624 - "F-cleanup — residual DB-hardening (durable record)"
Cohesion: 0.33
Nodes (6): F-cleanup — residual DB-hardening (durable record), Gate, Process learning — e2e completeness (for future D11-style renames), QA Minor-1 — re-enforced (not deferred), Remaining / deferred, What shipped (8 migrations `20260719000000`–`…000800`)

### Community 704 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.33
Nodes (6): 4.10 `form_responses.form_answer_revisions`, 4. Answer Storage Layer, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 705 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.40
Nodes (5): ADR 0005 — `visible_when` condition shape (v1), Context, Decision, Extension point, Rationale

### Community 706 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.40
Nodes (5): ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume), Consequences, Context, Decision, RLS audit

### Community 707 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.09
Nodes (19): ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org, Consequences, Context, Decision, 0066 — patient_xref case-module grain re-keyed to the patient participant, Consequences, Context, Decision (+11 more)

### Community 708 - "0071 — Pre-pilot release scope expansion"
Cohesion: 0.40
Nodes (5): ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`), Consequences, Context, Decision, Why not the alternatives

### Community 709 - "5.4 `referral_assignments`"
Cohesion: 0.40
Nodes (5): 5.4 `referral_assignments`, Columns, Design rationale, Suggested assignment roles, Suggested assignment statuses

### Community 711 - "10.1 `interview_consents`"
Cohesion: 0.40
Nodes (5): 10.1 `interview_consents`, 10. Consent and Recording Authorization, Recommended constraints, Recording gate, Uniqueness strategy

### Community 712 - "11.1 `interview_notes`"
Cohesion: 0.40
Nodes (5): 11.1 `interview_notes`, 11. Notes, Finalization rule, Visibility rule, Why both author IDs are useful

### Community 713 - "Feature — `case_phase_results` (per-phase categorical result + manual override)"
Cohesion: 0.50
Nodes (4): Backend (`backend`), Feature — `case_phase_results` (per-phase categorical result + manual override), Frontend (`frontend`), Tester (`tester`)

### Community 714 - "17.1 `interview_external_access_links`"
Cohesion: 0.40
Nodes (5): 17.1 `interview_external_access_links`, 17. External Participant Access, One-time link behavior, Recommended constraints, Security requirements

### Community 921 - "25. Recommended Database Triggers and Functions"
Cohesion: 0.40
Nodes (5): 25.1 Tenant consistency trigger, 25.2 Status transition function, 25.3 Finalization functions, 25.4 External token consumption function, 25. Recommended Database Triggers and Functions

### Community 922 - "27. Example: Simple Action Item"
Cohesion: 0.40
Nodes (5): 34.1 Database invariant tests, 34.2 RLS tests, 34.3 Security tests, 34.4 Workflow tests, 34. Testing Strategy

### Community 923 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.40
Nodes (5): ADR 0032 — Case Narratives (per-case prose interleaved with phases), Alternatives rejected, Consequences, Context, Decision

### Community 924 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.40
Nodes (5): Bugs the gate caught + fixed (all pre-commit), F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE, Gate (§6), Open risks / deferred, What shipped

### Community 925 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.40
Nodes (5): ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case), Alternatives rejected, Consequences, Context, Decision

### Community 926 - "hospital-departments.spec.ts"
Cohesion: 0.50
Nodes (4): 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3), Consequences, Context, Decision

### Community 933 - "AuditEntityType"
Cohesion: 0.50
Nodes (4): 0069 — Anglicize status-enum internal keys (D11), Consequences, Context, Decision

### Community 934 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.12
Nodes (17): A. Groundwork findings (verified 2026-07-13, this branch), AI (satellites + cross-link) — authored 2026-07-13, B. SQLSTATE block allocation (ratified — high-water `HC099`), C. Feature-flag plan (ratified), D. Cross-cutting conventions (recorded once — bind every track), E. Collision contracts (locked — per-track reviews are conformance checks, not re-litigation), ETH·E1 (access spine) — authored 2026-07-13 · **M2 posture = the regulatory sign-off keystone**, ETH·E2 (procedure) — authored 2026-07-13 (+9 more)

### Community 935 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.22
Nodes (9): 1. Requirements coverage (spec `docs/phases/accreditation-track.md:427-506`, ADR 0057), 2. Security / RLS review (the crux — audited adversarially), 3. Code quality, 4. Bug-fix soundness (BUG-DOC-001..005), 5. Findings, 6. Verdict, INFO (no action required), MINOR (clear before Record if cheap; none blocking) (+1 more)

### Community 936 - "13.1 `interview_statements`"
Cohesion: 0.50
Nodes (4): 13.1 `interview_statements`, 13. Statements, Design rationale, Provenance requirement

### Community 937 - "19. Status History and Audit"
Cohesion: 0.50
Nodes (4): 19.1 `interview_status_history`, 19.2 Platform audit requirements, 19. Status History and Audit, Design rationale

### Community 940 - "22. Retention, Deletion, and Legal Hold"
Cohesion: 0.50
Nodes (4): 22.1 General rule, 22.2 Different content may have different retention periods, 22.3 Legal hold, 22. Retention, Deletion, and Legal Hold

### Community 941 - "23. Encryption and Sensitive Data"
Cohesion: 0.50
Nodes (4): 23.1 Column-level encryption candidates, 23.2 Plaintext metadata, 23.3 Key management, 23. Encryption and Sensitive Data

### Community 942 - "31. Performance Considerations"
Cohesion: 0.50
Nodes (4): 31.1 Expected access patterns, 31.2 Transcript scale, 31.3 RLS performance, 31. Performance Considerations

### Community 944 - "21. Recommended Dashboard Views"
Cohesion: 0.67
Nodes (3): 21.1 Open Action Items View, 21.2 Action Item Dashboard View, 21. Recommended Dashboard Views

### Community 945 - "28. Example: Complex Action Item"
Cohesion: 0.67
Nodes (3): 28. Example: Complex Action Item, Scenario, Tables Used

### Community 1440 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 3.14 `forms.block_library_items`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1442 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 4.4 `form_responses.form_repeating_group_instances`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1445 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 4.9 `form_responses.form_answer_references`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1453 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 0044 — Process-less cases ("Sem processo"), Consequences, Context, Decisions

### Community 1455 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 32. Implementation Phases, Phase 1 — Essential Interview workflow, Phase 2 — Structured investigation, Phase 3 — External portal and automation

### Community 1456 - "loading.tsx"
Cohesion: 0.50
Nodes (4): Ad-hoc Case Narratives — task detail (archived), Backend (`backend`), Frontend (`frontend`), Gate

### Community 1461 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.05
Nodes (43): Appendix A — Polymorphism dialects (three sanctioned; closes hardening D12; ADR 0065), Appendix B — Catalog-vs-enum + freeze conventions (ADR 0065), ARCHITECTURE.md — Hospital Commission Forms Platform, Architecture Rules, This is NOT the Next.js you know, ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21), Consequences, Context (+35 more)

### Community 1462 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.50
Nodes (4): Backend (`backend`), Frontend (`frontend`), Lead notes — Phase 8 (verbatim, archived), Phase 8 — Dashboards & Submissions Browser (archived task detail)

### Community 1463 - "rca-team-panel.tsx"
Cohesion: 0.67
Nodes (3): 27. Example: Simple Action Item, Scenario, Tables Used

### Community 1464 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.50
Nodes (4): Gate record, Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail, QA findings (Wave 2), Task detail (W2-T0 … W2-T3 + gate)

### Community 1466 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar(), AvatarFallback(), AvatarImage()

### Community 1467 - "14.1 `interview_findings`"
Cohesion: 0.50
Nodes (4): 14.1 `interview_findings`, 14. Findings, Approval invariant, Design rationale

### Community 1468 - "Pre-Pilot DB Hardening — Wave 1 (archived task detail)"
Cohesion: 0.67
Nodes (3): 27. Example: Simple Action Item, Scenario, Tables Used

### Community 1469 - "case-meetings-panel.spec.ts"
Cohesion: 0.67
Nodes (3): 9. Recommended Minimal V1 Table Set, Answer Storage MVP, Form Definition MVP

## Knowledge Gaps
- **4692 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `$schema` (+4687 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **888 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Auth Callback & Meeting Settings` to `3.14 `forms.block_library_items``, `Admin & Auth Pages`, `Triage Disposition & Pathways`, `Case Documents`, `RCA Problem Stage`, `Form Builder Actions`, `4.4 `form_responses.form_repeating_group_instances``, `Submission Detail (Answer Model)`, `CAPA Badges`, `NSP Event Pages`, `RCA Analysis Stage`, `Case Department Field`, `Referral Detail & Formatting`, `Org Overview Dashboard`, `NSP Patient Registry`, `Form Builder Page`, `My Cases List`, `Referral Actions & Reply`, `NSP Referrals Dashboard`, `Case & Phase Actions`, `Meeting Detail & Agenda`, `NSP CAPA/RCA Pages`, `CAPA Evidence & Cards`, `loading.tsx`, `Case Narrative Editor`, `loading.tsx`, `Phase Responder & Submissions`, `Case Narrative Cards`, `Phase Result Actions`, `Forms & Process Templates`, `loading.tsx`, `Meeting Attendees & Quorum`, `loading.tsx`, `Event Notification & Triage`, `Layout`, `Page`, `IsTerminalMeetingStatus`, `Page`, `TitleAssignControl`, `Condition builder`, `CaseActionItemForm`, `VersionWithUrl`, `UploadDialog`, `Page`, `Case tags panel`, `Page`, `Wizard runner`, `Page`, `Page`, `Route`, `ActionItemRow`, `CaseActionItemsPanel`, `Page`, `Page`, `Referral patient fields`, `Page`, `Outcomes actions`, `CaseTagsPanel`, `DepartmentDefDialog`, `Browser`, `Page`, `ADR 0028`, `Page`, `Page`, `Audit icon`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `markdown-renderer.tsx`, `case-phase-result.spec.ts`, `result-actions.ts`, `case-narratives.spec.ts`, `QA Review — Phase B: NSP-per-hospital + `nsp_org_admin``, `0066 — patient_xref case-module grain re-keyed to the patient participant`, `Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record`, `ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)`, `loading.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `Page` connect `Staff Case Detail` to `phase22-referrals.spec.ts`, `phase8-dashboard.spec.ts`, `4.10 `form_responses.form_answer_revisions``, `phase14b-triage.spec.ts`, `Page`, `recommend-result.spec.ts`, `My Cases List`, `NSP Referrals Dashboard`, `Page`, `flagged-aggregate-result.spec.ts`, `loading.tsx`, `phase7-cases.spec.ts`, `cases-outcomes-blockers.spec.ts`, `nsp-per-hospital.spec.ts`, `phase14c-rca.spec.ts`, `phase14d-capa.spec.ts`, `form-model-normalization.spec.ts`, `phase15-indicators.spec.ts`, `phi-remediation.spec.ts`, `Event Notification & Triage`, `mem-memberships-collapse.spec.ts`, `Interview badges`, `Event type manager`, `form-builder-enhancements.spec.ts`, `Page`, `Case document delete`, `ad-hoc-narratives.spec.ts`, `administrativo.spec.ts`, `member-action-items-overview.spec.ts`, `phase13-audit.spec.ts`, `Loading`, `Format`, `Increment Archive — Case Access Control & "Meus Casos"`, `Loading`, `Page`, `case-patient.spec.ts`, `cases-extras.spec.ts`, `cases-meetings-minor.spec.ts`, `patient-index.spec.ts`, `phase14a-safety-events.spec.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `cn()` connect `QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`` to `Case Lifecycle Actions`, `Admin & Auth Pages`, `Shared UI & Phase Dialogs`, `Error & Not-Found Boundaries`, `Loading`, `Phase Answers & Assignments`, `Loading`, `Condition & Result Rule Editor`, `Case Documents`, `4.4 `form_responses.form_repeating_group_instances``, `Triage Disposition & Pathways`, `CAPA Badges`, `NSP Event Pages`, `Referral Detail & Formatting`, `loading.tsx`, `Form Builder Page`, `My Cases List`, `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA`, `NSP Referrals Dashboard`, `Meeting Detail & Agenda`, `NSP CAPA/RCA Pages`, `CAPA Evidence & Cards`, `Form Item Editor & Tests`, `Case Narrative Cards`, `Admin Layout & Claims`, `loading.tsx`, `Derived Indicator Config`, `Meeting Attendees & Quorum`, `loading.tsx`, `Narrative Templates`, `Event Notification & Triage`, `Forms & Process Templates`, `case-phase-result.spec.ts`, `Layout`, `Page`, `Page`, `Page`, `Section signoff fields`, `TitleAssignControl`, `Condition builder`, `avatar.tsx`, `Page`, `CaseActionItemForm`, `Page`, `Case tags panel`, `Page`, `Page`, `Page`, `Loading`, `Avatar stack`, `Page`, `0012 — clone_form_version returns the existing draft (one draft per form)`, `Actions`, `Page`, `Page`, `Audit motion`, `CaseTagsPanel`, `case-patient.md`, `DepartmentDefDialog`, `loading.tsx`, `Page`, `Loading`, `Page`, `ADR 0028`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _4852 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Case Lifecycle Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.1389423076923077 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.042249240121580545 - nodes in this community are weakly interconnected._
- **Should `Shared UI & Phase Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.07382091592617908 - nodes in this community are weakly interconnected._
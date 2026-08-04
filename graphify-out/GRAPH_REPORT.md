# Graph Report - hospital_form_platform  (2026-08-04)

## Corpus Check
- 1973 files · ~2,960,045 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 14165 nodes · 30055 edges · 1596 communities (695 shown, 901 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51bb336c`
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
- server-cache-react.md
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
- loading.tsx
- Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)
- 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema
- page.tsx
- ADR 0004 — Sign-off enforcement feature flag
- parse-config.ts
- 14. Recommended Indexes
- 8. State Machine
- 0013 — Fix form_versions INSERT RLS self-reference
- 11.1 `interview_notes`
- Feature — `case_phase_results` (per-phase categorical result + manual override)
- ADR 0022 — Cross-committee case referrals (linked cases)
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
- ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)
- ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke
- F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE
- 10. Row-Level Security Strategy
- useClientNow
- ADR 0005 — `visible_when` condition shape (v1)
- Conteudo/Comportamento Two-Column Grouping
- ItemEditorDialog Component
- OptionsEditor Table Redesign
- Question Editor Dialog Layout-Refactor Spec
- Clinical Calm Color Theme
- Design Language & Screens Spec (Overview + Kanban)
- AuditEntityType
- 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)
- 0069 — Anglicize status-enum internal keys (D11)
- phase-result-options.ts
- ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)
- Locked Severity Color (patient-safety)
- Shared UI Components (Status Pill, KPI Card, Sidebar)
- ADR 0017 — Multi-Phase Cases
- 5.11 `referral_resolutions`
- ADR 0023 — Configurable per-committee case status
- ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)
- 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema
- ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")
- F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE
- 11. Domain Services and Transaction Boundaries
- 10. Row-Level Security Strategy
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
- 17. Suggested Repository and Service Boundaries
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA
- Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)
- ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)
- AuditEntityType
- ARCHITECTURE.md — Hospital Commission Forms Platform
- 0076 — Notifications (S1·N): pilot scope — prove one vertical deep
- page.tsx
- loading.tsx
- ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)
- 11. Domain Services and Transaction Boundaries
- form-builder-enhancements.md
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)
- ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision
- Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA
- Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)
- QA Review — S1·N Notifications (Phase 20)
- 13.1 `interview_statements`
- case-meetings-panel.spec.ts
- ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole
- case-meetings-panel.spec.ts
- 3.8 `forms.form_block_default_values`
- page.tsx
- 27. Example: Simple Action Item
- 4.3 `form_responses.form_answer_options`
- loading.tsx
- loading.tsx
- loading.tsx
- 5.8 `referral_message_documents`
- Phase 22 — Inter-Committee Case Referrals (`case_referrals`)
- 0058 — Derived quality-indicator measurement compute (the parity lock)
- add-block-menu.tsx
- loading.tsx
- loading.tsx
- 10. New table: `case_votes`
- 12. Optional table: `ethics_decision_details`
- ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case)
- error.tsx
- loading.tsx
- loading.tsx
- error.tsx
- error.tsx
- error.tsx
- Shared Action-Items Hub — task detail (Option A → case-fold → member views)
- loading.tsx
- error.tsx
- loading.tsx
- ADR 0017 — Multi-Phase Cases
- loading.tsx
- ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke
- 5.11 `referral_resolutions`
- 5.4 `referral_assignments`
- page.tsx
- 5.1 `case_referrals`
- error.tsx
- 17.1 `interview_external_access_links`
- 0058 — Derived quality-indicator measurement compute (the parity lock)
- 34. Testing Strategy
- Lead notes
- runLifecycle
- rca-team-panel.tsx
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)
- ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision
- loading.tsx
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)
- 11. Domain Services and Transaction Boundaries
- be3b-targeted-door-mutation-audit.sh
- 17. Suggested Repository and Service Boundaries
- F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE
- F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE
- Phase CH — Committee Charters & Meeting Cadence — QA Review
- 19. Status History and Audit
- Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)
- 23. Encryption and Sensitive Data
- 22. Retention, Deletion, and Legal Hold
- 31. Performance Considerations
- error.tsx
- hospital-departments.spec.ts
- error.tsx
- useClientNow
- 0070 — Interview data-model v2: sessions + reporting / confidentiality columns
- 0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle
- error.tsx
- 32. Implementation Phases
- loading.tsx
- loading.tsx
- loading.tsx
- Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail
- 27. Example: Simple Action Item
- ADR 0019 — The default (anchor) section may carry a title
- case-patient.md
- form-builder-enhancements.md
- layout-adjustments-2026-07.md
- supersede-document-button.tsx
- ADR 0021 — Due dates for case phases
- ADR 0023 — Configurable per-committee case status
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- loading.tsx
- 0085 — Case Correction Lifecycle (phases + narratives)
- 5.2 `referral_context_versions`
- 4.12 `form_responses.form_submission_draft_snapshots`
- 5 · Over-reach audit (things wrongly marked for removal)
- loading.tsx
- 4.7 `form_responses.form_answer_matrix_cells`
- ch-be3-mutation-audit.sh
- ADR 0009 — Local JWT verification for the auth gate & identity
- 0010 — Denormalize email onto public.profiles
- 3.8 `forms.form_block_default_values`
- 4.3 `form_responses.form_answer_options`
- F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE
- 5.11 `referral_resolutions`
- F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE
- Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record
- use-title-action.ts
- 0070 — Interview data-model v2: sessions + reporting / confidentiality columns
- 0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle
- AUTHZ Write-Path Door-Blindness Audit — Findings
- Phase 8 — Dashboards & Submissions Browser (archived task detail)
- Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail
- image-item-editor.tsx
- AuditEntityType
- case-narratives.md
- form-builder-enhancements.md
- QA Review — S1·N Notifications (Phase 20)
- layout-adjustments-2026-07.md
- CustomFieldDef
- supersede-document-button.tsx
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
- 13.1 `interview_statements`
- error.tsx
- error.tsx
- w3-door-kernel-mutation-audit.sh
- w4-technical-director-mutation-audit.sh
- w4-technical-director-referrals-audit.sh
- 20. Reminder Rules
- supersede-document-button.tsx
- access-audit-table.tsx
- loading.tsx

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 702 edges
2. `cn()` - 460 edges
3. `Button()` - 301 edges
4. `commissionHref()` - 191 edges
5. `Page` - 179 edges
6. `cachedSignIn()` - 159 edges
7. `getCommissionAccessByOrg` - 136 edges
8. `FormBanner()` - 130 edges
9. `getSessionContext` - 114 edges
10. `DialogContent()` - 95 edges

## Surprising Connections (you probably didn't know these)
- `signOut()` --references--> `Page`  [EXTRACTED]
  e2e/action-items-satellites.spec.ts → src/lib/types/pagination.ts
- `reopenSatellites()` --references--> `Page`  [EXTRACTED]
  e2e/action-items-satellites.spec.ts → src/lib/types/pagination.ts
- `addWithNewType()` --references--> `Page`  [EXTRACTED]
  e2e/ad-hoc-narratives.spec.ts → src/lib/types/pagination.ts
- `signOut()` --references--> `Page`  [EXTRACTED]
  e2e/administrativo.spec.ts → src/lib/types/pagination.ts
- `createForm()` --references--> `Page`  [EXTRACTED]
  e2e/answer-model-v2.spec.ts → src/lib/types/pagination.ts

## Import Cycles
- 3-file cycle: `src/lib/queries/case-narratives.ts -> src/lib/queries/cases.ts -> src/lib/queries/process-templates.ts -> src/lib/queries/case-narratives.ts`

## Hyperedges (group relationships)
- **Case triage classification badges (harm, preventability, status, sentinel)** — docs_design_dashboard_kpi_harm_badge, docs_design_dashboard_kpi_preventability_badge, docs_design_dashboard_kpi_status_badge, docs_design_dashboard_kpi_sentinel_flag [INFERRED 0.85]
- **M&M committee KPI overview metrics** — docs_design_dashboard_kpi_kpi_awaiting_screening, docs_design_dashboard_kpi_kpi_on_next_agenda, docs_design_dashboard_kpi_kpi_under_review, docs_design_dashboard_kpi_kpi_overdue_review, docs_design_dashboard_kpi_kpi_closed_ytd, docs_design_dashboard_kpi_kpi_preventable_rate [EXTRACTED 1.00]

## Communities (1596 total, 901 thin omitted)

### Community 0 - "Case Lifecycle Actions"
Cohesion: 0.10
Nodes (43): CancelCaseButton(), ADR-0032, ADR-0033, ConfirmDeleteButton(), CoordinatorPhaseActions(), DetailPhase, ADR-0033, ADR-0061 (+35 more)

### Community 1 - "Admin & Auth Pages"
Cohesion: 0.03
Nodes (87): STATUS_OPTIONS, ADR-0093, LinkEvidenceDialog(), LOW_CARDINALITY_KINDS, BannerTone, FormBanner(), toneStyles, ActivatePhaseDialog() (+79 more)

### Community 2 - "Shared UI & Phase Dialogs"
Cohesion: 0.11
Nodes (26): metadata, OrgUsersPage(), ADR-0051, generateMetadata(), HospitalSwitcher(), UserDirectoryList(), UserDirectorySearch(), UserPagination() (+18 more)

### Community 3 - "Error & Not-Found Boundaries"
Cohesion: 0.06
Nodes (55): isOverdue(), localTodayYmd(), MyCapaActionsPage(), ADR-0076, CapaActionStatusChip(), CapaClassificationChip(), CapaSourceBadge(), CapaStatusChip() (+47 more)

### Community 4 - "Condition & Result Rule Editor"
Cohesion: 0.05
Nodes (40): 1.1 · The one that nearly fooled me — recorded, because it is the lesson, 1.2 · Delegation cannot be resolved statically — the lead's cautionary datum, generalized, 1 · The P0s — CONFIRMED DEAD, behaviourally, 2.1 · The proof — mutation testing, 2.2 · Why — and §W-6 named it in advance, 2.3 · The fix — one line, verified, 2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING), 3.1 · `HC0G` → `HC0F` — ✅ **CORRECT, and the codes are internally consistent** (+32 more)

### Community 5 - "Phase Answers & Assignments"
Cohesion: 0.09
Nodes (51): GET(), SUCCESS_REDIRECT, DeadlineDialog(), isoToLocalInput(), LinkableTargetCase, LinkCaseDialog(), nowLocalInput(), ReferralActions() (+43 more)

### Community 6 - "Triage Disposition & Pathways"
Cohesion: 0.08
Nodes (53): DispositionRail(), NON_RCA_PATHWAYS, Pill(), HARM_DEFINITIONS, HarmScale(), ChoiceCard(), CLOSURE_DESCRIPTIONS, CLOSURE_ORDER (+45 more)

### Community 7 - "Case Documents"
Cohesion: 0.05
Nodes (59): ArchiveTemplateButton(), NarrativeSlotCard(), NarrativeSlotDialog(), PhaseSlotCard(), ADR-0032, initialResultValue(), PhaseSlotDialog(), attachTargets() (+51 more)

### Community 8 - "RCA Problem Stage"
Cohesion: 0.05
Nodes (56): TOKEN_COLOR_VAR, CONDITION_TARGET_TYPES, isEligibleTarget(), newChildConditionTargets(), newQuestionConditionTargets(), questionConditionTargets(), sectionConditionTargets(), targetsBefore() (+48 more)

### Community 9 - "Form Builder Actions"
Cohesion: 0.06
Nodes (38): ADR-0011, ADR-0079, ActionState, ALLOWED_IMAGE_MIME, Block, CHOICE_TYPES, COLOR_OPTION_TYPES, COLOR_TOKENS (+30 more)

### Community 10 - "Submission Detail (Answer Model)"
Cohesion: 0.13
Nodes (34): MyCapaActionControls(), ADR-0076, CapaActionCard(), CapaEvidenceLinkForm(), CapaEvidenceUpload(), CapaEvidenceList(), MeasureRow(), addCapaAction() (+26 more)

### Community 11 - "Section Visibility & Blocks"
Cohesion: 0.06
Nodes (34): 0. Scope, 1. Sequencing & dependency stages, 2. Collision matrix — where two tracks touch one schema surface, 3.1 SQLSTATE block allocation (above the live high-water **HC098**; Referrals holds **HC0A0–HC0A9**), 3.2 Feature-flag plan (mechanism: hand-maintained `FeatureFlags` interface + `get_feature_flags()` RPC), 3.3 Cross-cutting conventions (recorded once), 3.4 Specs still to author at S0 (ADR 0071 §Consequences), 3. Design spine — ratified at the S0 gate (+26 more)

### Community 12 - "CAPA Badges"
Cohesion: 0.04
Nodes (75): ADR-0005, BlockConditionNote(), DraftRow, buildOptionLabelMap(), buildQuestionLabelMap(), ConditionClause, describeVisibility(), formatValue() (+67 more)

### Community 13 - "NSP Event Pages"
Cohesion: 0.06
Nodes (66): metadata, ADR-0051, CapaClosurePanel(), CapaEffectivenessPanel(), CapaHeader(), CapaPlanCard(), CustodyHistory(), EventStatusChip() (+58 more)

### Community 14 - "RCA Analysis Stage"
Cohesion: 0.06
Nodes (51): CaseActionItemForm(), PhaseOption, CaseActionItemsPanel(), isItemOverdue(), STATUS_ORDER, ADR-0033, ADR-0032, ADR-0038 (+43 more)

### Community 15 - "Case Department Field"
Cohesion: 0.03
Nodes (82): caseIdFromUrl(), customFieldsRegion(), openNovoCasoDialog(), signInAs(), ADR-0083, addInstance(), advance(), arrowDownUntilLabelled() (+74 more)

### Community 16 - "Referral Detail & Formatting"
Cohesion: 0.06
Nodes (53): metadata, OrgAccreditationPage(), metadata, OrgCommissionsPage(), ADR-0051, HospitalDetailPage(), metadata, metadata (+45 more)

### Community 17 - "Staff Case Detail"
Cohesion: 0.02
Nodes (87): ADR-0066, openQuestionDialog(), signInAs(), signInAs(), signInAs(), ADR-0078, callRPC(), createRealizadaMeeting() (+79 more)

### Community 18 - "Org Overview Dashboard"
Cohesion: 0.06
Nodes (31): 1.1 Table existence, 1.2 RLS policies on the five meeting tables (SELECT + the FOR ALL write policies), 1.3 The `FOR ALL` PERMISSIVE inventory (case / meeting / action-item surface — the §7.6 blind spot), 1.4 Functions — `prosecdef` (a DEFINER's gate REPLACES RLS — §7.2·6), 1.5 Storage policies (meeting bucket) & RPC ACLs, 1. Verified catalog snapshot of the current Stage-C surface, 2. Ordered migration-sequencing plan (one attributable migration per unit), 3. A26 resolution → the C5 propriety-tier predicate + the `case_id IS NULL` branch (+23 more)

### Community 19 - "Quality Indicators"
Cohesion: 0.05
Nodes (71): AdminOrganizationsPage(), metadata, LoginPage(), metadata, metadata, CommissionEditForm(), StaffAdminManager(), LoginForm() (+63 more)

### Community 20 - "NSP Patient Registry"
Cohesion: 0.08
Nodes (41): metadata, NspPatientsPage(), parseEntityParam(), ADR-0039, ADR-0052, VALID_MODULES, formatDate(), patientModuleChipClass() (+33 more)

### Community 21 - "Form Builder Page"
Cohesion: 0.12
Nodes (16): Accreditation & Quality-Governance Track (Phases 13–21), Phase 0 — Scaffolding & Environment, Phase 10 — Meetings, Phase 11 — Interviews, Phase 12 — Case Timeline, Phase 1 — Database Schema, Auth & RLS, Phase 2 — Authentication & App Shell, Phase 3 — Admin Area & User Management (+8 more)

### Community 22 - "CAPA Actions & Closure"
Cohesion: 0.06
Nodes (31): App-layer ripple, App-layer ripple, App-layer ripple, App-layer ripple: **none.**  ### Review flag: 🟢. **Open decision → D8-Q1 (skip vs COMMENT migration).**, Current state, Current state, Current state (full sweep), Current state — structural findings (+23 more)

### Community 23 - "My Cases List"
Cohesion: 0.05
Nodes (73): CasesBoardPage(), metadata, ADR-0038, ADR-0061, ADR-0064, ADR-0078, ADR-0083, ADR-0084 (+65 more)

### Community 24 - "Auth Callback & Meeting Settings"
Cohesion: 0.12
Nodes (54): UploadDialog(), AttendeeRow(), addMeetingAttendee(), addReservedItem(), AgendaItemInput, ALLOWED_ATTACHMENT_MIME, archiveMeetingType(), ATTACHMENT_KINDS (+46 more)

### Community 25 - "Referral Actions & Reply"
Cohesion: 0.07
Nodes (51): AssessmentRow, CCIH_FORM_HIGIENE, cloneFrameworkRpc(), createFrameworkRpc(), EvidenceLinkRow, filterIds(), FrameworkRow, getToken() (+43 more)

### Community 26 - "NSP Referrals Dashboard"
Cohesion: 0.13
Nodes (33): UserLifecycleActions(), isEmailVerificationEnabled(), withFlag(), createAdminClient(), ActionState, appOrigin(), assignCommitteeRole(), authorizeForCommission() (+25 more)

### Community 27 - "Case & Phase Actions"
Cohesion: 0.11
Nodes (44): AddAdHocPhaseDialog(), CasePhaseDelete(), ActionState, activatePhase(), addAdHocPhase(), AddAdHocPhaseState, authorizeCommission(), cancelCase() (+36 more)

### Community 28 - "Meeting Detail & Agenda"
Cohesion: 0.05
Nodes (68): isAssignmentOverdue(), metadata, MyReferralAssignmentsPage(), metadata, ReferralDetailPage(), ADR-0078, ADR-0094, CaseOutboundReferralsCard() (+60 more)

### Community 29 - "NSP CAPA/RCA Pages"
Cohesion: 0.09
Nodes (31): ReferenceConfigEditor(), ADR-0091, describeReferenceConfig(), isCaseScopedOnlyLane(), LaneCopy, reachesCaseScopedLane(), REFERENCE_LANE_COPY, referenceKindLabel() (+23 more)

### Community 30 - "CAPA Evidence & Cards"
Cohesion: 0.12
Nodes (34): CapaActionForm(), userLabel(), CapaActionsSection(), activePdcaStage(), allActionsSettled(), allMeasuresHaveResults(), canAdvanceAction(), concludeGate (+26 more)

### Community 31 - "Case Narrative Editor"
Cohesion: 0.18
Nodes (10): activate(), createCase(), createResult(), insertOptions(), rpc(), saveAndSubmit(), signInAs(), slug() (+2 more)

### Community 32 - "Form Item Editor & Tests"
Cohesion: 0.07
Nodes (33): CaseDepartmentField(), DEPARTMENTS, ADR-0061, CreateCaseDialog(), ADR-0038, ADR-0064, ADR-0083, CustomFieldInput() (+25 more)

### Community 33 - "Submission Detail Blocks"
Cohesion: 0.19
Nodes (15): SubmissionsPage(), listMeetings(), listSubmissions(), CursorFieldKind, CursorSchema, decodeCursor(), encodeCursor(), fieldValid() (+7 more)

### Community 34 - "Phase Responder & Submissions"
Cohesion: 0.10
Nodes (48): UploadDialog(), InterviewLifecycleActions(), isTerminalSession(), SessionActions(), ActionState, AddInterviewerState, addInterviewInterviewer(), addInterviewLink() (+40 more)

### Community 35 - "Case Narrative Cards"
Cohesion: 0.07
Nodes (50): ReferralMessageTypeChip(), ComposerMode, ComposerModeKey, ADR-0037, SafetyEventPrefill, ReferralThreadItem(), ReferralThread(), ADR-0037 (+42 more)

### Community 36 - "Phase Result Actions"
Cohesion: 0.05
Nodes (31): ImageItemEditor(), ImagePreview(), BlockRenderer(), CHOICE, canAddInstance(), buildItemHandlers(), ItemCallbacks, ItemHandlerMap (+23 more)

### Community 37 - "Admin Layout & Claims"
Cohesion: 0.11
Nodes (13): actionItemsSection(), createMeetingActionItemUI(), itemRow(), openEditDialog(), openSatellites(), openSatellitesByKeyboard(), reopenSatellites(), signInAs() (+5 more)

### Community 38 - "Interview & Agenda Forms"
Cohesion: 0.10
Nodes (26): metadata, NspConfigPage(), ADR-0052, metadata, NspRosterPage(), ADR-0052, RcaWindowForm(), resolveNspHospital() (+18 more)

### Community 39 - "Forms & Process Templates"
Cohesion: 0.09
Nodes (34): ActionItemDetailPage(), cnDue(), describeSource(), metadata, metadata, MyActionItemsPage(), ActionItemSourceBadge(), ActionItemStatusBadge() (+26 more)

### Community 40 - "Derived Indicator Config"
Cohesion: 0.04
Nodes (61): CommissionReferralsPage(), metadata, deriveFlowMetrics(), metadata, NspReferralsDashboardPage(), ADR-0042, ADR-0094, buildCaseReferralsModule() (+53 more)

### Community 41 - "Meeting Attendees & Quorum"
Cohesion: 0.03
Nodes (135): DetailBlock(), SectionBody(), CollectedAnswers, collectInstances(), collectScope(), InstanceAnswers, ScopeState, topLevelItems() (+127 more)

### Community 42 - "Hospital Detail Pages"
Cohesion: 0.07
Nodes (27): 0. Conflicts named (plan wins) + verified-fact corrections, A.1 `public.attachments` — core (single authorizing owner + six ADR-0063 seams), A.2 `public.attachment_references` — non-authorizing "also appears here" (ADR-0063 §1), A.3 `public.attachment_subjects` — descriptive, PHI-safe, **participant-keyed (C-β)**, A.4 `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), A. Table / column DDL plan (attachments + companions), Appendix — verified F1/baseline build surface (symbols F2 depends on), B.1 `app.commission_of_attachment(owner_type text, owner_id uuid) returns uuid` (+19 more)

### Community 43 - "Narrative Templates"
Cohesion: 0.05
Nodes (49): AccountLayout(), ADR-0076, NotificationPreferencesPage(), ADR-0076, ContaNav(), ITEMS, ADR-0076, NotificationBellClient() (+41 more)

### Community 44 - "Event Notification & Triage"
Cohesion: 0.08
Nodes (39): InterviewModalityChip(), SessionStatusBadge(), SessionTypeChip(), ADR-0072, InterviewFormDialog(), ATTACHMENT_KIND_ORDER, CONFIDENTIALITY_LABEL, CONFIDENTIALITY_ORDER (+31 more)

### Community 45 - "Page"
Cohesion: 0.04
Nodes (43): 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3), Consequences, Context, Decision, 0069 — Anglicize status-enum internal keys (D11), Consequences, Context, Decision (+35 more)

### Community 46 - "Page"
Cohesion: 0.12
Nodes (16): 12. Transactional Outbox and Notifications, 13. Audit and Retention, 15.1 Optimistic concurrency, 15.2 Pessimistic locking for commands, 15.3 Idempotency keys, 15. Concurrency Control, 16. Suggested Application-Layer Domain Model, 18.1 Referral inbox (+8 more)

### Community 47 - "Layout"
Cohesion: 0.08
Nodes (35): ConfirmRemoveButton(), TitleAssignControl(), ADR-0051, CAPABILITIES, MemberAdministrativoControls(), ADR-0061, MemberList(), ADR-0051 (+27 more)

### Community 48 - "Page"
Cohesion: 0.11
Nodes (20): ImageContentRenderer(), SectionTextRenderer(), describeCardinalitySuffix(), ReadOnlyBlock(), SectionSignoffFields(), RespondentSignoff(), formatDate(), RespondentContext() (+12 more)

### Community 49 - "IsTerminalMeetingStatus"
Cohesion: 0.08
Nodes (30): metadata, OrgOverviewPage(), CHART_COLORS, CommissionOverview(), CHARTABLE, ChartableInputType, CommissionOverviewRow, DashboardRange (+22 more)

### Community 50 - "Page"
Cohesion: 0.10
Nodes (32): TemplateOption, buildRowsFromPaste(), coerceChoice(), coerceCustomField(), coercePatientCell(), createRowId(), DEFAULT_PHI_KEYS, duplicateRowNumbers() (+24 more)

### Community 51 - "UserLifecycleActions"
Cohesion: 0.06
Nodes (74): PhaseResultBadge(), PhaseCorrectionMode, PhaseCorrectionOptions, timelineResultToResolved(), AvatarStack(), CaseTimeline(), DAY_MONTH, DERIVED_PILL (+66 more)

### Community 52 - "Page"
Cohesion: 0.07
Nodes (32): metadata, MyPhasesPage(), ADR-0033, CaseCorrectionsList(), CasePhaseArticle(), DetailPhase, ADR-0033, ADR-0061 (+24 more)

### Community 54 - "Section signoff fields"
Cohesion: 0.04
Nodes (74): ADR-0090, DefaultCheckboxSet(), DefaultConfig, DefaultValue, DefaultValueEditor(), DynamicSourcePicker(), initialDefaultConfig(), initialDefaultValue() (+66 more)

### Community 55 - "ListMeetings"
Cohesion: 0.29
Nodes (7): AI track — Action-Items Satellites + Cross-Link UI + reminder→N scan arm, Build catch (BE-6·N, recorded for posterity), Gate results — all green, Key decisions, Migrations / files, Pre-pilot follow-ups (PO-directed, NOT this phase), What shipped

### Community 56 - "Page"
Cohesion: 0.10
Nodes (19): 15.1 `interview_summaries`, 15. Summaries, 16.1 `interview_documents`, 16. Document Integration, 1. Domain Overview, 24. Indexing Strategy, 27. Frontend Implications, 29. Enum Implementation Strategy (+11 more)

### Community 57 - "TitleAssignControl"
Cohesion: 0.03
Nodes (154): ADR-0065, CaseStatusBadge(), DecideAdmissibilityDialog(), EthicsAdmissibilityPanel(), IntakeDialog(), toLocalInput(), AddAllegationDialog(), EthicsAllegationsPanel() (+146 more)

### Community 58 - "Condition builder"
Cohesion: 0.07
Nodes (43): CharterFormState, FREQUENCIES, saveCharter(), CharterPage(), formatDateOnly(), formatTimestamp(), metadata, ADR-0080 (+35 more)

### Community 59 - "Interview badges"
Cohesion: 0.11
Nodes (38): ADR-0082, ADR-0081, computeKpis(), derivedStatus(), fetchRegisterTruth(), isOverdueIso(), kpiValue(), RegisterTruthRow (+30 more)

### Community 60 - "Page"
Cohesion: 0.09
Nodes (37): AssessmentForm(), EvidenceList(), formatLinkedAt(), LinkEvidenceDialogTrigger(), StandardPanel(), ASSESSMENT_STYLES, EVIDENCE_STYLES, EvidenceStatusChip() (+29 more)

### Community 61 - "CaseActionItemForm"
Cohesion: 0.07
Nodes (24): Axis, blockCard(), cellsOf(), CONFORMIDADE_COLS, CONFORMIDADE_ROWS, createForm(), enterWizard(), FixtureForm (+16 more)

### Community 62 - "VersionWithUrl"
Cohesion: 0.13
Nodes (33): CloneFrameworkDialog(), EvidenceCombobox(), SimpleCandidateSelect(), ActionState, cloneFramework(), CloneFrameworkState, createFramework(), CreateFrameworkState (+25 more)

### Community 63 - "UploadDialog"
Cohesion: 0.10
Nodes (38): ActionItemRow(), CaseDocumentDelete(), UploadDialog(), ACTION_ITEM_STATUSES, ActionState, advanceActionItem(), authorizeCommission(), commissionOfCase() (+30 more)

### Community 64 - "Layout"
Cohesion: 0.05
Nodes (42): 10. Findings, 1.1 `case_phases` carries status/assignee/recommended only — never answers, 1.2 Coordinator board reads (`list_cases_board` / `get_case_detail`), 1.3 `case_phase_answer_map` is submitted-only, 1.4 `recompute_recommendations` is submitted-only end-to-end, 1.5 `responses_select` / `answers_select` not broadened, 1.6 RLS check in the E2E suite, 1.7 Service-role key not reachable client-side (+34 more)

### Community 65 - "Page"
Cohesion: 0.07
Nodes (27): A0 · Findings already CONFIRMED from the catalog (2026-07-15) — start here, then extend, A0 · Migration contract — **catalog-driven** (no SQL until this is reviewed), A1 · pgTAP first (authored before the SQL), A2 · The resolver, A3 · `case_types.default_visibility_policy`, A4 · Repoint policies — **⛔ D4·1 IS A NO-OP AS THE ADR SCOPES IT** (ADR 0078 **A21**), A5 · ⛔ Performance gate — **exit criterion, before policies repoint**, B1 · `case_access_grants` (hard cut) (+19 more)

### Community 66 - "Case tags panel"
Cohesion: 0.03
Nodes (113): metadata, ReviewAndSignPage(), ADR-0061, formatDateTime(), SignoffMeta(), ADR-0087, ADR-0089, ADR-0091 (+105 more)

### Community 67 - "Event type manager"
Cohesion: 0.18
Nodes (11): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), signInAs(), slug(), startResponse() (+3 more)

### Community 68 - "Page"
Cohesion: 0.06
Nodes (28): addInstance(), AnswerRow, conditionTargetLabels(), conditionTargetSelect(), conditionValueSelect(), containerCard(), createForm(), enableCondition() (+20 more)

### Community 69 - "Page"
Cohesion: 0.13
Nodes (15): 0. Why, 1. The three-bucket disposition (summary — full rationale in the evaluation doc), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 5. Avoided items (recorded so builders don't reintroduce them), 6. Testing & gates, 7. Risks & open decisions for the product owner (+7 more)

### Community 70 - "Phase result badge"
Cohesion: 0.05
Nodes (40): 1. Requirements Audit (PHASES.md §Phase 5), 2. Security / RLS Audit (Architecture Rule 1 + Rule 3), 3. Code Quality (Architecture Rule 9 + CLAUDE.md §8), 4. UX & Accessibility (CLAUDE.md §8, Architecture Rule 7), 5. Hygiene, 6. Findings, 7. Scope Deferrals Confirmed (Not Findings), 8. RLS Verification Summary (+32 more)

### Community 71 - "Wizard runner"
Cohesion: 0.07
Nodes (52): saveAndExit, saveSection, signSection, submitCasePhaseResponse, submitResponse, ADR-0085, ADR-0087, ADR-0091 (+44 more)

### Community 72 - "Case timeline"
Cohesion: 0.08
Nodes (24): 0. Scope, 1. Collision matrix — the four initiatives against each other, 2. The design spine (D-remainder folded in) — conventions ratified at F0, 3. Phased sequence, 4. Rule 12 / Rule 2 amendment plan (who writes what, when), 5. Disposition of every hardening Wave-3/4 item (initiative D), 6. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 7. Testing & gates (+16 more)

### Community 74 - "Page"
Cohesion: 0.12
Nodes (23): CaseMeetingsPanel(), SessionRow(), formatDateTime(), formatMeetingNumber(), formatSchedule(), MeetingStatusBadge(), MeetingTypeChip(), MeetingHeader() (+15 more)

### Community 75 - "Actions"
Cohesion: 0.06
Nodes (35): 1. Requirements Audit — the 8 Locked Decisions, 2. Security / RLS / PHI Review, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, Accessibility, ADR exists for non-trivial choices, `can_read_case_patient` wraps the live `can_read_case` (+27 more)

### Community 76 - "Components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 77 - "Page"
Cohesion: 0.09
Nodes (22): 1. Environment — verified independently, not taken from the report, 2.1 ⭐ `LOST = 0 / GAINED = 0` over 1568 cells, 369 reachable — **denominator independently reproduced**, 2.2 The six-step order and the hard deny — **holds in the live body**, 2.3 The lattice is asserted, never imposed — **confirmed**, 2.4 `read_standard_phi` is CONSUMED — the A36 blocker is cleared, 2.5 ACLs / `prosecdef` — clean, 2.6 A2 changed nothing outside its four predicates — **confirmed two ways**, 2. The claims, attacked (+14 more)

### Community 79 - "Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, class-variance-authority, clsx, date-fns, gsap, lucide-react, next, radix-ui (+13 more)

### Community 80 - "Loading"
Cohesion: 0.25
Nodes (8): Collision conformance (S0 §E), Commits (branch `pre-pilot-release-s0`), Gate (CLAUDE.md §6) — all ✅ (human-approved 2026-07-14), Open follow-ups (non-blocking), RV2·R1 — Referrals v2 · Dialogue Core — completed-track record, SQLSTATE, Two runtime-caught fixes (both by the frontend's dev-server verification — pgTAP structurally couldn't), What shipped (R0 → R1)

### Community 81 - "Loading"
Cohesion: 0.09
Nodes (22): 1. Data model (shared by both layouts), 2. Design token mapping, 3.1 Geometry constants (recommended; adapt to your scale), 3.2 Axis header, 3.3 Background layers (behind events), 3.4 Phase bars (width = duration), 3.5 Single-day pins, 3.6 Event states (visual) (+14 more)

### Community 82 - "Route"
Cohesion: 0.26
Nodes (12): DepartmentDefDialog(), ArchiveDepartmentButton(), DepartmentsManager(), useDepartmentAction(), archiveDepartment(), createDepartment(), DepartmentActionState, mapDepartmentError() (+4 more)

### Community 83 - "ActionItemRow"
Cohesion: 0.10
Nodes (37): CaseTypeDialog(), EMPTY, ADR-0064, CaseTypePicker(), ADR-0064, ActionState, authorizeOrg(), CaseTypeInput (+29 more)

### Community 84 - "CaseActionItemsPanel"
Cohesion: 0.21
Nodes (23): EventTypeManager(), SentinelCriterionManager(), draftFromTriage(), TriageWorkstation(), VocabActions, VocabManager(), mapTriageError(), archiveEventType() (+15 more)

### Community 85 - "Case document delete"
Cohesion: 0.05
Nodes (33): ADR-0021, fieldContainer(), fillTimeField(), pickDate(), pickDateKeyboard(), setDateTimeField(), setDateTimeFieldKeyboard(), callRPC() (+25 more)

### Community 86 - "Gantt axis"
Cohesion: 0.09
Nodes (24): metadata, ADR-0032, NarrativeTypeDialog(), ArchiveNarrativeTypeButton(), NarrativeTypeManager(), ADR-0032, ArchiveResultButton(), ResultVocabManager() (+16 more)

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
Cohesion: 0.16
Nodes (35): AddAdHocNarrativeDialog(), CaseNarrativeDelete(), caseAccessEnabled(), addAdHocNarrative(), addTemplateNarrative(), archiveNarrativeType(), assignNarrative(), authorizeCommission() (+27 more)

### Community 94 - "Page"
Cohesion: 0.07
Nodes (29): 0 · CAPA-surface confirmation (B1 (a) — closes the pre-WS-3c-baseline risk), 1.1 `public.indicators`, 1.2 `public.indicator_measurements`, 1.3 `app.mint_indicator_code()` — per-commission (reuses the `mint_meeting_number` pattern), 1.4 Flag seed — **OFF**, 1.5 RLS (Rule 1) — **posture (b): DEFINER-RPC-only writes (LEAD DECISION 2026-07-05)**, 1.6 Audit AFTER-triggers (Rule 11 — non-sensitive allow-list, **never `description_md`**), 1 · Migration set (B2 — `20260712000000_indicators_core.sql`) (+21 more)

### Community 95 - "Page"
Cohesion: 0.10
Nodes (20): 1. What I re-proved myself (all green — no finding), 2. BLOCKING findings, 3. MAJOR — coverage gaps (behaviour verified CORRECT by me; a regression would be undetectable), 4. MINOR, 5. INFO (no action required), 6. Assessment of the lead's five carried gaps, 7. What I did not verify, 8. Stack state (+12 more)

### Community 96 - "Page"
Cohesion: 0.06
Nodes (49): MeetingDetailPage(), metadata, ADR-0078, ADR-0080, MeetingMinutesEditor(), MeetingSettingsView(), MeetingTypeManager(), ReaderOption (+41 more)

### Community 97 - "ActionItemForm"
Cohesion: 0.07
Nodes (29): 1. Requirements Coverage, 2.1 The three predicates, 2.2 Flag-OFF fallback — no ON-path gap, 2.3 Anon / PUBLIC EXECUTE, 2.4 `case_access` SELECT policy scoping, 2.5 Additive `case_documents` / `case_events` WRITE policies, 2.6 Submitted-only invariant (Phase-7), 2.7 PHI isolation (Architecture Rule 12) (+21 more)

### Community 98 - "Referral patient fields"
Cohesion: 0.11
Nodes (33): CapaStage(), OpenCapaButton(), AnalysisStage(), SubView, Tab(), countDone(), deriveDone(), deriveKeyFactors() (+25 more)

### Community 99 - "ClampCalloutCenter"
Cohesion: 0.07
Nodes (28): 1. Requirements Audit, 2. Security / RLS Audit, 2a. Definer RPC gating, 2b. in_progress-answers invariant (the crux), 2c. B6 anon/PUBLIC EXECUTE revoke, 2d. Export route — no service-role key, 2e. Client-side form filter in `listSubmissions`, 3. Code Quality Audit (+20 more)

### Community 100 - "Actions"
Cohesion: 0.11
Nodes (17): 1. ⭐ The highest-value question: can `authenticated` set `app.in_case_rpc` itself?, 2. §7.7 — does the narrowing bind TOO MUCH? (the lead's stated top risk), 3. Parity — is the door exactly as wide as the PATCH it replaced?, 4. ⭐ Are the 29 keystones vacuous?, 5. The `230` edit — did M3's coverage survive?, 6. Rule 11 / Rule 12 — the audit witness, 7. D3 — genuinely deferred, not silently live in a worse form, 8. ACL / hygiene (+9 more)

### Community 105 - "Page"
Cohesion: 0.15
Nodes (37): ActionState, AddPhaseState, addTemplatePhase(), archiveProcessTemplate(), authorizeCommission(), boolFromForm(), commissionOfTemplate(), contextOfPhase() (+29 more)

### Community 106 - "Outcomes actions"
Cohesion: 0.10
Nodes (33): AcknowledgeButton(), CancelButton(), ReopenButton(), CapaTaskList(), CatBlock(), CauseCard(), Fishbone(), RcaMemberRoleBadge() (+25 more)

### Community 108 - "Audit motion"
Cohesion: 0.13
Nodes (15): 1. The P0 — C7/A8 is implemented in the policies and **reversed in the DEFINER doors**, 2. MAJOR-1 — `meeting_agenda_items.description` is unmasked, and PHI-BEARING by its own comment, 3. MAJOR-2 — reserved-session content escapes the meeting child lock, 4. THE 228 ADJUDICATION (tests 115–118) — **the lead's read is CORRECT; one correction is load-bearing**, 5. What I verified as sound, 6. MINOR / INFO, 7. Open risks, 8. Summary (+7 more)

### Community 109 - "CaseTagsPanel"
Cohesion: 0.14
Nodes (14): 1. Requirements audit (vs ADR 0050 + plan §2) — PASS, 2. RLS — verbatim reuse confirmed (plan §8 primary charge) — PASS, 3. O-1 (fail-closed null-case) — confirmed sound — PASS, 4. O-2 (write authority) — RPC bodies match the ratified default — PASS, 5. `list_my_action_items` widening — additive — PASS, 6. Conventions — PASS, E2E status (as relayed), Findings (+6 more)

### Community 110 - "DepartmentDefDialog"
Cohesion: 0.04
Nodes (63): metadata, MyCasesPage(), ADR-0033, CaseCustomFieldsPanel(), ADR-0083, OutcomeBreakdownRow, CasePrimarySubjectPanel(), ADR-0064 (+55 more)

### Community 111 - "ADR 0050"
Cohesion: 0.09
Nodes (22): 1.1 The triage worksheet (one per event), 1.2 Reach & harm spectrum — `ReachId` (ordered, escalating), 1.3 Harm severity — `HarmId` (NCC MERP / JC tiers), 1.4 Sentinel designated categories (JC "always review"), 1.5 Not-a-PSE closure reasons — `ReasonId`, 1.6 Reporting committees (intake sources), 1.7 Intake event, 1.8 Seed events (de-identified reference) (+14 more)

### Community 115 - "Page"
Cohesion: 0.19
Nodes (8): addCapaAction(), newSignedInPage(), openBell(), openFreshCapaPlan(), rpc(), serviceRpc(), signInAs(), ADR-0076

### Community 116 - "Audit feed"
Cohesion: 0.11
Nodes (29): EditDocumentPage(), metadata, metadata, NewDocumentVersionPage(), DocumentDetailPage(), metadata, ReviseDocumentVersionPage(), ADR-0081 (+21 more)

### Community 117 - "Browser"
Cohesion: 0.08
Nodes (25): 0078 — Authorization capability model: case capabilities, granular grants, meeting boundary & referral write-gate, Claims that did NOT survive verification (recorded to prevent re-litigation), Consequences, Context — what verification actually found, D10 — Write arms: preserve today's narrower behaviour (a deliberate divergence), D11 — Capability sources, including **the member arm** (the crux), D12 — Terminology: docs only, D13 — Process, SQLSTATEs, audit (+17 more)

### Community 120 - "AdminAuditPage"
Cohesion: 0.17
Nodes (12): 1. Executive Summary, 2.1 A referral does not transfer case ownership, 2.2 A referral has one source and one target committee, 2.3 Shared information must be explicit, 2.4 Shared messages and internal notes are different security domains, 2.5 A response is not the same as resolution, 2.6 Important records are append-only, 2. Core Domain Principles (+4 more)

### Community 121 - "Page"
Cohesion: 0.12
Nodes (16): 1. The ask — three questions, 2. What is live today (verified), 3. Four defects, in severity order, 4. Correction to my own prior reporting, 5. Sequencing vs A2 — ⛔ my first answer here was WRONG, 6. Options, 6b. Corrections from `backend`'s plan review (2026-07-16, all three lead-verified), 7. What I need from you (+8 more)

### Community 122 - "Page"
Cohesion: 0.07
Nodes (37): InterviewDetailPage(), metadata, InterviewerRoleBadge(), RelationshipBadge(), isEditableInterviewStatus(), InterviewSummaryEditor(), InterviewerForm(), InterviewerMemberOption (+29 more)

### Community 123 - "BlockConditionNote"
Cohesion: 0.12
Nodes (15): 0. What you're pointing at, 1.1 Push pending migrations, 1.2 Verify asymmetric JWT signing keys (known gap — ADR 0009), 1.3 Register the custom access-token hook, 1.4 Note your keys, 1.5 Email (defer for now), 1. Pre-flight on Supabase Cloud (one-time, before the first deploy), 2. Get the repo onto the droplet (+7 more)

### Community 124 - "ConfirmDeleteButton"
Cohesion: 0.04
Nodes (67): ADR-0033, AddBlockMenu(), DISPLAY_TYPES, INPUT_TYPES, ADR-0087, ADR-0089, ADR-0091, ADR-0092 (+59 more)

### Community 125 - "Format"
Cohesion: 0.05
Nodes (93): metadata, roleFromCapabilities(), StaffCaseDetailPage(), ADR-0033, ADR-0061, ADR-0085, CaseDetailLayout(), CaseDetailPage() (+85 more)

### Community 127 - "ADR 0028"
Cohesion: 0.06
Nodes (61): allowedRuleTypes(), blankDraft(), dateRangeInputType(), DATETIME_ORDER_OP_LABELS, datetimeOrderTargets(), itemAcceptsValidations(), nextKey(), parentItemTypeOf() (+53 more)

### Community 129 - "Corrective Action (PDCA tracked)"
Cohesion: 0.10
Nodes (20): 10. Component inventory, 11. Acceptance checklist, 1.1 Fishbone categories (clinical Ishikawa — the six ribs), 1.2 Root-cause classification, 1.3 PDCA stages (the wheel), 1.4 Seed data (de-identified reference — case "MM-2026-0142"), 1.5 Derived values (single source of truth), 1. Data model (single shared analysis object) (+12 more)

### Community 135 - "Scripts"
Cohesion: 0.10
Nodes (21): scripts, build, db:link, db:push, db:reset:linked, dev, e2e, e2e:prod (+13 more)

### Community 136 - "Form builder condition engine enhancements"
Cohesion: 0.15
Nodes (13): 0045 — Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys), Alternatives rejected, Consequences, Context, Decision, Delivery, Evaluator parity — the hard invariant (Rule 3), Immutability & RLS (+5 more)

### Community 139 - "Meeting form dialog.test"
Cohesion: 0.21
Nodes (21): ActionState, archiveIndicator(), computeDerivedMeasurement(), ComputeMeasurementState, createIndicator(), CreateIndicatorState, KNOWN_PT_BR_HC084, mapIndicatorError() (+13 more)

### Community 146 - "Page"
Cohesion: 0.26
Nodes (18): ActionState, archiveCaseOutcome(), authorizeCommission(), CaseOutcomeInput, commissionOfCase(), commissionOfOutcome(), commissionOfTemplate(), createCaseOutcome() (+10 more)

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
Cohesion: 0.11
Nodes (28): NspEventDetailPage(), NspConsoleLayout(), ADR-0052, metadata, NspInboxPage(), ADR-0042, metadata, NspTriagePage() (+20 more)

### Community 151 - "Architecture Rules (binding)"
Cohesion: 0.10
Nodes (20): CheckboxGroup(), ChoiceGroup(), DateTimeItem(), formatBoundsHint(), FreeTextItem(), InputItem, NumberItem(), optionRowClass() (+12 more)

### Community 156 - "ADR 0048 — User Registration & Identity"
Cohesion: 1.00
Nodes (3): /auth/confirm Server-Side Handler (verifyOtp token_hash + type), Invite Email Template (pt-BR), Password-Recovery Email Template (pt-BR)

### Community 157 - "Page"
Cohesion: 0.12
Nodes (16): 1. The 4 function targets — each edited correctly, nothing else touched, 2. The 18 policies — all narrowed, `pg_policies` quals read live, 3. Behavioural narrowing + positive twins (RLS-row level, `set local role authenticated`), 4. K2 — the "one level deeper than the policy" leak, verified independently, 5. K3 — action_items SCOPED, not deleted (both directions, one from a fixture), 6. PHI control — never widened, never narrowed, 7. `manage_case_access` kept on scope grounds — keystone-23 independence holds, 8. GAINED = 0 (no widening — the P0 safety property) (+8 more)

### Community 158 - "Page"
Cohesion: 0.10
Nodes (36): ProblemCard(), ProblemStage(), EvidenceRow(), MemberRow(), RootCard(), RootsStage(), padSteps(), WhyChainCard() (+28 more)

### Community 159 - "OrgAuditPage"
Cohesion: 0.11
Nodes (14): ADR-0026, addSubjectRpc(), callRPC(), completeSessionRpc(), confirmLifecycle(), createInterviewRpc(), goToCaseDetail(), goToInterview() (+6 more)

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
Cohesion: 0.15
Nodes (35): metadata, AddVersionForm(), DocumentActionsMenu(), PublishDocumentDialog(), SubmitForApprovalForm(), addDocumentVersion(), ALLOWED_DOCUMENT_MIME, approveDocument() (+27 more)

### Community 180 - "Document editor"
Cohesion: 0.12
Nodes (16): 10. Rebuild notes / gotchas, 1. Purpose & scope, 2. Design system (inherited — do not reinvent), 3. Data model, 4. Component inventory, 5. App shell, routing & state (`docs-app.jsx`), 6. Screen — Document register (library) · `docs-library.jsx`, 7.1 Page layout (+8 more)

### Community 198 - "Layout"
Cohesion: 0.29
Nodes (5): ibmPlexMono, ibmPlexSans, ibmPlexSerif, metadata, viewport

### Community 199 - "AttachmentLinkForm"
Cohesion: 0.18
Nodes (17): metadata, ADR-0084, BulkCreateAction, BulkMember, BulkTemplateOption, memberName(), PhaseScope, BulkChecklistItem (+9 more)

### Community 208 - "AuditFeed"
Cohesion: 0.15
Nodes (24): matrixAndRiskBody(), ADR-0089, Axis, axisInsert(), cellsOf(), CONFORMIDADE_COLS, CONFORMIDADE_ROWS, enterWizard() (+16 more)

### Community 209 - "InterviewLifecycleActions"
Cohesion: 0.09
Nodes (22): BLOCKER, Findings (iteration 1 — context; M1/M2a/I1 now resolved per the table above), I1 — `dispose_case_phi` carries a bare `is_admin()` cross-tenant PHI-erasure arm (pre-existing; out of this phase's two-module scope — flagged for the pending scope decision), I2 — `patient_xref_select_pqs` RLS / `can_read_xref_row` are dead for `authenticated` (defense-in-depth only); design §D item 7 is untestable as written, I3 — `is_admin` sweep summary (every live occurrence, classified), Independent verification (probes I ran), INFO, Iteration-2 delta verdict (all resolved at iter-3) (+14 more)

### Community 210 - "Avatar stack"
Cohesion: 0.14
Nodes (17): metadata, OrgAdministratorsPage(), ADR-0051, ADR-0052, OrgNspAdminLayout(), ADR-0052, ORG_NSP_NAV_ITEMS, OrgNspAdminNav() (+9 more)

### Community 218 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 219 - "Audit icon"
Cohesion: 0.17
Nodes (18): cancelEvent(), disposeEventPhi(), notifySafetyEvent(), revalidateSafety(), setEventPatient(), transferEventCustody(), ADR-0030, ADR-0042 (+10 more)

### Community 220 - "Title assign control"
Cohesion: 0.10
Nodes (21): 1. Executive summary, 2. Must-fix before pilot (the critical set), 3. Permission model — adequacy assessment, 4. Efficiency & performance, 5. Data model & extensibility, 6.1 Collapse the role stack into one audited `memberships` table, 6.2 Introduce a hospital-scoped patient master, 6.3 Metadata-drive the form builder (+13 more)

### Community 222 - "CaseEvent Data Model"
Cohesion: 0.09
Nodes (23): 0073 — Ethics procedure model: admissibility → notice → allegations/findings → hearing → vote → decision → appeal, Consequences, Context, D0 — One generalized engine, ethics as an extension layer (never a fork), D10 — `responses.target_case_participant_id` + assignment-role vocabulary, D11 — SQLSTATE block `HC0J0–HC0J9` (S0 §B) + audit verbs, D12 — E2 owns the `ethics` feature flag, D13 — Respondent targeted-submission door: `can_access_targeted_response` (a respondent files a defense without case read) (+15 more)

### Community 226 - "Email Denormalization on Profiles (M9)"
Cohesion: 0.11
Nodes (17): Authorization server-side and commission-scoped, Checklist Summary, Code Quality Audit, Detailed Findings, Hygiene Audit, INFO-1 — AC1 E2E does not assert the "Coordenação" role badge renders, Migration M9 / ADR 0010 (email denormalization), MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` did not revalidate the detail page (+9 more)

### Community 228 - "Package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 229 - "Page"
Cohesion: 0.11
Nodes (18): 0. Headline (read this first), 1. Is this a population or a floor?, 2. The distinction that collapses most of the closure, 3. The 4-bucket inventory (40 sites), 4. The four answers, 5. Reproducible SQL, 6. For the PO to rule on, A30 — `platform_admin` enumeration (ANALYSIS ONLY — for PO ruling) (+10 more)

### Community 241 - "Loading"
Cohesion: 0.29
Nodes (7): Collision conformance (S0 §E), Commits (branch `pre-pilot-release-s0`), Gate (CLAUDE.md §6) — all ✅, IV2 — Interviews v2 (Sessions + Reporting/Confidentiality) — completed-track record, Open follow-ups (non-blocking, from QA Info), SQLSTATE, What shipped

### Community 242 - "Loading"
Cohesion: 0.08
Nodes (24): 0. Scope at a glance, 1. Design-system translation (doc `mm.css` → platform tokens), 2. Backend workstream (contract-first — lands before FE), 3. Frontend workstream (all on platform tokens/shadcn; Server-first), 4. Notifications workstream (Phase-20 substrate — currently zero doc integration), 5. Sequencing & file ownership, 6. Test plan (Phase Gate §6), 7. Open micro-decisions (resolve at build start; low-stakes) (+16 more)

### Community 243 - "Loading"
Cohesion: 0.10
Nodes (21): 1. PHI isolation (Rule 12), 2. Access-follows-custody RLS, 3. Custody ledger append-only, 4. PHI `.read` auditing, 5. Audit data-minimization (Rule 11), 6. State machine + DEFINER RPCs + search_path, 7. Client/server boundary (P14a-002), 8. Flag-gating + just-culture (+13 more)

### Community 244 - "Loading"
Cohesion: 0.12
Nodes (16): 10. §7.13 closure cross-check — the population is closed, 1. The positive twins — no over-reach (§7.7, the review), 2. The negative — every guard fires `HC0F1`, 3. Close-case flow (item 2) — no legitimate close is caught, 4. `recompute_recommendations` — both directions (item 3), 5. C7 both-layers — the gap is fully closed (item 4), 6. Interview both-layers (U1 ②), 7. OUT rulings spot-checked by execution — no missed leaker (item 5) (+8 more)

### Community 245 - "Loading"
Cohesion: 0.18
Nodes (12): AdmissibilityStatus, CaseDecisionStatus, DecisionRow, emptySummary(), EthicsCaseRow, EthicsDashboardSummary, getEthicsDashboard(), median() (+4 more)

### Community 246 - "Loading"
Cohesion: 0.17
Nodes (12): 1.1 Schema — all new; migration window: next free `20260720…` **after SUP's `…000610`**, 1.2 RPCs (own-row unless noted; **t19**: `revoke all from public` then `grant execute to authenticated, service_role`), 1.3 Event-driven enqueue — wired into existing mutations (backend edits, confirm exact hook points), 1.4 Time-driven scan sources (`compute_due_notifications`) — CAPA + Sign-off + Meeting only, 1.5 Auto-resolve wiring — `app.resolve_notifications_for` called from, 1.6 Flag + types, 1. Backend contract (posted first; `frontend` starts only after the typed stubs land), 2. Frontend surface (starts after §1 stubs land) (+4 more)

### Community 247 - "Loading"
Cohesion: 0.07
Nodes (29): A15·1 — The decision (PO, 2026-07-15), A15·2 — `can_reach_case_on_member_surface` is **UN-RETIRED**, A15 — D11's member arm was a WIDENING. Corrected to `read_case_deliberation`, A16 — The capability lattice is a **partial order**, not a chain, A17 — What A15 fixes elsewhere (no further decisions needed), A18 — Grant door: the exclusion gate, and the Organization User's one surviving arm, A19·1 — Decision (PO), A19 — The confidentiality "ceiling" is a data-destroying trap, not a ceiling (+21 more)

### Community 248 - "Loading"
Cohesion: 0.06
Nodes (67): ADR-0069, metadata, PendingApprovalsPage(), ApprovalDecisionBadge(), ApprovalsPanel(), LockedIdentity, StepConfirm(), StepDocument() (+59 more)

### Community 249 - "Loading"
Cohesion: 0.09
Nodes (18): CaseRow, continuarButton(), customFieldsGroup(), gotoWizard(), gridRows(), IdentifiersRow, NarrativeRow, narrativesFor() (+10 more)

### Community 250 - "Loading"
Cohesion: 0.13
Nodes (25): ConfidentialityDialog(), DeclareConflictDialog(), MemberOption, RecordRecusalDialog(), VisibilityDialog(), CONFIDENTIALITY_LEVEL_LABELS, CONFIDENTIALITY_LEVEL_OPTIONS, CONFLICT_TYPE_OPTIONS (+17 more)

### Community 251 - "Loading"
Cohesion: 0.07
Nodes (40): ADR-0025, CarryForwardPanel(), formatDate(), statusLabel(), ADR-0080, TitleBadge(), ADR-0051, AttendeeForm() (+32 more)

### Community 252 - "Loading"
Cohesion: 0.08
Nodes (23): 10. Recommended V1.5 / V2 Tables, 12. Compact ER Diagram, 13. Bottom-Line Recommendation, 1. Architectural Overview, 2. Recommended Schemas, 5. Multiple-Choice Answer Storage, 6. Repeating Group Answer Storage, 7.1 Form Definition Relationships (+15 more)

### Community 253 - "Loading"
Cohesion: 0.10
Nodes (20): 1. Requirements coverage, 2. Security / RLS, 3. Code quality, 4. XSS / Rule 7, 5. pt-BR and a11y, 6. No patient data / §1 compliance, 7. Hygiene, Audit Details (+12 more)

### Community 254 - "Loading"
Cohesion: 0.05
Nodes (45): CommissionLayout(), ADR-0033, ADR-0061, ADR-0078, AcreditacaoLayout(), DocumentsLayout(), IndicatorsLayout(), buildCards() (+37 more)

### Community 255 - "Loading"
Cohesion: 0.20
Nodes (10): Coupled-group execution order (migrations `20260719000300…`, after D3=`…0000` / D10=`…0200`), Execution rules (the failure mode is a missed literal), Execution status (backend, 2026-07-12), F-cleanup D11 — anglicize Portuguese status-enum internal keys (FULL, 12 enums), FRONTEND / TESTER work list (per enum) — derive authoritatively, then hand off, Locked translation dictionary — ✅ CONFIRMED (backend, 2026-07-12), Open confirmations before G1, PROVEN METHOD (use for G3–G6 — each step earned by a G1/G2 failure) (+2 more)

### Community 256 - "Loading"
Cohesion: 0.06
Nodes (51): metadata, NarrativeEditorPage(), ADR-0033, metadata, PhaseAnswersPage(), ADR-0074, ADR-0085, CaseCorrectionsData (+43 more)

### Community 257 - "Loading"
Cohesion: 0.17
Nodes (6): createMeeting, MEMBERS, seedExpectedAttendees, seedSelectedAttendees, TYPES, updateMeeting

### Community 258 - "Loading"
Cohesion: 0.10
Nodes (24): DerivedConfigPicker(), PickerForm, PickerOption, PickerQuestion, BuilderFields(), COMPARATORS, ControlledState, CreateAction (+16 more)

### Community 259 - "Loading"
Cohesion: 0.10
Nodes (37): metadata, NspCapaPage(), metadata, NspRcaPage(), getCapaEffectiveness(), getCapaPlan(), listCapaActionEvidence(), listCapaActions() (+29 more)

### Community 260 - "Loading"
Cohesion: 0.09
Nodes (27): AssigneeOption, ActionItemRow(), ActionItemsPanel(), isItemOverdue(), STATUS_ORDER, AgendaItemForm(), AgendaPanel(), AgendaRow() (+19 more)

### Community 261 - "Loading"
Cohesion: 0.24
Nodes (9): ADR-0028, AuditIntegrityCheck(), ADR-0051, ADR-0051, verifyAuditChainAction(), VerifyChainState, AUDIT_MESSAGES, AuditChainResult (+1 more)

### Community 262 - "Loading"
Cohesion: 0.19
Nodes (27): SectionSettingsDialog(), addSection(), authorizeCommission(), contextOfItem(), contextOfSection(), contextOfVersion(), deleteBlockLibraryEntry(), deleteDraftVersion() (+19 more)

### Community 263 - "Loading"
Cohesion: 0.03
Nodes (112): ADR-0002, commissionInitials(), CommissionPickerPage(), metadata, ROLE_LABEL, slugifyHeading(), metadata, PhaseResponderPage() (+104 more)

### Community 274 - "phase17-documents.spec.ts"
Cohesion: 0.20
Nodes (9): Findings, INFO, MAJOR, MINOR, QA Review — Form Builder Enhancements (mini-phase), Re-review checklist — all items RESOLVED, Re-review Summary (2026-06-23), Verdict: APPROVED (+1 more)

### Community 275 - "Deploying to DigitalOcean + Coolify (test environment)"
Cohesion: 0.10
Nodes (18): 2.1 — Auth → URL Configuration, 2.2 — JWT signing keys: migrate to asymmetric (the ADR 0009 "prod-auth gap"), 2.3 — Enable the custom access-token hook (the `is_admin` claim), 2.4 — SMTP + email verification (optional at first), Architecture, Deploying to DigitalOcean + Coolify (test environment), Known risks & gotchas, Local vs remote — the day-to-day workflow (+10 more)

### Community 276 - "Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis"
Cohesion: 0.10
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
Cohesion: 0.06
Nodes (28): addMultipleChoice(), addQuestion(), advance(), ariaInvalid(), blockCard(), createForm(), enterWizard(), field() (+20 more)

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
Cohesion: 0.09
Nodes (20): §0 — The FOURTH PHI surface (do not miss): `patient_index`, §A.1 Read predicates — rebind PQS term, delete the `is_multi_org` wrapper, §A.2 Write gates / policies (every `is_pqs_writer` site), §A.3 DEFINER doors / RPCs, §A.4 Flag / assert reversions (the point of the phase), §A.5 Numbering, §A.6 Roster curation RPCs (platform-admin+global → coordinator+per-org), §A.7 Storage + patient_index (+12 more)

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
Cohesion: 0.20
Nodes (10): 1. What shipped, 2. Final gate, 3.1 The MAJOR-3 fix — backend correctly overrode QA's recommendation, 3.2 The coverage-shape gap — why 2523 green assertions missed MAJOR-1, 3.3 The generic leak sweep (lead-directed, brought forward from E2), 3. The QA fix loop — three RLS-leak shapes, found three different ways, 4. Known gaps — **PO-directed 2026-07-14: log for E2, don't act now**, 5. Incidents worth remembering (+2 more)

### Community 295 - "5. Re-render Optimization"
Cohesion: 0.07
Nodes (28): `backend` — Wave 1 (schema + contract) ✅ COMPLETE 2026-07-27, `backend` — Wave 2 (pgTAP keystones) ✅ COMPLETE 2026-07-27, `backend` — Wave 3 (PO rulings) ✅ COMPLETE 2026-07-27, `backend` — Wave 4 (QA r1 remediation) ✅ COMPLETE 2026-07-27, ✅ BUG-AUTHZ-001 — `platform_admin` reaches response-derived content through DEFINER dashboard functions (owner: **AUTHZ**; NOT fixed here — **FIXED 2026-08-03**, `20260903000700`), 🔴 BUG-FF2-001 — the matrix writers were UNREACHABLE from the authoring path (found + fixed), 🔴 BUG-FF2-002 — `publishVersion` swallowed every FF-2 publish error (found + fixed), ✅ BUG-FF2-003 — the "Adicionar bloco" menu overflows the viewport with **no scroll**, so both new Matrix types are UNREACHABLE at 1280×720 · P1 · owner `frontend` · **CLOSED 2026-07-27, re-verified by `tester`** (+20 more)

### Community 296 - "phase7-cases.spec.ts"
Cohesion: 0.13
Nodes (23): CaseAccessPanel(), ExpiryPreset, GrantDialog(), GrantExpiry(), isoDaysFromNow(), isoTomorrow(), LevelOption(), ADR-0033 (+15 more)

### Community 297 - "Question Editor Dialog — Layout Refactor Spec"
Cohesion: 0.12
Nodes (15): 0. What must NOT change (preserve exactly), 1. Dialog shell, 2. Two-column body, 3.1 Progressive disclosure of score + code, 3.2 Row layout (CSS grid), 3.3 Colour (COLOR_OPTION_TYPES only), 3.4 Row actions, 3.5 Add (+7 more)

### Community 298 - "3. Design"
Cohesion: 0.12
Nodes (16): 1. Context (why this change), 2. Decisions locked (D1–D14), 3.1 Core `public.attachments`, 3.2 Triggers, 3.3 Dispatchers (schema `app`, DEFINER), 3.4 Storage, 3.5 RPCs (`public`, DEFINER), 3.6 Fold-in rewire (clean forward migration; DROP the three tables) (+8 more)

### Community 299 - "Per-Area Findings"
Cohesion: 0.12
Nodes (16): 1. RLS & Security, 2. State Machine & Immutability, 3. Quorum, 4. Code Quality & Architecture, 5. UX, A11y & pt-BR, 6. Test Coverage, Findings, INFO-1: Migration comment contradicts ADR on DEFINER bypass (no action required) (+8 more)

### Community 300 - "Checklist Results"
Cohesion: 0.12
Nodes (15): 1. Requirements (Phase 14b–14d Acceptance Criteria), 2. Security / RLS, 3. Code Quality, 4. Audit Trail (Rule 11), 5. UX / Accessibility, 6. Hygiene, BLOCKER-1: `triage_disposition` RPC raises SQLSTATE 42702 at runtime — RESOLVED, BUG-14B-001 Call (+7 more)

### Community 301 - "QA Review — User Registration & Identity Management"
Cohesion: 0.12
Nodes (16): B1 — `profiles_select_self_or_admin`'s shared-commission peer-visibility branch bypasses the `app.is_active()` fold entirely, BLOCKER, Bug Log cross-check, M1 — No test coverage for the explicitly-designed `nsp_coordinator` exclusion from the org directory, M2 — `180_user_registration.sql`'s "SQL status derivation" claim is inaccurate; no such function exists, M3 — Credential/category collisions surface only the generic error, not a field-specific one, M4 — Invite/resend email copy hardcodes "expira em uma hora" outside the config that governs it, MAJOR (+8 more)

### Community 302 - "case-phase-result.spec.ts"
Cohesion: 0.09
Nodes (47): ActionItemSatelliteSections(), ActionItemSatellitesPanel(), ChecklistItem(), ChecklistSection(), REMINDER_TYPE_ORDER, ReminderSection(), SatelliteConfirmDelete(), describeReminder() (+39 more)

### Community 303 - "form-model-normalization.spec.ts"
Cohesion: 0.07
Nodes (33): createForm(), enterWizardByTitle(), openAddBlock(), publishForm(), purge(), signInAs(), ADR-0045, ADR-0092 (+25 more)

### Community 304 - "PHASES.md — Hospital Commission Forms Platform"
Cohesion: 0.03
Nodes (75): react, ScopeOption(), NarrativeStatus, STATUS_META, ADR-0033, ADR-0085, ResultDefDialog(), TagDefDialog() (+67 more)

### Community 305 - "result-actions.ts"
Cohesion: 0.04
Nodes (54): 2 · KEEP LIST — unchanged from v2 (`qa`-verified both directions, 0 over-reach), 3 · INVENTORY BY PATH KIND — v2's §3.1–§3.7 stand, with these v3 edits, 4.1 · C8 — the disproof **holds on its legs; its scope was wrong**, 4 · STRUCTURAL SURFACES, 5.1 · PO / lead rulings open, 5 · CONTRADICTIONS + OPEN RULINGS, 6 · THE AUTHORITATIVE M1 FIX SET, 7.1 · The five live probes (each `ROLLBACK`ed; persistence re-verified = 0 leaked) (+46 more)

### Community 306 - "7. JavaScript Performance"
Cohesion: 0.08
Nodes (24): Acceptance criteria for any follow-up, Audit boundary and method, Auditor's final verdict, Current model — verified catalog snapshot, Decision analysis: one table versus four, Explicit non-goals, Findings and recommendations, I1 — session membership reads should be one authority snapshot (improvement) (+16 more)

### Community 307 - "Quick Reference"
Cohesion: 0.12
Nodes (32): metadata, PrimeiroAcessoPage(), metadata, OrgDocumentsPage(), APPOINT_MESSAGES, appointTechnicalDirector(), appointTechnicalDirectorDeputy(), assignHospitalAdmin() (+24 more)

### Community 308 - "CLAUDE.md — Hospital Commission Forms Platform"
Cohesion: 0.13
Nodes (15): 1. Project Overview, 2. Tech Stack (do not deviate without human approval), 3. Architecture Rules (index), 4. Agent Team, 5. Phased Development Plan, 6. Phase Gate (mandatory, in order), 7. Progress Tracking, 8. Conventions & Quality Bar (+7 more)

### Community 309 - "phase11-interviews.spec.ts"
Cohesion: 0.18
Nodes (11): Dimension 1 — Requirements (§R1 acceptance), Dimension 2 — Security / PHI (load-bearing), Dimension 3 — Conformance to R0 ratifications, Dimension 4 — Code quality, Dimension 5 — UX & a11y, Findings, Info, Minor (+3 more)

### Community 310 - "Decision — the locked design"
Cohesion: 0.13
Nodes (15): 1. Linkage key — deterministic, non-reversible keyed hash, 2. Pepper store — a locked-down secrets TABLE `app.app_secrets` (NOT a GUC, NOT Vault), 3. `patient_xref` — a key-only, QPS-only index, 4. Derivation + xref maintenance — ALWAYS-ON triggers (cover RPC writes AND seed inserts), 5. DEFINER doors (each asserts the flag first line), 6. Referral transmission + receiver hint (additive), 7. Audit routing — GLOBAL chain, key-only metadata, 8. Disposal — retain, mark disposed (referrals cascade-only) (+7 more)

### Community 311 - "Action Items Data Model Handoff"
Cohesion: 0.13
Nodes (19): csvField(), GET(), toCsv(), ADR-0020, ADR-0029, RFC-4180, csvField(), GET() (+11 more)

### Community 312 - "README.md"
Cohesion: 0.13
Nodes (14): 1. Tech assumptions, 2. Typography, 3.1 Theme — "Clinical Calm" (the palette used on both screens), 3.3 Review-status accents (stable), 3. Color tokens, 4. Spacing, radii, shape, 6. Shared components, 7. Screen A — Overview (KPI + Table) (+6 more)

### Community 313 - "Action Items Data Model Handoff"
Cohesion: 0.11
Nodes (17): 1. Purpose, 21.1 Open Action Items View, 21.2 Action Item Dashboard View, 21. Recommended Dashboard Views, 22. Recommended Indexes, 27. Example: Simple Action Item, 28. Example: Complex Action Item, 2. Core Architectural Decision (+9 more)

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
Cohesion: 0.08
Nodes (33): TOKEN_STYLES, ColorTokenPicker(), TOKEN_NAME, TOKENS, OutcomeDefDialog(), CHOICE_OPS, CHOICE_TARGET_TYPES, ConditionBuilder() (+25 more)

### Community 320 - "Increment Plan — Case Access Control & "Meus Casos""
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive), 2.2 Predicates / helpers (`app` schema, DEFINER, uid-pure — mirror `can_read_event`), 2.3 RPCs (all gate `case_access`; DEFINER unless noted), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Backend tasks (`backend`) (+6 more)

### Community 321 - "What was verified live (evidence)"
Cohesion: 0.14
Nodes (14): 1. Scope-aware RLS matrix — PASS (the headline result), 2. Guard invariant (Q3/Q4) — PASS, 3. Case-source RPC authority — ADR-0033-D4 **holds** (PASS), 4. Six-consulter expiry (Rule 12 critical) — PASS, 5. Audit (Rule 11) — PASS, 6. Drop completeness — PASS, 7. Frontend (`case-access-panel.tsx`) — PASS, 8. Backend's two beyond-spec decisions — both VALID (PASS) (+6 more)

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
Cohesion: 0.17
Nodes (10): getToken(), insertItem(), openAddBlock(), OptionSpec, rpc(), signInAs(), slug(), startFillResponse() (+2 more)

### Community 327 - "page.tsx"
Cohesion: 0.12
Nodes (14): ChecklistItem, ChecklistRail(), CreateAction, DOC_TYPE_OPTIONS, FIELD_STEP, STEPS, ADR-0081, WizardMode (+6 more)

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
Cohesion: 0.15
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
Cohesion: 0.11
Nodes (19): 10.1 `evaluation_cycle_bed_snapshots`, 10.2 Rationale, 10. Occupancy snapshots, 14. Form assignment and immutable version resolution, 16. “No patient” and denominator semantics, 19. Optional device-level surveillance, 1. Executive summary, 23. Analytics (+11 more)

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
Cohesion: 0.12
Nodes (15): Gate record, Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail, QA findings (Wave 2), Task detail (W2-T0 … W2-T3 + gate), 1. The two DEFINER RPCs' gate parity (the point of this review) — VERIFIED LIVE, 2. P2 INVOKER + RLS — VERIFIED LIVE, 3. `get_feature_flags()` DEFINER — reviewed, no PHI/per-tenant exposure, 4. Cursor safety — MAJOR finding (bounded blast radius, not a BLOCKER) (+7 more)

### Community 343 - "case-access.spec.ts"
Cohesion: 0.20
Nodes (10): INFO (no action required), MAJOR, MAJOR-1 — Seven new non-PHI tables have RLS SELECT policies but no `GRANT` to `authenticated` (Rule 1: inert boundary), MINOR, MINOR-1 — `case_participants_write` (and the catalog `_admin_write` policies) are dead until their write grants land, MINOR-2 — `set_case_patient` compat resolver silently depends on an identifiers row existing, Original review (CHANGES REQUESTED, 2026-07-10), Phase F1 — Case-Participants E0 — QA Review (+2 more)

### Community 344 - "3. Server-Side Performance"
Cohesion: 0.19
Nodes (18): StandardAssessmentDetail, buildChapterRollup(), buildLevelRollups(), computeReadinessRollups(), EvidenceTotals, flattenTree(), GapItem, gapSort() (+10 more)

### Community 345 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.10
Nodes (21): 0072 — Ethics access spine: confidentiality, respondent-exclusion, recusal/COI & the m2 gate release, 7. M2 posture — professional-identity erasure vs CFM-1821/2007 retention (RECOMMENDATION for human sign-off), As-built (2026-07-14 — E1 shipped; this section is authoritative over the design text above where they differ), Consequences, Context, D10 — Release the m2 gate LAST: `case_participants` + `case_types` ON, D1 — One confidentiality taxonomy: `cases.confidentiality_level`, snapshot at create (X-δ), D2 — `can_read_case` gains four terms, **all computed inside the DEFINER over base tables** (R6) (+13 more)

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
Cohesion: 0.10
Nodes (20): `app.copy_response_answers` — adversarial read (item 5), clears, B-1 (MAJOR) — Ruling 2's patient lane has **zero positive coverage anywhere**, B-2 (MAJOR) — The ruling-1 surrogate keystone is missing, Blocking findings, FF-5 — QA review r1 (superseded by r2), i-1 (INFO) — the user lane cannot reference a commission-less admin, i-2 (INFO) — `buildGroupInstances` returns wrong-by-construction stubs, i-3 (INFO) — unstable ordering in the candidate search (+12 more)

### Community 354 - "QA Review — "Sem processo" (process-less cases) · flag `processless_cases`"
Cohesion: 0.18
Nodes (11): 1. Security / RLS (highest priority) — PASS, 2. PHI handling (Rule 12) — PASS, 3. Requirements audit vs ADR 0044 — PASS, 4. Code quality — PASS, 5. Accessibility — PASS, 6. pt-BR / English split — PASS, Findings, MINOR-1 — `create_case` action declares an HC029 constant it can never receive (+3 more)

### Community 355 - "Audit findings"
Cohesion: 0.18
Nodes (11): 1. Requirements (ADR 0043 acceptance bullets), 2. Architecture Rule 3 — zero evaluator drift, 3. RLS / Security, 4. Code quality, 5. Test coverage adequacy, 6. Open risk (non-blocking), 7. Informational observations (not blocking), Audit findings (+3 more)

### Community 356 - "QA Review — Option A: Shared (non-PHI) `action_items` table"
Cohesion: 0.07
Nodes (36): EthicsProcedurePage(), metadata, ADR-0073, ADR-0032, ADR-0033, ADR-0038, ADR-0061, ADR-0073 (+28 more)

### Community 357 - "React Best Practices"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 358 - "Sections"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 359 - "Frontend Design — "Clinical Calm""
Cohesion: 0.20
Nodes (9): 1. Before you build (checklist), 2. Color — semantic tokens (never raw values), 3. Typography, 4. Spacing, radius, layout, 5. Motion system (shared — do not freelance durations/easings), 6. Accessibility (non-negotiable — CLAUDE.md §8), 7. Content & component conventions, 8. Do / Don't (+1 more)

### Community 360 - "backend-state.md — Living Backend Capability Map"
Cohesion: 0.05
Nodes (38): ADR index (decisions that shape the backend), AI — Action-Items Satellites + reminder→N scan arm (2026-07-14; ADR 0050; migrations `20260720000950`–`…000970`; flags `action_items`/`cases_extras` ON), backend-state.md — Living Backend Capability Map, CH — Committee Charters & Cadence (S4, 2026-07-20; ADR 0080; migrations `20260818000000`–`…000200`; flag `charters` seed-ON / prod-OFF) → `main`, Data-access & action modules (Rule 9 — no inline supabase-js in UI), DOC-REDESIGN — Controlled-Document Redesign (Phase 17 v2, 2026-07-21; ADR 0081; migrations `20260819000000`–`…000400`; flag `controlled_docs` unchanged, prod-OFF till pilot) → `main`, DOC-REDESIGN` section)** · prior: **2026-07-17 (`AUTHZ Gate 2` — meeting confidentiality / reserved sessions (Stage C) + F1 referral-predicate split + N1 NSP-arm** [ADR [0078](decisions/0078-authorization-capability-model.md); QA **APPROVED** re-review + human-approved 2026-07-17; **local-only, remote DEFERRED to the pilot reset**]. Migrations `20260803000000`–`20260816000700` (Stage C C8→C7 `…000000`–`20260810…`, F1 `20260811…`, N1 `20260812…`, C5-VOLATILE `20260813…`, G-cleanup `20260814…`, BUG-STAGEC-ACL `20260815000000`, Gate-2 QA fix wave `20260816…`); catalog **146 migration files = 146 registered rows** (verified). **Stage C reserved sessions:** tables `meeting_closed_sessions` / `meeting_closed_session_items` / `meeting_closed_session_item_readers` (all RLS-on; SELECT via `app.can_reach_meeting`); DEFINER **VOLATILE** audited read door `get_reserved_session_items(p_meeting_id)` + writers `open_reserved_session(p_meeting_id)` / `add_reserved_item(p_session_id,p_case_id,p_substance,p_decision,p_withdrawals,p_quorum_met,p_reader_uids uuid[])` — all `prosecdef=t`, ACL `authenticated`+`service_role` only (no PUBLIC/anon); composed-ata tiering via `app._project_meeting_agenda_item` (title/description/discussion_notes masked per capability tier). **C7 org-admin-arm removal (the P0 fix):** every meeting read now gates on **`app.can_reach_meeting(meeting_id, uid)`** (DEFINER STABLE) = `is_member_of_for(commission_of_meeting, uid) AND (meetings.visibility_policy='commission_default' OR attendee)` — **requires commission membership**; policies `meeting_agenda_items_select` / `meeting_cases_select` (adds `AND NOT app.is_case_respondent(case_id, uid)`) / `meeting_closed_sessions_select`; DEFINER doors `get_meeting_agenda_items` / `get_meeting_cases` / `get_reserved_session_items` / `get_case_meeting_links` no longer carry `is_commission_admin_of` (comment-stripped `prosrc`-verified — none). **MAJOR-1:** `meeting_agenda_items.description` joined the substance tier — nulled in `app._project_meeting_agenda_item` unless `read_case_deliberation` on EVERY linked case, and column-level SELECT REVOKED for `authenticated` (`has_column_privilege`=false). **MAJOR-2:** all three reserved tables carry the parent-status lock — `meeting_closed_sessions` via `app.guard_meeting_child_lock` (a direct meeting child), the two subtables via sibling `app.guard_reserved_child_lock` (resolves the meeting through the parent session); both raise `check_violation` (**23514**) when `meetings.status` ∈ {in_signature, signed, distributed, cancelled}. **F1 referral split (D7):** conflated predicate split into DEFINER `app.can_read_referral_metadata` / `can_read_referral_phi` / `can_write_referral_response` / `can_manage_referral_phi_disclosure` / `can_amend_referral_phi_snapshot` (snapshot write re-gated off the read-PHI predicate — read no longer implies write); `set_referral_patient` EXECUTE revoked from `authenticated` (now a private DEFINER helper, ACL `postgres`/`service_role` only), new public door `save_referral_patient` (ACL `authenticated`+`service_role`) delegates to it. **N1 NSP-arm (D8):** in `app._case_caps` the S6 `nsp_referral_touched` arm (`is_pqs_operator_of_for` + a `case_referral` on the case) dropped `read_standard_phi` — an NSP operator keeps `read_case_content`+`read_case_deliberation` on a referral-touched case but its patient-identifier arm now needs an explicit grant (S1 coordinator / S3 manual grant unchanged; event & referral PHI untouched). **G-cleanup:** `app.can_read_case_or_admin` **RETIRED** (byte-equivalent to `can_read_case`; gone from `pg_proc`). **BUG-STAGEC-ACL (`20260815000000`):** `create_meeting_agenda_item` / `link_meeting_case` / `update_meeting_agenda_item` re-REVOKED from PUBLIC + GRANTed `authenticated` (`proacl` = `anon=f, authenticated=t`).) Earlier: **2026-07-16 (`AUTHZ Gate 1 · Stage B` — `case_access → case_access_grants` HARD CUT** [ADR [0078](decisions/0078-authorization-capability-model.md); plan [authorization-capability-model.md](plans/authorization-capability-model.md); QA **APPROVED** [0 P0 · 0 M · 2 minor→post-Gate-1]; human-approved; **local-only, remote DEFERRED to the pilot reset**]. Migration `20260802000000`; SQLSTATEs **HC0F0–HC0F9**. **DROPPED `public.case_access`; the authorization grant store is now `public.case_access_grants`** — capability-per-column (`read_case_content`/`read_case_deliberation`/`read_standard_phi`/`read_restricted_phi`/`write_case_content`) + `max_confidentiality` ranked RESERVED + `source` (only `manual_grant` reachable) + soft-revoke; **own-row-SELECT RLS, NO authenticated DML** (all writes via the DEFINER doors). `grant_case_access` gains `p_read_standard_phi`/`p_read_restricted_phi`; `list_case_access` projects the clearance. **`case_access` feature FLAG RETIRED** (D9 — single authorization path; `assert_/case_access_enabled` gone; `caseAccessEnabled()`→`true`). **Defect ①·2 CLOSED** — PHI is per-column, never inferred from a read/write grant (A16). pgTAP **2981/2981** [`238` +33 · b-mutation 8/8]. Lead-verified equivalence A/B matrix (196 cells → 2 = the intended PHI closure, LOST=0). ⚠ **The `case_access`-table references in the migration log AND ADR index BELOW are HISTORICAL — the live grant store is `case_access_grants`** (MINOR-2 sweep DONE post-Gate-1: the inline *live-surface* references — the R1 gate note, the leak-sweep self-arms, the clearance `max_confidentiality` source, the `case_access`-flag row in the flags table — were repointed to `case_access_grants` / marked RETIRED; the dated migration-log + ADR-index rows are left factual as history of when `case_access` existed)). Earlier: **2026-07-14 (`E1` — **Ethics Access Spine — the m2 gate release** [S3 track; ADR [0072](decisions/0072-ethics-access-spine.md); plan [ethics-e1-access-spine.md](phases/ethics-e1-access-spine.md); QA **APPROVED** after 2 fix rounds [0 B · 0 M · 2 minor→E2]; **local-only, remote deploy DEFERRED to the pilot reset**]. 9 migrations `20260720000980`–`…001070`; SQLSTATEs **HC0E0–HC0E9**; **the ADR-0064 m2 HARD GATE IS RELEASED — `case_participants` + `case_types` flipped ON** (`…001040`); pgTAP **2537/0** [`228_ethics_e1.sql` **125**]. Respondent/recusal hard-deny (evaluated FIRST, before every grant arm) + `cases.visibility_policy`/`confidentiality_level` snapshot + `case_recusals`/`case_conflict_declarations` + 15 DEFINER RPCs + the IV2 fold-in + the document confidentiality ceiling. **⚠ Before adding ANY case-scoped table, read "The three shapes" in the E1 section — a correct `can_read_case` does NOT mean the policies consuming it are.**)**. Earlier: **2026-07-14 (`AI` — **Action-Items Satellites + reminder→N scan arm** [S2 track; ADR [0050](decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md); plan [action-items-satellites.md](plans/action-items-satellites.md); QA **APPROVED** [0 B · 0 M · 1 minor · 3 info]; **local-only, remote deploy DEFERRED to the pilot reset**]. 3 migrations `20260720000950` [3 satellite tables + 8 `committee_*` RPCs] / `…000960` [`list_my_action_items` `visibility_scope`] / `…000970` [BE-6·N reminder→N scan arm]; SQLSTATEs **HC0I0–HC0I2**; flags `action_items`/`cases_extras` ON; pgTAP **2412/0** [`227_action_item_satellites.sql` 70 · `226_notifications.sql` 69, +17 AI-arm]. **3 satellites** on the `action_items` hub — `action_item_reminders` [rules] · `action_item_updates` [append-only feed] · `action_item_checklists` [subtasks] — each ONE SELECT policy reusing `app.can_read_action_item(action_item_id, auth.uid())` **verbatim** [no new predicate/disjunct], **NO authenticated INSERT/UPDATE/DELETE** [8 DEFINER `committee_*` writers — reminders create/update/delete · updates create · checklists create/toggle/update/delete; t19; stakeholder-gated HC0I0–2], audited `app.trg_audit_*` [structural-only diff]. **`list_my_action_items`** widened with `visibility_scope` in BOTH UNION arms. **BE-6·N reminder→N scan arm** [`…000970`]: `compute_due_notifications()` gains an action-item arm — recipient = `coalesce(assigned_to, active owner assignment)` [unassigned⇒nothing], **enqueues only if `app.can_read_action_item(item, recipient)`** [Open #3 — verbatim read predicate reused as the notify gate, closes the `case_restricted`-title leak], terminal-excluded via `action_item_statuses.is_terminal`, milestones reuse `due_soon` [before_due/on_due] / `overdue` [after_due] [NO milestone CHECK change], dedup `action_item:{id}:{milestone}:{date}`, `title`/`body` config-level [item heading + item title — **PHI-free by construction**]; `notifications` `kind`/`entity_type` CHECKs += `'action_item'`; `advance_committee_action_item` terminal branch calls `resolve_notifications_for('action_item', id)` [single choke point — `complete_`+cancel both delegate]. **TS:** `NotificationKind`/`NotificationEntityType` += `action_item`, new **`NotificationSurface`** [3 suppressible surfaces — `action_item` preference-surface **DEFERRED**, opt-in-by-config], `notificationHref('action_item')`→static `/conta/itens-de-acao`. **advance_ rebuild note:** terminal-resolve spliced against the LIVE `pg_get_functiondef` body [source-aware case/meeting authority + swept `is_commission_admin_of`], NOT stale `000706/707` text [a re-copy reverts the `000709000200` commission-admin symbol-sweep → breaks the 187 guard]. **One FE-owned tsc handoff:** `NotificationKind`→`NotificationSurface` swap in `notification-preferences-form.tsx`, routed to `frontend`. Detail → AI section below.) Earlier 2026-07-13 (`S1·N` — **Notifications** [S1 substrate of the Pre-Pilot Release, ADR 0071; scope [ADR 0076](decisions/0076-notifications-pilot-scope.md); plan [notifications-s1.md](plans/notifications-s1.md); review [s1-n-notifications-review.md](reviews/s1-n-notifications-review.md)]; QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR carried fast-follow]; pgTAP **2255/0** [`226_notifications.sql` 52], `notifications.spec.ts` **8/8** [dev + isolated prod-standalone], lint/typecheck 0, Vitest 369; **local-only, remote deploy DEFERRED to the pilot reset**. 4 migrations `20260720000700` [core: 2 tables + engine] / `…000710` [9 event-hook splices] / `…000720` [flag-on] / `…000730` [`list_my_assigned_capa_actions`]; SQLSTATEs **HC0C0/HC0C1**; flag **`notifications`** [21st, ON]. In-app notification center [bell+badge in all shells + commission `AppSidebar`, server-render-on-nav] for **CAPA + Sign-off + Meeting**, actionable-to-me, reminder-only, per-kind reminder toggle [assignments non-suppressible]. **`notifications`** [own-row RLS + **DEFINER-only write door**, NO authenticated INSERT] + **`notification_preferences`** [own-row]; sole write door **`app.enqueue_notification`** [idempotent `(user_id,dedup_key)` ON CONFLICT DO NOTHING, prefs-aware], auto-resolve **`app.resolve_notifications_for`** [reminders only; from CAPA-close/signoff-sign/meeting-conclude]; time-driven **`compute_due_notifications()`** [DEFINER, service_role-only; schedule wired at deploy, pg_cron default]; read RPCs `mark_notification_read` [HC0C1] / `mark_all_notifications_read` / `set_notification_preferences` [HC0C0]. **Rule-12 bodies PHI-free by construction** [config-level snapshot only; QA-traced every enqueue site]; **outside the Rule-11 audit trail** by design [own-data; source events already audited]. **BUG-N-001** [a CAPA action assignable to ANY profile but the only CAPA view is PQS-gated ⇒ a non-PQS assignee had no reachable surface + dead `'#'` href] closed via new global **`/conta/itens-de-acao`** [non-gated personal page under the `requireUser`-gated `/conta` shell] backed by DEFINER self-scoped **`list_my_assigned_capa_actions()`** [config-cols only, PHI-free]; `notificationHref('capa_action')`→that static route [removed the per-recipient RLS lookup that dead-linked]; assignee advances via existing `advance_capa_action` [no PQS gate on the assignee branch]. **BUG-N-002** [auto-resolved reminders stayed visible] fixed via `resolved_at IS NULL` filter in `listNotifications`/`getUnreadCount`. **BUG-N-003** [prefs `<fieldset disabled>` stole keyboard focus] fixed via per-surface in-flight guard. `e2e:prod` oracle GATE RED 632p/31f triaged 31/31 to documented baseline + env-flake [notifications 8/8 isolated-prod-green; spliced-mutation reds = general dialog-close-timing baseline, provably non-N — AC1 conclude-happy-path passes while non-N Cancelar/Reabrir fail identically; ZERO splice-error signatures]. Detail → [notifications-s1.md](plans/notifications-s1.md) + [review](reviews/s1-n-notifications-review.md) + N section below.) Earlier 2026-07-13 (`S1·SUP` — **Supersession correction** [S1 substrate of the Pre-Pilot Release, ADR 0071; plan [supersession-correction.md](plans/supersession-correction.md); model [ADR 0074](decisions/0074-supersession-correction-model.md); review [s1-sup-supersession-review.md](reviews/s1-sup-supersession-review.md)]; QA **APPROVED** [1 BLOCKER **BUG-SUP-002** found+fixed · 0 MAJOR]; pgTAP **2203/0** [`225_supersession.sql` 41], SUP E2E 5/5 + phase8-dashboard regression 24/24 byte-for-byte, lint 0, typecheck clean [after `rm -rf .next`], Vitest 364; **local-only, remote deploy DEFERRED to the pilot reset**. 2 migrations `20260720000600` (core) + `…000610` (flag ON); SQLSTATEs **HC0H0–HC0H5**; flag **`response_correction`** [20th flag, seeded ON local/E2E]. A submitted **standalone** response (`case_phase_id IS NULL`) gets a controlled correction path: a new `in_progress` **successor** supersedes the predecessor via **`responses.supersedes_id`** [self-FK `on delete restrict`; NULL for every ordinary response] + partial-unique **`responses_one_successor_per_superseded`** [≤1 live successor/chain]. **`public.supersede_response(uuid,text)` DEFINER RPC** — authority `is_staff_admin_of OR is_commission_admin_of` [O-3]; pre-populates the successor's `answers` + `answer_selected_options` from the predecessor [O-1]; emits **`response.superseded`** audit (payload `successor_id` only — free-text reason removed from the un-erasable chain by `20260826000000`, Rule 11/LGPD; reason stays mandatory HC0H3, validated-only); t19 grants; preconditions **HC0H0–HC0H5** [H5 = the pre-existing one-`in_progress`-draft-per-user/version invariant, **BUG-SUP-001** discriminated]. **`app.guard_supersession_coherent()`** BEFORE INS/UPD trigger — coherence (successor shares predecessor `form_version_id`+`commission_id`, HC0H4) + standalone/submitted shape (HC0H1); **AND (BUG-SUP-002 close) when `supersedes_id IS NOT NULL` AND `auth.uid() IS NOT NULL` [real session; service-role/NULL exempt per ADR 0075] it also enforces the FLAG (`assert_response_correction_enabled`→check_violation) + the SAME AUTHORITY (`is_staff_admin_of OR is_commission_admin_of`→42501)** on the direct-INSERT and INSERT-then-UPDATE `responses` write paths — closing the RPC-bypass hole (`responses` has `GRANT ALL … authenticated` + member `responses_insert_own`; the RPC alone was NOT the only write path — Architecture Rule 1). `app.assert_response_correction_enabled()`. **Aggregation retrofit (single choke-point):** `app.submitted_form_responses` gains a `NOT EXISTS` submitted-successor exclusion ⇒ propagates to EVERY dashboard RPC + Phase-15 derived-indicator path; `public.commission_overview` gains the SAME predicate in **both** sub-selects, built on the **POST-MEM** (memberships-scoped) body from `…000300`. Shipped UNCONDITIONALLY (inert until a successor exists — phase8-dashboard 24/24 byte-for-byte). **TS:** `feature-flags.ts` +`response_correction`/`responseCorrectionEnabled`; `submissions.ts` `SubmissionDetail`/`SubmissionRow` += `supersedesId`/`supersededById`/`badge`/`canCorrect` [server-computed] + `resolveSupersessionBadge` + one batched keyset-safe `.in('supersedes_id',…)` lookup; `responses/actions.ts` `supersedeResponseAction {ok,error?,successorId?}` [HC0H0–HC0H5→pt-BR]; `dashboard.ts` **`isDashboardCountable`** TS twin of the SQL predicate (+Vitest). **UI:** `supersession-badge.tsx` [`substituído`/`atual`, icon+text never color-only], `correct-submission-button.tsx` ["Corrigir envio", `canCorrect`-gated, Dialog + required labeled "Motivo da correção", `useTransition`+synchronous `router.push` into the successor wizard], submission detail page + `submission-row.tsx` render badges. **PHI-free** (Rule 12 N/A — standalone non-PHI responses). Detail → plan + review. Also this session (NOT SUP): **gate false-green fix** `scripts/e2e-prod-gate.sh` [`num` parses anchored summary lines from the WHOLE batch log, not `tail -5` — the `N failed` header was dropped by trailing flaky entries → false `GATE GREEN`; memory `e2e-prod-gate-tail5-false-green`]; the honest gate then exposed **31 pre-existing NON-SUP failures suite-wide** [~2/3 a systemic toast/`[role=status]`-not-visible mode; clustered phase3-admin-members 7 / phase10-meetings 6 / phase11-interviews 3] → separate **suite-health track** to classify real-vs-flaky.) Earlier 2026-07-13 (`S1·MEM` — **Memberships collapse** [S1 substrate of the Pre-Pilot Release, ADR 0071; plan [memberships-collapse-s6-1.md](plans/memberships-collapse-s6-1.md); write-path split [ADR 0075](decisions/0075-memberships-collapse-write-path-split.md)]; QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR cleared at Record]; pgTAP **2161/0** [`224_memberships_collapse.sql` 64], lint 0, typecheck clean, full E2E **586p/0f/8flaky**; **structural — NO feature flag**; **local-only, remote deploy DEFERRED to the pilot reset**. 6 migrations `20260720000000`–`…000500`; SQLSTATEs **HC0G0–HC0G9**. The three role tables `organization_members`/`commission_members`/`pqs_members` collapse into ONE **`public.memberships`** (dialect-1 column-per-scope `organization_id`/`hospital_id`/`commission_id` + discriminated shape CHECK per role; `principal_id`→profiles, `granted_by`→profiles; 5 indexes incl. `nulls not distinct` grant-unique `memberships_grant_uq` + `memberships_title_idx`; **SELECT-only RLS, ZERO `authenticated` DML grant** — WS-1 lockdown posture). **Writes** flow through ONE `grant_role`/`revoke_role` **SECURITY DEFINER** door (+10 back-compat shims — `assign/revoke_org_admin`, `assign/revoke_hospital_admin`, `assign/revoke_nsp_*`, `add_pqs_member`→**void** per O-5, …; `app._deny_self_grant` stays 42501; **HC0G1** last-admin anti-lockout). **Reads** flow through ONE `app.has_role(scope_type,scope_id,role,user_id)` family (+`has_role_any` + a 3-arg overload) behind **27 unchanged `is_*_of`/`_for` wrappers** — ~145 call-sites (56 procs + 87 policies + 16 bespoke read fns) compile verbatim, incl. the once-missed `is_entitled_document_approver`. **Audit HARD-CUT** (product-owner decision — clean on the pilot's fresh reset, no display aliases): blanket `trg_audit_memberships` emits unified **`membership.granted`/`membership.role_changed`/`membership.revoked`** (pt-BR "Função concedida/alterada/revogada") on ANY write path; the legacy `commission_member.*`/`organization_member.*`/`pqs_member.*` verbs are **retired** from `AuditAction`/`AUDIT_ACTION_LABELS` (`queries/audit.ts`) + `audit-icon.tsx` entity-key. **ADR 0075 write-path split:** service-role writers (`createAdminClient()`, `auth.uid()`=NULL) keep DIRECT RLS-exempt `memberships` writes (TS-authorized, still audited by the blanket trigger); RLS-scoped cookie-client writers (`removeStaff`/`removeStaffAdmin`, O-2) route through the door where `auth.uid()` resolves. **Invariant:** `authenticated` has NO direct DML grant ⇒ any crafted client write → 401/403. **CASCADE fix** (`…000500`): `DROP TABLE commission_members CASCADE` silently dropped two `profiles` SELECT policies carrying raw `commission_members` joins; recreated byte-for-byte repointed to `memberships` (the only two victims — all other membership-referencing RLS uses `is_*` wrappers, which were repointed in place). **BUG-MEM-001** (tester-found BLOCKER, fixed): the new `granted_by→profiles` FK made unqualified `profiles(...)` embeds ambiguous (PGRST201) → `listMembers`/`listCommissionsForAdmin` qualified to `profiles!memberships_principal_id_fkey(...)` + added the missing `{error}` throws (was silent-empty roster). Types regen. `seed.sql` re-expressed for `memberships` (33 grants; CCIH = 9). QA minors cleared at Record: **m1** grant/revoke `is_admin()` asymmetry documented (ADR 0075 — intentional safe narrowing, revoke is the narrowing direction), **m2** `is_pqs_operator_of` InitPlan `(select auth.uid())` wrap, **m3** `224` §7 3 smoke asserts → 6 TRUE/FALSE truth pairs (61→64). Detail → [memberships-collapse-s6-1.md](plans/memberships-collapse-s6-1.md) + [memberships-collapse-review.md](reviews/memberships-collapse-review.md).) Earlier 2026-07-12 (`f-cleanup` — **F-cleanup residual DB-hardening** [D3+D10+D8+D11]; QA APPROVED [0B/0M/2m/3i], Minor-1 closed; pgTAP **2100** [86 files/0 fail], full E2E all 51 specs green; **local-only, remote deploy DEFERRED to the pilot reset**. ADRs [0068](decisions/0068-result-engine-fk-junctions.md)/[0069](decisions/0069-status-key-anglicization.md); migrations `20260719000000`–`…000800`. **D3** (result-engine jsonb/array→FK junctions, D3-mid): new `process_template_phase_allowed_results` + `process_template_phase_offered_results` (FK-integrity shadow = allowed∪ruleset∪default) + `case_phase_allowed_results` (RLS from creation; helpers `commission_of_template_phase`/`case_of_case_phase`/`recompute_template_phase_offered_results`); `result_ruleset` stays jsonb (`compute_case_phase_result` UNCHANGED, Rule 3), `blocks` stays integer[]; RPC signatures UNCHANGED (decompose jsonb→junction internally; query re-aggregates to `allowedResultIds:string[]` ⇒ **zero frontend change**); dropped `{process_template_phases,case_phases}.allowed_result_ids`+CHECKs; the emits⇒no-allowed invariant re-enforced in the RPCs+snapshot = new errcode **HC067**. **D10** generic `app.touch_updated_at` + `updated_at` col/trigger on `cases`/`commissions`/`forms` (metadata, unaudited). **D8** no schema change; pgTAP FK-lock on the two Phase-15 indicator FKs. **D11** anglicized ALL 12 status-enum internal keys → English (1:1, semantics identical; keys in CHECKs/defaults/fn-bodies/seed/fixtures/TS-unions/label-map-keys; pt-BR label VALUES kept — Rule 10): `indicators`/`meeting_attendees.attendance`/`case_narratives`/`indicator_measurements`/`capa_action`/`case_interviews`/`capa_plan`/`controlled_documents(+_versions)`/`case_referral`/`meetings`/`cases`/`case_phases` (`indicator_measurements` RPC output cols na_meta/fora_da_meta/sem_dados→on_target/off_target/no_data, `queries/indicators.ts` updated). Detail → [f-cleanup.md](plans/f-cleanup.md)/[f-cleanup-d11.md](plans/f-cleanup-d11.md).). Earlier 2026-07-11 (`feat/pre-pilot-foundations-plan` — **F2 Centralized Attachments** (ADR 0063/0065, formerly phase-14e); QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR · 4 INFO], MINOR/INFO fast-follow cleared at Record; 6 migrations `20260717000000`–`…000500`; flag `attachments` seeded OFF (`seed.sql` enables local/E2E), **remote deploy DEFERRED to the pilot**. Single polymorphic `attachments` table (owner-dispatch `(owner_type, owner_id)` no-FK, **dialect 2** — the platform's first) superseding the case_documents / meeting / interview file tables, + `attachment_references` / `attachment_subjects` (→ F1 `participants`, dialect 3) / `case_interview_links`; two buckets — `attachments` (standard, authenticated owner-dispatch SELECT) + `attachments-phi` (**NO authenticated SELECT — the hard PHI door**); audited `open_attachment` door (service-role signed URL, exactly one `attachment.read` per allowed phi open, NULL-out-of-scope) the SOLE phi-blob read path; owner-dispatch `commission_of_attachment` / `can_read_attachment` / `can_write_attachment` (explicit `p_uid` `_for` variants; **interview arm case-scoped via `can_read_case`**); fold-in dropped the 3 legacy tables + repointed `rca_evidence` (RESTRICT) / `referral_shared_item` (SET NULL) FKs; `dispose_case_phi` composes attachment PHI disposal (D10 seam + legal-hold skip); SQLSTATEs **HC096/HC097/HC098**. pgTAP `208_attachments.sql` 50/50 → full **1957** PASS; tsc/lint 0. Detail → F2 section below + [ADR 0063](decisions/0063-centralized-attachments-substrate.md) / [phase-14e](phases/phase-14e-attachment-phi-classification.md).) Earlier 2026-07-10 (`feat/pre-pilot-foundations-plan` — **F1 Case-Participants E0**; ADR 0064/0066; migrations `20260716000000`–`…000200`; flags `case_participants`/`case_types` seeded OFF (m2 hard gate); participants dialect-3 registry + subtype composite-FK pins (R5) + `case_patient → patient_identifiers` N-per-case re-key + `cases.organization_id` (R2) + `patient_xref` participant grain (ADR 0066/R3) + Class-2 `professional_profiles` (audited reads, no single door) + generalized `dispose_case_phi`; SQLSTATEs HC094/HC095; new audit verb `professional_profile.read`. Full pgTAP suite green (151/152/207 + re-keyed 171/191/197); tsc/lint 0; **remote deploy DEFERRED to pilot**. Detail → F1 section below + [ADR 0064](decisions/0064-case-subject-generalization-participants.md)/[0066](decisions/0066-patient-xref-participant-rekey.md).) Earlier 2026-07-08 (`feat/administrativo-role` — **Administrativo delegated-capability role**; ADR 0061; QA APPROVED [0 BLOCKER/0 MAJOR/0 MINOR · 3 INFO]; pgTAP **50/50**, feature E2E **10/10** + full regr 574 pass (0 reg); merged → `main` `1010f07` (4 migrations `20260714000000`–`…000300` local-only, **remote deploy DEFERRED**). A coordinator may appoint any staff member as an **"Administrativo"** and grant a curated, finite capability menu (`schedule_meetings`/`create_cases`/`assign_case_phases`/`view_signoffs`) — no new role enum, decoupled from the display-only "Secretário" title; flag `administrativo` seeded OFF. **New objects:** `commission_administrativos` + `commission_administrativo_capabilities` (SELECT-only DEFINER-door tables, audited); `app.member_can` (flag-aware kill switch, OR-composed ONLY into specific guarded DEFINER doors — never into the `cases`/`case_phases` `FOR ALL` write policies); `app._grant_case_access_unchecked`. **Widened surfaces:** `create_case`/`create_case_from_template` (`create_cases`), `create_meeting` (`schedule_meetings`), `activate_phase`/`reassign_phase` (`assign_case_phases`), `list_signoff_queue`/`get_response_for_signoff` (`view_signoffs`), `list_cases_board` (any capability, filtered to `can_read_case`). New RPCs `appoint_administrativo`/`revoke_administrativo`/`grant_member_capability`/`revoke_member_capability`/`update_case_meta` (label/department only, blocks terminal — HC025). Escalation closed by construction (`is_staff_admin_of OR is_commission_admin_of` + `app._deny_self_grant` — a holder can never appoint/grant). **Design note:** phase-assignment / non-coordinator case-creation grant the recipient `case_access` **READ only** (a same-day product-owner revert from an initial write-grant design) — the coordinator's explicit `grant_case_access` stays the sole case-content-write path. Detail → [administrativo.md](progress/administrativo.md). Earlier 2026-07-06 (`feat/phase-17-controlled-documents` — Phase 17 **Controlled-Document Lifecycle** [Gestão de Documentos Controlados]; ADR 0057; QA APPROVED [0 BLOCKER/0 MAJOR · 3 MINOR cleared · 4 INFO]; pgTAP **47/47** [full 1717], phase E2E **14/14**, full `--workers=1` regr **588p** [0 Phase-17 reg]; **remote deploy DEFERRED to the pilot**. Migrations `20260713000000`–`…000400`. Three tables `controlled_documents`→`controlled_document_versions`→`document_approvals` [version-level status `rascunho→em_aprovacao→vigente→obsoleto`; per-commission `DOC-####` mint; flag `controlled_docs` seeded OFF→ON `…000400`]; RLS **posture (b)** member-READ + **version-scoped approver-read arm** [a pending/decided `document_approvals` row grants scoped read of just that doc/version; **RLS cross-referential recursion fixed via 3 SECURITY DEFINER helpers** `is_document_approver_of`/`is_document_version_approver`/`can_read_document_of_version`, owner=postgres, search_path-pinned]; immutable **`controlled-documents` bucket** [25 MB, private, INSERT+SELECT only — Rule 6, new path per version]; ~9 lifecycle RPCs + `set_document_version_file` [DEFINER-only writes; sign-own-row + per-signer `signature_hash`=sha256(path‖approver‖decision); submit=delete-then-insert the approver set; state-machine **HC089**, all-must-approve **HC090**, entitlement **HC091**, dup **HC092**, frozen-set **HC093**]; DEFINER reads `documents_due_for_review`/`hospital_document_register`/`list_approver_candidates` [PHI-free/min-necessary, foreign→empty, t19 REVOKE→GRANT]; **forms-as-controlled-docs** metadata [`form_versions` += `approved_by/at`/`effective_date`/`review_due_date`, captured INSIDE `publish_form_version` — pure pass-through, **`guard_published_version` UNTOUCHED** so settable only via the RPC]; audit AFTER-triggers strict allow-list [never title/summary/note/storage_path]. Shared `src/lib/documents/version-select.ts` [`selectWorkingDraft`/`selectSignableVersion`/`findMyApprovalForVersion`] consumed by both detail pages. PHI-free by design [Rule 12 N/A]. MINORs cleared at Record: reject purges pending siblings (pgTAP §10), editar→404, overdue UTC-aligned. Detail → [phase-17.md](progress/phase-17.md). Earlier 2026-07-06 (`phase-15-indicators` — Phase 15 **Quality Indicators**; branch `feat/phase-15-indicators` → merged to `main` (local; origin not pushed); ADR 0057/0058; QA APPROVED [3 MINOR fixed pre-merge]; E2E `phase15-indicators` **12/12** prod-standalone; **remote deploy DEFERRED to the pilot**. Migrations `20260712000000`–`…000300` (+ B7 `4736e02`). New tables `indicators` + `indicator_measurements` (per-commission `IND-%04d` mint; flag `quality_indicators` seeded then flipped **ON**); RLS **posture (b)** — member-READ SELECT policy + grant, **NO direct write** (every write via DEFINER RPC, authority `is_staff_admin_of OR is_commission_admin_of`); audit AFTER-triggers (non-sensitive allow-list, never free-text). Three data sources manual/derivado/hibrido; **derived == Phase-8 dashboard aggregate by construction** (parity lock vs `dashboard_distributions`, ADR 0058) via option `code`s + `answers.value_number`; **manual `taxa` allowed** (2 one-way CHECKs, not a biconditional). **Two-tier CAPA hook:** FKs `capa_plan.source_indicator_id` + `capa_measure.indicator_id`; `open_capa_plan` indicator arm derives `hospital_id` from the commission; `can_read_capa` indicator arm (commission members read); **`can_write_capa` UNTOUCHED** (WS-3c). B7 shared-hub `createManualActionItem` (non-operator fallback) + `hospitalId` on `Indicator`. SQLSTATEs **HC084–HC088**. MINOR-1 fix added a shared `PeriodWindowFields` (`periodStart`/`periodEnd`) so derived/hybrid measurements are period-scoped. Detail → [phase-15.md](progress/phase-15.md). Earlier 2026-07-05 (`pre-pilot-hardening` — **Wave 2 (WS-6 perf sweep)** of the pre-pilot DB hardening program; branch `feat/pre-pilot-hardening`; QA APPROVED [Sonnet, live-verified]; **deployed to remote via `supabase db reset --linked` 2026-07-05**; detail → [pre-pilot-hardening-wave2.md](progress/pre-pilot-hardening-wave2.md)). Migration `20260711000900_perf_sweep_wave2.sql` (additive; P8 was already in Wave 1). **P2** NEW `list_audit_filter_actors(p_commission)` — `SELECT DISTINCT ON (actor_id)` **SECURITY INVOKER** (audit_log RLS is the authority; replaces a full-table fetch-and-dedup in `audit.ts`); no foreign-commission actor leak (QA live-verified). **P3 keyset (cursor) pagination:** new `src/lib/types/pagination.ts` — `Page<T>={rows,nextCursor}` + `PageParams{cursor?,limit?}`, `DEFAULT_PAGE_SIZE=25`, opaque base64url cursor via `encodeCursor`/`decodeCursor`; the 5 list queries (`listSubmissions`/`listCommissionReferrals`/`listMeetings`/`listCasesBoard`/`pqsInbox`) now return `Page<T>`. `pqs_inbox` gained keyset params `(p_cursor_reported_at,p_cursor_id,p_limit)` order `(reported_at DESC,id DESC)` — **operator-hospital gate byte-for-byte unchanged** from `…000710` (ADR 0052; QA live-verified foreign-hospital caller sees nothing); binds cursor values as **typed RPC params** (injection-safe by construction). `list_cases_board` gained `p_limit` only — **CAPPED @200, NOT cursored** (kanban column-per-status can't page a flat cursor; `nextCursor` always null). +5 keyset composite indexes. **Cursor injection hardening (QA MAJOR):** the 3 flat-list sites (`submissions`/`meetings`/`referrals`) that interpolate cursor fields into a raw PostgREST `.or()` string now route through `decodeCursor(cursor, schema)` — each field strictly validated as ISO-timestamp / UUID (forms that structurally exclude `,()`), any tampered field → cursor rejected → page 1; Vitest lock `src/lib/types/pagination.test.ts`. **P4** NEW `get_feature_flags()` **SECURITY DEFINER** returns all `app.feature_flags` as one jsonb; `src/lib/queries/feature-flags.ts` `getFeatureFlags = cache(...)` (request-memoized) with 13 per-flag `*Enabled()` wrappers delegating to it (scattered across `queries/*`, `case-access/actions`, `case-narratives/actions`, `meetings/actions` — behavior-preserving; the layout's 7 flag round-trips collapse to **1/request** automatically). NEW `count_open_cases_for_board(p_commission)` **SECURITY DEFINER** — reproduces the board's EXACT `is_staff_admin_of` visibility (a direct `cases` RLS count would diverge; QA verified parity 29==29 / 0 for a foreign staff_admin) — drives the sidebar "Casos" badge (`countOpenCasesForBoard` in `cases.ts`); the other 4 layout badges (myPhases/myCases/signoffQueue/pendingSignatures) left user-scoped-counted by design; the triage workstation is capped (`TRIAGE_QUEUE_CAP=200`, no control) so its topbar counts stay full-backlog-accurate. **P5** `listSubmissions` form filter pushed server-side (`.eq('form_versions.form_id',…)` on the `!inner` version embed; the client-side `.filter` + wrong "not filterable" comment removed). All 4 new/changed functions carry per-object `REVOKE…FROM public` + `GRANT EXECUTE…authenticated,service_role` (C-2 posture). pgTAP `199` (28 assn) → full ordered **66 files/1644 PASS**; Vitest **206**; E2E `perf-sweep-wave2.spec.ts` **13/13** (dev+prod); full regr **546p/16f** (0 Wave-2 reg — 16 = AIF-001 baseline). Types regen. Wave-2 commit `a2a7fab`. **— Earlier same day (`pre-pilot-hardening` — **Wave 1**; ADRs 0053–0056; QA APPROVED [Opus, live-verified]; deployed via `db reset --linked`; detail → [pre-pilot-hardening-wave1.md](progress/pre-pilot-hardening-wave1.md)). Structural hardening of the 2026-07 external DB audit's critical set + do-now data-model/perf; 8 migrations `20260711000000`–`…000800`, pgTAP `190`–`198`. **WS-1 (C-3/H-6/H-7) membership write lockdown:** dropped the `organization_members` write policy + `pqs_members_curator_all`; **REVOKE insert/update/delete from `authenticated`** on both (`organization_members` = SELECT-policy-only; `pqs_members` = **zero-policy DEFINER-door**); every grant now flows through guarded DEFINER RPCs — NEW `assign_org_admin`/`revoke_org_admin` (shared `app._deny_self_grant`; **HC081** last-org_admin anti-lockout: `count(*) filter (role='org_admin' and hospital_id is null) <= 1`), patched `add_pqs_member` self-check; blanket AFTER audit triggers `trg_audit_organization_members`/`trg_audit_pqs_members` emit `organization_member.*`/`pqs_member.*` on **any** write path (incl. the service-role provisioning door). **WS-2 grant hardening:** **C-1** REVOKE insert/update/delete/TRUNCATE on `audit_log` from `authenticated` + statement-level `app.guard_audit_truncate` (**HC042**, GUC-gated on `app.allow_audit_teardown` — fixture-teardown-only, unreachable in prod; row DELETE/UPDATE immutability guard untouched); **C-2** flipped `ALTER DEFAULT PRIVILEGES … GRANT ALL … authenticated` → revoke-default + grant-per-object (**⚠ applies to `postgres`-owned objects, the migration path — a table must be CREATEd as `postgres` for the revoke-default posture to apply**; QA INFO-4); **C-4** entitlement guard `app._audit_access_authorized(action, entity_id, commission)` inside `log_audit_access` — dispatches each allow-listed action to the entity's own `can_read_*` (14 arms, fail-closed ELSE + allow-list⊆dispatch completeness pgTAP), closing cross-tenant who-read-what forgery. **WS-3a (C-5):** `answers.form_version_id NOT NULL` (BEFORE-INSERT `derive_answer_version` from the response) + FK-referenceable `form_items_id_version_key_uq` + 3-col FK `answers(item_id, form_version_id, question_key) → form_items(...)` (forces item∈version AND key-is-real); Rule 3 golden byte-for-byte. **WS-3b:** D1 six delete-path FKs SET NULL→**RESTRICT**; **D2 tenant composite FK** `commissions(hospital_id,organization_id) → hospitals(id,organization_id)` + `hospitals_id_org_uq` + `guard_hospital_org_repoint` (**HC082**) — **keeps BOTH** the single-col FK (ON DELETE RESTRICT) and the composite (ADR 0054); D6-flip `form_items_input_vs_display` `ELSE false`; **D7 dual-scope NSP vocab** (`pqs_event_types`/`pqs_sentinel_criteria` `hospital_id` nullable + partial uniques; 8 CRUD RPCs re-gated `app.can_curate_pqs_vocab(p_hospital_id)` = **global(NULL)→is_admin, hospital→is_pqs_operator_of**; `save_triage` reads global ∪ event-hospital); D9 responses/cases/case_referral lifecycle CHECKs. **WS-3c (D4/H-8/P8):** `capa_plan.hospital_id NOT NULL` (`derive_capa_hospital` from event/rca/meeting); `can_write_capa` COLLAPSED to `is_pqs_operator_of_for(hospital_id)` (closes cross-hospital write hole); `mint_capa_code` per-hospital + UNIQUE flipped `(code)`→`(hospital_id, code)`; `open_capa_plan` +`p_hospital_id` (**HC083** multi-hospital); latent `can_read_capa` manual-CAPA-invisible bug fixed (resolve via `hospital_id` too). **WS-4 (C-6):** `dispose_case_phi` completed (case-phase `answers` DELETED — `case_phases.result_id` survives; + redact `case_interviews.summary_md`/`case_interview_subjects.note`/`cases.label`/`case_documents.*`/`meeting_cases.*`/`case_events.title`); `dispose_event_phi`/`dispose_referral_phi` gap-fills; NEW **`dispose_meeting_minutes`** (decoupled, coordinator-gated, `meetings.phi_disposed_*`, **HC056**, `meeting_minutes.disposed` audit); `get_referral_detail` hides `frozen_storage_path` AND `decline_note` from non-PHI readers; **Storage kept (Rule 6), erasure claim NARROWED (ADR 0056)** — DB-side PHI erased, blobs retained encrypted under 20-yr retention. **WS-5 perf:** +2 P9 indexes (`organization_members(user_id,role,hospital_id)`, partial `audit_log(hospital_id,occurred_at DESC)`) + 9 hot-policy `auth.uid()`→`(select auth.uid())` **InitPlan wraps** (meaning-preserving; RLS suites are the proof); +5 P10 FK indexes; **P1** `getSessionContext` React `cache()`-wrapped (`src/lib/queries/session.ts`). **Gate fix (`68b393b`):** `listHospitalsForOrg` (`src/lib/queries/org.ts`) embed pinned to `commissions!commissions_hospital_id_fkey(count)` — the D2 composite FK made the un-hinted `commissions(count)` embed ambiguous (PGRST201); the pin disambiguates (feeds hospitais + comissoes + usuarios selectors). **DEFERRED:** D3 (junction normalization), P7 (audit partitioning — time-axis breaks per-chain-seq tamper-evidence; correct axis = chain_key), MINOR-5 (revoke TRUNCATE on the 2 membership tables — latent). pgTAP **Files=65/Tests=1616 PASS**; Vitest 193; tsc/eslint 0; E2E standalone 531p/0-reg. **TS contract:** only `org/actions.ts` (HC081 message), `platform/actions.ts` (onConflict `organization_id,user_id,role,hospital_id`), `queries/session.ts` (`cache()`), `queries/org.ts` (embed pin); types regen (backward-compat). Earlier 2026-07-03 (`nsp-per-hospital` — **Phase B (backend core)**; branch `feat/nsp-per-hospital`; ADR 0052; partially supersedes ADR 0042). **Security-critical re-key of the PQS/NSP roster + EVERY PHI door from per-org → per-HOSPITAL**, plus three net-new surfaces. Migration `20260710000000_nsp_per_hospital.sql` (NOT additive — `pqs_members` PK `(org,user)`→`(hospital,user)`; `pqs_department` keyed `UNIQUE(hospital_id)`; `organization_members` hospital-scope CHECK widened so **`nsp_coordinator` is now hospital-scoped** `hospital_id NOT NULL`; greenfield reseed). **Primitives:** `is_pqs_member_of`/`is_nsp_coordinator_of` re-keyed to hospital; NEW `is_pqs_operator_of(hospital)` = coordinator ∪ member (**decision 12 — the local coordinator is a FULL operator: implicit PHI read + write**); `is_pqs_writer_of = is_pqs_operator_of`; NEW `is_nsp_org_admin_of(org)` (org-level, **ZERO PHI** — appears in NO `can_read_*`/`get_*_patient` door); `is_pqs_operator_in_org(org)` (nav-only); resolution helpers `hospital_of_commission/event/referral/capa_action` (dropped `org_of_event/referral/capa_action`; KEPT `org_of_commission`/`org_of_hospital`). **Doors re-keyed:** 10 read preds (`can_read_event[_patient]`/`can_read_capa`/`can_write_rca`/`event_current_custodian`/`can_read_referral[_phi]`/`can_read_xref_row`/QPS macro-term in `can_read_case[_patient]`) → operator+hospital; **dual-hospital referral reads (decision 14)** — `can_read_referral[_phi]` resolve BOTH endpoint hospitals (source ∪ target); write gates (`can_write_capa` consolidation + `save/confirm/reopen_triage`, `triage_disposition`, `add_rca_member`, `open_capa_plan`, `advance_capa_action_core`, `capa_kpis` result-scoped); DEFINER doors (`pqs_inbox` operator-hospital-scoped, `dispose_event_phi` operator gate, `mint_event_code` per-hospital EV, `patient_xref_count`); patient_index doors (`search_patient_xref`/`patient_access_audit`/`get_patient_trajectory_for_entity`/`patient_trajectory_bundle` `p_org_id`→`p_hospital_id`, **audit at HOSPITAL tier**); storage `capa_evidence_obj_insert_writable` → `hospital_of_event`; `pqs_members` RLS `pqs_members_curator_all` (`nsp_org_admin ∪ coordinator`); org/commission SELECT policies re-broadened per-hospital. **Net-new:** `nsp_org_admin` PHI-FREE aggregate doors `nsp_org_event_rollup`/`nsp_org_capa_rollup`/`nsp_org_roster`/`is_nsp_org_admin_of_self` (per-hospital counts/status/staff only — **provably no PHI/code/title/narrative column**, qa keystone; result set scoped to org's hospitals, M3); three-tier appointment chain `assign_nsp_coordinator`/`revoke_nsp_coordinator` (DEFINER, `is_nsp_org_admin_of`-gated, no self-delegation — decision 3: hospital_admin has NO NSP power); roster/config RPCs `add/remove/list_pqs_members`+`set_pqs_rca_due_window`(hospital) re-gated `nsp_org_admin ∪ coordinator` (rca-window audit at hospital tier); `list_my_nsp_hospitals()` (NSP switcher), `list_hospital_eligible_users_for_pqs(hospital)` + `list_org_eligible_users(org)` (org-wide picker, `org_admin ∪ nsp_org_admin`); `dispose_referral_phi(referral, reason)` — LGPD erasure mirroring `dispose_event_phi` (dual-hospital gate: `is_admin ∪ source-commission-admin ∪ EITHER-endpoint operator; deletes `referral_patient` + redacts/nulls the FULL PHI graph — `case_referral.subject/description_md/decline_note`, `referral_reply.result_md`, `referral_shared_item.frozen_title/body` (redact, shape-CHECK-safe); keeps ENC code + provenance; hospital-tier audit; `case_referral` gains `phi_disposed_*`). **t19 guard:** all recreated `public.*` RPCs `REVOKE ALL FROM PUBLIC` + `GRANT authenticated,service_role` (DROP+recreate reset grants). **Catalog sweep** in-migration asserts ZERO residual `org_of_event/referral/capa_action` + `pqs_members…organization_id` (ADR 0042 M2). **TS contract:** `queries/pqs.ts` (`isPqsMemberOfHospital`/`isNspCoordinatorOfHospital`/`listMyNspHospitals`/`listPqsMembers(hospital)`/`getPqsDepartmentForHospital`/`listHospitalEligibleUsersForPqs`/`listOrgEligibleUsers`); new `pqs/org-admin.ts` (rollup readers + `isNspOrgAdmin`); `org/actions.ts` `assign/revokeNspCoordinator(hospital)`; `queries/session.ts` `getNspAccessByOrg` returns `.hospitals: NspHospitalGrant[]` (via `listMyNspHospitals`); `patient-index` `searchPatientForHospital`/`getPatientAccessAuditForHospital`; `referrals/actions.ts` `disposeReferralPhi`. **Seed:** org-A 2nd hospital (secundário-a) gains "Comissão de Segurança do Paciente A2" + NSP event (`PRT-A2-0001`) + INTRA-org CROSS-HOSPITAL referral (`PRT-A2-0002`, central-a CCIH → secundário-a); personas `nspcoord.a2`/`pqs.a2` (`.a`/`nspcoord.a` remap to central-a); per-hospital `pqs_department` (windows 45/20/30). **pgTAP total 1454 → ~1449 (`173` deleted, `189_nsp_per_hospital_isolation` +42 added; `145`/`176` re-keyed per-hospital; 7 single-hospital suites byte-identical re-keyed; `171` commission count 3→4).** New `189` keystones: cross-hospital SAME-ORG PHI isolation, coordinator-as-operator (unenrolled), nsp_org_admin ZERO-PHI on every door + PHI-free aggregate SELECT-list assertion, dual-hospital referral (both endpoints read; cross-org denied), disposal + get_referral_patient→null, per-hospital EV/config. Vitest 193/193; tsc 0; eslint 0. **Then earlier:** 2026-07-03 (`hospital-admin-tier` — **Phase A**; branch `feat/hospital-admin-tier`; ADR 0051; QA APPROVED [CHANGES REQUESTED → all 5 fixed]; §6 Record 2026-07-03 — merged → main + remote `db push`). New role **`hospital_admin`** (org_admin mirrored, hospital-scoped) on `organization_members`: role-CHECK widen + nullable `hospital_id` + iff-CHECK (`hospital_id` set **iff** `role='hospital_admin'`) + `UNIQUE NULLS NOT DISTINCT(user_id,organization_id,role,hospital_id)`; `nsp_org_admin` is in the CHECK but **INERT** (behavior lands Phase B). **Predicates:** new `app.is_hospital_admin_of(hospital)`, combined `app.is_commission_admin_of(commission)` (+`_for` variants: org_admin OR hospital_admin-of-the-commission's-hospital), `app.is_org_level_admin_within(org)` (org-level admin holding no commission membership); the combined predicate was programmatically swapped into **~145 objects** (56 procs + 87 policies) off the live catalog — **zero residual, guarded permanently by pgTAP 187**; org-level-only `is_org_admin_of(org)` sites untouched. **4-tier audit:** chain key `(org, hospital, commission)`; derived `hospital_id` spliced into the hashed tuple in lockstep across `audit_canonical`/`audit_write`/`verify_audit_chain` (now `verify_audit_chain(p_commission, p_organization, p_hospital)`); 4 partial-unique seq indexes + 4-tier read policy + hospital emitters (`trg_audit_hospital_updated`, `trg_audit_hospital_admin_grant`); no PHI/payloads in rows (Rule 11 preserved). **Committee titles (5th per-commission vocab):** new `commission_member_titles` + `commission_members.title_id` FK (ON DELETE SET NULL, display-only, zero RLS semantics, staff_admin-managed, auto-seed 3 defaults via trigger); title CRUD RPCs; `assign_member_title(p_member, p_title_id nullable)`. **Appointment RPCs** (DEFINER, `is_org_admin_of`-gated, no self-delegation): `assign_hospital_admin`/revoke + nsp_org_admin analogs. **4 new RLS shapes** (all QA-verified minimum-necessary + isolation-preserving): `organization_members` self-read (`…000500`); `profiles` hospital_admin READ arm (`…000600`, **WRITE not widened**); `hospitals_select` += `is_hospital_admin_of(id)` and `organizations_select` += `is_org_level_admin_within(id)` (`…000800`, the BUG-HAT-003 root-cause fix — lets `getSessionContext` build `hospitalAdminOf`). **Hospital-scoped user management (service-role):** `getSessionContext` resolves `hospitalAdminOf`/`nspOrgAdminOf`; `registerUser` + per-user actions admit a hospital_admin scoped to its hospital (home hospital **HARD-SET server-side**, amendment 11; committees limited to own-hospital commissions; `removeCommittee` gates on `authorizeForCommission` — QA MAJOR-2); `updateUserProfile` home-hospital hard-set (QA MINOR-1); new reads `listHospitalUsers`/`listHospitalAdmins`/`listNspOrgAdmins`. Migrations `20260709000000`–`…000800` (on top of baseline `20260620000000`). pgTAP **1454/1454** (fresh reset); feature E2E `hospital-admin-tier` **38/38**; full regr 497p/26f (0 Phase-A reg). **NOT in Phase A → Phase B:** NSP-per-hospital, `nsp_org_admin` behavior, dual-hospital referrals, `dispose_referral_phi`. Earlier 2026-07-01 (`answer-model-v2` — branch `feat/answer-model-v2`; ADRs 0045/0046; QA APPROVED; re-squashed into the baseline, remote **re-baselined 2026-07-01**). Pre-launch schema-shape hardening; **evaluator byte-for-byte UNCHANGED (Rule 3)**. **Uniform answer row:** every answered input — including choice items — now gets a parent `answers` row, and `answer_selected_options` is **re-keyed `response_id`+`item_id` → `answer_id`** (PK `(answer_id, option_id)`; RLS + submitted-guard resolve the response via `answer_id → answers`). **Typed shadow columns** `answers.value_number/value_date/value_time` derived by `app.sync_answer_typed_values` (BEFORE INS/UPD, **exception-guarded per cast — a bad cast leaves the col NULL and NEVER fails a save**); `answers.value` jsonb stays the SOLE canonical evaluator input. **Answered-at + reserved** `answers.answered_at` + `answers.confidentiality_level` (RESERVED, unenforced — ADR 0045). **Instance-ready key (inert scaffolding, NO repeating-group UX):** `answers.group_instance_id` + new `response_group_instances` table (RLS mirrors the inline `answers` predicate verbatim; submitted-freeze) + `form_items.parent_item_id` (self-FK cascade, always NULL). **Question default values:** `form_items.default_value jsonb` (wizard prefill of visible unanswered items) + client `default_value` validation at **publish time → HC080** (`o valor padrão da pergunta "%" é inválido`). Two partial-unique answer indexes (top-level `(response_id,item_id) where group_instance_id is null` / per-instance where not null). **Evaluator/rehydration:** `app.answer_map`/`answer_map_by_item`/`case_phase_answer_map` only change how they SOURCE selections (via `answer_id`), output shapes frozen — guarded byte-for-byte by `supabase/tests/60_answer_map_golden.sql`. RPCs: `save_section_answers` upserts a parent answer per answered item then replaces selections by `answer_id`; `submit_response`/`response_required_complete` re-keyed; hidden-cleanup deletes answers (selections cascade) + `response_group_instances`; `clone_form_version` copies `default_value` + remaps `parent_item_id`; dashboards/export join via `answer_id` (aggregates identical); `app.guard_submitted_selections` twin + `reject_invalid_selection` re-keyed. **TS:** new client-safe `src/lib/forms/option-code.ts` is the **single** option-code generator shared by the server action + the builder — the builder now mints the option `code` client-side so choice `default_value` carries a real code, not `""` (fixes BUG-AMV2-002); `publishVersion` surfaces the pt-BR message for `HC080` as well as `23514` (BUG-AMV2-001). **Migration history re-SQUASHED 2→1** back into the single baseline `20260620000000_baseline.sql` (empty sorted pre/post pg_dump diff proves equivalence). pgTAP **1205/1205**, Vitest **176/176**. Earlier 2026-07-01 (`form-model-normalization` — branch `feat/form-model-normalization`; QA APPROVED, remote re-baselined). Normalizes the Form option/answer model: **new `form_item_options`** (version-scoped option rows — hidden immutable `code` [the analytics/condition identity], `label`, `color_token`, nullable `score`, free-text `analytics_code`, `position`; parent-must-be-choice + published-frozen triggers; RLS member-read/staff_admin-write via `commission_of_version`) + **new `answer_selected_options`** (one row per selected option, hard FK to the option row; submitted-frozen; RLS mirrors `answers`). **`form_items.options` jsonb DROPPED** (+ `is_valid_options` + the shape CHECK); "choice needs ≥1 option" moved to **publish time**. **`answers.value` = scalars only**; choice answers live in `answer_selected_options`. **Evaluator UNCHANGED (Rule 3):** `app.answer_map` rewritten to rebuild the same `question_key→code(s)` shapes (single→scalar code, checkbox→ordered code array, scalars→raw) from the two tables; conditions/`recommend_when`/`result_ruleset` now store the option **code** — publish-time + template validators (`validate_visible_when`/`validate_template_recommend_when`/`validate_template_result_ruleset`) gained option-**code**-existence checks via `app.version_has_option_code`. New/changed: `app.answer_map_by_item` (by-item_id twin, for `get_response_for_signoff`); `reconcile_item_options(item, jsonb)` (atomic upsert/delete/**reorder** in one txn — fixes the DEFERRABLE-unique cross-transaction reorder bug); `save_section_answers` (+`p_selections` code-arrays, replace-semantics); `submit_response` (answered = value OR ≥1 selection; hidden-cleanup deletes both tables); `clone_form_version` (copies option rows, **codes verbatim**); `case_phase_answer_map` (now reads normalized selections — a real bug fix, choice-based cross-phase recommendations/result rulesets were silently blank); dashboards/export **GROUP BY `option.code`** + current-label resolution. **Migration history SQUASHED 53→1** single baseline `20260620000000_baseline.sql` (schema dump + carried storage/config-vocab/auth-triggers/grant-posture; empty sorted pre/post diff proves equivalence; PHI-table + anon lockdown verified). TS: `ItemOption`={id,code,label,color,score,analyticsCode,position}; `VERSION_TREE_SELECT` embeds `form_item_options!form_item_options_item_id_fkey(...)` (FK-hinted to avoid `PGRST201`); `buildAnswerMaps` (TS twin of `answer_map`) feeds `getResponseForFill`/`getSubmissionDetail`. pgTAP **1180/1180**, Vitest **170/170**. Earlier 2026-06-30 (`cases-meetings-minor` — routine batch; migration `20260630000007`; **additive, forward-only, NO flag, NO new RLS shape**). **A1** new DEFINER `list_case_access(p_case)` mirroring `grant_case_access` authz (coordinator/admin + `case_access` flag) → `listCaseAccessGrants`. **A2** `case_events.occurred_time time` (nullable) threaded through the direct-table case-event actions + `CaseEvent.occurredTime` (`HH:mm`). **B2** query-only — `MeetingListItem` += `pendingActionItems`/`pendingSignatures` (batched RLS-scoped child reads merged in `listMeetings`; `pendingSignatures` null unless `em_assinatura`; `mapMeetingListItem` defaults 0/null so the Case-Timeline reuse stays valid). **C2** `conclude_meeting` HC034 false-negative is NOT a SQL bug — the guard (present AND `user_id not null`; guests excluded, ADR 0025) is correct; root cause is **upstream/frontend** (a committee MEMBER reaching the DB as a guest row, `user_id` null). Backend cleanup only: `src/lib/meetings/messages.ts` HC034 now returns the friendly pt-BR `cannotConclude` (was leaking the raw SQL string; CLAUDE.md §8). pgTAP `120`+1 / `144`+5 → full **1160/1160**; lint+typecheck green. Earlier 2026-06-26 (`result-rec` — ADR 0043; migrations `20260630000004` (+ unrelated anon-leak fix `…005`); **additive, forward-only, both `recommend_when` CHECKs widened to a superset** ⇒ legacy single rows + existing snapshots stay valid, no data migration). `recommend_when` becomes a **combinable group** of answer- AND/OR result-conditions; a phase can be auto-recommended from an EARLIER phase's RESULT (specific `phase_results` id via `equals/not_equals/in`, or its `adverse` flag), mixed freely under TODAS/QUALQUER. New `app` helpers `is_valid_recommend_cond`/`is_valid_recommend_when`/`recommend_when_conditions`; group-aware `validate_template_recommend_when` (**HC063** non-emitting source · **HC064** id ∉ allowed-set); group-walk `recompute_recommendations` reusing the UNCHANGED `app.eval_condition` over a synthetic map (zero evaluator drift, Rule 3); `set_case_phase_result_override` += recompute on a concluded-phase result change; group-aware `create_case_from_template`. Suggestion-only (only the `recommended` flag). pgTAP `161` (20) → full **1122/1122**; Vitest `recommendation.test.ts` (32) → **164/164**; E2E `recommend-result.spec.ts` (9) → full **431/0**; QA APPROVED. **✅ remote re-baselined 2026-07-01 (subsumed by the single-baseline reset).** Earlier 2026-06-23 (`form-builder-enhancements` — ADR 0040; **additive, NO feature flag → already live on remote**; backward-compat proven, every relaxed CHECK a strict superset). FOUR new `form_items.item_type`s `short_text`/`number`/`date`/`time` (input-arm + options-IS-NULL arm of the shape CHECK); `form_items` += `config jsonb` (number/date min/max) + `visible_when jsonb` (per-question conditional appearance) + CHECK `conditional_not_required`; per-option **colors** live INSIDE `options` (`{label,color}` OR bare string, normalized at read by `toOptions`); `answers` += `observation text`. Helpers `app.is_valid_visibility`/`is_valid_options`/`eval_visibility` (group ALL/ANY wrapper over `eval_condition`) IMMUTABLE+search_path-pinned; `eval_condition` += ordered ops `gt/gte/lt/lte` (both-JSON-number⇒numeric else text — mirrored SQL↔TS via shared `condition-vectors.json` + new `visibility-vectors.json`). `validate_visible_when` walks BOTH group-shaped **section** (earlier-section) AND **item** (earlier doc-order tuple) conditions: forward/self-ref reject + `app.assert_condition_op_target` (op↔target-type **and** number-target⇒JSON-number value, `check_violation`). `submit_response` per-item **forward pass** (`v_eff`: hidden section/item keys dropped, strays cleared, present-only number/date min/max → **HC061**) — mirrored by the wizard's pure `effective-visibility.ts`. `clone_form_version` copies `visible_when`+`config`. `save_section_answers` (DROP+CREATE 5-arg `+p_observations`) + `get_response_for_signoff` (additive `observations_by_item`, gating UNCHANGED) carry observations; observations render on ALL read views (wizard/submission-detail/sign-off), NEVER in the audit log (Rule 11). Migrations `…120000`/`130000`/`140000`; pgTAP **870/870**, E2E `form-builder-enhancements` 15/15 + phase4 8/8, QA APPROVED. **⚠ A tester `db reset --linked` during the fix loop reset+reseeded REMOTE and reverted the out-of-band `patient_index` flag → OFF (was manually ON; needs separate re-enable).** Earlier 2026-06-22 (`case_patient` — THIRD PHI module (ships **OFF**; ADR 0038): isolated `case_patient` (PK=case_id, all DML REVOKEd, audited `get_case_patient` door → `case_patient.read`) modeled field-for-field on `event_patient`/`referral_patient`; the **deliberate divergence** — read predicate `can_read_case_patient` = the BROAD `can_read_case` (any case-worker; assignees need the MRN) vs **coordinator-only writes** — unlike the staff_admin+PQS event/referral predicates; per-template `collects_patient` toggle snapshotted to `cases.patient_enabled`; `set`/`get`/`dispose_case_phi`/`set_template_collects_patient` + additive `create_case_from_template`/`get_case_detail` re-emit; `log_audit_access` + `case_patient.read`; `cases` += `has_patient`/`patient_enabled`/`phi_disposed_*`; migration `…017000`; pgTAP `151_case_patient.sql` 35/35; gate APPROVED, flag OFF). Earlier 2026-06-21 (Phase 22 — Inter-Committee Case Referrals (`case_referrals`, ships **OFF**; ADR 0037): 7 tables incl. isolated PHI `referral_patient` (REVOKEd, audited `get_referral_patient` door) — the SECOND PHI module under the NSP's isolated-table + single-door safeguards (amends Rule 12); broad `can_read_referral` vs tight `can_read_referral_phi` (+`referral_target_analyst`); PHI free-text lockdown — `frozen_body_md`/`result_md` policy-gated + `description_md`/`decline_note` column-REVOKEd, all served only by the audited `get_referral_detail` door to PHI readers; frozen-snapshot channel (narrative text + Rule-6 doc ref); RLS-consistent snapshot-doc download (no service-role); flag-gated `can_read_case` QPS macro-term (no B→A leak) + `close_case` HC076 gate; 21 RPCs; `referral-attachments` bucket; migrations `…013000–016000`; **HC070–HC07A**; pgTAP `150_referrals.sql` 40 assertions, full suite 705/705). Earlier 2026-06-19 (Case Access Control — per-case read/write ACL (`case_access`) + attribution-driven full-case read + restrictive `can_read_case` boundary + narrative attribution/`aberta→concluida` lifecycle + "Meus Casos"; 3 DEFINER predicates + `get_case_detail` VOLATILE re-gate (submitted-only preserved) + `case.opened` audit; migrations `…110000–110004`; flag ON; **HC055**; ADR 0033; gate APPROVED). Earlier 2026-06-18 (Phase 14b–d — NSP Triage→RCA→CAPA: `event_triage`(1:1) + sentinel-flags + configurable sentinel-criteria/event-types + triage RPCs (`save`/`confirm`[freezes event, mints RCA shell]/`reopen_triage`, `triage_disposition` [45-day RCA due], due-window setter); `rca`(1:1) + 6 children + `can_write_rca` DEFINER (PQS/admin OR assigned non-observer) + completed-freeze child-lock + **immutable `nsp-evidence` bucket**; source-polymorphic `capa_plan` + `capa_action`(JC strength) + tasks/evidence/measures/results/effectiveness + conclude-gate (HC051/HC052) + assignee-or-PQS action-advance + close→event auto-close; HC045–HC053; reuses `patient_safety` flag; migrations `…121100–121302`). Earlier same day: Phase 14a — Patient-Safety/NSP: **first PHI** on the platform (Architecture Rule 12; ADR 0030/0031) — isolated `event_patient` + append-only `event_custody` + access-follows-custody `app.can_read_event` + 8 DEFINER RPCs (incl. PHI-free `pqs_inbox`) + `event_patient.read` audited (empty metadata) + `patient_safety` flag ON; migrations `…121000–121005`). Earlier 2026-06-18: Phase 13 — Audit Trail: append-only hash-chained `audit_log` + DEFINER `audit_write` + curated PHI-free AFTER-triggers + SELECT-only RLS + `verify_audit_chain` + `log_audit_access`; `audit_trail` flag ON; ADR 0029; Architecture Rule 11). Earlier 2026-06-15: Phase 11 — Interviews: case-scoped sibling of Meetings; 4 tables + per-commission `interview_number` minting + lifecycle/content-freeze/child-lock guards + NEW row-level participant-write RLS (`can_write_interview`) + `interview-attachments` bucket (INSERT keyed on path seg [2]) + `case_events` kind `'interview'`; ADR 0026). Earlier same day: Phase 10 — Meetings; ADR 0025. Earlier: Case data-model adjustments batch — phase blocking + fixed auto-computed statuses + per-commission outcomes; ADR 0024, supersedes 0023. Earlier: post-Phase-8 Cases-Extras batch; ADR 0022.**, DOOR-PARITY RULE - read before adding ANY door or policy (+30 more)

### Community 361 - "0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)"
Cohesion: 0.18
Nodes (11): 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones), 1. Disposition of all 45 gaps, 2. The pre-pilot phase (`flexible-forms`, structural, no feature flag), 3. Deferred UX roadmap (post-pilot, each its own gated, feature-flagged phase), 4. Cross-cutting design invariant (Rec A) — `question_key` aggregation for the new field types, Alternatives rejected, Consequences, Context (+3 more)

### Community 362 - "3.2 `forms.form_versions`"
Cohesion: 0.20
Nodes (10): 3.2 `forms.form_versions`, Design Reasoning, Example `behavior_config`, Example `theme_config`, Important Columns, Purpose, Related Types, Relationships (+2 more)

### Community 363 - "QA Review — Form Builder Enhancements (mini-phase)"
Cohesion: 0.07
Nodes (27): 1. Where we are, 2. Environment — bringing a new machine up, 3. Hard-won environment gotchas (each cost real time), 4. ⛔ A2 (the resolver) — READ THIS BEFORE BUILDING IT, 5. Open items, 6. PO decisions made this session (do not re-litigate), 7.10 ⛔ A metric that reads the SAME before and after is not measuring the change (lead, M5b), 7.11 ⛔ An inferred mechanism is not a mechanism — and quoting a lesson is not applying it (lead, 2026-07-16) (+19 more)

### Community 364 - "ad-hoc-narratives.spec.ts"
Cohesion: 0.29
Nodes (8): addWithNewType(), createProcesslessCase(), getCaseNarratives(), getCasePhases(), restGet(), serviceHeaders(), signInAs(), ADR-0032

### Community 365 - "administrativo.spec.ts"
Cohesion: 0.20
Nodes (6): createCaseAs(), rpcAs(), signInAs(), signOut(), ADR-0061, ADR-0078

### Community 366 - "member-action-items-overview.spec.ts"
Cohesion: 0.20
Nodes (5): signInAs(), signOut(), svcDelete(), teardownFixtures(), ADR-0078

### Community 367 - "phase13-audit.spec.ts"
Cohesion: 0.20
Nodes (6): AuditRow, auditRowsFor(), restGet(), signInAs(), ADR-0029, ADR-0075

### Community 368 - "wizard-others-ux.spec.ts"
Cohesion: 0.09
Nodes (23): 0. What already shipped (read before building — do not re-derive), 1. Goal, 2.1 Shared shape across all three tables, 2.2 `action_item_reminders`, 2.3 `action_item_updates`, 2.4 `action_item_checklists`, 2.5 SQLSTATE allocation (block `HC0I0–HC0I9`), 2. AI·sat — the three satellites (and the explicit non-set) (+15 more)

### Community 369 - "PROGRESS.md — Project Status Tracker"
Cohesion: 0.08
Nodes (24): ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped), Bug Log, Closed — rotated 2026-08-04 → [bug-log-archive.md](docs/progress/bug-log-archive.md), Completed work (archived to docs/progress/), Current Phase Tasks, Decisions, ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now"), Follow-ups / Deferred Items (+16 more)

### Community 370 - "ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors"
Cohesion: 0.17
Nodes (14): assertRouteDenied(), callRpc(), createEthicsCase(), DashSnapshot, dbDelete(), dbInsert(), getOwnerToken(), grantRead() (+6 more)

### Community 371 - "7. Lookup Values and Enums"
Cohesion: 0.22
Nodes (9): 7.1 Document lifecycle status, 7.2 Document version status, 7.3 Confidentiality labels, 7.4 Asset roles, 7.5 Document permissions, 7.6 Principal types, 7.7 Relationship types, 7.8 Access inheritance modes (+1 more)

### Community 372 - "Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)"
Cohesion: 0.09
Nodes (21): ADR 0079 / t19 grants (CLEAN), Dimension 1 — Requirements (per-increment acceptance), Dimension 2 — Security / RLS (the crux) — verified LIVE, Dimension 3 — Code quality (CLEAN), Dimension 4 — UX & a11y, Dimension 5 — Hygiene, INFO-3 — idempotency keys — confirmed intentional (PO-locked trim)., INFO (new, non-blocking) — defense-in-depth for the notes read (+13 more)

### Community 373 - "Increment Archive — Case Access Control & "Meus Casos""
Cohesion: 0.12
Nodes (16): 1.1 ⛔ P0 · The exclusion plane: **6 tables × 4 legs** — the A27 matrix, 1.2 ⛔ P0 · The population question — answered, and the answer is not a number, 1.3 – 1.11 · Unchanged from v2 (all ✅ `qa`-verified), 1.6 · **A30 — `platform_admin` (`is_admin()`) arms on tenant data: FIVE** (D8 · D10), 1 · FINDINGS SUMMARY, D1a · My v2 boundary was wrong in two directions, and the count concealed it, D2 · ⚠ `qa`'s PROBE 4 over-states the PHI consequence (C1a's lesson, 4th occurrence), D2a · …but composed, it is **WORSE** than `qa` framed it (PROBE 5, proven live) (+8 more)

### Community 374 - "Phase 10 — Meetings (archived task detail)"
Cohesion: 0.18
Nodes (10): completePhase(), createCase(), editAndResubmit(), insertChoiceOptions(), rpc(), signInAs(), signOut(), slug() (+2 more)

### Community 375 - "Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)"
Cohesion: 0.11
Nodes (25): CaseReferralsModule, EMPTY_REFERRAL_PATIENT_DRAFT, ReferralPatientDraft, referralPatientDraftHasData(), referralPatientDraftToInput(), ReferralPatientFields(), SEX_ORDER, ADR-0037 (+17 more)

### Community 376 - "Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)"
Cohesion: 0.12
Nodes (14): metadata, metadata, metadata, PasswordSetForm(), appOrigin(), AuthState, MESSAGES, requestPasswordReset() (+6 more)

### Community 377 - "Findings"
Cohesion: 0.22
Nodes (8): BLOCKER, Completeness / premature-closure assessment, Findings, INFO, MAJOR, MINOR, QA Review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Requirements & product-owner-decision fidelity

### Community 378 - "Phase 17 — Controlled-Document Lifecycle · QA Review"
Cohesion: 0.12
Nodes (12): ensureCasePatientPhi(), getToken(), openAccessDialog(), patchNarrativeAssignee(), patchNarrativeFields(), rpc(), signInAs(), signOut() (+4 more)

### Community 379 - "case-patient.spec.ts"
Cohesion: 0.16
Nodes (9): auditRowsFor(), restGet(), restoreFeatureFlags(), setFeatureFlag(), signInAs(), ADR-0038, ADR-0042, ADR-0064 (+1 more)

### Community 380 - "cases-extras.spec.ts"
Cohesion: 0.13
Nodes (23): ActionState, appOrigin(), assignStaffAdmin(), authorizeStaffAdminOps(), createCommission(), MESSAGES, removeStaffAdmin(), requireAdmin() (+15 more)

### Community 381 - "cases-meetings-minor.spec.ts"
Cohesion: 0.13
Nodes (14): 15. Read interfaces and Case detail composition, 16. Ethics lifecycle mapped to the shared model, 19. Required indexes, 1. Executive decision, 22. Open decisions requiring human approval, 23. Acceptance criteria for implementation readiness, 24. Handoff summary, 2. Goals (+6 more)

### Community 382 - "patient-index.spec.ts"
Cohesion: 0.18
Nodes (8): auditRowsForAction(), restGet(), restoreFeatureFlags(), setFeatureFlag(), signInAs(), ADR-0042, ADR-0052, ADR-0064

### Community 383 - "phase14a-safety-events.spec.ts"
Cohesion: 0.22
Nodes (11): approvalProgress(), deriveStatus(), DocumentsPage(), matchesView(), metadata, DocumentKpis, DocumentKpiStrip(), KpiCard (+3 more)

### Community 384 - "phase22-referrals.spec.ts"
Cohesion: 0.22
Nodes (6): auditRowsFor(), restGet(), signInAs(), ADR-0037, ADR-0042, ADR-0078

### Community 385 - "phase8-dashboard.spec.ts"
Cohesion: 0.25
Nodes (6): openDashboard(), IMPORTANT: exclude case-phase responses (`case_phase_id=is.null`). The, seedOnlyTo(), signInAs(), ADR-0018, ADR-0020

### Community 386 - "route.ts"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 387 - "0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values"
Cohesion: 0.13
Nodes (15): 0089 — FF-2 Matrix & Risk Matrix: cell contract, risk derivation, required semantics, axis codes, 1. The cell contract is a radio grid — columns are the options, 2. Risk weights live on the axes; `risk_score` is derived server-side, 3. `required = true` on a matrix means every row is answered, 4. Axis codes are immutable once they exist, A. 🔴 `app.instance_is_empty` is blind to the matrix tables — new finding, B. 🔴 The correction-copy obligation, inherited from FF-1's P0-1, C. `clone_form_version` does not copy the axes — INFO-1, matrix half (+7 more)

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
Cohesion: 0.10
Nodes (19): 0061 — "Administrativo" delegated-capability role (per commission), Alternatives rejected, Consequences, Context, Decision, Administrativo delegated-capability role — task detail (archived), Backend, Bugs found + fixed (see archived Bug Log) (+11 more)

### Community 397 - "Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07"
Cohesion: 0.33
Nodes (6): 5.3 `referral_participants`, Columns, Constraints, Design rationale, Suggested access levels, Suggested participant roles

### Community 398 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.20
Nodes (11): AssigneeAvatar(), BulkStepDeal(), formatDateOnly(), BulkGridRow, resolveLabel(), balancedDeal(), Rng, shuffle() (+3 more)

### Community 399 - "Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)"
Cohesion: 0.20
Nodes (10): ⏸ AUTHZ · Gate 1 · A2 — the resolver · **BLOCKED pending a PO/lead ruling** (`backend`, 2026-07-15) — ⭐ **ruling received; A2 rescoped, M3 lands first**, AUTHZ Gate 1 — completed unit detail (rotated out of PROGRESS.md), ▶ AUTHZ · Gate 1 · M1 — exclusion durability (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M2 — A30 bucket C: platform_admin loses referral-PHI destruction (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M3 — defect ①: bare assignment no longer confers PHI (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5 — defect ③: the `is_active` outer gate (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5b — defect ③ AT THE DOORS: `qa`'s P1, and my closure was a floor (`backend`, 2026-07-15), ▶ AUTHZ · M4 — the gated-off myth: **FIVE** false flag descriptions corrected (`backend`, 2026-07-15) (+2 more)

### Community 400 - "QA Review — "Administrativo" delegated-capability role (ADR 0061)"
Cohesion: 0.15
Nodes (13): Conclusion, Findings, INFO-1 — `case_phase_option_aggregates` lacks the `status='completed'` filter its sibling has, INFO-2 — stale doc-comment mentions `reopen_narrative`, INFO-3 — `save_correction_draft_body` audits with action verb `case_correction.draft_started`, INFO-4 (positive) — free-text reasons deliberately excluded from `audit_log`, INFO-5 — test gate taken on faith (tester/lead-owned), MINOR-1 (non-blocking) — void approvals do not stamp `impact_snapshot` (+5 more)

### Community 401 - "CLAUDE.md optimization — evaluation & change-map"
Cohesion: 0.25
Nodes (7): Binding-rule preservation — verified ✓, Change-map (section by section), CLAUDE.md optimization — evaluation & change-map, How to adopt (two steps, when you're satisfied), Out of scope this pass — recommended follow-ups, TL;DR, What the audit found

### Community 402 - "QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`"
Cohesion: 0.11
Nodes (15): addAllegation(), assertRouteDenied(), AuditRow, auditRowsFor(), clearCaseAccess(), dbDelete(), dbQuery(), inDays() (+7 more)

### Community 403 - "phase14b-triage.spec.ts"
Cohesion: 0.18
Nodes (15): IndicatorsPage(), metadata, formatPeriodLabel(), formatTarget(), IndicatorKindBadge(), MeasurementStatusChip(), STATUS_STYLES, IndicatorList() (+7 more)

### Community 404 - "processless-cases.spec.ts"
Cohesion: 0.15
Nodes (13): 1. Catalog facts (all confirmed live, not from migration text), 2. Live function bodies read in full (`pg_get_functiondef`), 3. pgTAP — ran live, not just trusted, 4. One independent live mutation (not from the ADR's narrative), 5. BUG-FF4-001 fix — read, not just accepted as fixed, 6. Client/server consistency, 7. UI / a11y / pt-BR spot check, Conclusion (+5 more)

### Community 405 - "ui-batch-2026-07.spec.ts"
Cohesion: 0.33
Nodes (6): 5.5 `referral_messages`, Columns, Constraints, Design rationale, Sequence assignment, Suggested message types

### Community 406 - "commission-overview.tsx"
Cohesion: 0.09
Nodes (31): metadata, OrgNspCoordinatorsPage(), metadata, OrgNspOverviewPage(), personLabel(), ADR-0052, CoordinatorSection(), NspOrgHospitalCuration (+23 more)

### Community 407 - "interviewers-panel.tsx"
Cohesion: 0.10
Nodes (21): 0 · How this review was conducted, 1 · BLOCKING, 2 · MAJOR, 3 · MINOR, 4 · INFO, 5.1 Mutation proofs re-run (all held), 5.2 Door parity — verified against the catalog, not the ADR, 5.3 The two mirror pairs (+13 more)

### Community 408 - "referral-flow-charts.tsx"
Cohesion: 0.16
Nodes (19): SessionForm(), toDateTimeLocalValue(), HeldWindowFields(), isFuture(), localToIso(), ADR-0062, useHeldWindowState(), MeetingFormDialog() (+11 more)

### Community 409 - "rca-header.tsx"
Cohesion: 0.16
Nodes (15): CaseBulkGrid(), formatRowList(), GridCell(), GridRowView, MappingRow(), PasteMappingPanel(), RowInvalid, truncate() (+7 more)

### Community 410 - "1. Eliminating Waterfalls"
Cohesion: 0.26
Nodes (14): formatCaseNumber(), formatInterviewNumber(), formatNextSession(), interviewTitle(), ConfidentialityBadge(), InterviewCategoryBadge(), InterviewStatusBadge(), InterviewPhaseOption (+6 more)

### Community 411 - "2. Bundle Size Optimization"
Cohesion: 0.08
Nodes (24): Ad-hoc bug-fix batch (2026-08-03) and the seven bugs it triaged, Archive — Bug Log (resolved & closed), ✅ BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **FIXED 2026-08-03** (filed 2026-07-27, PO's call), ✅ BUG-E2E-001 — `mem-memberships-collapse` AC-1 deleted a SEED membership in its own cleanup, poisoning every later batch of the gate · severity **MAJOR (test-suite)** · **CLOSED 2026-07-28** (found + fixed + re-verified by `tester`), ⚪ BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-07-28), BUG-E2EISO-002 — rotated from PROGRESS.md 2026-08-03 (RESOLVED), ✅ BUG-E2EISO-002 — `session_replication_role = replica` in the FF-1/2/3/5 specs' `purge()` disables FK CASCADE and orphans form rows on every run · owner **tester** · **RESOLVED 2026-08-03** (filed 2026-08-03; found by tester during the FF-4 test pass, hit again in a second file during triage), ⚪ BUG-E2EISO-003 — `bulk-case-creation.spec.ts:344` (AC2) is not idempotent across runs on one DB · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-08-03) (+16 more)

### Community 412 - "29. Important Implementation Guidance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 413 - "3. Design Principles"
Cohesion: 0.22
Nodes (9): 1. `repeating_group` — **explode by child `question_key`** (do not collapse), 2. `matrix` — **the cell is the unit; address `(question_key, row_code, col_code)`**, 3. `risk_matrix` — **derived scalar by `question_key` + severity/likelihood distributions**, 4. `reference` — **aggregate on `participant_id`, never the label**, Consequence for the F3 inert tables (built against this note), Cross-cutting invariant (applies to all four types), F3 — `question_key` → aggregation contract for the new field types, Per-type contract (+1 more)

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
Cohesion: 0.12
Nodes (17): 3.14 `forms.block_library_items`, 3.16 `forms.form_lint_results`, 3.4 `forms.question_types`, 3. Form Definition Layer, Design Reasoning, Design Reasoning, Design Reasoning, Important Columns (+9 more)

### Community 418 - "3.7 `forms.form_block_validations`"
Cohesion: 0.29
Nodes (7): 3.7 `forms.form_block_validations`, Design Reasoning, Example Config, Example Validation Types, Purpose, Relationships, Suggested Table

### Community 419 - "4.1 `form_responses.form_submissions`"
Cohesion: 0.10
Nodes (20): Acceptance / gate, Acceptance / gate, Acceptance / gate, Acceptance / gate, Cross-cutting, Decide first (blocks everything else), Decisions locked by interview (PO, 2026-08-04) — do not re-litigate, Findings that reshape the remaining work (catalog-verified 2026-08-04) (+12 more)

### Community 420 - "4.2 `form_responses.form_answers`"
Cohesion: 0.25
Nodes (8): 1 — I was wrong; backend was right (the crux), 2 — Is `can_reach_case_on_member_surface` faithful to D2·8, or a rationalization?, 3 — Both proofs closed; no-op real; keystones re-verified, 4 — The two sweep exclusions, reviewed on the merits, 5 — Is the sweep fail-closed? Mostly — with one honest limit (MINOR-A), Closing, Re-review — Round 3 (2026-07-14) — FINAL, Verdict: ✅ APPROVED

### Community 421 - "43. Anti-Patterns to Avoid"
Cohesion: 0.29
Nodes (7): 43.1 File URLs in domain tables, 43.2 One giant attachments table, 43.3 Assuming case access equals document access, 43.4 Public buckets with obscure URLs, 43.5 Treating OCR as harmless, 43.6 Storing PHI in filenames or object paths, 43. Anti-Patterns to Avoid

### Community 422 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.16
Nodes (19): AdminAuditPage(), metadata, AdminLayout(), ADR-0042, CommissionAuditPage(), metadata, AuditEmptyState(), AuditFiltersAsync() (+11 more)

### Community 423 - "Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)"
Cohesion: 0.18
Nodes (13): abort_batch(), BATCHES, dins(), free_port(), pack_batches(), preflight(), recover_stack(), reload_pgrst() (+5 more)

### Community 424 - "Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)"
Cohesion: 0.13
Nodes (15): 0. Source anchors (what already exists — E3 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Seed (E3a — backend, `supabase/seed.sql`), 2.3 TS layer (`backend`-owned) — the terminology read (first-ever consumer), 2.4 RLS, 2.5 Terminology-wiring touch-list (frontend, off the frozen §2 contract), 2. E3a canonical contract (BACKEND posts these typed stubs FIRST) (+7 more)

### Community 425 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.29
Nodes (6): Backend rows, Base-branch failure triage (2026-07-08, lead), E2E (scoped pass, NOT a formal gate), Frontend rows, UI/layout fixes batch + base-branch triage — 2026-07-08, UI/layout fixes batch (frontend + backend)

### Community 426 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.20
Nodes (10): 18. Migration and rollout sequence, Gate 0 — Ratify the replacement decision, Gate 1 — Repair the Case Type foundation, Gate 2 — Centralize Case authorization, Gate 3 — Build targeted respondent submission, Gate 4 — Build generic procedure primitives, Gate 5 — Make Meetings Case-restrictable, Gate 6 — Add the ethics-only Decision satellite (+2 more)

### Community 427 - "cases-outcomes-blockers.spec.ts"
Cohesion: 0.14
Nodes (18): DashboardCharts(), groupBySection(), SectionEntry, SectionGroupData, FreeTextSamples(), MatrixDistributionCard(), tintFor(), ADR-0089 (+10 more)

### Community 428 - "nsp-per-hospital.spec.ts"
Cohesion: 0.23
Nodes (11): formatGrantedAt(), initials(), AssignHospitalAdminDialog(), HospitalAdminManager(), personLabel(), ADR-0051, AssignNspOrgAdminDialog(), NspOrgAdminManager() (+3 more)

### Community 429 - "phase14c-rca.spec.ts"
Cohesion: 0.17
Nodes (4): AGENDA_UNRESOLVED_TITLES, SERVICE_HEADERS, signInAs(), ADR-0080

### Community 430 - "phase14d-capa.spec.ts"
Cohesion: 0.30
Nodes (14): ActionState, approveCorrection(), fileCorrectionRequest(), FileCorrectionState, mapCorrectionError(), MESSAGES, rejectCorrection(), resubmitCorrection() (+6 more)

### Community 431 - "phase15-indicators.spec.ts"
Cohesion: 0.12
Nodes (15): assertAbsentFromMeusCasos(), assertCaseDenied(), assertCaseReadable(), assertPresentInMeusCasos(), AuditRow, auditRowsFor(), clearCaseAccess(), dbDelete() (+7 more)

### Community 432 - "phase3-admin-members.spec.ts"
Cohesion: 0.14
Nodes (19): NarrativeAssignMenu(), ADR-0032, ADR-0033, ADR-0085, ConcludeNarrativeButton(), canContinueCorrection(), CorrectionCaps, NarrativeCorrectionPanel() (+11 more)

### Community 433 - "phi-remediation.spec.ts"
Cohesion: 0.11
Nodes (18): B-1 (BLOCKING) → **closed**, FF-3 — QA Review **r2**, M-1 (MAJOR) → **closed**, and the split is proven in both directions, M-2 (MAJOR) → **closed**, M-3 (MAJOR) → **closed via Amendment 4.** Audited on the merits; see r2.3., m-4, m-5a, m-5b, i-1, i-2 → **closed**, M-4 (MAJOR) → **behaviour closed**; coverage gap remains, see r2.4, r1 regression sweep — all 16 proofs hold (+10 more)

### Community 434 - "React Best Practices"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 435 - "backend-engineer.md"
Cohesion: 0.33
Nodes (5): Binding rules (see ARCHITECTURE.md for the authoritative form), Process discipline, Scope you must NOT touch, Scope you own, Skills to consult

### Community 436 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.18
Nodes (11): 19.10 Copying PHI into notification payloads, 19.1 Storing the conversation as JSONB, 19.2 Automatically granting target committee access to the entire case, 19.3 Combining shared messages and internal notes, 19.4 One referral with multiple target committees, 19.5 Resolving automatically when a response is sent, 19.6 Using assignments as permissions, 19.7 Hard-deleting communication (+3 more)

### Community 437 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.18
Nodes (11): 0092 — FF-4 Power Authoring: a commission-owned block library, condition-closed snapshots, and a five-token default vocabulary, Amendment 1 — ruling 4's "inline edit" is withdrawn; the rename list is read-only (2026-08-03), Amendment 2 — ruling 2's metadata mutability had no mechanism; the doors are built, not withdrawn (2026-08-03), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Method notes worth keeping (+3 more)

### Community 438 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.05
Nodes (33): Case Custom Fields (ADR 0083) — full task ledger, ✅ Case custom fields — COMPLETE + MERGED 2026-07-23 (ADR 0083), Backend (migrations `20260713000000`–`…000400`), Bugs found + fixed (5, all tester-verified; DB-proven each), Deferred / carried, Frontend (F1–F7), Locked decisions (ADR 0057), Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados) (+25 more)

### Community 439 - "ADR 0008 — GSAP as the animation dependency"
Cohesion: 0.11
Nodes (23): CasePatientEditDialog(), CasePatientPanel(), ADR-0038, ADR-0078, BulkCaseCustomFieldValue, BulkCaseRow, bulkCreateCases(), BulkCreateCasesResult (+15 more)

### Community 440 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.20
Nodes (10): Dimension 1 — Requirements (ADR 0072 D1–D10 + plan §4), Dimension 2 — Security / RLS (the blocking findings), Dimension 3 — What is genuinely right (verified, not assumed), Dimension 4 — Minor / Info, 🔴 MAJOR-1 — The m2 respondent/recusal deny is out-voted at the RLS policy layer (ADR 0072 D2; Architecture Rule 1), 🔴 MAJOR-2 — `record_recusal`'s self-arm has no authority gate (cross-tenant write), QA Review — ETH·E1 (Ethics Access Spine — the m2 gate release), The two accepted design deviations — both confirmed as *shipped*, not merely claimed (+2 more)

### Community 441 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.18
Nodes (15): FrameworkLayout(), metadata, StandardDetailPage(), FrameworkOverviewPage(), ADR-0093, StandardsTree(), StandardTreeBranch(), ADR-0093 (+7 more)

### Community 442 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.33
Nodes (5): ADR 0014 — Sanitizing Markdown renderer, Consequences, Context, Decision, Rationale

### Community 443 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.07
Nodes (27): M1Â·1 â€” B7: respondent linkage, M1Â·2 â€” the exclusion-plane mutators (5 RPCs), M1Â·3 â€” NEW: `case_participant_roles` â€” the 6th exclusion-plane table (V-3), M1Â·4 â€” the DEFINER exclusion sweep: 35 RPCs, split by remediation shape, M1Â·5 â€” A30: `platform_admin` arms on tenant data â€” 5, not 4, Summary â€” v2, V-0.1 Â· C1a is CONFIRMED. My v1 fixture does not reproduce. (v1 Â§7 is WRONG), V-0.2 Â· C4 is CONFIRMED. My "30" was a floor. (v1 Â§6Â·1 is WRONG) (+19 more)

### Community 444 - "ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture"
Cohesion: 0.18
Nodes (11): ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture, Amendment 1 (2026-07-12) — Referrals v2: dialogue + governance expansion (pre-pilot), Consequences, Context, Context, Decision — the 16 locked design decisions, Decision — the three-bucket disposition, Decisions amended (+3 more)

### Community 445 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.18
Nodes (11): 18.1 Permission hierarchy, 18.2 `interview_access_grants`, 18.3 Authorization helper functions, 18.4 Example RLS policies, 18.5 Storage authorization, 18. Access Control, Grant semantics, Interviews (+3 more)

### Community 446 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.20
Nodes (10): 14.1 Target committee inbox, 14.2 Source committee inbox, 14.3 Case referral history, 14.4 Deadlines, 14.5 Message ordering, 14.6 Message timeline, 14.7 Active participation, 14.8 Active assignments (+2 more)

### Community 447 - "0050 — Unified (non-PHI) action_items hub"
Cohesion: 0.33
Nodes (5): 0050 — Unified (non-PHI) action_items hub, Alternatives, Consequences, Context, Decision

### Community 448 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.15
Nodes (23): CaseTagsPanel(), TagReportCardAsync(), TagReportCard(), ActionState, archiveCaseTag(), assignCaseTag(), authorizeCommission(), commissionOfCase() (+15 more)

### Community 449 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.17
Nodes (12): createFreshCase(), getCaseNarratives(), getCaseRow(), getMandMTemplateId(), getNarrativeTypes(), NOTE: the display_position ordering has a seed collision (phase2 and Resumo, signInAs(), skipAllOpenPhases() (+4 more)

### Community 450 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.18
Nodes (9): 1. Verdict, 2. What the proposal gets right, 3. Schema collisions (checked against the live catalog), 4. Rule 12 (PHI) — two hard violations, 5. Rule 3 (response lifecycle) — solvable, already precedented, 6. Metrics — do not fork the indicator engine, 7. Unbudgeted costs the proposal does not name, 9. Recommended next step (+1 more)

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
Cohesion: 0.25
Nodes (8): 10. Migration plan, Stage A — Capability spine and active-account closure, Stage B — Granular Case Access Grants, Stage C — Meeting boundary, Stage D — NSP Investigation model, Stage E — Attachment sensitivity enforcement, Stage F — Referral disclosure, Stage G — Cleanup

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
Cohesion: 0.08
Nodes (21): 0083 — Case Custom Fields (Template-Defined Administrative Descriptors), Consequences, Context, Data model, Decisions, Deferred (out of scope), The concrete surface (for the build phase), 0084 — Bulk Case Creation ("Múltiplos casos") (+13 more)

### Community 470 - "34. Permission Resolution Algorithm"
Cohesion: 0.33
Nodes (6): 34.1 Input sources, 34.2 Output, 34.3 Expiration, 34.4 Suggested pseudo-code, 34.5 Events that should trigger recomputation, 34. Permission Resolution Algorithm

### Community 471 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.18
Nodes (11): 8.1 `interview_sessions`, 8.2 Optional `interview_session_schedule_history`, 8.3 `interview_session_attendance`, 8. Interview Sessions, Design rationale, Recommended constraints, Rescheduling, Suggested delivery modes (+3 more)

### Community 472 - "Lead notes"
Cohesion: 0.19
Nodes (14): EvidenceCountBadge(), plural(), HospitalReadinessRegister(), OwnershipEditor(), formatPct(), GapListSection(), LevelCard(), ReadinessDashboard() (+6 more)

### Community 473 - "phase-22.md"
Cohesion: 0.13
Nodes (15): Approver isolation preserved, Audit posture (Rule 11) — PASS, B0 anglicization did not weaken authority — verified live, Chained actions bypass no gate, Code quality — PASS, Gate context relied upon (not re-run), INFO (for the record — no action required), New DEFINER read `list_commission_documents` — verified live (+7 more)

### Community 474 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.29
Nodes (9): ADR-0009, updateSession(), AUTHED_REDIRECT_AWAY, config, isPublicPath(), proxy(), PUBLIC_PATHS, redirectPreservingCookies() (+1 more)

### Community 475 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.12
Nodes (17): 0090 — FF-3 Validation Engine: rule vocabulary, coverage, enforcement topology, `required_if`, 1. Rule vocabulary v1 is **six** rule types, pinned by an allowlist, 2. Coverage v1 — scalars and repeating-group children, per instance, 3. Enforcement topology — `error` blocks **submit only**, server-side, 4. `required_if` — a new column, composed over the dispatch, **visibility wins**, 5. Operator authorability — widen `is_valid_condition` to the four F3 operators, 6. Door parity is discharged as a **table**, not an assertion, Amendment 1 — the legacy config-bound lane joins the error surface (2026-07-28) (+9 more)

### Community 476 - "user-registration.spec.ts"
Cohesion: 0.15
Nodes (12): 1. Security — the Open-#3 notify gate (highest priority): **PASS**, 2. Recipient resolution: **PASS**, 3. PHI-free (Rule 12): **PASS**, 4. Additive domain widening: **PASS**, 5. Grant integrity / no new public RPC: **PASS**, 6. `advance_committee_action_item` DEFINER-rebuild integrity: **PASS**, 7. resolve-on-complete correctness: **PASS**, 8. Audit posture: **PASS (consistent, not an omission)** (+4 more)

### Community 477 - "8. Advanced Patterns"
Cohesion: 0.15
Nodes (14): ConditionRow(), condToRow(), DraftRow, emptyRow(), initialToRows(), isLegacySingle(), nextUid(), RecommendWhenEditor() (+6 more)

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
Cohesion: 0.17
Nodes (12): A1 — D11 CORRECTION: the ethics default was backwards, A2·1 — `meetings.visibility_policy` (the replacement), A2 — D6 REPLACED: conjunct A is dropped as a universal rule, A3 — 2b: the agenda-item leak (exists TODAY; conjunct B alone does not close it), A4·1 — Shape: separate the *block* from the *subject*, A4 — 2a: `meeting_closed_sessions`, for case-less pre-formal discussion ONLY, A5 — Three tiers of meeting content (not two), A6 — O5 refined: existence is not secret *within* the committee (+4 more)

### Community 482 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.12
Nodes (16): 0. Source anchors (what already exists — E2 extends/consumes, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables), 2.3 RPCs (all: `assert ethics flag` · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0J·`), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST) (+8 more)

### Community 483 - "0012 — clone_form_version returns the existing draft (one draft per form)"
Cohesion: 0.28
Nodes (15): archivePhaseResult(), authorizeCommission(), commissionOfCasePhase(), commissionOfResult(), createPhaseResult(), mapOverrideError(), mapVocabError(), MESSAGES (+7 more)

### Community 484 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.22
Nodes (9): Backend tasks (`backend`), Follow-on refinement — case-access dialog + narrative-card attribution (2026-06-19, frontend-only), Follow-ups (carried to PROGRESS.md), Frontend tasks (`frontend`), Gate (§6), Increment Archive — Case Access Control & "Meus Casos", Refinement: Case-access dialog + narrative-card attribution (frontend-only) — ✅ FE DONE 2026-06-19, Seed personas (Caso 0001 "Óbito UTI leito 7", commission CCIH; password `Test1234!`) (+1 more)

### Community 485 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.05
Nodes (42): PhaseAnswersReadonly(), ADR-0087, ADR-0091, SubmissionDetailView(), MatrixAxesEditor(), ADR-0089, MatrixConfigDialog(), toPreviewEntries() (+34 more)

### Community 486 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.25
Nodes (8): 12. Performance requirements, 13. Decisions that must not be weakened during implementation, 14. Acceptance criteria, 15. Handoff starting point, 1. Objective, 4. Default access matrix, 9. Application behavior contract, User Permissions Model Handoff

### Community 487 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.20
Nodes (10): 21.1 Typical Interview lifecycle, 21.2 Recommended transition rules, 21. Lifecycle Model, `completed → closed`, `draft → requested`, `in_progress → awaiting_follow_up`, `in_progress → completed`, `inviting_participants → scheduled` (+2 more)

### Community 488 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.15
Nodes (19): ActionState, addCaseParticipant(), AddParticipantState, CaseParticipantInput, createProfessionalProfile(), CreateProfessionalProfileState, notImplemented(), ProfessionalLinkState (+11 more)

### Community 489 - "21. Recommended Dashboard Views"
Cohesion: 0.24
Nodes (10): classify(), emit_neut_guard(), emit_report(), psql_c(), psql_f(), record(), restore_inflight(), p0-authz-writepath-audit.sh script (+2 more)

### Community 490 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.11
Nodes (18): 0. Goal & posture, 10. Rollout, 1. Current state (verified 2026-07-13 — the three tables being collapsed), 2.1 Data model — `public.memberships` (dialect-1: column-per-scope + discriminated shape CHECK), 2.2 Predicate family (`app` schema, DEFINER, `search_path`-pinned, owner=postgres), 2.3 Write door (one pair; `SECURITY DEFINER`; the SOLE write path — mirrors WS-1), 2.4 Audit (blanket trigger on `memberships` — WS-1 H-6 carried verbatim), 2.5 TS layer (`backend`-owned — the frozen stubs `frontend` builds against) (+10 more)

### Community 491 - "27. Example: Simple Action Item"
Cohesion: 0.33
Nodes (12): AuditRow(), actionLabel(), AuditLabelMap, DATE_TIME, displayValue(), entityLabel(), formatAbsolute(), formatRelative() (+4 more)

### Community 492 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.25
Nodes (7): 1. Requirements (§I1–I5 + §4 state machine) — MET, 2. Security / RLS — SOUND (the load-bearing dimension), 3. Collision conformance (S0 §E) — CONFORMANT, 4. Code quality — CLEAN, 5. Findings (Info only — none blocking), QA Review — Interviews v2 (IV2): sessions + reporting/confidentiality, Verdict

### Community 493 - "case-narratives.md"
Cohesion: 0.40
Nodes (4): 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`), Consequences, Context, Decision

### Community 494 - "case-patient.md"
Cohesion: 0.29
Nodes (7): Bug Log, Current Phase Tasks, FF-1 — Repeating Groups (Flexible-Forms Program, phase 1 of 5), FUP-FF1-2 — FF-1 QA non-blocking items (detail rotated out of PROGRESS.md 2026-07-28), ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO), 📋 Remaining pre-pilot work / Completed work, Test Run Summary

### Community 495 - "layout-adjustments-2026-07.md"
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive — SUP core, `20260720000600_supersession_core.sql`), 2.2 Predicates / helpers (`app` schema), 2.3 RPC (DEFINER; SQLSTATE `HC0H·`; t19 grant hygiene), 2.4 Data-access + action stubs (`src/lib/**` — posted first), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Aggregation retrofit (LOAD-BEARING — the full-review item), 4. Audit (+6 more)

### Community 496 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 21. Rejected alternatives, Administrator `OR` arms in RLS, Nine-table ethics procedure set, Ordered `max_confidentiality`, Separate `ethics_appeals`, Separate `ethics_cases` root, Separate `ethics_findings`, Separate `ethics_hearings` (+1 more)

### Community 497 - "loading.tsx"
Cohesion: 0.21
Nodes (11): ActionItemFallbackDialog(), CapaAffordance(), CreateManualAction, OpenCapaAction, ActionState, CreateActionItemState, createManualActionItem(), mapItemError() (+3 more)

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
Cohesion: 0.22
Nodes (9): 1 — Round-1 findings: verified fixed (by my own hand), 2 — 🔴 MAJOR-3 (NEW, blocking) — `meeting_cases` leaks case deliberation to excluded users, 3 — Process note (for the record, not a finding), Disposition vs the `action_items` gap being carried to the PO, Re-review — Round 2 (2026-07-14), Requested change, Verdict: ❌ CHANGES REQUESTED, What is required to clear round 2 (+1 more)

### Community 513 - "3.15 `forms.block_library_options`"
Cohesion: 0.40
Nodes (5): 3.15 `forms.block_library_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 515 - "3.18 `forms.form_matrix_columns`"
Cohesion: 0.40
Nodes (5): 3.18 `forms.form_matrix_columns`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 516 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.22
Nodes (9): 8.1 `draft → submitted`, 8.2 `submitted → accepted`, 8.3 `submitted → declined`, 8.4 `under_review → awaiting_information`, 8.5 `awaiting_information → under_review`, 8.6 `under_review → answered`, 8.7 `answered → resolved`, 8.8 `resolved → under_review` (+1 more)

### Community 517 - "3.9 `forms.form_logic_rules`"
Cohesion: 0.40
Nodes (5): 3.9 `forms.form_logic_rules`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 518 - "4.10 `form_responses.form_answer_revisions`"
Cohesion: 0.22
Nodes (9): 4 INFO forward-notes (hand to backend when the FF phases start — NOT this gate), F3 — Flexible-Forms Foundation (ADR 0060) — durable record, FF roadmap — re-sequenced PRE-pilot 2026-07-27 (each its own ADR + flag + gate), Gotchas / notes, Green bar, QA verdict — ✅ APPROVED (0 B / 0 M / 0 m / 4 INFO), Sequencing note, Test verdict (tester) — E2E GREEN, 0 F3 regressions (+1 more)

### Community 519 - "4.11 `form_responses.form_submission_section_states`"
Cohesion: 0.40
Nodes (5): 4.11 `form_responses.form_submission_section_states`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 520 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.15
Nodes (13): Auth session cache (added 2026-07-28) — ~865 logins → ~300, Batch accounting (added 2026-07-28) — a batch can no longer pass by producing nothing, E2E gating on a prod standalone build, Fault-injection checklist (how each arm was proven, and how to re-prove it), Infra classification + test-count batching (added 2026-07-28, from the FF-5 gate), Recommendations, References, Stack preflight (added 2026-07-28) — why the gate no longer trusts `/health` (+5 more)

### Community 521 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.08
Nodes (26): M1Â·1 â€” B7: respondent linkage Â· **LANDS FIRST**, M1Â·2 â€” the five exclusion-plane **RPC** mutators, M1Â·3 â€” `case_participant_roles`: the 6th exclusion-plane table Â· **UPDATE-freeze**, M1Â·4 â€” the sweep: **35 RPCs + `reclassify_attachment`**, split by remediation shape, M1Â·4b â€” the **11 gate helpers** (D5) â€” *this is where the leverage is*, M1Â·5 â€” A30: platform_admin arms Â· âš  **BLOCKED pending an exhaustive enumeration** (Â§W-4), Summary â€” v3, VERDICT: âœ… **APPROVED** (+18 more)

### Community 522 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.11
Nodes (18): 1. Verdict up front, 2. The current design, as verified, 3.1 The one-vs-four question — agree, with a stronger argument than the audit gives, 3.2 M1 (expiry not an end-to-end contract) — confirmed; scope it tighter, 3.3 M2 (commission role cardinality) — confirmed, and it is UI-reachable today, 3.4 M3 (service-role bypasses of the single door) — confirmed; the split is starker than reported, 3.5 M4 (trigger-only integrity → composite FKs) — confirmed, low, endorsed, 3.6 I1 (one session snapshot) — endorse, and elevate it (+10 more)

### Community 523 - "4.6 `form_responses.form_answer_signatures`"
Cohesion: 0.40
Nodes (5): 4.6 `form_responses.form_answer_signatures`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 524 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.25
Nodes (8): 13.1 One authoritative Case predicate, 13.2 Respondent identity, 13.3 Active exclusion, 13.4 Targeted respondent submission, 13.5 Meeting access, 13.6 Attachment clearance, 13.7 `SECURITY DEFINER` requirements, 13. Authorization model

### Community 525 - "4.8 `form_responses.form_answer_risk_matrix`"
Cohesion: 0.22
Nodes (8): completePhase(), createCase(), insertChoiceOptions(), rpc(), signInAs(), slug(), svcInsert(), ADR-0085

### Community 526 - "4.9 `form_responses.form_answer_references`"
Cohesion: 0.25
Nodes (8): 20.1 Tenant integrity, 20.2 Hard-deny matrix, 20.3 Targeted submission isolation, 20.4 Meeting isolation, 20.5 Procedure lifecycle, 20.6 Classification and clearance, 20.7 Audit, 20. Verification plan

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

### Community 532 - "loading.tsx"
Cohesion: 0.17
Nodes (12): B1 — The `supersede_response` authority gate is bypassable via a direct `responses` INSERT (Rule 1 / ADR 0074 §2 authority model), BLOCKER, Bottom line, M1 — Aggregation retrofit, RPC, and audit are correct and well-covered (informational, no action), M2 — `canCorrect` and the UI affordance are correctly server-gated (informational), M3 — `npm run typecheck` reports errors in generated route validators — NOT a SUP regression (informational), MAJOR, MINOR (+4 more)

### Community 533 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.25
Nodes (8): 6.1 `case_types`, 6.2 `process_templates`, 6.3 `cases`, 6.4 Stable Case-phase keys, 6.5 `case_access`, 6.6 `responses.target_case_participant_id`, 6.7 Case-restricted Meetings, 6. Changes to existing shared tables

### Community 534 - "hospital-admin-tier.spec.ts"
Cohesion: 0.18
Nodes (11): 1. The three r1 blockers — closed, verified by the r1 probes themselves, 2. Mutation proofs — all six re-run, plus four of mine, 3. The sweep table — verified independently, and it is accurate, 4. Full pgTAP, run by me, 5. ⚠ PRE-COMMIT CONDITION — the working tree is not the tree I was given, 6. Carried from r1 — non-blocking, none addressed (correctly), 7. Closing assessment, ✅ APPROVED (+3 more)

### Community 535 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.11
Nodes (26): IndicatorsPanelAsync(), IndicatorsPanel(), DerivedConfig, DerivedDenominatorRef, DerivedNumeratorRef, HospitalIndicatorRollupRow, HybridDerivedConfig, Indicator (+18 more)

### Community 536 - "async-cheap-condition-before-await.md"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 537 - "Prefer Statically Analyzable Paths"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 538 - "server-hoist-static-io.md"
Cohesion: 0.20
Nodes (10): 20. Cycle generation workflow, Step 1: create or claim scheduled occurrence, Step 2: resolve immutable configuration, Step 3: capture occupancy, Step 4: generate targets, Step 5: create form instances and records, Step 6: initialize answers, Step 7: assign work (+2 more)

### Community 539 - "loading.tsx"
Cohesion: 0.14
Nodes (14): 1. Is assignee PHI reach dead AND is every legitimate reader's PHI reach intact?, 2. Is content reach genuinely unaffected?, 3. Both flag branches / the restraint on the member arm, 4. Is Rule 11 coverage preserved in the amended suites?, 5. Is the `level` refusal sound, and is the pin real?, AUTHZ · M3 — QA Review (defect ① narrowing), e2e recommendation: **TARGETED**, not the full suite, Findings (+6 more)

### Community 540 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.18
Nodes (11): Carried forward from r1, still open, still not blocking, FF-5 — QA review r2, Findings, Gate, Neutralisations I re-ran — all confirmed, On F4 and F7 — two nits, deliberately not raised as findings, Probes of my own — two closed a r1 finding, one found a residual, r2-m-1 (MINOR, not blocking) — §O pins the door that exists, not the closure of the writer set (+3 more)

### Community 541 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.50
Nodes (4): 5.10 `referral_status_events`, Columns, Design rationale, Suggested event types

### Community 542 - "Phase 8 — Dashboards & Submissions Browser (archived task detail)"
Cohesion: 0.29
Nodes (7): 5.1 Preserve `memberships`, 5.2 Replace/evolve `case_access` into `case_access_grants`, 5.3 NSP Investigations, 5.4 Meeting participation and linked Cases, 5.5 Attachment clearance, 5.6 Referral PHI Disclosure, 5. Target database model

### Community 543 - "loading.tsx"
Cohesion: 0.14
Nodes (7): advanceToInReview(), draftAndSend(), getToken(), rpc(), RUN_TAG, signInAs(), ADR-0037

### Community 544 - "loading.tsx"
Cohesion: 0.18
Nodes (10): Dimension 1 — Requirements audit (C-1…C-6 + H-8 closed as scoped?), Dimension 2 — RLS / privilege security, Dimension 3 — PHI (Rule 12) + C-6 narrowed claim, Dimension 4 — Integrity invariants, Dimension 5 — Architecture rules, Dimension 6 — Perf changes (WS-5), Findings (all non-blocking), Gate posture (+2 more)

### Community 545 - "21. Recommended Dashboard Views"
Cohesion: 0.22
Nodes (9): 26. API and Service-Layer Boundaries, Design rationale, `InterviewAccessService`, `InterviewConsentService`, `InterviewContentService`, `InterviewParticipantService`, `InterviewService`, `InterviewSessionService` (+1 more)

### Community 546 - "27. Example: Simple Action Item"
Cohesion: 0.50
Nodes (4): 5.9 `referral_case_links`, Columns, Design rationale, Suggested relationship types

### Community 547 - "21. Recommended Dashboard Views"
Cohesion: 0.33
Nodes (6): 2.1 Organization User, 2.2 Hospital NSP Coordinator, 2.3 Hospital NSP Member, 2.4 Committee Coordinator, 2.5 Committee Member, 2. Canonical user categories

### Community 548 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 0074 — Supersession correction model (contract + UX finalization), 1. Schema — one nullable self-FK + two integrity constraints, 2. RPC — `supersede_response(p_response_id, p_reason)` — standalone-only, DEFINER, 3. Aggregation retrofit — latest-in-chain, at the single choke-point (LOAD-BEARING), 4. Audit — `response.superseded` via the MUTATION emitter (not the read allow-list), 5. Feature flag — `response_correction`, 6. UX — "corrigir envio" affordance + status badges, Consequences (+3 more)

### Community 549 - "loading.tsx"
Cohesion: 0.17
Nodes (15): metadata, OrgAuditPage(), ADR-0051, AuditListRow, AuditLogEntry, AuditPage, listAuditForHospital(), listAuditForOrg() (+7 more)

### Community 550 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 7.1 `interview_participants`, 7.2 `interview_participant_roles`, 7. Interview Participants, Design rationale, Primary interviewee constraint, Recommended uniqueness, Removal behavior, Suggested participation statuses (+1 more)

### Community 551 - "loading.tsx"
Cohesion: 0.13
Nodes (13): Bugs the gate caught + fixed (all pre-commit), F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE, Gate (§6), Open risks / deferred, What shipped, INFO (no action required), MINOR, MINOR-1 — `getMeetingAttachmentDownloadUrl` is dead, tier-unaware, and contradicts the door model (+5 more)

### Community 552 - "loading.tsx"
Cohesion: 0.33
Nodes (5): ADR 0003 — pgTAP for database tests, Consequences, Context, Decision, Rationale

### Community 553 - "loading.tsx"
Cohesion: 0.18
Nodes (10): Context accepted without re-litigation (per the task brief), Dimension 1 — RLS coverage & correctness (SECURITY) — PASS, Dimension 2 — RPC grants & authority (SECURITY, t19) — PASS, Dimension 3 — Audit (Rule 11) — PASS, Dimension 4 — Data-access discipline (Rule 9) — PASS, Dimension 5 — Requirements audit vs the plan — PASS, Dimension 6 — Best-practice guardrails — PASS, Non-blocking findings (+2 more)

### Community 554 - "loading.tsx"
Cohesion: 0.12
Nodes (16): 1. Verdict, 2. Domain-fit findings (accreditation practice), 3. Technical-currency findings (spec vs. the 2026-08 platform), 4. What is genuinely right about the proposal, 5. Recommendations (conditions for build approval), External Audit — Phase 16 "Standards Crosswalk & Readiness/Gap Engine", INFO-1 — Downstream dependency, MAJOR-1 — The readiness model is JCI-shaped; ONA readiness is unanswerable without a level dimension (+8 more)

### Community 555 - "loading.tsx"
Cohesion: 0.03
Nodes (60): ADR 0004 — Sign-off enforcement feature flag, Consequences, Context, Decision, Rationale, Update — flag flipped (Phase 6, 2026-06-13), ADR 0005 — `visible_when` condition shape (v1), Context (+52 more)

### Community 556 - "loading.tsx"
Cohesion: 0.04
Nodes (60): ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14), Consequences, Context, Decision, ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a), Alternatives considered, Consequences, Context (+52 more)

### Community 557 - "loading.tsx"
Cohesion: 0.33
Nodes (6): ⚠ Caveats / gotchas for the resuming session, How to run the track (the pattern that's worked all of S1–S3), Remaining to the pilot (after S3), ▶ Resume here: open S4 — ETH·E2 (procedure) · RV2 R2–R5 · CH, Session Handoff — Pre-Pilot Release Scope Expansion (ADR 0071), Where we are

### Community 558 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 20.1 `interview_finding_case_issues`, 20.2 `interview_finding_risks`, 20.3 `interview_finding_action_items`, 20.4 `interview_timeline_event_links`, 20.5 `interview_referral_links`, 20. Integration Tables, Design rationale

### Community 559 - "loading.tsx"
Cohesion: 0.08
Nodes (21): ADR 0032 — Case Narratives (per-case prose interleaved with phases), Alternatives rejected, Consequences, Context, Decision, ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case), Alternatives rejected, Consequences (+13 more)

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

### Community 617 - "loading.tsx"
Cohesion: 0.20
Nodes (10): A10 — Scope: the **record** goes, the **configuration** stays, A11 — Action items: the adjacent channel (**the A3 pattern, again**), A12 — The residue: stated, not claimed away, A13 — ⚠ CONFIRMED FROM THE LIVE CATALOG (was an inventory item; now a finding), A14 — Flagged, **NOT decided**: `can_write_attachment`'s `'case'` arm, A8 — Principle: administration is not a **meeting** source either, A9 — **D4·2 is REVERSED**, Amendment 2 — added test keystones (+2 more)

### Community 618 - "loading.tsx"
Cohesion: 0.33
Nodes (5): ADR 0008 — GSAP as the animation dependency, Consequences, Context, Decision, Rationale

### Community 619 - "loading.tsx"
Cohesion: 0.12
Nodes (16): parseConfig(), ALLOW_OTHER_TYPES, BOUNDED_TYPES, FLAGGED_WHEN_OPS, FLAGGED_WHEN_TYPES, MESSAGES, ParseConfigResult, parseItemConfig() (+8 more)

### Community 620 - "loading.tsx"
Cohesion: 0.25
Nodes (8): AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18), FIX-A — the 26 ERROR core predicates → ALL COVERED (via runlogs, no new keystones), FIX-B — the standing invariant (`p0-authz-invariant.sh`, ADR 0079), FIX-C — 50 mutation-proven isolation keystones (`supabase/tests/25{0,1,2}_authz_p0_isolation.sql`), Follow-up backlog (invariant-surfaced, not silent), Pre-req fixed (`a32be9c`), Sweep (P0-U0) — 292 neutralization cases, Verification (lead + qa each independent, live — §7.14)

### Community 621 - "12.2 `interview_transcript_segments`"
Cohesion: 0.18
Nodes (10): Catalog re-verification (LIVE catalog, local stack, 2026-07-26), Completion record (human-approved 2026-07-27), Coordination flag for the lead — the `CaseEventKind` in-place widen, ETH·E3a — Terminology/UX surfacing — backend design note (BE-1), Explicitly NOT auto-logged in E3a (with reason), Landed in BE-1 (committed contract stubs, typecheck + lint clean 0/0), Mapping table (the 8 new kinds), O-1 — `cases.case_type_id` (E1-surface amendment) (+2 more)

### Community 622 - "2. Architectural Goals"
Cohesion: 0.25
Nodes (7): Bottom line, MINOR-1 — the mutation harnesses leave `pgtap` installed in `public`, which turns the **next** pgTAP run's t19 red, P1 (blocking) — the closed set is a **FLOOR**, not the population: three `SECURITY DEFINER` RPCs authorize on raw arms with no gate, QA Review — AUTHZ · M5: the `is_active` outer gate (defect ③), State pinned (§7.3), What I could NOT check, What I verified and found SOUND

### Community 623 - "9.2 `interview_form_assignments`"
Cohesion: 0.16
Nodes (14): CONTAINER_TYPES, addItem(), reconcileOptionRows(), resolveInsertPosition(), getSessionContext, insert, layoutRows, rpc (+6 more)

### Community 624 - "F-cleanup — residual DB-hardening (durable record)"
Cohesion: 0.33
Nodes (6): 14. Command interfaces, Allegations, Case configuration and access, Decisions and votes, Notices and hearings, Participants and respondent submission

### Community 626 - "phase-multitenancy.spec.ts"
Cohesion: 0.20
Nodes (10): 0091 — FF-5 Entity Reference: three lanes, hybrid participant scoping, and why INFO-2 needs no PHI door, Amendment 1 — `references_never_read_phi` is false as literally worded (2026-07-28), Amendment 2 — `proacl` shows grants, never revokes (2026-07-28), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Open questions (deferred, not blocking) (+2 more)

### Community 627 - "advanced-effect-event-deps.md"
Cohesion: 0.06
Nodes (30): 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema, conditionTargets widening (supersedes a prior decision), Consequences, Context, Decisions, 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values, Alternatives rejected, Consequences (+22 more)

### Community 628 - "advanced-event-handler-refs.md"
Cohesion: 0.25
Nodes (8): ═══════════════════════════════════════════════════════════════════════════, Finding 1 — P0 (org user reads the meeting surface) → **CLOSED**, Finding 2 — MAJOR-1 (`meeting_agenda_items.description` unmasked) → **CLOSED**, Finding 3 — MAJOR-2 (reserved content escapes the meeting child lock) → **CLOSED**, Finding 4 — MAJOR-3 / 228 adjudication → **CLOSED** (predicate correct + mutation-proven falsifiable), Finding 5 — MINOR-1 (respondent gets times/`case_id` from the reserved door) → **substantively addressed; rides as a noted MINOR**, Open risks, Verdict

### Community 629 - "advanced-init-once.md"
Cohesion: 0.25
Nodes (6): Backend (`backend`), Follow-ups (non-blocking — see PROGRESS Follow-ups), Frontend (`frontend`), Gate exec (lead, 2026-06-22), Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`), Summary

### Community 630 - "advanced-use-latest.md"
Cohesion: 0.20
Nodes (10): Findings, INFO-1 — `reason_code` governance signal is real, MINOR-1 — stale comment in the collapsed UI helper (§7.2 #5 shape), MINOR-2 — `m5`/`m6` mutation-audit stale targets (pre-existing A2-era debt), Pre-approved deviations — ruled, QA Review — ADR 0078 Stage B · `case_access → case_access_grants` hard cut (B1→B5), Scope notes, Skeptic battery — the review's core (all under `authenticated`) (+2 more)

### Community 631 - "async-api-routes.md"
Cohesion: 0.12
Nodes (16): 1. The noun rule / D6 — re-derived from `pg_proc`, not accepted on report, 2. platform_admin zero-rows — mutation-proven myself, not accepted on report, 3. Two more keystones spot-checked by live mutation (the brief's other named priorities), 4. D8 — masking and counts-only, verified from SELECT lists in `prosrc`, not from TSX, 5. Arm parity — `evidence_links_artifact_kind_check` vs. the two dispatch functions, 6. `prosecdef` census beside `pg_policies`, for the five new tables and every new function, Answering the coordinator's specific questions, Files most load-bearing to this review (+8 more)

### Community 632 - "async-dependencies.md"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 633 - "async-parallel.md"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 634 - "async-suspense-boundaries.md"
Cohesion: 0.31
Nodes (6): auditRowsFor(), commissionEvents(), pqsInbox(), restGet(), signInAs(), ADR-0042

### Community 635 - "bundle-barrel-imports.md"
Cohesion: 0.29
Nodes (7): 15.1 Question-level policy, 15.2 Answer provenance, 15.3 `form_instance_initializations`, 15.4 Source selection algorithm, 15.5 Initialization must happen once, 15.6 Completion validation, 15. Safe carry-forward design

### Community 636 - "bundle-conditional.md"
Cohesion: 0.29
Nodes (7): 28. Recommended service boundaries, `CarryForwardService`, `EvaluationCycleGenerationService`, `EvaluationFindingService`, `EvaluationMetricsService`, `EvaluationProgramService`, `EvaluationWorkflowService`

### Community 637 - "bundle-defer-third-party.md"
Cohesion: 0.29
Nodes (7): 8. Impact on ADR 0086 — six recommended amendments, A1 — FF-4: fix the `default_source` vocabulary's extensibility (highest value), A2 — FF-2: record that matrix axes are version-frozen, not data-driven, A3 — FF-3: keep the completeness predicate layer open to non-value predicates, A4 — FF-5: document the lane-addition recipe (keep ruling 5 as-is), A5 — ADR 0086 Consequences: name recurring evaluations as out of scope, A6 — Correct the stale ARCHITECTURE.md text before FF-1 starts

### Community 638 - "bundle-dynamic-imports.md"
Cohesion: 0.33
Nodes (5): 0013 — Fix form_versions INSERT RLS self-reference, Consequences, Context, Decision, Options considered

### Community 639 - "bundle-preload.md"
Cohesion: 0.18
Nodes (9): AssignableMember, EditAssignmentDialog(), isoToLocalInput(), ROLE_ORDER, STATUS_ORDER, ReferralRedactDialog(), REFERRAL_MESSAGES, ADR-0037 (+1 more)

### Community 640 - "client-event-listeners.md"
Cohesion: 0.06
Nodes (47): formatDateTime(), metadata, resolveImageUrls(), SubmissionDetailPage(), resolveImageUrls(), BuilderPage(), metadata, resolveImageUrls() (+39 more)

### Community 641 - "client-localstorage-schema.md"
Cohesion: 0.29
Nodes (7): BUG-AIF-001 — Linux repro CONFIRMED; root-cause handoff, Prime suspect + next steps, Reproducible harness (rebuild in ~10 min), Residual confound to close FIRST in the new session, Ruled out (prior session + this one — each by experiment), Temp artifacts from this session, The decisive experiment (what settled it)

### Community 642 - "client-passive-event-listeners.md"
Cohesion: 0.12
Nodes (20): BlockLibraryEntriesContext, BlockLibraryEntriesProvider(), ADR-0092, useBlockLibraryEntries(), BlockLibraryPicker(), LibraryEntryCard(), SAVED_AT_FORMAT, ADR-0092 (+12 more)

### Community 643 - "client-swr-dedup.md"
Cohesion: 0.15
Nodes (13): A fifth site, found by the constraint rather than by reading, ADR 0094 — Membership-model hardening + Diretor Técnico (technical director) backend, Amendment 1 — the four open items, closed (PO, 2026-08-04), Amendment 2 — build-time corrections to decision 2 (W1, verified against the catalog), Amendment 3 — W4 build state (2026-08-04), Amendment 4 — the DT referral plane, settled by interview (PO, 2026-08-04), Amendment 5 — what building the referral plane actually found (2026-08-04), Consequences (+5 more)

### Community 644 - "js-batch-dom-css.md"
Cohesion: 0.22
Nodes (11): formatDate(), generateMetadata(), OrgCommissionDetailPage(), AdminCommissionDetail, AdminCommissionListItem, CommissionRow, getCommissionForAdmin(), listCommissionsForAdmin() (+3 more)

### Community 645 - "js-cache-function-results.md"
Cohesion: 0.33
Nodes (6): EXTENSIONS, files, findings, ROOTS, SKIP_DIRS, walk()

### Community 646 - "js-cache-property-access.md"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 647 - "js-cache-storage.md"
Cohesion: 0.22
Nodes (11): OpenAttachmentButton(), ADR-0063, AttachmentLinkForm(), AttachmentUpload(), AttachmentsPanel(), ADR-0063, ATTACHMENT_KIND_LABEL, AttachmentsPanel() (+3 more)

### Community 648 - "js-combine-iterations.md"
Cohesion: 0.33
Nodes (6): 30. Implementation phases, Phase 1: foundational operational model, Phase 2: generation and bed-matrix workflow, Phase 3: longitudinal carry-forward, Phase 4: findings and escalation, Phase 5: advanced surveillance and integration

### Community 649 - "js-early-exit.md"
Cohesion: 0.33
Nodes (6): 6.1 `hospital_departments`, 6.2 `hospital_units`, 6.3 `hospital_rooms`, 6.4 `hospital_beds`, 6.5 Rationale, 6. Hospital location and bed registry

### Community 650 - "js-flatmap-filter.md"
Cohesion: 0.25
Nodes (8): Backend tasks (owner: `backend`), Design decisions (locked — see ADR 0062), Frontend tasks (owner: `frontend`), Gotchas / must-read before building, Handoff — Meeting actual-occurrence time (`held_at` / `held_end`), Open questions for the product owner (decide at plan review), Problem (one paragraph), Tester / QA

### Community 651 - "js-hoist-regexp.md"
Cohesion: 0.18
Nodes (8): ADR 0020 — Dashboard-countable responses: case-phase exclusion, Consequences, Context, Decision, Backend (`backend`), Frontend (`frontend`), Lead notes — Phase 8 (verbatim, archived), Phase 8 — Dashboards & Submissions Browser (archived task detail)

### Community 652 - "js-index-maps.md"
Cohesion: 0.18
Nodes (11): Archive — Follow-ups / Deferred Items (full snapshot incl. resolved), Closed 2026-07-05 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-07 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-15 (rotated out of PROGRESS live Follow-ups — E0/E1 now COMPLETE), Closed 2026-07-18 (rotated out of PROGRESS live Follow-ups — AUDIT-DOOR-BLINDNESS now COMPLETE), Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items), Follow-ups / Deferred Items, 🔴 FUP-P16-1 — **14** never-called doors fail the ADR 0079 floor (pre-existing, NOT Phase 16) (+3 more)

### Community 653 - "js-length-check-first.md"
Cohesion: 0.22
Nodes (9): 1. What shipped, 2. The decision that changed the phase, 3. Defects found, and what each proves, 4. Eight checks that were vacuous by construction, 5. Gate evidence, 6. Open items, 7. Process findings, FF-5 — Entity Reference (ADR 0091) — phase record (+1 more)

### Community 654 - "js-min-max-loop.md"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 655 - "js-request-idle-callback.md"
Cohesion: 0.22
Nodes (9): AcreditacaoPage(), metadata, ADR-0093, CloneFrameworkDialogTrigger(), FrameworkList(), ADR-0093, FrameworkStatusChip(), AccreditationFramework (+1 more)

### Community 656 - "js-set-map-lookups.md"
Cohesion: 0.40
Nodes (5): 21. Changes during a round, Discharged before assessment, New admission after generation, Patient moved after snapshot, Patient transferred between beds

### Community 657 - "js-tosorted-immutable.md"
Cohesion: 0.40
Nodes (5): 24.1 Required authorization dimensions, 24.2 Aggregate versus identifiable access, 24.3 RLS inheritance, 24.4 Privileged operations, 24. Permissions and Supabase RLS

### Community 658 - "rendering-activity.md"
Cohesion: 0.40
Nodes (5): 5.1 Identifiers and timestamps, 5.2 Multi-tenant integrity, 5.3 Historical data, 5.4 Controlled vocabulary, 5. Conventions and cross-cutting requirements

### Community 659 - "rendering-animate-svg-wrapper.md"
Cohesion: 0.40
Nodes (5): 8.1 `evaluation_programs`, 8.2 `evaluation_program_scopes`, 8.3 `evaluation_program_schedules`, 8.4 Rationale, 8. Evaluation programs

### Community 660 - "rendering-conditional-render.md"
Cohesion: 0.20
Nodes (4): signInAs(), signOut(), ADR-0033, ADR-0063

### Community 661 - "rendering-content-visibility.md"
Cohesion: 0.19
Nodes (11): parseDefaultSource(), parseDefaultValue(), parseItemFields(), parseOptions(), parseRequiredIf(), parseVisibleWhen(), CONDITION_OPS, isValidCondition() (+3 more)

### Community 662 - "rendering-hoist-jsx.md"
Cohesion: 0.40
Nodes (4): ADR 0001 — Scaffolding & toolchain bootstrap, Consequences, Context, Decisions

### Community 664 - "rendering-hydration-suppress-warning.md"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 666 - "rendering-script-defer-async.md"
Cohesion: 0.33
Nodes (4): Lead notes, Phase 22 — Inter-Committee Case Referrals (`case_referrals`), Summary, Tasks

### Community 667 - "rendering-svg-precision.md"
Cohesion: 0.29
Nodes (7): Backend — B1–B7 + QA MINOR (HC084) DONE (local; awaiting remote push), Frontend — F1–F5 built (components + actions), lint+typecheck green, Lead — full-suite gate run + two REAL bugs caught & fixed, Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062), Out of scope (pre-existing branch failures — NOT this feature), Outcome, Tester T1 — `e2e/meeting-held-time.spec.ts` 5/5 (chromium, `--workers=1`, fresh reset)

### Community 668 - "rendering-usetransition-loading.md"
Cohesion: 0.50
Nodes (4): 11.1 `evaluation_targets`, 11.2 Continuity keys, 11.3 Rationale for explicit polymorphism, 11. Typed evaluation targets

### Community 669 - "rerender-defer-reads.md"
Cohesion: 0.50
Nodes (4): 18.1 `evaluation_findings`, 18.2 Explicit join tables, 18.3 Escalation policy, 18. Findings and escalation

### Community 670 - "rerender-dependencies.md"
Cohesion: 0.50
Nodes (4): 22.1 Optimistic locking, 22.2 Assignment and claim, 22.3 Offline drafts, 22. Concurrency and offline behavior

### Community 671 - "rerender-derived-state.md"
Cohesion: 0.50
Nodes (4): 26. Example: daily patient infection surveillance, Next-day initialization, Prior evaluation, Program

### Community 672 - "rerender-derived-state-no-effect.md"
Cohesion: 0.50
Nodes (4): 3.1 Existing form engine responsibilities, 3.2 New evaluation domain responsibilities, 3.3 Integration boundary, 3. Bounded contexts and ownership

### Community 673 - "rerender-functional-setstate.md"
Cohesion: 0.50
Nodes (4): 7.1 `patient_encounters`, 7.2 `bed_assignments`, 7.3 Rationale, 7. Patient encounters and occupancy

### Community 674 - "rerender-lazy-state-init.md"
Cohesion: 0.50
Nodes (4): 9.1 `evaluation_cycles`, 9.2 State transition invariants, 9.3 Rationale, 9. Evaluation cycles

### Community 675 - "rerender-memo.md"
Cohesion: 0.20
Nodes (8): ALLOWLIST, DML_VERBS, EXTENSIONS, ADR-0075, ADR-0094, ROOT, SCAN_DIRS, violations

### Community 676 - "rerender-memo-with-default-value.md"
Cohesion: 0.67
Nodes (3): 12.1 `evaluation_records`, 12.2 Rationale, 12. Evaluation records

### Community 677 - "rerender-move-effect-to-event.md"
Cohesion: 0.67
Nodes (3): 13.1 `evaluation_observation_contexts`, 13.2 Rationale, 13. Observation-time context

### Community 678 - "rerender-no-inline-components.md"
Cohesion: 0.67
Nodes (3): 17.1 `evaluation_program_views`, 17.2 Critical principle, 17. Bed-matrix and rapid-entry model

### Community 679 - "rerender-simple-expression-in-memo.md"
Cohesion: 0.67
Nodes (3): 27. Example: head-of-bed adherence, Program, Snapshot and results

### Community 694 - "decisions-log.md"
Cohesion: 0.29
Nodes (7): metadata, SignoffQueuePage(), ADR-0061, formatDate(), SignoffQueueList(), SignoffQueueRow, listSignoffQueue()

### Community 703 - "loading.tsx"
Cohesion: 0.29
Nodes (6): CorrectionRequestItem(), ADR-0085, canDecideCorrection(), canWithdrawCorrection(), describeImpactSnapshot(), impactPhaseStatusLabel()

### Community 705 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.09
Nodes (23): 4.10 `form_responses.form_answer_revisions`, 4.2 `form_responses.form_answers`, 4.4 `form_responses.form_repeating_group_instances`, 4.9 `form_responses.form_answer_references`, 4. Answer Storage Layer, Design Reasoning, Design Reasoning, Design Reasoning (+15 more)

### Community 706 - "page.tsx"
Cohesion: 0.33
Nodes (6): 17. State invariants, Allegation, Case, Decision, Meeting, Notice

### Community 707 - "ADR 0004 — Sign-off enforcement feature flag"
Cohesion: 0.15
Nodes (13): 0. Scope, 10. Task breakdown (contract-first; one Phase Gate), 11. Risks / open decisions, 1. Catalog reconciliation (spec §21 is stale — use these, verified 2026-07-20), 2. Schema (migration `20260818000000` — after the latest shipped `20260817002200`), 3. Typed contract (`backend` posts stubs first — contract-first), 4. Cadence semantics (`meeting_cadence_status`, migration `20260818000100`), 5. Carry-forward semantics (`suggest_carry_forward`, migration `20260818000100`) (+5 more)

### Community 708 - "parse-config.ts"
Cohesion: 0.40
Nodes (5): 11.1 Case tests, 11.2 Meeting tests, 11.3 Referral tests, 11.4 Grant-door tests, 11. Regression-test matrix

### Community 709 - "14. Recommended Indexes"
Cohesion: 0.40
Nodes (4): 0012 — clone_form_version returns the existing draft (one draft per form), Consequences, Context, Decision

### Community 711 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.47
Nodes (4): metadata, OrgIndicatorsPage(), HospitalIndicatorScorecard(), getHospitalIndicatorRollup()

### Community 712 - "11.1 `interview_notes`"
Cohesion: 0.07
Nodes (32): ADR 0079 — AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule, Consequences, Decision, 0086 — Flexible-Forms feature phases FF-1…FF-5 pulled pre-pilot, Consequences, Context, Decision, Sequencing & dependencies (lead schedules; detail in the program plan) (+24 more)

### Community 713 - "Feature — `case_phase_results` (per-phase categorical result + manual override)"
Cohesion: 0.07
Nodes (24): ADR 0009 — Local JWT verification for the auth gate & identity, Consequences, Context, Decision, Rationale, 0010 — Denormalize email onto public.profiles, Consequences, Context (+16 more)

### Community 714 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.33
Nodes (5): 0011 — Position reorder via deferrable constraints + SQL swap RPCs, Consequences, Context, Decision, Options considered

### Community 921 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.14
Nodes (14): 2.1 DEFINER door hygiene (t19) — all 36 ethics functions, 2.2 Non-vacuity — authority-first, distinct SQLSTATE — **demonstrated live**, 2.3 Case-read boundary — every E2 table, verbatim `can_read_case`, no new shape, 2.4 D13 targeted door — reaches only the one response, never the case, 2.5 M2 retention (Rule 12 — Class-2 professional identity), 2.6 Catalogs, N arm, flag, Conformance checklist (build plan §5), Dimension 1 — Requirements (ADR 0073 §4 + the 0078 reconciliation) (+6 more)

### Community 922 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.29
Nodes (6): Follow-ups (non-blocking), Gate, Increments — each verified via git scope + LIVE catalog + `set local role` keystone, mutation-proven, Lessons (transferable), RV2 R2–R5 — Referrals v2 Governance (COMPLETE), SQLSTATEs (block `HC0A·`)

### Community 923 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.31
Nodes (8): classify(), emit_report(), psql_c(), psql_f(), record(), restore_inflight(), p0-authz-door-audit.sh script, want()

### Community 924 - "10. Row-Level Security Strategy"
Cohesion: 0.22
Nodes (9): Context, Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 — Implementation Plan, Risks / open items, Verification summary, Wave 0 — Lead + contract (before any feature code), Wave 1 — Backend: schema + belongs/freshness (Migrations A–B, pgTAP 278–279), Wave 2 — Backend RPCs/doors/seed ∥ Frontend scaffolding, Wave 3 — Frontend wiring + hospital surface ∥ Tester (+1 more)

### Community 925 - "useClientNow"
Cohesion: 0.40
Nodes (5): 4.8 `form_responses.form_answer_risk_matrix`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 926 - "ADR 0005 — `visible_when` condition shape (v1)"
Cohesion: 0.22
Nodes (9): 1. Tester: finish the 3 E2E-spec fixes (specs only — never app code), 2. Lead: definitive FULL regression (green declaration), 3. QA review → 4. Human approval → 5. §6 Record, DONE + committed, Key facts for resume, Open decision for the human (non-blocking), PENDING — resume here (in order), Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03) (+1 more)

### Community 933 - "AuditEntityType"
Cohesion: 0.40
Nodes (5): ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry, Alternatives rejected, Consequences, Context, Decision

### Community 934 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.12
Nodes (17): A. Groundwork findings (verified 2026-07-13, this branch), AI (satellites + cross-link) — authored 2026-07-13, B. SQLSTATE block allocation (ratified — high-water `HC099`), C. Feature-flag plan (ratified), D. Cross-cutting conventions (recorded once — bind every track), E. Collision contracts (locked — per-track reviews are conformance checks, not re-litigation), ETH·E1 (access spine) — authored 2026-07-13 · **M2 posture = the regulatory sign-off keystone**, ETH·E2 (procedure) — authored 2026-07-13 (+9 more)

### Community 935 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.40
Nodes (5): 0071 — Pre-pilot release scope expansion, Consequences, Context, Decision, Sequencing & dependencies (within the pre-pilot block; lead schedules)

### Community 936 - "phase-result-options.ts"
Cohesion: 0.12
Nodes (9): 0070 — Interview data-model v2: sessions + reporting / confidentiality columns, Consequences, Context, Decision, 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1, Consequences, Context, Decision (+1 more)

### Community 937 - "ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)"
Cohesion: 0.02
Nodes (59): ═══════════════════════════════════════════════════════════════════════════, ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target, Consequences, Context, Decision, 0062 — Meeting actual-occurrence time (`held_at` / `held_end`), Consequences, Context (+51 more)

### Community 940 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.18
Nodes (14): IndicatorDetailPage(), metadata, isPqsOperatorOfIndicatorHospital(), ADR-0057, RunChart, RunChartLoader(), INDICATOR_DIRECTION_LABELS, IndicatorSeriesPoint (+6 more)

### Community 941 - "5.11 `referral_resolutions`"
Cohesion: 0.31
Nodes (7): CollectRegistry(), CredentialFields(), EMPTY_DRAFT, formatDate(), hasAnyDraftInput(), isDraftComplete(), LiveRegistry()

### Community 942 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.33
Nodes (5): ADR 0002 — Admin claim via custom access token hook, Consequences, Context, Decision, Rationale

### Community 943 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.18
Nodes (8): ADR 0027 — Case Timeline (read-only event aggregation, two layouts), Consequences, Context, Decision, Gate, Lead notes, Phase 12 — Case Timeline (archived task detail), Tasks

### Community 944 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.40
Nodes (5): 11.1 Purpose, 11.2 Proposed schema, 11.3 Integrity, 11.4 Reminder integration, 11. New table: `case_notices`

### Community 945 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.40
Nodes (5): ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos"), Alternatives rejected, Consequences, Context, Decision

### Community 946 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.40
Nodes (4): ADR 0006 — Supabase API key scheme vs. env var naming, Consequences, Context, Decision

### Community 947 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.13
Nodes (15): 5.11 `referral_resolutions`, 5.6 `referral_internal_notes`, 5.7 `referral_document_links`, 5. Table Definitions, Columns, Columns, Columns, Constraints (+7 more)

### Community 948 - "10. Row-Level Security Strategy"
Cohesion: 0.40
Nodes (5): 7.1 Purpose, 7.2 Proposed schema, 7.3 State transitions, 7.4 Authorization, 7. New table: `case_access_exclusions`

### Community 1440 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.40
Nodes (5): 8.1 Purpose, 8.2 Proposed schema, 8.3 Category strategy, 8.4 Finding history, 8. New table: `case_allegations`

### Community 1441 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.25
Nodes (8): BLOCKER — RESOLVED, Code quality / hygiene, Non-blocking observations (address opportunistically), QA-B-1 — pgTAP `189` disposal keystone (was 2 red; now green) — RESOLVED (`693ea60`), QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`, Requirements coverage — ADR 0052 deliverables, Security / RLS findings, Verdict: **APPROVED** (2026-07-03; was CHANGES REQUESTED, cleared same day)

### Community 1442 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.20
Nodes (10): 6.1 `interviews`, 6. Core Interview Aggregate, Recommended invariants, Status semantics, Suggested confidentiality values, Suggested Interview categories, Suggested priority values, Suggested recording policies (+2 more)

### Community 1443 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.40
Nodes (5): 9.1 Purpose, 9.2 Proposed schema, 9.3 Original Decision versus review Decision, 9.4 Issuance invariants, 9. New table: `case_decisions`

### Community 1444 - "AuditEntityType"
Cohesion: 0.04
Nodes (51): Appendix A — Polymorphism dialects (three sanctioned; closes hardening D12; ADR 0065), Appendix B — Catalog-vs-enum + freeze conventions (ADR 0065), ARCHITECTURE.md — Hospital Commission Forms Platform, Architecture Rules, This is NOT the Next.js you know, ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21), Consequences, Context (+43 more)

### Community 1445 - "ARCHITECTURE.md — Hospital Commission Forms Platform"
Cohesion: 0.29
Nodes (7): 0093 — Phase 16 replan: Standards Crosswalk & Readiness/Gap Engine v2, Amendment 1 (2026-08-03, PO planning interview — build-plan rulings), Amendment 2 (2026-08-03, Wave 0 catalog verification — corrections to D10 and D5), Amendment 3 (2026-08-03, Wave 1 — the two freshness buckets D5 never assigned), Consequences, Context, Decisions

### Community 1446 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.50
Nodes (4): 3.1 Case capabilities, 3.2 Meeting capabilities, 3.3 Capability sources, 3. Authorization vocabulary

### Community 1448 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 6.1 Required functions, 6.2 Security-definer posture, 6.3 RLS policy shape, 6. Central authorization interface

### Community 1449 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.40
Nodes (5): Addendum — CASCADE collateral (fixed in 20260720000500), ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split, Consequences, Context, Decision

### Community 1451 - "form-builder-enhancements.md"
Cohesion: 0.50
Nodes (4): 5.12 `referral_read_receipts`, Columns, Design rationale, Primary key

### Community 1452 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.40
Nodes (5): 3.17 `forms.form_matrix_rows`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1453 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.29
Nodes (7): 3.3 `forms.form_sections`, Design Reasoning, Example `layout_config`, Important Columns, Purpose, Relationships, Suggested Table

### Community 1454 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.39
Nodes (5): blind_from_findings(), psql_admin(), run_arm_floor(), run_arm_policy(), p0-authz-invariant.sh script

### Community 1455 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.50
Nodes (4): 7.1 Classification, 7.2 Minimum necessary, 7.3 Restricted PHI, 7. PHI boundary

### Community 1456 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.50
Nodes (4): 8.1 Audit events, 8.2 Deactivation and suspension, 8.3 Expiry and revocation, 8. Audit and lifecycle requirements

### Community 1457 - "13.1 `interview_statements`"
Cohesion: 0.29
Nodes (7): Backend surface (durable map in `docs/backend-state.md` §CH), Deferred (additive, no rebuild — ADR 0080 Consequences), Non-blocking follow-ups (QA INFO — accepted/by-design), S4·CH — Committee Charters & Meeting Cadence (Phase 21) — complete, Task ledger (all lead-verified live; commits on `main`), Test-pass gate — the `e2e:prod` triage (worth remembering), What shipped

### Community 1458 - "case-meetings-panel.spec.ts"
Cohesion: 0.12
Nodes (16): ADR 0087 rulings, Amendment 1, MAJOR-1 — `completeness_deadlock_negative_groups` and the top-level half of `conditional_required_honoured` cannot fail, MAJOR-2 — `group_instances_cross_user_denied` (J1) does not test the clause it names, Other invariants, r1 · 1. Method, r1 · 2. P0-1 — correcting a response silently destroys every choice answer inside a repeating group, r1 · 3. MAJOR findings (+8 more)

### Community 1460 - "case-meetings-panel.spec.ts"
Cohesion: 0.25
Nodes (8): 28. Validation Rules, Consent rules, Finding and summary rules, Interview rules, Participant rules, Session rules, Statement rules, Transcript rules

### Community 1461 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.40
Nodes (5): 4.3 `form_responses.form_answer_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1463 - "27. Example: Simple Action Item"
Cohesion: 0.22
Nodes (9): ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors, Alternatives rejected, BUG-NSP-004 — the non-event CAPA fallback must be applied to EVERY org-gate, uniformly, Consequences, Context, Decision, Implementation notes (sub-phase A, backend — discovered during build), M3 — "gate-fixed but body-not-scoped" (the second QA fix-loop class) (+1 more)

### Community 1464 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.29
Nodes (7): ADRs, Data-access & action modules, Deferred (carried as a follow-up, not gate-blocking), Migrations, Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail), Tests / Gate, What shipped

### Community 1465 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 10.1 Referral read access, 10.2 Message insertion, 10.3 Internal notes, 10.4 Documents, 10.5 Linked cases, 10. Row-Level Security Strategy

### Community 1466 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 4.1 `form_responses.form_submissions`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 1468 - "5.8 `referral_message_documents`"
Cohesion: 0.29
Nodes (7): 35. Rejected Simplifications, Case permission automatically grants all Interview content, Every participant must be a user, Interview as a calendar event, One table containing the entire Interview, Store all content in a generic notes table, Store recordings in PostgreSQL

### Community 1470 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.29
Nodes (7): 5.1 `people`, 5.2 `person_professional_credentials`, 5. Shared Person Model, Design rationale, Recommended constraints, Suggested `person_type` values, User linkage

### Community 1471 - "add-block-menu.tsx"
Cohesion: 0.27
Nodes (10): AuditMotion(), CaseDetailMotion(), FALLBACK_MS, getMotionDurations(), Gsap, MOTION_EASE, readDurationMs(), RiseInGroup() (+2 more)

### Community 1473 - "loading.tsx"
Cohesion: 0.13
Nodes (15): 0. Scope, 1. Sequencing & dependencies, 2. Collision matrix — shared surfaces, serialized ownership, 3. Phased sequence, 4. Feature-flag plan, 5. Migration ownership & docs, 6. Testing & gates, 7. Risks & open decisions (+7 more)

### Community 1474 - "10. New table: `case_votes`"
Cohesion: 0.67
Nodes (3): 10.1 Proposed schema, 10.2 Eligibility, 10. New table: `case_votes`

### Community 1475 - "12. Optional table: `ethics_decision_details`"
Cohesion: 0.67
Nodes (3): 12.1 Graduation rule, 12.2 Proposed schema, 12. Optional table: `ethics_decision_details`

### Community 1476 - "ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case)"
Cohesion: 0.40
Nodes (5): 4.5 `form_responses.form_answer_files`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1477 - "error.tsx"
Cohesion: 0.67
Nodes (4): run251(), run252(), run_case(), p0b-isolation-mutation-audit.sh script

### Community 1478 - "loading.tsx"
Cohesion: 0.33
Nodes (5): ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`, Consequences, Context, Decision, Rationale

### Community 1479 - "loading.tsx"
Cohesion: 0.33
Nodes (5): ADR 0022 — Cross-committee case referrals (linked cases), Consequences, Context, Decision, Future shape (when built — not now)

### Community 1480 - "error.tsx"
Cohesion: 0.33
Nodes (6): 12.1 `interview_transcripts`, 12.2 `interview_transcript_segments`, 12. Transcripts and Recordings, Search implications, Speaker validation, Transcript storage strategy

### Community 1481 - "error.tsx"
Cohesion: 0.33
Nodes (6): 2.1 Support any committee type, 2.2 Support registered and unregistered participants, 2.3 Preserve evidentiary integrity, 2.4 Enforce strict confidentiality, 2.5 Integrate with existing platform modules, 2. Architectural Goals

### Community 1482 - "error.tsx"
Cohesion: 0.33
Nodes (6): 9.1 `interview_topics`, 9.2 `interview_form_assignments`, 9. Interview Preparation, Design rationale, Design rationale, Recommended constraints

### Community 1483 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.50
Nodes (4): 5.2 `referral_context_versions`, Columns, Constraints, Design rationale

### Community 1485 - "error.tsx"
Cohesion: 0.67
Nodes (4): run_case(), run_m2(), run_m3(), m1-mutation-audit.sh script

### Community 1486 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 5.8 `referral_message_documents`, Columns, Design rationale, Primary key

### Community 1488 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 32. Implementation Phases, Phase 1 — Essential Interview workflow, Phase 2 — Structured investigation, Phase 3 — External portal and automation

### Community 1489 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.33
Nodes (6): ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke, Consequences, Context, Decision, Residual (accepted; not blocking pre-pilot), Two rejected fixes

### Community 1491 - "5.4 `referral_assignments`"
Cohesion: 0.11
Nodes (18): ReadinessChart, ReadinessChartLoader(), ReadinessBar, ReadinessChart(), CHART_COLORS, DistributionChart(), fullDay(), shortDay() (+10 more)

### Community 1492 - "page.tsx"
Cohesion: 0.40
Nodes (5): 10.1 `interview_consents`, 10. Consent and Recording Authorization, Recommended constraints, Recording gate, Uniqueness strategy

### Community 1493 - "5.1 `case_referrals`"
Cohesion: 0.33
Nodes (6): 5.1 `case_referrals`, Columns, Design rationale, Important constraints, Recommended priority values, Recommended status values

### Community 1495 - "17.1 `interview_external_access_links`"
Cohesion: 0.40
Nodes (5): 17.1 `interview_external_access_links`, 17. External Participant Access, One-time link behavior, Recommended constraints, Security requirements

### Community 1497 - "34. Testing Strategy"
Cohesion: 0.40
Nodes (5): 34.1 Database invariant tests, 34.2 RLS tests, 34.3 Security tests, 34.4 Workflow tests, 34. Testing Strategy

### Community 1498 - "Lead notes"
Cohesion: 0.33
Nodes (6): Build detail, Gate + fix-loop summary, Lead notes, NOT in Phase A (→ Phase B), Phase A — Hospital-admin tier, 4-tier audit & committee titles, Task table

### Community 1499 - "runLifecycle"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Skipped SELECT/ALL policies (qual = true — intentionally public catalogs)

### Community 1501 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.40
Nodes (5): 11.1 `interview_notes`, 11. Notes, Finalization rule, Visibility rule, Why both author IDs are useful

### Community 1502 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.40
Nodes (5): 25.1 Tenant consistency trigger, 25.2 Status transition function, 25.3 Finalization functions, 25.4 External token consumption function, 25. Recommended Database Triggers and Functions

### Community 1503 - "loading.tsx"
Cohesion: 0.40
Nodes (5): Build (backend BE-1…BE-11, all mutation-proven at authz seams), ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE, Open follow-ups (non-blocking; logged at Record), QA verdict (`docs/reviews/eth-e2-review.md`) — APPROVED, Test gate (Phase Gate §6.2) — green

### Community 1504 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.15
Nodes (13): 0087 — FF-1 Repeating Groups: instance engine, condition scoping, required semantics, 1. Nesting is capped at depth 1, enforced in the schema, 2. Condition scoping — inside-out resolves, outside-in is forbidden at publish, 3. A fully-empty instance is not incomplete — it is not there, 4. FF-1 drops `form_items_conditional_not_required` globally, 5. Instance writers are INVOKER RPCs — correctness doors, not security doors, 6. Both container types ship; `group` is a pure visual container, Amendment 1 (2026-07-27, same day) — three corrections found at plan review (+5 more)

### Community 1505 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.33
Nodes (5): Evidence (independently reproduced), Findings, QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079), Verdict: ✅ APPROVED, Why this is APPROVED, not CHANGES REQUESTED

### Community 1506 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.40
Nodes (5): 11.1 Submit referral transaction, 11.2 Send message transaction, 11.3 Resolve referral transaction, 11.4 Reopen referral transaction, 11. Domain Services and Transaction Boundaries

### Community 1508 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.40
Nodes (5): 17. Suggested Repository and Service Boundaries, Application layer, Domain layer, Infrastructure layer, Presentation layer

### Community 1510 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.18
Nodes (11): ADR 0087 §Gate keystones — final state, r2 · 1. Method, r2 · 2. P0-1 — RESOLVED ✅, r2 · 3. MAJOR-1 and MAJOR-2 — RESOLVED ✅, r2 · 4. Regression sweep — the r1-proven keystones survived the rework, r2 · 5. Gate status, r2 · 6. Carried-forward and new findings — none blocking, r2 · 7. Note for the record (+3 more)

### Community 1511 - "Phase CH — Committee Charters & Meeting Cadence — QA Review"
Cohesion: 0.33
Nodes (6): 1. Security / RLS crux (the ADR-0078/0079 way — row-visibility, not "revert the predicate"), 2. Requirements — ADR 0080 D1–D11 + §9, 3. PHI / Rule 12 — CH holds no patient data, 4. Code quality & notifications, 5. INFO (non-blocking, no action required to pass the gate), Phase CH — Committee Charters & Meeting Cadence — QA Review

### Community 1512 - "19. Status History and Audit"
Cohesion: 0.50
Nodes (4): 19.1 `interview_status_history`, 19.2 Platform audit requirements, 19. Status History and Audit, Design rationale

### Community 1513 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.20
Nodes (9): AUDIT-DOOR-BLINDNESS P0 — Sweep Triage & Fix Plan, FIX-A — the 26 ERROR cases → ALL COVERED (resolved via runlogs, no new work), Fix plan (PO-scoped 2026-07-18: invariant + high-risk + resolve unknowns; low-severity allowlisted), Method (the oracle — proven), Non-vacuity (§7.10) — keystones must not read 0-from-empty, Pre-req fixed en route, Reachability filter (Rule 1 — the RLS policy is the live boundary only if PostgREST can reach the table), Results — 292 neutralization cases (+1 more)

### Community 1514 - "23. Encryption and Sensitive Data"
Cohesion: 0.50
Nodes (4): 23.1 Column-level encryption candidates, 23.2 Plaintext metadata, 23.3 Key management, 23. Encryption and Sensitive Data

### Community 1515 - "22. Retention, Deletion, and Legal Hold"
Cohesion: 0.50
Nodes (4): 22.1 General rule, 22.2 Different content may have different retention periods, 22.3 Legal hold, 22. Retention, Deletion, and Legal Hold

### Community 1516 - "31. Performance Considerations"
Cohesion: 0.50
Nodes (4): 31.1 Expected access patterns, 31.2 Transcript scale, 31.3 RLS performance, 31. Performance Considerations

### Community 1518 - "hospital-departments.spec.ts"
Cohesion: 0.40
Nodes (5): 5.4 `referral_assignments`, Columns, Design rationale, Suggested assignment roles, Suggested assignment statuses

### Community 1520 - "useClientNow"
Cohesion: 0.53
Nodes (5): AuditFeed(), getServerSnapshot(), getSnapshot(), subscribe(), useClientNow()

### Community 1524 - "32. Implementation Phases"
Cohesion: 0.25
Nodes (8): Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07, Gate bugs found + fixed (all tester-verified), Migrations (6, pushed to remote 2026-07-07), Notes / follow-ups, Test gate result, Test reconciliation (test-side only; app was sound), The 10 tasks (all delivered), Time-field: masked → segmented (human decision 2026-07-07)

### Community 1530 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.40
Nodes (4): ADR 0019 — The default (anchor) section may carry a title, Consequences, Context, Decision

### Community 1534 - "supersede-document-button.tsx"
Cohesion: 0.33
Nodes (4): parseRequired(), CONDITION, ADR-0087, ADR-0087

### Community 1535 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.40
Nodes (4): ADR 0021 — Due dates for case phases, Consequences, Context, Decision

### Community 1536 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.40
Nodes (4): ADR 0023 — Configurable per-committee case status, Consequences, Context, Decision

### Community 1537 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.40
Nodes (5): 0066 — patient_xref case-module grain re-keyed to the patient participant, Consequences, Context, Decision, Rationale

### Community 1539 - "0085 — Case Correction Lifecycle (phases + narratives)"
Cohesion: 0.40
Nodes (5): 0085 — Case Correction Lifecycle (phases + narratives), Consequences, Context, Decision (10 points, each PO-locked), Explicitly out of scope v1 (extension paths verified open)

### Community 1540 - "5.2 `referral_context_versions`"
Cohesion: 0.40
Nodes (5): 0076 — Notifications (S1·N): pilot scope — prove one vertical deep, Consequences, Context, Decision, Follow-up (recorded at the N gate, 2026-07-13)

### Community 1541 - "4.12 `form_responses.form_submission_draft_snapshots`"
Cohesion: 0.40
Nodes (5): 4.12 `form_responses.form_submission_draft_snapshots`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1543 - "loading.tsx"
Cohesion: 0.33
Nodes (5): Acessos (senha de todos: `Demo1234!`), Como aplicar, O que a demonstração cobre, Observações, Seed de demonstração — Comissão de Revisão de Prontuário

### Community 1544 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.40
Nodes (5): 4.7 `form_responses.form_answer_matrix_cells`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1548 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.40
Nodes (5): 3.8 `forms.form_block_default_values`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1550 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.40
Nodes (5): Commits (branch `feat/pre-pilot-foundations-plan`, local — not pushed to remote; pre-pilot reset-OK), Deferred (post-pilot), F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE, Gate (§6), Tasks (all ✅)

### Community 1557 - "AUTHZ Write-Path Door-Blindness Audit — Findings"
Cohesion: 0.50
Nodes (3): AUTHZ Write-Path Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous)

### Community 1561 - "AuditEntityType"
Cohesion: 0.50
Nodes (4): ENTITY_ICON, EntityIcon(), resolveEntityIcon(), AuditEntityType

### Community 1564 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.40
Nodes (5): Focus-area verdicts, Hygiene, MINOR findings (non-gating — recommend fast-follow, not blocking the gate), QA Review — S1·N Notifications (Phase 20), Verdict: **APPROVED**

### Community 1585 - "13.1 `interview_statements`"
Cohesion: 0.50
Nodes (4): 13.1 `interview_statements`, 13. Statements, Design rationale, Provenance requirement

### Community 1591 - "20. Reminder Rules"
Cohesion: 0.67
Nodes (3): 20. Reminder Rules, Responsibility, Suggested Schema

### Community 1598 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 14.1 `interview_findings`, 14. Findings, Approval invariant, Design rationale

## Knowledge Gaps
- **6701 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `$schema` (+6696 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **901 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Page` connect `Case Department Field` to `phase8-dashboard.spec.ts`, `Staff Case Detail`, `QA Review — Phase B: NSP-per-hospital + `nsp_org_admin``, `Page`, `rendering-conditional-render.md`, `Referral Actions & Reply`, `markdown-renderer.tsx`, `OrgAuditPage`, `Submission Detail Blocks`, `Admin Layout & Claims`, `Interview & Agenda Forms`, `Derived Indicator Config`, `form-model-normalization.spec.ts`, `phase15-indicators.spec.ts`, `Interview badges`, `CaseActionItemForm`, `Case tags panel`, `Page`, `form-builder-enhancements.spec.ts`, `AuditFeed`, `Case document delete`, `Page`, `ad-hoc-narratives.spec.ts`, `administrativo.spec.ts`, `member-action-items-overview.spec.ts`, `DepartmentDefDialog`, `ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors`, `Page`, `Phase 10 — Meetings (archived task detail)`, `Loading`, `Phase 17 — Controlled-Document Lifecycle · QA Review`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Phase Answers & Assignments` to `Shared UI & Phase Dialogs`, `Error & Not-Found Boundaries`, `Triage Disposition & Pathways`, `Case Documents`, `Form Builder Actions`, `Submission Detail (Answer Model)`, `NSP Event Pages`, `RCA Analysis Stage`, `Referral Detail & Formatting`, `Quality Indicators`, `NSP Patient Registry`, `My Cases List`, `Auth Callback & Meeting Settings`, `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA`, `Case & Phase Actions`, `Meeting Detail & Agenda`, `Form Item Editor & Tests`, `Submission Detail Blocks`, `Phase Responder & Submissions`, `Case Narrative Cards`, `loading.tsx`, `Interview & Agenda Forms`, `Forms & Process Templates`, `Derived Indicator Config`, `Narrative Templates`, `Layout`, `IsTerminalMeetingStatus`, `Page`, `Section signoff fields`, `TitleAssignControl`, `Condition builder`, `Page`, `VersionWithUrl`, `UploadDialog`, `Case tags panel`, `Wizard runner`, `Route`, `ActionItemRow`, `CaseActionItemsPanel`, `Page`, `Page`, `Referral patient fields`, `Page`, `Outcomes actions`, `DepartmentDefDialog`, `9.2 `interview_form_assignments``, `Audit feed`, `Page`, `Format`, `ADR 0028`, `client-event-listeners.md`, `js-batch-dom-css.md`, `js-cache-storage.md`, `Meeting form dialog.test`, `js-request-idle-callback.md`, `Page`, `Titles`, `Page`, `Phase result options`, `decisions-log.md`, `0013 — Fix form_versions INSERT RLS self-reference`, `Avatar stack`, `Audit icon`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `phase7-cases.spec.ts`, `case-phase-result.spec.ts`, `Quick Reference`, `Action Items Data Model Handoff`, `case-narratives.spec.ts`, `QA Review — Option A: Shared (non-PHI) `action_items` table`, `Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)`, `cases-extras.spec.ts`, `phase14b-triage.spec.ts`, `commission-overview.tsx`, `Lead Playbook — orchestration protocol (lead only)`, `ADR 0017 — Multi-Phase Cases`, `phase14d-capa.spec.ts`, `ADR 0008 — GSAP as the animation dependency`, `0013 — Fix form_versions INSERT RLS self-reference`, `ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke`, `0012 — clone_form_version returns the existing draft (one draft per form)`, `loading.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `cn()` connect `PHASES.md — Hospital Commission Forms Platform` to `Loading`, `Admin & Auth Pages`, `Case Lifecycle Actions`, `Error & Not-Found Boundaries`, `Loading`, `Loading`, `Triage Disposition & Pathways`, `Loading`, `RCA Problem Stage`, `Case Documents`, `Shared UI & Phase Dialogs`, `CAPA Badges`, `NSP Event Pages`, `Phase 15 — Quality Indicators (Indicadores de Qualidade)`, `js-request-idle-callback.md`, `Referral Detail & Formatting`, `RCA Analysis Stage`, `bundle-preload.md`, `Quality Indicators`, `phase14b-triage.spec.ts`, `Titles`, `My Cases List`, `Architecture Rules (binding)`, `rca-header.tsx`, `1. Eliminating Waterfalls`, `Meeting Detail & Agenda`, `NSP CAPA/RCA Pages`, `CAPA Evidence & Cards`, `Page`, `Form Item Editor & Tests`, `Case Narrative Cards`, `Lead Playbook — orchestration protocol (lead only)`, `Forms & Process Templates`, `phase7-cases.spec.ts`, `cases-outcomes-blockers.spec.ts`, `Event Notification & Triage`, `Narrative Templates`, `case-phase-result.spec.ts`, `phase3-admin-members.spec.ts`, `Page`, `Phase result options`, `Page`, `UserLifecycleActions`, `Section signoff fields`, `Page`, `0013 — Fix form_versions INSERT RLS self-reference`, `TitleAssignControl`, `Condition builder`, `Page`, `VersionWithUrl`, `UploadDialog`, `ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke`, `dashboard-charts.tsx`, `Case tags panel`, `AttachmentLinkForm`, `page.tsx`, `Page`, `Avatar stack`, `CaseActionItemsPanel`, `Gantt axis`, `Lead notes`, `Referral patient fields`, `ADR 0021 — Due dates for case phases`, `Outcomes actions`, `DepartmentDefDialog`, `Audit feed`, `Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)`, `Loading`, `Page`, `Loading`, `ConfirmDeleteButton`, `Format`, `Loading`, `phase14a-safety-events.spec.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _6864 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Case Lifecycle Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.101619644723093 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.03291492329149233 - nodes in this community are weakly interconnected._
- **Should `Shared UI & Phase Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._
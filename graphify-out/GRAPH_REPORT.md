# Graph Report - hospital_form_platform  (2026-08-26)

## Corpus Check
- 2916 files · ~5,431,057 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 22335 nodes · 44634 edges · 2016 communities (1105 shown, 911 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 289 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e9de7f18`
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
- phase2-auth-shell.spec.ts
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
- 5.11 `referral_resolutions`
- FF-3 — Validation Engine (`item_validations`) · COMPLETE 2026-07-28
- Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)
- verify-tv-backfill.sh
- loading.tsx
- page.tsx
- validation-rules-editor.tsx
- ARCHITECTURE.md — Hospital Commission Forms Platform
- ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)
- 0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle
- 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1
- 5. Table Definitions
- page.tsx
- 28. Example: Complex Action Item
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- 17. Suggested Repository and Service Boundaries
- loading.tsx
- loading.tsx
- 28. Example: Complex Action Item
- loading.tsx
- loading.tsx
- Shared Action-Items Hub — task detail (Option A → case-fold → member views)
- F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE
- QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)
- ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target
- 0070 — Interview data-model v2: sessions + reporting / confidentiality columns
- 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1
- 16.1 `interview_documents`
- MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record
- 5 · Over-reach audit (things wrongly marked for removal)
- 20. Reminder Rules
- readiness-chart-loader.tsx
- deleteAdHocPhase
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
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- S4·CH — Committee Charters & Meeting Cadence (Phase 21) — complete
- FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)
- 1 · Verification of the three NEW findings
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- V-6 Â· What M1 must cover â€” the authoritative fix set
- loading.tsx
- loading.tsx
- W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**
- sup-supersession.spec.ts
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- 3. Current authorization model
- 9. Team sequencing and file ownership
- 5.4 `referral_assignments`
- 37. Multi-hospital administration edge cases
- 42. Operational recommendations
- 8. Membership tables
- Lead notes
- PCI + Process-Template Versioning — phase detail (archived)
- 4.5 `form_responses.form_answer_files`
- 11. Scoped role-assignment tables
- 35. Administrative UX workflows
- 39. Testing strategy
- 3. Authorization strategy
- 41. Existing-data migration
- 45. Implementation checklist
- 7. Tenant and identity tables
- pre-pilot-hardening-wave2.md
- Manual smoke — meeting audio → generated ata (T5)
- b1-org-admin-wall-mutation-audit.sh
- "Sem processo" — process-less case creation (`processless_cases`)
- ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org
- 2 · Verification of the MOVED / FALSE claims
- 5.2 `referral_context_versions`
- Phase CH — Committee Charters & Meeting Cadence — QA Review
- Round 2 — verification of the fix wave
- 23. Encryption and Sensitive Data
- 14. Explicit case access
- 26. Auditing
- 36. Status transitions
- 9. Permission and role catalog
- ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split
- page.tsx
- q1-quality-mutation-audit.sh
- 0076 — Notifications (S1·N): pilot scope — prove one vertical deep
- 16. Single-hospital customers
- MEM-W4 — Diretor Técnico: roles, appointment AND the referral plane (2026-08-04; ADR 0094 Amendments 3–4; migrations `20260905000400` · `20260905000500` · `20260905000600`; flag `technical_director` **ON**)
- 0085 — Case Correction Lifecycle (phases + narratives)
- 7. Recommended changes for the current project
- 11. Rollout and rollback strategy
- 3. Verified current-state catalog snapshot
- 4.3 `form_responses.form_answer_options`
- 4.4 `form_responses.form_repeating_group_instances`
- 11. Domain Services and Transaction Boundaries
- 17. Suggested Repository and Service Boundaries
- Shared Action-Items Hub — task detail (Option A → case-fold → member views)
- not-found.tsx
- PDF·P2 — PDF printing: Meetings (ata) (COMPLETE 2026-08-08)
- V-0 Â· Corrections to my own v1 â€” visible, not silent
- carry-forward-panel.tsx
- use-title-action.ts
- 14. Handoff checklist
- 2. Method and evidence
- 1. Audit boundary and method
- supersede-document-button.tsx
- CaseLinker
- access-audit-table.tsx
- AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18)
- Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)
- Phase 15 — Quality Indicators (Indicadores de Qualidade)
- Worktrees — parallel Claude Code sessions on this repo
- document-reconciliation.mjs
- referral-flow-charts.tsx
- actions.test.ts
- 0114 — Document model redesign: documents, versions, file objects, securable resources
- 4.1 `form_responses.form_submissions`
- Lead Playbook — orchestration protocol (lead only)
- Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)
- actions.test.ts
- parse-required.test.ts
- ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions
- ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke
- ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`
- Step 2 — Configure the Supabase Cloud project (Dashboard)
- Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)
- QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)
- ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)
- ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry
- ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles
- ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- ADR 0109 — Referral "Registros internos" + the case-access summary door
- 0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns
- 4.7 `form_responses.form_answer_matrix_cells`
- Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record
- referrals.test.ts
- dm4-referral-doors-matrix.sh
- ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)
- ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)
- ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision
- ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal
- ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org
- ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole
- 0070 — Interview data-model v2: sessions + reporting / confidentiality columns
- 5.2 `referral_context_versions`
- 32. Implementation Phases
- Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items)
- Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)
- Pre-Pilot DB Hardening — Wave 1 (archived task detail)
- 21. Recommended Dashboard Views
- Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)
- run-chart-loader.tsx
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
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx
- Live-file closed table + method notes (rotated from PROGRESS.md 2026-08-06)
- ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered)
- ADR 0129 — A narrow disposal flag through the meeting child lock
- VERDICT (r3): **APPROVED**
- case-event-form.test.tsx
- reserved-sessions-panel.tsx
- credentials-editor.tsx
- Language
- cases-ui.jsx
- ADR 0137 batch — MRN as erasure key; case/referral usability (D1–D14)
- ⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**
- ⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO)
- User Registration & Identity Management — phase record (archived)
- QA review — ADR 0136, deferred `staff_admin` sign-off
- ROUND 2 ADDENDUM — 2026-08-21
- check-rules-staleness.mjs
- dsr.test.ts
- p3-case-print-mutation-audit.sh
- Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON)
- Amendment 7 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build time**): bulk creation is a COMPOSITION, and §A1.2's one-arm sentence does not open it
- 0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text
- 0146 — The E2E gate harness must not report green while blind
- Concluded § Now rotations — 2026 Q3
- DSR Slice 3 — build detail (rotated from PROGRESS.md § Now)
- FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)
- PDF·P3 — catalog reconciliation of the authz sweep domain
- 3 · The deviations — all three VERIFIED, including the one arguing for *less* gating
- check-migration-set-local.mjs
- phase-result-options.ts
- p0137-phi-door-mutation-audit.sh
- ADR 0003 — pgTAP for database tests
- ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`
- ADR 0008 — GSAP as the animation dependency
- 0011 — Position reorder via deferrable constraints + SQL swap RPCs
- 0013 — Fix form_versions INSERT RLS self-reference
- ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")
- 0084 — Bulk Case Creation ("Múltiplos casos")
- ADR 0127 — standing rules get a path-scoped home, and a staleness gate
- ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap
- Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings
- Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked
- Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks
- ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases
- ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved
- ai-detail-main.jsx
- cases-views.jsx
- ⛔ AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**
- 5 · The carry — a plain answer
- r2 — ✅ APPROVED
- claude-md-review-signal.mjs
- test-netstat-listener-pids.sh
- page.tsx
- DM follow-up triage — DVF 1:1 + the draft-print delete guard (2026-08-18; DM-FUP TRIAGE #2/#4/#8b; migrations `20260928000600`–`…000700`, **2**; pgTAP `312` 77→80 · `328` 128→130; **LOCAL ONLY — not pushed**)
- REMOTE CENSUS 2026-08-18 (read-only, linked `azkbbhskturikxpgmafq`) — **the production DB is EMPTY, and it was emptied by TRUNCATE/reset semantics, not by deletes**
- ADR 0001 — Scaffolding & toolchain bootstrap
- ADR 0006 — Supabase API key scheme vs. env var naming
- 0012 — clone_form_version returns the existing draft (one draft per form)
- ADR 0019 — The default (anchor) section may carry a title
- 0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns
- ai-detail-app.jsx
- 4.3 `form_responses.form_answer_options`
- 🛑 DM5 gate step 4 — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**
- page.tsx
- page.tsx
- currency-mounting.test.ts
- Review CLAUDE.md against queued session signals
- ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts
- ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL)
- Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk
- Amendment 8 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): `create_case` loses its `app.is_admin()` arm, and Amendment 2's separate PHI gate collapses with it
- 5.2 `referral_context_versions`
- Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)
- Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure)
- 2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING)
- mutate.mjs
- An applied migration is NEVER edited — forward-only, additive
- cases-data.js
- Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)
- 1 · The P0s — CONFIRMED DEAD, behaviourally
- instructions-loaded-probe.mjs
- ActionItemForm
- case-patients-door.test.ts
- BUG-E2EISO-002 — rotated from PROGRESS.md 2026-08-03 (RESOLVED)
- BUG-FF4-001 (rotated from PROGRESS.md at the FF-4 Record, 2026-08-03) — RESOLVED
- Rotated 2026-08-23 — BUG-PHASE-RESULT-PREVIEW-1 (filed and RESOLVED the same session)
- ↩ Rotated from PROGRESS.md 2026-08-19 — the live § Bug Log "Closed" subsection, VERBATIM
- Rotated 2026-08-21 — the DSR remediation P0, RESOLVED
- build-fake-repo.sh
- RelationshipToCase
- UI/layout fixes batch (frontend + backend)
- 1 · Verification of the three NEW findings
- 3 · NEW findings the inventory missed
- V-6 · What M1 must cover — the authoritative fix set
- W-6 · ⭐ THE AUTHORITATIVE, ORDERED M1 SCOPE — `backend` builds from THIS
- W-2 · ⛔→✅ **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**
- ADR 0004 — Sign-off enforcement feature flag
- ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)
- ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke
- 2 · Verification of the MOVED / FALSE claims
- door-sweep-cases.sh
- date-picker-clear-affordance.test.tsx
- ADR 0002 — Admin claim via custom access token hook
- ADR 0005 — `visible_when` condition shape (v1)
- ADR 0009 — Local JWT verification for the auth gate & identity
- 0010 — Denormalize email onto public.profiles
- ADR 0014 — Sanitizing Markdown renderer
- ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)
- ADR 0017 — Multi-Phase Cases
- ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)
- ADR 0022 — Cross-committee case referrals (linked cases)
- ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)
- ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry
- 0058 — Derived quality-indicator measurement compute (the parity lock)
- 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`)
- 0071 — Pre-pilot release scope expansion
- ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split
- 0076 — Notifications (S1·N): pilot scope — prove one vertical deep
- 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1
- ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended)
- 0117 — DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`
- ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement
- ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button
- ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write
- 4.5 `form_responses.form_answer_files`
- AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001 — completion record
- DM follow-up triage — 2026-08-18 (session narrative, rotated)
- ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE
- QA Review — S1·N Notifications (Phase 20)
- referrals.test.ts
- ADR 0020 — Dashboard-countable responses: case-phase exclusion
- ADR 0021 — Due dates for case phases
- ADR 0023 — Configurable per-committee case status
- ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes
- ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures)
- ADR 0027 — Case Timeline (read-only event aggregation, two layouts)
- ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target
- ADR 0101 — The role→landing guard is catalog-derived, not remembered
- ADR 0102 — `p_expires_at` is a real setter on both grant paths (extend-on-regrant)
- ADR 0113 — Referral-module door RETURN shape: the class, not the instance
- 0147 — Masked CPF on the person detail rail
- 0148 — Ever-held affiliation as the person-read boundary
- 13.1 `interview_statements`
- messages.ts
- ADR 0123 — Discarding a draft that has emitted documents
- 20. Reminder Rules
- loading.tsx
- membership-conflict.ts
- ⬛ FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ✅ **CONCLUDED 2026-08-24 by PO ruling: EXPECTED, and in line with platform specifications.** Filed and closed the same day.
- ⬛ FUP-AFF2-REGISTRATION-HAS-NO-START-DATE — ✅ **RESOLVED 2026-08-26** (owner: backend then frontend; AFF4 **F4**, ADR 0151 **D13**)
- ⬛ FUP-AFF2-UPDATE-PROFILE-AFFILIATION-HALF-IS-DEAD — ✅ **RESOLVED 2026-08-26** (owner: backend + PO; AFF4, ADR 0151 **D15**)
- ⬛ FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — ✅ **RESOLVED 2026-08-26** (owner: backend; AFF4 pre-step P3)
- ⬛ FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY — ✅ **RESOLVED 2026-08-26** (owner: backend/lead; AFF4 pre-step P2)
- ⬛ FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY — ✅ **RESOLVED 2026-08-26** (owner: frontend; AFF4 **F1**, ADR 0151 **D17**)

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 802 edges
2. `cn()` - 551 edges
3. `Button()` - 347 edges
4. `Page` - 231 edges
5. `cachedSignIn()` - 222 edges
6. `commissionHref()` - 214 edges
7. `FormBanner()` - 150 edges
8. `getCommissionAccessByOrg` - 144 edges
9. `getSessionContext` - 134 edges
10. `useFieldIds()` - 129 edges

## Surprising Connections (you probably didn't know these)
- `AiAvatar()` --indirect_call--> `w()`  [INFERRED]
  docs/design/temp/action_item_design/ai-detail-ui.jsx → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `AiAvatar()` --indirect_call--> `w()`  [INFERRED]
  docs/design/temp/case_activity_card/ai-detail-ui.jsx → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/administrativo.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/case-access.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/case-surface-split-increment-2.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts

## Import Cycles
- 2-file cycle: `src/lib/queries/cases.ts -> src/lib/queries/process-templates.ts -> src/lib/queries/cases.ts`
- 3-file cycle: `src/lib/queries/case-narratives.ts -> src/lib/queries/cases.ts -> src/lib/queries/process-templates.ts -> src/lib/queries/case-narratives.ts`

## Hyperedges (group relationships)
- **Case triage classification badges (harm, preventability, status, sentinel)** — docs_design_dashboard_kpi_harm_badge, docs_design_dashboard_kpi_preventability_badge, docs_design_dashboard_kpi_status_badge, docs_design_dashboard_kpi_sentinel_flag [INFERRED 0.85]
- **M&M committee KPI overview metrics** — docs_design_dashboard_kpi_kpi_awaiting_screening, docs_design_dashboard_kpi_kpi_on_next_agenda, docs_design_dashboard_kpi_kpi_under_review, docs_design_dashboard_kpi_kpi_overdue_review, docs_design_dashboard_kpi_kpi_closed_ytd, docs_design_dashboard_kpi_kpi_preventable_rate [EXTRACTED 1.00]

## Communities (2016 total, 911 thin omitted)

### Community 0 - "Case Lifecycle Actions"
Cohesion: 0.02
Nodes (150): ADR-0085, CancelCaseButton(), ADR-0032, ADR-0108, ConcludeNarrativeButton(), ADR-0033, ConfirmDeleteButton(), CoordinatorPhaseActions() (+142 more)

### Community 1 - "Admin & Auth Pages"
Cohesion: 0.04
Nodes (132): ADR-0093, LinkEvidenceDialog(), LOW_CARDINALITY_KINDS, BannerTone, FormBanner(), toneStyles, ActivatePhaseDialog(), defaultDueDateValue() (+124 more)

### Community 2 - "Shared UI & Phase Dialogs"
Cohesion: 0.02
Nodes (163): AdminLayout(), ADR-0042, ADR-0106, metadata, safeRedirectTarget(), SelecionarPerfilPage(), ADR-0106, commissionInitials() (+155 more)

### Community 3 - "Error & Not-Found Boundaries"
Cohesion: 0.04
Nodes (93): isOverdue(), localTodayYmd(), MyCapaActionsPage(), ADR-0076, CapaAffordance(), CreateManualAction, OpenCapaAction, CapaActionForm() (+85 more)

### Community 4 - "Condition & Result Rule Editor"
Cohesion: 0.10
Nodes (19): 1.1 · The one that nearly fooled me — recorded, because it is the lesson, 1.2 · Delegation cannot be resolved statically — the lead's cautionary datum, generalized, 1 · The P0s — CONFIRMED DEAD, behaviourally, 2.1 · The proof — mutation testing, 2.2 · Why — and §W-6 named it in advance, 2.3 · The fix — one line, verified, 2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING), 4 · Over-reach audit — **0 found** (+11 more)

### Community 5 - "Phase Answers & Assignments"
Cohesion: 0.04
Nodes (32): `buildAnswerMaps` — read BUG-FF4-001 first, Radix dialog focus — the two halves that replace together, Proving the UI does NOT say something, Two corollaries, ADR 0111 — Printed-document doors return the granted-column composite (FUP-PDF-3), 0116 — DM1 substrate-cutover decisions (executes ADR 0114 D3/D4/D5/D7), Consequences, Decisions (+24 more)

### Community 6 - "Triage Disposition & Pathways"
Cohesion: 0.08
Nodes (56): DispositionRail(), NON_RCA_PATHWAYS, Pill(), VerdictBlock(), HARM_DEFINITIONS, HarmScale(), ChoiceCard(), CLOSURE_DESCRIPTIONS (+48 more)

### Community 7 - "Case Documents"
Cohesion: 0.17
Nodes (13): metadata, appOrigin(), AuthState, buildPickerRedirect(), MESSAGES, requestPasswordReset(), safeRedirectPath(), signIn() (+5 more)

### Community 8 - "RCA Problem Stage"
Cohesion: 0.07
Nodes (56): renderFormResponseBody(), STATUS_LABEL, ADR-0104, actionItemsSection(), agendaSection(), attendanceSection(), metaLine(), renderMeetingBody() (+48 more)

### Community 9 - "Form Builder Actions"
Cohesion: 0.04
Nodes (92): ADR-0011, CONTAINER_TYPES, ActionState, addItem(), addSection(), ALLOWED_IMAGE_MIME, authorizeCommission(), Block (+84 more)

### Community 10 - "Submission Detail (Answer Model)"
Cohesion: 0.07
Nodes (42): DocumentAvailabilityBadge(), AvailabilityPresentation, CapaEvidenceLinkForm(), CapaEvidenceUpload(), CapaEvidenceList(), ADR-0114, MAX_SIZE_MB, NSP_EVIDENCE_ALLOWS_OPEN (+34 more)

### Community 11 - "Section Visibility & Blocks"
Cohesion: 0.06
Nodes (34): 0. Scope, 1. Sequencing & dependency stages, 2. Collision matrix — where two tracks touch one schema surface, 3.1 SQLSTATE block allocation (above the live high-water **HC098**; Referrals holds **HC0A0–HC0A9**), 3.2 Feature-flag plan (mechanism: hand-maintained `FeatureFlags` interface + `get_feature_flags()` RPC), 3.3 Cross-cutting conventions (recorded once), 3.4 Specs still to author at S0 (ADR 0071 §Consequences), 3. Design spine — ratified at the S0 gate (+26 more)

### Community 12 - "CAPA Badges"
Cohesion: 0.04
Nodes (72): SectionConditionFields(), ConditionRow(), condToRow(), DraftRow, emptyRow(), initialToRows(), isLegacySingle(), nextUid() (+64 more)

### Community 13 - "NSP Event Pages"
Cohesion: 0.06
Nodes (67): metadata, NspEventDetailPage(), metadata, ADR-0042, CapaPlanCard(), CustodyHistory(), EventStatusChip(), OwnerChip() (+59 more)

### Community 14 - "RCA Analysis Stage"
Cohesion: 0.07
Nodes (41): metadata, NspConfigPage(), ADR-0052, metadata, NspRosterPage(), ADR-0052, NspPatientsPage(), NspInboxPage() (+33 more)

### Community 15 - "Case Department Field"
Cohesion: 0.02
Nodes (127): actionItemsSection(), createMeetingActionItemUI(), itemRow(), openEditDialog(), openSatellites(), openSatellitesByKeyboard(), reopenSatellites(), signInAs() (+119 more)

### Community 16 - "Referral Detail & Formatting"
Cohesion: 0.02
Nodes (137): CONDITION_TARGET_TYPES, isEligibleTarget(), newChildConditionTargets(), newQuestionConditionTargets(), questionConditionTargets(), sectionConditionTargets(), targetsBefore(), item() (+129 more)

### Community 17 - "Staff Case Detail"
Cohesion: 0.08
Nodes (20): AnswerSummary(), formatIsoDate(), OptionChip(), renderValue(), ADR-0090, ADR-0091, InputItem, choiceItem() (+12 more)

### Community 18 - "Org Overview Dashboard"
Cohesion: 0.06
Nodes (31): 1.1 Table existence, 1.2 RLS policies on the five meeting tables (SELECT + the FOR ALL write policies), 1.3 The `FOR ALL` PERMISSIVE inventory (case / meeting / action-item surface — the §7.6 blind spot), 1.4 Functions — `prosecdef` (a DEFINER's gate REPLACES RLS — §7.2·6), 1.5 Storage policies (meeting bucket) & RPC ACLs, 1. Verified catalog snapshot of the current Stage-C surface, 2. Ordered migration-sequencing plan (one attributable migration per unit), 3. A26 resolution → the C5 propriety-tier predicate + the `case_id IS NULL` branch (+23 more)

### Community 19 - "Quality Indicators"
Cohesion: 0.09
Nodes (26): AddAdHocNarrativeDialog(), AddAdHocPhaseDialog(), ArchiveTemplateVersionsButton(), BeginTemplateEditButton(), DiscardTemplateDraftButton(), NarrativeSlotCard(), PhaseBlocksEditor(), initialResultValue() (+18 more)

### Community 20 - "NSP Patient Registry"
Cohesion: 0.08
Nodes (40): metadata, parseEntityParam(), ADR-0039, ADR-0052, VALID_MODULES, formatDate(), patientModuleChipClass(), ADR-0039 (+32 more)

### Community 21 - "Form Builder Page"
Cohesion: 0.12
Nodes (16): Accreditation & Quality-Governance Track (Phases 13–21), Phase 0 — Scaffolding & Environment, Phase 10 — Meetings, Phase 11 — Interviews, Phase 12 — Case Timeline, Phase 1 — Database Schema, Auth & RLS, Phase 2 — Authentication & App Shell, Phase 3 — Admin Area & User Management (+8 more)

### Community 22 - "CAPA Actions & Closure"
Cohesion: 0.06
Nodes (31): App-layer ripple, App-layer ripple, App-layer ripple, App-layer ripple: **none.**  ### Review flag: 🟢. **Open decision → D8-Q1 (skip vs COMMENT migration).**, Current state, Current state, Current state (full sweep), Current state — structural findings (+23 more)

### Community 23 - "My Cases List"
Cohesion: 0.03
Nodes (115): AddCaseWorkActions(), CaseActionItemsPanel(), CaseCustomFieldChips(), ADR-0083, CaseCustomFieldsPanel(), ADR-0083, OutcomeBreakdownRow, ADR-0032 (+107 more)

### Community 24 - "Auth Callback & Meeting Settings"
Cohesion: 0.10
Nodes (58): LegacyMeetingsSettingsPage(), ActionItemRow(), isItemOverdue(), AgendaRow(), AttendeeRow(), addMeetingAttendee(), addReservedItem(), advanceMeetingActionItem() (+50 more)

### Community 25 - "Referral Actions & Reply"
Cohesion: 0.06
Nodes (64): AssessmentRow, CCIH_FORM_HIGIENE, cloneFrameworkRpc(), createFrameworkRpc(), EvidenceLinkRow, filterIds(), FrameworkRow, getToken() (+56 more)

### Community 26 - "NSP Referrals Dashboard"
Cohesion: 0.10
Nodes (27): ActionState, appOrigin(), assignStaffAdmin(), authorizeStaffAdminOps(), createCommission(), MESSAGES, removeStaffAdmin(), requireAdmin() (+19 more)

### Community 27 - "Case & Phase Actions"
Cohesion: 0.09
Nodes (50): ADR-0135, CasePhaseDelete(), ActionState, activatePhase(), addAdHocPhase(), AddAdHocPhaseState, authorizeCommission(), cancelCase() (+42 more)

### Community 28 - "Meeting Detail & Agenda"
Cohesion: 0.11
Nodes (31): metadata, ReferralDetailPage(), ADR-0094, ADR-0114, ADR-0130, metadata, TechnicalDirectionReferralPage(), ADR-0094 (+23 more)

### Community 29 - "NSP CAPA/RCA Pages"
Cohesion: 0.03
Nodes (90): ADR-0129, addAtividadeRecord(), createCaseWithActiveAssignedPhase(), restGet(), rpc(), signInAs(), ADR-0134, ADR-0137 (+82 more)

### Community 30 - "CAPA Evidence & Cards"
Cohesion: 0.07
Nodes (76): ReferralActions(), ComposerMode, ComposerModeKey, ReferralComposer(), ADR-0037, ReferralNoteCard(), openControlledDocumentVersion(), beginDocumentUpload() (+68 more)

### Community 31 - "Case Narrative Editor"
Cohesion: 0.16
Nodes (11): activate(), createCase(), createResult(), insertOptions(), rpc(), saveAndSubmit(), signInAs(), slug() (+3 more)

### Community 32 - "Form Item Editor & Tests"
Cohesion: 0.40
Nodes (8): archiveDepartment(), createDepartment(), DepartmentActionState, mapDepartmentError(), MESSAGES, renameDepartment(), reorderDepartments(), revalidateHospital()

### Community 33 - "Submission Detail Blocks"
Cohesion: 0.06
Nodes (41): ADR-0111, documentsWaveBEnabled(), errCode(), MIME_EXT, placeDocumentHold(), reclassifyDocument(), releaseDocumentHold(), requestDocumentDisposition() (+33 more)

### Community 34 - "Phase Responder & Submissions"
Cohesion: 0.12
Nodes (43): InterviewLifecycleActions(), isTerminalSession(), SessionActions(), addInterviewInterviewer(), addInterviewLink(), addInterviewSubject(), ALLOWED_ATTACHMENT_MIME, ATTACHMENT_KINDS (+35 more)

### Community 35 - "Case Narrative Cards"
Cohesion: 0.07
Nodes (49): UserLifecycleActions(), isEmailVerificationEnabled(), withFlag(), ActionState, appOrigin(), assignCommitteeRole(), authorizeForCommission(), authorizeForUser() (+41 more)

### Community 36 - "Phase Result Actions"
Cohesion: 0.05
Nodes (49): metadata, ProcessTemplatesListPage(), ADR-0096, CaseTemplateProvenance(), PUBLISHED, ADR-0096, ADR-0096, CreateProcessTemplateDialog() (+41 more)

### Community 37 - "Admin Layout & Claims"
Cohesion: 0.08
Nodes (25): Phase Gate (CLAUDE.md §6), Plan — AFF: hospital affiliation, person identity & the org people directory (ADR 0097), Program shape, Standing traps for this workstream, T1.1 — `public.hospital_affiliations`, T1.2 — `profiles.cpf`, T1.3 — Drop `profiles.home_hospital_id` and `profiles.hospital_employee_id`, T1.4 — `professional_profiles.cpf` (+17 more)

### Community 38 - "Interview & Agenda Forms"
Cohesion: 0.02
Nodes (154): metadata, ADR-0061, PhaseAnswersReadonly(), ADR-0087, ADR-0091, DetailBlock(), formatDateTime(), SectionBody() (+146 more)

### Community 39 - "Forms & Process Templates"
Cohesion: 0.04
Nodes (93): formatCaseNumber(), formatInterviewNumber(), formatNextSession(), interviewTitle(), ConfidentialityBadge(), InterviewCategoryBadge(), InterviewerRoleBadge(), InterviewModalityChip() (+85 more)

### Community 40 - "Derived Indicator Config"
Cohesion: 0.07
Nodes (37): clearAppointment(), dbQuery(), rpcAs(), setCapabilities(), signInAs(), signOut(), ADR-0083, ADR-0134 (+29 more)

### Community 41 - "Meeting Attendees & Quorum"
Cohesion: 0.03
Nodes (138): CollectedAnswers, collectInstances(), collectScope(), InstanceAnswers, ScopeState, topLevelItems(), ADR-0087, CHOICE_TYPES (+130 more)

### Community 42 - "Hospital Detail Pages"
Cohesion: 0.07
Nodes (27): 0. Conflicts named (plan wins) + verified-fact corrections, A.1 `public.attachments` — core (single authorizing owner + six ADR-0063 seams), A.2 `public.attachment_references` — non-authorizing "also appears here" (ADR-0063 §1), A.3 `public.attachment_subjects` — descriptive, PHI-safe, **participant-keyed (C-β)**, A.4 `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), A. Table / column DDL plan (attachments + companions), Appendix — verified F1/baseline build surface (symbols F2 depends on), B.1 `app.commission_of_attachment(owner_type text, owner_id uuid) returns uuid` (+19 more)

### Community 43 - "Narrative Templates"
Cohesion: 0.07
Nodes (36): GET(), SUCCESS_REDIRECT, NotificationPreferencesPage(), ADR-0076, NotificationPreferencesForm(), ORDER, SURFACE_COPY, ADR-0076 (+28 more)

### Community 44 - "Event Notification & Triage"
Cohesion: 0.09
Nodes (22): 0104 — PDF document printing module: record-semantics minting, single registry, template pipeline, QR verification, Alternatives rejected (summary), Amendments (P1 build, 2026-08-07 — lead-ratified at implementation), Amendments (P2 build, 2026-08-08 — PO-ratified "Package A", QA BLOCKER-1/MAJOR-1), Consequences, Context, D10 — QR verification: dedicated token, anemic public answer, D11 — Authorization matrix (+14 more)

### Community 45 - "Page"
Cohesion: 0.06
Nodes (30): 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3), Consequences, Context, Decision, 0069 — Anglicize status-enum internal keys (D11), Consequences, Context, Decision (+22 more)

### Community 46 - "Page"
Cohesion: 0.12
Nodes (16): 12. Transactional Outbox and Notifications, 13. Audit and Retention, 15.1 Optimistic concurrency, 15.2 Pessimistic locking for commands, 15.3 Idempotency keys, 15. Concurrency Control, 16. Suggested Application-Layer Domain Model, 18.1 Referral inbox (+8 more)

### Community 47 - "Layout"
Cohesion: 0.05
Nodes (51): metadata, SignoffQueuePage(), ADR-0061, ADR-0136, metadata, ADR-0078, ADR-0084, ADR-0096 (+43 more)

### Community 48 - "Page"
Cohesion: 0.05
Nodes (37): ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got, Consequences, Context, Decisions, The gap the roles table exposes (QA finding M-3), Two premise corrections found while scoping (one re-corrected by QA), ETH·E4 — Ethics participant seating & professional identity (phase record), Final gate record (+29 more)

### Community 49 - "IsTerminalMeetingStatus"
Cohesion: 0.07
Nodes (51): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createHelmetManager() (+43 more)

### Community 50 - "Page"
Cohesion: 0.06
Nodes (59): BulkCreateWizard(), BulkStepProcess(), CaseBulkGrid(), formatRowList(), GridCell(), GridRowView, MappingRow(), PasteMappingPanel() (+51 more)

### Community 51 - "UserLifecycleActions"
Cohesion: 0.09
Nodes (45): metadata, AddVersionForm(), DetailNotice(), NOTICES, DocumentActionsMenu(), PublishDocumentDialog(), RemindAction, RemindApproverButton() (+37 more)

### Community 52 - "Page"
Cohesion: 0.07
Nodes (28): 1.1 Source, 1.2 The named gap: `staff_admin` / `staff`, 1.3 Why this table is really a *by-role* table, not a *by-precedence* table, 1. The role → landing-route table (extracted, not invented), 2.1 What the plan assumes, 2.2 What is actually in the codebase: two independent chains, 2.3 The gap this creates for the picker, 2.4 Where the picker step inserts (assuming §7's Q1 resolves toward "one decision point") (+20 more)

### Community 54 - "Section signoff fields"
Cohesion: 0.03
Nodes (94): canFillAssignedPhase(), isAssignedTo(), ADR-0137, ADR-0134, ADR-0136, ADR-0137, buildCaseCorrectionsData(), CaseCorrectionsData (+86 more)

### Community 55 - "ListMeetings"
Cohesion: 0.29
Nodes (7): AI track — Action-Items Satellites + Cross-Link UI + reminder→N scan arm, Build catch (BE-6·N, recorded for posterity), Gate results — all green, Key decisions, Migrations / files, Pre-pilot follow-ups (PO-directed, NOT this phase), What shipped

### Community 56 - "Page"
Cohesion: 0.08
Nodes (23): 15.1 `interview_summaries`, 15. Summaries, 16.1 `interview_documents`, 16. Document Integration, 1. Domain Overview, 24. Indexing Strategy, 27. Frontend Implications, 29. Enum Implementation Strategy (+15 more)

### Community 57 - "TitleAssignControl"
Cohesion: 0.04
Nodes (99): DecideAdmissibilityDialog(), EthicsAdmissibilityPanel(), IntakeDialog(), toLocalInput(), AddAllegationDialog(), EthicsAllegationsPanel(), RecordFindingDialog(), severityToken() (+91 more)

### Community 58 - "Condition builder"
Cohesion: 0.08
Nodes (36): CharterFormState, FREQUENCIES, saveCharter(), CADENCE_TONE, CadenceStatusBadge(), ADR-0080, CarryForwardPanel(), formatDate() (+28 more)

### Community 59 - "Interview badges"
Cohesion: 0.04
Nodes (85): ADR-0082, CoreFileFacts, coreFileFor(), createDraftOnlyDoc(), NOTE: `.focus()` is deliberately NOT used — it is not auto-waiting, races RSC, ADR-0114, ADR-0118, ADR-0081 (+77 more)

### Community 60 - "Page"
Cohesion: 0.07
Nodes (40): ADR-0025, AttendeeForm(), AttendeeMemberOption, AttendeesPanel(), QuorumSummary(), AttendanceBadge(), ACTION_ITEM_STATUS_LABEL, ACTION_ITEM_STATUS_STYLE (+32 more)

### Community 61 - "CaseActionItemForm"
Cohesion: 0.08
Nodes (43): getAudioJobStatus(), isAudioServiceConfigured(), ActionState, applyMinutesReview(), ApplyMinutesReviewState, cancelMinutesJob(), failAndCleanUp(), readMinutesTranscript() (+35 more)

### Community 62 - "VersionWithUrl"
Cohesion: 0.12
Nodes (34): CloneFrameworkDialog(), SimpleCandidateSelect(), ActionState, cloneFramework(), CloneFrameworkState, createFramework(), CreateFrameworkState, deleteStandard() (+26 more)

### Community 63 - "UploadDialog"
Cohesion: 0.03
Nodes (127): metadata, PrimeiroAcessoPage(), CommissionConfigurationHome(), metadata, OrgAccreditationPage(), metadata, OrgAdministratorsPage(), ADR-0051 (+119 more)

### Community 64 - "Layout"
Cohesion: 0.05
Nodes (42): 10. Findings, 1.1 `case_phases` carries status/assignee/recommended only — never answers, 1.2 Coordinator board reads (`list_cases_board` / `get_case_detail`), 1.3 `case_phase_answer_map` is submitted-only, 1.4 `recompute_recommendations` is submitted-only end-to-end, 1.5 `responses_select` / `answers_select` not broadened, 1.6 RLS check in the E2E suite, 1.7 Service-role key not reachable client-side (+34 more)

### Community 65 - "Page"
Cohesion: 0.07
Nodes (27): A0 · Findings already CONFIRMED from the catalog (2026-07-15) — start here, then extend, A0 · Migration contract — **catalog-driven** (no SQL until this is reviewed), A1 · pgTAP first (authored before the SQL), A2 · The resolver, A3 · `case_types.default_visibility_policy`, A4 · Repoint policies — **⛔ D4·1 IS A NO-OP AS THE ADR SCOPES IT** (ADR 0078 **A21**), A5 · ⛔ Performance gate — **exit criterion, before policies repoint**, B1 · `case_access_grants` (hard cut) (+19 more)

### Community 66 - "Case tags panel"
Cohesion: 0.25
Nodes (8): Gate state (session 2 scope — NOT the full §6 gate), Gate state (session 3 scope — NOT the full §6 gate), INFO-3 (types half) + INFO-4, MINOR-1 — pagination (red observed past the page boundary, as required), MINOR-2 — the lost-update race (proven with a real interleaving), MINOR-3 — stuck `verifying` is now swept (reconciled with T4), Resumption session 2026-08-13, part 3 (backend) — QA r1 MINOR-1/2/3 + INFO-3/4 closed, Shared-stack note (method, for the record)

### Community 67 - "Event type manager"
Cohesion: 0.05
Nodes (41): 1. Evidence and limitations, 2.1 Identity, account state, and session responsibility, 2.2 Standing tenant authority, 2.3 Affiliation and person visibility, 2.4 Domain and exception authorization, 2.5 Enforcement planes, 2. How authorization currently works, 3. What should be preserved (+33 more)

### Community 68 - "Page"
Cohesion: 0.05
Nodes (83): ADR-0065, EthicsProcedurePage(), metadata, ADR-0073, ADR-0134, EthicsCoordinatorControls(), NotificationRow(), EthicsProcedure() (+75 more)

### Community 69 - "Page"
Cohesion: 0.13
Nodes (15): 0. Why, 1. The three-bucket disposition (summary — full rationale in the evaluation doc), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 5. Avoided items (recorded so builders don't reintroduce them), 6. Testing & gates, 7. Risks & open decisions for the product owner (+7 more)

### Community 70 - "Phase result badge"
Cohesion: 0.05
Nodes (40): 1. Requirements Audit (PHASES.md §Phase 5), 2. Security / RLS Audit (Architecture Rule 1 + Rule 3), 3. Code Quality (Architecture Rule 9 + CLAUDE.md §8), 4. UX & Accessibility (CLAUDE.md §8, Architecture Rule 7), 5. Hygiene, 6. Findings, 7. Scope Deferrals Confirmed (Not Findings), 8. RLS Verification Summary (+32 more)

### Community 71 - "Wizard runner"
Cohesion: 0.06
Nodes (61): ADR-0123, saveAndExit, saveSection, signSection, submitCasePhaseResponse, submitResponse, ADR-0136, ADR-0085 (+53 more)

### Community 72 - "Case timeline"
Cohesion: 0.08
Nodes (24): 0. Scope, 1. Collision matrix — the four initiatives against each other, 2. The design spine (D-remainder folded in) — conventions ratified at F0, 3. Phased sequence, 4. Rule 12 / Rule 2 amendment plan (who writes what, when), 5. Disposition of every hardening Wave-3/4 item (initiative D), 6. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 7. Testing & gates (+16 more)

### Community 74 - "Page"
Cohesion: 0.04
Nodes (60): GET(), ADR-0104, ADR-0120, PrintCurrency, printCurrencyFrom(), ALL_STATUSES, ALL_VALUES, ADR-0126 (+52 more)

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
Cohesion: 0.08
Nodes (25): dependencies, class-variance-authority, clsx, date-fns, gsap, lucide-react, next, pdf-lib (+17 more)

### Community 80 - "Loading"
Cohesion: 0.25
Nodes (8): Collision conformance (S0 §E), Commits (branch `pre-pilot-release-s0`), Gate (CLAUDE.md §6) — all ✅ (human-approved 2026-07-14), Open follow-ups (non-blocking), RV2·R1 — Referrals v2 · Dialogue Core — completed-track record, SQLSTATE, Two runtime-caught fixes (both by the frontend's dev-server verification — pgTAP structurally couldn't), What shipped (R0 → R1)

### Community 81 - "Loading"
Cohesion: 0.09
Nodes (22): 1. Data model (shared by both layouts), 2. Design token mapping, 3.1 Geometry constants (recommended; adapt to your scale), 3.2 Axis header, 3.3 Background layers (behind events), 3.4 Phase bars (width = duration), 3.5 Single-day pins, 3.6 Event states (visual) (+14 more)

### Community 82 - "Route"
Cohesion: 0.03
Nodes (58): ⭐⭐ ADDENDUM 2026-08-18 — the defense ALREADY EXISTED, was correct, and was UNREACHABLE, ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped), ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now"), Follow-ups — live detail (OPEN items), 🟡 FUP-ACL-APP-POPULATION — ⭕ **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO), 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend), 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead), 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06) (+50 more)

### Community 83 - "ActionItemRow"
Cohesion: 0.16
Nodes (25): CaseParticipantRoleManager(), CaseTypeDialog(), EMPTY, ADR-0064, ActionState, authorizeOrg(), CaseTypeInput, createCaseType() (+17 more)

### Community 84 - "CaseActionItemsPanel"
Cohesion: 0.24
Nodes (20): EventTypeManager(), SentinelCriterionManager(), mapTriageError(), SAFETY_MESSAGES, ADR-0030, archiveEventType(), archiveSentinelCriterion(), confirmTriage() (+12 more)

### Community 85 - "Case document delete"
Cohesion: 0.03
Nodes (52): ADR-0026, fieldContainer(), fillTimeField(), pickDate(), pickDateKeyboard(), setDateTimeField(), setDateTimeFieldKeyboard(), callRPC() (+44 more)

### Community 86 - "Gantt axis"
Cohesion: 0.15
Nodes (13): ADR 0097 — Hospital affiliation, person identity (CPF) and the org-scoped people directory, Affiliation, Alternatives rejected, Consequences, Context, Decisions, Doors and boundaries, Identity (+5 more)

### Community 87 - "Tsconfig.json"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 88 - "Active Cases Table"
Cohesion: 0.13
Nodes (20): Active Cases Table, Case Review Lifecycle (screening → agenda → review → action items → closed), Case Row (MM-2026-xxxx, patient, event, service, harm, preventability, lead, status), Harm Severity Badge (Death / Permanent / Temporary / Near miss), KPI: Awaiting screening (7), KPI Card Row (top metrics strip), KPI: Closed YTD (38), KPI: On next agenda (4) (+12 more)

### Community 89 - "DevDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, eslint-config-next, @fontsource/ibm-plex-mono, @fontsource/ibm-plex-sans, @fontsource/ibm-plex-serif, jsdom, @playwright/test (+16 more)

### Community 90 - "Page"
Cohesion: 0.06
Nodes (31): 1. Requirements / Deliverables, 2. Security / RLS, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, ADR coverage, Baseline security fix, Commission picker (`/c/page.tsx`) (+23 more)

### Community 91 - "Recommend when editor"
Cohesion: 0.06
Nodes (31): 22. Key Design Decisions and Justifications, Decision, Decision 10 — Audit both reads and writes for sensitive cases, Decision 1 — Replace patient-centered case ownership with generic committee cases, Decision 2 — Add `case_types`, Decision, Decision, Decision (+23 more)

### Community 93 - "Page"
Cohesion: 0.14
Nodes (35): CaseNarrativeDelete(), addAdHocNarrative(), addTemplateNarrative(), archiveNarrativeType(), assignNarrative(), authorizeCommission(), authorizeCommissionConfig(), CaseLayoutOrderItem (+27 more)

### Community 94 - "Page"
Cohesion: 0.07
Nodes (29): 0 · CAPA-surface confirmation (B1 (a) — closes the pre-WS-3c-baseline risk), 1.1 `public.indicators`, 1.2 `public.indicator_measurements`, 1.3 `app.mint_indicator_code()` — per-commission (reuses the `mint_meeting_number` pattern), 1.4 Flag seed — **OFF**, 1.5 RLS (Rule 1) — **posture (b): DEFINER-RPC-only writes (LEAD DECISION 2026-07-05)**, 1.6 Audit AFTER-triggers (Rule 11 — non-sensitive allow-list, **never `description_md`**), 1 · Migration set (B2 — `20260712000000_indicators_core.sql`) (+21 more)

### Community 95 - "Page"
Cohesion: 0.10
Nodes (20): 1. What I re-proved myself (all green — no finding), 2. BLOCKING findings, 3. MAJOR — coverage gaps (behaviour verified CORRECT by me; a regression would be undetectable), 4. MINOR, 5. INFO (no action required), 6. Assessment of the lead's five carried gaps, 7. What I did not verify, 8. Stack state (+12 more)

### Community 96 - "Page"
Cohesion: 0.08
Nodes (45): metadata, NspCapaPage(), ADR-0114, metadata, NspRcaPage(), ADR-0114, auditClinicalView(), CapaActionEvidenceRow (+37 more)

### Community 97 - "ActionItemForm"
Cohesion: 0.07
Nodes (29): 1. Requirements Coverage, 2.1 The three predicates, 2.2 Flag-OFF fallback — no ON-path gap, 2.3 Anon / PUBLIC EXECUTE, 2.4 `case_access` SELECT policy scoping, 2.5 Additive `case_documents` / `case_events` WRITE policies, 2.6 Submitted-only invariant (Phase-7), 2.7 PHI isolation (Architecture Rule 12) (+21 more)

### Community 98 - "Referral patient fields"
Cohesion: 0.07
Nodes (52): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createHelmetManager() (+44 more)

### Community 99 - "ClampCalloutCenter"
Cohesion: 0.07
Nodes (28): 1. Requirements Audit, 2. Security / RLS Audit, 2a. Definer RPC gating, 2b. in_progress-answers invariant (the crux), 2c. B6 anon/PUBLIC EXECUTE revoke, 2d. Export route — no service-role key, 2e. Client-side form filter in `listSubmissions`, 3. Code Quality Audit (+20 more)

### Community 100 - "Actions"
Cohesion: 0.11
Nodes (17): 1. ⭐ The highest-value question: can `authenticated` set `app.in_case_rpc` itself?, 2. §7.7 — does the narrowing bind TOO MUCH? (the lead's stated top risk), 3. Parity — is the door exactly as wide as the PATCH it replaced?, 4. ⭐ Are the 29 keystones vacuous?, 5. The `230` edit — did M3's coverage survive?, 6. Rule 11 / Rule 12 — the audit witness, 7. D3 — genuinely deferred, not silently live in a worse form, 8. ACL / hygiene (+9 more)

### Community 105 - "Page"
Cohesion: 0.10
Nodes (51): mintAxisCode(), generateOptionCode(), resolveOptionCodes(), shortSuffix(), slugifyLabel(), ActionState, AddPhaseState, addTemplatePhase() (+43 more)

### Community 106 - "Outcomes actions"
Cohesion: 0.06
Nodes (54): CapaStage(), AnalysisStage(), SubView, Tab(), Fishbone(), ProblemStage(), RcaStatusChip(), STATUS_CLASS (+46 more)

### Community 108 - "Audit motion"
Cohesion: 0.13
Nodes (15): 1. The P0 — C7/A8 is implemented in the policies and **reversed in the DEFINER doors**, 2. MAJOR-1 — `meeting_agenda_items.description` is unmasked, and PHI-BEARING by its own comment, 3. MAJOR-2 — reserved-session content escapes the meeting child lock, 4. THE 228 ADJUDICATION (tests 115–118) — **the lead's read is CORRECT; one correction is load-bearing**, 5. What I verified as sound, 6. MINOR / INFO, 7. Open risks, 8. Summary (+7 more)

### Community 109 - "CaseTagsPanel"
Cohesion: 0.07
Nodes (26): 1. Requirements audit (vs ADR 0050 + plan §2) — PASS, 1. Security — the Open-#3 notify gate (highest priority): **PASS**, 2. Recipient resolution: **PASS**, 2. RLS — verbatim reuse confirmed (plan §8 primary charge) — PASS, 3. O-1 (fail-closed null-case) — confirmed sound — PASS, 3. PHI-free (Rule 12): **PASS**, 4. Additive domain widening: **PASS**, 4. O-2 (write authority) — RPC bodies match the ratified default — PASS (+18 more)

### Community 110 - "DepartmentDefDialog"
Cohesion: 0.05
Nodes (47): ReferenceConfigEditor(), ADR-0091, describeReferenceConfig(), isCaseScopedOnlyLane(), LaneCopy, reachesCaseScopedLane(), REFERENCE_LANE_COPY, referenceKindLabel() (+39 more)

### Community 111 - "ADR 0050"
Cohesion: 0.09
Nodes (22): 1.1 The triage worksheet (one per event), 1.2 Reach & harm spectrum — `ReachId` (ordered, escalating), 1.3 Harm severity — `HarmId` (NCC MERP / JC tiers), 1.4 Sentinel designated categories (JC "always review"), 1.5 Not-a-PSE closure reasons — `ReasonId`, 1.6 Reporting committees (intake sources), 1.7 Intake event, 1.8 Seed events (de-identified reference) (+14 more)

### Community 115 - "Page"
Cohesion: 0.17
Nodes (10): addCapaAction(), getOwnerToken(), newSignedInPage(), openBell(), openFreshCapaPlan(), rpc(), serviceRpc(), signInAs() (+2 more)

### Community 116 - "Audit feed"
Cohesion: 0.06
Nodes (30): addMultipleChoice(), addQuestion(), advance(), ariaInvalid(), blockCard(), createForm(), enterWizard(), field() (+22 more)

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
Cohesion: 0.09
Nodes (27): DerivedConfigPicker(), PickerForm, PickerOption, PickerQuestion, allowedSources(), BuilderFields(), COMPARATORS, ControlledState (+19 more)

### Community 123 - "BlockConditionNote"
Cohesion: 0.12
Nodes (15): 0. What you're pointing at, 1.1 Push pending migrations, 1.2 Verify asymmetric JWT signing keys (known gap — ADR 0009), 1.3 Register the custom access-token hook, 1.4 Note your keys, 1.5 Email (defer for now), 1. Pre-flight on Supabase Cloud (one-time, before the first deploy), 2. Get the repo onto the droplet (+7 more)

### Community 124 - "ConfirmDeleteButton"
Cohesion: 0.16
Nodes (19): AcknowledgeButton(), CancelButton(), ReopenButton(), CapaTaskList(), CatBlock(), CauseCard(), RootCauseTypePill(), RcaConfirmDelete() (+11 more)

### Community 125 - "Format"
Cohesion: 0.04
Nodes (95): GET(), metadata, roleFromCapabilities(), StaffCaseDetailPage(), ADR-0033, ADR-0085, ADR-0096, ADR-0100 (+87 more)

### Community 127 - "ADR 0028"
Cohesion: 0.06
Nodes (53): allowedRuleTypes(), blankDraft(), dateRangeInputType(), DATETIME_ORDER_OP_LABELS, itemAcceptsValidations(), nextKey(), regexCompilesInJs(), RULE_TYPE_HINTS (+45 more)

### Community 129 - "Corrective Action (PDCA tracked)"
Cohesion: 0.10
Nodes (20): 10. Component inventory, 11. Acceptance checklist, 1.1 Fishbone categories (clinical Ishikawa — the six ribs), 1.2 Root-cause classification, 1.3 PDCA stages (the wheel), 1.4 Seed data (de-identified reference — case "MM-2026-0142"), 1.5 Derived values (single source of truth), 1. Data model (single shared analysis object) (+12 more)

### Community 135 - "Scripts"
Cohesion: 0.06
Nodes (34): scripts, adr:index, build, db:link, db:push, db:reset:linked, dev, e2e (+26 more)

### Community 136 - "Form builder condition engine enhancements"
Cohesion: 0.15
Nodes (13): 0045 — Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys), Alternatives rejected, Consequences, Context, Decision, Delivery, Evaluator parity — the hard invariant (Rule 3), Immutability & RLS (+5 more)

### Community 139 - "Meeting form dialog.test"
Cohesion: 0.06
Nodes (65): ADR-0069, ApproverDocumentPage(), metadata, ApprovalSignForm(), ApprovalDecisionBadge(), ApprovalsPanel(), StepConfirm(), StepDocument() (+57 more)

### Community 142 - "ADR 0052 NSP per hospital"
Cohesion: 0.07
Nodes (31): buildCards(), CommissionHomePage(), ConfigurationCardData, formatNextMeeting(), metadata, OverviewCardData, ADR-0100, metadata (+23 more)

### Community 146 - "Page"
Cohesion: 0.23
Nodes (19): ActionState, archiveCaseOutcome(), authorizeCommission(), authorizeCommissionConfig(), commissionOfCase(), commissionOfOutcome(), commissionOfTemplateVersion(), createCaseOutcome() (+11 more)

### Community 147 - "Page"
Cohesion: 0.09
Nodes (45): At(), be(), Ce(), constructor(), coolingDown(), D(), Dt(), _e() (+37 more)

### Community 148 - "Title badge"
Cohesion: 0.07
Nodes (26): 10. Timeline, 11. Meetings, 12. Decisions, 13. Action Items, 14.4 Recommended RLS Logic, 14. Access Control and Confidentiality, 15. Audit Logging, 16. Morbidity & Mortality Extension Tables (+18 more)

### Community 149 - "Options editor"
Cohesion: 0.20
Nodes (10): 1. The core difference in one paragraph, 2. Feature-by-feature comparison, 3. ESSENTIAL — adopt now (closes the tested back-and-forth gap), 4. DEFER — valuable, sequence after the dialogue loop, 5. AVOID — do not adopt as specified, 6. Protect these when adopting (what the external model lacks — don't regress), 7. Adoption constraints (non-negotiable) + next step, E1. A shared message thread (`referral_messages`) (+2 more)

### Community 150 - "Titles"
Cohesion: 0.11
Nodes (17): B1 · The console list counts a RETIRED task as a COMPLETED one — the `blocked` reader sweep is not complete **[V]**, B2 · The PHI-disposal corridor's keystone assertion passes when the row is absent **[V]**, BLOCKING, ⛔ Deferred — needs catalog verification, Findings on the E2E specs, ranked **[V for the four quoted; R for the rest]**, Item-by-item answers to the audit brief, judgement on the whole slice, M1 · `mapDsrError` returns raw Postgres constraint text for every `dsr_tasks_*` CHECK **[V]** (+9 more)

### Community 151 - "Architecture Rules (binding)"
Cohesion: 0.06
Nodes (48): buildDoneCallback(), buildErrorCallback(), deleteMeeting(), DoneCallbackRefs, getActionItemsByMeeting(), getAgendaItemsByMeeting(), getJobRow(), getLatestJobForMeeting() (+40 more)

### Community 156 - "ADR 0048 — User Registration & Identity"
Cohesion: 1.00
Nodes (3): /auth/confirm Server-Side Handler (verifyOtp token_hash + type), Invite Email Template (pt-BR), Password-Recovery Email Template (pt-BR)

### Community 157 - "Page"
Cohesion: 0.12
Nodes (16): 1. The 4 function targets — each edited correctly, nothing else touched, 2. The 18 policies — all narrowed, `pg_policies` quals read live, 3. Behavioural narrowing + positive twins (RLS-row level, `set local role authenticated`), 4. K2 — the "one level deeper than the policy" leak, verified independently, 5. K3 — action_items SCOPED, not deleted (both directions, one from a fixture), 6. PHI control — never widened, never narrowed, 7. `manage_case_access` kept on scope grounds — keystone-23 independence holds, 8. GAINED = 0 (no widening — the P0 safety property) (+8 more)

### Community 158 - "Page"
Cohesion: 0.08
Nodes (26): 1. BLOCKER — `app.can_manage_professional` is an 8th direct `memberships` reader, outside Stage 2's enumerated list, and Stage 2/3 as written will not fix it, 2. BLOCKER — Stage 0's enum-derivation instruction omits `platform_admin`, which D11 requires to be representable, 3. MAJOR — ADR 0106's "measured, not assumed" enforcement-point census undercounts the live catalog by 47 functions, 4. MAJOR — ADR §3's substrate anchor for `session_context` is false; Stage 3's task description rests on a wrong premise, 5. MAJOR — an RLS policy on `profiles` grants co-member visibility across a suppressed hat, unreached by any stage, 6. MINOR — D12's "~30 functions already use this pattern" precedent doesn't hold up; only one does, 7. MAJOR — Stages 0 and 1 omit the CLAUDE.md §6 step-1 authz arms from their own gates, 8. INFO — Stage 3's revert-twin keystone is well-specified; one additional guard is worth naming explicitly (+18 more)

### Community 159 - "OrgAuditPage"
Cohesion: 0.05
Nodes (43): 10. Risks and what I could NOT verify, 1.1 Tables, 1.2 The name collision — verified, and the single largest hazard in DM3, 1.3 Every routine on the surface (66 total, all `search_path`-pinned), 1.4 RLS policies (verified — SELECT-only everywhere; mutations are command-only), 1.5 Storage — 12 buckets, all private; 13 `storage.objects` policies, 1.6 Triggers, constraints, and the three barriers to a new resource type, 1.7 Inbound FKs (derived from `pg_constraint`, both directions — never by name) (+35 more)

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
Cohesion: 0.03
Nodes (107): formatDateTime(), metadata, ADR-0104, ADR-0125, ADR-0126, metadata, ADR-0033, ADR-0064 (+99 more)

### Community 180 - "Document editor"
Cohesion: 0.12
Nodes (16): 10. Rebuild notes / gotchas, 1. Purpose & scope, 2. Design system (inherited — do not reinvent), 3. Data model, 4. Component inventory, 5. App shell, routing & state (`docs-app.jsx`), 6. Screen — Document register (library) · `docs-library.jsx`, 7.1 Page layout (+8 more)

### Community 198 - "Layout"
Cohesion: 0.29
Nodes (5): ibmPlexMono, ibmPlexSans, ibmPlexSerif, metadata, viewport

### Community 199 - "AttachmentLinkForm"
Cohesion: 0.16
Nodes (11): MatrixAxesEditor(), ADR-0089, MatrixConfigDialog(), toPreviewEntries(), ADR-0089, MatrixGrid, RequiredMark(), ADR-0089 (+3 more)

### Community 208 - "AuditFeed"
Cohesion: 0.09
Nodes (23): 1. What I verified independently (the load-bearing claims), 2. Findings, 3. The A13 / D5×D6 question — my ruling, for the PO, 4. Review of the lead's own work, 5. Gate evidence, 6. Verdict, ⚪ INFO-1 — seam B's 10 cases carry 4 units of evidence, not 10, ⚪ INFO-2 — the sweep's property is scoped to `public.memberships` by choice (+15 more)

### Community 209 - "InterviewLifecycleActions"
Cohesion: 0.09
Nodes (22): BLOCKER, Findings (iteration 1 — context; M1/M2a/I1 now resolved per the table above), I1 — `dispose_case_phi` carries a bare `is_admin()` cross-tenant PHI-erasure arm (pre-existing; out of this phase's two-module scope — flagged for the pending scope decision), I2 — `patient_xref_select_pqs` RLS / `can_read_xref_row` are dead for `authenticated` (defense-in-depth only); design §D item 7 is untestable as written, I3 — `is_admin` sweep summary (every live occurrence, classified), Independent verification (probes I ran), INFO, Iteration-2 delta verdict (all resolved at iter-3) (+14 more)

### Community 210 - "Avatar stack"
Cohesion: 0.05
Nodes (42): ADR-0059, VerificarPage(), lookup(), metadata, ADR-0104, ADR-0125, ADR-0126, VerificacaoResultadoPage() (+34 more)

### Community 218 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 219 - "Audit icon"
Cohesion: 0.06
Nodes (39): BulkTemplateOption, CasePatientEditDialog(), ADR-0137, ADR-0038, ADR-0078, ADR-0137, TemplateOption, ADR-0038 (+31 more)

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
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

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
Cohesion: 0.08
Nodes (25): EthicsDashboardPage(), metadata, ADR-0064, ADR-0073, CHART_COLORS, EthicsBreakdownChart(), EthicsBreakdownRow, ADMISSIBILITY_ORDER (+17 more)

### Community 246 - "Loading"
Cohesion: 0.17
Nodes (12): 1.1 Schema — all new; migration window: next free `20260720…` **after SUP's `…000610`**, 1.2 RPCs (own-row unless noted; **t19**: `revoke all from public` then `grant execute to authenticated, service_role`), 1.3 Event-driven enqueue — wired into existing mutations (backend edits, confirm exact hook points), 1.4 Time-driven scan sources (`compute_due_notifications`) — CAPA + Sign-off + Meeting only, 1.5 Auto-resolve wiring — `app.resolve_notifications_for` called from, 1.6 Flag + types, 1. Backend contract (posted first; `frontend` starts only after the typed stubs land), 2. Frontend surface (starts after §1 stubs land) (+4 more)

### Community 247 - "Loading"
Cohesion: 0.07
Nodes (29): A15·1 — The decision (PO, 2026-07-15), A15·2 — `can_reach_case_on_member_surface` is **UN-RETIRED**, A15 — D11's member arm was a WIDENING. Corrected to `read_case_deliberation`, A16 — The capability lattice is a **partial order**, not a chain, A17 — What A15 fixes elsewhere (no further decisions needed), A18 — Grant door: the exclusion gate, and the Organization User's one surviving arm, A19·1 — Decision (PO), A19 — The confidentiality "ceiling" is a data-destroying trap, not a ceiling (+21 more)

### Community 248 - "Loading"
Cohesion: 0.05
Nodes (38): 0. ⛔⛔ **THIS WHOLE FILE IS DISCHARGED HISTORY AS OF 2026-08-17. DO NOT RESUME FROM IT.**, 0a. (superseded) START HERE — **§13 is the resume point.** Everything in §§11–12 is discharged history., 10. §6 step 3 — ✅ **DISCHARGED: QA APPROVED (r2)**, 2026-08-14, 11. S4 — ✅ AUTHORIZED AND RUN 2026-08-16 (steps 1–2 green; 3–4 owed), 12. ⭐ START HERE IF YOU ARE RESUMING S4 (2026-08-17 03:30), 13.1 Exact state, 13.2 The follow-ups, in the order I would take them, 13.3 Then, in order: `e2e:prod` → PO step 4 → S6 (+30 more)

### Community 249 - "Loading"
Cohesion: 0.08
Nodes (21): CaseRow, continuarButton(), customFieldsGroup(), gotoWizard(), gridRows(), IdentifiersRow, NarrativeRow, narrativesFor() (+13 more)

### Community 250 - "Loading"
Cohesion: 0.05
Nodes (42): ↩ Body rotation 2026-08-24 (ADR 0140) — resolved bodies moved out of follow-ups.md, 🟡 FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE — the `member_can` disjunct has no reachable fixture (owner: backend/tester; filed 2026-08-21, QA r3 §8.3), ⬛ FUP-ADR-AMENDMENT-HAS-NO-BACK-POINTER — ✅ **RESOLVED 2026-08-24** — an amended ADR reads as live, and only the amending ADR knows (owner: lead; filed 2026-08-23 at the AFF2 post-Record documentation review), 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06), ⬛ FUP-AUTHZ-ALLOWLIST-ROT — ✅ **RESOLVED 2026-08-17.** A resolve-in-`pg_proc` check now runs inside `ARM=floor`; it found **SIX** stale entries where this item named one (owner: lead + backend; filed 2026-08-14, DM5 S2), ⬛ FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER — ✅ **RESOLVED 2026-08-24, PO ruling: DELETED** (owner: PO + frontend), 🟡 FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT — the UI boolean cannot express the door's per-phase assignee arm (owner: frontend/PO; filed 2026-08-21, case-surface-split Increment 1, QA F-6; ✅ **RESOLVED 2026-08-22 — PO ruled WIDEN; delivered as a KIND + a server-gate fix**; two residues filed separately; index line rotated → [follow-ups-archive.md](follow-ups-archive.md)), 🟡 FUP-CASE-T5-MEUS-CASOS-UNREPOINTED — T5 shipped narrower than its own text (owner: frontend; filed 2026-08-21, QA F-7; ✅ **RESOLVED 2026-08-22 — PO ruled the behaviour right and the PLAN TEXT wrong**; T5 clarified, index line rotated → [follow-ups-archive.md](follow-ups-archive.md)) (+34 more)

### Community 251 - "Loading"
Cohesion: 0.08
Nodes (25): 1a. New table `referral_note_types` (mirror `case_narrative_types`), 1b. Extend `referral_internal_notes` (extend, do NOT replace), 1c. RPCs (all SECURITY DEFINER, set search_path, Rule 11 audit rows, pt-BR errors), 1d. Mechanics, 1e. pgTAP, ✅ A10 — requested action keeps a home (PO decision, 2026-08-11), 🔴 A11 — Rule 7 is enforced at RENDER time, not write time (binding constraint on Phase 3), ✅ A12 — D3's case-card control is TWO states, not one button (PO decision, 2026-08-11) (+17 more)

### Community 252 - "Loading"
Cohesion: 0.08
Nodes (23): 10. Recommended V1.5 / V2 Tables, 12. Compact ER Diagram, 13. Bottom-Line Recommendation, 1. Architectural Overview, 2. Recommended Schemas, 5. Multiple-Choice Answer Storage, 6. Repeating Group Answer Storage, 7.1 Form Definition Relationships (+15 more)

### Community 253 - "Loading"
Cohesion: 0.10
Nodes (20): 1. Requirements coverage, 2. Security / RLS, 3. Code quality, 4. XSS / Rule 7, 5. pt-BR and a11y, 6. No patient data / §1 compliance, 7. Hygiene, Audit Details (+12 more)

### Community 254 - "Loading"
Cohesion: 0.08
Nodes (33): AVAILABILITY_ICON, DocumentConfidentialityBadge(), DocumentKindBadge(), DocumentNoVersionBadge(), DocumentPhiBadge(), ADR-0072, DocumentDeleteButton(), CONFIDENTIALITY_LABEL (+25 more)

### Community 255 - "Loading"
Cohesion: 0.16
Nodes (17): accepted(), POST(), retryLater(), ADR-0099, unauthorized(), verifyCallbackSignature(), AudioJobMetadata, buildAudioJobMetadata() (+9 more)

### Community 256 - "Loading"
Cohesion: 0.09
Nodes (22): ADR 0106 — "Act as": role assumption as a binding constraint, Consequences, Context, Cutover debts (neither was discharged by merging) — ✅ BOTH DISCHARGED 2026-08-10, D10 ⚑ — Big bang, not shadow mode, D11 — Principals outside the membership model, D12 — The hat lives in the JWT, not in a client-supplied setting, D13 — administrativo capabilities ride the committee hat (+14 more)

### Community 257 - "Loading"
Cohesion: 0.10
Nodes (35): AssessmentForm(), EvidenceList(), formatLinkedAt(), LinkEvidenceDialogTrigger(), ASSESSMENT_STYLES, EVIDENCE_STYLES, EvidenceStatusChip(), FRAMEWORK_STYLES (+27 more)

### Community 258 - "Loading"
Cohesion: 0.26
Nodes (8): classify(), emit_report(), psql_c(), psql_f(), record(), restore_inflight(), p0-authz-rowdoor-audit.sh script, want()

### Community 259 - "Loading"
Cohesion: 0.10
Nodes (27): mintedPrintIds, ADR-0120, mapDoorError(), mintPrintedDocument(), MintPrintedDocumentState, PrintedDocumentActionState, PrintedDocumentDoorRow, RevokePrintedDocumentInput (+19 more)

### Community 260 - "Loading"
Cohesion: 0.06
Nodes (36): 0. Section A — REGISTRY SANITY (gate for everything below), → **141 at HEAD (`f804a03f`).**, 1. DIFF TABLE — plan-named vs. reality (the headline), 2.1 `rca_evidence` — full column list **[catalog]**, 2.2 `add_rca_evidence` — signature, ACL, body **[catalog]**, 2.3 pgTAP `328` keystone K8b — quoted verbatim **[code]**, 2.4 The `nsp-evidence` bucket **[catalog]**, 2.5 The NSP hard exclusions and PQS custody predicates **[catalog]** (+28 more)

### Community 261 - "Loading"
Cohesion: 0.02
Nodes (161): EvidenceCombobox(), ConfirmRemoveButton(), AuditLabelOption, ADR-0051, AuditIntegrityCheck(), ADR-0051, AssigneeAvatar(), BulkStepMembers() (+153 more)

### Community 262 - "Loading"
Cohesion: 0.07
Nodes (39): displaySpeakerLabel(), SpeakersPanel(), Minutes, saveMinutesDraft(), ALL_DRAFT_KEYS, DRAFT_KEYS, defaultMakeKey(), foldVerbatimIntoDescription() (+31 more)

### Community 263 - "Loading"
Cohesion: 0.05
Nodes (41): 0. Where to resume — read in this order, 1. What was initially planned, 2. What was actually implemented, 3.10 ⭐⭐ Two rules about migration text, collapsed into one, 3.11 ⭐⭐ A COVERED verdict does not survive a body change, and no arm enforces that, 3.12 The word-boundary trap, committed by the person citing it, 3.13 Seven E2E locator collisions from a restyle, 3.14 A serial-masking correction changed the fix count from 6 to 7 (+33 more)

### Community 274 - "phase17-documents.spec.ts"
Cohesion: 0.22
Nodes (9): Findings, INFO, MAJOR, MINOR, QA Review — Form Builder Enhancements (mini-phase), Re-review checklist — all items RESOLVED, Re-review Summary (2026-06-23), Verdict: APPROVED (+1 more)

### Community 275 - "Deploying to DigitalOcean + Coolify (test environment)"
Cohesion: 0.12
Nodes (16): 2.1 — Auth → URL Configuration, 2.2 — JWT signing keys: migrate to asymmetric (the ADR 0009 "prod-auth gap"), 2.3 — Enable the custom access-token hook (the `is_admin` claim), 2.4 — SMTP + email verification (optional at first), 2.5 — Bootstrap the FIRST `platform_admin` (manual SQL — there is no in-app path), Architecture, Deploying to DigitalOcean + Coolify (test environment), Known risks & gotchas (+8 more)

### Community 276 - "Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis"
Cohesion: 0.11
Nodes (19): 1. TL;DR, 2. What our platform already is (the corrected baseline), 3.1 Core case engine, 3.2 Participants & identity — **the core gap**, 3.3 Assignments, forms, meetings, documents, timeline, action items, 3.4 Decisions & the ethics procedure — mostly **Absent**, 3.5 Access, confidentiality, conflicts — **the security-sensitive gap**, 3.6 Committee-specific extension tables (M&M etc.) (+11 more)

### Community 277 - "recommend-result.spec.ts"
Cohesion: 0.05
Nodes (41): 1.1 ADR 0134 Increment-2 obligations (the "Obligations" section), 1.2 Amendment 2 §A2.5 (the option-D bill), 1.3 Amendment 4 §A4.3 (six items, not five), 1.4 Amendment 5 §A5.3, 1.5 Amendment 6 §A6.4 and Amendment 7 §A7.4, 1.6 Amendment 2 §A2.6 (records that must change in the same commit), 1.7 Plan §4 "E2E (tester)" — the five UI obligations, 1. Obligation → evidence (+33 more)

### Community 278 - "Phase 11 — Interviews QA Review"
Cohesion: 0.03
Nodes (50): ADR 0026 — Interviews (case-scoped, participant-write RLS), Consequences, Context, Decision, New SQLSTATEs (continue after HC037; HC021 reused), Archive — Increment: Case Narratives, Increment: Case Narratives (feature-flagged; plan `on-this-platform-a-zazzy-waterfall.md`), PROGRESS archive — Phase 0 (+42 more)

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
Cohesion: 0.12
Nodes (27): analyseSource(), argv, ARRAY_CONSTS, assertsUnconditionally(), asTestCall(), asTestStep(), callsTestSkip(), containsGuaranteedAssertion() (+19 more)

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
Cohesion: 0.18
Nodes (10): 1. Requirements — acceptance criteria, 2. Security review (the crux), 3. Code quality (§8), 4. UX & Accessibility, Checklist, Findings, MINOR-1 — `AUDIT_MESSAGES.appendOnly` phrasing mismatch (RESOLVED pre-record), Phase 13 — Audit Trail: QA Review (+2 more)

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
Cohesion: 0.04
Nodes (73): STATUS_OPTIONS, AssessmentStatusChip(), CaseActionItemForm(), PhaseOption, STATUS_ORDER, ADR-0033, NarrativeAssignMenu(), ADR-0032 (+65 more)

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
Cohesion: 0.04
Nodes (64): kindOptionsForHome(), UploadDialog(), formatCaseNumber(), formatDate(), formatDateTime(), formatFileSize(), referralStatusChipClass(), referralTypeChipClass() (+56 more)

### Community 303 - "form-model-normalization.spec.ts"
Cohesion: 0.05
Nodes (57): createForm(), enterWizardByTitle(), openAddBlock(), publishForm(), purge(), signInAs(), ADR-0045, ADR-0092 (+49 more)

### Community 304 - "PHASES.md — Hospital Commission Forms Platform"
Cohesion: 0.16
Nodes (11): PAYLOADS, ADR-0104, imagePlaceholder(), mapChild(), printImagePlaceholders(), PROCESSOR, renderMarkdown(), replaceImages() (+3 more)

### Community 305 - "result-actions.ts"
Cohesion: 0.07
Nodes (25): 2 · KEEP LIST — unchanged from v2 (`qa`-verified both directions, 0 over-reach), 3 · INVENTORY BY PATH KIND — v2's §3.1–§3.7 stand, with these v3 edits, 4.1 · C8 — the disproof **holds on its legs; its scope was wrong**, 4 · STRUCTURAL SURFACES, 5.1 · PO / lead rulings open, 5 · CONTRADICTIONS + OPEN RULINGS, 6 · THE AUTHORITATIVE M1 FIX SET, 7.1 · The five live probes (each `ROLLBACK`ed; persistence re-verified = 0 leaked) (+17 more)

### Community 306 - "7. JavaScript Performance"
Cohesion: 0.08
Nodes (24): Acceptance criteria for any follow-up, Audit boundary and method, Auditor's final verdict, Current model — verified catalog snapshot, Decision analysis: one table versus four, Explicit non-goals, Findings and recommendations, I1 — session membership reads should be one authority snapshot (improvement) (+16 more)

### Community 307 - "Quick Reference"
Cohesion: 0.06
Nodes (56): DATE_FMT, metadata, VersionsPage(), CaseNarrativesBuilderPage(), metadata, ADR-0032, FormsListPage(), metadata (+48 more)

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
Cohesion: 0.14
Nodes (26): callRpc(), changeParticipantRole(), createEthicsCase(), dbQuery(), getOwnerToken(), gotoCase(), isFocused(), mintSeatableProfessional() (+18 more)

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
Cohesion: 0.16
Nodes (16): ADR-0116, ATTACHMENT_KINDS, AttachmentActionState, AttachmentOwnerType, AttachmentScanStatus, AttachmentTier, ConfidentialityLabel, defaultClassification() (+8 more)

### Community 319 - "dashboard-charts.tsx"
Cohesion: 0.12
Nodes (17): 1. Method — what I actually did, 2. Findings, 3. Area-by-area answers to the brief, 4. Requirements audit — ADR 0106 D1–D14, 5. What I did not verify, 6. Closing, ACT Stage 3 — QA review (ADR 0106, "act as" strict role assumption), 🔴 BLOCKER-1 — `app.is_admin_for` is a hat-blind CALLER gate on `grant_role` / `revoke_role` (+9 more)

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
Cohesion: 0.15
Nodes (13): 1. Requirements audit — PASS (wishlist delivered), 2. Security / RLS — PASS, 3. Evaluator non-drift — PASS (verified byte-for-byte), 4. Code quality — PASS (one MAJOR bug, itemized below), Findings, INFO-1 — Constraint deferrability is a latent footgun, INFO-2 — `dashboard_distributions` / `dashboard_export_rows` remain `SECURITY DEFINER` with an internal `is_staff_admin_of`/`is_admin` gate, MAJOR-1 — ✅ RESOLVED (`e13081f` + `e158e91`, verified 2026-07-01) — Reordering an **existing** choice item's options fails with a duplicate-key error (silent data loss of the reorder) (+5 more)

### Community 325 - "2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite)"
Cohesion: 0.14
Nodes (13): 1. Requirements Audit (per Acceptance Criterion), 2.1 Signer-role rule is byte-equivalent (no broadening of WHO may sign), 2.2 `signoffs_select` exposes metadata only, not answers, 2.3 SECURITY DEFINER hygiene, 2.4 `sign_section` constraint completeness, 2.5 The P6-001 fix did not weaken authz, 2.6 Submission authority & single-sourcing, 2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite) (+5 more)

### Community 326 - "form-builder-enhancements.spec.ts"
Cohesion: 0.13
Nodes (36): MemberRow(), TimelineRow(), mapNspEvidenceErrorCode(), mapRcaError(), addRcaEvidenceCitation(), addRcaEvidenceLink(), addRcaFactor(), addRcaMember() (+28 more)

### Community 327 - "page.tsx"
Cohesion: 0.07
Nodes (29): 12. Role grant ceilings, 13. Case authorization attributes, 18. Effective permission rules, 1. Purpose, 22.1 Exact-match invitee lookup, 22. Controlled mutation RPCs, 23. Role assignment RPC validation, 24. Billing model (+21 more)

### Community 328 - "Attachments core — revised schema draft (Phase 14e + ADR 0063)"
Cohesion: 0.15
Nodes (13): 1. Core table `public.attachments`, 2. 🆕 `public.attachment_references` — non-authorizing "also appears here" pointers (ADR-0063 §1), 3. 🆕 `public.attachment_subjects` — descriptive, PHI-safe "what it's about" (ADR-0063 §2), 4. `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), 5.1 Immutability guard ⚙ (clone of `app.guard_case_narrative_frozen`), 5.2 Audit trigger ⚙ (`app.audit_write` + `app.audit_diff` — allow-list excludes PHI columns), 5.3 Dispatchers (schema `app`, DEFINER — CASE to existing domain predicates), 5.4 RPCs (`public`, DEFINER) + feature flag (+5 more)

### Community 329 - "Form Builder Enhancements"
Cohesion: 0.17
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
Cohesion: 0.18
Nodes (11): 1. The two DEFINER RPCs' gate parity (the point of this review) — VERIFIED LIVE, 2. P2 INVOKER + RLS — VERIFIED LIVE, 3. `get_feature_flags()` DEFINER — reviewed, no PHI/per-tenant exposure, 4. Cursor safety — MAJOR finding (bounded blast radius, not a BLOCKER), 5. Rule compliance, 6. Grants / new-column trap, 7. Other observations (INFO, non-blocking), 8. Test-pass corroboration (+3 more)

### Community 343 - "case-access.spec.ts"
Cohesion: 0.20
Nodes (10): INFO (no action required), MAJOR, MAJOR-1 — Seven new non-PHI tables have RLS SELECT policies but no `GRANT` to `authenticated` (Rule 1: inert boundary), MINOR, MINOR-1 — `case_participants_write` (and the catalog `_admin_write` policies) are dead until their write grants land, MINOR-2 — `set_case_patient` compat resolver silently depends on an identifiers row existing, Original review (CHANGES REQUESTED, 2026-07-10), Phase F1 — Case-Participants E0 — QA Review (+2 more)

### Community 344 - "3. Server-Side Performance"
Cohesion: 0.22
Nodes (15): buildChapterRollup(), buildLevelRollups(), computeReadinessRollups(), EvidenceTotals, flattenTree(), gapSort(), isCleanAssessment(), LEVELS (+7 more)

### Community 345 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.08
Nodes (25): 0072 — Ethics access spine: confidentiality, respondent-exclusion, recusal/COI & the m2 gate release, 1. The basis: CFM-1821/2007 no longer supports this posture, 2. "E1 does not build it" was true; it is no longer the state of the world, 3. ⛔ The retention pin fires ONE LIFECYCLE STAGE TOO LATE for ADR 0132's rationale, 7. M2 posture — professional-identity erasure vs CFM-1821/2007 retention (RECOMMENDATION for human sign-off), ⚠ AMENDMENT (2026-08-21) — §7's BASIS is superseded and two of its factual claims have gone stale, As-built (2026-07-14 — E1 shipped; this section is authoritative over the design text above where they differ), Consequences (+17 more)

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
Cohesion: 0.08
Nodes (48): ADR-0124, ADR-0139, argv, cache, chainToServerOnly(), clauseIsTypeOnly(), clients, files (+40 more)

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
Cohesion: 0.04
Nodes (47): ADR 0137 batch — MRN as erasure key; case/referral usability (2026-08-24; ADR **0137**; migrations `20261003001300`–`…001600`, **4**; pgTAP `362` `plan(58)` · `363` `plan(15)` · `364` `plan(14)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**, ADR index (decisions that shape the backend), AFF2 — affiliation-scoped administration (2026-08-23; ADR **0133** + **Amendments 1–4**; migrations `20261003001000`–`…001200`, **3**; pgTAP `359` `plan(18)` · `360` `plan(21)` · `361` `plan(24)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**, AFF4 — organization affiliation, per-hospital staff data, the voided tense (2026-08-26; ADR **0151** D1–D17 + **0154** / **0158** / **0159**; migrations `20261003003200`–`…004300`, **12**; pgTAP `301`–`304` · `371`–`375` · `377`–`381`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ⛔ **NOT PUSHED at the Record edit; 12 migrations are LOCAL ONLY**, AI — Action-Items Satellites + reminder→N scan arm (2026-07-14; ADR 0050; migrations `20260720000950`–`…000970`; flags `action_items`/`cases_extras` ON), Audit read legs — AUD1 + the org-derivation class fix (2026-08-25; ADR **0149** + **0150**; migrations `20261003003000` + `20261003003100`, **2**; pgTAP `372` `plan(29)` · `373` `plan(22)`; **NO flag** — the migrations ARE the cutover) — ✅ **PUSHED 2026-08-25**, backend-state.md — Living Backend Capability Map, CH — Committee Charters & Cadence (S4, 2026-07-20; ADR 0080; migrations `20260818000000`–`…000200`; flag `charters` seed-ON / prod-OFF) → `main` (+39 more)

### Community 361 - "0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)"
Cohesion: 0.18
Nodes (11): 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones), 1. Disposition of all 45 gaps, 2. The pre-pilot phase (`flexible-forms`, structural, no feature flag), 3. Deferred UX roadmap (post-pilot, each its own gated, feature-flagged phase), 4. Cross-cutting design invariant (Rec A) — `question_key` aggregation for the new field types, Alternatives rejected, Consequences, Context (+3 more)

### Community 362 - "3.2 `forms.form_versions`"
Cohesion: 0.20
Nodes (10): 3.2 `forms.form_versions`, Design Reasoning, Example `behavior_config`, Example `theme_config`, Important Columns, Purpose, Related Types, Relationships (+2 more)

### Community 363 - "QA Review — Form Builder Enhancements (mini-phase)"
Cohesion: 0.07
Nodes (28): 1. Where we are, 2. Environment — bringing a new machine up, 3. Hard-won environment gotchas (each cost real time), 4. ⛔ A2 (the resolver) — READ THIS BEFORE BUILDING IT, 5. Open items, 6. PO decisions made this session (do not re-litigate), 7.10 ⛔ A metric that reads the SAME before and after is not measuring the change (lead, M5b), 7.11 ⛔ An inferred mechanism is not a mechanism — and quoting a lesson is not applying it (lead, 2026-07-16) (+20 more)

### Community 364 - "ad-hoc-narratives.spec.ts"
Cohesion: 0.08
Nodes (47): ADR-0152, CHAR_TO_HIGH_BYTE, CONT_NAMED, decodeRun(), EXCLUDE, hasMojibake(), HIGH_BYTE_TO_CHAR, main() (+39 more)

### Community 365 - "administrativo.spec.ts"
Cohesion: 0.18
Nodes (10): byPair, clean(), controls, env, KEY, out, probe(), { results } (+2 more)

### Community 366 - "member-action-items-overview.spec.ts"
Cohesion: 0.07
Nodes (29): allows(), appliedFilters, footprint(), Row, tables, ADR-0133, ADR-0148, PersonAdminAuthority (+21 more)

### Community 367 - "phase13-audit.spec.ts"
Cohesion: 0.06
Nodes (35): A code-design decision to defend against future "improvement", ⭐ A deliberately uninformative error code is uninformative to the TEST too (S2 `341` F-block), Diff-scoped door sweep — 1 case COVERED, with its DOMAIN stated, DM5 — Wave D + retirement (phase record), Durable mechanism fixes (not phase details), Five ways this slice tried to go wrong — all of them the phase's own recurring classes, For `tester` — one seam a UI spec cannot reach, Gate figures (fresh `supabase db reset`) — ⛔ VOID, see the banner above (+27 more)

### Community 368 - "wizard-others-ux.spec.ts"
Cohesion: 0.09
Nodes (23): 0. What already shipped (read before building — do not re-derive), 1. Goal, 2.1 Shared shape across all three tables, 2.2 `action_item_reminders`, 2.3 `action_item_updates`, 2.4 `action_item_checklists`, 2.5 SQLSTATE allocation (block `HC0I0–HC0I9`), 2. AI·sat — the three satellites (and the explicit non-set) (+15 more)

### Community 369 - "PROGRESS.md — Project Status Tracker"
Cohesion: 0.17
Nodes (12): Bug Log, Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md), ⭐⭐ Critical FUP — the must-not-be-forgotten list, Decisions, Follow-ups / Deferred Items, Now — current phase & next actions, 🔴 OPEN — the live bugs, Phase Status — live rows only (+4 more)

### Community 370 - "ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors"
Cohesion: 0.10
Nodes (20): 1. `free_port()` selected PIDs from the wrong `netstat` column, 2. The gate deleted the evidence for the one failure mode it detects, 3. FALSE GREEN — the gate attached to a foreign or stale listener (vector A), 4. FALSE GREEN — a failed `--list` disabled coverage reconciliation (vector B), Auth session cache (added 2026-07-28) — ~865 logins → ~300, Batch accounting (added 2026-07-28) — a batch can no longer pass by producing nothing, E2E gating on a prod standalone build, Fault-injection checklist (how each arm was proven, and how to re-prove it) (+12 more)

### Community 371 - "7. Lookup Values and Enums"
Cohesion: 0.22
Nodes (9): 7.1 Document lifecycle status, 7.2 Document version status, 7.3 Confidentiality labels, 7.4 Asset roles, 7.5 Document permissions, 7.6 Principal types, 7.7 Relationship types, 7.8 Access inheritance modes (+1 more)

### Community 372 - "Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)"
Cohesion: 0.10
Nodes (21): ADR 0079 / t19 grants (CLEAN), Dimension 1 — Requirements (per-increment acceptance), Dimension 2 — Security / RLS (the crux) — verified LIVE, Dimension 3 — Code quality (CLEAN), Dimension 4 — UX & a11y, Dimension 5 — Hygiene, INFO-3 — idempotency keys — confirmed intentional (PO-locked trim)., INFO (new, non-blocking) — defense-in-depth for the notes read (+13 more)

### Community 373 - "Increment Archive — Case Access Control & "Meus Casos""
Cohesion: 0.12
Nodes (16): 1.1 ⛔ P0 · The exclusion plane: **6 tables × 4 legs** — the A27 matrix, 1.2 ⛔ P0 · The population question — answered, and the answer is not a number, 1.3 – 1.11 · Unchanged from v2 (all ✅ `qa`-verified), 1.6 · **A30 — `platform_admin` (`is_admin()`) arms on tenant data: FIVE** (D8 · D10), 1 · FINDINGS SUMMARY, D1a · My v2 boundary was wrong in two directions, and the count concealed it, D2 · ⚠ `qa`'s PROBE 4 over-states the PHI consequence (C1a's lesson, 4th occurrence), D2a · …but composed, it is **WORSE** than `qa` framed it (PROBE 5, proven live) (+8 more)

### Community 374 - "Phase 10 — Meetings (archived task detail)"
Cohesion: 0.17
Nodes (11): AVAILABILITY_PRESENTATION, REFERRAL_DOCUMENT_ERROR_MESSAGE, referralDocumentErrorMessage(), SNAPSHOT_UNAVAILABLE_DETAIL, ADR-0114, ReferralInertFileRow(), ReferralOpenFileButton(), ADR-0114 (+3 more)

### Community 375 - "Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)"
Cohesion: 0.10
Nodes (19): DashboardPage(), metadata, ADR-0051, metadata, QualityDashboardsPage(), toAggregatesOnly(), ADR-0041, ADR-0100 (+11 more)

### Community 376 - "Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)"
Cohesion: 0.12
Nodes (17): BLOCKER, BLOCKER-1 — the ata freezes the MINTER's content tier and re-serves it under a strictly coarser predicate, defeating the per-caller masking the meetings domain enforces at the column-grant level, Code quality, UX, hygiene, INFO, MAJOR, MAJOR-1 — the ata prints four columns the catalog classes PHI-BEARING while the payload hardcodes `containsPhi: false`, Methodology, MINOR (+9 more)

### Community 377 - "Findings"
Cohesion: 0.25
Nodes (8): BLOCKER, Completeness / premature-closure assessment, Findings, INFO, MAJOR, MINOR, QA Review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Requirements & product-owner-decision fidelity

### Community 378 - "Phase 17 — Controlled-Document Lifecycle · QA Review"
Cohesion: 0.09
Nodes (17): dbQuery(), ensureCasePatientPhi(), focusTrace(), getToken(), openAccessDialog(), patchNarrativeAssignee(), patchNarrativeFields(), rpc() (+9 more)

### Community 379 - "case-patient.spec.ts"
Cohesion: 0.07
Nodes (21): auditRowsFor(), restGet(), restoreFeatureFlags(), setFeatureFlag(), signInAs(), ADR-0038, ADR-0042, ADR-0064 (+13 more)

### Community 380 - "cases-extras.spec.ts"
Cohesion: 0.03
Nodes (102): CasesBoardPage(), metadata, ADR-0038, ADR-0061, ADR-0064, ADR-0078, ADR-0083, ADR-0084 (+94 more)

### Community 381 - "cases-meetings-minor.spec.ts"
Cohesion: 0.12
Nodes (16): 10.1 Proposed schema, 10.2 Eligibility, 10. New table: `case_votes`, 15. Read interfaces and Case detail composition, 16. Ethics lifecycle mapped to the shared model, 19. Required indexes, 1. Executive decision, 22. Open decisions requiring human approval (+8 more)

### Community 382 - "patient-index.spec.ts"
Cohesion: 0.01
Nodes (116): ADR-0159, ADR-0106, signInAs(), signInAs(), ADR-0051, registerFreshPersonAllStepsDefault(), signInAs(), ADR-0078 (+108 more)

### Community 383 - "phase14a-safety-events.spec.ts"
Cohesion: 0.18
Nodes (10): createExternalModules(), createExternalModules(), from, inFilter, load(), remove, rpc, STALE (+2 more)

### Community 384 - "phase22-referrals.spec.ts"
Cohesion: 0.05
Nodes (59): CharterPage(), formatDateOnly(), formatTimestamp(), metadata, ADR-0080, DocumentsLayout(), BuilderPage(), metadata (+51 more)

### Community 385 - "phase8-dashboard.spec.ts"
Cohesion: 0.18
Nodes (7): constNodes, files, memo, results, sources, SRC, unresolved

### Community 386 - "route.ts"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 387 - "0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values"
Cohesion: 0.13
Nodes (15): 0089 — FF-2 Matrix & Risk Matrix: cell contract, risk derivation, required semantics, axis codes, 1. The cell contract is a radio grid — columns are the options, 2. Risk weights live on the axes; `risk_score` is derived server-side, 3. `required = true` on a matrix means every row is answered, 4. Axis codes are immutable once they exist, A. 🔴 `app.instance_is_empty` is blind to the matrix tables — new finding, B. 🔴 The correction-copy obligation, inherited from FF-1's P0-1, C. `clone_form_version` does not copy the axes — INFO-1, matrix half (+7 more)

### Community 388 - "Decision"
Cohesion: 0.20
Nodes (10): 1 · Complete DB-side PHI disposal in every graph, 2 · `dispose_meeting_minutes(meeting, reason)` — new, standalone, per-meeting, 3 · §6.4 leak, 4 · Storage retained — the NARROWED claim (the load-bearing decision), ADR 0056 — PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained), Amendment 1 — the meeting door's redaction set widens to its composition closure, Amendment 2 — the widening property is NARROWED to designated PHI fields, and stops here, Consequences (+2 more)

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
Cohesion: 0.15
Nodes (11): ADR 0138 — Unified (non-PHI) action_items hub, Alternatives, Consequences, Context, Decision, Administrativo delegated-capability role — task detail (archived), Backend, Bugs found + fixed (see archived Bug Log) (+3 more)

### Community 397 - "Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07"
Cohesion: 0.33
Nodes (6): 5.3 `referral_participants`, Columns, Constraints, Design rationale, Suggested access levels, Suggested participant roles

### Community 398 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.13
Nodes (40): ADR-0128, adminClient(), ALL_KNOWN_BUCKETS, ALL_VERDICTS, argFlag(), assertDisposableBucket(), bucketExists(), captureOutcome() (+32 more)

### Community 399 - "Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)"
Cohesion: 0.02
Nodes (173): AdminOrganizationsPage(), metadata, metadata, LoginPage(), metadata, metadata, metadata, metadata (+165 more)

### Community 400 - "QA Review — "Administrativo" delegated-capability role (ADR 0061)"
Cohesion: 0.15
Nodes (13): Conclusion, Findings, INFO-1 — `case_phase_option_aggregates` lacks the `status='completed'` filter its sibling has, INFO-2 — stale doc-comment mentions `reopen_narrative`, INFO-3 — `save_correction_draft_body` audits with action verb `case_correction.draft_started`, INFO-4 (positive) — free-text reasons deliberately excluded from `audit_log`, INFO-5 — test gate taken on faith (tester/lead-owned), MINOR-1 (non-blocking) — void approvals do not stamp `impact_snapshot` (+5 more)

### Community 401 - "CLAUDE.md optimization — evaluation & change-map"
Cohesion: 0.25
Nodes (7): Binding-rule preservation — verified ✓, Change-map (section by section), CLAUDE.md optimization — evaluation & change-map, How to adopt (two steps, when you're satisfied), Out of scope this pass — recommended follow-ups, TL;DR, What the audit found

### Community 402 - "QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`"
Cohesion: 0.11
Nodes (36): ADR-0047, analyse(), applyBackpointer(), backpointerPlan(), cell(), checkEol(), checkProposedReview(), colonlessEdgeLabels() (+28 more)

### Community 403 - "phase14b-triage.spec.ts"
Cohesion: 0.10
Nodes (18): addAllegation(), assertRouteDenied(), AuditRow, auditRowsFor(), clearCaseAccess(), dbDelete(), dbQuery(), getOwnerToken() (+10 more)

### Community 404 - "processless-cases.spec.ts"
Cohesion: 0.15
Nodes (13): 1. Catalog facts (all confirmed live, not from migration text), 2. Live function bodies read in full (`pg_get_functiondef`), 3. pgTAP — ran live, not just trusted, 4. One independent live mutation (not from the ADR's narrative), 5. BUG-FF4-001 fix — read, not just accepted as fixed, 6. Client/server consistency, 7. UI / a11y / pt-BR spot check, Conclusion (+5 more)

### Community 405 - "ui-batch-2026-07.spec.ts"
Cohesion: 0.33
Nodes (6): 5.5 `referral_messages`, Columns, Constraints, Design rationale, Sequence assignment, Suggested message types

### Community 406 - "commission-overview.tsx"
Cohesion: 0.09
Nodes (23): Acceptance criteria (phase gate), B0 — Preflight ✅ DONE 2026-08-06 (lead), B1 — Migration 1: storage + table (backend), B2 — Migration 2: RPCs, doors, audit, flag (backend), B3 — Types (backend), B4 — Generic audio-jobs client `src/lib/audio-jobs/` (backend, D18), B5 — Meeting module `src/lib/minutes-jobs/` (backend), B6 — Webhook `src/app/api/webhooks/audio-jobs/route.ts` (backend, D10/D18) (+15 more)

### Community 407 - "interviewers-panel.tsx"
Cohesion: 0.10
Nodes (21): 0 · How this review was conducted, 1 · BLOCKING, 2 · MAJOR, 3 · MINOR, 4 · INFO, 5.1 Mutation proofs re-run (all held), 5.2 Door parity — verified against the catalog, not the ADR, 5.3 The two mirror pairs (+13 more)

### Community 408 - "referral-flow-charts.tsx"
Cohesion: 0.18
Nodes (11): 1. Gates I ran (fresh `supabase db reset --local`, 315 files = 315 registered), 2. Findings, 3. Verified correct (audited from the catalog, not from file text), 4. What closes this review, QO·FUP — focused review (follow-up close-out on top of QO·A), R1 — MAJOR (blocking) · a "catalog-verified" claim the catalog contradicts, and the live defect it hides, R2 — MINOR · the caller sweep that carries the whole NULL decision is an undercount, R3 — MINOR · F1 changed a premise and no prose sweep followed it (+3 more)

### Community 409 - "rca-header.tsx"
Cohesion: 0.07
Nodes (24): base, client, Ctx, hospitalAdminOfCentralA, hospitalAdminOfSibling, orgAdmin, plainStaff, rpcCalls (+16 more)

### Community 410 - "1. Eliminating Waterfalls"
Cohesion: 0.05
Nodes (55): CaseMeetingsPanel(), SessionRow(), AssigneeOption, formatDateTime(), formatDueDate(), formatMeetingNumber(), formatSchedule(), MeetingStatusBadge() (+47 more)

### Community 411 - "2. Bundle Size Optimization"
Cohesion: 0.07
Nodes (29): AFF-era closed bugs (rotated from PROGRESS.md 2026-08-06 at the AFF Record), Archive — Bug Log (resolved & closed), BUG-ETHE4-FOCUS-1 (rotated from PROGRESS.md 2026-08-12, closed at rotation), Bug Log closure narratives rotated from PROGRESS.md 2026-08-18 (the size rotation), BUG-QO-001 (rotated from PROGRESS.md 2026-08-08 — CLOSED in-phase by M8+M9), BUG-REFNOTE-001 — DEFINER doors returned the unmasked `body_md` past the column GRANT, ↩ Closed 2026-08-20 — DSR Slice 3 (10 bugs), VERBATIM apart from the link repoint, Rotated 2026-08-08 at the PDF·P2 Record step (+21 more)

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
Cohesion: 0.05
Nodes (74): ADR-0149, AdminAuditPage(), metadata, csvField(), GET(), toCsv(), ADR-0020, ADR-0029 (+66 more)

### Community 423 - "Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)"
Cohesion: 0.11
Nodes (20): abort_batch(), BATCHES, dins(), finish(), free_port(), on_exit(), pack_batches(), pgrst_ok() (+12 more)

### Community 424 - "Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)"
Cohesion: 0.13
Nodes (15): 0. Source anchors (what already exists — E3 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Seed (E3a — backend, `supabase/seed.sql`), 2.3 TS layer (`backend`-owned) — the terminology read (first-ever consumer), 2.4 RLS, 2.5 Terminology-wiring touch-list (frontend, off the frozen §2 contract), 2. E3a canonical contract (BACKEND posts these typed stubs FIRST) (+7 more)

### Community 425 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.05
Nodes (43): CANONICAL, CANONICAL_PROVENANCE, CASE_BODY_BASE, CASE_CANONICAL, CASE_DISPOSED, CASE_ENVELOPE, CASE_IDENTIFIED, CASE_PATIENT_DEID (+35 more)

### Community 426 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.20
Nodes (10): 18. Migration and rollout sequence, Gate 0 — Ratify the replacement decision, Gate 1 — Repair the Case Type foundation, Gate 2 — Centralize Case authorization, Gate 3 — Build targeted respondent submission, Gate 4 — Build generic procedure primitives, Gate 5 — Make Meetings Case-restrictable, Gate 6 — Add the ethics-only Decision satellite (+2 more)

### Community 427 - "cases-outcomes-blockers.spec.ts"
Cohesion: 0.11
Nodes (19): 1. Requirements — D1–D10 and A1–A12, 2. 🔴 A11 / Rule 7 — the highest-value check, 3.1 K-R5-1 survives the rename (A4), 3.2 `referral_note_types` (A6), 3.3 `get_referral_case_access_summary` — the new DEFINER door, 3.4 `reorder_referral_note_types` is INVOKER — and that is safe, 3.5 Audit emission on every new mutation (Rule 11), 3.6 Secrets (+11 more)

### Community 428 - "nsp-per-hospital.spec.ts"
Cohesion: 0.07
Nodes (28): 1. Gate evidence — independently reproduced, 2. Drop completeness AND over-cut (review item 1), 3. The two plan deviations (review item 2), 4. Inertness (review item 3) — confirmed behaviorally, not only structurally, 5. The noun rule (review item 4) — re-verified, and proven falsifiable, 6. FUP-DM1-CEILING (review item 5), 7. The parks (review item 6), 8. Judging the two substitutions for the un-run sweep cases (+20 more)

### Community 429 - "phase14c-rca.spec.ts"
Cohesion: 0.14
Nodes (14): 10. Typed signatures posted for frontend, 11. Scope gap flagged, not silently expanded or dropped, 12. `ARM=census` did not grow — explained, not assumed, 12b. Gate — full Phase Gate step 1, 1. DB layer — what landed, 2. Two catalog findings, both fixed before the pgTAP pass, 3. Auto-derivation — the lever that made ~1949 call sites tractable, 4. `claims_for` needed `SECURITY DEFINER` (a second finding, found live) (+6 more)

### Community 430 - "phase14d-capa.spec.ts"
Cohesion: 0.20
Nodes (10): Dimension 1 — Requirements audit (C-1…C-6 + H-8 closed as scoped?), Dimension 2 — RLS / privilege security, Dimension 3 — PHI (Rule 12) + C-6 narrowed claim, Dimension 4 — Integrity invariants, Dimension 5 — Architecture rules, Dimension 6 — Perf changes (WS-5), Findings (all non-blocking), Gate posture (+2 more)

### Community 431 - "phase15-indicators.spec.ts"
Cohesion: 0.06
Nodes (34): Acceptance criteria (beyond the ADR's D-list), AFF4 — implementation plan: org affiliation, staff data, the voided tense, ⛔ AFF4's OWN REGRESSION — found 2026-08-26, NOT fixed, needs a go before merge, B1 · Migration: `organization_affiliations` (ADR 0151 D1), B2 · Migration: voided tense + staff columns on `hospital_affiliations` (D7, D9), B3 · Migration: the voided exclusion in the read legs (D7) — ⚠ ALTER POLICY, B4 · Migration: doors (D2, D5, D8), B5 · Migration: backfill (D10) (+26 more)

### Community 432 - "phase3-admin-members.spec.ts"
Cohesion: 0.11
Nodes (19): 1. Requirements audit, 2. Findings, ranked, 3. Defect classes — fix confirmation and sibling hunt, 4. Security / RLS, 5. Code quality, 6. What I could not verify, and why, 7. Required to clear this review, ADR 0095 — the eleven audit items (+11 more)

### Community 433 - "phi-remediation.spec.ts"
Cohesion: 0.11
Nodes (18): B-1 (BLOCKING) → **closed**, FF-3 — QA Review **r2**, M-1 (MAJOR) → **closed**, and the split is proven in both directions, M-2 (MAJOR) → **closed**, M-3 (MAJOR) → **closed via Amendment 4.** Audited on the merits; see r2.3., m-4, m-5a, m-5b, i-1, i-2 → **closed**, M-4 (MAJOR) → **behaviour closed**; coverage gap remains, see r2.4, r1 regression sweep — all 16 proofs hold (+10 more)

### Community 434 - "React Best Practices"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 435 - "backend-engineer.md"
Cohesion: 0.29
Nodes (6): Binding rules (see ARCHITECTURE.md for the authoritative form), Catalog is truth (schema / RLS / RPC / authz questions), Process discipline, Scope you must NOT touch, Scope you own, Skills to consult

### Community 436 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.07
Nodes (30): 0 · What landed, in commit order, 1 · The inherited artifacts were UNREVIEWED, and both carried real defects, 1a · The pgTAP keystone had never been executed, 1b · Two claims in that header were false, and were REPAIRED rather than deleted, 1c · `plan(N)` → `no_plan()` — ⛔ REVERSED AT QA r1, see §6d correction 1, 1d · ⛔ The INDETERMINATE branch was unreachable in the state that needs it, 1e · Verification of the tool after four accumulated changes, 2 · S5.D — the disposal gap, pinned on both sides (+22 more)

### Community 437 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.18
Nodes (11): 0092 — FF-4 Power Authoring: a commission-owned block library, condition-closed snapshots, and a five-token default vocabulary, Amendment 1 — ruling 4's "inline edit" is withdrawn; the rename list is read-only (2026-08-03), Amendment 2 — ruling 2's metadata mutability had no mechanism; the doors are built, not withdrawn (2026-08-03), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Method notes worth keeping (+3 more)

### Community 438 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.22
Nodes (9): Backend (migrations `20260713000000`–`…000400`), Bugs found + fixed (5, all tester-verified; DB-proven each), Deferred / carried, Frontend (F1–F7), Locked decisions (ADR 0057), Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados), QA MINORs (all cleared before Record), Test gate (+1 more)

### Community 439 - "ADR 0008 — GSAP as the animation dependency"
Cohesion: 0.12
Nodes (22): BulkCreateAction, BulkMember, memberName(), PhaseScope, BulkChecklistItem, BulkRail(), STEPS, ADR-0084 (+14 more)

### Community 440 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.20
Nodes (10): Dimension 1 — Requirements (ADR 0072 D1–D10 + plan §4), Dimension 2 — Security / RLS (the blocking findings), Dimension 3 — What is genuinely right (verified, not assumed), Dimension 4 — Minor / Info, 🔴 MAJOR-1 — The m2 respondent/recusal deny is out-voted at the RLS policy layer (ADR 0072 D2; Architecture Rule 1), 🔴 MAJOR-2 — `record_recusal`'s self-arm has no authority gate (cross-tenant write), QA Review — ETH·E1 (Ethics Access Spine — the m2 gate release), The two accepted design deviations — both confirmed as *shipped*, not merely claimed (+2 more)

### Community 441 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.17
Nodes (12): 10. Gate — full Phase Gate step 1, 1. The central fix — one seam, not 88 call sites, 2. `getRawGrants()` consumer enumeration — by the property, not a remembered list, 3. `context.isAdmin` — the SAME class, found auditing its own ~23 consumers, 4. `isCommissionAdmin`'s RLS-backstop comment — verified against the catalog, not accepted, 5. `getTechnicalDirectionAccessByOrg` — confirmed covered, not assumed, 6. A SEPARATE hat-blind door, found auditing session/access-resolver RPCs, not in the brief, 7. Why `ARM=census` did not grow (again) — `list_my_nsp_hospitals` returns `jsonb` (+4 more)

### Community 442 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.33
Nodes (6): 0145 — The print path's Markdown is stricter than the screen's: no `<img>` inside Gotenberg, Alternatives rejected, Consequences, Context, Decision, Measured, not assumed

### Community 443 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.10
Nodes (20): Summary — v2, V-0.1 · C1a is CONFIRMED. My v1 fixture does not reproduce. (v1 §7 is WRONG), V-0.2 · C4 is CONFIRMED. My "30" was a floor. (v1 §6·1 is WRONG), V-0.3 · A **third** v1 error `backend` did not catch — and v2's stricter query is what exposed it, V-0.4 · Lead correction accepted — `is_admin()` is **not** a forgeable claim, V-0 · Corrections to my own v1 — visible, not silent, V-1.1 · Both v1 and v2 **under-state `lift_recusal`** — it is also a PHI door, V-1 · The three probes, re-run by someone who did not write them (+12 more)

### Community 444 - "ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture"
Cohesion: 0.18
Nodes (11): ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture, Amendment 1 (2026-07-12) — Referrals v2: dialogue + governance expansion (pre-pilot), Consequences, Context, Context, Decision — the 16 locked design decisions, Decision — the three-bucket disposition, Decisions amended (+3 more)

### Community 445 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.18
Nodes (11): 18.1 Permission hierarchy, 18.2 `interview_access_grants`, 18.3 Authorization helper functions, 18.4 Example RLS policies, 18.5 Storage authorization, 18. Access Control, Grant semantics, Interviews (+3 more)

### Community 446 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.11
Nodes (18): 0096 — Process-template versioning (audit M1, full remodel), A1.1 · PO rulings (lead, 2026-08-04), A1.2 · Correction: the D11 trap is the OPPOSITE of what this ADR describes, A1.3 · Correction: the backfill can never be exercised by a local reset, A1.4 · Correction: the blast radius is about 5x the stated figure, A1.5 · The TRUE door set (the ADR's table was incomplete), A1.6 · Two harness lies caught during verification, A1.7 · DROP + CREATE resets a function's ACL (a security cost of honest names) (+10 more)

### Community 447 - "0050 — Unified (non-PHI) action_items hub"
Cohesion: 0.14
Nodes (34): MyCapaActionControls(), ADR-0076, CapaActionCard(), CapaEvidenceRow(), addCapaAction(), addCapaActionTask(), addCapaEvidenceLink(), addCapaMeasure() (+26 more)

### Community 448 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.12
Nodes (17): ⛔ BLOCKER-1 — the ratified §4.4 case-plane CUT list was never executed; BUG-QOB-002 is still live, Carried forward (not blocking), ℹ️ INFO-1 — `bulk_create_cases` / `create_case_from_template` unresolved, not cleared, ℹ️ INFO-2 — `lift_recusal` denied both principals, 🟠 MAJOR-1 — four INVOKER doors return SUCCESS while writing nothing, Measured: two confirmed content writes, cross-org control discriminating, Method, 🟡 MINOR-1 — residual masked tenancy arms on the case plane (+9 more)

### Community 449 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.02
Nodes (94): ADR-0021, caseIdFromUrl(), customFieldsRegion(), openNovoCasoDialog(), signInAs(), ADR-0083, ADR-0096, createFreshCase() (+86 more)

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
Nodes (25): Backend, Backend, Backend, Backend (contract-first), Context (one paragraph — the ADR carries the detail), Cross-cutting risks & standing lessons (checked at every slice), Deliberation & Voting Model (DLB) — Implementation Plan, Frontend (+17 more)

### Community 470 - "34. Permission Resolution Algorithm"
Cohesion: 0.33
Nodes (6): 34.1 Input sources, 34.2 Output, 34.3 Expiration, 34.4 Suggested pseudo-code, 34.5 Events that should trigger recomputation, 34. Permission Resolution Algorithm

### Community 471 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.18
Nodes (11): 8.1 `interview_sessions`, 8.2 Optional `interview_session_schedule_history`, 8.3 `interview_session_attendance`, 8. Interview Sessions, Design rationale, Recommended constraints, Rescheduling, Suggested delivery modes (+3 more)

### Community 472 - "Lead notes"
Cohesion: 0.09
Nodes (22): 1. The finding that reframes Phase B, 2. Population (the raw structural read — *not* the fix list), 3.1 ⛔ `responses_admin_all` is live, FOR ALL, and destructive, 3. What org_admin and hospital_admin actually reach today [MEAS], 4.1 ✂ CUT — response & answer content (the headline), 4.2 ✂ CUT — controlled-document content, 4.3 ✂ CUT — printed documents & attachments, 4.4 ✂ CUT — case-plane **write** doors (read is already cut; see §5.1) (+14 more)

### Community 473 - "phase-22.md"
Cohesion: 0.13
Nodes (15): Approver isolation preserved, Audit posture (Rule 11) — PASS, B0 anglicization did not weaken authority — verified live, Chained actions bypass no gate, Code quality — PASS, Gate context relied upon (not re-run), INFO (for the record — no action required), New DEFINER read `list_commission_documents` — verified live (+7 more)

### Community 474 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.08
Nodes (25): 1.1 The Ata editor — `src/components/meetings/meeting-minutes-editor.tsx`, 1.2 The meeting detail page — `src/app/o/[org]/c/[commission]/meetings/[meetingId]/page.tsx`, 1.3 Meetings list — `src/components/meetings/meetings-list.tsx` (F4), 1.4 canEdit — confirmed identical to the audio predicate, no new prop needed, 1.5 Meeting dialogs — shape F2 must match, 1.6 Flag-gated UI rendering pattern, 1. Survey of what exists, 2.1 Why props, not a compound-component API, for the review tree (+17 more)

### Community 475 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.12
Nodes (17): 0090 — FF-3 Validation Engine: rule vocabulary, coverage, enforcement topology, `required_if`, 1. Rule vocabulary v1 is **six** rule types, pinned by an allowlist, 2. Coverage v1 — scalars and repeating-group children, per instance, 3. Enforcement topology — `error` blocks **submit only**, server-side, 4. `required_if` — a new column, composed over the dispatch, **visibility wins**, 5. Operator authorability — widen `is_valid_condition` to the four F3 operators, 6. Door parity is discharged as a **table**, not an assertion, Amendment 1 — the legacy config-bound lane joins the error surface (2026-07-28) (+9 more)

### Community 476 - "user-registration.spec.ts"
Cohesion: 0.05
Nodes (53): ActionItemDetailPage(), cnDue(), describeSource(), metadata, metadata, MyCasesPage(), ADR-0033, metadata (+45 more)

### Community 477 - "8. Advanced Patterns"
Cohesion: 0.23
Nodes (11): ADR-0009, updateSession(), AUTHED_REDIRECT_AWAY, config, isPublicPath(), proxy(), PUBLIC_PATHS, redirectPreservingCookies() (+3 more)

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
Cohesion: 0.18
Nodes (20): ActionState, archivePhaseResult(), authorizeCommissionConfig(), authorizeCommissionMember(), commissionOfCasePhase(), commissionOfResult(), createPhaseResult(), mapOverrideError() (+12 more)

### Community 484 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.22
Nodes (9): Backend tasks (`backend`), Follow-on refinement — case-access dialog + narrative-card attribution (2026-06-19, frontend-only), Follow-ups (carried to PROGRESS.md), Frontend tasks (`frontend`), Gate (§6), Increment Archive — Case Access Control & "Meus Casos", Refinement: Case-access dialog + narrative-card attribution (frontend-only) — ✅ FE DONE 2026-06-19, Seed personas (Caso 0001 "Óbito UTI leito 7", commission CCIH; password `Test1234!`) (+1 more)

### Community 485 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.10
Nodes (20): 0. Three findings that change §A.3's scope (read first), 1. File list, 2.1 Console shell — `/o/[org]/qualidade/layout.tsx`, 2.2 Board — `/o/[org]/qualidade` (the landing), 2.3 Dashboards — `/o/[org]/qualidade/dashboards`, 2. Screen design, 3.1 Why one `viewerKind` discriminator and not four booleans, 3. Write-affordance suppression matrix (the case page) (+12 more)

### Community 486 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.25
Nodes (8): 12. Performance requirements, 13. Decisions that must not be weakened during implementation, 14. Acceptance criteria, 15. Handoff starting point, 1. Objective, 4. Default access matrix, 9. Application behavior contract, User Permissions Model Handoff

### Community 487 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.20
Nodes (10): 21.1 Typical Interview lifecycle, 21.2 Recommended transition rules, 21. Lifecycle Model, `completed → closed`, `draft → requested`, `in_progress → awaiting_follow_up`, `in_progress → completed`, `inviting_participants → scheduled` (+2 more)

### Community 488 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.16
Nodes (23): participantDisplayName(), ParticipantRow(), ActionState, addCaseParticipant(), AddParticipantState, CaseParticipantInput, createExternalParticipant(), createProfessionalProfile() (+15 more)

### Community 489 - "21. Recommended Dashboard Views"
Cohesion: 0.20
Nodes (10): classify(), emit_neut_guard(), emit_report(), psql_c(), psql_f(), record(), restore_inflight(), p0-authz-writepath-audit.sh script (+2 more)

### Community 490 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.11
Nodes (18): 0. Goal & posture, 10. Rollout, 1. Current state (verified 2026-07-13 — the three tables being collapsed), 2.1 Data model — `public.memberships` (dialect-1: column-per-scope + discriminated shape CHECK), 2.2 Predicate family (`app` schema, DEFINER, `search_path`-pinned, owner=postgres), 2.3 Write door (one pair; `SECURITY DEFINER`; the SOLE write path — mirrors WS-1), 2.4 Audit (blanket trigger on `memberships` — WS-1 H-6 carried verbatim), 2.5 TS layer (`backend`-owned — the frozen stubs `frontend` builds against) (+10 more)

### Community 491 - "27. Example: Simple Action Item"
Cohesion: 0.16
Nodes (20): AuditRow(), ENTITY_ICON, EntityIcon(), resolveEntityIcon(), actionLabel(), AuditLabelMap, DATE_TIME, displayValue() (+12 more)

### Community 492 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.11
Nodes (19): 10.1 Organization roles, 10.2 Hospital roles, 10.3 Committee roles, 10.4 Platform roles, 10. Recommended system roles, `billing_admin`, `hospital_admin`, `hospital_auditor` (+11 more)

### Community 493 - "case-narratives.md"
Cohesion: 0.05
Nodes (25): AID_NAV, AID_TWEAK_DEFAULTS, AidApp(), AidActivity(), AidChecklist(), AidDetails(), AidReminders(), TweakColor() (+17 more)

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
Cohesion: 0.36
Nodes (7): ActionState, CreateActionItemState, createManualActionItem(), mapItemError(), MESSAGES, parseDate(), ADR-0057

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
Cohesion: 0.07
Nodes (37): BlockConditionNote(), CHOICE_OPS, CHOICE_TARGET_TYPES, ConditionBuilder(), DraftRow, isChoiceTarget(), isGroup(), isRowComplete() (+29 more)

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
Nodes (13): Behavioural — my r1 probes, re-run, both tiers, ⛔ → ✅ BLOCKER-1 — CLOSED, Carried forward (unchanged from r1, none blocking), Correspondence, re-derived independently, Keystone non-vacuity — I neutralized two of the NEW §11 gates, M7's own new surface — nothing found, 🟠 → ✅ MAJOR-1 — CLOSED, and backend's narrowing of my set is CORRECT, 🟡 NEW MINOR-3 — PROGRESS.md's summary blocks contradict their own section body (+5 more)

### Community 521 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.06
Nodes (34): 0144 — Printing Cases (ADR 0104 P3): the dossier, its lock point, and the PHI fork, Alternatives rejected, Amendment 1 — D7's two series are carried by `template_key`, not by a variant column (2026-08-25), Amendment 2 — the de-identified variant reads through the audited door; a bounded A7 exception (2026-08-25), Amendment 3 — D13's running header, and the first section's page break (2026-08-25), Amendment 4 — D4's counter cannot live on `cases` (2026-08-25), Amendment 5 — D6 is constitutive, not derived: `contains_phi := !caseDisposed` (2026-08-25), Amendment 6 — D9's pinning claim is false, and pgTAP cannot make it true (2026-08-25) (+26 more)

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
Cohesion: 0.12
Nodes (16): 0. Source anchors (what exists — E4 extends, never re-creates), 1.1 `20260919000100_eth_e4_ensure_professional_participant.sql`, 1.2 `20260919000200_eth_e4_create_external_participant.sql`, 1.3 `20260919000300_eth_e4_set_primary_subject_move_and_linkage.sql`, 1.4 `20260919000400_eth_e4_professional_read_org_manager_arm.sql`, 1. Migrations (`backend`) — window `20260919…`, 2. Data access + actions (`backend`), 3. Frontend (+8 more)

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
Cohesion: 0.10
Nodes (27): HospitalIndicatorScorecard(), IndicatorsPanelAsync(), IndicatorsPanel(), DATA_SOURCE_LABELS, DerivedConfig, DerivedDenominatorRef, DerivedNumeratorRef, HospitalIndicatorRollupRow (+19 more)

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
Cohesion: 0.03
Nodes (44): saveMinimalReferralPatientForSend(), serviceKey(), clickNextPage(), getOwnerToken(), signInAs(), ADR-0106, ADR-0137, advanceToInReview() (+36 more)

### Community 544 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 1. Decisions closed in the 2026-08-09 planning interview, 2. The caller-only binding (found during planning; not in the ADR), 3. Substrate anchors (measured 2026-08-09 — re-verify from the catalog at build time), 4. Stages, 5. Deploy notes, 6. Out of scope (deliberate), Act-as role assumption — implementation plan (ADR 0106), Stage 0 — the role enum (FUP-AFF-4, scoped) (+4 more)

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
Cohesion: 0.22
Nodes (18): ActionState, ALLOWED_DOC_MIME, authorizeCommission(), commissionOfCase(), createCaseEvent(), deleteCaseDocument(), deleteCaseEvent(), DOC_TYPES (+10 more)

### Community 550 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 7.1 `interview_participants`, 7.2 `interview_participant_roles`, 7. Interview Participants, Design rationale, Primary interviewee constraint, Recommended uniqueness, Removal behavior, Suggested participation statuses (+1 more)

### Community 551 - "loading.tsx"
Cohesion: 0.09
Nodes (23): Additional verification performed, BLOCKS?, Catalog evidence (not migration text), Challenge 2 — both corrected premises hold, Challenge 3 — the two rebuilt DEFINER doors, property by property, Challenge 4 — the `20260921000300` apply-time guard, Challenge 5 — REG·KIND's table DROP, Challenges answered — verification record (+15 more)

### Community 552 - "loading.tsx"
Cohesion: 0.08
Nodes (26): 1. What I probed, and the safety record of doing it, 2. Requirements audit — S3's six deliverables against the catalog, 3. Findings, 4.1 D12's conjunction, **both** directions, with a positive control first, 4.2 Authority lost or gained in the rebuild — ACLs in **both** directions, 4.3 Rule 12 / PHI — the tier cannot be forged, and reads are audited, 4.4 The five write guards — every one differential, 4.5 D13's separation, and the `add_referral_shared_item` risk it exists to close (+18 more)

### Community 553 - "loading.tsx"
Cohesion: 0.18
Nodes (10): Context accepted without re-litigation (per the task brief), Dimension 1 — RLS coverage & correctness (SECURITY) — PASS, Dimension 2 — RPC grants & authority (SECURITY, t19) — PASS, Dimension 3 — Audit (Rule 11) — PASS, Dimension 4 — Data-access discipline (Rule 9) — PASS, Dimension 5 — Requirements audit vs the plan — PASS, Dimension 6 — Best-practice guardrails — PASS, Non-blocking findings (+2 more)

### Community 554 - "loading.tsx"
Cohesion: 0.12
Nodes (16): 1. Verdict, 2. Domain-fit findings (accreditation practice), 3. Technical-currency findings (spec vs. the 2026-08 platform), 4. What is genuinely right about the proposal, 5. Recommendations (conditions for build approval), External Audit — Phase 16 "Standards Crosswalk & Readiness/Gap Engine", INFO-1 — Downstream dependency, MAJOR-1 — The readiness model is JCI-shaped; ONA readiness is unanswerable without a level dimension (+8 more)

### Community 555 - "loading.tsx"
Cohesion: 0.06
Nodes (31): ADR 0032 — Case Narratives (per-case prose interleaved with phases), Alternatives rejected, Consequences, Context, Decision, 0044 — Process-less cases ("Sem processo"), Consequences, Context (+23 more)

### Community 556 - "loading.tsx"
Cohesion: 0.18
Nodes (10): ACT program — build notes (ADR 0106), Commit, Derivation — catalog vs. enum reconciliation, Finding — the enum will NOT surface in `database.ts` via `gen:types`, Gate results (fresh `supabase db reset --local`), Scope discipline held, Stage 0 — `app.platform_role` enum (backend, 2026-08-09), Stage 0 correction — the enum moves to `public` (lead ruling, 2026-08-09) (+2 more)

### Community 557 - "loading.tsx"
Cohesion: 0.07
Nodes (24): Axis, blockCard(), cellsOf(), CONFORMIDADE_COLS, CONFORMIDADE_ROWS, createForm(), enterWizard(), FixtureForm (+16 more)

### Community 558 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 20.1 `interview_finding_case_issues`, 20.2 `interview_finding_risks`, 20.3 `interview_finding_action_items`, 20.4 `interview_timeline_event_links`, 20.5 `interview_referral_links`, 20. Integration Tables, Design rationale

### Community 559 - "loading.tsx"
Cohesion: 0.06
Nodes (31): 10. Process note — gate ordering, 11. Verdict, 1. Summary of pass 1, 2. Finding C-1 — the Art. 18 hole the Amendment 2 argument stopped one step short of, 3. Finding C-2 — P3 opens a server-side fetch surface, and the module that would have caught it still says otherwise, 3b. Finding C-3 — three D14 floor items are not delivered, and D9 states one of them is, 4. Finding M-1 — the disposal migration cites a formula the provider does not implement, 4b. Finding M-3 — "a PHI mint emits both rows" is proven by coincidence, not by causation (+23 more)

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
Cohesion: 0.17
Nodes (23): actionItemsSection(), correctionsSection(), documentsSection(), field(), interviewsSection(), meetingsSection(), metaLine(), narrativesSection() (+15 more)

### Community 619 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 10. Gate — full Phase Gate step 1, re-run from a genuine fresh reset, 1. `app.is_admin()` — D11 implementation, 2. `assume_role`'s chicken-and-egg bug — found proactively, before shipping, 3. No-op proof — empirical, with the coordinator-required synthetic fixture, 4. TRIPWIRE — the no-op argument's own load-bearing assumption, made falsifiable, 5. The 3-arg `has_role` BLIND — dropped, not kept and not keystoned, 6. Two pgTAP fixture regressions found by the D11 migration, both fixed, 7. A pre-existing door-audit harness gap, found and fixed while diff-sweeping `is_admin()` (+3 more)

### Community 620 - "loading.tsx"
Cohesion: 0.09
Nodes (23): metadata, OrgUsersPage(), ADR-0097, ADR-0133, ADR-0151, includeEndedValue(), parseIncludeEnded(), ADR-0151 (+15 more)

### Community 621 - "12.2 `interview_transcript_segments`"
Cohesion: 0.20
Nodes (10): Catalog re-verification (LIVE catalog, local stack, 2026-07-26), Completion record (human-approved 2026-07-27), Coordination flag for the lead — the `CaseEventKind` in-place widen, ETH·E3a — Terminology/UX surfacing — backend design note (BE-1), Explicitly NOT auto-logged in E3a (with reason), Landed in BE-1 (committed contract stubs, typecheck + lint clean 0/0), Mapping table (the 8 new kinds), O-1 — `cases.case_type_id` (E1-surface amendment) (+2 more)

### Community 622 - "2. Architectural Goals"
Cohesion: 0.14
Nodes (29): addAgendaItem(), addAttendee(), callRPC(), createHeldMeeting(), firstMeetingTypeId(), getOwnerToken(), addAgendaItemWithDescription(), concludeMeeting() (+21 more)

### Community 623 - "9.2 `interview_form_assignments`"
Cohesion: 0.13
Nodes (18): metadata, OrgNspCoordinatorsPage(), metadata, OrgNspOverviewPage(), personLabel(), ADR-0052, NspOrgHospitalManager(), NspOrgRollups() (+10 more)

### Community 624 - "F-cleanup — residual DB-hardening (durable record)"
Cohesion: 0.33
Nodes (6): 14. Command interfaces, Allegations, Case configuration and access, Decisions and votes, Notices and hearings, Participants and respondent submission

### Community 625 - "phase2-auth-shell.spec.ts"
Cohesion: 0.09
Nodes (24): createCaseAs(), dbQuery(), phaseId(), rpcAs(), signInAs(), signOut(), ADR-0061, ADR-0078 (+16 more)

### Community 626 - "phase-multitenancy.spec.ts"
Cohesion: 0.20
Nodes (10): 0091 — FF-5 Entity Reference: three lanes, hybrid participant scoping, and why INFO-2 needs no PHI door, Amendment 1 — `references_never_read_phi` is false as literally worded (2026-07-28), Amendment 2 — `proacl` shows grants, never revokes (2026-07-28), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Open questions (deferred, not blocking) (+2 more)

### Community 627 - "advanced-effect-event-deps.md"
Cohesion: 0.12
Nodes (24): BandColorPicker(), RiskBandsEditor(), TOKEN_NAME, TOKENS, ADR-0089, AxisDraft, BandDraft, bandForScore() (+16 more)

### Community 628 - "advanced-event-handler-refs.md"
Cohesion: 0.10
Nodes (20): Acceptable fixes (either one discharges it), Accepted (not independently reproduced), with the reason, Already-dispositioned, NOT re-filed, Answer to the handoff's question 4 — is keystones-only assurance sufficient for `attach_controlled_document_version_file`?, DM3 — Wave B: controlled documents · QA review (r1), Evidence I produced, INFO, MAJOR-1 (BLOCKING) — `documents_wave_b` gates the LAST step of the corridor, not the corridor; the tree states the opposite twice (+12 more)

### Community 629 - "advanced-init-once.md"
Cohesion: 0.04
Nodes (63): DsrConsolePage(), metadata, ADR-0130, DsrRequestDetailPage(), metadata, ADR-0130, DsrAdjudicationPanel(), DsrConsole() (+55 more)

### Community 630 - "advanced-use-latest.md"
Cohesion: 0.13
Nodes (15): 4. Detailed audit findings, F-01 — standard-bucket confidentiality bypass, F-02 — disposed PHI remains openable, F-03 — reclassification can detach metadata from bytes, F-04 — metadata/object identity is not enforced, F-05 — the authorization model cannot express committed sharing requirements, F-06 — owner-dispatch polymorphism is a scaling seam, not a universal aggregate, F-07 — document, version, placement, and blob are conflated (+7 more)

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
Cohesion: 0.13
Nodes (15): 0. Evidence discipline — what is verified, read, and inferred, 1. BLOCKER, 2. MAJOR, 3. MINOR, 4. Audit checklist — where each item landed, 5. What holds — verified, not assumed, 6. What I could not check, and what it costs, 7. Re-review scope (+7 more)

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
Cohesion: 0.26
Nodes (18): archiveIndicator(), computeDerivedMeasurement(), createIndicator(), KNOWN_PT_BR_HC084, mapIndicatorError(), MESSAGES, openCapaFromIndicator(), parseDate() (+10 more)

### Community 639 - "bundle-preload.md"
Cohesion: 0.10
Nodes (21): metadata, OrgOverviewPage(), ReadinessChart, ReadinessChartLoader(), ReadinessBar, ReadinessChart(), CHART_COLORS, CommissionOverview() (+13 more)

### Community 640 - "client-event-listeners.md"
Cohesion: 0.13
Nodes (23): EditDocumentPage(), metadata, metadata, NewDocumentVersionPage(), DocumentDetailPage(), metadata, ReviseDocumentVersionPage(), ADR-0081 (+15 more)

### Community 641 - "client-localstorage-schema.md"
Cohesion: 0.14
Nodes (14): BLOCKER-1 — T3.4 single-hospital provisioning cannot work as specified, Disposition summary, External audit — ADR 0097 (AFF) + plan `hospital-affiliation-person-identity.md`, HIGH-1 — `profiles.cpf` will be readable by every co-commission member unless column privileges are cut, MEDIUM-1 — `guard_profile_privileged_columns` is a runtime landmine for T1.3, MEDIUM-2 — the customer demo seed breaks and is in no gate, MEDIUM-3 — `end_affiliation`'s refusal checks only *commission* memberships (D5/T2.1), MEDIUM-4 — the `hospital_affiliations` SELECT policy "mirror" omits self and org_admin (+6 more)

### Community 642 - "client-passive-event-listeners.md"
Cohesion: 0.15
Nodes (13): 10. Flag store, 1. The canEdit predicate is `app.is_staff_admin_of(commission_id)` — nothing wider ❗, 2. Audit action names in the plan violate the `audit_log` CHECK ❗, 3. The audited-read door is an allowlist in **two** places — and admin-permissive ❗, 4. `action_items` insert door — call it, don't re-implement (confirmed) + two riders, 5. `app.enqueue_notification` — 10 positional args (B7), 6. FK posture: `ON DELETE CASCADE` (B0.3 answered), 7. Meeting write guards — the `app.in_meeting_rpc` GUC ❗ (+5 more)

### Community 643 - "client-swr-dedup.md"
Cohesion: 0.15
Nodes (13): A fifth site, found by the constraint rather than by reading, ADR 0094 — Membership-model hardening + Diretor Técnico (technical director) backend, Amendment 1 — the four open items, closed (PO, 2026-08-04), Amendment 2 — build-time corrections to decision 2 (W1, verified against the catalog), Amendment 3 — W4 build state (2026-08-04), Amendment 4 — the DT referral plane, settled by interview (PO, 2026-08-04), Amendment 5 — what building the referral plane actually found (2026-08-04), Consequences (+5 more)

### Community 644 - "js-batch-dom-css.md"
Cohesion: 0.13
Nodes (14): ActivityFilter, CaseEventsTimeline(), FILTERS, KIND_VISUAL, kindLabel(), kindVisual(), pillClass(), createCaseEvent (+6 more)

### Community 645 - "js-cache-function-results.md"
Cohesion: 0.29
Nodes (5): EXTENSIONS, files, findings, ROOTS, SKIP_DIRS

### Community 646 - "js-cache-property-access.md"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 647 - "js-cache-storage.md"
Cohesion: 0.25
Nodes (8): BLOCKER — RESOLVED, Code quality / hygiene, Non-blocking observations (address opportunistically), QA-B-1 — pgTAP `189` disposal keystone (was 2 red; now green) — RESOLVED (`693ea60`), QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`, Requirements coverage — ADR 0052 deliverables, Security / RLS findings, Verdict: **APPROVED** (2026-07-03; was CHANGES REQUESTED, cleared same day)

### Community 648 - "js-combine-iterations.md"
Cohesion: 0.33
Nodes (6): 30. Implementation phases, Phase 1: foundational operational model, Phase 2: generation and bed-matrix workflow, Phase 3: longitudinal carry-forward, Phase 4: findings and escalation, Phase 5: advanced surveillance and integration

### Community 649 - "js-early-exit.md"
Cohesion: 0.33
Nodes (6): 6.1 `hospital_departments`, 6.2 `hospital_units`, 6.3 `hospital_rooms`, 6.4 `hospital_beds`, 6.5 Rationale, 6. Hospital location and bed registry

### Community 650 - "js-flatmap-filter.md"
Cohesion: 0.04
Nodes (75): KINDS, ADR-0079, ADR-0125, ADR-0144, wantsPhi(), ageDisplay(), resolvePatients(), SEX_LABEL (+67 more)

### Community 651 - "js-hoist-regexp.md"
Cohesion: 0.40
Nodes (4): AUTHZ Row-Door Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), UNSUPPORTED — no statement guard to open (NOT a verdict; still owed a keystone)

### Community 652 - "js-index-maps.md"
Cohesion: 0.04
Nodes (49): ⛔ AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**, Archive — Follow-ups / Deferred Items (full snapshot incl. resolved), Closed 2026-07-05 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-07 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-15 (rotated out of PROGRESS live Follow-ups — E0/E1 now COMPLETE), Closed 2026-07-18 (rotated out of PROGRESS live Follow-ups — AUDIT-DOOR-BLINDNESS now COMPLETE), Follow-ups / Deferred Items, ⬛ FUP-0137-357-TWINS-ON-STALE-BODY — ✅ **RESOLVED 2026-08-24** (owner: backend) (+41 more)

### Community 653 - "js-length-check-first.md"
Cohesion: 0.22
Nodes (9): 1. What shipped, 2. The decision that changed the phase, 3. Defects found, and what each proves, 4. Eight checks that were vacuous by construction, 5. Gate evidence, 6. Open items, 7. Process findings, FF-5 — Entity Reference (ADR 0091) — phase record (+1 more)

### Community 654 - "js-min-max-loop.md"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 655 - "js-request-idle-callback.md"
Cohesion: 0.14
Nodes (14): 1. Findings — MEDIUM, 2. Findings — MINOR, 3. Answers to the specific questions asked, 4. External-audit dispositions — verified at the code, not at the document, 5. PASS 2 — the parked claims, resolved against the live catalog, 6. Required follow-ups (none blocking), 7. What is right, briefly, ✅ APPROVED — with six required follow-ups (F1–F4, F6, MINOR F5) (+6 more)

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
Cohesion: 0.15
Nodes (13): ADR-0066, caseIdFromUrl(), openProcesslessDialog(), patientIdentifiersForCase(), NOTE: this is the regression coverage for BUG-PL-001 — "Próximo" currently, NOTE: also blocked by BUG-PL-001 — reaching step 2 to press "Criar caso", NOTE: the step-2 assertion is also the keyboard regression for BUG-PL-001 —, restGet() (+5 more)

### Community 661 - "rendering-content-visibility.md"
Cohesion: 0.10
Nodes (21): 2.1 `printed_documents` — RLS, grants, indexes, CHECKs, 2.2 `app.can_view_printed_document` — explicit arms, not delegation, 2.3 The four doors, 2.4 D8 — no signed/storage URL can reach a client, 2.5 D10 — the public tuple stays anemic, 2.6 D11 matrix, including the platform_admin noun rule, 2.7 Rule 7 — HTML escaping into Chromium, 2.8 Rate limiting on `/verificar` (+13 more)

### Community 662 - "rendering-hoist-jsx.md"
Cohesion: 0.28
Nodes (11): RolePickerForm(), ADR-0106, isPlatformRole(), landingRouteForRole(), PLATFORM_ROLES, platformRoleLabel(), ROLE_LABELS, scopeSummary() (+3 more)

### Community 664 - "rendering-hydration-suppress-warning.md"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 666 - "rendering-script-defer-async.md"
Cohesion: 0.17
Nodes (12): C-1 — Premise correction #1 is itself wrong: `public.set_primary_subject` EXISTS, C-2 — The mint door is in the `app` schema, so nothing can call it, Critical findings, M-3 — Four of the seven seeded roles remain unfillable after E4, M-4 — D5's exposure argument holds but omits one *new* inference, M-5 — Get-or-create race + a data-dependent unique index, Major finding, Medium findings (+4 more)

### Community 667 - "rendering-svg-precision.md"
Cohesion: 0.20
Nodes (4): beginTemplateEdit, push, refresh, ADR-0096

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
Cohesion: 0.15
Nodes (11): ALLOWLIST, DML_VERBS, EXTENSIONS, GATED_TABLES, ADR-0075, ADR-0094, ADR-0097, ADR-0098 (+3 more)

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
Cohesion: 0.05
Nodes (44): ADR-0001, ADR-0004, ADR-0006, ADR-0007, AudioJobClientFailure, AudioJobResult, call(), cancelAudioJob() (+36 more)

### Community 695 - "phase-0.md"
Cohesion: 0.06
Nodes (34): FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG, 🟡 FUP-BULK-GRID-MODEL-IMPORTS-UPWARD — a `src/lib` → `src/components` dependency no gate can see (owner: frontend), 🟠 FUP-CASE-CONFIDENTIALITY-VS-PHI — a case can be classified "no patient data" while holding patient data (owner: backend + PO ruling), 🔴 FUP-CASE-DOCS-DEAD-READER — three surfaces render zero case documents, silently (owner: frontend + backend), 🟡 FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES — `padStart(4,'0')` is reimplemented at 8 sites (owner: frontend), 🟡 FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER — a false statement living inside the catalog (owner: backend), 🟡 FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING — the detector that found six false premises is a technique, not a gate (owner: backend/tester; filed 2026-08-24 at the close of FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS), FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME (+26 more)

### Community 696 - "phase-1.md"
Cohesion: 0.10
Nodes (23): generateMetadata(), AffiliationRow, HospitalAffiliation, listActivePrincipalIdsForHospital(), listAffiliationsFor(), listOrgAffiliationTenses(), OrgAffiliationTense, OrgPerson (+15 more)

### Community 697 - "phase-2.md"
Cohesion: 0.07
Nodes (27): §1 Verified-facts baseline (measured 2026-08-21 — re-verify, never quote), §2 Step 0 — repair BUG-QO-STALE-CASOS (tester; no app code), §3 Increment 1 — routing/UI (frontend + tester; no DB, no migrations), §4 Increment 2 — the S8 arm + `read_cases` capability (backend + tester), §5 File ownership (binding — CLAUDE.md §4), §6 Known traps this program walks past (each has burned this repo), §7 Acceptance summary, §8 Non-goals (from ADR 0134 — do not scope-creep them back in) (+19 more)

### Community 698 - "phase-3.md"
Cohesion: 0.16
Nodes (22): ApproveButton(), CorrectionRequestItem(), RejectButton(), ContinueCorrectionButton(), ADR-0085, CorrectionDecisionCard(), canWithdrawCorrection(), describeImpactSnapshot() (+14 more)

### Community 699 - "phase-4.md"
Cohesion: 0.08
Nodes (26): 1. Amendment 4's referral-dialog bullet is reversed: REMOVE, not "make reachable", 2. The `dsr` go-live flip is authorised — and this is where that fact lives, ADR 0131 — PHI erasure reach is bounded to DESIGNATED PHI fields; free text is out of scope for the pilot, Amendment 1 — this ratifies an invariant the architecture already held, and it removes NO backlog item, Amendment 2 — the compensating control is NOT training alone: a correction corridor exists, is documented to operators, and is BOUNDED, Amendment 3 — Decision 4 is keyed on SCOPE CLASS, not on working state, ⛔ Amendment 3 named NINE statements and THREE guards. It is TEN and FOUR., Amendment 4 — the choice is taken (FIX, not rollback), and Amendment 3's own magnitude was wrong (+18 more)

### Community 700 - "phase-5.md"
Cohesion: 0.17
Nodes (12): Summary — v3, VERDICT: ✅ **APPROVED**, W-0.1 · ✅ **D2 CONFIRMED. My PROBE 4 over-stated the blocker.** (v2 §V-3.3 is WRONG), W-0.2 · ✅ **D2a CONFIRMED — exactly, including the audit claim, which is the sharpest in the document**, W-0.3 · ✅ **D4 CONFIRMED — my "10 DEFINER" was itself a floor**, W-0.4 · ✅ **D1a CONFIRMED — v3's self-criticism is right, and sharper than my finding**, W-0 · Corrections to my own v2 — the fourth round of the same lesson, and it is mine again, W-1 · D3 — the lead's instruction was wrong, and v3 disproved it with evidence. ✅ **CONFIRMED** (+4 more)

### Community 701 - "phase-6.md"
Cohesion: 0.08
Nodes (25): 1. Method, 2.1 The four-gate correction is complete — enumerated, not taken on trust, 2.2 The single-point predicate really is single-point, 2.3 Fail-closed — confirmed on every path, 2.4 The second gate is present — no P0, 2.5 T4 is correct **for Increment 1**, and the comments say why truthfully, 2.6 The excluded classes, verified from the catalog rather than from the spec, 2.7 Per-affordance authority on the widened manage host (+17 more)

### Community 703 - "loading.tsx"
Cohesion: 0.10
Nodes (20): 0 · Why this document exists, and what it IS, 1 · OWNER AND PERIODICITY — ✅ DECIDED (PO, 2026-08-17), 2 · Preconditions (all verified against the live catalog), 3 · The procedure, 4 · ⛔ What "verified deletion" does NOT prove, 5 · Reconciliation, 6 · ⚠ Cloud caveats — do NOT gate a Cloud run on `capture`'s exit code, 6b · ⛔ PHI HANDLING FOR THE BACKUP HALF — read BEFORE taking any Storage backup (+12 more)

### Community 705 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.29
Nodes (7): 4.2 `form_responses.form_answers`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

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
Cohesion: 0.12
Nodes (31): adjudicateDsrRequest(), attestDsrTask(), closeDsrRequest(), completeDsrTask(), createDsrRequest(), disposeMeetingMinutesTask(), DsrActionState, executeDisposalTask() (+23 more)

### Community 711 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.04
Nodes (64): ADR-0117, advanceToInReview(), conclude(), createReferralDraft(), firstActiveReferralTypeId(), firstReplyOutcomeId(), freezeDocument(), readFlag() (+56 more)

### Community 712 - "11.1 `interview_notes`"
Cohesion: 0.07
Nodes (34): 0066 — patient_xref case-module grain re-keyed to the patient participant, Consequences, Context, Decision, Rationale, 0086 — Flexible-Forms feature phases FF-1…FF-5 pulled pre-pilot, Consequences, Context (+26 more)

### Community 713 - "Feature — `case_phase_results` (per-phase categorical result + manual override)"
Cohesion: 0.33
Nodes (6): ADR 0048 — User Registration & Identity Management, Alternatives rejected, Consequences, Context, Decision, The activation-link fix (BUG-UREG-002)

### Community 714 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.11
Nodes (19): 10 · NOT TESTED / NOT COVERED, 11 · Itemized change list, 12 · What is unambiguously right, and should not be lost in the verdict, 1 · What I re-measured (every figure below is mine, not inherited), 2.1 The claim as written is TRUE, and it is recorded honestly everywhere, 2.2 ⛔ But the record is now FALSE in the other direction — and this is MAJOR-1, 2 · Attack 1 — the central honesty claim, 3.1 The fix is genuinely transaction-safe, and the guard genuinely refuses ✅ (+11 more)

### Community 875 - "Unified non-PHI action_items hub"
Cohesion: 0.08
Nodes (24): 0 · Method, and what "verified" means below, 1 · BLOCKING (each is `CHANGES REQUESTED` on its own), 2 · MAJOR — claims that are true of the build and false of the function, 3 · MINOR, 4.1 Security / authorization (§A), 4.2 Does the fix work, and can the tests fail? (§B), 4.3 Records that verify (§C), 4.4 Frontend (§D) (+16 more)

### Community 876 - "CAPA stays isolated (PHI, Rule 12)"
Cohesion: 0.09
Nodes (23): 0. Shape of the work, 0a-bis — How the `required` invariant is actually enforced (design ruling, lead + backend 2026-08-23), 0a. Process PHI collection mode (D1–D3), 0b. Narrative rename + assignment role (D10, D11), 0c. TS side, 0d. pgTAP, 1a. Attributed-work affordance (D8), 1b-bis — What §1b got wrong, found during the build (2026-08-23) (+15 more)

### Community 877 - "committee_* SECURITY DEFINER RPCs"
Cohesion: 0.08
Nodes (25): A. Moved out entirely (12 rows, 2026-08-08 → 2026-08-14) — no live counterpart, Archive — Decisions (PROGRESS.md § Decisions register), B. Verbose form of the 32 rows that REMAIN live as one-liners, Collapsed index rows rotated out of PROGRESS.md 2026-08-04 (all decisions dated 2026-06-*), Live index rows as they stood before the 2026-08-14 compaction (32 rows, pre-2026-07 → 2026-08-10), Rotated 2026-08-21 — OPEN-2 (case-surface-split): the RECORD OF THE QUESTION, after the PO ruled, Rotated 2026-08-21 — OPEN-3 (case-surface-split): the Rule 12 question and its measured answer, Rotated 2026-08-23 (AFF2 rotation pass) — 15 concluded decision rows (+17 more)

### Community 878 - "Hub-and-spoke shape, redrawn boundary (Option A)"
Cohesion: 0.09
Nodes (23): 3.1 · Is the column set complete? — ⭐ **YES. Re-derived from the catalog; exact match.**, 3.2 · The guard change — **bounded, and the amendment's reasoning is sound, not circular**, 3.3 · The transcript purge — **correct, and no other column carries transcript-derived text**, 3.4 · pgTAP 351 — the fixture IS locked; ⛔ **a second vacuous pin exists (t25)**, 3.5 · The `ARM=census` / `ARM=wrapper` vacuity premise — **right in substance, over-stated in the record**, B1 — false ACL claim → **CLOSED, and the replacement claim verified independently**, B2 — stranded follow-up → **CLOSED by building the fix.** See §3., ⛔ B3 — the N1 closure record states a grep result that is false, and the file that falsifies it is introduced three lines later (+15 more)

### Community 921 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.14
Nodes (14): 2.1 DEFINER door hygiene (t19) — all 36 ethics functions, 2.2 Non-vacuity — authority-first, distinct SQLSTATE — **demonstrated live**, 2.3 Case-read boundary — every E2 table, verbatim `can_read_case`, no new shape, 2.4 D13 targeted door — reaches only the one response, never the case, 2.5 M2 retention (Rule 12 — Class-2 professional identity), 2.6 Catalogs, N arm, flag, Conformance checklist (build plan §5), Dimension 1 — Requirements (ADR 0073 §4 + the 0078 reconciliation) (+6 more)

### Community 922 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.29
Nodes (6): Follow-ups (non-blocking), Gate, Increments — each verified via git scope + LIVE catalog + `set local role` keystone, mutation-proven, Lessons (transferable), RV2 R2–R5 — Referrals v2 Governance (COMPLETE), SQLSTATEs (block `HC0A·`)

### Community 923 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.22
Nodes (10): classify(), count_sel(), degenerate_gates(), emit_report(), psql_c(), psql_f(), record(), restore_inflight() (+2 more)

### Community 924 - "10. Row-Level Security Strategy"
Cohesion: 0.03
Nodes (56): Appendix A — Polymorphism dialects (three sanctioned; closes hardening D12; ADR 0065), Appendix B — Catalog-vs-enum + freeze conventions (ADR 0065), ARCHITECTURE.md — Hospital Commission Forms Platform, Architecture Rules, Editing PROGRESS.md and its archives, One-line form, Rotation, The three-way test, for every line (+48 more)

### Community 925 - "useClientNow"
Cohesion: 0.18
Nodes (10): ⏸ AUTHZ · Gate 1 · A2 — the resolver · **BLOCKED pending a PO/lead ruling** (`backend`, 2026-07-15) — ⭐ **ruling received; A2 rescoped, M3 lands first**, AUTHZ Gate 1 — completed unit detail (rotated out of PROGRESS.md), ▶ AUTHZ · Gate 1 · M1 — exclusion durability (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M2 — A30 bucket C: platform_admin loses referral-PHI destruction (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M3 — defect ①: bare assignment no longer confers PHI (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5 — defect ③: the `is_active` outer gate (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5b — defect ③ AT THE DOORS: `qa`'s P1, and my closure was a floor (`backend`, 2026-07-15), ▶ AUTHZ · M4 — the gated-off myth: **FIVE** false flag descriptions corrected (`backend`, 2026-07-15) (+2 more)

### Community 926 - "ADR 0005 — `visible_when` condition shape (v1)"
Cohesion: 0.15
Nodes (13): 12. Open decisions requiring human/domain approval, 13. Risk register, 14. Program-level acceptance criteria, 15. Explicit non-goals and anti-patterns, 16. Resume checklist for a future lead, 2. Ubiquitous language for the redesign, 5. Current strengths to preserve, 7.1 In scope (+5 more)

### Community 933 - "AuditEntityType"
Cohesion: 0.31
Nodes (8): inputItem(), response(), section(), tree(), ADR-0089, ADR-0092, ADR-0136, toAnswerState()

### Community 934 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.12
Nodes (17): A. Groundwork findings (verified 2026-07-13, this branch), AI (satellites + cross-link) — authored 2026-07-13, B. SQLSTATE block allocation (ratified — high-water `HC099`), C. Feature-flag plan (ratified), D. Cross-cutting conventions (recorded once — bind every track), E. Collision contracts (locked — per-track reviews are conformance checks, not re-litigation), ETH·E1 (access spine) — authored 2026-07-13 · **M2 posture = the regulatory sign-off keystone**, ETH·E2 (procedure) — authored 2026-07-13 (+9 more)

### Community 935 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.05
Nodes (37): ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14), Consequences, Context, Decision, ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision, Consequences, Context, Decision (+29 more)

### Community 936 - "phase-result-options.ts"
Cohesion: 0.03
Nodes (56): ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions, Alternatives rejected, Consequences, Context, Decision, Implementation amendments (2026-06-25), ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles, Alternatives rejected (+48 more)

### Community 937 - "ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)"
Cohesion: 0.02
Nodes (114): 0062 — Meeting actual-occurrence time (`held_at` / `held_end`), Consequences, Context, Decision, 0095 — Process/case integrity audit: remediation scope, corrections, and deferred remodels, Consequences, Context, Decision 1 — implemented as substrate changes (migrations `20260906000100`–`001100`) (+106 more)

### Community 940 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.09
Nodes (23): 2.1 ⭐⭐ § 7 item 6 — SETTLED CLEAN, and my first matrix was WRONG, 2.2 C-1 re-verified end to end — and the tier question answered, 2.3 § 7 — the eleven items, each settled, 2.4 § 7 item 11 — I ran the mutation harness myself, 2.5 The `destination stream closed early` signal — **BENIGN, with two follow-ups**, 2.6 Security / RLS for the phase, on the settled catalog, 2.7 New findings this pass — all NON-BLOCKING, 2.8 What I could NOT verify — bounds with their mechanisms. **There is no pass 3.** (+15 more)

### Community 941 - "5.11 `referral_resolutions`"
Cohesion: 0.20
Nodes (10): ACT — "act as" STRICT ROLE ASSUMPTION (2026-08-10; ADR 0106 D1–D14; migrations `20260918000000`–`…002800`; **NO flag — the migration IS the cutover**, PO-locked P4), App layer, D14 arm classification (S4, 2026-08-10 — re-derive from `pg_proc`, never this table), ⛔ FOUR classes of hat-blindness — the checklist for any new gate, Gates that changed (verify against `pg_proc`, never this table), Known-open at hand-off, New surface, Standing hat-blind sweep (S4) — `ARM=hat` (+2 more)

### Community 942 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.29
Nodes (5): MemberAdministrativoControls(), appointAdministrativo, refresh, ADR-0061, ADR-0134

### Community 943 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.18
Nodes (11): B1 — Apply never deletes the meeting audio. Three documents say it does., BLOCKER, INFO, M1 — The "24 h sweep for objects with no live job" does not exist; two documents state it does., M2 — The audio TTL is lazy, so "transiently (≤ 24 h)" is not true as built., MAJOR, MINOR, QA review — MIN · Meeting audio → generated ata (`audio_minutes`) (+3 more)

### Community 944 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.40
Nodes (5): 11.1 Purpose, 11.2 Proposed schema, 11.3 Integrity, 11.4 Reminder integration, 11. New table: `case_notices`

### Community 945 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.17
Nodes (12): 1 · MAJOR-2(b), the picker scope limit — **NOT a blocker**, conditional on B-1, 2 · m2, the unaudited widened read path — **not a blocker; the P0 fix materially shrank it**, B-1 · MAJOR-2(a) is **NOT FIXED** — the error travels two hops further and is dropped at the third, B-2 · MAJOR-6's professional lane is uncovered, on a premise the catalog contradicts, B-3 · NEW — `src/lib/queries/cases.ts:1333` silently empties the **entire ETH·E4 roster**, Blocking items, P0-1 — **CLOSED.** Verified four ways, and the divergence detector works in both directions, pgTAP count — verified independently, and the flakiness has a cause (+4 more)

### Community 946 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.10
Nodes (21): ACTION_ITEM_STATUS_STYLE, DOC_TYPE_LABEL, ACTION_ITEM_STATUS_LABEL, CORRECTION_CLASSIFICATION_LABEL, CORRECTION_KIND_LABEL, CORRECTION_STATUS_LABEL, EVENT_KIND_LABEL, ADR-0085 (+13 more)

### Community 947 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.11
Nodes (18): 0. Plan-vs-catalog disagreements found (report-loudly section), 10. Estimate, 1. Scope and non-goals, 2. Migration window, 3. Step-by-step, 4. Repo-side work in the same phase (one artifact with the chain), 5. Keystones (suite `328_dm1_document_substrate.sql`) + mutation proof, 6. Census registration (the two binding traps, answered) (+10 more)

### Community 948 - "10. Row-Level Security Strategy"
Cohesion: 0.40
Nodes (5): 7.1 Purpose, 7.2 Proposed schema, 7.3 State transitions, 7.4 Authorization, 7. New table: `case_access_exclusions`

### Community 1171 - "dispose_referral_phi (dual-hospital)"
Cohesion: 0.08
Nodes (23): 1 · Breadcrumb, 2 · Identity band, 3 · Two-column grid, 3a · Editar dados pessoais, 3b · Editar registros profissionais, 3c · Adicionar vínculo hospitalar, 3d · Adicionar a uma comissão, About the Design Files (+15 more)

### Community 1172 - "GoTrue auth rate-limit (E2E env flakiness)"
Cohesion: 0.08
Nodes (23): 3.1 The two items handed to this review, 3.2 Other observations (non-blocking), 3. Code quality, UX and a11y, 4. Round-1 blocking items — all CLOSED, each re-verified, 4a. Blocking items as filed in round 1 (CHANGES REQUESTED), 5. Record-step obligations (not blocking, but each must land), 6. What I could NOT verify, 7. Summary (+15 more)

### Community 1173 - "nsp_org_admin role"
Cohesion: 0.11
Nodes (16): ChecklistItem, ChecklistRail(), AttachOutcome, Aviso, DOC_TYPE_OPTIONS, FIELD_STEP, PHASE_MESSAGE, StepReviewers() (+8 more)

### Community 1174 - "NSP-per-hospital (Phase B)"
Cohesion: 0.09
Nodes (13): opts(), dualHospitalAdminSession, hospitalAdminSession, makeAdmin(), orgAdminSession, rows, rpcCalls, SessionShape (+5 more)

### Community 1175 - "Org-to-hospital re-key (B0-B5)"
Cohesion: 0.16
Nodes (21): listActiveAffiliationsFor(), affiliationNames(), applyStatusFilter(), countByStatus(), DirectoryCredentialRow, DirectoryMembershipRow, FluentFilter, hospitalPeopleIds() (+13 more)

### Community 1176 - "FIX-2 test-isolation leak (staff1 hospital_admin)"
Cohesion: 0.14
Nodes (19): CAPABILITIES, ADR-0061, ADR-0134, ActionState, appointAdministrativo(), authorizeStaffOps(), CAPABILITIES, grantMemberCapability() (+11 more)

### Community 1440 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.40
Nodes (5): 8.1 Purpose, 8.2 Proposed schema, 8.3 Category strategy, 8.4 Finding history, 8. New table: `case_allegations`

### Community 1441 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.20
Nodes (10): 1. Method — classify by READING, not by name, 2. The full 31-row classification, 3. `open_capa_plan` — fixed, but with an honest vacuity finding, not a guessed keystone, 4. Keystones — red-first, per function, `supabase/tests/316_act_p0_caller_gate_sweep.sql`, 5. Catalog property diff, 6. Two more test-fixture regressions, same class as the earlier two this session, 7. Gate, 8. Is the split complete, or does the population need re-bounding? (+2 more)

### Community 1442 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.20
Nodes (10): 6.1 `interviews`, 6. Core Interview Aggregate, Recommended invariants, Status semantics, Suggested confidentiality values, Suggested Interview categories, Suggested priority values, Suggested recording policies (+2 more)

### Community 1443 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.40
Nodes (5): 9.1 Purpose, 9.2 Proposed schema, 9.3 Original Decision versus review Decision, 9.4 Issuance invariants, 9. New table: `case_decisions`

### Community 1444 - "AuditEntityType"
Cohesion: 0.17
Nodes (12): 11. Risk register, 12. Mapping from current to target concepts, 13. Decisions that require product approval, 15. Audit limitations, 16. Final recommendation, 17. References, 1. Scope and audit questions, 8. Implementation scope (+4 more)

### Community 1445 - "ARCHITECTURE.md — Hospital Commission Forms Platform"
Cohesion: 0.20
Nodes (10): 19.1 Design rules, 19.2 Active organization membership, 19.3 Organization permission, 19.4 Hospital permission, 19.5 Committee permission, 19.6 Domain-aware role access, 19.7 Explicit grant, 19.8 Explicit restriction (+2 more)

### Community 1446 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.50
Nodes (4): 3.1 Case capabilities, 3.2 Meeting capabilities, 3.3 Capability sources, 3. Authorization vocabulary

### Community 1448 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 6.1 Required functions, 6.2 Security-definer posture, 6.3 RLS policy shape, 6. Central authorization interface

### Community 1449 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.11
Nodes (18): DM2 — orchestration + Wave A: phase record, Finding DM2-F1 — the interview-label dimension is PARITY, not a dropped control (AMEND 3), Gate record (S1, gate step 1 scope), Obligations ledger (S2+ — checked off at each slice's gate), Pilot watch-item — LIST file-chain RLS cost (PO-ruled: no action pre-pilot), Red-first record (lead AMEND 1 — the two-migration split), S1 — the D15 confidentiality ceiling (backend, 2026-08-13), S2.7 record (2026-08-13) (+10 more)

### Community 1451 - "form-builder-enhancements.md"
Cohesion: 0.50
Nodes (4): 5.12 `referral_read_receipts`, Columns, Design rationale, Primary key

### Community 1452 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.40
Nodes (5): 3.17 `forms.form_matrix_rows`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1453 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.20
Nodes (10): Coupled-group execution order (migrations `20260719000300…`, after D3=`…0000` / D10=`…0200`), Execution rules (the failure mode is a missed literal), Execution status (backend, 2026-07-12), F-cleanup D11 — anglicize Portuguese status-enum internal keys (FULL, 12 enums), FRONTEND / TESTER work list (per enum) — derive authoritatively, then hand off, Locked translation dictionary — ✅ CONFIRMED (backend, 2026-07-12), Open confirmations before G1, PROVEN METHOD (use for G3–G6 — each step earned by a G1/G2 failure) (+2 more)

### Community 1454 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.27
Nodes (14): allow_body(), blind_from_findings(), check_no_degenerate_gates(), psql_admin(), psql_c(), run_arm_census(), run_arm_floor(), run_arm_hat() (+6 more)

### Community 1455 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.50
Nodes (4): 7.1 Classification, 7.2 Minimum necessary, 7.3 Restricted PHI, 7. PHI boundary

### Community 1456 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.50
Nodes (4): 8.1 Audit events, 8.2 Deactivation and suspension, 8.3 Expiry and revocation, 8. Audit and lifecycle requirements

### Community 1457 - "13.1 `interview_statements`"
Cohesion: 0.15
Nodes (13): 5. Findings, F10 — Medium-low: the delegated committee appointment table lacks direct subject and scope FKs, F11 — Medium-low: the project has no general principal model, F12 — Operational: Data API exposure behavior should be explicit, F1 — High: the standing role model is a closed, duplicated vocabulary, F2 — High: one record conflates affiliation, role assignment, and current state, F3 — High: scopes are fixed to exactly three nullable foreign keys, F4 — High: authorization mechanisms are fragmented without shared permission semantics (+5 more)

### Community 1458 - "case-meetings-panel.spec.ts"
Cohesion: 0.12
Nodes (16): ADR 0087 rulings, Amendment 1, MAJOR-1 — `completeness_deadlock_negative_groups` and the top-level half of `conditional_required_honoured` cannot fail, MAJOR-2 — `group_instances_cross_user_denied` (J1) does not test the clause it names, Other invariants, r1 · 1. Method, r1 · 2. P0-1 — correcting a response silently destroys every choice answer inside a repeating group, r1 · 3. MAJOR findings (+8 more)

### Community 1459 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.15
Nodes (13): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), setManualResult(), signInAs(), slug() (+5 more)

### Community 1460 - "case-meetings-panel.spec.ts"
Cohesion: 0.25
Nodes (8): 28. Validation Rules, Consent rules, Finding and summary rules, Interview rules, Participant rules, Session rules, Statement rules, Transcript rules

### Community 1461 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.15
Nodes (13): 8. Phased implementation plan, D5A — referral attachments and frozen snapshots, D5B — NSP RCA/CAPA evidence, D5C — printed/generated documents, D5D — meeting audio and processing artifacts, Phase D0 — ratification and production census, Phase D1 — current-model security remediation, Phase D2 — resource, document, file, and access foundation (+5 more)

### Community 1463 - "27. Example: Simple Action Item"
Cohesion: 0.22
Nodes (9): ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors, Alternatives rejected, BUG-NSP-004 — the non-event CAPA fallback must be applied to EVERY org-gate, uniformly, Consequences, Context, Decision, Implementation notes (sub-phase A, backend — discovered during build), M3 — "gate-fixed but body-not-scoped" (the second QA fix-loop class) (+1 more)

### Community 1464 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.20
Nodes (10): B1 — verified fixed, and the proof is the part that matters, M1 — verified built; the blunter predicate is accepted, and is better than what O3 wrote, M2 — accepted, MINOR / INFO batch, New observations from the delta (none blocking), Regression check, Round-1 findings — disposition, Round 2 — re-review of the remediation delta (+2 more)

### Community 1465 - "loading.tsx"
Cohesion: 0.20
Nodes (10): 43.1 One global role per user, 43.2 Hospital administrator can manage every user in organization, 43.3 Hospital administrator deletes user, 43.4 Every quality user reads every case, 43.5 Organization administrator automatically reads clinical data, 43.6 Separate authorization architecture for single-site customers, 43.7 JWT-only role storage, 43.8 Frontend-only field hiding (+2 more)

### Community 1466 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 6.10 Upload and scan state machine, 6.11 Deep Document module interface, 6.1 High-level model, 6.2 Securable resource registry, 6.3 Logical documents, 6.4 Immutable document versions, 6.5 Physical file objects and renditions, 6.6 Placements (+4 more)

### Community 1468 - "5.8 `referral_message_documents`"
Cohesion: 0.29
Nodes (7): 35. Rejected Simplifications, Case permission automatically grants all Interview content, Every participant must be a user, Interview as a calendar event, One table containing the entire Interview, Store all content in a generic notes table, Store recordings in PostgreSQL

### Community 1470 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.29
Nodes (7): 5.1 `people`, 5.2 `person_professional_credentials`, 5. Shared Person Model, Design rationale, Recommended constraints, Suggested `person_type` values, User linkage

### Community 1471 - "add-block-menu.tsx"
Cohesion: 0.22
Nodes (14): CaseDetailMotion(), DsrRecordMotion(), FALLBACK_MS, getMotionDurations(), Gsap, MOTION_EASE, readDurationMs(), RiseInGroup() (+6 more)

### Community 1473 - "loading.tsx"
Cohesion: 0.13
Nodes (15): 0. Scope, 1. Sequencing & dependencies, 2. Collision matrix — shared surfaces, serialized ownership, 3. Phased sequence, 4. Feature-flag plan, 5. Migration ownership & docs, 6. Testing & gates, 7. Risks & open decisions (+7 more)

### Community 1474 - "10. New table: `case_votes`"
Cohesion: 0.18
Nodes (16): metadata, OrgCaseTypesPage(), ADR-0051, ADR-0064, CaseTypeManager(), CaseTypeTerm, CaseTypeTerminology, CaseTypeTerminologyRow (+8 more)

### Community 1475 - "12. Optional table: `ethics_decision_details`"
Cohesion: 0.67
Nodes (3): 12.1 Graduation rule, 12.2 Proposed schema, 12. Optional table: `ethics_decision_details`

### Community 1476 - "ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case)"
Cohesion: 0.22
Nodes (9): 1. What landed, 2. Finding that invalidated the design note's §5.4 mounting plan — verified live, not assumed, 3. A second bug caught by the SAME live testing — the D9 hint suggesting the active hat, 4. The backend-posted `assumeRole` vs. `<form action>`'s own type contract, 5. `roleLabel` — the design note's own open question (§7 Q6), resolved, 6. Live verification (production standalone build, real personas, real DB), 7. Gate, 8. Scope note (+1 more)

### Community 1477 - "error.tsx"
Cohesion: 0.57
Nodes (6): run251(), run252(), run298(), run322(), run_case(), p0b-isolation-mutation-audit.sh script

### Community 1478 - "loading.tsx"
Cohesion: 0.11
Nodes (18): 0 · Scope of this verdict — stated so it cannot be inferred wrong, 1 · BLOCKING findings, 2 · MINOR findings, 3 · What I re-derived and what reproduced (the positive census), 4 · Answering, with a measurement, the question the S6 QA handed to the PO, 5 · The remote — measured, and the record is right about it, 6 · Carried to gate step 4 (PO) — none of these are DM5 defects, 7 · What it would take to reach APPROVED (+10 more)

### Community 1479 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 1. Derivation — re-derived from the catalog, not accepted from the hypothesis, 2. Per-function rewrite shape, 3. `can_manage_professional` — a pre-existing quirk deliberately preserved, not fixed, 4. Empirical equivalence proof — the load-bearing artefact of this stage, 5. Catalog property diff — every function, every axis, 6. Regression found and fixed — `test_helpers.claims_for` non-idempotency (Stage 1 defect), 7. Gate — full Phase Gate step 1, both `test:db` runs, and the diff-scoped sweep, Stage 2 — behaviour-preserving normalisation (backend, 2026-08-10)

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
Cohesion: 0.20
Nodes (10): 1. Discrepancy table, 2. Migration filenames + versions (window above `20260910000400`), 3. Old-vs-new diff strategy — what a rebuild can silently lose (M3/M4/M5), 4. S7 (exact shape, from the live body), 5. Verification plan, 6. Open items for lead ack (plan deltas found by this pass), ARM gates + door sweep, Mutation audit `supabase/tests/mutation/q1-quality-mutation-audit.sh` (+2 more)

### Community 1485 - "error.tsx"
Cohesion: 0.67
Nodes (4): run_case(), run_m2(), run_m3(), m1-mutation-audit.sh script

### Community 1486 - "loading.tsx"
Cohesion: 0.11
Nodes (18): 1. DIFF TABLE — plan-named vs. reality, 2. Section A — catalog enumeration, 3. Section B — code enumeration, 4. Section C — keystone state (`supabase/tests/328_dm1_document_substrate.sql`), 5. What this changes for the DM4 plan, 6. Uncertainties / not verified, A1. Routines referencing referral/attachment/snapshot/frozen/case-documents/storage_path, A2. Policies (all schemas) touching these identifiers (+10 more)

### Community 1488 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 1. The fix, 2. `hospital_id` nullability — determined from the schema, not assumed, 3. Sibling-trigger sweep — bounded by the property, not the name, 4. Keystone — red-first, `supabase/tests/317_act_capa_audit_scope.sql`, 5. Catalog property diff, 6. Gate, BUG-CAPA-AUDIT-SCOPE-1 — fixed (backend, 2026-08-10), Commits (this section)

### Community 1489 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.14
Nodes (14): EvidenceCountBadge(), OwnershipEditor(), formatPct(), GapListSection(), LevelCard(), ReadinessDashboard(), StandardTreeBranch(), ADR-0093 (+6 more)

### Community 1491 - "5.4 `referral_assignments`"
Cohesion: 0.06
Nodes (43): DashboardCharts(), groupBySection(), SectionEntry, SectionGroupData, FormPicker(), FreeTextSamples(), MatrixDistributionCard(), tintFor() (+35 more)

### Community 1492 - "page.tsx"
Cohesion: 0.40
Nodes (5): 10.1 `interview_consents`, 10. Consent and Recording Authorization, Recommended constraints, Recording gate, Uniqueness strategy

### Community 1493 - "5.1 `case_referrals`"
Cohesion: 0.20
Nodes (9): AUDIT-DOOR-BLINDNESS P0 — Sweep Triage & Fix Plan, FIX-A — the 26 ERROR cases → ALL COVERED (resolved via runlogs, no new work), Fix plan (PO-scoped 2026-07-18: invariant + high-risk + resolve unknowns; low-severity allowlisted), Method (the oracle — proven), Non-vacuity (§7.10) — keystones must not read 0-from-empty, Pre-req fixed en route, Reachability filter (Rule 1 — the RLS policy is the live boundary only if PostgREST can reach the table), Results — 292 neutralization cases (+1 more)

### Community 1495 - "17.1 `interview_external_access_links`"
Cohesion: 0.40
Nodes (5): 17.1 `interview_external_access_links`, 17. External Participant Access, One-time link behavior, Recommended constraints, Security requirements

### Community 1497 - "34. Testing Strategy"
Cohesion: 0.40
Nodes (5): 34.1 Database invariant tests, 34.2 RLS tests, 34.3 Security tests, 34.4 Workflow tests, 34. Testing Strategy

### Community 1498 - "Lead notes"
Cohesion: 0.13
Nodes (15): ADR 0079 — AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule, Amendment 1 — the invariant becomes a PHASE STEP, scoped to the diff (2026-08-04), Amendment 2 — one mutation is not sufficient evidence of vacuity (2026-08-04), Amendment 3 — ARM 3, the census that stops the sixteenth (2026-08-04, extended 2026-08-05), Amendment 4 — ARM 1 gains a THIRD sweep: row-returning doors (2026-08-05), Amendment 5 — the census is blind to WRITE-PATH doors, and ARM 1's write sweep is a frozen list (2026-08-06), Amendment 5a — the diff-derivation command must be case-INSENSITIVE (2026-08-06), Amendment 6 — the census's population must be derived from CALL-SITE BINDING, not signature shape (2026-08-10) (+7 more)

### Community 1499 - "runLifecycle"
Cohesion: 0.25
Nodes (7): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a RENAME moves a gate's verdict, and the census keys on NAMES (2026-08-09), Note — `commission_cadence_overview()`: the census demands a verdict the door-audit cannot produce (2026-08-09), Note — DM2·S2 command doors: outside every sweep's domain BY CONSTRUCTION (2026-08-13), Skipped SELECT/ALL policies (qual = true — intentionally public catalogs)

### Community 1500 - "rca-team-panel.tsx"
Cohesion: 0.29
Nodes (7): 3.3 `forms.form_sections`, Design Reasoning, Example `layout_config`, Important Columns, Purpose, Relationships, Suggested Table

### Community 1501 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.40
Nodes (5): 11.1 `interview_notes`, 11. Notes, Finalization rule, Visibility rule, Why both author IDs are useful

### Community 1502 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.40
Nodes (5): 25.1 Tenant consistency trigger, 25.2 Status transition function, 25.3 Finalization functions, 25.4 External token consumption function, 25. Recommended Database Triggers and Functions

### Community 1503 - "loading.tsx"
Cohesion: 0.12
Nodes (17): 1 · The r1 blocking items — discharged, re-proved by neutralization, 2 · The nine-verdict enumeration — my judgement, as asked, 3 · The two claims I was told to test rather than take, 3a · ⭐ CONFIRMED, and the Cloud position IS worse than r1 concluded, 3b · ⭐ CONFIRMED — the assertion-grain lesson, and it generalises, 4 · Ruling on the two verdicts pinned at the `verdictFor` grain only, 5 · ⭐ Closing MY OWN gap — the drill and the baseline are no longer single-sourced, 5a · The backup/restore drill — re-measured from scratch. **The headline is REAL.** (+9 more)

### Community 1504 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.15
Nodes (13): 0087 — FF-1 Repeating Groups: instance engine, condition scoping, required semantics, 1. Nesting is capped at depth 1, enforced in the schema, 2. Condition scoping — inside-out resolves, outside-in is forbidden at publish, 3. A fully-empty instance is not incomplete — it is not there, 4. FF-1 drops `form_items_conditional_not_required` globally, 5. Instance writers are INVOKER RPCs — correctness doors, not security doors, 6. Both container types ship; `group` is a pure visual container, Amendment 1 (2026-07-27, same day) — three corrections found at plan review (+5 more)

### Community 1505 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.20
Nodes (10): R2-1 · The F-1 fix — verified independently, three ways, R2-2 · Backend's two judgement calls — both correct, R2-3 · The sweep's control argument — I tested it, and it holds, R2-4 · The sweep's conclusion — independently reproduced, not audited by description, R2-5 · BUG-RCA-001 — confirmed; **does not block this phase**, R2-6 · Round 1 items re-checked, Round 2 — re-review (HEAD `f6c847d`), Two things to settle before deploy, outside this review's scope (+2 more)

### Community 1506 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.11
Nodes (18): 0. Substrate facts this plan builds on (verified 2026-08-07), 1. Program shape, 2.1 Migrations (sequenced at build time; ~4 files), 2.2 Pure renderer — `src/lib/pdf/` (frontend-engineer or backend? → **backend owns, 2.3 Data provider + mint action (backend), 2.4 Serving route + overlay (backend), 2.5 Verification surface (frontend + backend), 2.6 UI (frontend — invoke `frontend-design` skill first) (+10 more)

### Community 1508 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.09
Nodes (49): ActionItemSatelliteSections(), ActionItemSatellitesPanel(), ChecklistItem(), ChecklistSection(), formatDateTime(), REMINDER_TYPE_ORDER, ReminderSection(), SatelliteConfirmDelete() (+41 more)

### Community 1510 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.18
Nodes (11): ADR 0087 §Gate keystones — final state, r2 · 1. Method, r2 · 2. P0-1 — RESOLVED ✅, r2 · 3. MAJOR-1 and MAJOR-2 — RESOLVED ✅, r2 · 4. Regression sweep — the r1-proven keystones survived the rework, r2 · 5. Gate status, r2 · 6. Carried-forward and new findings — none blocking, r2 · 7. Note for the record (+3 more)

### Community 1511 - "Phase CH — Committee Charters & Meeting Cadence — QA Review"
Cohesion: 0.02
Nodes (170): isAssignmentOverdue(), metadata, MyReferralAssignmentsPage(), deriveFlowMetrics(), metadata, NspReferralsDashboardPage(), ADR-0042, ADR-0094 (+162 more)

### Community 1512 - "19. Status History and Audit"
Cohesion: 0.50
Nodes (4): 19.1 `interview_status_history`, 19.2 Platform audit requirements, 19. Status History and Audit, Design rationale

### Community 1513 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, CONTEXT.md Format, Rules (+11 more)

### Community 1514 - "23. Encryption and Sensitive Data"
Cohesion: 0.07
Nodes (35): CaseDocumentsPanel(), ADR-0033, ADR-0063, ADR-0100, ADR-0114, DOCUMENT_HOME_CONFIG, DocumentUpload(), DocumentsPanel() (+27 more)

### Community 1515 - "22. Retention, Deletion, and Legal Hold"
Cohesion: 0.50
Nodes (4): 22.1 General rule, 22.2 Different content may have different retention periods, 22.3 Legal hold, 22. Retention, Deletion, and Legal Hold

### Community 1516 - "31. Performance Considerations"
Cohesion: 0.50
Nodes (4): 31.1 Expected access patterns, 31.2 Transcript scale, 31.3 RLS performance, 31. Performance Considerations

### Community 1518 - "hospital-departments.spec.ts"
Cohesion: 0.20
Nodes (10): 1. What was built, 2. Verified, and how, 3. ⚠ WHAT IS NOT VERIFIED — read before resuming, 4. QA state, 5. Open decisions — PO only, none blocking, 6. Traps that cost real time — do not re-derive these, 7. Resume checklist, ETH·E4 — session handoff (2026-08-11) (+2 more)

### Community 1520 - "useClientNow"
Cohesion: 0.24
Nodes (12): actionsSource(), codesCarryingDetail(), codesFromBlocks(), CONDITION_TO_SQLSTATE, detailCodes(), doorRpcNames(), extractRaisedCodes(), functionBlocks() (+4 more)

### Community 1524 - "32. Implementation Phases"
Cohesion: 0.06
Nodes (76): PhaseResultBadge(), PhaseCorrectionMode, timelineResultToResolved(), AvatarStack(), CaseTimeline(), DAY_MONTH, DERIVED_PILL, durationSuffix() (+68 more)

### Community 1530 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.12
Nodes (16): Allocations, Assurance plan — read before writing a keystone, DM5 — Wave D + retirement: slice plan, Gate (CLAUDE.md §6), Ownership, S0 — retirement manifest capture + enumeration tool (backend) — **runs FIRST**, ~~S1 — substrate amendment~~ ⛔ **WITHDRAWN 2026-08-14, never built**, S2 — Wave D pt.1: NSP RCA/CAPA evidence (backend + frontend) (+8 more)

### Community 1534 - "supersede-document-button.tsx"
Cohesion: 0.18
Nodes (11): 19.10 Copying PHI into notification payloads, 19.1 Storing the conversation as JSONB, 19.2 Automatically granting target committee access to the entire case, 19.3 Combining shared messages and internal notes, 19.4 One referral with multiple target committees, 19.5 Resolving automatically when a response is sent, 19.6 Using assignments as permissions, 19.7 Hard-deleting communication (+3 more)

### Community 1535 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.12
Nodes (16): 1 · What I re-measured at HEAD (all mine; r1's own rule is that a figure is inherited or it is measured), 2 · B1 — ✅ **FULLY DISCHARGED**, and it went further than I asked, 3.1 All three named locations, plus one the lead found himself, 3.2 The new R15 is a real pin, not a better-worded one, 3.3 ⚠ MINOR-8 — the widened sweep still has a boundary, and it is one bucket wide, 3 · B2 — ✅ **DISCHARGED**, and the new R15 is sound, 4.1 The claim, and where it now lives, 4.2 It is false on the product path — measured, twice, at that path (+8 more)

### Community 1536 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.12
Nodes (16): 1 · Method, and what I did to the stack, 2 · What I independently re-proved (the part that is NOT taken on trust), 2a · The four S5.R acceptance items are load-bearing — **measured by neutralization**, 2b · Both gap keystones go RED if someone wires the disposal job — **reproduced**, 2c · Catalog facts behind the record and the runbook — all verified live, 2d · Every gate figure in the record reproduces at HEAD on my own run, 3 · ⛔ BLOCKING (2 MAJOR), 4 · The five questions I was asked (+8 more)

### Community 1537 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.20
Nodes (10): 14.1 Target committee inbox, 14.2 Source committee inbox, 14.3 Case referral history, 14.4 Deadlines, 14.5 Message ordering, 14.6 Message timeline, 14.7 Active participation, 14.8 Active assignments (+2 more)

### Community 1539 - "0085 — Case Correction Lifecycle (phases + narratives)"
Cohesion: 0.22
Nodes (9): 1. Coverage denominator, 2. Summary counts, 3. Table of every hit, 4. Traps, 5.1 MISSED BY §3 — confirmed BREAKS, and a gap in the plan itself, 5.2 Classification disagreement — lines 553, 598, 663, 635, 640, 5.3 Corrected coverage counts, 5. Lead reconciliation — a second, independent sweep (+1 more)

### Community 1540 - "5.2 `referral_context_versions`"
Cohesion: 0.25
Nodes (8): 1. Security / RLS crux — the direct-table bypass is closed at the table, 2. RPCs — authority, grants, and the stale-body regression, 3. Audit (Rule 11) & PHI (Rule 12), 4. Requirements — ADR 0083 D1–D10, 5. Code quality, 6. Findings, 7. Verdict, ADR 0083 — Case Custom Fields — QA Review

### Community 1541 - "4.12 `form_responses.form_submission_draft_snapshots`"
Cohesion: 0.22
Nodes (9): 1. Requirements coverage (spec `docs/phases/accreditation-track.md:427-506`, ADR 0057), 2. Security / RLS review (the crux — audited adversarially), 3. Code quality, 4. Bug-fix soundness (BUG-DOC-001..005), 5. Findings, 6. Verdict, INFO (no action required), MINOR (clear before Record if cheap; none blocking) (+1 more)

### Community 1543 - "loading.tsx"
Cohesion: 0.33
Nodes (5): Acessos (senha de todos: `Demo1234!`), Como aplicar, O que a demonstração cobre, Observações, Seed de demonstração — Comissão de Revisão de Prontuário

### Community 1544 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.17
Nodes (11): completePhase(), createCase(), editAndResubmit(), insertChoiceOptions(), rpc(), signInAs(), signOut(), slug() (+3 more)

### Community 1548 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.09
Nodes (21): 1. Header (no card — sits on the page background), 2. Escalation banner (conditional, above the header), 3. Lifecycle stepper (card), 4. Checklist (card), 5. Atividade (card) — unified timeline, About the Design Files, Assets, Data-model extensions (NOT in the current hub schema) (+13 more)

### Community 1550 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.33
Nodes (6): 1. `assume_role`'s audit row — scoped to the assumed role's own tenancy, 2. Confirming the prediction, not assuming it — what else was in the platform bucket, 3. The referral / indicator single-hat reachability question, 4. Gate, `assume_role` audit scope + the referral/indicator reachability question (backend, 2026-08-10), Commits (this section)

### Community 1557 - "AUTHZ Write-Path Door-Blindness Audit — Findings"
Cohesion: 0.50
Nodes (3): AUTHZ Write-Path Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous)

### Community 1561 - "AuditEntityType"
Cohesion: 0.33
Nodes (6): 5.1 `case_referrals`, Columns, Design rationale, Important constraints, Recommended priority values, Recommended status values

### Community 1564 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.12
Nodes (16): 0. What I re-derived myself (not accepted), 1.1 The P0-1 proof — real, and the sentinel genuinely fails, 1.2 MAJOR-1 cannot over-narrow — confirmed from the catalog, 1.3 Your gate claims — not overstated; if anything under-claimed, 1.4 The `e2e:prod` triage — it does not block, and I am not deferring to you, 1. The four items I was asked to scrutinise hardest, 2. Disposition of every r1 finding, 3. r2 findings (+8 more)

### Community 1585 - "13.1 `interview_statements`"
Cohesion: 0.09
Nodes (22): Amendment 3 — the CPF grain ✅ (the one I was asked to look at hardest), Architecture rules and §8 conventions ✅, Blocking findings, ⚠ CHANGES REQUESTED, `list_org_people` (B3, door side) ✅, Non-blocking findings, On the known residues, Premises in my own brief that I checked (+14 more)

### Community 1591 - "20. Reminder Rules"
Cohesion: 0.08
Nodes (24): ADR 0099 — Meeting audio → generated ata (minute_generator integration), Amendment 1 (2026-08-06) — the ≤ 24 h audio ceiling is LAZY-ENFORCED, Consequences, Context, Decisions, 1. Environment (all server-only), 2. The three size ceilings, 3. Callback reachability (+16 more)

### Community 1592 - "supersede-document-button.tsx"
Cohesion: 0.40
Nodes (5): 4.12 `form_responses.form_submission_draft_snapshots`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1593 - "access-audit-table.tsx"
Cohesion: 0.40
Nodes (5): 4.8 `form_responses.form_answer_risk_matrix`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1594 - "5.11 `referral_resolutions`"
Cohesion: 0.40
Nodes (5): 1. Audit — every recorded S1–S3 claim spot-checked against the substrate, 2. The six open non-copy findings — all resolved (commit `169668d`), 3. Verification, 4. The full gate (two runs) and what it caught, Stage 3 — lead audit session (2026-08-10, resume after the pause)

### Community 1595 - "FF-3 — Validation Engine (`item_validations`) · COMPLETE 2026-07-28"
Cohesion: 0.40
Nodes (5): 1. `test_helpers.claims_for` — the overload trap, 2. The `request.jwt.claims` sweep — bounded by the property, not the filename, 2b. Stage 3 carry-forward obligation — the 4 unreachable `seed.sql`/demo-seed sites, 3. Dual-hat seed persona — `dualhat.a@test.local`, Stage 1 — backend half (2026-08-09)

### Community 1596 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.04
Nodes (37): 0100 — Quality-office oversight: `quality_reviewer` role, commission oversight classification, org_admin content wall, membership lifecycle, break-glass, Alternatives rejected, Consequences, Context, Decision, Standing rule (added 2026-08-07 after QO·A; the most transferable thing this program produced), Standing rule II (added 2026-08-08 after QO·B — the *subtractive* twin of the rule above), 0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns (+29 more)

### Community 1598 - "loading.tsx"
Cohesion: 0.21
Nodes (19): ActionItemRow(), isItemOverdue(), ACTION_ITEM_STATUSES, ActionState, advanceActionItem(), authorizeCommission(), commissionOfCase(), completeActionItem() (+11 more)

### Community 1599 - "page.tsx"
Cohesion: 0.10
Nodes (21): ⭐ All four amendments record a decision the approved ADR got WRONG, each found by building it, Commits, Found by building — the four the reviews did not have (2026-08-25), Gate 2 — the 2026-08-25 GREEN run, and the first retained collapse log, Gate evidence rotated from PROGRESS.md 2026-08-25, ⛔ Known scoped absence, not coverage, Path to success — delta against handoff §6 (which otherwise stands), PDF·P3 — Printing Cases (task detail) (+13 more)

### Community 1600 - "validation-rules-editor.tsx"
Cohesion: 0.10
Nodes (21): 10 · The three blockers — CLOSED, 11.1 ⭐ ADR 0126 §E's NEW safety argument — it holds, and I verified it through the hash chain rather than through the artifact §E cites, 11.2 ⭐ Body-invariance — the remediation is real, and I did not take it on trust; I proved it myself, 11.3 Suite `355`, and the lead's own three instrument errors, 11 · The three things the lead asked me to be sceptical about, 12.1 🟠 R2-1 — MUST FIX BEFORE MERGE. The gate record is one increment behind the branch, in all three places it appears, and the true figures exist nowhere in the repo, 12.2 🟡 R2-2 — `backend-state.md`'s migration registry is now wrong by two, and the section still omits two of the round's four migrations, 12.3 🟡 R2-3 — suite `355` is recorded in no durable document (+13 more)

### Community 1601 - "ARCHITECTURE.md — Hospital Commission Forms Platform"
Cohesion: 0.21
Nodes (13): ActionItemFallbackDialog(), formatPeriodLabel(), formatTarget(), IndicatorKindBadge(), MeasurementStatusChip(), STATUS_STYLES, IndicatorList(), ChartDataTable() (+5 more)

### Community 1602 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.33
Nodes (5): AUTHZ Invoker-Wrapper Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), ERROR triage — neither is a blind spot, UNSUPPORTED — no openable guard (NOT a verdict; still owed a keystone)

### Community 1603 - "0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle"
Cohesion: 0.50
Nodes (4): 14.1 `interview_findings`, 14. Findings, Approval invariant, Design rationale

### Community 1604 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.13
Nodes (15): Carried into DM2 (do not re-derive), DM1 — substrate cutover: phase record (backend task log), Gate step 2 — tests, Gate step 3 — QA: **APPROVED**, Gate step 4 — human approval, Gate steps 2–5 (lead-run, 2026-08-12/13), Parked seams (what DM1 deliberately left behind), PROD-VERIFY checklist (lead condition 2 — for the later lead-authorized `db push`; NO remote action was taken this phase) (+7 more)

### Community 1605 - "5. Table Definitions"
Cohesion: 0.22
Nodes (9): 21.1 User profiles, 21.2 Organizations, 21.3 Hospitals, 21.4 Organization memberships, 21.5 Hospital memberships, 21.6 Committees, 21.7 Cases, 21.8 Role assignments (+1 more)

### Community 1606 - "page.tsx"
Cohesion: 0.12
Nodes (16): describedText(), node(), allFiles, analyse(), callSites, census, censusOf(), DOOR (+8 more)

### Community 1607 - "28. Example: Complex Action Item"
Cohesion: 0.22
Nodes (10): CommissionOversightToggle(), ADR-0100, Harness(), usePendingFocus(), ActionState, mapOversightError(), MESSAGES, QualityOversight (+2 more)

### Community 1609 - "loading.tsx"
Cohesion: 0.10
Nodes (19): About the Design Files, Active-filters summary bar, Advanced filter panel (right sheet), Assets, Components, Desfechos strip (collapsible), Design tokens (from `src/app/globals.css` — use the variables, not these literals), Existing code to build on (repo: optimusexercitia-dev/hospital_form_platform) (+11 more)

### Community 1610 - "loading.tsx"
Cohesion: 0.29
Nodes (7): How the detector was validated — read this before trusting any number, The gate, The property, The shapes the fixes took, Vacuous-assertion audit — FUP-VACUOUS-AUDIT-1 ✅ CLOSED, What counts as unconditional, What fixing these actually turned up

### Community 1611 - "loading.tsx"
Cohesion: 0.10
Nodes (20): ⚠ A cheap lint rule becomes possible — and it does NOT close this follow-up, Annotation landed at 30, not the 42 upper bound — the file-level trap was real, ⛔ CORRECTION 2026-08-20 (`frontend`, self-reported) — the true blast radius was **GET FORMS ONLY**, not 133 spreads, Enumeration (measured 2026-08-20, before the hook was touched) — the blast radius is ~1/3 of the class counts, 🔴 FUP-AUTHZ-HARNESS-PRECONDITIONS — a neutralization verdict has at least TWO preconditions and the harness checks ONE (owner: backend/harness; **filed after two near-miss false BLINDs on the same live door in one session**), 🟡 FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE — the browser-level P0 guard covers the interview lane only (owner: tester; **filed 2026-08-21 by its own author, as a stated bound**), 🟠 FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET — the shared disposal-copy property has no census of the surfaces it is asserted on (owner: lead/frontend; **filed 2026-08-21, found by reading 15 tests before deleting them**), 🟡 FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE — three of the four erasure lanes are driven through the DSR inbox in a browser; the referral lane is not (owner: tester; **filed 2026-08-21 as the named residual of a bug that closed on removal**) (+12 more)

### Community 1612 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.22
Nodes (9): 10.1 Catalog and schema tests, 10.2 Decision-matrix tests, 10.3 Product-called path tests, 10.4 Mutation tests, 10.5 Shadow evaluation tests, 10.6 Performance tests, 10.7 Migration and rollback tests, 10.8 Required release gates (+1 more)

### Community 1613 - "loading.tsx"
Cohesion: 0.10
Nodes (21): 4.10 `form_responses.form_answer_revisions`, 4.4 `form_responses.form_repeating_group_instances`, 4.7 `form_responses.form_answer_matrix_cells`, 4.9 `form_responses.form_answer_references`, 4. Answer Storage Layer, Design Reasoning, Design Reasoning, Design Reasoning (+13 more)

### Community 1614 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2.1 One identity, multiple scoped relationships, 2.2 Roles are assignments, not attributes of the user, 2.3 Scope does not imply inheritance, 2.4 Administrative access and clinical-data access are orthogonal, 2.5 No destructive deletion of historical identities or memberships, 2.6 Deny by default, 2.7 RLS is the final authorization boundary, 2.8 Service-role access is not normal application access (+1 more)

### Community 1615 - "28. Example: Complex Action Item"
Cohesion: 0.14
Nodes (18): assertRouteDenied(), callRpc(), createEthicsCase(), DashSnapshot, dbDelete(), dbInsert(), dbQuery(), getOwnerToken() (+10 more)

### Community 1616 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 4. What the current design does well, S1 — Database-enforced isolation, S2 — Administrative and clinical duties are separated, S3 — Current membership storage is relationally stronger than earlier reports, S4 — Membership writes have a real door, S5 — Revocation, expiry, suspension, and active-role checks fail closed, S6 — Case authorization is a deep module, S7 — Privileged reads and writes are designed as auditable doors (+1 more)

### Community 1618 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.12
Nodes (26): affiliatePerson(), AffiliatePersonInput, endAffiliation(), endOrgAffiliation(), lookupOrgPeople(), MESSAGES, PgErrorish, revalidateAffiliationSurfaces() (+18 more)

### Community 1620 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.22
Nodes (9): 9. Phased implementation plan, Phase 0 — Record, baseline, and freeze the interface, Phase 1 — Add catalogs and scope registry in shadow-only mode, Phase 2 — Unify authorization mutations, Phase 3 — Introduce the shared read decision seam, Phase 4 — Replace active role type with authorization context, Phase 5 — Add resource grants and adapters, Phase 6 — RLS consolidation and privileged-function hardening (+1 more)

### Community 1621 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.11
Nodes (19): 0. The two open [INF] items are CLOSED, 1. Catalog facts you will need, 2. Six findings that change the build, 3. Already written by the lead (syntax-checked in a rolled-back transaction), Authz arms — scope, and the substitution trap (added 2026-08-25, gate step 1 OUTSTANDING), Case authorization, `cases` lifecycle, ⭐ Finding 1 — `cases.revision` CANNOT exist. D4's column is unsatisfiable. (+11 more)

### Community 1622 - "ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target"
Cohesion: 0.20
Nodes (10): A.1 Migrations (7, sequenced after the highest registered version at build time; was `20260910000400` on 2026-08-06), A.2 Threading surface (the "new arm must inherit every sibling" list), A.3 Frontend (~16–18 files; precedent: the NSP console), A.4 Seed (`supabase/seed.sql`), A.5 Verification (Phase Gate §6), Phase A — classification + `quality_reviewer` + UI (pilot-blocking), Phase B — org_admin content wall (before pilot data accumulates), Phase C — lifecycle + break-glass (before commercial sale) (+2 more)

### Community 1623 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.22
Nodes (9): 10.1 Mandatory project gate for every phase/sub-wave, 10.2 Catalog and privilege tests, 10.3 Authorization behavior matrix, 10.4 Mutation testing — non-negotiable, 10.5 Storage and lifecycle integration tests, 10.6 Domain integration tests, 10.7 Migration and reconciliation tests, 10.8 Performance tests (+1 more)

### Community 1624 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.11
Nodes (17): About the Design Files, Assets, Behavior, Behavior & state, Design Tokens (already in `src/app/globals.css` — use, don't redefine), Existing code to build on, Fidelity, Files in this bundle (+9 more)

### Community 1625 - "16.1 `interview_documents`"
Cohesion: 0.40
Nodes (5): App layer, ETH·E4 — Ethics participant seating & professional identity (2026-08-11; ADR 0108 D1–D8 + the D5 amendment; migrations `20260919000100`–`…000600`; **NO flag — the seating panel was already mounted and unfillable**), Known-open at hand-off, New / changed doors (from `pg_proc`, not the migrations), ⚠ `professional_profiles` is on a COLUMN-LIST grant — 12 of 17

### Community 1626 - "MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record"
Cohesion: 0.11
Nodes (18): AFF2 — implementation plan: affiliation-scoped administration + user-management redesign, B1 · Migration: `profiles.date_of_birth` + `profiles.phone` (ADR 0133 D9–D10), B2 · Migration: `professional_credentials` SELECT widening (D13), B3 · Migration: `list_org_people` payload gains `date_of_birth` (D11), B4 · The scope-rule authorizer + action rewiring (D1–D4), B5 · Vitest keystone matrix (D4 + Amdt 1), B6 · Detail-page locked-column read (D10, D12), B7 · Directory query widening (D14) (+10 more)

### Community 1627 - "5 · Over-reach audit (things wrongly marked for removal)"
Cohesion: 0.11
Nodes (18): 0. Method, and what it is worth, 1. Requirements audit — D1–D14, 2. Security / RLS — from the catalog, 3. Code quality, 4. Required changes, 5. Open risks — for the PO to weigh, 6. Could not verify, `BUG-E2E-CORRECTIONS-KBD-FOCUS` — the attribution reasoning holds (+10 more)

### Community 1628 - "20. Reminder Rules"
Cohesion: 0.25
Nodes (8): 17.1 Hospital administrator adds a user already in the organization, 17.2 Existing platform user in another organization, 17.3 New platform user, 17.4 Remove user from a committee, 17.5 Remove user from a hospital, 17.6 Remove user from the organization, 17.7 Delete identity, 17. User invitation and registration workflows

### Community 1629 - "readiness-chart-loader.tsx"
Cohesion: 0.22
Nodes (9): 8.1 `draft → submitted`, 8.2 `submitted → accepted`, 8.3 `submitted → declined`, 8.4 `under_review → awaiting_information`, 8.5 `awaiting_information → under_review`, 8.6 `under_review → answered`, 8.7 `answered → resolved`, 8.8 `resolved → under_review` (+1 more)

### Community 1630 - "deleteAdHocPhase"
Cohesion: 0.23
Nodes (18): CaseTagsPanel(), ActionState, archiveCaseTag(), assignCaseTag(), authorizeCommission(), authorizeCommissionConfig(), commissionOfCase(), commissionOfTag() (+10 more)

### Community 1631 - "loading.tsx"
Cohesion: 0.04
Nodes (46): 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema, conditionTargets widening (supersedes a prior decision), Consequences, Context, Decisions, ADR 0098 — AFF substrate & doors: the shape decisions ADR 0097 left open, Consequence recorded, not discovered later, W2 — doors, visibility, dominance (+38 more)

### Community 1632 - "loading.tsx"
Cohesion: 0.18
Nodes (17): listMeetings(), listCommissionReferrals(), listTechnicalDirectionReferrals(), mapReferralListItem(), referralTargetName(), listSubmissions(), CursorFieldKind, CursorSchema (+9 more)

### Community 1633 - "loading.tsx"
Cohesion: 0.11
Nodes (18): ADR 0155 — Post-AFF4 tenancy and person-model evolution: a staged sequence, not a redesign, Consequences, Context, D0 — Ordering rule: AFF4 completes and merges before any step below begins, D1 — Step 1: finish AFF4 through the §6 gate and merge; then release the held DatePicker branch, D2 — Step 2: harvest AFF4's rulings as design input, in writing, D3 — Step 3: name the affiliation ≠ authorization split in ARCHITECTURE.md, D4 — Step 4: extract the PII columns out of `profiles` ("Move 4-lite") (+10 more)

### Community 1634 - "loading.tsx"
Cohesion: 0.33
Nodes (8): ensureSentDtReferral(), purge(), readReferralsFlag(), setReferralsFlag(), sql(), ADR-0094, ADR-0106, ADR-0137

### Community 1635 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 5.7 `referral_document_links`, Columns, Design rationale, Permission requirement, Suggested access modes, Suggested audiences

### Community 1636 - "loading.tsx"
Cohesion: 0.16
Nodes (12): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), signInAs(), slug(), startResponse() (+4 more)

### Community 1637 - "loading.tsx"
Cohesion: 0.30
Nodes (14): ActionState, authorizeOrg(), CaseTypeTerminologyInput, clearCaseTypeTerminology(), createCaseParticipantRole(), mapVocabularyError(), MESSAGES, PARTICIPANT_TYPES (+6 more)

### Community 1638 - "loading.tsx"
Cohesion: 0.11
Nodes (21): ListDirectoryOptions, ALL_FILTERS, ALL_STATUSES, cases, now, VectorCase, deriveUserStatus(), OrgUserPage (+13 more)

### Community 1639 - "loading.tsx"
Cohesion: 0.33
Nodes (6): FF-3 door parity - DISCHARGED, and it CORRECTS ADR 0090 section 6, FF-3 - Validation Engine (2026-07-28; ADR 0090 + Amendment 1; migrations `20260901000000`-`...000800`; flag `item_validations` **ON** via `...000800`), Four fail-open defects, none catchable by tsc/lint/unit/build, pgTAP, Two lessons worth more than the code, Verified catalog shape (2026-07-28, post-`db reset`; re-derive, do not trust this text)

### Community 1641 - "loading.tsx"
Cohesion: 0.12
Nodes (16): About the Design Files, Anatomy, Assets, Card shell (`.crd`), Composer (contributors only — hidden for read-only roles), Design Tokens (oklch — Clinical Calm), Fidelity, Files (+8 more)

### Community 1642 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 0083 — Case Custom Fields (Template-Defined Administrative Descriptors), Consequences, Context, Data model, Decisions, Deferred (out of scope), The concrete surface (for the build phase)

### Community 1643 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 20.1 General setup, 20.2 Always target database roles, 20.3 Explicitly reject unauthenticated access, 20.4 Separate operation policies, 20.5 Use both `USING` and `WITH CHECK`, 20.6 Remember UPDATE also requires SELECT visibility, 20. RLS policy strategy

### Community 1644 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 6.1 Design principles, 6.2 Recommended schemas, 6.4 Decision algorithm, 6.5 Deep authorization interface, 6.6 Authorization context, 6.7 What not to make generic, 6. Greenfield design

### Community 1645 - "loading.tsx"
Cohesion: 0.27
Nodes (7): ADR-0051, verifyAuditChainAction(), VerifyChainState, AUDIT_MESSAGES, ADR-0028, AuditChainResult, verifyAuditChain()

### Community 1646 - "loading.tsx"
Cohesion: 0.15
Nodes (13): ADR 0120 — DM5 (Wave D + retirement) decisions, ⚠ AMENDMENT (2026-08-14, after implementation): the DETAIL half of D18 guards nothing reachable, Consequences, ⚠ CORRECTION, made before this ruling was recorded: a remote reset does NOT clear orphaned bytes — it CREATES them, D17 — DM5 designs for a RESET remote (PO ruling, 2026-08-14), ⚠⚠ D18 IS PRESENTATION, NOT AN ACCESS CONTROL — Architecture Rule 1, D18 — printed renditions are FILTERED OUT of the Documentos panel (PO ruling, 2026-08-14), ⛔⛔ D3, D4 and D5 ARE WITHDRAWN — superseded by D11 (PO re-ruling, 2026-08-14, same day) (+5 more)

### Community 1647 - "loading.tsx"
Cohesion: 0.05
Nodes (40): 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 (detail for the live row), 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 **RE-GATE** after the QA fixes, 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 re-run CLEAN at `e7ec7529`, 2026-08-21 — DSR operational remediation, the two gate rows' detail, §6 step 1 — verified by the lead, not taken from teammate reports, §6 step 2 — the full `npm run e2e:prod` (19 batches, prod-standalone, fresh server + fresh `db reset` per batch), Archive — Test Run Summary (full history, Phases 0 → QO·A), ⛔ CORRECTION 2026-08-21 — the Increment-1 RE-GATE row's "lint(8) 0" was FALSE and is withdrawn (+32 more)

### Community 1648 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 6.3 Core model, Grant ceilings, Permissions and roles, Principals, Resources, explicit grants, and restrictions, Role assignments, Scopes

### Community 1649 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 3.8 `forms.form_block_default_values`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1650 - "loading.tsx"
Cohesion: 0.09
Nodes (18): ActiveFilters(), BUILTIN_VIEWS, ChipBar(), DEFAULT_F, DropChip(), FilterPanel(), inPeriod(), matchRow() (+10 more)

### Community 1651 - "S4·CH — Committee Charters & Meeting Cadence (Phase 21) — complete"
Cohesion: 0.12
Nodes (17): 1.1 The signing door is `public.sign_section`, and the ADR never names it, 1.2 "Two copies of the pending-signoff computation" is **six**, 1.3 ⛔ The drift the ADR predicted has ALREADY happened — a live defect, 1.4 D7's ruled decline path does not currently exist, 1.5 D5 as written moves an HC061 raise onto the wrong actor, 1.6 Rows that hold, 1.7 Routines measured and deliberately NOT changed, 1. What the re-derivation changed — read this before the task list (+9 more)

### Community 1652 - "FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)"
Cohesion: 0.02
Nodes (143): metadata, PhaseResponderPage(), ADR-0085, ADR-0136, metadata, NarrativeEditorPage(), ADR-0033, ADR-0100 (+135 more)

### Community 1653 - "1 · Verification of the three NEW findings"
Cohesion: 0.15
Nodes (13): 🔴 A STALE ALLOWLIST ENTRY PRE-EXCUSES A FUTURE DOOR — found by the repo-wide removal sweep, ✅ AUTHZ ARMS — all four HOLD (lead-run 2026-08-13, registration by backend: the split was deliberate), ✅ DIFF-SCOPED DOOR SWEEP — `BLIND: 0`; the one `ERROR` resolved by reading the runlog, DM3 — Wave B: controlled documents (phase record), ✅ GATE STEP 1 — **GREEN**, lead-verified independently (2026-08-13), ⛔ GATE STEP 1 — **RED**. `supabase db reset` FAILS (2026-08-13, lead-run), 🟢 IN PROGRESS — **DM3: Wave B — controlled documents** (opened 2026-08-13), ⚠ INCIDENT (2026-08-13) — `supabase/` left the index; 613 files deleted from HEAD, all recovered (+5 more)

### Community 1654 - "loading.tsx"
Cohesion: 0.50
Nodes (4): AFF — Hospital affiliation, CPF person identity, org people directory (2026-08-06; ADR 0097 + 0098; migrations `20260909000100`–`…001300`; NO flag, structural), Doors (verified against `pg_proc`, not the migrations), Other surfaces this changed, ⚠ Read this before touching the audit trail

### Community 1655 - "loading.tsx"
Cohesion: 0.15
Nodes (13): Carried forward, unchanged, non-blocking, Evidence I produced — the fix did not narrow Wave A, Evidence I produced — the fix works, MAJOR-1 — DISCHARGED, MINOR-1 — CLOSED, NEW-1 (INFO, not DM3's) — two specs flaked in BOTH independent full-gate runs, r2 gate figures — what I re-ran vs accepted, Recommendation to the lead (+5 more)

### Community 1656 - "loading.tsx"
Cohesion: 0.50
Nodes (4): DOOR-PARITY RULE - read before adding ANY door or policy, FF-2 - Matrix & Risk Matrix (2026-07-27; ADR 0089; migrations `20260830000000`-`...001500`; flag `matrix_fields` **ON** via `...001200`), Out-of-phase fixes carried in this window, Policy arms - diff any new answer/definition table against this

### Community 1657 - "loading.tsx"
Cohesion: 0.50
Nodes (4): Doors (verified against `pg_proc`, not the migrations), ⚠ Four rebuild property losses in one phase — the generalized rule, PCI — substrate guards (the audit findings, `20260906*`), PCI + TV — Process-case integrity + template identity/version split (2026-08-05; ADR 0096; migrations `20260906000100`–`…001100` (PCI) · `20260907000100`–`…001200` (TV); NO flag, structural)

### Community 1658 - "V-6 Â· What M1 must cover â€” the authoritative fix set"
Cohesion: 0.17
Nodes (12): 0. What step 0 changed about this plan, 1. PO rulings for this phase (2026-08-14), 1b. Rulings added 2026-08-14 after backend's catalog pass (findings 4 + 5), 1c. Corrections to §0 from backend's catalog pass — §0 was WRONG twice, 2. Slices, owners, file ownership, 3.1 Both write seams are in the census blind class, 3.2 The negative twin (plan step 3, sharpened by step 0), 3.3 Standing method rules for this phase (+4 more)

### Community 1659 - "loading.tsx"
Cohesion: 0.17
Nodes (12): Blocking findings, Discharge conditions for APPROVED, DM4 — Wave C: referrals · QA review (gate step 3), Exit criteria (plan §4), individually, Follow-ups filed this phase, INFO, 🔴 MAJOR-1 — `16/16 RED-PROVEN` does not reproduce at HEAD: N10b's mutation is a silent no-op *(blocking)*, 🔴 MAJOR-2 — the retired positive twin lost its can-fail proof, and the disposition comment claims coverage that does not exist *(blocking)* (+4 more)

### Community 1660 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 15.1 Aggregate analytics, 15.2 Case summary access, 15.3 Full quality oversight, 15.4 Domain restrictions, 15.5 Confidentiality policy, 15. Quality and patient-safety access model

### Community 1661 - "W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**"
Cohesion: 0.17
Nodes (12): Document model redesign — program plan (DM0–DM5), Phase DM0 — ratification (this worktree), Phase DM1 — substrate cutover (backend-only, no UI), Phase DM2 — orchestration + Wave A (turns `attachments` experience back on), Phase DM3 — Wave B: controlled documents, Phase DM4 — Wave C: referrals, Phase DM5 — Wave D + retirement, Program acceptance (condensed from audit §14, minus deferred items) (+4 more)

### Community 1662 - "sup-supersession.spec.ts"
Cohesion: 0.15
Nodes (13): A. Verbose Phase Status cells — 15 rows (14e · 22-v2 · 22-v3 · DM · DLB · ETH·E4 · case-custom-fields · bulk-case-create · PCI · AFF · MIN · TV · QO·A · QO·B · PDF·P1 · PDF·P2 · ACT), Archive — Phase Status gate detail (rotated from PROGRESS.md), B. "Recently completed" table — the verbose "Still open" column (rotated 2026-08-12, re-rotated here), C. "Completed work (archived to docs/progress/)" — the ad-hoc/out-of-phase list, verbose form, Completed work (archived to docs/progress/), Completed work (archived to docs/progress/), ⬛ DM3 + DM2 — rotated 2026-08-14 (the DM4 Record step); detail in `docs/progress/`, ⬛ DM4 — Wave C: referrals — ✅ PO-approved 2026-08-14, rotated at the DM5 open (+5 more)

### Community 1663 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 7.10 Round-2 status of the round-1 findings, 7.11 Closing, 7.1 The fix, read from the catalog, 7.2 Q1 — is it the class, or just the two instances? *(re-derived independently)*, 7.3 Q2 — third-party semantics *(verified, and beyond what 318 covers)*, 7.4 Q3 — break-glass: intact, but **the E2E evidence you cited does not cover it**, 7.5 Q5 — keystone 318 non-vacuity: **independently reproduced**, 7.6 Q6 — catalog property diff *(re-read, not assumed)* (+4 more)

### Community 1664 - "loading.tsx"
Cohesion: 0.40
Nodes (5): QO·B — org_admin / hospital_admin CONTENT WALL (2026-08-08; ADR 0100 **D12** + PO rulings **Q1–Q9**; migrations `20260915000000`–`…000500`; **NO flag — subtractive by design**), ⛔ THE FAILURE MODE THIS PHASE EXISTS TO WARN ABOUT, Verification estate (re-derive; do not trust this text), What it KEEPS — each a ratified decision, each pinned so a sweep cannot reverse it, What the tenancy admin LOST (all of it row-level content)

### Community 1665 - "loading.tsx"
Cohesion: 0.50
Nodes (3): FACES, ADR-0104, root

### Community 1667 - "3. Current authorization model"
Cohesion: 0.33
Nodes (6): 3.1 Identity and account state, 3.2 Standing roles, 3.3 Active-role assumption, 3.4 Case authorization, 3.5 Other authorization planes, 3. Current authorization model

### Community 1668 - "9. Team sequencing and file ownership"
Cohesion: 0.33
Nodes (6): 9. Team sequencing and file ownership, Backend owner, Frontend owner, QA reviewer, Serialization constraints, Tester

### Community 1669 - "5.4 `referral_assignments`"
Cohesion: 0.11
Nodes (18): 5.11 `referral_resolutions`, 5.4 `referral_assignments`, 5.6 `referral_internal_notes`, 5.8 `referral_message_documents`, 5. Table Definitions, Columns, Columns, Columns (+10 more)

### Community 1670 - "37. Multi-hospital administration edge cases"
Cohesion: 0.33
Nodes (6): 37. Multi-hospital administration edge cases, Case A: User belongs to Hospitals A and B, Case B: Hospital A suspends user, Case C: Organization suspends user, Case D: Quality manager is assigned only to Hospitals A and C, Case E: Quality manager has patient-safety domains only

### Community 1671 - "42. Operational recommendations"
Cohesion: 0.33
Nodes (6): 42.1 Require reasons for privileged actions, 42.2 Time-limit exceptional access, 42.3 Periodic access review, 42.4 Separation of duties, 42.5 Emergency lockout, 42. Operational recommendations

### Community 1672 - "8. Membership tables"
Cohesion: 0.33
Nodes (6): 8.1 Organization memberships, 8.2 Hospital memberships, 8.3 Enforce hospital/organization consistency, 8.4 Committees, 8.5 Committee memberships, 8. Membership tables

### Community 1673 - "Lead notes"
Cohesion: 0.12
Nodes (17): 0.1 The erasure doors abort, and the filed record undercounts them, 0.2 A mandatory human gate stands in front of a residue class the program proved absent, 0. Why the round exists — the two live defects, measured, 1. PO decisions taken 2026-08-20 (binding; do not re-open), 2. Workstreams, 3. Constraints any change must respect (binding, carried forward), 3b. ⛔ The deployment fact that made every other item moot — ✅ DECIDED, and the decision is recorded HERE, 4. Explicitly NOT in this round (+9 more)

### Community 1674 - "PCI + Process-Template Versioning — phase detail (archived)"
Cohesion: 0.11
Nodes (18): 🟠 FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER — 103 authored pt-BR refusals, and the app layer discards essentially all of them (owner: backend/frontend; filed 2026-08-22, found when a PO-ruled message never reached the UI), 🟡 FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE — the write succeeds and nothing shows it (owner: backend; filed 2026-08-22 from the phase-result widening), 🟡 FUP-AFF2-ACTIVE-MEANS-TWO-THINGS — three authorities say "active membership" and no policy implements it (owner: backend/PO; filed 2026-08-23 at AFF2 build start, from a conflict `backend` measured before writing SQL), 🟢 FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED — half of `app` is PUBLIC-executable, and the only thing bounding it is one config line (owner: backend; filed 2026-08-22, found while deriving an ACL by property for ADR 0134 Amdt 6), 🟡 FUP-CS2-QA-RESIDUE — the twelve non-blocking QA findings from Increment 2, and four of them are the same class (owner: backend/tester/frontend; filed 2026-08-22 at the Record step; ⭕ **12 → 6 on 2026-08-22** — M-5/M-6/M-7/M-14/M-15/M-16 remediated red-first and QA C-3 discharged; **M-4 STRUCK as already-delivered**. Remaining: M-1, M-8, M-11, M-12, M-13, M-17. Record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md)), 🟠 FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS — a green E2E run against a stale instrument is indistinguishable from a real pass (owner: tester/lead; filed 2026-08-22, found mid-verification in Increment 2), 🟠 FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES — the baseline can only be diffed arithmetically, and the evidence is destroyed before anyone can check (owner: tester/lead; filed 2026-08-23, found when the AFF2 gate tried to compare flaky tests by identity), 🔴 FUP-ETHICS-CASE-DELETE-CASCADE — a commission `staff_admin` can `DELETE` an in-flight ethics case over PostgREST, cascading all SEVEN `ethics_*` tables, with ZERO audit rows naming any ethics entity (owner: backend + PO; found 2026-08-21 answering the PO's "were any doors opened?", ADR 0132) (+10 more)

### Community 1675 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.33
Nodes (6): 10.1 Referral read access, 10.2 Message insertion, 10.3 Internal notes, 10.4 Documents, 10.5 Linked cases, 10. Row-Level Security Strategy

### Community 1676 - "11. Scoped role-assignment tables"
Cohesion: 0.40
Nodes (5): 11.1 Organization role assignments, 11.2 Hospital role assignments, 11.3 Committee role assignments, 11.4 Platform role assignments, 11. Scoped role-assignment tables

### Community 1677 - "35. Administrative UX workflows"
Cohesion: 0.40
Nodes (5): 35.1 Hospital user screen, 35.2 Organization user screen, 35.3 Quality dashboard, 35.4 Single-site customer, 35. Administrative UX workflows

### Community 1678 - "39. Testing strategy"
Cohesion: 0.40
Nodes (5): 39.1 Minimum test personas, 39.2 Required cross-scope tests, 39.3 Test through real access paths, 39.4 pgTAP, 39. Testing strategy

### Community 1679 - "3. Authorization strategy"
Cohesion: 0.40
Nodes (5): 3.1 RBAC: role-based access control, 3.2 Scope-bound assignment, 3.3 ABAC: attribute-based conditions, 3.4 Explicit grants and restrictions, 3. Authorization strategy

### Community 1680 - "41. Existing-data migration"
Cohesion: 0.40
Nodes (5): 41.1 Create memberships first, 41.2 Convert existing roles, 41.3 Avoid silently broadening clinical access, 41.4 Parallel authorization period, 41. Existing-data migration

### Community 1681 - "45. Implementation checklist"
Cohesion: 0.40
Nodes (5): 45. Implementation checklist, Functions, RLS, Schema, Testing

### Community 1682 - "7. Tenant and identity tables"
Cohesion: 0.40
Nodes (5): 7.1 User profiles, 7.2 Organizations, 7.3 Hospitals, 7.4 Organization contacts, 7. Tenant and identity tables

### Community 1683 - "pre-pilot-hardening-wave2.md"
Cohesion: 0.15
Nodes (13): PersonAvatar(), personInitials(), Chip(), CHIP_VARIANT, DirectoryEmptyState(), emptyCopy(), hospitalCell(), ROLE_LABEL (+5 more)

### Community 1684 - "Manual smoke — meeting audio → generated ata (T5)"
Cohesion: 0.14
Nodes (14): BlockLibraryProvenance, BlockLibraryRow, listBlockLibraryEntries(), SnapshotEntry, toBlockLibraryEntry(), toSummary(), ADR-0092, CompositeTypes (+6 more)

### Community 1686 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.18
Nodes (11): Exit criteria — r2, Gate-figure impact (for the lead's step-5 record), How I verified — execution, not reading, MAJOR-1 / MAJOR-2 / MAJOR-3, ✅ N14a's must-stay-green mechanism **discriminates** — proven both ways, New at r2 (both MINOR, both non-blocking), r1 MINOR / INFO — status at r2, Recommendations (none binding) (+3 more)

### Community 1688 - "2 · Verification of the MOVED / FALSE claims"
Cohesion: 0.12
Nodes (16): A — D8's HEAD definition has a STANDALONE lane it never covers (extension, PO-ruled), ADR 0126 — A print belongs to a SERIES, and currency is DERIVED, Amendment 1 — eleven findings from BUILD, not from review (2026-08-18), B — D12's "anon-reachable DEFINER door" is true at the PRODUCT level and false at the POSTGREST level, C — D9's parenthetical *"(same revision, content identical …)"* is FALSE, Consequences, D — D6's one-line authority description is wrong for MEETINGS, Decisions (+8 more)

### Community 1690 - "Phase CH — Committee Charters & Meeting Cadence — QA Review"
Cohesion: 0.26
Nodes (8): classify(), emit_report(), psql_c(), psql_f(), record(), restore_inflight(), p0-authz-invoker-audit.sh script, want()

### Community 1691 - "Round 2 — verification of the fix wave"
Cohesion: 0.12
Nodes (16): 0. Substrate facts — catalog-verified 2026-08-25, 1. ✅ RESOLVED — the content-drift decision (ADR 0144 D15), 2.1 `backend` — migrations, 2.2 `backend` — pure renderer, `src/lib/pdf/`, 2.3 `backend` — provider + payload, 2.4 `frontend` — the mint surface, 2.5 `tester` — E2E, 2.6 `qa` — review (+8 more)

### Community 1692 - "23. Encryption and Sensitive Data"
Cohesion: 0.50
Nodes (4): 23.1 Column-level encryption candidates, 23.2 Plaintext metadata, 23.3 Key management, 23. Encryption and Sensitive Data

### Community 1693 - "14. Explicit case access"
Cohesion: 0.50
Nodes (4): 14.1 Case access grants, 14.2 Grant permissions, 14.3 Case access restrictions, 14. Explicit case access

### Community 1694 - "26. Auditing"
Cohesion: 0.50
Nodes (4): 26.1 Authorization audit events, 26.2 Append-only behavior, 26.3 Audit actor context, 26. Auditing

### Community 1695 - "36. Status transitions"
Cohesion: 0.50
Nodes (4): 36.1 Organization membership, 36.2 Hospital and committee memberships, 36.3 Role assignments, 36. Status transitions

### Community 1696 - "9. Permission and role catalog"
Cohesion: 0.50
Nodes (4): 9.1 Permission catalog, 9.2 Role definitions, 9.3 Role permissions, 9. Permission and role catalog

### Community 1697 - "ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split"
Cohesion: 0.10
Nodes (24): BulkCaseCustomFieldValue, BulkCaseRow, bulkCreateCases(), normalizeDeadline(), parseFailedRowIndex(), serializePatient(), ADR-0134, VALID_SEX (+16 more)

### Community 1700 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.12
Nodes (16): Archive — QA Verdicts (full verbose form), Collapsed one-line index — concluded features (rotated from PROGRESS.md 2026-08-06), Collapsed one-line index — rotated 2026-08-10 (18 rows: QO·B → Phase 16), ETH·E4 loop rows (rotated from PROGRESS.md 2026-08-11 at the Record step), Rotated 2026-08-23 at the AFF2 Record step — the case-split and DSR milestone rows, ↩ Rotated from PROGRESS.md 2026-08-17 (the §6-step-5 size rotation) — the three DM5 slice verdicts, VERBATIM, ↩ Rotated from PROGRESS.md 2026-08-18 (the §6-step-5 size rotation, DM5 Record) — the DM5 PHASE QA + S6 slice rows, VERBATIM, ↩ Rotated from PROGRESS.md 2026-08-19 — the seven DM rows (the DM milestone is closed), VERBATIM (+8 more)

### Community 1701 - "16. Single-hospital customers"
Cohesion: 0.67
Nodes (3): 16.1 One person may hold all necessary administrative assignments, 16.2 Use role bundles only in the application layer, 16. Single-hospital customers

### Community 1704 - "0085 — Case Correction Lifecycle (phases + narratives)"
Cohesion: 0.20
Nodes (10): 1. Roster panel — `case-participants-panel.tsx` (frontend), 1a. What each row action actually opens (pinned 2026-08-11 — the tester hit this), 2. Add-participant dialog — `add-participant-dialog.tsx` (frontend), 2a. Professional lane, 2b. External lane, 3. Resolve-linkage dialog — `resolve-linkage-dialog.tsx` (frontend), 4. Seeded role labels (already in `seed.sql` — do NOT re-invent), 5. Frozen TypeScript signatures (backend owns; frontend/tester code against these) (+2 more)

### Community 1705 - "7. Recommended changes for the current project"
Cohesion: 0.40
Nodes (5): 7.1 Preserve, 7.2 Change now, 7.3 Change when the next feature requires it, 7.4 Do not do now, 7. Recommended changes for the current project

### Community 1706 - "11. Rollout and rollback strategy"
Cohesion: 0.40
Nodes (5): 11.1 Flags, 11.2 Canonical-write rule, 11.3 Object migration safety, 11.4 Stop/rollback triggers, 11. Rollout and rollback strategy

### Community 1707 - "3. Verified current-state catalog snapshot"
Cohesion: 0.40
Nodes (5): 3.1 Buckets and Storage policy surface, 3.2 Central attachment schema, 3.3 Current local row/object counts, 3.4 Parallel document-bearing surfaces, 3. Verified current-state catalog snapshot

### Community 1708 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.20
Nodes (8): ✅ Bulk case creation — COMPLETE + MERGED 2026-07-23 (ADR 0084), Bulk Case Creation — "Múltiplos casos" (ADR 0084) — task ledger, 1. Requirements — MET, 2. Code quality — GOOD, 3. Security / RLS / PHI — SOUND (catalog-verified), 4. Keystone / over-grant assessment — PASS, Findings, QA Review — Bulk Case Creation ("Múltiplos casos", ADR 0084)

### Community 1709 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.20
Nodes (10): Also rotated 2026-08-11 — FUP-QOB-1 (a separate, earlier closure), `created_by = auth.uid()` in `response_group_instances_write_own_draft` is no longer independently observable; PROVISIONAL structural pin landed (backend 2026-08-09; needs PO ratification), ⬛ FUP-GATE-RESET-FLAKE — RESOLVED 2026-08-11 (the diagnosable half); the restart POLICY stays the PO's call, ⬛ FUP-P16-2 — RESOLVED 2026-08-11: both reads routed through `queries/` (Rule 9), ⬛ FUP-P16-4 — RESOLVED 2026-08-11 — 10 files carried the pluralization pattern that shipped two bugs (latent, safe today), ⬛ FUP-PDF-2 — RESOLVED 2026-08-11: the allowlist is now "ours BY CONSTRUCTION", not "ours today", ⬛ FUP-QO-9 — RESOLVED 2026-08-11: both classifier gaps closed, plus the race itself is now WAITED OUT, ⬛ FUP-QOB-1 — RESOLVED 2026-08-09: the J1c structural pin is RATIFIED as the standing guard (PO) (+2 more)

### Community 1710 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.40
Nodes (5): 11.1 Submit referral transaction, 11.2 Send message transaction, 11.3 Resolve referral transaction, 11.4 Reopen referral transaction, 11. Domain Services and Transaction Boundaries

### Community 1711 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.40
Nodes (5): 17. Suggested Repository and Service Boundaries, Application layer, Domain layer, Infrastructure layer, Presentation layer

### Community 1713 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.12
Nodes (16): 0. Method, 1. C-1 — **CLOSED.** The blocker is discharged, and discharged the right way, 2. Is the new spec vacuous? — **No.** The differential is sound, and AC-R1 pins a property, 3. Accessibility of the non-interactive `mrn` — **it holds**, measured, 4. Fixture isolation — **the template argument holds; the argument has a hole it does not cover**, 5. New findings this round, 6. Follow-up fidelity — five of six are faithful; one softens (N-2), 7. Conditions of this approval (+8 more)

### Community 1715 - "not-found.tsx"
Cohesion: 0.11
Nodes (25): NotFound(), ADR-0106, CommissionNotFound(), ADR-0106, TechnicalDirectionNotFound(), ADR-0106, OrgManageNotFound(), ADR-0106 (+17 more)

### Community 1716 - "PDF·P2 — PDF printing: Meetings (ata) (COMPLETE 2026-08-08)"
Cohesion: 0.18
Nodes (11): 0. Independent reproduction of the gate figures, DM2 — orchestration + Wave A: QA review (r1), INFO, Items I was asked to assess rather than rediscover, MAJOR-1 — S1-O4 is not merely "a product question": a document on a `legal_privileged` interview is readable, and its PHI bytes servable, by members who cannot see the interview at all, MAJOR-2 — reconciliation is blind, by construction, to `failed`/`abandoned` files that DO hold bytes; the sweep can report `RECONCILIATION CLEAN` over undisposable PHI, MAJOR-3 — after a verification failure the upload dialog offers "Tentar novamente", which cannot succeed; each attempt drives an unaudited service-role download of the full object, MINOR (+3 more)

### Community 1717 - "V-0 Â· Corrections to my own v1 â€” visible, not silent"
Cohesion: 0.20
Nodes (10): ⬛ FUP-A11Y-1 — `useFieldIds` derives the DOM id from `useId()`. ✅ DONE 2026-08-05., ⬛ FUP-AUTHZ-2 — 15 BLIND authz gates — **RESOLVED 2026-08-05**, ⬛ FUP-AUTHZ-3 — the 45 row-returning DEFINER doors are swept. ✅ DONE 2026-08-05., ⬛ FUP-AUTHZ-4 — pruned the 6 now-COVERED entries from the BLIND allowlist. ✅ DONE 2026-08-05., ⬛ FUP-BULK-1 — bulk wizard deals to SUSPENDED members — **RESOLVED 2026-08-05**, ⬛ FUP-MEM-1 — `ARM=floor`'s 3 never-called INDICATOR doors — **RESOLVED 2026-08-05, not a defect**, ⬛ FUP-MEM-2 — `assignOrgAdmin` door migration — **RESOLVED 2026-08-05, spec RUN and green (3/3)**, ⬛ FUP-MEM-3 — the DT referral plane's product callers — **COMPLETE 2026-08-05** (+2 more)

### Community 1718 - "carry-forward-panel.tsx"
Cohesion: 0.20
Nodes (10): Findings, INFO-1 — `reason_code` governance signal is real, MINOR-1 — stale comment in the collapsed UI helper (§7.2 #5 shape), MINOR-2 — `m5`/`m6` mutation-audit stale targets (pre-existing A2-era debt), Pre-approved deviations — ruled, QA Review — ADR 0078 Stage B · `case_access → case_access_grants` hard cut (B1→B5), Scope notes, Skeptic battery — the review's core (all under `authenticated`) (+2 more)

### Community 1719 - "use-title-action.ts"
Cohesion: 0.18
Nodes (11): r2·1 — Safety record of my own probing, r2·2 — Discharge table, r2·3 — MAJOR-2 in detail: r1's premise was FALSE, and the correction is TRUE, r2·4 — New at r2, r2·5 — What r2 did **NOT** re-verify, r2·6 — Bottom line for the gate, 🔵 r2-INFO-1 — `312 t51c` is a weaker pin than its label claims, 🔵 r2-INFO-2 — `342`'s plan-arithmetic comment declares **44** for a plan of **59** (+3 more)

### Community 1720 - "14. Handoff checklist"
Cohesion: 0.50
Nodes (4): 14. Handoff checklist, Before cutover, Before implementation, During each phase

### Community 1721 - "2. Method and evidence"
Cohesion: 0.50
Nodes (4): 2.1 Sources inspected, 2.2 Point-in-time live catalog snapshot, 2.3 Verification performed, 2. Method and evidence

### Community 1722 - "1. Audit boundary and method"
Cohesion: 0.50
Nodes (4): 1.1 Environment inspected, 1.2 Authoritative evidence, 1.3 Supabase operational facts that constrain the design, 1. Audit boundary and method

### Community 1723 - "supersede-document-button.tsx"
Cohesion: 0.12
Nodes (11): reassuranceText(), ADR-0056, ADR-0130, WARNING_FRAMED, completeDsrTask, disposeMeetingMinutesTask, executeDisposalTask, refresh (+3 more)

### Community 1724 - "CaseLinker"
Cohesion: 0.18
Nodes (11): 10 · What is unambiguously right, 1 · Is the correction itself correct? — **Yes, on every load-bearing clause**, 2 · MINOR-10 (new) — *"its own HINT"* names the wrong field, in four places, 3 · MINOR-11 (new) — the byte-drift datum is a measurement artifact, not drift, 4 · MINOR-12 (new) — the sweep boundary moved again; the same file still contradicts itself, 5 · MINOR-13 (new) — MINOR-4 is reported closed and is 5 of 6, 6 · MINOR-14 (new) — the restored `143` label names a lock the assertion does not test, 7 · INFO (+3 more)

### Community 1725 - "access-audit-table.tsx"
Cohesion: 0.25
Nodes (8): 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values, Alternatives rejected, Consequences, Context, Decision, Definition-side additions (in this package), Explicitly NOT in scope (and why), The forward-compat contract — what each future feature will use, and what's left

### Community 1726 - "AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18)"
Cohesion: 0.25
Nodes (8): AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18), FIX-A — the 26 ERROR core predicates → ALL COVERED (via runlogs, no new keystones), FIX-B — the standing invariant (`p0-authz-invariant.sh`, ADR 0079), FIX-C — 50 mutation-proven isolation keystones (`supabase/tests/25{0,1,2}_authz_p0_isolation.sql`), Follow-up backlog (invariant-surfaced, not silent), Pre-req fixed (`a32be9c`), Sweep (P0-U0) — 292 neutralization cases, Verification (lead + qa each independent, live — §7.14)

### Community 1727 - "Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)"
Cohesion: 0.25
Nodes (8): ✅ FUP-QO-1 — RESOLVED 2026-08-07 (backend, F1; PO ruling D-FUP-1) — `p_expires_at` seam limits, deferred to Phase C (2026-08-06, backend; consumer: **D14 break-glass**), ✅ FUP-QO-2 — RESOLVED 2026-08-07 (F4+F7: catalog-derived role→landing guard, ADR 0101, `KNOWN_UNROUTED` empty; guard caught + F7 routed instances 4+5) — a non-commission-scoped role lands on "sem acesso": THIRD recurrence (2026-08-06, lead), ✅ FUP-QO-3 — RESOLVED 2026-08-07 (backend, F3, `bac7821`) — two vacuous `a2` mutation cases: the audit's coverage claim is overstated (2026-08-06, backend; lead-ratified file-don't-fix), ✅ FUP-QO-4 — RESOLVED 2026-08-07 (PO ruling D-FUP-4: strip stays global; shipped scope label is the fix; A.9 stands) — KPI-strip scope vs. the chip filter, ✅ FUP-QO-5 — RESOLVED 2026-08-07 (backend, F2) — t19 could MASK a real `anon` EXECUTE leak (2026-08-07), ✅ FUP-QO-7 — RESOLVED 2026-08-07 (PO ruling: **a NULL `p_expires_at` means PERMANENT — INTENDED**; ADR 0103; pinned in `183` §E) — the case-access PHI door NULL-CLEARS expiry on re-grant, UI-reachable, ✅ FUP-QO-8 — RESOLVED 2026-08-07 (backend, F8) — `list_my_nsp_hospitals()` ignored `is_active` and expiry (2026-08-07, backend; lead-scoped), Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)

### Community 1728 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.25
Nodes (8): Follow-up notes, Lead decisions (B1 approval, 2026-07-05), Phase 15 — Quality Indicators (Indicadores de Qualidade), QA MINORs — all fixed pre-merge (2026-07-06), Spec realignment for MINOR-1 (tester-owned), Task ledger, Test gate — fix loop, What shipped

### Community 1729 - "Worktrees — parallel Claude Code sessions on this repo"
Cohesion: 0.25
Nodes (8): 1. When to reach for one, 2. Two ways to create one, 2a. In-session, via Claude Code's built-in tool, 2b. Manually, for a second parallel session, 3. Gotchas specific to this repo, 4. Cleaning up, 5. Isolating a spawned subagent (lead-only, advanced), Worktrees — parallel Claude Code sessions on this repo

### Community 1730 - "document-reconciliation.mjs"
Cohesion: 0.17
Nodes (8): admin, BUCKETS, LEGACY_BUCKETS, ADR-0114, ADR-0120, report, RETAINED_BUCKETS, rows

### Community 1731 - "referral-flow-charts.tsx"
Cohesion: 0.13
Nodes (15): AFF2 — workstream task detail (live), Cross-track — sequencing and shared facts *(lead-owned)*, F1 — the B7 adaptation, and an A2 claim of mine that was WRONG, F1 — what shipped, and what is still inert, F2 — built against B6's posted contract, not yet exercised, F3 — built, and why it must not merge yet, F4 (partial) — `error.tsx`, and the gap it turned out to close, F4 — the sweep, and a reduced-motion defect that was a §8 violation (+7 more)

### Community 1732 - "actions.test.ts"
Cohesion: 0.24
Nodes (10): addWithNewType(), createProcesslessCase(), getCaseNarratives(), getCasePhases(), restGet(), serviceHeaders(), signInAs(), ADR-0032 (+2 more)

### Community 1733 - "0114 — Document model redesign: documents, versions, file objects, securable resources"
Cohesion: 0.13
Nodes (15): 1. Verdict, 2. What "no orphan surface" does and does not mean, 3. Results, 4. The byte provably survived — so no arm is vacuous, 5.1 The proof-of-life contaminated its own subject (a FALSE POSITIVE), 5.2 Cleanup could have ADDED to the population it was measuring, 5.3 One anomaly that could not be explained, 5. Two defects found in the instrument, in flight (+7 more)

### Community 1734 - "4.1 `form_responses.form_submissions`"
Cohesion: 0.29
Nodes (7): 4.1 `form_responses.form_submissions`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 1735 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.13
Nodes (12): Call, calls, makeBuilder(), rows, ADR-0151, ADR-0154, makeAdmin(), resolve() (+4 more)

### Community 1736 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.13
Nodes (15): 1. Acceptance criteria, AC1 — org admin offboards end-to-end, audited, person leaves the default roster but stays reachable behind the filter, AC2 — the C5 differential holds in pgTAP, AC3 — rehire at a same-org hospital is one action by that hospital's admin, AC4 — `/conta` shows the titular their own record, read-only, masked CPF, AC5 — registration writes the start date the user typed, AC6 — all eleven FUPs from ADR 0151's Consequences discharge at Record, Class check — instance or class? (+7 more)

### Community 1737 - "actions.test.ts"
Cohesion: 0.13
Nodes (15): B1 — The prévia route enforces D1 with a WATERMARK check where the discriminator is the LOCK. A locked `in_signature` ata is served a self-disclaiming ephemeral page., B2 — `app.print_source_head`'s `form_response` arm is satisfied by a constant `true`. Neither lane has a not-head assertion anywhere., BLOCKING, C1 — The reserved verb DOES appear on an unregistered surface, on the composed panel, C2 — Stale probe/vector counts in comments — §J's class, polarity flipped, C3 — `find()` in the sync-guard suite is blind to `meeting_disposed`; three lookups are ambiguous, C4 — Two comments that went stale inside this build, C5 — `346` t11 pins the no-join property textually (+7 more)

### Community 1738 - "parse-required.test.ts"
Cohesion: 0.18
Nodes (11): AcreditacaoPage(), metadata, ADR-0093, CloneFrameworkDialogTrigger(), FrameworkList(), ADR-0093, FrameworkStatusChip(), AccreditationFramework (+3 more)

### Community 1739 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.31
Nodes (14): bad(), expect_green(), expect_green_because(), expect_red(), gate(), ok(), scen_a1(), scen_a2() (+6 more)

### Community 1740 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.13
Nodes (14): declared, FLAG_COLUMNS, ADR-0125, ADR-0126, NON_FLAG_KEYS, OUT, q(), raw (+6 more)

### Community 1741 - "ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`"
Cohesion: 0.33
Nodes (6): ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`, Consequences, Context, Decision, The mechanism — measured, because the obvious prior is wrong, Two findings about the authz harness, surfaced by this wave

### Community 1742 - "Step 2 — Configure the Supabase Cloud project (Dashboard)"
Cohesion: 0.14
Nodes (14): 3.1 · The three changes verified, 3.2 · Falsification probes — I built four, all inside the suite's own transaction, 3.3 · The t33-placement argument holds — I checked the conjunction rather than the conclusion, DSR Slice 4 — QA review, round 3, ⚠ N12 — the build's correction of my r2 finding is itself wrong, and its own comment contradicts it two sentences later, ⭐ N13 — t7 asks `memberships`; the door asks `has_role`, which is `memberships` **and the caller's active hat**. Of the three commissions the anchor may legally select, one is refused., ⚠ N14 — the "grantable → granted" fix landed in the right place, but in **one of three** copies, r3 · 1 — Method and rollback (+6 more)

### Community 1743 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.13
Nodes (14): 4 · Reproducibility — ✅ **fully verified**, 5.1 ⛔ **§3.6 contradicts §2's KEEP list — twice**, 5.2 ⛔ **`case_tag_report` cannot take the fix the §1.2 table prescribes — category error**, 5.3 ⚠ `case_events_writer_write` — the inventory's "not a defect" call is **correct**, 5 · Over-reach audit (things wrongly marked for removal), 6 · Is A0 a sufficient foundation to author SQL against?, 7 · Sequencing recommendation, PART I — v1 review (2026-07-15) · ⚠ SUPERSEDED, contains 3 disproved claims (+6 more)

### Community 1744 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.20
Nodes (10): Ad-hoc bug-fix batch (2026-08-03) and the seven bugs it triaged, ✅ BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **FIXED 2026-08-03** (filed 2026-07-27, PO's call), ⚪ BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-07-28), ⚪ BUG-E2EISO-003 — `bulk-case-creation.spec.ts:344` (AC2) is not idempotent across runs on one DB · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-08-03), ✅ BUG-GATE-001 — `scripts/e2e-prod-gate.sh` drops a `reset FAILED` batch from its OWN coverage denominator · owner **lead** · **FIXED 2026-08-03** (filed 2026-08-03, found by the lead during the FF-4 gate), ✅ BUG-P15-001 — `phase15-indicators.spec.ts` AC-4 fails on the 1st-4th of any calendar month — seed-data date arithmetic · owner **tester** · **FIXED 2026-08-03** (filed 2026-08-03), ✅ BUG-P22-001 — the referrals hub does not render a seeded `completed` referral · owner Phase 22 · **CLOSED — NOT REPRODUCIBLE 2026-08-03** (filed 2026-07-27), ✅ BUG-P22-002 — `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note fails · owner **tester** · **FIXED 2026-08-03** (filed 2026-07-27) (+2 more)

### Community 1745 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.22
Nodes (9): A · The manifest tool (`scripts/storage-manifest.mjs`), B · The reconciliation command (`scripts/document-reconciliation.mjs`), C · The disposal job — what exists to schedule, Could not verify, D · Backup/restore drill surface, DM5 · S5 — Step 0 surface verification, E · EXPLAIN/latency baseline targets — document list / open / sign, F · Unnamed surfaces (+1 more)

### Community 1746 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.13
Nodes (15): 1 · Is the retirement-cause rule held everywhere? **Yes — in all six code sites. The ADR is now the one place it is not.**, 2 · Are the re-earned verdicts trustworthy? **Yes, and the reason is structural, not deference.**, Carried forward — open, non-blocking, for the Record step or the next slice, Method — what I actually did this round, New in r2 — three findings, all Minor, r2-B3 · "14 spec files carry private copies, and exactly one other swallows" is materially wrong — I measured it **[V]**, r2-m1 · The battery census stopped summing, inside the paragraph that documents that failure **[V]**, r2-m2 · ADR 0130 Amdt 3 item 7 still instructs the behaviour the fix removed **[V]** (+7 more)

### Community 1747 - "ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles"
Cohesion: 0.17
Nodes (10): getToken(), insertItem(), openAddBlock(), OptionSpec, rpc(), signInAs(), slug(), startFillResponse() (+2 more)

### Community 1748 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.22
Nodes (9): Context, Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 — Implementation Plan, Risks / open items, Verification summary, Wave 0 — Lead + contract (before any feature code), Wave 1 — Backend: schema + belongs/freshness (Migrations A–B, pgTAP 278–279), Wave 2 — Backend RPCs/doors/seed ∥ Frontend scaffolding, Wave 3 — Frontend wiring + hospital surface ∥ Tester (+1 more)

### Community 1749 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.16
Nodes (12): formatDateOnly(), metadata, MeusDadosPage(), ADR-0133, ADR-0151, AffiliationStatusBadge(), LABEL, TONE (+4 more)

### Community 1750 - "ADR 0109 — Referral "Registros internos" + the case-access summary door"
Cohesion: 0.02
Nodes (68): ═══════════════════════════════════════════════════════════════════════════, ACT — "act as" strict role assumption (ADR 0106), 🟡 ACT — "act as" strict role assumption (ADR [0106](../decisions/0106-act-as-role-assumption.md)) · **S3 QA round 1: CHANGES REQUESTED → blocker FIXED; re-review pending**, Bug Log — CLOSED rows (rotated), Merge, push & the two deploy debts, Merged + pushed, ⚠ Process note — a teammate pushed to `origin/main` twice mid-stage, S4 — D14 arm audit + record — ✅ COMPLETE (+60 more)

### Community 1751 - "0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns"
Cohesion: 0.22
Nodes (9): 1. Method, 2. What reproduced exactly (the positive census), 3. Findings (r1) — and the fix each received, 4. QA-added coverage — the declared hole, closed at the right layer, 5. Carried forward to gate step 4 (PO) — none of these are S6 defects, 6. r2 — verification of the fixes, DM5·S6 — QA review (canon rewrite + program exit sweep), Scope of this verdict — written down so it cannot be inferred wrong (+1 more)

### Community 1752 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.14
Nodes (14): 1 · B1's fix — verified, both halves, by construction rather than by table, 2 · The new keystones can fail — five mutations, measured, 372 §6.4 is **strictly stronger**, not merely narrower — the concern was well placed and it holds, 3 · The no-backfill reasoning — `backend` is right, and ADR 0150 already says so, 4 · Round-1 findings — disposition, 5 · New in round 2 — MINOR, 6 · Gates I ran, and the one I did not, Addressed (+6 more)

### Community 1753 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.15
Nodes (13): ADR 0136 — Deferred `staff_admin` sign-off: attest a FROZEN response, block the PHASE not the SUBMIT, Amendment 1 — what the build found (2026-08-24), Consequences, Context, D7 — the decline path: SETTLED (PO ruling 2026-08-23), Decision, Gate record, Re-derivation of the whole table — 2026-08-23, two independent measurements (+5 more)

### Community 1754 - "referrals.test.ts"
Cohesion: 0.15
Nodes (6): AiAvatar(), AID_ICONS, AID_PRIO, AID_STATUS, AID_UPD, AID_UPD_ICON

### Community 1756 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.15
Nodes (14): formatIsoDatePtBr(), ADR-0133, ADR-0151, AccountHistoryCard(), DOT_TONE, formatTimestamp(), AccountSituationBanner(), formatSuspensionDate() (+6 more)

### Community 1757 - "ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only"
Cohesion: 0.15
Nodes (6): AiAvatar(), AID_ICONS, AID_PRIO, AID_STATUS, AID_UPD, AID_UPD_ICON

### Community 1758 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.15
Nodes (13): ADR 0134 Amendment 4 — rotated 2026-08-22, ADR 0134 Amendment 6 — rotated 2026-08-22, BUG-ADM-APPOINT-CAPS-NOT-SYNCED — filed 2026-08-22 by the tester, Case surface split — Increment 2 (ADR 0134), Gate caveats — what the Test Run Summary's ⚠ points at, `orphan-administrativo-reachability.spec.ts` — executed standalone (QA r2 condition **C-2**), Pre-work measurement — rotated 2026-08-22, Push record (restored 2026-08-23) (+5 more)

### Community 1759 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.25
Nodes (8): ADR 0016 — SECURITY DEFINER read path for staff_admin sign-off, Consequences, Context, Decision, Known v1 limitation: no answer-lock between sign-off and submission, Queue predicate: also require submit-readiness, RLS policy fix surfaced this phase (signoffs_insert / signoffs_select), The write path stays under RLS

### Community 1760 - "ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal"
Cohesion: 0.25
Nodes (8): Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07, Gate bugs found + fixed (all tester-verified), Migrations (6, pushed to remote 2026-07-07), Notes / follow-ups, Test gate result, Test reconciliation (test-side only; app was sound), The 10 tasks (all delivered), Time-field: masked → segmented (human decision 2026-07-07)

### Community 1761 - "ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org"
Cohesion: 0.25
Nodes (7): BUG-AIF-001 — Linux repro CONFIRMED; root-cause handoff, Prime suspect + next steps, Reproducible harness (rebuild in ~10 min), Residual confound to close FIRST in the new session, Ruled out (prior session + this one — each by experiment), Temp artifacts from this session, The decisive experiment (what settled it)

### Community 1762 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.15
Nodes (13): 7.10 New coverage — judged, including the vacuity question, 7.11 Could not verify (r2), 7.12 r2 verdict, 7.1 Method (r2), 7.2 F-1 — fixed, both halves, and the harder half holds, 7.3 F-3, F-4, F-5, F-8 — fixed, 7.4 🔴 R-1 (BLOCKING) — `npm run lint` is RED at HEAD; §6 step 1 is not satisfied, 7.5 🔴 R-2 (BLOCKING) — an under-grant regression: custom-field editing for a `create_cases` administrativo now exists on no surface (+5 more)

### Community 1763 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.12
Nodes (17): (a) Reachability — locked states vs states the corridor reverses, (b) Gate relation — reopen vs the lane's erasure door, Bodies moved here 2026-08-14 (the PROGRESS.md size rotation) — items whose ONLY record was the live line, (c) ⛔ The erasure fallback is BROKEN on two lanes — found only by EXECUTION, 🟡 FUP-329-ABORT-SHAPE — a `329` keystone whose failure ABORTS the file, dropping 41 assertions (owner: backend), 🟡 FUP-ACT-CAPA-ASSIGN — NSP operators see ~only themselves in the CAPA assignee picker (owner: backend), 🔵 FUP-ADR0121-REASON-VALUE-DRIFT — the `superseded`-vs-`retention_expired` question ADR 0121 Amdt 2 deliberately left open has been silently pre-answered by the D11 register entry (owner: lead), 🟠 FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED — ✅ **ALL SEVEN LANES MEASURED 2026-08-20.** One lane is fully covered, six have a permanently-frozen state, and the meeting gate bound generalises to only two of six — while the *erasure* fallback turns out to be BROKEN on two lanes (owner: backend + PO; filed 2026-08-20 when the PO asked whether minutes-adjustment mechanisms already existed) (+9 more)

### Community 1764 - "5.2 `referral_context_versions`"
Cohesion: 0.15
Nodes (12): 1. The property, and how it was bounded, 2. Verdict summary, 3. CONFIRMED-reachable (14) — every one EXECUTED, not reasoned, 3a. The child-lock defect — 10 statements, 4 guards (FIXED by `20261003000000`), 3b. Legal hold — 4 rows, BY DESIGN (no fix owed), 4. STRUCTURALLY-UNREACHABLE (9) — named by the mask bit that proves it, 5. NON-BLOCKING (28), 5a. The door already sets the GUC the guard reads (13 + 3 cascade = 16) (+4 more)

### Community 1765 - "32. Implementation Phases"
Cohesion: 0.21
Nodes (12): approvalProgress(), deriveStatus(), DocumentsPage(), matchesView(), metadata, DocumentKpis, DocumentKpiStrip(), KpiCard (+4 more)

### Community 1766 - "Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items)"
Cohesion: 0.50
Nodes (4): Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items), 🔴 FUP-P16-1 — **14** never-called doors fail the ADR 0079 floor (pre-existing, NOT Phase 16), ✅ FUP-P16-1 — 14 never-called doors fail the ADR 0079 floor — **RESOLVED 2026-08-04**, ✅ FUP-P16-3 — `app.copy_version_children` temp-table concern: **INVESTIGATED, NOT A BUG**

### Community 1767 - "Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)"
Cohesion: 0.50
Nodes (4): 🟠 FUP-DM1-CEILING — **RULED 2026-08-13**; now a **DM2 Wave A PREREQUISITE**, no longer a blocker (owner: backend @ DM2; filed by backend, upgraded by lead 2026-08-12, ruled by PO 2026-08-13), 🟢 FUP-DM1-DISPOSE — ✅ DISCHARGED 2026-08-13 (DM2·S2) — `dispose_case_phi` lost its attachment-redaction step in DM1; DM2 wired case PHI erasure to document disposition, verified present in the live `pg_proc.prosrc` (owner: backend, DM2), 🟢 FUP-DM1-E2E — ✅ DISCHARGED 2026-08-13 (DM2·S4) — six (+1 found) attachment-touching E2E specs were PARKED by the DM1 substrate drop; DM2 rewrote them against the document model, never merely deleted them (owner: tester [park — ✅ done 2026-08-12] + frontend/backend [DM2 rewrite — ✅ done 2026-08-13]), Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)

### Community 1768 - "Pre-Pilot DB Hardening — Wave 1 (archived task detail)"
Cohesion: 0.25
Nodes (8): M-1 (mandatory, pre-commit, test-only, no re-review), R-1 · The harness, re-run by someone who didn't write it — ✅ **16/16 reproduces, and RED means RED**, R-2 · B1 — ✅ **the fix is REAL, not relocated**, R-3 · B2 — ✅ **CONFIRMED DEAD, both directions**, on my own seed probe, R-4 · ⛔ **Is 16 the population, or a floor?** — **A FLOOR. The answer is 17.**, R-5 · The A22 re-shape — ✅ **no over-reach; the shape is GENUINELY REACHABLE**, R-6 · The gate — ✅ **independently confirmed**, RE-VERDICT: ✅ **APPROVED** — with **one mandatory pre-commit item (M-1), test-only**

### Community 1769 - "21. Recommended Dashboard Views"
Cohesion: 0.26
Nodes (11): ADR-0051, assignMemberTitle(), createMemberTitle(), deleteMemberTitle(), MESSAGES, renameMemberTitle(), reorderMemberTitles(), revalidateManage() (+3 more)

### Community 1770 - "Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)"
Cohesion: 0.67
Nodes (3): ⬛ FUP-F2-BUCKETS — RESOLVED 2026-08-12: `meeting-attachments` retired; the other two buckets deliberately untouched (backend), ⬛ FUP-PDF-3 — RESOLVED 2026-08-12: mint/revoke doors narrowed to the granted-column composite (backend), Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)

### Community 1771 - "run-chart-loader.tsx"
Cohesion: 0.16
Nodes (15): IndicatorDetailPage(), loadMeasurementHalf(), metadata, ADR-0100, isPqsOperatorOfIndicatorHospital(), ADR-0057, RunChart, RunChartLoader() (+7 more)

### Community 1772 - "loading.tsx"
Cohesion: 0.25
Nodes (8): INFO (no action required), MINOR, MINOR-1 — `getMeetingAttachmentDownloadUrl` is dead, tier-unaware, and contradicts the door model, MINOR-2 — the deliberate interview-arm case-scoping is asserted by no test in the regime where it bites, MINOR-3 — pgTAP K2 exercises only the `committee` action-item scope, Phase F2 — Centralized Attachments (ADR 0063) — QA Review, Verdict rationale, What I verified (held up)

### Community 1773 - "loading.tsx"
Cohesion: 0.14
Nodes (9): addReferralSharedItem, createReferralDraft, draftDetail, removeReferralSharedItem, sendReferral, setReferralPatient, storedPatient, ADR-0137 (+1 more)

### Community 1774 - "loading.tsx"
Cohesion: 0.14
Nodes (13): Area findings, D10 — `updated_at` triggers  🟢 — SOUND, D11 — status-key anglicization (G1–G6)  🔴 scope — SOUND, D3 — result-engine junctions  🔴 (the crux) — SOUND, D8 — forward-FK lock  🟢 — SOUND, F-cleanup — QA Review (D3 · D10 · D8 · D11), Findings (ranked), Recommendation (+5 more)

### Community 1775 - "loading.tsx"
Cohesion: 0.15
Nodes (13): B1 — CLOSED. The refusal is in the door, and it is the right door., B2 — CLOSED. Four assertions, and all five stub shapes red., Gate state at r2, Is there a FOURTH instance? — the question asked, O1 — HC0DV assumes the mint is reachable whenever `registers` is true. Its preconditions are a strict subset of the mint's., O2 — the refusal fires AFTER the render, so a locked source burns a Gotenberg permit per request, O3 — C5 is still open, and the new refusal now flows through it, O4 — a residual stale number in the paragraph that was just de-staled (+5 more)

### Community 1776 - "loading.tsx"
Cohesion: 0.14
Nodes (10): addReferralSharedItem, createReferralDraft, draftDetail, eventPrefill, refresh, removeReferralSharedItem, sendReferral, setReferralPatient (+2 more)

### Community 1777 - "loading.tsx"
Cohesion: 0.17
Nodes (12): ⭐ An invariant, and the mechanism that is actually holding it up, `app.can_read_full_case_content(p_case_id, p_uid)` — the seven-axis mask predicate, App layer (the pure-renderer purity gate still holds), Authz-sweep coverage of this surface — state it before quoting a green ARM, `dispose_case_phi` — blocks (f) and (f2), and the conjunct that made C-1 load-bearing, PDF·P3 — the case DOSSIER: terminality lock, a per-case revision counter, and the identified / de-identified fork (2026-08-25; ADR **0144** + **Amendments 1–6** + ADR **0145**; migrations `20261003002200`–`…002800`, **7**; pgTAP **`368` `plan(58)`** new + `344` `plan(110)` · `313` `plan(59)` · `229` `plan(85)` · `356` `plan(78)` updated; **NO new flag** — rides `document_printing`, and per ADR 0104 D15 / 0144 D12 **provider registration IS the activation**), `public.case_print_revisions` — the counter is a SIDE TABLE, and that is forced, SQLSTATEs (all pre-existing; P3 adds none) (+4 more)

### Community 1778 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 1. Security / RLS crux (the ADR-0078/0079 way — row-visibility, not "revert the predicate"), 2. Requirements — ADR 0080 D1–D11 + §9, 3. PHI / Rule 12 — CH holds no patient data, 4. Code quality & notifications, 5. INFO (non-blocking, no action required to pass the gate), Phase CH — Committee Charters & Meeting Cadence — QA Review

### Community 1779 - "loading.tsx"
Cohesion: 0.17
Nodes (12): A2.1 — Proposed decision (if the PO accepts D), A2.2 — Mechanism (binding if D is accepted — here the mechanism *is* the decision), A2.3 — What D does **not** grant (each verifiable from the catalog), A2.4 — Residual risks, accepted explicitly rather than discovered later, A2.5 — Obligations (each blocks the migration that ships it), A2.6 — Records that must change in the same commit (if D is accepted), A2.7 — Approval scope (an approval's scope is a fact that must be written down), Amendment 2 — 2026-08-21 (**✅ ACCEPTED — PO ruled option D**; authored as PROPOSED, see the status block): creation-scoped PHI entry for `administrativo`, and the resolution of OPEN-4 (+4 more)

### Community 1780 - "loading.tsx"
Cohesion: 0.17
Nodes (12): ADR 0137 — MRN as the LGPD erasure key; the case/referral usability batch, Amendment 1 — post-send referral PHI amendment is not a product capability (PO ruling, 2026-08-24), Amendment 2 — the Consequences' deploy-order rationale is FALSE as written (measured 2026-08-24), Amendment 3 — D9's `CaseDepartmentField` is deleted (PO ruling, 2026-08-24), Amendment 4 — the MRN floor is a PROCESS-TEMPLATE feature; processless cases are out of scope (PO ruling, 2026-08-24), Consequences, Context, Decisions (+4 more)

### Community 1781 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 0 · Why this document exists, 1 · Scope — what these doors erase, and what they do not, 2 · Preconditions, 3 · The procedure, 4 · When a door refuses, 5 · ⛔ The failure class this document was written after, 6 · Records to keep per run, PHI column-disposal procedure — the four erasure doors (+4 more)

### Community 1782 - "loading.tsx"
Cohesion: 0.15
Nodes (13): § Now — concluded bullets, rotated 2026-08-21, Rotated 2026-08-23 at the AFF2 Record step — the § Now build-start bullet, Rotated 2026-08-24 at the ADR 0137 Record step — four concluded § Now bullets, ↩ Rotated from PROGRESS.md § Now 2026-08-23 — size discipline (79,876 B of an 80,000 B cap), Second rotation — 2026-08-22, at the case-surface-split Increment-2 build start, The AFF2 bullet, The C1a correction (2026-08-19), rotated from inside the "▶ Next, in order" item, The case-surface-split bullet (+5 more)

### Community 1783 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 1 · Method, 2 · The claim under attack — leg by leg, 3 · Blocking items, 4 · Non-blocking findings, 5 · Code review — `src/components/referrals/referral-dispose-dialog.tsx`, 6 · Could not verify — a work item, not coverage, 7 · Summary, DSR Slice 4 — QA review (+4 more)

### Community 1784 - "loading.tsx"
Cohesion: 0.15
Nodes (13): B1 · AUD1's fix does not reach one live writer, and ADR 0149's superset Consequence is false — *measured*, B2 · Three documents claim `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` is closed; two record that closure as **proposed and rejected** — *read*, B3 · `docs/backend-state.md` does not document ADR 0149 / migration `20261003003000` at all — *measured*, BLOCKING, Frontend — clean on the things that usually are not, MINOR — worth fixing, not blocking, Notes on things I was asked to disagree with if I could, QA review — `feat/user-profile-redesign` (person-profile redesign · AFF3 · AUD1) (+5 more)

### Community 1785 - "loading.tsx"
Cohesion: 0.19
Nodes (9): affiliationRow(), openAffiliationDialog(), readMatricula(), setMatricula(), signInAs(), ADR-0097, ADR-0098, ADR-0106 (+1 more)

### Community 1786 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 2026-08-19 — BACKUP HALF ONLY (§ 6b), local stack, first execution, Controls run, and what each proves, F1 · ⛔ The mandatory sync check green-lit a world-readable destination, F2 · The documented `7z` command cannot be run non-interactively at all, F3 · `-pass file:` needs a Windows-form path — an MSYS path yields a 0-byte archive, `tar` exit 0, F4 · `set -o pipefail` is required — "don't suppress stderr" is necessary but NOT sufficient, F5 · 🔴 The procedure has NO Cloud form, and Cloud has no Storage backup at all, F6 · 🟠 The DB half's own artifacts are ungoverned (+3 more)

### Community 1787 - "loading.tsx"
Cohesion: 0.33
Nodes (6): Archived 2026-08-14 (DM5 resume audit) — the five DM4+DM5 bug records, 🟠 BUG-DM4-DUP-1 — the reply-attachment list renders the just-uploaded file TWICE (owner: `frontend`), 🟢 BUG-DM5-CAPA-1 — ✅ **FIXED 2026-08-14** (`e938f36d`, DM5 S2 `…000140`) — CAPA evidence UPLOAD was broken for every user since it shipped (owner: `backend`), 🟢 BUG-DM5-S2-CITATION-TARGETS-1 — ✅ **FIXED 2026-08-14** (`e307a979`) — the RCA citation picker never offered a DOCUMENT target — `listRcaCitationTargets` was never updated when the seam was un-parked (owner: `backend`), 🟢 BUG-DM5-S2-STUB-1 — ✅ **FIXED 2026-08-14** (`cbcabe7a`) — the RCA and CAPA NSP workspace pages 500'd for EVERY user — the S2 query/action TS layer was never wired to the RPCs (owner: `backend`), 🟢 BUG-DM5-S2-WRITE-ARM-1 — ✅ **FIXED 2026-08-14** (`fc7a146d`, migration `20260927000160_dm5_s2_write_arm_nsp.sql`) — `app.can_write_document` had NO `rca`/`capa_action` case — the write corridor P0002'd for EVERY user, independent of BUG-DM5-S2-STUB-1 (owner: `backend`)

### Community 1788 - "loading.tsx"
Cohesion: 0.33
Nodes (6): ✅ BUG-E2E-001 — `mem-memberships-collapse` AC-1 deleted a SEED membership in its own cleanup, poisoning every later batch of the gate · severity **MAJOR (test-suite)** · **CLOSED 2026-07-28** (found + fixed + re-verified by `tester`), ✅ BUG-FF1-008 — CLOSED by FF-3 (ADR 0090 Amendment 3), 🟡 BUG-FF1-008 — `form-builder-enhancements.spec.ts:768` AC-4 pins behaviour FF-1 deliberately removed · owner `tester` · **OPEN** (filed 2026-07-27), ✅ BUG-FF3-001 — after a blocked navigation, the untouched peer repetition kept a stale `unique_within_group` message and `aria-invalid` · severity **MINOR** · **CLOSED 2026-07-28** (fixed `8d53b3d`, re-verified by `tester`), ✅ BUG-FF3-002 — the two unary operators were OFFERED by every condition picker but could not be SAVED · severity **MAJOR / phase-blocking** · **CLOSED 2026-07-28** (fixed `91f4931`, re-verified by `tester`), FF-3-era closed bugs (rotated from PROGRESS.md 2026-07-28 at the FF-3 Record)

### Community 1789 - "loading.tsx"
Cohesion: 0.22
Nodes (12): ProfessionalLinkState, ParticipantType, CaseParticipantRoleAdminRow, CaseParticipantRoleOption, likePattern(), ParticipantSearchResult, searchParticipants(), ADR-0051 (+4 more)

### Community 1790 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 0 · Measured inputs (2026-08-19 — RE-MEASURE, never quote), 1 · The sixteen ratified decisions (index), 2 · Slices, 3 · Explicitly out of scope, 4 · Risks & watch-items for the implementing session, DSR ("Direitos do Titular") — implementation plan, Slice 1 — the child-lock fix (ADR 0129). Standalone; FIRST; small. ✅ SHIPPED 2026-08-19., Slice 2 — minimal execution corridor. ✅ SHIPPED 2026-08-20. Discharges pilot-gate item 0. (+3 more)

### Community 1791 - "loading.tsx"
Cohesion: 0.17
Nodes (12): ADRs, AFF4 — organization affiliation, per-hospital staff data, the voided tense, Durable facts promoted out of this build, Gate record, Migrations and pgTAP, ⛔ Residue this Record step did NOT file, The 2026-08-26 `e2e:prod` gate — the row PROGRESS.md points here for, The doors, the trigger, the tense pair (+4 more)

### Community 1792 - "loading.tsx"
Cohesion: 0.18
Nodes (11): Case surface split — the assertion-integrity group (2026-08-22), Coverage facts, not defects, Four corrections to the findings themselves, Gate figures (lead-run, fresh `supabase db reset`), The E2E / TS half, The 🔴 — `FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`, The pgTAP half, What changed (+3 more)

### Community 1793 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 1 · The instrument, and the four times it was wrong, 2 · Calibration — the count is NOT a defect count, 3 · Findings, 4 · Consequence for shipped copy, 5 · What this does NOT prove, 6 · Reproducing, Control battery — 6 anchors, all passing, `dispose_case_phi` — 93 candidates; 17 of the raw set are the referral door's (+3 more)

### Community 1794 - "loading.tsx"
Cohesion: 0.45
Nodes (10): bad(), chk(), gate(), has(), hasnt(), ok(), scenario_death(), setup() (+2 more)

### Community 1795 - "loading.tsx"
Cohesion: 0.21
Nodes (13): FrameworkLayout(), metadata, StandardDetailPage(), FrameworkOverviewPage(), ADR-0093, StandardPanel(), StandardsTree(), getReadinessEvidence() (+5 more)

### Community 1796 - "loading.tsx"
Cohesion: 0.17
Nodes (12): m10 · The reviewer's full name is stated to be delivered to the data subject **[V]**, m11 · The unroutable-row refusal is the one cross-hospital signal in the intake door **[V]**, m1 · `TierSum`'s unreachability canary is at the wrong grain, and the arm is not actually unconstructible **[V]**, m2 · Two rewritten doors carry INHERITED neutralization verdicts **[V]**, m3 · The battery covers bodies, not ACLs — and there is no standing pin for the new doors' grants **[V]**, m4 · PROGRESS.md contradicts itself about whether Slice 3 exists **[V]**, m5 · The uncaptured unit-test failure is not in the record at all **[V]**, m6 · `listMyDsrTasks`'s ordering docblock is false **[V]** (+4 more)

### Community 1797 - "loading.tsx"
Cohesion: 0.18
Nodes (8): JSON_PATH, PrintSourceVector, ROOT, SQL_PATH, ADR-0125, ADR-0126, ADR-0144, vectors

### Community 1798 - "loading.tsx"
Cohesion: 0.20
Nodes (10): 0061 — "Administrativo" delegated-capability role (per commission), Alternatives rejected, Amendment 1 — a fifth capability, `read_cases`, and a management surface, Consequences, Context, Decision, Everything in this record has now LANDED locally — and that is not completion, ⛔ The PHI note is now HALF TRUE — corrected 2026-08-22, in the commit that made it so (+2 more)

### Community 1799 - "loading.tsx"
Cohesion: 0.20
Nodes (10): ADR 0133 — AFF2: affiliation-scoped administration, mandatory-CPF registration & the user-management redesign, Alternatives rejected, Consequences, Context, Decisions, Display & the credential read, New person columns (amends 0048 D10), Registration (+2 more)

### Community 1800 - "loading.tsx"
Cohesion: 0.20
Nodes (10): A3.1 — What is false about D1's letter, measured, A3.2 — The proposed replacement wording, A3.3 — Why the second clause is a strengthening, not a loophole, A3.4 — "Among the viewers who can open the page" — the clause Increment 2 forces, A3.5 — Conditions carried into the wording, A3.6 — What this does not change, A3.7 — Obligations if accepted (each in the same delivery, not after), A3.8 — Approval scope (an approval's scope is a fact that must be written down) (+2 more)

### Community 1801 - "loading.tsx"
Cohesion: 0.20
Nodes (10): Carried forward, for the Record step, ⚠ Correction 1 — *"the change is strictly stricter"* is **false**, ⚠ Correction 2 — the `seed.sql:350` citation is at the wrong grain, and the real warrant is stronger, Gate, re-measured by me at HEAD (not accepted), Non-blocking items from r1, R1 — ✅ discharged in code, R2 — ✅ discharged by ruling (Amendment 4 r2), Round 2 — 2026-08-23, at `02cc5817` (+2 more)

### Community 1802 - "loading.tsx"
Cohesion: 0.20
Nodes (10): 8.1 R-1 — closed, and closed the way I conditioned, 8.2 R-2 — closed, and the fix mirrors the door rather than approximating it, 8.3 Ruling — the fixture limitation is an **acceptable open item**, not a blocker, 8.4 A-1 (non-blocking, recommend fixing now) — `canEditCustomFields` is missing the both-ends backstop its siblings have, 8.5 R-3, R-4, R-5, R-7 — verified, 8.6 Ruling — the infra re-run audit **is sufficient**, and the flaky count is a floor, 8.7 Records — two things to fix in the Record edit, 8.8 Could not verify (r3) (+2 more)

### Community 1803 - "loading.tsx"
Cohesion: 0.20
Nodes (3): disposeMeetingMinutesTask, refresh, ADR-0130

### Community 1804 - "loading.tsx"
Cohesion: 0.50
Nodes (4): BUG-ACT-ACL-1 — RESOLVED (migration `20260918003100`, keystone `320`), BUG-ACT-EXPIRY-1 · BUG-ACT-ACL-1 · BUG-VACUOUS-ASSERT-1 — RESOLVED 2026-08-10, BUG-ACT-EXPIRY-1 — RESOLVED (migration `20260918003000`, keystones `318` + `320`), BUG-VACUOUS-ASSERT-1 — RESOLVED for its 4 confirmed instances (`e2e/phase22-referrals.spec.ts`)

### Community 1805 - "loading.tsx"
Cohesion: 0.17
Nodes (6): createMeeting, MEMBERS, seedExpectedAttendees, seedSelectedAttendees, TYPES, updateMeeting

### Community 1806 - "loading.tsx"
Cohesion: 0.05
Nodes (56): LiveBanner(), BlockerAction, blockerKey(), blockerLabel(), blockerNoun(), blockerScope(), blockersIntro(), isEmploymentTie() (+48 more)

### Community 1807 - "loading.tsx"
Cohesion: 0.20
Nodes (10): build(), buildPayload(), CTX, PATIENT, patientsAnswer, PREVIA_CTX, timelineAnswer, ADR-0125 (+2 more)

### Community 1808 - "loading.tsx"
Cohesion: 0.20
Nodes (10): Anti-patterns, Every claim carries a witness, Location and lifetime, RESUME mode, Session Handoff, Sweeping stale handoffs, Template, ⛔ The load-bearing rule: a handoff may not be cited (+2 more)

### Community 1809 - "loading.tsx"
Cohesion: 0.20
Nodes (10): 1. The four proposals under review, 2. Ground truth (catalog-verified 2026-08-25), 3. Proposal 2 — per-hospital staff data: extend `hospital_affiliations`, don't add a table, 4. Proposal 3 — `organization_affiliations`: yes, and here is the shape, 5. The voided tense — close C5 here, and don't mint its twin, 6. Proposal 4 — `professional_credentials` / `professional_profiles`, 7. Alternatives considered and rejected, 8. Build obligations (when approved — so known failure classes aren't repeated) (+2 more)

### Community 1810 - "loading.tsx"
Cohesion: 0.67
Nodes (3): 🟢 BUG-FF5-001 — the builder cannot author a `reference` item: `addItem` rejects it with "Tipo de item inválido." · owner **backend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cc4194a`, re-verified 2026-07-28), 🟢 BUG-FF5-002 — the submissions dashboard shows "Sem resposta" for every top-level reference answer, even though the DB and the exact same query both hold/return the correct data · owner **frontend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cf6a949`, re-verified 2026-07-28), FF-5 (Entity Reference, ADR 0091) — closed bugs, rotated 2026-07-28

### Community 1811 - "loading.tsx"
Cohesion: 0.67
Nodes (3): ✅ BUG-MIN-E2E-1 — RESOLVED 2026-08-12: **it was never a product defect**, ✅ BUG-RDR-001 — RESOLVED 2026-08-12: fixed at the shared layer, both dialog primitives, Rotated 2026-08-12 — the FUP batch (both CLOSED)

### Community 1812 - "loading.tsx"
Cohesion: 0.67
Nodes (3): Closed → [bug-log-archive.md](./bug-log-archive.md), Closed this phase → [bug-log-archive.md](./bug-log-archive.md) (rotated 2026-08-14), Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live Bug Log's two CLOSED blocks

### Community 1814 - "ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered)"
Cohesion: 0.22
Nodes (9): A — D7's "HC069 becomes structurally unreachable" was false FOR THE REASON GIVEN, ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered), Amendment 1 — two rationales were FALSE as measured; the model moves to ADR 0126 (2026-08-18), Amendment 2 — the `form_response` watermark moves IN TANDEM with the refined lock (2026-08-18), B — the meetings "lock set ⊇ registering set" argument was false, and an unnamed FK is what holds, C — the two residual paths this ADR carried as "not verified, not claimed", Consequences, D — the shape, recorded because it is the class and not the instance (+1 more)

### Community 1815 - "ADR 0129 — A narrow disposal flag through the meeting child lock"
Cohesion: 0.22
Nodes (9): ADR 0129 — A narrow disposal flag through the meeting child lock, Amendment 1 — `app.in_disposal_rpc` now has TWO readers (still one setter), Amendment 2 — the class this ADR closed was closed for ONE lane; three siblings still have it, Amendment 3 — the three siblings are FIXED, and the population was TEN across FOUR guards, Build record (2026-08-19) — what the obligations actually returned, Consequences, Context, Decision (+1 more)

### Community 1816 - "VERDICT (r3): **APPROVED**"
Cohesion: 0.22
Nodes (9): Falsifiability — the new assertion was PROVEN able to fail, Left open deliberately — filed, not closed, Other gates, re-run at r3, P0-1 — re-verified from the catalog, independently of r2, ⚠ r2's MAJOR-1 was WRONG, and the prescribed fix would have been a regression, The other three findings, The r2 blockers — verified independently, The unproven set — cleared (+1 more)

### Community 1817 - "case-event-form.test.tsx"
Cohesion: 0.22
Nodes (4): CaseEventForm(), createCaseEvent, ADR-0137, updateCaseEvent

### Community 1818 - "reserved-sessions-panel.tsx"
Cohesion: 0.19
Nodes (13): ConfirmDeleteButton(), ConfirmActionButton(), ArchiveTypeButton(), formatCaseNumber(), ReaderOption, ReservedItemForm(), formatTime(), itemWindow() (+5 more)

### Community 1819 - "credentials-editor.tsx"
Cohesion: 0.24
Nodes (6): callRPC(), createRealizadaMeeting(), firstMeetingTypeId(), pickAnyDate(), signInAs(), ADR-0137

### Community 1820 - "Language"
Cohesion: 0.25
Nodes (7): Forms and responses, Governance and accreditation, Hospital Commission Forms Platform, Language, Patient data, Roles, Tenancy and identity

### Community 1822 - "ADR 0137 batch — MRN as erasure key; case/referral usability (D1–D14)"
Cohesion: 0.03
Nodes (65): Measure, every time. Never re-read a recorded figure., Some facts may only be MEASURED here, never quoted, 0085 — Case Correction Lifecycle (phases + narratives), Consequences, Context, Decision (10 points, each PO-locked), Explicitly out of scope v1 (extension paths verified open), 0146 — The E2E gate harness must not report green while blind (+57 more)

### Community 1823 - "⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**"
Cohesion: 0.25
Nodes (8): Bodies rotated from follow-ups.md 2026-08-24 (batch: gate-tooling round) — all three RESOLVED, ⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**, 🟡 FUP-0137-PHI-MODE-SHIMS — the derived `patientEnabled` / `collectsPatient` / `setTemplateCollectsPatient` shims must retire once the builder UI adopts `patientMode` (owner: backend + frontend), 🟠 FUP-42501-CONFLATES-GRANT-WITH-RLS — 2 of 12 P0-isolation assertions pass on a **table-grant** error, not on the RLS refusal they claim to prove (owner: backend + tester; **a COVERAGE defect, NOT a vulnerability — the tables are protected**), FUP-AUTHZ-CENSUS-PRUNE-NOTE-IS-WRONG, ⬛ FUP-AUTHZ-GATE-SUITE-DID-NOT-RUN-ON-MACOS — ✅ **FOUND AND RESOLVED 2026-08-24, same change** (owner: lead/backend; found by RUNNING `ARM=census`, not by reading it), 🟠 FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS — a pgTAP premise 136 files can state falsely (owner: backend/tester; filed 2026-08-22, found inside the ADR 0134 S8 suite; ⭕ **PARTIAL 2026-08-22** — root verb `test_helpers.reset_role_and_claims()` + red-first gate landed and adopted in `356`/`357`; ⛔ **step 1 (derive the real population) and the 134-file sweep remain OPEN**. Capable population 136 → 134, still not a defect count. Record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md)), 🟡 FUP-VACUOUS-DETECTOR-FALSE-POSITIVE — `check-vacuous-assertions.mjs` flags a test as vacuous when a helper is declared inside it (owner: tester/lead; filed 2026-08-21)

### Community 1824 - "⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO)"
Cohesion: 0.25
Nodes (8): Bodies rotated from follow-ups.md 2026-08-24 (resolved; their index lines left PROGRESS.md earlier), ⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO), 🟠 FUP-DISPOSE-EVENT-DOOR-GATE-BLIND — `dispose_event_phi`'s authorization gate is exercised by NO keystone: opening it leaves the full suite green (owner: backend; found by the ADR 0129 diff-scoped sweep), 🟡 FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING — `DSR_RESIDUE_NOTICE` line 1 is now CONDITIONALLY true, and the condition is a control the software cannot enforce (owner: PO copy call, then frontend; created by ADR 0131, 2026-08-20), Resolved 2026-08-24 — the ADR 0136 follow-up round (index lines rotated verbatim from PROGRESS.md), Resolved 2026-08-24 — the finding the ADR 0136 round's own sweep produced (index line rotated verbatim from PROGRESS.md), ⬛ Resolved — rotated 2026-08-13 (the DM2 Record step): **FUP-DM1-CEILING** (D15 ceiling, DM2·S1 + S4) · **FUP-DM1-E2E** (6+1 specs rewritten, DM2·S4) · **FUP-DM1-DISPOSE** (`dispose_case_phi` arm restored, DM2·S2) — each verified independently, not accepted from a report → [follow-ups-archive.md](./follow-ups-archive.md), Rotation notes rotated from PROGRESS.md 2026-08-24

### Community 1825 - "User Registration & Identity Management — phase record (archived)"
Cohesion: 0.20
Nodes (8): Bug trail (all resolved), Final gate result (§6.2 / §6.3), Open follow-up (deploy), QA verdict history, Summary, Task detail, Test-run log (rotated from Test Run Summary), User Registration & Identity Management — phase record (archived)

### Community 1826 - "QA review — ADR 0136, deferred `staff_admin` sign-off"
Cohesion: 0.22
Nodes (7): openDashboard(), IMPORTANT: exclude case-phase responses (`case_phase_id=is.null`). The, seedOnlyTo(), signInAs(), ADR-0018, ADR-0020, ADR-0106

### Community 1827 - "ROUND 2 ADDENDUM — 2026-08-21"
Cohesion: 0.25
Nodes (8): 16 · R2-1 … R2-5, R2-7 — verified closed, 17 · ⛔ W7 — I RETRACT IT. It was wrong in round 1, wrong again in round 2, and the evidence was in front of me the whole time, 18 · R2-6 — the lead is right to decline the rule, and my §8 reasoning was wrong, 19 · Closing, How I got there, because the mechanism is the point, On whether the memory generalisation is a fourth prose record, ROUND 2 ADDENDUM — 2026-08-21, What this is, named

### Community 1828 - "check-rules-staleness.mjs"
Cohesion: 0.50
Nodes (7): checkPopulation(), checkRule(), main(), parseFrontmatter(), ROOT, RULES_DIR, selfTest()

### Community 1829 - "dsr.test.ts"
Cohesion: 0.27
Nodes (10): isTerminalMeetingStatus(), MeetingLifecycleActions(), cancelMeeting(), concludeMeeting(), distributeMeeting(), heldArgs(), markMeetingHeld(), reopenMeeting() (+2 more)

### Community 1830 - "p3-case-print-mutation-audit.sh"
Cohesion: 0.39
Nodes (4): baseline(), parse_tap(), run_mutation(), p3-case-print-mutation-audit.sh script

### Community 1831 - "Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON)"
Cohesion: 0.29
Nodes (7): `app._case_caps` gained arm **S8** — administrativo commission-wide case READ, `app.member_can_for` is the single implementation; `member_can` delegates, ⚠ Authz-sweep coverage of this surface — state it before quoting a green ARM, Case PHI gained a **creation-scoped write path** — the first not held by a coordinator, Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON), `public.bulk_create_cases` — TWO keys, and `all_phases` refused AT THE GATE, The `administrativo` capability vocabulary is now FIVE

### Community 1832 - "Amendment 7 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build time**): bulk creation is a COMPOSITION, and §A1.2's one-arm sentence does not open it"
Cohesion: 0.29
Nodes (7): A7.1 — What A1.2 says, and what happened when it was built, A7.2 — The ruling: **two existing keys**, A7.3 — What the PO was told, because the shape changed, A7.4 — Pins that carry the ruling (the negatives, not the positive), A7.5 — Approval scope, Amendment 7 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build time**): bulk creation is a COMPOSITION, and §A1.2's one-arm sentence does not open it, Consequences

### Community 1833 - "0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text"
Cohesion: 0.33
Nodes (6): 0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text, Consequences, Context, Decision, Two errors the build made, both caught by controls, both worth keeping, Why the decodability test is the whole decision

### Community 1834 - "0146 — The E2E gate harness must not report green while blind"
Cohesion: 0.24
Nodes (7): BannerTone, preservedCasesSentence(), DRAFT_PROPS, ADR-0096, TONES, ADR-0096, VersionWorkflowBanner()

### Community 1835 - "Concluded § Now rotations — 2026 Q3"
Cohesion: 0.17
Nodes (12): Concluded § Now rotations — 2026 Q3, PDF·P3 (Printing Cases) — CONCLUDED, rotated from § Now 2026-08-25, Rotated 2026-08-24 — ADR 0136 (deferred `staff_admin` sign-off), at the Record step, Rotated 2026-08-24 — the ADR 0137 batch § Now bullet, all four items concluded, Rotated 2026-08-24 — the SUPERSEDED § State remote row (`20261003001800`), Rotated 2026-08-25 — the gate-tooling round and 22-v3 REG·KIND, both concluded, Rotated 2026-08-26 — AFF4 Track P (the pre-step), concluded, Rotated from PROGRESS.md § Now — 2026-08-25 (+4 more)

### Community 1836 - "DSR Slice 3 — build detail (rotated from PROGRESS.md § Now)"
Cohesion: 0.29
Nodes (7): Backend half — build record, ↩ BUG-DSR-S3-004 and -005 bodies (the two SPEC defects), rotated 2026-08-20 — VERBATIM apart from the link repoint, ↩ BUG-DSR-S3-006 **and -007** bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint, DSR Slice 3 — build detail (rotated from PROGRESS.md § Now), ↩ Fixed-bug bodies, rotated from PROGRESS.md § Bug Log 2026-08-20 — VERBATIM apart from the link repoint, The gate-vocabulary framing for the affordance gap (2026-08-20), ↩ Two more fixed-bug bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint

### Community 1837 - "FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)"
Cohesion: 0.29
Nodes (8): ADR-0052, addPqsMember(), MESSAGES, removePqsMember(), revalidateNsp(), setPqsRcaDueWindow(), ADR-0052, ADR-0102

### Community 1838 - "PDF·P3 — catalog reconciliation of the authz sweep domain"
Cohesion: 0.29
Nodes (7): C-1 premise — confirmation (rode along free, one query), Controls, Measured contradictions to the record, Method, PDF·P3 — catalog reconciliation of the authz sweep domain, Reconciliation against the 27 scoped names, Verdict

### Community 1839 - "3 · The deviations — all three VERIFIED, including the one arguing for *less* gating"
Cohesion: 0.29
Nodes (7): 3.1 · `HC0G` → `HC0F` — ✅ **CORRECT, and the codes are internally consistent**, 3.2 · B7's attach-time check on **both** doors — ✅ **the hole is closed**, 3.3 · `record_recusal` — no blanket term — ✅ **the reasoning is SOUND and the twin proves it**, 3.4 · B7's own trap — ✅ **M1·1 does NOT hand back the hole M1·2 closes**, 3.5 · The trigger-based freeze — ✅ **adequate; I hunted the bypasses and found none**, 3.6 · Rule 11 — ✅ **the 161→161 silence is genuinely closed**, 3 · The deviations — all three VERIFIED, including the one arguing for *less* gating

### Community 1840 - "check-migration-set-local.mjs"
Cohesion: 0.38
Nodes (6): findTopLevelSetLocal(), FIXTURES, isInScope(), MIGRATIONS_DIR, SCOPE_FIXTURES, selfTest()

### Community 1841 - "phase-result-options.ts"
Cohesion: 0.22
Nodes (8): ⚠ `0 infra` is the POST-RETRY state — two batches collapsed, DSR — discharged, and the assertion it was hiding is already fixed, Environment traps hit while producing this run, Flaky tests, by identity, with batch health, Merged-tree full `e2e:prod` gate — 2026-08-25, `3894c667`, Non-regression: two formerly-deterministic reds stayed green, The 11 skipped tests, by identity, Verdict

### Community 1842 - "p0137-phi-door-mutation-audit.sh"
Cohesion: 0.43
Nodes (3): parse_tap(), run_mutation(), p0137-phi-door-mutation-audit.sh script

### Community 1843 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.40
Nodes (5): ADR 0003 — pgTAP for database tests, Consequences, Context, Decision, Rationale

### Community 1844 - "ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`"
Cohesion: 0.40
Nodes (5): ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`, Consequences, Context, Decision, Rationale

### Community 1845 - "ADR 0008 — GSAP as the animation dependency"
Cohesion: 0.40
Nodes (5): ADR 0008 — GSAP as the animation dependency, Consequences, Context, Decision, Rationale

### Community 1846 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.40
Nodes (5): 0011 — Position reorder via deferrable constraints + SQL swap RPCs, Consequences, Context, Decision, Options considered

### Community 1847 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.40
Nodes (5): 0013 — Fix form_versions INSERT RLS self-reference, Consequences, Context, Decision, Options considered

### Community 1848 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.33
Nodes (6): ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos"), Alternatives rejected, Amendment 1 — the Q3 boundary gains an administrativo read arm; the write-grant SURFACE moves, Consequences, Context, Decision

### Community 1849 - "0084 — Bulk Case Creation ("Múltiplos casos")"
Cohesion: 0.33
Nodes (6): 0084 — Bulk Case Creation ("Múltiplos casos"), Consequences, Context, Decisions, Deferred (out of scope), The concrete surface

### Community 1850 - "ADR 0127 — standing rules get a path-scoped home, and a staleness gate"
Cohesion: 0.33
Nodes (6): ADR 0127 — standing rules get a path-scoped home, and a staleness gate, Amendment 1 — volume bounds, and the first retirement (2026-08-19), Amendment 2 — retirement has a precondition, and "too broad" has four exits (2026-08-19), Amendment 3 — the instrument was installed after the thing it measures (2026-08-19), Amendment 4 — MEASURED: rules fire, in a fresh session (2026-08-19), Amendment 5 — second measurement: SOURCE globs fire too (2026-08-19)

### Community 1851 - "ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap"
Cohesion: 0.33
Nodes (6): ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap, Consequences, Context, Decision, Rejected, The two live doors that contradict Decision 1

### Community 1852 - "Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings"
Cohesion: 0.33
Nodes (6): A4.1 — The ruling, A4.2 — Why (measured 2026-08-22 from the live catalog; full detail in the follow-up), A4.3 — Binding on M2 (the migration may not be written without these), A4.4 — Approval scope, Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings, Consequences

### Community 1853 - "Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked"
Cohesion: 0.33
Nodes (6): A5.1 — The measurement that forced the question, A5.2 — The ruling, A5.3 — What this does and does not disturb, A5.4 — Approval scope, Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked, Consequences

### Community 1854 - "Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks"
Cohesion: 0.33
Nodes (6): A6.1 — What was measured (live catalog, twice, independently), A6.2 — Why using `member_can` as written would have been a defect, not a shortcut, A6.3 — The ruling: one implementation, not two, A6.4 — Binding conditions (the migration may not be written without these), Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks, Consequences

### Community 1855 - "ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases"
Cohesion: 0.33
Nodes (6): ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases, Alternatives rejected, Consequences, Context, Decision, Obligations (each blocks the increment that ships it)

### Community 1856 - "ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved"
Cohesion: 0.33
Nodes (6): ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved, Consequences, Context, Decision, Rejected alternatives, and why, Size — measured 2026-08-22, re-derive before building

### Community 1857 - "ai-detail-main.jsx"
Cohesion: 0.22
Nodes (9): 1. Is the PHI-destruction path dead? — **YES (behaviourally proven)**, 2. Is legitimate disposal intact? — **YES. The over-grant twin genuinely passes.**, 3. Mutation harness — re-run by me, 21/21 RED-PROVEN, and red means red, 4. The two self-reported traps — both confirmed closed, 5. Scope — clean. No over-reach., AUTHZ · M2 — A30 bucket C review (platform_admin loses the referral-PHI arm), E2E recommendation: **targeted run — do NOT run the full suite**, Still live (MINOR — non-blocking, no behaviour at risk) (+1 more)

### Community 1858 - "cases-views.jsx"
Cohesion: 0.22
Nodes (9): 9.1 Ask ① — R1 is closed, and the `'case'` arm survived, 9.2 Ask ② — `311` §5.1 genuinely generalises, within a stated anchor, 9.3 Ask ③ — R2's eight assertions: non-vacuous, with one isolation gap (MINOR), 9.4 Ask ④ — the PO-ruling pins are real and would fail loudly, 9.5 Carried forward (INFO, no action required for this phase), 9.6 What I did not check, 9.7 Verdict, plainly, 9. ROUND 3 — re-review of the M11 closure (+1 more)

### Community 1859 - "⛔ AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**"
Cohesion: 0.25
Nodes (7): CasePatientConfirmation(), FIELDS, DRAFT, ADR-0134, ADR-0038, ADR-0134, renderedText()

### Community 1860 - "5 · The carry — a plain answer"
Cohesion: 0.33
Nodes (6): 5.1 · Does M1 achieve *"the exclusion keystones stop being vacuous"* with the carry outstanding?, 5.2 · ⛔ But one carried door leaves a live Rule 12 hole — `dispose_case_phi` (BLOCKING), 5.3 · `get_case_patient` — ✅ **`backend`'s "verified false alarm" is CORRECT**, 5.4 · The `can_read_attachment` "denied for free" closure claim — ✅ **VERIFIED, and non-vacuous**, 5.5 · The rest of the carry — authority holes, correctly deferred, 5 · The carry — a plain answer

### Community 1861 - "r2 — ✅ APPROVED"
Cohesion: 0.33
Nodes (6): Carried MINORs — none blocking, all one-line, On the two questions I was asked to be adversarial about, r2 — ✅ APPROVED, Re-measured, not read, Scope of r2 — unchanged from r1 except where stated, Verdict

### Community 1862 - "claude-md-review-signal.mjs"
Cohesion: 0.40
Nodes (5): main(), ADR-0127, QUEUE, SIGNALS, userTexts()

### Community 1863 - "test-netstat-listener-pids.sh"
Cohesion: 0.47
Nodes (3): check(), check_has(), test-netstat-listener-pids.sh script

### Community 1864 - "page.tsx"
Cohesion: 0.33
Nodes (8): actionsStub(), CONFORME, NAO_CONFORME, opt(), renderAtReview(), scoredItem(), ADR-0136, wizardData()

### Community 1865 - "DM follow-up triage — DVF 1:1 + the draft-print delete guard (2026-08-18; DM-FUP TRIAGE #2/#4/#8b; migrations `20260928000600`–`…000700`, **2**; pgTAP `312` 77→80 · `328` 128→130; **LOCAL ONLY — not pushed**)"
Cohesion: 0.40
Nodes (5): `20260928000600` — `document_version_files` is structurally 1:1 with its bytes, `20260928000700` — a response with an ACTIVE print cannot be deleted, `20260928000800` — `superseded` is a live page, and the mint is ordered against the discard, App-layer changes in the same batch, DM follow-up triage — DVF 1:1 + the draft-print delete guard (2026-08-18; DM-FUP TRIAGE #2/#4/#8b; migrations `20260928000600`–`…000700`, **2**; pgTAP `312` 77→80 · `328` 128→130; **LOCAL ONLY — not pushed**)

### Community 1866 - "REMOTE CENSUS 2026-08-18 (read-only, linked `azkbbhskturikxpgmafq`) — **the production DB is EMPTY, and it was emptied by TRUNCATE/reset semantics, not by deletes**"
Cohesion: 0.40
Nodes (5): Consequences, ⭐ HOW it was emptied — `pg_stat_all_tables`, and the numbers do not add up the same way twice, REMOTE CENSUS 2026-08-18 (read-only, linked `azkbbhskturikxpgmafq`) — **the production DB is EMPTY, and it was emptied by TRUNCATE/reset semantics, not by deletes**, ⛔ What this does NOT establish — state it before anyone reads the table above as closure, ⭐ WHEN — the logs answer it, and they SUPERSEDE the `pg_stat` inference above

### Community 1867 - "ADR 0001 — Scaffolding & toolchain bootstrap"
Cohesion: 0.50
Nodes (4): ADR 0001 — Scaffolding & toolchain bootstrap, Consequences, Context, Decisions

### Community 1868 - "ADR 0006 — Supabase API key scheme vs. env var naming"
Cohesion: 0.50
Nodes (4): ADR 0006 — Supabase API key scheme vs. env var naming, Consequences, Context, Decision

### Community 1869 - "0012 — clone_form_version returns the existing draft (one draft per form)"
Cohesion: 0.50
Nodes (4): 0012 — clone_form_version returns the existing draft (one draft per form), Consequences, Context, Decision

### Community 1870 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.50
Nodes (4): ADR 0019 — The default (anchor) section may carry a title, Consequences, Context, Decision

### Community 1871 - "0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns"
Cohesion: 0.25
Nodes (8): 1. Requirements (§2 locked decisions) — all delivered, 2. Security / RLS — all 10 guardrails honored, 3. Code quality, 4. PHI (Rule 12), 5. Hygiene, Gate inputs relied upon (spot-checked, not re-run), INFO (non-blocking observations), QA Review — "Administrativo" delegated-capability role (ADR 0061)

### Community 1872 - "ai-detail-app.jsx"
Cohesion: 0.25
Nodes (8): 2.1 `organization_affiliations` — D1 audience and the deliberate absence of a hospital tier, 2.2 The five new doors — authority grids, ALLOW and DENY, 2.3 The census / floor / sweep disposition — exemplary, and the one named absence, 2.4 ADR 0157's dominance-grid widening — self-guarded, 2.5 Rule 11 — audit coverage and the actor-attribution residue, 2.6 Rule 12 / PHI — nothing widened, 2.7 Secrets, 2. Security / RLS / authorization

### Community 1873 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.40
Nodes (5): 4.3 `form_responses.form_answer_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1874 - "🛑 DM5 gate step 4 — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**"
Cohesion: 0.40
Nodes (5): ⬛ Closed work — DM4 · DM3 · DM2 · the "Recently completed" index · ad-hoc completed work, ✅ COMPLETE — **DM5: Wave D + retirement** (2026-08-14 → 2026-08-18) — the Document Model program's FINAL phase, 🛑 DM5 gate step 4 — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**, DM5 gate step 4 — the seven PO decisions (rotated from PROGRESS.md 2026-08-18), 📋 Remaining pre-pilot work

### Community 1875 - "page.tsx"
Cohesion: 0.25
Nodes (7): Bottom line, MINOR-1 — the mutation harnesses leave `pgtap` installed in `public`, which turns the **next** pgTAP run's t19 red, P1 (blocking) — the closed set is a **FLOOR**, not the population: three `SECURITY DEFINER` RPCs authorize on raw arms with no gate, QA Review — AUTHZ · M5: the `is_active` outer gate (defect ③), State pinned (§7.3), What I could NOT check, What I verified and found SOUND

### Community 1876 - "page.tsx"
Cohesion: 0.25
Nodes (8): BLOCKER-1 — CLOSED, and proven rather than accepted, Carried forward unchanged, MAJOR-1 — CLOSED, MINOR-1…7 — all closed, New in r2 — two forward-looking INFO, Round 2 — verification of the Package A fix wave, The scope rulings, re-derived, What the fix wave did well

### Community 1878 - "Review CLAUDE.md against queued session signals"
Cohesion: 0.50
Nodes (3): Guardrails, Procedure, Review CLAUDE.md against queued session signals

### Community 1879 - "ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts"
Cohesion: 0.50
Nodes (4): ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts, Consequences, Corrections to the inherited record, taken before the rulings, Decisions

### Community 1880 - "ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL)"
Cohesion: 0.50
Nodes (4): ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL), Consequences, Decisions, Evidence — why the refusal proves what it claims

### Community 1881 - "Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk"
Cohesion: 0.50
Nodes (4): A1.1 — OPEN-1: no backfill (confirms the plan's recommendation), A1.2 — OPEN-2: bulk case creation opens under the **same** `create_cases` key, Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk, Consequences

### Community 1882 - "Amendment 8 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): `create_case` loses its `app.is_admin()` arm, and Amendment 2's separate PHI gate collapses with it"
Cohesion: 0.50
Nodes (4): A8.1 — Amendment 2's PHI gate was **structurally unreachable** the moment the arm was cut, and was deleted, A8.2 — the coverage that was believed to exist did not, A8.3 — consequences checked, not assumed, Amendment 8 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): `create_case` loses its `app.is_admin()` arm, and Amendment 2's separate PHI gate collapses with it

### Community 1883 - "5.2 `referral_context_versions`"
Cohesion: 0.50
Nodes (4): 5.2 `referral_context_versions`, Columns, Constraints, Design rationale

### Community 1884 - "Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)"
Cohesion: 0.50
Nodes (4): 🔴 FUP-ACT-DISPOSE-UI — LGPD Art. 18 referral-erasure has no UI route (owner: PO — mount point), ✅ FUP-ACT-DISPOSE-UI — RESOLVED 2026-08-20 (DSR Slice 2, ADR 0130). The LGPD Art. 18 erasure path has a working UI route., ⬛ FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE — ✅ **RESOLVED 2026-08-19** — `dispose_meeting_minutes` could not complete on any locked meeting that had agenda items; its own "bypass the freeze guards" comment was FALSE (owner: backend + PO; ⛔ its **"blocks C1a/C1b"** claim was WRONG IN GRAIN — see the correction below; Rule 12 / LGPD Art. 18), Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)

### Community 1885 - "Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure)"
Cohesion: 0.50
Nodes (4): ⬛ FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION — ✅ **RESOLVED 2026-08-19: the subject was removed, not the predicate widened (ADR 0126 D5)** — a print of an `in_progress` draft is visible to its CREATOR ONLY, and the minter can lose the only way out (owner: PO decision, then backend + frontend), ⬛ FUP-PREVIA-SPLIT-BUILD — ✅ **RESOLVED 2026-08-19: shipped, QA APPROVED r2** — build ADR 0125: the ephemeral `Imprimir prévia` / registered `Emitir documento` split (owner: backend + frontend), Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure), ⬛ Resolved — rotated 2026-08-19 (the ADR 0125/0126 prévia-split Record step)

### Community 1886 - "2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING)"
Cohesion: 0.36
Nodes (7): findMountSites(), providerRegistryEntries(), read(), ROOT, stripComments(), ADR-0104, ADR-0144

### Community 1887 - "mutate.mjs"
Cohesion: 0.50
Nodes (3): [file, mode], MODES, src

### Community 1890 - "Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)"
Cohesion: 0.67
Nodes (3): Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md), 🔴 FUP-ETH-1 — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (2026-08-05), 🔴 FUP-ETH-CPF-1 — the D5 widening also exposes `professional_profiles.cpf` (2026-08-11, backend)

### Community 1891 - "1 · The P0s — CONFIRMED DEAD, behaviourally"
Cohesion: 0.29
Nodes (7): ADR 0152 — PostgREST maps the `P0*` SQLSTATE class to HTTP 500; the document-corridor 500 is a 73-function class, not a door defect, Consequences, Context, Decision, The class, The measurement (2026-08-26, local stack, PostgREST v14.5, bare `curl` through Kong), What this refutes

### Community 1893 - "ActionItemForm"
Cohesion: 0.29
Nodes (7): Gate state (this session's scope — NOT the full §6 gate), Item 0 — MAJOR-1 / S1-O4 (PO: PROPAGATE) — ADR 0117 Amendment 1, Item 1 — P0-1's proof closed, Red-first record (K15, real pre-fix catalog — 374 migrations, unmutated), Resumption session 2026-08-13 (backend) — items 0 + 1 closed, The 308 obligation is now executable, Twin record (item 0)

### Community 1901 - "RelationshipToCase"
Cohesion: 0.29
Nodes (7): ADRs, Data-access & action modules, Deferred (carried as a follow-up, not gate-blocking), Migrations, Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail), Tests / Gate, What shipped

### Community 1906 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.29
Nodes (6): Backend rows, Base-branch failure triage (2026-07-08, lead), E2E (scoped pass, NOT a formal gate), Frontend rows, UI/layout fixes batch + base-branch triage — 2026-07-08, UI/layout fixes batch (frontend + backend)

### Community 1907 - "1 · Verification of the three NEW findings"
Cohesion: 0.29
Nodes (7): 1.1 · §1.1 `lift_recusal` — ✅ **CONFIRMED** (verbatim), 1.2 · §1.2 exclusion gate missing from case RPCs — ✅ **CONFIRMED, but the counts are wrong and the fix set is under-scoped**, 1.3 · §1.3 `list_cases_board` fast-path — ✅ **CONFIRMED** (verbatim), 1 · Verification of the three NEW findings, Hunt for other fast-path RPCs — ✅ one more found, and it is invisible to Q7, The load-bearing negative — ✅ **CONFIRMED**, ⛔ The under-scope — this is the blocking item

### Community 1908 - "3 · NEW findings the inventory missed"
Cohesion: 0.29
Nodes (7): 3 · NEW findings the inventory missed, ⛔ NEW-1 · **P0 — the exclusion model has THREE self-serving mutators, not one. The respondent arm has two, and one opens PHI. PROVEN LIVE.**, ⛔ NEW-2 · **P1 — the inventory's headline query (Q7) reproduces the exact blind spot A23 named**, ⛔ NEW-3 · **P2 — `case_interviews_insert` is missing from §1.4**, ⚠ NEW-4 · **P2 — `case_access` carries `authenticated` INSERT/UPDATE grants today**, Proof (transaction, `ROLLBACK`ed; persistence re-verified), ✅ Structural blind spots I checked and cleared (record, so nobody re-opens them)

### Community 1909 - "V-6 · What M1 must cover — the authoritative fix set"
Cohesion: 0.29
Nodes (7): M1·1 — B7: respondent linkage, M1·2 — the exclusion-plane mutators (5 RPCs), M1·3 — NEW: `case_participant_roles` — the 6th exclusion-plane table (V-3), M1·4 — the DEFINER exclusion sweep: 35 RPCs, split by remediation shape, M1·5 — A30: `platform_admin` arms on tenant data — 5, not 4, V-6.1 · `set_participant_patient` — CONFIRMED. Blast radius, as requested., V-6 · What M1 must cover — the authoritative fix set

### Community 1910 - "W-6 · ⭐ THE AUTHORITATIVE, ORDERED M1 SCOPE — `backend` builds from THIS"
Cohesion: 0.29
Nodes (7): M1·1 — B7: respondent linkage · **LANDS FIRST**, M1·2 — the five exclusion-plane **RPC** mutators, M1·3 — `case_participant_roles`: the 6th exclusion-plane table · **UPDATE-freeze**, M1·4 — the sweep: **35 RPCs + `reclassify_attachment`**, split by remediation shape, M1·4b — the **11 gate helpers** (D5) — *this is where the leverage is*, M1·5 — A30: platform_admin arms · ⚠ **BLOCKED pending an exhaustive enumeration** (§W-4), W-6 · ⭐ THE AUTHORITATIVE, ORDERED M1 SCOPE — `backend` builds from THIS

### Community 1911 - "W-2 · ⛔→✅ **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**"
Cohesion: 0.29
Nodes (7): W-2.1 · The numbers — ✅ **exact**, W-2.2 · **Is 16 the population, or a sixth floor? — It is a SCOPED set, not a derived one — and the scope holds.**, W-2.3 · ⭐ **Does fixing a helper fix its callers? — YES, and the closure argument is stronger than v3 states**, W-2.4 · ⚠ **But the "for free" claim has NINE exceptions, and v3 states none of them**, W-2.5 · ⛔ **`reclassify_attachment` — a real defect v3's frame does not reach** (the direct-check residue), W-2.6 · The 57 false alarms — spot-checked **both ways** ✅, W-2 · ⛔→✅ **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**

### Community 1912 - "ADR 0004 — Sign-off enforcement feature flag"
Cohesion: 0.33
Nodes (6): ADR 0004 — Sign-off enforcement feature flag, Consequences, Context, Decision, Rationale, Update — flag flipped (Phase 6, 2026-06-13)

### Community 1913 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.33
Nodes (6): ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module), Consequences, Context, Decision — the 8 locked design decisions, Supersession & amendments, The concrete surface as built (for QA to audit against)

### Community 1914 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.33
Nodes (6): ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke, Consequences, Context, Decision, Residual (accepted; not blocking pre-pilot), Two rejected fixes

### Community 1915 - "2 · Verification of the MOVED / FALSE claims"
Cohesion: 0.33
Nodes (6): 2.1 · The `interview-attachments` bucket — blast radius, 2.2 · `assign_case_phases` → PHI — traced end-to-end, **PHI is genuinely reachable**, 2.3 · The second `case_access` coupling — **CONFIRMED, and B1 breaks interview reads**, 2.4 · A20 / B7 — **CONFIRMED**, 2.5 · §1.6 — **CONFIRMED**, 2 · Verification of the MOVED / FALSE claims

### Community 1916 - "door-sweep-cases.sh"
Cohesion: 0.67
Nodes (4): rule(), say(), door-sweep-cases.sh script, show()

### Community 1918 - "date-picker-clear-affordance.test.tsx"
Cohesion: 0.53
Nodes (4): authoredNamesInsideTrigger(), expectsHasADate(), interactiveInsideTrigger(), trigger()

### Community 1919 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.40
Nodes (5): ADR 0002 — Admin claim via custom access token hook, Consequences, Context, Decision, Rationale

### Community 1920 - "ADR 0005 — `visible_when` condition shape (v1)"
Cohesion: 0.40
Nodes (5): ADR 0005 — `visible_when` condition shape (v1), Context, Decision, Extension point, Rationale

### Community 1921 - "ADR 0009 — Local JWT verification for the auth gate & identity"
Cohesion: 0.40
Nodes (5): ADR 0009 — Local JWT verification for the auth gate & identity, Consequences, Context, Decision, Rationale

### Community 1922 - "0010 — Denormalize email onto public.profiles"
Cohesion: 0.40
Nodes (5): 0010 — Denormalize email onto public.profiles, Consequences, Context, Decision, Options considered

### Community 1923 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.40
Nodes (5): ADR 0014 — Sanitizing Markdown renderer, Consequences, Context, Decision, Rationale

### Community 1924 - "ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)"
Cohesion: 0.40
Nodes (5): ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume), Consequences, Context, Decision, RLS audit

### Community 1925 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.40
Nodes (5): ADR 0017 — Multi-Phase Cases, Consequences, Context, Decision, Key technical choices & rationale

### Community 1926 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.40
Nodes (5): ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`), Consequences, Context, Decision, Why not the alternatives

### Community 1927 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.40
Nodes (5): ADR 0022 — Cross-committee case referrals (linked cases), Consequences, Context, Decision, Future shape (when built — not now)

### Community 1928 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.40
Nodes (5): ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a), Alternatives considered, Consequences, Context, Decision

### Community 1929 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.40
Nodes (5): ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry, Alternatives rejected, Consequences, Context, Decision

### Community 1930 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.40
Nodes (5): 0058 — Derived quality-indicator measurement compute (the parity lock), Alternatives rejected, Consequences, Context, Decision

### Community 1931 - "0067 — Lint gate scope & policy (restore a meaningful `npm run lint`)"
Cohesion: 0.40
Nodes (4): 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`), Consequences, Context, Decision

### Community 1932 - "0071 — Pre-pilot release scope expansion"
Cohesion: 0.40
Nodes (5): 0071 — Pre-pilot release scope expansion, Consequences, Context, Decision, Sequencing & dependencies (within the pre-pilot block; lead schedules)

### Community 1933 - "ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split"
Cohesion: 0.40
Nodes (5): Addendum — CASCADE collateral (fixed in 20260720000500), ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split, Consequences, Context, Decision

### Community 1934 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.40
Nodes (5): 0076 — Notifications (S1·N): pilot scope — prove one vertical deep, Consequences, Context, Decision, Follow-up (recorded at the N gate, 2026-07-13)

### Community 1935 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.40
Nodes (5): 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1, Amendment 1 — the template-configuration doors gain the tenancy arm (2026-08-09), Consequences, Context, Decision

### Community 1936 - "ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended)"
Cohesion: 0.40
Nodes (4): ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended), Consequences, Context, Decision

### Community 1937 - "0117 — DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`"
Cohesion: 0.40
Nodes (5): 0117 — DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`, Amendment 1 (2026-08-13) — the INTERVIEW's ceiling propagates to its documents, Consequences, Decisions, S1-O3 — ✅ RULED 2026-08-18 (PO): **uploader visibility is NOT added. The item is CLOSED.**

### Community 1938 - "ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement"
Cohesion: 0.40
Nodes (5): ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement, Consequences, Context, Controls — all observed RED against the pre-fix behaviour before being accepted, Decisions

### Community 1939 - "ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button"
Cohesion: 0.40
Nodes (5): ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button, Amendment 5 — Amendment 4's withdrawal reaches the CODE, and its rationale is COMPLETED, Consequences, Context, Decisions (Q-numbers = the design session's record)

### Community 1940 - "ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write"
Cohesion: 0.40
Nodes (5): ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write, Consequences, Context, Decision, The proof, and why the first attempt did not count

### Community 1941 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.40
Nodes (5): 4.5 `form_responses.form_answer_files`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1942 - "AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001 — completion record"
Cohesion: 0.40
Nodes (5): 1. The disposition, and why it is not 47 keystones, 2. The one real leak, and the persona that finds it, 3. Run history (four passes) and what went wrong in the harness, 4. Gate, AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001 — completion record

### Community 1943 - "DM follow-up triage — 2026-08-18 (session narrative, rotated)"
Cohesion: 0.40
Nodes (5): 🛑 DM5 gate step 4 — the seven PO decisions: ✅ **ALL ANSWERED 2026-08-18** (docket discharged), DM follow-up triage — 2026-08-18 (session narrative, rotated), PROGRESS.md § State as it stood at rotation (2026-08-18), 🛑 START HERE — **DM5's seven decisions are ANSWERED; a DM FOLLOW-UP TRIAGE then ruled eight more and shipped four. Both blocks below are live.**, ⛔⛔ State — re-measured **2026-08-18**. This block has now gone stale THREE times; measure, never quote.

### Community 1944 - "ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE"
Cohesion: 0.40
Nodes (5): Build (backend BE-1…BE-11, all mutation-proven at authz seams), ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE, Open follow-ups (non-blocking; logged at Record), QA verdict (`docs/reviews/eth-e2-review.md`) — APPROVED, Test gate (Phase Gate §6.2) — green

### Community 1945 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.40
Nodes (5): Focus-area verdicts, Hygiene, MINOR findings (non-gating — recommend fast-follow, not blocking the gate), QA Review — S1·N Notifications (Phase 20), Verdict: **APPROVED**

### Community 1946 - "referrals.test.ts"
Cohesion: 0.50
Nodes (4): detailPayload(), dtPayload(), rpcMock, ADR-0094

### Community 1947 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.50
Nodes (4): ADR 0020 — Dashboard-countable responses: case-phase exclusion, Consequences, Context, Decision

### Community 1948 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.50
Nodes (4): ADR 0021 — Due dates for case phases, Consequences, Context, Decision

### Community 1949 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.50
Nodes (4): ADR 0023 — Configurable per-committee case status, Consequences, Context, Decision

### Community 1950 - "ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes"
Cohesion: 0.50
Nodes (4): ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes, Consequences, Context, Decision

### Community 1951 - "ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures)"
Cohesion: 0.50
Nodes (4): ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures), Consequences, Context, Decision

### Community 1952 - "ADR 0027 — Case Timeline (read-only event aggregation, two layouts)"
Cohesion: 0.50
Nodes (4): ADR 0027 — Case Timeline (read-only event aggregation, two layouts), Consequences, Context, Decision

### Community 1953 - "ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target"
Cohesion: 0.50
Nodes (4): ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target, Consequences, Context, Decision

### Community 1954 - "ADR 0101 — The role→landing guard is catalog-derived, not remembered"
Cohesion: 0.50
Nodes (4): ADR 0101 — The role→landing guard is catalog-derived, not remembered, Consequences, Context, Decision

### Community 1955 - "ADR 0102 — `p_expires_at` is a real setter on both grant paths (extend-on-regrant)"
Cohesion: 0.50
Nodes (4): ADR 0102 — `p_expires_at` is a real setter on both grant paths (extend-on-regrant), Consequences, Context, Decision

### Community 1956 - "ADR 0113 — Referral-module door RETURN shape: the class, not the instance"
Cohesion: 0.50
Nodes (4): ADR 0113 — Referral-module door RETURN shape: the class, not the instance, Consequences, Context, Decision

### Community 1957 - "0147 — Masked CPF on the person detail rail"
Cohesion: 0.50
Nodes (4): 0147 — Masked CPF on the person detail rail, Consequences, Context, Decision

### Community 1958 - "0148 — Ever-held affiliation as the person-read boundary"
Cohesion: 0.50
Nodes (4): 0148 — Ever-held affiliation as the person-read boundary, Consequences, Context, Decision

### Community 1959 - "13.1 `interview_statements`"
Cohesion: 0.50
Nodes (4): 13.1 `interview_statements`, 13. Statements, Design rationale, Provenance requirement

### Community 1960 - "messages.ts"
Cohesion: 0.50
Nodes (3): MEETING_MESSAGES, ADR-0056, ADR-0062

### Community 1961 - "ADR 0123 — Discarding a draft that has emitted documents"
Cohesion: 0.67
Nodes (3): ADR 0123 — Discarding a draft that has emitted documents, Consequences, Decisions

### Community 1962 - "20. Reminder Rules"
Cohesion: 0.67
Nodes (3): 20. Reminder Rules, Responsibility, Suggested Schema

## Knowledge Gaps
- **11527 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `$schema` (+11522 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **911 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Page` connect `Case Department Field` to `4.7 `form_responses.form_answer_matrix_cells``, `RCA Analysis Stage`, `phase14b-triage.spec.ts`, `rendering-conditional-render.md`, `Architecture Rules (binding)`, `My Cases List`, `Referral Actions & Reply`, `credentials-editor.tsx`, `NSP CAPA/RCA Pages`, `loading.tsx`, `QA review — ADR 0136, deferred `staff_admin` sign-off`, `Interview & Agenda Forms`, `Derived Indicator Config`, `loading.tsx`, `form-model-normalization.spec.ts`, `Phase result options`, `Action Items Data Model Handoff`, `Interview badges`, `Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record`, `actions.test.ts`, `0013 — Fix form_versions INSERT RLS self-reference`, `28. Example: Complex Action Item`, `ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles`, `Case document delete`, `loading.tsx`, `Phase CH — Committee Charters & Meeting Cadence — QA Review`, `phase2-auth-shell.spec.ts`, `Page`, `Audit feed`, `Loading`, `Phase 17 — Controlled-Document Lifecycle · QA Review`, `patient-index.spec.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `createClient()` connect `CAPA Evidence & Cards` to `Shared UI & Phase Dialogs`, `Error & Not-Found Boundaries`, `Triage Disposition & Pathways`, `Case Documents`, `Form Builder Actions`, `Submission Detail (Answer Model)`, `NSP Event Pages`, `RCA Analysis Stage`, `Referral Detail & Formatting`, `NSP Patient Registry`, `My Cases List`, `Auth Callback & Meeting Settings`, `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA`, `NSP Referrals Dashboard`, `Case & Phase Actions`, `Meeting Detail & Agenda`, `Form Item Editor & Tests`, `Submission Detail Blocks`, `Phase Responder & Submissions`, `Phase Result Actions`, `loading.tsx`, `Interview & Agenda Forms`, `Narrative Templates`, `Layout`, `UserLifecycleActions`, `Section signoff fields`, `TitleAssignControl`, `Condition builder`, `Page`, `CaseActionItemForm`, `VersionWithUrl`, `loading.tsx`, `UploadDialog`, `Page`, `Wizard runner`, `28. Example: Complex Action Item`, `Page`, `Shared Action-Items Hub — task detail (Option A → case-fold → member views)`, `ActionItemRow`, `CaseActionItemsPanel`, `Page`, `deleteAdHocPhase`, `Page`, `loading.tsx`, `loading.tsx`, `Page`, `loading.tsx`, `loading.tsx`, `9.2 `interview_form_assignments``, `FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)`, `advanced-init-once.md`, `Format`, `bundle-dynamic-imports.md`, `bundle-preload.md`, `client-event-listeners.md`, `js-flatmap-filter.md`, `Meeting form dialog.test`, `ADR 0052 NSP per hospital`, `Page`, `Manual smoke — meeting audio → generated ata (T5)`, `Org-to-hospital re-key (B0-B5)`, `FIX-2 test-isolation leak (staff1 hospital_admin)`, `ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split`, `Phase result options`, `not-found.tsx`, `phase-1.md`, `phase-3.md`, `14. Recommended Indexes`, `parse-required.test.ts`, `Avatar stack`, `32. Implementation Phases`, `21. Recommended Dashboard Views`, `run-chart-loader.tsx`, `Loading`, `loading.tsx`, `Loading`, `Loading`, `loading.tsx`, `Loading`, `Loading`, `dsr.test.ts`, `FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)`, `Quick Reference`, `form-builder-enhancements.spec.ts`, `Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)`, `cases-extras.spec.ts`, `phase22-referrals.spec.ts`, `Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)`, `Lead Playbook — orchestration protocol (lead only)`, `F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE`, `0050 — Unified (non-PHI) action_items hub`, `10. New table: `case_votes``, `5.4 `referral_assignments``, `user-registration.spec.ts`, `0012 — clone_form_version returns the existing draft (one draft per form)`, `17. Suggested Repository and Service Boundaries`, `Phase CH — Committee Charters & Meeting Cadence — QA Review`, `ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")`, `23. Encryption and Sensitive Data`, `loading.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `cn()` connect `Loading` to `client-event-listeners.md`, `phase22-referrals.spec.ts`, `Shared UI & Phase Dialogs`, `Error & Not-Found Boundaries`, `Loading`, `Admin & Auth Pages`, `js-batch-dom-css.md`, `Case Lifecycle Actions`, `Triage Disposition & Pathways`, `Submission Detail (Answer Model)`, `Meeting form dialog.test`, `NSP Event Pages`, `loading.tsx`, `Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)`, `Referral Detail & Formatting`, `ADR 0052 NSP per hospital`, `Staff Case Detail`, `Quality Indicators`, `RCA Analysis Stage`, `nsp_org_admin role`, `pre-pilot-hardening-wave2.md`, `My Cases List`, `Auth Callback & Meeting Settings`, `1. Eliminating Waterfalls`, `Meeting Detail & Agenda`, `CAPA Evidence & Cards`, `Phase Result Actions`, `Lead Playbook — orchestration protocol (lead only)`, `Forms & Process Templates`, `phase7-cases.spec.ts`, `Interview & Agenda Forms`, `0146 — The E2E gate harness must not report green while blind`, `Narrative Templates`, `case-phase-result.spec.ts`, `Page`, `UserLifecycleActions`, `Quick Reference`, `Phase result options`, `Section signoff fields`, `ADR 0008 — GSAP as the animation dependency`, `Page`, `TitleAssignControl`, `phase-3.md`, `Condition builder`, `Page`, `loading.tsx`, `UploadDialog`, `add-block-menu.tsx`, `ARCHITECTURE.md — Hospital Commission Forms Platform`, `AttachmentLinkForm`, `parse-required.test.ts`, `Page`, `ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke`, `5.4 `referral_assignments``, `Audit icon`, `user-registration.spec.ts`, `ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)`, `deleteAdHocPhase`, `17. Suggested Repository and Service Boundaries`, `32. Implementation Phases`, `Phase CH — Committee Charters & Meeting Cadence — QA Review`, `loading.tsx`, `23. Encryption and Sensitive Data`, `Outcomes actions`, `loading.tsx`, `DepartmentDefDialog`, `ConfirmDeleteButton`, `advanced-effect-event-deps.md`, `FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)`, `32. Implementation Phases`, `Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)`, `cases-extras.spec.ts`, `Loading`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _11688 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Case Lifecycle Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.02030655627657194 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.03819982773471146 - nodes in this community are weakly interconnected._
- **Should `Shared UI & Phase Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.0190325138778747 - nodes in this community are weakly interconnected._
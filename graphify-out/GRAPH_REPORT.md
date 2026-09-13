# Graph Report - hospital_form_platform  (2026-09-13)

## Corpus Check
- 3501 files · ~7,628,504 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 27657 nodes · 50575 edges · 2285 communities (1378 shown, 907 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 328 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f635dcf4`
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
- server-cache-react.md
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
- SKILL.md
- SKILL.md
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
- activate-phase-dialog.test.tsx
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
- loading.tsx
- loading.tsx
- ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions
- ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got
- cases-views.jsx
- 0. Findings first — the six things that do not survive contact with the code
- 10. Arm domains — and **F-F, the finding that reshaped this design**
- 6. `guard_profile_privileged_columns` — the interaction, in full
- ETH·E4 — Ethics participant seating & professional identity (phase record)
- Lead notes
- attachments-panel.tsx
- capa-affordance.tsx
- indicators-panel-async.tsx
- table
- ⛔ Never kill a running sweep — it restores gates from an EXIT trap
- ADR 0026 — Interviews (case-scoped, participant-write RLS)
- ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles
- ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`
- 0066 — patient_xref case-module grain re-keyed to the patient participant
- ADR 0138 — Unified (non-PHI) action_items hub
- 3.16 `forms.form_lint_results`
- 4.7 `form_responses.form_answer_matrix_cells`
- 4.9 `form_responses.form_answer_references`
- 5.4 `referral_assignments`
- Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record
- An authz arm's EXIT CODE is not its verdict — read what it enumerated
- ⛔ Prettier does not govern this tree — in two opposite directions
- ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)
- ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only
- ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)
- ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision
- ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal
- ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org
- ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole
- 0057 — Phase 15/17 revision & pre-pilot re-sequencing (15 → 17 → 16)
- 0070 — Interview data-model v2: sessions + reporting / confidentiality columns
- 0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle
- 0149 — An org_admin reads the hospital-tier audit chain
- 0150 — The audit organization is derived from the hospital, and leg 5 means the platform chain
- 5.8 `referral_message_documents`
- 32. Implementation Phases
- Pre-Pilot DB Hardening — Wave 1 (archived task detail)
- Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail
- `guard_profile_privileged_columns`' trusted-caller arm is NEVER widened
- 28. Example: Complex Action Item
- 10. New table: `case_votes`
- ⬛ FUP-AFF2-CONTA — ✅ **RESOLVED 2026-08-26** (owner: frontend/PO; AFF4 **F5**, ADR 0151 **D14**)
- loading.tsx
- loading.tsx
- 12. Evaluation records
- 13. Observation-time context
- 17. Bed-matrix and rapid-entry model
- 16. Single-hospital customers
- 25. Platform support and break-glass access
- GLOSSARY
- BLOCKING
- r2 · 6 — Blocking items
- 4 · Round-1 findings — disposition
- port_free
- FF-5 (Entity Reference, ADR 0091) — closed bugs, rotated 2026-07-28
- Rotated 2026-08-12 — the FUP batch (both CLOSED)
- Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live Bug Log's two CLOSED blocks
- 1. Plane 1 — assignment shape, and the `expires_at` question
- 14. Run 6 (2026-09-03) — the first run against the statement-scoped path. **ACCEPTANCE MET.**
- 4. The measured principal, and the proof that its only grant path is the permission arm
- Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)
- FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — ✅ CLOSED 2026-09-01 (AE4.7b)
- Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)
- Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)
- ↩ Rotated from PROGRESS.md § Follow-ups 2026-08-31 — three concluded notes, VERBATIM apart from the link repoint
- FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION.md
- FUP-E2E-SUBMITTED-POOL-UNSCOPED.md
- FUP-MEETING-CASES-SELECT-OMITS-RECUSAL.md
- FUP-QO-6.md
- C2-TIER1 — progress record
- Do Not Put Effect Events in Dependency Arrays
- advanced-event-handler-refs.md
- Initialize App Once, Not Per Mount
- advanced-use-latest.md
- async-api-routes.md
- Dependency-Based Parallelization
- async-parallel.md
- async-suspense-boundaries.md
- Avoid Barrel File Imports
- Conditional Module Loading
- Defer Non-Critical Third-Party Libraries
- Dynamic Imports for Heavy Components
- bundle-preload.md
- Deduplicate Global Event Listeners
- client-localstorage-schema.md
- client-passive-event-listeners.md
- client-swr-dedup.md
- Avoid Layout Thrashing
- Cache Repeated Function Calls
- Cache Property Access in Loops
- Cache Storage API Calls
- Combine Multiple Array Iterations
- Early Return from Functions
- js-flatmap-filter.md
- Hoist RegExp Creation
- Build Index Maps for Repeated Lookups
- Early Length Check for Array Comparisons
- js-min-max-loop.md
- Defer Non-Critical Work with requestIdleCallback
- js-set-map-lookups.md
- js-tosorted-immutable.md
- rendering-activity.md
- Animate SVG Wrapper Instead of SVG Element
- rendering-conditional-render.md
- CSS content-visibility for Long Lists
- Hoist Static JSX Elements
- rendering-hydration-no-flicker.md
- rendering-hydration-suppress-warning.md
- rendering-resource-hints.md
- rendering-script-defer-async.md
- rendering-svg-precision.md
- rendering-usetransition-loading.md
- Defer State Reads to Usage Point
- rerender-dependencies.md
- rerender-derived-state.md
- Calculate Derived State During Rendering
- rerender-functional-setstate.md
- rerender-lazy-state-init.md
- Extract to Memoized Components
- Extract Default Non-primitive Parameter Value from Memoized Component to Constant
- rerender-move-effect-to-event.md
- Don't Define Components Inside Components
- Do not wrap a simple expression with a primitive result type in useMemo
- rerender-split-combined-hooks.md
- rerender-transitions.md
- rerender-use-deferred-value.md
- rerender-use-ref-transient-values.md
- server-after-nonblocking.md
- Authenticate Server Actions Like API Routes
- Cross-Request LRU Caching
- Avoid Duplicate Serialization in RSC Props
- server-parallel-fetching.md
- server-parallel-nested-fetching.md
- server-serialization.md
- _template.md
- dev.sh
- ADR 0141 — Cases board (`manage/cases`) filter redesign: actionable KPIs, saved views, advanced panel
- build-fake-repo.sh
- BUG-E2EISO-002 — rotated from PROGRESS.md 2026-08-03 (RESOLVED)
- BUG-FF4-001 (rotated from PROGRESS.md at the FF-4 Record, 2026-08-03) — RESOLVED
- Rotated 2026-08-23 — BUG-PHASE-RESULT-PREVIEW-1 (filed and RESOLVED the same session)
- ↩ Rotated from PROGRESS.md 2026-08-19 — the live § Bug Log "Closed" subsection, VERBATIM
- Live-file closed table + method notes (rotated from PROGRESS.md 2026-08-06)
- Rotated 2026-08-21 — the DSR remediation P0, RESOLVED
- ⬛ FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ✅ **CONCLUDED 2026-08-24 by PO ruling: EXPECTED, and in line with platform specifications.** Filed and closed the same day.
- ↩ Rotated from follow-ups-open.md 2026-09-03 (ADR 0186 Wave 5, plan 5.5)
- ⬛ FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY — ✅ **RESOLVED 2026-08-26** (owner: backend/lead; AFF4 pre-step P2)
- Rotated from PROGRESS.md + follow-ups.md 2026-08-20 — FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING (resolved by dissolution)
- ↩ Rotated from deferred-backlog.md 2026-09-03 (ADR 0185 D5 normalization)
- README.md
- 0197 — The data-access REGISTRIES are generated from the catalog; the prose keeps only what a catalog cannot know
- 0199 — A frozen archive does not belong on the retrieval path, and "it holds unique facts" is a reason to EXTRACT them
- ADR 0201 — The keying asymmetry is the model: a question about a third party ignores the hat, a question about the caller requires it — and on the scope axis the hat is role-wide while the audit row named one seating
- ADR 0203 — Audit F5's seam is already encoded as data in the enforcement manifest; the three classification columns are not, and their disposition is the PO's
- Batch 3 closures — unit WRITEPATH-BASELINE (2026-09-08)
- FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE
- FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP — a session's explicit role selection is never revalidated, so the token hook keeps minting a hat whose membership is gone
- FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET — the C2 harness mutates by an OID captured before a reset that reassigns every OID
- FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS — the `FOR ALL` policies whose read half no keystone exercises, disclosed by ADR 0191 D4 and owed a keystone each
- Current state
- Current state
- 2026-09-08 — `backend`, GATE AT THE TIP (R32 step 2). Every exit code read **bare**, no pipes
- 2026-09-08 — Record step (`backend`, at the lead's direction): QA re-review APPROVED at `45f5880a`; PO approved the Record step and the ff-merge; unit closed
- Round 2 — re-review at `d2bdb372`
- ADR 0017 — Multi-Phase Cases
- ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)
- ADR 0099 — Meeting audio → generated ata (minute_generator integration)
- 7. Recommended changes for the current project
- 3.16 `forms.form_lint_results`
- 4.3 `form_responses.form_answer_options`
- 4.5 `form_responses.form_answer_files`
- MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record
- V-3 · THE BLOCKING FINDING — C8's disproof is right on its legs and wrong on its scope
- MAJOR-1 — DISCHARGED
- Manual smoke — meeting audio → generated ata (T5)
- ⛔ EVIDENCE CORRECTED 2026-09-10 (QA MINOR-4) — the "no pgTAP cell" negative was a HAND-LIST
- ✅ RULED — 2026-09-11 (PO, unit `AE5-SUCCESSOR-ADRS`); the lead closes this at the Record step
- FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT — two mutation harnesses print verdicts and then exit 0 whatever they found
- 2026-09-05 — backend: QA sign-off F4-REC-1..3 (docs)
- 2026-09-04 — backend: PO ruling landed; ADR + hub corrections
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- AUTHZ Door-Blindness Audit — Findings
- 14. Handoff checklist
- 2. Method and evidence
- 5.8 `referral_message_documents`
- 14.1 `interview_findings`
- MAJOR-1 (BLOCKING) — `documents_wave_b` gates the LAST step of the corridor, not the corridor; the tree states the opposite twice
- Review CLAUDE.md against queued session signals
- ADR 0180 — `authz.scope_reaches`: the commission→organization ascent reads `commissions.organization_id`
- How a closure is archived — the standard shape
- b1-org-admin-wall-mutation-audit.sh
- 21. Recommended Dashboard Views
- An applied migration is NEVER edited — forward-only, additive
- ⛔ `prosrc` is not the whole function
- GRANT-PLANE-CONVENTION-A1 — ADR 0205 amended in place, and the third pre-pilot fix
- door-sweep selftest fixtures
- loading.tsx
- DeadlineDialog
- grant-plane-convention.md
- ⬛ FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME — ✅ **RESOLVED 2026-08-26** (owner: frontend; AFF4 Record)
- ⬛ FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE — ✅ **RESOLVED 2026-08-26 as DIAGNOSED + RE-SCOPED, not fixed** (owner: backend/lead; PO ruling during the AFF4 pre-step)
- gateblock.md
- qaentry.md
- B-hand-table.baseline.md
- B-hand-table.generated.md
- B-hand-table.prefix-output.md
- loading.tsx
- loading.tsx
- loading.tsx
- loading.tsx

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 802 edges
2. `cn()` - 551 edges
3. `Button()` - 347 edges
4. `Page` - 232 edges
5. `The other registers` - 231 edges
6. `cachedSignIn()` - 226 edges
7. `commissionHref()` - 212 edges
8. `FormBanner()` - 150 edges
9. `getCommissionAccessByOrg` - 144 edges
10. `getSessionContext` - 140 edges

## Surprising Connections (you probably didn't know these)
- `KpiStrip()` --indirect_call--> `v()`  [INFERRED]
  docs/design/temp/case_dashboard_redesign/cases-app.jsx → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/administrativo.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/case-access.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbQuery()` --indirect_call--> `v()`  [INFERRED]
  e2e/case-surface-split-increment-2.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts
- `dbGet()` --indirect_call--> `v()`  [INFERRED]
  e2e/charters-cadence.spec.ts → supabase/.temp/start-secrets/supabase_edge_runtime_azkbbhskturikxpgmafq/main/index.ts

## Import Cycles
- 2-file cycle: `src/lib/queries/cases.ts -> src/lib/queries/process-templates.ts -> src/lib/queries/cases.ts`
- 3-file cycle: `src/lib/queries/case-narratives.ts -> src/lib/queries/cases.ts -> src/lib/queries/process-templates.ts -> src/lib/queries/case-narratives.ts`

## Hyperedges (group relationships)
- **Case triage classification badges (harm, preventability, status, sentinel)** — docs_design_dashboard_kpi_harm_badge, docs_design_dashboard_kpi_preventability_badge, docs_design_dashboard_kpi_status_badge, docs_design_dashboard_kpi_sentinel_flag [INFERRED 0.85]
- **M&M committee KPI overview metrics** — docs_design_dashboard_kpi_kpi_awaiting_screening, docs_design_dashboard_kpi_kpi_on_next_agenda, docs_design_dashboard_kpi_kpi_under_review, docs_design_dashboard_kpi_kpi_overdue_review, docs_design_dashboard_kpi_kpi_closed_ytd, docs_design_dashboard_kpi_kpi_preventable_rate [EXTRACTED 1.00]

## Communities (2285 total, 907 thin omitted)

### Community 0 - "Case Lifecycle Actions"
Cohesion: 0.01
Nodes (205): ADR-0085, CancelCaseButton(), CaseLifecycleActions(), ADR-0032, ADR-0108, ConcludeNarrativeButton(), ADR-0033, ConfirmDeleteButton() (+197 more)

### Community 1 - "Admin & Auth Pages"
Cohesion: 0.03
Nodes (180): ADR-0093, LinkEvidenceDialog(), LOW_CARDINALITY_KINDS, BannerTone, FormBanner(), toneStyles, AddAdHocNarrativeDialog(), AddAdHocPhaseDialog() (+172 more)

### Community 2 - "Shared UI & Phase Dialogs"
Cohesion: 0.04
Nodes (46): 1. Acceptance criteria, 2.1 `organization_affiliations` — D1 audience and the deliberate absence of a hospital tier, 2.2 The five new doors — authority grids, ALLOW and DENY, 2.3 The census / floor / sweep disposition — exemplary, and the one named absence, 2.4 ADR 0157's dominance-grid widening — self-guarded, 2.5 Rule 11 — audit coverage and the actor-attribution residue, 2.6 Rule 12 / PHI — nothing widened, 2.7 Secrets (+38 more)

### Community 3 - "Error & Not-Found Boundaries"
Cohesion: 0.05
Nodes (60): isOverdue(), localTodayYmd(), MyCapaActionsPage(), ADR-0076, CapaActionStatusChip(), CapaClassificationChip(), CapaSourceBadge(), CapaStatusChip() (+52 more)

### Community 4 - "Condition & Result Rule Editor"
Cohesion: 0.01
Nodes (231): 🟡 FUP-329-ABORT-SHAPE — a `329` keystone whose failure ABORTS the file, dropping 41 assertions (owner: backend), 🟠 FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER — 103 authored pt-BR refusals, and the app layer discards essentially all of them (owner: backend/frontend; filed 2026-08-22, found when a PO-ruled message never reached the UI), 🟡 FUP-ACL-APP-POPULATION — ⭕ **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO), 🟡 FUP-ACT-CAPA-ASSIGN — NSP operators see ~only themselves in the CAPA assignee picker (owner: backend), 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend), 🟡 FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE — the write succeeds and nothing shows it (owner: backend; filed 2026-08-22 from the phase-result widening), 🟡 FUP-ADMIN-ARM-IS-ACTIVE-CAN-CREATE-PROFESSIONAL-COMMENT-NAMES-A-REMOVED-ARM — a stale comment describes an authority path Batch 10 removed (owner: backend), 🟡 FUP-ADMIN-ARM-IS-ACTIVE-CASES-EMPTY-SEMANTICS-DIVERGE-ACROSS-HARNESS-FAMILIES — `CASES=` means opposite things in two harness families (owner: lead + PO) (+223 more)

### Community 5 - "Phase Answers & Assignments"
Cohesion: 0.05
Nodes (39): Backend State — the feature-flag surface (GENERATED), Drift, both polarities, The generated flag registry, Backend State — the `app` helper surface (GENERATED), The generated function registry, Backend State — the Rule-9 data-access module surface (GENERATED), The generated module registry, Backend State — the `public` function surface (GENERATED) (+31 more)

### Community 6 - "Triage Disposition & Pathways"
Cohesion: 0.08
Nodes (54): DispositionRail(), NON_RCA_PATHWAYS, Pill(), HARM_DEFINITIONS, HarmScale(), ChoiceCard(), CLOSURE_DESCRIPTIONS, CLOSURE_ORDER (+46 more)

### Community 7 - "Case Documents"
Cohesion: 0.17
Nodes (13): ADR-0101, metadata, appOrigin(), AuthState, buildPickerRedirect(), MESSAGES, requestPasswordReset(), safeRedirectPath() (+5 more)

### Community 8 - "RCA Problem Stage"
Cohesion: 0.06
Nodes (74): actionItemsSection(), correctionsSection(), documentsSection(), field(), interviewsSection(), meetingsSection(), metaLine(), narrativesSection() (+66 more)

### Community 9 - "Form Builder Actions"
Cohesion: 0.06
Nodes (42): ADR-0011, ActionState, ALLOWED_IMAGE_MIME, Block, CHOICE_TYPES, COLOR_OPTION_TYPES, COLOR_TOKENS, commissionOfForm() (+34 more)

### Community 10 - "Submission Detail (Answer Model)"
Cohesion: 0.09
Nodes (42): metadata, NspCapaPage(), ADR-0114, metadata, NspRcaPage(), ADR-0114, auditClinicalView(), CapaActionEvidenceRow (+34 more)

### Community 11 - "Section Visibility & Blocks"
Cohesion: 0.02
Nodes (103): 0085 — Case Correction Lifecycle (phases + narratives), Consequences, Context, Decision (10 points, each PO-locked), Explicitly out of scope v1 (extension paths verified open), 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1, Amendment 1 — the template-configuration doors gain the tenancy arm (2026-08-09), Consequences (+95 more)

### Community 12 - "CAPA Badges"
Cohesion: 0.04
Nodes (83): DraftRow, SectionConditionFields(), ConditionRow(), condToRow(), DraftRow, emptyRow(), initialToRows(), isLegacySingle() (+75 more)

### Community 13 - "NSP Event Pages"
Cohesion: 0.13
Nodes (19): inputItem(), response(), section(), tree(), ADR-0089, ADR-0092, ADR-0136, toAnswerState() (+11 more)

### Community 14 - "RCA Analysis Stage"
Cohesion: 0.08
Nodes (41): metadata, NspPatientsPage(), parseEntityParam(), ADR-0039, ADR-0052, VALID_MODULES, formatDate(), patientModuleChipClass() (+33 more)

### Community 15 - "Case Department Field"
Cohesion: 0.02
Nodes (125): actionItemsSection(), createMeetingActionItemUI(), itemRow(), openEditDialog(), openSatellites(), openSatellitesByKeyboard(), reopenSatellites(), signInAs() (+117 more)

### Community 16 - "Referral Detail & Formatting"
Cohesion: 0.03
Nodes (102): BlockConditionNote(), ADR-0090, CONDITION_TARGET_TYPES, isEligibleTarget(), newChildConditionTargets(), newQuestionConditionTargets(), questionConditionTargets(), sectionConditionTargets() (+94 more)

### Community 17 - "Staff Case Detail"
Cohesion: 0.12
Nodes (11): ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement, Consequences, Context, Controls — all observed RED against the pre-fix behaviour before being accepted, Decisions, ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button, Amendment 5 — Amendment 4's withdrawal reaches the CODE, and its rationale is COMPLETED, Consequences (+3 more)

### Community 18 - "Org Overview Dashboard"
Cohesion: 0.18
Nodes (10): Could NOT verify, How I verified (method, so the negatives are worth something), MINOR, P0-1 · The D5 widening discloses **ethics-proceeding involvement** to every org manager. ADR 0108 D5's exposure argument is false as written., P0 — BLOCKING, QA Review — ETH·E4 · Ethics participant seating & professional identity, Round 2 — re-review after remediation (2026-08-11), Round 3 — audit + re-review (2026-08-11, lead) (+2 more)

### Community 19 - "Quality Indicators"
Cohesion: 0.11
Nodes (26): formatDate(), generateMetadata(), OrgCommissionDetailPage(), ActionState, authorizeCommission(), CaseAccessLevel, commissionOfCase(), grantCaseAccess() (+18 more)

### Community 20 - "NSP Patient Registry"
Cohesion: 0.07
Nodes (63): MyCapaActionControls(), ADR-0076, CapaActionCard(), CapaActionForm(), userLabel(), CapaActionsSection(), activePdcaStage(), allActionsSettled() (+55 more)

### Community 21 - "Form Builder Page"
Cohesion: 0.29
Nodes (7): ⏸ DM2 PAUSED 2026-08-13 — resumption handoff (PO decision), ⚠ One item is committed but NOT fully verified — do not read it as green, Open with the PO (do not decide these for them), State at pause — verified, not assumed, The remaining work, in order (nothing here needs re-deriving), ⚠ Two method findings that must survive this pause, What IS done and proven

### Community 22 - "CAPA Actions & Closure"
Cohesion: 0.03
Nodes (63): ADR 0022 — Cross-committee case referrals (linked cases), Consequences, Context, Decision, Future shape (when built — not now), ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14), Consequences, Context (+55 more)

### Community 23 - "My Cases List"
Cohesion: 0.02
Nodes (154): metadata, MyCasesPage(), ADR-0033, AddCaseWorkActions(), CaseCustomFieldsPanel(), ADR-0083, ADR-0032, ADR-0033 (+146 more)

### Community 24 - "Auth Callback & Meeting Settings"
Cohesion: 0.07
Nodes (85): GET(), SUCCESS_REDIRECT, LegacyMeetingsSettingsPage(), ActionItemRow(), AttendeeRow(), MeetingLifecycleActions(), assignMemberTitle(), createMemberTitle() (+77 more)

### Community 25 - "Referral Actions & Reply"
Cohesion: 0.06
Nodes (64): AssessmentRow, CCIH_FORM_HIGIENE, cloneFrameworkRpc(), createFrameworkRpc(), EvidenceLinkRow, filterIds(), FrameworkRow, getToken() (+56 more)

### Community 26 - "NSP Referrals Dashboard"
Cohesion: 0.04
Nodes (52): ActionState, appOrigin(), assignStaffAdmin(), authorizeStaffAdminOps(), createCommission(), MESSAGES, removeStaffAdmin(), requireAdmin() (+44 more)

### Community 27 - "Case & Phase Actions"
Cohesion: 0.10
Nodes (45): ADR-0135, CasePhaseDelete(), ActionState, activatePhase(), addAdHocPhase(), AddAdHocPhaseState, authorizeCommission(), cancelCase() (+37 more)

### Community 28 - "Meeting Detail & Agenda"
Cohesion: 0.25
Nodes (8): LEAD RULINGS on the revoke set — 2026-08-27, RV0 — the governing property: ⛔ a revoke may not create sweep blindness, RV1 — batch 4 stays HELD. Correctly identified; the hold is upheld, RV2 — `public.set_participant_patient` is not revoked in AE1, RV3 — the 5 constraint-referenced functions are excluded from every batch until the question is answered, RV4 — the 11 unreachable `public` doors are a finding to file, not to revoke here, RV5 — the `anon` residue stays untouched, RV6 — execution shape

### Community 29 - "NSP CAPA/RCA Pages"
Cohesion: 0.05
Nodes (49): ADR-0129, attemptAssumePlatformAdmin(), ProfileState, setAccountState(), ADR-0201, RUN, ADR-0131, RUN (+41 more)

### Community 30 - "CAPA Evidence & Cards"
Cohesion: 0.06
Nodes (45): mintedPrintIds, ADR-0120, GET(), KINDS, ADR-0079, ADR-0125, ADR-0144, wantsPhi() (+37 more)

### Community 31 - "Case Narrative Editor"
Cohesion: 0.05
Nodes (73): ActionItemDetailPage(), cnDue(), describeSource(), metadata, ActionItemSourceBadge(), ActionItemStatusBadge(), SOURCE_META, STATUS_META (+65 more)

### Community 32 - "Form Item Editor & Tests"
Cohesion: 0.05
Nodes (47): EthicsDashboardPage(), metadata, ADR-0064, ADR-0073, DepartmentDefDialog(), ArchiveDepartmentButton(), DepartmentsManager(), useDepartmentAction() (+39 more)

### Community 33 - "Submission Detail Blocks"
Cohesion: 0.08
Nodes (37): ADR-0111, openControlledDocumentVersion(), documentsWaveBEnabled(), downloadFileName(), errCode(), MIME_EXT, openDocumentVersion(), placeDocumentHold() (+29 more)

### Community 34 - "Phase Responder & Submissions"
Cohesion: 0.13
Nodes (38): isTerminalSession(), SessionActions(), addInterviewInterviewer(), addInterviewLink(), addInterviewSubject(), ALLOWED_ATTACHMENT_MIME, ATTACHMENT_KINDS, authorizeStaffAdmin() (+30 more)

### Community 35 - "Case Narrative Cards"
Cohesion: 0.06
Nodes (62): UserLifecycleActions(), listTenantOrphans(), createAdminClient(), callDoor(), NullableArgs, PublicFunctions, ActionState, appOrigin() (+54 more)

### Community 36 - "Phase Result Actions"
Cohesion: 0.06
Nodes (40): CasePatientEditDialog(), ADR-0137, ADR-0038, ADR-0078, ADR-0137, CreateCaseDialog(), ADR-0038, ADR-0064 (+32 more)

### Community 37 - "Admin Layout & Claims"
Cohesion: 0.03
Nodes (63): ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21), Consequences, Context, Decision, 0057 — Phase 15/17 revision & pre-pilot re-sequencing (15 → 17 → 16), Consequences, Context, Decisions (+55 more)

### Community 38 - "Interview & Agenda Forms"
Cohesion: 0.05
Nodes (41): 1. Evidence and limitations, 2.1 Identity, account state, and session responsibility, 2.2 Standing tenant authority, 2.3 Affiliation and person visibility, 2.4 Domain and exception authorization, 2.5 Enforcement planes, 2. How authorization currently works, 3. What should be preserved (+33 more)

### Community 39 - "Forms & Process Templates"
Cohesion: 0.08
Nodes (32): InterviewModalityChip(), SessionStatusBadge(), SessionTypeChip(), ADR-0072, ATTACHMENT_KIND_LABEL, ATTACHMENT_KIND_ORDER, CONFIDENTIALITY_LABEL, CONFIDENTIALITY_ORDER (+24 more)

### Community 40 - "Derived Indicator Config"
Cohesion: 0.07
Nodes (37): clearAppointment(), dbQuery(), rpcAs(), setCapabilities(), signInAs(), signOut(), ADR-0083, ADR-0134 (+29 more)

### Community 41 - "Meeting Attendees & Quorum"
Cohesion: 0.05
Nodes (77): collectInstances(), collectScope(), topLevelItems(), CHOICE_TYPES, computeEffectiveVisibility(), computeInstanceVisibility(), EffectiveVisibility, INPUT_ITEM_TYPES (+69 more)

### Community 42 - "Hospital Detail Pages"
Cohesion: 0.11
Nodes (18): 1. DIFF TABLE — plan-named vs. reality, 2. Section A — catalog enumeration, 3. Section B — code enumeration, 4. Section C — keystone state (`supabase/tests/328_dm1_document_substrate.sql`), 5. What this changes for the DM4 plan, 6. Uncertainties / not verified, A1. Routines referencing referral/attachment/snapshot/frozen/case-documents/storage_path, A2. Policies (all schemas) touching these identifiers (+10 more)

### Community 43 - "Narrative Templates"
Cohesion: 0.05
Nodes (72): ComposerMode, CaseEventKind, getReferralPatient(), beginReferralReplyAttachmentUpload(), finalizeReferralReplyAttachmentUpload(), openReferralReplyAttachment(), openReferralSnapshotDocument(), revealReferralPatient() (+64 more)

### Community 44 - "Event Notification & Triage"
Cohesion: 0.17
Nodes (9): ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume), Consequences, Context, Decision, RLS audit, ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures), Consequences, Context (+1 more)

### Community 45 - "Page"
Cohesion: 0.09
Nodes (23): Acceptance criteria (phase gate), B0 — Preflight ✅ DONE 2026-08-06 (lead), B1 — Migration 1: storage + table (backend), B2 — Migration 2: RPCs, doors, audit, flag (backend), B3 — Types (backend), B4 — Generic audio-jobs client `src/lib/audio-jobs/` (backend, D18), B5 — Meeting module `src/lib/minutes-jobs/` (backend), B6 — Webhook `src/app/api/webhooks/audio-jobs/route.ts` (backend, D10/D18) (+15 more)

### Community 46 - "Page"
Cohesion: 0.06
Nodes (29): addMultipleChoice(), addQuestion(), advance(), ariaInvalid(), blockCard(), createForm(), enterWizard(), field() (+21 more)

### Community 47 - "Layout"
Cohesion: 0.17
Nodes (6): createMeeting, MEMBERS, seedExpectedAttendees, seedSelectedAttendees, TYPES, updateMeeting

### Community 48 - "Page"
Cohesion: 0.15
Nodes (13): 0045 — Answer-Model v2 (uniform answer entity, typed scalar columns, instance-ready keys), Alternatives rejected, Consequences, Context, Decision, Delivery, Evaluator parity — the hard invariant (Rule 3), Immutability & RLS (+5 more)

### Community 49 - "IsTerminalMeetingStatus"
Cohesion: 0.07
Nodes (51): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createHelmetManager() (+43 more)

### Community 50 - "Page"
Cohesion: 0.05
Nodes (42): 2026-09-08 — the ceiling MOVES to 759 by PO ruling (Batch 7 ruling R24), 2026-09-08 — the seven are ATTRIBUTED, function by function (Batch 7, `PRIVILEGE-SURFACE`), Admin arm follows account state; the Class-2 write arm relocated; the audit stamp logs role only (2026-09-10, ADR 0201 D4/D5 + R10, migration `20261003007390`), AE3 — restricted personal details leave `profiles` (2026-08-31; ADR **0155** D4; migrations `20261003006600`–`…006800`, **3**; pgTAP `301` `plan(44)` · `359` `plan(30)` · `361` · `379` · `382` `plan(83)` · `385` · `386` · `393`; **NO flag — the migrations ARE the cutover**; QA r1 CHANGES REQUESTED → addressed, re-review owed) — ⛔ **NOT PUSHED: local only**, AE4 — the `authz` catalog exists, and THREE of 43 permissions are load-bearing (2026-09-03; ADR **0155** / **0162** §2 / **0172** / **0174** / **0175** / **0176** / **0177** / **0178** / **0180** / **0181** / **0182**; migrations `20261003007100`–`…007340`, **22**; pgTAP `401`–`414`, **14**; **NO flag — the migrations ARE the cutover**), AE5's opening decision — the keying asymmetry ratified as the model (2026-09-10, ADR 0201 + 0203, ⛔ NO migration), Arm 3 of the professional-profile read door is ORACLED, not merely exercised (2026-09-11, unit `AE5-MATRIX-ARM3-CELLS`; ADR **0175** D3 delivered · PO rulings **R1**/**R2**; ⛔ **NO migration** — vectors and pgTAP only), Audit read legs — AUD1 + the org-derivation class fix (2026-08-25; ADR **0149** + **0150**; migrations `20261003003000` + `20261003003100`, **2**; pgTAP `372` `plan(29)` · `373` `plan(22)`; **NO flag** — the migrations ARE the cutover) — ✅ **PUSHED 2026-08-25** (+34 more)

### Community 51 - "UserLifecycleActions"
Cohesion: 0.11
Nodes (38): RemindAction, RemindApproverButton(), ActionState, AddVersionState, approveDocument(), ApproverPayload, beginControlledVersionUpload(), BeginControlledVersionUploadInput (+30 more)

### Community 52 - "Page"
Cohesion: 0.05
Nodes (55): metadata, ADR-0133, ADR-0151, LiveBanner(), BlockerAction, blockerKey(), blockerLabel(), blockerNoun() (+47 more)

### Community 54 - "Section signoff fields"
Cohesion: 0.04
Nodes (58): count(), deriveFlowMetrics(), metadata, NspReferralsDashboardPage(), ADR-0042, ADR-0094, ReferralDashboardTable(), AGING_BUCKETS (+50 more)

### Community 55 - "ListMeetings"
Cohesion: 0.03
Nodes (65): ⛔ AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**, Archive — Follow-ups / Deferred Items (full snapshot incl. resolved), Closed 2026-07-05 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-07 (rotated out of PROGRESS live Follow-ups), Closed 2026-07-15 (rotated out of PROGRESS live Follow-ups — E0/E1 now COMPLETE), Closed 2026-07-18 (rotated out of PROGRESS live Follow-ups — AUDIT-DOOR-BLINDNESS now COMPLETE), Closes when, Follow-ups / Deferred Items (+57 more)

### Community 56 - "Page"
Cohesion: 0.10
Nodes (17): 0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema, conditionTargets widening (supersedes a prior decision), Consequences, Context, Decisions, 0086 — Flexible-Forms feature phases FF-1…FF-5 pulled pre-pilot, Consequences, Context (+9 more)

### Community 57 - "TitleAssignControl"
Cohesion: 0.02
Nodes (293): ADR-0065, AdminOrganizationsPage(), metadata, metadata, metadata, metadata, metadata, ADR-0104 (+285 more)

### Community 58 - "Condition builder"
Cohesion: 0.03
Nodes (86): CommissionReferralsPage(), metadata, CharterFormState, FREQUENCIES, saveCharter(), CharterPage(), formatDateOnly(), formatTimestamp() (+78 more)

### Community 59 - "Interview badges"
Cohesion: 0.07
Nodes (50): ADR-0082, CoreFileFacts, coreFileFor(), createDraftOnlyDoc(), NOTE: `.focus()` is deliberately NOT used — it is not auto-waiting, races RSC, ADR-0114, ADR-0118, uploadViaDetailForm() (+42 more)

### Community 60 - "Page"
Cohesion: 0.06
Nodes (38): AnswerSummary(), formatIsoDate(), OptionChip(), renderValue(), ADR-0090, ADR-0091, CollectedAnswers, InstanceAnswers (+30 more)

### Community 61 - "CaseActionItemForm"
Cohesion: 0.05
Nodes (39): 2026-09-07 — build (backend), 2026-09-07 — QA fix loop, iteration 1 (backend), 2026-09-07 — QA fix loop, iteration 2 (backend), 2026-09-07 — Record step, part 1 (lead): PO approved at `dab3cc87`; unit GATED pending Batch 3, 2026-09-07 — tip gate (lead, second machine) — run by someone other than the builder, 2026-09-07 — unit opened (lead, second machine), 2026-09-08 — Record step, part 2 (lead, dev machine): the MERGE session — rebased onto Batch 3 and the whole gate re-earned, Blockers (+31 more)

### Community 62 - "VersionWithUrl"
Cohesion: 0.12
Nodes (34): CloneFrameworkDialog(), SimpleCandidateSelect(), ActionState, cloneFramework(), CloneFrameworkState, createFramework(), CreateFrameworkState, deleteStandard() (+26 more)

### Community 63 - "UploadDialog"
Cohesion: 0.02
Nodes (139): metadata, PrimeiroAcessoPage(), metadata, OrgAdministratorsPage(), ADR-0051, ADR-0052, OrgCommissionDetailError(), metadata (+131 more)

### Community 64 - "Layout"
Cohesion: 0.04
Nodes (59): ADR-0059, VerificarPage(), lookup(), metadata, ADR-0104, ADR-0125, ADR-0126, VerificacaoResultadoPage() (+51 more)

### Community 65 - "Page"
Cohesion: 0.12
Nodes (16): Accepted (not independently reproduced), with the reason, Already-dispositioned, NOT re-filed, Answer to the handoff's question 4 — is keystones-only assurance sufficient for `attach_controlled_document_version_file`?, DM3 — Wave B: controlled documents · QA review (r1), INFO, MINOR, MINOR-1 — *"in no authz arm's domain"* is measurably wrong; the conclusion drawn from it is right, MINOR-2 — `DM3B-2` does not assert sha256; the file docstring says the round trip proves it (+8 more)

### Community 66 - "Case tags panel"
Cohesion: 0.04
Nodes (46): 10 · NOT TESTED / NOT COVERED, 11 · Itemized change list, 12 · What is unambiguously right, and should not be lost in the verdict, 1 · What I re-measured (every figure below is mine, not inherited), 2.1 The claim as written is TRUE, and it is recorded honestly everywhere, 2.2 ⛔ But the record is now FALSE in the other direction — and this is MAJOR-1, 2 · Attack 1 — the central honesty claim, 3.1 The fix is genuinely transaction-safe, and the guard genuinely refuses ✅ (+38 more)

### Community 67 - "Event type manager"
Cohesion: 0.17
Nodes (15): NotificationPreferencesForm(), ORDER, SURFACE_COPY, ADR-0076, markAllNotificationsRead(), markNotificationRead(), NotificationActionState, revalidateShell() (+7 more)

### Community 68 - "Page"
Cohesion: 0.04
Nodes (91): metadata, NspConfigPage(), ADR-0052, metadata, NspEventDetailPage(), metadata, NspInboxPage(), ADR-0042 (+83 more)

### Community 69 - "Page"
Cohesion: 0.06
Nodes (42): serviceQuery(), articleForShortCode(), auditRowsFor(), creatorMintFixture(), keyboardActivateAndCapturePopup(), listedResponseIds(), mintViaDialog(), myResponseDetailHref() (+34 more)

### Community 70 - "Phase result badge"
Cohesion: 0.03
Nodes (73): 0061 — "Administrativo" delegated-capability role (per commission), Alternatives rejected, Amendment 1 — a fifth capability, `read_cases`, and a management surface, Consequences, Context, Decision, Everything in this record has now LANDED locally — and that is not completion, ⛔ The PHI note is now HALF TRUE — corrected 2026-08-22, in the commit that made it so (+65 more)

### Community 71 - "Wizard runner"
Cohesion: 0.06
Nodes (58): ADR-0123, saveAndExit, saveSection, signSection, submitCasePhaseResponse, submitResponse, ADR-0136, ADR-0085 (+50 more)

### Community 72 - "Case timeline"
Cohesion: 0.08
Nodes (24): 0. Scope at a glance, 1. Design-system translation (doc `mm.css` → platform tokens), 2. Backend workstream (contract-first — lands before FE), 3. Frontend workstream (all on platform tokens/shadcn; Server-first), 4. Notifications workstream (Phase-20 substrate — currently zero doc integration), 5. Sequencing & file ownership, 6. Test plan (Phase Gate §6), 7. Open micro-decisions (resolve at build start; low-stakes) (+16 more)

### Community 74 - "Page"
Cohesion: 0.06
Nodes (45): documentSourcePhrase(), formatDateTimePtBr(), KIND_SOURCE_PHRASE, mintDialogDescriptionCopy(), noPrintedDocumentsCopy(), previaHref(), printedDocumentsIntroCopy(), printedDocumentsLoadErrorCopy() (+37 more)

### Community 75 - "Actions"
Cohesion: 0.04
Nodes (87): AVAILABILITY_PRESENTATION, AvailabilityPresentation, CapaEvidenceUpload(), CapaEvidenceList(), CapaEvidenceRow(), ADR-0114, MAX_SIZE_MB, NSP_EVIDENCE_ALLOWS_OPEN (+79 more)

### Community 76 - "Components.json"
Cohesion: 0.05
Nodes (40): ADR 0009 — Local JWT verification for the auth gate & identity, Consequences, Context, Decision, Rationale, 0010 — Denormalize email onto public.profiles, Consequences, Context (+32 more)

### Community 77 - "Page"
Cohesion: 0.09
Nodes (22): BLOCKER, Findings (iteration 1 — context; M1/M2a/I1 now resolved per the table above), I1 — `dispose_case_phi` carries a bare `is_admin()` cross-tenant PHI-erasure arm (pre-existing; out of this phase's two-module scope — flagged for the pending scope decision), I2 — `patient_xref_select_pqs` RLS / `can_read_xref_row` are dead for `authenticated` (defense-in-depth only); design §D item 7 is untestable as written, I3 — `is_admin` sweep summary (every live occurrence, classified), Independent verification (probes I ran), INFO, Iteration-2 delta verdict (all resolved at iter-3) (+14 more)

### Community 79 - "Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, class-variance-authority, clsx, date-fns, gsap, lucide-react, next, pdf-lib (+17 more)

### Community 80 - "Loading"
Cohesion: 0.04
Nodes (44): 1.1 ADR 0134 Increment-2 obligations (the "Obligations" section), 1.2 Amendment 2 §A2.5 (the option-D bill), 1.3 Amendment 4 §A4.3 (six items, not five), 1.4 Amendment 5 §A5.3, 1.5 Amendment 6 §A6.4 and Amendment 7 §A7.4, 1.6 Amendment 2 §A2.6 (records that must change in the same commit), 1.7 Plan §4 "E2E (tester)" — the five UI obligations, 1. Obligation → evidence (+36 more)

### Community 81 - "Loading"
Cohesion: 0.05
Nodes (37): 2026-09-08 — backend, second-pass repairs: two decided-but-stale plan clauses, three rotted gate counts, and a corpus gap, 2026-09-08 — backend, Track A: the three-head run, the attribution, and the full AE1 re-derivation, 2026-09-08 — backend, Track B: the config-line gate (gate 14), its two failure texts, and two findings the build turned up, 2026-09-08 — backend, Track C: the three unproven grants traced, the ceiling moved by ruling, §U4–§U6, and gate 15, 2026-09-08 — backend, Track D: repointing the rotted `config.toml:13` citations (R30) and the 137→138 dated note (R26), 2026-09-08 — FINAL gate at the tip `d428d515` (independent runner), 2026-09-08 — fix loop 4, `backend`'s three of the tip gate's six findings (1, 4, 6), 2026-09-08 — gate at the tip (independent runner) (+29 more)

### Community 82 - "Route"
Cohesion: 0.07
Nodes (73): anchorExistsInArchive(), anchorKey(), archiveEntrySections(), ARMS, blankCode(), BUG_CLOSED_STATUS, BUG_COLUMNS, BUG_STATUS (+65 more)

### Community 83 - "ActionItemRow"
Cohesion: 0.10
Nodes (36): CaseParticipantRoleDialog(), CaseParticipantRoleManager(), EMPTY_ROLE_INPUT, ADR-0108, CaseTypeDialog(), EMPTY, ADR-0064, CaseTypeTerminologyDialog() (+28 more)

### Community 84 - "CaseActionItemsPanel"
Cohesion: 0.21
Nodes (23): EventTypeManager(), SentinelCriterionManager(), draftFromTriage(), TriageWorkstation(), VocabActions, VocabManager(), mapTriageError(), archiveEventType() (+15 more)

### Community 85 - "Case document delete"
Cohesion: 0.05
Nodes (39): signInAs(), ADR-0151, getToken(), insertItem(), openAddBlock(), OptionSpec, rpc(), signInAs() (+31 more)

### Community 86 - "Gantt axis"
Cohesion: 0.12
Nodes (16): 0. Substrate facts — catalog-verified 2026-08-25, 1. ✅ RESOLVED — the content-drift decision (ADR 0144 D15), 2.1 `backend` — migrations, 2.2 `backend` — pure renderer, `src/lib/pdf/`, 2.3 `backend` — provider + payload, 2.4 `frontend` — the mint surface, 2.5 `tester` — E2E, 2.6 `qa` — review (+8 more)

### Community 87 - "Tsconfig.json"
Cohesion: 0.18
Nodes (11): 10. Risks and what I could NOT verify, 2. Local vs production reconciliation state, 4. S2.8 disposition — explicit, as required, 6. Keystones — new suite `330_dm3_controlled_documents.sql`, 7b. Hand-off notes for the frontend / tester slices (verified, not adopted on trust), 8. Where the catalog contradicts the plan doc / ADRs, 9. Rulings (all six closed by the lead, 2026-08-13), DM3 — Wave B: controlled documents (+ the ethics document seams) (+3 more)

### Community 88 - "Active Cases Table"
Cohesion: 0.13
Nodes (20): Active Cases Table, Case Review Lifecycle (screening → agenda → review → action items → closed), Case Row (MM-2026-xxxx, patient, event, service, harm, preventability, lead, status), Harm Severity Badge (Death / Permanent / Temporary / Near miss), KPI: Awaiting screening (7), KPI Card Row (top metrics strip), KPI: Closed YTD (38), KPI: On next agenda (4) (+12 more)

### Community 89 - "DevDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, eslint-config-next, @fontsource/ibm-plex-mono, @fontsource/ibm-plex-sans, @fontsource/ibm-plex-serif, jsdom, @playwright/test (+16 more)

### Community 90 - "Page"
Cohesion: 0.05
Nodes (40): 1.1 Source, 1.2 The named gap: `staff_admin` / `staff`, 1.3 Why this table is really a *by-role* table, not a *by-precedence* table, 1. The role → landing-route table (extracted, not invented), 2.1 What the plan assumes, 2.2 What is actually in the codebase: two independent chains, 2.3 The gap this creates for the picker, 2.4 Where the picker step inserts (assuming §7's Q1 resolves toward "one decision point") (+32 more)

### Community 91 - "Recommend when editor"
Cohesion: 0.05
Nodes (42): 10. Findings, 1.1 `case_phases` carries status/assignee/recommended only — never answers, 1.2 Coordinator board reads (`list_cases_board` / `get_case_detail`), 1.3 `case_phase_answer_map` is submitted-only, 1.4 `recompute_recommendations` is submitted-only end-to-end, 1.5 `responses_select` / `answers_select` not broadened, 1.6 RLS check in the E2E suite, 1.7 Service-role key not reachable client-side (+34 more)

### Community 93 - "Page"
Cohesion: 0.15
Nodes (36): CaseNarrativeDelete(), addAdHocNarrative(), addTemplateNarrative(), archiveNarrativeType(), assignNarrative(), authorizeCommission(), authorizeCommissionConfig(), CaseLayoutOrderItem (+28 more)

### Community 94 - "Page"
Cohesion: 0.06
Nodes (36): 2026-09-08 — build: four parallel streams, and the corrections each one forced (lead + backend), 2026-09-08 — gate at the tip (lead, run by someone other than the builder), 2026-09-08 — PO ruling on the `DSR` ledger row (lead, recorded before it is applied), 2026-09-08 — QA fix loop 4 (lead): the SEVENTH, and why it differs from the other six, 2026-09-08 — QA fix loops 1 and 2 (lead), 2026-09-08 — Record step (lead): PO approved, round 5 SKIPPED by decision; unit closed, 2026-09-08 — unit opened (lead), A sixth defect, found by the act of opening the unit — gate 13 could not pass on Windows (+28 more)

### Community 95 - "Page"
Cohesion: 0.05
Nodes (40): 1. Requirements Audit (PHASES.md §Phase 5), 2. Security / RLS Audit (Architecture Rule 1 + Rule 3), 3. Code Quality (Architecture Rule 9 + CLAUDE.md §8), 4. UX & Accessibility (CLAUDE.md §8, Architecture Rule 7), 5. Hygiene, 6. Findings, 7. Scope Deferrals Confirmed (Not Findings), 8. RLS Verification Summary (+32 more)

### Community 96 - "Page"
Cohesion: 0.05
Nodes (69): AcknowledgeButton(), CancelButton(), ReopenButton(), AnalysisStage(), SubView, Tab(), CatBlock(), Fishbone() (+61 more)

### Community 97 - "ActionItemForm"
Cohesion: 0.15
Nodes (12): 11. Risk register, 12. Mapping from current to target concepts, 13. Decisions that require product approval, 15. Audit limitations, 16. Final recommendation, 17. References, 1. Scope and audit questions, 8. Implementation scope (+4 more)

### Community 98 - "Referral patient fields"
Cohesion: 0.07
Nodes (52): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createHelmetManager() (+44 more)

### Community 99 - "ClampCalloutCenter"
Cohesion: 0.05
Nodes (40): 1. Freeze the current cutover, 2. Reconcile the authority documents, 3. Establish three distinct interfaces, 4. Make state and selection real, 5. Replace hand partitions with one generated enforcement manifest, 6. Simplify before scaling, 7. Rebuild evidence around the final path, Authorization evolution implementation audit (+32 more)

### Community 100 - "Actions"
Cohesion: 0.07
Nodes (39): ADR-0176, ADR-0193, arr(), AXIS_ORDER, CANONICAL, cellId(), { cells, skipped }, collapsedBy() (+31 more)

### Community 105 - "Page"
Cohesion: 0.12
Nodes (45): ActionState, AddPhaseState, addTemplatePhase(), archiveProcessTemplate(), archiveTemplateVersions(), authorizeCommission(), beginTemplateEdit(), boolFromForm() (+37 more)

### Community 106 - "Outcomes actions"
Cohesion: 0.07
Nodes (24): Axis, blockCard(), cellsOf(), CONFORMIDADE_COLS, CONFORMIDADE_ROWS, createForm(), enterWizard(), FixtureForm (+16 more)

### Community 108 - "Audit motion"
Cohesion: 0.05
Nodes (37): 1. What I probed, and the safety record of doing it, 2. Requirements audit — S3's six deliverables against the catalog, 3. Findings, 4.1 D12's conjunction, **both** directions, with a positive control first, 4.2 Authority lost or gained in the rebuild — ACLs in **both** directions, 4.3 Rule 12 / PHI — the tier cannot be forged, and reads are audited, 4.4 The five write guards — every one differential, 4.5 D13's separation, and the `add_referral_shared_item` risk it exists to close (+29 more)

### Community 109 - "CaseTagsPanel"
Cohesion: 0.05
Nodes (38): ↩ Body rotation 2026-08-24 (ADR 0140) — resolved bodies moved out of follow-ups.md, 🟡 FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE — the `member_can` disjunct has no reachable fixture (owner: backend/tester; filed 2026-08-21, QA r3 §8.3), ⬛ FUP-ADR-AMENDMENT-HAS-NO-BACK-POINTER — ✅ **RESOLVED 2026-08-24** — an amended ADR reads as live, and only the amending ADR knows (owner: lead; filed 2026-08-23 at the AFF2 post-Record documentation review), ⬛ FUP-AUTHZ-ALLOWLIST-ROT — ✅ **RESOLVED 2026-08-17.** A resolve-in-`pg_proc` check now runs inside `ARM=floor`; it found **SIX** stale entries where this item named one (owner: lead + backend; filed 2026-08-14, DM5 S2), ⬛ FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER — ✅ **RESOLVED 2026-08-24, PO ruling: DELETED** (owner: PO + frontend), 🟡 FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT — the UI boolean cannot express the door's per-phase assignee arm (owner: frontend/PO; filed 2026-08-21, case-surface-split Increment 1, QA F-6; ✅ **RESOLVED 2026-08-22 — PO ruled WIDEN; delivered as a KIND + a server-gate fix**; two residues filed separately; index line rotated → [follow-ups-archive.md](follow-ups-archive.md)), 🟡 FUP-CASE-T5-MEUS-CASOS-UNREPOINTED — T5 shipped narrower than its own text (owner: frontend; filed 2026-08-21, QA F-7; ✅ **RESOLVED 2026-08-22 — PO ruled the behaviour right and the PLAN TEXT wrong**; T5 clarified, index line rotated → [follow-ups-archive.md](follow-ups-archive.md)), 🟡 FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED — the case-wide affordance class has **no absence assertions on `/casos`** (owner: tester; filed 2026-08-21; ✅ **RESOLVED — MERGED to local `main` 2026-08-22 (`be546bbf`)** — see § Resolution; index line rotated → [follow-ups-archive.md](follow-ups-archive.md); ⛔ **WRONG TWICE, corrected twice — read the history, it is the point of this entry**) (+30 more)

### Community 110 - "DepartmentDefDialog"
Cohesion: 0.05
Nodes (47): ReferenceConfigEditor(), ADR-0091, isCaseScopedOnlyLane(), LaneCopy, reachesCaseScopedLane(), REFERENCE_LANE_COPY, referenceKindLabel(), ADR-0091 (+39 more)

### Community 111 - "ADR 0050"
Cohesion: 0.05
Nodes (31): 0083 — Case Custom Fields (Template-Defined Administrative Descriptors), Consequences, Context, Data model, Decisions, Deferred (out of scope), The concrete surface (for the build phase), 0084 — Bulk Case Creation ("Múltiplos casos") (+23 more)

### Community 115 - "Page"
Cohesion: 0.03
Nodes (44): saveMinimalReferralPatientForSend(), serviceKey(), clickNextPage(), getOwnerToken(), signInAs(), ADR-0106, ADR-0137, advanceToInReview() (+36 more)

### Community 116 - "Audit feed"
Cohesion: 0.08
Nodes (34): AVAILABILITY_ICON, DocumentAvailabilityBadge(), DocumentConfidentialityBadge(), DocumentKindBadge(), DocumentNoVersionBadge(), DocumentPhiBadge(), ADR-0072, DocumentDeleteButton() (+26 more)

### Community 117 - "Browser"
Cohesion: 0.08
Nodes (25): 0078 — Authorization capability model: case capabilities, granular grants, meeting boundary & referral write-gate, Claims that did NOT survive verification (recorded to prevent re-litigation), Consequences, Context — what verification actually found, D10 — Write arms: preserve today's narrower behaviour (a deliberate divergence), D11 — Capability sources, including **the member arm** (the crux), D12 — Terminology: docs only, D13 — Process, SQLSTATEs, audit (+17 more)

### Community 120 - "AdminAuditPage"
Cohesion: 0.06
Nodes (33): 2 · KEEP LIST — unchanged from v2 (`qa`-verified both directions, 0 over-reach), 3 · INVENTORY BY PATH KIND — v2's §3.1–§3.7 stand, with these v3 edits, 4.1 · C8 — the disproof **holds on its legs; its scope was wrong**, 4 · STRUCTURAL SURFACES, 5.1 · PO / lead rulings open, 5 · CONTRADICTIONS + OPEN RULINGS, 7.1 · The five live probes (each `ROLLBACK`ed; persistence re-verified = 0 leaked), 7 · THE EXACT QUERIES (Q1–Q15 unchanged from v2; new below) (+25 more)

### Community 121 - "Page"
Cohesion: 0.05
Nodes (36): 0. Section A — REGISTRY SANITY (gate for everything below), → **141 at HEAD (`f804a03f`).**, 1. DIFF TABLE — plan-named vs. reality (the headline), 2.1 `rca_evidence` — full column list **[catalog]**, 2.2 `add_rca_evidence` — signature, ACL, body **[catalog]**, 2.3 pgTAP `328` keystone K8b — quoted verbatim **[code]**, 2.4 The `nsp-evidence` bucket **[catalog]**, 2.5 The NSP hard exclusions and PQS custody predicates **[catalog]** (+28 more)

### Community 122 - "Page"
Cohesion: 0.04
Nodes (85): loadMeasurementHalf(), metadata, ADR-0100, ActionItemFallbackDialog(), CapaAffordance(), CreateManualAction, OpenCapaAction, isPqsOperatorOfIndicatorHospital() (+77 more)

### Community 123 - "BlockConditionNote"
Cohesion: 0.06
Nodes (35): ACT — "act as" STRICT ROLE ASSUMPTION (2026-08-10; ADR 0106 D1–D14; migrations `20260918000000`–`…002800`; **NO flag — the migration IS the cutover**, PO-locked P4), ADR 0166 — the demotion backstop, `HC0RB`, ADR 0167 Amdt 2 — the commission `staff` sub-arm, ADR 0168 — affiliation is THREE doors, not one, ADR 0168 Amdt 3 — the FIRST deliberate asymmetry between a door and its `_for` twin, AE2 — affiliation tenancy: the anchor column is GONE (2026-08-28; ADR **0161** / **0163** / **0164** / **0165** / **0166** / **0167** +Amdt 2 / **0168** +Amdt 1–3; migrations `20261003005400`–`…006500`, **12**; pgTAP `390`–`400`, **11**; **NO flag — the migrations ARE the cutover**; QA APPROVED r3 → [authz-ae2-review-r3.md](../reviews/authz-ae2-review-r3.md)), AFF2 — affiliation-scoped administration (2026-08-23; ADR **0133** + **Amendments 1–4**; migrations `20261003001000`–`…001200`, **3**; pgTAP `359` `plan(18)` · `360` `plan(21)` · `361` `plan(24)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**, AFF4 — organization affiliation, per-hospital staff data, the voided tense (2026-08-26; ADR **0151** D1–D17 + **0154** / **0158** / **0159**; migrations `20261003003200`–`…004300`, **12**; pgTAP `301`–`304` · `371`–`375` · `377`–`381`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ⛔ **NOT PUSHED at the Record edit; 12 migrations are LOCAL ONLY** (+27 more)

### Community 124 - "ConfirmDeleteButton"
Cohesion: 0.06
Nodes (49): CaseCustomFieldChips(), ADR-0083, ACTIVE_OR_PENDING, activePhases(), BoardPhase, ADR-0136, blockedBy(), BoardPhase (+41 more)

### Community 125 - "Format"
Cohesion: 0.02
Nodes (202): metadata, NarrativeEditorPage(), ADR-0033, ADR-0100, ADR-0134, ADR-0137, metadata, roleFromCapabilities() (+194 more)

### Community 127 - "ADR 0028"
Cohesion: 0.05
Nodes (57): allowedRuleTypes(), blankDraft(), dateRangeInputType(), DATETIME_ORDER_OP_LABELS, datetimeOrderTargets(), itemAcceptsValidations(), nextKey(), regexCompilesInJs() (+49 more)

### Community 129 - "Corrective Action (PDCA tracked)"
Cohesion: 0.06
Nodes (34): 0. Method, and what it is worth, 1. Requirements audit — D1–D14, 2. Security / RLS — from the catalog, 3. Code quality, 4. Required changes, 5. Open risks — for the PO to weigh, 6. Could not verify, `BUG-E2E-CORRECTIONS-KBD-FOCUS` — the attribution reasoning holds (+26 more)

### Community 135 - "Scripts"
Cohesion: 0.04
Nodes (45): scripts, adr:index, build, data-access:surface, db:link, db:push, db:reset:linked, dev (+37 more)

### Community 136 - "Form builder condition engine enhancements"
Cohesion: 0.06
Nodes (35): 1. Requirements Audit — the 8 Locked Decisions, 2. Security / RLS / PHI Review, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, Accessibility, ADR exists for non-trivial choices, `can_read_case_patient` wraps the live `can_read_case` (+27 more)

### Community 139 - "Meeting form dialog.test"
Cohesion: 0.13
Nodes (29): StepConfirm(), StepDocument(), DerivedDocStatus, DerivedStatusChip(), DocumentStatusChip(), DocumentTypeBadge(), ObsoleteKindChip(), ReviewOverdueChip() (+21 more)

### Community 142 - "ADR 0052 NSP per hospital"
Cohesion: 0.06
Nodes (37): buildCards(), CommissionHomePage(), ConfigurationCardData, formatNextMeeting(), metadata, OverviewCardData, ADR-0100, metadata (+29 more)

### Community 146 - "Page"
Cohesion: 0.09
Nodes (44): CaseTagsPanel(), TagReportCardAsync(), ActionState, archiveCaseOutcome(), authorizeCommission(), authorizeCommissionConfig(), commissionOfCase(), commissionOfOutcome() (+36 more)

### Community 147 - "Page"
Cohesion: 0.08
Nodes (49): AiAvatar(), AiAvatar(), ResolveLinkageDialog(), At(), be(), Ce(), constructor(), coolingDown() (+41 more)

### Community 148 - "Title badge"
Cohesion: 0.08
Nodes (40): metadata, ReferralDetailPage(), ADR-0094, ADR-0114, ADR-0130, metadata, TechnicalDirectionReferralsPage(), ADR-0094 (+32 more)

### Community 149 - "Options editor"
Cohesion: 0.10
Nodes (32): AssigneeAvatar(), BulkCreateAction, BulkMember, BulkTemplateOption, memberName(), PhaseScope, BulkChecklistItem, BulkCreateWizard() (+24 more)

### Community 150 - "Titles"
Cohesion: 0.06
Nodes (33): 1 · Method, and what I did to the stack, 2 · What I independently re-proved (the part that is NOT taken on trust), 2a · The four S5.R acceptance items are load-bearing — **measured by neutralization**, 2b · Both gap keystones go RED if someone wires the disposal job — **reproduced**, 2c · Catalog facts behind the record and the runbook — all verified live, 2d · Every gate figure in the record reproduces at HEAD on my own run, 3 · ⛔ BLOCKING (2 MAJOR), 4 · The five questions I was asked (+25 more)

### Community 151 - "Architecture Rules (binding)"
Cohesion: 0.06
Nodes (63): addAgendaItem(), addAttendee(), buildDoneCallback(), buildErrorCallback(), callRPC(), createHeldMeeting(), deleteMeeting(), DoneCallbackRefs (+55 more)

### Community 156 - "ADR 0048 — User Registration & Identity"
Cohesion: 1.00
Nodes (3): /auth/confirm Server-Side Handler (verifyOtp token_hash + type), Invite Email Template (pt-BR), Password-Recovery Email Template (pt-BR)

### Community 157 - "Page"
Cohesion: 0.06
Nodes (34): 0144 — Printing Cases (ADR 0104 P3): the dossier, its lock point, and the PHI fork, Alternatives rejected, Amendment 1 — D7's two series are carried by `template_key`, not by a variant column (2026-08-25), Amendment 2 — the de-identified variant reads through the audited door; a bounded A7 exception (2026-08-25), Amendment 3 — D13's running header, and the first section's page break (2026-08-25), Amendment 4 — D4's counter cannot live on `cases` (2026-08-25), Amendment 5 — D6 is constitutive, not derived: `contains_phi := !caseDisposed` (2026-08-25), Amendment 6 — D9's pinning claim is false, and pgTAP cannot make it true (2026-08-25) (+26 more)

### Community 158 - "Page"
Cohesion: 0.06
Nodes (35): 0. Headline, 1. Method — what I measured, and how, 2. Blocking findings, 3. Major findings (non-blocking, all should land with the blocking fixes), 4. Recommendations (no action required for approval), 5. The eleven review questions, answered, 6. Could-not-verify list (each of these is a work item, not a clearance), 7. Disposition for the PO (+27 more)

### Community 159 - "OrgAuditPage"
Cohesion: 0.06
Nodes (34): 10.1 The mechanism the whole analysis turns on, measured rather than reasoned, 10.2 Verdict — `app.person_has_active_org_affiliation(uuid, uuid)` → **REQUIRED**, 10.3 Verdict — `public.recover_orphan_person_to_org(uuid, uuid, date)` → **REQUIRED**, 10.4 Verdict — `app.is_affiliated_with_hospital_for(uuid, uuid)` → **UNNECESSARY**, 10.5 The bound — what this analysis does NOT establish, 10. The three unproven grants — a reachability analysis (Batch 7 ruling R25, 2026-09-08), 1. The four buckets, and why there are four and not two, 2.0 Re-verification at head `20261003005300` — predicates hold, four citations had drifted (+26 more)

### Community 164 - "Action Items Data Model Handoff"
Cohesion: 0.06
Nodes (32): 1.1 · The one that nearly fooled me — recorded, because it is the lesson, 1.2 · Delegation cannot be resolved statically — the lead's cautionary datum, generalized, 1 · The P0s — CONFIRMED DEAD, behaviourally, 2.1 · The proof — mutation testing, 2.2 · Why — and §W-6 named it in advance, 2.3 · The fix — one line, verified, 2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING), 3.1 · `HC0G` → `HC0F` — ✅ **CORRECT, and the codes are internally consistent** (+24 more)

### Community 170 - "Rca window form"
Cohesion: 0.12
Nodes (16): ADR 0186 — Documentation consolidation: one home per fact, one summary and one log per unit, Consequences, Considered options, Context, D1 — One projection of hub frontmatter, D2 — PROGRESS.md carries one link, not a roll-up, D3 — One summary and one log per unit; the handoff is a resume pointer, D4 — The follow-up register is an index; bodies are files (+8 more)

### Community 177 - "ADR 0013 — form versions INSERT RLS Fix"
Cohesion: 0.06
Nodes (33): B1 ⛔ The fifth sibling-axis split, and it is live application code: `addStaff` still gates on the column the picker was moved off, B2 ⛔ ADR 0165's "materially wider" hospital-tier widening is unmeasured: `393` § 5 holds the ACTOR axis constant, B3 ⛔ The four highest-risk widening cells prove only "the door did not raise", never that a row was written, B4 ⛔ Architecture Rule 13's keystones are unguarded: `394` § 9.2 and `390` § D10 can both pass because there was nothing to share, B5 ⛔ "administrable by `platform_admin` alone" is false against the shipped doors — it is **nobody** — and the claim stands in four documents, B6 ⛔ Phase Gate step 1: the increment that is a hard gate on the drop has no ARM evidence, and `PROGRESS.md` states figures the increment did not produce, Blocking, Checked and found sound (+25 more)

### Community 178 - "Page"
Cohesion: 0.06
Nodes (34): 0. Scope, 1. Sequencing & dependency stages, 2. Collision matrix — where two tracks touch one schema surface, 3.1 SQLSTATE block allocation (above the live high-water **HC098**; Referrals holds **HC0A0–HC0A9**), 3.2 Feature-flag plan (mechanism: hand-maintained `FeatureFlags` interface + `get_feature_flags()` RPC), 3.3 Cross-cutting conventions (recorded once), 3.4 Specs still to author at S0 (ADR 0071 §Consequences), 3. Design spine — ratified at the S0 gate (+26 more)

### Community 179 - "Phase result options"
Cohesion: 0.07
Nodes (40): Home(), ADR-0051, ADR-0052, ADR-0106, camelHospital(), partitionGrants(), commission(), commissionGrant() (+32 more)

### Community 180 - "Document editor"
Cohesion: 0.06
Nodes (31): 1.1 Table existence, 1.2 RLS policies on the five meeting tables (SELECT + the FOR ALL write policies), 1.3 The `FOR ALL` PERMISSIVE inventory (case / meeting / action-item surface — the §7.6 blind spot), 1.4 Functions — `prosecdef` (a DEFINER's gate REPLACES RLS — §7.2·6), 1.5 Storage policies (meeting bucket) & RPC ACLs, 1. Verified catalog snapshot of the current Stage-C surface, 2. Ordered migration-sequencing plan (one attributable migration per unit), 3. A26 resolution → the C5 propriety-tier predicate + the `case_id IS NULL` branch (+23 more)

### Community 198 - "Layout"
Cohesion: 0.29
Nodes (5): ibmPlexMono, ibmPlexSans, ibmPlexSerif, metadata, viewport

### Community 199 - "AttachmentLinkForm"
Cohesion: 0.06
Nodes (34): 2026-09-09 — build turn: ADR 0201 + ADR 0203 written; SEVEN re-measurement findings, one of them against the LEAD (backend, then lead spot-check), 2026-09-09 — `FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN`: condition met and proven (lead), 2026-09-09 — live-catalog evidence for both authz clauses; PO ruling R3 taken; R4 put back for confirmation (lead), 2026-09-09 — plan received (backend/Opus, plan-only turn); lead spot-check; three PO questions framed (lead), 2026-09-09 — PO ruling R10; lead half built (item 6, plan sizing, two censuses, the arm-3 unit) (lead), 2026-09-09 — PO rulings R4, R5, R6; and ⛔ R4's stated rejection reason for Option 2 is REFUTED (lead), 2026-09-09 — PO rulings R7, R8, R9; and R8's audit-scope obligation measured, not quoted (lead), 2026-09-09 — the PO-supplied Class-2 document verified claim by claim; corrected in BOTH directions (lead) (+26 more)

### Community 208 - "AuditFeed"
Cohesion: 0.06
Nodes (30): Backend (`backend`), Follow-ups (non-blocking — see PROGRESS Follow-ups), Frontend (`frontend`), Gate exec (lead, 2026-06-22), Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`), Summary, Accepted Follow-ups (non-blocking; record at §6 Record step), ADR (+22 more)

### Community 209 - "InterviewLifecycleActions"
Cohesion: 0.06
Nodes (31): 1. Requirements / Deliverables, 2. Security / RLS, 3. Code Quality, 4. UX and Accessibility, 5. Hygiene, ADR coverage, Baseline security fix, Commission picker (`/c/page.tsx`) (+23 more)

### Community 210 - "Avatar stack"
Cohesion: 0.15
Nodes (12): Actual behavior, Expected behavior, Fix, Impact, Investigation, Lesson, Regression protection, Related code (+4 more)

### Community 212 - "App.member can (flag aware capability kill switch)"
Cohesion: 0.07
Nodes (37): ADR-0069, metadata, ReviewDuePage(), ApprovalDecisionBadge(), ApprovalsPanel(), APPROVAL_DECISION_LABELS, ApprovalDecision, ControlledDocument (+29 more)

### Community 214 - "Bug Log Archive (resolved/closed bugs)"
Cohesion: 0.16
Nodes (15): CaseTimeline(), TimelineEventSheet(), TimelineLegend(), buildQuery(), OPTIONS, TimelineView, TimelineViewSwitch(), EventIcon() (+7 more)

### Community 218 - ".prettierrc.json"
Cohesion: 0.18
Nodes (11): 0043 — Result-based phase recommendation (combinable `recommend_when`), Alternatives rejected, Consequences, Context, Contract (`recommend_when`), Decision, Delivery, Evaluation — zero evaluator drift (Architecture Rule 3) (+3 more)

### Community 219 - "Audit icon"
Cohesion: 0.07
Nodes (49): CaseBulkGrid(), formatRowList(), GridCell(), GridRowView, MappingRow(), PasteMappingPanel(), RowInvalid, truncate() (+41 more)

### Community 220 - "Title assign control"
Cohesion: 0.06
Nodes (31): 22. Key Design Decisions and Justifications, Decision, Decision 10 — Audit both reads and writes for sensitive cases, Decision 1 — Replace patient-centered case ownership with generic committee cases, Decision 2 — Add `case_types`, Decision, Decision, Decision (+23 more)

### Community 222 - "CaseEvent Data Model"
Cohesion: 0.06
Nodes (31): 10. Process note — gate ordering, 11. Verdict, 1. Summary of pass 1, 2. Finding C-1 — the Art. 18 hole the Amendment 2 argument stopped one step short of, 3. Finding C-2 — P3 opens a server-side fetch surface, and the module that would have caught it still says otherwise, 3b. Finding C-3 — three D14 floor items are not delivered, and D9 states one of them is, 4. Finding M-1 — the disposal migration cites a formula the provider does not implement, 4b. Finding M-3 — "a PHI mint emits both rows" is proven by coincidence, not by causation (+23 more)

### Community 226 - "Email Denormalization on Profiles (M9)"
Cohesion: 0.06
Nodes (31): AFF-era closed bugs (rotated from PROGRESS.md 2026-08-06 at the AFF Record), Archive — Bug Log (resolved & closed), BUG-ETHE4-FOCUS-1 (rotated from PROGRESS.md 2026-08-12, closed at rotation), Bug Log closure narratives rotated from PROGRESS.md 2026-08-18 (the size rotation), BUG-QO-001 (rotated from PROGRESS.md 2026-08-08 — CLOSED in-phase by M8+M9), BUG-REFNOTE-001 — DEFINER doors returned the unmasked `body_md` past the column GRANT, ↩ Closed 2026-08-20 — DSR Slice 3 (10 bugs), VERBATIM apart from the link repoint, Rotated 2026-08-08 at the PDF·P2 Record step (+23 more)

### Community 228 - "Package.json"
Cohesion: 0.08
Nodes (24): 1. What I measured myself (not read off the record), 2. AC-by-AC, 3. The record's mutation proofs, re-earned on my own copies, 4. Findings, 5. Notes (no action required; recorded so they are not re-derived), 6. Mutation QA-1 — the measurement behind MINOR-3, 7. Security / gate-integrity audit, 8. Records (+16 more)

### Community 229 - "Page"
Cohesion: 0.07
Nodes (29): 0 · CAPA-surface confirmation (B1 (a) — closes the pre-WS-3c-baseline risk), 1.1 `public.indicators`, 1.2 `public.indicator_measurements`, 1.3 `app.mint_indicator_code()` — per-commission (reuses the `mint_meeting_number` pattern), 1.4 Flag seed — **OFF**, 1.5 RLS (Rule 1) — **posture (b): DEFINER-RPC-only writes (LEAD DECISION 2026-07-05)**, 1.6 Audit AFTER-triggers (Rule 11 — non-sensitive allow-list, **never `description_md`**), 1 · Migration set (B2 — `20260712000000_indicators_core.sql`) (+21 more)

### Community 241 - "Loading"
Cohesion: 0.07
Nodes (28): Backend (`backend`), Feature — `case_phase_results` (per-phase categorical result + manual override), Frontend (`frontend`), Tester (`tester`), 1. Requirements Coverage, 2.1 RLS on `phase_results` — SOUND, 2.2 RLS on `case_phase_offered_results` — SOUND, 2.3 SECURITY DEFINER RPCs — SOUND (+20 more)

### Community 242 - "Loading"
Cohesion: 0.07
Nodes (29): 1. Method — what I actually did, 2. Findings, 3. Area-by-area answers to the brief, 4. Requirements audit — ADR 0106 D1–D14, 5. What I did not verify, 6. Closing, 7.10 Round-2 status of the round-1 findings, 7.11 Closing (+21 more)

### Community 243 - "Loading"
Cohesion: 0.07
Nodes (29): 1. Requirements Coverage, 2.1 The three predicates, 2.2 Flag-OFF fallback — no ON-path gap, 2.3 Anon / PUBLIC EXECUTE, 2.4 `case_access` SELECT policy scoping, 2.5 Additive `case_documents` / `case_events` WRITE policies, 2.6 Submitted-only invariant (Phase-7), 2.7 PHI isolation (Architecture Rule 12) (+21 more)

### Community 244 - "Loading"
Cohesion: 0.11
Nodes (20): abort_batch(), BATCHES, dins(), finish(), free_port(), on_exit(), pack_batches(), pgrst_ok() (+12 more)

### Community 245 - "Loading"
Cohesion: 0.10
Nodes (31): EditDocumentPage(), metadata, metadata, NewDocumentVersionPage(), DocumentDetailPage(), metadata, metadata, ReviseDocumentVersionPage() (+23 more)

### Community 246 - "Loading"
Cohesion: 0.06
Nodes (36): 0. What this document is, and what counts as evidence in it, 1. Re-deriving the advisor's list locally — and one correction to AE0's caveat, 2.1 ⛔ `pg_stat_user_tables` is not the instrument here, 2.2 The instrument that was used, 2.3 ⭐ The finding that reshapes the phase: the four headline hot tables carry ZERO warnings, 2.4 Shape inventory of the 113 — why the fix is narrow, 2. Ranking the 113 — and the instrument that could NOT be used, 3.1 The transform, and why it is unconditionally identity (+28 more)

### Community 247 - "Loading"
Cohesion: 0.07
Nodes (29): A15·1 — The decision (PO, 2026-07-15), A15·2 — `can_reach_case_on_member_surface` is **UN-RETIRED**, A15 — D11's member arm was a WIDENING. Corrected to `read_case_deliberation`, A16 — The capability lattice is a **partial order**, not a chain, A17 — What A15 fixes elsewhere (no further decisions needed), A18 — Grant door: the exclusion gate, and the Organization User's one surviving arm, A19·1 — Decision (PO), A19 — The confidentiality "ceiling" is a data-destroying trap, not a ceiling (+21 more)

### Community 248 - "Loading"
Cohesion: 0.05
Nodes (38): 0. ⛔⛔ **THIS WHOLE FILE IS DISCHARGED HISTORY AS OF 2026-08-17. DO NOT RESUME FROM IT.**, 0a. (superseded) START HERE — **§13 is the resume point.** Everything in §§11–12 is discharged history., 10. §6 step 3 — ✅ **DISCHARGED: QA APPROVED (r2)**, 2026-08-14, 11. S4 — ✅ AUTHORIZED AND RUN 2026-08-16 (steps 1–2 green; 3–4 owed), 12. ⭐ START HERE IF YOU ARE RESUMING S4 (2026-08-17 03:30), 13.1 Exact state, 13.2 The follow-ups, in the order I would take them, 13.3 Then, in order: `e2e:prod` → PO step 4 → S6 (+30 more)

### Community 249 - "Loading"
Cohesion: 0.03
Nodes (105): MeetingDetailPage(), metadata, ADR-0078, ADR-0080, ADR-0099, ADR-0104, ADR-0125, metadata (+97 more)

### Community 250 - "Loading"
Cohesion: 0.05
Nodes (53): DashboardCharts(), groupBySection(), SectionEntry, SectionGroupData, DashboardForms(), FormPicker(), CHART_COLORS, DistributionChart() (+45 more)

### Community 251 - "Loading"
Cohesion: 0.07
Nodes (28): 1. Where we are, 2. Environment — bringing a new machine up, 3. Hard-won environment gotchas (each cost real time), 4. ⛔ A2 (the resolver) — READ THIS BEFORE BUILDING IT, 5. Open items, 6. PO decisions made this session (do not re-litigate), 7.10 ⛔ A metric that reads the SAME before and after is not measuring the change (lead, M5b), 7.11 ⛔ An inferred mechanism is not a mechanism — and quoting a lesson is not applying it (lead, 2026-07-16) (+20 more)

### Community 252 - "Loading"
Cohesion: 0.07
Nodes (28): `backend` — Wave 1 (schema + contract) ✅ COMPLETE 2026-07-27, `backend` — Wave 2 (pgTAP keystones) ✅ COMPLETE 2026-07-27, `backend` — Wave 3 (PO rulings) ✅ COMPLETE 2026-07-27, `backend` — Wave 4 (QA r1 remediation) ✅ COMPLETE 2026-07-27, ✅ BUG-AUTHZ-001 — `platform_admin` reaches response-derived content through DEFINER dashboard functions (owner: **AUTHZ**; NOT fixed here — **FIXED 2026-08-03**, `20260903000700`), 🔴 BUG-FF2-001 — the matrix writers were UNREACHABLE from the authoring path (found + fixed), 🔴 BUG-FF2-002 — `publishVersion` swallowed every FF-2 publish error (found + fixed), ✅ BUG-FF2-003 — the "Adicionar bloco" menu overflows the viewport with **no scroll**, so both new Matrix types are UNREACHABLE at 1280×720 · P1 · owner `frontend` · **CLOSED 2026-07-27, re-verified by `tester`** (+20 more)

### Community 253 - "Loading"
Cohesion: 0.04
Nodes (46): 0. Plan-vs-catalog disagreements found (report-loudly section), 10. Estimate, 1. Scope and non-goals, 2. Migration window, 3. Step-by-step, 4. Repo-side work in the same phase (one artifact with the chain), 5. Keystones (suite `328_dm1_document_substrate.sql`) + mutation proof, 6. Census registration (the two binding traps, answered) (+38 more)

### Community 254 - "Loading"
Cohesion: 0.06
Nodes (32): ADR 0137 batch — MRN as erasure key; case/referral usability (2026-08-24; ADR **0137**; migrations `20261003001300`–`…001600`, **4**; pgTAP `362` `plan(58)` · `363` `plan(15)` · `364` `plan(14)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**, `app._case_caps` gained arm **S8** — administrativo commission-wide case READ, App layer, `app.member_can_for` is the single implementation; `member_can` delegates, ⚠ Authz-sweep coverage of this surface — state it before quoting a green ARM, Backend State — cases, referrals and ethics, Case PHI gained a **creation-scoped write path** — the first not held by a coordinator, Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON) (+24 more)

### Community 255 - "Loading"
Cohesion: 0.06
Nodes (37): postSignedCallback(), accepted(), POST(), retryLater(), adminStub, featureEnabledServerOnly, post(), QueryChain (+29 more)

### Community 256 - "Loading"
Cohesion: 0.09
Nodes (22): ADR 0106 — "Act as": role assumption as a binding constraint, Consequences, Context, Cutover debts (neither was discharged by merging) — ✅ BOTH DISCHARGED 2026-08-10, D10 ⚑ — Big bang, not shadow mode, D11 — Principals outside the membership model, D12 — The hat lives in the JWT, not in a client-supplied setting, D13 — administrativo capabilities ride the committee hat (+14 more)

### Community 257 - "Loading"
Cohesion: 0.06
Nodes (57): FrameworkLayout(), metadata, StandardDetailPage(), FrameworkOverviewPage(), ADR-0093, AssessmentForm(), STATUS_OPTIONS, EvidenceList() (+49 more)

### Community 258 - "Loading"
Cohesion: 0.19
Nodes (13): classify(), count_sel(), emit_body(), emit_report(), psql_c(), psql_f(), record(), restore_inflight() (+5 more)

### Community 259 - "Loading"
Cohesion: 0.04
Nodes (71): ageDisplay(), resolvePatients(), SEX_LABEL, build(), buildPayload(), CTX, PATIENT, patientsAnswer (+63 more)

### Community 260 - "Loading"
Cohesion: 0.08
Nodes (20): CaseRow, continuarButton(), customFieldsGroup(), gotoWizard(), gridRows(), IdentifiersRow, NarrativeRow, narrativesFor() (+12 more)

### Community 261 - "Loading"
Cohesion: 0.02
Nodes (152): metadata, ADR-0074, ADR-0085, metadata, MyPhasesPage(), ADR-0033, canFillAssignedPhase(), isAssignedTo() (+144 more)

### Community 262 - "Loading"
Cohesion: 0.06
Nodes (31): 0 · Method, and what was NOT measured, 1.1 Six doors already carry coverage in a file that does not abort, 1 · The headline: the (a)/(b) dichotomy does not fit, and the gap is where all 18 live, 2.10 `public.link_evidence` — Δ 27 (recorded 27), 2.11 `public.submit_minutes_job` — Δ 71 (recorded 71), 2.12 `public.cancel_minutes_job` — Δ 71 (recorded 71), 2.13 `public.apply_minutes_review` — Δ 30 (recorded 30), 2.14 `public.conclude_interview` — Δ 29 (recorded 29) (+23 more)

### Community 263 - "Loading"
Cohesion: 0.05
Nodes (41): 0. Where to resume — read in this order, 1. What was initially planned, 2. What was actually implemented, 3.10 ⭐⭐ Two rules about migration text, collapsed into one, 3.11 ⭐⭐ A COVERED verdict does not survive a body change, and no arm enforces that, 3.12 The word-boundary trap, committed by the person citing it, 3.13 Seven E2E locator collisions from a restyle, 3.14 A serial-masking correction changed the fix count from 6 to 7 (+33 more)

### Community 274 - "phase17-documents.spec.ts"
Cohesion: 0.19
Nodes (33): ADR-0210, bodyAfterPreamble(), checkBulk(), checkLocalLinks(), checkPreambleIdentical(), checkRouted(), checkRouterTargetsExist(), checkSeamNaming() (+25 more)

### Community 275 - "Deploying to DigitalOcean + Coolify (test environment)"
Cohesion: 0.07
Nodes (27): 0. Conflicts named (plan wins) + verified-fact corrections, A.1 `public.attachments` — core (single authorizing owner + six ADR-0063 seams), A.2 `public.attachment_references` — non-authorizing "also appears here" (ADR-0063 §1), A.3 `public.attachment_subjects` — descriptive, PHI-safe, **participant-keyed (C-β)**, A.4 `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), A. Table / column DDL plan (attachments + companions), Appendix — verified F1/baseline build surface (symbols F2 depends on), B.1 `app.commission_of_attachment(owner_type text, owner_id uuid) returns uuid` (+19 more)

### Community 276 - "Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis"
Cohesion: 0.07
Nodes (26): 10. Timeline, 11. Meetings, 12. Decisions, 13. Action Items, 14.4 Recommended RLS Logic, 14. Access Control and Confidentiality, 15. Audit Logging, 16. Morbidity & Mortality Extension Tables (+18 more)

### Community 277 - "recommend-result.spec.ts"
Cohesion: 0.07
Nodes (29): 12. Role grant ceilings, 13. Case authorization attributes, 18. Effective permission rules, 1. Purpose, 22.1 Exact-match invitee lookup, 22. Controlled mutation RPCs, 23. Role assignment RPC validation, 24. Billing model (+21 more)

### Community 278 - "Phase 11 — Interviews QA Review"
Cohesion: 0.13
Nodes (40): ADR-0195, ANCHOR_SPEC, collect(), DIR, fixtureCorpus(), headingAt(), inspect(), main() (+32 more)

### Community 279 - "Membership Write-Path Lockdown (minimum-viable §6.1)"
Cohesion: 0.07
Nodes (26): 1. BLOCKER — `app.can_manage_professional` is an 8th direct `memberships` reader, outside Stage 2's enumerated list, and Stage 2/3 as written will not fix it, 2. BLOCKER — Stage 0's enum-derivation instruction omits `platform_admin`, which D11 requires to be representable, 3. MAJOR — ADR 0106's "measured, not assumed" enforcement-point census undercounts the live catalog by 47 functions, 4. MAJOR — ADR §3's substrate anchor for `session_context` is false; Stage 3's task description rests on a wrong premise, 5. MAJOR — an RLS policy on `profiles` grants co-member visibility across a suppressed hat, unreached by any stage, 6. MINOR — D12's "~30 functions already use this pattern" precedent doesn't hold up; only one does, 7. MAJOR — Stages 0 and 1 omit the CLAUDE.md §6 step-1 authz arms from their own gates, 8. INFO — Stage 3's revert-twin keystone is well-specified; one additional guard is worth naming explicitly (+18 more)

### Community 280 - "Phase 2 Re-review — P2-002 auth hot-path fix"
Cohesion: 0.07
Nodes (27): M1·1 — B7: respondent linkage, M1·2 — the exclusion-plane mutators (5 RPCs), M1·3 — NEW: `case_participant_roles` — the 6th exclusion-plane table (V-3), M1·4 — the DEFINER exclusion sweep: 35 RPCs, split by remediation shape, M1·5 — A30: `platform_admin` arms on tenant data — 5, not 4, Summary — v2, V-0.1 · C1a is CONFIRMED. My v1 fixture does not reproduce. (v1 §7 is WRONG), V-0.2 · C4 is CONFIRMED. My "30" was a floor. (v1 §6·1 is WRONG) (+19 more)

### Community 281 - "indicator-format.tsx"
Cohesion: 0.07
Nodes (26): 1. Requirements audit (vs ADR 0050 + plan §2) — PASS, 1. Security — the Open-#3 notify gate (highest priority): **PASS**, 2. Recipient resolution: **PASS**, 2. RLS — verbatim reuse confirmed (plan §8 primary charge) — PASS, 3. O-1 (fail-closed null-case) — confirmed sound — PASS, 3. PHI-free (Rule 12): **PASS**, 4. Additive domain widening: **PASS**, 4. O-2 (write authority) — RPC bodies match the ratified default — PASS (+18 more)

### Community 282 - "markdown-renderer.tsx"
Cohesion: 0.12
Nodes (27): analyseSource(), argv, ARRAY_CONSTS, assertsUnconditionally(), asTestCall(), asTestStep(), callsTestSkip(), containsGuaranteedAssertion() (+19 more)

### Community 283 - "Answer-Model v2 & Form-Definition Forward-Compatibility"
Cohesion: 0.08
Nodes (26): 1. Amendment 4's referral-dialog bullet is reversed: REMOVE, not "make reachable", 2. The `dsr` go-live flip is authorised — and this is where that fact lives, ADR 0131 — PHI erasure reach is bounded to DESIGNATED PHI fields; free text is out of scope for the pilot, Amendment 1 — this ratifies an invariant the architecture already held, and it removes NO backlog item, Amendment 2 — the compensating control is NOT training alone: a correction corridor exists, is documented to operators, and is BOUNDED, Amendment 3 — Decision 4 is keyed on SCOPE CLASS, not on working state, ⛔ Amendment 3 named NINE statements and THREE guards. It is TEN and FOUR., Amendment 4 — the choice is taken (FIX, not rollback), and Amendment 3's own magnitude was wrong (+18 more)

### Community 284 - "2. Security / RLS"
Cohesion: 0.08
Nodes (23): Architecture decisions (decided during research — not user-facing), Backend contract-first signatures (post BEFORE implementing), Builder UI (frontend), Condition engine (backend SQL + shared TS), Context, Data model — migration (backend), Fill UI (frontend), Form Builder Enhancements (+15 more)

### Community 285 - "QA Review — Phase A: Hospital-admin tier, 4-tier audit & committee titles"
Cohesion: 0.08
Nodes (26): M1·1 — B7: respondent linkage · **LANDS FIRST**, M1·2 — the five exclusion-plane **RPC** mutators, M1·3 — `case_participant_roles`: the 6th exclusion-plane table · **UPDATE-freeze**, M1·4 — the sweep: **35 RPCs + `reclassify_attachment`**, split by remediation shape, M1·4b — the **11 gate helpers** (D5) — *this is where the leverage is*, M1·5 — A30: platform_admin arms · ⚠ **BLOCKED pending an exhaustive enumeration** (§W-4), Summary — v3, VERDICT: ✅ **APPROVED** (+18 more)

### Community 286 - "referrals-list.tsx"
Cohesion: 0.06
Nodes (30): 0 · Method, and what was NOT measured, 1.1 The regex artifact, named, 1.2 Three doors where the rule disagrees with a message reading — ⚠ `A2/B — needs a ruling`, 1.3 The property-label template (ADR 0187 D2), 1 · The adjudication rule, 2 · The adjudicated split, 3.1 CONTRADICTION-1 — `app.assert_ethics_typed` (HC0J0), 3.2 CONTRADICTION-2 — `public.reopen_interview` (HC038) ⚠ the sharp one (+22 more)

### Community 287 - "Decision"
Cohesion: 0.11
Nodes (18): 2.1 Why props, not a compound-component API, for the review tree, 2.2 `MeetingFormDialog` needs one small addition (frontend-owned, noted for completeness), 2.3 The RSC server-fn-prop trap — binding pattern for this whole tree, 2. Component tree for F1–F5, 3.1 Queries (`src/lib/minutes-jobs/queries.ts`), 3.2 `MinutesDraft` — the review-page working copy, 3.3 Actions (`src/lib/minutes-jobs/actions.ts`, `'use server'`), 3. Server-action surface needed from B5 (+10 more)

### Community 288 - "Uploaded Documents Data Model Handoff"
Cohesion: 0.08
Nodes (25): Backend, Backend, Backend, Backend (contract-first), Context (one paragraph — the ADR carries the detail), Cross-cutting risks & standing lessons (checked at every slice), Deliberation & Voting Model (DLB) — Implementation Plan, Frontend (+17 more)

### Community 289 - "1. Workstreams"
Cohesion: 0.08
Nodes (25): Phase Gate (CLAUDE.md §6), Plan — AFF: hospital affiliation, person identity & the org people directory (ADR 0097), Program shape, Standing traps for this workstream, T1.1 — `public.hospital_affiliations`, T1.2 — `profiles.cpf`, T1.3 — Drop `profiles.home_hospital_id` and `profiles.hospital_employee_id`, T1.4 — `professional_profiles.cpf` (+17 more)

### Community 290 - "§A — Door / policy / RPC inventory"
Cohesion: 0.08
Nodes (25): 1a. New table `referral_note_types` (mirror `case_narrative_types`), 1b. Extend `referral_internal_notes` (extend, do NOT replace), 1c. RPCs (all SECURITY DEFINER, set search_path, Rule 11 audit rows, pt-BR errors), 1d. Mechanics, 1e. pgTAP, ✅ A10 — requested action keeps a home (PO decision, 2026-08-11), 🔴 A11 — Rule 7 is enforced at RENDER time, not write time (binding constraint on Phase 3), ✅ A12 — D3's case-card control is TWO states, not one button (PO decision, 2026-08-11) (+17 more)

### Community 291 - "Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail)"
Cohesion: 0.08
Nodes (22): AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18), FIX-A — the 26 ERROR core predicates → ALL COVERED (via runlogs, no new keystones), FIX-B — the standing invariant (`p0-authz-invariant.sh`, ADR 0079), FIX-C — 50 mutation-proven isolation keystones (`supabase/tests/25{0,1,2}_authz_p0_isolation.sql`), Follow-up backlog (invariant-surfaced, not silent), Pre-req fixed (`a32be9c`), Sweep (P0-U0) — 292 neutralization cases, Verification (lead + qa each independent, live — §7.14) (+14 more)

### Community 292 - "Checklist Results"
Cohesion: 0.08
Nodes (24): 0 · Scope of this verdict — stated so it cannot be inferred wrong, 1 · BLOCKING findings, 2 · MINOR findings, 3 · What I re-derived and what reproduced (the positive census), 4 · Answering, with a measurement, the question the S6 QA handed to the PO, 5 · The remote — measured, and the record is right about it, 6 · Carried to gate step 4 (PO) — none of these are DM5 defects, 7 · What it would take to reach APPROVED (+16 more)

### Community 293 - "NSP-per-org sub-phase B — whole-phase QA Review"
Cohesion: 0.08
Nodes (24): Additional verification performed, BLOCKS?, Catalog evidence (not migration text), Challenge 2 — both corrected premises hold, Challenge 3 — the two rebuilt DEFINER doors, property by property, Challenge 4 — the `20260921000300` apply-time guard, Challenge 5 — REG·KIND's table DROP, Challenges answered — verification record (+16 more)

### Community 294 - "flagged-aggregate-result.spec.ts"
Cohesion: 0.08
Nodes (24): 0. Summary of deltas, 10. Figures NOT derived by this task, 11. Method notes — what this census did to avoid the known failures, 1. RLS baseline and the policy population (BLOCK 1), 2. Policies reading `memberships` directly (BLOCK 4), 3.1 The wider figure — **131** (local = remote = ADR 0155), 3.2 The narrower figure — **117** (local = remote = the audit), 3.3 What the wider one includes — as a sentence (+16 more)

### Community 295 - "5. Re-render Optimization"
Cohesion: 0.08
Nodes (23): 10. Recommended V1.5 / V2 Tables, 12. Compact ER Diagram, 13. Bottom-Line Recommendation, 1. Architectural Overview, 2. Recommended Schemas, 5. Multiple-Choice Answer Storage, 6. Repeating Group Answer Storage, 7.1 Form Definition Relationships (+15 more)

### Community 296 - "phase7-cases.spec.ts"
Cohesion: 0.11
Nodes (26): NotFound(), ADR-0106, CommissionNotFound(), ADR-0106, TechnicalDirectionNotFound(), ADR-0106, OrgManageNotFound(), ADR-0106 (+18 more)

### Community 297 - "Question Editor Dialog — Layout Refactor Spec"
Cohesion: 0.08
Nodes (23): 14.1 `interview_findings`, 14. Findings, 15.1 `interview_summaries`, 15. Summaries, 1. Domain Overview, 23.1 Column-level encryption candidates, 23.2 Plaintext metadata, 23.3 Key management (+15 more)

### Community 298 - "3. Design"
Cohesion: 0.08
Nodes (24): Acceptance criteria for any follow-up, Audit boundary and method, Auditor's final verdict, Current model — verified catalog snapshot, Decision analysis: one table versus four, Explicit non-goals, Findings and recommendations, I1 — session membership reads should be one authority snapshot (improvement) (+16 more)

### Community 299 - "Per-Area Findings"
Cohesion: 0.08
Nodes (23): 1 · Breadcrumb, 2 · Identity band, 3 · Two-column grid, 3a · Editar dados pessoais, 3b · Editar registros profissionais, 3c · Adicionar vínculo hospitalar, 3d · Adicionar a uma comissão, About the Design Files (+15 more)

### Community 300 - "Checklist Results"
Cohesion: 0.08
Nodes (24): 0. Scope, 1. Collision matrix — the four initiatives against each other, 2. The design spine (D-remainder folded in) — conventions ratified at F0, 3. Phased sequence, 4. Rule 12 / Rule 2 amendment plan (who writes what, when), 5. Disposition of every hardening Wave-3/4 item (initiative D), 6. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 7. Testing & gates (+16 more)

### Community 301 - "QA Review — User Registration & Identity Management"
Cohesion: 0.08
Nodes (23): 1. What I verified independently (the load-bearing claims), 2. Findings, 3. The A13 / D5×D6 question — my ruling, for the PO, 4. Review of the lead's own work, 5. Gate evidence, 6. Verdict, ⚪ INFO-1 — seam B's 10 cases carry 4 units of evidence, not 10, ⚪ INFO-2 — the sweep's property is scoped to `public.memberships` by choice (+15 more)

### Community 302 - "case-phase-result.spec.ts"
Cohesion: 0.12
Nodes (35): ReferralActions(), ReferralNoteCard(), acceptReferral(), addReferralSharedItem(), assignReferralNote(), assignReferralReviewer(), cancelReferralAssignment(), concludeReferral() (+27 more)

### Community 303 - "form-model-normalization.spec.ts"
Cohesion: 0.05
Nodes (57): createForm(), enterWizardByTitle(), openAddBlock(), publishForm(), purge(), signInAs(), ADR-0045, ADR-0092 (+49 more)

### Community 304 - "PHASES.md — Hospital Commission Forms Platform"
Cohesion: 0.09
Nodes (31): InterviewDetailPage(), metadata, InterviewerRoleBadge(), isEditableInterviewStatus(), InterviewSummaryEditor(), InterviewerForm(), InterviewerMemberOption, InterviewerRow() (+23 more)

### Community 305 - "result-actions.ts"
Cohesion: 0.08
Nodes (24): 0. Why a new file, 1. Method, 2.1 The over-grant-impossible claim: **holds**, and it survived every attack I made, 2.2 The unstated assumption the claim rests on, 2.3 ⛔ **MED-1 — the new `SECURITY DEFINER` function's `search_path` is a single nonexistent schema**, 2.4 The `hat_ok` third-party branch — is `pronargs = 0` the only route?, 2.5 `professional_participants_select` — the sibling policy, 2. Security / RLS — the axis this review weights heaviest (+16 more)

### Community 306 - "7. JavaScript Performance"
Cohesion: 0.06
Nodes (31): 1. F2-BLOCK-1 — D8 / D9 / D5 / option E re-derived against the code, 1. F3-BLOCK-1 — CLOSED. The denominator is 399, and I re-derived it before reading theirs, 2. Archived closures, and D11's disclosed gap — which I closed by running it, 2. …but the histogram inside that correction is measured with a MISLABELLED instrument, 3. The classifier — checked by reading AND by running, and it is not defective, 3. The grep census — the instrument, and what a wider pattern still finds, 4. F2-REC-5 — the builder refused my 401 and wrote 400. **Both of us are wrong; the record's original 399 was right.**, 4. F3-REC-2..6, D11 and F2-REC-6 — each re-measured, not read (+23 more)

### Community 307 - "Quick Reference"
Cohesion: 0.19
Nodes (27): addSection(), authorizeCommission(), contextOfItem(), contextOfSection(), contextOfVersion(), createForm(), deleteBlockLibraryEntry(), deleteDraftVersion() (+19 more)

### Community 308 - "CLAUDE.md — Hospital Commission Forms Platform"
Cohesion: 0.13
Nodes (15): 1. Project Overview, 2. Tech Stack (do not deviate without human approval), 3. Architecture Rules (index), 4. Agent Team, 5. Phased Development Plan, 6. Phase Gate (mandatory, in order), 7. Progress Tracking, 8. Conventions & Quality Bar (+7 more)

### Community 309 - "phase11-interviews.spec.ts"
Cohesion: 0.09
Nodes (22): 1. Data model (shared by both layouts), 2. Design token mapping, 3.1 Geometry constants (recommended; adapt to your scale), 3.2 Axis header, 3.3 Background layers (behind events), 3.4 Phase bars (width = duration), 3.5 Single-day pins, 3.6 Event states (visual) (+14 more)

### Community 310 - "Decision — the locked design"
Cohesion: 0.09
Nodes (22): 1.1 The triage worksheet (one per event), 1.2 Reach & harm spectrum — `ReachId` (ordered, escalating), 1.3 Harm severity — `HarmId` (NCC MERP / JC tiers), 1.4 Sentinel designated categories (JC "always review"), 1.5 Not-a-PSE closure reasons — `ReasonId`, 1.6 Reporting committees (intake sources), 1.7 Intake event, 1.8 Seed events (de-identified reference) (+14 more)

### Community 311 - "Action Items Data Model Handoff"
Cohesion: 0.14
Nodes (26): callRpc(), changeParticipantRole(), createEthicsCase(), dbQuery(), getOwnerToken(), gotoCase(), isFocused(), mintSeatableProfessional() (+18 more)

### Community 312 - "README.md"
Cohesion: 0.09
Nodes (23): 0. What already shipped (read before building — do not re-derive), 1. Goal, 2.1 Shared shape across all three tables, 2.2 `action_item_reminders`, 2.3 `action_item_updates`, 2.4 `action_item_checklists`, 2.5 SQLSTATE allocation (block `HC0I0–HC0I9`), 2. AI·sat — the three satellites (and the explicit non-set) (+15 more)

### Community 313 - "Action Items Data Model Handoff"
Cohesion: 0.09
Nodes (21): Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07, Gate bugs found + fixed (all tester-verified), Migrations (6, pushed to remote 2026-07-07), Notes / follow-ups, Test gate result, Test reconciliation (test-side only; app was sound), The 10 tasks (all delivered), Time-field: masked → segmented (human decision 2026-07-07) (+13 more)

### Community 314 - "Why this track exists"
Cohesion: 0.09
Nodes (22): 1. Environment — verified independently, not taken from the report, 2.1 ⭐ `LOST = 0 / GAINED = 0` over 1568 cells, 369 reachable — **denominator independently reproduced**, 2.2 The six-step order and the hard deny — **holds in the live body**, 2.3 The lattice is asserted, never imposed — **confirmed**, 2.4 `read_standard_phi` is CONSUMED — the A36 blocker is cleared, 2.5 ACLs / `prosecdef` — clean, 2.6 A2 changed nothing outside its four predicates — **confirmed two ways**, 2. The claims, attacked (+14 more)

### Community 315 - "Frontend Audit — External Consultant Review (2026-07-05)"
Cohesion: 0.09
Nodes (23): 2.1 ⭐⭐ § 7 item 6 — SETTLED CLEAN, and my first matrix was WRONG, 2.2 C-1 re-verified end to end — and the tier question answered, 2.3 § 7 — the eleven items, each settled, 2.4 § 7 item 11 — I ran the mutation harness myself, 2.5 The `destination stream closed early` signal — **BENIGN, with two follow-ups**, 2.6 Security / RLS for the phase, on the settled catalog, 2.7 New findings this pass — all NON-BLOCKING, 2.8 What I could NOT verify — bounds with their mechanisms. **There is no pass 3.** (+15 more)

### Community 316 - "Phase 0 QA Review"
Cohesion: 0.15
Nodes (25): argv, byCodePoint(), checkArtifact(), checkMirror(), checkTsAgreement(), dbContainer(), digestsOf(), extractTsManifest() (+17 more)

### Community 317 - "5 · Itemized findings (non-blocking)"
Cohesion: 0.13
Nodes (20): argKindOf(), argv, findings, FIXTURES, gate, isExistenceGuard(), isGuarded(), matcherOf() (+12 more)

### Community 318 - "case-narratives.spec.ts"
Cohesion: 0.16
Nodes (16): ADR-0116, ATTACHMENT_KINDS, AttachmentActionState, AttachmentOwnerType, AttachmentScanStatus, AttachmentTier, ConfidentialityLabel, defaultClassification() (+8 more)

### Community 319 - "dashboard-charts.tsx"
Cohesion: 0.16
Nodes (20): AuditRow(), ENTITY_ICON, EntityIcon(), resolveEntityIcon(), actionLabel(), AuditLabelMap, DATE_TIME, displayValue() (+12 more)

### Community 320 - "Increment Plan — Case Access Control & "Meus Casos""
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 321 - "What was verified live (evidence)"
Cohesion: 0.18
Nodes (11): 0. Headline, 1. §4 · Efficiency & Performance — per-finding, 2. §5 · Data Model & Extensibility — per-finding, 3. Where §4 / §5 overstate or misattribute (correct before acting), 4. Comparison table — suggestion vs. current platform vs. recommendation, §4 · Efficiency & Performance, §5 · Data Model & Extensibility, 5. Sequenced recommendation (what to actually do, in order) (+3 more)

### Community 322 - "QA Review — answer-model-v2 mini-phase"
Cohesion: 0.09
Nodes (22): 0104 — PDF document printing module: record-semantics minting, single registry, template pipeline, QR verification, Alternatives rejected (summary), Amendments (P1 build, 2026-08-07 — lead-ratified at implementation), Amendments (P2 build, 2026-08-08 — PO-ratified "Package A", QA BLOCKER-1/MAJOR-1), Consequences, Context, D10 — QR verification: dedicated token, anemic public answer, D11 — Authorization matrix (+14 more)

### Community 323 - "Evaluation of the External DB Audit (2026-07)"
Cohesion: 0.09
Nodes (21): 1. Header (no card — sits on the page background), 2. Escalation banner (conditional, above the header), 3. Lifecycle stepper (card), 4. Checklist (card), 5. Atividade (card) — unified timeline, About the Design Files, Assets, Data-model extensions (NOT in the current hub schema) (+13 more)

### Community 324 - "QA Review — Form data-model normalization"
Cohesion: 0.10
Nodes (20): 1. `free_port()` selected PIDs from the wrong `netstat` column, 2. The gate deleted the evidence for the one failure mode it detects, 3. FALSE GREEN — the gate attached to a foreign or stale listener (vector A), 4. FALSE GREEN — a failed `--list` disabled coverage reconciliation (vector B), Auth session cache (added 2026-07-28) — ~865 logins → ~300, Batch accounting (added 2026-07-28) — a batch can no longer pass by producing nothing, E2E gating on a prod standalone build, Fault-injection checklist (how each arm was proven, and how to re-prove it) (+12 more)

### Community 325 - "2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite)"
Cohesion: 0.05
Nodes (42): 0. Three findings that change §A.3's scope (read first), 1. File list, 2.1 Console shell — `/o/[org]/qualidade/layout.tsx`, 2.2 Board — `/o/[org]/qualidade` (the landing), 2.3 Dashboards — `/o/[org]/qualidade/dashboards`, 2. Screen design, 3.1 Why one `viewerKind` discriminator and not four booleans, 3. Write-affordance suppression matrix (the case page) (+34 more)

### Community 326 - "form-builder-enhancements.spec.ts"
Cohesion: 0.08
Nodes (26): #2 — `ALTER DEFAULT PRIVILEGES`, the global `FOR ROLE` form (PA-F4) → `20261003005300` + pgTAP 389, 54 of 63 measured — and the 9 are NAMED, not counted, #6 — every `TO public` policy normalized (AE0 F-AE0-4) → `20261003005200` + pgTAP 382 §5, A blast-radius claim inherits the domain of the instrument that produced it, A gate matched the PROSE THAT DOCUMENTS the code it gates, ⛔⛔ A MANDATED GATE HARNESS REPORTED SUCCESS AT EXIT 0 HAVING MEASURED NOTHING, ⛔ AE1.5's "43 measured verdicts, ready to merge" were earned on a BASELINE THAT NO LONGER EXISTS, ⛔ And worse than the exit code: the harness cannot tell "swept" from "not in my worklist" (+18 more)

### Community 327 - "page.tsx"
Cohesion: 0.09
Nodes (13): Archive — Increment: Case Narratives, Increment: Case Narratives (feature-flagged; plan `on-this-platform-a-zazzy-waterfall.md`), PROGRESS archive — Phase 0, Batch context, Gate outcome (§6), Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA, Tasks, PROGRESS archive — Phase 1 (+5 more)

### Community 328 - "Attachments core — revised schema draft (Phase 14e + ADR 0063)"
Cohesion: 0.15
Nodes (12): Acceptance Criteria Coverage Map (Phase 14a), Code Quality Assessment, Findings, INFO — I1: `guard_event_custody` is SECURITY INVOKER (expected, confirmed correct), INFO — I2: `success` message in `acknowledgeEvent` uses `error` field, INFO — I3: `EventsList` rows are not links (design choice, not a bug), INFO — I4: `pqsInbox` filter bar receives `statusOptions` from label maps re-exported through `@/lib/queries/safety-events`, MAJOR — M1: `pqs_department` has RLS enabled but zero SELECT policies (+4 more)

### Community 329 - "Form Builder Enhancements"
Cohesion: 0.07
Nodes (28): 1. Requirements Audit, 2. Security / RLS Audit, 2a. Definer RPC gating, 2b. in_progress-answers invariant (the crux), 2c. B6 anon/PUBLIC EXECUTE revoke, 2d. Export route — no service-role key, 2e. Client-side form filter in `listSubmissions`, 3. Code Quality Audit (+20 more)

### Community 330 - "Answer-Model v2 — machine-switch handoff (2026-07-01)"
Cohesion: 0.09
Nodes (21): ADR 0079 / t19 grants (CLEAN), Dimension 1 — Requirements (per-increment acceptance), Dimension 2 — Security / RLS (the crux) — verified LIVE, Dimension 3 — Code quality (CLEAN), Dimension 4 — UX & a11y, Dimension 5 — Hygiene, INFO-3 — idempotency keys — confirmed intentional (PO-locked trim)., INFO (new, non-blocking) — defense-in-depth for the notes read (+13 more)

### Community 331 - "QA Review — Form-Builder Enhancements batch (ad-hoc, out-of-phase)"
Cohesion: 0.09
Nodes (22): 0 · What the harness actually mutates — read this before designing anything, 1.1 The guard, 1.2 Why the suite is blind to it, 1.3 The keystone, 1.4 UNVERIFIED — check against the live catalog before writing the test, 1 · `public.nsp_org_capa_rollup(p_org_id uuid)` — the ordinary shape, 2.1 The guards, 2.2 Why the suite is blind to it (+14 more)

### Community 332 - "Risks / gaps (ordered by severity)"
Cohesion: 0.09
Nodes (22): AE2 — QA review, round 3 (post-drop head), C10. `recover_orphan_person_to_org` is genuinely exercised, not allowlisted into blindness, C1. The column is gone, and nothing in the catalog still reaches for it, C2. ⭐ M11 / ADR 0164's hard pre-condition — DISCHARGED, and I built the orphan myself, C3. ⭐ The creation doors are `service_role`-ONLY — from `proacl`, for `authenticated` AND `anon`, C4. ⭐ Increment D's backstop survived increment F's rewrite of its host — behaviourally, C5. ⭐ The seed restructure is equivalent, and its self-check is genuinely falsifiable, C6. ⭐ The six re-cut suites did not lose coverage that exists nowhere else — checked by SUBJECT (+14 more)

### Community 333 - "Findings by focus area"
Cohesion: 0.07
Nodes (29): 1. What I measured myself (not read off the record), 2. AC-by-AC, 3. Security / RLS, 4. MAJOR, 5. MINOR, 6. NOTE, 7. Could not verify — a work item, not a pass, 8. Obligations remaining at the Record step (+21 more)

### Community 334 - "Detailed Findings"
Cohesion: 0.40
Nodes (4): ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target, Consequences, Context, Decision

### Community 335 - "Audit Trail"
Cohesion: 0.07
Nodes (28): Could not verify — this is a work item, not a pass, Evidence traced to `.dsp-gate-evidence/` — which rows, and which remain untraceable, Findings, MAJOR-1 — D4 is a **two-clause** convention; only one clause is gated, and three committed sentences say otherwise, MAJOR-2 — `docs/lint-gates.md`'s gate-18 row states the baseline preference **backwards**, in the document that explains the gate, MINOR-1 — gate 18's shrink arm is vacuous for a growth **committed directly on `main`**, and the prose does not say so, MINOR-2 — **867** is committed in two homes, and the same commit made it **865**, MINOR-3 — `420 §§ 1/2` reach their subjects only through wrappers, and nothing pins that the wrapper still routes the subject (+20 more)

### Community 336 - "6. Rendering Performance"
Cohesion: 0.10
Nodes (20): 10. Component inventory, 11. Acceptance checklist, 1.1 Fishbone categories (clinical Ishikawa — the six ribs), 1.2 Root-cause classification, 1.3 PDCA stages (the wheel), 1.4 Seed data (de-identified reference — case "MM-2026-0142"), 1.5 Derived values (single source of truth), 1. Data model (single shared analysis object) (+12 more)

### Community 337 - "0063-centralized-attachments-substrate.md"
Cohesion: 0.10
Nodes (21): 4.10 `form_responses.form_answer_revisions`, 4.12 `form_responses.form_submission_draft_snapshots`, 4.4 `form_responses.form_repeating_group_instances`, 4.6 `form_responses.form_answer_signatures`, 4. Answer Storage Layer, Design Reasoning, Design Reasoning, Design Reasoning (+13 more)

### Community 338 - "6.2 Participant Subtype Tables"
Cohesion: 0.10
Nodes (21): ⭐ All four amendments record a decision the approved ADR got WRONG, each found by building it, Commits, Found by building — the four the reviews did not have (2026-08-25), Gate 2 — the 2026-08-25 GREEN run, and the first retained collapse log, Gate evidence rotated from PROGRESS.md 2026-08-25, ⛔ Known scoped absence, not coverage, Path to success — delta against handoff §6 (which otherwise stands), PDF·P3 — Printing Cases (task detail) (+13 more)

### Community 339 - "Plan / Handoff — "Administrativo" delegated-capability role (per commission)"
Cohesion: 0.10
Nodes (20): 1. Requirements coverage, 2. Security / RLS, 3. Code quality, 4. XSS / Rule 7, 5. pt-BR and a11y, 6. No patient data / §1 compliance, 7. Hygiene, Audit Details (+12 more)

### Community 340 - "Checklist"
Cohesion: 0.10
Nodes (21): 1. Executive summary, 2. Must-fix before pilot (the critical set), 3. Permission model — adequacy assessment, 4. Efficiency & performance, 5. Data model & extensibility, 6.1 Collapse the role stack into one audited `memberships` table, 6.2 Introduce a hospital-scoped patient master, 6.3 Metadata-drive the form builder (+13 more)

### Community 341 - "QA Review — PHI / HIPAA-Readiness Remediation"
Cohesion: 0.10
Nodes (21): 0 · How this review was conducted, 1 · BLOCKING, 2 · MAJOR, 3 · MINOR, 4 · INFO, 5.1 Mutation proofs re-run (all held), 5.2 Door parity — verified against the catalog, not the ADR, 5.3 The two mirror pairs (+13 more)

### Community 342 - "QA Review — Pre-Pilot DB Hardening, Wave 2 (WS-6 Performance Sweep)"
Cohesion: 0.10
Nodes (20): ADR 0013 — form_versions INSERT RLS fix, Builder mutation authorization (server-side re-check), Checklist Summary, Code Quality Audit, Detailed Findings, Hygiene Audit, MAJOR-1 — No keyboard-only E2E flow in Phase 4 specs, Markdown / XSS surface (Architecture Rule 7) (+12 more)

### Community 343 - "case-access.spec.ts"
Cohesion: 0.10
Nodes (21): 2.1 `printed_documents` — RLS, grants, indexes, CHECKs, 2.2 `app.can_view_printed_document` — explicit arms, not delegation, 2.3 The four doors, 2.4 D8 — no signed/storage URL can reach a client, 2.5 D10 — the public tuple stays anemic, 2.6 D11 matrix, including the platform_admin noun rule, 2.7 Rule 7 — HTML escaping into Chromium, 2.8 Rate limiting on `/verificar` (+13 more)

### Community 344 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (17): buildChapterRollup(), buildLevelRollups(), ChapterRollup, computeReadinessRollups(), EvidenceTotals, flattenTree(), gapSort(), isCleanAssessment() (+9 more)

### Community 345 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 346 - "0027-case-timeline.md"
Cohesion: 0.10
Nodes (21): ⛔ A fixture that had built its world out of the column under test — the third this phase, ⛔ A HAZARD THIS INCREMENT CREATED IN THE SHARED STACK, CAUGHT BY A PEER AND NOT BY ME, ⛔ A SECOND SELF-AUDIT FINDING — § 9.2/§ 9.3 WOULD HAVE BEEN VACUOUS ON THE SEED, AE2.4 increment 4 — the coordinator picker and the last preambles (migration `20261003005800`, suite `395`), ⛔ `ARM=census` EXITS 1, AND THAT IS THE ARM WORKING — it is handed over, not discharged, Arm domains — derived per object from the catalog, with the harness's own domain SQL, ⚠ `FROMFINDINGS=1 ARM=wrapper` IS GREEN AND THAT GREEN IS VACUOUS HERE, Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset` (+13 more)

### Community 347 - "Decision"
Cohesion: 0.10
Nodes (21): ⛔ A measurement hazard found while verifying — worth more than the verdict, AE2.0 — the ruling, and why the question was the other way round, AE2.1 — the census, AE2 — Affiliation/person-tenancy split completion (detail), ⚠ Already-stale comments the drop will walk past, Increment D ✅ BUILT — the `is_admin` demotion backstop (CNV-5 / R2-m3), Increment E ✅ DONE — detector logging (round-2 finding R2-m4), Increment F (NOT BUILT) — the drop: the `seed.sql` half, measured (+13 more)

### Community 348 - "30. Type-Specific Extension Tables"
Cohesion: 0.15
Nodes (11): CheckboxGroup(), ChoiceGroup(), DateTimeItem(), DropdownItem(), formatBoundsHint(), FreeTextItem(), NumberItem(), optionRowClass() (+3 more)

### Community 349 - "Locked decisions"
Cohesion: 0.16
Nodes (12): clampCalloutCenter(), fitAxis(), OPTIONS, TimelineDensity, TimelineDensitySwitch(), AxisHeader(), GanttRow(), Marker() (+4 more)

### Community 350 - "NSP-per-hospital — Backend security-core spec (Phase B, backend core)"
Cohesion: 0.10
Nodes (20): 0 · Why this document exists, and what it IS, 1 · OWNER AND PERIODICITY — ✅ DECIDED (PO, 2026-08-17), 2 · Preconditions (all verified against the live catalog), 3 · The procedure, 4 · ⛔ What "verified deletion" does NOT prove, 5 · Reconciliation, 6 · ⚠ Cloud caveats — do NOT gate a Cloud run on `capture`'s exit code, 6b · ⛔ PHI HANDLING FOR THE BACKUP HALF — read BEFORE taking any Storage backup (+12 more)

### Community 351 - "Focused Analysis — Audit §4 (Efficiency & Performance) and §5 (Data Model & Extensibility)"
Cohesion: 0.10
Nodes (20): 8. The plans, verbatim, P1 — `select public.session_context()` · principal `multi@test.local`, hat `staff`, P2a — `select * from public.cases` · principal `staff1.ccih`, hat `staff` (MEMBER arm), P2b — `select * from public.cases` · principal `chefe.ccih`, hat `staff_admin` (COORDINATOR arm), P2c — `select * from public.list_cases_board('<CCIH>', 200)` · principal `chefe.ccih`, hat `staff_admin`, P3 — meetings first page · principal `chefe.ccih`, hat `staff_admin`, P4a — `dashboard_form_totals('<CCIH>', null, null)` · principal `chefe.ccih`, hat `staff_admin`, P4b — `dashboard_distributions('<form>', null, null)` · principal `chefe.ccih`, hat `staff_admin` (+12 more)

### Community 352 - "Focus-area findings"
Cohesion: 0.07
Nodes (27): A0 · Findings already CONFIRMED from the catalog (2026-07-15) — start here, then extend, A0 · Migration contract — **catalog-driven** (no SQL until this is reviewed), A1 · pgTAP first (authored before the SQL), A2 · The resolver, A3 · `case_types.default_visibility_policy`, A4 · Repoint policies — **⛔ D4·1 IS A NO-OP AS THE ADR SCOPES IT** (ADR 0078 **A21**), A5 · ⛔ Performance gate — **exit criterion, before policies repoint**, B1 · `case_access_grants` (hard cut) (+19 more)

### Community 353 - "QA Review — Pre-Pilot DB Hardening, Wave 1"
Cohesion: 0.10
Nodes (19): About the Design Files, Active-filters summary bar, Advanced filter panel (right sheet), Assets, Components, Desfechos strip (collapsible), Design tokens (from `src/app/globals.css` — use the variables, not these literals), Existing code to build on (repo: optimusexercitia-dev/hospital_form_platform) (+11 more)

### Community 354 - "QA Review — "Sem processo" (process-less cases) · flag `processless_cases`"
Cohesion: 0.10
Nodes (20): Acceptance / gate, Acceptance / gate, Acceptance / gate, Acceptance / gate, Cross-cutting, Decide first (blocks everything else), Decisions locked by interview (PO, 2026-08-04) — do not re-litigate, Findings that reshape the remaining work (catalog-verified 2026-08-04) (+12 more)

### Community 355 - "Audit findings"
Cohesion: 0.10
Nodes (18): addAllegation(), assertRouteDenied(), AuditRow, auditRowsFor(), clearCaseAccess(), dbDelete(), dbQuery(), getOwnerToken() (+10 more)

### Community 356 - "QA Review — Option A: Shared (non-PHI) `action_items` table"
Cohesion: 0.12
Nodes (31): ADR-0139, ADR-0179, checkLinks(), markdownLinks(), relLinks(), CAPPED_SECTIONS, cappedLines(), checkBulletLength() (+23 more)

### Community 357 - "React Best Practices"
Cohesion: 0.10
Nodes (20): 1. What I re-proved myself (all green — no finding), 2. BLOCKING findings, 3. MAJOR — coverage gaps (behaviour verified CORRECT by me; a regression would be undetectable), 4. MINOR, 5. INFO (no action required), 6. Assessment of the lead's five carried gaps, 7. What I did not verify, 8. Stack state (+12 more)

### Community 358 - "Sections"
Cohesion: 0.10
Nodes (20): `app.copy_response_answers` — adversarial read (item 5), clears, B-1 (MAJOR) — Ruling 2's patient lane has **zero positive coverage anywhere**, B-2 (MAJOR) — The ruling-1 surrogate keystone is missing, Blocking findings, FF-5 — QA review r1 (superseded by r2), i-1 (INFO) — the user lane cannot reference a commission-less admin, i-2 (INFO) — `buildGroupInstances` returns wrong-by-construction stubs, i-3 (INFO) — unstable ordering in the candidate search (+12 more)

### Community 359 - "Frontend Design — "Clinical Calm""
Cohesion: 0.10
Nodes (20): 0168 — orphan recovery is its own door: split the branch, do not lock the door, 1. The creation doors keep TODAY's predicate. Their bound is the ACL, not the state., 2. Recovery is ORG TIER ONLY, and that is a measured bound rather than a scope cut., 3. The audit verb is an ADDITIONAL `app.audit_write`, because the trigger cannot know the door., 4. ⚖ RULED — `public.affiliate_person_to_org` KEEPS its `authenticated` grant., 5. ⭐ The TypeScript mirror does NOT narrow — and its comment was ALREADY false., Amendment 1 — the split is THREE doors, not two, and the two-door form closed person creation (2026-08-28), Amendment 2 — the implementation shape, measured before it was written (2026-08-28) (+12 more)

### Community 360 - "backend-state.md — Living Backend Capability Map"
Cohesion: 0.07
Nodes (27): 1. My BLOCK-1 anchors were miscited — **CONFIRMED, and the error is mine**, 2. *"The watching relation is INVERTED"* was wrong — **CONFIRMED, misattribution only**, 3. `grep -rn "the fuse"` returns **two** hits — **CONFIRMED**, ⛔ BLOCK-1 (R11 recorded only in the log) — **FIXED**, ⛔ BLOCK-2 (R12, and D5's sufficiency) — **FIXED**, Bottom line, ⚠ MAJOR-1 (the hub's `## Current state`) — **PARTLY FIXED** → **N-MAJOR-3**, ⚠ MAJOR-2 (three miscitations in ADR 0203) — **FIXED, and my own characterisation of one was wrong** (+19 more)

### Community 361 - "0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones)"
Cohesion: 0.10
Nodes (20): 0. Why this is not a migration file, 1. Pre-flight — revalidate before you write a line of SQL, 2. The two revert shapes, 2a. A re-pointed wrapper (AE4.6) — back to the legacy adapter, 2b. A re-keyed enforcement site (AE4.9 D6) — back to the role wrapper, 3. ⛔ The prohibition that outranks convenience, 4. Record the event, and state compatibility in BOTH directions, 5. Verify (+12 more)

### Community 362 - "3.2 `forms.form_versions`"
Cohesion: 0.11
Nodes (16): CaseAccessPanel(), ExpiryPreset, GrantDialog(), isoDaysFromNow(), isoTomorrow(), LevelOption(), emptyDetail, members (+8 more)

### Community 363 - "QA Review — Form Builder Enhancements (mini-phase)"
Cohesion: 0.08
Nodes (26): B1 — The mandated disclosure misstates the class-B label count. 14 vs a measured 15., B2 — A standing rule asserts a safety property this session's own incident falsified., BLOCKING, C2-TIER1 closure — QA review, Closing, Findings, M1 — The findings file is not internally clean: 5 orphaned lines from superseded verdicts., M2 — `ARM=floor`'s zero slack is stated but has no owner, no follow-up, and no mitigation. (+18 more)

### Community 364 - "ad-hoc-narratives.spec.ts"
Cohesion: 0.08
Nodes (46): ADR-0152, CHAR_TO_HIGH_BYTE, CONT_NAMED, decodeRun(), EXCLUDE, hasMojibake(), HIGH_BYTE_TO_CHAR, main() (+38 more)

### Community 365 - "administrativo.spec.ts"
Cohesion: 0.18
Nodes (10): byPair, clean(), controls, env, KEY, out, probe(), { results } (+2 more)

### Community 366 - "member-action-items-overview.spec.ts"
Cohesion: 0.11
Nodes (15): ADR 0111 — Printed-document doors return the granted-column composite (FUP-PDF-3), ADR 0113 — Referral-module door RETURN shape: the class, not the instance, Consequences, Context, Decision, 1. The disposition, and why it is not 47 keystones, 2. The one real leak, and the persona that finds it, 3. Run history (four passes) and what went wrong in the harness (+7 more)

### Community 367 - "phase13-audit.spec.ts"
Cohesion: 0.06
Nodes (35): A code-design decision to defend against future "improvement", ⭐ A deliberately uninformative error code is uninformative to the TEST too (S2 `341` F-block), Diff-scoped door sweep — 1 case COVERED, with its DOMAIN stated, DM5 — Wave D + retirement (phase record), Durable mechanism fixes (not phase details), Five ways this slice tried to go wrong — all of them the phase's own recurring classes, For `tester` — one seam a UI spec cannot reach, Gate figures (fresh `supabase db reset`) — ⛔ VOID, see the banner above (+27 more)

### Community 368 - "wizard-others-ux.spec.ts"
Cohesion: 0.09
Nodes (14): ADR 0160 — AE0 corrections to ADR 0155's measured figures: the `anon` residue never grew, and the role-helper predicate names a dead term, Both published counts were honest; neither is usable bare, Consequences, Context, Correction 1 — the "167 → 237 `anon`-residue growth" never happened, Correction 2 — the published role-helper predicate names a helper that does not exist, Decision, AE0 — Baseline and attributable measurement (authz evolution, ADR 0155) (+6 more)

### Community 369 - "PROGRESS.md — Project Status Tracker"
Cohesion: 0.01
Nodes (176): ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts, Consequences, Corrections to the inherited record, taken before the rulings, Decisions, ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL), Consequences, Decisions, Evidence — why the refusal proves what it claims (+168 more)

### Community 370 - "ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors"
Cohesion: 0.11
Nodes (19): 1. Migration registry parity, 2.1 `rls_enabled_no_policy` (INFO, 7) — full list, 2.2 `function_search_path_mutable` (WARN, 6) — full list, 2.3 `authenticated_security_definer_function_executable` (WARN, 432) — full list, 2.4 Project-level Auth findings (2), 2. Security advisor — full findings (linked project `azkbbhskturikxpgmafq`), 3.1 `unindexed_foreign_keys` (INFO, 202) — full list (table, FK constraint), 3.2 `auth_rls_initplan` (WARN, 113) — full list (table, policy) (+11 more)

### Community 371 - "7. Lookup Values and Enums"
Cohesion: 0.11
Nodes (19): 14. Form assignment and immutable version resolution, 16. “No patient” and denominator semantics, 19. Optional device-level surveillance, 1. Executive summary, 23. Analytics, 25.1 Audit event structure, 25.2 Correction model, 25. Audit and immutability (+11 more)

### Community 372 - "Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01)"
Cohesion: 0.11
Nodes (19): 10.1 Organization roles, 10.2 Hospital roles, 10.3 Committee roles, 10.4 Platform roles, 10. Recommended system roles, `billing_admin`, `hospital_admin`, `hospital_auditor` (+11 more)

### Community 373 - "Increment Archive — Case Access Control & "Meus Casos""
Cohesion: 0.11
Nodes (19): 0. The two open [INF] items are CLOSED, 1. Catalog facts you will need, 2. Six findings that change the build, 3. Already written by the lead (syntax-checked in a rolled-back transaction), Authz arms — scope, and the substitution trap (added 2026-08-25, gate step 1 OUTSTANDING), Case authorization, `cases` lifecycle, ⭐ Finding 1 — `cases.revision` CANNOT exist. D4's column is unsatisfiable. (+11 more)

### Community 374 - "Phase 10 — Meetings (archived task detail)"
Cohesion: 0.08
Nodes (25): 0072 — Ethics access spine: confidentiality, respondent-exclusion, recusal/COI & the m2 gate release, 1. The basis: CFM-1821/2007 no longer supports this posture, 2. "E1 does not build it" was true; it is no longer the state of the world, 3. ⛔ The retention pin fires ONE LIFECYCLE STAGE TOO LATE for ADR 0132's rationale, 7. M2 posture — professional-identity erasure vs CFM-1821/2007 retention (RECOMMENDATION for human sign-off), ⚠ AMENDMENT (2026-08-21) — §7's BASIS is superseded and two of its factual claims have gone stale, As-built (2026-07-14 — E1 shipped; this section is authoritative over the design text above where they differ), Consequences (+17 more)

### Community 375 - "Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)"
Cohesion: 0.11
Nodes (19): 1 · Close direct writes, 2 · Shared self-exclusion helper, 3 · New `assign_org_admin` / `revoke_org_admin`, 4 · Patch existing RPCs, 5 · Blanket audit (H-6), Acceptance criteria, Change set (one migration + tests), Context (+11 more)

### Community 376 - "Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)"
Cohesion: 0.11
Nodes (18): 0. Headline (read this first), 1. Is this a population or a floor?, 2. The distinction that collapses most of the closure, 3. The 4-bucket inventory (40 sites), 4. The four answers, 5. Reproducible SQL, 6. For the PO to rule on, A30 — `platform_admin` enumeration (ANALYSIS ONLY — for PO ruling) (+10 more)

### Community 377 - "Findings"
Cohesion: 0.11
Nodes (17): Lead notes, Phase 22 — Inter-Committee Case Referrals (`case_referrals`), Summary, Tasks, 1. Requirements Coverage, 2. Security / RLS / PHI, 3. Code Quality, 4. Accessibility (+9 more)

### Community 378 - "Phase 17 — Controlled-Document Lifecycle · QA Review"
Cohesion: 0.09
Nodes (19): ADR-0169, dbQuery(), ensureCasePatientPhi(), focusTrace(), getToken(), openAccessDialog(), patchNarrativeAssignee(), patchNarrativeFields() (+11 more)

### Community 379 - "case-patient.spec.ts"
Cohesion: 0.11
Nodes (19): F10 — MAJOR: AE0 has already invalidated AE1's original scope, F11 — MAJOR: the SECURITY DEFINER review is only classification, not security review, F12 — MAJOR: green ARM gates do not cover the advertised authorization surface, F13 — MAJOR: AE2 differentials cover reads but the phase changes write containment, F14 — MAJOR: retaining `home_organization_id` preserves a stale security-adjacent anchor, F15 — MAJOR: the new FK acceptance criteria omit supporting-index proof, F16 — MAJOR: named-flake matching can accept a real regression, F17 — MAJOR: the explanation-output privacy test is string-negative, not schema-positive (+11 more)

### Community 380 - "cases-extras.spec.ts"
Cohesion: 0.02
Nodes (172): metadata, PhaseResponderPage(), ADR-0085, ADR-0136, DashboardPage(), metadata, ADR-0051, metadata (+164 more)

### Community 381 - "cases-meetings-minor.spec.ts"
Cohesion: 0.11
Nodes (18): Additional finding during re-review, Checklist Pass / Fail, Detailed Findings, Follow-up note for Phase 8 deploy checklist, INFO-1 — No ADR for the middleware coarse-gate + root Server Component role-landing design, INFO-2 — No ADR for the GSAP dependency addition, MAJOR-1 — Bad-credentials test locates `[role="alert"]` but the error renders as `[role="status"]`, Phase 2 QA Review — Authentication & App Shell (+10 more)

### Community 382 - "patient-index.spec.ts"
Cohesion: 0.01
Nodes (127): ADR-0066, ADR-0159, ADR-0106, ADR-0207, signInAs(), ADR-0147, ADR-0155, CASES (+119 more)

### Community 383 - "phase14a-safety-events.spec.ts"
Cohesion: 0.18
Nodes (10): createExternalModules(), createExternalModules(), from, inFilter, load(), remove, rpc, STALE (+2 more)

### Community 384 - "phase22-referrals.spec.ts"
Cohesion: 0.02
Nodes (204): AdminLayout(), ADR-0042, ADR-0106, metadata, safeRedirectTarget(), SelecionarPerfilPage(), ADR-0106, commissionInitials() (+196 more)

### Community 385 - "phase8-dashboard.spec.ts"
Cohesion: 0.18
Nodes (7): constNodes, files, memo, results, sources, SRC, unresolved

### Community 386 - "route.ts"
Cohesion: 0.11
Nodes (19): 1. Requirements audit, 2. Findings, ranked, 3. Defect classes — fix confirmation and sibling hunt, 4. Security / RLS, 5. Code quality, 6. What I could not verify, and why, 7. Required to clear this review, ADR 0095 — the eleven audit items (+11 more)

### Community 387 - "0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values"
Cohesion: 0.11
Nodes (19): 1. Requirements — D1–D10 and A1–A12, 2. 🔴 A11 / Rule 7 — the highest-value check, 3.1 K-R5-1 survives the rename (A4), 3.2 `referral_note_types` (A6), 3.3 `get_referral_case_access_summary` — the new DEFINER door, 3.4 `reorder_referral_note_types` is INVOKER — and that is safe, 3.5 Audit emission on every new mutation (Rule 11), 3.6 Secrets (+11 more)

### Community 388 - "Decision"
Cohesion: 0.10
Nodes (16): ADR-0026, addSubjectRpc(), callRPC(), completeSessionRpc(), confirmLifecycle(), createInterviewRpc(), goToCaseDetail(), goToInterview() (+8 more)

### Community 389 - "18. Relationships Summary"
Cohesion: 0.11
Nodes (17): assertAbsentFromMeusCasos(), assertCaseDenied(), assertCaseReadable(), assertPresentInMeusCasos(), AuditRow, auditRowsFor(), clearCaseAccess(), dbDelete() (+9 more)

### Community 390 - "20. Migration Strategy From Patient-Centered Cases"
Cohesion: 0.06
Nodes (49): CancelButton(), formatApplyCounts(), INITIAL_UPLOAD, MinutesUploadDialog(), Phase, ADR-0099, UploadState, ConcludeBar() (+41 more)

### Community 391 - "11. Final Design Principles"
Cohesion: 0.21
Nodes (17): addDays(), Axis, AxisColumn, AxisGroup, AxisUnit, buildAxis(), buildDayAxis(), buildMonthAxis() (+9 more)

### Community 392 - "3.5 `forms.form_blocks`"
Cohesion: 0.11
Nodes (18): 0096 — Process-template versioning (audit M1, full remodel), A1.1 · PO rulings (lead, 2026-08-04), A1.2 · Correction: the D11 trap is the OPPOSITE of what this ADR describes, A1.3 · Correction: the backfill can never be exercised by a local reset, A1.4 · Correction: the blast radius is about 5x the stated figure, A1.5 · The TRUE door set (the ADR's table was incomplete), A1.6 · Two harness lies caught during verification, A1.7 · DROP + CREATE resets a function's ACL (a security cost of honest names) (+10 more)

### Community 393 - "32. RLS Strategy"
Cohesion: 0.11
Nodes (18): 1. Verdict up front, 2. The current design, as verified, 3.1 The one-vs-four question — agree, with a stronger argument than the audit gives, 3.2 M1 (expiry not an end-to-end contract) — confirmed; scope it tighter, 3.3 M2 (commission role cardinality) — confirmed, and it is UI-reachable today, 3.4 M3 (service-role bypasses of the single door) — confirmed; the split is starker than reported, 3.5 M4 (trigger-only integrity → composite FKs) — confirmed, low, endorsed, 3.6 I1 (one session snapshot) — endorse, and elevate it (+10 more)

### Community 394 - "45. Testing Checklist"
Cohesion: 0.11
Nodes (17): About the Design Files, Assets, Behavior, Behavior & state, Design Tokens (already in `src/app/globals.css` — use, don't redefine), Existing code to build on, Fidelity, Files in this bundle (+9 more)

### Community 395 - "4. Core Architectural Decisions"
Cohesion: 0.11
Nodes (18): Answer-Model v2 & Form-Definition Forward-Compatibility, Backend work (owner: `backend`; owns `supabase/**`, `src/lib/{queries,forms,responses,types}`), BE-0 — contracts (post as typed stubs), BE-1 — migration: definition-side (additive), BE-2 — migration: answer-side (the core; **full plan review**), BE-3 — rehydration + write RPCs (keep OUTPUT identical), BE-4 — dashboards / export / clone / publish, BE-5 — types + query layer (+10 more)

### Community 396 - "Handoff — Meeting actual-occurrence time (`held_at` / `held_end`)"
Cohesion: 0.11
Nodes (17): 1.1 The signing door is `public.sign_section`, and the ADR never names it, 1.2 "Two copies of the pending-signoff computation" is **six**, 1.3 ⛔ The drift the ADR predicted has ALREADY happened — a live defect, 1.4 D7's ruled decline path does not currently exist, 1.5 D5 as written moves an HC061 raise onto the wrong actor, 1.6 Rows that hold, 1.7 Routines measured and deliberately NOT changed, 1. What the re-derivation changed — read this before the task list (+9 more)

### Community 397 - "Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07"
Cohesion: 0.04
Nodes (80): formatDateOnly(), MeusDadosPage(), generateMetadata(), CredentialsCard(), PILLS, STATUS_FILTER_LABEL, UserDirectoryStatusPills(), AffiliationRow (+72 more)

### Community 398 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.13
Nodes (40): ADR-0128, adminClient(), ALL_KNOWN_BUCKETS, ALL_VERDICTS, argFlag(), assertDisposableBucket(), bucketExists(), captureOutcome() (+32 more)

### Community 399 - "Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)"
Cohesion: 0.13
Nodes (10): gotenbergMock, PREVIA_PAYLOAD, STORAGE_MARKERS, ADR-0104, ADR-0125, __createSemaphoreForTests(), mintSemaphore, Semaphore (+2 more)

### Community 400 - "QA Review — "Administrativo" delegated-capability role (ADR 0061)"
Cohesion: 0.11
Nodes (18): 0. Goal & posture, 10. Rollout, 1. Current state (verified 2026-07-13 — the three tables being collapsed), 2.1 Data model — `public.memberships` (dialect-1: column-per-scope + discriminated shape CHECK), 2.2 Predicate family (`app` schema, DEFINER, `search_path`-pinned, owner=postgres), 2.3 Write door (one pair; `SECURITY DEFINER`; the SOLE write path — mirrors WS-1), 2.4 Audit (blanket trigger on `memberships` — WS-1 H-6 carried verbatim), 2.5 TS layer (`backend`-owned — the frozen stubs `frontend` builds against) (+10 more)

### Community 401 - "CLAUDE.md optimization — evaluation & change-map"
Cohesion: 0.11
Nodes (18): 0. Substrate facts this plan builds on (verified 2026-08-07), 1. Program shape, 2.1 Migrations (sequenced at build time; ~4 files), 2.2 Pure renderer — `src/lib/pdf/` (frontend-engineer or backend? → **backend owns, 2.3 Data provider + mint action (backend), 2.4 Serving route + overlay (backend), 2.5 Verification surface (frontend + backend), 2.6 UI (frontend — invoke `frontend-design` skill first) (+10 more)

### Community 402 - "QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`"
Cohesion: 0.09
Nodes (43): ADR-0047, ADR-0171, analyse(), applyBackpointer(), backpointerPlan(), cell(), checkAdrLinks(), checkAdrLinkTargets() (+35 more)

### Community 403 - "phase14b-triage.spec.ts"
Cohesion: 0.16
Nodes (15): formatFileSize(), REFERRAL_DOCUMENT_ERROR_MESSAGE, referralDocumentErrorMessage(), SNAPSHOT_UNAVAILABLE_DETAIL, ADR-0114, ReferralInertFileRow(), ReferralOpenFileButton(), ADR-0114 (+7 more)

### Community 404 - "processless-cases.spec.ts"
Cohesion: 0.11
Nodes (18): DM2 — orchestration + Wave A: phase record, Finding DM2-F1 — the interview-label dimension is PARITY, not a dropped control (AMEND 3), Gate record (S1, gate step 1 scope), Obligations ledger (S2+ — checked off at each slice's gate), Pilot watch-item — LIST file-chain RLS cost (PO-ruled: no action pre-pilot), Red-first record (lead AMEND 1 — the two-migration split), S1 — the D15 confidentiality ceiling (backend, 2026-08-13), S2.7 record (2026-08-13) (+10 more)

### Community 405 - "ui-batch-2026-07.spec.ts"
Cohesion: 0.11
Nodes (17): 1. ⭐ The highest-value question: can `authenticated` set `app.in_case_rpc` itself?, 2. §7.7 — does the narrowing bind TOO MUCH? (the lead's stated top risk), 3. Parity — is the door exactly as wide as the PATCH it replaced?, 4. ⭐ Are the 29 keystones vacuous?, 5. The `230` edit — did M3's coverage survive?, 6. Rule 11 / Rule 12 — the audit witness, 7. D3 — genuinely deferred, not silently live in a worse form, 8. ACL / hygiene (+9 more)

### Community 406 - "commission-overview.tsx"
Cohesion: 0.11
Nodes (17): 1. Requirements audit (D1–D15, A1–A7), 2.1 New table RLS policies, 2.2 HC030 same-commission guard, 2.3 Status trigger and guard correctness, 2.4 Dropped-helper landmine: CLEAR, 2.5 Phase-7 in_progress-answers invariant, 2.6 Anon/PUBLIC EXECUTE, 2.7 No service-role key in client code (+9 more)

### Community 407 - "interviewers-panel.tsx"
Cohesion: 0.11
Nodes (18): B-1 (BLOCKING) → **closed**, FF-3 — QA Review **r2**, M-1 (MAJOR) → **closed**, and the split is proven in both directions, M-2 (MAJOR) → **closed**, M-3 (MAJOR) → **closed via Amendment 4.** Audited on the merits; see r2.3., m-4, m-5a, m-5b, i-1, i-2 → **closed**, M-4 (MAJOR) → **behaviour closed**; coverage gap remains, see r2.4, r1 regression sweep — all 16 proofs hold (+10 more)

### Community 408 - "referral-flow-charts.tsx"
Cohesion: 0.11
Nodes (18): 4-tier audit lockstep (A3) ✅, Audit-integrity KNOWN-GAP adjudication (security focus #5), CLAUDE.md / hygiene compliance, MAJOR-1 — Hospital-tier "Verificar integridade" is disabled in the UI despite the full backend being wired & tested, MAJOR-2 — `removeCommittee` lacks the commission-scope check, permitting a cross-hospital destructive write (same org), MAJOR findings, MINOR-1 — `updateUserProfile` writes a client-supplied `home_hospital_id` unvalidated (amendment-11 hard-set not applied on the update path), MINOR-2 — Stale KNOWN-GAP documentation left in code & PROGRESS (+10 more)

### Community 409 - "rca-header.tsx"
Cohesion: 0.17
Nodes (23): ADR-0208, argv, byCodePoint(), CENSUS, checkArtifact(), checkMirror(), checkShrinkOnly(), dbContainer() (+15 more)

### Community 410 - "1. Eliminating Waterfalls"
Cohesion: 0.19
Nodes (16): CHOICE_OPS, CHOICE_TARGET_TYPES, ConditionBuilder(), isChoiceTarget(), isGroup(), isRowComplete(), isUnaryOp(), nextUid() (+8 more)

### Community 411 - "2. Bundle Size Optimization"
Cohesion: 0.11
Nodes (17): Authorization server-side and commission-scoped, Checklist Summary, Code Quality Audit, Detailed Findings, Hygiene Audit, INFO-1 — AC1 E2E does not assert the "Coordenação" role badge renders, Migration M9 / ADR 0010 (email denormalization), MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` did not revalidate the detail page (+9 more)

### Community 412 - "29. Important Implementation Guidance"
Cohesion: 0.11
Nodes (17): 1. Gates I ran (fresh `supabase db reset --local`, 315 files = 315 registered), 2. Findings, 3. Verified correct (audited from the catalog, not from file text), 4. What closes this review, Carried forward, non-blocking, Gates re-run after the `src/` edits, QO·FUP — focused review (follow-up close-out on top of QO·A), R1 — MAJOR (blocking) · a "catalog-verified" claim the catalog contradicts, and the live defect it hides (+9 more)

### Community 413 - "3. Design Principles"
Cohesion: 0.11
Nodes (18): 10. What this does NOT do, 1. What sizing owed, 2. Parent population — re-derived, not quoted, 3. The instrument, 4. Marker sets — what "PHI" and "tenancy" can actually be keyed on, 5. The counts, 6. Positive controls — which candidates survive, 7. ⛔ The finding: the tier split does not split (+10 more)

### Community 414 - "29. Important Implementation Guidance"
Cohesion: 0.11
Nodes (18): 0. The scope trap this census is built around, 10. ADR 0155 **G2** — re-measured at the AE3 branch cut, 1. The three columns as they exist today (block 1), 2. Constraints and indexes that MOVE, not get re-invented (block 2), 3. SQL consumers — the qualifying set (block 3d), 3b. The ruling set — wide-but-not-narrow (block 3c), each with a verdict, 3c. Excluded — names a token, does not name `profiles` (block 3e), each with a verdict, 4. RLS policies (block 4) — **zero** (+10 more)

### Community 415 - "3. Design Principles"
Cohesion: 0.11
Nodes (18): 1. What the audit found, in one table, 2. Goal, non-goals, acceptance, 3. Where a unit's state lives, 4. Constraints the sequencing obeys, 5. Waves, 6. Effort and checkpoints, 7. Delegation, 8. Risks (+10 more)

### Community 416 - "5.2 `case_type_terminology`"
Cohesion: 0.11
Nodes (18): 1a. Untriaged — orphan ids cited in docs, registered nowhere; rule on status and severity, 1b. Unrated (40) — no severity word, emoji or D4-definitional match in the source, 1c. Rated `catastrophic` (5) — from the source's own description, not its severity word, 1d. Status defaulted under uncertainty — spot-check, 2a. Re-ratings under D4 — confirm or overturn, 2b. 🔴 → ⛔ `catastrophic` (data-loss definition), 2c. Structural findings — rule on which record survives, Blockers at completion (+10 more)

### Community 417 - "3.3 `forms.form_sections`"
Cohesion: 0.12
Nodes (17): 0090 — FF-3 Validation Engine: rule vocabulary, coverage, enforcement topology, `required_if`, 1. Rule vocabulary v1 is **six** rule types, pinned by an allowlist, 2. Coverage v1 — scalars and repeating-group children, per instance, 3. Enforcement topology — `error` blocks **submit only**, server-side, 4. `required_if` — a new column, composed over the dispatch, **visibility wins**, 5. Operator authorability — widen `is_valid_condition` to the four F3 operators, 6. Door parity is discharged as a **table**, not an assertion, Amendment 1 — the legacy config-bound lane joins the error surface (2026-07-28) (+9 more)

### Community 418 - "3.7 `forms.form_block_validations`"
Cohesion: 0.12
Nodes (17): 1. ⛔ Tier 1 is 523, not 432 — the sized figure was the DEFINER subset, 2. Method — decide what the catalog can decide, then partition the rest, 3. The ten columns, 4.1 C3 — 58 with no identity binding anywhere in the closure, 4.2 C5 — 31 DEFINER doors that confirm existence before checking authority → **FUP**, 4.3 C9 — 62 mutating DEFINER doors whose tables emit no audit row → **FUP**, 4.4 C8 — the 47 DEFINER set-returning surfaces: **zero findings**, 4.5 C7 and C10 — 3 rows, individually justified (+9 more)

### Community 419 - "4.1 `form_responses.form_submissions`"
Cohesion: 0.12
Nodes (16): About the Design Files, Anatomy, Assets, Card shell (`.crd`), Composer (contributors only — hidden for read-only roles), Design Tokens (oklch — Clinical Calm), Fidelity, Files (+8 more)

### Community 420 - "4.2 `form_responses.form_answers`"
Cohesion: 0.33
Nodes (6): 3.4 `forms.question_types`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 421 - "43. Anti-Patterns to Avoid"
Cohesion: 0.12
Nodes (16): 12. Transactional Outbox and Notifications, 13. Audit and Retention, 15.1 Optimistic concurrency, 15.2 Pessimistic locking for commands, 15.3 Idempotency keys, 15. Concurrency Control, 16. Suggested Application-Layer Domain Model, 18.1 Referral inbox (+8 more)

### Community 422 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.07
Nodes (52): ADR-0149, AdminAuditPage(), metadata, csvField(), GET(), toCsv(), ADR-0029, ADR-0100 (+44 more)

### Community 423 - "Meeting actual-occurrence time — `held_at` / `held_end` (ADR 0062)"
Cohesion: 0.12
Nodes (17): 3.1 Separate a person from a platform user, 3.2 Separate the logical Interview from Interview Sessions, 3.3 Model participants separately from their roles, 3.4 Store contextual relationships on the Interview association, 3.5 Separate testimony, notes, findings, and summaries, 3.6 Reuse the Forms subsystem for structured questionnaires, 3.7 Reuse the Document subsystem for files, 3.8 Allow Interview permissions to be stricter than Case permissions (+9 more)

### Community 424 - "Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)"
Cohesion: 0.11
Nodes (17): 1. Executive Summary, 20. Security Groups, 31. Recommended Indexes, 35.1 Recommended workflow, 35.2 Why not activate immediately?, 35. Document Upload Workflow, 38. Integration With Ethics / Physician-Centered Cases, 39. Integration With RCA and Quality Workflows (+9 more)

### Community 425 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.08
Nodes (23): CANONICAL, CANONICAL_PROVENANCE, CASE_BODY_BASE, CASE_CANONICAL, CASE_DISPOSED, CASE_ENVELOPE, CASE_IDENTIFIED, CASE_PATIENT_DEID (+15 more)

### Community 426 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.12
Nodes (16): Allocations, Assurance plan — read before writing a keystone, DM5 — Wave D + retirement: slice plan, Gate (CLAUDE.md §6), Ownership, S0 — retirement manifest capture + enumeration tool (backend) — **runs FIRST**, ~~S1 — substrate amendment~~ ⛔ **WITHDRAWN 2026-08-14, never built**, S2 — Wave D pt.1: NSP RCA/CAPA evidence (backend + frontend) (+8 more)

### Community 427 - "cases-outcomes-blockers.spec.ts"
Cohesion: 0.12
Nodes (17): 0. What this covers (and what it doesn't), 1. Workstreams, 2. Sequencing — waves, 3. Migration batching & ownership, 4. Testing strategy, 5. Rollout & gates, 6. Corrections carried from the analysis (so implementers don't re-introduce them), 7. Effort & risk (+9 more)

### Community 428 - "nsp-per-hospital.spec.ts"
Cohesion: 0.12
Nodes (17): A. Groundwork findings (verified 2026-07-13, this branch), AI (satellites + cross-link) — authored 2026-07-13, B. SQLSTATE block allocation (ratified — high-water `HC099`), C. Feature-flag plan (ratified), D. Cross-cutting conventions (recorded once — bind every track), E. Collision contracts (locked — per-track reviews are conformance checks, not re-litigation), ETH·E1 (access spine) — authored 2026-07-13 · **M2 posture = the regulatory sign-off keystone**, ETH·E2 (procedure) — authored 2026-07-13 (+9 more)

### Community 429 - "phase14c-rca.spec.ts"
Cohesion: 0.12
Nodes (16): 1. The ask — three questions, 2. What is live today (verified), 3. Four defects, in severity order, 4. Correction to my own prior reporting, 5. Sequencing vs A2 — ⛔ my first answer here was WRONG, 6. Options, 6b. Corrections from `backend`'s plan review (2026-07-16, all three lead-verified), 7. What I need from you (+8 more)

### Community 430 - "phase14d-capa.spec.ts"
Cohesion: 0.12
Nodes (15): Form data-model normalization — completed phase detail, Form data-model normalization (🏗️ planning — started 2026-06-30), 1. Requirements audit — PASS (wishlist delivered), 2. Security / RLS — PASS, 3. Evaluator non-drift — PASS (verified byte-for-byte), 4. Code quality — PASS (one MAJOR bug, itemized below), Findings, INFO-1 — Constraint deferrability is a latent footgun (+7 more)

### Community 431 - "phase15-indicators.spec.ts"
Cohesion: 0.06
Nodes (34): Acceptance criteria (beyond the ADR's D-list), AFF4 — implementation plan: org affiliation, staff data, the voided tense, ⛔ AFF4's OWN REGRESSION — found 2026-08-26, NOT fixed, needs a go before merge, B1 · Migration: `organization_affiliations` (ADR 0151 D1), B2 · Migration: voided tense + staff columns on `hospital_affiliations` (D7, D9), B3 · Migration: the voided exclusion in the read legs (D7) — ⚠ ALTER POLICY, B4 · Migration: doors (D2, D5, D8), B5 · Migration: backfill (D10) (+26 more)

### Community 432 - "phase3-admin-members.spec.ts"
Cohesion: 0.20
Nodes (10): 1. Requirements — acceptance criteria, 2. Security review (the crux), 3. Code quality (§8), 4. UX & Accessibility, Checklist, Findings, MINOR-1 — `AUDIT_MESSAGES.appendOnly` phrasing mismatch (RESOLVED pre-record), Phase 13 — Audit Trail: QA Review (+2 more)

### Community 433 - "phi-remediation.spec.ts"
Cohesion: 0.12
Nodes (15): Gate record, Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail, QA findings (Wave 2), Task detail (W2-T0 … W2-T3 + gate), 1. The two DEFINER RPCs' gate parity (the point of this review) — VERIFIED LIVE, 2. P2 INVOKER + RLS — VERIFIED LIVE, 3. `get_feature_flags()` DEFINER — reviewed, no PHI/per-tenant exposure, 4. Cursor safety — MAJOR finding (bounded blast radius, not a BLOCKER) (+7 more)

### Community 434 - "React Best Practices"
Cohesion: 0.12
Nodes (16): 1. The 4 function targets — each edited correctly, nothing else touched, 2. The 18 policies — all narrowed, `pg_policies` quals read live, 3. Behavioural narrowing + positive twins (RLS-row level, `set local role authenticated`), 4. K2 — the "one level deeper than the policy" leak, verified independently, 5. K3 — action_items SCOPED, not deleted (both directions, one from a fixture), 6. PHI control — never widened, never narrowed, 7. `manage_case_access` kept on scope grounds — keystone-23 independence holds, 8. GAINED = 0 (no widening — the P0 safety property) (+8 more)

### Community 435 - "backend-engineer.md"
Cohesion: 0.29
Nodes (6): Binding rules (see ARCHITECTURE.md for the authoritative form), Catalog is truth (schema / RLS / RPC / authz questions), Process discipline, Scope you must NOT touch, Scope you own, Skills to consult

### Community 436 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.09
Nodes (19): 0. What I re-measured myself, 10. Minor findings, 11. Code quality, UX, a11y, hygiene, 12. What this phase did unusually well, 13. Summary of required changes, 1. Gate AE1, item by item, 2. The six close conditions, 3. Security / RLS — measured (+11 more)

### Community 437 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.12
Nodes (16): 10. §7.13 closure cross-check — the population is closed, 1. The positive twins — no over-reach (§7.7, the review), 2. The negative — every guard fires `HC0F1`, 3. Close-case flow (item 2) — no legitimate close is caught, 4. `recompute_recommendations` — both directions (item 3), 5. C7 both-layers — the gap is fully closed (item 4), 6. Interview both-layers (U1 ②), 7. OUT rulings spot-checked by execution — no missed leaker (item 5) (+8 more)

### Community 438 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.12
Nodes (16): 1. RLS on All Three New Tables, 2. Audit — body_md / title / instructions Exclusion, 3. PHI Posture (Rule 12 / ADR 0030), 4. Freeze-on-Close and Backfill Guard, 5. Advisory-Only Close, 6. Immutability / Regression on CREATE OR REPLACE, 7. display_position Integrity, 8. Conventions (+8 more)

### Community 439 - "ADR 0008 — GSAP as the animation dependency"
Cohesion: 0.31
Nodes (6): balancedDeal(), Rng, shuffle(), tallyByMember(), MEMBERS, ADR-0084

### Community 440 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.12
Nodes (16): 1. Post-A migration deltas (security-critical) — all correct, 1a. The two additive RLS broadenings (`organizations_select` + `commissions_select`) — VERIFIED minimal + cross-org-denied + non-widening, 1b. The appoint flow + duty separation — airtight, 1c. BUG-NSP-004 / BUG-NSP-005 / the I1 fold-in, 1d. The 7 TS query/action bodies, 2. Sub-phase B FE gating — no PHI reachable by a non-PQS user, 3. A-core isolation STILL holds against the B deltas (re-probed, not just read), 4. Coverage adequacy — adequate + adversarial (+8 more)

### Community 441 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.12
Nodes (17): 1. Requirements audit — AC-1…AC-8, cell by cell, 2. Red-first integrity (`422`, and the `408` edit), 3. Name-keyed and value-keyed sites (AC-8), 4. The generated pin (AC-6) — both halves, independently exercised, 5. TS collapse (AC-5), 6. Security, 7. Docs & hygiene, BLOCK — none (+9 more)

### Community 442 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.12
Nodes (17): ⛔ BLOCKER-1 — the ratified §4.4 case-plane CUT list was never executed; BUG-QOB-002 is still live, Carried forward (not blocking), ℹ️ INFO-1 — `bulk_create_cases` / `create_case_from_template` unresolved, not cleared, ℹ️ INFO-2 — `lift_recusal` denied both principals, 🟠 MAJOR-1 — four INVOKER doors return SUCCESS while writing nothing, Measured: two confirmed content writes, cross-org control discriminating, Method, 🟡 MINOR-1 — residual masked tenancy arms on the case plane (+9 more)

### Community 443 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.12
Nodes (17): 3a. Production modules — 28 lines, 3b. Colocated unit tests — 22 lines, AE2.1 — Consumer census of `profiles.home_organization_id`, Class 0 — The column itself, Class 1 — `pg_policies` (RLS), Class 2 — `pg_proc.prosrc`, schemas `public` + `app`, Class 3 — App side, `src/`, Class 4 — Fixtures (+9 more)

### Community 444 - "ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture"
Cohesion: 0.08
Nodes (24): `20260928000600` — `document_version_files` is structurally 1:1 with its bytes, `20260928000700` — a response with an ACTIVE print cannot be deleted, `20260928000800` — `superseded` is a live page, and the mint is ordered against the discard, App-layer changes in the same batch, Backend State — the document model, Current state, DM1 — Document-model substrate cutover (2026-08-12/13; ADR 0114 D1–D14 + ADR 0116; migrations `20260923000100`–`…000600`; flags `documents_foundation` + `documents_wave_a..d` **all OFF**; QA APPROVED r1, PO-approved), DM2 — Document-model command layer + Wave A (2026-08-13; ADR 0114 Amdt 1 + **0117** +Amdt 1 + **0118**; migrations `20260924000100`–`…000800`; flags **all five still OFF** in production defaults; QA APPROVED r2, PO-approved) (+16 more)

### Community 445 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 446 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.12
Nodes (16): 1. Path inventory — all seven named paths accounted for, 2. Principals — one per path, named, 3. Positive control — the session context IS being applied, 4. Method, 5. Measurements — all three repetitions, 6. Findings — plan shapes that already look wrong today (AE1.5 input), 7. Stack unmutated — before / after evidence, 9. How a later phase compares against this file (+8 more)

### Community 448 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.12
Nodes (13): Bugs the gate caught + fixed (all pre-commit), F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE, Gate (§6), Open risks / deferred, What shipped, INFO (no action required), MINOR, MINOR-1 — `getMeetingAttachmentDownloadUrl` is dead, tier-unaware, and contradicts the door model (+5 more)

### Community 449 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.02
Nodes (101): ADR-0021, caseIdFromUrl(), customFieldsRegion(), openNovoCasoDialog(), signInAs(), ADR-0083, ADR-0096, createFreshCase() (+93 more)

### Community 450 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.12
Nodes (15): 0. What must NOT change (preserve exactly), 1. Dialog shell, 2. Two-column body, 3.1 Progressive disclosure of score + code, 3.2 Row layout (CSS grid), 3.3 Colour (COLOR_OPTION_TYPES only), 3.4 Row actions, 3.5 Add (+7 more)

### Community 451 - "18. Custom Fields"
Cohesion: 0.12
Nodes (16): 10. Rebuild notes / gotchas, 1. Purpose & scope, 2. Design system (inherited — do not reinvent), 3. Data model, 4. Component inventory, 5. App shell, routing & state (`docs-app.jsx`), 6. Screen — Document register (library) · `docs-library.jsx`, 7.1 Page layout (+8 more)

### Community 452 - "7. Status Model"
Cohesion: 0.50
Nodes (4): 5.10 `referral_status_events`, Columns, Design rationale, Suggested event types

### Community 453 - "10.1 `case_timeline_events`"
Cohesion: 0.05
Nodes (35): 0. Source anchors (what already exists — E2 extends/consumes, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables), 2.3 RPCs (all: `assert ethics flag` · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0J·`), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST) (+27 more)

### Community 454 - "12.1 `case_decisions`"
Cohesion: 0.12
Nodes (16): 0. Source anchors (what exists — E4 extends, never re-creates), 1.1 `20260919000100_eth_e4_ensure_professional_participant.sql`, 1.2 `20260919000200_eth_e4_create_external_participant.sql`, 1.3 `20260919000300_eth_e4_set_primary_subject_move_and_linkage.sql`, 1.4 `20260919000400_eth_e4_professional_read_org_manager_arm.sql`, 1. Migrations (`backend`) — window `20260919…`, 2. Data access + actions (`backend`), 3. Frontend (+8 more)

### Community 455 - "19.2 Ethics Complaint Against Doctor"
Cohesion: 0.12
Nodes (16): 1. Context (why this change), 2. Decisions locked (D1–D14), 3.1 Core `public.attachments`, 3.2 Triggers, 3.3 Dispatchers (schema `app`, DEFINER), 3.4 Storage, 3.5 RPCs (`public`, DEFINER), 3.6 Fold-in rewire (clean forward migration; DROP the three tables) (+8 more)

### Community 456 - "21. Supabase / PostgreSQL Implementation Notes"
Cohesion: 0.08
Nodes (24): Backend State — forms, items and responses, Chain-only facts with no other home, Correction to a posted section above, Current state, DOOR-PARITY RULE - read before adding ANY door or policy, DSS — Deferred `staff_admin` sign-off (2026-08-24; ADR 0136 + Amendment 1; migrations `20261003001900` + `20261003002000` + `20261003002100`; flag `deferred_staff_signoff` **ON** — flipped at the gate by `…2100`), Extracted from the pre-split stamp chain, F3 — Flexible-Forms Foundation (2026-07-11; ADR 0060/0065; migrations `20260718000000`–`…000200`; NO flag, structural) (+16 more)

### Community 457 - "2. Core Design Principles"
Cohesion: 0.12
Nodes (16): 1.1 ⛔ P0 · The exclusion plane: **6 tables × 4 legs** — the A27 matrix, 1.2 ⛔ P0 · The population question — answered, and the answer is not a number, 1.3 – 1.11 · Unchanged from v2 (all ✅ `qa`-verified), 1.6 · **A30 — `platform_admin` (`is_admin()`) arms on tenant data: FIVE** (D8 · D10), 1 · FINDINGS SUMMARY, D1a · My v2 boundary was wrong in two directions, and the count concealed it, D2 · ⚠ `qa`'s PROBE 4 over-states the PHI consequence (C1a's lesson, 4th occurrence), D2a · …but composed, it is **WORSE** than `qa` framed it (PROBE 5, proven live) (+8 more)

### Community 458 - "5.5 `case_workflow_stages`"
Cohesion: 0.12
Nodes (14): Gate record, Pre-Pilot DB Hardening — Wave 1 (archived task detail), QA findings (all non-blocking; tracked in PROGRESS Follow-ups), Task detail (W1-T1 … W1-T7 + gate), Dimension 1 — Requirements audit (C-1…C-6 + H-8 closed as scoped?), Dimension 2 — RLS / privilege security, Dimension 3 — PHI (Rule 12) + C-6 narrowed claim, Dimension 4 — Integrity invariants (+6 more)

### Community 459 - "6.4 `case_participant_roles`"
Cohesion: 0.09
Nodes (23): 0073 — Ethics procedure model: admissibility → notice → allegations/findings → hearing → vote → decision → appeal, Consequences, Context, D0 — One generalized engine, ethics as an extension layer (never a fork), D10 — `responses.target_case_participant_id` + assignment-role vocabulary, D11 — SQLSTATE block `HC0J0–HC0J9` (S0 §B) + audit verbs, D12 — E2 owns the `ethics` feature flag, D13 — Respondent targeted-submission door: `can_access_targeted_response` (a respondent files a defense without case read) (+15 more)

### Community 460 - "9.1 `case_documents`"
Cohesion: 0.12
Nodes (16): 1. RLS & Security, 2. State Machine & Immutability, 3. Quorum, 4. Code Quality & Architecture, 5. UX, A11y & pt-BR, 6. Test Coverage, Findings, INFO-1: Migration comment contradicts ADR on DEFINER bypass (no action required) (+8 more)

### Community 461 - "3.10 `forms.form_logic_conditions`"
Cohesion: 0.12
Nodes (15): 1. Requirements (Phase 14b–14d Acceptance Criteria), 2. Security / RLS, 3. Code Quality, 4. Audit Trail (Rule 11), 5. UX / Accessibility, 6. Hygiene, BLOCKER-1: `triage_disposition` RPC raises SQLSTATE 42702 at runtime — RESOLVED, BUG-14B-001 Call (+7 more)

### Community 462 - "3.11 `forms.form_logic_actions`"
Cohesion: 0.12
Nodes (16): 1. Verdict, 2. Domain-fit findings (accreditation practice), 3. Technical-currency findings (spec vs. the 2026-08 platform), 4. What is genuinely right about the proposal, 5. Recommendations (conditions for build approval), External Audit — Phase 16 "Standards Crosswalk & Readiness/Gap Engine", INFO-1 — Downstream dependency, MAJOR-1 — The readiness model is JCI-shaped; ONA readiness is unanswerable without a level dimension (+8 more)

### Community 463 - "3.12 `forms.form_calculations`"
Cohesion: 0.12
Nodes (16): 1. The noun rule / D6 — re-derived from `pg_proc`, not accepted on report, 2. platform_admin zero-rows — mutation-proven myself, not accepted on report, 3. Two more keystones spot-checked by live mutation (the brief's other named priorities), 4. D8 — masking and counts-only, verified from SELECT lists in `prosrc`, not from TSX, 5. Arm parity — `evidence_links_artifact_kind_check` vs. the two dispatch functions, 6. `prosecdef` census beside `pg_policies`, for the five new tables and every new function, Answering the coordinator's specific questions, Files most load-bearing to this review (+8 more)

### Community 464 - "3.13 `forms.form_translations`"
Cohesion: 0.12
Nodes (16): ADR 0087 rulings, Amendment 1, MAJOR-1 — `completeness_deadlock_negative_groups` and the top-level half of `conditional_required_honoured` cannot fail, MAJOR-2 — `group_instances_cross_user_denied` (J1) does not test the clause it names, Other invariants, r1 · 1. Method, r1 · 2. P0-1 — correcting a response silently destroys every choice answer inside a repeating group, r1 · 3. MAJOR findings (+8 more)

### Community 465 - "3. Form Definition Layer"
Cohesion: 0.07
Nodes (28): B1 — CLOSED. The refusal is in the door, and it is the right door., B1 — The prévia route enforces D1 with a WATERMARK check where the discriminator is the LOCK. A locked `in_signature` ata is served a self-disclaiming ephemeral page., B2 — `app.print_source_head`'s `form_response` arm is satisfied by a constant `true`. Neither lane has a not-head assertion anywhere., B2 — CLOSED. Four assertions, and all five stub shapes red., BLOCKING, C1 — The reserved verb DOES appear on an unregistered surface, on the composed panel, C2 — Stale probe/vector counts in comments — §J's class, polarity flipped, C3 — `find()` in the sync-guard suite is blind to `meeting_disposed`; three lookups are ambiguous (+20 more)

### Community 466 - "3.1 `forms.form_templates`"
Cohesion: 0.12
Nodes (16): Accreditation & Quality-Governance Track (Phases 13–21), Phase 0 — Scaffolding & Environment, Phase 10 — Meetings, Phase 11 — Interviews, Phase 12 — Case Timeline, Phase 1 — Database Schema, Auth & RLS, Phase 2 — Authentication & App Shell, Phase 3 — Admin Area & User Management (+8 more)

### Community 467 - "3.4 `forms.question_types`"
Cohesion: 0.12
Nodes (16): ADR 0185 — Documentation restructure: feature hubs, CURRENT.md, and gated registers for bugs, follow-ups and lessons, Consequences, Considered options, Context, D1 — Feature hubs keyed on the existing program codes, D2 — CURRENT.md, and the Current-state block that lives in each hub, D3 — One bug register with a status column, D4 — One severity scale for bugs and follow-ups, defined by what the item blocks (+8 more)

### Community 468 - "3.6 `forms.form_block_options`"
Cohesion: 0.12
Nodes (16): `170` — the narrowing reached an existing suite, and what changed there, AE2 · QA R2-B1 — the kernel invariant (migration `20261003005900`, suite `396`), Arm domains — derived per object from the catalog, with the harnesses' own domain SQL, Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`, ⚠ ONE DELIBERATE DEVIATION FROM THE SUPPLIED DESIGN — the check ordering, RED-FIRST — and two defects the run found in MY OWN suite, Residuals this increment leaves behind, named, ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**, and here is the ruling it demands (+8 more)

### Community 469 - "4. Answer Storage Layer"
Cohesion: 0.12
Nodes (16): AE3.3's own spec — `e2e/ae3-restricted-details.spec.ts`, 4 tests, green, AE3 — Restricted personal-detail extraction (ADR 0155 D4), Flaky classification — by NAME + fingerprint, never by count (plan rule 11), G2 — re-measured at the branch cut (2026-08-31), Gate AE3 — step 1 (build), measured, Gate AE3 — step 2 (E2E), measured, QA round 1 — `CHANGES REQUESTED`, and the response, QA round 2 — `CHANGES REQUESTED`, and the response (+8 more)

### Community 470 - "34. Permission Resolution Algorithm"
Cohesion: 0.13
Nodes (15): Could not verify, stated as such, Gate AE2 — QA review, round 2 (independent check; different model than round 1), Increment 4, reviewed as new material, Method — every figure below is mine, Minor, New findings, R2-B1 ⛔ BLOCKING — a fully-successful, supported flow is a **standing producer** of the state ADR 0164 accepts as a crash window: invite-provisioned admins are permanently unaffiliated, in no roster, administrable through the six person doors by nobody, R2-M1 ⛔ MAJOR (B5 residue) — the false B5 sentence is live in the catalog (+7 more)

### Community 471 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.12
Nodes (16): 10. Could not verify — stated, not implied, 1. Independent catalog audit — figures enumerated, not exit codes, 2. The census, re-derived — it closes, 3. The guard trigger — retired AND replaced, 4. Tests — was anything weakened to pass?, 5. The two targeted mutation cases — judged by reading (not executed, per mandate), 6. `e2e/ae3-restricted-details.spec.ts` — the D4 assertion is not vacuous, 7. LGPD (the plan's explicit note) — this section is that note (+8 more)

### Community 472 - "Lead notes"
Cohesion: 0.07
Nodes (28): 1. What I measured myself (not read off the record), 2. AC-by-AC, 3.1 Closure per finding, 3.2 The probe — byte-exactness first, then the shapes, 3.3 Non-vacuity — three mutants, each one line, each on a COPY, 3.4 The live population, re-measured (not read off the record), 3.5 New finding, 3.6 Note (+20 more)

### Community 473 - "phase-22.md"
Cohesion: 0.09
Nodes (23): 1. Verdict in one paragraph, 2. Disposition — the broad Gate AE4 review (`authz-ae4-gate-review.md`), 3. Disposition — the IA-F9 statement-scoped review (§ 7's actionable list), 4.1 The site-axis arm's vacuity proof — **it holds, reproduced independently**, 4.2 The depth correction — **correct, and the review's own figure was not wrong**, 4.3 The two new follow-ups — **both verified on the catalog**, 4.4 Gates I executed at HEAD, 4.5 Round 3 — the six closures at `1ac811fe`, re-proven rather than credited (+15 more)

### Community 474 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.09
Nodes (23): 1. Claim 1 — "Nothing was lost." **VERIFIED**, both directions, 2.1 The self-test is not vacuous, 2.2 All four checks fire against the REAL corpus, 2.3 Claim 3 — "Check C's region cut does not blind it." **VERIFIED for the mechanism**, 2.4 What gate 16 does NOT check — four measured holes, 2. Claim 2 — "Gate 16 can actually fail." **VERIFIED**, with four blind spots, 3. Claim 4 — "Gates 12 and 15 moved correctly and re-run green." **VERIFIED**, 4. Claim 5 — citations and links (+15 more)

### Community 475 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.13
Nodes (22): argv, cache, chainToServerOnly(), clauseIsTypeOnly(), clients, files, findings, GATE (+14 more)

### Community 476 - "user-registration.spec.ts"
Cohesion: 0.13
Nodes (15): 1 · Requirements coverage, 2 · Security / RLS (Architecture Rule 1) — the priority, 3 · Rule compliance, 4 · Code quality, 5 · Itemized findings (non-blocking), 6 · What I verified live (summary), INFO-1 — Indicator→CAPA escalation is gated on `patient_safety`, INFO-2 — Derived denominator section resolved from latest published version (+7 more)

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
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 483 - "0012 — clone_form_version returns the existing draft (one draft per form)"
Cohesion: 0.20
Nodes (19): archivePhaseResult(), authorizeCommissionConfig(), authorizeCommissionMember(), commissionOfCasePhase(), commissionOfResult(), createPhaseResult(), mapOverrideError(), mapVocabError() (+11 more)

### Community 484 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 485 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.13
Nodes (15): 1. Linkage key — deterministic, non-reversible keyed hash, 2. Pepper store — a locked-down secrets TABLE `app.app_secrets` (NOT a GUC, NOT Vault), 3. `patient_xref` — a key-only, QPS-only index, 4. Derivation + xref maintenance — ALWAYS-ON triggers (cover RPC writes AND seed inserts), 5. DEFINER doors (each asserts the flag first line), 6. Referral transmission + receiver hint (additive), 7. Audit routing — GLOBAL chain, key-only metadata, 8. Disposal — retain, mark disposed (referrals cascade-only) (+7 more)

### Community 486 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.13
Nodes (15): 0089 — FF-2 Matrix & Risk Matrix: cell contract, risk derivation, required semantics, axis codes, 1. The cell contract is a radio grid — columns are the options, 2. Risk weights live on the axes; `risk_score` is derived server-side, 3. `required = true` on a matrix means every row is answered, 4. Axis codes are immutable once they exist, A. 🔴 `app.instance_is_empty` is blind to the matrix tables — new finding, B. 🔴 The correction-copy obligation, inherited from FF-1's P0-1, C. `clone_form_version` does not copy the axes — INFO-1, matrix half (+7 more)

### Community 487 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.15
Nodes (11): CaseStatusBadgeFixed(), QualityBoardView(), SortDir, SortHeader(), SortKey, STATUS_RANK, ADR-0100, Chip() (+3 more)

### Community 488 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.05
Nodes (67): ADR-0182, metadata, OrgCaseTypesPage(), ADR-0051, ADR-0064, participantDisplayName(), ParticipantRow(), CaseTypeManager() (+59 more)

### Community 489 - "21. Recommended Dashboard Views"
Cohesion: 0.11
Nodes (33): a4_case(), a4_drive(), arm_inflight(), build_pol_worklist(), classify(), ddl_block_finding(), degenerate_write_policies(), disarm_inflight() (+25 more)

### Community 490 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.13
Nodes (15): 10. `get_feature_flags` (`queries/feature-flags.ts:getFeatureFlagsServerOnly`), 11. `lookup_printed_document` (`queries/printed-documents.ts:lookupPrintedDocumentVerification`), 1–2. `complete_evidence_upload_verification` + `complete_document_upload_verification`, 3. `complete_document_reclassification` (`documents/actions.ts:reclassifyDocument`), 4. `complete_document_disposal` (`documents/actions.ts:reclassifyDocument`), 5–7. `fail_minutes_job` ×3, 8. `complete_minutes_job` (`minutes-jobs/webhook.ts:handleMeetingMinutesCallback`), 9. `list_stale_meeting_audio` (`minutes-jobs/sweep.ts:sweepStaleAudio`) (+7 more)

### Community 491 - "27. Example: Simple Action Item"
Cohesion: 0.18
Nodes (10): compareEvents(), NOTE: the column is `assigned_at` → `assignedAt`. `ReferralAssignment` has, sideOf(), synthesizeThreadEvents(), ADR-0094, timeKey(), ADR-0094, REFERRAL_DECLINE_REASON_LABELS (+2 more)

### Community 492 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.13
Nodes (14): 1. Tech assumptions, 2. Typography, 3.1 Theme — "Clinical Calm" (the palette used on both screens), 3.3 Review-status accents (stable), 3. Color tokens, 4. Spacing, radii, shape, 6. Shared components, 7. Screen A — Overview (KPI + Table) (+6 more)

### Community 493 - "case-narratives.md"
Cohesion: 0.04
Nodes (25): AID_NAV, AID_TWEAK_DEFAULTS, AidApp(), AidActivity(), AidChecklist(), AidDetails(), AidReminders(), TweakColor() (+17 more)

### Community 494 - "case-patient.md"
Cohesion: 0.16
Nodes (11): activate(), createCase(), createResult(), insertOptions(), rpc(), saveAndSubmit(), signInAs(), slug() (+3 more)

### Community 495 - "layout-adjustments-2026-07.md"
Cohesion: 0.13
Nodes (14): 1. Purpose, 20. Reminder Rules, 22. Recommended Indexes, 28. Example: Complex Action Item, 2. Core Architectural Decision, 30. Final Architecture Summary, 4. Domain Overview, 5. Entity Relationship Diagram (+6 more)

### Community 496 - "loading.tsx"
Cohesion: 0.13
Nodes (15): 4. Detailed audit findings, F-01 — standard-bucket confidentiality bypass, F-02 — disposed PHI remains openable, F-03 — reclassification can detach metadata from bytes, F-04 — metadata/object identity is not enforced, F-05 — the authorization model cannot express committed sharing requirements, F-06 — owner-dispatch polymorphism is a scaling seam, not a universal aggregate, F-07 — document, version, placement, and blob are conflated (+7 more)

### Community 497 - "loading.tsx"
Cohesion: 0.29
Nodes (13): acknowledgeEvent(), cancelEvent(), disposeEventPhi(), notifySafetyEvent(), revalidateSafety(), setEventPatient(), transferEventCustody(), ADR-0030 (+5 more)

### Community 498 - "loading.tsx"
Cohesion: 0.13
Nodes (14): 15. Read interfaces and Case detail composition, 16. Ethics lifecycle mapped to the shared model, 19. Required indexes, 1. Executive decision, 22. Open decisions requiring human approval, 23. Acceptance criteria for implementation readiness, 24. Handoff summary, 2. Goals (+6 more)

### Community 499 - "19. Templates"
Cohesion: 0.09
Nodes (22): 2026-09-10 — authz seam slice appended, Current state replaced (backend), 2026-09-10 — backend plan received; PO rulings R1–R3; two lead decisions (lead), 2026-09-10 — build reported; the blocking red ruled (R4) and two deviations accepted (R5) (lead), 2026-09-10 — E2E: `e2e/admin-arm-is-active.spec.ts` written, run, GREEN (tester), 2026-09-10 — E2E loop closed: the two fixed specs GREEN on the prod build; the gate chain at the final tip (lead), 2026-09-10 — fix-loop iteration 1: QA's two MINORs discharged (backend), 2026-09-10 — GATE AT THE TIP `a74f2409`, run by the lead (not the builder), detached, every rc read bare (lead), 2026-09-10 — pushed on the PO's explicit instruction, after the Record step (lead) (+14 more)

### Community 500 - "24. Row-Level Security Considerations"
Cohesion: 0.07
Nodes (25): 0. Source anchors (what already exists — E3 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Seed (E3a — backend, `supabase/seed.sql`), 2.3 TS layer (`backend`-owned) — the terminology read (first-ever consumer), 2.4 RLS, 2.5 Terminology-wiring touch-list (frontend, off the frozen §2 contract), 2. E3a canonical contract (BACKEND posts these typed stubs FIRST) (+17 more)

### Community 501 - "25. MVP Implementation Recommendation"
Cohesion: 0.13
Nodes (15): 0. Scope, 1. Sequencing & dependencies, 2. Collision matrix — shared surfaces, serialized ownership, 3. Phased sequence, 4. Feature-flag plan, 5. Migration ownership & docs, 6. Testing & gates, 7. Risks & open decisions (+7 more)

### Community 502 - "9. Assignments: `action_item_assignments`"
Cohesion: 0.13
Nodes (15): 0. Why, 1. The three-bucket disposition (summary — full rationale in the evaluation doc), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4), 5. Avoided items (recorded so builders don't reintroduce them), 6. Testing & gates, 7. Risks & open decisions for the product owner (+7 more)

### Community 503 - "13.1 Recommended additions to `action_items`"
Cohesion: 0.13
Nodes (15): Carried into DM2 (do not re-derive), DM1 — substrate cutover: phase record (backend task log), Gate step 2 — tests, Gate step 3 — QA: **APPROVED**, Gate step 4 — human approval, Gate steps 2–5 (lead-run, 2026-08-12/13), Parked seams (what DM1 deliberately left behind), PROD-VERIFY checklist (lead condition 2 — for the later lead-authorized `db push`; NO remote action was taken this phase) (+7 more)

### Community 504 - "15.1 `audit_events`"
Cohesion: 0.13
Nodes (14): 1. Scope-aware RLS matrix — PASS (the headline result), 2. Guard invariant (Q3/Q4) — PASS, 3. Case-source RPC authority — ADR-0033-D4 **holds** (PASS), 4. Six-consulter expiry (Rule 12 critical) — PASS, 5. Audit (Rule 11) — PASS, 6. Drop completeness — PASS, 7. Frontend (`case-access-panel.tsx`) — PASS, 8. Backend's two beyond-spec decisions — both VALID (PASS) (+6 more)

### Community 505 - "17.2 `ethics_case_allegations`"
Cohesion: 0.13
Nodes (15): Application and test evidence, Authoritative external references, Authorization-evolution plan audit — 2026-08-27 (CHANGES REQUESTED), Cross-cutting architectural assessment, Evidence index, Executive conclusion, Final disposition, Repository design and live-state evidence (+7 more)

### Community 506 - "17.4 `ethics_decision_details`"
Cohesion: 0.13
Nodes (15): 1. The P0 — C7/A8 is implemented in the policies and **reversed in the DEFINER doors**, 2. MAJOR-1 — `meeting_agenda_items.description` is unmasked, and PHI-BEARING by its own comment, 3. MAJOR-2 — reserved-session content escapes the meeting child lock, 4. THE 228 ADJUDICATION (tests 115–118) — **the lead's read is CORRECT; one correction is load-bearing**, 5. What I verified as sound, 6. MINOR / INFO, 7. Open risks, 8. Summary (+7 more)

### Community 507 - "19.1 M&M Patient Case"
Cohesion: 0.09
Nodes (22): 0. Headline, 1. Method — what I measured, and how, 2.1 The migration (`20261003007350`), 2.2 `410` § 6.2 — the transitive fixed point (D4, both directions), 2.3 The plants left no residue, 2.4 § 8.5 / § 8.6 / § 8.7 / § 8.8 and the class enumeration, 2.5 The runbook figures that *were* re-measured (Batch 5), 2.6 Requirements, clause by clause (+14 more)

### Community 508 - "5.1 `case_types`"
Cohesion: 0.13
Nodes (14): 10. Wizard `InputItem` re-renders per keystroke — **LOW**, 1. No root or global error boundary — **HIGH**, 2. No streaming anywhere + filters give no pending feedback — **MEDIUM-HIGH**, 3. Sequential-await waterfalls in ~16 pages — **MEDIUM**, 4. `server-only` is a dependency but never imported — **MEDIUM**, 5. Four copies of the same GSAP rise-in wrapper — **MEDIUM-LOW**, 6. Oversized client components — **MEDIUM-LOW**, 7. Raw amber classes bypass the `--warning` token — **LOW** (+6 more)

### Community 509 - "5.3 `committee_cases`"
Cohesion: 0.18
Nodes (11): 10. Frontend-owned `audit-icon.tsx` touch — ✅ CORRECT / MINIMAL, 1. No direct write path on `memberships` — ✅ VERIFIED (catalog + runtime), 2. Door authority = incumbent verbatim; no privilege widening — ✅ VERIFIED, 3. Shape CHECK exhaustive — ✅ VERIFIED (runtime), 4. Predicate wrappers behavior-preserving; no missed predicate — ✅ VERIFIED, 5. Unified `membership.*` audit; PHI-free; legacy hard-cut — ✅ VERIFIED, 6. ADR 0075 write-path split — ✅ SOUND, 7. CASCADE fix (`20260720000500`) — ✅ VERIFIED (+3 more)

### Community 510 - "6.5 `case_participants`"
Cohesion: 0.13
Nodes (14): Acceptance Criteria Audit, Client Factories (`src/lib/supabase/`), Code Quality Review, `database.ts`, Findings, INFORMATIONAL — ADR 0001 records a superseded decision, MINOR-1 — `layout.tsx` declares `lang="en"` instead of `lang="pt-BR"`, MINOR-2 — PROGRESS.md "Follow-ups" has a stale open item (+6 more)

### Community 511 - "8.2 Recommended additions to `form_responses`"
Cohesion: 0.14
Nodes (14): 2026-09-12 — E2E pass (tester), 2026-09-12 — Phase Gate step 1 (lead): the four authz arms, the deriver, the targeted case, the set-valued arm, 2026-09-12 — QA r1 MINOR-2/3/4 + NOTE-1 fixed (backend), 2026-09-12 — steps 1–5 built, AC-6 generator landed, AC-8 re-keyed; all backend gates green (backend), 2026-09-12 — the owed post-QA-fix `test:db` witness (backend), 2026-09-12 — unit opened; the subject measured from the catalog; the surface mapped (lead), 2026-09-13 — Record step (lead): PO approval, the hub's current state cut in at close, AE5-ROLE-CATALOG-COMPAT — progress record (+6 more)

### Community 512 - "3.14 `forms.block_library_items`"
Cohesion: 0.13
Nodes (15): 0. Evidence discipline — what is verified, read, and inferred, 1. BLOCKER, 2. MAJOR, 3. MINOR, 4. Audit checklist — where each item landed, 5. What holds — verified, not assumed, 6. What I could not check, and what it costs, 7. Re-review scope (+7 more)

### Community 513 - "3.15 `forms.block_library_options`"
Cohesion: 0.31
Nodes (14): bad(), expect_green(), expect_green_because(), expect_red(), gate(), ok(), scen_a1(), scen_a2() (+6 more)

### Community 514 - "3.17 `forms.form_matrix_rows`"
Cohesion: 0.13
Nodes (15): ADR 0167 — commission `staff_admin` has ONE authority, on both sides, ADR 0167 gate — run by the lead on a fresh reset (2026-08-28), Arm domains, derived per function from the catalog, Gate figures, re-measured (exit codes captured directly, never through a pipe), Mutation audit — 20 mutants, keyed by SUBJECT, both polarities per gate, Prose corrected (ADR 0167 clause 3), and one stale claim left as-is, ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**: migrations touched, ZERO cases derived, The grant/revoke agreement property, and why it is SCOPED (+7 more)

### Community 515 - "3.18 `forms.form_matrix_columns`"
Cohesion: 0.20
Nodes (12): branchCell(), esc(), label(), main(), ADR-0185, ADR-0186, renderIndex(), STATUS_LABEL (+4 more)

### Community 516 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.10
Nodes (36): rel(), args, AUTH_ADMIN_READ_METHODS, AUTH_ADMIN_WRITE_METHODS, buildImportTable(), classifyExpressionDirect(), classifyIdentifier(), classifyRoot() (+28 more)

### Community 517 - "3.9 `forms.form_logic_rules`"
Cohesion: 0.10
Nodes (21): ⭐ An invariant, and the mechanism that is actually holding it up, `app.can_read_full_case_content(p_case_id, p_uid)` — the seven-axis mask predicate, App layer (the pure-renderer purity gate still holds), Authz-sweep coverage of this surface — state it before quoting a green ARM, Backend State — document printing and dossiers, Current state, `dispose_case_phi` — blocks (f) and (f2), and the conjunct that made C-1 load-bearing, Invariants (+13 more)

### Community 518 - "4.10 `form_responses.form_answer_revisions`"
Cohesion: 0.22
Nodes (9): PHASE_MESSAGE, ReferralReplyAttachmentUpload(), ADR-0114, UploadPhase, AttachedRow, mergeAttachedRows(), DocumentUploadCredential, ReferralReplyDocument (+1 more)

### Community 519 - "4.11 `form_responses.form_submission_section_states`"
Cohesion: 0.06
Nodes (32): metadata, OrgUsersPage(), ADR-0097, ADR-0133, ADR-0151, PersonAvatar(), personInitials(), includeEndedValue() (+24 more)

### Community 520 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.14
Nodes (14): 0065 — Pre-Pilot Foundations conventions (polymorphism · identity · Rule-12 taxonomy · freeze), 1. Three sanctioned polymorphism dialects (closes D12), 2. Identity/subject convention, 3. One Rule-12 sensitivity taxonomy (drafted here, applied per-phase), 4. Disposal composition order, 5. Catalog-table vs CHECK-enum convention, 6. Freeze principle, 7. Reference → participants bridge (+6 more)

### Community 521 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.29
Nodes (7): R2.0 What I re-measured myself this round, R2.1 Disposition of the round-1 findings, R2.2 The three corrections to my own round-1 findings — adjudicated on the evidence, R2.3 New findings this round, R2.4 Gate AE1, item by item, as it stands now, R2.5 Required changes (round 2), ROUND 2 VERDICT: CHANGES REQUESTED — narrowed to ONE blocking item

### Community 522 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.29
Nodes (7): 6.1 Design principles, 6.2 Recommended schemas, 6.4 Decision algorithm, 6.5 Deep authorization interface, 6.6 Authorization context, 6.7 What not to make generic, 6. Greenfield design

### Community 523 - "4.6 `form_responses.form_answer_signatures`"
Cohesion: 0.14
Nodes (13): 12. Open decisions requiring human/domain approval, 13. Risk register, 14. Program-level acceptance criteria, 15. Explicit non-goals and anti-patterns, 16. Resume checklist for a future lead, 2. Ubiquitous language for the redesign, 5. Current strengths to preserve, 7.1 In scope (+5 more)

### Community 524 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive), 2.2 Predicates / helpers (`app` schema, DEFINER, uid-pure — mirror `can_read_event`), 2.3 RPCs (all gate `case_access`; DEFINER unless noted), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Backend tasks (`backend`) (+6 more)

### Community 525 - "4.8 `form_responses.form_answer_risk_matrix`"
Cohesion: 0.10
Nodes (20): Acceptance criteria, ARM3-HAT-TERM-FIX — QA review, BLOCKING, Could not verify (⛔ a work item, never an implied pass), Could not verify (⛔ a work item, never an implied pass), Findings, MAJOR, MAJOR (+12 more)

### Community 526 - "4.9 `form_responses.form_answer_references`"
Cohesion: 0.14
Nodes (14): 10. Typed signatures posted for frontend, 11. Scope gap flagged, not silently expanded or dropped, 12. `ARM=census` did not grow — explained, not assumed, 12b. Gate — full Phase Gate step 1, 1. DB layer — what landed, 2. Two catalog findings, both fixed before the pgTAP pass, 3. Auto-derivation — the lever that made ~1949 call sites tractable, 4. `claims_for` needed `SECURITY DEFINER` (a second finding, found live) (+6 more)

### Community 527 - "10. Table: `documents`"
Cohesion: 0.14
Nodes (14): 0. Why, 1. Three-bucket disposition (summary — full rationale in ADR 0070 / the handoff), 2. Design spine — cross-cutting rules every phase conforms to, 3. Phased sequence, 4. Lifecycle state machine (the load-bearing contract), 5. Deferred (E1) & Avoided — recorded for builders, 6. Risks & open items, I0 — Design & contract gate  *(design; no migration)* (+6 more)

### Community 528 - "14. Table: `document_version_assets`"
Cohesion: 0.14
Nodes (14): 1. Goal, 2.1 Data model (migration, additive — SUP core, `20260720000600_supersession_core.sql`), 2.2 Predicates / helpers (`app` schema), 2.3 RPC (DEFINER; SQLSTATE `HC0H·`; t19 grant hygiene), 2.4 Data-access + action stubs (`src/lib/**` — posted first), 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them), 3. Aggregation retrofit (LOAD-BEARING — the full-review item), 4. Audit (+6 more)

### Community 529 - "40. Example Scenarios"
Cohesion: 0.14
Nodes (13): ADR 0134 Amendment 4 — rotated 2026-08-22, ADR 0134 Amendment 6 — rotated 2026-08-22, BUG-ADM-APPOINT-CAPS-NOT-SYNCED — filed 2026-08-22 by the tester, Case surface split — Increment 2 (ADR 0134), Gate caveats — what the Test Run Summary's ⚠ points at, `orphan-administrativo-reachability.spec.ts` — executed standalone (QA r2 condition **C-2**), Pre-work measurement — rotated 2026-08-22, Push record (restored 2026-08-23) (+5 more)

### Community 530 - "8. Table: `app_resources`"
Cohesion: 0.10
Nodes (21): 0 · Verdict line, 10 · Summary — and the honest answer, 1 · Method, 2 · The seventh, measured, 3 · The round-3 items, re-measured, 4 · Does removing the numbers cost anything a reader needed?, 5 · What I tried to break, 5a · Both widened classes, and the fixtures that now pin them (+13 more)

### Community 531 - "9. Table: `document_kinds`"
Cohesion: 0.03
Nodes (73): ADR 0097 — Hospital affiliation, person identity (CPF) and the org-scoped people directory, Affiliation, Alternatives rejected, Consequences, Context, Decisions, Doors and boundaries, Identity (+65 more)

### Community 532 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 0. Scope, 10. Task breakdown (contract-first; one Phase Gate), 11. Risks / open decisions, 1. Catalog reconciliation (spec §21 is stale — use these, verified 2026-07-20), 2. Schema (migration `20260818000000` — after the latest shipped `20260817002200`), 3. Typed contract (`backend` posts stubs first — contract-first), 4. Cadence semantics (`meeting_cadence_status`, migration `20260818000100`), 5. Carry-forward semantics (`suggest_carry_forward`, migration `20260818000100`) (+5 more)

### Community 533 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.01
Nodes (218): EvidenceCombobox(), UpdatesSection(), AuditLabelOption, ADR-0051, AuditIntegrityCheck(), AddParticipantDialog(), CaseOutcomeSelector(), TOKEN_COLOR_VAR (+210 more)

### Community 534 - "hospital-admin-tier.spec.ts"
Cohesion: 0.38
Nodes (11): anchorLine(), byteOrder(), cell(), code(), digestOf(), GENERATED_BANNER(), header(), md5() (+3 more)

### Community 535 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.22
Nodes (11): csvField(), GET(), toCsv(), ADR-0020, ADR-0029, RFC-4180, AuditAccessAction, logAuditAccess() (+3 more)

### Community 536 - "async-cheap-condition-before-await.md"
Cohesion: 0.14
Nodes (14): 1. Headline verdict, 2. The six Criticals — per-finding verdict, 3. The Highs — per-finding verdict, 4. Mediums / Lows — condensed, 5. Where the audit is wrong or overstated (correct these before acting), 6. Strategic recommendations (§6) & opportunities (§7), 7. Recommended pre-pilot action list (my triage, not the audit's), C-1 · `audit_log` destructible by TRUNCATE — **AGREE, but latent (not reachable via the app)** (+6 more)

### Community 537 - "Prefer Statically Analyzable Paths"
Cohesion: 0.03
Nodes (58): 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3), Consequences, Context, Decision, 0069 — Anglicize status-enum internal keys (D11), Consequences, Context, Decision (+50 more)

### Community 538 - "server-hoist-static-io.md"
Cohesion: 0.14
Nodes (13): 1. Requirements Audit (per Acceptance Criterion), 2.1 Signer-role rule is byte-equivalent (no broadening of WHO may sign), 2.2 `signoffs_select` exposes metadata only, not answers, 2.3 SECURITY DEFINER hygiene, 2.4 `sign_section` constraint completeness, 2.5 The P6-001 fix did not weaken authz, 2.6 Submission authority & single-sourcing, 2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite) (+5 more)

### Community 539 - "loading.tsx"
Cohesion: 0.14
Nodes (14): 1.1 Inert-table RLS: scoped-read + write-inert (Rule 1 · F2 "K9" precedent), 1.2 No new PHI surface (Rule 12), 1.3 Stale-symbol trap closed, 1. Security / RLS — PASS (live-verified), 2.1 Byte-for-byte SQL↔TS mirror for the 4 new ops, 2.2 The ops are non-authorable (live-verified), 2.3 Golden vectors cover operator × value_type, 2. Rule 3 — evaluator parity + non-authorability — PASS (live-verified) (+6 more)

### Community 540 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.14
Nodes (14): 0. Method, and one correction to the plan's stated method, 10.1 D2 — does a lapsed coordinator receive CONTENT or only a ping? **Content. Measured, not inferred.**, 10. Dispositions — every legacy-vs-matrix difference, 2. Plane 2 — the RLS surface, by resource family, 3. Plane 3 — doors branching on the role, 5.1 RULING — shape: a narrower permission code whose ABSENCE is the deny (option iii), 5.2 Expiry date: **2026-12-01** — ✅ APPROVED BY PO 2026-09-01, and written into ADR 0169, 5. The recusal exception — shape ruling, and the expiry date owed (+6 more)

### Community 541 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.04
Nodes (43): Actual behavior, BUG-0137-MRN-WARNING-TEST-FLAKY — `npm run test` reds nondeterministically on the referral MRN-warning suite, Expected behavior, Fix, Impact, Investigation, Lesson, Regression protection (+35 more)

### Community 542 - "Phase 8 — Dashboards & Submissions Browser (archived task detail)"
Cohesion: 0.10
Nodes (20): 2026-09-10 — arm 3 derived against the live catalog; a live unmasked grant found (lead + backend), 2026-09-10 — unit opened; scope derivation begun, nothing built (lead), 2026-09-11 — GATE AT THE TIP `29422327`, run by the lead (not the builder), detached, every rc read bare (lead), 2026-09-11 — `lint` re-run BARE at `00846736`: rc 0 · QA round 2: **APPROVED** (two MINORs, discharged here) (lead), 2026-09-11 — `lint` re-run BARE at tip `eaf1757a` (record entry + hub block after the gate): **rc 0** (lead), 2026-09-11 — merged: `main` fast-forwarded to the phase commit `5ffeed2c` (written on `main`) (lead), 2026-09-11 — `origin/authz-ae5-matrix-arm3-cells` DELETED on the PO's explicit instruction (lead), 2026-09-11 — PO rulings on this unit's two remaining follow-ups (seam split noun; door-comment carrier) (lead) (+12 more)

### Community 543 - "loading.tsx"
Cohesion: 0.26
Nodes (10): choiceItem(), NO_PAYLOAD, opt(), choiceItem(), Harness(), section(), ADR-0136, wizardData() (+2 more)

### Community 544 - "loading.tsx"
Cohesion: 0.17
Nodes (12): 1. Executive Summary, 2.1 A referral does not transfer case ownership, 2.2 A referral has one source and one target committee, 2.3 Shared information must be explicit, 2.4 Shared messages and internal notes are different security domains, 2.5 A response is not the same as resolution, 2.6 Important records are append-only, 2. Core Domain Principles (+4 more)

### Community 545 - "21. Recommended Dashboard Views"
Cohesion: 0.07
Nodes (36): CaseReferralsModule, CaseOutboundReferralsCard(), ADR-0094, ADR-0137, formatDate(), EMPTY_REFERRAL_PATIENT_DRAFT, ReferralPatientDraft, referralPatientDraftHasData() (+28 more)

### Community 546 - "27. Example: Simple Action Item"
Cohesion: 0.10
Nodes (20): 2026-09-11 — ADR renumbered 0207 → 0209 before the rebase: `main` had moved 11 commits and landed a DIFFERENT 0207 (lead), 2026-09-11 — `e2e:prod` GREEN at `3d85c403`; the QA fix pass re-gated on a fresh reset (lead), 2026-09-11 — merged: `main` fast-forwarded to `df1d4934` (lead), 2026-09-11 — QA fix pass: B1 narrowed in three homes, M1 disposition declared, m2 fourth line, two follow-ups (backend), 2026-09-11 — QA round 1 CHANGES REQUESTED (B1 · M1 · m1–m3 · n1–n5); lead rulings; two E2E false starts disclosed (lead), 2026-09-11 — QA round 2 CHANGES REQUESTED on four text edits (R2-1…R2-4); applied and re-gated (lead), 2026-09-11 — QA round 3 (targeted re-check) APPROVED at `9fcd6edc`; hub gated, awaiting human approval (lead), 2026-09-11 — rebased onto `main` (`dd3629be`); lead gate at the rebased tip `9057829a`, every rc bare (lead) (+12 more)

### Community 547 - "21. Recommended Dashboard Views"
Cohesion: 0.21
Nodes (16): derive_worklist(), emit(), hash_of(), mutate(), periodic_reset(), preflight_degenerate(), preflight_residue(), psql_c() (+8 more)

### Community 548 - "loading.tsx"
Cohesion: 0.10
Nodes (20): 2026-09-09 — build (backend), 2026-09-09 — deriver false FINDING (1) on the declare+replace cell (backend), 2026-09-09 — gate at the tip (lead, run by someone other than the builder), 2026-09-09 — merge and push witness (lead, on `main` after the fast-forward), 2026-09-09 — plan received; lead spot-check; rulings put to the PO (lead), 2026-09-09 — PO rulings R1–R3; lead rulings L1–L11; build authorised (lead), 2026-09-09 — QA MINOR closed: the AFTER landing assertions proven able to fire (backend), 2026-09-09 — QA verdict, the MINOR closed, and QA's "could not verify" list dispositioned (lead) (+12 more)

### Community 549 - "loading.tsx"
Cohesion: 0.05
Nodes (71): CaseActionItemForm(), PhaseOption, ActionItemRow(), CaseActionItemsPanel(), isItemOverdue(), STATUS_ORDER, ADR-0033, ActivityFilter (+63 more)

### Community 550 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 0087 — FF-1 Repeating Groups: instance engine, condition scoping, required semantics, 1. Nesting is capped at depth 1, enforced in the schema, 2. Condition scoping — inside-out resolves, outside-in is forbidden at publish, 3. A fully-empty instance is not incomplete — it is not there, 4. FF-1 drops `form_items_conditional_not_required` globally, 5. Instance writers are INVOKER RPCs — correctness doors, not security doors, 6. Both container types ship; `group` is a pure visual container, Amendment 1 (2026-07-27, same day) — three corrections found at plan review (+5 more)

### Community 551 - "loading.tsx"
Cohesion: 0.15
Nodes (13): A fifth site, found by the constraint rather than by reading, ADR 0094 — Membership-model hardening + Diretor Técnico (technical director) backend, Amendment 1 — the four open items, closed (PO, 2026-08-04), Amendment 2 — build-time corrections to decision 2 (W1, verified against the catalog), Amendment 3 — W4 build state (2026-08-04), Amendment 4 — the DT referral plane, settled by interview (PO, 2026-08-04), Amendment 5 — what building the referral plane actually found (2026-08-04), Consequences (+5 more)

### Community 552 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-12 — AC-1 … AC-5 built: `414 § 0b` owns the remedy, `421 § 0c` points at it, a control in each (backend), 2026-09-12 — gate step 1 run by the lead; step 2 ruled N/A; QA spawned (lead), 2026-09-12 — hub `## Current state` at completion, cut here verbatim (lead), 2026-09-12 — QA r1 APPROVED (0/0/3 MINOR/4 NOTE); MINORs corrected; full-suite witness re-earned; QA r2 spawned (lead), 2026-09-12 — QA r1 MINORs corrected (backend), 2026-09-12 — QA r2 APPROVED; hub → gated; awaiting human approval (lead), 2026-09-12 — step 4 human approval; step 5 Record (lead), 2026-09-12 — unit opened; the ruling located; the closing branch chosen (lead) (+1 more)

### Community 553 - "loading.tsx"
Cohesion: 0.15
Nodes (13): ADR 0120 — DM5 (Wave D + retirement) decisions, ⚠ AMENDMENT (2026-08-14, after implementation): the DETAIL half of D18 guards nothing reachable, Consequences, ⚠ CORRECTION, made before this ruling was recorded: a remote reset does NOT clear orphaned bytes — it CREATES them, D17 — DM5 designs for a RESET remote (PO ruling, 2026-08-14), ⚠⚠ D18 IS PRESENTATION, NOT AN ACCESS CONTROL — Architecture Rule 1, D18 — printed renditions are FILTERED OUT of the Documentos panel (PO ruling, 2026-08-14), ⛔⛔ D3, D4 and D5 ARE WITHDRAWN — superseded by D11 (PO re-ruling, 2026-08-14, same day) (+5 more)

### Community 554 - "loading.tsx"
Cohesion: 0.15
Nodes (11): 0154 — the roster predicate is the query filter, not `list_org_people`, Consequences, Context, Decision, 0158 — the hospital directory keeps its predicate: no org-affiliation filter at the hospital tier, 1. `listHospitalUsers` never keyed on `home_organization_id`, 2. The org-affiliation predicate is UNREADABLE to the role that surface serves, 3. What executing 0154 D1 would actually have done (+3 more)

### Community 555 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 1. Core table `public.attachments`, 2. 🆕 `public.attachment_references` — non-authorizing "also appears here" pointers (ADR-0063 §1), 3. 🆕 `public.attachment_subjects` — descriptive, PHI-safe "what it's about" (ADR-0063 §2), 4. `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063), 5.1 Immutability guard ⚙ (clone of `app.guard_case_narrative_frozen`), 5.2 Audit trigger ⚙ (`app.audit_write` + `app.audit_diff` — allow-list excludes PHI columns), 5.3 Dispatchers (schema `app`, DEFINER — CASE to existing domain predicates), 5.4 RPCs (`public`, DEFINER) + feature flag (+5 more)

### Community 556 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 5. Findings, F10 — Medium-low: the delegated committee appointment table lacks direct subject and scope FKs, F11 — Medium-low: the project has no general principal model, F12 — Operational: Data API exposure behavior should be explicit, F1 — High: the standing role model is a closed, duplicated vocabulary, F2 — High: one record conflates affiliation, role assignment, and current state, F3 — High: scopes are fixed to exactly three nullable foreign keys, F4 — High: authorization mechanisms are fragmented without shared permission semantics (+5 more)

### Community 557 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 8. Phased implementation plan, D5A — referral attachments and frozen snapshots, D5B — NSP RCA/CAPA evidence, D5C — printed/generated documents, D5D — meeting audio and processing artifacts, Phase D0 — ratification and production census, Phase D1 — current-model security remediation, Phase D2 — resource, document, file, and access foundation (+5 more)

### Community 558 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 10. Flag store, 1. The canEdit predicate is `app.is_staff_admin_of(commission_id)` — nothing wider ❗, 2. Audit action names in the plan violate the `audit_log` CHECK ❗, 3. The audited-read door is an allowlist in **two** places — and admin-permissive ❗, 4. `action_items` insert door — call it, don't re-implement (confirmed) + two riders, 5. `app.enqueue_notification` — 10 positional args (B7), 6. FK posture: `ON DELETE CASCADE` (B0.3 answered), 7. Meeting write guards — the `app.in_meeting_rpc` GUC ❗ (+5 more)

### Community 559 - "loading.tsx"
Cohesion: 0.03
Nodes (103): ADR-0025, ConfirmRemoveButton(), CaseMeetingsPanel(), CarryForwardPanel(), formatDate(), statusLabel(), ADR-0080, TitleAssignControl() (+95 more)

### Community 560 - "10. Related Records: `action_item_related_records`"
Cohesion: 0.15
Nodes (13): § Now — concluded bullets, rotated 2026-08-21, Rotated 2026-08-23 at the AFF2 Record step — the § Now build-start bullet, Rotated 2026-08-24 at the ADR 0137 Record step — four concluded § Now bullets, ↩ Rotated from PROGRESS.md § Now 2026-08-23 — size discipline (79,876 B of an 80,000 B cap), Second rotation — 2026-08-22, at the case-surface-split Increment-2 build start, The AFF2 bullet, The C1a correction (2026-08-19), rotated from inside the "▶ Next, in order" item, The case-surface-split bullet (+5 more)

### Community 561 - "11. Updates: `action_item_updates`"
Cohesion: 0.15
Nodes (13): A. Verbose Phase Status cells — 15 rows (14e · 22-v2 · 22-v3 · DM · DLB · ETH·E4 · case-custom-fields · bulk-case-create · PCI · AFF · MIN · TV · QO·A · QO·B · PDF·P1 · PDF·P2 · ACT), Archive — Phase Status gate detail (rotated from PROGRESS.md), B. "Recently completed" table — the verbose "Still open" column (rotated 2026-08-12, re-rotated here), C. "Completed work (archived to docs/progress/)" — the ad-hoc/out-of-phase list, verbose form, Completed work (archived to docs/progress/), Completed work (archived to docs/progress/), ⬛ DM3 + DM2 — rotated 2026-08-14 (the DM4 Record step); detail in `docs/progress/`, ⬛ DM4 — Wave C: referrals — ✅ PO-approved 2026-08-14, rotated at the DM5 open (+5 more)

### Community 562 - "12. Status History: `action_item_status_history`"
Cohesion: 0.15
Nodes (12): Backend review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Lower-severity / omissions, R1 — MAJOR: the multi-org PHI guard silently disables the participant-keyed patient door, R2 — MAJOR: tenancy-key mismatch — participants anchor to `organization_id`, but `cases`/`case_patient` anchor to *commission*, R3 — MAJOR: the re-key breaks `patient_index` (ADR 0039, the 4th PHI surface) — unaddressed, R4 — MEDIUM: "N-per-case" collides with the `patient_enabled` snapshot + write-tight invariant, R5 — MEDIUM: integrity gap — nothing prevents a `professional` participant from getting a patient satellite (or vice-versa), R6 — MEDIUM: `can_read_case` recursion risk when participants become a read input (E1), not E0 (+4 more)

### Community 563 - "13. Follow-Ups: `action_item_follow_ups`"
Cohesion: 0.10
Nodes (20): 2026-09-05 — backend: plan + build, ⛔ A STEP-11 BLOCKER FOUND AT STEP 8 — the re-baseline would RED `ARM=census`, `act-hat-blind-sweep.sh:18` — corrected against the catalog query, not memory, Bookkeeping — and a SEQUENCING correction to the plan, For the lead — the ONE-LINE lead-playbook §4 sentence the targeted home needs, Gate at the step-8 boundary — bare exit codes, nothing piped, Notes carried into step 11 (after the CARRIED ruling), Step 1 — fresh reset, §1 re-measured on the live catalog (+12 more)

### Community 564 - "14. Evidence: `action_item_evidence`"
Cohesion: 0.20
Nodes (10): B1 — A COVERED row is filed inside the `## BLIND` table, and the invariant arm reads the SECTION, not the verdict column, B2 — The write arm's committed BLIND set gains **5 policies that are not on `authz-blind-allowlist.txt`**, and no document in the unit says so, B3 — `FUP-…-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES` mis-states the direction census, contradicts its own cluster list, and over-claims one finding, B4 — The re-earned baseline still opens by telling the reader not to read it as the audit's result, BLOCKING, NON-BLOCKING (fix at the Record step), Re-review scope, Round 1 — 2026-09-08 @ `6d0db87a` (CHANGES REQUESTED) (+2 more)

### Community 565 - "15. Reviews: `action_item_reviews`"
Cohesion: 0.07
Nodes (26): Case surface split — Increment 1 (ADR 0134), § Now bullet, rotated verbatim 2026-08-22, The § Now narrative, verbatim at rotation, 7.10 New coverage — judged, including the vacuity question, 7.11 Could not verify (r2), 7.12 r2 verdict, 7.1 Method (r2), 7.2 F-1 — fixed, both halves, and the harder half holds (+18 more)

### Community 566 - "16. Checklist Items: `action_item_checklist_items`"
Cohesion: 0.15
Nodes (12): 1. The property, and how it was bounded, 2. Verdict summary, 3. CONFIRMED-reachable (14) — every one EXECUTED, not reasoned, 3a. The child-lock defect — 10 statements, 4 guards (FIXED by `20261003000000`), 3b. Legal hold — 4 rows, BY DESIGN (no fix owed), 4. STRUCTURALLY-UNREACHABLE (9) — named by the mask bit that proves it, 5. NON-BLOCKING (28), 5a. The door already sets the GUC the guard reads (13 + 3 cascade = 16) (+4 more)

### Community 567 - "17. Dependencies: `action_item_dependencies`"
Cohesion: 0.15
Nodes (12): Checklist Against PHASES.md Phase 1 Acceptance Criteria, Detailed Findings, INFO-1 — `anon` role has full DML grants on all public tables, MAJOR-1 — `commission_members_staff_admin_update` USING clause does not restrict to staff-only rows, MAJOR-2 — `response_section_signoffs` immutability after submission is not tested, MINOR-1 — `app.eval_condition` has no `search_path` set, MINOR-2 — `profiles_admin_all` policy allows admin to DELETE profiles, MINOR-3 — `responses_insert_own` does not validate `form_version_id` matches `commission_id` (+4 more)

### Community 568 - "23. Status Transition Handling"
Cohesion: 0.15
Nodes (13): 1. Catalog facts (all confirmed live, not from migration text), 2. Live function bodies read in full (`pg_get_functiondef`), 3. pgTAP — ran live, not just trusted, 4. One independent live mutation (not from the ADR's narrative), 5. BUG-FF4-001 fix — read, not just accepted as fixed, 6. Client/server consistency, 7. UI / a11y / pt-BR spot check, Conclusion (+5 more)

### Community 569 - "26. Recommended User Interface Mapping"
Cohesion: 0.20
Nodes (10): 1. Discrepancy table, 2. Migration filenames + versions (window above `20260910000400`), 3. Old-vs-new diff strategy — what a rebuild can silently lose (M3/M4/M5), 4. S7 (exact shape, from the live body), 5. Verification plan, 6. Open items for lead ack (plan deltas found by this pass), ARM gates + door sweep, Mutation audit `supabase/tests/mutation/q1-quality-mutation-audit.sh` (+2 more)

### Community 570 - "6. Core Table: `action_items`"
Cohesion: 0.11
Nodes (19): 0064 — Case subject generalization: participants, roles, professional registry & case types, As-built (F1 E0, 2026-07-10), Backend findings, Consequences, Context, Decision, Decision 1 — Full generic participant model (not a one-off satellite), Decision 2 — Professional identity is its **own audited sensitivity class** (+11 more)

### Community 571 - "8. Urgency Model"
Cohesion: 0.15
Nodes (12): B1 — The `supersede_response` authority gate is bypassable via a direct `responses` INSERT (Rule 1 / ADR 0074 §2 authority model), BLOCKER, Bottom line, M1 — Aggregation retrofit, RPC, and audit are correct and well-covered (informational, no action), M2 — `canCorrect` and the UI affordance are correctly server-gated (informational), M3 — `npm run typecheck` reports errors in generated route validators — NOT a SUP regression (informational), MAJOR, MINOR (+4 more)

### Community 572 - "11.1 `committee_meetings`"
Cohesion: 0.11
Nodes (19): 1. TL;DR, 2. What our platform already is (the corrected baseline), 3.1 Core case engine, 3.2 Participants & identity — **the core gap**, 3.3 Assignments, forms, meetings, documents, timeline, action items, 3.4 Decisions & the ethics procedure — mostly **Absent**, 3.5 Access, confidentiality, conflicts — **the security-sensitive gap**, 3.6 Committee-specific extension tables (M&M etc.) (+11 more)

### Community 573 - "11.2 `meeting_agenda_items`"
Cohesion: 0.15
Nodes (13): § 10 — the six kernels end to end, and why it exists, ⭐ § 6 — THE RULING THAT WAS NOT TAKEN, MEASURED BESIDE THE ONE THAT WAS, AE2.4 increment 3 — the write-authority path (migration `20261003005700`, suite `394`), Arm domains — derived per function from the catalog, with the harness's own domain SQL, ⛔ B6 discharged — increment 3's ARM evidence, recorded here with its provenance (lead, 2026-08-28), Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`, ⛔ THE ADR IS TRUE OF THE STRING AND FALSE OF THE GRAIN — the six kernels are not six gates, ⭐ THE CAPABILITY AXIS IS VACUOUS ON THE ORG TIER — measured, then fixed (+5 more)

### Community 574 - "11.3 `meeting_case_discussions`"
Cohesion: 0.11
Nodes (19): 2026-09-08, 2026-09-08 — Record step (Batch 6 lead): closed on its LEDGER ROW, not on a review, Blockers, Coordination — ⚠ the branch APPEARED mid-session, Current state, Dead ends and traps hit (recorded so they are not re-paid), Done since start, Gate (+11 more)

### Community 575 - "11.4 `case_votes`"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 576 - "14.1 `case_access_grants`"
Cohesion: 0.11
Nodes (16): ADR 0026 — Interviews (case-scoped, participant-write RLS), Consequences, Context, Decision, New SQLSTATEs (continue after HC037; HC021 reused), Deferred follow-up, Lead notes, Phase 11 — Interviews (task detail) (+8 more)

### Community 577 - "14.2 `case_conflict_declarations`"
Cohesion: 0.17
Nodes (12): A2.1 — Proposed decision (if the PO accepts D), A2.2 — Mechanism (binding if D is accepted — here the mechanism *is* the decision), A2.3 — What D does **not** grant (each verifiable from the catalog), A2.4 — Residual risks, accepted explicitly rather than discovered later, A2.5 — Obligations (each blocks the migration that ships it), A2.6 — Records that must change in the same commit (if D is accepted), A2.7 — Approval scope (an approval's scope is a fact that must be written down), Amendment 2 — 2026-08-21 (**✅ ACCEPTED — PO ruled option D**; authored as PROPOSED, see the status block): creation-scoped PHI entry for `administrativo`, and the resolution of OPEN-4 (+4 more)

### Community 578 - "14.3 `case_recusals`"
Cohesion: 0.17
Nodes (12): ADR 0137 — MRN as the LGPD erasure key; the case/referral usability batch, Amendment 1 — post-send referral PHI amendment is not a product capability (PO ruling, 2026-08-24), Amendment 2 — the Consequences' deploy-order rationale is FALSE as written (measured 2026-08-24), Amendment 3 — D9's `CaseDepartmentField` is deleted (PO ruling, 2026-08-24), Amendment 4 — the MRN floor is a PROCESS-TEMPLATE feature; processless cases are out of scope (PO ruling, 2026-08-24), Consequences, Context, Decisions (+4 more)

### Community 579 - "16.1 `mm_case_details`"
Cohesion: 0.11
Nodes (18): Could not verify — a work item for the lead, not a clearance, Findings — round 1, item by item, ✅ Lead-playbook §4 step 8 (rulings outside the log) — still satisfied, ✅ Manifest regeneration — exactly one sha line each, and the fixture still passes, MINOR A — the seam slice turned a correct NAMED set into a census that does not sum, MINOR B — the hub's live `## Current state` says the review is "not yet written", in the commit that wrote it, New items introduced by the fix commit (MINOR, for the Record step — not a third loop), Overall assessment (+10 more)

### Community 580 - "16.2 `mm_contributing_factors`"
Cohesion: 0.17
Nodes (12): 6.2.1 `patient_participants`, 6.2.2 `professional_participants`, 6.2.3 `external_person_participants`, 6.2.4 `department_participants`, 6.2.5 `institution_participants`, 6.2 Participant Subtype Tables, Justification, Justification (+4 more)

### Community 581 - "16.3 `mm_preventability_assessments`"
Cohesion: 0.17
Nodes (12): 6.10 Upload and scan state machine, 6.11 Deep Document module interface, 6.1 High-level model, 6.2 Securable resource registry, 6.3 Logical documents, 6.4 Immutable document versions, 6.5 Physical file objects and renditions, 6.6 Placements (+4 more)

### Community 582 - "17.1 `ethics_case_details`"
Cohesion: 0.11
Nodes (19): Acceptance-criteria audit, ⛔ BLOCK-1 — PO ruling R11 is recorded nowhere but the progress log, and ADR 0203 asserts the opposite, ⛔ BLOCK-2 — PO ruling R12 is recorded nowhere but the progress log, and ADR 0201 **and** the corrected register clause both state the opposite, Findings, Gate at the tip, Is E2E owed? — **No, and I agree with the lead's position**, ⚠ MAJOR-1 — the hub's `## Current state` is stale in four of its six sections, and asserts a live blocker I measured green, ⚠ MAJOR-2 — ADR 0203 miscites three times, one of them a quote attributed to a file that does not contain it with the watching relation inverted (+11 more)

### Community 583 - "17.3 `ethics_case_findings`"
Cohesion: 0.17
Nodes (12): 10. Gate — full Phase Gate step 1, 1. The central fix — one seam, not 88 call sites, 2. `getRawGrants()` consumer enumeration — by the property, not a remembered list, 3. `context.isAdmin` — the SAME class, found auditing its own ~23 consumers, 4. `isCommissionAdmin`'s RLS-backstop comment — verified against the catalog, not accepted, 5. `getTechnicalDirectionAccessByOrg` — confirmed covered, not assumed, 6. A SEPARATE hat-blind door, found auditing session/access-resolver RPCs, not in the brief, 7. Why `ARM=census` did not grow (again) — `list_my_nsp_hospitals` returns `jsonb` (+4 more)

### Community 584 - "17.5 `ethics_case_notifications`"
Cohesion: 0.17
Nodes (12): Document model redesign — program plan (DM0–DM5), Phase DM0 — ratification (this worktree), Phase DM1 — substrate cutover (backend-only, no UI), Phase DM2 — orchestration + Wave A (turns `attachments` experience back on), Phase DM3 — Wave B: controlled documents, Phase DM4 — Wave C: referrals, Phase DM5 — Wave D + retirement, Program acceptance (condensed from audit §14, minus deferred items) (+4 more)

### Community 585 - "17.6 `ethics_hearings`"
Cohesion: 0.17
Nodes (12): 1.1 Schema — all new; migration window: next free `20260720…` **after SUP's `…000610`**, 1.2 RPCs (own-row unless noted; **t19**: `revoke all from public` then `grant execute to authenticated, service_role`), 1.3 Event-driven enqueue — wired into existing mutations (backend edits, confirm exact hook points), 1.4 Time-driven scan sources (`compute_due_notifications`) — CAPA + Sign-off + Meeting only, 1.5 Auto-resolve wiring — `app.resolve_notifications_for` called from, 1.6 Flag + types, 1. Backend contract (posted first; `frontend` starts only after the typed stubs land), 2. Frontend surface (starts after §1 stubs land) (+4 more)

### Community 586 - "17.7 `ethics_appeals`"
Cohesion: 0.10
Nodes (21): ⛔⛔ 137 of the 233 revokes would report success and change nothing, ✅ 16/16 — cases 2 and 7 closed by fixing the FIXTURE, not the mutation, ⛔ A DAY-OLD LOG FILE WAS READ AS THIS RUN'S VERDICT, AND IT SAID "INVARIANT HOLDS", AE1.3 gate record — 2026-08-27, quiet stack, fresh reset, ⚠ AE1 close conditions AMENDED 2026-08-27 (plan audit → ADR 0162), AE1 — Integrity and privilege hardening (authz evolution, ADR 0155 D9), AE1 phase gate — re-measured 2026-08-27 on the closing tree, fresh reset, FUP obligations this phase owes — ⛔ file every one at the Record step (+13 more)

### Community 587 - "26. Suggested Naming Convention"
Cohesion: 0.27
Nodes (8): ADR-0051, ADR-0051, verifyAuditChainAction(), VerifyChainState, AUDIT_MESSAGES, ADR-0028, AuditChainResult, verifyAuditChain()

### Community 588 - "5.4 `case_workflow_templates`"
Cohesion: 0.11
Nodes (19): 0. Headline, 1.1 F-BLOCK-1 — every figure in the rewritten § 6.7 step 4 reproduces, 1.2 F-BLOCK-2 — the targeted case is real, and I reproduced its RED independently, 1.3 F-MAJOR-1 — the portable rewrite is provably equivalent, measured against GNU diffutils, 1.4 F-MINOR-1 / -2 / -3 and F-REC-1 / -2 — all met, 1.5 The lead's gate entry — reproduced, and the ruling is sound, 1.6 `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` — register shape and falsifiability: ✅, 1. What I re-measured, and what it returned (+11 more)

### Community 589 - "5.6 `case_status_history`"
Cohesion: 0.17
Nodes (12): 1. Requirements — plan acceptance criteria, 2. Security / RLS (Architecture Rules 1, 9), 3. event-model.ts purity (Architecture Rule 9), 4. Code quality (§8), 5. UX & Accessibility, Checklist, Findings, INFO-1 — ADR 0027 was present pre-review (no action) (+4 more)

### Community 590 - "6.1 `participants`"
Cohesion: 0.17
Nodes (11): Additional Checks, Audit Scope, Open Informational Notes (Non-blocking), QA Review — PHI / HIPAA-Readiness Remediation, Security Model Findings, Verdict: APPROVED, WS A — Structured-Identifier Lockdown, WS B — Audited Free-Text / PHI Classification (+3 more)

### Community 591 - "6.3 `professional_profiles`"
Cohesion: 0.17
Nodes (11): Dimension 1 — Requirements (§R1 acceptance), Dimension 2 — Security / PHI (load-bearing), Dimension 3 — Conformance to R0 ratifications, Dimension 4 — Code quality, Dimension 5 — UX & a11y, Findings, Info, Minor (+3 more)

### Community 592 - "7.1 `case_assignments`"
Cohesion: 0.17
Nodes (12): 12.8.1 What is actually built — live catalog, 2026-09-01, 12.8.2 The over-grant being closed, stated plainly, 12.8.3 ⛔⛔ BLOCKER — "it becomes org-admin-only" is NOT IMPLEMENTABLE AS STATED, 12.8.4 The split is ANSWER-PRESERVING but NOT test-neutral — and that is the tripwire working, 12.8.5 Disposition — ✅ RULED 2026-09-01: **SPLIT BY OPERATION.** `staff_admin` may ADD, never MODIFY, 12.8 ⭐ Row 30 SPLIT BY OPERATION — `staff_admin` may ADD a professional, never MODIFY one, Naming note, ⚠ pgTAP that reds BY DESIGN — every one pins the behaviour being removed (+4 more)

### Community 593 - "8.1 `form_template_case_types`"
Cohesion: 0.17
Nodes (12): 17.1 ⛔ The first attempt at run 7 VOIDed, and the reason is the point, 17. Run 7 (2026-09-03) — the first run scored under §16. **P2 MEASURED, and it PASSES.**, 2. What the fixture may and may not change, 3.1 The trap this fixture CANNOT defeat, stated rather than papered over, 3. The scale factor, and why each axis is that size, 5. The measured paths, 6.1 PASS requires all of P1–P6, 6.2 The controls, and what each one would catch (+4 more)

### Community 594 - "9.2 `case_document_access_grants`"
Cohesion: 0.11
Nodes (19): 0 · Scope of this verdict, written down so it cannot be inferred wrong, 1 · What I re-derived, and what reproduced, 1a · The rc 3 / rc 3 distinction is correct, 1b · The load-bearing half of the residual claim is TRUE, 2 · Proven-able-to-fire — the mutations I ran, 3 · Clause-by-clause: does each follow-up's OWN text close?, 4 · MAJOR findings, 5 · MINOR findings (+11 more)

### Community 595 - "11. Table: `document_sensitive_metadata`"
Cohesion: 0.17
Nodes (12): ADR 0155 D3 compliance — stated explicitly, as asked, AE2.2 gate subset — run by the lead, on a fresh reset, AE2.2 — per-leg re-predication, `ARM=census` failed first, and that is the arm working, Collateral, and the gate figures, Handed to AE2.4, The containment trigger — ruled **T3**, and why that is sequencing, not deferral, The per-leg contract (old → new), verbatim (+4 more)

### Community 596 - "12. Table: `document_versions`"
Cohesion: 0.17
Nodes (12): ⛔ AE2.3 is SPLIT — and half of what the plan asks for has no subject yet, AE2.3a — the widening differential, read/visibility half (`392`), Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`, Seed population — a floor, not an exact count, The cell matrix — 5 callers × 10 targets = 50 pre-declared cells, The consumer set, closed from the catalog rather than from the census, The `professional_credentials` widening candidate — MEASURED, not inherited, The roster door's divergence, measured rather than argued (+4 more)

### Community 597 - "13. Table: `file_assets`"
Cohesion: 0.23
Nodes (9): metadata, SignoffQueuePage(), ADR-0061, ADR-0136, formatDate(), SignoffQueueList(), ADR-0136, SignoffQueueRow (+1 more)

### Community 598 - "15. Table: `document_pages`"
Cohesion: 0.11
Nodes (19): 0 · Verdict line, 10 · Summary, 1 · Method, 2 · The round-2 items, re-measured, 3 · What I tried to break, 3a · The widened bare-heading regex — 31 constructed inputs, 3b · The follow-up's "genuinely unfixable" rationale, tested rather than accepted, 4 · MAJOR findings (+11 more)

### Community 599 - "16. Table: `document_ocr_extractions`"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 600 - "17. Table: `document_redactions`"
Cohesion: 0.40
Nodes (4): ADR 0020 — Dashboard-countable responses: case-phase exclusion, Consequences, Context, Decision

### Community 601 - "18. Table: `document_resource_links`"
Cohesion: 0.18
Nodes (8): ADR 0027 — Case Timeline (read-only event aggregation, two layouts), Consequences, Context, Decision, Gate, Lead notes, Phase 12 — Case Timeline (archived task detail), Tasks

### Community 602 - "19. Table: `document_subjects`"
Cohesion: 0.18
Nodes (11): ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture, Amendment 1 (2026-07-12) — Referrals v2: dialogue + governance expansion (pre-pilot), Consequences, Context, Context, Decision — the 16 locked design decisions, Decision — the three-bucket disposition, Decisions amended (+3 more)

### Community 603 - "21. Table: `security_groups`"
Cohesion: 0.18
Nodes (11): 0060 — Flexible-Forms Foundation (partner-model gap disposition + pre-pilot bones), 1. Disposition of all 45 gaps, 2. The pre-pilot phase (`flexible-forms`, structural, no feature flag), 3. Deferred UX roadmap (post-pilot, each its own gated, feature-flagged phase), 4. Cross-cutting design invariant (Rec A) — `question_key` aggregation for the new field types, Alternatives rejected, Consequences, Context (+3 more)

### Community 604 - "22. Table: `security_group_members`"
Cohesion: 0.18
Nodes (11): 0074 — Supersession correction model (contract + UX finalization), 1. Schema — one nullable self-FK + two integrity constraints, 2. RPC — `supersede_response(p_response_id, p_reason)` — standalone-only, DEFINER, 3. Aggregation retrofit — latest-in-chain, at the single choke-point (LOAD-BEARING), 4. Audit — `response.superseded` via the MUTATION emitter (not the read allow-list), 5. Feature flag — `response_correction`, 6. UX — "corrigir envio" affordance + status badges, Consequences (+3 more)

### Community 605 - "23. Table: `document_access_grants`"
Cohesion: 0.18
Nodes (11): 0092 — FF-4 Power Authoring: a commission-owned block library, condition-closed snapshots, and a five-token default vocabulary, Amendment 1 — ruling 4's "inline edit" is withdrawn; the rename list is read-only (2026-08-03), Amendment 2 — ruling 2's metadata mutability had no mechanism; the doors are built, not withdrawn (2026-08-03), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Method notes worth keeping (+3 more)

### Community 606 - "24. Table: `document_effective_permissions`"
Cohesion: 0.18
Nodes (11): AE0.5 — the authorization matrix AXES (the shape, not the contents), Axis 1 — PERSONA (36 values; the seed roster), Axis 2 — ROLE (11 values; **5 independent definition surfaces**), Axis 3 — ACTIVE CONTEXT (role-valued, **not** (role, scope)-valued), Axis 4 — SCOPE (3 kinds + zero-scope; role-exclusive **today**), Axis 5 — OPERATION (three tiers, **no shared namespace** — this is F2), Axis 6 — RESOURCE LIFECYCLE / PRINCIPAL STATE, Axis 7 — SENSITIVITY (+3 more)

### Community 607 - "25. Table: `document_access_requests`"
Cohesion: 0.07
Nodes (23): CasePatientConfirmation(), FIELDS, DRAFT, ADR-0134, ADR-0038, ADR-0134, reassuranceText(), renderedText() (+15 more)

### Community 608 - "26. Table: `document_upload_sessions`"
Cohesion: 0.18
Nodes (11): 18.1 Permission hierarchy, 18.2 `interview_access_grants`, 18.3 Authorization helper functions, 18.4 Example RLS policies, 18.5 Storage authorization, 18. Access Control, Grant semantics, Interviews (+3 more)

### Community 609 - "27. Table: `document_ingestion_jobs`"
Cohesion: 0.18
Nodes (11): 8.1 `interview_sessions`, 8.2 Optional `interview_session_schedule_history`, 8.3 `interview_session_attendance`, 8. Interview Sessions, Design rationale, Recommended constraints, Rescheduling, Suggested delivery modes (+3 more)

### Community 610 - "28. Table: `document_access_audit_events`"
Cohesion: 0.18
Nodes (9): 1. Verdict, 2. What the proposal gets right, 3. Schema collisions (checked against the live catalog), 4. Rule 12 (PHI) — two hard violations, 5. Rule 3 (response lifecycle) — solvable, already precedented, 6. Metrics — do not fork the indicator engine, 7. Unbudgeted costs the proposal does not name, 9. Recommended next step (+1 more)

### Community 611 - "29. Retention and Lifecycle Tables"
Cohesion: 0.18
Nodes (11): 30.1 Table: `evidence_document_details`, 30.2 Table: `form_document_details`, 30.3 Table: `complaint_document_details`, 30.4 Table: `meeting_document_details`, 30.5 Table: `generated_report_document_details`, 30. Type-Specific Extension Tables, Rationale, Rationale (+3 more)

### Community 612 - "2. Design Goals"
Cohesion: 0.18
Nodes (11): 10. Gate — full Phase Gate step 1, re-run from a genuine fresh reset, 1. `app.is_admin()` — D11 implementation, 2. `assume_role`'s chicken-and-egg bug — found proactively, before shipping, 3. No-op proof — empirical, with the coordinator-required synthetic fixture, 4. TRIPWIRE — the no-op argument's own load-bearing assumption, made falsifiable, 5. The 3-arg `has_role` BLIND — dropped, not kept and not keystoned, 6. Two pgTAP fixture regressions found by the D11 migration, both fixed, 7. A pre-existing door-audit harness gap, found and fixed while diff-sweeping `is_admin()` (+3 more)

### Community 613 - "33. Storage Strategy"
Cohesion: 0.18
Nodes (10): 1. The four proposals under review, 2. Ground truth (catalog-verified 2026-08-25), 3. Proposal 2 — per-hospital staff data: extend `hospital_affiliations`, don't add a table, 4. Proposal 3 — `organization_affiliations`: yes, and here is the shape, 5. The voided tense — close C5 here, and don't mint its twin, 6. Proposal 4 — `professional_credentials` / `professional_profiles`, 7. Alternatives considered and rejected, 8. Build obligations (when approved — so known failure classes aren't repeated) (+2 more)

### Community 614 - "36. Integration With Forms"
Cohesion: 0.13
Nodes (15): 1. Verdict, 2. What "no orphan surface" does and does not mean, 3. Results, 4. The byte provably survived — so no arm is vacuous, 5.1 The proof-of-life contaminated its own subject (a FALSE POSITIVE), 5.2 Cleanup could have ADDED to the population it was measuring, 5.3 One anomaly that could not be explained, 5. Two defects found in the instrument, in flight (+7 more)

### Community 615 - "37. Integration With Cases"
Cohesion: 0.18
Nodes (11): 1 · The instrument, and the four times it was wrong, 2 · Calibration — the count is NOT a defect count, 3 · Findings, 4 · Consequence for shipped copy, 5 · What this does NOT prove, 6 · Reproducing, Control battery — 6 anchors, all passing, `dispose_case_phi` — 93 candidates; 17 of the raw set are the referral door's (+3 more)

### Community 616 - "42. Minimal Viable Implementation Plan"
Cohesion: 0.19
Nodes (13): classify(), count_sel(), emit_body(), emit_report(), psql_c(), psql_f(), record(), restore_inflight() (+5 more)

### Community 617 - "loading.tsx"
Cohesion: 0.10
Nodes (19): meetingWatermarkFor(), MEETING_REGISTERING_STATUSES, PrintSourceState, ADR-0104, ADR-0125, ADR-0126, ADR-0144, ALL_KINDS (+11 more)

### Community 618 - "loading.tsx"
Cohesion: 0.05
Nodes (38): 0. Rules that bind every phase of this program, AE1.1 — `commission_administrativos` FKs (F7), AE1.2 — DEFINER classification and the privilege budget (F5), AE1.3 — The nine person-authority door conversions (G11), AE1.4 — The service-role DML registry, AE1.5 — RLS initplan / permissive-policy triage (F8), AE1.6 — Zero-policy tables recorded, AE2.0 — PO decision first: lifecycle authority over fully-offboarded persons (+30 more)

### Community 619 - "loading.tsx"
Cohesion: 0.18
Nodes (11): Audit — 4-tier hash chain (Phase A), Committee titles (Phase A), Context, Design — hospital_admin, nsp_org_admin, per-hospital NSP & committee titles, hospital_admin (Phase A), Locked decisions, NSP-per-hospital (Phase B — partially supersedes ADR 0042), Open items folded in / adjacent (+3 more)

### Community 620 - "loading.tsx"
Cohesion: 0.11
Nodes (18): Backend State — conventions, testing and remote discipline, Consequences, Current state, Extracted from the pre-split stamp chain, F0 — Pre-Pilot Foundations conventions (2026-07-10; ADR 0065, no migration), ⭐ HOW it was emptied — `pg_stat_all_tables`, and the numbers do not add up the same way twice, Invariants, Migrations (forward-only, additive) (+10 more)

### Community 621 - "12.2 `interview_transcript_segments`"
Cohesion: 0.18
Nodes (11): Backend plan-first deliverable (A0), §C — Seed (`supabase/seed.sql`), §D — pgTAP (`supabase/tests/`), §N.1 `nsp_org_admin` predicate + PHI-free aggregate doors (decision 13), §N.2 Appointment + roster/config RPCs — three-tier chain (decisions 3, 12, 13), §N.3 `dispose_referral_phi` (decision 5 / ADR 0052 §6), §N — Net-new surfaces (NOT in the per-org inventory), NSP-per-hospital — Backend security-core spec (Phase B, backend core) (+3 more)

### Community 622 - "2. Architectural Goals"
Cohesion: 0.30
Nodes (9): CONTAINER_TYPES, addItem(), reconcileOptionRows(), resolveInsertPosition(), mintAxisCode(), generateOptionCode(), resolveOptionCodes(), shortSuffix() (+1 more)

### Community 623 - "9.2 `interview_form_assignments`"
Cohesion: 0.20
Nodes (11): CaseOrCommissionRow, contextWith(), getSessionContext, hospitalRef(), MaybeSingleResult, orgRef(), rpc, supabaseMock (+3 more)

### Community 624 - "F-cleanup — residual DB-hardening (durable record)"
Cohesion: 0.11
Nodes (18): ADR 0190 — The door-sweep deriver selects doors by PROPERTY, scopes what it swept, and a full run MERGES the findings baseline, Consequences, Considered options, Context, D10 — Exit codes keep their meanings. Exit 1 gains three named sub-cases., D11 — `SELFTEST=1` is a Phase-Gate-step-1 instrument, not a lint gate., D12 — Two in-tree assertions are now FALSE and are named here as superseded., D1 — A DOOR is a catalog fact. SWEEPABLE is a strictly narrower second question. (+10 more)

### Community 625 - "phase2-auth-shell.spec.ts"
Cohesion: 0.09
Nodes (24): createCaseAs(), dbQuery(), phaseId(), rpcAs(), signInAs(), signOut(), ADR-0061, ADR-0078 (+16 more)

### Community 626 - "phase-multitenancy.spec.ts"
Cohesion: 0.18
Nodes (10): 16 · R2-1 … R2-5, R2-7 — verified closed, 17 · ⛔ W7 — I RETRACT IT. It was wrong in round 1, wrong again in round 2, and the evidence was in front of me the whole time, 18 · R2-6 — the lead is right to decline the rule, and my §8 reasoning was wrong, 19 · Closing, How I got there, because the mechanism is the point, On whether the memory generalisation is a fourth prose record, QA review — DSR operational remediation, ROUND 2 — 2026-08-21 (+2 more)

### Community 627 - "advanced-effect-event-deps.md"
Cohesion: 0.33
Nodes (8): actionsStub(), CONFORME, NAO_CONFORME, opt(), renderAtReview(), scoredItem(), ADR-0136, wizardData()

### Community 628 - "advanced-event-handler-refs.md"
Cohesion: 0.13
Nodes (15): 1 · Is the retirement-cause rule held everywhere? **Yes — in all six code sites. The ADR is now the one place it is not.**, 2 · Are the re-earned verdicts trustworthy? **Yes, and the reason is structural, not deference.**, Carried forward — open, non-blocking, for the Record step or the next slice, Method — what I actually did this round, New in r2 — three findings, all Minor, r2-B3 · "14 spec files carry private copies, and exactly one other swallows" is materially wrong — I measured it **[V]**, r2-m1 · The battery census stopped summing, inside the paragraph that documents that failure **[V]**, r2-m2 · ADR 0130 Amdt 3 item 7 still instructs the behaviour the fix removed **[V]** (+7 more)

### Community 629 - "advanced-init-once.md"
Cohesion: 0.06
Nodes (32): DsrDueBadge(), DsrDueNotice(), ADR-0130, DsrIntakePanel(), completeDsrTask, disposeMeetingMinutesTask, executeDisposalTask, refresh (+24 more)

### Community 630 - "advanced-use-latest.md"
Cohesion: 0.18
Nodes (11): 1. The three r1 blockers — closed, verified by the r1 probes themselves, 2. Mutation proofs — all six re-run, plus four of mine, 3. The sweep table — verified independently, and it is accurate, 4. Full pgTAP, run by me, 5. ⚠ PRE-COMMIT CONDITION — the working tree is not the tree I was given, 6. Carried from r1 — non-blocking, none addressed (correctly), 7. Closing assessment, ✅ APPROVED (+3 more)

### Community 631 - "async-api-routes.md"
Cohesion: 0.18
Nodes (10): 1. RLS / leak audit of the two RPCs (most important) — PASS, 2. Count 1 correctness (`casesNotConcluded`) — PASS, 3. Flag handling — PASS, 4. Frontend correctness — PASS, 5. Standards (pt-BR, a11y, errors, TS strict) — PASS, Focus-area findings, Hygiene, Non-blocking observations (MINOR / informational — no change required) (+2 more)

### Community 632 - "async-dependencies.md"
Cohesion: 0.18
Nodes (11): B1 — Apply never deletes the meeting audio. Three documents say it does., BLOCKER, INFO, M1 — The "24 h sweep for objects with no live job" does not exist; two documents state it does., M2 — The audio TTL is lazy, so "transiently (≤ 24 h)" is not true as built., MAJOR, MINOR, QA review — MIN · Meeting audio → generated ata (`audio_minutes`) (+3 more)

### Community 633 - "async-parallel.md"
Cohesion: 0.12
Nodes (15): Commits (branch `feat/pre-pilot-foundations-plan`, local — not pushed to remote; pre-pilot reset-OK), Deferred (post-pilot), F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE, Gate (§6), Tasks (all ✅), INFO (no action required), MAJOR, MAJOR-1 — Seven new non-PHI tables have RLS SELECT policies but no `GRANT` to `authenticated` (Rule 1: inert boundary) (+7 more)

### Community 634 - "async-suspense-boundaries.md"
Cohesion: 0.18
Nodes (11): ADR 0087 §Gate keystones — final state, r2 · 1. Method, r2 · 2. P0-1 — RESOLVED ✅, r2 · 3. MAJOR-1 and MAJOR-2 — RESOLVED ✅, r2 · 4. Regression sweep — the r1-proven keystones survived the rework, r2 · 5. Gate status, r2 · 6. Carried-forward and new findings — none blocking, r2 · 7. Note for the record (+3 more)

### Community 635 - "bundle-barrel-imports.md"
Cohesion: 0.18
Nodes (11): Carried forward from r1, still open, still not blocking, FF-5 — QA review r2, Findings, Gate, Neutralisations I re-ran — all confirmed, On F4 and F7 — two nits, deliberately not raised as findings, Probes of my own — two closed a r1 finding, one found a residual, r2-m-1 (MINOR, not blocking) — §O pins the door that exists, not the closure of the writer set (+3 more)

### Community 636 - "bundle-conditional.md"
Cohesion: 0.18
Nodes (11): 1. Security / RLS (highest priority) — PASS, 2. PHI handling (Rule 12) — PASS, 3. Requirements audit vs ADR 0044 — PASS, 4. Code quality — PASS, 5. Accessibility — PASS, 6. pt-BR / English split — PASS, Findings, MINOR-1 — `create_case` action declares an HC029 constant it can never receive (+3 more)

### Community 637 - "bundle-defer-third-party.md"
Cohesion: 0.18
Nodes (10): Context accepted without re-litigation (per the task brief), Dimension 1 — RLS coverage & correctness (SECURITY) — PASS, Dimension 2 — RPC grants & authority (SECURITY, t19) — PASS, Dimension 3 — Audit (Rule 11) — PASS, Dimension 4 — Data-access discipline (Rule 9) — PASS, Dimension 5 — Requirements audit vs the plan — PASS, Dimension 6 — Best-practice guardrails — PASS, Non-blocking findings (+2 more)

### Community 638 - "bundle-dynamic-imports.md"
Cohesion: 0.26
Nodes (18): archiveIndicator(), computeDerivedMeasurement(), createIndicator(), KNOWN_PT_BR_HC084, mapIndicatorError(), MESSAGES, openCapaFromIndicator(), parseDate() (+10 more)

### Community 639 - "bundle-preload.md"
Cohesion: 0.20
Nodes (10): CATALOG_ROLES, contextHolding(), KNOWN_UNROUTED, LandingOutcome, maximalGrantFor(), REPO_ROOT, resolveLanding(), state (+2 more)

### Community 640 - "client-event-listeners.md"
Cohesion: 0.12
Nodes (12): dualHospitalAdminSession, foreignOrgAdminSession, hospitalAdminSession, orgAdminSession, rows, selects, SessionShape, ADR-0133 (+4 more)

### Community 641 - "client-localstorage-schema.md"
Cohesion: 0.18
Nodes (11): 1 · B1's fix — verified, both halves, by construction rather than by table, 2 · The new keystones can fail — five mutations, measured, 372 §6.4 is **strictly stronger**, not merely narrower — the concern was well placed and it holds, 3 · The no-backfill reasoning — `backend` is right, and ADR 0150 already says so, 5 · New in round 2 — MINOR, 6 · Gates I ran, and the one I did not, Read side — the four personas, preconditions asserted in-session, Round 2 (+3 more)

### Community 642 - "client-passive-event-listeners.md"
Cohesion: 0.45
Nodes (10): bad(), chk(), gate(), has(), hasnt(), ok(), scenario_death(), setup() (+2 more)

### Community 643 - "client-swr-dedup.md"
Cohesion: 0.18
Nodes (11): 0173 — the door-sweep deriver is blind to runtime-rewrite migrations; a target-declaration convention with teeth, and the `PRED_DOMAIN` bound routed to C2, 1 — The deriver selects rewrite targets (block 4b), 2 — ⭐ The convention, and it is ENFORCEABLE — the ruling the PO asked for, 3 — ⚠ The ceiling is HISTORICAL, not structural, 4 — ⛔ `PRED_DOMAIN` is NOT widened. The bound is NAMED and ROUTED to C2., 5 — The lookup's three bounds, so its result is not overread, ⭐ A register's own vacuity control, observed working, Consequences (+3 more)

### Community 644 - "js-batch-dom-css.md"
Cohesion: 0.18
Nodes (11): Bodies rotated from follow-ups.md 2026-08-28 (resolved 2026-08-24; their index lines left PROGRESS.md then), ✅ FUP-AE2-393-ABSENCE-CELLS-NO-CONTROL — `393 § 3.12`/`§ 5.9` are all-zero absence claims nothing can prove able to fail (owner: backend; filed 2026-08-28 by QA r3 F2), ✅ FUP-AFF4-HOMEORG-PHASE2 — 0151 D10's named Phase 2 had **no register line anywhere**; filed and promoted to PRE-PILOT at ADR 0155's acceptance (owner: backend/PO) — **RESOLVED 2026-08-28**, FUP-DSS-KEYBOARD-FLOW-IS-THIN, FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE, FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE, FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT, FUP-RCA-WRITER-CAN-WRITE-IS-BLIND (+3 more)

### Community 645 - "js-cache-function-results.md"
Cohesion: 0.29
Nodes (5): EXTENSIONS, files, findings, ROOTS, SKIP_DIRS

### Community 646 - "js-cache-property-access.md"
Cohesion: 0.18
Nodes (11): AE2.3b cells for this increment — the write/containment differential, AE2.4 increment 1 — the circular pair (migration `20261003005600`, suite `393`), Arm domains — derived per function from the catalog, with the harness's own domain SQL, Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`, ⛔⛔ M2's FIRST RUN REDDED ONLY § 0.3 — my keystone could not fail, and the reason inverts ADR 0159, ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**: migrations touched, ZERO cases derived, ⛔ STALE ASSERTIONS THIS INCREMENT CREATED — the drop increment's checklist, The mitigation, and the proof it can fire (+3 more)

### Community 647 - "js-cache-storage.md"
Cohesion: 0.18
Nodes (11): 1. DIRTY — findings, ⛔ F-BLOCK-1 · MAJOR (blocking) — `commission.forms.edit` is re-keyed at 4 of the 7 sites its approved matrix names, and the manifest has no site-axis closure check, ⛔ F-BLOCK-2 · MAJOR (blocking; **owned by others, assessed not claimed**) — three named Gate AE4 acceptance items are absent, ⛔ F-BLOCK-3 · MAJOR (blocking; cheap) — the regression oracle states its own approval scope three ways, 🟡 F-F9 · the mid-phase review's F9 residue — a ruling on every item, 🟠 F-MAJOR-1 · MAJOR — `hardDenyClasses` is empty on 43/43 rows, and the assertion that claims to make that falsifiable is already blind to a live instance, 🟠 F-MAJOR-2 · MEDIUM — `ARM=catalog` and `ARM=sites` — the two arms AE4 built to gate itself — hold at AE4.7b, not at the reviewed head, 🟠 F-MAJOR-3 · MEDIUM — `20261003007180` is a rewrite migration with no `door-sweep-targets:` marker, breaking the convention this phase's own ADR made mandatory (+3 more)

### Community 648 - "js-combine-iterations.md"
Cohesion: 0.20
Nodes (5): signInAs(), signOut(), svcDelete(), teardownFixtures(), ADR-0078

### Community 649 - "js-early-exit.md"
Cohesion: 0.20
Nodes (9): 1. Before you build (checklist), 2. Color — semantic tokens (never raw values), 3. Typography, 4. Spacing, radius, layout, 5. Motion system (shared — do not freelance durations/easings), 6. Accessibility (non-negotiable — CLAUDE.md §8), 7. Content & component conventions, 8. Do / Don't (+1 more)

### Community 650 - "js-flatmap-filter.md"
Cohesion: 0.18
Nodes (11): 19.10 Copying PHI into notification payloads, 19.1 Storing the conversation as JSONB, 19.2 Automatically granting target committee access to the entire case, 19.3 Combining shared messages and internal notes, 19.4 One referral with multiple target committees, 19.5 Resolving automatically when a response is sent, 19.6 Using assignments as permissions, 19.7 Hard-deleting communication (+3 more)

### Community 651 - "js-hoist-regexp.md"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 652 - "js-index-maps.md"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 653 - "js-length-check-first.md"
Cohesion: 0.20
Nodes (8): ADR 0023 — Configurable per-committee case status, Consequences, Context, Decision, ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes, Consequences, Context, Decision

### Community 654 - "js-min-max-loop.md"
Cohesion: 0.20
Nodes (10): 0091 — FF-5 Entity Reference: three lanes, hybrid participant scoping, and why INFO-2 needs no PHI door, Amendment 1 — `references_never_read_phi` is false as literally worded (2026-07-28), Amendment 2 — `proacl` shows grants, never revokes (2026-07-28), Consequences, Context, Decision, Gate keystones (all mutation-proven — revert the guard, the keystone must go red), Open questions (deferred, not blocking) (+2 more)

### Community 655 - "js-request-idle-callback.md"
Cohesion: 0.20
Nodes (10): A3.1 — What is false about D1's letter, measured, A3.2 — The proposed replacement wording, A3.3 — Why the second clause is a strengthening, not a loophole, A3.4 — "Among the viewers who can open the page" — the clause Increment 2 forces, A3.5 — Conditions carried into the wording, A3.6 — What this does not change, A3.7 — Obligations if accepted (each in the same delivery, not after), A3.8 — Approval scope (an approval's scope is a fact that must be written down) (+2 more)

### Community 656 - "js-set-map-lookups.md"
Cohesion: 0.12
Nodes (16): ⭐ 2026-09-08 — the class is REPRODUCING ONCE PER BATCH, measured on two consecutive ADRs, ⚠ CLAUSE WIDENED 2026-09-09 — pre-AE5 Batch 9, unit `AE5-OPENING-ADR`, PO ruling R3, ⚠ FIGURES STALE IN THREE WAYS, AND THERE ARE FIVE CONVENTIONS NOT TWO — 2026-09-09, pre-AE5 Batch 9, FUP-ADR-CROSS-LINKS-HAVE-NO-GATE — 13 broken ADR-to-ADR links, and gate 9 structurally cannot see them (owner: lead/backend; filed 2026-09-02 by `lead`, measured during AE4.9 D6), FUP-AE1-REVOKE-SET-EXECUTION — 233 classified revokes are HELD, partitioned, and 137 of them are a silent no-op as written (owner: backend/PO), 🟠 FUP-AE1-REVOKE-SET-EXECUTION — 233 classified revokes are HELD, partitioned, and 137 of them are a silent no-op as written (owner: backend/PO) — ✅ CLOSED 2026-09-08, FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER — a shipped phase absent from the append-only record (owner: lead), 🟠 FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER — a shipped phase absent from the append-only record (owner: lead) — ✅ CLOSED 2026-09-08 (+8 more)

### Community 657 - "js-tosorted-immutable.md"
Cohesion: 0.20
Nodes (10): 1. The property (not the syntax), 2. Buckets — three, never two, plus a fourth for test files, 3. Detector-can-fail proof (`--self-test`), 4. Headline numbers and the delta vs the plan's "12", 5. Full `IN_SCOPE` table (45 sites), 6. `.rpc()` actor-validation — what is and isn't checkable from JS, 7. Findings, 8. Working-tree hygiene (+2 more)

### Community 658 - "rendering-activity.md"
Cohesion: 0.20
Nodes (10): 18. Migration and rollout sequence, Gate 0 — Ratify the replacement decision, Gate 1 — Repair the Case Type foundation, Gate 2 — Centralize Case authorization, Gate 3 — Build targeted respondent submission, Gate 4 — Build generic procedure primitives, Gate 5 — Make Meetings Case-restrictable, Gate 6 — Add the ethics-only Decision satellite (+2 more)

### Community 659 - "rendering-animate-svg-wrapper.md"
Cohesion: 0.20
Nodes (10): 3.2 `forms.form_versions`, Design Reasoning, Example `behavior_config`, Example `theme_config`, Important Columns, Purpose, Related Types, Relationships (+2 more)

### Community 660 - "rendering-conditional-render.md"
Cohesion: 0.18
Nodes (10): 1. Roster panel — `case-participants-panel.tsx` (frontend), 1a. What each row action actually opens (pinned 2026-08-11 — the tester hit this), 2. Add-participant dialog — `add-participant-dialog.tsx` (frontend), 2a. Professional lane, 2b. External lane, 3. Resolve-linkage dialog — `resolve-linkage-dialog.tsx` (frontend), 4. Seeded role labels (already in `seed.sql` — do NOT re-invent), 5. Frozen TypeScript signatures (backend owns; frontend/tester code against these) (+2 more)

### Community 661 - "rendering-content-visibility.md"
Cohesion: 0.11
Nodes (18): 0 · Method, so it cannot be inferred wrong, 1 · The round-1 items, re-measured, 1a · Round-1 §7 — the "could not verify" list, now closed, 2 · What I broke, and what refused to break, 2a · The bare-heading arm — I tried to get a non-approval through it, 2b · Gate 11 (`check-rules-staleness.mjs`), both polarities, 2c · `door-sweep-selftest.sh` — the FAIL branch is reachable, 3 · MAJOR findings (+10 more)

### Community 662 - "rendering-hoist-jsx.md"
Cohesion: 0.18
Nodes (9): Backend tasks (`backend`), Follow-on refinement — case-access dialog + narrative-card attribution (2026-06-19, frontend-only), Follow-ups (carried to PROGRESS.md), Frontend tasks (`frontend`), Gate (§6), Increment Archive — Case Access Control & "Meus Casos", Refinement: Case-access dialog + narrative-card attribution (frontend-only) — ✅ FE DONE 2026-06-19, Seed personas (Caso 0001 "Óbito UTI leito 7", commission CCIH; password `Test1234!`) (+1 more)

### Community 663 - "rendering-hydration-no-flicker.md"
Cohesion: 0.20
Nodes (10): 21.1 Typical Interview lifecycle, 21.2 Recommended transition rules, 21. Lifecycle Model, `completed → closed`, `draft → requested`, `in_progress → awaiting_follow_up`, `in_progress → completed`, `inviting_participants → scheduled` (+2 more)

### Community 664 - "rendering-hydration-suppress-warning.md"
Cohesion: 0.20
Nodes (10): 6.1 `interviews`, 6. Core Interview Aggregate, Recommended invariants, Status semantics, Suggested confidentiality values, Suggested Interview categories, Suggested priority values, Suggested recording policies (+2 more)

### Community 665 - "rendering-resource-hints.md"
Cohesion: 0.20
Nodes (10): 20. Cycle generation workflow, Step 1: create or claim scheduled occurrence, Step 2: resolve immutable configuration, Step 3: capture occupancy, Step 4: generate targets, Step 5: create form instances and records, Step 6: initialize answers, Step 7: assign work (+2 more)

### Community 666 - "rendering-script-defer-async.md"
Cohesion: 0.16
Nodes (12): activatePhase(), createCase(), insertChoiceOptions(), rpc(), saveAnswer(), signInAs(), slug(), startResponse() (+4 more)

### Community 667 - "rendering-svg-precision.md"
Cohesion: 0.08
Nodes (32): ADR-0206, buildImportTable(), CENSUS, censusKeys, censusRows, classifyClientArg(), derivedKeys, deriveWrapperSites() (+24 more)

### Community 668 - "rendering-usetransition-loading.md"
Cohesion: 0.20
Nodes (10): 19.1 Design rules, 19.2 Active organization membership, 19.3 Organization permission, 19.4 Hospital permission, 19.5 Committee permission, 19.6 Domain-aware role access, 19.7 Explicit grant, 19.8 Explicit restriction (+2 more)

### Community 669 - "rerender-defer-reads.md"
Cohesion: 0.20
Nodes (10): 43.1 One global role per user, 43.2 Hospital administrator can manage every user in organization, 43.3 Hospital administrator deletes user, 43.4 Every quality user reads every case, 43.5 Organization administrator automatically reads clinical data, 43.6 Separate authorization architecture for single-site customers, 43.7 JWT-only role storage, 43.8 Frontend-only field hiding (+2 more)

### Community 670 - "rerender-dependencies.md"
Cohesion: 0.20
Nodes (10): 1. Method — classify by READING, not by name, 2. The full 31-row classification, 3. `open_capa_plan` — fixed, but with an honest vacuity finding, not a guessed keystone, 4. Keystones — red-first, per function, `supabase/tests/316_act_p0_caller_gate_sweep.sql`, 5. Catalog property diff, 6. Two more test-fixture regressions, same class as the earlier two this session, 7. Gate, 8. Is the split complete, or does the population need re-bounding? (+2 more)

### Community 671 - "rerender-derived-state.md"
Cohesion: 0.20
Nodes (9): 1. `test_helpers.claims_for` — the overload trap, 2. The `request.jwt.claims` sweep — bounded by the property, not the filename, 2b. Stage 3 carry-forward obligation — the 4 unreachable `seed.sql`/demo-seed sites, 3. Dual-hat seed persona — `dualhat.a@test.local`, ACT program — build notes (ADR 0106), Stage 0 correction — the enum moves to `public` (lead ruling, 2026-08-09), Stage 1 — backend half (2026-08-09), Stage 1 — tester half (2026-08-09) + a lead ruling on `accessToken` (+1 more)

### Community 672 - "rerender-derived-state-no-effect.md"
Cohesion: 0.11
Nodes (18): AFF2 — implementation plan: affiliation-scoped administration + user-management redesign, B1 · Migration: `profiles.date_of_birth` + `profiles.phone` (ADR 0133 D9–D10), B2 · Migration: `professional_credentials` SELECT widening (D13), B3 · Migration: `list_org_people` payload gains `date_of_birth` (D11), B4 · The scope-rule authorizer + action rewiring (D1–D4), B5 · Vitest keystone matrix (D4 + Amdt 1), B6 · Detail-page locked-column read (D10, D12), B7 · Directory query widening (D14) (+10 more)

### Community 673 - "rerender-functional-setstate.md"
Cohesion: 0.06
Nodes (31): App-layer ripple, App-layer ripple, App-layer ripple, App-layer ripple: **none.**  ### Review flag: 🟢. **Open decision → D8-Q1 (skip vs COMMENT migration).**, Current state, Current state, Current state (full sweep), Current state — structural findings (+23 more)

### Community 674 - "rerender-lazy-state-init.md"
Cohesion: 0.13
Nodes (14): 1. Is assignee PHI reach dead AND is every legitimate reader's PHI reach intact?, 2. Is content reach genuinely unaffected?, 3. Both flag branches / the restraint on the member arm, 4. Is Rule 11 coverage preserved in the amended suites?, 5. Is the `level` refusal sound, and is the pin real?, AUTHZ · M3 — QA Review (defect ① narrowing), e2e recommendation: **TARGETED**, not the full suite, Findings (+6 more)

### Community 675 - "rerender-memo.md"
Cohesion: 0.12
Nodes (13): ALLOWLIST, DML_VERBS, EXTENSIONS, GATED_TABLES, ADR-0075, ADR-0094, ADR-0097, ADR-0098 (+5 more)

### Community 676 - "rerender-memo-with-default-value.md"
Cohesion: 0.19
Nodes (17): ANCHOR_RE_M, buildFixtures(), CANON, canonicaliseDoc(), canonicaliseSql(), DOC_PATH, dropLine(), inspect() (+9 more)

### Community 677 - "rerender-move-effect-to-event.md"
Cohesion: 0.12
Nodes (17): §0 — The FOURTH PHI surface (do not miss): `patient_index`, §A.1 Read predicates — rebind PQS term, delete the `is_multi_org` wrapper, §A.2 Write gates / policies (every `is_pqs_writer` site), §A.3 DEFINER doors / RPCs, §A.4 Flag / assert reversions (the point of the phase), §A.5 Numbering, §A.6 Roster curation RPCs (platform-admin+global → coordinator+per-org), §A.7 Storage + patient_index (+9 more)

### Community 678 - "rerender-no-inline-components.md"
Cohesion: 0.12
Nodes (17): Backend State — the service-role DML registry, Current state, Group A — person-authority `profiles` / `professional_credentials` (8 sites; AE1.3 doors, LANDED), Group B — self-scoped by construction (1 site), Group C — system actor: `meeting_minutes_jobs` lifecycle (4 sites), Group D — pre-existing doors (`.rpc()`, decided; 8 sites), Group E — RULED 2026-08-27 (11 `.rpc()` sites; formerly `UNDECIDED`), Group F — Storage writes, RPC-preceded (4 sites) (+9 more)

### Community 679 - "rerender-simple-expression-in-memo.md"
Cohesion: 0.07
Nodes (30): 0 · What landed, in commit order, 1 · The inherited artifacts were UNREVIEWED, and both carried real defects, 1a · The pgTAP keystone had never been executed, 1b · Two claims in that header were false, and were REPAIRED rather than deleted, 1c · `plan(N)` → `no_plan()` — ⛔ REVERSED AT QA r1, see §6d correction 1, 1d · ⛔ The INDETERMINATE branch was unreachable in the state that needs it, 1e · Verification of the tool after four accumulated changes, 2 · S5.D — the disposal gap, pinned on both sides (+22 more)

### Community 680 - "rerender-split-combined-hooks.md"
Cohesion: 0.05
Nodes (37): 1. What shipped, 2. Final gate, 3.1 The MAJOR-3 fix — backend correctly overrode QA's recommendation, 3.2 The coverage-shape gap — why 2523 green assertions missed MAJOR-1, 3.3 The generic leak sweep (lead-directed, brought forward from E2), 3. The QA fix loop — three RLS-leak shapes, found three different ways, 4. Known gaps — **PO-directed 2026-07-14: log for E2, don't act now**, 5. Incidents worth remembering (+29 more)

### Community 681 - "rerender-transitions.md"
Cohesion: 0.12
Nodes (14): AFF2 — QA review (gate step 3), ✅ APPROVED (r2), Carried forward, for the Record step, ⚠ Correction 1 — *"the change is strictly stricter"* is **false**, ⚠ Correction 2 — the `seed.sql:350` citation is at the wrong grain, and the real warrant is stronger, Gate, re-measured by me at HEAD (not accepted), Non-blocking items from r1, R1 — ✅ discharged in code (+6 more)

### Community 682 - "rerender-use-deferred-value.md"
Cohesion: 0.13
Nodes (15): 1. What I measured myself (not read off the record or hub), 2. AC-by-AC, 3. Security / RLS, 4. MAJOR, 5. MINOR, 6. NOTE, 7. Could not verify / not owed, 8. Obligations remaining at the Record step (+7 more)

### Community 683 - "rerender-use-ref-transient-values.md"
Cohesion: 0.12
Nodes (17): 2026-09-05 — backend: build, Commit 1 — `bd5a8080` `refactor(door-sweep): lift PRED_DOMAIN, never re-type the arm's domain`, Commit 2 — `0a0d3489` `fix(door-sweep): select doors by prosecdef, split sweepable from identified`, Commit 3 — `6234677d` `fix(door-sweep): read ALTER FUNCTION … SECURITY DEFINER like ALTER POLICY`, Commit 4 — `1ba83bff` `fix(door-sweep): parse the whole door-sweep-targets declaration`, Commit 5 — `b08b5734` `feat(door-sweep): per-case provenance and an explicit SCOPE`, Commit 6 — `9ba4cc35` `feat(harness): merge generated rows into the findings baseline, preserve hand-authored material`, Commit 7 — `8ca0d9ba` `test(door-sweep): SELFTEST=1 over committed fixtures` (+9 more)

### Community 684 - "server-after-nonblocking.md"
Cohesion: 0.08
Nodes (25): 1. Method, 2.1 The four-gate correction is complete — enumerated, not taken on trust, 2.2 The single-point predicate really is single-point, 2.3 Fail-closed — confirmed on every path, 2.4 The second gate is present — no P0, 2.5 T4 is correct **for Increment 1**, and the comments say why truthfully, 2.6 The excluded classes, verified from the catalog rather than from the spec, 2.7 Per-affordance authority on the widened manage host (+17 more)

### Community 685 - "server-auth-actions.md"
Cohesion: 0.12
Nodes (17): Could not verify — each is a work item, not a pass, Disposition for the PO, F-BLOCK-1 — the merge helper silently destroys hand-authored material in the committed baselines, F-MAJOR-1 — the `SCOPE:` line cannot distinguish a catalog-backed derivation from a provisional one, F-MAJOR-2 — the `SCOPE:` line is still missing on both exit-1 paths (and every exit-2 path), F-MAJOR-3 — a continuation line bearing a bare schema prefix ends the declaration silently, and the parse error advertised for it is unreachable, F-MAJOR-4 — nothing tests the merge helper, and `MERGE_FAULT` is not gated, F-MAJOR-5 — a merge abort does not reach the harness exit code, and is indistinguishable from "nothing changed" (+9 more)

### Community 686 - "server-cache-lru.md"
Cohesion: 0.20
Nodes (9): 1. Method, 2. What reproduced exactly (the positive census), 3. Findings (r1) — and the fix each received, 4. QA-added coverage — the declared hole, closed at the right layer, 5. Carried forward to gate step 4 (PO) — none of these are S6 defects, 6. r2 — verification of the fixes, DM5·S6 — QA review (canon rewrite + program exit sweep), Scope of this verdict — written down so it cannot be inferred wrong (+1 more)

### Community 687 - "server-cache-react.md"
Cohesion: 0.07
Nodes (29): B1 · The console list counts a RETIRED task as a COMPLETED one — the `blocked` reader sweep is not complete **[V]**, B2 · The PHI-disposal corridor's keystone assertion passes when the row is absent **[V]**, BLOCKING, ⛔ Deferred — needs catalog verification, Findings on the E2E specs, ranked **[V for the four quoted; R for the rest]**, Item-by-item answers to the audit brief, judgement on the whole slice, m10 · The reviewer's full name is stated to be delivered to the data subject **[V]** (+21 more)

### Community 688 - "server-dedup-props.md"
Cohesion: 0.12
Nodes (17): 0. Headline, 1.1 N-1 (was BLOCKING) — closed. All four stale occurrences corrected; nothing left claiming C1 returns to `a115005b…`, 1.2 N-2 (MINOR) — closed on the hub; the record's stale figure is corrected in-entry, not in-place, and that is defensible, 1.3 N-3 (MINOR) — closed, 1.4 N-4 (MINOR) — closed, and the 18 is now derivable rather than asserted, 1.5 N-REC-1 — the pin is real, it is on description text, and an absent `Result: PASS` alone can no longer read COVERED, 1.6 N-REC-2 — the qualifier's figures and its consequence are correct, 1.7 Gates and change surface at the tip (+9 more)

### Community 689 - "server-parallel-fetching.md"
Cohesion: 0.20
Nodes (10): R2-1 · The F-1 fix — verified independently, three ways, R2-2 · Backend's two judgement calls — both correct, R2-3 · The sweep's control argument — I tested it, and it holds, R2-4 · The sweep's conclusion — independently reproduced, not audited by description, R2-5 · BUG-RCA-001 — confirmed; **does not block this phase**, R2-6 · Round 1 items re-checked, Round 2 — re-review (HEAD `f6c847d`), Two things to settle before deploy, outside this review's scope (+2 more)

### Community 690 - "server-parallel-nested-fetching.md"
Cohesion: 0.18
Nodes (11): 1. Requirements audit — AC-1 … AC-6, 2. Gate 18 — is it a real ratchet, and can it be laundered?, 3. `420` — the four verdicts, 4. `413` / `409` — the pin flip and the reshape, 5. `.claude/rules/` and the backend-state seam, AC-1, checked against the four cells the task names, AC-2, verified from the LIVE catalog, not migration text, My own enumeration of readers of the constant — the record's claim holds (+3 more)

### Community 691 - "server-serialization.md"
Cohesion: 0.29
Nodes (4): mutate(), one_case(), restore_migration(), ae13-person-doors-mutation-audit.sh script

### Community 692 - "_template.md"
Cohesion: 0.20
Nodes (10): Ad-hoc bug-fix batch (2026-08-03) and the seven bugs it triaged, ✅ BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **FIXED 2026-08-03** (filed 2026-07-27, PO's call), ⚪ BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-07-28), ⚪ BUG-E2EISO-003 — `bulk-case-creation.spec.ts:344` (AC2) is not idempotent across runs on one DB · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-08-03), ✅ BUG-GATE-001 — `scripts/e2e-prod-gate.sh` drops a `reset FAILED` batch from its OWN coverage denominator · owner **lead** · **FIXED 2026-08-03** (filed 2026-08-03, found by the lead during the FF-4 gate), ✅ BUG-P15-001 — `phase15-indicators.spec.ts` AC-4 fails on the 1st-4th of any calendar month — seed-data date arithmetic · owner **tester** · **FIXED 2026-08-03** (filed 2026-08-03), ✅ BUG-P22-001 — the referrals hub does not render a seeded `completed` referral · owner Phase 22 · **CLOSED — NOT REPRODUCIBLE 2026-08-03** (filed 2026-07-27), ✅ BUG-P22-002 — `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note fails · owner **tester** · **FIXED 2026-08-03** (filed 2026-07-27) (+2 more)

### Community 694 - "decisions-log.md"
Cohesion: 0.12
Nodes (23): getAudioJobStatus(), isAudioServiceConfigured(), MeetingMinutesResult, ALLOWED_AUDIO_MIME_TYPES, AUDIO_ACCEPT_ATTRIBUTE, ADR-0099, deleteAudio(), failJob() (+15 more)

### Community 695 - "phase-0.md"
Cohesion: 0.20
Nodes (10): 0166 — governance-role provisioning implies an organization affiliation, 1. ⛔ Clause 5 says "remains refused". Measured, nothing refused it before., 2. Three defects in the ruling's own verification design, found by building it, 3. The historical backfill (§5) is discharged by a REMOTE RESET, not by a migration, Amendment 1 — clauses 5 and 6 are NARROWINGS, and the historical repair is discharged by a remote reset (2026-08-28), Consequences, Context, Decision (+2 more)

### Community 696 - "phase-1.md"
Cohesion: 0.07
Nodes (19): addReferralSharedItem, createReferralDraft, draftDetail, removeReferralSharedItem, sendReferral, setReferralPatient, storedPatient, ADR-0137 (+11 more)

### Community 697 - "phase-2.md"
Cohesion: 0.07
Nodes (27): §1 Verified-facts baseline (measured 2026-08-21 — re-verify, never quote), §2 Step 0 — repair BUG-QO-STALE-CASOS (tester; no app code), §3 Increment 1 — routing/UI (frontend + tester; no DB, no migrations), §4 Increment 2 — the S8 arm + `read_cases` capability (backend + tester), §5 File ownership (binding — CLAUDE.md §4), §6 Known traps this program walks past (each has burned this repo), §7 Acceptance summary, §8 Non-goals (from ADR 0134 — do not scope-creep them back in) (+19 more)

### Community 698 - "phase-3.md"
Cohesion: 0.18
Nodes (9): assert(), audit_polarity(), build_repo(), done_ok(), group_end(), group_start(), merge_scenario(), scenario() (+1 more)

### Community 699 - "phase-4.md"
Cohesion: 0.20
Nodes (10): 0172 — AE4's catalog substrate: MATCH FULL is the assignment binding, unreachable scope kinds carry the non-membership roles, and three classification columns are deferred, 1 — The composite FK is `MATCH FULL`. The default would have been a label., 2 — The discriminator is a GENERATED STORED column, and the referential actions are RESTRICT., 3 — `platform_admin` and `administrativo` carry structurally unreachable scope kinds., 4 — Three classification columns are NOT CREATED; `risk_class` is (PO override)., 5 — Every classification column is a DOMAIN over `text`, never a native enum., 6 — No `ALTER DEFAULT PRIVILEGES` statement, and that absence is a decision., Consequences (+2 more)

### Community 700 - "phase-5.md"
Cohesion: 0.20
Nodes (10): 0. The one paragraph that matters, 1. Preconditions (verify, do not assume), 2. Order — schema first, then code, 3. Smoke checks — the paths that break if anything is wrong, 4.1 The artifact (taken at step 2.3, before anything runs), 4.2 Roll FORWARD (preferred), 4.3 Roll BACK (only if the schema itself is wrong), 4. Rollback (+2 more)

### Community 701 - "phase-6.md"
Cohesion: 0.20
Nodes (10): Also rotated 2026-08-11 — FUP-QOB-1 (a separate, earlier closure), `created_by = auth.uid()` in `response_group_instances_write_own_draft` is no longer independently observable; PROVISIONAL structural pin landed (backend 2026-08-09; needs PO ratification), ⬛ FUP-GATE-RESET-FLAKE — RESOLVED 2026-08-11 (the diagnosable half); the restart POLICY stays the PO's call, ⬛ FUP-P16-2 — RESOLVED 2026-08-11: both reads routed through `queries/` (Rule 9), ⬛ FUP-P16-4 — RESOLVED 2026-08-11 — 10 files carried the pluralization pattern that shipped two bugs (latent, safe today), ⬛ FUP-PDF-2 — RESOLVED 2026-08-11: the allowlist is now "ours BY CONSTRUCTION", not "ours today", ⬛ FUP-QO-9 — RESOLVED 2026-08-11: both classifier gaps closed, plus the race itself is now WAITED OUT, ⬛ FUP-QOB-1 — RESOLVED 2026-08-09: the J1c structural pin is RATIFIED as the standing guard (PO) (+2 more)

### Community 703 - "loading.tsx"
Cohesion: 0.20
Nodes (10): ⬛ FUP-A11Y-1 — `useFieldIds` derives the DOM id from `useId()`. ✅ DONE 2026-08-05., ⬛ FUP-AUTHZ-2 — 15 BLIND authz gates — **RESOLVED 2026-08-05**, ⬛ FUP-AUTHZ-3 — the 45 row-returning DEFINER doors are swept. ✅ DONE 2026-08-05., ⬛ FUP-AUTHZ-4 — pruned the 6 now-COVERED entries from the BLIND allowlist. ✅ DONE 2026-08-05., ⬛ FUP-BULK-1 — bulk wizard deals to SUSPENDED members — **RESOLVED 2026-08-05**, ⬛ FUP-MEM-1 — `ARM=floor`'s 3 never-called INDICATOR doors — **RESOLVED 2026-08-05, not a defect**, ⬛ FUP-MEM-2 — `assignOrgAdmin` door migration — **RESOLVED 2026-08-05, spec RUN and green (3/3)**, ⬛ FUP-MEM-3 — the DT referral plane's product callers — **COMPLETE 2026-08-05** (+2 more)

### Community 704 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.20
Nodes (9): ⭐⭐ Correction 1 — the accepts-`undefined` set is TEN, not one, ⭐⭐ Correction 2 — `rows[0].field` THROWS, so it is SAFE, ⭐⭐ Correction 3 — the item's own evidence is STALE, in both directions, Fixed and TRIAGED — 3 real defects, FUP-E2E-ABSENT-ROW-ASSERTIONS — `expect(row?.field).not.toBeNull()` passes when the row is ABSENT, and it is live on PHI-erasure assertions (owner: tester/lead; **the number was wrong in BOTH directions before anyone measured it**), ⬛ INCIDENT (recorded 2026-08-20) — a process tree is not dead because the child you named is, § MEASUREMENT 2026-08-29 — the property, derived; and two corrections to THIS ITEM, The detector — `scripts/check-absent-subject-assertions.mjs` (+1 more)

### Community 705 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.14
Nodes (14): Blocking, BUG-AMV2-001 fix: CORRECT ✅, Conclusion, Findings, HC080 default-value validation + BUG-AMV2-002 fix: COHERENT ✅, Immutability (Rule 5): CORRECT ✅, Keystone invariant — evaluator parity (Rule 3): HOLDS ✅, Minor / non-blocking (informational — no change required to approve) (+6 more)

### Community 706 - "page.tsx"
Cohesion: 0.15
Nodes (12): ═══════════════════════════════════════════════════════════════════════════, ═══════════════════════════════════════════════════════════════════════════, ADR 0078 — Gate 2 (Stage C · F1 · N1) — QA Review, Finding 1 — P0 (org user reads the meeting surface) → **CLOSED**, Finding 2 — MAJOR-1 (`meeting_agenda_items.description` unmasked) → **CLOSED**, Finding 3 — MAJOR-2 (reserved content escapes the meeting child lock) → **CLOSED**, Finding 4 — MAJOR-3 / 228 adjudication → **CLOSED** (predicate correct + mutation-proven falsifiable), Finding 5 — MINOR-1 (respondent gets times/`case_id` from the reserved door) → **substantively addressed; rides as a noted MINOR** (+4 more)

### Community 707 - "ADR 0004 — Sign-off enforcement feature flag"
Cohesion: 0.18
Nodes (5): BeginTemplateEditButton(), beginTemplateEdit, push, refresh, ADR-0096

### Community 708 - "parse-config.ts"
Cohesion: 0.12
Nodes (16): A — D8's HEAD definition has a STANDALONE lane it never covers (extension, PO-ruled), ADR 0126 — A print belongs to a SERIES, and currency is DERIVED, Amendment 1 — eleven findings from BUILD, not from review (2026-08-18), B — D12's "anon-reachable DEFINER door" is true at the PRODUCT level and false at the POSTGREST level, C — D9's parenthetical *"(same revision, content identical …)"* is FALSE, Consequences, D — D6's one-line authority description is wrong for MEETINGS, Decisions (+8 more)

### Community 709 - "14. Recommended Indexes"
Cohesion: 0.17
Nodes (20): DISPOSAL_KINDS, DsrTaskCard(), adjudicateDsrRequest(), attestDsrTask(), closeDsrRequest(), completeDsrTask(), createDsrRequest(), disposeMeetingMinutesTask() (+12 more)

### Community 710 - "8. State Machine"
Cohesion: 0.12
Nodes (16): Backend State — the data-access surface, Case-access doors — the terminal-write refusal is a load-bearing arm (2026-09-10, ADR 0205 D9), Chain-only facts with no other home, Corrections to posted sections above, Current state, Data-access & action modules (Rule 9 — no inline supabase-js in UI), Extracted from the pre-split stamp chain, Feature flags (`app.feature_flags`) (+8 more)

### Community 711 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.04
Nodes (62): ADR-0117, advanceToInReview(), conclude(), createReferralDraft(), firstActiveReferralTypeId(), firstReplyOutcomeId(), freezeDocument(), rpc() (+54 more)

### Community 712 - "11.1 `interview_notes`"
Cohesion: 0.12
Nodes (16): ADR 0191 — The door arm's domain gains a SCHEMA axis, the set-valued resolvers get a committed home, the read arm stops being mirror-ambiguous, and a fourth outcome stops discarding a real signal, Consequences, Considered options (and why they lost), Context, D1 — `PRED_DOMAIN` gains a THIRD admitting disjunct: `n.nspname = 'authz'`, bounded at `bool`, D2 — The bound, stated as this arm's domain and accepted as such, D3 — The set-valued resolvers are swept by TARGETED cases with a committed, scheduled home, D4 — The read arm opens the `using` half ALONE (+8 more)

### Community 713 - "Feature — `case_phase_results` (per-phase categorical result + manual override)"
Cohesion: 0.12
Nodes (15): 0. What you're pointing at, 1.1 Push pending migrations, 1.2 Verify asymmetric JWT signing keys (known gap — ADR 0009), 1.3 Register the custom access-token hook, 1.4 Note your keys, 1.5 Email (defer for now), 1. Pre-flight on Supabase Cloud (one-time, before the first deploy), 2. Get the repo onto the droplet (+7 more)

### Community 714 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.22
Nodes (9): A · The manifest tool (`scripts/storage-manifest.mjs`), B · The reconciliation command (`scripts/document-reconciliation.mjs`), C · The disposal job — what exists to schedule, Could not verify, D · Backup/restore drill surface, DM5 · S5 — Step 0 surface verification, E · EXPLAIN/latency baseline targets — document list / open / sign, F · Unnamed surfaces (+1 more)

### Community 737 - "app.answer_map (evaluator input rebuild)"
Cohesion: 0.12
Nodes (16): 2.1 — Auth → URL Configuration, 2.2 — JWT signing keys: migrate to asymmetric (the ADR 0009 "prod-auth gap"), 2.3 — Enable the custom access-token hook (the `is_admin` claim), 2.4 — SMTP + email verification (optional at first), 2.5 — Bootstrap the FIRST `platform_admin` (manual SQL — there is no in-app path), Architecture, Deploying to DigitalOcean + Coolify (test environment), Known risks & gotchas (+8 more)

### Community 738 - "backend-state.md — Backend Capability Map"
Cohesion: 0.12
Nodes (16): 1. Why these batches exist, and why "before AE5", 2. Concluded — Batches 0, 1, 2, 3, 4, 6, 7, 8, 9, 10 (Batch 5 rode inside Batch 4; Batch 10 = the named consequence, row 10), 3. Remaining — ⭐ NONE. Batch 9 concluded 2026-09-10; the blocks below are KEPT, each under a banner, 4. The protocol every batch follows (measured over three batches), 5. Standing facts that bite (verified during Batches 0–2), 6. Where the next session starts, Batch 3 — Write-arm baseline (`supabase/tests/mutation/p0-authz-writepath-audit.sh`) — owner backend, Batch 4 — Enforcement manifest + the template's re-key defect — owner backend, one PO item (+8 more)

### Community 739 - "dispose_event_phi / dispose_case_phi / dispose_referral_phi (LGPD erasure)"
Cohesion: 0.12
Nodes (16): 2026-09-07 — backend: the CARRIED dispositions applied, the re-baseline committed, step 11, ⛔ A REAL FINDING AT STEP 11, and it is DISCLOSED rather than filed away quietly, Bookkeeping — APPLIED, in the same commit, as the file's own instruction required, Closures — five, each on its QUOTED condition, clause by clause, For the lead — the SECOND §4 line, drafted here, not applied, Hand notes archived at the Batch 2 re-baseline (2026-09-07), Registers, after, Step 11 — the gate, on a FRESH reset, every code read BARE and nothing piped (+8 more)

### Community 740 - "app.feature_flags + get_feature_flags"
Cohesion: 0.12
Nodes (16): 0. What I re-derived myself (not accepted), 1.1 The P0-1 proof — real, and the sentinel genuinely fails, 1.2 MAJOR-1 cannot over-narrow — confirmed from the catalog, 1.3 Your gate claims — not overstated; if anything under-claimed, 1.4 The `e2e:prod` triage — it does not block, and I am not deferring to you, 1. The four items I was asked to scrutinise hardest, 2. Disposition of every r1 finding, 3. r2 findings (+8 more)

### Community 741 - "app.is_commission_admin_of (combined predicate)"
Cohesion: 0.12
Nodes (16): 0. Headline, 1. Method — what I measured, and how, 2. Disposition of every first-review finding, 3. Items the task asked me to judge, ruled, 4. Gate evidence at the tip — provenance assessed, 5. New observations (none blocking), 6. The first review's could-not-verify list, answered, 7. New could-not-verify list (each is a work item, not a clearance) (+8 more)

### Community 742 - "Migrations catalog (forward-only additive)"
Cohesion: 0.24
Nodes (14): buildFixtures(), canonicaliseBaseline(), collectArrayBody(), CONFIG_PATH, dropLineMatching(), inspect(), normalise(), parseArrayLiteral() (+6 more)

### Community 875 - "Unified non-PHI action_items hub"
Cohesion: 0.15
Nodes (13): Conclusion, Findings, INFO-1 — `case_phase_option_aggregates` lacks the `status='completed'` filter its sibling has, INFO-2 — stale doc-comment mentions `reopen_narrative`, INFO-3 — `save_correction_draft_body` audits with action verb `case_correction.draft_started`, INFO-4 (positive) — free-text reasons deliberately excluded from `audit_log`, INFO-5 — test gate taken on faith (tester/lead-owned), MINOR-1 (non-blocking) — void approvals do not stamp `impact_snapshot` (+5 more)

### Community 876 - "CAPA stays isolated (PHI, Rule 12)"
Cohesion: 0.09
Nodes (23): 0. Shape of the work, 0a-bis — How the `required` invariant is actually enforced (design ruling, lead + backend 2026-08-23), 0a. Process PHI collection mode (D1–D3), 0b. Narrative rename + assignment role (D10, D11), 0c. TS side, 0d. pgTAP, 1a. Attributed-work affordance (D8), 1b-bis — What §1b got wrong, found during the build (2026-08-23) (+15 more)

### Community 877 - "committee_* SECURITY DEFINER RPCs"
Cohesion: 0.07
Nodes (30): A. Moved out entirely (12 rows, 2026-08-08 → 2026-08-14) — no live counterpart, Archive — Decisions (PROGRESS.md § Decisions register), B. Verbose form of the 32 rows that REMAIN live as one-liners, Collapsed index rows rotated out of PROGRESS.md 2026-08-04 (all decisions dated 2026-06-*), Live index rows as they stood before the 2026-08-14 compaction (32 rows, pre-2026-07 → 2026-08-10), Rotated 2026-08-21 — OPEN-2 (case-surface-split): the RECORD OF THE QUESTION, after the PO ruled, Rotated 2026-08-21 — OPEN-3 (case-surface-split): the Rule 12 question and its measured answer, Rotated 2026-08-23 (AFF2 rotation pass) — 15 concluded decision rows (+22 more)

### Community 878 - "Hub-and-spoke shape, redrawn boundary (Option A)"
Cohesion: 0.22
Nodes (9): 1. `repeating_group` — **explode by child `question_key`** (do not collapse), 2. `matrix` — **the cell is the unit; address `(question_key, row_code, col_code)`**, 3. `risk_matrix` — **derived scalar by `question_key` + severity/likelihood distributions**, 4. `reference` — **aggregate on `participant_id`, never the label**, Consequence for the F3 inert tables (built against this note), Cross-cutting invariant (applies to all four types), F3 — `question_key` → aggregation contract for the new field types, Per-type contract (+1 more)

### Community 921 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.22
Nodes (9): 10.1 Catalog and schema tests, 10.2 Decision-matrix tests, 10.3 Product-called path tests, 10.4 Mutation tests, 10.5 Shadow evaluation tests, 10.6 Performance tests, 10.7 Migration and rollback tests, 10.8 Required release gates (+1 more)

### Community 922 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.22
Nodes (9): 9. Phased implementation plan, Phase 0 — Record, baseline, and freeze the interface, Phase 1 — Add catalogs and scope registry in shadow-only mode, Phase 2 — Unify authorization mutations, Phase 3 — Introduce the shared read decision seam, Phase 4 — Replace active role type with authorization context, Phase 5 — Add resource grants and adapters, Phase 6 — RLS consolidation and privileged-function hardening (+1 more)

### Community 923 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.13
Nodes (28): arm_inflight(), classify(), count_sel(), d1_case(), degenerate_gates(), derive_worklists(), disarm_inflight(), domain_statement() (+20 more)

### Community 924 - "10. Row-Level Security Strategy"
Cohesion: 0.22
Nodes (9): 10.1 Mandatory project gate for every phase/sub-wave, 10.2 Catalog and privilege tests, 10.3 Authorization behavior matrix, 10.4 Mutation testing — non-negotiable, 10.5 Storage and lifecycle integration tests, 10.6 Domain integration tests, 10.7 Migration and reconciliation tests, 10.8 Performance tests (+1 more)

### Community 925 - "useClientNow"
Cohesion: 0.22
Nodes (9): 21. Rejected alternatives, Administrator `OR` arms in RLS, Nine-table ethics procedure set, Ordered `max_confidentiality`, Separate `ethics_appeals`, Separate `ethics_cases` root, Separate `ethics_findings`, Separate `ethics_hearings` (+1 more)

### Community 926 - "ADR 0005 — `visible_when` condition shape (v1)"
Cohesion: 0.04
Nodes (52): Appendix A — Polymorphism dialects (three sanctioned; closes hardening D12; ADR 0065), Appendix B — Catalog-vs-enum + freeze conventions (ADR 0065), ARCHITECTURE.md — Hospital Commission Forms Platform, Architecture Rules, This is NOT the Next.js you know, Authorization, Authorization and the door audit, Forms and responses (+44 more)

### Community 933 - "AuditEntityType"
Cohesion: 0.13
Nodes (15): Accreditation & Quality-Governance Track — Phases 13–21, Phase 13 — Audit Trail (Trilha de Auditoria), Phase 14 — Patient-Safety Events, Triage, RCA & CAPA (Eventos de Segurança do Paciente, Triagem, RCA & PDCA/CAPA), Phase 14a — NSP Foundation, Event Intake & Hand-off (req. event detection → notification), Phase 14b — Triage & Disposition (req. acknowledge → safety-event? → reach → harm → sentinel → pathway), Phase 14c — RCA Workspace (req. RCA team & roles · timeline · evidence · findings · fishbone & 5-Whys), Phase 14d — Corrective Action Plan, Effectiveness & Closure (req. actions+strength · tasks+evidence · measures→results · effectiveness · closure), Phase 15 — Quality Indicators (Indicadores de Qualidade) (+7 more)

### Community 934 - "0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)"
Cohesion: 0.22
Nodes (9): 26. API and Service-Layer Boundaries, Design rationale, `InterviewAccessService`, `InterviewConsentService`, `InterviewContentService`, `InterviewParticipantService`, `InterviewService`, `InterviewSessionService` (+1 more)

### Community 935 - "0069 — Anglicize status-enum internal keys (D11)"
Cohesion: 0.18
Nodes (11): 0. Independent reproduction of the gate figures, DM2 — orchestration + Wave A: QA review (r1), INFO, Items I was asked to assess rather than rediscover, MAJOR-1 — S1-O4 is not merely "a product question": a document on a `legal_privileged` interview is readable, and its PHI bytes servable, by members who cannot see the interview at all, MAJOR-2 — reconciliation is blind, by construction, to `failed`/`abandoned` files that DO hold bytes; the sweep can report `RECONCILIATION CLEAN` over undisposable PHI, MAJOR-3 — after a verification failure the upload dialog offers "Tentar novamente", which cannot succeed; each attempt drives an unaudited service-role download of the full object, MINOR (+3 more)

### Community 936 - "phase-result-options.ts"
Cohesion: 0.22
Nodes (9): 7.1 `interview_participants`, 7.2 `interview_participant_roles`, 7. Interview Participants, Design rationale, Primary interviewee constraint, Recommended uniqueness, Removal behavior, Suggested participation statuses (+1 more)

### Community 937 - "ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)"
Cohesion: 0.22
Nodes (9): 21.1 User profiles, 21.2 Organizations, 21.3 Hospitals, 21.4 Organization memberships, 21.5 Hospital memberships, 21.6 Committees, 21.7 Cases, 21.8 Role assignments (+1 more)

### Community 940 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.22
Nodes (9): 2.1 One identity, multiple scoped relationships, 2.2 Roles are assignments, not attributes of the user, 2.3 Scope does not imply inheritance, 2.4 Administrative access and clinical-data access are orthogonal, 2.5 No destructive deletion of historical identities or memberships, 2.6 Deny by default, 2.7 RLS is the final authorization boundary, 2.8 Service-role access is not normal application access (+1 more)

### Community 941 - "5.11 `referral_resolutions`"
Cohesion: 0.13
Nodes (15): 2026-09-11 — both ADRs drafted, the four registers re-claused, the reservations retired (backend), 2026-09-11 — lead gate at the tip; QA round 1 CHANGES REQUESTED (2 MAJOR · 1 MINOR · 2 NOTE), every finding re-measured by the lead, then fixed (lead), 2026-09-11 — merged: `main` fast-forwarded to the phase commit `0c2bdeaa` (written on `main`) (lead), 2026-09-11 — QA round 2 APPROVED (no new findings); hub → `gated`, awaiting human approval (lead), 2026-09-11 — RECORD STEP on the PO's approval (*"approved — run the Record step, merge to main, no push"*) (lead), 2026-09-11 — unit opened; the PO's rulings taken and captured VERBATIM (lead), 2026-09-11 — verification of the rulings' cited facts (backend), AE5-SUCCESSOR-ADRS — progress record (+7 more)

### Community 942 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.18
Nodes (10): affiliationRow(), openAffiliationDialog(), readMatricula(), setMatricula(), signInAs(), ADR-0097, ADR-0098, ADR-0106 (+2 more)

### Community 943 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.22
Nodes (9): 7.1 Document lifecycle status, 7.2 Document version status, 7.3 Confidentiality labels, 7.4 Asset roles, 7.5 Document permissions, 7.6 Principal types, 7.7 Relationship types, 7.8 Access inheritance modes (+1 more)

### Community 944 - "0040 — Form Builder Enhancements: condition engine, per-item visibility, additive schema"
Cohesion: 0.22
Nodes (9): 1. What landed, 2. Finding that invalidated the design note's §5.4 mounting plan — verified live, not assumed, 3. A second bug caught by the SAME live testing — the D9 hint suggesting the active hat, 4. The backend-posted `assumeRole` vs. `<form action>`'s own type contract, 5. `roleLabel` — the design note's own open question (§7 Q6), resolved, 6. Live verification (production standalone build, real personas, real DB), 7. Gate, 8. Scope note (+1 more)

### Community 945 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.13
Nodes (15): 0. Method, 1.1 F-MAJOR-1 — arm 4a, both conjuncts comment-stripped, 1.2 F-MAJOR-2 → the iteration-2 rule, 1.3 F-MAJOR-3 — `BASE_S_OVERRIDE`, 1.4 F-MAJOR-4(a) and (b), 1.5 F-REC-1 — the preflight arms fail CLOSED, 1.6 F-REC-3, 1.7 F-REC-2 — and my judgement on the two files left carrying `8764` (+7 more)

### Community 946 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.28
Nodes (8): event(), interleave(), ReferralThread(), ThreadRow, timeKey(), ADR-0037, ReferralMessage, ReferralReadReceipt

### Community 947 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.20
Nodes (10): 14.1 Target committee inbox, 14.2 Source committee inbox, 14.3 Case referral history, 14.4 Deadlines, 14.5 Message ordering, 14.6 Message timeline, 14.7 Active participation, 14.8 Active assignments (+2 more)

### Community 948 - "10. Row-Level Security Strategy"
Cohesion: 0.13
Nodes (15): Audited and found sound — do not re-do these in the fix loop, B1 — `237 of 467` is a 2026-08-22 snapshot, republished on 2026-09-08 as the live consequence, in four new artefacts (three undated), while `320` §U1's live ratchet says the coincident set is **236**, B2 — `docs/lint-gates.md:1` states a false duration: *"the list understated itself by one for five days"*, B3 — `320` §U6d attributes a `proacl IS NULL` count to a "no direct grant" property — the exact predicate confusion R26 corrected, twelve lines above the assertion that cites R26's lesson, B4 — R16 is a hard condition and gate 14 does not meet it for the single most predictable edit: `"app"` added **and** the sentinel deleted in one commit reds as a formatting problem, and the word `app` never appears, BLOCKING, Fix list, in order, M1 — ADR 0195's Consequences claims an enforcer its own D1 says does not exist (+7 more)

### Community 1032 - "RSC closure-to-client-component serialization bug (P11-001/P10-LATENT-001)"
Cohesion: 0.22
Nodes (9): 4 INFO forward-notes (hand to backend when the FF phases start — NOT this gate), F3 — Flexible-Forms Foundation (ADR 0060) — durable record, FF roadmap — re-sequenced PRE-pilot 2026-07-27 (each its own ADR + flag + gate), Gotchas / notes, Green bar, QA verdict — ✅ APPROVED (0 B / 0 M / 0 m / 4 INFO), Sequencing note, Test verdict (tester) — E2E GREEN, 0 F3 regressions (+1 more)

### Community 1033 - "Sign-off RLS pre-check block bug (P6-001)"
Cohesion: 0.22
Nodes (9): 1. What shipped, 2. The decision that changed the phase, 3. Defects found, and what each proves, 4. Eight checks that were vacuous by construction, 5. Gate evidence, 6. Open items, 7. Process findings, FF-5 — Entity Reference (ADR 0091) — phase record (+1 more)

### Community 1034 - "Cross-spec shared-seed contamination class (P13-004)"
Cohesion: 0.22
Nodes (8): ⚠ `0 infra` is the POST-RETRY state — two batches collapsed, DSR — discharged, and the assertion it was hiding is already fixed, Environment traps hit while producing this run, Flaky tests, by identity, with batch health, Merged-tree full `e2e:prod` gate — 2026-08-25, `3894c667`, Non-regression: two formerly-deterministic reds stayed green, The 11 skipped tests, by identity, Verdict

### Community 1052 - "Prod asymmetric JWT signing key requirement"
Cohesion: 0.05
Nodes (63): CaseKpis, computeOutcomeBreakdown(), hasUnassignedWork(), BUILTIN_CASE_VIEWS, CASE_PERIOD_PRESETS, CASE_PROGRESS_OPTIONS, CaseFilterContext, CaseFilterState (+55 more)

### Community 1053 - "dispose_referral_phi LGPD-erasure parity gap"
Cohesion: 0.22
Nodes (8): BLOCKER, Completeness / premature-closure assessment, Findings, INFO, MAJOR, MINOR, QA Review — ADR 0064 (Case subject generalization: participants, professional registry, case types), Requirements & product-owner-decision fidelity

### Community 1054 - "Follow-ups / Deferred Items Archive"
Cohesion: 0.22
Nodes (8): 1. Method, and the one thing that weakens this review, 2. Requirements audit — D1…D7, 3. The follow-up commit — reviewed independently, 4. Security / RLS, 5. Test quality, 6. Findings, 7. Verdict, QA review — ADR 0136, deferred `staff_admin` sign-off

### Community 1055 - "NSP-per-org guard-lift phase (ADR 0042)"
Cohesion: 0.02
Nodes (77): AGENDA_UNRESOLVED_TITLES, dbDelete(), dbGet(), dbPatch(), getOwnerToken(), SERVICE_HEADERS, signInAs(), ADR-0080 (+69 more)

### Community 1056 - "Prod-build E2E harness debt (reducedMotion + DB isolation)"
Cohesion: 0.20
Nodes (10): 2026-09-11 — pgTAP 421 built; carriers re-worded (backend), 2026-09-11 — unit opened; the PO ruled option (a); feasibility measured on the live catalog (lead), 2026-09-12 — follow-up closure: `…SUPABASE-TEST-DB-LEAVES-NO-PGTAP-INSTALLED` (ad-hoc backend session, post-merge), 2026-09-12 — full-suite witness re-earned after the MINOR corrections; QA r2 spawned (lead), 2026-09-12 — gate step 1 closed by the lead; AC-1 deviation ruled; three follow-ups filed (lead), 2026-09-12 — QA r1 MINORs corrected in place (backend), 2026-09-12 — QA r2 MINOR-4 + NOTE-5 corrected in place, comment-only (backend), 2026-09-12 — step 2 RULED N/A by the PO; QA review spawned (lead) (+2 more)

### Community 1171 - "dispose_referral_phi (dual-hospital)"
Cohesion: 0.22
Nodes (9): 10 · The three blockers — CLOSED, 13 · Majors from round 1 — all CLOSED, 14 · The round-1 "could not verify" list — what discharged, 15 · Why APPROVED, 9 · Method for round 2, ✅ C1 — the flip's authorization, ✅ C2 — the invariant stated at its old value, ✅ C3 — the overturned P3 ruling (+1 more)

### Community 1172 - "GoTrue auth rate-limit (E2E env flakiness)"
Cohesion: 0.22
Nodes (9): DSR Slice 4 — QA review, round 2, N4 — two free-text columns are retained on an *assumption*, and the classification is internally asymmetric (non-blocking), N5 — `meetings.phi_disposed_reason` is called "coded/enumerated" and the catalog does not agree (non-blocking), r2 · 1 — Method, r2 · 4 — Part 3: is the retention disclosure complete?, r2 · 5 — Part 4: the twice-corrected claim, r2 · 7 — Non-blocking findings, r2 · 8 — Could not verify (a work item, not coverage) (+1 more)

### Community 1173 - "nsp_org_admin role"
Cohesion: 0.20
Nodes (10): 1. What was built, 2. Verified, and how, 3. ⚠ WHAT IS NOT VERIFIED — read before resuming, 4. QA state, 5. Open decisions — PO only, none blocking, 6. Traps that cost real time — do not re-derive these, 7. Resume checklist, ETH·E4 — session handoff (2026-08-11) (+2 more)

### Community 1174 - "NSP-per-hospital (Phase B)"
Cohesion: 0.08
Nodes (17): dualHospitalAdminSession, hospitalAdminSession, orgAdminSession, PERSON_DOOR_WRITES, rows, rpcCalls, SessionShape, siblingHospitalAdminSession (+9 more)

### Community 1175 - "Org-to-hospital re-key (B0-B5)"
Cohesion: 0.22
Nodes (8): B1 · AUD1's fix does not reach one live writer, and ADR 0149's superset Consequence is false — *measured*, B2 · Three documents claim `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` is closed; two record that closure as **proposed and rejected** — *read*, B3 · `docs/backend-state.md` does not document ADR 0149 / migration `20261003003000` at all — *measured*, BLOCKING, MINOR — worth fixing, not blocking, Notes on things I was asked to disagree with if I could, QA review — `feat/user-profile-redesign` (person-profile redesign · AFF3 · AUD1), Summary

### Community 1176 - "FIX-2 test-isolation leak (staff1 hospital_admin)"
Cohesion: 0.11
Nodes (24): CAPABILITIES, ADR-0061, ADR-0134, ActionState, addStaff(), appointAdministrativo(), authorizeStaffOps(), CAPABILITIES (+16 more)

### Community 1439 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.24
Nodes (6): callRPC(), createRealizadaMeeting(), firstMeetingTypeId(), pickAnyDate(), signInAs(), ADR-0137

### Community 1440 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.22
Nodes (9): 0163 — lifecycle authority over a fully-offboarded person: last-org retention, 1. ⛔ Retention is capability-BLIND. The Decision paragraph's "SUBSET" wording is RETIRED., 2. The "so do all six person-door kernels" claim was true of the string, false of the grain, Amendment 1 — the SUBSET bound was a category error, and the kernel claim was at the wrong grain (2026-08-28), An inconsistency this decision does not create, and must not be read as blessing, Consequences, Context, Decision (+1 more)

### Community 1441 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.40
Nodes (5): ADR 0183 — Acceptance condition P2 counts INVOCATIONS against a bound, not `loops` values, Consequences, Context, Decision, Options rejected

### Community 1442 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.22
Nodes (9): 7.1 ✅ CLOSED — five denials were pinned by UI TEXT, not by a status or an RPC error, 7.2 `commission.signoffs.sign` — RESOLVED, and the defect was MY CITATION, not the coverage, 7.3 Row 12's pinned entry — ⛔ NOT a defect after all — and one now-vacuous pin, 7.4.1 ✅ The three sibling gates, verified INDIVIDUALLY — and they are not uniform, 7.4 ⭐ NEAR-MISS: the dashboard row was one comment away from a silent over-grant, 7.5 `CorrectionCaps.canApprove` — RESOLVED, not a gap, 7.6 No column expresses PHI sensitivity — ✅ RESOLVED, shipped, 7.7 ✅ CLOSED — self-lift of one's own recusal now has a SESSION-LEVEL witness (+1 more)

### Community 1443 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.22
Nodes (8): ⚠ A cheap lint rule becomes possible — and it does NOT close this follow-up, Annotation landed at 30, not the 42 upper bound — the file-level trap was real, ⛔ CORRECTION 2026-08-20 (`frontend`, self-reported) — the true blast radius was **GET FORMS ONLY**, not 133 spreads, Enumeration (measured 2026-08-20, before the hook was touched) — the blast radius is ~1/3 of the class counts, FUP-FORM-IDENTIFIER-IN-URL — a sensitive field submitted BEFORE HYDRATION serialises into the query string. **4 leaks CONFIRMED AND FIXED (incl. CPF + MRN); the STANDING DETECTOR and the `useFieldIds` default remain open** (owner: frontend + lead; **class, correction, measurement and fixes all credited to `frontend`**), ✅ PO-RULED 2026-08-20 — INVERT the `useFieldIds` default (assigned to `frontend`; a SEPARATE change after Slice 3), ⛔ STILL OPEN — two limits `frontend` stated about its own sweep, The opt-in shape (ruled 2026-08-20) — `nameRequiredFor`, a closed union, ⛔ no `"other"`

### Community 1444 - "AuditEntityType"
Cohesion: 0.22
Nodes (9): 1. `authz.holds_role` — one site for the hat, 2. The twins — and the one that was VACUOUS on the first attempt, 3. F7 — the `authz` schema had never been in any arm's domain, 4. The two new arms, each proven able to FAIL, 5. FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — closed, with a finding inside the closure, AE4.7b — the chokepoint, 2026-09-01 (lead session, after AE4.7a), Gates at the end of AE4.7b — fresh `supabase db reset --local`, The headline: `test:db` is GREEN, and the twins were repaired rather than deleted (+1 more)

### Community 1445 - "ARCHITECTURE.md — Hospital Commission Forms Platform"
Cohesion: 0.22
Nodes (9): AE4.9 "do now" 1+2 — the resolver's contract corrected, and `assume_role` enforcing `session_selectable`, 2026-09-02 (backend), Every defect reproduced FIRST, on the live catalog at head `20261003007240`, Evidence — both polarities, and every suite shown able to RED, Gate figures — exits read DIRECTLY from output, never from a pipeline tail, One thing the build DISCOVERED (ADR 0177 D6), Records corrected in the same edit (stale-by-rename, no gate can see these), The zero-caller premise, measured BEFORE and AFTER, What AE4.9 items 1+2 did NOT do (+1 more)

### Community 1446 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.22
Nodes (9): R2.1 — B1 (DSR/LGPD link): FIXED, and the home is sufficient, R2.2 — B2 (rollback artifact): the encryption fix is right; the command targets the WRONG DATABASE, R2.3 — B3 (derived banner): the predicate is RIGHT — verified empirically — but the register carry-through left two false figures, R2.4 — N1 (backend-state.md): verified by property; the ruling I was asked to confirm is CONFIRMED, R2.5 — N2 (ARCHITECTURE.md): the rewrite contradicts the authority it cites, R2.6 — N3 / N4: verified fixed, R2.7 — Posture re-check after the fresh reset, Round 2 — re-review of the B1–B3 / N1–N4 fixes (2026-08-31, same reviewer) (+1 more)

### Community 1447 - "page.tsx"
Cohesion: 0.22
Nodes (8): ADR 0185 documentation restructure — gate-coverage review, ADR claims checked against the implementation, Findings, Gate exit codes (read directly, not through a pipe), Live counterexamples run (against exported functions, not the tree), Per-item gate table (D1–D8), Verdict: **APPROVED**, What this review did NOT verify

### Community 1448 - "loading.tsx"
Cohesion: 0.14
Nodes (17): asDocType(), DOC_TYPES, metadata, NewDocumentPage(), approvalProgress(), deriveStatus(), DocumentsPage(), matchesView() (+9 more)

### Community 1449 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.08
Nodes (32): BulkCaseCustomFieldValue, BulkCaseRow, bulkCreateCases(), BulkCreateCasesInput, BulkCreateCasesResult, normalizeDeadline(), parseFailedRowIndex(), serializePatient() (+24 more)

### Community 1450 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.25
Nodes (7): ADR 0152 — PostgREST maps the `P0*` SQLSTATE class to HTTP 500; the document-corridor 500 is a 73-function class, not a door defect, Consequences, Context, Decision, The class, The measurement (2026-08-26, local stack, PostgREST v14.5, bare `curl` through Kong), What this refutes

### Community 1451 - "form-builder-enhancements.md"
Cohesion: 0.25
Nodes (8): 1. The defect (F7), 2. Orphan preflight — both stacks, positive-controlled, 3. `ON DELETE` — DERIVED, not chosen, 4. Cascade closure — what these FKs newly make deletable, 5. Migration contract, 6. What AE1.1 does NOT do, AE1.1 — `commission_administrativos` FKs: preflight, derivation, and migration contract, Rule 11 holds through the cascade — checked, not assumed

### Community 1452 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.25
Nodes (8): 18. Relationships Summary, Core Relationships, Ethics Relationships, Forms Relationships, M&M Relationships, Meetings Relationships, Participant Relationships, Workflow Relationships

### Community 1453 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.25
Nodes (8): 20. Migration Strategy From Patient-Centered Cases, Phase 1 — Introduce the generic case type system, Phase 2 — Rename or wrap patient cases, Phase 3 — Add participant abstraction, Phase 4 — Move patient-specific fields to extension table, Phase 5 — Make form templates case-type aware, Phase 6 — Add ethics extension tables, Phase 7 — Harden RLS before production ethics usage

### Community 1454 - "Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA"
Cohesion: 0.20
Nodes (18): allow_body(), blind_from_findings(), census_proc_domain(), check_no_degenerate_gates(), psql_admin(), psql_c(), role_literal_sites(), run_arm_catalog() (+10 more)

### Community 1455 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.25
Nodes (8): 13.1 One authoritative Case predicate, 13.2 Respondent identity, 13.3 Active exclusion, 13.4 Targeted respondent submission, 13.5 Meeting access, 13.6 Attachment clearance, 13.7 `SECURITY DEFINER` requirements, 13. Authorization model

### Community 1456 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.25
Nodes (8): 20.1 Tenant integrity, 20.2 Hard-deny matrix, 20.3 Targeted submission isolation, 20.4 Meeting isolation, 20.5 Procedure lifecycle, 20.6 Classification and clearance, 20.7 Audit, 20. Verification plan

### Community 1457 - "13.1 `interview_statements`"
Cohesion: 0.25
Nodes (8): 6.1 `case_types`, 6.2 `process_templates`, 6.3 `cases`, 6.4 Stable Case-phase keys, 6.5 `case_access`, 6.6 `responses.target_case_participant_id`, 6.7 Case-restricted Meetings, 6. Changes to existing shared tables

### Community 1458 - "case-meetings-panel.spec.ts"
Cohesion: 0.25
Nodes (8): 11.1 Use form versions aggressively, 11.2 Use relational structure for queryable concepts, 11.3 Use JSONB selectively, 11.4 Store one answer per question, 11.5 Store snapshots, 11.6 Design for RLS from the beginning, 11.7 Keep workflow outside the form engine, 11. Final Design Principles

### Community 1459 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.07
Nodes (25): auditRowsFor(), restGet(), restoreFeatureFlags(), setFeatureFlag(), signInAs(), ADR-0038, ADR-0042, ADR-0064 (+17 more)

### Community 1460 - "case-meetings-panel.spec.ts"
Cohesion: 0.25
Nodes (8): 3.5 `forms.form_blocks`, Design Reasoning, Important Columns, Purpose, Relationships, Repeating Group Behavior, Suggested Table, Suggested Types

### Community 1461 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.25
Nodes (8): 28. Validation Rules, Consent rules, Finding and summary rules, Interview rules, Participant rules, Session rules, Statement rules, Transcript rules

### Community 1462 - "page.tsx"
Cohesion: 0.25
Nodes (8): 17.1 Hospital administrator adds a user already in the organization, 17.2 Existing platform user in another organization, 17.3 New platform user, 17.4 Remove user from a committee, 17.5 Remove user from a hospital, 17.6 Remove user from the organization, 17.7 Delete identity, 17. User invitation and registration workflows

### Community 1463 - "27. Example: Simple Action Item"
Cohesion: 0.25
Nodes (8): 32.1 General rule, 32.2 Helper function, 32.3 RLS for `documents`, 32.4 RLS for `document_sensitive_metadata`, 32.5 RLS for `document_versions`, 32.6 RLS for `file_assets`, 32.7 Important RLS warning, 32. RLS Strategy

### Community 1464 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.25
Nodes (8): 45.1 Basic access, 45.2 Case-linked document, 45.3 Redacted document, 45.4 Ethics complaint, 45.5 Form upload, 45.6 Expiring access, 45.7 Audit, 45. Testing Checklist

### Community 1465 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 4.1 Documents are first-class secured resources, 4.2 Logical document and physical file are separated, 4.3 Domain links and permissions are separated, 4.4 Sensitive metadata is separated from non-PHI metadata, 4.5 OCR text is sensitive data, 4.6 Use explicit access grants for sensitive documents, 4.7 Use materialized effective permissions for RLS, 4. Core Architectural Decisions

### Community 1466 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 10. Migration plan, Stage A — Capability spine and active-account closure, Stage B — Granular Case Access Grants, Stage C — Meeting boundary, Stage D — NSP Investigation model, Stage E — Attachment sensitivity enforcement, Stage F — Referral disclosure, Stage G — Cleanup

### Community 1467 - "loading.tsx"
Cohesion: 0.25
Nodes (8): 12. Performance requirements, 13. Decisions that must not be weakened during implementation, 14. Acceptance criteria, 15. Handoff starting point, 1. Objective, 4. Default access matrix, 9. Application behavior contract, User Permissions Model Handoff

### Community 1468 - "5.8 `referral_message_documents`"
Cohesion: 0.25
Nodes (8): 1. Derivation — re-derived from the catalog, not accepted from the hypothesis, 2. Per-function rewrite shape, 3. `can_manage_professional` — a pre-existing quirk deliberately preserved, not fixed, 4. Empirical equivalence proof — the load-bearing artefact of this stage, 5. Catalog property diff — every function, every axis, 6. Regression found and fixed — `test_helpers.claims_for` non-idempotency (Stage 1 defect), 7. Gate — full Phase Gate step 1, both `test:db` runs, and the diff-scoped sweep, Stage 2 — behaviour-preserving normalisation (backend, 2026-08-10)

### Community 1469 - "Phase 22 — Inter-Committee Case Referrals (`case_referrals`)"
Cohesion: 0.25
Nodes (8): 1. The fix, 2. `hospital_id` nullability — determined from the schema, not assumed, 3. Sibling-trigger sweep — bounded by the property, not the name, 4. Keystone — red-first, `supabase/tests/317_act_capa_audit_scope.sql`, 5. Catalog property diff, 6. Gate, BUG-CAPA-AUDIT-SCOPE-1 — fixed (backend, 2026-08-10), Commits (this section)

### Community 1470 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.27
Nodes (6): MatrixAxesEditor(), ADR-0089, MatrixConfigDialog(), toPreviewEntries(), ADR-0089, toAxisDrafts()

### Community 1471 - "add-block-menu.tsx"
Cohesion: 0.09
Nodes (32): metadata, OrgOverviewPage(), ReadinessChart, ReadinessChartLoader(), ReadinessBar, ReadinessChart(), CaseDetailMotion(), CHART_COLORS (+24 more)

### Community 1472 - "loading.tsx"
Cohesion: 0.25
Nodes (7): BUG-AIF-001 — Linux repro CONFIRMED; root-cause handoff, Prime suspect + next steps, Reproducible harness (rebuild in ~10 min), Residual confound to close FIRST in the new session, Ruled out (prior session + this one — each by experiment), Temp artifacts from this session, The decisive experiment (what settled it)

### Community 1473 - "loading.tsx"
Cohesion: 0.14
Nodes (14): ADR 0189 — One crash-safety protocol across the mutation harnesses: a verified restore, a bounded sweep, and both preconditions of a verdict, Consequences, Considered options, Context, D1 — A restore is believed only when the CATALOG agrees, D2 — One design, and it NAMES the harnesses it does not cover, D3 — The `DEGEN` preflight gains an arm for THIS harness's residue, in two halves, D4 — Both preconditions of a verdict are asserted AND PRINTED (+6 more)

### Community 1474 - "10. New table: `case_votes`"
Cohesion: 0.14
Nodes (14): ADR 0205 — The per-object grant plane convention: root ledgers, computed participation, catalog-named abilities — decided now, built after AE5, Amendment 1 — the external design audit's five findings ruled; the reusable shape made exact, Consequences, Consequences of Amendment 1, Considered options, Context — measured on the live catalog, D12·2 — Timing, widened, D2·2 — Narrowing is a typed registry reference; ownership is proven by a parent link; the children are listed per root (+6 more)

### Community 1475 - "12. Optional table: `ethics_decision_details`"
Cohesion: 0.14
Nodes (14): 0. Source anchors (what already exists — E1 extends, never re-creates), 1. Dependencies & serialization (S0 §E, plan §1/§5), 2.1 Data model (migrations, additive — window `20260720…`), 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables), 2.3 RPCs (all: assert flag · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0E·`), 2.4 RLS, 2.5 TS layer (`backend`-owned), 2. Canonical contract (BACKEND posts these typed stubs FIRST) (+6 more)

### Community 1476 - "ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case)"
Cohesion: 0.14
Nodes (14): 2026-09-11 — gate re-run at the tip by the lead; QA review APPROVED, zero findings (lead), 2026-09-11 — merged: `main` fast-forwarded to `94d52cb5` (written on `main`) (lead), 2026-09-11 — RECORD STEP on the PO's approval (*"approved — run the Record step, merge to main, no push"*) (lead), 2026-09-11 — ⚠ the phase commit landed with gate 9 RED; found one command later, fixed in the next commit (lead), 2026-09-11 — the split built: slice moved verbatim, gate 11 followed it, link check mutated (backend), 2026-09-11 — unit opened; review queue processed; nothing moved (lead), BACKEND-STATE-SERVICE-ROLE-SEAM — progress record, Blockers (+6 more)

### Community 1477 - "error.tsx"
Cohesion: 0.25
Nodes (7): Findings, MAJOR, MINOR (cheap — clear before Record per standing preference), Non-issues verified (called out to show they were checked), QA Review — Ad-hoc Narratives (add a narrative to an OPEN case), Re-review checklist for the fix loop, Summary of the audit

### Community 1478 - "loading.tsx"
Cohesion: 0.09
Nodes (22): Amendment 3 — the CPF grain ✅ (the one I was asked to look at hardest), Architecture rules and §8 conventions ✅, Blocking findings, ⚠ CHANGES REQUESTED, `list_org_people` (B3, door side) ✅, Non-blocking findings, On the known residues, Premises in my own brief that I checked (+14 more)

### Community 1479 - "loading.tsx"
Cohesion: 0.22
Nodes (9): ADR 0129 — A narrow disposal flag through the meeting child lock, Amendment 1 — `app.in_disposal_rpc` now has TWO readers (still one setter), Amendment 2 — the class this ADR closed was closed for ONE lane; three siblings still have it, Amendment 3 — the three siblings are FIXED, and the population was TEN across FOUR guards, Build record (2026-08-19) — what the obligations actually returned, Consequences, Context, Decision (+1 more)

### Community 1480 - "error.tsx"
Cohesion: 0.14
Nodes (13): Could not verify — a work item for the lead, not a clearance, Findings, MAJOR 1 — the seam's replaceable block states, without qualifier, something the live catalog refutes, MAJOR 2 — the door's own `prosrc` comment now asserts the opposite of this unit's thesis, and nothing filed it, MAJOR 3 — two permanent documents cite a commit that is not on the branch, MINOR 4 — the divergence figures are quoted at the `grant_keyed` grain in two homes that do not say so, MINOR 5 — no tip of this branch carries a recorded green `npm run lint`, and the forward pointer has no referent, MINOR 6 — a quoted witness is not where the record says it is (+5 more)

### Community 1481 - "error.tsx"
Cohesion: 0.25
Nodes (7): Bottom line, MINOR-1 — the mutation harnesses leave `pgtap` installed in `public`, which turns the **next** pgTAP run's t19 red, P1 (blocking) — the closed set is a **FLOOR**, not the population: three `SECURITY DEFINER` RPCs authorize on raw arms with no gate, QA Review — AUTHZ · M5: the `is_active` outer gate (defect ③), State pinned (§7.3), What I could NOT check, What I verified and found SOUND

### Community 1482 - "error.tsx"
Cohesion: 0.25
Nodes (7): Binding-rule preservation — verified ✓, Change-map (section by section), CLAUDE.md optimization — evaluation & change-map, How to adopt (two steps, when you're satisfied), Out of scope this pass — recommended follow-ups, TL;DR, What the audit found

### Community 1483 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.14
Nodes (14): Bottom line, Job 1 — did iteration 2 fix its own five findings?, Job 2 — did iteration 2 introduce anything new?, N-MAJOR-1 (the orphaned routing tail) — **FIXED**, N-MAJOR-2 (the false universal, and the hidden fixture) — **FIXED** (residue: R2-MINOR-1), N-MAJOR-3 (the hub's `## Current state` stale inside the loop) — **FIXED** (residue: R2-MINOR-2), N-MINOR-1 (ADR 0203's present-tense register claim) — **FIXED**, N-MINOR-2 (eight-vs-five) — **FIXED as to naming** (residue: R2-MINOR-2) (+6 more)

### Community 1484 - "loading.tsx"
Cohesion: 0.25
Nodes (7): 1. Requirements (§I1–I5 + §4 state machine) — MET, 2. Security / RLS — SOUND (the load-bearing dimension), 3. Collision conformance (S0 §E) — CONFORMANT, 4. Code quality — CLEAN, 5. Findings (Info only — none blocking), QA Review — Interviews v2 (IV2): sessions + reporting/confidentiality, Verdict

### Community 1485 - "error.tsx"
Cohesion: 0.15
Nodes (13): ADR 0136 — Deferred `staff_admin` sign-off: attest a FROZEN response, block the PHASE not the SUBMIT, Amendment 1 — what the build found (2026-08-24), Consequences, Context, D7 — the decline path: SETTLED (PO ruling 2026-08-23), Decision, Gate record, Re-derivation of the whole table — 2026-08-23, two independent measurements (+5 more)

### Community 1486 - "loading.tsx"
Cohesion: 0.25
Nodes (7): Gate status, INFO (non-blocking), P0-1 — `coordinator_only` case-events leak to non-coordinator write-grantees (RLS hole; ADR-0079 reader-non-writer blindness) — ✅ RESOLVED r2 (`a64e61a`), Positively verified (evidence, not assertion), QA Review — S5 · ETH·E3a (Ethics terminology/UX surfacing), r2 re-review — P0-1 fix independently confirmed (2026-07-27), Verdict: ✅ APPROVED (r2, 2026-07-27)

### Community 1487 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.22
Nodes (9): 8.1 `draft → submitted`, 8.2 `submitted → accepted`, 8.3 `submitted → declined`, 8.4 `under_review → awaiting_information`, 8.5 `awaiting_information → under_review`, 8.6 `under_review → answered`, 8.7 `answered → resolved`, 8.8 `resolved → under_review` (+1 more)

### Community 1488 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 🔴 A STALE ALLOWLIST ENTRY PRE-EXCUSES A FUTURE DOOR — found by the repo-wide removal sweep, ✅ AUTHZ ARMS — all four HOLD (lead-run 2026-08-13, registration by backend: the split was deliberate), ✅ DIFF-SCOPED DOOR SWEEP — `BLIND: 0`; the one `ERROR` resolved by reading the runlog, DM3 — Wave B: controlled documents (phase record), ✅ GATE STEP 1 — **GREEN**, lead-verified independently (2026-08-13), ⛔ GATE STEP 1 — **RED**. `supabase db reset` FAILS (2026-08-13, lead-run), 🟢 IN PROGRESS — **DM3: Wave B — controlled documents** (opened 2026-08-13), ⚠ INCIDENT (2026-08-13) — `supabase/` left the index; 613 files deleted from HEAD, all recovered (+5 more)

### Community 1489 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.09
Nodes (22): 10. Controls — every zero, every instrument, 11. Not resolved by this task — named, not approximated, 12. The classification — one row per function, 1. The enumerated population, 2. How a class is decided — and why "who calls it" is the only input, 3. Class definitions as applied, 4. The deriving SQL (catalog side), 5. The app-side sweep — four tiers, and why the comment tier exists (+14 more)

### Community 1490 - "5.11 `referral_resolutions`"
Cohesion: 0.25
Nodes (7): How the detector was validated — read this before trusting any number, The gate, The property, The shapes the fixes took, Vacuous-assertion audit — FUP-VACUOUS-AUDIT-1 ✅ CLOSED, What counts as unconditional, What fixing these actually turned up

### Community 1491 - "5.4 `referral_assignments`"
Cohesion: 0.22
Nodes (9): Falsifiability — the new assertion was PROVEN able to fail, Left open deliberately — filed, not closed, Other gates, re-run at r3, P0-1 — re-verified from the catalog, independently of r2, ⚠ r2's MAJOR-1 was WRONG, and the prescribed fix would have been a regression, The other three findings, The r2 blockers — verified independently, The unproven set — cleared (+1 more)

### Community 1492 - "page.tsx"
Cohesion: 0.57
Nodes (6): run251(), run252(), run298(), run322(), run_case(), p0b-isolation-mutation-audit.sh script

### Community 1493 - "5.1 `case_referrals`"
Cohesion: 0.39
Nodes (4): baseline(), parse_tap(), run_mutation(), p3-case-print-mutation-audit.sh script

### Community 1494 - "error.tsx"
Cohesion: 0.25
Nodes (8): 0178 — AE4.9 D6 as built: the narrow authorizer, where the preserved legacy arm lives, and the differential reduction the re-key invalidated, 1 — `commission.forms.edit` gets a NEW narrow authorizer, not a re-keyed wrapper, 2 — A preserved legacy arm lives INSIDE the authorizer, not beside it at the policy, 3 — Three measurement shapes, each of which would otherwise have produced a vacuous proof, 4 — The re-key invalidated the AE4.5 differential reduction; the reduction is RESTORED, not relaxed, Consequences, Context, Decision

### Community 1495 - "17.1 `interview_external_access_links`"
Cohesion: 0.25
Nodes (8): 12.1 ⭐ The rule that forces the split is one this document already made, 12.2 The two non-obvious dispositions — both write `participants`, and they land on opposite sides, 12.3 All 13 dependents, dispositioned, 12.4 Where the derived cut differs from the proposed one, 12.5 Row 33 (was 31) — no sibling read code is needed, 12.6 Row 16 verification — case seating IS covered, 12.7 ⛔ The scope anomaly does NOT dissolve — it redistributes, 12. Row 30 re-derived — `can_manage_professional` gates three unrelated things

### Community 1496 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.25
Nodes (8): 9.1 Ruling on the crash — fix the class, not the symptom, 9.2 Ruling on P2/P3 — NOT unmeasurable. Their instrument never ran., 9.3 Ruling on P1's `commissions` hit — neither a defect nor a bound to re-derive, 9.4 Ordering hazard that outlived the crash, 9.5 ⭐ The result run 1 did produce — and it fails P5, 9.6 Cost of the re-run, 9.7 P1/P2/P3 evaluation commands (revised twice — see §10.1 for why), 9. Run 1 (2026-09-02) — VOID: diagnosis, rulings, and what changed

### Community 1497 - "34. Testing Strategy"
Cohesion: 0.22
Nodes (9): 9.1 Ask ① — R1 is closed, and the `'case'` arm survived, 9.2 Ask ② — `311` §5.1 genuinely generalises, within a stated anchor, 9.3 Ask ③ — R2's eight assertions: non-vacuous, with one isolation gap (MINOR), 9.4 Ask ④ — the PO-ruling pins are real and would fail loudly, 9.5 Carried forward (INFO, no action required for this phase), 9.6 What I did not check, 9.7 Verdict, plainly, 9. ROUND 3 — re-review of the M11 closure (+1 more)

### Community 1498 - "Lead notes"
Cohesion: 0.13
Nodes (15): ADR 0079 — AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule, Amendment 1 — the invariant becomes a PHASE STEP, scoped to the diff (2026-08-04), Amendment 2 — one mutation is not sufficient evidence of vacuity (2026-08-04), Amendment 3 — ARM 3, the census that stops the sixteenth (2026-08-04, extended 2026-08-05), Amendment 4 — ARM 1 gains a THIRD sweep: row-returning doors (2026-08-05), Amendment 5 — the census is blind to WRITE-PATH doors, and ARM 1's write sweep is a frozen list (2026-08-06), Amendment 5a — the diff-derivation command must be case-INSENSITIVE (2026-08-06), Amendment 6 — the census's population must be derived from CALL-SITE BINDING, not signature shape (2026-08-10) (+7 more)

### Community 1499 - "runLifecycle"
Cohesion: 0.12
Nodes (15): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), COVERED (asserted-through) + NOTICED (suite reddened, shape moved) + ERROR (harness bug), Note 2026-08-28 — AE2.4 increment 1: a gate that MIGRATED OUT of two domains, Note — a RENAME moves a gate's verdict, and the census keys on NAMES (2026-08-09), Note — AE2.2 re-predication: three verdicts RE-MEASURED, not inherited (2026-08-27), Note — AE2.4 increment 3: an AE1 `ERROR` discharged, and a name-keyed verdict re-earned (2026-08-28) (+7 more)

### Community 1500 - "rca-team-panel.tsx"
Cohesion: 0.25
Nodes (8): Bodies rotated from follow-ups.md 2026-08-24 (batch: gate-tooling round) — all three RESOLVED, ⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**, 🟡 FUP-0137-PHI-MODE-SHIMS — the derived `patientEnabled` / `collectsPatient` / `setTemplateCollectsPatient` shims must retire once the builder UI adopts `patientMode` (owner: backend + frontend), 🟠 FUP-42501-CONFLATES-GRANT-WITH-RLS — 2 of 12 P0-isolation assertions pass on a **table-grant** error, not on the RLS refusal they claim to prove (owner: backend + tester; **a COVERAGE defect, NOT a vulnerability — the tables are protected**), FUP-AUTHZ-CENSUS-PRUNE-NOTE-IS-WRONG, ⬛ FUP-AUTHZ-GATE-SUITE-DID-NOT-RUN-ON-MACOS — ✅ **FOUND AND RESOLVED 2026-08-24, same change** (owner: lead/backend; found by RUNNING `ARM=census`, not by reading it), 🟠 FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS — a pgTAP premise 136 files can state falsely (owner: backend/tester; filed 2026-08-22, found inside the ADR 0134 S8 suite; ⭕ **PARTIAL 2026-08-22** — root verb `test_helpers.reset_role_and_claims()` + red-first gate landed and adopted in `356`/`357`; ⛔ **step 1 (derive the real population) and the 134-file sweep remain OPEN**. Capable population 136 → 134, still not a defect count. Record: [case-split-assertion-integrity.md](../progress/case-split-assertion-integrity.md)), 🟡 FUP-VACUOUS-DETECTOR-FALSE-POSITIVE — `check-vacuous-assertions.mjs` flags a test as vacuous when a helper is declared inside it (owner: tester/lead; filed 2026-08-21)

### Community 1501 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.25
Nodes (8): Bodies rotated from follow-ups.md 2026-08-24 (resolved; their index lines left PROGRESS.md earlier), ⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO), 🟠 FUP-DISPOSE-EVENT-DOOR-GATE-BLIND — `dispose_event_phi`'s authorization gate is exercised by NO keystone: opening it leaves the full suite green (owner: backend; found by the ADR 0129 diff-scoped sweep), 🟡 FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING — `DSR_RESIDUE_NOTICE` line 1 is now CONDITIONALLY true, and the condition is a control the software cannot enforce (owner: PO copy call, then frontend; created by ADR 0131, 2026-08-20), Resolved 2026-08-24 — the ADR 0136 follow-up round (index lines rotated verbatim from PROGRESS.md), Resolved 2026-08-24 — the finding the ADR 0136 round's own sweep produced (index line rotated verbatim from PROGRESS.md), ⬛ Resolved — rotated 2026-08-13 (the DM2 Record step): **FUP-DM1-CEILING** (D15 ceiling, DM2·S1 + S4) · **FUP-DM1-E2E** (6+1 specs rewritten, DM2·S4) · **FUP-DM1-DISPOSE** (`dispose_case_phi` arm restored, DM2·S2) — each verified independently, not accepted from a report → [follow-ups-archive.md](./follow-ups-archive.md), Rotation notes rotated from PROGRESS.md 2026-08-24

### Community 1502 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.25
Nodes (8): ✅ FUP-QO-1 — RESOLVED 2026-08-07 (backend, F1; PO ruling D-FUP-1) — `p_expires_at` seam limits, deferred to Phase C (2026-08-06, backend; consumer: **D14 break-glass**), ✅ FUP-QO-2 — RESOLVED 2026-08-07 (F4+F7: catalog-derived role→landing guard, ADR 0101, `KNOWN_UNROUTED` empty; guard caught + F7 routed instances 4+5) — a non-commission-scoped role lands on "sem acesso": THIRD recurrence (2026-08-06, lead), ✅ FUP-QO-3 — RESOLVED 2026-08-07 (backend, F3, `bac7821`) — two vacuous `a2` mutation cases: the audit's coverage claim is overstated (2026-08-06, backend; lead-ratified file-don't-fix), ✅ FUP-QO-4 — RESOLVED 2026-08-07 (PO ruling D-FUP-4: strip stays global; shipped scope label is the fix; A.9 stands) — KPI-strip scope vs. the chip filter, ✅ FUP-QO-5 — RESOLVED 2026-08-07 (backend, F2) — t19 could MASK a real `anon` EXECUTE leak (2026-08-07), ✅ FUP-QO-7 — RESOLVED 2026-08-07 (PO ruling: **a NULL `p_expires_at` means PERMANENT — INTENDED**; ADR 0103; pinned in `183` §E) — the case-access PHI door NULL-CLEARS expiry on re-grant, UI-reachable, ✅ FUP-QO-8 — RESOLVED 2026-08-07 (backend, F8) — `list_my_nsp_hospitals()` ignored `is_active` and expiry (2026-08-07, backend; lead-scoped), Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)

### Community 1503 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-03 — folded from the AE4 handoff at ADR 0186 Wave 3, 2026-09-03 — state snapshot, after the C2 and scope-reaches folds (re-homed from the retired Now section of PROGRESS.md), 2026-09-03 — state snapshot (re-homed from the retired Now section of PROGRESS.md), 2026-09-03 — the Gate AE4 blocker batch, and two process defects in how it was recorded, 2026-09-04 — F-MAJOR-2 discharged: `ARM=catalog` and `ARM=sites`, named by what each asks, 2026-09-04 — ⭐ **Gate AE4 APPROVED by the PO**, on C2's closure, 2026-09-04 — re-review N2 / N3 / N4 / N6, and the door sweep's WRITE arm finally verdicted, Hub `## Current state` at Gate AE4 approval — cut from the hub 2026-09-04 (ADR 0186 D8) (+1 more)

### Community 1504 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.25
Nodes (8): AE4.7a — evidence repair, 2026-09-01 (lead session, after the QA pass above), F1 — 403's fail-proofs were vacuous. Repaired, and each PROVEN to fire., F4 + F5 — the generator reads its axes, and the expected-value file finally has a gate., F6 — pgTAP 405 now exists. It was cited twice and had never been written., F8 — the arithmetic, re-measured rather than transcribed, Gates at the end of AE4.7a — fresh `supabase db reset --local`, Next — the QA § "Recommended order", minus its step 1, What AE4.7a did NOT do

### Community 1505 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.15
Nodes (12): 1. Finish the tester gate (spawn `tester`, qa-tester), 2. Triage BUG-AMV2-001 (see PROGRESS.md bug table), 3. QA review (spawn `qa`, qa-reviewer, after tester green), 4. Human approval → 5. Record (lead), Answer-Model v2 — machine-switch handoff (2026-07-01), Confirmed kickoff decisions (human, 2026-07-01) — do not re-litigate, Migrations (forward-only additive on `20260620000000_baseline.sql`; baseline NOT edited), RESUME — do these in order (+4 more)

### Community 1506 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.14
Nodes (14): arm3_divergence(), build(), coverage(), expected(), expected_legacy(), _one(), EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES — never resolver logi, The approved answer for the LEGACY DOOR, transcribed from PO ruling R2. (+6 more)

### Community 1507 - "be3b-targeted-door-mutation-audit.sh"
Cohesion: 0.46
Nodes (5): AccountSituationBanner(), situationCopy(), endOfSuspensionDay(), formatSuspensionDate(), zoneOffsetMs()

### Community 1508 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.15
Nodes (13): ADR 0207 — The role catalog holds roles: `administrativo` becomes a capability-provider namespace whose entitlement source is each individual capability, and `platform_role` retires, Consequences, Considered options, Context, D1 — `administrativo` LEAVES `authz.roles`; the entitlement source is each individual capability, never one bundle, D2 — The capability→permission mapping constraints, D3 — `platform_role` is RETIRED, D4 — F7: one ordered manifest entry, compat exports derived, the binding test becomes a generated-artifact gate (+5 more)

### Community 1509 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.02
Nodes (76): Acceptance criteria, ADMIN-ARM-IS-ACTIVE — a deactivated `platform_admin` stops passing every admin arm in the tree, Acceptance criteria, AE5-MATRIX-ARM3-CELLS — the enumeration ADR 0175 D3 promised AE5 would inherit, Acceptance criteria, AE5-OPENING-ADR — the decisions AE5's first role increment is not allowed to pick off inside itself, Acceptance criteria, AE5-ROLE-CATALOG-COMPAT — the compatibility unit before AE5 increment 1 (+68 more)

### Community 1510 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.39
Nodes (6): hash_of(), mutate(), psql_q(), restore(), run_case(), cnv5-demotion-backstop-mutation-audit.sh script

### Community 1511 - "Phase CH — Committee Charters & Meeting Cadence — QA Review"
Cohesion: 0.06
Nodes (54): isAssignmentOverdue(), metadata, MyReferralAssignmentsPage(), formatCaseNumber(), formatDateTime(), referralStatusChipClass(), referralTypeChipClass(), ADR-0037 (+46 more)

### Community 1512 - "19. Status History and Audit"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 1513 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.12
Nodes (15): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, Challenge against the glossary, Cross-reference with code (+7 more)

### Community 1514 - "23. Encryption and Sensitive Data"
Cohesion: 0.15
Nodes (13): 2026-09-07 — backend: run 2 verified; the enumerations for the PO, Bookkeeping — DRAFTED, deliberately NOT APPLIED, Filed this session — the C2 sibling hazard, Gate for THIS commit — bare exit codes, nothing piped, Step 1 — the stack, ENUMERATED not counted (bare rc beside each), Step 2 — the merge, verified three ways, Step 3 — run 1 vs run 2, and the DRIFT ROWS are now real verdicts, Step 4 — the `(ALL)` flips (PO Q1): the final n is **ELEVEN** (+5 more)

### Community 1515 - "22. Retention, Deletion, and Legal Hold"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 1516 - "31. Performance Considerations"
Cohesion: 0.12
Nodes (14): ADR 0032 — Case Narratives (per-case prose interleaved with phases), Alternatives rejected, Consequences, Context, Decision, ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case), Alternatives rejected, Consequences (+6 more)

### Community 1517 - "error.tsx"
Cohesion: 0.17
Nodes (10): 0044 — Process-less cases ("Sem processo"), Consequences, Context, Decisions, Backend (`backend`), Frontend (`frontend`), Lead gate record (2026-06-29), Lead gate record UPDATE (2026-06-30) — gate closed (+2 more)

### Community 1518 - "hospital-departments.spec.ts"
Cohesion: 0.15
Nodes (13): 2026-09-07 — `backend`, BUILD turn. Harness built and proven; **STOPPED at the pre-launch checklist; the run was NOT launched**, Corrections to the facts filed at open (dated notes; the originals stand), Duration, derived rather than quoted (R7), Follow-ups filed this turn, Gate-relevant state at the stop, Not done, and why, Proofs — every exit code read BARE: never through a pipe, never consumed by a `;` chain, R14 — 9 vs 11 settled by test. **Delta 0.** (+5 more)

### Community 1519 - "error.tsx"
Cohesion: 0.17
Nodes (12): C-1 — Premise correction #1 is itself wrong: `public.set_primary_subject` EXISTS, C-2 — The mint door is in the `app` schema, so nothing can call it, Critical findings, M-3 — Four of the seven seeded roles remain unfillable after E4, M-4 — D5's exposure argument holds but omits one *new* inference, M-5 — Get-or-create race + a data-dependent unique index, Major finding, Medium findings (+4 more)

### Community 1520 - "useClientNow"
Cohesion: 0.24
Nodes (12): actionsSource(), codesCarryingDetail(), codesFromBlocks(), CONDITION_TO_SQLSTATE, detailCodes(), doorRpcNames(), extractRaisedCodes(), functionBlocks() (+4 more)

### Community 1521 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.29
Nodes (7): A7.1 — What A1.2 says, and what happened when it was built, A7.2 — The ruling: **two existing keys**, A7.3 — What the PO was told, because the shape changed, A7.4 — Pins that carry the ruling (the negatives, not the positive), A7.5 — Approval scope, Amendment 7 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build time**): bulk creation is a COMPOSITION, and §A1.2's one-arm sentence does not open it, Consequences

### Community 1522 - "0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle"
Cohesion: 0.29
Nodes (6): 0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text, Consequences, Context, Decision, Two errors the build made, both caught by controls, both worth keeping, Why the decodability test is the whole decision

### Community 1523 - "error.tsx"
Cohesion: 0.29
Nodes (6): 0146 — The E2E gate harness must not report green while blind, Alternatives rejected, Consequences, Context, Decision, The two false greens, measured

### Community 1524 - "32. Implementation Phases"
Cohesion: 0.19
Nodes (19): PhaseResultBadge(), timelineResultToResolved(), DAY_MONTH, DERIVED_PILL, durationSuffix(), formatEventDate(), formatFull(), formatShort() (+11 more)

### Community 1525 - "loading.tsx"
Cohesion: 0.33
Nodes (4): 0150 — The audit organization is derived from the hospital, and leg 5 means the platform chain, Consequences, Context, Decision

### Community 1526 - "loading.tsx"
Cohesion: 0.29
Nodes (6): 0159 — an invariant backstop runs as DEFINER; two correct decisions can compose into a break, Consequences, Context, Decision, ⭐ The shape, which is the durable part, Why no test caught it

### Community 1527 - "loading.tsx"
Cohesion: 0.15
Nodes (13): 1. Requirements — does each fix do exactly what was ruled, and no more?, 2. Security / RLS, 3. Tests — is `416` falsifiable, and is the classification honest?, 4. Code quality, 5. UX & a11y, 6. Hygiene, 7. ⭐ The edge found and deliberately not fixed — I agree with leaving it, 8. INFO (+5 more)

### Community 1528 - "Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail"
Cohesion: 0.29
Nodes (6): 0161 — The person-authority SQL twin: ADR 0133 D4's "no SQL twin" is retired, Alternatives rejected, Consequences, Decision, What D4 was right about, and what we owe because of it, Why the prohibition was right then and is wrong now

### Community 1529 - "27. Example: Simple Action Item"
Cohesion: 0.29
Nodes (7): 29.1 Do Not Store Everything in JSONB, 29.2 Do Not Store `overdue` Directly, 29.3 Do Not Delete Records Hardly by Default, 29.4 Use Database Functions for Critical Transitions, 29.5 Keep the UI Progressive, 29.6 Treat Action Items as Audit-Relevant Records, 29. Important Implementation Guidance

### Community 1530 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.29
Nodes (7): 3.1 Simple Action Items Must Stay Simple, 3.2 Complex Action Items Must Be Supported Without Rebuilding the Schema, 3.3 Auditability Is Mandatory, 3.4 `Overdue` Should Be Derived, Not Stored, 3.5 Current State and History Are Different Things, 3.6 Assignments Are Not the Same as Ownership, 3. Design Principles

### Community 1531 - "case-patient.md"
Cohesion: 0.29
Nodes (7): 5.2 `case_type_terminology`, Design Justification, Ethics Complaint Case Type, Example Rows, M&M Case Type, Purpose, Suggested Schema

### Community 1532 - "form-builder-enhancements.md"
Cohesion: 0.12
Nodes (16): 3.14 `forms.block_library_items`, 3.17 `forms.form_matrix_rows`, 3.18 `forms.form_matrix_columns`, 3. Form Definition Layer, Design Reasoning, Design Reasoning, Design Reasoning, Purpose (+8 more)

### Community 1533 - "layout-adjustments-2026-07.md"
Cohesion: 0.29
Nodes (7): 3.7 `forms.form_block_validations`, Design Reasoning, Example Config, Example Validation Types, Purpose, Relationships, Suggested Table

### Community 1534 - "supersede-document-button.tsx"
Cohesion: 0.17
Nodes (12): 1 · MAJOR-2(b), the picker scope limit — **NOT a blocker**, conditional on B-1, 2 · m2, the unaudited widened read path — **not a blocker; the P0 fix materially shrank it**, B-1 · MAJOR-2(a) is **NOT FIXED** — the error travels two hops further and is dropped at the third, B-2 · MAJOR-6's professional lane is uncovered, on a premise the catalog contradicts, B-3 · NEW — `src/lib/queries/cases.ts:1333` silently empties the **entire ETH·E4 roster**, Blocking items, P0-1 — **CLOSED.** Verified four ways, and the divergence detector works in both directions, pgTAP count — verified independently, and the flakiness has a cause (+4 more)

### Community 1535 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.29
Nodes (7): 4.2 `form_responses.form_answers`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 1536 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.29
Nodes (7): 20.1 `interview_finding_case_issues`, 20.2 `interview_finding_risks`, 20.3 `interview_finding_action_items`, 20.4 `interview_timeline_event_links`, 20.5 `interview_referral_links`, 20. Integration Tables, Design rationale

### Community 1537 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.29
Nodes (7): 35. Rejected Simplifications, Case permission automatically grants all Interview content, Every participant must be a user, Interview as a calendar event, One table containing the entire Interview, Store all content in a generic notes table, Store recordings in PostgreSQL

### Community 1538 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 5.1 `people`, 5.2 `person_professional_credentials`, 5. Shared Person Model, Design rationale, Recommended constraints, Suggested `person_type` values, User linkage

### Community 1539 - "0085 — Case Correction Lifecycle (phases + narratives)"
Cohesion: 0.29
Nodes (7): 15.1 Question-level policy, 15.2 Answer provenance, 15.3 `form_instance_initializations`, 15.4 Source selection algorithm, 15.5 Initialization must happen once, 15.6 Completion validation, 15. Safe carry-forward design

### Community 1540 - "5.2 `referral_context_versions`"
Cohesion: 0.29
Nodes (7): 28. Recommended service boundaries, `CarryForwardService`, `EvaluationCycleGenerationService`, `EvaluationFindingService`, `EvaluationMetricsService`, `EvaluationProgramService`, `EvaluationWorkflowService`

### Community 1541 - "4.12 `form_responses.form_submission_draft_snapshots`"
Cohesion: 0.29
Nodes (7): 8. Impact on ADR 0086 — six recommended amendments, A1 — FF-4: fix the `default_source` vocabulary's extensibility (highest value), A2 — FF-2: record that matrix axes are version-frozen, not data-driven, A3 — FF-3: keep the completeness predicate layer open to non-value predicates, A4 — FF-5: document the lane-addition recipe (keep ruling 5 as-is), A5 — ADR 0086 Consequences: name recurring evaluations as out of scope, A6 — Correct the stale ARCHITECTURE.md text before FF-1 starts

### Community 1542 - "5 · Over-reach audit (things wrongly marked for removal)"
Cohesion: 0.29
Nodes (7): 20.1 General setup, 20.2 Always target database roles, 20.3 Explicitly reject unauthenticated access, 20.4 Separate operation policies, 20.5 Use both `USING` and `WITH CHECK`, 20.6 Remember UPDATE also requires SELECT visibility, 20. RLS policy strategy

### Community 1543 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 43.1 File URLs in domain tables, 43.2 One giant attachments table, 43.3 Assuming case access equals document access, 43.4 Public buckets with obscure URLs, 43.5 Treating OCR as harmless, 43.6 Storing PHI in filenames or object paths, 43. Anti-Patterns to Avoid

### Community 1544 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.17
Nodes (11): completePhase(), createCase(), editAndResubmit(), insertChoiceOptions(), rpc(), signInAs(), signOut(), slug() (+3 more)

### Community 1545 - "ch-be3-mutation-audit.sh"
Cohesion: 0.29
Nodes (7): 5.1 Preserve `memberships`, 5.2 Replace/evolve `case_access` into `case_access_grants`, 5.3 NSP Investigations, 5.4 Meeting participation and linked Cases, 5.5 Attachment clearance, 5.6 Referral PHI Disclosure, 5. Target database model

### Community 1546 - "ADR 0009 — Local JWT verification for the auth gate & identity"
Cohesion: 0.17
Nodes (12): 0 · Why this document exists, 1 · Scope — what these doors erase, and what they do not, 2 · Preconditions, 3 · The procedure, 4 · When a door refuses, 5 · ⛔ The failure class this document was written after, 6 · Records to keep per run, PHI column-disposal procedure — the four erasure doors (+4 more)

### Community 1547 - "0010 — Denormalize email onto public.profiles"
Cohesion: 0.17
Nodes (12): 0. What step 0 changed about this plan, 1. PO rulings for this phase (2026-08-14), 1b. Rulings added 2026-08-14 after backend's catalog pass (findings 4 + 5), 1c. Corrections to §0 from backend's catalog pass — §0 was WRONG twice, 2. Slices, owners, file ownership, 3.1 Both write seams are in the census blind class, 3.2 The negative twin (plan step 3, sharpened by step 0), 3.3 Standing method rules for this phase (+4 more)

### Community 1548 - "3.8 `forms.form_block_default_values`"
Cohesion: 0.17
Nodes (11): Case surface split — the assertion-integrity group (2026-08-22), Coverage facts, not defects, Four corrections to the findings themselves, Gate figures (lead-run, fresh `supabase db reset`), The E2E / TS half, The 🔴 — `FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`, The pgTAP half, What changed (+3 more)

### Community 1549 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.03
Nodes (62): ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry, Alternatives rejected, Consequences, Context, Decision, 0070 — Interview data-model v2: sessions + reporting / confidentiality columns, Consequences, Context (+54 more)

### Community 1550 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.29
Nodes (7): 6 · THE AUTHORITATIVE M1 FIX SET, Explicitly NOT in M1, M1·1 — B7: respondent linkage (**lands first**), M1·2 — the exclusion-plane mutators (5 RPCs), M1·3 — ⛔ NEW · `case_participant_roles`, the 6th exclusion-plane table (D1), M1·4 — the DEFINER exclusion sweep: **35 RPCs, split by remediation shape**, M1·5 — A30: the **5** `platform_admin` arms (§1.6) — pending rulings 2 and 8.

### Community 1551 - "5.11 `referral_resolutions`"
Cohesion: 0.15
Nodes (13): Behavioural — my r1 probes, re-run, both tiers, ⛔ → ✅ BLOCKER-1 — CLOSED, Carried forward (unchanged from r1, none blocking), Correspondence, re-derived independently, Keystone non-vacuity — I neutralized two of the NEW §11 gates, M7's own new surface — nothing found, 🟠 → ✅ MAJOR-1 — CLOSED, and backend's narrowing of my set is CORRECT, 🟡 NEW MINOR-3 — PROGRESS.md's summary blocks contradict their own section body (+5 more)

### Community 1552 - "F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.29
Nodes (7): ADRs, Data-access & action modules, Deferred (carried as a follow-up, not gate-blocking), Migrations, Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail), Tests / Gate, What shipped

### Community 1553 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.29
Nodes (6): Follow-ups (non-blocking), Gate, Increments — each verified via git scope + LIVE catalog + `set local role` keystone, mutation-proven, Lessons (transferable), RV2 R2–R5 — Referrals v2 Governance (COMPLETE), SQLSTATEs (block `HC0A·`)

### Community 1554 - "use-title-action.ts"
Cohesion: 0.29
Nodes (6): Backend rows, Base-branch failure triage (2026-07-08, lead), E2E (scoped pass, NOT a formal gate), Frontend rows, UI/layout fixes batch + base-branch triage — 2026-07-08, UI/layout fixes batch (frontend + backend)

### Community 1555 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.17
Nodes (12): ADR 0187 — C2 closes on DISCLOSURE, its BLIND set is labelled by PROPERTY, and three of ADR 0184's recorded populations were mis-measured, Consequences, Considered options, Context, Corrections of record, D1 — Tier 2 is a DISCLOSURE obligation, not a closure blocker, D2 — the 15 BLIND doors with no authorization raise close via keystones carrying an EXPLICIT PROPERTY LABEL, D3 — `app.print_source_series` is ruled OUT of the BLIND set (+4 more)

### Community 1556 - "0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle"
Cohesion: 0.29
Nodes (7): 1.1 · §1.1 `lift_recusal` — ✅ **CONFIRMED** (verbatim), 1.2 · §1.2 exclusion gate missing from case RPCs — ✅ **CONFIRMED, but the counts are wrong and the fix set is under-scoped**, 1.3 · §1.3 `list_cases_board` fast-path — ✅ **CONFIRMED** (verbatim), 1 · Verification of the three NEW findings, Hunt for other fast-path RPCs — ✅ one more found, and it is invisible to Q7, The load-bearing negative — ✅ **CONFIRMED**, ⛔ The under-scope — this is the blocking item

### Community 1557 - "AUTHZ Write-Path Door-Blindness Audit — Findings"
Cohesion: 0.25
Nodes (7): AUTHZ Write-Path Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous), Note — 2026-09-03: THIS FILE COVERS 39 OF 107. The arm's domain was widened; no full sweep has run since. (33 predate the widening; **4** were merged from the AE4.9 D6 subset run 2026-09-02 and **2** more from the BUG-AE49-D6-REKEY-INCOMPLETE subset run 2026-09-03 — all COVERED, all marked snapshot:ABSENT, so no drift tripwire protects them.), Note — 2026-09-08: one row was RELOCATED BY HAND, and why the merge put it in the wrong table, Note — 2026-09-08: the merge's 45 CARRIED rows, dispositioned (PO ruling R30), Note — AE4.7c: four guards swept, and the SIX doors this arm still cannot see (2026-09-01)

### Community 1558 - "Phase 8 — Dashboards & Submissions Browser (archived task detail)"
Cohesion: 0.29
Nodes (7): 3 · NEW findings the inventory missed, ⛔ NEW-1 · **P0 — the exclusion model has THREE self-serving mutators, not one. The respondent arm has two, and one opens PHI. PROVEN LIVE.**, ⛔ NEW-2 · **P1 — the inventory's headline query (Q7) reproduces the exact blind spot A23 named**, ⛔ NEW-3 · **P2 — `case_interviews_insert` is missing from §1.4**, ⚠ NEW-4 · **P2 — `case_access` carries `authenticated` INSERT/UPDATE grants today**, Proof (transaction, `ROLLBACK`ed; persistence re-verified), ✅ Structural blind spots I checked and cleared (record, so nobody re-opens them)

### Community 1559 - "Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail"
Cohesion: 0.29
Nodes (7): 0 · Method, and what "verified" means below, 3 · MINOR, 5 · Comments on the already-known items (not re-filed), 6 · ⛔ COULD NOT VERIFY — this is a work list, not a caveat, 7 · What to change to reach APPROVED, 8 · Closing note, VERDICT (round 1): **CHANGES REQUESTED**

### Community 1560 - "image-item-editor.tsx"
Cohesion: 0.17
Nodes (12): ADR 0208 — Two conventions: the candidate fan-out `D` is a parametric structural invariant plus accepted operational risk, and `search_path = ''` is the sole forward convention for SECURITY DEFINER functions, Consequences, Considered options, Context, D1 — `D` is a parametric structural invariant plus accepted operational risk, D2 — The six-clause shape assertion, ordered to a named unit and built on the P2 instrument, D3 — Five mandatory re-measurement triggers, D4 — `search_path = ''` with schema-qualified references is the SOLE forward convention (+4 more)

### Community 1561 - "AuditEntityType"
Cohesion: 0.29
Nodes (7): 1 · Method, 3 · Blocking items, 4 · Non-blocking findings, 5 · Code review — `src/components/referrals/referral-dispose-dialog.tsx`, 6 · Could not verify — a work item, not coverage, 7 · Summary, DSR Slice 4 — QA review

### Community 1562 - "case-narratives.md"
Cohesion: 0.29
Nodes (6): DSR Slice 4 — QA review, round 3, r3 · 1 — Method and rollback, r3 · 2 — B3 · CLOSED, r3 · 5 — N7 · CLOSED, verified in the catalog rather than the migration, r3 · 6 — Also fixed since r2, verified, r3 · 7 — Summary

### Community 1563 - "form-builder-enhancements.md"
Cohesion: 0.17
Nodes (12): Batch 1 closures — unit DOOR-SWEEP-DERIVER (2026-09-05), ✅ FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN — the derived case list contains tokens no sweep arm can match, so the paste-able command produces an UNPROVEN run — **RESOLVED 2026-09-05**, ✅ FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN — a trigger guard has no call edge, so it is in 0 of the 171 and its door reads BLIND for the wrong cause (owner: lead + backend; filed 2026-09-04) — **RESOLVED 2026-09-07**, ✅ FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS — a read-arm COVERED on a `FOR ALL` policy can be earned by a write keystone (owner: backend; filed 2026-09-02) — **RESOLVED 2026-09-07**, ✅ FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE — a broad gate's neutralization aborts a pgTAP file, so the shape guard withholds a verdict the suite plainly had (owner: backend; filed 2026-08-24) — **RESOLVED 2026-09-07**, ✅ FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION — a `prosecdef` flip on an existing boolean gate derives ZERO cases and reads as clean (owner: backend/lead; filed 2026-08-26, found by `backend` while fixing BUG-D5-REHIRE-HOSPADMIN-001) — **RESOLVED 2026-09-05**, ✅ FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE — the deriver returns ZERO cases for a diff that added a gate, so the case list was hand-widened and reads as derived — **RESOLVED 2026-09-05**, ✅ FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE — a diff-scoped sweep for one increment silently selects another increment's cases (owner: backend/lead) — **RESOLVED 2026-09-05** (+4 more)

### Community 1564 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.15
Nodes (12): Actual behavior, Expected behavior, Fix, Impact, Investigation, Lesson, Regression protection, Related code (+4 more)

### Community 1565 - "layout-adjustments-2026-07.md"
Cohesion: 0.43
Nodes (3): parse_tap(), run_mutation(), p0137-phi-door-mutation-audit.sh script

### Community 1566 - "CustomFieldDef"
Cohesion: 0.53
Nodes (8): TimelineFeed(), PhaseBar(), anchor(), dayPart(), diffDaysUtc(), durationDays(), endDay(), statusOf()

### Community 1567 - "supersede-document-button.tsx"
Cohesion: 0.29
Nodes (7): ADR 0182 — The permission answer is computed once per STATEMENT, not once per protected row, Consequences, Context, Corrections after QA review (2026-09-03), Decision, The acceptance protocol is amended in the same change, Why the reuse is sound, and why it is not a cache

### Community 1568 - "rerender-memo-with-default-value.md"
Cohesion: 0.29
Nodes (7): 12.1 P1 — the count halved, and the surviving half is the half that was never the target, 12.2 ⚠ A claim in §§10.3 and 11.4 does not survive measurement, 12.3 A prediction recorded before the run, and wrong in its direction, 12.4 Where P5 now stands — a partial result, stated as one, 12.5 A stale snippet, found by running it, 12.6 P1 re-specified, and re-evaluated — PASS, with the control that makes that readable, 12. Run 5 (2026-09-02) — the first run against a FIXED `scope_reaches`. NOT MET, and the two halves of the residue are different

### Community 1569 - "rerender-move-effect-to-event.md"
Cohesion: 0.29
Nodes (7): 13.1 Why DC1 cannot survive unamended — measured, not predicted, 13.2 What is ruled instead, 13.3 The P5 precondition still binds, and gains a reading, 13.4 What this amendment does NOT do, 13.5 A re-aim that was written, measured, and killed — recorded rather than quietly replaced, 13.6 DC2 fell to the same trap, and §13 missed it — found by RUNNING, not by reading, 13. Amendment for the statement-scoped increment (2026-09-03) — ADR 0182

### Community 1570 - "rerender-no-inline-components.md"
Cohesion: 0.29
Nodes (7): Gates — exit codes captured directly, Increment A ✅ BUILT — ADR 0168 Amdt 1/2, the three doors, Increment A — lead-verified gate numbers (re-run independently, fresh reset), Rulings taken during the build, recorded because no gate would carry them, The shape that shipped, ⭐ The vacuity hunt — measured, not inspected, Two defects the run caught in the first draft — both from this repo's known families

### Community 1571 - "rerender-simple-expression-in-memo.md"
Cohesion: 0.29
Nodes (7): Increment F — the mechanical fixture sweep (35 files, +96/−171), ⚖ Increment F — the retirement audit. VERDICT: RETIRE NOTHING, RE-CUT ALL SIX, The headline: not one of the six is a pure differential suite, The plan, per file, ⛔⛔ The three findings that would have been silent losses, ✅ Two coverage losses the sweep declared — BOTH RESTORED (ruling taken, then acted on), ⭐ Two gates that stay GREEN while the drop breaks something

### Community 1572 - "rerender-split-combined-hooks.md"
Cohesion: 0.29
Nodes (7): AE4.8 detail rotated verbatim from PROGRESS.md § Now, 2026-09-02, AE4.8 — the app-side seam collapse, 2026-09-02 (lead session, after the PO batch), E2E narrative rotated verbatim from PROGRESS.md § Now, 2026-09-02, Gates at the end of AE4.8, Two plan predictions that did not survive measurement, What AE4.8 did NOT do, What shipped

### Community 1573 - "rerender-transitions.md"
Cohesion: 0.29
Nodes (7): AE4 PO batch — 2026-09-01 (lead session, after AE4.7c), D1 — `offboarded`: ruled by cells, rebuilt as a structural proof, D2 — the nine `unauthenticated` cells, deleted, D3 — 403 calls the door its class is named for, D4 — the two follow-ups, Gates at the end of the PO batch — fresh `supabase db reset --local`, What the PO batch did NOT do

### Community 1574 - "rerender-use-deferred-value.md"
Cohesion: 0.29
Nodes (7): R3.1 — B4 (register self-contradiction): FIXED, and the boundary holds — except one copy in the LIVE PLAN, R3.2 — B5 (rollback snapshot): both round-2 defects are genuinely fixed; the attack found one new leak path, R3.3 — B6 (ARCHITECTURE class list): FIXED, re-derived element-wise by me, R3.4 — The new FUP, and my own round-2 claim re-tested one grain deeper, R3.5 — Independently re-verified this round, Round 3 — re-review of the B4/B5/B6 fixes (2026-08-31, same reviewer), Round 3 verdict

### Community 1575 - "rerender-use-ref-transient-values.md"
Cohesion: 0.29
Nodes (7): R4.1 — B7: FIXED, and §4.1 survived the end-to-end operator read, R4.2 — B8: FIXED, and the tag form is ruled ACCEPTABLE, R4.3 — The two non-blocking items: one fully fixed, one HALF-fixed under a claim of "fixed", R4.4 — The calibration call, made in the open, R4.5 — Re-verified this round, and what remains open by nature, Round 4 — re-review of the B7/B8 fixes (2026-08-31, same reviewer), Round 4 verdict

### Community 1576 - "server-after-nonblocking.md"
Cohesion: 0.29
Nodes (7): 0. Why a new file, 1. Finding 1 (HIGH) — O(M²) shape, P2 blind to it, 2. Finding 2 (BLOCKER) — E2E/review gates missing, 3. Finding 3 (MEDIUM) — DEFINER `search_path`, 4. Finding 4 (LOW) — record contradictions, 5. A finding this review raised against the audit, and then withdrew, External audit response — AE4/IA-F9 statement-scoped permission path

### Community 1577 - "server-auth-actions.md"
Cohesion: 0.29
Nodes (7): 🔴 e2e:prod — the UNKNOWN is measured: NOT green as-run, Findings — ranked, QA review — 2026-09-01, independent session at `6da8a772`, QA review — Phase AE4: the authz catalog, and `staff_admin` substituted (ADR 0155 D7), Re-measurement — the handoff largely reproduces, Recommended order for the remainder of the phase, The difficulties, analysed

### Community 1578 - "server-cache-lru.md"
Cohesion: 0.25
Nodes (7): Backend half — build record, ↩ BUG-DSR-S3-004 and -005 bodies (the two SPEC defects), rotated 2026-08-20 — VERBATIM apart from the link repoint, ↩ BUG-DSR-S3-006 **and -007** bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint, DSR Slice 3 — build detail (rotated from PROGRESS.md § Now), ↩ Fixed-bug bodies, rotated from PROGRESS.md § Bug Log 2026-08-20 — VERBATIM apart from the link repoint, The gate-vocabulary framing for the affordance gap (2026-08-20), ↩ Two more fixed-bug bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint

### Community 1579 - "server-cache-react.md"
Cohesion: 0.17
Nodes (12): 0. Method, and one methodological correction I owe the reader, 1. What I MEASURED — the checks that passed, 2. Findings — MAJOR, 3. Findings — RECOMMENDED, 4. Could not verify — this is a work item, not a footnote, 5. To re-check after the in-flight `backend` commit lands, 6. Disposition for the PO, F-MAJOR-1 — Arm 4a is blind to a strand of `app.assert_patient_required_fields`, which is inside the swept 171 (comment-preceded raise) (+4 more)

### Community 1580 - "server-dedup-props.md"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 1581 - "server-parallel-fetching.md"
Cohesion: 0.33
Nodes (5): ADR 0002 — Admin claim via custom access token hook, Consequences, Context, Decision, Rationale

### Community 1582 - "server-parallel-nested-fetching.md"
Cohesion: 0.33
Nodes (5): ADR 0003 — pgTAP for database tests, Consequences, Context, Decision, Rationale

### Community 1583 - "server-serialization.md"
Cohesion: 0.33
Nodes (5): ADR 0007 — Middleware as a coarse auth gate; role landing in root `/`, Consequences, Context, Decision, Rationale

### Community 1584 - "_template.md"
Cohesion: 0.33
Nodes (5): ADR 0008 — GSAP as the animation dependency, Consequences, Context, Decision, Rationale

### Community 1585 - "13.1 `interview_statements`"
Cohesion: 0.33
Nodes (5): 0011 — Position reorder via deferrable constraints + SQL swap RPCs, Consequences, Context, Decision, Options considered

### Community 1586 - "error.tsx"
Cohesion: 0.33
Nodes (5): 0013 — Fix form_versions INSERT RLS self-reference, Consequences, Context, Decision, Options considered

### Community 1587 - "error.tsx"
Cohesion: 0.25
Nodes (8): 12.1 🟠 R2-1 — MUST FIX BEFORE MERGE. The gate record is one increment behind the branch, in all three places it appears, and the true figures exist nowhere in the repo, 12.2 🟡 R2-2 — `backend-state.md`'s migration registry is now wrong by two, and the section still omits two of the round's four migrations, 12.3 🟡 R2-3 — suite `355` is recorded in no durable document, 12.4 🟡 R2-4 — `355` t6's comment asserts more than its SQL checks, 12.5 🟡 R2-5 — `ADR 0129:300` still records vitest **1512/1512**, 12.6 🟡 R2-6 — the `| tail` masking has now fired twice in ~24 hours, and the response is a third prose record, 12.7 🟡 R2-7 — one dangling reference to the deleted dialog still reads as present tense, 12 · Round-2 findings

### Community 1590 - "w4-technical-director-referrals-audit.sh"
Cohesion: 0.38
Nodes (10): arm_inflight(), disarm_inflight(), fail_abort(), neutralize(), psql_c(), psql_f(), residue_setvalued(), restore_inflight() (+2 more)

### Community 1591 - "20. Reminder Rules"
Cohesion: 0.18
Nodes (8): Carried forward, unchanged, non-blocking, MINOR-1 — CLOSED, NEW-1 (INFO, not DM3's) — two specs flaked in BOTH independent full-gate runs, r2 gate figures — what I re-ran vs accepted, Recommendation to the lead, Round 2 — 2026-08-13 · after M11 (`5b35003`), The scope decision I was asked to challenge — the diff-scoped sweep was correctly NOT re-run, VERDICT: **APPROVED**

### Community 1592 - "supersede-document-button.tsx"
Cohesion: 0.18
Nodes (11): Exit criteria — r2, Gate-figure impact (for the lead's step-5 record), How I verified — execution, not reading, MAJOR-1 / MAJOR-2 / MAJOR-3, ✅ N14a's must-stay-green mechanism **discriminates** — proven both ways, New at r2 (both MINOR, both non-blocking), r1 MINOR / INFO — status at r2, Recommendations (none binding) (+3 more)

### Community 1593 - "access-audit-table.tsx"
Cohesion: 0.18
Nodes (11): 1. Requirements (ADR 0043 acceptance bullets), 2. Architecture Rule 3 — zero evaluator drift, 3. RLS / Security, 4. Code quality, 5. Test coverage adequacy, 6. Open risk (non-blocking), 7. Informational observations (not blocking), Audit findings (+3 more)

### Community 1594 - "5.11 `referral_resolutions`"
Cohesion: 0.18
Nodes (11): Backend State — meetings, charters and accreditation, CH — Committee Charters & Cadence (S4, 2026-07-20; ADR 0080; migrations `20260818000000`–`…000200`; flag `charters` seed-ON / prod-OFF) → `main`, Current state, Extracted from the pre-split stamp chain, Invariants, MIN — Meeting audio → generated ata (2026-08-06; ADR 0099 + Amendment 1; migrations `20260910000100`–`…000400`; flag `audio_minutes` **OFF** — seed forces ON for local/E2E), Open edges, P16 — Standards Crosswalk & Readiness/Gap Engine v2 (2026-08-04; ADR 0093 + Amendments 1-3; migrations `20260903000800`-`...001600` + gate-flip `20260904000100`; flag `accreditation` **ON** via `...000100`) (+3 more)

### Community 1595 - "FF-3 — Validation Engine (`item_validations`) · COMPLETE 2026-07-28"
Cohesion: 0.33
Nodes (6): A4.1 — The ruling, A4.2 — Why (measured 2026-08-22 from the live catalog; full detail in the follow-up), A4.3 — Binding on M2 (the migration may not be written without these), A4.4 — Approval scope, Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings, Consequences

### Community 1596 - "Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)"
Cohesion: 0.33
Nodes (6): A5.1 — The measurement that forced the question, A5.2 — The ruling, A5.3 — What this does and does not disturb, A5.4 — Approval scope, Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked, Consequences

### Community 1597 - "verify-tv-backfill.sh"
Cohesion: 0.33
Nodes (6): A6.1 — What was measured (live catalog, twice, independently), A6.2 — Why using `member_can` as written would have been a defect, not a shortcut, A6.3 — The ruling: one implementation, not two, A6.4 — Binding conditions (the migration may not be written without these), Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks, Consequences

### Community 1598 - "loading.tsx"
Cohesion: 0.10
Nodes (21): A. Two corrections that land on ADR 0155 itself, AE0 — findings and PO decision list, AE1 inputs, already measured, Also recorded: the two published counts are both honest, B. A scope finding that resizes AE1, C. Hardening item found in passing, D. A record corrected during AE0 (done, no decision needed), E. Plan deviation taken, stated (+13 more)

### Community 1599 - "page.tsx"
Cohesion: 0.33
Nodes (6): ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases, Alternatives rejected, Consequences, Context, Decision, Obligations (each blocks the increment that ships it)

### Community 1600 - "validation-rules-editor.tsx"
Cohesion: 0.20
Nodes (10): 1 · Complete DB-side PHI disposal in every graph, 2 · `dispose_meeting_minutes(meeting, reason)` — new, standalone, per-meeting, 3 · §6.4 leak, 4 · Storage retained — the NARROWED claim (the load-bearing decision), ADR 0056 — PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained), Amendment 1 — the meeting door's redaction set widens to its composition closure, Amendment 2 — the widening property is NARROWED to designated PHI fields, and stops here, Consequences (+2 more)

### Community 1601 - "ARCHITECTURE.md — Hospital Commission Forms Platform"
Cohesion: 0.18
Nodes (10): A.1 Migrations (7, sequenced after the highest registered version at build time; was `20260910000400` on 2026-08-06), A.2 Threading surface (the "new arm must inherit every sibling" list), A.3 Frontend (~16–18 files; precedent: the NSP console), A.4 Seed (`supabase/seed.sql`), A.5 Verification (Phase Gate §6), Phase A — classification + `quality_reviewer` + UI (pilot-blocking), Phase B — org_admin content wall (before pilot data accumulates), Phase C — lifecycle + break-glass (before commercial sale) (+2 more)

### Community 1602 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.33
Nodes (6): 18. Custom Fields, Example Field Value, Example Select Field Config, Field Definition Table, Field Value Table, Responsibility

### Community 1603 - "0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle"
Cohesion: 0.33
Nodes (6): 7. Status Model, Example Mapping, Normalized Status Categories, Responsibility, Suggested Schema, Why Not Use a Fixed Enum?

### Community 1604 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.33
Nodes (6): 10.1 `case_timeline_events`, Design Justification, Example Ethics Timeline Events, Example M&M Timeline Events, Purpose, Suggested Schema

### Community 1605 - "5. Table Definitions"
Cohesion: 0.33
Nodes (6): 12.1 `case_decisions`, Design Justification, Example Ethics Decision Types, Example M&M Decision Types, Purpose, Suggested Schema

### Community 1606 - "page.tsx"
Cohesion: 0.07
Nodes (28): describedText(), node(), allFiles, analyse(), callSites, census, censusOf(), DOOR (+20 more)

### Community 1607 - "28. Example: Complex Action Item"
Cohesion: 0.25
Nodes (8): Focus item 1 — the D5 keystone **is** falsifiable (I proved it myself), Focus item 2 — `set_primary_subject`: surgical deltas only, properties intact, Focus item 3 — the neutralization oracle **is** sufficient for all three write doors, Focus item 4 — FUP-ETH-CPF-1's latency claim is **correct**, independently verified, Focus item 5 — the three E2E-only defects, Other rules, Requirements coverage — all 8 E2E acceptance items COVERED, Verified CLEAN — stated explicitly

### Community 1609 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 19.2 Ethics Complaint Against Doctor, Allegations, Base Case, Extension Details, Forms, Participants

### Community 1610 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 21.1 Avoid unsafe polymorphic foreign keys, 21.2 Use soft deletes for sensitive entities, 21.3 Use `jsonb` only for metadata, not core relational concepts, 21.4 Use indexes aggressively on access and case navigation, 21.5 Consider rank-based access levels, 21. Supabase / PostgreSQL Implementation Notes

### Community 1611 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 2.1 A case is a committee matter, not necessarily a patient case, 2.2 Participants are attached to cases through roles, 2.3 Committee-specific depth belongs in extension tables, 2.4 The form engine should remain shared, 2.5 Permissions must be case-type aware, 2. Core Design Principles

### Community 1612 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.33
Nodes (6): 5.5 `case_workflow_stages`, Design Justification, Example Ethics Stages, Example M&M Stages, Purpose, Suggested Schema

### Community 1613 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 6.4 `case_participant_roles`, Design Justification, Example Ethics Roles, Example M&M Roles, Purpose, Suggested Schema

### Community 1614 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 9.1 `case_documents`, Design Justification, Example Ethics Document Types, Example M&M Document Types, Purpose, Suggested Schema

### Community 1615 - "28. Example: Complex Action Item"
Cohesion: 0.33
Nodes (6): 9. Team sequencing and file ownership, Backend owner, Frontend owner, QA reviewer, Serialization constraints, Tester

### Community 1616 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 14. Command interfaces, Allegations, Case configuration and access, Decisions and votes, Notices and hearings, Participants and respondent submission

### Community 1618 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.12
Nodes (26): affiliatePerson(), AffiliatePersonInput, endAffiliation(), endOrgAffiliation(), lookupOrgPeople(), MESSAGES, PgErrorish, revalidateAffiliationSurfaces() (+18 more)

### Community 1620 - "F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE"
Cohesion: 0.33
Nodes (6): 17. State invariants, Allegation, Case, Decision, Meeting, Notice

### Community 1621 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.33
Nodes (6): 3.10 `forms.form_logic_conditions`, Design Reasoning, Purpose, Relationships, Suggested Table, Supported Operators

### Community 1622 - "ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target"
Cohesion: 0.33
Nodes (6): 3.11 `forms.form_logic_actions`, Design Reasoning, Purpose, Relationships, Suggested Table, Supported Actions

### Community 1623 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.33
Nodes (6): 3.12 `forms.form_calculations`, Design Reasoning, Example Expression, Purpose, Relationships, Suggested Table

### Community 1624 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.33
Nodes (6): 3.13 `forms.form_translations`, Design Reasoning, Implementation Note, Purpose, Relationships, Suggested Table

### Community 1625 - "16.1 `interview_documents`"
Cohesion: 0.18
Nodes (11): 2026-09-05 — backend: QA fix loop, iteration 1 of ≤5, F-BLOCK-1 — the merge helper destroyed hand-authored material and could not see it, F-MAJOR-1 — the `SCOPE:` line could not distinguish catalog from provisional, F-MAJOR-2 — the `SCOPE:` line was missing on both exit-1 paths and every exit-2 path, F-MAJOR-3 — a bare schema prefix ended the declaration silently, F-MAJOR-4 — nothing tested the merge helper; `MERGE_FAULT` was ungated, F-MAJOR-5 — a merge abort did not reach the exit code, F-MAJOR-6 / F-REC-1 / F-REC-6 — the numbers (+3 more)

### Community 1626 - "MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record"
Cohesion: 0.33
Nodes (6): 3.1 `forms.form_templates`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 1627 - "5 · Over-reach audit (things wrongly marked for removal)"
Cohesion: 0.33
Nodes (6): 3.6 `forms.form_block_options`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table

### Community 1628 - "20. Reminder Rules"
Cohesion: 0.18
Nodes (11): 2026-09-10 — analysis, grilling, ADR, and the two pre-pilot fixes opened (lead), 2026-09-10 — documentation second pass (lead): the corpus made to say what ADR 0205 decided, 2026-09-10 — Record step (lead): PO approved; hub → `complete`; origin current, Blockers, Current state, Done since start, GRANT-PLANE-CONVENTION — progress record, In progress (+3 more)

### Community 1629 - "readiness-chart-loader.tsx"
Cohesion: 0.33
Nodes (6): 5.1 `case_referrals`, Columns, Design rationale, Important constraints, Recommended priority values, Recommended status values

### Community 1630 - "deleteAdHocPhase"
Cohesion: 0.33
Nodes (6): 5.3 `referral_participants`, Columns, Constraints, Design rationale, Suggested access levels, Suggested participant roles

### Community 1631 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 5.5 `referral_messages`, Columns, Constraints, Design rationale, Sequence assignment, Suggested message types

### Community 1632 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 5.7 `referral_document_links`, Columns, Design rationale, Permission requirement, Suggested access modes, Suggested audiences

### Community 1633 - "loading.tsx"
Cohesion: 0.08
Nodes (24): ADR 0155 — Post-AFF4 tenancy and person-model evolution: a staged sequence, not a redesign, Consequences, Context, D0 — Ordering rule: AFF4 first — ✅ DISCHARGED 2026-08-26, D10 — NEW: the pre-pilot cutline and the queue (G1, G10), D1 — Finish AFF4, release the held DatePicker branch — ✅ DISCHARGED 2026-08-26, D2 — Harvest AFF4's rulings as design input, in writing, D3 — Name the affiliation ≠ authorization split in ARCHITECTURE.md (+16 more)

### Community 1634 - "loading.tsx"
Cohesion: 0.33
Nodes (8): ensureSentDtReferral(), purge(), readReferralsFlag(), setReferralsFlag(), sql(), ADR-0094, ADR-0106, ADR-0137

### Community 1635 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 12.1 `interview_transcripts`, 12.2 `interview_transcript_segments`, 12. Transcripts and Recordings, Search implications, Speaker validation, Transcript storage strategy

### Community 1636 - "loading.tsx"
Cohesion: 0.17
Nodes (12): Blocking findings, Discharge conditions for APPROVED, DM4 — Wave C: referrals · QA review (gate step 3), Exit criteria (plan §4), individually, Follow-ups filed this phase, INFO, 🔴 MAJOR-1 — `16/16 RED-PROVEN` does not reproduce at HEAD: N10b's mutation is a silent no-op *(blocking)*, 🔴 MAJOR-2 — the retired positive twin lost its can-fail proof, and the disposition comment claims coverage that does not exist *(blocking)* (+4 more)

### Community 1637 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 2.1 Support any committee type, 2.2 Support registered and unregistered participants, 2.3 Preserve evidentiary integrity, 2.4 Enforce strict confidentiality, 2.5 Integrate with existing platform modules, 2. Architectural Goals

### Community 1638 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 2026-09-04 — backend: plan + build, Build — commits, and every proof-of-fire with the exit code and message observed, Deviations from the approved plan, F1 (blocking) — the `DEGEN` arm as `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`, F2 (blocking) — the exit-status half of close condition 1 is **also vacuous** without a second change, F3 (scope) — the trap-path restore is a **class** defect, not a C2 one, F4 (found in passing) — `SUITE=` narrows the suite but **not** the report target, Gate — every exit code read BARE, on the line after the command, never through a pipe (+3 more)

### Community 1639 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 2026-09-04 — backend: QA fix loop, iteration 1, Deviations from the lead's disposition, F-MAJOR-1 — arm 4a was blind to one of the 439 strandable functions, F-MAJOR-2 — `RESET_EVERY` fired 8 destructive resets on a `SUITE=` subset, F-MAJOR-3 — `BASE_S_OVERRIDE` was ungated production surface, F-MAJOR-4 + F-REC-4 — disclosures and the new follow-up, F-REC-1 — both preflight arms failed OPEN, F-REC-2 — the `Tests=` figure settled by measurement (+3 more)

### Community 1640 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 9.1 `interview_topics`, 9.2 `interview_form_assignments`, 9. Interview Preparation, Design rationale, Design rationale, Recommended constraints

### Community 1641 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 30. Implementation phases, Phase 1: foundational operational model, Phase 2: generation and bed-matrix workflow, Phase 3: longitudinal carry-forward, Phase 4: findings and escalation, Phase 5: advanced surveillance and integration

### Community 1642 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 6.1 `hospital_departments`, 6.2 `hospital_units`, 6.3 `hospital_rooms`, 6.4 `hospital_beds`, 6.5 Rationale, 6. Hospital location and bed registry

### Community 1643 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 15.1 Aggregate analytics, 15.2 Case summary access, 15.3 Full quality oversight, 15.4 Domain restrictions, 15.5 Confidentiality policy, 15. Quality and patient-safety access model

### Community 1644 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 37. Multi-hospital administration edge cases, Case A: User belongs to Hospitals A and B, Case B: Hospital A suspends user, Case C: Organization suspends user, Case D: Quality manager is assigned only to Hospitals A and C, Case E: Quality manager has patient-safety domains only

### Community 1645 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 2026-09-05 — unit opened (lead), 2026-09-07 — backend: QA re-review residuals folded (docs), 2026-09-07 — lead: the four arms re-read at the tip by someone other than the builder (QA could-not-verify #1), 2026-09-07 — Record step (lead): PO approved at `2a779bd8`; unit closed and merged, F-REC-9 — the closure, and its rotation witness, Gate — bare, nothing piped, Hub `## Current state` at closure — cut from the hub 2026-09-07 (ADR 0186 D8), N1–N7 (+3 more)

### Community 1646 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 42.1 Require reasons for privileged actions, 42.2 Time-limit exceptional access, 42.3 Periodic access review, 42.4 Separation of duties, 42.5 Emergency lockout, 42. Operational recommendations

### Community 1647 - "loading.tsx"
Cohesion: 0.04
Nodes (47): 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 (detail for the live row), 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 **RE-GATE** after the QA fixes, 2026-08-21 — CASE SURFACE SPLIT · Increment 1 · §6 steps 1+2 re-run CLEAN at `e7ec7529`, 2026-08-21 — DSR operational remediation, the two gate rows' detail, §6 step 1 — verified by the lead, not taken from teammate reports, §6 step 2 — the full `npm run e2e:prod` (19 batches, prod-standalone, fresh server + fresh `db reset` per batch), Archive — Test Run Summary (full history, Phases 0 → QO·A), ⛔ CORRECTION 2026-08-21 — the Increment-1 RE-GATE row's "lint(8) 0" was FALSE and is withdrawn (+39 more)

### Community 1648 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 8.1 Organization memberships, 8.2 Hospital memberships, 8.3 Enforce hospital/organization consistency, 8.4 Committees, 8.5 Committee memberships, 8. Membership tables

### Community 1649 - "loading.tsx"
Cohesion: 0.33
Nodes (6): 34.1 Input sources, 34.2 Output, 34.3 Expiration, 34.4 Suggested pseudo-code, 34.5 Events that should trigger recomputation, 34. Permission Resolution Algorithm

### Community 1650 - "loading.tsx"
Cohesion: 0.09
Nodes (18): ActiveFilters(), BUILTIN_VIEWS, ChipBar(), DEFAULT_F, DropChip(), FilterPanel(), inPeriod(), matchRow() (+10 more)

### Community 1651 - "S4·CH — Committee Charters & Meeting Cadence (Phase 21) — complete"
Cohesion: 0.33
Nodes (6): 2.1 Organization User, 2.2 Hospital NSP Coordinator, 2.3 Hospital NSP Member, 2.4 Committee Coordinator, 2.5 Committee Member, 2. Canonical user categories

### Community 1652 - "FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)"
Cohesion: 0.03
Nodes (104): metadata, ADR-0061, PhaseAnswersReadonly(), ADR-0087, ADR-0091, DetailBlock(), formatDateTime(), SectionBody() (+96 more)

### Community 1653 - "1 · Verification of the three NEW findings"
Cohesion: 0.33
Nodes (6): 1. `assume_role`'s audit row — scoped to the assumed role's own tenancy, 2. Confirming the prediction, not assuming it — what else was in the platform bucket, 3. The referral / indicator single-hat reachability question, 4. Gate, `assume_role` audit scope + the referral/indicator reachability question (backend, 2026-08-10), Commits (this section)

### Community 1654 - "loading.tsx"
Cohesion: 0.20
Nodes (10): 1. The storage unit for one Grant with several abilities is undefined, 2. Receiving-side Referral grants conflict with the registry used for tenancy and auditing, 3. Child narrowing is not sufficiently typed or parent-bound, 4. D6's grant-door invariants do not match the Case reference implementation, 5. The tenancy-admin fallback lacks a reusable management interface, Additional concerns, Final assessment, Major findings (+2 more)

### Community 1655 - "loading.tsx"
Cohesion: 0.33
Nodes (6): Commit, Derivation — catalog vs. enum reconciliation, Finding — the enum will NOT surface in `database.ts` via `gen:types`, Gate results (fresh `supabase db reset --local`), Scope discipline held, Stage 0 — `app.platform_role` enum (backend, 2026-08-09)

### Community 1656 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-11 — AC-1…AC-6 built red-first; the four verdicts MEASURED; one unenumerated control found (backend), 2026-09-11 — `e2e:prod` GREEN at `3cb82f1b`; QA r2 APPROVED; the unit is gated, awaiting human approval (lead), 2026-09-11 — gate block (backend), 2026-09-11 — PO approval; Record step (lead), 2026-09-11 — QA round 1 addressed: 2 MAJOR, 4 MINOR, 1 NOTE (backend), 2026-09-11 — unit opened; the ordering ruled; the subject measured from the catalog (lead), 2026-09-12 — follow-up closure (2): the profiles-guard retirement candidate ruled KEPT, and my own earlier claim corrected (lead), 2026-09-12 — follow-up closure: the PO ruled the `.claude/rules/` cap, exit (c) final (lead) (+1 more)

### Community 1657 - "loading.tsx"
Cohesion: 0.20
Nodes (10): M1 — the new anon-residue follow-up's "derived" sweep misses a site of its own class, and its closing clause is a **false universal negative**: `docs/design/authz-evolution-census-ae0.md` carries the same figure under the same predicate over the same population, four times, including an operational instruction, M2 — the hub's `## Current state` says *"the gate is re-owed at the final tip"*; the FINAL 14-command tip gate has been run, and the summary does not mention it, M3 — the hub's `### In progress` still reads *"Fix-loop iteration 1 of ≤5"* at a tip four iterations later, and the re-review's request for it was dropped with no record saying so, M4 — the lead's iteration-4 commit `316c5367` carries **no session-log entry and no gate run**, and the tip gate's findings 2, 3 and 5 are recorded nowhere as discharged, MAJOR, MINOR / NOTED, PRIVILEGE-SURFACE (pre-AE5 Batch 7) — QA RE-REVIEW 2, final, Record-step worklist, in order (+2 more)

### Community 1658 - "V-6 Â· What M1 must cover â€” the authoritative fix set"
Cohesion: 0.25
Nodes (8): 8.1 R1 (BLOCKER) — the interview family has eight tables; M10 cut seven, 8.2 R2 (MAJOR) — the load-bearing invariant is prose, not a keystone, 8.3 The three specific asks, 8.4 Round 1: closed, and how, 8.5 What I could not check this round, 8.6 Re-review scope for r3, 8. ROUND 2 — re-review of the M10 remediation, VERDICT: ⛔ CHANGES REQUESTED

### Community 1659 - "loading.tsx"
Cohesion: 0.18
Nodes (11): B1 — the escalation covers four of the five combination cells the previous report tabulated; the **multi-line** row is still a rendering complaint, and the new comment at `scripts/check-supabase-config-schemas.mjs:372-376` claims it is not, B2 — `237 of 467` has a **fifth** home, and it is the follow-up this unit CLOSES on: `docs/followups/FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md:32` and `:50`, BLOCKING, Fix list, in order, M1 — the census-arm note added for N3 restates the **superseded** three-condition framing, and cites as its authority the ADR that dropped it in the same fix loop, M2 — the fix-loop tip `834e55d8` has **no session-log entry** and **no gate run recorded anywhere**; the hub's *"Gate at the tip"* paragraph describes a superseded tip, MAJOR, MINOR / NOTED (+3 more)

### Community 1660 - "loading.tsx"
Cohesion: 0.33
Nodes (5): 🛑 DM5 gate step 4 — the seven PO decisions: ✅ **ALL ANSWERED 2026-08-18** (docket discharged), DM follow-up triage — 2026-08-18 (session narrative, rotated), PROGRESS.md § State as it stood at rotation (2026-08-18), 🛑 START HERE — **DM5's seven decisions are ANSWERED; a DM FOLLOW-UP TRIAGE then ruled eight more and shipped four. Both blocks below are live.**, ⛔⛔ State — re-measured **2026-08-18**. This block has now gone stale THREE times; measure, never quote.

### Community 1661 - "W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**"
Cohesion: 0.17
Nodes (11): AcreditacaoPage(), metadata, ADR-0093, metadata, OrgAccreditationPage(), CloneFrameworkDialogTrigger(), FrameworkList(), ADR-0093 (+3 more)

### Community 1662 - "sup-supersession.spec.ts"
Cohesion: 0.20
Nodes (10): 1. The core difference in one paragraph, 2. Feature-by-feature comparison, 3. ESSENTIAL — adopt now (closes the tested back-and-forth gap), 4. DEFER — valuable, sequence after the dialogue loop, 5. AVOID — do not adopt as specified, 6. Protect these when adopting (what the external model lacks — don't regress), 7. Adoption constraints (non-negotiable) + next step, E1. A shared message thread (`referral_messages`) (+2 more)

### Community 1663 - "loading.tsx"
Cohesion: 0.25
Nodes (7): Acceptance criteria (hub) — measured, Could not verify, DOCS-CONSOLIDATION — QA review, Findings, Judgment calls, Question 1 — does every cut leave one canonical home?, Question 2 — can every new check red on a live subject?

### Community 1664 - "loading.tsx"
Cohesion: 0.40
Nodes (10): fail(), fp(), pin_failures(), psql(), psqlt(), restore_proven(), run_suite(), run_suite_log() (+2 more)

### Community 1665 - "loading.tsx"
Cohesion: 0.50
Nodes (3): FACES, ADR-0104, root

### Community 1667 - "3. Current authorization model"
Cohesion: 0.20
Nodes (10): 1.1 Tables, 1.2 The name collision — verified, and the single largest hazard in DM3, 1.3 Every routine on the surface (66 total, all `search_path`-pinned), 1.4 RLS policies (verified — SELECT-only everywhere; mutations are command-only), 1.5 Storage — 12 buckets, all private; 13 `storage.objects` policies, 1.6 Triggers, constraints, and the three barriers to a new resource type, 1.7 Inbound FKs (derived from `pg_constraint`, both directions — never by name), 1.8 ACLs (+2 more)

### Community 1668 - "9. Team sequencing and file ownership"
Cohesion: 0.33
Nodes (6): Filed, not fixed, Gate, ⛔ Step 2 is DEFERRED, not discharged, User-profile redesign + AFF3 / AUD1 / AUD2 — task record, What shipped, What this batch is actually worth remembering for

### Community 1669 - "5.4 `referral_assignments`"
Cohesion: 0.39
Nodes (5): AvatarStack(), Avatar(), AvatarFallback(), AvatarImage(), TimelinePerson

### Community 1670 - "37. Multi-hospital administration edge cases"
Cohesion: 0.20
Nodes (10): B1 — verified fixed, and the proof is the part that matters, M1 — verified built; the blunter predicate is accepted, and is better than what O3 wrote, M2 — accepted, MINOR / INFO batch, New observations from the delta (none blocking), Regression check, Round-1 findings — disposition, Round 2 — re-review of the remediation delta (+2 more)

### Community 1671 - "42. Operational recommendations"
Cohesion: 0.20
Nodes (9): 1. Inherit, never re-derive, 2. Facts from the environment, never from memory, 3. Cut the steps, then one quiz round, 4. Write `docs/plans/<slug>.md`, 5. Open the hub, 6. Stop, Process, To Plan (+1 more)

### Community 1672 - "8. Membership tables"
Cohesion: 0.33
Nodes (6): 3.1 · Is the column set complete? — ⭐ **YES. Re-derived from the catalog; exact match.**, 3.2 · The guard change — **bounded, and the amendment's reasoning is sound, not circular**, 3.3 · The transcript purge — **correct, and no other column carries transcript-derived text**, 3.4 · pgTAP 351 — the fixture IS locked; ⛔ **a second vacuous pin exists (t25)**, 3.5 · The `ARM=census` / `ARM=wrapper` vacuity premise — **right in substance, over-stated in the record**, r2 · 3 — Part 2: attacking the widening

### Community 1673 - "Lead notes"
Cohesion: 0.12
Nodes (17): 0.1 The erasure doors abort, and the filed record undercounts them, 0.2 A mandatory human gate stands in front of a residue class the program proved absent, 0. Why the round exists — the two live defects, measured, 1. PO decisions taken 2026-08-20 (binding; do not re-open), 2. Workstreams, 3. Constraints any change must respect (binding, carried forward), 3b. ⛔ The deployment fact that made every other item moot — ✅ DECIDED, and the decision is recorded HERE, 4. Explicitly NOT in this round (+9 more)

### Community 1674 - "PCI + Process-Template Versioning — phase detail (archived)"
Cohesion: 0.20
Nodes (10): Backend State — privacy, LGPD and subject requests, Current state, DSR operational remediation — the doors actually erase (2026-08-21; ADR **0129 Amdt 3 + 3a** + **0130 Amdt 5** + **0131 Amdt 4 + 5**; migrations `20261003000000`–`…000300`, **four**; pgTAP `353` `plan(60)` + `354` + **`355` `plan(6)`**; flag **`dsr` FLIPPED ON**), DSR Slice 2 — LGPD subject requests (2026-08-20; ADR **0130** Accepted + **Amendment 2**; migrations `20261001000000`–`…000200`, **3**; pgTAP `349` `plan(53)`; E2E `dsr-subject-requests.spec.ts`; flag **`dsr` OFF** — seed forces ON local/E2E), DSR Slice 3 — adjudication + the attested tier (2026-08-20; ADR **0130** + **Amendment 3**; migrations `20261002000000`–`…000100`, **2**; pgTAP `350` `plan(56)`; flag **`dsr`**), Invariants, Open edges, Rollout (+2 more)

### Community 1675 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.20
Nodes (10): 1. `CASES` is read for SET-NESS, not for value — three states, never two, 2. `RESET_EVERY` is PORTED, and the door's design is explicitly NOT portable as-is, 3. ⭐ Ownership is a PROXY, not the property — the escalation is REMOVED and its predicate kept as a DETECTOR, 4. The recovery step Part 4 owes — concrete, in the operator's line of sight, ADR 0192 — Ownership is a PROXY, not the property: the write arm keeps one connection role and gains a detector, a set-ness-correct `CASES`, a `RESET_EVERY` port that is not a copy of the door's, and the recovery step Part 4 owes, Consequences, Considered options, Context (+2 more)

### Community 1676 - "11. Scoped role-assignment tables"
Cohesion: 0.47
Nodes (3): check(), check_has(), test-netstat-listener-pids.sh script

### Community 1677 - "35. Administrative UX workflows"
Cohesion: 0.33
Nodes (5): Acessos (senha de todos: `Demo1234!`), Como aplicar, O que a demonstração cobre, Observações, Seed de demonstração — Comissão de Revisão de Prontuário

### Community 1678 - "39. Testing strategy"
Cohesion: 0.67
Nodes (4): run_case(), run_m2(), run_m3(), m1-mutation-audit.sh script

### Community 1679 - "3. Authorization strategy"
Cohesion: 0.07
Nodes (24): Measure, every time. Never re-read a recorded figure., Some facts may only be MEASURED here, never quoted, Non-obvious parts, Push SCHEMA before CODE — `db push` first, DEPLOY second, Why it is load-bearing, ADR 0139 — Quarterly home for concluded § Now rotations, ADR 0140 — Tracking-apparatus hardening batch (labels, caps, residue, cadence, sweep), ADR Index (+16 more)

### Community 1680 - "41. Existing-data migration"
Cohesion: 0.33
Nodes (6): Archived 2026-08-14 (DM5 resume audit) — the five DM4+DM5 bug records, 🟠 BUG-DM4-DUP-1 — the reply-attachment list renders the just-uploaded file TWICE (owner: `frontend`), 🟢 BUG-DM5-CAPA-1 — ✅ **FIXED 2026-08-14** (`e938f36d`, DM5 S2 `…000140`) — CAPA evidence UPLOAD was broken for every user since it shipped (owner: `backend`), 🟢 BUG-DM5-S2-CITATION-TARGETS-1 — ✅ **FIXED 2026-08-14** (`e307a979`) — the RCA citation picker never offered a DOCUMENT target — `listRcaCitationTargets` was never updated when the seam was un-parked (owner: `backend`), 🟢 BUG-DM5-S2-STUB-1 — ✅ **FIXED 2026-08-14** (`cbcabe7a`) — the RCA and CAPA NSP workspace pages 500'd for EVERY user — the S2 query/action TS layer was never wired to the RPCs (owner: `backend`), 🟢 BUG-DM5-S2-WRITE-ARM-1 — ✅ **FIXED 2026-08-14** (`fc7a146d`, migration `20260927000160_dm5_s2_write_arm_nsp.sql`) — `app.can_write_document` had NO `rca`/`capa_action` case — the write corridor P0002'd for EVERY user, independent of BUG-DM5-S2-STUB-1 (owner: `backend`)

### Community 1681 - "45. Implementation checklist"
Cohesion: 0.33
Nodes (6): ✅ BUG-E2E-001 — `mem-memberships-collapse` AC-1 deleted a SEED membership in its own cleanup, poisoning every later batch of the gate · severity **MAJOR (test-suite)** · **CLOSED 2026-07-28** (found + fixed + re-verified by `tester`), ✅ BUG-FF1-008 — CLOSED by FF-3 (ADR 0090 Amendment 3), 🟡 BUG-FF1-008 — `form-builder-enhancements.spec.ts:768` AC-4 pins behaviour FF-1 deliberately removed · owner `tester` · **OPEN** (filed 2026-07-27), ✅ BUG-FF3-001 — after a blocked navigation, the untouched peer repetition kept a stale `unique_within_group` message and `aria-invalid` · severity **MINOR** · **CLOSED 2026-07-28** (fixed `8d53b3d`, re-verified by `tester`), ✅ BUG-FF3-002 — the two unary operators were OFFERED by every condition picker but could not be SAVED · severity **MAJOR / phase-blocking** · **CLOSED 2026-07-28** (fixed `91f4931`, re-verified by `tester`), FF-3-era closed bugs (rotated from PROGRESS.md 2026-07-28 at the FF-3 Record)

### Community 1682 - "7. Tenant and identity tables"
Cohesion: 0.33
Nodes (6): 14.1 Rule 12's three PHI modules — source: `CLAUDE.md` § 1 / Architecture Rule 12, 14.2 CLAUDE.md § 1's governance modules — source: `CLAUDE.md` § 1, 14.3 Canonical schema — source: `ARCHITECTURE.md` Rule 2, 14.4 Feature flags — source: `app.feature_flags` (42 keys), 14.5 Result, 14. TOP-DOWN reconciliation — against populations this project already declares

### Community 1683 - "pre-pilot-hardening-wave2.md"
Cohesion: 0.29
Nodes (5): PhaseCorrectionMode, PhaseCorrectionOptions, resolvePhaseCorrectionOptions(), VOCAB, TimelinePhaseResult

### Community 1684 - "Manual smoke — meeting audio → generated ata (T5)"
Cohesion: 0.05
Nodes (72): BlockRenderer(), ScopeState, ADR-0087, isAnswerableItem(), ADR-0087, CHOICE, canAddInstance(), describeInstanceShortfall() (+64 more)

### Community 1685 - "b1-org-admin-wall-mutation-audit.sh"
Cohesion: 0.33
Nodes (6): AE4.5 — the deny-class effect table, Row 5 re-measured — three legs, and the grain of each, ⚠ Row 7 will look like a bug — the mechanism travels WITH the assertion, The table, ⚠ Two APPROVED LIMITATIONS — they survive into the gate record, they are not caveats to drop, Two consequences the PO should see with the table

### Community 1686 - ""Sem processo" — process-less case creation (`processless_cases`)"
Cohesion: 0.33
Nodes (6): AE0 — authz ARM gate baseline, Bounded, stated, Reproduce, The four arms — 2026-08-26, all green, Three observations recorded now, so a later phase cannot inherit them silently, Why this file exists

### Community 1687 - "ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org"
Cohesion: 0.32
Nodes (6): parseVisibleWhen(), CONDITION_OPS, isValidCondition(), ORDERED_OPS, Vector, UNARY_OPS

### Community 1688 - "2 · Verification of the MOVED / FALSE claims"
Cohesion: 0.25
Nodes (7): form(), getSessionContext, insert, layoutRows, rpc, supabaseMock, update

### Community 1689 - "5.2 `referral_context_versions`"
Cohesion: 0.20
Nodes (10): ⚠ CLAUSE CORRECTED, AND RULED, 2026-09-09 — pre-AE5 Batch 9, unit `AE5-OPENING-ADR`, FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE, 🟡 FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE — the authz seam file passed gate 16's 160 KB warn line at this unit's slice (owner: lead + PO) — ✅ RESOLVED 2026-09-11, FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES, 🟡 FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES — three homes disagree on the ordinal (owner: lead + PO) — ✅ RESOLVED 2026-09-11, 🟠 FUP-AE5-OPENING-ADR-R10-AUDIT-STAMP-HAS-NO-REGISTER-HOME — R10 lives only in an ADR and a log (owner: backend + PO), PO ruling R4 (2026-09-09): REMOVE, RELOCATED NOT DELETED, ✅ RESOLVED 2026-09-10 (unit ADMIN-ARM-IS-ACTIVE) — the entry below is VERBATIM as filed (+2 more)

### Community 1690 - "Phase CH — Committee Charters & Meeting Cadence — QA Review"
Cohesion: 0.33
Nodes (6): Increment C ✅ BUILT — ADR 0167 Amdt 2, `staff` sub-arm narrowed WITH its compensation, Mutation audit: 20 → 22 mutants, and a THIRD needed work, Ruling recorded: the deriver's EXCLUDED-BY-NAME list, The agreement-property floor is `8|32`, not the lead's `6|24`, ⛔⛔ THE LEAD'S PRESCRIBED COMPENSATION WAS WRONG, and the correction is the lesson, Vacuity, answered by instrumentation over all 247 files

### Community 1691 - "Round 2 — verification of the fix wave"
Cohesion: 0.33
Nodes (6): Increment C (NOT BUILT) — ADR 0167 Amdt 2, and ⛔ the compensation it must carry, Not affected — confirmed, not assumed, The 5 REDs — all real reachability findings, two meant to be DELETED, ⚠ The ADR's own prediction was measured FALSE, in the reassuring direction, The compensation the increment MUST carry, ⛔ The quiet damage — bigger than clause 1's was, and none of it reds

### Community 1692 - "23. Encryption and Sensitive Data"
Cohesion: 0.33
Nodes (6): AE4.7c — the `can_manage_professional` split, 2026-09-01 (lead session, after AE4.7b), Gates at the end of AE4.7c — fresh-reset tree, pgTAP 406 — the direction nothing else measures, ⛔ Three things the ruling did not predict, each found by a red, What AE4.7c did NOT do, What shipped

### Community 1693 - "14. Explicit case access"
Cohesion: 0.33
Nodes (6): Gate AE4 wave + IA-F9 — 2026-09-02 (lead, 5 agents), IA-F9 — four runs, and every one was a different defect, The verdict, and what it overturns, The write arm was bounded by a SYNTAX, not a property, What each produced, What this session did NOT do

### Community 1694 - "26. Auditing"
Cohesion: 0.20
Nodes (10): FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS — ✅ CLOSED 2026-09-03 (Gate AE4 blocker batch, PO ruling), 🟠 FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS — the regression oracle cites its own PO approval at 42, 33 and 43 rows, ✅ FUP-AUTHZ-COMMAND-DOOR-UNSWEPT — Critical FUP C2: sweep the PHI-touching command doors — **RESOLVED 2026-09-04**, ✅ FUP-AUTHZ-HARNESS-PRECONDITIONS — a neutralization verdict has at least TWO preconditions and the harness checks ONE (owner: backend/harness; **filed after two near-miss false BLINDs on the same live door in one session**) — **RESOLVED 2026-09-04**, ✅ FUP-AUTHZ-HARNESS-TRANSACTIONAL — the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN (owner: lead + backend; filed 2026-08-14, DM5 S2, after it happened) — **RESOLVED 2026-09-04**, ✅ FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000 — the neutralizer's anchor is a syntax, not a property — **RESOLVED 2026-09-04**, ✅ FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS — a long sweep degrades its own DB, and the harness's baseline is captured once at the top — **RESOLVED 2026-09-04**, ✅ FUP-C2-SUITE-ABORT-ERROR-CLASS — enforcers that abort a pgTAP file when neutralized — **RESOLVED 2026-09-04** (+2 more)

### Community 1695 - "36. Status transitions"
Cohesion: 0.07
Nodes (36): CaseDocumentsPanel(), ADR-0033, ADR-0063, ADR-0100, ADR-0114, DOCUMENT_HOME_CONFIG, DocumentUpload(), DocumentsPanel() (+28 more)

### Community 1696 - "9. Permission and role catalog"
Cohesion: 0.60
Nodes (5): fail(), psql(), psqlt(), run_suite(), ae3-targeted-cases.sh script

### Community 1697 - "ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split"
Cohesion: 0.20
Nodes (10): FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED — half of `app` is PUBLIC-executable, and the only thing bounding it is one config line (owner: backend; filed 2026-08-22, found while deriving an ACL by property for ADR 0134 Amdt 6), FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE, 🟠 FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE — the admin arm never gates on `app.is_active`, FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, 🟠 FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM — both arms were caller-keyed and the reach was smaller than filed — fixed via the `_for` twins — ✅ CLOSED 2026-09-09, 🟡 FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN — rows 31/32's `_comment` is stale, 🟡 FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE — the fallback arm passes the app check, then the case read refuses it, ✅ RESOLVED 2026-09-10 (Batch 9, unit AE5-OPENING-ADR) — the entry below is VERBATIM as filed (+2 more)

### Community 1700 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.10
Nodes (21): Archive — QA Verdicts (full verbose form), Collapsed one-line index — concluded features (rotated from PROGRESS.md 2026-08-06), Collapsed one-line index — rotated 2026-08-10 (18 rows: QO·B → Phase 16), ETH·E4 loop rows (rotated from PROGRESS.md 2026-08-11 at the Record step), Rotated 2026-08-23 at the AFF2 Record step — the case-split and DSR milestone rows, Rotated at AE1's Record step, 2026-08-27, ↩ Rotated from PROGRESS.md 2026-08-17 (the §6-step-5 size rotation) — the three DM5 slice verdicts, VERBATIM, ↩ Rotated from PROGRESS.md 2026-08-18 (the §6-step-5 size rotation, DM5 Record) — the DM5 PHASE QA + S6 slice rows, VERBATIM (+13 more)

### Community 1701 - "16. Single-hospital customers"
Cohesion: 0.40
Nodes (4): CONTEXT.md Format, Rules, Single vs multi-context repos, Structure

### Community 1702 - "MEM-W4 — Diretor Técnico: roles, appointment AND the referral plane (2026-08-04; ADR 0094 Amendments 3–4; migrations `20260905000400` · `20260905000500` · `20260905000600`; flag `technical_director` **ON**)"
Cohesion: 0.29
Nodes (7): 3.3 `forms.form_sections`, Design Reasoning, Example `layout_config`, Important Columns, Purpose, Relationships, Suggested Table

### Community 1704 - "0085 — Case Correction Lifecycle (phases + narratives)"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 1705 - "7. Recommended changes for the current project"
Cohesion: 0.40
Nodes (4): ADR 0001 — Scaffolding & toolchain bootstrap, Consequences, Context, Decisions

### Community 1706 - "11. Rollout and rollback strategy"
Cohesion: 0.40
Nodes (4): ADR 0006 — Supabase API key scheme vs. env var naming, Consequences, Context, Decision

### Community 1707 - "3. Verified current-state catalog snapshot"
Cohesion: 0.40
Nodes (4): 0012 — clone_form_version returns the existing draft (one draft per form), Consequences, Context, Decision

### Community 1708 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.40
Nodes (4): ADR 0019 — The default (anchor) section may carry a title, Consequences, Context, Decision

### Community 1709 - "4.4 `form_responses.form_repeating_group_instances`"
Cohesion: 0.40
Nodes (4): ADR 0021 — Due dates for case phases, Consequences, Context, Decision

### Community 1710 - "11. Domain Services and Transaction Boundaries"
Cohesion: 0.03
Nodes (56): `buildAnswerMaps` — read BUG-FF4-001 first, Radix dialog focus — the two halves that replace together, ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`, Consequences, Context, Decision, The mechanism — measured, because the obvious prior is wrong, Two findings about the authz harness, surfaced by this wave (+48 more)

### Community 1711 - "17. Suggested Repository and Service Boundaries"
Cohesion: 0.20
Nodes (10): 2026-09-07 — backend: QA fix loop, iteration 1, F-BLOCK-2 — the two-step order, and why DELETE was right, F-BLOCK-3 — the witness is now HISTORICAL, DATED and true, and the absence is stated, F-MAJOR-2 — the seam detector, and the dead end that is worth more than the detector, Gate after the loop — bare, nothing piped, Registers touched, The new SELFTEST arm, and its two mutation proofs, What the next session does (+2 more)

### Community 1713 - "Shared Action-Items Hub — task detail (Option A → case-fold → member views)"
Cohesion: 0.18
Nodes (10): Findings, INFO-1 — `reason_code` governance signal is real, MINOR-1 — stale comment in the collapsed UI helper (§7.2 #5 shape), MINOR-2 — `m5`/`m6` mutation-audit stale targets (pre-existing A2-era debt), Pre-approved deviations — ruled, QA Review — ADR 0078 Stage B · `case_access → case_access_grants` hard cut (B1→B5), Scope notes, Skeptic battery — the review's core (all under `authenticated`) (+2 more)

### Community 1715 - "not-found.tsx"
Cohesion: 0.22
Nodes (9): 1. Coverage denominator, 2. Summary counts, 3. Table of every hit, 4. Traps, 5.1 MISSED BY §3 — confirmed BREAKS, and a gap in the plan itself, 5.2 Classification disagreement — lines 553, 598, 663, 635, 640, 5.3 Corrected coverage counts, 5. Lead reconciliation — a second, independent sweep (+1 more)

### Community 1716 - "PDF·P2 — PDF printing: Meetings (ata) (COMPLETE 2026-08-08)"
Cohesion: 0.29
Nodes (7): Gate state (this session's scope — NOT the full §6 gate), Item 0 — MAJOR-1 / S1-O4 (PO: PROPAGATE) — ADR 0117 Amendment 1, Item 1 — P0-1's proof closed, Red-first record (K15, real pre-fix catalog — 374 migrations, unmutated), Resumption session 2026-08-13 (backend) — items 0 + 1 closed, The 308 obligation is now executable, Twin record (item 0)

### Community 1717 - "V-0 Â· Corrections to my own v1 â€” visible, not silent"
Cohesion: 0.29
Nodes (9): imagePlaceholder(), mapChild(), printImagePlaceholders(), PROCESSOR, renderMarkdown(), replaceImages(), ADR-0104, ADR-0144 (+1 more)

### Community 1718 - "carry-forward-panel.tsx"
Cohesion: 0.25
Nodes (6): §6 gate, Backend (`backend`), Frontend (`frontend`, `aebe7cdff7d0fbfad` / `a20b5bd87cf9c7014`), Handoff note (historical), Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26), Tester (`tester`, `a5775c724f7eaab9c`) — gate

### Community 1719 - "use-title-action.ts"
Cohesion: 0.22
Nodes (9): 4. What the current design does well, S1 — Database-enforced isolation, S2 — Administrative and clinical duties are separated, S3 — Current membership storage is relationally stronger than earlier reports, S4 — Membership writes have a real door, S5 — Revocation, expiry, suspension, and active-role checks fail closed, S6 — Case authorization is a deep module, S7 — Privileged reads and writes are designed as auditable doors (+1 more)

### Community 1720 - "14. Handoff checklist"
Cohesion: 0.40
Nodes (4): 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`), Consequences, Context, Decision

### Community 1721 - "2. Method and evidence"
Cohesion: 0.22
Nodes (9): 3. Migration plan (window `20260925000100`+), M1 — `20260925000100_dm3_securable_controlled_document.sql`, M2 — `20260925000200_dm3_kernel_controlled_arm.sql`, M3 — `20260925000300_dm3_domain_core_binding.sql`, M4 — `20260925000400_dm3_replace_set_document_version_file.sql`, M5 — `20260925000500_dm3_controlled_bucket_doors_retire.sql`, M6 — `20260925000600_dm3_controlled_no_phi_tier.sql`, M7 — `20260925000700_dm3_ethics_document_seams.sql` (+1 more)

### Community 1722 - "1. Audit boundary and method"
Cohesion: 0.29
Nodes (7): 2 · MAJOR — claims that are true of the build and false of the function, 🟠 M1 — `backend-state.md`'s causal explanation of the blindness is false, and it is the durable surface map, 🟠 M2 — "the four LGPD erasure doors did not complete" over-claims by two doors, in the same file, 🟠 M3 — the over-claim test's roster still says "four of four" while pinning three, 🟠 M4 — the new operator procedure states a precondition the doors do not have, 🟠 M5 — `PhiInputHint`'s host census carries four mutually inconsistent numbers, and the load-bearing one is wrong, 🟠 M6 — one defect, two IDs, contradictory verdicts, and the fix is already in the branch

### Community 1723 - "supersede-document-button.tsx"
Cohesion: 0.20
Nodes (10): ⏸ AUTHZ · Gate 1 · A2 — the resolver · **BLOCKED pending a PO/lead ruling** (`backend`, 2026-07-15) — ⭐ **ruling received; A2 rescoped, M3 lands first**, AUTHZ Gate 1 — completed unit detail (rotated out of PROGRESS.md), ▶ AUTHZ · Gate 1 · M1 — exclusion durability (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M2 — A30 bucket C: platform_admin loses referral-PHI destruction (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M3 — defect ①: bare assignment no longer confers PHI (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5 — defect ③: the `is_active` outer gate (`backend`, 2026-07-15), ▶ AUTHZ · Gate 1 · M5b — defect ③ AT THE DOORS: `qa`'s P1, and my closure was a floor (`backend`, 2026-07-15), ▶ AUTHZ · M4 — the gated-off myth: **FIVE** false flag descriptions corrected (`backend`, 2026-07-15) (+2 more)

### Community 1724 - "CaseLinker"
Cohesion: 0.20
Nodes (9): 1. Is the PHI-destruction path dead? — **YES (behaviourally proven)**, 2. Is legitimate disposal intact? — **YES. The over-grant twin genuinely passes.**, 3. Mutation harness — re-run by me, 21/21 RED-PROVEN, and red means red, 4. The two self-reported traps — both confirmed closed, 5. Scope — clean. No over-reach., AUTHZ · M2 — A30 bucket C review (platform_admin loses the referral-PHI arm), E2E recommendation: **targeted run — do NOT run the full suite**, Still live (MINOR — non-blocking, no behaviour at risk) (+1 more)

### Community 1725 - "access-audit-table.tsx"
Cohesion: 0.22
Nodes (7): openDashboard(), IMPORTANT: exclude case-phase responses (`case_phase_id=is.null`). The, seedOnlyTo(), signInAs(), ADR-0018, ADR-0020, ADR-0106

### Community 1726 - "AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18)"
Cohesion: 0.40
Nodes (4): ADR 0101 — The role→landing guard is catalog-derived, not remembered, Consequences, Context, Decision

### Community 1727 - "Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)"
Cohesion: 0.40
Nodes (4): ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended), Consequences, Context, Decision

### Community 1728 - "Phase 15 — Quality Indicators (Indicadores de Qualidade)"
Cohesion: 0.18
Nodes (10): 1. Requirements — does Fix 3 do exactly what D6·5·1 rules, and no more?, 2. Security / RLS, 3. Tests — is `417` falsifiable, and is the classification honest?, 4. Code quality, 5. UX & a11y, 6. Hygiene, 7. INFO, QA Review — GRANT-PLANE-CONVENTION-A1, Fix 3 (`public.grant_case_access` refuses a self-grant) (+2 more)

### Community 1729 - "Worktrees — parallel Claude Code sessions on this repo"
Cohesion: 0.27
Nodes (6): GET(), ADR-0104, ADR-0120, applyStatusOverlay(), STAMP_TEXT, ADR-0104

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
Cohesion: 0.40
Nodes (4): 0147 — Masked CPF on the person detail rail, Consequences, Context, Decision

### Community 1734 - "4.1 `form_responses.form_submissions`"
Cohesion: 0.24
Nodes (15): formatCaseNumber(), formatInterviewNumber(), formatNextSession(), interviewTitle(), ConfidentialityBadge(), InterviewCategoryBadge(), InterviewStatusBadge(), InterviewPhaseOption (+7 more)

### Community 1735 - "Lead Playbook — orchestration protocol (lead only)"
Cohesion: 0.10
Nodes (15): Call, calls, makeAdmin(), makeBuilder(), rows, ADR-0108, ADR-0151, ADR-0154 (+7 more)

### Community 1736 - "Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)"
Cohesion: 0.40
Nodes (4): 0148 — Ever-held affiliation as the person-read boundary, Consequences, Context, Decision

### Community 1737 - "actions.test.ts"
Cohesion: 0.40
Nodes (5): 19. Templates, Responsibility, Template Checklist Items, Template Follow-Ups, Template Table

### Community 1738 - "parse-required.test.ts"
Cohesion: 0.29
Nodes (7): MAJOR, MAJOR-1 · Raw Postgres error text reaches the UI (CLAUDE.md §8, explicit), MAJOR-2 · Two live paths steer a coordinator into `no_account` — which provably disables the automatic impedimento, MAJOR-3 · The ADR 0108 D6 guard has no falsifiable E2E proof — its two gating assertions are vacuous, MAJOR-4 · The new `lint:client-server-imports` gate does not close BUG-FBE-005's class, MAJOR-5 · The write-door coverage achieved this phase is **one-time and by hand** — it is not standing, MAJOR-6 · Mint-then-fail leaves an orphan, and retrying mints a duplicate

### Community 1739 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.40
Nodes (5): 24. Row-Level Security Considerations, Access Rules to Consider, Example Read Policy, Example Update Policy, Recommended Helper Functions

### Community 1740 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.13
Nodes (13): declared, FLAG_COLUMNS, ADR-0125, ADR-0126, NON_FLAG_KEYS, OUT, raw, ROOT (+5 more)

### Community 1741 - "ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`"
Cohesion: 0.40
Nodes (5): 25. MVP Implementation Recommendation, Phase 1: Minimum Useful Action Item System, Phase 2: Follow-Up and Evidence, Phase 3: Advanced Workflow, Phase 4: Customization and Automation

### Community 1742 - "Step 2 — Configure the Supabase Cloud project (Dashboard)"
Cohesion: 0.40
Nodes (5): 9. Assignments: `action_item_assignments`, Enforcing One Active Owner, Responsibility, Suggested Schema, Supported Roles

### Community 1743 - "Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)"
Cohesion: 0.40
Nodes (5): 13.1 Recommended additions to `action_items`, Design Justification, Example Ethics Action Items, Example M&M Action Items, Suggested Core Schema

### Community 1744 - "QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)"
Cohesion: 0.40
Nodes (5): 15.1 `audit_events`, Design Justification, Events to Log, Purpose, Suggested Schema

### Community 1745 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.40
Nodes (5): 17.2 `ethics_case_allegations`, Design Justification, Example Allegation Categories, Purpose, Suggested Schema

### Community 1746 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.40
Nodes (5): 17.4 `ethics_decision_details`, Design Justification, Example Sanction Types, Purpose, Suggested Schema

### Community 1747 - "ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles"
Cohesion: 0.40
Nodes (5): 19.1 M&M Patient Case, Base Case, Extension Details, Forms, Participants

### Community 1748 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.40
Nodes (5): 5.1 `case_types`, Design Justification, Important Columns, Purpose, Suggested Schema

### Community 1749 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.40
Nodes (5): 5.3 `committee_cases`, Design Justification, Important Columns, Purpose, Suggested Schema

### Community 1750 - "ADR 0109 — Referral "Registros internos" + the case-access summary door"
Cohesion: 0.22
Nodes (9): AI — Action-Items Satellites + reminder→N scan arm (2026-07-14; ADR 0050; migrations `20260720000950`–`…000970`; flags `action_items`/`cases_extras` ON), Backend State — notifications and action items, Current state, Invariants, N — Notifications (S1·N, 2026-07-13; ADR 0076; migrations `20260720000700`–`…000730`; flag `notifications` ON), Open edges, Rollout, Surface (+1 more)

### Community 1751 - "0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns"
Cohesion: 0.40
Nodes (5): 6.5 `case_participants`, Design Justification, Purpose, Recommended Partial Index, Suggested Schema

### Community 1752 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.40
Nodes (5): 8.2 Recommended additions to `form_responses`, Design Justification, Example Uses, Purpose, Suggested Columns to Add

### Community 1753 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.40
Nodes (5): 11.1 Flags, 11.2 Canonical-write rule, 11.3 Object migration safety, 11.4 Stop/rollback triggers, 11. Rollout and rollback strategy

### Community 1754 - "referrals.test.ts"
Cohesion: 0.17
Nodes (5): AID_ICONS, AID_PRIO, AID_STATUS, AID_UPD, AID_UPD_ICON

### Community 1755 - "dm4-referral-doors-matrix.sh"
Cohesion: 0.40
Nodes (5): 3.1 Buckets and Storage policy surface, 3.2 Central attachment schema, 3.3 Current local row/object counts, 3.4 Parallel document-bearing surfaces, 3. Verified current-state catalog snapshot

### Community 1756 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.22
Nodes (9): ADR 0042 — NSP-per-org: per-org PQS roster + org-bound PHI doors, Alternatives rejected, BUG-NSP-004 — the non-event CAPA fallback must be applied to EVERY org-gate, uniformly, Consequences, Context, Decision, Implementation notes (sub-phase A, backend — discovered during build), M3 — "gate-fixed but body-not-scoped" (the second QA fix-loop class) (+1 more)

### Community 1757 - "ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only"
Cohesion: 0.17
Nodes (5): AID_ICONS, AID_PRIO, AID_STATUS, AID_UPD, AID_UPD_ICON

### Community 1758 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.40
Nodes (5): 11.1 Purpose, 11.2 Proposed schema, 11.3 Integrity, 11.4 Reminder integration, 11. New table: `case_notices`

### Community 1759 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.40
Nodes (5): 7.1 Purpose, 7.2 Proposed schema, 7.3 State transitions, 7.4 Authorization, 7. New table: `case_access_exclusions`

### Community 1760 - "ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal"
Cohesion: 0.40
Nodes (5): 8.1 Purpose, 8.2 Proposed schema, 8.3 Category strategy, 8.4 Finding history, 8. New table: `case_allegations`

### Community 1761 - "ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org"
Cohesion: 0.40
Nodes (5): 9.1 Purpose, 9.2 Proposed schema, 9.3 Original Decision versus review Decision, 9.4 Issuance invariants, 9. New table: `case_decisions`

### Community 1762 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.40
Nodes (5): 3.15 `forms.block_library_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1763 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.22
Nodes (9): ADR 0188 — A closure tally may be COMPOSITED across suite shapes, and must be stated as one, Consequences, Considered options, Context, D1 — a composite tally is admissible, under three conditions, all of which must be checked, D2 — the composite must be STATED as a composite, with the shapes it spans, D3 — classes count DOORS; property labels count ARMS; a record stating both says which, Decision (+1 more)

### Community 1764 - "5.2 `referral_context_versions`"
Cohesion: 0.29
Nodes (6): FUP-REGISTER-GATE-HYGIENE-LINK-CHECKING-HAS-NO-GATE-OUTSIDE-THREE-CORPORA — most of `docs/` has no link gate at all, and the five broken links found today were found by hand, The corpus gap, DERIVED from the three scripts (not recalled), Two bounds on the sweep, stated because they are invisible in the number, What the audit that opened this item got wrong, What the sweep measured, and with what instrument, What would close it

### Community 1765 - "32. Implementation Phases"
Cohesion: 0.29
Nodes (7): 2026-09-11 — `e2e:prod` GREEN at `48c192ed`; QA r2 APPROVED; the unit is gated, awaiting human approval (lead), 2026-09-11 — PO approval; Record step (lead), 2026-09-11 — QA r1 fix pass (backend), 2026-09-11 — the four converged by narrow ALTER FUNCTION; freeze 865 → 861; `420` re-cast from pin to guard (backend), 2026-09-11 — the verification the QA r1 fix pass owed, on a fresh reset (backend), 2026-09-11 — unit opened; the PO ruled CONVERGE; scope mapped (lead), Session log

### Community 1766 - "Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items)"
Cohesion: 0.40
Nodes (5): 3.8 `forms.form_block_default_values`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1767 - "Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)"
Cohesion: 0.40
Nodes (5): 3.9 `forms.form_logic_rules`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1768 - "Pre-Pilot DB Hardening — Wave 1 (archived task detail)"
Cohesion: 0.40
Nodes (5): 4.11 `form_responses.form_submission_section_states`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1769 - "21. Recommended Dashboard Views"
Cohesion: 0.29
Nodes (7): 2026-09-12 — /review-claude-md run after the merge (playbook § 4 step 7) (lead), Blockers, Current state`, Done since start, In progress, Next, Objective

### Community 1770 - "Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)"
Cohesion: 0.02
Nodes (83): 0196 — The backend surface map splits on the MODULE SEAM axis, and a router replaces the reading list, Consequences, Considered options, Context, Decision, Problem, 0197 — The data-access REGISTRIES are generated from the catalog; the prose keeps only what a catalog cannot know, Consequences (+75 more)

### Community 1771 - "run-chart-loader.tsx"
Cohesion: 0.29
Nodes (7): Bug Log, Current Phase Tasks, FF-1 — Repeating Groups (Flexible-Forms Program, phase 1 of 5), FUP-FF1-2 — FF-1 QA non-blocking items (detail rotated out of PROGRESS.md 2026-07-28), ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO), 📋 Remaining pre-pilot work / Completed work, Test Run Summary

### Community 1772 - "loading.tsx"
Cohesion: 0.29
Nodes (6): RelationshipBadge(), SubjectForm(), SubjectMemberOption, SubjectRow(), SubjectsPanel(), InterviewSubject

### Community 1773 - "loading.tsx"
Cohesion: 0.06
Nodes (42): ADR-0001, ADR-0004, ADR-0006, ADR-0007, AudioJobClientFailure, AudioJobResult, call(), readConfig() (+34 more)

### Community 1774 - "loading.tsx"
Cohesion: 0.33
Nodes (5): parseRequired(), CONDITION, fd(), ADR-0087, ADR-0087

### Community 1775 - "loading.tsx"
Cohesion: 0.33
Nodes (6): ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got, Consequences, Context, Decisions, The gap the roles table exposes (QA finding M-3), Two premise corrections found while scoping (one re-corrected by QA)

### Community 1776 - "loading.tsx"
Cohesion: 0.22
Nodes (9): Answer-Model v2 + form-definition forward-compat — phase record (✅ COMPLETE 2026-07-01), Backend (`backend`) — all ✅ done, Bugs (this gate) — both RESOLVED, Commits (branch `feat/answer-model-v2`), Frontend (`frontend`) — all ✅ done, Full E2E suite (lead-owned), Gate result, Summary (+1 more)

### Community 1777 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-05 — backend: gate re-read at the tip `ee037fa3`, 2026-09-05 — backend: QA fix loop, iteration 2 of ≤5 (DOCS ONLY), 2026-09-05 — backend: QA fix loop, iteration 3 (F2-RECs), 2026-09-05 — Record step (lead): PO approved at `d160aabf`; unit closed and merged, 2026-09-05 — unit opened (lead), Hub `## Current state` at closure — cut from the hub 2026-09-05 (ADR 0186 D8), Post-run catalog and scope guards, Session log (+1 more)

### Community 1778 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 4.9 `form_responses.form_answer_references`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1779 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-05 — backend: QA fix loop, iteration 4 (F3-BLOCK-1 + F3-RECs), D11's control — discharged, and attributed, Every site corrected, old text kept beside the new, F2-REC-6 follow-through — pointer verified, row deliberately NOT back-filled, F3-BLOCK-1 — the denominator is 399, and iteration 3's "correction" was the error, Gate — every code read BARE, The classifier itself — checked, and NOT defective, The five recommendations (+1 more)

### Community 1780 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 2026-09-04 — backend: QA fix loop, iteration 2, `.claude/rules/` — re-read clause by clause, and nothing went false, Deviations, End to end — the retry net, proven on a SUBSET again (the point of the ruling), Gate — every exit code read BARE, on the line after the command, never through a pipe, Proofs A–E — gate polarity on the SHIPPED text, Sentences corrected — appended beside, never rewritten, The fix — one file, four sites, one predicate (+1 more)

### Community 1781 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 5.11 `referral_resolutions`, Columns, Constraints, Design rationale, Suggested outcome codes

### Community 1782 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 5.4 `referral_assignments`, Columns, Design rationale, Suggested assignment roles, Suggested assignment statuses

### Community 1783 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 10.1 `interview_consents`, 10. Consent and Recording Authorization, Recommended constraints, Recording gate, Uniqueness strategy

### Community 1784 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 11.1 `interview_notes`, 11. Notes, Finalization rule, Visibility rule, Why both author IDs are useful

### Community 1785 - "loading.tsx"
Cohesion: 0.15
Nodes (13): arr(), CAPABILITIES, ADR-0133, ADR-0155, ADR-0161, OUT, q(), raw (+5 more)

### Community 1786 - "loading.tsx"
Cohesion: 0.09
Nodes (23): 2026-08-19 — BACKUP HALF ONLY (§ 6b), local stack, first execution, 2026-08-31 — DISPOSAL HALF (§ 3), local stack — ⛔ BLOCKED AT STEP C, `HC0DR`, 2026-08-31 (second run) — DISPOSAL HALF (§ 3), local stack — ✅ COMPLETED END-TO-END, twice, Controls run, and what each proves, ⚠ Defects found in the instructions — the rehearsal's actual yield, Evidence — the block was measured, not inferred, F1 · ⛔ The mandatory sync check green-lit a world-readable destination, F2 · The documented `7z` command cannot be run non-interactively at all (+15 more)

### Community 1787 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 17.1 `interview_external_access_links`, 17. External Participant Access, One-time link behavior, Recommended constraints, Security requirements

### Community 1788 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 25.1 Tenant consistency trigger, 25.2 Status transition function, 25.3 Finalization functions, 25.4 External token consumption function, 25. Recommended Database Triggers and Functions

### Community 1789 - "loading.tsx"
Cohesion: 0.10
Nodes (18): opts(), fakeAdmin(), base, client, Ctx, hospitalAdminOfCentralA, hospitalAdminOfSibling, orgAdmin (+10 more)

### Community 1790 - "loading.tsx"
Cohesion: 0.18
Nodes (11): 0 · Measured inputs (2026-08-19 — RE-MEASURE, never quote), 1 · The sixteen ratified decisions (index), 2 · Slices, 3 · Explicitly out of scope, 4 · Risks & watch-items for the implementing session, DSR ("Direitos do Titular") — implementation plan, Slice 1 — the child-lock fix (ADR 0129). Standalone; FIRST; small. ✅ SHIPPED 2026-08-19., Slice 2 — minimal execution corridor. ✅ SHIPPED 2026-08-20. Discharges pilot-gate item 0. (+3 more)

### Community 1791 - "loading.tsx"
Cohesion: 0.17
Nodes (12): ADRs, AFF4 — organization affiliation, per-hospital staff data, the voided tense, Durable facts promoted out of this build, Gate record, Migrations and pgTAP, ⛔ Residue this Record step did NOT file, The 2026-08-26 `e2e:prod` gate — the row PROGRESS.md points here for, The doors, the trigger, the tense pair (+4 more)

### Community 1792 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 34.1 Database invariant tests, 34.2 RLS tests, 34.3 Security tests, 34.4 Workflow tests, 34. Testing Strategy

### Community 1793 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 21. Changes during a round, Discharged before assessment, New admission after generation, Patient moved after snapshot, Patient transferred between beds

### Community 1794 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 24.1 Required authorization dimensions, 24.2 Aggregate versus identifiable access, 24.3 RLS inheritance, 24.4 Privileged operations, 24. Permissions and Supabase RLS

### Community 1795 - "loading.tsx"
Cohesion: 0.10
Nodes (23): EvidenceCountBadge(), HospitalReadinessRegister(), OwnershipEditor(), formatPct(), GapListSection(), LevelCard(), ReadinessDashboard(), AssessmentStatusChip() (+15 more)

### Community 1796 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 5.1 Identifiers and timestamps, 5.2 Multi-tenant integrity, 5.3 Historical data, 5.4 Controlled vocabulary, 5. Conventions and cross-cutting requirements

### Community 1797 - "loading.tsx"
Cohesion: 0.18
Nodes (8): JSON_PATH, PrintSourceVector, ROOT, SQL_PATH, ADR-0125, ADR-0126, ADR-0144, vectors

### Community 1798 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 8.1 `evaluation_programs`, 8.2 `evaluation_program_scopes`, 8.3 `evaluation_program_schedules`, 8.4 Rationale, 8. Evaluation programs

### Community 1799 - "loading.tsx"
Cohesion: 0.20
Nodes (10): ADR 0133 — AFF2: affiliation-scoped administration, mandatory-CPF registration & the user-management redesign, Alternatives rejected, Consequences, Context, Decisions, Display & the credential read, New person columns (amends 0048 D10), Registration (+2 more)

### Community 1800 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 11.1 Organization role assignments, 11.2 Hospital role assignments, 11.3 Committee role assignments, 11.4 Platform role assignments, 11. Scoped role-assignment tables

### Community 1801 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 35.1 Hospital user screen, 35.2 Organization user screen, 35.3 Quality dashboard, 35.4 Single-site customer, 35. Administrative UX workflows

### Community 1802 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 39.1 Minimum test personas, 39.2 Required cross-scope tests, 39.3 Test through real access paths, 39.4 pgTAP, 39. Testing strategy

### Community 1803 - "loading.tsx"
Cohesion: 0.20
Nodes (3): disposeMeetingMinutesTask, refresh, ADR-0130

### Community 1804 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 3.1 RBAC: role-based access control, 3.2 Scope-bound assignment, 3.3 ABAC: attribute-based conditions, 3.4 Explicit grants and restrictions, 3. Authorization strategy

### Community 1805 - "loading.tsx"
Cohesion: 0.22
Nodes (7): Bugs caught & fixed during the build (0 escaped to the test gate), Contract-first sequencing, Gate results, Open notes / risks, Phase 10 — Meetings (archived task detail), Summary, Tasks

### Community 1806 - "loading.tsx"
Cohesion: 0.22
Nodes (9): 1. PHI isolation (Rule 12), 2. Access-follows-custody RLS, 3. Custody ledger append-only, 4. PHI `.read` auditing, 5. Audit data-minimization (Rule 11), 6. State machine + DEFINER RPCs + search_path, 7. Client/server boundary (P14a-002), 8. Flag-gating + just-culture (+1 more)

### Community 1807 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 41.1 Create memberships first, 41.2 Convert existing roles, 41.3 Avoid silently broadening clinical access, 41.4 Parallel authorization period, 41. Existing-data migration

### Community 1808 - "loading.tsx"
Cohesion: 0.22
Nodes (8): Anti-patterns, Location and lifetime, RESUME mode, Session Handoff, Sweeping stale handoffs, Template, ⛔ The load-bearing rule: a handoff may not be cited, Writing one

### Community 1809 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 45. Implementation checklist, Functions, RLS, Schema, Testing

### Community 1810 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 7.1 User profiles, 7.2 Organizations, 7.3 Hospitals, 7.4 Organization contacts, 7. Tenant and identity tables

### Community 1811 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 10. Table: `documents`, DDL, Delayed foreign key for `current_version_id`, Design rationale, Purpose

### Community 1812 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 14. Table: `document_version_assets`, DDL, Design rationale, Optional uniqueness rule, Purpose

### Community 1813 - "Live-file closed table + method notes (rotated from PROGRESS.md 2026-08-06)"
Cohesion: 0.40
Nodes (5): 40.1 M&M evidence document, 40.2 Form attachment, 40.3 Ethics complaint document, 40.4 Institutional policy document, 40. Example Scenarios

### Community 1814 - "ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered)"
Cohesion: 0.22
Nodes (9): A — D7's "HC069 becomes structurally unreachable" was false FOR THE REASON GIVEN, ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered), Amendment 1 — two rationales were FALSE as measured; the model moves to ADR 0126 (2026-08-18), Amendment 2 — the `form_response` watermark moves IN TANDEM with the refined lock (2026-08-18), B — the meetings "lock set ⊇ registering set" argument was false, and an unnamed FK is what holds, C — the two residual paths this ADR carried as "not verified, not claimed", Consequences, D — the shape, recorded because it is the class and not the instance (+1 more)

### Community 1815 - "ADR 0129 — A narrow disposal flag through the meeting child lock"
Cohesion: 0.40
Nodes (5): 8. Table: `app_resources`, DDL, Design rationale, Important notes, Purpose

### Community 1816 - "VERDICT (r3): **APPROVED**"
Cohesion: 0.40
Nodes (5): 9. Table: `document_kinds`, DDL, Design rationale, Example rows, Purpose

### Community 1817 - "case-event-form.test.tsx"
Cohesion: 0.25
Nodes (3): createCaseEvent, ADR-0137, updateCaseEvent

### Community 1818 - "reserved-sessions-panel.tsx"
Cohesion: 0.40
Nodes (5): 11.1 Case tests, 11.2 Meeting tests, 11.3 Referral tests, 11.4 Grant-door tests, 11. Regression-test matrix

### Community 1819 - "credentials-editor.tsx"
Cohesion: 0.22
Nodes (9): 0063 — Centralized attachments substrate: which DMS-handoff seams we adopt, Adopt into the 14e core now — three cheap bolt-ons (no shape change), Adopt into the 14e core now — three shape changes (expensive to retrofit), Consequences, Context, Decision, Reconciliation note — Pre-Pilot Foundations Program (2026-07-10), Reject (with reasons) (+1 more)

### Community 1820 - "Language"
Cohesion: 0.40
Nodes (5): 1. Audit — every recorded S1–S3 claim spot-checked against the substrate, 2. The six open non-copy findings — all resolved (commit `169668d`), 3. Verification, 4. The full gate (two runs) and what it caught, Stage 3 — lead audit session (2026-08-10, resume after the pause)

### Community 1821 - "cases-ui.jsx"
Cohesion: 0.33
Nodes (6): 10.1 Referral read access, 10.2 Message insertion, 10.3 Internal notes, 10.4 Documents, 10.5 Linked cases, 10. Row-Level Security Strategy

### Community 1822 - "ADR 0137 batch — MRN as erasure key; case/referral usability (D1–D14)"
Cohesion: 0.25
Nodes (8): ADR 0016 — SECURITY DEFINER read path for staff_admin sign-off, Consequences, Context, Decision, Known v1 limitation: no answer-lock between sign-off and submission, Queue predicate: also require submit-readiness, RLS policy fix surfaced this phase (signoffs_insert / signoffs_select), The write path stays under RLS

### Community 1823 - "⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**"
Cohesion: 0.04
Nodes (68): FormsListPage(), metadata, SubmissionsFiltersAsync(), DiscardDraftButton(), FillableFormCard(), StartFillButton(), referenceKindOf(), flattenItem() (+60 more)

### Community 1824 - "⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO)"
Cohesion: 0.25
Nodes (8): 6.0 How the two runs are made comparable, 6.0a ⚖ RULED 2026-08-27 (PO) — the `costs off` SHAPE DIFF **is** AE1.5's acceptance evidence, 6.1 `profiles` — BEFORE, and one number that does NOT reproduce, 6.2.1 ⛔ A self-erasing instrument, caught before it reported success, 6.2.2 Does the AFTER capture stay representative at `…005300`? Yes — and the overlap is one policy, 6.2 AFTER — and ⭐ a correction to F-AE0-6's MAGNITUDE, 6.3 Hot-subset tables — shape capture, 6. Before/after plan diffs — the acceptance evidence

### Community 1825 - "User Registration & Identity Management — phase record (archived)"
Cohesion: 0.25
Nodes (8): A reference, not a reading list, Backend State — the router, Maintenance rules, The four rules a gate CANNOT enforce, The seam axis, and why it is the seam and not the phase, When the gate reds, When you must touch it, Writing and refreshing a current-state block

### Community 1826 - "QA review — ADR 0136, deferred `staff_admin` sign-off"
Cohesion: 0.25
Nodes (8): Closes when, FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP — an empty-but-set `CASES` selects EVERY gate and takes the full-run branch, 🟠 FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN — the `authenticated`-executable DEFINER budget is 759 against a ceiling of 752, and six of the seven are unattributed — ✅ CLOSED 2026-09-08, 🟠 FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN — `CASES=""` is indistinguishable from `CASES` unset in the door arm, so a caller that captures the deriver's stdout without consuming its exit code gets a FULL sweep that writes the COMMITTED baseline, with the `exit 3 UNPROVEN` door unreachable (owner: backend; filed 2026-09-07 by `backend`, measured on `authz-writepath-baseline`) — ✅ CLOSED 2026-09-08, Relation, The mechanism, in the two harnesses' own lines, What was measured, Why it is worth a gate rather than a note

### Community 1827 - "ROUND 2 ADDENDUM — 2026-08-21"
Cohesion: 0.25
Nodes (8): A related hazard, kept here rather than in its own entry, Closes when, FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST — a hand table HEADER relocates while two docs say it stays, and MALFORMED has no case, N1 — the merge keeps hand ROWS in place and relocates their HEADER, N2 — the `MALFORMED` assertion is proven able to fire once, by hand, and nothing re-proves it, N3 — an INDENTED pseudo-table is a gate input protected by whitespace alone, and nothing asserts the whitespace survives the merge, Related, The findings — **two as filed 2026-09-07; three since 2026-09-08** (N3 added from unit WRITEPATH-BASELINE's QA re-review, observation O2)

### Community 1828 - "check-rules-staleness.mjs"
Cohesion: 0.38
Nodes (10): checkPopulation(), checkRule(), checkRulesDirExists(), main(), ADR-0186, parseFrontmatter(), readRuleText(), ROOT (+2 more)

### Community 1829 - "dsr.test.ts"
Cohesion: 0.25
Nodes (8): 0046 — Forward-compatible form capabilities (repeating groups, answer blocks, field confidentiality) + default values, Alternatives rejected, Consequences, Context, Decision, Definition-side additions (in this package), Explicitly NOT in scope (and why), The forward-compat contract — what each future feature will use, and what's left

### Community 1830 - "p3-case-print-mutation-audit.sh"
Cohesion: 0.33
Nodes (6): Item 2 — MAJOR-2 (reconciliation) — red/green record, Item 3 — MAJOR-3 (terminal verification failure) — ruling + record, Item 4 — ADR 0118 §10 predicate — record, Item 5 — kill switch — ruling + record, Item 6 — ADR 0118 §12, Resumption session 2026-08-13, part 2 (backend) — items 2–6 closed

### Community 1831 - "Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON)"
Cohesion: 0.25
Nodes (8): 2026-09-04 — backend: QA re-review N1–N6, 2026-09-04 — Record step (lead): PO approved at `fc33a497`; unit closed and merged, 2026-09-04 — unit opened (lead), Gate — read BARE, HARNESS-CRASH-SAFETY — progress record, Hub `## Current state` at closure — cut from the hub 2026-09-04 (ADR 0186 D8), Session log, What was NOT done, and why

### Community 1832 - "Amendment 7 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build time**): bulk creation is a COMPOSITION, and §A1.2's one-arm sentence does not open it"
Cohesion: 0.40
Nodes (4): AUTHZ Row-Door Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), UNSUPPORTED — no statement guard to open (NOT a verdict; still owed a keystone)

### Community 1833 - "0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text"
Cohesion: 0.25
Nodes (8): Follow-up notes, Lead decisions (B1 approval, 2026-07-05), Phase 15 — Quality Indicators (Indicadores de Qualidade), QA MINORs — all fixed pre-merge (2026-07-06), Spec realignment for MINOR-1 (tester-owned), Task ledger, Test gate — fix loop, What shipped

### Community 1834 - "0146 — The E2E gate harness must not report green while blind"
Cohesion: 0.33
Nodes (6): 4.1 Security / authorization (§A), 4.2 Does the fix work, and can the tests fail? (§B), 4.3 Records that verify (§C), 4.4 Frontend (§D), 4.5 Scope discipline (§E), 4 · VERIFIED CLEAN — with how

### Community 1835 - "Concluded § Now rotations — 2026 Q3"
Cohesion: 0.07
Nodes (28): 1 · C1a — the local PHI-disposal rehearsal — ✅ DISCHARGED, 2 · C2 Tier 1 — SIZED, and the split does not split, AE2 — affiliation/person tenancy (rotated from § Now, 2026-08-28), Concluded § Now rotations — 2026 Q3, § Now bullets concluded at AE1's Record step (rotated 2026-08-27), PDF·P3 (Printing Cases) — CONCLUDED, rotated from § Now 2026-08-25, Rotated 2026-08-24 — ADR 0136 (deferred `staff_admin` sign-off), at the Record step, Rotated 2026-08-24 — the ADR 0137 batch § Now bullet, all four items concluded (+20 more)

### Community 1836 - "DSR Slice 3 — build detail (rotated from PROGRESS.md § Now)"
Cohesion: 0.40
Nodes (5): 2 · The claim under attack — leg by leg, L1 — `entity_type`'s CHECK makes the predicate vacuous for 3 of 4 doors → **UPHELD, and stronger than claimed**, L2 — one writer, sixteen callers, none reads `cases.label` → **UPHELD; one supporting sentence is FALSE**, L3 — no notification title/body source is erased by any door → **UPHELD**, The strongest available counter-argument, and why it also fails

### Community 1837 - "FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)"
Cohesion: 0.04
Nodes (49): allows(), appliedFilters, footprint(), Row, tables, ADR-0133, ADR-0148, ADR-0163 (+41 more)

### Community 1838 - "PDF·P3 — catalog reconciliation of the authz sweep domain"
Cohesion: 0.40
Nodes (5): B1 — false ACL claim → **CLOSED, and the replacement claim verified independently**, B2 — stranded follow-up → **CLOSED by building the fix.** See §3., N1 — grep scope → ⛔ **NOT CLOSED. See B3 — the defect is live again.**, r2 · 2 — Part 1: my r1 findings, The plan's stale `disposeCasePhi`/`disposeEventPhi` sentence → **CLOSED**

### Community 1839 - "3 · The deviations — all three VERIFIED, including the one arguing for *less* gating"
Cohesion: 0.25
Nodes (8): 2026-09-06 — backend: the full run landed, step 10, ⛔ AN EXTERNAL REVERT, AND WHY IT COST NOTHING, PO Q1 — the `(ALL)` read-half work-list: EXACTLY FIVE, The CARRIED enumeration — 318 rows, of which only 32 are human decisions, The census consequence — the dry run's prediction was EXACT, ⭐ THE HEADLINE FINDING: 102 NOTICED, The merge, verified three ways, The run

### Community 1840 - "check-migration-set-local.mjs"
Cohesion: 0.38
Nodes (6): findTopLevelSetLocal(), FIXTURES, isInScope(), MIGRATIONS_DIR, SCOPE_FIXTURES, selfTest()

### Community 1841 - "phase-result-options.ts"
Cohesion: 0.25
Nodes (8): Collision conformance (S0 §E), Commits (branch `pre-pilot-release-s0`), Gate (CLAUDE.md §6) — all ✅ (human-approved 2026-07-14), Open follow-ups (non-blocking), RV2·R1 — Referrals v2 · Dialogue Core — completed-track record, SQLSTATE, Two runtime-caught fixes (both by the frontend's dev-server verification — pgTAP structurally couldn't), What shipped (R0 → R1)

### Community 1842 - "p0137-phi-door-mutation-audit.sh"
Cohesion: 0.40
Nodes (5): Frontend — clean on the things that usually are not, READ widened, WRITE did not — *read + measured*, The pgTAP keystones can fail — *measured by mutating the live catalog*, The widenings are correctly bounded — *measured, adversarially*, What I checked hardest, and what held

### Community 1843 - "ADR 0003 — pgTAP for database tests"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 1846 - "0011 — Position reorder via deferrable constraints + SQL swap RPCs"
Cohesion: 0.25
Nodes (8): 2026-09-07 — `backend`, RULING R23 applied: the escalation REMOVED, the predicate kept as a DETECTOR and proven able to fire; checklist re-earned; **the full run LAUNCHED**, ⚠ A THIRD self-inflicted instrument fault — kept as a witness, per R25, Both grant routes proven live ON A ROW — the disjunction is not half-decorative, Duration — re-derived from a TWO-POINT measurement, not an assumed intercept (R7), Proofs — every exit code read BARE, never through a pipe, never consumed by a `;` chain, ⭐ The detector fires on 0 of 107, so it was PROVEN able to fire (R23.5), THE RE-EARNED PRE-LAUNCH CHECKLIST (R12(a) — every item observed BARE), What was removed, and why the removal is not just deletion

### Community 1847 - "0013 — Fix form_versions INSERT RLS self-reference"
Cohesion: 0.40
Nodes (5): 0169 — the meeting-content recusal divergence is a time-boxed EXCEPTION, not a new rule, Consequences, Context — the follow-up's premise measured FALSE, Decision, The divergence, re-characterised (live catalog, head `20261003006800`)

### Community 1848 - "ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")"
Cohesion: 0.33
Nodes (4): A kill is CAUGHT — only where a harness has a SENTINEL, "DB silence" is the wrong ask, Hunting an open gate: ENUMERATE, never count, ⛔ Never kill a running sweep — it opens live gates, then restores them

### Community 1849 - "0084 — Bulk Case Creation ("Múltiplos casos")"
Cohesion: 0.40
Nodes (5): 0176 — The permission layer made real: three interfaces, a manifest countdown, and the re-key sequenced with AE5, Consequences, Context, Decision, Rejected alternatives

### Community 1850 - "ADR 0127 — standing rules get a path-scoped home, and a staleness gate"
Cohesion: 0.40
Nodes (5): ADR 0179 — One open follow-up register: the PROGRESS.md index is folded into the bodies, Consequences, Context, Decision, Gate consequences (`scripts/check-progress-doc.mjs`, gate 7)

### Community 1851 - "ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap"
Cohesion: 0.33
Nodes (6): ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap, Consequences, Context, Decision, Rejected, The two live doors that contradict Decision 1

### Community 1852 - "Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings"
Cohesion: 0.40
Nodes (5): ADR 0181 — Acceptance condition P1 bounds the INDEX PATH, not the `Seq Scan` node, Consequences, Context, Decision, Options rejected

### Community 1853 - "Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked"
Cohesion: 0.40
Nodes (5): 13.1 Function sites — 178, and the parts sum, 13.2 Policy sites — 65, zero residue, 13.3 Plane 4 (routes) — 34 surfaces, one orphan, already fixed, 13.4 ⭐ What the new rows say about the derivation that missed them, 13. Site→row reconciliation — ENUMERATION IS NOT MAPPING

### Community 1854 - "Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks"
Cohesion: 0.40
Nodes (5): 15.1 Read-shaped predicates consulting `staff_admin` — 8, all dispositioned, 15.2 ⭐ The fifth population: `app._audit_access_authorized` — the audited-sensitive-read register, 15.3 ⚠ What the register says about `sensitivity_ceiling`, feeding § 9's deferred half, 15.4 Result, 15. Read/write pairing — and a FIFTH declared population

### Community 1855 - "ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases"
Cohesion: 0.40
Nodes (5): 10.1 Ruling on the empty nested region — the hypothesis is disproven; the defect was mine, 10.2 Ruling on DC1 — both shapes, plus a dependency rule, 10.3 ⭐ P1, P2 and P3 — evaluated from run 2's committed artifact, 10.4 What this means for P5, and what it does not, 10. Run 2 (2026-09-02) — the rulings, and the structural verdict the artifact already held

### Community 1856 - "ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved"
Cohesion: 0.40
Nodes (5): 11.1 Ruling — the instrument is demonstrably alive, and DC1's verdict still stands, 11.2 The re-aim — DC1 becomes an attribution instrument, not just a detector, 11.3 The verdict table has still never executed, 11.4 Where the finding now stands, 11. Run 3 (2026-09-02) — DC1 ran, failed at 1.53×, and the failure is informative

### Community 1857 - "ai-detail-main.jsx"
Cohesion: 0.40
Nodes (5): 16.1 Why the §13.2 wording could not fail, 16.2 The replacement, 16.3 The checker, 16.4 Run 6 is re-decomposable but **NOT re-scorable** — a fresh run is owed, 16. P2 re-specified — a falsifiable bound with a committed checker (2026-09-03) — ADR 0183

### Community 1858 - "cases-views.jsx"
Cohesion: 0.25
Nodes (8): 2026-09-07 — unit opened (lead), 2026-09-08 — `backend`, rulings R40–R42 recorded; the section-vs-verdict census RE-DERIVED independently and widened from two files to the whole class, Follow-ups this turn, ⚠ LAUNCH ATTEMPT 1 ABORTED — a FOURTH instrument fault, and the most operationally dangerous, Mid-run checkpoints AS OBSERVED (filled in as the run proceeds), Recorded per R24/R25, settled without further work, Session log, ⛔ THE RESUME NOTE — this run OUTLIVES the agent that launched it

### Community 1859 - "⛔ AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**"
Cohesion: 0.40
Nodes (5): Increment B ✅ BUILT — SQL half, Increment B — TS half ✅ DONE (SQL half in flight), Regression this increment introduced, found and fixed by the lead, ⭐⭐ The finding that outlives this increment: a CAPABILITY-bounded sibling census, ⛔ Three honesty notes that must not be lost

### Community 1860 - "5 · The carry — a plain answer"
Cohesion: 0.40
Nodes (5): ✅ Increment F COMPLETE — `profiles.home_organization_id` is DROPPED, Integration gates — lead-run, exit codes captured directly, ⭐ M11 re-verified AFTER the drop, same probes, same preconditions, Owed, and deliberately not done in the integration window, ⚖ RULING — `scripts/door-sweep-cases.sh` exited **1** with ZERO cases

### Community 1861 - "r2 — ✅ APPROVED"
Cohesion: 0.22
Nodes (9): ⭐ §6 step 2 EARNED — `e2e:prod` GATE GREEN in a SINGLE run, AE4.9 D6 + D5 — the re-key, the enforcement manifest, and the §6 artifact earned, 2026-09-02 (lead + 4 agents), AE4 dead ends — the MECHANISMS, promoted verbatim from the handoff 2026-09-02, AE4 — the authz catalog, and `staff_admin` substituted end to end (ADR 0155 D7), Dead ends, Gates — exit codes read DIRECTLY from files, never through a pipe, Rotated from PROGRESS.md § Now 2026-09-02 — ten concluded spans of the ADR 0155 bullet, What the build BROKE and how it was closed — the increment's most important finding (+1 more)

### Community 1862 - "claude-md-review-signal.mjs"
Cohesion: 0.40
Nodes (5): main(), ADR-0127, QUEUE, SIGNALS, userTexts()

### Community 1863 - "test-netstat-listener-pids.sh"
Cohesion: 0.25
Nodes (8): 2026-09-08 — `backend`, QA fix loop iteration 1 of ≤5 (`docs/reviews/writepath-baseline-review.md`: CHANGES REQUESTED, B1–B4 blocking + N1–N5), B1 — a COVERED row inside the `## BLIND` table. Fixed, and its MECHANISM measured, B2 — five new off-allowlist BLINDs, disclosed (⛔ never allowlisted), B3 — the direction census was wrong, and it inverted its own conclusion, B4 — the baseline no longer denies being the audit's result, Gates for this turn, read BARE, N1–N5, R39 — the durable finding, filed rather than papered over

### Community 1864 - "page.tsx"
Cohesion: 0.33
Nodes (5): BACKEND-STATE-SERVICE-ROLE-SEAM — QA review, Could not verify, Findings, Verdict, Verification log (command → result)

### Community 1865 - "DM follow-up triage — DVF 1:1 + the draft-print delete guard (2026-08-18; DM-FUP TRIAGE #2/#4/#8b; migrations `20260928000600`–`…000700`, **2**; pgTAP `312` 77→80 · `328` 128→130; **LOCAL ONLY — not pushed**)"
Cohesion: 0.25
Nodes (8): 2026-09-08 — `backend`, THE FULL RUN COMPLETED. 120 of 120 swept, bare rc 1 (DIRTY), CARRIED, other dispositions, Findings filed from the run, R19 — ERROR triage. All 3 are ONE defect, measured rather than inferred from the family name, R20 — the 13 rows Batch 2 retired from the door arm: **13 PRESENT, 0 missing, all COVERED**, THE CARRIED ENUMERATION — 45 rows, with dispositions, The run's own health — the things that voided the door arm's run 1, ⭐ The two `11`s are NOT the same 11 — and that is the interesting part

### Community 1866 - "REMOTE CENSUS 2026-08-18 (read-only, linked `azkbbhskturikxpgmafq`) — **the production DB is EMPTY, and it was emptied by TRUNCATE/reset semantics, not by deletes**"
Cohesion: 0.25
Nodes (8): M-1 (mandatory, pre-commit, test-only, no re-review), R-1 · The harness, re-run by someone who didn't write it — ✅ **16/16 reproduces, and RED means RED**, R-2 · B1 — ✅ **the fix is REAL, not relocated**, R-3 · B2 — ✅ **CONFIRMED DEAD, both directions**, on my own seed probe, R-4 · ⛔ **Is 16 the population, or a floor?** — **A FLOOR. The answer is 17.**, R-5 · The A22 re-shape — ✅ **no over-reach; the shape is GENUINELY REACHABLE**, R-6 · The gate — ✅ **independently confirmed**, RE-VERDICT: ✅ **APPROVED** — with **one mandatory pre-commit item (M-1), test-only**

### Community 1868 - "ADR 0006 — Supabase API key scheme vs. env var naming"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 1870 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.33
Nodes (6): Could-not-verify (work items for the lead), Findings, Overall assessment, QA Review — CAN-MANAGE-PROFESSIONAL-SELF-CHECK (pre-AE5 remediation Batch 8), Scope and method, Verified-facts list

### Community 1871 - "0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns"
Cohesion: 0.17
Nodes (9): ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only, Context, Decision, Rejected alternatives, Cross-phase follow-ups (carried, NOT part of Phase 13), Lead notes, Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail), Tasks (+1 more)

### Community 1872 - "ai-detail-app.jsx"
Cohesion: 0.03
Nodes (59): ADR 0014 — Sanitizing Markdown renderer, Consequences, Context, Decision, Rationale, 0145 — The print path's Markdown is stricter than the screen's: no `<img>` inside Gotenberg, Alternatives rejected, Consequences (+51 more)

### Community 1873 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 1874 - "🛑 DM5 gate step 4 — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**"
Cohesion: 0.40
Nodes (5): 4.8 `form_responses.form_answer_risk_matrix`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 1876 - "page.tsx"
Cohesion: 0.29
Nodes (6): ADR 0127 — standing rules get a path-scoped home, and a staleness gate, Amendment 1 — volume bounds, and the first retirement (2026-08-19), Amendment 2 — retirement has a precondition, and "too broad" has four exits (2026-08-19), Amendment 3 — the instrument was installed after the thing it measures (2026-08-19), Amendment 4 — MEASURED: rules fire, in a fresh session (2026-08-19), Amendment 5 — second measurement: SOURCE globs fire too (2026-08-19)

### Community 1878 - "Review CLAUDE.md against queued session signals"
Cohesion: 0.29
Nodes (6): ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved, Consequences, Context, Decision, Rejected alternatives, and why, Size — measured 2026-08-22, re-derive before building

### Community 1879 - "ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts"
Cohesion: 0.29
Nodes (7): 1. Environment (all server-only), 2. The three size ceilings, 3. Callback reachability, 4. Key rotation, 5. Audio custody (D2), 6. Pre-enable checklist, Runbook — meeting audio → generated ata (`audio_minutes`)

### Community 1880 - "ADR 0122 — A case-read arm at the referral freeze door (FUP-DM4-RECUSAL)"
Cohesion: 0.50
Nodes (4): A1.1 — OPEN-1: no backfill (confirms the plan's recommendation), A1.2 — OPEN-2: bulk case creation opens under the **same** `create_cases` key, Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk, Consequences

### Community 1881 - "Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk"
Cohesion: 0.50
Nodes (4): A8.1 — Amendment 2's PHI gate was **structurally unreachable** the moment the arm was cut, and was deleted, A8.2 — the coverage that was believed to exist did not, A8.3 — consequences checked, not assumed, Amendment 8 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): `create_case` loses its `app.is_admin()` arm, and Amendment 2's separate PHI gate collapses with it

### Community 1882 - "Amendment 8 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): `create_case` loses its `app.is_admin()` arm, and Amendment 2's separate PHI gate collapses with it"
Cohesion: 0.50
Nodes (4): 0149 — An org_admin reads the hospital-tier audit chain, Consequences, Context, Decision

### Community 1883 - "5.2 `referral_context_versions`"
Cohesion: 0.50
Nodes (4): 10. Related Records: `action_item_related_records`, Example, Responsibility, Suggested Schema

### Community 1884 - "Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)"
Cohesion: 0.50
Nodes (4): 11. Updates: `action_item_updates`, Example Timeline, Responsibility, Suggested Schema

### Community 1885 - "Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure)"
Cohesion: 0.50
Nodes (4): 12. Status History: `action_item_status_history`, Questions This Enables, Responsibility, Suggested Schema

### Community 1886 - "2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING)"
Cohesion: 0.29
Nodes (7): 1.1 The Ata editor — `src/components/meetings/meeting-minutes-editor.tsx`, 1.2 The meeting detail page — `src/app/o/[org]/c/[commission]/meetings/[meetingId]/page.tsx`, 1.3 Meetings list — `src/components/meetings/meetings-list.tsx` (F4), 1.4 canEdit — confirmed identical to the audio predicate, no new prop needed, 1.5 Meeting dialogs — shape F2 must match, 1.6 Flag-gated UI rendering pattern, 1. Survey of what exists

### Community 1887 - "mutate.mjs"
Cohesion: 0.50
Nodes (3): [file, mode], MODES, src

### Community 1888 - "An applied migration is NEVER edited — forward-only, additive"
Cohesion: 0.50
Nodes (4): 13. Follow-Ups: `action_item_follow_ups`, Example, Responsibility, Suggested Schema

### Community 1890 - "Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)"
Cohesion: 0.50
Nodes (4): 14. Evidence: `action_item_evidence`, Implementation Note, Responsibility, Suggested Schema

### Community 1891 - "1 · The P0s — CONFIRMED DEAD, behaviourally"
Cohesion: 0.50
Nodes (4): 15. Reviews: `action_item_reviews`, Example Workflow, Responsibility, Suggested Schema

### Community 1893 - "ActionItemForm"
Cohesion: 0.50
Nodes (4): 16. Checklist Items: `action_item_checklist_items`, Example, Responsibility, Suggested Schema

### Community 1895 - "BUG-E2EISO-002 — rotated from PROGRESS.md 2026-08-03 (RESOLVED)"
Cohesion: 0.50
Nodes (4): 17. Dependencies: `action_item_dependencies`, Example, Responsibility, Suggested Schema

### Community 1896 - "BUG-FF4-001 (rotated from PROGRESS.md at the FF-4 Record, 2026-08-03) — RESOLVED"
Cohesion: 0.50
Nodes (4): 23. Status Transition Handling, Function Responsibilities, Recommended Function, Why RPC Is Preferred

### Community 1897 - "Rotated 2026-08-23 — BUG-PHASE-RESULT-PREVIEW-1 (filed and RESOLVED the same session)"
Cohesion: 0.50
Nodes (4): 26. Recommended User Interface Mapping, Action Item Detail Page, Basic Creation Form, Suggested UI Sections

### Community 1898 - "↩ Rotated from PROGRESS.md 2026-08-19 — the live § Bug Log "Closed" subsection, VERBATIM"
Cohesion: 0.50
Nodes (4): 6. Core Table: `action_items`, Important Notes, Responsibility, Suggested Schema

### Community 1899 - "Rotated 2026-08-21 — the DSR remediation P0, RESOLVED"
Cohesion: 0.50
Nodes (4): 8. Urgency Model, Example Urgency Levels, Responsibility, Suggested Schema

### Community 1900 - "build-fake-repo.sh"
Cohesion: 0.50
Nodes (4): 11.1 `committee_meetings`, Design Justification, Purpose, Suggested Schema

### Community 1901 - "RelationshipToCase"
Cohesion: 0.50
Nodes (4): 11.2 `meeting_agenda_items`, Design Justification, Purpose, Suggested Schema

### Community 1902 - "SKILL.md"
Cohesion: 0.50
Nodes (4): 11.3 `meeting_case_discussions`, Design Justification, Purpose, Suggested Schema

### Community 1903 - "SKILL.md"
Cohesion: 0.50
Nodes (4): 11.4 `case_votes`, Design Justification, Purpose, Suggested Schema

### Community 1906 - "UI/layout fixes batch (frontend + backend)"
Cohesion: 0.50
Nodes (4): 14.1 `case_access_grants`, Design Justification, Purpose, Suggested Schema

### Community 1907 - "1 · Verification of the three NEW findings"
Cohesion: 0.50
Nodes (4): 14.2 `case_conflict_declarations`, Design Justification, Purpose, Suggested Schema

### Community 1908 - "3 · NEW findings the inventory missed"
Cohesion: 0.50
Nodes (4): 14.3 `case_recusals`, Design Justification, Purpose, Suggested Schema

### Community 1909 - "V-6 · What M1 must cover — the authoritative fix set"
Cohesion: 0.50
Nodes (4): 16.1 `mm_case_details`, Design Justification, Purpose, Suggested Schema

### Community 1910 - "W-6 · ⭐ THE AUTHORITATIVE, ORDERED M1 SCOPE — `backend` builds from THIS"
Cohesion: 0.50
Nodes (4): 16.2 `mm_contributing_factors`, Design Justification, Purpose, Suggested Schema

### Community 1911 - "W-2 · ⛔→✅ **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**"
Cohesion: 0.50
Nodes (4): 16.3 `mm_preventability_assessments`, Design Justification, Purpose, Suggested Schema

### Community 1912 - "ADR 0004 — Sign-off enforcement feature flag"
Cohesion: 0.25
Nodes (8): Basis for APPROVED, Class-wide measurement (`45f5880a`) — independently confirmed, including the lead's own correction, Could not verify — carried forward, still work items at APPROVED, Fault 9's blast radius — checked, and my instrument was proven able to see it, Gates I ran myself this round, New observations this round, Round 2 — RE-REVIEW, 2026-09-08 @ `45f5880a`, What I re-measured, and what it returned

### Community 1913 - "ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)"
Cohesion: 0.50
Nodes (4): 17.1 `ethics_case_details`, Design Justification, Purpose, Suggested Schema

### Community 1914 - "ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke"
Cohesion: 0.50
Nodes (4): 17.3 `ethics_case_findings`, Design Justification, Purpose, Suggested Schema

### Community 1915 - "2 · Verification of the MOVED / FALSE claims"
Cohesion: 0.50
Nodes (4): 17.5 `ethics_case_notifications`, Design Justification, Purpose, Suggested Schema

### Community 1916 - "door-sweep-cases.sh"
Cohesion: 0.42
Nodes (7): extract_one(), finish(), rule(), say(), scope_line(), door-sweep-cases.sh script, show()

### Community 1918 - "date-picker-clear-affordance.test.tsx"
Cohesion: 0.53
Nodes (4): authoredNamesInsideTrigger(), expectsHasADate(), interactiveInsideTrigger(), trigger()

### Community 1919 - "ADR 0002 — Admin claim via custom access token hook"
Cohesion: 0.50
Nodes (4): 17.6 `ethics_hearings`, Design Justification, Purpose, Suggested Schema

### Community 1920 - "ADR 0005 — `visible_when` condition shape (v1)"
Cohesion: 0.50
Nodes (4): 17.7 `ethics_appeals`, Design Justification, Purpose, Suggested Schema

### Community 1921 - "ADR 0009 — Local JWT verification for the auth gate & identity"
Cohesion: 0.50
Nodes (4): 26. Suggested Naming Convention, Application Code, Backend / Database, UI

### Community 1922 - "0010 — Denormalize email onto public.profiles"
Cohesion: 0.50
Nodes (4): 5.4 `case_workflow_templates`, Design Justification, Purpose, Suggested Schema

### Community 1923 - "ADR 0014 — Sanitizing Markdown renderer"
Cohesion: 0.50
Nodes (4): 5.6 `case_status_history`, Design Justification, Purpose, Suggested Schema

### Community 1924 - "ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)"
Cohesion: 0.22
Nodes (9): 3.0 What each SQL function mirrors — the mapping is deliberate, not 1:1, 3.1 The preamble (mirrors `authorizePersonScopedAdmin`), 3.2 D2 tier flag — checked FIRST, 3.3 Footprint — ACTIVE only, both legs required, 3.4 Empty footprint — pinned explicitly, never derived, 3.5 The two bounds, 3.6 Which branch each capability mirrors — the summary the review asked for, 3.7 Shared vectors (RECOMMENDED, lead's call whether it lands in AE1.3) (+1 more)

### Community 1925 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.25
Nodes (8): BLOCKER — RESOLVED, Code quality / hygiene, Non-blocking observations (address opportunistically), QA-B-1 — pgTAP `189` disposal keystone (was 2 red; now green) — RESOLVED (`693ea60`), QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`, Requirements coverage — ADR 0052 deliverables, Security / RLS findings, Verdict: **APPROVED** (2026-07-03; was CHANGES REQUESTED, cleared same day)

### Community 1926 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.25
Nodes (8): 1 — D7's "retaining a forward rollback migration" is retracted (PA-F9), 2 — D7's catalog-authority claim is bounded, and the binding mechanism is specified (PA-F1), 3 — G1's pilot cutline gains one item, and gate records gain a qualifier (PA-F12; PO 2026-08-27), 4 — Rulings that bind the plan without amending 0155 (PO 2026-08-27), ADR 0162 — Plan-audit corrections to the authorization-evolution program: rollback artifact, catalog binding, pilot-gate scope, and four PO rulings, Consequences, Context, Decisions

### Community 1927 - "ADR 0022 — Cross-committee case referrals (linked cases)"
Cohesion: 0.50
Nodes (4): 6.1 `participants`, Design Justification, Purpose, Suggested Schema

### Community 1928 - "ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)"
Cohesion: 0.50
Nodes (4): 6.3 `professional_profiles`, Design Justification, Purpose, Suggested Schema

### Community 1929 - "ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry"
Cohesion: 0.50
Nodes (4): 7.1 `case_assignments`, Design Justification, Purpose, Suggested Schema

### Community 1930 - "0058 — Derived quality-indicator measurement compute (the parity lock)"
Cohesion: 0.50
Nodes (4): 8.1 `form_template_case_types`, Design Justification, Purpose, Suggested Schema

### Community 1931 - "0067 — Lint gate scope & policy (restore a meaningful `npm run lint`)"
Cohesion: 0.50
Nodes (4): 9.2 `case_document_access_grants`, Design Justification, Purpose, Suggested Schema

### Community 1932 - "0071 — Pre-pilot release scope expansion"
Cohesion: 0.50
Nodes (4): 1.1 Environment inspected, 1.2 Authoritative evidence, 1.3 Supabase operational facts that constrain the design, 1. Audit boundary and method

### Community 1933 - "ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split"
Cohesion: 0.25
Nodes (7): Closes when, FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE, Related, The measured population — 296 sites across 60 of 262 files, The mechanism, The WORK-LIST — 23 measured sites, dated 2026-09-07 (PO ruling on the NOTICED class), Why it is a real class and not a one-off

### Community 1934 - "0076 — Notifications (S1·N): pilot scope — prove one vertical deep"
Cohesion: 0.50
Nodes (4): 5.9 `referral_case_links`, Columns, Design rationale, Suggested relationship types

### Community 1935 - "0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1"
Cohesion: 0.50
Nodes (4): 13.1 `interview_statements`, 13. Statements, Design rationale, Provenance requirement

### Community 1936 - "ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended)"
Cohesion: 0.50
Nodes (4): 16.1 `interview_documents`, 16. Document Integration, Design rationale, Primary document rule

### Community 1937 - "0117 — DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`"
Cohesion: 0.50
Nodes (4): 19.1 `interview_status_history`, 19.2 Platform audit requirements, 19. Status History and Audit, Design rationale

### Community 1938 - "ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement"
Cohesion: 0.50
Nodes (4): 22.1 General rule, 22.2 Different content may have different retention periods, 22.3 Legal hold, 22. Retention, Deletion, and Legal Hold

### Community 1939 - "ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button"
Cohesion: 0.50
Nodes (4): 31.1 Expected access patterns, 31.2 Transcript scale, 31.3 RLS performance, 31. Performance Considerations

### Community 1940 - "ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write"
Cohesion: 0.29
Nodes (7): 6.3 Core model, Grant ceilings, Permissions and roles, Principals, Resources, explicit grants, and restrictions, Role assignments, Scopes

### Community 1941 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.50
Nodes (4): 11.1 `evaluation_targets`, 11.2 Continuity keys, 11.3 Rationale for explicit polymorphism, 11. Typed evaluation targets

### Community 1942 - "AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001 — completion record"
Cohesion: 0.50
Nodes (4): 18.1 `evaluation_findings`, 18.2 Explicit join tables, 18.3 Escalation policy, 18. Findings and escalation

### Community 1943 - "DM follow-up triage — 2026-08-18 (session narrative, rotated)"
Cohesion: 0.50
Nodes (4): 22.1 Optimistic locking, 22.2 Assignment and claim, 22.3 Offline drafts, 22. Concurrency and offline behavior

### Community 1944 - "ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE"
Cohesion: 0.50
Nodes (4): 26. Example: daily patient infection surveillance, Next-day initialization, Prior evaluation, Program

### Community 1945 - "QA Review — S1·N Notifications (Phase 20)"
Cohesion: 0.50
Nodes (4): 3.1 Existing form engine responsibilities, 3.2 New evaluation domain responsibilities, 3.3 Integration boundary, 3. Bounded contexts and ownership

### Community 1946 - "referrals.test.ts"
Cohesion: 0.25
Nodes (8): 11. Open questions for the lead, 1. The invocation model — `_for` doors, service-role only, 2. The surface — nine converted sites → six doors (12 functions) + one predicate, 5. Audit — exactly once, PHI-free, 7. Invite-flow partial failure — the new ordering, stated, 8. Migrations, tests, numbering, 9. `check-memberships-door.mjs` (AE1.4) — what these conversions must look like, AE1.3 — the nine person-authority door conversions: DESIGN

### Community 1947 - "ADR 0020 — Dashboard-countable responses: case-phase exclusion"
Cohesion: 0.25
Nodes (8): 12. LEAD RULINGS — 2026-08-27 (these answer §11; the design is APPROVED to build), R0 — F-F restructure: **APPROVED**, including both "no entry" rulings, R1 — F-A: **Option A** (reorder `registerUser`; no special inviter predicate), R2 — F-C: **APPROVED — ADR 0161 `Amends: 0133`, plus the header rewrite, same increment**, R3 — Audit: **follow the platform precedent (`actor_id` null, actor in metadata) — AND file a FUP**, R4 — §3.7 shared TS/SQL vectors: **land them in AE1.3**, R5 — pgTAP numbering: **384–386 confirmed, no collision**, R6 — §6.3 standing rule: **admit it, in the same increment as the doors — not before**

### Community 1948 - "ADR 0021 — Due dates for case phases"
Cohesion: 0.50
Nodes (4): 7.1 `patient_encounters`, 7.2 `bed_assignments`, 7.3 Rationale, 7. Patient encounters and occupancy

### Community 1949 - "ADR 0023 — Configurable per-committee case status"
Cohesion: 0.25
Nodes (8): 4.1 SQLSTATE allocation — derived from the catalog, 4.2 `public.finalize_invited_person_for`, 4.3 `public.update_person_fields_for`, 4.4 `public.set_person_active_for`, 4.5 `public.suspend_person_for`, 4.6 `public.upsert_credential_for`, 4.7 `public.delete_credential_for`, 4. The six doors

### Community 1950 - "ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes"
Cohesion: 0.50
Nodes (4): 9.1 `evaluation_cycles`, 9.2 State transition invariants, 9.3 Rationale, 9. Evaluation cycles

### Community 1951 - "ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures)"
Cohesion: 0.25
Nodes (7): BUG-FF4-001 — a cleared default re-seeded on resume (RESOLVED), FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03), Gate results, Non-blocking items carried out of this phase, PO rulings (2026-08-03), Tasks, What this phase cost, and what it is worth remembering

### Community 1952 - "ADR 0027 — Case Timeline (read-only event aggregation, two layouts)"
Cohesion: 0.50
Nodes (4): 14.1 Case access grants, 14.2 Grant permissions, 14.3 Case access restrictions, 14. Explicit case access

### Community 1953 - "ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target"
Cohesion: 0.50
Nodes (4): 26.1 Authorization audit events, 26.2 Append-only behavior, 26.3 Audit actor context, 26. Auditing

### Community 1954 - "ADR 0101 — The role→landing guard is catalog-derived, not remembered"
Cohesion: 0.50
Nodes (4): 36.1 Organization membership, 36.2 Hospital and committee memberships, 36.3 Role assignments, 36. Status transitions

### Community 1955 - "ADR 0102 — `p_expires_at` is a real setter on both grant paths (extend-on-regrant)"
Cohesion: 0.50
Nodes (4): 9.1 Permission catalog, 9.2 Role definitions, 9.3 Role permissions, 9. Permission and role catalog

### Community 1956 - "ADR 0113 — Referral-module door RETURN shape: the class, not the instance"
Cohesion: 0.50
Nodes (4): 11. Table: `document_sensitive_metadata`, DDL, Design rationale, Purpose

### Community 1957 - "0147 — Masked CPF on the person detail rail"
Cohesion: 0.29
Nodes (7): 7. The typed contract (contract-first — signatures only), ⚠ PROCESS NOTE — a contract review must TRACE ONE FULL CALL CHAIN, `src/lib/controlled-documents/actions.ts` (new / replaced), `src/lib/controlled-documents/types.ts` (domain — delta), `src/lib/documents/types.ts` (core — delta), `src/lib/ethics/actions.ts` (condition 5 — plumbing only, no UI), `src/lib/queries/controlled-documents.ts`

### Community 1958 - "0148 — Ever-held affiliation as the person-read boundary"
Cohesion: 0.50
Nodes (4): 12. Table: `document_versions`, DDL, Design rationale, Purpose

### Community 1959 - "13.1 `interview_statements`"
Cohesion: 0.50
Nodes (4): 13. Table: `file_assets`, DDL, Design rationale, Purpose

### Community 1960 - "messages.ts"
Cohesion: 0.50
Nodes (4): 15. Table: `document_pages`, DDL, Design rationale, Purpose

### Community 1961 - "ADR 0123 — Discarding a draft that has emitted documents"
Cohesion: 0.50
Nodes (4): 16. Table: `document_ocr_extractions`, DDL, Design rationale, Purpose

### Community 1962 - "20. Reminder Rules"
Cohesion: 0.50
Nodes (4): 17. Table: `document_redactions`, DDL, Design rationale, Purpose

### Community 1963 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 18. Table: `document_resource_links`, DDL, Design rationale, Purpose

### Community 1964 - "membership-conflict.ts"
Cohesion: 0.50
Nodes (4): 19. Table: `document_subjects`, DDL, Design rationale, Purpose

### Community 1965 - "⬛ FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ✅ **CONCLUDED 2026-08-24 by PO ruling: EXPECTED, and in line with platform specifications.** Filed and closed the same day."
Cohesion: 0.50
Nodes (4): 21. Table: `security_groups`, DDL, Design rationale, Purpose

### Community 1966 - "⬛ FUP-AFF2-REGISTRATION-HAS-NO-START-DATE — ✅ **RESOLVED 2026-08-26** (owner: backend then frontend; AFF4 **F4**, ADR 0151 **D13**)"
Cohesion: 0.50
Nodes (4): 22. Table: `security_group_members`, DDL, Design rationale, Purpose

### Community 1967 - "⬛ FUP-AFF2-UPDATE-PROFILE-AFFILIATION-HALF-IS-DEAD — ✅ **RESOLVED 2026-08-26** (owner: backend + PO; AFF4, ADR 0151 **D15**)"
Cohesion: 0.50
Nodes (4): 23. Table: `document_access_grants`, DDL, Design rationale, Purpose

### Community 1968 - "⬛ FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — ✅ **RESOLVED 2026-08-26** (owner: backend; AFF4 pre-step P3)"
Cohesion: 0.50
Nodes (4): 24. Table: `document_effective_permissions`, DDL, Design rationale, Purpose

### Community 1969 - "⬛ FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY — ✅ **RESOLVED 2026-08-26** (owner: backend/lead; AFF4 pre-step P2)"
Cohesion: 0.50
Nodes (4): 25. Table: `document_access_requests`, DDL, Design rationale, Purpose

### Community 1970 - "⬛ FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY — ✅ **RESOLVED 2026-08-26** (owner: frontend; AFF4 **F1**, ADR 0151 **D17**)"
Cohesion: 0.50
Nodes (4): 26. Table: `document_upload_sessions`, DDL, Design rationale, Purpose

### Community 1971 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 27. Table: `document_ingestion_jobs`, DDL, Design rationale, Purpose

### Community 1972 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 28. Table: `document_access_audit_events`, DDL, Design rationale, Purpose

### Community 1973 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 29.1 Table: `document_retention_policies`, 29.2 Table: `document_lifecycle_events`, 29. Retention and Lifecycle Tables, Design rationale

### Community 1974 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 2.1 Functional goals, 2.2 Security goals, 2.3 Product goals, 2. Design Goals

### Community 1975 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 33.1 Bucket policy, 33.2 Object path format, 33.3 Signed URL access flow, 33. Storage Strategy

### Community 1976 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 36.1 File upload questions, 36.2 Recommended relationships, 36.3 Design rationale, 36. Integration With Forms

### Community 1977 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 37.1 Case-linked documents, 37.2 Case access versus document access, 37.3 Design rationale, 37. Integration With Cases

### Community 1978 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 42. Minimal Viable Implementation Plan, Phase 1: Core secure document storage, Phase 2: Scanned document processing, Phase 3: Advanced compliance

### Community 1979 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 3.1 Case capabilities, 3.2 Meeting capabilities, 3.3 Capability sources, 3. Authorization vocabulary

### Community 1980 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 6.1 Required functions, 6.2 Security-definer posture, 6.3 RLS policy shape, 6. Central authorization interface

### Community 1981 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 7.1 Classification, 7.2 Minimum necessary, 7.3 Restricted PHI, 7. PHI boundary

### Community 1982 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 8.1 Audit events, 8.2 Deactivation and suspension, 8.3 Expiry and revocation, 8. Audit and lifecycle requirements

### Community 1984 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 11.1 Submit referral transaction, 11.2 Send message transaction, 11.3 Resolve referral transaction, 11.4 Reopen referral transaction, 11. Domain Services and Transaction Boundaries

### Community 1985 - "loading.tsx"
Cohesion: 0.29
Nodes (6): ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke, Consequences, Context, Decision, Residual (accepted; not blocking pre-pilot), Two rejected fixes

### Community 1986 - "loading.tsx"
Cohesion: 0.29
Nodes (8): ADR-0052, addPqsMember(), MESSAGES, removePqsMember(), revalidateNsp(), setPqsRcaDueWindow(), ADR-0052, ADR-0102

### Community 1987 - "loading.tsx"
Cohesion: 0.29
Nodes (7): ADR 0200 — A predicate parameterised on a principal must answer about that principal, and a narrowing can remove the last reader of the parameter, Amendment to ADR 0190 — FINDING (1) is decided on RESOLVABLE targets, per file, Consequences, Considered options, Context, Decision, Problem

### Community 1988 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 0209 — The ACT hat is a DOOR-level term on the professional-profile read door, evaluated before the arms, Consequences, Considered and held: ADR 0208 D4's empty `search_path` (2026-09-11, QA finding M1), Considered options, Context, Decision, Problem

### Community 1989 - "loading.tsx"
Cohesion: 0.50
Nodes (4): 3.1 · The three changes verified, 3.2 · Falsification probes — I built four, all inside the suite's own transaction, 3.3 · The t33-placement argument holds — I checked the conjunction rather than the conclusion, r3 · 3 — B4 · CLOSED, and the fix is proven in both directions

### Community 1990 - "loading.tsx"
Cohesion: 0.50
Nodes (4): ⚠ N12 — the build's correction of my r2 finding is itself wrong, and its own comment contradicts it two sentences later, ⭐ N13 — t7 asks `memberships`; the door asks `has_role`, which is `memberships` **and the caller's active hat**. Of the three commissions the anchor may legally select, one is refused., ⚠ N14 — the "grantable → granted" fix landed in the right place, but in **one of three** copies, r3 · 4 — Findings (all non-blocking)

### Community 1992 - "loading.tsx"
Cohesion: 0.29
Nodes (7): Closes when, 🟠 FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP — `CASES=""` (set but EMPTY) selects EVERY gate and takes the full-run branch that rewrites the committed baseline — which is exactly what `$(bash scripts/door-sweep-cases.sh <base>)` yields when the deriver exits 1 FINDING (owner: lead; filed 2026-09-07 by `backend`, measured by the `lead` on the ENFORCEMENT-MANIFEST tip gate) — ✅ CLOSED 2026-09-08, FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD — a closure archives the body but DELETES the entry, so the field survives only in git, Related, The measurement, The rule, and what actually happens, Why it matters

### Community 2006 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 17. Suggested Repository and Service Boundaries, Application layer, Domain layer, Infrastructure layer, Presentation layer

### Community 2008 - "loading.tsx"
Cohesion: 0.50
Nodes (4): BUG-ACT-ACL-1 — RESOLVED (migration `20260918003100`, keystone `320`), BUG-ACT-EXPIRY-1 · BUG-ACT-ACL-1 · BUG-VACUOUS-ASSERT-1 — RESOLVED 2026-08-10, BUG-ACT-EXPIRY-1 — RESOLVED (migration `20260918003000`, keystones `318` + `320`), BUG-VACUOUS-ASSERT-1 — RESOLVED for its 4 confirmed instances (`e2e/phase22-referrals.spec.ts`)

### Community 2009 - "loading.tsx"
Cohesion: 0.50
Nodes (4): ✅ BUG-AE47C-LINKAGE-001 — rotated from PROGRESS.md 2026-09-02 (closed at rotation, both casualties fixed and tester-verified), 🔴 BUG-MEUSDADOS-HOSPITAL-NAME-001 — ✅ **FIXED** (`843329f5`), PO ruled remedy A, 🔴 BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY — ✅ **FIXED** (`d38493db`), ⬛ Rotated from PROGRESS.md 2026-08-31 — two bugs CLOSED in one batched increment

### Community 2010 - "loading.tsx"
Cohesion: 0.29
Nodes (7): 4.1 `form_responses.form_submissions`, Design Reasoning, Important Columns, Purpose, Relationships, Suggested Table, Suggested Type

### Community 2011 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 2026-09-11 — approved; Record step (lead), 2026-09-11 — gates, QA r1 APPROVED, awaiting human approval (lead), 2026-09-11 — unit opened on the PO's "Let's solve"; the claim re-measured; the three halves of the clause built (lead), DOOR-SWEEP-ARM-LABEL-CORRECTION — progress record, Session log

### Community 2012 - "loading.tsx"
Cohesion: 0.29
Nodes (7): Findings and disposition, Open items, Process / Case / Phase / Narrative — database integrity audit, Three audit recommendations the system disproved, Verdict, Verification, What only the gates caught

### Community 2013 - "loading.tsx"
Cohesion: 0.29
Nodes (7): Blockers, Current state, Done since start, DOOR-SWEEP-DERIVER — progress record, In progress, Next, Objective

### Community 2016 - "ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions"
Cohesion: 0.29
Nodes (7): 0114 — Document model redesign: documents, versions, file objects, securable resources, Amendment 1 (2026-08-13) — the per-document confidentiality ceiling, Amendment 2 (2026-08-13) — the ethics document seams join Wave B, Consequences, Context, Decisions, Open items (owned, not forgotten)

### Community 2017 - "ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got"
Cohesion: 0.60
Nodes (5): InterviewLifecycleActions(), cancelInterview(), concludeInterview(), reopenInterview(), runLifecycle()

### Community 2018 - "cases-views.jsx"
Cohesion: 0.50
Nodes (4): 32. Implementation Phases, Phase 1 — Essential Interview workflow, Phase 2 — Structured investigation, Phase 3 — External portal and automation

### Community 2019 - "0. Findings first — the six things that do not survive contact with the code"
Cohesion: 0.33
Nodes (6): 0. Findings first — the six things that do not survive contact with the code, F-A — `finalize_invited_person_for` **cannot** mirror `personScopeAllows`. Doing so breaks every hospital_admin registration., F-B — the plan's "authority checked **before** existence" is not literally achievable for these doors, and the correct rule is different., F-C — `src/lib/users/person-scope.ts` carries an explicit prohibition that AE1.3 retires. It must be retired **in writing**, in the same increment., F-D — "nine doors" is "nine **conversions**", across **six** new `public` doors., F-E — `guard_profile_privileged_columns` does **not** block the doors, *because* the doors are service-role-only. That is load-bearing and must be pinned, not assumed.

### Community 2020 - "10. Arm domains — and **F-F, the finding that reshaped this design**"
Cohesion: 0.33
Nodes (6): 10.1 The design's answer — put the DECISION in a swept object, and keep the shells thin, 10.2 The resulting matrix — per object, per arm, with the verdict each must produce, 10.3 `HC0T7` is outside the 0156 gate — stated, not hidden, 10.4 REJECTED alternative — making the doors return `boolean` to enter `census` + `policy`, 10. Arm domains — and **F-F, the finding that reshaped this design**, F-F — a `public` `SECURITY DEFINER` door that returns `void`/`uuid` and is granted to `service_role` only is in **NO** ARM's domain.

### Community 2021 - "6. `guard_profile_privileged_columns` — the interaction, in full"
Cohesion: 0.33
Nodes (6): 6.1 The live guard (catalog, verbatim in substance), 6.2 Does it block the doors? **No — and only because they are service-role-only.**, 6.3 What would happen if the doors were granted to `authenticated` — and why the "fix" is a vulnerability, 6.4 The anti-fix keystone (pgTAP 386), 6.5 Other triggers, checked and cleared, 6. `guard_profile_privileged_columns` — the interaction, in full

### Community 2022 - "ETH·E4 — Ethics participant seating & professional identity (phase record)"
Cohesion: 0.50
Nodes (4): 0175 — The AE4 PO batch: what the differential oracle asserts, and what it deliberately does not, Consequences, Context, Decision

### Community 2023 - "Lead notes"
Cohesion: 0.29
Nodes (7): Collision conformance (S0 §E), Commits (branch `pre-pilot-release-s0`), Gate (CLAUDE.md §6) — all ✅, IV2 — Interviews v2 (Sessions + Reporting/Confidentiality) — completed-track record, Open follow-ups (non-blocking, from QA Info), SQLSTATE, What shipped

### Community 2024 - "attachments-panel.tsx"
Cohesion: 0.50
Nodes (4): 11.1 ⭐ ADR 0126 §E's NEW safety argument — it holds, and I verified it through the hash chain rather than through the artifact §E cites, 11.2 ⭐ Body-invariance — the remediation is real, and I did not take it on trust; I proved it myself, 11.3 Suite `355`, and the lead's own three instrument errors, 11 · The three things the lead asked me to be sceptical about

### Community 2025 - "capa-affordance.tsx"
Cohesion: 0.50
Nodes (4): 1 · BLOCKING (each is `CHANGES REQUESTED` on its own), 🔴 C1 — the `dsr` go-live flip is on the branch, and its authorization exists in no record but the migration's own comment, 🔴 C2 — the invariant this round tripled is still stated at its OLD value in the live catalog, in the two guards that carry the security bound, 🔴 C3 — ADR 0131's live text still carries the *overturned* P3 ruling, and the revision is recorded at no pilot-decision surface

### Community 2026 - "indicators-panel-async.tsx"
Cohesion: 0.50
Nodes (4): 11.1 Options, with trade-offs, 11.2 Why 2b did not build it, stated as a decision, 11.3 BINDING REQUIREMENT ON AE4.4 — numbered alongside § 6A, 11. ⛔ PROPOSAL, NOT BUILT — where a permission's RESOLUTION SCOPE lives

### Community 2027 - "table"
Cohesion: 0.29
Nodes (7): 2026-09-06 — backend: run 1 voided by tail drift; the door arm gets Batch 0's reset design; run 2 launched, Gate for the retrofit commit — bare exit codes, nothing piped, Post-run verification — the run 1 artefacts, every rc read BARE, RUN 2 — launched, verified under way, and this session STOPS HERE, The CARRIED 318, partitioned by CAUSE (the dry run predicted 48), THE DIAGNOSIS — TAIL DRIFT, and it is PROVEN, not assumed, THE RETROFIT — Batch 0's design ported into `p0-authz-door-audit.sh` (ADR 0191 D8)

### Community 2028 - "⛔ Never kill a running sweep — it restores gates from an EXIT trap"
Cohesion: 0.18
Nodes (11): 1 · Why nothing existing could do this, 2 · ⭐ The unit of work is the ENFORCER, not the door, 3 · The mutation: neutralize the GUARD, never the EFFECT, 4 · Verdicts, 5 · Safety properties, and why each is there, 6 · ⚠ Four bugs the proving caught — none of which would have failed loudly, 7 · Cost, and what it is not, 8 · Status — the 8-case PROVING sample; ⛔ not a result, and the full sweep HAS since run (+3 more)

### Community 2029 - "ADR 0026 — Interviews (case-scoped, participant-write RLS)"
Cohesion: 0.50
Nodes (4): 4.0 Enforcement sites come in THREE kinds, and the matrix must say which, 4.1 Scope exclusion, stated so the next reader does not re-derive it, 4.2 The matrix, 4. The matrix

### Community 2030 - "ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles"
Cohesion: 0.29
Nodes (7): 0167 — commission `staff_admin` has ONE authority, on both sides, Amendment 1 — the retired note had a narrower subject, and a SECOND one-way door survives (2026-08-28), Amendment 1a — what the narrowing actually removes (2026-08-28), Amendment 2 — the `staff` sub-arm closes the same way: narrow it (PO-ruled 2026-08-28), Consequences, Context — a grid measured on a fresh reset, not read from migration text, Decision

### Community 2031 - "ADR 0052 — NSP-per-hospital: re-key the PQS roster + every PHI door org → hospital, add `nsp_org_admin`"
Cohesion: 0.50
Nodes (4): 15.1 What was wrong, and what was done, 15.2 Re-verification — every gate re-run, nothing inherited, 15.3 The lesson worth keeping, 15. QA review of run 6 (2026-09-03) — CHANGES REQUESTED, corrected, and re-verified

### Community 2032 - "0066 — patient_xref case-module grain re-keyed to the patient participant"
Cohesion: 0.50
Nodes (4): 1.1 The chain, function by function, 1.2 The policies on the chain, 1.3 The population, measured — and the trap that decides which SELECT is measurable, 1. The final path, verified against the live catalog

### Community 2033 - "ADR 0138 — Unified (non-PHI) action_items hub"
Cohesion: 0.50
Nodes (4): Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items), 🔴 FUP-P16-1 — **14** never-called doors fail the ADR 0079 floor (pre-existing, NOT Phase 16), ✅ FUP-P16-1 — 14 never-called doors fail the ADR 0079 floor — **RESOLVED 2026-08-04**, ✅ FUP-P16-3 — `app.copy_version_children` temp-table concern: **INVESTIGATED, NOT A BUG**

### Community 2034 - "3.16 `forms.form_lint_results`"
Cohesion: 0.50
Nodes (4): 🟠 FUP-DM1-CEILING — **RULED 2026-08-13**; now a **DM2 Wave A PREREQUISITE**, no longer a blocker (owner: backend @ DM2; filed by backend, upgraded by lead 2026-08-12, ruled by PO 2026-08-13), 🟢 FUP-DM1-DISPOSE — ✅ DISCHARGED 2026-08-13 (DM2·S2) — `dispose_case_phi` lost its attachment-redaction step in DM1; DM2 wired case PHI erasure to document disposition, verified present in the live `pg_proc.prosrc` (owner: backend, DM2), 🟢 FUP-DM1-E2E — ✅ DISCHARGED 2026-08-13 (DM2·S4) — six (+1 found) attachment-touching E2E specs were PARKED by the DM1 substrate drop; DM2 rewrote them against the document model, never merely deleted them (owner: tester [park — ✅ done 2026-08-12] + frontend/backend [DM2 rewrite — ✅ done 2026-08-13]), Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)

### Community 2035 - "4.7 `form_responses.form_answer_matrix_cells`"
Cohesion: 0.50
Nodes (4): ⬛ FUP-DM5-BACKUP-IS-PHI-EXPORT — ✅ **RESOLVED 2026-08-19** — a Storage backup is an **unmanaged plaintext PHI export**, and the disposal runbook instructs a human to create one (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**), ⬛ FUP-DM5-CLOUD-ORPHAN-SURFACE — ✅ **RESOLVED 2026-08-18 by measurement: Cloud exposes NO orphan-visible surface** (owner: backend + lead; **input to the deploy runbook**), ↩ Rotated from follow-ups.md 2026-08-31 — the TWO bodies the 2026-08-27 note said were already here, ⛔ The question was framed WRONG, and QA r1 corrected it: the Cloud risk is not a MISSING proof — it is a FAKE one

### Community 2036 - "4.9 `form_responses.form_answer_references`"
Cohesion: 0.50
Nodes (4): ⬛ FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION — ✅ **RESOLVED 2026-08-19: the subject was removed, not the predicate widened (ADR 0126 D5)** — a print of an `in_progress` draft is visible to its CREATOR ONLY, and the minter can lose the only way out (owner: PO decision, then backend + frontend), ⬛ FUP-PREVIA-SPLIT-BUILD — ✅ **RESOLVED 2026-08-19: shipped, QA APPROVED r2** — build ADR 0125: the ephemeral `Imprimir prévia` / registered `Emitir documento` split (owner: backend + frontend), Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure), ⬛ Resolved — rotated 2026-08-19 (the ADR 0125/0126 prévia-split Record step)

### Community 2037 - "5.4 `referral_assignments`"
Cohesion: 0.50
Nodes (4): ⭐⭐ Critical — the must-not-be-forgotten list, Follow-ups — the OPEN register, How to append a follow-up, When an item changes state

### Community 2038 - "Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record"
Cohesion: 0.29
Nodes (7): Blockers, Current state, Done since start, In progress, Next, Objective, PRED-DOMAIN — progress record

### Community 2039 - "An authz arm's EXIT CODE is not its verdict — read what it enumerated"
Cohesion: 0.50
Nodes (4): 0151 — AFF4: organization affiliation, per-hospital staff data, and the voided tense, Consequences, Context, Decisions

### Community 2040 - "⛔ Prettier does not govern this tree — in two opposite directions"
Cohesion: 0.50
Nodes (3): ⛔ Prettier does not govern this tree — in two opposite directions, `src/`: NOT in `.prettierignore`, and that is the trap, Tracker docs: Prettier is configured OFF, and obeying it is the defect

### Community 2041 - "ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)"
Cohesion: 0.29
Nodes (7): 2026-09-08 — `backend`, the CARRIED disposition APPLIED (PO ruling R30), and why test file 297 is deliberately NOT fixed here, ⚠ FINDING — for 6 of the 9, "hand commentary" was **not** hand commentary, One action BEYOND R30's three, stated so it can be reverted in one line, R30 condition 1 — **0 rows caught**, and here is how the zero was earned, R30 condition 3 — line 27's stale tail DELETED, R30 condition 4 — R14 re-asserted **by byte comparison**, and the 51 / 2 / 6 reconciled, R31 — why `297_process_template_versioning.sql` is CORRECTLY not fixed in this unit

### Community 2042 - "ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only"
Cohesion: 0.29
Nodes (7): 2026-09-08 — `backend`, the LAST BUILD TURN before QA: three closures, the R27 fix proven at the SECOND reset, and a third instance of that class, A THIRD instance of the same class, found while fixing the second, ⚠ Instrument fault number SEVEN, caught in the verification of the closures themselves, R27 — the reset banner now prints the DELTA (commit `22402505`), R33 — the premise correction, recorded BESIDE the approval, not folded into it, Suite shape — why `npm run test:db` was NOT re-run for this turn, The three closures (R35.1) — each against its OWN quoted `Closes when`

### Community 2043 - "ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture (Phase 14)"
Cohesion: 0.29
Nodes (7): Blockers, Current state, Done since start, In progress, Next, Objective, WRITEPATH-BASELINE — progress record

### Community 2044 - "ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision"
Cohesion: 0.50
Nodes (4): 0164 — tenant containment moves from creation time to the destructive event, Consequences, Context, Decision

### Community 2045 - "ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal"
Cohesion: 0.29
Nodes (6): adminRpcMock, downloadMock, IDS, singleMock, ADR-0118, userRpcMock

### Community 2046 - "ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org"
Cohesion: 0.20
Nodes (10): A10 — Scope: the **record** goes, the **configuration** stays, A11 — Action items: the adjacent channel (**the A3 pattern, again**), A12 — The residue: stated, not claimed away, A13 — ⚠ CONFIRMED FROM THE LIVE CATALOG (was an inventory item; now a finding), A14 — Flagged, **NOT decided**: `can_write_attachment`'s `'case'` arm, A8 — Principle: administration is not a **meeting** source either, A9 — **D4·2 is REVERSED**, Amendment 2 — added test keystones (+2 more)

### Community 2047 - "ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole"
Cohesion: 0.57
Nodes (6): die(), inject_fail(), note(), rowkeys(), merge-findings-baseline.sh script, split_file()

### Community 2048 - "0057 — Phase 15/17 revision & pre-pilot re-sequencing (15 → 17 → 16)"
Cohesion: 0.43
Nodes (6): headingsOf(), isSlice(), main(), ADR-0198, readCorpus(), REPO_ROOT

### Community 2049 - "0070 — Interview data-model v2: sessions + reporting / confidentiality columns"
Cohesion: 0.50
Nodes (4): `app.person_authority_orgs` — NOT a gate; helper, with the reason, ✅ DISCHARGED 2026-08-27 — the targeted mutation case, run twice, `public.list_addable_commission_members` — IS a gate; owes a TARGETED mutation case, The two name-excluded functions — RULED (lead, 2026-08-27)

### Community 2050 - "0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle"
Cohesion: 0.50
Nodes (4): ⚠ Blast radius, MEASURED not guessed, Increment B (NOT BUILT) — the `grant_role` split, ADR 0168 Amdt 3, The shape to build, Why it exists

### Community 2051 - "0149 — An org_admin reads the hospital-tier audit chain"
Cohesion: 1.00
Nodes (3): die(), fingerprint(), catalog-chain-drift.sh script

### Community 2055 - "Pre-Pilot DB Hardening — Wave 1 (archived task detail)"
Cohesion: 0.33
Nodes (6): ADR 0004 — Sign-off enforcement feature flag, Consequences, Context, Decision, Rationale, Update — flag flipped (Phase 6, 2026-06-13)

### Community 2058 - "28. Example: Complex Action Item"
Cohesion: 0.33
Nodes (5): ADR 0005 — `visible_when` condition shape (v1), Context, Decision, Extension point, Rationale

### Community 2059 - "10. New table: `case_votes`"
Cohesion: 0.50
Nodes (4): 0165 — the affiliation-derived tenant gate, what it widens, and the alternative rejected for now, Consequences, Context, Decision

### Community 2060 - "⬛ FUP-AFF2-CONTA — ✅ **RESOLVED 2026-08-26** (owner: frontend/PO; AFF4 **F5**, ADR 0151 **D14**)"
Cohesion: 0.67
Nodes (3): 10.1 Proposed schema, 10.2 Eligibility, 10. New table: `case_votes`

### Community 2061 - "loading.tsx"
Cohesion: 0.67
Nodes (3): 12.1 Graduation rule, 12.2 Proposed schema, 12. Optional table: `ethics_decision_details`

### Community 2062 - "loading.tsx"
Cohesion: 0.67
Nodes (3): 10.1 `evaluation_cycle_bed_snapshots`, 10.2 Rationale, 10. Occupancy snapshots

### Community 2063 - "12. Evaluation records"
Cohesion: 0.67
Nodes (3): 12.1 `evaluation_records`, 12.2 Rationale, 12. Evaluation records

### Community 2064 - "13. Observation-time context"
Cohesion: 0.67
Nodes (3): 13.1 `evaluation_observation_contexts`, 13.2 Rationale, 13. Observation-time context

### Community 2065 - "17. Bed-matrix and rapid-entry model"
Cohesion: 0.67
Nodes (3): 17.1 `evaluation_program_views`, 17.2 Critical principle, 17. Bed-matrix and rapid-entry model

### Community 2066 - "16. Single-hospital customers"
Cohesion: 0.67
Nodes (3): 16.1 One person may hold all necessary administrative assignments, 16.2 Use role bundles only in the application layer, 16. Single-hospital customers

### Community 2067 - "25. Platform support and break-glass access"
Cohesion: 0.33
Nodes (6): 3.1 Identity and account state, 3.2 Standing roles, 3.3 Active-role assumption, 3.4 Case authorization, 3.5 Other authorization planes, 3. Current authorization model

### Community 2069 - "BLOCKING"
Cohesion: 0.33
Nodes (6): 5.1 How a controlled-document read resolves after DM3, 5.1b What DM3 actually replaces on the download side — and the audit delta, 5.2 The version-grant seam (reviewer access, not a bucket policy), 5.3 The D15 ceiling, and where it does *not* apply, 5.4 ⭐ The ethics access shape — why it is NOT the controlled-document shape, 5. The authorization story

### Community 2070 - "r2 · 6 — Blocking items"
Cohesion: 0.50
Nodes (4): 0170 — case deletion is not a client capability: DELETE on `public.cases` is revoked from `authenticated`, Consequences, Context, Decision

### Community 2071 - "4 · Round-1 findings — disposition"
Cohesion: 0.67
Nodes (3): 4 · Round-1 findings — disposition, Addressed, Withdrawn

### Community 2073 - "FF-5 (Entity Reference, ADR 0091) — closed bugs, rotated 2026-07-28"
Cohesion: 0.67
Nodes (3): 🟢 BUG-FF5-001 — the builder cannot author a `reference` item: `addItem` rejects it with "Tipo de item inválido." · owner **backend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cc4194a`, re-verified 2026-07-28), 🟢 BUG-FF5-002 — the submissions dashboard shows "Sem resposta" for every top-level reference answer, even though the DB and the exact same query both hold/return the correct data · owner **frontend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cf6a949`, re-verified 2026-07-28), FF-5 (Entity Reference, ADR 0091) — closed bugs, rotated 2026-07-28

### Community 2074 - "Rotated 2026-08-12 — the FUP batch (both CLOSED)"
Cohesion: 0.67
Nodes (3): ✅ BUG-MIN-E2E-1 — RESOLVED 2026-08-12: **it was never a product defect**, ✅ BUG-RDR-001 — RESOLVED 2026-08-12: fixed at the shared layer, both dialog primitives, Rotated 2026-08-12 — the FUP batch (both CLOSED)

### Community 2075 - "Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live Bug Log's two CLOSED blocks"
Cohesion: 0.67
Nodes (3): Closed → [bug-log-archive.md](./archive.md), Closed this phase → [bug-log-archive.md](./archive.md) (rotated 2026-08-14), Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live Bug Log's two CLOSED blocks

### Community 2076 - "1. Plane 1 — assignment shape, and the `expires_at` question"
Cohesion: 0.67
Nodes (3): 1.1 Is the expired seat enforced? ✅ YES — on every authorization path, in exactly one place, 1.2 FINDING — five sites resolve `staff_admin` holders WITHOUT the expiry term, 1. Plane 1 — assignment shape, and the `expires_at` question

### Community 2077 - "14. Run 6 (2026-09-03) — the first run against the statement-scoped path. **ACCEPTANCE MET.**"
Cohesion: 0.67
Nodes (3): 14.1 What the run settles, and what it explicitly does not, 14.2 K = 4 was not moved, and did not need to be, 14. Run 6 (2026-09-03) — the first run against the statement-scoped path. **ACCEPTANCE MET.**

### Community 2078 - "4. The measured principal, and the proof that its only grant path is the permission arm"
Cohesion: 0.67
Nodes (3): 4.1 The proof (harness §2) — one assertion per competing arm, not prose, 4.2 The ablation (harness §3) — proven, not asserted, 4. The measured principal, and the proof that its only grant path is the permission arm

### Community 2079 - "Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)"
Cohesion: 0.67
Nodes (3): Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md), 🔴 FUP-ETH-1 — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (2026-08-05), 🔴 FUP-ETH-CPF-1 — the D5 widening also exposes `professional_profiles.cpf` (2026-08-11, backend)

### Community 2080 - "FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — ✅ CLOSED 2026-09-01 (AE4.7b)"
Cohesion: 0.67
Nodes (3): Closure — migration `20261003007210`, ADR 0174 D6, ⬛ FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY — ✅ **RESOLVED 2026-09-02** — PO ruled: P1 bounds the INDEX PATH, not the `Seq Scan` node (ADR [0181](../decisions/0181-p1-bounds-the-index-path-not-the-scan-node.md)), FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — ✅ CLOSED 2026-09-01 (AE4.7b)

### Community 2081 - "Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)"
Cohesion: 0.67
Nodes (3): ✅ FUP-ACT-DISPOSE-UI — RESOLVED 2026-08-20 (DSR Slice 2, ADR 0130). The LGPD Art. 18 erasure path has a working UI route., ⬛ FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE — ✅ **RESOLVED 2026-08-19** — `dispose_meeting_minutes` could not complete on any locked meeting that had agenda items; its own "bypass the freeze guards" comment was FALSE (owner: backend + PO; ⛔ its **"blocks C1a/C1b"** claim was WRONG IN GRAIN — see the correction below; Rule 12 / LGPD Art. 18), Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)

### Community 2082 - "Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)"
Cohesion: 0.67
Nodes (3): ⬛ FUP-F2-BUCKETS — RESOLVED 2026-08-12: `meeting-attachments` retired; the other two buckets deliberately untouched (backend), ⬛ FUP-PDF-3 — RESOLVED 2026-08-12: mint/revoke doors narrowed to the granted-column composite (backend), Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)

### Community 2083 - "↩ Rotated from PROGRESS.md § Follow-ups 2026-08-31 — three concluded notes, VERBATIM apart from the link repoint"
Cohesion: 0.67
Nodes (3): ↩ Rotated from PROGRESS.md § Follow-ups 2026-08-31 — three concluded notes, VERBATIM apart from the link repoint, The 2026-08-24 gate-tooling rotation note, The two ⛔ notes that stood above the index tail

### Community 2084 - "FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION.md"
Cohesion: 0.50
Nodes (4): 0174 — `authz.holds_role`: one chokepoint for the hat, and `authz.roles.state` made load-bearing, Consequences, Context, Decision

### Community 2085 - "FUP-E2E-SUBMITTED-POOL-UNSCOPED.md"
Cohesion: 0.50
Nodes (4): 0177 — AE4.9 D4/D7 as built: the candidate's state set, the denial precedence, and the state gate's reach into seeded grants, Consequences, Context, Decision

### Community 2086 - "FUP-MEETING-CASES-SELECT-OMITS-RECUSAL.md"
Cohesion: 0.50
Nodes (3): ⚠ CLAUSE PREMISE REFUTED, AND THE CENSUS DELIVERED — 2026-09-09, pre-AE5 Batch 9 (`AE5-OPENING-ADR`), FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED — the statement-scoped resolver costs `(1 + D) × O(M)` per statement, and nothing states or watches `D`, ⚠ RE-CLAUSED, NOT CLOSED — 2026-09-11 (PO ruling, unit `AE5-SUCCESSOR-ADRS`, ADR 0208)

### Community 2088 - "C2-TIER1 — progress record"
Cohesion: 0.06
Nodes (33): 2026-09-03 — folded from the C2 handoff at ADR 0186 Wave 3, 2026-09-04 (second session) — closure item 1 landed; the keystone set specified; the ERROR class re-shaped, 2026-09-04 — three PO rulings and six corrections; C2's closure condition fixed (ADR 0187), Artifacts, Artifacts touched, Blockers, C2-TIER1 — progress record, Closure item 1 — the anchor fix. LANDED, and it is not the fix that was on record. (+25 more)

### Community 2164 - "⬛ FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ✅ **CONCLUDED 2026-08-24 by PO ruling: EXPECTED, and in line with platform specifications.** Filed and closed the same day."
Cohesion: 0.33
Nodes (6): ADR 0193 — The enforcement manifest declares what it measured, and the measurement is a fixed point over the call closure, Consequences, Considered options, Context, Decision, Problem

### Community 2165 - "↩ Rotated from follow-ups-open.md 2026-09-03 (ADR 0186 Wave 5, plan 5.5)"
Cohesion: 0.33
Nodes (6): 0194 — A sweep's `CASES` has three states, and a parent asks for a full run by UNSETTING it, Consequences, Considered options, Context, Decision, Problem

### Community 2167 - "Rotated from PROGRESS.md + follow-ups.md 2026-08-20 — FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING (resolved by dissolution)"
Cohesion: 0.67
Nodes (3): 27. Example: Simple Action Item, Scenario, Tables Used

### Community 2168 - "↩ Rotated from deferred-backlog.md 2026-09-03 (ADR 0185 D5 normalization)"
Cohesion: 0.67
Nodes (3): FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS, 🟠 FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS — "fully measured" points at a silent home (owner: lead + PO) — ✅ RESOLVED 2026-09-11, ✅ RULED — 2026-09-11 (PO, unit `AE5-SUCCESSOR-ADRS`); the lead closes this at the Record step

### Community 2174 - "ADR 0201 — The keying asymmetry is the model: a question about a third party ignores the hat, a question about the caller requires it — and on the scope axis the hat is role-wide while the audit row named one seating"
Cohesion: 0.33
Nodes (6): ADR 0201 — The keying asymmetry is the model: a question about a third party ignores the hat, a question about the caller requires it — and on the scope axis the hat is role-wide while the audit row named one seating, Consequences, Considered options, Context, Decision, Problem

### Community 2175 - "ADR 0203 — Audit F5's seam is already encoded as data in the enforcement manifest; the three classification columns are not, and their disposition is the PO's"
Cohesion: 0.33
Nodes (6): ADR 0203 — Audit F5's seam is already encoded as data in the enforcement manifest; the three classification columns are not, and their disposition is the PO's, Consequences, Considered options, Context, Decision, Problem

### Community 2177 - "Batch 3 closures — unit WRITEPATH-BASELINE (2026-09-08)"
Cohesion: 0.33
Nodes (6): Batch 3 closures — unit WRITEPATH-BASELINE (2026-09-08), 🟠 FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — `hardDenyClasses` is empty on all 43 rows and the lint arm that checks it iterates zero times, ✅ 🟠 FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — `hardDenyClasses` is empty on all 43 rows and the lint arm that checks it iterates zero times — **RESOLVED 2026-09-07**, ✅ FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED — the mandated per-phase sweep had a FOUR-part hole: the deriver names ONE arm for a TWO-arm list; arm 2 reports success at exit 0 having measured nothing; 9 policies fall outside both arms; and a killed run leaves an RLS policy WIDE OPEN with nothing reporting it (owner: backend/lead; filed 2026-08-27 by `backend`, all four measured during AE1.5) — **RESOLVED 2026-09-08**, ✅ FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN — three policies that were in no arm's domain may return BLIND on their first sweep — **RESOLVED 2026-09-08**, ✅ FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107 — the committed findings baseline predates the domain fix, and `FROMFINDINGS` arms structurally cannot notice — **RESOLVED 2026-09-08**

### Community 2178 - "FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE"
Cohesion: 0.33
Nodes (6): Closes when, 🟠 FUP-ADR-CROSS-LINKS-HAVE-NO-GATE — 13 broken ADR-to-ADR links, and gate 9 structurally cannot see them (owner: lead/backend; filed 2026-09-02 by `lead`, measured during AE4.9 D6) — ✅ CLOSED 2026-09-08, FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE, Related, The mismatch, What is in the tree right now

### Community 2179 - "FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP — a session's explicit role selection is never revalidated, so the token hook keeps minting a hat whose membership is gone"
Cohesion: 0.33
Nodes (5): FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP — a session's explicit role selection is never revalidated, so the token hook keeps minting a hat whose membership is gone, The mechanism — measured from the live catalog, with the query beside each reading, What is UNTESTED — the actual gap, What it means TODAY — fail-closed, and that is why this is medium and not critical, What must NOT be mistaken for closing it

### Community 2180 - "FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET — the C2 harness mutates by an OID captured before a reset that reassigns every OID"
Cohesion: 0.04
Nodes (54): An authz arm's EXIT CODE is not its verdict — read what it enumerated, What to do, every time, Why it is load-bearing, ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write, Consequences, Context, Decision, The proof, and why the first attempt did not count (+46 more)

### Community 2181 - "FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS — the `FOR ALL` policies whose read half no keystone exercises, disclosed by ADR 0191 D4 and owed a keystone each"
Cohesion: 0.33
Nodes (6): Closes when, FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS — the `FOR ALL` policies whose read half no keystone exercises, disclosed by ADR 0191 D4 and owed a keystone each, Related, ⭐ SETTLED, 2026-09-07 — run 2 resolves the bound to ELEVEN, The six NEW rows — RCA, and the same trap as CAPA, The work-list — MEASURED, 2026-09-06, from the one full run (353 cases, 12 h 17 m)

### Community 2182 - "Current state"
Cohesion: 0.33
Nodes (6): Blockers, Current state, Done since start, In progress, Next, Objective

### Community 2184 - "Current state"
Cohesion: 0.33
Nodes (6): Blockers, Current state, Done since start, In progress, Next, Objective

### Community 2186 - "2026-09-08 — `backend`, GATE AT THE TIP (R32 step 2). Every exit code read **bare**, no pipes"
Cohesion: 0.33
Nodes (6): 2026-09-08 — `backend`, GATE AT THE TIP (R32 step 2). Every exit code read **bare**, no pipes, Stack discrimination — stated, not assumed, The diff-scoped deriver — `SCOPE:` line quoted **verbatim**, The production-diff EMPTY is also a proven zero, not a silently-empty pathspec, The set-valued targeted home — restore verified three ways, and its detector fired on every case, ⚠ TWO instrument faults of my own during this gate, both caught, both recorded

### Community 2187 - "2026-09-08 — Record step (`backend`, at the lead's direction): QA re-review APPROVED at `45f5880a`; PO approved the Record step and the ff-merge; unit closed"
Cohesion: 0.33
Nodes (6): 2026-09-08 — Record step (`backend`, at the lead's direction): QA re-review APPROVED at `45f5880a`; PO approved the Record step and the ff-merge; unit closed, ⚠ An eleventh instrument fault, in the verification of this very cut — caught by the guard, recorded per R25, Carried out of this unit unclosed, stated so that nothing reads as cleared, Hub `## Current state` at closure — cut from the hub 2026-09-08 (ADR 0186 D8), The gate at the tip — the ARM names, never the script (CLAUDE.md §6 step 5), The two residual observations, folded

### Community 2190 - "Round 2 — re-review at `d2bdb372`"
Cohesion: 0.20
Nodes (8): Acceptance criteria, AE4 — Authz catalog cutover, staff_admin substituted, ⚠ B1 — WITHDRAWN. My finding was wrong, and the correction is the interesting part., Round-2 findings, Round 2 — re-review at `d2bdb372`, Verdict, What I verified in round 2, Your two questions

### Community 2191 - "ADR 0017 — Multi-Phase Cases"
Cohesion: 0.40
Nodes (5): ADR 0017 — Multi-Phase Cases, Consequences, Context, Decision, Key technical choices & rationale

### Community 2192 - "ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)"
Cohesion: 0.40
Nodes (5): ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`), Consequences, Context, Decision, Why not the alternatives

### Community 2193 - "ADR 0099 — Meeting audio → generated ata (minute_generator integration)"
Cohesion: 0.40
Nodes (5): ADR 0099 — Meeting audio → generated ata (minute_generator integration), Amendment 1 (2026-08-06) — the ≤ 24 h audio ceiling is LAZY-ENFORCED, Consequences, Context, Decisions

### Community 2194 - "7. Recommended changes for the current project"
Cohesion: 0.40
Nodes (5): 7.1 Preserve, 7.2 Change now, 7.3 Change when the next feature requires it, 7.4 Do not do now, 7. Recommended changes for the current project

### Community 2195 - "3.16 `forms.form_lint_results`"
Cohesion: 0.40
Nodes (5): 3.16 `forms.form_lint_results`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 2197 - "4.3 `form_responses.form_answer_options`"
Cohesion: 0.40
Nodes (5): 4.3 `form_responses.form_answer_options`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 2198 - "4.5 `form_responses.form_answer_files`"
Cohesion: 0.40
Nodes (5): 4.5 `form_responses.form_answer_files`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 2199 - "MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record"
Cohesion: 0.40
Nodes (5): MIN — Meeting audio → generated ata (`audio_minutes`) · Feature record, ▶ MIN — Meeting audio → generated ata (`audio_minutes`) · **IN PROGRESS, started 2026-08-06**, Post-completion — N1's out-of-scope original, swept 2026-08-06 (rotated from PROGRESS.md 2026-08-08), QA Verdicts rows (copy — live rows retained in PROGRESS.md for the current milestone), Test Run Summary rows (rotated verbatim)

### Community 2200 - "V-3 · THE BLOCKING FINDING — C8's disproof is right on its legs and wrong on its scope"
Cohesion: 0.40
Nodes (4): Closes when, FUP-C2-TIER1-FLOOR-ARM-HAS-ZERO-SLACK, Related, The finding

### Community 2201 - "MAJOR-1 — DISCHARGED"
Cohesion: 0.40
Nodes (5): Evidence I produced — the fix did not narrow Wave A, Evidence I produced — the fix works, MAJOR-1 — DISCHARGED, The fix, read from the live catalog, The two false comments

### Community 2202 - "Manual smoke — meeting audio → generated ata (T5)"
Cohesion: 0.40
Nodes (4): Manual smoke — meeting audio → generated ata (T5), Prerequisites, Steps, What a pass proves (record it)

### Community 2204 - "⛔ EVIDENCE CORRECTED 2026-09-10 (QA MINOR-4) — the "no pgTAP cell" negative was a HAND-LIST"
Cohesion: 0.40
Nodes (5): ⛔ CORRECTION 2026-09-10 (QA N-MAJOR-2) — the derivation above asserts a FALSE UNIVERSAL, and its filter is the wrong predicate, ⛔ EVIDENCE CORRECTED 2026-09-10 (QA MINOR-4) — the "no pgTAP cell" negative was a HAND-LIST, FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE, 🟠 FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE — a noun-rule question ADR 0200 left open, ✅ RESOLVED 2026-09-10 (unit ADMIN-ARM-IS-ACTIVE) — the entry below is VERBATIM as filed

### Community 2205 - "✅ RULED — 2026-09-11 (PO, unit `AE5-SUCCESSOR-ADRS`); the lead closes this at the Record step"
Cohesion: 0.40
Nodes (5): FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION, 🟡 FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION — a live door comment cites the replaced §7.3 (owner: backend) — ✅ RESOLVED 2026-09-11, FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH, 🟡 FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH — a `SET search_path` that silently resolves to nothing passes every gate in the chain — ✅ RESOLVED 2026-09-11, ✅ RULED — 2026-09-11 (PO, unit `AE5-SUCCESSOR-ADRS`); the lead closes this at the Record step

### Community 2207 - "FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT — two mutation harnesses print verdicts and then exit 0 whatever they found"
Cohesion: 0.40
Nodes (4): Closes when, FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT — two mutation harnesses print verdicts and then exit 0 whatever they found, The measurement, Why it matters

### Community 2209 - "2026-09-05 — backend: QA sign-off F4-REC-1..3 (docs)"
Cohesion: 0.40
Nodes (5): 2026-09-05 — backend: QA sign-off F4-REC-1..3 (docs), F4-REC-1 — the histogram is now labelled by its instrument, and the two rows are separated, F4-REC-2 — the false universal is gone, and QA's replacement count was one short, F4-REC-3 — ADR 0190 D11's control is now stated as measured, Gate — every code read BARE

### Community 2211 - "2026-09-04 — backend: PO ruling landed; ADR + hub corrections"
Cohesion: 0.40
Nodes (5): 2026-09-04 — backend: PO ruling landed; ADR + hub corrections, Q4 — the forensic artifact, measured now (not restated), The four lead/PO rulings recorded, What this commit did, What this commit did NOT do

### Community 2212 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2213 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2214 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2215 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2216 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2217 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2218 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2219 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2220 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2221 - "AUTHZ Door-Blindness Audit — Findings"
Cohesion: 0.40
Nodes (4): AUTHZ Door-Blindness Audit — Findings, BLIND — the work-list (no keystone exercises these), COVERED (asserted-through) + ERROR (harness bug), Note — a hand-authored section the generator never produces

### Community 2223 - "14. Handoff checklist"
Cohesion: 0.50
Nodes (4): 14. Handoff checklist, Before cutover, Before implementation, During each phase

### Community 2224 - "2. Method and evidence"
Cohesion: 0.50
Nodes (4): 2.1 Sources inspected, 2.2 Point-in-time live catalog snapshot, 2.3 Verification performed, 2. Method and evidence

### Community 2227 - "5.8 `referral_message_documents`"
Cohesion: 0.12
Nodes (16): 5.12 `referral_read_receipts`, 5.2 `referral_context_versions`, 5.6 `referral_internal_notes`, 5.8 `referral_message_documents`, 5. Table Definitions, Columns, Columns, Columns (+8 more)

### Community 2228 - "14.1 `interview_findings`"
Cohesion: 0.50
Nodes (4): ADR 0124 — PROGRESS.md live-state contract, machine-enforced, Amendment 1 — the "loaded by every spawn" premise was false (2026-08-19), Amendment 2 — cap raised to 80 KB (2026-08-20), Amendment 3 — soft target at 80 KB, hard cap at 100 KB (2026-08-27)

### Community 2229 - "MAJOR-1 (BLOCKING) — `documents_wave_b` gates the LAST step of the corridor, not the corridor; the tree states the opposite twice"
Cohesion: 0.50
Nodes (4): Acceptable fixes (either one discharges it), Evidence I produced, MAJOR-1 (BLOCKING) — `documents_wave_b` gates the LAST step of the corridor, not the corridor; the tree states the opposite twice, Why it is not a security finding

### Community 2230 - "Review CLAUDE.md against queued session signals"
Cohesion: 0.50
Nodes (3): Guardrails, Procedure, Review CLAUDE.md against queued session signals

### Community 2231 - "ADR 0180 — `authz.scope_reaches`: the commission→organization ascent reads `commissions.organization_id`"
Cohesion: 0.50
Nodes (4): ADR 0180 — `authz.scope_reaches`: the commission→organization ascent reads `commissions.organization_id`, Consequences, Context, Decision

### Community 2233 - "How a closure is archived — the standard shape"
Cohesion: 0.50
Nodes (4): Checking your work, How a closure is archived — the standard shape, The rules, The shape

### Community 2235 - "21. Recommended Dashboard Views"
Cohesion: 0.67
Nodes (3): 21.1 Open Action Items View, 21.2 Action Item Dashboard View, 21. Recommended Dashboard Views

### Community 2240 - "GRANT-PLANE-CONVENTION-A1 — ADR 0205 amended in place, and the third pre-pilot fix"
Cohesion: 0.25
Nodes (8): 🟢 FUP-DEFINER-QUALIFIED-BODY-GATE-SUPABASE-TEST-DB-LEAVES-NO-PGTAP-INSTALLED — no TAP from bare psql — ✅ RESOLVED 2026-09-12, 🟡 FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER — ruled, unbuilt — ✅ RESOLVED 2026-09-12, 🟡 FUP-DEFINER-SEARCH-PATH-NARROW-FIX-DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED — the door audit never reads `FROMFINDINGS` — ✅ RESOLVED 2026-09-11, 🟡 FUP-DEFINER-SEARCH-PATH-NARROW-FIX-FOUR-TEMP-TABLE-DEFINERS-MEASURED-FREE-TO-CONVERGE — 420 measured all four FREE; converging them is unruled — ✅ RESOLVED 2026-09-11, 🟡 FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED — ADR 0208 D4's second clause has no gate — ✅ RESOLVED 2026-09-12, 🟢 FUP-DEFINER-SEARCH-PATH-NARROW-FIX-RULES-CAP-DEFERS-THE-D5-HINT-FILE — the D5 rule file became one line because `.claude/rules/` is at its 12-file cap — ✅ CLOSED 2026-09-12, 🟢 FUP-RULES-PROFILES-GUARD-LESSON-IS-NOW-GATE-CARRIED — the one rule in `.claude/rules/` whose lesson pgTAP `386` now fully carries — ✅ CLOSED 2026-09-12, ✅ RESOLVED 2026-09-11 — both deliverables landed; open half 1 RULED (unit `DEFINER-SEARCH-PATH-NARROW-FIX`, PO approval 2026-09-11)

### Community 2247 - "loading.tsx"
Cohesion: 0.40
Nodes (5): 4.7 `form_responses.form_answer_matrix_cells`, Design Reasoning, Purpose, Relationships, Suggested Table

### Community 2248 - "DeadlineDialog"
Cohesion: 0.15
Nodes (12): ACT — "act as" strict role assumption (ADR 0106), 🟡 ACT — "act as" strict role assumption (ADR [0106](../decisions/0106-act-as-role-assumption.md)) · **S3 QA round 1: CHANGES REQUESTED → blocker FIXED; re-review pending**, Bug Log — CLOSED rows (rotated), Merge, push & the two deploy debts, Merged + pushed, ⚠ Process note — a teammate pushed to `origin/main` twice mid-stage, S4 — D14 arm audit + record — ✅ COMPLETE, Scope as delivered (+4 more)

### Community 2257 - "loading.tsx"
Cohesion: 0.40
Nodes (5): PCI + Process-Template Versioning — phase detail (archived), PCI row, Phase Status rows + gate caveats (rotated verbatim from PROGRESS.md 2026-08-08), ▶ TV — Process-Template Versioning (ADR [0096](../../docs/decisions/0096-process-template-versioning.md)) · `frontend` rows, TV row

### Community 2259 - "loading.tsx"
Cohesion: 0.40
Nodes (5): ADR 0051 — Hospital-admin tier, 4-tier audit chain & committee member titles, Alternatives rejected, Consequences, Context, Decision

### Community 2261 - "loading.tsx"
Cohesion: 0.50
Nodes (4): detailPayload(), dtPayload(), rpcMock, ADR-0094

### Community 2268 - "loading.tsx"
Cohesion: 0.67
Nodes (3): ⛔ B3 — the N1 closure record states a grep result that is false, and the file that falsifies it is introduced three lines later, ⛔ B4 — `351` t25 passes on an empty population (proven by construction), while ADR 0056 Amdt 1 cites it as a guarantee, r2 · 6 — Blocking items

## Knowledge Gaps
- **15160 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `$schema` (+15155 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **907 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Page` connect `Case Department Field` to `Loading`, `18. Relationships Summary`, `Decision`, `4.7 `form_responses.form_answer_matrix_cells``, `js-combine-iterations.md`, `Architecture Rules (binding)`, `My Cases List`, `Referral Actions & Reply`, `NSP CAPA/RCA Pages`, `17. Suggested Repository and Service Boundaries`, `NSP-per-org guard-lift phase (ADR 0042)`, `⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**`, `Derived Indicator Config`, `Page`, `form-model-normalization.spec.ts`, `Section signoff fields`, `Action Items Data Model Handoff`, `Interview badges`, `access-audit-table.tsx`, `Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record`, `actions.test.ts`, `Page`, `0013 — Fix form_versions INSERT RLS self-reference`, `Case document delete`, `Audit findings`, `Outcomes actions`, `phase2-auth-shell.spec.ts`, `Page`, `Loading`, `Phase 17 — Controlled-Document Lifecycle · QA Review`, `patient-index.spec.ts`, `Loading`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Auth Callback & Meeting Settings` to `Error & Not-Found Boundaries`, `Triage Disposition & Pathways`, `Case Documents`, `Form Builder Actions`, `Submission Detail (Answer Model)`, `RCA Analysis Stage`, `Referral Detail & Formatting`, `Quality Indicators`, `NSP Patient Registry`, `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA`, `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA`, `My Cases List`, `NSP Referrals Dashboard`, `Case & Phase Actions`, `CAPA Evidence & Cards`, `Case Narrative Editor`, `Form Item Editor & Tests`, `Submission Detail Blocks`, `Phase Responder & Submissions`, `Phase Result Actions`, `loading.tsx`, `Narrative Templates`, `UserLifecycleActions`, `Section signoff fields`, `TitleAssignControl`, `Condition builder`, `VersionWithUrl`, `UploadDialog`, `Layout`, `Event type manager`, `Page`, `Wizard runner`, `Page`, `Actions`, `26. Suggested Naming Convention`, `Shared Action-Items Hub — task detail (Option A → case-fold → member views)`, `ActionItemRow`, `CaseActionItemsPanel`, `13. Table: `file_assets``, `Page`, `Page`, `Page`, `2. Architectural Goals`, `FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)`, `Page`, `W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**`, `Format`, `bundle-dynamic-imports.md`, `ADR 0052 NSP per hospital`, `Page`, `Title badge`, `FIX-2 test-isolation leak (staff1 hospital_admin)`, `36. Status transitions`, `Worktrees — parallel Claude Code sessions on this repo`, `14. Recommended Indexes`, `App.member can (flag aware capability kill switch)`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `Loading`, `⬛ FUP-0137-PHI-MODE-SHIMS — ✅ **RESOLVED 2026-08-24. All four shims are gone; the last one needed the code deploy first, which is why it outlived the other three.**`, `phase7-cases.spec.ts`, `case-phase-result.spec.ts`, `PHASES.md — Hospital Commission Forms Platform`, `Quick Reference`, `cases-extras.spec.ts`, `phase22-referrals.spec.ts`, `20. Migration Strategy From Patient-Centered Cases`, `Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07`, `Lead Playbook — orchestration protocol (lead only)`, `loading.tsx`, `ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13–21)`, `add-block-menu.tsx`, `loading.tsx`, `ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got`, `0012 — clone_form_version returns the existing draft (one draft per form)`, `Phase CH — Committee Charters & Meeting Cadence — QA Review`, `ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")`, `loading.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `cn()` connect `Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA` to `Case Lifecycle Actions`, `Loading`, `Admin & Auth Pages`, `Error & Not-Found Boundaries`, `loading.tsx`, `5.4 `referral_assignments``, `Loading`, `phase22-referrals.spec.ts`, `Triage Disposition & Pathways`, `4.11 `form_responses.form_submission_section_states``, `Meeting form dialog.test`, `CAPA Badges`, `Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07`, `ADR 0052 NSP per hospital`, `Page`, `Title badge`, `Options editor`, `NSP Patient Registry`, `My Cases List`, `Auth Callback & Meeting Settings`, `Prod asymmetric JWT signing key requirement`, `CustomFieldDef`, `Case Narrative Editor`, `36. Status transitions`, `21. Recommended Dashboard Views`, `Phase Result Actions`, `loading.tsx`, `Lead Playbook — orchestration protocol (lead only)`, `Forms & Process Templates`, `loading.tsx`, `case-phase-result.spec.ts`, `loading.tsx`, `PHASES.md — Hospital Commission Forms Platform`, `UserLifecycleActions`, `Page`, `Page`, `TitleAssignControl`, `Condition builder`, `Page`, `UploadDialog`, `Layout`, `0050 — Unified (non-PHI) action_items hub`, `add-block-menu.tsx`, `Event type manager`, `Page`, `4.1 `form_responses.form_submissions``, `26. Suggested Naming Convention`, `Actions`, `App.member can (flag aware capability kill switch)`, `CaseActionItemsPanel`, `Bug Log Archive (resolved/closed bugs)`, `Audit icon`, `30. Type-Specific Extension Tables`, `Locked decisions`, `Page`, `Page`, `Phase CH — Committee Charters & Meeting Cadence — QA Review`, `ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)`, `3.2 `forms.form_versions``, `loading.tsx`, `DepartmentDefDialog`, `32. Implementation Phases`, `Loading`, `Audit feed`, `FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)`, `cases-extras.spec.ts`, `Loading`, `ConfirmDeleteButton`, `W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _15327 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Case Lifecycle Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.014633181728297409 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.030084582852748943 - nodes in this community are weakly interconnected._
- **Should `Shared UI & Phase Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
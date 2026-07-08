# Graph Report - .  (2026-07-08)

## Corpus Check
- Large corpus: 1234 files · ~1,515,786 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 5104 nodes · 15945 edges · 274 communities (261 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.76)
- Token cost: 1,730,922 input · 0 output

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
- Per commission case number minting (advisory lock trigger)
- Free text classified as PHI; two tier detail open audit
- Commission member titles vocabulary (display only)
- ADR 0054
- Phase 0 QA Review — Scaffolding & Environment
- README (Next.js bootstrap)

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 508 edges
2. `cn()` - 344 edges
3. `Button()` - 234 edges
4. `commissionHref()` - 153 edges
5. `getCommissionAccessByOrg` - 112 edges
6. `getSessionContext` - 101 edges
7. `FormBanner()` - 96 edges
8. `NativeSelect()` - 69 edges
9. `DialogContent()` - 62 edges
10. `DialogHeader()` - 62 edges

## Surprising Connections (you probably didn't know these)
- `app.is_commission_admin_of (combined predicate)` --conceptually_related_to--> `Rule 1 — RLS is the security boundary`  [INFERRED]
  docs/backend-state.md → ARCHITECTURE.md
- `Sections (first-class, default section, conditional)` --conceptually_related_to--> `Rule 2 — Canonical DB schema`  [INFERRED]
  CLAUDE.md → ARCHITECTURE.md
- `Phase 1 — Database Schema, Auth & RLS` --implements--> `Rule 2 — Canonical DB schema`  [INFERRED]
  PHASES.md → ARCHITECTURE.md
- `app.answer_map (evaluator input rebuild)` --shares_data_with--> `Condition evaluator (SQL + TS mirror)`  [INFERRED]
  docs/backend-state.md → ARCHITECTURE.md
- `app.answer_map (evaluator input rebuild)` --conceptually_related_to--> `answer-model-v2 (uniform answer row + typed shadow cols)`  [INFERRED]
  docs/backend-state.md → ARCHITECTURE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **PHI isolation + single-door + audit posture** — architecture_phi_hipaa_handling, architecture_event_patient, docs_backend_state_dispose_event_phi, architecture_auditability [EXTRACTED 0.90]
- **Condition evaluation flow (shape, evaluator, submit, ADR)** — architecture_visible_when, architecture_condition_evaluator, architecture_submit_response_rpc, docs_decisions_0005_visible_when_shape_adr [EXTRACTED 0.90]
- **Auth gate & identity flow (hook, JWT-local-verify, middleware)** — docs_decisions_0002_admin_claim_access_token_hook_adr, docs_decisions_0009_jwt_local_verification_gate_adr, docs_decisions_0007_middleware_coarse_gate_root_landing_adr [EXTRACTED 0.90]
- **PHI isolation + audited single-door read pattern (Rule 12)** — docs_decisions_0031_event_custody_ledger_and_phi_isolation_event_patient, docs_decisions_0036_phi_access_hardening_single_door_get_event_patient, docs_decisions_0037_inter_committee_case_referrals_referral_patient, docs_decisions_0030_patient_safety_phi_and_pqs_architecture_rule_12 [INFERRED 0.85]
- **Multi-phase Case subsystem (phases, status, blocking, outcomes, narratives, access)** — docs_decisions_0017_multi_phase_cases_case_phase_model, docs_decisions_0024_case_model_adjustments_phase_blocking, docs_decisions_0024_case_model_adjustments_case_outcomes, docs_decisions_0032_case_narratives_case_narratives, docs_decisions_0033_case_access_control_can_read_case [INFERRED 0.85]
- **SECURITY DEFINER read / participant-write predicate family** — docs_decisions_0016_signoff_definer_read_path_get_response_for_signoff, docs_decisions_0025_meetings_sign_meeting_definer, docs_decisions_0026_interviews_can_write_interview, docs_decisions_0033_case_access_control_can_read_case [INFERRED 0.80]
- **The three PHI modules (isolated satellite + audited door + disposal)** — docs_decisions_0038_case_patient_identifiers_case_patient, docs_decisions_0038_case_patient_identifiers_dispose_case_phi, docs_decisions_0052_nsp_per_hospital_dispose_referral_phi, docs_decisions_0056_phi_disposal_closure_narrowed_claim_phi_disposal_closure [INFERRED 0.85]
- **Tenancy scope progression: multi-tenancy to NSP-per-org to NSP-per-hospital** — docs_decisions_0041_multi_tenancy_organizations_hospitals_multi_tenancy, docs_decisions_0042_nsp_per_org_nsp_per_org, docs_decisions_0051_hospital_admin_tier_and_hospital_audit_tier_hospital_admin, docs_decisions_0052_nsp_per_hospital_nsp_per_hospital [EXTRACTED 0.90]
- **Single condition evaluator reused across features (no drift)** — docs_decisions_0040_form_builder_enhancements_condition_engine_eval_condition, docs_decisions_0043_phase_result_based_recommendation_recompute_recommendations, docs_decisions_0045_answer_model_v2_answer_map [EXTRACTED 0.85]
- **NSP Patient-Safety Event → Triage → RCA → CAPA Flow** — docs_phases_accreditation_track_phase14_nsp, docs_design_readme_triage_spec, docs_design_readme_rca_spec, docs_phases_accreditation_track_capa_reusable_primitive [EXTRACTED 0.90]
- **Guarded-DEFINER-Door Membership Security Pattern** — docs_decisions_0061_administrativo_delegated_role_guarded_definer_door, docs_plans_membership_write_path_lockdown_definer_only_door, docs_plans_membership_write_path_lockdown_deny_self_grant, docs_phases_case_access_control_case_access_table [INFERRED 0.80]
- **Answer-Model v2 Forward-Compatibility Foundation** — docs_plans_answer_model_v2_uniform_answer_row, docs_plans_answer_model_v2_typed_columns, docs_plans_answer_model_v2_response_group_instances, docs_decisions_0060_flexible_forms_foundation_adr [EXTRACTED 0.85]
- **LGPD PHI-disposal doors (event/case/referral)** — docs_progress_case_patient_dispose_event_phi, docs_progress_follow_ups_archive_dispose_referral_phi, docs_plans_pre_pilot_db_hardening_program_ws4_phi_disposal_completion [INFERRED 0.80]
- **Answer-model refactors preserving evaluator parity** — docs_progress_answer_model_v2_evaluator_byte_unchanged, docs_progress_answer_model_v2_answer_map_golden, docs_progress_form_model_normalization_answer_map_rewrite, docs_progress_form_builder_enhancements_condition_builder [INFERRED 0.80]
- **Hospital-tier governance (admin/audit/NSP/roles)** — docs_progress_hospital_admin_tier_hospital_admin_tier, docs_progress_hospital_roles_nsp_titles_design_hospital_roles_nsp_titles_design, docs_progress_nsp_per_hospital_design_nsp_per_hospital, docs_progress_hospital_admin_tier_four_tier_audit [INFERRED 0.85]
- **NSP patient-safety pipeline (event→triage→RCA→CAPA)** — docs_progress_phase_14a_nsp_foundation, docs_progress_phase_14bcd_event_triage, docs_progress_phase_14bcd_rca_workspace, docs_progress_phase_14bcd_capa_plan [EXTRACTED 0.90]
- **Per-org/per-hospital PHI door re-key across modules** — docs_progress_nsp_per_org_design_is_pqs_member_of, docs_progress_phase_14a_can_read_event, docs_progress_phase_22_referral_patient_phi, docs_progress_phase_23_patient_xref, docs_progress_nsp_per_hospital_rekey [INFERRED 0.80]
- **Shared condition-evaluator reuse (SQL↔TS mirror)** — docs_progress_phase_1_condition_evaluator, docs_progress_phase_5_evalcondition_ts_mirror, docs_progress_phase_7_recommend_when, docs_progress_phase_8_dashboard_distributions [EXTRACTED 0.85]
- **Pre-pilot critical hardening set (audit findings to Wave-1 remediation)** — docs_reviews_external_db_audit_2026_07_c3_self_escalation, docs_reviews_external_db_audit_2026_07_c4_forgeable_audit, docs_reviews_external_db_audit_2026_07_c6_incomplete_disposal, docs_progress_pre_pilot_hardening_wave1_membership_write_path_lockdown, docs_progress_pre_pilot_hardening_wave1_log_audit_access_entitlement_guard, docs_progress_pre_pilot_hardening_wave1_phi_disposal_closure [INFERRED 0.85]
- **PHI module isolation + audited-single-door pattern** — docs_reviews_case_patient_review_case_patient, docs_reviews_case_patient_review_get_case_patient, docs_reviews_case_patient_review_dispose_case_phi, docs_progress_phase_b_handoff_dispose_referral_phi [INFERRED 0.80]
- **Case access predicate spine + expiry consulters** — docs_reviews_case_access_control_review_case_access_control, docs_reviews_case_access_control_review_case_access_table, docs_reviews_action_items_fold_review_case_access_expiry, docs_reviews_case_patient_review_can_read_case_patient [INFERRED 0.85]
- **PHI-module isolation pattern (dedicated table + audited single door)** — docs_reviews_phase_14a_review_event_patient_phi_isolation, docs_reviews_phase_22_review_referral_patient_phi, docs_reviews_phase_23_review_patient_xref, docs_reviews_architecture_rule_12_phi [INFERRED 0.85]
- **Tamper-evident audit stack (hash chain + append-only guard + metadata allow-list + verify RPC)** — docs_reviews_phase_13_review_hash_chain, docs_reviews_phase_13_review_append_only_guard, docs_reviews_phase_13_review_metadata_allowlist, docs_reviews_phase_13_review_verify_audit_chain, docs_reviews_architecture_rule_11_audit [EXTRACTED 0.90]
- **Tenant-isolation predicate evolution (org-admin → hospital-admin → per-hospital NSP)** — docs_reviews_multitenancy_review_org_admin_predicate_family, docs_reviews_hospital_admin_tier_review_is_commission_admin_of, docs_reviews_nsp_per_hospital_review_is_pqs_member_of, docs_reviews_multitenancy_review_platform_admin_wall [INFERRED 0.80]
- **In-Progress Answers Invariant Defended Across Phases 6/7/8** — docs_reviews_phase_6_review_signoffs_insert_select_rewrite, docs_reviews_phase_7_review_in_progress_answers_invariant, docs_reviews_phase_8_review_dashboard_definer_rpc_gating [INFERRED 0.85]
- **PHI Disposal + Single-Audited-Door Pattern** — docs_reviews_phi_remediation_review_get_event_patient_single_door, docs_reviews_phi_remediation_review_dispose_event_phi, docs_reviews_pre_pilot_hardening_wave1_review_dispose_case_phi [INFERRED 0.80]
- **Single Condition Evaluator Reused (Wizard + Recommendations + Results)** — docs_reviews_phase_5_review_condition_evaluator_single_authority, docs_reviews_result_rec_review_synthetic_map_evaluator_reuse, docs_reviews_phase_results_review_walk_result_ruleset [INFERRED 0.80]
- **Case triage classification badges (harm, preventability, status, sentinel)** — docs_design_dashboard_kpi_harm_badge, docs_design_dashboard_kpi_preventability_badge, docs_design_dashboard_kpi_status_badge, docs_design_dashboard_kpi_sentinel_flag [INFERRED 0.85]
- **M&M committee KPI overview metrics** — docs_design_dashboard_kpi_kpi_awaiting_screening, docs_design_dashboard_kpi_kpi_on_next_agenda, docs_design_dashboard_kpi_kpi_under_review, docs_design_dashboard_kpi_kpi_overdue_review, docs_design_dashboard_kpi_kpi_closed_ytd, docs_design_dashboard_kpi_kpi_preventable_rate [EXTRACTED 1.00]

## Communities (274 total, 13 thin omitted)

### Community 0 - "Case Lifecycle Actions"
Cohesion: 0.05
Nodes (84): AddAdHocNarrativeDialog(), AddAdHocPhaseDialog(), CancelCaseButton(), ADR-0032, ADR-0033, DetailPhase, ADR-0033, ADR-0061 (+76 more)

### Community 1 - "Admin & Auth Pages"
Cohesion: 0.06
Nodes (70): AdminOrganizationsPage(), metadata, metadata, CommissionEditForm(), ConfirmRemoveButton(), StaffAdminManager(), LoginForm(), ResetRequestForm() (+62 more)

### Community 2 - "Shared UI & Phase Dialogs"
Cohesion: 0.09
Nodes (55): BannerTone, FormBanner(), toneStyles, ActivatePhaseDialog(), defaultDueDateValue(), ACCEPT, DOC_TYPES, EVENT_KINDS (+47 more)

### Community 3 - "Error & Not-Found Boundaries"
Cohesion: 0.04
Nodes (6): ADR-0033, Mode, SectionTextEditor(), AccessAuditTable(), formatDateTime(), Button()

### Community 4 - "Condition & Result Rule Editor"
Cohesion: 0.05
Nodes (66): ADR-0005, TOKEN_COLOR_VAR, SectionConditionFields(), AGGREGATE_OPS, aggregateKeyFor(), AllowedResultsPicker(), AutomaticEditor(), Criterion (+58 more)

### Community 5 - "Phase Answers & Assignments"
Cohesion: 0.05
Nodes (66): metadata, PhaseAnswersPage(), AssigneeAvatar(), GrantExpiry(), ACTIVE_OR_PENDING, activePhases(), blockedBy(), BoardPhase (+58 more)

### Community 6 - "Triage Disposition & Pathways"
Cohesion: 0.07
Nodes (57): DispositionRail(), NON_RCA_PATHWAYS, Pill(), HARM_DEFINITIONS, HarmScale(), ChoiceCard(), CLOSURE_DESCRIPTIONS, CLOSURE_ORDER (+49 more)

### Community 7 - "Case Documents"
Cohesion: 0.05
Nodes (55): LevelOption(), CaseDocumentUpload(), CaseDocumentsPanel(), ADR-0033, DOC_TYPE_LABEL, NarrativeAssignMenu(), CasePhaseArticle(), DetailPhase (+47 more)

### Community 8 - "RCA Problem Stage"
Cohesion: 0.06
Nodes (52): ProblemCard(), ProblemStage(), RcaMemberRoleBadge(), RcaStatusChip(), STATUS_CLASS, countDone(), deriveDone(), deriveKeyFactors() (+44 more)

### Community 9 - "Form Builder Actions"
Cohesion: 0.07
Nodes (60): ADR-0011, addItem(), addSection(), ALL_ITEM_TYPES, ALLOWED_IMAGE_MIME, authorizeCommission(), CHOICE_TYPES, COLOR_OPTION_TYPES (+52 more)

### Community 10 - "Submission Detail (Answer Model)"
Cohesion: 0.05
Nodes (55): ADR-0045, formatDateTime(), metadata, resolveImageUrls(), SubmissionDetailPage(), metadata, resolveImageUrls(), ReviewAndSignPage() (+47 more)

### Community 11 - "Section Visibility & Blocks"
Cohesion: 0.08
Nodes (46): item(), SectionConditionBadge(), BlockRenderer(), CHOICE_TYPES, computeEffectiveVisibility(), EffectiveVisibility, INPUT_ITEM_TYPES, INPUT_TYPES (+38 more)

### Community 12 - "CAPA Badges"
Cohesion: 0.06
Nodes (51): CapaActionStatusChip(), CapaClassificationChip(), CapaSourceBadge(), CapaStatusChip(), CapaStrengthPill(), CapaVerdictChip(), STATUS_ICON, STRENGTH_ICON (+43 more)

### Community 13 - "NSP Event Pages"
Cohesion: 0.08
Nodes (47): CommissionEventsPage(), metadata, metadata, NspEventDetailPage(), EventStatusChip(), OwnerChip(), STATUS_ICON, SuspectedHarmChip() (+39 more)

### Community 14 - "RCA Analysis Stage"
Cohesion: 0.09
Nodes (46): AnalysisStage(), SubView, Tab(), CatBlock(), CauseCard(), Fishbone(), RootCauseTypePill(), CATEGORY_VISUAL (+38 more)

### Community 15 - "Case Department Field"
Cohesion: 0.08
Nodes (30): CaseDepartmentField(), DEPARTMENTS, ADR-0061, TOKEN_STYLES, TemplateOption, ADR-0038, ADR-0061, OutcomeDefDialog() (+22 more)

### Community 16 - "Referral Detail & Formatting"
Cohesion: 0.08
Nodes (43): metadata, ReferralDetailPage(), formatCaseNumber(), formatDate(), formatDateTime(), formatFileSize(), formatReferralCode(), referralStatusChipClass() (+35 more)

### Community 17 - "Staff Case Detail"
Cohesion: 0.08
Nodes (42): metadata, roleFromCapabilities(), StaffCaseDetailPage(), ADR-0033, ADR-0061, CommissionLayout(), ADR-0033, metadata (+34 more)

### Community 18 - "Org Overview Dashboard"
Cohesion: 0.07
Nodes (36): metadata, OrgOverviewPage(), CHART_COLORS, CommissionOverview(), DashboardCharts(), groupBySection(), SectionEntry, SectionGroupData (+28 more)

### Community 19 - "Quality Indicators"
Cohesion: 0.08
Nodes (42): IndicatorsPage(), metadata, formatIndicatorValue(), formatPeriodLabel(), formatTarget(), IndicatorKindBadge(), MeasurementStatusChip(), STATUS_STYLES (+34 more)

### Community 20 - "NSP Patient Registry"
Cohesion: 0.08
Nodes (42): metadata, NspPatientsPage(), parseEntityParam(), ADR-0039, ADR-0052, VALID_MODULES, formatDate(), patientModuleChipClass() (+34 more)

### Community 21 - "Form Builder Page"
Cohesion: 0.07
Nodes (42): BuilderPage(), metadata, resolveImageUrls(), DATE_FMT, metadata, resolveImageUrls(), VersionsPage(), FormCard() (+34 more)

### Community 22 - "CAPA Actions & Closure"
Cohesion: 0.09
Nodes (41): CapaActionForm(), userLabel(), CapaActionsSection(), CapaClosurePanel(), GateRow(), activePdcaStage(), allActionsSettled(), allMeasuresHaveResults() (+33 more)

### Community 23 - "My Cases List"
Cohesion: 0.06
Nodes (42): metadata, MyCasesPage(), ADR-0033, OutcomeBreakdownRow, FilterChip(), hasOpenAssignment(), isOpenCase(), MyCasesFilter() (+34 more)

### Community 24 - "Auth Callback & Meeting Settings"
Cohesion: 0.17
Nodes (42): GET(), SUCCESS_REDIRECT, LegacyMeetingsSettingsPage(), AgendaRow(), UploadDialog(), AttendeeRow(), addMeetingAttendee(), archiveMeetingType() (+34 more)

### Community 25 - "Referral Actions & Reply"
Cohesion: 0.11
Nodes (38): LinkableTargetCase, ReferralActions(), getReferralPatient(), acceptReferral(), addReferralReplyAttachment(), addReferralSharedItem(), concludeReferral(), createReferralDraft() (+30 more)

### Community 26 - "NSP Referrals Dashboard"
Cohesion: 0.07
Nodes (37): deriveFlowMetrics(), metadata, NspReferralsDashboardPage(), ADR-0042, buildCaseReferralsModule(), NOTE: the safety-event PHI pre-fill is intentionally NOT assembled here — the, AGING_BUCKETS, CHART_COLORS (+29 more)

### Community 27 - "Case & Phase Actions"
Cohesion: 0.11
Nodes (40): CreateCaseDialog(), ActionState, activatePhase(), addAdHocPhase(), AddAdHocPhaseState, authorizeCommission(), cancelCase(), closeCase() (+32 more)

### Community 28 - "Meeting Detail & Agenda"
Cohesion: 0.07
Nodes (38): MeetingsSettingsTabPage(), MeetingDetailPage(), metadata, AgendaPanel(), AttachmentUpload(), CaseLinker(), formatCaseNumber(), LinkCaseDialog() (+30 more)

### Community 29 - "NSP CAPA/RCA Pages"
Cohesion: 0.10
Nodes (38): metadata, NspCapaPage(), metadata, NspRcaPage(), auditClinicalView(), getCapaEffectiveness(), getCapaPlan(), listCapaActionEvidence() (+30 more)

### Community 30 - "CAPA Evidence & Cards"
Cohesion: 0.13
Nodes (37): CapaActionCard(), CapaEvidenceLinkForm(), CapaEvidenceUpload(), CapaEvidenceList(), CancelButton(), ReopenButton(), CapaTaskList(), RcaConfirmDelete() (+29 more)

### Community 31 - "Case Narrative Editor"
Cohesion: 0.08
Nodes (31): metadata, NarrativeEditorPage(), ADR-0033, CaseNarrativesBuilderPage(), metadata, ADR-0032, CaseNarrativeCard(), CasePhaseList() (+23 more)

### Community 32 - "Form Item Editor & Tests"
Cohesion: 0.08
Nodes (22): SECTION, AnswerSummary(), formatIsoDate(), renderValue(), CheckboxGroup(), ChoiceGroup(), DateTimeItem(), DropdownItem() (+14 more)

### Community 33 - "Submission Detail Blocks"
Cohesion: 0.07
Nodes (24): formatDateTime(), SectionBody(), SignoffMeta(), SubmissionDetailView(), FLAGGED_OPS, FlaggedWhenEditor(), OP_LABELS, ImageItemEditor() (+16 more)

### Community 34 - "Phase Responder & Submissions"
Cohesion: 0.10
Nodes (29): metadata, PhaseResponderPage(), SubmissionsPage(), metadata, NewCommissionEventPage(), metadata, ResponderPage(), metadata (+21 more)

### Community 35 - "Case Narrative Cards"
Cohesion: 0.16
Nodes (36): ADR-0032, ADR-0033, ConcludeNarrativeButton(), caseAccessEnabled(), addAdHocNarrative(), addTemplateNarrative(), archiveNarrativeType(), assignNarrative() (+28 more)

### Community 36 - "Phase Result Actions"
Cohesion: 0.14
Nodes (36): archivePhaseResult(), authorizeCommission(), commissionOfCasePhase(), commissionOfResult(), createPhaseResult(), mapOverrideError(), mapVocabError(), MESSAGES (+28 more)

### Community 37 - "Admin Layout & Claims"
Cohesion: 0.08
Nodes (32): ADR-0002, AdminLayout(), ADR-0042, commissionInitials(), CommissionPickerPage(), metadata, ROLE_LABEL, slugifyHeading() (+24 more)

### Community 38 - "Interview & Agenda Forms"
Cohesion: 0.10
Nodes (28): react, InterviewFormDialog(), AgendaItemForm(), ConfirmDeleteButton(), toDateTimeLocalValue(), HeldWindowFields(), isFuture(), localToIso() (+20 more)

### Community 39 - "Forms & Process Templates"
Cohesion: 0.12
Nodes (28): FormsListPage(), metadata, metadata, ProcessTemplateBuilderPage(), CaseOutcomesSettingsPage(), metadata, CaseTagsSettingsPage(), metadata (+20 more)

### Community 40 - "Derived Indicator Config"
Cohesion: 0.09
Nodes (29): DerivedConfigPicker(), CHOICE_TYPES, questionKindOf(), PickerForm, PickerOption, PickerQuestion, allowedSources(), BuilderFields() (+21 more)

### Community 41 - "Meeting Attendees & Quorum"
Cohesion: 0.09
Nodes (29): ADR-0025, AttendeeForm(), AttendeeMemberOption, AttendeesPanel(), QuorumSummary(), ActionItemStatusBadge(), AttendanceBadge(), ACTION_ITEM_STATUS_LABEL (+21 more)

### Community 42 - "Hospital Detail Pages"
Cohesion: 0.10
Nodes (25): OrgCommissionDetailError(), HospitalDetailPage(), metadata, OrgManageLayout(), ADR-0051, OrgNspAdminLayout(), ADR-0052, HospitalList() (+17 more)

### Community 43 - "Narrative Templates"
Cohesion: 0.10
Nodes (26): ArchiveNarrativeTypeButton(), useNarrativeAction(), ArchiveTemplateButton(), CollectsPatientPicker(), NarrativeSlotCard(), NarrativeSlotDialog(), PhaseBlocksEditor(), PhaseSlotCard() (+18 more)

### Community 44 - "Event Notification & Triage"
Cohesion: 0.12
Nodes (30): AcknowledgeButton(), casePatientToDraft(), EventNotifyForm(), HARM_ORDER, ADR-0038, PatientDraft, patientDraftHasData(), patientDraftToInput() (+22 more)

### Community 45 - "Page"
Cohesion: 0.11
Nodes (26): metadata, OrgCommissionsPage(), ADR-0051, AREAS, ManageArea, metadata, OrgManageHomePage(), ADR-0051 (+18 more)

### Community 46 - "Page"
Cohesion: 0.11
Nodes (28): metadata, PrimeiroAcessoPage(), metadata, OrgNspCoordinationPage(), ADR-0052, metadata, OrgHospitalsPage(), OrgCommissionCreateForm() (+20 more)

### Community 47 - "Layout"
Cohesion: 0.09
Nodes (28): CaseDetailLayout(), ADR-0032, ADR-0033, ADR-0038, ADR-0061, ManageMembersPage(), metadata, ADR-0061 (+20 more)

### Community 48 - "Page"
Cohesion: 0.13
Nodes (24): CaseTimelinePage(), metadata, CaseTimeline(), OPTIONS, TimelineDensity, TimelineDensitySwitch(), TimelineEventSheet(), TimelineLegend() (+16 more)

### Community 49 - "IsTerminalMeetingStatus"
Cohesion: 0.09
Nodes (30): isTerminalMeetingStatus(), MeetingLifecycleActions(), ActionState, AddAttendeeState, AgendaItemInput, ALLOWED_ATTACHMENT_MIME, ATTACHMENT_KINDS, AttendeeInput (+22 more)

### Community 50 - "Page"
Cohesion: 0.11
Nodes (24): metadata, OrgUsersPage(), ADR-0051, UserDirectoryList(), UserDirectorySearch(), UserPagination(), STATUS_LABEL, STATUS_STYLES (+16 more)

### Community 51 - "UserLifecycleActions"
Cohesion: 0.16
Nodes (29): UserLifecycleActions(), createAdminClient(), ActionState, appOrigin(), assignCommitteeRole(), authorizeForCommission(), authorizeForUser(), authorizeHospitalOps() (+21 more)

### Community 52 - "Page"
Cohesion: 0.12
Nodes (23): metadata, MyActionItemsPage(), ActionItemSourceBadge(), ActionItemStatusBadge(), SOURCE_META, STATUS_META, ActionItemsTable(), compareItems() (+15 more)

### Community 53 - "Page"
Cohesion: 0.09
Nodes (24): metadata, ADR-0042, metadata, NspTriagePage(), NspOrgRollups(), NspOrgRosterSummary(), PqsInboxFiltersBar(), EventCustodyRow (+16 more)

### Community 54 - "Section signoff fields"
Cohesion: 0.13
Nodes (20): SectionSignoffFields(), WizardData, formatDate(), RespondentContext(), ReviewAndSign(), SectionBody(), ADR-0061, SignRunner() (+12 more)

### Community 55 - "ListMeetings"
Cohesion: 0.11
Nodes (26): listMeetings(), isNspCoordinatorOfHospital(), isPqsMemberOfHospital(), listNspCoordinators(), PQS_INBOX_CURSOR_SCHEMA, pqsInbox(), PqsInboxCursor, PqsInboxRow (+18 more)

### Community 56 - "Page"
Cohesion: 0.16
Nodes (25): metadata, AddVersionForm(), ApprovalSignForm(), ObsoleteDocumentButton(), PublishDocumentDialog(), SubmitForApprovalForm(), SupersedeAction, SupersedeDocumentButton() (+17 more)

### Community 57 - "TitleAssignControl"
Cohesion: 0.12
Nodes (23): TitleAssignControl(), CAPABILITIES, MemberAdministrativoControls(), ADR-0061, MemberList(), ADR-0051, ADR-0061, ROLE_LABEL (+15 more)

### Community 58 - "Condition builder"
Cohesion: 0.13
Nodes (22): CHOICE_OPS, CHOICE_TARGET_TYPES, ConditionBuilder(), DraftRow, isChoiceTarget(), isGroup(), nextUid(), OP_LABELS (+14 more)

### Community 59 - "Interview badges"
Cohesion: 0.12
Nodes (23): ATTACHMENT_KIND_ORDER, INTERVIEW_STATUS_LABEL, INTERVIEW_STATUS_ORDER, INTERVIEW_STATUS_STYLE, INTERVIEWER_ROLE_LABEL, INTERVIEWER_ROLE_ORDER, MODALITY_LABEL, MODALITY_ORDER (+15 more)

### Community 60 - "Page"
Cohesion: 0.10
Nodes (17): metadata, metadata, metadata, Home(), ADR-0051, ADR-0052, PasswordSetForm(), appOrigin() (+9 more)

### Community 61 - "CaseActionItemForm"
Cohesion: 0.11
Nodes (21): CaseActionItemForm(), PhaseOption, isItemOverdue(), STATUS_ORDER, ADR-0033, CaseEventForm(), ACTION_ITEM_STATUS_LABEL, ACTION_ITEM_STATUS_STYLE (+13 more)

### Community 62 - "VersionWithUrl"
Cohesion: 0.12
Nodes (24): VersionWithUrl, APPROVAL_DECISION_LABELS, ApprovalDecision, ControlledDocument, ControlledDocumentDetail, ControlledDocumentListItem, ControlledDocumentVersion, HospitalDocumentRegisterRow (+16 more)

### Community 63 - "UploadDialog"
Cohesion: 0.22
Nodes (24): UploadDialog(), addInterviewInterviewer(), addInterviewLink(), addInterviewSubject(), ALLOWED_ATTACHMENT_MIME, ATTACHMENT_KINDS, authorizeStaffAdmin(), commissionOfCase() (+16 more)

### Community 64 - "Layout"
Cohesion: 0.13
Nodes (17): DocumentsLayout(), IndicatorsLayout(), PendingApprovalsLayout(), metadata, OrgDocumentsPage(), metadata, OrgIndicatorsPage(), HospitalIndicatorScorecard() (+9 more)

### Community 65 - "Page"
Cohesion: 0.21
Nodes (16): metadata, ApprovalDecisionBadge(), ApprovalsPanel(), DocumentStatusChip(), DocumentTypeBadge(), ReviewOverdueChip(), STATUS_CLASSES, DocumentRegisterList() (+8 more)

### Community 66 - "Case tags panel"
Cohesion: 0.20
Nodes (17): ADR-0033, AddBlockMenu(), DISPLAY_TYPES, INPUT_TYPES, ROLE_LABEL, SwitcherItem(), ADR-0041, ADR-0051 (+9 more)

### Community 67 - "Event type manager"
Cohesion: 0.23
Nodes (21): EventTypeManager(), SentinelCriterionManager(), TriageWorkstation(), VocabManager(), mapTriageError(), SAFETY_MESSAGES, ADR-0030, archiveEventType() (+13 more)

### Community 68 - "Page"
Cohesion: 0.17
Nodes (17): metadata, CommissionAuditPage(), metadata, metadata, ADR-0051, AuditEmptyState(), AuditFiltersAsync(), AuditCommissionOption (+9 more)

### Community 69 - "Page"
Cohesion: 0.13
Nodes (20): IndicatorDetailPage(), metadata, ActionItemFallbackDialog(), CapaAffordance(), CreateManualAction, OpenCapaAction, isPqsOperatorOfIndicatorHospital(), ADR-0057 (+12 more)

### Community 70 - "Phase result badge"
Cohesion: 0.20
Nodes (19): PhaseResultBadge(), timelineResultToResolved(), AvatarStack(), DAY_MONTH, DERIVED_PILL, durationSuffix(), formatEventDate(), formatFull() (+11 more)

### Community 71 - "Wizard runner"
Cohesion: 0.18
Nodes (20): saveAndExit, saveSection, signSection, submitCasePhaseResponse, submitResponse, WizardRunner(), ActionState, authorizeMember() (+12 more)

### Community 72 - "Case timeline"
Cohesion: 0.13
Nodes (23): CaseMeetingLink, CaseMeetingLinkRow, CasePhaseTimelineRow, CaseReferralTimelineRow, CaseSafetyEventRow, CaseTimeline, getCaseTimeline(), interviewRegistryEventIds() (+15 more)

### Community 73 - "ADR 0022 — Cross committee case referrals (linked cases)"
Cohesion: 0.14
Nodes (23): ADR 0022 — Cross-committee case referrals (linked cases), app.commission_of_case RLS spine, Linked cases / referrals, not multi-commission shared ownership, ADR 0030 — Patient-Safety PHI Posture Reversal & PQS/NSP Module Architecture, patient_safety_event backbone + event_patient + event_custody, PQS/NSP module (Núcleo de Segurança do Paciente), Event → triage → RCA → CAPA → effectiveness closure framework, Access-follows-custody RLS shape (+15 more)

### Community 74 - "Page"
Cohesion: 0.13
Nodes (20): metadata, ADR-0061, formatMeetingNumber(), formatSchedule(), MeetingStatusBadge(), MeetingTypeChip(), NewMeetingButton(), MeetingHeader() (+12 more)

### Community 75 - "Actions"
Cohesion: 0.15
Nodes (20): ActionState, appOrigin(), assignStaffAdmin(), authorizeStaffAdminOps(), createCommission(), MESSAGES, removeStaffAdmin(), requireAdmin() (+12 more)

### Community 76 - "Components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 77 - "Page"
Cohesion: 0.12
Nodes (18): CasesBoardPage(), metadata, ADR-0038, ADR-0061, metadata, ProcessTemplatesListPage(), computeOutcomeBreakdown(), CasesKpiStrip() (+10 more)

### Community 78 - "Interim multi org PHI guard (is multi org)"
Cohesion: 0.13
Nodes (21): Interim multi-org PHI guard (is_multi_org), Multi-tenancy: organizations to hospitals to commissions, app.is_org_admin_of_commission predicate, /o/[org]/c/[commission] URL scheme, Pooled single-database silo-by-exception, platform_admin vs org_admin role split, Scope the is_admin() OR-term, don't rewrite every policy, 3-tier audit hash chain (+13 more)

### Community 79 - "Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, class-variance-authority, clsx, date-fns, gsap, lucide-react, next, radix-ui (+13 more)

### Community 82 - "Route"
Cohesion: 0.14
Nodes (18): csvField(), GET(), toCsv(), ADR-0020, ADR-0029, RFC-4180, csvField(), GET() (+10 more)

### Community 83 - "ActionItemRow"
Cohesion: 0.22
Nodes (19): ActionItemRow(), ACTION_ITEM_STATUSES, ActionState, advanceActionItem(), authorizeCommission(), commissionOfCase(), completeActionItem(), contextOfItem() (+11 more)

### Community 84 - "CaseActionItemsPanel"
Cohesion: 0.16
Nodes (19): CaseActionItemsPanel(), CaseReferralsModule, ADR-0032, ADR-0038, ADR-0061, CaseOfferedOutcomesEditor(), CaseOutcomeSelector(), CaseOutboundReferralsCard() (+11 more)

### Community 85 - "Case document delete"
Cohesion: 0.20
Nodes (19): CaseDocumentDelete(), UploadDialog(), ConfirmDeleteButton(), ActionState, ALLOWED_DOC_MIME, authorizeCommission(), commissionOfCase(), createCaseEvent() (+11 more)

### Community 86 - "Gantt axis"
Cohesion: 0.20
Nodes (20): addDays(), Axis, AxisColumn, AxisGroup, AxisUnit, buildAxis(), buildDayAxis(), buildMonthAxis() (+12 more)

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
Cohesion: 0.15
Nodes (17): metadata, NspConfigPage(), ADR-0052, metadata, NspRosterPage(), ADR-0052, personLabel(), PqsRosterManager() (+9 more)

### Community 91 - "Recommend when editor"
Cohesion: 0.14
Nodes (15): ConditionRow(), condToRow(), DraftRow, emptyRow(), initialToRows(), isLegacySingle(), nextUid(), RecommendWhenEditor() (+7 more)

### Community 92 - "ADR 0043 phase result based recommendation"
Cohesion: 0.12
Nodes (19): ADR 0043 phase-result-based recommendation, RecommendGroup + evalRecommendation mirror, recommend-when-editor group builder, Result-based phase recommendation (recommend_when), Flagged + aggregate result criteria (__total_score__/__flagged_count__), ADR 0045 answer-model-v2, ADR 0046 forward-compat form capabilities, Answer model v2 (uniform answers + typed values) (+11 more)

### Community 93 - "Page"
Cohesion: 0.16
Nodes (16): CommissionReferralsPage(), metadata, NspConsoleLayout(), ADR-0052, NspInboxPage(), ReferralsHubSections(), CapaHeader(), NSP_NAV_ITEMS (+8 more)

### Community 94 - "Page"
Cohesion: 0.16
Nodes (17): asDocStatus(), asDocType(), DOC_STATUSES, DOC_TYPES, DocumentsPage(), metadata, DOC_STATUSES, DOC_TYPES (+9 more)

### Community 95 - "Page"
Cohesion: 0.17
Nodes (16): metadata, OrgAdministratorsPage(), ADR-0051, ADR-0052, OrganizationList(), getOrgCommissionOverview(), listHospitalAdmins(), listNspOrgAdmins() (+8 more)

### Community 96 - "Page"
Cohesion: 0.16
Nodes (16): metadata, OrgNspCoordinatorsPage(), metadata, OrgNspOverviewPage(), personLabel(), ADR-0052, NspOrgHospitalManager(), getNspOrgCapaRollup() (+8 more)

### Community 97 - "ActionItemForm"
Cohesion: 0.15
Nodes (15): ActionItemForm(), AssigneeOption, ActionItemRow(), ActionItemsPanel(), isItemOverdue(), STATUS_ORDER, formatDueDate(), advanceMeetingActionItem() (+7 more)

### Community 98 - "Referral patient fields"
Cohesion: 0.16
Nodes (16): EMPTY_REFERRAL_PATIENT_DRAFT, ReferralPatientDraft, referralPatientDraftHasData(), referralPatientDraftToInput(), ReferralPatientFields(), SEX_ORDER, ADR-0037, NOTE: removal is a hub-draft affordance in v1; here we only ADD. Toggling (+8 more)

### Community 99 - "ClampCalloutCenter"
Cohesion: 0.21
Nodes (16): clampCalloutCenter(), TimelineFeed(), AxisHeader(), GanttRow(), Marker(), PhaseBar(), Pin(), ROW_H (+8 more)

### Community 100 - "Actions"
Cohesion: 0.26
Nodes (18): archiveIndicator(), computeDerivedMeasurement(), createIndicator(), KNOWN_PT_BR_HC084, mapIndicatorError(), MESSAGES, openCapaFromIndicator(), parseDate() (+10 more)

### Community 101 - "Access Follows Custody Ledger"
Cohesion: 0.18
Nodes (18): Access-Follows-Custody Ledger, capa_plan Reusable Primitive, Governance/Quality-Layer Positioning, Phase 13 — Audit Trail (hash-chained), Phase 14 — Patient-Safety Events/Triage/RCA/CAPA (NSP), Phase 15 — Quality Indicators, Phase 16 — Standards Crosswalk & Readiness/Gap Engine, Phase 17 — Controlled-Document Lifecycle (+10 more)

### Community 102 - "Broad can read case read predicate"
Cohesion: 0.13
Nodes (17): Broad can_read_case read predicate, case_patient (third PHI module), process_templates.collects_patient toggle, dispose_case_phi, Fixed 8-field identifier catalog, Reveal-on-demand PHI panel, app.can_read_action_item predicate, case_access grant expiry + reason (+9 more)

### Community 103 - "ADR 0061: Administrativo Delegated Role"
Cohesion: 0.16
Nodes (17): ADR 0061: Administrativo Delegated Role, Administrativo Curated Capability Menu, Guarded-DEFINER-Door Authorization Pattern, Title-vs-Authority Decoupling, can_read_case / can_write_case_content Predicates, case_access Per-Case ACL Table, Contract-First Typed-Stub Sequencing, Meus Casos View (attribution-driven) (+9 more)

### Community 104 - "ADR 0053"
Cohesion: 0.15
Nodes (17): ADR 0053, ADR 0055, audit_log REVOKE + TRUNCATE guard (C-1), capa_plan.hospital_id + scoped can_write_capa (D4/H-8), Default-privilege revoke-and-grant-per-object (C-2), Pre-Pilot DB Hardening Wave 1, log_audit_access entitlement guard (C-4), Membership write-path lockdown (C-3/WS-1) (+9 more)

### Community 105 - "Page"
Cohesion: 0.18
Nodes (14): metadata, MyPhasesPage(), ADR-0033, ActionState, authorizeCommission(), CaseAccessLevel, commissionOfCase(), grantCaseAccess() (+6 more)

### Community 106 - "Outcomes actions"
Cohesion: 0.30
Nodes (16): ActionState, archiveCaseOutcome(), authorizeCommission(), commissionOfCase(), commissionOfOutcome(), commissionOfTemplate(), createCaseOutcome(), mapOutcomeError() (+8 more)

### Community 107 - "ADR 0016 — SECURITY DEFINER read path for staff admin sign off"
Cohesion: 0.15
Nodes (16): ADR 0016 — SECURITY DEFINER read path for staff_admin sign-off, get_response_for_signoff DEFINER RPC, in_progress-answer invariant (staff_admin cannot read another member's draft answers), list_signoff_queue DEFINER RPC, Narrow purpose-limited DEFINER read exception instead of broadening RLS, v1 limitation: no answer-lock between sign-off and submission, ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures), guard_meeting_child_lock (ignores in_meeting_rpc) (+8 more)

### Community 108 - "Audit motion"
Cohesion: 0.25
Nodes (10): AuditMotion(), CaseDetailMotion(), FALLBACK_MS, getMotionDurations(), Gsap, MOTION_EASE, readDurationMs(), RiseInGroup() (+2 more)

### Community 109 - "CaseTagsPanel"
Cohesion: 0.29
Nodes (15): CaseTagsPanel(), ActionState, archiveCaseTag(), assignCaseTag(), authorizeCommission(), commissionOfCase(), commissionOfTag(), createCaseTag() (+7 more)

### Community 110 - "DepartmentDefDialog"
Cohesion: 0.26
Nodes (12): DepartmentDefDialog(), ArchiveDepartmentButton(), DepartmentsManager(), useDepartmentAction(), archiveDepartment(), createDepartment(), DepartmentActionState, mapDepartmentError() (+4 more)

### Community 111 - "ADR 0050"
Cohesion: 0.20
Nodes (12): ADR-0050, ADR-0033, CaseAccessPanel(), ExpiryPreset, GrantDialog(), isoDaysFromNow(), isoTomorrow(), ADR-0033 (+4 more)

### Community 112 - "ADR 0028 — Accreditation & Quality Governance Roadmap (Phases 13 21)"
Cohesion: 0.14
Nodes (15): ADR 0028 — Accreditation & Quality-Governance Roadmap (Phases 13-21), No-patient-data / governance-layer positioning (later superseded), ONA / JCI / ANVISA-RDC accreditation regimes, Nine-phase Accreditation & Quality-Governance Track, ADR 0029 — Audit Trail: Hash-Chained, Trigger-Captured, Append-Only, ALCOA+ data-integrity principle, public.audit_log (append-only hash-chained), Non-sensitive column allow-list boundary (no PHI/free-text in metadata) (+7 more)

### Community 113 - "45 Gap Partner Model Disposition"
Cohesion: 0.17
Nodes (15): 45-Gap Partner-Model Disposition, ADR 0060: Flexible-Forms Foundation, Prepare-Now/Build-Later Pre-Pilot Schema Strategy, question_key Aggregation Invariant (Rec A), Standalone-Submission Correction Gap (reopen_response), Single form_blocks Abstraction, Immutable Form-Version Principle, Forms & Answers Data Model (ChatGPT) (+7 more)

### Community 114 - "Compute derived measurement (parity lock vs dashboard)"
Cohesion: 0.16
Nodes (15): compute_derived_measurement (parity lock vs dashboard), Phase 22 — Inter-Committee Case Referrals, close_case HC076 outstanding-reply block, Frozen point-in-time snapshot channel, QPS (is_pqs_member) full-trajectory macro view, Narrow DEFINER sign-off queue read path, HC0xx custom SQLSTATE class remap (ADR 0018), in_progress-answers cross-member invariant (+7 more)

### Community 115 - "Page"
Cohesion: 0.19
Nodes (10): metadata, formatDateTime(), SubmissionRow(), SubmissionsFiltersAsync(), SubmissionsFilters(), CursorPagination(), listSubmissionFilterForms(), listSubmissionFilterMembers() (+2 more)

### Community 116 - "Audit feed"
Cohesion: 0.30
Nodes (13): AuditRow(), actionLabel(), AuditLabelMap, DATE_TIME, displayValue(), entityLabel(), formatAbsolute(), formatRelative() (+5 more)

### Community 117 - "Browser"
Cohesion: 0.19
Nodes (10): ADR-0009, updateSession(), Database, AUTHED_REDIRECT_AWAY, config, isPublicPath(), proxy(), PUBLIC_PATHS (+2 more)

### Community 118 - "Answer map golden parity pgTAP (60 answer map golden)"
Cohesion: 0.19
Nodes (14): answer_map golden parity pgTAP (60_answer_map_golden), Answer-Model v2 (ADR 0045/0046), Evaluator byte-for-byte unchanged invariant (Rule 3), Answer-Model v2 machine-switch handoff, Typed scalar shadow columns (value_number/date/time), Uniform answer row (answer_selected_options re-keyed), Migration squash to domain-partitioned baseline, app.answer_map rewrite (question_key→code parity) (+6 more)

### Community 119 - "QA Verdicts Archive"
Cohesion: 0.16
Nodes (14): QA Verdicts Archive, ADR 0050 action-items fold, case_access grant expiry (six-consulter lockout), Existence leak closed (case_restricted invisibility), QA Review: Action-Items Fold + visibility_scope + Case-Access Expiry, visibility_scope scope-aware RLS, ADR 0033 case-access-control, Case Access Control (can_read_case predicate spine) (+6 more)

### Community 120 - "AdminAuditPage"
Cohesion: 0.20
Nodes (12): AdminAuditPage(), formatDate(), generateMetadata(), OrgCommissionDetailPage(), AdminCommissionDetail, AdminCommissionListItem, CommissionRow, getCommissionForAdmin() (+4 more)

### Community 121 - "Page"
Cohesion: 0.20
Nodes (10): DashboardPage(), metadata, DashboardForms(), IndicatorsPanelAsync(), IndicatorsPanel(), IndicatorKpis, getFormDashboard(), listDashboardForms() (+2 more)

### Community 122 - "Page"
Cohesion: 0.21
Nodes (10): buildCards(), CommissionHomePage(), formatNextMeeting(), metadata, OverviewCardData, StatCount(), getMemberOverview(), MemberOverview (+2 more)

### Community 123 - "BlockConditionNote"
Cohesion: 0.22
Nodes (11): BlockConditionNote(), buildOptionLabelMap(), buildQuestionLabelMap(), ConditionClause, describeVisibility(), formatValue(), isGroup(), OP_LABELS (+3 more)

### Community 124 - "ConfirmDeleteButton"
Cohesion: 0.14
Nodes (12): ConfirmDeleteButton(), InterviewerRoleBadge(), InterviewerForm(), InterviewerMemberOption, InterviewerRow(), InterviewersPanel(), SubjectForm(), SubjectMemberOption (+4 more)

### Community 125 - "Format"
Cohesion: 0.30
Nodes (11): formatCaseNumber(), formatInterviewNumber(), interviewTitle(), InterviewModalityChip(), InterviewStatusBadge(), InterviewPhaseOption, NewInterviewButton(), InterviewHeader() (+3 more)

### Community 126 - "Rule 11 — Auditability (append only hash chained audit log)"
Cohesion: 0.19
Nodes (13): Rule 11 — Auditability (append-only hash-chained audit_log), event_patient (isolated PHI satellite), Rule 12 — PHI / HIPAA handling, app.answer_map (evaluator input rebuild), backend-state.md — Backend Capability Map, dispose_event_phi / dispose_case_phi / dispose_referral_phi (LGPD erasure), app.feature_flags + get_feature_flags, Migrations catalog (forward-only additive) (+5 more)

### Community 127 - "ADR 0028"
Cohesion: 0.24
Nodes (9): ADR-0028, AuditIntegrityCheck(), ADR-0051, ADR-0051, verifyAuditChainAction(), VerifyChainState, AUDIT_MESSAGES, AuditChainResult (+1 more)

### Community 128 - "Fold case action items into hub (source type=case)"
Cohesion: 0.15
Nodes (13): Fold case_action_items into hub (source_type=case), Unified non-PHI action_items hub, CAPA stays isolated (PHI, Rule 12), committee_* SECURITY DEFINER RPCs, Hub-and-spoke shape, redrawn boundary (Option A), Derived quality indicators from option codes, Controlled-document approvers + e-sign, Phase 15/17 revision + re-sequencing (15 to 17 to 16) (+5 more)

### Community 129 - "Corrective Action (PDCA tracked)"
Cohesion: 0.21
Nodes (13): Corrective Action (PDCA-tracked), RCA Shared Analysis Object, Ishikawa Fishbone (six clinical categories), 5-Whys Drill, PDCA Wheel (4-arc compass), RCA + PDCA Implementation Spec, Locked Severity Color (patient-safety), deriveVerdict Disposition Logic (+5 more)

### Community 130 - "JWT local verification gate (ADR 0009)"
Cohesion: 0.18
Nodes (13): JWT local verification gate (ADR 0009), Prod asymmetric JWT signing key requirement, dispose_referral_phi LGPD-erasure parity gap, Follow-ups / Deferred Items Archive, NSP-per-org guard-lift phase (ADR 0042), Hospital roles / NSP / titles design, nsp_coordinator local hospital NSP head, nsp_org_admin org-level zero-PHI NSP admin (+5 more)

### Community 131 - "Dispose referral phi RPC"
Cohesion: 0.17
Nodes (13): dispose_referral_phi RPC, Dual-hospital same-org referral read/dispose, NSP hospital switcher + local console, nsp_org_admin role (org-level PHI-free aggregates), NSP-per-hospital re-key (org→hospital), getNspAccessByOrg seam, Standalone /o/[org]/nsp console, NSP-per-org phase record (+5 more)

### Community 132 - "App.can sign meeting DEFINER bypass guard (HC036)"
Cohesion: 0.19
Nodes (13): app.can_sign_meeting DEFINER-bypass guard (HC036), Meeting lifecycle state machine (agendada→distribuida), Phase 10 — Meetings (Reuniões), sign_meeting electronic signature (auto-flip), can_write_interview participant-write grant, Phase 11 — Interviews (Entrevistas), Phase 12 — Case Timeline (Linha do tempo), CaseTimelineEvent pure event-model (+5 more)

### Community 133 - "Committee titles (5th per commission vocabulary)"
Cohesion: 0.21
Nodes (13): Committee titles (5th per-commission vocabulary), 4-tier audit chain (commission/hospital/org/platform), hospital_admin role (org_admin mirrored, hospital-scoped), is_commission_admin_of combined predicate swap, MAJOR-1: hospital-tier integrity check disabled in UI, MAJOR-2: removeCommittee cross-hospital destructive write, QA Review — Hospital-Admin Tier & Committee Titles, Audit 3-tier redesign (org_id in hashed tuple) (+5 more)

### Community 134 - "ADR 0035 — LGPD/ANVISA/CFM Regulatory Posture"
Cohesion: 0.18
Nodes (13): ADR 0035 — LGPD/ANVISA/CFM Regulatory Posture, ADR 0036 — NSP PHI Lockdown, dispose_event_phi (One-Shot PHI Disposal), get_event_patient — Single Audited PHI Door, QA Review — PHI / HIPAA-Readiness Remediation, Real PQS Membership (is_pqs_member / pqs_members), Six .viewed PHI-Classification Audit Verbs, Audit-Access Entitlement Guard (C-4) (+5 more)

### Community 135 - "Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, e2e, e2e:ui, format, format:check, gen:types (+5 more)

### Community 136 - "Form builder condition engine enhancements"
Cohesion: 0.18
Nodes (12): Form-builder condition engine enhancements, conditionTargets widening (number/date/time), New input types (short_text/number/date/time), Answer-Model v2 (uniform answer entity), Evaluator parity invariant (Rule 3), Instance-ready key (group_instance_id), Typed scalar columns (value_number/date/time), Uniform answers row (scalar or choice) (+4 more)

### Community 137 - "App.eval condition single evaluator"
Cohesion: 0.18
Nodes (12): app.eval_condition single evaluator, app.eval_visibility AND/OR group wrapper, Result-based combinable recommend_when, recompute_recommendations group walker, Zero evaluator drift (reuse eval_condition), app.answer_map rehydration layer, Activation-link TokenHash email-template fix (BUG-UREG-002), deriveUserStatus (derived status, single SQL/TS authority) (+4 more)

### Community 138 - "ADR 0048 user registration identity"
Cohesion: 0.17
Nodes (12): ADR 0048 user-registration identity, BUG-UREG-004 (M4 Go html/template GoTrue 500), app.is_active() enforcement boundary, professional_categories + professional_credentials, token_hash pt-BR invite/recovery email templates, User Registration & Identity Management, Administrativo delegated-capability role, ADR 0061 Administrativo role (+4 more)

### Community 139 - "Meeting form dialog.test"
Cohesion: 0.17
Nodes (6): createMeeting, MEMBERS, seedExpectedAttendees, seedSelectedAttendees, TYPES, updateMeeting

### Community 140 - "ADR 0017 — Multi Phase Cases"
Cohesion: 0.20
Nodes (11): ADR 0017 — Multi-Phase Cases, Case / case_phases model (a phase IS a response), process_templates + process_template_phases (per-commission blueprint), recommend_when (condition recommends + human confirms, from_phase qualifier), Reuse the condition evaluator; do not touch the mirror, Snapshot at case creation (pin published form_version_id), ADR 0020 — Dashboard-countable responses: case-phase exclusion, Standalone dashboards exclude case-phase responses (+3 more)

### Community 141 - "Case access expiry (expires at + reason)"
Cohesion: 0.22
Nodes (11): case_access expiry (expires_at + reason), Ad-hoc Case Narratives (ADR 0047), add_ad_hoc_narrative DEFINER RPC, Administrativo delegated-capability role (ADR 0061), app.member_can flag-aware capability helper, Phase assignment grants case READ not write, can_read_case / can_write_case_content predicates, Case Access Control & Meus Casos (ADR 0033) (+3 more)

### Community 142 - "ADR 0052 NSP per hospital"
Cohesion: 0.20
Nodes (11): ADR 0052 NSP-per-hospital, dispose_referral_phi (dual-hospital), GoTrue auth rate-limit (E2E env flakiness), nsp_org_admin role, NSP-per-hospital (Phase B), Org-to-hospital re-key (B0-B5), FIX-2 test-isolation leak (staff1 hospital_admin), getLatestSnapshot ref-mirror (use-wizard) (+3 more)

### Community 143 - "Architecture Rule 12 — PHI/HIPAA isolated + audited single door"
Cohesion: 0.24
Nodes (11): Architecture Rule 12 — PHI/HIPAA isolated + audited single door, server-only installed but never imported, Access-follows-custody RLS (can_read_event), Custody ledger append-only (guard_event_custody HC043), event_patient PHI isolation + .read auditing, Phase 14a QA Review — NSP Foundation & Event Intake, can_read_referral_phi (no is_admin, three disjuncts), QPS macro view via is_pqs_member early-return in can_read_case (+3 more)

### Community 144 - "Sign own row RLS + can sign meeting DEFINER re check"
Cohesion: 0.18
Nodes (11): Sign-own-row RLS + can_sign_meeting DEFINER re-check, Participant-write RLS (can_write_interview DEFINER), Phase 11 QA Review — Interviews, DEFINER-only write posture (SELECT-only policy), Derived measurement parity with dashboard aggregate, Phase 15 QA Review — Quality Indicators, Version-scoped approver-read arm (recursion-safe DEFINER), Controlled-document 3-table model + version status (+3 more)

### Community 145 - "Case phase results Feature Review (Per Phase Categorical Result)"
Cohesion: 0.24
Nodes (11): case_phase_results Feature Review (Per-Phase Categorical Result), app.compute_case_phase_result, app.in_case_rpc GUC (Transaction-Local Guard Bypass), result_ruleset Snapshot on case_phases, set_case_phase_result_override (Manual Override), walkResultRuleset TS Evaluator, ADR 0043 — Result-Based Recommendation, recommend_when Superset CHECK (Legacy Backward-Compat) (+3 more)

### Community 146 - "Page"
Cohesion: 0.24
Nodes (7): FormsListPage(), metadata, DiscardDraftButton(), FillableFormCard(), StartFillButton(), FillableForm, listFillableForms()

### Community 147 - "Page"
Cohesion: 0.29
Nodes (9): EditDocumentPage(), metadata, DocumentDetailPage(), ApproverDocumentPage(), findMyApprovalForVersion(), selectSignableVersion(), selectWorkingDraft(), createSignedDownloadUrl() (+1 more)

### Community 148 - "Title badge"
Cohesion: 0.25
Nodes (9): TitleBadge(), ADR-0051, formatDateTime(), SignatureBadge(), SignButton(), RosterEntry, SignaturesPanel(), MeetingAttendee (+1 more)

### Community 149 - "Options editor"
Cohesion: 0.27
Nodes (8): blankOption(), COLOR_TOKENS, hasMetadata(), OptionColorDropdown(), OptionsEditor(), option(), TOKEN_NAME, ColorToken

### Community 150 - "Titles"
Cohesion: 0.36
Nodes (9): assignMemberTitle(), createMemberTitle(), deleteMemberTitle(), MESSAGES, renameMemberTitle(), reorderMemberTitles(), revalidateManage(), ADR-0051 (+1 more)

### Community 151 - "Architecture Rules (binding)"
Cohesion: 0.20
Nodes (10): Architecture Rules (binding), Rule 8 — Generated types, Rule 10 — pt-BR user text, English code, Rule 1 — RLS is the security boundary, Rule 4 — Section sign-offs, Rule 6 — Storage immutability, app.is_commission_admin_of (combined predicate), ADR 0010 — Denormalize email onto public.profiles (+2 more)

### Community 152 - "Condition evaluator (SQL + TS mirror)"
Cohesion: 0.31
Nodes (10): Condition evaluator (SQL + TS mirror), Rule 3 — Response lifecycle & resume + condition evaluator, submit_response RPC (submission authority), visible_when condition shape, Wizard filling with resume, ADR 0003 — pgTAP for database tests, ADR 0005 — visible_when condition shape (v1), Phase 1 — Database Schema, Auth & RLS (+2 more)

### Community 153 - "Forbid cross org referrals"
Cohesion: 0.22
Nodes (10): Forbid cross-org referrals, app.is_pqs_member_of(org) predicate primitive, patient_index fourth PHI surface, Per-org EV code mint (global ENC), PHI door / policy / RPC inventory, NSP-per-org backend security-core spec, app.app_secrets MRN pepper table, HMAC patient_key/encounter_key matching key (+2 more)

### Community 154 - "Capa plan reusable primitive (JC strength)"
Cohesion: 0.24
Nodes (10): capa_plan reusable primitive (JC strength), event_triage & disposition (sentinel screen), Immutable nsp-evidence Storage bucket, RCA workspace (Fishbone / 5-Whys), Phase 14b–14d — Triage, RCA & CAPA (NSP), clone_form_version RPC (question_key preservation), Deferrable-unique position reorder strategy, Immutable form-assets Storage bucket (+2 more)

### Community 155 - "Condition evaluator + submit response RPC"
Cohesion: 0.22
Nodes (10): Condition evaluator + submit_response RPC, Sanitizing Markdown renderer (Rule 7), evalCondition TS mirror (single show/skip authority), save_section_answers atomic upsert + orphan-clear, Phase 5 — Wizard Filling, Conditional Sections & Resume, Warn-and-clear orphaned-answer flow, sign_section RPC (respondent + staff_admin), signoff_enforcement flag flip (P0012 gate) (+2 more)

### Community 156 - "ADR 0048 — User Registration & Identity"
Cohesion: 0.27
Nodes (10): ADR 0048 — User Registration & Identity, deriveUserStatus (TS-Only Derived Status), Loop-Free Inactive-User Gate, app.is_active() Fold into Membership Helpers, profiles_select_self_or_admin Peer-Branch is_active Gap (B1), registerUser Atomic Action + Collision Block, QA Review — User Registration & Identity Management, /auth/confirm Server-Side Handler (verifyOtp token_hash + type) (+2 more)

### Community 157 - "Page"
Cohesion: 0.33
Nodes (9): InterviewDetailPage(), metadata, isEditableInterviewStatus(), InterviewSummaryEditor(), getInterviewDetail(), listInterviewAttachments(), listInterviewInterviewers(), listInterviewSubjects() (+1 more)

### Community 158 - "Page"
Cohesion: 0.27
Nodes (7): metadata, MyResponsesPage(), formatDate(), MyResponseCard(), ResponseStatusBadge(), listMyResponses(), MyResponse

### Community 159 - "OrgAuditPage"
Cohesion: 0.27
Nodes (9): OrgAuditPage(), AuditListRow, listAuditForHospital(), listAuditForOrg(), mapAuditRow(), ADR-0030, ADR-0038, ADR-0039 (+1 more)

### Community 160 - "Rule 9 — Data access via src/lib/queries"
Cohesion: 0.31
Nodes (9): Rule 9 — Data access via src/lib/queries, ADR 0002 — Admin claim via custom access token hook, ADR 0007 — Middleware coarse auth gate; role landing in /, ADR 0008 — GSAP as the animation dependency, ADR 0009 — Local JWT verification for the auth gate, Custom access-token hook (JWT is_admin claim), Coolify Deployment — Dev/Staging Runbook, Phase 2 — Authentication & App Shell (+1 more)

### Community 161 - "ADR 0015 — Response fill RPCs"
Cohesion: 0.22
Nodes (9): ADR 0015 — Response-fill RPCs, Atomic section save (RPC over N client upserts), Cross-version answer-write guard, save_section_answers RPC, start_or_resume_response RPC, unique_violation-catch resume for double-click races, ADR 0018 — Custom SQLSTATE class HC0xx (was P00xx), HC0xx custom SQLSTATE class (+1 more)

### Community 162 - "Case outcomes vocabulary + per case snapshot (case offered outcomes)"
Cohesion: 0.25
Nodes (9): case_outcomes vocabulary + per-case snapshot (case_offered_outcomes), ADR 0032 — Case Narratives (per-case prose interleaved with phases), case_narratives (per-case snapshot + content, two-table split), Separate display_position (not reused position), RPC-guaranteed interleave (reorder_case_layout_template), ADR 0033 — Case Access Control (per-case read/write grants), app.can_read_case / can_write_case_content predicates, case_access ACL table (attribution-derived read computed) (+1 more)

### Community 163 - "Dual Evaluator Operator Expansion (contains/is empty)"
Cohesion: 0.28
Nodes (9): Dual-Evaluator Operator Expansion (contains/is_empty), Conteudo/Comportamento Two-Column Grouping, ItemEditorDialog Component, OptionsEditor Table Redesign, Question Editor Dialog Layout-Refactor Spec, Reusable ConditionBuilder Component, Single Evaluator + evalVisibility Group Wrapper, Per-Option Colors + Observation Field (+1 more)

### Community 164 - "Action Items Data Model Handoff"
Cohesion: 0.28
Nodes (9): Action Items Data Model Handoff, action_items Core Table, action_item_assignments (owner/contributor/reviewer), Core-Plus-Satellite-Tables Architecture, Overdue-Is-Derived Principle, action_item_related_records (polymorphic link), Configurable Status Model (lookup + category), transition_action_item_status RPC (+1 more)

### Community 165 - "Indicator→CAPA two tier hook"
Cohesion: 0.25
Nodes (9): Indicator→CAPA two-tier hook, Derived-value dashboard parity lock, DEFINER-RPC-only write posture (posture b), Derived-measurement compute (ADR 0058), hospital_indicator_rollup DEFINER (PHI-free), public.indicator_measurements table, public.indicators table, Quality Indicators Module (Phase 15) (+1 more)

### Community 166 - "Phase 0 — Scaffolding & Environment"
Cohesion: 0.25
Nodes (9): Phase 0 — Scaffolding & Environment, Supabase client factories (browser/server), Admin claim via custom access token hook, RLS policy set + is_member_of/is_staff_admin_of helpers, Phase 1 — Database Schema, Auth & RLS, Phase 3 — Admin Area & User Management, Assign/invite staff_admin & staff by email, profiles.email denormalized citext (+1 more)

### Community 167 - "ADR 0044 process less cases"
Cohesion: 0.22
Nodes (9): ADR 0044 process-less cases, BUG-PL-001 (Proximo submits form, button type flip), create_case (template-less minter RPC), OutcomeMultiselect component, Process-less cases (Sem processo), set_case_offered_outcomes RPC, Case outcome vocabulary + conclude gate (HC028/HC031), Phase blocking graph (blocks array, parallel phases) (+1 more)

### Community 168 - "ADR 0017 — Multi Phase Cases"
Cohesion: 0.22
Nodes (9): ADR 0017 — Multi-Phase Cases, HC0xx SQLSTATE Class (ADR 0018), app.mint_case_number (Per-Commission Advisory Lock), Phase 7 QA Review — Multi-Phase Cases, ADR 0044 — Process-less Cases, create_case RPC (Template-less Case Mint), QA Review — Sem Processo (Process-less Cases), set_case_offered_outcomes RPC (+1 more)

### Community 169 - "Pre pilot DB hardening program"
Cohesion: 0.22
Nodes (9): Pre-pilot DB hardening program, Flexible-Forms Foundation, Multi-Tenancy structural phase (MT), NSP-per-hospital structural phase, Phase 10 — Meetings, Phase 11 — Interviews, Phase 12 — Case Timeline, Phase 8 — Dashboards & Submissions Browser (+1 more)

### Community 170 - "Rca window form"
Cohesion: 0.33
Nodes (7): ADR-0052, addPqsMember(), MESSAGES, removePqsMember(), revalidateNsp(), setPqsRcaDueWindow(), ADR-0052

### Community 171 - "Agent Team protocol (lead + teammates)"
Cohesion: 0.32
Nodes (8): Agent Team protocol (lead + teammates), Commission (organizational unit), Form items (input vs display), Governance & accreditation concepts, Phase Gate (5-step mandatory), Hospital Commission Forms Platform (overview), Roles (admin / staff_admin / staff), Sections (first-class, default section, conditional)

### Community 172 - "Flagged + aggregate result criteria (synthetic keys)"
Cohesion: 0.25
Nodes (8): Flagged + aggregate result criteria (synthetic keys), Form-Builder Enhancements batch (ad-hoc), Hospital Departments feature, next build standalone required as green-bar, Others open option answer model (__other__), Segmented TimeField vs masked textbox (a11y), case_phase_results (per-phase categorical result, ADR), compute_case_phase_result + override RPC

### Community 173 - "Case Timeline read only viz (ADR 0027)"
Cohesion: 0.25
Nodes (8): Case Timeline read-only viz (ADR 0027), Custom SQLSTATE class P00xx→HC0xx (ADR 0018), Decisions Log Archive (verbose ADR history), Meetings 6-state lifecycle (ADR 0025), Multi-phase cases (ADR 0017), Future-schedule → blank occurrence default, Meeting held_at/held_end actual-occurrence time (ADR 0062), set_meeting_held_window RPC

### Community 174 - "Answers.form version id + composite FK (C 5)"
Cohesion: 0.25
Nodes (8): answers.form_version_id + composite FK (C-5), count_open_cases_for_board (badge parity), get_feature_flags() cached (P4), Pre-Pilot DB Hardening Wave 2 (perf sweep WS-6), Focused Analysis Audit S4 Perf & S5 Data Model, D6 item_type ELSE NULL footgun, Hospital-scoped patient master (S6.2), P1 getSessionContext React.cache()

### Community 175 - "Cursor injection fix (decodeCursor schema validate)"
Cohesion: 0.25
Nodes (8): Cursor injection fix (decodeCursor schema-validate), CursorPagination component, Keyset pagination (Page<T>/cursor), BUG-P2-002 post-login race, BUG-P6-001 signSection queue read, Prod-build toast/dialog quirk (declare green on dev), Test Run Summary Archive (Phases 0-MT), BUG-AIF-001 (mutation dialogs don't close on prod build)

### Community 176 - "Add ad hoc narrative RPC"
Cohesion: 0.29
Nodes (8): add_ad_hoc_narrative RPC, ADR 0032 case narratives, ADR 0047 ad-hoc case narratives, QA Review: Ad-hoc Narratives, BLOCK-1 narrative-type-dialog form.set id bug, Case Narratives increment, guard_case_narrative_frozen (HC054 freeze-on-close), QA Review: Case Narratives (CHANGES REQUESTED)

### Community 177 - "ADR 0013 — form versions INSERT RLS Fix"
Cohesion: 0.29
Nodes (8): ADR 0013 — form_versions INSERT RLS Fix, clone_form_version RPC, MarkdownRenderer (react-markdown + rehype-sanitize), Phase 4 QA Review — Form Builder & Versioning, Published-Version Immutability, Storage Immutability (form-assets), Two-Level Builder (Sections + Blocks), Form-Version Snapshot Pin at Case Creation

### Community 178 - "Page"
Cohesion: 0.29
Nodes (6): metadata, ReviewDuePage(), metadata, PendingApprovalsPage(), listDocumentsDueForReview(), listPendingApprovalsForUser()

### Community 179 - "Phase result options"
Cohesion: 0.29
Nodes (5): PhaseCorrectionMode, PhaseCorrectionOptions, resolvePhaseCorrectionOptions(), VOCAB, TimelinePhaseResult

### Community 180 - "Document editor"
Cohesion: 0.25
Nodes (4): CreateAction, DOC_TYPES, UpdateAction, CreateDocumentState

### Community 181 - "Always on derivation + xref maintain triggers"
Cohesion: 0.33
Nodes (7): Always-on derivation + xref-maintain triggers, app.app_secrets pepper store, Exact-match-only linkage (no fuzzy matching), HMAC-SHA256 keyed linkage hash (patient_key/encounter_key), patient_index (cross-committee linkage), patient_xref key-only QPS-only index, search_patient_xref DEFINER door

### Community 182 - "Add ad hoc phase"
Cohesion: 0.33
Nodes (7): add_ad_hoc_phase, create_case template-less minter RPC, Process-less case (Sem processo), set_case_offered_outcomes mutable offered set, add_ad_hoc_narrative RPC, Atomic in-RPC create-or-reuse narrative type, case_narratives.is_ad_hoc provenance

### Community 183 - "Kanban HTML Mockup"
Cohesion: 0.38
Nodes (7): Kanban HTML Mockup, KPI Table HTML Mockup, Case Review Board (Kanban), Clinical Calm Color Theme, Design Language & Screens Spec (Overview + Kanban), Overview Screen (KPI + Cases Table), Shared UI Components (Status Pill, KPI Card, Sidebar)

### Community 184 - "C 4 audit entitlement guard (not a revoke)"
Cohesion: 0.29
Nodes (7): C-4 audit entitlement guard (not a revoke), C-5 answers form_version_id FK, Pre-Pilot DB Hardening Program, Pre-launch reset-OK posture, WS-2 Grant hardening (C-1/C-2/C-4), WS-3 Data-model integrity (C-5/D1-D9), WS-5 Performance cheap wins (P1/P7/P9/P10)

### Community 185 - "WS 4 PHI disposal completion (C 6)"
Cohesion: 0.29
Nodes (7): WS-4 PHI disposal completion (C-6), case_patient module (third PHI module, ADR 0038), dispose_event_phi controlled disposal RPC, get_event_patient single audited door, PHI / HIPAA-Readiness Remediation (ADR 0035/0036), pqs_members real-membership lockdown (drop is_admin fallback), RCA-write severance of standalone is_admin

### Community 186 - "Multi Tenancy organizations→hospitals→commissions (ADR 0041)"
Cohesion: 0.29
Nodes (7): Multi-Tenancy organizations→hospitals→commissions (ADR 0041), Live-catalog predicate-swap sweep assertion, Committee member titles vocabulary, 4-tier audit hash chain (platform/org/hospital/commission), Phase A Hospital-admin tier (ADR 0051), Door inventory is the spec and the assertion, org→hospital PHI-door re-key transform (§T)

### Community 187 - "Phase 15 — Quality Indicators (Indicadores)"
Cohesion: 0.29
Nodes (7): Phase 15 — Quality Indicators (Indicadores), DEFINER-RPC-only write posture (option b), Two-tier off-target CAPA escalation, Named-approver e-signature workflow (signature_hash), Phase 17 — Controlled-Document Lifecycle, Document lifecycle rascunho→vigente→obsoleto, version-select shared helper (in-force vs actionable)

### Community 188 - "ADR 0056 narrowed erasure claim"
Cohesion: 0.33
Nodes (7): ADR 0056 narrowed erasure claim, PHI disposal closure (C-6), ADR 0038 case-patient identifiers, case_patient PHI satellite table, dispose_case_phi (LGPD Art.18 erasure), get_case_patient audited single read door, C-6 PHI disposal incomplete (erasure false claim)

### Community 189 - "Architecture Rule 11 — Auditability (append only, tamper evident)"
Cohesion: 0.43
Nodes (7): Architecture Rule 11 — Auditability (append-only, tamper-evident), Append-only guard HC042 (no bypass, fires for service_role), Audit hash chain (audit_canonical over semantic columns), log_audit_access allow-listed sensitive-read RPC, Metadata allow-lists (data-minimization, Rule 11), Phase 13 QA Review — Audit Trail, verify_audit_chain integrity RPC

### Community 190 - "Architecture Rule 1 — RLS is the security boundary"
Cohesion: 0.33
Nodes (7): Architecture Rule 1 — RLS is the security boundary, Evaluator non-drift (SQL and TS byte-identical), M1: pqs_department RLS-on with zero SELECT policy, Condition evaluator SQL↔TS shared-vector mirror, Phase 1 QA Review — Database Schema, Auth & RLS, MAJOR-1: staff_admin UPDATE USING gap (RESOLVED), Three-tier immutability (RLS + trigger + RPC guard)

### Community 191 - "Fixed case status (configurable status removed)"
Cohesion: 0.29
Nodes (7): Fixed case status (configurable status removed), ADR 0022 deferred referrals, app.apply_case_status DEFINER core (in_case_rpc chokepoint), case_documents + immutable storage bucket, case_tags + case_tag_assignments (HC026 guard), QA Review: Cases-Extras Batch (R1-R5), S6.4 Storage parity for PHI (signed URLs, audited)

### Community 192 - "Answer selected options table (normalized selections)"
Cohesion: 0.38
Nodes (7): answer_selected_options table (normalized selections), Dashboards group by stable code (rename-safe analytics), form_item_options table (version-scoped, frozen), MAJOR-1: existing-option reorder duplicate-key failure, Option code auto-slug, immutable, copied-on-clone, reconcile_item_options RPC (single-txn INVOKER reorder), QA Review — Form Data-Model Normalization

### Community 193 - "Raw amber classes bypass   warning token (5 files)"
Cohesion: 0.29
Nodes (7): Raw amber classes bypass --warning token (5 files), Frontend Audit — External Consultant Review (2026-07), Sequential-await waterfalls in ~16 pages, No root/global error boundary (HIGH), Four duplicated GSAP rise-in motion wrappers, key={index} on reorderable options list, No streaming/Suspense + no filter pending feedback

### Community 194 - "Multi org PHI guard (is pqs member chokepoint)"
Cohesion: 0.33
Nodes (7): Multi-org PHI guard (is_pqs_member chokepoint), dispose_referral_phi dual-hospital gate + probe, is_pqs_member_of(hospital) hospital-scoped roster, nsp_org_admin (org-level, provably PHI-free), QA-B-1: pgTAP 189 disposal keystone (RESOLVED), QA Review — NSP-per-hospital & nsp_org_admin, Three-way duty separation (appoint/curate/read)

### Community 195 - "M3: capa kpis cross org aggregate leak (RESOLVED)"
Cohesion: 0.33
Nodes (7): M3: capa_kpis cross-org aggregate leak (RESOLVED), Body-not-scoped DEFINER-door class sweep, I1: dispose_case_phi bare is_admin cross-tenant arm (RESOLVED), QA Review — NSP-per-org sub-phase A (security core), M1: patient_trajectory_bundle over-grant (RESOLVED), getNspAccessByOrg console admission gate, QA Review — NSP-per-org sub-phase B (per-org console)

### Community 196 - "Submit response as Submission Authority"
Cohesion: 0.29
Nodes (7): submit_response as Submission Authority, ADR 0016 — Sign-offs Design, app.can_sign_section (SECURITY DEFINER), Phase 6 QA Review — Section Sign-offs & Submission Lifecycle, signoff_enforcement Feature Flag (P0012 check), signoffs_insert/signoffs_select RLS Rewrite, In-Progress Answers Invariant

### Community 198 - "Layout"
Cohesion: 0.29
Nodes (5): ibmPlexMono, ibmPlexSans, ibmPlexSerif, metadata, viewport

### Community 199 - "AttachmentLinkForm"
Cohesion: 0.33
Nodes (6): AttachmentLinkForm(), AttachmentUpload(), AttachmentsPanel(), ATTACHMENT_KIND_LABEL, AttachmentsPanel(), formatDate()

### Community 200 - "Rule 7 — Sanitized Markdown, never raw HTML"
Cohesion: 0.33
Nodes (6): Rule 7 — Sanitized Markdown, never raw HTML, Tech stack (Next.js/Supabase/Playwright/Vitest), ADR 0001 — Scaffolding & toolchain bootstrap, ADR 0006 — Supabase API key scheme vs env var naming, ADR 0014 — Sanitizing Markdown renderer, Phase 0 — Scaffolding & Environment

### Community 201 - "ADR 0023 — Configurable per committee case status"
Cohesion: 0.33
Nodes (6): ADR 0023 — Configurable per-committee case status, case_status_defs (per-commission status vocabulary), Liveness sweep (case_status_is_terminal replaces = 'aberto'), ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes, Fixed 5-value auto-computed case status (recompute_case_status), Phase blocking dependency graph (blocks integer[])

### Community 202 - "ADR 0062: Meeting Actual Occurrence Time"
Cohesion: 0.40
Nodes (6): ADR 0062: Meeting Actual-Occurrence Time, held_at / held_end Occurrence Columns, Plan-vs-Actual Distinction Rationale, Meeting held_at/held_end Handoff, runLifecycle Uniform-Call Break-Out, set_meeting_held_window RPC

### Community 203 - "Architecture Rule 12 (PHI/HIPAA handling)"
Cohesion: 0.47
Nodes (6): Architecture Rule 12 (PHI/HIPAA handling), app.can_read_event single-door predicate, event_custody access-follows-custody ledger, event_patient PHI isolation satellite, Phase 14a — NSP Foundation & Event Intake, referral_patient isolated PHI (second PHI module)

### Community 204 - "Held at / held end occurrence window"
Cohesion: 0.40
Nodes (6): held_at / held_end occurrence window, QA Review — Meeting Actual-Occurrence Time (held_at/held_end), set_meeting_held_window RPC (realizada-only gate HC083), Meeting 6-state lifecycle state machine, MINOR-2: quorum present_count includes guests, Phase 10 QA Review — Meetings

### Community 205 - "BLOCKER 1: triage disposition 42702 ambiguous event id (RESOLVED)"
Cohesion: 0.40
Nodes (6): BLOCKER-1: triage_disposition 42702 ambiguous event_id (RESOLVED), CAPA plan lifecycle + conclude gates (HC051/HC052), app.in_safety_rpc GUC + freeze/child-lock guards, Phase 14b-14d QA Review — Triage, RCA & CAPA (NSP), triage_disposition RPC (sentinel/RCA verdict authority), Indicator→CAPA off-target escalation (open_capa_plan arm)

### Community 206 - "Case / Case Phase State Machine Guards"
Cohesion: 0.40
Nodes (6): Case / Case-Phase State Machine Guards, count_open_cases_for_board (Gate-Parity RPC), Cursor .or() Interpolation Gap (MAJOR), InitPlan (select auth.uid()) Policy Wrap, Keyset (Cursor) Pagination, QA Review — Pre-Pilot DB Hardening, Wave 2 (Performance Sweep)

### Community 207 - "ADR 0020 — Dashboard Countable Source"
Cohesion: 0.47
Nodes (6): ADR 0020 — Dashboard Countable Source, Anon/PUBLIC EXECUTE Revoke (B6), CSV Export Date-Filter Gap (MINOR-1), Dashboard DEFINER RPC Gating, Phase 8 QA Review — Dashboards & Submissions Browser, app.submitted_form_responses Aggregation Helper

### Community 208 - "AuditFeed"
Cohesion: 0.53
Nodes (5): AuditFeed(), getServerSnapshot(), getSnapshot(), subscribe(), useClientNow()

### Community 209 - "InterviewLifecycleActions"
Cohesion: 0.53
Nodes (6): InterviewLifecycleActions(), cancelInterview(), concludeInterview(), reopenInterview(), runLifecycle(), startInterview()

### Community 210 - "Avatar stack"
Cohesion: 0.47
Nodes (4): Avatar(), AvatarFallback(), AvatarImage(), TimelinePerson

### Community 211 - "Rule 5 — Published versions immutable"
Cohesion: 0.60
Nodes (5): Rule 5 — Published versions immutable, Form versioning (draft→published→archived), ADR 0012 — clone_form_version returns existing draft, ADR 0013 — Fix form_versions INSERT RLS self-reference, Phase 4 — Form Builder & Versioning

### Community 212 - "App.member can (flag aware capability kill switch)"
Cohesion: 0.40
Nodes (5): app.member_can (flag-aware capability kill switch), Administrativo delegated-capability role, BUG-AIF-001 (prod-standalone RSC truncation), Meeting actual-occurrence time (held_at/held_end), PROGRESS.md — Project Status Tracker

### Community 213 - "Can write capa consolidation + non event fallback"
Cohesion: 0.40
Nodes (5): can_write_capa consolidation + non-event fallback, can_write_capa collapse to hospital-scoped predicate, CAPA tenant anchor (capa_plan.hospital_id), Cross-hospital CAPA write hole (H-8), mint_capa_code per-hospital (P8)

### Community 214 - "Bug Log Archive (resolved/closed bugs)"
Cohesion: 0.40
Nodes (5): Bug Log Archive (resolved/closed bugs), RSC closure-to-client-component serialization bug (P11-001/P10-LATENT-001), Sign-off RLS pre-check block bug (P6-001), Cross-spec shared-seed contamination class (P13-004), Prod-build E2E harness debt (reducedMotion + DB isolation)

### Community 215 - "Per answer observations (answers.observation)"
Cohesion: 0.40
Nodes (5): Per-answer observations (answers.observation), ConditionBuilder (ALL/ANY groups + gt/gte/lt/lte), Form Builder Enhancements mini-phase (ADR 0040), New input types short_text/number/date/time, Number-condition JSON-number value guard (MAJOR-1)

### Community 216 - "App.app secrets pepper store (service role only)"
Cohesion: 0.70
Nodes (5): app.app_secrets pepper store (service_role-only), derive_patient_key (HMAC-SHA256 under mrn_pepper), patient_xref (QPS-only, non-reversible hash keys), Phase 23 QA Review — Patient Identity & Cross-Committee Linkage, search_patient_xref + patient_access_audit DEFINER doors

### Community 217 - "Single Condition Evaluator (eval condition SQL / evalCondition TS)"
Cohesion: 0.50
Nodes (5): Single Condition Evaluator (eval_condition SQL / evalCondition TS), Phase 5 QA Review — Wizard Filling, Conditional Sections & Resume, Response Fill RPCs (start_or_resume_response, save_section_answers), Warn-and-Clear Orphaned Answers, Answers Composite FK to form_items (C-5)

### Community 218 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 219 - "Audit icon"
Cohesion: 0.50
Nodes (4): ENTITY_ICON, EntityIcon(), resolveEntityIcon(), AuditEntityType

### Community 220 - "Title assign control"
Cohesion: 0.50
Nodes (3): ADR-0051, MemberTitle, ADR-0051

### Community 221 - "Answer model v2 (uniform answer row + typed shadow cols)"
Cohesion: 0.67
Nodes (4): answer-model-v2 (uniform answer row + typed shadow cols), Rule 2 — Canonical DB schema, form_item_options (normalized choice options), ADR 0011 — Position reorder via deferrable constraints

### Community 222 - "CaseEvent Data Model"
Cohesion: 0.83
Nodes (4): CaseEvent Data Model, Duration (Horizontal/Gantt) Layout, Feed (Vertical) Layout, Case Timeline Implementation Spec

### Community 223 - "Committee Case Generalization Design (ChatGPT)"
Cohesion: 0.83
Nodes (4): Committee Case Generalization Design (ChatGPT), Generic committee_cases Abstraction, Ethics Committee Extension Tables, Participants + Case-Type + Role Abstraction

### Community 224 - "Case action items fold + visibility scope (ADR 0050)"
Cohesion: 0.50
Nodes (4): case_action_items fold + visibility_scope (ADR 0050), app.can_read_action_item scope predicate, Meus itens de acao page + Visao Geral overview, Shared Action-Items Hub (Option A)

### Community 225 - "Production asymmetric JWT keys deploy requirement"
Cohesion: 0.83
Nodes (4): Production asymmetric JWT keys deploy requirement, getClaims() local JWT verification (asymmetric ES256), Middleware coarse-gate + root role-landing design, Phase 2 QA Review — Authentication & App Shell

### Community 226 - "Email Denormalization on Profiles (M9)"
Cohesion: 0.50
Nodes (4): Email Denormalization on Profiles (M9), Phase 3 QA Review — Admin Area & User Management, revalidateCommissionPages Helper, Service-Role Client Containment

### Community 227 - "Action item Audit Coverage (Rule 11 Win)"
Cohesion: 0.67
Nodes (4): action_item Audit Coverage (Rule 11 Win), Shared action_items Hub Table, committee_* Action-Item DEFINER RPCs, QA Review — Shared (non-PHI) action_items Table

### Community 228 - "Package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 230 - "ADR 0019 — The default (anchor) section may carry a title"
Cohesion: 0.67
Nodes (3): ADR 0019 — The default (anchor) section may carry a title, Default (anchor) section, form_sections_default_shape CHECK relaxation

### Community 231 - "ADR 0027 — Case Timeline (read only event aggregation, two layouts)"
Cohesion: 1.00
Nodes (3): ADR 0027 — Case Timeline (read-only event aggregation, two layouts), CaseTimelineEvent normalized event model (event-model.ts), getCaseTimeline aggregation in query layer (no migration)

### Community 232 - "Tenant hierarchy composite FK guard (D2)"
Cohesion: 0.67
Nodes (3): Tenant-hierarchy composite FK guard (D2), guard_hospital_org_repoint (HC082), Silent tenant-hierarchy org desync

### Community 233 - "Coolify pre Phase 9 dev/staging deployment"
Cohesion: 0.67
Nodes (3): Coolify pre-Phase-9 dev/staging deployment, Coolify Dockerfile app type (no compose/Caddy), ADR 0009 prod-auth gap (JWKS/HS256 fallback)

### Community 234 - "Get member overview RPC (five member count cards)"
Cohesion: 1.00
Nodes (3): get_member_overview RPC (five member count cards), list_my_action_items RPC (self-scoped union), QA Review — Member Overview & My Action Items

### Community 235 - "Event model.ts purity (zero imports)"
Cohesion: 1.00
Nodes (3): event-model.ts purity (zero imports), getCaseTimeline (read-only composition over RLS reads), Phase 12 QA Review — Case Timeline

## Knowledge Gaps
- **1098 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `$schema` (+1093 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Case Documents` to `Case Lifecycle Actions`, `Admin & Auth Pages`, `Shared UI & Phase Dialogs`, `Error & Not-Found Boundaries`, `Condition & Result Rule Editor`, `Phase Answers & Assignments`, `Triage Disposition & Pathways`, `RCA Problem Stage`, `CAPA Badges`, `NSP Event Pages`, `RCA Analysis Stage`, `Case Department Field`, `Referral Detail & Formatting`, `Staff Case Detail`, `Org Overview Dashboard`, `Quality Indicators`, `Title badge`, `Options editor`, `Form Builder Page`, `My Cases List`, `CAPA Actions & Closure`, `Page`, `Case Narrative Editor`, `Form Item Editor & Tests`, `Submission Detail Blocks`, `CAPA Evidence & Cards`, `Case Narrative Cards`, `Admin Layout & Claims`, `Interview & Agenda Forms`, `Forms & Process Templates`, `Meeting Attendees & Quorum`, `Hospital Detail Pages`, `Narrative Templates`, `Layout`, `Page`, `Page`, `Page`, `Page`, `Section signoff fields`, `TitleAssignControl`, `Interview badges`, `CaseActionItemForm`, `Layout`, `Page`, `Case tags panel`, `Event type manager`, `Page`, `Phase result badge`, `Page`, `Page`, `Loading`, `Loading`, `Avatar stack`, `ActionItemRow`, `CaseActionItemsPanel`, `Page`, `Page`, `ActionItemForm`, `Referral patient fields`, `ClampCalloutCenter`, `CaseTagsPanel`, `ADR 0050`, `Page`, `ConfirmDeleteButton`, `Format`, `ADR 0028`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Auth Callback & Meeting Settings` to `Admin & Auth Pages`, `Condition & Result Rule Editor`, `Triage Disposition & Pathways`, `RCA Problem Stage`, `Form Builder Actions`, `Submission Detail (Answer Model)`, `CAPA Badges`, `NSP Event Pages`, `RCA Analysis Stage`, `Case Department Field`, `Referral Detail & Formatting`, `Staff Case Detail`, `Org Overview Dashboard`, `Quality Indicators`, `NSP Patient Registry`, `Form Builder Page`, `My Cases List`, `Referral Actions & Reply`, `NSP Referrals Dashboard`, `Case & Phase Actions`, `Meeting Detail & Agenda`, `NSP CAPA/RCA Pages`, `CAPA Evidence & Cards`, `Case Narrative Editor`, `Phase Responder & Submissions`, `Case Narrative Cards`, `Phase Result Actions`, `Admin Layout & Claims`, `Forms & Process Templates`, `Hospital Detail Pages`, `Event Notification & Triage`, `Page`, `Page`, `Layout`, `IsTerminalMeetingStatus`, `Page`, `Page`, `Page`, `ListMeetings`, `Page`, `TitleAssignControl`, `Interview badges`, `Page`, `CaseActionItemForm`, `VersionWithUrl`, `UploadDialog`, `Layout`, `Event type manager`, `Page`, `Page`, `Wizard runner`, `Case timeline`, `Actions`, `Page`, `Route`, `ActionItemRow`, `CaseActionItemsPanel`, `Case document delete`, `Page`, `Page`, `Page`, `Page`, `Page`, `ActionItemForm`, `Actions`, `Page`, `Outcomes actions`, `CaseTagsPanel`, `DepartmentDefDialog`, `Page`, `Browser`, `AdminAuditPage`, `Page`, `Page`, `ADR 0028`, `Page`, `Page`, `Titles`, `Page`, `Page`, `OrgAuditPage`, `Rca window form`, `Page`, `InterviewLifecycleActions`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Button()` connect `Error & Not-Found Boundaries` to `Case Lifecycle Actions`, `Admin & Auth Pages`, `Shared UI & Phase Dialogs`, `Condition & Result Rule Editor`, `Phase Answers & Assignments`, `Triage Disposition & Pathways`, `Case Documents`, `RCA Problem Stage`, `Section Visibility & Blocks`, `CAPA Badges`, `NSP Event Pages`, `RCA Analysis Stage`, `Case Department Field`, `Referral Detail & Formatting`, `Org Overview Dashboard`, `Quality Indicators`, `Page`, `Options editor`, `Form Builder Page`, `CAPA Actions & Closure`, `Referral Actions & Reply`, `CAPA Evidence & Cards`, `Form Item Editor & Tests`, `Submission Detail Blocks`, `Phase Responder & Submissions`, `Case Narrative Cards`, `Interview & Agenda Forms`, `Derived Indicator Config`, `Meeting Attendees & Quorum`, `Hospital Detail Pages`, `Narrative Templates`, `Event Notification & Triage`, `Rca window form`, `Page`, `Document editor`, `Section signoff fields`, `Page`, `TitleAssignControl`, `Condition builder`, `Page`, `CaseActionItemForm`, `Case tags panel`, `Page`, `Page`, `CaseActionItemsPanel`, `Recommend when editor`, `Page`, `ActionItemForm`, `Referral patient fields`, `DepartmentDefDialog`, `ADR 0050`, `Page`, `ConfirmDeleteButton`, `ADR 0028`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _1196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Case Lifecycle Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.04888445492472338 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05804837364470392 - nodes in this community are weakly interconnected._
- **Should `Shared UI & Phase Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.09110512129380054 - nodes in this community are weakly interconnected._
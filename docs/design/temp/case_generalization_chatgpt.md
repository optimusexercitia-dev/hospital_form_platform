# Committee Case Generalization Database Design

## Adapting a Patient-Centered Committee Platform to Support Ethics Committee Medical Complaint Cases

**Prepared for:** Hospital Forms / Hospital Committee Platform  
**Target stack:** Supabase / PostgreSQL  
**Primary goal:** Generalize the existing patient-centered committee case model so the same platform can support committees such as Morbidity & Mortality, Ethics, Quality & Safety, Risk Management, Infection Control, Credentialing, and others without creating separate platforms.

---

# 1. Executive Summary

The current platform is built around the workflow:

```text
Committee members are assigned a patient case
→ they fill out a form
→ the patient case is discussed in a meeting
```

This works well for committees such as Morbidity & Mortality. However, it does not naturally support committees where the central subject is not a patient. A key example is the Ethics Committee, which may evaluate physicians after formal complaints.

The recommended architectural shift is:

```text
A Case is not necessarily a Patient Case.
A Case is a committee-governed matter under evaluation.
```

A case may involve one or more participants:

```text
Patient
Doctor
Complainant
Witness
Nurse
Resident
Department
Hospital unit
Legal representative
External regulatory body
```

Therefore, the core database should evolve from:

```text
case → patient
```

to:

```text
case → many participants with roles
```

The platform should introduce three core abstractions:

```text
Case Type
Participant
Participant Role
```

With these abstractions, an M&M case and an Ethics Committee complaint can share the same underlying primitives:

```text
Cases
Participants
Assignments
Forms
Documents
Timeline
Meetings
Decisions
Action Items
Permissions
Audit Logs
```

Committee-specific details are modeled using extension tables, for example:

```text
mm_case_details
ethics_case_details
ethics_case_allegations
ethics_case_findings
ethics_decision_details
```

This design avoids creating a separate platform for each committee while still allowing each committee type to have specific workflows, terminology, access rules, form templates, decision types, and reporting needs.

---

# 2. Core Design Principles

## 2.1 A case is a committee matter, not necessarily a patient case

The central entity should be a generic `committee_cases` table, not `patient_cases`.

A patient-centered case becomes one type of committee case.

An ethics complaint becomes another type of committee case.

This allows the same product to support multiple hospital committee workflows.

---

## 2.2 Participants are attached to cases through roles

A person or entity is not inherently a respondent, witness, attending physician, or complainant.

Those are contextual roles inside a specific case.

For example:

```text
Dr. João Silva may be:
- respondent doctor in one ethics case
- witness in another ethics case
- attending physician in an M&M case
- committee reviewer in another case
```

Therefore, the participant role belongs to the relationship between the participant and the case.

Correct model:

```text
case_participants
  case_id
  participant_id
  role_id
```

Incorrect model:

```text
participants
  type = 'respondent_doctor'
```

---

## 2.3 Committee-specific depth belongs in extension tables

The base case table should not become a large table with many nullable columns for every possible committee.

Avoid this:

```text
committee_cases
  patient_id
  doctor_id
  complaint_number
  allegation_category
  sanction_type
  appeal_deadline
  mortality_date
  preventability_score
  infection_type
  rca_required
```

Instead, keep the base case generic and add extension tables:

```text
committee_cases
mm_case_details
ethics_case_details
ethics_case_allegations
ethics_decision_details
```

This keeps the core schema stable while allowing each committee module to evolve independently.

---

## 2.4 The form engine should remain shared

The existing form system should not be duplicated for ethics cases.

Instead, form templates should become case-type aware.

Examples:

```text
M&M Committee:
- Case Review Form
- Preventability Assessment Form
- Contributing Factors Form

Ethics Committee:
- Complaint Admissibility Form
- Conflict of Interest Declaration
- Investigator Review Form
- Witness Interview Form
- Respondent Statement Review
- Decision Recommendation Form
```

All of these can use the same form tables:

```text
form_templates
form_sections
form_question_blocks
form_responses
form_answers
```

---

## 2.5 Permissions must be case-type aware

Ethics complaints are highly sensitive. A member of the Ethics Committee should not automatically see every ethics complaint.

For Ethics Committee cases, default visibility should usually be:

```text
explicit_grants_only
```

For some other committees, broader access may be acceptable, for example:

```text
committee_admins_and_assigned_reviewers
```

Access rules should be enforced in Supabase Row Level Security, not only in the frontend.

---

# 3. High-Level Domain Model

```text
Organization
  └── Hospital
        └── Committee
              └── Committee Case
                    ├── Case Type
                    ├── Participants
                    │     ├── Patient
                    │     ├── Doctor / Professional
                    │     ├── External Person
                    │     ├── Department
                    │     └── Institution / Regulatory Body
                    ├── Assignments
                    ├── Forms
                    ├── Documents / Evidence
                    ├── Timeline
                    ├── Meetings
                    ├── Decisions
                    ├── Action Items
                    ├── Access Grants
                    └── Audit Events
```

---

# 4. Recommended Module Structure

```text
Core Committee Case Module
  committee_cases
  case_types
  case_workflow_templates
  case_workflow_stages
  case_status_history
  participants
  participant subtype tables
  case_participant_roles
  case_participants
  case_assignments
  case_documents
  case_timeline_events
  case_decisions
  action_items
  case_access_grants
  case_conflict_declarations
  case_recusals
  audit_events

Forms Module
  form_templates
  form_template_case_types
  form_sections
  form_question_blocks
  form_responses
  form_answers

Meetings Module
  committee_meetings
  meeting_agenda_items
  meeting_case_discussions
  meeting_minutes
  case_votes

Morbidity & Mortality Module
  mm_case_details
  mm_contributing_factors
  mm_preventability_assessments

Ethics Committee Module
  ethics_case_details
  ethics_case_allegations
  ethics_case_findings
  ethics_decision_details
  ethics_case_notifications
  ethics_hearings
  ethics_appeals
```

---

# 5. Core Tables

---

# 5.1 `case_types`

## Purpose

Defines the type of committee case. This table allows the platform to support multiple committee workflows without creating separate case systems.

Examples:

```text
morbidity_mortality
ethics_complaint
quality_review
risk_management
infection_control
credentialing_review
sentinel_event_review
```

## Suggested Schema

```sql
create table case_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  key text not null,
  display_name text not null,
  description text,

  primary_subject_label text,
  default_case_label text not null default 'Case',
  default_visibility_policy text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, key),

  constraint case_types_default_visibility_policy_check check (
    default_visibility_policy in (
      'committee_members',
      'committee_admins_and_assigned_reviewers',
      'assigned_reviewers_only',
      'explicit_grants_only'
    )
  )
);
```

## Important Columns

| Column | Purpose |
|---|---|
| `key` | Stable programmatic identifier, for example `ethics_complaint`. |
| `display_name` | Human-readable name. |
| `primary_subject_label` | UI label such as `Patient`, `Respondent Doctor`, or `Event`. |
| `default_case_label` | UI label such as `Patient Case`, `Ethical Complaint`, or `Quality Review`. |
| `default_visibility_policy` | Controls baseline access model for cases of this type. |

## Design Justification

This table is the main generalization point. Without it, the application will keep assuming that all cases are patient-centered.

A `case_type` allows the same `committee_cases` table to support different workflows, terminology, default permissions, reports, forms, and decision types.

This design also supports future expansion. For example, the platform can later support Infection Control, Credentialing, Quality & Safety, RCA, or Risk Management cases without reworking the core data model.

---

# 5.2 `case_type_terminology`

## Purpose

Stores UI terminology overrides by case type. This prevents patient-specific labels from appearing inside ethics workflows.

## Suggested Schema

```sql
create table case_type_terminology (
  id uuid primary key default gen_random_uuid(),
  case_type_id uuid not null references case_types(id) on delete cascade,

  term_key text not null,
  singular_label text not null,
  plural_label text,
  help_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (case_type_id, term_key)
);
```

## Example Rows

### M&M Case Type

| term_key | singular_label |
|---|---|
| `case` | `Patient Case` |
| `primary_subject` | `Patient` |
| `timeline` | `Clinical Timeline` |
| `document` | `Clinical Document` |
| `decision` | `Committee Conclusion` |

### Ethics Complaint Case Type

| term_key | singular_label |
|---|---|
| `case` | `Ethical Complaint` |
| `primary_subject` | `Respondent Doctor` |
| `timeline` | `Procedural Timeline` |
| `document` | `Complaint Document` |
| `decision` | `Committee Decision` |

## Design Justification

Terminology is not a cosmetic concern. It directly affects usability and trust.

An Ethics Committee user should not see labels such as `Patient Case Details` or `Patient Timeline` when evaluating a physician complaint.

By making terminology configurable, the same screens can adapt to different committees without duplicating the entire frontend.

---

# 5.3 `committee_cases`

## Purpose

The main root entity for all committee matters.

A `committee_case` may represent:

```text
An M&M patient case
An ethics complaint against a physician
A sentinel event review
A quality review
A risk management case
A credentialing review
```

## Suggested Schema

```sql
create table committee_cases (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete restrict,
  committee_id uuid not null references committees(id) on delete restrict,
  case_type_id uuid not null references case_types(id) on delete restrict,

  case_number text,
  title text not null,
  summary text,

  status text not null default 'draft',
  current_stage_id uuid references case_workflow_stages(id) on delete set null,

  confidentiality_level text not null default 'standard',
  visibility_policy text,

  opened_at timestamptz,
  closed_at timestamptz,

  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (organization_id, case_number),

  constraint committee_cases_status_check check (
    status in (
      'draft',
      'open',
      'under_review',
      'on_hold',
      'ready_for_meeting',
      'discussed',
      'decision_pending',
      'closed',
      'cancelled',
      'archived'
    )
  ),

  constraint committee_cases_confidentiality_level_check check (
    confidentiality_level in (
      'standard',
      'restricted',
      'highly_restricted',
      'legal_privileged'
    )
  ),

  constraint committee_cases_visibility_policy_check check (
    visibility_policy is null or visibility_policy in (
      'committee_members',
      'committee_admins_and_assigned_reviewers',
      'assigned_reviewers_only',
      'explicit_grants_only'
    )
  )
);
```

## Important Columns

| Column | Purpose |
|---|---|
| `case_type_id` | Determines whether this is an M&M case, ethics complaint, risk review, etc. |
| `committee_id` | The committee responsible for the case. |
| `status` | Broad operational state. |
| `current_stage_id` | Specific workflow stage from the case type workflow. |
| `confidentiality_level` | Sensitivity marker used by access control and UI. |
| `visibility_policy` | Optional override of the case type default visibility policy. |
| `case_number` | Human-facing identifier. |
| `deleted_at` | Supports soft deletion. |

## Design Justification

This table is deliberately generic. It should not contain patient-specific or ethics-specific columns.

The reason is that the same case engine should support many committee types. If committee-specific fields are added directly to `committee_cases`, the table will become polluted with nullable columns and committee-specific logic.

The generic base table provides stable identity, ownership, workflow state, confidentiality, and lifecycle management. Committee-specific details are stored in extension tables.

---

# 5.4 `case_workflow_templates`

## Purpose

Defines workflow templates by case type.

For example, M&M and Ethics cases have different procedural stages.

## Suggested Schema

```sql
create table case_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  case_type_id uuid not null references case_types(id) on delete cascade,

  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (case_type_id, name)
);
```

## Design Justification

Different committees follow different procedural paths. A full BPMN engine is probably unnecessary at this stage, but stage templates are necessary.

This table allows the platform to define different workflows without hardcoding them in application code.

---

# 5.5 `case_workflow_stages`

## Purpose

Defines the ordered stages inside a workflow template.

## Suggested Schema

```sql
create table case_workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_template_id uuid not null references case_workflow_templates(id) on delete cascade,

  stage_key text not null,
  display_name text not null,
  description text,
  sort_order integer not null,

  is_initial boolean not null default false,
  is_terminal boolean not null default false,
  requires_assignment boolean not null default false,
  requires_meeting_discussion boolean not null default false,
  requires_decision boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workflow_template_id, stage_key),
  unique (workflow_template_id, sort_order)
);
```

## Example M&M Stages

```text
created
assigned
under_review
ready_for_meeting
discussed
action_items_pending
closed
```

## Example Ethics Stages

```text
complaint_received
admissibility_review
awaiting_respondent_response
investigation
hearing_scheduled
deliberation
decision_issued
appeal_period
closed
```

## Design Justification

Workflow stages make the platform case-type aware without requiring separate case tables.

They also allow the UI to render progress indicators, dashboards, filters, and next-action prompts based on the case type.

---

# 5.6 `case_status_history`

## Purpose

Tracks status and stage changes over time.

## Suggested Schema

```sql
create table case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  previous_status text,
  new_status text not null,

  previous_stage_id uuid references case_workflow_stages(id) on delete set null,
  new_stage_id uuid references case_workflow_stages(id) on delete set null,

  changed_by uuid references users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb
);
```

## Design Justification

Committee cases often require traceability. Ethics complaints especially require a clear procedural history.

A status history table allows the platform to answer questions such as:

```text
When was the complaint moved to investigation?
Who closed the case?
Why was the case placed on hold?
When did the appeal period begin?
```

---

# 6. Participant Model

---

# 6.1 `participants`

## Purpose

Provides a unified identity for any person or entity involved in a case.

Participants can be:

```text
Patient
Doctor / Professional
External person
Hospital department
Institution
Regulatory body
```

## Suggested Schema

```sql
create table participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  participant_type text not null,
  display_name text not null,
  sensitivity_level text not null default 'standard',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint participants_participant_type_check check (
    participant_type in (
      'patient',
      'professional',
      'external_person',
      'department',
      'institution',
      'regulatory_body',
      'other'
    )
  ),

  constraint participants_sensitivity_level_check check (
    sensitivity_level in (
      'standard',
      'restricted',
      'highly_restricted'
    )
  )
);
```

## Design Justification

A unified participant table solves the problem of cases involving different entity types.

Without this abstraction, the case table would need many nullable foreign keys:

```text
patient_id
doctor_id
complainant_id
witness_id
department_id
```

That design is brittle and does not scale.

The `participants` table gives every case-involved entity a stable identifier, regardless of subtype.

---

# 6.2 Participant Subtype Tables

## Purpose

Stores subtype-specific fields while preserving a unified `participant_id`.

This avoids unsafe polymorphic foreign keys such as:

```text
entity_type
entity_id
```

which PostgreSQL cannot enforce with ordinary foreign keys.

---

## 6.2.1 `patient_participants`

```sql
create table patient_participants (
  participant_id uuid primary key references participants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,

  created_at timestamptz not null default now(),

  unique (patient_id)
);
```

## Justification

Allows existing patient records to participate in cases without making all cases patient-centered.

An M&M case can mark a patient participant as the primary subject.

An ethics case may also include a patient participant as an affected patient or complainant.

---

## 6.2.2 `professional_participants`

```sql
create table professional_participants (
  participant_id uuid primary key references participants(id) on delete cascade,
  professional_profile_id uuid not null references professional_profiles(id) on delete restrict,

  created_at timestamptz not null default now(),

  unique (professional_profile_id)
);
```

## Justification

A doctor or other health professional involved in a case may or may not be a platform user.

For ethics cases, the respondent doctor may be:

```text
An active user
A doctor without a platform login
A former employee
An external physician
A contractor
A resident
```

Therefore, the ethics respondent should not be modeled only as a `user_id`.

---

## 6.2.3 `external_person_participants`

```sql
create table external_person_participants (
  participant_id uuid primary key references participants(id) on delete cascade,

  full_name text not null,
  email_encrypted text,
  phone_encrypted text,
  document_identifier_encrypted text,
  notes_encrypted text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Justification

Ethics cases may involve complainants, witnesses, family members, or legal representatives who are not hospital users and do not exist in the patient or professional registry.

Sensitive contact details should be encrypted or stored using the platform's secure field strategy.

---

## 6.2.4 `department_participants`

```sql
create table department_participants (
  participant_id uuid primary key references participants(id) on delete cascade,
  hospital_department_id uuid not null references hospital_departments(id) on delete restrict,

  created_at timestamptz not null default now(),

  unique (hospital_department_id)
);
```

## Justification

Some cases involve a department rather than a single person.

Examples:

```text
ICU
Emergency Department
Surgery Department
Obstetrics Department
Radiology Department
```

This is useful for both M&M and non-M&M cases.

---

## 6.2.5 `institution_participants`

```sql
create table institution_participants (
  participant_id uuid primary key references participants(id) on delete cascade,

  name text not null,
  institution_type text not null,
  external_identifier text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint institution_participants_type_check check (
    institution_type in (
      'hospital',
      'clinic',
      'laboratory',
      'regulatory_body',
      'medical_board',
      'legal_entity',
      'other'
    )
  )
);
```

## Justification

Ethics and regulatory cases may involve outside institutions, medical boards, legal offices, or external hospitals.

This allows the case participant model to represent those entities without forcing them into person-based tables.

---

# 6.3 `professional_profiles`

## Purpose

Represents physicians and other professionals independently from user accounts.

## Suggested Schema

```sql
create table professional_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  user_id uuid references users(id) on delete set null,

  full_name text not null,
  professional_type text not null,
  license_number text,
  license_region text,
  specialty text,
  hospital_affiliation_status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint professional_profiles_professional_type_check check (
    professional_type in (
      'physician',
      'resident',
      'nurse',
      'pharmacist',
      'physiotherapist',
      'administrator',
      'other'
    )
  ),

  constraint professional_profiles_affiliation_status_check check (
    hospital_affiliation_status in (
      'active',
      'inactive',
      'former',
      'external',
      'contractor',
      'trainee',
      'unknown'
    )
  )
);
```

## Design Justification

This is essential for ethics cases.

A doctor under review should not have to be an authenticated platform user. If the respondent is modeled only as `users.id`, the platform cannot represent external doctors, former employees, contractors, or physicians without accounts.

Separating `professional_profiles` from `users` gives the system much more flexibility.

---

# 6.4 `case_participant_roles`

## Purpose

Defines roles that participants can have in cases.

## Suggested Schema

```sql
create table case_participant_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  case_type_id uuid references case_types(id) on delete cascade,

  key text not null,
  display_name text not null,
  description text,

  allowed_participant_types text[] not null default '{}',
  is_primary_subject_candidate boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, case_type_id, key)
);
```

## Example M&M Roles

```text
affected_patient
attending_physician
consultant_physician
resident
nurse
involved_department
reviewer
```

## Example Ethics Roles

```text
respondent_doctor
complainant
affected_patient
witness
investigator
legal_representative
committee_reviewer
external_regulatory_body
```

## Design Justification

The same participant may have different roles in different cases. Therefore, role must be attached through `case_participants`, not stored directly on the participant.

Making roles case-type aware allows the UI to offer appropriate options depending on the committee workflow.

---

# 6.5 `case_participants`

## Purpose

Associates participants with a case and defines their role in that case.

## Suggested Schema

```sql
create table case_participants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete restrict,
  role_id uuid not null references case_participant_roles(id) on delete restrict,

  is_primary_subject boolean not null default false,
  involvement_summary text,

  added_by uuid references users(id) on delete set null,
  added_at timestamptz not null default now(),
  removed_at timestamptz,

  unique (case_id, participant_id, role_id)
);
```

## Recommended Partial Index

Only one primary subject may be appropriate for some case types, but not all. If the product requires a single primary subject per case, use:

```sql
create unique index one_primary_subject_per_case
on case_participants(case_id)
where is_primary_subject = true and removed_at is null;
```

If future case types may have multiple primary subjects, do not enforce this globally. Instead, enforce it by case type in application service logic or with a trigger.

## Design Justification

This is the key table that allows the platform to support non-patient cases.

M&M case:

```text
case → participant João Silva → role affected_patient → primary subject
```

Ethics case:

```text
case → participant Dr. Roberto Mendes → role respondent_doctor → primary subject
case → participant Maria Oliveira → role complainant
case → participant Patient ABC → role affected_patient
case → participant Nurse Carla → role witness
```

This model is more flexible than a case table with direct `patient_id` or `doctor_id` columns.

---

# 7. Case Assignments

---

# 7.1 `case_assignments`

## Purpose

Assigns committee members or users to evaluate, investigate, manage, or review a case.

## Suggested Schema

```sql
create table case_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  assigned_to_user_id uuid not null references users(id) on delete restrict,
  assigned_by_user_id uuid references users(id) on delete set null,

  assignment_role text not null,
  status text not null default 'pending',

  due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  instructions text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_assignments_assignment_role_check check (
    assignment_role in (
      'reviewer',
      'investigator',
      'case_manager',
      'chair_reviewer',
      'form_responder',
      'document_reviewer',
      'meeting_presenter',
      'other'
    )
  ),

  constraint case_assignments_status_check check (
    status in (
      'pending',
      'accepted',
      'in_progress',
      'completed',
      'cancelled',
      'overdue'
    )
  )
);
```

## Design Justification

Assignments are shared across committee types.

For M&M:

```text
Assign committee member to review a patient case before a meeting.
```

For Ethics:

```text
Assign investigator to review a complaint.
Assign chair to perform admissibility screening.
Assign reviewer to evaluate the respondent's written response.
```

The same table supports both workflows.

---

# 8. Forms Integration

The existing form model should remain central. The necessary adjustment is to connect form templates and responses to generic cases and, optionally, to specific case participants.

---

# 8.1 `form_template_case_types`

## Purpose

Defines which case types can use a given form template.

## Suggested Schema

```sql
create table form_template_case_types (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references form_templates(id) on delete cascade,
  case_type_id uuid not null references case_types(id) on delete cascade,

  is_default_for_case_type boolean not null default false,
  required_at_stage_id uuid references case_workflow_stages(id) on delete set null,

  created_at timestamptz not null default now(),

  unique (form_template_id, case_type_id)
);
```

## Design Justification

This preserves the existing forms engine while allowing different committees to use different form templates.

A form should not be globally available for all cases unless intended. For example, a `Complaint Admissibility Form` should usually only appear for `ethics_complaint` cases.

---

# 8.2 Recommended additions to `form_responses`

## Purpose

Allow form responses to be attached not only to a case, but also to a specific participant or assignment when necessary.

## Suggested Columns to Add

```sql
alter table form_responses
add column case_id uuid references committee_cases(id) on delete cascade,
add column assignment_id uuid references case_assignments(id) on delete set null,
add column target_participant_id uuid references participants(id) on delete set null,
add column target_case_participant_id uuid references case_participants(id) on delete set null;
```

## Example Uses

```text
M&M Case Review Form:
  case_id = M&M case
  assignment_id = assigned reviewer

Ethics Respondent Statement Review:
  case_id = ethics case
  target_participant_id = respondent doctor

Witness Interview Form:
  case_id = ethics case
  target_case_participant_id = witness participant in the case
```

## Design Justification

Ethics cases often require forms about specific people, not only the case as a whole.

For example:

```text
Witness Interview Form
Respondent Statement Review
Complainant Intake Form
Conflict of Interest Declaration
```

Adding optional target participant fields makes the form engine context-aware while preserving its general structure.

---

# 9. Documents and Evidence

---

# 9.1 `case_documents`

## Purpose

Stores documents, evidence, attachments, reports, and files associated with a committee case.

## Suggested Schema

```sql
create table case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  uploaded_by uuid references users(id) on delete set null,
  related_participant_id uuid references participants(id) on delete set null,

  document_type text not null,
  title text not null,
  description text,

  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,

  confidentiality_level text not null default 'standard',
  visibility_scope text not null default 'case_access',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint case_documents_confidentiality_level_check check (
    confidentiality_level in (
      'standard',
      'restricted',
      'highly_restricted',
      'legal_privileged'
    )
  ),

  constraint case_documents_visibility_scope_check check (
    visibility_scope in (
      'case_access',
      'assigned_reviewers',
      'case_admins_only',
      'legal_only',
      'deliberation_only',
      'custom_grants_only'
    )
  )
);
```

## Example M&M Document Types

```text
clinical_summary
death_certificate
operative_note
icu_note
lab_report
imaging_report
timeline_export
root_cause_analysis
```

## Example Ethics Document Types

```text
formal_complaint
respondent_statement
witness_statement
medical_record_excerpt
email_correspondence
committee_notice
hearing_minutes
decision_letter
appeal_document
```

## Design Justification

The document system should not be patient-specific. Ethics complaints involve complaint documents, responses, hearing minutes, and decision letters. M&M cases involve clinical records and timeline exports.

A generic `case_documents` table supports both.

The `visibility_scope` field is important because ethics documents may have stricter access than the case itself.

---

# 9.2 `case_document_access_grants`

## Purpose

Optional document-level access control for highly sensitive files.

## Suggested Schema

```sql
create table case_document_access_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references case_documents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,

  access_level text not null,
  granted_by uuid references users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text,

  unique (document_id, user_id),

  constraint case_document_access_level_check check (
    access_level in ('read', 'comment', 'manage')
  )
);
```

## Design Justification

Case-level access may be too broad for ethics cases.

For example, an assigned reviewer may access the case metadata and general documents but not legal correspondence or deliberation-only files.

Document-level grants give the platform finer control for sensitive workflows.

---

# 10. Timeline

---

# 10.1 `case_timeline_events`

## Purpose

Stores chronological events related to a case.

This table should support both clinical timelines and procedural/legal timelines.

## Suggested Schema

```sql
create table case_timeline_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  event_category text not null,
  event_type text not null,
  title text not null,
  description text,

  occurred_at timestamptz,
  occurred_date date,
  sequence_order numeric,

  related_participant_id uuid references participants(id) on delete set null,
  related_document_id uuid references case_documents(id) on delete set null,
  related_meeting_id uuid references committee_meetings(id) on delete set null,
  related_decision_id uuid references case_decisions(id) on delete set null,

  source_type text,
  source_id uuid,

  confidence_level text not null default 'confirmed',
  visibility_scope text not null default 'case_access',

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint case_timeline_events_category_check check (
    event_category in (
      'clinical_event',
      'administrative_event',
      'communication_event',
      'legal_procedural_event',
      'meeting_event',
      'decision_event',
      'evidence_event',
      'deadline_event',
      'other'
    )
  ),

  constraint case_timeline_events_confidence_check check (
    confidence_level in ('confirmed', 'reported', 'estimated', 'disputed')
  ),

  constraint case_timeline_events_visibility_scope_check check (
    visibility_scope in (
      'case_access',
      'assigned_reviewers',
      'case_admins_only',
      'deliberation_only',
      'custom_grants_only'
    )
  )
);
```

## Example M&M Timeline Events

```text
Admission
Surgery
ICU transfer
Sepsis recognition
Antibiotic administration
Cardiac arrest
Death
M&M discussion
Action item created
```

## Example Ethics Timeline Events

```text
Complaint filed
Complaint acknowledged
Respondent notified
Response deadline
Witness interviewed
Hearing scheduled
Committee deliberation
Decision issued
Appeal deadline
Case closed
```

## Design Justification

The timeline feature should not be limited to clinical patient events.

For ethics cases, procedural timelines are extremely valuable because deadlines, notifications, evidence collection, hearings, deliberation, and appeals must be traceable.

The same visualization engine can render different event categories depending on the case type.

---

# 11. Meetings

---

# 11.1 `committee_meetings`

## Purpose

Represents scheduled meetings, hearings, deliberation sessions, and committee discussions.

## Suggested Schema

```sql
create table committee_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete restrict,
  committee_id uuid not null references committees(id) on delete cascade,

  meeting_type text not null,
  title text not null,
  description text,

  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,

  location text,
  virtual_meeting_url text,

  status text not null default 'scheduled',
  confidentiality_level text not null default 'standard',

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint committee_meetings_type_check check (
    meeting_type in (
      'regular_committee_meeting',
      'case_discussion',
      'ethics_hearing',
      'deliberation_session',
      'appeal_session',
      'special_session',
      'other'
    )
  ),

  constraint committee_meetings_status_check check (
    status in ('scheduled', 'in_progress', 'completed', 'cancelled')
  )
);
```

## Design Justification

M&M and Ethics cases both involve meetings, but the nature of the meeting differs.

M&M cases are usually discussed in regular committee meetings.

Ethics cases may require hearings, confidential deliberations, or appeal sessions.

A generic meeting table with `meeting_type` supports both workflows.

---

# 11.2 `meeting_agenda_items`

## Purpose

Associates cases or topics with a meeting agenda.

## Suggested Schema

```sql
create table meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references committee_meetings(id) on delete cascade,
  case_id uuid references committee_cases(id) on delete cascade,

  title text not null,
  description text,
  agenda_order integer not null,

  discussion_mode text not null default 'standard_discussion',
  estimated_duration_minutes integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (meeting_id, agenda_order),

  constraint meeting_agenda_items_discussion_mode_check check (
    discussion_mode in (
      'standard_discussion',
      'morbidity_mortality_review',
      'ethics_hearing',
      'confidential_deliberation',
      'decision_vote',
      'appeal_review',
      'other'
    )
  )
);
```

## Design Justification

The platform can keep its existing meeting-discussion model if cases are attached as agenda items.

This supports both:

```text
Discuss patient case in M&M meeting
Conduct hearing for ethics complaint
Conduct confidential deliberation
Review appeal
```

---

# 11.3 `meeting_case_discussions`

## Purpose

Stores structured discussion output for a case discussed in a meeting.

## Suggested Schema

```sql
create table meeting_case_discussions (
  id uuid primary key default gen_random_uuid(),
  agenda_item_id uuid not null references meeting_agenda_items(id) on delete cascade,
  case_id uuid not null references committee_cases(id) on delete cascade,

  summary text,
  conclusions text,
  unresolved_questions text,
  next_steps text,

  recorded_by uuid references users(id) on delete set null,
  recorded_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Design Justification

Discussions are relevant across committee types, but the structure of those discussions may vary.

This table stores the common discussion result. More specific details can be captured in forms or committee-specific tables.

---

# 11.4 `case_votes`

## Purpose

Records formal votes, especially relevant for ethics decisions.

## Suggested Schema

```sql
create table case_votes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  decision_id uuid references case_decisions(id) on delete cascade,
  meeting_id uuid references committee_meetings(id) on delete set null,

  voter_user_id uuid not null references users(id) on delete restrict,
  vote text not null,
  rationale text,

  voted_at timestamptz not null default now(),

  unique (case_id, decision_id, voter_user_id),

  constraint case_votes_vote_check check (
    vote in ('approve', 'reject', 'abstain', 'recused')
  )
);
```

## Design Justification

Ethics committees may require formal deliberation and voting records.

This table also supports future workflows where a committee vote is needed, such as credentialing or policy approval.

---

# 12. Decisions

---

# 12.1 `case_decisions`

## Purpose

Stores general case decisions, conclusions, or determinations.

## Suggested Schema

```sql
create table case_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  decision_type text not null,
  decision_summary text not null,
  rationale text,

  status text not null default 'draft',
  decided_at timestamptz,
  decided_by uuid references users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint case_decisions_status_check check (
    status in ('draft', 'proposed', 'approved', 'issued', 'appealed', 'voided')
  )
);
```

## Example M&M Decision Types

```text
no_preventable_issue
preventable_harm_identified
system_issue_identified
requires_action_items
requires_escalation
```

## Example Ethics Decision Types

```text
complaint_not_admissible
no_violation_found
violation_found
warning_recommended
disciplinary_action_recommended
refer_to_medical_board
refer_to_legal_department
education_or_remediation_required
```

## Design Justification

Every committee case eventually reaches some kind of conclusion.

A generic `case_decisions` table supports this common need. Committee-specific decision metadata should be stored in extension tables such as `ethics_decision_details`.

---

# 13. Action Items

---

# 13.1 Recommended additions to `action_items`

If an `action_items` table already exists, adapt it to reference generic committee cases and participants.

## Suggested Core Schema

```sql
create table action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete restrict,
  committee_id uuid references committees(id) on delete restrict,
  case_id uuid references committee_cases(id) on delete cascade,

  related_participant_id uuid references participants(id) on delete set null,

  title text not null,
  description text,
  motive text,

  responsible_user_id uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,

  status text not null default 'open',
  urgency text not null default 'medium',
  deadline_at timestamptz,
  completed_at timestamptz,

  confidentiality_level text not null default 'standard',
  requires_legal_review boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint action_items_status_check check (
    status in (
      'open',
      'in_progress',
      'blocked',
      'completed',
      'cancelled',
      'overdue'
    )
  ),

  constraint action_items_urgency_check check (
    urgency in ('low', 'medium', 'high', 'critical')
  )
);
```

## Example M&M Action Items

```text
Update sepsis protocol
Review ICU handoff process
Audit antibiotic administration timing
Create educational session for surgical team
```

## Example Ethics Action Items

```text
Notify respondent doctor
Request written response
Schedule hearing
Prepare decision letter
Notify regulatory body
Assign remediation training
Track completion of sanction period
```

## Design Justification

Action items are useful across all committee types. The main adaptation is to allow an action item to relate to a generic case and optionally to a specific participant.

This is especially useful in ethics cases, where an action item may relate specifically to the respondent, complainant, or legal representative.

---

# 14. Access Control and Confidentiality

---

# 14.1 `case_access_grants`

## Purpose

Provides explicit per-case access control.

This is critical for ethics cases.

## Suggested Schema

```sql
create table case_access_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,

  access_level text not null,
  granted_by uuid references users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (case_id, user_id),

  constraint case_access_grants_level_check check (
    access_level in (
      'metadata_only',
      'read',
      'comment',
      'review',
      'manage',
      'admin'
    )
  )
);
```

## Design Justification

Committee membership alone should not always grant access to all cases.

For M&M, broader committee-level access may be acceptable depending on hospital policy.

For Ethics, access should usually be explicit.

This table gives the platform fine-grained control over who can see or manage each case.

---

# 14.2 `case_conflict_declarations`

## Purpose

Records whether a user has a conflict of interest in a case.

## Suggested Schema

```sql
create table case_conflict_declarations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,

  has_conflict boolean not null,
  conflict_description text,
  submitted_at timestamptz not null default now(),

  unique (case_id, user_id)
);
```

## Design Justification

Ethics cases often require formal conflict-of-interest declarations before review, deliberation, or voting.

This table gives the organization a defensible record of conflict review.

---

# 14.3 `case_recusals`

## Purpose

Records users who are recused from a case.

## Suggested Schema

```sql
create table case_recusals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,

  reason text,
  recused_by uuid references users(id) on delete set null,
  recused_at timestamptz not null default now(),

  unique (case_id, user_id)
);
```

## Design Justification

A recused user should not be allowed to access, review, deliberate, or vote on the case unless an administrator explicitly overrides the policy.

This is particularly important for ethics complaints where professional relationships may create conflicts.

---

# 14.4 Recommended RLS Logic

The RLS policy for `committee_cases` should consider at least:

```text
1. User belongs to the organization.
2. User has access to the hospital or committee.
3. Case is not soft-deleted.
4. Case visibility policy allows access.
5. User has explicit case grant when required.
6. User is not recused.
7. User is not the respondent doctor unless explicitly granted access.
8. Confidentiality level allows the requested operation.
```

## Example Access Function Concept

```sql
create or replace function can_access_case(
  p_user_id uuid,
  p_case_id uuid,
  p_required_level text
)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from committee_cases c
    left join case_access_grants g
      on g.case_id = c.id
     and g.user_id = p_user_id
     and (g.expires_at is null or g.expires_at > now())
    where c.id = p_case_id
      and c.deleted_at is null
      and not exists (
        select 1
        from case_recusals r
        where r.case_id = c.id
          and r.user_id = p_user_id
      )
      and (
        g.access_level in ('read', 'comment', 'review', 'manage', 'admin')
        or user_is_committee_admin(p_user_id, c.committee_id)
      )
  );
$$;
```

The exact implementation should map access levels by rank rather than using repeated string lists, but the concept is the same.

## Design Justification

RLS must enforce confidentiality at the database layer.

Frontend-only hiding is not sufficient for HIPAA-sensitive, legal, disciplinary, or reputationally sensitive cases.

---

# 15. Audit Logging

---

# 15.1 `audit_events`

## Purpose

Tracks sensitive access and modifications across the platform.

## Suggested Schema

```sql
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete set null,
  committee_id uuid references committees(id) on delete set null,
  case_id uuid references committee_cases(id) on delete set null,

  actor_user_id uuid references users(id) on delete set null,

  event_type text not null,
  entity_type text not null,
  entity_id uuid,

  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,

  metadata jsonb not null default '{}'::jsonb
);
```

## Events to Log

For all sensitive cases:

```text
case_created
case_viewed
case_updated
case_deleted
case_status_changed
case_access_granted
case_access_revoked
document_uploaded
document_viewed
document_downloaded
document_deleted
form_response_submitted
decision_created
decision_issued
action_item_created
meeting_discussion_recorded
```

For ethics cases specifically:

```text
complaint_received
respondent_notified
witness_statement_added
hearing_scheduled
conflict_declared
user_recused
vote_recorded
appeal_received
external_reporting_recorded
```

## Design Justification

Audit logging is essential for ethics complaints and high-sensitivity patient safety reviews.

The platform should be able to answer:

```text
Who viewed this case?
Who viewed this document?
Who granted access?
Who changed the allegation?
Who issued the decision?
Who downloaded the decision letter?
```

For ethics cases, read-access logs are as important as write-access logs.

---

# 16. Morbidity & Mortality Extension Tables

---

# 16.1 `mm_case_details`

## Purpose

Stores M&M-specific clinical metadata.

## Suggested Schema

```sql
create table mm_case_details (
  case_id uuid primary key references committee_cases(id) on delete cascade,

  index_event_date timestamptz,
  admission_date timestamptz,
  discharge_or_death_date timestamptz,

  clinical_area text,
  harm_severity text,
  preventability_assessment text,

  brief_clinical_summary text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mm_case_details_harm_severity_check check (
    harm_severity is null or harm_severity in (
      'none',
      'mild',
      'moderate',
      'severe',
      'death',
      'unknown'
    )
  ),

  constraint mm_case_details_preventability_check check (
    preventability_assessment is null or preventability_assessment in (
      'not_preventable',
      'possibly_preventable',
      'probably_preventable',
      'preventable',
      'undetermined'
    )
  )
);
```

## Design Justification

M&M cases have clinical metadata that does not belong in the generic `committee_cases` table.

This table keeps clinical fields separate while still linking them to the shared case engine.

---

# 16.2 `mm_contributing_factors`

## Purpose

Stores contributing factors identified during M&M review.

## Suggested Schema

```sql
create table mm_contributing_factors (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  category text not null,
  description text not null,
  severity text,
  is_root_cause boolean not null default false,

  identified_by uuid references users(id) on delete set null,
  identified_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Design Justification

M&M cases frequently identify system, communication, diagnostic, therapeutic, workflow, or resource-related contributing factors.

This data can later feed analytics and action item generation.

---

# 16.3 `mm_preventability_assessments`

## Purpose

Stores structured preventability assessments.

## Suggested Schema

```sql
create table mm_preventability_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  assessed_by uuid references users(id) on delete set null,

  assessment text not null,
  rationale text,
  confidence_level text,

  assessed_at timestamptz not null default now(),

  constraint mm_preventability_assessment_check check (
    assessment in (
      'not_preventable',
      'possibly_preventable',
      'probably_preventable',
      'preventable',
      'undetermined'
    )
  )
);
```

## Design Justification

Preventability may be assessed by individual reviewers before the final committee conclusion.

This table allows multiple assessments to be collected and compared.

---

# 17. Ethics Committee Extension Tables

---

# 17.1 `ethics_case_details`

## Purpose

Stores ethics-specific procedural metadata for a complaint case.

## Suggested Schema

```sql
create table ethics_case_details (
  case_id uuid primary key references committee_cases(id) on delete cascade,

  complaint_received_at timestamptz not null,
  complaint_source text not null,
  external_reference_number text,

  admissibility_status text not null default 'pending',
  admissibility_decided_at timestamptz,
  admissibility_decided_by uuid references users(id) on delete set null,

  respondent_notified_at timestamptz,
  response_due_at timestamptz,
  response_received_at timestamptz,

  hearing_required boolean not null default false,
  appeal_allowed boolean not null default true,
  appeal_deadline timestamptz,

  external_reporting_required boolean not null default false,
  external_reporting_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ethics_case_details_complaint_source_check check (
    complaint_source in (
      'patient',
      'family_member',
      'professional',
      'hospital_administration',
      'anonymous',
      'regulatory_body',
      'legal_representative',
      'other'
    )
  ),

  constraint ethics_case_details_admissibility_status_check check (
    admissibility_status in (
      'pending',
      'admissible',
      'not_admissible',
      'requires_more_information',
      'referred_elsewhere'
    )
  )
);
```

## Design Justification

Ethics cases have procedural requirements that do not apply to M&M cases.

Examples:

```text
Complaint received date
Complaint source
Admissibility review
Respondent notification
Response deadline
Hearing requirement
Appeal deadline
External reporting
```

These fields should not be placed in the generic case table.

---

# 17.2 `ethics_case_allegations`

## Purpose

Stores one or more allegations associated with an ethics complaint.

## Suggested Schema

```sql
create table ethics_case_allegations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  allegation_category text not null,
  allegation_description text not null,
  alleged_event_date timestamptz,

  severity text,
  status text not null default 'under_review',

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint ethics_case_allegations_status_check check (
    status in (
      'under_review',
      'substantiated',
      'not_substantiated',
      'partially_substantiated',
      'dismissed',
      'referred_elsewhere'
    )
  )
);
```

## Example Allegation Categories

```text
professional_misconduct
negligence
abandonment
breach_of_confidentiality
documentation_falsification
inappropriate_relationship
communication_issue
conflict_of_interest
discrimination_or_harassment
billing_or_financial_misconduct
other
```

## Design Justification

A single ethics complaint may contain multiple allegations. Each allegation may have a different status, severity, finding, and rationale.

Modeling allegations separately avoids flattening a complex complaint into a single text field.

---

# 17.3 `ethics_case_findings`

## Purpose

Stores findings for specific allegations.

## Suggested Schema

```sql
create table ethics_case_findings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  allegation_id uuid references ethics_case_allegations(id) on delete cascade,

  finding text not null,
  rationale text,
  evidence_summary text,

  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ethics_case_findings_finding_check check (
    finding in (
      'substantiated',
      'not_substantiated',
      'partially_substantiated',
      'inconclusive',
      'dismissed'
    )
  )
);
```

## Design Justification

Findings should be attached to allegations because a complaint can have multiple allegations with different conclusions.

For example:

```text
Allegation 1: breach of confidentiality → substantiated
Allegation 2: abandonment → not substantiated
Allegation 3: unprofessional communication → partially substantiated
```

---

# 17.4 `ethics_decision_details`

## Purpose

Stores ethics-specific details for a general case decision.

## Suggested Schema

```sql
create table ethics_decision_details (
  decision_id uuid primary key references case_decisions(id) on delete cascade,

  sanction_type text,
  sanction_start_date date,
  sanction_end_date date,

  remediation_required boolean not null default false,
  remediation_description text,

  external_reporting_required boolean not null default false,
  external_reporting_body text,
  external_reporting_deadline timestamptz,
  external_reporting_completed_at timestamptz,

  appeal_allowed boolean not null default true,
  appeal_deadline timestamptz,

  decision_letter_document_id uuid references case_documents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Example Sanction Types

```text
none
verbal_warning
written_warning
mandatory_training
supervised_practice
temporary_restriction
credentialing_review
referral_to_medical_board
termination_recommendation
other
```

## Design Justification

A general decision table is useful across all committees. However, ethics decisions may involve sanctions, remediation, external reporting, appeal deadlines, and decision letters.

Those fields are specific to ethics workflows and should live in an extension table.

---

# 17.5 `ethics_case_notifications`

## Purpose

Tracks formal notifications sent during an ethics case.

## Suggested Schema

```sql
create table ethics_case_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,

  recipient_participant_id uuid references participants(id) on delete set null,
  recipient_user_id uuid references users(id) on delete set null,

  notification_type text not null,
  delivery_method text not null,
  status text not null default 'pending',

  sent_at timestamptz,
  acknowledged_at timestamptz,
  due_at timestamptz,

  related_document_id uuid references case_documents(id) on delete set null,
  notes text,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ethics_case_notifications_type_check check (
    notification_type in (
      'complaint_acknowledgement',
      'respondent_notification',
      'request_for_response',
      'hearing_notice',
      'decision_notice',
      'appeal_notice',
      'external_reporting_notice',
      'other'
    )
  ),

  constraint ethics_case_notifications_delivery_method_check check (
    delivery_method in ('email', 'letter', 'in_person', 'system', 'phone', 'other')
  ),

  constraint ethics_case_notifications_status_check check (
    status in ('pending', 'sent', 'acknowledged', 'failed', 'cancelled')
  )
);
```

## Design Justification

Ethics cases often require formal notification steps. These should be tracked as first-class procedural events, not buried in notes.

Examples:

```text
Complaint received acknowledgement
Respondent notified
Request for written response
Hearing notice
Decision notice
Appeal notice
```

This table also supports procedural timelines and auditability.

---

# 17.6 `ethics_hearings`

## Purpose

Stores hearing-specific metadata for ethics cases.

## Suggested Schema

```sql
create table ethics_hearings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  meeting_id uuid references committee_meetings(id) on delete set null,

  hearing_type text not null,
  scheduled_at timestamptz,
  completed_at timestamptz,

  respondent_present boolean,
  complainant_present boolean,
  legal_representative_present boolean,

  summary text,
  outcome text,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ethics_hearings_type_check check (
    hearing_type in (
      'initial_hearing',
      'evidence_hearing',
      'deliberation_hearing',
      'appeal_hearing',
      'other'
    )
  )
);
```

## Design Justification

Ethics cases may have hearings that are more formal than ordinary committee discussions.

A hearing can be linked to a generic `committee_meeting`, but hearing-specific metadata should be stored separately.

---

# 17.7 `ethics_appeals`

## Purpose

Tracks appeals after an ethics decision.

## Suggested Schema

```sql
create table ethics_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references committee_cases(id) on delete cascade,
  decision_id uuid references case_decisions(id) on delete cascade,

  submitted_by_participant_id uuid references participants(id) on delete set null,
  submitted_at timestamptz not null,

  appeal_reason text not null,
  status text not null default 'submitted',

  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  outcome text,
  outcome_rationale text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ethics_appeals_status_check check (
    status in (
      'submitted',
      'under_review',
      'accepted',
      'rejected',
      'withdrawn',
      'closed'
    )
  )
);
```

## Design Justification

Appeals should be modeled explicitly because they affect case lifecycle, deadlines, finality of decisions, and reporting.

Not every ethics committee will use this feature, but the schema supports it cleanly.

---

# 18. Relationships Summary

## Core Relationships

```text
case_types 1 ── * committee_cases
committees 1 ── * committee_cases
committee_cases 1 ── * case_participants
participants 1 ── * case_participants
case_participant_roles 1 ── * case_participants
committee_cases 1 ── * case_assignments
committee_cases 1 ── * case_documents
committee_cases 1 ── * case_timeline_events
committee_cases 1 ── * case_decisions
committee_cases 1 ── * action_items
committee_cases 1 ── * case_access_grants
committee_cases 1 ── * audit_events
```

## Participant Relationships

```text
participants 1 ── 0..1 patient_participants
participants 1 ── 0..1 professional_participants
participants 1 ── 0..1 external_person_participants
participants 1 ── 0..1 department_participants
participants 1 ── 0..1 institution_participants
professional_profiles 1 ── 0..1 professional_participants
users 1 ── 0..1 professional_profiles
```

## Workflow Relationships

```text
case_types 1 ── * case_workflow_templates
case_workflow_templates 1 ── * case_workflow_stages
case_workflow_stages 1 ── * committee_cases.current_stage_id
committee_cases 1 ── * case_status_history
```

## Forms Relationships

```text
form_templates * ── * case_types via form_template_case_types
committee_cases 1 ── * form_responses
case_assignments 1 ── * form_responses
participants 1 ── * form_responses.target_participant_id
case_participants 1 ── * form_responses.target_case_participant_id
```

## Meetings Relationships

```text
committees 1 ── * committee_meetings
committee_meetings 1 ── * meeting_agenda_items
committee_cases 1 ── * meeting_agenda_items
meeting_agenda_items 1 ── 0..1 meeting_case_discussions
committee_cases 1 ── * case_votes
case_decisions 1 ── * case_votes
```

## Ethics Relationships

```text
committee_cases 1 ── 0..1 ethics_case_details
committee_cases 1 ── * ethics_case_allegations
ethics_case_allegations 1 ── * ethics_case_findings
case_decisions 1 ── 0..1 ethics_decision_details
committee_cases 1 ── * ethics_case_notifications
committee_cases 1 ── * ethics_hearings
committee_cases 1 ── * ethics_appeals
case_decisions 1 ── * ethics_appeals
```

## M&M Relationships

```text
committee_cases 1 ── 0..1 mm_case_details
committee_cases 1 ── * mm_contributing_factors
committee_cases 1 ── * mm_preventability_assessments
```

---

# 19. Example Data Model Scenarios

---

# 19.1 M&M Patient Case

## Base Case

```text
committee_cases
  case_type = morbidity_mortality
  title = Unexpected ICU death after postoperative deterioration
  status = under_review
```

## Participants

```text
case_participants
  participant = Patient João Silva
  role = affected_patient
  is_primary_subject = true

case_participants
  participant = Dr. Almeida
  role = attending_physician
  is_primary_subject = false

case_participants
  participant = Surgery Department
  role = involved_department
  is_primary_subject = false
```

## Extension Details

```text
mm_case_details
  index_event_date = date of deterioration
  harm_severity = death
  preventability_assessment = possibly_preventable
```

## Forms

```text
form_response
  case_id = M&M case
  form_template = M&M Case Review Form
  assignment_id = reviewer assignment
```

---

# 19.2 Ethics Complaint Against Doctor

## Base Case

```text
committee_cases
  case_type = ethics_complaint
  title = Formal complaint regarding professional conduct
  status = under_review
  confidentiality_level = highly_restricted
  visibility_policy = explicit_grants_only
```

## Participants

```text
case_participants
  participant = Dr. Roberto Mendes
  role = respondent_doctor
  is_primary_subject = true

case_participants
  participant = Maria Oliveira
  role = complainant
  is_primary_subject = false

case_participants
  participant = Patient ABC
  role = affected_patient
  is_primary_subject = false

case_participants
  participant = Nurse Carla
  role = witness
  is_primary_subject = false
```

## Extension Details

```text
ethics_case_details
  complaint_received_at = complaint receipt date
  complaint_source = patient
  admissibility_status = admissible
  respondent_notified_at = notification date
  response_due_at = deadline
  hearing_required = true
```

## Allegations

```text
ethics_case_allegations
  allegation_category = breach_of_confidentiality
  allegation_description = alleged unauthorized disclosure of patient information
  status = under_review
```

## Forms

```text
form_response
  case_id = ethics case
  form_template = Complaint Admissibility Form

form_response
  case_id = ethics case
  form_template = Witness Interview Form
  target_case_participant_id = Nurse Carla as witness

form_response
  case_id = ethics case
  form_template = Respondent Statement Review
  target_case_participant_id = Dr. Roberto Mendes as respondent_doctor
```

---

# 20. Migration Strategy From Patient-Centered Cases

If the current platform already has a `patient_cases` table, migration should be controlled and incremental.

---

## Phase 1 — Introduce the generic case type system

Add:

```text
case_types
case_type_terminology
case_workflow_templates
case_workflow_stages
```

Create an initial case type:

```text
morbidity_mortality
```

---

## Phase 2 — Rename or wrap patient cases

Preferred long-term direction:

```text
patient_cases → committee_cases
```

If a direct rename is too risky, introduce `committee_cases` and migrate data gradually.

Temporary compatibility is acceptable:

```text
patient_cases still exists
committee_cases created in parallel
patient_cases.case_id references committee_cases.id
```

But the final desired state should be:

```text
committee_cases is the root entity
patient-specific data lives in mm_case_details or clinical_case_details
```

---

## Phase 3 — Add participant abstraction

Create:

```text
participants
patient_participants
professional_participants
case_participant_roles
case_participants
```

For every existing patient case:

```text
old patient_case.patient_id
```

create:

```text
participants row with participant_type = patient
patient_participants row linking participant to patient
case_participants row with role = affected_patient and is_primary_subject = true
```

---

## Phase 4 — Move patient-specific fields to extension table

Create:

```text
mm_case_details
```

Move clinical-only fields from the old patient case table into `mm_case_details`.

Examples:

```text
admission_date
index_event_date
mortality_date
harm_severity
preventability_assessment
clinical_summary
```

---

## Phase 5 — Make form templates case-type aware

Add:

```text
form_template_case_types
```

Attach current M&M forms to:

```text
case_type = morbidity_mortality
```

Then create new Ethics Committee templates:

```text
Complaint Admissibility Form
Conflict of Interest Declaration
Investigator Review Form
Witness Interview Form
Respondent Statement Review
Decision Recommendation Form
```

---

## Phase 6 — Add ethics extension tables

Add:

```text
ethics_case_details
ethics_case_allegations
ethics_case_findings
ethics_decision_details
ethics_case_notifications
ethics_hearings
ethics_appeals
```

---

## Phase 7 — Harden RLS before production ethics usage

Before enabling ethics cases in production, implement and test:

```text
case_access_grants
case_recusals
case_conflict_declarations
document-level access when needed
audit logging for reads and writes
```

This phase should not be postponed if real physician complaint data will be stored.

---

# 21. Supabase / PostgreSQL Implementation Notes

## 21.1 Avoid unsafe polymorphic foreign keys

Avoid this pattern:

```sql
entity_type text,
entity_id uuid
```

It is flexible but cannot be enforced by normal PostgreSQL foreign keys.

Preferred pattern:

```text
participants
patient_participants
professional_participants
external_person_participants
department_participants
institution_participants
```

This gives the system a single `participant_id` while preserving relational integrity.

---

## 21.2 Use soft deletes for sensitive entities

Use `deleted_at` instead of physical deletion for:

```text
committee_cases
participants
case_documents
case_timeline_events
case_decisions
action_items
ethics_case_allegations
```

Hard deletion should be restricted to administrative data or controlled retention workflows.

---

## 21.3 Use `jsonb` only for metadata, not core relational concepts

Appropriate uses of `jsonb`:

```text
audit_events.metadata
case_status_history.metadata
case_timeline_events.source metadata if needed
```

Avoid storing core relationships in JSONB, for example:

```text
participants list
case access grants
allegations
decisions
assignments
```

Those should be relational tables.

---

## 21.4 Use indexes aggressively on access and case navigation

Recommended indexes:

```sql
create index idx_committee_cases_committee on committee_cases(committee_id);
create index idx_committee_cases_case_type on committee_cases(case_type_id);
create index idx_committee_cases_status on committee_cases(status);
create index idx_committee_cases_stage on committee_cases(current_stage_id);
create index idx_committee_cases_deleted_at on committee_cases(deleted_at);

create index idx_case_participants_case on case_participants(case_id);
create index idx_case_participants_participant on case_participants(participant_id);
create index idx_case_participants_role on case_participants(role_id);

create index idx_case_access_grants_case_user on case_access_grants(case_id, user_id);
create index idx_case_assignments_case on case_assignments(case_id);
create index idx_case_assignments_user on case_assignments(assigned_to_user_id);

create index idx_case_documents_case on case_documents(case_id);
create index idx_case_timeline_events_case_time on case_timeline_events(case_id, occurred_at);
create index idx_case_decisions_case on case_decisions(case_id);

create index idx_audit_events_case on audit_events(case_id);
create index idx_audit_events_actor on audit_events(actor_user_id);
create index idx_audit_events_occurred_at on audit_events(occurred_at);
```

---

## 21.5 Consider rank-based access levels

Instead of repeatedly checking string lists, consider an access-level rank function.

Example conceptual mapping:

```text
metadata_only = 10
read = 20
comment = 30
review = 40
manage = 50
admin = 60
```

Then access checks become:

```text
user_access_rank >= required_access_rank
```

This is cleaner than hardcoding lists everywhere.

---

# 22. Key Design Decisions and Justifications

---

## Decision 1 — Replace patient-centered case ownership with generic committee cases

### Decision

Use `committee_cases` as the root entity for all committee matters.

### Justification

This prevents the platform from being locked into patient-centered workflows.

A patient case, ethics complaint, sentinel event review, and credentialing case can all share the same case-management infrastructure.

---

## Decision 2 — Add `case_types`

### Decision

Use `case_types` to define workflow category, terminology, default visibility, and allowed configuration.

### Justification

Different committees need different stages, forms, decisions, and UI labels. `case_types` provides the central configuration layer.

---

## Decision 3 — Use participants instead of direct `patient_id` or `doctor_id` on cases

### Decision

Use `participants` and `case_participants` to associate many entities with each case.

### Justification

Real cases often involve multiple people and entities. A direct `patient_id` or `doctor_id` is too narrow.

This design supports:

```text
Multiple patients
Multiple doctors
Complainants
Witnesses
Departments
Institutions
Regulatory bodies
```

---

## Decision 4 — Store participant role on the case relationship

### Decision

Store roles in `case_participants.role_id`, not on the participant itself.

### Justification

A person's role changes from case to case.

The same physician can be a respondent in one case, a witness in another, and an attending physician in an M&M review.

---

## Decision 5 — Use extension tables for committee-specific data

### Decision

Store M&M-specific fields in `mm_case_details` and ethics-specific fields in `ethics_case_details` and related tables.

### Justification

This prevents the generic case table from becoming a large sparse table with many nullable columns.

It also allows each committee module to evolve independently.

---

## Decision 6 — Keep forms generic but make them case-type aware

### Decision

Reuse the existing form engine and add `form_template_case_types` plus optional target participant fields on form responses.

### Justification

The form system is already one of the most powerful abstractions in the platform.

Ethics workflows need different forms, not a different form engine.

---

## Decision 7 — Add explicit case access grants

### Decision

Use `case_access_grants` to provide per-case access control.

### Justification

Ethics cases are more sensitive than ordinary committee cases. Membership in the Ethics Committee should not automatically provide access to all ethics complaints.

This must be enforced through RLS.

---

## Decision 8 — Add conflicts and recusals

### Decision

Use `case_conflict_declarations` and `case_recusals`.

### Justification

Ethics committees require defensible conflict-of-interest management. Recused users should be excluded from review, deliberation, voting, and access.

---

## Decision 9 — Generalize the timeline

### Decision

Use `case_timeline_events` for both clinical and procedural events.

### Justification

The timeline is useful beyond patient care. Ethics cases need procedural timelines for complaint filing, notification, response deadlines, hearings, decisions, and appeals.

---

## Decision 10 — Audit both reads and writes for sensitive cases

### Decision

Use `audit_events` and log sensitive read access, especially document views and case views.

### Justification

For ethics complaints and highly restricted cases, knowing who accessed information is as important as knowing who changed it.

---

# 23. Implementation Warning: Do Not Treat Ethics as “Just Another Form”

It may be tempting to implement ethics cases by simply creating an Ethics Committee form template and attaching it to the existing patient case system.

That would be insufficient.

The missing elements are:

```text
Doctor/respondent as primary subject
Formal complaint intake
Allegation tracking
Admissibility review
Respondent notification
Witnesses
Conflict-of-interest declarations
Recusals
Hearings
Deliberation
Voting
Sanctions or recommendations
Appeals
Stricter access control
Audit trail for sensitive reads
```

Therefore, the correct adaptation is not only a form change. It is a case model generalization.

---

# 24. Final Recommended Target Architecture

The platform should be understood as:

```text
A secure committee case-management platform for structured review, deliberation, decision-making, and follow-up.
```

Not merely:

```text
A patient case review platform.
```

The reusable workflow is:

```text
A matter is opened
Relevant participants are attached
Evidence is collected
Committee members are assigned
Structured forms are completed
The matter is discussed or heard
A decision is recorded
Action items are generated
The case is closed
An audit trail is preserved
```

The final architecture should support:

```text
M&M Committee
Ethics Committee
Quality & Safety Committee
Risk Management
Infection Control
Credentialing
Sentinel Event Review
Root Cause Analysis
```

using shared primitives and committee-specific extensions.

---

# 25. Minimal Viable Implementation Checklist

To support Ethics Committee cases without a separate platform, implement at minimum:

```text
case_types
committee_cases.case_type_id
participants
professional_profiles
professional_participants
case_participant_roles
case_participants
ethics_case_details
ethics_case_allegations
form_template_case_types
case_access_grants
case_conflict_declarations
case_recusals
audit_events
```

Then adapt existing features to use `committee_cases` instead of `patient_cases`:

```text
Assignments
Forms
Meetings
Timeline
Documents
Decisions
Action Items
Permissions
```

This is the smallest credible refactor that avoids building a separate Ethics Committee platform.

---

# 26. Suggested Naming Convention

## Backend / Database

Prefer:

```text
committee_cases
case_types
case_participants
participants
```

Avoid:

```text
patient_cases as the long-term root entity
ethics_cases as a completely separate root entity
doctor_cases
```

## Application Code

Prefer:

```text
CommitteeCaseService
CommitteeCaseRepository
CaseParticipantService
CaseAccessService
```

Avoid:

```text
PatientCaseService for all case types
EthicsCaseService duplicating the entire case engine
```

## UI

Use terminology based on case type:

```text
M&M:
  Case → Patient Case
  Primary Subject → Patient
  Timeline → Clinical Timeline

Ethics:
  Case → Ethical Complaint
  Primary Subject → Respondent Doctor
  Timeline → Procedural Timeline
```

---

# 27. Closing Recommendation

The platform should not create a separate product for the Ethics Committee.

Instead, it should generalize the current patient-centered model into a committee case-management model.

The critical change is:

```text
Do not model a case as belonging to a patient.
Model a case as having participants with roles.
```

Once this is done, the same platform can support both:

```text
M&M case:
  primary participant = patient

Ethics complaint:
  primary participant = respondent doctor
```

The remaining differences should be handled through:

```text
case types
workflow stages
form templates
participant roles
extension tables
permissions policies
terminology configuration
```

This gives the product a much stronger long-term architecture and positions it as a general hospital committee platform rather than a narrow patient case review tool.

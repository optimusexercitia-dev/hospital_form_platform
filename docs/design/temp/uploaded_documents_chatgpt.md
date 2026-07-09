# Uploaded Documents Data Model Handoff

**Project:** Hospital committee platform  
**Database target:** PostgreSQL / Supabase-compatible Postgres  
**Purpose:** Design a secure, extensible uploaded/scanned document subsystem for patient-centered committees, physician-centered ethics/credentialing workflows, RCA workflows, forms, meetings, and institutional documents.  
**Primary concerns:** PHI protection, strict access control, auditability, document versioning, scanned-document processing, and support for many document types without creating a fragmented attachment model.

---

## 1. Executive Summary

Uploaded documents should be modeled as a dedicated security domain, not as simple attachments to cases, forms, meetings, or action items.

The core model is:

```text
documents
  = logical secured document

document_versions
  = immutable versions of the logical document

file_assets
  = physical files in private object storage

document_resource_links
  = relationships between a document and platform entities

document_subjects
  = people/entities the document is about

document_access_grants
  = explicit permission grants to users/groups/institutions

document_effective_permissions
  = materialized per-user permissions for fast RLS checks

document_access_audit_events
  = mandatory audit trail for reads, downloads, changes, and denials
```

This architecture supports:

- PHI-heavy scanned documents;
- restrictive document permissions independent from case permissions;
- form-upload documents;
- generated form PDFs;
- evidence documents;
- M&M committee documents;
- RCA evidence;
- ethics complaint documents centered on physicians rather than patients;
- credentialing documents;
- legal/privileged documents;
- redacted document versions;
- OCR and page-level processing;
- immutable version history;
- secure private storage with short-lived signed URLs;
- HIPAA-style auditability.

The most important architectural rule is:

> A user being able to access a case, form, meeting, or action item does not automatically mean they can access every document linked to it.

Document access must be independently permissioned.

---

## 2. Design Goals

### 2.1 Functional goals

The document subsystem must support:

1. Uploading scanned PDFs and images.
2. Linking documents to arbitrary platform entities.
3. Supporting multiple document types.
4. Supporting patient-centered and physician-centered workflows.
5. Supporting versioning and derived artifacts.
6. Supporting OCR, thumbnails, page rendering, and future AI processing.
7. Supporting redacted versions of sensitive documents.
8. Supporting strict access grants.
9. Supporting temporary access and access requests.
10. Supporting audit trails for view/download/access-denied events.
11. Supporting retention policies and legal hold.

### 2.2 Security goals

The subsystem must protect:

- PHI;
- peer-review protected information;
- medico-legal documents;
- ethics complaint documents;
- credentialing documents;
- personally identifiable staff/physician information;
- OCR text and extracted metadata;
- object storage paths and signed URLs.

### 2.3 Product goals

The design must avoid creating a separate document model for each workflow. The same subsystem should work for:

- Morbidity and Mortality committee;
- Ethics committee;
- Quality and Safety / RCA workflows;
- credentialing committee;
- institutional committees;
- general committee meetings;
- form submissions.

---

## 3. Existing Tables Assumed

This handoff assumes the existing project already has or will have equivalent tables for:

```text
organizations
hospitals
committees
user_profiles
cases
patients
physicians
forms
form_versions
form_sections
form_question_blocks
form_submissions
form_answers
committee_meetings
meeting_agenda_items
action_items
risks
issues
rca_events
complaints
```

If table names differ in the current codebase, adapt foreign keys accordingly.

The schema below intentionally references these expected domain tables but keeps the document subsystem mostly independent.

---

## 4. Core Architectural Decisions

### 4.1 Documents are first-class secured resources

A document should not be a `file_url` column on another table.

Bad design:

```sql
cases.file_url
form_answers.file_url
meetings.file_url
action_items.file_url
```

This duplicates file handling and security logic throughout the system.

Preferred design:

```text
cases/forms/meetings/action_items
  -> app_resources
  -> document_resource_links
  -> documents
  -> document_versions
  -> file_assets
```

This centralizes:

- permission checks;
- storage strategy;
- audit logging;
- redaction;
- OCR;
- versioning;
- retention policy.

### 4.2 Logical document and physical file are separated

A logical document may have many physical files:

- original upload;
- normalized PDF;
- page images;
- thumbnails;
- OCR JSON;
- extracted text;
- redacted PDF;
- signed manifest;
- converted archival copy.

Therefore:

```text
documents
  -> document_versions
      -> document_version_assets
          -> file_assets
```

### 4.3 Domain links and permissions are separated

A document can be linked to a case but not automatically visible to everyone who can see the case.

Example:

- Case summary visible to all committee members.
- Original scanned medical record visible only to assigned reviewers.
- Redacted summary visible to broader committee.

This requires `document_resource_links` and `document_access_grants` to be separate tables.

### 4.4 Sensitive metadata is separated from non-PHI metadata

The main `documents` table should contain only safe display metadata.

For example, this is safe:

```text
External hospital discharge summary
Medication administration record
Complaint document
```

This is not safe:

```text
Maria Silva ICU discharge summary
Complaint against Dr. João Oliveira
```

Sensitive metadata belongs in `document_sensitive_metadata`, which should have stricter RLS.

### 4.5 OCR text is sensitive data

OCR output may contain more easily searchable PHI than the original scan. It must not be exposed through ordinary metadata APIs.

OCR text should have the same or stricter access requirements as the original document file.

### 4.6 Use explicit access grants for sensitive documents

For high-risk documents, default to explicit grants only.

Examples requiring explicit access:

- legal documents;
- ethics complaint documents;
- credentialing documents;
- peer-review evidence;
- external medical records;
- documents containing PHI;
- unrestricted OCR text.

### 4.7 Use materialized effective permissions for RLS

Complex permission resolution involving hospitals, committees, cases, dynamic groups, and temporary grants is difficult and slow to compute directly inside every RLS policy.

Recommended approach:

1. Store grants in `document_access_grants`.
2. Store group membership in `security_group_members`.
3. Compute final user permissions into `document_effective_permissions`.
4. RLS checks only the effective table.

This is easier to test, faster, and safer.

---

## 5. Entity Relationship Overview

```text
organizations
  └── hospitals
        └── committees

app_resources
  ├── references any domain entity by resource_type + resource_pk
  └── used by document_resource_links and document_subjects

document_kinds
  └── documents
        ├── document_sensitive_metadata
        ├── document_versions
        │     ├── document_version_assets
        │     │     └── file_assets
        │     ├── document_pages
        │     ├── document_ocr_extractions
        │     └── document_redactions
        │
        ├── document_resource_links
        │     └── app_resources
        │
        ├── document_subjects
        │     └── app_resources
        │
        ├── document_access_grants
        ├── document_effective_permissions
        ├── document_access_requests
        ├── document_lifecycle_events
        └── document_access_audit_events

security_groups
  └── security_group_members

extension tables
  ├── evidence_document_details
  ├── form_document_details
  ├── complaint_document_details
  ├── meeting_document_details
  └── generated_report_document_details
```

---

## 6. Recommended Schema Namespace

If the project already uses multiple schemas, consider placing these tables in a dedicated schema:

```sql
create schema if not exists document_management;
```

However, in Supabase projects, using `public` is common because RLS, generated types, and client SDK integration are simpler.

For this handoff, tables are shown without schema qualification. Prefix with `document_management.` if the project uses separate schemas.

---

## 7. Lookup Values and Enums

The project can implement these as PostgreSQL enums, lookup tables, or constrained text fields.

For a product still under active development, constrained `text` fields are often easier to evolve than enums. The DDL below uses `text` plus `check` constraints where appropriate.

### 7.1 Document lifecycle status

```text
draft
processing
active
archived
soft_deleted
quarantined
```

### 7.2 Document version status

```text
uploading
processing
available
rejected
quarantined
```

### 7.3 Confidentiality labels

```text
public
non_phi_internal
phi_standard
phi_restricted
peer_review_confidential
legal_privileged
ethics_investigation
credentialing_sensitive
```

### 7.4 Asset roles

```text
original_upload
normalized_pdf
page_image
thumbnail
ocr_json
extracted_text
redacted_pdf
signature_manifest
```

### 7.5 Document permissions

```text
view_metadata
view_sensitive_metadata
view_file
download
print
annotate
upload_new_version
manage_access
archive
delete
```

### 7.6 Principal types

```text
user
security_group
committee
hospital
organization
```

### 7.7 Relationship types

```text
evidence_for
attachment_to
generated_from
submitted_with
discussed_in
supports
complaint_document_for
external_record_for
reference_material_for
```

### 7.8 Access inheritance modes

```text
none
inherit_view_from_resource
inherit_manage_from_resource
```

---

## 8. Table: `app_resources`

### Purpose

`app_resources` is a generic registry that lets documents link to any platform entity without adding nullable foreign keys for every possible domain table.

This solves the problem of documents being associated with:

- patient cases;
- physician-centered ethics cases;
- form submissions;
- form answers;
- meetings;
- agenda items;
- action items;
- RCA events;
- complaints;
- physicians;
- patients;
- hospitals;
- committees.

### DDL

```sql
create table app_resources (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),
  hospital_id uuid null references hospitals(id),
  committee_id uuid null references committees(id),

  resource_type text not null,
  resource_pk uuid not null,

  created_at timestamptz not null default now(),

  unique (resource_type, resource_pk)
);
```

### Important notes

`resource_type` should be restricted in application code or via a lookup table.

Example values:

```text
case
patient
physician
committee
meeting
meeting_agenda_item
form
form_submission
form_answer
action_item
risk
issue
rca_event
complaint
department
hospital
organization
```

### Design rationale

Without this table, the document table would need many nullable foreign keys:

```sql
case_id uuid null,
form_submission_id uuid null,
meeting_id uuid null,
action_item_id uuid null,
patient_id uuid null,
physician_id uuid null
```

That approach is brittle and grows poorly. The `app_resources` registry gives the platform a unified way to link secured documents to any domain entity.

---

## 9. Table: `document_kinds`

### Purpose

Defines the semantic type of a document. This allows different default policies, metadata schemas, OCR behavior, and UI behavior per document type.

### DDL

```sql
create table document_kinds (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name text not null,

  parent_kind_id uuid null references document_kinds(id),

  default_confidentiality_label text not null,
  default_requires_explicit_access boolean not null default true,

  ocr_enabled_by_default boolean not null default true,
  redaction_supported boolean not null default true,

  metadata_schema jsonb null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Example rows

```text
evidence_document
form_attachment
generated_form_pdf
committee_report
meeting_minutes
complaint_document
external_medical_record
radiology_report
lab_report
legal_document
credentialing_document
patient_consent
institutional_policy
action_item_attachment
rca_evidence
morbidity_mortality_evidence
ethics_complaint_evidence
```

### Design rationale

The platform must support many uploaded document types. A single `type text` field would work initially but would not capture default behavior.

`document_kinds` allows the system to encode:

- whether OCR should run by default;
- whether redaction is supported;
- default confidentiality;
- whether explicit access is required;
- type-specific UI behavior;
- type-specific metadata expectations.

The `parent_kind_id` supports hierarchical types.

Example:

```text
evidence_document
  ├── rca_evidence
  ├── morbidity_mortality_evidence
  ├── ethics_complaint_evidence
  └── credentialing_evidence
```

---

## 10. Table: `documents`

### Purpose

Represents the logical secured document. It does not directly represent a physical PDF or image file.

### DDL

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),
  owning_hospital_id uuid null references hospitals(id),
  owning_committee_id uuid null references committees(id),

  kind_id uuid not null references document_kinds(id),

  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'processing', 'active', 'archived', 'soft_deleted', 'quarantined')
  ),

  confidentiality_label text not null check (
    confidentiality_label in (
      'public',
      'non_phi_internal',
      'phi_standard',
      'phi_restricted',
      'peer_review_confidential',
      'legal_privileged',
      'ethics_investigation',
      'credentialing_sensitive'
    )
  ),

  contains_phi boolean not null default true,
  requires_explicit_access boolean not null default true,

  title_non_phi text not null,
  description_non_phi text null,

  current_version_id uuid null,

  uploaded_by uuid not null references user_profiles(id),
  created_by uuid not null references user_profiles(id),

  retention_policy_id uuid null references document_retention_policies(id),
  legal_hold boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Delayed foreign key for `current_version_id`

Because `documents` and `document_versions` reference each other conceptually, add the `current_version_id` foreign key after both tables exist:

```sql
alter table documents
add constraint fk_documents_current_version
foreign key (current_version_id)
references document_versions(id);
```

### Design rationale

The `documents` table contains the minimum safe metadata needed to list documents.

Key fields:

- `organization_id`: mandatory tenant boundary.
- `owning_hospital_id`: optional hospital scope.
- `owning_committee_id`: optional committee ownership.
- `kind_id`: semantic document type.
- `lifecycle_status`: document state.
- `confidentiality_label`: confidentiality classification.
- `contains_phi`: quick flag for PHI handling.
- `requires_explicit_access`: determines whether broad inherited access is allowed.
- `title_non_phi`: safe display title.
- `current_version_id`: points to the active/latest version.
- `legal_hold`: prevents normal deletion or retention purge.

The `metadata` JSONB column is intentionally included but should not become a dumping ground for relational information. Important relationships should be modeled in relational tables.

---

## 11. Table: `document_sensitive_metadata`

### Purpose

Stores PHI-bearing or sensitive metadata separately from safe document metadata.

### DDL

```sql
create table document_sensitive_metadata (
  document_id uuid primary key references documents(id) on delete cascade,

  sensitive_title text null,
  sensitive_description text null,

  external_patient_name text null,
  external_patient_identifier text null,

  external_physician_name text null,
  external_document_number text null,

  additional_sensitive_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Design rationale

A user may be allowed to know that a document exists but not allowed to see identifying details.

Example:

Safe metadata:

```text
External medical record
```

Sensitive metadata:

```text
Maria Silva discharge summary from Hospital X
```

This separation supports different RLS policies for ordinary metadata and sensitive metadata.

---

## 12. Table: `document_versions`

### Purpose

Represents immutable versions of a logical document.

### DDL

```sql
create table document_versions (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id) on delete cascade,

  version_number integer not null check (version_number > 0),

  version_status text not null default 'uploading' check (
    version_status in ('uploading', 'processing', 'available', 'rejected', 'quarantined')
  ),

  uploaded_by uuid not null references user_profiles(id),
  uploaded_at timestamptz not null default now(),

  source_channel text not null check (
    source_channel in ('browser_upload', 'mobile_scan', 'email_import', 'generated_pdf', 'api_import')
  ),

  original_filename text null,
  original_mime_type text null,

  page_count integer null check (page_count is null or page_count >= 0),

  sha256_hash text null,

  supersedes_version_id uuid null references document_versions(id),

  change_reason text null,

  created_at timestamptz not null default now(),

  unique (document_id, version_number)
);
```

### Design rationale

Document files should not be overwritten. Versioning is required for:

- medico-legal auditability;
- chain of custody;
- correcting accidental uploads;
- preserving old evidence;
- generating redacted versions;
- comparing submitted and amended form PDFs;
- supporting future digital signatures.

The `sha256_hash` helps detect duplicate files and supports integrity validation.

---

## 13. Table: `file_assets`

### Purpose

Represents physical files stored in object storage.

A file asset can be the original upload, normalized PDF, thumbnail, page image, OCR JSON, extracted text file, or redacted PDF.

### DDL

```sql
create table file_assets (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),

  storage_provider text not null default 'supabase_storage',
  storage_bucket text not null,
  storage_object_path text not null,

  asset_role text not null check (
    asset_role in (
      'original_upload',
      'normalized_pdf',
      'page_image',
      'thumbnail',
      'ocr_json',
      'extracted_text',
      'redacted_pdf',
      'signature_manifest'
    )
  ),

  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),

  sha256_hash text not null,

  encryption_key_ref text null,

  virus_scan_status text not null default 'pending' check (
    virus_scan_status in ('pending', 'clean', 'infected', 'failed', 'skipped')
  ),

  quarantine_status text not null default 'none' check (
    quarantine_status in ('none', 'quarantined', 'released')
  ),

  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),

  deleted_at timestamptz null,

  unique (storage_bucket, storage_object_path)
);
```

### Design rationale

This table decouples object storage from logical documents.

Do not expose `storage_object_path` directly to ordinary clients unless storage RLS is extremely well-tested.

Preferred access pattern:

```text
Client requests file
  -> server/Edge Function checks document_effective_permissions
  -> server creates short-lived signed URL
  -> server logs document_access_audit_event
  -> client receives signed URL
```

Recommended storage bucket behavior:

- private buckets only;
- no public URLs;
- no PHI in object paths;
- short signed URL TTL;
- audit every file view/download.

---

## 14. Table: `document_version_assets`

### Purpose

Many-to-many bridge between document versions and file assets.

### DDL

```sql
create table document_version_assets (
  document_version_id uuid not null references document_versions(id) on delete cascade,
  file_asset_id uuid not null references file_assets(id) on delete restrict,

  asset_role text not null check (
    asset_role in (
      'original_upload',
      'normalized_pdf',
      'page_image',
      'thumbnail',
      'ocr_json',
      'extracted_text',
      'redacted_pdf',
      'signature_manifest'
    )
  ),

  is_primary boolean not null default false,

  created_at timestamptz not null default now(),

  primary key (document_version_id, file_asset_id)
);
```

### Optional uniqueness rule

If the system should allow only one primary asset per version:

```sql
create unique index uq_document_version_primary_asset
on document_version_assets (document_version_id)
where is_primary = true;
```

### Design rationale

A document version may contain many assets:

```text
Version 1
  ├── original_upload.pdf
  ├── normalized.pdf
  ├── page_001.png
  ├── page_002.png
  ├── thumbnail.png
  ├── ocr.json
  └── redacted.pdf
```

This bridge table keeps that relationship flexible.

---

## 15. Table: `document_pages`

### Purpose

Stores page-level information for scanned documents.

### DDL

```sql
create table document_pages (
  id uuid primary key default gen_random_uuid(),

  document_version_id uuid not null references document_versions(id) on delete cascade,

  page_number integer not null check (page_number > 0),

  page_image_asset_id uuid null references file_assets(id),
  thumbnail_asset_id uuid null references file_assets(id),

  width_px integer null check (width_px is null or width_px > 0),
  height_px integer null check (height_px is null or height_px > 0),

  rotation_degrees integer not null default 0,

  created_at timestamptz not null default now(),

  unique (document_version_id, page_number)
);
```

### Design rationale

Page-level modeling enables:

- fast preview rendering;
- page-by-page loading in the frontend;
- page-level OCR;
- page-level redactions;
- annotation anchoring;
- thumbnail grids;
- future AI extraction by page.

For large scanned PDFs, this improves performance significantly compared with always loading the entire file.

---

## 16. Table: `document_ocr_extractions`

### Purpose

Stores OCR processing status and extracted text/structured output.

### DDL

```sql
create table document_ocr_extractions (
  id uuid primary key default gen_random_uuid(),

  document_version_id uuid not null references document_versions(id) on delete cascade,

  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed', 'disabled')
  ),

  language text null,

  extracted_text text null,
  extracted_text_asset_id uuid null references file_assets(id),

  structured_output jsonb null,

  confidence_score numeric null check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (document_version_id)
);
```

### Design rationale

OCR is useful for search, summarization, extraction, and review workflows. However, OCR output is sensitive because it may contain PHI, physician names, diagnoses, dates, addresses, complaint details, and other identifiers.

Do not treat OCR text as low-risk metadata.

Recommended behavior:

- restrict OCR access with `view_file` or a dedicated OCR permission;
- avoid global search across documents the user cannot access;
- consider storing full OCR output as an encrypted asset instead of raw DB text for highly sensitive installations;
- audit OCR views if OCR text is displayed directly.

---

## 17. Table: `document_redactions`

### Purpose

Tracks redacted versions of documents.

### DDL

```sql
create table document_redactions (
  id uuid primary key default gen_random_uuid(),

  source_document_version_id uuid not null references document_versions(id),
  redacted_document_version_id uuid not null references document_versions(id),

  redaction_reason text not null,

  redaction_policy text null,
  -- examples:
  -- remove_patient_identifiers
  -- remove_physician_identifiers
  -- committee_public_version
  -- legal_review_version

  redaction_map_asset_id uuid null references file_assets(id),

  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),

  unique (source_document_version_id, redacted_document_version_id)
);
```

### Design rationale

Redaction should never modify the original file in place.

The original document and the redacted document should both be preserved, with separate access controls.

Example:

```text
Original ICU record:
  visible only to assigned case reviewers

Redacted ICU record:
  visible to broader M&M committee
```

This is especially important for committee discussions where some participants should receive de-identified or limited-access case packets.

---

## 18. Table: `document_resource_links`

### Purpose

Links documents to the entities where they are used.

### DDL

```sql
create table document_resource_links (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id) on delete cascade,

  resource_id uuid not null references app_resources(id) on delete cascade,

  relationship_type text not null check (
    relationship_type in (
      'evidence_for',
      'attachment_to',
      'generated_from',
      'submitted_with',
      'discussed_in',
      'supports',
      'complaint_document_for',
      'external_record_for',
      'reference_material_for'
    )
  ),

  access_inheritance_mode text not null default 'none' check (
    access_inheritance_mode in ('none', 'inherit_view_from_resource', 'inherit_manage_from_resource')
  ),

  linked_by uuid not null references user_profiles(id),
  linked_at timestamptz not null default now(),

  unique (document_id, resource_id, relationship_type)
);
```

### Design rationale

This table answers:

> Where is this document used?

Examples:

```text
Document -> case, relationship_type = evidence_for
Document -> form_submission, relationship_type = submitted_with
Document -> form_answer, relationship_type = attachment_to
Document -> meeting, relationship_type = discussed_in
Document -> complaint, relationship_type = complaint_document_for
Document -> RCA event, relationship_type = evidence_for
```

The `access_inheritance_mode` field is critical.

A document may be linked to a resource without inheriting that resource's permissions.

Example:

```text
Legal complaint letter:
  linked to ethics case
  access_inheritance_mode = none
  explicit grants only

Committee agenda PDF:
  linked to meeting
  access_inheritance_mode = inherit_view_from_resource
```

---

## 19. Table: `document_subjects`

### Purpose

Identifies who or what a document is about.

### DDL

```sql
create table document_subjects (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id) on delete cascade,

  subject_resource_id uuid not null references app_resources(id) on delete cascade,

  subject_role text not null,
  -- examples:
  -- patient_of_record
  -- physician_under_review
  -- complainant
  -- witness
  -- involved_staff
  -- department_involved
  -- institution

  created_at timestamptz not null default now(),

  unique (document_id, subject_resource_id, subject_role)
);
```

### Design rationale

A document's subject is not the same as the resource it is attached to.

Example: ethics complaint document

```text
document_resource_links:
  document -> ethics_case
  document -> complaint

document_subjects:
  document -> physician_under_review
  document -> complainant
  document -> patient_of_record, if applicable
```

This design allows both patient-centered and physician-centered workflows without hardcoding `patient_id` into the document model.

---

## 20. Security Groups

Document access should often be granted to groups rather than directly to every individual user.

Groups may be static or dynamic.

Static examples:

```text
Hospital A members
Committee X members
Committee X admins
Organization admins
```

Dynamic examples:

```text
Case 123 assigned reviewers
Ethics complaint panel
RCA investigation team
Action item responsible users
```

---

## 21. Table: `security_groups`

### Purpose

Represents reusable groups that can receive document access grants.

### DDL

```sql
create table security_groups (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),
  hospital_id uuid null references hospitals(id),
  committee_id uuid null references committees(id),

  name text not null,

  group_type text not null,
  -- examples:
  -- organization_members
  -- hospital_members
  -- committee_members
  -- committee_admins
  -- case_team
  -- case_reviewers
  -- ethics_panel
  -- rca_team
  -- custom

  source_resource_id uuid null references app_resources(id),

  is_dynamic boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Design rationale

Using security groups simplifies document permission management.

Instead of granting access to ten individual reviewers, grant access to the case review group. When a reviewer is added or removed from the case, recompute effective document permissions.

---

## 22. Table: `security_group_members`

### Purpose

Stores membership in security groups.

### DDL

```sql
create table security_group_members (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null references security_groups(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,

  membership_role text null,
  -- examples:
  -- member
  -- admin
  -- reviewer
  -- chair
  -- invited_consultant

  starts_at timestamptz null,
  ends_at timestamptz null,

  created_at timestamptz not null default now(),

  unique (group_id, user_id)
);
```

### Design rationale

Time-bound memberships support temporary consultants, external reviewers, legal counsel, and limited panel assignments.

When membership changes, the app should recompute `document_effective_permissions` for affected users and documents.

---

## 23. Table: `document_access_grants`

### Purpose

Stores explicit access grants for documents.

### DDL

```sql
create table document_access_grants (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id) on delete cascade,

  principal_type text not null check (
    principal_type in ('user', 'security_group', 'committee', 'hospital', 'organization')
  ),

  principal_id uuid not null,

  permission text not null check (
    permission in (
      'view_metadata',
      'view_sensitive_metadata',
      'view_file',
      'download',
      'print',
      'annotate',
      'upload_new_version',
      'manage_access',
      'archive',
      'delete'
    )
  ),

  grant_source text not null default 'manual' check (
    grant_source in ('manual', 'default_policy', 'inherited_from_resource', 'system', 'break_glass')
  ),

  granted_by uuid null references user_profiles(id),

  reason text null,

  starts_at timestamptz null,
  expires_at timestamptz null,

  created_at timestamptz not null default now()
);
```

### Design rationale

This table answers:

> Who has been granted which permission to this document, and why?

The model intentionally uses allow-based grants.

Avoid deny rules initially. Deny semantics make RLS and debugging much harder. In healthcare compliance systems, a simpler permission model is safer.

A `principal_type` + `principal_id` polymorphic reference is used because a grant may target a user, group, committee, hospital, or organization.

The application service must validate that `principal_id` points to the correct table based on `principal_type`.

---

## 24. Table: `document_effective_permissions`

### Purpose

Stores resolved user-document permissions for fast RLS checks.

### DDL

```sql
create table document_effective_permissions (
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,

  permission text not null check (
    permission in (
      'view_metadata',
      'view_sensitive_metadata',
      'view_file',
      'download',
      'print',
      'annotate',
      'upload_new_version',
      'manage_access',
      'archive',
      'delete'
    )
  ),

  source_grant_ids uuid[] not null default '{}',

  computed_at timestamptz not null default now(),

  primary key (document_id, user_id, permission)
);
```

### Design rationale

Do not resolve complex access rules dynamically inside every RLS policy.

Instead, materialize the answer:

```text
User X has view_file on Document Y
```

This table should be recomputed when:

- a document grant is created, updated, deleted, or expired;
- a security group membership changes;
- a committee membership changes;
- a hospital membership changes;
- a case assignment changes;
- a document link inheritance setting changes;
- a document confidentiality policy changes.

This makes RLS policies simple and auditable.

---

## 25. Table: `document_access_requests`

### Purpose

Allows users to request access to restricted documents.

### DDL

```sql
create table document_access_requests (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id),

  requested_by uuid not null references user_profiles(id),

  requested_permission text not null check (
    requested_permission in ('view_file', 'download', 'annotate')
  ),

  justification text not null,

  status text not null default 'pending' check (
    status in ('pending', 'approved', 'denied', 'cancelled', 'expired')
  ),

  reviewed_by uuid null references user_profiles(id),
  reviewed_at timestamptz null,

  review_reason text null,

  expires_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Design rationale

This supports workflows where a reviewer, consultant, or committee member needs temporary access to a restricted document.

Examples:

- committee admin approves temporary access;
- legal team approves review access;
- ethics chair grants panel member access;
- quality department grants RCA reviewer access.

Approval should create corresponding rows in `document_access_grants` and recompute effective permissions.

---

## 26. Table: `document_upload_sessions`

### Purpose

Tracks upload lifecycle before a document becomes active.

### DDL

```sql
create table document_upload_sessions (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),
  hospital_id uuid null references hospitals(id),
  committee_id uuid null references committees(id),

  created_by uuid not null references user_profiles(id),

  proposed_kind_id uuid null references document_kinds(id),
  proposed_confidentiality_label text null,

  status text not null default 'created' check (
    status in ('created', 'uploading', 'uploaded', 'processing', 'completed', 'failed', 'expired')
  ),

  staging_bucket text null,
  staging_object_path text null,

  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Design rationale

Uploaded files should usually enter a staging workflow before becoming active.

Recommended lifecycle:

```text
1. User starts upload session
2. File goes to staging storage
3. Virus scan runs
4. File hash is calculated
5. Document row is created as draft/processing
6. File asset is created
7. Normalization/OCR/page rendering runs
8. Classification/default permissions are applied
9. Document becomes active
10. Audit event is recorded
```

This prevents unscanned or partially processed files from becoming broadly visible.

---

## 27. Table: `document_ingestion_jobs`

### Purpose

Tracks background processing jobs for uploaded documents.

### DDL

```sql
create table document_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),

  document_version_id uuid null references document_versions(id),
  upload_session_id uuid null references document_upload_sessions(id),

  job_type text not null check (
    job_type in (
      'virus_scan',
      'pdf_normalization',
      'page_rendering',
      'ocr',
      'phi_detection',
      'thumbnail_generation',
      'metadata_extraction'
    )
  ),

  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'skipped')
  ),

  started_at timestamptz null,
  completed_at timestamptz null,

  error_message text null,

  output_asset_id uuid null references file_assets(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Design rationale

Document processing is asynchronous and failure-prone.

Tracking jobs explicitly helps with:

- retry logic;
- upload status UI;
- admin troubleshooting;
- partial failure handling;
- auditability of processing steps;
- future migration to background workers or queues.

---

## 28. Table: `document_access_audit_events`

### Purpose

Mandatory audit log for document access and changes.

### DDL

```sql
create table document_access_audit_events (
  id uuid primary key default gen_random_uuid(),

  document_id uuid null references documents(id),
  document_version_id uuid null references document_versions(id),
  file_asset_id uuid null references file_assets(id),

  actor_user_id uuid null references user_profiles(id),

  action text not null check (
    action in (
      'view_metadata',
      'view_sensitive_metadata',
      'view_file',
      'download',
      'print',
      'upload',
      'create_version',
      'redact',
      'grant_access',
      'revoke_access',
      'archive',
      'delete',
      'failed_access_attempt'
    )
  ),

  access_decision text not null check (
    access_decision in ('allowed', 'denied')
  ),

  reason text null,

  ip_address inet null,
  user_agent text null,
  request_id text null,

  created_at timestamptz not null default now()
);
```

### Design rationale

Healthcare systems need read auditing, not only write auditing.

Audit events should be recorded for:

- metadata view;
- sensitive metadata view;
- file preview;
- file download;
- print;
- access denied;
- upload;
- redaction;
- grant/revoke access;
- archive/delete.

For production systems, consider monthly partitioning because this table can become very large.

---

## 29. Retention and Lifecycle Tables

### 29.1 Table: `document_retention_policies`

```sql
create table document_retention_policies (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references organizations(id),

  name text not null,

  retention_period_months integer null check (
    retention_period_months is null or retention_period_months > 0
  ),

  applies_to_kind_id uuid null references document_kinds(id),
  applies_to_confidentiality_label text null,

  delete_behavior text not null default 'soft_delete' check (
    delete_behavior in ('soft_delete', 'archive', 'hard_delete_after_review')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 29.2 Table: `document_lifecycle_events`

```sql
create table document_lifecycle_events (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references documents(id),

  event_type text not null check (
    event_type in (
      'created',
      'activated',
      'archived',
      'soft_deleted',
      'restored',
      'retention_reviewed',
      'legal_hold_added',
      'legal_hold_removed'
    )
  ),

  performed_by uuid null references user_profiles(id),

  reason text null,

  created_at timestamptz not null default now()
);
```

### Design rationale

Documents should not be casually hard-deleted.

The system needs:

- retention rules;
- legal hold;
- lifecycle history;
- restoration path;
- controlled archival;
- explicit hard-delete review if allowed by institutional policy.

Documents with `legal_hold = true` should not be deleted through ordinary workflows.

---

## 30. Type-Specific Extension Tables

The base `documents` table should not contain every possible type-specific field. Use extension tables for structured metadata needed by specific workflows.

---

### 30.1 Table: `evidence_document_details`

```sql
create table evidence_document_details (
  document_id uuid primary key references documents(id) on delete cascade,

  evidence_category text not null,
  -- examples:
  -- medical_record
  -- medication_administration_record
  -- nursing_note
  -- image
  -- lab_report
  -- complaint
  -- email
  -- timeline_support
  -- witness_statement
  -- policy_document

  evidence_date timestamptz null,

  source_description text null,

  obtained_by uuid null references user_profiles(id),
  obtained_at timestamptz null,

  chain_of_custody_required boolean not null default false,

  authenticity_status text not null default 'unverified' check (
    authenticity_status in ('unverified', 'verified', 'disputed')
  )
);
```

#### Rationale

Evidence documents are common across M&M, RCA, ethics, and credentialing workflows. This extension captures evidence-specific fields without bloating the base document table.

---

### 30.2 Table: `form_document_details`

```sql
create table form_document_details (
  document_id uuid primary key references documents(id) on delete cascade,

  form_id uuid null references forms(id),
  form_version_id uuid null references form_versions(id),

  form_submission_id uuid null references form_submissions(id),

  section_id uuid null references form_sections(id),
  question_block_id uuid null references form_question_blocks(id),
  answer_id uuid null references form_answers(id),

  document_generation_mode text null check (
    document_generation_mode is null or document_generation_mode in (
      'uploaded_by_user',
      'generated_from_submission',
      'imported_from_external_system'
    )
  ),

  generated_by_template_version_id uuid null,

  created_at timestamptz not null default now()
);
```

#### Rationale

Documents may be attached to:

- a whole form submission;
- a specific form section;
- a specific question block;
- a specific answer.

The form answer can store references to `document_ids` inside `value_jsonb`, but the actual document remains in the centralized document subsystem.

Example answer payload:

```json
{
  "document_ids": [
    "8c8a4d7e-cbe2-46e6-8d4e-3f10f37e4b88"
  ]
}
```

---

### 30.3 Table: `complaint_document_details`

```sql
create table complaint_document_details (
  document_id uuid primary key references documents(id) on delete cascade,

  complaint_id uuid null references complaints(id),

  complaint_document_type text not null,
  -- examples:
  -- initial_complaint
  -- supporting_evidence
  -- physician_response
  -- witness_statement
  -- legal_correspondence
  -- committee_decision
  -- appeal_document

  received_at timestamptz null,

  received_from_type text null,
  -- examples:
  -- patient
  -- family_member
  -- staff
  -- institution
  -- anonymous
  -- legal_representative

  is_anonymous_source boolean not null default false,

  created_at timestamptz not null default now()
);
```

#### Rationale

Ethics and credentialing workflows may center around physicians, not patients. Complaint documents often require stricter access than ordinary committee evidence.

This extension supports:

- initial complaint;
- physician response;
- witness statement;
- legal correspondence;
- appeal documents;
- final committee decision.

---

### 30.4 Table: `meeting_document_details`

```sql
create table meeting_document_details (
  document_id uuid primary key references documents(id) on delete cascade,

  meeting_id uuid not null references committee_meetings(id),

  agenda_item_id uuid null references meeting_agenda_items(id),

  meeting_document_type text not null,
  -- examples:
  -- agenda
  -- minutes
  -- presentation
  -- case_packet
  -- supporting_material
  -- decision_record

  created_at timestamptz not null default now()
);
```

#### Rationale

Meeting documents may have a different distribution pattern than case evidence.

Examples:

- agenda visible to all committee members;
- minutes visible to committee admins only until approved;
- case packet visible only to participants with case-level access;
- decision record archived after approval.

---

### 30.5 Table: `generated_report_document_details`

```sql
create table generated_report_document_details (
  document_id uuid primary key references documents(id) on delete cascade,

  report_type text not null,
  -- examples:
  -- case_summary
  -- rca_report
  -- pdca_report
  -- committee_decision
  -- action_item_summary
  -- form_submission_pdf

  generated_from_resource_id uuid null references app_resources(id),

  generated_by uuid not null references user_profiles(id),
  generated_at timestamptz not null default now(),

  template_id uuid null,
  template_version integer null,

  generation_parameters jsonb not null default '{}'::jsonb
);
```

#### Rationale

Generated reports should still be secured documents. A generated RCA report, case summary, or committee decision may contain PHI or peer-review protected information.

This table records provenance:

- which resource generated the report;
- who generated it;
- which template was used;
- which parameters were used.

---

## 31. Recommended Indexes

```sql
create index idx_app_resources_org
on app_resources (organization_id);

create index idx_app_resources_scope
on app_resources (organization_id, hospital_id, committee_id);

create index idx_documents_org
on documents (organization_id);

create index idx_documents_hospital
on documents (owning_hospital_id);

create index idx_documents_committee
on documents (owning_committee_id);

create index idx_documents_kind
on documents (kind_id);

create index idx_documents_confidentiality
on documents (confidentiality_label);

create index idx_documents_status
on documents (lifecycle_status);

create index idx_document_resource_links_resource
on document_resource_links (resource_id);

create index idx_document_resource_links_document
on document_resource_links (document_id);

create index idx_document_subjects_subject
on document_subjects (subject_resource_id);

create index idx_document_versions_document
on document_versions (document_id);

create index idx_document_version_assets_file
on document_version_assets (file_asset_id);

create index idx_file_assets_org
on file_assets (organization_id);

create index idx_file_assets_storage_path
on file_assets (storage_bucket, storage_object_path);

create index idx_document_access_grants_document
on document_access_grants (document_id);

create index idx_document_access_grants_principal
on document_access_grants (principal_type, principal_id);

create index idx_document_access_grants_expiry
on document_access_grants (expires_at)
where expires_at is not null;

create index idx_document_effective_permissions_user
on document_effective_permissions (user_id, permission);

create index idx_document_effective_permissions_document
on document_effective_permissions (document_id, user_id);

create index idx_document_audit_document_created
on document_access_audit_events (document_id, created_at desc);

create index idx_document_audit_actor_created
on document_access_audit_events (actor_user_id, created_at desc);

create index idx_security_group_members_user
on security_group_members (user_id);

create index idx_security_group_members_group
on security_group_members (group_id);
```

### Partitioning recommendation

Consider monthly partitioning for:

```text
document_access_audit_events
document_lifecycle_events
document_ingestion_jobs
```

Audit tables can grow rapidly in production.

---

## 32. RLS Strategy

### 32.1 General rule

RLS should be based on `document_effective_permissions`, not on complex joins to every domain table.

### 32.2 Helper function

Recommended helper function:

```sql
create or replace function current_user_profile_id()
returns uuid
language sql
stable
security definer
as $$
  select up.id
  from user_profiles up
  where up.auth_user_id = auth.uid()
  limit 1
$$;
```

Adjust this function if the project uses a different mapping between Supabase `auth.users` and `user_profiles`.

### 32.3 RLS for `documents`

```sql
alter table documents enable row level security;

create policy documents_select_permitted
on documents
for select
using (
  exists (
    select 1
    from document_effective_permissions dep
    where dep.document_id = documents.id
      and dep.user_id = current_user_profile_id()
      and dep.permission in ('view_metadata', 'view_sensitive_metadata', 'view_file', 'download')
  )
);
```

### 32.4 RLS for `document_sensitive_metadata`

```sql
alter table document_sensitive_metadata enable row level security;

create policy document_sensitive_metadata_select_permitted
on document_sensitive_metadata
for select
using (
  exists (
    select 1
    from document_effective_permissions dep
    where dep.document_id = document_sensitive_metadata.document_id
      and dep.user_id = current_user_profile_id()
      and dep.permission in ('view_sensitive_metadata', 'view_file', 'download')
  )
);
```

### 32.5 RLS for `document_versions`

```sql
alter table document_versions enable row level security;

create policy document_versions_select_permitted
on document_versions
for select
using (
  exists (
    select 1
    from document_effective_permissions dep
    where dep.document_id = document_versions.document_id
      and dep.user_id = current_user_profile_id()
      and dep.permission in ('view_file', 'download')
  )
);
```

### 32.6 RLS for `file_assets`

Direct `select` access to `file_assets` should be restricted. Prefer signed URLs generated by an Edge Function or backend API.

If direct database access is required:

```sql
alter table file_assets enable row level security;

create policy file_assets_select_permitted
on file_assets
for select
using (
  exists (
    select 1
    from document_version_assets dva
    join document_versions dv on dv.id = dva.document_version_id
    join document_effective_permissions dep on dep.document_id = dv.document_id
    where dva.file_asset_id = file_assets.id
      and dep.user_id = current_user_profile_id()
      and dep.permission in ('view_file', 'download')
  )
);
```

### 32.7 Important RLS warning

Do not allow broad client-side querying of:

- storage object paths;
- OCR text;
- sensitive metadata;
- audit logs;
- access grants;
- effective permissions for other users.

Access to these tables should be tightly limited.

---

## 33. Storage Strategy

### 33.1 Bucket policy

Use private buckets only.

Recommended bucket examples:

```text
documents-private
documents-staging
document-derived-assets
```

### 33.2 Object path format

Recommended object path:

```text
org/{organization_id}/documents/{document_id}/versions/{version_id}/original/{file_asset_id}.pdf
org/{organization_id}/documents/{document_id}/versions/{version_id}/normalized/{file_asset_id}.pdf
org/{organization_id}/documents/{document_id}/versions/{version_id}/pages/page-001.png
org/{organization_id}/documents/{document_id}/versions/{version_id}/redacted/{file_asset_id}.pdf
```

Do not place PHI or names in file paths.

Bad examples:

```text
patient_john_smith_discharge_summary.pdf
case_maria_silva_icu_record.pdf
complaint_against_dr_oliveira.pdf
```

### 33.3 Signed URL access flow

Recommended access flow:

```text
1. Client requests access to document file.
2. Backend/Edge Function receives document_id and desired asset_role.
3. Backend identifies current document version and file asset.
4. Backend checks document_effective_permissions.
5. Backend records document_access_audit_event.
6. Backend creates a short-lived signed URL.
7. Client receives signed URL.
```

This allows every file access to be audited.

---

## 34. Permission Resolution Algorithm

`document_effective_permissions` should be computed by a trusted backend service, database function, or scheduled job.

### 34.1 Input sources

Effective permissions come from:

1. Direct user grants.
2. Security group grants.
3. Committee grants.
4. Hospital grants.
5. Organization grants.
6. Inherited grants from linked resources if `access_inheritance_mode` allows it.
7. Default policies based on `document_kind` and confidentiality.
8. Temporary grants with `starts_at` and `expires_at`.
9. Break-glass grants, if implemented.

### 34.2 Output

The output is rows such as:

```text
document_id = D1
user_id = U1
permission = view_file
source_grant_ids = {G1, G2}
```

### 34.3 Expiration

Expired grants should be ignored.

A scheduled job should periodically remove or recompute expired effective permissions.

### 34.4 Suggested pseudo-code

```text
function recompute_document_permissions(document_id):
  delete document_effective_permissions where document_id = document_id

  grants = active document_access_grants for document

  for grant in grants:
    users = resolve_principal_to_users(grant.principal_type, grant.principal_id)

    for user in users:
      insert document_effective_permissions(document_id, user.id, grant.permission, source_grant_ids)
      on conflict merge source_grant_ids
```

### 34.5 Events that should trigger recomputation

Recompute when:

```text
document_access_grants insert/update/delete
security_group_members insert/update/delete
committee membership changes
hospital membership changes
case assignment changes
document_resource_links access_inheritance_mode changes
document confidentiality changes
document lifecycle status changes
```

---

## 35. Document Upload Workflow

### 35.1 Recommended workflow

```text
1. User starts upload session.
2. System creates document_upload_sessions row.
3. Client uploads file to staging private bucket.
4. Backend validates MIME type and size.
5. Virus scan job runs.
6. Hash is calculated.
7. documents row is created with lifecycle_status = processing.
8. document_versions row is created with version_status = processing.
9. file_assets row is created.
10. document_version_assets row links file to version.
11. Normalization job creates normalized PDF if needed.
12. Page rendering job creates previews/thumbnails.
13. OCR job runs if enabled.
14. PHI/confidentiality classification is reviewed or applied.
15. Default grants are created.
16. document_effective_permissions is computed.
17. document lifecycle_status becomes active.
18. document_versions version_status becomes available.
19. Audit events are recorded.
```

### 35.2 Why not activate immediately?

Do not make files broadly visible before:

- virus scanning;
- object path registration;
- classification;
- permission creation;
- audit logging setup.

This prevents accidental exposure of PHI-heavy uploads.

---

## 36. Integration With Forms

### 36.1 File upload questions

A form answer can reference uploaded documents like this:

```json
{
  "document_ids": [
    "8c8a4d7e-cbe2-46e6-8d4e-3f10f37e4b88"
  ]
}
```

However, the file itself should not be stored in the form answer table.

### 36.2 Recommended relationships

When a document is uploaded as part of a form answer, create:

```text
form_answers.value_jsonb.document_ids[]

document_resource_links:
  document -> form_submission
  document -> form_answer
  document -> case, if the form is case-related

form_document_details:
  form_submission_id
  question_block_id
  answer_id
```

### 36.3 Design rationale

This keeps the form subsystem simple while allowing the document subsystem to enforce:

- versioning;
- file storage;
- OCR;
- audit logging;
- PHI controls;
- document-level permissions.

---

## 37. Integration With Cases

### 37.1 Case-linked documents

A case should not own files directly.

Use:

```text
case
  -> app_resources
      -> document_resource_links
          -> documents
```

### 37.2 Case access versus document access

Case access and document access must remain separate.

Example:

```text
Committee member can view case summary.
Committee member cannot view original ICU medical record.
Committee member can view redacted version.
Assigned reviewer can view original ICU medical record.
Committee admin can manage access.
```

### 37.3 Design rationale

Different users viewing the same case may see different document lists.

The case page should query:

```text
documents linked to this case
where current user has document_effective_permissions
```

---

## 38. Integration With Ethics / Physician-Centered Cases

The document model should not assume every case is patient-centered.

For ethics workflows:

```text
document_resource_links:
  document -> ethics_case
  document -> complaint

document_subjects:
  document -> physician_under_review
  document -> complainant
  document -> patient_of_record, if applicable
```

This allows complaint documents to be centered around a physician while still supporting patient involvement when relevant.

Recommended default access:

```text
Ethics chair -> manage_access
Assigned ethics panel -> view_file
Hospital admins -> no automatic access unless policy says otherwise
Broader committee -> no automatic access
```

---

## 39. Integration With RCA and Quality Workflows

RCA evidence documents should be modeled as evidence documents linked to RCA resources.

Example:

```text
document_resource_links:
  document -> rca_event
  document -> patient_case, if applicable
  document -> action_item, if the document supports an action item

document_subjects:
  document -> patient_of_record
  document -> department_involved
```

Recommended default access:

```text
RCA team -> view_file
Quality department leads -> manage_access
Committee members -> redacted version only, if needed
```

---

## 40. Example Scenarios

### 40.1 M&M evidence document

```text
Document:
  kind = morbidity_mortality_evidence
  confidentiality_label = peer_review_confidential
  contains_phi = true
  requires_explicit_access = true

Links:
  document -> patient case
  document -> RCA event, if applicable

Subjects:
  patient_of_record

Grants:
  committee admins -> manage_access
  assigned case reviewers -> view_file
  invited consultant -> view_file, expires in 7 days
  broader committee -> no access or redacted version only
```

### 40.2 Form attachment

```text
Document:
  kind = form_attachment
  confidentiality_label = phi_standard
  contains_phi = true

Links:
  document -> form_submission
  document -> form_answer
  document -> case

Subjects:
  patient_of_record

Grants:
  submission owner -> view_file
  assigned reviewers -> view_file
  committee admins -> manage_access
```

### 40.3 Ethics complaint document

```text
Document:
  kind = complaint_document
  confidentiality_label = ethics_investigation
  contains_phi = maybe
  requires_explicit_access = true

Links:
  document -> ethics_case
  document -> complaint

Subjects:
  physician_under_review
  complainant, if known
  patient_of_record, if applicable

Grants:
  ethics chair -> manage_access
  assigned ethics panel -> view_file
  broader hospital admins -> no automatic access
```

### 40.4 Institutional policy document

```text
Document:
  kind = institutional_policy
  confidentiality_label = non_phi_internal
  contains_phi = false
  requires_explicit_access = false

Links:
  document -> hospital
  document -> committee

Grants:
  hospital members -> view_file
  committee admins -> manage_access
```

---

## 41. Recommended Default Access Policies by Document Kind

| Document kind | Recommended default access |
|---|---|
| `form_attachment` | Form submitter, assigned reviewers, committee admins |
| `generated_form_pdf` | Same as form submission |
| `morbidity_mortality_evidence` | Assigned case team, committee admins |
| `rca_evidence` | RCA team, quality department leads |
| `ethics_complaint_evidence` | Ethics chair, assigned ethics panel |
| `credentialing_document` | Credentialing committee authorized users only |
| `meeting_minutes` | Committee members after approval, admins before approval |
| `committee_report` | Committee admins and intended audience |
| `institutional_policy` | Hospital or organization members |
| `legal_document` | Explicit grants only |
| `external_medical_record` | Explicit grants or assigned case team only |

Important warning:

> Do not grant all committee members access to all case documents by default.

That is unsafe for PHI-heavy, legal, ethics, and peer-review protected documents.

---

## 42. Minimal Viable Implementation Plan

### Phase 1: Core secure document storage

Implement:

```text
app_resources
document_kinds
documents
document_versions
file_assets
document_version_assets
document_resource_links
document_access_grants
document_effective_permissions
document_access_audit_events
```

This supports:

- uploads;
- versioning;
- private files;
- links to cases/forms/resources;
- explicit access;
- audit logs.

### Phase 2: Scanned document processing

Add:

```text
document_pages
document_ocr_extractions
document_ingestion_jobs
document_upload_sessions
```

This supports:

- previews;
- OCR;
- page rendering;
- processing status;
- background jobs.

### Phase 3: Advanced compliance

Add:

```text
document_sensitive_metadata
document_redactions
document_retention_policies
document_lifecycle_events
document_access_requests
type-specific extension tables
```

This supports:

- redaction workflows;
- legal hold;
- retention;
- access request/approval;
- detailed metadata by document type.

---

## 43. Anti-Patterns to Avoid

### 43.1 File URLs in domain tables

Avoid:

```sql
cases.file_url
form_answers.file_url
meetings.file_url
```

This fragments security and audit logic.

### 43.2 One giant attachments table

Avoid:

```sql
attachments (
  id,
  case_id,
  form_id,
  meeting_id,
  patient_id,
  physician_id,
  file_url,
  type
)
```

This becomes difficult to secure and extend.

### 43.3 Assuming case access equals document access

This is unsafe.

A user may be allowed to view a case but not all documents linked to it.

### 43.4 Public buckets with obscure URLs

Do not rely on unguessable URLs for PHI or legal documents.

Use private storage, short-lived signed URLs, and audit logs.

### 43.5 Treating OCR as harmless

OCR text is highly sensitive. It is searchable PHI and should be protected like the original document.

### 43.6 Storing PHI in filenames or object paths

Avoid PHI in:

- original filenames displayed to unauthorized users;
- object storage paths;
- logs;
- analytics events;
- notification payloads.

---

## 44. Implementation Notes for an LLM / Developer Agent

When implementing this schema in an existing project, the LLM/developer should:

1. Map existing domain tables to `app_resources`.
2. Confirm actual names of user, organization, hospital, and committee tables.
3. Decide whether to use a dedicated schema or the public schema.
4. Implement tables in dependency order.
5. Add indexes after tables are created.
6. Add RLS only after helper functions are tested.
7. Keep storage buckets private.
8. Implement signed URL generation through backend/Edge Functions.
9. Create audit events from backend-controlled access paths.
10. Avoid exposing `file_assets.storage_object_path` directly to normal clients.
11. Implement permission recomputation as a trusted backend operation.
12. Add tests for each high-risk permission scenario.

### Suggested implementation order

```text
1. app_resources
2. document_retention_policies
3. document_kinds
4. documents
5. document_versions
6. current_version_id foreign key
7. file_assets
8. document_version_assets
9. document_pages
10. document_ocr_extractions
11. document_redactions
12. document_resource_links
13. document_subjects
14. security_groups
15. security_group_members
16. document_access_grants
17. document_effective_permissions
18. document_access_requests
19. document_upload_sessions
20. document_ingestion_jobs
21. document_access_audit_events
22. document_lifecycle_events
23. extension tables
24. indexes
25. RLS policies
26. storage access functions
```

---

## 45. Testing Checklist

The implementation should include tests for at least the following scenarios.

### 45.1 Basic access

- User with no grant cannot see document metadata.
- User with `view_metadata` can see safe metadata only.
- User with `view_sensitive_metadata` can see sensitive metadata.
- User with `view_file` can preview file.
- User with `download` can download file.

### 45.2 Case-linked document

- User can see case but not restricted document.
- Assigned reviewer can see restricted document.
- Committee admin can grant access.
- Access grant creates effective permission.
- Revoking access removes effective permission.

### 45.3 Redacted document

- User can view redacted version.
- User cannot view original version.
- Original and redacted versions have separate file assets.
- Audit logs distinguish which version was accessed.

### 45.4 Ethics complaint

- Broader hospital users cannot access complaint document.
- Ethics chair can manage access.
- Assigned ethics panel can view file.
- Physician-centered subject is represented without patient dependency.

### 45.5 Form upload

- Form answer references document ID.
- User cannot access document merely by guessing document ID.
- Form submission permissions do not leak restricted file unless policy explicitly grants access.

### 45.6 Expiring access

- Temporary grant works before expiration.
- Temporary grant stops working after expiration.
- Effective permissions are recomputed or expired correctly.

### 45.7 Audit

- File preview creates audit event.
- Download creates audit event.
- Denied access attempt creates audit event.
- Grant/revoke access creates audit event.

---

## 46. Final Recommendation

The uploaded document subsystem should be implemented as a dedicated secured module with its own data model, permission model, audit model, and storage lifecycle.

The key final architecture is:

```text
documents
  = logical secured document

document_versions
  = immutable document versions

file_assets
  = physical private storage objects

document_resource_links
  = links to cases/forms/meetings/RCA/complaints/etc.

document_subjects
  = patient/physician/complainant/witness/institution subjects

document_access_grants
  = explicit access rules

document_effective_permissions
  = RLS-friendly permission cache

document_access_audit_events
  = complete document access audit trail
```

This design allows the platform to support sensitive scanned documents across multiple hospital committee workflows without building separate document systems for each committee type.


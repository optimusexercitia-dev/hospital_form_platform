# Supabase Authorization Handoff  
## Organizations, Hospitals, Committees, Administrative Roles, Quality Oversight, and Row-Level Security

**Project:** Hospital committee management platform  
**Database:** Supabase PostgreSQL  
**Primary authorization mechanism:** PostgreSQL Row-Level Security (RLS)  
**Document status:** Architecture and implementation handoff  
**Audience:** Backend, database, application-security, and frontend developers  
**Last updated:** 2026-08-06

---

## 1. Purpose

This document defines the recommended authorization model for a multi-tenant hospital committee platform organized as:

```text
Platform
└── Organization
    └── Hospital
        └── Committee
            └── Cases, forms, interviews, meetings, documents, and actions
```

The model must support:

- Multi-hospital organizations.
- Single-hospital customers without duplicated administrative accounts.
- Users affiliated with one or more hospitals.
- Hospital administrators who can manage their hospital without affecting another hospital.
- Central organization administrators.
- Purchasers and billing contacts who may not need clinical access.
- Quality and patient-safety personnel who need hospital-wide or organization-wide oversight.
- Committee-specific membership and permissions.
- Strict protection of patient, employee, professional-conduct, peer-review, and committee information.
- Supabase clients accessing PostgreSQL directly through the Data API under RLS.
- Complete auditing of privileged changes.
- Temporary, exceptional, and “break-glass” access.
- Future enterprise SSO and identity provisioning.

This handoff deliberately separates the following concepts:

1. **Authentication identity**
2. **Organization affiliation**
3. **Hospital affiliation**
4. **Committee membership**
5. **Administrative authority**
6. **Clinical or case-data authority**
7. **Billing and commercial responsibility**
8. **Exceptional resource-specific access**

These concepts must not be collapsed into a single `users.role` column.

---

## 2. Core authorization principles

### 2.1 One identity, multiple scoped relationships

A human user should normally have one Supabase Auth identity, even when the user:

- Works in multiple hospitals.
- Participates in multiple committees.
- Has different responsibilities in different hospitals.
- Belongs to more than one customer organization.
- Is simultaneously an administrator and a quality reviewer.

Do not create duplicate user accounts per hospital.

### 2.2 Roles are assignments, not attributes of the user

The following design is prohibited:

```sql
-- Do not use this design.
alter table public.user_profiles
add column role text;
```

A single global role cannot express:

- Hospital A administrator.
- Hospital B committee member.
- Organization-wide billing administrator.
- Hospital C quality reviewer.
- No access to Hospital D.

Roles must be assigned to an active membership at a defined scope.

### 2.3 Scope does not imply inheritance

The hierarchy defines containment, not automatic privilege inheritance.

Examples:

- An organization billing administrator does not inherit hospital administration.
- A hospital administrator does not inherit case-reading permissions.
- A committee administrator does not become a hospital administrator.
- A quality manager does not gain permission to rewrite committee submissions.
- An organization administrator does not automatically gain access to all patient data.

Any cross-scope authority must be explicitly represented by permissions attached to the role.

### 2.4 Administrative access and clinical-data access are orthogonal

A user may be authorized to:

- Create a committee.
- Invite hospital staff.
- Assign committee members.
- Configure hospital settings.

without being authorized to:

- Open patient cases.
- Read committee deliberations.
- Download evidence.
- Read interview statements.
- View professional-conduct cases.

This separation is mandatory.

### 2.5 No destructive deletion of historical identities or memberships

A user who has authored or approved regulated records must retain stable historical attribution.

Use lifecycle states:

```text
invited → active → suspended → ended
```

Do not delete a user merely because the user leaves one hospital.

### 2.6 Deny by default

Every protected table must have RLS enabled. When no policy authorizes an operation, access must fail.

### 2.7 RLS is the final authorization boundary

Frontend route guards and server-side checks improve user experience but are not sufficient security controls.

Every request originating from an authenticated application user must be authorized by PostgreSQL RLS or a tightly controlled database function.

### 2.8 Service-role access is not normal application access

The Supabase `service_role` bypasses RLS and must never be exposed to a browser, mobile application, or ordinary user-facing server action.

Use it only for narrowly defined trusted jobs such as:

- Controlled invitation orchestration.
- Identity reconciliation.
- Background maintenance.
- Administrative migrations.
- System-to-system imports.

Whenever possible, user-initiated operations should execute with the user’s JWT so RLS remains active.

---

## 3. Authorization strategy

Use a hybrid model:

### 3.1 RBAC: role-based access control

Roles bundle atomic permissions.

Examples:

```text
hospital_admin
hospital_user_manager
hospital_quality_manager
committee_member
billing_admin
```

### 3.2 Scope-bound assignment

Each role assignment applies at exactly one scope:

```text
organization
hospital
committee
platform
```

Case-specific exceptions use explicit grants rather than general roles.

### 3.3 ABAC: attribute-based conditions

Additional access rules depend on resource attributes:

- Organization ownership.
- Hospital ownership.
- Committee ownership.
- Case domain.
- Confidentiality level.
- Oversight access policy.
- Membership status.
- Assignment validity dates.
- Explicit restrictions.
- User relationship to the case.
- Document classification.

### 3.4 Explicit grants and restrictions

Exceptional access is represented through:

- `case_access_grants`
- `case_access_grant_permissions`
- `case_access_restrictions`

A specific restriction overrides a general grant.

---

## 4. Recommended schemas

Use separate PostgreSQL schemas by responsibility.

```text
auth
    Supabase-managed authentication tables

public
    Application tables exposed through the Supabase Data API

security
    Non-exposed authorization helper functions and internal authorization views

audit
    Append-only audit tables and audit helper functions
```

Recommended Supabase configuration:

- Expose `public` through the Data API.
- Do not expose `security` or `audit` as API schemas.
- Grant only the minimum required schema usage and function execution.
- Fully qualify every object referenced from a `SECURITY DEFINER` function.
- Set `search_path = ''` on every security-definer function.

---

## 5. Principal entity model

```text
auth.users
└── public.user_profiles
    └── public.organization_memberships
        ├── public.organization_role_assignments
        └── public.hospital_memberships
            ├── public.hospital_role_assignments
            └── public.committee_memberships
                └── public.committee_role_assignments
```

Other supporting structures:

```text
public.role_definitions
public.permission_catalog
public.role_permissions
public.role_grant_rules

public.organization_contacts

public.case_access_grants
public.case_access_grant_permissions
public.case_access_restrictions

public.platform_role_assignments
public.break_glass_access_requests

audit.authorization_events
```

---

## 6. Enumerated types

These types are illustrative. If the project prefers lookup tables for extensibility, replace enums with constrained reference tables.

```sql
create type public.membership_status as enum (
  'invited',
  'active',
  'suspended',
  'ended'
);

create type public.role_scope as enum (
  'platform',
  'organization',
  'hospital',
  'committee'
);

create type public.case_domain as enum (
  'patient_safety',
  'morbidity_mortality',
  'infection_control',
  'medication_safety',
  'ethics',
  'professional_conduct',
  'credentialing',
  'peer_review',
  'hr',
  'legal',
  'other'
);

create type public.confidentiality_level as enum (
  'standard',
  'restricted',
  'highly_restricted'
);

create type public.oversight_access_policy as enum (
  'inherit_committee_default',
  'quality_analytics_only',
  'quality_summary_only',
  'quality_full',
  'explicit_grant_only'
);

create type public.contact_type as enum (
  'contract_owner',
  'billing',
  'privacy',
  'security',
  'technical',
  'clinical'
);

create type public.access_grant_status as enum (
  'pending',
  'active',
  'revoked',
  'expired'
);

create type public.break_glass_status as enum (
  'requested',
  'approved',
  'active',
  'expired',
  'revoked',
  'rejected'
);
```

### Important enum warning

PostgreSQL enum ordering is defined by creation order. Do not base security logic on enum comparison unless ordering is intentionally frozen.

Prefer explicit predicates:

```sql
case
  when confidentiality_level = 'standard' then ...
  when confidentiality_level = 'restricted' then ...
  when confidentiality_level = 'highly_restricted' then ...
end
```

---

## 7. Tenant and identity tables

### 7.1 User profiles

`auth.users` remains the authentication source of truth. Application-specific profile data belongs in `public.user_profiles`.

```sql
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  preferred_name text,
  professional_registration_type text,
  professional_registration_number text,
  professional_registration_region text,
  phone text,
  locale text not null default 'pt-BR',
  profile_status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Rules:

- `user_id` is globally unique.
- Do not store organization or hospital ownership on the profile.
- Professional identifiers may require encryption or restricted views.
- The profile must not contain a global application role.
- Ordinary users may update only approved self-service fields.
- Privileged professional data updates should use controlled RPCs or separate tables.

### 7.2 Organizations

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 7.3 Hospitals

```sql
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  legal_name text not null,
  display_name text not null,
  code text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index hospitals_organization_id_idx
  on public.hospitals (organization_id);
```

### 7.4 Organization contacts

Commercial and administrative contacts do not necessarily need platform accounts.

```sql
create table public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  contact_type public.contact_type not null,
  name text not null,
  email text not null,
  phone text,
  is_primary boolean not null default false,
  receives_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_contacts_org_idx
  on public.organization_contacts (organization_id);
```

Use this table for:

- Purchaser.
- Contract owner.
- Billing contact.
- Privacy officer.
- Security contact.
- Technical contact.
- Clinical sponsor.

A contact linked to a user account does not acquire permissions merely because `user_id` is populated.

---

## 8. Membership tables

### 8.1 Organization memberships

This table answers:

> Is this identity affiliated with this organization?

```sql
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  user_id uuid not null
    references auth.users(id) on delete restrict,
  status public.membership_status not null default 'invited',
  invited_email text,
  invited_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  ended_at timestamptz,
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_active_idx
  on public.organization_memberships (user_id, organization_id)
  where status = 'active';

create index organization_memberships_org_status_idx
  on public.organization_memberships (organization_id, status);
```

Rules:

- A user may have memberships in multiple organizations.
- Cross-organization memberships must never be disclosed to tenant administrators.
- Only organization-scoped administrators may suspend or end the complete organization membership.
- Hospital administrators must not update this row except through a tightly constrained invitation workflow.

### 8.2 Hospital memberships

This table answers:

> Does the user belong to this hospital, and what hospital-specific employment information applies?

```sql
create table public.hospital_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_membership_id uuid not null
    references public.organization_memberships(id) on delete restrict,
  hospital_id uuid not null
    references public.hospitals(id) on delete restrict,
  status public.membership_status not null default 'invited',
  employee_number text,
  department_id uuid,
  job_title text,
  starts_at date,
  ends_at date,
  activated_at timestamptz,
  suspended_at timestamptz,
  ended_at timestamptz,
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_membership_id, hospital_id)
);

create index hospital_memberships_hospital_status_idx
  on public.hospital_memberships (hospital_id, status);

create index hospital_memberships_org_membership_idx
  on public.hospital_memberships (organization_membership_id);
```

### 8.3 Enforce hospital/organization consistency

A normal foreign key cannot ensure that the hospital belongs to the same organization as the organization membership. Enforce it with a deferred constraint trigger.

```sql
create or replace function security.assert_hospital_membership_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_org_id uuid;
  hospital_org_id uuid;
begin
  select om.organization_id
    into membership_org_id
  from public.organization_memberships om
  where om.id = new.organization_membership_id;

  select h.organization_id
    into hospital_org_id
  from public.hospitals h
  where h.id = new.hospital_id;

  if membership_org_id is null
     or hospital_org_id is null
     or membership_org_id <> hospital_org_id then
    raise exception 'Hospital membership organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create constraint trigger hospital_membership_org_consistency
after insert or update of organization_membership_id, hospital_id
on public.hospital_memberships
deferrable initially immediate
for each row
execute function security.assert_hospital_membership_consistency();
```

### 8.4 Committees

```sql
create table public.committees (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null
    references public.hospitals(id) on delete restrict,
  name text not null,
  code text,
  default_case_domain public.case_domain not null,
  default_confidentiality public.confidentiality_level
    not null default 'standard',
  default_oversight_access public.oversight_access_policy
    not null default 'inherit_committee_default',
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, code)
);

create index committees_hospital_idx
  on public.committees (hospital_id);
```

### 8.5 Committee memberships

```sql
create table public.committee_memberships (
  id uuid primary key default gen_random_uuid(),
  hospital_membership_id uuid not null
    references public.hospital_memberships(id) on delete restrict,
  committee_id uuid not null
    references public.committees(id) on delete restrict,
  status public.membership_status not null default 'invited',
  starts_at timestamptz,
  ends_at timestamptz,
  suspended_at timestamptz,
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_membership_id, committee_id)
);

create index committee_memberships_committee_status_idx
  on public.committee_memberships (committee_id, status);

create index committee_memberships_hospital_membership_idx
  on public.committee_memberships (hospital_membership_id);
```

Use a constraint trigger equivalent to the hospital-membership check to ensure the committee and hospital membership belong to the same hospital.

---

## 9. Permission and role catalog

### 9.1 Permission catalog

Permissions should represent actions, not job titles.

```sql
create table public.permission_catalog (
  code text primary key,
  description text not null,
  risk_level smallint not null default 1
    check (risk_level between 1 and 5),
  is_clinical_data_permission boolean not null default false,
  is_privileged_permission boolean not null default false,
  created_at timestamptz not null default now()
);
```

Recommended permission codes:

```text
organization.read
organization.settings.update
organization.hospital.create
organization.hospital.archive
organization.membership.list
organization.membership.invite
organization.membership.suspend
organization.membership.end
organization.role.read
organization.role.assign
organization.role.revoke

billing.read
billing.manage

hospital.read
hospital.settings.update
hospital.membership.list
hospital.membership.lookup_exact
hospital.membership.invite
hospital.membership.suspend
hospital.membership.end
hospital.role.read
hospital.role.assign
hospital.role.revoke

committee.read
committee.create
committee.update
committee.archive
committee.membership.list
committee.membership.invite
committee.membership.suspend
committee.role.read
committee.role.assign
committee.role.revoke

quality.analytics.read
quality.analytics.export
case.list_metadata
case.read_summary
case.read_content
case.read_restricted
case.read_highly_restricted
case.create
case.update_draft
case.submit
case.triage
case.route
case.request_correction
case.add_oversight_note
case.manage_corrective_actions
case.approve_closure
case.reopen
case.export

document.read
document.download
document.upload
document.classify
document.manage_access

audit.read_administrative
audit.read_clinical

platform.customer_metadata.read
platform.customer_configuration.manage
platform.authorization_audit.read
platform.break_glass.request
platform.break_glass.approve
```

### 9.2 Role definitions

```sql
create table public.role_definitions (
  code text not null,
  scope public.role_scope not null,
  display_name text not null,
  description text not null,
  is_system_role boolean not null default true,
  is_assignable boolean not null default true,
  is_clinical_data_role boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (code, scope)
);
```

### 9.3 Role permissions

```sql
create table public.role_permissions (
  role_code text not null,
  role_scope public.role_scope not null,
  permission_code text not null
    references public.permission_catalog(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_code, role_scope, permission_code),
  foreign key (role_code, role_scope)
    references public.role_definitions(code, scope)
    on delete restrict
);

create index role_permissions_permission_idx
  on public.role_permissions (permission_code);
```

Role definitions and role-permission mappings should normally be migration-managed. Customer administrators must not edit them directly.

---

## 10. Recommended system roles

### 10.1 Organization roles

#### `organization_account_owner`

Purpose:

- Principal customer representative.
- Transfers ownership.
- Appoints top-level administrators.
- Sees subscription summary.

It does not automatically include clinical-case permissions.

#### `billing_admin`

Purpose:

- View invoices.
- Manage payment information.
- Manage billing contacts.
- View subscription and seat usage.

No clinical access.

#### `organization_access_admin`

Purpose:

- Invite organization users.
- Suspend or end organization memberships.
- Assign permitted organization and hospital roles.
- Resolve internal identity duplication workflows.

No clinical access by default.

#### `organization_structure_admin`

Purpose:

- Create and archive hospitals.
- Configure organization settings.
- Configure organization-wide defaults and identity-provider settings.

No clinical access by default.

#### `organization_quality_analytics_viewer`

Purpose:

- Read aggregate quality dashboards across permitted hospitals.
- No individual case access.

#### `organization_quality_case_reviewer`

Purpose:

- Read case metadata, summaries, and permitted case content across assigned domains and hospitals.
- Add review comments when permitted.
- Cannot rewrite committee records.

#### `organization_quality_manager`

Purpose:

- Organization-wide quality oversight.
- Triage, routing, corrective-action oversight, and closure approval where allowed.
- Cannot rewrite submitted source records.

#### `organization_auditor`

Purpose:

- Read administrative audit logs.
- Clinical audit access must be separately included.

### 10.2 Hospital roles

#### `hospital_admin`

Purpose:

- Manage hospital settings.
- Create and archive committees.
- Invite or suspend users in that hospital.
- Assign grantable hospital and committee roles.

No automatic case access.

#### `hospital_user_manager`

Purpose:

- Invite and maintain hospital users.
- Does not manage hospital settings or sensitive roles unless separately permitted.

#### `hospital_quality_analytics_viewer`

Purpose:

- Read aggregate hospital quality dashboards.
- No individual case access.

#### `hospital_quality_case_reviewer`

Purpose:

- Read permitted case summaries and content for configured domains.
- Usually read-only for submitted committee records.

#### `hospital_quality_manager`

Purpose:

- Triage cases.
- Route cases.
- Request correction.
- Create and manage corrective actions.
- Approve closure.
- Add oversight records.

#### `hospital_auditor`

Purpose:

- Read hospital administrative audit logs.
- Clinical audit visibility requires an additional permission.

### 10.3 Committee roles

Suggested roles:

```text
committee_admin
committee_coordinator
committee_member
committee_reviewer
committee_observer
```

The project’s existing committee-level model may be retained, provided it is implemented as scoped assignments.

### 10.4 Platform roles

Platform staff must not receive broad customer clinical access through ordinary support roles.

Suggested internal roles:

```text
platform_support_operator
platform_billing_operator
platform_security_auditor
platform_configuration_admin
platform_break_glass_approver
```

Normal platform support should be limited to:

- Customer metadata.
- Configuration.
- Authentication troubleshooting.
- Non-clinical logs.
- Sanitized diagnostics.

Access to clinical content must require a time-limited break-glass workflow.

---

## 11. Scoped role-assignment tables

Use separate tables per scope instead of a polymorphic `(scope_type, scope_id)` table. This preserves foreign-key integrity and simplifies RLS.

### 11.1 Organization role assignments

```sql
create table public.organization_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_membership_id uuid not null
    references public.organization_memberships(id) on delete restrict,
  role_code text not null,
  role_scope public.role_scope not null default 'organization'
    check (role_scope = 'organization'),
  allowed_case_domains public.case_domain[],
  allowed_hospital_ids uuid[],
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assignment_reason text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  foreign key (role_code, role_scope)
    references public.role_definitions(code, scope) on delete restrict,
  check (valid_until is null or valid_until > valid_from)
);

create index org_role_assignment_active_idx
  on public.organization_role_assignments (
    organization_membership_id,
    role_code
  )
  where revoked_at is null;
```

Interpretation:

- `allowed_case_domains IS NULL` means no additional domain restriction beyond the role and case policy.
- `allowed_hospital_ids IS NULL` means all hospitals within the organization permitted by the role.
- Empty arrays mean no domains or hospitals; the UI should not create such assignments.
- Array constraints are a pragmatic first implementation. A normalized assignment-scope table is preferable if assignments commonly cover hundreds of hospitals or domains.

### 11.2 Hospital role assignments

```sql
create table public.hospital_role_assignments (
  id uuid primary key default gen_random_uuid(),
  hospital_membership_id uuid not null
    references public.hospital_memberships(id) on delete restrict,
  role_code text not null,
  role_scope public.role_scope not null default 'hospital'
    check (role_scope = 'hospital'),
  allowed_case_domains public.case_domain[],
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assignment_reason text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  foreign key (role_code, role_scope)
    references public.role_definitions(code, scope) on delete restrict,
  check (valid_until is null or valid_until > valid_from)
);

create index hospital_role_assignment_active_idx
  on public.hospital_role_assignments (
    hospital_membership_id,
    role_code
  )
  where revoked_at is null;
```

### 11.3 Committee role assignments

```sql
create table public.committee_role_assignments (
  id uuid primary key default gen_random_uuid(),
  committee_membership_id uuid not null
    references public.committee_memberships(id) on delete restrict,
  role_code text not null,
  role_scope public.role_scope not null default 'committee'
    check (role_scope = 'committee'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assignment_reason text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  foreign key (role_code, role_scope)
    references public.role_definitions(code, scope) on delete restrict,
  check (valid_until is null or valid_until > valid_from)
);

create index committee_role_assignment_active_idx
  on public.committee_role_assignments (
    committee_membership_id,
    role_code
  )
  where revoked_at is null;
```

### 11.4 Platform role assignments

```sql
create table public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role_code text not null,
  role_scope public.role_scope not null default 'platform'
    check (role_scope = 'platform'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assignment_reason text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  foreign key (role_code, role_scope)
    references public.role_definitions(code, scope) on delete restrict,
  check (valid_until is null or valid_until > valid_from)
);
```

---

## 12. Role grant ceilings

Possession of an administrative role must not mean the user can assign every role.

```sql
create table public.role_grant_rules (
  grantor_role_code text not null,
  grantor_role_scope public.role_scope not null,
  grantable_role_code text not null,
  grantable_role_scope public.role_scope not null,
  requires_second_approval boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (
    grantor_role_code,
    grantor_role_scope,
    grantable_role_code,
    grantable_role_scope
  ),
  foreign key (grantor_role_code, grantor_role_scope)
    references public.role_definitions(code, scope) on delete restrict,
  foreign key (grantable_role_code, grantable_role_scope)
    references public.role_definitions(code, scope) on delete restrict
);
```

Example rules:

```text
hospital_admin
  may assign hospital_user_manager
  may assign committee_admin
  may assign committee_member
  may assign committee_observer
  must not assign organization_access_admin
  must not assign organization_quality_manager unless explicitly permitted

organization_access_admin
  may assign hospital_admin
  may assign hospital_user_manager
  may assign selected organization administrative roles
  must not automatically assign break-glass or platform roles
```

Additional mandatory constraints:

- A user cannot grant a role to themselves through an ordinary self-service operation.
- A user cannot assign a role outside the user’s authoritative scope.
- A hospital administrator cannot assign organization roles.
- A committee administrator cannot assign hospital roles.
- High-risk roles may require dual approval.
- Every grant and revocation requires a reason and audit event.
- Revocation should set `revoked_at`; do not delete the assignment.

Role assignment writes should occur through RPC functions rather than direct inserts.

---

## 13. Case authorization attributes

The existing `cases` table should expose, directly or through immutable relations, the attributes necessary for authorization.

Minimum required columns:

```sql
alter table public.cases
  add column if not exists organization_id uuid
    references public.organizations(id) on delete restrict,
  add column if not exists hospital_id uuid
    references public.hospitals(id) on delete restrict,
  add column if not exists committee_id uuid
    references public.committees(id) on delete restrict,
  add column if not exists case_domain public.case_domain,
  add column if not exists confidentiality_level
    public.confidentiality_level not null default 'standard',
  add column if not exists oversight_access_policy
    public.oversight_access_policy
    not null default 'inherit_committee_default';
```

The database must enforce:

```text
case.organization_id = hospital.organization_id
case.hospital_id = committee.hospital_id
```

Do not trust the client to submit consistent tenant columns.

Prefer a database trigger that derives `organization_id` and `hospital_id` from `committee_id` at case creation.

Example:

```sql
create or replace function security.set_case_scope_from_committee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_hospital_id uuid;
  resolved_organization_id uuid;
  resolved_domain public.case_domain;
  resolved_confidentiality public.confidentiality_level;
  resolved_oversight public.oversight_access_policy;
begin
  select
    c.hospital_id,
    h.organization_id,
    c.default_case_domain,
    c.default_confidentiality,
    c.default_oversight_access
  into
    resolved_hospital_id,
    resolved_organization_id,
    resolved_domain,
    resolved_confidentiality,
    resolved_oversight
  from public.committees c
  join public.hospitals h on h.id = c.hospital_id
  where c.id = new.committee_id;

  if resolved_hospital_id is null then
    raise exception 'Invalid committee';
  end if;

  new.hospital_id := resolved_hospital_id;
  new.organization_id := resolved_organization_id;
  new.case_domain := coalesce(new.case_domain, resolved_domain);
  new.confidentiality_level :=
    coalesce(new.confidentiality_level, resolved_confidentiality);
  new.oversight_access_policy :=
    coalesce(new.oversight_access_policy, resolved_oversight);

  return new;
end;
$$;
```

The trigger should reject attempts to lower confidentiality beneath the committee minimum unless a specifically authorized function performs the change.

---

## 14. Explicit case access

### 14.1 Case access grants

```sql
create table public.case_access_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete restrict,
  organization_membership_id uuid not null
    references public.organization_memberships(id) on delete restrict,
  status public.access_grant_status not null default 'active',
  reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);

create index case_access_grants_case_active_idx
  on public.case_access_grants (case_id, organization_membership_id)
  where revoked_at is null;
```

### 14.2 Grant permissions

```sql
create table public.case_access_grant_permissions (
  case_access_grant_id uuid not null
    references public.case_access_grants(id) on delete restrict,
  permission_code text not null
    references public.permission_catalog(code) on delete restrict,
  primary key (case_access_grant_id, permission_code)
);
```

Only case-relevant permissions should be assignable.

### 14.3 Case access restrictions

```sql
create table public.case_access_restrictions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete restrict,
  restricted_user_id uuid references auth.users(id) on delete restrict,
  restricted_role_code text,
  restricted_role_scope public.role_scope,
  permission_code text
    references public.permission_catalog(code) on delete restrict,
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  check (
    num_nonnulls(restricted_user_id, restricted_role_code) = 1
  ),
  check (
    (restricted_role_code is null and restricted_role_scope is null)
    or
    (restricted_role_code is not null and restricted_role_scope is not null)
  )
);

create index case_access_restrictions_case_active_idx
  on public.case_access_restrictions (case_id)
  where revoked_at is null;
```

Restriction precedence:

```text
explicit active restriction
    overrides
explicit grant
    overrides or supplements
role-derived access
```

Highly restricted cases should preferably use `explicit_grant_only`.

---

## 15. Quality and patient-safety access model

Do not use one broad `quality_user` role.

Use at least three layers.

### 15.1 Aggregate analytics

Permissions:

```text
quality.analytics.read
quality.analytics.export
```

These users access:

- Aggregated counts.
- Rates and indicators.
- Trends.
- De-identified or minimum-necessary summaries.

They do not automatically access underlying case rows.

Implement analytics through:

- Dedicated aggregate tables.
- Materialized views refreshed by trusted jobs.
- `security_invoker` views where appropriate.
- Controlled RPCs returning pre-aggregated results.

Do not make a dashboard secure merely by hiding identifiers in the frontend.

### 15.2 Case summary access

Permissions:

```text
case.list_metadata
case.read_summary
```

A summary may include:

- Case ID.
- Hospital.
- Committee.
- Event category.
- Severity.
- Workflow status.
- Dates.
- Responsible unit.
- High-level classification.

It should not automatically include:

- Patient identity.
- Interview statements.
- Uploaded evidence.
- Full committee deliberations.
- Professional-conduct details.

### 15.3 Full quality oversight

Permissions may include:

```text
case.read_content
case.triage
case.route
case.request_correction
case.add_oversight_note
case.manage_corrective_actions
case.approve_closure
```

Quality users should not directly edit:

- Submitted form answers.
- Signed conclusions.
- Interview statements.
- Historical decisions.
- Audit events.
- Original evidence.

Corrections must use amendments, revision requests, superseding versions, or append-only workflows.

### 15.4 Domain restrictions

A quality assignment may be constrained to:

```text
patient_safety
morbidity_mortality
infection_control
medication_safety
```

without granting access to:

```text
professional_conduct
credentialing
peer_review
hr
legal
```

The `allowed_case_domains` field on role assignments is part of the authorization decision.

### 15.5 Confidentiality policy

Recommended behavior:

| Case policy | Analytics | Summary | Full content |
|---|---:|---:|---:|
| `quality_analytics_only` | Allowed | Denied | Denied |
| `quality_summary_only` | Allowed | Allowed | Denied |
| `quality_full` | Allowed | Allowed | Allowed when permission/domain match |
| `explicit_grant_only` | Aggregate only if safely separated | Explicit grant | Explicit grant |
| `inherit_committee_default` | Use committee policy | Use committee policy | Use committee policy |

`restricted` and `highly_restricted` cases require corresponding permissions or explicit grants.

---

## 16. Single-hospital customers

The database hierarchy must remain:

```text
organization → hospital
```

even when an organization has only one hospital.

Do not build a separate single-hospital authorization model.

### 16.1 One person may hold all necessary administrative assignments

Example:

```text
User: Customer administrator

Organization roles:
- organization_account_owner
- organization_access_admin
- organization_structure_admin
- billing_admin

Hospital roles:
- hospital_admin
```

This is one user and one login.

### 16.2 Use role bundles only in the application layer

Expose a preset such as:

```text
Single-Site Customer Administrator
```

The preset creates multiple underlying role assignments.

Do not create a powerful monolithic database role called `single_site_super_admin`.

The UI may:

- Automatically select the only hospital.
- Hide hospital-switching controls.
- Present one “Users” screen.
- Present one “Customer administration” section.
- Route each operation to the correct organization or hospital RPC.

The database retains the full hierarchy and separation of duties.

---

## 17. User invitation and registration workflows

### 17.1 Hospital administrator adds a user already in the organization

The hospital administrator enters an exact email address.

The backend calls:

```text
resolve_hospital_invitee(hospital_id, email)
```

The function:

1. Confirms the caller can manage users in the target hospital.
2. Normalizes the email.
3. Searches only within the target hospital’s organization.
4. Returns the minimum information required to identify an exact match.
5. Does not return the user’s other hospital memberships.
6. Does not permit editing another hospital’s membership.
7. Creates or reactivates only the target hospital membership through a separate mutation.

A hospital administrator must not receive general read access to all organization users merely to prevent duplicate accounts.

### 17.2 Existing platform user in another organization

Do not reveal that the identity already exists elsewhere.

The invitation should appear as a normal invitation. Upon authenticated acceptance, the new organization membership is linked to the existing `auth.users` identity.

### 17.3 New platform user

Create:

```text
pending invitation
→ user signs in or creates account
→ organization membership activated
→ hospital membership activated
→ approved role assignments activated
```

Do not create privileged active memberships before invitation acceptance unless the workflow is explicitly designed and audited.

### 17.4 Remove user from a committee

Set committee membership to `suspended` or `ended`.

Do not affect hospital or organization membership.

### 17.5 Remove user from a hospital

Set hospital membership to `suspended` or `ended`.

Effective hospital and committee access ends because active hospital membership is a prerequisite.

Do not affect other hospitals.

### 17.6 Remove user from the organization

Only an organization access administrator or equivalent can suspend or end the organization membership.

This disables all subordinate hospital and committee access within that organization.

### 17.7 Delete identity

Physical deletion should be exceptional and limited to:

- Unaccepted erroneous invitations.
- Duplicate-account reconciliation.
- Legally approved identity lifecycle processes.
- Internal platform administration.

Authored regulated records must retain historical attribution, usually through an immutable user identifier and retained profile snapshot.

---

## 18. Effective permission rules

An assignment is active only when:

```text
assignment.revoked_at is null
AND assignment.valid_from <= now()
AND (assignment.valid_until is null OR assignment.valid_until > now())
```

A scope membership is active only when:

```text
organization_membership.status = active
AND applicable hospital_membership.status = active
AND applicable committee_membership.status = active
```

An effective case permission requires:

```text
authenticated user
AND active organization membership
AND active required subordinate membership
AND active role assignment or explicit grant
AND permission is present
AND domain constraint matches
AND hospital constraint matches
AND case oversight policy permits access
AND confidentiality requirements are satisfied
AND no explicit restriction denies access
```

---

## 19. Security helper functions

### 19.1 Design rules

Authorization helpers used by RLS should:

- Be placed in the non-exposed `security` schema.
- Use `SECURITY DEFINER` only when necessary.
- Use `STABLE` when the result is stable for a statement.
- Set `search_path = ''`.
- Fully qualify every table and function.
- Avoid dynamic SQL.
- Read `auth.uid()` internally.
- Return only boolean or limited identifiers.
- Be owned by a dedicated non-login database role.
- Have default privileges revoked.
- Be directly executable only by intended database roles.
- Be wrapped in `SELECT` inside policies when result does not vary by row.

### 19.2 Active organization membership

```sql
create or replace function security.has_active_organization_membership(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  );
$$;
```

### 19.3 Organization permission

```sql
create or replace function security.has_organization_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships om
    join public.organization_role_assignments ora
      on ora.organization_membership_id = om.id
    join public.role_permissions rp
      on rp.role_code = ora.role_code
     and rp.role_scope = ora.role_scope
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and ora.revoked_at is null
      and ora.valid_from <= now()
      and (ora.valid_until is null or ora.valid_until > now())
      and rp.permission_code = p_permission_code
  );
$$;
```

### 19.4 Hospital permission

An organization-scoped role may carry a hospital permission, but only when its hospital constraint allows the target hospital.

```sql
create or replace function security.has_hospital_permission(
  p_hospital_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target_hospital as (
    select h.id, h.organization_id
    from public.hospitals h
    where h.id = p_hospital_id
  )
  select
    exists (
      select 1
      from target_hospital th
      join public.organization_memberships om
        on om.organization_id = th.organization_id
      join public.organization_role_assignments ora
        on ora.organization_membership_id = om.id
      join public.role_permissions rp
        on rp.role_code = ora.role_code
       and rp.role_scope = ora.role_scope
      where om.user_id = (select auth.uid())
        and om.status = 'active'
        and ora.revoked_at is null
        and ora.valid_from <= now()
        and (ora.valid_until is null or ora.valid_until > now())
        and (
          ora.allowed_hospital_ids is null
          or p_hospital_id = any(ora.allowed_hospital_ids)
        )
        and rp.permission_code = p_permission_code
    )
    or
    exists (
      select 1
      from target_hospital th
      join public.organization_memberships om
        on om.organization_id = th.organization_id
      join public.hospital_memberships hm
        on hm.organization_membership_id = om.id
       and hm.hospital_id = th.id
      join public.hospital_role_assignments hra
        on hra.hospital_membership_id = hm.id
      join public.role_permissions rp
        on rp.role_code = hra.role_code
       and rp.role_scope = hra.role_scope
      where om.user_id = (select auth.uid())
        and om.status = 'active'
        and hm.status = 'active'
        and hra.revoked_at is null
        and hra.valid_from <= now()
        and (hra.valid_until is null or hra.valid_until > now())
        and rp.permission_code = p_permission_code
    );
$$;
```

### 19.5 Committee permission

```sql
create or replace function security.has_committee_permission(
  p_committee_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.committees c
      where c.id = p_committee_id
        and security.has_hospital_permission(
          c.hospital_id,
          p_permission_code
        )
    )
    or
    exists (
      select 1
      from public.committees c
      join public.hospital_memberships hm
        on hm.hospital_id = c.hospital_id
      join public.organization_memberships om
        on om.id = hm.organization_membership_id
      join public.committee_memberships cm
        on cm.hospital_membership_id = hm.id
       and cm.committee_id = c.id
      join public.committee_role_assignments cra
        on cra.committee_membership_id = cm.id
      join public.role_permissions rp
        on rp.role_code = cra.role_code
       and rp.role_scope = cra.role_scope
      where c.id = p_committee_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and hm.status = 'active'
        and cm.status = 'active'
        and cra.revoked_at is null
        and cra.valid_from <= now()
        and (cra.valid_until is null or cra.valid_until > now())
        and rp.permission_code = p_permission_code
    );
$$;
```

### 19.6 Domain-aware role access

Implement a separate helper for case-domain checks. Do not overload all general permission functions with case logic.

Conceptual signature:

```sql
security.has_case_role_permission(
  p_case_id uuid,
  p_permission_code text
) returns boolean
```

It must check:

- Active organization assignment and allowed hospital/domain constraints.
- Active hospital assignment and allowed domain constraints.
- Active committee assignment.
- Permission attached to assigned role.
- Case policy and confidentiality.

### 19.7 Explicit grant

```sql
create or replace function security.has_explicit_case_permission(
  p_case_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.case_access_grants cag
    join public.organization_memberships om
      on om.id = cag.organization_membership_id
    join public.case_access_grant_permissions cagp
      on cagp.case_access_grant_id = cag.id
    where cag.case_id = p_case_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and cag.status = 'active'
      and cag.revoked_at is null
      and cag.valid_from <= now()
      and (cag.valid_until is null or cag.valid_until > now())
      and cagp.permission_code = p_permission_code
  );
$$;
```

### 19.8 Explicit restriction

```sql
create or replace function security.has_case_restriction(
  p_case_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.case_access_restrictions car
    where car.case_id = p_case_id
      and car.revoked_at is null
      and (
        car.permission_code is null
        or car.permission_code = p_permission_code
      )
      and (
        car.restricted_user_id = (select auth.uid())
        or (
          car.restricted_role_code is not null
          and security.user_has_active_role_for_case(
            p_case_id,
            car.restricted_role_code,
            car.restricted_role_scope
          )
        )
      )
  );
$$;
```

`security.user_has_active_role_for_case` must be implemented without calling a function that recursively calls `has_case_restriction`.

### 19.9 Final case permission

```sql
create or replace function security.can_access_case(
  p_case_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and not security.has_case_restriction(
      p_case_id,
      p_permission_code
    )
    and (
      security.has_explicit_case_permission(
        p_case_id,
        p_permission_code
      )
      or security.has_case_role_permission(
        p_case_id,
        p_permission_code
      )
    );
$$;
```

The production implementation must ensure that `has_case_role_permission` applies the oversight and confidentiality rules described above.

---

## 20. RLS policy strategy

### 20.1 General setup

For every protected table:

```sql
alter table public.<table_name> enable row level security;
```

For high-risk tables, consider:

```sql
alter table public.<table_name> force row level security;
```

`FORCE ROW LEVEL SECURITY` affects the table owner’s normal bypass behavior but does not replace proper ownership and service-role controls. Test migrations, triggers, and maintenance jobs before enabling it broadly.

### 20.2 Always target database roles

Prefer:

```sql
to authenticated
```

rather than `to public`.

### 20.3 Explicitly reject unauthenticated access

Use:

```sql
(select auth.uid()) is not null
```

when appropriate. `auth.uid()` returns `null` without an authenticated session.

### 20.4 Separate operation policies

Create distinct policies for:

```text
SELECT
INSERT
UPDATE
DELETE
```

Do not use one broad `FOR ALL` policy for sensitive tables unless the semantics are truly identical.

### 20.5 Use both `USING` and `WITH CHECK`

- `USING` determines which existing rows can be targeted.
- `WITH CHECK` determines which new row state is acceptable.

An update policy must prevent a user from moving a row into another tenant by changing tenant identifiers.

### 20.6 Remember UPDATE also requires SELECT visibility

A user must generally have a matching `SELECT` policy for rows that the user needs to update.

---

## 21. Example RLS policies

The following policies demonstrate the intended pattern. They are not a substitute for project-specific integration tests.

### 21.1 User profiles

Users may read their own profile.

```sql
alter table public.user_profiles enable row level security;

create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);
```

Users may update only their own row, but this row-level policy does not provide column-level protection.

```sql
create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
);
```

Do not grant direct update privileges on sensitive credential columns. Use:

- Column-level grants.
- A limited profile view.
- A controlled RPC.
- Separate professional-credential tables with stricter RLS.

### 21.2 Organizations

An active organization member may read limited organization data.

```sql
alter table public.organizations enable row level security;

create policy organizations_select_active_member
on public.organizations
for select
to authenticated
using (
  (select security.has_active_organization_membership(id))
);
```

Only an organization settings administrator may update.

```sql
create policy organizations_update_authorized
on public.organizations
for update
to authenticated
using (
  (select security.has_organization_permission(
    id,
    'organization.settings.update'
  ))
)
with check (
  (select security.has_organization_permission(
    id,
    'organization.settings.update'
  ))
);
```

Use a trigger to prevent ordinary updates of immutable columns such as `id` and tenant ownership.

### 21.3 Hospitals

Users may read hospitals with which they have an active relationship, or hospitals covered by organization-level authority.

```sql
alter table public.hospitals enable row level security;

create policy hospitals_select_authorized
on public.hospitals
for select
to authenticated
using (
  (select security.has_hospital_permission(id, 'hospital.read'))
);
```

Updates:

```sql
create policy hospitals_update_authorized
on public.hospitals
for update
to authenticated
using (
  (select security.has_hospital_permission(
    id,
    'hospital.settings.update'
  ))
)
with check (
  organization_id = (
    select h.organization_id
    from public.hospitals h
    where h.id = hospitals.id
  )
  and
  (select security.has_hospital_permission(
    id,
    'hospital.settings.update'
  ))
);
```

For critical updates, prefer an RPC that accepts only editable fields.

### 21.4 Organization memberships

A user may read their own membership.

```sql
alter table public.organization_memberships enable row level security;

create policy organization_memberships_select_own
on public.organization_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
);
```

Organization administrators may list organization memberships.

```sql
create policy organization_memberships_select_admin
on public.organization_memberships
for select
to authenticated
using (
  (select security.has_organization_permission(
    organization_id,
    'organization.membership.list'
  ))
);
```

Do not allow direct update of membership status. Use RPCs such as:

```text
invite_organization_member
suspend_organization_member
end_organization_member
reactivate_organization_member
```

This prevents unauthorized status transitions and ensures audit creation.

### 21.5 Hospital memberships

A user may read their own hospital membership.

```sql
alter table public.hospital_memberships enable row level security;

create policy hospital_memberships_select_own
on public.hospital_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships om
    where om.id = hospital_memberships.organization_membership_id
      and om.user_id = (select auth.uid())
  )
);
```

A hospital administrator may list only memberships in that hospital.

```sql
create policy hospital_memberships_select_admin
on public.hospital_memberships
for select
to authenticated
using (
  (select security.has_hospital_permission(
    hospital_id,
    'hospital.membership.list'
  ))
);
```

No policy allows a Hospital A administrator to update a Hospital B membership.

Mutations occur through controlled RPCs.

### 21.6 Committees

```sql
alter table public.committees enable row level security;

create policy committees_select_authorized
on public.committees
for select
to authenticated
using (
  (select security.has_committee_permission(
    id,
    'committee.read'
  ))
);

create policy committees_insert_authorized
on public.committees
for insert
to authenticated
with check (
  (select security.has_hospital_permission(
    hospital_id,
    'committee.create'
  ))
);

create policy committees_update_authorized
on public.committees
for update
to authenticated
using (
  (select security.has_committee_permission(
    id,
    'committee.update'
  ))
)
with check (
  (select security.has_hospital_permission(
    hospital_id,
    'committee.update'
  ))
);
```

Archival should be an RPC or constrained status transition, not physical deletion.

### 21.7 Cases

Read summary and full content should preferably use different database projections.

Full case table:

```sql
alter table public.cases enable row level security;

create policy cases_select_content
on public.cases
for select
to authenticated
using (
  (select security.can_access_case(
    id,
    'case.read_content'
  ))
);
```

If users with summary-only permissions must access the same table, RLS alone cannot hide sensitive columns. Use a safe summary view:

```sql
create view public.case_summaries
with (security_invoker = true)
as
select
  id,
  organization_id,
  hospital_id,
  committee_id,
  case_domain,
  confidentiality_level,
  status,
  created_at,
  updated_at
from public.cases;
```

The underlying `cases` RLS must permit summary access, or the summary should be returned by a controlled function. A safer pattern is to maintain a dedicated `case_summary_records` table or an RPC that returns only approved summary fields.

Do not expose PHI columns through a view merely because the frontend does not render them.

Case creation:

```sql
create policy cases_insert_authorized
on public.cases
for insert
to authenticated
with check (
  (select security.has_committee_permission(
    committee_id,
    'case.create'
  ))
);
```

A trigger must derive tenant scope and reject client-controlled tenant substitution.

Draft updates:

```sql
create policy cases_update_draft_authorized
on public.cases
for update
to authenticated
using (
  status = 'draft'
  and (select security.can_access_case(
    id,
    'case.update_draft'
  ))
)
with check (
  status = 'draft'
  and (select security.can_access_case(
    id,
    'case.update_draft'
  ))
);
```

Submitted-case workflow changes should use RPCs. Do not grant broad direct `UPDATE` access to submitted case rows.

### 21.8 Role assignments

Direct `INSERT`, `UPDATE`, or `DELETE` access should normally be revoked from `authenticated`.

Use RPCs:

```text
assign_organization_role
revoke_organization_role
assign_hospital_role
revoke_hospital_role
assign_committee_role
revoke_committee_role
```

RLS may permit read access for:

- The person who owns the assignment.
- Administrators who can read roles at that scope.
- Auditors.

Example read policy:

```sql
alter table public.hospital_role_assignments enable row level security;

create policy hospital_role_assignments_select_own_or_admin
on public.hospital_role_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.hospital_memberships hm
    join public.organization_memberships om
      on om.id = hm.organization_membership_id
    where hm.id = hospital_role_assignments.hospital_membership_id
      and (
        om.user_id = (select auth.uid())
        or
        (select security.has_hospital_permission(
          hm.hospital_id,
          'hospital.role.read'
        ))
      )
  )
);
```

---

## 22. Controlled mutation RPCs

High-risk writes should occur through database functions instead of direct table DML.

Recommended RPCs:

```text
resolve_hospital_invitee
invite_hospital_member
activate_hospital_membership
suspend_hospital_membership
end_hospital_membership
reactivate_hospital_membership

assign_organization_role
revoke_organization_role
assign_hospital_role
revoke_hospital_role
assign_committee_role
revoke_committee_role

grant_case_access
revoke_case_access
restrict_case_access
remove_case_access_restriction

request_break_glass_access
approve_break_glass_access
revoke_break_glass_access
```

Each function should:

1. Obtain the caller from `auth.uid()`.
2. Verify the caller’s active membership.
3. Verify the required permission.
4. Verify scope containment.
5. Verify the role grant ceiling.
6. Reject self-escalation.
7. Validate status transition.
8. Insert or update the target record.
9. Insert an audit event in the same transaction.
10. Return a minimal result.
11. Use an empty `search_path`.
12. Avoid returning sensitive cross-scope data.

### 22.1 Exact-match invitee lookup

The lookup should return a narrow result type:

```text
match_status:
- existing_in_organization
- no_organization_match
- existing_in_target_hospital

display_name
masked_or_exact_email according to policy
organization_membership_id only when caller may use it
hospital_membership_status for target hospital only
```

It must not return:

- Other organizations.
- Other hospital memberships.
- Other role assignments.
- Clinical participation.
- Account security metadata.

---

## 23. Role assignment RPC validation

Conceptual algorithm for `assign_hospital_role`:

```text
INPUT:
  target_hospital_membership_id
  role_code
  allowed_case_domains
  valid_until
  reason

1. Resolve target hospital and organization.
2. Confirm caller is authenticated.
3. Confirm caller has hospital.role.assign for target hospital.
4. Confirm target role has scope = hospital.
5. Confirm at least one active caller role is allowed to grant target role.
6. Confirm caller is not assigning a prohibited role to self.
7. Confirm target organization and hospital memberships are active or in an allowed invitation state.
8. Validate domain constraints.
9. Validate validity period.
10. Insert assignment.
11. Insert authorization audit event.
12. Return assignment ID.
```

A hospital administrator must never be able to alter the organization membership or another hospital membership through this RPC.

---

## 24. Billing model

Billing permissions must remain independent of hospital and case permissions.

A purchaser may be represented only in `organization_contacts`.

A billing user may have:

```text
billing.read
billing.manage
```

without:

```text
hospital.read
case.read_summary
case.read_content
```

Billing data should use separate RLS helpers and tables.

Do not place billing columns on clinical membership tables.

---

## 25. Platform support and break-glass access

### 25.1 Never use routine service-role impersonation

Platform employees should not inspect tenant data by running the application with a service-role token.

### 25.2 Break-glass request table

```sql
create table public.break_glass_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null
    references auth.users(id) on delete restrict,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  hospital_id uuid references public.hospitals(id) on delete restrict,
  case_id uuid references public.cases(id) on delete restrict,
  requested_permissions text[] not null,
  reason text not null,
  status public.break_glass_status not null default 'requested',
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  valid_until timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text
);
```

Requirements:

- Narrowest possible scope.
- Time-limited.
- Purpose recorded.
- Prefer customer approval for clinical access.
- Separate approver where feasible.
- Prominent audit events.
- Optional notification to customer security/privacy contacts.
- No bulk export unless explicitly approved.
- Automatic expiration.

Break-glass authorization should be checked explicitly by the case-access helper and never treated as a permanent platform role.

---

## 26. Auditing

### 26.1 Authorization audit events

```sql
create table audit.authorization_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_session_id text,
  organization_id uuid,
  hospital_id uuid,
  committee_id uuid,
  target_user_id uuid,
  target_membership_id uuid,
  target_role_code text,
  action text not null,
  reason text,
  request_id text,
  source_ip inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb
);
```

Audited actions must include:

- Invitations.
- Membership activation.
- Suspension and ending.
- Role assignment and revocation.
- Case grants and restrictions.
- Break-glass requests and approvals.
- Changes to role definitions.
- Changes to role permissions.
- Changes to grant rules.
- Confidentiality-policy changes.
- Organization and hospital archival.
- Identity reconciliation.

### 26.2 Append-only behavior

Application roles must not have `UPDATE` or `DELETE` privileges on audit tables.

Prefer insertion through a trusted audit function.

### 26.3 Audit actor context

The database should record:

- Authenticated user ID.
- Effective authorization path where feasible.
- Request ID.
- Application version.
- Before and after values.
- Reason supplied by administrator.
- Scope.

Do not rely solely on application logs.

---

## 27. Column-level and field-level security

RLS controls rows, not columns.

A user authorized to select a row can select every column for which the database role has column privileges.

For different levels of case visibility, use one or more of:

1. Separate normalized tables for sensitive data.
2. Dedicated summary tables.
3. `security_invoker` views with limited columns.
4. Controlled RPCs returning typed records.
5. Column-level `GRANT SELECT`.
6. Encryption for selected fields.
7. Separate document-access policies.

Recommended separation:

```text
cases
    non-sensitive workflow and classification metadata

case_subjects
    patient/professional identity and sensitive identifiers

case_clinical_details
    detailed clinical information

case_deliberations
    committee notes and decisions

case_summary_records
    approved minimum-necessary summary
```

Each table receives its own RLS policy.

Do not return a complete case row to a summary-only user and trust the frontend to hide sensitive fields.

---

## 28. Views

PostgreSQL views may bypass underlying RLS depending on ownership and configuration.

For PostgreSQL 15 or newer, use:

```sql
create view public.some_safe_view
with (security_invoker = true)
as
select ...;
```

Rules:

- Confirm the project’s PostgreSQL version.
- Use `security_invoker = true` for views intended to obey caller permissions.
- Revoke access to unsafe views.
- Do not expose internal authorization views.
- Add RLS tests specifically for every exposed view.
- Treat materialized views as separate tables requiring their own protection.

---

## 29. JWT claims

JWT custom claims may be useful for:

- UI hints.
- Fast routing.
- Non-sensitive feature flags.
- Coarse platform-level context.

They should not be the sole source of truth for mutable, high-risk authorization because:

- Tokens remain valid until refreshed or expired.
- Role revocation is not immediately reflected.
- Hospital suspension may not immediately invalidate the token.
- Case confidentiality may change after token issuance.
- A user may have many scoped roles that do not fit cleanly in a token.

Never store authorization data in `raw_user_meta_data`, because users can modify user metadata.

If claims are used, populate them from trusted application metadata or an access-token hook, and still validate sensitive operations against database state.

---

## 30. Indexing for RLS performance

Index every column frequently used in policy predicates and helper-function joins.

At minimum:

```text
organization_memberships(user_id, organization_id, status)
hospital_memberships(organization_membership_id, hospital_id, status)
committee_memberships(hospital_membership_id, committee_id, status)

organization_role_assignments(organization_membership_id)
hospital_role_assignments(hospital_membership_id)
committee_role_assignments(committee_membership_id)

role_permissions(role_code, role_scope, permission_code)

cases(organization_id)
cases(hospital_id)
cases(committee_id)
cases(case_domain)
cases(confidentiality_level)

case_access_grants(case_id, organization_membership_id)
case_access_restrictions(case_id, restricted_user_id)
```

Use partial indexes for active assignments and active memberships.

Wrap stable helper functions in a scalar `SELECT` inside policies:

```sql
using (
  (select security.has_hospital_permission(
    hospital_id,
    'hospital.read'
  ))
);
```

This can allow PostgreSQL to evaluate a stable result once per statement when it does not depend on row-varying input. A helper that accepts the current row’s `hospital_id` still varies by row; optimize by filtering on accessible scope IDs when necessary.

For high-volume tables, consider functions returning authorized scope IDs:

```text
security.current_user_hospital_ids()
security.current_user_committee_ids()
```

Then use:

```sql
hospital_id = any(
  (select security.current_user_hospital_ids())
)
```

Benchmark with realistic tenant sizes. Do not assume a logically correct RLS policy will scale.

---

## 31. Avoiding RLS recursion

Membership tables need RLS, but helper functions also query membership tables. Direct subqueries from one policy into another protected table can create recursion or unexpected filtering.

Recommended approach:

- Security-definer helper functions query authorization tables.
- Function owner has the necessary table privileges.
- Function returns only the minimum authorization result.
- Function `search_path` is empty.
- Authorization tables remain inaccessible for direct mutation.
- Policies call schema-qualified helpers.
- Tests validate that the helper cannot be abused as a general data-exfiltration RPC.

---

## 32. Ownership and grants

Create a dedicated non-login role:

```sql
create role app_authorization_owner nologin;
```

Use it to own:

- `security` functions.
- Internal authorization views.
- Selected audit functions.

Example hardening:

```sql
revoke all on schema security from public;
revoke all on all functions in schema security from public;

grant usage on schema security to authenticated;

-- Grant only exact functions needed by policies.
grant execute on function
  security.has_hospital_permission(uuid, text)
to authenticated;
```

Do not grant broad:

```sql
grant execute on all functions in schema security to authenticated;
```

Set secure default privileges for future functions.

---

## 33. Role presets versus database roles

The frontend may expose friendly presets:

```text
Single-Site Customer Administrator
Hospital Administrator
Quality and Patient Safety Manager
Quality Analytics Viewer
Committee Coordinator
```

A preset maps to one or more role assignments.

Example:

```text
Single-Site Customer Administrator
→ organization_account_owner
→ organization_access_admin
→ organization_structure_admin
→ billing_admin
→ hospital_admin at default hospital
```

Do not use presets as authorization primitives.

The database evaluates the underlying role assignments and permissions.

---

## 34. Recommended default matrix

| Role | Scope | Manage users | Manage structure | Case metadata | Case content | Quality workflow | Billing |
|---|---|---:|---:|---:|---:|---:|---:|
| Organization account owner | Organization | Appoint top admins | Limited | No | No | No | Summary |
| Billing administrator | Organization | No | No | No | No | No | Full |
| Organization access admin | Organization | Organization-wide | No | No | No | No | No |
| Organization structure admin | Organization | Limited | Hospitals/global settings | No | No | No | No |
| Organization quality analytics viewer | Organization | No | No | Aggregate | No | No | No |
| Organization quality reviewer | Organization | No | No | Allowed domains | Allowed domains/policy | Comments/review | No |
| Organization quality manager | Organization | No | No | Allowed domains | Allowed domains/policy | Triage/route/closure | No |
| Hospital administrator | Hospital | Hospital only | Hospital/committees | No | No | No | No |
| Hospital user manager | Hospital | Hospital only | No | No | No | No | No |
| Hospital quality analytics viewer | Hospital | No | No | Aggregate | No | No | No |
| Hospital quality reviewer | Hospital | No | No | Allowed domains | Allowed domains/policy | Comments/review | No |
| Hospital quality manager | Hospital | No | No | Allowed domains | Allowed domains/policy | Triage/route/closure | No |
| Committee administrator | Committee | Committee only | Committee config | Committee cases | According to committee role | Committee workflow | No |
| Auditor | Assigned scope | No | No | As explicitly granted | As explicitly granted | No writes | No |

---

## 35. Administrative UX workflows

### 35.1 Hospital user screen

Hospital administrators see:

- Users affiliated with the current hospital.
- Pending invitations for the current hospital.
- Committee memberships within the current hospital.
- Hospital-scoped roles they are permitted to read.
- Actions they are permitted to perform.

They do not see:

- Other hospital memberships.
- Other hospitals’ employment data.
- Organization-wide roles unless necessary and authorized.
- Other organizations.
- Cases solely because they are an administrator.

### 35.2 Organization user screen

Organization access administrators may see:

- Organization memberships.
- Hospital affiliations within the organization.
- Organization-level status.
- Organization and permitted hospital roles.

This is the level that resolves cross-hospital staff administration.

### 35.3 Quality dashboard

Quality analytics users see aggregates.

Quality case reviewers see a case list limited by:

- Scope.
- Case domain.
- Oversight policy.
- Confidentiality.
- Explicit restriction.

The application must request only the projection appropriate to the user’s permission.

### 35.4 Single-site customer

The UI may combine organization and hospital administration while backend calls remain scope-correct.

---

## 36. Status transitions

Use explicit transition rules.

### 36.1 Organization membership

```text
invited → active
invited → ended
active → suspended
suspended → active
active → ended
suspended → ended
```

Generally prohibit:

```text
ended → active
```

without a controlled re-onboarding process.

### 36.2 Hospital and committee memberships

Equivalent lifecycle, but subordinate membership cannot be effectively active while the parent membership is inactive.

The database may store an active child assignment, but authorization helpers must require every parent membership to be active.

### 36.3 Role assignments

Assignments are immutable historical records except for:

- Revocation metadata.
- Expiration.
- Administrative annotation where legally permitted.

Changing the role should create a new assignment and revoke the old one.

---

## 37. Multi-hospital administration edge cases

### Case A: User belongs to Hospitals A and B

Hospital A administrator may:

- Read Hospital A membership.
- Update allowed Hospital A staff fields.
- Suspend Hospital A membership.
- Assign permitted Hospital A and committee roles.

Hospital A administrator may not:

- Read Hospital B employment fields.
- Suspend Hospital B membership.
- Revoke Hospital B roles.
- Suspend the organization membership.
- Delete the global identity.

### Case B: Hospital A suspends user

Result:

```text
Hospital A effective access: denied
Hospital A committee access: denied
Hospital B effective access: unchanged
Organization membership: unchanged
```

### Case C: Organization suspends user

Result:

```text
All organization hospitals: denied
All organization committees: denied
Other organizations: unchanged
```

### Case D: Quality manager is assigned only to Hospitals A and C

The organization role assignment contains:

```text
allowed_hospital_ids = [A, C]
```

Hospital B cases remain inaccessible.

### Case E: Quality manager has patient-safety domains only

The role assignment contains:

```text
allowed_case_domains = [
  patient_safety,
  morbidity_mortality,
  infection_control,
  medication_safety
]
```

Professional-conduct and legal cases remain inaccessible.

---

## 38. Data isolation invariants

These invariants should be enforced by constraints, triggers, and tests.

1. Every hospital belongs to exactly one organization.
2. Every hospital membership belongs to an organization membership in the same organization.
3. Every committee belongs to exactly one hospital.
4. Every committee membership belongs to a hospital membership in the same hospital.
5. Every case organization/hospital/committee scope is consistent.
6. A hospital administrator cannot mutate organization membership.
7. A hospital administrator cannot mutate another hospital membership.
8. Committee administrators cannot mutate hospital or organization assignments.
9. Administrative roles do not grant clinical read permission unless role permissions explicitly include it.
10. Inactive parent membership makes all descendant access ineffective.
11. Explicit case restrictions override role and explicit grant access.
12. Role assignments cannot be physically deleted through application APIs.
13. No application user can directly edit role definitions or role-permission mappings.
14. No user can self-escalate privileges.
15. Every privileged mutation creates an audit event.
16. Summary-only access never returns sensitive full-case columns.

---

## 39. Testing strategy

RLS testing must verify both positive and negative access.

### 39.1 Minimum test personas

Create fixtures for:

```text
anonymous user
unaffiliated authenticated user
organization account owner
billing administrator
organization access administrator
organization quality manager
Hospital A administrator
Hospital B administrator
Hospital A quality reviewer
Hospital A committee administrator
Hospital A committee member
Hospital B committee member
suspended organization member
suspended hospital member
expired role assignment
explicit case grantee
explicitly restricted user
platform support operator
break-glass operator
```

### 39.2 Required cross-scope tests

Examples:

- Hospital A admin can list Hospital A memberships.
- Hospital A admin cannot list Hospital B memberships.
- Hospital A admin cannot suspend organization membership.
- Suspending Hospital A membership does not affect Hospital B.
- Billing admin cannot read any case.
- Hospital admin cannot read cases without a clinical role.
- Quality analytics viewer cannot query full case rows.
- Quality reviewer can read permitted domains only.
- Quality reviewer cannot read `explicit_grant_only` case without a grant.
- Explicit restriction denies an otherwise authorized quality manager.
- Expired assignment confers no permission.
- Revoked assignment confers no permission.
- Committee role does not apply to another committee.
- A user cannot insert a membership pointing to another organization’s hospital.
- A user cannot change `hospital_id` to move a row between tenants.
- A summary view does not expose sensitive columns.
- Direct writes to role assignment tables fail.
- Authorized role-assignment RPC succeeds and audits.
- Unauthorized role-assignment RPC fails and does not partially write.
- Break-glass access expires automatically.

### 39.3 Test through real access paths

Do not test only helper functions as the database owner.

Test:

- Supabase Data API as `anon`.
- Supabase Data API as `authenticated`.
- RPC execution with user JWTs.
- Direct SQL under equivalent database roles.
- Exposed views.
- Storage access if documents use Supabase Storage.
- Realtime subscriptions if enabled.
- Background jobs and service-role operations separately.

### 39.4 pgTAP

Use pgTAP or an equivalent SQL test framework to assert:

- Policy existence.
- Table RLS enablement.
- Expected row counts per persona.
- Forbidden DML.
- Security-function ownership and `search_path`.
- Grant boundaries.
- Audit insertion.

A green application test suite is not proof that authorization paths are exercised. Every permission must have at least one allow test and one deny test.

---

## 40. Migration order

Recommended implementation sequence:

1. Create `security` and `audit` schemas.
2. Create enums or lookup tables.
3. Create organizations, hospitals, profiles, and contacts.
4. Create membership tables.
5. Add consistency triggers.
6. Create permission and role catalogs.
7. Seed system permissions.
8. Seed role definitions.
9. Seed role-permission mappings.
10. Seed role-grant rules.
11. Create role-assignment tables.
12. Add case authorization columns and scope triggers.
13. Create explicit case grants and restrictions.
14. Create audit tables.
15. Create security-definer helper functions.
16. Lock function ownership and privileges.
17. Create controlled mutation RPCs.
18. Enable RLS.
19. Add read policies.
20. Add constrained write policies.
21. Revoke direct DML where RPC-only writes are required.
22. Add indexes for policy paths.
23. Add fixtures and pgTAP tests.
24. Validate through Supabase local development and Data API.
25. Migrate existing users and memberships.
26. Enable stricter policies in production only after negative-access tests pass.
27. Consider `FORCE ROW LEVEL SECURITY` for highest-risk tables after operational validation.

---

## 41. Existing-data migration

If the existing project has one role column or direct user-to-hospital columns:

### 41.1 Create memberships first

For each existing user:

1. Ensure one `auth.users` identity.
2. Create `user_profiles`.
3. Create organization memberships.
4. Create hospital memberships.
5. Create committee memberships.

### 41.2 Convert existing roles

Map legacy roles to scoped assignments.

Example:

```text
legacy organization_admin
→ organization_access_admin
→ organization_structure_admin

legacy hospital_admin
→ hospital_admin for each legacy hospital assignment

legacy quality_user
→ do not convert automatically without deciding:
   analytics viewer,
   case reviewer,
   or quality manager
```

### 41.3 Avoid silently broadening clinical access

A legacy `admin` role may currently see all cases. Do not preserve that behavior automatically.

Perform an explicit review of:

- Which users truly need case access.
- Which domains they need.
- Which hospitals they cover.
- Whether full content or summary access is required.

### 41.4 Parallel authorization period

During migration:

- Compute legacy and new authorization in parallel.
- Log disagreements.
- Do not use “allow if either model allows” in production, because that preserves excessive legacy access.
- Use shadow evaluation to identify differences before cutover.

---

## 42. Operational recommendations

### 42.1 Require reasons for privileged actions

Mandatory reason fields for:

- Suspension.
- Membership termination.
- Role grant.
- Role revocation.
- Case access grant.
- Case restriction.
- Break-glass access.

### 42.2 Time-limit exceptional access

Temporary reviewers and support access should have `valid_until`.

### 42.3 Periodic access review

Provide reports for:

- Users with organization-wide roles.
- Users with quality-full access.
- Users with access to highly restricted domains.
- Expiring and expired assignments.
- Dormant users.
- Duplicate hospital memberships.
- Break-glass events.
- Users with conflicting administrative and auditing duties.

### 42.4 Separation of duties

For larger customers, support:

- Organization account owner separate from access administrator.
- Hospital administrator separate from quality manager.
- Auditor read-only.
- Break-glass requester separate from approver.
- High-risk role assignment requiring approval.

For small customers, allow one user to hold multiple assignments while preserving separate audit semantics.

### 42.5 Emergency lockout

An organization-level suspension must immediately make subordinate permissions ineffective without waiting for individual role revocation.

Use database-state checks rather than relying only on JWT refresh.

---

## 43. Decisions deliberately rejected

### 43.1 One global role per user

Rejected because it cannot represent multi-hospital and multi-function users.

### 43.2 Hospital administrator can manage every user in organization

Rejected because it creates cross-hospital authority and accidental staff removal risk.

### 43.3 Hospital administrator deletes user

Rejected because user identity and historical authorship are global, while hospital affiliation is scoped.

### 43.4 Every quality user reads every case

Rejected because quality responsibilities vary by hospital, domain, confidentiality, and function.

### 43.5 Organization administrator automatically reads clinical data

Rejected because commercial and administrative authority does not establish minimum-necessary clinical access.

### 43.6 Separate authorization architecture for single-site customers

Rejected because it creates divergent code paths, migration risk, and future scaling problems.

### 43.7 JWT-only role storage

Rejected for sensitive mutable authorization because token state may become stale.

### 43.8 Frontend-only field hiding

Rejected because it does not protect data returned by the database.

### 43.9 Direct DML for privileged lifecycle operations

Rejected because complex validation and auditing are more reliable through controlled transactional RPCs.

---

## 44. Final recommended hierarchy

```text
Global identity
└── Organization membership
    ├── Organization administrative assignments
    ├── Organization quality/audit assignments
    └── Hospital membership
        ├── Hospital administrative assignments
        ├── Hospital quality/audit assignments
        └── Committee membership
            └── Committee assignments
```

Case-specific exceptions:

```text
Case
├── explicit access grants
└── explicit restrictions
```

Commercial contacts:

```text
Organization
└── organization contacts
    └── optional link to user identity
```

The governing authorization rule is:

> A user may manage only the scope covered by an active administrative assignment, and may read or modify clinical information only when a separate active data permission, case policy, confidentiality rule, and resource relationship authorize the operation.

---

## 45. Implementation checklist

### Schema

- [ ] No global `user.role` column.
- [ ] Separate organization, hospital, and committee memberships.
- [ ] Separate role assignment tables per scope.
- [ ] Permission catalog and role-permission mappings.
- [ ] Grant-ceiling rules.
- [ ] Case domain, confidentiality, and oversight-policy attributes.
- [ ] Explicit grants and restrictions.
- [ ] Organization contacts separate from user permissions.
- [ ] Audit schema and append-only authorization events.
- [ ] Break-glass model for platform support.

### RLS

- [ ] RLS enabled on every exposed protected table.
- [ ] Policies target `authenticated`.
- [ ] Explicit SELECT, INSERT, UPDATE, and DELETE policies.
- [ ] `USING` and `WITH CHECK` correctly applied.
- [ ] Tenant identifiers cannot be changed by clients.
- [ ] No cross-hospital membership mutation.
- [ ] No administrative role implicitly grants case access.
- [ ] Summary-only users cannot select sensitive columns.
- [ ] Views tested for RLS behavior.
- [ ] Storage policies aligned with case/document permissions.

### Functions

- [ ] Security functions in non-exposed schema.
- [ ] `SECURITY DEFINER` used only where required.
- [ ] `search_path = ''`.
- [ ] Fully qualified object names.
- [ ] Exact function execution grants.
- [ ] No dynamic SQL.
- [ ] No self-escalation.
- [ ] Scope containment validated.
- [ ] Audit writes in same transaction.

### Testing

- [ ] Positive and negative tests per permission.
- [ ] Cross-hospital tests.
- [ ] Cross-organization tests.
- [ ] Suspended and expired membership tests.
- [ ] Explicit deny precedence tests.
- [ ] RPC tests through authenticated JWTs.
- [ ] Exposed-view tests.
- [ ] Service-role usage separately reviewed.
- [ ] RLS query plans benchmarked at realistic scale.

---

## 46. Reference notes for developers

The implementation should be checked against current official Supabase and PostgreSQL documentation before production deployment, particularly for:

- Supabase Row-Level Security behavior.
- `auth.uid()` and `auth.jwt()`.
- Security-definer functions.
- View security and `security_invoker`.
- Custom access-token claims.
- RLS query performance.
- PostgreSQL row-security changes and security advisories.
- Supabase Storage RLS, if documents are stored in Storage.

This handoff provides the architecture and representative SQL. It is not a complete drop-in migration because the final SQL must be reconciled with the project’s existing case, committee, document, audit, and user-profile schemas.

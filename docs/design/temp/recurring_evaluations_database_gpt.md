# Recurring Hospital Evaluations and Surveillance

## Database Architecture and Implementation Handoff

**Target platform:** Multi-tenant hospital committee and quality-management platform  
**Primary database:** PostgreSQL / Supabase  
**Document purpose:** Engineering handoff for adding sequential patient surveillance, bed-based audits, recurring rounds, answer carry-forward, and escalation into the existing committee platform  
**Status:** Proposed architecture  
**Date:** 2026-07-27

---

## 1. Executive summary

The existing platform can support recurring hospital evaluations, but this functionality should not be implemented as repeated forms attached to a long-lived `Case`.

The recommended design introduces an **evaluation and surveillance domain** alongside the existing **case and committee domain**:

```text
Case domain
    Investigations, deliberation, referrals, decisions, resolution

Evaluation domain
    Recurring rounds, surveillance, adherence audits, longitudinal monitoring
```

The two domains should share the existing:

- form definitions, versions, instances, sections, questions, and answers;
- users, institutional membership, roles, grants, and row-level security;
- committees;
- documents;
- audit infrastructure;
- findings, risks, issues, and action items;
- escalation pathways into a formal `Case`.

The evaluation domain adds:

1. a durable hospital location and bed registry;
2. patient encounters and time-bounded bed assignments;
3. recurring evaluation programs and concrete execution cycles;
4. frozen occupancy snapshots;
5. typed evaluation targets;
6. evaluation records backed by the existing form engine;
7. safe longitudinal continuity rules;
8. question-level carry-forward policies and answer provenance;
9. explicit observation dispositions and denominator eligibility;
10. specialized patient-list and bed-matrix interfaces;
11. structured findings and controlled escalation.

The design is suitable for infection control, device surveillance, pressure-injury rounds, nursing bundle audits, antimicrobial stewardship, environmental rounds, and other repeatable hospital workflows.

---

## 2. Architectural decision: do not model daily evaluations as cases

A `Case` ordinarily follows an investigative lifecycle:

```text
open → under_review → discussed → resolved → closed
```

A recurring evaluation follows an operational lifecycle:

```text
scheduled → generated → open → in_progress → completed
```

A patient may remain under daily surveillance until discharge, transfer, death, or loss of eligibility. A bed audit may assess dozens of beds each day indefinitely. Neither is a case-resolution lifecycle.

Using `Case` for both purposes would cause:

- excessive case creation;
- ambiguous status semantics;
- poor completion and compliance analytics;
- permissions that are unnecessarily tied to case participation;
- large, malformed cases containing unrelated bed observations;
- difficult reporting and indexes;
- confusion between routine noncompliance and formal investigation.

Instead, a routine observation should be able to escalate:

```text
Evaluation answer
    → Evaluation finding
        → Issue or risk
        → Action item
        → Optional formal Case
```

A failed checkbox should not automatically become a case. Case creation is an escalation decision based on severity, recurrence, institutional rules, and required investigation.

---

## 3. Bounded contexts and ownership

### 3.1 Existing form engine responsibilities

The form engine remains authoritative for:

- form definitions and immutable published versions;
- sections, questions, options, and repeating groups;
- answer types and validation;
- conditional visibility and requirement rules;
- form instances;
- answer storage and answer revision history.

### 3.2 New evaluation domain responsibilities

The evaluation domain is authoritative for:

- recurrence and scheduling;
- program scope;
- cycle creation;
- form-version resolution per cycle;
- occupancy capture;
- target generation;
- patient, encounter, bed, unit, and department context;
- longitudinal linkage;
- carry-forward initialization;
- evaluator assignment;
- target disposition;
- completion and compliance metrics;
- findings and escalation.

### 3.3 Integration boundary

An `evaluation_record` owns the operational assessment lifecycle and references one concrete `form_instance`. The form instance owns the answers. Evaluation tables must not create an alternative answer-storage mechanism.

---

## 4. Core entity relationship

```text
Organization
└── Hospital
    ├── Department
    │   └── Unit
    │       ├── Room
    │       │   └── Bed
    │       └── Bed
    ├── Patient encounter
    │   ├── Bed assignment
    │   └── Patient device (later phase)
    └── Evaluation program
        ├── Program scope
        ├── Program schedule
        ├── Program view
        └── Evaluation cycle
            ├── Bed occupancy snapshot
            └── Evaluation target
                └── Evaluation record
                    ├── Form instance
                    │   ├── Initialization record
                    │   └── Form answers
                    ├── Observation context
                    └── Evaluation finding
                        ├── Action item
                        ├── Issue or risk
                        └── Case
```

---

## 5. Conventions and cross-cutting requirements

The SQL in this document is illustrative PostgreSQL. It should be aligned with the project’s naming, identity, timestamp, soft-retirement, and audit conventions.

### 5.1 Identifiers and timestamps

- Use UUID primary keys.
- Store operational timestamps as `timestamptz`.
- Store the hospital’s IANA timezone, such as `America/Sao_Paulo`.
- Treat a local evaluation date as a derived or explicitly assigned business date; do not infer it later using the database server timezone.

### 5.2 Multi-tenant integrity

Every tenant-sensitive root record should carry sufficient organization and hospital context for efficient RLS. Foreign keys alone do not guarantee that referenced rows belong to the same tenant.

Use one of the following:

- composite foreign keys that include `hospital_id` or `organization_id`;
- deferred constraint triggers that verify tenant consistency;
- security-definer creation functions that validate all references;
- preferably, a combination of composite keys for critical relationships and trusted functions for complex generation.

Never accept arbitrary hospital IDs from the client without verifying membership and relationship consistency.

### 5.3 Historical data

Operational resources and completed clinical records must not be hard-deleted. Retire locations and void records with reasoned, audited state transitions.

### 5.4 Controlled vocabulary

The sample schema uses text plus `CHECK` constraints. Project-wide lookup tables or PostgreSQL enums may be used if the platform already has a disciplined vocabulary strategy.

Use enums only for stable, deployment-controlled values. Use lookup/configuration tables when institutions may add values.

---

## 6. Hospital location and bed registry

### 6.1 `hospital_departments`

```sql
create table hospital_departments (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid not null references hospitals(id),
    code text,
    name text not null,
    department_type text,
    status text not null default 'active',
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_id, code),
    check (status in ('active', 'inactive')),
    check (active_until is null or active_until > active_from)
);
```

### 6.2 `hospital_units`

```sql
create table hospital_units (
    id uuid primary key default gen_random_uuid(),
    hospital_department_id uuid not null
        references hospital_departments(id),
    code text,
    name text not null,
    unit_type text,
    status text not null default 'active',
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_department_id, code),
    check (status in ('active', 'inactive')),
    check (active_until is null or active_until > active_from)
);
```

### 6.3 `hospital_rooms`

```sql
create table hospital_rooms (
    id uuid primary key default gen_random_uuid(),
    hospital_unit_id uuid not null references hospital_units(id),
    code text not null,
    name text,
    room_type text,
    status text not null default 'active',
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_unit_id, code),
    check (status in ('active', 'inactive')),
    check (active_until is null or active_until > active_from)
);
```

### 6.4 `hospital_beds`

```sql
create table hospital_beds (
    id uuid primary key default gen_random_uuid(),
    hospital_unit_id uuid not null references hospital_units(id),
    hospital_room_id uuid references hospital_rooms(id),
    code text not null,
    display_name text not null,
    bed_type text,
    sort_order integer not null default 0,
    operational_status text not null default 'active',
    active_from timestamptz not null default now(),
    active_until timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_unit_id, code),
    check (operational_status in (
        'active',
        'temporarily_unavailable',
        'maintenance',
        'inactive'
    )),
    check (active_until is null or active_until > active_from)
);
```

### 6.5 Rationale

A bed is an operational resource, not a patient attribute. The same bed is occupied by different patients over time and may be renamed, moved, blocked, or retired.

Beds must therefore have stable identities and effective dates. Historical records continue referencing the bed ID while storing a label snapshot for what the evaluator saw at the time.

If rooms are optional in an institution, `hospital_room_id` remains nullable. The unit remains the required operational parent.

If beds can truly move between units and the project must preserve every historical placement, replace the direct `hospital_unit_id` relationship with a time-bounded `bed_location_assignments` table. Do not silently update a bed’s unit and destroy location history.

---

## 7. Patient encounters and occupancy

### 7.1 `patient_encounters`

```sql
create table patient_encounters (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid not null references hospitals(id),
    patient_id uuid not null references patients(id),
    external_encounter_id text,
    encounter_type text not null,
    status text not null,
    admitted_at timestamptz not null,
    discharged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique nulls not distinct (hospital_id, external_encounter_id),
    check (discharged_at is null or discharged_at > admitted_at)
);
```

If multiple null external IDs are valid, replace `unique nulls not distinct` with a partial unique index:

```sql
create unique index patient_encounters_external_id_uq
    on patient_encounters (hospital_id, external_encounter_id)
    where external_encounter_id is not null;
```

### 7.2 `bed_assignments`

```sql
create table bed_assignments (
    id uuid primary key default gen_random_uuid(),
    patient_encounter_id uuid not null
        references patient_encounters(id),
    hospital_bed_id uuid not null
        references hospital_beds(id),
    assigned_at timestamptz not null,
    released_at timestamptz,
    assignment_source text not null,
    external_assignment_id text,
    created_at timestamptz not null default now(),
    check (released_at is null or released_at > assigned_at)
);

create index bed_assignments_by_encounter
    on bed_assignments (patient_encounter_id, assigned_at desc);

create index bed_assignments_by_bed_time
    on bed_assignments (hospital_bed_id, assigned_at, released_at);
```

Where data quality permits, prevent overlapping occupancy with a GiST exclusion constraint:

```sql
create extension if not exists btree_gist;

alter table bed_assignments
add constraint bed_assignments_no_bed_overlap
exclude using gist (
    hospital_bed_id with =,
    tstzrange(
        assigned_at,
        coalesce(released_at, 'infinity'::timestamptz),
        '[)'
    ) with &&
);
```

Consider a second constraint preventing one encounter from being assigned to multiple beds simultaneously. Real ADT feeds may contain transient overlaps; validate integration behavior before enforcing either exclusion constraint in production.

### 7.3 Rationale

Longitudinal clinical surveillance should usually target a patient **encounter**, not the person alone. Patient-only continuity risks copying clinical information from an old hospitalization into a new admission.

Time-bounded assignments preserve patient movement and allow the platform to reconstruct location at a specific instant.

---

## 8. Evaluation programs

### 8.1 `evaluation_programs`

```sql
create table evaluation_programs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id),
    hospital_id uuid not null references hospitals(id),
    owner_committee_id uuid references committees(id),
    name text not null,
    description text,
    program_type text not null,
    target_strategy text not null,
    status text not null default 'draft',
    default_form_definition_id uuid not null
        references form_definitions(id),
    timezone text not null,
    allows_manual_cycles boolean not null default true,
    allows_ad_hoc_targets boolean not null default false,
    allows_target_refresh boolean not null default false,
    allows_carry_forward boolean not null default false,
    created_by_user_id uuid not null references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (program_type in (
        'clinical_surveillance',
        'infection_prevention',
        'adherence_audit',
        'environmental_round',
        'quality_round',
        'custom'
    )),
    check (target_strategy in (
        'patient',
        'patient_encounter',
        'bed',
        'unit',
        'department',
        'mixed'
    )),
    check (status in ('draft', 'active', 'paused', 'retired'))
);
```

### 8.2 `evaluation_program_scopes`

```sql
create table evaluation_program_scopes (
    id uuid primary key default gen_random_uuid(),
    evaluation_program_id uuid not null
        references evaluation_programs(id),
    hospital_department_id uuid references hospital_departments(id),
    hospital_unit_id uuid references hospital_units(id),
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    check (
        num_nonnulls(hospital_department_id, hospital_unit_id) = 1
    ),
    check (active_until is null or active_until > active_from)
);
```

Use partial unique indexes to prevent duplicate active scopes:

```sql
create unique index evaluation_scope_active_department_uq
    on evaluation_program_scopes (
        evaluation_program_id,
        hospital_department_id
    )
    where hospital_department_id is not null
      and active_until is null;

create unique index evaluation_scope_active_unit_uq
    on evaluation_program_scopes (
        evaluation_program_id,
        hospital_unit_id
    )
    where hospital_unit_id is not null
      and active_until is null;
```

### 8.3 `evaluation_program_schedules`

Do not rely exclusively on a JSON schedule embedded in the program if multiple daily schedules, effective dates, or exceptions are expected.

```sql
create table evaluation_program_schedules (
    id uuid primary key default gen_random_uuid(),
    evaluation_program_id uuid not null
        references evaluation_programs(id),
    recurrence_rule text not null,
    local_start_time time,
    timezone text not null,
    active_from date not null,
    active_until date,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    check (status in ('active', 'paused', 'retired')),
    check (active_until is null or active_until >= active_from)
);
```

`recurrence_rule` may use an RFC 5545 RRULE. Scheduling exceptions can be added through a separate `evaluation_schedule_exceptions` table.

### 8.4 Rationale

The program is a reusable definition of **what**, **where**, **how**, and **under whose governance** evaluations occur. It is not one execution.

`target_strategy` belongs to the program rather than the form because a form describes questions, not the real-world entity being assessed.

Program scopes are time-bounded so an audit can expand or contract without rewriting historical cycles.

---

## 9. Evaluation cycles

### 9.1 `evaluation_cycles`

```sql
create table evaluation_cycles (
    id uuid primary key default gen_random_uuid(),
    evaluation_program_id uuid not null
        references evaluation_programs(id),
    hospital_id uuid not null references hospitals(id),
    scheduled_for_date date not null,
    occurrence_key text not null default 'default',
    scheduled_start_at timestamptz,
    scheduled_end_at timestamptz,
    resolved_form_version_id uuid not null
        references form_versions(id),
    status text not null default 'planned',
    generation_status text not null default 'pending',
    generation_error jsonb,
    generated_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    canceled_at timestamptz,
    created_by_user_id uuid references users(id),
    completed_by_user_id uuid references users(id),
    canceled_by_user_id uuid references users(id),
    cancellation_reason text,
    notes text,
    row_version bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (
        evaluation_program_id,
        scheduled_for_date,
        occurrence_key
    ),
    check (status in (
        'planned',
        'open',
        'in_progress',
        'completed',
        'canceled'
    )),
    check (generation_status in (
        'pending',
        'generating',
        'generated',
        'failed'
    )),
    check (
        scheduled_end_at is null
        or scheduled_start_at is null
        or scheduled_end_at > scheduled_start_at
    )
);
```

### 9.2 State transition invariants

Enforce transitions in a service or stored procedure, not through arbitrary client updates:

- only an active program can create a new scheduled cycle;
- the resolved form version must be published and belong to the program’s default form definition;
- target generation must be idempotent;
- a cycle cannot open until generation succeeds;
- a completed cycle cannot accept ordinary edits;
- cancellation requires actor, timestamp, and reason;
- reopening should create an audit event and require a privileged capability.

### 9.3 Rationale

A cycle is a frozen execution context, not merely a date. It resolves the exact form version, scope, occupancy snapshot, targets, and scheduled occurrence. `occurrence_key` supports morning/evening or multiple same-day rounds without ambiguous timestamp uniqueness.

---

## 10. Occupancy snapshots

### 10.1 `evaluation_cycle_bed_snapshots`

```sql
create table evaluation_cycle_bed_snapshots (
    id uuid primary key default gen_random_uuid(),
    evaluation_cycle_id uuid not null
        references evaluation_cycles(id),
    hospital_bed_id uuid not null
        references hospital_beds(id),
    patient_encounter_id uuid
        references patient_encounters(id),
    bed_assignment_id uuid
        references bed_assignments(id),
    occupancy_status text not null,
    source_type text not null,
    source_reference text,
    captured_at timestamptz not null,
    bed_code_snapshot text not null,
    bed_display_name_snapshot text not null,
    room_name_snapshot text,
    unit_name_snapshot text not null,
    department_name_snapshot text,
    patient_identifier_snapshot jsonb,
    created_at timestamptz not null default now(),
    unique (evaluation_cycle_id, hospital_bed_id),
    check (occupancy_status in (
        'occupied',
        'vacant',
        'blocked',
        'unavailable',
        'unknown'
    )),
    check (
        (occupancy_status = 'occupied' and patient_encounter_id is not null)
        or occupancy_status <> 'occupied'
    )
);
```

### 10.2 Rationale

Real-time occupancy is mutable. If the cycle is generated at 07:00 and a patient transfers at 09:00, the historical evaluation must not move retroactively.

Foreign keys preserve identity while snapshot labels preserve what users saw before names changed. Patient-identifying snapshots must be minimal, encrypted where required, and protected by PHI-specific access rules.

The snapshot answers: “Who was assigned to this bed when the cycle was generated?” It does not necessarily represent the observation-time context.

---

## 11. Typed evaluation targets

### 11.1 `evaluation_targets`

```sql
create table evaluation_targets (
    id uuid primary key default gen_random_uuid(),
    evaluation_cycle_id uuid not null
        references evaluation_cycles(id),
    target_type text not null,
    patient_id uuid references patients(id),
    patient_encounter_id uuid references patient_encounters(id),
    hospital_bed_id uuid references hospital_beds(id),
    hospital_unit_id uuid references hospital_units(id),
    hospital_department_id uuid references hospital_departments(id),
    patient_device_id uuid,
    cycle_bed_snapshot_id uuid
        references evaluation_cycle_bed_snapshots(id),
    continuity_key text not null,
    status text not null default 'pending',
    exclusion_reason_code text,
    exclusion_note text,
    sort_order integer not null default 0,
    generated_automatically boolean not null default true,
    generated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (target_type in (
        'patient',
        'patient_encounter',
        'bed',
        'unit',
        'department',
        'patient_device'
    )),
    check (status in (
        'pending',
        'in_progress',
        'completed',
        'excluded',
        'not_applicable',
        'skipped'
    )),
    check (
        (target_type = 'patient'
            and patient_id is not null
            and num_nonnulls(
                patient_encounter_id, hospital_bed_id,
                hospital_unit_id, hospital_department_id,
                patient_device_id
            ) = 0)
        or
        (target_type = 'patient_encounter'
            and patient_encounter_id is not null
            and num_nonnulls(
                patient_id, hospital_bed_id,
                hospital_unit_id, hospital_department_id,
                patient_device_id
            ) = 0)
        or
        (target_type = 'bed'
            and hospital_bed_id is not null
            and num_nonnulls(
                patient_id, patient_encounter_id,
                hospital_unit_id, hospital_department_id,
                patient_device_id
            ) = 0)
        or
        (target_type = 'unit'
            and hospital_unit_id is not null
            and num_nonnulls(
                patient_id, patient_encounter_id,
                hospital_bed_id, hospital_department_id,
                patient_device_id
            ) = 0)
        or
        (target_type = 'department'
            and hospital_department_id is not null
            and num_nonnulls(
                patient_id, patient_encounter_id,
                hospital_bed_id, hospital_unit_id,
                patient_device_id
            ) = 0)
        or
        (target_type = 'patient_device'
            and patient_device_id is not null
            and num_nonnulls(
                patient_id, patient_encounter_id,
                hospital_bed_id, hospital_unit_id,
                hospital_department_id
            ) = 0)
    )
);

create unique index evaluation_targets_continuity_uq
    on evaluation_targets (evaluation_cycle_id, continuity_key);

create index evaluation_targets_cycle_status_idx
    on evaluation_targets (evaluation_cycle_id, status, sort_order);
```

Do not include `patient_device_id` until the corresponding table exists. It is shown to reserve the intended extension.

### 11.2 Continuity keys

Examples:

```text
patient:<patient_uuid>
patient_encounter:<encounter_uuid>
bed:<bed_uuid>
unit:<unit_uuid>
department:<department_uuid>
patient_device:<device_uuid>
```

Continuity normally means:

| Target type | Longitudinal identity |
|---|---|
| Patient | Same patient |
| Patient encounter | Same hospitalization/encounter |
| Bed | Same operational bed |
| Unit | Same unit |
| Department | Same department |
| Patient device | Same physical device episode |

Generate `continuity_key` inside trusted database/application code. Do not accept arbitrary client-provided keys.

### 11.3 Rationale for explicit polymorphism

One typed table supports a unified work queue and grid while retaining real foreign keys. The target types are finite and controlled, and a strict `CHECK` constraint ensures exactly one target reference is populated.

Do not implement generic polymorphism:

```sql
target_table text,
target_id uuid
```

That pattern loses referential integrity, permits invalid table names and IDs, complicates RLS, and creates unsafe joins.

Separate per-type target tables provide stronger static normalization but substantially complicate generalized cycle queries and interfaces. They become preferable only if target types acquire materially different lifecycles or large type-specific payloads.

---

## 12. Evaluation records

### 12.1 `evaluation_records`

```sql
create table evaluation_records (
    id uuid primary key default gen_random_uuid(),
    evaluation_target_id uuid not null unique
        references evaluation_targets(id),
    form_instance_id uuid not null unique
        references form_instances(id),
    evaluation_date date not null,
    status text not null default 'not_started',
    assigned_to_user_id uuid references users(id),
    claimed_by_user_id uuid references users(id),
    claim_expires_at timestamptz,
    started_by_user_id uuid references users(id),
    started_at timestamptz,
    completed_by_user_id uuid references users(id),
    completed_at timestamptz,
    reviewed_by_user_id uuid references users(id),
    reviewed_at timestamptz,
    voided_by_user_id uuid references users(id),
    voided_at timestamptz,
    void_reason text,
    previous_evaluation_record_id uuid
        references evaluation_records(id),
    observation_disposition text,
    denominator_eligible boolean,
    denominator_exclusion_reason text,
    row_version bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (status in (
        'not_started',
        'in_progress',
        'completed',
        'reviewed',
        'voided'
    )),
    check (observation_disposition is null or observation_disposition in (
        'observed',
        'not_observed',
        'vacant',
        'patient_temporarily_absent',
        'discharged_before_assessment',
        'procedure_in_progress',
        'isolation_restriction',
        'refused',
        'unsafe_to_assess',
        'not_applicable',
        'unknown'
    )),
    check (
        status <> 'voided'
        or (voided_at is not null and voided_by_user_id is not null
            and void_reason is not null)
    )
);
```

### 12.2 Rationale

The record controls assignment, work state, completion, review, disposition, and concurrency. Its form instance controls answers.

`previous_evaluation_record_id` is a navigational optimization, not the sole source of truth. The authoritative predecessor must be recalculable from program, continuity key, cycle time, valid status, form compatibility, and carry-forward age.

Observation disposition is not an answer to a clinical question. It determines whether the target was observed and whether it belongs in the indicator denominator.

---

## 13. Observation-time context

### 13.1 `evaluation_observation_contexts`

```sql
create table evaluation_observation_contexts (
    id uuid primary key default gen_random_uuid(),
    evaluation_record_id uuid not null unique
        references evaluation_records(id),
    observed_at timestamptz not null,
    hospital_bed_id uuid references hospital_beds(id),
    patient_encounter_id uuid references patient_encounters(id),
    occupancy_status text,
    captured_automatically boolean not null default false,
    manually_overridden boolean not null default false,
    override_reason text,
    overridden_by_user_id uuid references users(id),
    created_at timestamptz not null default now(),
    check (occupancy_status is null or occupancy_status in (
        'occupied', 'vacant', 'blocked', 'unavailable', 'unknown'
    )),
    check (
        not manually_overridden
        or (override_reason is not null and overridden_by_user_id is not null)
    )
);
```

### 13.2 Rationale

The cycle snapshot describes generation-time occupancy. This table describes actual observation-time occupancy. Keeping both prevents silent historical rewriting while supporting transfers, new admissions, and delayed rounds.

---

## 14. Form assignment and immutable version resolution

The program references a logical form definition. At cycle generation, the service resolves the current published form version and stores it on `evaluation_cycles.resolved_form_version_id`.

Every target in the cycle then receives a concrete `form_instance` based on that version:

```text
Evaluation program
    → Logical form definition

Evaluation cycle
    → Resolved immutable published version

Evaluation record
    → Concrete form instance
```

An edit to the form during the day must not change existing cycles. Multiple versions in one cycle should require an explicit administrative migration with audit records.

Each logical question must have a stable semantic key preserved across compatible form versions:

```text
infection.central_line.present
infection.central_line.insertion_date
bundle.head_of_bed.compliant
bundle.oral_care.completed
```

Stable keys must be unique within a logical form definition and must not be reused for a semantically different question.

---

## 15. Safe carry-forward design

Blindly copying all prior answers is clinically unsafe. Stale information may appear current without reassessment.

### 15.1 Question-level policy

Extend the versioned question definition:

```sql
alter table form_question_definitions
    add column stable_key text,
    add column carry_forward_policy text not null default 'never',
    add column carry_forward_requires_confirmation boolean not null default true,
    add column carry_forward_max_age interval,
    add column clear_when_context_changes boolean not null default true,
    add constraint form_questions_carry_forward_policy_chk
        check (carry_forward_policy in (
            'never',
            'copy_as_draft',
            'copy_and_require_confirmation',
            'copy_as_reference_only',
            'recalculate'
        ));
```

Policy meanings:

| Policy | Behavior | Suitable examples |
|---|---|---|
| `never` | Start blank | Current temperature, today’s head-of-bed status, current dressing condition |
| `copy_as_draft` | Copy editable value with visible provenance | Stable contextual data, insertion site, isolation category |
| `copy_and_require_confirmation` | Copy but block completion until confirmed or changed | Device still present, ventilation ongoing, antimicrobial still active |
| `copy_as_reference_only` | Show prior value beside a blank current field | Prior clinical state useful for comparison but unsafe to prepopulate |
| `recalculate` | Derive from current data | Device-days, days since insertion, score, compliance percentage |

### 15.2 Answer provenance

If the existing answer table supports immutable revisions, provenance should belong to the answer revision. Otherwise extend `form_answers`:

```sql
alter table form_answers
    add column answer_origin text not null default 'manual',
    add column copied_from_answer_id uuid references form_answers(id),
    add column copied_at timestamptz,
    add column confirmed_by_user_id uuid references users(id),
    add column confirmed_at timestamptz,
    add column requires_confirmation boolean not null default false,
    add column row_version bigint not null default 1,
    add constraint form_answers_origin_chk
        check (answer_origin in (
            'manual',
            'carried_forward',
            'integration',
            'calculated',
            'default',
            'imported'
        )),
    add constraint form_answers_copy_provenance_chk
        check (
            answer_origin <> 'carried_forward'
            or (copied_from_answer_id is not null and copied_at is not null)
        );
```

A copied answer must never be indistinguishable from a newly entered answer.

### 15.3 `form_instance_initializations`

```sql
create table form_instance_initializations (
    id uuid primary key default gen_random_uuid(),
    form_instance_id uuid not null unique
        references form_instances(id),
    initialization_type text not null,
    source_form_instance_id uuid references form_instances(id),
    initialized_by_user_id uuid references users(id),
    initialized_at timestamptz not null default now(),
    policy_snapshot jsonb not null,
    compatibility_result jsonb not null default '{}'::jsonb,
    check (initialization_type in (
        'blank',
        'defaults',
        'carry_forward',
        'integration',
        'import'
    ))
);
```

`policy_snapshot` records the rules used at initialization. It should not contain redundant PHI.

### 15.4 Source selection algorithm

A carry-forward source must satisfy:

1. same evaluation program;
2. same continuity key;
3. earlier cycle occurrence;
4. `completed` or `reviewed` status;
5. not voided;
6. within question-level maximum age;
7. compatible logical form and answer types.

Select the latest compatible source. Do not copy from an incomplete assessment by default.

Match questions using `stable_key`, then verify:

- source and destination answer types are compatible;
- relevant option semantic keys still exist;
- units and value constraints remain compatible;
- repeating-group identity can be mapped safely;
- context-change policies do not require clearing.

### 15.5 Initialization must happen once

Carry-forward is a one-time form initialization operation. It must not dynamically re-read the previous form whenever today’s form opens.

After initialization, the new form is an independent record. This prevents changes to yesterday’s record from silently altering today’s work.

### 15.6 Completion validation

Before completion:

- every copied answer requiring confirmation must be confirmed or replaced;
- current validation and conditional requirements must pass;
- stale copied values beyond maximum age must be cleared;
- hidden answers must follow the form engine’s configured retention policy;
- computed values must be recalculated from current inputs.

---

## 16. “No patient” and denominator semantics

Do not model:

```text
Yes / No / No patient / Bed unavailable
```

as options to a boolean clinical question.

For a vacant bed:

```text
Target exists: yes
Observation disposition: vacant
Denominator eligible: false
Clinical answer: null / not applicable
```

These are separate dimensions:

- target generation;
- occupancy;
- observation outcome;
- question answer;
- denominator eligibility.

The correct indicator is:

```text
compliance =
    compliant eligible observed targets
    /
    all eligible observed targets
```

Vacant beds, unavailable beds, unobserved targets, and missing answers must remain distinguishable. `NULL` must not carry all of these meanings.

---

## 17. Bed-matrix and rapid-entry model

The backend should retain one `evaluation_target`, one `evaluation_record`, one `form_instance`, and standard answers per bed. The frontend may render them as a matrix:

| Bed | Occupancy | Head elevated | Oral care | Notes |
|---|---|---:|---:|---|
| 01 | Occupied | Yes | Yes | — |
| 02 | Vacant | — | — | — |
| 03 | Occupied | No | Yes | Position corrected |

### 17.1 `evaluation_program_views`

```sql
create table evaluation_program_views (
    id uuid primary key default gen_random_uuid(),
    evaluation_program_id uuid not null
        references evaluation_programs(id),
    view_type text not null,
    configuration jsonb not null default '{}'::jsonb,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (view_type in (
        'standard_form',
        'bed_matrix',
        'patient_list',
        'department_summary',
        'mixed_round'
    ))
);

create unique index evaluation_program_one_default_view_uq
    on evaluation_program_views (evaluation_program_id)
    where is_default;
```

Configuration may define:

- question stable keys displayed as columns;
- column order and width;
- frozen bed and patient columns;
- quick-answer controls;
- conditional columns;
- default filters;
- row ordering;
- side-panel behavior.

JSONB is appropriate here because this is presentation metadata, not core clinical data.

### 17.2 Critical principle

Build specialized renderers over the existing answer model. Do not create separate “checklist answer” tables with different validation, audit, export, and security behavior.

---

## 18. Findings and escalation

### 18.1 `evaluation_findings`

```sql
create table evaluation_findings (
    id uuid primary key default gen_random_uuid(),
    evaluation_record_id uuid not null
        references evaluation_records(id),
    source_form_answer_id uuid references form_answers(id),
    finding_type text not null,
    severity text,
    status text not null default 'open',
    title text not null,
    description text,
    detected_at timestamptz not null,
    detected_by_user_id uuid references users(id),
    acknowledged_at timestamptz,
    acknowledged_by_user_id uuid references users(id),
    resolved_at timestamptz,
    resolved_by_user_id uuid references users(id),
    resolution_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (status in (
        'open',
        'acknowledged',
        'resolved',
        'dismissed'
    ))
);
```

Examples include compromised dressings, missing device indications, failed bundle elements, absent isolation signage, and suspected infection.

### 18.2 Explicit join tables

Use normal foreign keys rather than a generic entity type/id pair:

```sql
create table evaluation_finding_action_items (
    evaluation_finding_id uuid not null
        references evaluation_findings(id),
    action_item_id uuid not null references action_items(id),
    created_at timestamptz not null default now(),
    primary key (evaluation_finding_id, action_item_id)
);

create table evaluation_finding_cases (
    evaluation_finding_id uuid not null
        references evaluation_findings(id),
    case_id uuid not null references cases(id),
    created_at timestamptz not null default now(),
    primary key (evaluation_finding_id, case_id)
);

create table evaluation_finding_risks (
    evaluation_finding_id uuid not null
        references evaluation_findings(id),
    risk_id uuid not null references risks(id),
    created_at timestamptz not null default now(),
    primary key (evaluation_finding_id, risk_id)
);
```

Use the project’s actual issue/risk entity names.

### 18.3 Escalation policy

| Finding | Typical disposition |
|---|---|
| Single head-of-bed failure corrected immediately | Finding only |
| Repeated bed-level noncompliance | Action item or quality issue |
| Suspected catheter-associated infection | Infection-control case |
| Cluster of infections | Outbreak investigation case |
| Persistent department-level failure | Improvement project or committee case |

Avoid building a generic rules engine initially. Implement explicit, testable program rules for known indicators. Add a configurable rules table only after recurring patterns justify it.

---

## 19. Optional device-level surveillance

Many infection-control assessments are actually device-level. A patient may have multiple central lines, drains, and catheters.

```sql
create table patient_devices (
    id uuid primary key default gen_random_uuid(),
    patient_encounter_id uuid not null
        references patient_encounters(id),
    device_type text not null,
    external_device_id text,
    insertion_at timestamptz,
    removal_at timestamptz,
    insertion_site text,
    laterality text,
    status text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (removal_at is null or insertion_at is null
        or removal_at > insertion_at)
);

create index patient_devices_encounter_status_idx
    on patient_devices (patient_encounter_id, status);
```

Device targets support:

- bundle adherence per device;
- catheter necessity;
- insertion-site evaluation;
- device-days;
- line-associated infection analysis.

This should be a later implementation phase unless current requirements already demand per-device fidelity. The target architecture must nevertheless permit it without redesign.

---

## 20. Cycle generation workflow

Cycle generation should run through one idempotent, transactionally controlled service.

### Step 1: create or claim scheduled occurrence

Insert the unique `(program, local date, occurrence key)` cycle. If it already exists, return the existing cycle rather than duplicate it.

### Step 2: resolve immutable configuration

Resolve:

- active program;
- active scopes at the scheduled instant;
- published form version;
- target strategy;
- timezone;
- active beds and units;
- applicable carry-forward configuration.

### Step 3: capture occupancy

For each eligible bed:

- identify operational status;
- identify the encounter assigned at capture time;
- store source, capture time, and label snapshots.

### Step 4: generate targets

- Bed program: one target per eligible active bed.
- Encounter program: one target per eligible occupied encounter.
- Department program: one target per scoped department.
- Mixed program: create separate typed targets, even if shown on one screen.

### Step 5: create form instances and records

Create one form instance and evaluation record per target using the cycle’s resolved form version.

### Step 6: initialize answers

Apply defaults and question-level carry-forward once. Record the initialization and answer provenance.

### Step 7: assign work

Assignments may be cycle-wide, unit-wide, row-specific, or claimed dynamically.

### Step 8: finalize generation and open

Only set `generation_status = 'generated'` after all expected rows exist. On failure, store a sanitized structured error and allow idempotent retry.

### Transaction strategy

For modest rounds, generate the cycle in one transaction. For very large rounds, use staged idempotent batches with a generation job and deterministic keys. Never expose a partially generated cycle as ready.

---

## 21. Changes during a round

### Patient moved after snapshot

Keep the original snapshot. Show the current location as secondary context and warn that it differs.

### New admission after generation

Depending on program policy:

- wait for the next cycle;
- add an ad hoc target;
- perform an additive target refresh;
- create a second cycle.

Refresh may only add targets. It must not delete or repoint completed targets.

### Discharged before assessment

Keep the generated target and mark:

```text
observation_disposition = discharged_before_assessment
denominator_eligible = false
```

### Patient transferred between beds

- Patient surveillance retains the same encounter target; location is context.
- Bed adherence remains tied to the observed bed and occupancy state.

This is why patient and bed targets must remain separate even if one screen combines them.

---

## 22. Concurrency and offline behavior

### 22.1 Optimistic locking

Use `row_version` on evaluation records and answers:

```sql
update evaluation_records
set
    status = :new_status,
    row_version = row_version + 1,
    updated_at = now()
where id = :id
  and row_version = :expected_version;
```

Zero updated rows means the client is stale and must reload or resolve a conflict.

Do not hold long-lived database locks while a user fills a form.

### 22.2 Assignment and claim

A record may be:

- explicitly assigned;
- unassigned;
- temporarily claimed with expiration;
- completed;
- reviewed.

Claim operations should be atomic. Expired claims may be reclaimed.

### 22.3 Offline drafts

At minimum:

- generate client UUIDs for pending writes;
- use idempotency keys;
- preserve `observed_at`, not only server receipt time;
- include the base server version;
- prohibit ordinary writes to completed/reviewed records;
- record conflict resolution;
- avoid blind last-write-wins for clinical data.

Conflict policy:

- different questions changed: merge if validation remains valid;
- same question changed: require resolution unless both changes confirm the identical value;
- completion/review versus offline edit: completion wins as a state boundary and the edit requires an explicit reopen workflow.

---

## 23. Analytics

Transactional records and answer revisions remain the source of truth. Derived views or warehouse facts may optimize reporting.

Store or derive:

- eligible targets;
- observed targets;
- completed targets;
- compliant targets;
- noncompliant targets;
- exclusions by reason;
- missing assessments;
- numerator and denominator;
- rates by program, date, unit, question, and evaluator;
- device-days;
- persistent or repeated findings.

Never store only the percentage. A percentage without numerator, denominator, exclusions, and missingness cannot be audited.

An illustrative fact view:

```sql
create materialized view daily_evaluation_indicator_facts as
select
    p.id as evaluation_program_id,
    c.scheduled_for_date,
    t.hospital_unit_id,
    q.stable_key as question_stable_key,
    count(*) filter (
        where r.denominator_eligible
    ) as denominator,
    count(*) filter (
        where r.denominator_eligible
          and /* normalized answer is compliant */
              true
    ) as numerator,
    count(*) filter (
        where r.observation_disposition = 'not_observed'
    ) as not_observed_count
from evaluation_programs p
join evaluation_cycles c
  on c.evaluation_program_id = p.id
join evaluation_targets t
  on t.evaluation_cycle_id = c.id
join evaluation_records r
  on r.evaluation_target_id = t.id
join form_instances fi
  on fi.id = r.form_instance_id
join form_answers a
  on a.form_instance_id = fi.id
join form_question_definitions q
  on q.id = a.form_question_definition_id
group by p.id, c.scheduled_for_date, t.hospital_unit_id, q.stable_key;
```

The final join names and normalized compliance expression must match the existing form schema. For mixed target types, derive unit context from snapshots or typed references rather than assuming `hospital_unit_id` is populated.

Aggregate reporting must apply suppression/deidentification rules when small cell sizes or rare events could identify a patient.

---

## 24. Permissions and Supabase RLS

Surveillance access differs from case access. Define capabilities for:

| Resource | Example actions |
|---|---|
| Evaluation program | `view`, `create`, `edit`, `activate`, `retire`, `manage_schedule` |
| Evaluation cycle | `view`, `generate`, `open`, `assign`, `complete`, `cancel`, `reopen` |
| Evaluation record | `view`, `edit`, `complete`, `review`, `void` |
| Evaluation finding | `view`, `create`, `acknowledge`, `resolve`, `escalate` |
| Hospital location | `view`, `manage` |
| Evaluation analytics | `view_aggregate`, `export_aggregate` |
| PHI | `view_phi`, `export_phi` |

### 24.1 Required authorization dimensions

RLS and trusted functions must enforce:

- organization boundary;
- hospital membership;
- program scope;
- committee ownership or explicit grant;
- evaluator assignment or unit authorization where applicable;
- record status;
- PHI-specific capability;
- elevated permission for reopen, void, export, or configuration changes.

### 24.2 Aggregate versus identifiable access

A quality analyst may view unit compliance without seeing patient identities. Therefore:

```text
view aggregate evaluation metrics
```

must not imply:

```text
view patient-identifiable evaluation records
```

Expose aggregate views through security-barrier views or carefully written security-definer functions that return only authorized, deidentified fields. Do not give analysts direct access to underlying PHI tables merely because the UI hides patient columns.

### 24.3 RLS inheritance

Child-table policies should resolve authorization through their parent chain:

```text
form answer
→ form instance
→ evaluation record
→ target
→ cycle
→ program
→ hospital/organization
```

For performance, denormalize tenant IDs into high-volume tables only if integrity is enforced. Add indexes matching the RLS predicates.

### 24.4 Privileged operations

Use narrowly scoped server-side functions for:

- cycle generation;
- carry-forward;
- completion;
- review;
- reopen;
- void;
- target refresh;
- PHI export.

The client should not directly insert provenance rows or mark itself as reviewer.

---

## 25. Audit and immutability

At minimum, audit:

- program and schedule configuration changes;
- scope changes;
- cycle creation, generation, failure, retry, open, completion, cancellation, and reopening;
- target generation and additive refresh;
- occupancy source and snapshot;
- form-version resolution;
- form initialization;
- every carried-forward answer;
- answer confirmation and modification;
- observation-time occupancy override;
- target exclusion and denominator decision;
- record completion, review, void, and correction;
- finding creation, acknowledgement, resolution, and dismissal;
- escalation into issue, risk, action item, referral, or case;
- PHI view/export where legally and operationally required.

### 25.1 Audit event structure

Reuse the platform audit log, ensuring it supports:

- organization and hospital;
- actor user and impersonation/delegation context;
- event type;
- resource type and ID;
- occurred-at timestamp;
- request/correlation ID;
- source application and client;
- before/after or structured change set;
- reason code and free-text reason for privileged changes;
- immutable append-only storage.

Do not place full PHI values in a general audit event payload. Store field identifiers, classification, hashes, or protected change references according to the platform’s audit design.

### 25.2 Correction model

Completed or reviewed records should not be edited in place through ordinary CRUD.

Recommended process:

1. authorized user requests reopen or correction;
2. system records reason, actor, and prior state;
3. existing answer revisions remain immutable;
4. a new answer revision is created;
5. record is re-completed and, when applicable, re-reviewed;
6. downstream findings and metrics are recalculated with provenance.

The system must be able to explain:

```text
This value was entered on July 15 by User A.
It was carried into July 16 during initialization.
User B confirmed it on July 16.
The July 16 record was later reopened by User C for a documented reason.
```

---

## 26. Example: daily patient infection surveillance

### Program

```text
Name: Daily ICU Device and Infection Surveillance
Target strategy: patient_encounter
Schedule: daily at 07:00
Scope: Adult ICU
Carry-forward: enabled
```

### Prior evaluation

```text
Central line present: Yes
Insertion date: July 10
Dressing intact: Yes
Urinary catheter present: Yes
Catheter indication: Accurate urine measurement
Fever in last 24 hours: No
```

### Next-day initialization

| Question | Initialization |
|---|---|
| Central line present | Copy; confirmation required |
| Insertion date | Copy as draft |
| Dressing intact | Blank or prior value shown as reference |
| Urinary catheter present | Copy; confirmation required |
| Catheter indication | Copy; confirmation required |
| Fever in last 24 hours | Blank |

If the evaluator enters `Dressing intact = No`, the current answer may create an `evaluation_finding` linked to that answer. The finding can be corrected locally, assigned as an action item, or escalated according to policy.

---

## 27. Example: head-of-bed adherence

### Program

```text
Name: Daily Head-of-Bed Adherence
Target strategy: bed
Scope: Adult ICU
View: bed_matrix
Carry-forward: disabled
```

### Snapshot and results

```text
Bed 01
  occupancy = occupied
  disposition = observed
  denominator_eligible = true
  head_of_bed_elevated = true

Bed 02
  occupancy = vacant
  disposition = vacant
  denominator_eligible = false
  head_of_bed_elevated = null

Bed 03
  occupancy = occupied
  disposition = observed
  denominator_eligible = true
  head_of_bed_elevated = false

Bed 04
  occupancy = unavailable
  disposition = not_applicable
  denominator_eligible = false
  head_of_bed_elevated = null
```

Result:

```text
Numerator: 1
Denominator: 2
Compliance: 50%
Vacant/unavailable exclusions: 2
Missing eligible observations: 0
```

This remains auditable and statistically correct.

---

## 28. Recommended service boundaries

Application services or modules should include:

### `EvaluationProgramService`

- configure program;
- validate form compatibility;
- manage scope, schedule, and views;
- activate, pause, or retire program.

### `EvaluationCycleGenerationService`

- claim occurrence idempotently;
- resolve published form version;
- snapshot scope and occupancy;
- generate targets and records;
- initialize forms;
- report generation status.

### `CarryForwardService`

- locate compatible predecessor;
- compare stable keys and types;
- apply question policies;
- write provenance and initialization records;
- return warnings for skipped mappings.

### `EvaluationWorkflowService`

- assignment and claim;
- autosave authorization;
- completion validation;
- review, reopen, void, and correction.

### `EvaluationFindingService`

- derive or create findings;
- prevent duplicate active findings where required;
- resolve/dismiss;
- link escalation entities.

### `EvaluationMetricsService`

- normalize indicator semantics;
- calculate numerator, denominator, exclusions, and missingness;
- refresh derived facts;
- enforce aggregate/deidentification access.

These service boundaries avoid placing business rules in controllers or UI components.

---

## 29. Key invariants to test

Automated database and integration tests should prove:

1. cross-hospital references cannot be created;
2. only one scheduled cycle exists per program/date/occurrence;
3. cycle form version is immutable after generation;
4. generation retry does not duplicate targets or form instances;
5. each target has exactly one valid typed reference;
6. a cycle has at most one target per continuity key;
7. encounter carry-forward never crosses admissions;
8. bed carry-forward never follows a patient to another bed;
9. voided or incomplete records are not default carry-forward sources;
10. incompatible question types are not copied;
11. copied answers retain source provenance;
12. required copied values block completion until confirmed;
13. snapshot occupancy does not change after patient transfer;
14. additive refresh cannot delete or mutate existing targets;
15. vacant/unavailable targets do not enter clinical denominators;
16. completed/reviewed records reject ordinary edits;
17. optimistic locking detects concurrent edits;
18. aggregate-only users cannot query patient identity;
19. RLS prevents cross-organization and cross-hospital reads;
20. reopening, voiding, overriding occupancy, and exporting PHI are audited.

---

## 30. Implementation phases

### Phase 1: foundational operational model

Implement:

- departments, units, rooms, and beds;
- patient encounters and bed assignments;
- evaluation programs, scopes, and schedules;
- cycles, targets, evaluation records;
- integration with existing form instances;
- base RLS and audit events.

### Phase 2: generation and bed-matrix workflow

Implement:

- immutable form-version resolution;
- occupancy snapshots;
- automated bed and encounter target generation;
- observation dispositions;
- denominator eligibility;
- bed-matrix interface;
- cycle completion metrics;
- optimistic locking.

### Phase 3: longitudinal carry-forward

Implement:

- stable question keys;
- versioned question policies;
- compatible predecessor lookup;
- one-time initialization;
- answer provenance;
- visible confirmation states;
- completion validation;
- form-version compatibility tests.

Do not ship carry-forward without provenance, confirmation, and audit.

### Phase 4: findings and escalation

Implement:

- structured findings;
- answer-to-finding traceability;
- action-item, risk, and case links;
- repeated noncompliance detection;
- controlled case escalation.

### Phase 5: advanced surveillance and integration

Implement as requirements justify:

- patient devices and device targets;
- device-days;
- infection episodes;
- culture and organism data;
- antimicrobial surveillance;
- EHR/ADT integration;
- offline drafts and conflict resolution;
- derived indicator facts and dashboards.

---

## 31. Decisions deliberately deferred

The following require alignment with the existing codebase or institutional requirements:

- exact form table and answer-revision names;
- whether target types are text checks, PostgreSQL enums, or controlled lookup rows;
- whether bed movements require a separate historical bed-location table;
- whether ADT overlap constraints can be enforced immediately;
- how encounter and patient identifiers are encrypted or tokenized;
- exact audit-log payload design;
- per-indicator numerator/denominator configuration;
- whether scheduler execution is database-, queue-, or application-driven;
- small-cell suppression and deidentification thresholds;
- whether cycle generation is one transaction or staged batches at expected scale.

These do not change the core architecture.

---

## 32. Anti-patterns to reject during implementation

Do not:

- create a `Case` for every daily evaluation;
- attach all daily answers to one mutable form instance;
- copy all prior answers without question-level policy;
- treat copied answers as newly entered;
- match questions only by version-specific row ID or display label;
- carry patient data across encounters by default;
- use `target_table` plus `target_id`;
- store bed names instead of durable bed records;
- rewrite snapshots after transfers;
- store `no_patient` as an answer to every clinical question;
- use `NULL` for vacant, unavailable, unobserved, and unknown without disposition;
- calculate compliance using all beds as the denominator;
- build a separate answer architecture for the matrix UI;
- permit completed clinical records to be edited through ordinary CRUD;
- trust frontend authorization or hidden columns;
- allow aggregate access to imply PHI access;
- store only a final compliance percentage;
- use blind last-write-wins for concurrent or offline clinical edits;
- implement a generic escalation rules engine before the indicator semantics are stable.

---

## 33. Final recommendation

Implement recurring evaluations as a distinct operational domain that reuses the platform’s form and governance infrastructure.

The minimum production-safe architecture consists of:

1. durable hospital locations and beds;
2. patient encounters and time-bounded occupancy;
3. evaluation programs, schedules, scopes, and immutable cycles;
4. frozen occupancy snapshots;
5. constrained typed targets;
6. evaluation records linked one-to-one with form instances;
7. encounter-, bed-, unit-, or department-specific continuity;
8. one-time question-level carry-forward with full provenance;
9. explicit observation disposition and denominator eligibility;
10. unified answer storage with specialized matrix/list renderers;
11. structured findings and traceable escalation;
12. tenant-aware RLS, PHI separation, optimistic locking, and append-only audit.

This architecture preserves the meaning and strength of the existing committee platform while adding the operational model required for reliable daily surveillance and hospital-wide adherence audits.


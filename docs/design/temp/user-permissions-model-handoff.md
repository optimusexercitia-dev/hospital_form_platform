# User Permissions Model Handoff

> **⛔ NOT ephemeral resume-state — DO NOT SWEEP.** This is a **durable design/audit
> record** (1 inbound link, ADR 0078), named "handoff" before the convention existed.
> Under the handoff convention
> ([.claude/skills/handoff/SKILL.md](../../../.claude/skills/handoff/SKILL.md)),
> ephemeral resume-state lives in `docs/handoffs/`, may not be cited, and is deleted at
> its branch's Record step — none of which applies to this file. Classified 2026-08-26.

> **Status:** DESIGN APPROVED — implementation not started
>
> **Date:** 2026-07-14
>
> **Scope:** Database authorization for Cases, Meetings, attachments, PHI, NSP oversight, and inter-Committee Referrals
>
> **Audience:** Backend implementer, database reviewer, QA, and product owner
>
> **Authority:** This document records the user-approved target design. It does not claim regulatory compliance.

## 1. Objective

Implement a least-privilege authorization model in which:

1. administrative scope never silently becomes clinical access;
2. hospital-wide oversight is separated from Case-level investigation;
3. Committee coordinators can lead all work owned by their Committee;
4. Committee members see only Cases in which they are involved or for which they hold an explicit grant;
5. Case overview, Case content, write authority, Standard PHI, and Restricted PHI are separate capabilities;
6. Meeting participation does not bypass Case authorization;
7. inter-Committee PHI is disclosed only through an explicit, immutable, minimum-necessary Referral snapshot;
8. deactivation, suspension, revocation, and expiry deny access at the database boundary immediately;
9. every privileged PHI access and every authority change is auditable without placing PHI in the audit log.

This is a redesign of the authorization semantics, not merely a UI change. The Postgres/Supabase boundary is authoritative. Client-side route guards and conditional rendering are convenience controls only.

---

## 2. Canonical user categories

The following five categories are the product-level personas. Physical database role names may remain more granular, but every role must map unambiguously to one category.

### 2.1 Organization User

Includes organization-level and hospital-level administrative users such as `org_admin`, `hospital_admin`, and PHI-free NSP organization administration.

Default authority:

- manage organizations, hospitals, Committees, users, appointments, configuration, and indicators within their scope;
- read PHI-free Case and Meeting aggregates;
- read PHI-free roster and governance information;
- no direct Case Content, Meeting minutes, patient identifiers, or attachments;
- no inherited Case access merely because the user administers the owning organization or hospital.

If an Organization User must participate clinically, that person must also hold the appropriate Committee or NSP role, or receive an explicit Case Access Grant. Administrative and clinical appointments remain independently revocable.

### 2.2 Hospital NSP Coordinator

Hospital-scoped patient-safety leader.

Default authority:

- hospital-wide Case Overview and safety indicators through PHI-free aggregate doors;
- create and assign NSP Investigations for Cases belonging to the same hospital;
- read and manage the NSP Investigation record;
- no automatic Case Content or PHI access;
- Case Content, write authority, and PHI are obtained through the investigation entitlement created for a documented purpose;
- may invite NSP Members to the investigation;
- may not gain access to another hospital through organization membership alone.

An NSP Coordinator may initiate an investigation for a Case in their hospital. The action must require a reason, create a short or explicitly chosen expiry, notify the owning Committee coordinator, and be audit logged. This is intentional oversight, not an invisible bypass.

### 2.3 Hospital NSP Member

Hospital-scoped patient-safety professional.

Default authority:

- hospital-wide PHI-free Case Overview and safety indicators;
- detailed Case access only while assigned to an active NSP Investigation;
- no authority to create their own investigation entitlement;
- write authority only when expressly included in the assignment;
- Standard PHI only when separately included in the investigation assignment;
- Restricted PHI only through an additional explicit clearance.

### 2.4 Committee Coordinator

The clinical/operational leader of a Committee. This is the canonical name for the existing `staff_admin` concept.

Default authority:

- read Case Overview and Case Content for every Case owned by their Committee;
- write and manage every active Case owned by their Committee;
- manage Committee Meetings;
- grant and revoke Case access for Committee Members;
- read Standard PHI for Committee Cases when patient identity is part of the Case workflow;
- no automatic Restricted PHI clearance merely because the user coordinates the Committee;
- no authority over Cases owned by other Committees except through a Referral or explicit Case grant.

### 2.5 Committee Member

A Committee participant without blanket Case access.

Default authority:

- no Committee-wide Case list containing restricted Case details;
- Case Overview and Case Content only for Cases in which the member is directly involved or explicitly granted access;
- write only for assigned work or when an explicit write grant exists;
- Standard PHI is not implied by ordinary Case read access;
- Meeting materials only through Meeting Participation;
- linked Case sections within a Meeting remain protected by Case authorization.

Direct involvement currently includes assignment to a Case phase or Case narrative. Future involvement sources may be added only by extending the central capability resolver and its regression matrix.

---

## 3. Authorization vocabulary

Authorization must be expressed as capabilities, not a single `can_read_case` boolean.

### 3.1 Case capabilities

| Capability | Meaning | Includes | Does not include |
|---|---|---|---|
| `view_case_overview` | Read the PHI-free operational representation | Case number, status, Committee, dates, category, workflow state | labels or free text that may identify a patient; answers; narratives; patient identity |
| `read_case_content` | Read substantive Case work | phases, submitted responses, narratives, interviews, timeline, non-PHI attachments | patient identifiers; Restricted PHI |
| `write_case_content` | Modify substantive Case work | edits permitted by lifecycle and assignment rules | access administration; PHI clearance; terminal-record rewriting |
| `read_standard_phi` | Read minimum-necessary patient identity and Standard PHI | approved patient identifiers and standard PHI attachments | Restricted PHI |
| `read_restricted_phi` | Read explicitly restricted material | `phi_restricted`, peer-review, legal, ethics, or credentialing material covered by the clearance | unrelated Restricted PHI |
| `manage_case_access` | Grant/revoke Case capabilities | time-bounded grants within the caller's Committee authority | self-escalation; cross-hospital grants; changing role memberships |

`read_standard_phi` and `read_restricted_phi` always imply that the user can identify the Case, but must not automatically imply `write_case_content`.

`write_case_content` implies `read_case_content`. `read_case_content` implies `view_case_overview`. No other implication is automatic.

### 3.2 Meeting capabilities

| Capability | Meaning |
|---|---|
| `view_meeting_metadata` | Read PHI-free schedule, type, status, and attendance requirements |
| `read_meeting_content` | Read agenda, general minutes, resolutions, and non-restricted Meeting attachments |
| `manage_meeting` | Schedule, edit, conduct, and close a Meeting according to lifecycle rules |
| `read_meeting_case_section` | Read the portion of a Meeting record linked to a particular Case; resolved from Case authority, not Meeting authority |

### 3.3 Capability sources

Every positive authorization result must have one of these sources:

| Source | Persisted where | Typical user | Revocation/expiry |
|---|---|---|---|
| `committee_coordinator` | `memberships` | Committee Coordinator | role revocation or membership expiry |
| `case_assignment` | phase/narrative/participant assignment | Committee Member | unassignment, completion policy, or account deactivation |
| `manual_grant` | `case_access_grants` | Committee Member | explicit revoke or `expires_at` |
| `nsp_investigation` | NSP Investigation assignment and/or generated Case grant | NSP Coordinator/Member | investigation closure, unassignment, revoke, or expiry |
| `referral` | Referral recipient access | receiving Committee users | Referral resolution, withdrawal, disclosure expiry, or revoke |
| `break_glass` | `case_access_grants` | exceptional authorized user | mandatory short expiry and explicit revoke |

The resolver may calculate role and assignment sources dynamically. It must not duplicate mutable assignments into a second table unless a historical snapshot is intentionally required.

---

## 4. Default access matrix

Legend:

- **Yes:** default authority from the category's active scoped role.
- **Aggregate:** PHI-free view/RPC only; no base Case Content.
- **Conditional:** active assignment, explicit grant, investigation, participation, or disclosure is required.
- **No:** no access through this category.

| User category | Hospital-wide Case Overview | Committee Case Content | Case write | Meeting metadata | Meeting content | Standard PHI | Restricted PHI |
|---|---:|---:|---:|---:|---:|---:|---:|
| Organization User | Aggregate | No | No | Aggregate | No | No | No |
| Hospital NSP Coordinator | Aggregate | Conditional: investigation | Conditional: investigation | Conditional | Conditional | Conditional: purpose | Conditional: clearance |
| Hospital NSP Member | Aggregate | Conditional: assigned investigation | Conditional: assigned investigation | Conditional | Conditional | Conditional: assignment | Conditional: clearance |
| Committee Coordinator | Own Committee | Yes, own Committee | Yes, own Committee | Yes, own Committee | Yes, own Committee | Yes, minimum necessary | Conditional: clearance |
| Committee Member | Conditional: involved Cases | Conditional: involved Cases | Conditional: assignment/grant | Conditional: participant | Conditional: participant | Conditional: separate grant | Conditional: clearance |

The matrix is the default policy. A positive result outside the matrix requires an explicit, auditable entitlement; it must not be implemented as a hidden role exception.

---

## 5. Target database model

### 5.1 Preserve `memberships`

Keep the unified `public.memberships` table as the source of scoped role truth.

Required invariants:

- exactly one legal scope shape per role;
- role expiry enforced by `app.has_role*`;
- `app.is_active(principal_id)` enforced by every role wrapper;
- writes only through audited grant/revoke doors;
- no clinical capability is inferred from `org_admin`, `hospital_admin`, or `nsp_org_admin`;
- `staff_admin` is mapped to the product term Committee Coordinator;
- `pqs_member` is mapped to the product term NSP Member; new code and UI should prefer NSP terminology.

### 5.2 Replace/evolve `case_access` into `case_access_grants`

The existing read/write level is insufficient because it conflates content and PHI. The target table is:

```sql
create table public.case_access_grants (
  id                    uuid primary key default gen_random_uuid(),
  case_id               uuid not null,
  principal_id          uuid not null references public.profiles(id),
  source                text not null check (source in (
                          'manual_grant', 'nsp_investigation',
                          'referral', 'break_glass')),

  read_case_content     boolean not null default false,
  write_case_content    boolean not null default false,
  read_standard_phi     boolean not null default false,
  read_restricted_phi   boolean not null default false,
  manage_case_access    boolean not null default false,

  granted_by            uuid not null references public.profiles(id),
  granted_at            timestamptz not null default now(),
  starts_at             timestamptz not null default now(),
  expires_at            timestamptz,
  revoked_at            timestamptz,
  revoked_by            uuid references public.profiles(id),
  reason_code           text not null,
  reason_note           text,
  source_entity_id      uuid,

  constraint case_access_grants_time_check
    check (expires_at is null or expires_at > starts_at),
  constraint case_access_grants_write_implies_read
    check (not write_case_content or read_case_content),
  constraint case_access_grants_restricted_implies_standard
    check (not read_restricted_phi or read_standard_phi),
  constraint case_access_grants_nonempty
    check (read_case_content or write_case_content or read_standard_phi
           or read_restricted_phi or manage_case_access),
  constraint case_access_grants_revoke_shape
    check ((revoked_at is null) = (revoked_by is null))
);
```

Implementation requirements omitted from the sketch but mandatory in the migration:

- tenant-safe composite FK from the grant to the Case's organization/hospital anchor;
- a constrained `reason_code` vocabulary; `reason_note` must prohibit or warn against PHI;
- `source_entity_id` validated according to `source`, preferably through explicit nullable FK columns if the final migration follows the repository's column-per-scope convention;
- no direct authenticated INSERT/UPDATE/DELETE;
- RLS enabled immediately;
- explicit `GRANT SELECT` only if a user-facing grant list needs it;
- active partial indexes for `(case_id, principal_id)` and `(principal_id, expires_at)` where `revoked_at is null`;
- at most one active equivalent grant per Case, principal, and source entity, enforced with an appropriate unique index or write-door serialization.

Do not copy assignment-derived access into this table. Assignments remain source records and are evaluated by the resolver.

### 5.3 NSP Investigations

Add a hospital-anchored investigation entity rather than granting NSP full Case access by role.

```sql
create table public.nsp_case_investigations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  hospital_id           uuid not null,
  case_id               uuid not null,
  status                text not null check (status in ('open', 'closed', 'cancelled')),
  purpose_code          text not null,
  purpose_note          text,
  opened_by             uuid not null references public.profiles(id),
  opened_at             timestamptz not null default now(),
  expires_at            timestamptz not null,
  closed_by             uuid references public.profiles(id),
  closed_at             timestamptz,
  standard_phi_approved boolean not null default false,
  restricted_phi_approved boolean not null default false
);

create table public.nsp_investigation_assignments (
  investigation_id     uuid not null references public.nsp_case_investigations(id),
  principal_id         uuid not null references public.profiles(id),
  can_write             boolean not null default false,
  standard_phi_approved boolean not null default false,
  restricted_phi_approved boolean not null default false,
  assigned_by           uuid not null references public.profiles(id),
  assigned_at           timestamptz not null default now(),
  expires_at            timestamptz not null,
  revoked_at            timestamptz,
  primary key (investigation_id, principal_id)
);
```

Rules:

- `hospital_id` must equal the Case's hospital through composite referential integrity;
- only an active NSP Coordinator of that hospital can open, assign, or close an investigation;
- an NSP Member must be active and hold an unexpired NSP membership in the same hospital;
- an NSP Coordinator opening an investigation may assign themselves, but that action is always reasoned, notified, expiring, and audited;
- an NSP Member cannot self-assign or expand their own PHI/write flags;
- assignment capability flags cannot exceed the investigation's approved ceiling;
- investigation close/cancel immediately removes its authorization effect;
- a scheduled job may mark expired investigations, but authorization must deny based on timestamps even if the job has not run;
- no investigation text may be copied into the audit log.

The implementation may resolve investigation capability directly from these tables or mint synchronized `case_access_grants`. Direct resolution avoids duplicated authority state and is preferred unless a grant ledger is required for a uniform UI.

### 5.4 Meeting participation and linked Cases

Keep `meeting_attendees` as the source of Meeting Participation. Add or normalize a Meeting visibility rule if needed, but do not use Committee membership alone for full Meeting content.

Recommended defaults:

| Meeting resource | Organization User | NSP user | Committee Coordinator | Committee Member |
|---|---|---|---|---|
| PHI-free schedule/status | aggregate/metadata | relevant hospital metadata | own Committee | own participation or Committee-visible schedule |
| General agenda/minutes | none | participant or investigation-linked | own Committee | participant |
| Meeting attachment | resource + sensitivity gate | resource + sensitivity gate | resource + sensitivity gate | resource + sensitivity gate |
| Case link identity | no | Case Overview/investigation rule | own Committee | `view_case_overview` for linked Case |
| Case summary/decision | no | `read_case_content` for linked Case | own Committee | `read_case_content` for linked Case |

Required policy rule:

```text
read_meeting_case_section(meeting_id, case_id, user_id)
  = can_read_meeting_content(meeting_id, user_id)
    AND has_case_capability(case_id, user_id, 'read_case_content')
```

Meeting attendance is necessary but not sufficient for Case-linked sections. Conversely, Case access does not expose an unrelated Meeting unless the user also has Meeting Participation or is its Committee Coordinator.

Minutes that mix general discussion with several restricted Cases are unsafe as one undifferentiated text field. New UI should store Case-specific discussion/decision in `meeting_cases` and keep `meetings.minutes_md` for general content. The application must warn authors not to duplicate PHI into general minutes.

### 5.5 Attachment clearance

`attachments.sensitivity_tier` and `confidentiality_label` must become authorization inputs.

Recommended mapping:

| Sensitivity | Required authority |
|---|---|
| `non_phi_internal` | owner resource read capability |
| `phi_standard` | owner resource read capability + `read_standard_phi` |
| `phi_restricted` | owner resource read capability + `read_restricted_phi` |
| `peer_review_confidential` | `read_restricted_phi` plus peer-review clearance label |
| `legal_privileged` | `read_restricted_phi` plus legal clearance label |
| `ethics_investigation` | explicit ethics clearance or matching authorized investigation |
| `credentialing_sensitive` | explicit credentialing clearance |

Do not equate Committee Coordinator with every restricted clearance. Add `attachment_access_grants` only when a label cannot be derived safely from Case or investigation capabilities. Such a table must be attachment-specific, expiring, and audited; avoid a generic unvalidated polymorphic PHI ACL.

The signed-URL flow remains:

1. cookie-authenticated client calls an audited database door;
2. door resolves active account, tenant, owner capability, sensitivity clearance, deletion state, and malware state;
3. door returns bucket/path only on success and records the PHI/restricted read event;
4. server-only service-role client signs that exact object path;
5. service role never makes the authorization decision.

### 5.6 Referral PHI Disclosure

A Referral never transfers ownership of the source Case and never lets the receiving Committee browse it.

Add an explicit disclosure entity:

```sql
create table public.referral_phi_disclosures (
  id                  uuid primary key default gen_random_uuid(),
  referral_id         uuid not null unique references public.case_referral(id),
  source_hospital_id  uuid not null,
  target_hospital_id  uuid not null,
  purpose_code        text not null,
  approved_fields     text[] not null,
  approved_by         uuid not null references public.profiles(id),
  approved_at         timestamptz not null default now(),
  transmitted_by      uuid references public.profiles(id),
  transmitted_at      timestamptz,
  expires_at          timestamptz,
  revoked_at          timestamptz,
  revoked_by          uuid references public.profiles(id),
  snapshot_version    integer not null default 1,
  constraint referral_phi_fields_nonempty check (cardinality(approved_fields) > 0)
);
```

The PHI payload remains physically isolated. The current `referral_patient` concept can be retained as the immutable transmitted snapshot, but its writer must enforce the disclosure's `approved_fields`.

Rules:

- default Referral metadata and subject must be PHI-free;
- a source Committee Coordinator makes the disclosure decision;
- only approved fields are copied; never expose the live source patient row;
- the target reads the frozen snapshot, not the source Case;
- target users cannot overwrite the transmitted identity;
- a correction creates a new disclosure snapshot version or append-only amendment, preserving provenance;
- source and target Committee Coordinators may read the disclosure while active;
- a receiving Committee Member reads it only when assigned to the Referral or its target Case and separately granted Standard PHI;
- NSP visibility of Referral PHI follows an active investigation or explicit disclosure purpose, not hospital NSP role alone;
- withdrawal, expiry, revocation, or PHI disposal removes future read authority without destroying the institutional non-PHI Referral skeleton;
- attachment paths and PHI bodies are never returned to metadata-only readers.

Replace `can_read_referral_phi`-as-writer with distinct predicates:

- `can_read_referral_metadata`
- `can_read_referral_phi`
- `can_write_referral_response`
- `can_manage_referral_phi_disclosure`
- `can_amend_referral_phi_snapshot`

`set_referral_patient` must be removed, made private, or changed so only the disclosure workflow can write the snapshot. Read authority must never imply write authority.

---

## 6. Central authorization interface

### 6.1 Required functions

Create a small, stable family in the private `app` schema:

```sql
app.case_capabilities(p_case_id uuid, p_user_id uuid) returns jsonb
app.has_case_capability(p_case_id uuid, p_user_id uuid, p_capability text) returns boolean
app.can_read_meeting_content(p_meeting_id uuid, p_user_id uuid) returns boolean
app.can_read_meeting_case(p_meeting_id uuid, p_case_id uuid, p_user_id uuid) returns boolean
app.can_read_attachment(p_attachment_id uuid, p_user_id uuid) returns boolean
app.can_read_referral_phi(p_referral_id uuid, p_user_id uuid) returns boolean
```

`case_capabilities` is the single semantic source. The boolean wrapper exists for RLS readability and performance.

Evaluation order must be fail-closed:

1. reject null user;
2. reject inactive or suspended profile;
3. load Case tenant anchors;
4. reject absent Case or tenant mismatch;
5. collect positive sources: Committee Coordinator, current assignment, active explicit grant, active NSP Investigation, active Referral entitlement;
6. union capabilities without allowing a weaker source to remove a stronger valid source;
7. apply lifecycle restrictions to writes;
8. return capability set and, internally where useful, source attribution.

No organization/hospital administrative predicate is a positive Case Content source.

### 6.2 Security-definer posture

The helper family may use `SECURITY DEFINER` to inspect protected authority tables without recursive RLS, but only under these constraints:

- located in non-exposed `app`, never exposed as a general client RPC;
- owner and `search_path` pinned;
- explicit user argument honored consistently;
- first-class `app.is_active(p_user_id)` check;
- `REVOKE ALL ... FROM PUBLIC` after every create/replace/drop-recreate operation;
- execute granted only where required for RLS evaluation;
- no arbitrary SQL, table name, column name, or predicate input;
- no return of authority-table rows or PHI;
- tests call both the pure explicit-user form and the authenticated RLS path.

Public mutating RPCs must authenticate via `auth.uid()`, validate authority inside the function, pin `search_path`, revoke PUBLIC execution, and grant only the intended API roles.

### 6.3 RLS policy shape

Case Content tables should converge on:

```sql
create policy <table>_select
on public.<table>
for select to authenticated
using (
  app.has_case_capability(<resolved_case_id>, (select auth.uid()), 'read_case_content')
);
```

Patient identifiers should not be directly selectable by `authenticated`. Preserve the audited RPC-only read pattern.

Case writes must use the appropriate write capability plus entity-specific assignment and lifecycle rules. Every UPDATE policy requires both `USING` and `WITH CHECK`, and a matching SELECT policy.

Organization and NSP macro views should be RPCs or `security_invoker` views over PHI-free columns. Do not expose the base Case row merely to compute an aggregate in the client.

Every new exposed table must receive explicit privileges in the same migration as RLS and policies. Do not depend on Supabase default table exposure.

---

## 7. PHI boundary

### 7.1 Classification

The platform must classify data by storage location and access requirement:

| Class | Examples | Normal storage/access |
|---|---|---|
| PHI-free overview | Case number, status, Committee, safe category, timestamps | RLS/view/RPC; usable in aggregates |
| Case Content | narrative, answer, interview, decision, investigation text | Case content RLS; may still contain incidental PHI |
| Standard PHI | patient name, MRN, DOB, encounter, unit, attending | isolated table; audited read RPC; `read_standard_phi` |
| Restricted PHI/confidential | legal, credentialing, peer review, ethics, restricted attachment | isolated/tiered storage; `read_restricted_phi` plus clearance |

Case Content must be treated as sensitive even when not formally classified as a patient-identifier table. Free text can contain PHI. Therefore Organization User and aggregate NSP paths must never return Case Content.

### 7.2 Minimum necessary

PHI doors should return only the fields required for the caller's purpose. A single `get_all_phi` response is prohibited.

Referral disclosure field lists and investigation PHI approval should support at least:

- patient name;
- MRN;
- date of birth or age, not necessarily both;
- sex;
- encounter reference;
- unit;
- attending professional.

The product should provide disclosure profiles such as `identity_minimum`, `encounter_context`, and `full_standard_identity`, backed by a constrained field vocabulary. The database remains authoritative even if the UI uses profiles.

### 7.3 Restricted PHI

Restricted PHI is never inherited solely from:

- Organization User status;
- hospital administration;
- Committee membership;
- Committee Coordinator status;
- ordinary Case read or write;
- Meeting Participation;
- NSP membership;
- Referral metadata access.

Every restricted read requires an explicit clearance source and is audited.

---

## 8. Audit and lifecycle requirements

### 8.1 Audit events

At minimum record:

- `case_access.granted`, `.changed`, `.revoked`, `.expired`;
- `case.break_glass_opened` and `.break_glass_closed`;
- `nsp_investigation.opened`, `.assigned`, `.unassigned`, `.closed`, `.expired`;
- `case_patient.read` or equivalent field-scoped PHI read;
- `attachment.read` for PHI and restricted tiers;
- `referral_phi.approved`, `.transmitted`, `.read`, `.amended`, `.revoked`, `.disposed`;
- Meeting access changes and restricted Meeting attachment reads;
- membership appointment, change, revocation, and expiry.

Audit metadata may contain IDs, scopes, capability names, reason codes, and timestamps. It must not contain patient names, MRNs, narrative bodies, attachment titles that may contain PHI, disclosure payloads, or free-text purpose notes.

### 8.2 Deactivation and suspension

Deactivation is an outer authorization gate, not a membership-only condition.

Every predicate that can yield data or permit mutation must fail when `app.is_active(p_user_id)` is false, including:

- direct Case grants;
- phase and narrative assignments;
- NSP Investigation assignments;
- Referral analyst access;
- Meeting Participation;
- attachment access;
- action-item assignment;
- role membership.

The deactivation workflow must also revoke or terminate sessions. Database denial must not rely on token expiry or middleware redirection.

### 8.3 Expiry and revocation

Authorization checks must evaluate timestamps in-query. A cleanup job is not the security boundary.

Use `revoked_at is null` and `starts_at <= now()` and `(expires_at is null or expires_at > now())` consistently. Prefer soft revocation for authority records so historical evidence survives.

Break-glass grants require:

- a reason code and note;
- a short maximum duration set by policy;
- immediate notification to the owning Committee Coordinator and appropriate security/audit channel;
- no `manage_case_access` or Restricted PHI unless independently approved;
- post-event review.

---

## 9. Application behavior contract

The UI must consume database capabilities; it must not reconstruct role logic.

Case detail loaders should receive a capability object such as:

```ts
type CaseCapabilities = {
  viewOverview: boolean
  readContent: boolean
  writeContent: boolean
  readStandardPhi: boolean
  readRestrictedPhi: boolean
  manageAccess: boolean
  sources: Array<'committee_coordinator' | 'case_assignment' | 'manual_grant' | 'nsp_investigation' | 'referral' | 'break_glass'>
  expiresAt: string | null
}
```

`sources` is safe authorization metadata and helps the UI explain why access exists. It is not authoritative for later mutations; every mutation rechecks the database.

Required product behavior:

- Organization dashboards never fetch full Case rows and filter them in JavaScript;
- NSP dashboards use PHI-free hospital aggregate doors;
- a user opening PHI performs an intentional action rather than receiving it in the initial Case payload;
- restricted attachments show their classification without revealing sensitive titles to unauthorized users;
- Meeting pages omit unauthorized Case sections instead of leaking labels or counts through errors;
- access-management screens show grant source, capabilities, reason, grantor, expiry, and revocation state;
- expired/inactive access is visibly historical but cannot be reactivated without a new authorized grant;
- Referral creation defaults to no PHI disclosure.

---

## 10. Migration plan

Implement as a staged structural program. Do not combine all changes into one unreviewable migration.

### Stage A — Capability spine and active-account closure

1. Add the capability vocabulary and `app.case_capabilities`/wrapper.
2. Add an outer `app.is_active` denial to every direct grant/assignment/referral/attachment predicate.
3. Remove `is_commission_admin_of` from Case Content and attachment authorization.
4. Preserve current Committee Coordinator, assignment, and existing Case grant behavior through the new resolver.
5. Add database truth-table tests before repointing policies.

Exit criterion: current authorized clinical users retain intended access; inactive and Organization Users cannot read Case Content.

### Stage B — Granular Case Access Grants

1. Create `case_access_grants` with explicit capabilities.
2. Migrate existing `case_access.level='read'` to `read_case_content=true` only.
3. Migrate `level='write'` to `read_case_content=true, write_case_content=true` only.
4. Do **not** infer PHI clearance from existing read/write grants; require a product decision or new grant.
5. Replace grant/list/revoke RPCs while preserving or deliberately versioning application contracts.
6. Remove direct write privileges and old policies.

Exit criterion: read/write/PHI/access-management are independently grantable and tested.

### Stage C — Meeting boundary

1. Repoint Meeting content reads from Committee membership to Coordinator or Meeting Participation.
2. Gate `meeting_cases` and all Case-specific Meeting fields through both Meeting and Case authority.
3. Repoint Meeting attachments through sensitivity-aware attachment authorization.
4. Review existing general minutes for Case/PHI duplication before enabling the tighter UI.

Exit criterion: an unrelated Committee Member cannot infer or read a restricted Case through any Meeting table or object.

### Stage D — NSP Investigation model

1. Add investigation and assignment tables with composite hospital/Case integrity.
2. Add audited coordinator-only lifecycle RPCs.
3. Build PHI-free hospital Case Overview and indicator doors.
4. Remove the referral-touched NSP arms from `can_read_case` and patient reads.
5. Add notifications to the owning Committee Coordinator.

Exit criterion: NSP sees all required macro information without Case Content; detailed access exists only through active investigations.

### Stage E — Attachment sensitivity enforcement

1. Rework `can_read_attachment` to receive the attachment ID or sensitivity fields, not only owner type/id.
2. Enforce the classification mapping.
3. Add label-specific clearances where required.
4. Ensure signed URLs can be produced only after the audited authorization door succeeds.

Exit criterion: ordinary Case access cannot open Restricted PHI.

### Stage F — Referral disclosure

1. Add disclosure governance and immutable/versioned snapshot model.
2. Replace direct patient-snapshot writers.
3. Separate Referral metadata, content, response write, disclosure management, and snapshot amendment predicates.
4. Default all Referral flows to PHI-free.
5. Migrate existing Referral patient rows only after assigning an explicit legacy disclosure provenance.

Exit criterion: receiving users cannot browse source Cases or overwrite transmitted identity; every PHI disclosure has purpose, approver, fields, recipient, and audit evidence.

### Stage G — Cleanup

1. Remove superseded predicates and old table/functions.
2. Regenerate Supabase types.
3. Update architecture/ADR references and the UI vocabulary.
4. Run security and performance advisors against the local database.
5. Run full pgTAP, integration, and E2E gates.

No shared or remote database migration is authorized by this handoff. Remote rollout requires separate user approval.

---

## 11. Regression-test matrix

Every row must be exercised as `authenticated` through real RLS/RPC privileges, not only by calling helpers as `postgres`.

### 11.1 Case tests

| Persona/scenario | Overview | Content | Write | Standard PHI | Restricted PHI |
|---|---:|---:|---:|---:|---:|
| Organization User, correct org | aggregate only | deny | deny | deny | deny |
| Hospital admin, correct hospital | aggregate only | deny | deny | deny | deny |
| NSP Coordinator, no investigation | aggregate only | deny | deny | deny | deny |
| NSP Coordinator, active investigation without PHI | allow | allow | configured | deny | deny |
| NSP Coordinator, active investigation with Standard PHI | allow | allow | configured | allow | deny |
| NSP Member, not assigned | aggregate only | deny | deny | deny | deny |
| NSP Member, active assigned investigation | allow | allow | configured | configured | configured |
| Committee Coordinator, own Committee | allow | allow | allow | allow | configured |
| Committee Coordinator, foreign Committee | deny | deny | deny | deny | deny |
| Committee Member, unrelated | deny | deny | deny | deny | deny |
| Committee Member, phase assignment | allow | allow | assigned-work only | deny unless granted | deny |
| Committee Member, manual read grant | allow | allow | deny | grant-specific | grant-specific |
| Committee Member, manual write grant | allow | allow | allow | grant-specific | grant-specific |
| Any persona, expired grant | deny unless another source | deny unless another source | deny | deny | deny |
| Any persona, revoked grant | deny unless another source | deny unless another source | deny | deny | deny |
| Any persona, inactive/suspended | deny | deny | deny | deny | deny |

Also test multiple simultaneous sources: revoking one source must not remove another valid source, while deactivation denies all sources.

### 11.2 Meeting tests

- unrelated Committee Member cannot read agenda, minutes, case links, or attachments;
- invited attendee reads general Meeting content;
- attendee without Case access cannot read the linked Case summary/decision;
- Case reader without Meeting Participation cannot read the Meeting;
- Committee Coordinator reads/manages own Committee Meeting;
- Organization User reads only approved metadata/aggregates;
- NSP assignee reads an investigation-linked Meeting only when invited or explicitly linked;
- Standard-PHI and Restricted-PHI attachment tiers enforce different clearance;
- inactive attendee reads nothing.

### 11.3 Referral tests

- Referral metadata works with no PHI disclosure;
- metadata reader sees no PHI bodies, patient fields, sensitive file path, or sensitive title;
- source Coordinator approves only constrained fields;
- target reader sees snapshot fields and cannot query source patient identifiers;
- target analyst cannot overwrite snapshot identity;
- amendment preserves the old version and provenance;
- expiry/revoke blocks future PHI reads;
- source and target hospital isolation holds for multi-hospital organization users;
- NSP role alone does not reveal Referral PHI;
- every disclosure/read/amend/revoke emits PHI-free audit metadata.

### 11.4 Grant-door tests

- no direct authenticated INSERT/UPDATE/DELETE on access, investigation, disclosure, or clearance tables;
- Committee Member cannot grant themselves access;
- Committee Coordinator can grant only users eligible for their Committee/hospital/organization rules;
- NSP Member cannot self-assign or expand capabilities;
- write implies read; Restricted PHI implies Standard PHI;
- expired timestamp and invalid scope shapes are rejected;
- grantor cannot grant capabilities they are not allowed to delegate;
- every write door has PUBLIC execute revoked and explicit authenticated grant where intended.

---

## 12. Performance requirements

- Index every foreign key and every column used in RLS predicates.
- Use `(select auth.uid())` in policies and stable wrappers where the result is statement-constant.
- Prefer one capability computation per statement; avoid repeated row-correlated joins where a set-based lookup works.
- Ensure Case list queries include the same tenant/user filters as the policy so the planner can use indexes.
- Keep Organization and NSP macro endpoints aggregate-first and paginated where they return rows.
- Measure `EXPLAIN (ANALYZE, BUFFERS)` for Case board, Case detail, Meeting detail, attachment listing, and Referral inbox with representative multi-hospital volumes.
- Consider a short-lived request-local capability cache at the application layer only after database correctness; never cache beyond grant/role freshness requirements.

Suggested indexes, finalized against the actual migration schema:

- active `case_access_grants(case_id, principal_id)`;
- active `case_access_grants(principal_id, expires_at)`;
- `nsp_case_investigations(hospital_id, status, expires_at)`;
- `nsp_case_investigations(case_id, status)`;
- active `nsp_investigation_assignments(principal_id, expires_at)`;
- `meeting_attendees(user_id, meeting_id)`;
- `meeting_cases(case_id, meeting_id)`;
- `referral_phi_disclosures(referral_id)` and active expiry/revocation lookup;
- attachment owner and sensitivity lookup aligned with `can_read_attachment`.

---

## 13. Decisions that must not be weakened during implementation

1. Organization/hospital administration does not grant Case Content or PHI.
2. NSP macro visibility is PHI-free and hospital-scoped.
3. NSP detailed access requires an active, purpose-bound investigation.
4. Committee Coordinator authority is Committee-scoped, not organization-wide.
5. Committee Member access requires involvement or an explicit grant.
6. Standard PHI is separate from ordinary Case Content.
7. Restricted PHI requires an additional explicit clearance, including for Committee Coordinators.
8. Meeting Participation never bypasses linked Case authorization.
9. Referral PHI is an immutable/versioned disclosure snapshot, not live source-Case access.
10. Read authority never implies PHI write authority.
11. Deactivation is checked in every authorization path.
12. Service role performs narrowly authorized server operations; it is never the business authorization authority.
13. No PHI is written to audit metadata, notifications, URLs, list payloads, or aggregate views.
14. RLS, grants, RPC execution privileges, Storage policies, and server actions are reviewed independently.

---

## 14. Acceptance criteria

The redesign is complete only when:

- the five user categories produce the exact capability matrix in Section 4;
- Organization Users can perform all required administration without reading Case Content or PHI;
- NSP users have complete hospital macro visibility without blanket Case/PHI access;
- Committee Members cannot discover unrelated Cases through Cases, Meetings, attachments, Referrals, search, counts, errors, or exports;
- Case read, Case write, Standard PHI, Restricted PHI, and access administration are independently enforceable;
- Meeting-linked Case material requires both Meeting and Case authority;
- every Referral PHI disclosure is explicit, field-bounded, purpose-bound, recipient-bound, expiring/revocable, immutable/versioned, and audited;
- inactive/suspended users receive zero protected data even with an otherwise valid JWT and surviving assignments/grants;
- all authority-changing tables are RPC-only for authenticated users and fully audited;
- all exposed tables have explicit privileges and RLS from creation;
- PHI and Restricted PHI attachment opens pass through audited signed-URL doors;
- the full negative authorization matrix is green under the authenticated database role;
- no production/shared database was touched without explicit deployment approval.

---

## 15. Handoff starting point

The next implementer should begin with **Stage A only** and produce a migration contract before SQL changes. The first contract must inventory every current call site of:

- `app.can_read_case`;
- `app.can_read_case_patient`;
- `app.can_write_case_content`;
- `app.is_commission_admin_of*` where used on clinical tables;
- `app.can_read_attachment`;
- `app.can_read_referral_phi`;
- Meeting and `meeting_cases` SELECT policies;
- patient-identifier read/write doors;
- Storage object policies and signed-URL actions.

For each call site, classify the required replacement capability and identify whether the path is base-table RLS, a public RPC, an `app` helper, Storage RLS, or a server-side service-role operation. No policy should be mechanically renamed without this classification.

Stage A is the security seam on which all later stages depend. Do not build the NSP Investigation, Referral disclosure, or attachment-clearance layers on top of the current single-boolean Case access model.


# GLOSSARY
Hospital Committee Platform

This context describes the people, institutional scopes, clinical work, and sensitive-information boundaries managed by the platform.

## Language

**Organization User**:
An organization- or hospital-level administrator whose authority is administrative and analytical, not clinical case authority.
_Avoid_: Organization member, super user, global administrator

**NSP Coordinator**:
The hospital-scoped leader of the Nucleo de Seguranca do Paciente, responsible for patient-safety oversight and assigning investigations.
_Avoid_: QPS coordinator, organization NSP coordinator

**NSP Member**:
A hospital-scoped patient-safety professional who receives detailed case access through an assigned investigation.
_Avoid_: NPS member, PQS member, global NSP member

**Committee Coordinator**:
A committee-scoped clinical leader with responsibility for every Case owned by that Committee.
_Avoid_: Committee admin, staff administrator

**Committee Member**:
A committee participant who receives Case access through direct involvement or an explicit grant.
_Avoid_: Staff, ordinary member

**Case Overview**:
The PHI-free operational description of a Case, limited to identifiers and attributes safe for boards, workload views, and indicators.
_Avoid_: Case metadata, macro Case

**Case Content**:
The substantive clinical or deliberative record of a Case, excluding separately protected patient identifiers and Restricted PHI.
_Avoid_: Full Case, Case details

**Standard PHI**:
Patient information necessary for an authorized user to identify or analyze the subject of a Case.
_Avoid_: Patient data, normal PHI

**Restricted PHI**:
PHI or confidential material whose sensitivity requires an explicit clearance beyond ordinary Case participation.
_Avoid_: Special PHI, secret document

**Case Access Grant**:
A time-bounded authorization that gives a person specified Case capabilities for a recorded purpose.
_Avoid_: Case permission, ACL row

**NSP Investigation**:
A hospital patient-safety activity that authorizes designated NSP personnel to examine a particular Case for a recorded purpose and period.
_Avoid_: NSP Case, macro access

**Referral**:
A request from one Committee to another to evaluate a defined question without transferring ownership of the source Case.
_Avoid_: Case transfer, shared Case

**PHI Disclosure**:
An approved, minimum-necessary, immutable snapshot of PHI transmitted to a specific Referral recipient for a stated purpose.
_Avoid_: PHI sharing, patient copy

**Meeting Participation**:
The relationship that permits a person to read the general materials of a Meeting; it does not independently authorize linked Case content.
_Avoid_: Meeting membership, Meeting access
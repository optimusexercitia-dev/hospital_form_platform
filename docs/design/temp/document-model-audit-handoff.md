# Document model and storage substrate external-audit handoff (2026-08-11)

> **⛔ NOT ephemeral resume-state — DO NOT SWEEP.** This is a **durable design/audit
> record** (2 inbound links, incl. ADR 0114), named "handoff" before the convention
> existed. Under the handoff convention
> ([.claude/skills/handoff/SKILL.md](../../../.claude/skills/handoff/SKILL.md)),
> ephemeral resume-state lives in `docs/handoffs/`, may not be cited, and is deleted at
> its branch's Record step — none of which applies to this file. Classified 2026-08-26.

> **Purpose.** Self-contained continuation note for the external audit of uploaded
> documents, centralized attachments, Supabase Storage access, PHI classification,
> document sharing, and future document-heavy features. It records the verified
> live-catalog evidence, release-blocking findings, recommended target model, and a
> phased implementation plan that another lead and agent team can execute without
> re-deriving the audit.
>
> **Status.** Analysis and proposed design only. The target architecture has **not**
> been approved, no implementation phase has been authorized, and no ADR has been
> created. This audit made no schema, database-row, Storage-object, application,
> seed, test, or phase-status changes.

## TL;DR

Do **not** keep extending `public.attachments(owner_type, owner_id)` into the
platform-wide document system. It is a reasonable minimal attachment substrate,
but its interface assumes one authorizing parent and inherited domain access. The
platform now needs a different aggregate: a logical document with immutable
versions and physical file objects, linked to domain resources and governed by a
document access policy that can address a user, an explicit group, or a scoped
role.

The current implementation also has two release-blocking authorization/lifecycle
defects that must be corrected before the centralized attachments feature is
enabled in production:

1. A confidential standard-tier object can be denied by attachment metadata
   authorization while remaining readable through the direct
   `storage.objects` policy.
2. `dispose_attachment_phi` leaves the PHI object in Storage and
   `open_attachment` does not reject `phi_disposed_at`, so the disposed object can
   still be re-opened and signed.

The recommended end state is a deep **Document module** with one small interface
for upload, finalize, classify, version, share, open, hold, and dispose. Domain
features remain responsible for their own workflows—controlled-document approval,
referral replies, RCA evidence, meeting minutes—but use adapters at this seam
instead of owning Storage paths, buckets, policies, signing, scan status, and PHI
disposal independently.

Implementation should be incremental:

1. Ratify the design and inventory the production catalog/objects.
2. Correct the current release blockers without widening scope.
3. Add the new document/resource/access foundation behind feature flags.
4. Migrate centralized attachments through compatibility adapters.
5. Move controlled documents, referrals, NSP evidence, printed renditions, and
   meeting audio in separately gated waves.
6. Retire legacy paths, policies, and buckets only after verified zero-reference
   and zero-object closure.

## 1. Audit boundary and method

### 1.1 Environment inspected

The audit was performed read-only against the running local Supabase stack on
2026-08-11:

- repository commit: `c8a3b21`;
- PostgreSQL: **17.6**;
- database: local `postgres` in container
  `supabase_db_azkbbhskturikxpgmafq`;
- current local feature values: `attachments = true`,
  `controlled_docs = true` (seed state, not evidence of production state);
- current source worktree already contained unrelated untracked user files; none
  were altered.

**Important limitation:** row counts, bucket contents, flag values, and consistency
results below describe the local seeded stack, not production. Production must be
queried independently before migration sizing, cutover, or any statement that a
feature is inert/live outside local development.

### 1.2 Authoritative evidence

Per [AGENTS.md](../../AGENTS.md), migration text was not treated as current schema
truth. The audit used the live catalog and behavior directly:

- `pg_class`, `pg_constraint`, `pg_index` / `pg_indexes`;
- `pg_policy` / `pg_policies`;
- relation and routine ACLs;
- `pg_trigger`;
- `pg_proc`, including `prosecdef`, routine ACLs, and live
  `pg_get_functiondef()` bodies;
- `storage.buckets` and `storage.objects`;
- read-only authorization probes over live seeded principals/resources;
- live metadata-to-object reconciliation queries.

The audit also read:

- [ARCHITECTURE.md](../../ARCHITECTURE.md), especially Rules 1, 6, 11, and 12;
- [ADR 0063 — centralized attachments substrate](../decisions/0063-centralized-attachments-substrate.md);
- [ADR 0065 — pre-pilot foundation conventions](../decisions/0065-pre-pilot-foundations-conventions.md);
- [ADR 0081 — controlled-document redesign](../decisions/0081-controlled-document-redesign.md);
- [controlled-document redesign plan](../plans/document-control-redesign.md);
- [authorization handoff §7](authz-handoff.md#7--the-lessons);
- [backend capability map](../backend-state.md).

### 1.3 Supabase operational facts that constrain the design

Supabase Storage keeps file metadata in PostgreSQL but stores the actual objects in
an external object store. Supabase documents `storage` metadata as read-only for
application design and requires file mutation through the Storage API. Therefore a
PostgreSQL transaction cannot make object creation, movement, or deletion atomic
with business metadata:
[Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design).

Object ownership is descriptive and does not itself grant or deny access:
[Supabase Storage ownership](https://supabase.com/docs/guides/storage/security/ownership).

Private objects are read through an authenticated request governed by
`storage.objects` RLS or through a signed URL. Supabase signed URLs remain valid
until expiry and are not normally individually revocable, so sensitive URLs must
be short-lived and the system must not confuse URL issuance with durable access:
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and
[serving assets](https://supabase.com/docs/guides/storage/serving/downloads).

## 2. Ubiquitous language for the redesign

These terms are deliberately distinct. Future plans, ADRs, tables, TypeScript
types, UI copy, and tests should not use them interchangeably.

| Term | Canonical meaning |
| --- | --- |
| **Document** | The logical governed record people recognize over time. It owns title, policy, lifecycle, tenant anchors, and versions, but not raw object-store coordinates. |
| **Document version** | An immutable revision of a document. Approval/effectiveness may be domain-specific, but the version identity and content bindings are common. |
| **File object** | One physical immutable object in Supabase Storage, with bucket/path, verified size/hash/MIME, scan state, sensitivity, and disposal state. |
| **Rendition** | A file derived from a version or source, such as a redacted copy, preview, signed PDF, or printed-document PDF. |
| **Resource** | A securable domain entity such as a case, meeting, interview, action item, referral, controlled document, or form response. Resources have real tenant anchors and stable FKs. |
| **Home resource** | The one resource from which a document may inherit its default access. It replaces the attachment model's un-FK'd authorizing owner. |
| **Placement** | A non-authorizing link that makes a document appear on another resource. A placement never silently widens access. |
| **Access policy** | The document's complete sharing rule: inheritance mode plus audience grants and their capabilities/expiry. |
| **Audience** | A resolvable set of users: one user, an explicit group, or users holding a particular role at a specific scope. |
| **Grant** | An access-policy entry giving an audience a named capability for an optional time window. |
| **Sensitivity** | Whether the actual file contains patient PHI or standard/non-PHI content. It controls physical segregation and the minimum read posture. |
| **Confidentiality label** | A semantic regime such as legal privilege, credentialing-sensitive, peer review, or non-PHI internal. It is independent of physical PHI tier. |
| **Upload session** | Durable orchestration state connecting a reserved file-object row to an object upload, verification, and scanning workflow. |
| **Retention policy** | The rule determining minimum retention and eligible disposition date. |
| **Legal hold** | A separately auditable prohibition on disposition, with issuer, reason category, and lifecycle. |
| **Disposition** | The governed process that makes content inaccessible, deletes physical bytes when legally allowed, verifies deletion, and retains only permitted governance metadata. |

The UI may still use *anexo* when a document is placed on a case or meeting. In the
domain model, **attachment is a relationship/placement, not a physical file type**.

## 3. Verified current-state catalog snapshot

### 3.1 Buckets and Storage policy surface

Eleven private buckets exist:

```text
attachments
attachments-phi
case-documents
controlled-documents
form-assets
interview-attachments
meeting-attachments
meeting-audio
nsp-evidence
printed-documents
referral-attachments
```

The live `storage.objects` table has **16 policies**. At least seven are
attachment-named and three document-named. Several legacy bucket policies remain
after the centralized attachment fold-in, while newer features such as referrals
and controlled documents still own independent bucket policies.

The relevant central policies are:

- standard attachment INSERT: path-derived owner type/id plus
  `app.can_write_attachment`;
- PHI attachment INSERT: the same predicate in `attachments-phi`;
- standard attachment SELECT: path-derived owner type/id plus
  `app.can_read_attachment`, with an additional case-deliberation capability for
  case/interview objects;
- **no authenticated SELECT policy on `attachments-phi`**; PHI bytes are intended
  to be served by the audited `open_attachment` door.

### 3.2 Central attachment schema

`public.attachments` has 26 columns and combines four concerns:

1. placement/ownership: `owner_type`, `owner_id`;
2. logical document metadata: `kind`, `title`, `description`, `occurred_on`,
   `document_group_id`, `supersedes_id`;
3. physical file metadata: `storage_bucket`, `storage_path`, `mime_type`,
   `size_bytes`, `sha256`;
4. governance/security lifecycle: `sensitivity_tier`,
   `confidentiality_label`, `scan_status`, `legal_hold`, disposal stamps,
   soft-delete stamps, uploader/timestamps.

Allowed owner types are:

```text
case, meeting, interview, action_item, form_upload
```

`form_upload` is reserved-inert. The authorizing owner has no FK. Authorization is
dispatched through `SECURITY DEFINER` functions:

- `app.commission_of_attachment`;
- `app.can_read_attachment`;
- `app.can_write_attachment`;
- `app.attachment_confidentiality_ok`.

`action_item` is accepted by the live schema/dispatchers but has no attachment
query, action, panel, or E2E product flow; it is substrate-only today. That is
important when distinguishing implemented reachability from planned owner types.

`attachment_references` and `attachment_subjects` have parent-following SELECT
RLS and authenticated SELECT grants, but no authenticated DML and no live function
body that writes either table. They are currently inert scaffolding.

The metadata and byte-read sets are not identical. The live `attachments_select`
policy calls `can_read_attachment` plus `attachment_confidentiality_ok`, while the
case/interview byte doors also require `read_case_deliberation`. A catalog-driven
matrix found **10 seeded (case, principal) pairs** for which attachment metadata is
readable but `read_case_deliberation` is false. This matters because the live column
comments explicitly classify `attachments.title` and `attachments.description` as
PHI-bearing. The current comment calls the title member-readable by design, but that
is a policy choice—not PHI minimization proved by the access model.

The current Supabase advisors add supporting—not decisive—evidence. They flag
per-row `auth.uid()` initialization-plan overhead on the three central attachment
SELECT policies; missing supporting indexes on six attachment-related FKs
(`supersedes_id`, actor FKs, and subject/reference FKs); and seven
attachment-named authenticated-executable `SECURITY DEFINER` commands. The commands
are intended public interfaces and therefore require behavioral authorization
tests rather than automatic revocation. “Unused index” notices were ignored for
design decisions because the local Storage/attachment population is too small and
synthetic to establish production usefulness.

### 3.3 Current local row/object counts

| Relation/state | Local count |
| --- | ---: |
| `attachments` | 4 |
| live PHI attachment rows | 2 |
| live standard attachment rows | 2 |
| attachment rows with `scan_status='skipped'` | 4 |
| matching `storage.objects` rows | 0 |
| dangling attachment metadata rows | 4 |
| `attachment_references` | 0 |
| `attachment_subjects` | 0 |
| `controlled_documents` | 3 |
| `controlled_document_versions` | 3 |
| controlled versions with a file path | 0 |
| `document_approvals` | 4 |
| printed documents | 0 |
| one or more remaining non-central path rows | 1 aggregate legacy/frozen path row |

The empty local Storage catalog may be a seed/test artifact rather than a product
failure. It nevertheless means the current test environment does not prove the
metadata/object integrity expected by production.

### 3.4 Parallel document-bearing surfaces

The live public schema still contains independent physical path columns in at
least these surfaces:

- `attachments.storage_bucket` + `storage_path`;
- `controlled_document_versions.storage_path`;
- `capa_action_evidence.storage_path`;
- `rca_evidence.storage_path`;
- `referral_reply_attachment.storage_path`;
- `referral_shared_item.frozen_storage_path`;
- `meeting_minutes_jobs.audio_path`;
- `printed_documents.storage_path`;
- form-image paths embedded in `form_items.content` JSON.

Sensitivity is represented differently across them:

- attachments: `sensitivity_tier` plus `confidentiality_label`;
- printed documents: `contains_phi boolean` plus a path prefix;
- controlled documents: no sensitivity field and a design assumption of no PHI;
- referral/NSP paths: module/bucket-level assumption;
- meeting audio: processing-specific table and bucket;
- form assets: assumed non-PHI immutable UI assets.

## 4. Detailed audit findings

Severity here describes the design/runtime risk if the affected feature is
reachable. Because production was not inspected, it does not claim current
production exploitability.

### F-01 — standard-bucket confidentiality bypass

**Severity:** release blocker before enabling centralized attachments.

**Verified mechanism:**

- `attachments_select` requires both
  `app.can_read_attachment(...)` and
  `app.attachment_confidentiality_ok(...)`.
- `open_attachment` repeats both checks.
- `attachments_obj_select_readable` on `storage.objects` checks owner-level
  `app.can_read_attachment(...)` and, for case/interview, the case-deliberation
  capability. It does **not** resolve the attachment row and does not call
  `attachment_confidentiality_ok`.
- Standard objects are authorized from path folders, not registered attachment
  metadata.

A read-only live probe selected a seeded meeting and a valid staff-admin principal:

```text
owner_read  = true
owner_write = true
labeled_read(legal_privileged) = false
```

The metadata/open door would deny the labeled document, while the Storage policy's
owner predicate would grant the same principal. Because the SELECT policy also
governs listing, an owner-level reader can potentially discover and read an object
before or without a corresponding attachment row.

The same disconnect defeats soft deletion for standard objects: setting
`attachments.deleted_at` hides the row from the application query, but the
path-derived Storage SELECT policy never consults that row or lifecycle state. A
reader who retained the path can continue requesting the object while the owner
predicate remains true.

**Contributing shape:** `create_attachment` escalates only `phi_standard` and
`phi_restricted` to the PHI bucket. Labels such as `legal_privileged` and
`credentialing_sensitive` can remain physically standard depending on owner
defaults/input. The standard bucket therefore cannot be authorized solely from the
owner path.

**Required correction:** remove direct authenticated standard-object SELECT, or
make the policy join a unique registered file-object row and delegate to exactly
the same effective document predicate. The recommended target is one open door for
all protected document bytes, with short-lived signing performed only after the
document/file row passes authorization.

### F-02 — disposed PHI remains openable

**Severity:** release blocker / Rule-12 lifecycle defect.

`dispose_attachment_phi`:

- rejects legal hold and double disposition;
- redacts `title` and `description`;
- stamps `phi_disposed_at`, `_by`, and `_reason`;
- writes audit events;
- **does not delete the Storage object**;
- **does not mark the attachment soft-deleted**.

`open_attachment` checks not-found, `deleted_at`, `scan_status='infected'`, owner
access, case capability, and confidentiality. It does **not** check
`phi_disposed_at`. For an existing blob it can return the original PHI
bucket/path after disposition and the server layer can sign it.

This is more than a naming concern: the current disposition command neither erases
bytes nor makes them inaccessible through the authoritative open door.

The surrounding governance is also incomplete. Any principal satisfying
`can_write_attachment` can invoke disposition; the command does not enforce a
retention-age threshold, no product command currently places or releases
`legal_hold`, and soft deletion does not honor the hold flag. In the inspected local
catalog the two PHI attachment rows had no corresponding Storage objects, so this
finding does not demonstrate a locally reachable blob. Production object state and
previously issued one-hour signed URLs still require an explicit census.

**Required correction:** immediately make any disposal-pending/disposed state
non-openable. Replace metadata-only disposal with a durable job:

1. authorize and stamp `disposal_pending`;
2. make reads fail closed;
3. delete through the Storage API when retention/hold allows;
4. verify object absence;
5. stamp `disposed` with permitted non-PHI governance metadata;
6. retry idempotently on external failure.

The exact CFM/ANVISA/LGPD retention/disposition rules require clinical/legal owner
approval; this handoff does not make that legal decision.

### F-03 — reclassification can detach metadata from bytes

**Severity:** high.

`reclassify_attachment` changes `sensitivity_tier`, `storage_bucket`, and label in
PostgreSQL under an immutability bypass bracket. It does not:

- move/copy the object;
- verify the destination object exists;
- verify destination size/hash;
- retain an explicit transition state;
- clean up the old object.

The exported `reclassifyAttachment` server action documents a required
`copy → RPC repoint → remove source` sequence but currently calls only the RPC; no
copy, verification, or source removal is implemented. It has no current product
caller, so the defect is latent, but direct invocation would detach metadata from
bytes deterministically—not only during a rare crash. Even after orchestration is
added, the two systems cannot share a transaction; timeout, retry, and partial
failure states must be modeled explicitly (`src/lib/attachments/actions.ts:202`).

**Required correction:** classification that changes physical tier must create or
promote a new file-object generation through a copy/verify/commit workflow. The old
object remains inaccessible and recoverable until the new binding is committed,
then is disposed according to policy.

### F-04 — metadata/object identity is not enforced

**Severity:** high.

The central table has no `UNIQUE(storage_bucket, storage_path)`. Multiple attachment
rows can therefore describe the same object. Conversely, object existence is
checked only when `create_attachment` runs; no durable reconciler maintains the
relationship afterward.

The create command also accepts `mime_type`, `size_bytes`, and optional `sha256`
from its caller. It verifies only that an object exists at the selected bucket/path;
it does not derive or compare those values with provider metadata or a trusted
server-side hash. In the local rows, size is missing on two of four attachments and
all four hashes are null. These columns cannot currently be treated as verified
integrity evidence.

Controlled documents are weaker: `set_document_version_file` accepts a caller path
and updates the version without verifying:

- the object exists;
- the path belongs to the expected commission/document/version;
- the path has not already been bound elsewhere;
- MIME, size, or hash;
- scan/classification state.

The local snapshot's four attachment rows and zero object rows demonstrate that
drift is possible in the development system even if it is seeded intentionally.

**Required correction:** one file-object row per physical `(bucket, path)`, a
server-generated path, a state machine, verification at finalize, and a scheduled
reconciliation job that reports both missing objects and unregistered objects.

### F-05 — the authorization model cannot express committed sharing requirements

**Severity:** high architectural mismatch.

The only authorizing relationship is the single `(owner_type, owner_id)` pair.
`attachment_references` and `attachment_subjects` are explicitly non-authorizing.
There is no model for:

- one named user only;
- an ad-hoc group;
- all users with role X in one commission/hospital/org;
- an expiring consultant grant;
- metadata-only versus byte-download access;
- sharing without moving the document to another owner;
- a document placed in several modules while retaining one policy.

[ADR 0063](../decisions/0063-centralized-attachments-substrate.md) explicitly
deferred access grants, security groups, resource registry, upload sessions, and a
retention engine because those capabilities were not then required. They are now
part of the stated product direction. The underlying trade-off has changed; this
is not simply a request to add another owner type.

### F-06 — owner-dispatch polymorphism is a scaling seam, not a universal aggregate

**Severity:** high maintainability and correctness risk.

Adding a document-owning feature currently requires coordinated edits to some or
all of:

- `attachments_owner_type_check`;
- `attachment_references_owner_type_check`;
- `commission_of_attachment`;
- `can_read_attachment`;
- `can_write_attachment`;
- `attachment_confidentiality_ok`;
- `create_attachment` kind/default/tier rules;
- both Storage INSERT policies and the standard SELECT policy/path grammar;
- audit authorization dispatch;
- disposal composition;
- TypeScript owner/kind unions, actions, queries, adapters, and tests.

There is no FK from `owner_id` to the claimed parent. Creation indirectly validates
existence by running a permission predicate, but parent deletion and later schema
evolution remain procedural.

This dialect is acceptable for the small closed set ratified by ADR 0065. It is not
the right interface for a platform document library with open-ended placements and
audiences.

The application seam is shallower than the schema name suggests. The generic
`createAttachment` action has no callers; case, meeting, and interview modules each
repeat file-size/MIME validation, path generation, Storage upload, object-first/
row-second failure handling, and the same create RPC. Their accepted MIME sets and
picker hints have already drifted. Centralized reads therefore coexist with
duplicated writes, which is exactly where classification and orphan-handling rules
will diverge as more consumers arrive (`src/lib/attachments/actions.ts:100`,
`src/lib/cases/documents-actions.ts:160`, `src/lib/meetings/actions.ts:914`,
`src/lib/interviews/actions.ts:729`).

### F-07 — document, version, placement, and blob are conflated

**Severity:** high future-model cost.

One `attachments` row is simultaneously:

- the thing shown to users;
- the parent placement;
- the current physical file;
- the security classification;
- a member of an optional version group;
- a retention/disposal record.

`document_group_id` is an unconstrained UUID rather than a logical-document FK.
`supersedes_id` is a self-FK with no same-owner/group rule, no self-reference guard,
no cycle protection, no single-current rule, and no index on the referencing
column. Redacted copies, previews, signed renditions, and multiple source files
cannot be modeled cleanly without adding more semantics to this row.

Controlled documents already prove that logical document and version lifecycle are
real domain concepts; their physical path should reuse a common version/file layer
instead of remaining a separate storage system.

### F-08 — PHI and confidentiality are not platform-wide file invariants

**Severity:** high Rule-12 drift risk.

The platform has several incompatible representations:

- binary tier + semantic label on attachments;
- `contains_phi` on printed PDFs;
- implicit PHI by referral/NSP bucket;
- explicit “PHI none” assumption for controlled documents;
- no common classification/scan/disposal relation for meeting audio.

The central attachment resolver is also not row-classification-aware. Its read
decision is primarily inherited from `owner_type`/`owner_id`; the extra
`read_case_deliberation` byte check applies only to case/interview owners, and
`attachment_confidentiality_ok` currently adds a ceiling only for
`legal_privileged` and `credentialing_sensitive`. A meeting- or action-item-owned
file explicitly classified into the PHI tier therefore inherits the meeting/action
item reader set rather than a uniform patient-PHI clearance rule. Conversely,
case/interview readers without deliberation can still see the PHI-bearing metadata
described in §3.2. Physical segregation is valuable, but it is not a complete
classification-to-authority mapping.

The seeded authorization matrix makes the problem concrete. Across 21 active
principal/attachment combinations, all 21 passed `standard`, `phi`,
`peer_review_confidential`, and `ethics_investigation`; only one passed
`legal_privileged`, and none passed `credentialing_sensitive`. One ordinary staff
persona could read both seeded PHI attachment metadata rows while
`can_read_case_patient` was false for every case available to that persona. This is
not proof that all those reads are unintended—the owner may legitimately grant some
of them—but it proves that most classification labels are descriptive rather than a
uniform authorization boundary.

The product guidance is inconsistent with the data model as well: case/interview
uploads default to the PHI tier, while their dialogs tell users never to include
patient data. A governance platform cannot rely on contradictory copy as its
classification control; the approved workflow must either prohibit PHI on that
surface or collect/classify it deliberately.

This makes it possible for a future feature to support uploads while omitting one
of: physical segregation, audited reads, legal hold, disposal, scan status,
classification downgrade authority, or minimum-necessary metadata.

**Required correction:** every protected physical file uses the same file-object
contract. Sensitivity is per physical file/version, not inferred only from its
feature. Confidentiality remains an orthogonal semantic policy input.

### F-09 — malware gating currently fails open

**Severity:** high operational security risk once real uploads begin.

All four local attachments are `scan_status='skipped'`. The table default is
`skipped`, and `open_attachment` rejects only `infected`; `pending` and `skipped`
remain downloadable. ADR 0063 deliberately reserved a future tighten-to-clean
transition, but Office/PDF uploads are already accepted.

**Required correction:** default user uploads to `pending`; only `clean` is served.
If trusted generated files need a bypass, use a distinct auditable
`trusted_generated` state set only by a service-owned production path—not the
general upload RPC.

### F-10 — audit behavior is inconsistent with the designed posture

**Severity:** medium/high.

The live `open_attachment` writes `attachment.read` only for PHI. Denials return no
row and emit no denial audit. Standard attachments are directly readable through
Storage and therefore cannot be reliably audited by the database door.

ADR 0063 proposed all-tier and denied-open auditing, but the live implementation
does not provide it. Architecture Rule 11 currently requires every PHI read and
reads of another member's data to be recorded. Multiple serving paths make proving
that closure difficult.

Disposition also produces two mutation-shaped audit rows: the generic attachment
update trigger fires and `dispose_attachment_phi` writes an explicit
`attachment.phi_disposed` event. That conflicts with Rule 11's exactly-one-event
mutation invariant and can distort compliance counts unless the generic event is
suppressed or the operation is modeled as a single compound event.

**Required correction:** define one documented audit contract and make every byte
serving path conform. At minimum: every PHI open, every cross-user protected
document open, disposition, classification change, access-policy change, hold
change, and export. Decide separately whether denied attempts and all standard
downloads belong in the tamper-evident audit log or a higher-volume security log.

### F-11 — current RLS will not support a cross-document library efficiently

**Severity:** medium, architectural risk rather than measured production defect.

`attachments` has no direct organization, hospital, commission, or home-resource
FK. RLS invokes stable `SECURITY DEFINER` owner dispatch for candidate rows, and
each arm performs different domain lookups. Existing owner-filtered pages can use
`(owner_type, owner_id)` indexes and may remain fast. Future queries such as “all
documents I can access,” review/retention queues, legal-hold dashboards, scan
backlogs, and organization-wide search cannot prefilter through a uniform tenant
anchor.

The target model should denormalize immutable tenant/resource anchors onto the
document/file rows with drift guards or composite FKs, and index the actual RLS and
queue predicates. Do not materialize effective permissions before measurement;
first make the authorization relation uniform and explainable.

### F-12 — secondary integrity and indexing gaps

**Severity:** medium/low individually; important during redesign.

- `attachment_subjects` uniqueness includes nullable `role_id`, so PostgreSQL
  permits repeated `(attachment_id, participant_id, NULL)` rows. Use `NULLS NOT
  DISTINCT` if NULL means one unqualified relationship.
- Missing supporting indexes were observed on attachment `supersedes_id`, several
  actor FKs, `controlled_documents.current_version_id`, and version/document
  creator FKs. Not every actor FK needs an index at seed scale, but relationship
  and deletion paths must be reviewed against real queries.
- `scan_status`, disposal state, and legal-hold queues lack purpose-built indexes.
  Add them only with the queue queries and validate through `EXPLAIN`.
- Storage path uniqueness exists on some legacy evidence tables but not on the
  central attachment table, further demonstrating inconsistent physical identity.

### F-13 — bucket-per-feature and policy-per-feature increase drift

**Severity:** medium/high over the roadmap.

Eleven buckets and sixteen Storage policies are manageable today but make every new
upload feature a separate security design. Buckets are being used simultaneously
as:

- file-type grouping;
- feature grouping;
- PHI boundary;
- path grammar;
- authorization entry point.

Legacy policy state illustrates the drift. The empty `meeting-attachments` bucket
still permits direct authenticated insert and select even though the central
attachment model now uses `attachments` / `attachments-phi`. `case-documents` retains
a direct select policy, while `interview-attachments` has no policies. Empty local
buckets reduce the present local blast radius, but they do not make the policy set a
safe long-term contract or establish production emptiness.

Only the physical/security distinctions should normally select a protected
document bucket. Feature ownership and user-visible grouping belong in database
relationships. Public/cacheable immutable UI assets may remain a separate asset
subsystem.

### F-14 — referral snapshot downloads still use a retired serving path

**Severity:** high functional/audit risk; local object reachability is empty and
production reachability is unknown.

The current referral query signs snapshot documents from the legacy
`case-documents` bucket, while the centralized fold-in records case documents in
`attachments` and normally places their bytes in `attachments-phi`. The referral
detail page also prefetches snapshot/reply URLs during render. For fresh centralized
rows this points at the wrong bucket and breaks the download; if legacy objects are
present, it preserves a parallel signer outside the click-time `attachment.read`
door. The local legacy bucket is empty, so this audit does not claim a local PHI
exposure, but the product path and policy remain reachable and require production
census (`src/lib/queries/referrals.ts:855`; referral detail page render at
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx:128`).

**Required correction:** route referral document snapshots through a source-aware
document/attachment identifier and the same audited open command. Do not preserve a
frozen raw path as independent download authority. Add a regression that proves a
fresh centralized PHI snapshot opens from the canonical bucket exactly once and
that the retired bucket path cannot serve it.

## 5. Current strengths to preserve

The redesign should retain and deepen, not discard, these good decisions:

- RLS and PostgreSQL commands are the authorization authority.
- PHI has a physically separate private bucket and no authenticated direct SELECT.
- Physical objects are immutable; replacements use new paths.
- PHI reads are intended to pass through an audited door.
- Clinical domain access predicates already understand custody, assignment,
  recusal, and capability rules.
- Attachment subjects reference the typed participants registry rather than
  storing names.
- Audit payloads exclude PHI and content.
- Controlled-document approval/effective/obsolete lifecycle is domain-specific and
  should not be flattened into a generic attachment status.
- Feature flags and a pre-pilot reset window make additive migration and reversal
  cheaper than after real data accumulates.

## 6. Recommended target architecture

### 6.1 High-level model

```text
securable_resources
├── cases / meetings / interviews / referrals / ... (resource_id FK)
├── documents.home_resource_id
└── document_placements.resource_id

documents
├── document_versions
│   └── document_version_files
│       └── file_objects
├── document_placements
├── access_policy
│   └── access_policy_entries
│       └── audiences
│           ├── user audience
│           ├── group audience ── group_members
│           └── scoped-role audience ── memberships (resolved live)
├── document_retention
└── document_legal_holds

file_objects
├── upload_sessions
├── scan state / scan attempts
├── immutable physical identity
└── disposal jobs / verified disposition
```

### 6.2 Securable resource registry

**Greenfield design:** every domain entity that can own/share documents is backed
by one `securable_resources` row. Domain rows reference it with a real unique FK,
or use a shared-primary-key pattern when created together.

Suggested core columns:

```text
id uuid PK
resource_type text CHECK (code-coupled closed set)
organization_id uuid NOT NULL
hospital_id uuid NULL
commission_id uuid NULL
created_at timestamptz NOT NULL
retired_at timestamptz NULL
UNIQUE (id, resource_type)
```

Tenant shape constraints/composite FKs must prevent an impossible
organization/hospital/commission combination. A domain table's `resource_type`
must be pinned through the same typed-registry technique already used for
participants.

This registry is not an EAV table and holds no domain payload. Its job is to provide
one real join target for document placement and authorization.

### 6.3 Logical documents

Suggested `documents` contract:

```text
id uuid PK
organization_id uuid NOT NULL
hospital_id uuid NULL
commission_id uuid NULL
home_resource_id uuid NOT NULL FK securable_resources
access_policy_id uuid NOT NULL
title text NOT NULL                 -- governed to stay non-PHI where required
description text NULL               -- classification/content policy applies
document_kind text NOT NULL
lifecycle_status text NOT NULL
current_version_id uuid NULL
created_by uuid NOT NULL
created_at / updated_at
soft_deleted_at / by
```

Tenant anchors are deliberate denormalization for RLS/listing performance and must
be protected by composite FKs or drift triggers. `home_resource_id` supplies only
default access inheritance; it does not imply that every placement grants access.

### 6.4 Immutable document versions

Suggested `document_versions` contract:

```text
id uuid PK
document_id uuid NOT NULL FK
version_number integer NOT NULL
version_status text NOT NULL
change_summary_md text NULL
created_by uuid NOT NULL
created_at timestamptz NOT NULL
effective/review/expiry metadata where common
UNIQUE (document_id, version_number)
```

Published/effective/final versions and their source-file bindings are immutable.
Domain-specific satellites hold workflow-specific data:

- controlled-document approvals/effective lifecycle;
- signature records;
- referral snapshot provenance;
- printed/rendition verification credentials.

### 6.5 Physical file objects and renditions

Suggested `file_objects` contract:

```text
id uuid PK
organization_id uuid NOT NULL
storage_bucket text NOT NULL
storage_path text NOT NULL
original_filename text NULL          -- treat as sensitive metadata
mime_type text NOT NULL
size_bytes bigint NOT NULL
sha256 text NOT NULL
sensitivity_tier text NOT NULL       -- phi | standard
confidentiality_label text NULL
upload_state text NOT NULL
scan_status text NOT NULL
scan_engine/version/result timestamps
created_by / created_at
disposal_state / requested / completed / verified fields
UNIQUE (storage_bucket, storage_path)
CHECK (bucket derived from tier)
```

`document_version_files(version_id, file_object_id, rendition_kind, position)`
binds physical files to versions. Useful rendition kinds include `source`,
`redacted`, `preview`, `signed`, and `printed_pdf`. Enforce one primary source per
version with a partial unique index if that is the product rule.

Do not globally deduplicate PHI by hash. Keep the hash for integrity and
reconciliation; cross-tenant/global deduplication introduces deletion, isolation,
and existence-side-channel problems.

### 6.6 Placements

`document_placements(document_id, resource_id, relationship_kind, note, created_by,
created_at)` lets the same document appear as case evidence, meeting material,
referral material, or accreditation evidence.

Default rule: **placements are non-authorizing**. Access comes from the document's
home inheritance plus explicit policy. If the product later needs a placement to
inherit access, make it an explicit constrained `inheritance_mode`, not an implicit
“any readable placement grants the document” OR.

### 6.7 Audiences, groups, and policies

Use a typed audience registry so `document_access_policy_entries` has one real FK
without inventing nullable user/group/role columns on every grant.

Suggested shape:

```text
access_audiences(id, organization_id, audience_type, created_at)
audience_users(audience_id PK/FK, user_id FK/UNIQUE)
security_groups(id, organization_id, name, lifecycle...)
security_group_members(group_id, user_id, valid_from, expires_at, ...)
audience_groups(audience_id PK/FK, group_id FK/UNIQUE)
audience_scoped_roles(
  audience_id PK/FK,
  role_key,
  organization_id,
  hospital_id,
  commission_id,
  exhaustive scope CHECK
)

document_access_policies(id, organization_id, inheritance_mode, ...)
document_access_policy_entries(
  policy_id,
  audience_id,
  capability,
  valid_from,
  expires_at,
  granted_by,
  granted_at,
  UNIQUE (...)
)
```

Initial capabilities should be code-coupled and small:

```text
discover
read_metadata
download
upload_version
share
manage
dispose
```

The effective resolver must have one explicit evaluation order:

1. reject inactive principals, tenant mismatch, disposed/non-clean files, and hard
   domain exclusions such as case recusal;
2. enforce the file/document sensitivity floor (patient-PHI authority) and semantic
   confidentiality ceiling;
3. resolve home-resource inheritance and explicit user/group/scoped-role grants;
4. require the requested capability (`discover`, metadata, download, share, etc.);
5. audit the product-called open outcome before any privileged signer is used.

Positive grants must never outvote steps 1–2. Metadata projections must be
classification-aware: either titles/descriptions are contractually PHI-free, or
`discover` returns only a neutral shell and `read_metadata` carries the same
minimum-necessary restrictions as protected bytes.

Role audiences resolve against effective `memberships` at read time so membership
revocation/expiry changes document access immediately. Group membership is a
separate authorization plane and must have one audited write door.

Recommended initial inheritance modes:

- `home_resource`: home-resource access only;
- `home_plus_explicit`: home access plus explicit grants;
- `explicit_only`: only listed audiences—supports one-user/private documents.

Avoid a general DENY rule initially. Existing hard exclusions such as recusal and
deactivation must run before positive access. If document-specific deny becomes a
real requirement, specify deny-wins semantics in a separate ADR and mutation-test
every positive sibling.

### 6.8 Retention and holds

A boolean `legal_hold` is insufficient for a governance platform. Model:

- retention policy/category;
- retention trigger event/date;
- calculated `retain_until`;
- legal-hold records with issuer, constrained reason category, issued/released
  timestamps, and audit;
- disposition request/job state;
- object deletion verification;
- retained governance metadata after content disposition.

The module must make `disposal_pending` and `disposed` non-openable before attempting
external deletion.

### 6.9 Storage topology and object paths

Recommended protected-document buckets:

```text
documents-standard
documents-phi
```

Both are private. The bucket is derived from sensitivity and never accepted as a
free caller choice. Paths are generated server-side from non-sensitive identifiers,
for example:

```text
{organization_id}/{file_object_id}/{generation_uuid}
```

Do not place titles, filenames, MRNs, patient names, or parent codes in paths.

Recommended download posture:

- no authenticated direct SELECT policy for either protected bucket;
- `open_document_version` performs live authorization and audit;
- server signs only the returned `(bucket, path)` for a very short TTL;
- highest-risk PHI/legal content may be streamed through an authenticated server
  route when revocation/caching requirements justify the cost;
- public/cacheable assets remain in a separate, explicitly non-PHI asset system.

### 6.10 Upload and scan state machine

The database cannot make Storage atomic, so make partial progress explicit:

```text
reserved
  -> uploaded
  -> verifying
  -> scan_pending
  -> clean -> active
             or
          infected/rejected

Any state -> abandoned/failed (reconcilable)
```

Recommended workflow:

1. `begin_document_upload` validates actor/resource/policy, inserts a reserved
   file-object/upload-session row, generates the path, and returns a signed upload
   credential.
2. Client uploads only to that path.
3. `finalize_document_upload` verifies object existence, exact size/type/hash and
   advances to scan pending idempotently.
4. Scanner records a signed/authorized result.
5. Only clean content can bind as the active source/rendition and be opened.
6. A reconciliation worker closes abandoned sessions, reports missing objects, and
   quarantines unregistered objects.

### 6.11 Deep Document module interface

The seam should hide Storage path grammar, bucket choice, signing, scan state,
policy evaluation, audit, and retries. Domain callers should not learn those facts.

Suggested external interface:

```text
createDocument(...)
beginUpload(documentId/versionId, metadata)
finalizeUpload(uploadSessionId, verification)
addVersion(documentId, ...)
placeDocument(documentId, resourceId, relationship)
replaceAccessPolicy(documentId, policy)
openDocumentVersion(versionId, renditionKind)
requestDisposition(fileObjectId/documentId, reason)
placeOrReleaseHold(documentId/fileObjectId, ...)
```

Queries expose domain-safe projections, never raw paths for content the caller is
not authorized to open. The product-called PostgreSQL commands and TypeScript query
module form the test surface. Feature adapters for cases, controlled documents,
referrals, and evidence should be shallow by design and contain no independent
authorization logic.

Internally there are two real adapters at the Storage seam:

- production Supabase Storage adapter;
- deterministic test adapter or local Storage-backed test harness.

## 7. Scope of the proposed program

### 7.1 In scope

- Release-blocking fixes to current attachment Storage policies and disposition.
- Logical document/version/file-object model.
- Securable resource registry and migration of document-owning resource types.
- User, group, and scoped-role audiences.
- Document access policies and capabilities.
- PHI/standard physical segregation and semantic confidentiality.
- One audited document-open door and short-lived signing flow.
- Upload sessions, verification, scan state, and reconciliation.
- Retention policy, legal holds, and durable disposition orchestration.
- Compatibility adapters for existing attachment/document interfaces.
- Incremental migration of controlled documents, cases/interviews/action items,
  referrals, NSP evidence, printed renditions, and meeting audio.
- Storage-object copy/verify/cutover and legacy bucket/policy retirement.
- RLS, ACL, audit, pgTAP, unit, integration, and E2E coverage.
- Backend capability map, canonical architecture, ADRs, and operational runbooks
  updated at each approved Record gate.

### 7.2 Out of scope unless separately approved

- OCR, semantic search, embeddings, document-page extraction, or a RAG pipeline.
- A browser PDF/DOCX editor or collaborative content editing.
- A generic records-management product outside this platform's workflows.
- Public website/media asset management.
- Global content-hash deduplication.
- Column/application-level encryption; existing Rule-12 decision remains unless a
  new threat model/ADR overturns it.
- Replacing case/referral/controlled-document domain workflows with a generic
  document state machine.
- General-purpose deny rules or materialized effective-permission caches before
  requirements/performance evidence justify them.
- Antivirus vendor procurement/selection, although the integration interface and
  fail-closed state machine are in scope.
- Re-litigating the three Class-1 patient-PHI modules or participant identity model.

## 8. Phased implementation plan

No phase begins until its predecessor passes the project gate and receives explicit
human approval. Backend may prepare contract-first schema work one phase ahead only
within the limits in AGENTS.md; nothing merges ahead of its approved phase.

### Phase D0 — ratification and production census

**Objective:** turn this proposal into an approved architecture and establish the
real migration population.

**Backend/lead work:**

1. Query the production live catalog for all tables, policies, ACLs, DEFINER doors,
   buckets, object counts/bytes, path-bearing rows, flags, and metadata/object drift.
2. Inventory every product upload/open/download path, including service-role route
   handlers and signed-URL helpers.
3. Classify each surface as public asset, protected standard document,
   professional/governance confidential, patient PHI, generated rendition, or
   transient processing media.
4. Measure object counts/bytes by bucket, tenant, MIME, and age; record the largest
   object and expected migration duration/egress.
5. Decide the open items in §12 with product, clinical governance, privacy/legal,
   and operations.
6. Write/approve an ADR that supersedes the relevant rejected/deferred decisions in
   ADR 0063 and ratifies the resource/document/access-policy model.
7. Allocate phase identifiers in PHASES/PROGRESS without beginning implementation.

**Exit criteria:** approved ADR, production census, named legal/clinical owners,
cutover/rollback decision, and human approval to start D1.

### Phase D1 — current-model security remediation

**Objective:** make the existing centralized attachment surface safe enough to
remain operational during migration.

**Backend deliverables:**

1. Close F-01 by removing direct standard-byte access or binding the Storage policy
   to the registered attachment plus identical confidentiality/capability logic.
   Prefer the single-door solution if feasible without waiting for D2.
2. Make `open_attachment` reject disposed and disposal-pending content.
3. Introduce a durable physical-deletion job or, if legal deletion is not yet
   approved, rename/redefine the command so it cannot claim disposal while bytes
   remain accessible. Reads must still fail closed.
4. Replace reclassification pointer mutation with a safe copy/verify/commit flow or
   temporarily prohibit cross-tier reclassification.
5. Add unique `(storage_bucket, storage_path)` after reconciling duplicates.
6. Change scanning to fail closed for new user uploads; introduce the scanner
   integration or keep the feature unavailable until clean can be established.
7. Add a read-only reconciliation command/report for missing and orphan objects.
8. Validate controlled-document paths on file binding and prevent new unregistered
   physical references.
9. Align metadata visibility with the byte capability: protect PHI-bearing titles,
   descriptions, filenames, and paths from owner readers who lack the required
   patient-PHI/deliberation authority, or make those fields PHI-free by an approved
   enforceable contract.
10. Stop trusting caller-supplied object size/MIME/hash as verified metadata; derive
    and verify them in the finalize path, and restrict sensitivity downgrades to the
    approved classifier role/workflow.
11. Audit PUBLIC/anon/authenticated function ACLs and table/column grants for every
   touched surface.
12. Replace the referral snapshot's legacy `case-documents` signer with the
    canonical audited identifier/open path and add a fresh-row regression test.

**Frontend deliverables:**

- surface pending scan, failed verification, unavailable/disposed, and retry states
  in pt-BR;
- never expose a direct bucket URL or sign before the database door authorizes;
- remove/hide cross-tier actions if temporarily prohibited by backend.

**Compatibility:** no target-model tables yet; existing UI/query interfaces remain.

**Exit criteria:** every D1 keystone mutation-proven, Storage and metadata doors
agree, disposed content cannot be opened, scanner posture is explicit/fail-closed,
reconciliation clean or explained, full gate approved.

### Phase D2 — resource, document, file, and access foundation

**Objective:** add the new substrate behind OFF-by-default flags without migrating
feature behavior.

**Backend contract-first deliverables:**

1. Freeze TypeScript/domain contracts for `Document`, `DocumentVersion`,
   `FileObject`, `DocumentPlacement`, `AccessPolicy`, `Audience`, and upload states.
2. Add `securable_resources` and typed resource links for the first closed owner set
   (case, meeting, interview, action item). Use real FKs and tenant-shape integrity.
3. Add documents, versions, file objects, version-file bindings, and placements.
4. Add groups/members, typed audiences, access policies, and entries.
5. Add upload sessions, scan state/attempt records as needed, retention assignments,
   legal holds, and disposition jobs.
6. Enable RLS from table creation. Grant only the exact read surfaces required;
   mutations stay command-only.
7. Add the private `app.can_*_document` kernel and public commands, each
   search-path-pinned and explicitly revoked from PUBLIC before authenticated or
   service-role grants.
8. Add canonical protected buckets and upload policies; no authenticated SELECT
   policy for document bytes.
9. Add audit verbs/authorization dispatch for policy changes, sensitive reads,
   holds, classification, and disposition.
10. Add feature flags separately for the foundation and each consumer/cutover.

**No behavior change:** existing features continue using their current source of
truth. Foundation tables may be seeded with test fixtures but no production UI
depends on them.

**Exit criteria:** catalog/ACL/RLS/command contracts, unit and pgTAP suites green;
behavioral authorization matrix proven; no new byte-serving route bypasses the
door; QA approves the inert foundation.

### Phase D3 — upload/open orchestration and centralized-attachment adapter

**Objective:** make the new module operational and migrate the first consumer.

**Backend deliverables:**

1. Implement begin/finalize/scan/open/disposition orchestration and the production
   Supabase Storage adapter.
2. Create resources for existing attachment owners and backfill each attachment as
   document + version + file object + home-resource placement.
3. Verify object existence/hash/size where objects exist; quarantine or report
   dangling rows rather than inventing success.
4. Map `document_group_id`/`supersedes_id` carefully; reject/correct invalid chains
   before declaring equivalence.
5. Add compatibility adapters matching current case/meeting/interview/action-item
   query/action contracts. The new module is canonical; legacy rows become a
   compatibility projection or receive a stable `document_id` bridge.
6. Implement user/group/scoped-role sharing commands and effective policy reads.
7. Migrate attachment list/open UI to new query projections behind a per-consumer
   flag.

**Cutover rule:** one canonical write path. Do not maintain two independently
authoritative implementations. If old columns remain for rollback, populate them
as a derived compatibility projection from the new command transaction.

**Exit criteria:** row/object reconciliation equality, policy equivalence for the
old inherited-access cases, new direct-user/group/role scenarios green, old
interfaces pass through adapters, rollback flag tested, full gate approved.

### Phase D4 — controlled documents integration

**Objective:** reuse the document/version/file substrate without flattening the
controlled-document workflow.

**Backend deliverables:**

1. Give every controlled document a document-core identity/home resource.
2. Map each `controlled_document_version` to a core `document_version` and source
   file object; remove new writes to raw `storage_path`.
3. Keep controlled-document header, approval, reviewer notification,
   effective/obsolete, review-cycle, and charter linkage tables domain-owned.
4. Express reviewer access as a version/document audience grant or a tightly
   specified workflow capability—not a separate path-based object policy.
5. Support sensitivity classification even if current controlled-document product
   policy defaults to standard/non-PHI. Unknown or PHI input must fail closed.
6. Move downloads to `open_document_version`; preserve reviewer and commission
   access semantics and audit.
7. Backfill and verify every controlled file before removing the legacy binding.

**Exit criteria:** complete controlled-document lifecycle green; reviewer isolation
and version immutability preserved; no controlled-document bucket direct read path;
old versions remain downloadable only to authorized audiences; full gate approved.

### Phase D5 — PHI and specialized consumer waves

Each sub-wave is independently gated because it changes a Rule-12 or specialized
authorization surface. Suggested order:

#### D5A — referral attachments and frozen snapshots

- Move reply files and shared snapshots to version/file/rendition records.
- Preserve source/frozen provenance and referral PHI authorization.
- Ensure every open emits the required referral/document audit without duplicate or
  missing events.
- Keep frozen snapshots immutable even if the source document changes/disposes.

#### D5B — NSP RCA/CAPA evidence

- Move uploaded evidence into the common physical/sensitivity contract.
- Preserve PQS/custody/write authority and clinical audit posture.
- Distinguish uploaded document evidence from external links and citations.
- Prevent a generic document grant from bypassing NSP hard exclusions unless the
  approved domain model explicitly permits it.

#### D5C — printed/generated documents

- Represent generated PDFs as renditions linked to the source resource/version.
- Preserve verification tokens, superseded/revoked overlay behavior, and current
  source-access checks.
- Use the common file object and sensitivity tier; keep verification metadata in a
  printed-rendition satellite.

#### D5D — meeting audio and processing artifacts

- Decide whether raw audio is a governed source file or transient processing media.
- Bind retained audio to the common file object; keep transcription/minutes job
  state in the meetings module.
- Enforce PHI classification, retention, deletion-after-processing, and audited
  access according to the approved meeting policy.

**Exit criteria for each:** old and new behavior equivalence plus new common
invariants; mutation-tested hard exclusions; exact audit behavior; full phase gate
and explicit human approval before the next sub-wave.

### Phase D6 — legacy Storage retirement

**Objective:** close the migration population and remove duplicate security
surfaces.

For each legacy bucket/path family:

1. prohibit new uploads;
2. capture source object manifest and checksums;
3. copy to canonical generated paths using the Storage API;
4. verify bytes/hash/size/MIME at destination;
5. bind file-object rows and switch reads under a consumer flag;
6. soak while retaining source objects inaccessible to end users;
7. prove zero live database references to the old path family;
8. prove zero product callers and zero applicable Storage/RPC policies;
9. delete old objects only after retention/legal approval;
10. verify bucket empty, then remove policies and bucket;
11. update backup/restore and disaster-recovery documentation.

Never delete `storage.objects` rows directly; use the Storage API and verify the
underlying object outcome.

**Exit criteria:** closed manifests for every bucket, zero old references/objects,
restore drill green, legacy ACL/RLS/functions removed, full gate approved.

### Phase D7 — operational hardening and production rollout

**Objective:** validate scale, observability, recovery, and controlled enablement.

- Run production-volume-shaped authorization/list/search/load tests.
- Add indexes only from measured query plans and queue access patterns.
- Establish scan/disposition/reconciliation workers, retry/dead-letter alerts, and
  operational ownership.
- Add metrics for upload states, scan latency/failures, missing/orphan objects,
  signed opens, denied opens, disposal backlog, and hold conflicts—never object
  content/PHI in telemetry.
- Drill backup/restore of both database metadata and Storage objects.
- Roll out by organization/hospital/commission if the feature-flag substrate
  supports scoped enablement; otherwise use a staged global pilot with explicit
  rollback criteria.
- Keep legacy source objects until the approved rollback/retention window closes.

**Exit criteria:** pilot success metrics, no unresolved security/reconciliation
findings, operational sign-off, full E2E gate, QA approval, human production
approval, and Record updates.

## 9. Team sequencing and file ownership

Follow [AGENTS.md](../../AGENTS.md) and the lead playbook. The lead orchestrates and
does not implement feature code.

### Backend owner

- `supabase/migrations/**`, buckets/RLS/RPCs/triggers/seed/pgTAP;
- `src/lib/supabase/**` Storage/server adapters;
- `src/lib/queries/**`, new document module, server actions/routes;
- generated database types;
- deployment/reconciliation scripts and backend-state documentation.

Before authorization/RLS work, backend must read
[authz-handoff §7](authz-handoff.md#7--the-lessons). Novel RLS shapes, new
DEFINER read doors, service-role signing routes, resource registry, and access
policy resolver require full lead plan review.

### Frontend owner

- document library/share/access-policy UI;
- upload/scan/error/progress states;
- compatibility UI migrations in case/meeting/referral/controlled-document routes;
- accessible user/group/role audience controls;
- no raw Supabase queries or direct Storage signing.

Frontend must use the project frontend-design skill and frozen backend contracts
before new screens/routes begin.

### Tester

- owns new/updated Playwright specs in `e2e/`;
- never fixes application code;
- validates keyboard-only sharing/upload/open flows and the product-called byte
  path, not only metadata tables.

### QA reviewer

- read-only application review after tester green;
- audits requirements, code quality, RLS, DEFINER reachability, service-role
  signing, Storage policies, audit, PHI, mutation evidence, and migration closure;
- writes one review report per gated phase/wave.

### Serialization constraints

- Resource registry and document types land contract-first before consumer UI.
- Shared audit action unions/allow-lists are backend-owned and serialized.
- Storage policies and open/signing routes are one backend workstream; never split
  their authority across agents.
- Controlled-document integration must serialize with any in-flight controlled-doc
  migration/RPC rewrite.
- Two agents never edit the same migration, generated types, or shared query file.

## 10. Testing and gates

### 10.1 Mandatory project gate for every phase/sub-wave

1. **Build complete**
   - migrations apply from a clean local reset;
   - generated types match the catalog;
   - `npm run lint` passes with zero warnings;
   - `npm run typecheck` passes;
   - full Vitest and ordered pgTAP suites pass;
   - Supabase security/performance advisors run and findings are resolved or
     explicitly dispositioned;
   - graphify updates after non-SQL code changes only; never use it as SQL truth.
2. **Test pass**
   - tester owns/executes current-phase Playwright specs;
   - fix loops run failing plus current-phase Chromium specs;
   - full suite runs once through `npm run e2e:prod` to declare green;
   - every failure is recorded before engineer fixes it.
3. **QA review**
   - QA writes APPROVED or CHANGES REQUESTED;
   - security/RLS/PHI review includes live catalog and product-called behavior.
4. **Human approval**
   - lead presents implementation, test results, QA verdict, migration counts, and
     open risks;
   - waits for explicit approval.
5. **Record**
   - update PROGRESS status only after approval;
   - rotate phase detail;
   - update `ARCHITECTURE.md`, `docs/backend-state.md`, accepted ADRs/runbooks;
   - commit with the approved phase convention.

### 10.2 Catalog and privilege tests

Every new public table/command must have pgTAP assertions for:

- RLS enabled from creation;
- exact table and column grants for anon/authenticated/service_role;
- no authenticated direct DML where commands are authoritative;
- every public DEFINER command revoked from PUBLIC/anon before exact grants;
- search path pinned;
- expected `prosecdef` value;
- FK, uniqueness, tenant-shape, immutable-version, bucket-tier, and path constraints;
- supporting indexes for actual FKs/RLS/queue queries;
- security-invoker on any exposed view or no exposed view access.

### 10.3 Authorization behavior matrix

Test through both metadata RLS and the product-called command/route. Minimum
principals/scenarios:

- direct named user grant;
- user without grant;
- current and expired group member;
- matching and non-matching scoped role;
- role removed after URL issuance;
- home-resource inherited user;
- explicit-only document;
- placement reader who lacks document access;
- deactivated/suspended principal;
- cross-organization and cross-hospital user;
- platform admin (no commission content/PHI noun arm);
- case-recused respondent;
- case oversight-only versus deliberation-capable user;
- confidentiality clearance below/equal/above label;
- PHI-tier meeting/action-item files versus ordinary owner readers;
- PHI-bearing metadata reader versus byte-download reader;
- legal hold versus disposition authority.

Each negative test needs a positive twin proving the fixture has the intended
authority absent the tested exclusion.

### 10.4 Mutation testing — non-negotiable

Per authz-handoff §7, green tests are evidence only after mutation:

- remove the confidentiality conjunct: the intended test must fail;
- restore direct Storage SELECT or bypass the document row: test must fail;
- remove disposed-state check: test must fail;
- replace explicit-only with home inheritance: private-document test must fail;
- remove group expiry: expired-member test must fail;
- remove role scope: cross-hospital test must fail;
- remove recusal/hard exclusion: case test must fail;
- grant PUBLIC execute on a door: ACL test must fail;
- serve `pending` scan status: scan test must fail;
- skip PHI audit: audit test must fail.

Mutate one mechanism at a time and prove tests actually ran. Policy-only assertions
cannot prove a service-role signer or DEFINER door.

### 10.5 Storage and lifecycle integration tests

Use real local Supabase Storage or a production-equivalent adapter for:

- begin upload creates only the reserved path/session;
- wrong path, MIME, size, or hash cannot finalize;
- finalize retry is idempotent;
- unregistered standard and PHI objects cannot be listed/downloaded;
- pending/skipped/infected files cannot open;
- clean file opens once and produces the expected audit;
- short-lived URL expires as configured;
- reclassification copy failure leaves the old binding safe and recoverable;
- successful reclassification verifies destination before source retirement;
- disposal immediately blocks opens, retries deletion, verifies absence, and
  respects hold/retention;
- missing metadata/object and orphan-object reconciliation reports exact counts;
- path never contains supplied filename or PHI.

### 10.6 Domain integration tests

- Controlled document: draft/upload/submit/approve/publish/supersede/obsolete and
  prior-version download.
- Referral: source snapshot remains frozen; source and target visibility; reply
  attachment open audit.
- NSP: PQS/custody access, hard identifier isolation, evidence open audit.
- Case/interview/action item: inherited access, explicit sharing, recusal,
  deliberation capability, confidential ceiling.
- Printed rendition: verification, source-current access, revoked/superseded
  overlay, PHI classification.
- Meeting audio: upload/process/apply/purge/retention behavior.

### 10.7 Migration and reconciliation tests

- Dry-run every backfill on a restored production snapshot when available.
- Capture before/after counts by tenant, owner/resource type, tier, bucket, and
  lifecycle state.
- Verify one-to-one path mapping and checksums.
- Prove no cross-tenant resource/document association.
- Preserve immutable historical paths until verified cutover.
- Run old-versus-new authorization shadow comparisons over the full seeded persona
  matrix; expected differences must be enumerated and approved.
- Test interrupted backfill/copy resume and idempotency.
- Test rollback flag while legacy source objects still exist.
- Test restore of database plus Storage, not database alone.

### 10.8 Performance tests

Before broad rollout, collect `EXPLAIN (ANALYZE, BUFFERS)` and latency for:

- list documents for one parent resource;
- user-wide accessible-document library;
- group and scoped-role resolution;
- approver/reviewer queues;
- scan/disposal/retention worker claims;
- audit write rate;
- open authorization and signing;
- policy change with large groups.

Use composite/partial indexes based on these predicates. Do not introduce a
materialized effective-permissions cache until production evidence shows live
resolution is inadequate and a complete invalidation strategy is approved.

## 11. Rollout and rollback strategy

### 11.1 Flags

Use separate flags for:

- inert document foundation;
- new upload/open module;
- each consumer adapter/cutover;
- access-policy UI;
- scanner enforcement if deployment must be staged (but never allow unsafe upload
  during a gap);
- legacy read removal.

Flag descriptions are not state. Every runbook/test must assert the live `enabled`
value it depends on and restore captured values, never guessed seed defaults.

### 11.2 Canonical-write rule

At every moment one model is canonical for new writes. During transition:

- before a consumer cutover, old commands remain canonical;
- backfill creates new equivalents and shadow reads compare behavior;
- at cutover, the compatibility adapter calls the new module;
- any retained legacy columns are derived projections for rollback/read
  compatibility, not an independently mutable second authority;
- prohibit raw service-role writes to either side.

### 11.3 Object migration safety

- Copy, verify, then switch; never rename/delete first.
- Keep source objects access-denied but recoverable during the rollback window.
- Record a manifest with source/destination/checksum/status outside PHI payloads.
- Roll back by consumer flag and compatibility mapping, not by rewriting history.
- Do not remove an old bucket/policy until every caller, row, object, and restore
  dependency is closed.

### 11.4 Stop/rollback triggers

Stop rollout on any of:

- authorization difference not in the approved delta;
- missing/duplicate PHI audit;
- cross-tenant result;
- disposed/pending/infected object served;
- reconciliation mismatch;
- scan/disposition backlog without operational owner;
- unexpected signed-URL lifetime/cache behavior;
- object copy/hash failure above the approved threshold;
- restore drill failure;
- material latency regression on document list/open.

## 12. Open decisions requiring human/domain approval

1. **Protected standard download path.** Recommended: one audited door for all
   protected documents, not direct Storage SELECT. Confirm cost/performance posture.
2. **Resource registry.** Recommended: adopt real FK-backed securable resources now;
   this is the central hard-to-reverse decision.
3. **Access inheritance.** Confirm the three modes and that placements are
   non-authorizing by default.
4. **Explicit deny.** Recommended: do not add generic deny initially; retain hard
   domain exclusions plus allow grants.
5. **Audit volume.** Decide all standard opens/denials versus Rule-11 minimum plus a
   separate security-attempt log.
6. **URL TTL and streaming.** Set TTL by sensitivity/label and decide which content
   must be proxied rather than signed.
7. **Classification ownership.** Define who can label/downgrade PHI and what review
   is required; uploader self-declaration cannot be the sole control.
8. **Scanner.** Select integration, maximum scan latency, failure/retry behavior,
   Office macro/archive handling, and operational owner.
9. **Retention policies.** Clinical/legal approval of trigger events, 20-year
   floors, erasure reconciliation, holds, generated copies, and backups.
10. **Controlled documents with PHI.** Current plan says none; decide whether to
    prohibit PHI categorically or support it through the new file contract.
11. **Meeting audio.** Decide retained governed record versus transient processing
    media and the deletion deadline.
12. **Public assets.** Confirm form images remain a separate non-PHI asset module and
    identify any other truly public/cacheable media.
13. **Group administration.** Decide who can create groups, manage membership,
    delegate group management, and audit changes.
14. **Break-glass/time-boxed access.** Decide whether needed now; if so, require
    reason, expiry, notification, and enhanced audit as a separate workflow.
15. **Production migration population.** No implementation estimate is reliable
    until production object/byte counts and drift are measured.

## 13. Risk register

| Risk | Likelihood / impact | Mitigation and evidence required |
| --- | --- | --- |
| Direct Storage path bypasses document policy | Current mechanism / critical | Close in D1; mutation-test metadata denial versus byte denial; prohibit alternate signers. |
| Disposed PHI remains accessible | Current mechanism / critical | Fail closed on disposition state immediately; durable delete/verify job; URL TTL; behavior test. |
| Misclassification places PHI in standard bucket | Medium / critical | Unknown defaults to PHI/fail-closed; restricted downgrade authority; scan/classification review; bucket-tier CHECK. |
| PHI-tier file inherits a non-PHI owner audience | Current model permits it / critical | Row-aware sensitivity floor before owner inheritance; explicit matrix for every owner type; protect metadata and bytes consistently. |
| Database and Storage diverge | High / high | Durable states, idempotent workflows, unique object identity, reconciliation, copy/verify/commit. |
| Service-role signer bypasses RLS | Medium / critical | Database authorization command before signing; no caller path input; product-called mutation tests; least privilege. |
| Resource registry becomes generic EAV | Medium / high | Registry contains identity/type/tenant only; domain payload stays in domain tables; typed composite pins. |
| Access resolver becomes slow | Medium / high | Uniform tenant anchors, indexed audience/member lookups, measured EXPLAIN; cache only after evidence. |
| Materialized permissions become stale | Low if deferred / critical | Do not build initially; if later, closure over every mutator and invalidation mutation tests. |
| Group or role grants outlive membership | Medium / high | Effective membership/expiry resolved live; group expiry; deactivation outer gate; session/product parity tests. |
| Placement accidentally widens access | Medium / high | Non-authorizing default; explicit inheritance mode; negative placement-reader test. |
| Hard case exclusions are outvoted by explicit grants | Medium / critical | Exclusion evaluated before grants; mutator audit; negative/positive mutation twins. |
| Signed URL survives revocation | Inherent / high | Very short TTL; proxy highest-risk content; never represent URL issuance as durable authorization. |
| Scan outage blocks operations | Medium / medium/high | Fail closed; retry/dead-letter; visible pending state; operational SLO/owner; no skipped default. |
| Scanner misses malicious content | Inherent / high | Defense in depth: MIME restrictions, no inline HTML execution, download headers, versioned engine, incident response. |
| Legal retention conflicts with erasure | Medium / critical | Approved retention matrix, holds, disposal states, retained metadata contract, legal/clinical sign-off. |
| Big-bang migration causes broad regression | Medium / critical | Consumer-by-consumer flags/adapters, manifests, backfills, shadow comparison, full gate per wave. |
| Compatibility adapters become permanent dual logic | Medium / medium | New module canonical; adapters contain no auth/storage logic; retirement acceptance criteria and backlog owner. |
| Old buckets/policies remain reachable | High / high | New uploads denied, caller/policy census, zero-object/zero-reference closure, QA review before deletion. |
| Vacuous green security tests | Demonstrated project risk / critical | Independent behavioral twins and one-at-a-time mutation testing; prove tests ran; inspect all permissive siblings. |
| Local seed hides production scale/drift | High / high | D0 production census and restored-snapshot rehearsal before physical design/cutover. |
| Audit volume affects hash-chain performance | Medium / medium | Measure rate; batch design only if audit guarantees preserved; partition only with production evidence/ADR. |

## 14. Program-level acceptance criteria

The redesign is complete only when all are true:

1. A document can be shared with exactly one user, an explicit group, or a scoped
   role, with optional expiry, entirely through database-enforced authorization.
2. Home-resource inheritance and explicit-only documents both work; placements do
   not widen access accidentally.
3. Every protected physical file has one file-object row and one unique
   `(bucket,path)` identity.
4. Every user upload follows reserved/uploaded/verified/scanned/clean lifecycle;
   non-clean content cannot open.
5. PHI/standard bucket selection is derived and invariant; unknown sensitivity
   fails closed.
6. Metadata RLS, open command, service-role signer, and Storage policies return the
   same access decision for every tested persona.
7. PHI, confidential, cross-user, classification, sharing, hold, and disposition
   actions emit the approved non-content audit events exactly as specified.
8. Disposition immediately blocks access and eventually verifies physical deletion
   when legally allowed; holds/retention prevent deletion.
9. Controlled-document, referral, NSP, case/interview/action-item, printed, and
   meeting workflows retain their domain-specific invariants through adapters.
10. No application code stores, parses, authorizes, or signs raw protected
    `storage_path` values outside the Document module.
11. No protected bucket has a direct authenticated read path that bypasses the
    effective document policy/audit contract.
12. No legacy path column receives new writes; every old database reference,
    function caller, Storage policy, object, and bucket is either retired or
    explicitly approved as a separate asset subsystem.
13. Reconciliation reports zero unexplained missing/duplicate/orphan objects.
14. RLS and open/list performance meet measured pilot targets without an unproven
    effective-permission cache.
15. Backup/restore and interrupted-migration recovery are demonstrated.
16. All phase gates pass in order, QA approves, and humans explicitly approve each
    Rule-12/cutover wave.

## 15. Explicit non-goals and anti-patterns

Do not:

- add another feature bucket and path column as the default solution;
- add more `owner_type` CASE arms to satisfy user/group/role sharing;
- put ACLs in JSONB;
- treat `storage.objects.owner_id` as document authorization;
- authorize bytes from path folders when policy depends on document metadata;
- accept a client-supplied bucket or arbitrary path;
- use the service role before the live actor/document decision is made;
- mutate `storage.objects` directly;
- model a physical move as a database pointer update;
- serve `pending`, `skipped`, `infected`, disposal-pending, or disposed content;
- globally deduplicate PHI files;
- allow a placement/reference to grant access implicitly;
- fold controlled-document approval, referral governance, or case custody into a
  generic document lifecycle;
- build a permissions cache without measured need and complete invalidation
  closure;
- call a policy-only green test proof of a DEFINER/service-role product path;
- delete legacy objects/buckets before manifest, verification, rollback, and legal
  closure.

## 16. Resume checklist for a future lead

1. Confirm explicit human authorization and assigned phase before implementation.
2. Re-read [ARCHITECTURE.md](../../ARCHITECTURE.md) in full and
   [authz-handoff §7](authz-handoff.md#7--the-lessons).
3. Re-query the **current** local and production live catalogs; do not trust this
   snapshot after later migrations/resets.
4. Verify actual feature flag values, not descriptions.
5. Repeat the bucket/object/path/policy/ACL/DEFINER census and pin it to timestamp,
   commit, database, and environment.
6. Re-run the F-01 behavioral probe through the product-called Storage/download
   surface, not just predicates.
7. Determine whether any disposed attachments/issued URLs exist and treat them as
   incident/remediation scope if production is affected.
8. Obtain clinical/privacy/legal decisions for retention, disposition,
   classification, holds, and controlled-document PHI.
9. Write and approve the target-model ADR; amend/supersede ADR 0063 precisely.
10. Start D1 only; do not combine release-blocking remediation with the full schema
    redesign.
11. Spawn backend with contract-first/full-plan review, then frontend only after
    contracts freeze; tester after build; QA after tester green.
12. Record each gate in PROGRESS before reporting it verbally.
13. Preserve unrelated working-tree changes and serialize shared migration/type/
    audit files.
14. Stop after five fix iterations or an unchanged repeated failure, per loop
    safety rules.

## Auditor's final verdict

The current centralized attachment layer is not “inefficient” mainly because it
has nullable columns or too many indexes. Its real limitation is conceptual: it
uses a physical attachment row and a parent-domain dispatcher as the document
aggregate and authorization model. That interface cannot absorb the platform's
planned sharing, versioning, retention, scanning, and cross-feature requirements
without widening a security-critical CASE/policy surface every time.

Preserve the good RLS, immutability, PHI segregation, and audit principles, but move
them behind a deeper Document module with explicit logical documents, immutable
versions, physical file objects, securable resources, and audience-based access
policies. Correct the current confidentiality and disposition defects first, then
migrate incrementally through compatibility adapters and independently gated
Rule-12 waves.

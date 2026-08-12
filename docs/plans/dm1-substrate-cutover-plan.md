# DM1 — substrate cutover: implementation plan (backend)

> Status: **PLAN — awaiting lead + PO approval. No SQL written.**
> Author: `backend`, 2026-08-12. Executes ADR 0114 D3/D4/D5/D7/D8 per
> `docs/plans/document-model-redesign.md` §"Phase DM1" (incl. both 2026-08-12
> amendments). Every catalog claim below was re-verified against the LIVE local
> catalog on 2026-08-12 (fresh-ish shared stack, 361 migrations registered,
> max `20260922000100`). Prod-only facts are marked **[PROD-VERIFY]** and get
> re-checked against the remote catalog at execution time.

## 0. Plan-vs-catalog disagreements found (report-loudly section)

The lead asked for these explicitly. Three, all of the same class as the two
already caught in this program — surfaces bound to the old substrate that no
document in the program names:

1. **Four LIVE tables hold FKs INTO `public.attachments`** — absent from ADR
   0114, the DM plan, and the lead's fact list:
   - `rca_evidence.cited_document_id` → `attachments(id)` ON DELETE RESTRICT
     (0 rows local; writer `public.add_rca_evidence`).
   - `referral_shared_item.source_document_id` → `attachments(id)` ON DELETE
     SET NULL (5 rows local, 1 non-null; writer `public.add_referral_shared_item`).
   - `ethics_decision_details.decision_letter_document_id` → `attachments(id)`
     (3 rows local, 0 non-null; **no function writes it** — a seam only;
     `get_ethics_case_procedure` projects it).
   - `ethics_notifications.related_document_id` → `attachments(id)` (2 rows
     local, 0 non-null; writer `public.issue_ethics_notification`, and
     `src/lib/ethics/actions.ts:484` passes `p_related_document_id` from the UI).
   Dropping the table without a decision here silently drops four FK
   constraints and leaves live writers pointing at a missing relation.
   **Treatment: §3 step 1 (writer patches + explicit FK drops). Open question
   Q1: ethics is in NO D13 wave** — the re-point of the two ethics columns has
   no owner. Needs a PO/lead ruling (suggest: fold into Wave A or B; until
   then the writers fail closed).

2. **`public.add_referral_shared_item` reads `public.attachments` in its
   document arm** (comment-stripped, verified in `pg_proc`): the "share a case
   document into a referral" flow selects the case-owned attachment row to
   freeze title/path/mime/size. It is **referral-owned yet drop-dependent** —
   a surface between the plan's "drop set" and its "referral allowlist" that
   belongs to neither cleanly. DM1 patches its document arm to fail closed
   (pt-BR, `HC077`) until DM4 re-points it. Reachability note (§7.12
   discipline): with `attachments = false` in prod and zero attachment bytes,
   no case document can exist to share, so nothing live is lost.

3. **`app._audit_access_authorized` + `public.log_audit_access` carry the
   `attachment.read` arm/allowlist entry**, and the arm selects from
   `public.attachments`. `dispose_case_phi` carries an attachments-redaction
   block (`update public.attachments set title = redacted …`). All three
   function bodies must be rewritten in the drop migration or they error at
   runtime. Also **not** in any program list.

Confirmed-as-stated (no disagreement): the 14 `%attachment%` routines and
their `prosecdef` values; the 9 `%attachment%` policies; the referral RPCs
call **none** of the seven `app.*` attachment routines (comment-stripped sweep
— safe to drop them); 10 buckets, `meeting-attachments` already absent
locally; `case_documents_select_member` (qual:
`bucket_id='case-documents' AND app.can_read_snapshot_document(name, auth.uid())`)
and `app.can_read_snapshot_document` are live and preserved; `authenticated`
holds SELECT-only on all three attachment tables; local `attachments` has 4
rows (seed fixtures — see §6); pgTAP `325` t4 pins `case-documents` policies
`>= 1` as a positive control (DM1-compatible, untouched).

## 1. Scope and non-goals

DM1 creates the inert document substrate and destroys the old one. **No public
RPCs are created** (begin/finalize/open/dispose are DM2). No UI changes.
Nothing user-visible changes in production (locally, the seed stops enabling
the `attachments` flag, so the attachment panels render their flag-off state —
this matches production, where D1 already flipped it off).

## 2. Migration window

`20260923000100` … onward (above max registered `20260922000100`; I own the
shared stack — no other worktree holds uncommitted applied migrations). Six
migrations, one concern each, forward-only:

| # | File | Concern |
|---|------|---------|
| M1 | `20260923000100_dm1_drop_attachment_substrate.sql` | Writer patches + drop set |
| M2 | `20260923000200_dm1_securable_resources.sql` | Registry + pins + backfill + triggers |
| M3 | `20260923000300_dm1_documents_core.sql` | The 8 core tables + constraints + guards |
| M4 | `20260923000400_dm1_document_kernel.sql` | `can_read_document` / `can_write_document` / `storage_upload_reserved` + all RLS policies + grants |
| M5 | `20260923000500_dm1_document_buckets.sql` | 2 buckets + INSERT-only policies, NO SELECT |
| M6 | `20260923000600_dm1_document_audit_flags.sql` | Audit dispatch verbs + feature flags |

After M6: `npm run gen:types` (Rule 8). pgTAP suite `328_dm1_document_substrate.sql`
(next free number; highest is `327`). ADR **0116** records DM1's non-trivial
choices (registry trigger population; FK-drop + writer-patch parking posture;
the ethics wave gap) — next free number, re-verified at merge (0115 exists).

## 3. Step-by-step

### Step 1 (M1) — drop set, enumerated from the live catalog

Patches FIRST (all `create or replace`, bodies rewritten whole, search_path
kept as-is):

1. `app._audit_access_authorized` — remove the `attachment.read` arm (and its
   `v_att_owner_*` locals).
2. `public.log_audit_access` — remove `'attachment.read'` from the allowlist.
3. `public.add_referral_shared_item` — document arm raises
   `documento não disponível` (`HC077`) before touching any relation; the
   narrative arm is untouched.
4. `public.dispose_case_phi` — remove the attachments-redaction block (the
   `set_config('app.in_attachments_rpc', …)` + `update public.attachments`
   fragment). Obligation ledger: DM2 must give case erasure a
   document-disposition hook when Wave A lands (recorded in PROGRESS + ADR 0116).
5. `public.add_rca_evidence` — reject non-null `cited_document_id` (fail
   closed until Wave D re-points).
6. `public.issue_ethics_notification` — reject non-null
   `p_related_document_id` (fail closed until the Q1 ruling).

Then the drops, in order:

7. Explicit FK drops (auditable, never CASCADE): the four constraints named in
   §0.1. The four uuid columns STAY as parked seams (writers now reject
   non-null; DM4/Wave-D/Q1 re-point or drop them).
8. Storage policies: `attachments_obj_insert_writable`,
   `attachments_obj_select_readable`, `attachments_phi_obj_insert_writable`.
9. Public RPCs (5): `create_attachment`, `open_attachment`,
   `dispose_attachment_phi`, `reclassify_attachment`, `soft_delete_attachment`.
10. Tables: `attachment_subjects`, `attachment_references`, `attachments`
    (child-first; the 4 dangling prod rows and 4 local seed rows die with the
    table — they reference no bytes **[PROD-VERIFY: re-count the 4 rows and
    confirm both `attachments*` buckets still empty before `db push`]**). Their
    table policies and triggers die with them.
11. App routines (7): the four dispatchers + `assert_attachments_enabled` +
    `guard_attachment_immutable` + `trg_audit_attachment` (dropping the tables
    drops the triggers, not these functions).

NOT dropped (the allowlist, verified live): `add_referral_reply_attachment`,
`get_referral_attachment_path`, `referral_reply_attachment_select_readable`,
`referral_attachments_obj_insert`, `referral_attachments_obj_select`,
**`case_documents_select_member`**, **`app.can_read_snapshot_document`** (the
live cookie-client boundary for frozen referral snapshots until DM4 — per the
plan's second amendment). The `attachments` feature-flag KEY stays (retired at
DM2 per plan). `meeting-attachments`: no-op locally (confirmed absent);
**[PROD-VERIFY]** and record.

Proof: keystone K1/K2 (§5), written and observed **RED before M1 exists**.

### Step 2 (M2) — `securable_resources` (registry, participants dialect)

Precedent copied exactly (verified: `participants_id_type_uniq UNIQUE(id,
participant_type)`; `patient_participants` pins via
`CHECK (participant_type='patient')` + composite FK
`(participant_id, participant_type) → participants(id, participant_type)`):

- `securable_resources(id uuid PK, resource_type text NOT NULL CHECK (resource_type IN ('case','meeting','interview','action_item')), organization_id NOT NULL → organizations, hospital_id NOT NULL → hospitals, commission_id NOT NULL → commissions, created_at, UNIQUE(id, resource_type))`.
  Tenant-shape CHECK: all four initial types are commission-anchored (all
  three anchors NOT NULL); future org/hospital-scoped types widen the CHECK.
  Anti-EAV: identity + type + tenant anchors ONLY.
- **Shared-PK pin, domain side** (the four domain tables play the satellite
  role): each of `cases`, `meetings`, `case_interviews` (⚠ the real name —
  ADR 0114 says "interviews"; no such relation), `action_items` gains
  `securable_type text NOT NULL DEFAULT '<type>' CHECK (securable_type = '<type>')`
  + composite FK `(id, securable_type) → securable_resources(id, resource_type)`.
  A case can never point at a meeting-typed registry row — the participants
  class-separation invariant, same dialect (no fourth dialect invented).
- **Population**: BEFORE INSERT trigger per domain table
  (`app.ensure_securable_resource()`, DEFINER, search_path-pinned) inserts the
  registry row (id = NEW.id, tenant anchors resolved from `commissions` —
  single source for all four). Deliberate divergence from the participants
  precedent (whose anchors are command-created): documents must attach to rows
  created by ~a dozen pre-existing RPCs; a trigger keeps DM1 out of all of
  them. Recorded in ADR 0116.
- AFTER DELETE trigger removes the registry row;
  `documents.home_resource_id → securable_resources(id) ON DELETE RESTRICT`
  therefore blocks hard-deleting a domain row that still owns documents
  (fail-safe; surfaced to the PO as a semantic consequence).
- Backfill: `insert … select` from the four tables (deterministic; ~0 rows in
  prod beyond real domain rows — no guard-wrap needed, it is not
  data-dependent in the 23514 sense).
- RLS ON at creation; `authenticated` SELECT-only grant; policy
  `securable_resources_select`: `app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id)`.

Proof: K3 (§5).

### Step 3 (M3) — core tables

All: RLS enabled at creation, `authenticated` **SELECT grant only, zero DML**
(command-only mutations; the DM2 doors are the only writers, service-role +
DEFINER). Sketch (exact DDL at build; constraint names stable for pgTAP):

- `documents(id, home_resource_id → securable_resources ON DELETE RESTRICT, title, description, kind, status CHECK ('active','soft_deleted','disposal_pending','disposed'), access_policy_id uuid NULL /* D6 seam — REFERENCED BY NOTHING; comment says a future ADR defines its target */, created_by → profiles, created_at, updated_at, deleted_at)`.
- `document_versions(id, document_id → documents, version_number int, created_by, created_at, UNIQUE(document_id, version_number))` — immutable
  after insert (guard trigger `app.guard_document_version_immutable`: BEFORE
  UPDATE/DELETE raises; replica-mode note honored as with existing guards).
- `document_version_files(id, document_version_id →, file_object_id →, rendition_kind CHECK ('source','redacted','preview','signed','printed_pdf'), UNIQUE(document_version_id, rendition_kind) /* provisional — Q6 */, created_at)`.
- `file_objects(id, storage_bucket text, storage_path text, sensitivity_tier CHECK ('standard','phi'), upload_state CHECK ('reserved','uploaded','verifying','scan_pending','clean','unscanned_accepted','infected','rejected','abandoned','failed'), disposal_state CHECK ('none','disposal_pending','disposed') DEFAULT 'none', size_bytes, mime_type, sha256, created_by, created_at, verified_at, disposed_at/by/reason_category, UNIQUE(storage_bucket, storage_path), CHECK bucket-from-tier: (tier='phi' AND bucket='documents-phi') OR (tier='standard' AND bucket='documents-standard'))`.
  Guard trigger `app.guard_file_object_transition`: legal D9/D10 state moves
  only; `storage_bucket`/`storage_path`/`sha256` immutable once `uploaded`
  (reclassification is copy→new-row, never a pointer update — F-03 dies by
  constraint); entering `disposal_pending`/`disposed` refused while an
  unreleased legal hold exists on any owning document (fail-closed in the
  substrate, before any command exists).
- `document_placements(id, document_id →, resource_id → securable_resources, created_by, created_at, UNIQUE(document_id, resource_id))` — table comment:
  **non-authorizing, ever** (D6); no predicate may read it.
- `upload_sessions(id, file_object_id →, reserved_by → profiles, expires_at, state CHECK ('reserved','consumed','expired','cancelled'), created_at)`.
- `document_retention(id, document_kind/tier scope cols, retention_years int, trigger_event text, is_provisional boolean NOT NULL DEFAULT true, …)` — structure per D7; seeded rows marked provisional (O1 owns values).
- `document_legal_holds(id, document_id →, issued_by, reason_category CHECK (…), placed_at, released_at, released_by)` — replaces the old bare boolean.

Proof: K7 constraint keystones + §10.2-style catalog assertions (K4/K5).

### Step 4 (M4) — kernel + RLS policies

New `app.*` doors, all `SECURITY DEFINER`, `search_path` pinned
(`set search_path = ''` house form), `REVOKE ALL … FROM public, authenticated`
(policies/definers call them; they are not client surface):

- `app.can_read_document(p_document_id uuid, p_uid uuid) returns boolean` —
  `p_uid null → false`; `app.is_active(p_uid)` outer gate; resolve
  `documents → securable_resources`, dispatch **by reusing the existing domain
  predicates verbatim** (the same set the old dispatcher used, all verified
  live): `case → app.can_read_case`, `meeting → app.is_member_of_for(commission_id)`,
  `interview → app.can_read_case_committee(app.case_of_interview(id))`,
  `action_item → app.can_read_action_item`. **No `is_admin` arm** — documents
  are commission content; the platform_admin noun rule (A35) applies and K5
  pins it behaviorally. Nothing reimplemented; no raw `memberships` read
  (ARM=hat clean by construction).
- `app.can_write_document(p_document_id uuid, p_uid uuid)` — mirrors the
  verified `can_write_attachment` semantics: `is_active` outer gate; case →
  `NOT is_case_excluded` + `is_staff_admin_of_for(commission)`; meeting →
  `is_staff_admin_of_for`; action_item → exclusion check + staff_admin OR
  assignee arms (`action_items.assigned_to` / open `action_item_assignments`);
  interview → `app.can_write_interview`. Unused by any policy in DM1 (no write
  paths exist); it is the contract surface DM2's commands call — shipping it
  now is the contract-first deliverable for this phase (§8).
- `app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)` —
  true iff an unexpired `upload_sessions` row in state `reserved`, owned by
  `p_uid`, joins a `file_objects` row in `reserved` whose
  `(storage_bucket, storage_path) = (p_bucket, p_name)`.

Policies (SELECT-only; exactly ONE policy per table so no permissive-sibling
can fake a keystone — §7.1-6 stated and kept by construction):
`documents_select` (kernel), `document_versions_select` /
`document_version_files_select` / `file_objects_select` (EXISTS-chain to a
readable document), `document_placements_select` (readable document),
`upload_sessions_select` (`reserved_by = auth.uid()`),
`document_retention_select` (authenticated — non-sensitive config),
`document_legal_holds_select` (staff_admin-of-home-commission or tenancy
admin — hold existence is write-authority governance metadata).

### Step 5 (M5) — buckets

Insert `documents-standard` + `documents-phi` into `storage.buckets`
(private; size cap + MIME allowlist mirroring the F2 buckets' live values —
read from `storage.buckets` at build time, recorded in the migration).
Policies on `storage.objects`:

- `documents_std_obj_insert_reserved` (INSERT, `TO authenticated`, WITH CHECK
  `bucket_id='documents-standard' AND app.storage_upload_reserved(bucket_id, name, auth.uid())`)
  and the `documents-phi` twin.
- **NO SELECT policy on either bucket, for any tier** (D8) — bytes flow only
  through DM2's audited `open_document_version` + service-role signing.

**How an INSERT policy binds to a reservation that cannot exist yet (the
lead's question 6):** the policy predicates over `upload_sessions` +
`file_objects` rows in state `reserved`. In DM1 those tables exist, are
RLS'd, carry **zero DML grants**, and have **no writer** — `begin_document_upload`
arrives in DM2. The predicate is therefore false for every possible caller:
the policy is live, fail-closed, and inert, and becomes operative the moment
DM2's reservation command exists, with no policy change. (The helper is
DEFINER so the policy's read of the reservation rows doesn't depend on the
caller's RLS view.) Whether DM2's upload credential flow (signed upload URL
vs. direct authenticated upload) even evaluates this policy is a DM2 question
(O4-adjacent); either way DM1 ships no path that opens the buckets.

### Step 6 (M6) — audit verbs + dispatch rows + flags

- `public.log_audit_access` allowlist: add `document.opened`;
  `app._audit_access_authorized`: add a `document.opened` arm →
  `app.can_read_document(p_entity_id, v_uid)`. (D11's disposition/reclass/hold
  events are writer-side `app.audit_write` calls inside DM2's commands — the
  generic writer needs no registration; only read-verbs enter the dispatch
  registry. `attachment.read` was already removed in M1.)
- `app.feature_flags` inserts, **targeted** `on conflict (key) do nothing`
  (the untargeted-ON-CONFLICT scar): `documents_foundation`,
  `documents_wave_a`, `documents_wave_b`, `documents_wave_c`,
  `documents_wave_d` — all `enabled = false`, descriptions carrying the house
  "resolve the VALUE … never this sentence" line. Seed does NOT enable them in
  DM1 (nothing consumes them yet).

## 4. Repo-side work in the same phase (one artifact with the chain)

- **`supabase/seed.sql`** — remove the three attachment fixture inserts
  (~L1431, ~L1811, ~L2781–2789) and the `attachments` flag enable (~L2253);
  adjust the referral shared-item fixture to a null `source_document_id`
  (keeping `frozen_storage_path` — the `case_documents_select_member` boundary
  and pgTAP 325 t4 still need a frozen snapshot fixture). Chain + seed are ONE
  artifact; a fresh `db reset` must be green with M1–M6.
- **pgTAP triage** — `208_attachments.sql` is deleted (it tests only the
  dropped substrate; its concerns are rebuilt as `328` now and the behavioral
  door tests return with DM2's doors). Every other suite matching
  `attachment` (`111`, `144`, `150`, `171`, `191`, `197`, `228`, `229`,
  `231`, `235`, `236`, `238`, `308`, `311`, `312`, `314`, `325` + the
  mutation-audit shells) gets a red-run triage: fixtures inserting
  attachments are rewritten, assertions about dropped surfaces removed —
  **each removal justified in the commit message** (never silently deleted;
  D5's "specs are rewritten, not deleted" applies to pgTAP too, with the
  substrate coverage moving into `328` and the flow coverage into DM2).
  `325` itself: t4 (case-documents positive control) and t2 stay exactly as
  written — DM1 is compatible with all four of its pins.
- **Allowlist hygiene** — remove `attachment_references_select` /
  `attachment_subjects_select` from `authz-blind-allowlist.txt` and
  `create_attachment` / `soft_delete_attachment` from
  `authz-neverclled-door-allowlist.txt` (their gates no longer exist); KEEP
  `add_referral_reply_attachment` / `get_referral_attachment_path` /
  `referral_reply_attachment_select_readable` entries. The
  `open_attachment` ERROR note in `authz-unswept-backlog.txt` resolves by
  deletion of the gate — noted in the phase record ("ERROR is not a pass"
  discharged by removal, not by inference).
- **TypeScript (my scope, `src/lib/**`)** — after `gen:types` the dropped RPC
  types vanish, so: `src/lib/attachments/actions.ts` +
  `src/lib/queries/attachments.ts` become inert stubs **keeping their exported
  signatures** and returning the module's existing typed failure shape with a
  pt-BR "recurso indisponível" message; the attachment functions inside
  `src/lib/cases/documents-actions.ts`, `src/lib/meetings/actions.ts`,
  `src/lib/interviews/actions.ts` are patched the same way (other actions in
  those files untouched); `src/lib/audit/access.ts` drops the
  `attachment.read` verb. UI components (`frontend`'s files) keep compiling
  unchanged and render their flag-off state. Signatures posted to the lead
  before implementation and kept stable (contract-first).
- **E2E (tester's scope — lead to sequence):** `phase-f2-attachments.spec.ts`
  plus attachment flows inside `cases-extras`, `phase11-interviews`,
  `ethics-e1-access-spine`, `quality-oversight`, `meeting-audio-minutes` will
  fail with the flag off / substrate gone. Per D5 they are rewritten against
  the new module **in DM2**; DM1 needs the tester to park/skip them
  explicitly. I do not touch `e2e/**`.

## 5. Keystones (suite `328_dm1_document_substrate.sql`) + mutation proof

Red-first discipline, per keystone:

- **K1 door-sweep (red-first by construction):** zero `%attachment%` routines
  in `pg_proc` (app+public), zero `%attachment%` policies in `pg_policies`
  (all schemas incl. storage), zero `%attachment%` relations, zero surviving
  `authenticated` grants on any of them — **minus the named allowlist of §3
  step 1** — PLUS a comment-stripped `prosrc` sweep asserting no surviving
  app/public function references the dropped routine names (this is what
  catches a missed `_audit_access_authorized`-class dependency; patterns built
  by string concatenation so the keystone cannot match its own literals).
  **Written and run BEFORE M1: observed RED (14 routines, 9 policies, 3
  tables). Green-on-first-run here is impossible by construction; I will
  report the observed red counts.**
- **K2 DM4 tombstones:** `case_documents_select_member` exists AND
  `app.can_read_snapshot_document` exists, asserted **by name** with a header
  mirroring 325-t4's "retire deliberately, never by accident" discipline —
  DM4's exit flips both to zero-count in the same change that empties the
  allowlist.
- **K3 registry:** anti-join = 0 for all four domain tables (every row has
  its typed registry row, post-backfill); inserting a fresh case/meeting/
  interview/action_item mints the registry row (trigger proof); tenant-shape
  CHECK `throws_ok`; the composite pin refuses a type-mismatched link.
- **K4 posture (§10.2 style):** for each of the 9 new tables — RLS enabled,
  `authenticated` = SELECT-only in `relacl` (zero DML), exactly ONE policy,
  policy cmd = SELECT.
- **K5 kernel:** `prosecdef = t`, `proconfig` carries the pinned
  `search_path`, PUBLIC/authenticated EXECUTE revoked (ACL asserted);
  behavioral rows under `set local role authenticated` +
  `request.jwt.claims`: member of the home commission reads the fixture
  document row (fixture inserted as postgres — no writer exists);
  cross-org persona reads 0; **`platform@test.local` reads 0** (noun rule);
  deactivated persona reads 0 (`is_active` outer gate). Assertions target
  `documents` — safe from the permissive-sibling trap because K4 pins the
  single-policy invariant in the same suite.
- **K6 buckets:** both bucket rows exist; **zero SELECT policies whose
  qual/with_check reference either bucket** (325's derivation dialect); the
  two INSERT policies exist; behavioral: `set local role authenticated` +
  INSERT into `storage.objects` on an unreserved path → denied; a
  hand-planted `reserved` session/file_object pair (as postgres) →
  `storage_upload_reserved` returns true for the owner, false for another
  uid and for an expired session.
- **K7 constraints:** UNIQUE(bucket,path) `throws_ok`; bucket-from-tier CHECK
  `throws_ok`; illegal `upload_state` transition `throws_ok`; version-row
  UPDATE `throws_ok` (immutability guard); `disposal_pending` under an active
  hold `throws_ok`.
- **K8 parked-seam writers (red-first):** `add_referral_shared_item` document
  arm raises; `add_rca_evidence` with `cited_document_id` raises;
  `issue_ethics_notification` with `p_related_document_id` raises. **Written
  before M1 and observed RED** (today all three succeed) — the cheap half of
  the mutation audit, done properly.
- **K9 flags:** the five keys exist and `enabled = false` **asserted as
  state**, not claimed (§7.3).
- **K10 audit dispatch:** `log_audit_access('attachment.read', …)` raises
  not-allowed; `document.opened` authorized for a reader persona, refused for
  a non-reader (positive + negative twin).

**Mutation audit (one mutation at a time, each inside a rolled-back txn or
restore-verified, runlog kept):** re-add a stub `app.probe_attachment_stub()`
→ K1 red; re-create a SELECT policy on `documents-phi` → K6 red; `grant insert
on documents to authenticated` → K4 red; add a permissive `USING (true)`
policy on `documents` → K4 single-policy red AND K5 cross-org deny red; open
`can_read_document` to `return true` → K5 noun-rule + cross-org reds; revert
the `add_referral_shared_item` patch → K8 red; drop the transition guard →
K7 red. Per §7.1: I verify each red is a FAILED assertion, not an aborted
suite (planned-vs-ran checked).

## 6. Census registration (the two binding traps, answered)

- **New gates entering the ADR-0079 domain:** 3 new `app.*` boolean DEFINER
  doors (`can_read_document`, `can_write_document`, `storage_upload_reserved`)
  + 10 new policies (8 table policies + 2 storage INSERT policies). ARM 3
  enumerates the LIVE catalog, so they enter the census domain automatically —
  which means **`ARM=census` must FAIL right after M1–M6 apply and before
  verdicts exist. I will run it there and require that failure** (the natural
  mutation-proof that the census sees the new doors), then run the
  **diff-scoped door sweep** over exactly the new/touched gates (list derived
  from the migration diff: the 3 doors, the 10 policies, plus the 6 rewritten
  functions from M1/M6), append the verdict rows to
  `docs/reviews/authz-door-audit-findings.md` (+ the row/write-path files as
  the sweep dictates), and re-run `ARM=census` to green. Findings-file
  discipline: restore the committed file first, APPEND — a subset run
  overwrites it (known scar); and I check the sweep's **reported case count is
  nonzero** before citing any of its numbers (the write-path arm is a no-op
  outside its hardcoded worklist — if the new write-relevant gates aren't in
  its worklist, I say so and cover them via the door-sweep + K-series twins
  instead of citing `BLIND: 0`).
- **`ARM=wrapper`:** DM1 adds **zero public INVOKER wrappers** (no public
  functions at all), so the committed invoker findings are unchanged and
  `FROMFINDINGS=1 ARM=wrapper` remains valid — stated, not assumed: I re-run
  it at gate. **`ARM=hat`:** no new gate reads `memberships` raw (the kernel
  delegates to existing role doors); re-run at gate. **`ARM=floor`:** DM1 adds
  no `authenticated`-reachable public DEFINER door, and removes five —
  their allowlist entries go too (§4).

## 7. Exit criteria mapping (what I run, when)

1. Fresh `supabase db reset` green (chain + rewritten seed) — after M1–M6 + seed surgery.
2. `npm run test:db` green on the fresh reset — after `328` + suite triage.
3. `npm run gen:types` + `npm run lint` + `npm run typecheck` + `npm run test` — after the TS stubs.
4. `ARM=census` (fail-then-green as §6), `ARM=hat`, `ARM=floor`,
   `FROMFINDINGS=1 ARM=wrapper` — at gate.
5. Diff-scoped door sweep over the touched-gate list, verdicts appended, case count verified nonzero — at gate.
6. Mutation runlog for the K-series twins — with the keystone commit.
7. Nothing user-visible changes in production (attachment UI already dark via D1's flag flip; local seed now matches).
8. E2E: full `e2e:prod` is lead-run; DM1 needs the tester's park list for the six attachment-touching specs first (Q4).

## 8. Contract-first deliverable (posted to the lead before building)

DM1 creates no frontend-facing queries, so the phase contract is: (a) the
**kept-stable signatures** of the stubbed attachment actions in
`src/lib/attachments/actions.ts`, `src/lib/queries/attachments.ts`, and the
three wrapper action files — unchanged shapes, now returning the module's
failure result with `"recurso indisponível"`; (b) the two kernel door
signatures DM2's commands and Wave-A queries will build against:
`app.can_read_document(p_document_id uuid, p_uid uuid) returns boolean` and
`app.can_write_document(p_document_id uuid, p_uid uuid) returns boolean`;
(c) the generated `database.ts` for the nine new tables.

## 9. Open questions (need answers before or during build)

- **Q1 (PO/lead, blocking only the ethics seam):** ethics
  (`decision_letter_document_id`, `related_document_id`) is in **no D13
  wave**. DM1 parks both (writers reject non-null). Which wave adopts ethics
  letters — A, B, or a named follow-up? Until ruled, the parked seams are the
  record.
- **Q2 (lead ack):** `rca_evidence.cited_document_id` parking until Wave
  D/DM5 — confirm.
- **Q3 (lead ack):** referrals lose "share a case document" (already
  unreachable in prod: flag off, zero case attachments) until DM4 — confirm
  the fail-closed pt-BR error is acceptable interim UX for local/E2E.
- **Q4 (lead + tester):** park list for the six attachment-touching E2E specs
  during DM1; rewrite lands in DM2 per D5.
- **Q5 (lead ack):** flag names `documents_foundation` + `documents_wave_a…d`.
- **Q6 (carried to DM2):** `UNIQUE(document_version_id, rendition_kind)` —
  provisional; loosen only if a wave needs multiple files per rendition.
- **Q7 (recorded obligation):** `dispose_case_phi` loses its
  attachment-redaction arm in M1; DM2 must wire case PHI erasure to document
  disposition for case-homed documents.

## 10. Estimate

**7–8 build turns** once approved: (1) K1/K8 red observation + M1; (2) M2 +
M3; (3) M4 + M5 + M6 + gen:types; (4) suite 328 + mutation runlog; (5) pgTAP
triage + seed surgery + fresh-reset green; (6) TS stubs + lint/typecheck/unit;
(7) authz arms + diff-scoped sweep + census fail-then-green + verdicts; (8)
buffer for triage fallout (the 16-suite red-run is the least predictable
item). Prod `db push` is a separate lead-authorized step (background agents
are auto-denied remote auth).

# Document model redesign — program plan (DM0–DM5)

> Executes **ADR 0109**. Source analysis:
> `docs/design/temp/document-model-audit-handoff.md` (external audit, findings
> re-verified by the lead against the live catalog 2026-08-11). Read ADR 0109
> first; this file adds sequencing, deliverables, and gate detail only.
> **Standing prerequisite for every phase:** `docs/progress/authz-handoff.md §7`
> before any RLS/DEFINER work; the live catalog — never migration text — is truth.

## Program invariants (bind every phase)

- One canonical model at all times — DM1 drops the old substrate before the new
  one takes writes; no dual-write, no adapters (ADR 0109 D2/D5).
- No SELECT policy on `documents-standard` / `documents-phi`; every byte flows
  through `open_document_version` → service-role short-TTL signing (D8).
- Buckets/paths derived server-side; caller-supplied bucket/path/size/MIME/hash
  are never trusted (D8/D9).
- Non-`clean`/`unscanned_accepted` content, `disposal_pending`, and `disposed`
  are NEVER served (D9/D10).
- Audit = Rule 11 floor exactly (D11). Titles contractually non-PHI (D12).
- Every phase: full CLAUDE.md §6 gate, `ARM=census`/`hat`/`floor`, diff-scoped
  door sweep over touched gates, mutation twins for every new keystone.
- PROGRESS.md updated at every start/finish/bug/gate step — never verbal-only.

## Phase DM0 — ratification (this worktree)

Deliverables: ADR 0109, this plan, PROGRESS.md program entry recording the
**already-executed** production flag flip (`attachments=false`, 2026-08-11) and
its accepted residual (non-flag-aware Storage policies on an empty bucket, killed
in DM1). Exit: human ratifies ADR 0109; phase identifiers allocated; worktree
branch merged (docs only).

## Phase DM1 — substrate cutover (backend-only, no UI)

**Drop (with proof):**
1. Migration drops: `attachments`, `attachment_references`, `attachment_subjects`;
   `app.commission_of_attachment`, `app.can_read_attachment`,
   `app.can_write_attachment`, `app.attachment_confidentiality_ok`; the seven
   attachment-named public RPCs (`create_attachment`, `open_attachment`,
   `dispose_attachment_phi`, `reclassify_attachment`, + list/update/delete
   variants — enumerate from `pg_proc` at build time, not from this list); every
   attachment-named `storage.objects` policy; the 4 dangling prod rows go with
   the table. Legacy per-feature policies on `meeting-attachments` /
   `case-documents` are dropped here too (their buckets retire in DM5).
2. **Door-sweep keystone (pgTAP):** after the drop, assert zero routines matching
   `%attachment%` in `pg_proc` (public + app), zero `%attachment%` policies in
   `pg_policies`, zero surviving grants. This keystone must FAIL if any door
   survives — prove it by mutation (re-add one stub → red).

**Create (per ADR 0109 D3/D4/D7/D8):**
3. `securable_resources` + shared-PK links from `cases`, `meetings`,
   `interviews`, `action_items` (typed composite-FK pinning per the participants
   registry precedent); tenant-shape CHECKs.
4. `documents`, `document_versions`, `document_version_files`, `file_objects`
   (UNIQUE `(storage_bucket,path)`, bucket-from-tier CHECK, upload/scan/disposal
   state columns), `document_placements` (non-authorizing), `upload_sessions`,
   `document_retention` (provisional values — O1), `document_legal_holds`.
5. RLS on from creation; authenticated DML revoked (command-only mutations);
   `app.can_read_document` / `can_write_document` kernel resolving through
   home-resource domain predicates (case capability, recusal, membership — reuse
   `app.has_case_capability` etc., do not reimplement).
6. Buckets `documents-standard` / `documents-phi` + INSERT-only policies bound to
   reserved upload paths. **No SELECT policies.**
7. Audit verbs + authorization dispatch rows for the D11 contract.
8. Flags: `documents_foundation` (substrate), plus per-wave consumer flags —
   all OFF.
9. `npm run gen:types`; pgTAP for every §10.2-style assertion (grants, prosecdef,
   search_path, constraints); seed personas extended only if a keystone needs one.

Exit: fresh `supabase db reset` green; pgTAP + authz arms green; census shows the
new doors; QA approves an inert-substrate review. Nothing user-visible changed.

## Phase DM2 — orchestration + Wave A (turns `attachments` experience back on)

1. Commands: `begin_document_upload` (validates actor/resource, reserves
   file-object + session, returns signed upload credential),
   `finalize_document_upload` (derives + verifies size/MIME/hash server-side;
   idempotent), `open_document_version` (D8/D10/D11 contract),
   `request_disposition` / disposal job / hold place+release,
   `reclassify_document_file` (copy→verify→commit→retire), reconciliation
   command reporting missing + orphan objects.
2. `src/lib/documents/` module (queries + actions) — the ONLY place that knows
   buckets/paths/signing. Frontend consumes projections; raw paths never leave.
3. Wave A UI: case / meeting / interview panels re-pointed to the new module
   (action-item panel stays substrate-only until a product flow exists, matching
   today). Upload states (pending/failed/unavailable/disposed) surfaced in pt-BR.
   Dialog copy corrected per D12. `frontend-design` skill mandatory.
4. E2E: attachment specs rewritten against the new flows incl. one keyboard-only
   flow; the §10.4-style mutation list for the new doors (drop disposed-check →
   red; restore a SELECT policy → red; serve non-clean → red; skip PHI audit →
   red; etc.).
5. Flag choreography at gate: `documents_foundation` ON + Wave A flag ON locally
   and in prod after human approval; legacy `attachments` flag key retired from
   the seed (the D1 flip becomes moot).

Exit: full §6 gate; `npm run e2e:prod` green; reconciliation report clean.

## Phase DM3 — Wave B: controlled documents

1. Backfill: each controlled document → registry row + core document; each
   version → core `document_version` + (where an object exists) verified
   `file_object`. **Production reality: 3 objects, 0 version rows referencing
   them — reconcile or quarantine each explicitly; never invent success.**
2. `set_document_version_file` replaced by the begin/finalize flow; raw
   `storage_path` writes end; column becomes derived/dropped.
3. Approval / effective / obsolete / review-cycle / charter linkage stay
   domain-owned (no flattening). Reviewer access expressed through the
   version-grant seam, not a bucket policy. No-PHI stance: PHI-tier input on
   controlled docs fails closed (D13).
4. Downloads through `open_document_version`; `controlled-documents` bucket
   SELECT policy dropped; prior-version downloads keep working for authorized
   commission members.

Exit: full lifecycle E2E green (draft→approve→publish→supersede→obsolete +
prior-version download); migration counts reconciled; gate + approval.

## Phase DM4 — Wave C: referrals (BLOCKED until referral-detail-redesign merges)

1. Snapshot/reply files become version/file/rendition records; frozen snapshots
   immutable even if the source document later changes/disposes.
2. `getReferralDocumentUrl` / `getReferralReplyAttachmentUrl` route through the
   audited open door; the `case-documents` signer dies (F-14). The 1 dangling
   frozen production row is reconciled (re-freeze or explicit tombstone).
3. Referral PHI authorization (`can_read_referral_phi`) remains the gate;
   document-layer access must not widen it — negative twin required.
4. Regression: fresh centralized PHI snapshot opens from the canonical bucket
   exactly once with exactly one audit row; the retired bucket path serves
   nothing.

Exit: referral E2E (source + target sides) green; audit-row exactness proven;
gate + approval.

## Phase DM5 — Wave D + retirement

1. NSP RCA/CAPA evidence onto the substrate (PQS/custody predicates preserved;
   NSP hard exclusions must not be bypassable via document access — mutation
   twin). Uploaded evidence vs. external links kept distinct.
2. Printed PDFs become `printed_pdf` renditions bound to their source; the
   verification-token flow and revoked/superseded overlays keep working from a
   satellite table; 4 production objects migrated copy→verify→switch.
3. Legacy retirement: for each of `attachments`, `attachments-phi`,
   `case-documents`, `meeting-attachments`, `interview-attachments`,
   `nsp-evidence`, `referral-attachments`, `controlled-documents`,
   `printed-documents`: prove zero DB references + zero product callers + zero
   policies, then empty + delete the bucket (Storage API only — never
   `storage.objects` DML). `form-assets` and `meeting-audio` remain (out of
   scope, D13).
4. ARCHITECTURE.md §2 + Rule updates (schema canon), `docs/backend-state.md`
   rewrite of the document surface, PHASES/PROGRESS record + rotation.

Exit: repo-wide sweep — no `storage_path` writes outside `src/lib/documents/`;
full `e2e:prod` green; QA program-level review; human approval; Record step.

## Serialization & shared-file constraints

- Wave C ⟂ referral-detail-redesign: DM4 does not start until that program's
  merge; the F-14 fix belongs to whichever lands second (tracked in PROGRESS).
- One backend owner for: migrations, Storage policies, signer routes, audit
  unions, generated types (never split across agents).
- Local DB is shared across worktrees — no DM migration work while another
  session holds uncommitted applied migrations (memory: two-sessions-one-DB).
- Migration windows allocated above the highest REGISTERED version at each
  phase start.

## Program acceptance (condensed from audit §14, minus deferred items)

1. Every protected file: one `file_objects` row, one unique `(bucket,path)`.
2. Upload lifecycle enforced; non-servable states never served.
3. Bucket derived from tier; unknown sensitivity fails closed.
4. Metadata RLS, open door, and signer agree for every tested persona
   (platform_admin noun-rule arm included).
5. D11 audit events exact — no missing, no duplicates.
6. Disposition blocks reads immediately; deletion verified; holds respected.
7. Domain invariants (controlled-doc lifecycle, referral freeze, NSP custody,
   case recusal/deliberation) survive their waves unchanged.
8. Zero raw-path authority outside `src/lib/documents/`; zero legacy
   buckets/policies/doors; reconciliation reports zero unexplained drift.

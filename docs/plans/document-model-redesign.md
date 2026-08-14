# Document model redesign — program plan (DM0–DM5)

> Executes **ADR 0114**. Source analysis:
> `docs/design/temp/document-model-audit-handoff.md` (external audit, findings
> re-verified by the lead against the live catalog 2026-08-11). Read ADR 0114
> first; this file adds sequencing, deliverables, and gate detail only.
> **Standing prerequisite for every phase:** `docs/progress/authz-handoff.md §7`
> before any RLS/DEFINER work; the live catalog — never migration text — is truth.

## Program invariants (bind every phase)

- One canonical model at all times — DM1 drops the old substrate before the new
  one takes writes; no dual-write, no adapters (ADR 0114 D2/D5).
- No SELECT policy on `documents-standard` / `documents-phi`; every byte flows
  through `open_document_version` → service-role short-TTL signing (D8).
- Buckets/paths derived server-side; caller-supplied bucket/path/size/MIME/hash
  are never trusted (D8/D9).
- Non-`clean`/`unscanned_accepted` content, `disposal_pending`, and `disposed`
  are NEVER served (D9/D10).
- Audit = Rule 11 floor exactly (D11). Titles contractually non-PHI (D12).
- Every phase: full CLAUDE.md §6 gate — `ARM=census`/`hat`/`floor` **and**
  `FROMFINDINGS=1 ARM=wrapper` — plus the diff-scoped door sweep over touched
  gates, and mutation twins for every new keystone. Two known traps bind here:
  every NEW door must be added to the census domain **and** the committed
  findings file in the same phase (a new wrapper passes `ARM=wrapper` vacuously
  by absence — ADR 0079 Am. 7), and the diff-scoped write-path `ARM=policy` step
  is a no-op outside its hardcoded worklist — check its reported case count is
  nonzero for the phase's new doors before citing it.
- PROGRESS.md updated at every start/finish/bug/gate step — never verbal-only.
- **No live users exist before the pilot** (the whole program is pre-pilot).
  Consequences used throughout: production data is the tiny 2026-08-11 census;
  no soak windows, shadow-comparison periods, or rollback-retention windows are
  required; a destructive re-run of a migration step is acceptable where it is
  cheaper than surgical repair. This does NOT relax any security keystone,
  gate, or catalog-proof step.

## Phase DM0 — ratification (this worktree)

Deliverables: ADR 0114, this plan, PROGRESS.md program entry recording the
**already-executed** production flag flip (`attachments=false`, 2026-08-11) and
its accepted residual (non-flag-aware Storage policies on an empty bucket, killed
in DM1). Exit: human ratifies ADR 0114; phase identifiers allocated; worktree
branch merged (docs only).

## Phase DM1 — substrate cutover (backend-only, no UI)

**Drop (with proof):**
1. Migration drops: `attachments`, `attachment_references`, `attachment_subjects`;
   the **five** centralized public RPCs (`create_attachment`, `open_attachment`,
   `dispose_attachment_phi`, `reclassify_attachment`, `soft_delete_attachment`);
   the **seven** `app.*` attachment routines — the four dispatchers
   (`commission_of_attachment`, `can_read_attachment`, `can_write_attachment`,
   `attachment_confidentiality_ok`) plus `assert_attachments_enabled` and the
   two trigger functions `guard_attachment_immutable` / `trg_audit_attachment`
   (dropping the table drops its triggers, NOT these functions); every
   centralized-attachment `storage.objects` policy
   (`attachments_obj_insert_writable`, `attachments_obj_select_readable`,
   `attachments_phi_obj_insert_writable`); the 4 dangling prod rows go with the
   table. Enumerate the final set from `pg_proc` / `pg_policies` at build time,
   not from this list — **but the referral module's surfaces are EXCLUDED and
   must survive until DM4**: `add_referral_reply_attachment`,
   `get_referral_attachment_path`, the `referral_reply_attachment` table policy,
   and the `referral_attachments_obj_insert` / `referral_attachments_obj_select`
   storage policies are live referral features, not centralized-attachment
   doors. A naive `%attachment%` sweep-and-drop breaks referrals.
   ⚠ **Amended 2026-08-12 (second catalog pass, same error class as the first):**
   the `case-documents` SELECT policy `case_documents_select_member` and its
   predicate `app.can_read_snapshot_document` are **NOT dropped here** — they are
   **referral-owned** and join the DM4 allowlist. The predicate resolves
   `referral_shared_item.frozen_storage_path` through
   `app.can_read_referral_phi`, and `getReferralDocumentUrl`
   (`src/lib/queries/referrals.ts`, ~L1100) signs that bucket with the **cookie
   client** — so this policy *is* the live boundary for referral snapshot
   downloads until DM4 replaces the path (ADR 0114 D8 reverses that topology
   *in DM4*, not before). Dropping it in DM1 breaks a live feature. This
   contradicted the plan's own referral-exclusion rule three lines above; the
   original text ("legacy per-feature policies on `case-documents` are dropped
   here too") is superseded by this note.
   `meeting-attachments` needs no conditional drop: migration
   `20260921000300_retire_meeting_attachments_bucket.sql` already retired it and
   the local catalog confirms 10 buckets with no meeting-attachment policies —
   verify prod at build time and record, but expect a no-op. (`case-documents`
   retires in DM5, after DM4 frees it.)
2. **Door-sweep keystone (pgTAP):** after the drop, assert zero routines matching
   `%attachment%` in `pg_proc` (public + app), zero `%attachment%` policies in
   `pg_policies`, and zero surviving grants — **minus an explicit, named
   allowlist containing exactly the referral-owned surfaces above**. The
   allowlist is broader than `%attachment%`: it also names
   `case_documents_select_member` + `app.can_read_snapshot_document`, which the
   `%attachment%` sweep does not match but which DM4 must still retire — assert
   them by name so DM4 cannot forget them. The
   allowlist is a keystone artifact: DM4's exit empties it and re-runs the
   keystone at zero exceptions. This keystone must FAIL if any non-allowlisted
   door survives — prove it by mutation (re-add one stub → red).

**Create (per ADR 0114 D3/D4/D7/D8):**
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

10. **Parked seams.** Four live tables held FKs INTO `attachments` that no program
    document named (found at backend plan time, catalog-verified): `rca_evidence`,
    `referral_shared_item`, `ethics_decision_details`, `ethics_notifications`. DM1
    drops those four FKs explicitly (never by CASCADE), keeps the columns as
    nullable parked seams, and makes each writer reject a non-null value
    (fail-closed, keystone K8). Adopting wave: `rca_evidence` → Wave D,
    `referral_shared_item` → Wave C. **The two ethics columns have no wave — see
    "Unassigned scope" below (Q1, PO ruling open).**

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
   ⚠ **Amended 2026-08-13 (lead; the path is already occupied).** `src/lib/documents/`
   is **not free**: it is the **Phase-17 controlled-document** module
   (`actions.ts` 931 + `types.ts` 289 + `version-select.ts` 80 lines), with its
   server readers in `src/lib/queries/documents.ts` (552 lines) — **32 files / 50
   import specifiers** across `src/` and `e2e/`. That module is **Wave B (DM3)**
   scope, not the core model. Two names for two substrates under one path would
   also make DM5's exit criterion (step 3 below) **vacuously satisfiable** — the
   legacy controlled-document signer would sit *inside* the directory the sweep
   declares clean, which is exactly the vacuous-assertion class this repo keeps a
   lint gate for. **Ruling:** the Phase-17 module is renamed
   `src/lib/documents/` → **`src/lib/controlled-documents/`** and
   `src/lib/queries/documents.ts` → **`src/lib/queries/controlled-documents.ts`**,
   as a **mechanical, behaviour-free rename** and the **first task of S2**, before
   the new core module is created. It is assigned to a **single owner** (`backend`)
   even though most import sites are components, because a cross-owner rename must
   be serialized (CLAUDE.md §4); it is path-only churn, not UI work. Verified by
   `tsc` + the 5-gate lint + a real `next build` (a client value-import from a
   server module aborts `next build` while tsc/lint/vitest stay green — the
   BUG-FBE-005 class). DM3 rewrites that module's internals anyway when Wave B
   folds controlled documents onto the core aggregate.
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
6. **ADR 0114 Open item O4 revisited here** (per the ADR): signed-URL TTL per
   sensitivity + whether any content class warrants streaming-proxy serving,
   decided with the PO against real DM2 latency; record the decision in the ADR.

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

5. **Ethics document seams — IN SCOPE (Q1 RULED 2026-08-13, ADR 0114 Amendment 2 /
   D17).** This wave adopts `ethics_decision_details.decision_letter_document_id`
   and `ethics_notifications.related_document_id`. All four discharge conditions
   are binding, and a partial discharge is not a discharge: re-point both columns
   to `documents(id)` **with a real FK**; restore `issue_ethics_notification`'s
   `p_related_document_id` to a working parameter (⚠ the param **still exists** —
   catalog-verified; the refusal is in the **body**, so this is a body change, not
   a DROP+CREATE that would discard the ACL); remove the fail-closed rejection;
   **remove keystone K8**, which pins that rejection; **and add
   `p_decision_letter_document_id` to `set_ethics_decision_details`, forwarded from
   `src/lib/ethics/actions.ts`** — condition 5, added 2026-08-13 because the
   original four were incomplete: that column has **no writer at any layer**
   (11 RPC params, none a document id; the TS action drops the field at
   `actions.ts:393`), so an FK alone yields a column pointing at documents nothing
   can create.
   **Scope boundary (PO, 2026-08-13): plumbing to writable, NO UI.** No
   attach-a-letter affordance ships in DM3 — none has ever existed, and a decision
   letter is the archetypal `legal_privileged` document, so its UI needs the ETH·E1
   spine + D15 ceiling designed as a feature. → **FUP-DM3-ETHICS-UI**.
   ⚠ **Lifecycle machinery is shared; the reader set is NOT.** Ethics case reads
   are gated by the ADR 0072 / ETH·E1 spine (`case_access_grants` +
   `max_confidentiality` + recusal), with the D15 ceiling column as the surviving
   mechanism. Prove the ethics arm against that spine with a **negative twin** —
   reusing Wave B's lifecycle must not import Wave B's readers.

Exit: full lifecycle E2E green (draft→approve→publish→supersede→obsolete +
prior-version download); ethics seam discharged on all four conditions with the
negative twin green; migration counts reconciled; gate + approval.

## Phase DM4 — Wave C: referrals

> Former blocker RESOLVED: referral-detail-redesign merged + pushed 2026-08-12,
> so the F-14 fix belongs here (it landed second). ⚠ That program was itself
> partially superseded by REG·KIND / ADR 0110 — at phase start, re-verify the
> referral query/action surface (function names below included) against the
> CODE and the referral RPCs against the CATALOG; do not trust names recorded
> before those merges.

1. Snapshot/reply files become version/file/rendition records; frozen snapshots
   immutable even if the source document later changes/disposes.
2. `getReferralDocumentUrl` / `getReferralReplyAttachmentUrl` (names as of the
   audit — re-verify per the note above) route through the audited open door;
   the `case-documents` signer dies (F-14). The 1 dangling frozen production row
   is reconciled (re-freeze or explicit tombstone).
3. Referral PHI authorization (`can_read_referral_phi`) remains the gate;
   document-layer access must not widen it — negative twin required.
4. Referral attachment surfaces migrate off the legacy substrate:
   `add_referral_reply_attachment` / `get_referral_attachment_path`, the
   `referral_reply_attachment` policy, and both `referral_attachments_obj_*`
   storage policies are replaced/dropped here — **plus
   `case_documents_select_member` and `app.can_read_snapshot_document`**, which
   DM1 deliberately spared (see the DM1 amendment) because they are the live
   cookie-client boundary for frozen snapshots until step 2 above lands.
5. **DM1 keystone closure:** empty the DM1 referral allowlist — all of it,
   including the two non-`%attachment%` case-documents entries — and re-run the
   door-sweep keystone at zero exceptions.
6. Regression: fresh centralized PHI snapshot opens from the canonical bucket
   exactly once with exactly one audit row; the retired bucket path serves
   nothing.

Exit: referral E2E (source + target sides) green; audit-row exactness proven;
keystone at zero exceptions; gate + approval.

## Phase DM5 — Wave D + retirement

1. NSP RCA/CAPA evidence onto the substrate (PQS/custody predicates preserved;
   NSP hard exclusions must not be bypassable via document access — mutation
   twin). Uploaded evidence vs. external links kept distinct.
2. Printed PDFs become `printed_pdf` renditions bound to their source; the
   verification-token flow and revoked/superseded overlays keep working from a
   satellite table; 4 production objects migrated copy→verify→switch.
3. Legacy retirement: for each of `attachments`, `attachments-phi`,
   `case-documents`, `meeting-attachments` (**if it exists** — see DM1 note;
   absent from the current local catalog), `interview-attachments`,
   `nsp-evidence`, `referral-attachments`, `controlled-documents`,
   `printed-documents`: prove zero DB references + zero product callers + zero
   policies, then empty + delete the bucket (Storage API only — never
   `storage.objects` DML). All bucket deletions batch here **deliberately** —
   even buckets already empty and policy-less since DM1 — so there is exactly
   one retirement manifest; do not delete any early. No rollback-retention
   window is required (no live users). `form-assets` and `meeting-audio` remain
   (out of scope, D13).
4. **Operational closure (slimmed pre-pilot hardening — dispositions the audit's
   D7 phase, which this plan otherwise drops):** name the operational owner and
   execution mechanism (pg_cron / scheduled job / manual runbook) for the
   disposal job and the reconciliation command; one backup/restore drill of DB +
   Storage together on the pre-pilot stack; capture baseline `EXPLAIN` + latency
   for document list / open / sign as the pilot's comparison point. Full
   production-volume performance testing and staged rollout are **explicitly
   deferred to the pilot** (PO-accepted: no live users, ~45 objects).
5. ARCHITECTURE.md §2 + Rule updates (schema canon), `docs/backend-state.md`
   rewrite of the document surface, PHASES/PROGRESS record + rotation.
   **Named obligations for the Rule updates (so they cannot be lost — QA r1
   INFO-4, recorded 2026-08-13):** alongside the D8 Rule-1 sharpening this
   step already owes, **Rule 9's text must carve the documents-module
   exception it currently lacks**: `src/lib/documents/actions.ts` reads
   `file_objects` / `document_version_files` inline with the admin client,
   justified in the module header per ADR 0118 §1 (storage coordinates
   resolve ONLY there, which is what makes this step's exit sweep meaningful
   by construction) and QA-accepted as topology — but Rule 9 as written
   admits no exception, so today the rule and the accepted practice
   contradict. Name the exception in the Rule's own text, scoped to the
   coordinate-resolving module, when this step rewrites the canon.

Exit: repo-wide sweep — no `storage_path` writes outside `src/lib/documents/`;
full `e2e:prod` green; QA program-level review; human approval; Record step.
⚠ **The sweep criterion is only meaningful because of the DM2 step-2 amendment**
(2026-08-13): `src/lib/documents/` holds the **core model alone**, the Phase-17
controlled-document module having been renamed to `src/lib/controlled-documents/`.
Run the sweep by **identifier** (`storage_path`, `storage_bucket`, bucket string
literals, `createSignedUrl`), never by directory alone — a directory-scoped sweep
is a boundary drawn on a syntax rather than on the property being asserted.

## Serialization & shared-file constraints

- Wave C ⟂ referral-detail-redesign: **RESOLVED** — that program merged + pushed
  2026-08-12 before any DM implementation phase, so the F-14 fix belongs to DM4
  (it lands second). Kept for the record; DM4 carries a re-verification note.
- One backend owner for: migrations, Storage policies, signer routes, audit
  unions, generated types (never split across agents).
- Local DB is shared across worktrees — no DM migration work while another
  session holds uncommitted applied migrations (memory: two-sessions-one-DB).
- Migration windows allocated above the highest REGISTERED version at each
  phase start.

## ✅ RULED 2026-08-13 — the per-document confidentiality ceiling (was: BLOCKS DM2)

> **PO ruling: option 1**, recorded as **ADR 0114 Amendment 1 (D15/D16)**. The
> ceiling is re-expressed on `documents` (nullable confidentiality column + an arm
> in the `app.can_read_document` kernel) as an explicit **interim**, and the general
> access plane is **scheduled at Phase 19** with `documents.access_policy_id` named
> as its landing point. **FUP-DM1-CEILING is no longer a blocker — it is now a DM2
> prerequisite**: build D15's column and kernel arm *before* Wave A re-points any
> case / meeting / interview document. Not built in DM1 (that would have reopened a
> closed gate for a new migration). The analysis below is retained as the record of
> why; the options section is retained so the choice is not re-litigated blind.

**The control that was dropped.** ADR **0072 D7 / ETH·E1** made the attachment
confidentiality labels `legal_privileged` and `credentialing_sensitive`
**ENFORCING**, not informational: a document could be gated **above** ordinary
case-read. `e2e/ethics-e1-access-spine.spec.ts` encodes it as an acceptance
contract — AC-4a/b/c/d put two documents on the **same** ethics case where an
ordinary reader sees one and is denied the other, and AC-9 is a keyboard-only
path to the privileged one. DM1 dropped its enforcement mechanism
(`app.attachment_confidentiality_ok`) along with the substrate.

**Why ADR 0114 does not cover it.** D6 defers the audience/sharing plane — a
mechanism for **widening** access (share with a user, group, scoped role). The
confidentiality ceiling is the opposite: it **narrows** access below the home
resource. D6's "document access = home-resource access" is precisely the
statement that makes the ceiling inexpressible. **ADR 0114 does not supersede
ADR 0072**, so this is a live authorization control with no replacement, not a
deliberate simplification.

**`sensitivity_tier` is not the ceiling.** The new model's only classification
column is `file_objects.sensitivity_tier ∈ {standard, phi}` (verified against
every column of `documents` / `document_versions` / `document_version_files` /
`file_objects`). It selects a **bucket** by CHECK constraint (D8). It carries no
principal-facing gate and cannot express "readable by cleared case readers only".

**Why this blocks DM2 rather than the ethics wave.** The label lived on
`attachments` generally, and `cases.confidentiality_level` is snapshotted from
`attachments.confidentiality_label`. **Wave A re-points case / meeting /
interview documents.** If a wave lands document re-pointing before the ruling, a
document formerly gated above case-read becomes readable by every ordinary case
reader — a silent authorization regression introduced by a data-model migration,
in a module whose access spine is a different ADR. Present real-world risk is
**zero** (flag off, zero bytes, no wave carries ethics yet), which is exactly why
it is easy to wave through: this is the QO·B lesson — *a subtractive phase needs
over-cut guards, and one of them guards a ruling from a different ADR that a
later sweep would otherwise reverse without ever reading it.*

**Options for the ruling** (each needs an ADR 0114 amendment):

1. **Re-express the ceiling on `documents`** — a nullable confidentiality column
   plus a kernel arm, restoring ADR 0072 D7 semantics before Wave A re-points
   anything. Smallest behavioural delta; adds a narrowing dimension the ADR
   deliberately kept out of the aggregate.
2. **Pull the ceiling forward into the deferred access plane (O3)** — accept that
   O3 must now cover narrowing as well as widening, and schedule it **before**
   Wave A rather than "if/when a feature commits to it".
3. **Ratify the loss explicitly** — rule that per-document ceilings are not part
   of the target model, retire ADR 0072 D7's enforcing status by amendment, and
   delete the AC-4/AC-9 contracts deliberately. Legitimate, but it is a
   **product decision to widen access to privileged legal material** and must be
   made in the open, never by omission.

**Discharge condition.** A PO ruling recorded as an ADR 0114 amendment, plus
either a restored control or an explicit retirement of ADR 0072 D7's enforcing
status. pgTAP `228` t36–40 stay retired until the control returns — the coverage
comes back with the mechanism, not before.

**PO decision status: RULED 2026-08-13 — option 1 + option 2 at Phase 19.**
(Deferred 2026-08-12, ruled the next day.) Recorded as **ADR 0114 Amendment 1**:
D15 re-expresses the ceiling on `documents` as an interim DM2 prerequisite; D16
schedules the general access plane at **Phase 19** (Surveyor Access), where it must
cover **both** directions and absorb D15's column. Option 3 (ratify the loss) was
**rejected**. The deciding evidence for D16 was that the platform has answered "a
non-member needs to see specific things" three times bespoke — `referral_shared_item`,
`case_access_grants`, and Phase 19's planned `surveyor_grants` — and that **F-14, a
load-bearing finding behind ADR 0114 itself, was a bug inside one of them**.

## ✅ RULED 2026-08-13 — the ethics document seams (was: Q1, unassigned scope)

> **PO ruling: option 1 — Wave B (DM3)**, recorded as **ADR 0114 Amendment 2
> (D17)**. The discharge conditions are now binding DM3 scope; see DM3 step 5.
> Option 2 (Wave A / DM2) was already foreclosed at ruling time — DM2 had closed
> and been approved, so it would have meant reopening a completed phase. Option 3
> (a follow-up after DM5) was rejected: it closes the legacy-retirement manifest
> with two columns pointing at nothing.
>
> The section below is kept as the record of the gap and the pre-ruling state.

> Raised by `backend` at DM1 plan time, verified by the lead against the live
> catalog 2026-08-12. **Owner: PO.** Blocks nothing in DM1; must be ruled before
> whichever wave adopts it is planned.

**The gap.** ADR 0114 **D13** enumerates four consumer waves — A case / meeting /
interview / action_item, B controlled documents, C referrals, D NSP evidence +
printed renditions. **Ethics is in none of them**, yet two live ethics columns
pointed at the substrate DM1 just dropped:

| Column | Writer | Rows (local) |
| --- | --- | --- |
| `ethics_decision_details.decision_letter_document_id` | *none* — a seam only; `get_ethics_case_procedure` projects it | 3 rows, 0 non-null |
| `ethics_notifications.related_document_id` | `public.issue_ethics_notification`, fed from `src/lib/ethics/actions.ts` (`p_related_document_id`) | 2 rows, 0 non-null |

This is a **scope gap, not a deferral** — nothing decided to postpone it; the wave
decomposition simply never covered ethics. Recorded here because a reader of ADR
0114 D13 would not see the omission, and the DM1 backend plan's §9 Q1 is not where
a future wave owner looks.

**Current state (DM1, verified in the catalog post-M1).** Both columns survive as
nullable `uuid` with **their FKs dropped and no replacement FK** — parked seams.
`issue_ethics_notification` now **rejects a non-null** `p_related_document_id`
(fail-closed, keystone K8). Unreachable in practice: with `attachments = false`
and zero attachment bytes, no document id could ever have been produced. **Until
the PO rules, these parked seams ARE the record of the decision not yet made.**

**Not to be confused with the two seams that DO have owners:**
`rca_evidence.cited_document_id` → Wave D, and
`referral_shared_item.source_document_id` → Wave C (DM4). Both are parked by the
same mechanism, but their adopting wave is already named. Ethics is the only orphan.

**Options for the ruling:**

1. **Wave B (DM3) — lead's recommendation.** A disciplinary decision letter is a
   governed document with an approval/effective lifecycle; it is the same shape as
   a controlled document and would reuse that wave's machinery rather than needing
   its own. Costs DM3 a modest scope increase.
2. **Wave A (DM2).** Gets ethics onto the substrate soonest, but ethics letters are
   not case/meeting/interview attachments and would ride a wave built for a
   different access shape.
3. **A named follow-up after DM5.** Legitimate — the seams are inert and nothing
   regresses — but it means the legacy-retirement manifest in DM5 closes with two
   columns still pointing at nothing, which must then be stated in that manifest
   rather than read as an oversight.

**Discharge condition (whichever wave adopts it).** Re-point both columns to
`documents(id)` (or drop them, if the ruling is that ethics letters are not
document-model citizens); restore `issue_ethics_notification`'s parameter; remove
the fail-closed rejection **and** the K8 keystone that pins it — a keystone left
pinning a rejection the product no longer wants is a test asserting a bug.
Cross-referenced from DM1 (parked seams) and DM3 (the likely home).

## Program acceptance (condensed from audit §14, minus deferred items)

> Deferral ledger (so nothing is silently dropped): audit §14 items 1–13 map
> below or to their wave exits; item 14 (measured performance at scale) and
> item 15's production-scale recovery rehearsal are **deferred to the pilot**
> (PO-accepted — no live users; DM5 step 4 keeps a baseline drill + `EXPLAIN`
> capture); the sharing/audience plane is deferred per ADR 0114 D6/O3; scanner
> integration per O2.

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

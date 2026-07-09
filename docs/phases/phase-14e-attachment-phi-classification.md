# Phase 14e — Centralized Attachment Substrate (PHI-classified)

> **Status:** PLANNED — not started. Approved design; execution deferred (planned 2026-07-09).
> **Supersedes** the earlier narrow "Attachment PHI Classification (Cases & Meetings)" plan that
> occupied this slot — that plan added a `contains_phi` flag to two tables; this one generalizes
> the fix into a centralized substrate and still delivers everything the narrow plan promised.
> **Track:** PHI hardening (extends ARCHITECTURE Rule 12 to a shared attachments layer).
> **Depends on:** Phase 14 (NSP/PHI safeguards), Phase 13 (audit trail).
> **Sequencing (D14):** build NEXT, before resuming the 15 → 17 → 16 pre-pilot track (ADR 0057).
> **ADR:** [0063](../decisions/0063-centralized-attachments-substrate.md) — **WRITTEN** (2026-07-09;
> refines this plan). It adds six seams to the §3.1 core: single-owner + non-authorizing
> `attachment_references`, descriptive PHI-safe `attachment_subjects`, `document_group_id`/
> `supersedes_id` (versioning/redaction), `confidentiality_label`, `scan_status`, and
> `legal_hold` + `dispose_attachment_phi`. **Concrete revised core DDL:**
> [attachments-core-schema-draft.md](../design/attachments-core-schema-draft.md) — build B1/B4 from
> that draft, not the terse §3.1 sketch below. Remaining doc updates (ARCHITECTURE Rule 12 + Rule 6
> footnote, `docs/backend-state.md`) still at execution.

---

## 1. Context (why this change)

Document upload is becoming a first-class, expanding capability (near-term: a Form question-block
that uploads files, and attachments on Action Items). Two facts force the redesign now:

1. **Sprawl.** File upload is re-implemented in **seven** places (form-template images,
   `case_documents`, `meeting_attachments`, `case_interview_attachments`, `rca_evidence`,
   `capa_action_evidence`, `referral_reply_attachment`), each cloning the same ritual with its own
   bucket, table, RLS, and divergent MIME lists. Every new surface becomes an 8th/9th copy.
2. **PHI.** Uploaded documents are the most PHI-dense artifacts on the platform, yet
   case/meeting/interview docs sit **outside** the Rule-12 regime — membership-only RLS, **no
   PHI-read auditing**, and list queries pre-sign every file (no per-open chokepoint).

**Outcome:** one `attachments` core owning the *physical* file facts + a `sensitivity_tier`, with
a shared upload/immutability/audit path and **tiered buckets** (PHI physically segregated);
**authorization + lifecycle stay domain-owned**, dispatched per `owner_type` via `SECURITY
DEFINER` helpers; PHI is a first-class tier (segregated + every read audited); and staff-fillable
upload surfaces get an explicit ingress-control contract. Designed to absorb future upload
surfaces that may or may not carry PHI.

Delivers everything the superseded 14e promised: the audited PHI-read door, the Phase-19
export-redaction contract, the audit allow-list additions, the fail-closed default, and
interview-attachment coverage (formerly the reserved "14f").

---

## 2. Decisions locked (D1–D14)

- **D1 — Breadth.** Build the core; native home for the two NEW surfaces (form-item uploads,
  action-item attachments); FOLD IN `case_documents`, `meeting_attachments`,
  `case_interview_attachments` (files only). DEFER via the wrapper pattern: `rca_evidence`,
  `capa_action_evidence`, `referral_reply_attachment`. LEAVE ALONE: `controlled_documents`,
  form-template images.
- **D2 — Shape.** Single polymorphic `attachments` core; ALL common fields on the core (`title`,
  `description`, generic `kind text`, nullable `occurred_on` + physical facts + owner + tier +
  soft-delete). No extension tables now, but a stable uuid PK + `text` `owner_type`/`kind` (no
  enums) so a 1:1 `<owner>_attachment_meta` can bolt on later. `kind` validated per `owner_type`
  in the write RPC.
- **D3 — Files-only core.** `storage_path NOT NULL`. Interview EXTERNAL LINKS stay outside the
  core (small `case_interview_links` table); only interview *file* rows fold in; UI merges.
- **D4 — Dispatch.** One `app.can_read_attachment(owner_type, owner_id, uid)` DEFINER dispatcher
  (CASE → existing domain predicates) used by BOTH the core-table and bucket SELECT policies. No
  INSERT policy; a DEFINER upload RPC checks a parallel `app.can_write_attachment`. Path
  `{owner_type}/{owner_id}/{uuid}.{ext}`.
- **D5 — Two buckets + audited re-home.** `attachments` (standard) + `attachments-phi`
  (locked-down); `sensitivity_tier` picks the bucket. Reclassify = staff_admin-only, audited,
  server-side re-home: copy → repoint → HARD-DELETE source (documented Rule-6 PHI-safety
  exception). Row + audit history persist.
- **D6 — Fail-closed default.** Default `tier=phi` for case/meeting/interview/form-upload/
  action-item (per-owner policy). Uploader always sees the toggle. Anyone may upload AS PHI; only
  staff_admin may DECLASSIFY, at upload or later.
- **D7 — Hard PHI door.** Non-PHI: list mints a signed URL directly, no audit. PHI: the
  `attachments-phi` bucket denies authenticated signing; a DEFINER door re-gates + writes
  `log_audit_access('attachment.read', …)`, then Next signs a short-TTL URL with the
  **service-role** key. Every PHI open is provably audited.
- **D8 — Delete/immutability.** Soft-delete rows (object retained); objects immutable except the
  D5 re-home; all writes via DEFINER RPCs (no direct grants); `guard_attachment_immutable` freezes
  physical columns outside `app.in_attachments_rpc`.
- **D9 — New-surface scope.** Build action-item attachments (first new consumer). Form-item uploads
  DESIGN-ONLY: reserve `owner_type='form_upload'` + the ingress contract (builder-set `phi_policy
  ∈ always_phi | may_be_phi(default) | never_phi`; filler may raise-to-PHI, never declassify).
  Feature built later on the flexible-forms track.
- **D10 — Disposal.** Extend each `dispose_*_phi` with one redaction line vs the core keyed by
  `(owner_type, owner_id)` — redact `title`/`description`, retain row + object.
- **D11 — Export contract.** Binding SQL COMMENT on `sensitivity_tier` + ADR: export MUST
  withhold/redact `phi`-tier attachments (honored by future Phase-19 exporter).
- **D12 — Flag + structure.** New `attachments` flag (seed OFF; flip ON at gate;
  `app.assert_attachments_enabled()`). Keep the `14e` slot; internal workstreams under ONE Phase
  Gate.
- **D13 — Doc substitution.** This doc replaces the narrow 14e plan; PROGRESS.md row 14e updated;
  accreditation-track + PHASES notes; ARCHITECTURE Rule 12 + Rule 6 footnote (at execution);
  `docs/backend-state.md` (at execution); new ADR; re-home the interview("14f") + NSP/referral
  wrapper follow-up notes; regenerate graphify.
- **D14 — Sequencing.** Build it NEXT, before resuming 15 → 17 → 16. Pre-launch (DB reset OK):
  DROP the three folded tables and rewire code in a clean forward migration (no back-compat views).
- **Baked-in defaults:** 25 MiB cap + superset MIME (images + PDF + full Office + csv/plain) at the
  bucket, owner/item may narrow; `sha256` recorded, NOT unique; `owner_id` has NO real FK
  (polymorphic) → no PostgREST embeds, explicit two-step reads only.

---

## 3. Design

> **⚠ Revised by ADR [0063](../decisions/0063-centralized-attachments-substrate.md).** The
> authoritative, annotated core DDL now lives in
> [docs/design/attachments-core-schema-draft.md](../design/attachments-core-schema-draft.md)
> (superset of the folded tables + the six ADR-0063 seams). §3.1 below is the original terse sketch,
> kept for context; where they differ, the schema draft wins. Core-shape items (references, subjects,
> `document_group_id`/`supersedes_id`) MUST land in B1.

### 3.1 Core `public.attachments`
`id uuid pk`, `owner_type text`, `owner_id uuid`, `kind text default 'outro'`, `title text`,
`description text`, `occurred_on date`, `storage_bucket text`, `storage_path text not null`,
`mime_type text`, `size_bytes bigint`, `sha256 text`, `sensitivity_tier text default 'phi'`,
`uploaded_by`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`. CHECKs: `owner_type` in
the phase value set; `tier ∈ {phi,standard}`; **bucket↔tier consistency**; `storage_path like
owner_type||'/'||owner_id||'/%'`. Indexes on `(owner_type, owner_id)` (+ partial not-deleted),
`tier`, `uploaded_by`. Binding COMMENTs on `sensitivity_tier` (export-redaction, D11) and
`title`/`description` (PHI-bearing, redacted by disposal). RLS SELECT = the dispatcher; SELECT
grant only.

### 3.2 Triggers
- `app.guard_attachment_immutable` (BEFORE UPDATE) — freezes physical + owner + bucket/tier columns
  unless `app.in_attachments_rpc='on'` (clone of `guard_case_narrative_frozen`).
- `app.trg_audit_attachment` (AFTER I/U/D) — `app.audit_write('attachment.created|updated|
  reclassified|deleted', 'attachment', id, app.commission_of_attachment(...), …, app.audit_diff(
  old,new, {owner_type,owner_id,kind,sensitivity_tier,storage_bucket,occurred_on,deleted_at}))`.
  The `audit_diff` allow-list NEVER includes title/description/storage_path/sha256 (Rule 11).

### 3.3 Dispatchers (schema `app`, DEFINER)
- `commission_of_attachment(owner_type, owner_id)` → CASE to `commission_of_case/meeting/
  interview/action_item`; `form_upload`→null.
- `can_read_attachment` — `case`→`can_read_case`; `meeting`/`interview`→membership OR
  commission-admin; `action_item`→membership OR org-admin; else false.
- `can_write_attachment` — `case`/`meeting`/`action_item`→staff_admin OR org-admin (recommended:
  also the action-item assignee); `interview`→`can_write_interview`; else false.

### 3.4 Storage
- Two private buckets `attachments` / `attachments-phi` (25 MiB, superset MIME).
- `attachments`: INSERT + SELECT via the dispatcher on `foldername[1]=owner_type`,
  `foldername[2]=owner_id`.
- `attachments-phi`: INSERT via `can_write_attachment`; **NO authenticated SELECT** → only the
  service-role client signs (D7 hard door), via `src/lib/supabase/admin.ts::createAdminClient()`,
  signing ONLY the `(bucket, path)` the audited door returned, short TTL.

### 3.5 RPCs (`public`, DEFINER)
`create_attachment` (assert flag; `can_write_attachment`; validate `kind` per owner_type; tier
default `phi`, declassify requires staff_admin; verify object exists in the tier bucket; insert);
`soft_delete_attachment`; `reclassify_attachment` (directional authz; brackets
`app.in_attachments_rpc`; flip bucket+tier; Next orchestrates copy → RPC → remove-source);
`open_attachment(id) returns (bucket, path)` (re-gate → log `attachment.read` for phi → return).

### 3.6 Fold-in rewire (clean forward migration; DROP the three tables)
- **`case_documents` — coupled.** Repoint two inbound FKs into the deferred systems
  (`rca_evidence.cited_document_id`, `referral_shared_item.source_document_id`) → `attachments(id)
  on delete set null`; rewrite `add_referral_shared_item` + `get_referral_detail` readers; replace
  the `dispose_case_phi` redaction with the D10 core line. Rewire `queries/case-documents.ts` +
  `cases/documents-actions.ts`.
- **`meeting_attachments` — clean drop.** Drop table + RPCs + policies; rewire `queries/meetings.ts`
  + `meetings/actions.ts`.
- **`case_interview_attachments` — split (D3).** New `case_interview_links` (links only); file rows
  → core (`owner_type='interview'`); re-express the case-scope read as the core `interview` arm;
  rewire `interviews/actions.ts` + `queries/interviews.ts` (list merges files + links).
- **Legacy buckets** `case-documents`/`meeting-attachments`/`interview-attachments`: retire; drop
  policies in a follow-up cleanup migration after cutover.

### 3.7 Action-item attachments (new consumer, D9)
`owner_type='action_item'`, owner `public.action_items`. Read = membership OR org-admin; write =
staff_admin/org-admin (recommended: also `action_items.assigned_to = uid`). Default tier `phi`;
kinds `{evidencia, outro}`. New "Anexos" panel under `src/components/action-items/`.

### 3.8 Form-item ingress contract (DESIGN-ONLY — reserve, do not build)
`owner_type='form_upload'` reserved (dispatchers return false). Reserve `form_items.phi_policy text
default 'may_be_phi' check in (always_phi, may_be_phi, never_phi)`, set only by the staff_admin
building the form. Fail-closed rules per D9. Documented in the ADR; no form-item code this phase.

### 3.9 TS layer
`src/lib/queries/attachments.ts` (`AttachmentWithUrl` with `containsPhi`/`signedUrl|null`,
`listAttachments`, `openAttachment`); `src/lib/attachments/actions.ts` (`uploadAttachment`,
`deleteAttachment`, `reclassifyAttachment` + per-domain thin wrappers); add `'attachment.read'` to
`src/lib/audit/access.ts`; add `attachments` to `src/lib/queries/feature-flags.ts` +
`attachmentsEnabled()`.

---

## 4. Task breakdown (contract-first; backend posts typed stubs first)

**Backend** — B1 core migration **[FULL PLAN REVIEW]** (table+triggers+dispatchers+RLS+flag; add
`attachment.read` to BOTH `log_audit_access` allow-list AND `app._audit_access_authorized` — else
`supabase/tests/191_grant_hardening.sql` fails); B2 storage migration **[FULL PLAN REVIEW]** (two
buckets + four policies, phi bucket denies authenticated SELECT); B3 write RPCs; B4 fold-in
migration **[FULL PLAN REVIEW]** (FK repoints + drops + `case_interview_links` + `dispose_*` D10
lines); B5 enable migration (flag flip at gate); B6 gen types; B7 TS layer (post stubs first).

**Frontend** (uses `frontend-design`) — F1 PHI toggle in upload dialogs (default on; staff_admin
declassify); F2 list-row PHI badge + open-via-button for phi, direct link for standard
(keyboard-operable, accessible); F3 staff_admin reclassify control; F4 action-item attachments
panel.

**Docs (lead)** — D1 ADR 0063; D2 this doc + re-home the "14f"/wrapper follow-ups; D3 PROGRESS.md,
accreditation-track, ARCHITECTURE Rule 12 + Rule 6 footnote, backend-state, graphify regen.

**Ordering:** B1 → B2 → B3 → B4 → B6 → B7(stubs) → F1–F4 → B5. B4 is a single migration (a
half-applied drop breaks `rca_evidence`/`referral_shared_item`).

---

## 5. Verification

- **Vitest**: list returns `signedUrl:null, containsPhi:true` for phi vs a real URL for standard;
  `openAttachment` signs via service-role only for phi; upload rejects bad MIME/size, routes to
  the tier bucket, blocks a non-staff_admin declassify.
- **Playwright** `e2e/attachments.spec.ts`: upload defaults phi → badge + no list URL; keyboard-only
  phi open writes exactly one `attachment.read` (correct actor/entity/commission, empty metadata);
  staff_admin declassify → re-home → standard-bucket sign, no new `.read`, `attachment.reclassified`
  present; non-staff_admin declassify → pt-BR forbidden; mirror meeting + action-item; interview
  file→core, link→`case_interview_links`, merged panel.
- **pgTAP** `supabase/tests/207_attachments.sql`: RLS; guard freezes physical columns outside
  `in_attachments_rpc`; dispatcher truth table; `open_attachment` null-for-foreigner; phi bucket
  denies authenticated SELECT. Extend `191_grant_hardening.sql` with an `attachment.read`
  authorized-vs-unauthorized pair.
- **DB/gate**: `supabase db reset` applies the wave; `gen types`; gate E2E on a standalone/prod
  build with `--workers=1` after a fresh reset (flag ON via seed for the gate; `_enable` migration
  is the prod flip).

---

## 6. Risks

1. **`case_documents` drop reaches DEFERRED systems** (top hazard) — two inbound FKs + three
   readers must be repointed to `public.attachments` in the same B4 migration.
2. **Service-role blast radius** (D7) — the admin client signs ONLY the door-returned `(bucket,
   path)`, never client input; `server-only`; short TTL. Enforced by code review of
   `openAttachment()`.
3. **Re-home hard-delete vs Rule 6** (D5) — documented PHI-safety exception; order copy → repoint →
   delete-source; record in the ADR + a Rule 6 footnote.
4. **Polymorphic owner = no FK** — no PostgREST embeds; explicit two-step reads; orphan owners
   become unreadable (dispatcher false), no GC in v1.
5. **Audit allow-list is a triple mirror** — `log_audit_access` + `_audit_access_authorized` + the
   TS union must all gain `attachment.read` together.
6. **Out of scope** — the CAPA-evidence insert-policy wart; `controlled_documents`, form images, and
   the rca/capa/referral wrappers stay deferred (except the forced FK repoint in #1).

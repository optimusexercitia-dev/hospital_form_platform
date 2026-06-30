# Phase 14e — Attachment PHI Classification (Cases & Meetings)

> **Status:** PLANNED — not started. Pick-up-ready execution plan (approved 2026-06-30).
> **Track:** PHI hardening (extends ARCHITECTURE Rule 12 to file attachments).
> **Depends on:** Phase 14 (NSP/PHI safeguards established), Phase 13 (audit trail).
> **First execution step (when picked up):** confirm this file is registered in `PROGRESS.md`
> (Phase Status table, row `14e`), then recreate the Current-Phase Tasks table and begin B1.

---

## 1. Context & rationale

Case documents (`case_documents`) and meeting attachments (`meeting_attachments`) are the
artifacts most likely to be PHI-dense in the platform — a `digitalizacao` (scanned patient
record), a signed `ata`, a `lista_presenca`. Today they sit **outside** the PHI regime that
Rule 12 + ADRs 0030/0035/0037 built for the rest of the system:

- Protected only by **commission-membership RLS** + a private bucket.
- **No PHI-read auditing** — opening one leaves no trail (contrast `event_patient.read`,
  `meeting.viewed`).
- `listCaseDocuments` / `listMeetingAttachments` **batch-mint 1-hour signed URLs for every
  file on load** (`createSignedUrls`), so any member already holds working links — there is no
  per-file open chokepoint to audit.
- The future Phase-19 surveyor/evidence export has **no signal** for which attachments are PHI.

**Decision (this phase):** add a **default-sensitive classification with an explicit
staff-admin downgrade**, wired to two behaviors — (1) **PHI-read auditing** of file opens, and
(2) a **carried classification + documented contract** that Phase-19 export must honor
(withhold/redact). *Not* disposal, *not* a mere visual label. Default-sensitive keeps faith
with the platform's "structural isolation over self-declaration" philosophy: everything is PHI
until a staff_admin explicitly declassifies it — the opposite of a fail-open opt-in checkbox.

**Scope:** `case_documents` + `meeting_attachments` only. Interview attachments
(`case_interview_attachments`) share the pattern and Rule 12 lists interview summaries as
PHI-bearing → **fast-follow (Phase 14f), not built here.**

**Feature flag:** none new. `logAuditAccess` already no-ops when the `audit_trail` flag is off,
so audit behavior degrades cleanly; classification + open-routing are always on.

---

## 2. Design decisions (binding)

1. **Column:** `contains_phi boolean NOT NULL DEFAULT true` on both tables. Default-sensitive;
   downgrade = `false`, staff_admin only. Classification governs **how the file is opened and
   exported**, NOT table row visibility — RLS read policies are unchanged.

2. **Audited single-door open (core mechanism).** Stop pre-signing sensitive files:
   - List queries batch-mint signed URLs **only for `contains_phi = false`** rows; sensitive
     rows return `signedUrl: null` + `containsPhi: true`.
   - Opening a sensitive file routes through an **audited open function** that re-reads the row
     (RLS still authoritative), mints a JIT signed URL, and emits a `*.read` audit row.
   - Mirrors the `*.viewed` app-layer precedent, but tightened: because the URL is no longer in
     the list payload, the audited function is the only practical door — an effective
     single-door without a new `SECURITY DEFINER` RPC.

3. **Export contract (design-now, build-with-Phase-19).** Phase 19 does not exist yet. Deliver
   the column + a binding SQL `COMMENT` + ADR stating: *evidence/surveyor export MUST withhold
   or redact any attachment with `contains_phi = true`.* Same "documented in COMMENT, honored by
   future exporter" pattern Rule 12 uses for `minutes_md`, case-event `body`, etc.

4. **Reclassification is audited** as a governance event (a declassification is security-
   relevant). Emit through the existing mutation audit path.

---

## 3. Contract-first signatures (Backend posts these BEFORE implementing — frontend builds against them)

```ts
// src/lib/queries/case-documents.ts  (extend CaseDocumentWithUrl)
type CaseDocumentWithUrl = { /* …existing… */ containsPhi: boolean; signedUrl: string | null }
// signedUrl is null for sensitive rows; open via openCaseDocument()
export async function openCaseDocument(documentId: string): Promise<string | null> // audited JIT URL

// src/lib/queries/meetings.ts  (extend MeetingAttachmentWithUrl)
type MeetingAttachmentWithUrl = { /* …existing… */ containsPhi: boolean; signedUrl: string | null }
export async function openMeetingAttachment(attachmentId: string): Promise<string | null>

// src/lib/cases/documents-actions.ts
export async function setCaseDocumentPhi(documentId: string, containsPhi: boolean): Promise<ActionResult>
// src/lib/meetings/actions.ts
export async function setMeetingAttachmentPhi(attachmentId: string, containsPhi: boolean): Promise<ActionResult>
// upload actions: add optional `containsPhi?: boolean` (defaults true via DB)

// src/lib/audit/access.ts  (extend the union)
type AuditAccessAction = /* …existing… */ | 'case_document.read' | 'meeting_attachment.read'
```

---

## 4. Task breakdown

### Backend (`backend` teammate) — **plan review required** (touches a migration + the audit allow-list)

- **B1 — Migration** `supabase/migrations/<ts>_attachment_phi_classification.sql`:
  - `ALTER TABLE public.case_documents ADD COLUMN contains_phi boolean NOT NULL DEFAULT true;`
  - `ALTER TABLE public.meeting_attachments ADD COLUMN contains_phi boolean NOT NULL DEFAULT true;`
  - `COMMENT ON COLUMN` both — state the export-redaction + audited-open contract (Rule 12).
  - `CREATE OR REPLACE FUNCTION public.log_audit_access(...)` — add `'case_document.read'` and
    `'meeting_attachment.read'` to the positive allow-list at
    `supabase/migrations/20260620008000_audit.sql:613-617`.
  - Confirm whether `app.audit_write` enforces its own action allow-list; if so, add
    `'case_document.reclassified'` / `'meeting_attachment.reclassified'` mutation verbs, else
    emit reclassification through the standard mutation path. Document which.
  - No RLS change to the SELECT policies; existing `*_staff_admin_write` already gates downgrade.
- **B2 — Types:** `supabase gen types typescript --linked > src/lib/types/database.ts`.
- **B3 — Audit union:** add the two `*.read` actions to `AuditAccessAction` in
  `src/lib/audit/access.ts` (~lines 24-45).
- **B4 — Case query layer** `src/lib/queries/case-documents.ts`:
  - `listCaseDocuments` (130-179): select `contains_phi`; build the `createSignedUrls` path list
    from **non-PHI rows only**; map `containsPhi`; sensitive rows → `signedUrl: null`.
  - Add `openCaseDocument(documentId)`: fetch row (id, storage_path, contains_phi, case_id +
    its commission) → mint JIT signed URL → if `contains_phi`, `logAuditAccess({ action:
    'case_document.read', entityType: 'case_document', entityId: documentId, commissionId,
    summary: 'Documento de caso aberto' })`. Keep/retire `getCaseDocumentDownloadUrl` per usage.
  - `setCaseDocumentPhi` action in `src/lib/cases/documents-actions.ts` (staff_admin via RLS),
    update column, audit the reclassification, `revalidatePath`.
- **B5 — Meeting query layer** `src/lib/queries/meetings.ts`: mirror B4 for
  `listMeetingAttachments` (622-664) + `openMeetingAttachment`, action
  `'meeting_attachment.read'`; `setMeetingAttachmentPhi` in `src/lib/meetings/actions.ts`.

### Frontend (`frontend` teammate) — uses `frontend-design` skill for badge/affordance

- **F1 — Upload dialogs** `src/components/cases/case-document-upload.tsx`,
  `src/components/meetings/attachment-upload.tsx`: **no opt-in PHI checkbox** (default-sensitive).
  Add an optional downgrade at the bottom — *"Este arquivo não contém dados de paciente"*
  (unchecked by default → stays PHI), wired to the optional `containsPhi` upload arg.
- **F2 — List rows** (components rendering `listCaseDocuments` / `listMeetingAttachments`):
  sensitive rows show a pt-BR badge *"Contém dados de paciente"* and open via a button calling
  `openCaseDocument` / `openMeetingAttachment` (not a bare `<a href>`); non-PHI rows keep the
  direct link from `signedUrl`.
- **F3 — Reclassify control:** staff_admin-only row affordance (downgrade / re-flag) calling
  `setCaseDocumentPhi` / `setMeetingAttachmentPhi`, with optimistic refresh.
- **F4 — A11y:** keyboard-operable open + reclassify; visible focus; badge has accessible text.

### Docs (lead)

- **D1 — ADR** `docs/decisions/00NN-attachment-phi-classification.md` (5-10 lines): default-PHI +
  downgrade, audited open, Phase-19 export-redaction contract, why not a bare opt-in checkbox.
- **D2 — ARCHITECTURE.md Rule 12:** one-line note that attachments carry an explicit PHI flag
  feeding export redaction + audited open.

---

## 5. Acceptance criteria

1. New case/meeting attachment defaults to `contains_phi = true`; list payload contains **no
   pre-signed URL** for it; it renders the *"Contém dados de paciente"* badge.
2. Opening a sensitive attachment succeeds and writes exactly one `audit_log` row with
   `action = 'case_document.read'` (resp. `meeting_attachment.read`), correct actor/entity/
   commission, **no PHI in metadata** (`{}`), when `audit_trail` flag is ON.
3. A staff_admin can downgrade an attachment to non-PHI; afterward it opens via a direct link,
   produces **no** `*.read` row, and the badge disappears. The downgrade itself is audited.
4. A non-staff_admin member cannot reclassify (RLS denial → pt-BR error, no raw PG error).
5. RLS read visibility of attachment rows is unchanged from pre-phase behavior.
6. SQL COMMENT on `contains_phi` records the export-redaction contract; ADR + Rule 12 updated.
7. `npm run lint && npm run typecheck && npm run test` pass; full `npx playwright test` green.

---

## 6. Phase gate (per CLAUDE.md §6)

1. Build complete — backend + frontend tasks done; lint/typecheck/unit green locally.
2. Test pass — spawn `tester`: Playwright specs for the criteria above (incl. ≥1 keyboard-only
   open of a sensitive file); fix loop on failing+phase specs; full suite to declare green.
3. QA review — spawn `qa`: requirements audit + RLS/audit-coverage review →
   `docs/reviews/phase-14e-review.md`, verdict APPROVED / CHANGES REQUESTED.
4. Human approval — lead presents summary; waits.
5. Record — PROGRESS.md → ✅ + commit hash; rotate task detail to
   `docs/progress/phase-14e.md`; update `docs/backend-state.md` (new column, `*.read` actions,
   open functions); commit `phase(14e): complete — attachment PHI classification`.

---

## 7. Files touched (summary)

- **New:** migration `…_attachment_phi_classification.sql`; ADR `00NN-…md`.
- **Backend:** `src/lib/types/database.ts`, `src/lib/audit/access.ts`,
  `src/lib/queries/case-documents.ts`, `src/lib/queries/meetings.ts`,
  `src/lib/cases/documents-actions.ts`, `src/lib/meetings/actions.ts`.
- **Frontend:** `src/components/cases/case-document-upload.tsx`,
  `src/components/meetings/attachment-upload.tsx`, and the case/meeting attachment list/render
  components.
- **Docs:** `ARCHITECTURE.md` (Rule 12), `PROGRESS.md`.

---

## 8. Verification (end-to-end)

- **Unit (Vitest):** list returns `signedUrl: null` + `containsPhi: true` for a PHI row, real
  URL for a downgraded row; `openCaseDocument`/`openMeetingAttachment` call `logAuditAccess`
  only when `contains_phi`.
- **E2E (Playwright, `e2e/`):** as `chefe.ccih@test.local` — upload (defaults sensitive) → badge
  + no list URL; open → succeeds and `audit_log` has `case_document.read`; downgrade → opens
  directly, no new audit row. Mirror one meeting flow. Include keyboard-only open.
- **DB:** `supabase db reset --linked` applies the migration; `gen types` picks up
  `contains_phi`; manual `select` confirms default `true`.
- Gate-green run: full `npx playwright test` with `--workers=1` after fresh reset (per E2E gate
  mechanics).

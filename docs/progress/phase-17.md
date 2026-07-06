# Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)

**Status:** ✅ COMPLETE — 2026-07-06 · QA **APPROVED** (0 BLOCKER · 0 MAJOR · 3 MINOR all
cleared · 4 INFO) · branch `feat/phase-17-controlled-documents`.
Spec: `docs/phases/accreditation-track.md:427-506`. Decisions: ADR
[0057](../decisions/0057-indicators-doc-control-replan.md) (esp. decisions 5 & 6).
Review: [phase-17-review.md](../reviews/phase-17-review.md). PHI-free by design (Rule 12 N/A).

The core of JCI **MOI** document control: hospital policies/POPs/protocolos/regimentos
under a controlled lifecycle `rascunho → em_aprovacao → vigente → obsoleto`, with a
named-approver e-signature workflow, effective/expiry dates, a scheduled review cycle, and a
controlled-document register (commission-scoped + a hospital-wide DEFINER rollup).
Built 2nd of the pre-pilot order 15 → 17 → 16 (ADR 0057).

## What shipped

### Backend (migrations `20260713000000`–`…000400`)
- **`…000000_controlled_docs_core.sql`** — 3 tables (`controlled_documents` →
  `controlled_document_versions` → `document_approvals`) with text-CHECK enums, version-level
  status, per-commission `DOC-####` mint. RLS posture (b): member-read + **version-scoped
  approver-read arm** (a pending/decided approval row grants read of just that doc/version),
  SELECT-only grants, no direct write. Immutable Storage bucket `controlled-documents` (25 MB,
  private, INSERT+SELECT only — Rule 6, new path per version). State-machine guard (HC089) +
  frozen-approver-set guard (HC093). Audit AFTER-triggers with a strict non-sensitive
  allow-list (never `title`/`summary_of_changes_md`/`note`/`storage_path`). Flag seeded OFF.
  RLS cross-referential recursion (version↔approval policies) fixed via three `SECURITY
  DEFINER` helpers (`app.is_document_approver_of` / `is_document_version_approver` /
  `can_read_document_of_version`), owner=postgres, search_path-pinned, non-re-entrant.
- **`…000100_controlled_docs_rpcs.sql`** — ~9 lifecycle RPCs (create/update/add-version/
  submit/approve/reject/publish/supersede/obsolete) + `set_document_version_file`.
  Sign-own-row + per-signer `signature_hash` = `sha256(storage_path||':'||approver_id||':'||
  decision)`. Submit = **delete-then-insert** the approver set; all-must-approve gate (HC090);
  duplicate (HC092); foreign/inactive approver (HC091). HC089–HC093 pt-BR mapped.
- **`…000200_controlled_docs_reads.sql`** — `documents_due_for_review`,
  `hospital_document_register`, `list_approver_candidates` — all DEFINER, PHI-free/
  minimum-necessary, REVOKE-ALL-FROM-PUBLIC → GRANT (t19).
- **`…000300_form_publish_metadata.sql`** — additive `form_versions` cols (`approved_by/at`,
  `effective_date`, `review_due_date`) captured **inside** `publish_form_version`
  (pure pass-through; `guard_published_version` UNTOUCHED — metadata rides the status-flip
  UPDATE, settable only via the RPC).
- **`…000400_enable_controlled_docs.sql`** — the Record-step prod flag flip.
- Data-access `src/lib/queries/documents.ts` + actions `src/lib/documents/actions.ts`
  (immutable upload-then-RPC; `mapDocumentError` HC089+→pt-BR). Types `documents/types.ts`.

### Frontend (F1–F7)
Route group `src/app/o/[org]/c/[commission]/manage/documentos/**` + org-level approval queue
`o/[org]/documentos-pendentes/**` + hospital register `o/[org]/manage/documentos/page.tsx`.
Register + filters, new/edit draft + atomic file upload, detail (versions, approvals +
signature state, lifecycle affordances), org-level approver-detail sign page (reachable by
outside-commission approvers, gated on `getDocument≠null`), review-due list (docs + overdue
forms), F7 optional publish-metadata fields. Shared `src/lib/documents/version-select.ts`
(`selectWorkingDraft`/`selectSignableVersion`/`findMyApprovalForVersion`) consumed by both
detail pages so the "in-force vs actionable version" logic can't diverge.

## Locked decisions (ADR 0057)
- Approvers = any active same-hospital user (incl. outside-commission); frozen set while
  `em_aprovacao`; a pending/decided row grants scoped read; all must sign `aprovado` to
  publish; `rejeitado` → `rascunho`.
- `current_version_id` is the **in-force** pointer (readers/register/review-due) and stays on
  the vigente version during a revision; the open draft drives authoring affordances. On
  publish, the pointer moves to the new version and the prior → `obsoleto` (retained +
  downloadable).
- Forms-as-controlled-docs = metadata-only, backward-compatible (all-NULL when unset).
- Flag OFF in migration (prod-safe) / ON in seed (local) / prod flip = this Record step.
- Lead calls during the phase: B4 `effective_date` pure pass-through; bucket 25 MB; reject =
  delete pending siblings; per-signer signature hash.

## Test gate
- Build: tsc 0 · lint 0 err · Vitest 206/206.
- pgTAP **47/47** (full suite Files=68, Tests=1717, PASS on fresh reset) — guards, version-
  scoped approver arm + no broad grant, immutable bucket, review-due math + override, register
  + candidates PHI-free scope, form-metadata-via-RPC-only + immutability, reject-cleanup (§10).
- Phase E2E **14/14** (0 flakes) — full lifecycle with an outside-commission signer, approver
  isolation + no-leak, publish gate, reject→resubmit, supersede, review-due (docs + overdue
  forms), immutable per-version paths, form publish-metadata, foreign-hospital HC091, hospital
  register scope, audit no-leak, flag gate, keyboard-only.
- Full `--workers=1` regression: 588 passed, **0 Phase-17 regressions** (10 late failures were
  environmental — GoTrue rate-limit — all 10 pass in isolation on a fresh reset).

## Bugs found + fixed (5, all tester-verified; DB-proven each)
- **BUG-DOC-001** (BLOCKER) — systemic form↔action FormData field-name mismatch broke the whole
  UI write path; aligned the 4 write forms to the action contract (+ split a latent
  supersede-through-AddVersionForm mis-wire into a two-step flow).
- **BUG-DOC-002** (MINOR/seed) — seed `storage_path` had no backing object → NULLed the path
  (honest "Sem arquivo"; real bytes not seedable via SQL; download coverage = AC-1 real upload).
- **BUG-DOC-003** (BLOCKER) — `approvers` JSON camelCase vs snake-case RPC → mapped
  camel→snake in the action (TS↔SQL boundary; frontend stays camelCase).
- **BUG-DOC-004** (BLOCKER) — supersede UI dead-end on the coordinator page → separated
  in-force version from working draft (backend state correct, per lead).
- **BUG-DOC-005** (BLOCKER) — org approver-detail page signed the wrong version after a
  supersede → whole-documents-UI sweep + extracted the shared `version-select.ts` helper (also
  fixed a second latent coordinator `isPendingApprover` cross-version bug). Removed the
  divergence class by construction.

## QA MINORs (all cleared before Record)
- **MINOR-1** — reject left stale pending approval rows granting read of the private rascunho →
  `decide_document_approval_core` (rejeitado branch) now DELETEs pending siblings, keeps the
  rejeitado row; pgTAP §10 (plan 42→47) proves the read-denial. Committed `4b19bbd`.
- **MINOR-2** — editar route past `rascunho` showed a generic error → now `notFound()` (404),
  gated on the shared `selectWorkingDraft`; E2E coverage added.
- **MINOR-3** — overdue computed two ways → removed the redundant detail-header JS recompute;
  DB timezone is UTC so the `listDocuments` JS helper (`toISOString().slice(0,10)`) matches SQL
  `current_date` — resolved by alignment. Residual: purely theoretical non-UTC-DB config edge
  (doesn't apply — Supabase defaults to UTC), carried as documented.

## Deferred / carried
- Prod deploy deferred to the pilot (ADR 0057); the `controlled_docs` prod flag is flipped ON
  by `…000400` but reaches prod only at the pilot deploy.
- MINOR-3 residual non-UTC-DB edge (documented; N/A under UTC default).

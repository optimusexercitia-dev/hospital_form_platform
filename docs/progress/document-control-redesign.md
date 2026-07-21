# Controlled-Document Redesign (Phase 17 v2)

**Status:** ✅ COMPLETE — human-approved 2026-07-21; ff-merged to local `main`. Flag `controlled_docs`
unchanged (prod-OFF till pilot). PHI-free (Rule 12 N/A). Branch `feat/document-control-redesign` (worktree).
**Plan:** [docs/plans/document-control-redesign.md](../plans/document-control-redesign.md) · **ADR:**
[0081](../decisions/0081-controlled-document-redesign.md) (extends [0069](../decisions/0069-status-key-anglicization.md)).
**QA:** [document-control-redesign-review.md](../reviews/document-control-redesign-review.md) (APPROVED, 0/0/0/4 INFO).
**Backend surface:** `docs/backend-state.md` § DOC-REDESIGN.

Rebuild of the shipped Phase-17 controlled-document UI to the "Document Control" design handoff
(`docs/design/temp/document_control_frontend.md`), translated onto this platform's own tokens/components (not the
prototype's mm.css / 3-theme / IBM-Plex-CDN; typography already matched). PO interview locked scope 2026-07-21.

## What shipped

- **Create flow → all-in-one wizard** (4 steps + Save-as-draft) and a **new-version wizard** (locked identity →
  `supersedeAndSubmitDocument`).
- **4 feature gaps:** approver **notifications + Remind** (first document integration of the Phase-20 substrate);
  **version compare** modal (metadata + change-summary; body-text diff deferred); **category + tags**;
  **retired-vs-superseded** (`obsolete_kind`).
- **Register full-adopt:** KPI strip + filter chips (incl. derived "Em revisão" + "Arquivados") + search + table +
  approval mini-bar.
- **Enum-key anglicization (controlled-docs only):** `doc_type` → `policy|sop|protocol|bylaws|manual|other`,
  `decision` → `approved|rejected`; **pt-BR labels unchanged**; `commission_charters` `regimento`→`bylaws` in
  lockstep; ethics module's pt-BR enums untouched (function-scoped replace). PO chose `pop→sop`, `regimento→bylaws`.
- **PO adds:** the new-version wizard and a `description` field (column + wizard + edit form + detail header).
- **Fixes folded in:** a latent data-loss bug (`update_controlled_document` overwrite would wipe category/tags — the
  edit form now always posts them); the two hardcoded-emerald chips → `success` token; a worktree-nested standalone
  build issue (`next.config.ts` `outputFileTracingRoot = process.cwd()`, `4e56efc`).

## Build sequence (contract-first)

- **Wave 1 backend** `5752aa9` — B0 anglicization + B1 schema + B2 RPCs + B3 chained create/draft actions + B4
  reads/filters + §4 notifications + `remind_document_approver`. Two keystone traps handled: a stale-local-DB DEFINER
  re-emit (→ the repo's runtime-rewrite pattern) and two extra B0 couplings (`upsert_commission_charter`,
  `trg_audit_document_approvals`) swept in lockstep.
- **Wave 2 frontend** `ba29228`→`7e7630c` — 6 shared composites (Stepper/Dropzone/ReviewerPicker/TagField/Segmented/
  ChecklistRail) + register + create wizard + detail (compare + Remind) + notification deep-links + token cleanup.
- **Wave 2.5** (PO adds) `a8dbb7e` (backend: `supersedeAndSubmitDocument` + `description` + `list_commission_documents`
  register fields) + `7e7630c` (frontend: new-version wizard mode + Descrição + drop N+1).
- **Tester** `e2d2530`,`c10a67c`,`f26b6c5`,`f87165e` — `documents-redesign.spec.ts` (11) + ported `phase17-documents.spec.ts`
  (14) + `helpers/documents.ts`.

## Test gate (§6)

- **Step 1:** tsc 0 · lint 0 · **Vitest 369/369** (B0 broke 0 unit tests).
- **Step 2 tester:** **25/25** (chromium `--workers=1`, run twice on independent fresh resets, no flakes) · **0 app bugs**
  (all fix-loop reds were spec-code). pgTAP `201` **29/29**.
- **Step 2 full `e2e:prod`:** 797 pass / 8 fail / 2 flaky → **all 8 reds triaged pre-existing or environmental; 0
  redesign regressions** (documents **12/12 in-suite**). Proof by isolation on fresh resets:
  - `notifications.spec.ts` (7 reds, all cascading from one `open_capa_plan` setup call) → **8/8 isolated**.
  - `meetings-reserved-sessions.spec.ts` (1 red, BUG-STAGEC-READER) → **green isolated**.
  - `ethics-e2-procedure.spec.ts` `FLOW-7` keyboard native-`<select>` vote (ArrowDown didn't advance the value;
    ethics data lifecycle FLOW-1…6 passed) → **fails identically on `main`** (byte-identical spec, next 16.3) =
    pre-existing macOS-Chromium flake. Filed as a separate task.
  - The notifications CHECK rebuild was confirmed a **superset** (dropped no CAPA value), ruling out an enum regression.
- **Step 3 QA:** **APPROVED** (0/0/0/4 INFO). Live-catalog-verified: the new DEFINER read `list_commission_documents`
  (flag- + commission-authority-gated, anon/public REVOKE'd), `remind_document_approver` (body-gated staff-admin +
  REVOKE), B0 weakened no authority check (`publish_document` all-must-approve keeps `decision <> 'approved'`), audit
  whitelist excludes category/tags/description.
- **Step 4:** human-approved 2026-07-21. **Step 5:** this record + backend-state § DOC-REDESIGN + phase row + ff-merge.

## Follow-ups (pre-existing / non-blocking — filed as task chips)

- **Hollow `document_approvals` RLS keystone** (`252_authz_p0_isolation.sql`) — asserts a hardcoded id seeded nowhere
  (verified absent on `main` too), so both halves are meaningless. Base-branch, predates this phase.
- **`FLOW-7` ethics keyboard-vote flake** — fails identically on `main`; drive the native select deterministically.
- The 8 base-branch pgTAP reds (`250/251/252`) remain the AUDIT-DOOR-BLINDNESS follow-up burn-down, unrelated here.

## Deferred (out of scope; ADR 0081)

Document-body text diff; scheduled/future-dated effective activation; expiry auto-obsolete; in-browser preview;
design-time tweak prefs; platform-wide enum anglicization (this pass was controlled-docs only). Remote `db push` +
Coolify deploy ride the pilot (when the `controlled_docs` flag reaches prod).

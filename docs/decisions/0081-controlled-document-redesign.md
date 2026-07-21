# 0081 — Controlled-Document Redesign + Reviewer Notifications

**Date:** 2026-07-21 · **Status:** accepted. **Owner:** lead → backend/frontend/tester/qa.
**Branch:** `feat/document-control-redesign` (worktree). **Redesigns:** Phase 17 (ADR
[0057](0057-indicators-doc-control-replan.md)); flag `controlled_docs` (prod-OFF until pilot —
unchanged). **PHI:** none (Rule 12 N/A). **Plan:**
[docs/plans/document-control-redesign.md](../plans/document-control-redesign.md). **Extends:**
ADR [0069](0069-status-key-anglicization.md) (enum-key anglicization).

## Context

The shipped Phase-17 controlled-document UI is rebuilt to the "Document Control" design handoff
(`docs/design/temp/document_control_frontend.md`), **translated onto this platform's own
tokens/components** — not the prototype's `mm.css` / 3-theme / IBM-Plex-CDN system (typography
already matches: both use the IBM Plex trio). A PO interview (2026-07-21) locked the scope below.

## Decisions

1. **Create flow → all-in-one wizard.** Details → file → reviewers → confirm → submit, with a
   **Save-as-draft** exit. No new atomic RPC: a server action chains
   `create → attach-file → submit`; a partial failure lands the user on the created draft's detail.
2. **Four functional gaps built:**
   - **a. Approver notifications + Remind** — wire the Phase-20 substrate (which has *zero* document
     integration today): notify named approvers on submit, staff_admin on review-due/expiry, and a
     staff_admin-gated `remind_document_approver` RPC. Adds `NotificationKind`/`EntityType` values.
   - **b. Version compare** — metadata + change-summary side-by-side (existing data; a document-**body**
     text diff is deferred).
   - **c. Category + tags** — new `controlled_documents.category` (free-text) + `tags text[]`.
   - **d. Retired vs superseded** — new `controlled_document_versions.obsolete_kind`
     (`'superseded'` set by `publish_document` when it retires the prior version; `'retired'` by
     `mark_document_obsolete`).
3. **Register → full adopt** — KPI strip + filter chips + search + table + approval-progress bar.
4. **Enum-key anglicization (this module only).** Rename the two residual pt-BR enum keys ADR 0069
   deferred, by its exact 1:1 method (keys change; **pt-BR labels unchanged**):
   `doc_type`: politica→**policy**, pop→**sop**, protocolo→**protocol**, regimento→**bylaws**,
   manual→**manual**, outro→**other**; `decision`: aprovado→**approved**, rejeitado→**rejected**.
   New enums (`obsolete_kind`) are English. **Scope = controlled-docs only**; platform-wide
   residual enums (`classification`/`role`/`kind`/…) remain deferred — a separate initiative.
5. **Unchanged:** the `DOC-####` code scheme (referenced by `commission_charters`), the 6-type
   localized vocab, the status keys `draft/in_approval/effective/obsolete`, the prod flag OFF until
   pilot; ship one density + wizard-only (no design-time tweak prefs).
6. **Process:** full §6 Phase Gate; backend contract-first → frontend → tester E2E → qa → human.

## Consequences

- Additive schema only: `category`, `tags`, `obsolete_kind`, `proposed_effective_date` (+ optional
  `approval_due_date` feeding Remind). RLS rides existing table policies; audit keeps bodies **and**
  low-sensitivity metadata out of the payload (mutation still emits a row).
- Editing existing DEFINER RPCs (`publish`/`supersede`/`submit`/`mark_obsolete`) **and** B0 must
  **re-emit each body from live `pg_get_functiondef`**, never from migration text (silent-revert
  risk). B0 uses **function-scoped** literal replaces (`aprovado`/`regimento` may appear in *other*
  modules' enums) + a whole-codebase literal sweep — notably `commission_charters` code that
  creates/filters `regimento`-type docs.
- Any new public RPC (`remind_document_approver`) → `REVOKE ALL FROM PUBLIC` before `GRANT`.
- The notification enum change is a shared contract — serialize with any other notifications work.
- The reset-OK pre-pilot window makes B0 free (no data migration); post-pilot it would need one.
- Failure mode of B0 is a *missed literal* — caught by pgTAP NEG/POS, whole-project `tsc`, and the
  E2E gate (ADR 0069's caught-3-stale-assertions lesson).

## Deferred (out of scope)

Document-body text diff; scheduled/future-dated effective activation; expiry auto-obsolete
enforcement; in-browser document preview; design-time tweak prefs (density, wizard/single toggle);
platform-wide enum anglicization.

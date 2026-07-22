# 0082 — Controlled-Document `changes_requested` Status + In-Place Revision

**Date:** 2026-07-22 · **Status:** accepted. **Owner:** lead → backend/frontend/tester.
**Branch:** `document-detail-redesign`. **Amends:** ADR
[0081](0081-controlled-document-redesign.md) (adds a status key 0081 §5 had kept unchanged;
reverses the "MINOR-1" delete-pending-siblings behavior of the reject path). **Flag:**
`controlled_docs` (unchanged). **PHI:** none (Rule 12 N/A). **Verified:** pgTAP
`200_controlled_documents.sql` 51/51; lint + typecheck + prod build; live browser render.

## Context

A PO interview (2026-07-22) reshaped the rejection UX. Previously a reviewer rejection **silently
reverted** the version `in_approval → draft` and **deleted the still-pending approver rows** (the
"MINOR-1" tweak: once the version was a private draft, a pending approver must not retain read via
the approver-read arm). The detail page then dropped the roster + the rejection note and showed bare
edit forms — the coordinator lost both the verdict context and the reason. The PO wants a rejected
version to stay visible with its full verdict roster and to route revision through the same
disciplined wizard, not ad-hoc inline forms.

## Decisions

1. **`changes_requested` is a first-class version status.** A reviewer rejection moves
   `in_approval → changes_requested` (on both the version and the header), not `draft`. Status stays
   `text` + CHECK (not an enum); the CHECK is widened on **both** `controlled_document_versions` and
   `controlled_documents`. `selectWorkingDraft` treats it as an open/working version;
   `selectSignableVersion` stays `in_approval`-only.
2. **Reverse MINOR-1 — keep the full roster.** The reject path no longer deletes the pending sibling
   rows, so the card lists **every** originally-named approver with their verdict (approved /
   rejected / pending) **and** each rejector's note. Consequence (accepted): named-but-still-pending
   approvers **retain SELECT** on a `changes_requested` version/object until a re-submit rebuilds the
   roster. Acceptable because controlled documents are **PHI-free** (Rule 12) and these are approvers
   the coordinator legitimately named on a version still inside the approval lifecycle. pgTAP asserts
   the retention explicitly.
3. **Revision is in place, same version — no bump.** A never-effective version must not consume a
   version number. "Enviar versão revisada" opens `/revisar`, which reuses `CreateWizard` in a new
   `revise` mode (locked identity, approvers pre-filled from the version's roster) and submits the
   composite `reviseChangesRequestedDocument` (`upload → set_document_version_file →
   submit_document_for_approval`). Re-submit **rebuilds a fresh all-pending roster** (inherent in
   `submit_document_for_approval`'s delete-then-insert), so the card always reflects the current
   round; prior rounds live in `audit_log` (Rule 11), not the card.
4. **Coordinator may change file + reviewers on revision; identity stays locked** (title/type/
   category), matching the existing new-version wizard.
5. **Full "changes requested" pt-BR vocabulary.** Reviewer action → "Solicitar alterações";
   verdict badge + status chip → "Alterações solicitadas". Internal keys stay English (the version
   status key is `changes_requested`; the per-reviewer `decision` key stays `rejected`, only its
   **label** changes — the ADR 0069 key/label split).
6. **`Tipo` field → dropdown.** The create wizard's `Tipo` segmented control becomes the native
   `<NativeSelect>` (values unchanged: policy/sop/protocol/bylaws/manual/other).

## Consequences

- Additive schema only (a widened CHECK on two tables). RLS rides existing table policies — the
  approver-read arm gates on approval-**row** existence, not status, so Decision 2's read-retention
  is automatic; **no policy change**.
- Editing the DEFINER RPCs (`decide_document_approval_core`, `set_document_version_file`,
  `submit_document_for_approval`) re-emits each body from live `pg_get_functiondef`, never from
  migration text (silent-revert risk — the 0081 discipline).
- Adding a status value touched **status-gated functions a policy-shaped audit misses**: the
  status-machine trigger `guard_controlled_document_status` (new legal edges `in_approval ↔
  changes_requested` + a file-reattach exemption — caught only by the pgTAP run, not by grep), and
  the open-revision guards in `supersede_document` + `list_commission_documents`. Re-sweep every
  status-gated function after any status-key change.
- The reset-OK pre-pilot window makes this free (no data migration); the migration is applied to
  **local only** — remote `supabase db push` awaits human authorization.

## Deferred (out of scope)

Stacked multi-round history in the version card (audit_log suffices for the pilot); relabeling the
`rejected` decision **key**; any per-commission rejection policy.

# F2 — Centralized Attachments (Pre-Pilot Foundations Program) — COMPLETE

**Completed 2026-07-11** on branch `claude/continue-previous-e1d93e` (continues
`feat/pre-pilot-foundations-plan`). ADR
[0063](../decisions/0063-centralized-attachments-substrate.md) (centralized attachment
substrate; formerly phase 14e), conforming to the F0 conventions ([ADR
0065](../decisions/0065-pre-pilot-foundations-conventions.md)) and the binding migration
contract [f2-attachments-migration-contract.md §J](../design/f2-attachments-migration-contract.md)
(lead rulings Q1–Q10). Built **after F1** because `attachment_subjects` re-keys to the F1
`participants` registry (§1 C-β). Flag `attachments` seeded **OFF** in the migration; enabled
in `seed.sql` for local/E2E; **prod stays OFF** until the pilot-cutover flip. Local-only —
**remote DB push deferred** to the pilot cutover.

## What shipped

- **`attachments` core** — polymorphic owner-dispatch `(owner_type, owner_id)` (dialect 2,
  no FK; SECURITY DEFINER CASE dispatchers) over case / meeting / interview / action_item;
  `sensitivity_tier` (phi/standard → bucket), `confidentiality_label` (7 semantic values),
  plus the ADR-0063 seams (`scan_status`, `document_group_id`, `supersedes_id`, `legal_hold`,
  `phi_disposed_*`). Immutability guard **HC096** freezes the physical/owner/bucket/tier cols.
- **Two physically-tiered buckets** — `attachments` (standard; authenticated SELECT via the
  owner-dispatch policy) + `attachments-phi` (**NO authenticated SELECT — the hard door**).
- **Audited PHI-read door** — `open_attachment` (service-role signed URL; **NULL-out-of-scope**;
  writes **exactly one `attachment.read`** per open, before signing). PHI list rows carry
  `signedUrl: null`; the audited door is the only path to a phi blob.
- **Atomic fold-in** — case_documents / case_interview_attachments / meeting attachments folded
  into `attachments` in one migration (FK repoint RESTRICT/SET NULL; 3 legacy tables dropped;
  `get_referral_detail` confirmed transparent — reads the scalar `source_document_id`).
  Action-item attachments added; form-item uploads reserved (design-only ingress contract).
- **`attachment_subjects`** → `participants(id)` (F1 re-key) + `case_participant_roles(id)`;
  **`case_interview_links`** (thin RLS-gated external-link rows).
- **Disposal composition (D10)** — `dispose_case_phi` composes attachment PHI disposal
  (`dispose_attachment_phi`; HC097/HC098 + legal-hold skip + count).
- **Data-access** — `src/lib/attachments/{constants,actions,queries}.ts` +
  `src/lib/queries/attachments.ts`; the per-module adapters (`queries/{meetings,interviews,
  case-documents}.ts`) are **thin passthroughs** preserving the phi→`signedUrl:null` invariant.
- **Frontend** — 3 attachment panels (meetings/cases/interviews) rewired + one shared
  `OpenAttachmentButton` audited-download island; PHI downloads route through `openAttachment`
  **on click only** (never on render — audit-noise); uploads/deletes flag-gated;
  interview link-form `kind` selector dropped (`case_interview_links` has no kind).

## Bugs the gate caught + fixed (all pre-commit)

1. **Reset-blocking stale symbol** — the F2 migrations called `app.is_org_admin_of_commission`,
   which **ADR 0051** (`20260709000200`) renamed to `app.is_commission_admin_of` and dropped.
   6 sites swapped to the conformant combined predicate (org-admin OR hospital-admin).
2. **PHI-dispatcher `p_uid` contract violation** — `can_read/write_attachment` take an explicit
   `p_uid` but several arms read ambient `auth.uid()` via single-arg predicates. Invisible
   through RLS (callers pass `p_uid = auth.uid()`) but a contract lie the pgTAP truth-table
   exposed. Swapped to the `_for` explicit-uid variants. Lead-reviewed + ratified.
3. **QA fast-follow (MINOR/INFO)** — removed a dead tier-unaware meeting signer (MINOR-1);
   added a pgTAP **negative** locking the interview-arm case-scoping (a member who is NOT a
   case-reader is denied under `case_access` ON — MINOR-2); pointer comment for action-item
   scope coverage in `113` (MINOR-3); stale RPC/table comments, `interviewsEnabled()` dedupe,
   `207`→`208` comment, intentional double-audit note (INFO).

## Gate (§6)

- **Build ✅ (lead-reverified)** — pgTAP **1957/1957** (0 fail, 77 files; `208_attachments.sql`
  50 assertions incl. the audited-door NULL-out-of-scope, HC096 guard, disposal HC097/HC098 +
  D10 + legal-hold skip, `attachment_subjects→participants` FK, K9 grant+policy pairs, and the
  interview-arm case-scope negative). tsc/eslint **0** (44 pre-existing e2e warnings) · Vitest
  **294** · standalone `next build` OK · generated types regenerated.
- **Tester E2E ✅** — F2 surface **24/24** (`phase-f2-attachments` 6/6 + fold-in-rewired
  `cases-extras` 8/8 + `phase11-interviews` 10/10). The audited-door keystone proven: exactly
  one `attachment.read` per PHI open, PHI row has **zero `<a>`** in DOM, real-bytes open
  round-trip, flag ON **and** OFF, keyboard-only flow.
- **Full suite ✅ (lead-run, dev)** — **590p / 24f / 4s / 55-dnr** (46.1m). F2-owned specs
  **14/14 green in the marathon**; the 24 failures are all **env-flaky non-F2** (dev
  cold-compile / login timeouts, scattered across unrelated domains; ≈ F1's dev baseline
  583p/24f/55-dnr; the one F2-touched failure `phase11` AC2a was isolated-green in the tester's
  10/10). **0 F2-domain regressions.**
- **QA ✅ APPROVED** ([review](../reviews/phase-F2-review.md)) — 0 BLOCKER · 0 MAJOR · 3 MINOR
  · 4 INFO. QA independently re-derived the PHI door from source (not "tests green"): phi bucket
  denies authenticated SELECT (pgTAP-locked), no adapter/panel/query mints a phi URL outside the
  audited door, K9 pairs present (F1's blocking lesson closed). All MINOR/INFO closed in the
  fast-follow.
- **Human ✓** — approved 2026-07-11 ("Approve + fast-follow, then commit").

## Open risks / deferred

- **BUG-AIF-001** (pre-existing, lead-owned, **NOT F2**) — a Next 16.2.9 regression hangs
  `useActionState` upload dialogs on the prod-standalone Windows build; F2's upload flows
  (F2-1/F2-4) inherit it there (dev-green). A tracked **pilot blocker**, cross-cutting.
- **Reclassify / dispose UI** — intentionally OUT of F2 (uploads auto-classify by owner type;
  disposal cascades via `dispose_case_phi`). Deferred to a post-pilot staff-admin admin surface.
- **Referral snapshot path** — `getReferralDocumentUrl` still signs from the legacy bucket;
  post-F2 those blobs live in `attachments-phi` → route through the audited door. Post-F2
  follow-up (only affects referral shares; fresh reset has no data).
- **Remote** — local-only; remote `db push` deferred to the pilot cutover (explicit-auth rule).

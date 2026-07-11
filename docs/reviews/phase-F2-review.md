# Phase F2 — Centralized Attachments (ADR 0063) — QA Review

**Verdict: APPROVED** (2026-07-11)
**Reviewer:** `qa` · **Date:** 2026-07-11
**Scope:** ADR 0063 (centralized attachment substrate, formerly phase-14e), conforming to the
lead-approved migration contract `docs/design/f2-attachments-migration-contract.md` (§J rulings
Q1–Q10 + the two lead adjustments). Migrations `20260717000000`–`…000500`; the data-access layer
(`src/lib/attachments/*`, `src/lib/queries/attachments.ts` + the 3 rewired adapters,
`src/lib/audit/access.ts`); the rewired module actions (`meetings`/`interviews`/`cases`); the
attachment components; pgTAP `208_attachments.sql` + the 6 fold-in-patched suites + `191`.
Structural, pre-pilot, reset-OK; the `attachments` flag ships OFF (migration) / ON (seed, E2E).

**Summary counts:** 0 BLOCKER · 0 MAJOR · 3 MINOR · 4 INFO.

---

## Verdict rationale

This is a clean pass. Every F2 deliverable and every phase-14e §5 / contract acceptance keystone is
met **and genuinely locked** — I re-read `208_attachments.sql` line by line and confirmed the
assertions test the real invariants (not tautologies or weakened checks), and I independently
re-derived the PHI-door isolation from source. The one class of defect that sank F1 on its first
pass — a `to authenticated` RLS policy shipped **without** a matching table `GRANT` (an inert
boundary) — is explicitly closed here: all four attachments tables carry both, and pgTAP K9
(`10.1`–`10.6`) exercises the grant+policy pair regression-locked. The PHI door holds end-to-end:
the phi bucket has **no** authenticated SELECT policy, the audited `open_attachment` door is
NULL-out-of-scope with a single `attachment.read` per allowed phi open and zero on denial, and no
adapter, panel, or query mints a phi-bucket signed URL outside that door.

The findings below are all non-blocking hygiene — dead code, stale doc comments, and pgTAP
coverage that could be one notch tighter on two deliberate deviations. None is an RLS, immutability,
or disposal hole. **APPROVED**; the MINOR items are worth a fast-follow cleanup but do not gate the
phase.

---

## MINOR

### MINOR-1 — `getMeetingAttachmentDownloadUrl` is dead, tier-unaware, and contradicts the door model
`src/lib/queries/meetings.ts:857-866`. This pre-F2 leftover signs an arbitrary `storagePath` against
the **standard** `attachments` bucket (`.from('attachments').createSignedUrl(...)`) with no tier
check — it trusts the caller's path. It has **zero call sites** (grep across `src/` finds only its
definition + the JSDoc mention at `:257`). It **cannot** leak a phi blob today (phi objects live in
the separate `attachments-phi` bucket, so a phi path signed against `attachments` resolves to a
nonexistent object → `null`), which is why it is MINOR and not MAJOR. But it is a tier-unaware
direct-signer that contradicts the F2 tier-split invariant (only `listAttachments` signs, and only
standard paths); leaving it invites a future caller to hand it a path and assume it is safe. **Remove
it** (or, if kept, gate it to a verified standard-tier row). The live standard-tier download already
flows through `getCaseDocumentDownloadUrl` / the batch-signer in `listAttachments`.

### MINOR-2 — the deliberate interview-arm case-scoping is asserted by no test in the regime where it bites
`app.can_read_attachment` interview arm (`20260717000000_attachments_core.sql:251-259`) gates on
`can_read_case(case_of_interview(...))` rather than the contract's original `is_member_of` — a
deliberate, lead-ratified PHI tightening that preserves the shipped `case_interview_attachments`
boundary (migration `20260713001200`). The **code is correct**. The gap is coverage: pgTAP `208`
K1 (`1.1`–`1.9`) covers the `case` / `meeting` / `action_item` / `form_upload` arms but **not** the
`interview` arm, and the E2E/seed regime runs with `case_access` OFF (member-read model — see
`208:29`), where `can_read_case` collapses to `is_member_of`. So neither pgTAP nor E2E ever
distinguishes the tightening from plain membership — the one behavior the deviation exists to enforce
(a commission member who is *not* a case-reader is denied the interview attachment when `case_access`
is ON) is exercised by nothing. Add an interview-arm truth-table assertion under `case_access` ON so
the tightening is regression-locked. Non-blocking (the boundary is present and correct in SQL).

### MINOR-3 — pgTAP K2 exercises only the `committee` action-item scope
`208_attachments.sql:190-199` proves a `committee`-scope action-item attachment is member-readable
and assignee-writable (the Q5b lock) — good. But the contract's Keystone 2 also names
`case_restricted` (readable exactly by `can_read_case` readers) and `assignees_only` (assignee only);
neither scope is asserted here. The dispatch target `can_read_action_item` is scope-aware and has its
own suite (`182`), so this is a coverage nit, not a functional gap — but the F2 *dispatch* to those
scopes is unproven. Add a `case_restricted` + an `assignees_only` row to close Keystone 2 as written.

---

## INFO (no action required)

- **INFO-1** — `dispose_attachment_phi` produces **two** audit rows per call: the AFTER-UPDATE
  trigger emits `attachment.updated` (the redacting UPDATE changes neither tier/bucket/label nor
  `deleted_at`, so it falls through to the default action —
  `20260717000000_attachments_core.sql:383`), and the RPC then explicitly writes
  `attachment.phi_disposed` (`…000200:310`). This is *more* auditing, not less, and no PHI leaks (the
  `audit_diff` allow-list excludes `title`/`description`; the `updated` diff carries only
  `phi_disposed_reason`, a category). Harmless; noting because a reader may expect a single row. Does
  not affect the `attachment.read` single-open keystone (that counts a different action).
- **INFO-2** — Stale doc comments naming dropped RPCs/tables (no live code path):
  `src/lib/meetings/actions.ts:907` ("via the `add_meeting_attachment` RPC" — the code calls
  `create_attachment`), `src/lib/interviews/actions.ts:588` (same, `add_interview_attachment`),
  `src/app/o/[org]/c/[commission]/manage/cases/[caseId]/interviews/[interviewId]/page.tsx:76`, and
  `src/lib/timeline/event-model.ts:41` ("a `case_documents` row"). Cheap to align on the next touch.
- **INFO-3** — `interviewsEnabled()` is defined twice with divergent bodies:
  `src/lib/interviews/actions.ts:156` (direct `rpc('interviews_enabled')`) vs
  `src/lib/queries/interviews.ts:560` (delegates to the memoized `featureEnabled('interviews')`). The
  actions copy is not request-memoized. Consistency only; both return the same truth.
- **INFO-4** — `supabase/tests/111_case_docs_events.sql:2-3` comment points readers to
  `207_attachments.sql`; the file was renamed to `208_attachments.sql` (the `207` collision with F1).
  Trivial stale reference.

---

## What I verified (held up)

1. **The hard PHI door — no authenticated read of a phi blob outside the audited door.** The
   `attachments-phi` bucket has an authenticated **INSERT** policy but **no** authenticated SELECT/
   UPDATE/DELETE policy at all (`20260717000100_attachments_storage.sql:47-56`; pgTAP `5.1` asserts
   **zero** SELECT policies reference `attachments-phi`, `5.3` asserts the INSERT policy exists). I
   traced every read path: `listAttachments` (`queries/attachments.ts:151-171`) batch-signs **only**
   `sensitivity_tier === 'standard'` paths and sets `signedUrl: containsPhi ? null : …`; the three
   adapters (`case-documents.ts`, `meetings.ts`, `interviews.ts`) are thin passthroughs that carry
   `a.signedUrl` verbatim and never call `createSignedUrl` on a phi path (confirmed by a full-tree
   sweep — the only phi-bucket signer is the audited door). `getCaseDocumentDownloadUrl` /
   `getMeetingAttachmentDownloadUrl` sign only the standard `attachments` bucket. Net: a phi blob is
   reachable **only** via `openAttachment` → `open_attachment` RPC → service-role signed URL.
2. **`open_attachment` audited-door contract (the keystone).** `…000200:121-155`: assert flag → load
   → return empty on not-found / soft-deleted / infected → **`if not can_read_attachment then
   return`** (NULL-out-of-scope: no row, no URL, no audit) → **only if `sensitivity_tier='phi'`**
   write exactly one `log_audit_access('attachment.read', …, '{}')` → return `(bucket, path)`. pgTAP
   `4.1`/`4.2` lock the foreigner path (0 rows **and** 0 `attachment.read` rows); `3.1`/`3.2` lock the
   entitled path (1 row **and** exactly 1 `attachment.read`). The TS door
   (`attachments/actions.ts:176-194`) mirrors it: `null` on empty data, service-role signs the
   returned `(bucket, path)` only. Service-role client is `server-only` (`supabase/admin.ts:1`) — no
   client-side reachability; no `NEXT_PUBLIC`-prefixed service-role reference anywhere in `src/`.
3. **Audit triple-mirror complete for `attachment.read`.** (a) allow-list in `log_audit_access`
   (`…000000:466-467`); (b) `_audit_access_authorized` arm resolves the attachment's owner and gates
   `can_read_attachment` (`…000000:511-515`) — so the C-4 forge-guard actually adjudicates; (c) TS
   union `AuditAccessAction` adds `'attachment.read'` (`audit/access.ts:48`). `191_grant_hardening.sql`
   `3.13`/`3.14` prove an entitled member CAN log it and a cross-commission caller CANNOT forge it
   (42501). No PHI in the audit payload (empty metadata; `audit_diff` allow-list excludes
   `title`/`description`/`storage_path`/`sha256`).
4. **Immutability guard (HC096).** `guard_attachment_immutable` (`…000000:321-347`) freezes
   `owner_type/owner_id/storage_bucket/storage_path/sha256/size_bytes/sensitivity_tier` unless the
   `app.in_attachments_rpc` bracket is set; the six ADR-0063 seam columns are correctly **not** frozen.
   pgTAP `6.1` proves an out-of-bracket `storage_path` UPDATE raises HC096; `6.2` proves a seam column
   (`confidentiality_label`) is not frozen. Belt-and-suspenders: `authenticated` has **no** UPDATE
   grant on `public.attachments` (only SELECT — `208` `10.2`), so all writes are DEFINER-only; the
   guard defends the RPCs against a missing bracket.
5. **K9 grant+policy pairing (the F1 lesson).** All four tables — `attachments`,
   `attachment_references`, `attachment_subjects`, `case_interview_links` — carry both a
   `to authenticated` SELECT policy **and** a matching `grant select` (`…000000:403-442`); pgTAP
   `10.1`/`10.4`/`10.5`/`10.6` assert `has_table_privilege('authenticated', …, 'SELECT')` and `10.3`
   asserts the policy is `to authenticated`. No inert boundary. Writes stay DEFINER-only (no INSERT
   grant — `10.2`).
6. **RLS truth table + reserved-inert `form_upload`.** `can_read_/can_write_attachment` dispatch to
   the verified per-owner resolvers using the **explicit `p_uid`** `_for` variants (a correct backend
   fix so the predicate is honored outside an `auth.uid()` context — `…000000:243-314`); `form_upload`
   returns false on both arms and the dispatcher returns null commission. pgTAP `1.1`–`1.9` + `2.1`–
   `2.5` (incl. the Q5b assignee-write lock and foreigner-deny) confirm.
7. **Atomic fold-in / FK-repoint.** `…000300` repoints `rca_evidence.cited_document_id` (RESTRICT
   preserved) and `referral_shared_item.source_document_id` (SET NULL preserved) onto `attachments`,
   rewires `add_referral_shared_item` to materialize an `attachments` row, and drops the three folded
   tables + legacy RPCs — all in one migration. pgTAP `7.1`–`7.7` lock the drops + both repointed FKs
   (target = `attachments`, delete-actions `r`/`n`). I independently confirmed `get_referral_detail`
   (last defined `20260711000700:400-455`) reads only the **scalar** `source_document_id` and the
   frozen snapshot columns off `referral_shared_item` — no `case_documents` join — so the drop is
   transparent to it (the fold-in's decision to leave it un-recreated is sound). No live reference to
   any dropped table/RPC remains in `src/` (only stale comments — INFO-2).
8. **D10 disposal composition.** `dispose_case_phi` (`…000400`) re-emits F1's participant-keyed body
   verbatim (arms a–e, g, h, audit, all GUC bypasses, the HC056 double-dispose guard, and the
   coordinator/org-admin authz preserved), removes the now-obsolete arm (f) `case_documents` update,
   and inserts the D10 attachment-redaction block **exactly at the F2 SEAM** — redacting
   `title`/`description` and stamping `phi_disposed_*` on live, non-held case attachments, skipping
   `legal_hold=true` rows with a reported count (Q9). The standalone `dispose_attachment_phi`
   (`…000200:269-318`) hard-rejects a legal-held row (HC098) and a double-dispose (HC097), retains the
   object (Rule 6). pgTAP `9.1`–`9.8` lock HC098, HC097, the redaction+stamp, the D10 seam line, and
   the legal-held skip; `197_phi_disposal_closure.sql` `1.11` independently asserts the case-attachment
   redaction with `storage_path` retained.
9. **`create_attachment` write-door binding.** Assert flag → `can_write_attachment` → per-owner_type
   `kind` validation → tier/label defaults + label→tier escalation (defence-in-depth over the
   `attachments_phi_label_tier_ck` CHECK) → **verify the object exists in the resolved tier bucket** →
   insert. The table `attachments_path_scope_ck` (`storage_path like owner_type/owner_id/%`) plus the
   in-bucket existence check together bind a row to its own owner folder and correct tier bucket — a
   caller cannot register a metadata row over an object in another owner's folder or the wrong tier.
10. **Frontend PHI-door discipline + a11y + pt-BR.** All three panels render an inline `<a href=…>`
    **only** when `signedUrl`/`openUrl` is truthy (standard tier) and fall back to
    `OpenAttachmentButton` (the audited door) otherwise — so a phi row never carries an inline blob
    link (matches the tester's "zero `<a>` on a PHI row" assertion). `OpenAttachmentButton` calls
    `openAttachment` strictly **on click**, never on render (no audit-trail spam), treats `null`
    uniformly with a calm pt-BR message, has `aria-label` + `role="alert"` on failure + keyboard focus.
    Upload/delete/open are flag-gated (`attachmentsEnabled()` + `canWriteNow`); list reads are not
    gated (by design). Titles/descriptions render as auto-escaped plain text — no
    `dangerouslySetInnerHTML`, no raw-HTML markdown surface (Rule 7). Upload dialogs carry the
    "Nunca inclua dados de paciente." warning. No raw Postgres error reaches the UI (Rule 10).
11. **Rules 8/9.** Generated types regenerated (`src/lib/types/database.ts` has `attachments`,
    `attachment_subjects`, `case_interview_links`, and the RPCs `create_attachment`/`open_attachment`/
    `reclassify_attachment`/`dispose_attachment_phi`; `case_documents` is gone). All data access flows
    through `src/lib/queries/` + `src/lib/attachments/`; the client-safe `constants.ts` is a pure module
    (no `server-only`, no supabase client) so client components value-import it without dragging the
    server client into the bundle (the memoized `client-import-server-query-module-breaks-build`
    lesson). TypeScript strict respected; no unjustified `any`.
12. **Flag gate (Q10).** Migration `…000500` seeds `attachments` **OFF** (with
    `on conflict do update` forcing OFF); `seed.sql:1935` flips it ON for local/E2E (F1 precedent);
    every RPC asserts the flag first, so the whole surface is inert in prod until the pilot flip. RLS
    is enabled on every table from creation regardless of the flag (Rule 1).

**Tooling note:** review ran by reading the six F2 migrations, `208_attachments.sql` + the patched
`191`/`197`/`111` suites, the TS data-access + component layer, and `database.ts`/`seed.sql`, plus
read-only greps across `src/` and `supabase/migrations/` for dropped-reference / phi-signing / stale
references. Per the shared-resource constraint I did **not** run `db reset`, `supabase test db`, or the
E2E suite (the lead's full-suite run was in flight); I relied on the recorded pgTAP 1953/1953 (208 ran,
46/46) + tester E2E 24/24 and confirmed *why* each keystone passes against the source. No application
code, migration, or spec was modified.

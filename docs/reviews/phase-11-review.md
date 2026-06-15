# Phase 11 — Interviews QA Review

**Verdict: APPROVED**

- Date: 2026-06-15
- Reviewer: `qa`
- Build: Phase 11 — Interviews (branch `phase-11-interviews`)
- Test gate: 151/151 E2E green (full cross-phase regression + 9 new phase11 tests)

## Scope of Audit

This phase adds case-scoped Interviews as a sibling feature to Phase 10 Meetings. The primary
novelty audited is the **participant-write RLS shape**: a registered interviewer (plain `staff`
user) gains write authority on their interview and its child rows via a `SECURITY DEFINER` helper,
beyond the usual `staff_admin/admin` boundary. Secondary scrutiny: storage bucket immutability,
lifecycle/content-freeze guards, all 14 plan decisions, and the full PHASES.md acceptance matrix.

Files read: all 5 migrations (`091000–091004`), pgTAP suite (`121_interviews.sql`),
`src/lib/queries/interviews.ts`, `src/lib/interviews/{actions,messages}.ts`,
`src/components/interviews/**`, the detail route + case-detail mount, `e2e/phase11-interviews.spec.ts`,
`supabase/seed.sql` (Phase 11 fixture), `docs/decisions/0026-interviews.md`, PHASES.md (Phase 11),
and the 14-decision plan.

## Dimension 1 — Requirements (PHASES.md Acceptance Criteria)

All 8 acceptance clauses verified against E2E coverage:

- **AC1** (happy path): create interview, add registered + external subject/interviewer, upload PDF,
  add https audio link, walk rascunho→agendada→em_andamento→concluida, assert `case_events`
  `kind='interview'` row, reopen, re-conclude and confirm the SAME registry row is updated (no
  duplicate), then cancel.
- **AC2** (participant write grant): AC2a (registered `staff` interviewer CAN write — UI controls
  present + conclude RPC succeeds) and AC2b (non-interviewer `staff` CANNOT write — controls absent +
  HC039). Both directions exercised.
- **AC3** (foreign-commission isolation): different-commission staff_admin gets 404; SELECT empty
  (pgTAP test 28 asserts 0 rows).
- **AC4** (negatives): HC041 (conclude without subject), HC021 (non-member registered interviewer),
  HC040 (non-https link), Storage MIME rejection — all mapped to pt-BR.
- **AC5** (keyboard-only): Tab-loop reaches submit; form submitted via keyboard; detail reached;
  back-link focusable.
- **AC6** (seeded panel): interviews panel renders the seeded row; back-link navigates to the case.
- **AC7** (wrong-state guard): HC038 on incompatible lifecycle transition.
- **AC8** (seeded detail): subject/interviewer/attachment/link panels render; DB-truth via `supabase.rpc`.

All 14 plan decisions implemented. Decision 13 (write = staff_admin/admin OR registered interviewer)
verified in depth in Dimension 2. Decision 8 (documents stored, audio by URL) via the
`storage_path`/`external_url` XOR. Decision 11 (per-commission numbering) via `app.mint_interview_number`.

## Dimension 2 — Security / RLS (Critical Path)

**DEFINER helpers.** `app.commission_of_interview`, `app.is_staff_admin_of_for`, `app.is_admin_for`,
`app.can_write_interview` are all `SECURITY DEFINER` with `SET search_path = app, public, pg_catalog`,
each `REVOKE ALL … FROM PUBLIC` then `GRANT EXECUTE … TO authenticated, service_role` (correct order;
no public-execute window). `can_write_interview` reads `case_interviews` directly under the definer's
identity (bypassing user RLS) → **no recursion**. `public.interview_viewer_can_write` is the thin
DEFINER read backing the `viewerCanWrite` signal; revoke/grant present.

**`case_interviews` policies.** SELECT = member of commission; INSERT = `is_staff_admin_of_for`
(create staff_admin/admin only — decision 14); UPDATE+DELETE = `can_write_interview(id) OR
is_admin_for(...)` (the admin clause is redundant-but-harmless). **Child tables** (subjects,
interviewers, attachments): SELECT = member-of-commission; write (FOR ALL) = `can_write_interview`.
Cross-commission isolation holds (pgTAP test 28).

**Lifecycle / content-freeze.** `app.guard_interview_lifecycle` enforces the 5-state FSM; cancel is
terminal (reopen RPC raises HC038 on `cancelada`). `app.guard_interview_child_lock` blocks child
writes when `concluida`/`cancelada`, **excluding `case_interview_attachments`** per ADR 0026. Session
flag `app.in_interview_rpc` mirrors Phase 10; lifecycle + participant RPCs set/clear it;
`delete_interview_attachment` correctly does not (attachments aren't child-locked).

**Single-event invariant.** `conclude_interview` upserts the `case_events` row via `registry_event_id`
so re-conclude updates the same row (verified by pgTAP + AC1).

**Storage.** `interview-attachments` private, 25 MiB, audio MIME excluded. SELECT scoped on path
segment `[1]` (commission); INSERT gated on segment `[2]` (interview) via `interview_viewer_can_write`;
no UPDATE/DELETE (immutable, Rule 6; soft-delete is a DB flag). Path minted
`{commissionId}/{interviewId}/{uuid}.{ext}` in `uploadInterviewAttachment` (server action). No
service-role key client-side.

**HC021.** `add_interview_interviewer` requires a registered interviewer to be a commission member —
closes the cross-commission write-escalation gap (pgTAP test 3).

**Error mapping.** `mapInterviewError` covers HC038–HC041, HC021, `23514`, `42501`, `P0001`/`P0002`
with a generic pt-BR fallthrough; no raw Postgres codes reach the UI.

## Dimension 3 — Code Quality

- TypeScript strict; no unexplained `any`; types exported as named interfaces.
- Data access only via `src/lib/queries/interviews.ts` (no inline supabase-js in components) — Rule 9.
- Server Components by default; client islands appropriately scoped. P11-001 (RSC closure) resolved
  pre-review via `.bind(null, att.id)`.
- a11y: `aria-labelledby` panels, labelled links, `rel="noopener noreferrer"` external links,
  sanitizing `MarkdownRenderer` for `summary_md` (Rule 7), pt-BR throughout. Keyboard flow AC5.
- ADR `docs/decisions/0026-interviews.md` documents all 14 decisions (Rule §8).
- `interviews` flag OFF in `091000`, ON in `091004`; detail page + panel flag-gated.

## Findings

**MINOR-1 — Post-conclusion attachment upload UI is more restrictive than the server/ADR contract.**
`…/interviews/[interviewId]/page.tsx` passes `canEditContent = canWrite && isEditableInterviewStatus(status)`
to `AttachmentsPanel`; since `isEditableInterviewStatus` is false for `concluida`, the upload/add-link
controls disappear once concluded. ADR 0026 ("Attachments are NOT child-locked") and the
`add_interview_attachment` RPC (no status check) intentionally allow uploading a late signed transcript
after conclusion. Consequence: the UI forces an unnecessary reopen/re-conclude. No security implication.
**Recommendation:** a separate `canUpload = canWrite && status !== 'cancelada'` passed to
`AttachmentsPanel`, keeping `canEditContent` for participant/summary/lifecycle controls.

No other findings.

## Summary

All 8 acceptance criteria covered; all 14 plan decisions implemented. The new RLS participant-write
shape is correctly built (recursion-free, search_path-pinned, revoked-before-grant; private write-gated
storage; anon/PUBLIC EXECUTE revoked across all 16 RPCs + helpers; DB-level lifecycle guards). Error
messages fully pt-BR with no leakage. Architecture Rules 1, 3, 6, 7, 9, 10 satisfied. One MINOR UX
inconsistency; zero blockers, zero majors.

**Verdict: APPROVED**

# ADR 0026 — Interviews (case-scoped, participant-write RLS)

**Status:** Accepted · **Date:** 2026-06-15 · **Phase:** 11 (Interviews)

## Context

Hospital commissions (e.g. M&M) interview healthcare professionals about a
specific case — who was involved in a patient's care, what happened. We need to
schedule, conduct, document, and archive these interviews **from within an open
case**, with their own lifecycle, multiple interviewees + interviewers (with
roles), and evidence attachments. **No patient-identifiable data** is collected:
an interview captures committee process (who was interviewed, by whom, a summary,
evidence), never health records. Settled via the design interview as decisions
**1–14** in the approved plan `it-is-common-for-jazzy-lake.md`.

The codebase already contains a near-exact template in **Phase 10 Meetings**, so
Interviews are built as a *case-scoped sibling of `meetings`*, cloning its proven
patterns. The one genuinely new piece is a **row-level participant write grant**
(a registered interviewer can write their own interview), a new RLS shape.

## Decision

- **Case-scoped sibling of Meetings.** Four tables: `case_interviews` (header +
  lifecycle authority, denormalized `commission_id`, per-commission
  `interview_number` minted by an advisory-lock trigger cloned from
  `app.mint_meeting_number`), `case_interview_subjects` (interviewees;
  `user_id` XOR `external_name`; **free-text** `clinical_role` — decision 5),
  `case_interview_interviewers` (`user_id` XOR `external_name`; **fixed-enum**
  4-value committee `role` — decision 7; a registered interviewer must be a
  commission member → **HC021**), and `case_interview_attachments` (unified
  evidence: `storage_path` XOR `external_url` CHECK — decision 9; `kind` is the
  4-value EVIDENCE taxonomy `gravacao_audio`/`transcricao_assinada`/`evidencia`/
  `outro`, **orthogonal** to file-vs-link; soft-delete).

- **5-state lifecycle (decision 4), `cancelada` TERMINAL.** `rascunho → agendada
  → em_andamento → concluida`, plus `cancelada`. Only `concluida → em_andamento`
  reopens; **`cancelada` is terminal (not reopenable)**. Enforced by
  `app.guard_interview_status` (BEFORE UPDATE/DELETE, gated by the
  `app.in_interview_rpc` session flag) — invalid transitions raise **HC038**.
  Content freezes once `status in (concluida, cancelada)`; the sibling
  `app.guard_interview_child_lock` freezes the SUBJECT + INTERVIEWER child rows
  the same way. **Attachments are NOT child-locked** — the signed transcript /
  late evidence may be uploaded after conclusion.

- **Conclusion writes the case "registry" via `case_events` (decision 1).** No
  `case_registries` table — the case timeline is `case_events`. `conclude_interview`
  requires ≥1 interviewee (**HC041**) and writes (first conclude) OR **updates**
  (re-conclude after reopen, via the stored `registry_event_id`) a SINGLE
  `case_events kind='interview'` row, so the timeline never duplicates.
  `case_events.kind` gains `'interview'` (CHECK widened in `…091000`).

- **NEW RLS shape — participant write grant (decisions 13/14).** Member SELECT;
  **CREATE = staff_admin/admin only** (bootstrap — decision 14); **UPDATE/DELETE +
  all child writes = `app.can_write_interview(interview_id, uid)`** = staff_admin/
  admin of the interview's commission OR a registered interviewer on it. So a
  registered interviewer who is a plain `staff` member can edit/conclude THEIR
  interview, while a non-interviewer staff cannot. `can_write_interview` and
  `app.commission_of_interview` are `SECURITY DEFINER` (bypass RLS internally →
  no policy recursion, the same technique as `app.can_sign_meeting` /
  `commission_of_meeting`). `can_write_interview` is **uid-pure** (built on new
  uid-pure mirrors `app.is_staff_admin_of_for` / `app.is_admin_for`) so it is
  pgTAP-testable and the policies + Storage INSERT policy call it with
  `auth.uid()`. The query layer exposes the current viewer's verdict as
  `InterviewDetail.viewerCanWrite` via the thin `public.interview_viewer_can_write`
  RPC — the single signal the detail UI gates write controls on. Spreading risk
  (a registered interviewer can add other interviewers) is accepted and documented.

- **Storage `interview-attachments` (private, 25 MiB, NO audio).** Clones the
  meeting-attachments bucket. MIME = PDF/images/Office/CSV/txt; audio is **link
  only** (decision 8 — audio bytes are never stored). Path
  `{commission_id}/{interview_id}/{uuid}.{ext}`; objects immutable (no UPDATE/
  DELETE). SELECT keys on path segment `[1]` (commission, member-read); **INSERT
  keys on segment `[2]` (interview_id) via `can_write_interview`** so a registered
  interviewer — not just staff_admin — can upload. External links are validated
  `https`-only (a table CHECK + the action + **HC040**) and rendered with
  `rel="noopener noreferrer"`, never auto-fetched.

- **Feature flag + RPC surface.** All writes go through `SECURITY DEFINER` RPCs
  that set `app.in_interview_rpc`, gate `app.assert_interviews_enabled()`, and
  authorize via `app.assert_interview_writable` (→ HC039) except create. The
  `interviews` flag ships ON in-phase (`…091004`, mirroring the meetings flip) so
  the gate exercises the live feature. TS-layer writes gate
  `public.interviews_enabled()`.

## New SQLSTATEs (continue after HC037; HC021 reused)

| Code | Meaning |
| ---- | ------- |
| HC038 | interview in the wrong state for the lifecycle op |
| HC039 | not entitled to write this interview (not staff_admin nor a registered interviewer) |
| HC040 | invalid attachment (storage_path XOR external_url violated, or non-https link) |
| HC041 | cannot conclude — the interview has no interviewee |

## Consequences

- Interviews reuse the meetings playbook; the only conceptual novelty (the
  participant write grant) is isolated in one DEFINER predicate and proven by
  pgTAP (a plain-staff interviewer writes; a non-interviewer staff is blocked).
- The condition evaluator, the response/case invariants, and the meetings feature
  are untouched — purely additive.
- Migrations `20260615091000`–`091004` (forward-only, after the Phase-10 batch).
- Frontend builds against the frozen `src/lib/queries/interviews.ts` +
  `src/lib/interviews/actions.ts` contract (contract-first; B0 posted before F0/F1).

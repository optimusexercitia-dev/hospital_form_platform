# 0085 — Case Correction Lifecycle (phases + narratives)

**Status:** Accepted (PO-grilled decision-by-decision + plan approved, 2026-07-24) · **Branch:** `case-corrections` · **Flag:** `case_corrections`

## Context

A submitted case phase was frozen at 3 layers with **no correction path** — `supersede_response`
hard-refuses case-bound responses (`HC0H1`), deferring to a case-phase door that never existed.
Narratives had the opposite defect: `reopen_narrative` rewrote concluded testimony **in place**
(nulling `concluded_at/by`, no snapshot anywhere — Rule 11 audits never store payloads). Both
halves of the committee's testimonial record needed one auditable, ALCOA+-honest correction model
before the pilot. Pre-pilot reset OK ⇒ correct schema over back-compat.

## Decision (10 points, each PO-locked)

1. **Response = revision.** No wrapper table. A corrected submission is a new `responses` row
   (`supersedes_id` → predecessor, same `case_phase_id` + pinned `form_version_id`). The phase's
   current revision is an explicit pointer: `case_phases.current_response_id`, moved atomically
   only at first submit and at approval — a *submitted but unapproved* successor is **not** current.
2. **Phase stays `completed`** through the whole correction; workflow state lives on the
   first-class `case_correction_requests` (`requested → in_progress → resubmitted → under_review
   → approved | rejected (resting → back to in_progress) | withdrawn`). Only new phase state:
   terminal **`voided`**. Blocks-gating therefore never re-evaluates mid-correction.
3. **Corrector is an explicit audited grant** (`permitted_corrector`, default = original assignee;
   coordinator may designate anyone incl. self). Successor `created_by` = actual writer;
   `assigned_to` never mutates. Corrector is immutable once a draft exists (withdraw + refile).
4. **Filing** is open to case-content readers (`app.can_read_case`); mandatory reason +
   classification (`clerical|factual|interpretative|substantive|compliance_related` — purely
   descriptive, **never** a gate, so it stays un-gameable). One open request per target (partial
   unique backstop). The result-override door stays usable while a request is open.
5. **Approval always required** (all kinds/classifications); staff_admin/commission-admin;
   self-approval permitted but recorded (`self_approved` + audit flag). Reject needs a reason and
   loops back to editing; withdraw terminates (a `resubmitted` draft must be rejected first).
6. **Open-case only.** Post-conclusion path = new `reopen_case(p_case_id, p_reason)` door
   (joins the `reopen_*` family; `cancelled` is terminal-forever). Exclusion perimeter
   (`assert_not_case_excluded`) on every door.
7. **No cascade, no freeze.** Approval re-runs `compute_case_phase_result` +
   `recompute_recommendations` (the `set_case_phase_result_override` precedent); downstream
   active/completed work stands; an `impact_snapshot` jsonb (downstream phases already
   active/completed) is stamped on the request at approval for the accreditor's question.
8. **One machinery, three kinds:** `correction`, `addendum` (successor revision; additive-only
   soft-enforced v1 — the approver reviewing the diff is the gate), `void` (no draft; phase →
   `voided`, result cleared, satisfies `blocks` like `not_required`; redo via `add_ad_hoc_phase`;
   never un-void).
9. **Narratives get full parity now:** polymorphic request target (phase XOR narrative),
   append-only `case_narrative_revisions` snapshots, draft text on the request, approval
   **preserves** `concluded_at/by`. `reopen_narrative` is **dropped** (the in-place rewrite door —
   "an exclusion is only as strong as its weakest mutator"). Open narratives stay freely editable.
10. **`guard_supersession_coherent`** gains a case arm: same-phase chain, predecessor must equal
    `current_response_id` (tip-only), authenticated writers must hold the open request's corrector
    slot (BUG-SUP-002 defense-in-depth preserved; service-role skip per ADR 0075).

## Explicitly out of scope v1 (extension paths verified open)

- **Field-level correction scope** — a `request_id → question_key` child table + diff-validator is
  purely additive later (stable `question_key`s make it schema-free today).
- **First-submission approval gate** — slots in as a flag-gated pause in the submit→completed flip
  (one new guard transition + nullable `requires_approval` config); nothing here forecloses it.
- **Targeted-response corrections** (`target_case_participant_id`, ETH·E2) — refused at filing (`HC0M5`).
- Correction drafts of signoff-bearing forms re-enter the signoff queue and require re-signing (by design).

## Consequences

Submitted testimony becomes correctable without ever being mutable: predecessors stay immutable
and readable, every change is a classified, approved, audited business object, and dashboards
always count exactly one (approved) revision per phase. Errcodes `HC0M0–HC0M9`. Plan of record:
`~/.claude/plans/agreed-tender-pixel.md`; build tracked in PROGRESS.md (BE-1…4/FE-1…3/T-1/QA).

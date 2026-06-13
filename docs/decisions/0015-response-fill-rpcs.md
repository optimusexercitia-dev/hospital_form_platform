# ADR 0015 — Response-fill RPCs (atomic section save + get-or-resume)

Status: accepted (Phase 5, B1)
Date: 2026-06-12

## Context

The wizard (Phase 5) saves a section's answers on every navigation, persists the
wizard position (`responses.last_section_id`), and resumes the caller's draft on
reopen. Phase 1 already provides the lifecycle tables, the submitted-immutability
triggers, the one-draft-per-user unique index, and the response/answer RLS;
submission goes through the existing `submit_response` RPC. What was missing were
the *mutation entry points* for filling.

## Decision

Two new `security invoker` RPCs in `20260612100011_response_fill_rpcs.sql`,
mirroring the builder RPCs (M10) — RLS stays the authority, no RPC bypasses it.

1. **`save_section_answers(response_id, section_id, answers, clear_item_ids)`** —
   upserts one `answers` row per input item, optionally clears orphaned answers,
   and bumps `last_section_id` + `updated_at`, all in one transaction.
   - **RPC over N client upserts:** a section save touches multiple `answers`
     rows plus the `responses` row. Client-side that is N+1 round trips and
     non-atomic (a partial save could leave `last_section_id` ahead of persisted
     answers). One invoker RPC = one round trip, one transaction, RLS still
     enforced (`answers_write_own_draft` / `responses_update_own_draft`).
   - **Orphan-clear as a parameter, not a separate function:** the warn-and-clear
     fires together with a section save (a controlling-answer change both saves
     the current section and clears a now-hidden one). Folding it into
     `p_clear_item_ids` keeps "navigate + clear orphans" a single atomic call.
   - **Cross-version guard (lead note):** every upserted `item_id` must belong to
     the response's own `form_version_id`. A malformed/hostile client could
     otherwise scatter answer rows referencing items from a *different* version
     of the same form. Not a security hole — RLS still confines writes to the
     caller's own response, and `submit_response` only walks the response's own
     version so stray cross-version rows are inert — but rejecting them keeps the
     data clean and dashboards honest. The check reuses the `question_key` join,
     so it adds no meaningful complexity.

2. **`start_or_resume_response(form_version_id)`** — returns the caller's existing
   in_progress draft or creates one.
   - **`unique_violation`-catch resume:** two near-simultaneous calls (double
     click) both miss the SELECT and both attempt the INSERT; the
     `responses_one_draft_per_user_idx` lets one win and the loser catches
     `unique_violation` and re-reads the surviving draft. The caller always gets
     one consistent draft id, never an error.
   - **Published-only backstop:** the query layer lists published versions only,
     but the RPC also rejects starting a draft on a non-published version
     (`check_violation`), so a hand-crafted call cannot fill an unpublished form.

## RLS audit

No new policies. The Phase-1 policies cover both RPCs under invoker context:
`responses_insert_own` (resume insert), `responses_update_own_draft`
(position/timestamp bump), `answers_write_own_draft` (upsert + orphan-clear).
Submitted immutability stays trigger-enforced — neither RPC sets
`app.in_submit_rpc`, so a submitted response cannot be mutated through them.

## Consequences

- `submit_response` and `app.eval_condition` are untouched (reused verbatim).
- pgTAP `70_response_fill.sql` (16 tests) covers upsert idempotency + value
  update, `last_section_id`, orphan-clear, cross-version rejection, resume vs.
  create, one-draft conflict handling, foreign-user + cross-commission
  rejection, and that no save path mutates a submitted response. Full suite
  119/119 from a clean `db reset`.
- Types regenerated; diff is only the two new RPC function types.

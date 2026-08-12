# 0112 — `case_events.kind` write authority belongs in the policy layer

- **Status:** Accepted
- **Date:** 2026-08-12
- **Closes:** BUG-CASEKIND-001
- **Relates to:** ADR [0110](./0110-shared-registro-kind-vocabulary.md) (the shared registro
  vocabulary), ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (the neutralization
  oracle used as the evidence here)

## Context

`case_events.kind` carried a 16-value `CHECK`, **zero triggers**, and **no `kind` arm in any write
policy**. Six of those values are hand-authored registros; the other ten are system kinds — two
registry echoes (`interview`, `safety_event`) and eight E3a ethics procedural kinds
(`decision_issued`, `vote_cast`, …) that the UI presents as governance record. The only thing
stopping a writer from minting one was `isCaseEventKind` in `src/lib/cases/registro-kinds.ts`, i.e.
application code, which PostgREST does not run. A forged `kind='decision_issued'` insert succeeded
as an ordinary committee writer.

This is the recorded *"a correct predicate ≠ correct policies"* family: the `CHECK` constrains the
**domain** of `kind`; nothing constrained **who may write which value**. A wider or narrower `CHECK`
cannot express that distinction — it has no notion of a caller.

## Decision

1. **The arm goes in RLS, not in a trigger.** All ten system kinds are emitted by `SECURITY DEFINER`
   RPCs owned by `postgres`, which owns `case_events`, and the table is not
   `force row level security` — so those doors bypass RLS and need no exemption. A trigger fires for
   them too, and would have needed a way to tell "the RPC" from "a user", which is exactly the
   ambient-authority guessing the platform avoids elsewhere. RLS already draws the line for free.
2. **The vocabulary gets one SQL home**: `app.is_manual_case_event_kind(text)`, IMMUTABLE, security
   INVOKER, pure. Four policies reference it, so a seventh manual kind is a one-line widen rather
   than four policy edits that can drift apart.
3. **The arm is on all four write policies — both INSERTs AND both UPDATEs.** An INSERT-only arm is
   defeated by insert-then-update (`note` → `decision_issued`): the recorded *"an exclusion is only
   as strong as its weakest mutator"* shape. `WITH CHECK` cannot see `OLD`, so a user-role UPDATE of
   a procedural row must also land on a manual kind; no app path does otherwise.
4. **Policies are amended, never rebuilt** — `alter policy … with check (<expression read back from
   pg_policy> and <arm>)`. A DROP+CREATE would silently drop the E3a `coordinator_only` narrowing
   and the `is_case_excluded` arm.

## Consequences

- The TS guard is now a convenience mirror, not the security boundary. `registro-kinds.ts` says so.
- Widening the manual vocabulary means widening **four** things together: this function,
  `case_events_kind_check`, `referral_internal_notes_kind_check`, and the TS module.
- A user role can no longer UPDATE a procedural event at all (its new row would fail the arm).
  Intended: auto-derived governance records are not hand-editable.
- **Still open, deliberately:** a case writer can `DELETE` a procedural event, and no audit row
  distinguishes a forged kind from an authentic one. Neither is a minting path; both are tracked in
  PROGRESS.md rather than folded in here.
- **Evidence.** Proved live as `staff3.ccih@test.local` (plain `staff` with a case write grant),
  rolled back, with a manual-kind positive control; neutralizing the arm makes both exploits succeed
  again and reds pgTAP `111` tests 6 and 8. ⚠ The write-path sweep could **not** be the evidence: its
  ARM-2 worklist is a 33-row snapshot with no `case_events` rows, so a diff-scoped subset ran zero
  cases and reported a clean pass (FUP-AUTHZ-WP-SNAPSHOT).

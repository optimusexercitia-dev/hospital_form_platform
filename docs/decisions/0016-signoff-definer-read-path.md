# ADR 0016 — SECURITY DEFINER read path for staff_admin sign-off

**Date:** 2026-06-13
**Status:** Accepted
**Phase:** 6 (Section Sign-offs & Submission Lifecycle)

## Context

Phase 6 turns on sign-offs. A `staff_admin`-role `requires_signoff` section is
counter-signed by a staff_admin of the commission, who must first see a
"pendentes de assinatura" queue and then review the response (read-only) before
signing. Both operate on `in_progress` responses owned by another member.

The general RLS model deliberately HIDES another member's in_progress response
and its answers from a staff_admin:

- `responses_select` lets a staff_admin read only `status = 'submitted'`
  responses of their commission.
- `answers_select` mirrors that — answers are reachable only when the parent is
  submitted (or the caller is the creator/admin).

Phase 7's submissions browser enshrines this as a hard invariant: "a staff_admin
cannot read the answers of another member's in_progress response." We must NOT
broaden those policies to serve the sign-off queue, for two reasons:

1. **It would break the Phase-7 invariant** — staff_admins would gain blanket
   read of every in_progress draft's answers.
2. **RLS recursion risk** — a visibility-aware `answers_select` would have to
   read `answers` to evaluate section conditions from within an `answers`
   policy.

## Decision

Expose a **narrow, purpose-limited `SECURITY DEFINER` read path** for the
sign-off use-case only, instead of broadening RLS:

- `public.list_signoff_queue(commission_id)` — `SECURITY DEFINER`, internally
  gated `if not app.is_staff_admin_of(commission) then return; end if;`. Returns
  the commission's `in_progress` responses that are awaiting a staff_admin
  signature, i.e. each one with ≥1 **visible** (evaluated per-response via
  `app.eval_condition` over `app.answer_map`), **unsigned**, **staff_admin-role**
  `requires_signoff` section. It returns metadata only (response id, form title,
  version, respondent name, the first pending section id+title, a pending count,
  started_at, updated_at) — never the answers.
- `public.get_response_for_signoff(response_id)` — `SECURITY DEFINER`. The single
  place a staff_admin reads another member's in_progress **answers**, returned
  ONLY when (a) the response is in_progress, (b) the caller `is_staff_admin_of`
  the commission, and (c) the response has a pending (visible + unsigned)
  staff_admin sign-off section. Otherwise raises `no_data_found` (no data, no
  leak). It returns the answer map + sign-off rows + respondent identity, but NO
  version tree: the frontend composes it with the member-readable
  `getVersionTree`, keeping this definer surface minimal.

### Queue predicate: also require submit-readiness

`list_signoff_queue` additionally requires the response be otherwise
submit-ready — every required input in every visible section answered, via the
single-sourced `app.response_required_complete` (which mirrors
`submit_response`'s walk). Rationale: the queue means "ready for my signature";
a draft still missing required answers cannot be submitted even after the
staff_admin signs, so surfacing it is noise. Single-sourcing the readiness
predicate keeps the queue and `submit_response` from drifting.

### The write path stays under RLS

`sign_section` is `SECURITY INVOKER`: the actual INSERT runs under the
`signoffs_insert` policy, so RLS remains the authority for WHO may sign
(respondent → creator; staff_admin → `is_staff_admin_of`; `signed_by =
auth.uid()`; in_progress). The RPC only ADDS the visibility precondition
(Architecture Rule 4) that RLS cannot cheaply evaluate, and reads response/section
metadata through a definer helper (`app.signoff_target`) because the invoker
SELECT on `responses` would otherwise be hidden from the staff_admin signer.

### RLS policy fix surfaced this phase (signoffs_insert / signoffs_select)

The original `signoffs_insert` and `signoffs_select` (migration 100006) encoded
their authorization as inline cross-table subqueries over `public.responses`.
Those subqueries are themselves evaluated under the INVOKER's RLS, and
`responses_select` hides another member's in_progress response from a
staff_admin — so the staff_admin counter-sign path could never succeed (the
insert's WITH CHECK and the `RETURNING *` read-back both saw the parent response
as invisible). Phase 1 only ever inserted sign-off rows as the superuser (seed),
so this was first exercised in Phase 6.

Migration `20260613090003` moves the response fact-finding into SECURITY DEFINER
predicates (`app.can_sign_section`, `app.can_read_signoff`) so they are not
re-filtered, with the **same role rules unchanged**. `signoffs_select` now
correctly lets a commission's staff_admin read sign-off METADATA (who/when/note)
of in_progress responses — necessary for the review-to-sign screen — while the
answers invariant is untouched (answers still flow only through the
pending-gated `get_response_for_signoff`).

## Consequences

- A deliberate, documented exception to the in_progress-answer invariant,
  scoped to the act of signing: a staff_admin can read another member's
  in_progress answers ONLY through `get_response_for_signoff`, ONLY while a
  visible staff_admin sign-off section is pending. Phase 7's submissions-browser
  path stays RLS-tight and its invariant holds.
- New custom SQLSTATEs: `P0014` (section not visible / unavailable for sign-off)
  and `P0015` (section already signed — the unique-race discriminator), mapped
  to pt-BR by the action layer. `save_section_answers`'s cross-version guards now
  use `P0013` (Phase-5 QA MINOR-2), distinct from the "already submitted"
  `check_violation`.

### Known v1 limitation: no answer-lock between sign-off and submission

A response stays `in_progress` and editable by its creator until submission, and
the schema has no answer-lock. So a `staff_admin` signature attests to a
then-current state that the respondent could still change before submitting (e.g.
sign, then the respondent edits an answer and submits). v1 accepts this — the
sign-off records who/when, and submission still re-checks required answers and
visibility. **No locking is built this phase.** Future direction (deferred):
either freeze a section's answers once its sign-off is recorded, or invalidate a
section's sign-off when any of its answers change after signing (and re-surface
it in the queue). Documented here so the trade-off is explicit; not a Phase-6
deliverable.

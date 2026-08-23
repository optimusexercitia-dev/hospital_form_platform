# ADR 0136 — Deferred `staff_admin` sign-off: attest a FROZEN response, block the PHASE not the SUBMIT

- **Status:** ACCEPTED 2026-08-23 (PO ruling) — ⛔ **build NOT started; a plan is developed separately.**
  ⭐ The acceptance covers the model below and the four points the PO ruled on directly. One question is
  deliberately **left open** (§ Open) and must be settled before a plan is written — it is the difference
  between *extend a state machine* and *extend a state machine and re-open response immutability*.
- **Supersedes:** nothing. **Amends in effect:** ADR [0004](0004-signoff-feature-flag.md) (the
  `signoff_enforcement` gate becomes role-split), ADR [0016](0016-signoff-definer-read-path.md) (its
  `in_progress` premise narrows — see Consequences), ADR [0017](0017-multi-phase-cases.md) (the
  `case_phases` lifecycle gains a state).
- **Applies to:** the case module only. Standalone form responses are explicitly out of scope (D2).

## Context

A `form_sections` row may set `requires_signoff` with `signoff_role ∈ {respondent, staff_admin}`.
Three catalog facts define the current behaviour:

1. `public.submit_response` raises `há seções pendentes de assinatura` (`HC012`) when any **visible**
   `requires_signoff` section has no sign-off row — gated by `app.feature_enabled('signoff_enforcement')`.
2. `app.can_sign_section` — the `WITH CHECK` of the `signoffs_insert` policy — requires
   `r.status = 'in_progress'`. A signature is insertable **only on a draft**, and
   `guard_submitted_signoffs_trg` hard-blocks an insert once the response is submitted.
3. `sync_case_phase_on_submit` flips the phase to `completed` **only on submit**, and `activate_phase`
   treats only `('completed','not_required','voided')` as settled. Submit is therefore what unblocks
   every downstream phase.

Sign-off and phase-completion are welded to one transition, in the order **attest → freeze**.

**The operational cost.** A member fills a phase whose section needs a coordinator counter-signature and
cannot submit. They must leave the wizard, tell a coordinator out-of-band, wait, and then return to press
submit — two round trips through the filler for a step they contribute no information to. The response
sits `in_progress`, which by the ADR-0016 invariant is invisible to everyone but its creator.

**The integrity cost — the reason this is not merely an ergonomics ticket.** Because the coordinator
signs an `in_progress` response, and nothing invalidates a signature when the answers move, **the filler
may edit the section after it was signed and then submit.** Verified against the live catalog: the
triggers on `public.answers` are `guard_submitted_children`, `reject_answer_on_display_item`,
`sync_answer_typed_values`, `derive_answer_version` — **none invalidates a sign-off** — and
`response_section_signoffs` carries `(id, response_id, section_id, signed_by, signed_at, note)` with **no
content hash and no answer-version pin**. Whatever the wizard chooses to disable, the database permits it,
and Rule 1 forbids counting UI hiding as a control. The signature today attests to a moving target.

⭐ **PO ruling 2026-08-23: the `staff_admin` signature attests CONTENT**, not authority. That settles it —
an attestation of content that can be invalidated by the attested party after the fact is not an
attestation. Reversing the order is the fix for both costs at once.

## Decision

**A `staff_admin` sign-off is collected AFTER the response freezes. It gates the PHASE, not the SUBMIT.**

- **D1 — Split the gate by signer role.** `submit_response` keeps blocking on unsigned
  `signoff_role = 'respondent'` sections (the filler is present; there is no coordination cost) and stops
  blocking on `signoff_role = 'staff_admin'` sections. `HC012` survives for the respondent arm.
- **D2 — Scope the deferral to case-phase responses** (`responses.case_phase_id is not null`). A
  standalone response keeps today's blocking behaviour. ⚠ **This is not economising** — the mechanism that
  blocks dependent work *is* the `case_phases.blocks` array, so deferring where there is no phase would
  silently downgrade the attestation to advisory, which is precisely the outcome the PO ruled against.
- **D3 — New phase status `awaiting_signoff`,** between `active` and `completed`.
  `sync_case_phase_on_submit` sets it when a visible `staff_admin` section is unsigned, and behaves exactly
  as today otherwise. ⭐ **It is deliberately NOT added to the settled set** — `activate_phase` already
  refuses to activate a phase whose `blocks` list contains anything outside
  `('completed','not_required','voided')`, so "downstream phases stay blocked" costs **zero new gating
  logic** and inherits the existing test coverage.
- **D4 — `responses.status` stays the two-value `in_progress`/`submitted`** (PO ruling). A submitted-but-
  unattested response **counts** in dashboards. Attestation state lives on the **phase**, never on the
  response — the smallest possible blast radius, since every consumer keys off `status = 'submitted'`.
- **D5 — The last signature completes the phase.** A new trigger on `response_section_signoffs` flips
  `awaiting_signoff → completed` once no visible `staff_admin` section remains unsigned, and only then runs
  `app.compute_case_phase_result` + `public.recompute_recommendations` + the case-status recompute. ⭐ The
  phase **result** therefore moves off the submit path onto the signature — where it belonged: today a
  phase result is computed from answers nobody has countersigned.
- **D6 — Any `staff_admin` of the commission may sign; there is no waiver.** Already true —
  `app.is_staff_admin_of` is role-scoped, not person-scoped — and recorded here because it is the answer to
  "what if the coordinator is on leave". ⛔ **No `org_admin` override, no per-person signature assignment**
  (PO ruling). Adding either would make the attester a variable and re-open who is vouching for what.

### Rejected alternatives, and why

- **Advisory obligation** — submit completes the phase and unblocks everything; the missing signature
  becomes an open obligation on the case, blocking only conclusion and surfacing in the readiness/gap
  report. Highest throughput, and the correct shape **if** the signature granted authority. It is not:
  D2's reasoning applies to the whole platform under the content ruling.
- **The coordinator signs and submits in one sitting** — one round trip, but the coordinator drives
  someone else's draft, the filler loses control of when their own answers freeze, and it fights the
  ADR-0016 invariant head-on rather than sidestepping it.
- **A per-section three-way policy** (`blocking` | `deferred` | `advisory`, chosen in the form builder) —
  **deferred, not rejected.** It is the plausible end-state, but building the three-way matrix before
  anyone has asked for the other two arms buys a test matrix and no behaviour. Revisit when a commission
  asks.

## Open — settle BEFORE writing the plan

**What happens when the coordinator reads the frozen answers and declines to sign?** Today they tell the
filler, who edits the still-`in_progress` draft. After this change the answers are frozen. Two shapes, and
they are not the same size:

- **(a) Route through the existing correction/supersession machinery** (`case_correction_requests`,
  `responses.supersedes_id`, `file_correction_request` → `start_correction_draft` → `approve_correction`).
  No new transitions; the audit trail is complete; heavier for "typo in field 3".
- **(b) Add `awaiting_signoff → active`, a reject-with-note that unfreezes the response.** Much lighter
  UX, but it re-opens the response-immutability question that D4 and the narrow `guard_submitted_children`
  carve-out otherwise leave closed, and it means a `submitted` response can return to `in_progress` — a
  transition the platform has never permitted.

⛔ This ADR does **not** decide it. A plan that assumes (a) and a plan that assumes (b) differ in scope,
in risk, and in which invariants need re-proving.

## Size — measured from the live catalog 2026-08-23; ⛔ re-derive before building

| surface | measured |
| --- | --- |
| `case_phases.status` storage | **`text` + `case_phases_status_check`** — not an enum; no `ALTER TYPE` |
| routines referencing `case_phases` | **43** (15 `app`, 28 `public`) |
| …of those, branching on phase `'active'`/`'completed'` | **22** — the audit tail; most need no edit, each needs a read |
| …of those, branching on the settled set (`'not_required'`) | **5** (`guard_case_phase_status`, `activate_phase`, `cancel_case`, `close_case`, `skip_phase`) |
| routines needing a substantive edit | **~10** (see Consequences) |
| RLS policies referencing `case_phases` **directly** | **0** — ⚠ DEFINER helpers (`app._case_caps`) do reach it |
| TS modules referencing `CasePhaseStatus` | **11**, real work in ~6 (`phase-status-pill`, `case-derive`, `cases-kanban`, `cases-table`, `format`, `case-status`) |
| pgTAP suites referencing sign-off | **16**; `80_signoffs.sql` is **305 lines / 45 refs** |
| E2E specs driving the sign-off queue | **7**; `phase6-signoffs.spec.ts` is **670 lines** |
| data migration required | **none** — the new path is strictly more permissive; no live phase changes meaning |

⚠ **The test surface dominates, not the doors** — `80_signoffs.sql`'s central assertions ("submit is
refused while unsigned") **invert** for the `staff_admin` arm and **stand** for the `respondent` arm. That
inversion is the delivery, not overhead attached to it.

## Consequences

- ⛔ **`close_case` would let you conclude a case with an unattested phase.** Its gate reads
  `status in ('pending','active')`; `cancel_case`'s sweep reads the same pair. `awaiting_signoff` must be
  added to **both** or D3's guarantee stops at the case boundary — the one hole in this design that is
  silent rather than loud.
- **`app.recompute_case_status` must count `awaiting_signoff` as work-in-progress.** It reads
  `bool_or(status = 'active')`; left alone, a case whose only live phase awaits a signature falls to
  `pending` or `not_started` and disappears from the coordinator's view at exactly the moment it needs
  their attention.
- ⚠ **`app.can_sign_section` is the `WITH CHECK` of `signoffs_insert` — widening it is a live
  authorization change,** not a convenience edit. It must admit `submitted` **only while the phase is
  still `awaiting_signoff`**; an unbounded widening lets a `staff_admin` sign a completed phase forever.
  Keystone it, and remember `prosecdef` belongs beside `pg_policies`.
- **Write a separate `guard_submitted_signoffs` rather than branching `guard_submitted_children`.** One
  function currently backs both the `answers` and the `response_section_signoffs` trigger; the carve-out
  must be INSERT-only, signoff-only, and provably leave the answers guard untouched. Branching the shared
  body makes that a review argument instead of a structural fact.
- **Extract `app.pending_staff_signoffs(response_id)` first.** "Which visible sections still need a
  `staff_admin` signature?" is computed independently in `submit_response` and `list_signoff_queue` today,
  and D5's trigger would be a third copy. Three copies of a `visible_when` evaluation drift; one does not.
- **`list_signoff_queue` widens past `r.status = 'in_progress'`.** Its `app.response_required_complete`
  filter already makes it a *ready-to-sign* queue, and a submitted response satisfies that trivially.
- **ADR 0016's door stays, but its premise narrows.** A coordinator reviewing a **submitted** case-phase
  response is already served by ordinary RLS (`responses_select` grants a staff_admin the submitted
  responses of their commission). The DEFINER path remains necessary for the standalone `in_progress` lane
  kept by D2 and for the per-response visibility evaluation — ⛔ do not read this as licence to delete it.
- **The authz-gate bill is real.** This touches an RLS predicate and several DEFINER bodies, so the phase
  gate needs `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` **plus** the diff-scoped door
  sweep over every changed gate (~1 min each, ~8–10 gates). Mechanical, but it is not free and it is not
  optional.
- **Ship behind a second flag alongside `signoff_enforcement`,** so today's behaviour stays selectable and
  the change can land dark. ADR 0004's rationale for a table-backed flag applies unchanged.
- **Re-emit every changed routine from `pg_get_functiondef`, never from migration text.** Several of these
  bodies have been rewritten at runtime; regenerating from a stale file silently reverts intervening
  patches.
- **`app.guard_case_phase_status` is the state machine's authority** and gains `active → awaiting_signoff`
  and `awaiting_signoff → completed`. Whether `awaiting_signoff → not_required` (skip) and
  `awaiting_signoff → voided` are admitted is a plan-time decision; its INSERT arm carries a standing
  ⚠ comment about an assertion that was written and reverted once — read it before touching the function.

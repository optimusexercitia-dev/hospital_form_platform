# ADR 0136 — Deferred `staff_admin` sign-off: attest a FROZEN response, block the PHASE not the SUBMIT

- **Status:** ACCEPTED 2026-08-23 (PO ruling) — ✅ **BUILT 2026-08-24**, migration
  `20261003001900_deferred_staff_signoff.sql`, plan
  [deferred-staff-admin-signoff.md](../plans/deferred-staff-admin-signoff.md). Ships behind
  `deferred_staff_signoff`, **OFF in production** (seed forces it on for local/E2E; the production
  flip is its own migration at the gate). **Amended:** § Amendment 1 below — eight things the
  § Size table and the Consequences got wrong, every one of them in the reassuring direction.
  ⭐ The acceptance covers the model below and the four points the PO ruled on directly.
  ✅ **The formerly-open decline-path question was SETTLED 2026-08-23 as shape (a)** — see § D7.
  ⛔ **Sequenced AFTER the ADR 0137 batch, not folded into it** (same ruling) — satisfied; 0137 was
  merged and pushed before this began.
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

## D7 — the decline path: SETTLED (PO ruling 2026-08-23)

⭐ **PO ruling: shape (a). A coordinator who declines to sign routes through the existing
correction/supersession machinery.** No `awaiting_signoff → active` transition is added; a `submitted`
response never returns to `in_progress`. Response immutability stays closed, and D4's blast radius is
unchanged.

This section was previously headed *"Open — settle BEFORE writing the plan"* and was the stated blocker on
writing any plan for this ADR. It is no longer a blocker. ⛔ **The rejected shape (b) is recorded below as
a rejected alternative, not as a live option** — do not re-open it without a new PO ruling.

**Consequence of the ruling, and it is a real cost to state plainly:** correcting a typo in a frozen,
declined response costs a full `file_correction_request` → `start_correction_draft` → `approve_correction`
cycle. That is the price of the ruling, accepted deliberately. If it proves intolerable in practice, the
answer is a *lighter correction flow*, **not** an unfreeze transition.

**Sequencing ruling, same date:** this ADR is **NOT** folded into the ADR 0137 case/referral usability
batch. It is sequenced **after** it, as its own increment with its own plan. Rationale is recorded in
[case-referral-usability-batch.md](../plans/case-referral-usability-batch.md) § "Out of scope"; the short
form is that the two collide on `get_case_detail` / `list_my_cases` (re-emitted by 0137 D10 **and**
branching on phase status) and on `case-phase-article.tsx` / `case-phase-list.tsx` (edited by 0137 D8).

### The two shapes that were weighed

The original text is kept verbatim below, because the reasoning is what makes the ruling reviewable:

- **(a) Route through the existing correction/supersession machinery** (`case_correction_requests`,
  `responses.supersedes_id`, `file_correction_request` → `start_correction_draft` → `approve_correction`).
  No new transitions; the audit trail is complete; heavier for "typo in field 3".
- **(b) Add `awaiting_signoff → active`, a reject-with-note that unfreezes the response.** Much lighter
  UX, but it re-opens the response-immutability question that D4 and the narrow `guard_submitted_children`
  carve-out otherwise leave closed, and it means a `submitted` response can return to `in_progress` — a
  transition the platform has never permitted.

*(Original closing line, now superseded by the ruling above: "⛔ This ADR does not decide it. A plan that
assumes (a) and a plan that assumes (b) differ in scope, in risk, and in which invariants need
re-proving.")* — **(a) is the ruling; (b) is rejected.**

## Size — measured from the live catalog 2026-08-23; ⛔ re-derive before building

| surface | measured |
| --- | --- |
| `case_phases.status` storage | **`text` + `case_phases_status_check`** — not an enum; no `ALTER TYPE` |
| routines referencing `case_phases` | **43** (15 `app`, 28 `public`) |
| …of those, branching on phase `'active'`/`'completed'` | **22** — the audit tail; most need no edit, each needs a read |
| …of those, branching on the settled set (`'not_required'`) | **5** (`guard_case_phase_status`, `activate_phase`, `cancel_case`, `close_case`, `skip_phase`) |
| routines needing a substantive edit | **~10** (see Consequences) |
| RLS policies referencing `case_phases` **directly** | **0** — ⚠ DEFINER helpers (`app._case_caps`) do reach it |
| TS modules referencing `CasePhaseStatus` | **11** — ✅ literally correct, but ⛔ **it is the wrong MEASURE**; the work surface is 24. See the correction under the table. |
| pgTAP suites referencing sign-off | **16**; `80_signoffs.sql` is **305 lines / 45 refs** |
| E2E specs driving the sign-off queue | **7**; `phase6-signoffs.spec.ts` is **670 lines** |
| data migration required | **none** — the new path is strictly more permissive; no live phase changes meaning |

⚠ **The test surface dominates, not the doors** — `80_signoffs.sql`'s central assertions ("submit is
refused while unsigned") **invert** for the `staff_admin` arm and **stand** for the `respondent` arm. That
inversion is the delivery, not overhead attached to it.

### Re-derivation of the whole table — 2026-08-23, two independent measurements

Both measurements ran against the live catalog / an exhaustive `rg` over `src/` + `e2e/`, comment-stripped
and word-boundary-matched.

**Rows that MATCH exactly:** `case_phases.status` is `text` + `case_phases_status_check` (base type, not an
enum — no `ALTER TYPE`); routines touching the settled set = **5**, and the same five names; RLS policies
referencing `case_phases` directly = **0** (the `app._case_caps` reach is confirmed at one remove);
pgTAP suites = **16**; E2E specs driving the queue = **7**; `phase6-signoffs.spec.ts` = **670 lines**;
`80_signoffs.sql` = **305 lines**; `app.guard_case_phase_status`'s INSERT-arm ⚠ comment exists verbatim.

**Rows that DIFFER, all upward — never assume the ADR's figure is the ceiling:**

| row | ADR said | measured | note |
| --- | --- | --- | --- |
| routines referencing `case_phases` | 43 (15 app / 28 public) | **47 (19 app / 28 public)** | the `public` half is exactly right; the whole divergence is `app`. **No** measurement basis reaches 15 — the tightest defensible (excluding name-only and comment-only matches) is 16 app / 44 total |
| …branching on `'active'`/`'completed'` | 22 | **23** | literal containment, the same shape the ADR's 22 must have used |
| `80_signoffs.sql` sign-off refs | 45 | **59 occurrences / 54 lines** | not reproducible under any pattern tried; the 305-line figure is right |

### ⛔ The TS row is literally correct and still misleading — this is the important correction

The row read *"11, real work in ~6 (`phase-status-pill`, `case-derive`, `cases-kanban`, `cases-table`,
`format`, `case-status`)"*. **11 is correct** for what it literally says: 11 modules reference the
*identifier* `CasePhaseStatus`. But that is **the wrong measure for the question the row is used to
answer** — "how much TS work is this?" — because it counts imports, not couplings:

- ⭐ **24 code-bearing modules** branch on this union once you include the files that test the status
  **string literals** without importing the type (plus 3 comment-only and 6 E2E specs). The identifier
  count misses every one of them. The union is declared once, at `src/lib/queries/cases.ts:68-75`, with
  5 members.
- ⛔ **`src/lib/cases/case-status.ts` must come off the "real work" list** — it declares the *unrelated*
  `CaseStatus` and mentions the phase union only in a comment at L68 **disclaiming** the relationship.
  Zero coupling. A name-similar file assumed to be a caller.
- ⭐ **The load-bearing fact the row omits entirely: adding a 6th member is mostly a SILENT change.** Only
  **3 files / 4 declaration sites** fail typecheck — `phase-status-pill.tsx:25`, `cases-kanban.tsx:23`,
  `cases-table.tsx:21` and `:29` (all `Record<CasePhaseStatus, …>`). Every other site is an `if`/`!==`
  chain that falls through. There is **no `assertNever`/`satisfies` guard anywhere over this union**, so
  "the compiler will find the call sites" is **false here** and must not be assumed.
- Three silent-failure sites worth naming, each a behaviour change with no error:
  - `src/components/cases/case-derive.ts:116-121` — `isBlockerSatisfied` returns `false` for an unknown
    member, so a new status **blocks all downstream phases**. That happens to match D3's intent, but it is
    accidental, not designed; the DB remains the authority.
  - `src/lib/queries/case-timeline.ts:99` — a **structural clone** of the union rather than an import,
    **already drifted**: missing `'voided'` (added for ADR 0085). A 6th member produces no error and routes
    into the durational-bar arm.
  - `src/components/cases/my-case-card.tsx:164` — casts `item.status as CasePhaseStatus` from `string`,
    defeating the one exhaustive check in that render path; `PhaseStatusPill` then does an unguarded
    `STATUS_META[status]` lookup — a runtime `TypeError`, not a fallback.

### Three claims that are true but INCOMPLETE — each hides a site the plan must cover

- **`close_case` carries `('pending','active')` TWICE** — the `HC031` gate *and* a post-update sweep that
  sets those phases to `not_required`. With `cancel_case`'s identical sweep that is **three** sites, not
  the two the Consequences imply. Adding `awaiting_signoff` to the gate but not the sweeps leaves the hole.
- **`app.recompute_case_status` reads TWO `bool_or`s** — `'active'` **and** `'completed'` — in one
  statement; the second decides `pending` vs `not_started`. The Consequences quote only the first.
- **`public.guard_submitted_children` backs a THIRD table**, `public.response_group_instances`. Its body is
  table-agnostic, so branching it would touch three tables — which strengthens, not weakens, the
  Consequences' "write a separate `guard_submitted_signoffs`" instruction.

⭐ **Not a number, but load-bearing for D1:** `submit_response`'s section cursor selects
`s.id, s.position, s.visible_when, s.requires_signoff` — **`s.signoff_role` is NOT selected.** D1's
role-split therefore requires **widening the cursor**, not merely adding a predicate. `submit_response`
also never references `case_phase_id` or `case_phases` (it is absent from all 47), so D2's
case-phase scoping needs a new lookup there too.

⭐ **Lesson, and the reason this is written into the ADR rather than only into a review:** every wrong row
was wrong in the *reassuring* direction, and the TS row was **wrong while being literally true** — the
failure was the choice of measure, not the count. The `⛔ re-derive before building` instruction is what
caught it; honour it for anything added below.

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

---

## Amendment 1 — what the build found (2026-08-24)

⛔ **Read this before the § Size table or the Consequences.** The ADR's own closing lesson —
*"every wrong row was wrong in the REASSURING direction"* — held again, and this time the errors were
mostly not counts but **missing sites**. Everything below was measured against the live catalog on the
day of the build; the full derivation is in the plan's § 1.

**A1 · The signing door the Consequences never name.** They name `app.can_sign_section` (the
`signoffs_insert` `WITH CHECK`) and `guard_submitted_signoffs_trg`. There is a **third** gate, and it
is the one the UI actually calls: `public.sign_section` (`prosecdef = f`, INVOKER) carries its own
`if v_status <> 'in_progress' then raise`. Widening the two the ADR names leaves every deferred
signature refused **with every policy and trigger assertion green**. ⭐ `prosecdef` beside
`pg_policies` is not enough — an INVOKER RPC in front of an RLS-gated insert is a *third* place to
look.

**A2 · "Two copies of the pending-signoff computation" is SIX.** The Consequences say it is computed
in `submit_response` and `list_signoff_queue`, "and D5's trigger would be a third copy". Measured
over every comment-stripped body containing `requires_signoff`: `submit_response` ·
`list_signoff_queue` · `get_response_for_signoff` · `sign_section` (twice) ·
`compute_due_notifications` · `save_section_answers`. The trigger is the **seventh**.

**A3 · The predicted drift had ALREADY happened — a live defect (BUG-SIGNOFF-GROUPCOND-001).** Five
of those six evaluated a *section's* `visible_when` with `app.eval_condition`, which handles only the
legacy single shape and **raises** `unknown condition op: <NULL>` on the group shape
`{match, conditions[]}` — a shape `app.is_valid_visibility` accepts and the section settings dialog
authors. So a `requires_signoff` section carrying a grouped condition made the sign-off queue, the
review-to-sign door, `sign_section` **and every save on that form** throw. The mandated extraction is
what fixes it, unified on `app.eval_visibility` (the evaluator `submit_response` already used).

**A4 · D7's ruled decline path did not exist.** `file_correction_request` gates
`if v_target_status is distinct from 'completed' then raise HC0M0`, so an `awaiting_signoff` phase was
not a correctable target. With no unfreeze (D7 rejects shape (b)) and no correction, a declined phase
is stuck forever — and the widened `close_case` gate then blocks the case permanently. That is a
**deadlock**, not the "heavier for a typo in field 3" cost D7 accepted. The build widens the gate
(phase targets only) and admits `awaiting_signoff → voided` to match.

**A5 · D5, moved naively, lands an HC061 raise on the wrong actor.**
`app.compute_case_phase_result` raises `HC061 selecione o resultado da fase % antes de enviar` for a
manual-result phase with no override. Today that aborts the SUBMIT, while the filler is present and
their `active` phase still admits an override. Moved onto the signature it lands on the
**coordinator** — for something only the filler can fix and can no longer fix, since
`set_case_phase_result_override` admits `('active','completed')` only. ⭐ **D5 moves the COMPUTATION,
not the PRECONDITION:** the build extracts `app.assert_phase_result_ready` and calls it from both the
compute path and the submit path, so the two can never disagree.

**A6 · "The test surface dominates, not the doors" is FALSE, and acting on it would have been
destructive.** § Size warns that `80_signoffs.sql`'s central assertions *invert* for the `staff_admin`
arm — "that inversion is the delivery". Measured: that file contains **zero** references to case
phases. It is entirely the STANDALONE lane, which **D2 deliberately leaves unchanged**. Not one
assertion inverts; the file is untouched and still passes. The delivery is a NEW suite
(`367_deferred_staff_signoff.sql`, 61 assertions).

**A7 · The database was never the whole gate.** `submit_response` stopped blocking — and the button
stayed `disabled`: `wizard-client.tsx` carries its **own** submit gate ("Há seções pendentes de
assinatura"), role-blind. With the DB half alone the feature is **unreachable in the product** while
pgTAP is fully green — *the SQL is truth about the SQL and evidence about nothing downstream*. Caught
only by `e2e/deferred-staff-signoff.spec.ts`. The client gate now splits by signer role exactly as
`submit_response` does, and the review screen states what the deferral means rather than letting the
requirement appear to lapse.

**A8 · The door sweep's domain is a NAME PREFIX.** The new predicate was first written as
`app.signoff_deferred_open`; `ARM=census` flagged it never-swept the day it landed, and the
diff-scoped sweep then matched **zero** gates — that arm's domain is `^(is_|can_|has_|…)`, a name
regex standing in for a property no regex decides. It was **renamed** to
`app.is_signoff_deferral_open` rather than backlogged, so the standing sweep owns it from here on.
Its sibling `app.pending_staff_signoffs` is set-returning with no identity guard, came back
**UNSUPPORTED** from the row-door sweep, and is recorded in `authz-unswept-backlog.txt` — **not**
under `helper:`, because it IS an input to `get_response_for_signoff`'s read-right scope.

### Gate record

`ARM=census` / `ARM=hat` / `ARM=floor` / `FROMFINDINGS=1 ARM=wrapper` — all **exit 0**, read unpiped.
Diff-scoped door sweep over the changed and new gates: `app.can_sign_section` **COVERED**,
`app.is_signoff_deferral_open` **COVERED**, `app.can_read_signoff` **COVERED**,
`public.list_signoff_queue` **COVERED**, `app.pending_staff_signoffs` **UNSUPPORTED** → backlogged.
pgTAP **218 files / 7210 tests / PASS** on a fresh reset (baseline before this change: 217 / 7149).
Unit **1715 tests / 124 files**. Lint (nine gates) + typecheck clean. E2E: the new spec plus an
eight-spec regression set over the touched surfaces — **65 passed / 0 failed / 0 infra / 0 flaky /
0 did-not-run**, 65 of 65 collected accounted for, exit 0.
⛔ **No full `e2e:prod` run covers this HEAD** — the scoped set above is what was measured.

15 neutralizations were RED-proved against suite 367, each asserting that the mutation MOVED the body
hash and that the restore brought it BACK. ⚠ One earned its keep immediately: the `close_case`
keystone was **VACUOUS** on the first pass — its fixture case also carried a `pending` sibling phase,
so HC031 raised for the wrong reason and reverting the widening left the suite GREEN. It now runs on
a single-phase case behind a stated precondition.

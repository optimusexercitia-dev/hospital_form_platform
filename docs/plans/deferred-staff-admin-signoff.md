# Plan — ADR 0136: deferred `staff_admin` sign-off

**ADR:** [0136](../decisions/0136-deferred-staff-admin-signoff-attests-frozen-content.md) ·
**Sequencing:** after the ADR 0137 batch (satisfied — 0137 is merged + pushed).
**Measured against the LIVE catalog 2026-08-24** (`pg_get_functiondef` / `pg_policies` /
`pg_trigger` / `pg_constraint`), never migration text.

---

## 1. What the re-derivation changed — read this before the task list

The ADR's `⛔ re-derive before building` instruction earns its keep a third time. Every
divergence below runs in the **reassuring** direction.

### 1.1 The signing door is `public.sign_section`, and the ADR never names it

The Consequences name two gates on the write path — `app.can_sign_section` (the
`signoffs_insert` `WITH CHECK`) and `guard_submitted_signoffs_trg`. There is a **third**,
and it is the one the UI actually calls:

```
public.sign_section(p_response_id, p_section_id, p_note)   -- prosecdef = f (INVOKER)
  if v_status <> 'in_progress' then
    raise 'esta resposta já foi enviada e não pode mais ser assinada'
```

Widening the two the ADR names and stopping there produces a build that passes every
DB-level assertion about policies and triggers and still refuses every deferred
signature at the RPC. ⛔ **`prosecdef` belongs beside `pg_policies`** — and an INVOKER
RPC in front of an RLS-gated insert is a *third* place to look, not covered by either.

### 1.2 "Two copies of the pending-signoff computation" is **six**

The Consequences say the computation "is computed independently in `submit_response` and
`list_signoff_queue` today, and D5's trigger would be a third copy." Measured — every
routine whose comment-stripped body reads `requires_signoff`:

| # | routine | evaluator | filters `in_progress`? |
| --- | --- | --- | --- |
| 1 | `public.submit_response` | `app.eval_visibility` | n/a (role-agnostic arm) |
| 2 | `public.list_signoff_queue` | ⚠ `app.eval_condition` | yes |
| 3 | `public.get_response_for_signoff` | ⚠ `app.eval_condition` | yes |
| 4 | `public.sign_section` (×2 — the HC014 gate **and** the notification auto-resolve) | ⚠ `app.eval_condition` | yes |
| 5 | `public.compute_due_notifications` | ⚠ `app.eval_condition` | yes |
| 6 | `public.save_section_answers` | ⚠ `app.eval_condition` | implicit |

D5's trigger is the **seventh**, not the third.

### 1.3 ⛔ The drift the ADR predicted has ALREADY happened — a live defect

`app.eval_condition` handles only the legacy single shape. `app.eval_visibility` handles
both that and the group shape `{match, conditions[]}`. A **section** may carry the group
shape: `form_sections_visible_when_shape` calls `app.is_valid_visibility`, which accepts
it, and `parseVisibleWhen` (`src/lib/forms/actions.ts:851`) authors it from the section
settings dialog's condition builder. Measured on the live catalog:

```
app.is_valid_visibility('{"match":"all","conditions":[{"question_key":"k","op":"equals","value":"x"}]}')
  -> t                                  -- authorable, and the CHECK admits it
app.eval_condition   (same rule, any answers)
  -> ERROR: unknown condition op: <NULL>
app.eval_visibility  (same rule, {"k":"x"})
  -> t
```

**So today: a `requires_signoff` section carrying a grouped `visible_when` makes
`list_signoff_queue`, `get_response_for_signoff`, `sign_section`,
`compute_due_notifications` and `save_section_answers` RAISE.** The sign-off queue page
errors for the whole commission, and `save_section_answers` fails every save on that
form. Filed as **BUG-SIGNOFF-GROUPCOND-001**. It is fixed *by* this plan, because the
ADR's mandated extraction is exactly the deduplication that removes it — unified on
`app.eval_visibility`, the evaluator `submit_response` already uses.

### 1.4 D7's ruled decline path does not currently exist

D7 rules that a declining coordinator "routes through the existing correction/
supersession machinery". Measured, `public.file_correction_request` gates:

```
if v_target_status is distinct from 'completed' then raise HC0M0
```

An `awaiting_signoff` phase is therefore **not a correctable target**. With no unfreeze
transition (D7 rejects shape (b)) and no correction path, a declined phase is stuck
forever — and `close_case`'s widened HC031 gate then blocks the case permanently.
⛔ This is a deadlock, not an ergonomic cost. `file_correction_request` must admit
`awaiting_signoff`, and `app.guard_case_phase_status` must therefore admit
`awaiting_signoff → voided` (the void arm of `approve_correction`).

### 1.5 D5 as written moves an HC061 raise onto the wrong actor

`app.compute_case_phase_result` raises **HC061** `selecione o resultado da fase % antes
de enviar` when a phase is manual-emitting (`emits_result` ∧ `result_ruleset is null`)
with no `result_override_id`. Today that raise aborts the **submit**, while the filler is
present and `set_case_phase_result_override` still admits their `active` phase.

D5 moves the `compute_case_phase_result` call onto the signature. Moved naively, the
raise lands on the **coordinator's signature** — for something only the filler can fix,
and can no longer fix (the override door admits `('active','completed')` only, so an
`awaiting_signoff` phase is refused to everybody). Deadlock again.

**Resolution:** D5 moves the *computation*, not the *precondition*. Extract
`app.assert_phase_result_ready(case_phase_id)` (the existing HC061 block, unchanged),
call it from `compute_case_phase_result` where the block sat, and **also** from
`sync_case_phase_on_submit`'s deferred arm — so the raise stays on the submit, where the
message ("antes de enviar") is true.

### 1.6 Rows that hold

`case_phases.status` is `text` + `case_phases_status_check` over exactly 5 values (no
`ALTER TYPE`) · 42 routines reference `case_phases` (15 `app` / 27 `public`) · RLS
policies referencing `case_phases` directly = **0** · `app.guard_case_phase_status`'s
INSERT-arm ⚠ comment is present verbatim and is preserved byte-for-byte ·
`80_signoffs.sql` = 305 lines · `phase6-signoffs.spec.ts` = 670 lines · pgTAP suites
touching sign-off = 16 · `activate_phase`'s settled set is
`('completed','not_required','voided')`, so D3's "zero new gating logic" claim is exact.

### 1.7 Routines measured and deliberately NOT changed

| routine | why no edit |
| --- | --- |
| `public.activate_phase` | `awaiting_signoff ∉ ('completed','not_required','voided')` ⇒ downstream stays blocked. **This is D3's whole mechanism.** |
| `app.case_phase_answer_map` / `app.case_phase_option_aggregates` | key on `= 'completed'`; an unattested phase must not feed results/indicators. |
| `public.set_case_phase_result_override` | `('active','completed')` ⇒ HC057 on `awaiting_signoff`. Correct: the result is settled before the freeze (§1.5) and correctable after completion. |
| `public.start_or_resume_phase` | `<> 'active'` ⇒ HC019. The response is frozen; there is nothing to resume. |
| `public.skip_phase` | `<> 'pending'` ⇒ HC019. Skip is for phases never started. |
| `public.recompute_recommendations` | keys on `'pending'` only. |
| `public.list_my_cases` | `'actionable', (cp.status = 'active')` — an awaiting phase is not the assignee's work. |
| `add_ad_hoc_*` / `delete_ad_hoc_case_phase` / `reassign_phase` / `start_correction_draft` | gate on **case** status, not phase status. |
| `public.guard_submitted_children` | left byte-identical; the signoff carve-out is a **separate** function (ADR Consequence). It backs a third table (`response_group_instances`) — branching it would touch three. |
| `app.can_read_signoff` (`signoffs_select`) | already `created_by ∨ tenancy_admin ∨ staff_admin`, status-agnostic. |
| ADR 0016's DEFINER door | stays. Still required for the standalone `in_progress` lane D2 keeps. |

---

## 2. Design

**Flag:** `deferred_staff_signoff`, seeded **disabled**, alongside `signoff_enforcement`
(ADR 0004's table-backed rationale unchanged). `seed.sql` enables it for local/E2E.
⚠ A flag flipped only by `seed.sql` is OFF in production — the production flip is its own
migration at the gate, deliberately not in this one.

**Reach of the flag.** It gates only what *changes behaviour*: `submit_response`'s
role-split, `sync_case_phase_on_submit`'s deferral, `can_sign_section` /
`sign_section`'s submitted arm, and the widened reads. The status-list widenings
(`close_case`, `cancel_case`, `recompute_case_status`, `guard_case_phase_status`,
`file_correction_request`) are **unconditional**: with the flag off no phase can reach
`awaiting_signoff`, so they are inert — and gating them would mean a flag flipped OFF
*after* a phase reached `awaiting_signoff` would strand it.

**The state machine.** `active → awaiting_signoff → completed`, plus
`awaiting_signoff → not_required` (the `cancel_case` sweep) and
`awaiting_signoff → voided` (§1.4). `awaiting_signoff` is deliberately **not** in
`activate_phase`'s settled set.

**Which response the phase's signature keys off.** `case_phases.current_response_id`,
set by `sync_case_phase_on_submit` in the same statement as the status. Signing a
**superseded** response therefore never completes the phase, and after
`approve_correction` re-points to the successor the signature is owed on the successor.

---

## 3. Task list

### Migration `20261003001900_deferred_staff_signoff.sql` (all bodies re-emitted from `pg_get_functiondef`)

| # | change | ADR |
| --- | --- | --- |
| M1 | flag `deferred_staff_signoff` (disabled), `on conflict (key) do nothing` | Consequences |
| M2 | `case_phases_status_check` += `'awaiting_signoff'` | D3 |
| M3 | **new** `app.pending_staff_signoffs(uuid)` — the ONE evaluator (`eval_visibility`) | Consequences |
| M4 | **new** `app.assert_phase_result_ready(uuid)`; `app.compute_case_phase_result` calls it | §1.5 |
| M5 | `app.guard_case_phase_status` += 3 transitions (INSERT-arm ⚠ comment preserved verbatim) | Consequences |
| M6 | `public.submit_response` — widen the section cursor to `s.signoff_role`; look up `case_phase_id`; skip the `staff_admin` arm for a case-phase response under the flag | D1, D2 |
| M7 | `public.sync_case_phase_on_submit` — `awaiting_signoff` arm (+ HC061 precondition); result/recommendation recompute deferred | D3, D5, §1.5 |
| M8 | `app.can_sign_section` — admit `submitted` **only** while phase `awaiting_signoff` ∧ `current_response_id = r.id` ∧ flag on | Consequences |
| M9 | **new** `public.guard_submitted_signoffs()` (INSERT-only, signoff-only); re-point `guard_submitted_signoffs_trg`; `guard_submitted_children` untouched | Consequences |
| M10 | **new** `app.trg_complete_phase_on_signoff()` + `AFTER INSERT` trigger — D5's completion | D5 |
| M11 | `public.sign_section` — widen the `in_progress` gate identically; both copies → M3 | §1.1 |
| M12 | `public.list_signoff_queue` — widen past `in_progress`; → M3 | Consequences |
| M13 | `public.get_response_for_signoff` — widen; → M3 | Consequences |
| M14 | `public.compute_due_notifications` — widen the signoff candidate arm; → M3 | §1.2 |
| M15 | `public.save_section_answers` — → M3 (fixes BUG-SIGNOFF-GROUPCOND-001 on the save path) | §1.3 |
| M16 | `public.close_case` — `awaiting_signoff` into the HC031 gate **and** the sweep | Consequences |
| M17 | `public.cancel_case` — `awaiting_signoff` into the sweep | Consequences |
| M18 | `app.recompute_case_status` — `awaiting_signoff` into **both** `bool_or`s | Consequences |
| M19 | `public.file_correction_request` — admit `awaiting_signoff` as a correctable target | §1.4 / D7 |
| M20 | `public.get_case_detail` — the response deep-link lateral admits `awaiting_signoff` | D5 (reviewability) |

### TypeScript

`CasePhaseStatus` gains a 6th member. ⛔ **Only 4 declaration sites fail typecheck**
(`phase-status-pill.tsx`, `cases-kanban.tsx`, `cases-table.tsx` ×2) — every other site is
an `if`/`!==` chain that falls through silently, and there is no `assertNever` over this
union. The compiler will **not** find the call sites; the list below is measured, not
compiler-derived.

- `src/lib/queries/cases.ts` — union + the `responseId` doc-comment.
- `src/components/cases/phase-status-pill.tsx` — `STATUS_META` entry ("Aguardando assinatura").
- `src/components/cases/cases-kanban.tsx`, `cases-table.tsx` — `PHASE_DOT` / `PHASE_WORD`.
- `src/components/cases/case-derive.ts` — `isBlockerSatisfied` **must not** admit it (it already
  returns `false` by fall-through — made explicit, the DB stays the authority).
- `src/lib/queries/case-timeline.ts:99` — the **structural clone**, already drifted (missing
  `'voided'`, added for ADR 0085). Replaced with an import of the union.
- `src/components/cases/coordinator-phase-actions.tsx` — the `awaiting_signoff` branch:
  "Ver respostas" + a primary "Assinar" deep-link.
- `src/components/cases/case-phase-article.tsx` — result badge / correction row admit it.
- `src/components/cases/format.ts` — `isOverdue` deliberately unchanged (frozen ≠ overdue).
- `src/lib/queries/signoffs.ts` — the queue item carries the phase context.

### Tests

- pgTAP **`367_deferred_staff_signoff.sql`** — the keystones (§4).
- `80_signoffs.sql` — the `staff_admin` arm's "submit is refused while unsigned"
  assertions **invert**; the `respondent` arm's **stand**. That inversion is the delivery.
- E2E — `phase6-signoffs.spec.ts` covers the standalone lane (unchanged by D2); the
  deferred lane gets its own spec.

## 4. Keystones (each must be RED-proven)

1. Flag OFF ⇒ byte-identical old behaviour (HC012 on both roles; phase → `completed`).
2. Flag ON, case-phase response, unsigned `staff_admin` section ⇒ submit SUCCEEDS,
   `responses.status = 'submitted'` (D4), phase = `awaiting_signoff`.
3. Flag ON, unsigned **`respondent`** section ⇒ HC012 still raised (D1's surviving arm).
4. Flag ON, **standalone** response (no `case_phase_id`) ⇒ HC012 still raised (D2).
5. A downstream phase whose `blocks` names the awaiting phase ⇒ `activate_phase` HC018.
6. `close_case` over an `awaiting_signoff` phase ⇒ HC031.
7. `cancel_case` sweeps `awaiting_signoff → not_required`.
8. `recompute_case_status` keeps the case `in_review`, not `pending`/`not_started`.
9. The last signature ⇒ phase `completed`, result computed, recommendations recomputed.
10. A `staff_admin` may **not** sign once the phase is `completed` (the bounded widening).
11. A `staff_admin` may **not** sign a **superseded** response.
12. `guard_submitted_signoffs` still blocks UPDATE/DELETE on a submitted response's
    signoff rows, and `answers` on a submitted response are still blocked
    (`guard_submitted_children` provably untouched).
13. A grouped `visible_when` on a `requires_signoff` section no longer raises
    (BUG-SIGNOFF-GROUPCOND-001) — the positive control is that it raises before M3/M15.
14. A manual-result phase with no result ⇒ HC061 on **submit**, never on the signature.

## 5. Gate bill

`ARM=census` · `ARM=hat` · `ARM=floor` · `FROMFINDINGS=1 ARM=wrapper`, **plus** the
diff-scoped door sweep over every changed gate — derived from the migration diff, never
by hand. Changed gates: `app.can_sign_section` (an RLS `WITH CHECK`), `app.pending_staff_signoffs`,
`app.assert_phase_result_ready`, `app.guard_case_phase_status`, `app.trg_complete_phase_on_signoff`,
`public.guard_submitted_signoffs`, `public.sign_section`, `public.list_signoff_queue`,
`public.get_response_for_signoff`, `public.file_correction_request`, `public.get_case_detail`.
⚠ `ARM=census` is the arm that catches a **brand-new** gate; the three new `app` routines
are in no BLIND set and pass `ARM=policy` vacuously.

---

## 6. Outcome (2026-08-24)

✅ **Built.** Everything in §3 landed, plus **three items the plan itself did not foresee**, each
recorded in ADR 0136 § Amendment 1:

- **M3b `app.is_signoff_deferral_open`** — a fourth extraction. The "is the deferral window open?"
  predicate is needed by THREE independent gates that must agree (`can_sign_section`,
  `guard_submitted_signoffs`, `sign_section`) plus two widened reads. ⚠ It was first named
  `app.signoff_deferred_open`; `ARM=census` flagged it never-swept and the diff-scoped sweep matched
  **zero** gates, because that arm's domain is a NAME REGEX. Renamed into the domain rather than
  backlogged — the standing sweep owns it from here on.
- **A7 — the wizard's own submit gate.** `wizard-client.tsx` disables submit on "Há seções pendentes
  de assinatura", role-blind. With the DB half alone the feature was **unreachable in the product**
  while pgTAP was fully green. `WizardData.deferStaffSignoff` (REQUIRED, resolved server-side) now
  splits that gate by signer role, and the review screen says what the deferral means. Caught only by
  the E2E spec — nothing in §4's keystone list would ever have found it.
- **A VACUOUS keystone of this plan's own §4.** K6 (`close_case` HC031) passed with the widening
  REVERTED: its fixture case also carried a `pending` sibling phase, so HC031 raised for the wrong
  reason. Split onto a single-phase case behind an explicit precondition (367 §3.2a). ⛔ It was the
  neutralization battery that found this, not review — a keystone nobody has tried to break is a
  claim, not a test.

**Gate figures** — ADR 0136 § Amendment 1 § Gate record (read them there, not here).

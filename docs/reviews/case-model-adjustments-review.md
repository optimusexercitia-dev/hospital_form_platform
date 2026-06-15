# QA Review — Case Data-Model Adjustments (D1–D15)

**Verdict: APPROVED**

Reviewer: `qa` · Date: 2026-06-14 · Suite: 126/126 Playwright (local Docker) + 292/292 pgTAP

---

## Summary

The three-axis audit (requirements D1–D15 / A1–A7, security / RLS, code quality) finds this
change set meets every binding requirement. Two minor deficiencies are called out below; neither
is blocking. An ADR is missing but the plan document (`the-current-case-data-bright-hartmanis.md`)
and the Decisions table entry in `PROGRESS.md` constitute an adequate decision record for the
scope of work.

---

## 1. Requirements audit (D1–D15, A1–A7)

**D1 — Phase model independent + parallel.** `activate_phase` (`093002`) replaces the "all earlier
phases" count with a `blocks`-array check: phases with `blocks = '{}'` activate immediately
regardless of sibling status; multiple phases can be `ativa` simultaneously. Confirmed parallel.

**D2 — All required; skip exempts.** `skip_phase` moves a phase to `nao_necessaria`; the conclude
gate counts `concluida OR nao_necessaria` as settled. No new required/optional flag added.

**D3 — Conclude gate.** `close_case` (`093003`) gates on `count(*) where status in ('pendente',
'ativa') > 0 → HC031` (unsettled phases) and `count(case_offered_outcomes) > 0 AND outcome_id IS
NULL → HC028` (outcome required). Both are hard server rejections. Cancel remains ungated.

**D4 — Blocker satisfied by concluida OR nao_necessaria; earlier-only.** `activate_phase`
checks `status NOT IN ('concluida','nao_necessaria')`. The column trigger
`guard_phase_blocks_shape` asserts every element `< this row's position`. The deep-validate
helper `app.validate_template_phase_blocks` checks position existence. The shape trigger is
attached to BOTH `process_template_phases` AND `case_phases`, so the earlier-only invariant
is enforced at the DB level on both the template and the live snapshot.

**D5 — recommend_when unchanged.** `reorder_template_phase`/`remove_template_phase` now remap
`blocks` alongside `recommend_when` in a SINGLE atomic UPDATE, preserving the same re-validate
cycle for both. `recompute_recommendations` call sites unchanged.

**D6/D7 — Status precedence + manual terminals.** `app.recompute_case_status` implements the exact
precedence (`cancelado`/`concluido` → early-return; `em_revisao` if any `ativa`; `pendente` if
≥1 `concluida`; else `nao_iniciado`). Skip-only stays `nao_iniciado` (D7). The two terminal
statuses are written only by `close_case`/`cancel_case` under `app.in_case_rpc`; the trigger
early-returns for them.

**D8–D11, D15 — Outcome vocabulary + cardinality + propagation + optional.** `case_outcomes`
is per-commission. `cases.outcome_id` is a single nullable FK (D9). `case_offered_outcomes` is
the frozen per-case snapshot; the conclude gate and selector read this, not the live template
join (D15 — the template link is `ON DELETE SET NULL`). D11 propagation is live: `get_case_detail`
and `list_cases_board` resolve the outcome JOIN at query time. D10 flags are signal-only: neither
`requires_action_plan` nor `is_adverse` appears in `close_case`'s gate conditions.

**D12 — Configurable status removed.** Migration `093000` drops the objects in correct dependency
order (public RPCs → app helpers → seed trigger → policies → table), explicitly without CASCADE,
so an unforeseen dependent would cause a loud failure rather than a silent drop. Verified: no
`case_status_defs`, `set_case_status`, `apply_case_status`, `case_terminal_key`,
`slugify_status_key`, `unaccent_fallback`, or `seed_default_case_statuses` object survives. The
frontend status-manager, status-def-dialog, and `/settings/statuses` page are deleted. The two
backend shims (`case-statuses.ts`, `status-actions.ts`) confirm zero surviving importers in
`src/app`/`src/components`.

**D13 — Read-only board.** `cases-kanban.tsx` uses `groupByFixedStatus` and renders cards as
`<Link>` elements; there is no drag handler, no `setCaseStatus` call anywhere in
`src/components`. The five columns are sourced from `CASE_STATUSES` (single source in
`src/lib/cases/case-status.ts`).

**D14 — Filters + % adverse.** `cases-view.tsx` provides fixed status chips + an outcome
`<select>` + "Apenas adversos" toggle, all client-side over board rows. `computeOutcomeBreakdown`
in `case-derive.ts` computes per-outcome counts and `adversePercent` (null when no outcome
assigned, avoiding a misleading "0%"). The KPI strip renders this breakdown (no new RPC per plan).

**A1–A7.** Labels verified pt-BR throughout. `CASE_STATUS_META` carries the correct label/token
mapping. The conclude-dialog pre-selects the current outcome and requires a choice when
`offeredOutcomes.length > 0` (A6 / A3). Blocked phases show "Bloqueada por Fase N" (A7).

---

## 2. Security / RLS

### 2.1 New table RLS policies

All three new tables have `enable row level security` and two policies each:

| Table | SELECT | Write (ALL) |
|---|---|---|
| `case_outcomes` | `is_member_of(commission_id) OR is_admin()` | `is_staff_admin_of(commission_id) OR is_admin()` |
| `process_template_outcomes` | `is_member_of(commission_of_template(template_id)) OR is_admin()` | `is_staff_admin_of(commission_of_template(template_id)) OR is_admin()` |
| `case_offered_outcomes` | `is_member_of(commission_of_case(case_id)) OR is_admin()` | `is_staff_admin_of(commission_of_case(case_id)) OR is_admin()` |

Commission scoping is via established helper functions. No cross-commission leakage path exists.

### 2.2 HC030 same-commission guard

`app.guard_process_template_outcome()` BEFORE INSERT trigger fires on every `process_template_outcomes`
insert. It reads both parents (`process_templates.commission_id` and `case_outcomes.commission_id`)
as SECURITY DEFINER and raises HC030 on mismatch — same pattern as `guard_case_tag_assignment`.
The `set_process_outcomes` RPC uses delete-then-insert; the trigger fires on every insert.

### 2.3 Status trigger and guard correctness

`recompute_case_status` (`093001`): SECURITY DEFINER; sets `app.in_case_rpc='on'` (local to
transaction), updates `cases.status`, then resets the flag. The AFTER trigger `recompute_case_status_trg`
is `AFTER INSERT OR UPDATE OF status ON case_phases` — **no DELETE event**, which is the correct
design to avoid the cascade-delete hazard documented in the plan. Depth-1, no recursion (the
`cases` AFTER side has no trigger writing `case_phases`).

`guard_case_status` (`093001`): CR-replaced to the fixed model; drops all `case_status_defs`
references. Terminal check is `old.status in ('concluido','cancelado')`. Non-status updates
(e.g. `set_case_outcome` writing `outcome_id`) pass through the "non-status update" branch and
are frozen once terminal unless `app.in_case_rpc='on'`.

### 2.4 Dropped-helper landmine: CLEAR

`app.case_status_is_terminal(uuid, text)` is dropped in `093000`. Every function the 092001
liveness sweep had pointed at it is restated with a plain fixed-enum check: `sync_case_phase_on_submit`,
`skip_phase`, `add_ad_hoc_phase`, `reassign_phase`, `cancel_case` in `093001`; `activate_phase`
in `093002`; `close_case`, `create_case_from_template` in `093003`. Each file carries exactly ONE
final definition, and no migration re-introduces the dropped helper. Grep of all migration files
confirms `case_status_is_terminal` exists only in historical 092000/092001 files and the drop +
comment lines in 093000/093001.

### 2.5 Phase-7 in_progress-answers invariant

`list_cases_board` and `get_case_detail` are extended with outcome metadata and phase `blocks`
integers respectively. Neither adds answer columns. The `response_id`/`submitted_at` lateral in
`get_case_detail` is unchanged: `r.status = 'submitted' AND cp.status = 'concluida'`. The Phase-7
invariant holds.

### 2.6 Anon/PUBLIC EXECUTE

Every public function created or CR-replaced in migrations 093001–093003 has a corresponding
`revoke execute ... from anon, public` at the end of the same migration. The app-schema helper
`recompute_case_status` revokes from `public` (correct — `app.*` functions are not directly
callable by anon/authenticated).

### 2.7 No service-role key in client code

`src/lib/supabase/admin.ts` is not imported by any client component. Every `@/lib/queries/*`
import in `"use client"` components is `import type` (verified in `case-lifecycle-actions.tsx`,
`coordinator-phase-actions.tsx`, `cases-kanban.tsx`, `case-derive.ts`).

### 2.8 Terminal-case activation coherence (HC020 vs HC025)

The tester confirmed (SPEC-D1-001) that `activate_phase` on a terminal case raises HC020
("case not open") rather than HC025 ("terminal frozen"). This is correct: `activate_phase` has its
own early-exit `if v_case_status in ('concluido','cancelado') then raise HC020`, which fires before
the `case_phases` UPDATE that would trigger `guard_case_status` with HC025. The two codes serve
distinct purposes (RPC-level open-case check vs. DB-level mutation guard) and are not in conflict.

---

## 3. Code quality

**TS strict, single source of truth.** `CaseStatus` is now a fixed union in `src/lib/cases/case-status.ts`
with `CASE_STATUSES`, `CASE_STATUS_META`, and `isTerminalCaseStatus`. All board/table/badge/filter
components import from this module; no parallel definition survives.

**Data access through `src/lib/queries/`.** All reads go through `listCaseOutcomes`,
`listProcessOutcomes`, `listCasesBoard`, `getCaseDetail`. No inline `supabase` calls in UI components.

**Server Components by default.** The new `/settings/desfechos/page.tsx` is an async Server Component
with a `notFound()` gate. Interactive management is in `OutcomeManager` (client component, correctly
`"use client"`).

**`blockedBy` helper.** Correctly treats a missing position as unsatisfied (defensive note in the
JSDoc), matching the server behavior.

**`reorder_template_phase` / `remove_template_phase` atomic renumber.** The initial implementation
had a bug where the position swap and blocks remap were split into two UPDATEs, exposing a
transient forward-ref that the BEFORE trigger would reject. This was caught and fixed before the
final test run (noted in the Decisions table): the single atomic UPDATE per row is in the committed
migration file.

---

## 4. Minor findings (non-blocking)

### MINOR-1: HC028 and HC031 not mapped in `mapCaseError` (actions.ts)

**File:** `src/lib/cases/actions.ts`, `closeCase` function (line 446)

**Issue:** `mapCaseError` in `actions.ts` maps HC016–HC025 but does NOT map HC028 (outcome
required) or HC031 (unsettled phases). When `close_case` raises either of these — a race where the
client-side gate passes but the server rejects — the error falls through to `MESSAGES.generic`:
"Não foi possível concluir. Tente novamente."

**Mitigation:** The `ConcludeCaseDialog` in `case-lifecycle-actions.tsx` enforces both conditions
client-side (`canConfirm` = outcome selected when offered; the dialog description mentions open
phases). In normal usage the server codes are only reachable via a direct API call. The E2E test
asserts HC028 at the API layer (line 286 of `cases-outcomes-blockers.spec.ts`), confirming the
server code is correct; it does not test the TS action error mapping.

**Requirement:** CLAUDE.md §8: "raw Supabase/Postgres errors never reach the UI" — the generic
message meets this; specific pt-BR messages are preferable. HC028/HC031 are new codes introduced
by this change set, so the error table in `docs/backend-state.md` is complete but the TS mapper
is not.

**Recommendation:** Add `'HC031': MESSAGES.unsettledPhases` and `'HC028': MESSAGES.outcomeRequired`
(with corresponding `MESSAGES` entries) to `mapCaseError` in `actions.ts`. Low urgency given the
client-side gate; not blocking.

### MINOR-2: No ADR for the combined change set

The plan document `the-current-case-data-bright-hartmanis.md` and the `PROGRESS.md` Decisions
entry (2026-06-14) together constitute a decision record, but there is no `docs/decisions/0024-*.md`
ADR (as planned in §J of the plan doc). Every other significant architectural choice in this project
has a short numbered ADR. The change set is large (4 migrations, 2 new feature concepts) and an ADR
would satisfy the hygiene rule in CLAUDE.md §8.

**Recommendation:** Create `docs/decisions/0024-case-model-adjustments.md` summarizing the three
decisions (phase blocking graph, fixed status computation, outcome vocabulary + conclude gate).
Not blocking.

---

## 5. Verdict

**APPROVED.**

All D1–D15 decisions are faithfully implemented. RLS is the security boundary on all three new
tables. The dropped-helper landmine is fully cleared. The Phase-7 in_progress-answers invariant is
preserved. The fixed status single source of truth is correctly placed and imported. The two minor
findings above are follow-up items, not blockers.

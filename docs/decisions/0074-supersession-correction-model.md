# 0074 — Supersession correction model (contract + UX finalization)

**Date:** 2026-07-13 · **Status:** accepted (design ratified at the S0 gate; no migration — the
contract binds the SUP track). **Owner:** platform lead → `backend`.
**Track:** SUP of the [Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md)
(ADR [0071](./0071-pre-pilot-release-scope-expansion.md)); build plan:
[supersession-correction.md](../plans/supersession-correction.md).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (extend, never contradict), Rule 3 (one
evaluator / SQL↔TS parity — here the "dashboard-countable" filter), Rule 5 (submitted-response
immutability), Rule 8 (regen types), Rule 9 (data access via `src/lib/queries/`), Rule 10 (pt-BR
UI / English code), Rule 11 (audit).

## Context

**The problem (from ADR [0060](./0060-flexible-forms-foundation.md) Gap 38, "Open gap — standalone-submission
correction").** A submitted `responses` row is hard-immutable
(`guard_submitted_response` / `guard_submitted_children` block UPDATE + DELETE) and there is no
`reopen_response`. The only recourse for a wrong standalone submission (routine audit, checklist,
self-assessment — `case_phase_id IS NULL`) is to **refill**, which creates a *new* `submitted` row
indistinguishable from a legitimate new-period submission. Dashboards and Phase-15 derived
indicators aggregate submitted answers by `question_key`, so **a wrong figure and its "correction"
both count**, corrupting the metric with no in-system remedy. This is an ALCOA+ nuance:
immutability is not the same as *controlled correctability*, which accreditation expects.

**What is already settled — this ADR does NOT re-open it.** ADR 0060 Gap 38 offered two candidate
shapes: **(a)** a `reopen_response` RPC (`submitted → in_progress` in place), or **(b)** an explicit
`supersedes` link with supersession-aware aggregation. **ADR [0065](./0065-pre-pilot-foundations-conventions.md)
§8 ratified shape (b)** — `responses.supersedes_id` + latest-in-chain aggregation — deferring only the
engine/UX under the freeze principle (§6: "the correction/`reopen` engine … additive-anytime").
ADR 0071 pulls that engine into the pre-pilot release. This ADR is the **finalization**: it fixes the
column contract, the `supersede_response` RPC signature, the aggregation retrofit surface, the audit
verb, and the UX — so the SUP build plan is a conformance target, not a re-litigation.

**Why (b), not (a) — recorded for the record (already decided; not re-argued).** Shape (a) mutates
the submitted row back to `in_progress`, which either (i) forces a `guard_submitted_response`
carve-out (a second RPC-flag exception like `app.in_submit_rpc`, widening the immutability escape
hatch), or (ii) breaks the invariant that a submitted answer set is frozen custody. Shape (b) keeps
**the original submitted row byte-for-byte untouched** — the correction is a *new* draft that
supersedes it — so the immutability guards stay closed and the audit trail keeps the superseded
snapshot intact. Cleaner, and ALCOA+-defensible (the original is preserved, the correction is a
distinct, linked, attributed record).

## Decision

### 1. Schema — one nullable self-FK + two integrity constraints

`responses` gains a single nullable self-referential column and two constraints. Additive,
forward-only, reset-OK (SUP migration window `20260720000000+`):

```sql
alter table public.responses
  add column supersedes_id uuid null references public.responses(id) on delete restrict;

-- One LIVE successor per superseded row: at most one response may point at a given
-- predecessor (prevents fan-out / ambiguous "latest in chain"). Partial-unique so the
-- overwhelming majority of rows (supersedes_id IS NULL) are unconstrained.
create unique index responses_one_successor_per_superseded
  on public.responses (supersedes_id)
  where supersedes_id is not null;

-- Coherent aggregation: a successor must share the predecessor's form_version_id AND
-- commission_id, so excluding the predecessor from a per-form / per-commission rollup and
-- counting the successor is arithmetic-neutral (same version, same commission scope). A
-- correction that changed the version or moved commissions would corrupt the count. This is
-- a ROW-LEVEL check that reads the parent, so it is enforced by a BEFORE INSERT/UPDATE
-- trigger (a CHECK constraint cannot subquery). See the plan for the trigger body.
```

- `on delete restrict` on the self-FK: a superseded row cannot be deleted out from under its
  successor (and submitted rows can't be deleted anyway — the guard blocks it). A draft successor,
  if discarded, is deleted directly (its own `supersedes_id` pointing at a live predecessor is
  removed with it — the predecessor stays, no orphan).
- **The self-FK lives on the SUCCESSOR row** and is set at creation time while the successor is
  `in_progress` (see §2). The predecessor (submitted) is never written. `submit_response` needs **no
  change** — when the successor is later submitted, the link already exists on its row and the status
  flip is the ordinary immutable-transition path.
- **`case_phase_id` interaction:** the successor is always standalone (`case_phase_id IS NULL`, §2).
  The predecessor must also be standalone (the RPC refuses case-wrapped predecessors). So both ends
  of a chain are standalone; case-wrapped responses never carry `supersedes_id`.

### 2. RPC — `supersede_response(p_response_id, p_reason)` — standalone-only, DEFINER

```sql
public.supersede_response(p_response_id uuid, p_reason text) returns public.responses
```

- **Returns** the NEW `in_progress` successor row (pre-linked via `supersedes_id = p_response_id`),
  so the caller can route the wizard straight into it — mirroring how `supersede_document` returns
  the new `rascunho` version.
- **`SECURITY DEFINER`**, `owner to postgres`, `search_path = app, public, pg_catalog`. DEFINER (not
  INVOKER) because it INSERTs a `responses` row *attributed to the caller* while enforcing authority
  in-body — the meetings / interviews / controlled-docs write-door pattern. (`discard_response` is
  INVOKER because it only DELETEs the caller's own draft under an RLS DELETE policy; a *supersede*
  creates a new attributed row and must gate authority itself.)
- **Authority: `staff_admin` OR commission-admin of the predecessor's commission** —
  `app.is_staff_admin_of(v_commission) OR app.is_commission_admin_of(v_commission)`, the exact gate
  `supersede_document` uses. "Coordinator" in the task brief maps to these commission-management
  roles (there is no separate `coordinator` role enum; the case coordinator is `staff_admin`-class).
- **Preconditions (in order), each a distinct SQLSTATE from the SUP block `HC0H0–HC0H9`:**
  1. Predecessor exists and is visible → else `no_data_found` (RLS-safe not-found; leaks nothing).
  2. Predecessor `status = 'submitted'` → else **`HC0H0`** "apenas respostas enviadas podem ser
     corrigidas" (an `in_progress` draft is edited directly; nothing to supersede).
  3. Predecessor `case_phase_id IS NULL` (**standalone-only**) → else **`HC0H1`** "esta resposta
     pertence a um caso; a correção é feita pela fase do caso". Case-wrapped responses are covered by
     the case-phase lifecycle and get NO affordance (mirrors `discard_response`'s `HC066` refusal).
  4. No existing LIVE successor for the predecessor (`supersedes_id` partial-unique would also catch
     it, but check first for a clean pt-BR error) → else **`HC0H2`** "já existe uma correção em
     andamento para esta resposta". At most one open correction chain per submitted row.
  5. `p_reason` non-blank (mandatory) → else **`HC0H3`** "informe o motivo da correção".
- **Body:** INSERT a new `responses` row with `form_version_id`, `commission_id`, `created_by =
  auth.uid()`, `status = 'in_progress'`, `case_phase_id = null`, `supersedes_id = p_response_id`.
  **Copy the predecessor's saved answers** into the new draft (via `app.answer_map` reconstruction or
  a direct `answers` copy — plan pins the mechanism) so the corrector edits a pre-populated copy
  rather than re-keying from scratch. The predecessor row and its answers are **read-only, never
  mutated**. Then `perform app.audit_write('response.superseded', 'response', p_response_id,
  v_commission, 'Resposta corrigida', jsonb_build_object('reason', p_reason, 'successor_id',
  v_new_id))`. Return the new row.
- **Flag gate:** first line `perform app.assert_response_correction_enabled();` (a new
  `assert_*` helper over `app.feature_enabled('response_correction')`) — flag OFF ⇒ the RPC raises
  and NO affordance renders (§4), so behavior is byte-for-byte pre-SUP.
- **t19 grant hygiene:** `revoke all on function public.supersede_response(uuid, text) from public;`
  then `grant execute … to authenticated, service_role;` (DROP+recreate resets grants — re-issue
  both). Required or the dashboard t19 pgTAP guard fails (memory `new-public-rpc-revoke-from-public`).

The wizard then edits the pre-linked draft and resubmits via the ordinary `submit_response`; the
chain resolves to **latest-in-chain** for aggregation (§3).

### 3. Aggregation retrofit — latest-in-chain, at the single choke-point (LOAD-BEARING)

S0 finding A4 confirmed `responses.supersedes_id` was **absent** — so Phase-15 and the dashboards
were built **NOT** supersession-tolerant (the filter column did not exist). The retrofit is
**required**. The precise surface (verified this branch):

**The "answerable submitted responses of a form" filter is centralized in ONE SQL function** —
`app.submitted_form_responses(p_form_id)` (baseline; SETOF `responses`, `status='submitted' AND
case_phase_id IS NULL`). **Every** dashboard RPC and **every** Phase-15 derived-indicator query fans
out from it. Retrofitting that one function propagates the fix everywhere at once:

- Add to its `WHERE`: **`and not exists (select 1 from public.responses succ where succ.supersedes_id
  = r.id and succ.status = 'submitted')`** — exclude any response that a *submitted* successor points
  at. (A merely `in_progress` successor does NOT yet exclude the predecessor — the predecessor stays
  counted until the correction is actually submitted, so a half-finished correction never blanks the
  metric.)

That single edit corrects, by construction, all six dashboard RPCs
(`dashboard_form_totals`, `dashboard_distributions`, `dashboard_free_text`,
`dashboard_submissions_over_time`, `dashboard_completion_by_member`, `dashboard_export_rows`) and all
four `compute_derived_measurement` paths (`tempo_medio` avg; `percentual`/`contagem` numerator;
`respondentes` denominator; `question_key` section denominator).

**The one exception — `commission_overview()`** (admin cross-commission overview) counts submitted
responses **inline** (`status='submitted' AND case_phase_id IS NULL` in two sub-selects), NOT via the
helper. It needs the **same `NOT EXISTS` predicate** added to both its `submitted_count` and
`submitted_last_30_days` sub-selects.

**The TS twin — `isDashboardCountable` in `src/lib/queries/dashboard.ts`.** Rule 3 requires the SQL
and TS "dashboard-countable" predicates to agree. The SQL helper is the aggregation authority; the TS
twin exists for any client-side filtering. It must gain the same successor-exclusion — its input
shape extends from `{ status, casePhaseId }` to also carry a `hasSubmittedSuccessor: boolean` (or the
caller supplies the chain), returning `false` when a submitted successor exists. `dashboard.ts`
otherwise delegates entirely to the DEFINER RPCs, so **no other TS aggregation change is needed** —
the retrofit is ~99% SQL-side.

**Definition — "latest in chain":** the exclusion is intentionally **narrow**. It excludes ONLY a row
that is *pointed at by a submitted successor via `supersedes_id`*. It does **NOT** deduplicate by form
or by user — ADR 0065 §8's accepted risk (some forms are filled repeatedly, e.g. a monthly audit) is
preserved: two unrelated submissions of the same form both count; only an explicit correction chain
collapses to its tip.

### 4. Audit — `response.superseded` via the MUTATION emitter (not the read allow-list)

`response.superseded` is a **state transition (a mutation)**, exactly like the shipped
`response.discarded`. It therefore emits through **`app.audit_write(...)` directly** and does **NOT**
join the `public.log_audit_access` allow-list or the `_audit_access_authorized` dispatch — those gate
*reads of another member's data / PHI reads* (`response.opened_foreign`, `event_patient.read`, …),
not mutations. (This corrects a common conflation: the two audit paths are distinct. Precedent:
`discard_response` writes `response.discarded` via `app.audit_write` with no allow-list touch —
`20260715000200_discard_standalone_draft.sql`.)

- **Metadata is PHI-free (Rule 11):** records *that* a supersede happened, *who* (via `audit_write`'s
  actor capture), the mandatory *reason* text, and the *successor id*. It carries **NO answer-level
  diffs** — **Gap 39 (per-answer revision history) stays dropped** (ADR 0060: it would re-ingest
  PHI/free-text). A governed correction needs only the controlled state transition (who/when/reason),
  not a field-by-field diff.
- One `response.superseded` row per `supersede_response` call.

### 5. Feature flag — `response_correction`

New flag `response_correction`. Convention (ADR 0071 §C): **insert OFF** in the SUP core migration;
**flip ON** via a separate one-line migration at the SUP phase gate; `seed.sql` may force ON for
local/E2E. Added to the hand-maintained `src/lib/queries/feature-flags.ts` `FeatureFlags` interface
when the first typed caller consumes it (the affordance + the `supersede_response` action). **Flag-OFF
fallback invariant:** with the flag OFF, `supersede_response` raises (no successor is ever created),
the affordance does not render, `app.submitted_form_responses` still contains the `NOT EXISTS`
predicate but it is a no-op (no successors exist), so aggregation is byte-for-byte pre-SUP. The
retrofit predicate is therefore safe to ship **unconditionally** (it is inert until a correction
exists) — it does not need to be flag-gated, which keeps the hot aggregation path free of a
per-query flag read.

### 6. UX — "corrigir envio" affordance + status badges

- On a **standalone submitted** response detail (only when `response_correction` is ON **and** the
  viewer is `staff_admin`/commission-admin of the commission), render a **"Corrigir envio"** control
  → a confirm dialog with a **mandatory reason** field (pt-BR: "Motivo da correção", required) →
  calls the `supersede_response` server action → on success routes into the pre-linked draft in the
  wizard. Pattern: `src/components/documents/supersede-document-button.tsx` (server-action-as-prop,
  `useActionState`, `router.refresh()` on `ok`) — but with the added mandatory-reason input.
- **Case-wrapped** responses (`case_phase_id` set) get **NO** affordance (the RPC would refuse with
  `HC0H1`; the UI must not offer it — the case-phase lifecycle owns corrections there).
- **Badges:** a superseded response shows **"substituído"** (muted/secondary tone); its successor
  shows **"atual"** (accent tone). This makes the chain legible in any response list.
- All raw SQLSTATEs map to pt-BR messages in the data layer (Rule 8/10); Postgres errors never reach
  the UI.

## Consequences

- **Supersedes only the *timing* of ADR 0060 Gap 38** (per ADR 0071): the model was already ratified
  in ADR 0065 §8 as shape (b); this ADR finalizes the contract + UX and moves the engine from
  "deferred / additive-anytime" into the pre-pilot SUP track. It does **not** change the ratified
  shape.
- **Gap 39 stays dropped** — no per-answer revision history. Confirmed here, not reconsidered.
- Immutability guards (`guard_submitted_response` / `_children` / `_selections`) are **unchanged** —
  no new carve-out. The original submitted row is preserved; the correction is a distinct linked
  record.
- The aggregation retrofit is centralized: **one** SQL function (`app.submitted_form_responses`) +
  **one** inline counter (`commission_overview`) + **one** TS twin (`isDashboardCountable`). No wide
  per-consumer edits.
- **X-θ resolved** (plan §2): the successor carries the link; the original is never mutated; SUP owns
  the latest-in-chain retrofit. A4 confirmed the retrofit is required.
- SQLSTATE block **`HC0H0–HC0H9`** allocated to SUP (S0 §B; high-water was `HC099`). Flag
  `response_correction` created OFF. t19 grant rule applies to `supersede_response`.

## Open decisions (flagged for lead / PO)

1. **Answer-copy on supersede — copy vs. blank-start.** This ADR specifies the successor draft is
   **pre-populated** with the predecessor's answers (correct-in-place ergonomics — you fix one field,
   not re-key the form). Alternative: start blank (force a full re-fill). **Recommend pre-populate**
   (matches the "correction" mental model; the corrector edits what was wrong). Confirm at plan
   review — it affects the RPC body and one E2E assertion.
2. **Successor discard path.** If a corrector opens a supersede draft and abandons it, they discard it
   via the existing `discard_response` (standalone, own, `in_progress` — all true for the successor).
   No new RPC needed. Confirm `discard_response` is acceptable as the abandon path (it is; noted so
   it is not re-invented).
3. **"Coordinator" authority mapping.** The task brief says "staff_admin/coordinator". There is no
   `coordinator` role enum; the authority is `is_staff_admin_of OR is_commission_admin_of` (the
   `supersede_document` gate). Confirm this is the intended authority set (it is the established
   form-management gate).

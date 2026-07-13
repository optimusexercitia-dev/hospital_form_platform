# Track Plan — SUP · Supersession correction engine + UX

**Status:** 📝 Plan — awaiting lead + human approval (S0 design gate; no code until approved) ·
**Date:** 2026-07-13 · **Flag:** `response_correction` (ships OFF → byte-for-byte pre-SUP; flipped
ON at the SUP gate) · **ADR:** [0074](../decisions/0074-supersession-correction-model.md) (finalizes
ADR [0065](../decisions/0065-pre-pilot-foundations-conventions.md) §8, from ADR
[0060](../decisions/0060-flexible-forms-foundation.md) Gap 38).
**Program:** SUP track of the
[Pre-Pilot Release Scope Expansion](./pre-pilot-release-scope-expansion.md) (ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md)), stage **S1**. **Settled spine:**
[S0 ratification](./pre-pilot-release-s0-ratification.md).
**SQLSTATE block:** `HC0H0–HC0H9` (S0 §B). **Migration window:** `20260720000000+` (forward-only,
additive, reset-OK). **Gate unit:** one Phase Gate (CLAUDE.md §6).

This is an additive, feature-flagged track. It clears the §6 gate bar — a new migration + a **new
RPC write-door** + an **aggregation retrofit that touches shipped metric queries** — so it runs the
full gate: contract-first plan → build → tester → qa → human approval. Per S0, migrations touching
this surface follow the **already-approved supersession pattern** (ADR 0065 §8 + the
`supersede_document` precedent), so the SUP *core* migration needs a **one-line plan + lead ack**; the
**aggregation retrofit** touches shipped metric queries and gets the **full plan review** below.

## 1. Goal

Give **standalone** submitted responses (`case_phase_id IS NULL` — routine audits, checklists,
self-assessments) a **controlled correction path** so a wrong submission and its fix do not both
count. Mechanism (ratified, ADR 0065 §8 shape (b)): a new `in_progress` **successor** row supersedes
the submitted **predecessor** via `responses.supersedes_id`; every submitted-answer rollup counts only
the **latest in chain**. The original submitted row is **never mutated** — immutability guards stay
closed.

**Invariants that MUST hold (regression-guard these):**
- **Original immutable:** `public.guard_submitted_response` / `public.guard_submitted_children` /
  `app.guard_submitted_selections` stay unchanged; the predecessor's row + answers are read-only
  forever. (Schema-qualified per readiness 2026-07-13 — the first two live in `public`, the third in
  `app`; pgTAP §9 must reference them correctly.)
- **Standalone-only:** a case-wrapped response (`case_phase_id` set) can never be superseded via this
  path and never renders the affordance; the case-phase lifecycle owns its corrections.
- **Narrow exclusion:** aggregation excludes ONLY a row pointed at by a *submitted* successor — it
  never dedupes by form/user (ADR 0065 §8 accepted-risk preserved: a monthly-audit form filled
  repeatedly still counts every submission).
- **Flag OFF ⇒ byte-for-byte pre-SUP:** the RPC raises, no affordance renders, the retrofit predicate
  is inert (no successors exist).
- **One correction chain per submitted row:** partial-unique on `supersedes_id`.
- **Coherent aggregation:** a successor shares the predecessor's `form_version_id` + `commission_id`.

## 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them)

Per CLAUDE.md contract-first discipline, `backend` commits the **signatures** below as typed stubs in
`src/lib/queries/**` + `src/lib/responses/actions.ts` BEFORE implementing, so `frontend` builds in
parallel against real types. Bodies may `throw new Error('not implemented')` to start. Keep the
return SHAPES stable once posted; tell the lead if a shape must change.

### 2.1 Data model (migration, additive — SUP core, `20260720000600_supersession_core.sql`)

> **Migration numbering (readiness 2026-07-13):** MEM consumed `20260720000000`–`…000500`; SUP core is
> **`…000600`**, flag-on is **`…000610`** (§6). Nothing occupies `…000600+`.

```sql
-- Self-referential correction link. Lives on the SUCCESSOR row; set at creation while
-- in_progress; the predecessor (submitted) is never written.
alter table public.responses
  add column supersedes_id uuid null references public.responses(id) on delete restrict;

-- At most one successor per superseded row (unambiguous latest-in-chain). Partial so the
-- vast majority of rows (supersedes_id IS NULL) are unconstrained.
create unique index responses_one_successor_per_superseded
  on public.responses (supersedes_id)
  where supersedes_id is not null;

-- Coherent aggregation: a successor must share the predecessor's form_version_id AND
-- commission_id. A ROW-level check reading the parent → BEFORE INSERT/UPDATE trigger
-- (a CHECK cannot subquery). HC0H4 on violation.
create or replace function app.guard_supersession_coherent() returns trigger
  language plpgsql security definer set search_path to 'app','public','pg_catalog' as $$
declare v_pfv uuid; v_pcomm uuid; v_pstatus text; v_pphase uuid;
begin
  if new.supersedes_id is null then return new; end if;
  select form_version_id, commission_id, status, case_phase_id
    into v_pfv, v_pcomm, v_pstatus, v_pphase
  from public.responses where id = new.supersedes_id;
  if v_pfv is null then
    raise exception 'resposta anterior não encontrada' using errcode = 'HC0H4';
  end if;
  if new.form_version_id <> v_pfv or new.commission_id <> v_pcomm then
    raise exception 'a correção deve manter versão e comissão da resposta original'
      using errcode = 'HC0H4';
  end if;
  -- Predecessor must be a standalone submitted row; successor must be standalone.
  if v_pstatus <> 'submitted' or v_pphase is not null or new.case_phase_id is not null then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;
  return new;
end $$;
alter function app.guard_supersession_coherent() owner to postgres;

create trigger guard_supersession_coherent_trg
  before insert or update of supersedes_id on public.responses
  for each row execute function app.guard_supersession_coherent();
```

> **Note (no RLS change needed for the successor INSERT):** the successor is created by the DEFINER
> RPC (§2.3), which bypasses RLS. The existing member SELECT / creator-write-while-`in_progress`
> policies already cover reading + editing the new draft (it is an ordinary `in_progress` response
> owned by the caller). The shipped `responses_delete_own_draft` policy already covers discarding it.
> **No new RLS policy is introduced** — a plus for the security review.

### 2.2 Predicates / helpers (`app` schema)

- `app.assert_response_correction_enabled() returns void` — raises if
  `not app.feature_enabled('response_correction')` (the `assert_*_enabled` pattern used by every
  flagged module, e.g. `assert_controlled_docs_enabled`).
- **RETROFIT** `app.submitted_form_responses(p_form_id)` — add to its `WHERE` the successor-exclusion
  (§3). This is the single aggregation choke-point.

### 2.3 RPC (DEFINER; SQLSTATE `HC0H·`; t19 grant hygiene)

```sql
public.supersede_response(p_response_id uuid, p_reason text) returns public.responses
```

- **Returns** the NEW `in_progress` successor (pre-linked `supersedes_id = p_response_id`), so the FE
  routes the wizard straight into it. Pattern: `supersede_document` (returns the new draft version) +
  `discard_response` (standalone/owner refusal semantics).
- **`SECURITY DEFINER`**, `owner to postgres`, `search_path = app, public, pg_catalog`.
- **Authority:** `app.is_staff_admin_of(v_commission) OR app.is_commission_admin_of(v_commission)`
  (the `supersede_document` gate; "coordinator" maps here — no separate role enum). Else `42501`.
- **Preconditions** (each raises a distinct pt-BR-mapped SQLSTATE):

| # | Check | Errcode | pt-BR message (data layer) |
|---|---|---|---|
| 0 | flag ON | (assert) | (raises via `assert_response_correction_enabled`) |
| 1 | predecessor visible | `no_data_found` | resposta não encontrada (RLS-safe) |
| 2 | predecessor `status='submitted'` | **HC0H0** | apenas respostas enviadas podem ser corrigidas |
| 3 | predecessor `case_phase_id IS NULL` | **HC0H1** | esta resposta pertence a um caso; a correção é feita pela fase do caso |
| 4 | no live successor already | **HC0H2** | já existe uma correção em andamento para esta resposta |
| 5 | `p_reason` non-blank | **HC0H3** | informe o motivo da correção |
| — | (coherence, from the trigger) | **HC0H4** | a correção deve manter versão e comissão da resposta original |

  (Precondition 3/4 are also backstopped by the trigger + partial-unique; the explicit checks give a
  clean message. `HC0H5–HC0H9` reserved for future SUP needs.)
- **Body:** INSERT the successor (`form_version_id`, `commission_id` copied from predecessor;
  `created_by = auth.uid()`; `status='in_progress'`; `case_phase_id=null`; `supersedes_id =
  p_response_id`); **copy the predecessor's answers** into the new draft (Open decision A — recommend
  pre-populate); `perform app.audit_write('response.superseded','response', p_response_id,
  v_commission,'Resposta corrigida', jsonb_build_object('reason', p_reason,'successor_id', v_new))`;
  return the new row. **Never write the predecessor.**
- **t19:** `revoke all on function public.supersede_response(uuid, text) from public;` then
  `grant execute … to authenticated, service_role;`.

### 2.4 Data-access + action stubs (`src/lib/**` — posted first)

```ts
// src/lib/responses/actions.ts  (server action; pt-BR error mapping, Rule 10)
export interface SupersedeResponseState { ok: boolean; error?: string; successorId?: string }
export async function supersedeResponseAction(
  prev: SupersedeResponseState | undefined, formData: FormData,
): Promise<SupersedeResponseState>            // reads p_response_id + reason; maps HC0H· → pt-BR

// src/lib/queries/responses.ts  (extend the existing response types)
export type SupersessionBadge = 'substituido' | 'atual' | null
// getResponseDetail(...) result gains:  supersedesId: string | null; supersededById: string | null;
//   badge: SupersessionBadge; canCorrect: boolean   // canCorrect = flag ON && staff_admin/admin && standalone && submitted && no live successor
```

```ts
// src/lib/queries/dashboard.ts  — Rule 3 SQL↔TS twin (extend the shape, mirror the exclusion)
export function isDashboardCountable(r: {
  status: ResponseStatus
  casePhaseId: string | null
  hasSubmittedSuccessor: boolean          // NEW — true when a submitted successor points at r
}): boolean // r.status === 'submitted' && r.casePhaseId == null && !r.hasSubmittedSuccessor
```

## 3. Aggregation retrofit (LOAD-BEARING — the full-review item)

**Verified surface (this branch, S0 A4 = column absent ⇒ retrofit required).** The "answerable
submitted responses of a form" filter is centralized in **one SQL function**; every dashboard RPC and
every Phase-15 derived query fans out from it. Enumerated so the qa/tester reviews are conformance
checks:

**A. Single choke-point — retrofit ONE function.**
`app.submitted_form_responses(p_form_id)` (baseline). Add to its `WHERE`:

```sql
and not exists (
  select 1 from public.responses succ
  where succ.supersedes_id = r.id and succ.status = 'submitted')
```

An `in_progress` successor does **not** exclude the predecessor (a half-finished correction never
blanks the metric); only a *submitted* successor does.

**Propagates automatically to — (must not need individual edits; verify each still routes through
the helper):**

| Consumer | File / location | Routes via helper? |
|---|---|---|
| `dashboard_form_totals` | baseline | ✅ `cross join lateral app.submitted_form_responses(f.id)` |
| `dashboard_distributions` | baseline | ✅ `resp` CTE |
| `dashboard_free_text` | baseline | ✅ `resp` CTE |
| `dashboard_submissions_over_time` | baseline | ✅ |
| `dashboard_completion_by_member` | baseline | ✅ |
| `dashboard_export_rows` | baseline | ✅ |
| `compute_derived_measurement` — `tempo_medio` | `20260712000200_indicators_derived_compute.sql` | ✅ |
| `compute_derived_measurement` — `percentual`/`contagem` numerator | same | ✅ |
| `compute_derived_measurement` — `respondentes` denom | same | ✅ |
| `compute_derived_measurement` — `question_key` section denom | same | ✅ |

**B. The ONE inline counter — needs a direct edit.**
`public.commission_overview()` counts submitted responses **inline** in two sub-selects
(`submitted_count`, `submitted_last_30_days`) with `status='submitted' AND case_phase_id IS NULL` —
it does **NOT** use the helper. Add the **same `NOT EXISTS`** predicate to **both** sub-selects.

> **⚠️ Build on the POST-MEM body (readiness 2026-07-13).** MEM **redefined `commission_overview` in
> `20260720000300_repoint_read_functions.sql`** (repointed to `public.memberships`). The retrofit must
> `CREATE OR REPLACE` from **that** post-MEM body, NOT the stale baseline definition — otherwise it
> reintroduces the dropped `organization_members`/`commission_members` references (runtime error) and
> regresses the MEM repoint. Copy the current (memberships-scoped) body verbatim, add only the two
> `NOT EXISTS` predicates.

**C. The TS twin — `isDashboardCountable`** (`src/lib/queries/dashboard.ts`). Rule 3 parity: extend
its input shape with `hasSubmittedSuccessor` and mirror the exclusion. `dashboard.ts` otherwise
delegates to the DEFINER RPCs (no other TS aggregation logic), so **no further TS change** is needed.

**D. Safe to ship unconditionally (not flag-gated).** The `NOT EXISTS` predicate is inert until a
successor exists (flag OFF ⇒ no successors), so it stays out of the hot path's flag read and is
byte-for-byte pre-SUP when off. **Do NOT** wrap it in a `feature_enabled` check.

> **Regen types after the migration** (Rule 8): `supabase gen types typescript --local >
> src/lib/types/database.ts`. `supersedes_id` appears on the `responses` row type; the new RPC gets a
> signature.

## 4. Audit

- Verb **`response.superseded`** — a **mutation** (state transition), so it emits via **`app.audit_write`
  directly**, NOT the `log_audit_access` allow-list / `_audit_access_authorized` dispatch (those gate
  *reads* of others' data / PHI). Precedent: `response.discarded`
  (`20260715000200_discard_standalone_draft.sql`) uses `app.audit_write` with no allow-list touch.
- **No allow-list edit is required** for `response.superseded`. (If a future *read* of a superseded
  chain were ever audited, that would be a separate `log_audit_access` verb — out of scope here.)
- Metadata PHI-free (Rule 11): the fact + actor + mandatory `reason` + `successor_id`. **No
  answer-level diffs — Gap 39 stays dropped.** One row per call.

## 5. UX (frontend — FE builds against §2.4 stubs)

- **"Corrigir envio"** control on a standalone submitted response detail, rendered ONLY when
  `canCorrect` (flag ON && `staff_admin`/commission-admin && `case_phase_id IS NULL` && submitted &&
  no live successor). → confirm dialog with a **required** "Motivo da correção" textarea → calls
  `supersedeResponseAction` → on `ok`, `router.refresh()` + route into the successor draft in the
  wizard. Pattern: `src/components/documents/supersede-document-button.tsx` (server-action-as-prop,
  `useActionState`), **plus** the mandatory-reason input.
- **No affordance** on case-wrapped responses (the RPC refuses `HC0H1`; the UI must not offer it).
- **Badges:** predecessor → **"substituído"** (muted); successor → **"atual"** (accent). Surfaced in
  response lists + the detail header.
- All SQLSTATEs → pt-BR in the data layer; Postgres errors never reach the UI (Rule 10).
- **Accessibility:** the dialog is keyboard-navigable, the reason field labelled, focus visible; the
  tester includes a keyboard-only correction flow (CLAUDE.md §8).

## 6. Feature flag

`response_correction`: **insert OFF** in the SUP core migration; **flip ON** via a separate one-line
migration `20260720000610_flag_response_correction_on.sql` at the SUP gate; `seed.sql` forces ON for
local/E2E. Add to `src/lib/queries/feature-flags.ts` `FeatureFlags` interface when the first typed
caller (the action/affordance) consumes it — a 20th key alongside the 19 existing.

## 7. Migration ownership & serialization

- **Independent surface** (S0 / plan §5): SUP touches `responses.supersedes_id` + the aggregation
  helper + `commission_overview` + `dashboard.ts`. **Object-overlap caveat (readiness 2026-07-13):**
  MEM redefined `commission_overview` (repoint to `memberships`) — SUP shares that *object* (not a file;
  SUP's is a later migration) and must build on its post-MEM body (§3.B). N does not touch these. Since
  MEM is already recorded (serialized before SUP), there is no live concurrency — safe.
- **One caution:** if any concurrent track edits `src/lib/queries/dashboard.ts` or the dashboard RPCs,
  serialize — but per S0 none do in S1. MEM edits `session.ts`/`members.ts` (disjoint).
- Local-first (`supabase migration up` → regen types) before any user-authorized remote push
  (reset-OK; background agents auto-denied).

## 8. Acceptance (the gate lock) — pgTAP + E2E + Vitest

**pgTAP (fresh reset — memory `pgtap-needs-fresh-reset-vs-e2e-leftovers`; run with `response_correction`
seeded ON):**
1. **Aggregation parity:** seed a form + two submitted standalone responses A, B; `supersede_response(A)`
   → edit + submit the successor A′. Assert: `app.submitted_form_responses(form)` returns {A′, B}
   (A excluded, A′ + B counted); `dashboard_form_totals` total = 2; `dashboard_submissions_over_time`
   sum = 2; a derived `contagem`/`percentual` over A's options counts A′ not A. **This is the keystone.**
2. **In-progress successor does NOT exclude:** after `supersede_response(A)` but BEFORE submitting A′,
   assert A is still counted (successor is `in_progress`), total still includes A.
3. **`commission_overview` parity:** same setup at the admin level → `submitted_count` excludes A,
   counts A′.
4. **Standalone-only refusal:** `supersede_response` on a case-wrapped submitted response (`case_phase_id`
   set) raises `HC0H1`.
5. **Not-submitted refusal:** `supersede_response` on an `in_progress` response raises `HC0H0`.
6. **One-chain:** a second `supersede_response(A)` while A′ is live raises `HC0H2` (and the
   partial-unique backstops a direct double-insert).
7. **Coherence trigger:** a hand-crafted successor with a different `form_version_id` or
   `commission_id` raises `HC0H4`.
8. **Authority:** a non-`staff_admin`/non-admin member calling `supersede_response` gets `42501`
   (RLS-safe not-found for a non-visible predecessor).
9. **Original immutable:** after supersede, an UPDATE/DELETE on the predecessor row (and its answers)
   still raises the immutability `check_violation` — guards unchanged.
10. **Audit:** exactly one `response.superseded` row per call, `metadata->>'reason'` present,
    `metadata->>'successor_id'` = A′, NO answer payload.
11. **Reason required:** empty/blank `p_reason` raises `HC0H3`.
12. **t19 guard:** `supersede_response` has no PUBLIC execute grant (the dashboard t19 pgTAP guard
    passes).
13. **Flag OFF:** with `response_correction` OFF, `supersede_response` raises; `app.submitted_form_responses`
    returns identical rows to a no-supersession baseline (predicate inert).

**E2E (`npm run e2e:prod`; flag ON in seed):**
- A `staff_admin` corrects a standalone submission → dashboard headline count is unchanged (correction
  replaces, not adds); the corrected value appears; predecessor badged "substituído", successor "atual".
- A case-wrapped response detail shows **no** "Corrigir envio" control.
- A non-admin member sees no affordance.
- **Flag-OFF spec:** with the flag OFF, no affordance renders and dashboards match pre-SUP counts
  (byte-for-byte behaviour).
- **Keyboard-only** correction flow (open dialog → type reason → submit via keyboard).

**Vitest:** `isDashboardCountable` truth table — submitted+standalone+no-successor ⇒ true; with a
submitted successor ⇒ false; `in_progress` ⇒ false; case-phase ⇒ false.

## 9. Open decisions (lead / PO) — RESOLVED 2026-07-13

Carried from ADR 0074 §Open decisions; all three settled at the SUP plan-approval gate:
1. **Answer pre-population vs blank-start on supersede** — ✅ **PRE-POPULATE** (PO decision 2026-07-13;
   correct-in-place ergonomics). The RPC body copies the predecessor's answers into the new draft;
   acceptance #1's edit step edits from the pre-filled state.
2. **Successor abandon path** = ✅ the existing `discard_response` (standalone/own/`in_progress` all hold
   for the successor). No new RPC. **Confirmed (lead).**
3. **Authority mapping** "coordinator" → ✅ `is_staff_admin_of OR is_commission_admin_of` (the
   `supersede_document` gate). **Confirmed (lead).**

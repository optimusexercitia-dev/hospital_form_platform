# QA Review — result-rec: Result-based phase recommendation (ADR 0043)

- **Reviewer:** qa (QA Reviewer agent)
- **Date:** 2026-06-26
- **Branch:** `feat/result-based-recommendation`
- **Commits audited:** `6c5baeb` (BR1 types) + `333085a` (BR2/BR3/BR4 migration + tests) + frontend FR1/FR2
- **Test baseline:** pgTAP 1122/1122 · Vitest 164/164 · E2E 431/0 (4 known skips) · typecheck + lint clean
- **ADR under review:** [0043](../decisions/0043-phase-result-based-recommendation.md)

---

## Verdict: APPROVED

Zero blocking or major findings. Two informational observations noted below. The
feature meets every requirement in ADR 0043, maintains zero evaluator drift, and
passes full pgTAP/Vitest/E2E gates.

---

## Audit findings

### 1. Requirements (ADR 0043 acceptance bullets)

**Legacy single shape still valid (no data migration):** Confirmed. The
`is_valid_recommend_when` superset preserves the exact original single-shape
predicate (lines 143–152 of migration 4). The `recommend_when_conditions`
normalizer appends `source:'answer'` to the legacy row so the group-walk loop
treats it identically to an answer-condition group element. The TS
`isLegacySingle` discriminator gates on absence of a `.conditions` array, which
is correct.

**Superset CHECK correct:** The `is_valid_recommend_cond` function allows
`source` absent or `'answer'` (answer), or `source='result'` with either
`adverse` (boolean) or `op`+`value` (equals|not_equals|in). The group wrapper
requires `match` in `{all,any}`, `conditions` as a non-empty array, each element
passing `is_valid_recommend_cond`. Both table CHECKs (process_template_phases and
case_phases) are dropped and re-added to the new function. Correct and complete.

**Answer-only ops restricted to choice set (no ordered ops in recommendations):**
Both `is_valid_recommend_cond` (answer branch, line 107) and the legacy single
branch of `is_valid_recommend_when` (line 150) restrict `op` to
`array['equals','not_equals','in']`. The TS types
(`RecommendAnswerCond`, `RecommendResultSpecificCond`) use
`Extract<ConditionOp, 'equals' | 'not_equals' | 'in'>`. The editor's op selects
expose only these three options for both answer and result-specific rows. No
ordered ops are reachable anywhere in the stack.

**Result values are ids (uuids):** `validate_template_recommend_when` casts each
value element `(e #>> '{}')::uuid` and catches null-cast (HC064). The SQL
normalizes scalar→array for both `equals/not_equals` and `in`. The TS mirror
(`rowToCond` in the editor) emits `singleValue` (a uuid string from the result
picker) or `multiValue` (an array of uuid strings from checkboxes). Values flow
from the `phase_results.id` field, not labels.

**No-result semantics consistent SQL↔TS:**
- `equals`/`in` over absent key → false: confirmed in both sides (SQL: `eval_condition` with absent key; TS: `evalCondition` with empty map).
- `not_equals` over absent key → true (documented footgun): confirmed. The
  `not_equals`-footgun warning in the editor (`showNotEqualsWarning`) fires for
  both answer and result-specific rows whenever `op === 'not_equals'`. The
  warning copy covers both the "no result" and "no answer" cases correctly.
- `adverse:true` over no result → false; `adverse:false` over no result → false:
  the synthetic map is `{}` (absent key) when `v_is_adverse is null` (SQL) and
  when `source.resultAdverse === null` (TS). Both feed an absent key to
  `eval_condition`/`evalCondition` which returns false for `equals` (the synthetic
  condition for adverse is always `equals`). Correct.

**HC063/HC064 enforced at add/update/publish AND at case materialization:**
`validate_template_recommend_when` is called by `add_template_phase`,
`update_template_phase`, `publish_process_template` (all unchanged callers from
prior migrations, confirmed by grep), and the re-stated
`create_case_from_template` now includes a group-aware call at
materialization time. pgTAP test 1 (HC063) and test 2 (HC064) both confirm
enforcement at add-time, and publish-time validation inherits from the same
function.

**Suggestion-only invariant:** `recompute_recommendations` updates only the
`recommended` flag (`update case_phases set recommended = v_should`). No status
column changes, no activation, no gating. Confirmed.

**Flag-off tolerance:** ADR 0043: "backend tolerates result-conditions when flag
is off (they no-op, since `result_id` stays null)". When `case_phase_results`
is off, phases have no `result_id`; result-conditions evaluate over a `{}` synthetic
map (no result = absent key) → false or true (not_equals footgun). No hard
rejection at the DB level; the editor hides the result-source radio. The flag-off
path is safe: it silently no-ops, which is the documented behavior.

---

### 2. Architecture Rule 3 — zero evaluator drift

`app.eval_condition` is NOT redefined in migration 4. The new migration only
CALLS it (at lines 432 and 441) via the synthetic-map indirection. The TS
`evalCondition` function is unchanged (same file, no edits to the function body).
The shared vector fixture `condition-vectors.json` is not modified.

The `recommendation.test.ts` no-drift test (lines 249–314) re-keys each
choice-op vector from the shared fixtures onto `RECOMMEND_RESULT_KEY` and
verifies `evalRecommendation` agrees with `evalCondition` for every vector —
proving the delegation is exact, not an approximation.

The SQL synthetic-map construction exactly mirrors the TS:
- Result-specific: `jsonb_build_object('__phase_result__', v_result_id::text)` vs
  `{ [RECOMMEND_RESULT_KEY]: source.resultId }` (both absent when null). Match.
- Result-adverse: `jsonb_build_object('__phase_result_adverse__', to_jsonb(v_is_adverse))` vs
  `{ [RECOMMEND_RESULT_ADVERSE_KEY]: source.resultAdverse }` (both absent when null). Match.
- Answer: SQL strips `from_phase` and `source` keys (`rc - 'from_phase' - 'source'`)
  yielding `{question_key, op, value}`; TS builds `{question_key: c.question_key, op: c.op, value: c.value}`.
  Both pass a `VisibleWhen`-shaped object to the unchanged evaluator. Match.

The combinator fold is identical: SQL initializes `v_should := (v_match <> 'any')`
(true for ALL, false for ANY) and applies `and`/`or` per iteration; TS uses
`conditions.every`/`conditions.some`. Match.

---

### 3. RLS / Security

**SECURITY DEFINER functions retain ownership:** All four re-stated functions
(`validate_template_recommend_when`, `recompute_recommendations`,
`set_case_phase_result_override`, `create_case_from_template`) carry
`security definer`, `set search_path to 'app', 'public', 'pg_catalog'`, and
`alter function ... owner to postgres`. Unchanged from prior migrations.

**Grant continuity:** The three new `app`-schema IMMUTABLE helper functions
(`is_valid_recommend_cond`, `is_valid_recommend_when`, `recommend_when_conditions`)
receive no explicit `GRANT`/`REVOKE` in migration 4. This is correct: the
`100_dashboard` anon-execute guard (test 19) only scans the `public` schema
(`n.nspname = 'public'`), and these functions live in `app`. Peer `app`-schema
functions follow the same pattern (no explicit revoke needed). The re-stated
`public.*` functions inherit existing grants from the prior migrations that
originally established them — `CREATE OR REPLACE` preserves grants on Postgres.

**Migration 5 (revoke anon snap_referral):** Correctly scoped: one line,
`REVOKE ALL ON FUNCTION public.snap_referral_commission_names() FROM PUBLIC`.
Closes the anon-execute leak that tripped test 19. No other changes.

**HC063/HC064 DB-level enforcement:** The validator raises with SQLSTATEs HC063
and HC064 before any row is written; these are enforced inside SECURITY DEFINER
functions that run as `postgres` and cannot be bypassed by the caller's
permissions. The `app.in_case_rpc` GUC dance in `recompute_recommendations` and
`set_case_phase_result_override` correctly brackets only the direct-table mutation
and is reset after. The nested call to `recompute_recommendations` from inside
`set_case_phase_result_override` re-enters the GUC dance safely within the same
transaction.

**`set_case_phase_result_override` active-branch:** The `'ativa'` branch stores
the override without calling `recompute_recommendations` (correct, per ADR 0043:
"'ativa' branch only STASHES the override — effective result lands at conclude →
no recompute there"). At form submission, `sync_case_phase_on_submit` (trigger
function in the phase-results migration) calls both `compute_case_phase_result`
and `recompute_recommendations`, so the conclude pathway is fully covered.

**No PHI surface:** This feature reads `case_phases.result_id` (a uuid — a
vocabulary reference, not patient data) and `phase_results.is_adverse` (a
boolean). No PHI tables are touched. Not a PHI concern.

---

### 4. Code quality

**TypeScript strict / `any`:** Zero unjustified `any` in `conditions.ts` or
`recommend-when-editor.tsx`. The one cast `as Extract<ConditionOp, 'equals' | 'not_equals' | 'in'>`
(line 274) is a narrowing cast with a comment noting that recommendations only
carry choice ops — appropriate.

**Data access through `src/lib/queries/`:** The new `RecommendRule`, `RecommendGroup`,
`RecommendCond` types and `evalRecommendation` live in `src/lib/queries/conditions.ts`.
The type widening is in `src/lib/queries/process-templates.ts`. No inline Supabase
queries introduced. Architecture Rule 9 satisfied.

**Server Components first:** `recommend-when-editor.tsx` and `phase-slot-dialog.tsx`
are explicitly `"use client"` components — correct, as they contain interactive
state. No server-component boundary violations.

**Service-role key:** `src/lib/supabase/admin.ts` carries `import 'server-only'` as
its first line; the `SUPABASE_SERVICE_ROLE_KEY` appears only there and in `.env.local`
(gitignored). The E2E spec uses `process.env.SUPABASE_SERVICE_ROLE_KEY` in a Node
test runner context (not browser-shipped), which is the correct pattern.

**pt-BR user-facing strings:** All user-visible strings in the editor are in
Brazilian Portuguese: "Recomendação automática", "Recomendar esta fase com base em
fases anteriores", "Resposta de fase", "Resultado de fase", "Fase de origem",
"Combinar condições", "Atender a TODAS as condições", "Atender a QUALQUER condição",
"Adicionar condição", "Pré-visualizar", "Recomendaria esta fase",
"Não recomendaria esta fase", error/warning copy. Correct.

**Accessibility:** Every control in the editor has an associated label:
- The outer fieldset has a `<legend>Recomendação automática</legend>`.
- The enable checkbox has a wrapping `<label>`.
- The combinator select has `aria-label="Combinar condições de recomendação"`.
- Source-type radios are in a `<fieldset>` with `<legend>Tipo de origem</legend>`;
  each radio has a wrapping `<label>`.
- From-phase select: `<label htmlFor={...}>` + `id` on the select.
- Result-mode radios: `<fieldset>` + `<legend>Verificar</legend>`.
- Adverse-value select: `<label htmlFor={...}>`.
- Preview panel: `role="status"`, `aria-live="polite"`, `aria-label`.
- Remove-row button: `aria-label="Remover condição {n}"`.
- The footgun warning has `role="status"`.
- E2E test RR-K exercises the keyboard path (Space on checkbox, Arrow on radios,
  Enter on "Adicionar condição" button).

**Errors user-readable:** No raw Postgres errors reach the UI. Server actions
return typed error states; the editor surfaces the `error` prop as a `role="alert"`
paragraph. HC063/HC064 are caught by the validator before the row is written and
would surface as a form error through the action layer.

---

### 5. Test coverage adequacy

**pgTAP `161_recommend_result_source.sql` (20 assertions):** Covers HC063/HC064
validation, publish with group recommend_when, creation-time state (no result →
all false except not_equals footgun), Case A (Conforme/non-adverse: all result
legs), Case B (Não-conforme/adverse), and override→recompute re-flip. Each result
evaluation path (specific equals, adverse true/false, mixed any-group, not_equals
footgun) is probed against real case materialization. Coverage is adequate for the
SQL side.

**Vitest `recommendation.test.ts` (32 assertions):** Covers null/legacy/group
shapes, all/any fold, result-specific (equals/in/not_equals), adverse
(true/false/no-result), and the no-drift proof using the shared vector fixtures.
Adequate.

**E2E `recommend-result.spec.ts` (9 tests):** Covers specific-match, specific-no-match,
adverse-match, adverse-no-match, mixed-QUALQUER (result-leg / answer-leg / neither),
override re-flip, and keyboard accessibility. All paths assert both DB truth (via
service-role GET) and UI badge presence/absence. Adequate.

---

### 6. Open risk (non-blocking)

**Remote `supabase db push` pending (human-run):** Migrations
`20260630000004` and `20260630000005` are verified locally (full pgTAP green on
fresh `supabase db reset --local`) but have not yet been pushed to the remote
Supabase project. This is a deployment prerequisite, not a code defect. Noted in
the PROGRESS.md gate status and must be completed before the feature is live in
production.

---

### 7. Informational observations (not blocking)

**INFO-1: `app.recommend_when_conditions` lacks an explicit grant/revoke.**
The three new `app`-schema helper functions carry no `GRANT/REVOKE` lines. This is
consistent with every other pure `app`-schema helper in the codebase (the
`is_valid_visibility`, `eval_condition`, etc. family have no explicit grants either)
and the anon-execute guard only covers the `public` schema. No action required.

**INFO-2: The TODAS/QUALQUER combinator is hidden when only one row exists.**
The serialized output is always a group (even for a single row), but the combinator
`<select>` only renders when `rows.length > 1`. This is intentional UX (a single
condition has no meaningful combinator), and the serialized JSON correctly includes
the `match` field in all cases. No action required.

---

## Summary

| Area | Result |
| ---- | ------ |
| Requirements vs ADR 0043 | All bullets met |
| Legacy shape backward-compat | Confirmed (superset CHECK, no data migration) |
| Answer-only ordered-op exclusion | Enforced in SQL CHECK + TS types + editor UI |
| Result values are ids | Enforced at validation + editor picker |
| No-result semantics SQL↔TS | Identical in both evaluators |
| Architecture Rule 3 — zero evaluator drift | Confirmed: eval_condition unchanged; synthetic-map reuse exact |
| HC063/HC064 enforcement | At add/update/publish AND at case materialization |
| Suggestion-only invariant | Only `recommended` flag mutated |
| Flag-off tolerance | No-op (result_id null → absent key) |
| RLS / SECURITY DEFINER continuity | Ownership, search_path, grants all preserved |
| Anon-execute (migration 5) | Correctly scoped REVOKE |
| TS strict / any | Clean |
| pt-BR strings | All user text in Portuguese |
| Accessibility | Labels, ARIA, keyboard fully covered |
| Service-role key isolation | `server-only` guard in place |
| Test coverage | pgTAP 20 + Vitest 32 + E2E 9; all green |
| Open risk | Remote db push pending (human-run, non-blocking) |

**VERDICT: APPROVED**

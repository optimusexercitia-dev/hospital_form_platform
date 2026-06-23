# QA Review — `case_phase_results` Feature
## Per-Phase Categorical Result for Multi-Phase Cases (with Manual Override)

**Reviewer:** qa  
**Date:** 2026-06-23  
**Branch:** `feat/case-phase-results`  
**Commits reviewed:** `1993209` (stubs), `67e1d4f` (migration + SQL + data-access), plus all uncommitted frontend work in the working tree  
**Migration:** `supabase/migrations/20260620020000_phase_results.sql`  
**Plan baseline:** `/Users/mike/.claude/plans/i-am-just-brainstorming-whimsical-narwhal.md`

---

## Verdict

**APPROVED**

Zero blockers. Zero majors. Two observations are noted below; both are non-blocking INFO items.

---

## 1. Requirements Coverage

| Plan Requirement | Delivered | Evidence |
|---|---|---|
| Per-commission `phase_results` vocabulary (label, color_token, is_adverse, position, archived) | Yes | Migration lines 86–109; `phase-results.ts`; `result-vocab-manager.tsx` |
| `result_ruleset` authored on `process_template_phases` (structural CHECK; nullable) | Yes | Migration lines 139–161 |
| Ruleset snapshotted onto `case_phases.result_ruleset` at case creation | Yes | `create_case_from_template` replace, migration lines 946–986 |
| `case_phase_offered_results` frozen at case creation | Yes | Migration lines 997–1009 |
| `case_phases` result columns (`result_id`, `result_source`, `result_computed_at`, override columns) | Yes | Migration lines 168–199 |
| `app.compute_case_phase_result` — override-then-computed; `eval_condition` UNCHANGED; offered-set guard | Yes | Migration lines 449–548 |
| `set_case_phase_result_override` DUAL entry points (ativa: assignee/staff_admin; concluida: staff_admin + non-terminal) | Yes | Migration lines 569–654 |
| `validate_template_result_ruleset` — question_key exists in published form (HC016/HC017); result_id in-commission non-archived (HC059) | Yes | Migration lines 368–441 |
| Publish-time validation loop extended | Yes | Migration lines 869–875 |
| `sync_case_phase_on_submit` calls `compute_case_phase_result` atomically after phase flip | Yes | Migration lines 1036–1076 |
| `trg_audit_case_phases` allow-list extended (`result_id`, `result_override_id` — NOT reason) | Yes | Migration line 1092 |
| Explicit audit row from `set_case_phase_result_override` (fact + option id; reason NOT copied) | Yes | Migration lines 642–645; pgTAP tests 18–20 |
| `list_cases_board` and `get_case_detail` project live-resolved `result` object | Yes | Migration lines 1101–1304 |
| Feature flag `case_phase_results` ships OFF; `compute_case_phase_result` early-returns when off | Yes | Migration lines 461–465; 1355–1357 |
| TS: `ResultRule`, `ResultRuleset`, `walkResultRuleset` in `conditions.ts`; no evaluator drift | Yes | `conditions.ts` lines 43–167; `result-ruleset.test.ts` (vector-driven drift test) |
| TS: `PhaseResult`, `ResolvedPhaseResult`, `listPhaseResults`, `phaseResultsEnabled` | Yes | `phase-results.ts` |
| `submitCasePhaseResponse` — pre-submit override stash then `submit_response` | Yes | `responses/actions.ts` lines 323–395 |
| `overrideCasePhaseResult` — post-conclusion, staff_admin-gated | Yes | `cases/result-actions.ts` lines 302–332 |
| Vocabulary manager UI (settings page) | Yes | `result-vocab-manager.tsx`, `result-def-dialog.tsx`, `settings/resultados/page.tsx` |
| Per-phase ruleset editor wired into phase-slot-dialog and template builder | Yes | `result-ruleset-editor.tsx`, `phase-slot-dialog.tsx` |
| `PhaseResultBadge` on board, case detail, and timeline | Yes | `phase-result-badge.tsx`; `case-phase-article.tsx` line 76; `timeline-feed.tsx`, `timeline-event-sheet.tsx` |
| End-of-wizard override panel (`phase-result-panel.tsx`), live computed preview, wizard routing | Yes | `phase-result-panel.tsx`; `wizard-client.tsx`; `wizard-runner.tsx` |
| Post-conclusion correction dialog (staff_admin) with "Corrigir resultado" button | Yes | `phase-result-override-dialog.tsx`; `phase-result-correct-button.tsx`; `case-phase-article.tsx` lines 120–129 |
| Scope: record-and-surface ONLY — no auto-routing, no gating of case conclusion | Yes | `conclude_case` untouched; no `recommend_when` branch on result; comment block confirms |
| `condition-vectors.json` byte-unchanged | Yes | Git log shows last modified `691662f` (Phase 1); `result-ruleset.test.ts` vector-driven drift assertion |
| pgTAP 45/45 (`160_phase_results.sql`) | Per tester | Full coverage confirmed: computed (rule-match, default-fallback, no-ruleset, offered-set guard), pre/post-conclusion override authz, HC057/HC058/HC059/HC060/HC016/HC017, flag-off rejections, RLS isolation, vocab CRUD |
| Vitest 57/57 (incl. `result-ruleset.test.ts` 23 tests) | Per tester | Semantics + no-drift tests confirmed |
| E2E 7/7 (`case-phase-result.spec.ts`) + 19/19 paired with `phase5-wizard` | Per tester | AC-1 through AC-6 + AC-K keyboard-only |

All plan deliverables are present. Scope matches: no auto-routing, no gating, no unlocking of downstream phases. The "Corrigir resultado" post-conclusion path, which was listed as a deferred follow-on in the original plan sketch but was confirmed in-scope in the final plan (plan document §Manual override, last bullet), is fully implemented.

---

## 2. Security & RLS Findings

### 2.1 RLS on `phase_results` — SOUND

`phase_results_select`: `is_member_of(commission_id) OR is_admin()` — commission-scoped member read; cross-commission isolation confirmed by pgTAP test 37 (`st_y` cannot see `comm_x` rows).

`phase_results_staff_admin_write`: `is_staff_admin_of(commission_id) OR is_admin()` with both `USING` and `WITH CHECK` — write is commission-scoped; cross-commission write impossible. RLS is the authority (Rule 1); CRUD RPCs gate on the same predicate in-SQL as defense in depth.

### 2.2 RLS on `case_phase_offered_results` — SOUND

`case_phase_offered_results_select`: `can_read_case(case_id, auth.uid()) OR is_admin()` — appropriate (the offered set is non-PHI governance metadata). `case_phase_offered_results_staff_admin_write`: `is_staff_admin_of(commission_of_case(case_id)) OR is_admin()` — write correctly commission-scoped via the case chain. Write policies carry both `USING` and `WITH CHECK`.

### 2.3 SECURITY DEFINER RPCs — SOUND

All six public-schema SECURITY DEFINER functions (`case_phase_results_enabled`, `create_phase_result`, `update_phase_result`, `reorder_phase_results`, `archive_phase_result`, `set_case_phase_result_override`) and two `app`-schema SECURITY DEFINER functions (`validate_template_result_ruleset`, `compute_case_phase_result`) pin `search_path TO app, public, pg_catalog` (migration lines 60, 74, 239, 272, 309, 331, 369, 449, 571). Authorization is enforced INSIDE each RPC:

- Vocab CRUD: `assert_phase_results_enabled()` then explicit `is_staff_admin_of OR is_admin` check before any write.
- `set_case_phase_result_override`: flag assertion first; then phase/case existence check; then authorization branched by phase status (`ativa`: assignee OR staff_admin; `concluida`: staff_admin/admin only); then non-terminal guard (HC060) for the `concluida` branch; then result_id validation (non-archived, in-commission, HC058). Authorization is NOT relied upon from the UI.
- `validate_template_result_ruleset`: resolves `v_commission_id` from the template; asserts every `result_id` and `default_result_id` is in-commission and non-archived. Cross-commission result references rejected (HC059 — pgTAP test 31).
- `compute_case_phase_result`: early-returns when flag off; no caller-supplied authorization (called only from trigger context or by `set_case_phase_result_override`).

### 2.4 `app.in_case_rpc` GUC Usage — SOUND

`compute_case_phase_result` and `set_case_phase_result_override` set `app.in_case_rpc='on'` with third argument `true` (transaction-local) before their `case_phases` writes and reset it immediately after. This matches the pattern of every existing case RPC (e.g., `activate_phase`, `reassign_phase`) and is consistent with how `guard_case_phase_status` admits non-status-field updates on non-`pendente` phases. A direct PostgREST client UPDATE on `case_phases.result_id` without the GUC would be blocked by `guard_case_phase_status` (the `v_in_rpc=false` path raises `check_violation` for any non-`pendente` non-status update). The GUC cannot be set by a client call — it is transaction-local inside a SECURITY DEFINER function context.

### 2.5 HC057/HC058/HC060 Error Code Mapping — SOUND

All three override error codes are mapped to pt-BR in both action files:

- `result-actions.ts` `mapOverrideError`: HC057 → `phaseNotAdjustable`, HC058 → `resultInvalid`, HC060 → `caseTerminal` (lines 143–162).
- `responses/actions.ts` `submitCasePhaseResponse`: HC057 → `overrideNotAdjustable`, HC058 → `overrideResultInvalid` (lines 358–367).

No raw Postgres errors reach the UI.

### 2.6 Rule 5 (Immutability) — SOUND

`result_ruleset` on `process_template_phases` is mutable only while the template is in `draft` — enforced by the existing `v_status <> 'draft'` guard in both `add_template_phase` and `update_template_phase` (migration lines 687–691, 757–761). Published-template validation gate in `publish_process_template` (migration lines 869–875) is the authoritative check. Once a case is created, `case_phases.result_ruleset` is a frozen snapshot and cannot be updated without `app.in_case_rpc='on'`. The effective `result_id` is written atomically in the same transaction as the `concluida` flip; the guard on `case_phases` prevents any further non-RPC write.

### 2.7 Rule 11 (Audit) — SOUND

The conclude-path computed result rides the existing `case_phase.status_changed` audit row via the updated `trg_audit_case_phases` allow-list (`array['status', 'position', 'result_id', 'result_override_id']` — migration line 1092). The `result_override_reason` column is explicitly excluded from this allow-list.

The pre-conclusion override on an `ativa` phase has no status change, so `trg_audit_case_phases` does not fire. `set_case_phase_result_override` emits its own audit row: `'case_phase.result_override_set'`, metadata `{"result_override_id": <uuid>}` — the fact plus the chosen option id. The free-text `result_override_reason` is NOT in the metadata (migration lines 642–645). pgTAP tests 18–20 assert this triple: audit row exists with `result_override_id`, audit row does not have `result_override_reason` key, and the reason text string is not present anywhere in the metadata.

Vocabulary CRUD RPCs emit audit rows (migration lines 263–264, 299–300, 352–353). No answer payloads, free-text, or PHI are copied into any audit row.

The `create_phase_result` audit write passes the label as a `summary` string (`'Resultado de fase criado: ' || v_result.label`) and an empty `{}` diff payload. This is consistent with the existing `case_outcomes` vocabulary pattern and does not copy PHI (labels are governance vocabulary, not clinical content).

### 2.8 No Service-Role Key Client Exposure — SOUND

Grep of `src/` for `NEXT_PUBLIC_SUPABASE_SERVICE` and `supabase.*service` returns no results. Service-role key use is confined to the E2E test harness (`e2e/case-phase-result.spec.ts`) where it is read from `process.env.SUPABASE_SERVICE_ROLE_KEY` and used only from `beforeAll`/`afterAll` fixture setup, which does not run in the browser.

---

## 3. Non-PHI Confirmation (Rule 12)

This feature is correctly **NON-PHI**. `phase_results` stores categorical governance labels (e.g., "Conforme", "Não-conforme") — administrative vocabulary with no patient-identifying content. `case_phases.result_id` references these labels. `result_override_reason` is a user-authored business justification, not clinical content or patient data. No PHI table is joined; no PHI column is projected; no `event_patient`, `case_patient`, or `referral_patient` table is touched by any function in this migration. Rule 12 does not apply.

---

## 4. Code Quality Findings (Rule 9, §8)

### 4.1 TypeScript `strict` — SOUND

No unjustified `any` usages. The two `as unknown as string` casts in `result-actions.ts` (line 321) and `responses/actions.ts` (line 349) are both justified with inline comments: the supabase-generated types required the mid-list `p_result_id` parameter as a required `string`, but the RPC accepts `null` to clear the override. The cast correctly passes the real `null` value while satisfying the stricter generated type. The pattern is consistent with the `case_patient` module's handling of the same supabase-gen limitation (noted in prior review). The cast is safe because the PostgreSQL RPC accepts null through a `DEFAULT NULL` parameter.

### 4.2 Data Access via `src/lib/queries/` — SOUND (Rule 9)

All reads go through `listPhaseResults` and `phaseResultsEnabled` in `phase-results.ts`. No inline supabase-js in component files. `overrideCasePhaseResult` in `result-actions.ts` uses `createClient()` only to look up the commission for app-layer authorization before delegating to the RPC — this is the established `contextOfResponse`/`authorizeCommission` pattern from earlier phases.

### 4.3 Server Components Default — SOUND

All new page files (`settings/resultados/page.tsx`, both case-detail pages) are async server components. Client islands are properly marked `"use client"`: `phase-result-panel.tsx`, `phase-result-override-dialog.tsx`, `phase-result-correct-button.tsx`, `result-vocab-manager.tsx`, `wizard-client.tsx`. No inappropriate `"use client"` escalation detected.

### 4.4 pt-BR User-Facing Strings — SOUND

All user-facing error messages, button labels, and UI copy are in pt-BR. The `MESSAGES` constants in both action files use pt-BR. Badge labels (`Resultado:`, `Manual`, `Adverso`) are pt-BR. The `assert_phase_results_enabled` raise message is pt-BR. No English user-facing strings found.

### 4.5 Accessibility — SOUND

`PhaseResultBadge`: adverse marker conveyed by icon (`AlertTriangle aria-hidden`) + `sr-only` text `"Resultado adverso."` — color is not the sole indicator. Manual marker uses `Hand aria-hidden` + visible "Manual" text. Section `aria-labelledby="phase-result-heading"` in the panel.

`PhaseResultPanel`: override section uses `<fieldset>` + `<legend className="sr-only">` for the checkbox group. `<Checkbox>` is a Radix primitive with built-in `role="checkbox"` + `aria-checked`. The select picker uses implicit label wrapping (`<label> ... <select>`) — the same pattern used throughout the platform (e.g., `outcome-def-dialog.tsx`) — which is valid HTML and fully accessible. `<textarea>` similarly wrapped.

`PhaseResultOverrideDialog`: `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogDescription>` from shadcn (Radix Dialog) — title and description properly associated; `role="dialog"` + `aria-labelledby`/`aria-describedby` handled by the primitive.

`PhaseResultCorrectButton`: labeled `"Corrigir resultado"` with Pencil icon (`aria-hidden`). The AC-K keyboard test exercises focus, Enter activation, Tab-within-dialog, and Escape dismissal.

---

## 5. Observations (INFO — Non-Blocking)

### INFO-1: `result_override_reason` is readable via PostgREST on `case_phases`

The `result_override_reason` column is stored on `case_phases`, which has a `can_read_case` select policy. A raw PostgREST query by any case-readable user could read this column. It is intentionally excluded from `get_case_detail` (no projection in the function body) and from the audit log. This is user-authored business justification — not PHI and not clinical content. It is analogous to other governance notes on `case_phases` (e.g., `skipped_at`). No action required; calling out for completeness. If future policy considers override reasons sensitive, column-level security or a dedicated DEFINER reader would be the mechanism.

### INFO-2: `validate_template_result_ruleset` and `add/update_template_phase` do not assert `case_phase_results` flag

`validate_template_result_ruleset` runs even when the `case_phase_results` flag is OFF (it is called from `add_template_phase` / `update_template_phase` which only assert `assert_cases_enabled`). A staff_admin can therefore author a `result_ruleset` on a template phase while the flag is off. This is consistent with the design intent stated in the plan comment header (`compute_case_phase_result early-returns when the flag is down`). The ruleset is stored but never evaluated. Flag-off means "results not computed or surfaced," not "ruleset cannot be authored." No security implication; the data is purely additive governance metadata.

---

## 6. Summary

All plan deliverables and acceptance requirements are met. The RLS boundary is the security authority at all layers (Rule 1). The two SECURITY DEFINER RPCs enforce authorization inside themselves, not from the UI. The `app.in_case_rpc` GUC usage is consistent with every existing case RPC. Rule 5 (immutability) holds: the ruleset is frozen at publish time and snapshotted at case creation; the effective result is written atomically at conclude time and immutable thereafter. Rule 11 (audit) holds: the override fact + option id is audited; the free-text reason is never copied; result data rides the existing status-change row via the updated allow-list. The feature is correctly NON-PHI. TypeScript `strict` is respected; the two justified `as unknown as string` casts are correctly documented. All user-facing strings are pt-BR. Accessibility requirements are met. The `condition-vectors.json` is byte-unchanged; the TS and SQL evaluators are in agreement (proven by the vector-driven Vitest suite).

**VERDICT: APPROVED** (0 blockers, 0 majors, 2 INFO observations).

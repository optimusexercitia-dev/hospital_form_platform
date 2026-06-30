# QA Review — "Sem processo" (process-less cases) · flag `processless_cases`

- **Reviewer:** `qa` (final-gate, static review — lead's full E2E regression running concurrently)
- **Date:** 2026-06-30
- **Scope:** feature commit `cdf26d0`; ADR [0044](../decisions/0044-processless-cases.md)
- **Inputs treated as established (per tester):** pgTAP **1153/1153** (`supabase/tests/177_processless_cases.sql`, +31 new) · feature E2E **8/8** (`e2e/processless-cases.spec.ts`, prod build, `--workers=1`, 2 clean runs)
- **Verdict:** **APPROVED**

---

## Summary

A coordinator can mint a template-less case (`cases.template_id` NULL, zero phases) with an
optional hand-picked offered-outcome set and optional patient identifiers, growing ad-hoc
phases later via the existing `add_ad_hoc_phase`. The implementation is a faithful, minimal
extension that mirrors already-approved patterns: the `create_case` RPC is a verbatim copy of
`create_case_from_template`'s mint mechanics with all template machinery stripped, and
`set_case_offered_outcomes` mirrors `set_process_outcomes`. No new RLS shape, no new table, no
new policy. Security, PHI handling, requirements, code quality, a11y, and pt-BR all pass the
bar. One non-blocking MINOR is noted for optional pre-record cleanup.

Findings: **0 BLOCKER · 0 MAJOR · 1 MINOR.**

---

## 1. Security / RLS (highest priority) — PASS

**Coordinator gate (both RPCs).** `create_case`
(`supabase/migrations/20260630000006_processless_cases.sql:95`) and `set_case_offered_outcomes`
(`:186`) both enforce `app.is_staff_admin_of(commission) OR app.is_admin()` and raise `42501`
otherwise. This is the canonical cases-module coordinator gate — identical to the established
`set_case_outcome` / outcome-vocabulary CRUD RPCs (`20260620020000_phase_results.sql:247,287,314`).
The DEFINER functions also validate commission existence explicitly (`:88`) since DEFINER
bypasses RLS. pgTAP proves the `42501` path for plain staff on both RPCs
(`177_processless_cases.sql:173-178, 313-319`).

**"No new RLS shape" claim — VERIFIED.** The migration contains zero `CREATE TABLE` /
`CREATE POLICY` / `ALTER TABLE` / `ENABLE ROW LEVEL`. `set_case_offered_outcomes` writes to
`case_offered_outcomes`, whose existing `case_offered_outcomes_staff_admin_write` policy
(`20260626000000_multitenancy_rls_rewrite.sql:1590`) gates on the same coordinator predicate;
the DEFINER RPC re-implements an equivalent internal gate. The table's RLS write policy still
backstops any direct (non-RPC) caller — pgTAP proves a forged direct INSERT is denied
(`:392-399`) and cross-commission read returns zero rows (`:382-389`).

**Domain invariants.** HC030 same-commission + non-archived outcome validation on `create_case`
(`:99-118`) and on `set_case_offered_outcomes` (`:195-210`); HC025 terminal-case rejection
(`:190`); HC029 can't-drop-the-currently-assigned-outcome (`:212-217`). All four codes are
covered by pgTAP (`177:114-127, 332-377`) and the HC029 pt-BR message surfaces in the E2E
editor flow (`processless-cases.spec.ts:S5`).

**No PHI in audit.** `set_case_offered_outcomes` emits exactly one `case.offered_outcomes_set`
row carrying only `jsonb_build_object('count', cardinality(...))` (`:228-232`) — no identifiers,
no labels, Rule 11-compliant. `create_case` emits **no** creation audit, which correctly matches
`create_case_from_template` (there is no INSERT audit trigger on `cases`); this is intentional
and documented in the migration header (`:72-73`) and the RPC comment (`:65-73`). Consistent.

**Grant block.** `REVOKE ALL … FROM PUBLIC` then `GRANT EXECUTE … TO authenticated, service_role`
for both RPCs and the probe (`:246-268`); the assert helper is `app`-schema and granted to the
same roles. No service-role key is reachable client-side (the actions use the cookie-scoped
server client, `actions.ts:404`, `outcomes-actions.ts:380`).

**SQL/TS evaluator agreement** — N/A: this feature touches neither `eval_condition` nor the
immutability triggers; the case INSERT runs under `app.in_case_rpc='on'` exactly as the template
minter does (`:124-149`), and the status-transition guard only fires on UPDATE/DELETE, never on
the INSERT path.

## 2. PHI handling (Rule 12) — PASS

Identifiers are written atomically inside `createCase` via the same
`patientInputFromForm` → `writeCasePatient` (→ `set_case_patient` DEFINER) fold that
`createCaseFromTemplate` uses (`actions.ts:416-423`), gated client-side by the `case_patient`
flag **and** the `patient_enabled` toggle (`create-case-dialog.tsx:212, 338-361`) and
server-side by the RPC's own `23514` guard when `patient_enabled=false` (pgTAP `177:160-168`).
Minimum-necessary floor (≥ name OR mrn) is honored; below the floor → null → clean no-op
(`actions.ts:258-261`). A PHI-write failure is **surfaced, not swallowed** — it returns
`{ ok: false, caseId, error }` so the case is reachable to add identifiers later
(`actions.ts:417-422`), satisfying the standing "never swallow a PHI-write failure" rule. E2E S3
(reveal) and S4 (PHI-capable, no row) confirm both branches end-to-end.

## 3. Requirements audit vs ADR 0044 — PASS

| ADR decision | Implemented | Evidence |
| --- | --- | --- |
| 1. process-less = `template_id` NULL, zero phases; ad-hoc later | ✅ | `create_case` inserts `template_id = null`, no phase loop (`mig:129`); pgTAP zero-phase assertion (`177:93-95`); S6 ad-hoc + conclude |
| 2. single "Novo caso" button → "Sem processo" sentinel → two-step wizard | ✅ | `create-case-dialog.tsx:253-255` sentinel; `step` 1/2 state machine (`:158, 239, 381`) |
| 3. "Emite desfecho?" optional offered set; HC028 at conclude; editable while non-terminal; HC029 | ✅ | dialog `:291-334`; editor mounts process-less-only (`case-detail-view.tsx:164-166`); HC028/HC029 in pgTAP + S2/S5 |
| 4. PHI opt-in toggle → `patient_enabled`; atomic; optional even when on | ✅ | see §2 |
| 5. two DEFINER RPCs, coordinator-gated, no new RLS shape | ✅ | see §1 |
| 6. three-way flag gating (`processless_cases` / `cases_extras` / `case_patient`) adapts when any off | ✅ | `isProcessless` (`:163`), `casesExtrasEnabled` gate (`:291`), `casePatientEnabled` gate (`:338`); pgTAP flag-OFF + extras-OFF behavior (`177:184-211`) |
| 7. muted "Sem processo" badge on detail header | ✅ | layout `:117-119` + `case-detail-view.tsx:225-227` |

The deliberate divergence from ADR 0024 D15 (process-less offered sets are mutable while
non-terminal; templated cases stay frozen) is documented in the RPC comment
(`mig:157-165`), the action JSDoc (`outcomes-actions.ts:365-373`), and the editor JSDoc
(`case-offered-outcomes-editor.tsx:22-34`). v1 exposes the editor for process-less cases only —
the FE gates on `templateId === null` (`case-detail-view.tsx:164-166`), matching the ADR.

## 4. Code quality — PASS

- TypeScript `strict`: no `any` in any feature file (grep clean; the lone match is prose in a
  comment). Probe `Returns: boolean` typed; `create_case` returns the full `cases` row.
- Data access through `src/lib/queries/` (the three probes + `getCaseDetail` carry the offered
  set); mutations through `src/lib/cases/{actions,outcomes-actions}.ts` (Rule 9). No inline
  supabase-js in components.
- Server-Components-first: the board page, detail page, and detail layout are server
  components; only the three interactive pieces (`create-case-dialog`, `outcome-multiselect`,
  `case-offered-outcomes-editor`) are `"use client"`, each justified by interaction.
- DRY: `OutcomeMultiselect` is the single selection widget shared by the create dialog and the
  detail editor, as the ADR intends.
- Errors are user-readable pt-BR; raw PG codes are mapped (`mapCaseError` / `mapOutcomeError`),
  with the RPC's own pt-BR message preferred. No raw Postgres error can reach the UI.

## 5. Accessibility — PASS

The two-step wizard is keyboard-drivable end-to-end (S-K: focus+type label, Space the toggle,
Enter "Próximo", reach step 2). Inputs use real `<label>`/`Field` wiring with
`aria-describedby` (`create-case-dialog.tsx:269-283`), checkboxes are labelled, the PHI step
carries a `role="note"` warning, and the offered-outcome rows are checkbox-in-label. The
BUG-PL-001 fix (distinct `key`s on the footer buttons so React mounts a fresh node per branch
instead of patching `type` mid-click) is sound and well-commented (`:407-457`) — keyboard
"Próximo" now advances rather than submitting.

## 6. pt-BR / English split — PASS

All user-facing strings are pt-BR (dialog copy, badges, error messages, RPC `raise` text);
code, comments, and the migration header are English. Spot-checked: `'a criação de casos sem
processo não está disponível'`, `'sem permissão'`, `'Desfechos disponíveis'`, `'Sem processo'`.

---

## Findings

### MINOR-1 — `create_case` action declares an HC029 constant it can never receive
`src/lib/cases/actions.ts:123` adds `HC_COMMISSION_MISMATCH = 'HC030'` and wires it into
`mapCaseError` (`:212-213`), which is correct and used by `create_case`. Separately, the
process-less **editor** path raises HC029, but that flows through `setCaseOfferedOutcomes` →
`mapOutcomeError` in `outcomes-actions.ts` (which *does* map HC029). So `actions.ts`'s
`mapCaseError` correctly omits HC029 — there is no functional gap. The only nit: `actions.ts`
imports/defines no HC029 and that is the *right* call; nothing to change in `actions.ts`.

The genuine nit is cosmetic and lives in the dialog: `create-case-dialog.tsx` re-derives
`outcomeBlocked` (`:210`) and disables both the "Próximo" and "Criar caso" primaries on it
(`:444, 453`), while the server also re-validates `emitsOutcome && outcomeIds.length === 0`
(`actions.ts:396-398`). This is correct defense-in-depth, **not** a bug — flagged only so the
record notes the client gate is UX, the server gate is authority. No action required.

*(Net: no code change is required for approval. MINOR-1 is informational; there is no cheap
fix outstanding that materially improves correctness.)*

---

## Verdict

**APPROVED.** Every ADR-0044 decision is implemented and tested at the right layer; the two new
SECURITY DEFINER RPCs carry the correct coordinator gate, the established HC025/HC029/HC030
invariants, a PHI-free audit row, and a correct grant block; the "no new RLS shape" claim holds
(zero schema/policy additions, existing table RLS backstops direct writers); PHI is written
atomically and never swallowed; the divergence from ADR 0024 D15 is documented in the RPC. No
blocking or major issues. The single MINOR is informational only.

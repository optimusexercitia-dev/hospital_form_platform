# ADR 0024 — Case model adjustments: fixed statuses, phase blocking, outcomes

**Status:** Accepted · **Date:** 2026-06-14 · **Phase:** post-Phase-8 (Case data-model batch)
· **Supersedes:** ADR 0023 (configurable per-committee case status)

## Context

Three adjustments to the Case/Process feature (Phase 7 + the Cases-Extras batch),
settled via interview as decisions **D1–D15** in the plan
`the-current-case-data-bright-hartmanis.md`: (1) replace the just-built
configurable status vocabulary with a small **fixed** set, (2) let a phase declare
which earlier phases must finish before it starts, and (3) record a per-commission
**outcome** on each case for reporting. Pre-launch, no live data, local-only.

## Decision

- **Fixed, auto-computed status (D6/D7, supersedes 0023).** `case_status_defs` +
  the status-CRUD/`set_case_status`/`apply_case_status`/`case_status_is_terminal`
  surface are **dropped**. `cases.status` is a fixed 5-value CHECK
  (`nao_iniciado` / `em_revisao` / `pendente` / `concluido` / `cancelado`)
  **auto-derived** by `app.recompute_case_status` + an AFTER trigger on
  `case_phases` (any phase `ativa` → `em_revisao`; else ≥1 `concluida` → `pendente`;
  else `nao_iniciado`, so a skip-only case stays `nao_iniciado`). `concluido` /
  `cancelado` are **manual** terminal actions (`close_case` / `cancel_case`,
  terminal-first then flip residual phases so recompute early-returns and never
  clobbers the manual status). `guard_case_status` is rewritten to delegate
  validity to the column CHECK. The configurable union is gone, so `CaseStatus` is
  a fixed TS union again (single source `src/lib/cases/case-status.ts`).

- **Phase blocking — an explicit dependency graph (D1/D4).** Replaces strict
  sequential unlock. `blocks integer[]` on `process_template_phases` + `case_phases`
  (earlier-positions-only; rides the `recommend_when` renumber/snapshot machinery —
  a shape trigger enforces the bound, the template RPC does the deep "position
  exists" check). A phase is activatable anytime and **multiple phases may be
  `ativa` at once (parallel)** unless it lists a blocker that is not yet `concluida`
  **or** `nao_necessaria` (skip unblocks) → **HC018**.

- **Outcomes — per-commission vocabulary with a frozen offered-set (D8–D11/D15).**
  `case_outcomes` (label + advisory `requires_action_plan` + `is_adverse`,
  archivable) mirrors `case_tags`; each process offers a subset
  (`process_template_outcomes`, same-commission guard **HC030**), snapshotted
  per-case at creation into `case_offered_outcomes` (read by the selector + the
  conclude gate so post-publish template edits never leak in). `cases.outcome_id`
  is a single nullable FK (`NO ACTION` — archive, don't delete). Both flags are
  **signals, not gates** (D10); vocabulary edits propagate everywhere (D11, shared
  row). Outcomes are optional per process (D15).

- **Conclude gate (D3).** `close_case` rejects unsettled (pendente/ativa) phases
  (**HC031**) and, when the process offers outcomes, a missing outcome (**HC028**).

## Consequences

- **New SQLSTATEs** HC028 (outcome required) / HC029 (outcome not offered) / HC030
  (outcome–commission mismatch) / HC031 (unsettled phases). HC031 was chosen over
  reusing HC027 (already action-item entitlement). Mapped to pt-BR in
  `src/lib/cases/{actions,outcomes-actions}.ts`.
- **Phase-7 invariants preserved:** `case_phases` carries no answers; the
  `list_cases_board` / `get_case_detail` envelopes gain outcome metadata + per-phase
  `blocks` but stay staff_admin-gated and answer-free. Every replaced public
  function is re-revoked from anon/PUBLIC.
- Migrations `20260614093000`–`20260614093003`. Verified: full pgTAP **292 green**
  (incl. the precedence table, both D4 satisfiers, the conclude gate, the blocks
  renumber remap, D11 propagation, D10 non-gating); types regenerated;
  typecheck + lint + unit green. Local-only — remote `db push` deferred.

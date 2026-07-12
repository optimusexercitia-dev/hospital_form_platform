# 0069 — Anglicize status-enum internal keys (D11)

**Date:** 2026-07-12 · **Status:** accepted. **Owner:** platform lead → backend/frontend/tester.
**Scope:** internal-key rename, reset-OK, pre-pilot; branch `f-cleanup`. Full dictionary +
per-group method → [docs/plans/f-cleanup-d11.md](../plans/f-cleanup-d11.md). F-cleanup residual
item **D11**.

## Context

Twelve status enums stored **Portuguese** internal keys (`indicators.status`,
`meeting_attendees.attendance`, `case_narratives.status`, `indicator_measurements.status`,
`capa_action`/`capa_plan`, `case_interviews`, `controlled_documents(+_versions)`,
`case_referral`, `meetings`, `cases`, `case_phases`). CLAUDE.md **Rule 10** says code (incl.
internal keys) is English while user-facing text is pt-BR — so the pt-BR keys were an
inconsistency (not a Rule-10 *breach*, since keys aren't user-facing). All are `text` + `CHECK`
(no Postgres `ENUM`), so generated types are `string`; the authoritative unions are hand-written
in `src/lib`. The reset-OK pre-pilot window makes the schema change free (no data migration);
post-pilot it would need one. PO chose the **full** 12-enum pass.

## Decision

Rename every status-enum internal **key** to English **1:1** (semantics identical), per the
locked dictionary. Change: CHECK constraints, column defaults, function bodies, seed + pgTAP
fixture values, hand-written TS unions, and label/visual **map keys**. **Keep** the pt-BR string
**values** in label maps (Rule 10) and pt-BR **prose** in comments/messages. Executed
cheapest-first in **6 coupled-group migrations** (`20260719000300`–`000800`); the
`cases.status` ⇄ `case_phases.status` pair (recompute-coupled) lands as **one** migration.
Method: programmatic catalog rewrite (`pg_proc`/`pg_index` scoped `replace`), **function-scoped**
for shared literals (`concluida`/`concluido`/`cancelada`/… span enums — a blanket replace is
unsafe). Cross-team: backend owns all `src/lib` + SQL, frontend `src/components`/`src/app`,
tester `e2e`. **Non-status** Portuguese enums (`classification`, `role`, `kind`, …) are **out of
scope**.

## Consequences

- Internal status keys are uniformly English; behavior unchanged (keys renamed, not remapped);
  full standalone-prod E2E green.
- The failure mode is a missed literal; caught by pgTAP (per-group NEG/POS), whole-project `tsc`
  (typed comparisons), and the full E2E gate — which surfaced three stale test assertions
  (fixed) that a static grep missed (template-literal `` `key:${…}` `` and error-body
  interpolation forms).
- Minor follow-up: a diagnostic guard error-body (HC049) now echoes the English key; the **UI
  still renders pt-BR** labels, so this is cosmetic/diagnostic only.
- Any future status enum starts English; the anglicization convention is now the norm.

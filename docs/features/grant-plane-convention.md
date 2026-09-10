---
id: GRANT-PLANE-CONVENTION
title: "The per-object grant plane convention (ADR 0205) — root ledgers, computed participation, catalog-named abilities; decided now, built after AE5 — plus the two pre-pilot case-access door/app fixes it ruled"
status: complete
kind: feature
program: AUTHZ
phase: "Between pre-AE5 Batch 9 and AE5 increment 2 — a PO grilling session's rulings recorded; no phase of PHASES.md"
branch: main   # built straight on main (lead convention); docs 2dc220eb, code e79f210f, both pushed
plan: ~
progress: ../progress/grant-plane-convention.md
reviews: ["../reviews/grant-plane-convention-review.md"]
adrs: ["0205", "0155", "0078", "0114", "0176", "0033", "0103", "0127", "0201"]   # 0205 is the ADR this unit PRODUCED; the rest were read
handoff: ~
fup: ~
---

# GRANT-PLANE-CONVENTION — one shape for every future per-object grant, and nothing built before AE5

The decision is ADR [0205](../decisions/0205-per-object-grant-plane-convention.md). No plan
document: the PO asked for an options analysis on the Case grant model, then a grilling session
(three rounds, 26 questions) settled the convention and its timing in one sitting.

**Amended 2026-09-10 → [GRANT-PLANE-CONVENTION-A1](./grant-plane-convention-a1.md):** an external design
audit led to ADR 0205 § Amendment 1 (append-only) and a **third** pre-pilot fix — the door refuses a
self-grant (`HC0U1`). The two fixes and the criteria below are this unit's as ruled; the total is now three.

## Acceptance criteria

- [x] **ADR 0205 written and indexed** — D1–D12 as ruled, the classification table of every existing
      grant-shaped table, the Considered options A–E, the accepted post-pilot cost stated.
- [x] **The standing rule** `.claude/rules/grant-plane-convention.md`, path-scoped to
      `supabase/migrations/**`, anchors resolving, `source: ADR 0205`; retires when the keystone lands.
- [x] **Phase 18 / Phase 19 / quality-track text amended** to start from the convention (auditor =
      participation record; the Phase 19 plane review opens on ADR 0205 and owns the C-vs-D choice).
- [x] **The deferred build filed** as `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5`, parked, with a
      `Revisit when` that names AE5-complete AND the first consumer.
- [x] **Fix 1 — `grant_case_access` refuses a WRITE grant on a terminal case** (D9): migration
      `20261003007370`, body re-emitted from the LIVE `pg_get_functiondef`, a new `HC` code registered,
      read grants still allowed; pgTAP `416` proven **RED before / GREEN after**, with the
      authority-before-status ordering pinned and `prosecdef` + ACL asserted unchanged.
- [x] **Fix 2 — `authorizeCommission` mirrors the door** (D12): the `platform_admin` pass removed,
      the two tenancy-admin arms added through `src/lib/queries/`, the new SQLSTATE mapped to pt-BR.
- [x] **Seam slice** appended to `docs/backend-state/cases-and-ethics.md` with its `## Current
      state` block replaced.

**Gate.** `npm run lint` 0/0 · `typecheck` · `npm run test` · `npm run test:db` on a **fresh**
`npx supabase db reset --local` · the diff-scoped door sweep over `main` with its `SCOPE:` line
quoted and exit read **bare** · a read-only `qa` review of the two fixes → `gated` → PO → `complete`.

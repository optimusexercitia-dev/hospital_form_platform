---
id: GRANT-PLANE-CONVENTION
title: "The per-object grant plane convention (ADR 0205) — root ledgers, computed participation, catalog-named abilities; decided now, built after AE5 — plus the two pre-pilot case-access door/app fixes it ruled"
status: gated
kind: feature
program: AUTHZ
phase: "Between pre-AE5 Batch 9 and AE5 increment 2 — a PO grilling session's rulings recorded; no phase of PHASES.md"
branch: main   # built straight on main (lead convention); nothing merges ahead of itself
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

## Current state

**Updated:** 2026-09-10

### Objective

Record, as one PO-ruled convention, how every future per-user per-object grant is shaped and when
it is built — so Phases 18, 19 and 20 do not each invent a fifth shape — and land the two case-only
fixes the rulings ordered pre-pilot.

### Done since start

ADR 0205 (237 lines) · the rule file · Phase 18/19 and quality-track amendments · the follow-up
entry · hub + record. The grilling's 26 rulings are all in the ADR; three reversed the lead's
recommendation (Q8 → keep the arm, then Q12 → practice not rule; Q8's PHI half → off-screen).

### In progress

Nothing. Built, gated, QA **APPROVED** (0 MAJOR; both MINORs cleared, 17/17). One edge found and
filed, not fixed by ruling: `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE`.

### Next

PO approval (§6 step 4). On approval: `complete`, this block cut into the record (ADR 0186 D3), the
follow-up on the tenancy path ruled or left open on its own clause.

### Blockers

⛔ **Status is `gated`, not `complete`, because PO approval has not been given** — the docs slice is
committed (`2dc220eb`), the code slice commits with this flip. ⚠ The build half of the convention is
**deliberately not started** (ADR 0205 D12) — the ruling, not a gap.

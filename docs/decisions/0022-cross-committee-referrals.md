# ADR 0022 — Cross-committee case referrals (linked cases)

**Status:** Proposed / deferred · **Date:** 2026-06-14 · **Phase:** post-Phase-8 Cases-Extras batch (R5)

## Context

Requirement R5 asks that cases be **passable between committees** (commissions) —
a future capability, not built now. This ADR records the chosen approach and the
explicit decision that **no schema change is required now**, so a later
implementation has a locked design and nothing in the R1–R4 work contradicts it.

The current architecture does NOT block this. Every case-child entity (phases,
documents, events, tags, action items, status defs) scopes to its case's
commission via `app.commission_of_case` / `commission_id`, and `cases.commission_id`
is `NOT NULL` with per-commission case-number minting.

## Decision

**Linked cases / referrals — NOT multi-commission shared ownership.**

Commission A keeps its case (its number, documents, tags, action items). A future
`case_referrals` table links it to a **new, independently-owned** case in
commission B. B's case automatically owns its own children (the
`commission_of_case`-based RLS spine gives this for free, zero backfill).

This preserves the load-bearing invariants every case-child depends on:
`cases.commission_id NOT NULL`, per-commission numbering, and the
`app.commission_of_case` RLS spine. Shared ownership, by contrast, would force a
rewrite of that spine, the minting, and every child resolver — the painful path.

### Future shape (when built — not now)

- **`public.case_referrals`** — `origin_commission_id`, `origin_case_id`,
  `target_commission_id`, `target_case_id` (nullable until accepted), `status`
  (`sent` / `accepted` / `declined` / `returned`), a NON-identifying `outcome`
  free-text, `referred_by`, timestamps.
- **RLS** exposing ONLY the referral row + the case HEADER (number/label/status)
  to either commission's members — **never answers, documents, or action items**
  across the boundary (the Phase-7 in_progress-answers invariant generalises:
  cross-commission visibility is header-only).
- **RPCs** `refer_case` / `accept_referral` / `return_referral`, each
  `is_staff_admin_of`-gated on the acting side, gated behind a new feature flag.

## Consequences

- **No migration, no schema change now.** This ADR is the durable record; the
  R1–R4 additions are all commission-scoped via `commission_of_case`, so they are
  forward-compatible with this model without modification.
- When implemented, a referred case in B is a normal case — it gets its own
  status set (the R2 seed trigger), tags, documents, and action items with no
  special-casing.
- Revisit when the cross-committee workflow is prioritised.

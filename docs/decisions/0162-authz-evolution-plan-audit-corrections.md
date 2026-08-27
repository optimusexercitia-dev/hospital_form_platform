# ADR 0162 — Plan-audit corrections to the authorization-evolution program: rollback artifact, catalog binding, pilot-gate scope, and four PO rulings

- **Status:** ACCEPTED 2026-08-27 — PO-ruled in session the day the
  [plan audit](../reviews/authz-evolution-plan-audit-2026-08-27.md) (findings F1–F18,
  disposition **CHANGES REQUESTED**) was reviewed. The audit's findings are cited from the
  [plan](../plans/authz-evolution.md) as `[PA-F#]` — the prefix exists because the *original*
  audit's F1–F9 are already cited there bare.
- **Amends:** 0155 — three points only: D7's rollback-artifact clause (§1), D7's
  catalog-authority claim (§2), and G1's pilot cutline (§3). Every other ratified decision
  (G1–G11 otherwise, D0–D10) stands. §4 records rulings that bind the plan without touching
  0155.
- **Related:** 0160 (the AE0 corrections this follows the pattern of) · 0079 (the ARM/door
  gate family §3 qualifies) · 0133 (the AFF2 bounds the AE1.3 doors encode).
- **Evidence:** the plan audit itself (its plan-line citations were spot-verified against the
  plan; its 0155/AE0/PROGRESS claims re-read at source before ruling) ·
  [AE0 findings](../design/authz-evolution-ae0-findings.md) (F-AE0-3: 45 sites, 11
  undecidable `.rpc()`; §F.3: 407 command doors outside every ARM domain) · PostgreSQL
  documentation on `ALTER DEFAULT PRIVILEGES` and `CREATE FUNCTION` volatility (the audit's
  external references, confirming PA-F4 and PA-F6's mechanisms).

## Context

The development team audited the execution plan after AE1 began. Two of its findings were
verified as conflicts with, or defects in, this ADR family's own text — not merely the plan's
— so they need ADR ink; the plan's precedence rule (the ADR wins, the plan is corrected)
otherwise leaves the plan formally at odds with its authority. Verified before ruling:

- **PA-F2:** 0155 G2 requires *"null-count/CPF-uniqueness/**row-hash** comparison"*; the plan
  had kept the two cheap checks and dropped the row-hash. That correction is **compliance**,
  not amendment — it lands in the plan alone, strengthened to keyed per-row equality (an
  unkeyed hash of a value multiset still passes swaps).
- **PA-F9:** the phrase *"retaining a forward rollback migration"* is in 0155 D7 itself.
- **PA-F1:** nothing in 0155 or the plan binds `memberships` rows to `authz.roles` — a CHECK
  constraint cannot query another table, so `allowed_scope_kind` constrains nothing until
  something makes it.

## Decisions

### 1 — D7's "retaining a forward rollback migration" is retracted (PA-F9)

A file under `supabase/migrations` is part of the ordered, forward-only applied chain:
committed means applied. A "retained" rollback migration therefore either undoes the cutover
on the next apply, is not a repository artifact, or hides behind a future timestamp and fires
unexpectedly. Replaced with: **a reviewed rollback runbook plus SQL template kept outside the
migration tree**. Invoking rollback mints a *new* timestamped migration through the normal
migration command, revalidates the current wrapper names/signatures/`prosecdef`/ACLs first,
re-points the wrappers to the legacy adapter **without deleting catalog data**, and records
the event; code/database compatibility is stated in both directions. Applies to AE4.6, every
AE5 per-role increment, and any other "retain rollback" language in this program (AE2.4's
included).

### 2 — D7's catalog-authority claim is bounded, and the binding mechanism is specified (PA-F1)

Until assignment storage is bound to the catalog, `authz.roles` is an **additional** role
authority beside `memberships_role_check`, the scope-shape CHECK, `public.platform_role`, the
TypeScript manifest, and the grant/revoke branches — not a replacement for them. Amended:

1. `authz.roles` carries `UNIQUE (code, allowed_scope_kind)`;
2. in AE4, once every role has a catalog row, `memberships` gains a carried `scope_kind`
   discriminator (consistent with the scope-exclusivity CHECK) and the composite FK
   `(role, scope_kind) → authz.roles(code, allowed_scope_kind)`;
3. the actual scope-column shape stays enforced independently of the role name;
4. the legacy `memberships_role_check` + scope-shape CHECKs retire **only at AE5-complete**,
   when every role is `authoritative` — that retirement is the event that ends the interim;
5. the TypeScript role manifest is **generated from or gate-checked against** the catalog so
   the two cannot drift silently;
6. `assume_role`'s input becomes a validated catalog code when the `platform_role` enum
   retires (AE5-complete), not before.

⛔ **Interim language, binding:** until item 4 lands the catalog is **authority-elect**. "The
catalog is the authority" may not appear in a gate record before then; the honest claim is
"one catalog, bound by FK, with legacy CHECKs still standing."

### 3 — G1's pilot cutline gains one item, and gate records gain a qualifier (PA-F12; PO 2026-08-27)

The **tenant-boundary/PHI subset of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (Critical FUP C2)
closes before Gate AE4's PO approval** — the pilot authz milestone. It runs as its own
increment, never folded into AE1's or AE4's branch; the subset definition lives in the FUP.
Corollary, binding on every AE gate record: state the structurally uncovered door population
beside the covered one — 407 reachable command doors are outside every ARM domain until C2
closes, so **"all arms green" never appears without its domain qualifier**.

### 4 — Rulings that bind the plan without amending 0155 (PO 2026-08-27)

- **`home_organization_id` drops in AE2 (PA-F14):** demote-then-drop is retired. Old branches
  are not runtime consumers, generated types regenerate, and a live stale tenancy column is
  more dangerous than a clean break — future code can silently revive it as an authority
  source while every current test stays green. Drop in the same gated phase after the
  zero-consumer census; rollback SQL via §1's pattern.
- **The DEFINER review is tiered (PA-F11):** **Tier 1** — remotely reachable functions
  (exposed schema per `config.toml` + `authenticated`/`anon` effective EXECUTE) — gets full
  threat-review columns (owner + `BYPASSRLS`, PostgREST exposure, caller-identity binding,
  arbitrary-principal parameters, authority-before-existence ordering, overload/default
  reach, dynamic SQL + `search_path`, output minimization/enumeration, audit emission, exact
  grants), with public command doors individually justified. **Tier 2** — `app`-schema
  functions, where `anon` holds no USAGE — keeps the four-way classification plus exact
  grants. The reachable-definer budget gains a **ceiling and a merge rule**; a number with
  neither is inventory, not a budget.
- **All remaining audit findings are accepted as plan amendments** (PA-F2–F8, F10, F13,
  F15–F18), applied to the plan in the same change as this ADR and tagged `[PA-F#]` in place.

## Consequences

- AE3 and AE4 were blocked on these corrections; the corrections land with this ADR, so the
  block lifts **when the amended plan text is what a phase builds against** — not
  retroactively for anything built before it.
- AE1 continues as independently mergeable increments and closes only on its amended
  conditions (the plan's Gate AE1 lists them; AE1's live record mirrors them).
- 0155 gains an inbound `**Amends:**` edge from this ADR, so a session opening D7 sees the
  rollback and authority-elect corrections in the back-pointer banner instead of reading the
  retracted clause with nothing able to contradict it.
- No migration, schema, or behavior change ships with this ADR; every mechanism it specifies
  lands inside the phase that owns it.

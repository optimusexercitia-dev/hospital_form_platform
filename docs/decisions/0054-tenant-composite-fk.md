# ADR 0054 — Tenant-hierarchy composite FK: a commission's org must match its hospital's org

**Status:** Accepted (planned) · **Date:** 2026-07-05 · **Feature:** Pre-Pilot DB
Hardening — WS-3b (D2). Closes the silent tenant-hierarchy desync. Part of the pre-pilot
program ([pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §1
WS-3); analysis in
[external-db-audit-2026-07-perf-datamodel-analysis.md](../reviews/external-db-audit-2026-07-perf-datamodel-analysis.md)
§2 (D2). Builds on the multi-tenancy model (ADR
[0041](./0041-multi-tenancy-organizations-hospitals.md)) and reuses the composite-FK shape
from WS-3a C-5 (ADR-less; the `answers` form FK).

## Context

The tenant hierarchy is `organizations → hospitals → commissions`, with
`commissions` denormalizing **both** `hospital_id` and `organization_id` (two separate
single-column FKs). `commissions.organization_id` is kept in sync **on the commissions
side** by a derive trigger. But nothing guarded the **hospitals side**: `hospitals` had a
PK on `id` and `UNIQUE(organization_id, slug)`, but **no `UNIQUE(id, organization_id)`**, so

```
UPDATE hospitals SET organization_id = <another org> WHERE id = <hospital with commissions>
```

succeeded silently and left every child commission's `organization_id`, every stamped
`audit_log.organization_id`, and every org-scoped RLS predicate pointing at the **old** org
— a silent cross-tenant desync (real at M&A / restructuring time). The audit rated this a
genuine correctness defect.

**✋ Rejected extension:** `profiles.home_*` is *not* the same class of desync — those
columns have no derive trigger, are set once from invite metadata, and are documented "the
hospital is NOT an access boundary here." Excluded (analysis §D2).

## Decision

Reuse the composite-FK shape (same as WS-3a C-5):

1. **`hospitals` gains an FK-referenceable `UNIQUE(id, organization_id)` constraint**
   (`hospitals_id_org_uq`) — a real unique *constraint* (Postgres FKs cannot reference a
   bare unique index), trivially satisfied since `id` is the PK. Coexists with
   `hospitals_org_slug_key`.
2. **`commissions` gains a composite FK** `commissions(hospital_id, organization_id) →
   hospitals(id, organization_id)` (`commissions_hospital_org_fkey`) — the stored org must
   equal the hospital's actual org. The existing single-column FKs are **kept** (they carry
   the `ON DELETE RESTRICT` delete semantics; the composite is `ON UPDATE/DELETE NO ACTION`
   and only adds the cross-check — keeping both is lower-risk than dropping an existing
   constraint, at negligible cost).
3. **A `BEFORE UPDATE` guard on `hospitals`** (`guard_hospital_org_repoint`) that **BLOCKS**
   an org-repoint of a hospital that has child commissions, raising **HC082** with a clean
   pt-BR message (`não é permitido mover um hospital com comissões para outra organização`).
   The composite FK's `ON UPDATE NO ACTION` already blocks the populated case (the children
   would dangle), but with an opaque FK error; the trigger raises first with a friendly
   message. Moving an **empty** hospital (no commissions) is still allowed.

## Consequences

- The silent desync is now **impossible**: a populated hospital cannot change org (HC082);
  a `commissions` row cannot store an org that disagrees with its hospital (23503).
- No data migration (reset-OK); the seed satisfies both new constraints on a fresh reset.
- Locked by pgTAP (`194`): `UPDATE hospitals SET organization_id` on a populated hospital
  raises HC082; on an empty hospital succeeds; a `commissions` insert with a mismatched
  `(hospital_id, organization_id)` raises 23503.
- HC082 is allocated for this guard (following the ADR-0018 distinct-guard-code convention;
  HC081 was WS-1's anti-lockout).

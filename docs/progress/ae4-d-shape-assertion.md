# AE4-D-SHAPE-ASSERTION — progress record

> Hub: [ae4-d-shape-assertion.md](../features/ae4-d-shape-assertion.md) · branch
> `ae4-d-shape-assertion`, cut from `main @ c71e7c33` · owed by ADR 0208 D2 (assertion) + D3
> (triggers); D1 is the invariant asserted. ⛔ ADR 0207 D5 step 6 is NOT this unit; AE5 stays
> post-pilot (ADR 0155 G1).

## The five re-measurement triggers (ADR 0208 D3) — what each invalidates, and what watches it

Verbatim from the PO's ruling, each with the premise it breaks. ⚠ **What this unit buys is *"the
next Phase Gate noticed"*, never *"the next commit noticed"*** (ADR 0195): the assertion lives in
`npm run test:db` because `npm run lint` cannot host a live-catalog count (no Docker).

| # | trigger (PO, verbatim) | what it invalidates | watched by |
| --- | --- | --- | --- |
| 1 | *administrativo is added as a permission provider* | `F = M` (the role provider is no longer the only provider); the provider set the candidate CTE consumes | **clause 6** — the derived provider set reds the moment a new provider exists and is not consumed by both candidate CTEs (fires at ADR 0207 proposed-order item 6 **by construction**) |
| 2 | *another provider adapter is introduced* | same as 1, for any provider | **clause 6**, same cell |
| 3 | *`scope_reaches` gains one-to-many or descendant expansion* | *"one fact yields at most one candidate for a fixed resolution kind"* — clause 2's `D ≤ F` derivation | clause 2's cell reds only if the expansion changes a seeded principal's candidate count; otherwise `prose only` — re-measure |
| 4 | *membership uniqueness constraints are relaxed* | the coefficient `C = 1` per commission (`memberships_one_commission_role_uq`); `M ≤ C + 6H + 2O + 1` | `prose only` — no cell pins the constraint's existence (a pin here would be a hand-list of a catalog fact; the coefficient is re-derivable) |
| 5 | *production data exceeds the tested `M=20, D=5` performance envelope* | the envelope the residual risk was accepted under (the AE4 perf fixture: 12,036 principals over 13 orgs) | `prose only` — a production census, not a test |

## Session log

### 2026-09-13 — unit opened; peers cleared; hub + record written; branch cut (lead)

**Tree at open.** `main @ c71e7c33`, clean; four merged `definer-*` branches still exist locally
(not deleted here, not this unit's); no worktree; no `in_progress` hub before this one. Two live
peer sessions on this checkout at open, both asked and both answered before any branch was cut:
`hospital-form-platform-c1` — read-only, on `main`, nothing uncommitted, no reset/pgTAP planned;
`hospital-form-platform-09` — idle on `main @ c71e7c33`, its unit `AE5-ROLE-CATALOG-COMPAT` merged
and its branch deleted, nothing planned, will message first if that changes; it flagged a possible
later test-only session (`FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT`) briefed to coordinate or use a
worktree. `pg_stat_activity` on `supabase_db_azkbbhskturikxpgmafq`: only the stack's own service
backends (realtime · PostgREST · storage), no client `psql`. ⇒ the shared-HEAD / shared-DB hazard
(`docs/worktrees.md`) does not apply at open; re-checked before the reset at gate step 1.

**Review queue (per-clone, gitignored):** one entry after the 2026-09-13 processing marker
(`89aa778b`, `rules`, 12:35Z — the user's ordering prompt for the three DEFINER items, a repeat
of the entry the marker already triaged as hook finding (ii)). Triaged at this unit's Record step.

**Scope fixed from ADR 0208 as read today** (the ADR, not a summary of it): D2's six clauses
verbatim in the hub's AC-1..AC-6; the instrument is `scripts/authz-ae4-p2-invocation-count.sql`
(eleven `::regprocedure` counters, `:176-186`; ⚠ precondition `ae4perf.fixture_meta`, so the
script section runs on the loaded perf fixture while the pgTAP cells run on the seed); clause 5
is true today by DUPLICATION — the ADR measured a raw `diff` of the two `pg_get_functiondef`
outputs exiting 1 on the signature, three `--` comment lines and the confirmer, and 0 after
stripping comments and blank lines — so the cell compares normalised live bodies, or the producer
is factored out first (the unit's call, per the ADR). ⛔ Decided at open: **no factoring** —
this unit changes no catalog; a producer function would be a migration, a new DEFINER under D4,
and a door the sweep must inherit, all of which are more surface than an assertion needs. If the
comparator proves unworkable that decision is reopened here, with the reason.

**Numbering.** Next free pgTAP number after `422` is **423** — `ls supabase/tests` shows none
above 422 on `main`, and the four local `definer-*` branches are merged.

**Delegation.** `backend` (Opus — authz semantics) measures first and plans before writing: the
two resolver bodies, the provider family, the seed's per-principal `F` / candidate counts, the
overlap principal for clause 3. Plan-approval is the full form (a novel assertion shape over
`SECURITY DEFINER` resolvers); the lead acks by message.

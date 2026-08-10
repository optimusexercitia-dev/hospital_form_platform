# ADR 0105 — Rename `is_commission_admin_of` → `is_tenancy_admin_of`

**Status:** Accepted (PO-approved 2026-08-08, deferred past QO·B, executed 2026-08-09)
**Migration:** `20260917000200_rename_is_tenancy_admin_of.sql`
**Relates to:** ADR [0041](./0041-multi-tenancy.md) (where the misnaming originated),
ADR [0100](./0100-quality-office-oversight.md) D12, ADR
[0079](./0079-authz-door-blindness-standing-invariant.md)

## Context

`app.is_commission_admin_of(_for)` resolves **`org_admin` / `hospital_admin`** — the
tenancy tier — and returns **FALSE for `staff_admin`**, who is the actual administrator of
a commission. The name asserted the opposite of its meaning, and every reader had to be
told so: QO·B's inventory had to restate it in a dozen places, and its phase record opens
with the correction as a "stable fact". This is the repo's standing hazard — a claim that
goes stale or reads false, invisible to every gate — spelled in an identifier rather than a
comment, where it is read far more often.

## Decision

Rename both overloads. **No shim** (PO, 2026-08-09): the old name is gone, not aliased, so
anything missed fails loudly at migration time rather than resolving quietly for months.

**Historical documents are NOT rewritten** (PO, 2026-08-09). ADRs, reviews, plans and
progress records keep the old name because they record what was decided when it was called
that; rewriting them would falsify the record, the same reason migration files are
immutable here. Living current-state docs (`docs/backend-state.md`) were updated and carry
the mapping note. When reading anything dated before 2026-08-09, read the old name as this
one.

## The mechanism — measured, because the obvious prior is wrong

| storage | follows a rename? | consequence |
| ------- | ----------------- | ----------- |
| `pg_policy` — parsed node tree, references the function by **OID** | ✅ automatically | **all 54 policies needed zero edits** |
| `pg_proc.prosrc` — plain **text** | ❌ no | **all 75 bodies had to be rewritten** |

Probed live before writing the migration: `forms_select` re-rendered with the new name the
instant `ALTER FUNCTION` returned, with no policy touched.

⚠ **Do not import the D11 lesson here.** That failure — *"the re-key rewrote `pg_proc` only,
never `pg_policy`, and failed CLOSED so nothing caught it"* — was an **enum** re-key. Enum
labels are string **literals** inside a predicate, so policies did not follow. A function
identifier resolves to an **OID**, so policies do follow. Same-shaped task, opposite
mechanism. This is why it was measured rather than assumed, and why the postcondition
asserts both directions anyway.

## Consequences

- The predicate now says what it does. `is_tenancy_admin_of` vs `is_staff_admin_of` reads
  as the real distinction (tenancy tier vs committee coordinator) instead of two names that
  both sound like "admin of a commission".
- **The postcondition asserts correspondence, never a count.** It requires zero references
  to the old name in `pg_proc` **and** `pg_policies`, both new objects present, both old
  objects absent — and, the one that earns its keep, that **54 policies still render the
  new predicate**. The first four checks are all satisfiable by DELETION; only the last one
  catches a rename that silently stripped the tenancy arm from the platform. The population
  is derived at runtime and no figure is hardcoded — the two preceding waves had already
  moved it from 77 to 75.

### Two findings about the authz harness, surfaced by this wave

1. **`ARM=census` keys on NAMES, so a rename orphans a gate's verdict.** The census
   immediately reported both predicates as `UNKNOWN` — "no sweep has ever seen them" — which
   was true only of the name; the gate had carried a verdict since the full sweep. Left
   alone it would violate on every future run, and the obvious fix (sweep and record a fresh
   row) would create a duplicate for a gate that already had one. **Rule: when a gate is
   renamed, move its findings row in the same wave.** Done here; noted in
   `docs/reviews/authz-door-audit-findings.md`.
2. **The `ERROR | run-shape!=baseline` verdict is pre-existing and is not "unswept".** The
   diff-scoped sweep returned `ERROR` for both — but the identical `ERROR` was already
   recorded under the **old** name, and the neutralized run produced a broad spread of
   genuine assertion failures (cross-commission indicator reads, `case_tags` isolation,
   staff_admin-gated RPC denials). Keystones notice this gate opening, loudly. The harness
   simply cannot verdict a predicate this load-bearing, because opening it destabilises the
   suite shape it measures against — and the same is true of `is_admin()`,
   `is_staff_admin_of(_for)`, `is_pqs_operator_of(_for)` and three others. **The most central
   predicates in the platform are exactly the ones the harness cannot classify.** Recorded
   as harness debt, not actioned: this wave was a rename.

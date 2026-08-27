# ADR 0160 — AE0 corrections to ADR 0155's measured figures: the `anon` residue never grew, and the role-helper predicate names a dead term

- **Status:** PROPOSED 2026-08-26 — written at the AE0 measurement step, PO-directed the
  same day the two findings were re-derived. ⛔ **This ADR corrects two measured claims and
  changes no decision.** Every ratified decision in 0155 (G1–G11, D0–D10) stands exactly as
  accepted; the sequence, the pilot cutline and the role-by-role substitution strategy are
  untouched.
- **Related:** 0079 (door-blindness audit family) · 0105 (the rename this ADR's second
  finding is an orphan of) · 0078 (the "text is not truth" methodology finding).
- **Amends:** 0155 — **its Measured-figures block only.** Two figures published there are
  contradicted by the catalog at the same migration head. The decisions those figures were
  offered in support of are re-justified below rather than withdrawn, except where noted.
- **Evidence:** [AE0 findings](../design/authz-evolution-ae0-findings.md) §A ·
  [AE0.1 census](../design/authz-evolution-census-ae0.md) (every figure with its deriving
  query) · measured on local **and** the linked remote at head `20261003004300`, zero
  catalog drift between them.

## Context

AE0 of [the authorization-evolution plan](../plans/authz-evolution.md) exists to buy
**attributable measurement**: every later phase must be able to say "this regression is
mine / not mine". Re-deriving 0155's own published figures is the first thing it does, and
two of them did not reproduce. Both were re-derived a second time by the lead,
independently of the agent that first reported them, each against a working control.

This is the failure family ADR 0078 named: a number that is honest about *something* is
quoted for a claim it does not support, and nothing in the document can contradict it.

## Correction 1 — the "167 → 237 `anon`-residue growth" never happened

0155 presents `237 (was 167)` as growth over time. It is not. The two numbers are **two
predicates evaluated at the same instant on the same head**:

| predicate | value |
| --- | ---: |
| `app` functions `anon` can EXECUTE — **all** | **237** |
| … the **DEFINER-only** subset | **167** |
| … the **INVOKER-only** subset | **70** |

167 + 70 = 237 exactly. The audit's neighbouring 432/320 reproduces only under a
DEFINER-scoped predicate, which is what pinned the confusion's origin. `anon` additionally
holds **no USAGE on `app`** (`false`), so the residue is inert at the schema level
regardless of the count.

**Consequence.** The plan's AE1.2 step 3 justified explicit `ALTER DEFAULT PRIVILEGES` as
the thing that *"stops the 167→237 `anon`-residue growth at its source"*. **There is no
growth to stop.**

**Ruling: the step stays, its reason changes.** A default-privileges stop is retained on
its own merits — it makes the absence of PUBLIC EXECUTE a declared property of the schema
rather than a fact that happens to hold, and AE4 creates a new schema (`authz`) where the
default is set once, before any object exists, at zero cost. It is **not** retained as
remediation of a trend, because the trend is not real. ⚠ Correcting a claim's *direction*
without re-deriving its *magnitude* is how a partial fix reads as a complete one; the
magnitude here is **zero**, and AE1.2's text must say so.

**Unchanged:** `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` remains a **PO decision,
not a patch**. The historical-residue revoke sweep still executes only under that FUP's
ruling and is still forbidden from riding along inside a feature migration. This ADR
removes a false justification; it does not authorize the sweep.

## Correction 2 — the published role-helper predicate names a helper that does not exist

0155's wide predicate (the one yielding 131) includes the term `is_commission_admin`.
Measured:

| probe | result |
| --- | ---: |
| policies matching `is_commission_admin` | **0** |
| function names matching `is_commission_admin` | **0** |
| **control** — policies matching `is_tenancy_admin_of` | **53** |

The helper was **renamed to `app.is_tenancy_admin_of` by ADR 0105**. The predicate term is
an orphan of that rename — a name-keyed artifact outliving the name it keys on.

⚠ **The second half is the one that matters.** `is_tenancy_admin_of` is the
**second-largest** helper by policy count and is named by **neither** published
predicate — not 0155's wide 131 nor the audit's narrow 117. **No coverage is lost today**,
because all 53 of those policies also match another term, so this is a *predicate-quality*
finding and not a number finding. But a predicate that misses the second-largest member of
its own family by name is one rename away from missing it in substance.

**Ruling.** The term is corrected in 0155's figures block. More importantly: **AE4.3 and
every AE5 per-role matrix sweep the helper family by the catalog-derived vocabulary**
([census](../design/authz-evolution-census-ae0.md) §3.4), **never by either published
regex** — and always **unanchored**, because policies call the bare form (`is_x_of`) while
functions call the `_for` form (`is_x_of_for`) and no single anchored regex finds both.

## Both published counts were honest; neither is usable bare

131 − 117 = **14**, and the 14 are exactly the policies whose only role-helper call is
`app.is_admin()` — the platform-admin helper, which reads `profiles.is_admin` or the JWT
claim plus `app.active_role()` and **never touches `memberships`**. Each number is correct
for its own predicate. This ADR therefore does not pick a winner: it requires that **every
role-helper figure this program publishes carries its predicate**, which is already the
convention AE0.1's census follows.

⭐ **The figure larger than either, previously unmeasured:** **233 of 278 policies (84 %)**
transitively depend on `memberships` (573 functions in the closure). That — not `4`
direct-`memberships` policies and not `131` role-helper policies — is the real blast radius
of any `memberships` change, and it is the number D6's entry conditions should be weighed
against.

## Decision

1. ADR 0155's Measured-figures block is corrected on both points. **No ratified decision
   (G1–G11, D0–D10) changes.**
2. AE1.2 keeps its default-privileges step with a **new, non-trend justification**; the
   plan text is corrected in the same change.
3. The **catalog-derived helper vocabulary** is the sweep input for AE4.3 and AE5, swept
   unanchored across the bare/`_for` pair.
4. Every role-helper figure published by this program **carries its predicate**. A count
   without its predicate is not admissible evidence in an AE gate record.

## Consequences

- 0155 gains an inbound `**Amends:**` edge, so a session opening it sees the correction in
  the generated back-pointer banner instead of reading a refuted figure with nothing in
  the file able to contradict it. That banner is the entire reason this correction is an
  ADR rather than a line in the findings doc.
- ⚠ **AE0 found these because it re-derived figures nobody had asked it to doubt.** The
  cheap lesson is to keep doing that; the expensive one is that both errors survived an
  audit, a PO review and an acceptance, because each number was true of *something*.
- No migration, no schema change, no behaviour change follows from this ADR.

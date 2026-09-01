# 0171 — C2's Tier-1 predicate is re-grained, the tenancy disjunct is dropped, and the command-door neutralizer is built

**Status:** Accepted · 2026-08-31 (PO ruling)
**Amends:** the 2026-08-18 PO ruling recorded in `docs/progress/decisions-log.md` (the "407-door
triage is sized — two tiers" row), whose Tier-1 predicate — *"touches PHI or crosses a tenant
boundary"* — is replaced here
**Relates:** 0079 (the door-blindness standing invariant and its arms), 0153 (subset sweeps write to
SCRATCH), 0155 / 0162 (the authz-evolution plan and its PA-F11 tiering — ⚠ a **different** "Tier 1"),
0106 (the active-role hat), 0120 (the DM5 gate that filed C2)

## Context

C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`) records that the reachable `prosecdef`, non-trigger, scalar,
non-`bool` command doors sit outside every `p0-authz-invariant.sh` arm's domain. The 2026-08-18
ruling split them into **Tier 1** — the subset *"touching PHI or crossing a tenant boundary"*, to be
swept with a recorded verdict per door — and **Tier 2**, deferred past the pilot. It bound the
method: *Tier 1's population is derived from the catalog **as a property**, never hand-listed.*

Sizing that predicate (step one) was owed and had never been done.

## Decision

**1 · The 2026-08-18 predicate is replaced, because measured honestly it does not partition.**
Derived over the live catalog it returns **405 of 427 doors (94.8 %)**, leaving a Tier 2 of 22
internal helpers. A tiering created to make the sweep affordable did not.

**2 · Tier 1 is re-grained to a GATE-AWARE closure over a PHI-marked relation.**

> A door is Tier 1 when its call closure — **never descending into a boolean-returning callee** —
> reaches a relation that is either **door-only for `authenticated`** (`has_table_privilege` false)
> **or** carries a **positive-polarity PHI comment**.

⭐ The grain is the substance: *a predicate that **checks** whether you may read PHI is not itself a
PHI-touching door.* Descending through gate calls made every gated door inherit whatever its authz
predicates read, which is why `profiles` (354 of 427) and `app.feature_flags` (328) dominated the
first result. **Tier 1 = 237 (55.5 %), Tier 2 = 190.** All six positive controls pass and no
component is a hand-list — return type, `has_table_privilege`, `pg_description` and `pg_constraint`
are all catalog facts.

**3 · The TENANCY disjunct is DROPPED, not re-grained.** It returns 92.5 % (all-edges), 81.0 %
(gate-aware) and 74.5 % after excluding tenancy roots and the hash-chained audit sink — both derived
as properties, not named. Its drivers throughout are `cases`, `memberships`, `meetings`,
`responses`: **the ordinary business tables.** A DEFINER door bypasses RLS and must re-establish
tenancy itself, so in a multi-tenant governance platform *"crosses a tenant boundary"* is a **domain
tautology**, not a filter. No further exclusion rescues it without becoming the hand-list the method
rule forbids.

**4 · A command-door neutralizer is built**, because naming 237 doors could not sweep one of them:
every prior harness opens a **boolean** gate or a policy `USING`, and these doors return
`jsonb`/`uuid`/`void`/a composite. `supabase/tests/mutation/c2-command-door-neutralizer.sh` rewrites
an authz `raise` to `null;` — **guard gone, effect intact** — and its unit is the **enforcer, not
the door** (the 237 doors share 243 enforcers; 72 are already in the bool arm, 171 are new).

## Consequences

- **Tier 1 no longer claims to prioritise tenant-isolation risk among the command doors.** Those
  doors move to **Tier 2 — deferred, NOT cleared.** ⚠ Tenant isolation is not thereby unmeasured
  platform-wide: `ARM=hat`, `ARM=floor` and `ARM=policy` all bear on it. C2's gap was always
  specifically the *command doors*, and this ruling decides only which of them go first.
- ⛔ **The class is no longer "covered-but-unpinned".** The 2026-08-17 3-door sample found three
  COVERED and that reading stood for two weeks. The neutralizer's first 8 measurements found
  **3 BLIND** — `nsp_org_capa_rollup`, `cancel_event` (no pgTAP mentions at all) and
  `cancel_session`, which **has** a test that still does not notice its guard vanish. Any document
  calling this class covered-but-unpinned is now wrong.
- ⛔ **Nothing is closed.** 8 of 171 enforcers measured; **no door has a recorded verdict**, and C2
  stays open. Building the instrument was the long pole; it is not the sweep. The full run is
  171 × 1–2 full-suite runs — a **periodic audit, never a phase step**.
- The full sweep's committed baseline (`docs/reviews/c2-command-door-findings.md`) is deliberately
  **not created yet**: a file holding 8 of 171 rows would read as a baseline. Subset runs write to
  SCRATCH (ADR 0153).
- Both absorbed items (`FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`, `FUP-DM5-SIBLING-GUARD-DIFF`) stay open
  with their own index lines; `assume_role` stays **ERROR-shaped, not COVERED**.

## Detail

Sizing, rejected variants and the control matrix: `docs/design/authz-c2-tier1-sizing.md` §8b.
Harness design, its safety properties and the four bugs the proving caught:
`docs/design/authz-c2-command-door-neutralizer.md`.
⛔ Every figure here is a **dated measurement**; both instruments re-derive theirs per run. Re-derive,
never quote.

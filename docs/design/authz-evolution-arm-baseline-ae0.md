# AE0 — authz ARM gate baseline

**Phase:** AE0 (`docs/plans/authz-evolution.md`) · **authority:** ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) ·
**owner:** lead · **measured:** 2026-08-26 · **branch:** `authz-ae0-baseline`

**Stack:** local, immediately after a fresh `supabase db reset --local`.
**Migration head:** `20261003004300` · 475 registered == 475 files on disk.
**Seed cardinalities at measurement:** `auth.users` 36 · `commissions` 6 · `cases` 8 ·
`organization_affiliations` 35.

## Why this file exists

AE0's purpose is **attributable measurement**: every later AE phase must be able to say
"this finding is mine / not mine". These are the ARM figures on current `main` + the AE0
branch cut, so the next phase's diff answers that question instead of re-litigating it.

It also re-establishes the residue PROGRESS.md § Now carries: **no authz-gate result
predating 2026-08-24 is trusted**, because the step-1 suite was then not running on this
platform at all, in two independent committed ways, and `ARM=census` printed
`INVARIANT HOLDS` at exit 0 **having enumerated ZERO gates**. Every figure below is
therefore recorded with the count the arm actually enumerated — an arm's exit code is
**not** its verdict here, and a green with no count is treated as a red.

## Reproduce

Run from `supabase/tests/mutation/`, on a **fresh reset** (rule 5 — absence measured
against a stale DB is not absence):

```bash
ARM=census bash p0-authz-invariant.sh
ARM=hat    bash p0-authz-invariant.sh
ARM=floor  bash p0-authz-invariant.sh
FROMFINDINGS=1 ARM=wrapper bash p0-authz-invariant.sh
```

⛔ Capture each exit code directly. Piping an arm through `head`/`tail` erases it, which
is one of the four ways a gate figure has been fabricated in this repo.

## The four arms — 2026-08-26, all green

| arm | question it asks | exit | **what it actually enumerated** |
| --- | --- | --- | --- |
| `census` | has anything **ever asked** about this gate? | 0 | **564** live authz gates in the catalog; **600** gates carrying a verdict |
| `hat` | does any door read `memberships` **without the caller's hat**? | 0 | detector self-test **6/6**; **3** findings, all reasoned-allowlisted |
| `floor` | is every door actually **called**? | 0 | **72** `authenticated`-reachable `prosecdef` doors with 0 calls, every one on the floor allowlist; every allowlist entry resolves to a live door |
| `wrapper` (`FROMFINDINGS=1`) | the `prosecdef = f` half — a `public` INVOKER wrapper whose own probe is the only gate in front of an `app` DEFINER body | 0 | BLIND set size **41**, every member allowlisted |

Preflight, on all four: **0 degenerate gate bodies** in `app` + `public` (all three forms).

## Three observations recorded now, so a later phase cannot inherit them silently

1. **`census` carries 36 more verdicts (600) than live gates (564).** The arm's closure
   question is "every gate has a verdict", which a *surplus* does not violate, so this
   passes correctly and is **not** a defect. It is recorded because a name-keyed verdict
   outlives the door it names: a rename or retirement orphans the verdict rather than
   removing it. If a later AE phase renames a wrapper family (AE4.6 does exactly this),
   the surplus is the number that must not grow unexplained.
2. **`floor` = 72 today.** The script's own header comment says *110*; the plan's rule 5
   discusses *35 phantom doors on a stale DB*. All three are different quantities — 110 is
   dated prose, 35 is the stale-DB phantom count, 72 is the measured fresh-reset value. The
   comparison floor for later phases is **72**, measured here, not either written number.
3. **`census` states its own domain boundary:** `prosecdef` scalar **non-`bool`** command
   doors — **407 reachable** — are outside every arm's domain, tracked as
   `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (§ Critical FUP **C2**). ⛔ These arms being green is
   therefore **not** a statement that those 407 doors are protected; absence of a verdict
   is not absence of coverage, and it is not evidence of exposure either. AE-phase gate
   records must name the ARM and not imply the C2 domain was swept.

## Bounded, stated

These four arms are the **cheap** phase-step comparison, not the periodic full sweep
(`ARM=wrapper`'s own full sweep is ~100 min / 56 suite runs; the complete door sweep is
~5 h). A phase that touches an RLS policy or a `prosecdef` gate additionally owes the
**diff-scoped** door sweep derived by `scripts/door-sweep-cases.sh` — never a hand list,
and its **exit 1** (migrations touched, zero gates derived) is a finding to rule on, never
a pass. AE0 touches neither, so no diff-scoped sweep is owed by this phase.

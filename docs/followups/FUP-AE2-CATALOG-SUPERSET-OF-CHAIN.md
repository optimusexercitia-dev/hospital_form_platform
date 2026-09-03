# FUP-AE2-CATALOG-SUPERSET-OF-CHAIN — a hand-applied migration makes the live catalog a SUPERSET of the migration chain, and no gate can see it (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-AE2-CATALOG-SUPERSET-OF-CHAIN** — filed 2026-08-28, from a hazard the author created,
  hit, and reported against themselves during AE2.4 increment 4. ⭕ **DOWNGRADED 🟠→🟡 2026-08-29**
  at the pre-AE3 branch-cut clearance — see § DISCHARGE at the end of this item. **Deliberately not
  closed:** the detection half is done and measured, the **adoption** half is not, and this repo's
  dominant record failure is *a partial fix reading as a complete one*.

**Mechanism.** Applying a migration by hand (`psql -f`) instead of through
`supabase db reset` leaves its objects in the catalog **without** the chain having produced them.
Combined with `create or replace`, the live catalog becomes a **superset** of what the chain
builds: a statement **removed** from the migration file — the measured case was a `grant` line —
**survives in the catalog**, because nothing revokes it and nothing re-derives the object from
scratch.

⛔ **Every gate figure read from such a stack is against a schema a fresh reset would not
reproduce**, and every one of them is green. The measured instance: pgTAP `393 § 1.1` was **RED on
the stack and GREEN in the chain** — the disagreement is what exposed it, and it was caught by a
*second* agent running the suite, not by the author.

⛔ **No gate can detect this, and the reason is structural**: `lint`, the ARM arms, pgTAP and the
door sweep all read the **live catalog**, which is exactly the artefact that has drifted. There is
nothing to compare it against without rebuilding. **Only a reset can.** ⚠ This is the sharper twin
of the standing *"catalog is truth"* rule — the catalog is truth about **what is**, and says
nothing about **whether the chain produces it**. `supabase migration list` compares *versions*, not
*contents*, so it is green here too.

**Owed:** (a) decide whether any cheap positive control exists — e.g. a gate-time assertion that a
freshly reset catalog and the working stack agree on a hash of `pg_proc` + `pg_policies` + ACLs for
the objects a phase touched; (b) if no such control is affordable, make the **prohibition** explicit
where the action is taken (a `.claude/rules/` entry scoped to `supabase/migrations/**`, alongside
`push-schema-before-code`), because a warning is only as good as its position relative to the
action it governs; (c) either way, **any gate figure quoted from a stack that was not freshly reset
is inadmissible** — say so in the record rather than assuming a reset happened.

⚠ **Related, and the reason this is not merely hygiene:** AE2's own standing residue already says a
green baseline on a mutated DB is not fit to mutate, and that 6 of 8 verdicts flipped without a
fresh reset. This is the same family with a *quieter* signature — there, the DB was mutated by
tests; here, by the author's own convenience.

#### § DISCHARGE 2026-08-29 — owed (a) answered YES, owed (c) recorded, owed (b) moot; ADOPTION is what stays open

**(a) "decide whether any cheap positive control exists" — YES, and it is cheap.**
`scripts/catalog-chain-drift.sh` + `scripts/catalog-fingerprint.sql`: capture the working stack →
`supabase db reset --local` → capture again → diff. Nine sections — PROC (incl. `prosecdef`,
`proacl`, body hash) · POLICY · RELACL · COLACL · TRIGGER · NSPACL · COLUMN · CONSTRAINT · INDEX.
**Measured at head `20261003006500`: CLEAN — 5446 rows, byte-identical.** So no residue survived
from the increment-4 hand-apply, and AE2's completion figures are admissible.

⭐ **The CLEAN is not vacuous.** `--prove` injects the *measured* drift shape — a `grant` the chain
does not produce (`grant execute on app._cap_bit(text) to anon`) — asserts the fingerprint **MOVES**,
then revokes and asserts it comes **BACK**. Both directions held. ⛔ Probe only a function with an
**explicit non-null `proacl`**: on a NULL one the grant materialises an ACL the revoke cannot
un-materialise, and the "restore" would leave residue while reporting success.

⛔ **A defect the instrument's FIRST REAL USE found in the instrument.** Verifying the AE2 remote
push, PROC and RELACL reported **DRIFT with identical row counts**. It was not drift: Postgres
preserves **GRANT ORDER** in an `aclitem[]`, and the same privileges hash differently when applied
in a different sequence — `postgres,authenticated,service_role` = 417 local vs 222 remote, the
mirror ordering 285 vs 480, **both summing to 702**. Fixed by sorting ACL elements (and
`pg_policies.roles`) before hashing. ⚠ The general shape, worth more than the fix: **an
order-sensitive digest over an order-preserving structure cries wolf**, and a control that cries
wolf is ignored on the day it is right. It would have fired locally too, on any
`create or replace` + re-grant.

**(c) "any gate figure quoted from a stack that was not freshly reset is inadmissible" — recorded
here, and honoured in the same change:** every figure in this discharge was taken on a fresh reset,
with `psql -v ON_ERROR_STOP=1`. That flag is load-bearing, not hygiene — **without it psql skips a
failing section and still exits 0**, so the fingerprint silently narrows and the diff reads clean.
The harness asserts all nine sections are present for exactly that reason (it hit this: the TRIGGER
section failed on a `text || "char"` cast and the first run reported success over eight).

**(b) "if no such control is affordable, make the prohibition explicit in `.claude/rules/`" — MOOT
as written**, since (a) succeeded. ⚠ Not re-litigated silently: a rule was **not** added because
CLAUDE.md §8 forbids one a gate already enforces and bounds the rule population, and because a
prohibition against hand-applying migrations has no resolution event *and* no enforcer, which is
weaker than the script that now measures the consequence.

**WHAT STAYS OPEN — adoption, and it is a PO/gate decision, not a build task.** Nothing runs this
automatically. Options, none taken: (i) a §6 step-1 line for any phase whose migrations were applied
outside `db reset`; (ii) an 12th `lint:` gate — ⛔ but it **resets the database**, which no other
lint gate does and which the shared-single-owner rule makes hostile in a lint run; (iii) leave it an
operator tool invoked at Record steps. ⚠ **A gate change is not a mid-phase edit** (CLAUDE.md §8),
which is why this increment built the instrument and stopped. **Bounded, stated:** the fingerprint
covers the nine sections above and **not** row DATA, sequences, types/enums, view bodies,
extensions, storage buckets or auth config — a superset in *those* is invisible to it, so absence of
a finding there is absence of coverage, not coverage.

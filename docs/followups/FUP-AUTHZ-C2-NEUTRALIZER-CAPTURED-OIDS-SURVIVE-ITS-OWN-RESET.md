# FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET — the C2 harness mutates by an OID captured before a reset that reassigns every OID

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-07 · status open

**What this is.** `supabase/tests/mutation/c2-command-door-neutralizer.sh` derives its worklist
once, before the first case, and carries a `pg_proc.oid` in field 1 of each row. It then addresses
every mutation by that OID. Since 2026-09-04 the same harness also performs a **periodic
`supabase db reset --local`** mid-sweep. A reset drops and recreates the database, so **every
`pg_proc.oid` is reassigned** — and from that moment the captured OIDs name whatever functions
happen to hold those numbers now.

## The mechanism, MEASURED at HEAD `ea5783c0`

| where | line | what it does |
| --- | --- | --- |
| the case loop | `:878` | `while IFS=$'\t' read -r foid name sig ndoors nraise nanchored; do` — `foid` is **field 1** of `$WORK/worklist.tsv`, derived once at `:350` before any case runs |
| the mutation function | `:797` | `local foid="$1" …` — inside, `hash_of "$foid"`, `snapshot "$foid"` and `mutate "$foid"` all address the function **by OID** |
| first measurement | **`:889`** | `sweep_one "$foid" "$sig" …` |
| the destructive step | `:764` | `( cd "$ROOT" && npx supabase db reset --local )` inside `periodic_reset` — scheduled every `RESET_EVERY` cases, and again on a drift-shaped retry at `:921` |
| the retry measurement | **`:922`** | `sweep_one "$foid" "$sig" …` — the SAME captured OID, now on a rebuilt database |

⛔ **The reset's own guard cannot see this.** `periodic_reset` re-derives the worklist at `:773` and
compares it at `:775` with `cut -f2,5` — **name and raise-count only**. Field 1 is dropped
deliberately and correctly (an OID that moved is not a population that moved), which is exactly why
the comparison passes while the loop's OIDs go stale. The guard and the defect are consistent with
each other; neither is wrong on its own terms.

## Why it has never misfired, and why that is the concerning part

A `supabase db reset --local` replays the same migrations in the same order, so Postgres tends to
allocate the same OIDs. The harness is therefore protected by an **incidental property of
deterministic replay**, not by a guard. Nothing in the tree asserts it, nothing would red if it
stopped holding, and it stops holding the moment a migration is added, reordered, or an extension
allocates differently — i.e. on an ordinary day's work.

⚠ **What a misfire would look like.** `sweep_one` snapshots, `create or replace`s and then restores
**by the same OID**, so a slipped OID does not merely mis-measure one case: the harness would open a
function nobody asked about and then write the snapshot back to it. §7.5's byte-compare would still
pass, because both halves address the same wrong subject. On a **shared local stack** that residue
outlives the run.

## The remedy, and the precedent that already exists in this tree

The door arm hit the identical hazard while ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
D8 ported this same reset design into `p0-authz-door-audit.sh`, and closed it there:
`sweep_pred_one` **re-resolves the gate from `nspname.proname(identity_args)` at case time**, and
scores `ERROR` — never mutates — if the identity resolves to nothing. C2 should take the same shape.

## Closes when

`c2-command-door-neutralizer.sh` addresses each case by **identity** resolved at case time rather
than by a pre-captured OID, and a case whose identity no longer resolves is scored as an error
rather than mutated.

⛔ **Proven, not asserted.** The demonstration is a mid-sweep reset after which a case still lands on
the right function *while the re-derived worklist's field 1 has moved* — i.e. the OID column must be
observed to change, or the trial proves nothing. A run in which the OIDs happened to be stable is
the state that masks the defect today, so it cannot also be the evidence that closes it.

⚠ **Not closed by asserting OID stability.** The fix is to stop depending on it. A guard that reds
when OIDs move would convert a silent wrong-subject mutation into a spurious abort on every ordinary
migration change, which is a worse instrument than the one it replaces.

## Related

- ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
  D8 — the door arm's port of the reset design, where this hazard was found and closed for that arm
- ADR [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md) D6 — the
  `RESET_EVERY` set-ness gate the periodic reset turns on
- `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` — the C2 arm's own scope

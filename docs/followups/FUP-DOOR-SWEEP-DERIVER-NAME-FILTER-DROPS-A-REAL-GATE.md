# FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE — the deriver returns zero cases for a diff that added a gate, so the case list has to be hand-widened

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-04 · status open

`scripts/door-sweep-cases.sh` is the required way to derive a diff-scoped sweep's case list —
CLAUDE.md § 6 step 1 says to derive it with the script "never by hand". Measured 2026-09-04:

```
BASE=9a4bbd22^ TIP=9a4bbd22 scripts/door-sweep-cases.sh   →  exit 1 (FINDING), ZERO cases derived
```

That diff **added a gate** — `app.current_professional_read_organizations`, the narrow door ADR
[0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) introduces — and the deriver
excludes it by a **name filter** in the recipe. So the sweep that actually ran used a
**hand-widened** list.

⛔ **The exit code is doing its job; the risk is how the result READS.** CLAUDE.md § 6 step 1 already
says the deriver's exit 1 — migrations touched, zero gates derived — "is a finding to rule on, never
a pass", and the widening is legitimate under the door-sweep recipe's Amendment 8 ruling 2 (a). The
defect is that a hand-widened list is indistinguishable, downstream, from a derived one: the sweep
output, the findings file and the gate record all look identical either way. A future reader
verifying "the cases were derived by the script" would be told yes by the record and no by the
script.

⭐ **The class:** an enumeration boundary that is a **syntax** (a name filter) rather than a
**property**. The same phase closed exactly this shape twice — the manifest's site axis, and
`ARM=census`'s extension exclusion, which was deliberately keyed on `pg_depend.deptype='e'` rather
than a name pattern *for this reason*. The deriver is the same defect still standing.

**How it was measured.** Run directly during re-review N3's write-arm work, on a fresh
`supabase db reset --local` at head `20261003007340`. Exit code read bare, not through a pipe.

**Closes when:** the deriver selects gates by a **property** rather than a name filter — so a diff
that adds a DEFINER door or an RLS policy yields that gate without hand-widening — **or**, if the
name filter is deliberate and must stay, the deriver prints the objects it excluded and why, so a
hand-widened list is visibly a widening rather than silently equivalent to a derived one. In either
case a diff like `9a4bbd22` must stop producing zero cases.

⛔ **What must NOT be mistaken for closing it.** Widening the name filter to admit
`current_professional_read_organizations`. That fixes one name and leaves the boundary a syntax —
the next door named outside the pattern reproduces it exactly. ⛔ Nor does a green sweep close it:
the sweep was green here, on the hand-widened list, which is the whole point.

Related: [[FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED]] (the same recipe, the other half),
[[FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION]] and
[[FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE]] — three standing findings about the same
deriver, none of which is this one.

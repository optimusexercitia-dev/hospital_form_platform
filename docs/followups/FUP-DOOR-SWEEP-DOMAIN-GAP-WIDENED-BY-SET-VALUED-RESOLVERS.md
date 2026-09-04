# FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS — three more authorization functions are outside `PRED_DOMAIN`, this time by RETURN TYPE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

`FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS`, which this compounds. Not 🔴 because all three
are covered behaviourally by targeted mutation cases run in this increment; above 🟡 because the
population the apparatus cannot select has now grown twice in two increments, which is a trend.

**What is wrong.** `p0-authz-door-audit.sh`'s `PRED_DOMAIN` bounds itself with `t.typname = 'bool'`.
The three functions added by `20261003007320` — `authz.authorized_scope_ids`,
`authz.candidate_authorized_scope_ids`, `app.current_professional_read_organizations` — all return
`SETOF uuid`. They are therefore excluded **structurally**, by return type, before the name and
identity regexes are even consulted. The existing FUP records exclusion by *name/identity* regex;
this is a third exclusion axis, and it cannot be fixed by widening those regexes.

**How it was MEASURED.** `bash scripts/door-sweep-cases.sh` on 2026-09-03 returned **exit 0
(DERIVED, 1 case)** — the altered policy `professional_profiles_select` — and printed all three new
functions on its `⛔ EXCLUDED BY NAME — A REVIEW LIST, NOT A DROP` list, with the script's own
ruling: *"If any of these is an authorization gate, it owes a TARGETED mutation case (the door sweep
can only neutralize a boolean predicate), and the ruling belongs in the gate record."* ⚠ The exit
code is **0, not 1** — the handoff into this increment predicted exit 1, and that prediction was
wrong because the ALTERed policy alone is enough to make the derivation non-empty. **A non-empty
derivation is not evidence that the derivation was complete.**

⭐ **A SECOND MEASUREMENT, and it is the more instructive one.** The follow-on migration
`20261003007330` (ADR 0182 § Corrections) `create or replace`s the same door with no policy change
at all. The deriver over that diff returns **exit 1 — FINDING: "the diff TOUCHED
supabase/migrations and ZERO cases were derived"** with an EMPTY case list. ⛔ So the same door
produces **exit 0 and exit 1 from the same apparatus** depending on whether an unrelated policy
happens to be in the diff beside it — the door itself is invisible to the selector in both runs,
and only the *company it keeps* moves the exit code. Ruled here rather than passed: 7330 creates and
alters no policy, and its one function already holds a targeted mutation verdict. ⚠ That verdict had
to be **RE-EARNED**, not carried: pgTAP 413 grew five assertions and the suite shape moved
`Files=261, Tests=8733` → `8738`, and a verdict recorded at one shape is not a verdict at another.

**What would close it.** Extend `PRED_DOMAIN` along the return-type axis (a `prosecdef` function in
`authz`, or one whose result is a scope-id set consumed by a policy, is in domain regardless of
`typname`) and re-baseline the findings file; **or** rule that set-valued resolvers are swept by
targeted cases and give those cases a committed home so they run on a schedule. Either way this
should be resolved together with `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` — they are one
apparatus gap with two symptoms.

⛔ **THREE HERE, ONE IN `authz-unswept-backlog.txt` — and both are right.** Added 2026-09-04
(gate AE4 re-review, LOW-8), because the two records disagreed and nothing bridged them, which
reads as one of them being stale. They count **different sets**:

- **This follow-up's THREE is the primary figure**: what `PRED_DOMAIN` (`p0-authz-door-audit.sh`,
  ARM 1's domain) excludes **by return type**. All three return `SETOF uuid`, so
  `t.typname = 'bool'` drops them before any name regex runs.
- **The backlog's ONE is DERIVED from those three** by the census's own reachability clause.
  `authz-unswept-backlog.txt`'s contract is census closure (ARM 3), whose set-returning clause is
  `p.proretset AND has_function_privilege('authenticated', p.oid, 'EXECUTE')`. Only
  `app.current_professional_read_organizations()` satisfies it, so only it can owe that file an
  entry.

**Measured on the live catalog 2026-09-04**, not read off the migration:

| function | `prosecdef` | result | `authenticated` EXECUTE | in `PRED_DOMAIN` | in census domain |
| --- | --- | --- | --- | --- | --- |
| `app.current_professional_read_organizations()` | t | `SETOF uuid` | **t** | no | **yes** |
| `authz.authorized_scope_ids(uuid,text,text)` | t | `SETOF uuid` | f | no | no |
| `authz.candidate_authorized_scope_ids(uuid,text,text)` | t | `SETOF uuid` | f | no | no |

The two `authz.*` resolvers hold EXECUTE for no application role (pgTAP 401 § 18.1 pins that at 0
across 27 probes), which is why the census never demands a verdict for them. ⛔ That is a
**reachability** bound, not a clearance — *absence of a verdict is not absence of coverage*, and
here it runs the other way too: being outside every arm is precisely this follow-up's complaint.
If either resolver ever gains `authenticated` EXECUTE it enters the backlog's domain that same day.

⛔ **What must NOT be mistaken for closing it.** The targeted mutation cases run in this increment:
they are three functions, measured once, by hand, outside any arm. ⛔ Nor a green from
`ARM=census`/`hat`/`floor`/`wrapper` — every one of those bounds its domain on `p.prosecdef` over a
name/identity regex and is silent about this population. *An arm that cannot select a gate has not
cleared it.*

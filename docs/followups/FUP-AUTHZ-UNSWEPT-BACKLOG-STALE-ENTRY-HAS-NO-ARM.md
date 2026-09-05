# FUP-AUTHZ-UNSWEPT-BACKLOG-STALE-ENTRY-HAS-NO-ARM — a backlog entry that has since EARNED a verdict stays in the file forever, and no arm reds on it

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

**What is wrong.** `supabase/tests/mutation/authz-unswept-backlog.txt` means *"this gate is in the
census's domain and no arm has swept it"*. `ARM=census` consumes it through
`allow_body "$UNSWEPT"` as part of **ACCOUNTED** — the union of "a verdict exists anywhere" with
the allowlists and this backlog. A union cannot notice that two of its members now overlap.

So once a backlogged gate **earns a verdict**, the file keeps asserting it is unswept, the census
keeps accounting for it twice, and **nothing anywhere reds**. The one check that looks at this file
in the other direction is the GHOST partition (`comm -13 "$live" <(allow_body "$UNSWEPT")`), and it
only catches entries that are **absent from the live domain** — the opposite failure.

**Measured 2026-09-05, with a witness, not predicted.** Using the invariant script's own
`allow_body` and `verdicts_from_findings` verbatim over the 103 backlog entries and the 424
verdicted keys of the door + writepath findings files, the intersection is **2**:

```
process_template_versions.process_template_versions_select (SELECT)
process_template_versions.process_template_versions_staff_admin_write (ALL)
```

Both carry a `COVERED` verdict in `docs/reviews/authz-door-audit-findings.md` (`:281`, `:282`,
note `297_process_template_versioning.sql`) **while** the backlog block above them still reads
*"Genuine audit debt, not bookkeeping."* Both records are wrong about each other and no gate says
so.

⭐ **The class is growing, and the unit that found it had to hand-repair two more.** ADR 0191's
schema-axis widening brings `authz.scope_reaches` and `authz.candidate_has_permission` into the
door arm's domain, where they earn verdicts — so their CATEGORY (b) backlog blocks
(`authz-unswept-backlog.txt:796`, `:841`) become stale in exactly this shape the moment the
re-baseline lands. PRED-DOMAIN removes them **by hand, because the plan said to**, which is the
same reliance on someone remembering that this entry is about.

**What would close it.** An arm — the natural home is `ARM=census`, which already computes both
sides — that reds on `backlog ∩ verdicted ≠ ∅` and names the entries, so a gate that has earned a
verdict cannot keep claiming to be unswept. ⛔ **Proven able to fire**: it must be shown red on the
two entries above (or on a planted one) *before* they are repaired, and green after.

⛔ **What must NOT be mistaken for closing it.** Deleting the two stale entries. That fixes the two
instances and leaves the mechanism that produced them, which is precisely the shape the census
exists to catch one layer down. ⛔ Nor the existing GHOST partition: it answers "is this entry
still in the live domain", never "has this entry been overtaken by a verdict".

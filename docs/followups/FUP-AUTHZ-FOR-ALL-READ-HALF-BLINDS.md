# FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS — the `FOR ALL` policies whose read half no keystone exercises, disclosed by ADR 0191 D4 and owed a keystone each

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

**What this is.** ADR 0191 D4 made the door arm's policy sweep open `using (true)` **alone** on a
`FOR ALL` policy, instead of opening `using` and `with check` together. The change is **strictly
weaker**, so the only verdict movement it can produce is **COVERED → BLIND**, bounded by the 51
COVERED `(ALL)` rows in the committed baseline.

⛔ **Each flip is a FINDING, not a regression.** The policy is unchanged; what changed is that the
verdict now says what it always should have said. A row that flips was a `FOR ALL` policy whose
**read** half no keystone exercises, and whose COVERED was earned by a **write** keystone — the
mirror-ambiguity `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` named. ⛔ **A flipped row
is never relabelled to keep it COVERED** (PO ruling, 2026-09-05); it is disclosed here and
keystoned as its own increment.

**How to read the work-list.** Each row carries:

- **policy** — `table.polname (ALL)`, the key `p0-authz-invariant.sh`'s `verdicts_from_findings`
  uses, so a census arm can still find it.
- **write-half fixture** — the pgTAP file(s) named in column 5 of the row's **previous** COVERED
  verdict. Those files reddened when BOTH halves were open, so at least one of them exercises the
  policy's write half. They are the starting point for the read-half keystone, not the answer:
  ⚠ a file that reddened on the write half may have no read assertion in it at all.
- **what a read-half keystone must assert** — a SELECT through the policy that returns rows for a
  principal the `using` qual admits and **zero rows** for one it does not, with the discrimination
  half explicit. ⛔ Not "the query succeeds": a `FOR ALL` policy's `using` clause also gates the
  rows `UPDATE`/`DELETE` can see, so an assertion that only counts rows for the permitted principal
  passes with the qual opened to `true`, which is precisely the state this sweep constructs.

## The work-list

⚠ **To be completed from the full run's merge.** The bound is **0 ≤ n ≤ 51**. The rows are
determined by the one full door-arm run of unit PRED-DOMAIN; a subset run measures only the
policies it names. Until that list is filed here, this entry's claim is the **mechanism and the
bound**, not a row count — and it must not be read as "no policy flipped".

| policy | previous verdict + write-half fixture | what a read-half keystone must assert |
| --- | --- | --- |
| _(pending the full run)_ | | |

## Closes when

Every row above has a keystone that **fails when the policy's `using` half is opened to `true`**,
proven by re-running the door arm's case for that policy and observing the verdict move BLIND →
COVERED. ⛔ Not closed by adding assertions and reading a green suite: a keystone that does not move
this arm's verdict is the vacuity this whole program exists to catch. ⛔ Not closed by the write
arm's coverage of the same policy — that is the ambiguity being separated.

## Related

- ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) D4 / D4a / D4b
- `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` — the follow-up D4 closes
- ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) — a green arm bounds its
  own domain

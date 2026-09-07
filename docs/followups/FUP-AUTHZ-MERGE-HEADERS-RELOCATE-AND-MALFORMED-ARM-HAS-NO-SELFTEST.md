# FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST — a hand table HEADER relocates while two docs say it stays, and MALFORMED has no case

**Filed:** 2026-09-07 (unit PRED-DOMAIN, QA re-review `N1` + `N2`)
**Owner:** backend
**Severity:** medium — neither half can lose a verdict. What both produce is a record that reads as
measured and is not.

## The two findings

### N1 — the merge keeps hand ROWS in place and relocates their HEADER

MEASURED by QA on copies, read-only, with the shipped `scripts/lib/merge-findings-baseline.sh` and
a generator-only `GENERATED` (the committed findings file truncated at its first `## Note`):

| what | measured |
| --- | --- |
| merge exit | **0** |
| the six hand-filed rows | survive **in place, un-indented** |
| `verdicts_from_findings` over them | reads **all six** |
| the two hand table **header lines** | **relocated into the `CARRIED` block, indented** |
| what each section is left with | a `\|---\|---\|---\|---\|---\|` delimiter and **no header above it** |

So the load-bearing property holds: no verdict is at risk, and `ARM=census` still matches every
key. The cost is a reader's, not a census's.

Two documents asserted the opposite, and each now carries a dated correction beside its unedited
original:

- `docs/reviews/authz-door-audit-findings.md`, the note above the three set-valued rows — it said
  the non-generator header and column-4 token keep the table safe, which is true of the rows only;
- ADR 0191 D7 — *"so the merge keeps them as prose, in place"*.

The merge helper's own documented **exception 2** covers hand *rows*. It does not mention hand
*headers*, so the helper is not wrong about itself; the two documents generalized it.

⚠ **This belongs on the could-not-verify list until a real full run confirms it.** QA's `GENERATED`
was synthesized. What must be re-checked the first time the door sweep runs to completion after
this branch lands: the six hand-filed rows are still un-indented and still read by
`verdicts_from_findings`, and whether the two hand table headers survive.

⚠ **The standing self-test has a case that looks like it covers this and does not.**
`merge_scenario "B: hand-written table survives whole"` uses
`scripts/fixtures/door-sweep/merge/B-hand-table.baseline.md`, whose hand header is the
three-column `| gate | evidence | reading |`. The real file's hand tables carry the five-column,
generator-shaped `| gate / policy | arm | direction | verdict (earned elsewhere) | evidence
(baseline note, verbatim) |`. The case has never exercised the shape N1 measured. ⛔ Stating the
shapes differ is not a claim that the shape is the cause — that is what the new case has to
establish.

### N2 — the `MALFORMED` assertion is proven able to fire once, by hand, and nothing re-proves it

`scripts/door-sweep-selftest.sh` is **UNCHANGED** by the loop that added the assertion and contains
**0** occurrences of `MALFORMED`; its total is `PASS 34` before and after. The assertion's ability
to fire rests on one ad-hoc pre/post pair (`SELFTEST=1 MERGE_VERIFY=<pre-repair>` → rc **2** naming
the row; the repaired file → the block absent), which QA reproduced today — so it is real, and
nothing re-proves it on the next change. That is *a detector that finds nothing must be proven able
to find something*, one level up, and it is the same gap the door harness itself had to close with
`emit_result()`'s 8-case arm.

The shipped predicate matches a `.sql` followed by an **ASCII letter**, in **column 5**, on an
**un-indented** `^\| ` row. Its named blind spots, each of which needs its own case:

1. **A suffix whose first character is not an ASCII letter** — a digit, `(`, `[`, `*`, `_`, `-`, or
   any of this tree's `⚠ ⛔ ⭐`. ⚠ The **repaired** row's suffix now begins `. ⚠ **HAND-MERGED`, so
   a future re-attach following the repaired row as its model lands squarely in the blind spot.
2. **A comma-joined suffix** (`…,40_rls.sql,ERROR at whole-policy…`), which reads as one more
   filename. The most likely next corruption, now that "add a separator" is the stated remedy.
3. **A seam after a token that is not `.sql`** — a `.md`, a bare policy name, an extensionless
   file.
4. **A malformed join inside a `CARRIED` row.** Carried rows are indented, and `^\| ` skips them.

⛔ The **disclosed dead end is the more valuable half and it checks out**: deriving the token
alphabet from the artefact under test blinds the detector to `ERROR`, which is precisely the token
this file's column 4 no longer contains. That the shipped instance was caught at all depends on the
damaging suffix beginning with `E`.

## A related hazard, kept here rather than in its own entry

The merge derives its verdict-row grammar (H/V/K) from the **generated** file. If a future
generator ever emits the header text `verdict (earned elsewhere)` or the token
`COVERED (targeted mutation)`, all six hand-filed rows are reclassified, relocated into `CARRIED`,
and leave `verdicts_from_findings`. Neither string appears in the harness today (grep: **0**, **0**)
and **nothing asserts that they never will**. The failure is loud — `ARM=census` reds naming the
gate — rather than silent, which is why it rides here as an observation instead of a separate
follow-up. Surfaced by QA's first, deliberately contaminated, run of the same test.

## Closes when

`scripts/door-sweep-selftest.sh` gains standing cases — each observed **red before** the fix that
makes it green, per the file's own convention — covering:

- **(a) header preservation.** A hand table whose header is the five-column generator-shaped
  `| gate / policy | arm | direction | verdict (earned elsewhere) | evidence (baseline note,
  verbatim) |` survives the merge with its header **un-indented and above its `|---|` delimiter**
  — *or* `docs/reviews/authz-door-audit-findings.md` and ADR 0191 D7 are corrected to say it does
  not, and the case pins the behaviour that actually ships. Either resolution closes this half; a
  document and a merge that disagree does not.
- **(b) one case per named blind spot** of the `MALFORMED` predicate: the non-letter seam (using
  the repaired row's own `. ⚠` among them), the comma-joined suffix, the non-`.sql` token seam, and
  the indented `CARRIED` row.

⛔ **Not closed by re-running the one ad-hoc pre/post pair by hand.** That is the run that already
happened; the finding is about the next change, not this one.

⛔ **Not closed by widening the predicate without a case per widening.** An alphabet derived from
the artefact under test is the dead end this assertion already disclosed, and a wider predicate
with no case is the same instrument with a longer regex.

⛔ **Not closed by "no malformed join in the tree today".** MEASURED 2026-09-07 over every column-5
cell of all five committed findings reports: **1** hit pre-repair (the defect itself), **0** today.
That is the state the standing case is supposed to keep true.

## Related

- ADR [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
  — the merge helper and its self-test.
- ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
  D7 — the re-baseline through the merge; its "keeps them as prose, in place" sentence and the
  dated correction beside it.
- `docs/reviews/pred-domain-rereview.md` §3(d), §5 N1–N2, §7 items 1 and 5 — the measurements.
- LEARN-084 — a detector can be vacuous because of where its inputs come from.

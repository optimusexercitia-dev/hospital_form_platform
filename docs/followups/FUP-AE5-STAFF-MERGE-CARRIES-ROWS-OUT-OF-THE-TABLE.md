# FUP-AE5-STAFF-MERGE-CARRIES-ROWS-OUT-OF-THE-TABLE

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T8; lead ruling L25 added the guard, this is the defect
BEHIND it) · **Owner:** backend
**Severity:** high — the committed door-audit baseline is the domain of the census arm and of every
`FROMFINDINGS` arm. A row that leaves the TABLE stops being read by all of them, silently.
**Status:** open

## The defect, stated precisely

`scripts/lib/merge-findings-baseline.sh` preserves a baseline row the generated report does not
contain — that is its `carried_rows` path and it is correct behaviour for a FULL run over a catalog
that lost a gate. **But it emits the carried row as a bullet plus an INDENTED verbatim quote, not
as a table row:**

```
- `action_item_assignments.action_item_assignments_select (SELECT)` — COVERED -> (absent from this run) — baseline row carried verbatim:

      | action_item_assignments.action_item_assignments_select (SELECT) | policy | open->true | COVERED | 113_case_action_items.sql,… |
```

The information survives. **The machine-readability does not.** Every consumer that reads the
findings *table* — `ARM=census`, the `FROMFINDINGS` arms — stops seeing that gate.

## Measured, on this unit's own gate run

Feeding the helper AE5 T8's subset report (73 rows) against the 353-row baseline:

| counter | before | after the merge |
| --- | --- | --- |
| top-level table rows (`^\|`, no leading space) | 353 | **73** |
| rows incl. indented carried quotes | 353 | 376 |
| `grep -cE '^\|'` (crude) | 367 | 87 |
| BLIND rows in the table | 36 | **0** |

The helper exited **0** and reported *"REPLACED 2 baseline line(s) as regenerated statistics (the
only legitimate drop)"* — true as far as it went, because it does not consider a carried row a
drop. `ARM=census` then went from **23 unknown gates to 205**, which is how this was caught.

⛔ **"303 rows lost" is the wrong description and this file exists partly to correct it** — an
earlier account in this unit said so. Nothing was lost; 303 rows were carried OUT OF THE TABLE.
The consequence is identical for every automated reader, which is exactly why the imprecise
account was believable.

## Why the guard is not the fix

Lead ruling L25 added a subset guard (ABORT when the generated report is missing baseline rows),
and it is scoped to real runs so the helper's own self-test still exercises the carry path
(`SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` after scoping; it failed 5 before). That guard stops a
SUBSET report from being merged. It does **not** address the case the carry path is FOR: a full run
where a gate genuinely disappeared from the catalog. There, one row per vanished gate still leaves
the table, and no counter notices.

## Closes when

A carried row stays a **TABLE ROW** — same five columns, with its "absent from this run" provenance
in column 5 or in an adjacent annotation that is not a substitute for the row — so the top-level
row count of the merge output is never lower than the baseline's, and:

* the helper asserts that itself (`out_rows >= baseline_rows`, printed) and ABORTS otherwise; and
* a self-test scenario covers *a full run where one gate disappeared*, checking the output's
  **top-level** row count, not its prose.

⛔ The self-test must count rows the way the CONSUMERS do — `^\|` with no leading whitespace. A
scenario that counts indented quotes as rows would pass on the current, defective emit: that is the
precise reading error that let this ship, and a parser that counts a quotation as the thing quoted
is what produced a confident "0 rows lost" on a merge that emptied the table.

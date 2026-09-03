# FUP-FINDINGS-MD-PIPE-TABLE-MANUFACTURES-VERDICTS — a prose table inflates `ARM=census` and MASKS a real newcomer (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟠 **FUP-FINDINGS-MD-PIPE-TABLE-MANUFACTURES-VERDICTS** — filed 2026-08-28 at AE2.4 increment 1,
  from a live near-miss caught by re-deriving a delta rather than reading a green.

**Mechanism, measured.** `verdicts_from_findings()`
(`supabase/tests/mutation/p0-authz-invariant.sh:131-134`) is:

```
grep -E '^\| ' "$1" | grep -vE '^\|---|gate . policy' | sed -E 's/^\| *//; s/ *\|.*$//'
```

— **every** `| `-prefixed line in the whole file, first column. It has no notion of *which* table a
row belongs to. So **any** Markdown pipe-table added anywhere in a findings `.md` — including inside
a prose Note section — has each of its rows counted as a **gate carrying a verdict**.

**The near-miss.** An AE2.4 findings note drafted as a table pushed the count from **601 → 607**:
six manufactured verdicts. ⛔ **The direction of the error is the dangerous one**: `ARM=census`
compares live gates against verdicts, so inflation *masks* a real newcomer — the exact failure
census exists to prevent, produced by editing documentation. It was caught only because the author
re-derived the delta and could not attribute six of it; **nothing in any gate would have said so.**

⚠ **This is not a defect in the findings file as it stands** — its verdict tables are pipe-tables
*by design*, which is why the parser is written this way, and why the fix cannot simply be "reject
pipe-tables". The live file was re-checked at filing: the AE2.2 note is prose-only, 0 pipe lines.

**Proposed mechanism (the good one, not the obvious one).** ⛔ Do not "ban tables in notes" — an
unenforceable convention in a file many sessions append to. Instead make the census **cross-check
every extracted verdict name against the live catalog** and report the unresolvable ones. A verdict
naming something that is not a live gate is *always* worth a look: it is either a **parse artifact**
(this bug — the strings would have been `arm`, `direction`, `verdict`) or a **rename orphan** (the
already-recorded hazard, `docs/reviews/authz-door-audit-findings.md` § Note 2026-08-09). One check,
two known failure classes, and it fails **loudly on the inflating direction** rather than silently.

⚠ **Prove it can fire before trusting it** — inject a fake pipe-table row, see it named; remove it,
see it clean. A detector that finds nothing must be proven able to find something.

**Sibling, same family, same day:** a blast-radius sweep was truncated by `head -40` and its output
**read as complete** — the `supabase/tests/` hits, including a RED one, were below the cut. Any
sweep whose output is bounded must print what it dropped (CLAUDE.md §8's *no silent caps*).

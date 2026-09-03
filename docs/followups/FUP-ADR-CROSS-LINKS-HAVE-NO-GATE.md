# FUP-ADR-CROSS-LINKS-HAVE-NO-GATE — 13 broken ADR-to-ADR links, and gate 9 structurally cannot see them (owner: lead/backend; filed 2026-09-02 by `lead`, measured during AE4.9 D6)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**What was measured.** A sweep of every `](./NNNN-*.md)` target across `docs/decisions/` resolved
each against the filesystem: **13 broken**, in 0053, 0056, 0063, 0064, 0072, 0073, 0078 (×5),
0105 and 0177.

**Why no gate catches it.** `npm run adr:index` / `lint:adr-index` (gate 9) parses ADR **headers**
to rebuild `INDEX.md` and the back-pointer column. It never resolves a link **target**. So a
citation naming a file that has never existed is byte-for-byte as green as a correct one, and the
index it regenerates reports success either way — gate 9 said *"back-pointer blocks already
current"* on the same run that left 13 dangling links in place.

⚠ **The failure mode is PLAUSIBLE RECONSTRUCTION, which is what makes it survive review.** Every
broken target is a readable, on-topic slug for the ADR that was actually meant — it names the right
number and a fair description of that ADR's subject. Nothing about it reads as a typo. ADR 0177
cited 0175 as `0175-ae45-differential-oracle-scope-and-f3-discharge.md` **one day after 0175 was
written**, and the real filename is `0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md`. A
reviewer scanning that line sees a sensible reference to a real decision.

⚠ Note the asymmetry with the rest of the ADR contract: the `Amends:`/`Supersedes:` **label** has
no gate either (CLAUDE.md §8 says so outright), so both halves of an ADR's cross-reference graph —
the edge's existence and the edge's target — are unenforced. The index's *back-pointer column* is
derived from the label, so a wrong-but-plausible filename in a `Relates:` line degrades silently
while the index still renders.

**⛔ What was NOT done, and why.** Only the **two AE4-phase instances** (0177 and 0178) were
repaired, both verified to resolve afterwards. The other **11 predate this phase and are untouched
by ruling** — repairing them here would bury an unrelated 11-file documentation diff inside an
authorization gate, and a diff whose stated subject is authz should not silently carry it.

⭐ **A SECOND, INDEPENDENT BLINDNESS IN THE SAME GATE, found 2026-09-02 while writing ADR 0178:
BOLD EMPHASIS INSIDE A LABEL VALUE CAN SWALLOW THE *NEXT* LABEL.** `parseLabels`' regex
`/\*\*\s*([A-Za-z][^*
]{1,44}?)\s*(:?)\s*\*\*(\s*:)?/g` pairs `**` marks positionally. A bold
phrase in one label's value leaves a closing `**` that pairs with the OPENING `**` of the next
label, consuming it — the label then does not exist as far as the parser is concerned.

Concretely: 0178's `**Implements:**` value contained `**regression was discovered by the build**`,
and the `**Amends:** 0175` two lines below **did not parse**. `parseLabels` returned
`Status | Implements | Relates`, `parseEdges` returned `[]`, and `npm run adr:index` printed
**"back-pointer blocks already current"** — a success message — while writing `– | –` in the
⚠ Changed-by column. Removing the two `**` pairs was the entire fix; the edge then resolved to
`{verb: amends, target: 0175}` and the back-pointer landed in 0175.

⛔ **Why this is worse than the broken-link half.** A broken link is visible to a reader who clicks
it. A swallowed label is visible to **nobody**: the ADR looks correct (the label is right there in
the header), the index renders a normal row, and the generator reports success. The only symptom is
an empty column that also means "this ADR legitimately amends nothing" — ⭐ **the failure state and
the healthy state are rendered identically.** And per CLAUDE.md §8 the label is the ONLY input to
that column, so the target ADR never learns it was amended.

⚠ Two false leads recorded so a re-investigation does not repeat them: `NOTHING_RX` is `^`-anchored,
so an `Amends:` value containing the word "not" is NOT skipped; and a bold-plus-colon phrase in a
value (`**no gate can notice it missing**:`) does create a phantom label but was NOT the cause here.
⛔ Both were tested and disproved before the real cause was found — do not "fix" on either.

**Durable form for this half:** assert in gate 9 that every ADR whose body text says it amends or
supersedes another parses a matching edge; or make `parseLabels` require a label to start a line.
⚠ The second is the smaller change but would reclassify existing mid-line labels the parser
deliberately accepts (its own comment names `... always implied). **Supersedes:** nothing.`), so it
is not a free tightening.

**The durable form.** A target-resolution check inside gate 9: for every `](./NNNN-*.md)` in
`docs/decisions/`, assert the file exists. ⚠ It will **red on those 11** the moment it is added, so
adding the gate and repairing the 11 are one work item, not two — and it must not be added
mid-phase, or it blocks Gate AE4 on unrelated debt. ⛔ A gate that is added and immediately
allowlisted past its own findings is worse than none: it converts 11 visible defects into one
invisible exception.

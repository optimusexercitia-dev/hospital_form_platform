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

## ⭐ 2026-09-08 — the class is REPRODUCING ONCE PER BATCH, measured on two consecutive ADRs

Added at unit WRITEPATH-BASELINE's pre-merge documentation audit. The 13 measured 2026-09-02 were a
**snapshot of accumulated debt**; this is the newer and worse fact — **the defect is still being
manufactured, at a rate of roughly one per batch, by writers who know about this entry.**

Two consecutive ADRs from the pre-AE5 remediation batches cite the same ADR 0171 under **two
different wrong filenames**, neither of which has ever existed:

- `0191-…md:20` cites `./0171-c2-tier-2-deferred.md` — Batch 2. ⛔ **Not repaired**: 0191 is merged,
  and a one-line link fix inside a merged unit is not free (it re-opens the unit's diff).
- `0192-…md:16` cited `./0171-c2-command-doors-are-a-separate-deferred-sweep.md` — Batch 3,
  **introduced by that unit**, i.e. *after* this entry existed. **Repaired 2026-09-08** to the real
  file, `0171-c2-tier1-regrain-and-the-command-door-neutralizer.md`.

⭐ **Why two writers produced two different wrong names for one file, independently.** Both wrote a
**plausible reconstruction** of what 0171 is *about* — "tier 2 deferred", "command doors are a
separate deferred sweep" — because both had read its content and neither re-read its **filename**.
That is the same mechanism this entry already names, seen at its moment of creation rather than in
the aftermath: ⚠ the target is *semantically* correct and *lexically* invented, so it survives every
review that reads for sense. The real filename (`…tier1-regrain-and-the-command-door-neutralizer`)
describes a *different* facet of the same ADR than either citation chose, which is precisely why
neither writer's memory reproduced it.

⭐ **The phantom-label half is no longer a "tested false lead" — it is MEASURED on a live ADR, with a
discrimination half, and gate 9 stays green.** Recorded 2026-09-08, because repairing the 0192 link
above meant editing an ADR **header**, which is exactly where this blindness lives — and the first
draft of that repair contained `"**Owed:**"` inside the `**Related:**` value, i.e. ⚠ **this defect was
reproduced while fixing its sibling, in the same header, in the same edit.** It was caught by hand
before commit and the note rewritten with no bold at all. What the plant then showed, run on the real
file and reverted (`cmp` byte-identical afterwards):

- **clean (committed)** → `parseLabels` returns **5** labels, `parseEdges` returns the 2 real edges,
  `npm run lint:adr-index` bare **rc 0**.
- **planted (`**Owed:**` inside the `Related:` value)** → `parseLabels` returns **6** — a phantom
  `Owed` label materialises — `parseEdges` still returns the same 2 edges, and
  `npm run lint:adr-index` is bare **rc 0** with the message `OK (190 ADRs indexed)`.

⛔ The green is **not** the plant failing to apply: the label count moved 5 → 6, so the mutation is
proven live and the gate is proven blind to it. The edges are unchanged here only because `Related:`
is the **last** label in 0192's header, so there was no following label for the stray `**` to swallow
— ⚠ **which means the severity of this defect depends entirely on where in the header it lands**, and
nothing tells an author that. The same phrase one label higher is the 0178 failure: a real
`**Amends:**` silently not parsed, `adr:index` printing success, and ⭐ *the failure state and the
healthy state rendered identically*.

⚠ **Consequence for the durable form, and it strengthens the case rather than complicating it.** The
"repair the 11 and add the gate as one work item" plan was sized against a **fixed** backlog. The
backlog is **growing**, so the gate's arrival date sets the size of its own red — and every batch
that ships without it adds roughly one. ⛔ Still do not add the gate mid-phase (it reds on the
untouched pre-existing instances and would block an unrelated unit); the inter-batch window remains
the only time. ⛔ And a same-day repair like 0192's ⚠ **is not evidence the class is contained** — it
was caught by a hand audit, not by any gate, and the identical defect one ADR earlier went unnoticed
through a full QA review, a PO approval and a merge.

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

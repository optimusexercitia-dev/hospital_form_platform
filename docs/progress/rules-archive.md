# Rules archive — retired `.claude/rules/` entries

Where a rule goes when it stops being true. `npm run lint:rules` (gate 8,
`scripts/check-rules-staleness.mjs`) reds when a rule's `paths:` glob matches nothing or
an `anchors:` entry no longer resolves; the disposition is **repoint it, or retire it
here**. A rule is never deleted outright — same discipline as every other rotation in
`docs/progress/`.

**Retiring a rule**

1. Append the rule file's full text here **verbatim**, under a dated heading, with the
   reason it stopped being true (the renamed symbol, the deleted file, the superseding ADR).
2. Delete the file from `.claude/rules/`.
3. Re-run `npm run lint:rules` — the finding is gone because the rule is gone, not
   because the check was loosened.

**Why a rule can go stale and nothing notices.** A rule has no resolution event: nothing
ever closes it. Path-scoped, it is also invisible until it fires, so a rule describing a
symbol that was renamed two months ago keeps loading and keeps being believed. That is
the gap the anchors exist to close, and this file is where the closure lands.

---

_No rules retired yet._

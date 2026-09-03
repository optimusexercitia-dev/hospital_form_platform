# FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS — the cap that binds is the one the gate never reports (owner: lead; **filed 2026-08-21 after a one-line rule edit came within 31 bytes of redding the gate**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

⭐ **THE OBSERVATION.** ADR [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md) bounds
a `.claude/rules/` rule two ways — `paths:` may match ≤ **40** files (waivable with `broad:`) and the
file may be ≤ **2048** bytes. Measured across the whole population today, the two caps do not bind the
same rules, and they do not bind in the same direction:

| rule | bytes free (cap 2048) | files matched (soft cap 40) |
|---|---|---|
| `answer-maps.md` | 1277 | 4 |
| `radix-dialogs.md` | 1187 | 3 |
| `ui-copy-forbidden-strings.md` | **92** | 5 |
| `progress-contract.md` | **68** | **125** — waived in writing by `broad:` |

Reproduce: byte counts are `wc -c .claude/rules/*.md`; matched counts are
`paths.reduce((n,g) => n + globSync(g).length, 0)`, the same expression
`scripts/check-rules-staleness.mjs:120` uses.

⛔ **The two rules with almost no byte headroom are the two nobody would call broad**, and the one
that genuinely IS broad (125 files, 3× the soft cap) has that cap **permanently waived** by its
`broad:` declaration — so for that rule the byte cap is the *only* live bound, and it is at 97 %.

## Why this is a gap and not a curiosity

**The gate's success line reports NEITHER number:**

```
check-rules-staleness: OK (4 rule file(s), anchors + globs resolve)
```

Its failure messages each name only the cap that broke (`:124` for files, `:140` for bytes). So there
is **no warning band at all**: a rule at 2047 bytes and a rule at 771 bytes produce byte-identical
output, and nobody learns a rule is one line from unmaintainable until the edit that breaks it. The
proximity is invisible precisely while it is still cheap to act on.

⚠ **Concrete instance, which is why this is filed rather than observed.** On 2026-08-21 adding ONE
path line to `ui-copy-forbidden-strings.md` took it from 1963 → 2017 bytes, leaving **31 bytes**. The
gate said `OK`. Nothing in that output distinguished it from a rule with 1277 bytes spare. It was
caught only because the byte count was measured by hand while checking the *other* cap — the one the
instruction had asked about.

## Shape of a fix — ⛔ FILED, NOT BUILT

A gate change needs its own decision; this is not that decision, and it is out of scope for the round
that surfaced it. Two candidate shapes, both cheap:

- **Report both headrooms** on success, per rule — `name: 92 B free, 35 file slots free`.
- **Report whichever is tighter**, as a percentage of its cap — one number per rule, and it is
  automatically the one that matters.

The second is probably right: it is a single figure, it cannot be read as "the other one is fine",
and it makes the `broad:`-waived case behave correctly on its own (a waived file cap simply stops
competing to be the tightest).

⚠ **What a fix must NOT do:** turn proximity into a failure. These are soft caps for a reason —
redding a green build because a rule is at 96 % converts a nudge into a blocker and invites exactly
the wrong response, which is trimming the codified lesson to fit. Visibility is the ask, not
enforcement.

# FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-11 · status open

**The finding.** Appending this unit's slice to `docs/backend-state/authorization-and-audit.md`
moved the file from **155.1 KB** to **160.0 KB**, and gate 16 (`npm run lint:backend-state`) now
prints `WARN — [D] … is over the 160 KB warn line (cap 200 KB). Plan the next seam.` The gate
still exits **0** — the warn line is a warning by design and the cap is 200 KB — but the file is
also the largest of the fifteen seams, its `## Current state` block sits at **97 of the 100-line
ratchet** (3 left; the two edits this unit made cost 1 line net after paraphrase), and every
pre-AE5 unit since Batch 9 has appended to it. ⛔ Re-derive both figures from the gate's own
output line before acting; do not quote these.

**Why it is a follow-up and not a fix here.** The README's rule for an over-warn file is *"plan the
next seam"* — a split along the seam axis (ADR 0196), which is a lead + PO decision about WHICH
noun leaves this file (the audit trail? the privilege budget? the `authz` catalog?), not a
mechanical move. ⛔ A move rebases every relative path in the moved text and a `MISSING = 0` link
check is silent on whether content still POINTS anywhere (LEARN-090); doing that inside a unit
whose scope is oracle vectors would be the same silent widening Batch 10 refused for a comment.
⛔ The cap and the ratchet may only be LOWERED — raising either is not an option.

**Closes when:** the PO names the noun that leaves and a docs-only unit (or the next backend unit
that touches this seam) lands the split: a new routed seam file with its own scaffolded
`## Current state`, the README router updated, gate 16 exit 0 with **no** `[D]` warning on
`authorization-and-audit.md`, and the moved slices' relative links checked by a run, not by eye.
⚠ Until then, every further append to this file owes a paraphrase cut, never a bound (README
§ The four rules a gate CANNOT enforce, rule 4).

**Origin.** Filed at unit `AE5-MATRIX-ARM3-CELLS`'s Record-step preparation (the authz seam slice
for the arm-3 oracle); full record:
[`docs/progress/ae5-matrix-arm3-cells.md`](../progress/ae5-matrix-arm3-cells.md).

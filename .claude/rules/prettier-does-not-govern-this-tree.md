---
paths:
  - "src/**"
  - "PROGRESS.md"
  - "CLAUDE.md"
  - "docs/progress/**"
broad: >-
  The subjects ARE whole trees, and the rule must load while they are being edited — the only
  moment the formatter can still be run.
anchors:
  - .prettierignore
  - .prettierrc.json#singleQuote
  - package.json#format:check
  - docs/decisions/0124-progress-live-state-contract.md
source: >-
  CLAUDE.md §8, rotated 2026-08-27 (PO-approved) to fit the eleventh lint gate under the 40 KB
  cap; a standing prohibition with no resolution event. Cost of the scoping: docs/progress/authz-ae1.md.
---

# ⛔ Prettier does not govern this tree — in two opposite directions

## Tracker docs: Prettier is configured OFF, and obeying it is the defect

`.prettierignore` carries `PROGRESS.md`, `CLAUDE.md`, `docs/progress/`. Prettier pads every
Markdown table cell to its column's widest: reformatting the live PROGRESS.md (60 KB, measured
2026-08-20) pads it to **~75 KB, inside 5 KB of the 80 KB target `lint:progress` warns at**
(hard cap 100 KB). **Formatting the file erodes the headroom the gate exists to protect**, and
the margin only shrinks as the file grows.

The same padding on CLAUDE.md is context tax on every spawn. `docs/progress/` is excluded so
PROGRESS.md's **verbatim** rotations stay byte-identical to their destination.

⛔ **Never add a "check these against Prettier" rule — obeying it is the defect.**
`npm run format:check` is manual: no hook, no CI, not a lint gate.

## `src/`: NOT in `.prettierignore`, and that is the trap

That tree is written shadcn-style (double quotes, semicolons) while `.prettierrc.json` is
`semi:false, singleQuote:true`. `prettier --write` on one component **rewrites the whole file
away from its neighbourhood** and buries the real change in noise — hit for real 2026-08-25,
restored by hand. Nothing ignores it and **no gate catches it**, because the formatter is not
wrong; it disagrees with the tree.

**Never run Prettier on `src/`.**

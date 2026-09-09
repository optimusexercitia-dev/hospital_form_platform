# FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD — gate 12 still resolves from `process.cwd()`

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Detail.** `check-budget-anchor.mjs` was hardened on 2026-09-08 to resolve from THIS FILE rather
than `process.cwd()`, and its header records that the same hardening was applied to gate 14 "at the
sibling site it was NOT applied to". ⛔ **There is a third sibling and it was missed:** gate 12 still
opens with `const ROOT = process.cwd()`.

⚠ **MEASURED 2026-09-09, not predicted, and the consequence is worse than the sibling's was.** Gate
15 run from the wrong directory exited 1 with a *false* "does not exist" message. Gate 12 run from
`docs/` exits **2 with a `node:internal/modules/cjs/loader` stack trace** — its `createRequire`
lookup of `typescript` fails before any of its own checks run. A reader meeting that cannot tell a
broken checker from a broken repo, which is the exact confusion the gate-15 hardening was for.

⛔ **Not a hole.** Under `npm run lint` the cwd is always the package root, so the gate has never been silently skipped; it fails loudly in both directions. This is an ergonomics and attribution
defect, filed because *a fix correct at two of three sibling sites reads as a fix*. ⚠ **Second
instance, same gate (QA m6, 2026-09-09):** with its subject file removed gate 12 exits 1 on a raw
`node:fs` ENOENT stack, where gate 15 prints *"…does not exist. That file is the ceiling's ONE HOME;
a missing subject is a finding, never a pass."* Same closure covers both: resolve from this file AND
report an absent subject in words.

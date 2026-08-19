# ADR 0124 — PROGRESS.md live-state contract, machine-enforced

- **Status:** accepted (PO, 2026-08-18)
- **Context:** PROGRESS.md (75 KB, loaded by every spawn) carried phases completed in
  June, its maintenance rules lived in prose, and each clause was violated while
  green — its own banner's size claim went stale three times, rotations 404'd 474
  links and nearly destroyed seven follow-ups, and formatting drifted per session.
- **Decision:** PROGRESS.md holds **live state only**; an entry leaves at the §6
  Record step that concludes it. Completed phase rows move **verbatim** to
  `docs/progress/phase-ledger.md` (append-only — the "rows never leave" rule
  transfers there); resolved follow-up index lines to `follow-ups-archive.md`. The
  contract (≤ 60 KB — PO sized; no completed rows; no resolved index lines; link +
  `FUP-*`-body integrity; required sections; LF) is enforced by
  `scripts/check-progress-doc.mjs` as **gate 7 of `npm run lint`**, self-red-proving
  every checker per run. `*.md text eol=lf` in `.gitattributes` retires the CRLF
  class. CLAUDE.md gets a review cadence: a `Stop` hook queues correction signals
  per session (`.claude/claude-md-review-queue.md`, gitignored), consumed by the
  `/review-claude-md` skill — which must still ask before editing CLAUDE.md.
- **Consequences:** every spawn pays ~45 KB less context; the rotation discipline is
  told-by-a-gate instead of remembered; lead-playbook §5 carries the standing
  rotation mechanics (byte-compare, mechanical link transform, property-bounded
  moves). Bodies of the 14 index lines rotated 2026-08-18 remain in `follow-ups.md`
  pending a later body-rotation pass.

## Amendment 1 — the "loaded by every spawn" premise was false (2026-08-19)

- **Status:** accepted (PO, 2026-08-19)
- **Correction.** This ADR's Context says PROGRESS.md is *"loaded by every spawn"* and its
  Consequences claim *"every spawn pays ~45 KB less context."* **Both are false, and were
  never true.** PROGRESS.md has never been `@`-imported: `git grep '^@[A-Za-z./]' -- '*.md'`
  is empty, `git log --all -S'@PROGRESS' -- CLAUDE.md` is empty, and a session's start
  context contains the two CLAUDE.md files plus the auto-memory index — no PROGRESS.md.
  Teammates receive CLAUDE.md plus their `.claude/agents/*.md`, which *mention* the file
  without importing it. It is read **on demand**.
- **What is actually always-loaded** (measured 2026-08-19): project `CLAUDE.md` 32 KB +
  auto-memory `MEMORY.md` 20 KB ≈ **52 KB**. Cutting PROGRESS.md buys nothing at session
  start; cutting CLAUDE.md buys on every session *and* every teammate spawn.
- **The cap survives, its justification changes.** ≤ 60 KB is retained — justified by
  **read cost and editability**, not load cost. A monotonic ratchet was considered and
  **declined**: it fails the gate whenever new live state is recorded, and the cheapest way
  to pass would be trimming the OPEN index — the pressure §7 exists to forbid.
- **New rotation destination: `.claude/rules/`.** A follow-up or bug note whose content is a
  standing prohibition has **no resolution event**, so it can only accumulate. Those rotate
  to a path-scoped rule file (ADR 0127). ⚠ Unlike every other rotation this is a **rewrite,
  not a verbatim move**, so `cmp` cannot verify it — the provenance requirement replaces it:
  the original prose goes verbatim to its normal archive, and the rule names its `source:`.
- **Link-checking follows the content.** `LINK_CHECKED_DOCS` now covers the rotation
  destinations. It was PROGRESS.md + CLAUDE.md only, and at the moment the destinations were
  added **41 links were already broken** in two of them — root-relative `docs/...` paths
  carried verbatim into `docs/progress/`. Rotating into a file nothing link-checks is the
  mechanism behind this repo's standing rotation defect.
- **Deliberately NOT changed:** the same false sentence in
  `scripts/check-progress-doc.mjs`'s header. The PO ruled the correction scope as this ADR
  plus the PROGRESS.md banner; the script comment stands, and no gate covers it.

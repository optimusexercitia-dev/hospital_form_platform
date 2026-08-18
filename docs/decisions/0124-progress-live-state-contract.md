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

---
name: review-claude-md
description: Process the CLAUDE.md review queue (.claude/claude-md-review-queue.md, filled by the Stop hook) and propose CLAUDE.md / lead-playbook updates while the gaps are fresh. Use when the user asks to review CLAUDE.md, process the review queue, or check whether project instructions have gone stale.
---

# Review CLAUDE.md against queued session signals

The Stop hook (`scripts/claude-md-review-signal.mjs`) appends an entry to
`.claude/claude-md-review-queue.md` whenever a finished session contained correction
or staleness signals — the moments that usually mean CLAUDE.md taught the session
something wrong, or failed to teach it something it needed. This skill turns that
queue into reviewed, human-approved documentation fixes.

## Procedure

1. **Read the queue.** If `.claude/claude-md-review-queue.md` is missing or empty,
   say so and stop — do not invent review work. Each entry has a session id, a
   transcript path, and the matched excerpts with their signal names.

2. **For each entry, find the real lesson, not the excerpt.** Open the transcript at
   the matched messages and read enough surrounding turns to answer: *what did the
   session believe that was false, and where did that belief come from?* Classify:
   - **CLAUDE.md taught it** — a claim in CLAUDE.md (or a doc it points to) is stale
     or wrong. This is the highest-value class; CLAUDE.md itself says a stale
     CLAUDE.md is worse than a missing one.
   - **CLAUDE.md was silent** — the session re-derived (or mis-derived) something
     every session needs. Candidate for a new line — but CLAUDE.md is loaded by every
     spawn, so the bar for ADDING is high: prefer pointing to an existing doc over
     inlining detail.
   - **Not a doc problem** — a one-off mistake, or something already recorded
     (memory, ADR, archive). No edit; note why.

3. **Verify before proposing.** Every claim you would add or correct gets checked
   against the current truth source first — the catalog for anything SQL/RLS (never
   file text), `package.json` for gate lists, the live file for section names. Do not
   propose a fix copied from the transcript's wording; re-derive it.

4. **Propose diffs, then ASK.** Present the proposed CLAUDE.md / lead-playbook /
   ARCHITECTURE.md edits as concrete before/after diffs with a one-line rationale
   each, tied to the queue entry that motivated it. **CLAUDE.md's own rule applies:
   always ask before changing CLAUDE.md** — never apply these edits without explicit
   approval in this conversation. Non-trivial decisions still get an ADR.

5. **Clear what you processed.** After the user rules on the proposals (including
   "no change"), delete the processed entries from the queue file, leaving any
   entries you did not get to. A processed entry whose lesson was declined is still
   processed — record the decline in the proposal summary, not the queue.

## Guardrails

- Never edit CLAUDE.md, ARCHITECTURE.md, or PHASES.md without explicit approval.
- Never treat a queue excerpt as truth — it is a pointer to a conversation, and the
  conversation may itself have been wrong (verify against the live system).
- Keep CLAUDE.md lean: for every proposed addition, name what it points to instead of
  inlining, and consider whether an existing line can carry it.
- If the queue shows the same lesson recurring across sessions, say so — recurrence
  is the strongest evidence a doc fix (not a memory) is the right home.

---
name: handoff
description: Write, update, or resume a session handoff — the resume artifact a fresh session reads when this one is paused for context exhaustion, a machine switch, or a phase boundary. Use when the user asks for a handoff, says the context is getting full or that they are pausing, when work must move to another session or worktree, or when a fresh session should pick up in-flight work from docs/handoffs/.
---

# Session Handoff

A handoff is the artifact that lets a **cold session** — one holding CLAUDE.md,
MEMORY.md and nothing else — resume a **paused** task. That is its only job.

It has exactly one reader, one use, and a lifetime bounded by a `branch:` or an
`expires:` date. It is **not** a status record (the unit's hub,
`docs/features/<code>.md` § Current state), **not** a detail record with witnesses
(the unit's progress record, `docs/progress/<code>.md` § Session log), **not** a
decision record (an ADR), and **not** a design document (`docs/plans/` or
`docs/design/`). ADR 0186 D3.

## ⛔ The load-bearing rule: a handoff may not be cited

**Nothing may link *to* a handoff.** The moment another document cites it, it has
stopped being ephemeral resume-state and become a reference document — and it can
never be swept again.

This is not hypothetical: a resume note once acquired 29 inbound links and became a
mandatory read; another sat stale for six weeks with nothing able to contradict it.
Same cause both times — no rule said which genus the file belonged to.

**So: if something in a handoff is worth keeping, it has exactly one other home —
promote it there and leave a pointer.** The rule of thumb: a line carrying a *state
word* (done, in progress, blocked, next) belongs in the hub; a line carrying a
*witness* (a command, a SHA, a file:line, an exit code) belongs in the record.

| Content | Home |
| --- | --- |
| Summary of state | the unit's hub `docs/features/<code>.md` § Current state |
| Witnesses — what was verified, gate runs with exit codes, dead ends, decisions made in flight, open questions | the unit's progress record `docs/progress/<code>.md` § Session log: one dated `### YYYY-MM-DD — …` subsection per session, **appended** as the session runs, never cut in at the end |
| A decision, with its rationale | an ADR in `docs/decisions/` (+ `npm run adr:index`) |
| An open item with no resolution event yet | one entry in `docs/followups/follow-ups-open.md` |
| A bug | one row in `docs/bugs/BUGS.md` |
| A durable fact about the backend surface | `docs/backend-state.md` |
| A standing prohibition | `.claude/rules/` (CLAUDE.md §8 admission bar) |
| A design or audit narrative | `docs/plans/` or `docs/reviews/` |

If you cannot promote it and you cannot delete it, you have written a design
document and misnamed it. Move it out of `docs/handoffs/`.

## Location and lifetime

- **Path:** `docs/handoffs/<code>-<date>.md` (`<code>` = the hub's id, or a slug for
  hubless work). **Not `docs/progress/`** — that tree holds the citable detail
  record, and parking an ephemeral file there is the entanglement this rule prevents.
- **Mandatory: `branch:` or `expires:`, exactly one.** A unit with a hub carries
  `branch:` equal to the hub's `branch:`; hubless work (a spike, an audit, a one-off)
  carries `expires:` (ISO date) instead. Neither present, a `branch:` gone, or an
  `expires:` date already past, is a finding — gate 13's HANDOFFS arm.
- **Deleted when the task resumes, or when the branch lands — whichever is first**,
  in the same commit as the Phase Gate §6 step-5 Record step's other rotations. ⛔
  **Closed:** the reading where a landed branch's handoff gets *renamed* into the
  branchless `expires:` form instead of deleted — a landed unit's handoff is
  **deleted**, never renamed, since its content is already in the hub and the record.
- **Hard cap 24 KB** — read into a fresh context; growing past that means it is a
  design document that escaped. Cut narration and restatement to fit, never a
  qualifier, a date, or a verified/unverified label: compression to a cap selects
  against qualifiers, so what survives reads more confident than what was measured.

## Writing one

**Trigger only at the pause** — context exhaustion, a machine switch, a phase
boundary. Not before, and not as a running diary. **The witnesses go into the record
first**: what was verified (its command, SHA, or `file:line`), each gate's ARM +
exit code, and every dead end should already be appended dated entries in
`docs/progress/<code>.md` § Session log, written as the session ran. The handoff
does not restate any of that; it points at the entry. Writing one cold, from memory
of a session that logged nothing, makes you the least reliable narrator available —
say so on the Trust line if it happens.

### Template

```markdown
---
branch: feat/<slug>        # required when the unit has a hub — equals the hub's branch:
expires: YYYY-MM-DD        # required instead for hubless work — gate reds once past
task: <program / phase id>
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: live | consumed
---

# Handoff — <task>

## ▶ RESUME HERE
<one paragraph: what was mid-flight when the session paused, and the single next
command to run>

## Trust
What in the tree is verified vs. written-but-unverified. Point at the record's
latest `### YYYY-MM-DD` entry (`docs/progress/<code>.md` § Session log) — do not
copy it here.

## Tree
Branch, HEAD `sha`, dirty files, worktree path.

## Next command
\`\`\`bash
<the literal command>
\`\`\`
```

Every other section the old template carried is record or hub material now: Goal and
scope boundary → the hub's Objective; State (Done-VERIFIED / UNVERIFIED / Not
started) and the Gates table → the record's dated entries (ARM, SHA, exit code);
Dead ends → a record entry; Decisions made in flight → an ADR; Open questions /
blockers → `follow-ups-open.md` or the hub's Blockers line; the Re-derivation
appendix → the witness commands already inside the record's entries.

### Anti-patterns

- ⛔ **No pasted code blocks.** The successor can read the file; cite `file:line`.
- ⛔ **No restating CLAUDE.md, ARCHITECTURE.md, an ADR, the hub, or the record.** Cite them.
- ⛔ **No status.** Status is the hub's; a second copy drifts from it.
- ⛔ **No pronouns pointing at the conversation** — no "as discussed", "the approach
  we chose", "that bug". The reader was not there.

## RESUME mode

1. **Read the handoff** — what was mid-flight, and the next command.
2. **Read the hub** (`docs/features/<code>.md` § Current state) — status truth, not
   the handoff, and it may already reflect a ruling the handoff predates.
3. **Read the record's latest `### YYYY-MM-DD` entry** (`docs/progress/<code>.md`
   § Session log) — the witnesses: what was verified, gate exit codes, dead ends.
   Re-measure anything you are about to act on before trusting it: a confident
   reading is not a measured one — stale text always errs *tighter*, so it reads as care.
4. **Delete the handoff once resumed, and say so.** A `status: consumed` file left
   in place is indistinguishable from a live one to the next `find`.

## Sweeping stale handoffs

A handoff is stale when its `branch:` is merged or gone, or its `expires:` date has
passed. Both are checkable without opening the file.

```bash
for f in docs/handoffs/*.md; do
  b=$(sed -n 's/^branch: //p' "$f" | head -1); e=$(sed -n 's/^expires: //p' "$f" | head -1)
  [ -n "$b" ] && ! git rev-parse --verify "$b" >/dev/null 2>&1 && echo "STALE: $f (branch $b gone)"
  [ -n "$e" ] && [ "$(date +%F)" '>' "$e" ] && echo "STALE: $f (expires $e passed)"
done
```

⚠ **Before deleting, check inbound links** — a handoff that acquired citations has
violated the no-citation rule and must be promoted, not swept:

```bash
grep -rl "$(basename "$f")" --include="*.md" --exclude-dir=node_modules . | grep -v "^./$f$"
```

**Gated since ADR 0185, mechanics updated by ADR 0186 D3** — the HANDOFFS arm of
`npm run lint:registers` (`scripts/check-docs-registers.mjs`, gate 13) reds on: over
24 KB; neither `branch:` nor `expires:` present; a `branch:` gone; an `expires:`
already past; or an inbound citation from anywhere except another handoff or a
review file. The sweep above is the manual form for a branch you are about to
delete. ⚠ The gate checks these properties, never whether the handoff is *true* —
that is the Trust section's job.

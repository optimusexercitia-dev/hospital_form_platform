---
name: handoff
description: Write, update, or resume a session handoff — the resume artifact a fresh session reads when this one is paused for context exhaustion, a machine switch, or a phase boundary. Use when the user asks for a handoff, says the context is getting full or that they are pausing, when work must move to another session or worktree, or when a fresh session should pick up in-flight work from docs/handoffs/.
---

# Session Handoff

A handoff is the artifact that lets a **cold session** — one holding CLAUDE.md,
MEMORY.md and nothing else — resume in-flight work without re-deriving it.

It has exactly one reader, one use, and a lifetime bounded by its branch. It is
**not** a status record (that is PROGRESS.md), **not** a decision record (that is an
ADR), and **not** a design document (that is `docs/plans/` or `docs/design/`).

---

## ⛔ The load-bearing rule: a handoff may not be cited

**Nothing may link *to* a handoff.** The moment another document cites it, it has
stopped being ephemeral resume-state and become a reference document — and it can
never be swept again.

This is not hypothetical. `docs/progress/authz-handoff.md` was written as a resume
note; it now carries **29 inbound links**, including CLAUDE.md §5, which makes reading
it **mandatory before any authz work**. It is permanent. Meanwhile
`docs/progress/HANDOFF.md` sat for six weeks asserting *"Read this first when
resuming"* over a branch that had long since merged, and nothing in the file could
contradict it.

Both failures have the same cause: no rule said which genus the file belonged to.

**So: if something in a handoff is worth citing, PROMOTE it out and leave a pointer.**

| Content | Promote to |
| --- | --- |
| A decision, with its rationale | an ADR in `docs/decisions/` (+ `npm run adr:index`) |
| An open item with no resolution event yet | one entry in `docs/followups/follow-ups-open.md` (never PROGRESS.md — ADR 0179) |
| A bug | one row in `docs/bugs/BUGS.md` (a `docs/bugs/<ID>.md` file when severity ≥ high) |
| A durable fact about the backend surface | `docs/backend-state.md` |
| A standing prohibition | `.claude/rules/` (see CLAUDE.md §8 admission bar) |
| A design or audit narrative | `docs/plans/` or `docs/reviews/` |
| Status of anything | the unit's hub `docs/features/<code>.md` § Current state — never the handoff, never PROGRESS.md |

If you cannot promote it and you cannot delete it, you have written a design
document and misnamed it. Move it out of `docs/handoffs/`.

---

## Location and lifetime

- **Path:** `docs/handoffs/<branch-slug>.md` — one per branch, committed on that branch.
- **Not `docs/progress/`.** That tree is gated by `lint:progress`'s link sweep and is
  where citable records live; putting an ephemeral file there is what entangled the
  existing ones.
- **Lifetime = the branch.** A handoff whose branch is merged or gone is stale **by
  definition, checkable from outside the file** (`git branch --list`). No judgement call.
- **Deletion is part of the Phase Gate §6 step-5 Record step**, in the same commit as
  the other rotations — the same discipline, and the same chronic failure mode, as
  PROGRESS.md rotation.
- For work with no branch (a spike, an audit), use `docs/handoffs/<slug>-<YYYY-MM-DD>.md`
  and set an explicit `expires` date in the frontmatter.

---

## WRITE mode

### Trigger early — this is the whole game

⛔ **A session writing its first handoff at 80% context is the least reliable narrator
available.** It reconstructs the story from the rotted context that caused the pause,
and the successor inherits its drifted beliefs with nothing able to contradict them.

- **Create the file at the first non-trivial decision**, not at the wall.
- **Append at each event**: a decision, a dead end, a gate run, a scope change, a blocker.
- The final write is then a **compaction of an existing file**, never a reconstruction.
- If you are nevertheless writing this cold at high context, **say so on the trust
  line** — the successor needs to know how much of the document is memory.

### Every claim carries a witness

A handoff that states conclusions produces a successor who believes them forever. This
repo's founding methodology finding is that file text is stale and only measurement is
truth; a handoff is the easiest place in the project to launder a belief into a fact.

Partition the state **three ways** — never a flat list:

- **VERIFIED** — the claim, plus the *command or `file:line` that produced it*, plus when.
- **BELIEVED** — asserted but unmeasured. Say what would settle it.
- **UNKNOWN** — named explicitly. An unnamed unknown reads as covered.

Repo-specific witness rules:

- **SQL / RLS / RPC / authorization** — the witness is a **catalog query**
  (`pg_proc` incl. `prosecdef`, `pg_policies`, ACLs). ⛔ Never a migration file, never
  graphify: CLAUDE.md's binding exception. A migration diff is what a phase *intended*.
- **Gates** — name the **ARM**, never the script (`ARM=census` / `hat` / `floor` /
  `wrapper`), the SHA it ran at, and its **exit code**. Name the arms that did **not**
  run. Absence of a verdict is not absence of coverage.
- **Tree state** — a SHA, plus clean/dirty. Without a SHA the successor cannot diff the
  described world against the real one, and every claim becomes unfalsifiable.

### Template

```markdown
---
branch: feat/<slug>
task: <program / phase id, e.g. AFF4 B4>
adrs: [0151, 0153]
base_sha: <sha this handoff describes>
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: live | consumed
---

# Handoff — <task>

## ▶ RESUME HERE
1. <the literal first command to run>
2. <the second>
⛔ Re-measure before relying on anything below — see § Trust.

## Trust
Written <incrementally from the start | cold at high context>. Sections VERIFIED
carry witnesses; BELIEVED and UNKNOWN do not.

## Goal and scope boundary
What this work is. **And what it explicitly is NOT** — the out-of-scope list is
load-bearing, not filler.

## State
### Done — VERIFIED
| What | Witness (command / file:line) | When |
### Written but UNVERIFIED
### Not started
### Tree
`base_sha`, clean/dirty, which files are committed vs. uncommitted.

## Gates
| Arm / suite | SHA | Result | Exit code |
**Did NOT run:** <named>

## Dead ends
What was tried, and **the mechanism it failed by**. Not "X didn't work" — *why*.
This section is the highest-value part of the document and exists nowhere else:
the code cannot record it and git history will not either.

## Decisions made in flight
Each flagged **ruled** or **provisional**. Provisional ones name who must rule.

## Open questions / blockers
Each with who or what can answer it.

## Next task
Concretely, with the first command.

## Re-derivation appendix
The commands that regenerate the facts above, so the successor refreshes rather
than trusts.
```

### Anti-patterns

- ⛔ **No pasted code blocks.** The successor can read the file; cite `file:line`.
- ⛔ **No restating CLAUDE.md, ARCHITECTURE.md, or an ADR.** Cite them.
- ⛔ **No chronological narration of the session.** Nobody resumes from a diary.
- ⛔ **No status.** Status is PROGRESS.md's, and a second copy will drift from it.
- ⛔ **No pronouns pointing at the conversation** — no "as discussed", "the approach we
  chose", "that bug". The reader was not there.
- **Hard cap 24 KB (~420 lines).** It is read into a fresh context; a 3,000-line handoff
  is a design document that escaped, and it re-creates the problem it was meant to solve.
  Raised from 12 KB on 2026-08-27 — the old figure forced a *"trim to the size cap"* pass
  on a handoff that had not yet said everything a successor needs, and **compression to
  fit a cap selects against qualifiers**: the bound on a fact is its shortest clause, so
  it is what gets cut, and what survives reads *more* confident than what was measured.
  ⚠ **Bytes bind, not lines.** The old pairing was internally inconsistent — at this
  corpus's observed ~58 B/line, "400 lines" is ~23 KB, so the line figure was ~2× looser
  than the byte figure and could never bind; a handoff hit 12 KB at **216 lines** and
  read as though it had half its line budget left. The line number above is *derived*
  from the byte cap at that density and is an orientation aid only. If you have to
  choose what leaves, cut **narration and restatement** (the ⛔ items above) — never a
  qualifier, a measurement's date, or the VERIFIED/BELIEVED label on a claim.

---

## RESUME mode

1. **Read the handoff.** Then read the unit's hub § Current state — it, not this
   file, is status truth; the record's § Session log holds the detail, and either may
   predate a ruling this handoff already reflects.
2. **Diff reality against `base_sha`**: `git log --oneline <base_sha>..HEAD` and
   `git status`. A handoff describing a different tree than the one you have is a
   finding, not a nuisance.
3. **Re-measure the VERIFIED claims you are about to act on** — those, not all of them.
   Re-running the whole appendix is how a resume costs more than a restart.
4. **Treat BELIEVED as unmeasured** even when it reads confidently. Especially then:
   stale text always errs *tighter*, so it reads as care.
5. **Take ownership**: bump `updated`, and correct anything you measured false **in the
   file** before continuing. An uncorrected handoff re-teaches its error to the next reader.
6. **On completion**: promote anything citable (table above), then **delete the file** in
   the Record-step commit. Do not set `status: consumed` and leave it — a consumed
   handoff that survives is indistinguishable from a live one to the next `find`.

---

## Sweeping stale handoffs

A handoff is stale when its branch is merged or gone, or its `expires` date has passed.
Both are checkable without opening the file.

```bash
for f in docs/handoffs/*.md; do
  b=$(sed -n 's/^branch: //p' "$f" | head -1)
  [ -n "$b" ] && ! git rev-parse --verify "$b" >/dev/null 2>&1 && echo "STALE: $f (branch $b gone)"
done
```

⚠ **Before deleting, check inbound links** — a handoff that acquired citations has
violated the no-citation rule and must be promoted, not swept:

```bash
grep -rl "$(basename "$f")" --include="*.md" --exclude-dir=node_modules . | grep -v "^./$f$"
```

**Gated since ADR 0185** — the HANDOFFS arm of `npm run lint:registers`
(`scripts/check-docs-registers.mjs`, gate 13) reds on: a handoff over **24 KB**; a `branch:`
that no longer exists (stale — delete or promote); and an **inbound citation** from anywhere
except a feature hub, `docs/planning/CURRENT.md`, another handoff or a review file. The
sweep above stays as the manual form for a branch you are about to delete. ⚠ The gate checks
the three properties, not whether the handoff is *true* — that is the Trust section's job.

# ADR 0186 — Documentation consolidation: one home per fact, one summary and one log per unit

**Status:** accepted
**Date:** 2026-09-03 (accepted the same day — the PO's instruction "continue" after Waves 0–2 were presented with the checkpoint list; D1–D8 as written, D3 included. The Wave 4 CLAUDE.md diff still needs its own explicit approval, CLAUDE.md §5.)
**Area:** documentation / tracking apparatus
**Amends:** ADR 0185, ADR 0179
**Related:** ADR 0127 (rules admission), ADR 0124 (the PROGRESS.md contract 0185 D6 rewrote), ADR 0079 (a gate record names the arm, never the script — the proof column below follows it)

> **Number.** 0186 = the highest number on any live branch + 1 (CLAUDE.md §8): `main` tops out
> at 0185, `origin/authz-c2-tier1` at 0180. Branch `docs-consolidation`, cut from local `main` at
> `8e0ecd1a` into a worktree, because four other interactive sessions were open on this tree and
> this branch edits CLAUDE.md. Decisions are cited as `ADR 0186 D<n>`. The plan is
> [docs/plans/docs-consolidation.md](../plans/docs-consolidation.md); the live state is the hub
> [docs/features/docs-consolidation.md](../features/docs-consolidation.md).

## Context

ADR 0185 landed on 2026-09-03 with five new file classes, a thirteenth lint gate, and a rewritten
CLAUDE.md §7. A read-only audit the same afternoon measured the result at commit `8e0ecd1a`:

| Measurement (2026-09-03, `8e0ecd1a`) | Value |
|---|---|
| PROGRESS.md bytes, before → after 0185 | 64,026 → 5,819 |
| Net documentation lines the 0185 commits added | +3,621 across 78 files |
| CLAUDE.md bytes, before → after 0185 (D8 said the pointer list "shrinks") | 35,798 → 37,734 |
| Share of CLAUDE.md that is about CLAUDE.md itself / about the docs apparatus | 13 % / 34 % |
| Living homes of "PROGRESS.md is live-state only; a unit's state is its hub" | 12 |
| Living homes of the ADR-numbering rule, and how many agree with CLAUDE.md §8 | 5 / 1 |
| Projections of hub frontmatter | 3 (`features/INDEX.md`, the PROGRESS.md roll-up, `planning/CURRENT.md`) + a hand-written DLB phase row |
| Living files citing a PROGRESS.md section 0185 D6 retired (code spans excluded) | 36 files, 95 lines — three of four live hubs, both handoffs, all four `.claude/agents/*.md`, the handoff skill, lead-playbook §5 |
| lead-playbook §5 rotation instructions naming a section 0185 abolished | 6 |
| Gate-13 checks with zero subjects in the tree | 11 of 74 |
| `follow-ups-open.md` bytes; share that is prose rather than heading or field | 737,876; 88.6 % |
| Entries carrying a duplicated `**Register line**` paragraph | 123 of 171 |
| `Closes when: PO to rule` / `Severity: per emoji at consolidation` | 114 / 132 of 171 |
| Parked entries filed in the open register / backlog items with no id | 27 / 29 of 34 |
| BUGS.md rows with a body link / ids with no reachable body anywhere | 2 of 161 / 112 |
| Unit state written in two places with verbatim pairs (hub block + handoff) | AE4 and C2, both |
| AE4's progress record holding "§ Now snapshot" sections as overflow of the 60-line cap | 2 sections |

Three facts behind the numbers. **The diary did not end; it moved** — into hub blocks that sit at
the cap on day one, into a progress record whose own text says it holds "more live detail than
the hub's 60-line cap can hold", and into a handoff twin that was renamed to the "branchless"
form so the new branch-exists arm would not fire on branches deleted the same session. **The
contract exists in five living copies** (CLAUDE.md §7, `progress-contract.md`, the PROGRESS.md
header, `docs/INDEX.md`, the handoff skill) and one of them was already wrong. **The gates prove
presence and never truth**, which 0185 said; what it did not say is that eleven of them prove
nothing at all on the population they were declared proven on.

The question that exposed the gap: *a feature spans several sessions — where does the detail of
its current state go?* The hub is capped at 60 lines by design, the handoff is ephemeral by rule
("a handoff may not be cited"), and 0185 D2 writes the record only at completion. Nothing was
named for the witnesses, gate runs and dead ends a multi-session unit accumulates.

## Problem

0185 diagnosed prose rot and answered with structure. The structure duplicated the facts it was
meant to home, the duplicates began to disagree within a day, and the one register that holds the
most text (the open follow-ups) is 89 % narrative under a field header the gate certifies. The
plan's Wave 4 alone cannot fix this: pointers must land on true text, so the stale procedure
text is repaired first, and a unit's detail needs a named home before any handoff is cut.

## Decision

Eight decisions, cited as `ADR 0186 D<n>`. Each names the 0185 decision it amends where it does.

### D1 — One projection of hub frontmatter

`docs/planning/CURRENT.md` is deleted, with its directory and the gate arm that gated it both
ways. `docs/features/INDEX.md` (generated) is the only projection: sorted `in_progress` first,
count line at the top. A session asking "what is in flight" reads its first rows. *Amends 0185
D2 (the CURRENT.md clause) and D1's `in_progress ⇒ CURRENT.md line` cross-check; the
`in_progress ⇒ branch exists` cross-check stands.*

### D2 — PROGRESS.md carries one link, not a roll-up

The generated roll-up block and its markers leave PROGRESS.md; the builder no longer writes into
PROGRESS.md and the byte-compare arm for that block is deleted. PROGRESS.md points at the index in
one line. *Amends 0185 D6 (the roll-up clause).*

### D3 — One summary and one log per unit; the handoff is a resume pointer

A unit's state has exactly one home per kind:

| Layer | File | Holds | Read when |
|---|---|---|---|
| **Summary** | `docs/features/<code>.md` § Current state | Objective · done since start · in progress · next · blockers. ≤ 60 lines, **replaced** every session | First, by every session on the unit |
| **Detail** | `docs/progress/<code>.md` § Session log | One dated `### YYYY-MM-DD` subsection per session, **appended**: what was verified and its witness (command, SHA, file:line), gate runs with exit codes, dead ends, decisions made in flight (then promoted to an ADR), open questions | Second, when the summary is not enough |
| **Resume** | `docs/handoffs/<code>-<date>.md` | Only while a session is paused mid-task: the resume pointer, trust level, tree state, the next command. Nothing else | Once, by the resuming session; deleted on resume or at landing |
| **Approach** | `docs/plans/<feature>.md` | How, never status | Before starting |
| **Outbound** | ADRs · `follow-ups-open.md` · `BUGS.md` · `backend-state.md` | Anything that outlives the unit | On demand |

The rule of thumb: a line carrying a *state word* (done, in progress, blocked, next) is hub; a
line carrying a *witness* (a command, a SHA, a file:line, an exit code) is record. History never
lives in the hub — when a Blockers item resolves, the hub line is deleted and the record's dated
section says how. Parallel sessions on one unit: one branch, one hub, the lead writes the block,
each teammate appends its own dated subsection to the record.

Gate: an `in_progress` or `gated` hub's `progress:` resolves and the record contains
`## Session log` with non-decreasing `### YYYY-MM-DD` dates. A handoff carries `branch:` when its
unit has a hub, else `expires:`, and the gate reds past expiry; the handoff template loses every
state-bearing section. *Amends 0185 D2 on two clauses: "handoffs are unchanged", and "cut into
the progress record at completion" — the record is written throughout.*

### D4 — The follow-up register is an index; bodies are files

Each entry in `follow-ups-open.md` is its heading, the four fields (`Filed`, `Owner`, `Severity`,
`Closes when`) and a `**Status:**` of `open` or `parked` (`parked` requires `Revisit when`).
A body over ten lines lives in `docs/followups/<FUP-ID>.md`, the shape 0185 D3 gave bugs, linked
from the entry and linked by exactly one entry. `deferred-backlog.md` merges into the register as
`parked` entries and is deleted; every parked item gets an id. `**Register line**` paragraphs are
forbidden. Headings ≤ 160 characters; entries ≤ 20 lines; no `##`/`####` inside an entry; Owner
from a closed vocabulary. The archive stays a separate file — 0179's principle stands; only the
*location of bodies* changes. *Amends 0185 D5 and ADR 0179 in the body-location clause.*

### D5 — The contract has one home; the rule file is deleted

`.claude/rules/progress-contract.md` is deleted. It stated no standing prohibition, restated what
gates 7 and 13 enforce (which CLAUDE.md §8's admission bar forbids), and was the fifth copy of
"where a line belongs". That table has one home, `docs/INDEX.md`; the rotation recipe has one
home, lead-playbook §5; the mechanical content is the two gates. CLAUDE.md §7 and the PROGRESS.md
header shrink to pointers. *Amends 0185 D6 and D8 (the contract-file clauses).*

### D6 — Warnings become ratchets

Every count gate 13 prints today as a warning (`Closes when: PO to rule`, `Severity: per emoji
at consolidation`, `unrated`, `untriaged`, `prose only`) becomes a constant in the script that may
only decrease; a commit that raises it reds. The PO's ruling lists are unchanged by this ADR;
they can no longer grow silently.

### D7 — The ledger holds completed rows only

`docs/progress/phase-ledger.md` keeps one rule: completed phases, forever. Not-started rows
(today: 9, 18, 19, DLB) leave it; PROGRESS.md § Phase Status is their only home. DLB's status
sentence lives once, in its hub; the phase row points there.

### D8 — Gate hygiene, and what the gate doc is for

The `complete` cross-check becomes row-grade (a ledger table row, or a review whose verdict line
matches the two forms the live reviews use; "NOT APPROVED" reds). The rules-staleness gate
parses YAML folded scalars or reds on a literal `>-`, and reds when `.claude/rules/` is absent.
One link checker and one resolved-heading regex serve both gates. The retired-check tombstones
leave `check-progress-doc.mjs`. Every arm prints its subject count. `docs/lint-gates.md` carries
rationale and the trap in reading each gate, one paragraph per gate, never a check list — the
scripts are the authority. **New in this ADR's first wave:** a `RETIRED` arm of gate 13 that reds
on any citation of a retired PROGRESS.md section in a living Markdown file (archives, ADRs,
reviews and `design/temp` excluded; code spans and fences blanked so a quotation is not a
citation). CLAUDE.md joins that arm's domain in Wave 4, with the PO-approved diff that removes its
two citations — until then the exclusion is stated in the arm, not hidden.

## Considered options

- **A — leave 0185 as built and repair only the stale text.** Rejected: the duplication is
  structural. Three projections of one frontmatter set, two state documents per unit and five
  copies of the contract will drift again however carefully they are repaired once.
- **B — revert 0185.** Rejected: the register fields, the BUGS.md table, LESSONS.md, hub
  frontmatter with a generated index, and the gate self-test pattern are sound and already
  gated. The defect is the layers around them.
- **C — the subset above, each cut leaving one canonical home, each new check proven able to
  red on a live subject.** Chosen.

## Consequences

- Files deleted: `docs/planning/CURRENT.md` (and the directory), `docs/followups/deferred-backlog.md`,
  `.claude/rules/progress-contract.md`, both landed handoffs. Moved: `docs/features/legacy-codes.md`
  → `docs/followups/`. Created: `docs/followups/<FUP-ID>.md` bodies, `docs/progress/c2-tier1.md`,
  the first postmortem.
- Gate 13 loses the CURRENT arm and the roll-up byte-compare; gains RETIRED, the record/session-log
  checks, the handoff expiry check, the register-shape checks, the ratchets. `lint:rules` count
  drops to ten.
- CLAUDE.md goes to ≤ 20,480 bytes in one PO-approved diff, after the procedure text it will point
  at is true (lead-playbook §5, the four agent files, the handoff skill).
- ADR 0179 is amended in its body-location clause; 0185 in D2 (CURRENT.md, handoffs, record
  timing), D5 (register shape), D6 (roll-up, contract file), D8 (contract file). Everything else in
  both stands, including 0185's severity scale, bug table, lessons register and index generation.
- The three PO ruling lists (untriaged bugs, blank closing conditions, blank revisit triggers) are
  untouched; the ratchets stop them growing.

## Implementation constraints

- `npm run lint` is green at **every** commit on the branch; a wave that deletes a file and its
  arm does both in one commit. New arms land with the data that makes them green, never after.
- Wave 1 (stale procedure text) precedes Wave 4 (CLAUDE.md). CLAUDE.md is edited once, by a diff
  the PO approves before commit.
- Own worktree and branch; the primary tree is not touched while another session is live.
- Bulk edits by Node script; hand edits by the Edit tool; every `.md` is LF.
- Checkpoints: this ADR's acceptance (Waves 3–6 wait for it; Waves 1–2 do not — Wave 1 repairs
  falsehoods and Wave 2 implements D1, D2 and D7, all reversible by `git revert` if the ADR is
  rejected), D3 before Wave 3, the CLAUDE.md diff before Wave 4, gate 9's proposed-ADR review
  before 2026-09-24, human approval at Record.

## Related implementation

- Plan: `docs/plans/docs-consolidation.md` · hub: `docs/features/docs-consolidation.md` · record:
  `docs/progress/docs-consolidation.md`
- `scripts/check-docs-registers.mjs` · `scripts/build-features-index.mjs` ·
  `scripts/check-progress-doc.mjs` · `scripts/check-rules-staleness.mjs` · `docs/lint-gates.md`
- `docs/lead-playbook.md` §5 · `.claude/agents/*.md` · `.claude/skills/handoff/SKILL.md` ·
  `docs/INDEX.md` · `CLAUDE.md` §§ 5–8 (Wave 4)
